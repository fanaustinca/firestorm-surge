// Combat simulation: per-actor weapon logic, stepped-raycast bullets (zero tunneling),
// projectiles, explosions, smoke clouds, fire pools, flashbangs, barricades, usables.
import * as THREE from 'three';
import { rayCylinder, raySphere, rayBox } from '../world/collision.js';
import { RADIUS } from './actor.js';
import { projectileMesh } from '../render/models.js';
import { barricadeMesh } from '../render/gearModels.js';
import { mats } from '../render/models.js';
import { sfx } from '../core/audio.js';
import { WEAPON_BY_ID, BASE_HP, MAX_ARMOR } from '../data/weapons.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = V(), _b = V(), _c = V(), _d = V();
const UP = new THREE.Vector3(0, 1, 0);

const SHOT_SOUND = {
  assault_rifle: 'rifle', ak47: 'rifle', burst_rifle: 'rifle', lmg: 'rifle', dmr: 'heavy', heavy_sniper: 'heavy',
  pistol: 'pistol', burst_pistol: 'pistol', revolver: 'heavy', smg: 'smg', sawed_off: 'shotgun', tactical_shotgun: 'shotgun',
  rocket_launcher: 'launcher', grenade_launcher: 'launcher', mortar: 'mortar', crossbow: 'bow', shurikens: 'throw', slippers: 'throw',
};
const TRACER_COLOR = { heavy_sniper: 0xff9a50, dmr: 0xffb070, lmg: 0xffd070, taser: 0x80e0ff };

const bid = (d) => d.base || d.id;

function jitter(dir, amount) {
  if (amount <= 0) return dir;
  const r = amount * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
  const t1 = Math.abs(dir.y) < 0.95 ? V().crossVectors(dir, UP).normalize() : V().set(1, 0, 0);
  const t2 = V().crossVectors(dir, t1).normalize();
  return dir.clone().addScaledVector(t1, Math.cos(th) * r).addScaledVector(t2, Math.sin(th) * r).normalize();
}

export class Combat {
  constructor(game) { this.g = game; this.reset(); }
  reset() {
    for (const p of this.projs || []) if (p.mesh) this.g.scene.remove(p.mesh);
    for (const b of this.barricades || []) this.removeBarricade(b, true);
    this.bullets = []; this.projs = []; this.clouds = []; this.fires = []; this.barricades = []; this.seq = 1; this.shotCount = 0;
  }
  get world() { return this.g.map.world; }
  enemiesOf(a) { return this.g.actors.filter((t) => t !== a && t.alive && this.g.hostile(a, t)); }

  // ═════════════════ per-actor weapon tick ═════════════════
  tick(a, it, dt) {
    // passive timers on every slot
    for (const s in a.weapons) {
      const ws = a.weapons[s], d = ws.def;
      if (d.regen && ws.mag < d.mag) { ws.regen += dt; if (ws.regen >= d.regen) { ws.regen = 0; ws.mag++; } }
      if ((d.cooldown && d.kind === 'projectile') || d.recharge) { if (ws.mag === 0 && ws.recharge > 0) { ws.recharge -= dt; if (ws.recharge <= 0) ws.mag = 1; } }
      if (ws.usableCd > 0) ws.usableCd = Math.max(0, ws.usableCd - dt);
    }
    if (a.fx.scytheCd > 0) a.fx.scytheCd -= dt;
    const ws = a.ws; if (!ws) return;
    const d = ws.def;
    ws.cooldown -= dt;
    if (ws.pendingHit > 0) { ws.pendingHit -= dt; if (ws.pendingHit <= 0) this.meleeHit(a, ws); }
    if (ws.swing > 0) ws.swing = Math.min(1, ws.swing + dt / Math.min(0.5, d.interval * 0.8));
    if (ws.swing >= 1) ws.swing = 0;
    a.ads = !!it.alt && !['melee', 'throwable', 'usable'].includes(d.kind) && d.id !== 'sticky_bomb' && a.drawT <= 0;
    if (a.drawT > 0) { a.drawT -= dt; return; }
    if (a.fx.stun > 0) { ws.cook = -1; return; }

    // reload progress
    if (ws.reloading > 0) {
      if (d.perShell && it.firePressed && ws.mag > 0) ws.reloading = 0; // pump shotgun: fire interrupts
      else {
        ws.reloading -= dt * a.reloadMult();
        if (ws.reloading <= 0) {
          if (d.perShell) {
            ws.mag++; ws.reserve--; if (a === this.g.player) sfx.reload(1);
            if (ws.mag < d.mag && ws.reserve > 0) ws.reloading = d.reload; else ws.reloading = 0;
          } else { const need = d.mag - ws.mag; const take = Math.min(need, ws.reserve); ws.mag += take; if (ws.reserve !== Infinity) ws.reserve -= take; ws.reloading = 0; if (a === this.g.player) sfx.reload(2); }
          if (['rocket_launcher', 'mortar', 'crossbow'].includes(bid(d))) this.g.onRoundLoaded?.(a);
        }
        return;
      }
    }
    if (it.reload) this.startReload(a, ws);

    switch (d.kind) {
      case 'bullet': case 'pellet': case 'projectile': case 'mortar': this.tickGun(a, ws, it, dt); break;
      case 'flame': this.tickFlame(a, ws, it); break;
      case 'melee': this.tickMelee(a, ws, it); break;
      case 'throwable': this.tickThrowable(a, ws, it, dt); break;
      case 'taser': this.tickTaser(a, ws, it); break;
      case 'usable': this.tickUsable(a, ws, it, dt); break;
    }
  }

