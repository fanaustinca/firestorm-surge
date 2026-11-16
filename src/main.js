import './style.css';
import { Game } from './game/game.js';
import { UI } from './ui/menu.js';
import { installDev } from './dev.js';
import { profile, WIN_POINTS } from './meta/profile.js';
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
  const winB = win ? 25 : 0, dmgB = Math.min(15, Math.floor(s.damage / 250));
  const matchCoins = 100 + winB + dmgB; profile.addCoins(matchCoins);
  const bounty = game.killCoins || 0; const coins = matchCoins + bounty;
  const rp = win ? (WIN_POINTS[game.modeId] || 50) : 0; const rankUp = rp ? profile.addRank(rp) : false;
  profile.d.totals.kills += s.kills; profile.d.totals.deaths += s.deaths; profile.d.totals.matches++; if (win) profile.d.totals.wins++;
  const quests = profile.questProgress({ ...s, wins: win ? 1 : 0, matches: 1 });
  profile.save(); profile.clearTrials(); gameplay.stop(); if (win) gameplay.happy();
  const board = [...game.actors].sort((a, b) => b.stats.kills - a.stats.kills).map((a) => ({ name: a.name, team: a.team, k: a.stats.kills, d: a.stats.deaths, dmg: Math.round(a.stats.damage), me: a === p }));
  const subtitle = m.roundBased ? `Rounds ${m.rounds.red}–${m.rounds.blue}` : m.mode.teams ? `Red ${m.score.red} – Blue ${m.score.blue}` : `Winner: ${game.actors.find((a) => a.id === winner)?.name || '—'}`;
  ui.lobby?.matchEnded();
  setTimeout(() => {
    if (game.match !== m) return;
    sfx.music(true);
    game.state = 'ended'; game.hud.show(false);
    ui.results({ win, title: winner == null ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT', subtitle: `${MODES[game.modeId].name} · ${game.map.info.name} · ${subtitle}`, coins, lines: [['Match bonus', '◉ 100'], [`Kill bounties (${game.killCount || 0})`, `◉ ${bounty}`], ['Win', `◉ ${winB}`], ['Damage', `◉ ${dmgB}`]], quests, rank: profile.rank(), rp, rankUp, board });
  }, game.testMode ? 50 : 2500);
  game.hud.center(`<b>${winner == null ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT'}</b>`, 3);
};

addEventListener('pointerdown', () => { if (game.state !== 'playing') sfx.music(true); }, { once: true });
if (params.has('autostart')) ui.play({ map: params.get('map') || 'cargo_yard', mode: params.get('mode') || 'red_vs_blue', online: params.has('online') });
console.log('%cFIRESTORM SURGE%c  — type DEV.help() for console commands', 'color:#ff6a1a;font-weight:900;font-size:16px', 'color:#aaa');
