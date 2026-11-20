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

// Multi-level A*: nodes are walkable surfaces in 1 m columns (see maps.buildNav).
// Returns waypoints [{x,y,z, ladder?}] where `ladder` marks a climb to reach that point.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function columnClear(nav, c, y0, y1) { for (const [a, b] of nav.solids[c]) if (a < y1 && b > y0) return false; return true; }
export function nodeAt(nav, p, tol = 2) {
  const { N, half } = nav; const i = Math.floor(p.x + half), j = Math.floor(p.z + half);
  let best = null, bd = Infinity;
  for (let r = 0; r <= tol; r++) {
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      for (const n of nav.cellNodes[ii * N + jj]) { const h = nav.nodeH[n]; const dh = h > p.y + 0.7 ? (h - p.y) * 3 : p.y - h; const sc = dh + r * 1.2; if (sc < bd) { bd = sc; best = n; } }
    }
    if (best != null && bd < r + 1.5) break;
  }
  return best;
}
function neighbors(nav, n, out) {
  out.length = 0; const { N } = nav; const c = nav.nodeCell[n]; const i = (c / N) | 0, j = c % N; const h = nav.nodeH[n];
  for (const [di, dj] of DIRS) {
    const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
    const c2 = ii * N + jj; const list = nav.cellNodes[c2]; if (!list.length) continue;
    const diag = di && dj;
    let walk = -1, drop = -1, dropH = -Infinity;
    for (const m of list) { const h2 = nav.nodeH[m]; if (Math.abs(h2 - h) <= 0.6) walk = m; else if (h2 < h - 0.6 && h - h2 < 9.5 && h2 > dropH && columnClear(nav, c2, h2 + 0.5, h + 1.7)) { drop = m; dropH = h2; } }
    const tgt = walk >= 0 ? walk : drop; if (tgt < 0) continue;
    if (diag) { // no corner cutting: both orthogonal cells must hold the same level
      const ok = (cc) => nav.cellNodes[cc].some((m) => Math.abs(nav.nodeH[m] - h) <= 0.6 || Math.abs(nav.nodeH[m] - nav.nodeH[tgt]) <= 0.6);
      if (!ok(ii * N + j) || !ok(i * N + jj)) continue;
    }
    out.push({ to: tgt, cost: (diag ? 1.414 : 1) + (walk >= 0 ? Math.abs(nav.nodeH[tgt] - h) * 0.5 : (h - nav.nodeH[tgt]) * 0.35 + 0.8) });
  }
  const L = nav.links.get(n); if (L) for (const l of L) out.push(l);
  return out;
}
const _nb = [];
export function findPath(nav, from, to, maxIter = 9000) {
  const s = nodeAt(nav, from), goal = nodeAt(nav, to, 4);
  if (s == null || goal == null) return null;
  const M = nav.nodeH.length; const { N, half } = nav;
  const g = new Float32Array(M).fill(Infinity); const came = new Int32Array(M).fill(-1); const via = new Map(); const closed = new Uint8Array(M);
  const gc = nav.nodeCell[goal]; const gi = (gc / N) | 0, gj = gc % N; const gh = nav.nodeH[goal];
  const h = (n) => { const c = nav.nodeCell[n]; const dx = Math.abs(((c / N) | 0) - gi), dz = Math.abs((c % N) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs(nav.nodeH[n] - gh) * 0.6; };
  const heap = new MinHeap(); heap.push(h(s), s); g[s] = 0; let it = 0;
  while (heap.size && it++ < maxIter) {
    const cur = heap.pop(); if (cur === goal) break; if (closed[cur]) continue; closed[cur] = 1;
    for (const e of neighbors(nav, cur, _nb)) {
      const cost = g[cur] + e.cost;
      if (cost < g[e.to]) { g[e.to] = cost; came[e.to] = cur; if (e.ladder) via.set(e.to, e.ladder); else via.delete(e.to); heap.push(cost + h(e.to), e.to); }
    }
  }
  if (came[goal] === -1 && goal !== s) return null;
  const nodes = []; let k = goal; while (k !== -1 && k !== s) { nodes.push(k); k = came[k]; } nodes.reverse();
  const P = (n) => { const c = nav.nodeCell[n]; return { x: ((c / N) | 0) - half + 0.5, y: nav.nodeH[n], z: (c % N) - half + 0.5, n, ladder: via.get(n) || null }; };
  // string-pull along same-level straight runs (never across climbs or level changes)
  const out = []; let anchor = s;
  for (let q = 0; q < nodes.length; q++) {
    const nx = nodes[q + 1];
    if (nx != null && !via.get(nodes[q]) && !via.get(nx) && Math.abs(nav.nodeH[nx] - nav.nodeH[anchor]) < 0.3 && Math.abs(nav.nodeH[nodes[q]] - nav.nodeH[anchor]) < 0.3 && navClear(nav, anchor, nx)) continue;
    out.push(P(nodes[q])); anchor = nodes[q];
  }
  return out;
}
export function navClear(nav, a, b) {
  const { N, half } = nav; const ca = nav.nodeCell[a], cb = nav.nodeCell[b];
  const ax = ((ca / N) | 0) - half + 0.5, az = (ca % N) - half + 0.5, bx = ((cb / N) | 0) - half + 0.5, bz = (cb % N) - half + 0.5;
  let hh = nav.nodeH[a]; const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 0.35);
  for (let s = 1; s <= n; s++) {
    const t = s / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const i = Math.floor(x + half), j = Math.floor(z + half); if (i < 0 || j < 0 || i >= N || j >= N) return false;
    let found = false; for (const m of nav.cellNodes[i * N + j]) if (Math.abs(nav.nodeH[m] - hh) <= 0.55) { hh = nav.nodeH[m]; found = true; break; }
    if (!found) return false;
  }
  return Math.abs(hh - nav.nodeH[b]) <= 0.55;
}
// roam targets: elevated surfaces (floors, roofs, bridges, decks) and tunnel floors that are actually
// reachable on foot / by ladder from the spawns (prop tops and sealed roofs are excluded).
export function poisOf(nav, starts = []) {
  const seen = new Uint8Array(nav.nodeH.length); const q = [];
  for (const p of starts) { const n = nodeAt(nav, p); if (n != null && !seen[n]) { seen[n] = 1; q.push(n); } }
  const nb = [];
  for (let h = 0; h < q.length; h++) for (const e of neighbors(nav, q[h], nb)) if (!seen[e.to]) { seen[e.to] = 1; q.push(e.to); }
  const any = q.length > 0; const high = [], tunnel = [];
  for (let n = 0; n < nav.nodeH.length; n++) { if (any && !seen[n]) continue; const h = nav.nodeH[n]; if (h >= 2.5) high.push(n); else if (h < -1.5) tunnel.push(n); }
  return { high, tunnel };
}
export function randomNode(nav, rnd = Math.random) { const n = (rnd() * nav.nodeH.length) | 0; const c = nav.nodeCell[n]; return new THREE.Vector3(((c / nav.N) | 0) - nav.half + 0.5, nav.nodeH[n], (c % nav.N) - nav.half + 0.5); }

