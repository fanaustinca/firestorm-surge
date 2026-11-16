// Procedural firearm meshes — Slot 1 (main) and Slot 2 (secondary).
// Every builder: (m: materials, opt) → THREE.Group, origin at the pistol grip, barrel toward -Z.
// Markers: 'muzzle', 'sight' (ADS eye point), 'foregrip' (left hand), optional 'mag'/'round'/'pump'.
import * as THREE from 'three';
import { P, rbox, box, cylZ, cylX, cylY, sphere, torus, profile, shapeGeo, latheZ, tube, rail, marker, holoSight, scope } from './modelKit.js';

const PI = Math.PI;
const std = (o) => new THREE.MeshStandardMaterial(o);

function pistolGrip(g, m, mat = m.polymer, z = 0, scale = 1) {
  const s = scale;
  P(g, profile([[0.022 * s, 0.006], [-0.026 * s, 0.006], [-0.056 * s, -0.104 * s], [-0.046 * s, -0.118 * s], [-0.008 * s, -0.118 * s], [0.002 * s, -0.1 * s], [0.008 * s, -0.03 * s]], 0.026, 0.004), mat, 0, 0, z);
}
function triggerGroup(g, m, z = -0.035, y = 0) {
  P(g, torus(0.024, 0.0035, 18, PI), m.gunmetal, 0, y - 0.002, z - 0.006, 0, PI / 2, PI);
  P(g, rbox(0.006, 0.022, 0.008, 0.002), m.steel, 0, y - 0.012, z + 0.002, 0.25);
}

// ───────────────────────── Slot 1 ─────────────────────────
function assault_rifle(m, opt = {}) {
  const g = new THREE.Group();
  P(g, rbox(0.036, 0.05, 0.22, 0.006), m.gunmetal, 0, 0.025, -0.03);           // lower
  P(g, rbox(0.04, 0.046, 0.27, 0.006), m.gunmetal, 0, 0.07, -0.045);            // upper
  P(g, box(0.002, 0.016, 0.05), m.polymer, 0.0205, 0.072, -0.03);               // ejection port
  P(g, rbox(0.012, 0.01, 0.03, 0.003), m.orange, 0, 0.098, 0.085);              // charging handle
  rail(g, m, 0.085, -0.165, 0.095);
  P(g, rbox(0.054, 0.054, 0.31, 0.01), m.polymer, 0, 0.068, -0.32);             // handguard
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) P(g, rbox(0.004, 0.012, 0.035, 0.002), m.gunmetal, sx * 0.027, 0.068, -0.2 - i * 0.055);
  rail(g, m, -0.175, -0.47, 0.097);
  P(g, cylZ(0.0095, 0.0095, 0.21, 16), m.darksteel, 0, 0.07, -0.575);           // barrel
  P(g, rbox(0.026, 0.03, 0.03, 0.004), m.gunmetal, 0, 0.074, -0.5);             // gas block
  P(g, rbox(0.006, 0.03, 0.012, 0.002), m.gunmetal, 0, 0.102, -0.455);          // front post
  P(g, cylZ(0.015, 0.015, 0.06, 16), m.gunmetal, 0, 0.07, -0.705);              // brake
  for (const sx of [-1, 1]) P(g, box(0.004, 0.008, 0.035), m.polymer, sx * 0.0145, 0.07, -0.705);
  P(g, rbox(0.04, 0.04, 0.075, 0.006), m.gunmetal, 0, -0.008, -0.095);         // magwell
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.02, -0.095); g.add(mag);
  const ms = new THREE.Shape(); ms.moveTo(-0.03, 0.02); ms.lineTo(0.03, 0.02); ms.quadraticCurveTo(0.035, -0.08, 0.07, -0.15); ms.lineTo(0.015, -0.168); ms.quadraticCurveTo(-0.02, -0.08, -0.03, 0.02);
  P(mag, shapeGeo(ms, 0.026, 0.003), m.polymer);
  P(mag, rbox(0.034, 0.012, 0.064, 0.003), m.orange, 0, -0.162, -0.04, -0.33);
  pistolGrip(g, m, m.polymer, 0.03);
  triggerGroup(g, m, -0.03);
  P(g, cylZ(0.016, 0.016, 0.14, 16), m.gunmetal, 0, 0.065, 0.15);               // buffer tube
  P(g, profile([[0, 0.092], [-0.17, 0.1], [-0.19, 0.09], [-0.19, -0.03], [-0.16, -0.035], [-0.03, 0.025], [0, 0.035]], 0.038, 0.006), m.polymer, 0, 0, 0.14);
  P(g, rbox(0.042, 0.13, 0.018, 0.006), m.rubber, 0, 0.03, 0.335);              // butt pad
  P(g, cylY(0.014, 0.017, 0.085, 16), m.polymer, 0, 0.0, -0.36);                // vertical foregrip
  holoSight(g, m, 0.1, -0.03);
  marker(g, 'muzzle', 0, 0.07, -0.74); marker(g, 'foregrip', 0, -0.01, -0.36);
  if (opt.holiday === 'turkey') { // Turkey Shooter: roasted furniture + tail-feather fan on the stock
    const roast = std({ color: 0x8a4a1c, roughness: 0.45, metalness: 0.1 });
    g.traverse((o) => { if (o.isMesh && o.material === m.polymer && o.position.z < -0.2) o.material = roast; });
    const deco = new THREE.Group(); deco.name = 'holidayDeco'; deco.position.set(0, 0.11, 0.3); g.add(deco);
    const cols = [0x7a3b12, 0xb5651d, 0xe0a030, 0x8a2a10, 0xd9822b];
    for (let i = 0; i < 7; i++) {
      const a = -0.75 + i * 0.25;
      const f = P(deco, sphere(0.035, 10, 8), std({ color: cols[i % 5], roughness: 0.8 }), Math.sin(a) * 0.06, Math.cos(a) * 0.06, 0, 0, 0, -a);
      f.scale.set(0.35, 1.5, 0.12);
    }
    P(deco, sphere(0.018, 12, 10), std({ color: 0xc0281e, roughness: 0.6 }), 0, 0.01, -0.01);
  }
  return g;
}

