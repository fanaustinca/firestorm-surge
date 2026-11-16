// Rolling terrain heightfield (1 m grid) with collision support + distant mountain ranges.
// Height is smooth value-noise, faded to exactly 0 around every ground-standing collider and spawn
// so buildings, props and stairs stay planted; open battle space gets mounds, dips and berms.
import * as THREE from 'three';

function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function valueNoise(seed) {
  const r = rng(seed); const P = 64; const g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = r() * 2 - 1;
  const at = (i, j) => g[((i % P) + P) % P * P + (((j % P) + P) % P)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = sm(x - xi), fz = sm(z - zi); const a = at(xi, zi), b = at(xi + 1, zi), c = at(xi, zi + 1), d = at(xi + 1, zi + 1); return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; };
}

export class Terrain {
  constructor(world, spawns, { amp = 1.0, scale = 9, seed = 1, clear = 2.0, fade = 5.5 } = {}) {
    const half = world.bounds; const N = Math.round(half * 2) + 1; this.N = N; this.half = half;
    const blocked = new Uint8Array(N * N);
    const mark = (x0, x1, z0, z1) => { for (let i = Math.max(0, Math.floor(x0 + half)); i <= Math.min(N - 1, Math.ceil(x1 + half)); i++) for (let j = Math.max(0, Math.floor(z0 + half)); j <= Math.min(N - 1, Math.ceil(z1 + half)); j++) blocked[i * N + j] = 1; };
    for (const b of world.boxes) if (!b.noCollide && b.min[1] < 0.8) mark(b.min[0], b.max[0], b.min[2], b.max[2]);
    for (const p of spawns) mark(p.x - 1, p.x + 1, p.z - 1, p.z + 1);
    // distance (in cells) to the nearest blocked vertex — BFS
    const dist = new Float32Array(N * N).fill(99); const q = [];
    for (let k = 0; k < N * N; k++) if (blocked[k]) { dist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) { const k = q[h]; const i = (k / N) | 0, j = k % N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const kk = ii * N + jj; if (dist[kk] > dist[k] + 1) { dist[kk] = dist[k] + 1; q.push(kk); } } }
    const n1 = valueNoise(seed), n2 = valueNoise(seed + 17);
    this.h = new Float32Array(N * N); let maxH = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = i - half, z = j - half; const k = i * N + j;
      const edge = Math.min(half - Math.abs(x), half - Math.abs(z));                  // flatten at the perimeter too
      const d = Math.min(dist[k], edge);
      const m = THREE.MathUtils.smoothstep(d, clear, clear + fade);
      const n = (n1(x / scale, z / scale) * 0.75 + n2(x / (scale * 0.45), z / (scale * 0.45)) * 0.25 + 0.35);
      const hh = Math.max(0, n) * amp * m; this.h[k] = hh; maxH = Math.max(maxH, hh);
    }
    this.maxH = maxH;
  }
  at(x, z) {
    const N = this.N, half = this.half; const fx = Math.min(N - 1.001, Math.max(0, x + half)), fz = Math.min(N - 1.001, Math.max(0, z + half));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; const h = this.h;
    const a = h[i * N + j], b = h[(i + 1) * N + j], c = h[i * N + j + 1], d = h[(i + 1) * N + j + 1];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  normal(x, z, out = new THREE.Vector3()) { const e = 0.35; return out.set(this.at(x - e, z) - this.at(x + e, z), 2 * e, this.at(x, z - e) - this.at(x, z + e)).normalize(); }
  // displace a rotated (XZ) plane geometry in place
  displace(geo) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, this.at(p.getX(i), p.getZ(i))); p.needsUpdate = true; geo.computeVertexNormals(); }
}

// Ring of low-poly mountains outside the arena. style: { color, snow, height, count, inner, outer, seed }
export function mountainRing(group, { color = 0x8a7a6a, snow = null, height = 26, count = 22, inner = 48, outer = 80, seed = 3, rock = 0.85, bounds = 30 } = {}) {
  const r = rng(seed); const geos = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + r() * 0.25; const d = inner + r() * (outer - inner); const h = height * (0.55 + r() * 0.7); const w = 14 + r() * 18;
    // keep the whole jittered base outside the square arena (corners reach bounds·√2 on the diagonals)
    const edge = bounds / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const dd = Math.max(d, edge + 5 + w * 1.25);
    const g = new THREE.ConeGeometry(w, h, 7 + ((r() * 4) | 0), 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < h / 2 - 0.01) { const jitter = 1 + (r() - 0.5) * 0.35; p.setX(i, p.getX(i) * jitter); p.setZ(i, p.getZ(i) * jitter); p.setY(i, y + (r() - 0.5) * h * 0.08); } }
    g.translate(Math.cos(a) * dd, h / 2 - 2, Math.sin(a) * dd);
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const c = new Float32Array(ng.attributes.position.count * 3); const base = new THREE.Color(color), white = new THREE.Color(snow ?? color), tmp = new THREE.Color();
    for (let i = 0; i < ng.attributes.position.count; i++) {
      const y = ng.attributes.position.getY(i) + 2; const t = y / h;
      const capped = snow != null && t > 0.58 + r() * 0.08;
      tmp.copy(capped ? white : base).multiplyScalar(capped ? 1 : 0.8 + r() * 0.3); c.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    ng.setAttribute('color', new THREE.BufferAttribute(c, 3)); geos.push(ng);
  }
  const merged = mergeAll(geos);
  const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rock, flatShading: true }));
  m.receiveShadow = false; m.castShadow = false; group.add(m);
  return m;
}
function mergeAll(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}