// ───── bot loadouts ─────
const ARCHETYPES = [
  { name: 'Rifleman', l: { 1: 'assault_rifle', 2: 'pistol', 3: 'knife', 4: 'frag' }, range: [12, 32] },
  { name: 'Assault', l: { 1: 'ak47', 2: 'smg', 3: 'fists', 4: 'smoke_grenade' }, range: [10, 28] },
  { name: 'Marksman', l: { 1: 'dmr', 2: 'pistol', 3: 'knife', 4: 'smoke_grenade' }, range: [25, 55] },
  { name: 'Sniper', l: { 1: 'heavy_sniper', 2: 'revolver', 3: 'katana', 4: 'flashbang', 6: 'thermal_goggles' }, range: [30, 70] },
  { name: 'Breacher', l: { 1: 'burst_rifle', 2: 'tactical_shotgun', 3: 'sledgehammer', 4: 'land_mine', 6: 'blast_vest' }, range: [6, 20] },
  { name: 'Gunner', l: { 1: 'lmg', 2: 'burst_pistol', 3: 'bat', 4: 'molotov', 6: 'bandolier' }, range: [12, 35] },
  { name: 'Pyro', l: { 1: 'flamethrower', 2: 'sawed_off', 3: 'karambit', 4: 'molotov' }, range: [3, 9] },
  { name: 'Grenadier', l: { 1: 'grenade_launcher', 2: 'smg', 3: 'shurikens', 4: 'sticky_bomb' }, range: [10, 26] },
  { name: 'Artillery', l: { 1: 'mortar', 2: 'pistol', 3: 'scythe', 4: 'land_mine' }, range: [20, 50] },
  { name: 'Rocketeer', l: { 1: 'rocket_launcher', 2: 'crossbow', 3: 'slippers', 4: 'frag', 6: 'spring_boots' }, range: [10, 35] },
  { name: 'Reaper', l: { 1: 'assault_rifle', 2: 'taser', 3: 'scythe', 4: 'flashbang' }, range: [3, 20], melee: true },
  { name: 'Lineman', l: { 1: 'volt_rail', 2: 'pistol', 3: 'knife', 4: 'smoke_grenade' }, range: [20, 55] },
  { name: 'Stormcaller', l: { 1: 'arc_caster', 2: 'burst_pistol', 3: 'bat', 4: 'flashbang' }, range: [8, 24] },
  { name: 'Reaver', l: { 1: 'ricochet_disc', 2: 'pocket_rocket', 3: 'sledgehammer', 4: 'frag' }, range: [8, 26] },
  { name: 'Cryomancer', l: { 1: 'cryo_sprayer', 2: 'sawed_off', 3: 'karambit', 4: 'smoke_grenade' }, range: [3, 10] },
  { name: 'Whaler', l: { 1: 'harpoon_gun', 2: 'smg', 3: 'katana', 4: 'flashbang' }, range: [8, 30] },
  { name: 'Hookshot', l: { 1: 'ak47', 2: 'sawed_off', 3: 'grapple_hook', 4: 'frag', 6: 'spring_boots' }, range: [5, 20] },
  { name: 'Engineer', l: { 1: 'assault_rifle', 2: 'burst_pistol', 3: 'bat', 4: 'land_mine', 5: 'sentry_turret' }, range: [12, 30] },
];
export function botLoadout(index, forceWeapon) {
  const a = ARCHETYPES[index % ARCHETYPES.length];
  const l = { 1: a.l[1], 2: a.l[2], 3: a.l[3], 4: a.l[4], 5: a.l[5] || (index % 3 === 0 ? 'medkit' : index % 3 === 1 ? 'armor_plate' : null), 6: a.l[6] || null };
  let range = a.range;
  if (forceWeapon) { const w = WEAPON_BY_ID[forceWeapon]; if (w && w.slot <= 6) { l[w.slot] = forceWeapon; if (w.slot === 1) range = w.range ? [Math.min(8, w.range * 0.3), Math.min(60, w.range * 0.7)] : range; } }
  return { loadout: l, archetype: a.name, range, melee: !!a.melee || (forceWeapon && WEAPON_BY_ID[forceWeapon]?.kind === 'melee') };
}
void WEAPONS; void bySlot;

