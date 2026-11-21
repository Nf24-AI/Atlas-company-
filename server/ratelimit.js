// In-memory fixed-window rate limiter (single-process local server).
export function createRateLimiter() {
  const buckets = new Map();
  let calls = 0;
  return {
    /** Returns {ok, retryAfter}. `key` should combine route class and client identity. */
    hit(key, limit, windowMs, now = Date.now()) {
      if (++calls % 500 === 0) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
      let b = buckets.get(key);
      if (!b || b.reset <= now) { b = {count: 0, reset: now + windowMs}; buckets.set(key, b); }
      b.count++;
      return b.count > limit ? {ok: false, retryAfter: Math.ceil((b.reset - now) / 1000)} : {ok: true};
    },
  };
}
