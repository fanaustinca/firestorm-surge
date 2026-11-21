import * as THREE from 'three';
import { makeMaterials, P, rbox, cylY, cylZ, sphere, torus, latheZ, shadowAll } from './modelKit.js';
import { GUN_BUILDERS } from './gunModels.js';
import { GEAR_BUILDERS, starGeo, slipperMesh, glove } from './gearModels.js';
import { ULTRA_BUILDERS } from './ultraModels.js';
import { HOLIDAY_SKINS } from '../data/weapons.js';

const matCache = new Map();
export function mats(skin = null) {
  const k = skin || 'base';
  if (!matCache.has(k)) matCache.set(k, makeMaterials(skin));
  return matCache.get(k);
}

export const BUILDERS = { ...GUN_BUILDERS, ...GEAR_BUILDERS, ...ULTRA_BUILDERS };

let holidayMode = 'auto'; // 'auto' | 'on' | 'off'
export function setHolidayMode(v) { holidayMode = v; }
export function holidayFor(id, date = new Date()) {
  if (holidayMode === 'off') return null;
  const month = date.getMonth();
  const h = HOLIDAY_SKINS.find((s) => s.weapon === id && (holidayMode === 'on' ? true : s.month === month));
  return h ? h.id : null;
}

export function buildItem(id, { skin = null, holiday } = {}) {
  const b = BUILDERS[id];
  if (!b) throw new Error('No model for ' + id);
  const ultra = id.endsWith('_ultra');
  const g = b(mats(skin), { holiday: ultra ? null : holiday === undefined ? holidayFor(id) : holiday });
  g.name = id;
  shadowAll(g);
  return g;
}

export const findMarker = (g, name) => g.getObjectByName(name);

// ─────────── Projectile meshes ───────────
const projCache = {};
export function projectileMesh(kind) {
  const m = mats();
  if (!projCache[kind]) {
    const g = new THREE.Group();
    switch (kind) {
      case 'rocket': {
        P(g, latheZ([[0, 0.3], [0.03, 0.22], [0.055, 0.1], [0.055, -0.15], [0.03, -0.2], [0, -0.2]], 16), new THREE.MeshStandardMaterial({ color: 0x3f4a2c, metalness: 0.4, roughness: 0.5 }));
        for (let i = 0; i < 4; i++) P(g, rbox(0.004, 0.08, 0.08, 0.001), m.darksteel, 0, 0, 0.18, 0, 0, (i / 4) * Math.PI).position.set(0, 0, 0.17);
        P(g, sphere(0.05, 10, 8), m.glowOrange, 0, 0, 0.23).scale.set(1, 1, 1.6);
        break;
      }
      case 'gl_shell': P(g, latheZ([[0, 0.05], [0.02, 0.04], [0.025, 0.0], [0.025, -0.04], [0, -0.04]], 14), m.olive); P(g, cylZ(0.026, 0.026, 0.01, 14), m.brass, 0, 0, 0.035); break;
      case 'mortar_shell': P(g, latheZ([[0, 0.14], [0.028, 0.1], [0.04, 0.0], [0.03, -0.1], [0.012, -0.14], [0, -0.14]], 16), m.olive); P(g, cylZ(0.041, 0.041, 0.02, 16), m.yellow); break;
      case 'bolt': P(g, cylZ(0.004, 0.004, 0.36, 6), m.polymer); P(g, new THREE.ConeGeometry(0.01, 0.04, 4).rotateX(-Math.PI / 2), m.steel, 0, 0, -0.2); break;
      case 'shuriken': P(g, starGeo(), new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 1, roughness: 0.18 })); break;
      case 'slipper': g.add(slipperMesh(m)); break;
      case 'mine': g.add(buildItem('land_mine')); break;
      case 'taser': P(g, cylZ(0.006, 0.006, 0.03, 6), m.glowBlue); break;
      case 'disc': {
        P(g, cylY(0.13, 0.13, 0.014, 32), new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 1, roughness: 0.2 }));
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; P(g, new THREE.ConeGeometry(0.018, 0.045, 3).rotateZ(-Math.PI / 2), m.steel, Math.cos(a) * 0.145, 0, Math.sin(a) * 0.145, 0, -a, 0); }
        P(g, cylY(0.04, 0.04, 0.02, 16), m.orange); break;
      }
      case 'harpoon': P(g, cylZ(0.012, 0.012, 0.7, 8), m.steel, 0, 0, 0.1); P(g, new THREE.ConeGeometry(0.035, 0.14, 4).rotateX(-Math.PI / 2), m.steel, 0, 0, -0.3); for (const sx of [-1, 1]) P(g, rbox(0.006, 0.01, 0.08, 0.002), m.steel, sx * 0.03, 0, -0.2); break;
      case 'snowball': { const sm = new THREE.MeshStandardMaterial({ color: 0xf6f9fc, roughness: 0.9 }); P(g, sphere(0.075, 14, 10), sm); for (let i = 0; i < 4; i++) P(g, sphere(0.03, 8, 6), sm, Math.cos(i * 1.6) * 0.06, Math.sin(i * 2.3) * 0.05, Math.sin(i * 1.6) * 0.06); break; }
      case 'paintball': P(g, sphere(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff2d6f, roughness: 0.2 })); P(g, torus(0.022, 0.003, 14), m.white); break;
      case 'tennis': { P(g, sphere(0.034, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8f040, roughness: 0.95 })); const seam = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8 }); P(g, torus(0.034, 0.0025, 20), seam, 0, 0, 0, 0.6, 0, 0); P(g, torus(0.034, 0.0025, 20), seam, 0, 0, 0, -0.6, Math.PI / 2, 0); break; }
      case 'spear': { const sp = buildItem('spear'); sp.rotation.x = -Math.PI / 2; sp.position.z = 0.25; g.add(sp); break; }
      case 'concussion': g.add(buildItem('shockwave_grenade')); break;
      case 'singularity': g.add(buildItem('black_hole')); break;
      default: { const item = buildItem({ frag: 'frag', smoke: 'smoke_grenade', molotov: 'molotov', flash: 'flashbang', sticky: 'sticky_bomb' }[kind] || 'frag'); g.add(item); }
    }
    shadowAll(g);
    projCache[kind] = g;
  }
  return projCache[kind].clone();
}

