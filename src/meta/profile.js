// Persistent player profile: coins, permanent unlocks, 1-match ad trials, kill-milestone skins,
// daily quests (seeded by date), permanent rank (points from wins). Stored in localStorage.
import { WEAPONS, WEAPON_BY_ID, DEFAULT_LOADOUT, SLOT_ACCESS_PRICE, SKIN_TIERS, SHOP_SKINS } from '../data/weapons.js';

const KEY = 'firestorm-surge-profile-v1';

const QUEST_POOL = [
  { id: 'kills10', text: 'Get 10 kills', stat: 'kills', goal: 10, reward: 60 },
  { id: 'heads5', text: 'Land 5 headshots', stat: 'headshots', goal: 5, reward: 70 },
  { id: 'melee3', text: 'Get 3 melee kills', stat: 'meleeKills', goal: 3, reward: 75 },
  { id: 'win1', text: 'Win a match', stat: 'wins', goal: 1, reward: 80 },
  { id: 'dmg1500', text: 'Deal 1,500 damage', stat: 'damage', goal: 1500, reward: 60 },
  { id: 'boom4', text: 'Get 4 explosive kills', stat: 'explosiveKills', goal: 4, reward: 70 },
  { id: 'play3', text: 'Play 3 matches', stat: 'matches', goal: 3, reward: 50 },
  { id: 'slipper1', text: 'Deal EMOTIONAL DAMAGE once', stat: 'emotional', goal: 1, reward: 65 },
  { id: 'throw5', text: 'Throw 5 throwables', stat: 'throws', goal: 5, reward: 45 },
];

// Permanent rank, stored locally. Points come from WINNING matches (1v1, 2v2, FFA, team games).
export const RANKS = [
  { id: 'recruit', name: 'Recruit', min: 0, color: '#9aa4ae' },
  { id: 'bronze', name: 'Bronze', min: 100, color: '#c58040' },
  { id: 'silver', name: 'Silver', min: 300, color: '#c8d0d8' },
  { id: 'gold', name: 'Gold', min: 650, color: '#ffcc33' },
  { id: 'platinum', name: 'Platinum', min: 1100, color: '#7fe8e0' },
  { id: 'diamond', name: 'Diamond', min: 1700, color: '#8fb8ff' },
  { id: 'master', name: 'Master', min: 2500, color: '#d070ff' },
  { id: 'legend', name: 'Firestorm Legend', min: 3600, color: '#ff5a2a' },
];
// ─── Achievements: lifetime counters in d.life; unlocking pays coins once ───
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Get your first kill', stat: 'kills', goal: 1, reward: 50, icon: '🩸' },
  { id: 'warmed_up', name: 'Getting Warmed Up', desc: 'Get 100 kills', stat: 'kills', goal: 100, reward: 300, icon: '🔥' },
  { id: 'menace', name: 'Certified Menace', desc: 'Get 1,000 kills', stat: 'kills', goal: 1000, reward: 1500, icon: '😈' },
  { id: 'big_brain', name: 'Big Brain Time', desc: 'Land 50 headshots', stat: 'headshots', goal: 50, reward: 250, icon: '🧠' },
  { id: 'hands', name: 'Hands Are Rated E for Everyone', desc: 'Get 25 melee kills', stat: 'meleeKills', goal: 25, reward: 200, icon: '👊' },
  { id: 'michael_bay', name: 'Michael Bay Fan Club', desc: 'Get 50 explosive kills', stat: 'explosiveKills', goal: 50, reward: 250, icon: '💥' },
  { id: 'skill_issue', name: 'Skill Issue', desc: 'Blow yourself up. Congratulations?', stat: 'selfKills', goal: 1, reward: 50, icon: '🤡' },
  { id: 'speedrun', name: 'Speedrun Any%', desc: 'Die within 5 seconds of spawning', stat: 'quickDeaths', goal: 1, reward: 50, icon: '⏱️' },
  { id: 'participation', name: 'Participation Trophy', desc: 'Lose a match. You tried, and that\'s what counts', stat: 'losses', goal: 1, reward: 25, icon: '🏅' },
  { id: 'pacifist', name: 'Conscientious Objector', desc: 'Finish a match with zero kills', stat: 'zeroKillMatches', goal: 1, reward: 25, icon: '🕊️' },
  { id: 'respawn_fan', name: 'Respawn Enthusiast', desc: 'Die 100 times. The floor is your friend', stat: 'deaths', goal: 100, reward: 100, icon: '🪦' },
  { id: 'touch_grass', name: 'Touch Grass', desc: 'Play 25 matches', stat: 'matches', goal: 25, reward: 200, icon: '🌱' },
  { id: 'undefeated', name: 'Undefeated (ish)', desc: 'Win 10 matches', stat: 'wins', goal: 10, reward: 300, icon: '🏆' },
  { id: 'damage_dealer', name: 'Professional Damage Dealer', desc: 'Deal 50,000 damage in total', stat: 'damage', goal: 50000, reward: 300, icon: '📈' },
  { id: 'mom_proud', name: 'Your Mom Would Be Proud', desc: 'Deal EMOTIONAL DAMAGE 10 times', stat: 'emotional', goal: 10, reward: 150, icon: '🩴' },
  { id: 'snow_day', name: 'Snow Day', desc: 'Get 10 kills with the Snowball Launcher', stat: 'snowKills', goal: 10, reward: 150, icon: '☃️' },
  { id: 'bob_ross', name: 'Happy Little Accidents', desc: 'Get 25 kills with the Paintball Gun', stat: 'paintKills', goal: 25, reward: 200, icon: '🎨' },
  { id: 'hydrated', name: 'Stay Hydrated', desc: 'Get 10 kills with the Water Gun', stat: 'waterKills', goal: 10, reward: 150, icon: '💧' },
  { id: 'wimbledon', name: 'Wimbledon Reject', desc: 'Get 10 kills with the Tennis Ball Launcher', stat: 'tennisKills', goal: 10, reward: 150, icon: '🎾' },
  { id: 'trick_shot', name: 'Trick Shot', desc: 'Kill someone with a tennis ball after it bounced', stat: 'trickKills', goal: 1, reward: 100, icon: '🪃' },
  { id: 'spartan', name: 'THIS. IS. SPARTA!', desc: 'Get 15 kills with the Spear', stat: 'spearKills', goal: 15, reward: 200, icon: '🔱' },
  { id: 'javelin', name: 'Olympic Javelin', desc: 'Kill someone with a thrown spear from 30+ m', stat: 'javelinKills', goal: 1, reward: 200, icon: '🥇' },
  { id: 'get_over_here', name: 'Get Over Here!', desc: 'Fire the grapple hook 50 times', stat: 'grapples', goal: 50, reward: 100, icon: '🪝' },
  { id: 'slip_n_slide', name: 'Slip \'n Slide', desc: 'Slide 100 times', stat: 'slides', goal: 100, reward: 100, icon: '🛝' },
  { id: 'spin_doctor', name: 'Spin Doctor', desc: 'Spin the Daily Wheel 7 times', stat: 'spins', goal: 7, reward: 150, icon: '🎡' },
  { id: 'dragon_hoard', name: 'Dragon Hoard', desc: 'Hold 5,000 coins at once (spending is for quitters)', stat: 'coinPeak', goal: 5000, reward: 250, icon: '🐉', max: true },
];

