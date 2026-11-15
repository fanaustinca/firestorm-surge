// Tactical bot AI: 10 Hz brain (perception, state choice, A* on the nav grid) + per-tick control.
// Behaviours: cover-seeking when hurt, smoke reaction, grenade/mortar dodging, loadout-aware ranges.
import * as THREE from 'three';
import { WEAPONS, bySlot, WEAPON_BY_ID } from '../data/weapons.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = V(), _b = V();

// ───── A* on the 1 m nav grid ─────
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() {
    const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop(); const n = k.length;
    if (n) { let i = 0; while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    return top;
  }
}

export function findPath(nav, from, to, maxIter = 6000) {
  const { N, half, cells } = nav;
  const ci = (x) => Math.max(0, Math.min(N - 1, Math.floor(x + half)));
  let si = ci(from.x), sj = ci(from.z), gi = ci(to.x), gj = ci(to.z);
  const free = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !cells[i * N + j];
  if (!free(gi, gj)) { const n = nearestFree(nav, gi, gj); if (!n) return null; [gi, gj] = n; }
  if (!free(si, sj)) { const n = nearestFree(nav, si, sj); if (n) [si, sj] = n; }
  const start = si * N + sj, goal = gi * N + gj;
  const g = new Float32Array(N * N).fill(Infinity); const came = new Int32Array(N * N).fill(-1);
  const h = (k) => { const i = (k / N) | 0, j = k % N; const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const heap = new MinHeap(); heap.push(h(start), start); g[start] = 0; const closed = new Uint8Array(N * N);
  let it = 0;
  while (heap.size && it++ < maxIter) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue; closed[cur] = 1;
    const i = (cur / N) | 0, j = cur % N;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!free(ni, nj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      const nk = ni * N + nj; const cost = g[cur] + (di && dj ? 1.414 : 1);
      if (cost < g[nk]) { g[nk] = cost; came[nk] = cur; heap.push(cost + h(nk), nk); }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const path = []; let k = goal;
  while (k !== -1 && k !== start) { path.push(new THREE.Vector3(((k / N) | 0) - half + 0.5, 0, (k % N) - half + 0.5)); k = came[k]; }
  path.reverse();
  // string-pull: drop points with clear straight lines (grid walk check)
  const out = []; let anchor = from.clone();
  for (let q = 0; q < path.length; q++) {
    if (q + 1 < path.length && gridClear(nav, anchor, path[q + 1])) continue;
    out.push(path[q]); anchor = path[q];
  }
  return out;
}
function nearestFree(nav, i, j) {
  for (let r = 1; r < 6; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < nav.N && nj < nav.N && !nav.cells[ni * nav.N + nj]) return [ni, nj]; }
  return null;
}
export function gridClear(nav, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z); const n = Math.ceil(d / 0.4);
  for (let s = 0; s <= n; s++) { const t = s / Math.max(1, n); const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; const i = Math.floor(x + nav.half), j = Math.floor(z + nav.half); if (i < 0 || j < 0 || i >= nav.N || j >= nav.N || nav.cells[i * nav.N + j]) return false; }
  return true;
}