// ─────────── 3rd-person soldier ───────────
const TEAM_COLORS = { red: 0xc8352b, blue: 0x2f6fd6, ffa: 0xe08a1e, none: 0x7a7f86 };
export function teamColor(team) { return TEAM_COLORS[team] ?? TEAM_COLORS.ffa; }

export function buildSoldier(team = 'red', variant = 0) {
  const root = new THREE.Group(); root.name = 'soldier';
  const tc = new THREE.Color(teamColor(team));
  const fatigue = new THREE.MeshStandardMaterial({ color: [0x4a5040, 0x5b5546, 0x3d4650][variant % 3], roughness: 0.85 });
  const teamMat = new THREE.MeshStandardMaterial({ color: tc, roughness: 0.55, metalness: 0.1, emissive: tc.clone().multiplyScalar(0.12) });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x2c3028, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xc69070, 0x8d5a3b, 0xe0b090, 0x5a3a28][variant % 4], roughness: 0.7 });
  const helm = new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.6, metalness: 0.2 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.9, roughness: 0.1, emissive: tc.clone().multiplyScalar(0.25) });
  const boot = new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.8 });
  const parts = {};
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips); parts.hips = hips;
  P(hips, rbox(0.34, 0.16, 0.2, 0.05), fatigue, 0, 0, 0);
  P(hips, rbox(0.36, 0.05, 0.22, 0.02), vestMat, 0, 0.06, 0);
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso); parts.torso = torso;
  P(torso, rbox(0.38, 0.44, 0.22, 0.07), fatigue, 0, 0.24, 0);
  P(torso, rbox(0.4, 0.34, 0.26, 0.05), vestMat, 0, 0.26, 0);
  P(torso, rbox(0.3, 0.07, 0.03, 0.01), teamMat, 0, 0.36, -0.135);           // chest team stripe
  P(torso, rbox(0.12, 0.1, 0.05, 0.02), vestMat, -0.1, 0.14, -0.14);
  P(torso, rbox(0.12, 0.1, 0.05, 0.02), vestMat, 0.1, 0.14, -0.14);
  P(torso, rbox(0.28, 0.3, 0.12, 0.04), vestMat, 0, 0.26, 0.17);              // backpack
  for (const sx of [-1, 1]) P(torso, rbox(0.12, 0.08, 0.2, 0.03), teamMat, sx * 0.22, 0.43, 0);  // shoulder pads
  const neck = new THREE.Group(); neck.position.y = 0.5; torso.add(neck); parts.head = neck;
  P(neck, cylY(0.055, 0.06, 0.08, 12), skin, 0, 0.03, 0);
  P(neck, sphere(0.11, 18, 14), skin, 0, 0.14, 0).scale.set(0.9, 1.05, 1);
  P(neck, new THREE.SphereGeometry(0.128, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), helm, 0, 0.165, 0.005);
  P(neck, rbox(0.2, 0.05, 0.04, 0.015), visor, 0, 0.15, -0.095);
  P(neck, rbox(0.03, 0.03, 0.06, 0.01), helm, 0.12, 0.17, -0.02);
  P(neck, rbox(0.26, 0.02, 0.26, 0.01), helm, 0, 0.18, 0);
  const arm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.24, 0.42, 0); torso.add(sh);
    P(sh, cylY(0.055, 0.05, 0.28, 10), fatigue, 0, -0.14, 0);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    P(el, cylY(0.048, 0.042, 0.26, 10), fatigue, 0, -0.13, 0);
    const hand = glove(mats(), sx, { guard: false }); hand.scale.setScalar(0.85); hand.position.set(0, -0.29, 0); hand.rotation.x = Math.PI / 2; el.add(hand);
    return { sh, el, hand };
  };
  parts.armR = arm(1); parts.armL = arm(-1);
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1, -0.05, 0); hips.add(hip);
    P(hip, cylY(0.075, 0.065, 0.42, 10), fatigue, 0, -0.21, 0);
    P(hip, rbox(0.1, 0.1, 0.05, 0.02), vestMat, sx * 0.05, -0.18, -0.06);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    P(knee, sphere(0.06, 10, 8), vestMat, 0, 0, -0.04);
    P(knee, cylY(0.06, 0.05, 0.42, 10), fatigue, 0, -0.21, 0);
    P(knee, rbox(0.11, 0.08, 0.24, 0.03), boot, 0, -0.44, -0.04);
    return { hip, knee };
  };
  parts.legR = leg(1); parts.legL = leg(-1);
  const weaponMount = new THREE.Group(); weaponMount.name = 'weaponMount'; parts.armR.hand.add(weaponMount);
  parts.weaponMount = weaponMount;
  // chest gun mount: grip just right of the sternum, at shoulder-pocket height
  const gunMount = new THREE.Group(); gunMount.name = 'gunMount'; gunMount.position.set(0.1, 0.32, -0.2); torso.add(gunMount); parts.gunMount = gunMount;
  root.userData.parts = parts;
  root.userData.mats = { teamMat, visor, fatigue, vestMat, skin, helm };
  shadowAll(root);
  return root;
}

