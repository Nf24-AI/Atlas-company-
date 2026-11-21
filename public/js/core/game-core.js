// ATLAS game core — pure movement, collision, line-of-sight and camera math (COS-101, COS-102).
// No DOM or WebGL access here, so Node's test runner can import it directly.
// The browser imports it as an ES module.

export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 5.2;

import {buildWorld, BOUNDS as WORLD_BOUNDS} from '../world/world-data.js';

// Walkable area and obstacles come from world-data.js — the same calls that emit the visible geometry.
export const BOUNDS = WORLD_BOUNDS;
const WORLD = buildWorld();
export const OBSTACLES = Object.freeze(WORLD.colliders);
/** Colliders that block line of sight (tall walls/partitions, not low furniture). */
export const SIGHT_BLOCKERS = Object.freeze(WORLD.colliders.filter(c => c.sight));

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
// COS-108: two framings share ONE yaw, so screen-relative movement is identical in both.
//  - follow   (default): close third-person view; the avatar is easy to find and read.
//  - overview (optional): high bird's-eye view for orientation and map comprehension.
// LEGACY_CAMERA is the pre-COS-108 default (follow offset +11, +16, +17), kept for measurements.
const LEGACY_OFFSET = {x: 11, y: 16, z: 17};
const BASE_YAW = Math.atan2(LEGACY_OFFSET.x, LEGACY_OFFSET.z);
const deg = d => d * Math.PI / 180;
export const LEGACY_CAMERA = Object.freeze({
  yaw: BASE_YAW,
  pitch: Math.atan2(LEGACY_OFFSET.y, Math.hypot(LEGACY_OFFSET.x, LEGACY_OFFSET.z)),
  distance: Math.hypot(LEGACY_OFFSET.x, LEGACY_OFFSET.y, LEGACY_OFFSET.z),
});
export const CAMERA_LIMITS = Object.freeze({
  minPitch: 25 * Math.PI / 180, maxPitch: 65 * Math.PI / 180, // never top-down flips or ground-level views
  minDistance: 7, maxDistance: 40,
  rotateSpeed: 0.005, // radians per dragged pixel — deliberately slow to avoid motion sickness
  zoomSpeed: 0.0015,  // fraction of distance per wheel delta unit
  maxWheelStep: 0.15, // cap per wheel event so trackpads can't lurch the view
});
export const CAMERA_PRESETS = Object.freeze({
  follow: Object.freeze({yaw: BASE_YAW, pitch: deg(33), distance: 12.5}),
  overview: Object.freeze({yaw: BASE_YAW, pitch: deg(58), distance: 34}),
});
export const CAMERA_MODES = Object.freeze(Object.keys(CAMERA_PRESETS));
export const DEFAULT_CAMERA_MODE = 'follow';
export const DEFAULT_CAMERA = CAMERA_PRESETS[DEFAULT_CAMERA_MODE];

/** Preset for a mode name; unknown names fall back to the default framing. */
export function cameraPreset(mode) {
  return CAMERA_PRESETS[mode] || DEFAULT_CAMERA;
}

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
export function worldDirection(input, yaw, baseYaw = BASE_YAW) {
  const a = yaw - baseYaw, c = Math.cos(a), s = Math.sin(a);
  return {x: input.x * c + input.z * s, z: -input.x * s + input.z * c};
}


// ---- Line of sight ------------------------------------------------------------
/** True when segment (ax,az)->(bx,bz) passes through box o (slab test, 2D). */
export function segmentHitsBox(ax, az, bx, bz, o) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** True when nothing in `blockers` lies between the two points. */
export function hasLineOfSight(ax, az, bx, bz, blockers = SIGHT_BLOCKERS) {
  return !blockers.some(o => segmentHitsBox(ax, az, bx, bz, o));
}

/**
 * The interactable the player can use right now: within `range` of its point AND visible
 * (no wall in between). Prevents interacting through partitions.
 */
export function nearestInteractable(player, interactables, range = 4, blockers = SIGHT_BLOCKERS) {
  let best = null;
  for (const [key, it] of Object.entries(interactables)) {
    const p = it.point || it;
    const d = Math.hypot(player.x - p.x, player.z - p.z);
    if (d < range && (!best || d < best.distance) && hasLineOfSight(player.x, player.z, p.x, p.z, blockers)) best = {key, distance: d};
  }
  return best;
}

/** Pinch gesture: ratio of finger distance now / before → new orbit state (fingers apart = zoom in). */
export function applyPinch(cam, ratio, limits = CAMERA_LIMITS) {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return cam;
  const r = clamp(ratio, 1 - limits.maxWheelStep, 1 + limits.maxWheelStep);
  return clampCamera({...cam, distance: cam.distance / r}, limits);
}

const AtlasCore = {PLAYER_RADIUS, WALK_SPEED, BOUNDS, OBSTACLES, collisions, isWalkable, moveWithCollisions, resolvePosition, inputVector,
  CAMERA_LIMITS, DEFAULT_CAMERA, LEGACY_CAMERA, CAMERA_PRESETS, CAMERA_MODES, DEFAULT_CAMERA_MODE, cameraPreset, cameraOffset, clampCamera, applyDrag, applyZoom, applyPinch, damp, angleDelta, worldDirection,
  SIGHT_BLOCKERS, segmentHitsBox, hasLineOfSight, nearestInteractable};
export default AtlasCore;
