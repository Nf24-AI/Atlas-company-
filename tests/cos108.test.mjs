// COS-108 unit tests: camera modes, employee presence fidelity, signage/wayfinding data and
// navigation integrity after the environment pass. Pure modules only (no DOM/WebGL).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../public/js/core/game-core.js';
import {buildWorld, INTERACTABLES, ROOMS, SPAWN, roomAt} from '../public/js/world/world-data.js';
import {PRESENCE, KNOWN_STATUSES, presenceFor} from '../public/js/world/presence.js';
import {EMPLOYEE_STATUSES} from '../server/repo.js';

const {CAMERA_PRESETS, CAMERA_LIMITS, LEGACY_CAMERA, DEFAULT_CAMERA} = core;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** On-screen height (px) of a 2.0 m avatar for a camera preset: pinhole model, FOV 42°, 720 px tall. */
function playerPx(cam, height = 720, fovDeg = 42) {
  const o = core.cameraOffset(cam), eye = [o.x, o.y, o.z], target = [0, 1, 0];
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), k = 1 / Math.tan(fovDeg * Math.PI / 360);
  const y = p => { const d = sub(p, eye); return (1 - (dot(d, u) * k / dot(d, f) + 1) / 2) * height; };
  return y([0, 0, 0]) - y([0, 2, 0]);
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };

// ---- 108-A camera -------------------------------------------------------------
test('default camera is the close follow framing; overview is optional', () => {
  assert.equal(core.DEFAULT_CAMERA_MODE, 'follow');
  assert.deepEqual(DEFAULT_CAMERA, CAMERA_PRESETS.follow);
  assert.deepEqual(Object.keys(CAMERA_PRESETS).sort(), ['follow', 'overview']);
  assert.deepEqual(core.cameraPreset('nope'), DEFAULT_CAMERA, 'unknown mode falls back to default');
});

test('follow view makes the avatar much larger than before; overview is higher and wider', () => {
  const before = playerPx(LEGACY_CAMERA), follow = playerPx(CAMERA_PRESETS.follow), overview = playerPx(CAMERA_PRESETS.overview);
  assert.ok(follow >= before * 1.8, `follow ${follow.toFixed(0)}px vs legacy ${before.toFixed(0)}px`);
  assert.ok(overview < before, 'overview shows more of the floor than the legacy view');
  assert.ok(CAMERA_PRESETS.overview.pitch > CAMERA_PRESETS.follow.pitch);
  assert.ok(CAMERA_PRESETS.overview.distance > CAMERA_PRESETS.follow.distance);
});

test('every preset is inside the comfort limits (presets survive clamping unchanged)', () => {
  for (const [name, p] of Object.entries(CAMERA_PRESETS)) assert.deepEqual(core.clampCamera(p), {...p}, name);
});

test('WASD stays screen-relative and identical in follow and overview modes', () => {
  for (const p of Object.values(CAMERA_PRESETS)) {
    for (const [input, want] of [[{x: 0, z: -1}, {x: 0, z: -1}], [{x: 1, z: 0}, {x: 1, z: 0}]]) {
      const d = core.worldDirection(input, p.yaw);
      assert.ok(near(d.x, want.x) && near(d.z, want.z), JSON.stringify({p, d}));
    }
  }
});

test('the world was not shrunk to fix the camera (floor and walk speed unchanged)', () => {
  assert.deepEqual({...core.BOUNDS}, {minX: -22, maxX: 22, minZ: -16, maxZ: 16});
  assert.equal(core.WALK_SPEED, 5.2);
  assert.equal(core.PLAYER_RADIUS, 0.4);
});

test('follow camera stays above the office walls so the avatar is not hidden behind them', () => {
  const o = core.cameraOffset(CAMERA_PRESETS.follow);
  assert.ok(o.y > 2.6, `camera height ${o.y.toFixed(2)} must clear the 2.44 m wall + glass`);
  // zoomed all the way in it still sits above the walls
  assert.ok(core.cameraOffset({...CAMERA_PRESETS.follow, distance: CAMERA_LIMITS.minDistance, pitch: CAMERA_LIMITS.minPitch}).y > 2.6);
});

