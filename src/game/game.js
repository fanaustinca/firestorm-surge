// Game orchestrator: renderer, map, actors, fixed-step simulation, camera, rigs, networking glue.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMap } from '../world/maps.js';
import { Actor, RADIUS } from './actor.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { Match, MODES } from './match.js';
import { BotBrain, botLoadout, botName, botTier } from './bots.js';
import { buildSoldier, poseSoldier, attachWeapon, buildItem, findMarker, teamColor, buildTarget } from '../render/models.js';
import { tex } from '../render/textures.js';
import { makePlate, drawPlate } from '../render/nameplate.js';
import { Input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { Hud } from '../ui/hud.js';
import { Net } from '../net/net.js';
import { profile } from '../meta/profile.js';
import { gameplay } from '../meta/ads.js';
import { WEAPON_BY_ID, BASE_HP, isExplosive, ULTRA_OF, baseId } from '../data/weapons.js';
import { randomNode, findPath } from './bots.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const STEP = 1 / 60;
const _a = V(), _b = V();

export class Game {
  constructor(canvas) {
    this.canvas = canvas; this.profile = profile;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
    r.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 400); this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    const pm = new THREE.PMREMGenerator(r); this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex; this.scene.environmentIntensity = 0.45;
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -48; sc.right = sc.top = 48; sc.near = 1; sc.far = 220;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5048, 1); this.scene.add(this.hemi);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: tex('sky'), side: THREE.BackSide, fog: false, depthWrite: false }));
    this.scene.add(this.sky);
    this.input = new Input(canvas);
    this.effects = new Effects(this.scene, this.camera);
    this.combat = new Combat(this);
    this.vm = new ViewModel(r); this.vm.setEnv(this.envTex);
    this.hud = new Hud(this); this.hud.show(false);
    this.net = new Net(this);
    this.actors = []; this.brains = new Map(); this.player = null; this.map = null; this.match = null;
    this.time = 0; this.timeScale = 1; this.acc = 0; this.queue = []; this.state = 'menu'; this.paused = false;
    this.shake = 0; this.wobble = 0; this.baseFov = profile.d.settings.fov; this.god = false; this.noclip = false;
    this.playerName = profile.d.name; this.autoPause = true; this.thermalMat = new THREE.MeshBasicMaterial({ color: 0xff7a10, fog: false, toneMapped: false });
    this.thermalHiMat = new THREE.MeshBasicMaterial({ color: 0xffe060, fog: false, toneMapped: false });
    this.look = { dx: 0, dy: 0 };
    this.studio = null; this.last = performance.now(); this.botFind = findPath;
    addEventListener('resize', () => this.resize());
    this.input.on('key', (k) => this.onKey(k));
    this.input.on('lock', (l) => { if (!l && this.state === 'playing' && this.autoPause && !this.match?.ended) this.ui?.pause(true); });
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.vm.camera.aspect = w / h; this.vm.camera.updateProjectionMatrix();
    if (this.studio) { this.studio.cam.aspect = w / h; this.studio.cam.updateProjectionMatrix(); }
  }

  // ═════════════════ map / match lifecycle ═════════════════
  loadMap(id) {
    if (this.map) { this.scene.remove(this.map.group); this.map.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    this.map = buildMap(id); this.scene.add(this.map.group);
    const e = this.map.env;
    this.sun.position.set(...e.sun).normalize().multiplyScalar(90); this.sun.color.set(e.sunColor); this.sun.intensity = e.sunI;
    this.hemi.color.set(e.hemi[0]); this.hemi.groundColor.set(e.hemi[1]); this.hemi.intensity = e.hemi[2];
    this.scene.fog = new THREE.Fog(e.fog[0], e.fog[1], e.fog[2]); this.renderer.toneMappingExposure = e.exposure;
    this.sky.visible = !e.indoor; this.scene.background = new THREE.Color(e.fog[0]);
    this.sky.material.color.set({ day: 0xffffff, desert: 0xfff2e0, dusk: 0xffd6c0, night: 0x202840, snow: 0xe8f0ff, jungle: 0xd8f0d0 }[e.sky] ?? 0xffffff);
    this.scene.environmentIntensity = e.indoor ? 0.3 : 0.45;
    // falling snow (Frostbite): 2400 flakes in a 40 m box that follows the camera
    if (this.snow) { this.scene.remove(this.snow); this.snow.geometry.dispose(); this.snow = null; }
    if (e.snowfall) {
      const n = 2400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false })); this.snow.frustumCulled = false; this.scene.add(this.snow);
    }
  }

  async startMatch({ mapId = 'cargo_yard', modeId = 'red_vs_blue', online = false, matchId = null } = {}) {
    this.exitInspect();
    this.clearActors(); this.combat.reset(); this.effects.clear(); this.queue = [];
    if (!online && this.net.connected) await this.net.leave();
    this.killCoins = 0; this.killCount = 0;
    this.loadMap(mapId); this.mapId = mapId; this.modeId = modeId;
    this.net.matchId = matchId || `${modeId}:${mapId}:${Math.random().toString(36).slice(2, 7)}`; this.rosterKey = '';
    this.match = new Match(this, modeId);
    const loadout = profile.effectiveLoadout();
    const p = this.player = new Actor({ id: this.net.selfId, name: profile.d.name, team: 'red', isLocal: true });
    const skins = {}; for (const s in loadout) if (loadout[s]) skins[loadout[s]] = profile.skinFor(loadout[s]);
    p.setLoadout(loadout, skins); this.actors.push(p);
    this.slotIndex = new Map();
    this.rebuildRoster();
    for (const a of this.actors) this.respawnActor(a);
    this.vm.setWeapon(p.loadout[p.slot], p.skins[p.loadout[p.slot]]);
    if (MODES[modeId].practice) this.spawnTargets();
    this.state = 'playing'; this.paused = false; this.hud.show(true); this.hud.slotsKey = '';
    this.hud.center(`<b>${MODES[modeId].name.toUpperCase()}</b><br>${this.map.info.name}`, 2.6);
    gameplay.start(); this.onMatchStart?.();
    if (online && !this.net.connected) {
      this.net.connect(modeId, MODES[modeId].size, (s) => this.hud.toast(s)).then((ok) => { if (ok) this.rebuildRoster(); });
    }
  }

  // Practice Range: static + sliding steel targets spread over every level of the map
  spawnTargets() {
    let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pts = [];
    for (let tries = 0; pts.length < 14 && tries < 400; tries++) {
      const p = randomNode(this.map.nav, rnd);
      if (p.distanceTo(this.player.pos) < 8 || pts.some((q) => q.distanceTo(p) < 5)) continue;
      pts.push(p);
    }
    pts.forEach((p, i) => {
      const a = new Actor({ id: 'target-' + i, name: 'Target ' + (i + 1), team: 'ffa', isBot: true });
      a.isTarget = true; a.home = p.clone(); a.slide = i % 3 === 0 ? 2.5 : 0; a.botIndex = 100 + i;
      a.setLoadout({}); a.respawn(p, 0); a.spawnProtect = 0; this.actors.push(a);
    });
  }

  clearActors() {
    for (const a of this.actors) if (a.rig) this.scene.remove(a.rig);
    this.actors = []; this.brains.clear(); this.player = null;
  }

  // Slots 0..size-1: humans actually in this match (sorted ids) take the first slots, bots backfill the rest.
  // Also hands bots over when ownership changes (a peer left / stopped playing) so nobody is left frozen or dead.
  rebuildRoster() {
    const mode = MODES[this.modeId]; const humans = this.net.connected ? this.net.players : [this.player.id];
    this.rosterKey = humans.join('|');
    const wanted = new Map();
    humans.forEach((id, k) => wanted.set(id, { slot: k, human: true }));
    for (let k = humans.length; k < mode.size; k++) wanted.set('bot-' + k, { slot: k, human: false });
    for (const a of [...this.actors]) if (!wanted.has(a.id) && !a.dev && !a.isTarget) this.removeActor(a);
    for (const [id, w] of wanted) {
      const team = this.match.teamFor(w.slot);
      let a = this.actors.find((x) => x.id === id);
      if (!a && !w.human) a = this.addBot({ id, index: w.slot, team, tier: botTier(this.net.matchId, w.slot, humans.length, mode.size) });
      if (!a) continue;
      a.botIndex = w.slot;
      if (!w.human && !this.brains.has(a)) { const info = botLoadout(w.slot); a.setLoadout(info.loadout); a.archetype = info.archetype; this.brains.set(a, new BotBrain(this, a, info, botTier(this.net.matchId, w.slot, humans.length, mode.size))); a.isRemote = false; a.net = null; }
      if (!w.human) a.tier = botTier(this.net.matchId, w.slot, humans.length, mode.size);
      if (a.team !== team) { a.team = team; if (a.rig) { this.scene.remove(a.rig); a.rig = null; } if (this.owns(a)) this.respawnActor(a); }
      if (this.owns(a) && !a.alive && !(a.respawnT > 0) && !this.match.roundBased) a.respawnT = 1;
    }
  }

  addBot({ id, index = this.actors.length, team, weapon, skill, tier } = {}) {
    const info = botLoadout(index, weapon);
    const a = new Actor({ id: id || `bot-dev-${Math.random().toString(36).slice(2, 7)}`, name: botName(index), team: team || this.match.teamFor(index), isBot: true });
    a.botIndex = index; a.setLoadout(info.loadout); a.archetype = info.archetype;
    if (weapon) { const w = WEAPON_BY_ID[weapon]; if (w && w.slot <= 5) a.slot = w.slot; a.prevSpawnSlot = a.slot; }
    this.actors.push(a);
    this.brains.set(a, new BotBrain(this, a, info, tier ?? skill ?? 'normal'));
    return a;
  }
  removeActor(a) { if (a.rig) this.scene.remove(a.rig); this.actors = this.actors.filter((x) => x !== a); this.brains.delete(a); }

  respawnActor(a) {
    if (a.isTarget) { a.respawn(a.home, 0); a.spawnProtect = 0; if (a.rig) { a.rig.visible = true; a.deathT = 0; } return; }
    const p = this.match.spawnFor(a); a.respawn(p, Math.atan2(p.x, p.z));
    if (a === this.player) { this.vm.setWeapon(a.loadout[a.slot], a.skins[a.loadout[a.slot]]); this.hud.slotsKey = ''; }
    if (a.rig) { a.rig.rotation.set(0, a.yaw, 0); a.rig.visible = true; a.deathT = 0; }
    if (this.owns(a) && this.net.connected) this.net.event({ t: 'spawn', id: a.id, pos: p.toArray() });
  }

  owns(a) { return this.net.owns(a); }
  hostile(a, b) { if (!a || !b || a === b) return false; return a.team === 'ffa' || b.team === 'ffa' || a.team !== b.team; }
  after(sec, fn) { this.queue.push({ t: this.time + sec, fn }); }

  // ═════════════════ damage / status ═════════════════
  damage(t, amount, info = {}) {
    if (!t || !t.alive || amount <= 0) return;
    const atk = info.attacker;
    if (!this.owns(t)) {
      if (atk && this.owns(atk)) {
        this.net.event({ t: 'hit', target: t.id, amount, head: !!info.head, weapon: info.weapon, attacker: atk.id, explosive: !!info.explosive, fire: !!info.fire, emotional: !!info.emotional, melee: !!info.melee, pos: info.pos?.toArray?.() });
        if (atk === this.player) { this.hud.hitmarker(info.head, false); sfx.hit(info.head); }
        if (info.emotional) this.emotionalFx(t, atk);
      }
      return;
    }
    this.applyDamage(t, amount, info);
  }
  applyDamage(t, amount, info) {
    if (!t.alive) return;
    const atk = info.attacker;
    if (t.spawnProtect > 0 && atk !== t) return;
    if (t === this.player && this.god) return;
    if ((info.explosive || info.fire) && t.mods.blast) amount *= 1 - t.mods.blast;
    const total = amount;
    const absorbed = Math.min(t.armor, amount); t.armor -= absorbed; amount -= absorbed; t.hp -= amount;
    if (atk && atk !== t) { t.lastAttacker = atk; atk.stats.damage += total; if (info.head) atk.stats.headshots++; }
    t.lastHurt = this.time;
    const med = t.weapons[5]; if (med && med.useT >= 0 && med.def.interrupt) { med.useT = -1; if (t === this.player) this.hud.toast('Med Kit interrupted!', 'warn'); }
    const killed = t.hp <= 0.001;
    if (atk === this.player && t !== this.player) { this.hud.hitmarker(info.head, killed); sfx.hit(info.head); }
    if (t === this.player) {
      const src = info.pos ? new THREE.Vector3(...(info.pos.toArray ? info.pos.toArray() : info.pos)) : atk?.pos;
      if (src && atk !== t) { const d = _a.subVectors(src, t.pos); const ang = Math.atan2(d.x, d.z) - Math.atan2(-Math.sin(t.yaw), -Math.cos(t.yaw)); this.hud.damageFrom(-ang); }
      this.shake = Math.max(this.shake, Math.min(0.4, total / 200));
    }
    if (info.emotional) { this.emotionalFx(t, atk); if (atk) atk.stats.emotional++; }
    if (killed) this.kill(t, info);
  }
  emotionalFx(t, atk) {
    this.effects.popup('EMOTIONAL DAMAGE', t.headPos(V()).add(_b.set(0, 0.7, 0)));
    if (t === this.player || atk === this.player) { this.hud.emotional(); this.wobble = 0.8; sfx.emotional(); }
    this.lastEmotional = { target: t.id, time: this.time };
  }
  kill(t, info) {
    if (!t.alive) return;
    const killer = info.attacker;
    t.alive = false; t.hp = 0; t.stats.deaths++; t.deathT = 0; t.fx.burn = null; t.fx.bleed = []; t.thermal.on = false;
    if (killer && killer !== t) {
      killer.stats.kills++;
      if (info.melee) killer.stats.meleeKills++;
      if (info.explosive || isExplosive(WEAPON_BY_ID[info.weapon] || {})) killer.stats.explosiveKills++;
    }
    this.match.onKill(t, killer);
    this.hud.killfeed(killer, t, info.weapon, info.head);
    if (killer === this.player && t !== this.player) {
      sfx.kill();
      const tier = profile.addWeaponKill(baseId(info.weapon)); profile.save();
      if (tier) this.hud.toast(`${tier.name} skin unlocked for ${WEAPON_BY_ID[baseId(info.weapon)]?.name}!`, 'gold');
      this.awardKill(t, info);
    }
    if (t === this.player) { this.vm.visible = false; t.prevSpawnSlot = t.slot; }
    if (this.owns(t) && this.net.connected) this.net.event({ t: 'kill', victim: t.id, killer: killer?.id, weapon: info.weapon, head: !!info.head, melee: !!info.melee, explosive: !!info.explosive });
  }
  // Kill bounty: paid immediately and shown in the ELIMINATED banner. Throwables (mine, grenade, molotov…) pay extra.
  awardKill(victim, info) {
    const w = WEAPON_BY_ID[info.weapon] || {};
    const practice = this.match?.mode.practice || victim.isTarget;
    let coins = 0; const tags = [];
    if (!practice) {
      coins = 10;
      if (info.head) { coins += 5; tags.push('HEADSHOT'); }
      if (w.slot === 4) { coins += 10; tags.push({ land_mine: 'MINE KILL', frag: 'GRENADE KILL', molotov: 'MOLOTOV KILL', sticky_bomb: 'STICKY KILL', flashbang: 'FLASH KILL', smoke_grenade: 'SMOKE KILL' }[w.id] || 'THROWABLE KILL'); }
      else if (info.explosive || w.splash) { coins += 5; tags.push('EXPLOSIVE'); }
      if (info.melee) { coins += 5; tags.push('MELEE'); }
      if (info.emotional) tags.push('EMOTIONAL DAMAGE');
      profile.addCoins(coins); this.killCoins += coins;
    }
    this.killCount++;
    this.hud.killBanner(victim.name, info.weapon, coins, tags.join(' · '));
  }
  blind(t, time) { if (!this.owns(t)) { this.net.event({ t: 'blind', target: t.id, time }); return; } t.fx.flash = Math.max(t.fx.flash, time); if (t === this.player) { this.hud.flash(time); sfx.ring(time); } }
  stun(t, time) { if (!this.owns(t)) { this.net.event({ t: 'stun', target: t.id, time }); return; } t.fx.stun = Math.max(t.fx.stun, time); if (t.ws) { t.ws.reloading = 0; t.ws.cook = -1; } }

  updateStatus(a, dt) {
    const fx = a.fx;
    if (a.spawnProtect > 0) a.spawnProtect -= dt;
    if (fx.stun > 0) fx.stun -= dt;
    if (fx.flash > 0) fx.flash -= dt;
    if (fx.scythe > 0) fx.scythe -= dt;
    if (fx.adrenaline > 0) { fx.adrenaline -= dt; if (a.alive) a.hp = Math.min(BASE_HP, a.hp + 10 * dt); }
    if (fx.burn && a.alive) { fx.burn.t -= dt; fx.burn.acc += fx.burn.dps * dt; if (fx.burn.acc >= 3) { const dmg = fx.burn.acc; fx.burn.acc = 0; this.damage(a, dmg, { attacker: fx.burn.owner, weapon: 'flamethrower', fire: true, explosive: true }); } if (fx.burn && fx.burn.t <= 0) fx.burn = null; if (fx.burn && Math.random() < 0.5) this.effects.flame(a.chest(V()).add(_a.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5)), V().set(0, 1.5, 0)); }
    for (let i = fx.bleed.length - 1; i >= 0; i--) { const b = fx.bleed[i]; if (!b) continue; b.t -= dt; b.acc = (b.acc || 0) + b.dps * dt; if (b.acc >= 2.5 && a.alive) { const dmg = b.acc; b.acc = 0; this.damage(a, dmg, { attacker: b.owner, weapon: 'crossbow' }); } if (b.t <= 0 && fx.bleed[i] === b) fx.bleed.splice(i, 1); }
    // thermal battery: 8 s on, recharges fully in 6 s
    if (a.thermal.on) { a.thermal.battery -= dt; if (a.thermal.battery <= 0) { a.thermal.battery = 0; a.thermal.on = false; if (a === this.player) this.hud.toast('Thermal battery depleted', 'warn'); } }
    else a.thermal.battery = Math.min(8, a.thermal.battery + dt * (8 / 6));
    a.recoil = Math.max(0, a.recoil - dt * 0.6); a.bloom = Math.max(0, a.bloom - dt * 0.08);
  }

  // ═════════════════ hooks from combat ═════════════════
  muzzleWorld(a, out) {
    if (a === this.player && this.vm.item) return this.vm.muzzleWorld(this.camera, out);
    const m = a.rig?.userData.parts?.active?.children[0];
    const mk = m && findMarker(m, 'muzzle');
    if (mk) { a.rig.updateMatrixWorld(true); return mk.getWorldPosition(out); }
    return a.eye(out).addScaledVector(a.aimDir(_a), 0.6);
  }
  onFired(a, def, muzzle, dir) {
    a.lastShotT = this.time;
    if (a === this.player) {
      this.vm.onFire(def);
      if (def.recoil) { a.pitch += def.recoil * (a.ads ? 0.45 : 0.7); a.yaw += (Math.random() - 0.5) * def.recoil * 0.4; }
      if (def.kind === 'mortar' || def.id === 'heavy_sniper' || def.id === 'rocket_launcher') this.shake = Math.max(this.shake, 0.12);
    }
    if (muzzle && !['melee', 'throwable'].includes(def.kind) && !def.silent) this.effects.muzzle(muzzle, dir, def.slot === 1 ? 1.1 : 0.8, def.id === 'taser' ? 0x80e0ff : 0xffc060);
    if (this.owns(a) && this.net.connected && ['bullet', 'pellet'].includes(def.kind)) {
      const recent = this.combat.bullets.slice(-(def.pellets || 1)).filter((b) => b.owner === a);
      this.net.event({ t: 'shot', a: a.id, w: def.id, o: a.eye(V()).toArray().map((x) => +x.toFixed(2)), d: recent.map((b) => b.dir.toArray().map((x) => +x.toFixed(4))) });
    } else if (this.owns(a) && this.net.connected && ['flame', 'melee', 'taser'].includes(def.kind)) this.net.event({ t: 'fx', a: a.id, w: def.id });
  }
  onProjectile(owner, p) { if (this.owns(owner) && this.net.connected) this.net.event({ t: 'proj', id: p.id, a: owner.id, w: p.def.id, k: p.kind, p: p.pos.toArray(), v: p.vel.toArray(), f: p.fuse }); }
  onWorldEvent(type, d) {
    if (!this.net.connected) return;
    if (type === 'boom' || type === 'smoke' || type === 'flash' || type === 'fire' || type === 'ring' || type === 'arc' || type === 'barricade' || type === 'barricade_down') this.net.event({ t: 'w:' + type, ...d });
  }
  shakeFrom(pos, radius) { const d = pos.distanceTo(this.camera.position); this.shake = Math.max(this.shake, Math.max(0, 1 - d / (radius * 5)) * 0.5); }

  // ═════════════════ networking callbacks ═════════════════
  onPeerJoin(id, name) { this.hud.toast(`${name || 'Player'} joined the room`); }
  onPeerLeave(id) { const a = this.actors.find((x) => x.id === id); if (a) { this.hud.toast(`${a.name} left — bot backfilling`); this.removeActor(a); } this.rebuildRoster(); }
  onRemoteState(list) {
    for (const e of list) {
      const [id, x, y, z, yaw, pitch, slot, wid, hp, armor, alive, team, name, isBot, speed, swing, kills, deaths] = e;
      let a = this.actors.find((q) => q.id === id);
      if (!a) { a = new Actor({ id, name, team, isBot: !!isBot }); a.isRemote = !isBot; a.setLoadout({ [slot]: wid || 'assault_rifle' }); a.slot = slot; if (isBot) a.botIndex = +String(id).split('-')[1] || 0; this.actors.push(a); }
      if (this.owns(a)) continue;
      a.net = { pos: new THREE.Vector3(x, y, z), yaw, pitch, t: this.time }; a.netSpeed = speed;
      if (!a.weapons[slot] || a.weapons[slot].id !== wid) { if (wid) { a.loadout[slot] = wid; a.setLoadout(a.loadout); } }
      a.slot = slot; a.hp = hp; a.armor = armor; a.name = name; a.stats.kills = kills; a.stats.deaths = deaths;
      if (alive && !a.alive) { a.alive = true; a.pos.set(x, y, z); if (a.rig) { a.rig.visible = true; a.rig.rotation.set(0, yaw, 0); } }
      if (a.ws) a.ws.swing = swing ? Math.max(a.ws.swing, 0.01) : a.ws.swing;
      if (a.team !== team) { a.team = team; if (a.rig) { this.scene.remove(a.rig); a.rig = null; } }
    }
  }
  onRemoteEvent(e) {
    const A = (id) => this.actors.find((x) => x.id === id);
    switch (e.t) {
      case 'shot': { const a = A(e.a); const d = WEAPON_BY_ID[e.w]; if (!a || !d) return; const o = new THREE.Vector3(...e.o); const muzzle = this.muzzleWorld(a, V()); for (const dir of e.d) this.combat.addBullet(a, d, o, new THREE.Vector3(...dir), muzzle, true); a.lastShotT = this.time; this.effects.muzzle(muzzle, new THREE.Vector3(...e.d[0]), 1); sfx.shot({ assault_rifle: 'rifle', ak47: 'rifle', lmg: 'rifle', burst_rifle: 'rifle', heavy_sniper: 'heavy', dmr: 'heavy', revolver: 'heavy', smg: 'smg', sawed_off: 'shotgun', tactical_shotgun: 'shotgun' }[e.w] || 'pistol', a.chest(V())); break; }
      case 'fx': { const a = A(e.a); if (!a) return; a.lastShotT = this.time; if (e.w === 'flamethrower') for (let i = 0; i < 4; i++) this.effects.flame(this.muzzleWorld(a, V()), a.aimDir(V()).multiplyScalar(16)); break; }
      case 'proj': { const a = A(e.a); const d = WEAPON_BY_ID[e.w]; if (!a || !d) return; const pr = this.combat.spawnProj(a, d, e.k, new THREE.Vector3(...e.p), new THREE.Vector3(...e.v), { id: e.id, fuse: e.f, remote: true }); if (d.projScale) pr.mesh.scale.setScalar(d.projScale); break; }
      case 'w:boom': { const p = new THREE.Vector3(...e.pos); this.effects.explosion(p, e.r); sfx.explosion(p, e.r / 4.5); this.shakeFrom(p, e.r); const pr = this.combat.projs.find((q) => q.id === e.id); if (pr) { this.scene.remove(pr.mesh); this.combat.projs.splice(this.combat.projs.indexOf(pr), 1); } break; }
      case 'w:smoke': this.combat.makeSmoke(new THREE.Vector3(...e.pos), WEAPON_BY_ID.smoke_grenade.smoke); break;
      case 'w:flash': this.effects.flashBurst(new THREE.Vector3(...e.pos)); break;
      case 'w:fire': this.combat.fires.push({ pos: new THREE.Vector3(...e.pos), radius: e.radius, time: e.time, t: 0, remote: true, acc: new Map() }); this.effects.firePool(this.combat.fires[this.combat.fires.length - 1]); break;
      case 'w:arc': this.effects.lightning(new THREE.Vector3(...e.a), new THREE.Vector3(...e.b)); break;
      case 'w:ring': this.effects.mortarRing(new THREE.Vector3(...e.pos), e.t + 0.15, e.r); break;
      case 'w:barricade': { const o = A(e.owner); if (o) this.combat.placeBarricade(o, WEAPON_BY_ID.barricade.barricade, { pos: e.pos, alongX: e.alongX, id: e.id }); break; }
      case 'w:barricade_down': { const b = this.combat.barricades.find((x) => x.id === e.id); if (b) this.combat.destroyBarricade(b); break; }
      case 'hit': { const t = A(e.target); if (t && this.owns(t)) this.applyDamage(t, e.amount, { attacker: A(e.attacker), weapon: e.weapon, head: e.head, explosive: e.explosive, fire: e.fire, emotional: e.emotional, melee: e.melee, pos: e.pos }); break; }
      case 'kill': { const t = A(e.victim); if (!t || this.owns(t)) return; if (t.alive) { t.alive = false; t.deathT = 0; t.stats.deaths++; const k = A(e.killer); if (k && k !== t) { k.stats.kills++; } this.match.onKill(t, k); this.hud.killfeed(k, t, e.weapon, e.head); if (k === this.player) { sfx.kill(); this.hud.hitmarker(e.head, true); profile.addWeaponKill(baseId(e.weapon)); if (e.melee) k.stats.meleeKills++; if (e.explosive) k.stats.explosiveKills++; this.awardKill(t, { weapon: e.weapon, head: e.head, melee: e.melee, explosive: e.explosive }); } } break; }
      case 'blind': { const t = A(e.target); if (t && this.owns(t)) this.blind(t, e.time); break; }
      case 'stun': { const t = A(e.target); if (t && this.owns(t)) this.stun(t, e.time); break; }
      case 'spawn': { const a = A(e.id); if (a && !this.owns(a)) { a.alive = true; a.hp = BASE_HP; a.pos.set(...e.pos); a.net = { pos: a.pos.clone(), yaw: a.yaw, pitch: 0, t: this.time }; } break; }
    }
  }
  onRemoteMatch(s) { this.match?.apply(s); }

  // ═════════════════ input ═════════════════
  onKey(code) {
    if (this.state !== 'playing' || this.paused) {
      if (code === 'Escape' && this.state === 'inspect') this.exitInspect(true);
      return;
    }
    const p = this.player; if (!p) return;
    if (code.startsWith('Digit')) { const s = +code.slice(5); if (s >= 1 && s <= 5 && p.alive) { if (p.switchSlot(s)) sfx.click(); } }
    if ((code === 'KeyF' || code === 'KeyV') && p.alive) this.toggleThermal();
    if (code === 'KeyB' || code === 'KeyM') this.ui?.openLoadout(true);
  }
  toggleThermal() {
    const p = this.player;
    if (p.loadout[6] !== 'thermal_goggles') { this.hud.toast(p.loadout[6] ? 'Equip Thermal Goggles in Slot 6 to use F/V' : 'Slot 6 locked — unlock it in the Loadout (B)', 'warn'); return false; }
    if (!p.thermal.on && p.thermal.battery < 0.5) { this.hud.toast('Thermal battery recharging…', 'warn'); return false; }
    p.thermal.on = !p.thermal.on; sfx.click(); return true;
  }

  // ═════════════════ simulation ═════════════════
  fixedUpdate(dt) {
    this.time += dt;
    const p = this.player;
    if (p && this.state === 'playing') {
      const it = this.input.sample();
      this.look.dx = it.dx; this.look.dy = it.dy;
      const frozen = this.match && (this.match.phase === 'warmup' || this.match.phase === 'end');
      if (p.alive && !this.paused) {
        const zoom = p.ws?.def.scope ? 1 + (p.ws.def.ads - 1) * this.vm.adsK : 1;   // only snipers zoom
        const sens = 0.0022 * (profile.d.settings.sens || 1) / zoom;
        p.yaw -= it.dx * sens; p.pitch = THREE.MathUtils.clamp(p.pitch - it.dy * sens, -1.5, 1.5);
        if (this.noclip) this.noclipMove(it, dt);
        else {
          const f = p.forward(_a), r = _b.set(-f.z, 0, f.x); const wish = V();
          if (it.forward) wish.add(f); if (it.back) wish.sub(f); if (it.right) wish.add(r); if (it.left) wish.sub(r);
          if (wish.lengthSq() > 0) wish.normalize();
          const wasGround = p.onGround;
          if (frozen) wish.set(0, 0, 0);
          p.move(dt, this.map.world, wish, it.jumpPressed && !frozen, it.forward && !frozen ? p.forward(V()) : null);
          // footsteps
          const spd = Math.hypot(p.vel.x, p.vel.z); p.stepAcc = (p.stepAcc || 0) + spd * dt;
          if (p.onGround && p.stepAcc > 2.1) { p.stepAcc = 0; sfx.footstep(null, (1 + (p.mods.footstep || 0)) * 0.6, this.mapId === 'desert_outpost' ? 'sand' : 'hard'); }
          if (p.landed && !wasGround) sfx.footstep(null, 0.8);
        }
        if (!frozen) this.combat.tick(p, it, dt);
        this.checkUltra(p);
        if (p.ws?.id && this.vm.id !== p.loadout[p.slot]) this.vm.setWeapon(p.loadout[p.slot], p.skins[p.loadout[p.slot]]);
      }
      this.input.endFrame();
    }
    for (const a of this.actors) {
      if (a === p) { this.updateStatus(a, dt); continue; }
      if (!this.owns(a)) { this.interpRemote(a, dt); continue; }
      this.updateStatus(a, dt);
      const brain = this.brains.get(a);
      const frozenB = this.match && (this.match.phase === 'warmup' || this.match.phase === 'end');
      if (a.isTarget) { if (a.alive && a.slide) { a.pos.x = a.home.x + Math.sin(this.time * 0.9 + a.botIndex) * a.slide; } this.checkUltra(a); continue; }
      if (brain && a.alive && frozenB) { a.move(dt, this.map.world, _a.set(0, 0, 0), false, null); }
      else if (brain && a.alive) {
        const it = brain.control(dt);
        a.move(dt, this.map.world, it.wish, it.jumpPressed, it.climb);
        this.checkUltra(a);
        this.combat.tick(a, it, dt);
        const spd = Math.hypot(a.vel.x, a.vel.z); a.stepAcc = (a.stepAcc || 0) + spd * dt;
        if (a.onGround && a.stepAcc > 2.2) { a.stepAcc = 0; sfx.footstep(a.pos, 1 + (a.mods.footstep || 0)); }
      } else if (!a.alive) { a.vel.set(0, 0, 0); }
    }
    this.combat.update(dt);
    if (this.net.connected && this.match && (this.rosterT = (this.rosterT || 0) - dt) <= 0) { this.rosterT = 0.5; if (this.net.players.join('|') !== this.rosterKey) this.rebuildRoster(); }
    this.match?.update(dt);
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].t <= this.time) { const q = this.queue.splice(i, 1)[0]; q.fn(); }
    this.net.update(dt);
  }
  // ULTRA: 1v1 → after the first minute of a round; every other mode → after surviving 30 s. Lasts until death.
  checkUltra(a) {
    const m = this.match; if (!m || m.phase !== 'live' || !a.alive || a.ultra || a.isTarget) return;
    if (a.aliveSince == null) a.aliveSince = this.time;
    const ok = m.id === '1v1' ? (m.mode.roundTime - m.timeLeft) >= 60 : (this.time - a.aliveSince) >= 30;
    if (!ok) return;
    const u = ULTRA_OF[baseId(a.loadout[1])];
    if (!u || !a.activateUltra(u)) { a.ultra = true; return; }   // no Ultra for this primary — stop checking
    if (a === this.player) {
      this.hud.center(`<b class="ultra">⚡ ULTRA UNLOCKED ⚡</b><br>${WEAPON_BY_ID[u].name}`, 2.6); this.hud.slotsKey = '';
      if (a.slot === 1) this.vm.setWeapon(u, null);
      sfx.ultra?.();
    } else if (this.player && a.pos.distanceTo(this.player.pos) < 40) this.hud.toast(`${a.name} went ULTRA!`, 'warn');
  }
  interpRemote(a, dt) {
    if (!a.net) return;
    const k = Math.min(1, dt * 12);
    if (a.pos.distanceTo(a.net.pos) > 6) a.pos.copy(a.net.pos); else a.pos.lerp(a.net.pos, k);
    let dy = a.net.yaw - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    a.yaw += dy * k; a.pitch += (a.net.pitch - a.pitch) * k;
    a.vel.set(0, 0, 0); a.vel.x = a.netSpeed || 0; // for animation only
    if (a.ws && a.ws.swing > 0) a.ws.swing = Math.min(1, a.ws.swing + dt * 2.5) % 1;
  }
  noclipMove(it, dt) {
    const p = this.player; const d = p.aimDir(V()); const r = V().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    const v = V(); if (it.forward) v.add(d); if (it.back) v.sub(d); if (it.right) v.add(r); if (it.left) v.sub(r); if (it.jump) v.y += 1;
    p.pos.addScaledVector(v, dt * 14); p.vel.set(0, 0, 0);
  }

  // Deterministic stepping for tests / DEV
  advance(seconds) { const n = Math.round(seconds / STEP); for (let i = 0; i < n; i++) this.fixedUpdate(STEP); this.renderFrame(STEP * n); }

  // ═════════════════ rendering ═════════════════
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    if (this.state === 'inspect') { this.renderStudio(dt); return; }
    if (this.state !== 'playing' || !this.map) { this.renderer.clear(); if (this.map) this.renderer.render(this.scene, this.camera); return; }
    if (!this.paused || this.net.connected) {
      this.acc += dt * this.timeScale;
      let n = 0; while (this.acc >= STEP && n < 8) { this.fixedUpdate(STEP); this.acc -= STEP; n++; }
      if (n === 8) this.acc = 0;
    }
    this.renderFrame(dt);
  }

  renderFrame(dt) {
    if (!this.map || !this.player) return;
    const p = this.player, cam = this.camera;
    // camera
    if (p.alive) {
      cam.position.set(p.pos.x, p.pos.y + 1.6, p.pos.z);
      this.vm.visible = true;
    } else {
      p.deathT = (p.deathT || 0) + dt;
      cam.position.lerp(_a.set(p.pos.x, p.pos.y + 0.6 + Math.min(1, p.deathT) * 2.2, p.pos.z), Math.min(1, dt * 3));
      if (p.lastAttacker?.alive) { const d = _b.subVectors(p.lastAttacker.chest(V()), cam.position); p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
    }
    this.shake = Math.max(0, this.shake - dt * 1.6); this.wobble = Math.max(0, this.wobble - dt);
    const sh = this.shake * this.shake;
    const wob = this.wobble > 0 ? Math.sin(this.time * 22) * 0.12 * (this.wobble / 0.8) : 0;
    cam.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.2 + wob * 0.3, p.yaw + (Math.random() - 0.5) * sh * 0.2, wob + (p.fx.stun > 0 ? Math.sin(this.time * 40) * 0.01 : 0));
    const def = p.ws?.def; const zoom = def?.scope ? 1 + (def.ads - 1) * this.vm.adsK : 1;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) / zoom)) + (p.fx.scythe > 0 ? 8 : 0);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    sfx.setListener(cam.position, _a.set(1, 0, 0).applyQuaternion(cam.quaternion));
    // sun follows the camera for crisp shadows
    const e = this.map.env; this.sun.target.position.set(Math.round(cam.position.x / 4) * 4, 0, Math.round(cam.position.z / 4) * 4);
    this.sun.position.copy(this.sun.target.position).add(_b.set(...e.sun).normalize().multiplyScalar(90));
    this.sky.position.copy(cam.position);
    if (this.snow) {
      const a = this.snow.geometry.attributes.position, t = this.time;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * (1.2 + (i % 7) * 0.12); if (y < 0) y += 18; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.25); }
      a.needsUpdate = true; this.snow.position.set(Math.round(cam.position.x / 2) * 2, 0, Math.round(cam.position.z / 2) * 2);
    }
    this.updateMortarMarker(p);
    // rigs
    this.effects.thermal = p.thermal.on;
    for (const a of this.actors) if (a !== p) this.updateRig(a, dt);
    // viewmodel
    if (p.alive) this.vm.update(dt, p, this.look, { time: this.time });
    this.effects.update(dt, this.combat.bullets);
    this.hud.update(dt);
    // draw
    this.renderer.clear();
    this.renderer.render(this.scene, cam);
    if (p.alive && this.vm.visible && !this.noclip) this.vm.render(this.renderer);
  }

  // shooter-only landing marker for the mortar (enemies get no warning)
  updateMortarMarker(p) {
    const def = p.ws?.def; const on = p.alive && def?.kind === 'mortar';
    if (!this.mortarMark) {
      const g = new THREE.Group(); g.userData.t = V();
      const mk = (op) => new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const flat = (geo, mat, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.set(-Math.PI / 2, 0, rz); m.renderOrder = 5; g.add(m); return m; };
      const hot = mk(0.9);
      g.userData.reticle = flat(new THREE.RingGeometry(1.35, 1.5, 40), hot);
      flat(new THREE.CircleGeometry(0.14, 16), hot);
      flat(new THREE.PlaneGeometry(0.08, 0.9), hot); flat(new THREE.PlaneGeometry(0.08, 0.9), hot, Math.PI / 2);
      g.userData.blast = flat(new THREE.RingGeometry(0.97, 1, 64), mk(0.28));
      g.visible = false; this.scene.add(g); this.mortarMark = g;
    }
    const g = this.mortarMark; g.visible = !!on; if (!on) return;
    const t = this.combat.mortarTarget(p, def, g.userData.t);
    g.position.set(t.x, t.y + 0.06, t.z);
    g.userData.reticle.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06);
    g.userData.blast.scale.setScalar(def.splash.radius);
    const ready = p.ws.mag > 0 && p.ws.reloading <= 0;
    g.userData.reticle.material.opacity = ready ? 0.9 : 0.3;
  }

  // callsign + health bar: teammates always, enemies only while in direct line of sight (no wallhacks)
  updatePlate(a, dt) {
    const pl = a.plate; if (!pl) return;
    const p = this.player; const d = a.pos.distanceTo(this.camera.position);
    const ally = !this.hostile(p, a);
    a.plateT = (a.plateT || 0) - dt;
    if (a.plateT <= 0) { a.plateT = 0.15 + Math.random() * 0.1; a.plateLos = this.map.world.lineOfSight(this.camera.position, a.headPos(_b).add(_a.set(0, 0.3, 0))) && !this.combat.inSmoke(this.camera.position, a.chest(_b)); }
    pl.visible = a.alive && d < (ally ? 80 : 55) && (ally || a.plateLos || p.thermal.on && a.plateLos !== false);
    if (!pl.visible) return;
    const col = a.isTarget ? '#ffd08a' : ally ? '#7fc4ff' : a.team === 'blue' ? '#7fb0ff' : a.team === 'red' ? '#ff8a7a' : '#ffb070';
    drawPlate(pl, a.name, a.hp, a.armor, a.maxHp, col, a.ultra && a.ultraFrom, a.isBot ? a.tier : null);
    const k = Math.max(1, d / 14); pl.scale.set(1.15 * k, 0.36 * k, 1);
  }
  updateRig(a, dt) {
    if (!a.rig) { a.rig = a.isTarget ? buildTarget() : buildSoldier(a.team, a.botIndex ?? 0); this.scene.add(a.rig); a.rigWeapon = null; a.plate = makePlate(); a.plate.position.y = a.isTarget ? 2.15 : 2.2; a.rig.add(a.plate); }
    const rig = a.rig;
    this.updatePlate(a, dt);
    if (a.isTarget) {
      if (!a.alive) { a.deathT = (a.deathT || 0) + dt; rig.rotation.x = Math.max(-Math.PI / 2, -a.deathT * 6); return; }
      rig.visible = true; rig.position.copy(a.pos); rig.rotation.set(0, Math.atan2(this.player.pos.x - a.pos.x, this.player.pos.z - a.pos.z) + Math.PI, 0);
      return;
    }
    const wid = a.loadout[a.slot];
    if (a.rigWeapon !== wid) { attachWeapon(rig, wid, a.skins?.[wid]); a.rigWeapon = wid; a.rigThermal = null; }
    if (!a.alive) {
      a.deathT = (a.deathT || 0) + dt;
      rig.rotation.x = Math.max(-Math.PI / 2, -a.deathT * 5) ; rig.position.y = a.pos.y + Math.min(0.25, a.deathT);
      if (a.deathT > 3) rig.visible = false;
      return;
    }
    rig.visible = true; rig.position.copy(a.pos); rig.rotation.set(0, a.yaw, 0);
    const spd = a.isRemote || !this.owns(a) ? (a.netSpeed || 0) : Math.hypot(a.vel.x, a.vel.z);
    a.animPhase += dt * spd * 1.6;
    const wh = rig.userData.wheel; if (wh && a.ws) { const fired = Math.max(0, a.ws.def.mag - a.ws.mag); wh.rotation.z = -fired * Math.PI / 3; }
    poseSoldier(rig, { speed: spd, phase: a.animPhase, aimPitch: a.pitch, swing: a.ws?.swing || 0, firing: this.time - (a.lastShotT ?? -9) < 0.15 });
    // thermal highlight (enemies only, through smoke; walls still occlude)
    const hot = this.player.thermal.on && this.hostile(this.player, a);
    if (a.rigThermal !== hot) {
      rig.traverse((o) => { if (o.isMesh) { if (hot) { o.userData.orig = o.userData.orig || o.material; o.material = o.userData.orig.emissive && o.userData.orig === rig.userData.mats?.teamMat ? this.thermalHiMat : this.thermalMat; } else if (o.userData.orig) o.material = o.userData.orig; } });
      a.rigThermal = hot; a.thermalHighlighted = hot;
    }
    rig.userData.mats.visor.emissiveIntensity = a.spawnProtect > 0 ? 3 : 1;
  }

  // ═════════════════ inspect studio (DEV.inspectGun) ═════════════════
  inspect(id, opts = {}) {
    if (!this.studio) {
      const s = new THREE.Scene(); s.environment = this.envTex; s.environmentIntensity = 0.55;
      const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a3340'); gr.addColorStop(0.6, '#12161c'); gr.addColorStop(1, '#07090c'); x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
      const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; s.background = bg;
      s.add(new THREE.HemisphereLight(0xdfe8ff, 0x302820, 1.0));
      const key = new THREE.DirectionalLight(0xfff2e0, 3.2); key.position.set(2.5, 3, 2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const kc = key.shadow.camera; kc.left = kc.bottom = -1.5; kc.right = kc.top = 1.5; s.add(key);
      const rim = new THREE.DirectionalLight(0x88b0ff, 2.2); rim.position.set(-3, 1.5, -2.5); s.add(rim);
      const fill = new THREE.DirectionalLight(0xffc8a0, 0.8); fill.position.set(-2, -1, 3); s.add(fill);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.75, metalness: 0.2 })); floor.receiveShadow = true; s.add(floor);
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.36, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); ring.position.y = 0.002; s.add(ring);
      const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.01, 50);
      this.studio = { scene: s, cam, holder: new THREE.Group(), floor }; s.add(this.studio.holder);
    }
    const st = this.studio; st.holder.clear();
    const item = buildItem(id, { skin: opts.skin || null, holiday: opts.holiday });
    const MELEE = ['knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer'];
    const g = new THREE.Group(); g.add(item);
    if (MELEE.includes(id)) item.rotation.set(0, 0, -Math.PI / 2 + 0.12);
    if (id === 'slippers') item.rotation.set(0.9, 0.5, 0);
    if (id === 'fists' || id === 'tactical_gloves') item.rotation.set(0.2, Math.PI * 0.85, 0);
    if (['blast_vest', 'thermal_goggles', 'spring_boots', 'medkit', 'ammo_pack', 'barricade', 'bandolier'].includes(id)) item.rotation.y = Math.PI * 0.85;
    st.holder.add(g);
    const box = new THREE.Box3().setFromObject(g); const size = box.getSize(V()); const c = box.getCenter(V());
    g.position.set(-c.x, -box.min.y + 0.05 + Math.max(0, 0.3 - size.y) * 0.5, -c.z);
    if (!MELEE.includes(id) && size.y < 0.6) g.position.y += 0.25;
    const need = Math.max(size.y, Math.max(size.x, size.z) / 1.6) * 1.12; st.radius = need / (2 * Math.tan(THREE.MathUtils.degToRad(16))) + 0.12; st.center = V(0, (size.y / 2) + g.position.y - (-box.min.y) * 0 , 0);
    st.center.y = g.position.y + (box.max.y + box.min.y) / 2 - box.min.y + box.min.y; // center height after shift
    st.center.y = g.position.y + (box.min.y + box.max.y) / 2;
    st.angle = opts.angle ?? 0.6; st.elev = opts.elev ?? 0.32; st.auto = opts.auto !== false; st.id = id;
    st.label = WEAPON_BY_ID[id]?.name || id;
    this.prevState = this.state === 'inspect' ? this.prevState : this.state; this.state = 'inspect';
    this.hud.show(false); this.ui?.showInspect(st.label, WEAPON_BY_ID[id]);
    this.renderStudio(0);
    return { size: size.toArray(), name: st.label };
  }
  renderStudio(dt) {
    const st = this.studio; if (!st) return;
    if (st.auto) st.angle += dt * 0.35;
    const r = st.radius; st.cam.position.set(Math.sin(st.angle) * r * Math.cos(st.elev), st.center.y + Math.sin(st.elev) * r, Math.cos(st.angle) * r * Math.cos(st.elev));
    st.cam.lookAt(0, st.center.y, 0);
    this.renderer.clear(); this.renderer.render(st.scene, st.cam);
  }
  exitInspect(resume) {
    if (this.state !== 'inspect') return;
    this.state = this.prevState === 'inspect' ? 'menu' : (this.prevState || 'menu'); this.ui?.showInspect(null);
    if (this.state === 'playing') this.hud.show(true);
    if (resume && this.state === 'menu') this.ui?.showMenu();
  }

  endMatchCleanup() { gameplay.stop(); }
}

export { RADIUS, teamColor };
