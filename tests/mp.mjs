// Two isolated headless browsers join the same Trystero lobby and verify sync + remote hits.
import { startServer, launch, wait } from './lib.mjs';
const srv = await startServer(4500 + Math.floor(Math.random() * 100));
const b1 = await launch(), b2 = await launch(); const errors = [];
const open = async (b, tag) => { const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1280, height: 720 }); p.on('pageerror', (e) => errors.push(tag + ' ' + e.message)); p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/WebSocket|relay|nostr|ERR_|wss:/i.test(t)) errors.push(tag + ' ' + t); }); await p.goto(srv.url + '?test', { waitUntil: 'load' }); await p.waitForFunction(() => !!window.DEV); return p; };
const A = await open(b1, 'A'), B = await open(b2, 'B');
const mode = 'mp' + Math.floor(Math.random() * 1e6); // unique lobby name to avoid strangers
for (const p of [A, B]) await p.evaluate((m) => { DEV.game.ui.sel.mode = '1v1'; window.__mode = m; }, mode);
// monkeypatch the lobby mode id so the test gets a private lobby
const start = (p) => p.evaluate(() => { const g = DEV.game; const orig = g.net.connect.bind(g.net); g.net.connect = (modeId, max, cb) => orig(window.__mode, max, cb); g.ui.sel.online = true; g.ui.sel.mode = '1v1'; g.ui.showMenu(); document.querySelector('#play').click(); });
await Promise.all([start(A), start(B)]);
let ok = false; const t0 = Date.now();
while (Date.now() - t0 < 60000) { const [a, b] = await Promise.all([A.evaluate(() => DEV.game.net.peers.size), B.evaluate(() => DEV.game.net.peers.size)]); if (a >= 1 && b >= 1) { ok = true; break; } await wait(1000); }
console.log(ok ? '✅ peers connected' : '❌ peers did not connect', ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (ok) {
  // room: both see the same 4 candidate maps, both vote, match starts on the same map
  let st = null; const t1 = Date.now();
  while (Date.now() - t1 < 15000) { st = await Promise.all([A, B].map((p) => p.evaluate(() => ({ cands: DEV.game.ui.lobby?.state?.cands?.join(), host: DEV.game.net.isHost })))); if (st[0].cands && st[0].cands === st[1].cands) break; await wait(500); }
  console.log(st[0].cands && st[0].cands === st[1].cands ? '✅' : '❌', 'shared map vote', JSON.stringify(st));
  await A.evaluate(() => document.querySelector('[data-vote]')?.click()); await B.evaluate(() => document.querySelectorAll('[data-vote]')[0]?.click());
  let started = null; const t2 = Date.now();
  while (Date.now() - t2 < 20000) { started = await Promise.all([A, B].map((p) => p.evaluate(() => ({ state: DEV.game.state, map: DEV.game.mapId, votes: DEV.game.ui.lobby?.state?.votes })))); if (started.every((x) => x.state === 'playing')) break; await wait(500); }
  console.log(started.every((x) => x.state === 'playing') && started[0].map === started[1].map ? '✅' : '❌', 'both started the voted map', JSON.stringify(started));
  await wait(4000);
  const info = await Promise.all([A, B].map((p) => p.evaluate(() => ({ me: DEV.game.player.id, team: DEV.game.player.team, lobby: DEV.game.net.lobby, actors: DEV.game.actors.map((a) => `${a.id}:${a.team}:${a.isBot ? 'bot' : a.isRemote ? 'remote' : 'local'}`), host: DEV.game.net.isHost }))));
  console.log(JSON.stringify(info, null, 1));
  const bId = info[1].me;
  // a clear 6 m firing lane on whatever map was voted (maps have random cover props)
  const spot = await B.evaluate(() => { const g = DEV.game, w = g.map.world, V = g.camera.position.constructor; for (let z = 22; z > -22; z -= 1) for (let x = -10; x <= 10; x += 1) { const a = new V(x, 1.4, z), b = new V(x, 1.4, z + 6); if (w.groundHeightAt(x, z) === 0 && w.groundHeightAt(x, z + 6) === 0 && w.lineOfSight(a, b) && w.lineOfSight(new V(x, 0.4, z), new V(x, 0.4, z + 6)) && ![...w.query(x - 1, z - 1, x + 1, z + 7)].some((bx) => bx.min[1] < 2 && bx.max[0] > x - 0.8 && bx.min[0] < x + 0.8 && bx.max[2] > z - 0.8 && bx.min[2] < z + 6.8)) return [x, z]; } return [5, 22]; });
  // move B and check A sees it
  await B.evaluate(([x, z]) => { DEV.godMode(); DEV.teleport(x, 0, z, 0); }, spot);
  await wait(1500);
  const seen = await A.evaluate((id) => { const a = DEV.game.actors.find((x) => x.id === id); return a ? a.pos.toArray().map((v) => +v.toFixed(2)) : null; }, bId);
  const [SX, SZ] = spot;
  console.log(seen && Math.abs(seen[0] - SX) < 0.6 && Math.abs(seen[2] - SZ) < 0.6 ? '✅' : '❌', 'A sees B at', JSON.stringify(seen));
  // A shoots B (remote hit event → B applies damage as owner)
  await B.evaluate(() => { DEV.godMode(); DEV.setHealth(150, 0); });
  const hit = await A.evaluate(async ([id, x, z]) => { DEV.teleport(x, 0, z + 6, 0); DEV.equip(1, 'assault_rifle'); DEV.select(1); DEV.game.player.spawnProtect = 0; await new Promise((r) => setTimeout(r, 400)); DEV.aimAt(id, 'body'); DEV.input({ alt: true, fire: true, firePressed: true }); await new Promise((r) => setTimeout(r, 30)); DEV.input(null); await new Promise((r) => setTimeout(r, 1200)); return true; }, [bId, SX, SZ]);
  void hit;
  const hp = await B.evaluate(() => DEV.game.player.hp);
  console.log(hp < 150 ? '✅' : '❌', 'B took damage from A over the network, hp =', hp);
}
if (ok) {
  // B stays in the room but leaves the match (results/menu) → A must take over: a bot fills B's slot, owned + simulated by A
  await B.evaluate(() => { DEV.game.state = 'menu'; DEV.game.clearActors(); });
  await wait(5000);
  const take = await A.evaluate(() => { const g = DEV.game; return { actors: g.actors.map((a) => `${a.id}:${a.team}:${a.isBot ? 'bot' : 'human'}:${g.owns(a) ? 'mine' : 'remote'}:${a.alive ? 'alive' : 'dead'}`), players: g.net.players.length }; });
  const enemy = take.actors.filter((x) => x.includes(':bot:') && x.includes(':mine:'));
  console.log(take.players === 1 && enemy.length === 1 && take.actors.length === 2 ? '✅' : '❌', 'idle peer left the match → A owns the backfill bot', JSON.stringify(take));
}
console.log('errors:', errors.length ? errors : 'none');
await b1.close(); await b2.close(); srv.proc.kill(); process.exit(0);
