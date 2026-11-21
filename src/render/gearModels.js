// Procedural meshes — Slot 3 (melee/hand-held), 4 (throwables), 5 (usables), 6 (wearables).
// Melee items: grip at origin, blade/head extends along +Y, cutting edge faces -Z.
import * as THREE from 'three';
import { P, rbox, box, cylZ, cylX, cylY, sphere, torus, profile, shapeGeo, latheY, tube, marker } from './modelKit.js';
import { tex } from './textures.js';

const PI = Math.PI;
const std = (o) => new THREE.MeshStandardMaterial(o);

// ───────── gloved hand (used by fists, viewmodel hands, tactical gloves) ─────────
export function glove(m, side = 1, opt = {}) {
  const g = new THREE.Group();
  const leather = opt.mat || std({ color: 0x262a22, roughness: 0.75, metalness: 0.05 });
  P(g, rbox(0.085, 0.085, 0.05, 0.02), leather, 0, 0, 0.0);                       // palm/back
  for (let i = 0; i < 4; i++) P(g, rbox(0.021, 0.03, 0.048, 0.009), leather, -0.032 + i * 0.0215, 0.022, -0.035);   // curled fingers (top row)
  for (let i = 0; i < 4; i++) P(g, rbox(0.02, 0.026, 0.03, 0.009), leather, -0.032 + i * 0.0215, -0.008, -0.05);   // finger tips folded
  P(g, rbox(0.024, 0.05, 0.026, 0.01), leather, side * 0.048, -0.012, -0.012, 0, 0, side * 0.35);                    // thumb
  if (opt.guard !== false) {
    const guard = opt.guardMat || std({ color: 0x1a1a1c, metalness: 0.5, roughness: 0.35 });
    P(g, rbox(0.094, 0.028, 0.016, 0.006), guard, 0, 0.03, -0.062);                // knuckle guard plate
    for (let i = 0; i < 4; i++) P(g, sphere(0.008, 10, 8), m.steel, -0.032 + i * 0.0215, 0.03, -0.072);
    P(g, rbox(0.07, 0.04, 0.008, 0.004), guard, 0, 0.0, 0.028);                  // back plate
  }
  P(g, cylZ(0.036, 0.034, 0.045, 18), leather, 0, -0.005, 0.045).scale.set(1.05, 0.85, 1);   // cuff
  P(g, rbox(0.076, 0.012, 0.022, 0.004), m.orange, 0, 0.026, 0.04);              // velcro strap
  return g;
}

// ───────────────────────── Slot 3 ─────────────────────────
function fists(m) {
  const g = new THREE.Group();
  const l = glove(m, -1); l.position.set(-0.07, 0, 0); g.add(l);
  const r = glove(m, 1); r.position.set(0.07, 0, 0); g.add(r);
  marker(g, 'tip', 0, 0, -0.08);
  return g;
}

function knife(m) {
  const g = new THREE.Group();
  P(g, cylY(0.015, 0.017, 0.11, 14), m.grip, 0, -0.055, 0).scale.set(0.8, 1, 1);
  P(g, cylY(0.018, 0.018, 0.012, 14), m.darksteel, 0, -0.115, 0).scale.set(0.8, 1, 1);
  P(g, rbox(0.022, 0.012, 0.07, 0.003), m.darksteel, 0, 0.004, -0.005);
  const blade = P(g, profile([[-0.016, 0.008], [0.016, 0.008], [0.017, 0.13], [0.0, 0.19], [-0.016, 0.16]], 0.004, 0.0015), m.steel);
  void blade;
  for (const sx of [-1, 1]) P(g, rbox(0.0012, 0.09, 0.006, 0.0005), m.darksteel, sx * 0.0028, 0.075, 0.003);   // fuller
  for (let i = 0; i < 6; i++) P(g, profile([[0, 0], [0.0, 0.01], [-0.007, 0.005]], 0.004, 0), m.steel, 0, 0.06 + i * 0.011, 0.016);   // spine serrations
  marker(g, 'tip', 0, 0.19, 0);
  return g;
}

function scythe(m) {
  const g = new THREE.Group();
  const haft = std({ color: 0x2e1c12, roughness: 0.6, map: tex('wood') });
  P(g, cylY(0.017, 0.019, 1.55, 14), haft, 0, 0.4, 0);
  for (const y of [-0.05, 0.0, 0.05, 0.62, 0.68]) P(g, torus(0.019, 0.004, 14), m.leather, 0, y, 0, PI / 2);
  P(g, cylZ(0.012, 0.012, 0.12, 10), haft, 0, 0.65, -0.06);                      // nib handle
  P(g, cylY(0.026, 0.022, 0.08, 14), m.darksteel, 0, 1.15, 0);
  P(g, sphere(0.024, 14, 10), m.darksteel, 0, 1.2, 0);
  P(g, cylY(0.022, 0.02, 0.04, 14), m.darksteel, 0, -0.36, 0);
  const s = new THREE.Shape();
  s.moveTo(-0.02, 1.08); s.lineTo(-0.02, 1.2);
  s.quadraticCurveTo(0.38, 1.3, 0.8, 1.0);
  s.quadraticCurveTo(0.42, 1.13, 0.02, 1.08);
  s.closePath();
  P(g, shapeGeo(s, 0.007, 0.002, 32), std({ color: 0x5d636c, metalness: 0.9, roughness: 0.28 }));
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.08, -0.02), new THREE.Vector3(0, 1.13, -0.42), new THREE.Vector3(0, 1.0, -0.8));
  const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0075, 6, false), std({ color: 0x9cfff0, emissive: 0x33ffd6, emissiveIntensity: 3.2 }));
  g.add(edge);
  marker(g, 'tip', 0, 1.0, -0.8);
  return g;
}

