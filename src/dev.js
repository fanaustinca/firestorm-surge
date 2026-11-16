// window.DEV — Chrome F12 console API for rapid testing.
import * as THREE from 'three';
import { WEAPONS, WEAPON_BY_ID, ULTRA_OF, ULTRAS } from './data/weapons.js';
import { MAPS } from './world/maps.js';
import { MODES } from './game/match.js';
import { profile } from './meta/profile.js';

export function installDev(game) {
  const g = game;
  const P = () => g.player;
  const findBot = (id) => g.actors.find((a) => a.id === id) || g.actors.filter((a) => a.isBot).slice(-1)[0];
  const DEV = {
    help() {
      const lines = [
        'DEV.giveCoins(amount)', 'DEV.unlockAll()', "DEV.equip(slot, weaponId)  e.g. DEV.equip(1,'mortar')", 'DEV.setHealth(hp, armor)',
        "DEV.loadMap(mapId, mode)  maps: " + Object.keys(MAPS).join(', ') + '  modes: ' + Object.keys(MODES).join(', '),
        "DEV.spawnBot(team, weaponId, {frozen, at:[x,y,z], ahead})", 'DEV.clearBots()', 'DEV.noclip()', 'DEV.godMode()',
        "DEV.inspectGun(weaponId, {skin, angle, elev})  e.g. DEV.inspectGun('rocket_launcher_ultra')", 'DEV.exitInspect()', 'DEV.list()', 'DEV.ultras()', 'DEV.ultra()  — force ULTRA now', 'DEV.state()', 'DEV.advance(seconds)',
      ];
      console.log('%cFIRESTORM SURGE DEV\n%c' + lines.join('\n'), 'color:#ff6a1a;font-weight:900;font-size:14px', 'color:#ccc');
      return lines;
    },
    list() { return WEAPONS.map((w) => `${w.slot}: ${w.id}`); },
    ultras() { return ULTRAS.map((u) => u.id); },
    weapon(id) { return WEAPON_BY_ID[id]; },
    maps() { return Object.keys(MAPS); },
    ultra() { const p = P(); if (!p) return; const u = ULTRA_OF[p.loadout[1]]; p.aliveSince = -999; g.checkUltra(p); return p.loadout[1] || u; },
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    giveCoins(n = 1000) { profile.addCoins(n); g.ui?.g.state === 'menu' && g.ui.showMenu(); return profile.coins; },
    unlockAll() { profile.unlockAll(); if (g.state === 'menu') g.ui?.showMenu(); return `Unlocked all ${WEAPONS.length} items + slots 5 & 6`; },
    equip(slot, id) {
      const w = WEAPON_BY_ID[id]; if (!w) throw new Error('Unknown weapon ' + id);
      if (w.slot !== slot) console.warn(`${id} belongs to slot ${w.slot}; equipping there`);
      slot = w.slot; profile.equip(slot, id);
      const p = P(); if (p) {
        const lo = { ...p.loadout, [slot]: id }; const sk = { ...p.skins, [id]: profile.skinFor(id) };
        const cur = p.slot; p.setLoadout(lo, sk); p.slot = slot <= 5 ? slot : (p.weapons[cur] ? cur : 1); p.drawT = 0;
        g.vm.setWeapon(p.loadout[p.slot], p.skins[p.loadout[p.slot]]); g.hud.slotsKey = '';
      }
      return `slot ${slot} = ${id}`;
    },
    setHealth(hp = 150, armor = 0) { const p = P(); if (!p) return; p.hp = hp; p.armor = armor; if (!p.alive && hp > 0) { p.alive = true; } return { hp: p.hp, armor: p.armor }; },
    loadMap(mapId = 'cargo_yard', mode) { if (!MAPS[mapId]) throw new Error('maps: ' + Object.keys(MAPS)); g.ui.root.style.display = 'none'; return g.startMatch({ mapId, modeId: mode || g.modeId || 'red_vs_blue', online: false }); },
    spawnBot(team, weaponId, opts = {}) {
      if (!g.match) throw new Error('Start a match first (DEV.loadMap)');
      const p = P(); team = team || (p.team === 'red' ? 'blue' : p.team === 'blue' ? 'red' : 'ffa');
      const a = g.addBot({ index: 100 + g.actors.length, team, weapon: weaponId });
      a.dev = true;
      let pos = opts.at ? new THREE.Vector3(...opts.at) : null;
      if (!pos && opts.ahead != null && p) pos = p.pos.clone().addScaledVector(p.forward(new THREE.Vector3()), opts.ahead);
      if (!pos) pos = g.match.spawnFor(a);
      a.respawn(pos, opts.yaw ?? Math.atan2(p ? p.pos.x - pos.x : 0, p ? p.pos.z - pos.z : 1) + Math.PI);
      if (weaponId) { const w = WEAPON_BY_ID[weaponId]; if (w && w.slot <= 5) a.slot = w.slot; }
      a.spawnProtect = 0;
      if (opts.frozen) g.brains.get(a).frozen = true;
      return a.id;
    },
    clearBots() { const n = g.actors.filter((a) => a.isBot).length; for (const a of g.actors.filter((x) => x.isBot)) g.removeActor(a); return `removed ${n} bots`; },
    noclip() { g.noclip = !g.noclip; return 'noclip ' + (g.noclip ? 'ON' : 'OFF'); },
    godMode() { g.god = !g.god; return 'god mode ' + (g.god ? 'ON' : 'OFF'); },
    inspectGun(id, opts) { if (!WEAPON_BY_ID[id]) throw new Error('Unknown item ' + id); g.ui.root.style.display = 'none'; return g.inspect(id, opts); },
    exitInspect() { g.exitInspect(true); },
    advance(sec = 1) { g.advance(sec); return DEV.state(); },
    // ── test helpers ──
    state() {
      const p = P(); if (!p) return { state: g.state };
      return { state: g.state, map: g.mapId, mode: g.modeId, pos: p.pos.toArray().map((x) => +x.toFixed(3)), vel: p.vel.toArray().map((x) => +x.toFixed(3)), hspeed: +Math.hypot(p.vel.x, p.vel.z).toFixed(3), onGround: p.onGround, hp: p.hp, armor: p.armor, slot: p.slot, weapon: p.loadout[p.slot], speedMult: +p.speedMult().toFixed(3), thermal: { ...p.thermal }, actors: g.actors.length, alive: p.alive, ammo: p.ws ? { mag: p.ws.mag, reserve: p.ws.reserve } : null };
    },
    bot(id) { const b = findBot(id); return b && { id: b.id, hp: b.hp, armor: b.armor, alive: b.alive, pos: b.pos.toArray(), thermal: !!b.thermalHighlighted, team: b.team, weapon: b.loadout[b.slot] }; },
    input(v) { g.input.virtual = v ? { ...v } : null; },
    select(slot) { const p = P(); p.switchSlot(slot); p.drawT = 0; g.vm.setWeapon(p.loadout[p.slot], p.skins[p.loadout[p.slot]]); return p.loadout[p.slot]; },
    look(yaw, pitch = 0) { const p = P(); p.yaw = yaw; p.pitch = pitch; },
    aimAt(id, part = 'body') {
      const p = P(), b = findBot(id); const tgt = part === 'head' ? b.headPos(new THREE.Vector3()) : part === 'feet' ? b.pos.clone() : b.chest(new THREE.Vector3()).add(new THREE.Vector3(0, -0.1, 0));
      const d = tgt.sub(p.eye(new THREE.Vector3())); p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.recoil = 0; p.bloom = 0;
    },
    teleport(x, y, z, yaw) { const p = P(); p.pos.set(x, y, z); p.vel.set(0, 0, 0); if (yaw != null) p.yaw = yaw; },
    setThermal(on) { const p = P(); if (p.thermal.on !== !!on) g.toggleThermal(); return p.thermal.on; },
    throwAt(x, y, z, weaponId = 'smoke_grenade') {
      const d = WEAPON_BY_ID[weaponId]; const p = P();
      const impact = d.impact || d.mine;
      const pr = g.combat.spawnProj(p, d, d.proj, new THREE.Vector3(x, y + 1, z), new THREE.Vector3(0, impact ? -8 : -1, 0), { fuse: impact ? Infinity : 0.05 });
      return pr.id;
    },
    game: g, profile,
  };
  window.DEV = DEV;
  return DEV;
}
