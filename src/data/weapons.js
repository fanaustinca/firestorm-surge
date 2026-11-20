// Firestorm Surge — complete 6-slot item table.
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
  kind: 'projectile', proj: 'rocket', mode: 'semi', interval: 0.6, dmg: 230, head: 230, mag: 1, reserve: 4, reload: 2.4, range: 120, vel: 35,
  splash: { radius: 7.5, max: 175, min: 60 }, knockback: 12, recoil: 0.05, ads: 1.4, desc: '35 m/s rocket, massive 7.5 m blast.' });
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
  kind: 'projectile', proj: 'gl_shell', mode: 'semi', interval: 0.67, dmg: 150, head: 150, mag: 4, reserve: 8, reload: 2.6, range: 60, vel: 24,
  splash: { radius: 6.5, max: 135, min: 50 }, knockback: 9, bounce: true, fuse: 2.2, recoil: 0.04, ads: 1.3, desc: 'Revolving drum of bouncing shells.' });
add({ id: 'mortar', name: 'Mortar Launcher', slot: 1, price: 1300, speed: 0.80,
  kind: 'mortar', proj: 'mortar_shell', mode: 'semi', interval: 0.5, dmg: 340, head: 340, mag: 3, reserve: 12, reload: 2.3, range: 85, minRange: 5,
  splash: { radius: 12.5, max: 250, min: 120 }, knockback: 16, ads: 1.2, desc: '3-shell tube, fast arc, 12.5 m devastation. Landing marker only you can see.' });

add({ id: 'volt_rail', name: 'Volt Rail', slot: 1, price: 1500, speed: 0.92,
  kind: 'bullet', mode: 'semi', interval: 0.95, dmg: 90, head: 150, mag: 5, reserve: 25, reload: 2.4, range: 100, vel: 1400,
  spread: 0.002, recoil: 0.06, pierce: true, ads: 1.0, desc: 'Coil railgun. Each slug pierces every enemy in line.' });
add({ id: 'arc_caster', name: 'Arc Caster', slot: 1, price: 1250, speed: 0.98,
  kind: 'bullet', mode: 'auto', interval: 0.1, dmg: 17, head: 22, mag: 40, reserve: 160, reload: 2.2, range: 28, vel: 500,
  spread: 0.02, recoil: 0.012, chain: { n: 2, r: 7, f: 0.55 }, ads: 1.0, desc: 'Lightning bolts arc from the target to 2 enemies nearby.' });
add({ id: 'ricochet_disc', name: 'Ricochet Disc Launcher', slot: 1, price: 1200, speed: 0.95,
  kind: 'projectile', proj: 'disc', mode: 'semi', interval: 0.42, dmg: 58, head: 85, mag: 6, reserve: 30, reload: 2.2, range: 60, vel: 34,
  ricochet: 3, fuse: 3.2, recoil: 0.03, ads: 1.1, desc: 'Spinning saw discs bounce off walls 3 times and slice through everyone in their path.' });
add({ id: 'cryo_sprayer', name: 'Cryo Sprayer', slot: 1, price: 1150, speed: 0.92,
  kind: 'flame', mode: 'auto', interval: 0.083, dmg: 8, head: 8, mag: 120, reserve: 240, reload: 2.4, range: 12,
  cryo: { slow: 0.5, time: 1.6, freeze: 1.4, freezeTime: 1.0 }, cone: 0.2, ammoPerShot: 1, ads: 1.1, desc: 'Freezing spray: slows enemies 50%, keep it on them for 1.4 s to freeze them solid.' });