// ---- 108-C presence -------------------------------------------------------------
test('every backend employee status has a presence; unknown statuses never look busy', () => {
  const backend = [...EMPLOYEE_STATUSES].sort();
  assert.deepEqual([...KNOWN_STATUSES].sort(), backend);
  for (const bad of [undefined, null, '', 'offline', 'hacking', '__proto__', 'unknown']) {
    const p = presenceFor(bad);
    assert.equal(p.status, 'unknown'); assert.equal(p.pose, 'unknown'); assert.equal(p.busy, false);
  }
});

test('only "executing" types at the keyboard; poses are distinct per state', () => {
  const typing = KNOWN_STATUSES.filter(s => presenceFor(s).pose === 'typing');
  assert.deepEqual(typing, ['executing']);
  const poses = KNOWN_STATUSES.map(s => presenceFor(s).pose);
  assert.equal(new Set(poses).size, poses.length, 'each status has its own pose');
  assert.equal(presenceFor('available').busy, false);
  assert.ok(presenceFor('blocked').attention && presenceFor('awaiting_approval').attention, 'blockers and approvals call for attention');
  assert.ok(Object.isFrozen(PRESENCE) && Object.isFrozen(PRESENCE.executing));
});

// ---- 108-D signage, wayfinding, navigation -------------------------------------------
test('every walled office and open work area has a legible bilingual sign', () => {
  const {signs} = buildWorld();
  for (const s of signs) {
    assert.match(s.ar, /[؀-ۿ]/, `${s.id} has Arabic text`);
    assert.ok(s.en && s.w >= 1.5 && s.h >= .45, `${s.id} is large enough to read`);
    assert.ok([1, -1].includes(s.facing));
  }
  const text = signs.map(s => s.ar).join(' ');
  for (const ar of ['المدير التقني', 'غرفة الاجتماعات', 'مدير المشاريع', 'مكتب الرئيس التنفيذي', 'المطورون', 'مختبر الجودة', 'مركز العمليات', 'الاستقبال']) assert.ok(text.includes(ar), ar);
  assert.ok(signs.some(s => s.arrow === 'left') && signs.some(s => s.arrow === 'right'), 'directional wayfinding from reception');
});

test('roomAt identifies rooms for entry/exit cues and returns null in corridors', () => {
  assert.equal(roomAt(17, -12)?.id, 'manager');
  assert.equal(roomAt(SPAWN.x, SPAWN.z)?.id, 'reception');
  assert.equal(roomAt(0, 6.8), null);
  for (const r of ROOMS) assert.equal(roomAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2)?.id, r.id);
});

test('after the environment pass every office is still reachable and usable from its travel point', () => {
  const step = .25, k = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const start = core.resolvePosition(SPAWN.x, SPAWN.z), seen = new Set([k(start.x, start.z)]), queue = [start];
  while (queue.length) {
    const p = queue.shift();
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const n = core.moveWithCollisions(p.x, p.z, dx, dz);
      if (!near(n.x, p.x + dx, 1e-6) || !near(n.z, p.z + dz, 1e-6)) continue;
      const key = k(n.x, n.z); if (!seen.has(key)) { seen.add(key); queue.push(n); }
    }
  }
  for (const [name, it] of Object.entries(INTERACTABLES)) {
    const t = it.travel;
    assert.ok(core.isWalkable(t.x, t.z), `${name} travel point is walkable`);
    assert.ok([...seen].some(key => { const [i, j] = key.split(',').map(Number); return Math.hypot(i * step - t.x, j * step - t.z) < .3; }), `${name} reachable on foot from reception`);
    assert.equal(core.nearestInteractable(t, INTERACTABLES, 3.2)?.key, name, `${name}: E works from its travel point (range + line of sight)`);
  }
});

test('new furniture does not create interaction through walls', () => {
  assert.equal(core.nearestInteractable({x: 14.5, z: -6.5}, {manager: INTERACTABLES.manager}, 7), null);
  assert.equal(core.nearestInteractable({x: -14.5, z: 7.4}, {ceo: INTERACTABLES.ceo}, 7), null);
  assert.equal(core.hasLineOfSight(4, -12, 14, -12), false);
});
