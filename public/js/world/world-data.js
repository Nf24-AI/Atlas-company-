// ATLAS world definition — the single source of truth for scene geometry AND collision (COS-102),
// expanded into the full company floor (COS-107). Every helper emits render primitives and, when
// the object is solid, the matching collider in the same call. Pure data: importable from Node.
//
//   z=-16 ┌──────────────┬───────┬──────────────┬───────┬──────────────┐
//         │ TD office    │       │ Meeting room │       │ PM office    │
//    z=-7 └────[door]────┘       └───[door]─────┘       └────[door]────┘
//           Dev workstations      Operations center      QA lab
//    z=8  ┌────[door]────┐                               ┌ lounge
//         │ CEO office   │        Reception (spawn)      │
//   z=16  └──────────────┘                               └
//         x=-22         x=-12  x=-6               x=6  x=12          x=22

export const COLORS = Object.freeze({
  floor: '#cfd6cc', corridor: '#e4e6dd', wall: '#e9ece6', wallTrim: '#2c4b52', glass: '#9fd3cf', partition: '#93b7b2',
  wood: '#a77d58', woodDark: '#7a573c', steel: '#6f8784', chair: '#38585f', fabric: '#4e6f78', screen: '#0f2b35',
  plant: '#3f856b', leaf: '#6f9f77', pot: '#8d6f56', gold: '#e7b777', carpetCeo: '#c9b9a6', carpetPm: '#bcd3c6', carpetTd: '#d6c7b4',
  carpetMeet: '#b8c9d4', opsFloor: '#b9cebd', devFloor: '#c6d2d8', qaFloor: '#d3cbe0', reception: '#d9e4dc', lounge: '#d8d1c3',
});

export const BOUNDS = Object.freeze({minX: -22, maxX: 22, minZ: -16, maxZ: 16});
const WALL_H = 1.25, GLASS_H = 1.15, T = 0.2;

/** Places the CEO can interact with. `point`: where range and line of sight are measured to. */
export const INTERACTABLES = Object.freeze({
  manager: {x: 17, z: -12.8, point: {x: 17, z: -12.8}, label: 'Project Manager', arabic: 'مدير المشاريع', en: 'Project Manager', letter: 'M', role: 'manager', travel: {x: 17, z: -10.3}},
  director: {x: -17, z: -12.8, point: {x: -17, z: -12.8}, label: 'Technical Director', arabic: 'المدير التقني', en: 'Technical Director', letter: 'D', role: 'director', travel: {x: -17, z: -10.3}},
  developer: {x: -18, z: -0.3, point: {x: -18, z: -0.3}, label: 'Software Developer', arabic: 'مطوّر البرمجيات', en: 'Software Developer', letter: 'S', role: 'developer', travel: {x: -18, z: 2.2}},
  qa: {x: 16, z: -0.3, point: {x: 16, z: -0.3}, label: 'QA Engineer', arabic: 'مهندس الجودة', en: 'QA Engineer', letter: 'Q', role: 'qa', travel: {x: 16, z: 2.2}},
  ceo: {x: -17, z: 12.6, point: {x: -17, z: 12.4}, label: 'CEO Workspace', arabic: 'مكتب الرئيس التنفيذي', en: 'CEO Workspace', letter: 'C', role: 'ceo', travel: {x: -17, z: 10.4}},
  meeting: {x: 0, z: -12, point: {x: 0, z: -10.6}, label: 'Meeting Room', arabic: 'غرفة الاجتماعات', en: 'Meeting Room', letter: 'R', role: 'meeting', travel: {x: 0, z: -8.8}},
  board: {x: 0, z: -2.6, point: {x: 0, z: -2.4}, label: 'Operations Center', arabic: 'مركز العمليات', en: 'Operations Center', letter: 'O', role: 'board', travel: {x: 0, z: -1.0}},
});

