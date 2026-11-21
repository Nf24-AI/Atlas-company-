// Runs the sandbox test suite with Node's permission model:
//   * filesystem reads/writes limited to the sandbox repository,
//   * child processes, workers and native addons denied,
//   * environment scrubbed (no API keys or tokens reach the tests),
//   * hard timeout and output cap.
// LIMITATION: Node 24's permission model does not restrict network access; see SECURITY.md.
import {execFile} from 'node:child_process';
import os from 'node:os';

export function runTests(cwd, {timeoutMs = 60000, pattern = 'test/**/*.test.js'} = {}) {
  const args = ['--permission', `--allow-fs-read=${cwd}`, `--allow-fs-write=${cwd}`, '--test', '--test-isolation=none', '--test-reporter=tap', pattern];
  const env = {PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: os.tmpdir(), TMP: os.tmpdir(), NODE_ENV: 'test'};
  const started = Date.now();
  return new Promise(resolve => {
    execFile(process.execPath, args, {cwd, env, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true}, (err, stdout, stderr) => {
      const out = String(stdout) + (stderr ? '\n' + String(stderr) : '');
      const num = k => Number((new RegExp(`^# ${k} (\\d+)`, 'm').exec(out) || [])[1] || 0);
      const timedOut = Boolean(err && err.killed);
      const failures = [...out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(m => m[1].trim()).slice(0, 30);
      resolve({
        passed: !err && num('fail') === 0 && num('pass') > 0,
        exitCode: err ? (err.code ?? 1) : 0,
        timedOut,
        counts: {tests: num('tests'), pass: num('pass'), fail: num('fail')},
        failures,
        durationMs: Date.now() - started,
        output: out.length > 12000 ? out.slice(0, 12000) + '\n…[truncated]' : out,
      });
    });
  });
}
