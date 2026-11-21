// Builds the static, offline GitHub Pages demo from the SAME frontend sources as the local app.
// The only difference is a <meta name="atlas-mode" content="static-demo"> tag that makes the
// API client use the in-browser DEMO backend (scripted replies, localStorage). No server code,
// secrets or AI providers are included.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));

// Copy only browser assets. Anything resembling secrets/config is refused outright.
const FORBIDDEN = /(^|[\\/])(\.env.*|.*\.sqlite.*|state\.json)$/i;
fs.rmSync(OUT, {recursive: true, force: true});
fs.cpSync(SRC, OUT, {recursive: true, filter: src => !FORBIDDEN.test(src)});
// Three.js (MIT) is served from node_modules by the local server; the static build needs a copy.
const threeBuild = path.join(ROOT, 'node_modules', 'three', 'build');
fs.mkdirSync(path.join(OUT, 'vendor'), {recursive: true});
for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(threeBuild, f), path.join(OUT, 'vendor', f));
fs.copyFileSync(path.join(ROOT, 'node_modules', 'three', 'LICENSE'), path.join(OUT, 'vendor', 'THREE-LICENSE.txt'));

const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('name="atlas-mode"')) {
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="atlas-mode" content="static-demo">');
}
fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Static DEMO built at ${path.relative(ROOT, OUT) || OUT}`);
