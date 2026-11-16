// Firestorm Surge — headless browser E2E suite.
// Launches `vite preview`, opens the game in headless Chrome (WebGL via ANGLE/SwiftShader by default),
// asserts zero runtime errors, verifies movement/jump/damage/popup/thermal mechanics and captures screenshots.
// Usage: node tests/e2e.mjs [--quick] [--out dir]      (GL=vulkan for GPU-accelerated local runs)
import fs from 'node:fs';
import { startServer, launch, openGame, wait } from './lib.mjs';

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'test-results';
fs.mkdirSync(OUT, { recursive: true });

const results = []; const errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const srv = await startServer(4300 + Math.floor(Math.random() * 200));
const browser = await launch();
let page;
const shot = async (name) => { const f = `${OUT}/${name}.png`; await page.screenshot({ path: f }); console.log('   📸', f); return f; };

try {
  page = await openGame(browser, srv.url, errors);
  await wait(400);
  await shot('00-menu');
  const menu = await page.evaluate(() => ({ play: !!document.querySelector('#play'), dev: typeof DEV.inspectGun === 'function', maps: document.querySelectorAll('[data-map]').length, modes: [...document.querySelectorAll('[data-mode]')].map((b) => b.dataset.mode), ver: document.querySelector('.logo .ver')?.textContent }));
  check('Menu: mode-only selection (no map picker) + version tag', menu.play && menu.dev && menu.maps === 0 && menu.modes.includes('practice') && menu.modes.length === 5 && /^v\d+\.\d+\.\d+$/.test(menu.ver || ''), `${menu.modes.join(',')} · ${menu.ver}`);
  const SPEC_IDS = ['assault_rifle', 'ak47', 'dmr', 'rocket_launcher', 'burst_rifle', 'lmg', 'heavy_sniper', 'flamethrower', 'grenade_launcher', 'mortar',
    'volt_rail', 'arc_caster', 'drum_breaker',
    'pistol', 'smg', 'crossbow', 'burst_pistol', 'revolver', 'sawed_off', 'tactical_shotgun', 'taser', 'pocket_rocket',
    'fists', 'knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer', 'shurikens', 'slippers',
    'frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'land_mine', 'medkit', 'ammo_pack', 'armor_plate', 'adrenaline', 'barricade',
    'tactical_gloves', 'spring_boots', 'bandolier', 'blast_vest', 'thermal_goggles'];
  const have = await page.evaluate(() => DEV.list().map((x) => x.split(': ')[1]));
  const missing = SPEC_IDS.filter((x) => !have.includes(x));
  check('Every item exists (39 + 3 slot freebies + Land Mine + 4 new guns)', missing.length === 0 && have.length === SPEC_IDS.length, missing.length ? 'missing ' + missing : `${have.length} entries`);
  const meshes = await page.evaluate((ids) => ids.map((id) => { try { DEV.inspectGun(id); let n = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) n++; }); return [id, n]; } catch (e) { return [id, -1, e.message]; } }), SPEC_IDS);
  const thin = meshes.filter(([, n]) => n < 5);
  check('All 43 item meshes are multi-part (≥5 meshes each)', thin.length === 0, thin.length ? JSON.stringify(thin) : `min ${Math.min(...meshes.map((m) => m[1]))} meshes`);
  const ultras = await page.evaluate(() => DEV.ultras().map((id) => { DEV.inspectGun(id); let n = 0, glow = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) { n++; if (o.material.emissiveIntensity > 1.5) glow++; } }); return [id, n, glow]; }));
  const baseCounts = await page.evaluate(() => Object.fromEntries(DEV.ultras().map((u) => { const id = u.replace('_ultra', ''); DEV.inspectGun(id); let n = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) n++; }); return [id, n]; })));
  check('Every main firearm has a distinct ULTRA model in standard colours (no neon glow)', ultras.length === 13 && ultras.every(([id, n, gl]) => n >= 10 && gl <= 2 && n !== baseCounts[id.replace('_ultra', '')]), ultras.map(([i, n, gl]) => `${i.replace('_ultra', '')}:${n}/${gl}`).join(' '));
  const spinners = await page.evaluate(() => { DEV.inspectGun('rocket_launcher_ultra'); const h = DEV.game.studio.holder; const wheel = h.getObjectByName('wheel'); const rockets = [0, 1, 2, 3, 4, 5].filter((i) => wheel?.getObjectByName('rk' + i)).length; DEV.inspectGun('lmg_ultra'); let barrels = 0; DEV.game.studio.holder.getObjectByName('spin')?.traverse((o) => { if (o.isMesh && o.geometry.parameters?.height > 0.6) barrels++; }); return { wheel: !!wheel, rockets, barrels, mag: DEV.weapon('rocket_launcher_ultra').mag }; });
  check('Ultra rocket launcher: single barrel fed by a 6-rocket revolving cylinder; Ultra LMG has 6 rotating barrels', spinners.wheel && spinners.rockets === 6 && spinners.mag === 6 && spinners.barrels === 6, JSON.stringify(spinners));
  const ultraStats = await page.evaluate(() => { const W = DEV.game.constructor && null; void W; const by = (id) => DEV.game.player ? null : null; void by; return null; });
  void ultraStats;

  // ───────── gun showcase ─────────
  const guns = QUICK ? ['ak47', 'rocket_launcher_ultra'] : ['ak47', 'heavy_sniper', 'mortar', 'rocket_launcher', 'land_mine', 'rocket_launcher_ultra', 'mortar_ultra', 'flamethrower_ultra', 'lmg_ultra', 'heavy_sniper_ultra', 'assault_rifle_ultra', 'ak47_ultra', 'grenade_launcher_ultra', 'dmr_ultra', 'burst_rifle_ultra'];
  for (const id of guns) {
    const info = await page.evaluate((i) => { const r = DEV.inspectGun(i, { angle: 0.75, elev: 0.3 }); DEV.game.studio.auto = false; return r; }, id);
    await wait(150);
    await shot(`gun-${id}`);
    check(`inspectGun(${id}) builds a multi-part mesh`, info && info.size.every((s) => s > 0.01), `size ${info.size.map((s) => s.toFixed(2)).join('×')}`);
  }
  await page.evaluate(() => DEV.exitInspect());

  // ───────── maps ─────────
  const ALL_MAPS = ['cargo_yard', 'desert_outpost', 'abandoned_city', 'underground_lab', 'frostbite', 'jungle_temple', 'neon_market', 'refinery'];
  const maps = QUICK ? ['cargo_yard', 'jungle_temple'] : ALL_MAPS;
  check('8 maps registered', (await page.evaluate(() => DEV.maps().length)) === 8);
  for (const m of maps) {
    await page.evaluate((id) => { DEV.loadMap(id, 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); }, m);
    await wait(250);
    await shot(`map-${m}`);
    const st = await page.evaluate(() => {
      const g = DEV.game, w = g.map.world, nav = g.map.nav; const hs = [...nav.nodeH]; const levels = new Set(hs.map((h) => Math.round(h / 3)));
      // every spawn must stand on a walkable ground node; map must be ≤ 60 m wide
      const badSpawn = [...g.map.spawns.red, ...g.map.spawns.blue, ...g.map.spawns.ffa].filter((p) => { const i = Math.floor(p.x + nav.half), j = Math.floor(p.z + nav.half); return !nav.cellNodes[i * nav.N + j].some((n) => Math.abs(nav.nodeH[n] - p.y) < 0.6); });
      // open space: fraction of ground cells with nothing overhead within 20 m of the centre
      let open = 0, tot = 0; for (let i = 0; i < nav.N; i++) for (let j = 0; j < nav.N; j++) { const x = i - nav.half + 0.5, z = j - nav.half + 0.5; if (Math.hypot(x, z) > 20) continue; tot++; if (nav.cellNodes[i * nav.N + j].length) open++; }
      return { boxes: w.boxes.length, climb: w.boxes.filter((b) => b.climbable).length, levels: [...levels].sort(), maxH: Math.max(...hs), links: nav.links.size, badSpawn: badSpawn.length, open: open / tot, bounds: w.bounds };
    });
    check(`Map ${m}: 3 stories + roofs, open centre, ladders linked`, st.maxH >= 6 && st.levels.length >= 3 && st.open > 0.55 && st.links >= 4 && st.badSpawn === 0 && st.bounds === 30, `${st.boxes} colliders · levels ${st.levels.join('/')} (top ${st.maxH} m) · ${Math.round(st.open * 100)}% open centre · ${st.links} climb links · ${st.badSpawn} bad spawns`);
  }
  const terr = await page.evaluate(() => Object.fromEntries(['frostbite', 'jungle_temple', 'underground_lab'].map((id) => { DEV.loadMap(id, 'practice'); const w = DEV.game.map.world; let mtn = false; DEV.game.map.group.traverse((o) => { if (o.isMesh && o.material.vertexColors && o.geometry.attributes.color) mtn = true; }); return [id, { maxH: +(w.terrain?.maxH || 0).toFixed(2), mountains: mtn }]; })));
  check('Outdoor maps have rolling terrain + mountain ranges (indoor lab stays flat)', terr.frostbite.maxH > 0.5 && terr.jungle_temple.maxH > 0.5 && terr.frostbite.mountains && terr.underground_lab.maxH === 0, JSON.stringify(terr));
  const adsL = await page.evaluate(() => { const g = DEV.game; DEV.loadMap('cargo_yard', 'practice'); g.timeScale = 0; DEV.advance(3.3); const out = {}; for (const id of ['lmg', 'lmg_ultra', 'ak47']) { g.vm.setWeapon(id, null); out[id] = +(g.vm.adsSight.y - g.vm.sight.position.y).toFixed(3); } return out; });
  check('ADS line is raised clear of carry handles / housings', adsL.lmg > 0 && adsL.lmg_ultra > 0, JSON.stringify(adsL));
  // the exact screen centre must not be covered by any solid part of the gun while aiming (non-scoped guns)
  const adsC = await page.evaluate(() => { const g = DEV.game, T = DEV.THREE; const out = {};
    for (const [s, id] of [[1, 'grenade_launcher_ultra'], [1, 'rocket_launcher_ultra'], [1, 'lmg_ultra'], [1, 'ak47'], [1, 'drum_breaker'], [2, 'pistol'], [2, 'smg'], [2, 'pocket_rocket']]) {
      DEV.equip(s, id); DEV.select(s); DEV.advance(0.6); DEV.input({ alt: true }); DEV.advance(0.8); g.renderFrame(1 / 60);
      const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(0, 0), g.vm.camera); const meshes = []; g.vm.item.traverse((o) => { if (o.isMesh && o.visible && !o.material.userData?.seeThru) meshes.push(o); });
      out[id] = rc.intersectObjects(meshes, false).length; DEV.input(null); DEV.advance(0.4);
    }
    return { blocked: Object.entries(out).filter(([, n]) => n).map(([k]) => k), dot: !!document.querySelector('#adsdot') }; });
  check('Aiming down sights: nothing covers the aim point + red-dot reticle', adsC.blocked.length === 0 && adsC.dot, JSON.stringify(adsC));
  const mtn = await page.evaluate(() => Object.fromEntries(DEV.maps().map((id) => { DEV.loadMap(id, 'practice'); let inside = 0; DEV.game.map.group.traverse((o) => { if (o.isMesh && o.material.vertexColors && o.geometry.attributes.color) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 31 && Math.abs(p.getZ(i)) < 31) inside++; } }); return [id, inside]; })));
  check('Mountains never intrude into the arena (no walking into them)', Object.values(mtn).every((n) => n === 0), JSON.stringify(mtn));
  // bots must be able to path to and reach upper floors (stairs, ladders, bridges)
  const reach = await page.evaluate(() => {
    const out = []; const g = DEV.game;
    for (const [id, from, to] of [['cargo_yard', [0, 0, 20], [0, 6, -0.5]], ['jungle_temple', [0, 0, 25], [0, 9, 2]], ['underground_lab', [5, 0, 0], [0, 6, -28]], ['refinery', [0, 0, 25], [-20, 8, -18]]]) {
      DEV.loadMap(id, 'ffa'); g.timeScale = 0; DEV.clearBots(); DEV.advance(3.4);
      const bid = DEV.spawnBot('blue', 'assault_rifle', { at: from }); const b = g.actors.find((a) => a.id === bid); const br = g.brains.get(b); const V = b.pos.constructor;
      br.think = function () { this.goal = new V(...to); this.state = 'roam'; this.target = null; this.pathT -= 0.15; if (!this.path || this.pathT <= 0) { this.path = g.botFind(g.map.nav, b.pos, this.goal); this.pathT = 2; } };
      let ok = false, t = 0; for (; t < 60 * 40 && !ok; t++) { g.fixedUpdate(1 / 60); ok = Math.hypot(b.pos.x - to[0], b.pos.z - to[2]) < 2 && Math.abs(b.pos.y - to[1]) < 0.6; }
      out.push(`${id}→${to[1]}m:${ok ? (t / 60).toFixed(1) + 's' : 'FAIL'}`);
    }
    return out;
  });
  check('Bots navigate to upper floors (stairs / ladders / bridges)', reach.every((r) => !r.includes('FAIL')), reach.join(' '));
  if (!QUICK) {
    await page.evaluate(() => { DEV.loadMap('abandoned_city', 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.teleport(0, 6, 9, 0); DEV.look(0.9, -0.1); DEV.advance(0.1); });
    await wait(200); await shot('map-abandoned_city-bridge');
  }

  // ───────── movement: active-hand weight ─────────
  await page.evaluate(() => { DEV.unlockAll(); DEV.loadMap('cargo_yard', 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.godMode(); });
  const speed = await page.evaluate(() => {
    const out = {};
    for (const [slot, id] of [[3, 'fists'], [1, 'mortar']]) {
      DEV.equip(slot, id); DEV.select(slot); DEV.teleport(-20, 0, 28, -Math.PI / 2); DEV.advance(0.1);
      DEV.input({ forward: true }); DEV.advance(1.0);
      out[id] = { hspeed: DEV.state().hspeed, mult: DEV.state().speedMult }; DEV.input(null); DEV.advance(0.3);
    }
    return out;
  });
  check('Fists (1.15×) run speed = 8.05 m/s', near(speed.fists.hspeed, 8.05, 0.02), `${speed.fists.hspeed} m/s (${speed.fists.mult}×)`);
  check('Mortar (0.80×) run speed = 5.60 m/s', near(speed.mortar.hspeed, 5.6, 0.02), `${speed.mortar.hspeed} m/s (${speed.mortar.mult}×)`);

  // ───────── jump physics ─────────
  const jump = await page.evaluate(() => {
    const g = DEV.game; const p = g.player; const res = {};
    const run = (doubleJump) => {
      DEV.teleport(0, 0, 28); DEV.advance(0.2); let maxY = 0; const y0 = p.pos.y;
      DEV.input({ jumpPressed: true }); g.fixedUpdate(1 / 60);
      let pressedSecond = false;
      for (let i = 0; i < 180; i++) {
        if (doubleJump && !pressedSecond && p.vel.y <= 0.05) { DEV.input({ jumpPressed: true }); pressedSecond = true; }
        g.fixedUpdate(1 / 60); maxY = Math.max(maxY, p.pos.y - y0);
      }
      DEV.input(null); return +maxY.toFixed(3);
    };
    DEV.equip(6, 'tactical_gloves'); res.single = run(false);
    DEV.equip(6, 'spring_boots'); res.double = run(true);
    DEV.equip(6, 'tactical_gloves'); res.noBootsDouble = run(true);
    return res;
  });
  check('Single jump peak ≈ 1.25 m', near(jump.single, 1.25, 0.06), `${jump.single} m`);
  check('Spring Boots double jump reaches ≈ 2.4 m', jump.double >= 2.3 && jump.double <= 2.6, `${jump.double} m`);
  check('No double jump without Spring Boots', jump.noBootsDouble < 1.35, `${jump.noBootsDouble} m`);

  // ───────── climbing: everyone uses ladders; only Fists scale plain walls ─────────
  const climb = await page.evaluate(() => {
    const g = DEV.game; const run = (slot, id, x, z, yaw, steps = 150) => {
      DEV.equip(slot, id); DEV.select(slot); DEV.teleport(x, 0, z, yaw); DEV.advance(0.5); DEV.input({ forward: true }); let maxY = 0;
      for (let i = 0; i < steps; i++) { g.fixedUpdate(1 / 60); maxY = Math.max(maxY, g.player.pos.y); if (g.player.pos.y > 5.9 && g.player.onGround) break; }
      DEV.input(null); DEV.advance(0.5); return { maxY: +maxY.toFixed(2), endY: +g.player.pos.y.toFixed(2) };
    };
    // bridge ladder at (0, 1.15) facing +z → bridge deck at 6 m
    const ladderKnife = run(3, 'knife', 0, 1.9, 0);
    // plain office wall (east face of the west tower at x = -14 has a solid strip at z = 4.5)
    const wallFists = run(3, 'fists', -13.3, 4.4, Math.PI / 2, 220);
    const wallKnife = run(3, 'knife', -13.3, 4.4, Math.PI / 2, 220);
    return { ladderKnife, wallFists, wallKnife };
  });
  check('Ladders work with any item (knife climbs onto the 6 m bridge)', climb.ladderKnife.endY > 5.9, JSON.stringify(climb.ladderKnife));
  check('Fists can climb ANY wall', climb.wallFists.maxY > 3, JSON.stringify(climb.wallFists));
  check('Knife cannot climb a plain wall', climb.wallKnife.maxY < 1.4, JSON.stringify(climb.wallKnife));

  // ───────── damage: assault rifle body/head ─────────
  const dmg = await page.evaluate(() => {
    const g = DEV.game; DEV.teleport(-10, 0, 28, -Math.PI / 2); DEV.advance(0.1);
    const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [-4, 0, 28] });
    DEV.equip(1, 'assault_rifle'); DEV.select(1); DEV.advance(0.6);
    const b = () => DEV.bot(id); const fire = (part) => { DEV.aimAt(id, part); DEV.input({ alt: true }); DEV.advance(0.3); DEV.aimAt(id, part); DEV.input({ alt: true, fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input({ alt: true }); DEV.advance(0.25); DEV.input(null); return b(); };
    const h0 = b().hp; const a = fire('body'); const h1 = a.hp; const c = fire('head'); const h2 = c.hp;
    return { id, h0, body: h0 - h1, head: h1 - h2, hp: h2 };
  });
  check('Assault Rifle body shot deals 20', dmg.body === 20, `${dmg.body}`);
  check('Assault Rifle headshot deals 30', dmg.head === 30, `${dmg.head}`);

  // ───────── new guns + mortar ─────────
  const ng = await page.evaluate(() => {
    const g = DEV.game; const god0 = g.god; DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); g.god = true;
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.1);
    const shoot = (slot, w, id, n = 1) => { DEV.equip(slot, w); DEV.select(slot); DEV.advance(0.6); for (let k = 0; k < n; k++) { DEV.aimAt(id, 'body'); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.35); } };
    const hp = (id) => DEV.bot(id).hp;
    // Volt Rail: two bots in a line → both take damage from one slug
    const a1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }), a2 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-2, 0, 28] });
    const v0 = [hp(a1), hp(a2)]; shoot(1, 'volt_rail', a1); const volt = [v0[0] - hp(a1), v0[1] - hp(a2)];
    DEV.clearBots();
    // Arc Caster: hit one bot, lightning jumps to a neighbour 3 m away
    const c1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }), c2 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 31] });
    const w0 = hp(c2); shoot(1, 'arc_caster', c1); const arc = w0 - hp(c2);
    DEV.clearBots();
    // Drum Breaker is full-auto: holding the trigger keeps firing
    DEV.equip(1, 'drum_breaker'); DEV.select(1); DEV.advance(0.6); const m0 = g.player.ws.mag; DEV.input({ fire: true }); DEV.advance(1.0); DEV.input(null); const drum = m0 - g.player.ws.mag;
    // Pocket Rocket: explosive pistol round
    const r1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-5, 0, 28] }); const r0 = hp(r1); shoot(2, 'pocket_rocket', r1); DEV.advance(0.5); const rocket = r0 - hp(r1);
    DEV.clearBots();
    // Mortar: 3-shell tube, landing marker shows only while holding it
    DEV.equip(1, 'mortar'); DEV.select(1); DEV.advance(0.6); g.renderFrame(1 / 60); const mk = !!g.mortarMark?.visible; const md = DEV.weapon('mortar');
    DEV.select(2); DEV.advance(0.6); g.renderFrame(1 / 60); const mkOff = !g.mortarMark.visible;
    g.god = god0;
    return { volt, arc, drum, rocket, mortar: { mag: md.mag, radius: md.splash.radius, marker: mk, hiddenOtherwise: mkOff }, ultraCluster: DEV.weapon('mortar_ultra').cluster };
  });
  check('Volt Rail slug pierces both enemies in line', ng.volt[0] > 0 && ng.volt[1] > 0, JSON.stringify(ng.volt));
  check('Arc Caster lightning chains to a nearby enemy', ng.arc > 0, `${ng.arc} chain dmg`);
  check('Drum Breaker is full-auto; Pocket Rocket explodes', ng.drum >= 4 && ng.rocket >= 50, `drum ${ng.drum} shells/s · rocket ${ng.rocket}`);
  check('Mortar buffed (3-shell tube, 12.5 m) + shooter-only landing marker; Ultra shells cluster', ng.mortar.mag === 3 && ng.mortar.radius >= 12 && ng.mortar.marker && ng.mortar.hiddenOtherwise && ng.ultraCluster === 3, JSON.stringify(ng.mortar));

  // ───────── bot tiers ─────────
  const tiers = await page.evaluate(async () => {
    const bt = DEV.botTier; let maxVet = 0, withVet = 0, casual = 0, normal = 0, stable = true;
    for (let k = 0; k < 300; k++) { const seed = 'ffa:' + k + ':cargo_yard'; let v = 0; for (let s = 1; s < 8; s++) { const t = bt(seed, s, 1, 8); if (t !== bt(seed, s, 1, 8)) stable = false; if (t === 'veteran') v++; else if (t === 'casual') casual++; else normal++; } maxVet = Math.max(maxVet, v); if (v) withVet++; }
    // casual bot: plants its feet while aiming, never swaps off its primary
    const g = DEV.game; const god0 = g.god; DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); g.god = true;
    DEV.teleport(-12, 0, 28, Math.PI / 2); DEV.advance(0.1);
    const id = DEV.spawnBot('ffa', 'rocket_launcher', { at: [-4, 0, 28], tier: 'casual' }); const bot = g.actors.find((a) => a.id === id); bot.yaw = Math.PI / 2;
    DEV.advance(2.5); const p0 = bot.pos.clone(); DEV.advance(2.0); const moved = bot.pos.distanceTo(p0); const slot = bot.slot; DEV.clearBots();
    const vid = DEV.spawnBot('ffa', 'ak47', { at: [-4, 0, 24], tier: 'veteran' }); const vb = g.actors.find((a) => a.id === vid); vb.yaw = Math.PI / 2;
    let vjump = 0; const vp = vb.pos.clone(); for (let i = 0; i < 40; i++) { DEV.advance(0.1); if (!vb.onGround) vjump++; } const vmoved = vb.pos.distanceTo(vp);
    g.god = god0; DEV.clearBots();
    return { maxVet, withVet, casual, normal, stable, casualMoved: +moved.toFixed(2), casualSlot: slot, vetMoved: +vmoved.toFixed(2), vetAir: vjump, plate: bot.tier };
  });
  check('Bot tiers: 0–1 veteran per match, rest split casual/normal (deterministic for all peers)', tiers.maxVet === 1 && tiers.withVet > 100 && tiers.withVet < 250 && tiers.casual > 300 && tiers.normal > 300 && tiers.stable, JSON.stringify(tiers));
  check('Casual bots stand still to aim and keep their weapon; veterans move + jump while fighting', tiers.casualMoved < 0.3 && tiers.casualSlot === 1, JSON.stringify(tiers));
  check('Veteran bots zig-zag and jump while shooting', tiers.vetMoved > 1 && tiers.vetAir > 0, JSON.stringify(tiers));
  // restore the shared red-vs-blue state the following checks expect (frozen blue bot in front of the player)
  await page.evaluate(() => { const g = DEV.game; DEV.loadMap('cargo_yard', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.teleport(-10, 0, 28, -Math.PI / 2); DEV.advance(0.1); DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [-4, 0, 28] }); DEV.equip(1, 'assault_rifle'); DEV.select(1); DEV.advance(0.6); });

  // ───────── slippers → EMOTIONAL DAMAGE ─────────
  const emo = await page.evaluate(() => {
    const g = DEV.game; const id = g.actors.find((a) => a.isBot).id; DEV.bot(id); g.actors.find((a) => a.id === id).hp = 150;
    DEV.equip(3, 'slippers'); DEV.select(3); DEV.advance(0.3);
    DEV.aimAt(id, 'body'); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null);
    let popup = false, hud = false;
    for (let i = 0; i < 40; i++) { g.fixedUpdate(1 / 60); if (g.effects.popups.length) popup = true; if (document.querySelector('#emo.on')) hud = true; }
    g.renderFrame(1 / 60);
    return { popup, hud, hp: DEV.bot(id).hp, last: g.lastEmotional, id };
  });
  await shot('emotional-damage');
  check('Slippers hit deals 75', emo.hp === 75, `bot hp ${emo.hp}`);
  check('Slippers trigger "EMOTIONAL DAMAGE" 3D + HUD popup', emo.popup && emo.hud && emo.last?.target === emo.id, `3D:${emo.popup} HUD:${emo.hud}`);

  // ───────── smoke + thermal ─────────
  const th = await page.evaluate(() => {
    const g = DEV.game; const id = g.actors.find((a) => a.isBot).id; const bot = g.actors.find((a) => a.id === id);
    DEV.equip(6, 'thermal_goggles'); DEV.equip(1, 'assault_rifle'); DEV.select(1); DEV.advance(0.4);
    DEV.throwAt(-7, 0, 28, 'smoke_grenade'); DEV.advance(2.0);
    DEV.aimAt(id, 'body'); DEV.advance(0.05);
    const eye = g.player.eye(); const chest = bot.chest();
    const blocked = g.combat.inSmoke(eye, chest);
    g.renderFrame(1 / 60); const before = !!bot.thermalHighlighted;
    const on = DEV.setThermal(true); g.renderFrame(1 / 60);
    return { blocked, before, on, after: !!bot.thermalHighlighted, battery: g.player.thermal.battery };
  });
  await shot('smoke-thermal');
  check('Smoke cloud blocks line of sight to the bot', th.blocked);
  check('Thermal Goggles highlight the bot through smoke', !th.before && th.on && th.after, `before:${th.before} after:${th.after}`);
  await page.evaluate(() => { DEV.setThermal(false); DEV.game.renderFrame(1 / 60); });
  await shot('smoke-no-thermal');

  // ───────── viewmodel during gameplay + combat sanity ─────────
  await page.evaluate(() => { DEV.loadMap('cargo_yard', 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); DEV.equip(1, 'ak47'); DEV.select(1); DEV.advance(0.5); });
  await shot('viewmodel-ak47');
  if (!QUICK) {
    for (const [slot, id] of [[1, 'heavy_sniper'], [1, 'flamethrower'], [3, 'katana'], [3, 'scythe'], [2, 'revolver'], [4, 'frag'], [1, 'rocket_launcher'], [3, 'slippers']]) {
      await page.evaluate((s, w) => { DEV.equip(s, w); DEV.select(s); DEV.advance(0.4); }, slot, id); await wait(80); await shot(`viewmodel-${id}`);
    }
    // ADS scope
    await page.evaluate(() => { DEV.equip(1, 'heavy_sniper'); DEV.select(1); DEV.input({ alt: true }); DEV.advance(0.5); });
    await shot('ads-heavy_sniper'); await page.evaluate(() => DEV.input(null));
    // mortar: no warning ring any more, and a much bigger blast
    const mort = await page.evaluate(() => { const g = DEV.game; DEV.clearBots(); DEV.equip(1, 'mortar'); DEV.select(1); DEV.teleport(0, 0, 25, 0); DEV.look(0, -0.15); DEV.advance(0.5); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); let rings = 0, boom = false; const n0 = g.combat.projs.length; for (let i = 0; i < 240; i++) { g.fixedUpdate(1 / 60); rings = Math.max(rings, g.effects.rings.length); if (n0 && !g.combat.projs.length) { boom = true; break; } } return { rings, boom }; });
    check('Mortar fires with NO warning ring', mort.rings === 0 && mort.boom, JSON.stringify(mort));
    // a live bot match for a few seconds — bots must fight without errors
    const live = await page.evaluate(() => { DEV.loadMap('desert_outpost', 'ffa'); DEV.game.timeScale = 0; DEV.godMode(); DEV.advance(3.3); DEV.advance(20); const s = DEV.game.actors.map((a) => a.stats.kills).reduce((x, y) => x + y, 0); return { kills: s, actors: DEV.game.actors.length }; });
    await shot('ffa-desert-20s');
    check('Bots fight in a 20 s FFA simulation', live.kills > 0, `${live.kills} kills among ${live.actors} players`);
  }

  // ───────── explosives: severely buffed damage + radius ─────────
  const boom = await page.evaluate(() => {
    const g = DEV.game; DEV.loadMap('refinery', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.godMode();
    const out = {};
    const V = g.camera.position.constructor; let Z = 20;   // find an obstacle-free 11 m lane (maps have random cover props)
    const w = g.map.world; for (let z = 22; z > -22; z -= 0.5) if (w.lineOfSight(new V(0, 0.3, z), new V(11, 1.2, z)) && w.lineOfSight(new V(0, 0.3, z), new V(11, 1.62, z)) && w.groundHeightAt(0, z) === 0 && w.groundHeightAt(9.5, z) === 0) { Z = z; break; }
    for (const [w, dist] of [['rocket_launcher', 6.5], ['grenade_launcher', 5.5], ['mortar', 9.5]]) {
      const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [dist, 0, Z] }); const bot = g.actors.find((a) => a.id === id); bot.hp = 150; bot.spawnProtect = 0;
      const p = { id: 'test-' + w, kind: 'test', def: DEV.weapon(w), owner: g.player };
      g.combat.explode(p, new V(0, 0.05, Z), null);
      out[w] = { dist, dmg: 150 - bot.hp, radius: p.def.splash.radius }; g.removeActor(bot);
    }
    return out;
  });
  check('Rocket / GL / mortar splash hugely buffed (damage well outside the old radius)', boom.rocket_launcher.dmg >= 40 && boom.grenade_launcher.dmg >= 40 && boom.mortar.dmg >= 60 && boom.rocket_launcher.radius >= 7 && boom.mortar.radius >= 10, JSON.stringify(boom));

  // ───────── land mine ─────────
  const mine = await page.evaluate(() => {
    const g = DEV.game; DEV.clearBots(); DEV.equip(4, 'land_mine'); DEV.select(4); DEV.teleport(0, 0, 22, 0); DEV.look(0, -0.6); DEV.advance(0.5);
    DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(2);
    const m = g.combat.projs.find((p) => p.kind === 'mine'); if (!m) return { placed: false };
    const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [m.pos.x + 4, 0, m.pos.z] }); const bot = g.actors.find((a) => a.id === id); bot.spawnProtect = 0;
    DEV.advance(1.5); const idle = bot.hp; const coins0 = DEV.profile.coins;
    bot.pos.set(m.pos.x + 0.3, 0, m.pos.z); DEV.advance(0.2);
    return { placed: true, landed: m.landed, idle, hp: bot.hp, alive: bot.alive, gone: !g.combat.projs.includes(m), banner: document.querySelector('#killban .kb')?.textContent || '', coins: DEV.profile.coins - coins0 };
  });
  check('Land mine lands, waits, then explodes when an enemy steps on it', mine.placed && mine.landed && mine.idle === 150 && !mine.alive && mine.gone, JSON.stringify({ ...mine, banner: undefined }));
  check('Kill banner + coin bounty shown for a mine kill', /ELIMINATED/.test(mine.banner) && /MINE KILL/.test(mine.banner) && mine.coins >= 20, `${mine.banner} (+${mine.coins})`);
  await shot('mine-kill-banner');

  // ───────── ULTRA unlock rules ─────────
  const ultra = await page.evaluate(() => {
    const g = DEV.game; const res = {};
    DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.clearBots(); DEV.godMode(); DEV.equip(1, 'rocket_launcher'); DEV.select(1); DEV.advance(3.3);
    DEV.advance(25); res.ffa25 = g.player.loadout[1]; DEV.advance(6); res.ffa31 = g.player.loadout[1]; res.mag = g.player.weapons[1].mag;
    g.player.hp = 1; g.god = false; g.damage(g.player, 50, {}); DEV.advance(3.5); res.afterDeath = g.player.loadout[1]; g.god = true;
    DEV.loadMap('cargo_yard', '1v1'); g.timeScale = 0; DEV.equip(1, 'lmg'); DEV.select(1); for (const b of g.brains.values()) b.frozen = true; DEV.advance(3.3);
    res.roundTime = g.match.mode.roundTime; DEV.advance(45); res.duel45 = g.player.loadout[1]; DEV.advance(16); res.duel61 = g.player.loadout[1];
    g.renderFrame(1 / 60);
    return res;
  });
  await shot('ultra-lmg-viewmodel');
  check('FFA/teams: ULTRA after surviving 30 s (rocket cylinder holds 6)', ultra.ffa25 === 'rocket_launcher' && ultra.ffa31 === 'rocket_launcher_ultra' && ultra.mag === 6, JSON.stringify(ultra));
  check('ULTRA is lost on death', ultra.afterDeath === 'rocket_launcher');
  check('1v1: 2-minute rounds, ULTRA after the first minute', ultra.roundTime === 120 && ultra.duel45 === 'lmg' && ultra.duel61 === 'lmg_ultra');

  // ───────── respawn robustness ─────────
  const resp = await page.evaluate(() => {
    const g = DEV.game; DEV.loadMap('cargo_yard', 'red_vs_blue'); g.timeScale = 0; g.god = false;
    g.kill(g.player, {}); DEV.advance(7);                       // killed during warmup (old bug: never respawned)
    const warm = g.player.alive;
    g.kill(g.player, {}); DEV.advance(3.5); const live = g.player.alive;
    const bot = g.actors.find((a) => a.isBot); g.kill(bot, { attacker: g.player }); bot.respawnT = 0; DEV.advance(3.5);
    const teams = { red: g.actors.filter((a) => a.team === 'red').length, blue: g.actors.filter((a) => a.team === 'blue').length };
    g.god = true; return { warm, live, botBack: bot.alive, teams };
  });
  check('Respawn always works (died in warmup, normal death, bot with lost timer)', resp.warm && resp.live && resp.botBack && resp.teams.red === 5 && resp.teams.blue === 5, JSON.stringify(resp));

  // ───────── bots: view cone, walls, smoke, flash, facing, weapon handling ─────────
  const bots = await page.evaluate(() => {
    const g = DEV.game; DEV.loadMap('refinery', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.godMode();
    DEV.teleport(0, 0, 20, 0); DEV.advance(0.1);
    const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [0, 0, 10] }); const bot = g.actors.find((a) => a.id === id); const br = g.brains.get(bot);
    const r = {};
    bot.yaw = 0; r.facingAway = br.canSee(g.player);           // bot looks toward -z, player is at +z
    bot.yaw = Math.PI; r.facing = br.canSee(g.player);
    bot.fx.flash = 1.5; r.flashed = br.canSee(g.player); bot.fx.flash = 0;
    DEV.throwAt(0, 0, 15, 'smoke_grenade'); DEV.advance(2.2); r.smoke = br.canSee(g.player);
    g.combat.clouds.length = 0;
    DEV.teleport(-5.5, 0, 0, 0); bot.pos.set(-5.5, 0, -6); DEV.advance(0.05); bot.yaw = Math.PI; r.wall = br.canSee(g.player); // pipe stack / scaffold between? fallback below
    // weapon held level & pointing where the bot aims (rig muzzle ahead of chest along aim)
    bot.pos.set(0, 0, 10); bot.yaw = Math.PI; bot.pitch = 0; g.renderFrame(1 / 60); g.renderFrame(1 / 60);
    const mz = g.muzzleWorld(bot, bot.pos.clone()); const ch = bot.chest(bot.pos.clone()); const dir = mz.clone().sub(ch); const aim = bot.aimDir(bot.pos.clone());
    r.gunDot = +(dir.clone().setY(0).normalize().dot(aim.clone().setY(0).normalize())).toFixed(2); r.gunDy = +(mz.y - ch.y).toFixed(2); r.gunReach = +dir.length().toFixed(2);
    return r;
  });
  check('Bots have a view cone (can\'t see behind them)', !bots.facingAway && bots.facing, JSON.stringify(bots));
  check('Flashbanged bots are blind; smoke blocks bot vision', !bots.flashed && !bots.smoke);
  check('Bot rigs hold the gun level, pointing where they aim', bots.gunDot > 0.9 && bots.gunDy > -0.25 && bots.gunReach > 0.5, `dot ${bots.gunDot}, muzzle Δy ${bots.gunDy} m, reach ${bots.gunReach} m`);
  const sw = await page.evaluate(() => {
    const g = DEV.game; DEV.loadMap('abandoned_city', 'ffa'); g.timeScale = 0; DEV.godMode(); DEV.advance(3.3);
    const seen = new Map(); for (let i = 0; i < 60 * 40; i++) { g.fixedUpdate(1 / 60); for (const a of g.actors) if (a.isBot) { if (!seen.has(a)) seen.set(a, new Set()); seen.get(a).add(a.slot); } }
    const multi = [...seen.values()].filter((s) => s.size > 1).length; const kills = g.actors.reduce((s, a) => s + a.stats.kills, 0); g.renderFrame(1 / 60);
    return { multi, bots: seen.size, kills, tracers: g.effects.tracerCount };
  });
  await shot('ffa-city-40s');
  check('Bots switch weapons during a fight', sw.multi >= 3, `${sw.multi}/${sw.bots} bots used more than one slot · ${sw.kills} kills`);

  // ───────── tracers: every bullet streak drawn (cheap line segments) ─────────
  const tr = await page.evaluate(() => { const g = DEV.game; DEV.loadMap('cargo_yard', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.equip(2, 'tactical_shotgun'); DEV.select(2); DEV.teleport(0, 0, 15, 0); DEV.look(0, 0.25); DEV.advance(0.5); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); g.renderFrame(1 / 60); return { bullets: g.combat.bullets.length, drawn: g.effects.tracerCount }; });
  check('Every bullet (all 8 shotgun pellets) gets a tracer', tr.bullets === 8 && tr.drawn === tr.bullets, JSON.stringify(tr));

  // ───────── ADS: all guns aim down sights, only snipers zoom ─────────
  const ads = await page.evaluate(() => { const g = DEV.game; const out = {}; for (const [s, w] of [[1, 'ak47'], [1, 'heavy_sniper']]) { DEV.equip(s, w); DEV.select(s); DEV.advance(0.6); const f0 = g.camera.fov; DEV.input({ alt: true }); DEV.advance(0.6); g.renderFrame(1 / 60); out[w] = { ads: g.vm.adsK > 0.9, fov0: Math.round(f0), fov: Math.round(g.camera.fov) }; DEV.input(null); DEV.advance(0.4); } return out; });
  check('Right-click aims every gun; only snipers zoom', ads.ak47.ads && ads.ak47.fov === ads.ak47.fov0 && ads.heavy_sniper.ads && ads.heavy_sniper.fov < ads.heavy_sniper.fov0 / 2, JSON.stringify(ads));

  // ───────── molotov: flames only (no red ground disc) ─────────
  const molo = await page.evaluate(() => { const g = DEV.game; const pr = DEV.throwAt(0, 0, 18, 'molotov'); void pr; DEV.advance(1.2); const pool = g.effects.pools[0]; return { pools: g.effects.pools.length, disc: !!pool?.mesh.isMesh }; });
  check('Molotov fire shows flames only (no ring/disc)', molo.pools >= 1 && !molo.disc, JSON.stringify(molo));

  // ───────── nameplates + low HP vignette ─────────
  const plates = await page.evaluate(() => { const g = DEV.game; DEV.loadMap('cargo_yard', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.teleport(0, 0, 20, 0); const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [0, 0, 12] }); const b = g.actors.find((a) => a.id === id); b.hp = 70; DEV.advance(0.4); g.renderFrame(1 / 60); g.renderFrame(1 / 60); const vis = b.plate?.visible; g.player.hp = 30; g.hud.update(0.016); const low = +document.getElementById('ov-low').style.opacity; return { vis, key: b.plate?.userData.key, low }; });
  await shot('nameplate-lowhp');
  check('Callsign + health bar shown over enemies in sight', plates.vis && /\|70\|/.test(plates.key), plates.key);
  check('Screen edges tint red at low health', plates.low > 0.5, `opacity ${plates.low}`);

  // ───────── practice range ─────────
  const prac = await page.evaluate(() => { const g = DEV.game; DEV.loadMap('jungle_temple', 'practice'); g.timeScale = 0; DEV.advance(3.3); const t = g.actors.filter((a) => a.isTarget); const bots = g.actors.filter((a) => a.isBot && !a.isTarget).length; const levels = new Set(t.map((a) => Math.round(a.home.y / 3))).size; const c0 = DEV.profile.coins; const tg = t[0]; g.damage(tg, 999, { attacker: g.player, weapon: 'ak47' }); DEV.advance(2); g.renderFrame(1 / 60); return { targets: t.length, bots, levels, respawned: tg.alive, coins: DEV.profile.coins - c0, timer: document.getElementById('timer').textContent }; });
  await shot('practice-range');
  check('Practice Range: targets on several levels, no bots, targets respawn, no coins', prac.targets >= 10 && prac.bots === 0 && prac.levels >= 2 && prac.respawned && prac.coins === 0, JSON.stringify(prac));

  // ───────── room + map vote (offline room, bots vote) ─────────
  const lob = await page.evaluate(async () => {
    const g = DEV.game; window.__voteSecs = 40; g.state = 'menu'; g.clearActors(); g.ui.sel.online = false; g.ui.sel.mode = '2v2'; g.ui.showMenu();
    document.querySelector('#play').click();
    await new Promise((r) => setTimeout(r, 900));
    const cards = [...document.querySelectorAll('[data-vote]')].map((b) => b.dataset.vote); const players = document.querySelectorAll('#lb-people li').length;
    document.querySelector('[data-vote]').click(); const voted = cards[0];
    let thumbs = 0; const t0 = performance.now();
    while (performance.now() - t0 < 36000) { await new Promise((r) => setTimeout(r, 300)); thumbs = [...document.querySelectorAll('img[data-thumb]')].filter((i) => i.src.startsWith('data:image')).length; if (thumbs >= 2) break; }
    window.DEV.game.ui.lobby.state.endsAt = performance.now() + 1500;   // got what we needed — end the vote now
    return { cards, players, voted, thumbs };
  });
  await shot('lobby-vote');
  const lob2 = await page.evaluate(async () => { const t0 = performance.now(); while (DEV.game.state !== 'playing' && performance.now() - t0 < 16000) await new Promise((r) => setTimeout(r, 200)); return { state: DEV.game.state, map: DEV.game.mapId, mode: DEV.game.modeId, actors: DEV.game.actors.length }; });
  check('Room shows 4 candidate maps with preview images + full player list', lob.cards.length === 4 && lob.players === 4 && lob.thumbs >= 2, JSON.stringify(lob));
  check('Vote ends → match starts on a voted map', lob2.state === 'playing' && lob.cards.includes(lob2.map) && lob2.mode === '2v2' && lob2.actors === 4, JSON.stringify(lob2));

  // ───────── rank: wins add permanent, locally stored points ─────────
  const rank = await page.evaluate(() => { const g = DEV.game; const p0 = DEV.profile.rank().points; g.match.rounds.red = 4; g.match.rounds.blue = 0; g.match.end(); const p1 = DEV.profile.rank().points; return { p0, p1, stored: JSON.parse(localStorage.getItem('firestorm-surge-profile-v1')).rankPts }; });
  check('Winning adds rank points (stored locally)', rank.p1 - rank.p0 === 70 && rank.stored === rank.p1, JSON.stringify(rank));
  await wait(400); await shot('results-rank');

  await page.evaluate(() => { DEV.game.timeScale = 1; });
  // loadout UI
  await page.evaluate(() => { DEV.game.state = 'menu'; DEV.game.ui.loSlot = 1; DEV.game.ui.loItem = 'rocket_launcher'; DEV.game.ui.renderLoadout(); });
  await wait(300); await shot('loadout');
  const lo = await page.evaluate(() => ({ ultraBtn: !!document.querySelector('#inspect-ultra'), shopSkins: document.querySelectorAll('.skin.shop').length }));
  check('Loadout shows the ULTRA variant + a skin shop', lo.ultraBtn && lo.shopSkins === 7, JSON.stringify(lo));
  await page.evaluate(() => document.querySelector('#inspect-ultra').click()); await wait(300); await shot('loadout-ultra-inspect');
  const bought = await page.evaluate(() => { DEV.giveCoins(2000); DEV.profile.d.skinsOwned = []; DEV.game.exitInspect(true); DEV.game.ui.loItem = 'ak47'; DEV.game.ui.renderLoadout(); const b = document.querySelector('[data-buyskin="galaxy"]'); b.click(); return { owns: DEV.profile.ownsSkin('galaxy'), sel: DEV.profile.skinFor('ak47') }; });
  check('Shop skins can be bought and applied', bought.owns && bought.sel === 'galaxy', JSON.stringify(bought));
  await wait(200); await shot('loadout-galaxy');
} catch (e) {
  check('Suite ran without exceptions', false, e.stack || String(e));
} finally {
  check('Zero runtime / shader errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} checks passed`);
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close(); srv.proc.kill();
  process.exit(pass === results.length ? 0 : 1);
}
