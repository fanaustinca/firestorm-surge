// DOM HUD: crosshair, hitmarkers, health/armor, ammo, 6-slot bar, killfeed, scoreboard,
// radar, overlays (flash, thermal, stun, scope, low HP), toasts, EMOTIONAL DAMAGE popup.
import { WEAPON_BY_ID, SLOT_NAMES } from '../data/weapons.js';
import { itemIcon } from '../render/icons.js';

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export class Hud {
  constructor(game) {
    this.g = game; this.root = $('#hud'); this.feed = []; this.slotsKey = '';
    this.root.innerHTML = `
      <div id="xhair"><i class="l"></i><i class="r"></i><i class="t"></i><i class="b"></i><b class="dot"></b></div>
      <div id="hitmark"><i></i><i></i><i></i><i></i></div>
      <div id="dmgdir"></div>
      <div id="topbar"><div class="team red"><span id="sc-l">0</span></div><div class="mid"><div id="timer">0:00</div><div id="sclabel"></div></div><div class="team blue"><span id="sc-r">0</span></div></div>
      <canvas id="radar" width="168" height="168"></canvas>
      <div id="killfeed"></div>
      <div id="health"><div class="row"><span class="ico">✚</span><div class="bar"><i id="hpbar"></i><i id="arbar"></i></div><span id="hpnum">150</span></div><div id="status"></div></div>
      <div id="ammo"><div id="wname"></div><div class="nums"><span id="mag">30</span><span id="res">/ 150</span></div><div id="reload"><i></i></div></div>
      <div id="slots"></div>
      <div id="toast"></div>
      <div id="center-msg"></div>
      <div id="useprog"><div class="lbl"></div><div class="bar"><i></i></div></div>
      <div id="scope"><div class="ring"></div><div class="cross"></div></div>
      <div id="ov-flash"></div><div id="ov-thermal"></div><div id="ov-stun"></div><div id="ov-low"></div><div id="ov-dmg"></div>
      <div id="emo"><span>EMOTIONAL DAMAGE</span></div>
      <div id="scoreboard"></div>
      <div id="spectate"></div>
      <div id="hint">WASD move · Space jump · Mouse aim · LMB fire · RMB aim/ability · R reload · 1–5 slots · F thermal · Tab scores · B loadout</div>`;
    this.el = {};
    for (const id of ['xhair', 'hitmark', 'dmgdir', 'sc-l', 'sc-r', 'timer', 'sclabel', 'radar', 'killfeed', 'hpbar', 'arbar', 'hpnum', 'status', 'wname', 'mag', 'res', 'reload', 'slots', 'toast', 'center-msg', 'useprog', 'scope', 'ov-flash', 'ov-thermal', 'ov-stun', 'ov-low', 'ov-dmg', 'emo', 'scoreboard', 'spectate', 'hint']) this.el[id] = document.getElementById(id);
    this.rctx = this.el.radar.getContext('2d');
    this.hitT = 0; this.flashT = 0; this.flashMax = 1; this.emoT = 0; this.toastT = 0; this.dmgT = 0;
    setTimeout(() => this.el.hint.classList.add('fade'), 9000);
  }
  show(v) { this.root.style.display = v ? 'block' : 'none'; }

  hitmarker(head, kill) {
    this.hitT = 0.22; this.el.hitmark.className = 'on' + (head ? ' head' : '') + (kill ? ' kill' : '');
  }
  damageFrom(dirAngle) {
    const d = document.createElement('i'); d.style.transform = `rotate(${dirAngle}rad)`; this.el.dmgdir.appendChild(d);
    setTimeout(() => d.remove(), 900); this.dmgT = 0.25;
  }
  flash(t) { this.flashT = Math.max(this.flashT, t); this.flashMax = Math.max(t, 0.1); }
  emotional() {
    this.emoT = 1.4; const e = this.el.emo; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
  }
  toast(msg, kind = '') {
    if (!msg) return; const t = this.el.toast; t.textContent = msg; t.className = 'on ' + kind; this.toastT = 2.2;
  }
  center(msg, t = 2) { const c = this.el['center-msg']; c.innerHTML = msg; c.classList.add('on'); this.centerT = t; }
  killfeed(killer, victim, weapon, head) {
    const w = WEAPON_BY_ID[weapon]; const row = document.createElement('div'); row.className = 'kf';
    const kc = killer ? `t-${killer.team}` : ''; const vc = `t-${victim.team}`;
    const me = (a) => a === this.g.player ? ' me' : '';
    row.innerHTML = `${killer && killer !== victim ? `<b class="${kc}${me(killer)}">${esc(killer.name)}</b>` : ''}<img src="${itemIcon(weapon) || ''}" alt="">${head ? '<span class="hs">◎</span>' : ''}<b class="${vc}${me(victim)}">${esc(victim.name)}</b>`;
    if (!w) row.querySelector('img').remove();
    this.el.killfeed.prepend(row); setTimeout(() => row.remove(), 5500);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
  }

  buildSlots(a) {
    const key = JSON.stringify(a.loadout) + Object.keys(a.weapons).join();
    if (key === this.slotsKey) return; this.slotsKey = key;
    let html = '';
    for (let s = 1; s <= 6; s++) {
      const id = a.loadout[s]; const w = id && WEAPON_BY_ID[id];
      html += `<div class="slot ${w ? '' : 'empty'}" data-s="${s}"><span class="k">${s === 6 ? 'F' : s}</span>${w ? `<img src="${itemIcon(id, a.skins?.[id])}" alt="">` : `<div class="lock">${s >= 5 ? '🔒' : ''}</div>`}<span class="cnt"></span><div class="cd"></div><span class="nm">${w ? w.name : SLOT_NAMES[s]}</span></div>`;
    }
    this.el.slots.innerHTML = html;
    this.slotEls = [...this.el.slots.children];
  }

  update(dt) {
    const g = this.g, a = g.player; if (!a) return;
    // timers
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmark.className = ''; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.className = ''; }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.el['center-msg'].classList.remove('on'); }
    if (this.emoT > 0) { this.emoT -= dt; if (this.emoT <= 0) this.el.emo.classList.remove('on'); }
    this.flashT = Math.max(0, Math.max(this.flashT - dt, a.fx.flash));
    this.el['ov-flash'].style.opacity = Math.min(1, this.flashT / Math.max(0.3, this.flashMax * 0.4)).toFixed(3);
    this.el['ov-thermal'].style.opacity = a.thermal.on ? 1 : 0;
    this.el['ov-stun'].style.opacity = a.fx.stun > 0 ? 0.9 : 0;
    const hpF = (a.hp) / a.maxHp;
    this.el['ov-low'].style.opacity = a.alive ? Math.max(0, (0.45 - hpF) / 0.45).toFixed(2) : 0;
    this.dmgT = Math.max(0, this.dmgT - dt); this.el['ov-dmg'].style.opacity = (this.dmgT * 2.4).toFixed(2);
    // score/time
    const m = g.match; if (m) {
      const s = m.scoreline();
      this.el['sc-l'].textContent = s.left; this.el['sc-r'].textContent = s.right;
      this.el.sclabel.textContent = s.ffa ? `YOU · LEADER ${s.leader ? s.leader.toUpperCase() : ''} · ${s.label}` : `${m.mode.short} · ${s.label}`;
      this.el.timer.textContent = m.phase === 'warmup' ? `${Math.ceil(m.t)}` : fmt(m.timeLeft);
      this.root.classList.toggle('ffa', !!s.ffa);
    }
    // health
    this.el.hpbar.style.width = `${(a.hp / 200) * 100}%`; this.el.arbar.style.width = `${(a.armor / 200) * 100}%`; this.el.arbar.style.left = `${(a.hp / 200) * 100}%`;
    this.el.hpnum.innerHTML = `${Math.ceil(a.hp)}${a.armor > 0 ? `<small>+${Math.ceil(a.armor)}</small>` : ''}`;
    const st = [];
    if (a.fx.burn) st.push('<span class="st burn">🔥 BURNING</span>');
    if (a.fx.bleed.length) st.push('<span class="st bleed">🩸 BLEEDING</span>');
    if (a.fx.stun > 0) st.push('<span class="st stun">⚡ STUNNED</span>');
    if (a.fx.adrenaline > 0) st.push(`<span class="st adr">💉 ${a.fx.adrenaline.toFixed(1)}s</span>`);
    if (a.fx.scythe > 0) st.push('<span class="st reap">☠ REAPER RUSH</span>');
    if (a.loadout[6] === 'thermal_goggles') st.push(`<span class="st th${a.thermal.on ? ' on' : ''}">◉ THERMAL ${Math.round(a.thermal.battery / 8 * 100)}%</span>`);
    if (a.loadout[6] === 'spring_boots') st.push(`<span class="st boots">⇈ ${a.jumpsLeft > 0 || a.onGround ? 'DOUBLE JUMP' : '—'}</span>`);
    this.el.status.innerHTML = st.join('');
    // ammo
    const ws = a.ws, d = ws?.def;
    if (d) {
      this.el.wname.textContent = d.name + (g.profile?.onTrial(d.id) ? ' · TRIAL' : '');
      let mag = '', res = '';
      if (d.kind === 'melee') { mag = '∞'; res = d.ability ? (a.fx.scytheCd > 0 ? `RMB ${Math.ceil(a.fx.scytheCd)}s` : 'RMB READY') : ''; }
      else if (d.kind === 'throwable') { mag = ws.count; res = ws.cook >= 0 && d.cookable ? `${Math.max(0, d.fuse - ws.cook).toFixed(1)}s` : 'LEFT'; }
      else if (d.kind === 'usable') { mag = ws.usableCd > 0 ? Math.ceil(ws.usableCd) + 's' : 'READY'; res = ''; }
      else if (d.id === 'flamethrower') { mag = Math.ceil(ws.mag); res = `/ ${ws.reserve} FUEL`; }
      else { mag = ws.mag; res = ws.reserve === Infinity ? (d.regen ? `+1/${d.regen}s` : d.cooldown && ws.mag === 0 ? `${Math.max(0, ws.recharge).toFixed(1)}s` : d.recharge && ws.mag === 0 ? `${Math.max(0, ws.recharge).toFixed(1)}s` : '') : `/ ${ws.reserve}`; }
      this.el.mag.textContent = mag; this.el.res.textContent = res;
      this.el.mag.classList.toggle('low', typeof mag === 'number' && d.mag && mag <= Math.ceil(d.mag * 0.25) && d.kind !== 'throwable');
      const rl = ws.reloading > 0 ? 1 - ws.reloading / d.reload : 0;
      this.el.reload.style.opacity = ws.reloading > 0 ? 1 : 0; this.el.reload.firstElementChild.style.width = `${rl * 100}%`;
    }
    // use progress / cooking
    const up = this.el.useprog;
    if (ws && ws.useT >= 0 && d.use) { up.classList.add('on'); up.querySelector('.lbl').textContent = `USING ${d.name.toUpperCase()}`; up.querySelector('i').style.width = `${(ws.useT / d.use) * 100}%`; }
    else if (ws && ws.cook >= 0 && d.cookable) { up.classList.add('on'); up.querySelector('.lbl').textContent = 'COOKING — RELEASE TO THROW'; up.querySelector('i').style.width = `${(ws.cook / d.fuse) * 100}%`; }
    else up.classList.remove('on');
    // slots
    this.buildSlots(a);
    if (this.slotEls) for (let s = 1; s <= 6; s++) {
      const el = this.slotEls[s - 1]; const w = a.weapons[s];
      el.classList.toggle('active', a.slot === s);
      let cnt = '', cd = 0;
      if (w) {
        if (w.def.kind === 'throwable') cnt = '×' + w.count;
        if (w.def.kind === 'usable') cd = w.usableCd / w.def.cooldown;
        if (w.def.id === 'slippers' && w.mag === 0) cd = w.recharge / w.def.cooldown;
        if (w.def.ability && a.fx.scytheCd > 0) cd = a.fx.scytheCd / w.def.ability.cooldown;
        if (w.def.id === 'shurikens') cnt = '×' + w.mag;
      }
      if (s === 6 && a.loadout[6] === 'thermal_goggles') { cd = 1 - a.thermal.battery / 8; el.classList.toggle('active', a.thermal.on); }
      el.querySelector('.cnt').textContent = cnt; el.querySelector('.cd').style.height = `${Math.max(0, Math.min(1, cd)) * 100}%`;
    }
    // crosshair
    const scoped = d?.scope && g.vm.adsK > 0.92;
    this.el.scope.classList.toggle('on', !!scoped);
    const melee = d && ['melee', 'throwable', 'usable'].includes(d.kind);
    const spread = d ? ((d.spread || 0.01) * (a.ads ? 0.3 : 1) + a.bloom) * 900 + Math.hypot(a.vel.x, a.vel.z) * 1.2 + (a.onGround ? 0 : 10) : 10;
    const gap = Math.min(60, 4 + spread);
    const x = this.el.xhair; x.style.setProperty('--gap', `${gap}px`); x.classList.toggle('melee', !!melee); x.style.opacity = scoped || (a.ads && d?.kind !== 'pellet') || !a.alive ? 0 : 1;
    // spectate
    this.el.spectate.style.display = !a.alive && m && !m.ended ? 'block' : 'none';
    if (!a.alive && m) this.el.spectate.innerHTML = m.roundBased ? `<b>ELIMINATED</b><br>Spectating — next round soon` : `<b>KILLED${a.lastAttacker && a.lastAttacker !== a ? ' BY ' + esc(a.lastAttacker.name).toUpperCase() : ''}</b><br>Respawning in ${Math.max(0, a.respawnT).toFixed(1)}s`;
    this.drawRadar();
    if (g.input?.down('Tab')) this.renderScoreboard(); else this.el.scoreboard.classList.remove('on');
  }

  drawRadar() {
    const g = this.g, a = g.player, c = this.rctx, W = 168, R = 80, scale = R / 40;
    c.clearRect(0, 0, W, W);
    c.save(); c.translate(W / 2, W / 2);
    c.fillStyle = 'rgba(8,12,16,0.55)'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1; for (const rr of [R * 0.33, R * 0.66, R]) { c.beginPath(); c.arc(0, 0, rr, 0, 7); c.stroke(); }
    c.rotate(a.yaw);
    for (const o of g.actors) {
      if (o === a || !o.alive) continue;
      const enemy = g.hostile(a, o);
      if (enemy && !(g.time - (o.lastShotT || -9) < 1.5 || (a.thermal.on && o.pos.distanceTo(a.pos) < 30))) continue;
      const dx = (o.pos.x - a.pos.x) * scale, dz = (o.pos.z - a.pos.z) * scale;
      if (Math.hypot(dx, dz) > R - 3) continue;
      c.fillStyle = enemy ? '#ff4b3a' : '#5fb4ff'; c.beginPath(); c.arc(dx, dz, 4, 0, 7); c.fill();
    }
    c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(W / 2, W / 2 - 7); c.lineTo(W / 2 + 5, W / 2 + 5); c.lineTo(W / 2 - 5, W / 2 + 5); c.fill();
  }

  renderScoreboard() {
    const g = this.g; const sb = this.el.scoreboard; sb.classList.add('on');
    const rows = (list) => list.sort((x, y) => y.stats.kills - x.stats.kills || x.stats.deaths - y.stats.deaths).map((p) => `<tr class="${p === g.player ? 'me' : ''} ${p.alive ? '' : 'dead'}"><td class="nm"><span class="dot t-${p.team}"></span>${esc(p.name)}${p.isBot ? ' <em>BOT</em>' : p.isRemote ? ' <em>P2P</em>' : ''}</td><td>${p.stats.kills}</td><td>${p.stats.deaths}</td><td>${Math.round(p.stats.damage)}</td><td>${p.ping ?? (p.isRemote ? '~' : '—')}</td></tr>`).join('');
    const head = '<tr><th>PLAYER</th><th>K</th><th>D</th><th>DMG</th><th>NET</th></tr>';
    const m = g.match;
    if (m?.mode.teams) {
      sb.innerHTML = `<div class="sbh">${m.mode.name} · ${g.map.info.name}${g.net?.lobby ? ' · ' + g.net.lobby : ' · offline'}</div><div class="sbt"><table class="red"><caption>RED ${m.roundBased ? m.rounds.red : m.score.red}</caption>${head}${rows(g.actors.filter((x) => x.team === 'red'))}</table><table class="blue"><caption>BLUE ${m.roundBased ? m.rounds.blue : m.score.blue}</caption>${head}${rows(g.actors.filter((x) => x.team === 'blue'))}</table></div>`;
    } else sb.innerHTML = `<div class="sbh">${m?.mode.name} · ${g.map.info.name}</div><div class="sbt"><table class="ffa">${head}${rows([...g.actors])}</table></div>`;
  }
}
export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
