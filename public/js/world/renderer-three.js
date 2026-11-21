// Three.js renderer (ADR-001). Builds the office from world-data primitives, adds lighting,
// soft shadows, sliding glass doors, live monitor screens, bilingual signage and animated humanoid characters.
// Animations and screens reflect REAL employee status from the API — nothing pretends to work.
import * as THREE from '../../vendor/three.module.js';
import {createHumanoid, animateHumanoid} from './humanoid.js';
import {presenceFor} from './presence.js';

import {STATUS_COLORS} from '../ui/status-colors.js';
export {STATUS_COLORS};

export function createThreeRenderer(canvas, world, {quality = 'high'} = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias: quality === 'high', alpha: false, powerPreference: 'high-performance'}); }
  catch { return null; }
  const mobile = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft was removed in r18x

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bcd2d3');
  scene.fog = new THREE.Fog('#bcd2d3', 55, 110);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 200);

  // ---- lighting: sky/ground fill + a sun that follows the player for crisp local shadows
  scene.add(new THREE.HemisphereLight('#f3fbff', '#8d7f69', 1.35));
  const sun = new THREE.DirectionalLight('#fff3df', 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80});
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);

  // ---- materials (cached by colour + kind)
  const mats = new Map();
  const material = (color, kind) => {
    const key = color + '|' + (kind || '');
    if (mats.has(key)) return mats.get(key);
    const c = new THREE.Color(color);
    let m;
    switch (kind) {
      case 'glass': m = new THREE.MeshPhysicalMaterial({color: c, transparent: true, opacity: .28, roughness: .08, metalness: 0, depthWrite: false}); break;
      case 'metal': m = new THREE.MeshStandardMaterial({color: c, roughness: .35, metalness: .6}); break;
      case 'wood': m = new THREE.MeshStandardMaterial({color: c, roughness: .62, metalness: 0}); break;
      case 'fabric': m = new THREE.MeshStandardMaterial({color: c, roughness: .95}); break;
      case 'plant': m = new THREE.MeshStandardMaterial({color: c, roughness: .8, flatShading: true}); break;
      case 'emissive': m = new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: .9}); break;
      default: m = new THREE.MeshStandardMaterial({color: c, roughness: .82});
    }
    mats.set(key, m); return m;
  };
  const geo = {box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 20), sphere: new THREE.IcosahedronGeometry(1, 2)};

  // ---- static world
  const statics = new THREE.Group();
  for (const p of world.primitives) {
    const mesh = new THREE.Mesh(geo[p.shape], material(p.color, p.mat));
    mesh.position.set(p.x, p.y, p.z);
    if (p.shape === 'box') mesh.scale.set(p.w, p.h, p.d);
    else if (p.shape === 'cyl') mesh.scale.set(p.r, p.h, p.r);
    else mesh.scale.setScalar(p.r);
    const floorish = p.shape === 'box' && p.h < .05;
    mesh.receiveShadow = true;
    mesh.castShadow = !floorish && p.mat !== 'glass';
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    statics.add(mesh);
  }
  scene.add(statics);

  // ---- sliding glass doors (visual only; the doorway gap is always walkable)
  const doorMat = new THREE.MeshPhysicalMaterial({color: '#bfe8e3', transparent: true, opacity: .35, roughness: .05, depthWrite: false});
  const frameMat = material('#2c4b52', 'metal');
  const doors = world.doors.map(d => {
    const width = d.to - d.from, mid = (d.from + d.to) / 2, half = width / 2;
    const make = sign => {
      const g = new THREE.Group();
      const pane = new THREE.Mesh(geo.box, doorMat); pane.scale.set(d.axis === 'x' ? half : .04, 2.3, d.axis === 'x' ? .04 : half); pane.position.y = 1.15;
      const rail = new THREE.Mesh(geo.box, frameMat); rail.scale.set(d.axis === 'x' ? half : .06, .06, d.axis === 'x' ? .06 : half); rail.position.y = 2.32;
      g.add(pane, rail); scene.add(g); return {g, sign};
    };
    return {d, mid, half, panels: [make(-1), make(1)], open: 0};
  });

  // ---- live monitors: canvas textures redrawn only when the owner's state changes
  const screens = world.screens.map(s => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * s.h / s.w);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({map: tex, toneMapped: false}));
    mesh.position.set(s.x, s.y, s.z); if (s.facing < 0) mesh.rotation.y = Math.PI;
    scene.add(mesh);
    return {...s, cv, ctx: cv.getContext('2d'), tex, key: ''};
  });
  function drawScreen(s, info) {
    const key = JSON.stringify(info);
    if (key === s.key) return; s.key = key;
    const {ctx, cv} = s, w = cv.width, h = cv.height;
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0d2730'); g.addColorStop(1, '#16404a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = info.color || '#77dbcd'; ctx.fillRect(0, 0, w, 6);
    ctx.fillStyle = '#e8fff8'; ctx.font = `bold ${Math.round(h * .16)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText(info.title || '', w / 2, h * .42);
    ctx.fillStyle = info.color || '#9ec9c4'; ctx.font = `${Math.round(h * .12)}px system-ui`;
    ctx.fillText(info.subtitle || '', w / 2, h * .68);
    if (info.bars) { info.bars.forEach((v, i) => { ctx.fillStyle = i % 2 ? '#77dbcd' : '#f6bc7a'; const bw = w / (info.bars.length * 2); ctx.fillRect(bw * (i * 2 + .5), h * .92 - v * h * .2, bw, v * h * .2); }); }
    s.tex.needsUpdate = true;
  }

  // ---- signage (COS-108-D): bilingual canvas textures, drawn once; pylons are two-sided and unmirrored
  for (const sg of world.signs || []) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(96, Math.round(512 * sg.h / sg.w));
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    ctx.fillStyle = '#183c45'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = sg.accent; ctx.fillRect(0, h - 5, w, 5);
    const pad = sg.arrow ? h * .9 : 0;
    ctx.fillStyle = '#f5f1e9'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.font = `700 ${Math.round(h * .42)}px "Segoe UI", Tahoma, "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.fillText(sg.ar, w / 2 + (sg.arrow === 'left' ? pad / 2 : sg.arrow === 'right' ? -pad / 2 : 0), h * .52, w - pad - 20);
    ctx.direction = 'ltr'; ctx.fillStyle = '#9fd3cf'; ctx.font = `600 ${Math.round(h * .2)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(sg.en.toUpperCase(), w / 2 + (sg.arrow === 'left' ? pad / 2 : sg.arrow === 'right' ? -pad / 2 : 0), h * .82, w - pad - 20);
    if (sg.arrow) {
      ctx.fillStyle = sg.accent; ctx.beginPath();
      const cx = sg.arrow === 'left' ? pad * .55 : w - pad * .55, dir = sg.arrow === 'left' ? -1 : 1, s2 = h * .26;
      ctx.moveTo(cx + dir * s2, h * .5); ctx.lineTo(cx - dir * s2 * .6, h * .5 - s2); ctx.lineTo(cx - dir * s2 * .6, h * .5 + s2); ctx.closePath(); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({map: tex, toneMapped: false});
    const front = new THREE.Mesh(new THREE.PlaneGeometry(sg.w, sg.h), mat);
    front.position.set(sg.x, sg.y, sg.z); if (sg.facing < 0) front.rotation.y = Math.PI;
    scene.add(front);
    if (sg.twoSided) { // free-standing pylons: the back shows the same, unmirrored text for people walking the other way
      const back = new THREE.Mesh(new THREE.PlaneGeometry(sg.w, sg.h), mat);
      back.position.set(sg.x, sg.y, sg.z - sg.facing * .08); back.rotation.y = sg.facing < 0 ? 0 : Math.PI;
      scene.add(back);
    }
  }

  // ---- characters
  const player = createHumanoid(THREE, {coat: '#1d5163', accent: '#253a44', skin: '#e1b48d', hair: '#2b2421'});
  scene.add(player.group);
  const npcs = new Map();
  for (const n of world.npcs) {
    const h = createHumanoid(THREE, {coat: n.coat, accent: n.accent, skin: n.skin, hair: '#2b2421'});
    h.group.position.set(n.x, 0, n.z); h.group.rotation.y = n.facing;
    // status beacon above the head
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.16, 0), new THREE.MeshStandardMaterial({color: '#63d9a3', emissive: '#63d9a3', emissiveIntensity: .8}));
    beacon.position.set(0, 2.25, 0); h.group.add(beacon);
    // floor ring in the status colour: readable from the high overview camera too
    const halo = new THREE.Mesh(new THREE.RingGeometry(.48, .62, 32), new THREE.MeshBasicMaterial({color: '#63d9a3', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false}));
    halo.rotation.x = -Math.PI / 2; halo.position.y = .025; h.group.add(halo);
    scene.add(h.group);
    npcs.set(n.id, {...n, h, beacon, halo, yaw: n.facing});
  }

  // ---- interaction ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(.75, .95, 40), new THREE.MeshBasicMaterial({color: '#f6ce86', transparent: true, opacity: .8, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .03; ring.visible = false; scene.add(ring);

  const v = new THREE.Vector3();
  let width = 1, height = 1;
  return {
    kind: 'three',
    render({eye, target, player: p, npcStates = {}, nearby = null, time = 0, dt = 0}) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width !== width || rect.height !== height) {
        width = rect.width; height = rect.height;
        renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
      }
      camera.position.set(eye[0], eye[1], eye[2]); camera.lookAt(target[0], target[1] ?? 1, target[2]); // follow/overview look at y=1; third-person looks at head height
      sun.position.set(p.x - 14, 30, p.z + 10); sun.target.position.set(p.x, 0, p.z);

      // player
      player.group.position.set(p.x, 0, p.z);
      player.yaw = player.yaw ?? p.heading;
      player.yaw += Math.atan2(Math.sin(p.heading - player.yaw), Math.cos(p.heading - player.yaw)) * Math.min(1, dt * 12);
      player.group.rotation.y = player.yaw;
      animateHumanoid(player, {phase: p.walkPhase, moving: p.moving, time, pose: 'stand'});
      // COS-110A: when the third-person camera is pulled in close (wall behind the player), fade the avatar so it
      // never fills the screen. Opacity follows eye distance to the avatar's head.
      const near = Math.hypot(eye[0] - p.x, eye[1] - 1.5, eye[2] - p.z), fade = Math.min(1, Math.max(.18, (near - .7) / 1.3));
      if (fade !== player.fade) {
        player.fade = fade;
        player.group.traverse(o => { if (o.isMesh && o.material?.isMeshStandardMaterial) { const was = o.material.transparent; o.material.transparent = fade < 1; o.material.opacity = fade; o.material.depthWrite = fade >= 1; if (was !== o.material.transparent) o.material.needsUpdate = true; } }); // the floor shadow (MeshBasic) is untouched
      }

      // NPCs follow REAL status only (presence.js); they turn to face the CEO when the CEO is right there.
      const poses = {};
      for (const [id, n] of npcs) {
        const pr = presenceFor(npcStates[id]?.status);
        const color = STATUS_COLORS[pr.status] || STATUS_COLORS.unknown;
        n.beacon.material.color.set(color); n.beacon.material.emissive.set(color);
        n.halo.material.color.set(color);
        // blockers / approvals pulse to draw the CEO's eye; everything else is calm
        const pulse = pr.attention ? .5 + .5 * Math.sin(time * 5) : 0;
        n.beacon.scale.setScalar(1 + pulse * .45); n.beacon.material.emissiveIntensity = .8 + pulse;
        n.halo.material.opacity = pr.status === 'unknown' ? .2 : .45 + pulse * .4;
        const focus = nearby === id ? 1.18 : 1; n.halo.scale.set(focus, focus, focus);
        n.beacon.position.y = 2.25 + (pr.status === 'unknown' ? 0 : Math.sin(time * 2 + n.x) * .05); n.beacon.rotation.y = pr.status === 'unknown' ? 0 : time * 1.5;
        const close = Math.hypot(p.x - n.x, p.z - n.z) < 3.4;
        const want = close && pr.pose !== 'typing' ? Math.atan2(p.x - n.x, p.z - n.z) : n.facing;
        n.yaw += Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw)) * Math.min(1, dt * 4);
        n.h.group.rotation.y = n.yaw;
        animateHumanoid(n.h, {phase: 0, moving: false, time: time + n.x, pose: pr.pose});
        poses[id] = pr.pose;
      }

      // monitors
      for (const s of screens) {
        const st = npcStates[s.owner];
        if (s.owner === 'board') drawScreen(s, npcStates.__board || {title: 'OPERATIONS', subtitle: '—'});
        else if (s.owner === 'meeting') drawScreen(s, npcStates.__meeting || {title: 'MEETING ROOM', subtitle: ''});
        else if (s.owner === 'ceo') drawScreen(s, npcStates.__ceo || {title: 'CEO WORKSPACE', subtitle: 'E'});
        else if (st) drawScreen(s, {title: (st.label || s.owner).toUpperCase(), subtitle: st.statusText || st.status, color: STATUS_COLORS[st.status]});
        else drawScreen(s, {title: 'ATLAS', subtitle: 'idle', color: '#5f7d80'});
      }

      // doors slide open when the player approaches
      for (const door of doors) {
        const cx = door.d.axis === 'x' ? door.mid : door.d.fixed, cz = door.d.axis === 'x' ? door.d.fixed : door.mid;
        const target = Math.hypot(p.x - cx, p.z - cz) < 3 ? 1 : 0;
        door.open += (target - door.open) * Math.min(1, dt * 6);
        for (const {g, sign} of door.panels) {
          const off = sign * (door.half / 2 + door.open * door.half * .92);
          if (door.d.axis === 'x') g.position.set(door.mid + off, 0, door.d.fixed); else g.position.set(door.d.fixed, 0, door.mid + off);
        }
      }

      // interaction ring
      const it = nearby && world.interactables[nearby];
      ring.visible = Boolean(it);
      if (it) { ring.position.x = it.point.x; ring.position.z = it.point.z; const s = 1 + Math.sin(time * 4) * .06; ring.scale.set(s, s, s); }

      renderer.render(scene, camera);
      return {
        width, height, poses,
        project: (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x * .5 + .5) * width, (1 - (v.y * .5 + .5)) * height, v.z < 1]; },
      };
    },
  };
}
