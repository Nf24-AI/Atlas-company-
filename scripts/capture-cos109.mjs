// COS-109 evidence capture: matched before/after screenshots of the Project Manager office.
// Throwaway local server (DEMO mode, temp data dir, no keys), fresh CEO account, identical player positions and
// camera poses, two viewports. Eye-level shots use the capture-only `window.__atlas.debugView` override.
//
//   node scripts/capture-cos109.mjs <label> [port]      e.g. "before" (run in a checkout of main) or "after"
//
// Output: docs/cos-109/<label>-<shot>-<WxH>.png and docs/cos-109/measurements-<label>.json
// FPS is headless Chromium (software WebGL / SwiftShader): only comparable before vs after on the same machine.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '@playwright/test';

const label = process.argv[2] || 'capture';
const PORT = Number(process.argv[3] || 3499);
const OUT = path.resolve(process.env.COS109_OUT || path.join('docs', 'cos-109'));
const VIEWPORTS = [[1280, 720], [1920, 1080]];
const SHOTS = [
  {id: 'follow', player: [17, -9.3], mode: 'follow'},                                   // standing in front of the PM desk
  {id: 'overview', player: [17, -9.3], mode: 'overview'},
  {id: 'eye-door', player: [17, -3.5], view: {eye: [17.1, 1.62, -7.9], target: [17, 0, -13.5]}},   // eye level from the doorway
  {id: 'eye-corner', player: [17, -3.5], view: {eye: [21.7, 1.62, -7.7], target: [14.6, 0, -13.2]}}, // eye level, diagonal
];

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)); }
  throw new Error('server did not start: ' + url);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cos109-'));
const server = spawn(process.execPath, ['server.js'], {env: {...process.env, PORT: String(PORT), HOST: '127.0.0.1', ATLAS_DATA_DIR: tmp, STATE_FILE: path.join(tmp, 'state.json'), GROQ_API_KEY: '', DEEPSEEK_API_KEY: ''}, stdio: 'ignore'});
const results = {label, date: new Date().toISOString(), note: 'Headless Chromium + SwiftShader. Positions/poses identical for before and after.', shots: []};
try {
  await waitFor(`http://127.0.0.1:${PORT}/api/health`);
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: VIEWPORTS[0][0], height: VIEWPORTS[0][1]}});
  for (const [W, H] of VIEWPORTS) {
    await page.setViewportSize({width: W, height: H});
    await page.goto(`http://127.0.0.1:${PORT}/`);
    if (W === VIEWPORTS[0][0]) {
      await page.fill('[name=displayName]', 'CEO');
      await page.fill('[name=email]', 'ceo@atlas.test');
      await page.fill('[name=password]', 'capture password 109');
      await page.click('#authForm button');
    }
    await page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20000});
    results.renderer = await page.evaluate(() => window.__atlas.renderer);
    results.tasks = await page.evaluate(() => window.__atlas.store.data.tasks.length);
    await page.waitForTimeout(3500); // welcome toast fades
    for (const s of SHOTS) {
      await page.evaluate(([x, z, mode, view]) => {
        const a = window.__atlas; a.place(x, z); a.debugView = view || null;
        a.camera.setMode(mode || 'follow', {instant: true});
      }, [s.player[0], s.player[1], s.mode, s.view]);
      await page.waitForTimeout(2500);
      const file = path.join(OUT, `${label}-${s.id}-${W}x${H}.png`);
      await page.screenshot({path: file});
      const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < 3000) requestAnimationFrame(f); else res(n / ((t - t0) / 1000)); }; requestAnimationFrame(f); }));
      const entry = {shot: s.id, viewport: `${W}x${H}`, file: 'docs/cos-109/' + path.basename(file), fpsHeadless: +fps.toFixed(1)};
      results.shots.push(entry); console.log(entry);
    }
    await page.evaluate(() => { window.__atlas.debugView = null; });
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `measurements-${label}.json`), JSON.stringify(results, null, 2) + '\n');
} finally {
  const exited = new Promise(r => server.once('exit', r));
  server.kill();
  await exited; // Windows keeps the SQLite file locked until the process is gone
  try { fs.rmSync(tmp, {recursive: true, force: true}); } catch (e) { console.warn('temp dir not removed:', tmp, e.code); }
}
