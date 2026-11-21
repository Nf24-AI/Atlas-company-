// Optional GitHub sandbox integration (real pull requests). Disabled unless BOTH
// SANDBOX_GITHUB_REPO and SANDBOX_GITHUB_TOKEN are set. The token should be a fine-grained
// token scoped to that one dedicated sandbox repository (contents + pull requests only).
// Without it, ATLAS records a clearly labelled *local* review request instead.
import {git} from './git.js';

export function githubEnabled(cfg) { return Boolean(cfg.repo && cfg.token && /^[\w.-]+\/[\w.-]+$/.test(cfg.repo)); }

async function gh(cfg, method, route, body, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.apiBase}/repos/${cfg.repo}${route}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: {Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'atlas-company-os'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${method} ${route} → ${res.status}: ${String(json.message || '').slice(0, 200)}`);
  return json;
}

/** Push the branch (token via env-only git config, never argv) and open a PR. */
export async function openPullRequest(cfg, repoDir, {branch, title, body}, fetchImpl = fetch) {
  const basic = Buffer.from(`x-access-token:${cfg.token}`).toString('base64');
  await git(repoDir, ['push', '-q', `https://github.com/${cfg.repo}.git`, `${branch}:${branch}`], {
    timeout: 60000,
    extraEnv: {GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`},
  });
  const pr = await gh(cfg, 'POST', '/pulls', {title, body, head: branch, base: 'main'}, fetchImpl);
  return {url: pr.html_url, number: pr.number};
}

/** Merge — only ever called after a CEO approval record exists (enforced by the orchestrator). */
export async function mergePullRequest(cfg, number, fetchImpl = fetch) {
  return gh(cfg, 'PUT', `/pulls/${Number(number)}/merge`, {merge_method: 'squash'}, fetchImpl);
}
