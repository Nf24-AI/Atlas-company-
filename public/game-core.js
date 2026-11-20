// ATLAS game core — pure movement, collision and camera math (COS-101).
// No DOM or WebGL access here, so Node's test runner can import it directly.
// The browser loads it as a module and exposes it as window.AtlasCore for app.js / fallback.js.

export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 5.2;

// Walkable area. Same limits the prototype used for its clamp (inside the outer walls).
export const BOUNDS = Object.freeze({minX: -15, maxX: 15, minZ: -11, maxZ: 11});

// Axis-aligned obstacles on the floor plan, as centre (x, z) and full size (w, d).
// Values mirror the geometry drawn in emitScene() in app.js; keep them in sync when moving furniture.
const box = (id, x, z, w, d) => Object.freeze({id, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2});
export const OBSTACLES = Object.freeze([
  // Side partitions of both offices (z -4.9 .. 3.1). Behind them the floor is open to Operations.
  box('mgr-wall-west', -16, -0.9, 0.2, 8), box('mgr-wall-east', -0.85, -0.9, 0.2, 8),
  box('dir-wall-west', 0.85, -0.9, 0.2, 8), box('dir-wall-east', 16, -0.9, 0.2, 8),
  // Front partitions (z = 2.8). Gaps at x ±(6.1..8) and ±(0.85..3.1) are the walkable doors.
  box('mgr-front-a', -11.9, 2.8, 7.8, 0.13), box('mgr-front-b', -4.6, 2.8, 3.0, 0.13),
  box('dir-front-a', 4.6, 2.8, 3.0, 0.13), box('dir-front-b', 11.9, 2.8, 7.8, 0.13),
  // Manager office
  box('mgr-desk', -10.3, -5.4, 2.65, 1.16), box('mgr-chair', -10.3, -4.06, 0.8, 0.84),
  box('mgr-cabinet', -12.8, -8.3, 1.65, 0.6), box('mgr-avatar', -10, -3.25, 0.82, 0.6),
  box('mgr-plant', -14, -2.0, 0.9, 0.9), box('mgr-plant-back', -4, -9.2, 0.7, 0.7),
  // Director office
  box('dir-desk', 10, -5.4, 2.65, 1.16), box('dir-chair', 10, -4.06, 0.8, 0.84),
  box('dir-shelf', 13.9, -8.2, 0.7, 3.2), box('dir-avatar', 10, -3.25, 0.82, 0.6),
  box('dir-plant', 14.5, -2.2, 0.9, 0.9), box('dir-plant-back', 5.2, -9.5, 0.8, 0.8),
  // Operations benches
  box('ops-bench-west', -2.5, -6.9, 1.4, 0.9), box('ops-bench-east', 2.5, -6.9, 1.4, 0.9),
  // Lobby plants
  box('lobby-plant-west', -4.5, 7.8, 1.1, 1.1), box('lobby-plant-east', 4.5, 7.8, 1.1, 1.1),
]);

const overlaps = (x, z, r, o) => x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Obstacles a player footprint (square of half-size r) at (x, z) touches. */
export function collisions(x, z, r = PLAYER_RADIUS, obstacles = OBSTACLES) {
  return obstacles.filter(o => overlaps(x, z, r, o));
}

/** True when the footprint is inside the bounds and touches no obstacle. */
export function isWalkable(x, z, r = PLAYER_RADIUS, obstacles = OBSTACLES, bounds = BOUNDS) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ && collisions(x, z, r, obstacles).length === 0;
}

/**
 * Move from (x, z) by (dx, dz) with axis-separated collision response, so the player
 * slides along walls instead of sticking. Long steps are split so thin walls can't be tunnelled.
 */
export function moveWithCollisions(x, z, dx, dz, r = PLAYER_RADIUS, obstacles = OBSTACLES, bounds = BOUNDS) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.5)));
  let px = x, pz = z;
  for (let i = 0; i < steps; i++) {
    px = clamp(px + dx / steps, bounds.minX, bounds.maxX);
    for (const o of obstacles) if (overlaps(px, pz, r, o)) px = dx > 0 ? o.minX - r : o.maxX + r;
    pz = clamp(pz + dz / steps, bounds.minZ, bounds.maxZ);
    for (const o of obstacles) if (overlaps(px, pz, r, o)) pz = dz > 0 ? o.minZ - r : o.maxZ + r;
  }
  return {x: px, z: pz};
}

/**
 * Nearest walkable spot to (x, z). Used after teleports (mini-map, recentre) so the
 * player can never be placed inside furniture. Searches outward on a small grid.
 */
