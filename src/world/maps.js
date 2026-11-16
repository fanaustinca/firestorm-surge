// Map builders — 8 arenas on a 60×60 m footprint. Every map has a big open battle space in the middle
// surrounded/crossed by 3-story structures (floors at 0, 3, 6 m + walkable roofs at 9 m), linked by
// stairs, ladders, vines, rungs and catwalk bridges. Each returns { group, world, spawns, nav, env }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { tex } from '../render/textures.js';

export const SIZE = 60, HALF = SIZE / 2;
export const FLOOR = 3;                        // floor-to-floor height
const RISE = 0.25, RUN = 0.5, STEPS = FLOOR / RISE; // 12 steps of 25 cm per floor (6 m run)

export const MAPS = {
  cargo_yard: { name: 'Cargo Yard', desc: 'Triple-stacked containers, twin offices and a sky bridge over the yard.', color: '#c8743a' },
  desert_outpost: { name: 'Desert Outpost', desc: 'Sandstone fort: four towers, rampart walls, a central scaffold.', color: '#d8b070' },
  abandoned_city: { name: 'Abandoned City', desc: 'Four ruined 3-story blocks, vine walls and street-spanning bridges.', color: '#8a6a5a' },
  underground_lab: { name: 'Underground Lab', desc: 'Two mezzanine rings around a 9 m atrium. Ceiling stops mortars.', color: '#4ac0a0' },
  frostbite: { name: 'Frostbite Station', desc: 'Arctic research base: lab towers, radar scaffold, icy bridges.', color: '#a8d0f0' },
  jungle_temple: { name: 'Jungle Temple', desc: 'A three-tier stepped pyramid in an overgrown clearing.', color: '#4a8a3a' },
  neon_market: { name: 'Neon Market', desc: 'Night market between neon shophouses linked by sky bridges.', color: '#d040c0' },
  refinery: { name: 'Refinery', desc: 'Storage tanks, scaffold towers and an elevated pipe-rack catwalk.', color: '#e0a020' },
};

const std = (o) => new THREE.MeshStandardMaterial(o);

