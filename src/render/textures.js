// Procedural canvas textures (zero external assets).
import * as THREE from 'three';

const cache = new Map();
let seed = 1337;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function finish(c, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(ctx, w, h, amt, alpha = 1, size = 1) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
    const n = (rnd() - 0.5) * amt;
    for (let yy = 0; yy < size && y + yy < h; yy++) for (let xx = 0; xx < size && x + xx < w; xx++) {
      const i = ((y + yy) * w + x + xx) * 4;
      d[i] += n * alpha; d[i + 1] += n * alpha; d[i + 2] += n * alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, n, colors, rMin, rMax, alpha = 0.15) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rnd();
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    const r = rMin + rnd() * (rMax - rMin);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    ctx.save(); ctx.translate(rnd() * w, rnd() * h);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    void g;
  }
  ctx.globalAlpha = 1;
}

const makers = {
  concrete() {
    const [c, x] = canvas(512); x.fillStyle = '#8d8a84'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 140, ['#6f6c66', '#a29f98', '#7c776f'], 10, 60, 0.25);
    noise(x, 512, 512, 34);
    x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(30,30,30,0.5)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512);
    return finish(c);
  },
  asphalt() {
    const [c, x] = canvas(512); x.fillStyle = '#3d3f42'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 140, ['#2f3134', '#4a4c50', '#35322e', '#444240'], 30, 120, 0.25);
    noise(x, 512, 512, 18, 1, 1);
    x.strokeStyle = 'rgba(20,20,20,0.35)'; x.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (rnd() - 0.5) * 60; py += (rnd() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
    return finish(c);
  },
  brick() {
    const [c, x] = canvas(512); x.fillStyle = '#b8ab98'; x.fillRect(0, 0, 512, 512);
    const bh = 32, bw = 85;
    for (let r = 0; r < 512 / bh; r++) for (let k = -1; k < 512 / bw + 1; k++) {
      const off = (r % 2) * bw / 2; const hue = 6 + rnd() * 14, l = 26 + rnd() * 14;
      x.fillStyle = `hsl(${hue},${45 + rnd() * 20}%,${l}%)`;
      x.fillRect(k * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
    }
    blotches(x, 512, 512, 60, ['#2a1d16', '#5b4a3c', '#1e1e1e'], 20, 70, 0.22);
    noise(x, 512, 512, 30);
    return finish(c);
  },
  sand() {
    const [c, x] = canvas(512); x.fillStyle = '#d2b07a'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 120, ['#c09a63', '#e0c08c', '#b88d55'], 20, 90, 0.35);
    x.strokeStyle = 'rgba(150,110,60,0.25)'; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) { x.beginPath(); const y = rnd() * 512; x.moveTo(0, y); for (let px = 0; px <= 512; px += 32) x.lineTo(px, y + Math.sin(px * 0.03 + i) * 8); x.stroke(); }
    noise(x, 512, 512, 30);
    return finish(c);
  },
  rock() {
    const [c, x] = canvas(512); x.fillStyle = '#a07650'; x.fillRect(0, 0, 512, 512);
    blotches(x, 512, 512, 160, ['#6e4b30', '#c39468', '#8a5d3a', '#b58a60', '#5a3c26'], 20, 90, 0.4);
    for (let i = 0; i < 14; i++) { x.fillStyle = `hsla(${20 + rnd() * 12},${25 + rnd() * 20}%,${28 + rnd() * 30}%,0.35)`; x.fillRect(0, rnd() * 512, 512, 2 + rnd() * 10); }
    x.strokeStyle = 'rgba(50,30,18,0.55)'; x.lineWidth = 2.5;
    for (let i = 0; i < 18; i++) { x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 40; py += 15 + rnd() * 30; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(255,230,200,0.18)'; x.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 50; py += (rnd() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
    noise(x, 512, 512, 36, 1, 2);
    return finish(c);
  },
  metal() {
    const [c, x] = canvas(256); x.fillStyle = '#7d848a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; x.fillRect(0, i, 256, 1); }
    noise(x, 256, 256, 20);
    return finish(c);
  },
  plate() {
    const [c, x] = canvas(512); x.fillStyle = '#5c6268'; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = '#3a3e42'; x.lineWidth = 4;
    for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    x.fillStyle = '#7b8288';
    for (let i = 0; i < 512; i += 128) for (let j = 0; j < 512; j += 128) for (const [a, b] of [[10, 10], [118, 10], [10, 118], [118, 118]]) { x.beginPath(); x.arc(i + a, j + b, 4, 0, 7); x.fill(); }
    blotches(x, 512, 512, 40, ['#3d3a35', '#6b6f73'], 10, 50, 0.3);
    noise(x, 512, 512, 22);
    return finish(c);
  },
  tile() {
    const [c, x] = canvas(512); x.fillStyle = '#c7cdd1'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = `hsl(200,6%,${74 + rnd() * 8}%)`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    blotches(x, 512, 512, 30, ['#7a7f80', '#5c5248'], 10, 50, 0.2);
    noise(x, 512, 512, 14);
    return finish(c);
  },
  container() {
    // grayscale corrugation so instance colors tint it
    const [c, x] = canvas(512); x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 32) { const g = x.createLinearGradient(i, 0, i + 32, 0); g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.3, '#f2f2f2'); g.addColorStop(0.6, '#c4c4c4'); g.addColorStop(1, '#8a8a8a'); x.fillStyle = g; x.fillRect(i, 0, 32, 512); }
    blotches(x, 512, 512, 70, ['#5a3a20', '#7a5030', '#444'], 6, 40, 0.35); // rust
    x.fillStyle = '#9b9b9b'; x.fillRect(0, 0, 512, 14); x.fillRect(0, 498, 512, 14);
    noise(x, 512, 512, 18);
    return finish(c);
  },
  wood() {
    const [c, x] = canvas(256); x.fillStyle = '#8a5a32'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${50 + rnd() * 40},${28 + rnd() * 20},10,0.35)`; x.lineWidth = 1 + rnd() * 2; x.beginPath(); const y = rnd() * 256; x.moveTo(0, y); for (let px = 0; px <= 256; px += 16) x.lineTo(px, y + Math.sin(px * 0.05 + i) * 3); x.stroke(); }
    noise(x, 256, 256, 16);
    return finish(c);
  },
  crate() {
    const [c, x] = canvas(256); x.fillStyle = '#9b7444'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 42) { x.fillStyle = `hsl(32,${35 + rnd() * 10}%,${36 + rnd() * 8}%)`; x.fillRect(0, i + 2, 256, 38); }
    x.strokeStyle = '#5a3f20'; x.lineWidth = 16; x.strokeRect(8, 8, 240, 240);
    x.beginPath(); x.moveTo(8, 8); x.lineTo(248, 248); x.stroke();
    noise(x, 256, 256, 20);
    return finish(c);
  },
  vines() {
    const [c, x] = canvas(256, 512); x.clearRect(0, 0, 256, 512);
    for (let s = 0; s < 7; s++) {
      let px = 20 + s * 36 + rnd() * 10, py = 512;
      x.strokeStyle = '#3c5a22'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(px, py);
      while (py > 0) { px += (rnd() - 0.5) * 22; py -= 20; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 520; i++) {
      const px = rnd() * 256, py = rnd() * 512, r = 5 + rnd() * 9;
      x.fillStyle = `hsl(${95 + rnd() * 30},${45 + rnd() * 25}%,${22 + rnd() * 22}%)`;
      x.beginPath(); x.ellipse(px, py, r, r * 0.55, rnd() * 3, 0, Math.PI * 2); x.fill();
    }
    const t = finish(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
  },
  net() {
    const [c, x] = canvas(256); x.clearRect(0, 0, 256, 256);
    x.strokeStyle = '#c9b27c'; x.lineWidth = 7; x.lineCap = 'round';
    for (let i = -256; i < 512; i += 42) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); }
    x.strokeStyle = 'rgba(90,70,40,0.6)'; x.lineWidth = 2;
    for (let i = -256; i < 512; i += 42) { x.beginPath(); x.moveTo(i + 2, 0); x.lineTo(i + 258, 256); x.stroke(); }
    return finish(c);
  },
  hazard() {
    const [c, x] = canvas(256, 64); x.fillStyle = '#f2c21b'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#1b1b1b';
    for (let i = -64; i < 256; i += 48) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 24, 64); x.lineTo(i + 88, 0); x.lineTo(i + 64, 0); x.fill(); }
    noise(x, 256, 64, 20);
    return finish(c);
  },
  labwall() {
    const [c, x] = canvas(512); x.fillStyle = '#dfe3e4'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#2f8c8c'; x.fillRect(0, 300, 512, 26);
    x.fillStyle = '#9aa2a6'; x.fillRect(0, 440, 512, 72);
    x.strokeStyle = 'rgba(80,90,95,0.5)'; x.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); }
    blotches(x, 512, 512, 40, ['#8c8f88', '#a59a85'], 10, 60, 0.2);
    noise(x, 512, 512, 14);
    return finish(c);
  },
  soft() {
    const [c, x] = canvas(128); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return finish(c, { aniso: 1 });
  },
  smokepuff() {
    const [c, x] = canvas(128);
    for (let i = 0; i < 18; i++) {
      const px = 64 + (rnd() - 0.5) * 50, py = 64 + (rnd() - 0.5) * 50, r = 18 + rnd() * 26;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    return finish(c, { aniso: 1 });
  },
  flame() {
    const [c, x] = canvas(128); const g = x.createRadialGradient(64, 70, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.25, 'rgba(255,200,60,0.95)'); g.addColorStop(0.6, 'rgba(255,80,10,0.6)'); g.addColorStop(1, 'rgba(120,10,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return finish(c, { aniso: 1 });
  },
  ring() {
    const [c, x] = canvas(256); x.clearRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,40,30,1)'; x.lineWidth = 14; x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(255,40,30,0.55)'; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 80, 0, 7); x.stroke();
    x.fillStyle = 'rgba(255,40,30,0.18)'; x.beginPath(); x.arc(128, 128, 112, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,60,40,0.9)'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 30); x.lineTo(128, 226); x.moveTo(30, 128); x.lineTo(226, 128); x.stroke();
    return finish(c, { aniso: 1 });
  },
  sky() {
    const [c, x] = canvas(16, 256); const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#2e6fb5'); g.addColorStop(0.45, '#8ec0e8'); g.addColorStop(0.55, '#d9e6ee'); g.addColorStop(1, '#b8a990');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = finish(c, { aniso: 1 }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  },
  grip() {
    const [c, x] = canvas(128); x.fillStyle = '#222'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#333'; for (let i = 0; i < 128; i += 8) for (let j = 0; j < 128; j += 8) if ((i + j) % 16 === 0) x.fillRect(i, j, 6, 6);
    return finish(c, { aniso: 1 });
  },
  wrap() { // katana tsuka wrap (diamond pattern)
    const [c, x] = canvas(128); x.fillStyle = '#121212'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#e8e0c8';
    for (let j = 0; j < 128; j += 32) { x.beginPath(); x.moveTo(64, j + 2); x.lineTo(110, j + 16); x.lineTo(64, j + 30); x.lineTo(18, j + 16); x.closePath(); x.fill(); }
    return finish(c, { aniso: 1 });
  },
};

export function tex(name, repeat) {
  const key = name + ':' + (repeat ?? '');
  if (!cache.has(key)) {
    const base = cache.get(name) || makers[name]();
    cache.set(name, base);
    if (repeat == null) { cache.set(key, base); }
    else { const t = base.clone(); t.repeat.set(repeat[0] ?? repeat, repeat[1] ?? repeat); t.needsUpdate = true; cache.set(key, t); }
  }
  return cache.get(key);
}