add({ id: 'harpoon_gun', name: 'Harpoon Gun', slot: 1, price: 1100, speed: 0.95,
  kind: 'projectile', proj: 'harpoon', mode: 'semi', interval: 1.0, dmg: 70, head: 110, mag: 1, reserve: 10, reload: 1.5, range: 45, vel: 62,
  pull: 1, recoil: 0.05, ads: 1.2, desc: 'Spears an enemy and reels them right up to you. Pairs well with melee.' });

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
add({ id: 'pocket_rocket', name: 'Pocket Rocket', slot: 2, price: 800, speed: 1.0,
  kind: 'projectile', proj: 'rocket', projScale: 0.5, mode: 'semi', interval: 0.55, dmg: 70, head: 70, mag: 3, reserve: 15, reload: 1.8, range: 60, vel: 55,
  splash: { radius: 3.2, max: 55, min: 20 }, knockback: 9, recoil: 0.05, ads: 1.0, desc: 'Mini-rocket pistol. Shoot your feet to rocket-jump.' });
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
add({ id: 'grapple_hook', name: 'Grapple Hook', slot: 3, price: 900, speed: 1.08,
  kind: 'melee', interval: 0.55, dmg: 50, head: 80, reach: 2.4, arc: 0.7,
  grapple: { range: 42, speed: 25, accel: 95, time: 1.9, cooldown: 1.4, hitDmg: 25 },
  desc: 'LMB: claw strike. RMB: fire the hook and zip to any wall, roof or enemy (42 m).' });

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
add({ id: 'land_mine', name: 'Land Mine', slot: 4, price: 650, speed: 1.05,
  kind: 'throwable', proj: 'mine', carry: 2, mine: { arm: 1.0, trigger: 1.3, life: 120 }, dmg: 190,
  splash: { radius: 5.0, max: 150, min: 45 }, knockback: 10, desc: 'Toss it down. Arms in 1s, explodes when an enemy steps on it.' });

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
add({ id: 'shockwave_grenade', name: 'Shockwave Grenade', slot: 5, price: 600, speed: 1.05,
  kind: 'throwable', proj: 'concussion', carry: 5, fuse: 1.4, dmg: 0, noDamage: true,
  splash: { radius: 7, max: 0, min: 0 }, knockback: 19, desc: 'Carry 5. No damage — a huge blast that throws everyone (you too) flying.' });
add({ id: 'black_hole', name: 'Mini Black Hole', slot: 5, price: 1000, speed: 1.05,
  kind: 'throwable', proj: 'singularity', carry: 1, fuse: 1.0, dmg: 0,
  vortex: { radius: 10, time: 15, pull: 8 }, desc: 'Opens a singularity for 15 s that drags every enemy within 10 m into its core.' });
add({ id: 'sentry_turret', name: 'Sentry Turret', slot: 5, price: 1100, speed: 1.0,
  kind: 'usable', use: 0.6, cooldown: 45, dmg: 8, head: 12, vel: 450, range: 32,
  sentry: { hp: 220, time: 30, range: 30, interval: 0.14, dmg: 8, spread: 0.02, turn: 4.5 },
  desc: 'Deploys an auto-turret for 30 s (220 HP). Shoots the nearest enemy it can see within 30 m.' });

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

