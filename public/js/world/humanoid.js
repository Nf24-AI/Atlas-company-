// Procedural low-poly humanoid (original, no external assets) with jointed limbs for walk,
// idle, typing, thinking, reading, talking, waiting, done, blocked and unknown poses. Animation is driven by real movement
// (walk phase advances with distance) and real employee status.
export function createHumanoid(THREE, {coat, accent, skin, hair}) {
  const M = c => new THREE.MeshStandardMaterial({color: c, roughness: .75});
  const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
  const cap = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.castShadow = true; return m; };
  const coatM = M(coat), accentM = M(accent), skinM = M(skin), hairM = M(hair), shoeM = M('#1d2326');
  const group = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = .92; group.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = box(.5, .62, .28, coatM); chest.position.y = .34; torso.add(chest);
  const collar = box(.3, .08, .3, accentM); collar.position.y = .67; torso.add(collar);
  const neck = new THREE.Group(); neck.position.y = .72; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 18, 14), skinM); head.position.y = .16; head.castShadow = true; neck.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * .55), hairM); hairCap.position.y = .18; neck.add(hairCap);
  const limb = (x, y, upper, lower, r, mat, endMat) => {
    const root = new THREE.Group(); root.position.set(x, y, 0);
    const a = cap(r, upper, mat); a.position.y = -upper / 2 - r * .4; root.add(a);
    const joint = new THREE.Group(); joint.position.y = -upper - r * .6; root.add(joint);
    const b = cap(r * .9, lower, mat); b.position.y = -lower / 2 - r * .3; joint.add(b);
    const end = endMat ? box(r * 2.2, .08, r * 3.2, endMat) : new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), skinM);
    end.position.set(0, -lower - r * .7, endMat ? r * .6 : 0); joint.add(end);
    return {root, joint};
  };
  const armL = limb(-.33, .62, .26, .24, .075, coatM), armR = limb(.33, .62, .26, .24, .075, coatM);
  torso.add(armL.root, armR.root);
  const legL = limb(-.13, 0, .4, .38, .09, accentM, shoeM), legR = limb(.13, 0, .4, .38, .09, accentM, shoeM);
  hips.add(legL.root, legR.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.42, 24), new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: .16, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; group.add(shadow);
  return {group, hips, torso, neck, armL, armR, legL, legR, blend: 0};
}

export function animateHumanoid(h, {phase = 0, moving = false, time = 0, pose = 'stand'}) {
  h.blend += ((moving ? 1 : 0) - h.blend) * .2;
  const s = Math.sin(phase), c = Math.cos(phase), w = h.blend;
  const breathe = Math.sin(time * 1.8) * .012;
  // walk cycle
  h.legL.root.rotation.x = s * .62 * w; h.legR.root.rotation.x = -s * .62 * w;
  h.legL.joint.rotation.x = Math.max(0, -c) * .7 * w; h.legR.joint.rotation.x = Math.max(0, c) * .7 * w;
  h.hips.position.y = .92 + Math.abs(c) * .045 * w + breathe;
  h.torso.rotation.y = s * .08 * w;
  let aL = -s * .5 * w, aR = s * .5 * w, eL = -.15 - .25 * w, eR = -.15 - .25 * w, lean = .04 * w, nod = 0, turn = 0;
  if (!moving) {
    if (pose === 'typing') { aL = aR = -1.05; eL = eR = -.55 + Math.sin(time * 14) * .08; eR = -.55 + Math.sin(time * 14 + 1.7) * .08; lean = .12; nod = .18; }
    else if (pose === 'thinking') { aR = -1.5; eR = -1.9; aL = .05; nod = .12 + Math.sin(time * .9) * .05; turn = Math.sin(time * .5) * .2; }
    else if (pose === 'talking') { aR = -.5 + Math.sin(time * 3) * .25; eR = -.8; aL = -.2 + Math.sin(time * 2.3) * .1; nod = Math.sin(time * 4) * .06; }
    else if (pose === 'blocked') { aL = aR = .1; eL = eR = -.1; nod = .35; lean = -.02; }
    else if (pose === 'reading') { aL = aR = -.75; eL = eR = -1.15; nod = .32 + Math.sin(time * .7) * .03; turn = Math.sin(time * .35) * .12; } // reviewing a document
    else if (pose === 'waiting') { // awaiting the CEO: hand raised briefly every few seconds, otherwise hands clasped
      const wave = Math.max(0, Math.sin(time * 1.3)) ** 6;
      aL = -.35; eL = -.9; aR = -.35 - wave * 2.3; eR = -.9 + wave * .6; nod = -.05;
    }
    else if (pose === 'done') { aL = aR = .25; eL = eR = -2.1; lean = -.03; nod = -.06; } // hands on hips, upright
    else if (pose === 'unknown') { aL = aR = 0; eL = eR = -.05; } // no data: neutral, no "busy" motion
    else { aL = .06 + breathe * 2; aR = -.06 - breathe * 2; eL = eR = -.12; turn = pose === 'idle' ? Math.sin(time * .4) * .25 : 0; } // idle glances around

  }
  h.armL.root.rotation.x = aL; h.armR.root.rotation.x = aR;
  h.armL.joint.rotation.x = eL; h.armR.joint.rotation.x = eR;
  h.torso.rotation.x = lean; h.neck.rotation.x = nod; h.neck.rotation.y = turn;
}