function ak47(m) {
  const g = new THREE.Group();
  const bakelite = std({ color: 0x8a3216, metalness: 0.1, roughness: 0.35 });
  P(g, rbox(0.042, 0.06, 0.3, 0.006), m.gunmetal, 0, 0.05, -0.06);              // receiver
  P(g, rbox(0.04, 0.022, 0.27, 0.01), m.darksteel, 0, 0.088, -0.05);             // dust cover
  for (let i = 0; i < 4; i++) P(g, box(0.041, 0.004, 0.006), m.gunmetal, 0, 0.1, 0.06 - i * 0.012);
  P(g, rbox(0.004, 0.012, 0.05, 0.002), m.steel, 0.023, 0.06, -0.07);           // bolt handle slot
  P(g, cylX(0.006, 0.006, 0.02, 8), m.steel, 0.032, 0.062, -0.09);               // charging knob
  P(g, rbox(0.003, 0.012, 0.09, 0.002), m.steel, 0.022, 0.035, 0.0, -0.08);     // selector lever
  P(g, profile([[0, 0.078], [-0.06, 0.074], [-0.29, 0.04], [-0.3, -0.065], [-0.25, -0.075], [-0.06, 0.0], [0, 0.022]], 0.036, 0.006), m.wood, 0, 0, 0.09);
  P(g, rbox(0.042, 0.12, 0.012, 0.004), m.darksteel, 0, -0.012, 0.392, 0.0);   // buttplate
  pistolGrip(g, m, m.wood, 0.03);
  triggerGroup(g, m, -0.02);
  P(g, rbox(0.05, 0.046, 0.21, 0.012), m.wood, 0, 0.042, -0.325);                // lower handguard
  P(g, rbox(0.038, 0.026, 0.18, 0.01), m.wood, 0, 0.083, -0.31);                 // upper handguard
  P(g, cylZ(0.009, 0.009, 0.06, 12), m.darksteel, 0, 0.083, -0.43);             // gas tube
  P(g, rbox(0.03, 0.04, 0.03, 0.004), m.darksteel, 0, 0.07, -0.465);            // gas block
  P(g, cylZ(0.0095, 0.0095, 0.3, 16), m.darksteel, 0, 0.05, -0.57);            // barrel
  P(g, rbox(0.02, 0.05, 0.03, 0.004), m.darksteel, 0, 0.065, -0.66);            // front sight block
  P(g, torus(0.012, 0.0025, 14, PI), m.darksteel, 0, 0.088, -0.66, 0, PI / 2);
  P(g, rbox(0.03, 0.02, 0.05, 0.004), m.darksteel, 0, 0.1, -0.19);              // rear sight base
  P(g, profile([[0.03, 0], [-0.03, 0], [-0.025, 0.015], [0.03, 0.03]], 0.02, 0.002), m.darksteel, 0, 0.03, -0.73);
  P(g, cylZ(0.013, 0.013, 0.05, 16), m.darksteel, 0, 0.05, -0.745);             // slant brake
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, 0.03, -0.12); g.add(mag);
  const ms = new THREE.Shape(); ms.moveTo(-0.035, 0.01); ms.lineTo(0.03, 0.01); ms.quadraticCurveTo(0.05, -0.1, 0.13, -0.19); ms.lineTo(0.08, -0.22); ms.quadraticCurveTo(0.0, -0.12, -0.035, 0.01);
  P(mag, shapeGeo(ms, 0.028, 0.004), bakelite);
  for (let i = 1; i < 5; i++) { const t = i / 5; P(mag, box(0.032, 0.004, 0.012), bakelite, 0, 0.01 - t * 0.2, -(0.0 + t * t * 0.1) - 0.005, -t * 0.6); }
  marker(g, 'muzzle', 0, 0.05, -0.775); marker(g, 'foregrip', 0, 0.02, -0.33); marker(g, 'sight', 0, 0.115, 0.05);
  return g;
}

function dmr(m) {
  const g = new THREE.Group();
  P(g, rbox(0.045, 0.065, 0.32, 0.008), m.tan, 0, 0.05, -0.06);
  P(g, rbox(0.012, 0.012, 0.04, 0.003), m.gunmetal, 0.025, 0.06, 0.02);
  rail(g, m, 0.09, -0.22, 0.087);
  P(g, rbox(0.054, 0.052, 0.36, 0.012), m.tan, 0, 0.06, -0.4);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) P(g, rbox(0.003, 0.01, 0.04, 0.002), m.polymer, sx * 0.0275, 0.06, -0.26 - i * 0.065);
  P(g, cylZ(0.011, 0.011, 0.32, 16), m.darksteel, 0, 0.06, -0.73);
  P(g, cylZ(0.017, 0.017, 0.07, 6), m.gunmetal, 0, 0.06, -0.92);
  for (const sx of [-1, 1]) P(g, box(0.004, 0.02, 0.045), m.polymer, sx * 0.016, 0.06, -0.92);
  P(g, rbox(0.04, 0.035, 0.07, 0.006), m.tan, 0, 0.0, -0.1);
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.03, -0.1); g.add(mag);
  P(mag, rbox(0.03, 0.06, 0.07, 0.005), m.polymer, 0, -0.01, 0);
  P(mag, rbox(0.034, 0.008, 0.074, 0.003), m.orange, 0, -0.042, 0);
  pistolGrip(g, m, m.polymer, 0.04);
  triggerGroup(g, m, -0.02);
  // skeleton stock
  P(g, rbox(0.03, 0.03, 0.24, 0.008), m.tan, 0, 0.08, 0.22, 0.05);
  P(g, rbox(0.026, 0.026, 0.25, 0.008), m.tan, 0, -0.0, 0.22, -0.32);
  P(g, rbox(0.036, 0.15, 0.03, 0.008), m.tan, 0, 0.03, 0.34);
  P(g, rbox(0.04, 0.155, 0.014, 0.005), m.rubber, 0, 0.03, 0.36);
  P(g, rbox(0.028, 0.03, 0.09, 0.006), m.polymer, 0, 0.11, 0.22);              // cheek riser
  // folded bipod
  for (const sx of [-1, 1]) P(g, cylZ(0.005, 0.005, 0.2, 8), m.darksteel, sx * 0.014, 0.026, -0.46);
  P(g, rbox(0.04, 0.016, 0.03, 0.004), m.darksteel, 0, 0.03, -0.555);
  scope(g, m, 0.13, -0.06, 0.26, 0.019, 0.027);
  marker(g, 'muzzle', 0, 0.06, -0.96); marker(g, 'foregrip', 0, 0.025, -0.34);
  return g;
}

function rocket_launcher(m, opt = {}) {
  const g = new THREE.Group();
  const olive = m.gunmetal.clone(); olive.side = THREE.DoubleSide;
  P(g, cylZ(0.065, 0.065, 1.05, 32), m.gunmetal, 0, 0.12, -0.12);
  P(g, latheZ([[0.064, 0], [0.068, -0.02], [0.09, -0.1], [0.086, -0.105]], 32), olive, 0, 0.12, 0.405);
  P(g, cylZ(0.071, 0.071, 0.03, 32), m.darksteel, 0, 0.12, -0.63);
  P(g, cylZ(0.069, 0.069, 0.05, 32), m.hazard, 0, 0.12, -0.5);
  P(g, cylZ(0.069, 0.069, 0.04, 32), m.darksteel, 0, 0.12, 0.33);
  for (const z of [-0.2, 0.05]) P(g, torus(0.068, 0.006, 32), m.polymer, 0, 0.12, z);
  // warhead
  const round = new THREE.Group(); round.name = 'round'; round.position.set(0, 0.12, -0.645); g.add(round);
  if (opt.holiday === 'pumpkin') {
    const sg = sphere(0.085, 28, 20); const pa = sg.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); const ang = Math.atan2(v.x, v.y); const k = 1 - 0.07 * Math.abs(Math.sin(ang * 4)); v.x *= k; v.y *= k; pa.setXYZ(i, v.x, v.y, v.z * 0.85); }
    sg.computeVertexNormals();
    P(round, sg, std({ color: 0xff7a12, roughness: 0.55, emissive: 0x401200 }), 0, 0, -0.09);
    P(round, cylZ(0.008, 0.012, 0.05, 8), std({ color: 0x3d6b22 }), 0, 0, -0.18);
    for (const sx of [-1, 1]) P(round, box(0.02, 0.016, 0.004), std({ color: 0x220800, emissive: 0xffaa22, emissiveIntensity: 1.5 }), sx * 0.025, 0.02, -0.16);
  } else {
    const wh = std({ color: 0x3f4a2c, metalness: 0.35, roughness: 0.5 });
    P(round, latheZ([[0.0, 0.33], [0.012, 0.32], [0.04, 0.25], [0.072, 0.14], [0.078, 0.06], [0.07, 0.0], [0.05, -0.02], [0, -0.02]], 28), wh);
    P(round, cylZ(0.008, 0.008, 0.04, 10), m.steel, 0, 0, -0.35);
    P(round, cylZ(0.079, 0.079, 0.02, 28), m.yellow, 0, 0, -0.07);
  }
  // grips + bracket
  P(g, rbox(0.04, 0.05, 0.14, 0.006), m.polymer, 0, 0.04, -0.02);
  pistolGrip(g, m, m.polymer, 0.01);
  triggerGroup(g, m, -0.03, 0.015);
  P(g, rbox(0.04, 0.05, 0.05, 0.006), m.polymer, 0, 0.04, -0.31);
  P(g, cylY(0.014, 0.016, 0.09, 12), m.polymer, 0, -0.02, -0.31);
  // optic on left
  P(g, rbox(0.016, 0.03, 0.05, 0.004), m.darksteel, -0.07, 0.15, -0.12);
  P(g, rbox(0.04, 0.05, 0.11, 0.008), m.polymer, -0.1, 0.19, -0.12);
  P(g, cylZ(0.016, 0.016, 0.006, 16), m.lens, -0.1, 0.195, -0.177);
  P(g, cylZ(0.02, 0.016, 0.03, 16), m.rubber, -0.1, 0.195, -0.04);
  P(g, rbox(0.07, 0.03, 0.16, 0.012), m.rubber, 0, 0.055, 0.2);                 // shoulder pad
  marker(g, 'muzzle', 0, 0.12, -0.98); marker(g, 'foregrip', 0, -0.03, -0.31); marker(g, 'sight', -0.1, 0.195, 0.08);
  return g;
}

