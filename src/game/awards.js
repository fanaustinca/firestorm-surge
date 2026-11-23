// End-of-match MVP + funny awards. Pure function over the actors' stats / award counters.
export const mvpScore = (a) => a.stats.kills * 100 + a.stats.damage * 0.4 + a.stats.headshots * 15 + a.stats.bestStreak * 25 - a.stats.deaths * 20;

// [id, icon, title, flavour, value(a), min to qualify, format]
const AWARDS = [
  ['afk', '💤', 'MOST AFK', 'Went to make a sandwich', (a) => a.aw.afk, 0, (v) => `${Math.round(v)}s idle`],
  ['streak', '🔥', 'HOT STREAK', 'Could not be stopped', (a) => a.stats.bestStreak, 3, (v) => `${v} in a row`],
  ['heads', '🎯', 'HEADHUNTER', 'Aims for the brain, every time', (a) => a.stats.headshots, 3, (v) => `${v} headshots`],
  ['sponge', '🧽', 'DAMAGE SPONGE', 'Absorbed bullets so others didn\'t have to', (a) => a.aw.taken, 300, (v) => `${Math.round(v)} dmg taken`],
  ['respawn', '🪦', 'PROFESSIONAL RESPAWNER', 'Knows every spawn point by heart', (a) => a.stats.deaths, 4, (v) => `${v} deaths`],
  ['runner', '🏃', 'MARATHON RUNNER', 'Cardio is a weapon', (a) => a.aw.dist, 200, (v) => `${Math.round(v)} m run`],
  ['slide', '🛝', 'SLIP \'N SLIDE', 'Floor is basically a water park', (a) => a.aw.slide, 2, (v) => `${v.toFixed(1)}s sliding`],
  ['air', '🦘', 'FREQUENT FLYER', 'Allergic to the ground', (a) => a.aw.air, 8, (v) => `${Math.round(v)}s airborne`],
  ['emo', '🩴', 'EMOTIONAL TERRORIST', 'Left people in therapy', (a) => a.stats.emotional, 1, (v) => `${v}× emotional dmg`],
  ['yeet', '🚀', 'NASA INTERN', 'Launched people into low orbit', (a) => a.aw.yeets, 2, (v) => `${v} yeets`],
  ['banana', '🍌', 'BANANA REPUBLIC', 'Peels everywhere. Chaos everywhere.', (a) => a.aw.slips, 1, (v) => `${v} slipped`],
  ['revenge', '😤', 'PETTY', 'Never forgives, never forgets', (a) => a.aw.revenge, 2, (v) => `${v} revenge kills`],
  ['vendetta', '🎯', 'PERSONAL VENDETTA', null, (a) => Math.max(0, ...Object.values(a.aw.victims || {})), 4, (v) => `${v} kills on one person`],
  ['spray', '🌧️', 'SPRAY AND PRAY', 'Ammo is free, right?', (a) => a.aw.shots, 250, (v) => `${v} shots fired`],
  ['storm', '🎪', 'STORMTROOPER ACADEMY', 'Couldn\'t hit a barn from inside the barn', (a) => (a.isRemote || a.aw.shots < 40 ? -1 : 1 - Math.min(1, a.aw.hits / a.aw.shots)), 0.75, (v) => `${Math.round((1 - v) * 100)}% accuracy`],
  ['tourist', '🧳', 'TOURIST', 'Here for the sightseeing, not the fighting', (a) => (a.stats.kills <= 1 ? a.aw.dist : 0), 250, (v) => `${Math.round(v)} m, ≤1 kill`],
  ['close', '😩', 'SO CLOSE', 'All the damage, none of the credit', (a) => (a.stats.kills === 0 ? a.stats.damage : 0), 150, (v) => `${Math.round(v)} dmg, 0 kills`],
];

// Returns { mvp, awards: [{ id, icon, title, flavour, who, value }] }; Most AFK is always included.
export function matchAwards(actors) {
  const list = actors.filter((a) => !a.isTarget && a.aw);
  if (!list.length) return { mvp: null, awards: [] };
  const mvp = [...list].sort((a, b) => mvpScore(b) - mvpScore(a))[0];
  const awards = []; const taken = new Map();
  for (const [id, icon, title, flavour, val, min, fmt] of AWARDS) {
    const best = [...list].sort((a, b) => val(b) - val(a))[0]; const v = val(best);
    if (id !== 'afk' && (v < min || v <= 0)) continue;
    if (id === 'storm' && v <= 0) continue;
    // spread the love: one actor holds at most 2 awards (Most AFK exempt)
    if (id !== 'afk' && (taken.get(best) || 0) >= 2) continue;
    taken.set(best, (taken.get(best) || 0) + 1);
    const nobody = id === 'afk' && v < 3;
    let fl = flavour;
    if (id === 'vendetta') { const [vid] = Object.entries(best.aw.victims).sort((x, y) => y[1] - x[1])[0]; const vic = actors.find((x) => x.id === vid); fl = `Has a personal problem with ${vic ? vic.name : 'someone'}`; }
    awards.push({ id, icon, title, flavour: nobody ? 'Everyone actually played this time. Wow.' : fl, who: nobody ? null : best, value: nobody ? '—' : fmt(v) });
  }
  // Least Valuable Player — only with a full lobby, and never the MVP
  if (list.length >= 4) { const lvp = [...list].sort((a, b) => mvpScore(a) - mvpScore(b))[0]; if (lvp !== mvp) awards.push({ id: 'lvp', icon: '🥔', title: 'LEAST VALUABLE PLAYER', flavour: 'Thanks for showing up! ❤️', who: lvp, value: `${lvp.stats.kills}/${lvp.stats.deaths} K/D` }); }
  // keep it to 9 cards: Most AFK first, LVP last, a shuffle of the rest in between (fresh every match)
  const afk = awards.filter((x) => x.id === 'afk'), lvp = awards.filter((x) => x.id === 'lvp'), rest = awards.filter((x) => x.id !== 'afk' && x.id !== 'lvp');
  for (let i = rest.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return { mvp, awards: [...afk, ...rest.slice(0, 9 - afk.length - lvp.length), ...lvp] };
}
