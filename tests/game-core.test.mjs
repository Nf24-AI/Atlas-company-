import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../public/js/core/game-core.js';
import {buildWorld, INTERACTABLES} from '../public/js/world/world-data.js';
import {tessellate} from '../public/js/world/renderer-webgl.js';

const {PLAYER_RADIUS: R, BOUNDS, OBSTACLES, DEFAULT_CAMERA, CAMERA_LIMITS} = core;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const byId = id => OBSTACLES.find(o => o.id === id);

/** Walk in a straight line for `seconds` at walking speed using 60 fps frames, like the game loop. */
function walk(start, dir, seconds) {
  let p = {...start};
  const dt = 1 / 60, len = Math.hypot(dir.x, dir.z);
  for (let t = 0; t < seconds; t += dt) p = core.moveWithCollisions(p.x, p.z, dir.x / len * core.WALK_SPEED * dt, dir.z / len * core.WALK_SPEED * dt);
  return p;
}

test('free movement is unchanged in open floor', () => {
  const p = core.moveWithCollisions(0, 7, 0.5, -0.3);
  assert.ok(near(p.x, 0.5) && near(p.z, 6.7));
});

test('map boundaries clamp like the original prototype', () => {
  assert.deepEqual(walk({x: 0, z: 7}, {x: 0, z: 1}, 3), {x: 0, z: BOUNDS.maxZ});
  assert.equal(walk({x: 0, z: 5}, {x: 1, z: 0}, 5).x, BOUNDS.maxX);
  assert.equal(walk({x: 0, z: 5}, {x: -1, z: 0}, 5).x, BOUNDS.minX);
});

test('cannot walk through the front partition of the manager office', () => {
  const wall = byId('mgr-front-a');
  const p = walk({x: -11, z: 5}, {x: 0, z: -1}, 3);
  assert.ok(near(p.z, wall.maxZ + R), `stopped at ${p.z}`);
  assert.ok(core.isWalkable(p.x, p.z));
});

test('both doorways of each office are walkable', () => {
  for (const x of [-7.05, -2, 2, 7.05]) {
    const p = walk({x, z: 6}, {x: 0, z: -1}, 2);
    assert.ok(p.z < 1, `door at x=${x} blocked, stopped at z=${p.z}`);
  }
});

test('cannot walk through the side partition between the two offices', () => {
  const p = walk({x: -3, z: 0}, {x: 1, z: 0}, 2);
  assert.ok(near(p.x, byId('mgr-wall-east').minX - R), `stopped at ${p.x}`);
  const q = walk({x: 3, z: 0}, {x: -1, z: 0}, 2);
  assert.ok(near(q.x, byId('dir-wall-west').maxX + R), `stopped at ${q.x}`);
});

test('desks block movement in both offices', () => {
  for (const id of ['mgr-desk', 'dir-desk']) {
    const d = byId(id), cx = (d.minX + d.maxX) / 2;
    const p = walk({x: cx, z: -8.5}, {x: 0, z: 1}, 2); // approach from behind the desk
    assert.ok(near(p.z, d.minZ - R), `${id}: stopped at ${p.z}`);
  }
});

test('player slides along a wall when walking diagonally into it', () => {
  const p = walk({x: -12, z: 4}, {x: 1, z: -1}, 0.8);
  assert.ok(near(p.z, byId('mgr-front-a').maxZ + R));
  assert.ok(p.x > -12 + 1.5, `expected sliding along x, got ${p.x}`);
});

test('large single steps cannot tunnel through thin walls', () => {
  const p = core.moveWithCollisions(-11, 4, 0, -5);
  assert.ok(p.z > 2.8, `tunnelled to ${p.z}`);
});