function burst_rifle(m) {
  const g = new THREE.Group();
  const shell = std({ color: 0xc4c9ce, metalness: 0.15, roughness: 0.5 });
  P(g, profile([[0.40, 0.035], [0.40, 0.072], [-0.30, 0.072], [-0.33, 0.05], [-0.33, -0.07], [-0.27, -0.08], [-0.22, -0.02], [-0.04, 0.0], [0.06, 0.0], [0.10, 0.035]], 0.05, 0.008), shell, 0, 0, 0);
  P(g, rbox(0.046, 0.05, 0.6, 0.008), m.gunmetal, 0, 0.094, -0.02);                 // upper receiver
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) P(g, rbox(0.004, 0.014, 0.04, 0.002), m.polymer, sx * 0.026, 0.05, -0.17 - i * 0.055);
  P(g, rbox(0.052, 0.022, 0.13, 0.008), m.polymer, 0, 0.078, 0.2);                  // cheek pad
  P(g, rbox(0.052, 0.012, 0.03, 0.004), m.polymer, 0, -0.01, -0.33);
  for (const sx of [-1, 1]) { P(g, box(0.002, 0.006, 0.4), m.cyan, sx * 0.0235, 0.1, -0.06); P(g, box(0.002, 0.004, 0.12), m.cyan, sx * 0.026, 0.02, 0.2); }
  P(g, cylZ(0.012, 0.012, 0.12, 16), m.darksteel, 0, 0.065, -0.46);
  P(g, cylZ(0.018, 0.016, 0.06, 6), m.gunmetal, 0, 0.065, -0.53);
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.02, 0.15); g.add(mag);
  P(mag, rbox(0.026, 0.13, 0.06, 0.005), m.polymer, 0, -0.04, 0, -0.15);
  P(mag, rbox(0.03, 0.012, 0.064, 0.003), m.cyan, 0, -0.105, -0.01, -0.15);
  pistolGrip(g, m, m.polymer, 0.0);
  triggerGroup(g, m, -0.035);
  P(g, rbox(0.03, 0.06, 0.03, 0.006), m.polymer, 0, 0.005, -0.3);
  rail(g, m, 0.0, -0.2, 0.12);
  holoSight(g, m, 0.125, -0.08);
  P(g, rbox(0.054, 0.05, 0.02, 0.008), m.rubber, 0, 0.03, 0.325);
  marker(g, 'muzzle', 0, 0.065, -0.57); marker(g, 'foregrip', 0, -0.02, -0.3);
  return g;
}

function lmg(m) {
  const g = new THREE.Group();
  P(g, rbox(0.07, 0.09, 0.34, 0.01), m.gunmetal, 0, 0.06, -0.06);
  P(g, rbox(0.074, 0.022, 0.2, 0.006), m.darksteel, 0, 0.115, -0.1);
  P(g, cylX(0.006, 0.006, 0.08, 8), m.steel, 0, 0.12, -0.0);
  rail(g, m, 0.0, -0.19, 0.128);
  P(g, cylZ(0.026, 0.026, 0.34, 20), m.darksteel, 0, 0.07, -0.4);
  const ribs = new THREE.InstancedMesh(torus(0.027, 0.004, 20), m.gunmetal, 9); const mt = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) { mt.makeTranslation(0, 0.07, -0.26 - i * 0.032); ribs.setMatrixAt(i, mt); }
  ribs.castShadow = true; g.add(ribs);
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) P(g, cylX(0.006, 0.006, 0.006, 8), m.polymer, sx * 0.025, 0.07, -0.275 - i * 0.032);
  P(g, cylZ(0.012, 0.012, 0.22, 14), m.darksteel, 0, 0.07, -0.68);
  P(g, latheZ([[0.012, 0], [0.022, -0.05], [0.022, -0.07], [0.0, -0.07]], 16), m.gunmetal, 0, 0.07, -0.79);
  // carry handle
  P(g, tube([[0, 0.115, -0.2], [0, 0.17, -0.22], [0, 0.17, -0.32], [0, 0.09, -0.36]], 0.008, 24, 8), m.polymer);
  // ammo box + belt
  P(g, rbox(0.08, 0.11, 0.13, 0.008), m.olive, -0.07, -0.03, -0.1);
  P(g, box(0.082, 0.02, 0.06), m.yellow, -0.07, -0.03, -0.1);
  const pts = [[-0.06, 0.03, -0.1], [-0.05, 0.06, -0.11], [-0.04, 0.085, -0.12]];
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const rounds = new THREE.InstancedMesh(cylX(0.005, 0.005, 0.045, 8), m.brass, 6); const q = new THREE.Quaternion(); const sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 6; i++) { const p = curve.getPoint(i / 5); q.setFromEuler(new THREE.Euler(0, 0.35, 0)); mt.compose(p, q, sc); rounds.setMatrixAt(i, mt); }
  rounds.castShadow = true; g.add(rounds);
  pistolGrip(g, m, m.polymer, 0.05);
  triggerGroup(g, m, 0.0);
  P(g, profile([[0, 0.1], [-0.2, 0.085], [-0.21, -0.04], [-0.17, -0.045], [-0.04, 0.02], [0, 0.03]], 0.05, 0.008), m.polymer, 0, 0, 0.11);
  // bipod deployed
  for (const sx of [-1, 1]) { const leg = P(g, cylY(0.006, 0.006, 0.24, 8), m.darksteel, sx * 0.05, -0.04, -0.6, 0.35, 0, sx * 0.3); void leg; }
  P(g, rbox(0.05, 0.02, 0.03, 0.004), m.darksteel, 0, 0.045, -0.56);
  marker(g, 'muzzle', 0, 0.07, -0.86); marker(g, 'foregrip', 0, 0.04, -0.4); marker(g, 'sight', 0, 0.15, 0.08);
  return g;
}