// Box geometry with world-scaled UVs (ts = meters per texture repeat)
function boxUV(sx, sy, sz, ts = 4) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
  return g;
}
const M4 = (x, y, z, ry = 0, s = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(...s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// subtract rectangle holes [x0,x1,z0,z1] from a rectangle → list of rects
function cutRects(rect, holes) {
  let rects = [rect];
  for (const [hx0, hx1, hz0, hz1] of holes) {
    const out = [];
    for (const [x0, x1, z0, z1] of rects) {
      if (hx1 <= x0 || hx0 >= x1 || hz1 <= z0 || hz0 >= z1) { out.push([x0, x1, z0, z1]); continue; }
      const cx0 = Math.max(x0, hx0), cx1 = Math.min(x1, hx1), cz0 = Math.max(z0, hz0), cz1 = Math.min(z1, hz1);
      if (cx0 > x0) out.push([x0, cx0, z0, z1]);
      if (cx1 < x1) out.push([cx1, x1, z0, z1]);
      if (cz0 > z0) out.push([cx0, cx1, z0, cz0]);
      if (cz1 < z1) out.push([cx0, cx1, cz1, z1]);
    }
    rects = out;
  }
  return rects.filter(([a, b, c, d]) => b - a > 0.01 && d - c > 0.01);
}

class Builder {
  constructor() {
    this.group = new THREE.Group(); this.world = new CollisionWorld(); this.world.bounds = HALF;
    this.batches = new Map();
    this.spawns = { red: [], blue: [], ffa: [] };
    this._mats = {};
  }
  mat(key, make) { if (!this._mats[key]) this._mats[key] = make(); return this._mats[key]; }
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
  // block from corner coords
  block(x0, x1, z0, z1, y0, y1, mat, opts) { return this.solid((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, mat, opts); }
  // Axis-aligned wall (x0,z0)→(x1,z1) with arbitrary (overlapping) openings [{a,b,y0,y1}] measured along the wall.
  wall(x0, z0, x1, z1, y0, y1, th, mat, holes = [], opts = {}) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sx = alongX ? Math.sign(x1 - x0) : 0, sz = alongX ? 0 : Math.sign(z1 - z0);
    const cuts = new Set([0, L]); for (const h of holes) { cuts.add(clamp(h.a, 0, L)); cuts.add(clamp(h.b, 0, L)); }
    const xs = [...cuts].sort((p, q) => p - q);
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      const m = (a + b) / 2; const cx = x0 + sx * m, cz = z0 + sz * m;
      if (alongX) this.solid(cx, ya, cz, b - a, yb - ya, th, mat, opts); else this.solid(cx, ya, cz, th, yb - ya, b - a, mat, opts);
    };
    for (let k = 0; k < xs.length - 1; k++) {
      const a = xs[k], b = xs[k + 1]; if (b - a < 0.01) continue; const mid = (a + b) / 2;
      const hs = holes.filter((h) => h.a <= mid && h.b >= mid).map((h) => [Math.max(y0, h.y0), Math.min(y1, h.y1)]).filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
      let cur = y0;
      for (const [ha, hb] of hs) { if (ha > cur) seg(a, b, cur, ha); cur = Math.max(cur, hb); }
      if (cur < y1) seg(a, b, cur, y1);
    }
  }
  // Floor slab whose TOP is at y, with rectangular holes [x0,x1,z0,z1]
  slab(x0, x1, z0, z1, y, mat, holes = [], th = 0.25, opts = {}) {
    for (const [a, b, c, d] of cutRects([x0, x1, z0, z1], holes)) this.block(a, b, c, d, y - th, y, mat, { ts: 3, ...opts });
  }
  // Straight flight of steps. (x,z) = start edge, lateral center. axis 'x'|'z', dir ±1. Climbs FLOOR from y0.
  flight(x, z, axis, dir, width, y0, mat, steps = STEPS) {
    for (let i = 0; i < steps; i++) {
      const top = y0 + (i + 1) * RISE; const along = (i + 0.5) * RUN * dir;
      if (axis === 'x') this.solid(x + along, y0, z, RUN, top - y0, width, mat, { ts: 2 });
      else this.solid(x, y0, z + along, width, top - y0, RUN, mat, { ts: 2 });
    }
  }
  // Climbable surface (ladder/vine/net/rungs): thin collider
  climbable(x, z, w, h, axis, y0 = 0, depth = 0.14) {
    const sx = axis === 'x' ? w : depth, sz = axis === 'x' ? depth : w;
    return this.world.addCS(x, y0 + h / 2, z, sx, h, sz, { climbable: true });
  }
  // Ladder with visual. axis: the ladder's width direction. (x,z) center of the rung plane.
  ladder(x, z, h, axis, y0 = 0, style = 'ladder') {
    ladderVisual(this, x, z, h + 0.5, axis === 'x' ? 0 : Math.PI / 2, y0, style);
    return this.climbable(x, z, 0.7, h, axis, y0);
  }
  vines(x, z, w, h, axis, y0 = 0) {
    vineVisual(this, x, z, w, h + 0.4, axis === 'x' ? 0 : Math.PI / 2, y0);
    return this.climbable(x, z, w * 0.8, h, axis, y0, 0.2);
  }
  // Catwalk / bridge deck with side rails
  bridge(x0, x1, z0, z1, y, deck, rail, rails = true, gaps = []) {
    this.slab(x0, x1, z0, z1, y, deck, [], 0.2);
    if (!rails) return;
    const alongX = x1 - x0 > z1 - z0; const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    // rail runs along the long axis, open (±0.9 m) where ladders arrive
    const runs = []; let cur = a0; for (const gp of [...gaps].sort((p, q) => p - q)) { if (gp - 0.9 > cur) runs.push([cur, gp - 0.9]); cur = gp + 0.9; } if (cur < a1) runs.push([cur, a1]);
    for (const side of alongX ? [z0 + 0.04, z1 - 0.04] : [x0 + 0.04, x1 - 0.04]) for (const [ra, rb] of runs) {
      const m = (ra + rb) / 2, L = rb - ra;
      if (alongX) { this.solid(m, y + 0.95, side, L, 0.08, 0.08, rail); this.world.addCS(m, y + 0.5, side, L, 1.0, 0.08, { seeThrough: true }); }
      else { this.solid(side, y + 0.95, m, 0.08, 0.08, L, rail); this.world.addCS(side, y + 0.5, m, 0.08, 1.0, L, { seeThrough: true }); }
      for (let t = ra + 0.5; t < rb; t += 2) alongX ? this.solid(t, y, side, 0.06, 0.95, 0.06, rail, { collide: false }) : this.solid(side, y, t, 0.06, 0.95, 0.06, rail, { collide: false });
    }
  }
  // Open scaffold: platforms at FLOOR*k (k=1..levels) on four posts, ladders alternating sides.
  scaffold(cx, cz, w, d, levels, deck, post, ladderSides = ['s', 'n', 'e']) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    for (const [px, pz] of [[x0 + 0.15, z0 + 0.15], [x1 - 0.15, z0 + 0.15], [x0 + 0.15, z1 - 0.15], [x1 - 0.15, z1 - 0.15]]) this.solid(px, 0, pz, 0.3, levels * FLOOR + 1.1, 0.3, post);
    // ladder k climbs from level k to k+1; for k ≥ 1 the climber stands on the platform, so level k+1 gets a hatch
    const lad = []; for (let k = 0; k < levels; k++) {
      const side = ladderSides[k % ladderSides.length]; const off = (k % 2 ? -1 : 1) * (w / 4);
      const L = { s: [cx + off, z1 + 0.1, 'x'], n: [cx + off, z0 - 0.1, 'x'], e: [x1 + 0.1, cz, 'z'], w: [x0 - 0.1, cz, 'z'] }[side];
      lad.push({ k, side, x: L[0], z: L[1], axis: L[2] });
    }
    for (let k = 1; k <= levels; k++) {
      const holes = [];
      for (const l of lad) if (l.k === k - 1 && k - 1 >= 1) {
        if (l.side === 's') holes.push([l.x - 1.0, l.x + 1.0, z1 - 1.5, z1]); if (l.side === 'n') holes.push([l.x - 1.0, l.x + 1.0, z0, z0 + 1.5]);
        if (l.side === 'e') holes.push([x1 - 1.5, x1, l.z - 1.0, l.z + 1.0]); if (l.side === 'w') holes.push([x0, x0 + 1.5, l.z - 1.0, l.z + 1.0]);
      }
      this.slab(x0, x1, z0, z1, k * FLOOR, deck, holes, 0.2);
      if (k === levels) for (const [a, b, c, e] of [[x0, x1, z0, z0 + 0.06], [x0, x1, z1 - 0.06, z1]]) this.block(a, b, c, e, k * FLOOR, k * FLOOR + 1.0, post, { col: { seeThrough: true } });
    }
    for (const l of lad) this.ladder(l.x, l.z, FLOOR, l.axis, l.k * FLOOR);
  }
  // 3-story building with interior switchback stairs to a walkable roof.
  // o: { floors, wallMat, floorMat, stairMat, doors:[sides], open:[sides], ladders:[[side,a]], vines:[[side,a]], doorsUp:[[side,a,level]] }
  tower(cx, cz, w, d, o) {
    const floors = o.floors ?? 3, th = 0.3, H = floors * FLOOR;
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const sides = { n: [x0, z0, x1, z0, w], s: [x0, z1, x1, z1, w], w: [x0, z0, x0, z1, d], e: [x1, z0, x1, z1, d] };
    for (const [side, [ax, az, bx, bz, L]] of Object.entries(sides)) {
      const holes = [];
      const door = (o.doors || []).includes(side), open = (o.open || []).includes(side);
      if (open) {
        holes.push({ a: 1.5, b: L - 1.5, y0: 0, y1: 2.6 });
        for (let k = 1; k < floors; k++) holes.push({ a: 0.8, b: L - 0.8, y0: k * FLOOR + 1.0, y1: k * FLOOR + 2.7 });
      } else {
        if (door) holes.push({ a: L / 2 - 1.0, b: L / 2 + 1.0, y0: 0, y1: 2.5 });
        for (let k = 0; k < floors; k++) for (let t = 1.2; t + 1.8 <= L - 1.0; t += 3.2) {
          if (k === 0 && door && t < L / 2 + 1.3 && t + 1.8 > L / 2 - 1.3) continue;
          holes.push({ a: t, b: t + 1.8, y0: k * FLOOR + 1.0, y1: k * FLOOR + 2.3 });
        }
      }
      for (const [s2, a] of o.ladders || []) if (s2 === side) holes.push({ a: a - 0.6, b: a + 0.6, y0: H, y1: H + 1.2 });
      for (const [s2, a, lvl] of o.doorsUp || []) if (s2 === side) holes.push({ a: a - 1.0, b: a + 1.0, y0: lvl * FLOOR, y1: lvl * FLOOR + 2.5 });
      this.wall(ax, az, bx, bz, 0, H + 1.0, th, o.wallMat, holes, { ts: 3 });
      // exterior ladders / vines run to the roof
      for (const [s2, a] of o.ladders || []) if (s2 === side) {
        const p = side === 'n' || side === 's' ? [ax + a, az + (side === 'n' ? -0.25 : 0.25)] : [ax + (side === 'w' ? -0.25 : 0.25), az + a];
        this.ladder(p[0], p[1], H, side === 'n' || side === 's' ? 'x' : 'z');
      }
      for (const [s2, a, top] of o.vines || []) if (s2 === side) {
        const p = side === 'n' || side === 's' ? [ax + a, az + (side === 'n' ? -0.28 : 0.28)] : [ax + (side === 'w' ? -0.28 : 0.28), az + a];
        this.vines(p[0], p[1], 2.4, top ?? H, side === 'n' || side === 's' ? 'x' : 'z');
      }
    }
    // stairs: two 2 m lanes along the north wall, alternating direction per floor
    const south = o.stairs === 's';
    const sx0 = x0 + 2, laneA = south ? z1 - 1.3 : z0 + 1.3, laneB = south ? z1 - 3.3 : z0 + 3.3;
    for (let k = 0; k < floors; k++) {
      const odd = k % 2 === 1; this.flight(odd ? sx0 + STEPS * RUN : sx0, odd ? laneB : laneA, 'x', odd ? -1 : 1, 2, k * FLOOR, o.stairMat || o.floorMat);
    }
    for (let k = 1; k <= floors; k++) {
      const odd = (k - 1) % 2 === 1; const lz = odd ? laneB : laneA;
      const hz0 = !odd && !south ? z0 : lz - 1.05, hz1 = !odd && south ? z1 : lz + 1.05;
      this.slab(x0 + th / 2, x1 - th / 2, z0 + th / 2, z1 - th / 2, k * FLOOR, o.floorMat, [[sx0 - 0.1, sx0 + STEPS * RUN + 0.1, hz0, hz1]], 0.25);
    }
    return { x0, x1, z0, z1, H };
  }
  instanced(geo, mat, matrices, colors, shadow = true) {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    if (colors) colors.forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
    im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere();
    this.group.add(im); return im;
  }
  crates(list, mat) { const ms = []; for (const [x, z, s = 1.2, y = 0] of list) { ms.push(M4(x, y + s / 2, z, (x * 7 + z) % 1.3, [s / 1.2, s / 1.2, s / 1.2])); this.world.addCS(x, y + s / 2, z, s, s, s); } this.instanced(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat, ms); }
  barrels(list, colors = [0x2d6cb5, 0xb8352b, 0x2f8a4a]) { const ms = [], cs = []; for (const [x, z] of list) { ms.push(M4(x, 0.45, z)); cs.push(colors[(Math.abs(x * 3 + z) | 0) % colors.length]); this.world.addCS(x, 0.45, z, 0.6, 0.9, 0.6); } this.instanced(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), std({ color: 0xffffff, metalness: 0.5, roughness: 0.5 }), ms, cs); }
  perimeter(mat, h, opts = {}) {
    for (const [x0, z0, x1, z1] of [[-HALF, -HALF, HALF, -HALF], [-HALF, HALF, HALF, HALF], [-HALF, -HALF, -HALF, HALF], [HALF, -HALF, HALF, HALF]]) this.wall(x0, z0, x1, z1, 0, h, 1, mat, [], { col: { noClimb: true }, ts: opts.ts || 4 });
  }
  finish() {
    for (const [mat, geos] of this.batches) {
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = !mat.userData.noCast; mesh.receiveShadow = true;
      this.group.add(mesh); geos.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
}

function ground(b, texName, rep, color = 0xffffff, rough = 0.95) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 30, SIZE + 30).rotateX(-Math.PI / 2), std({ map: tex(texName, rep), color, roughness: rough }));
  g.receiveShadow = true; b.group.add(g); return g;
}

