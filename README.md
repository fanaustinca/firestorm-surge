# 🔥 Firestorm Surge

A fast 3D browser multiplayer FPS built with **Three.js**: 42 procedurally modelled weapons and gear items, 4 maps, 4 modes, zero-server P2P multiplayer (Trystero/WebRTC), and tactical bots that fill empty slots. No external art assets: every mesh, texture and sound is generated in code.

**Play:** https://fanaustinca.github.io/firestorm-surge/

## Features
- **6-slot loadout**: 10 main firearms, 8 secondaries, 9 melee/hand-held, 5 throwables, 5 usables, 5 wearables. The spec counts 39 items plus 3 freebies that come with slot 5/6 access, for 42 in total. Stats live in `src/data/weapons.js`.
- **Movement:** 7 m/s base speed. Only the weapon in your hands sets your speed (0.80×–1.15×), and passive modifiers clamp to 0.75–1.35× (the Scythe burst can reach 1.55×). Jumps peak at exactly 1.25 m. Spring Boots add a double jump (about 2.5 m chained), and Fists climb ladders, vines, nets and cables at 5.5 m/s.
- **Combat:** bullets are stepped raycasts (280–650 m/s, no tunnelling) drawn through one instanced tracer pool with remote-tracer culling. Also included: projectile rockets, bouncing grenade shells, mortars with a 0.9 s red warning ring (blocked by the Lab ceiling), a flamethrower that ignites smoke clouds, taser stuns, bleed and burn damage, deployable barricades, a cookable frag, a remote-detonated sticky bomb, flashbang whiteout, and smoke that Thermal Goggles see through.
- **Slippers** deal **EMOTIONAL DAMAGE**: a 3D popup, a HUD popup and a 0.8 s screen wobble.
- **Maps** (75 × 75 m): Cargo Yard, Desert Outpost, Abandoned City (vine-climb sniper windows), and Underground Lab (low ceiling).
- **Modes:** Red vs. Blue (5v5 TDM), Free-For-All (8), 2v2 Wingman (Bo7), 1v1 Duel (Bo5).
- **Multiplayer:** automatic matchmaking into `firestorm-${mode}-lobby-${n}`, 20 Hz state sync with lerp smoothing, and bots backfilled and split across peers by `botIndex % humans.length`.
- **Progression:** 100–150 coins per match, weapon skins at 50/200/500 kills (Gold, Neon, Obsidian), 3 daily quests, a monthly rank badge, and holiday reskins (Pumpkin Launcher, Turkey Shooter, Ornament Shooter, Candy Cane Katana).
- **CrazyGames SDK v3:** rewarded-ad 1-match trials plus gameplay start/stop calls. Outside CrazyGames the ad is a mocked modal.

## Controls
`WASD` move · `Space` jump/double-jump · mouse look · `LMB` fire/swing/throw · `RMB` ADS / ability / sticky detonate · `R` reload · `1–5` slots · `F`/`V` thermal · `Tab` scoreboard · `B`/`M` loadout & shop

## Developer console (`F12`)
```js
DEV.help()
DEV.giveCoins(5000); DEV.unlockAll()
DEV.equip(1, 'mortar'); DEV.equip(3, 'slippers')
DEV.setHealth(150, 50)
DEV.loadMap('abandoned_city', 'ffa')        // cargo_yard | desert_outpost | abandoned_city | underground_lab
DEV.spawnBot('blue', 'katana'); DEV.clearBots()
DEV.noclip(); DEV.godMode()
DEV.inspectGun('heavy_sniper')                // studio turntable; drag to orbit, Esc to exit
```

## Development
```bash
npm install
npm run dev            # http://localhost:5190
npm test               # build + full headless suite (screenshots in test-results/)
GL=vulkan npm test     # GPU-accelerated local run
npm run test:mp        # two headless browsers join a P2P lobby, sync and land a remote hit
npm run test:flow      # plays full TDM/FFA/2v2/1v1 matches to the results screen
```
The suite runs `vite preview`, launches headless Chrome (ANGLE/SwiftShader WebGL by default) and fails on any `pageerror` or `console.error`. It checks run speed (Fists 8.05 m/s, Mortar 5.60 m/s), jump height, the Spring Boots double jump, ladder climbing, Assault Rifle damage (20 body, 30 head), the Slippers EMOTIONAL DAMAGE popup, smoke blocking line of sight, and Thermal highlighting through smoke. It also captures gun-showcase, map and viewmodel screenshots.

CI (`.github/workflows/deploy.yml`) builds, runs the quick suite, then deploys `dist/` to GitHub Pages.

## Layout
```
src/data/weapons.js        all item stats
src/render/                procedural textures, gun/gear meshes, soldiers, icons
src/world/                 collision world + 4 map builders + nav grid
src/game/                  game loop, actors, combat, bots, effects, viewmodel, match modes
src/net/net.js             Trystero P2P layer
src/ui/, src/meta/         HUD, menus/shop, profile/progression, ads
tests/                     headless E2E, multiplayer, match-flow, gallery
```
