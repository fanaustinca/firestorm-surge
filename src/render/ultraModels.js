// ULTRA variants of every main firearm. Built on the ultra material set (black chrome + circuit
// emissive + neon accents) with extra hardware that makes each one read as "more" at a glance.
// Groups named 'spin' rotate around Z in the viewmodel/3rd person while firing.
import * as THREE from 'three';
import { P, rbox, box, cylZ, cylX, cylY, sphere, torus, latheZ, tube, marker, holoSight, scope } from './modelKit.js';
import { GUN_BUILDERS } from './gunModels.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const PI = Math.PI;
// standard gun finishes (no neon): polished steel + brass trim mark the ULTRA hardware
const NEON = () => std({ color: 0xa8b0b8, metalness: 1, roughness: 0.22 });
const PINK = () => std({ color: 0xc89a3c, metalness: 1, roughness: 0.3 });
const WARHEAD = () => std({ color: 0x4a6a2c, metalness: 0.35, roughness: 0.45 });

// glowing coil rings + side light strips along a barrel
function coils(g, z0, z1, y, r, n = 5) {
  const neon = NEON();
  for (let i = 0; i < n; i++) P(g, torus(r, r * 0.16, 24), neon, 0, y, z0 + ((z1 - z0) * i) / Math.max(1, n - 1));
}
function strips(g, z0, z1, y, x) {
  const pink = PINK();
  for (const sx of [-1, 1]) P(g, box(0.004, 0.006, Math.abs(z1 - z0)), pink, sx * x, y, (z0 + z1) / 2);
}
function drum(g, m, z, y, r = 0.075, w = 0.06) {
  const d = new THREE.Group(); d.name = 'mag'; d.position.set(0, y, z); g.add(d);
  P(d, cylX(r, r, w, 28), m.gunmetal);
  P(d, cylX(r * 0.55, r * 0.55, w + 0.006, 20), m.darksteel);
  P(d, torus(r, 0.006, 28).rotateY(PI / 2), NEON(), w / 2 + 0.002, 0, 0);
  P(d, torus(r, 0.006, 28).rotateY(PI / 2), NEON(), -w / 2 - 0.002, 0, 0);
  return d;
}
function base(id, m, opt) {
  return GUN_BUILDERS[id](m, { ...opt, holiday: null });
}
function emblem(g, y, z) { // floating chevron badge
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.02, 0.018); s.lineTo(0.04, 0); s.lineTo(0.04, 0.008); s.lineTo(0.02, 0.026); s.lineTo(0, 0.008);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false }); geo.translate(-0.02, 0, 0);
  for (const sx of [-1, 1]) P(g, geo, PINK(), sx * 0.032, y, z, 0, sx * PI / 2, 0);
}

