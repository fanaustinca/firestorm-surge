// Firestorm Surge — complete 6-slot item table (39 items).
// Units: meters, seconds, m/s. `interval` = seconds between shots/swings.
// `speed` = active-hand movement multiplier (only the held item counts).
// `price` = coin unlock cost (0 / free:true = starter). Every non-free item can also
// be used for one match through a rewarded-ad trial.

export const BASE_HP = 150;
export const MAX_ARMOR = 50;
export const BASE_SPEED = 7.0;
export const GRAVITY = -20;
export const JUMP_HEIGHT = 1.25;
export const JUMP_IMPULSE = Math.sqrt(2 * -GRAVITY * JUMP_HEIGHT); // ≈7.07 m/s
export const CLIMB_SPEED = 5.5;
export const SPEED_MIN = 0.75, SPEED_MAX = 1.35, SPEED_ABILITY_MAX = 1.55;

export const SLOT_ACCESS_PRICE = { 5: 1200, 6: 1500 };
export const SLOT_NAMES = { 1: 'Main Firearm', 2: 'Secondary', 3: 'Melee & Hand-Held', 4: 'Throwable', 5: 'Usable', 6: 'Wearable' };

const W = [];
const add = (o) => { W.push(o); return o; };

// ───────────── Slot 1: Main Firearm ─────────────
add({ id: 'assault_rifle', name: 'Assault Rifle', slot: 1, free: true, price: 0, speed: 1.00,
  kind: 'bullet', mode: 'auto', interval: 0.100, dmg: 20, head: 30, mag: 30, reserve: 150, reload: 1.8, range: 60, vel: 400,
  spread: 0.012, recoil: 0.012, ads: 1.35, desc: 'Reliable 600 RPM all-rounder.' });
add({ id: 'ak47', name: 'AK-47', slot: 1, free: true, price: 0, speed: 0.95,
  kind: 'bullet', mode: 'auto', interval: 0.125, dmg: 25, head: 38, mag: 30, reserve: 150, reload: 2.1, range: 55, vel: 400,
  spread: 0.016, recoil: 0.018, ads: 1.35, desc: 'Hard-hitting 480 RPM workhorse.' });
add({ id: 'dmr', name: 'Light Sniper (DMR)', slot: 1, free: true, price: 0, speed: 0.95,
  kind: 'bullet', mode: 'semi', interval: 0.250, dmg: 65, head: 165, mag: 3, reserve: 30, reload: 2.2, range: 75, vel: 600,
  spread: 0.002, recoil: 0.035, ads: 2.5, scope: true, emptyPing: true, desc: '3-round clip, one-shot headshots. Ping on empty.' });
add({ id: 'rocket_launcher', name: 'Rocket Launcher', slot: 1, free: true, price: 0, speed: 0.80,
  kind: 'projectile', proj: 'rocket', mode: 'semi', interval: 0.6, dmg: 145, head: 145, mag: 1, reserve: 3, reload: 2.4, range: 120, vel: 35,
  splash: { radius: 4.5, max: 115, min: 40 }, recoil: 0.05, ads: 1.4, desc: '35 m/s rocket, 4.5 m splash.' });
add({ id: 'burst_rifle', name: 'Battle Rifle', slot: 1, price: 900, speed: 1.00,
  kind: 'bullet', mode: 'burst', burst: 3, interval: 0.08, burstDelay: 0.25, dmg: 23, head: 35, mag: 24, reserve: 120, reload: 1.9, range: 65, vel: 420,
  spread: 0.008, recoil: 0.014, ads: 1.6, desc: '3-round bursts at 750 RPM.' });
add({ id: 'lmg', name: 'Machine Gun (LMG)', slot: 1, price: 1100, speed: 0.80,
  kind: 'bullet', mode: 'auto', interval: 0.092, dmg: 17, head: 26, mag: 100, reserve: 200, reload: 3.8, range: 50, vel: 400,
  spread: 0.02, recoil: 0.01, ads: 1.3, thinTracers: true, desc: '100-round belt of suppression.' });
add({ id: 'heavy_sniper', name: 'Heavy Sniper', slot: 1, price: 1400, speed: 0.88,
  kind: 'bullet', mode: 'semi', interval: 0.3, dmg: 138, head: 260, mag: 1, reserve: 12, reload: 2.0, range: 75, vel: 650,
  spread: 0.001, recoil: 0.07, ads: 6.0, scope: true, desc: 'Breech-loaded. Headshots go through full armor.' });
