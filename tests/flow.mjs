import { startServer, launch, openGame, wait } from './lib.mjs';
const srv = await startServer(4610); const browser = await launch(); const errors = [];
const page = await openGame(browser, srv.url, errors);
const SC = process.argv[2] || 'test-results'; (await import('node:fs')).mkdirSync(SC, { recursive: true });
for (const [map, mode, secs] of [['cargo_yard', '1v1', 300], ['underground_lab', '2v2', 500], ['abandoned_city', 'red_vs_blue', 310], ['desert_outpost', 'ffa', 250]]) {
  const r = await page.evaluate((m, mo, s) => {
    DEV.loadMap(m, mo); const g = DEV.game; g.timeScale = 0; const t0 = performance.now(); let steps = 0;
    while (!g.match.ended && steps < s * 60) { g.fixedUpdate(1 / 60); steps++; if (steps % 30 === 0) g.renderFrame(0.5); }
    return { ended: g.match.ended, simSec: +(steps / 60).toFixed(1), ms: Math.round(performance.now() - t0), score: g.match.score, rounds: g.match.rounds, round: g.match.round, kills: g.actors.map((a) => a.stats.kills).reduce((x, y) => x + y, 0), me: g.player.stats, winner: g.match.winner };
  }, map, mode, secs);
  console.log(mode, map, JSON.stringify(r));
  await wait(400);
  await page.screenshot({ path: `${SC}/flow-${mode}.png` });
  const ui = await page.evaluate(() => ({ results: !!document.querySelector('.results'), title: document.querySelector('.results h1')?.textContent, coins: DEV.profile.coins }));
  console.log('  results screen:', JSON.stringify(ui));
}
console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close(); srv.proc.kill();
