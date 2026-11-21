// ATLAS world definition — the single source of truth for scene geometry AND collision.
// Every helper below emits render primitives and, when the object is solid, the matching
// collider in the same call. Renderers and the collision system both read buildWorld(),
// so geometry and colliders cannot drift apart (COS-101 limitation, fixed in COS-102).
// Pure data: no DOM / WebGL, importable from Node tests.

export const COLORS = Object.freeze({
  floor: '#d9ded3', white: '#f8f5ee', mat: '#a6c2b6', wall: '#5c7f83', partition: '#93b7b2',
  trim: '#284c50', steel: '#718a87', brown: '#8d6f56', chair: '#466c70', table: '#b88c67',
  screen: '#214450', glass: '#8ac6bd', gold: '#e7b777', plant: '#3f856b',
});

/** Walkable area (inside the outer walls). */
export const BOUNDS = Object.freeze({minX: -15, maxX: 15, minZ: -11, maxZ: 11});

/** Places the CEO can interact with. `point` is where the employee/screen is; used for range + line of sight. */
export const INTERACTABLES = Object.freeze({
  manager: {x: -10, z: -4, point: {x: -10, z: -3.25}, label: 'Project Manager', arabic: 'مدير المشاريع التقنية', letter: 'M', travel: {x: -10, z: -1.1}},
  director: {x: 10, z: -4, point: {x: 10, z: -3.25}, label: 'Technical Director', arabic: 'المدير التقني', letter: 'D', travel: {x: 10, z: -1.1}},
  board: {x: 0, z: -8.2, point: {x: 0, z: -7.5}, label: 'Operations Center', arabic: 'مركز العمليات', letter: 'O', travel: {x: 0, z: -5.9}},
});

export const SPAWN = Object.freeze({x: 0, z: 7});

