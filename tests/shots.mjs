// Ad-hoc screenshots: node tests/shots.mjs out/ gun:ak47 map:cargo_yard ...
import { startServer, launch, openGame, wait } from './lib.mjs';
import fs from 'node:fs';
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const jobs = process.argv.slice(3);
const srv = await startServer(4191 + Math.floor(Math.random() * 50));
const browser = await launch(); const errors = [];
try {
  const page = await openGame(browser, srv.url, errors);
  await wait(500);
  for (const job of jobs) {
    const tj = Date.now(); const [kind, arg, extra] = job.split(":");
    if (kind === 'menu') await wait(300);
    if (kind === 'gun') { await page.evaluate((id, e) => DEV.inspectGun(id, e ? JSON.parse(e) : {}), arg, extra || ''); await page.evaluate(() => { DEV.game.studio.auto = false; }); await wait(300); }
    if (kind === 'map') { await page.evaluate((m, mode) => { DEV.exitInspect(); DEV.loadMap(m, mode || 'red_vs_blue'); }, arg, extra); await page.evaluate(() => DEV.advance(3.2)); await wait(400); }
    if (kind === 'eval') { await page.evaluate(arg.replace(/~/g, ':')); await wait(300); }
    if (kind === 'adv') { await page.evaluate((s) => DEV.advance(+s), arg); await wait(200); }
    const t0 = Date.now();
    const file = `${out}/${job.replace(/[^a-z0-9_]+/gi, '_').slice(0, 60)}.png`;
    await page.screenshot({ path: file }); console.log("shot", file, "screenshot ms", Date.now() - t0, "job ms", Date.now() - tj);
  }
} finally {
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close(); srv.proc.kill();
}