// Two-bone IK in the torso frame. Arm segments hang along local -Y.
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _D = new THREE.Vector3(), _N = new THREE.Vector3(), _U = new THREE.Vector3(), _E = new THREE.Vector3(), _F = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), _Q = new THREE.Quaternion();
function ikArm(arm, target, side) {
  const L1 = 0.28, L2 = 0.3;
  _S.copy(arm.sh.position); _D.subVectors(target, _S); let d = _D.length();
  d = THREE.MathUtils.clamp(d, 0.08, (L1 + L2) * 0.985); _D.normalize();
  const a1 = Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const pole = _N.set(side * 0.6, -1, 0.35).normalize();
  const axis = _U.crossVectors(_D, pole); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
  const up = _E.copy(_D).applyAxisAngle(axis, -a1);   // upper-arm direction, bent toward the pole
  arm.sh.quaternion.setFromUnitVectors(DOWN, up);
  const elbow = _T.copy(_S).addScaledVector(up, L1);
  const fore = _F.copy(target).sub(elbow).normalize();
  fore.applyQuaternion(_Q.copy(arm.sh.quaternion).invert());
  arm.el.quaternion.setFromUnitVectors(DOWN, fore);
}
const _grip = new THREE.Vector3(), _fore = new THREE.Vector3();

// Animate a soldier rig. state: {speed, phase, aimPitch, kind, swing}
export function poseSoldier(rig, s) {
  const p = rig.userData.parts;
  const k6 = Math.min(1, s.speed / 6);
  const sw = Math.sin(s.phase) * k6 * 0.7;
  p.legR.hip.rotation.x = sw; p.legL.hip.rotation.x = -sw;
  p.legR.knee.rotation.x = Math.max(0, -Math.cos(s.phase)) * 0.8 * k6;
  p.legL.knee.rotation.x = Math.max(0, Math.cos(s.phase)) * 0.8 * k6;
  p.hips.position.y = 0.95 + Math.abs(Math.cos(s.phase)) * 0.03 * k6;
  const pitch = THREE.MathUtils.clamp(s.aimPitch || 0, -1.2, 1.2);
  // positive pitch = looking up → rotate the upper body back (rotation about +X tilts -Z forward upward)
  p.torso.rotation.x = pitch * 0.3;
  p.head.rotation.x = pitch * 0.45;
  const held = rig.userData.held;
  if (held === 'gun') {
    const gm = p.gunMount; gm.rotation.set(pitch * 0.7, 0, 0);
    gm.updateMatrix();
    _grip.set(0, -0.045, 0.015).applyMatrix4(gm.matrix);
    const fg = rig.userData.foregrip;
    if (fg) _fore.copy(fg).applyMatrix4(gm.matrix); else _fore.copy(_grip).add(_T.set(-0.05, 0.0, -0.05));
    ikArm(p.armR, _grip, 1); ikArm(p.armL, _fore, -1);
  } else if (held === 'hand') {
    const k = s.swing || 0;
    const chop = Math.sin(k * Math.PI);
    // forearm raised forward (blade/throwable up), chops forward-down on swing
    p.armR.sh.quaternion.setFromEuler(new THREE.Euler(0.95 + pitch * 0.5 + chop * 0.9, 0, 0.15 - chop * 0.2));
    p.armR.el.quaternion.setFromEuler(new THREE.Euler(0.75 + chop * 0.6, 0, 0));
    p.armL.sh.quaternion.setFromEuler(new THREE.Euler(0.5 + sw * 0.3, 0, -0.2));
    p.armL.el.quaternion.setFromEuler(new THREE.Euler(0.9, 0, 0));
  } else { // fists: boxer guard, jab on swing
    const k = s.swing || 0; const jab = Math.sin(k * Math.PI);
    p.armR.sh.quaternion.setFromEuler(new THREE.Euler(0.9 + jab * 0.6 + pitch * 0.4, 0, 0.25));
    p.armR.el.quaternion.setFromEuler(new THREE.Euler(1.5 - jab * 1.3, 0, 0));
    p.armL.sh.quaternion.setFromEuler(new THREE.Euler(0.9 + pitch * 0.4, 0, -0.25));
    p.armL.el.quaternion.setFromEuler(new THREE.Euler(1.6, 0, 0));
  }
  const spin = rig.userData.spin; if (spin) spin.rotation.z += s.firing ? 0.35 : 0;
}