// ---- COS-109: detailed humanoid for the art vertical slice --------------------------------------
// Same rig (hips, torso, neck, armL/R, legL/R with root + joint) as createHumanoid, so animateHumanoid
// and every status pose work unchanged. Adds believable proportions (≈1.97 m to match the player avatar, head ≈ 1/7.5), a tailored
// blazer with lapels over a shirt, trousers, hands with thumbs, shoes, a face (eyes, brows, nose, ears)
// and styled hair. Original procedural geometry; no external assets.
export function createHumanoidHQ(THREE, {coat = '#2a665f', shirt = '#eef1ec', trousers = '#22343a', skin = '#d5a982', hair = '#2b2421', accent = '#d9a35f', envMap = null} = {}) {
  const M = (c, rough = .7, extra = {}) => new THREE.MeshStandardMaterial({color: c, roughness: rough, envMap, envMapIntensity: .5, ...extra});
  const coatM = M(coat, .78), shirtM = M(shirt, .85), trouserM = M(trousers, .8), skinM = M(skin, .55), hairM = M(hair, .6), shoeM = M('#1a1d1f', .35), darkM = M('#1b1f22', .4), accentM = M(accent, .35, {metalness: .6});
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
  const cap = (r, len, m, rs = 12) => mesh(new THREE.CapsuleGeometry(r, len, 6, rs), m);
  const group = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = .94; group.add(hips);
  // pelvis + belt
  const pelvis = mesh(new THREE.CylinderGeometry(.165, .15, .2, 16), trouserM); pelvis.scale.z = .72; hips.add(pelvis);
  const belt = mesh(new THREE.CylinderGeometry(.168, .168, .045, 16), darkM); belt.scale.z = .73; belt.position.y = .09; hips.add(belt);
  const buckle = mesh(new THREE.BoxGeometry(.05, .035, .015), accentM); buckle.position.set(0, .09, .124); hips.add(buckle);
  const torso = new THREE.Group(); torso.position.y = .1; hips.add(torso);
  // shirt core + blazer shell (slightly wider at the shoulders), open front showing the shirt
  const shirtCore = cap(.15, .3, shirtM); shirtCore.position.y = .3; shirtCore.scale.set(1.05, 1, .7); torso.add(shirtCore);
  for (const side of [-1, 1]) {
    const panel = mesh(new THREE.BoxGeometry(.17, .5, .2), coatM); panel.position.set(side * .1, .3, -.005); torso.add(panel);
    const lapel = mesh(new THREE.BoxGeometry(.055, .24, .02), coatM); lapel.position.set(side * .055, .43, .105); lapel.rotation.z = side * .32; torso.add(lapel);
  }
  const back = mesh(new THREE.BoxGeometry(.36, .5, .05), coatM); back.position.set(0, .3, -.085); torso.add(back);
  const shoulders = cap(.075, .3, coatM); shoulders.rotation.z = Math.PI / 2; shoulders.position.y = .53; shoulders.scale.z = 1.3; torso.add(shoulders);
  const hem = mesh(new THREE.BoxGeometry(.36, .07, .22), coatM); hem.position.y = .06; torso.add(hem);
  for (const y of [.24, .14]) { const b = mesh(new THREE.SphereGeometry(.012, 8, 6), darkM); b.position.set(.03, y, .108); torso.add(b); }
  const pocket = mesh(new THREE.BoxGeometry(.07, .012, .012), accentM); pocket.position.set(-.1, .42, .102); torso.add(pocket); // pocket square accent
  const collar = mesh(new THREE.CylinderGeometry(.06, .07, .06, 14), shirtM); collar.position.y = .6; torso.add(collar);
  // neck + head
  const neck = new THREE.Group(); neck.position.y = .63; torso.add(neck);
  const neckM = cap(.05, .05, skinM); neckM.position.y = .03; neck.add(neckM);
  const head = mesh(new THREE.SphereGeometry(.112, 24, 18), skinM); head.scale.set(.92, 1.08, 1); head.position.y = .17; neck.add(head);
  const jaw = mesh(new THREE.SphereGeometry(.085, 16, 12), skinM); jaw.scale.set(1, .7, .95); jaw.position.set(0, .105, .02); neck.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(.018, .045, 8), skinM); nose.rotation.x = Math.PI / 2; nose.position.set(0, .16, .115); neck.add(nose);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(.014, 10, 8), darkM); eye.position.set(side * .038, .19, .095); neck.add(eye);
    const brow = mesh(new THREE.BoxGeometry(.04, .009, .01), hairM); brow.position.set(side * .04, .215, .1); brow.rotation.z = -side * .12; neck.add(brow);
    const ear = mesh(new THREE.SphereGeometry(.024, 10, 8), skinM); ear.scale.set(.5, 1, .8); ear.position.set(side * .103, .17, 0); neck.add(ear);
  }
  // hair: a cap tilted back (covers crown and back of the head, leaves the forehead), a soft side-swept fringe
  const hairCap = mesh(new THREE.SphereGeometry(.123, 24, 16, 0, Math.PI * 2, 0, Math.PI * .62), hairM); hairCap.scale.set(.95, 1.06, 1.04); hairCap.rotation.x = -.55; hairCap.position.set(0, .18, -.006); neck.add(hairCap);
  const fringe = mesh(new THREE.SphereGeometry(.07, 14, 8), hairM); fringe.scale.set(1.45, .38, .8); fringe.position.set(.02, .262, .06); fringe.rotation.set(-.4, 0, -.18); neck.add(fringe);
  // arms: sleeve upper/lower, shirt cuff, hand with thumb
  const arm = side => {
    const root = new THREE.Group(); root.position.set(side * .215, .52, 0);
    const upper = cap(.052, .22, coatM); upper.position.y = -.14; root.add(upper);
    const joint = new THREE.Group(); joint.position.y = -.29; root.add(joint);
    const lower = cap(.045, .2, coatM); lower.position.y = -.12; joint.add(lower);
    const cuff = mesh(new THREE.CylinderGeometry(.043, .043, .03, 12), shirtM); cuff.position.y = -.245; joint.add(cuff);
    const hand = mesh(new THREE.BoxGeometry(.06, .09, .03), skinM); hand.position.y = -.3; joint.add(hand);
    const thumb = cap(.012, .03, skinM, 6); thumb.position.set(-side * .035, -.285, .012); thumb.rotation.z = side * .5; joint.add(thumb);
    return {root, joint};
  };
  const leg = side => {
    const root = new THREE.Group(); root.position.set(side * .09, -.02, 0);
    const upper = cap(.075, .32, trouserM); upper.position.y = -.21; root.add(upper);
    const joint = new THREE.Group(); joint.position.y = -.43; root.add(joint);
    const lower = cap(.062, .32, trouserM); lower.position.y = -.2; joint.add(lower);
    const shoe = mesh(new THREE.BoxGeometry(.1, .07, .25), shoeM); shoe.position.set(0, -.44, .045); joint.add(shoe);
    const toe = mesh(new THREE.CylinderGeometry(.05, .05, .1, 12, 1, false, 0, Math.PI), shoeM); toe.rotation.set(0, 0, Math.PI / 2); toe.position.set(0, -.44, .17); toe.scale.set(.7, 1, 1); joint.add(toe);
    return {root, joint};
  };
  const armL = arm(-1), armR = arm(1); torso.add(armL.root, armR.root);
  const legL = leg(-1), legR = leg(1); hips.add(legL.root, legR.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.4, 28), new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: .18, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; group.add(shadow);
  return {group, hips, torso, neck, armL, armR, legL, legR, blend: 0, hq: true};
}

/** Seated variant (COS-109): thighs forward, shins down, hips at seat height. Upper body keeps the status pose. */
export function seatHumanoid(h, seatHeight = .5) {
  const base = .92; // animateHumanoid sets hips.y = .92 + bob + breathe
  h.hips.position.y = seatHeight + (h.hips.position.y - base); // keep the breathing offset
  h.legL.root.rotation.x = h.legR.root.rotation.x = -1.45;
  h.legL.joint.rotation.x = h.legR.joint.rotation.x = 1.5;
}