function ladderVisual(b, x, z, h, ry, y0 = 0, style = 'ladder') {
  const col = style === 'rungs' ? b.mat('rungs', () => std({ color: 0x9aa0a6, metalness: 0.85, roughness: 0.35 })) : b.mat('ladder', () => std({ color: 0xf2c21b, metalness: 0.5, roughness: 0.45 }));
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry;
  if (style !== 'rungs') for (const sx of [-0.28, 0.28]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), col); r.position.set(sx, h / 2, 0); r.castShadow = true; g.add(r); }
  const n = Math.floor(h / 0.3);
  const rung = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6).rotateZ(Math.PI / 2), col, n);
  for (let i = 0; i < n; i++) rung.setMatrixAt(i, M4(0, 0.25 + i * 0.3, 0));
  rung.castShadow = true; g.add(rung); b.group.add(g);
}
function vineVisual(b, x, z, w, h, ry, y0 = 0) {
  const m = b.mat('vines', () => std({ map: tex('vines'), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85 }));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y0 + h / 2, z); p.rotation.y = ry; p.castShadow = true; b.group.add(p);
  const leaf = b.mat('leaf', () => std({ color: 0x3f6b25, roughness: 0.9 }));
  const n = Math.floor(w * h * 2); const ims = []; const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  let s = Math.abs(x * 13.1 + z * 7.7) + 1; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) { const u = (r() - 0.5) * w, v = r() * h; const sc = 0.12 + r() * 0.16; ims.push(M4(x + side.x * u, y0 + v, z + side.z * u, r() * 6, [sc, sc * 0.7, sc])); }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), leaf, ims.length);
  ims.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, new THREE.Color().setHSL(0.26 + r() * 0.08, 0.45, 0.2 + r() * 0.15)); });
  im.castShadow = true; b.group.add(im);
}
function boulders(b, list, color = 0xc9a07a, mapName = 'rock') {
  const ms = []; for (const [x, z, sc, rot = 0] of list) { ms.push(new THREE.Matrix4().compose(new THREE.Vector3(x, sc * 0.45, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot, rot * 2, rot * 3)), new THREE.Vector3(sc, sc * 0.8, sc))); b.world.addCS(x, sc * 0.4, z, sc * 1.4, sc * 0.8, sc * 1.4); }
  b.instanced(new THREE.DodecahedronGeometry(1, 0), std({ map: tex(mapName), color, roughness: 0.95, flatShading: true }), ms);
}
function tree(b, x, z, h = 7, leafCol = 0x3f7a2a, trunkCol = 0x5a4028) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, h, 8), b.mat('trunk' + trunkCol, () => std({ color: trunkCol, roughness: 0.9 }))); t.position.set(x, h / 2, z); t.castShadow = true; b.group.add(t);
  const lm = b.mat('canopy' + leafCol, () => std({ color: leafCol, roughness: 0.85, flatShading: true }));
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + (i % 2) * 0.6, 0), lm); c.position.set(x + Math.cos(i * 1.7) * 1.1, h - 0.3 + (i % 3) * 0.5, z + Math.sin(i * 1.7) * 1.1); c.castShadow = true; b.group.add(c); }
  b.world.addCS(x, h / 2, z, 0.6, h, 0.6);
}
const mirror = (list) => [...list, ...list.map(([x, z, ...r]) => [-x, -z, ...r])];
const V3 = (list) => list.map(([x, z]) => new THREE.Vector3(x, 0, z));
function teamSpawns(b, red) { b.spawns.red = V3(red); b.spawns.blue = V3(red.map(([x, z]) => [-x, -z])); }

// ───────────────────────── CARGO YARD ─────────────────────────
function cargoYard() {
  const b = new Builder();
  ground(b, 'asphalt', 14);
  const paint = std({ color: 0xe8c33a, roughness: 0.8 });
  for (const x of [-9, 9]) b.batch(new THREE.PlaneGeometry(0.25, 56).rotateX(-Math.PI / 2), paint, x, 0.01, 0);
  const concrete = std({ map: tex('concrete'), roughness: 0.9 });
  const office = std({ map: tex('concrete'), color: 0xc8ccd0, roughness: 0.85 });
  const floorM = std({ map: tex('plate'), color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 });
  b.perimeter(concrete, 6);
  // twin port offices joined by a sky bridge at the 2nd floor (y = 6) over the open yard
  b.tower(-20, 0, 12, 10, { wallMat: office, floorMat: floorM, doors: ['n', 's', 'w'], open: ['e'], ladders: [['w', 7]], doorsUp: [['e', 5, 2]] });
  b.tower(20, 0, 12, 10, { wallMat: office, floorMat: floorM, doors: ['n', 's', 'e'], open: ['w'], ladders: [['e', 3]], doorsUp: [['w', 5, 2]] });
  const deck = std({ map: tex('plate'), color: 0x8a9096, metalness: 0.7, roughness: 0.4 });
  const rail = std({ color: 0xf2c21b, metalness: 0.5, roughness: 0.4 });
  b.bridge(-14, 14, -1, 1, 6, deck, rail, true, [0]);
  for (const x of [-6, 6]) b.solid(x, 0, 0, 0.4, 5.8, 0.4, deck);           // bridge pylons
  b.ladder(0, 1.15, 6, 'x'); b.ladder(0, -1.15, 6, 'x');
  // containers [x, z, rotated(1 = long along z), levels]
  const stacks = mirror([[-22, -22, 1, 3], [-12, -22, 0, 2], [2, -23, 0, 3], [14, -22, 0, 1], [24, -14, 1, 2], [-8, -11, 0, 1], [11, -11, 1, 2]]);
  const L = 6.1, H = 2.6, Wd = 2.44;
  const cols = [0xb8352b, 0x2d6cb5, 0x2f8a4a, 0xd9792b, 0x8a8f94, 0x1f8a8a, 0x7a2f7a, 0xc9a227];
  const mats = [], ccols = [];
  stacks.forEach(([x, z, rot, lv], i) => {
    for (let l = 0; l < lv; l++) { mats.push(M4(x, l * H + H / 2, z, rot ? Math.PI / 2 : 0)); ccols.push(cols[(i * 3 + l * 5) % cols.length]); b.world.addCS(x, l * H + H / 2, z, rot ? Wd : L, H, rot ? L : Wd); }
    if (lv >= 2) { const lx = rot ? x + Math.sign(-x || 1) * (Wd / 2 + 0.1) : x + 1.2, lz = rot ? z + 1.2 : z + Math.sign(-z || 1) * (Wd / 2 + 0.1); b.ladder(lx, lz, lv * H, rot ? 'z' : 'x'); }
  });
  b.instanced(new THREE.BoxGeometry(L, H, Wd), std({ map: tex('container'), roughness: 0.6, metalness: 0.35 }), mats, ccols);
  const bars = []; mats.forEach((m) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); for (const e of [-1, 1]) bars.push(new THREE.Matrix4().compose(p.clone().add(new THREE.Vector3(e * (L / 2 + 0.02), 0, 0).applyQuaternion(q)), q, new THREE.Vector3(1, 1, 1))); });
  const endTex = tex('container').clone(); endTex.repeat.set(2, 1); endTex.needsUpdate = true;
  b.instanced(new THREE.BoxGeometry(0.06, H * 0.96, Wd * 0.96), std({ map: endTex, color: 0xb0b0b0, metalness: 0.4, roughness: 0.55 }), bars, ccols.flatMap((c) => [c, c]));
  // gantry crane (visual) over the yard
  const craneMat = std({ color: 0xe0a21c, metalness: 0.55, roughness: 0.45 });
  for (const cx of [-26, 26]) for (const dz of [-2.5, 2.5]) b.solid(cx, 0, -14 + dz, 0.9, 15, 0.9, craneMat);
  b.solid(0, 15, -14, 54, 1.4, 1.6, craneMat, { collide: false });
  b.solid(-6, 13.6, -14, 3, 1.6, 2.4, std({ color: 0xa82a20, metalness: 0.4, roughness: 0.5 }), { collide: false });
  b.crates(mirror([[-4, 5], [-3, 6.2], [4, -16], [16, 7], [-26, 8], [26, -26]]), std({ map: tex('crate'), roughness: 0.8 }));
  b.barrels(mirror([[-11, 3], [-10.4, 3.6], [6, 15], [-27, -5]]));
  teamSpawns(b, [[-16, 27], [-8, 27], [-2, 26.5], [4, 26.5], [9, 27], [16, 27.5], [0, 25.2]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [0, 5], [-5, -4], [6, 4], [-27, -8], [27, 8], [-8, 17], [8, -17], [0, -27], [0, 27]]);
  b.finish();
  return { b, env: { sky: 'day', sun: [0.55, 0.85, 0.35], sunColor: 0xfff1d6, sunI: 2.8, hemi: [0xbfd8ff, 0x5a5048, 1.05], fog: [0xb9cde0, 60, 170], exposure: 1.0 } };
}

