// ATLAS bootstrap: auth gate → world → renderer (Three.js, Canvas2D fallback) → player, camera,
// interactions (range + line of sight) → company store, panels, mini-map, HUD.
// COS-108: follow/overview camera modes (V, R), collapsible HUD (T, M), room entry cues and
// status-driven employee presence (presence.js) — all state comes from the API store.
import * as Core from './core/game-core.js';
import {buildWorld, roomAt} from './world/world-data.js';
import {avatarPrimitives} from './world/characters.js';
import {createCanvasRenderer} from './world/renderer-canvas.js';
import {presenceFor} from './world/presence.js';
import {createPlayer, stepPlayer, placePlayer} from './game/player-controller.js';
import {createCamera} from './game/camera-controller.js';
import {createInput} from './game/input.js';
import {api, staticDemo} from './net/api-client.js';
import {ensureSignedIn} from './ui/auth.js';
import {createStore} from './ui/store.js';
import {createPanels} from './ui/panels.js';
import {createMinimap} from './ui/minimap.js';
import {createHud} from './ui/hud.js';
import {$, esc, toast} from './ui/dom.js';
import {t, L, getLang, setLang} from './ui/i18n.js';
import {STATUS_COLORS} from './ui/status-colors.js';

const world = buildWorld();
const offices = world.interactables;
const canvas = $('world');
const INTERACT_RANGE = 3.2;
const LABEL_RADIUS_FOLLOW = 13; // in the close view only nearby office labels float over the scene
const PLAYER_HEIGHT = 2.0;

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
  return createCanvasRenderer(canvas, world.primitives, {signs: world.signs});
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
  let nearby = null, room = roomAt(player.x, player.z)?.id ?? null, lastOut = null;
  let inputKeys = null;
  const panels = createPanels({store, offices, onClose: () => inputKeys?.clear()});
  const hud = createHud({onToggle: k => { if (k === 'map') minimap?.resize(); }});

  const updateCamButton = mode => {
    const over = mode === 'overview';
    $('camModeBtn').setAttribute('aria-pressed', String(over));
    $('camModeIcon').textContent = over ? '◉' : '◱';
    $('camModeLabel').textContent = t(over ? 'follow' : 'overview');
    $('camModeBtn').title = `V · ${t(over ? 'follow' : 'overview')}`;
  };
  const camera = createCamera(canvas, {
    onChange: on => {
      $('orbitBtn').setAttribute('aria-pressed', String(on)); $('orbitIcon').textContent = on ? '✓' : '⟲';
      toast(on ? L('الكاميرا الحرة: اسحب للتدوير، العجلة أو قرصة الإصبعين للتقريب · C للإيقاف', 'Free camera: drag to orbit, wheel/pinch to zoom · C to exit') : L('عادت الكاميرا للمتابعة التلقائية', 'Camera follows again'));
    },
    onMode: updateCamButton,
  });
  updateCamButton(camera.mode);
  const toggleView = () => { const m = camera.toggleMode(); toast(m === 'overview' ? L('عرض علوي للطابق · V للعودة للمتابعة القريبة', 'Overview of the floor · V to return to the close view') : L('متابعة قريبة · V للعرض العلوي', 'Close follow view · V for the overview')); };
  const recenter = () => { camera.reset(); toast(L('أُعيد ضبط الكاميرا خلفك', 'Camera re-centred behind you')); };

  inputKeys = createInput({onKey: k => {
    if (k === 'Escape') return panels.close();
    if (panels.isOpen()) return;
    if (k === 'e' && nearby) panels.open(nearby);
    else if (k === 'c') camera.setOrbit(!camera.orbit);
    else if (k === 'v') toggleView();
    else if (k === 'r') recenter();
    else if (k === 't') hud.toggle('team');
    else if (k === 'm') hud.toggle('map');
  }});

  const travel = r => {
    const tr = offices[r].travel; placePlayer(player, tr.x, tr.z);
    toast(L('انتقلت إلى ', 'Moved to ') + L(offices[r].arabic, offices[r].en) + ' — E');
  };
  const minimap = createMinimap($('minimap'), world, {onTravel: travel});

  $('interactBtn').addEventListener('click', () => nearby && panels.open(nearby));
  $('mobileInteract').addEventListener('click', () => nearby && panels.open(nearby));
  $('viewBtn').addEventListener('click', recenter);
  $('camModeBtn').addEventListener('click', toggleView);
  $('orbitBtn').addEventListener('click', () => camera.setOrbit(!camera.orbit));
  $('langBtn').addEventListener('click', () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); applyStaticI18n(); updateCamButton(camera.mode); renderSidebar(store.data); showRoom(room, false); if (panels.isOpen()) panels.open(panels.current); });
  $('logoutBtn').addEventListener('click', async () => { if (staticDemo()) return; await api('/api/auth/logout', {}).catch(() => {}); location.reload(); });

  $('labels').innerHTML = Object.entries(offices).map(([k]) => `<div class="world-label" id="label-${k}"><b></b><small></small></div>`).join('');

  // ---- derive 3D/HUD state from the API snapshot (real statuses only)
  let npcStates = {}, simulated = false;
  function deriveStates(d) {
    const s = {};
    for (const e of d.employees) if (e.kind === 'ai') s[e.roleKey] = {status: presenceFor(e.status).status, label: e.name, statusText: t('status.' + presenceFor(e.status).status) + (e.statusDetail ? ' · ' + e.statusDetail : ''), mode: e.mode};
    const tasks = d.tasks, open = tasks.filter(x => !['done', 'rejected'].includes(x.status)).length;
    s.__board = {title: L('العمليات', 'OPERATIONS'), subtitle: `${open} ${L('مهام مفتوحة', 'open tasks')} · ${tasks.filter(x => x.status === 'done').length} ${L('منجزة', 'done')}`, bars: ['proposed', 'todo', 'in_progress', 'in_qa', 'rework', 'awaiting_ceo', 'done'].map(k => Math.min(1, tasks.filter(x => x.status === k).length / 3))};
    const m = d.meetings[0], inMeeting = d.employees.filter(e => e.kind === 'ai' && e.status === 'in_meeting').map(e => e.name);
    s.__meeting = {title: L('غرفة الاجتماعات', 'MEETING ROOM'), subtitle: inMeeting.length ? `${L('الآن: ', 'Now: ')}${inMeeting.join('، ')}` : m ? m.ceoInput.slice(0, 32) : L('لا اجتماعات', 'no meetings'), color: inMeeting.length ? STATUS_COLORS.in_meeting : undefined};
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
      const o = offices[k], st = e && presenceFor(e.status).status;
      return `<button class="staff-card" type="button" data-go="${k}"><span class="staff-avatar" style="background:${e ? STATUS_COLORS[st] + '33' : '#ffffff14'}">${esc(o.letter)}</span><span class="staff-copy"><b>${esc(L(o.arabic, o.en))}</b>${e ? `<span style="color:${STATUS_COLORS[st]}">● ${esc(t('status.' + st))}</span><small>${esc(e.mode === 'live' ? 'LIVE' : 'DEMO')} · ${esc(e.model)}</small>` : ''}</span><span class="chevron">↗</span></button>`;
    }).join('');
    for (const b of $('staffList').querySelectorAll('[data-go]')) b.onclick = () => travel(b.dataset.go);
    hud.summarize(ai.map(e => { const st = presenceFor(e.status).status; return {status: st, color: STATUS_COLORS[st], title: esc(L(offices[e.roleKey]?.arabic, offices[e.roleKey]?.en) + ': ' + t('status.' + st))}; }),
      d.approvals.filter(a => a.status === 'pending').length);
  }
  store.subscribe(d => { simulated = Boolean(d.staticDemo); npcStates = deriveStates(d); renderSidebar(d); });
  await store.refresh().catch(e => toast(e.message));
  if (user && !staticDemo()) toast(L('مرحبًا ', 'Welcome ') + user.displayName);

  // ---- room entry / exit cue (location chip + short banner)
  let bannerTimer = 0;
  function showRoom(id, banner = true) {
    const r = world.rooms.find(x => x.id === id);
    $('roomChip').textContent = r ? L(r.ar, r.en) : L('الممر', 'Corridor');
    if (!banner || !r) return;
    const el = $('roomBanner'); el.textContent = L(r.ar, r.en); el.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }
  showRoom(room, false);

  // ---- frame loop
  let last = performance.now(), lastHud = 0;
  function frame(stamp) {
    const dt = Math.min(.05, (stamp - last) / 1000); last = stamp;
    if (panels.isOpen()) { inputKeys.clear(); player.moving = false; } else stepPlayer(player, inputKeys, camera.view.yaw, dt);
    camera.update(player, dt);
    nearby = Core.nearestInteractable(player, offices, INTERACT_RANGE)?.key ?? null;
    const nowRoom = roomAt(player.x, player.z)?.id ?? null;
    if (nowRoom !== room) { room = nowRoom; showRoom(room); }
    const dynamicPrimitives = renderer.kind === 'three' ? [] : [
      ...world.npcs.flatMap(n => [{shape: 'cyl', x: n.x, y: .02, z: n.z, r: .62, h: .02, color: STATUS_COLORS[presenceFor(npcStates[n.id]?.status).status]}, ...avatarPrimitives(n.x, n.z, n.coat, n.accent)]),
      ...avatarPrimitives(player.x, player.z, '#1d5163', '#344753', player.walkPhase, player.moving)];
    lastOut = renderer.render({eye: [camera.eye.x, camera.eye.y, camera.eye.z], target: [player.x, 0, player.z], player, npcStates, nearby, time: stamp / 1000, dt, dynamicPrimitives});
    if (stamp - lastHud > 100) { updateHud(lastOut); lastHud = stamp; }
    requestAnimationFrame(frame);
  }
  function updateHud(out) {
    const follow = camera.mode === 'follow' && renderer.kind === 'three';
    for (const [key, o] of Object.entries(offices)) {
      const p = out.project(o.x, 2.75, o.z), el = $('label-' + key);
      el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
      const far = follow && Math.hypot(player.x - o.x, player.z - o.z) > LABEL_RADIUS_FOLLOW;
      el.hidden = far || p[2] === false || p[0] < -50 || p[0] > out.width + 50;
      const st = npcStates[key];
      el.querySelector('b').textContent = L(o.arabic, o.en);
      el.querySelector('small').textContent = st ? t('status.' + st.status) + (simulated ? ' · ' + L('محاكاة', 'simulated') : '') : '';
      el.style.setProperty('--st', st ? STATUS_COLORS[st.status] : '#6fa7a0');
      el.classList.toggle('near', nearby === key);
      el.classList.toggle('attention', Boolean(st && presenceFor(st.status).attention));
    }
    if (hud.state.map) minimap.draw(player, npcStates, nearby);
    $('nearbyText').textContent = nearby ? `${t('location')}: ${L(offices[nearby].arabic, offices[nearby].en)}` : t('explore');
    $('interactBtn').disabled = !nearby; $('interactBtn').textContent = nearby ? t('enter') : t('approach');
    $('mobileInteract').hidden = !nearby;
  }

  // Test/debug hook (read-only snapshots + teleport/camera helpers) used by browser tests and evidence capture.
  window.__atlas = {
    player, get nearby() { return nearby; }, get room() { return room; }, renderer: renderer.kind, travel, place: (x, z) => placePlayer(player, x, z), store, panels, hud,
    camera: {get mode() { return camera.mode; }, get orbit() { return camera.orbit; }, get view() { return {...camera.view}; }, get target() { return camera.target; }, setMode: camera.setMode, toggleMode: camera.toggleMode, reset: camera.reset},
    /** Poses the renderer applied on the last frame (derived from the store, see presence.js). */
    presence: () => ({...(lastOut?.poses || {})}),
    /** Player's on-screen height in CSS px from the renderer's own projection. */
    measure: () => {
      if (!lastOut) return null;
      const feet = lastOut.project(player.x, 0, player.z), head = lastOut.project(player.x, PLAYER_HEIGHT, player.z);
      return {playerPx: feet[1] - head[1], feet: [feet[0], feet[1]], head: [head[0], head[1]], width: lastOut.width, height: lastOut.height};
    },
    ready: true,
  };
  requestAnimationFrame(frame);
}

boot().catch(e => console.error('[atlas] boot failed', e));
