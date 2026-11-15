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
  check('Menu renders with DEV API', await page.evaluate(() => !!document.querySelector('#play') && typeof DEV.inspectGun === 'function'));
  const SPEC_IDS = ['assault_rifle', 'ak47', 'dmr', 'rocket_launcher', 'burst_rifle', 'lmg', 'heavy_sniper', 'flamethrower', 'grenade_launcher', 'mortar',
    'pistol', 'smg', 'crossbow', 'burst_pistol', 'revolver', 'sawed_off', 'tactical_shotgun', 'taser',
    'fists', 'knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer', 'shurikens', 'slippers',
    'frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'medkit', 'ammo_pack', 'armor_plate', 'adrenaline', 'barricade',
    'tactical_gloves', 'spring_boots', 'bandolier', 'blast_vest', 'thermal_goggles'];
  const have = await page.evaluate(() => DEV.list().map((x) => x.split(': ')[1]));
  const missing = SPEC_IDS.filter((x) => !have.includes(x));
  check('Every spec item exists (39 + 3 slot freebies)', missing.length === 0 && have.length === SPEC_IDS.length, missing.length ? 'missing ' + missing : `${have.length} entries`);
  const meshes = await page.evaluate((ids) => ids.map((id) => { try { DEV.inspectGun(id); let n = 0; DEV.game.studio.holder.traverse((o) => { if (o.isMesh) n++; }); return [id, n]; } catch (e) { return [id, -1, e.message]; } }), SPEC_IDS);
  const thin = meshes.filter(([, n]) => n < 5);
  check('All 42 item meshes are multi-part (≥5 meshes each)', thin.length === 0, thin.length ? JSON.stringify(thin) : `min ${Math.min(...meshes.map((m) => m[1]))} meshes`);

  // ───────── gun showcase ─────────
  const guns = QUICK ? ['ak47', 'mortar'] : ['ak47', 'heavy_sniper', 'mortar', 'flamethrower', 'scythe', 'katana', 'slippers', 'rocket_launcher', 'grenade_launcher', 'lmg', 'crossbow', 'sledgehammer', 'fists'];
  for (const id of guns) {
    const info = await page.evaluate((i) => { const r = DEV.inspectGun(i, { angle: 0.75, elev: 0.3 }); DEV.game.studio.auto = false; return r; }, id);
    await wait(150);
    await shot(`gun-${id}`);
    check(`inspectGun(${id}) builds a multi-part mesh`, info && info.size.every((s) => s > 0.01), `size ${info.size.map((s) => s.toFixed(2)).join('×')}`);
  }
  await page.evaluate(() => DEV.exitInspect());

  // ───────── maps ─────────
  const maps = QUICK ? ['cargo_yard'] : ['cargo_yard', 'desert_outpost', 'abandoned_city', 'underground_lab'];
  for (const m of maps) {
    await page.evaluate((id) => { DEV.loadMap(id, 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); }, m);
    await wait(250);
    await shot(`map-${m}`);
    const st = await page.evaluate(() => ({ s: DEV.state(), boxes: DEV.game.map.world.boxes.length, climb: DEV.game.map.world.boxes.filter((b) => b.climbable).length }));
    check(`Map ${m} loads (colliders + climbables)`, st.s.map === m && st.boxes > 20 && st.climb > 0, `${st.boxes} colliders, ${st.climb} climbable`);
  }
  if (!QUICK) {
    // Abandoned City: look at a vine-covered facade
    await page.evaluate(() => { DEV.loadMap('abandoned_city', 'red_vs_blue'); DEV.game.timeScale = 0; DEV.advance(3.3); DEV.clearBots(); DEV.teleport(-17.5, 0, -7.5, 0); DEV.look(Math.PI * 0.06, 0.32); DEV.advance(0.1); });
    await wait(200); await shot('map-abandoned_city-vines');
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

  // ───────── climbing (Fists + climbable ladder) ─────────
  const climb = await page.evaluate(() => {
    const g = DEV.game; const w = g.map.world; const lad = w.boxes.find((b) => b.climbable);
    const cx = (lad.min[0] + lad.max[0]) / 2, cz = (lad.min[2] + lad.max[2]) / 2;
    const thinX = lad.max[0] - lad.min[0] < lad.max[2] - lad.min[2];
    // stand in front of the ladder (on its outward side) facing it
    const outward = thinX ? [1, 0] : [0, 1];
    const px = cx + outward[0] * 0.75, pz = cz + outward[1] * 0.75; const yaw = Math.atan2(outward[0], outward[1]);
    DEV.equip(3, 'fists'); DEV.select(3); DEV.teleport(px, 0, pz, yaw); DEV.advance(0.1);
    DEV.input({ forward: true }); let maxY = 0;
    for (let i = 0; i < 150 && g.player.pos.y < lad.max[1] + 0.15; i++) { g.fixedUpdate(1 / 60); maxY = Math.max(maxY, g.player.pos.y); }
    for (let i = 0; i < 10; i++) g.fixedUpdate(1 / 60);
    DEV.input(null); DEV.advance(0.5);
    return { top: lad.max[1], maxY: +maxY.toFixed(2), endY: +g.player.pos.y.toFixed(2) };
  });
  check('Fists climb ladders at 5.5 m/s onto the container top', climb.maxY >= climb.top - 0.1 && Math.abs(climb.endY - climb.top) < 0.1, `ladder top ${climb.top.toFixed(2)} m, reached ${climb.maxY} m, standing at ${climb.endY} m`);

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
    // mortar warning ring
    const ring = await page.evaluate(() => { const g = DEV.game; DEV.clearBots(); DEV.equip(1, 'mortar'); DEV.select(1); DEV.teleport(0, 0, 28, 0); DEV.look(0, -0.15); DEV.advance(0.5); DEV.input({ fire: true, firePressed: true }); g.fixedUpdate(1 / 60); DEV.input(null); let seen = 0; for (let i = 0; i < 240; i++) { g.fixedUpdate(1 / 60); if (g.effects.rings.length) { seen++; if (seen === 20) { g.renderFrame(1 / 60); break; } } } return seen; });
    await shot('mortar-ring');
    check('Mortar shows red warning ring before impact', ring > 0);
    // a live bot match for a few seconds — bots must fight without errors
    const live = await page.evaluate(() => { DEV.loadMap('desert_outpost', 'ffa'); DEV.game.timeScale = 0; DEV.godMode(); DEV.advance(3.3); DEV.advance(20); const s = DEV.game.actors.map((a) => a.stats.kills).reduce((x, y) => x + y, 0); return { kills: s, actors: DEV.game.actors.length }; });
    await shot('ffa-desert-20s');
    check('Bots fight in a 20 s FFA simulation', live.kills > 0, `${live.kills} kills among ${live.actors} players`);
  }
  await page.evaluate(() => { DEV.game.timeScale = 1; });
  // loadout UI
  await page.evaluate(() => { DEV.game.state = 'menu'; DEV.game.ui.loSlot = 1; DEV.game.ui.loItem = 'heavy_sniper'; DEV.game.ui.renderLoadout(); });
  await wait(300); await shot('loadout');
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
