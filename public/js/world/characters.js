// Character primitives (player + NPCs). Pure, so the renderer streams them each frame.
// `walkPhase` only advances when the character really moved (see player-controller).
export function avatarPrimitives(x, z, coat, accent, walkPhase = 0, moving = false) {
  const bob = moving ? Math.abs(Math.sin(walkPhase)) * .055 : 0;
  const p = [];
  const box = (bx, by, bz, w, h, d, color) => p.push({shape: 'box', x: bx, y: by, z: bz, w, h, d, color});
  const cyl = (cx, cy, cz, r, h, color) => p.push({shape: 'cyl', x: cx, y: cy, z: cz, r, h, color});
  box(x, .07, z, .82, .04, .82, '#9caea3');
  cyl(x, .31 + bob, z, .28, .56, '#314c5c'); cyl(x - .17, .45 + bob, z, .12, .52, '#344f60'); cyl(x + .17, .45 + bob, z, .12, .52, '#344f60');
  box(x, .97 + bob, z, .62, .88, .40, coat); box(x - .40, 1.01 + bob, z, .19, .78, .28, coat); box(x + .40, 1.01 + bob, z, .19, .78, .28, coat);
  p.push({shape: 'sphere', x, y: 1.66 + bob, z, r: .33, color: '#d5a982'});
  box(x, 1.85 + bob, z - .045, .53, .14, .48, accent);
  return p;
}