test('every staff office and operations are reachable from the lobby spawn', () => {
  // Breadth-first search over a 0.25 grid using the real movement function.
  const step = 0.25, key = p => `${Math.round(p.x / step)},${Math.round(p.z / step)}`;
  const seen = new Set([key({x: 0, z: 7})]), queue = [{x: 0, z: 7}];
  while (queue.length) {
    const p = queue.shift();
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const n = core.moveWithCollisions(p.x, p.z, dx, dz);
      if (!near(n.x, p.x + dx, 1e-6) || !near(n.z, p.z + dz, 1e-6)) continue;
      const k = key(n);
      if (!seen.has(k)) { seen.add(k); queue.push(n); }
    }
  }
  // Interaction radius in app.js is 4.0 around each office anchor.
  for (const [name, o] of Object.entries({manager: {x: -10, z: -4}, director: {x: 10, z: -4}, board: {x: 0, z: -8.2}})) {
    const reachable = [...seen].some(k => { const [i, j] = k.split(',').map(Number); return Math.hypot(i * step - o.x, j * step - o.z) < 3.5; });
    assert.ok(reachable, `${name} is not reachable`);
  }
});

test('mini-map travel targets and spawn are walkable or resolved to walkable', () => {
  for (const [x, z] of [[0, 7], [-10, -1.1], [10, -1.1], [0, -5.9]]) {
    const p = core.resolvePosition(x, z);
    assert.ok(core.isWalkable(p.x, p.z), `(${x},${z}) → (${p.x},${p.z})`);
  }
  const inside = core.resolvePosition(-10.3, -5.4); // centre of manager desk
  assert.ok(core.isWalkable(inside.x, inside.z));
  assert.ok(Math.hypot(inside.x + 10.3, inside.z + 5.4) < 2, 'resolved spot should stay close');
});

test('obstacles stay inside the floor and spawn is clear', () => {
  for (const o of OBSTACLES) assert.ok(o.minX < o.maxX && o.minZ < o.maxZ, o.id);
  assert.equal(core.collisions(0, 7).length, 0);
});

test('input vector normalises diagonals and supports arrows', () => {
  const v = core.inputVector(new Set(['w', 'd']));
  assert.ok(near(Math.hypot(v.x, v.z), 1));
  assert.deepEqual(core.inputVector(new Set(['ArrowUp'])), {x: 0, z: -1});
  assert.deepEqual(core.inputVector(new Set(['w', 's'])), {x: 0, z: 0});
});

test('default camera reproduces the original follow offset (11, 16, 17)', () => {
  const o = core.cameraOffset(DEFAULT_CAMERA);
  assert.ok(near(o.x, 11, 1e-9) && near(o.y, 16, 1e-9) && near(o.z, 17, 1e-9), JSON.stringify(o));
});

test('movement keys keep classic mapping at default camera and follow the camera after orbiting', () => {
  const up = {x: 0, z: -1};
  const d0 = core.worldDirection(up, DEFAULT_CAMERA.yaw);
  assert.ok(near(d0.x, 0) && near(d0.z, -1));
  // Orbit 90°: "up" must rotate with the view and stay unit length.
  const d1 = core.worldDirection(up, DEFAULT_CAMERA.yaw + Math.PI / 2);
  assert.ok(near(Math.hypot(d1.x, d1.z), 1));
  assert.ok(near(d1.x, -1) && near(d1.z, 0, 1e-9), JSON.stringify(d1));
});

test('camera pitch and zoom are clamped to comfortable limits', () => {
  let cam = core.applyDrag(DEFAULT_CAMERA, 0, 100000);
  assert.equal(cam.pitch, CAMERA_LIMITS.maxPitch);
  cam = core.applyDrag(DEFAULT_CAMERA, 0, -100000);
  assert.equal(cam.pitch, CAMERA_LIMITS.minPitch);
  for (let i = 0; i < 200; i++) cam = core.applyZoom(cam, -1000);
  assert.equal(cam.distance, CAMERA_LIMITS.minDistance);
  for (let i = 0; i < 200; i++) cam = core.applyZoom(cam, 1000);
  assert.equal(cam.distance, CAMERA_LIMITS.maxDistance);
});

