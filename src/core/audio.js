// Procedural WebAudio SFX (no assets). Distance attenuation + stereo pan from the listener.
import * as THREE from 'three';

class Sfx {
  constructor() { this.wantMusic = false; this.mus = null; this.ctx = null; this.master = null; this.volume = 0.7; this.listener = { pos: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0) }; this.noiseBuf = null; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
    if (this.ctx && this.wantMusic) this._startMusic();
  }

  // ───── menu / shop / lobby background music (procedural synthwave loop: Am–F–C–G @ 112 BPM) ─────
  music(on) {
    this.wantMusic = on;
    if (!this.ctx) return;
    if (on && !this.mus) this._startMusic();
    if (!on && this.mus) this._stopMusic();
  }
  _startMusic() {
    const ctx = this.ctx; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.32, ctx.currentTime + 1.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; g.connect(lp); lp.connect(this.master);
    this.mus = { g, step: 0, next: ctx.currentTime + 0.12 };
    this.mus.timer = setInterval(() => this._sched(), 40);
  }
  _stopMusic() {
    const m = this.mus; this.mus = null; const t = this.ctx.currentTime;
    m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(Math.max(0.0001, m.g.gain.value), t); m.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    clearInterval(m.timer); setTimeout(() => m.g.disconnect(), 800);
  }
  _sched() {
    const m = this.mus; if (!m || this.ctx.state !== 'running') return;
    const sixteenth = 60 / 112 / 4;
    while (m.next < this.ctx.currentTime + 0.25) { this._musStep(m.step, m.next, sixteenth); m.step++; m.next += sixteenth; }
  }
  _note(dest, t, dur, f, type, gain, attack = 0.01, filt = 0) {
    const ctx = this.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filt) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(filt * 3, t); f2.frequency.exponentialRampToValueAtTime(filt, t + dur); o.connect(f2); f2.connect(g); } else o.connect(g);
    g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  _musStep(i, t, sx) {
    const d = this.mus.g; const s = i % 16, bar = Math.floor(i / 16) % 4;
    const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]][bar];
    const root = CH[0] / 2;
    if (s === 0 || s === 8 || s === 10) this._tone(d, t, 0.22, 140, 42, 'sine', 0.9);
    if (s === 4 || s === 12) this._noise(d, t, 0.16, 2400, 900, 0.8, 'bandpass', 0.38);
    if (s % 2 === 1) this._noise(d, t, 0.04, 9000, 7000, 1, 'highpass', 0.12);
    if ([0, 3, 6, 8, 11, 14].includes(s)) this._note(d, t, sx * 1.8, root, 'sawtooth', 0.22, 0.005, 420);
    if (s === 0) for (const f of CH) this._note(d, t, sx * 15, f, 'triangle', 0.06, 0.4);
    if (s % 2 === 0) { const f = CH[(s / 2) % 3] * (s % 8 < 4 ? 2 : 1); this._note(d, t, sx * 1.4, f, 'square', 0.035, 0.005, 2600); }
  }
  ultra() { if (!this.ctx) return; const { g } = this._out(null, 0.6); const t = this.ctx.currentTime; for (let i = 0; i < 4; i++) this._tone(g, t + i * 0.07, 0.25, 440 * 2 ** (i / 3), 880 * 2 ** (i / 3), 'sawtooth', 0.18); this._noise(g, t, 0.6, 400, 6000, 2, 'bandpass', 0.4); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setListener(pos, right) { this.listener.pos.copy(pos); this.listener.right.copy(right); }
  _out(pos, vol = 1, range = 60) {
    const ctx = this.ctx; const g = ctx.createGain(); let v = vol, pan = 0;
    if (pos) {
      const d = pos.distanceTo(this.listener.pos); v *= Math.max(0, 1 - d / range) ** 1.5;
      const rel = new THREE.Vector3().subVectors(pos, this.listener.pos); if (d > 0.5) pan = THREE.MathUtils.clamp(rel.normalize().dot(this.listener.right), -1, 1) * 0.8;
    }
    g.gain.value = v;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    return { g, v };
  }
  _noise(dest, t, dur, f0, f1, q = 1, type = 'bandpass', gain = 1, decay = 4) {
    const ctx = this.ctx; const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    void decay;
  }
  _tone(dest, t, dur, f0, f1, type = 'sine', gain = 0.5) {
    const ctx = this.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  _ok(key, gap = 0.02) { if (!this.ctx || this.ctx.state !== 'running') return false; const now = this.ctx.currentTime; if (this.last[key] && now - this.last[key] < gap) return false; this.last[key] = now; return true; }

  shot(kind, pos, vol = 1) {
    if (!this._ok('shot' + kind, 0.015)) return;
    const { g, v } = this._out(pos, vol, kind === 'heavy' ? 140 : 90); if (v < 0.01) return; const t = this.ctx.currentTime;
    switch (kind) {
      case 'pistol': this._noise(g, t, 0.18, 3000, 400, 0.8, 'bandpass', 0.9); this._tone(g, t, 0.08, 180, 60, 'triangle', 0.6); break;
      case 'smg': this._noise(g, t, 0.1, 3500, 600, 0.9, 'bandpass', 0.7); this._tone(g, t, 0.05, 160, 70, 'square', 0.25); break;
      case 'rifle': this._noise(g, t, 0.22, 2500, 300, 0.7, 'bandpass', 1); this._tone(g, t, 0.12, 140, 45, 'triangle', 0.7); break;
      case 'heavy': this._noise(g, t, 0.6, 1800, 120, 0.6, 'lowpass', 1.3); this._tone(g, t, 0.35, 110, 30, 'sawtooth', 0.6); this._noise(g, t + 0.05, 0.9, 900, 100, 0.5, 'lowpass', 0.3); break;
      case 'shotgun': this._noise(g, t, 0.35, 1600, 200, 0.6, 'lowpass', 1.4); this._tone(g, t, 0.2, 100, 40, 'triangle', 0.8); break;
      case 'launcher': this._noise(g, t, 0.4, 800, 200, 0.7, 'bandpass', 1); this._tone(g, t, 0.25, 90, 40, 'sine', 0.8); break;
      case 'mortar': this._tone(g, t, 0.3, 70, 30, 'sine', 1.2); this._noise(g, t, 0.3, 600, 100, 0.8, 'lowpass', 0.8); break;
      case 'bow': this._tone(g, t, 0.12, 300, 90, 'triangle', 0.4); this._noise(g, t, 0.08, 2000, 800, 2, 'bandpass', 0.25); break;
      case 'throw': this._noise(g, t, 0.18, 600, 2400, 3, 'bandpass', 0.35); break;
      case 'taser': this._noise(g, t, 0.35, 6000, 3000, 4, 'bandpass', 0.6); this._tone(g, t, 0.35, 90, 90, 'sawtooth', 0.25); break;
      case 'flame': this._noise(g, t, 0.14, 700, 400, 0.5, 'lowpass', 0.5); break;
      default: this._noise(g, t, 0.2, 2500, 300, 0.7, 'bandpass', 1);
    }
  }
  explosion(pos, big = 1) {
    if (!this._ok('boom', 0.04)) return; const { g, v } = this._out(pos, 1.4 * big, 160); if (v < 0.01) return; const t = this.ctx.currentTime;
    this._noise(g, t, 1.4, 900, 60, 0.5, 'lowpass', 1.5); this._tone(g, t, 0.6, 80, 25, 'sine', 1.2); this._noise(g, t, 0.15, 4000, 1000, 0.6, 'bandpass', 0.6);
  }
  whoosh(pos, heavy = false) { if (!this._ok('whoosh', 0.05)) return; const { g } = this._out(pos, 0.6, 30); const t = this.ctx.currentTime; this._noise(g, t, heavy ? 0.35 : 0.2, heavy ? 400 : 900, heavy ? 1600 : 3000, 2.5, 'bandpass', 0.6); }
  thud(pos) { if (!this._ok('thud', 0.03)) return; const { g } = this._out(pos, 0.9, 30); const t = this.ctx.currentTime; this._tone(g, t, 0.12, 150, 50, 'sine', 0.9); this._noise(g, t, 0.08, 1200, 300, 1, 'lowpass', 0.5); }
  slap(pos) { if (!this._ok('slap', 0.03)) return; const { g } = this._out(pos, 1.2, 40); const t = this.ctx.currentTime; this._noise(g, t, 0.09, 3000, 1500, 1.2, 'highpass', 1.4); this._tone(g, t, 0.08, 500, 200, 'triangle', 0.5); }
  hit(head = false) { if (!this._ok('hit', 0.03)) return; const { g } = this._out(null, 0.5); const t = this.ctx.currentTime; this._tone(g, t, head ? 0.12 : 0.06, head ? 1800 : 1100, head ? 1500 : 900, 'square', 0.25); if (head) this._tone(g, t + 0.04, 0.1, 2600, 2400, 'sine', 0.2); }
  kill() { if (!this.ctx) return; const { g } = this._out(null, 0.5); const t = this.ctx.currentTime; this._tone(g, t, 0.1, 880, 880, 'triangle', 0.35); this._tone(g, t + 0.08, 0.18, 1320, 1320, 'triangle', 0.35); }
  click() { if (!this._ok('click', 0.02)) return; const { g } = this._out(null, 0.4); const t = this.ctx.currentTime; this._noise(g, t, 0.03, 4000, 3000, 3, 'bandpass', 0.6); }
  reload(stage = 0) { if (!this._ok('reload' + stage, 0.05)) return; const { g } = this._out(null, 0.45); const t = this.ctx.currentTime; this._noise(g, t, 0.05, 2500 + stage * 800, 1800, 4, 'bandpass', 0.8); this._tone(g, t, 0.04, 400 + stage * 150, 300, 'square', 0.12); }
  ping() { if (!this.ctx) return; const { g } = this._out(null, 0.6); const t = this.ctx.currentTime; this._tone(g, t, 0.9, 2900, 2850, 'sine', 0.4); this._tone(g, t, 0.6, 4350, 4300, 'sine', 0.15); }
  empty() { if (!this._ok('empty', 0.15)) return; const { g } = this._out(null, 0.4); const t = this.ctx.currentTime; this._noise(g, t, 0.025, 3000, 2500, 5, 'bandpass', 0.6); }
  footstep(pos, vol = 1, surface = 'hard') { if (!this._ok('step' + (pos ? 'r' : 'l'), 0.12)) return; const { g, v } = this._out(pos, 0.3 * vol, 30); if (v < 0.005) return; const t = this.ctx.currentTime; this._noise(g, t, 0.08, surface === 'sand' ? 900 : 1500, 300, 1, 'lowpass', 0.8); }
  ring(time = 1.8) { if (!this.ctx) return; const { g } = this._out(null, 0.35); const t = this.ctx.currentTime; this._tone(g, t, time + 0.5, 3600, 3400, 'sine', 0.5); }
  beep(pos) { if (!this._ok('beep', 0.1)) return; const { g } = this._out(pos, 0.5, 25); const t = this.ctx.currentTime; this._tone(g, t, 0.06, 2200, 2200, 'square', 0.2); }
  ui(kind = 'ok') { if (!this.ctx) return; const { g } = this._out(null, 0.3); const t = this.ctx.currentTime; if (kind === 'buy') { this._tone(g, t, 0.12, 660, 660, 'triangle', 0.3); this._tone(g, t + 0.1, 0.2, 990, 990, 'triangle', 0.3); } else this._tone(g, t, 0.05, 700, 900, 'sine', 0.25); }
  heal() { if (!this.ctx) return; const { g } = this._out(null, 0.35); const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this._tone(g, t + i * 0.08, 0.15, 520 + i * 180, 540 + i * 180, 'sine', 0.25); }
  emotional() {
    if (!this.ctx) return; const { g } = this._out(null, 0.7); const t = this.ctx.currentTime;
    this._tone(g, t, 0.35, 220, 110, 'sawtooth', 0.35); this._tone(g, t + 0.05, 0.5, 330, 90, 'square', 0.15);
    try { if (window.speechSynthesis && !navigator.webdriver) { const u = new SpeechSynthesisUtterance('Emotional damage!'); u.rate = 1.15; u.pitch = 0.8; u.volume = this.volume; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch { /* optional */ }
  }
}

export const sfx = new Sfx();
