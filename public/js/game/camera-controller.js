// Camera: easy isometric follow by default; orbit (drag), zoom (wheel) and pinch-zoom only after
// the CEO opts in. All changes are eased; limits live in game-core (tested).
import * as Core from '../core/game-core.js';

export function createCamera(canvas, {onChange} = {}) {
  const view = {...Core.DEFAULT_CAMERA};
  let target = {...Core.DEFAULT_CAMERA};
  const eye = {x: 10, y: 17, z: 24};
  let orbit = false;
  const pointers = new Map();
  let pinchDist = 0;

  const setOrbit = on => { orbit = on; if (!on) target = {...Core.DEFAULT_CAMERA}; document.body.classList.toggle('orbit-on', on); onChange?.(on); };
  const reset = () => { target = {...Core.DEFAULT_CAMERA}; };

  canvas.addEventListener('pointerdown', e => {
    if (!orbit || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging');
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
    } else target = Core.applyDrag(target, cur.x - prev.x, cur.y - prev.y);
  });
  const end = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; if (!pointers.size) canvas.classList.remove('dragging'); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, end);
  canvas.addEventListener('wheel', e => { if (!orbit) return; e.preventDefault(); target = Core.applyZoom(target, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY); }, {passive: false});

  return {
    view, eye,
    get orbit() { return orbit; },
    setOrbit, reset,
    /** Ease view toward target and follow the player. */
    update(player, dt) {
      const ease = Core.damp(6, dt);
      view.yaw += Core.angleDelta(view.yaw, target.yaw) * ease;
      view.pitch += (target.pitch - view.pitch) * ease;
      view.distance += (target.distance - view.distance) * ease;
      const off = Core.cameraOffset(view), follow = Core.damp(3, dt);
      eye.x += (player.x + off.x - eye.x) * follow; eye.y += (off.y - eye.y) * follow; eye.z += (player.z + off.z - eye.z) * follow;
    },
  };
}