  startReload(a, ws) {
    const d = ws.def;
    if (d.recharge || d.regen || (d.cooldown && d.kind === 'projectile') || !d.mag) return false;
    if (ws.mag >= d.mag || ws.reserve <= 0 || ws.reloading > 0) return false;
    ws.reloading = d.reload; ws.reloadTotal = d.perShell ? d.reload * (d.mag - ws.mag) : d.reload; ws.burstLeft = 0;
    if (a === this.g.player) sfx.reload(0);
    return true;
  }

  canTrigger(ws, it) {
    const d = ws.def;
    if (d.mode === 'auto') return it.fire;
    return it.firePressed;
  }

  tickGun(a, ws, it, dt) {
    const d = ws.def;
    if (d.mode === 'burst') {
      if (ws.burstLeft > 0) {
        ws.burstTimer -= dt;
        if (ws.burstTimer <= 0 && ws.mag > 0) { this.shoot(a, ws); ws.burstLeft--; ws.burstTimer = d.interval; if (ws.burstLeft === 0 || ws.mag === 0) { ws.burstLeft = 0; ws.cooldown = d.burstDelay; } }
        return;
      }
      if (it.fire && ws.cooldown <= 0) {
        if (ws.mag <= 0) { if (!this.startReload(a, ws) && a === this.g.player && it.firePressed) sfx.empty(); return; }
        ws.burstLeft = d.burst; ws.burstTimer = 0; return this.tickGun(a, ws, { ...it, fire: false }, 0);
      }
      return;
    }
    if (!this.canTrigger(ws, it) || ws.cooldown > 0) return;
    if (ws.mag <= 0) {
      if (d.cooldown && d.kind === 'projectile') return; // slippers recharging
      if (d.regen) return;
      if (!this.startReload(a, ws) && a === this.g.player && it.firePressed) sfx.empty();
      return;
    }
    if (d.kind === 'mortar') return this.fireMortar(a, ws);
    this.shoot(a, ws);
    ws.cooldown = d.interval;
  }

  shoot(a, ws) {
    const d = ws.def; ws.mag--; this.shotCount++;
    const eye = a.eye(V()); const aim = a.aimDir(V());
    const moving = Math.hypot(a.vel.x, a.vel.z) > 1;
    const spread = ((d.spread || 0) * (a.ads ? 0.3 : 1) * (moving ? 1.5 : 1) * (a.onGround ? 1 : 1.8)) + a.bloom;
    a.bloom = Math.min(0.03, a.bloom + (d.spread || 0) * 0.25);
    a.recoil += d.recoil || 0;
    const muzzle = this.g.muzzleWorld(a, V());
    if (d.kind === 'projectile') {
      const kind = d.proj; let speed = d.vel; const dir = jitter(aim, d.id === 'slippers' ? 0.004 : 0.002);
      const vel = dir.multiplyScalar(speed);
      if (kind === 'gl_shell') vel.y += 3.0;
      if (kind === 'slipper') vel.y += 2.5;
      if (kind === 'slipper' || kind === 'shuriken') vel.multiplyScalar(1 + (a.mods.throw || 0) * 0.5);
      this.spawnProj(a, d, kind, eye.clone().addScaledVector(aim, 0.4), vel, { visFrom: muzzle });
      if (d.cooldown && d.kind === 'projectile') ws.recharge = d.cooldown;
    } else {
      const n = d.pellets || 1;
      for (let i = 0; i < n; i++) this.addBullet(a, d, eye, jitter(aim, d.kind === 'pellet' ? d.spread : spread), muzzle);
    }
    this.g.onFired(a, d, muzzle, aim);
    if (d.emptyPing && ws.mag === 0 && a === this.g.player) setTimeout(() => sfx.ping(), 60);
    const snd = SHOT_SOUND[bid(d)];
    if (snd && !d.silent) sfx.shot(snd, a === this.g.player ? null : a.chest(V()), a === this.g.player ? 0.9 : 1);
    else if (d.silent) sfx.shot('bow', a === this.g.player ? null : a.chest(V()), 0.4);
    if (ws.mag === 0 && ws.reserve > 0 && !d.regen && !(d.cooldown && d.kind === 'projectile') && d.mode !== 'burst') {
      // auto-reload after the last round (small delay so the shot reads)
      ws.cooldown = Math.max(ws.cooldown, d.interval);
      this.g.after(Math.max(0.08, d.interval), () => { if (a.ws === ws && ws.mag === 0) this.startReload(a, ws); });
    }
  }

  addBullet(a, d, origin, dir, muzzle, remote = false) {
    const b = { owner: a, def: d, pos: origin.clone(), dir: dir.clone(), speed: d.vel, range: d.range, traveled: 0, dmg: d.dmg, head: d.head, remote, visible: true, color: TRACER_COLOR[d.id] || 0xffd890, thin: false };
    b.visOff = muzzle ? muzzle.clone().sub(origin) : V();
    b.vis = origin.clone().add(b.visOff);
    // every bullet gets a (cheap, line-segment) tracer — LMGs draw thinner/shorter ones
    if (d.thinTracers) b.thin = true;
    this.bullets.push(b);
    return b;
  }

