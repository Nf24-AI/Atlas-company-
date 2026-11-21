// Camera (COS-108): close "follow" framing by default, optional high "overview", both sharing one yaw
// so WASD stays screen-relative. Wheel / pinch zoom works in every mode; drag-to-orbit only after
// the CEO opts into the free camera (C). R re-centres to the current mode's framing.
// All changes are eased; limits and presets live in game-core (unit tested).
import * as Core from '../core/game-core.js';

const STORE_KEY = 'atlas-camera-v1';
const loadMode = () => { try { const m = localStorage.getItem(STORE_KEY); return Core.CAMERA_MODES.includes(m) ? m : Core.DEFAULT_CAMERA_MODE; } catch { return Core.DEFAULT_CAMERA_MODE; } };
const saveMode = m => { try { localStorage.setItem(STORE_KEY, m); } catch { /* private mode: not persisted */ } };

export function createCamera(canvas, {onChange, onMode} = {}) {
  let mode = loadMode();
  const view = {...Core.cameraPreset(mode)};
  let target = {...view};
  const eye = {x: 0, y: 0, z: 0};
  let snapEye = true; // first frame (and instant switches) place the eye without easing
  let orbit = false;
  const pointers = new Map();
  let pinchDist = 0;

  const preset = () => ({...Core.cameraPreset(mode)});
  const setOrbit = on => { orbit = on; if (!on) target = preset(); document.body.classList.toggle('orbit-on', on); onChange?.(on); };
  const reset = () => { target = preset(); };
  const setMode = (m, {instant = false} = {}) => {
    if (!Core.CAMERA_MODES.includes(m)) return;
    mode = m; saveMode(m); target = preset();
    if (instant) { Object.assign(view, target); snapEye = true; }
    document.body.dataset.camera = m;
    onMode?.(m);
  };
  document.body.dataset.camera = mode;

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Touch pinch zoom works in every mode; one-finger / mouse drag only orbits in free-camera mode.
    if (!orbit && e.pointerType === 'mouse') return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    canvas.setPointerCapture?.(e.pointerId); if (orbit) canvas.classList.add('dragging');
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = {x: e.clientX, y: e.clientY};
    pointers.set(e.pointerId, cur);
    if (pointers.size >= 2) { // pinch zoom on touch screens
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && d > 0) target = Core.applyPinch(target, d / pinchDist);
      pinchDist = d;
    } else if (orbit) target = Core.applyDrag(target, cur.x - prev.x, cur.y - prev.y);
  });
  const end = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (!pointers.size) canvas.classList.remove('dragging'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); target = Core.applyZoom(target, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY); }, {passive: false});

  return {
    view, eye,
    get orbit() { return orbit; },
    get mode() { return mode; },
    get target() { return {...target}; },
    setOrbit, reset, setMode,
    toggleMode() { setMode(mode === 'follow' ? 'overview' : 'follow'); return mode; },
    /** Ease view toward target and follow the player. */
    update(player, dt) {
      const ease = Core.damp(6, dt);
      view.yaw += Core.angleDelta(view.yaw, target.yaw) * ease;
      view.pitch += (target.pitch - view.pitch) * ease;
      view.distance += (target.distance - view.distance) * ease;
      const off = Core.cameraOffset(view), follow = snapEye ? 1 : Core.damp(mode === 'follow' ? 5 : 3, dt);
      snapEye = false;
      eye.x += (player.x + off.x - eye.x) * follow; eye.y += (off.y - eye.y) * follow; eye.z += (player.z + off.z - eye.z) * follow;
    },
  };
}
