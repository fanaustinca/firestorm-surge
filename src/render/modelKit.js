// Shared helpers + PBR material palette for procedural weapon/gear meshes.
// Convention: weapons point down -Z, +Y up, origin at the primary (right-hand) grip.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tex } from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);

export function makeMaterials(skin = null) {
  const m = {
    gunmetal: std({ color: 0x2c3036, metalness: 0.85, roughness: 0.36 }),
    polymer: std({ color: 0x1d1f23, metalness: 0.15, roughness: 0.62 }),
    steel: std({ color: 0xb4bcc4, metalness: 1.0, roughness: 0.22 }),
    darksteel: std({ color: 0x55595f, metalness: 0.95, roughness: 0.32 }),
    olive: std({ color: 0x55633a, metalness: 0.2, roughness: 0.6 }),
    tan: std({ color: 0xb79c6b, metalness: 0.1, roughness: 0.6 }),
    white: std({ color: 0xd9dde0, metalness: 0.2, roughness: 0.45 }),
    wood: std({ color: 0xffffff, map: tex('wood'), metalness: 0.0, roughness: 0.55 }),
    brass: std({ color: 0xd2a640, metalness: 1.0, roughness: 0.28 }),
    rubber: std({ color: 0x141414, metalness: 0.0, roughness: 0.9 }),
    grip: std({ color: 0xffffff, map: tex('grip'), metalness: 0.1, roughness: 0.8 }),
    red: std({ color: 0xc8261e, metalness: 0.25, roughness: 0.45 }),
    yellow: std({ color: 0xf2c21b, metalness: 0.2, roughness: 0.45 }),
    orange: std({ color: 0xff6a1a, metalness: 0.4, roughness: 0.35, emissive: 0x401000 }),
    cyan: std({ color: 0x18d4ff, metalness: 0.4, roughness: 0.3, emissive: 0x0a5a70 }),
    glass: std({ color: 0x5fb8ff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55, emissive: 0x0b2a44 }),
    lens: std({ color: 0x1a3a5a, metalness: 0.9, roughness: 0.05, emissive: 0x112244 }),
    reddot: std({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.5 }),
    glowBlue: std({ color: 0x6fe3ff, emissive: 0x39c8ff, emissiveIntensity: 2.2 }),
    glowGreen: std({ color: 0x7dff6a, emissive: 0x3dff3a, emissiveIntensity: 1.8, transparent: true, opacity: 0.85 }),
    glowOrange: std({ color: 0xffae3a, emissive: 0xff7a10, emissiveIntensity: 2.4 }),
    glowPurple: std({ color: 0xd28cff, emissive: 0xa040ff, emissiveIntensity: 2.6 }),
    cloth: std({ color: 0x3b3f34, metalness: 0, roughness: 0.95 }),
    leather: std({ color: 0x4a2e1c, metalness: 0.05, roughness: 0.7 }),
    hazard: std({ color: 0xffffff, map: tex('hazard'), metalness: 0.2, roughness: 0.5 }),
  };
  if (skin) applySkin(m, skin);
  return m;
}

export function applySkin(m, skin) {
  const body = ['gunmetal', 'polymer', 'olive', 'tan', 'wood', 'white', 'darksteel'];
  if (skin === 'gold') {
    const gold = std({ color: 0xf5c542, metalness: 1, roughness: 0.18 });
    const dgold = std({ color: 0xb8860b, metalness: 1, roughness: 0.3 });
    body.forEach((k, i) => (m[k] = i % 2 ? dgold : gold));
  } else if (skin === 'neon') {
    const dark = std({ color: 0x14121c, metalness: 0.6, roughness: 0.3, emissive: 0x220a33 });
    const pink = std({ color: 0xff3df2, metalness: 0.3, roughness: 0.3, emissive: 0xff1fd8, emissiveIntensity: 1.4 });
    body.forEach((k, i) => (m[k] = i === 3 || i === 5 ? pink : dark));
    m.orange = m.cyan = std({ color: 0x3dfcff, emissive: 0x20f0ff, emissiveIntensity: 2 });
  } else if (skin === 'obsidian') {
    const ob = std({ color: 0x0b0b0f, metalness: 0.9, roughness: 0.08 });
    const vein = std({ color: 0x5a1a8c, metalness: 0.5, roughness: 0.2, emissive: 0x7a22ff, emissiveIntensity: 1.6 });
    body.forEach((k) => (m[k] = ob));
    m.orange = m.cyan = m.steel = vein;
  }
}

