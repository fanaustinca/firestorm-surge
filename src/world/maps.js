// Map builders. Each returns { group, world, spawns, nav, lights, info } for a 75×75 m footprint.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { tex } from '../render/textures.js';

export const MAPS = {
  cargo_yard: { name: 'Cargo Yard', desc: 'Stacked containers, ladders, cranes and tight alleys.' },
  desert_outpost: { name: 'Desert Outpost', desc: 'Sunlit canyon base, stone bunkers, 55 m sniper lanes.' },
  abandoned_city: { name: 'Abandoned City', desc: 'Ruined brick intersection with vine-covered sniper windows.' },
  underground_lab: { name: 'Underground Lab', desc: 'Indoor research facility. Low ceilings block mortars.' },
};

const std = (o) => new THREE.MeshStandardMaterial(o);

// Box geometry with world-scaled UVs (texScale meters per texture repeat)
function boxUV(sx, sy, sz, ts = 4) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
  return g;
}

class Builder {
  constructor() {
    this.group = new THREE.Group(); this.world = new CollisionWorld();
    this.batches = new Map(); // material → [geometries]
    this.spawns = { red: [], blue: [], ffa: [] };
    this.climbMeshes = [];
  }
  mat(key, make) { if (!this._mats) this._mats = {}; if (!this._mats[key]) this._mats[key] = make(); return this._mats[key]; }
  batch(geo, mat, x, y, z, ry = 0) {
    geo.rotateY(ry); geo.translate(x, y, z);
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat).push(geo);
  }
  // Solid textured box: visual + collider. y is the BOTTOM.
  solid(x, y, z, sx, sy, sz, mat, opts = {}) {
    if (mat) this.batch(boxUV(sx, sy, sz, opts.ts || 4), mat, x, y + sy / 2, z);
    if (opts.collide !== false) return this.world.addCS(x, y + sy / 2, z, sx, sy, sz, opts.col || {});
  }
  // Axis-aligned wall from (x0,z0) to (x1,z1) with openings [{a,b,y0,y1}] in local distance along the wall
  wall(x0, z0, x1, z1, y0, y1, th, mat, openings = [], opts = {}) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sx = alongX ? Math.sign(x1 - x0) : 0, sz = alongX ? 0 : Math.sign(z1 - z0);
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      const m = (a + b) / 2; const cx = x0 + sx * m, cz = z0 + sz * m;
      if (alongX) this.solid(cx, ya, cz, b - a, yb - ya, th, mat, opts); else this.solid(cx, ya, cz, th, yb - ya, b - a, mat, opts);
    };
    const ops = [...openings].sort((p, q) => p.a - q.a);
    let cur = 0;
    for (const o of ops) { seg(cur, o.a, y0, y1); seg(o.a, o.b, y0, o.y0); seg(o.a, o.b, o.y1, y1); cur = o.b; }
    seg(cur, L, y0, y1);
  }
  // Climbable surface (ladder/vine/net/cable): thin collider + visual supplied by caller
  climbable(x, z, w, h, axis, y0 = 0, depth = 0.14) {
    const sx = axis === 'x' ? w : depth, sz = axis === 'x' ? depth : w;
    return this.world.addCS(x, y0 + h / 2, z, sx, h, sz, { climbable: true });
  }
  instanced(geo, mat, matrices, colors, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    if (colors) colors.forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
    im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    this.group.add(im); return im;
  }
  finish() {
    for (const [mat, geos] of this.batches) {
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = !mat.userData.noCast; mesh.receiveShadow = true;
      this.group.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
}

const M4 = (x, y, z, ry = 0, s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(...s));

function ground(b, texName, rep, color = 0xffffff, rough = 0.95) {
  const t = tex(texName, rep);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), std({ map: t, color, roughness: rough }));
  g.receiveShadow = true; b.group.add(g);
  return g;
}

function ladderVisual(b, x, z, h, ry) {
  const yellow = b.mat('ladder', () => std({ color: 0xf2c21b, metalness: 0.5, roughness: 0.45 }));
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  for (const sx of [-0.28, 0.28]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), yellow); r.position.set(sx, h / 2, 0); r.castShadow = true; g.add(r); }
  const n = Math.floor(h / 0.3);
  const rung = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6).rotateZ(Math.PI / 2), yellow, n);
  for (let i = 0; i < n; i++) rung.setMatrixAt(i, M4(0, 0.25 + i * 0.3, 0));
  rung.castShadow = true; g.add(rung);
  b.group.add(g);
}

function vineVisual(b, x, z, w, h, ry, y0 = 0) {
  const m = b.mat('vines', () => std({ map: tex('vines'), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85, color: 0xffffff }));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y0 + h / 2, z); p.rotation.y = ry; p.castShadow = true;
  b.group.add(p);
  // leafy clumps for depth
  const leaf = b.mat('leaf', () => std({ color: 0x3f6b25, roughness: 0.9 }));
  const n = Math.floor(w * h * 2.2);
  const ims = []; const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)); const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  let s = x * 13.1 + z * 7.7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) { const u = (r() - 0.5) * w, v = r() * h; const sc = 0.12 + r() * 0.16; ims.push(M4(x + side.x * u + dir.x * 0.06, y0 + v, z + side.z * u + dir.z * 0.06, r() * 6, [sc, sc * 0.7, sc])); }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), leaf, ims.length);
  ims.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, new THREE.Color().setHSL(0.26 + r() * 0.08, 0.45, 0.2 + r() * 0.15)); });
  im.castShadow = true; b.group.add(im);
}