// ───── bot loadouts ─────
const ARCHETYPES = [
  { name: 'Rifleman', l: { 1: 'assault_rifle', 2: 'pistol', 3: 'knife', 4: 'frag' }, range: [12, 32] },
  { name: 'Assault', l: { 1: 'ak47', 2: 'smg', 3: 'fists', 4: 'smoke_grenade' }, range: [10, 28] },
  { name: 'Marksman', l: { 1: 'dmr', 2: 'pistol', 3: 'knife', 4: 'smoke_grenade' }, range: [25, 55] },
  { name: 'Sniper', l: { 1: 'heavy_sniper', 2: 'revolver', 3: 'katana', 4: 'flashbang', 6: 'thermal_goggles' }, range: [30, 70] },
  { name: 'Breacher', l: { 1: 'burst_rifle', 2: 'tactical_shotgun', 3: 'sledgehammer', 4: 'frag', 6: 'blast_vest' }, range: [6, 20] },
  { name: 'Gunner', l: { 1: 'lmg', 2: 'burst_pistol', 3: 'bat', 4: 'molotov', 6: 'bandolier' }, range: [12, 35] },
  { name: 'Pyro', l: { 1: 'flamethrower', 2: 'sawed_off', 3: 'karambit', 4: 'molotov' }, range: [3, 9] },
  { name: 'Grenadier', l: { 1: 'grenade_launcher', 2: 'smg', 3: 'shurikens', 4: 'sticky_bomb' }, range: [10, 26] },
  { name: 'Artillery', l: { 1: 'mortar', 2: 'pistol', 3: 'scythe', 4: 'smoke_grenade' }, range: [20, 50] },
  { name: 'Rocketeer', l: { 1: 'rocket_launcher', 2: 'crossbow', 3: 'slippers', 4: 'frag', 6: 'spring_boots' }, range: [10, 35] },
  { name: 'Reaper', l: { 1: 'assault_rifle', 2: 'taser', 3: 'scythe', 4: 'flashbang' }, range: [3, 20], melee: true },
];
export function botLoadout(index, forceWeapon) {
  const a = ARCHETYPES[index % ARCHETYPES.length];
  const l = { 1: a.l[1], 2: a.l[2], 3: a.l[3], 4: a.l[4], 5: index % 3 === 0 ? 'medkit' : index % 3 === 1 ? 'armor_plate' : null, 6: a.l[6] || null };
  let range = a.range;
  if (forceWeapon) { const w = WEAPON_BY_ID[forceWeapon]; if (w && w.slot <= 6) { l[w.slot] = forceWeapon; if (w.slot === 1) range = w.range ? [Math.min(8, w.range * 0.3), Math.min(60, w.range * 0.7)] : range; } }
  return { loadout: l, archetype: a.name, range, melee: !!a.melee || (forceWeapon && WEAPON_BY_ID[forceWeapon]?.kind === 'melee') };
}
void WEAPONS; void bySlot;

const BOT_NAMES = ['Viper', 'Havoc', 'Rook', 'Nova', 'Talon', 'Blitz', 'Ghost', 'Mako', 'Echo', 'Jinx', 'Onyx', 'Raptor', 'Sable', 'Kilo', 'Torch', 'Mamba', 'Wraith', 'Bolt', 'Cinder', 'Frost'];
export const botName = (i) => BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ' ' + (1 + Math.floor(i / BOT_NAMES.length)) : '');

export class BotBrain {
  constructor(game, actor, info, skill = 0.6) {
    this.g = game; this.a = actor; this.info = info; this.skill = skill;
    this.state = 'roam'; this.target = null; this.lastSeen = null; this.lastSeenT = 0; this.seenFor = 0;
    this.path = null; this.pathGoal = null; this.pathT = 0; this.goal = null;
    this.think_t = Math.random() * 0.1; this.strafe = 1; this.strafeT = 0; this.stuckT = 0; this.lastPos = actor.pos.clone();
    this.aimErr = V(); this.wantSlot = 1; this.throwT = 0; this.throwing = 0; this.dodge = null; this.frozen = false;
    this.intent = { wish: V(), jumpPressed: false, fire: false, firePressed: false, alt: false, altPressed: false, reload: false };
    this.prevFire = false; this.coverT = 0; this.reactT = 0; this.hearT = 0;
  }

  canSee(t) {
    const a = this.a; if (!t.alive || a.fx.flash > 0.3) return false;
    const eye = a.eye(_a); const tc = t.chest(_b);
    const d = eye.distanceTo(tc); if (d > 75) return false;
    const fwd = a.aimDir(V()); const to = V().subVectors(tc, eye).normalize();
    if (fwd.dot(to) < -0.1 && d > 6) return false; // ~190° awareness cone
    if (!this.g.map.world.lineOfSight(eye, tc) && !this.g.map.world.lineOfSight(eye, t.headPos(V()))) return false;
    const thermal = a.thermal.on;
    if (!thermal && this.g.combat.inSmoke(eye, tc)) return false;
    return true;
  }