const BOT_NAMES = ['Viper', 'Havoc', 'Rook', 'Nova', 'Talon', 'Blitz', 'Ghost', 'Mako', 'Echo', 'Jinx', 'Onyx', 'Raptor', 'Sable', 'Kilo', 'Torch', 'Mamba', 'Wraith', 'Bolt', 'Cinder', 'Frost'];
export const botName = (i) => BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ' ' + (1 + Math.floor(i / BOT_NAMES.length)) : '');

// ───── skill tiers ─────
// casual:  slow + sloppy, never switches weapons or throws, never jumps, plants its feet to shoot.
// normal:  inaccurate, stands still to snipe, otherwise walks / hops while shooting (no zig-zag dodging).
// veteran: 0–1 per match. Zig-zags + jumps while firing, swaps weapons, moves while scoped. Good, not an aimbot.
export const TIERS = {
  // hold: chance a strafe window is spent standing still; linger: seconds spent holding an angle at each roam spot
  casual: { skill: 0.12, react: [0.95, 0.6], err: 2.0, settleMin: 0.75, settleRate: 0.25, turn: 1.9, head: 0, lag: 0.32, swap: false, throws: false, jump: false, dodge: 0.25, strafe: 0, flip: [9, 9], hold: 1, linger: [5, 7] },
  normal: { skill: 0.35, react: [0.6, 0.4], err: 1.45, settleMin: 0.55, settleRate: 0.35, turn: 2.8, head: 0.04, lag: 0.2, swap: true, throws: true, jump: true, dodge: 0.55, strafe: 0.4, flip: [1.2, 1.4], hop: [6, 6], hold: 0.6, linger: [3, 5] },
  veteran: { skill: 0.65, react: [0.36, 0.22], err: 1.0, settleMin: 0.38, settleRate: 0.45, turn: 4.0, head: 0.12, lag: 0.1, swap: true, throws: true, jump: true, dodge: 0.85, strafe: 1, flip: [0.28, 0.4], hop: [1.8, 2], zigzag: true, scopeMove: true, hold: 0.15, linger: [1.5, 2.5] },
};
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Deterministic from the match id so every peer agrees: about half of matches get exactly one veteran,
// the remaining bots are split between casual and normal.
export function botTier(seed, slot, firstBot, size) {
  const h = hashStr(String(seed)); const bots = size - firstBot; if (bots <= 0) return 'normal';
  if (h % 100 < 55 && slot === firstBot + ((h >>> 8) % bots)) return 'veteran';
  return hashStr(seed + ':' + slot) % 100 < 50 ? 'casual' : 'normal';
}