export function resolvePosition(x, z, r = PLAYER_RADIUS, obstacles = OBSTACLES, bounds = BOUNDS) {
  const cx = clamp(x, bounds.minX, bounds.maxX), cz = clamp(z, bounds.minZ, bounds.maxZ);
  if (isWalkable(cx, cz, r, obstacles, bounds)) return {x: cx, z: cz};
  const step = 0.1;
  for (let ring = 1; ring <= 60; ring++) {
    let best = null;
    for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
      const px = cx + i * step, pz = cz + j * step;
      const d = Math.hypot(px - cx, pz - cz);
      if ((!best || d < best.d) && isWalkable(px, pz, r, obstacles, bounds)) best = {x: px, z: pz, d};
    }
    if (best) return {x: best.x, z: best.z};
  }
  return {x: cx, z: cz};
}

/** Keyboard/button state → unit input vector in screen terms (x right, z down). */
export function inputVector(keys) {
  const has = k => keys.has(k);
  const dx = (has('d') || has('ArrowRight') ? 1 : 0) - (has('a') || has('ArrowLeft') ? 1 : 0);
  const dz = (has('s') || has('ArrowDown') ? 1 : 0) - (has('w') || has('ArrowUp') ? 1 : 0);
  const l = Math.hypot(dx, dz);
  return l ? {x: dx / l, z: dz / l} : {x: 0, z: 0};
}

// ---- Camera -------------------------------------------------------------------
// Default framing reproduces the original follow offset (+11, 16, +17) from the player.
const DEFAULT_OFFSET = {x: 11, y: 16, z: 17};
export const CAMERA_LIMITS = Object.freeze({
  minPitch: 25 * Math.PI / 180, maxPitch: 65 * Math.PI / 180, // never top-down flips or ground-level views
  minDistance: 12, maxDistance: 38,
  rotateSpeed: 0.005, // radians per dragged pixel — deliberately slow to avoid motion sickness
  zoomSpeed: 0.0015,  // fraction of distance per wheel delta unit
  maxWheelStep: 0.15, // cap per wheel event so trackpads can't lurch the view
});
export const DEFAULT_CAMERA = Object.freeze({
  yaw: Math.atan2(DEFAULT_OFFSET.x, DEFAULT_OFFSET.z),
  pitch: Math.atan2(DEFAULT_OFFSET.y, Math.hypot(DEFAULT_OFFSET.x, DEFAULT_OFFSET.z)),
  distance: Math.hypot(DEFAULT_OFFSET.x, DEFAULT_OFFSET.y, DEFAULT_OFFSET.z),
});

/** Camera position relative to the player for an orbit state. */
export function cameraOffset({yaw, pitch, distance}) {
  const h = Math.cos(pitch) * distance;
  return {x: Math.sin(yaw) * h, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * h};
}

export function clampCamera(cam, limits = CAMERA_LIMITS) {
  return {yaw: cam.yaw, pitch: clamp(cam.pitch, limits.minPitch, limits.maxPitch), distance: clamp(cam.distance, limits.minDistance, limits.maxDistance)};
}

/** Mouse/touch drag in pixels → new orbit state. Dragging right turns the view right. */
export function applyDrag(cam, dxPixels, dyPixels, limits = CAMERA_LIMITS) {
  return clampCamera({...cam, yaw: cam.yaw - dxPixels * limits.rotateSpeed, pitch: cam.pitch + dyPixels * limits.rotateSpeed}, limits);
}

/** Wheel delta → new orbit state. Positive delta (scroll down) zooms out. */
export function applyZoom(cam, wheelDelta, limits = CAMERA_LIMITS) {
  const step = clamp(wheelDelta * limits.zoomSpeed, -limits.maxWheelStep, limits.maxWheelStep);
  return clampCamera({...cam, distance: cam.distance * (1 + step)}, limits);
}

/** Frame-rate independent smoothing factor for exponential follow. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Shortest signed angle from a to b, so yaw smoothing never spins the long way round. */
export function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Screen-relative input → world movement direction for the current camera yaw.
 * At the default yaw this is the identity, so the classic controls are unchanged;
 * after orbiting, W still walks "up the screen".
 */
export function worldDirection(input, yaw, baseYaw = DEFAULT_CAMERA.yaw) {
  const a = yaw - baseYaw, c = Math.cos(a), s = Math.sin(a);
  return {x: input.x * c + input.z * s, z: -input.x * s + input.z * c};
}

const AtlasCore = {PLAYER_RADIUS, WALK_SPEED, BOUNDS, OBSTACLES, collisions, isWalkable, moveWithCollisions, resolvePosition, inputVector,
  CAMERA_LIMITS, DEFAULT_CAMERA, cameraOffset, clampCamera, applyDrag, applyZoom, damp, angleDelta, worldDirection};
if (typeof window !== 'undefined') window.AtlasCore = AtlasCore;
export default AtlasCore;