function bat(m) {
  const g = new THREE.Group();
  const alu = std({ color: 0x9a1d2a, metalness: 0.9, roughness: 0.25 });
  P(g, latheY([[0, -0.06], [0.026, -0.06], [0.028, -0.045], [0.016, -0.035], [0.0135, 0.0], [0.014, 0.25], [0.022, 0.4], [0.033, 0.56], [0.035, 0.72], [0.033, 0.74], [0, 0.745]], 28), alu);
  P(g, cylY(0.0148, 0.0148, 0.22, 16), m.rubber, 0, 0.08, 0);
  P(g, cylY(0.0352, 0.0352, 0.04, 24), m.white, 0, 0.62, 0);
  P(g, cylY(0.0353, 0.0353, 0.012, 24), m.orange, 0, 0.62, 0);
  P(g, cylY(0.0275, 0.0275, 0.012, 24), m.darksteel, 0, -0.052, 0);                // knob cap
  P(g, cylY(0.0326, 0.0326, 0.006, 24), m.darksteel, 0, 0.738, 0);                // end cap
  for (let i = 0; i < 6; i++) P(g, torus(0.0149, 0.0016, 16), m.polymer, 0, -0.01 + i * 0.038, 0, Math.PI / 2, 0, 0.3); // tape wraps
  marker(g, 'tip', 0, 0.7, 0);
  return g;
}

function karambit(m) {
  const g = new THREE.Group();
  P(g, torus(0.02, 0.006, 20), m.darksteel, 0, -0.105, 0.0, 0, PI / 2);
  P(g, profile([[-0.012, -0.085], [0.014, -0.09], [0.018, -0.02], [0.012, 0.0], [-0.01, 0.0], [-0.016, -0.04]], 0.016, 0.004), std({ color: 0xff6a1a, metalness: 0.2, roughness: 0.5 }));
  for (const y of [-0.06, -0.025]) for (const sx of [-1, 1]) P(g, cylX(0.004, 0.004, 0.022, 8), m.steel, sx * 0.0, y, 0.0);
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0.0); s.lineTo(0.014, 0.0);
  s.quadraticCurveTo(0.05, 0.05, 0.1, 0.035);
  s.quadraticCurveTo(0.04, 0.08, -0.012, 0.02);
  s.closePath();
  P(g, shapeGeo(s, 0.004, 0.0012), m.steel);
  marker(g, 'tip', 0, 0.035, -0.1);
  return g;
}

function katana(m, opt = {}) {
  const g = new THREE.Group();
  const candy = opt.holiday === 'candycane';
  const wrap = tex('wrap', [1, 4]);
  P(g, cylY(0.016, 0.016, 0.24, 16), std({ color: 0xffffff, map: wrap, roughness: 0.8 }), 0, -0.1, 0).scale.set(0.75, 1, 1);
  P(g, cylY(0.018, 0.018, 0.02, 16), m.brass, 0, -0.225, 0).scale.set(0.75, 1, 1);
  P(g, cylY(0.046, 0.046, 0.008, 28), m.darksteel, 0, 0.025, 0).scale.set(0.85, 1, 1);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; P(g, cylY(0.008, 0.008, 0.009, 10), m.brass, Math.cos(a) * 0.03, 0.025, Math.sin(a) * 0.03); }
  P(g, rbox(0.012, 0.03, 0.034, 0.002), m.brass, 0, 0.044, -0.002);
  const N = 24, L = 0.74, curv = 0.05;
  const pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const w = 0.032 * (1 - t * 0.25); const back = -curv * t * t; pts.push([0.016 + back - (t > 0.92 ? (t - 0.92) * 0.3 : 0), 0.06 + t * L, w]); }
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) s.lineTo(p[0], p[1]);
  for (let i = N; i >= 0; i--) { const p = pts[i]; s.lineTo(p[0] - p[2] * (i === N ? 0.1 : 1), p[1] - (i === N ? 0.03 : 0)); }
  s.closePath();
  let bladeMat = m.steel;
  if (candy) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#d4141e';
    for (let i = -4; i < 20; i++) { x.beginPath(); x.moveTo(0, i * 24); x.lineTo(64, i * 24 + 30); x.lineTo(64, i * 24 + 42); x.lineTo(0, i * 24 + 12); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 6);
    bladeMat = std({ color: 0xffffff, map: t, roughness: 0.25, metalness: 0.1 });
  }
  P(g, shapeGeo(s, 0.006, 0.0015, 8), bladeMat);
  if (!candy) {
    const h = new THREE.Shape(); h.moveTo(pts[1][0], pts[1][1]);
    for (let i = 1; i < N; i++) h.lineTo(pts[i][0], pts[i][1]);
    for (let i = N - 1; i >= 1; i--) h.lineTo(pts[i][0] - 0.009 - Math.sin(i * 1.7) * 0.0015, pts[i][1]);
    h.closePath();
    P(g, shapeGeo(h, 0.0074, 0, 4), std({ color: 0xeef4ff, metalness: 0.85, roughness: 0.12 }));
  }
  marker(g, 'tip', 0, 0.8, 0.02);
  return g;
}

