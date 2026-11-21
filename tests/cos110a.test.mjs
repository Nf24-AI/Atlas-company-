// COS-110A: third-person mouse-controlled rig — pure math and movement invariants.
import test from 'node:test';
import assert from 'node:assert/strict';
import {THIRD_PERSON, applyMouseLook, cameraRelativeDirection, unobstructedDistance, thirdPersonPose, stepThirdPerson, segmentEntry} from '../public/js/core/third-person.js';
import {cameraOffset, WALK_SPEED, OBSTACLES, isWalkable} from '../public/js/core/game-core.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const cam0 = {yaw: 0, pitch: THIRD_PERSON.pitch, distance: THIRD_PERSON.distance};

test('W walks exactly where the camera looks (ground-projected), for any yaw', () => {
  for (const yaw of [0, .7, Math.PI / 2, 2.5, -1.9]) {
    const off = cameraOffset({yaw, pitch: .3, distance: 5});              // camera relative to the target
    const fwd = {x: -off.x, z: -off.z}, l = Math.hypot(fwd.x, fwd.z);
    const w = cameraRelativeDirection({x: 0, z: -1}, yaw);
    assert.ok(near(w.x, fwd.x / l) && near(w.z, fwd.z / l), `yaw ${yaw}: ${JSON.stringify(w)}`);
    const d = cameraRelativeDirection({x: 1, z: 0}, yaw);                   // D = right of forward
    assert.ok(near(d.x * w.z - d.z * w.x, -1), 'D is perpendicular to W, on the camera right side');
    if (yaw === 0) assert.ok(near(d.x, 1) && near(d.z, 0), 'camera on +z looking -z: D is +x (screen right)');
    const s = cameraRelativeDirection({x: 0, z: 1}, yaw);
    assert.ok(near(s.x, -w.x) && near(s.z, -w.z));
  }
  assert.deepEqual(cameraRelativeDirection({x: 0, z: 0}, 1), {x: 0, z: 0});
});

test('mouse look: right turns right, up looks up, invert Y, pitch clamp, sensitivity and spike cap', () => {
  const right = applyMouseLook(cam0, 50, 0);
  const wBefore = cameraRelativeDirection({x: 0, z: -1}, cam0.yaw), wAfter = cameraRelativeDirection({x: 0, z: -1}, right.yaw);
  assert.ok(wBefore.x * wAfter.z - wBefore.z * wAfter.x < 0 || wAfter.x > wBefore.x, 'forward rotated toward the old right');
  assert.ok(applyMouseLook(cam0, 0, 40).pitch > cam0.pitch, 'mouse down (dy>0) raises the camera → looks down at the player');
  assert.ok(applyMouseLook(cam0, 0, 40, {invertY: true}).pitch < cam0.pitch);
  assert.equal(applyMouseLook(cam0, 0, 1e6).pitch, applyMouseLook(cam0, 0, 300).pitch, 'single huge event is capped');
  let c = cam0; for (let i = 0; i < 100; i++) c = applyMouseLook(c, 0, 300);
  assert.equal(c.pitch, THIRD_PERSON.maxPitch);
  c = cam0; for (let i = 0; i < 100; i++) c = applyMouseLook(c, 0, -300);
  assert.equal(c.pitch, THIRD_PERSON.minPitch);
  const slow = applyMouseLook(cam0, 100, 0, {sensitivity: .5}), fast = applyMouseLook(cam0, 100, 0, {sensitivity: 2});
  assert.ok(near(fast.yaw - cam0.yaw, 4 * (slow.yaw - cam0.yaw)));
  assert.deepEqual(applyMouseLook(cam0, NaN, 3), cam0);
});

test('camera never sits behind a wall: obstruction pulls the eye in front of it', () => {
  // Player inside the PM office facing the desk, camera pointing back through the south wall (z = -7).
  const player = {x: 14, z: -8.4};
  const pose = thirdPersonPose(player, {yaw: 0, pitch: THIRD_PERSON.pitch, distance: 6});
  assert.ok(pose.obstructed, 'south partition is between player and the desired eye');
  assert.ok(pose.eye.z < -7.1, `eye z ${pose.eye.z} must stay inside the office`);
  // Open floor: nothing in the way, full distance.
  const open = thirdPersonPose({x: 0, z: 6}, {yaw: 0, pitch: THIRD_PERSON.pitch, distance: 5});
  assert.equal(open.obstructed, false); assert.ok(near(open.distance, 5));
  assert.equal(segmentEntry(0, 0, 2, 0, {minX: 1, maxX: 3, minZ: -1, maxZ: 1}), .5);
  assert.equal(unobstructedDistance(0, 6, 0, .2, 4, []), 4);
});

test('third-person movement: accelerates smoothly, sprint is faster, walls still stop the player', () => {
  const p = {x: 6, z: 13, heading: 0, walkPhase: 0}; // x = 6 is an open lane from z 14 to -4
  stepThirdPerson(p, {x: 0, z: -1}, 0, 1 / 60);
  const first = 13 - p.z;
  assert.ok(first > 0 && first < WALK_SPEED / 60, 'first frame is slower than full speed (acceleration)');
  for (let i = 0; i < 40; i++) stepThirdPerson(p, {x: 0, z: -1}, 0, 1 / 60);
  const z0 = p.z; stepThirdPerson(p, {x: 0, z: -1}, 0, 1 / 60);
  assert.ok(near(z0 - p.z, WALK_SPEED / 60, 2e-3), 'reaches walking speed');
  const q = {x: 6, z: 13, heading: 0, walkPhase: 0};
  for (let i = 0; i < 40; i++) stepThirdPerson(q, {x: 0, z: -1}, 0, 1 / 60, {sprint: true});
  const q0 = q.z; stepThirdPerson(q, {x: 0, z: -1}, 0, 1 / 60, {sprint: true});
  assert.ok(near(q0 - q.z, WALK_SPEED * THIRD_PERSON.sprint / 60, 2e-3) && q.running);
  // Release keys: decelerates to a stop instead of halting instantly
  stepThirdPerson(q, {x: 0, z: 0}, 0, 1 / 60); assert.ok(q.moving, 'still gliding one frame after release');
  for (let i = 0; i < 120; i++) stepThirdPerson(q, {x: 0, z: 0}, 0, 1 / 60);
  assert.equal(q.moving, false);
  // Walls: walk north into the PM office front wall from the corridor
  const r = {x: 14, z: -4.5, heading: 0, walkPhase: 0};
  for (let i = 0; i < 240; i++) stepThirdPerson(r, {x: 0, z: -1}, 0, 1 / 60, {sprint: true});
  assert.ok(r.z > -7 && isWalkable(r.x, r.z), `stopped at ${r.z}`);
  assert.ok(OBSTACLES.length > 0);
});

test('player faces the walking direction (camera-relative), not the camera', () => {
  const p = {x: 0, z: 7, heading: 0, walkPhase: 0};
  stepThirdPerson(p, {x: 1, z: 0}, Math.PI / 2, 1 / 60); // camera on +x looking -x; D = walk toward -z
  const dir = cameraRelativeDirection({x: 1, z: 0}, Math.PI / 2);
  assert.ok(near(p.heading, Math.atan2(dir.x, dir.z)));
  assert.ok(near(dir.z, -1));
});