function heavy_sniper(m) {
  const g = new THREE.Group();
  P(g, rbox(0.055, 0.05, 0.44, 0.008), m.olive, 0, 0.03, -0.12);
  P(g, cylZ(0.024, 0.024, 0.3, 24), m.gunmetal, 0, 0.075, -0.03);
  P(g, cylX(0.005, 0.005, 0.06, 8), m.steel, 0.045, 0.075, 0.07, 0, 0, -0.5);
  P(g, sphere(0.011, 12, 10), m.polymer, 0.072, 0.06, 0.07);
  P(g, cylZ(0.017, 0.02, 0.85, 20), m.darksteel, 0, 0.075, -0.6);
  P(g, rbox(0.055, 0.04, 0.1, 0.006), m.gunmetal, 0, 0.075, -1.07);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) P(g, box(0.004, 0.026, 0.016), m.polymer, sx * 0.028, 0.075, -1.04 - i * 0.026);
  rail(g, m, 0.1, -0.24, 0.1);
  scope(g, m, 0.16, -0.06, 0.42, 0.025, 0.042);
  pistolGrip(g, m, m.polymer, 0.06);
  triggerGroup(g, m, 0.02);
  P(g, profile([[0, 0.06], [-0.3, 0.06], [-0.33, 0.04], [-0.33, -0.1], [-0.28, -0.1], [-0.2, -0.02], [-0.04, -0.01], [0, 0.0]], 0.05, 0.008), m.olive, 0, 0, 0.1);
  P(g, rbox(0.04, 0.04, 0.14, 0.006), m.polymer, 0, 0.1, 0.27);
  P(g, rbox(0.056, 0.17, 0.02, 0.006), m.rubber, 0, -0.02, 0.44);
  P(g, cylY(0.008, 0.008, 0.1, 8), m.darksteel, 0, -0.07, 0.38);
  for (const sx of [-1, 1]) P(g, cylY(0.007, 0.007, 0.22, 8), m.darksteel, sx * 0.045, -0.07, -0.33, 0.25, 0, sx * 0.3);
  marker(g, 'muzzle', 0, 0.075, -1.13); marker(g, 'foregrip', 0, 0.0, -0.3);
  return g;
}

function flamethrower(m) {
  const g = new THREE.Group();
  const shield = m.darksteel.clone(); shield.side = THREE.DoubleSide;
  P(g, cylZ(0.03, 0.03, 0.47, 20), m.gunmetal, 0, 0.065, -0.115);
  P(g, cylZ(0.046, 0.046, 0.34, 24, true), shield, 0, 0.065, -0.4);
  for (let i = 0; i < 6; i++) P(g, torus(0.047, 0.004, 24), m.gunmetal, 0, 0.065, -0.24 - i * 0.065);
  P(g, latheZ([[0.046, 0], [0.03, -0.04], [0.02, -0.12], [0.024, -0.13], [0, -0.13]], 20), m.steel, 0, 0.065, -0.57);
  P(g, rbox(0.016, 0.02, 0.04, 0.003), m.polymer, 0, 0.032, -0.68);
  const pilot = new THREE.Group(); pilot.name = 'pilot'; pilot.position.set(0, 0.035, -0.71); g.add(pilot);
  P(pilot, new THREE.ConeGeometry(0.008, 0.035, 10).rotateX(-PI / 2), std({ color: 0x66aaff, emissive: 0x3388ff, emissiveIntensity: 3, transparent: true, opacity: 0.85 }), 0, 0, -0.01);
  P(pilot, new THREE.ConeGeometry(0.006, 0.03, 10).rotateX(-PI / 2), m.glowOrange, 0, 0.002, -0.03);
  // fuel tank
  const tank = std({ color: 0xb8231b, metalness: 0.5, roughness: 0.35 });
  P(g, new THREE.CapsuleGeometry(0.048, 0.22, 8, 20).rotateX(PI / 2), tank, 0, -0.05, -0.27);
  P(g, cylZ(0.05, 0.05, 0.05, 24), m.hazard, 0, -0.05, -0.27);
  P(g, cylX(0.018, 0.018, 0.01, 16), m.steel, 0.049, -0.05, -0.18);
  P(g, cylX(0.014, 0.014, 0.012, 16), m.glass, 0.05, -0.05, -0.18);
  P(g, rbox(0.03, 0.04, 0.03, 0.004), m.darksteel, 0, 0.015, -0.32);
  P(g, rbox(0.03, 0.04, 0.03, 0.004), m.darksteel, 0, 0.015, -0.2);
  P(g, tube([[0, -0.05, -0.12], [0.03, -0.09, -0.04], [0.05, -0.02, 0.06], [0.03, 0.05, 0.1]], 0.009, 30, 8), m.rubber);
  pistolGrip(g, m, m.polymer, 0.05);
  triggerGroup(g, m, 0.0, 0.03);
  P(g, rbox(0.04, 0.03, 0.08, 0.006), m.polymer, 0, 0.02, 0.0);
  P(g, profile([[0, 0.08], [-0.16, 0.07], [-0.17, -0.03], [-0.13, -0.035], [-0.02, 0.03]], 0.04, 0.006), m.polymer, 0, 0, 0.13);
  P(g, tube([[0, 0.095, -0.05], [0, 0.15, -0.09], [0, 0.15, -0.2], [0, 0.11, -0.24]], 0.009, 24, 8), m.polymer);
  marker(g, 'muzzle', 0, 0.065, -0.72); marker(g, 'foregrip', 0, -0.05, -0.3); marker(g, 'sight', 0, 0.16, 0.08);
  return g;
}