function sledgehammer(m) {
  const g = new THREE.Group();
  P(g, cylY(0.018, 0.02, 0.95, 14), m.wood, 0, 0.17, 0);
  P(g, cylY(0.021, 0.021, 0.2, 14), m.rubber, 0, -0.18, 0);
  const iron = std({ color: 0x3a3c40, metalness: 0.85, roughness: 0.5 });
  P(g, rbox(0.085, 0.085, 0.2, 0.012), iron, 0, 0.66, 0);
  for (const sz of [-1, 1]) { P(g, cylZ(0.05, 0.05, 0.05, 8), iron, 0, 0.66, sz * 0.12); P(g, cylZ(0.046, 0.046, 0.006, 8), m.darksteel, 0, 0.66, sz * 0.147); }
  for (const sz of [-1, 1]) P(g, rbox(0.09, 0.09, 0.014, 0.003), m.darksteel, 0, 0.66, sz * 0.05);
  P(g, rbox(0.05, 0.06, 0.05, 0.004), m.darksteel, 0, 0.6, 0);
  marker(g, 'tip', 0, 0.66, -0.15);
  return g;
}

export function starGeo(R = 0.055, r = 0.016) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; const rr = i % 2 ? r : R; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, 0.007, 0, PI * 2, true); s.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.002, bevelSegments: 1 });
  geo.translate(0, 0, -0.0015); geo.rotateX(-PI / 2); geo.computeVertexNormals();
  return geo;
}
function shurikens(m) {
  const g = new THREE.Group(); const geo = starGeo();
  const mat = std({ color: 0xc8d0d8, metalness: 1, roughness: 0.18 });
  for (let i = 0; i < 3; i++) { const s = P(g, geo, mat, 0.0, 0.012 * i, 0.0, 0, i * 0.35, 0); s.name = 'star' + i; P(s, cylY(0.0075, 0.0075, 0.005, 12), m.darksteel); }
  P(g, cylY(0.004, 0.004, 0.04, 8), m.darksteel, 0, 0.012, 0);
  P(g, rbox(0.03, 0.05, 0.012, 0.004), m.leather, 0, 0.0, 0.07);                  // wrist pouch
  P(g, rbox(0.032, 0.012, 0.014, 0.003), m.orange, 0, 0.022, 0.07);
  marker(g, 'tip', 0, 0, -0.05);
  return g;
}

export function slipperMesh(m) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.13); s.bezierCurveTo(0.05, -0.13, 0.052, -0.06, 0.048, 0.0); s.bezierCurveTo(0.044, 0.07, 0.06, 0.13, 0.0, 0.135); s.bezierCurveTo(-0.055, 0.135, -0.058, 0.05, -0.044, 0.0); s.bezierCurveTo(-0.034, -0.05, -0.05, -0.13, 0, -0.13);
  const mk = (d) => { const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2, curveSegments: 20 }); geo.rotateX(-PI / 2); return geo; };
  P(g, mk(0.012), std({ color: 0xd6201a, roughness: 0.7 }), 0, 0, 0);
  P(g, mk(0.008), std({ color: 0xffd21e, roughness: 0.6 }), 0, 0.016, 0);
  const strap = std({ color: 0x1e5adc, roughness: 0.5 });
  P(g, cylY(0.004, 0.004, 0.03, 8), strap, 0, 0.035, -0.09);
  for (const sx of [-1, 1]) P(g, tube([[0, 0.045, -0.09], [sx * 0.025, 0.055, -0.06], [sx * 0.045, 0.045, -0.02], [sx * 0.048, 0.026, 0.0]], 0.006, 24, 8), strap);
  return g;
}
function slippers(m) {
  const g = new THREE.Group(); const s = slipperMesh(m); s.rotation.set(-0.4, 0, 0); s.position.set(0, 0.03, -0.02); g.add(s);
  marker(g, 'tip', 0, 0.05, -0.12);
  return g;
}

