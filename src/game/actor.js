// Actor = any combatant (local player, bot, remote human). Holds stats, loadout, weapon states, effects.
import * as THREE from 'three';
import { WEAPON_BY_ID, BASE_HP, MAX_ARMOR, BASE_SPEED, GRAVITY, JUMP_IMPULSE, CLIMB_SPEED, SPEED_MIN, SPEED_MAX, SPEED_ABILITY_MAX } from '../data/weapons.js';

export const RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;

export class WeaponState {
  constructor(def, mods) {
    this.def = def; this.id = def.id;
    const shellBonus = ['rocket_launcher', 'mortar'].includes(def.id) ? (mods.shells || 0) : 0;
    this.mag = def.mag ?? 0;
    this.reserveMax = def.reserve === Infinity ? Infinity : Math.round((def.reserve ?? 0) * (1 + (mods.reserve || 0))) + shellBonus;
    this.reserve = this.reserveMax;
    this.count = def.carry ? def.carry + (mods.throwables || 0) : 0;
    this.cooldown = 0; this.reloading = 0; this.reloadTotal = 0; this.burstLeft = 0; this.burstTimer = 0;
    this.regen = 0; this.recharge = 0; this.cook = -1; this.useT = -1; this.usableCd = 0; this.swing = 0; this.swingHit = false; this.charges = 1;
  }
}

let ACTOR_SEQ = 0;
export class Actor {
  constructor({ id, name, team = 'ffa', isBot = false, isLocal = false }) {
    this.uid = ++ACTOR_SEQ;
    this.id = id; this.name = name; this.team = team; this.isBot = isBot; this.isLocal = isLocal; this.isRemote = false;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.onGround = true;
    this.hp = BASE_HP; this.armor = 0; this.alive = true; this.respawnT = 0; this.spawnProtect = 0;
    this.loadout = {}; this.weapons = {}; this.slot = 1; this.prevSlot = 1; this.drawT = 0; this.mods = {};
    this.fx = { burn: null, bleed: [], stun: 0, flash: 0, adrenaline: 0, scythe: 0, scytheCd: 0, emotional: 0 };
    this.jumpsLeft = 0; this.climbing = false;
    this.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, headshots: 0, meleeKills: 0, explosiveKills: 0, emotional: 0, throws: 0, score: 0 };
    this.thermal = { on: false, battery: 8 };
    this.skins = {}; this.rig = null; this.animPhase = 0; this.lastAttacker = null; this.lastHurt = 0;
    this.ads = false; this.recoil = 0; this.bloom = 0;
  }

  setLoadout(loadout, skins = {}) {
    this.loadout = { ...loadout }; this.skins = skins;
    const wear = loadout[6] ? WEAPON_BY_ID[loadout[6]] : null;
    this.mods = { ...(wear?.mods || {}) };
    this.weapons = {};
    for (let s = 1; s <= 5; s++) if (loadout[s]) this.weapons[s] = new WeaponState(WEAPON_BY_ID[loadout[s]], this.mods);
    if (!this.weapons[this.slot]) this.slot = 1;
  }
  get ws() { return this.weapons[this.slot]; }
  get held() { return this.weapons[this.slot]?.def; }
  get maxHp() { return BASE_HP; }
  hasWear(id) { return this.loadout[6] === id; }

  speedMult() {
    const w = this.held; const base = w?.speed ?? 1;
    let passive = (this.mods.speed || 0) + (this.fx.adrenaline > 0 ? 0.2 : 0);
    let m = THREE.MathUtils.clamp(base + passive, SPEED_MIN, SPEED_MAX);
    if (this.fx.scythe > 0 && w?.id === 'scythe') m = Math.min(SPEED_ABILITY_MAX, base + passive + w.ability.boost);
    if (this.fx.stun > 0) m *= 0.35;
    return m;
  }
  reloadMult() { return 1 + (this.mods.reload || 0) + (this.fx.adrenaline > 0 ? 0.25 : 0); }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + EYE, this.pos.z); }
  aimDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.2, this.pos.z); }
  headPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.62, this.pos.z); }

  respawn(pos, yaw = 0) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0;
    this.hp = BASE_HP; this.armor = 0; this.alive = true; this.spawnProtect = 1.5;
    this.fx = { burn: null, bleed: [], stun: 0, flash: 0, adrenaline: 0, scythe: 0, scytheCd: 0, emotional: 0 };
    this.setLoadout(this.loadout, this.skins);
    this.slot = this.weapons[this.prevSpawnSlot || 1] ? (this.prevSpawnSlot || 1) : 1;
    this.thermal = { on: false, battery: 8 };
  }

  switchSlot(s) {
    if (s === this.slot || !this.weapons[s] || this.fx.stun > 0) return false;
    const ws = this.ws; if (ws) { ws.reloading = 0; ws.burstLeft = 0; ws.cook = -1; ws.useT = -1; }
    this.prevSlot = this.slot; this.slot = s;
    const def = this.weapons[s].def;
    let draw = def.draw ?? (def.kind === 'melee' ? 0.3 : def.slot === 1 ? 0.45 : 0.35);
    draw /= (1 + (this.mods.draw || 0)); draw /= Math.max(0.5, 1 + (this.mods.swap || 0));
    this.drawT = draw; this.ads = false;
    return true;
  }

  // Shared movement physics. wish = desired horizontal direction (unit or zero, world space).
  move(dt, world, wish, jumpPressed, climbIntent) {
    const speed = BASE_SPEED * this.speedMult();
    const v = this.vel;
    const accel = this.onGround ? 80 : 14;
    const tx = wish.x * speed, tz = wish.z * speed;
    const dx = tx - v.x, dz = tz - v.z; const dl = Math.hypot(dx, dz); const maxd = accel * dt;
    if (dl <= maxd) { v.x = tx; v.z = tz; } else { v.x += (dx / dl) * maxd; v.z += (dz / dl) * maxd; }
    // climbing (Fists only)
    this.climbing = false;
    if (climbIntent && this.held?.climb) {
      const f = this.forward(new THREE.Vector3());
      const c = world.climbableNear(this.pos, RADIUS, HEIGHT, f);
      if (c) { this.climbing = true; v.y = CLIMB_SPEED; this.jumpsLeft = this.mods.doubleJump || 0; this.climbBox = c; }
    }
    if (jumpPressed && this.fx.stun <= 0) {
      if (this.onGround) { v.y = JUMP_IMPULSE; this.onGround = false; this.jumpsLeft = this.mods.doubleJump || 0; this.jumped = 1; }
      else if (this.jumpsLeft > 0) { v.y = JUMP_IMPULSE; this.jumpsLeft--; this.jumped = 2; }
    }
    // exact parabolic step (peak height = v²/2g, independent of frame rate)
    const ay = this.climbing ? 0 : GRAVITY;
    this.pos.x += v.x * dt; this.pos.z += v.z * dt;
    this.pos.y += v.y * dt + 0.5 * ay * dt * dt;
    v.y += ay * dt;
    const r = world.resolve(this.pos, v, RADIUS, HEIGHT);
    const wasAir = !this.onGround;
    this.onGround = r.onGround;
    if (this.onGround) { this.jumpsLeft = this.mods.doubleJump || 0; if (wasAir) this.landed = true; }
    if (this.pos.y < -5) { this.pos.y = 0; v.y = 0; }
    return r;
  }
}
