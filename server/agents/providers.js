// Provider-agnostic model adapters (OpenAI-compatible chat completions) with:
// verified pricing, pre-call budget checks, timeouts, bounded retries with backoff on 429/5xx,
// usage accounting and NO silent fallback to other (possibly more expensive) models.
// Raw reasoning (`reasoning_content` / `reasoning`) is discarded and never stored or shown.

/**
 * USD per 1M tokens, verified 2026-11-21 against official pages:
 *  - Groq: https://console.groq.com/docs/model/openai/gpt-oss-120b
 *  - DeepSeek: https://api-docs.deepseek.com/quick_start/pricing (peak = UTC 01:00–04:00 and
 *    06:00–10:00 Mon–Fri; off-peak = half price). Re-verify before relying on estimates.
 */
export const PRICING = Object.freeze({
  'groq:openai/gpt-oss-120b': {in: 0.15, cachedIn: 0.075, out: 0.60},
  'deepseek:deepseek-v4-pro': {peak: {in: 1.32, cachedIn: 0.044, out: 3.96}, offPeak: {in: 0.66, cachedIn: 0.022, out: 1.98}},
  'deepseek:deepseek-flash': {peak: {in: 0.30, cachedIn: 0.006, out: 1.20}, offPeak: {in: 0.15, cachedIn: 0.003, out: 0.60}},
});

export function isDeepSeekPeak(d = new Date()) {
  const day = d.getUTCDay(), h = d.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}
export function priceFor(provider, model, at = new Date()) {
  const p = PRICING[`${provider}:${model}`];
  if (!p) return null;
  return p.peak ? (isDeepSeekPeak(at) ? p.peak : p.offPeak) : p;
}
export function costUsd(price, {tokensIn, tokensOut, cachedTokens = 0}) {
  return ((tokensIn - cachedTokens) * price.in + cachedTokens * price.cachedIn + tokensOut * price.out) / 1e6;
}
/** Rough token estimate (≈ 3 chars/token for mixed Arabic/English/code) for pre-call budget checks. */
export const estimateTokens = messages => Math.ceil(JSON.stringify(messages).length / 3);

export class ProviderError extends Error { constructor(m, extra = {}) { super(m); Object.assign(this, extra); } }
export class BudgetError extends Error { constructor(m) { super(m); this.budget = true; } }

export function createProviders(config, {fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))} = {}) {
  const cfg = name => config.providers[name];
  return {
    isLive: provider => Boolean(cfg(provider)?.apiKey),
    /**
     * One chat completion. `tools` optional (function calling). `json` requests a JSON object.
     * Returns {message:{content, toolCalls}, usage:{tokensIn,tokensOut,cachedTokens}, costUsd}.
     */
    async chat({provider, model, messages, tools, json = false, maxTokens = 1500, thinking = false, signal, timeoutMs = 45000, maxRetries = 2}) {
      const pc = cfg(provider);
      if (!pc?.apiKey) throw new ProviderError(`${provider} is not configured`, {code: 'not_configured'});
      const price = priceFor(provider, model);
      if (!price) throw new ProviderError(`No verified pricing for ${provider}:${model}; refusing LIVE call (cannot enforce budget)`, {code: 'unpriced'});
      const body = {model, messages, max_tokens: maxTokens};
      if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }
      if (json && !tools?.length) body.response_format = {type: 'json_object'};
      if (provider === 'deepseek') body.thinking = {type: thinking ? 'enabled' : 'disabled'};
      if (!thinking) body.temperature = 0.2;
      let attempt = 0;
      for (;;) {
        const timeout = AbortSignal.timeout(timeoutMs);
        const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
        let res, payload;
        try {
          res = await fetchImpl(`${pc.baseUrl}/chat/completions`, {method: 'POST', signal: sig, headers: {'Content-Type': 'application/json', Authorization: `Bearer ${pc.apiKey}`}, body: JSON.stringify(body)});
          payload = await res.json().catch(() => ({}));
        } catch (e) {
          if (signal?.aborted) throw new ProviderError('cancelled', {code: 'cancelled'});
          if (attempt++ < maxRetries) { await sleep(1000 * 2 ** attempt); continue; }
          throw new ProviderError(`${provider} request failed: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`, {code: 'network'});
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt++ < maxRetries) {
            const ra = Number(res.headers.get?.('retry-after')) || 0;
            await sleep(Math.min(8000, Math.max(ra * 1000, 1000 * 2 ** attempt))); continue;
          }
          throw new ProviderError(`${provider} ${res.status === 429 ? 'rate limit' : 'server error'} (${res.status}) after ${maxRetries} retries`, {code: res.status === 429 ? 'rate_limited' : 'server_error'});
        }
        if (!res.ok) throw new ProviderError(`${provider} responded ${res.status}: ${String(payload?.error?.message || '').slice(0, 200)}`, {code: 'http_' + res.status});
        const msg = payload.choices?.[0]?.message || {};
        const u = payload.usage || {};
        const usage = {tokensIn: u.prompt_tokens || 0, tokensOut: u.completion_tokens || 0, cachedTokens: u.prompt_cache_hit_tokens || u.prompt_tokens_details?.cached_tokens || 0};
        return {
          message: {content: typeof msg.content === 'string' ? msg.content : '', toolCalls: (msg.tool_calls || []).map(t => ({id: t.id, name: t.function?.name, arguments: t.function?.arguments}))},
          usage, costUsd: costUsd(price, usage), price,
        };
      }
    },
  };
}
