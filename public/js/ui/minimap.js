// Mini-map drawn from world-data rooms: walls, live employee status dots, player arrow.
// Clicking a room travels to its interaction spot (keyboard: buttons below the map).
import {STATUS_COLORS} from './status-colors.js';
import {L} from './i18n.js';

export function createMinimap(canvas, world, {onTravel}) {
  const ctx = canvas.getContext('2d');
  const B = {x0: world.bounds.minX - .6, x1: world.bounds.maxX + .6, z0: world.bounds.minZ - .6, z1: world.bounds.maxZ + .6};
  let W = 0, H = 0, sx = 1;
  const toPx = (x, z) => [(x - B.x0) * sx, (z - B.z0) * sx];
  const fromPx = (px, py) => [px / sx + B.x0, py / sx + B.z0];
  function resize() {
    const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sx = Math.min(W / (B.x1 - B.x0), H / (B.z1 - B.z0));
  }
  resize(); window.addEventListener('resize', resize);
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect(); const [x, z] = fromPx(e.clientX - r.left, e.clientY - r.top);
    const room = world.rooms.find(rm => x >= rm.x0 && x <= rm.x1 && z >= rm.z0 && z <= rm.z1);
    if (room && world.interactables[room.id]) onTravel(room.id);
  });
  return {
    resize, // COS-108: the map can start collapsed (0×0); re-measure when it opens
    draw(player, npcStates, nearby) {
      if (!W || !H) { resize(); if (!W || !H) return; }
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1b3540'; ctx.fillRect(0, 0, (B.x1 - B.x0) * sx, (B.z1 - B.z0) * sx);
      for (const rm of world.rooms) {
        const [a, b] = toPx(rm.x0, rm.z0), [c, d] = toPx(rm.x1, rm.z1);
        ctx.fillStyle = rm.id === nearby ? '#3f6b66' : rm.walled ? '#2c4f58' : '#24444e';
        ctx.fillRect(a + 1, b + 1, c - a - 2, d - b - 2);
        if (rm.walled) { ctx.strokeStyle = '#86b3a9'; ctx.lineWidth = 1; ctx.strokeRect(a + 1, b + 1, c - a - 2, d - b - 2); }
        ctx.fillStyle = '#cfe9e1'; ctx.font = '600 8px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(L(rm.ar, rm.en), (a + c) / 2, (b + d) / 2 + 3, c - a - 6);
      }
      for (const n of world.npcs) {
        const [x, y] = toPx(n.x, n.z); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_COLORS[npcStates[n.id]?.status] || STATUS_COLORS.unknown; ctx.fill();
      }
      const [px, py] = toPx(player.x, player.z);
      ctx.save(); ctx.translate(px, py); ctx.rotate(-player.heading + Math.PI);
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 4.5); ctx.lineTo(-4.5, 4.5); ctx.closePath();
      ctx.fillStyle = '#f9c47d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.fill(); ctx.stroke(); ctx.restore();
    },
  };
}
