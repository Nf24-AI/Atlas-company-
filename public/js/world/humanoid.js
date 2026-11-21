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
  return {group, fade: 1, hips, torso, neck, armL, armR, legL, legR, blend: 0};
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