/** Room outlines (mini-map + floor zones). */
export const ROOMS = Object.freeze([
  {id: 'director', x0: -22, x1: -12, z0: -16, z1: -7, ar: 'المدير التقني', en: 'Tech Director', walled: true},
  {id: 'meeting', x0: -6, x1: 6, z0: -16, z1: -7, ar: 'الاجتماعات', en: 'Meeting', walled: true},
  {id: 'manager', x0: 12, x1: 22, z0: -16, z1: -7, ar: 'مدير المشاريع', en: 'Project Mgr', walled: true},
  {id: 'developer', x0: -22, x1: -10, z0: -4, z1: 5, ar: 'المطورون', en: 'Developers'},
  {id: 'board', x0: -6, x1: 6, z0: -4, z1: 5, ar: 'العمليات', en: 'Operations'},
  {id: 'qa', x0: 10, x1: 22, z0: -4, z1: 5, ar: 'الجودة', en: 'QA Lab'},
  {id: 'ceo', x0: -22, x1: -12, z0: 8, z1: 16, ar: 'الرئيس التنفيذي', en: 'CEO', walled: true},
  {id: 'reception', x0: -6, x1: 6, z0: 8, z1: 16, ar: 'الاستقبال', en: 'Reception'},
  {id: 'lounge', x0: 12, x1: 22, z0: 8, z1: 16, ar: 'الاستراحة', en: 'Lounge'},
]);

export const SPAWN = Object.freeze({x: 0, z: 14});

/** Room containing (x, z), or null for corridors (entry/exit cues and the HUD location chip). */
export function roomAt(x, z) {
  return ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;
}

/** NPC placements. `facing` is the yaw they look towards when idle. */
export const NPCS = Object.freeze([
  {id: 'director', x: -17, z: -12.8, facing: 0, coat: '#6d5a49', accent: '#2c3a44', skin: '#c99a76'},
  {id: 'manager', x: 17, z: -12.8, facing: 0, coat: '#2a665f', accent: '#1f3a3e', skin: '#d5a982'},
  {id: 'developer', x: -18, z: -0.3, facing: Math.PI, coat: '#3a4f7a', accent: '#1d2838', skin: '#b98563'},
  {id: 'qa', x: 16, z: -0.3, facing: Math.PI, coat: '#7a4a62', accent: '#2d2230', skin: '#e0b48f'},
]);