function grenade_launcher(m, opt = {}) {
  const g = new THREE.Group();
  const orn = opt.holiday === 'ornament';
  P(g, cylZ(0.07, 0.07, 0.14, 12), orn ? std({ color: 0xb01020, metalness: 0.6, roughness: 0.3 }) : m.gunmetal, 0, 0.06, -0.13);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6; const cx = Math.cos(a) * 0.045, cy = 0.06 + Math.sin(a) * 0.045;
    P(g, cylZ(0.02, 0.02, 0.142, 16), m.polymer, cx, cy, -0.13);
    if (orn) P(g, sphere(0.018, 14, 10), std({ color: [0xd0101a, 0x1a9a2a, 0xe0b020][i % 3], metalness: 0.8, roughness: 0.15 }), cx, cy, -0.2);
    else P(g, cylZ(0.016, 0.016, 0.004, 14), m.brass, cx, cy, -0.202);
  }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; P(g, box(0.008, 0.006, 0.1), m.darksteel, Math.cos(a) * 0.07, 0.06 + Math.sin(a) * 0.07, -0.13, 0, 0, a); }
  P(g, rbox(0.1, 0.12, 0.02, 0.006), m.gunmetal, 0, 0.06, -0.215);
  P(g, rbox(0.1, 0.12, 0.02, 0.006), m.gunmetal, 0, 0.06, -0.045);
  P(g, cylZ(0.006, 0.006, 0.16, 8), m.steel, 0, 0.06, -0.13);
  for (const sx of [-1, 1]) P(g, cylZ(0.006, 0.006, 0.17, 8), m.darksteel, sx * 0.045, 0.0, -0.13);
  const bar = orn ? std({ color: 0xeeeeee, roughness: 0.4 }) : m.gunmetal;
  P(g, cylZ(0.026, 0.026, 0.26, 20), bar, 0, 0.105, -0.35);
  if (orn) for (let i = 0; i < 6; i++) P(g, torus(0.0265, 0.006, 20), m.red, 0, 0.105, -0.25 - i * 0.04);
  P(g, cylZ(0.03, 0.03, 0.02, 20), m.darksteel, 0, 0.105, -0.48);
  P(g, rbox(0.04, 0.04, 0.14, 0.006), m.polymer, 0, 0.065, -0.32);
  P(g, cylY(0.014, 0.016, 0.09, 12), m.polymer, 0, 0.0, -0.32);
  P(g, rbox(0.04, 0.05, 0.08, 0.006), m.gunmetal, 0, 0.03, 0.0);
  pistolGrip(g, m, m.polymer, 0.02);
  triggerGroup(g, m, -0.01, 0.005);
  P(g, cylZ(0.014, 0.014, 0.18, 12), m.darksteel, 0, 0.05, 0.13);
  P(g, rbox(0.04, 0.12, 0.025, 0.006), m.rubber, 0, 0.02, 0.23);
  P(g, rbox(0.006, 0.05, 0.04, 0.002), m.darksteel, 0.02, 0.15, -0.3);
  P(g, rbox(0.03, 0.006, 0.04, 0.002), m.orange, 0.02, 0.175, -0.3);
  marker(g, 'muzzle', 0, 0.105, -0.5); marker(g, 'foregrip', 0, -0.03, -0.32); marker(g, 'sight', 0, 0.165, 0.05);
  return g;
}

function mortar(m) {
  const g = new THREE.Group();
  const olive = m.gunmetal.clone(); olive.side = THREE.DoubleSide;
  P(g, cylZ(0.052, 0.052, 0.85, 28, true), olive, 0, 0.1, -0.3);
  P(g, cylZ(0.04, 0.04, 0.84, 20), m.polymer, 0, 0.1, -0.3);                  // dark bore liner
  P(g, cylZ(0.06, 0.06, 0.04, 28), m.darksteel, 0, 0.1, -0.71);
  P(g, cylZ(0.056, 0.056, 0.03, 28), m.hazard, 0, 0.1, -0.55);
  // breech cap → ball → socket cup welded to the centre of the baseplate (one solid assembly)
  P(g, cylZ(0.058, 0.05, 0.05, 28), m.darksteel, 0, 0.1, 0.14);
  P(g, sphere(0.05, 20, 14), m.darksteel, 0, 0.1, 0.17);
  P(g, cylZ(0.05, 0.075, 0.05, 28), m.gunmetal, 0, 0.1, 0.19);
  const plate = P(g, new THREE.CylinderGeometry(0.17, 0.19, 0.03, 28), m.darksteel, 0, 0.1, 0.225, PI / 2);
  plate.scale.set(1, 1, 0.9);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + PI / 6; P(g, box(0.022, 0.13, 0.03), m.gunmetal, Math.cos(a) * 0.1, 0.1 + Math.sin(a) * 0.1, 0.25, 0, 0, a - PI / 2); }
  P(g, cylZ(0.065, 0.065, 0.06, 24), m.gunmetal, 0, 0.1, -0.38);                // bipod collar
  const legGeo = cylY(0.011, 0.011, 0.36, 10);
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * 0.03, 0.06, -0.38), to = new THREE.Vector3(sx * 0.2, -0.24, -0.5);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const leg = P(g, legGeo, m.darksteel, mid.x, mid.y, mid.z);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    leg.scale.y = from.distanceTo(to) / 0.36;
    P(g, cylY(0.03, 0.035, 0.012, 14), m.polymer, to.x, to.y - 0.005, to.z);
  }
  P(g, cylX(0.009, 0.009, 0.3, 10), m.darksteel, 0, -0.12, -0.45);
  P(g, cylY(0.012, 0.012, 0.2, 10), m.steel, 0, -0.03, -0.42);
  P(g, cylX(0.004, 0.004, 0.08, 8), m.steel, 0.03, -0.11, -0.43);
  // sight unit
  P(g, rbox(0.03, 0.03, 0.04, 0.004), m.darksteel, -0.07, 0.13, -0.32);
  P(g, rbox(0.04, 0.05, 0.08, 0.006), m.polymer, -0.1, 0.16, -0.32);
  P(g, cylZ(0.012, 0.012, 0.03, 12), m.lens, -0.1, 0.17, -0.37);
  P(g, cylX(0.006, 0.006, 0.03, 10), m.glowGreen, -0.1, 0.19, -0.3);
  P(g, tube([[0, 0.152, -0.15], [0, 0.2, -0.17], [0, 0.2, -0.27], [0, 0.152, -0.29]], 0.009, 20, 8), m.polymer);
  P(g, rbox(0.04, 0.03, 0.06, 0.006), m.polymer, 0, 0.035, 0.0);
  pistolGrip(g, m, m.polymer, 0.01);
  const round = new THREE.Group(); round.name = 'round'; round.position.set(0, 0.1, -0.73); g.add(round);
  P(round, latheZ([[0, 0.08], [0.02, 0.06], [0.035, 0.0], [0.03, -0.02], [0, -0.02]], 16), m.olive);
  marker(g, 'muzzle', 0, 0.1, -0.75); marker(g, 'foregrip', 0, 0.02, -0.25); marker(g, 'sight', -0.1, 0.17, -0.1);
  return g;
}

// ───────────────────────── Slot 2 ─────────────────────────
function pistolBase(g, m, slideMat, len = 0.19, accent = m.orange) {
  P(g, rbox(0.03, 0.033, len, 0.005), slideMat, 0, 0.042, 0.035 - len / 2);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) P(g, box(0.002, 0.024, 0.003), m.polymer, sx * 0.015, 0.045, 0.02 - i * 0.007);
  P(g, box(0.002, 0.012, 0.035), m.polymer, 0.0155, 0.048, -0.04);
  P(g, rbox(0.028, 0.022, 0.16, 0.004), m.polymer, 0, 0.015, -0.055);
  P(g, profile([[0.02, 0.01], [-0.035, 0.01], [-0.06, -0.1], [-0.05, -0.112], [-0.012, -0.112], [0.002, -0.095], [0.01, -0.03]], 0.03, 0.004), m.grip, 0, 0, 0.0);
  P(g, rbox(0.03, 0.008, 0.044, 0.002), accent, 0, -0.112, 0.035);
  triggerGroup(g, m, -0.03, 0.003);
  P(g, rbox(0.022, 0.008, 0.012, 0.002), m.polymer, 0, 0.062, 0.025);
  P(g, rbox(0.006, 0.008, 0.008, 0.002), m.polymer, 0, 0.062, 0.035 - len + 0.012);
  P(g, sphere(0.0018, 6, 6), m.glowGreen, 0, 0.065, 0.035 - len + 0.006);
  P(g, cylZ(0.0065, 0.0065, 0.004, 12), m.polymer, 0, 0.04, 0.035 - len - 0.001);
  marker(g, 'sight', 0, 0.066, 0.2);
}

function pistol(m) {
  const g = new THREE.Group(); pistolBase(g, m, m.gunmetal);
  marker(g, 'muzzle', 0, 0.04, -0.16); return g;
}