  think(dt) {
    const a = this.a, g = this.g;
    if (!a.alive || this.frozen) return;
    // ── dangers (live grenades, stickies, mortar rings, fire)
    this.dodge = null;
    for (const p of g.combat.projs) {
      if (!['frag', 'gl_shell', 'sticky', 'mortar_shell', 'molotov'].includes(p.kind) || p.owner === a || !g.hostile(p.owner, a)) continue;
      const pos = p.kind === 'mortar_shell' && p.target ? p.target : p.pos;
      const r = (p.def.splash?.radius || 4.5) + 1.5;
      if (pos.distanceTo(a.pos) < r && (p.kind !== 'mortar_shell' || p.t > (p.ringAt ?? 0) - 0.3)) { this.dodge = V().subVectors(a.pos, pos).setY(0).normalize(); if (this.dodge.lengthSq() < 0.1) this.dodge.set(1, 0, 0); break; }
    }
    for (const f of g.combat.fires) if (f.pos.distanceTo(a.pos) < f.radius + 1 && g.hostile(f.owner, a)) this.dodge = V().subVectors(a.pos, f.pos).setY(0).normalize();
    // ── thermal: bots wearing goggles switch them on when smoke is around
    if (a.hasWear('thermal_goggles')) { const wantOn = g.combat.clouds.length > 0 && a.thermal.battery > 1; if (wantOn !== a.thermal.on) a.thermal.on = wantOn; }
    // ── perception
    let best = null, bd = Infinity;
    for (const t of g.actors) {
      if (t === a || !t.alive || !g.hostile(a, t)) continue;
      const d = t.pos.distanceTo(a.pos);
      if (d < bd && this.canSee(t)) { best = t; bd = d; }
    }
    if (best) {
      if (best !== this.target) { this.reactT = 0.18 + (1 - this.skill) * 0.35; this.seenFor = 0; }
      this.target = best; this.lastSeen = best.pos.clone(); this.lastSeenT = g.time;
    } else if (this.target && g.time - this.lastSeenT > 4) this.target = null;
    // heard gunfire / got hurt → turn toward the attacker
    if (!best && a.lastAttacker && g.time - a.lastHurt < 1 && a.lastAttacker.alive) { this.lastSeen = a.lastAttacker.pos.clone(); this.lastSeenT = g.time; this.target = a.lastAttacker; }
    const visible = !!best;
    // ── state
    const hpFrac = (a.hp + a.armor) / a.maxHp;
    const tgt = this.target;
    const dist = tgt ? tgt.pos.distanceTo(a.pos) : Infinity;
    let state = 'roam';
    if (this.dodge) state = 'dodge';
    else if (tgt && hpFrac < 0.4 && visible && !this.info.melee && dist > 6) state = 'cover';
    else if (tgt && visible) state = 'engage';
    else if (tgt && this.lastSeen) state = g.combat.clouds.some((c) => c.pos.distanceTo(this.lastSeen) < c.radius) ? 'smoke' : 'hunt';
    this.state = state;
    // ── weapon choice (loadout-aware)
    const wsOf = (s) => a.weapons[s];
    let slot = 1; const pw = wsOf(1);
    const pdef = pw?.def;
    if (this.info.melee && dist < 7) slot = 3;
    else if (pdef && (pdef.kind === 'mortar' || pdef.id === 'rocket_launcher') && dist < (pdef.kind === 'mortar' ? 14 : 6)) slot = 2;
    else if (pdef && pdef.kind === 'flame' && dist > 14) slot = 2;
    else if (pw && pw.mag === 0 && pw.reserve === 0) slot = 2;
    else if (pw && pw.mag === 0 && dist < 10 && wsOf(2)?.mag > 0) slot = 2;
    if (dist < 2.4 && wsOf(3) && wsOf(3).def.kind === 'melee' && !(pdef?.kind === 'pellet')) slot = 3;
    if (state === 'cover' && wsOf(5) && wsOf(5).usableCd <= 0 && !visible) slot = 5;
    if (hpFrac < 0.55 && !visible && wsOf(5) && wsOf(5).def.heal && wsOf(5).usableCd <= 0) slot = 5;
    // grenade usage
    this.throwT -= dt;
    const tw = wsOf(4);
    if (tw && tw.count > 0 && this.throwT <= 0 && tgt && this.lastSeen && dist > 8 && dist < 26 && Math.random() < 0.12 + (state === 'smoke' ? 0.25 : 0)) {
      this.throwing = 1.2; this.throwT = 6 + Math.random() * 6;
    }
    if (this.throwing > 0) slot = 4;
    this.wantSlot = slot;
    // ── movement goal
    if (state === 'engage') {
      const [near, far] = this.info.range;
      if (dist > far) this.goal = tgt.pos.clone();
      else if (dist < near && !this.info.melee) this.goal = a.pos.clone().addScaledVector(V().subVectors(a.pos, tgt.pos).setY(0).normalize(), 4);
      else this.goal = null; // hold + strafe
      if (this.info.melee && slot === 3) this.goal = tgt.pos.clone();
    } else if (state === 'cover') {
      if (!this.coverPos || g.time > this.coverT) { this.coverPos = this.findCover(tgt); this.coverT = g.time + 3; }
      this.goal = this.coverPos;
    } else if (state === 'hunt') this.goal = this.lastSeen;
    else if (state === 'smoke') {
      // don't walk into the smoke: hold at the edge, flank around
      const c = g.combat.clouds.find((cl) => cl.pos.distanceTo(this.lastSeen) < cl.radius);
      if (c) { const away = V().subVectors(a.pos, c.pos).setY(0); const side = V(-away.z, 0, away.x).normalize(); this.goal = c.pos.clone().addScaledVector(away.normalize(), c.radius + 3).addScaledVector(side, 6 * this.strafe); }
    } else if (state === 'roam') {
      if (!this.goal || a.pos.distanceTo(this.goal) < 2 || Math.random() < 0.01) this.goal = this.pickRoam();
    }
    // ── path
    this.pathT -= dt;
    if (this.goal && (this.pathT <= 0 || !this.path || !this.pathGoal || this.pathGoal.distanceTo(this.goal) > 3)) {
      this.path = findPath(g.map.nav, a.pos, this.goal); this.pathGoal = this.goal.clone(); this.pathT = 1.5 + Math.random();
    }
    if (!this.goal) this.path = null;
    // aim error (re-rolled per think)
    const err = (1 - this.skill) * 0.9 + 0.08;
    this.aimErr.set((Math.random() - 0.5) * err, (Math.random() - 0.5) * err * 0.6, (Math.random() - 0.5) * err);
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.6 + Math.random() * 1.4; }
  }

  findCover(tgt) {
    const g = this.g, a = this.a, nav = g.map.nav; let best = null, bd = Infinity;
    const teye = tgt.eye(V());
    for (let k = 0; k < 40; k++) {
      const ang = Math.random() * Math.PI * 2, r = 3 + Math.random() * 9;
      const x = a.pos.x + Math.cos(ang) * r, z = a.pos.z + Math.sin(ang) * r;
      const i = Math.floor(x + nav.half), j = Math.floor(z + nav.half);
      if (i < 0 || j < 0 || i >= nav.N || j >= nav.N || nav.cells[i * nav.N + j]) continue;
      const p = V(x, 1.4, z);
      if (g.map.world.lineOfSight(teye, p)) continue;
      const d = r + V(x, 0, z).distanceTo(tgt.pos) * -0.15;
      if (d < bd) { bd = d; best = V(x, 0, z); }
    }
    return best || this.pickRoam();
  }
  pickRoam() {
    const sp = this.g.map.spawns.ffa; const p = sp[(Math.random() * sp.length) | 0];
    return p.clone().add(V((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
  }

  // per-tick control → intent
  control(dt) {
    const a = this.a, g = this.g, it = this.intent;
    it.jumpPressed = false; it.firePressed = false; it.altPressed = false; it.reload = false; it.alt = false;
    it.wish.set(0, 0, 0);
    if (!a.alive || this.frozen) { it.fire = false; return it; }
    this.think_t -= dt; if (this.think_t <= 0) { this.think_t = 0.1; this.think(0.1); }
    if (this.wantSlot !== a.slot && a.weapons[this.wantSlot]) a.switchSlot(this.wantSlot);
    // movement
    const wish = V();
    if (this.dodge) wish.copy(this.dodge);
    else if (this.path && this.path.length) {
      let wp = this.path[0];
      if (Math.hypot(wp.x - a.pos.x, wp.z - a.pos.z) < 0.7) { this.path.shift(); wp = this.path[0]; }
      if (wp) wish.set(wp.x - a.pos.x, 0, wp.z - a.pos.z).normalize();
    }
    const tgt = this.target; const visible = !!tgt && g.time - this.lastSeenT < 0.25;
    if (this.state === 'engage' && tgt) {
      const toT = V().subVectors(tgt.pos, a.pos).setY(0).normalize(); const side = V(-toT.z, 0, toT.x);
      wish.addScaledVector(side, this.strafe * (this.goal ? 0.4 : 0.9));
      if (wish.lengthSq() > 0) wish.normalize();
    }
    // stuck detection
    const moved = a.pos.distanceTo(this.lastPos); this.lastPos.copy(a.pos);
    if (wish.lengthSq() > 0.1 && moved < 0.02 && a.onGround) { this.stuckT += dt; if (this.stuckT > 0.6) { it.jumpPressed = true; this.pathT = 0; this.strafe *= -1; this.stuckT = 0; wish.add(V(-wish.z, 0, wish.x).multiplyScalar(this.strafe)).normalize(); } } else this.stuckT = 0;
    if (this.dodge && a.onGround && Math.random() < 0.03) it.jumpPressed = true;
    it.wish.copy(wish);
    // aim
    let aimPt = null;
    if (tgt && (this.state === 'engage' || this.throwing > 0)) {
      const ws = a.ws;
      aimPt = (ws?.def.kind === 'mortar') ? tgt.pos.clone() : (Math.random() < this.skill * 0.35 ? tgt.headPos(V()) : tgt.chest(V()).add(V(0, -0.15, 0)));
      // lead moving targets for slow projectiles
      if (ws && (ws.def.kind === 'projectile') && ws.def.vel) aimPt.addScaledVector(tgt.vel, a.pos.distanceTo(tgt.pos) / ws.def.vel);
      if (ws?.def.kind === 'throwable' || ws?.def.proj === 'gl_shell') aimPt.y += a.pos.distanceTo(tgt.pos) * 0.12;
      aimPt.addScaledVector(this.aimErr, Math.min(2, 0.4 + a.pos.distanceTo(tgt.pos) * 0.03));
    } else if (this.lastSeen && (this.state === 'hunt' || this.state === 'smoke')) aimPt = this.lastSeen.clone().setY(this.lastSeen.y + 1.3);
    else if (wish.lengthSq() > 0) aimPt = a.eye(V()).addScaledVector(wish, 10);
    if (aimPt) {
      const d = V().subVectors(aimPt, a.eye(V()));
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const turn = (4 + this.skill * 8) * dt;
      let dy = yaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      a.yaw += THREE.MathUtils.clamp(dy, -turn, turn); a.pitch += THREE.MathUtils.clamp(pitch - a.pitch, -turn, turn);
    }
    // firing
    let fire = false;
    const ws = a.ws;
    if (this.reactT > 0) this.reactT -= dt;
    if (ws && tgt && this.state === 'engage' && visible && this.reactT <= 0 && this.throwing <= 0) {
      const d = a.pos.distanceTo(tgt.pos);
      const aimDot = a.aimDir(V()).dot(V().subVectors(tgt.chest(V()), a.eye(V())).normalize());
      const inRange = ws.def.kind === 'melee' ? d < ws.def.reach + 0.6 : ws.def.range ? d < ws.def.range * 1.05 : true;
      if (aimDot > 0.94 && inRange && ws.def.kind !== 'usable' && ws.def.kind !== 'throwable') fire = true;
      if (ws.def.scope && d > 20) it.alt = true;
    }
    if (this.state === 'smoke' && ws && ws.def.kind === 'flame' && this.lastSeen && a.pos.distanceTo(this.lastSeen) < 14) fire = true;
    if (this.state === 'smoke' && ws && ws.def.mode === 'auto' && Math.random() < 0.05) fire = true; // suppress into smoke
    if (a.slot === 5 && ws && ws.useT < 0 && ws.usableCd <= 0) { fire = !this.prevFire; }
    // grenade: hold briefly then release
    if (this.throwing > 0) {
      this.throwing -= dt;
      if (a.slot === 4 && a.drawT <= 0) fire = this.throwing > 0.55;
      if (this.throwing <= 0) this.throwing = 0;
    }
    if (ws && ws.def.kind !== 'melee' && ws.mag === 0 && ws.reloading <= 0 && !fire) it.reload = true;
    // semi-auto cadence
    const semi = ws && ws.def.mode !== 'auto' && ws.def.kind !== 'throwable';
    if (semi && fire && this.prevFire) { fire = false; }
    it.firePressed = fire && !this.prevFire; it.fire = fire;
    this.prevFire = fire;
    // scythe ability when charging in
    if (ws?.def.ability && tgt && a.pos.distanceTo(tgt.pos) > 5 && a.pos.distanceTo(tgt.pos) < 16 && a.fx.scytheCd <= 0) it.altPressed = true;
    return it;
  }
}