  // ═════════════════ actor raycast ═════════════════
  rayActors(o, dir, maxT, shooter, opts = {}) {
    let best = null;
    for (const t of this.g.actors) {
      if (!t.alive || t === shooter || opts.skip?.has(t)) continue;
      if (shooter && !this.g.hostile(shooter, t)) continue;
      // broad phase
      _c.set(t.pos.x - o.x, 0, t.pos.z - o.z);
      const along = _c.x * dir.x + _c.z * dir.z;
      if (along < -1 || along > maxT + 1.5) continue;
      const head = raySphere(o, dir, t.headPos(_d), opts.headR || 0.17);
      const body = rayCylinder(o, dir, t.pos, opts.bodyR || 0.36, 0, 1.48);
      let tt = null, isHead = false;
      if (head !== null && head <= maxT && (body === null || head <= body + 0.05)) { tt = head; isHead = true; }
      else if (body !== null && body <= maxT) tt = body;
      if (tt !== null && (!best || tt < best.t)) best = { actor: t, t: tt, head: isHead };
    }
    return best;
  }

  // ═════════════════ bullets ═════════════════
  updateBullets(dt) {
    const world = this.world;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let step = b.speed * dt; const remain = b.range - b.traveled;
      let dead = false;
      if (step >= remain) { step = remain; dead = true; }
      const wh = world.raycast(b.pos, b.dir, step, (x) => !x.noCollide);
      const ah = b.remote ? null : this.rayActors(b.pos, b.dir, wh ? wh.t : step, b.owner, b.hits ? { skip: b.hits } : {});
      if (ah && b.def.pierce) {            // railgun: damage everything along the line, keep flying
        const p = b.pos.clone().addScaledVector(b.dir, ah.t);
        (b.hits ||= new Set()).add(ah.actor);
        this.g.damage(ah.actor, ah.head ? b.head : b.dmg, { attacker: b.owner, weapon: b.def.id, head: ah.head, pos: p, dir: b.dir });
        this.g.effects.blood(p); i++; continue;      // re-run this bullet next tick from the same spot
      } else if (ah) {
        const p = b.pos.clone().addScaledVector(b.dir, ah.t);
        this.g.damage(ah.actor, ah.head ? b.head : b.dmg, { attacker: b.owner, weapon: b.def.id, head: ah.head, pos: p, dir: b.dir });
        this.g.effects.blood(p);
        dead = true; b.pos.copy(p);
      } else if (wh) {
        b.pos.copy(wh.point);
        if (wh.box?.kind === 'barricade' && !b.remote) this.damageBarricade(wh.box.ref, b.dmg);
        else if (wh.box?.kind === 'barricade') { /* visual only */ }
        this.g.effects.sparks(wh.point, wh.normal, 5);
        if (b.owner === this.g.player || b.pos.distanceTo(this.g.camera.position) < 25) this.g.effects.dust(wh.point, wh.normal);
        dead = true;
      } else b.pos.addScaledVector(b.dir, step);
      b.traveled += step;
      const k = Math.max(0, 1 - b.traveled / 14);
      b.vis.copy(b.pos).addScaledVector(b.visOff, k);
      if (dead) { this.bullets.splice(i, 1); }
    }
  }

  // ═════════════════ projectiles ═════════════════
  spawnProj(owner, def, kind, pos, vel, opts = {}) {
    const p = { id: opts.id || `${owner.id}:${this.seq++}`, kind, def, owner, pos: pos.clone(), vel: vel.clone(), t: 0, fuse: opts.fuse ?? def.fuse ?? 99, remote: !!opts.remote, stuck: null, bounces: 0, target: opts.target || null };
    p.grav = { rocket: 0, bolt: -4, shuriken: -3, slipper: -12, gl_shell: -15, mortar_shell: -20 }[kind] ?? -20;
    p.mesh = projectileMesh(kind);
    p.mesh.position.copy(opts.visFrom || pos);
    p.visOff = opts.visFrom ? opts.visFrom.clone().sub(pos) : V();
    this.g.scene.add(p.mesh);
    this.projs.push(p);
    if (!p.remote) this.g.onProjectile?.(owner, p);
    return p;
  }

  updateProjs(dt) {
    const world = this.world;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; p.t += dt;
      let remove = false;
      if (p.stuck) {
        if (p.stuck.actor) { if (!p.stuck.actor.alive) p.stuck = { world: true }; else p.pos.copy(p.stuck.actor.pos).add(p.stuck.offset); }
        if (p.kind === 'sticky' && Math.floor(p.t * 6) !== Math.floor((p.t - dt) * 6)) sfx.beep(p.pos);
      } else {
        p.vel.y += p.grav * dt;
        if (p.kind === 'rocket') { this.g.effects.puff(p.pos, V().set(0, 0.3, 0), 0xb0b0b0, 0.6, 0.8, 0.45); this.g.effects.spawn(p.pos, V(), 0xffa040, 0.4, 0.06); }
        if (p.kind === 'mortar_shell' && Math.random() < 0.5) this.g.effects.puff(p.pos, V(), 0x999999, 0.4, 0.5, 0.3);
        const spd = p.vel.length(); const step = spd * dt;
        if (step > 1e-6) {
          const dir = _a.copy(p.vel).divideScalar(spd);
          const wh = world.raycast(p.pos, dir, step + 0.05);
          const ah = (p.remote || p.spent) ? null : this.rayActors(p.pos, dir, wh ? wh.t : step, p.owner, { bodyR: 0.42, headR: 0.2 });
          if (ah && !(p.kind === 'gl_shell' && p.t < 0.05)) {
            const hitPos = p.pos.clone().addScaledVector(dir, ah.t);
            remove = this.projHitActor(p, ah.actor, ah.head, hitPos, dir.clone());
            if (!remove) p.pos.addScaledVector(dir, step);
          } else if (wh) {
            const hp = wh.point.clone().addScaledVector(wh.normal, 0.03);
            remove = this.projHitWorld(p, hp, wh.normal, wh.box, dir.clone());
          } else p.pos.addScaledVector(p.vel, dt);
        }
      }
      // land mines: armed after a beat, triggered by an enemy stepping within range
      if (!remove && p.kind === 'mine' && p.landed && !p.remote && p.t >= p.armAt) {
        const cfg = p.def.mine;
        for (const t of this.g.actors) {
          if (!t.alive || !this.g.hostile(p.owner, t) || t.isTarget && false) continue;
          const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
          if (dx * dx + dz * dz < cfg.trigger * cfg.trigger && Math.abs(t.pos.y - p.pos.y) < 0.9) { sfx.beep(p.pos); this.explode(p, p.pos.clone(), null); remove = true; break; }
        }
        if (!remove && p.led) p.led.visible = Math.floor(p.t * 2) % 2 === 0;
      }
      // fuses
      if (!remove && p.t >= p.fuse && !p.remote) remove = this.detonate(p);
      if (!remove && p.t > (p.kind === 'mine' ? p.def.mine.life : 12)) remove = true;
      // slipper pickup
      if (!remove && p.kind === 'slipper' && p.landed && p.owner.alive && p.owner.pos.distanceTo(p.pos) < 1.4) {
        const ws = Object.values(p.owner.weapons).find((w) => w.id === 'slippers'); if (ws && ws.mag === 0) { ws.mag = 1; ws.recharge = 0; } remove = true;
      }
      if (remove) { this.g.scene.remove(p.mesh); this.projs.splice(i, 1); continue; }
      // visuals
      const k = Math.max(0, 1 - p.t / 0.15);
      p.mesh.position.copy(p.pos).addScaledVector(p.visOff, k);
      if (!p.stuck && !p.landed) {
        if (['rocket', 'bolt', 'mortar_shell', 'gl_shell'].includes(p.kind) && p.vel.lengthSq() > 1) p.mesh.quaternion.setFromUnitVectors(_b.set(0, 0, -1), _c.copy(p.vel).normalize());
        else if (p.kind === 'shuriken') p.mesh.rotation.y += dt * 30;
        else if (p.kind === 'slipper') { p.mesh.rotation.x += dt * 14; p.mesh.rotation.y += dt * 3; }
        else { p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 5; }
      }
      if (p.kind === 'molotov') this.g.effects.spawn(p.pos.clone().add(_a.set(0, 0.2, 0)), V().set(0, 1, 0), 0xff8020, 0.15, 0.15);
    }
  }

  projHitActor(p, t, head, pos, dir) {
    const d = p.def;
    switch (p.kind) {
      case 'rocket': case 'gl_shell': if (p.remote) return true; this.g.damage(t, d.dmg, { attacker: p.owner, weapon: d.id, head: false, pos, explosive: true, direct: true }); this.explode(p, pos, t); return true;
      case 'mortar_shell': if (p.remote) return true; this.explode(p, pos, null); return true;
      case 'bolt': case 'shuriken': case 'slipper':
        if (!p.remote) {
          this.g.damage(t, head ? d.head : d.dmg, { attacker: p.owner, weapon: d.id, head, pos, dir, emotional: d.emotional });
          if (d.bleed && t.alive) t.fx.bleed.push({ dps: d.bleed.total / d.bleed.time, t: d.bleed.time, owner: p.owner });
        }
        this.g.effects.blood(pos);
        if (p.kind === 'slipper') { sfx.slap(pos); p.spent = true; p.vel.set(-dir.x * 2, 3, -dir.z * 2); p.pos.copy(pos).addScaledVector(dir, -0.4); return false; }
        return true;
      case 'molotov': if (!p.remote) this.igniteMolotov(p, pos.clone().setY(this.world.groundHeightAt(pos.x, pos.z, pos.y + 0.5))); return true;
      case 'sticky': p.stuck = { actor: t, offset: pos.clone().sub(t.pos) }; p.vel.set(0, 0, 0); return false;
      default: p.vel.multiplyScalar(-0.3); return false; // grenades bounce off people
    }
  }

  projHitWorld(p, pos, n, box, dir) {
    switch (p.kind) {
      case 'rocket': case 'mortar_shell':
        if (box?.kind === 'ceiling') { this.g.effects.sparks(pos, n, 14); return true; }
        if (!p.remote) this.explode(p, pos, null); return true;
      case 'gl_shell': case 'frag': case 'smoke': case 'flash': {
        p.pos.copy(pos); const vn = p.vel.dot(n); p.vel.addScaledVector(n, -vn * 1.45); p.vel.multiplyScalar(0.55); p.bounces++;
        if (p.vel.length() < 1.2 && n.y > 0.6) { p.vel.set(0, 0, 0); p.landed = true; p.mesh.position.copy(pos); }
        if (p.bounces < 4) sfx.thud(pos);
        return false;
      }
      case 'molotov': if (!p.remote) this.igniteMolotov(p, pos); else this.g.effects.explosion(pos, 1.5, { small: true }); return true;
      case 'sticky': p.stuck = { world: true }; p.pos.copy(pos); p.vel.set(0, 0, 0); p.mesh.quaternion.setFromUnitVectors(UP, n); return false;
      case 'mine':
        if (n.y > 0.6) { p.pos.copy(pos).addScaledVector(n, -0.02); p.vel.set(0, 0, 0); p.landed = true; p.stuck = { world: true }; p.armAt = p.t + p.def.mine.arm; p.fuse = Infinity; p.mesh.rotation.set(0, Math.random() * 6, 0); p.mesh.position.copy(p.pos); p.led = p.mesh.getObjectByName('led'); sfx.thud(pos); }
        else { p.vel.addScaledVector(n, -p.vel.dot(n) * 1.4).multiplyScalar(0.4); p.pos.copy(pos); }
        return false;
      case 'slipper': if (n.y > 0.6) { p.pos.copy(pos); p.vel.set(0, 0, 0); p.landed = true; p.mesh.rotation.set(0, Math.random() * 6, 0); p.mesh.position.copy(pos); } else { p.vel.addScaledVector(n, -p.vel.dot(n) * 1.3).multiplyScalar(0.4); p.pos.copy(pos); } return false;
      default: // bolt, shuriken: stick in the wall briefly
        p.pos.copy(pos); p.vel.set(0, 0, 0); p.stuck = { world: true }; p.fuse = p.t + 4; p.mesh.position.copy(pos);
        this.g.effects.sparks(pos, n, 3);
        if (box?.kind === 'barricade') this.damageBarricade(box.ref, p.def.dmg);
        return false;
    }
  }

  detonate(p) {
    switch (p.kind) {
      case 'frag': case 'gl_shell': case 'sticky': this.explode(p, p.pos, null); return true;
      case 'smoke': this.makeSmoke(p.pos.clone(), p.def.smoke); this.g.onWorldEvent?.('smoke', { pos: p.pos.toArray() }); return true;
      case 'flash': this.flashbang(p); return true;
      case 'bolt': case 'shuriken': return true;
      case 'slipper': case 'mine': return false;
      default: return true;
    }
  }

  // ═════════════════ explosions / area effects ═════════════════
  explode(p, pos, direct) {
    const d = p.def; const sp = d.splash || { radius: 4, max: 80, min: 30 };
    this.g.effects.explosion(pos, sp.radius); sfx.explosion(pos, sp.radius / 4.5);
    this.g.shakeFrom(pos, sp.radius);
    if (p.ring) { p.ring.visible = false; }
    this.g.onWorldEvent?.('boom', { pos: pos.toArray(), r: sp.radius, id: p.id });
    if (p.remote) return;
    const center = pos.clone().add(_a.set(0, 0.25, 0));
    for (const t of this.g.actors) {
      if (!t.alive || t === direct) continue;
      if (t !== p.owner && !this.g.hostile(p.owner, t)) continue;
      const dist = center.distanceTo(t.chest(_b)) - 0.3;
      if (dist > sp.radius) continue;
      if (!this.world.lineOfSight(center, _b) && !this.world.lineOfSight(center, t.headPos(_c))) continue;
      const f = 1 - Math.max(0, dist) / sp.radius;
      let dmg = sp.min + (sp.max - sp.min) * f;
      if (p.kind === 'sticky' && p.stuck?.actor === t) dmg = d.dmg;
      if (p.kind === 'mortar_shell' && dist < 1.2) dmg = d.dmg;
      if (p.kind === 'frag' && dist < 1.0) dmg = d.dmg;
      if (p.kind === 'mine' && dist < 1.3) dmg = d.dmg;
      if (t === p.owner) dmg *= 0.5;
      this.g.damage(t, dmg, { attacker: p.owner, weapon: d.id, pos, explosive: true });
      const kb = (d.knockback || 5) * f; const dir = _c.subVectors(t.pos, pos).setY(0).normalize();
      t.vel.addScaledVector(dir, kb); t.vel.y += kb * 0.5;
    }
    for (const b of [...this.barricades]) if (b.center.distanceTo(pos) < sp.radius + 1) this.damageBarricade(b, sp.max * 1.5);
  }

  makeSmoke(pos, cfg) {
    const cloud = { pos: pos.clone().setY(Math.max(0, pos.y - 0.3)), radius: cfg.radius, time: cfg.time, t: 0 };
    this.clouds.push(cloud); this.g.effects.smokeCloud(cloud);
    sfx.whoosh(pos, true);
    return cloud;
  }
  inSmoke(a, b) { // segment a→b passes through any smoke cloud
    for (const c of this.clouds) {
      if (c.ignited) continue;
      const ab = _a.subVectors(b, a); const len = ab.length(); if (len < 1e-4) continue; ab.divideScalar(len);
      const t = THREE.MathUtils.clamp(_b.subVectors(c.pos, a).dot(ab), 0, len);
      const closest = _c.copy(a).addScaledVector(ab, t);
      const r = c.radius * 0.85 * Math.min(1, c.t / 0.8) * Math.min(1, (c.time - c.t) / 1.5);
      if (closest.distanceTo(c.pos.clone().setY(c.pos.y + 1.4)) < r) return true;
    }
    return false;
  }

  flashbang(p) {
    const pos = p.pos; const cfg = p.def.flash;
    this.g.effects.flashBurst(pos); sfx.explosion(pos, 0.4);
    this.g.onWorldEvent?.('flash', { pos: pos.toArray() });
    if (p.remote) return;
    for (const t of this.g.actors) {
      if (!t.alive) continue;
      if (t !== p.owner && !this.g.hostile(p.owner, t)) continue;
      const eye = t.eye(_a); const dist = eye.distanceTo(pos); if (dist > cfg.radius) continue;
      if (!this.world.lineOfSight(pos.clone().add(_b.set(0, 0.2, 0)), eye)) continue;
      const toF = _c.subVectors(pos, eye).normalize(); const facing = t.aimDir(_b).dot(toF);
      const time = cfg.time * (facing > 0.2 ? 1 : 0.45) * (1 - dist / cfg.radius * 0.3);
      this.g.damage(t, p.def.dmg, { attacker: p.owner, weapon: p.def.id, pos });
      this.g.blind(t, time);
    }
  }

  igniteMolotov(p, pos) {
    const cfg = p.def.fire; this.g.effects.explosion(pos, 1.6, { small: true }); sfx.explosion(pos, 0.4);
    this.addFire({ pos: pos.clone(), radius: cfg.radius, dps: cfg.dps, time: cfg.time, owner: p.owner, weapon: p.def.id });
  }
  addFire(f) {
    const fire = { ...f, t: 0, acc: new Map() }; this.fires.push(fire); this.g.effects.firePool(fire);
    this.g.onWorldEvent?.('fire', { pos: f.pos.toArray(), radius: f.radius, time: f.time });
    return fire;
  }
  updateAreas(dt) {
    for (const c of this.clouds) c.t += dt;
    this.clouds = this.clouds.filter((c) => c.t < c.time && !c.ignited);
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.t += dt;
      if (f.t >= f.time) { this.fires.splice(i, 1); continue; }
      if (f.remote) continue;
      for (const t of this.g.actors) {
        if (!t.alive) continue; if (t !== f.owner && !this.g.hostile(f.owner, t)) continue;
        const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z;
        if (dx * dx + dz * dz > f.radius * f.radius || Math.abs(t.pos.y - f.pos.y) > 1.6) continue;
        const acc = (f.acc.get(t) || 0) + f.dps * dt * (t === f.owner ? 0.5 : 1);
        if (acc >= 4) { this.g.damage(t, acc, { attacker: f.owner, weapon: f.weapon, fire: true, explosive: true, pos: t.pos }); f.acc.set(t, 0); } else f.acc.set(t, acc);
      }
    }
  }

  // ═════════════════ flamethrower ═════════════════
  tickFlame(a, ws, it) {
    const d = ws.def;
    if (!it.fire || ws.cooldown > 0) return;
    if (ws.mag <= 0) { this.startReload(a, ws); return; }
    ws.cooldown = d.interval; ws.mag -= d.ammoPerShot;
    const eye = a.eye(V()), dir = a.aimDir(V());
    const muzzle = this.g.muzzleWorld(a, V());
    const side = _d.set(-dir.z, 0, dir.x).normalize();
    for (const off of d.twin ? [-0.07, 0.07] : [0]) for (let i = 0; i < 5; i++) {
      const v = jitter(dir, d.cone * 0.8).multiplyScalar(d.range * 1.25 + Math.random() * 6).add(a.vel);
      this.g.effects.flame(muzzle.clone().addScaledVector(dir, 0.1).addScaledVector(side, off), v, d.range / 11);
    }
    sfx.shot('flame', a === this.g.player ? null : a.chest(V()), 0.7);
    this.g.onFired(a, d, muzzle, dir);
    for (const t of this.enemiesOf(a)) {
      const c = t.chest(_a); const v = _b.subVectors(c, eye); const dist = v.length();
      if (dist > d.range + 0.4) continue;
      const ang = v.normalize().angleTo(dir);
      if (ang > d.cone + Math.atan(0.45 / Math.max(0.5, dist))) continue;
      if (!this.world.lineOfSight(eye, c)) continue;
      this.g.damage(t, d.dmg, { attacker: a, weapon: d.id, fire: true, explosive: true, pos: c });
      if (t.alive) t.fx.burn = { dps: d.burn.dps, t: d.burn.time, owner: a, acc: 0 };
    }
    // ignite smoke clouds along the stream
    const end = eye.clone().addScaledVector(dir, d.range);
    for (const c of this.clouds) {
      if (c.ignited) continue;
      const ab = _c.subVectors(end, eye); const len = ab.length(); ab.divideScalar(len);
      const tt = THREE.MathUtils.clamp(_a.subVectors(c.pos, eye).dot(ab), 0, len);
      if (eye.clone().addScaledVector(ab, tt).distanceTo(c.pos) < c.radius * 0.8) {
        c.ignited = true;
        this.g.effects.explosion(c.pos.clone().setY(c.pos.y + 1.2), c.radius * 0.8);
        sfx.explosion(c.pos, 1);
        this.addFire({ pos: c.pos.clone(), radius: c.radius * 0.6, dps: 22, time: 3, owner: a, weapon: d.id });
        this.g.hud?.toast(a === this.g.player ? 'Smoke cloud ignited!' : null);
      }
    }
  }

  // ═════════════════ melee ═════════════════
  tickMelee(a, ws, it) {
    const d = ws.def;
    if (it.altPressed && d.ability && a.fx.scytheCd <= 0) { a.fx.scythe = d.ability.time; a.fx.scytheCd = d.ability.cooldown; sfx.whoosh(null, true); this.g.onAbility?.(a); }
    if (!it.fire || ws.cooldown > 0) return;
    ws.cooldown = d.interval; ws.swing = 0.001; ws.pendingHit = Math.min(0.12, d.interval * 0.35);
    sfx.whoosh(a === this.g.player ? null : a.chest(V()), d.interval > 0.8);
    this.g.onFired(a, d, null, a.aimDir(V()));
  }
  meleeHit(a, ws) {
    if (!a.alive) return;
    const d = ws.def; const eye = a.eye(V()); const dir = a.aimDir(V());
    const arc = d.arc || 0.6;
    let best = null;
    for (const t of this.enemiesOf(a)) {
      const c = t.chest(_a); const v = _b.subVectors(c, eye);
      // distance to the target's capsule surface
      const flat = Math.hypot(v.x, v.z) - RADIUS;
      const dist = Math.max(0, Math.hypot(flat, Math.max(0, Math.abs(v.y) - 0.5)));
      if (dist > d.reach) continue;
      const ang = v.normalize().angleTo(dir);
      if (ang > arc + Math.atan(0.5 / Math.max(0.3, dist))) continue;
      if (!this.world.lineOfSight(eye, c)) continue;
      if (!best || dist < best.dist) best = { t, dist };
    }
    if (best) {
      const t = best.t;
      const head = raySphere(eye, dir, t.headPos(_c), 0.26) !== null && dir.y > -0.6;
      let dmg = head ? d.head : d.dmg;
      if (d.backstab) { const tf = t.forward(_a); const to = _b.subVectors(t.pos, a.pos).setY(0).normalize(); if (tf.dot(to) > 0.45) dmg = Math.max(dmg, d.backstab); }
      this.g.damage(t, dmg, { attacker: a, weapon: d.id, head, melee: true, pos: t.chest(V()), dir });
      if (d.knockback) { const kd = _a.subVectors(t.pos, a.pos).setY(0).normalize(); t.vel.addScaledVector(kd, d.knockback); t.vel.y += d.knockback * 0.35; }
      sfx.thud(t.chest(V()));
      this.g.effects.blood(t.chest(V()));
      return;
    }
    // barricades / walls
    const wh = this.world.raycast(eye, dir, d.reach + 0.2);
    if (wh) {
      if (wh.box?.kind === 'barricade') { if (d.breaker) this.destroyBarricade(wh.box.ref); else this.damageBarricade(wh.box.ref, d.dmg); }
      this.g.effects.sparks(wh.point, wh.normal, 6); sfx.thud(wh.point);
    }
  }

  // ═════════════════ throwables ═════════════════
  tickThrowable(a, ws, it, dt) {
    const d = ws.def;
    if (d.remote && it.altPressed) { let any = false; for (const p of this.projs) if (p.kind === 'sticky' && p.owner === a && !p.remote) { p.fuse = Math.min(p.fuse, p.t); any = true; } if (any) sfx.beep(null); }
    if (ws.cook < 0) {
      if (it.firePressed && ws.count > 0 && ws.cooldown <= 0) { ws.cook = 0; sfx.click(); }
      return;
    }
    ws.cook += dt;
    if (d.cookable && ws.cook >= d.fuse) { // cooked too long
      const p = this.spawnProj(a, d, d.proj, a.eye(V()), V(), { fuse: 0 });
      ws.count--; ws.cook = -1; this.explode(p, p.pos, null); this.g.scene.remove(p.mesh); this.projs.splice(this.projs.indexOf(p), 1);
      return;
    }
    if (!it.fire) {
      const dir = a.aimDir(V()); const power = (d.mine ? 7 : 17) * (1 + (a.mods.throw || 0));
      const vel = dir.multiplyScalar(power).add(_a.set(0, d.mine ? 1.5 : 3.2, 0)).addScaledVector(a.vel, 0.5);
      const fuse = d.cookable ? d.fuse - ws.cook : (d.impact || d.mine ? Infinity : d.fuse);
      this.spawnProj(a, d, d.proj, a.eye(V()).addScaledVector(a.aimDir(_b), 0.5), vel, { fuse, visFrom: this.g.muzzleWorld(a, V()) });
      ws.count--; ws.cook = -1; ws.cooldown = 0.6; a.stats.throws++;
      sfx.shot('throw', a === this.g.player ? null : a.chest(V()), 0.8);
      this.g.onFired(a, d, null, a.aimDir(V()));
      if (ws.count <= 0 && a.weapons[1]) this.g.after(0.45, () => { if (a.slot === 4 && ws.count <= 0) a.switchSlot(a.prevSlot && a.prevSlot !== 4 ? a.prevSlot : 1); });
    }
  }

  // ═════════════════ taser ═════════════════
  tickTaser(a, ws, it) {
    const d = ws.def;
    if (!it.firePressed || ws.mag <= 0 || ws.cooldown > 0) return;
    ws.mag = 0; ws.recharge = d.reload; ws.cooldown = d.interval;
    const eye = a.eye(V()), dir = a.aimDir(V()); const muzzle = this.g.muzzleWorld(a, V());
    const wh = this.world.raycast(eye, dir, d.range);
    const ah = this.rayActors(eye, dir, wh ? wh.t : d.range, a, { bodyR: 0.45, headR: 0.22 });
    sfx.shot('taser', a === this.g.player ? null : a.chest(V()));
    this.g.onFired(a, d, muzzle, dir);
    if (ah) {
      const p = eye.clone().addScaledVector(dir, ah.t);
      this.g.effects.tether(muzzle, p); this.g.effects.sparks(p, null, 10, 0x80e0ff);
      this.g.damage(ah.actor, d.dmg, { attacker: a, weapon: d.id, pos: p });
      this.g.stun(ah.actor, d.stun.time);
    } else this.g.effects.tether(muzzle, wh ? wh.point : eye.clone().addScaledVector(dir, d.range), 0.2);
  }

  // ═════════════════ mortar ═════════════════
  fireMortar(a, ws) {
    const d = ws.def; const eye = a.eye(V()), dir = a.aimDir(V());
    const hit = this.world.raycast(eye, dir, d.range, (b) => !b.seeThrough);
    let target = hit ? hit.point.clone() : eye.clone().addScaledVector(dir, d.range);
    const flat = V().set(target.x - a.pos.x, 0, target.z - a.pos.z); let dist = flat.length();
    if (dist < d.minRange) { const f = a.forward(V()); target = a.pos.clone().addScaledVector(dist > 0.5 ? flat.normalize() : f, d.minRange); dist = d.minRange; }
    if (dist > d.range) { target = a.pos.clone().addScaledVector(flat.normalize(), d.range); dist = d.range; }
    target.y = this.world.groundHeightAt(target.x, target.z, (hit ? hit.point.y : 0) + 0.5);
    const T = 1.7 + dist / 35; const g = 20;
    const start = eye.clone().add(_a.set(0, 0.3, 0));
    const vel = V().set((target.x - start.x) / T, (target.y - start.y + 0.5 * g * T * T) / T, (target.z - start.z) / T);
    ws.mag--; ws.cooldown = d.interval;
    const p = this.spawnProj(a, d, 'mortar_shell', start, vel, { visFrom: this.g.muzzleWorld(a, V()) });
    p.impactT = T; p.target = target;
    // no warning ring — shells land unannounced
    sfx.shot('mortar', a === this.g.player ? null : a.chest(V()));
    a.recoil += 0.06;
    this.g.onFired(a, d, this.g.muzzleWorld(a, V()), dir);
    if (ws.mag === 0) this.g.after(0.3, () => { if (a.ws === ws && ws.mag === 0) this.startReload(a, ws); });
  }

  // ═════════════════ usables ═════════════════
  tickUsable(a, ws, it, dt) {
    const d = ws.def;
    if (ws.useT < 0) {
      if (it.firePressed && ws.usableCd <= 0) { ws.useT = 0; if (d.use === 0) return this.finishUsable(a, ws); }
      return;
    }
    ws.useT += dt;
    if (ws.useT >= d.use) this.finishUsable(a, ws);
  }
  finishUsable(a, ws) {
    const d = ws.def; ws.useT = -1; ws.usableCd = d.cooldown;
    if (d.heal) { a.hp = Math.min(BASE_HP, a.hp + d.heal); if (a === this.g.player) sfx.heal(); }
    if (d.ammo) {
      for (const s in a.weapons) { const w = a.weapons[s]; if (w.reserveMax !== Infinity && w.def.slot <= 2) w.reserve = w.reserveMax; if (['rocket_launcher', 'mortar'].includes(bid(w.def))) w.reserve += 1; if (w.def.kind === 'throwable') w.count += 1; }
      if (a === this.g.player) sfx.reload(2);
    }
    if (d.armor) { a.armor = MAX_ARMOR; if (a === this.g.player) sfx.reload(1); }
    if (d.adrenaline) { a.fx.adrenaline = d.adrenaline.time; if (a === this.g.player) sfx.heal(); }
    if (d.barricade) this.placeBarricade(a, d.barricade);
    this.g.onUsed?.(a, d);
    this.g.after(0.25, () => { if (a.slot === 5 && a.alive) a.switchSlot(a.prevSlot !== 5 ? a.prevSlot : 1); });
  }

  placeBarricade(a, cfg, remote = null) {
    for (const b of [...this.barricades]) if (b.owner === a) this.removeBarricade(b);
    const f = a.forward(V()); const pos = remote ? new THREE.Vector3(...remote.pos) : a.pos.clone().addScaledVector(f, 1.6);
    pos.y = this.world.groundHeightAt(pos.x, pos.z, a.pos.y + 0.5);
    const alongX = remote ? remote.alongX : Math.abs(f.z) > Math.abs(f.x);
    const sx = alongX ? cfg.w : 0.12, sz = alongX ? 0.12 : cfg.w;
    const box = this.world.addCS(pos.x, pos.y + cfg.h / 2, pos.z, sx, cfg.h, sz, { kind: 'barricade' });
    const mesh = barricadeMesh(mats(), cfg.w, cfg.h); mesh.position.copy(pos); mesh.rotation.y = alongX ? 0 : Math.PI / 2;
    if (!remote && f.dot(alongX ? _a.set(0, 0, 1) : _a.set(1, 0, 0)) > 0) mesh.rotation.y += Math.PI;
    this.g.scene.add(mesh);
    const b = { owner: a, hp: cfg.h ? 300 : 300, box, mesh, center: pos.clone().setY(pos.y + 0.65), id: remote?.id || `${a.id}:bar:${this.seq++}` };
    box.ref = b; this.barricades.push(b);
    if (!remote) this.g.onWorldEvent?.('barricade', { pos: pos.toArray(), alongX, id: b.id, owner: a.id });
    sfx.thud(pos);
    return b;
  }
  damageBarricade(b, dmg) { if (!b || b.removed) return; b.hp -= dmg; if (b.hp <= 0) this.destroyBarricade(b); }
  destroyBarricade(b) {
    if (!b || b.removed) return;
    this.g.effects.sparks(b.center, null, 30); this.g.effects.explosion(b.center, 1.2, { small: true }); sfx.thud(b.center);
    this.removeBarricade(b);
    this.g.onWorldEvent?.('barricade_down', { id: b.id });
  }
  removeBarricade(b, silent) { if (b.removed) return; b.removed = true; this.world.remove(b.box); this.g.scene.remove(b.mesh); this.barricades = this.barricades.filter((x) => x !== b); void silent; }

  update(dt) { this.updateBullets(dt); this.updateProjs(dt); this.updateAreas(dt); }
}

export { WEAPON_BY_ID };