add({ id: 'flamethrower', name: 'Flamethrower', slot: 1, price: 1200, speed: 0.88,
  kind: 'flame', mode: 'auto', interval: 0.083, dmg: 14, head: 14, mag: 100, reserve: 200, reload: 2.6, range: 11,
  burn: { dps: 6, time: 3 }, cone: 0.22, ammoPerShot: 1, ads: 1.1, desc: '168 DPS cone + burn. Ignites smoke.' });
add({ id: 'grenade_launcher', name: 'Grenade Launcher', slot: 1, price: 1000, speed: 0.95,
  kind: 'projectile', proj: 'gl_shell', mode: 'semi', interval: 0.67, dmg: 95, head: 95, mag: 4, reserve: 8, reload: 2.6, range: 60, vel: 24,
  splash: { radius: 4.0, max: 80, min: 30 }, bounce: true, fuse: 2.2, recoil: 0.04, ads: 1.3, desc: 'Revolving drum of bouncing shells.' });
add({ id: 'mortar', name: 'Mortar Launcher', slot: 1, price: 1300, speed: 0.80,
  kind: 'mortar', proj: 'mortar_shell', mode: 'semi', interval: 0.8, dmg: 175, head: 175, mag: 1, reserve: 2, reload: 3.2, range: 70, minRange: 12,
  splash: { radius: 7.5, max: 130, min: 50 }, warn: 0.9, ads: 1.2, desc: 'High-arc shell, 0.9s red warning ring.' });

// ───────────── Slot 2: Secondary ─────────────
add({ id: 'pistol', name: 'Standard Pistol', slot: 2, free: true, price: 0, speed: 1.10,
  kind: 'bullet', mode: 'semi', interval: 0.150, dmg: 22, head: 38, mag: 15, reserve: 60, reload: 1.3, range: 35, vel: 280,
  spread: 0.01, recoil: 0.02, ads: 1.25, desc: 'Dependable sidearm.' });
add({ id: 'smg', name: 'Compact SMG', slot: 2, free: true, price: 0, speed: 1.05,
  kind: 'bullet', mode: 'auto', interval: 0.075, dmg: 15, head: 22, mag: 25, reserve: 125, reload: 1.5, range: 22, vel: 280,
  spread: 0.025, recoil: 0.01, ads: 1.2, desc: '800 RPM bullet hose.' });
add({ id: 'crossbow', name: 'Hand Crossbow', slot: 2, free: true, price: 0, speed: 1.05,
  kind: 'projectile', proj: 'bolt', mode: 'semi', interval: 0.3, dmg: 85, head: 175, mag: 1, reserve: 8, reload: 1.7, range: 50, vel: 90,
  bleed: { total: 30, time: 3 }, silent: true, ads: 1.5, desc: 'Silent bolt + bleed. One-shot headshots.' });
add({ id: 'burst_pistol', name: 'Burst Pistol', slot: 2, price: 600, speed: 1.05,
  kind: 'bullet', mode: 'burst', burst: 3, interval: 0.08, burstDelay: 0.22, dmg: 19, head: 32, mag: 18, reserve: 72, reload: 1.4, range: 30, vel: 280,
  spread: 0.012, recoil: 0.014, ads: 1.25, desc: '3-round burst sidearm.' });
add({ id: 'revolver', name: 'Revolver', slot: 2, price: 700, speed: 1.05,
  kind: 'bullet', mode: 'semi', interval: 0.400, dmg: 55, head: 110, mag: 6, reserve: 36, reload: 2.1, range: 45, vel: 320,
  spread: 0.004, recoil: 0.06, ads: 1.4, desc: 'Six heavy rounds.' });
add({ id: 'sawed_off', name: 'Sawed-Off Double-Barrel', slot: 2, price: 650, speed: 1.00,
  kind: 'pellet', mode: 'semi', interval: 0.200, pellets: 8, dmg: 12, head: 18, mag: 2, reserve: 24, reload: 1.8, range: 8, vel: 300,
  spread: 0.09, recoil: 0.08, ads: 1.1, desc: 'Point-blank double tap.' });
add({ id: 'tactical_shotgun', name: 'Tactical Shotgun', slot: 2, price: 750, speed: 1.00,
  kind: 'pellet', mode: 'semi', interval: 0.700, pellets: 8, dmg: 11, head: 16, mag: 5, reserve: 25, reload: 0.55, perShell: true, range: 14, vel: 300,
  spread: 0.06, recoil: 0.07, ads: 1.15, desc: 'Pump action, shell-by-shell reload.' });
add({ id: 'taser', name: 'Taser', slot: 2, price: 550, speed: 1.00,
  kind: 'taser', mode: 'semi', interval: 0.5, dmg: 15, head: 15, mag: 1, reserve: Infinity, reload: 4.0, recharge: true, range: 8,
  stun: { time: 1.3, slow: 0.65 }, ads: 1.1, desc: '8 m tether. Stuns, slows 65% and locks weapons.' });

