// Camera (COS-108): close "follow" framing by default, optional high "overview", both sharing one yaw
// so WASD stays screen-relative. Wheel / pinch zoom works in every mode; drag-to-orbit only after
// the CEO opts into the free camera (C). R re-centres to the current mode's framing.
// All changes are eased; limits and presets live in game-core (unit tested).
//
// COS-110A adds an opt-in third-person mode ('third'): a low over-the-shoulder rig with mouse look.
// The mouse is captured only after an explicit click on the scene (pointer lock); Esc releases it.
// Without pointer lock, dragging with the left mouse button also looks around. Its math is in core/third-person.js.
import * as Core from '../core/game-core.js';
import {THIRD_PERSON, LOOK_DEFAULTS, applyMouseLook, thirdPersonPose} from '../core/third-person.js';

const STORE_KEY = 'atlas-camera-v1', LOOK_KEY = 'atlas-look-v1';
// 'third' is deliberately not persisted: a reload always starts in a familiar view, never with a captured mouse.
const loadMode = () => { try { const m = localStorage.getItem(STORE_KEY); return Core.CAMERA_MODES.includes(m) ? m : Core.DEFAULT_CAMERA_MODE; } catch { return Core.DEFAULT_CAMERA_MODE; } };
const saveMode = m => { try { if (Core.CAMERA_MODES.includes(m)) localStorage.setItem(STORE_KEY, m); } catch { /* private mode: not persisted */ } };
export const ALL_CAMERA_MODES = Object.freeze([...Core.CAMERA_MODES, 'third']);

export function loadLookSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    if (v && typeof v === 'object') return {sensitivity: Math.min(3, Math.max(.2, Number(v.sensitivity) || 1)), invertY: v.invertY === true};
  } catch { /* corrupt or blocked storage */ }
  return {...LOOK_DEFAULTS};
}

