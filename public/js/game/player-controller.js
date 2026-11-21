// Player movement: keyboard/touch input → camera-relative direction → collision-aware step.
import * as Core from '../core/game-core.js';

export function createPlayer(spawn) {
  return {x: spawn.x, z: spawn.z, heading: 0, moving: false, walkPhase: 0};
}

/** Advance the player one frame. Pure apart from mutating `player`. Returns true if it moved. */
export function stepPlayer(player, keys, yaw, dt, speed = Core.WALK_SPEED) {
  player.moving = false;
  const input = Core.inputVector(keys);
  if (!input.x && !input.z) return false;
  const dir = Core.worldDirection(input, yaw);
  const next = Core.moveWithCollisions(player.x, player.z, dir.x * speed * dt, dir.z * speed * dt);
  const moved = Math.hypot(next.x - player.x, next.z - player.z);
  player.moving = moved > 1e-4;
  player.x = next.x; player.z = next.z;
  player.heading = Math.atan2(dir.x, dir.z); // yaw convention: 0 faces +z (Three.js)
  if (player.moving) player.walkPhase += moved * 1.75; // animation follows real distance, not key state
  return player.moving;
}

/** Teleport (mini-map / recentre) — never into furniture. */
export function placePlayer(player, x, z) {
  const p = Core.resolvePosition(x, z);
  player.x = p.x; player.z = p.z;
}