// ───────────────────────── Slot 4 ─────────────────────────
function spoonPin(g, m, top) {
  P(g, rbox(0.012, 0.075, 0.006, 0.002), m.steel, 0.0, top - 0.035, 0.032, -0.12);
  P(g, torus(0.012, 0.0022, 14), m.steel, 0.022, top + 0.006, 0.0, 0, PI / 2);
  P(g, cylY(0.012, 0.012, 0.02, 12), m.steel, 0, top, 0);
}
function frag(m) {
  const g = new THREE.Group();
  const body = std({ color: 0x4d5a33, metalness: 0.3, roughness: 0.55 });
  P(g, latheY([[0, -0.045], [0.022, -0.042], [0.034, -0.025], [0.036, 0.0], [0.033, 0.025], [0.02, 0.045], [0.012, 0.05], [0, 0.05]], 24), body);
  for (const y of [-0.025, 0.0, 0.025]) P(g, torus(Math.sqrt(Math.max(0.0001, 0.036 ** 2 - (y * 0.85) ** 2)), 0.0028, 24), body, 0, y, 0, PI / 2);
  for (let i = 0; i < 6; i++) P(g, torus(0.037, 0.0025, 20, PI), body, 0, 0.0, 0, 0, (i / 6) * PI, PI / 2);
  spoonPin(g, m, 0.058);
  return g;
}
function smoke_grenade(m) {
  const g = new THREE.Group();
  P(g, cylY(0.03, 0.03, 0.11, 22), std({ color: 0x7a8072, metalness: 0.4, roughness: 0.5 }), 0, 0, 0);
  P(g, cylY(0.0305, 0.0305, 0.025, 22), std({ color: 0x48c86a, roughness: 0.5 }), 0, 0.01, 0);
  P(g, cylY(0.031, 0.031, 0.008, 22), m.white, 0, -0.03, 0);
  P(g, cylY(0.02, 0.03, 0.012, 22), m.darksteel, 0, 0.061, 0);
  spoonPin(g, m, 0.075);
  return g;
}
function molotov(m) {
  const g = new THREE.Group();
  const glass = std({ color: 0x5a7a2a, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.6 });
  P(g, latheY([[0, -0.08], [0.036, -0.08], [0.04, -0.07], [0.04, 0.04], [0.03, 0.07], [0.013, 0.1], [0.013, 0.14], [0.015, 0.145], [0, 0.145]], 24), glass);
  P(g, latheY([[0, -0.075], [0.034, -0.075], [0.034, 0.02], [0, 0.02]], 20), std({ color: 0xd88a1a, roughness: 0.2, transparent: true, opacity: 0.85, emissive: 0x301000 }));
  P(g, rbox(0.03, 0.06, 0.016, 0.006), std({ color: 0xd8cfb8, roughness: 1 }), 0.005, 0.16, 0, 0, 0, 0.25);
  P(g, rbox(0.016, 0.05, 0.01, 0.004), std({ color: 0xc0b8a0, roughness: 1 }), 0.025, 0.12, 0.01, 0, 0, -0.3);
  const fl = P(g, new THREE.ConeGeometry(0.018, 0.06, 10), m.glowOrange, 0.01, 0.215, 0); fl.name = 'pilot';
  return g;
}
function flashbang(m) {
  const g = new THREE.Group();
  P(g, cylY(0.026, 0.026, 0.12, 20), std({ color: 0x2d3034, metalness: 0.7, roughness: 0.35 }), 0, 0, 0);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + r * 0.4; P(g, cylX(0.005, 0.005, 0.004, 10), m.polymer, Math.cos(a) * 0.0255, -0.03 + r * 0.03, Math.sin(a) * 0.0255, 0, -a, 0); }
  P(g, cylY(0.0262, 0.0262, 0.01, 20), m.white, 0, 0.05, 0);
  spoonPin(g, m, 0.068);
  return g;
}
function sticky_bomb(m) {
  const g = new THREE.Group();
  P(g, new THREE.SphereGeometry(0.045, 24, 12, 0, PI * 2, 0, PI / 2), std({ color: 0x33373c, metalness: 0.6, roughness: 0.4 }), 0, 0, 0);
  P(g, cylY(0.048, 0.05, 0.016, 24), std({ color: 0x5cd650, roughness: 0.9, emissive: 0x0a3008 }), 0, -0.008, 0);
  const led = P(g, sphere(0.007, 10, 8), m.reddot, 0, 0.044, 0); led.name = 'led';
  P(g, cylY(0.0015, 0.0015, 0.06, 6), m.steel, 0.02, 0.06, 0.0);
  P(g, torus(0.03, 0.003, 20), m.yellow, 0, 0.022, 0, PI / 2);
  return g;
}