// Deliberately beatable: ~100° view cone, real occlusion (walls, smoke, flash blindness),
// slow reactions, sloppy aim that improves the longer a target stays in view.
const VIEW_COS = Math.cos(THREE.MathUtils.degToRad(52));
export class BotBrain {
  constructor(game, actor, info, tier = 'normal') {
    if (typeof tier === 'number') tier = tier < 0.3 ? 'casual' : tier < 0.6 ? 'normal' : 'veteran';
    this.tier = TIERS[tier] ? tier : 'normal'; this.T = TIERS[this.tier]; actor.tier = this.tier;
    this.g = game; this.a = actor; this.info = info; this.skill = this.T.skill; this.aimErrT = V(); this.hopT = 0.6 + Math.random() * 1.6;
    this.state = 'roam'; this.target = null; this.lastSeen = null; this.lastSeenT = -99; this.seenFor = 0; this.visible = false;
    this.path = null; this.pathGoal = null; this.pathT = 0; this.goal = null;
    this.think_t = Math.random() * 0.15; this.strafe = 1; this.strafeT = 0; this.stuckT = 0; this.lastPos = actor.pos.clone();
    this.aimErr = V(); this.wantSlot = 1; this.throwT = 3 + Math.random() * 6; this.throwing = 0; this.dodge = null; this.frozen = false;
    this.intent = { wish: V(), climb: null, jumpPressed: false, fire: false, firePressed: false, alt: false, altPressed: false, reload: false };
    this.prevFire = false; this.coverT = 0; this.reactT = 0; this.mineT = 8 + Math.random() * 10; this.switchT = 0; this.sprayT = 0;
  }

  canSee(t) {
    const a = this.a; if (!t.alive || a.fx.flash > 0) return false;           // flashbanged = blind
    const eye = a.eye(_a); const tc = t.chest(_b);
    const d = eye.distanceTo(tc); if (d > 60) return false;
    const to = V().subVectors(tc, eye).divideScalar(d);
    const fwd = a.aimDir(V());
    // view cone (plus a tiny "hear footsteps" bubble right behind them)
    if (fwd.dot(to) < VIEW_COS && !(d < 2.2 && Math.hypot(t.vel.x, t.vel.z) > 3)) return false;
    const w = this.g.map.world;
    if (!w.lineOfSight(eye, tc) && !w.lineOfSight(eye, t.headPos(V()))) return false;
    if (!a.thermal.on && this.g.combat.inSmoke(eye, tc)) return false;
    // far + crouched in shadows of distance: needs a moment to notice
    return true;
  }

