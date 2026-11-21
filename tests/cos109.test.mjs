// COS-109: Project Manager office art vertical slice — invariants that must hold without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildWorld} from '../public/js/world/world-data.js';
import {buildPmOffice, pmBoardCounts, BOARD_COLUMNS, PM_ROOM} from '../public/js/world/office-pm.js';
import {createHumanoidHQ, createHumanoid, animateHumanoid, seatHumanoid} from '../public/js/world/humanoid.js';
import {OBSTACLES, isWalkable, nearestInteractable} from '../public/js/core/game-core.js';
import {INTERACTABLES} from '../public/js/world/world-data.js';

const world = buildWorld();
const office = buildPmOffice(THREE);
const byId = id => world.colliders.find(c => c.id === id);

test('only PM office primitives are tagged for the art slice, and every one lies inside the office', () => {
  const tagged = world.primitives.filter(p => p.zone === 'pm');
  assert.ok(tagged.length > 40, `tagged ${tagged.length}`);
  for (const p of tagged) assert.ok(p.x >= 12 && p.x <= 22.6 && p.z >= -16.6 && p.z <= -7, `${p.shape} at ${p.x},${p.z}`);
  assert.ok(world.primitives.every(p => !p.zone || p.zone === 'pm'));
});

test('colliders are unchanged by the slice: the same objects still block movement', () => {
  // world-data still emits every PM collider (the art only redraws them)
  for (const id of ['pm-desk', 'pm-desk-chair', 'pm-cabinet', 'pm-plant', 'pm-lamp', 'pm-visitor-w', 'pm-visitor-e', 'pm-lounge-chair-n', 'pm-lounge-chair-s', 'pm-lounge-table']) assert.ok(byId(id), id);
  assert.equal(world.colliders.length, OBSTACLES.length);
  assert.ok(!isWalkable(13.2, -11.8), 'lounge table blocks');
  assert.ok(isWalkable(17, -9.2), 'standing spot in front of the desk is free');
  assert.equal(nearestInteractable({x: 17, z: -10.3}, INTERACTABLES, 3.2)?.key, 'manager');
});

test('every art furniture piece sits on its collider (what you see is what blocks you)', () => {
  for (const {collider, box} of office.footprints) {
    const c = byId(collider); assert.ok(c, collider);
    const ix = Math.min(box.maxX, c.maxX) - Math.max(box.minX, c.minX), iz = Math.min(box.maxZ, c.maxZ) - Math.max(box.minZ, c.minZ);
    const overlap = Math.max(0, ix) * Math.max(0, iz) / ((c.maxX - c.minX) * (c.maxZ - c.minZ));
    assert.ok(overlap > .55, `${collider}: art covers only ${(overlap * 100).toFixed(0)}% of its collider`);
    // and does not spill far into walkable space
    assert.ok(box.minX > c.minX - .45 && box.maxX < c.maxX + .45 && box.minZ > c.minZ - .45 && box.maxZ < c.maxZ + .45, `${collider} art spills: ${JSON.stringify(box)} vs ${JSON.stringify(c)}`);
  }
});

test('the room stays inside its walls and within a draw-call / triangle budget', () => {
  const b = new THREE.Box3().setFromObject(office.group);
  assert.ok(b.min.x > PM_ROOM.x0 - .15 && b.max.x < PM_ROOM.x1 + .1 && b.min.z > PM_ROOM.z0 - .1 && b.max.z < PM_ROOM.z1 + .1, JSON.stringify(b));
  assert.ok(b.min.y > -.01 && b.max.y < 2.9);
  const s = office.stats();
  assert.ok(s.meshes <= 40, `meshes ${s.meshes}`);      // merged by material
  assert.ok(s.triangles < 120000, `triangles ${s.triangles}`);
});

test('sprint board shows real task counts only; every schema status is mapped or deliberately excluded', () => {
  const sql = fs.readFileSync(new URL('../server/db/migrations/001_init.sql', import.meta.url), 'utf8');
  const schema = sql.match(/CHECK \(status IN \(('proposed'[^)]*)\)\)/)[1].split(',').map(s => s.trim().replaceAll("'", ''));
  const mapped = Object.values(BOARD_COLUMNS).flat();
  for (const st of mapped) assert.ok(schema.includes(st), `board maps unknown status ${st}`);
  assert.deepEqual(schema.filter(s => !mapped.includes(s)).sort(), ['blocked', 'rejected']);
  assert.deepEqual(pmBoardCounts([]), {backlog: 0, progress: 0, review: 0, done: 0});
  const tasks = ['todo', 'proposed', 'in_progress', 'in_qa', 'awaiting_ceo', 'done', 'done', 'rejected', 'weird'].map(status => ({status}));
  assert.deepEqual(pmBoardCounts(tasks), {backlog: 2, progress: 2, review: 1, done: 2});
});

test('detailed humanoid keeps the shared rig: every status pose animates, and seating lowers the hips', () => {
  const hq = createHumanoidHQ(THREE), basic = createHumanoid(THREE, {});
  for (const k of ['hips', 'torso', 'neck', 'armL', 'armR', 'legL', 'legR']) assert.ok(hq[k] && basic[k], k);
  for (const pose of ['idle', 'thinking', 'talking', 'typing', 'reading', 'blocked', 'waiting', 'done', 'unknown']) {
    animateHumanoid(hq, {phase: 0, moving: false, time: 1, pose});
    seatHumanoid(hq, .5);
    assert.ok(hq.hips.position.y < .6 && hq.hips.position.y > .4, `${pose}: hips ${hq.hips.position.y}`);
  }
  const b = new THREE.Box3().setFromObject(createHumanoidHQ(THREE).group);
  const height = b.max.y - b.min.y; // standing; matches the player avatar (~2.0 m) so scale reads consistently
  assert.ok(height > 1.8 && height < 2.05, `height ${height}`);
});
