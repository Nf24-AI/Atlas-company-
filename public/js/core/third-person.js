// COS-110A: opt-in third-person camera rig with mouse look (GTA-like feel, original implementation).
// Pure math, importable from Node for unit tests. The browser wiring lives in game/camera-controller.js.
//
// Conventions (same as game-core): yaw 0 puts the camera on +z looking toward -z; the camera sits at
// target + cameraOffset({yaw, pitch, distance}). Positive pitch = camera above the look target.
import {SIGHT_BLOCKERS, PLAYER_RADIUS, WALK_SPEED, moveWithCollisions, damp} from './game-core.js';

const deg = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const THIRD_PERSON = Object.freeze({
  pitch: deg(14), distance: 4.6,          // default: behind and a little above the shoulder
  minPitch: deg(-8), maxPitch: deg(55),   // can look slightly up, never flips over the top
  minDistance: 2.2, maxDistance: 8,
  lookHeight: 1.55,                       // look at the upper chest / head, not the feet
  shoulder: .42,                          // over-the-shoulder offset to the right
  wallMargin: .3,                         // keep the eye this far in front of a wall
  sprint: 1.75,                           // Shift multiplier
  accel: 12,                              // velocity smoothing rate (1/s)
});
export const LOOK_DEFAULTS = Object.freeze({sensitivity: 1, invertY: false});
const BASE_RAD_PER_PX = .0022;

/** Mouse movement (px) → new yaw/pitch. Moving the mouse right turns the view right; up looks up. */
export function applyMouseLook(cam, dx, dy, {sensitivity = 1, invertY = false} = {}, lim = THIRD_PERSON) {
  const s = BASE_RAD_PER_PX * clamp(Number(sensitivity) || 1, .2, 3);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return cam;
  // Browsers occasionally report a huge jump on the first locked event: cap a single event.
  dx = clamp(dx, -300, 300); dy = clamp(dy, -300, 300);
  return {...cam, yaw: cam.yaw - dx * s, pitch: clamp(cam.pitch + (invertY ? -dy : dy) * s, lim.minPitch, lim.maxPitch)};
}

/** Camera-relative movement: W walks where the camera looks (ground-projected), D strafes right. */
export function cameraRelativeDirection(input, yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);  // forward on the ground
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);   // right
  const x = rx * input.x - fx * input.z, z = rz * input.x - fz * input.z;
  const l = Math.hypot(x, z);
  return l ? {x: x / l, z: z / l} : {x: 0, z: 0};
}

/** Entry parameter t ∈ [0,1] where segment a→b first enters box o, or null (2D slab test). */
export function segmentEntry(ax, az, bx, bz, o) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, o.minX, o.maxX], [az, dz, o.minZ, o.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return null; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

/**
 * Camera obstruction: the largest distance ≤ `distance` the eye can sit at, from the look target along the
 * view direction, without crossing a wall. Walls are tall, so any sight-blocking collider counts.
 */
export function unobstructedDistance(tx, tz, yaw, pitch, distance, blockers = SIGHT_BLOCKERS, lim = THIRD_PERSON) {
  const h = Math.cos(pitch) * distance;
  const ex = tx + Math.sin(yaw) * h, ez = tz + Math.cos(yaw) * h;
  let best = 1;
  for (const o of blockers) {
    if (o.minX <= tx && tx <= o.maxX && o.minZ <= tz && tz <= o.maxZ) continue; // target inside: ignore
    const t = segmentEntry(tx, tz, ex, ez, o);
    if (t !== null && t < best) best = t;
  }
  if (best >= 1) return distance;
  return Math.max(lim.minDistance * .5, best * distance - lim.wallMargin / Math.max(.2, Math.cos(pitch)));
}

/** Eye and look target for the rig (world coordinates). */
export function thirdPersonPose(player, cam, blockers = SIGHT_BLOCKERS, lim = THIRD_PERSON) {
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const tx = player.x + rx * lim.shoulder, tz = player.z + rz * lim.shoulder, ty = lim.lookHeight;
  const d = unobstructedDistance(tx, tz, cam.yaw, cam.pitch, cam.distance, blockers, lim);
  const h = Math.cos(cam.pitch) * d;
  return {
    eye: {x: tx + Math.sin(cam.yaw) * h, y: Math.max(.35, ty + Math.sin(cam.pitch) * d), z: tz + Math.cos(cam.yaw) * h},
    target: {x: tx, y: ty, z: tz}, distance: d, obstructed: d < cam.distance - 1e-6,
  };
}

/**
 * One movement step in third-person mode: camera-relative direction, Shift sprint, smoothed velocity
 * (acceleration / deceleration), collisions via the shared moveWithCollisions. Mutates and returns player.
 */
export function stepThirdPerson(player, input, yaw, dt, {sprint = false} = {}, lim = THIRD_PERSON) {
  const dir = cameraRelativeDirection(input, yaw);
  const speed = WALK_SPEED * (sprint ? lim.sprint : 1);
  const v = player.vel || (player.vel = {x: 0, z: 0});
  const k = damp(lim.accel, dt);
  v.x += (dir.x * speed - v.x) * k; v.z += (dir.z * speed - v.z) * k;
  if (Math.hypot(v.x, v.z) < .02 && !input.x && !input.z) { v.x = 0; v.z = 0; }
  const next = moveWithCollisions(player.x, player.z, v.x * dt, v.z * dt, PLAYER_RADIUS);
  const moved = Math.hypot(next.x - player.x, next.z - player.z);
  // Blocked by a wall: drop the blocked velocity component so we don't keep pushing into it.
  if (Math.abs(next.x - player.x) < Math.abs(v.x * dt) * .5) v.x = 0;
  if (Math.abs(next.z - player.z) < Math.abs(v.z * dt) * .5) v.z = 0;
  player.x = next.x; player.z = next.z;
  player.moving = moved > 1e-4;
  if (input.x || input.z) player.heading = Math.atan2(dir.x, dir.z); // face the walking direction
  if (player.moving) player.walkPhase += moved * 1.75;
  player.running = sprint && player.moving;
  return player;
}