function smg(m) {
  const g = new THREE.Group();
  P(g, rbox(0.042, 0.062, 0.25, 0.008), m.gunmetal, 0, 0.05, -0.06);
  rail(g, m, 0.05, -0.17, 0.086);
  P(g, cylZ(0.017, 0.017, 0.14, 16), m.polymer, 0, 0.055, -0.25);
  for (let i = 0; i < 4; i++) P(g, torus(0.0175, 0.003, 16), m.cyan, 0, 0.055, -0.2 - i * 0.03);
  P(g, cylZ(0.009, 0.009, 0.04, 12), m.darksteel, 0, 0.055, -0.34);
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.0, -0.1); g.add(mag);
  P(mag, rbox(0.026, 0.16, 0.034, 0.004), m.polymer, 0, -0.07, 0, 0.08);
  P(mag, rbox(0.03, 0.01, 0.038, 0.003), m.cyan, 0, -0.15, 0.006, 0.08);
  pistolGrip(g, m, m.polymer, 0.04);
  triggerGroup(g, m, -0.01);
  P(g, cylY(0.013, 0.015, 0.075, 12), m.polymer, 0, -0.005, -0.21);
  for (const y of [0.075, 0.02]) P(g, cylZ(0.0045, 0.0045, 0.2, 8), m.steel, 0, y, 0.17);
  P(g, rbox(0.04, 0.085, 0.012, 0.004), m.rubber, 0, 0.045, 0.27);
  // mini reflex
  P(g, rbox(0.028, 0.012, 0.04, 0.003), m.polymer, 0, 0.098, -0.03);
  P(g, rbox(0.028, 0.03, 0.004, 0.002), m.gunmetal, 0, 0.115, -0.045);
  P(g, box(0.022, 0.022, 0.001), m.glass, 0, 0.116, -0.042);
  P(g, sphere(0.0018, 6, 6), m.reddot, 0, 0.116, -0.043);
  marker(g, 'muzzle', 0, 0.055, -0.37); marker(g, 'foregrip', 0, -0.02, -0.21); marker(g, 'sight', 0, 0.116, 0.1);
  return g;
}

function crossbow(m) {
  const g = new THREE.Group();
  P(g, profile([[0.3, 0.05], [0.3, 0.09], [-0.1, 0.085], [-0.14, 0.06], [-0.14, 0.02], [-0.04, 0.02], [0.0, 0.03], [0.1, 0.03]], 0.04, 0.006), m.polymer, 0, 0, 0.0);
  P(g, box(0.012, 0.004, 0.36), m.darksteel, 0, 0.093, -0.12);
  pistolGrip(g, m, m.olive, 0.03);
  triggerGroup(g, m, -0.02, 0.02);
  P(g, rbox(0.06, 0.035, 0.04, 0.006), m.gunmetal, 0, 0.07, -0.28);
  const limb = (sx) => [[sx * 0.02, 0.07, -0.28], [sx * 0.12, 0.07, -0.27], [sx * 0.2, 0.07, -0.235], [sx * 0.25, 0.07, -0.19]];
  for (const sx of [-1, 1]) { P(g, tube(limb(sx), 0.009, 24, 8), m.olive); P(g, cylY(0.012, 0.012, 0.02, 12), m.darksteel, sx * 0.25, 0.07, -0.19); }
  P(g, tube([[-0.25, 0.072, -0.19], [0, 0.095, -0.02]], 0.0016, 2, 4), m.rubber);
  P(g, tube([[0.25, 0.072, -0.19], [0, 0.095, -0.02]], 0.0016, 2, 4), m.rubber);
  const round = new THREE.Group(); round.name = 'round'; round.position.set(0, 0.1, 0); g.add(round);
  P(round, cylZ(0.004, 0.004, 0.36, 8), m.polymer, 0, 0, -0.17);
  P(round, new THREE.ConeGeometry(0.01, 0.04, 4).rotateX(-PI / 2), m.steel, 0, 0, -0.37);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; P(round, box(0.002, 0.016, 0.04), m.orange, Math.sin(a) * 0.008, Math.cos(a) * 0.008, -0.02, 0, 0, -a); }
  P(g, torus(0.03, 0.005, 16), m.darksteel, 0, 0.04, -0.33, PI / 2);
  P(g, rbox(0.024, 0.018, 0.03, 0.003), m.polymer, 0, 0.115, 0.06);
  P(g, sphere(0.0022, 6, 6), m.reddot, 0, 0.125, 0.05);
  marker(g, 'muzzle', 0, 0.1, -0.4); marker(g, 'foregrip', 0, 0.02, -0.15); marker(g, 'sight', 0, 0.125, 0.22);
  return g;
}

function burst_pistol(m) {
  const g = new THREE.Group(); pistolBase(g, m, m.white, 0.21, m.cyan);
  P(g, rbox(0.032, 0.03, 0.035, 0.004), m.gunmetal, 0, 0.042, -0.19);
  for (const sx of [-1, 1]) P(g, box(0.002, 0.012, 0.016), m.polymer, sx * 0.016, 0.05, -0.19);
  P(g, box(0.002, 0.004, 0.17), m.cyan, 0.0155, 0.03, -0.07);
  P(g, box(0.002, 0.004, 0.17), m.cyan, -0.0155, 0.03, -0.07);
  const mag = new THREE.Group(); mag.name = 'mag'; g.add(mag);
  P(mag, rbox(0.024, 0.04, 0.03, 0.003), m.polymer, 0, -0.13, 0.034);
  marker(g, 'muzzle', 0, 0.042, -0.21); return g;
}

function revolver(m) {
  const g = new THREE.Group();
  m = { ...m, steel: std({ color: 0x7d858e, metalness: 0.95, roughness: 0.32 }) };
  P(g, profile([[0.08, 0.02], [0.08, 0.075], [-0.05, 0.075], [-0.07, 0.06], [-0.05, 0.0], [0.02, -0.005]], 0.026, 0.004), m.steel, 0, 0, 0.02);
  const cyl = new THREE.Group(); cyl.name = 'mag'; cyl.position.set(0, 0.045, -0.035); g.add(cyl);
  P(cyl, cylZ(0.03, 0.03, 0.055, 24), m.steel);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; P(cyl, box(0.008, 0.008, 0.05), m.darksteel, Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0, 0, 0, a); P(cyl, cylZ(0.006, 0.006, 0.002, 10), m.brass, Math.cos(a + PI / 6) * 0.017, Math.sin(a + PI / 6) * 0.017, 0.028); }
  P(g, cylZ(0.011, 0.011, 0.19, 16), m.steel, 0, 0.058, -0.155);
  P(g, rbox(0.012, 0.012, 0.19, 0.003), m.steel, 0, 0.07, -0.155);
  P(g, rbox(0.012, 0.014, 0.17, 0.003), m.steel, 0, 0.038, -0.145);
  P(g, profile([[0.0, 0.0], [0.015, 0.0], [0.015, 0.016], [0.0, 0.006]], 0.004, 0.001), m.steel, 0, 0.076, -0.235);
  P(g, rbox(0.01, 0.025, 0.02, 0.003), m.darksteel, 0, 0.078, 0.06, -0.5);
  P(g, profile([[0.02, 0.005], [-0.045, 0.01], [-0.075, -0.09], [-0.06, -0.105], [-0.02, -0.1], [0.0, -0.02]], 0.032, 0.006), m.wood, 0, 0, 0.03);
  P(g, torus(0.022, 0.0035, 18, PI), m.steel, 0, 0.003, -0.01, 0, PI / 2, PI);
  P(g, rbox(0.006, 0.022, 0.008, 0.002), m.brass, 0, -0.005, 0.0, 0.3);
  marker(g, 'muzzle', 0, 0.058, -0.255); marker(g, 'sight', 0, 0.085, 0.2);
  return g;
}

