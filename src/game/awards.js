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
    // spread the love: one actor holds at most 2 awards (Most AFK exempt)
    if (id !== 'afk' && (taken.get(best) || 0) >= 2) continue;
    taken.set(best, (taken.get(best) || 0) + 1);
    const nobody = id === 'afk' && v < 3;
    awards.push({ id, icon, title, flavour: nobody ? 'Everyone actually played this time. Wow.' : flavour, who: nobody ? null : best, value: nobody ? '—' : fmt(v) });
  }
  return { mvp, awards: awards.slice(0, 7) };
}