// ───────────────────────── DESERT OUTPOST ─────────────────────────
function desertOutpost() {
  const b = new Builder();
  ground(b, 'sand', 12, 0xe6d6bc);
  const rock = std({ map: tex('rock'), roughness: 0.95 });
  const stone = std({ map: tex('concrete'), color: 0xd8c4a0, roughness: 0.92 });
  const floorM = std({ map: tex('wood'), roughness: 0.75 });
  let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = -HALF; i < HALF; i += 5) for (const side of [-1, 1]) {
    b.solid(i + 2.5, 0, side * (HALF + 1), 5.2, 10 + r() * 6, 3, rock, { ts: 6, col: { noClimb: true } });
    b.solid(side * (HALF + 1), 0, i + 2.5, 3, 10 + r() * 6, 5.2, rock, { ts: 6, col: { noClimb: true } });
  }
  // four corner towers, open toward the courtyard, joined by rampart walls (walkway at y = 6)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tower(sx * 20, sz * 18, 10, 8, { wallMat: stone, floorMat: floorM, stairMat: stone, doors: [sx < 0 ? 'w' : 'e'], open: [sz < 0 ? 's' : 'n'].concat([]), ladders: [[sz < 0 ? 'n' : 's', sx < 0 ? 3 : 7]], doorsUp: [[sz < 0 ? 's' : 'n', 5, 2]], stairs: sz < 0 ? 'n' : 's' });
  for (const sx of [-1, 1]) {
    const x = sx * 20;
    b.wall(x, -14, x, 14, 0, 6, 3, stone, [{ a: 11, b: 17, y0: 0, y1: 3.2 }], { ts: 3 });  // rampart with a gate
    b.wall(x + sx * 1.4, -14, x + sx * 1.4, 14, 6, 7, 0.3, stone, [], { ts: 3 });           // outer parapet
    b.vines(x - sx * 1.65, -7, 2.6, 6, 'z'); b.vines(x - sx * 1.65, 7, 2.6, 6, 'z');
  }
  // central scaffold watchtower (platforms at 3 / 6 / 9 m)
  const wood = std({ map: tex('wood'), roughness: 0.75 });
  b.scaffold(0, 0, 4, 4, 3, wood, std({ color: 0x6a4a2a, roughness: 0.9 }), ['s', 'n', 's']);
  b.solid(0, 10.2, 0, 5, 0.15, 5, std({ color: 0x7a6040, roughness: 0.9 }), { collide: false });
  // sandbags + cover
  const sb = []; const bags = (x, z, n, alongX) => { for (let i = 0; i < n; i++) for (let l = 0; l < 3; l++) { const o = (i - n / 2) * 0.62 + (l % 2) * 0.3; sb.push(M4(x + (alongX ? o : 0), 0.14 + l * 0.27, z + (alongX ? 0 : o), alongX ? 0 : Math.PI / 2)); } b.world.addCS(x, 0.45, z, alongX ? n * 0.62 + 0.3 : 0.5, 0.9, alongX ? 0.5 : n * 0.62 + 0.3); };
  for (const [x, z, n, ax] of mirror([[-8, -8, 4, true], [8, -6, 4, false], [0, -12, 6, true], [-12, 0, 5, false]])) bags(x, z, n, ax);
  const bagGeo = new THREE.CapsuleGeometry(0.15, 0.32, 4, 8).rotateZ(Math.PI / 2); bagGeo.scale(1, 0.85, 1.35);
  b.instanced(bagGeo, std({ color: 0xb59a6a, roughness: 0.95 }), sb);
  b.crates(mirror([[-5, 18], [-4, 19.2], [12, -3], [-24, -27.5], [26, 6]]), std({ map: tex('crate'), roughness: 0.8 }));
  boulders(b, mirror([[-14, 10, 1.4, 1], [10, 13, 1.1, 2], [-27, 4, 1.6, 3], [24, 25, 1.3, 4]]));
  const jeep = std({ color: 0x5c6440, roughness: 0.7, metalness: 0.3 });
  b.solid(-7, 0.4, 13, 2, 0.9, 4, jeep); b.solid(-7, 1.3, 12.4, 1.8, 0.6, 1.6, jeep, { collide: false });
  for (const [x, z] of [[-27, -14], [27, 14]]) tree(b, x, z, 6, 0x4f7a2a, 0x7a5a38);
  teamSpawns(b, [[-12, 27], [-6, 27], [0, 27.5], [6, 27], [12, 27], [-3, 25], [3, 25]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [-5, -5], [5, 5], [0, -18], [0, 18], [-14, -4], [14, 4], [-26, 0], [26, 0]]);
  b.finish();
  return { b, env: { sky: 'desert', sun: [0.4, 0.75, -0.5], sunColor: 0xffe2b0, sunI: 2.5, hemi: [0xd9ecff, 0x8a6a48, 0.85], fog: [0xe8d8bc, 70, 190], exposure: 0.88 } };
}