export function P(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const rbox = (w, h, d, r = 0.006) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// Cylinder along Z (rTop faces -Z / forward)
export const cylZ = (r1, r2, len, seg = 20, open = false) => new THREE.CylinderGeometry(r1, r2, len, seg, 1, open).rotateX(-Math.PI / 2);
export const cylX = (r1, r2, len, seg = 16) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateZ(Math.PI / 2);
export const cylY = (r1, r2, len, seg = 16) => new THREE.CylinderGeometry(r1, r2, len, seg);
export const sphere = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
export const torus = (R, r, seg = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 10, seg, arc);

// Side profile shape. points = [[forward, up], ...] — forward maps to -Z, extruded across X (centered).
export function profile(points, depth, bevel = 0.004) {
  const s = new THREE.Shape();
  points.forEach(([f, u], i) => (i ? s.lineTo(f, u) : s.moveTo(f, u)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2); // shape x → world -Z
  g.computeVertexNormals();
  return g;
}

// Same but from a THREE.Shape built by the caller (for curves).
export function shapeGeo(shape, depth, bevel = 0.003, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// Lathe around Z: points [[radius, forward], ...]
export function latheZ(points, seg = 24) {
  const g = new THREE.LatheGeometry(points.map(([r, f]) => new THREE.Vector2(r, f)), seg);
  g.rotateX(-Math.PI / 2); // +Y (lathe axis) → -Z (forward)
  return g;
}
export function latheY(points, seg = 24) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function tube(pts, r, seg = 40, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

// Picatinny rail along Z between z0 (back) and z1 (front) at height y
export function rail(parent, m, z0, z1, y, x = 0, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, 0); g.rotation.z = rot; parent.add(g);
  const len = z0 - z1;
  P(g, rbox(0.022, 0.008, len, 0.002), m.polymer, 0, y, (z0 + z1) / 2);
  const n = Math.floor(len / 0.012);
  const slot = box(0.026, 0.006, 0.006);
  const inst = new THREE.InstancedMesh(slot, m.polymer, n);
  const mt = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { mt.makeTranslation(0, y + 0.007, z0 - 0.006 - i * 0.012); inst.setMatrixAt(i, mt); }
  inst.castShadow = true; g.add(inst);
  return g;
}

export function marker(parent, name, x, y, z) {
  const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o;
}

// Holographic sight on top rail at (y, z)
export function holoSight(parent, m, y, z) {
  const g = new THREE.Group(); g.position.set(0, y, z); parent.add(g);
  P(g, rbox(0.034, 0.016, 0.07, 0.004), m.polymer, 0, 0.008, 0);
  P(g, rbox(0.006, 0.05, 0.06, 0.002), m.gunmetal, 0.019, 0.035, 0);
  P(g, rbox(0.006, 0.05, 0.06, 0.002), m.gunmetal, -0.019, 0.035, 0);
  P(g, rbox(0.044, 0.006, 0.06, 0.002), m.gunmetal, 0, 0.062, 0);
  P(g, box(0.032, 0.042, 0.002), m.glass, 0, 0.038, -0.02);
  P(g, sphere(0.0022, 8, 6), m.reddot, 0, 0.04, -0.021);
  P(g, rbox(0.012, 0.012, 0.02, 0.002), m.gunmetal, 0.025, 0.02, 0.01);
  marker(parent, 'sight', 0, y + 0.04, z + 0.12);
  return g;
}

export function scope(parent, m, y, z, len = 0.28, r = 0.022, bell = 0.032) {
  const g = new THREE.Group(); g.position.set(0, y, z); parent.add(g);
  P(g, cylZ(r, r, len * 0.55, 24), m.gunmetal, 0, 0, 0);
  P(g, latheZ([[0.0, -0.5 * len], [bell, -0.5 * len], [bell, -0.42 * len], [r, -0.28 * len]], 28), m.gunmetal, 0, 0, 0).position.z = 0;
  P(g, latheZ([[r, 0.28 * len], [bell * 0.9, 0.4 * len], [bell * 0.9, 0.5 * len], [0, 0.5 * len]], 28), m.gunmetal);
  P(g, cylZ(bell * 0.86, bell * 0.86, 0.004, 24), m.lens, 0, 0, -0.5 * len - 0.001);
  P(g, cylZ(bell * 0.8, bell * 0.8, 0.004, 24), m.lens, 0, 0, 0.5 * len + 0.001);
  P(g, cylY(0.012, 0.012, 0.03, 16), m.darksteel, 0, r + 0.012, 0);
  P(g, cylX(0.012, 0.012, 0.03, 16), m.darksteel, r + 0.012, 0, 0);
  for (const zz of [-0.08 * len * 3, 0.08 * len * 3]) {
    P(g, torus(r + 0.004, 0.005, 20), m.polymer, 0, 0, zz);
    P(g, rbox(0.02, Math.max(0.01, y - 0.02), 0.016, 0.002), m.polymer, 0, -(r + y) / 2 + 0.01, zz);
  }
  marker(parent, 'sight', 0, y, z + len * 0.5 + 0.06);
  return g;
}

export function shadowAll(obj) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; }