// ───────────── Slot 3: Melee & Hand-Held ─────────────
add({ id: 'fists', name: 'Fists', slot: 3, free: true, price: 0, speed: 1.15,
  kind: 'melee', interval: 0.35, dmg: 28, head: 42, reach: 1.8, climb: true, desc: 'Fast jabs. Hold W on ladders/vines to climb.' });
add({ id: 'knife', name: 'Combat Knife', slot: 3, free: true, price: 0, speed: 1.10,
  kind: 'melee', interval: 0.50, dmg: 60, head: 110, backstab: 110, reach: 2.2, draw: 0.2, desc: 'Fast draw. 110 backstab.' });
add({ id: 'scythe', name: 'Scythe', slot: 3, free: true, price: 0, speed: 1.05,
  kind: 'melee', interval: 0.90, dmg: 85, head: 135, reach: 3.2, arc: 1.2,
  ability: { name: 'Reaper Rush', boost: 0.5, time: 2.0, cooldown: 30 }, desc: 'Right-click: +50% speed burst for 2s.' });
add({ id: 'bat', name: 'Baseball Bat', slot: 3, price: 500, speed: 0.95,
  kind: 'melee', interval: 0.80, dmg: 65, head: 150, reach: 2.6, knockback: 9, desc: 'Home-run headshots. Heavy knockback.' });
add({ id: 'karambit', name: 'Karambit', slot: 3, price: 600, speed: 1.10,
  kind: 'melee', interval: 0.30, dmg: 36, head: 58, reach: 2.0, desc: 'Rapid combo slashes.' });
add({ id: 'katana', name: 'Katana', slot: 3, price: 800, speed: 1.05,
  kind: 'melee', interval: 0.70, dmg: 80, head: 130, reach: 3.4, arc: 0.9, desc: 'Longest melee reach.' });
add({ id: 'sledgehammer', name: 'Sledgehammer', slot: 3, price: 750, speed: 0.88,
  kind: 'melee', interval: 1.35, dmg: 165, head: 165, reach: 2.7, breaker: true, knockback: 6, desc: 'One-shots 150 HP. Smashes barricades.' });
add({ id: 'shurikens', name: 'Shurikens', slot: 3, price: 650, speed: 1.10,
  kind: 'projectile', proj: 'shuriken', mode: 'semi', interval: 0.33, dmg: 38, head: 65, mag: 3, reserve: Infinity, regen: 1.8, vel: 55, range: 60,
  silent: true, desc: 'Holds 3 stars; +1 every 1.8s.' });
add({ id: 'slippers', name: 'Slippers', slot: 3, price: 450, speed: 1.10,
  kind: 'projectile', proj: 'slipper', mode: 'semi', interval: 0.4, dmg: 75, head: 150, mag: 1, reserve: Infinity, cooldown: 4.5, vel: 42, range: 60,
  arc: true, emotional: true, desc: 'One throw. EMOTIONAL DAMAGE.' });

// ───────────── Slot 4: Throwables ─────────────
add({ id: 'frag', name: 'Frag Grenade', slot: 4, free: true, price: 0, speed: 1.05,
  kind: 'throwable', proj: 'frag', carry: 2, fuse: 3.0, cookable: true, dmg: 135,
  splash: { radius: 5.0, max: 100, min: 35 }, knockback: 7, desc: 'Cookable 3s fuse.' });
add({ id: 'smoke_grenade', name: 'Smoke Grenade', slot: 4, free: true, price: 0, speed: 1.05,
  kind: 'throwable', proj: 'smoke', carry: 2, fuse: 1.5, dmg: 0, smoke: { radius: 8.5, time: 9.0 }, desc: '8.5 m cloud for 9s.' });
add({ id: 'molotov', name: 'Molotov', slot: 4, price: 500, speed: 1.05,
  kind: 'throwable', proj: 'molotov', carry: 1, impact: true, dmg: 0, fire: { dps: 32, radius: 4.5, time: 5.5 }, desc: 'Fire pool 32 DPS.' });
add({ id: 'flashbang', name: 'Flashbang', slot: 4, price: 450, speed: 1.05,
  kind: 'throwable', proj: 'flash', carry: 2, fuse: 1.5, dmg: 5, flash: { time: 1.8, radius: 10 }, desc: '1.8s whiteout in line of sight.' });
add({ id: 'sticky_bomb', name: 'Sticky Bomb', slot: 4, price: 600, speed: 1.05,
  kind: 'throwable', proj: 'sticky', carry: 1, fuse: 2.5, sticky: true, remote: true, dmg: 145,
  splash: { radius: 4.5, max: 110, min: 40 }, desc: 'Sticks. 2.5s or right-click detonate.' });