export function buildWorld() {
  const primitives = [], colliders = [], doors = [], screens = [], signs = [];
  // COS-109: primitives built while `artZone` is set are tagged, so the 3D renderer can replace that room with
  // its art vertical slice. Colliders are unaffected: they are always emitted here, by the same calls.
  let artZone = null;
  const prim = p => primitives.push(artZone ? {...p, zone: artZone} : p);
  const boxP = (x, y, z, w, h, d, color, mat) => prim({shape: 'box', x, y, z, w, h, d, color, ...(mat ? {mat} : {})});
  const cylP = (x, y, z, r, h, color, mat) => prim({shape: 'cyl', x, y, z, r, h, color, ...(mat ? {mat} : {})});
  const sphP = (x, y, z, r, color, mat) => prim({shape: 'sphere', x, y, z, r, color, ...(mat ? {mat} : {})});
  const solid = (id, x, z, w, d, sight = false) => colliders.push({id, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, sight});

  /** Wall run from a to b along one axis, solid lower part + glass upper; gaps are doors. */
  const wallRun = (id, axis, fixed, from, to, gaps = []) => {
    const cuts = [[from, to]];
    for (const [g0, g1] of gaps) {
      const next = [];
      for (const [a, b] of cuts) { if (g1 <= a || g0 >= b) next.push([a, b]); else { if (g0 > a) next.push([a, g0]); if (g1 < b) next.push([g1, b]); } }
      cuts.splice(0, cuts.length, ...next);
      doors.push({id: `${id}-door-${doors.length}`, axis, fixed, from: g0, to: g1});
    }
    cuts.forEach(([a, b], i) => {
      const len = b - a, mid = (a + b) / 2;
      const [x, z, w, d] = axis === 'x' ? [mid, fixed, len, T] : [fixed, mid, T, len];
      boxP(x, WALL_H / 2, z, w, WALL_H, d, COLORS.wall);
      boxP(x, WALL_H + .02, z, w + .02, .05, d + .02, COLORS.wallTrim);
      boxP(x, WALL_H + GLASS_H / 2 + .04, z, axis === 'x' ? w : .05, GLASS_H, axis === 'x' ? .05 : d, COLORS.glass, 'glass');
      solid(`${id}-${i}`, x, z, w, d, true);
    });
  };
  const chair = (x, z, facing) => { // facing: direction the seated person looks (radians, 0 = +z)
    const bx = -Math.sin(facing) * .3, bz = -Math.cos(facing) * .3;
    boxP(x, .45, z, .62, .1, .62, COLORS.chair, 'fabric');
    boxP(x + bx, .82, z + bz, Math.abs(bx) > .1 ? .1 : .62, .66, Math.abs(bz) > .1 ? .1 : .62, COLORS.chair, 'fabric');
    cylP(x, .22, z, .05, .42, COLORS.steel, 'metal'); cylP(x, .03, z, .3, .04, COLORS.steel, 'metal');
  };
  /** Desk centred at (x,z); `screenFacing` 1 = screen faces +z viewers, -1 = faces -z. */
  const desk = (id, x, z, {w = 2.4, d = 1.1, wood = COLORS.wood, screenFacing = -1, screenOwner = null, chairSide = -1} = {}) => {
    boxP(x, .76, z, w, .08, d, wood, 'wood');
    for (const dx of [-w / 2 + .1, w / 2 - .1]) boxP(x + dx, .37, z, .08, .72, d - .1, COLORS.woodDark, 'wood');
    const sz = z + (screenFacing > 0 ? -.2 : .2) * 1;
    boxP(x, 1.18, sz, .95, .58, .05, '#1b2b31', 'metal');
    const scr = {id: id + '-screen', x, y: 1.18, z: sz + screenFacing * .03, w: .86, h: .5, facing: screenFacing, owner: screenOwner};
    screens.push(scr);
    boxP(x, .9, sz, .06, .2, .06, COLORS.steel, 'metal');
    boxP(x, .815, z + screenFacing * .15, .5, .02, .16, '#2d3b40');
    solid(id, x, z, w, d);
    if (chairSide) { chair(x, z + chairSide * .95, chairSide > 0 ? Math.PI : 0); solid(id + '-chair', x, z + chairSide * 1.0, .66, .6); }
  };
  const plant = (id, x, z, s = 1) => {
    cylP(x, .3 * s, z, .28 * s, .6 * s, COLORS.pot); cylP(x, .7 * s, z, .05 * s, .5 * s, COLORS.plant);
    sphP(x, 1.1 * s, z, .5 * s, COLORS.plant, 'plant'); sphP(x - .22 * s, 1.32 * s, z + .1, .3 * s, COLORS.leaf, 'plant'); sphP(x + .2 * s, 1.28 * s, z - .1, .28 * s, COLORS.leaf, 'plant');
    solid(id, x, z, .7 * s, .7 * s);
  };
  const rug = (x, z, w, d, color) => boxP(x, .006, z, w, .012, d, color, 'fabric');
  const zone = r => boxP((r.x0 + r.x1) / 2, -.005, (r.z0 + r.z1) / 2, r.x1 - r.x0, .01, r.z1 - r.z0, r.color);
  /** Text sign (COS-108-D), Arabic first. `facing`: +1 faces +z viewers, -1 faces -z. Free-standing signs are two-sided. */
  const sign = (id, x, y, z, w, h, ar, en, {facing = 1, arrow = null, accent = COLORS.gold, twoSided = false} = {}) =>
    signs.push({id, x, y, z, w, h, ar, en, facing, arrow, accent, twoSided});
  /** Free-standing wayfinding pylon: post + panel, solid footprint like any furniture. */
  const pylon = (id, x, z, ar, en, opts = {}) => {
    boxP(x, .85, z, .12, 1.7, .12, COLORS.wallTrim, 'metal'); boxP(x, .03, z, .5, .06, .5, COLORS.wallTrim, 'metal');
    boxP(x, 1.78, z, (opts.w || 2) + .08, .66, .05, COLORS.wallTrim);
    sign(id, x, 1.78, z + .035, opts.w || 2, .58, ar, en, {...opts, twoSided: true});
    solid(id, x, z, .5, .5);
  };
  /** Small emissive desk/floor lamp: an ambient light cue without an extra real-time light. */
  const lamp = (id, x, z, {floor = false, y = .8} = {}) => {
    if (floor) { cylP(x, .75, z, .04, 1.5, COLORS.steel, 'metal'); cylP(x, .03, z, .22, .05, COLORS.steel, 'metal'); sphP(x, 1.55, z, .2, '#ffe6b8', 'emissive'); solid(id, x, z, .45, .45); }
    else { cylP(x, y + .17, z, .02, .34, COLORS.steel, 'metal'); sphP(x, y + .36, z, .08, '#ffe6b8', 'emissive'); }
  };
  const mug = (x, y, z, color = '#e9ece6') => cylP(x, y + .06, z, .045, .12, color);

  // ---- floor slab, zones, outer walls
  boxP(0, -.16, 0, 46, .3, 34, COLORS.floor);
  for (const r of [{x0: -22.4, x1: -12, z0: -16.4, z1: -7, color: COLORS.carpetTd}, {x0: -6, x1: 6, z0: -16.4, z1: -7, color: COLORS.carpetMeet}, {x0: 12, x1: 22.4, z0: -16.4, z1: -7, color: COLORS.carpetPm, art: 'pm'},
    {x0: -22.4, x1: -9.5, z0: -4.5, z1: 5.5, color: COLORS.devFloor}, {x0: -6.5, x1: 6.5, z0: -4.5, z1: 5.5, color: COLORS.opsFloor}, {x0: 9.5, x1: 22.4, z0: -4.5, z1: 5.5, color: COLORS.qaFloor},
    {x0: -22.4, x1: -12, z0: 8, z1: 16.4, color: COLORS.carpetCeo}, {x0: -6.5, x1: 6.5, z0: 8, z1: 16.4, color: COLORS.reception}, {x0: 12, x1: 22.4, z0: 8, z1: 16.4, color: COLORS.lounge}]) { artZone = r.art || null; zone(r); artZone = null; }
  boxP(0, .004, 6.8, 46, .008, 2.2, COLORS.corridor); boxP(0, .004, -5.8, 46, .008, 2.2, COLORS.corridor);
  boxP(0, 1.4, -16.7, 46, 2.8, .3, COLORS.wallTrim); boxP(-22.7, 1.4, 0, .3, 2.8, 34, COLORS.wallTrim); boxP(22.7, 1.4, 0, .3, 2.8, 34, COLORS.wallTrim);
  for (let x = -20; x <= 20; x += 4) { artZone = x >= 16 ? 'pm' : null; boxP(x, 1.6, -16.53, 3.2, 1.6, .05, '#8fc2c9', 'glass'); artZone = null; } // windows on the north facade
  boxP(-14, .6, 16.7, 18, 1.2, .3, COLORS.wallTrim); boxP(14, .6, 16.7, 18, 1.2, .3, COLORS.wallTrim); // south facade, entrance gap x∈[-5,5]
  boxP(0, .02, 16.4, 10, .04, .6, COLORS.gold, 'metal');

  // ---- walled rooms (sight-blocking)
  wallRun('td-east', 'z', -12, -16, -7); wallRun('td-south', 'x', -7, -22, -12, [[-17.9, -16.1]]);
  wallRun('meet-west', 'z', -6, -16, -7); wallRun('meet-east', 'z', 6, -16, -7); wallRun('meet-south', 'x', -7, -6, 6, [[-1, 1]]);
  wallRun('pm-west', 'z', 12, -16, -7); wallRun('pm-south', 'x', -7, 12, 22, [[16.1, 17.9]]);
  wallRun('ceo-east', 'z', -12, 8, 16); wallRun('ceo-north', 'x', 8, -22, -12, [[-17.9, -16.1]]);
  // room signs above the doors (COS-108-D: legible bilingual text, Arabic first)
  for (const [id, x, ar, en] of [['td', -17, 'المدير التقني', 'Technical Director'], ['meet', 0, 'غرفة الاجتماعات', 'Meeting Room'], ['pm', 17, 'مدير المشاريع', 'Project Manager']]) {
    boxP(x, 2.2, -6.86, 2.5, .56, .06, COLORS.wallTrim); sign(`sign-${id}`, x, 2.2, -6.82, 2.4, .5, ar, en);
  }
  boxP(-17, 2.2, 7.86, 2.5, .56, .06, COLORS.wallTrim); sign('sign-ceo', -17, 2.2, 7.82, 2.4, .5, 'مكتب الرئيس التنفيذي', 'CEO Office', {facing: -1});

  // ---- Technical Director office
  desk('td-desk', -17, -11.6, {wood: '#8a6448', screenFacing: -1, screenOwner: 'director', chairSide: -1});
  boxP(-21.3, .9, -12, .5, 1.8, 3.6, '#c9b8a3', 'wood'); solid('td-shelf', -21.3, -12, .5, 3.6);
  for (let i = 0; i < 4; i++) boxP(-21.05, .45 + i * .42, -12, .06, .3, 3.2, ['#7d9aa1', '#d8b07a', '#9fb7a3', '#c3a07c'][i]);
  boxP(-17, 1.6, -15.95, 3, 1.4, .06, '#f4f4ef'); boxP(-17, 1.6, -15.9, 2.6, 1.1, .02, '#d8e6e3'); // whiteboard
  plant('td-plant', -13, -15, .9); rug(-17, -10.2, 3.2, 2, '#b6a38f');
  // architecture sketch on the whiteboard + visitor chairs + reading lamp
  for (const [dx, dy, c] of [[-.8, .25, '#77b8f0'], [0, .25, '#77dbcd'], [.8, .25, '#f6bc7a'], [-.4, -.2, '#b59cf5'], [.4, -.2, '#9be37c']]) boxP(-17 + dx, 1.6 + dy, -15.88, .5, .26, .015, c);
  boxP(-17, 1.6, -15.875, 1.7, .025, .01, '#2c4b52'); boxP(-17, 1.6, -15.875, .025, .5, .01, '#2c4b52');
  for (const x of [-18.4, -15.6]) { chair(x, -10.2, Math.PI); solid(`td-visitor-${x < -17 ? 'w' : 'e'}`, x, -10.2, .66, .6); }
  lamp('td-lamp', -13.4, -8.4, {floor: true}); lamp('td-desk-lamp', -15.95, -11.75);

  // ---- Meeting room
  boxP(0, .74, -12, 5.2, .08, 2.2, '#efeae0', 'wood'); for (const dx of [-2.2, 2.2]) boxP(dx, .37, -12, .1, .72, 1.8, COLORS.steel, 'metal');
  solid('meet-table', 0, -12, 5.2, 2.2);
  for (const dx of [-1.6, 0, 1.6]) { chair(dx, -13.6, 0); chair(dx, -10.4, Math.PI); }
  solid('meet-chairs-n', 0, -13.65, 4.4, .6); solid('meet-chairs-s', 0, -10.35, 4.4, .6);
  boxP(0, 1.55, -15.9, 4.2, 1.5, .08, '#162a31', 'metal');
  screens.push({id: 'meet-screen', x: 0, y: 1.55, z: -15.84, w: 3.9, h: 1.3, facing: 1, owner: 'meeting'});
  plant('meet-plant-w', -5.2, -15.2, .8); plant('meet-plant-e', 5.2, -15.2, .8);
  cylP(0, .8, -12, .26, .04, '#1b2b31', 'metal'); for (const dx of [-1.6, 0, 1.6]) for (const dz of [-.65, .65]) mug(dx, .78, -12 + dz, '#cfe9e1');

  // ---- Project Manager office (COS-109 art vertical slice in the 3D renderer: see office-pm.js)
  artZone = 'pm';
  desk('pm-desk', 17, -11.6, {screenFacing: -1, screenOwner: 'manager', chairSide: -1});
  boxP(21.3, .55, -12.8, .5, 1.1, 2.4, '#aac4b7', 'wood'); solid('pm-cabinet', 21.3, -12.8, .5, 2.4);
  boxP(17, 1.6, -15.95, 3.4, 1.4, .06, '#f4f4ef'); // kanban board
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) boxP(15.8 + c * 1.2, 1.95 - r * .35, -15.9, .5, .22, .02, ['#f6d27a', '#9fd3cf', '#f0a8a0'][(c + r) % 3]);
  plant('pm-plant', 13, -15, .9); rug(17, -10.2, 3.2, 2, '#a7c3b5');
  for (const x of [15.6, 18.4]) { chair(x, -10.2, Math.PI); solid(`pm-visitor-${x < 17 ? 'w' : 'e'}`, x, -10.2, .66, .6); }
  lamp('pm-lamp', 13.4, -8.4, {floor: true}); lamp('pm-desk-lamp', 18.05, -11.75); mug(15.95, .8, -11.4);
  // COS-109 lounge corner: two armchairs facing each other across a low table
  chair(13.2, -13.1, 0); chair(13.2, -10.5, Math.PI); cylP(13.2, .38, -11.8, .34, .06, COLORS.wood, 'wood'); cylP(13.2, .18, -11.8, .05, .34, COLORS.steel, 'metal');
  solid('pm-lounge-chair-n', 13.2, -13.1, .8, .8); solid('pm-lounge-chair-s', 13.2, -10.5, .8, .8); solid('pm-lounge-table', 13.2, -11.8, .72, .72);
  artZone = null;

  // ---- Developer workstations (open plan, low partitions)
  desk('dev-desk-1', -18, -1.5, {wood: '#b08a66', screenFacing: 1, screenOwner: 'developer', chairSide: 1});
  desk('dev-desk-2', -13.5, -1.5, {wood: '#b08a66', screenFacing: 1, screenOwner: 'developer-2', chairSide: 1});
  boxP(-15.75, .55, -2.4, 7.4, 1.1, .08, COLORS.partition); solid('dev-partition', -15.75, -2.4, 7.4, .12);
  boxP(-21.6, 1.1, 1, .08, 1.6, 3, '#f4f4ef'); // dev whiteboard on west wall
  plant('dev-plant', -21, 4.4, .9);
  for (let i = 0; i < 6; i++) boxP(-21.55, 1.45 - Math.floor(i / 3) * .35, .2 + (i % 3) * .75, .015, .24, .3, ['#f6d27a', '#9fd3cf', '#f0a8a0'][i % 3]); // sprint notes
  for (const x of [-18, -13.5]) { lamp(`dev-lamp-${x}`, x - 1.05, -1.65); mug(x + .85, .8, -1.25, '#2d7168'); }
  pylon('sign-dev', -9.6, 5, 'المطورون', 'Developers', {w: 1.9});

  // ---- Operations center: video wall + round table
  boxP(0, 1.5, -3.6, 6.4, 2.4, .25, '#13262d', 'metal'); solid('ops-wall', 0, -3.6, 6.4, .3);
  screens.push({id: 'ops-screen', x: 0, y: 1.6, z: -3.46, w: 6, h: 2, facing: 1, owner: 'board'});
  cylP(0, .74, 1.4, 1.3, .08, '#e9e4d8', 'wood'); cylP(0, .37, 1.4, .18, .72, COLORS.steel, 'metal'); solid('ops-table', 0, 1.4, 2.4, 2.4);
  for (const x of [-4.6, 4.6]) { boxP(x, .5, -1.5, 1.2, 1, .7, COLORS.woodDark, 'wood'); boxP(x, 1.02, -1.5, 1, .02, .5, '#1d4a52', 'emissive'); solid(`ops-console-${x < 0 ? 'w' : 'e'}`, x, -1.5, 1.2, .7); }
  boxP(0, 2.98, -3.6, 4.2, .56, .2, COLORS.wallTrim); sign('sign-ops', 0, 2.98, -3.48, 4, .5, 'مركز العمليات', 'Operations Center');
  cylP(0, .004, 1.4, 2.1, .006, '#a7c2b2', 'fabric');

  // ---- QA lab
  desk('qa-desk-1', 16, -1.5, {wood: '#9f8fb5', screenFacing: 1, screenOwner: 'qa', chairSide: 1});
  boxP(20.8, 1, -1.5, .9, 2, 2.4, '#2c3238', 'metal'); solid('qa-rack', 20.8, -1.5, .9, 2.4);
  for (let i = 0; i < 6; i++) boxP(20.33, .35 + i * .3, -1.5, .02, .08, 2, i % 2 ? '#63d9a3' : '#77dbcd', 'emissive');
  boxP(12.5, .5, -1.5, 1.4, 1, .8, '#d9d4e6', 'wood'); solid('qa-bench', 12.5, -1.5, 1.4, .8);
  plant('qa-plant', 21, 4.4, .9);
  for (const [dx, c] of [[-.45, '#77dbcd'], [0, '#63d9a3'], [.45, '#f6d27a']]) { boxP(12.5 + dx, 1.03, -1.5, .16, .03, .28, '#1b2b31', 'metal'); boxP(12.5 + dx, 1.05, -1.5, .12, .01, .22, c, 'emissive'); } // test devices
  lamp('qa-desk-lamp', 14.95, -1.65);
  pylon('sign-qa', 9.6, 5, 'مختبر الجودة', 'QA Lab', {w: 1.9});

  // ---- CEO office
  desk('ceo-desk', -17, 12.6, {w: 2.9, d: 1.2, wood: '#6e4b33', screenFacing: 1, screenOwner: 'ceo', chairSide: 1});
  boxP(-21.3, .9, 12, .5, 1.8, 3.6, '#7a5a42', 'wood'); solid('ceo-shelf', -21.3, 12, .5, 3.6);
  boxP(-14, .4, 15.2, 2.6, .5, .9, '#4b5d63', 'fabric'); boxP(-14, .75, 15.6, 2.6, .5, .2, '#4b5d63', 'fabric'); solid('ceo-sofa', -14, 15.3, 2.6, 1);
  plant('ceo-plant', -13, 9, 1); rug(-17, 11, 4, 2.4, '#b49a7f');
  boxP(-22.52, 1.6, 9.7, .04, 1.05, 1.6, '#2c4b52'); boxP(-22.49, 1.6, 9.7, .02, .9, 1.45, '#d9b98a', 'fabric'); // framed company map
  lamp('ceo-lamp', -21.1, 15.3, {floor: true}); lamp('ceo-desk-lamp', -15.75, 12.75); mug(-18.1, .8, 12.4, '#e7b777');
  pylon('sign-ceo-way', -14.6, 7.2, 'مكتب الرئيس التنفيذي', 'CEO Office', {w: 2.3, arrow: 'left'});

  // ---- Reception
  boxP(0, .55, 10.6, 4.4, 1.1, .9, '#e9e4d8', 'wood'); boxP(0, 1.13, 10.6, 4.6, .06, 1.1, COLORS.woodDark, 'wood'); solid('reception-desk', 0, 10.6, 4.4, .9);
  boxP(0, 2.1, 8.6, 4, .7, .1, COLORS.wallTrim); // ATLAS sign
  sign('sign-atlas', 0, 2.1, 8.67, 3.8, .62, 'أطلس · الاستقبال', 'ATLAS · Reception');
  pylon('way-west', -6.8, 8.7, 'المطورون · المدير التقني', 'Developers · Tech Director', {w: 2.5, arrow: 'left'});
  pylon('way-east', 6.8, 8.7, 'الجودة · مدير المشاريع', 'QA Lab · Project Manager', {w: 2.5, arrow: 'right'});
  plant('rec-plant-w', -5, 15.2, 1.15); plant('rec-plant-e', 5, 15.2, 1.15);
  rug(0, 13.8, 5, 3, '#c2dad1');

  // ---- Lounge
  boxP(17, .4, 14.8, 3.4, .5, 1, '#5a7a83', 'fabric'); boxP(17, .78, 15.25, 3.4, .55, .2, '#5a7a83', 'fabric'); solid('lounge-sofa', 17, 14.9, 3.4, 1.1);
  cylP(17, .3, 12.6, .7, .06, '#e9e4d8', 'wood'); cylP(17, .15, 12.6, .08, .3, COLORS.steel, 'metal'); solid('lounge-table', 17, 12.6, 1.3, 1.3);
  plant('lounge-plant-1', 21, 9, 1.1); plant('lounge-plant-2', 13, 15.3, .9);
  boxP(21.5, .5, 12.6, .7, 1, 1.4, '#d8d1c3', 'wood'); boxP(21.5, 1.2, 12.4, .45, .4, .4, '#2c3238', 'metal'); mug(21.5, 1, 12.95); solid('lounge-coffee', 21.5, 12.6, .7, 1.4);
  pylon('sign-lounge', 12.6, 8.7, 'الاستراحة', 'Lounge', {w: 1.6});

  // Seated employees occupy space at their desks.
  for (const n of NPCS) solid(`${n.id}-avatar`, n.x, n.z, .7, .55);

  return {primitives, colliders: colliders.map(Object.freeze), doors, screens, signs, bounds: BOUNDS, interactables: INTERACTABLES, rooms: ROOMS, spawn: SPAWN, npcs: NPCS};
}
