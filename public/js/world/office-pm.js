// COS-109: Project Manager office — art vertical slice (3D renderer only).
//
// Replaces the PM office primitives tagged `zone: 'pm'` in world-data.js with a cohesive, original,
// procedurally built room: oak plank floor, wainscot + cream walls, a walnut slat feature wall with a LIVE
// sprint board (real task counts), framed windows, an executive desk with accessories, an executive chair,
// visitor chairs, a lounge corner, credenza, arc floor lamp, plant and rug. Warm local lights and a small
// reflection environment give materials depth. Everything sits on the SAME collider footprints that
// world-data emits, so movement, collision and line of sight are unchanged (unit-tested).
//
// Static meshes are merged per material to keep draw calls low. No external assets, no dependencies.
// `THREE` is injected so Node tests can build the room without a browser (textures are skipped there).

export const PM_ROOM = Object.freeze({x0: 12.1, x1: 22.55, z0: -16.55, z1: -7.1});
export const PM_NPC_SEAT = Object.freeze({x: 17, z: -12.62, seat: .5}); // where the seated manager is drawn
// The manager's live monitor moves to the side and down so the seated manager's face stays visible to visitors.
export const PM_MONITOR = Object.freeze({id: 'pm-desk-screen', x: 17.62, y: 1.08, z: -11.43});

const PAL = Object.freeze({ // ATLAS visual blueprint tokens
  navy: '#142b31', teal: '#1e5557', cream: '#eee9de', wood: '#9b7050', walnut: '#6b4a33', oak: '#c49a6c',
  amber: '#d9a35f', mint: '#64d7bb', brass: '#c9a063', metal: '#3b4a4f', leather: '#2c2f33', fabric: '#2f6a66',
  fabric2: '#c9b79c', ceramic: '#f1ede4', leaf: '#3f7f5c', leaf2: '#5c9a6a', glass: '#bfe1df',
});

