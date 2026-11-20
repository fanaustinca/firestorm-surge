// Menus: main, mode/map select, loadout & shop (coins + rewarded-ad trials), skins, quests,
// settings, pause, match results, inspect overlay.
import { WEAPONS, WEAPON_BY_ID, bySlot, SLOT_NAMES, SLOT_ACCESS_PRICE, SKIN_TIERS, SHOP_SKINS, BASE_SPEED, HOLIDAY_SKINS, ULTRA_OF } from '../data/weapons.js';
import { MAPS } from '../world/maps.js';
import { MODES } from '../game/match.js';
import { itemIcon, mapThumb } from '../render/icons.js';
import { Lobby } from '../net/lobby.js';
import { profile, RANKS } from '../meta/profile.js';
import { showRewardedAd, gameplay } from '../meta/ads.js';
import { setHolidayMode, holidayFor } from '../render/models.js';
import { sfx } from '../core/audio.js';
import { esc } from './hud.js';

const $ = (s, r = document) => r.querySelector(s);
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export class UI {
  constructor(game) {
    this.g = game; game.ui = this;
    this.root = $('#ui'); this.sel = { mode: 'red_vs_blue', online: true }; this.view = 'menu'; this.lobby = null;
    this.loSlot = 1; this.loItem = null; this.inGame = false;
    setHolidayMode(profile.d.settings.holiday);
    this.showMenu();
  }
  coinsHtml() { return `<span class="coins"><i>◉</i>${profile.coins.toLocaleString()}</span>`; }
  rankHtml() { const r = profile.rank(); return `<span class="rank" style="--rc:${r.color}" title="Rank points are earned by winning matches"><b>${r.name}</b><small>${r.points} RP${r.next ? ' / ' + r.next.min + ' → ' + r.next.name : ' · MAX'}</small><i class="rbar"><u style="width:${Math.round(r.frac * 100)}%"></u></i></span>`; }

  showMenu() {
    this.g.state = this.g.state === 'inspect' ? 'inspect' : 'menu'; this.g.hud.show(false); this.inGame = false; this.view = 'menu';
    sfx.music(true);
    const tile = (m) => `<button class="tile mode ${m.practice ? 'practice' : ''} ${this.sel.mode === m.id ? 'on' : ''}" data-mode="${m.id}"><b>${m.name}</b><small>${m.desc}</small></button>`;
    const modes = Object.values(MODES).map(tile).join('');
    const q = profile.d.quests.list.map((x) => `<div class="quest ${x.done ? 'done' : ''}"><span>${x.text}</span><div class="qbar"><i style="width:${(x.progress / x.goal) * 100}%"></i></div><small>${x.progress}/${x.goal}</small>${x.done && !x.claimed ? `<button class="btn tiny gold" data-claim="${x.id}">+${x.reward}</button>` : x.claimed ? '<em>✓</em>' : `<em>+${x.reward}</em>`}</div>`).join('');
    const hol = HOLIDAY_SKINS.filter((h) => holidayFor(h.weapon)).map((h) => `<span class="holiday">🎉 ${h.name} active</span>`).join('');
    const practice = MODES[this.sel.mode]?.practice;
    this.root.innerHTML = `
      <div class="menu">
        <header><div class="logo"><span class="fire">FIRESTORM</span><span class="surge">SURGE</span><span class="ver">v${VERSION}</span></div><div class="meta">${this.rankHtml()}${this.coinsHtml()}</div></header>
        <div class="cols">
          <section class="play">
            <h3>Choose a game mode</h3><div class="grid modes">${modes}</div>
            <p class="lead">${practice ? 'Pick any of the 8 maps and shoot steel targets — no bots, no pressure.' : 'You\'ll be dropped into a room with other players (bots fill empty slots) and everyone votes on the map.'}</p>
            <div class="go">
              ${practice ? '' : `<label class="toggle"><input type="checkbox" id="online" ${this.sel.online ? 'checked' : ''}><span></span>Online matchmaking <small>(P2P · bots backfill)</small></label>`}
              <button class="btn big primary" id="play">${practice ? 'CHOOSE MAP' : 'FIND ROOM'}</button>
            </div>
          </section>
          <aside>
            <button class="btn wide" id="loadout">LOADOUT & SHOP <kbd>B</kbd></button>
            <div class="panel"><h4>Daily Quests</h4>${q}</div>
            <div class="panel loadprev">${[1, 2, 3, 4, 5, 6].map((s) => { const id = profile.effectiveLoadout()[s]; return `<div class="lp ${id ? '' : 'empty'}"><img src="${id ? itemIcon(id, profile.skinFor(id)) : ''}" alt=""><small>${s} · ${id ? WEAPON_BY_ID[id].name : (profile.slotOpen(s) ? 'Empty' : 'Locked')}</small></div>`; }).join('')}</div>
            ${hol}
            <button class="btn wide ghost" id="settings">SETTINGS</button>
          </aside>
        </div>
        <footer>WASD · Space · Mouse · LMB fire · RMB aim/ability · C slide · R reload · 1–5 slots · F/V thermal · Tab scores · B/M loadout <span class="ver">Firestorm Surge v${VERSION}</span></footer>
      </div>`;
    this.root.style.display = 'block';
    this.root.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { this.sel.mode = b.dataset.mode; sfx.ui(); this.showMenu(); });
    this.root.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => { const n = profile.claimQuest(b.dataset.claim); if (n) sfx.ui('buy'); this.showMenu(); });
    const ol = $('#online'); if (ol) ol.onchange = (e) => { this.sel.online = e.target.checked; };
    $('#play').onclick = () => { sfx.init(); sfx.ui(); this.play(); };
    $('#loadout').onclick = () => this.openLoadout(false);
    $('#settings').onclick = () => this.openSettings();
  }

  // direct start (practice / DEV / ?autostart) or into the mode's room
  play(opts = {}) {
    sfx.init();
    const mode = opts.mode || this.sel.mode;
    if (opts.map) return this.launch(opts.map === 'random' ? Object.keys(MAPS)[(Math.random() * 8) | 0] : opts.map, mode, opts.online ?? false);
    if (MODES[mode].practice) return this.showPracticeMaps();
    this.enterLobby(mode);
  }
  launch(map, mode, online, matchId) {
    if (this.lobby) this.lobby.active = false;
    this.view = 'game'; sfx.music(false);
    this.root.style.display = 'none'; this.root.innerHTML = '';
    this.g.startMatch({ mapId: map, modeId: mode, online, matchId });
    this.g.input.enabled = true; if (!this.g.testMode) this.g.input.requestLock();
  }

  // ───────── room + map vote ─────────
  enterLobby(modeId) {
    if (!this.lobby || this.lobby.closed || this.lobby.modeId !== modeId) {
      this.lobby?.close();
      const lb = this.lobby = new Lobby(this.g, modeId, { online: this.sel.online });
      lb.onStartMatch = (map) => this.launch(map, modeId, this.g.net.connected, `${modeId}:${lb.state.seq}:${map}`);
      lb.on(() => { if (this.view === 'lobby') this.renderLobby(); });
      lb.start();
    }
    this.g.state = 'menu'; this.g.hud.show(false);
    this.lobby.active = true; this.view = 'lobby'; this.lobbyKey = null; sfx.music(true);
    this.renderLobby();
  }
  leaveLobby() { this.lobby?.close(); this.lobby = null; this.g.net.leave(); this.showMenu(); }
  renderLobby() {
    const lb = this.lobby; if (!lb) return;
    const st = lb.state; const key = st ? `${st.seq}:${st.phase}:${st.cands.join()}` : 'wait';
    const tally = st ? lb.tally() : {};
    const mine = st?.votes[lb.selfId];
    const people = [...lb.humans.map((h) => `<li class="human ${h.id === lb.selfId ? 'me' : ''}"><i>●</i>${esc(h.name)}${h.id === lb.selfId ? ' <small>(you)</small>' : ''}${st?.votes[h.id] ? ' <em>✓</em>' : ''}</li>`), ...lb.bots.map((b) => `<li class="bot"><i>◆</i>${esc(b.name)} <small>BOT</small>${st?.votes[b.id] ? ' <em>✓</em>' : ''}</li>`)].join('');
    const timer = !st ? '…' : st.phase === 'vote' ? `${Math.ceil(lb.timeLeft)}s` : 'GO!';
    if (this.lobbyKey === key && $('.lobby')) {
      $('#lb-timer').textContent = timer; $('#lb-status').textContent = lb.status; $('#lb-people').innerHTML = people;
      this.root.querySelectorAll('[data-vote]').forEach((el) => { const m = el.dataset.vote; el.querySelector('.cnt').textContent = tally[m] || 0; el.classList.toggle('mine', mine === m); el.classList.toggle('win', st.phase === 'match' && st.map === m); });
      return;
    }
    this.lobbyKey = key;
    const cards = st ? st.cands.map((m) => `<button class="vote ${mine === m ? 'mine' : ''} ${st.phase === 'match' && st.map === m ? 'win' : ''}" data-vote="${m}" style="--mc:${MAPS[m].color}"><div class="thumb"><img data-thumb="${m}" alt=""></div><b>${MAPS[m].name}</b><small>${MAPS[m].desc}</small><span class="cnt">${tally[m] || 0}</span></button>`).join('') : '<div class="waiting">Waiting for the room host…</div>';
    this.root.innerHTML = `<div class="modal lobby">
      <header><h2>${MODES[lb.modeId].name.toUpperCase()} · ROOM</h2><div class="meta">${this.coinsHtml()}<div class="timer" id="lb-timer">${timer}</div></div></header>
      <p class="status" id="lb-status">${esc(lb.status)}</p>
      <div class="lbody"><div class="votes"><h4>${st?.phase === 'match' ? 'Map locked in' : 'Vote for the map'}</h4><div class="vgrid">${cards}</div></div>
      <aside><h4>Players (${lb.humans.length + lb.bots.length}/${MODES[lb.modeId].size})</h4><ul id="lb-people">${people}</ul>
      <button class="btn wide" id="lb-lo">LOADOUT & SHOP</button><button class="btn wide ghost" id="lb-leave">LEAVE ROOM</button></aside></div></div>`;
    this.root.style.display = 'block';
    this.root.querySelectorAll('[data-vote]').forEach((b) => b.onclick = () => { sfx.ui(); lb.vote(b.dataset.vote); });
    this.fillThumbs();
    $('#lb-lo').onclick = () => { this.view = 'lobby-loadout'; this.openLoadout(false); };
    $('#lb-leave').onclick = () => this.leaveLobby();
  }
  fillThumbs() { this.root.querySelectorAll('img[data-thumb]').forEach((img) => mapThumb(img.dataset.thumb).then((url) => { if (url) img.src = url; img.classList.add('ok'); })); }

  showPracticeMaps() {
    this.view = 'practice'; sfx.music(true);
    const cards = Object.entries(MAPS).map(([id, m]) => `<button class="vote" data-pmap="${id}" style="--mc:${m.color}"><div class="thumb"><img data-thumb="${id}" alt=""></div><b>${m.name}</b><small>${m.desc}</small></button>`).join('');
    this.root.innerHTML = `<div class="modal lobby practice"><header><h2>PRACTICE RANGE · CHOOSE A MAP</h2><div class="meta">${this.coinsHtml()}<button class="btn ghost" id="pr-back">BACK ✕</button></div></header>
      <p class="status">Steel targets are spread over every level — some slide side to side. No bots, no timer, no coins.</p><div class="vgrid eight">${cards}</div></div>`;
    this.root.style.display = 'block';
    this.root.querySelectorAll('[data-pmap]').forEach((b) => b.onclick = () => { sfx.ui(); this.launch(b.dataset.pmap, 'practice', false); });
    $('#pr-back').onclick = () => this.showMenu();
    this.fillThumbs();
  }

  pause(on) {
    if (!on) { this.root.style.display = 'none'; this.root.innerHTML = ''; this.g.paused = false; this.g.input.requestLock(); return; }
    if (this.g.state !== 'playing') return;
    this.g.paused = true;
    this.root.innerHTML = `<div class="modal pause"><h2>PAUSED</h2>${this.g.net.connected ? '<p class="warn">Online match — the game keeps running!</p>' : ''}
      <button class="btn big primary" id="resume">RESUME</button><button class="btn wide" id="lo">LOADOUT <kbd>B</kbd></button><button class="btn wide" id="st">SETTINGS</button><button class="btn wide ghost" id="quit">QUIT TO MENU</button></div>`;
    this.root.style.display = 'block';
    $('#resume').onclick = () => this.pause(false);
    $('#lo').onclick = () => this.openLoadout(true);
    $('#st').onclick = () => this.openSettings(true);
    $('#quit').onclick = () => this.quit();
  }
  quit() { this.lobby?.close(); this.lobby = null; this.g.net.leave(); this.g.state = 'menu'; this.g.paused = false; profile.clearTrials(); gameplay.stop(); this.g.clearActors(); this.showMenu(); }

  // ───────── loadout & shop ─────────
  openLoadout(inGame) {
    this.inGame = inGame && this.g.state === 'playing';
    if (!this.inGame) sfx.music(true);
    if (this.inGame) { this.g.paused = !this.g.net.connected; this.g.input.exitLock(); }
    this.renderLoadout();
  }
  renderLoadout() {
    const slot = this.loSlot; const lo = profile.d.loadout;
    const items = bySlot(slot);
    if (!this.loItem || WEAPON_BY_ID[this.loItem].slot !== slot) this.loItem = lo[slot] || items[0].id;
    const tabs = [1, 2, 3, 4, 5, 6].map((s) => `<button class="tab ${s === slot ? 'on' : ''}" data-slot="${s}"><b>${s}</b>${SLOT_NAMES[s]}${s >= 5 && !profile.slotOpen(s) ? ' 🔒' : ''}</button>`).join('');
    const slotLocked = slot >= 5 && !profile.slotOpen(slot);
    const cards = items.map((w) => {
      const own = profile.owns(w.id), trial = profile.onTrial(w.id), eq = lo[slot] === w.id;
      const tag = eq ? '<em class="eq">EQUIPPED</em>' : trial ? '<em class="tr">TRIAL</em>' : own ? '' : `<em class="pr">◉ ${w.price}</em>`;
      return `<button class="card ${this.loItem === w.id ? 'on' : ''} ${own || trial ? '' : 'locked'}" data-item="${w.id}"><img src="${itemIcon(w.id, profile.skinFor(w.id))}" alt=""><b>${w.name}</b>${tag}</button>`;
    }).join('');
    const w = WEAPON_BY_ID[this.loItem];
    const own = profile.owns(w.id), usable = profile.usable(w.id);
    const kills = profile.kills(w.id);
    const cur = profile.skinFor(w.id) || null;
    const skins = w.slot <= 4 ? `<div class="skins"><h5>Kill skins · ${kills} kills</h5>${[{ id: null, name: 'Default', kills: 0 }, ...SKIN_TIERS].map((t) => { const un = kills >= t.kills; return `<button class="skin ${t.id || 'def'} ${un ? '' : 'lock'} ${cur === t.id ? 'on' : ''}" data-skin="${t.id || ''}" ${un ? '' : 'disabled'} title="${t.name} — ${t.kills} kills"><i></i><small>${t.name}${un ? '' : ' · ' + t.kills}</small></button>`; }).join('')}
      <h5>Skin shop · works on every weapon</h5>${SHOP_SKINS.map((t) => { const own = profile.ownsSkin(t.id); return `<button class="skin shop ${t.id} ${cur === t.id ? 'on' : ''} ${own ? '' : 'buyable'}" ${own ? `data-skin="${t.id}"` : `data-buyskin="${t.id}"`} ${!own && profile.coins < t.price ? 'disabled' : ''} title="${t.name}"><i></i><small>${t.name}${own ? '' : ' · ◉ ' + t.price}</small></button>`; }).join('')}</div>` : '';
    const uId = ULTRA_OF[w.id]; const U = uId && WEAPON_BY_ID[uId];
    const ultra = U ? `<div class="ultra-prev"><h5>⚡ ULTRA VARIANT <small>earned mid-match · lasts until you die</small></h5><div class="urow"><img src="${itemIcon(uId)}" alt=""><div><b>${U.name}</b><p>${U.desc}</p></div></div><button class="btn ultra" id="inspect-ultra">⚡ VIEW ULTRA IN 3D</button>${this.statsTable(U)}</div>` : '';
    let actions = '';
    if (slotLocked) {
      actions = `<div class="lockmsg">Slot ${slot} (${SLOT_NAMES[slot]}) is locked.</div><button class="btn primary" id="buyslot" ${profile.coins < SLOT_ACCESS_PRICE[slot] ? 'disabled' : ''}>UNLOCK SLOT · ◉ ${SLOT_ACCESS_PRICE[slot]}</button><button class="btn ad" id="adslot">▶ WATCH AD · 1-MATCH TRIAL</button>`;
    } else if (usable) {
      actions = lo[slot] === w.id ? `<button class="btn" disabled>EQUIPPED</button>${slot >= 5 ? '<button class="btn ghost" id="unequip">UNEQUIP</button>' : ''}` : `<button class="btn primary" id="equip">EQUIP</button>`;
      if (!own) actions += `<button class="btn gold" id="buy" ${profile.coins < w.price ? 'disabled' : ''}>BUY · ◉ ${w.price}</button>`;
    } else {
      actions = `<button class="btn gold" id="buy" ${profile.coins < w.price ? 'disabled' : ''}>BUY · ◉ ${w.price}</button><button class="btn ad" id="ad">▶ WATCH AD · 1-MATCH TRIAL</button>`;
    }
    this.root.innerHTML = `<div class="modal loadout">
      <header><h2>LOADOUT & SHOP</h2><div class="meta">${this.coinsHtml()}<button class="btn ghost" id="close">${this.inGame ? 'BACK TO MATCH' : 'CLOSE'} ✕</button></div></header>
      <nav class="tabs">${tabs}</nav>
      <div class="lbody"><div class="cards">${cards}</div>
      <div class="detail"><div class="big"><img src="${itemIcon(w.id, profile.skinFor(w.id))}" alt=""></div><h3>${w.name}</h3><p>${w.desc}</p>${this.statsTable(w)}${skins}${ultra}<div class="actions">${actions}<button class="btn ghost" id="inspect">🔍 INSPECT 3D</button></div>${this.inGame ? '<p class="note">Changes apply on your next respawn.</p>' : ''}</div></div></div>`;
    this.root.style.display = 'block';
    this.root.querySelectorAll('[data-slot]').forEach((b) => b.onclick = () => { this.loSlot = +b.dataset.slot; this.loItem = null; sfx.ui(); this.renderLoadout(); });
    this.root.querySelectorAll('[data-item]').forEach((b) => b.onclick = () => { this.loItem = b.dataset.item; sfx.ui(); this.renderLoadout(); });
    this.root.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => { profile.setSkin(w.id, b.dataset.skin || null); sfx.ui(); this.renderLoadout(); });
    this.root.querySelectorAll('[data-buyskin]').forEach((b) => b.onclick = () => { if (profile.buySkin(b.dataset.buyskin)) { sfx.ui('buy'); profile.setSkin(w.id, b.dataset.buyskin); } this.renderLoadout(); });
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('close', () => this.closeLoadout());
    on('equip', () => { profile.equip(slot, w.id); sfx.ui('buy'); this.applyIfDead(); this.renderLoadout(); });
    on('unequip', () => { profile.equip(slot, null); this.renderLoadout(); });
    on('buy', () => { if (profile.buy(w.id)) { sfx.ui('buy'); profile.equip(slot, w.id); this.applyIfDead(); } this.renderLoadout(); });
    on('ad', async () => { const ok = await showRewardedAd(`Unlock ${w.name} for one match`); if (ok) { profile.grantTrial(w.id); profile.equip(slot, w.id); sfx.ui('buy'); this.applyIfDead(); } this.renderLoadout(); });
    on('buyslot', () => { if (profile.buySlot(slot)) sfx.ui('buy'); this.renderLoadout(); });
    on('adslot', async () => { const ok = await showRewardedAd(`Unlock Slot ${slot} for one match`); if (ok) { profile.grantTrial('slot' + slot); sfx.ui('buy'); } this.renderLoadout(); });
    on('inspect', () => { this.root.style.display = 'none'; this.inspectReturn = true; this.g.inspect(w.id, { skin: profile.skinFor(w.id) }); });
    on('inspect-ultra', () => { this.root.style.display = 'none'; this.inspectReturn = true; this.g.inspect(uId); });
  }
  applyIfDead() { const p = this.g.player; if (p && !p.alive) { const lo = profile.effectiveLoadout(); const sk = {}; for (const s in lo) if (lo[s]) sk[lo[s]] = profile.skinFor(lo[s]); p.setLoadout(lo, sk); this.g.hud.slotsKey = ''; } else if (p) { p.pendingLoadout = true; } }
  closeLoadout() {
    if (this.inGame) { this.root.style.display = 'none'; this.root.innerHTML = ''; this.g.paused = false; this.g.input.requestLock(); }
    else if (this.view === 'lobby-loadout' && this.lobby && !this.lobby.closed) this.enterLobby(this.lobby.modeId);
    else this.showMenu();
  }
  statsTable(w) {
    const rows = [];
    const sp = w.speed != null ? `${w.speed.toFixed(2)}× (${(BASE_SPEED * w.speed).toFixed(2)} m/s)` : null;
    if (sp && w.slot <= 5) rows.push(['Move speed', sp]);
    if (w.dmg != null && w.dmg > 0) rows.push(['Damage', w.pellets ? `${w.dmg} × ${w.pellets} (${w.dmg * w.pellets} max)` : `${w.dmg}${w.head && w.head !== w.dmg ? ` / ${w.head} head` : ''}`]);
    if (w.splash) rows.push(['Splash', `${w.splash.min}–${w.splash.max} · ${w.splash.radius} m`]);
    if (w.mine) rows.push(['Trigger', `${w.mine.trigger} m · arms in ${w.mine.arm}s`]);
    if (w.pierce) rows.push(['Pierce', 'Every enemy in line']);
    if (w.interval && w.kind !== 'usable') rows.push([w.kind === 'melee' ? 'Swing' : 'Fire rate', w.kind === 'melee' ? `${(1 / w.interval).toFixed(2)}/s` : `${Math.round(60 / w.interval)} RPM`]);
    if (w.mag && w.kind !== 'melee') rows.push(['Magazine', `${w.mag}${w.reserve && w.reserve !== Infinity ? ` (+${w.reserve})` : ''}`]);
    if (w.reload && w.kind !== 'taser') rows.push(['Reload', `${w.reload}s${w.perShell ? ' / shell' : ''}`]);
    if (w.range) rows.push(['Range', `${w.range} m`]);
    if (w.reach) rows.push(['Reach', `${w.reach} m`]);
    if (w.vel) rows.push(['Velocity', `${w.vel} m/s`]);
    if (w.carry) rows.push(['Carry', w.carry]);
    if (w.use != null) rows.push(['Use time', w.use ? `${w.use}s` : 'Instant'], ['Cooldown', `${w.cooldown}s`]);
    if (w.ads && w.scope) rows.push(['Scope', `${w.ads}×`]);
    return `<table class="stats">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  }

  // ───────── settings ─────────
  openSettings(fromPause) {
    const s = profile.d.settings;
    this.root.innerHTML = `<div class="modal settings"><h2>SETTINGS</h2>
      <label>Callsign <input id="nm" maxlength="16" value="${esc(profile.d.name)}"></label>
      <label>Mouse sensitivity <input id="sens" type="range" min="0.2" max="3" step="0.05" value="${s.sens}"><output>${s.sens}</output></label>
      <label>Volume <input id="vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"><output>${s.volume}</output></label>
      <label>Field of view <input id="fov" type="range" min="65" max="100" step="1" value="${s.fov}"><output>${s.fov}</output></label>
      <label>Holiday reskins <select id="hol"><option value="auto">Auto (by month)</option><option value="on">Always on</option><option value="off">Off</option></select></label>
      <button class="btn primary" id="done">DONE</button></div>`;
    this.root.style.display = 'block'; $('#hol').value = s.holiday;
    this.root.querySelectorAll('input[type=range]').forEach((i) => i.oninput = () => { i.nextElementSibling.textContent = i.value; });
    $('#done').onclick = () => {
      s.sens = +$('#sens').value; s.volume = +$('#vol').value; s.fov = +$('#fov').value; s.holiday = $('#hol').value;
      profile.d.name = ($('#nm').value.trim() || profile.d.name).slice(0, 16); this.g.playerName = profile.d.name;
      sfx.setVolume(s.volume); this.g.baseFov = s.fov; setHolidayMode(s.holiday); profile.save();
      if (fromPause) this.pause(true); else this.showMenu();
    };
  }

  // ───────── results ─────────
  results(r) {
    this.g.input.exitLock();
    const rows = r.board.map((p) => `<tr class="${p.me ? 'me' : ''}"><td><span class="dot t-${p.team}"></span>${esc(p.name)}</td><td>${p.k}</td><td>${p.d}</td><td>${p.dmg}</td></tr>`).join('');
    this.root.innerHTML = `<div class="modal results ${r.win ? 'win' : 'loss'}"><h1>${r.title}</h1><p class="sub">${r.subtitle}</p>
      <div class="rgrid"><div class="earn"><h4>Rewards</h4>${r.lines.map(([a, b]) => `<div class="ln"><span>${a}</span><b>${b}</b></div>`).join('')}<div class="ln total"><span>Total</span><b>◉ ${r.coins}</b></div>
      ${r.quests.length ? `<h4>Quests completed</h4>${r.quests.map((q) => `<div class="ln q"><span>✓ ${q.text}</span><b>+${q.reward}</b></div>`).join('')}` : ''}
      <h4>Rank</h4><div class="ln rankln" style="--rc:${r.rank.color}"><span>${r.rankUp ? '<b class="rankup">RANK UP! </b>' : ''}${r.rank.name} <small>${r.rank.points} RP${r.rank.next ? ' / ' + r.rank.next.min : ''}</small></span><b>${r.rp ? '+' + r.rp + ' RP' : 'win to rank up'}</b></div><i class="rbar"><u style="width:${Math.round(r.rank.frac * 100)}%"></u></i></div>
      <div class="board"><table><tr><th>PLAYER</th><th>K</th><th>D</th><th>DMG</th></tr>${rows}</table></div></div>
      <div class="actions"><button class="btn big primary" id="again">PLAY AGAIN</button><button class="btn" id="menu">MAIN MENU</button></div></div>`;
    this.root.style.display = 'block';
    const practice = MODES[this.g.modeId]?.practice;
    $('#again').textContent = practice ? 'PLAY AGAIN' : 'BACK TO ROOM';
    $('#again').onclick = () => { this.g.state = 'menu'; this.g.clearActors(); if (practice) this.play({ map: this.g.mapId, mode: 'practice' }); else this.enterLobby(this.g.modeId); };
    $('#menu').onclick = () => { this.g.state = 'menu'; this.g.clearActors(); this.lobby?.close(); this.lobby = null; this.g.net.leave(); this.showMenu(); };
  }

  showInspect(label, w) {
    let el = $('#inspect-ov');
    if (!label) { if (el) el.remove(); if (this.inspectReturn) { this.inspectReturn = false; this.renderLoadout(); } return; }
    if (!el) { el = document.createElement('div'); el.id = 'inspect-ov'; document.body.appendChild(el); }
    el.innerHTML = `<div class="ttl">${esc(label)}</div>${w ? `<div class="sub">${SLOT_NAMES[w.slot]} · ${w.desc}</div>` : ''}<div class="hint">Drag to orbit · ESC to exit</div>`;
    el.onpointerdown = (e) => { const st = this.g.studio; if (!st) return; st.auto = false; const x0 = e.clientX, y0 = e.clientY, a0 = st.angle, e0 = st.elev; const mv = (ev) => { st.angle = a0 - (ev.clientX - x0) * 0.01; st.elev = Math.max(-0.2, Math.min(1.2, e0 + (ev.clientY - y0) * 0.01)); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
  }
}

export { WEAPONS, RANKS };