function sawed_off(m) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) { P(g, cylZ(0.014, 0.014, 0.32, 18), m.darksteel, sx * 0.0145, 0.065, -0.26); P(g, cylZ(0.0105, 0.0105, 0.004, 14), m.polymer, sx * 0.0145, 0.065, -0.421); }
  P(g, box(0.008, 0.006, 0.32), m.darksteel, 0, 0.081, -0.26);
  P(g, rbox(0.055, 0.055, 0.1, 0.008), m.steel, 0, 0.055, -0.05);
  P(g, rbox(0.05, 0.03, 0.16, 0.01), m.wood, 0, 0.038, -0.2);
  for (const sx of [-1, 1]) P(g, rbox(0.008, 0.025, 0.014, 0.002), m.darksteel, sx * 0.012, 0.09, 0.0, -0.4);
  P(g, profile([[0.02, 0.08], [-0.06, 0.07], [-0.11, -0.02], [-0.14, -0.1], [-0.1, -0.115], [-0.04, -0.06], [0.02, 0.02]], 0.036, 0.008), m.wood, 0, 0, 0.0);
  triggerGroup(g, m, -0.04, 0.03);
  P(g, rbox(0.006, 0.022, 0.008, 0.002), m.steel, 0, 0.018, -0.03, 0.25);
  marker(g, 'muzzle', 0, 0.065, -0.43); marker(g, 'foregrip', 0, 0.01, -0.2); marker(g, 'sight', 0, 0.1, 0.18);
  return g;
}

function tactical_shotgun(m) {
  const g = new THREE.Group();
  P(g, rbox(0.045, 0.065, 0.22, 0.008), m.gunmetal, 0, 0.05, -0.04);
  P(g, cylZ(0.0135, 0.0135, 0.5, 16), m.darksteel, 0, 0.068, -0.39);
  P(g, cylZ(0.013, 0.013, 0.42, 16), m.darksteel, 0, 0.034, -0.36);
  P(g, rbox(0.03, 0.03, 0.03, 0.004), m.gunmetal, 0, 0.05, -0.6);
  const pump = new THREE.Group(); pump.name = 'pump'; pump.position.set(0, 0.034, -0.32); g.add(pump);
  P(pump, rbox(0.048, 0.045, 0.17, 0.012), m.polymer);
  for (let i = 0; i < 7; i++) P(pump, torus(0.024, 0.003, 16), m.polymer, 0, 0, -0.07 + i * 0.023).scale.set(1, 0.95, 1);
  P(g, rbox(0.014, 0.02, 0.012, 0.003), m.darksteel, 0, 0.092, 0.05);
  P(g, torus(0.007, 0.002, 12), m.steel, 0, 0.1, 0.05);
  P(g, sphere(0.004, 8, 6), m.orange, 0, 0.085, -0.63);
  // side saddle with shells
  P(g, rbox(0.006, 0.04, 0.09, 0.003), m.polymer, 0.026, 0.05, -0.06);
  for (let i = 0; i < 4; i++) { P(g, cylY(0.008, 0.008, 0.045, 10), m.red, 0.032, 0.05, -0.025 - i * 0.022); P(g, cylY(0.0085, 0.0085, 0.01, 10), m.brass, 0.032, 0.026, -0.025 - i * 0.022); }
  pistolGrip(g, m, m.polymer, 0.05);
  triggerGroup(g, m, 0.0);
  P(g, profile([[0, 0.085], [-0.22, 0.07], [-0.23, -0.06], [-0.19, -0.065], [-0.04, 0.0], [0, 0.02]], 0.044, 0.008), m.polymer, 0, 0, 0.07);
  P(g, rbox(0.048, 0.14, 0.02, 0.006), m.rubber, 0, 0.01, 0.3);
  marker(g, 'muzzle', 0, 0.068, -0.65); marker(g, 'foregrip', 0, 0.015, -0.32); marker(g, 'sight', 0, 0.1, 0.2);
  return g;
}

function taser(m) {
  const g = new THREE.Group();
  P(g, profile([[0.12, 0.02], [0.12, 0.08], [-0.05, 0.075], [-0.07, 0.04], [-0.04, 0.0]], 0.036, 0.008), m.yellow, 0, 0, 0.0);
  P(g, profile([[0.02, 0.01], [-0.04, 0.01], [-0.06, -0.1], [-0.015, -0.105], [0.005, -0.03]], 0.032, 0.006), m.polymer, 0, 0, 0.0);
  const cart = new THREE.Group(); cart.name = 'round'; cart.position.set(0, 0.05, -0.15); g.add(cart);
  P(cart, rbox(0.04, 0.055, 0.05, 0.006), m.polymer);
  P(cart, box(0.041, 0.01, 0.04), m.yellow, 0, -0.016, 0);
  for (const y of [0.012, -0.004]) P(cart, cylZ(0.006, 0.006, 0.006, 10), m.glowBlue, 0, y, -0.027);
  const arc = P(g, box(0.003, 0.02, 0.003), m.glowBlue, 0.016, 0.05, -0.176); arc.name = 'arc';
  P(g, cylZ(0.004, 0.004, 0.01, 8), m.reddot, 0, 0.022, -0.125);
  triggerGroup(g, m, -0.03, 0.005);
  P(g, rbox(0.03, 0.008, 0.02, 0.003), m.gunmetal, 0, 0.08, 0.03);
  marker(g, 'muzzle', 0, 0.05, -0.18); marker(g, 'sight', 0, 0.09, 0.2);
  return g;
}