// ───────────────────────── Slot 5 ─────────────────────────
function medkit(m) {
  const g = new THREE.Group();
  P(g, rbox(0.22, 0.15, 0.08, 0.015), m.white, 0, 0, 0);
  for (const sz of [-1, 1]) { P(g, box(0.05, 0.016, 0.004), m.red, 0, 0, sz * 0.041); P(g, box(0.016, 0.05, 0.004), m.red, 0, 0, sz * 0.041); }
  P(g, box(0.222, 0.01, 0.082), m.red, 0, 0.04, 0);
  P(g, tube([[-0.05, 0.075, 0], [-0.04, 0.11, 0], [0.04, 0.11, 0], [0.05, 0.075, 0]], 0.008, 20, 8), m.polymer);
  return g;
}
function ammo_pack(m) {
  const g = new THREE.Group();
  P(g, rbox(0.24, 0.15, 0.1, 0.008), m.olive, 0, 0, 0);
  P(g, rbox(0.245, 0.03, 0.105, 0.006), m.olive, 0, 0.07, 0);
  P(g, box(0.15, 0.03, 0.002), m.yellow, 0, -0.01, 0.051);
  P(g, tube([[-0.04, 0.085, 0], [-0.03, 0.115, 0], [0.03, 0.115, 0], [0.04, 0.085, 0]], 0.007, 20, 8), m.darksteel);
  P(g, rbox(0.03, 0.04, 0.012, 0.003), m.darksteel, 0.1, 0.05, 0.05);
  for (let i = 0; i < 5; i++) P(g, cylY(0.006, 0.004, 0.035, 8), m.brass, -0.08 + i * 0.012, 0.1, 0.02);
  return g;
}
function armor_plate(m) {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.absarc(0, 0, 0.42, PI / 2 - 0.3, PI / 2 + 0.3, false); s.absarc(0, 0, 0.4, PI / 2 + 0.3, PI / 2 - 0.3, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, -0.41, -0.14); geo.rotateX(PI / 2);
  P(g, geo, std({ color: 0x5b6168, metalness: 0.6, roughness: 0.4 }));
  P(g, box(0.06, 0.07, 0.002), m.orange, 0, 0.0, 0.0).position.set(0, 0.02, 0.0);
  for (const sx of [-1, 1]) P(g, box(0.03, 0.01, 0.3), m.cloth, sx * 0.08, 0.018, 0);
  for (const sz of [-1, 1]) P(g, box(0.36, 0.012, 0.012), m.darksteel, 0, 0.012, sz * 0.14);   // edge trim
  P(g, rbox(0.1, 0.006, 0.05, 0.002), m.olive, 0, 0.022, -0.09);                // velcro patch
  P(g, rbox(0.04, 0.006, 0.03, 0.002), m.red, 0, 0.024, 0.1);                    // pull tab
  return g;
}
function adrenaline(m) {
  const g = new THREE.Group();
  P(g, cylY(0.013, 0.013, 0.12, 16), m.glass, 0, 0, 0);
  const fl = P(g, cylY(0.011, 0.011, 0.08, 16), m.glowGreen, 0, -0.015, 0); fl.name = 'fluid';
  P(g, cylY(0.004, 0.004, 0.08, 8), m.steel, 0, 0.09, 0);
  P(g, cylY(0.016, 0.016, 0.006, 16), m.polymer, 0, 0.13, 0);
  P(g, rbox(0.06, 0.006, 0.02, 0.002), m.polymer, 0, 0.06, 0);
  P(g, cylY(0.006, 0.01, 0.015, 12), m.darksteel, 0, -0.068, 0);
  P(g, cylY(0.0012, 0.0012, 0.05, 6), m.steel, 0, -0.1, 0);
  P(g, cylY(0.0135, 0.0135, 0.012, 16), m.orange, 0, 0.055, 0);
  return g;
}
export function barricadeMesh(m, w = 2.2, h = 1.3) {
  const g = new THREE.Group();
  const steel = std({ color: 0x5d646b, metalness: 0.75, roughness: 0.42, map: tex('metal') });
  P(g, rbox(w, h, 0.06, 0.02), steel, 0, h / 2, 0);
  P(g, box(w * 0.98, 0.14, 0.064), m.hazard, 0, h - 0.12, 0);
  P(g, box(0.4, 0.05, 0.07), m.polymer, 0, h * 0.62, 0);
  for (const sx of [-0.35, 0, 0.35]) P(g, rbox(0.06, h * 0.9, 0.08, 0.01), m.darksteel, sx * w, h * 0.45, 0.02);
  for (const sx of [-0.38, 0.38]) { // rear support struts + foot plates
    const top = new THREE.Vector3(sx * w, h * 0.7, 0.05), foot = new THREE.Vector3(sx * w, 0.02, h * 0.45);
    const d = foot.clone().sub(top); const len = d.length();
    const st = P(g, box(0.05, 0.05, len), m.darksteel, (top.x + foot.x) / 2, (top.y + foot.y) / 2, (top.z + foot.z) / 2, Math.atan2(-d.y, d.z), 0, 0); void st;
    P(g, box(0.14, 0.02, 0.14), m.darksteel, foot.x, 0.01, foot.z);
    P(g, cylX(0.03, 0.03, 0.07, 10), m.steel, top.x, top.y, top.z);
  }
  return g;
}
function barricade(m) {
  const g = new THREE.Group(); const b = barricadeMesh(m, 0.5, 0.3); g.add(b); b.position.y = -0.15;
  return g;
}