// ───────────── ULTRA variants (slot 1) ─────────────
// Granted mid-match: 1v1 after the first minute of a round, other modes after surviving 30 s.
// They last until you die. Not purchasable — previewable from the Loadout.
const U = (base, o) => { const b = W.find((w) => w.id === base); return { ...b, ...o, id: base + '_ultra', base, ultra: true, price: 0, free: false, name: 'ULTRA ' + b.name.replace(/ \(.*\)/, '') }; };
export const ULTRAS = [
  U('assault_rifle', { interval: 0.075, dmg: 27, head: 42, mag: 60, reserve: 240, spread: 0.008, recoil: 0.008, desc: 'Twin-rail plasma rifle. 60-round drum, 800 RPM.' }),
  U('ak47', { interval: 0.1, dmg: 34, head: 52, mag: 75, reserve: 225, spread: 0.012, recoil: 0.014, desc: 'Gilded drum-fed AK with bayonet. 75 rounds.' }),
  U('dmr', { interval: 0.18, dmg: 90, head: 200, mag: 10, reserve: 50, reload: 2.0, desc: 'Coil-charged marksman rifle. 10-round mag.' }),
  U('rocket_launcher', { interval: 0.45, dmg: 260, head: 260, mag: 6, reserve: 12, reload: 3.4, splash: { radius: 8.5, max: 195, min: 70 }, desc: 'Single barrel fed by a 6-rocket revolving cylinder that turns after every shot.' }),
  U('burst_rifle', { burst: 5, interval: 0.06, burstDelay: 0.22, dmg: 29, head: 44, mag: 50, reserve: 200, desc: '5-round hyper-burst battle rifle.' }),
  U('lmg', { interval: 0.04, dmg: 24, head: 36, mag: 300, reserve: 600, reload: 4.0, speed: 0.8, spread: 0.016, recoil: 0.004, range: 70, desc: 'Six rotating barrels. 1500 RPM, 300-round belt. An absolute killer.' }),
  U('heavy_sniper', { interval: 0.5, dmg: 210, head: 400, mag: 4, reserve: 16, vel: 1400, range: 120, pierce: true, desc: 'Railgun. Slugs pierce through every enemy in line.' }),
  U('flamethrower', { dmg: 20, head: 20, mag: 300, reserve: 300, range: 24, cone: 0.26, twin: true, burn: { dps: 10, time: 4 }, desc: 'Twin nozzles, enormous fuel tank, 24 m inferno.' }),
  U('grenade_launcher', { interval: 0.35, dmg: 170, head: 170, mag: 12, reserve: 24, splash: { radius: 7.5, max: 155, min: 55 }, desc: '12-shell rotary drum.' }),
  U('volt_rail', { interval: 0.55, dmg: 125, head: 210, mag: 8, reserve: 32, reload: 2.0, desc: 'Tri-coil railgun. 8 piercing slugs, rapid recharge.' }),
  U('arc_caster', { interval: 0.08, dmg: 21, head: 28, mag: 80, reserve: 240, range: 34, chain: { n: 4, r: 10, f: 0.65 }, desc: 'Tesla tower. Every bolt forks to 4 more enemies.' }),
  U('ricochet_disc', { interval: 0.3, dmg: 72, head: 105, mag: 12, reserve: 48, ricochet: 5, twinDisc: true, desc: 'Twin-blade launcher. Fires 2 discs at once that bounce 5 times.' }),
  U('cryo_sprayer', { dmg: 11, head: 11, mag: 300, reserve: 300, range: 18, cone: 0.24, twin: true, cryo: { slow: 0.6, time: 2.2, freeze: 0.9, freezeTime: 1.4 }, desc: 'Twin cryo nozzles. 18 m blizzard that freezes in under a second.' }),
  U('harpoon_gun', { interval: 0.5, dmg: 95, head: 150, mag: 3, reserve: 15, reload: 1.8, vel: 80, desc: 'Triple-shot harpoon cannon. Reel in a whole squad.' }),
  U('mortar', { interval: 0.3, dmg: 420, head: 420, mag: 6, reserve: 24, reload: 2.2, splash: { radius: 15, max: 300, min: 150 }, cluster: 3, desc: 'Six-shell battery. Every shell bursts into 3 bomblets.' }),
];
export const ULTRA_OF = Object.fromEntries(ULTRAS.map((u) => [u.base, u.id]));
export const baseId = (id) => (id && id.endsWith('_ultra') ? id.slice(0, -6) : id);
export const WEAPON_BY_ID = Object.fromEntries([...W, ...ULTRAS].map((w) => [w.id, w]));
export const bySlot = (slot) => W.filter((w) => w.slot === slot);
export const DEFAULT_LOADOUT = { 1: 'assault_rifle', 2: 'pistol', 3: 'fists', 4: 'frag', 5: 'medkit', 6: 'tactical_gloves' };
export const isExplosive = (w) => !!(w.splash || w.fire || w.kind === 'flame');

// Kill-milestone skins (per weapon)
export const SKIN_TIERS = [
  { id: 'gold', name: 'Gold', kills: 50 },
  { id: 'neon', name: 'Neon', kills: 200 },
  { id: 'obsidian', name: 'Obsidian', kills: 500 },
];

// Shop skins: bought once with coins, usable on any slot 1–4 item.
export const SHOP_SKINS = [
  { id: 'woodland', name: 'Woodland Camo', price: 400 },
  { id: 'arctic', name: 'Arctic Camo', price: 450 },
  { id: 'crimson', name: 'Crimson Tiger', price: 600 },
  { id: 'carbon', name: 'Carbon Fiber', price: 700 },
  { id: 'toxic', name: 'Toxic Glow', price: 850 },
  { id: 'galaxy', name: 'Galaxy', price: 1200 },
  { id: 'dragon', name: 'Dragon Scale', price: 1500 },
];

// Holiday reskins: month (0-based) → weapon id + label
export const HOLIDAY_SKINS = [
  { id: 'pumpkin', month: 9, weapon: 'rocket_launcher', name: 'Pumpkin Launcher' },
  { id: 'turkey', month: 10, weapon: 'assault_rifle', name: 'Turkey Shooter' },
  { id: 'ornament', month: 11, weapon: 'grenade_launcher', name: 'Ornament Shooter' },
  { id: 'candycane', month: 11, weapon: 'katana', name: 'Candy Cane Katana' },
];


