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
    'volt_rail', 'arc_caster', 'ricochet_disc', 'cryo_sprayer', 'harpoon_gun', 'snowball_launcher', 'paintball_gun', 'water_gun', 'tennis_launcher', 'turkey_launcher', 'present_launcher', 'confetti_cannon',
    'pistol', 'smg', 'crossbow', 'burst_pistol', 'revolver', 'sawed_off', 'tactical_shotgun', 'taser', 'pocket_rocket',
    'fists', 'knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer', 'shurikens', 'slippers', 'grapple_hook', 'spear', 'chainsaw', 'rubber_chicken',
    'frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'land_mine', 'banana_peel', 'medkit', 'ammo_pack', 'armor_plate', 'adrenaline', 'barricade', 'shockwave_grenade', 'black_hole', 'sentry_turret',
    'tactical_gloves', 'spring_boots', 'bandolier', 'blast_vest', 'thermal_goggles'];
  const have = await page.evaluate(() => DEV.list().map((x) => x.split(': ')[1]));
  const missing = SPEC_IDS.filter((x) => !have.includes(x));
  check('Every item exists (64 items incl. fun + seasonal guns, Spear, Chainsaw, Chicken, Banana)', missing.length === 0 && have.length === SPEC_IDS.length, missing.length ? 'missing ' + missing : `${have.length} entries`);
  const meshes = await page.evaluate((ids) => ids.map((id) => { try { DEV.inspectGun(id); let n = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) n++; }); return [id, n]; } catch (e) { return [id, -1, e.message]; } }), SPEC_IDS);
  const thin = meshes.filter(([, n]) => n < 5);
  check('Every item mesh are multi-part (≥5 meshes each)', thin.length === 0, thin.length ? JSON.stringify(thin) : `min ${Math.min(...meshes.map((m) => m[1]))} meshes`);
  const ultras = await page.evaluate(() => DEV.ultras().map((id) => { DEV.inspectGun(id); let n = 0, glow = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) { n++; if (o.material.emissiveIntensity > 1.5) glow++; } }); return [id, n, glow]; }));
  const baseCounts = await page.evaluate(() => Object.fromEntries(DEV.ultras().map((u) => { const id = u.replace('_ultra', ''); DEV.inspectGun(id); let n = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) n++; }); return [id, n]; })));
  check('Every main firearm has a distinct ULTRA model in standard colours (no neon glow)', ultras.length === 22 && ultras.every(([id, n, gl]) => n >= 10 && gl <= 2 && n !== baseCounts[id.replace('_ultra', '')]), ultras.map(([i, n, gl]) => `${i.replace('_ultra', '')}:${n}/${gl}`).join(' '));
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
    for (const [s, id] of [[1, 'grenade_launcher_ultra'], [1, 'rocket_launcher_ultra'], [1, 'lmg_ultra'], [1, 'ak47'], [1, 'ricochet_disc'], [2, 'pistol'], [2, 'smg'], [2, 'pocket_rocket']]) {
      DEV.equip(s, id); DEV.select(s); DEV.advance(0.6); DEV.input({ alt: true }); DEV.advance(0.8); g.renderFrame(1 / 60);
      const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(0, 0), g.vm.camera); const meshes = []; g.vm.item.traverse((o) => { if (o.isMesh && o.visible && !o.material.userData?.seeThru) meshes.push(o); });
      out[id] = rc.intersectObjects(meshes, false).length; DEV.input(null); DEV.advance(0.4);
    }
    return { blocked: Object.entries(out).filter(([, n]) => n).map(([k]) => k), dot: !!document.querySelector('#adsdot') }; });
  check('Aiming down sights: nothing covers the aim point + red-dot reticle', adsC.blocked.length === 0 && adsC.dot, JSON.stringify(adsC));
  const mtn = await page.evaluate(() => Object.fromEntries(DEV.maps().map((id) => { DEV.loadMap(id, 'practice'); let inside = 0; DEV.game.map.group.traverse((o) => { if (o.isMesh && o.name !== 'ground' && o.material.vertexColors && o.geometry.attributes.color) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 31 && Math.abs(p.getZ(i)) < 31) inside++; } }); return [id, inside]; })));
  check('Mountains never intrude into the arena (no walking into them)', Object.values(mtn).every((n) => n === 0), JSON.stringify(mtn));
  // ── v2.3: tunnels, lab island, architecture, colliders ──
  const tun = await page.evaluate(() => {
    const V = DEV.THREE.Vector3; const { buildMap, mapIssues, findPath } = DEV.lib; const out = {};
    for (const id of DEV.maps()) {
      const m = buildMap(id); const w = m.world; const r = { issues: mapIssues(m) };
      if (w.pits) {
        r.floor = w.groundY(0.5, 0.5); r.surface = w.groundHeightAt(0.5, 0.5, 1);
        const red = findPath(m.nav, m.spawns.red[0], new V(0.5, -3, 0.5)), blue = findPath(m.nav, m.spawns.blue[0], new V(0.5, -3, 0.5));
        r.paths = !!(red && blue) && [...red, ...blue].some((p) => p.y < -2);
        // a shot fired along the tunnel travels until a wall/pillar, not into "terrain" above
        const sx = Math.min(...w.pits.open.filter(([, z]) => z > 0).map(([x]) => x)) + 1.5;   // red-side corridor centre line
        const hit = w.raycast(new V(sx, -1.6, 5.5), new V(0, 0, 1), 30); r.shot = hit ? +hit.t.toFixed(1) : 99;
        const down = w.raycast(new V(sx, 0.5, 10.5), new V(0, -1, 0), 10); r.roofHit = down ? +down.point.y.toFixed(2) : null;
        r.openCells = w.pits.open.length;
      }
      out[id] = r;
    }
    return out;
  });
  const tunMaps = Object.entries(tun).filter(([, r]) => r.openCells);
  check('Underground tunnels on 4 maps: tunnel floor at -3, surface slab walkable, paths from both spawns', tunMaps.length === 4 && tunMaps.every(([, r]) => r.floor === -3 && r.surface === 0 && r.paths && r.roofHit === 0 && r.shot > 6), JSON.stringify(Object.fromEntries(tunMaps.map(([k, r]) => [k, { paths: r.paths, shot: r.shot, roof: r.roofHit }]))));
  check('No props/spawns inside stairwells', Object.values(tun).every((r) => r.issues.length === 0), JSON.stringify(Object.fromEntries(Object.entries(tun).filter(([, r]) => r.issues.length).map(([k, r]) => [k, r.issues.slice(0, 3)]))));
  const lab = await page.evaluate(() => { const m = DEV.lib.buildMap('underground_lab'); const nav = m.nav; let l1 = 0, l2 = 0; for (let n = 0; n < nav.nodeH.length; n++) { const c = nav.nodeCell[n], x = ((c / nav.N) | 0) - nav.half + 0.5, z = (c % nav.N) - nav.half + 0.5; if (Math.abs(x) < 9 && Math.abs(z) < 5) { if (Math.abs(nav.nodeH[n] - 3) < 0.1) l1++; if (Math.abs(nav.nodeH[n] - 6) < 0.1) l2++; } } const p = DEV.lib.poisOf(nav, [m.spawns.red[0]]); const reach = (y) => p.high.some((n) => { const c = nav.nodeCell[n], x = ((c / nav.N) | 0) - nav.half + 0.5; return Math.abs(x) < 3 && Math.abs(nav.nodeH[n] - y) < 0.1; }); return { l1, l2, reachL1: reach(3), reachL2: reach(6) }; });
  check('Underground Lab: central 2-level island reachable from spawn', lab.l1 > 80 && lab.l2 > 20 && lab.reachL1 && lab.reachL2, JSON.stringify(lab));
  const arch = await page.evaluate(() => { DEV.loadMap('cargo_yard', 'practice'); const w = DEV.game.map.world; const T = DEV.THREE; let pil = 0; for (const b of w.boxes) if (Math.abs((b.max[0] - b.min[0]) - 0.62) < 0.01 && Math.abs((b.max[2] - b.min[2]) - 0.62) < 0.01 && b.max[1] > 9) pil++;
    // tundra: pines (foliage, not just the trunk) and boulders stop a ray where the visible mesh is
    DEV.loadMap('frostbite', 'practice'); const w2 = DEV.game.map.world; const res = {};
    const gap = (x, y, z) => { const h = w2.raycast(new T.Vector3(x + 5, y, z), new T.Vector3(-1, 0, 0), 6); return h ? +(5 - h.t).toFixed(2) : 0; };
    res.pineFoliage = gap(-27, 8 * 0.42, 6); res.boulder = gap(-9, 0.5, 6);
    void T; return { pilasters: pil, ...res }; });
  check('Buildings have pilasters/trim; tundra pines + boulders are solid', arch.pilasters >= 8 && arch.pineFoliage > 1.2 && arch.boulder > 0.95, JSON.stringify(arch));
  const botsMove = await page.evaluate(() => {
    DEV.loadMap('cargo_yard', 'red_vs_blue'); const g = DEV.game; DEV.clearBots(); g.god = true; DEV.teleport(0, 30, 0); g.noclip = true; const V = DEV.THREE.Vector3;
    const sp = g.map.spawns.red[0]; const go = (goal) => { const id = DEV.spawnBot(g.player.team, 'assault_rifle', { at: [sp.x, sp.y, sp.z], tier: 'normal' }); const b = g.actors.find((a) => a.id === id); const br = g.brains.get(b); br.pickRoam = () => goal.clone(); br.goal = goal.clone(); let t = 0; for (; t < 45; t++) { DEV.advance(1); if (Math.hypot(b.pos.x - goal.x, b.pos.z - goal.z) < 1.5 && Math.abs(b.pos.y - goal.y) < 0.6) break; } const ok = t < 45; let moved = 0; const p0 = b.pos.clone(); DEV.advance(2); moved = b.pos.distanceTo(p0); g.removeActor(b); return { ok, t, held: moved < 0.3 }; };
    const r = { tunnel: go(new V(0.5, -3, 0.5)), roof: go(new V(-17.5, 9, 3.5)) }; g.noclip = false; return r; });
  check('Bots walk into the tunnels and up onto roofs, then hold the spot', botsMove.tunnel.ok && botsMove.roof.ok && botsMove.tunnel.held && botsMove.roof.held, JSON.stringify(botsMove));
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
    const V = DEV.THREE.Vector3; const bot = (id) => g.actors.find((x) => x.id === id);
    // Ricochet disc: slices through two enemies in line, and bounces off a wall
    const d1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }), d2 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-2, 0, 28] });
    const dd0 = [hp(d1), hp(d2)]; shoot(1, 'ricochet_disc', d1); DEV.advance(0.5); const disc = { slice: [dd0[0] - hp(d1), dd0[1] - hp(d2)] };
    DEV.clearBots();
    const pr = g.combat.spawnProj(g.player, DEV.weapon('ricochet_disc'), 'disc', new V(0, 1.5, 25), new V(0, 0, 34)); DEV.advance(0.3); disc.bounced = pr.bounces;
    // Cryo: slows while sprayed, freezes after sustained exposure
    const f1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-7, 0, 28] }); DEV.equip(1, 'cryo_sprayer'); DEV.select(1); DEV.advance(0.6);
    const hold = (sec) => { for (let k = 0; k < sec * 20; k++) { DEV.aimAt(f1, 'body'); DEV.input({ fire: true }); DEV.advance(0.05); } DEV.input(null); };
    const fh0 = hp(f1); hold(0.5); const cryo = { dmg: fh0 - hp(f1), slow: +bot(f1).speedMult().toFixed(2) }; hold(1.5); cryo.frozen = bot(f1).fx.frozen > 0 || bot(f1).fx.stun > 0;
    DEV.clearBots();
    // Harpoon: spears an enemy 15 m away and reels them in
    const h1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [3, 0, 28] }); const hh0 = hp(h1); shoot(1, 'harpoon_gun', h1); DEV.advance(1.2);
    const harpoon = { dmg: hh0 - hp(h1), distBefore: 15, distAfter: +bot(h1).pos.distanceTo(g.player.pos).toFixed(1) };
    DEV.clearBots();
    // Shockwave grenade (usable, carry 5): no damage, big throw
    DEV.equip(5, 'shockwave_grenade'); const sw = g.player.weapons[5];
    const k1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }); const kp = bot(k1).pos.clone(); const kh = hp(k1);
    DEV.throwAt(-7, 0, 28, 'shockwave_grenade'); DEV.advance(0.8);
    const shock = { carry: sw?.count, dmg: kh - hp(k1), moved: +bot(k1).pos.distanceTo(kp).toFixed(1) };
    DEV.clearBots();
    // Mini black hole: drags enemies into the core for 15 s
    DEV.teleport(5, 0, 27); const b1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-15.5, 0, 27.5] });
    DEV.throwAt(-8, 0, 27.5, 'black_hole'); DEV.advance(0.2); const vx = g.combat.vortices[0]; const bd0 = vx ? Math.hypot(bot(b1).pos.x - vx.pos.x, bot(b1).pos.z - vx.pos.z) : -1;
    DEV.advance(3); const bd1 = vx ? Math.hypot(bot(b1).pos.x - vx.pos.x, bot(b1).pos.z - vx.pos.z) : -1; const selfPulled = vx ? Math.hypot(g.player.pos.x - vx.pos.x, g.player.pos.z - vx.pos.z) : -1;
    DEV.advance(12.5); const hole = { from: +bd0.toFixed(1), to: +bd1.toFixed(1), ownerDist: +selfPulled.toFixed(1), gone: g.combat.vortices.length === 0, time: vx?.time };
    DEV.clearBots();
    // Pocket Rocket: explosive pistol round
    const r1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-5, 0, 28] }); const r0 = hp(r1); shoot(2, 'pocket_rocket', r1); DEV.advance(0.5); const rocket = r0 - hp(r1);
    DEV.clearBots();
    // Mortar: 3-shell tube, landing marker shows only while holding it
    DEV.equip(1, 'mortar'); DEV.select(1); DEV.advance(0.6); g.renderFrame(1 / 60); const mk = !!g.mortarMark?.visible; const md = DEV.weapon('mortar');
    DEV.select(2); DEV.advance(0.6); g.renderFrame(1 / 60); const mkOff = !g.mortarMark.visible;
    // Slide (C): fast, low, smaller hitbox, then stands back up
    DEV.select(1); DEV.advance(0.4); DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); const P = g.player;
    DEV.input({ forward: true }); DEV.advance(0.5); const sx0 = P.pos.x;
    DEV.input({ forward: true, slide: true }); g.fixedUpdate(1 / 60); DEV.input({ forward: true }); DEV.advance(0.15);
    const slide = { speed: +Math.hypot(P.vel.x, P.vel.z).toFixed(1), eye: +(P.eye(new V()).y - P.pos.y).toFixed(2), head: +(P.headPos(new V()).y - P.pos.y).toFixed(2) };
    DEV.advance(0.4); slide.dist = +(P.pos.x - sx0).toFixed(1); DEV.advance(0.8); slide.standing = P.low < 0.05; DEV.input(null); DEV.advance(0.3);
    // Grapple Hook: RMB zips you up onto a container; on an enemy it hits and pulls you into their face
    DEV.equip(3, 'grapple_hook'); DEV.select(3); DEV.advance(0.4);
    DEV.teleport(-12, 0, 28); DEV.look(0, 0.25); DEV.advance(0.2); P.grappleCd = 0;
    DEV.input({ altPressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); const hooked = !!P.grapple; let topY = 0; for (let k = 0; k < 90; k++) { g.fixedUpdate(1 / 60); topY = Math.max(topY, P.pos.y); }
    const grapple = { hooked, topY: +topY.toFixed(1), endY: +P.pos.y.toFixed(1), cd: +P.grappleCd.toFixed(2) };
    DEV.teleport(-12, 0, 28); DEV.advance(1.5); P.grappleCd = 0;
    const gh1 = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [6, 0, 28] }); DEV.aimAt(gh1, 'body'); const gh0 = hp(gh1);
    DEV.input({ altPressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(1.2);
    grapple.enemyDmg = gh0 - hp(gh1); grapple.enemyDist = +P.pos.distanceTo(bot(gh1).pos).toFixed(1);
    DEV.clearBots();
    // Sentry Turret: deploys, shoots the nearest enemy, expires after 30 s
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); DEV.equip(5, 'sentry_turret'); DEV.select(5); DEV.advance(0.4);
    DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(1.0);
    const st = g.combat.sentries[0]; const sb = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [2, 0, 28] }); const sb0 = hp(sb);
    DEV.advance(2); const sentry = { placed: !!st, dmg: sb0 - hp(sb), credited: st && st.owner === P, backToGun: P.slot !== 5 };
    DEV.advance(28); sentry.expired = g.combat.sentries.length === 0;
    DEV.clearBots();
    g.god = god0;
    return { slide, grapple, sentry, volt, arc, disc, cryo, harpoon, shock, hole, rocket, mortar: { mag: md.mag, radius: md.splash.radius, marker: mk, hiddenOtherwise: mkOff }, ultraCluster: DEV.weapon('mortar_ultra').cluster };
  });
  check('Volt Rail slug pierces both enemies in line', ng.volt[0] > 0 && ng.volt[1] > 0, JSON.stringify(ng.volt));
  check('Arc Caster lightning chains to a nearby enemy', ng.arc > 0, `${ng.arc} chain dmg`);
  check('Pocket Rocket explodes', ng.rocket >= 50, `rocket ${ng.rocket}`);
  check('Ricochet Disc slices through enemies in line and bounces off walls', ng.disc.slice[0] > 0 && ng.disc.slice[1] > 0 && ng.disc.bounced >= 1, JSON.stringify(ng.disc));
  check('Cryo Sprayer damages, slows, then freezes', ng.cryo.dmg > 0 && ng.cryo.slow < 0.7 && ng.cryo.frozen, JSON.stringify(ng.cryo));
  check('Harpoon spears and reels the enemy in', ng.harpoon.dmg >= 70 && ng.harpoon.distAfter < 5, JSON.stringify(ng.harpoon));
  check('Shockwave Grenade: carry 5, no damage, throws enemies', ng.shock.carry === 5 && ng.shock.dmg === 0 && ng.shock.moved > 2.5, JSON.stringify(ng.shock));
  check('Mini Black Hole pulls enemies in (not the thrower) and lasts 15 s', ng.hole.to < 2.2 && ng.hole.from > 5 && ng.hole.ownerDist > 6 && ng.hole.gone && ng.hole.time === 15, JSON.stringify(ng.hole));
  check('Slide (C): entry boost + low hitbox, friction carries it ~7 m, then stands up', ng.slide.speed > 9 && ng.slide.eye < 1.0 && ng.slide.head < 1.0 && ng.slide.dist > 4 && ng.slide.standing, JSON.stringify(ng.slide));
  check('Grapple Hook zips onto a container roof and pulls you to an enemy (with a hit)', ng.grapple.hooked && ng.grapple.topY > 3 && ng.grapple.endY > 2.5 && ng.grapple.enemyDmg >= 25 && ng.grapple.enemyDist < 2.5, JSON.stringify(ng.grapple));
  check('Sentry Turret deploys, shoots enemies for its owner, expires after 30 s', ng.sentry.placed && ng.sentry.dmg > 30 && ng.sentry.credited && ng.sentry.backToGun && ng.sentry.expired, JSON.stringify(ng.sentry));
  check('Mortar buffed (3-shell tube, 12.5 m) + shooter-only landing marker; Ultra shells cluster', ng.mortar.mag === 3 && ng.mortar.radius >= 12 && ng.mortar.marker && ng.mortar.hiddenOtherwise && ng.ultraCluster === 3, JSON.stringify(ng.mortar));

  // ───────── v2.6: fun guns, spear, slide friction, wheel, achievements ─────────
  const v26 = await page.evaluate(() => {
    const g = DEV.game; const god0 = g.god; DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); g.god = true;
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.1);
    const bot = (id) => g.actors.find((x) => x.id === id); const hp = (id) => DEV.bot(id).hp;
    const shoot = (slot, w, id, n = 1) => { DEV.equip(slot, w); DEV.select(slot); DEV.advance(0.6); for (let k = 0; k < n; k++) { DEV.aimAt(id, 'body'); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.4); } };
    const out = {};
    let b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); let h = hp(b); shoot(1, 'snowball_launcher', b); out.snow = { dmg: h - hp(b), slowed: bot(b).fx.chill > 0 }; DEV.clearBots();
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); h = hp(b); const dec0 = (g.effects.decals || []).length; shoot(1, 'paintball_gun', b, 3); out.paint = { dmg: h - hp(b) };
    DEV.look(Math.PI, -0.2); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.6); out.paint.decals = (g.effects.decals || []).length - dec0; DEV.clearBots();
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-7, 0, 28] }); h = hp(b); const p0 = bot(b).pos.clone(); DEV.equip(1, 'water_gun'); DEV.select(1); DEV.advance(0.6);
    for (let k = 0; k < 20; k++) { DEV.aimAt(b, 'body'); DEV.input({ fire: true }); DEV.advance(0.05); } DEV.input(null); out.water = { dmg: h - hp(b), pushed: +bot(b).pos.distanceTo(p0).toFixed(2) }; DEV.clearBots();
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); h = hp(b); shoot(1, 'tennis_launcher', b); out.tennis = { dmg: h - hp(b) };
    const tb = g.combat.spawnProj(g.player, DEV.weapon('tennis_launcher'), 'tennis', new DEV.THREE.Vector3(0, 1.5, 25), new DEV.THREE.Vector3(0, 0, 30)); DEV.advance(0.4); out.tennis.bounces = tb.bounces; DEV.clearBots();
    // spear: thrown headshot one-shots a full-armour enemy; RMB stab; pick it back up
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-2, 0, 28] }); bot(b).armor = 50; DEV.equip(3, 'spear'); DEV.select(3); DEV.advance(0.6);
    DEV.aimAt(b, 'head'); DEV.input({ firePressed: true, fire: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(1.2);
    const sws = g.player.weapons[3]; out.spear = { headKill: !bot(b).alive, out: sws.mag === 0 };
    const sp = g.combat.projs.find((p) => p.kind === 'spear'); out.spear.landed = !!(sp && (sp.landed || sp.stuck));
    if (sp) { DEV.teleport(sp.pos.x, sp.owner.pos.y, sp.pos.z); DEV.advance(0.3); } out.spear.picked = sws.mag === 1; DEV.clearBots();
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-10, 0, 28] }); DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); h = hp(b);
    DEV.aimAt(b, 'body'); DEV.input({ altPressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.5); out.spear.stab = h - hp(b); DEV.clearBots();
    // slide: boost, then friction slows it down
    const P = g.player; DEV.select(1); DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); DEV.input({ forward: true }); DEV.advance(0.5);
    DEV.input({ forward: true, slide: true }); g.fixedUpdate(1 / 60); const s0 = Math.hypot(P.vel.x, P.vel.z); DEV.input({ forward: true }); DEV.advance(0.4); const s1 = Math.hypot(P.vel.x, P.vel.z);
    out.slide = { start: +s0.toFixed(1), later: +s1.toFixed(1) }; DEV.input(null); DEV.advance(1.5);
    g.god = god0; return out;
  });
  check('Snowball Launcher hits + chills', v26.snow.dmg >= 30 && v26.snow.slowed, JSON.stringify(v26.snow));
  check('Paintball Gun hits and splats paint decals on walls', v26.paint.dmg >= 28 && v26.paint.decals > 0, JSON.stringify(v26.paint));
  check('Water Gun soaks and shoves enemies back', v26.water.dmg > 20 && v26.water.pushed > 1, JSON.stringify(v26.water));
  check('Tennis Ball Launcher hits and balls bounce off walls', v26.tennis.dmg >= 40 && v26.tennis.bounces >= 1, JSON.stringify(v26.tennis));
  check('Spear: thrown headshot one-shots (even with armour), lands, can be picked up; RMB stab hits hard', v26.spear.headKill && v26.spear.out && v26.spear.landed && v26.spear.picked && v26.spear.stab >= 120, JSON.stringify(v26.spear));
  check('Slide: entry boost then friction slows you', v26.slide.start > 11 && v26.slide.later < v26.slide.start - 2.5, JSON.stringify(v26.slide));
  // ───────── v2.7: regen, killstreak heals, awards, key binds ─────────
  const v27 = await page.evaluate(() => {
    const g = DEV.game; const out = {}; const god0 = g.god; g.god = false;
    DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.advance(3.3); const P = g.player; DEV.clearBots(); DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.1);
    P.hp = 60; P.lastHurt = g.time; DEV.advance(2); const early = P.hp; DEV.advance(5); out.regen = { early: +early.toFixed(1), later: +P.hp.toFixed(1), flag: P.regen };
    // killstreak: 3rd kill restores +50 HP and +25 armour
    P.hp = 40; P.armor = 0; P.lastHurt = g.time; P.streak = 2;
    const b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }); const bot = g.actors.find((x) => x.id === b);
    g.damage(bot, 999, { attacker: P, weapon: 'assault_rifle' });
    out.streak = { n: P.streak, hp: Math.round(P.hp), armor: Math.round(P.armor), banner: document.getElementById('streakban').textContent, best: P.stats.bestStreak };
    g.damage(P, 999, { attacker: bot, weapon: 'assault_rifle' }); out.streak.reset = P.streak; DEV.advance(4);
    DEV.clearBots(); g.god = god0; return out;
  });
  check('Out-of-combat regen: nothing for 5 s after a hit, then slow heal', v27.regen.early === 60 && v27.regen.later > 65 && v27.regen.later < 90, JSON.stringify(v27.regen));
  check('Killstreak rewards heal: 3-kill streak = +50 HP +25 armour, banner, streak resets on death', v27.streak.n === 3 && v27.streak.hp === 90 && v27.streak.armor === 25 && /KILLING SPREE/.test(v27.streak.banner) && v27.streak.reset === 0, JSON.stringify(v27.streak));
  // ───────── v2.8: silly weapons + comedy ─────────
  const v28 = await page.evaluate(() => {
    const g = DEV.game; const out = {}; const god0 = g.god;
    DEV.loadMap('cargo_yard', 'ffa'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); g.god = true; const P = g.player;
    const bot = (id) => g.actors.find((x) => x.id === id); const V3 = (x, y, z) => new DEV.THREE.Vector3(x, y, z);
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.1);
    // chainsaw: hold to cut
    let b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-10.4, 0, 28] }); bot(b).lastHurt = g.time; DEV.equip(3, 'chainsaw'); DEV.select(3); DEV.advance(0.7);
    let h = bot(b).hp + bot(b).armor; DEV.aimAt(b, 'body'); DEV.input({ fire: true }); DEV.advance(0.5); DEV.input(null); out.saw = { dmg: Math.round(h - bot(b).hp - bot(b).armor) }; DEV.clearBots();
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.3); const x0 = P.pos.x; DEV.input({ altPressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.6); out.saw.lunge = +(P.pos.x - x0).toFixed(2);
    // rubber chicken: bonk knockback + BAWK stun
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-10.3, 0, 28] }); DEV.equip(3, 'rubber_chicken'); DEV.select(3); DEV.advance(0.6);
    const p0 = bot(b).pos.clone(); DEV.aimAt(b, 'body'); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.5);
    out.chicken = { pushed: +bot(b).pos.distanceTo(p0).toFixed(2) };
    DEV.teleport(-12, 0, 28, -Math.PI / 2); bot(b).pos.set(-9.5, bot(b).pos.y, 28); DEV.advance(0.2); DEV.aimAt(b, 'body'); DEV.input({ altPressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); out.chicken.stun = +bot(b).fx.stun.toFixed(2); DEV.clearBots();
    // banana peel: whoever steps on it slips (stun + backflip)
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); h = bot(b).hp;
    const bp = g.combat.spawnProj(P, DEV.weapon('banana_peel'), 'banana', V3(-4, 0.6, 28), V3(0, -2, 0), { fuse: Infinity }); DEV.advance(1.2);
    out.banana = { landed: !!bp.landed, stun: +bot(b).fx.stun.toFixed(2), slip: (bot(b).slipT || 0) > 0 || bot(b).fx.stun > 0, dmg: h - bot(b).hp, gone: !g.combat.projs.includes(bp) }; DEV.clearBots();
    // turkey + present launchers explode; confetti cannon blasts back
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); h = bot(b).hp;
    g.combat.spawnProj(P, DEV.weapon('turkey_launcher'), 'turkey', V3(-8, 1.4, 28), V3(25, 0, 0)); DEV.advance(0.6); out.turkey = { dmg: Math.round(h - bot(b).hp), dead: !bot(b).alive }; DEV.clearBots();
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-4, 0, 28] }); h = bot(b).hp;
    const pr = g.combat.spawnProj(P, DEV.weapon('present_launcher'), 'present', V3(-4.5, 2.5, 27), V3(0, -3, 0)); DEV.advance(0.5); const alive = g.combat.projs.includes(pr); DEV.advance(1.6);
    out.present = { bouncedFirst: alive, dmg: Math.round(h - bot(b).hp) || (bot(b).alive ? 0 : 999) }; DEV.clearBots();
    DEV.teleport(-12, 0, 28, -Math.PI / 2); DEV.advance(0.2); b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-8, 0, 28] }); h = bot(b).hp; const c0 = bot(b).pos.clone();
    DEV.equip(1, 'confetti_cannon'); DEV.select(1); DEV.advance(0.6); DEV.aimAt(b, 'body'); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); DEV.advance(0.4);
    out.confetti = { dmg: Math.round(h - bot(b).hp), pushed: +bot(b).pos.distanceTo(c0).toFixed(2) }; DEV.clearBots();
    // YEET: chicken kill launches the body
    b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }); const yb = bot(b); g.damage(yb, 999, { attacker: P, weapon: 'rubber_chicken', melee: true });
    g.renderFrame(1 / 60); DEV.advance(0.3); for (let i = 0; i < 18; i++) g.renderFrame(1 / 60);
    out.yeet = { flag: !!yb.yeet, up: yb.rig ? +(yb.rig.position.y - yb.pos.y).toFixed(2) : -1, banner: document.getElementById('killban').textContent.includes('YEET') }; DEV.clearBots();
    // revenge: they kill you, you kill them back
    g.god = false; b = DEV.spawnBot('ffa', 'pistol', { frozen: true, at: [-6, 0, 28] }); const rb = bot(b);
    g.damage(P, 999, { attacker: rb, weapon: 'tennis_launcher' }); out.quip = document.getElementById('spectate') && g.deathQuip; g.hud.update(0.016); out.quipShown = document.querySelector('#spectate em.quip')?.textContent || '';
    DEV.advance(4); rb.alive = true; rb.hp = 150; g.damage(rb, 999, { attacker: P, weapon: 'assault_rifle' }); out.revenge = document.getElementById('killban').textContent.includes('REVENGE');
    g.lastChat = -99; g.botSay(rb, 'kill', { victim: 'Tester' }); out.chat = document.querySelector('#chat .cl:last-child')?.textContent || '';
    out.chatName = rb.name; DEV.clearBots(); g.god = god0;
    return out;
  });
  check('Chainsaw: hold LMB shreds (≥60 dmg in 0.5 s), RMB lunge dashes forward', v28.saw.dmg >= 60 && v28.saw.lunge > 2.5, JSON.stringify(v28.saw));
  check('Rubber Chicken: squeaky bonk sends people flying, BAWK stuns', v28.chicken.pushed > 1.5 && v28.chicken.stun > 0.3, JSON.stringify(v28.chicken));
  check('Banana Peel: lands, enemy who steps on it slips (stun + damage), peel is used up', v28.banana.landed && v28.banana.stun > 0.5 && v28.banana.dmg >= 10 && v28.banana.gone, JSON.stringify(v28.banana));
  check('Turkey Launcher explodes on impact; Present Launcher bounces then blows up', v28.turkey.dmg >= 100 && v28.present.bouncedFirst && v28.present.dmg >= 80, JSON.stringify({ t: v28.turkey, p: v28.present }));
  check('Confetti Cannon: 12-pellet party blast with knockback', v28.confetti.dmg >= 40 && v28.confetti.pushed > 0.8, JSON.stringify(v28.confetti));
  check('YEET: knockback kills launch the body into the sky (+ banner tag)', v28.yeet.flag && v28.yeet.up > 1 && v28.yeet.banner, JSON.stringify(v28.yeet));
  check('Death screen roast + REVENGE kill tag + bot trash talk in chat', !!v28.quipShown && v28.revenge && v28.chat.startsWith(v28.chatName + ':'), JSON.stringify({ q: v28.quipShown, r: v28.revenge, c: v28.chat }));
  const fun = await page.evaluate(() => {
    const mk = (id, o) => ({ id, name: id, team: 'ffa', isBot: true, stats: { kills: 0, deaths: 0, damage: 0, headshots: 0, bestStreak: 0, emotional: 0, ...o.stats }, aw: { afk: 0, dist: 0, slide: 0, taken: 0, air: 0, shots: 0, hits: 0, yeets: 0, slips: 0, revenge: 0, victims: {}, ...o.aw } });
    const A = [mk('a', { stats: { kills: 12, damage: 1500 }, aw: { victims: { c: 6 }, yeets: 4 } }), mk('b', { stats: { kills: 1 }, aw: { shots: 200, hits: 12, dist: 400 } }), mk('c', { stats: { deaths: 8, damage: 300 }, aw: { slips: 3, afk: 40 } }), mk('d', { stats: { kills: 0, damage: 260 }, aw: { revenge: 0 } })];
    const r = DEV.matchAwards(A); const nov = new Date(2026, 10, 15), jul = new Date(2026, 6, 1);
    return { titles: r.awards.map((x) => x.title), n: r.awards.length, vend: r.awards.find((x) => x.id === 'vendetta')?.flavour, mvp: r.mvp.id,
      season: [DEV.inSeason(DEV.weapon('turkey_launcher'), nov), DEV.inSeason(DEV.weapon('present_launcher'), nov), DEV.inSeason(DEV.weapon('confetti_cannon'), new Date(2027, 0, 3)), DEV.inSeason(DEV.weapon('turkey_launcher'), jul)] };
  });
  check('More funny awards: Stormtrooper, NASA Intern, Vendetta, LVP… (max 9, Most AFK first)', fun.titles[0] === 'MOST AFK' && fun.n <= 9 && fun.titles.includes('LEAST VALUABLE PLAYER') && fun.titles.some((t) => /STORMTROOPER|NASA|VENDETTA|BANANA|SO CLOSE|TOURIST/.test(t)) && /c$/.test(fun.vend || 'c') && fun.mvp === 'a', JSON.stringify(fun));
  check('Seasonal guns: Turkey in November, Presents in December, Confetti over New Year, nothing off-season', fun.season.join() === 'true,false,true,false', fun.season.join());
  const keys = await page.evaluate(() => {
    const inp = DEV.game.input; inp.setBinds({ jump: 'KeyQ', thermal: 'KeyC' });
    inp.keys.add('KeyQ'); const jumpQ = inp.sample().jump; inp.keys.delete('KeyQ');
    inp.keys.add('Space'); const jumpSpace = inp.sample().jump; inp.keys.delete('Space');
    const slideKeys = inp.binds.slide.slice(), hint = DEV.game.hud.hintText(); inp.setBinds({});
    return { jumpQ, jumpSpace, slideKeys, hint, back: inp.binds.jump[0] };
  });
  check('Key rebinding: new key works, old one freed, conflicts resolved, HUD hint follows', keys.jumpQ && !keys.jumpSpace && keys.slideKeys[0] === 'KeyC' && /Q jump/.test(keys.hint) && keys.back === 'Space', JSON.stringify(keys));
  check('Grapple Hook costs 1800', (await page.evaluate(() => DEV.weapon('grapple_hook').price)) === 1800);
  const meta = await page.evaluate(() => {
    const pf = DEV.profile; const c0 = pf.coins; pf.d.wheelDay = null; const can = pf.canSpin(); const res = pf.spin(() => 0.01); const again = pf.spin();
    const fb = pf.achieved('first_blood'); const before = pf.coins; if (!fb) pf.bump('kills'); const got = pf.achieved('first_blood');
    return { can, seg: res?.seg.id, coinsGained: before - c0, again, got, paid: !fb ? pf.coins - before : 50 };
  });
  check('Daily Wheel: one spin per day, pays out', meta.can && meta.seg === 'c50' && meta.coinsGained === 50 && meta.again === null, JSON.stringify(meta));
  check('Achievements unlock once and pay coins', meta.got && meta.paid >= 50, JSON.stringify(meta));
  const extra = await page.evaluate(() => {
    const pf = DEV.profile; const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    pf.d.wheelDay = y; pf.d.wheelStreak = 3; const c0 = pf.coins; const res = pf.spin(() => 0.01); const streak = { n: res.streak, bonus: res.bonus, gained: pf.coins - c0 };
    pf.d.wheelDay = '2000-01-01'; pf.d.wheelStreak = 6; const reset = pf.nextStreak();
    const g = DEV.game; const count = () => { let n = 0; g.map.group.traverse((o) => { if (o.isInstancedMesh) n += o.count; }); return n; };
    g.applyQuality('low'); DEV.loadMap('jungle_temple', 'ffa'); const low = { n: count(), pr: g.renderer.getPixelRatio(), sh: g.sun.shadow.mapSize.x };
    g.applyQuality('high'); DEV.loadMap('jungle_temple', 'ffa'); const high = { n: count(), sh: g.sun.shadow.mapSize.x };
    return { streak, reset, low, high };
  });
  check('Daily Wheel streak: consecutive days add +25/day bonus, missed day resets', extra.streak.n === 4 && extra.streak.bonus === 75 && extra.streak.gained === 125 && extra.reset === 1, JSON.stringify(extra));
  check('Graphics quality: Low drops clutter/shadow res/pixel ratio, High restores', extra.low.pr === 1 && extra.low.sh === 1024 && extra.high.sh === 2048 && extra.high.n > extra.low.n + 2000, JSON.stringify(extra));

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
  const plates = await page.evaluate(() => { const g = DEV.game; DEV.loadMap('cargo_yard', 'red_vs_blue'); g.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.teleport(0, 0, 20, 0); const id = DEV.spawnBot('blue', 'assault_rifle', { frozen: true, at: [0, 0, 12] }); const b = g.actors.find((a) => a.id === id); b.hp = 70; b.lastHurt = g.time; DEV.advance(0.4); g.renderFrame(1 / 60); g.renderFrame(1 / 60); const vis = b.plate?.visible; g.player.hp = 30; g.hud.update(0.016); const low = +document.getElementById('ov-low').style.opacity; return { vis, key: b.plate?.userData.key, low }; });
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
  const mvp = await page.evaluate(() => ({ card: document.querySelector('.mvp-card h3')?.textContent, awards: [...document.querySelectorAll('.award small')].map((e) => e.textContent) }));
  check('Results show the match MVP + funny awards (always incl. MOST AFK)', !!mvp.card && mvp.awards.includes('MOST AFK'), JSON.stringify(mvp));
  const stp = await page.evaluate(() => { DEV.game.ui.openStats(); return { tiles: document.querySelectorAll('.st-tile').length, mvps: [...document.querySelectorAll('.st-tile')].some((t) => /MVPs/.test(t.textContent)) }; });
  await wait(200); await shot('stats-page');
  check('Stats page shows lifetime career / combat / silly stats', stp.tiles >= 25 && stp.mvps, JSON.stringify(stp));
  await page.evaluate(() => { DEV.game.ui.openControls(); }); await wait(200); await shot('controls');
  const ctl = await page.evaluate(() => document.querySelectorAll('.kb-row').length); check('Controls screen lists every rebindable action', ctl === 15, String(ctl));

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