// ───────────────────────── Slot 6 ─────────────────────────
function tactical_gloves(m) {
  const g = new THREE.Group();
  const l = glove(m, -1, { guard: true }); l.position.set(-0.07, 0, 0); l.rotation.y = 0.2; g.add(l);
  const r = glove(m, 1, { guard: true }); r.position.set(0.07, 0, 0); r.rotation.y = -0.2; g.add(r);
  return g;
}
function bootMesh(m) {
  const g = new THREE.Group();
  const leather = std({ color: 0x2b2620, roughness: 0.7 });
  P(g, rbox(0.1, 0.035, 0.28, 0.012), m.rubber, 0, 0.0, -0.02);
  P(g, rbox(0.095, 0.08, 0.22, 0.03), leather, 0, 0.05, 0.0);
  P(g, rbox(0.09, 0.14, 0.1, 0.03), leather, 0, 0.14, 0.05);
  for (let i = 0; i < 4; i++) P(g, box(0.06, 0.004, 0.006), m.orange, 0, 0.08 + i * 0.025, -0.0 - 0.0 + 0.0 - (i < 2 ? 0.07 - i * 0.03 : 0.002), 0, 0, 0).position.set(0, 0.07 + i * 0.03, i < 2 ? -0.06 + i * 0.04 : 0.0);
  const helix = []; for (let i = 0; i <= 60; i++) { const t = i / 60; const a = t * PI * 2 * 5; helix.push([Math.cos(a) * 0.024, -0.02 - t * 0.07, Math.sin(a) * 0.024 + 0.06]); }
  P(g, tube(helix, 0.004, 160, 6), m.steel);
  P(g, cylY(0.034, 0.034, 0.01, 18), m.cyan, 0, -0.095, 0.06);
  return g;
}
function spring_boots(m) {
  const g = new THREE.Group();
  const a = bootMesh(m); a.position.set(-0.065, 0.1, 0); g.add(a);
  const b = bootMesh(m); b.position.set(0.065, 0.1, 0.03); g.add(b);
  return g;
}
function bandolier(m) {
  const g = new THREE.Group();
  P(g, torus(0.17, 0.018, 40, PI * 1.25), m.leather, 0, 0, 0, 0, 0, -PI * 0.12).scale.set(1, 1, 0.5);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = -PI * 0.12 + 0.12 + (i / n) * PI * 1.0;
    const x = Math.cos(a) * 0.19, y = Math.sin(a) * 0.19;
    P(g, cylY(0.009, 0.009, 0.05, 10), i % 4 === 0 ? m.red : m.brass, x, y, 0.01, 0, 0, a - PI / 2);
  }
  return g;
}
function blast_vest(m) {
  const g = new THREE.Group();
  const cloth = std({ color: 0x4a5236, roughness: 0.9 });
  P(g, rbox(0.4, 0.46, 0.16, 0.05), cloth, 0, 0, 0);
  for (const sx of [-1, 1]) { P(g, rbox(0.11, 0.12, 0.04, 0.02), cloth, sx * 0.14, 0.26, 0.0); }
  P(g, rbox(0.3, 0.3, 0.03, 0.015), std({ color: 0x5d646b, metalness: 0.6, roughness: 0.45 }), 0, 0.03, -0.09);
  for (let i = 0; i < 3; i++) P(g, rbox(0.1, 0.1, 0.05, 0.015), cloth, -0.12 + i * 0.12, -0.17, -0.1);
  P(g, box(0.36, 0.03, 0.002), m.orange, 0, 0.17, -0.106);
  P(g, box(0.42, 0.04, 0.17), m.polymer, 0, -0.22, 0);
  return g;
}
function thermal_goggles(m) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    P(g, cylZ(0.03, 0.032, 0.07, 20), m.polymer, sx * 0.045, 0, -0.02);
    P(g, cylZ(0.024, 0.024, 0.004, 20), m.glowOrange, sx * 0.045, 0, -0.057);
    P(g, torus(0.03, 0.005, 20), m.rubber, sx * 0.045, 0, 0.015);
  }
  P(g, rbox(0.05, 0.03, 0.04, 0.008), m.polymer, 0, 0.0, -0.01);
  P(g, rbox(0.03, 0.02, 0.03, 0.005), m.darksteel, 0, 0.03, -0.0);
  P(g, torus(0.1, 0.008, 40, PI), m.cloth, 0, 0, 0.08, PI / 2, 0, 0).scale.set(1.0, 1.2, 1);
  return g;
}

function land_mine(m) {
  const g = new THREE.Group();
  const body = std({ color: 0x3a4030, metalness: 0.4, roughness: 0.55 });
  P(g, cylY(0.12, 0.13, 0.05, 32), body, 0, 0.025, 0);
  P(g, torus(0.12, 0.012, 32).rotateX(PI / 2), m.darksteel, 0, 0.05, 0);
  P(g, cylY(0.07, 0.075, 0.025, 28), m.darksteel, 0, 0.062, 0);
  P(g, cylY(0.05, 0.05, 0.012, 24), m.rubber, 0, 0.08, 0);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; P(g, cylY(0.008, 0.008, 0.012, 8), m.steel, Math.cos(a) * 0.098, 0.055, Math.sin(a) * 0.098); }
  P(g, rbox(0.03, 0.015, 0.02, 0.003), m.yellow, 0.1, 0.03, 0);
  const led = P(g, sphere(0.007, 10, 8), m.reddot, 0.06, 0.07, 0.03); led.name = 'led';
  P(g, cylY(0.13, 0.13, 0.006, 32), m.hazard, 0, 0.003, 0);
  return g;
}