// ─── Daily Wheel: one free spin per day ───
export const WHEEL = [
  { id: 'c50', label: '◉ 50', coins: 50, w: 22, color: '#3a4250' },
  { id: 'c100', label: '◉ 100', coins: 100, w: 22, color: '#c0502a' },
  { id: 'trial', label: 'FREE TRIAL', trial: true, w: 13, color: '#2f6fd6' },
  { id: 'c150', label: '◉ 150', coins: 150, w: 16, color: '#4a8a3a' },
  { id: 'c250', label: '◉ 250', coins: 250, w: 12, color: '#8a40c0' },
  { id: 'skin', label: 'SHOP SKIN', skin: true, w: 4, color: '#d0a020' },
  { id: 'c500', label: '◉ 500', coins: 500, w: 8, color: '#c8352b' },
  { id: 'c1000', label: 'JACKPOT 1000', coins: 1000, w: 3, color: '#ff8a1a' },
];

export const WIN_POINTS = { '1v1': 60, '2v2': 70, ffa: 90, red_vs_blue: 50 };

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }

function fresh() {
  return {
    name: 'Player' + Math.floor(1000 + Math.random() * 9000),
    coins: 300, owned: WEAPONS.filter((w) => w.free && !w.slotFree).map((w) => w.id), slots: { 5: false, 6: false },
    loadout: { ...DEFAULT_LOADOUT }, weaponKills: {}, skinSel: {}, skinsOwned: [], totals: { kills: 0, deaths: 0, matches: 0, wins: 0 },
    quests: null, rank: { month: month(), points: 0 }, settings: { sens: 1, volume: 0.7, fov: 80, holiday: 'auto', quality: 'high' },
  };
}