// ───────────────────────── ABANDONED CITY ─────────────────────────
function abandonedCity() {
  const b = new Builder();
  ground(b, 'asphalt', 14, 0xbbbbbb);
  const brick = std({ map: tex('brick'), roughness: 0.9 });
  const brick2 = std({ map: tex('brick'), color: 0xb0a8a0, roughness: 0.9 });
  const concrete = std({ map: tex('concrete'), roughness: 0.92 });
  const paint = std({ color: 0xe8e2c8, roughness: 0.8 });
  for (let i = -28; i <= 28; i += 4) { if (Math.abs(i) < 6) continue; b.batch(new THREE.PlaneGeometry(0.2, 2).rotateX(-Math.PI / 2), paint, 0, 0.012, i); b.batch(new THREE.PlaneGeometry(2, 0.2).rotateX(-Math.PI / 2), paint, i, 0.012, 0); }
  b.perimeter(brick2, 12);
  // four ruined 3-story blocks; inner facades fully open (balconies) for cross-street fights
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.tower(sx * 19, sz * 19, 14, 12, { wallMat: (sx * sz > 0) ? brick : brick2, floorMat: concrete, doors: [sx < 0 ? 'e' : 'w'], open: [sz < 0 ? 's' : 'n'], vines: [[sx < 0 ? 'e' : 'w', 3, 9], [sx < 0 ? 'e' : 'w', 9, 6]], ladders: [[sz < 0 ? 'n' : 's', 7]], doorsUp: [[sz < 0 ? 's' : 'n', 7, 2]], stairs: sz < 0 ? 'n' : 's' });
  }
  // street-spanning footbridges at 6 m connecting the north/south blocks on each side
  const deck = std({ map: tex('plate'), color: 0x7a7470, metalness: 0.5, roughness: 0.6 });
  const rail = std({ color: 0x3a3e42, metalness: 0.8, roughness: 0.4 });
  for (const sx of [-1, 1]) { b.bridge(sx * 19 - 1, sx * 19 + 1, -13, 13, 6, deck, rail, true, [0]); b.solid(sx * 19, 0, 0, 0.5, 5.8, 0.5, concrete); b.ladder(sx * 19 - sx * 1.15, 0, 6, 'z', 0, 'rungs'); }
  // burnt cars, rubble, jersey barriers in the open intersection
  const carMat = std({ color: 0x2c2826, roughness: 0.85, metalness: 0.3 }); const rust = std({ color: 0x6b3a20, roughness: 0.9, metalness: 0.2 });
  for (const [x, z, ry] of mirror([[-4, -9, 0.2], [-10, 3, 1.4]])) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), carMat); body.position.y = 0.6; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), rust); top.position.set(0, 1.3, 0.2); g.add(top);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); b.group.add(g);
    const c = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry)); b.world.addCS(x, 0.8, z, 1.9 * c + 4.2 * s2, 1.6, 4.2 * c + 1.9 * s2);
  }
  const rub = []; let sd = 3; const r = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
  for (const [x, z] of mirror([[-6, 5], [5, -14], [-25, 0]])) { for (let i = 0; i < 6; i++) rub.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (r() - 0.5) * 2, 0.2, z + (r() - 0.5) * 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(0.4 + r() * 0.5, 0.3 + r() * 0.4, 0.4 + r() * 0.5))); b.world.addCS(x, 0.4, z, 2, 0.8, 2); }
  b.instanced(new THREE.DodecahedronGeometry(1, 0), std({ map: tex('brick'), color: 0x9a8070, roughness: 0.95, flatShading: true }), rub);
  const jer = []; for (const [x, z, ry] of mirror([[-3, 3, 0], [8, 8, 0.8]])) { jer.push(M4(x, 0.45, z, ry)); b.world.addCS(x, 0.45, z, 2.4, 0.9, 2.4); }
  b.instanced(new THREE.BoxGeometry(3, 0.9, 0.6), concrete, jer);
  teamSpawns(b, [[-8, 27], [-3, 27.5], [3, 27.5], [8, 27], [0, 25], [-10, 24], [10, 24]]);
  b.spawns.ffa = V3([[-9, -27], [9, 27], [-27, -9], [27, 9], [0, 0], [-9, 9], [9, -9], [27, -2], [-27, 2], [3, -20], [-3, 20]]);
  b.finish();
  return { b, env: { sky: 'dusk', sun: [-0.5, 0.6, 0.45], sunColor: 0xffd0a0, sunI: 2.6, hemi: [0xb8c8e0, 0x4a4038, 1.1], fog: [0xa8a4a0, 45, 150], exposure: 1.0 } };
}

// ───────────────────────── UNDERGROUND LAB ─────────────────────────
function undergroundLab() {
  const b = new Builder();
  const CEIL = 9.6;
  ground(b, 'tile', 18, 0x9ea6ac, 0.45);
  b.world.ceiling = CEIL;
  const wallM = std({ map: tex('labwall'), color: 0xb8bec2, roughness: 0.75 });
  const concrete = std({ map: tex('concrete'), roughness: 0.9 });
  const ceilM = std({ map: tex('plate'), color: 0x9aa0a6, roughness: 0.8, metalness: 0.3 }); ceilM.userData.noCast = true;
  b.solid(0, CEIL, 0, SIZE + 4, 0.4, SIZE + 4, ceilM, { collide: false, ts: 4 });
  b.perimeter(wallM, CEIL);
  const grate = std({ map: tex('plate'), color: 0x8a9096, metalness: 0.7, roughness: 0.4 });
  const glass = std({ color: 0x9fd8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }); glass.userData.noCast = true;
  const rail = std({ color: 0xf2c21b, metalness: 0.5, roughness: 0.4 });
  // mezzanine rings on the north and south halls: level 1 (3 m, 8 m deep), level 2 (6 m, 4 m deep)
  for (const sz of [-1, 1]) {
    const zw = sz * HALF;                                      // wall line
    const z1a = zw - sz * 8, z2a = zw - sz * 4;                  // inner edges
    const lo = (a, c) => [Math.min(a, c), Math.max(a, c)];
    const [m1z0, m1z1] = lo(zw, z1a), [m2z0, m2z1] = lo(zw, z2a);
    b.slab(-HALF, HALF, m1z0, m1z1, FLOOR, grate);
    b.slab(-HALF, HALF, m2z0, m2z1, 2 * FLOOR, grate);
    b.flight(0, z1a - sz * 6, 'z', sz, 2, 0, concrete);               // ground → mezz 1 (lane x ∈ [-1,1]) arriving at the inner edge
    b.flight(6, z2a - sz * 1, 'x', 1, 2, FLOOR, concrete);             // mezz 1 → mezz 2 along the open strip, x 6 → 12
    // glass balustrades along the inner edges (gaps where stairs / the atrium bridge arrive)
    for (const [ed, y, gaps] of [[z1a, FLOOR, [[-HALF, -24.9], [-23.1, -1.2], [1.2, 23.1], [24.9, HALF]]], [z2a, 2 * FLOOR, [[-HALF, -16.9], [-15.1, -12.2], [-9.8, 5.8], [12.2, 15.1], [16.9, HALF]]]]) for (const [xa, xb] of gaps) {
      b.solid((xa + xb) / 2, y, ed + sz * 0.05, xb - xa, 1.0, 0.06, glass, { col: { seeThrough: true } });
      b.solid((xa + xb) / 2, y + 1.0, ed + sz * 0.05, xb - xa, 0.06, 0.1, rail);
    }
    // support columns + climbable cable bundles from the floor to each level
    for (const x of [-20, -10, 10, 20]) b.solid(x, 0, z1a + sz * 0.4, 0.6, FLOOR - 0.25, 0.6, concrete);
    for (const x of [-24, 24]) { const cz = z1a - sz * 0.25; cableVisual(b, x, cz, FLOOR); b.climbable(x, cz, 0.4, FLOOR, 'x', 0, 0.3); }
    for (const x of [-16, 16]) { const cz = z2a - sz * 0.25; cableVisual(b, x, cz, FLOOR, FLOOR); b.climbable(x, cz, 0.4, FLOOR, 'x', FLOOR, 0.3); }
    // server racks on mezzanines
    const rack = []; for (let i = 0; i < 6; i++) { const x = -26 + i * 2.2, z = zw - sz * 1.2; rack.push(M4(x, FLOOR + 1.1, z)); b.world.addCS(x, FLOOR + 1.1, z, 1.0, 2.2, 1.0); }
    b.instanced(new THREE.BoxGeometry(1, 2.2, 1), std({ color: 0x23272c, metalness: 0.7, roughness: 0.35 }), rack);
  }
  // high bridge across the atrium at level 2
  b.bridge(-12, -10, -26, 26, 2 * FLOOR, grate, rail);
  // atrium floor: containment tanks + glass partitions + tables as cover
  for (const [x, z] of [[-18, 0], [18, 0]]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 24), std({ color: 0x4a5056, metalness: 0.8, roughness: 0.3 })); base.position.set(x, 0.25, z); base.castShadow = base.receiveShadow = true; b.group.add(base);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 5.2, 24, 1, true), std({ color: 0x7affc8, transparent: true, opacity: 0.25, emissive: 0x20ff90, emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false })); gl.position.set(x, 3.1, z); b.group.add(gl);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.8, 24), std({ color: 0x30ff90, emissive: 0x20ff80, emissiveIntensity: 0.9, transparent: true, opacity: 0.35, depthWrite: false })); fl.position.set(x, 3.0, z); b.group.add(fl);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 24), base.material); cap.position.set(x, 5.9, z); b.group.add(cap);
    b.world.addCS(x, 3.0, z, 2.8, 6.0, 2.8);
  }
  for (const [x, z, w, alongX] of [[-6, -4, 8, true], [6, 4, 8, true], [-26, 6, 6, false], [26, -6, 6, false]]) {
    b.solid(x, 0, z, alongX ? w : 0.08, 2.8, alongX ? 0.08 : w, glass, { col: { seeThrough: true } });
    b.solid(x, 0, z, alongX ? w : 0.16, 0.5, alongX ? 0.16 : w, std({ color: 0x5a6066, metalness: 0.7, roughness: 0.4 }));
  }
  const table = std({ color: 0xe8ecee, roughness: 0.4, metalness: 0.2 });
  for (const [x, z] of mirror([[-8, 8], [10, -8], [-24, -14]])) b.solid(x, 0, z, 3.2, 0.95, 1.2, table);
  b.crates(mirror([[-14, -10], [-13, -8.8], [26, 12]]), std({ color: 0x8a9298, map: tex('crate'), roughness: 0.7 }));
  const panels = []; for (let x = -25; x <= 25; x += 10) for (let z = -25; z <= 25; z += 10) panels.push(M4(x, CEIL - 0.03, z));
  b.instanced(new THREE.BoxGeometry(2.4, 0.06, 0.6), std({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 2.2 }), panels, null, false);
  teamSpawns(b, [[-14, 18], [-8, 18], [8, 18], [14, 18], [-20, 18], [20, 18], [-4, 15]]);
  b.spawns.ffa = V3([[-27, -18], [27, 18], [-27, 18], [27, -18], [0, 0], [-12, -6], [12, 6], [0, -16], [0, 16], [-27, 0], [27, 0]]);
  b.finish();
  const lights = [];
  for (const [x, z, c] of [[-18, 0, 0x40ff90], [18, 0, 0x40ff90], [0, 0, 0xcfe8ff], [0, -24, 0x60ffa0], [0, 24, 0x60ffa0]]) { const l = new THREE.PointLight(c, 22, 20, 1.6); l.position.set(x, CEIL - 0.8, z); lights.push(l); }
  return { b, lights, env: { sky: 'indoor', sun: [0.15, 1, 0.25], sunColor: 0xdfeaff, sunI: 1.1, hemi: [0xdfe8f0, 0x50565c, 0.8], fog: [0x1a2026, 35, 100], exposure: 0.82, indoor: true } };
}
function cableVisual(b, x, z, h, y0 = 0) {
  const m = b.mat('cable', () => std({ color: 0x1a1a1a, roughness: 0.6 })); const y = b.mat('cableY', () => std({ color: 0xf2c21b, roughness: 0.5 }));
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 8), i === 1 ? y : m); c.position.set(x + (i % 2) * 0.09 - 0.045, y0 + h / 2, z + (i > 1 ? 0.07 : -0.02)); c.castShadow = true; b.group.add(c); }
}

