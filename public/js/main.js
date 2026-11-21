// ATLAS bootstrap: wires world, renderer, player, camera, interactions and company UI.
import * as Core from './core/game-core.js';
import {projectToScreen} from './core/math3d.js';
import {buildWorld, NPCS} from './world/world-data.js';
import {avatarPrimitives} from './world/characters.js';
import {createWebGLRenderer} from './world/renderer-webgl.js';
import {createCanvasRenderer} from './world/renderer-canvas.js';
import {createPlayer, stepPlayer, placePlayer} from './game/player-controller.js';
import {createCamera} from './game/camera-controller.js';
import {createInput} from './game/input.js';
import {createCompanyUI} from './ui/company-ui.js';

const $ = id => document.getElementById(id);
const world = buildWorld();
const offices = world.interactables;
const canvas = $('world');

let renderer = null;
try { renderer = createWebGLRenderer(canvas, world.primitives); } catch (e) { console.warn('[atlas] WebGL init failed', e); }
if (!renderer) {
  renderer = createCanvasRenderer(canvas, world.primitives);
  $('sceneTitle').innerHTML = '<div class="eyebrow">COMPATIBILITY MODE</div><h2>مقر الشركة التفاعلي</h2><p>عرض إيزومتري بديل للأجهزة دون WebGL</p>';
}
document.body.dataset.renderer = renderer.kind;

const player = createPlayer(world.spawn);
const camera = createCamera(canvas, {onChange: on => {
  $('orbitBtn').setAttribute('aria-pressed', String(on)); $('orbitIcon').textContent = on ? '✓' : '⟲';
  ui.toast(on ? 'الكاميرا الحرة مفعلة: اسحب للتدوير، عجلة الفأرة أو قرصة الإصبعين للتقريب · C للإيقاف' : 'عادت الكاميرا إلى المتابعة التلقائية');
}});
let nearby = null;
const ui = createCompanyUI({offices, onOpen: () => keys.clear(), onClose: () => keys.clear()});
const keys = createInput({onKey: k => {
  if (k === 'Escape') return ui.close();
  if (ui.isOpen()) return;
  if (k === 'e' && nearby) ui.open(nearby);
  if (k === 'c') camera.setOrbit(!camera.orbit);
}});

function travel(role) {
  const t = offices[role].travel; placePlayer(player, t.x, t.z);
  ui.toast('تم الانتقال إلى ' + offices[role].arabic + ' — اضغط E أو زر الدخول');
}
for (const b of document.querySelectorAll('[data-go]')) {
  b.addEventListener('click', () => travel(b.dataset.go));
  b.addEventListener('keydown', e => { if (e.key === 'Enter') travel(b.dataset.go); });
}
$('interactBtn').addEventListener('click', () => nearby && ui.open(nearby));
$('viewBtn').addEventListener('click', () => { placePlayer(player, world.spawn.x, world.spawn.z); camera.reset(); ui.toast('تمت إعادة التمركز'); });
$('orbitBtn').addEventListener('click', () => camera.setOrbit(!camera.orbit));

$('labels').innerHTML = Object.entries(offices).map(([k, v]) => `<div class="world-label" id="label-${k}"><b>${v.label}</b><small>${v.arabic}</small></div>`).join('');

let last = performance.now(), lastHud = 0;
function frame(stamp) {
  const dt = Math.min(.05, (stamp - last) / 1000); last = stamp;
  if (ui.isOpen()) { keys.clear(); player.moving = false; } else stepPlayer(player, keys, camera.view.yaw, dt);
  camera.update(player, dt);
  const dynamicPrimitives = [
    ...NPCS.flatMap(n => avatarPrimitives(n.x, n.z, n.coat, n.accent)),
    ...avatarPrimitives(player.x, player.z, '#1d5163', '#344753', player.walkPhase, player.moving),
  ];
  const out = renderer.render({eye: [camera.eye.x, camera.eye.y, camera.eye.z], target: [player.x, 0, player.z], dynamicPrimitives});
  nearby = Core.nearestInteractable(player, offices)?.key ?? null;
  if (stamp - lastHud > 100) { updateHud(out); lastHud = stamp; }
  requestAnimationFrame(frame);
}
function updateHud(out) {
  for (const [key, o] of Object.entries(offices)) {
    const p = out.matrix ? projectToScreen([o.x, 2.6, o.z], out.matrix, out.width, out.height) : out.project(o.x, 2.55, o.z);
    const el = $('label-' + key); el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; el.classList.toggle('near', nearby === key);
  }
  const mapX = 50 + (player.x / 35) * 100, mapY = 50 + (player.z / 26) * 100;
  $('mapPlayer').style.left = Math.min(96, Math.max(3, mapX)) + '%'; $('mapPlayer').style.top = Math.min(94, Math.max(3, mapY)) + '%';
  $('nearbyText').textContent = nearby ? 'الموقع: ' + offices[nearby].arabic : 'تجوّل واقترب من أحد الموظفين';
  $('interactBtn').disabled = !nearby; $('interactBtn').textContent = nearby ? 'الدخول · E' : 'اقترب من أحد المكاتب';
}

// Test/debug hook (read-only snapshot + teleport), used by browser smoke tests.
window.__atlas = {player, get nearby() { return nearby; }, renderer: renderer.kind, travel, place: (x, z) => placePlayer(player, x, z)};
ui.refresh();
requestAnimationFrame(frame);
