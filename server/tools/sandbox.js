// Sandbox workspace for AI employees. One git repository per project under data/sandbox/,
// created from server/sandbox-template. Every path an agent supplies goes through resolveSafe(),
// which enforces a per-permission allowlist in code (never trusting model instructions).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {git} from './git.js';

export const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sandbox-template');
export const LIMITS = Object.freeze({maxFileBytes: 64 * 1024, maxReadBytes: 48 * 1024, maxFilesListed: 300, maxWritesPerRun: 20});

/** Write scopes (relative, forward slashes). Reads are allowed anywhere in the repo except .git and node_modules. */
export const WRITE_SCOPES = Object.freeze({
  'sandbox.write.src': [/^src\/[\w./-]+\.(js|mjs|json|md)$/, /^test\/(?!qa\/)[\w./-]+\.(js|mjs)$/, /^README\.md$/],
  'sandbox.write.qa': [/^test\/qa\/[\w./-]+\.(js|mjs)$/],
});
const DENY = [/^\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)\.env/, /(^|\/)\.\.(\/|$)/];

export class PolicyError extends Error { constructor(m) { super(m); this.policy = true; } }

/** Normalises an agent-supplied path and proves it stays inside `root`. */
export function resolveSafe(root, rel, {write = null} = {}) {
  if (typeof rel !== 'string' || !rel || rel.length > 200) throw new PolicyError('invalid path');
  if (/[\0:*?"<>|]/.test(rel) || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) throw new PolicyError('absolute or illegal path');
  const norm = path.posix.normalize(rel.replace(/\\/g, '/')).replace(/^\.\//, '');
  if (norm.startsWith('..') || DENY.some(r => r.test(norm))) throw new PolicyError(`path not allowed: ${norm}`);
  const full = path.resolve(root, norm);
  if (full !== root && !full.startsWith(root + path.sep)) throw new PolicyError('path escapes sandbox');
  if (write) {
    const scopes = WRITE_SCOPES[write] || [];
    if (!scopes.some(r => r.test(norm))) throw new PolicyError(`write outside permitted scope (${write}): ${norm}`);
  }
  // Refuse symlinks anywhere on the way (a planted link could point outside the sandbox).
  let cur = root;
  for (const seg of norm.split('/')) {
    cur = path.join(cur, seg);
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw new PolicyError('symlinks are not allowed');
  }
  return {full, rel: norm};
}

export async function ensureSandbox(sandboxRoot, projectId) {
  if (!/^[A-Za-z0-9-]{6,64}$/.test(projectId)) throw new PolicyError('bad project id');
  const dir = path.join(sandboxRoot, projectId, 'repo');
  if (fs.existsSync(path.join(dir, '.git'))) return dir;
  fs.mkdirSync(dir, {recursive: true});
  fs.cpSync(TEMPLATE, dir, {recursive: true});
  await git(dir, ['init', '-q', '-b', 'main']);
  await git(dir, ['add', '-A']);
  await git(dir, ['commit', '-q', '-m', 'chore: sandbox baseline from ATLAS template'], {author: {name: 'ATLAS System', email: 'system@atlas.local'}});
  return dir;
}

export function listFiles(root) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (DENY.some(x => x.test(r)) || e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(path.join(d, e.name), r); else out.push(r);
      if (out.length >= LIMITS.maxFilesListed) return;
    }
  };
  walk(root, '');
  return out.sort();
}

export function readFile(root, rel) {
  const {full, rel: norm} = resolveSafe(root, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new PolicyError(`no such file: ${norm}`);
  const buf = fs.readFileSync(full);
  return buf.subarray(0, LIMITS.maxReadBytes).toString('utf8') + (buf.length > LIMITS.maxReadBytes ? '\n…[truncated]' : '');
}

export function writeFile(root, rel, content, scope) {
  if (typeof content !== 'string') throw new PolicyError('content must be a string');
  if (Buffer.byteLength(content) > LIMITS.maxFileBytes) throw new PolicyError('file too large');
  const {full, rel: norm} = resolveSafe(root, rel, {write: scope});
  fs.mkdirSync(path.dirname(full), {recursive: true});
  fs.writeFileSync(full, content);
  return norm;
}
