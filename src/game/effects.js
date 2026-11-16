// Visual-only effects: bullet tracers (single InstancedMesh pool), additive particles,
// smoke sprites, explosions, fire pools, mortar warning rings, 3D popups.
import * as THREE from 'three';
import { tex } from '../render/textures.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const FWD = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group(); this.root.name = 'effects'; scene.add(this.root);
    // tracers: every bullet in flight is a cheap 2-vertex line segment (one draw call, low fidelity on purpose)
    this.MAX_TRACERS = 4096;
    const tg = new THREE.BufferGeometry();
    this.tPos = new Float32Array(this.MAX_TRACERS * 6); this.tCol = new Float32Array(this.MAX_TRACERS * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setDrawRange(0, 0);
    this.tracerMesh = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.tracerMesh.frustumCulled = false; this.tracerCount = 0;
    this.root.add(this.tracerMesh);
    // additive particles
    this.MAXP = 1600;
    this.pMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex('soft'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.MAXP);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.pMesh.frustumCulled = false; this.pMesh.count = 0;
    this.pMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.root.add(this.pMesh);
    this.parts = [];
    // smoke sprites
    this.smokeTex = tex('smokepuff');
    this.smokes = []; // {sprite, life, max, vel, fadeIn, base, cloud}
    this.clouds = [];  // gameplay-linked smoke clouds (for thermal tint)
    this.rings = []; this.pools = []; this.popups = []; this.tethers = []; this.fireballs = [];
    // flash light (shared)
    this.flashLight = new THREE.PointLight(0xffb060, 0, 12, 2); this.root.add(this.flashLight); this.flashT = 0;
    this.boomLight = new THREE.PointLight(0xff8030, 0, 30, 2); this.root.add(this.boomLight); this.boomT = 0;
    this.thermal = false;
  }

  clear() {
    for (const s of this.smokes) this.root.remove(s.sprite);
    for (const r of this.rings) this.root.remove(r.mesh);
    for (const p of this.popups) this.root.remove(p.sprite);
    for (const t of this.tethers) this.root.remove(t.mesh);
    for (const f of this.fireballs) this.root.remove(f.mesh);
    for (const p of this.pools) this.root.remove(p.mesh);
    this.smokes = []; this.rings = []; this.popups = []; this.tethers = []; this.fireballs = []; this.pools = []; this.parts = []; this.clouds = [];
  }

  // ───── particles ─────
  spawn(pos, vel, color, size, life, opts = {}) {
    if (this.parts.length >= this.MAXP) this.parts.shift();
    this.parts.push({ p: pos.clone(), v: vel.clone(), c: new THREE.Color(color), size, grow: opts.grow || 0, life, max: life, g: opts.gravity ?? 0, drag: opts.drag ?? 0 });
  }
  sparks(pos, normal, n = 8, color = 0xffc070) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).add(normal ? normal.clone().multiplyScalar(2) : _p.set(0, 1, 0)).multiplyScalar(2 + Math.random() * 3);
      this.spawn(pos, v, color, 0.05 + Math.random() * 0.05, 0.2 + Math.random() * 0.25, { gravity: -12 });
    }
    this.spawn(pos, new THREE.Vector3(), 0xffe0a0, 0.35, 0.06);
  }
  dust(pos, normal, color = 0x9a8f80) {
    for (let i = 0; i < 4; i++) {
      const v = normal.clone().multiplyScalar(1 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.6, (Math.random() - 0.5)));
      this.puff(pos.clone().addScaledVector(normal, 0.05), v, color, 0.25, 0.6, 0.5);
    }
  }
  blood(pos) {
    for (let i = 0; i < 8; i++) this.spawn(pos, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), 0xa00808, 0.08, 0.35, { gravity: -9 });
  }
  muzzle(pos, dir, big = 1, color = 0xffc060) {
    this.spawn(pos, dir.clone().multiplyScalar(2), color, 0.22 * big, 0.05);
    this.spawn(pos.clone().addScaledVector(dir, 0.08 * big), dir.clone().multiplyScalar(4), 0xffe6a0, 0.14 * big, 0.04);
    for (let i = 0; i < 3; i++) this.spawn(pos, dir.clone().multiplyScalar(6 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)), color, 0.06 * big, 0.08);
    this.flashLight.position.copy(pos); this.flashLight.intensity = 6 * big; this.flashT = 0.05;
  }
  flame(pos, vel, reach = 1) {
    const c = Math.random() < 0.3 ? 0xff5010 : Math.random() < 0.5 ? 0xffa020 : 0xffd060;
    this.spawn(pos, vel, c, 0.25 + Math.random() * 0.15, (0.45 + Math.random() * 0.2) * Math.min(1.5, Math.max(1, reach)), { grow: 1.6 * Math.max(1, reach * 0.9), gravity: 2, drag: 1.2 });
  }

  // ───── smoke ─────
  puff(pos, vel, color, size, life, alpha = 0.6, cloud = null) {
    const mat = new THREE.SpriteMaterial({ map: this.smokeTex, color, transparent: true, opacity: 0, depthWrite: false, rotation: Math.random() * 6 });
    const s = new THREE.Sprite(mat); s.position.copy(pos); s.scale.setScalar(size);
    this.root.add(s);
    this.smokes.push({ sprite: s, life, max: life, vel: vel.clone(), alpha, base: size, cloud, color: new THREE.Color(color) });
  }
  smokeCloud(cloud) { // cloud: {pos, radius, time}
    this.clouds.push(cloud);
    const n = 46;
    for (let i = 0; i < n; i++) {
      const r = cloud.radius * Math.cbrt(Math.random()) * 0.8; const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1) * 0.5;
      const p = cloud.pos.clone().add(new THREE.Vector3(Math.sin(ph) * Math.cos(th) * r, Math.abs(Math.cos(ph)) * r * 0.35 + 0.6 + Math.random() * 2.2, Math.sin(ph) * Math.sin(th) * r));
      const g = 0.82 + Math.random() * 0.12;
      this.puff(p, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3), new THREE.Color(g, g, g * 1.02), 4.5 + Math.random() * 3.5, cloud.time + Math.random() * 0.8, 0.85, cloud);
    }
  }

  // ───── explosions ─────
  explosion(pos, radius = 4.5, opts = {}) {
    const fb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    fb.position.copy(pos); this.root.add(fb); this.fireballs.push({ mesh: fb, t: 0, max: 0.45, r: radius * 0.55 });
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.1, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * radius * 2.4);
      this.spawn(pos, v, [0xff6020, 0xffa040, 0xffe080][i % 3], 0.4 + Math.random() * 0.6, 0.35 + Math.random() * 0.35, { grow: 2, drag: 3 });
    }
    for (let i = 0; i < 18; i++) this.spawn(pos, new THREE.Vector3((Math.random() - 0.5) * 18, Math.random() * 14, (Math.random() - 0.5) * 18), 0xffd080, 0.06, 0.6 + Math.random() * 0.4, { gravity: -14 });
    const smokeCount = opts.small ? 6 : 12;
    for (let i = 0; i < smokeCount; i++) this.puff(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius * 0.6, Math.random() * 1.2, (Math.random() - 0.5) * radius * 0.6)), new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5), 0x3a3634, 2 + Math.random() * 2, 1.8 + Math.random(), 0.65);
    this.boomLight.position.copy(pos).add(_p.set(0, 1, 0)); this.boomLight.intensity = 60; this.boomT = 0.25;
  }
  flashBurst(pos) {
    this.spawn(pos, new THREE.Vector3(), 0xffffff, 6, 0.25);
    for (let i = 0; i < 20; i++) this.spawn(pos, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 8, (Math.random() - 0.5) * 10), 0xffffff, 0.08, 0.5, { gravity: -10 });
    this.boomLight.position.copy(pos); this.boomLight.intensity = 80; this.boomLight.color.set(0xffffff); this.boomT = 0.2;
  }

  mortarRing(pos, time, radius) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex('ring'), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    mesh.position.copy(pos).add(_p.set(0, 0.06, 0)); this.root.add(mesh);
    this.rings.push({ mesh, t: 0, max: time });
    return mesh;
  }

  firePool(pool) { // {pos, radius, time} — just flames, no ground disc
    const mesh = new THREE.Object3D(); this.root.add(mesh);
    this.pools.push({ mesh, pool, acc: 0 });
  }

  // jagged electric arc between two points
  lightning(a, b, time = 0.14) {
    const n = 6; let prev = a.clone(); const len = a.distanceTo(b);
    for (let i = 1; i <= n; i++) {
      const p = a.clone().lerp(b, i / n); if (i < n) p.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(len * 0.12));
      this.tether(prev, p, time, 0xc8a8ff, 0.016); prev = p;
    }
    this.spawn(b, new THREE.Vector3(), 0xd8c0ff, 0.5, 0.08);
  }
  tether(a, b, time = 0.35, color = 0x80e0ff, r = 0.008) {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
    mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.lookAt(b); mesh.scale.set(1, 1, len);
    this.root.add(mesh); this.tethers.push({ mesh, t: time });
  }

  popup(text, pos, opts = {}) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
    let fs = opts.size || 120; x.font = `900 ${fs}px Impact, "Arial Black", sans-serif`;
    while (x.measureText(text).width > 960 && fs > 20) { fs -= 4; x.font = `900 ${fs}px Impact, "Arial Black", sans-serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 18; x.strokeStyle = '#3a0000'; x.strokeText(text, 512, 128);
    const g = x.createLinearGradient(0, 128 - fs / 2, 0, 128 + fs / 2); g.addColorStop(0, opts.top || '#fff27a'); g.addColorStop(0.45, '#ffd21e'); g.addColorStop(1, opts.bottom || '#ff3a12');
    x.fillStyle = g; x.fillText(text, 512, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
    sprite.position.copy(pos); sprite.scale.set(3.2, 0.8, 1); sprite.renderOrder = 999;
    this.root.add(sprite); this.popups.push({ sprite, t: 0, max: opts.time || 1.6 });
    return sprite;
  }

  // ───── per-frame ─────
  update(dt, bullets) {
    const cam = this.camera;
    // tracers (all bullets)
    let n = 0; const P = this.tPos, C = this.tCol;
    for (const b of bullets) {
      if (n >= this.MAX_TRACERS) break;
      const len = Math.min(b.traveled + 0.3, b.thin ? 2.0 : 3.2);
      const h = b.vis || b.pos; const o = n * 6;
      P[o] = h.x; P[o + 1] = h.y; P[o + 2] = h.z;
      P[o + 3] = h.x - b.dir.x * len; P[o + 4] = h.y - b.dir.y * len; P[o + 5] = h.z - b.dir.z * len;
      _c.set(b.color || 0xffd080);
      C[o] = _c.r; C[o + 1] = _c.g; C[o + 2] = _c.b; C[o + 3] = _c.r * 0.25; C[o + 4] = _c.g * 0.2; C[o + 5] = _c.b * 0.15;
      n++;
    }
    const tg = this.tracerMesh.geometry; tg.setDrawRange(0, n * 2); this.tracerCount = n;
    if (n) { tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true; }
    // additive particles
    const pm = this.pMesh; let k = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.v.y += p.g * dt; if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
    }
    for (const p of this.parts) {
      if (k >= this.MAXP) break;
      const f = p.life / p.max; const size = p.size * (1 + p.grow * (1 - f));
      _s.set(size, size, size); _m.compose(p.p, cam.quaternion, _s); pm.setMatrixAt(k, _m);
      pm.setColorAt(k, _c.copy(p.c).multiplyScalar(Math.min(1, f * 1.6))); k++;
    }
    pm.count = k; pm.instanceMatrix.needsUpdate = true; if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    // smoke sprites
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.life -= dt;
      if (s.life <= 0) { this.root.remove(s.sprite); s.sprite.material.dispose(); this.smokes.splice(i, 1); continue; }
      s.sprite.position.addScaledVector(s.vel, dt);
      const age = s.max - s.life; const fin = Math.min(1, age / (s.cloud ? 0.6 : 0.15)); const fout = Math.min(1, s.life / (s.cloud ? 1.5 : s.max * 0.8));
      let a = s.alpha * fin * fout;
      if (s.cloud && this.thermal) { a *= 0.12; s.sprite.material.color.set(0x4060a0); } else s.sprite.material.color.copy(s.color);
      s.sprite.material.opacity = a;
      s.sprite.scale.setScalar(s.base * (1 + (s.cloud ? 0.15 : 0.8) * (age / s.max)));
    }
    this.clouds = this.clouds.filter((c) => c.t < c.time);
    // fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i]; f.t += dt; const u = f.t / f.max;
      if (u >= 1) { this.root.remove(f.mesh); f.mesh.geometry.dispose(); this.fireballs.splice(i, 1); continue; }
      f.mesh.scale.setScalar(f.r * (0.3 + u * 0.9)); f.mesh.material.opacity = 0.9 * (1 - u); f.mesh.material.color.setHSL(0.08 - u * 0.06, 1, 0.6 - u * 0.3);
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      if (r.t >= r.max) { this.root.remove(r.mesh); this.rings.splice(i, 1); continue; }
      r.mesh.material.opacity = 0.55 + 0.45 * Math.sin(r.t * 30); r.mesh.rotation.y += dt * 2;
    }
    // fire pools
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const fp = this.pools[i]; const pool = fp.pool;
      if (pool.t >= pool.time) { this.root.remove(fp.mesh); this.pools.splice(i, 1); continue; }
      fp.acc += dt * 60;
      while (fp.acc > 0.6) { fp.acc -= 0.6; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * pool.radius; this.flame(pool.pos.clone().add(_p.set(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new THREE.Vector3(0, 1.5 + Math.random() * 1.5, 0)); }
    }
    for (let i = this.tethers.length - 1; i >= 0; i--) { const t = this.tethers[i]; t.t -= dt; if (t.t <= 0) { this.root.remove(t.mesh); this.tethers.splice(i, 1); } else t.mesh.material.opacity = Math.random(); }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]; p.t += dt;
      if (p.t >= p.max) { this.root.remove(p.sprite); this.popups.splice(i, 1); continue; }
      const u = p.t / p.max; p.sprite.position.y += dt * 0.8;
      const pop = u < 0.12 ? u / 0.12 * 1.3 : 1.3 - Math.min(0.3, (u - 0.12) * 2);
      p.sprite.scale.set(3.2 * pop, 0.8 * pop, 1); p.sprite.material.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
      p.sprite.material.rotation = Math.sin(p.t * 18) * 0.08;
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashLight.intensity = 0; }
    if (this.boomT > 0) { this.boomT -= dt; this.boomLight.intensity = Math.max(0, this.boomT / 0.25) * 60; if (this.boomT <= 0) { this.boomLight.intensity = 0; this.boomLight.color.set(0xff8030); } }
  }
}