function assault_rifle_ultra(m, opt) {
  const g = base('assault_rifle', m, opt);
  const old = g.getObjectByName('mag'); if (old) old.visible = false;
  drum(g, m, 0.1, -0.08, 0.08, 0.07);
  coils(g, -0.42, -0.62, 0.07, 0.03, 5); strips(g, -0.35, 0.15, 0.09, 0.027);
  P(g, cylZ(0.009, 0.009, 0.5, 12), m.steel, 0, 0.03, -0.45);                 // second barrel
  P(g, rbox(0.03, 0.02, 0.06, 0.004), m.gunmetal, 0, 0.03, -0.7);
  emblem(g, 0.05, 0.15);
  return g;
}
function ak47_ultra(m, opt) {
  const g = base('ak47', m, opt);
  const old = g.getObjectByName('mag'); if (old) old.visible = false;
  drum(g, m, 0.02, -0.1, 0.09, 0.075);
  const gold = std({ color: 0xf5c542, metalness: 1, roughness: 0.18 });
  P(g, new THREE.ConeGeometry(0.012, 0.2, 4).rotateX(-PI / 2), m.steel, 0, 0.0, -0.9);   // bayonet
  P(g, rbox(0.02, 0.03, 0.05, 0.004), gold, 0, 0.01, -0.78);
  coils(g, -0.5, -0.7, 0.05, 0.026, 4); strips(g, -0.3, 0.2, 0.06, 0.028);
  emblem(g, 0.04, 0.12);
  return g;
}
function dmr_ultra(m, opt) {
  const g = base('dmr', m, opt);
  coils(g, -0.45, -0.85, 0.06, 0.03, 7); strips(g, -0.3, 0.2, 0.08, 0.03);
  const cell = P(g, cylX(0.02, 0.02, 0.07, 16), NEON(), 0, 0.0, 0.05); void cell;
  P(g, rbox(0.06, 0.1, 0.05, 0.006), m.gunmetal, 0, -0.07, 0.06);              // extended mag
  emblem(g, 0.05, 0.12);
  return g;
}
// ULTRA rocket launcher: ONE launch tube fed by a 6-chamber revolving cylinder behind it.
// The cylinder ('wheel') indexes 60° after every shot to bring the next rocket up to the barrel.
function rocket_launcher_ultra(m) {
  const g = new THREE.Group(); const by = 0.16, R = 0.1, cy = by - R;
  const olive = WARHEAD();
  // launch tube (single barrel) on top, aligned with the chamber at the 12 o'clock position
  P(g, cylZ(0.062, 0.062, 0.78, 28, true), m.gunmetal, 0, by, -0.62);
  P(g, cylZ(0.05, 0.05, 0.78, 24), m.polymer, 0, by, -0.62);
  P(g, latheZ([[0.062, 0], [0.07, -0.03], [0.085, -0.1], [0.08, -0.105]], 28), m.gunmetal, 0, by, -1.0);
  for (const z of [-0.3, -0.62, -0.9]) P(g, torus(0.064, 0.007, 28), NEON(), 0, by, z);
  P(g, cylZ(0.066, 0.066, 0.05, 28), m.hazard, 0, by, -0.78);
  // revolving cylinder
  const wheel = new THREE.Group(); wheel.name = 'wheel'; wheel.position.set(0, cy, -0.1); g.add(wheel);
  P(wheel, cylZ(0.17, 0.17, 0.4, 36), m.gunmetal);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * PI * 2; const x = Math.cos(a) * R, y = Math.sin(a) * R;
    P(wheel, cylZ(0.052, 0.052, 0.402, 20), m.darksteel, x, y, 0);                       // chamber mouth
    const rk = new THREE.Group(); rk.name = 'rk' + i; rk.position.set(x, y, -0.2); wheel.add(rk);
    P(rk, latheZ([[0, 0.13], [0.014, 0.12], [0.036, 0.07], [0.046, 0.02], [0.046, 0], [0, 0]], 18), olive);
    P(rk, cylZ(0.047, 0.047, 0.012, 18), m.yellow, 0, 0, 0.005);
    const a2 = a + PI / 6; P(wheel, box(0.02, 0.03, 0.38), m.darksteel, Math.cos(a2) * 0.165, Math.sin(a2) * 0.165, 0, 0, 0, a2);   // flutes
  }
  P(wheel, cylZ(0.04, 0.04, 0.44, 16), m.steel);                                          // axle
  // frame: top strap joins barrel to the breech, side plates hold the cylinder axle
  P(g, rbox(0.1, 0.04, 0.5, 0.01), m.gunmetal, 0, by + 0.06, -0.1);
  for (const sx of [-1, 1]) P(g, rbox(0.02, 0.3, 0.06, 0.006), m.gunmetal, sx * 0.185, cy, -0.32);
  P(g, rbox(0.39, 0.06, 0.06, 0.01), m.gunmetal, 0, cy - 0.17, -0.32);
  P(g, cylZ(0.17, 0.15, 0.14, 32), m.gunmetal, 0, cy, 0.17);                               // breech / drive housing
  P(g, cylZ(0.07, 0.07, 0.05, 20), m.darksteel, 0, cy, 0.26);
  P(g, torus(0.17, 0.008, 36), PINK(), 0, cy, 0.1);
  P(g, rbox(0.08, 0.06, 0.1, 0.01), m.darksteel, 0.17, cy + 0.06, 0.17);                   // index motor
  // grips, optic, shoulder pad
  P(g, rbox(0.05, 0.05, 0.14, 0.008), m.polymer, 0, cy - 0.2, 0.12);
  P(g, rbox(0.035, 0.11, 0.05, 0.008), m.polymer, 0, cy - 0.27, 0.08, 0.2);
  P(g, rbox(0.04, 0.05, 0.05, 0.008), m.polymer, 0, by - 0.09, -0.6);
  P(g, cylY(0.016, 0.018, 0.1, 12), m.polymer, 0, by - 0.16, -0.6);
  P(g, rbox(0.05, 0.06, 0.14, 0.01), m.polymer, -0.11, by + 0.07, -0.4);
  P(g, cylZ(0.018, 0.018, 0.006, 16), m.lens, -0.11, by + 0.08, -0.473);
  P(g, rbox(0.12, 0.05, 0.16, 0.015), m.rubber, 0, cy - 0.04, 0.3);
  marker(g, 'muzzle', 0, by, -1.1); marker(g, 'foregrip', 0, by - 0.16, -0.6); marker(g, 'sight', -0.11, by + 0.08, -0.25);
  return g;
}
function burst_rifle_ultra(m, opt) {
  const g = base('burst_rifle', m, opt);
  coils(g, -0.42, -0.56, 0.065, 0.024, 4); strips(g, -0.3, 0.3, 0.075, 0.029);
  P(g, rbox(0.04, 0.05, 0.16, 0.006), m.gunmetal, 0, -0.04, -0.33);       // underslung capacitor
  P(g, cylZ(0.012, 0.012, 0.14, 12), NEON(), 0, -0.04, -0.33);
  emblem(g, 0.04, 0.14);
  return g;
}
function lmg_ultra(m) {
  const g = new THREE.Group(); const cy = 0.06;
  const spin = new THREE.Group(); spin.name = 'spin'; spin.position.set(0, cy, -0.42); g.add(spin);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; P(spin, cylZ(0.012, 0.012, 0.7, 12), m.darksteel, Math.cos(a) * 0.035, Math.sin(a) * 0.035, -0.05); }
  for (const z of [-0.36, -0.1, 0.18]) P(spin, cylZ(0.055, 0.055, 0.025, 20), m.gunmetal, 0, 0, z);
  P(spin, torus(0.052, 0.005, 24), NEON(), 0, 0, -0.39);
  P(g, cylZ(0.07, 0.07, 0.3, 24), m.gunmetal, 0, cy, 0.0);                    // motor housing
  for (let i = 0; i < 5; i++) P(g, torus(0.071, 0.005, 24), i % 2 ? PINK() : NEON(), 0, cy, -0.12 + i * 0.06);
  P(g, rbox(0.12, 0.07, 0.2, 0.01), m.gunmetal, 0, cy + 0.09, 0.0);
  P(g, tube([[0, cy + 0.13, -0.08], [0, cy + 0.2, -0.04], [0, cy + 0.2, 0.08], [0, cy + 0.13, 0.12]], 0.012, 20, 8), m.polymer);
  // giant ammo box + belt
  P(g, rbox(0.16, 0.18, 0.22, 0.012), m.gunmetal, -0.15, -0.08, 0.05);
  P(g, box(0.162, 0.03, 0.12), PINK(), -0.15, -0.04, 0.05);
  const pts = [[-0.08, -0.02, -0.02], [-0.06, 0.02, -0.05], [-0.04, 0.05, -0.08]].map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts); const mt = new THREE.Matrix4(); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, 0));
  const rounds = new THREE.InstancedMesh(cylX(0.006, 0.006, 0.05, 8), m.brass, 8);
  for (let i = 0; i < 8; i++) { mt.compose(curve.getPoint(i / 7), q, new THREE.Vector3(1, 1, 1)); rounds.setMatrixAt(i, mt); } g.add(rounds);
  P(g, rbox(0.04, 0.12, 0.05, 0.008), m.polymer, 0, -0.05, 0.12, 0.25);    // rear grip
  P(g, rbox(0.035, 0.03, 0.18, 0.006), m.polymer, 0, cy + 0.07, -0.25);
  P(g, cylY(0.016, 0.018, 0.12, 12), m.polymer, 0, cy - 0.08, -0.25);      // front grip
  marker(g, 'muzzle', 0, cy, -0.82); marker(g, 'foregrip', 0, cy - 0.1, -0.25); marker(g, 'sight', 0, cy + 0.15, 0.1);
  return g;
}
function heavy_sniper_ultra(m) {
  const g = new THREE.Group();
  P(g, rbox(0.07, 0.07, 0.5, 0.01), m.gunmetal, 0, 0.04, -0.1);
  for (const sx of [-1, 1]) {
    P(g, rbox(0.016, 0.03, 1.0, 0.004), m.darksteel, sx * 0.03, 0.08, -0.72);
    P(g, box(0.004, 0.012, 0.98), NEON(), sx * 0.039, 0.08, -0.72);
  }
  const coilM = std({ color: 0xb87333, metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 9; i++) { const z = -0.38 - i * 0.08; P(g, torus(0.05, 0.012, 24), coilM, 0, 0.08, z); P(g, torus(0.052, 0.004, 24), i % 2 ? PINK() : NEON(), 0, 0.08, z - 0.02); }
  P(g, cylZ(0.012, 0.012, 0.95, 12), PINK(), 0, 0.08, -0.7);
  P(g, rbox(0.08, 0.08, 0.06, 0.008), m.gunmetal, 0, 0.08, -1.22);
  P(g, rbox(0.06, 0.12, 0.14, 0.01), m.gunmetal, 0, -0.04, -0.05);           // power cell
  P(g, cylX(0.03, 0.03, 0.065, 16), NEON(), 0, -0.04, -0.05);
  scope(g, m, 0.17, -0.08, 0.46, 0.028, 0.046);
  P(g, rbox(0.04, 0.12, 0.05, 0.008), m.polymer, 0, -0.04, 0.08, 0.25);
  P(g, rbox(0.06, 0.08, 0.32, 0.012), m.gunmetal, 0, 0.03, 0.3);
  P(g, rbox(0.065, 0.17, 0.025, 0.008), m.rubber, 0, 0.0, 0.47);
  for (const sx of [-1, 1]) P(g, cylY(0.008, 0.008, 0.24, 8), m.darksteel, sx * 0.05, -0.06, -0.5, 0.25, 0, sx * 0.3);
  marker(g, 'muzzle', 0, 0.08, -1.26); marker(g, 'foregrip', 0, 0.0, -0.32);
  return g;
}
function flamethrower_ultra(m) {
  const g = new THREE.Group();
  const shield = m.darksteel.clone(); shield.side = THREE.DoubleSide;
  for (const sx of [-1, 1]) {
    const x = sx * 0.055;
    P(g, cylZ(0.028, 0.028, 0.5, 20), m.gunmetal, x, 0.08, -0.13);
    P(g, cylZ(0.042, 0.042, 0.3, 24, true), shield, x, 0.08, -0.42);
    for (let i = 0; i < 4; i++) P(g, torus(0.043, 0.004, 24), i % 2 ? NEON() : m.gunmetal, x, 0.08, -0.3 - i * 0.07);
    P(g, latheZ([[0.042, 0], [0.028, -0.04], [0.02, -0.1], [0.026, -0.12], [0, -0.12]], 20), m.steel, x, 0.08, -0.57);
    const pilot = new THREE.Group(); pilot.name = sx < 0 ? 'pilot' : 'pilot2'; pilot.position.set(x, 0.05, -0.7); g.add(pilot);
    P(pilot, new THREE.ConeGeometry(0.008, 0.035, 10).rotateX(-PI / 2), std({ color: 0x66aaff, emissive: 0x3388ff, emissiveIntensity: 3, transparent: true, opacity: 0.85 }), 0, 0, -0.01);
  }
  P(g, rbox(0.17, 0.05, 0.08, 0.01), m.gunmetal, 0, 0.08, -0.33);                  // bridge
  // HUGE fuel tank slung under + twin side canisters
  const tankM = std({ color: 0xc0261c, metalness: 0.55, roughness: 0.3 });
  P(g, new THREE.CapsuleGeometry(0.085, 0.42, 10, 24).rotateX(PI / 2), tankM, 0, -0.1, -0.2);
  for (const z of [-0.36, -0.2, -0.04]) P(g, torus(0.087, 0.008, 28), m.hazard, 0, -0.1, z);
  for (const sx of [-1, 1]) { P(g, new THREE.CapsuleGeometry(0.04, 0.2, 8, 16).rotateX(PI / 2), tankM, sx * 0.12, -0.03, -0.12); P(g, cylZ(0.041, 0.041, 0.03, 16), NEON(), sx * 0.12, -0.03, -0.12); }
  P(g, cylX(0.026, 0.026, 0.012, 16), m.glass, 0.09, -0.1, -0.08);
  P(g, tube([[0, -0.1, 0.05], [0.06, -0.12, 0.12], [0.08, -0.02, 0.16], [0.05, 0.06, 0.12]], 0.012, 30, 8), m.rubber);
  P(g, tube([[0, -0.1, 0.05], [-0.06, -0.12, 0.12], [-0.08, -0.02, 0.16], [-0.05, 0.06, 0.12]], 0.012, 30, 8), m.rubber);
  P(g, rbox(0.04, 0.12, 0.05, 0.008), m.polymer, 0, -0.03, 0.12, 0.25);
  P(g, rbox(0.05, 0.05, 0.2, 0.008), m.gunmetal, 0, 0.04, 0.12);
  P(g, tube([[0, 0.11, -0.05], [0, 0.17, -0.09], [0, 0.17, -0.22], [0, 0.12, -0.26]], 0.01, 24, 8), m.polymer);
  marker(g, 'muzzle', -0.055, 0.08, -0.72); marker(g, 'muzzle2', 0.055, 0.08, -0.72); marker(g, 'foregrip', 0, -0.05, -0.3); marker(g, 'sight', 0, 0.18, 0.08);
  return g;
}
function grenade_launcher_ultra(m, opt) {
  const g = base('grenade_launcher', m, opt);
  const spin = new THREE.Group(); spin.name = 'spin'; spin.position.set(0, 0.06, -0.13); g.add(spin);
  P(spin, cylZ(0.11, 0.11, 0.17, 24), m.gunmetal);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; P(spin, cylZ(0.022, 0.022, 0.172, 14), m.darksteel, Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0); P(spin, cylZ(0.018, 0.018, 0.005, 14), WARHEAD(), Math.cos(a) * 0.08, Math.sin(a) * 0.08, -0.088); }
  P(spin, torus(0.11, 0.007, 32), NEON(), 0, 0, -0.087); P(spin, torus(0.11, 0.007, 32), PINK(), 0, 0, 0.087);
  coils(g, -0.3, -0.46, 0.105, 0.03, 4);
  return g;
}
function mortar_ultra(m) {
  const g = new THREE.Group();
  const tubeM = m.gunmetal.clone(); tubeM.side = THREE.DoubleSide;
  const offs = [[-0.06, 0.06], [0.06, 0.06], [-0.06, 0.18], [0.06, 0.18]];
  for (const [x, y] of offs) {
    P(g, cylZ(0.05, 0.05, 0.85, 24, true), tubeM, x, y, -0.3);
    P(g, cylZ(0.038, 0.038, 0.84, 18), m.polymer, x, y, -0.3);
    P(g, cylZ(0.056, 0.056, 0.04, 24), m.darksteel, x, y, -0.71);
    P(g, latheZ([[0, 0.08], [0.02, 0.06], [0.034, 0.0], [0.03, -0.02], [0, -0.02]], 16), WARHEAD(), x, y, -0.74);
  }
  for (const z of [-0.6, -0.3, 0.0]) { P(g, rbox(0.25, 0.26, 0.03, 0.01), m.darksteel, 0, 0.12, z); P(g, box(0.252, 0.01, 0.032), NEON(), 0, 0.25, z); }
  P(g, rbox(0.25, 0.26, 0.1, 0.012), m.gunmetal, 0, 0.12, 0.155);                 // breech block joins all 4 tubes
  P(g, cylZ(0.07, 0.09, 0.05, 28), m.darksteel, 0, 0.12, 0.215);                   // socket into the baseplate
  const plate = P(g, new THREE.CylinderGeometry(0.22, 0.24, 0.035, 28), m.darksteel, 0, 0.12, 0.25, PI / 2); plate.scale.set(1, 1, 0.9);
  P(g, torus(0.23, 0.008, 40), PINK(), 0, 0.12, 0.27);
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * 0.08, 0.04, -0.4), to = new THREE.Vector3(sx * 0.26, -0.26, -0.52);
    const mid = from.clone().add(to).multiplyScalar(0.5); const leg = P(g, cylY(0.013, 0.013, 0.4, 10), m.darksteel, mid.x, mid.y, mid.z);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); leg.scale.y = from.distanceTo(to) / 0.4;
    P(g, cylY(0.035, 0.04, 0.014, 14), m.polymer, to.x, to.y - 0.005, to.z);
  }
  P(g, rbox(0.05, 0.06, 0.1, 0.008), m.polymer, -0.17, 0.2, -0.3); P(g, cylZ(0.014, 0.014, 0.03, 12), NEON(), -0.17, 0.21, -0.36);
  P(g, rbox(0.04, 0.03, 0.06, 0.006), m.polymer, 0, 0.0, 0.0); P(g, rbox(0.035, 0.11, 0.05, 0.008), m.polymer, 0, -0.06, 0.02, 0.2);
  const round = new THREE.Group(); round.name = 'round'; round.position.set(-0.06, 0.06, -0.74); g.add(round);
  marker(g, 'muzzle', 0, 0.12, -0.75); marker(g, 'foregrip', 0, 0.0, -0.3); marker(g, 'sight', -0.17, 0.21, -0.1);
  return g;
}

export const ULTRA_BUILDERS = {
  assault_rifle_ultra, ak47_ultra, dmr_ultra, rocket_launcher_ultra, burst_rifle_ultra, lmg_ultra,
  heavy_sniper_ultra, flamethrower_ultra, grenade_launcher_ultra, mortar_ultra,
};
void cylY; void sphere; void holoSight; void rbox;