// ───────────── Slot 5: Usables ─────────────
add({ id: 'medkit', name: 'Med Kit', slot: 5, free: true, slotFree: true, price: 0, speed: 1.0,
  kind: 'usable', use: 2.5, cooldown: 30, heal: 100, interrupt: true, desc: '+100 HP (cap 150). Damage interrupts.' });
add({ id: 'ammo_pack', name: 'Extra Ammo Pack', slot: 5, free: true, slotFree: true, price: 0, speed: 1.0,
  kind: 'usable', use: 1.2, cooldown: 30, ammo: true, desc: 'Refill reserves, +1 shell, +1 throwable.' });
add({ id: 'armor_plate', name: 'Armor Plate', slot: 5, price: 700, speed: 1.0,
  kind: 'usable', use: 2.0, cooldown: 35, armor: 50, desc: '+50 Armor (200 effective HP).' });
add({ id: 'adrenaline', name: 'Adrenaline Shot', slot: 5, price: 650, speed: 1.0,
  kind: 'usable', use: 0.8, cooldown: 25, adrenaline: { speed: 0.2, reload: 0.25, regen: 10, time: 6 }, desc: '+20% speed, +25% reload, +10 HP/s for 6s.' });
add({ id: 'barricade', name: 'Deployable Barricade', slot: 5, price: 800, speed: 1.0,
  kind: 'usable', use: 0, cooldown: 30, barricade: { w: 2.2, h: 1.3, hp: 300 }, desc: '2.2 × 1.3 m metal shield, 300 HP.' });

// ───────────── Slot 6: Wearables ─────────────
add({ id: 'tactical_gloves', name: 'Tactical Gloves', slot: 6, free: true, slotFree: true, price: 0,
  kind: 'wearable', mods: { reload: 0.20, draw: 0.25, throw: 0.20 }, desc: '+20% reload, +25% draw, +20% throw distance.' });
add({ id: 'spring_boots', name: 'Spring Boots', slot: 6, price: 900,
  kind: 'wearable', mods: { doubleJump: 1, footstep: -0.5 }, desc: 'Mid-air double jump. -50% footstep volume.' });
add({ id: 'bandolier', name: 'Ammo Bandolier', slot: 6, price: 700,
  kind: 'wearable', mods: { reserve: 0.25, shells: 1, throwables: 1, swap: -0.10 }, desc: '+25% reserve, +1 shell, +1 throwable. -10% swap.' });
add({ id: 'blast_vest', name: 'Blast Vest', slot: 6, price: 800,
  kind: 'wearable', mods: { blast: 0.30, speed: -0.05 }, desc: '-30% explosive & fire damage. -5% speed.' });
add({ id: 'thermal_goggles', name: 'Thermal Goggles', slot: 6, price: 1100,
  kind: 'wearable', active: true, mods: { thermal: { battery: 8, recharge: 6 } }, desc: 'F/V: see enemies through smoke & shadow (not walls).' });

export const WEAPONS = W;
export const WEAPON_BY_ID = Object.fromEntries(W.map((w) => [w.id, w]));
export const bySlot = (slot) => W.filter((w) => w.slot === slot);
export const DEFAULT_LOADOUT = { 1: 'assault_rifle', 2: 'pistol', 3: 'fists', 4: 'frag', 5: 'medkit', 6: 'tactical_gloves' };
export const isExplosive = (w) => !!(w.splash || w.fire || w.kind === 'flame');

// Kill-milestone skins (per weapon)
export const SKIN_TIERS = [
  { id: 'gold', name: 'Gold', kills: 50 },
  { id: 'neon', name: 'Neon', kills: 200 },
  { id: 'obsidian', name: 'Obsidian', kills: 500 },
];

// Holiday reskins: month (0-based) → weapon id + label
export const HOLIDAY_SKINS = [
  { id: 'pumpkin', month: 9, weapon: 'rocket_launcher', name: 'Pumpkin Launcher' },
  { id: 'turkey', month: 10, weapon: 'assault_rifle', name: 'Turkey Shooter' },
  { id: 'ornament', month: 11, weapon: 'grenade_launcher', name: 'Ornament Shooter' },
  { id: 'candycane', month: 11, weapon: 'katana', name: 'Candy Cane Katana' },
];

// Spec tally: 39 items + 3 freebies bundled with slot 5/6 access (Med Kit, Ammo Pack, Tactical Gloves) = 42 entries.
if (W.length !== 42) console.warn('weapon table expected 42 entries, has', W.length);
