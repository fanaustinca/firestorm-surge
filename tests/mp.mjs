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
  // move B and check A sees it
  await B.evaluate(() => { DEV.godMode(); DEV.teleport(5, 0, 22, 0); });
  await wait(1500);
  const seen = await A.evaluate((id) => { const a = DEV.game.actors.find((x) => x.id === id); return a ? a.pos.toArray().map((v) => +v.toFixed(2)) : null; }, bId);
  console.log(seen && Math.abs(seen[0] - 5) < 0.6 && Math.abs(seen[2] - 22) < 0.6 ? '✅' : '❌', 'A sees B at', JSON.stringify(seen));
  // A shoots B (remote hit event → B applies damage as owner)
  await B.evaluate(() => { DEV.godMode(); DEV.setHealth(150, 0); });
  const hit = await A.evaluate(async (id) => { DEV.teleport(5, 0, 27, 0); DEV.equip(1, 'assault_rifle'); DEV.select(1); DEV.game.player.spawnProtect = 0; await new Promise((r) => setTimeout(r, 400)); DEV.aimAt(id, 'body'); DEV.input({ alt: true, fire: true, firePressed: true }); await new Promise((r) => setTimeout(r, 30)); DEV.input(null); await new Promise((r) => setTimeout(r, 1200)); return true; }, bId);
  void hit;
  const hp = await B.evaluate(() => DEV.game.player.hp);
  console.log(hp < 150 ? '✅' : '❌', 'B took damage from A over the network, hp =', hp);
}
console.log('errors:', errors.length ? errors : 'none');
await b1.close(); await b2.close(); srv.proc.kill(); process.exit(0);