// ───────────────────────── FROSTBITE STATION ─────────────────────────
function frostbite() {
  const b = new Builder();
  ground(b, 'sand', 10, 0xf2f6fa, 0.8);
  const ice = std({ map: tex('rock'), color: 0xdfeefc, roughness: 0.6 });
  const panel = std({ map: tex('plate'), color: 0xe8ecf0, roughness: 0.5, metalness: 0.3 });
  const orange = std({ map: tex('plate'), color: 0xe06a20, roughness: 0.5, metalness: 0.3 });
  const floorM = std({ map: tex('plate'), color: 0x8a9096, roughness: 0.5, metalness: 0.5 });
  b.perimeter(ice, 9, { ts: 6 });
  b.tower(-18, -14, 12, 10, { wallMat: panel, floorMat: floorM, doors: ['w', 'n'], open: ['e'], ladders: [['n', 9]], doorsUp: [['s', 6, 2]] });
  b.tower(18, 14, 12, 10, { wallMat: orange, floorMat: floorM, doors: ['e', 's'], open: ['w'], ladders: [['s', 3]], doorsUp: [['n', 6, 2]], stairs: 's' });
  // central radar scaffold + icy bridges from each lab tower's 2nd floor
  const deck = std({ map: tex('plate'), color: 0xaab4bc, metalness: 0.6, roughness: 0.35 });
  const post = std({ color: 0x3a4048, metalness: 0.8, roughness: 0.35 });
  b.scaffold(0, 0, 6, 6, 3, deck, post, ['e', 'w', 'e']);
  b.bridge(-19, -17, -9, -1, 6, deck, post, false); b.bridge(-17, -3, -3, -1, 6, deck, post, false);
  b.bridge(17, 19, 1, 9, 6, deck, post, false); b.bridge(3, 17, 1, 3, 6, deck, post, false);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3), std({ color: 0xf0f4f8, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide }));
  dish.position.set(0, 12.5, 0); dish.rotation.x = Math.PI * 0.7; dish.castShadow = true; b.group.add(dish);
  b.solid(0, 10, 0, 0.3, 2.2, 0.3, post, { collide: false });
  // fuel tanks + containers + snow drifts as cover
  for (const [x, z] of mirror([[-6, 18]])) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 24).rotateZ(Math.PI / 2), std({ color: 0xc8d4dc, metalness: 0.6, roughness: 0.35 })); t.position.set(x, 1.6, z); t.castShadow = true; b.group.add(t); b.world.addCS(x, 1.6, z, 6, 3.2, 3.2); }
  const cmats = []; for (const [x, z, r] of mirror([[12, -20, 0], [-26, 10, 1]])) { cmats.push(M4(x, 1.3, z, r ? Math.PI / 2 : 0)); b.world.addCS(x, 1.3, z, r ? 2.44 : 6.1, 2.6, r ? 6.1 : 2.44); }
  b.instanced(new THREE.BoxGeometry(6.1, 2.6, 2.44), std({ map: tex('container'), roughness: 0.6, metalness: 0.35 }), cmats, [0x2d6cb5, 0xc8352b, 0x2d6cb5, 0xc8352b]);
  boulders(b, mirror([[-9, 6, 1.2, 1], [8, 10, 1.4, 2], [-24, -24, 1.8, 3], [26, -2, 1.5, 4], [-3, -10, 1.0, 5]]), 0xeef4fa, 'sand');
  b.crates(mirror([[6, -6], [7, -7.2]]), std({ map: tex('crate'), color: 0xd0d8e0, roughness: 0.8 }));
  teamSpawns(b, [[-10, 27], [-4, 27.5], [2, 27.5], [8, 27], [-14, 25], [14, 26], [0, 25]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [-8, 0], [8, 0], [0, -14], [0, 14], [-26, -2], [26, 2], [-10, 25], [10, -25]]);
  b.finish();
  return { b, env: { sky: 'snow', sun: [0.3, 0.6, 0.6], sunColor: 0xeaf2ff, sunI: 2.2, hemi: [0xdfefff, 0x9aa8b8, 1.0], fog: [0xd8e4f0, 40, 140], exposure: 0.85 } };
}

