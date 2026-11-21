// Actor = any combatant (local player, bot, remote human). Holds stats, loadout, weapon states, effects.
import * as THREE from 'three';
import { WEAPON_BY_ID, BASE_HP, MAX_ARMOR, BASE_SPEED, GRAVITY, JUMP_IMPULSE, CLIMB_SPEED, SPEED_MIN, SPEED_MAX, SPEED_ABILITY_MAX } from '../data/weapons.js';

export const RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;
// slide: a kick of speed on entry, then ground friction bleeds it off until you stand back up
export const SLIDE = { boost: 5, min: 11, max: 13, friction: 9.5, stop: 3.2, time: 1.6, cooldown: 0.7, drop: 0.75 };

export class WeaponState {
  constructor(def, mods) {
    this.def = def; this.id = def.id;
    const shellBonus = ['rocket_launcher', 'mortar'].includes(def.base || def.id) ? (mods.shells || 0) : 0;
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
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.pull = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.onGround = true;
    this.hp = BASE_HP; this.armor = 0; this.alive = true; this.respawnT = 0; this.spawnProtect = 0;
    this.loadout = {}; this.weapons = {}; this.slot = 1; this.prevSlot = 1; this.drawT = 0; this.mods = {};
    this.fx = { burn: null, bleed: [], stun: 0, flash: 0, adrenaline: 0, scythe: 0, scytheCd: 0, emotional: 0, chill: 0, chillSlow: 0, frost: 0, frozen: 0 };
    this.jumpsLeft = 0; this.climbing = false;
    this.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, headshots: 0, meleeKills: 0, explosiveKills: 0, emotional: 0, throws: 0, score: 0 };
    this.thermal = { on: false, battery: 8 };
    this.skins = {}; this.rig = null; this.animPhase = 0; this.lastAttacker = null; this.lastHurt = 0;
    this.ads = false; this.recoil = 0; this.bloom = 0;
    this.grapple = null; this.grappleCd = 0; this.slideT = 0; this.slideCd = 0; this.slideDir = new THREE.Vector3(); this.low = 0;
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
    if (this.fx.chill > 0) m *= 1 - (this.fx.chillSlow || 0.5);
    return m;
  }
  reloadMult() { return 1 + (this.mods.reload || 0) + (this.fx.adrenaline > 0 ? 0.25 : 0); }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + EYE - this.low * SLIDE.drop, this.pos.z); }
  aimDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.2 - this.low * 0.6, this.pos.z); }
  headPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.62 - this.low * SLIDE.drop, this.pos.z); }
  bodyTop() { return 1.48 - this.low * 0.7; }

  // C: slide. Entry boost, low (smaller hitbox), then friction slows you down; keeps momentum into a jump.
  trySlide(wish) {
    if (!this.onGround || this.slideT > 0 || this.slideCd > 0 || this.grapple || this.fx.stun > 0 || this.climbing) return false;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 1.5) this.slideDir.set(this.vel.x / hs, 0, this.vel.z / hs);
    else if (wish && wish.lengthSq() > 0.01) this.slideDir.copy(wish).setY(0).normalize();
    else return false;
    this.slideT = SLIDE.time; this.slideCd = 0;
    const sp = Math.min(SLIDE.max, Math.max(SLIDE.min, hs + SLIDE.boost)); this.vel.x = this.slideDir.x * sp; this.vel.z = this.slideDir.z * sp; this.slideSpeed = sp;
    return true;
  }
  releaseGrapple(pop = false) {
    if (!this.grapple) return;
    if (this.grapple.actor && !pop) { this.vel.x *= 0.12; this.vel.z *= 0.12; this.vel.y = Math.min(this.vel.y, 2); }   // stop in their face
    if (pop) this.vel.y = Math.max(this.vel.y, JUMP_IMPULSE * 0.95);
    else if (this.grapple.to.y > this.pos.y + 0.6) this.vel.y = Math.max(this.vel.y, 4.5);   // clear the lip of a roof
    this.grapple = null;
  }

  // ULTRA upgrade of the main firearm (lasts until death)
  activateUltra(ultraId) {
    if (this.ultra || !ultraId || !WEAPON_BY_ID[ultraId]) return false;
    this.ultra = true; this.ultraFrom = this.loadout[1];
    this.loadout = { ...this.loadout, 1: ultraId };
    this.weapons[1] = new WeaponState(WEAPON_BY_ID[ultraId], this.mods);
    if (this.slot === 1) this.drawT = 0.35;
    return true;
  }
  respawn(pos, yaw = 0) {
    if (this.ultra) { this.loadout = { ...this.loadout, 1: this.ultraFrom }; this.ultra = false; this.ultraFrom = null; }
    this.aliveSince = null;
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0;
    this.hp = BASE_HP; this.armor = 0; this.alive = true; this.spawnProtect = 1.5;
    this.fx = { burn: null, bleed: [], stun: 0, flash: 0, adrenaline: 0, scythe: 0, scytheCd: 0, emotional: 0, chill: 0, chillSlow: 0, frost: 0, frozen: 0 };
    this.setLoadout(this.loadout, this.skins);
    this.slot = this.weapons[this.prevSpawnSlot || 1] ? (this.prevSpawnSlot || 1) : 1;
    this.thermal = { on: false, battery: 8 };
    this.grapple = null; this.grappleCd = 0; this.slideT = 0; this.slideCd = 0; this.low = 0;
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
  // climbDir: horizontal direction the actor is pushing toward a climbable (null = not trying)
  move(dt, world, wish, jumpPressed, climbDir) {
    const speed = BASE_SPEED * this.speedMult();
    const v = this.vel;
    if (this.slideCd > 0) this.slideCd -= dt;
    if (this.grappleCd > 0) this.grappleCd -= dt;
    const g = this.grapple;
    let grappling = false;
    if (g) {
      g.t += dt;
      if (g.actor) { if (!g.actor.alive) this.grapple = null; else g.to.set(g.actor.pos.x, g.actor.pos.y + 1.0, g.actor.pos.z); }
      if (this.grapple && g.t >= g.fly) {
        const dx = g.to.x - this.pos.x, dy = g.to.y - (this.pos.y + 0.9), dz = g.to.z - this.pos.z; const dist = Math.hypot(dx, dy, dz);
        const closing = dist < (g.lastD ?? Infinity) - 0.02; g.lastD = dist; g.stall = closing ? 0 : (g.stall || 0) + dt;
        if (dist < (g.actor ? 1.7 : 1.1) || g.t > g.fly + g.cfg.time || g.stall > 0.3 || this.fx.stun > 0) this.releaseGrapple(false);
        else if (jumpPressed) { this.releaseGrapple(true); jumpPressed = false; this.jumpsLeft = this.mods.doubleJump || 0; }
        else {
          grappling = true; this.slideT = 0;
          const s = g.cfg.speed / dist; const ex = dx * s - v.x, ey = dy * s - v.y, ez = dz * s - v.z; const el = Math.hypot(ex, ey, ez); const md = g.cfg.accel * dt;
          const k = el <= md ? 1 : md / el; v.x += ex * k; v.y += ey * k; v.z += ez * k;
          // a little air control lets you swing around corners
          v.x += wish.x * 6 * dt; v.z += wish.z * 6 * dt;
          this.onGround = false; this.jumped = 1;
        }
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (wish.lengthSq() > 0.01) { this.slideDir.x += wish.x * dt * 0.9; this.slideDir.z += wish.z * dt * 0.9; this.slideDir.normalize(); }   // only slight steering
      if (this.onGround) {
        const sp = this.slideSpeed = Math.max(0, Math.min(this.slideSpeed ?? SLIDE.min, Math.hypot(v.x, v.z) + 0.5) - SLIDE.friction * dt);   // friction (walls/impacts also cut it)
        v.x = this.slideDir.x * sp; v.z = this.slideDir.z * sp;
        if (sp < SLIDE.stop) this.slideT = 0;   // ran out of speed: get up
      }
      if (jumpPressed || this.fx.stun > 0) this.slideT = 0;   // slide-jump: momentum carries into the air
    } else if (!grappling) {
      // air: don't bleed off speed you already have (slide-jumps / grapple flings keep their momentum)
      const hs = Math.hypot(v.x, v.z); const cap = this.onGround ? speed : Math.max(speed, hs);
      const accel = this.onGround ? 80 : 14;
      let tx = wish.x * speed, tz = wish.z * speed;
      if (!this.onGround && hs > speed && wish.lengthSq() > 0.01) { tx = wish.x * cap; tz = wish.z * cap; }
      if (!this.onGround && wish.lengthSq() < 0.01) { tx = v.x * Math.max(0, 1 - dt * 0.6); tz = v.z * Math.max(0, 1 - dt * 0.6); }
      const dx = tx - v.x, dz = tz - v.z; const dl = Math.hypot(dx, dz); const maxd = accel * dt;
      if (dl <= maxd) { v.x = tx; v.z = tz; } else { v.x += (dx / dl) * maxd; v.z += (dz / dl) * maxd; }
    }
    if (this.slideT <= 0 && this.wasSliding) this.slideCd = SLIDE.cooldown;   // cooldown starts when you stand up
    this.wasSliding = this.slideT > 0;
    this.low += ((this.slideT > 0 ? 1 : 0) - this.low) * Math.min(1, dt * 14);
    // climbing: anyone can use ladders/vines/rungs; Fists can scale any wall
    const wasClimbing = this.climbing; this.climbing = false;
    if (climbDir && climbDir.lengthSq() > 0.01 && this.fx.stun <= 0 && !grappling) {
      const c = world.climbableNear(this.pos, RADIUS, HEIGHT, climbDir, !!this.held?.climb, wasClimbing);
      if (c) { this.climbing = true; v.y = CLIMB_SPEED; this.jumpsLeft = this.mods.doubleJump || 0; this.climbBox = c; }
    }
    if (wasClimbing && !this.climbing && v.y > 2.2) v.y = 2.2;   // topped out: small pop over the lip instead of a launch
    if (jumpPressed && this.fx.stun <= 0) {
      if (this.onGround) { v.y = JUMP_IMPULSE; this.onGround = false; this.jumpsLeft = this.mods.doubleJump || 0; this.jumped = 1; }
      else if (this.jumpsLeft > 0) { v.y = JUMP_IMPULSE; this.jumpsLeft--; this.jumped = 2; }
    }
    // exact parabolic step (peak height = v²/2g, independent of frame rate)
    const ay = this.climbing || grappling ? 0 : GRAVITY;
    this.pos.x += (v.x + this.pull.x) * dt; this.pos.z += (v.z + this.pull.z) * dt;   // pull: external drift (black holes)
    if (this.pull.y > 0 && !this.onGround) this.pos.y += this.pull.y * dt;
    this.pull.set(0, 0, 0);
    this.pos.y += v.y * dt + 0.5 * ay * dt * dt;
    v.y += ay * dt;
    const wasGround = this.onGround;
    const r = world.resolve(this.pos, v, RADIUS, HEIGHT);
    // stick to slopes / stairs when walking down instead of hopping off every bump
    if (!r.onGround && wasGround && v.y <= 0 && !this.climbing && !this.jumped) {
      const gh = world.groundHeightAt(this.pos.x, this.pos.z, this.pos.y + 0.05);
      if (this.pos.y - gh < 0.32) { this.pos.y = gh; v.y = 0; r.onGround = true; }
    }
    this.jumped = 0;
    const wasAir = !this.onGround;
    this.onGround = r.onGround;
    if (this.onGround) { this.jumpsLeft = this.mods.doubleJump || 0; if (wasAir) this.landed = true; }
    if (this.pos.y < -5) { this.pos.y = world.groundY(this.pos.x, this.pos.z); v.y = 0; }
    return r;
  }
}
