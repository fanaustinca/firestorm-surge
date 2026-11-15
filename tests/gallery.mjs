import { startServer, launch, openGame, wait } from './lib.mjs';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const srv = await startServer(4620); const browser = await launch(); const errors = [];
const page = await openGame(browser, srv.url, errors);
const ids = await page.evaluate(() => DEV.list().map((x) => x.split(': ')[1]));
for (const id of ids) { await page.evaluate((i) => { DEV.inspectGun(i, { angle: 0.8, elev: 0.35 }); DEV.game.studio.auto = false; DEV.game.renderStudio(0); }, id); await wait(60); await page.screenshot({ path: `${out}/${String(ids.indexOf(id)).padStart(2, '0')}-${id}.png` }); }
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); srv.proc.kill();
