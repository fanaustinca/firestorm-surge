// Shared headless-Chrome helpers (puppeteer-core + system Chrome, WebGL via ANGLE).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

export const CHROME = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startServer(port = 4190) {
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) return { proc, url: `http://localhost:${port}/` }; } catch { /* not yet */ } await wait(250); }
  throw new Error('preview server did not start');
}

export async function launch() {
  const gl = process.env.GL || 'swiftshader';
  const args = ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720'];
  if (gl === 'swiftshader') args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else args.push('--use-angle=' + gl, '--enable-gpu');
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args, protocolTimeout: 240000 });
}

export async function openGame(browser, url, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto(url + '?test', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.DEV, { timeout: 30000 });
  return page;
}