export function createCamera(canvas, {onChange, onMode, onLock} = {}) {
  let mode = loadMode();
  const view = {...Core.cameraPreset(mode)};
  let target = {...view};
  const eye = {x: 0, y: 0, z: 0}, look = {x: 0, y: 1, z: 0};
  let snapEye = true; // first frame (and instant switches) place the eye without easing
  let orbit = false;
  const pointers = new Map();
  let pinchDist = 0, lastPlayer = null, obstructed = false;
  const look3 = loadLookSettings();
  const third = () => mode === 'third';

  const thirdPreset = () => ({yaw: lastPlayer ? lastPlayer.heading + Math.PI : view.yaw, pitch: THIRD_PERSON.pitch, distance: THIRD_PERSON.distance});
  const preset = () => (third() ? thirdPreset() : {...Core.cameraPreset(mode)});
  const setOrbit = on => { orbit = on && !third(); if (!orbit) target = preset(); document.body.classList.toggle('orbit-on', orbit); onChange?.(orbit); };
  const reset = () => { target = preset(); };
  const locked = () => document.pointerLockElement === canvas;
  const release = () => { if (locked()) document.exitPointerLock?.(); };
  const setMode = (m, {instant = false} = {}) => {
    if (!ALL_CAMERA_MODES.includes(m)) return;
    if (m === 'third' && orbit) { orbit = false; document.body.classList.remove('orbit-on'); onChange?.(false); }
    mode = m; saveMode(m); target = preset();
    if (m !== 'third') release();
    if (instant || m === 'third') { Object.assign(view, target); snapEye = true; }
    document.body.dataset.camera = m;
    onMode?.(m);
  };
  document.body.dataset.camera = mode;

  // ---- third-person: pointer lock on an explicit click; mouse movement turns the view
  const mouseLook = (dx, dy) => { const n = applyMouseLook(view, dx, dy, look3); view.yaw = n.yaw; view.pitch = n.pitch; target = {...target, yaw: n.yaw, pitch: n.pitch}; };
  canvas.addEventListener('click', () => { if (third() && !locked()) canvas.requestPointerLock?.()?.catch?.(() => {}); });
  document.addEventListener('pointerlockchange', () => onLock?.(locked()));
  document.addEventListener('mousemove', e => { if (third() && locked()) mouseLook(e.movementX, e.movementY); });

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Touch pinch zoom works in every mode; one-finger / mouse drag orbits in free-camera mode, and looks
    // around in third-person mode when the pointer is not locked (e.g. pointer lock unavailable).
    if (!orbit && !third() && e.pointerType === 'mouse') return;
    if (third() && locked()) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    canvas.setPointerCapture?.(e.pointerId); if (orbit || third()) canvas.classList.add('dragging');
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = {x: e.clientX, y: e.clientY};
    pointers.set(e.pointerId, cur);
    if (pointers.size >= 2) { // pinch zoom on touch screens
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && d > 0) target = third() ? zoom3(target.distance * pinchDist / d) : Core.applyPinch(target, d / pinchDist);
      pinchDist = d;
    } else if (third()) mouseLook(cur.x - prev.x, cur.y - prev.y);
    else if (orbit) target = Core.applyDrag(target, cur.x - prev.x, cur.y - prev.y);
  });
  const end = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (!pointers.size) canvas.classList.remove('dragging'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, end);
  const zoom3 = d => ({...target, distance: Math.min(THIRD_PERSON.maxDistance, Math.max(THIRD_PERSON.minDistance, d))});
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    target = third() ? zoom3(target.distance * (1 + Math.max(-.15, Math.min(.15, delta * .0015)))) : Core.applyZoom(target, delta);
  }, {passive: false});

  return {
    view, eye, look,
    get orbit() { return orbit; },
    get mode() { return mode; },
    get target() { return {...target}; },
    get locked() { return locked(); },
    get obstructed() { return obstructed; },
    get lookSettings() { return {...look3}; },
    setLookSettings(v) {
      if ('sensitivity' in v) look3.sensitivity = Math.min(3, Math.max(.2, Number(v.sensitivity) || 1));
      if ('invertY' in v) look3.invertY = v.invertY === true;
      try { localStorage.setItem(LOOK_KEY, JSON.stringify(look3)); } catch { /* not persisted */ }
    },
    /** Test / accessibility hook: apply a mouse-look delta in pixels (same path as real mouse movement). */
    lookBy(dx, dy) { if (third()) mouseLook(dx, dy); },
    release, setOrbit, reset, setMode,
    toggleMode() { setMode(mode === 'overview' ? 'follow' : 'overview'); return mode; }, // V: from third-person goes to the overview
    /** Ease view toward target and follow the player. */
    update(player, dt) {
      lastPlayer = player;
      const ease = Core.damp(third() ? 14 : 6, dt);
      view.yaw += Core.angleDelta(view.yaw, target.yaw) * ease;
      view.pitch += (target.pitch - view.pitch) * ease;
      view.distance += (target.distance - view.distance) * ease;
      if (third()) {
        const pose = thirdPersonPose(player, view);
        obstructed = pose.obstructed;
        // Pull in fast when a wall gets in the way (never show the inside of a wall), ease back out slowly.
        const k = snapEye ? 1 : Core.damp(pose.obstructed ? 30 : 12, dt);
        snapEye = false;
        eye.x += (pose.eye.x - eye.x) * k; eye.y += (pose.eye.y - eye.y) * k; eye.z += (pose.eye.z - eye.z) * k;
        look.x = pose.target.x; look.y = pose.target.y; look.z = pose.target.z;
        return;
      }
      obstructed = false;
      const off = Core.cameraOffset(view), follow = snapEye ? 1 : Core.damp(mode === 'follow' ? 5 : 3, dt);
      snapEye = false;
      eye.x += (player.x + off.x - eye.x) * follow; eye.y += (off.y - eye.y) * follow; eye.z += (player.z + off.z - eye.z) * follow;
      look.x = player.x; look.y = 1; look.z = player.z;
    },
  };
}