// ───────────────────────── new arrivals ─────────────────────────
function stockAR(g, m, mat = m.polymer) {
  P(g, rbox(0.034, 0.05, 0.2, 0.008), mat, 0, 0.03, 0.17);
  P(g, rbox(0.04, 0.09, 0.014, 0.005), m.rubber, 0, 0.02, 0.275);
}
function volt_rail(m) {
  const g = new THREE.Group();
  P(g, rbox(0.05, 0.07, 0.3, 0.008), m.gunmetal, 0, 0.04, -0.06);                        // receiver
  P(g, rbox(0.046, 0.04, 0.12, 0.006), m.polymer, 0, 0.0, -0.12);                         // battery pack
  for (let i = 0; i < 4; i++) P(g, box(0.048, 0.006, 0.012), m.cyan, 0, 0.0, -0.08 - i * 0.025);
  for (const sx of [-1, 1]) P(g, rbox(0.01, 0.03, 0.56, 0.003), m.darksteel, sx * 0.022, 0.05, -0.47);   // the two rails
  for (let i = 0; i < 7; i++) P(g, torus(0.03, 0.006, 20), i % 2 ? m.cyan : m.brass, 0, 0.05, -0.26 - i * 0.07);
  P(g, cylZ(0.006, 0.006, 0.54, 8), m.steel, 0, 0.05, -0.47);                              // slug guide
  P(g, rbox(0.06, 0.012, 0.05, 0.004), m.gunmetal, 0, 0.05, -0.76);                         // muzzle bridge
  pistolGrip(g, m, m.polymer, 0.03); triggerGroup(g, m, -0.01);
  stockAR(g, m, m.gunmetal);
  P(g, rbox(0.03, 0.014, 0.08, 0.004), m.polymer, 0, 0.082, 0.02);                        // rear sight
  for (const sx of [-1, 1]) P(g, box(0.004, 0.018, 0.01), m.darksteel, sx * 0.008, 0.095, 0.03);
  P(g, box(0.004, 0.02, 0.008), m.darksteel, 0, 0.074, -0.74);                             // front post
  P(g, sphere(0.003, 8, 6), m.glowBlue, 0, 0.085, -0.74);
  marker(g, 'muzzle', 0, 0.05, -0.8); marker(g, 'foregrip', 0, -0.0, -0.32); marker(g, 'sight', 0, 0.092, 0.1);
  return g;
}
function arc_caster(m) {
  const g = new THREE.Group();
  P(g, rbox(0.055, 0.075, 0.26, 0.01), m.gunmetal, 0, 0.035, -0.05);
  P(g, cylZ(0.016, 0.016, 0.34, 14), m.darksteel, 0, 0.04, -0.33);
  for (let i = 0; i < 14; i++) P(g, torus(0.026, 0.005, 16), m.brass, 0, 0.04, -0.2 - i * 0.017);   // copper coil
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + PI / 2; P(g, new THREE.ConeGeometry(0.006, 0.07, 6).rotateX(-PI / 2), m.steel, Math.cos(a) * 0.028, 0.04 + Math.sin(a) * 0.028, -0.53, 0, 0, 0); }
  P(g, torus(0.03, 0.004, 20), m.steel, 0, 0.04, -0.5);
  P(g, sphere(0.022, 16, 12), m.glowPurple, 0, -0.02, -0.17);                             // capacitor orb in a cage
  for (let i = 0; i < 4; i++) P(g, torus(0.026, 0.002, 16, PI), m.darksteel, 0, -0.02, -0.17, 0, (i / 4) * PI, 0);
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.01, -0.05); g.add(mag);
  P(mag, cylX(0.04, 0.04, 0.05, 20), m.polymer, 0, -0.04, 0); P(mag, torus(0.04, 0.004, 20).rotateY(PI / 2), m.cyan, 0.026, -0.04, 0);
  pistolGrip(g, m, m.polymer, 0.06); triggerGroup(g, m, 0.02);
  stockAR(g, m);
  P(g, rbox(0.02, 0.016, 0.05, 0.004), m.polymer, 0, 0.08, 0.02);
  P(g, box(0.004, 0.022, 0.006), m.darksteel, 0, 0.07, -0.47);
  marker(g, 'muzzle', 0, 0.04, -0.56); marker(g, 'foregrip', 0, -0.02, -0.28); marker(g, 'sight', 0, 0.09, 0.1);
  return g;
}
function drum_breaker(m) {
  const g = new THREE.Group();
  P(g, rbox(0.06, 0.08, 0.3, 0.01), m.olive, 0, 0.035, -0.08);
  P(g, cylZ(0.022, 0.022, 0.36, 18), m.gunmetal, 0, 0.05, -0.4);
  P(g, rbox(0.062, 0.05, 0.22, 0.008), m.polymer, 0, 0.02, -0.33);                        // handguard
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) P(g, box(0.002, 0.02, 0.014), m.darksteel, sx * 0.032, 0.025, -0.25 - i * 0.035);
  P(g, cylZ(0.03, 0.026, 0.06, 18), m.darksteel, 0, 0.05, -0.6);                           // choke
  for (let i = 0; i < 6; i++) P(g, box(0.004, 0.02, 0.03), m.polymer, Math.cos(i) * 0.03, 0.05 + Math.sin(i) * 0.03, -0.6, 0, 0, i);
  const mag = new THREE.Group(); mag.name = 'mag'; mag.position.set(0, -0.08, -0.12); g.add(mag);
  P(mag, cylX(0.085, 0.085, 0.07, 28), m.gunmetal); P(mag, cylX(0.05, 0.05, 0.074, 20), m.darksteel);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; P(mag, cylX(0.012, 0.012, 0.076, 10), m.red, 0, Math.cos(a) * 0.07, Math.sin(a) * 0.07); }
  P(g, cylY(0.016, 0.018, 0.08, 12), m.polymer, 0, -0.03, -0.36);                         // vertical foregrip
  pistolGrip(g, m, m.polymer, 0.04); triggerGroup(g, m, -0.0);
  stockAR(g, m, m.olive);
  P(g, torus(0.014, 0.003, 16), m.darksteel, 0, 0.096, 0.03);                              // ghost ring
  P(g, rbox(0.012, 0.012, 0.02, 0.003), m.darksteel, 0, 0.083, 0.03);
  P(g, box(0.004, 0.026, 0.006), m.darksteel, 0, 0.085, -0.56); P(g, sphere(0.003, 8, 6), m.orange, 0, 0.098, -0.56);
  marker(g, 'muzzle', 0, 0.05, -0.64); marker(g, 'foregrip', 0, -0.07, -0.36); marker(g, 'sight', 0, 0.096, 0.12);
  return g;
}
function pocket_rocket(m) {
  const g = new THREE.Group();
  const tubeM = m.gunmetal.clone(); tubeM.side = THREE.DoubleSide;
  P(g, cylZ(0.03, 0.03, 0.26, 20, true), tubeM, 0, 0.05, -0.1);
  P(g, cylZ(0.034, 0.034, 0.02, 20), m.darksteel, 0, 0.05, -0.23);
  P(g, cylZ(0.036, 0.03, 0.03, 20, true), tubeM, 0, 0.05, 0.04);
  const round = new THREE.Group(); round.name = 'round'; round.position.set(0, 0.05, -0.22); g.add(round);
  P(round, latheZ([[0, 0.06], [0.014, 0.04], [0.022, 0.0], [0.022, -0.03], [0, -0.03]], 16), m.olive);
  P(g, rbox(0.03, 0.03, 0.14, 0.005), m.polymer, 0, 0.012, -0.04);
  P(g, profile([[0.02, 0.01], [-0.035, 0.01], [-0.06, -0.1], [-0.05, -0.112], [-0.012, -0.112], [0.002, -0.095], [0.01, -0.03]], 0.03, 0.004), m.grip, 0, 0, 0.03);
  triggerGroup(g, m, 0.0, 0.0);
  P(g, rbox(0.012, 0.03, 0.03, 0.003), m.hazard, 0.032, 0.05, -0.05);
  P(g, rbox(0.018, 0.02, 0.02, 0.003), m.polymer, 0, 0.09, 0.0); P(g, sphere(0.0022, 6, 6), m.reddot, 0, 0.095, -0.005);
  marker(g, 'muzzle', 0, 0.05, -0.26); marker(g, 'sight', 0, 0.095, 0.18);
  return g;
}

export const GUN_BUILDERS = {
  assault_rifle, ak47, dmr, rocket_launcher, burst_rifle, lmg, heavy_sniper, flamethrower, grenade_launcher, mortar,
  pistol, smg, crossbow, burst_pistol, revolver, sawed_off, tactical_shotgun, taser,
  volt_rail, arc_caster, drum_breaker, pocket_rocket,
};