  think(dt) {
    const a = this.a, g = this.g;
    if (!a.alive || this.frozen) return;
    // ── dangers: only grenades/fire the bot can actually see
    this.dodge = null;
    if (a.fx.flash <= 0) {
      for (const p of g.combat.projs) {
        if (!['frag', 'gl_shell', 'sticky', 'molotov'].includes(p.kind) || p.owner === a || !g.hostile(p.owner, a)) continue;
        const r = (p.def.splash?.radius || 4.5) + 1;
        if (p.pos.distanceTo(a.pos) < r && g.map.world.lineOfSight(a.eye(_a), p.pos) && Math.random() < this.T.dodge) { this.dodge = V().subVectors(a.pos, p.pos).setY(0).normalize(); if (this.dodge.lengthSq() < 0.1) this.dodge.set(1, 0, 0); break; }
      }
      for (const f of g.combat.fires) if (f.pos.distanceTo(a.pos) < f.radius + 0.5 && g.hostile(f.owner, a)) this.dodge = V().subVectors(a.pos, f.pos).setY(0).normalize();
    }
    if (a.hasWear('thermal_goggles')) { const wantOn = g.combat.clouds.length > 0 && a.thermal.battery > 1; if (wantOn !== a.thermal.on) a.thermal.on = wantOn; }
    // ── perception
    let best = null, bd = Infinity;
    for (const t of g.actors) {
      if (t === a || !t.alive || !g.hostile(a, t) || t.isTarget) continue;
      const d = t.pos.distanceTo(a.pos);
      if (d < bd && this.canSee(t)) { best = t; bd = d; }
    }
    if (best) {
      if (best !== this.target || !this.visible) { this.reactT = this.T.react[0] + Math.random() * this.T.react[1]; this.seenFor = 0; }
      this.seenFor += dt; this.target = best; this.lastSeen = best.pos.clone(); this.lastSeenT = g.time;
    } else if (this.target && g.time - this.lastSeenT > 5) this.target = null;
    this.visible = !!best;
    // got shot by someone unseen → look toward where it came from (no wallhack: just investigate)
    if (!best && a.lastAttacker && g.time - a.lastHurt < 0.2 && a.lastAttacker.alive && !this.lastSeen) { this.lastSeen = a.lastAttacker.pos.clone().add(V((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)); this.lastSeenT = g.time; this.target = a.lastAttacker; }
    const visible = this.visible;
    const hpFrac = (a.hp + a.armor) / a.maxHp;
    const tgt = this.target; const dist = tgt ? tgt.pos.distanceTo(a.pos) : Infinity;
    let state = 'roam';
    if (a.fx.flash > 0) state = 'blind';
    else if (this.dodge) state = 'dodge';
    else if (tgt && hpFrac < 0.35 && visible && !this.info.melee && dist > 6) state = 'cover';
    else if (tgt && visible) state = 'engage';
    else if (tgt && this.lastSeen) state = g.combat.clouds.some((c) => c.pos.distanceTo(this.lastSeen) < c.radius) ? 'smoke' : 'hunt';
    this.state = state;
    // ── weapon choice: bots actively swap between primary / secondary / melee / throwables / usables
    const wsOf = (s) => a.weapons[s];
    const pw = wsOf(1), pdef = pw?.def, sw = wsOf(2);
    let slot = this.wantSlot || 1;
    const primaryOk = pw && (pw.mag > 0 || pw.reserve > 0);
    const closeBad = pdef && ((pdef.kind === 'mortar' && dist < 14) || ((pdef.base || pdef.id) === 'rocket_launcher' && dist < 5) || ((pdef.base || pdef.id) === 'heavy_sniper' && dist < 8));
    if (!tgt) slot = primaryOk ? 1 : 2;
    else if (this.info.melee && dist < 7 && wsOf(3)?.def.kind === 'melee') slot = 3;
    else if (closeBad && sw) slot = 2;
    else if (pdef?.kind === 'flame' && dist > pdef.range + 4 && sw) slot = 2;
    else if (!primaryOk) slot = sw && (sw.mag > 0 || sw.reserve > 0 || sw.def.recharge) ? 2 : 3;
    else if (pw.mag === 0 && pw.reloading > 0 && dist < 14 && sw?.mag > 0) slot = 2;   // quick-swap instead of reloading under fire
    else if (slot === 2 && sw && sw.mag === 0 && pw.mag > 0) slot = 1;
    else if (slot !== 2 || dist > 16) slot = 1;
    if (dist < 2.2 && wsOf(3)?.def.kind === 'melee' && pdef?.kind !== 'pellet' && pdef?.kind !== 'flame') slot = 3;
    // grapple hook: zip in on a visible enemy, then finish with the claw / shotgun
    const gh = wsOf(3)?.def.grapple;
    if (this.T.swap && gh && tgt && ((visible && a.grappleCd <= 0 && dist > 8 && dist < gh.range * 0.75) || a.grapple)) slot = 3;
    // sentry: drop it when a fight is on, or while holding a spot
    const sen = wsOf(5)?.def.sentry;
    if (this.T.swap && sen && wsOf(5).usableCd <= 0 && tgt && this.lastSeen && dist < 30 && a.onGround && !g.combat.sentries.some((x) => x.owner === a)) slot = 5;
    if (!this.T.swap) slot = primaryOk ? 1 : sw && (sw.mag > 0 || sw.reserve > 0 || sw.def.recharge) ? 2 : 3;   // casual: sticks to its gun until it is bone dry
    if (this.T.swap && !visible && wsOf(5) && wsOf(5).usableCd <= 0 && ((wsOf(5).def.heal && hpFrac < 0.55) || (wsOf(5).def.armor && a.armor < 10) || state === 'cover')) slot = 5;
    // grenades / mines
    this.throwT -= dt; this.mineT -= dt;
    const tw = wsOf(4);
    if (this.T.throws && tw && tw.count > 0 && !tw.def.mine && this.throwT <= 0 && tgt && this.lastSeen && dist > 8 && dist < 24 && Math.random() < 0.08 + (state === 'smoke' ? 0.2 : 0)) { this.throwing = 1.2; this.throwT = 9 + Math.random() * 9; }
    if (this.T.throws && tw && tw.count > 0 && tw.def.mine && this.mineT <= 0 && !visible && a.onGround) { this.throwing = 1.0; this.mineT = 14 + Math.random() * 12; this.placingMine = true; }
    if (this.throwing > 0) slot = 4;
    if (slot !== this.wantSlot) { if (g.time > this.switchT) { this.wantSlot = slot; this.switchT = g.time + 0.6; } }
    // ── movement goal
    if (state === 'engage') {
      const [near, far] = this.info.range;
      if (dist > far) this.goal = tgt.pos.clone();
      else if (dist < near && !this.info.melee) this.goal = a.pos.clone().addScaledVector(V().subVectors(a.pos, tgt.pos).setY(0).normalize(), 4);
      else this.goal = null;
      if (this.wantSlot === 3) this.goal = tgt.pos.clone();
    } else if (state === 'cover') {
      if (!this.coverPos || g.time > this.coverT) { this.coverPos = this.findCover(tgt); this.coverT = g.time + 3; }
      this.goal = this.coverPos;
    } else if (state === 'hunt') this.goal = this.lastSeen;
    if (state !== 'roam') { this.holdUntil = 0; this.lookDir = null; }
    else if (state === 'smoke') {
      const c = g.combat.clouds.find((cl) => cl.pos.distanceTo(this.lastSeen) < cl.radius);
      if (c) { const away = V().subVectors(a.pos, c.pos).setY(0); const side = V(-away.z, 0, away.x).normalize(); this.goal = c.pos.clone().addScaledVector(away.normalize(), c.radius + 3).addScaledVector(side, 6 * this.strafe); }
    } else if (state === 'blind') this.goal = null;
    else if (state === 'roam') {
      // walk to a spot, then hold it for a while watching an angle (no endless wandering)
      if (this.goal && Math.hypot(a.pos.x - this.goal.x, a.pos.z - this.goal.z) < 1.4 && Math.abs(a.pos.y - this.goal.y) < 0.6) {
        if (!this.holdUntil) { this.holdUntil = g.time + this.T.linger[0] + Math.random() * this.T.linger[1]; this.lookT = 0; }
        if (g.time > this.lookT) { this.lookT = g.time + 1.8 + Math.random() * 2; const c = V(-a.pos.x + (Math.random() - 0.5) * 30, 0, -a.pos.z + (Math.random() - 0.5) * 30); if (c.lengthSq() < 4) c.set(Math.random() - 0.5, 0, Math.random() - 0.5); this.lookDir = c.normalize(); }
        if (g.time > this.holdUntil) { this.goal = this.pickRoam(); this.holdUntil = 0; this.lookDir = null; }
      } else if (!this.goal) { this.goal = this.pickRoam(); this.holdUntil = 0; this.lookDir = null; }
      if (this.lastSeen && g.time - this.lastSeenT > 5) this.lastSeen = null;
    }
    // ── path
    this.pathT -= dt;
    if (this.goal && (this.pathT <= 0 || !this.path || !this.pathGoal || this.pathGoal.distanceTo(this.goal) > 3)) {
      this.path = findPath(g.map.nav, a.pos, this.goal); this.pathGoal = this.goal.clone(); this.pathT = 1.8 + Math.random();
      if (!this.path && state === 'roam') this.goal = null;
    }
    if (!this.goal) this.path = null;
    else if (this.path && !this.path.length && (Math.hypot(a.pos.x - this.goal.x, a.pos.z - this.goal.z) > 1.4 || Math.abs(a.pos.y - this.goal.y) > 0.6)) this.pathT = Math.min(this.pathT, 0.3);   // stopped short: re-plan soon
    // aim error: large at first sight, tightens with time on target
    // a wandering aim offset (not fresh noise each tick), so shots drift around the target like a human's
    const settle = Math.max(this.T.settleMin, 1.4 - this.seenFor * this.T.settleRate);
    const err = this.T.err * settle;
    this.aimErrT.set((Math.random() - 0.5) * err, (Math.random() - 0.5) * err * 0.75, (Math.random() - 0.5) * err);
    this.aimErr.lerp(this.aimErrT, 0.45);
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      if (Math.random() < this.T.hold) this.strafe = 0;                                  // plant the feet for this window
      else { this.strafe = this.T.zigzag ? -(this.lastStrafe || -1) : (Math.random() < 0.5 ? -1 : 1); this.lastStrafe = this.strafe; }
      this.strafeT = this.T.flip[0] + Math.random() * this.T.flip[1];
    }
  }