// ---- procedural textures (browser only) ---------------------------------------------------------
const hasDom = () => typeof document !== 'undefined';
function canvasTex(THREE, w, h, draw, {repeat = [1, 1], srgb = true} = {}) {
  if (!hasDom()) return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  return t;
}
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function grain(ctx, x, y, w, h, base, dark, rand, lines = 26) {
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < lines; i++) {
    ctx.strokeStyle = dark; ctx.globalAlpha = .05 + rand() * .12; ctx.lineWidth = .6 + rand() * 1.6;
    const yy = y + rand() * h, amp = 1 + rand() * 3, f = .01 + rand() * .03;
    ctx.beginPath(); for (let xx = 0; xx <= w; xx += 6) ctx.lineTo(x + xx, yy + Math.sin(xx * f + i) * amp); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const textures = THREE => ({
  floor: canvasTex(THREE, 1024, 1024, (c, w, h) => { // oak planks, staggered, per-plank tint
    const r = rng(7), rows = 8, ph = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = -(r() * w * .5);
      while (x < w) {
        const len = w * (.35 + r() * .3), tint = Math.round(-14 + r() * 28);
        const base = `rgb(${196 + tint},${154 + tint},${108 + tint})`;
        grain(c, x, i * ph, len, ph, base, '#6d4a2c', r, 14);
        c.fillStyle = 'rgba(60,38,20,.55)'; c.fillRect(x, i * ph, 2, ph);
        x += len;
      }
      c.fillStyle = 'rgba(60,38,20,.6)'; c.fillRect(0, i * ph, w, 2);
    }
  }, {repeat: [5, 4.5]}),
  walnut: canvasTex(THREE, 512, 512, (c, w, h) => grain(c, 0, 0, w, h, PAL.walnut, '#2e1d12', rng(3), 60), {repeat: [1, 1]}),
  oak: canvasTex(THREE, 512, 512, (c, w, h) => grain(c, 0, 0, w, h, '#b98d60', '#6d4a2c', rng(11), 50), {repeat: [1, 1]}),
  rug: canvasTex(THREE, 512, 512, (c, w, h) => {
    c.fillStyle = '#2b5a58'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d9a35f'; c.lineWidth = 10; c.strokeRect(26, 26, w - 52, h - 52);
    c.strokeStyle = '#e8dcc4'; c.lineWidth = 3; c.strokeRect(50, 50, w - 100, h - 100);
    c.globalAlpha = .25; c.strokeStyle = '#e8dcc4'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(80 + i * 30, 80); c.lineTo(80 + i * 30 + 60, h - 80); c.stroke(); }
    c.globalAlpha = 1;
    const r = rng(5); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(0,0,0,${r() * .06})`; c.fillRect(r() * w, r() * h, 2, 2); } // pile noise
  }, {repeat: [1, 1]}),
  fabric: canvasTex(THREE, 128, 128, (c, w, h) => {
    c.fillStyle = '#8c8c8c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { c.fillStyle = y % 4 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { c.fillStyle = x % 4 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; c.fillRect(x, 0, 1, h); }
  }, {repeat: [3, 3], srgb: false}),
  window: canvasTex(THREE, 512, 256, (c, w, h) => { // generic daylight skyline (no real city)
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd0e6'); g.addColorStop(.7, '#e6f1ec'); g.addColorStop(1, '#f7efe0');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(19); c.fillStyle = 'rgba(80,120,135,.35)';
    for (let x = 0; x < w;) { const bw = 18 + r() * 40, bh = 40 + r() * 110; c.fillRect(x, h - bh, bw, bh); x += bw + 4 + r() * 10; }
    c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(60 + i * 130, 40 + (i % 2) * 18, 46, 12, 0, 0, Math.PI * 2); c.fill(); }
  }),
  art: canvasTex(THREE, 256, 320, (c, w, h) => { // abstract print in the palette
    c.fillStyle = '#efe7d6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1e5557'; c.beginPath(); c.arc(w * .4, h * .42, 80, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9a35f'; c.fillRect(w * .5, h * .5, 90, 110);
    c.strokeStyle = '#142b31'; c.lineWidth = 5; c.beginPath(); c.moveTo(20, h * .8); c.lineTo(w - 20, h * .3); c.stroke();
  }),
  keyboard: canvasTex(THREE, 256, 80, (c, w, h) => {
    c.fillStyle = '#23292c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a4348'; for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) c.fillRect(6 + k * 17.6, 6 + r * 18, 14, 14);
  }),
  nameplate: canvasTex(THREE, 512, 96, (c, w, h) => {
    c.fillStyle = '#142b31'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a35f'; c.fillRect(0, h - 6, w, 6);
    c.fillStyle = '#f5f1e9'; c.textAlign = 'center'; c.direction = 'rtl'; c.font = '700 44px "Segoe UI", Tahoma, sans-serif';
    c.fillText('مدير المشاريع', w / 2, 58);
  }),
});

/** Sprint board face: REAL task counts from the store (never invented work). */
export function drawSprintBoard(ctx, w, h, counts) {
  ctx.fillStyle = '#16323a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0e2328'; ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = '#d9a35f'; ctx.fillRect(0, 62, w, 3);
  ctx.fillStyle = '#f5f1e9'; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.font = '700 36px "Segoe UI", Tahoma, sans-serif';
  ctx.fillText('لوحة العمل · ATLAS WORK', w / 2, 44);
  const cols = [['backlog', 'قائمة الانتظار', '#77b8f0'], ['progress', 'قيد التنفيذ', '#f6bc7a'], ['review', 'بانتظار الموافقة', '#f6d27a'], ['done', 'منجز', '#63d9a3']];
  const cw = w / cols.length;
  cols.forEach(([k, label, color], i) => {
    const x = i * cw, n = counts?.[k] ?? 0;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 8, 76, cw - 16, h - 86);
    ctx.fillStyle = color; ctx.fillRect(x + 8, 76, cw - 16, 4);
    ctx.fillStyle = '#eee9de'; ctx.font = '600 26px "Segoe UI", Tahoma, sans-serif'; ctx.direction = 'rtl';
    ctx.fillText(label, x + cw / 2, 116);
    ctx.font = '700 64px "Segoe UI", Tahoma, sans-serif'; ctx.fillStyle = n ? color : 'rgba(238,233,222,.35)';
    ctx.fillText(String(n), x + cw / 2, 190);
    for (let j = 0; j < Math.min(n, 6); j++) { // one card per real task (no invented titles)
      ctx.fillStyle = '#eee9de'; ctx.fillRect(x + 22, 214 + j * 44, cw - 44, 36);
      ctx.fillStyle = color; ctx.fillRect(x + cw - 30, 214 + j * 44, 8, 36);
    }
    if (n > 6) { ctx.fillStyle = '#eee9de'; ctx.font = '600 22px system-ui'; ctx.fillText(`+${n - 6}`, x + cw / 2, h - 16); }
  });
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  if (!total) { ctx.fillStyle = 'rgba(238,233,222,.75)'; ctx.font = '600 28px "Segoe UI", Tahoma, sans-serif'; ctx.fillText(counts ? 'لا مهام بعد — اطلب خطة من مدير المشاريع' : 'جارٍ التحميل…', w / 2, 330); }
}

/**
 * Build the office. Returns {group, lights, footprints, npcSeat, update(boardCounts)}.
 * `screens` are world-data screens (the manager's live monitor plane is drawn by the renderer at its usual spot).
 */
export function buildPmOffice(THREE, {envMap = null} = {}) {
  const tex = textures(THREE);
  const mats = new Map();
  // Reflections only where they read (metal, brass, ceramic, leather, walnut): large matte surfaces skip the env map lookup.
  const SHINY = new Set(['walnut', 'metal', 'brass', 'leather', 'ceramic', 'glassFrame']);
  const mat = (key, make) => { if (!mats.has(key)) { const m = make(); if (envMap && m.isMeshStandardMaterial && SHINY.has(key)) { m.envMap = envMap; m.envMapIntensity = m.envMapIntensity ?? .6; } mats.set(key, m); } return mats.get(key); };
  const std = (key, o) => mat(key, () => new THREE.MeshStandardMaterial(o));
  const M = {
    floor: std('floor', {color: tex.floor ? '#ffffff' : PAL.oak, map: tex.floor, roughness: .55, envMapIntensity: .35}),
    walnut: std('walnut', {color: tex.walnut ? '#ffffff' : PAL.walnut, map: tex.walnut, roughness: .45, envMapIntensity: .55}),
    oak: std('oak', {color: tex.oak ? '#ffffff' : PAL.oak, map: tex.oak, roughness: .55}),
    cream: std('cream', {color: PAL.cream, roughness: .9, envMapIntensity: .25}),
    teal: std('teal', {color: PAL.teal, roughness: .85}),
    // concepts 01/04: warm LED cove strips and mint accents. Emissive only: no per-pixel light cost.
    led: mat('led', () => new THREE.MeshStandardMaterial({color: '#7a4a18', emissive: '#ff9a3c', emissiveIntensity: 1.5, roughness: .6})),
    ledMint: mat('ledMint', () => new THREE.MeshStandardMaterial({color: '#1e5557', emissive: '#3fcfa9', emissiveIntensity: 1.3, roughness: .6})),
    trim: std('trim', {color: '#3a2a1e', roughness: .5}),
    metal: std('metal', {color: PAL.metal, roughness: .32, metalness: .75}),
    brass: std('brass', {color: PAL.brass, roughness: .28, metalness: .9, envMapIntensity: 1}),
    leather: std('leather', {color: PAL.leather, roughness: .42, envMapIntensity: .5}),
    fabric: std('fabric', {color: PAL.fabric, roughness: .95, bumpMap: tex.fabric, bumpScale: .6, envMapIntensity: .2}),
    fabric2: std('fabric2', {color: PAL.fabric2, roughness: .95, bumpMap: tex.fabric, bumpScale: .6, envMapIntensity: .2}),
    rug: std('rug', {color: tex.rug ? '#ffffff' : PAL.teal, map: tex.rug, roughness: 1, envMapIntensity: .1}),
    ceramic: std('ceramic', {color: PAL.ceramic, roughness: .25, envMapIntensity: .8}),
    terracotta: std('terracotta', {color: '#b86b4b', roughness: .8}),
    leaf: std('leaf', {color: PAL.leaf, roughness: .6, side: THREE.DoubleSide}),
    leaf2: std('leaf2', {color: PAL.leaf2, roughness: .6, side: THREE.DoubleSide}),
    screen: std('screen', {color: '#0d1417', roughness: .2, metalness: .3}),
    plastic: std('plastic', {color: '#23292c', roughness: .5}),
    keyboard: std('keyboard', {color: tex.keyboard ? '#ffffff' : '#23292c', map: tex.keyboard, roughness: .6}),
    paper: std('paper', {color: '#f7f4ec', roughness: .95}),
    glassFrame: std('glassFrame', {color: '#22363c', roughness: .35, metalness: .6}),
    lampGlow: mat('lampGlow', () => new THREE.MeshStandardMaterial({color: '#fff1d6', emissive: '#ffd59a', emissiveIntensity: 1.6, roughness: .8, side: THREE.DoubleSide})),
    window: mat('window', () => new THREE.MeshBasicMaterial({color: '#ffffff', map: tex.window, toneMapped: true})),
    art: std('art', {color: tex.art ? '#ffffff' : PAL.cream, map: tex.art, roughness: .9}),
    nameplate: std('nameplate', {color: tex.nameplate ? '#ffffff' : PAL.navy, map: tex.nameplate, roughness: .4}),
    book1: std('book1', {color: '#1e5557', roughness: .8}), book2: std('book2', {color: '#d9a35f', roughness: .8}),
    book3: std('book3', {color: '#7d3b2f', roughness: .8}), book4: std('book4', {color: '#e9e2d2', roughness: .8}),
  };

  // ---- geometry helpers -------------------------------------------------------------------------
  const geoCache = new Map();
  /** Beveled box (ExtrudeGeometry of a rounded rectangle), centred, w × h × d, bevel radius r. */
  function rbox(w, h, d, r = .02) {
    const key = [w, h, d, r].map(v => v.toFixed(3)).join(',');
    if (geoCache.has(key)) return geoCache.get(key);
    r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001);
    const sw = w - 2 * r, sd = d - 2 * r, cr = Math.min(r, sw / 2, sd / 2) * .9;
    const s = new THREE.Shape(), x = -sw / 2, y = -sd / 2;
    s.moveTo(x + cr, y); s.lineTo(x + sw - cr, y); s.quadraticCurveTo(x + sw, y, x + sw, y + cr); s.lineTo(x + sw, y + sd - cr);
    s.quadraticCurveTo(x + sw, y + sd, x + sw - cr, y + sd); s.lineTo(x + cr, y + sd); s.quadraticCurveTo(x, y + sd, x, y + sd - cr); s.lineTo(x, y + cr); s.quadraticCurveTo(x, y, x + cr, y);
    const g = new THREE.ExtrudeGeometry(s, {depth: Math.max(.001, h - 2 * r), bevelEnabled: r > .002, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3});
    g.rotateX(-Math.PI / 2); g.center();
    geoCache.set(key, g); return g;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const staticRoot = new THREE.Group(), live = new THREE.Group();
  const add = (parent, geo, m, x, y, z, {rx = 0, ry = 0, rz = 0, cast = true, receive = true} = {}) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    o.castShadow = cast; o.receiveShadow = receive; parent.add(o); return o;
  };
  const piece = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; staticRoot.add(g); return g; };
  const footprints = [];
  const footprint = (collider, g) => footprints.push({collider, group: g});

  const {x0, x1, z0, z1} = PM_ROOM, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;

  // ---- floor, baseboards, walls --------------------------------------------------------------------
  add(staticRoot, box(W, .02, D), M.floor, cx, .006, cz, {cast: false});
  add(staticRoot, box(W, .1, .03), M.trim, cx, .05, z0 + .015);                       // north baseboard
  add(staticRoot, box(.03, .1, D), M.trim, x1 - .015, .05, cz);                        // east baseboard
  // north wall interior: wainscot + cap rail, cream upper, slat feature wall, two framed windows
  const nz = z0 + .02;
  add(staticRoot, rbox(W, .92, .04, .01), M.oak, cx, .46, nz, {cast: false});
  add(staticRoot, rbox(W, .05, .07, .015), M.trim, cx, .94, nz + .01);
  const winA = {x: 13.8, w: 2.5}, winB = {x: 20.55, w: 3.0}, wy0 = 1.05, wy1 = 2.45;
  const upper = (xa, xb, ya = .97, yb = 2.78) => { if (xb - xa > .01) add(staticRoot, box(xb - xa, yb - ya, .03), M.cream, (xa + xb) / 2, (ya + yb) / 2, nz, {cast: false}); };
  upper(x0, winA.x - winA.w / 2); upper(winA.x + winA.w / 2, 15.25); upper(18.75, winB.x - winB.w / 2); upper(winB.x + winB.w / 2, x1);
  for (const win of [winA, winB]) {
    upper(win.x - win.w / 2, win.x + win.w / 2, .97, wy0); upper(win.x - win.w / 2, win.x + win.w / 2, wy1, 2.78);
    add(staticRoot, new THREE.PlaneGeometry(win.w, wy1 - wy0), M.window, win.x, (wy0 + wy1) / 2, nz + .005, {cast: false, receive: false});
    const fy = (wy0 + wy1) / 2, fh = wy1 - wy0;
    for (const dx of [-win.w / 2, win.w / 2]) add(staticRoot, rbox(.07, fh + .1, .08, .015), M.glassFrame, win.x + dx, fy, nz + .03);
    for (const yy of [wy0, wy1]) add(staticRoot, rbox(win.w + .1, .07, .08, .015), M.glassFrame, win.x, yy, nz + .03);
    for (let k = 1; k < 3; k++) add(staticRoot, box(.035, fh, .04), M.glassFrame, win.x - win.w / 2 + k * win.w / 3, fy, nz + .03);
        add(staticRoot, rbox(win.w + .2, .05, .18, .015), M.oak, win.x, wy0 - .03, nz + .09);   // sill
  }
  // walnut slat feature wall behind the desk
  add(staticRoot, box(3.5, 1.81, .02), M.trim, 17, 1.875, nz + .005, {cast: false});
  for (let i = 0; i < 29; i++) add(staticRoot, box(.07, 1.8, .045), M.walnut, 15.32 + i * .12, 1.875, nz + .035);
  // east wall interior
  const ex = x1 - .02;
  add(staticRoot, rbox(.04, .92, D, .01), M.oak, ex, .46, cz, {cast: false});
  add(staticRoot, rbox(.07, .05, D, .015), M.trim, ex - .01, .94, cz);
  add(staticRoot, box(.03, 1.81, D), M.teal, ex, 1.875, cz, {cast: false}); // teal accent wall (concepts 01/04)
  // glass partitions (west and south): slim mullions, top rail, and an oak skin on the lower wall
  for (const zz of [-15.2, -13.2, -11.2, -9.2]) add(staticRoot, box(.05, 1.2, .05), M.glassFrame, 12.1, 1.84, zz);
  add(staticRoot, box(.06, .05, 9), M.glassFrame, 12.1, 2.44, -11.55);
  add(staticRoot, box(.025, 1.2, 9), M.oak, 12.12, .62, -11.55, {cast: false});
  for (const xx of [13.5, 15.0, 19.0, 20.5]) add(staticRoot, box(.05, 1.2, .05), M.glassFrame, xx, 1.84, -7.1);
  for (const [xa, xb] of [[12, 16.1], [17.9, 22]]) {
    add(staticRoot, box(xb - xa, .05, .06), M.glassFrame, (xa + xb) / 2, 2.44, -7.1);
    add(staticRoot, box(xb - xa, 1.2, .025), M.oak, (xa + xb) / 2, .62, -7.12, {cast: false});
  }

  // ---- live sprint board on the slat wall (real task counts) ------------------------------------------
  let board = null;
  {
    const frame = add(live, rbox(2.5, 1.3, .06, .02), M.walnut, 17, 1.8, nz + .09);
    frame.castShadow = false;
    if (hasDom()) {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const face = add(live, new THREE.PlaneGeometry(2.36, 1.16), new THREE.MeshBasicMaterial({map: t, toneMapped: false}), 17, 1.8, nz + .125, {cast: false}); // self-lit screen
      board = {cv, ctx: cv.getContext('2d'), tex: t, face, key: null};
      drawSprintBoard(board.ctx, cv.width, cv.height, null); t.needsUpdate = true;
    }
  }

  // ---- executive desk (collider pm-desk: 2.4 × 1.1 at 17, -11.6) --------------------------------------
  {
    const g = piece(17, -11.6);
    add(g, rbox(2.4, .05, 1.1, .02), M.walnut, 0, .755, 0);
    add(g, rbox(.5, .7, 1.0, .015), M.walnut, -.92, .36, 0);                       // drawer pedestal
    for (let i = 0; i < 3; i++) { add(g, box(.46, .006, .01), M.trim, -.92, .2 + i * .2, .505); add(g, rbox(.14, .018, .025, .006), M.brass, -.92, .27 + i * .2, .52); }
    for (const dz of [-.45, .45]) add(g, rbox(.06, .72, .06, .01), M.metal, 1.1, .36, dz);
    add(g, rbox(.06, .06, .96, .01), M.metal, 1.1, .1, 0);
    add(g, rbox(1.75, .46, .03, .01), M.walnut, .22, .5, .52);                    // modesty panel (visitor side)
    add(g, box(1.75, .02, .035), M.brass, .22, .66, .53);
    // accessories (manager sits on the north side, -z)
    add(g, rbox(.98, .6, .035, .012), M.plastic, .62, 1.08, .2);                    // monitor bezel around the live screen plane
    add(g, rbox(.06, .22, .04, .01), M.metal, .62, .89, .26); add(g, rbox(.3, .015, .2, .006), M.metal, .62, .787, .26);
    add(g, rbox(.46, .02, .15, .006), M.keyboard, 0, .79, -.25); add(g, rbox(.07, .025, .11, .02), M.plastic, .34, .79, -.24);
    add(g, rbox(.34, .012, .24, .004), M.metal, -.62, .786, -.2);                  // laptop base
    add(g, rbox(.34, .22, .01, .004), M.screen, -.62, .9, -.08, {rx: .3});          // laptop lid (open towards the manager)
    add(g, rbox(.2, .015, .27, .004), M.paper, .66, .787, -.18, {ry: .2}); add(g, cyl(.006, .006, .16, 6), M.brass, .7, .797, -.18, {rz: Math.PI / 2, ry: .5});
    add(g, cyl(.045, .04, .1, 16), M.ceramic, -1.05, .83, .2); add(g, new THREE.TorusGeometry(.028, .008, 6, 12, Math.PI), M.ceramic, -1.095, .83, .2, {rz: Math.PI / 2});
    add(g, rbox(.5, .085, .06, .01), M.nameplate, .55, .82, .5, {rx: -.25});        // bilingual-ready nameplate facing visitors
    add(g, cyl(.05, .04, .07, 14), M.terracotta, -.3, .815, .32); add(g, new THREE.IcosahedronGeometry(.055, 1), M.leaf2, -.3, .88, .32);
    // articulated desk lamp
    add(g, cyl(.07, .08, .02, 16), M.metal, 1.0, .785, -.2);
    add(g, cyl(.012, .012, .38, 8), M.metal, 1.0, .97, -.12, {rx: .4}); add(g, cyl(.012, .012, .3, 8), M.metal, 1.0, 1.15, .0, {rx: -.9});
    add(g, new THREE.ConeGeometry(.08, .12, 16, 1, true), M.lampGlow, 1.0, 1.14, .14, {rx: 2.2});
    footprint('pm-desk', g);
  }

  // ---- executive chair (collider pm-desk-chair at 17, -12.6) ------------------------------------------
  const execChair = (x, z, ry) => {
    const g = piece(x, z, ry);
    add(g, rbox(.56, .1, .54, .04), M.leather, 0, .48, .02);
    add(g, rbox(.54, .72, .1, .04), M.leather, 0, .96, -.27, {rx: -.1});
    add(g, rbox(.38, .14, .09, .04), M.leather, 0, 1.4, -.31, {rx: -.12});
    for (const s of [-1, 1]) { add(g, rbox(.06, .04, .36, .015), M.leather, s * .31, .68, .02); add(g, rbox(.03, .18, .03, .01), M.metal, s * .31, .58, .02); }
    add(g, cyl(.035, .035, .3, 10), M.metal, 0, .28, 0);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; add(g, rbox(.3, .03, .045, .01), M.metal, Math.sin(a) * .15, .07, Math.cos(a) * .15, {ry: a + Math.PI / 2}); add(g, new THREE.SphereGeometry(.03, 8, 6), M.plastic, Math.sin(a) * .29, .03, Math.cos(a) * .29); }
    return g;
  };
  footprint('pm-desk-chair', execChair(17, -12.55, 0));

  // ---- visitor chairs (colliders pm-visitor-w/e at 15.6 / 18.4, -10.2), facing the desk ---------------------
  for (const [x, id] of [[15.6, 'pm-visitor-w'], [18.4, 'pm-visitor-e']]) {
    const g = piece(x, -10.2, Math.PI);
    add(g, rbox(.56, .09, .52, .035), M.fabric, 0, .46, 0);
    add(g, rbox(.56, .42, .07, .03), M.fabric, 0, .74, -.25, {rx: -.12});
    for (const [dx, dz] of [[-.23, -.21], [.23, -.21], [-.23, .21], [.23, .21]]) add(g, cyl(.018, .012, .42, 8), M.oak, dx, .21, dz);
    footprint(id, g);
  }

  // ---- lounge corner (colliders pm-lounge-*) ------------------------------------------------------------
  const armchair = (x, z, ry, id) => {
    const g = piece(x, z, ry);
    add(g, rbox(.8, .3, .78, .06), M.fabric2, 0, .3, 0);
    add(g, rbox(.62, .1, .6, .05), M.fabric2, 0, .48, .05);
    add(g, rbox(.8, .5, .16, .06), M.fabric2, 0, .62, -.31);
    for (const s of [-1, 1]) add(g, rbox(.13, .26, .74, .05), M.fabric2, s * .335, .55, .01);
    for (const [dx, dz] of [[-.33, -.31], [.33, -.31], [-.33, .31], [.33, .31]]) add(g, cyl(.02, .015, .15, 8), M.walnut, dx, .075, dz);
    footprint(id, g);
  };
  armchair(13.2, -13.1, 0, 'pm-lounge-chair-n'); armchair(13.2, -10.5, Math.PI, 'pm-lounge-chair-s');
  {
    const g = piece(13.2, -11.8);
    add(g, cyl(.34, .34, .04, 32), M.walnut, 0, .4, 0); add(g, cyl(.035, .035, .36, 10), M.brass, 0, .2, 0); add(g, cyl(.2, .22, .02, 24), M.brass, 0, .01, 0);
    add(g, rbox(.2, .03, .26, .006), M.book1, -.05, .435, .02, {ry: .3}); add(g, cyl(.04, .05, .14, 12), M.ceramic, .14, .49, -.08);
    footprint('pm-lounge-table', g);
  }

  // ---- credenza with books (collider pm-cabinet at 21.3, -12.8) and wall art ---------------------------------
  {
    const g = piece(21.3, -12.8);
    add(g, rbox(.5, .72, 2.4, .02), M.walnut, 0, .38, 0);
    add(g, rbox(.48, .03, 2.36, .01), M.oak, 0, .755, 0);
    for (const dz of [-.6, 0, .6]) { add(g, box(.01, .6, .005), M.trim, -.255, .38, dz); add(g, cyl(.01, .01, .14, 8), M.brass, -.265, .45, dz - .08); }
    const bm = [M.book1, M.book2, M.book3, M.book4]; let z = -1.05;
    for (let i = 0; i < 14; i++) { const t = .035 + ((i * 7) % 5) * .008, h = .2 + ((i * 3) % 4) * .03; add(g, box(.18, h, t), bm[i % 4], -.02, .77 + h / 2, z); z += t + .006; }
    add(g, cyl(.05, .07, .22, 16), M.ceramic, 0, .88, .45); add(g, new THREE.IcosahedronGeometry(.13, 1), M.leaf, 0, 1.06, .45);
    add(g, rbox(.03, .22, .17, .006), M.trim, -.05, .88, .85, {rz: -.12});
    footprint('pm-cabinet', g);
  }
  for (const [zz, w, h] of [[-14.3, .7, .9], [-11.4, .55, .7]]) { add(staticRoot, rbox(.035, h + .08, w + .08, .01), M.trim, ex - .03, 1.7, zz); add(staticRoot, box(.01, h, w), M.art, ex - .055, 1.7, zz, {cast: false}); }
  add(staticRoot, cyl(.2, .2, .04, 32), M.trim, ex - .04, 2.25, -9.2, {rz: Math.PI / 2}); add(staticRoot, cyl(.18, .18, .045, 32), M.ceramic, ex - .05, 2.25, -9.2, {rz: Math.PI / 2});

  // ---- plant (collider pm-plant at 13, -15) ------------------------------------------------------------------
  const leafy = (x, z, id, scale = 1) => {
    const g = piece(x, z); g.scale.setScalar(scale);
    const pot = new THREE.LatheGeometry([[0, 0], [.22, 0], [.27, .05], [.3, .5], [.27, .52], [0, .52]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
    add(g, pot, M.ceramic, 0, 0, 0); add(g, cyl(.27, .27, .02, 24), M.trim, 0, .5, 0);
    add(g, cyl(.025, .035, .9, 8), M.walnut, 0, .9, 0);
    const leafGeo = new THREE.SphereGeometry(.16, 10, 6); leafGeo.scale(1, .18, .55);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, y = .75 + (i % 7) * .14, r = .12 + (i % 3) * .08;
      add(g, leafGeo, i % 2 ? M.leaf : M.leaf2, Math.sin(a) * r, y, Math.cos(a) * r, {ry: a, rz: .5 + (i % 4) * .15, rx: .2});
    }
    footprint(id, g);
  };
  leafy(13, -15, 'pm-plant');
  leafy(21.85, -15.85, 'pm-plant-ne', 1.25); // tall corner plant (concepts show generous greenery)

  // ---- arc floor lamp (collider pm-lamp at 13.4, -8.4) ---------------------------------------------------------
  {
    const g = piece(13.4, -8.4);
    add(g, cyl(.18, .2, .05, 24), M.ceramic, 0, .025, 0);
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(0, .05, 0), new THREE.Vector3(0, 1.9, 0), new THREE.Vector3(-.2, 2.1, .15), new THREE.Vector3(-.35, 1.8, .25)); // arcs into the corner, not over the walkway
    add(g, new THREE.TubeGeometry(curve, 24, .018, 8), M.brass, 0, 0, 0);
    add(g, new THREE.ConeGeometry(.2, .2, 24, 1, true), M.lampGlow, -.35, 1.72, .25);
    footprint('pm-lamp', g);
  }

  // ---- LED cove strips (concepts 01/04): wall tops, slat wall frame, partition rails, desk + credenza underglow --------
  const strip = (w, d, x, y, z, m = M.led) => add(staticRoot, box(w, .025, d), m, x, y, z, {cast: false, receive: false});
  strip(W, .04, cx, 2.77, nz + .03); strip(.04, D, ex - .03, 2.77, cz);
  strip(3.5, .03, 17, .95, nz + .06); strip(3.5, .03, 17, 2.79, nz + .06);
  for (const [xa, xb] of [[12, 16.1], [17.9, 22]]) strip(xb - xa, .03, (xa + xb) / 2, 2.47, -7.1, M.ledMint);
  strip(.03, 9, 12.1, 2.47, -11.55, M.ledMint);
  strip(1.9, .03, 17.22, .2, -11.04);           // desk modesty-panel underglow (visitor side)
  strip(.03, 2.3, 21.03, .05, -12.8);           // credenza toe-kick glow
  // ring pendant light over the desk
  add(staticRoot, new THREE.TorusGeometry(.6, .035, 10, 48), M.led, 17, 2.55, -11.6, {rx: Math.PI / 2, cast: false});
  for (const a of [0, 2.1, 4.2]) add(staticRoot, cyl(.004, .004, .3, 4), M.metal, 17 + Math.cos(a) * .6, 2.72, -11.6 + Math.sin(a) * .6, {cast: false});

  // ---- rug under the visitor area -------------------------------------------------------------------------
  add(staticRoot, rbox(3.8, .012, 2.6, .004), M.rug, 17, .016, -10.05, {cast: false});

  // ---- lights: warm task light over the desk, lamp glow, cool window fill (no extra shadow maps) -------------
  const lights = [];
  const spot = new THREE.SpotLight('#ffd7a3', 16, 9, .7, .9, 2); spot.position.set(17, 3.5, -9.4); spot.target.position.set(17, .7, -12.2);
  lights.push(spot, spot.target); // lamp glow is emissive and window light comes from the env map: no extra per-pixel lights

  // ---- merge static meshes per material (draw-call budget) ---------------------------------------------------
  staticRoot.updateMatrixWorld(true);
  for (const f of footprints) { const b = new THREE.Box3().setFromObject(f.group); f.box = {minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, maxY: b.max.y}; }
  const merged = mergeByMaterial(THREE, staticRoot);
  const group = new THREE.Group(); group.name = 'pm-office-slice'; group.add(merged, live);

  return {
    group, lights, footprints: footprints.map(({collider, box: b}) => ({collider, box: b})), npcSeat: PM_NPC_SEAT,
    stats: () => { let tris = 0, meshes = 0; group.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return {meshes, triangles: Math.round(tris), materials: mats.size}; },
    /** Redraw the sprint board only when the real counts change. */
    update(counts) {
      if (!board) return;
      const key = JSON.stringify(counts || null);
      if (key === board.key) return; board.key = key;
      drawSprintBoard(board.ctx, board.cv.width, board.cv.height, counts || null); board.tex.needsUpdate = true;
    },
  };
}

/** Bake world transforms and merge meshes that share a material (and shadow flags) into one mesh each. */
function mergeByMaterial(THREE, root) {
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, {material: o.material, cast: o.castShadow, receive: o.receiveShadow, parts: []});
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    buckets.get(key).parts.push(g);
  });
  const out = new THREE.Group();
  for (const {material, cast, receive, parts} of buckets.values()) {
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o3 = 0, o2 = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
      o3 += g.attributes.position.count * 3; o2 += g.attributes.position.count * 2;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; m.matrixAutoUpdate = false;
    out.add(m);
  }
  return out;
}

/** Map real task statuses (server/repo.js) to the sprint board's four columns. Unknown statuses are not counted. */
export const BOARD_COLUMNS = Object.freeze({backlog: ['proposed', 'todo'], progress: ['in_progress', 'in_qa', 'rework'], review: ['awaiting_ceo'], done: ['done']});
export function pmBoardCounts(tasks = []) {
  const out = {backlog: 0, progress: 0, review: 0, done: 0};
  for (const t of tasks) for (const [col, sts] of Object.entries(BOARD_COLUMNS)) if (sts.includes(t.status)) out[col]++;
  return out;
}
