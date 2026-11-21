// Minimal dependency-free lint: (1) every JS/MJS file parses (`node --check`), (2) no credential-
// looking strings in tracked source. A full ESLint setup is deliberately deferred (see BLOCKERS.md).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {encoding: 'utf8'})
  .split('\n').filter(f => f && fs.existsSync(f));
let failed = 0;

for (const f of files.filter(f => /\.(m?js)$/.test(f) && !f.startsWith('node_modules/'))) {
  try { execFileSync(process.execPath, ['--check', f], {stdio: 'pipe'}); }
  catch (e) { failed++; console.error(`syntax: ${f}\n${e.stderr}`); }
}

const SECRET = /(sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/;
for (const f of files.filter(f => f !== 'package-lock.json' && !/\.(png|jpg|ico|glb|woff2?)$/.test(f))) {
  const text = fs.readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => { if (SECRET.test(line)) { failed++; console.error(`possible secret: ${f}:${i + 1}`); } });
}
for (const f of files) if (/(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example')) { failed++; console.error(`env file must not be committed: ${f}`); }

console.log(failed ? `lint: ${failed} problem(s)` : `lint: ${files.length} files OK`);
process.exit(failed ? 1 : 0);