function shockwave_grenade(m) {
  const g = new THREE.Group();
  const shell = std({ color: 0x2f6fd6, metalness: 0.5, roughness: 0.35 });
  P(g, cylY(0.032, 0.032, 0.1, 22), shell, 0, 0, 0);
  for (const y of [-0.03, 0.0, 0.03]) P(g, torus(0.033, 0.004, 20), std({ color: 0xbfe8ff, emissive: 0x3a90d0, emissiveIntensity: 0.8 }), 0, y, 0, PI / 2);
  P(g, cylY(0.022, 0.032, 0.014, 22), m.darksteel, 0, 0.057, 0);
  spoonPin(g, m, 0.072);
  return g;
}
function black_hole(m) {
  const g = new THREE.Group();
  P(g, sphere(0.04, 20, 14), std({ color: 0x050308, metalness: 0.9, roughness: 0.1 }));
  const glow = std({ color: 0x8a3cff, emissive: 0x8a3cff, emissiveIntensity: 1.4 });
  for (let i = 0; i < 3; i++) P(g, torus(0.05, 0.004, 24), m.darksteel, 0, 0, 0, PI / 2 + i * 0.6, i * 1.1, 0);
  P(g, torus(0.046, 0.003, 24), glow, 0, 0, 0, PI / 2);
  P(g, sphere(0.014, 10, 8), glow, 0, 0.05, 0);
  return g;
}

// ───────── Grapple Hook (slot 3): grip at origin, launcher + 3-tine hook along +Y ─────────
function hookTines(g, m, y0, len = 0.12) {
  P(g, cylY(0.008, 0.01, len, 10), m.steel, 0, y0 + len / 2, 0);
  P(g, sphere(0.014, 12, 10), m.steel, 0, y0 + len + 0.004, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2; const c = Math.cos(a), sn = Math.sin(a);
    const pts = [[0, y0 + len - 0.01, 0], [c * 0.03, y0 + len - 0.02, sn * 0.03], [c * 0.055, y0 + len - 0.06, sn * 0.055], [c * 0.05, y0 + len - 0.1, sn * 0.05], [c * 0.036, y0 + len - 0.115, sn * 0.036]];
    P(g, tube(pts, 0.0065, 24, 6), m.steel);
    P(g, cylY(0.0065, 0.0005, 0.02, 6), m.steel, c * 0.034, y0 + len - 0.124, sn * 0.034, PI);
  }
}
export function hookHead(m) {
  const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  hookTines(inner, m, -0.12, 0.12); inner.rotation.x = PI / 2;   // point along +Z (rope direction)
  inner.scale.setScalar(1.6);
  return g;
}
function grapple_hook(m) {
  const g = new THREE.Group();
  const body = std({ color: 0x3a4148, metalness: 0.7, roughness: 0.4 });
  P(g, cylY(0.019, 0.017, 0.13, 14), m.grip, 0, -0.05, 0).scale.set(0.85, 1, 1.1);          // grip
  P(g, rbox(0.012, 0.06, 0.04, 0.004), m.darksteel, 0, -0.01, 0.035);                          // trigger guard
  P(g, rbox(0.052, 0.07, 0.07, 0.012), body, 0, 0.045, -0.004);                                // receiver
  P(g, cylY(0.026, 0.03, 0.2, 18), body, 0, 0.17, 0);                                          // launch tube
  for (const y of [0.1, 0.17, 0.24]) P(g, torus(0.03, 0.004, 20).rotateX(PI / 2), m.orange, 0, y, 0);
  P(g, cylX(0.038, 0.038, 0.035, 22), m.darksteel, 0.045, 0.06, 0);                            // rope spool
  P(g, torus(0.03, 0.007, 22).rotateY(PI / 2), m.cloth, 0.045, 0.06, 0);
  P(g, cylX(0.012, 0.012, 0.05, 10), m.steel, 0.04, 0.06, 0);
  P(g, rbox(0.01, 0.03, 0.012, 0.002), m.reddot, 0, 0.09, -0.032);                              // charge light
  hookTines(g, m, 0.27, 0.11);
  marker(g, 'muzzle', 0, 0.33, 0);
  return g;
}

