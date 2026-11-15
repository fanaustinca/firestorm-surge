// Static AABB collision world with a 2D spatial hash.
// Boxes: { min:[x,y,z], max:[x,y,z], climbable, kind, hp?, id }
import * as THREE from 'three';

const CELL = 4;

export class CollisionWorld {
  constructor() { this.boxes = []; this.grid = new Map(); this.nextId = 1; this.ceiling = Infinity; this.bounds = 37.5; }

  add(min, max, opts = {}) {
    const b = { min: [...min], max: [...max], id: this.nextId++, ...opts };
    this.boxes.push(b); this._index(b);
    return b;
  }
  // center/size helper
  addCS(cx, cy, cz, sx, sy, sz, opts) { return this.add([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], opts); }

  remove(b) {
    this.boxes = this.boxes.filter((x) => x !== b);
    for (const [k, arr] of this.grid) { const i = arr.indexOf(b); if (i >= 0) arr.splice(i, 1); }
    b.removed = true;
  }
  _keys(minx, minz, maxx, maxz) {
    const out = [];
    for (let i = Math.floor(minx / CELL); i <= Math.floor(maxx / CELL); i++) for (let j = Math.floor(minz / CELL); j <= Math.floor(maxz / CELL); j++) out.push(i + ',' + j);
    return out;
  }
  _index(b) { for (const k of this._keys(b.min[0], b.min[2], b.max[0], b.max[2])) { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(b); } }

  query(minx, minz, maxx, maxz) {
    const set = new Set();
    for (const k of this._keys(minx, minz, maxx, maxz)) { const a = this.grid.get(k); if (a) for (const b of a) set.add(b); }
    return set;
  }

  // Ray vs boxes. Returns {t, point, normal, box} or null. dir must be normalized.
  raycast(o, d, maxT, filter) {
    let best = null;
    // walk the grid cells along the ray (DDA-lite: sample bbox of segment chunks)
    const steps = Math.max(1, Math.ceil(maxT / CELL));
    const seen = new Set();
    for (let s = 0; s < steps; s++) {
      const t0 = (s * maxT) / steps, t1 = ((s + 1) * maxT) / steps;
      const ax = o.x + d.x * t0, az = o.z + d.z * t0, bx = o.x + d.x * t1, bz = o.z + d.z * t1;
      for (const b of this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
        if (seen.has(b)) continue; seen.add(b);
        if (filter && !filter(b)) continue;
        const hit = rayBox(o, d, b.min, b.max);
        if (hit && hit.t <= maxT && (!best || hit.t < best.t)) { best = hit; best.box = b; }
      }
      if (best && best.t <= t1) break;
    }
    // world ceiling (indoor maps)
    if (this.ceiling < Infinity && d.y > 1e-6) {
      const t = (this.ceiling - o.y) / d.y;
      if (t >= 0 && t <= maxT && (!best || t < best.t)) best = { t, normal: new THREE.Vector3(0, -1, 0), box: { kind: 'ceiling' } };
    }
    // ground plane y=0
    if (d.y < -1e-6) {
      const t = -o.y / d.y;
      if (t >= 0 && t <= maxT && (!best || t < best.t)) best = { t, normal: new THREE.Vector3(0, 1, 0), box: { kind: 'ground' } };
    }
    if (best) best.point = new THREE.Vector3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }

  lineOfSight(a, b) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 1e-4) return true;
    d.divideScalar(len);
    const h = this.raycast(a, d, len - 0.05, (bx) => !bx.seeThrough);
    return !h;
  }

  // Resolve a vertical cylinder (feet at pos.y). Mutates pos & vel. Returns {onGround, touchingClimbable, hitCeiling, climbBox}
  resolve(pos, vel, radius, height, stepUp = 0.45) {
    const res = { onGround: false, touching: [], hitCeiling: false, groundBox: null };
    const near = this.query(pos.x - radius - 1, pos.z - radius - 1, pos.x + radius + 1, pos.z + radius + 1);
    // ground plane
    if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; res.onGround = true; }
    for (let iter = 0; iter < 3; iter++) {
      for (const b of near) {
        if (b.noCollide) continue;
        const top = b.max[1], bot = b.min[1];
        if (pos.y + height <= bot || pos.y >= top) continue;
        // closest point on box (xz)
        const cx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
        const cz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        // can we land on top / step up?
        const penY = top - pos.y;
        if (penY <= stepUp && vel.y <= 0.5 && !b.wallOnly) { pos.y = top; if (vel.y < 0) vel.y = 0; res.onGround = true; res.groundBox = b; continue; }
        // hitting head on underside
        if (vel.y > 0 && pos.y + height - bot < 0.25 && pos.y < bot) { pos.y = bot - height; vel.y = 0; res.hitCeiling = true; continue; }
        let d = Math.sqrt(d2);
        if (d < 1e-5) { // center inside box: push out along least-penetration axis
          const px1 = pos.x - b.min[0], px2 = b.max[0] - pos.x, pz1 = pos.z - b.min[2], pz2 = b.max[2] - pos.z;
          const m = Math.min(px1, px2, pz1, pz2);
          if (m === px1) { dx = -1; dz = 0; d = 0; pos.x = b.min[0] - radius; }
          else if (m === px2) { pos.x = b.max[0] + radius; }
          else if (m === pz1) { pos.z = b.min[2] - radius; }
          else pos.z = b.max[2] + radius;
        } else {
          const push = radius - d; pos.x += (dx / d) * push; pos.z += (dz / d) * push;
          const n = [dx / d, dz / d]; const vn = vel.x * n[0] + vel.z * n[1];
          if (vn < 0) { vel.x -= vn * n[0]; vel.z -= vn * n[1]; }
        }
        res.touching.push(b);
      }
    }
    // standing on box exactly (pos.y == top) detection
    if (!res.onGround && vel.y <= 0) {
      for (const b of near) {
        if (b.noCollide || b.wallOnly) continue;
        if (Math.abs(pos.y - b.max[1]) < 0.02) {
          const cx = Math.max(b.min[0], Math.min(pos.x, b.max[0])), cz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
          if ((pos.x - cx) ** 2 + (pos.z - cz) ** 2 < radius * radius * 0.5) { res.onGround = true; res.groundBox = b; vel.y = Math.max(0, vel.y); break; }
        }
      }
    }
    if (pos.y + height > this.ceiling) { pos.y = this.ceiling - height; if (vel.y > 0) vel.y = 0; res.hitCeiling = true; }
    const B = this.bounds - radius;
    pos.x = Math.max(-B, Math.min(B, pos.x)); pos.z = Math.max(-B, Math.min(B, pos.z));
    return res;
  }

  // climbable surfaces within reach in front of the player
  climbableNear(pos, radius, height, fwd) {
    const probe = { x: pos.x + fwd.x * 0.25, z: pos.z + fwd.z * 0.25 };
    for (const b of this.query(probe.x - 1, probe.z - 1, probe.x + 1, probe.z + 1)) {
      if (!b.climbable) continue;
      if (pos.y > b.max[1] + 0.2 || pos.y + height < b.min[1]) continue;
      const cx = Math.max(b.min[0], Math.min(probe.x, b.max[0])), cz = Math.max(b.min[2], Math.min(probe.z, b.max[2]));
      if ((probe.x - cx) ** 2 + (probe.z - cz) ** 2 <= (radius + 0.12) ** 2) return b;
    }
    return null;
  }

  groundHeightAt(x, z, fromY = 100) {
    let h = 0;
    for (const b of this.query(x, z, x, z)) {
      if (b.noCollide || b.wallOnly) continue;
      if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= fromY && b.max[1] > h) h = b.max[1];
    }
    return h;
  }
}

const _inv = new THREE.Vector3();
export function rayBox(o, d, min, max) {
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0;
  const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(da[i]) < 1e-9) { if (oa[i] < min[i] || oa[i] > max[i]) return null; continue; }
    const inv = 1 / da[i];
    let t1 = (min[i] - oa[i]) * inv, t2 = (max[i] - oa[i]) * inv, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return null; // origin inside — ignore
  const n = new THREE.Vector3(); if (axis >= 0) n.setComponent(axis, sign);
  void _inv;
  return { t: tmin, normal: n };
}

// Ray vs sphere → t or null
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z; const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc); return t >= 0 ? t : (cc < 0 ? 0 : null);
}
// Ray vs vertical capsule-ish cylinder (feet at base.y, from y0..y1) → t or null
export function rayCylinder(o, d, base, r, y0, y1) {
  const ox = o.x - base.x, oz = o.z - base.z;
  const a = d.x * d.x + d.z * d.z; let t = null;
  if (a > 1e-9) {
    const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r; const disc = b * b - a * c;
    if (disc >= 0) {
      const tt = (-b - Math.sqrt(disc)) / a; const y = o.y + d.y * tt;
      if (tt >= 0 && y >= base.y + y0 && y <= base.y + y1) t = tt;
      else if (c < 0) { const yy = o.y; if (yy >= base.y + y0 && yy <= base.y + y1) t = 0; }
    }
  }
  return t;
}
