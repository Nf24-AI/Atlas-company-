// git wrapper: execFile with a fixed argv (no shell), hooks disabled, scrubbed environment,
// timeout. Credentials for an optional GitHub push are passed via env-only git config.
import {execFile} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export const BRANCH_RE = /^atlas\/[a-z0-9][a-z0-9-]{2,60}$/;

export function git(cwd, args, {author, timeout = 20000, extraEnv = {}} = {}) {
  const env = {
    PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, HOME: os.tmpdir(), USERPROFILE: os.tmpdir(),
    GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'atlas-empty-gitconfig'),
    ...(author ? {GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email, GIT_COMMITTER_NAME: author.name, GIT_COMMITTER_EMAIL: author.email} : {}),
    ...extraEnv,
  };
  const full = ['-c', 'core.hooksPath=' + path.join(os.tmpdir(), 'atlas-no-hooks'), '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args];
  return new Promise((resolve, reject) => {
    execFile('git', full, {cwd, env, timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true}, (err, stdout, stderr) => {
      if (err) return reject(new Error(`git ${args[0]} failed: ${String(stderr || err.message).trim().slice(0, 400)}`));
      resolve(stdout.trim());
    });
  });
}

export const currentBranch = cwd => git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
export const headSha = cwd => git(cwd, ['rev-parse', 'HEAD']);

export async function checkoutBranch(cwd, branch, {create = false, from = 'main'} = {}) {
  if (branch !== 'main' && !BRANCH_RE.test(branch)) throw new Error('branch name not allowed');
  const exists = await git(cwd, ['branch', '--list', branch]).then(Boolean);
  if (exists) return git(cwd, ['checkout', '-q', branch]);
  if (!create) throw new Error(`branch ${branch} does not exist`);
  return git(cwd, ['checkout', '-q', '-b', branch, from]);
}

export async function commitAll(cwd, message, author) {
  await git(cwd, ['add', '-A']);
  const status = await git(cwd, ['status', '--porcelain']);
  if (!status) return null;
  await git(cwd, ['commit', '-q', '-m', String(message).replace(/[\r\n]+/g, ' ').slice(0, 200)], {author});
  return headSha(cwd);
}

export async function diffStat(cwd, base = 'main') { return git(cwd, ['diff', '--stat', `${base}...HEAD`]); }
export async function diff(cwd, base = 'main', maxBytes = 20000) {
  const d = await git(cwd, ['diff', `${base}...HEAD`]);
  return d.length > maxBytes ? d.slice(0, maxBytes) + '\n…[diff truncated]' : d;
}
