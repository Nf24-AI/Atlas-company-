// ATLAS bootstrap: auth gate → world → renderer (Three.js, Canvas2D fallback) → player, camera,
// interactions (range + line of sight) → company store, panels, mini-map, HUD.
import * as Core from './core/game-core.js';
import {buildWorld} from './world/world-data.js';
import {avatarPrimitives} from './world/characters.js';
import {createCanvasRenderer} from './world/renderer-canvas.js';
import {createPlayer, stepPlayer, placePlayer} from './game/player-controller.js';
import {createCamera} from './game/camera-controller.js';
import {createInput} from './game/input.js';
import {api, staticDemo} from './net/api-client.js';
import {ensureSignedIn} from './ui/auth.js';
import {createStore} from './ui/store.js';
import {createPanels} from './ui/panels.js';
import {createMinimap} from './ui/minimap.js';
import {$, esc, toast} from './ui/dom.js';
import {t, L, getLang, setLang} from './ui/i18n.js';
import {STATUS_COLORS} from './ui/status-colors.js';

const world = buildWorld();
const offices = world.interactables;
const canvas = $('world');
const INTERACT_RANGE = 3.2;

async function createRenderer() {
  const forceCanvas = new URLSearchParams(location.search).has('canvas');
  if (!forceCanvas) {
    try {
      const probe = document.createElement('canvas');
      if (probe.getContext('webgl2') || probe.getContext('webgl')) {
        const {createThreeRenderer} = await import('./world/renderer-three.js');
        const r = createThreeRenderer(canvas, world);
        if (r) return r;
      }
    } catch (e) { console.warn('[atlas] 3D renderer unavailable, using compatibility mode', e); }
  }
  return createCanvasRenderer(canvas, world.primitives);
}

function applyStaticI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $('langBtn').textContent = getLang() === 'ar' ? 'EN' : 'ع';
}

