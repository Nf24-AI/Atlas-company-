// COS-108 evidence capture: matched before/after screenshots and player-scale measurements.
// Starts a throwaway local server (DEMO mode, temp data dir, no keys), creates a CEO account,
// places the player at the same three coordinates and captures 1280×720 screenshots.
//
//   node scripts/capture-cos108.mjs <label>      e.g. "before" or "after"
//
// Output: docs/cos-108/<label>-<scene>[-<camera>].png and docs/cos-108/measurements-<label>.json
// On builds without camera modes (the pre-COS-108 baseline) only the default camera is captured and
// the player's on-screen height is computed from the known camera parameters (see `analytic`).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '@playwright/test';

const label = process.argv[2] || 'capture';
const PORT = 3399, W = 1280, H = 720;
const OUT = path.join('docs', 'cos-108');
const SCENES = [
  {id: 'reception', x: 0, z: 14},     // spawn point
  {id: 'pm-door', x: 17, z: -5},      // corridor in front of the Project Manager office
  {id: 'developers', x: -16, z: 3},   // open-plan developer area
];
const PLAYER_HEIGHT = 2.0; // humanoid.js: hips .92 + neck .72 + head .16 + radius .2

/** Pinhole projection of the player's feet and head for a camera at player+offset looking at (p, lookY). */
function analytic({offset, lookY = 1, fovDeg = 42, height = H}) {
  const eye = offset, target = {x: 0, y: lookY, z: 0};
  const f = norm(sub(target, eye)), r = norm(cross(f, {x: 0, y: 1, z: 0})), u = cross(r, f);
  const k = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const proj = p => { const d = sub(p, eye); const z = dot(d, f); return (1 - (dot(d, u) * k / z + 1) / 2) * height; };
  return proj({x: 0, y: 0, z: 0}) - proj({x: 0, y: PLAYER_HEIGHT, z: 0});
}
const sub = (a, b) => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x});
const norm = a => { const l = Math.hypot(a.x, a.y, a.z); return {x: a.x / l, y: a.y / l, z: a.z / l}; };

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)); }
  throw new Error('server did not start: ' + url);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-capture-'));
const server = spawn(process.execPath, ['server.js'], {env: {...process.env, PORT: String(PORT), HOST: '127.0.0.1', ATLAS_DATA_DIR: tmp, STATE_FILE: path.join(tmp, 'state.json'), GROQ_API_KEY: '', DEEPSEEK_API_KEY: ''}, stdio: 'ignore'});
const results = {label, viewport: `${W}x${H}`, date: new Date().toISOString(), scenes: []};
try {
  await waitFor(`http://127.0.0.1:${PORT}/api/health`);
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: W, height: H}});
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.fill('[name=displayName]', 'CEO');
  await page.fill('[name=email]', 'ceo@atlas.test');
  await page.fill('[name=password]', 'capture password 108');
  await page.click('#authForm button');
  await page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20000});
  const hasModes = await page.evaluate(() => Boolean(window.__atlas.camera?.setMode));
  results.renderer = await page.evaluate(() => window.__atlas.renderer);
  await page.waitForTimeout(3500); // let the welcome toast fade
  for (const s of SCENES) {
    for (const mode of hasModes ? ['follow', 'overview'] : ['default']) {
      await page.evaluate(([x, z, m]) => { window.__atlas.place(x, z); if (m !== 'default') window.__atlas.camera.setMode(m, {instant: true}); }, [s.x, s.z, mode]);
      await page.waitForTimeout(2500); // camera easing settles
      const file = path.join(OUT, `${label}-${s.id}${hasModes ? '-' + mode : ''}.png`);
      await page.screenshot({path: file});
      const measured = await page.evaluate(() => window.__atlas.measure?.() ?? null);
      // Share of the viewport where the top-most element is HUD chrome instead of the 3D scene
      // (world labels and the canvas count as scene). 64×36 sample grid.
      const hudCover = await page.evaluate(() => {
        let covered = 0, n = 0;
        for (let i = 0; i < 64; i++) for (let j = 0; j < 36; j++) {
          const el = document.elementFromPoint((i + .5) * innerWidth / 64, (j + .5) * innerHeight / 36); n++;
          if (el && el.id !== 'world' && !el.closest('#labels')) covered++;
        }
        return covered / n;
      });
      // Frames per second over 3 s. Headless Chromium uses software WebGL (SwiftShader): only useful to
      // compare before/after on the same machine, not as a real-GPU figure.
      const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < 3000) requestAnimationFrame(f); else res(n / ((t - t0) / 1000)); }; requestAnimationFrame(f); }));
      const entry = {scene: s.id, x: s.x, z: s.z, camera: mode, file: file.replaceAll('\\', '/'), hudCoverPct: +(hudCover * 100).toFixed(1), fpsHeadless: +fps.toFixed(1)};
      if (measured) Object.assign(entry, {playerPx: Math.round(measured.playerPx), playerPctOfHeight: +(measured.playerPx / H * 100).toFixed(1), method: 'renderer projection'});
      else {
        const px = analytic({offset: {x: 11, y: 16, z: 17}}); // pre-COS-108 DEFAULT_CAMERA offset, FOV 42°, look-at y=1
        Object.assign(entry, {playerPx: Math.round(px), playerPctOfHeight: +(px / H * 100).toFixed(1), method: 'analytic (camera offset 11,16,17; FOV 42°)'});
      }
      results.scenes.push(entry);
      console.log(entry);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, `measurements-${label}.json`), JSON.stringify(results, null, 2) + '\n');
} finally {
  const exited = new Promise(r => server.once('exit', r));
  server.kill();
  await exited; // Windows keeps the SQLite file locked until the process is gone
  try { fs.rmSync(tmp, {recursive: true, force: true}); } catch (e) { console.warn('temp dir not removed:', tmp, e.code); }
}