  findCover(tgt) {
    const g = this.g, a = this.a; let best = null, bd = Infinity;
    const teye = tgt.eye(V());
    for (let k = 0; k < 30; k++) {
      const ang = Math.random() * Math.PI * 2, r = 3 + Math.random() * 9;
      const p = V(a.pos.x + Math.cos(ang) * r, a.pos.y, a.pos.z + Math.sin(ang) * r);
      const n = nodeAt(g.map.nav, p, 1); if (n == null) continue;
      const c = g.map.nav.nodeCell[n]; const N = g.map.nav.N; p.set(((c / N) | 0) - g.map.nav.half + 0.5, g.map.nav.nodeH[n], (c % N) - g.map.nav.half + 0.5);
      if (g.map.world.lineOfSight(teye, V(p.x, p.y + 1.4, p.z))) continue;
      const d = r - p.distanceTo(tgt.pos) * 0.15;
      if (d < bd) { bd = d; best = p; }
    }
    return best || this.pickRoam();
  }
  pickRoam() {
    // favour vantage points: upper floors / roofs / bridges, and the underground tunnels when the map has them
    const nav = this.g.map.nav; const sp = this.g.map.spawns; const P = nav.pois || (nav.pois = poisOf(nav, [sp.red[0], sp.blue[0], sp.ffa[0]].filter(Boolean))); const r = Math.random();
    const pick = (list) => { const n = list[(Math.random() * list.length) | 0]; const c = nav.nodeCell[n]; return new THREE.Vector3(((c / nav.N) | 0) - nav.half + 0.5, nav.nodeH[n], (c % nav.N) - nav.half + 0.5); };
    if (r < 0.35 && P.high.length) return pick(P.high);
    if (r < 0.55 && P.tunnel.length) return pick(P.tunnel);
    if (r < 0.8) return randomNode(nav);
    const ff = sp.ffa; const p = ff[(Math.random() * ff.length) | 0];
    return p.clone().add(V((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
  }

  // per-tick control → intent
  control(dt) {
    const a = this.a, g = this.g, it = this.intent;
    it.jumpPressed = false; it.firePressed = false; it.altPressed = false; it.reload = false; it.alt = false; it.climb = null; it.slide = false;
    it.wish.set(0, 0, 0);
    if (!a.alive || this.frozen) { it.fire = false; return it; }
    this.think_t -= dt; if (this.think_t <= 0) { this.think_t = 0.15; this.think(0.15); }
    if (this.wantSlot !== a.slot && a.weapons[this.wantSlot]) a.switchSlot(this.wantSlot);
    // movement along the path (handles stairs, drops and ladders)
    const wish = V();
    if (this.state === 'blind') { wish.set(-Math.sin(a.yaw + Math.sin(g.time * 3) * 2), 0, -Math.cos(a.yaw + Math.sin(g.time * 3) * 2)).multiplyScalar(0.5); }
    else if (this.dodge) wish.copy(this.dodge);
    else if (this.path && this.path.length) {
      let wp = this.path[0];
      const reached = (w) => Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < (w.ladder ? 0.45 : 0.7) && Math.abs(w.y - a.pos.y) < (w.ladder ? 0.4 : this.path.length === 1 ? 0.45 : 1.2);
      while (wp && reached(wp)) { this.path.shift(); wp = this.path[0]; this.wpT = 0; }
      this.wpT = (this.wpT || 0) + dt;
      if (wp && this.wpT > (wp.ladder ? 6 : 4)) { this.wpT = 0; this.fails = (this.fails || 0) + 1; this.path = null; this.pathT = 0; if (this.fails > 2) { this.goal = null; this.fails = 0; } wp = null; }
      if (wp) {
        if (wp.ladder && a.pos.y < wp.y - 0.3) {
          const L = wp.ladder; const fx = L.fx - a.pos.x, fz = L.fz - a.pos.z; const fd = Math.hypot(fx, fz);
          if (!a.climbing && a.onGround && fd > 0.3 && a.pos.y < wp.y - 1) {
            wish.set(fx / fd, 0, fz / fd).multiplyScalar(Math.min(1, fd + 0.3));   // line up in front of the ladder first
          } else {
            wish.set(-L.nx, 0, -L.nz); it.climb = wish.clone();                    // then climb straight up its face
            // keep centred on the ladder: lateral correction perpendicular to its normal
            const lat = L.nx ? (L.z - a.pos.z) : (L.x - a.pos.x);
            if (a.climbing) { wish.multiplyScalar(0.2); if (L.nx) wish.z += THREE.MathUtils.clamp(lat * 2, -0.8, 0.8); else wish.x += THREE.MathUtils.clamp(lat * 2, -0.8, 0.8); }
          }
        } else wish.set(wp.x - a.pos.x, 0, wp.z - a.pos.z).normalize();
      }
    }
    const tgt = this.target; const visible = this.visible && !!tgt && g.time - this.lastSeenT < 0.3;
    const T = this.T; const cws = a.ws;
    if (this.state === 'engage' && tgt && !a.climbing && visible && !this.dodge) {
      const dT = a.pos.distanceTo(tgt.pos);
      const inRange = !cws || cws.def.kind === 'melee' || !cws.def.range || dT < cws.def.range * 0.95;
      const sniping = cws?.def.scope && (a.ads || dT > 20);
      if (T.strafe === 0 && inRange && this.wantSlot !== 3) wish.set(0, 0, 0);                 // casual: plants its feet to aim
      else if (sniping && !T.scopeMove) wish.set(0, 0, 0);                                       // normal: stands still to snipe
      else {
        const toT = V().subVectors(tgt.pos, a.pos).setY(0).normalize(); const side = V(-toT.z, 0, toT.x);
        wish.addScaledVector(side, this.strafe * T.strafe * (this.goal ? 0.5 : 1));
        if (wish.lengthSq() > 0) wish.normalize();
        if (T.zigzag) wish.multiplyScalar(1); else wish.multiplyScalar(0.7);                      // normal walks, veteran sprints the zig-zag
        if (T.jump && T.hop && a.onGround && wish.lengthSq() > 0.05) { this.hopT -= dt; if (this.hopT <= 0) { it.jumpPressed = true; this.hopT = T.hop[0] + Math.random() * T.hop[1]; } }
      }
    }
    // stuck → hop + repath
    const moved = a.pos.distanceTo(this.lastPos); this.lastPos.copy(a.pos);
    if (wish.lengthSq() > 0.1 && moved < 0.02 && a.onGround && !a.climbing) { this.stuckT += dt; if (this.stuckT > 0.7) { it.jumpPressed = T.jump; this.pathT = 0; this.strafe *= -1; this.stuckT = 0; wish.add(V(-wish.z, 0, wish.x).multiplyScalar(this.strafe)).normalize(); } } else this.stuckT = 0;
    it.wish.copy(wish);
    // aim
    let aimPt = null;
    if (tgt && visible && (this.state === 'engage' || this.throwing > 0)) {
      const ws = a.ws;
      if (this.headPick == null || Math.random() < 0.05) this.headPick = Math.random() < T.head;
      aimPt = (ws?.def.kind === 'mortar') ? tgt.pos.clone() : (this.headPick ? tgt.headPos(V()) : tgt.chest(V()).add(V(0, -0.15, 0)));
      aimPt.addScaledVector(tgt.vel, -T.lag);                                                     // human tracking lag: aims where you just were
      if (ws && ws.def.kind === 'projectile' && ws.def.vel) aimPt.addScaledVector(tgt.vel, (a.pos.distanceTo(tgt.pos) / ws.def.vel) * this.skill);
      if (ws?.def.kind === 'throwable' || ws?.def.proj === 'gl_shell') aimPt.y += a.pos.distanceTo(tgt.pos) * 0.12;
      aimPt.addScaledVector(this.aimErr, Math.min(2.4, 0.5 + a.pos.distanceTo(tgt.pos) * 0.035));
    } else if (this.placingMine && this.throwing > 0) aimPt = a.eye(V()).add(a.forward(V()).multiplyScalar(2)).setY(a.pos.y);
    else if (this.lastSeen && (this.state === 'hunt' || this.state === 'smoke')) aimPt = this.lastSeen.clone().setY(this.lastSeen.y + 1.3);
    else if (wish.lengthSq() > 0) aimPt = a.eye(V()).addScaledVector(wish, 10);
    let lazy = false;
    if (!aimPt && this.lookDir) { aimPt = a.eye(V()).addScaledVector(this.lookDir, 10); lazy = true; }
    if (aimPt && this.state !== 'blind') {
      const d = V().subVectors(aimPt, a.eye(V()));
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const turn = T.turn * dt * (lazy ? 0.3 : 1);                                               // idle glances are slow
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
      if (aimDot > (this.tier === 'casual' ? 0.97 : 0.95) && inRange && ws.def.kind !== 'usable' && ws.def.kind !== 'throwable') fire = true;
      // bursts with pauses instead of laser-holding the trigger
      if (ws.def.mode === 'auto') { this.sprayT += dt; if (this.sprayT > 0.45 + this.skill) { fire = false; if (this.sprayT > 1.05 + this.skill * 0.5) this.sprayT = 0; } }
      if (ws.def.scope && d > 20) it.alt = true;
    }
    if (this.state === 'smoke' && ws && ws.def.kind === 'flame' && this.lastSeen && a.pos.distanceTo(this.lastSeen) < 14) fire = true;
    if (a.slot === 5 && ws && ws.useT < 0 && ws.usableCd <= 0) { fire = !this.prevFire; }
    if (this.throwing > 0) {
      this.throwing -= dt;
      if (a.slot === 4 && a.drawT <= 0) fire = this.throwing > 0.55;
      if (this.throwing <= 0) { this.throwing = 0; this.placingMine = false; }
    }
    if (ws && ws.def.kind !== 'melee' && ws.mag === 0 && ws.reloading <= 0 && !fire) it.reload = true;
    const semi = ws && ws.def.mode !== 'auto' && ws.def.kind !== 'throwable';
    if (semi && fire && this.prevFire) fire = false;
    it.firePressed = fire && !this.prevFire; it.fire = fire;
    this.prevFire = fire;
    if (ws?.def.grapple && tgt && visible && !a.grapple && a.grappleCd <= 0 && a.drawT <= 0) {
      const d = a.pos.distanceTo(tgt.pos); const aimDot = a.aimDir(V()).dot(V().subVectors(tgt.chest(V()), a.eye(V())).normalize());
      if (d > 6 && d < ws.def.grapple.range * 0.8 && aimDot > 0.985) it.altPressed = true;
    }
    // power-slide into close fights / out of danger
    if (this.T.swap && tgt && visible && a.onGround && a.slideCd <= 0 && it.wish && it.wish.lengthSq() > 0.5 && Math.hypot(a.vel.x, a.vel.z) > 4) {
      const d = a.pos.distanceTo(tgt.pos);
      if ((this.info.melee && d < 12 && d > 3) || ((a.hp + a.armor) / a.maxHp < 0.4 && this.state === 'cover') || Math.random() < dt * 0.15) it.slide = true;
    }
    if (ws?.def.ability && tgt && visible && a.pos.distanceTo(tgt.pos) > 5 && a.pos.distanceTo(tgt.pos) < 16 && a.fx.scytheCd <= 0) it.altPressed = true;
    return it;
  }
}