// ───────────────────────── JUNGLE TEMPLE ─────────────────────────
function jungleTemple() {
  const b = new Builder();
  ground(b, 'sand', 12, 0x6a7a42, 1);
  const stone = std({ map: tex('rock'), color: 0x9a9a82, roughness: 0.95 });
  const mossy = std({ map: tex('concrete'), color: 0x8a9a6a, roughness: 0.95 });
  const rock = std({ map: tex('rock'), color: 0x6a7a52, roughness: 0.95 });
  b.perimeter(rock, 10, { ts: 6 });
  // stepped pyramid: tiers 22 / 14 / 8 m, 3 m tall each; stairs cut into the north (to the top) and south faces
  b.slab(-11, 11, -11, 11, FLOOR, mossy, [], FLOOR);
  for (const [a, c, d, e] of cutRects([-7, 7, -7, 7], [[-1, 1, -7, -5], [-1, 1, 5, 7]])) b.block(a, c, d, e, FLOOR, 2 * FLOOR, stone, { ts: 3 });
  for (const [a, c, d, e] of cutRects([-4, 4, -4, 4], [[-1, 1, -4, 1]])) b.block(a, c, d, e, 2 * FLOOR, 3 * FLOOR, mossy, { ts: 3 });
  b.flight(0, -17, 'z', 1, 2, 0, stone); b.flight(0, 17, 'z', -1, 2, 0, stone);          // ground → tier 1
  b.flight(0, -11, 'z', 1, 2, FLOOR, stone); b.flight(0, 11, 'z', -1, 2, FLOOR, stone);  // tier 1 → tier 2
  b.flight(0, -5, 'z', 1, 2, 2 * FLOOR, stone);                                           // tier 2 → summit
  for (const sx of [-1, 1]) { b.vines(sx * 11.25, 4, 3, FLOOR, 'z'); b.vines(sx * 7.25, -2, 3, FLOOR, 'z', FLOOR); b.vines(sx * 4.25, 2, 2.4, FLOOR, 'z', 2 * FLOOR); }
  // summit shrine
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.solid(x, 3 * FLOOR, z, 0.7, 2.6, 0.7, stone);
  b.solid(0, 3 * FLOOR + 2.6, 0, 7.4, 0.5, 7.4, mossy);
  // ruined side towers with vines
  b.tower(-23, 0, 10, 8, { wallMat: mossy, floorMat: stone, doors: ['e'], open: ['e'], vines: [['w', 4, 9]], ladders: [['n', 7]] });
  b.tower(23, 0, 10, 8, { wallMat: mossy, floorMat: stone, doors: ['w'], open: ['w'], vines: [['e', 4, 9]], ladders: [['s', 3]] });
  // broken pillars + low walls + trees
  for (const [x, z, h] of mirror([[-15, -15, 4], [-8, -18, 2.5], [15, -20, 3], [-20, -10, 1.6]])) b.solid(x, 0, z, 1.0, h, 1.0, stone);
  for (const [x, z, w, ax] of mirror([[-16, 16, 5, true], [8, 18, 4, true]])) b.solid(x, 0, z, ax ? w : 0.7, 1.1, ax ? 0.7 : w, stone);
  for (const [x, z] of mirror([[-26, -24], [-14, -26], [12, -25], [26, -16], [-24, 12], [-6, 23]])) tree(b, x, z, 8 + Math.abs(x % 3), 0x2f6a22, 0x4a3420);
  boulders(b, mirror([[-18, 6, 1.2, 1], [14, 8, 1.0, 2]]), 0x7a8a62);
  teamSpawns(b, [[-12, 27.5], [-5, 27.5], [2, 27.5], [8, 27], [14, 27.5], [-2, 21], [3, 22]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [-15, 0], [15, 0], [0, -21], [0, 21], [-14, -22], [14, 22], [-25, 22], [25, -22]]);
  b.finish();
  return { b, env: { sky: 'jungle', sun: [0.45, 0.8, 0.3], sunColor: 0xfff0c8, sunI: 2.4, hemi: [0xc8e8c0, 0x3a4a28, 1.0], fog: [0x9ab890, 40, 140], exposure: 0.92 } };
}

// ───────────────────────── NEON MARKET ─────────────────────────
function neonMarket() {
  const b = new Builder();
  ground(b, 'asphalt', 14, 0x6a6e78, 0.35);
  const wallA = std({ map: tex('concrete'), color: 0x5a5470, roughness: 0.8 });
  const wallB = std({ map: tex('brick'), color: 0x7a6a7a, roughness: 0.85 });
  const floorM = std({ map: tex('tile'), color: 0x8a8a9a, roughness: 0.5 });
  b.perimeter(wallA, 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tower(sx * 21, sz * 12, 12, 10, { wallMat: sz < 0 ? wallA : wallB, floorMat: floorM, doors: [sz < 0 ? 'n' : 's'], open: [sx < 0 ? 'e' : 'w'], ladders: [[sx < 0 ? 'w' : 'e', 5]], doorsUp: [[sx < 0 ? 'e' : 'w', 5, 2]] });
  const deck = std({ map: tex('plate'), color: 0x50505a, metalness: 0.7, roughness: 0.35 });
  const railN = std({ color: 0xff3adf, emissive: 0xff20d0, emissiveIntensity: 1.6 });
  for (const sz of [-1, 1]) { b.bridge(-15, 15, sz * 12 - 1, sz * 12 + 1, 6, deck, railN, true, [0]); b.solid(0, 0, sz * 12, 0.5, 5.8, 0.5, wallA); b.ladder(0, sz * 12 - sz * 1.15, 6, 'x', 0, 'rungs'); }
  // neon signs on tower faces
  const neonCols = [0xff2ad8, 0x2af0ff, 0xfff02a, 0x7a3aff, 0xff5a2a, 0x2aff8a];
  let k = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [2.8, 5.8, 8.8]) {
    const c = neonCols[k++ % neonCols.length]; const m = std({ color: c, emissive: c, emissiveIntensity: 2.5, toneMapped: false });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 3.2), m); sign.position.set(sx * 21 - sx * 6.2, y, sz * 12 + (sz < 0 ? 2.5 : -2.5)); b.group.add(sign);
  }
  // market stalls (counters collide, canopies don't)
  const stallC = [0xc8352b, 0x2d6cb5, 0x2f8a4a, 0xd9a227];
  for (const [x, z, i] of [[-8, -3, 0], [-3, 4, 1], [4, -4, 2], [9, 3, 3], [-9, 20, 1], [9, -20, 2], [0, 19, 0], [0, -19, 3]]) {
    b.solid(x, 0, z, 3, 1.0, 1.4, std({ map: tex('wood'), roughness: 0.8 }));
    b.solid(x, 2.4, z, 3.6, 0.1, 2.4, std({ color: stallC[i], roughness: 0.7, side: THREE.DoubleSide }), { collide: false });
    for (const dx of [-1.6, 1.6]) b.solid(x + dx, 0, z - 1, 0.08, 2.4, 0.08, std({ color: 0x333333 }), { collide: false });
  }
  // lantern strings
  const lantern = std({ color: 0xffa040, emissive: 0xff8020, emissiveIntensity: 2, toneMapped: false });
  const lm = []; for (let x = -14; x <= 14; x += 2) for (const z of [-6, 6]) lm.push(M4(x, 7.4 + Math.cos(x * 0.25) * 0.4, z));
  b.instanced(new THREE.SphereGeometry(0.18, 10, 8), lantern, lm, null, false);
  b.crates(mirror([[-14, -2], [14, -8], [-4, 25], [-24, -27.5]]), std({ map: tex('crate'), roughness: 0.8 }));
  b.barrels(mirror([[-12, 8], [6, 9]]), [0x3a3a44, 0x5a2a6a]);
  teamSpawns(b, [[-10, 27], [-4, 27.5], [2, 27.5], [8, 27], [-12, 24], [12, 24], [0, 25]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [0, 0], [-6, 10], [6, -10], [-27, 0], [27, 0], [-12, -25], [12, 25]]);
  b.finish();
  const lights = [];
  for (const [x, z, c] of [[-12, -12, 0xff40e0], [12, 12, 0x40f0ff], [-12, 12, 0xffd040], [12, -12, 0x8040ff], [0, 0, 0xff8040]]) { const l = new THREE.PointLight(c, 30, 22, 1.6); l.position.set(x, 5, z); lights.push(l); }
  return { b, lights, env: { sky: 'night', sun: [-0.3, 0.8, -0.4], sunColor: 0x8a9ad8, sunI: 0.9, hemi: [0x5a6aa8, 0x2a2030, 0.9], fog: [0x141826, 30, 110], exposure: 1.0 } };
}