test('one huge wheel event cannot lurch the camera', () => {
  const cam = core.applyZoom(DEFAULT_CAMERA, 1e6);
  assert.ok(cam.distance <= DEFAULT_CAMERA.distance * (1 + CAMERA_LIMITS.maxWheelStep) + 1e-9);
});

test('smoothing is frame-rate independent and angles wrap the short way', () => {
  // Two 30 ms frames must equal one 60 ms frame.
  const a = 1 - (1 - core.damp(3, 0.03)) ** 2, b = core.damp(3, 0.06);
  assert.ok(near(a, b, 1e-12));
  assert.ok(near(core.angleDelta(3.1, -3.1), 2 * Math.PI - 6.2, 1e-9));
});

test('browser wiring loads the modular entry point and the old monolith is gone', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('type="module" src="js/main.js"'));
  assert.match(html, /id="orbitBtn"/);
  assert.ok(!fs.existsSync(new URL('../public/app.js', import.meta.url)));
  const main = fs.readFileSync(new URL('../public/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /stepPlayer/);
  assert.match(main, /nearestInteractable/);
});

test('every collider is backed by visible geometry (shared source of truth)', () => {
  const {primitives, colliders} = buildWorld();
  const invisible = ['mgr-avatar', 'dir-avatar']; // seated NPCs are drawn dynamically at the same spot
  for (const c of colliders) {
    if (invisible.includes(c.id)) continue;
    const backed = primitives.some(p => {
      const hw = p.shape === 'box' ? p.w / 2 : p.r, hd = p.shape === 'box' ? p.d / 2 : p.r;
      return p.y + (p.h || 0) / 2 > 0.05 && p.x + hw > c.minX && p.x - hw < c.maxX && p.z + hd > c.minZ && p.z - hd < c.maxZ;
    });
    assert.ok(backed, `collider ${c.id} has no geometry`);
  }
});

test('line of sight: cannot interact through a partition, can through a doorway', () => {
  // Just outside the manager front partition, within 4 m of the manager: wall in between.
  assert.equal(core.nearestInteractable({x: -10, z: 3.4}, INTERACTABLES, 7), null);
  // Inside the office, facing the manager.
  assert.equal(core.nearestInteractable({x: -10, z: -1.1}, INTERACTABLES)?.key, 'manager');
  // Through the side partition between the two offices: blocked.
  assert.equal(core.hasLineOfSight(-2, -3, 2, -3), false);
  // Open floor: clear.
  assert.equal(core.hasLineOfSight(-3, 6, 3, 6), true);
});

test('slab test handles axis-parallel segments and misses', () => {
  const o = {minX: 0, maxX: 1, minZ: 0, maxZ: 1};
  assert.equal(core.segmentHitsBox(-1, .5, 2, .5, o), true);
  assert.equal(core.segmentHitsBox(-1, 2, 2, 2, o), false);
  assert.equal(core.segmentHitsBox(.5, -1, .5, -.1, o), false);
});

test('pinch zoom: spreading fingers zooms in, clamped and spike-capped', () => {
  const zin = core.applyPinch(DEFAULT_CAMERA, 1.1);
  assert.ok(zin.distance < DEFAULT_CAMERA.distance);
  const spike = core.applyPinch(DEFAULT_CAMERA, 50);
  assert.ok(spike.distance >= DEFAULT_CAMERA.distance / (1 + CAMERA_LIMITS.maxWheelStep) - 1e-9);
  assert.deepEqual(core.applyPinch(DEFAULT_CAMERA, NaN), DEFAULT_CAMERA);
  let cam = DEFAULT_CAMERA; for (let i = 0; i < 100; i++) cam = core.applyPinch(cam, 1.15);
  assert.equal(cam.distance, CAMERA_LIMITS.minDistance);
});

test('renderer tessellation produces whole triangles for every primitive', () => {
  const data = tessellate(buildWorld().primitives);
  assert.equal(data.length % 27, 0);
  assert.ok(data.every(Number.isFinite));
});
