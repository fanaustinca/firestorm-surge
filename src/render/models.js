import * as THREE from 'three';
import { makeMaterials, P, rbox, cylY, cylZ, sphere, latheZ, shadowAll } from './modelKit.js';
import { GUN_BUILDERS } from './gunModels.js';
import { GEAR_BUILDERS, starGeo, slipperMesh, glove } from './gearModels.js';
import { HOLIDAY_SKINS } from '../data/weapons.js';

const matCache = new Map();
export function mats(skin = null) {
  const k = skin || 'base';
  if (!matCache.has(k)) matCache.set(k, makeMaterials(skin));
  return matCache.get(k);
}

export const BUILDERS = { ...GUN_BUILDERS, ...GEAR_BUILDERS };

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
  const g = b(mats(skin), { holiday: holiday === undefined ? holidayFor(id) : holiday });
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
      case 'taser': P(g, cylZ(0.006, 0.006, 0.03, 6), m.glowBlue); break;
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
  root.userData.parts = parts;
  root.userData.mats = { teamMat, visor, fatigue, vestMat, skin, helm };
  shadowAll(root);
  return root;
}

// Animate a soldier rig. state: {speed, phase, aimPitch, kind, swing, crouch}
export function poseSoldier(rig, s) {
  const p = rig.userData.parts;
  const sw = Math.sin(s.phase) * Math.min(1, s.speed / 6) * 0.7;
  p.legR.hip.rotation.x = sw; p.legL.hip.rotation.x = -sw;
  p.legR.knee.rotation.x = Math.max(0, -Math.cos(s.phase)) * 0.8 * Math.min(1, s.speed / 6);
  p.legL.knee.rotation.x = Math.max(0, Math.cos(s.phase)) * 0.8 * Math.min(1, s.speed / 6);
  p.hips.position.y = 0.95 + Math.abs(Math.cos(s.phase)) * 0.03 * Math.min(1, s.speed / 6);
  const pitch = s.aimPitch || 0;
  p.head.rotation.x = -pitch * 0.5;
  p.torso.rotation.x = -pitch * 0.3;
  if (s.kind === 'melee') {
    const k = s.swing || 0;
    p.armR.sh.rotation.set(-1.2 - pitch * 0.5 + Math.sin(k * Math.PI) * -1.2, 0, -0.2 + k * 0.6);
    p.armR.el.rotation.set(-0.6 + k * 0.5, 0, 0);
    p.armL.sh.rotation.set(-0.3 + sw * 0.4, 0, 0.15); p.armL.el.rotation.set(-0.4, 0, 0);
  } else {
    p.armR.sh.rotation.set(-1.25 - pitch * 0.7, 0.1, -0.15);
    p.armR.el.rotation.set(-0.35, 0, 0);
    p.armL.sh.rotation.set(-1.35 - pitch * 0.7, -0.55, 0.25);
    p.armL.el.rotation.set(-0.45, 0, 0);
  }
}

// Attach a held weapon to the rig's hand mount.
export function attachWeapon(rig, id, skin) {
  const mount = rig.userData.parts.weaponMount;
  while (mount.children.length) mount.remove(mount.children[0]);
  if (!id) return;
  const w = buildItem(id, { skin });
  // hand is rotated x=+90deg (fingers forward-down); undo for gun orientation
  const melee = ['knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer'].includes(id);
  if (id === 'fists') return;
  if (melee) { w.rotation.set(-Math.PI / 2, 0, 0); w.position.set(0, 0.0, -0.02); }
  else { w.rotation.set(-Math.PI / 2, 0, 0); w.position.set(0, -0.01, 0.0); }
  mount.add(w);
}