const HAND_ITEMS = ['spear', 'knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer', 'frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'land_mine', 'shurikens', 'slippers', 'medkit', 'ammo_pack', 'armor_plate', 'adrenaline', 'barricade'];

// Attach a held item. Guns sit in a chest mount that follows the aim (arms IK onto grip + foregrip);
// melee/throwables/usables are held in the right hand.
export function attachWeapon(rig, id, skin) {
  const parts = rig.userData.parts;
  for (const mnt of [parts.gunMount, parts.weaponMount]) while (mnt.children.length) mnt.remove(mnt.children[0]);
  rig.userData.held = 'fists'; rig.userData.foregrip = null; rig.userData.spin = null; rig.userData.wheel = null; parts.active = null;
  if (!id || id === 'fists') return;
  const w = buildItem(id, { skin });
  const deco = w.getObjectByName('holidayDeco'); if (deco) deco.visible = false;
  if (HAND_ITEMS.includes(id)) {
    // hand frame: fingers wrap local X; undo the hand's +90° X so the item's -Z runs along the forearm's forward side
    w.rotation.set(-Math.PI / 2, 0, 0); w.position.set(0, -0.01, -0.02);
    if (['medkit', 'ammo_pack', 'armor_plate', 'barricade'].includes(id)) w.scale.setScalar(0.7);
    parts.weaponMount.add(w); rig.userData.held = 'hand'; parts.active = parts.weaponMount;
  } else {
    parts.gunMount.add(w); rig.userData.held = 'gun'; parts.active = parts.gunMount;
    const fg = findMarker(w, 'foregrip'); rig.userData.foregrip = fg ? fg.position.clone() : null;
    rig.userData.spin = w.getObjectByName('spin'); rig.userData.wheel = w.getObjectByName('wheel');
  }
}

// Practice-range target dummy: steel silhouette on a stand, bullseye on the chest.
export function buildTarget() {
  const root = new THREE.Group(); root.name = 'target';
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.2, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd02a1e, roughness: 0.5, emissive: 0x300000 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.7, roughness: 0.4 });
  P(root, cylY(0.3, 0.34, 0.08, 20), dark, 0, 0.04, 0);
  P(root, cylY(0.03, 0.03, 0.9, 10), dark, 0, 0.5, 0);
  P(root, rbox(0.62, 0.62, 0.06, 0.08), steel, 0, 1.15, 0);
  P(root, rbox(0.3, 0.12, 0.05, 0.04), steel, 0, 1.5, 0);
  P(root, sphere(0.15, 18, 12), steel, 0, 1.66, 0).scale.set(1, 1.1, 0.4);
  for (const [r, mat, z] of [[0.26, white, -0.032], [0.19, red, -0.035], [0.12, white, -0.038], [0.06, red, -0.041]]) P(root, cylY(r, r, 0.004, 28).rotateX(Math.PI / 2), mat, 0, 1.18, z);
  P(root, cylY(0.07, 0.07, 0.004, 20).rotateX(Math.PI / 2), red, 0, 1.66, -0.065);
  root.userData.parts = null; root.userData.mats = { visor: { emissiveIntensity: 1 } };
  shadowAll(root);
  return root;
}