async function boot() {
  applyStaticI18n();
  const user = await ensureSignedIn($('authRoot')).catch(e => { $('loading').querySelector('p').textContent = 'تعذر الاتصال بالخادم: ' + e.message; throw e; });
  const renderer = await createRenderer();
  document.body.dataset.renderer = renderer.kind;
  $('loading').hidden = true;

  const store = createStore({onError: e => { if (e.status === 401) location.reload(); }});
  const player = createPlayer(world.spawn);
  let nearby = null;
  let inputKeys = null;
  const panels = createPanels({store, offices, onClose: () => inputKeys?.clear()});
  const camera = createCamera(canvas, {onChange: on => {
    $('orbitBtn').setAttribute('aria-pressed', String(on)); $('orbitIcon').textContent = on ? '✓' : '⟲';
    toast(on ? L('الكاميرا الحرة: اسحب للتدوير، العجلة أو قرصة الإصبعين للتقريب · C للإيقاف', 'Free camera: drag to orbit, wheel/pinch to zoom · C to exit') : L('عادت الكاميرا للمتابعة التلقائية', 'Camera follows again'));
  }});
  inputKeys = createInput({onKey: k => {
    if (k === 'Escape') return panels.close();
    if (panels.isOpen()) return;
    if (k === 'e' && nearby) panels.open(nearby);
    if (k === 'c') camera.setOrbit(!camera.orbit);
  }});

  const travel = role => {
    const tr = offices[role].travel; placePlayer(player, tr.x, tr.z);
    toast(L('انتقلت إلى ', 'Moved to ') + L(offices[role].arabic, offices[role].en) + ' — E');
  };
  const minimap = createMinimap($('minimap'), world, {onTravel: travel});

  $('interactBtn').addEventListener('click', () => nearby && panels.open(nearby));
  $('mobileInteract').addEventListener('click', () => nearby && panels.open(nearby));
  $('viewBtn').addEventListener('click', () => { placePlayer(player, world.spawn.x, world.spawn.z); camera.reset(); });
  $('orbitBtn').addEventListener('click', () => camera.setOrbit(!camera.orbit));
  $('langBtn').addEventListener('click', () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); applyStaticI18n(); renderSidebar(store.data); if (panels.isOpen()) panels.open(panels.current); });
  $('logoutBtn').addEventListener('click', async () => { if (staticDemo()) return; await api('/api/auth/logout', {}).catch(() => {}); location.reload(); });

  $('labels').innerHTML = Object.entries(offices).map(([k]) => `<div class="world-label" id="label-${k}"><b></b><small></small></div>`).join('');

  // ---- derive 3D/HUD state from the API snapshot (real statuses only)
  let npcStates = {};
  function deriveStates(d) {
    const s = {};
    for (const e of d.employees) if (e.kind === 'ai') s[e.roleKey] = {status: e.status, label: e.name, statusText: t('status.' + e.status) + (e.statusDetail ? ' · ' + e.statusDetail : ''), mode: e.mode};
    const tasks = d.tasks, open = tasks.filter(x => !['done', 'rejected'].includes(x.status)).length;
    s.__board = {title: L('العمليات', 'OPERATIONS'), subtitle: `${open} ${L('مهام مفتوحة', 'open tasks')} · ${tasks.filter(x => x.status === 'done').length} ${L('منجزة', 'done')}`, bars: ['proposed', 'todo', 'in_progress', 'in_qa', 'rework', 'awaiting_ceo', 'done'].map(k => Math.min(1, tasks.filter(x => x.status === k).length / 3))};
    const m = d.meetings[0];
    s.__meeting = {title: L('غرفة الاجتماعات', 'MEETING ROOM'), subtitle: m ? m.ceoInput.slice(0, 32) : L('لا اجتماعات', 'no meetings')};
    const pend = d.approvals.filter(a => a.status === 'pending').length;
    s.__ceo = {title: 'CEO', subtitle: pend ? `${pend} ${L('بانتظار موافقتك', 'awaiting you')}` : L('لا شيء معلق', 'all clear'), color: pend ? STATUS_COLORS.awaiting_approval : STATUS_COLORS.available};
    return s;
  }
  function renderSidebar(d) {
    if (!d) return;
    $('companyName').textContent = d.company.name;
    const ai = d.employees.filter(e => e.kind === 'ai'), live = ai.filter(e => e.mode === 'live').length;
    $('modeBadge').textContent = d.staticDemo ? 'STATIC DEMO' : live === ai.length ? 'AI LIVE' : live ? `HYBRID ${live}/${ai.length}` : 'DEMO';
    $('haltBadge').hidden = !d.halted;
    $('sideTitle').textContent = L('فريق الشركة', 'Your team');
    $('modeHelp').textContent = d.staticDemo ? L('نسخة ثابتة: كل الردود والتنفيذ محاكاة مكتوبة مسبقًا. لا خادم ولا ذكاء اصطناعي ولا تنفيذ كود.', 'Static demo: every reply and execution is pre-written simulation. No server, no AI, no code execution.')
      : live ? L('الموظفون الموسومون LIVE يستدعون نماذج حقيقية (بتكلفة). البقية DEMO.', 'LIVE employees call real models (costs apply). Others are DEMO.') : L('وضع DEMO: ردود مكتوبة مسبقًا، لكن أدوات الـsandbox (ملفات، اختبارات، git) تُنفّذ فعليًا.', 'DEMO: pre-written replies, but sandbox tools (files, tests, git) really execute.');
    $('staffList').innerHTML = [...ai.map(e => ({k: e.roleKey, e})), {k: 'ceo'}, {k: 'meeting'}, {k: 'board'}].map(({k, e}) => {
      const o = offices[k];
      return `<button class="staff-card" type="button" data-go="${k}"><span class="staff-avatar" style="background:${e ? STATUS_COLORS[e.status] + '33' : '#ffffff14'}">${esc(o.letter)}</span><span class="staff-copy"><b>${esc(L(o.arabic, o.en))}</b>${e ? `<span style="color:${STATUS_COLORS[e.status]}">● ${esc(t('status.' + e.status))}</span><small>${esc(e.mode === 'live' ? 'LIVE' : 'DEMO')} · ${esc(e.model)}</small>` : ''}</span><span class="chevron">↗</span></button>`;
    }).join('');
    for (const b of $('staffList').querySelectorAll('[data-go]')) b.onclick = () => travel(b.dataset.go);
  }
  store.subscribe(d => { npcStates = deriveStates(d); renderSidebar(d); });
  await store.refresh().catch(e => toast(e.message));
  if (user && !staticDemo()) toast(L('مرحبًا ', 'Welcome ') + user.displayName);

  // ---- frame loop
  let last = performance.now(), lastHud = 0;
  function frame(stamp) {
    const dt = Math.min(.05, (stamp - last) / 1000); last = stamp;
    if (panels.isOpen()) { inputKeys.clear(); player.moving = false; } else stepPlayer(player, inputKeys, camera.view.yaw, dt);
    camera.update(player, dt);
    nearby = Core.nearestInteractable(player, offices, INTERACT_RANGE)?.key ?? null;
    const dynamicPrimitives = renderer.kind === 'three' ? [] : [...world.npcs.flatMap(n => avatarPrimitives(n.x, n.z, n.coat, n.accent)), ...avatarPrimitives(player.x, player.z, '#1d5163', '#344753', player.walkPhase, player.moving)];
    const out = renderer.render({eye: [camera.eye.x, camera.eye.y, camera.eye.z], target: [player.x, 0, player.z], player, npcStates, nearby, time: stamp / 1000, dt, dynamicPrimitives});
    if (stamp - lastHud > 100) { updateHud(out); lastHud = stamp; }
    requestAnimationFrame(frame);
  }
  function updateHud(out) {
    for (const [key, o] of Object.entries(offices)) {
      const p = out.project(o.x, 2.75, o.z), el = $('label-' + key);
      el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
      el.hidden = p[2] === false || p[0] < -50 || p[0] > out.width + 50;
      const st = npcStates[key];
      el.querySelector('b').textContent = L(o.arabic, o.en);
      el.querySelector('small').textContent = st ? t('status.' + st.status) : '';
      el.style.setProperty('--st', st ? STATUS_COLORS[st.status] : '#6fa7a0');
      el.classList.toggle('near', nearby === key);
    }
    minimap.draw(player, npcStates, nearby);
    $('nearbyText').textContent = nearby ? `${t('location')}: ${L(offices[nearby].arabic, offices[nearby].en)}` : t('explore');
    $('interactBtn').disabled = !nearby; $('interactBtn').textContent = nearby ? t('enter') : t('approach');
    $('mobileInteract').hidden = !nearby;
  }

  // Test/debug hook (read-only snapshot + teleport) used by browser tests.
  window.__atlas = {player, get nearby() { return nearby; }, renderer: renderer.kind, travel, place: (x, z) => placePlayer(player, x, z), store, panels, ready: true};
  requestAnimationFrame(frame);
}

boot().catch(e => console.error('[atlas] boot failed', e));
