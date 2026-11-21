// Server configuration. Secrets come only from the process environment or a local, git-ignored
// .env file; they are never sent to the browser, logged, or passed to sandboxed processes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(env.ATLAS_DATA_DIR || path.join(ROOT, 'data'));
  return Object.freeze({
    host: env.HOST || '127.0.0.1',
    port: num(env.PORT, 3099),
    dataDir,
    dbFile: env.ATLAS_DB_FILE || path.join(dataDir, 'atlas.sqlite'),
    sandboxDir: path.join(dataDir, 'sandbox'),
    // Allow binding beyond localhost only when explicitly acknowledged (staging behind TLS proxy).
    allowRemote: env.ATLAS_ALLOW_REMOTE === 'i-understand-the-risks',
    secureCookies: env.ATLAS_SECURE_COOKIES === '1',
    publicOrigin: env.ATLAS_PUBLIC_ORIGIN || '',
    sessionDays: num(env.ATLAS_SESSION_DAYS, 7),
    // Cost controls (USD). Conservative defaults for a single personal user.
    monthlyBudgetUsd: num(env.ATLAS_MONTHLY_BUDGET_USD, 5),
    providers: {
      groq: {apiKey: env.GROQ_API_KEY || '', baseUrl: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'},
      deepseek: {apiKey: env.DEEPSEEK_API_KEY || '', baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'},
    },
    models: {
      manager: {provider: env.MANAGER_PROVIDER || 'groq', model: env.MANAGER_MODEL || 'openai/gpt-oss-120b'},
      director: {provider: env.DIRECTOR_PROVIDER || 'deepseek', model: env.DIRECTOR_MODEL || 'deepseek-v4-pro'},
      developer: {provider: env.DEVELOPER_PROVIDER || 'deepseek', model: env.DEVELOPER_MODEL || 'deepseek-flash'},
      qa: {provider: env.QA_PROVIDER || 'groq', model: env.QA_MODEL || 'openai/gpt-oss-120b'},
    },
    // Optional GitHub sandbox for real pull requests. Must be a DEDICATED repo; token scoped to it only.
    github: {repo: env.SANDBOX_GITHUB_REPO || '', token: env.SANDBOX_GITHUB_TOKEN || '', apiBase: env.SANDBOX_GITHUB_API || 'https://api.github.com'},
    e2e: env.ATLAS_E2E === '1',
  });
}