// ───────────────────────── REFINERY ─────────────────────────
function refinery() {
  const b = new Builder();
  ground(b, 'concrete', 12, 0xb0aaa0);
  const concrete = std({ map: tex('concrete'), roughness: 0.9 });
  const steel = std({ color: 0x5a6068, metalness: 0.8, roughness: 0.35 });
  const yellow = std({ color: 0xe0a020, metalness: 0.5, roughness: 0.45 });
  const deck = std({ map: tex('plate'), color: 0x8a9096, metalness: 0.7, roughness: 0.4 });
  b.perimeter(concrete, 7);
  // storage tanks (walkable tops at 8 m, ladders up the side)
  const tankM = std({ color: 0xd8dcd8, metalness: 0.5, roughness: 0.35 });
  for (const [x, z] of [[-20, -18], [20, 18]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 8, 32), tankM); t.position.set(x, 4, z); t.castShadow = t.receiveShadow = true; b.group.add(t);
    for (const y of [2, 4, 6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(4.02, 0.05, 6, 40).rotateX(Math.PI / 2), steel); r.position.set(x, y, z); b.group.add(r); }
    b.world.addCS(x, 4, z, 7.2, 8, 7.2); b.world.addCS(x, 4, z, 5.6, 8, 8.0); b.world.addCS(x, 4, z, 8.0, 8, 5.6);
    b.ladder(x + Math.sign(-x) * 4.1, z, 8, 'z', 0, 'rungs');
  }
  // scaffold distillation towers
  b.scaffold(20, -18, 6, 6, 3, deck, yellow, ['w', 'n', 'w']);
  b.scaffold(-20, 18, 6, 6, 3, deck, yellow, ['e', 's', 'e']);
  for (const [x, z] of [[20, -18], [-20, 18]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 12, 16), steel); c.position.set(x, 6, z); b.group.add(c); b.world.addCS(x, 6, z, 1.6, 12, 1.6); }
  // elevated pipe-rack catwalk across the middle at 6 m, reached from both scaffolds and ladders
  b.bridge(-17, 17, -1, 1, 6, deck, yellow, true, [-6, 6]);
  b.bridge(17, 19, -15, 1, 6, deck, yellow, false); b.bridge(-19, -17, -1, 15, 6, deck, yellow, false);
  for (const x of [-10, 0, 10]) { b.solid(x, 0, -1.5, 0.35, 6.4, 0.35, steel); b.solid(x, 0, 1.5, 0.35, 6.4, 0.35, steel); }
  for (const dz of [-1.6, 1.6]) for (const dy of [5.2, 5.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 34, 12).rotateZ(Math.PI / 2), dz < 0 ? steel : yellow); p.position.set(0, dy, dz * 1.15); p.castShadow = true; b.group.add(p); }
  b.ladder(-6, 1.15, 6, 'x', 0, 'rungs'); b.ladder(6, -1.15, 6, 'x', 0, 'rungs');
  // ground clutter: pipe stacks, barrels, crates
  for (const [x, z] of mirror([[-8, 10], [10, 8]])) { b.solid(x, 0, z, 4, 1.0, 1.2, steel); }
  b.barrels(mirror([[-3, -8], [-2.4, -8.6], [14, -4], [-26, 0]]), [0xc8352b, 0xe0a020, 0x2d6cb5]);
  b.crates(mirror([[4, 14], [5, 15.2], [-26, -6]]), std({ map: tex('crate'), roughness: 0.8 }));
  teamSpawns(b, [[-8, 27], [-2, 27.5], [4, 27.5], [10, 27], [-12, 26], [14, 27.5], [2, 25]]);
  b.spawns.ffa = V3([[-27, -27], [27, 27], [-27, 27], [27, -27], [0, -6], [0, 6], [-10, -6], [10, 6], [-27, -10], [27, 10], [-6, 22], [6, -22]]);
  b.finish();
  return { b, env: { sky: 'dusk', sun: [0.6, 0.55, -0.4], sunColor: 0xffc890, sunI: 2.5, hemi: [0xc8d0e0, 0x50483c, 1.0], fog: [0xc0a890, 50, 160], exposure: 0.95 } };
}

const BUILD = { cargo_yard: cargoYard, desert_outpost: desertOutpost, abandoned_city: abandonedCity, underground_lab: undergroundLab, frostbite, jungle_temple: jungleTemple, neon_market: neonMarket, refinery };

export function buildMap(id, { nav: withNav = true } = {}) {
  const { b, env, lights = [] } = BUILD[id]();
  for (const l of lights) b.group.add(l);
  const nav = withNav ? buildNav(b.world) : null;
  return { id, group: b.group, world: b.world, spawns: b.spawns, nav, env, info: MAPS[id] };
}

// ───────── Layered navigation ─────────
// 1 m cells; each cell holds every walkable surface height (ground, floors, stairs, roofs, bridges).
// Movement between neighbouring cells: walk if |Δh| ≤ 0.6, drop if the higher side is open above the lower.
// Designated climbables (ladders/vines/rungs) add explicit climb links between their base and top.
const NAV_R = 0.4;
export function buildNav(world) {
  const N = SIZE, half = HALF; const ceil = world.ceiling;
  const cellNodes = new Array(N * N); const solids = new Array(N * N);
  const nodeH = [], nodeCell = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -half + i + 0.5, z = -half + j + 0.5; const c = i * N + j;
    cellNodes[c] = []; solids[c] = [];
    if (Math.abs(x) > half - 1 || Math.abs(z) > half - 1) continue;
    const near = world.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
    const iv = [], cands = [0];
    for (const b of near) {
      if (b.noCollide) continue;
      if (x + NAV_R > b.min[0] && x - NAV_R < b.max[0] && z + NAV_R > b.min[2] && z - NAV_R < b.max[2]) iv.push([b.min[1], b.max[1]]);
      if (x >= b.min[0] - 0.05 && x <= b.max[0] + 0.05 && z >= b.min[2] - 0.05 && z <= b.max[2] + 0.05 && !b.seeThrough && !b.climbable) cands.push(b.max[1]);
    }
    solids[c] = iv;
    cands.sort((p, q) => p - q);
    const ok = [];
    for (const h of cands) {
      if (h + 1.8 > ceil) continue;
      if (iv.some(([y0, y1]) => y0 < h + 1.75 && y1 > h + 0.56)) continue;
      if (ok.length && h - ok[ok.length - 1] < 0.5) ok[ok.length - 1] = h; else ok.push(h);
    }
    for (const h of ok) { cellNodes[c].push(nodeH.length); nodeH.push(h); nodeCell.push(c); }
  }
  const nav = { N, half, cellNodes, solids, nodeH: Float32Array.from(nodeH), nodeCell: Int32Array.from(nodeCell), links: new Map() };
  // climb links
  for (const b of world.boxes) {
    if (!b.climbable) continue;
    // the base must have open air above it all the way up (so the climber never rises into a deck)
    const open = (n) => { for (const [y0, y1] of nav.solids[nav.nodeCell[n]]) if (y0 < b.max[1] + 1.8 && y1 > nav.nodeH[n] + 0.5) return false; return true; };
    const bottom = nearestNodeTo(nav, (b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2, b.min[1], 1.6, 0.7, open);
    const top = nearestNodeTo(nav, (b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2, b.max[1], 1.8, 0.7);
    if (bottom == null || top == null || bottom === top || nav.nodeH[top] - nav.nodeH[bottom] < 1) continue;
    const ladder = { x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2 };
    const cost = (nav.nodeH[top] - nav.nodeH[bottom]) * 1.6 + 1;
    if (!nav.links.has(bottom)) nav.links.set(bottom, []); nav.links.get(bottom).push({ to: top, cost, ladder });
    if (!nav.links.has(top)) nav.links.set(top, []); nav.links.get(top).push({ to: bottom, cost, ladder });
  }
  return nav;
}
// nearest node (by xz distance within r) whose height is within tol of y
export function nearestNodeTo(nav, x, z, y, r = 2, tol = 0.7, filter = null) {
  const { N, half } = nav; let best = null, bd = Infinity;
  const i0 = Math.floor(x + half), j0 = Math.floor(z + half); const R = Math.ceil(r);
  for (let i = i0 - R; i <= i0 + R; i++) for (let j = j0 - R; j <= j0 + R; j++) {
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const cx = -half + i + 0.5, cz = -half + j + 0.5; const d = Math.hypot(cx - x, cz - z); if (d > r) continue;
    for (const n of nav.cellNodes[i * N + j]) { const dh = Math.abs(nav.nodeH[n] - y); if (dh > tol || (filter && !filter(n))) continue; const s = d + dh * 0.5; if (s < bd) { bd = s; best = n; } }
  }
  return best;
}
export { HALF as MAP_HALF };
