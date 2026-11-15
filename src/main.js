import './style.css';
import { Game } from './game/game.js';
import { UI } from './ui/menu.js';
import { installDev } from './dev.js';
import { profile } from './meta/profile.js';
import { initAds, gameplay } from './meta/ads.js';
import { sfx } from './core/audio.js';
import { MODES } from './game/match.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const game = new Game(canvas);
game.testMode = params.has('test');
if (game.testMode) { game.autoPause = false; window.__FS_FAST_ADS = true; }
const ui = new UI(game);
installDev(game);
initAds();
sfx.setVolume(profile.d.settings.volume);
addEventListener('pointerdown', () => sfx.init(), { once: true });
addEventListener('keydown', () => sfx.init(), { once: true });

// apply pending loadout changes on respawn
const respawn = game.respawnActor.bind(game);
game.respawnActor = (a) => {
  if (a === game.player && a.pendingLoadout) {
    const lo = profile.effectiveLoadout(); const sk = {}; for (const s in lo) if (lo[s]) sk[lo[s]] = profile.skinFor(lo[s]);
    a.setLoadout(lo, sk); a.pendingLoadout = false;
  }
  respawn(a);
};

game.onPhase = (ph) => { if (ph === 'live') game.hud.center('<b>FIGHT!</b>', 1.2); if (ph === 'round') game.hud.center(`<b>ROUND ${game.match.round}</b>`, 1.6); };
game.onRoundEnd = (w) => {
  const mine = game.player.team;
  game.hud.center(w ? `<b class="t-${w}">${w === mine ? 'ROUND WON' : 'ROUND LOST'}</b><br>${w.toUpperCase()} ${game.match.rounds.red}–${game.match.rounds.blue}` : '<b>ROUND DRAW</b>', 3);
};
game.onMatchEnd = (winner) => {
  const p = game.player; const m = game.match;
  const win = m.mode.teams ? winner === p.team : winner === p.id;
  const s = p.stats;
  const kills = Math.min(30, s.kills * 3), winB = win ? 20 : 0, dmgB = Math.min(10, Math.floor(s.damage / 250));
  const coins = Math.max(100, Math.min(150, 100 + kills + winB + dmgB));
  profile.addCoins(coins);
  const rp = 20 + s.kills * 10 + (win ? 60 : 0); profile.addRank(rp);
  profile.d.totals.kills += s.kills; profile.d.totals.deaths += s.deaths; profile.d.totals.matches++; if (win) profile.d.totals.wins++;
  const quests = profile.questProgress({ ...s, wins: win ? 1 : 0, matches: 1 });
  profile.save(); profile.clearTrials(); gameplay.stop(); if (win) gameplay.happy();
  const board = [...game.actors].sort((a, b) => b.stats.kills - a.stats.kills).map((a) => ({ name: a.name, team: a.team, k: a.stats.kills, d: a.stats.deaths, dmg: Math.round(a.stats.damage), me: a === p }));
  const subtitle = m.roundBased ? `Rounds ${m.rounds.red}–${m.rounds.blue}` : m.mode.teams ? `Red ${m.score.red} – Blue ${m.score.blue}` : `Winner: ${game.actors.find((a) => a.id === winner)?.name || '—'}`;
  setTimeout(() => {
    if (game.match !== m) return;
    game.state = 'ended'; game.hud.show(false);
    ui.results({ win, title: winner == null ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT', subtitle: `${MODES[game.modeId].name} · ${game.map.info.name} · ${subtitle}`, coins, lines: [['Match bonus', '◉ 100'], ['Kills', `◉ ${kills}`], ['Win', `◉ ${winB}`], ['Damage', `◉ ${dmgB}`], ['Cap', '100–150 per match']], quests, rank: profile.rank(), rp, board });
  }, game.testMode ? 50 : 2500);
  game.hud.center(`<b>${winner == null ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT'}</b>`, 3);
};

if (params.has('autostart')) ui.play({ map: params.get('map') || 'cargo_yard', mode: params.get('mode') || 'red_vs_blue', online: params.has('online') });
console.log('%cFIRESTORM SURGE%c  — type DEV.help() for console commands', 'color:#ff6a1a;font-weight:900;font-size:16px', 'color:#aaa');
