// First-person viewmodel rendered in its own scene/camera over the world (never clips into walls).
import * as THREE from 'three';
import { buildItem, findMarker, mats } from '../render/models.js';
import { glove } from '../render/gearModels.js';
import { P, cylZ } from '../render/modelKit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BASE = new THREE.Vector3(0.19, -0.23, -0.6);
const SHOULDER_R = new THREE.Vector3(0.34, -0.62, 0.12), SHOULDER_L = new THREE.Vector3(-0.3, -0.66, 0.08);
const ZAX = new THREE.Vector3(0, 0, 1);
// per-item viewmodel framing: [x, y, z, rx, ry, rz, scale]
const POSE = {
  mortar: [0.27, -0.36, -0.78, 0.28, 0.06, 0, 0.72], rocket_launcher: [0.24, -0.33, -0.62, 0, 0.02, 0, 0.85],
  lmg: [0.2, -0.25, -0.64, 0, 0, 0, 0.9], heavy_sniper: [0.2, -0.24, -0.66, 0, 0, 0, 0.9], flamethrower: [0.2, -0.22, -0.6, 0, 0, 0, 0.95],
  grenade_launcher: [0.2, -0.24, -0.58, 0, 0, 0, 0.95], dmr: [0.19, -0.23, -0.62, 0, 0, 0, 0.95],
  pistol: [0.16, -0.16, -0.46, 0, 0.04, 0, 1], burst_pistol: [0.16, -0.16, -0.46, 0, 0.04, 0, 1], revolver: [0.16, -0.17, -0.46, 0, 0.04, 0, 1], taser: [0.17, -0.2, -0.48, 0, 0, 0, 1], crossbow: [0.17, -0.22, -0.52, 0, 0, 0, 1],
  katana: [0.3, -0.3, -0.52, -0.35, -1.45, 0.42, 0.95, 'ZXY'], knife: [0.22, -0.24, -0.42, -1.15, 0.25, 0.35, 1], karambit: [0.22, -0.24, -0.42, -0.6, 0.3, 0.3, 1],
  spear: [0.21, -0.26, -0.36, -1.42, 0.08, 0.05, 0.85], snowball_launcher: [0.2, -0.24, -0.6, 0, 0, 0, 0.92], paintball_gun: [0.19, -0.22, -0.58, 0, 0, 0, 0.95], water_gun: [0.2, -0.22, -0.56, 0, 0, 0, 0.95], tennis_launcher: [0.2, -0.24, -0.6, 0, 0, 0, 0.92],
  land_mine: [0.2, -0.26, -0.5, 0.55, 0.3, 0, 0.55], grapple_hook: [0.2, -0.21, -0.48, -1.42, 0.06, 0, 0.95], sentry_turret: [0.04, -0.2, -0.44, 0.25, -0.3, 0, 0.9],
  volt_rail: [0.19, -0.22, -0.62, 0, 0, 0, 0.92], arc_caster: [0.19, -0.22, -0.58, 0, 0, 0, 0.95], ricochet_disc: [0.2, -0.23, -0.58, 0, 0, 0, 0.92], cryo_sprayer: [0.2, -0.22, -0.58, 0, 0, 0, 0.94], harpoon_gun: [0.19, -0.22, -0.6, 0, 0, 0, 0.92], pocket_rocket: [0.16, -0.17, -0.46, 0, 0.04, 0, 1],
  lmg_ultra: [0.25, -0.31, -0.72, 0, 0.06, 0, 0.78], rocket_launcher_ultra: [0.27, -0.37, -0.72, 0, 0.05, 0, 0.68],
  mortar_ultra: [0.29, -0.4, -0.82, 0.26, 0.06, 0, 0.6], flamethrower_ultra: [0.23, -0.27, -0.64, 0, 0.03, 0, 0.82], grenade_launcher_ultra: [0.22, -0.27, -0.6, 0, 0.03, 0, 0.88],
  bat: [0.32, -0.42, -0.5, -0.3, 0.2, 0.5, 1], sledgehammer: [0.34, -0.48, -0.55, -0.3, 0.25, 0.5, 0.95], scythe: [0.32, -0.9, -0.8, -0.12, 0.35, 0.3, 1],
};
const ONE_HAND = ['knife', 'karambit', 'katana', 'frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'land_mine', 'shurikens', 'slippers', 'pistol', 'revolver', 'taser', 'pocket_rocket', 'adrenaline', 'shockwave_grenade', 'black_hole', 'grapple_hook'];
const MELEE = ['knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer', 'grapple_hook', 'spear'];

export class ViewModel {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.01, 10);
    this.scene.add(this.camera);
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x403830, 1.1); this.scene.add(hemi);
    this.key = new THREE.DirectionalLight(0xfff0dd, 2.6); this.key.position.set(1.5, 2, 1); this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0x9fc0ff, 1.4); rim.position.set(-2, 0.5, -2); this.scene.add(rim);
    this.root = new THREE.Group(); this.camera.add(this.root);
    this.holder = new THREE.Group(); this.root.add(this.holder);
    this.item = null; this.itemId = null; this.kind = null;
    this.sway = new THREE.Vector2(); this.swayV = new THREE.Vector2(); this.bobT = 0; this.kick = 0; this.kickRot = 0; this.adsK = 0; this.drawK = 1; this.landK = 0;
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: 0x3d4434, roughness: 0.85 });
    this.handR = this.makeArm(1); this.handL = this.makeArm(-1);
    this.visible = true; this.renderer = renderer;
  }
  setEnv(env) { this.scene.environment = env; this.scene.environmentIntensity = 0.4; }
  makeArm(side) {
    const g = new THREE.Group();
    const hand = glove(mats(), side, { guard: false }); hand.scale.setScalar(0.92); g.add(hand);
    P(g, cylZ(0.048, 0.055, 0.8, 14), this.sleeveMat, 0, -0.005, 0.46);
    P(g, cylZ(0.052, 0.052, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x2a2e26, roughness: 0.9 }), 0, -0.005, 0.08);
    this.root.add(g); g.visible = false;
    return g;
  }

  setWeapon(id, skin) {
    const key = id + ':' + (skin || '');
    if (this.itemId === key) return;
    if (this.item) this.holder.remove(this.item);
    this.itemId = key; this.fullId = id; id = id && id.endsWith('_ultra') ? id.slice(0, -6) : id; this.id = id;
    this.item = this.fullId ? buildItem(this.fullId, { skin }) : null;
    this.kind = MELEE.includes(id) ? 'melee' : id === 'fists' ? 'fists' : ['frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'land_mine'].includes(id) ? 'throw' : ['medkit', 'ammo_pack', 'armor_plate', 'adrenaline', 'barricade', 'sentry_turret'].includes(id) ? 'usable' : id === 'shurikens' || id === 'slippers' ? 'hand' : 'gun';
    if (this.item) {
      this.item.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      const deco = this.item.getObjectByName('holidayDeco'); if (deco) deco.visible = false;
      this.item.scale.setScalar((POSE[this.fullId] || POSE[id])?.[6] ?? 1);
      this.holder.add(this.item);
      this.muzzle = findMarker(this.item, 'muzzle'); this.sight = findMarker(this.item, 'sight'); this.fore = findMarker(this.item, 'foregrip');
      this.mag = this.item.getObjectByName('mag'); this.round = this.item.getObjectByName('round'); this.pump = this.item.getObjectByName('pump'); this.pilot = this.item.getObjectByName('pilot'); this.pilot2 = this.item.getObjectByName('pilot2'); this.spin = this.item.getObjectByName('spin'); this.wheel = this.item.getObjectByName('wheel'); this.wheelA = 0; this.spinV = 0; this.flickT = 0;
      this.seeThru = []; this.item.traverse((o) => { if (o.isMesh && o.material?.userData?.seeThru) this.seeThru.push(o); });
      // every gun can aim down sights: synthesize a sight line over the barrel when the model has no optic
      if (!this.sight && this.muzzle && this.kind === 'gun') { this.sight = new THREE.Object3D(); this.sight.position.set(this.muzzle.position.x, this.muzzle.position.y + 0.035, 0.12); this.item.add(this.sight); }
      this.computeAdsLine();
      this.magBase = this.mag ? this.mag.position.clone() : null; this.pumpBase = this.pump ? this.pump.position.clone() : null;
    }
    this.drawK = 1;
  }

  // Aim-down-sights line: start at the sight marker and raise it until no solid part of the gun in front of
  // the eye crosses the line of sight (fixes LMG carry handles / AK dust covers / minigun housings blocking the view).
  computeAdsLine() {
    this.adsSight = null; if (!this.sight || this.kind !== 'gun') return;
    const it = this.item; const saved = [it.position.clone(), it.quaternion.clone(), it.scale.clone()];
    it.position.set(0, 0, 0); it.quaternion.identity(); it.scale.set(1, 1, 1); it.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(it.matrixWorld).invert(); const boxes = [];
    it.traverse((o) => { if (!o.isMesh || o.material?.userData?.seeThru || o.material?.emissiveIntensity > 1.5) return; boxes.push(new THREE.Box3().setFromObject(o).applyMatrix4(inv)); });
    it.position.copy(saved[0]); it.quaternion.copy(saved[1]); it.scale.copy(saved[2]); it.updateMatrixWorld(true);
    // the ADS camera sits 0.12 m (view space) behind the sight point, so parts between the eye and the sight
    // (drums, wheels, rear sight blocks) block the view too — not just those in front of the sight.
    // ADS pushes the gun to at least 0.25 m in front of the eye (see update), so the camera can sit further back.
    // Every part in front of the eye must sit ≥ ~3.5° below the line of sight, so bulky drums / wheels drop
    // out of the picture instead of filling the lower half (the HUD red dot marks the aim point).
    const sp = this.sight.position; const k0 = saved[2].x || 1; const camZ = Math.max(sp.z + 0.12 / k0, 0.25 / k0); let y = sp.y + 0.004;
    const TAN = 0.06;
    for (let k = 0; k < 24; k++) {
      let raised = false;
      for (const bb of boxes) {
        if (bb.min.z > camZ - 0.03 || bb.min.x > sp.x + 0.012 || bb.max.x < sp.x - 0.012) continue;
        const dist = Math.max(0.03, camZ - bb.max.z); const need = bb.max.y + Math.min(0.03, TAN * dist);
        if (bb.min.y < y && need > y + 0.0005) { y = need + 0.001; raised = true; }
      }
      if (!raised) break;
    }
    this.adsSight = new THREE.Vector3(sp.x, y, sp.z);
  }

  update(dt, a, look, opts = {}) {
    if (!this.item) return;
    const ws = a.ws; const def = ws?.def;
    // sway (lagged mouse)
    this.swayV.x += (-look.dx * 0.00045 - this.sway.x) * Math.min(1, dt * 14);
    this.swayV.y += (look.dy * 0.00045 - this.sway.y) * Math.min(1, dt * 14);
    this.sway.lerp(this.swayV, Math.min(1, dt * 10)); this.swayV.multiplyScalar(Math.max(0, 1 - dt * 6));
    const spd = Math.hypot(a.vel.x, a.vel.z);
    if (a.onGround) this.bobT += dt * spd * 1.25;
    const bobAmp = Math.min(1, spd / 7) * (1 - this.adsK * 0.85);
    const bobX = Math.sin(this.bobT) * 0.012 * bobAmp, bobY = -Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmp;
    if (a.landed) { this.landK = 1; a.landed = false; }
    this.landK = Math.max(0, this.landK - dt * 5);
    // ADS blend
    const wantAds = a.ads && this.kind === 'gun' ? 1 : 0;
    this.adsK += (wantAds - this.adsK) * Math.min(1, dt * 14);
    this.drawK = Math.max(0, a.drawT > 0 ? Math.min(1, a.drawT / 0.3) : this.drawK - dt * 6);
    // recoil
    this.kick += (0 - this.kick) * Math.min(1, dt * 14); this.kickRot += (0 - this.kickRot) * Math.min(1, dt * 12);
    // base pose
    const pos = V().copy(BASE); const rot = new THREE.Euler(0, 0, 0);
    const pose = POSE[this.fullId] || POSE[this.id];
    if (pose) { pos.set(pose[0], pose[1], pose[2]); rot.set(pose[3], pose[4], pose[5], pose[7] || 'XYZ'); }
    else if (this.kind === 'melee') { pos.set(0.26, -0.3, -0.48); rot.set(-0.6, 0.2, 0.4); }
    else if (this.kind === 'fists') { pos.set(0, -0.2, -0.38); rot.set(0, 0, 0); }
    else if (this.kind === 'throw' || this.kind === 'hand') { pos.set(0.2, -0.2, -0.4); rot.set(0.2, 0, 0); }
    else if (this.kind === 'usable') { pos.set(0.05, -0.2, -0.42); rot.set(0.25, -0.2, 0); }
    // ADS alignment
    if (this.adsK > 0.001 && this.sight) {
      const k = this.item.scale.x; const s = (def?.scope ? null : this.adsSight) || this.sight.position; const ads = V(-s.x * k, -s.y * k, -0.12 - s.z * k + (def?.scope ? -0.05 : 0));
      ads.z = Math.min(ads.z, -0.25);
      pos.lerp(ads, this.adsK); rot.x *= 1 - this.adsK; rot.y *= 1 - this.adsK; rot.z *= 1 - this.adsK;
    }
    pos.x += this.sway.x * (1 - this.adsK * 0.8) + bobX; pos.y += this.sway.y * (1 - this.adsK * 0.8) + bobY - this.landK * 0.03;
    pos.z += this.kick; rot.x += this.kickRot;
    // reload animation
    let reloadK = 0;
    if (ws && ws.reloading > 0 && def.reload) {
      const total = def.perShell ? def.reload : def.reload; const u = 1 - ws.reloading / total;
      reloadK = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
      rot.x -= reloadK * 0.5; rot.z += reloadK * 0.6; pos.y -= reloadK * 0.08;
      if (this.mag && this.magBase) { const m = u < 0.5 ? u * 2 : 2 - u * 2; this.mag.position.copy(this.magBase).add(V(0, -m * 0.25, m * 0.05)); this.mag.visible = !(u > 0.35 && u < 0.6); }
      if (this.pump && this.pumpBase && def.perShell) { /* shell insertion: small wiggle */ rot.z += Math.sin(u * Math.PI * 2) * 0.05; }
    } else if (this.mag && this.magBase) { this.mag.position.copy(this.magBase); this.mag.visible = true; }
    if (ws?.recharge > 0 && ws.mag === 0 && def.cooldown) { rot.x -= 0.3; pos.y -= 0.12; }
    // pump action after shotgun shot
    if (this.pump && this.pumpBase) { const c = ws ? Math.max(0, ws.cooldown) / def.interval : 0; const k = c > 0.2 && c < 0.8 ? Math.sin((c - 0.2) / 0.6 * Math.PI) : 0; this.pump.position.copy(this.pumpBase).add(V(0, 0, k * 0.08)); }
    // round visibility (rocket warhead / bolt / mortar shell)
    if (this.round) this.round.visible = ws ? ws.mag > 0 : true;
    // melee swing
    if ((this.kind === 'melee' || this.kind === 'fists') && ws) {
      const s = ws.swing; if (s > 0) {
        const k = Math.sin(s * Math.PI);
        if (this.kind === 'fists') { const right = (Math.floor(a.stats.throws + (ws.swingN || 0)) % 2) === 0; this.punch = { k, right }; }
        else if (this.id === 'scythe' || this.id === 'katana' || this.id === 'bat' || this.id === 'sledgehammer') { rot.y += -k * 1.6; rot.z += k * 0.9; rot.x -= k * 0.4; pos.x -= k * 0.25; }
        else { rot.x -= k * 0.9; pos.z -= k * 0.25; pos.x -= k * 0.08; }
      } else this.punch = null;
      if (s > 0 && s < 0.02) ws.swingN = (ws.swingN || 0) + 1;
    }
    if (this.id === 'spear' && ws) this.item.visible = ws.mag > 0;
    if (a.fx.scythe > 0 && this.id === 'scythe') { rot.z += Math.sin(performance.now() * 0.02) * 0.03; }
    // throwables: cook pose & throw
    if (this.kind === 'throw' && ws) {
      if (ws.cook >= 0) { pos.add(V(0.05, 0.08, 0.12)); rot.x += 0.6; }
      if (ws.cooldown > 0.2) { pos.add(V(-0.1, 0.1, -0.3)); this.item.visible = false; } else this.item.visible = ws.count > 0;
    }
    if (this.kind === 'hand' && ws) { this.item.visible = ws.mag > 0; if (this.id === 'shurikens') for (let i = 0; i < 3; i++) { const st = this.item.getObjectByName('star' + i); if (st) st.visible = i < ws.mag; } }
    if (this.kind === 'usable' && ws) { if (ws.useT >= 0) { const u = ws.useT / Math.max(0.1, def.use); pos.add(V(-0.05, 0.05 + Math.sin(u * Math.PI) * 0.05, 0.05)); rot.x += 0.3; } this.item.visible = ws.usableCd <= 0 || ws.useT >= 0; }
    // draw / switch
    pos.y -= this.drawK * 0.35; rot.x -= this.drawK * 0.7;
    if (a.fx.stun > 0) { pos.x += (Math.random() - 0.5) * 0.01; pos.y += (Math.random() - 0.5) * 0.01 - 0.05; }
    this.holder.position.copy(pos); this.holder.rotation.copy(rot);
    // pilot flame: slow, smooth flicker (the old per-frame random scale read as the gun vibrating)
    this.flickT += dt;
    for (const pl of [this.pilot, this.pilot2]) if (pl) { const f = 0.92 + Math.sin(this.flickT * 7.3) * 0.05 + Math.sin(this.flickT * 3.1) * 0.03; pl.scale.set(f, f, f); }
    // revolving rocket cylinder: indexes 60° per fired rocket, fired chambers show empty
    if (this.wheel && ws) { const fired = Math.max(0, ws.def.mag - ws.mag); const tgt = -fired * Math.PI / 3; this.wheelA += (tgt - this.wheelA) * Math.min(1, dt * 14); this.wheel.rotation.z = this.wheelA; for (let i = 0; i < 6; i++) { const r = this.wheel.getObjectByName('rk' + i); if (r) r.visible = i >= fired; } }
    // rotary parts (minigun barrels / GL drum) spin up while firing
    if (this.spin) {
      const firing = ws && a.lastShotT != null && (opts.time ?? 0) - a.lastShotT < 0.15;
      this.spinV += ((firing ? 18 : 0) - this.spinV) * Math.min(1, dt * (firing ? 6 : 2));
      this.spin.rotation.z += this.spinV * dt;
    }
    this.updateHands(a);
    for (const o of this.seeThru || []) o.visible = this.adsK < 0.2;
    this.root.visible = this.visible && !(def?.scope && this.adsK > 0.18);
    this.camera.fov = 64 - this.adsK * 12; this.camera.updateProjectionMatrix();
  }

  // Orient an arm so its sleeve runs from the hand back toward the shoulder; roll sets the palm.
  placeArm(arm, hand, shoulder, roll) {
    arm.position.copy(hand);
    const dir = V().subVectors(shoulder, hand).normalize();
    arm.quaternion.setFromUnitVectors(ZAX, dir);
    arm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(ZAX, roll));
  }
  updateHands(a) {
    const R = this.handR, L = this.handL;
    R.visible = true; L.visible = !ONE_HAND.includes(this.id);
    this.holder.updateMatrixWorld(true);
    const toRoot = (local) => { const w = this.item.localToWorld(local.clone()); return this.root.worldToLocal(w); };
    if (this.kind === 'fists') {
      const p = this.punch;
      const rk = p && p.right ? p.k : 0, lk = p && !p.right ? p.k : 0;
      this.placeArm(R, V(0.17 - rk * 0.1, -0.2 + rk * 0.06, -0.36 - rk * 0.3), SHOULDER_R, 0.2);
      this.placeArm(L, V(-0.17 + lk * 0.1, -0.2 + lk * 0.06, -0.38 - lk * 0.3), SHOULDER_L, -0.2);
      this.item.visible = false;
      return;
    }
    if (this.kind === 'gun') {
      const grip = toRoot(V(0, -0.04, 0.0));
      this.placeArm(R, grip, SHOULDER_R, 1.25);
      if (this.fore) this.placeArm(L, toRoot(this.fore.position.clone().add(V(0, -0.015, 0))), SHOULDER_L, -1.3);
      else this.placeArm(L, grip.clone().add(V(-0.035, -0.035, 0.02)), SHOULDER_L, -1.0);
    } else if (this.kind === 'melee') {
      const h = toRoot(V(0, -0.05, 0)); this.placeArm(R, h, SHOULDER_R, 1.4);
      if (['scythe', 'sledgehammer', 'bat', 'spear'].includes(this.id)) this.placeArm(L, toRoot(V(0, this.id === 'scythe' ? 0.6 : this.id === 'spear' ? 0.42 : 0.16, 0)), SHOULDER_L, -1.4);
      else this.placeArm(L, V(-0.26, -0.36, -0.36), SHOULDER_L, -0.4);
    } else {
      const h = toRoot(V(0, -0.02, 0.03)); this.placeArm(R, h, SHOULDER_R, 1.0);
      if (this.kind === 'usable') this.placeArm(L, toRoot(V(-0.1, -0.02, 0.0)), SHOULDER_L, -1.0);
      else this.placeArm(L, V(-0.26, -0.36, -0.36), SHOULDER_L, -0.4);
    }
  }

  onFire(def) {
    const r = def.recoil || 0.02;
    if (def.kind === 'melee' || def.kind === 'throwable') return;
    if (def.kind === 'flame') { this.kick += 0.004; return; }
    this.kick += Math.min(0.12, 0.03 + r * 1.2) * (1 - this.adsK * 0.5); this.kickRot += Math.min(0.25, 0.04 + r * 2.5) * (1 - this.adsK * 0.5);
  }

  // muzzle position in main-world space (screen-consistent)
  muzzleWorld(mainCam, out) {
    if (!this.muzzle) return out.copy(mainCam.position);
    this.root.updateMatrixWorld(true);
    const p = this.muzzle.getWorldPosition(V()); // vm camera space (camera at origin)
    const d = p.length(); const ndc = p.clone().project(this.camera);
    out.set(ndc.x, ndc.y, 0.5).unproject(mainCam); out.sub(mainCam.position).normalize().multiplyScalar(Math.max(0.5, d * 1.5)).add(mainCam.position);
    return out;
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