function netVisual(b, x, z, w, h, ry) {
  const m = b.mat('net', () => std({ map: tex('net'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
  const t = m.map; t.repeat.set(w / 1.2, h / 1.2);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, h / 2, z); p.rotation.y = ry; p.castShadow = true; b.group.add(p);
}

function cableVisual(b, x, z, h, y0 = 0) {
  const m = b.mat('cable', () => std({ color: 0x1a1a1a, roughness: 0.6 }));
  const y = b.mat('cableY', () => std({ color: 0xf2c21b, roughness: 0.5 }));
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 8), i === 1 ? y : m);
    c.position.set(x + (i % 2) * 0.09 - 0.045, y0 + h / 2, z + (i > 1 ? 0.07 : -0.02)); c.castShadow = true; b.group.add(c);
  }
  for (let k = 0; k < h; k += 0.6) { const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.2), b.mat('clamp', () => std({ color: 0x8a9096, metalness: 0.8, roughness: 0.3 }))); clamp.position.set(x, y0 + k + 0.3, z + 0.02); b.group.add(clamp); }
}

// ───────────────────────── CARGO YARD ─────────────────────────
function cargoYard() {
  const b = new Builder();
  ground(b, 'asphalt', 18);
  const paint = std({ color: 0xe8c33a, roughness: 0.8 });
  for (const x of [-12, 12]) b.batch(new THREE.PlaneGeometry(0.25, 70).rotateX(-Math.PI / 2), paint, x, 0.01, 0);
  for (let z = -30; z <= 30; z += 6) b.batch(new THREE.PlaneGeometry(4, 0.2).rotateX(-Math.PI / 2), paint, 0, 0.01, z);
  const concrete = std({ map: tex('concrete'), roughness: 0.9 });
  // perimeter
  b.wall(-37.5, -37.5, 37.5, -37.5, 0, 4.5, 1, concrete); b.wall(-37.5, 37.5, 37.5, 37.5, 0, 4.5, 1, concrete);
  b.wall(-37.5, -37.5, -37.5, 37.5, 0, 4.5, 1, concrete); b.wall(37.5, -37.5, 37.5, 37.5, 0, 4.5, 1, concrete);
  // containers  [x, z, rot(1 = long along z), levels]
  const stacks = [
    [-27, -23, 0, 2], [-17, -25, 1, 1], [-5, -24, 1, 2], [8, -22, 0, 2], [21, -25, 0, 1], [30, -17, 1, 2],
    [-30, -7, 1, 2], [-17, -10, 0, 2], [-4, -8, 0, 1], [12, -9, 1, 2], [24, -5, 0, 2],
    [-23, 6, 0, 1], [-10, 8, 1, 2], [4, 6, 0, 2], [18, 9, 0, 1], [30, 5, 1, 2],
    [-28, 19, 0, 2], [-15, 23, 1, 1], [0, 20, 0, 2], [13, 24, 0, 2], [26, 20, 1, 1],
  ];
  const L = 6.1, H = 2.6, Wd = 2.44;
  const cols = [0xb8352b, 0x2d6cb5, 0x2f8a4a, 0xd9792b, 0x8a8f94, 0x1f8a8a, 0x7a2f7a, 0xc9a227];
  const mats = [], ccols = [];
  const ladders = [];
  stacks.forEach(([x, z, rot, lv], i) => {
    for (let l = 0; l < lv; l++) {
      const off = l === 1 ? ((i % 3) - 1) * 0.35 : 0;
      mats.push(M4(x + (rot ? 0 : off), l * H + H / 2, z + (rot ? off : 0), rot ? Math.PI / 2 : 0)); ccols.push(cols[(i * 3 + l * 5) % cols.length]);
      const sx = rot ? Wd : L, sz = rot ? L : Wd;
      b.world.addCS(x + (rot ? 0 : off), l * H + H / 2, z + (rot ? off : 0), sx, H, sz);
    }
    if (lv === 2 && i % 2 === 0) ladders.push([x, z, rot, lv * H]);
  });
  const cgeo = new THREE.BoxGeometry(L, H, Wd);
  b.instanced(cgeo, std({ map: tex('container'), roughness: 0.6, metalness: 0.35 }), mats, ccols);
  // container door frames (instanced dark bars on the ends)
  const bars = []; mats.forEach((m) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); for (const e of [-1, 1]) { const off = new THREE.Vector3(e * (L / 2 + 0.02), 0, 0).applyQuaternion(q); bars.push(new THREE.Matrix4().compose(p.clone().add(off), q, new THREE.Vector3(1, 1, 1))); } });
  const endTex = tex('container').clone(); endTex.repeat.set(2, 1); endTex.needsUpdate = true;
  b.instanced(new THREE.BoxGeometry(0.06, H * 0.96, Wd * 0.96), std({ map: endTex, color: 0xb0b0b0, metalness: 0.4, roughness: 0.55 }), bars, ccols.flatMap((c) => [c, c]));
  // door locking bars
  const rods = []; mats.forEach((m) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); for (const zz of [-0.75, -0.25, 0.25, 0.75]) { const off = new THREE.Vector3(L / 2 + 0.07, 0, zz).applyQuaternion(q); rods.push(new THREE.Matrix4().compose(p.clone().add(off), q, new THREE.Vector3(1, 1, 1))); } });
  b.instanced(new THREE.CylinderGeometry(0.025, 0.025, H * 0.94, 6), std({ color: 0x8a8f94, metalness: 0.8, roughness: 0.35 }), rods);
  for (const [x, z, rot, h] of ladders) {
    // ladder on the long side facing +z (or +x if rotated)
    const lx = rot ? x + Wd / 2 + 0.1 : x + 1.2, lz = rot ? z + 1.2 : z + Wd / 2 + 0.1;
    ladderVisual(b, lx, lz, h + 0.4, rot ? Math.PI / 2 : 0);
    b.climbable(lx, lz, 0.7, h, rot ? 'z' : 'x');
  }
  // gantry cranes
  const craneMat = std({ color: 0xe0a21c, metalness: 0.55, roughness: 0.45 });
  const red = std({ color: 0xa82a20, metalness: 0.4, roughness: 0.5 });
  for (const cz of [-15, 15]) {
    for (const cx of [-21, 21]) for (const dz of [-2.5, 2.5]) b.solid(cx, 0, cz + dz, 0.9, 15, 0.9, craneMat);
    for (const cx of [-21, 21]) b.solid(cx, 15, cz, 1.2, 1.2, 6.2, craneMat, { collide: false });
    b.solid(0, 15.6, cz, 44, 1.4, 1.6, craneMat, { collide: false });
    b.solid(cz > 0 ? 6 : -8, 14.2, cz, 3, 1.6, 2.4, red, { collide: false });
    const cab = cz > 0 ? 6 : -8;
    for (const dx of [-0.3, 0.3]) b.solid(cab + dx, 7.5, cz, 0.05, 6.7, 0.05, std({ color: 0x222222 }), { collide: false });
    b.solid(cab, 6.9, cz, 1.2, 0.6, 1.2, red, { collide: false });
  }
  // crates & barrels (instanced) — also low cover
  const crate = []; const barrels = []; const bcol = [];
  const crates = [[-8, -16], [-7, -15.2], [6, 0], [7.2, 0.2], [-20, 13], [20, -13], [-2, 13], [16, 16], [-30, 30], [30, -30], [-33, 0], [33, 12], [0, -32], [0, 32]];
  for (const [x, z] of crates) { crate.push(M4(x, 0.6, z, (x * z) % 1.3)); b.world.addCS(x, 0.6, z, 1.2, 1.2, 1.2); }
  b.instanced(new THREE.BoxGeometry(1.2, 1.2, 1.2), std({ map: tex('crate'), roughness: 0.8 }), crate);
  const bl = [[-12, -2], [-11.2, -2.6], [12, 2], [-26, 30], [-25.2, 30.4], [26, -30], [3, -14], [-3, 14], [34, -2], [-34, -14]];
  for (const [x, z] of bl) { barrels.push(M4(x, 0.45, z)); bcol.push([0x2d6cb5, 0xb8352b, 0x2f8a4a][(Math.abs(x) | 0) % 3]); b.world.addCS(x, 0.45, z, 0.6, 0.9, 0.6); }
  b.instanced(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), std({ color: 0xffffff, metalness: 0.5, roughness: 0.5 }), barrels, bcol);
  // light poles
  for (const [x, z] of [[-35, -35], [35, 35], [-35, 35], [35, -35]]) { b.solid(x, 0, z, 0.3, 10, 0.3, std({ color: 0x55595f, metalness: 0.8, roughness: 0.4 })); }
  b.spawns.red = [[-24, 32], [-12, 32], [0, 33], [12, 32], [24, 32], [-6, 30], [6, 30]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.spawns.blue = b.spawns.red.map((v) => new THREE.Vector3(-v.x, 0, -v.z));
  b.spawns.ffa = [[-33, -31], [33, 31], [-33, 31], [33, -31], [0, 0], [-12, 1], [12, -1], [0, -15], [0, 14], [-24, -14], [24, 14], [-34, 12], [34, -12]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.finish();
  return { b, env: { sky: 'day', sun: [0.55, 0.85, 0.35], sunColor: 0xfff1d6, sunI: 2.8, hemi: [0xbfd8ff, 0x5a5048, 1.05], fog: [0xb9cde0, 60, 170], exposure: 1.05 } };
}

// ───────────────────────── DESERT OUTPOST ─────────────────────────
function desertOutpost() {
  const b = new Builder();
  ground(b, 'sand', 14, 0xe6d6bc);
  const rock = std({ map: tex('rock'), roughness: 0.95 });
  const stone = std({ map: tex('concrete'), color: 0xd8c4a0, roughness: 0.92 });
  // canyon walls (irregular)
  let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = -37.5; i < 37.5; i += 5) {
    for (const side of [-1, 1]) {
      const h1 = 8 + r() * 7, h2 = 8 + r() * 7, d1 = 3 + r() * 3;
      b.solid(i + 2.5, 0, side * (37.5 + d1 / 2 - 1.5), 5.2, h1, d1, rock, { ts: 6 });
      b.solid(side * (37.5 + d1 / 2 - 1.5), 0, i + 2.5, d1, h2, 5.2, rock, { ts: 6 });
    }
  }
  const boulders = []; for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2; const edge = r() > 0.5; const x = edge ? Math.sign(Math.cos(a)) * (33 + r() * 3) : (r() - 0.5) * 70, z = edge ? (r() - 0.5) * 70 : Math.sign(Math.sin(a)) * (33 + r() * 3); const sc = 0.8 + r() * 1.6; boulders.push(new THREE.Matrix4().compose(new THREE.Vector3(x, sc * 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(sc, sc * 0.8, sc))); b.world.addCS(x, sc * 0.4, z, sc * 1.4, sc * 0.8, sc * 1.4); }
  b.instanced(new THREE.DodecahedronGeometry(1, 0), std({ map: tex('rock'), color: 0xc9a07a, roughness: 0.95, flatShading: true }), boulders);
  // bunkers: [x, z, doorSide]
  const bunker = (x, z, door) => {
    const w = 7, d = 6, h = 3.1, t = 0.5;
    const door1 = [{ a: w / 2 - 0.9, b: w / 2 + 0.9, y0: 0, y1: 2.2 }];
    const slits = [{ a: 1.2, b: 2.6, y0: 1.5, y1: 1.9 }, { a: w - 2.6, b: w - 1.2, y0: 1.5, y1: 1.9 }];
    b.wall(x - w / 2, z - d / 2, x + w / 2, z - d / 2, 0, h, t, stone, door === 'n' ? door1 : slits);
    b.wall(x - w / 2, z + d / 2, x + w / 2, z + d / 2, 0, h, t, stone, door === 's' ? door1 : slits);
    b.wall(x - w / 2, z - d / 2, x - w / 2, z + d / 2, 0, h, t, stone, [{ a: 2.2, b: 3.8, y0: 1.5, y1: 1.9 }]);
    b.wall(x + w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, t, stone, [{ a: 2.2, b: 3.8, y0: 1.5, y1: 1.9 }]);
    b.solid(x, h, z, w + 0.6, 0.4, d + 0.6, stone);
    for (const [px, pz, sx, sz] of [[0, -d / 2 - 0.05, w + 0.6, 0.3], [0, d / 2 + 0.05, w + 0.6, 0.3], [-w / 2 - 0.05, 0, 0.3, d], [w / 2 + 0.05, 0, 0.3, d]]) b.solid(x + px, h + 0.4, z + pz, sx, 0.7, sz, stone);
    // rope net on the east side reaches the roof
    const nx = x + w / 2 + 0.35;
    netVisual(b, nx + 0.05, z, 2.4, h + 1.1, Math.PI / 2);
    b.climbable(nx, z, 2.4, h + 0.4, 'z');
  };
  bunker(-18, -18, 's'); bunker(18, 18, 'n'); bunker(-18, 18, 'n'); bunker(18, -18, 's');
  // central command post: low walls + watch tower
  b.wall(-4, -3, 4, -3, 0, 1.1, 0.5, stone, [{ a: 3, b: 5, y0: 0, y1: 0 }]);
  b.wall(-4, 3, 4, 3, 0, 1.1, 0.5, stone, [{ a: 3, b: 5, y0: 0, y1: 0 }]);
  const wood = std({ map: tex('wood'), roughness: 0.75 });
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.solid(dx, 0, dz, 0.25, 5, 0.25, wood);
  b.solid(0, 5, 0, 3.4, 0.25, 3.4, wood);
  for (const [px, pz, sx, sz] of [[0, -1.6, 3.4, 0.1], [0, 1.6, 3.4, 0.1], [-1.6, 0, 0.1, 3.4]]) b.solid(px, 5.25, pz, sx, 1.0, sz, wood);
  b.solid(0, 6.9, 0, 4, 0.15, 4, std({ color: 0x7a6040, roughness: 0.9 }), { collide: false });
  netVisual(b, 1.75, 0, 2.6, 5.4, Math.PI / 2);
  b.climbable(1.72, 0, 2.6, 5.0, 'z');
  // sandbag walls along lanes
  const sb = []; const bags = (x, z, n, alongX) => { for (let i = 0; i < n; i++) for (let l = 0; l < 3; l++) { const o = (i - n / 2) * 0.62 + (l % 2) * 0.3; sb.push(M4(x + (alongX ? o : 0), 0.14 + l * 0.27, z + (alongX ? 0 : o), alongX ? 0 : Math.PI / 2, [1, 1, 1])); } b.world.addCS(x, 0.45, z, alongX ? n * 0.62 + 0.3 : 0.5, 0.9, alongX ? 0.5 : n * 0.62 + 0.3); };
  bags(-26, 0, 5, false); bags(26, 0, 5, false); bags(0, -26, 6, true); bags(0, 26, 6, true); bags(-8, -10, 4, true); bags(8, 10, 4, true); bags(-30, -28, 4, true); bags(30, 28, 4, true);
  const bagGeo = new THREE.CapsuleGeometry(0.15, 0.32, 4, 8).rotateZ(Math.PI / 2); bagGeo.scale(1, 0.85, 1.35);
  b.instanced(bagGeo, std({ color: 0xb59a6a, roughness: 0.95 }), sb);
  // crates + barrels
  const cr = []; for (const [x, z] of [[-10, 22], [-9, 23.2], [10, -22], [9.6, -23.2], [-30, 10], [30, -10], [22, 2], [-22, -2]]) { cr.push(M4(x, 0.6, z, x)); b.world.addCS(x, 0.6, z, 1.2, 1.2, 1.2); }
  b.instanced(new THREE.BoxGeometry(1.2, 1.2, 1.2), std({ map: tex('crate'), roughness: 0.8 }), cr);
  // broken jeep
  const jeep = std({ color: 0x5c6440, roughness: 0.7, metalness: 0.3 });
  b.solid(-6, 0.4, 16, 2, 0.9, 4, jeep); b.solid(-6, 1.3, 15.4, 1.8, 0.6, 1.6, jeep, { collide: false });
  for (const [dx, dz] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16).rotateZ(Math.PI / 2), std({ color: 0x1b1b1b, roughness: 0.9 })); w.position.set(-6 + dx, 0.4, 16 + dz); w.castShadow = true; b.group.add(w); }
  // palms
  for (const [x, z] of [[-30, -32], [30, 32], [32, -5], [-32, 5]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 6, 8), std({ color: 0x7a5a38, roughness: 0.9 })); trunk.position.set(x, 3, z); trunk.rotation.z = 0.1; trunk.castShadow = true; b.group.add(trunk);
    for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), std({ color: 0x4f7a2a, roughness: 0.8, flatShading: true })); leaf.position.set(x + 0.3, 6, z); leaf.rotation.set(Math.PI / 2 - 0.5, (i / 7) * Math.PI * 2, 0); leaf.translateY(1.2); leaf.castShadow = true; b.group.add(leaf); }
    b.world.addCS(x, 3, z, 0.5, 6, 0.5);
  }
  b.spawns.red = [[-20, 31], [-10, 32], [0, 32], [10, 31], [20, 31], [-5, 29], [5, 29]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.spawns.blue = b.spawns.red.map((v) => new THREE.Vector3(-v.x, 0, -v.z));
  b.spawns.ffa = [[-31, -31], [31, 31], [-31, 31], [31, -31], [-18, -14], [18, 14], [0, -12], [0, 12], [-12, 0], [12, 0], [-28, 0], [28, 0]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.finish();
  return { b, env: { sky: 'desert', sun: [0.4, 0.75, -0.5], sunColor: 0xffe2b0, sunI: 2.6, hemi: [0xd9ecff, 0x8a6a48, 0.85], fog: [0xe8d8bc, 70, 190], exposure: 0.9 } };
}

// ───────────────────────── ABANDONED CITY ─────────────────────────
function abandonedCity() {
  const b = new Builder();
  ground(b, 'asphalt', 18, 0xbbbbbb);
  const brick = std({ map: tex('brick'), roughness: 0.9 });
  const brick2 = std({ map: tex('brick'), color: 0xb0a8a0, roughness: 0.9 });
  const concrete = std({ map: tex('concrete'), roughness: 0.92 });
  const curb = std({ map: tex('concrete'), color: 0xa8a49c, roughness: 0.9 });
  // sidewalks (0.15 curb) in the four quadrants
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.solid(sx * 21.75, 0, sz * 21.75, 31.5, 0.15, 31.5, curb, { ts: 3 });
  const paint = std({ color: 0xe8e2c8, roughness: 0.8 });
  for (let i = -36; i <= 36; i += 4) { if (Math.abs(i) < 7) continue; b.batch(new THREE.PlaneGeometry(0.2, 2).rotateX(-Math.PI / 2), paint, 0, 0.012, i); b.batch(new THREE.PlaneGeometry(2, 0.2).rotateX(-Math.PI / 2), paint, i, 0.012, 0); }
  for (let i = -5; i <= 5; i += 1.2) { b.batch(new THREE.PlaneGeometry(0.6, 3).rotateX(-Math.PI / 2), paint, i, 0.012, 8); b.batch(new THREE.PlaneGeometry(0.6, 3).rotateX(-Math.PI / 2), paint, i, 0.012, -8); }
  // perimeter (ruined facades)
  for (const [x0, z0, x1, z1] of [[-37.5, -37.5, 37.5, -37.5], [-37.5, 37.5, 37.5, 37.5], [-37.5, -37.5, -37.5, 37.5], [37.5, -37.5, 37.5, 37.5]]) b.wall(x0, z0, x1, z1, 0, 9, 1, brick2);
  // corner buildings: two floors, street-facing doors, upper windows with vines
  const building = (cx, cz, mat) => {
    const W = 18, D = 16, F = 3.6, H2 = 7.4, t = 0.45;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    const facX = cx > 0 ? x0 : x1; const facZ = cz > 0 ? z0 : z1;   // walls facing the intersection
    const doors = [{ a: W / 2 - 1.0, b: W / 2 + 1.0, y0: 0.15, y1: 2.6 }];
    const win = (L) => [{ a: 2.5, b: 4.5, y0: F + 0.5, y1: F + 2.9 }, { a: L / 2 - 1, b: L / 2 + 1, y0: F + 0.5, y1: F + 2.9 }, { a: L - 4.5, b: L - 2.5, y0: F + 0.5, y1: F + 2.9 }];
    const gwin = (L) => [{ a: 2, b: 3.6, y0: 1.0, y1: 2.4 }, { a: L - 3.6, b: L - 2, y0: 1.0, y1: 2.4 }];
    // street-facing walls (with doors + windows)
    b.wall(x0, facZ, x1, facZ, 0.15, H2, t, mat, [...doors, ...gwin(W).filter((o) => o.b < W / 2 - 1.2 || o.a > W / 2 + 1.2), ...win(W)]);
    b.wall(facX, z0, facX, z1, 0.15, H2, t, mat, [{ a: D / 2 - 1, b: D / 2 + 1, y0: 0.15, y1: 2.6 }, ...win(D)]);
    // back walls (solid, small windows)
    const backZ = cz > 0 ? z1 : z0, backX = cx > 0 ? x1 : x0;
    b.wall(x0, backZ, x1, backZ, 0.15, H2, t, mat, [{ a: 4, b: 5.5, y0: F + 1, y1: F + 2.2 }]);
    b.wall(backX, z0, backX, z1, 0.15, H2, t, mat, []);
    // second floor slab, leaving a stairwell strip along the back X wall
    const stripX = cx > 0 ? x1 - 1.75 : x0 + 1.75;
    const slabX = cx > 0 ? x0 + 7.25 : x1 - 7.25;
    b.solid(slabX, F, cz, W - 3.5, 0.3, D, concrete);
    b.solid(stripX, F, cz > 0 ? z0 + (D - 6) / 2 : z1 - (D - 6) / 2, 3.5, 0.3, D - 6, concrete);
    for (let i = 0; i < 12; i++) {
      const sz2 = cz > 0 ? z1 - 0.8 - i * 0.42 : z0 + 0.8 + i * 0.42;
      b.solid(stripX, 0.15, sz2, 3.0, 0.3 * (i + 1), 0.42, concrete);
    }
    // roof + parapet
    b.solid(cx, H2, cz, W, 0.3, D, concrete);
    // vines on the street facade below the first and last upper windows
    for (const a of [3.5, W - 3.5]) {
      const vx = x0 + a, vz = facZ + (cz > 0 ? -0.33 : 0.33);
      vineVisual(b, vx, vz + (cz > 0 ? -0.02 : 0.02), 2.4, F + 0.6, cz > 0 ? Math.PI : 0, 0.15);
      b.climbable(vx, vz, 1.8, F + 0.5 - 0.15, 'x', 0.15, 0.2);
    }
    // interior props on 2nd floor (sniper cover)
    b.solid(cx + (cx > 0 ? -3 : 3), F + 0.3, facZ + (cz > 0 ? 2 : -2), 2.4, 0.9, 0.8, std({ map: tex('wood'), roughness: 0.8 }));
  };
  building(-21.5, -21.5, brick); building(21.5, -21.5, brick2); building(-21.5, 21.5, brick2); building(21.5, 21.5, brick);
  // burnt cars
  const carMat = std({ color: 0x2c2826, roughness: 0.85, metalness: 0.3 });
  const rust = std({ color: 0x6b3a20, roughness: 0.9, metalness: 0.2 });
  for (const [x, z, ry] of [[-3, -12, 0.2], [3.5, 14, -0.3], [-14, 2.5, 1.4], [13, -3, 1.7]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), carMat); body.position.y = 0.6; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), rust); top.position.set(0, 1.3, 0.2); g.add(top);
    for (const [dx, dz] of [[-0.95, -1.3], [0.95, -1.3], [-0.95, 1.3], [0.95, 1.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12).rotateZ(Math.PI / 2), std({ color: 0x151515 })); w.position.set(dx, 0.35, dz); g.add(w); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); b.group.add(g);
    const c = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry)); b.world.addCS(x, 0.8, z, 1.9 * c + 4.2 * s2, 1.6, 4.2 * c + 1.9 * s2);
  }
  // rubble piles + jersey barriers
  const rub = []; let sd = 3; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
  for (const [x, z] of [[-8, -6], [8, 6], [-6, 9], [6, -9], [0, -24], [0, 24], [-24, 0], [24, 0]]) { for (let i = 0; i < 6; i++) rub.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (r() - 0.5) * 2, 0.2, z + (r() - 0.5) * 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(0.4 + r() * 0.5, 0.3 + r() * 0.4, 0.4 + r() * 0.5))); b.world.addCS(x, 0.4, z, 2, 0.8, 2); }
  b.instanced(new THREE.DodecahedronGeometry(1, 0), std({ map: tex('brick'), color: 0x9a8070, roughness: 0.95, flatShading: true }), rub);
  const jer = []; for (const [x, z, ry] of [[-4, 4, 0], [4, -4, 0], [-10, -10, 0.8], [10, 10, 0.8]]) { jer.push(M4(x, 0.45, z, ry)); b.world.addCS(x, 0.45, z, 2.4, 0.9, 2.4); }
  b.instanced(new THREE.BoxGeometry(3, 0.9, 0.6), concrete, jer);
  // street lights
  const pole = std({ color: 0x3a3e42, metalness: 0.8, roughness: 0.4 });
  for (const [x, z] of [[-6.5, -6.5], [6.5, 6.5], [-6.5, 6.5], [6.5, -6.5]]) { b.solid(x, 0, z, 0.2, 6, 0.2, pole); b.solid(x * 0.85, 5.8, z * 0.85, 1.6, 0.12, 0.25, pole, { collide: false }); }
  b.spawns.red = [[-4, 34], [4, 34], [0, 30], [-3, 26], [3, 26], [-8, 32], [8, 32]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.spawns.blue = b.spawns.red.map((v) => new THREE.Vector3(-v.x, 0, -v.z));
  b.spawns.ffa = [[-34, -4], [34, 4], [-4, -34], [4, 34], [0, 0], [-21.5, -21.5], [21.5, 21.5], [-21.5, 21.5], [21.5, -21.5], [-10, 3], [10, -3]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.finish();
  return { b, env: { sky: 'dusk', sun: [-0.5, 0.6, 0.45], sunColor: 0xffd0a0, sunI: 2.6, hemi: [0xb8c8e0, 0x4a4038, 1.1], fog: [0xa8a4a0, 45, 150], exposure: 1.05 } };
}

// ───────────────────────── UNDERGROUND LAB ─────────────────────────
function undergroundLab() {
  const b = new Builder();
  const CEIL = 4.5;
  ground(b, 'tile', 22, 0x9ea6ac, 0.45);
  b.world.ceiling = CEIL;
  const wallM = std({ map: tex('labwall'), color: 0xb8bec2, roughness: 0.75 });
  const concrete = std({ map: tex('concrete'), roughness: 0.9 });
  const ceilM = std({ map: tex('plate'), color: 0x9aa0a6, roughness: 0.8, metalness: 0.3 }); ceilM.userData.noCast = true;
  b.solid(0, CEIL, 0, 80, 0.4, 80, ceilM, { collide: false, ts: 4 });
  for (const [x0, z0, x1, z1] of [[-37.5, -37.5, 37.5, -37.5], [-37.5, 37.5, 37.5, 37.5], [-37.5, -37.5, -37.5, 37.5], [37.5, -37.5, 37.5, 37.5]]) b.wall(x0, z0, x1, z1, 0, CEIL, 1, wallM);
  // pillars
  const pil = [];
  for (let x = -28; x <= 28; x += 14) for (let z = -28; z <= 28; z += 14) { if (Math.abs(x) < 1 && Math.abs(z) < 1) continue; pil.push(M4(x, CEIL / 2, z)); b.world.addCS(x, CEIL / 2, z, 1, CEIL, 1); }
  b.instanced(new THREE.BoxGeometry(1, CEIL, 1), concrete, pil);
  // interior partitions → rooms & corridors
  const P = (x0, z0, x1, z1, ops) => b.wall(x0, z0, x1, z1, 0, CEIL, 0.3, wallM, ops);
  const door = (a) => ({ a, b: a + 2.2, y0: 0, y1: 2.6 });
  P(-37.5, -14, -10, -14, [door(6), door(20)]); P(10, -14, 37.5, -14, [door(5), door(18)]);
  P(-37.5, 14, -10, 14, [door(6), door(20)]); P(10, 14, 37.5, 14, [door(5), door(18)]);
  P(-20, -37.5, -20, -14, [door(10)]); P(20, 14, 20, 37.5, [door(11)]);
  // glass partitions (see-through)
  const glass = std({ color: 0x9fd8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }); glass.userData.noCast = true;
  for (const [x, z, w, alongX] of [[-6, -4, 8, true], [6, 4, 8, true], [0, -22, 10, false], [0, 22, 10, false]]) {
    b.solid(x, 0, z, alongX ? w : 0.08, 2.8, alongX ? 0.08 : w, glass, { col: { seeThrough: true } });
    b.solid(x, 0, z, alongX ? w : 0.16, 0.5, alongX ? 0.16 : w, std({ color: 0x5a6066, metalness: 0.7, roughness: 0.4 }), { col: {} });
  }
  // lab tables, server racks
  const table = std({ color: 0xe8ecee, roughness: 0.4, metalness: 0.2 });
  for (const [x, z] of [[-28, -26], [-28, -20], [28, 26], [28, 20], [-12, 26], [12, -26], [-26, 24], [26, -24]]) b.solid(x, 0, z, 3.2, 0.95, 1.2, table);
  const rack = []; const leds = [];
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) { const x = -6 + i * 2, z = side * 30; rack.push(M4(x, 1.1, z)); b.world.addCS(x, 1.1, z, 1.0, 2.2, 1.0); for (let k = 0; k < 6; k++) leds.push(M4(x - 0.3 + (k % 3) * 0.3, 0.5 + Math.floor(k / 3) * 0.9 + (i % 2) * 0.3, z - side * 0.51, 0, [1, 1, 1])); }
  b.instanced(new THREE.BoxGeometry(1, 2.2, 1), std({ color: 0x23272c, metalness: 0.7, roughness: 0.35 }), rack);
  b.instanced(new THREE.BoxGeometry(0.08, 0.04, 0.02), std({ color: 0x40ff80, emissive: 0x30ff70, emissiveIntensity: 2.5 }), leds, null, false);
  // containment tanks
  for (const [x, z] of [[-24, 0], [24, 0]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 24), std({ color: 0x4a5056, metalness: 0.8, roughness: 0.3 })); base.position.set(x, 0.25, z); base.castShadow = base.receiveShadow = true; b.group.add(base);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 24, 1, true), std({ color: 0x7affc8, transparent: true, opacity: 0.25, emissive: 0x20ff90, emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false })); gl.position.set(x, 2.1, z); b.group.add(gl);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.8, 24), std({ color: 0x30ff90, emissive: 0x20ff80, emissiveIntensity: 0.9, transparent: true, opacity: 0.35, depthWrite: false })); fl.position.set(x, 2.0, z); b.group.add(fl);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 24), base.material); cap.position.set(x, 3.95, z); b.group.add(cap);
    b.world.addCS(x, 2.0, z, 2.8, 4.0, 2.8);
  }
  // catwalk mezzanine along the north & south walls with climbable cable bundles
  const grate = std({ map: tex('plate'), color: 0x8a9096, metalness: 0.7, roughness: 0.4 });
  const rail = std({ color: 0xf2c21b, metalness: 0.5, roughness: 0.4 });
  for (const sz of [-1, 1]) {
    const z = sz * 35.5;
    b.solid(0, 2.0, z, 30, 0.2, 3, grate);
    b.solid(0, 2.2, z - sz * 1.45, 30, 1.0, 0.08, rail, { col: {} });
    for (const x of [-14, 14]) b.solid(x, 0, z - sz * 1.3, 0.2, 2.0, 0.2, rail);
    for (const x of [-10, 10]) { const cz = z - sz * 1.62; cableVisual(b, x, cz, CEIL); b.climbable(x, cz, 0.4, 2.3, 'x', 0, 0.3); }
  }
  // crates
  const cr = []; for (const [x, z] of [[-16, -8], [-15, -6.8], [16, 8], [15.4, 9.2], [-32, 8], [32, -8], [8, -32.5], [-8, 32.5]]) { cr.push(M4(x, 0.6, z, x * 0.3)); b.world.addCS(x, 0.6, z, 1.25, 1.2, 1.25); }
  b.instanced(new THREE.BoxGeometry(1.2, 1.2, 1.2), std({ color: 0x8a9298, map: tex('crate'), roughness: 0.7 }), cr);
  // ceiling light panels (emissive)
  const panels = []; for (let x = -30; x <= 30; x += 10) for (let z = -30; z <= 30; z += 10) panels.push(M4(x + 5, CEIL - 0.03, z + 5));
  b.instanced(new THREE.BoxGeometry(2.4, 0.06, 0.6), std({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 2.2 }), panels, null, false);
  // hazard floor stripes at the doors
  const hz = std({ map: tex('hazard'), roughness: 0.6 });
  for (const [x, z] of [[-24.5, -14], [-10.5, -14], [16, -14], [29, -14], [-24.5, 14], [-10.5, 14], [16, 14], [29, 14]]) b.batch(new THREE.PlaneGeometry(2.2, 0.5).rotateX(-Math.PI / 2), hz, x, 0.01, z);
  b.spawns.red = [[-24, 30], [-14, 30], [12, 30], [24, 30], [-30, 22], [30, 22], [0, 26]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.spawns.blue = b.spawns.red.map((v) => new THREE.Vector3(-v.x, 0, -v.z));
  b.spawns.ffa = [[-32, -32], [32, 32], [-32, 32], [32, -32], [0, 0], [-14, -6], [14, 6], [0, -18], [0, 18], [-30, 0], [30, 0]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  b.finish();
  const lights = [];
  for (const [x, z, c] of [[-24, 0, 0x40ff90], [24, 0, 0x40ff90], [0, 0, 0xcfe8ff], [0, -30, 0x60ffa0], [0, 30, 0x60ffa0]]) { const l = new THREE.PointLight(c, 18, 16, 1.6); l.position.set(x, CEIL - 0.6, z); lights.push(l); }
  return { b, lights, env: { sky: 'indoor', sun: [0.15, 1, 0.25], sunColor: 0xdfeaff, sunI: 1.1, hemi: [0xdfe8f0, 0x50565c, 0.75], fog: [0x1a2026, 35, 100], exposure: 0.82, indoor: true } };
}

const BUILD = { cargo_yard: cargoYard, desert_outpost: desertOutpost, abandoned_city: abandonedCity, underground_lab: undergroundLab };

export function buildMap(id) {
  const { b, env, lights = [] } = BUILD[id]();
  for (const l of lights) b.group.add(l);
  const nav = buildNav(b.world);
  return { id, group: b.group, world: b.world, spawns: b.spawns, nav, env, info: MAPS[id] };
}

// Navigation grid: 1 m cells, walkable when no collider blocks a 0.4 m radius at ground level.
export function buildNav(world) {
  const N = 75, half = 37.5; const cells = new Uint8Array(N * N); const h = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -half + i + 0.5, z = -half + j + 0.5; let blocked = false; let gh = 0;
    for (const b of world.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5)) {
      if (b.noCollide) continue;
      if (x + 0.45 < b.min[0] || x - 0.45 > b.max[0] || z + 0.45 < b.min[2] || z - 0.45 > b.max[2]) continue;
      if (b.min[1] > 2.0) continue;            // overhead
      if (b.max[1] <= 0.46) { gh = Math.max(gh, b.max[1]); continue; } // step-able
      blocked = true; break;
    }
    if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2) blocked = true;
    cells[i * N + j] = blocked ? 1 : 0; h[i * N + j] = gh;
  }
  return { N, half, cells, h };
}