class Profile {
  constructor() { this.trials = new Set(); this.load(); }
  load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
    this.d = Object.assign(fresh(), d || {});
    this.d.settings = Object.assign(fresh().settings, this.d.settings);
    // retired items (e.g. the Drum Breaker in v2.4): refund their price, drop them, fall back to the default in that slot
    const RETIRED = { drum_breaker: 1150 }; let changed = false;
    for (const id of this.d.owned || []) if (!WEAPON_BY_ID[id]) { this.d.coins += RETIRED[id] || 0; changed = true; }
    this.d.owned = (this.d.owned || []).filter((id) => WEAPON_BY_ID[id]);
    for (const s of Object.keys(this.d.loadout || {})) { const id = this.d.loadout[s]; if (id && !WEAPON_BY_ID[id]) { this.d.loadout[s] = DEFAULT_LOADOUT[s] ?? null; changed = true; } }
    if (changed) this.save();
    this.ensureQuests(); this.ensureRank();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch { /* private mode */ } }
  get coins() { return this.d.coins; }
  addCoins(n) { this.d.coins = Math.max(0, Math.round(this.d.coins + n)); this.save(); if (n > 0) this.bump('coinPeak', this.d.coins); }

  // ─── achievements ───
  life(stat) { return (this.d.life ||= {})[stat] || 0; }
  achieved(id) { return !!(this.d.ach ||= {})[id]; }
  // add n to a lifetime counter (or raise a max-type one); returns newly unlocked achievements (already paid)
  bump(stat, n = 1) {
    const L = (this.d.life ||= {}); const A = (this.d.ach ||= {});
    const maxType = ACHIEVEMENTS.some((x) => x.stat === stat && x.max);
    L[stat] = maxType ? Math.max(L[stat] || 0, n) : (L[stat] || 0) + n;
    const fresh = [];
    for (const a of ACHIEVEMENTS) if (a.stat === stat && !A[a.id] && L[stat] >= a.goal) { A[a.id] = Date.now(); fresh.push(a); }
    if (fresh.length) { this.d.coins += fresh.reduce((s, a) => s + a.reward, 0); for (const f of fresh) this.onAchievement?.(f); }
    this.save();
    if (fresh.length && stat !== 'coinPeak') this.bump('coinPeak', this.d.coins);
    return fresh;
  }

  // ─── daily wheel ───
  canSpin() { return this.d.wheelDay !== today(); }
  // consecutive-day streak: the spin you're about to take (1..7), bonus coins on top of any prize
  nextStreak() { return this.d.wheelDay === yesterday() ? Math.min(7, (this.d.wheelStreak || 0) + 1) : this.d.wheelDay === today() ? (this.d.wheelStreak || 1) : 1; }
  streakBonus(n = this.nextStreak()) { return (n - 1) * 25; }
  spin(rand = Math.random) {
    if (!this.canSpin()) return null;
    const total = WHEEL.reduce((s, x) => s + x.w, 0); let r = rand() * total, idx = 0;
    for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].w; if (r <= 0) { idx = i; break; } }
    const seg = WHEEL[idx]; const res = { idx, seg, text: '' };
    if (seg.skin) {
      const left = SHOP_SKINS.filter((x) => !this.ownsSkin(x.id));
      if (left.length) { const sk = left[Math.floor(rand() * left.length)]; (this.d.skinsOwned ||= []).push(sk.id); res.text = `${sk.name} skin unlocked forever!`; }
      else { this.d.coins += 600; res.text = 'You own every skin — ◉ 600 instead!'; }
    } else if (seg.trial) {
      const locked = WEAPONS.filter((w) => !w.free && !this.owns(w.id) && w.slot <= 4);
      if (locked.length) { const w = locked[Math.floor(rand() * locked.length)]; this.grantTrial(w.id); this.d.loadout[w.slot] = w.id; res.trial = w.id; res.text = `${w.name} — free for your next match (equipped)!`; }
      else { this.d.coins += 200; res.text = 'You own everything — ◉ 200 instead!'; }
    } else { this.d.coins += seg.coins; res.text = `+◉ ${seg.coins}`; }
    const streak = this.nextStreak(), bonus = this.streakBonus(streak);
    this.d.wheelStreak = streak; res.streak = streak; res.bonus = bonus;
    if (bonus) { this.d.coins += bonus; res.text += ` · Day ${streak} streak +◉ ${bonus}`; }
    this.d.wheelDay = today(); this.save();
    this.bump('spins'); this.bump('coinPeak', this.d.coins);
    return res;
  }

  slotOpen(slot) { return slot <= 4 || this.d.slots[slot] || this.trials.has('slot' + slot); }
  slotOwned(slot) { return slot <= 4 || this.d.slots[slot]; }
  owns(id) {
    const w = WEAPON_BY_ID[id]; if (!w) return false;
    if (w.slotFree) return this.slotOwned(w.slot) || this.trials.has('slot' + w.slot);
    return this.d.owned.includes(id);
  }
  usable(id) { const w = WEAPON_BY_ID[id]; if (!w) return false; return this.slotOpen(w.slot) && (this.owns(id) || this.trials.has(id)); }
  onTrial(id) { return this.trials.has(id) && !this.owns(id); }
  buy(id) {
    const w = WEAPON_BY_ID[id]; if (!w || this.owns(id) || this.d.coins < w.price) return false;
    this.d.coins -= w.price; this.d.owned.push(id); this.save(); return true;
  }
  buySlot(slot) {
    const p = SLOT_ACCESS_PRICE[slot]; if (this.d.slots[slot] || this.d.coins < p) return false;
    this.d.coins -= p; this.d.slots[slot] = true; this.save(); return true;
  }
  grantTrial(key) { this.trials.add(key); }
  clearTrials() { this.trials.clear(); }
  unlockAll() { this.d.owned = WEAPONS.map((w) => w.id); this.d.slots = { 5: true, 6: true }; this.d.skinsOwned = SHOP_SKINS.map((s) => s.id); this.save(); }
  equip(slot, id) { this.d.loadout[slot] = id; this.save(); }

  // the loadout actually usable this match
  effectiveLoadout() {
    const out = {};
    for (let s = 1; s <= 6; s++) { const id = this.d.loadout[s]; out[s] = id && this.usable(id) ? id : (s <= 4 ? DEFAULT_LOADOUT[s] : null); }
    return out;
  }

  // ─── skins ───
  kills(id) { return this.d.weaponKills[id] || 0; }
  unlockedSkins(id) { const k = this.kills(id); return [...SKIN_TIERS.filter((t) => k >= t.kills).map((t) => t.id), ...(this.d.skinsOwned || [])]; }
  ownsSkin(sk) { return (this.d.skinsOwned || []).includes(sk); }
  buySkin(sk) { const s = SHOP_SKINS.find((x) => x.id === sk); if (!s || this.ownsSkin(sk) || this.d.coins < s.price) return false; this.d.coins -= s.price; (this.d.skinsOwned ||= []).push(sk); this.save(); return true; }
  skinFor(id) { const s = this.d.skinSel[id]; return s && this.unlockedSkins(id).includes(s) ? s : null; }
  setSkin(id, skin) { this.d.skinSel[id] = skin; this.save(); }
  addWeaponKill(id) { this.d.weaponKills[id] = (this.d.weaponKills[id] || 0) + 1; const t = SKIN_TIERS.find((x) => x.kills === this.d.weaponKills[id]); return t || null; }

  // ─── quests ───
  ensureQuests() {
    if (this.d.quests && this.d.quests.day === today()) return;
    const r = seeded(today()); const pool = [...QUEST_POOL]; const picks = [];
    while (picks.length < 3) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    this.d.quests = { day: today(), list: picks.map((q) => ({ ...q, progress: 0, done: false, claimed: false })) };
    this.save();
  }
  questProgress(stats) {
    this.ensureQuests(); const done = [];
    for (const q of this.d.quests.list) {
      if (q.done) continue; q.progress = Math.min(q.goal, q.progress + (stats[q.stat] || 0));
      if (q.progress >= q.goal) { q.done = true; done.push(q); }
    }
    this.save(); return done;
  }
  claimQuest(id) { const q = this.d.quests.list.find((x) => x.id === id); if (!q || !q.done || q.claimed) return 0; q.claimed = true; this.addCoins(q.reward); return q.reward; }

  // ─── rank ───
  ensureRank() { if (this.d.rankPts == null) { this.d.rankPts = this.d.rank?.points || 0; this.save(); } }
  addRank(n) { this.ensureRank(); const before = this.rank().id; this.d.rankPts = Math.max(0, this.d.rankPts + n); this.d.totals.rankWins = (this.d.totals.rankWins || 0) + (n > 0 ? 1 : 0); this.save(); return this.rank().id !== before; }
  rank() { this.ensureRank(); const p = this.d.rankPts; let r = RANKS[0]; for (const x of RANKS) if (p >= x.min) r = x; const next = RANKS[RANKS.indexOf(r) + 1]; return { ...r, points: p, next, frac: next ? (p - r.min) / (next.min - r.min) : 1 }; }
}

export const profile = new Profile();
