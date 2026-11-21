// COS-110A evidence: screenshots of the opt-in third-person view (DEMO, throwaway data dir, no keys).
//   node scripts/capture-cos110a.mjs     → docs/cos-110a/*.png
import {spawn} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {chromium} from '@playwright/test';
const PORT = 3699, OUT = path.join('docs', 'cos-110a');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cos110a-'));
const server = spawn(process.execPath, ['server.js'], {env: {...process.env, PORT: String(PORT), HOST: '127.0.0.1', ATLAS_DATA_DIR: tmp, GROQ_API_KEY: '', DEEPSEEK_API_KEY: ''}, stdio: 'ignore'});
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 250)); }
  fs.mkdirSync(OUT, {recursive: true});
  const b = await chromium.launch(); const page = await b.newPage({viewport: {width: 1280, height: 720}});
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.fill('[name=displayName]', 'CEO'); await page.fill('[name=email]', 'ceo@atlas.test'); await page.fill('[name=password]', 'capture password 110');
  await page.click('#authForm button');
  await page.waitForFunction(() => window.__atlas?.ready && window.__atlas.store.data, null, {timeout: 20000});
  await page.waitForTimeout(3500);
  const shot = async (name, setup) => { await page.evaluate(setup); await page.waitForTimeout(2500); await page.screenshot({path: path.join(OUT, name + '.png')}); console.log(name); };
  await shot('follow-reception', () => { window.__atlas.place(0, 12); window.__atlas.camera.setMode('follow', {instant: true}); });
  await shot('third-reception', () => { window.__atlas.player.heading = Math.PI; window.__atlas.camera.setMode('third'); });
  await shot('third-hint-hidden-look-left', () => { window.__atlas.camera.lookBy(-300, 0); window.__atlas.camera.lookBy(-200, -60); });
  await shot('third-corridor-offices', () => { window.__atlas.place(-6, 0); window.__atlas.player.heading = Math.PI * .85; window.__atlas.camera.setMode('follow'); window.__atlas.camera.setMode('third'); });
  await shot('third-wall-behind', () => { window.__atlas.place(14, -8.4); window.__atlas.player.heading = Math.PI; window.__atlas.camera.setMode('follow'); window.__atlas.camera.setMode('third'); });
  await b.close();
} finally {
  const ex = new Promise(r => server.once('exit', r)); server.kill(); await ex;
  try { fs.rmSync(tmp, {recursive: true, force: true}); } catch { /* locked on Windows */ }
}