// ───────── Spear (slot 3): grip at origin, ash shaft along +Y, steel leaf blade on top ─────────
export function spear(m) {
  const g = new THREE.Group();
  const ash = std({ color: 0x8a6440, roughness: 0.7, map: tex('wood') });
  P(g, cylY(0.016, 0.019, 1.5, 12), ash, 0, 0.2, 0);                                           // shaft (-0.55 → 0.95)
  for (const y of [-0.06, 0.0, 0.06]) P(g, torus(0.019, 0.005, 12), m.leather, 0, y, 0, PI / 2);   // grip wraps
  P(g, cylY(0.02, 0.022, 0.06, 12), m.darksteel, 0, -0.56, 0);                                 // butt cap
  P(g, cylY(0.022, 0.017, 0.09, 12), m.darksteel, 0, 0.98, 0);                                 // socket
  for (const y of [0.95, 1.0]) P(g, torus(0.021, 0.003, 12), m.brass, 0, y, 0, PI / 2);
  const leaf = new THREE.Shape(); leaf.moveTo(-0.012, 0); leaf.quadraticCurveTo(-0.05, 0.08, -0.034, 0.16); leaf.lineTo(0, 0.27); leaf.lineTo(0.034, 0.16); leaf.quadraticCurveTo(0.05, 0.08, 0.012, 0); leaf.closePath();
  P(g, shapeGeo(leaf, 0.006, 0.003, 24), m.steel, 0, 1.02, -0.003);                            // blade
  P(g, rbox(0.006, 0.22, 0.012, 0.002), m.darksteel, 0, 1.13, 0);                              // midrib
  P(g, tube([[0.02, 0.9, 0], [0.04, 0.84, 0.02], [0.03, 0.76, 0.01]], 0.004), std({ color: 0xc8261e, roughness: 0.9 }));   // red tassel
  marker(g, 'tip', 0, 1.29, 0); marker(g, 'muzzle', 0, 1.0, 0);
  return g;
}

// ───────── Sentry Turret (slot 5): deployed tripod gun (≈1.1 m) + the carried case ─────────
export function sentryMesh(m) {
  const g = new THREE.Group();
  const armor = std({ color: 0x55603f, metalness: 0.45, roughness: 0.55, map: tex('metal') });
  const legTop = new THREE.Vector3(0, 0.58, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 6; const foot = new THREE.Vector3(Math.cos(a) * 0.42, 0.02, Math.sin(a) * 0.42);
    P(g, tube([legTop.toArray(), [foot.x * 0.6, 0.3, foot.z * 0.6], foot.toArray()], 0.022, 12, 8), m.darksteel);
    P(g, cylY(0.04, 0.05, 0.03, 12), m.rubber, foot.x, 0.015, foot.z);
  }
  P(g, cylY(0.07, 0.09, 0.14, 20), m.darksteel, 0, 0.56, 0);
  P(g, cylY(0.1, 0.1, 0.03, 24), m.hazard, 0, 0.64, 0);
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.66; g.add(head);
  P(head, cylY(0.05, 0.06, 0.12, 16), m.darksteel, 0, 0.06, 0);
  const tilt = new THREE.Group(); tilt.name = 'tilt'; tilt.position.y = 0.2; head.add(tilt);
  P(tilt, rbox(0.4, 0.24, 0.42, 0.04), armor, 0, 0, 0.02);
  P(tilt, rbox(0.42, 0.05, 0.3, 0.01), m.hazard, 0, 0.1, 0.04);
  for (const sx of [-1, 1]) {
    P(tilt, rbox(0.06, 0.2, 0.3, 0.02), m.darksteel, sx * 0.23, -0.01, 0.04);
    P(tilt, cylZ(0.032, 0.032, 0.16, 16), m.gunmetal, sx * 0.08, -0.03, -0.25);
    P(tilt, cylZ(0.016, 0.018, 0.3, 14), m.gunmetal, sx * 0.08, -0.03, -0.42);
    P(tilt, cylZ(0.024, 0.024, 0.06, 6), m.darksteel, sx * 0.08, -0.03, -0.56);
    marker(tilt, 'muzzle', sx * 0.08, -0.03, -0.6);
  }
  P(tilt, rbox(0.12, 0.12, 0.16, 0.015), m.olive, 0.29, -0.06, 0.06);                    // ammo box
  P(tilt, rbox(0.16, 0.07, 0.06, 0.015), m.polymer, 0, 0.07, -0.2);                      // sensor housing
  const eye = P(tilt, sphere(0.026, 14, 10), std({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2 }), 0, 0.07, -0.235); eye.name = 'eye';
  P(tilt, cylY(0.004, 0.004, 0.18, 6), m.darksteel, -0.15, 0.2, 0.15);                  // antenna
  return g;
}
function sentry_turret(m) {
  const g = new THREE.Group(); const t = sentryMesh(m); t.scale.setScalar(0.3); t.position.y = -0.2; g.add(t);
  P(g, rbox(0.06, 0.025, 0.04, 0.008), m.polymer, 0, -0.03, 0.03);   // carry handle
  return g;
}
export const GEAR_BUILDERS = {
  spear, grapple_hook, sentry_turret,
  land_mine,
  fists, knife, scythe, bat, karambit, katana, sledgehammer, shurikens, slippers,
  frag, smoke_grenade, molotov, flashbang, sticky_bomb,
  medkit, ammo_pack, armor_plate, adrenaline, barricade, shockwave_grenade, black_hole,
  tactical_gloves, spring_boots, bandolier, blast_vest, thermal_goggles,
};