export function buildWorld() {
  const primitives = [];   // {shape:'box'|'cyl'|'sphere', ...}
  const colliders = [];    // {id, minX, maxX, minZ, maxZ, sight}
  const prim = (p) => primitives.push(p);
  const boxP = (x, y, z, w, h, d, color) => prim({shape: 'box', x, y, z, w, h, d, color});
  const cylP = (x, y, z, r, h, color) => prim({shape: 'cyl', x, y, z, r, h, color});
  const sphP = (x, y, z, r, color) => prim({shape: 'sphere', x, y, z, r, color});
  /** Collider by centre/size. `sight`: blocks line of sight for interactions (tall walls, not low furniture). */
  const solid = (id, x, z, w, d, sight = false) => colliders.push({id, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, sight});
  /** A visible box that is also a collider of the same footprint. */
  const wall = (id, x, y, z, w, h, d, color, sight = true) => { boxP(x, y, z, w, h, d, color); solid(id, x, z, w, d, sight); };

  const chair = (x, z, facing = 0) => {
    boxP(x, .42, z, .78, .22, .7, COLORS.chair); boxP(x, .85, z + (facing ? -.34 : .34), .80, .75, .13, COLORS.chair);
    for (const dx of [-.26, .26]) for (const dz of [-.22, .22]) boxP(x + dx, .19, z + dz, .08, .34, .08, COLORS.steel);
  };
  const desk = (id, x, z, accent = COLORS.table) => {
    boxP(x, .76, z, 2.65, .15, 1.16, accent);
    for (const dx of [-1.05, 1.05]) for (const dz of [-.39, .39]) boxP(x + dx, .37, z + dz, .13, .65, .13, COLORS.brown);
    boxP(x, 1.24, z - .16, .88, .68, .10, COLORS.screen); boxP(x, 1.33, z - .08, .7, .45, .03, '#6ba6a5');
    boxP(x, .98, z - .1, .07, .2, .07, COLORS.steel); boxP(x, .87, z + .29, .93, .03, .30, '#384f56');
    solid(id, x, z, 2.65, 1.16);
    chair(x, z + 1.2); solid(id + '-chair', x, z + 1.34, .8, .84);
  };
  const plant = (id, x, z, s = 1) => {
    cylP(x, .32 * s, z, .3 * s, .6 * s, COLORS.brown); cylP(x, .65 * s, z, .07 * s, .55 * s, COLORS.plant);
    sphP(x, 1.10 * s, z, .55 * s, COLORS.plant); sphP(x - .25 * s, 1.31 * s, z, .32 * s, '#6f9f77');
    const f = Math.max(.7, .8 * s); solid(id, x, z, f, f);
  };

  // Floor and lobby runner
  boxP(0, -.20, 0, 35, .3, 26, COLORS.floor); boxP(0, -.012, 3, 8, .025, 17, COLORS.white); boxP(0, -.015, -7, 11, .026, 6, COLORS.mat);
  // Outer walls (outside the walkable bounds; bounds clamp keeps the player in)
  boxP(0, 1.0, -12.7, 34, 2.0, .22, COLORS.wall); boxP(-17, 1, 0, .2, 2.0, 25, COLORS.wall); boxP(17, 1, 0, .2, 2.0, 25, COLORS.wall);
  for (let x = -14; x <= 14; x += 3.3) { boxP(x, 1.10, -12.53, 2.4, 1.42, .08, '#8fb6b7'); boxP(x, 1.75, -12.44, 2.42, .07, .09, COLORS.trim); }
  // Office side partitions (tall: they block sight). The floating waist rail from the prototype was removed (COS-102).
  wall('mgr-wall-west', -16, .72, -.9, .2, 1.45, 8, COLORS.partition); wall('mgr-wall-east', -.85, .72, -.9, .2, 1.45, 8, COLORS.partition);
  wall('dir-wall-west', .85, .72, -.9, .2, 1.45, 8, COLORS.partition); wall('dir-wall-east', 16, .72, -.9, .2, 1.45, 8, COLORS.partition);
  // Front partitions; gaps at x ±(6.1..8) and ±(0.85..3.1) are the walkable doors. Glass posts make them sight-blocking.
  wall('mgr-front-a', -11.9, .54, 2.8, 7.8, .9, .13, COLORS.partition); wall('mgr-front-b', -4.6, .54, 2.8, 3.0, .9, .13, COLORS.partition);
  wall('dir-front-a', 4.6, .54, 2.8, 3.0, .9, .13, COLORS.partition); wall('dir-front-b', 11.9, .54, 2.8, 7.8, .9, .13, COLORS.partition);
  for (const x of [-14.9, -12.6, -10.3, -8, -5.7, -3.4, 3.4, 5.7, 8, 10.3, 12.6, 14.9]) boxP(x, 1.10, 2.8, .065, 1.0, .09, COLORS.steel);
  // Office floors
  boxP(-10, -.045, -4, 10, .035, 10, '#d7e8dc'); boxP(10, -.045, -4, 10, .035, 10, '#f0e3d4');
  boxP(-10, -.025, -4, 8.5, .026, 7.7, '#e7eae2'); boxP(10, -.025, -4, 8.5, .026, 7.7, '#eae6df');
  boxP(-10, .007, -5.3, 5, .016, 3.5, '#d2ded6'); boxP(10, .007, -5.3, 5, .016, 3.5, '#ead4bb');
  // Manager office
  desk('mgr-desk', -10.3, -5.4);
  wall('mgr-cabinet', -12.8, .5, -8.3, 1.65, 1.0, .60, '#aac4b7', false); boxP(-12.8, 1.12, -8.3, 1.5, .07, .6, COLORS.table);
  plant('mgr-plant', -14, -2.0); plant('mgr-plant-back', -4, -9.2, .78);
  // Director office
  desk('dir-desk', 10, -5.4, '#9b765a');
  wall('dir-shelf', 13.9, .65, -8.2, .65, 1.3, 3.2, '#c9b8a3', false); boxP(13.87, 1.36, -8.2, .7, .1, 3.2, '#917558');
  plant('dir-plant', 14.5, -2.2); plant('dir-plant-back', 5.2, -9.5, .86);
  // Operations board and benches
  boxP(0, .035, -8.5, 8, .045, 4.9, '#b9cebd'); boxP(0, 1.15, -11.9, 6.5, 2.05, .14, COLORS.trim); boxP(0, 1.25, -11.74, 5.95, 1.5, .06, '#436e70');
  for (let i = 0; i < 5; i++) boxP(-2.3 + i * 1.15, 1.30, -11.69, .8, .06 + .16 * ((i * 7) % 4), .03, i === 3 ? COLORS.gold : COLORS.glass);
  for (const x of [-2.5, 2.5]) wall(x < 0 ? 'ops-bench-west' : 'ops-bench-east', x, .43, -6.9, 1.4, .76, .9, COLORS.brown, false);
  // Arrival lobby
  boxP(0, .05, 7, 5.6, .06, 3.5, '#c2dad1'); for (let i = 0; i < 5; i++) boxP(-2.1 + i * 1.06, .055, 7.95, .40, .02, .09, '#ebeee4');
  plant('lobby-plant-west', -4.5, 7.8, 1.15); plant('lobby-plant-east', 4.5, 7.8, 1.15); cylP(0, .14, 3.85, .9, .12, COLORS.gold);
  // Wayfinding signs
  boxP(-10, 1.67, 2.66, 2.9, .44, .12, COLORS.trim); boxP(10, 1.67, 2.66, 2.9, .44, .12, COLORS.trim);
  // Seated employees occupy space at their desks
  solid('mgr-avatar', -10, -3.25, .82, .6); solid('dir-avatar', 10, -3.25, .82, .6);

  return {primitives, colliders: colliders.map(Object.freeze), bounds: BOUNDS, interactables: INTERACTABLES, spawn: SPAWN};
}

/** NPC placements (rendered dynamically so they can show state). */
export const NPCS = Object.freeze([
  {id: 'manager', x: -10, z: -3.25, coat: '#2a665f', accent: '#213f43'},
  {id: 'director', x: 10, z: -3.25, coat: '#6d5a49', accent: '#344452'},
]);
