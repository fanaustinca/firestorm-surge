# 🔥 Firestorm Surge

A fast 3D browser multiplayer FPS built with **Three.js** (v2.4.0): 51 procedurally modelled weapons and gear items plus 15 ULTRA variants, 8 multi-level maps, 4 modes plus a Practice Range, zero-server P2P multiplayer (Trystero/WebRTC), and tactical bots that fill empty slots. No external art assets: every mesh, texture and sound is generated in code.

**Play:** https://fanaustinca.github.io/firestorm-surge/

## Features
- **Matchmaking:** you pick only a game mode. You join a room (P2P lobby, or an offline room filled with bots), and everyone votes on one of 4 candidate maps (with rendered previews) for 15 s. The host fills empty slots with bots, which vote too, then starts the winning map. After a match, **Back to room** starts a fresh vote.
- **Multiplayer robustness:** only peers actually playing the same match own bots and send match state. When a peer leaves or idles on a menu, its bots are handed over at once, so no team ends up empty, and a watchdog respawns anyone left dead.
- **Practice Range:** pick any map. Steel targets (some sliding) are spread over every level. No bots, no timer, no coins.
- **8 maps (60 × 60 m):** Cargo Yard, Desert Outpost, Abandoned City, Underground Lab, Frostbite Station, Jungle Temple, Neon Market and Refinery. Each has a large open centre surrounded or crossed by 3-story structures: floors at 0/3/6 m, walkable roofs at 9 m, interior switchback stairs, sky bridges, scaffolds, ladders, vines and rungs. Buildings have projecting bays, corner pilasters, cornices, window sills, rooftop stair huts, crenellated forts and door awnings.
- **Underground tunnels** (Cargo Yard, Desert Outpost, Abandoned City, Frostbite): a stairwell near each team's side drops 3 m into a tight 3 m corridor that runs under the field to a pillared central chamber. The two corridors meet offset, making a close-quarters crossfire where rockets, grenades and barricades shine. Ceilings stop mortars.
- **Underground Lab:** a central two-level control island in the atrium, bridged to both mezzanines and to the high bridge.
- **Terrain:** outdoor maps have rolling heightfield terrain with full collision (it flattens around every building, prop and spawn) and are ringed by mountains. Frostbite Station adds snow everywhere: a white ground, snow caps on every roof, container and crate, snowy pines, white-capped peaks and falling snow. Every structure varies: balconies, rooftop units and water tanks, different window styles, ruined facades and tints. Seeded cover props (market stalls, carts, cars, a bus, tents, logs, snowbanks, pipe stacks) fill the open centres.
- **Climbing:** anyone can climb ladders, vines and rungs. With **Fists** you can scale any wall.
- **ULTRA variants:** every main firearm has a visibly upgraded ULTRA model: a single barrel fed by a 6-rocket revolving cylinder that turns one chamber per shot, a quad-tube mortar battery, a twin-nozzle 24 m flamethrower with a huge tank, a 6-barrel rotary minigun, a piercing railgun, drum-fed rifles and more. You earn it in 1v1 after the first minute of a round (rounds are now 2 min), or in other modes by surviving 30 s. It lasts until you die. Preview it from the Loadout. All Ultras use standard gun finishes (steel and brass trim, no neon).
- **New guns (v2.2):** **Volt Rail** (coil railgun whose slugs pierce every enemy in line), **Arc Caster** (lightning rifle whose bolts chain to 2 nearby enemies), the **Pocket Rocket** sidearm (mini-rockets, good for rocket jumps). Both new primaries have Ultras: a tri-coil rail and a 4-fork tesla caster.
- **New in v2.4:** **Ricochet Disc Launcher** (saw discs that bounce off walls 3 times and slice through everyone in their path), **Cryo Sprayer** (freezing spray: slows 50%, freezes solid after 1.4 s), **Harpoon Gun** (spears an enemy and reels them in), each with an ULTRA. Two new usables: **Shockwave Grenade** (carry 5, no damage, throws everyone flying, you included) and **Mini Black Hole** (a 15 s singularity that drags enemies within 10 m into its core).
- **Mortar:** a 3-shell tube with a 0.5 s refire, 2.3 s reload, 12.5 m blast and a much faster arc (shells land in about 1–3 s). An orange landing reticle, shown only to the shooter, marks where the shell will land; enemies still get no warning. The Ultra battery fires 6 shells, each bursting into 3 bomblets.
- **Explosives:** rocket (7.5 m) and grenade launcher (6.5 m) have greatly increased damage and radius. A new **Land Mine** arms after 1 s and explodes when an enemy steps on it. Molotov fire shows flames only.
- **Bot tiers:** every bot is **Casual** (slow, sloppy, never switches weapons, throws or jumps, and stands still to shoot), **Normal** (inaccurate, stands still to snipe, otherwise walks and hops while shooting, no zig-zag dodging) or **Veteran** (zig-zags and jumps while firing, swaps weapons, moves while scoped). About half of matches get exactly one Veteran. Tiers come from the match id, so every peer agrees, and nameplates show CASUAL or ★ VETERAN. Aim error drifts instead of snapping, and bots track where you just were, not where you are. Bots walk to a vantage point (upper floors, roofs, bridges, tunnels), then hold it and watch an angle; they only roam spots that are actually reachable.
- **Bots:** they can be beaten by design. They have a ~100° view cone, can't see through walls or smoke, go blind when flashbanged, react slowly and aim sloppily at first, swap between primary, secondary, melee, throwables and usables, and navigate all levels (stairs, ladders, drops) on a layered nav grid. Their rigs hold guns level and face where they aim.
- **Feedback:** every bullet draws a cheap line tracer. Right-click aims down the sights of every gun, but only snipers zoom. Non-sniper guns show a red-dot reticle. The aim line is computed from each gun's geometry, so carry handles, drums and housings never cover the aim point, and scopes switch early to a large see-through scope view. An ELIMINATED banner shows a coin bounty per kill: +10, plus headshot, melee or explosive bonuses, and +10 for mine, grenade or Molotov kills. Callsigns and health bars appear over players and bots (enemies only while in sight), and the screen edges pulse red at low health.
- **Progression:** coins per match plus kill bounties, kill-milestone skins (Gold, Neon, Obsidian), a **skin shop** (7 patterns, bought once, usable on any weapon), daily quests, holiday reskins, and a **permanent rank** saved locally that gains points on every win (1v1 +60, 2v2 +70, FFA +90, TDM +50): Recruit → Bronze → Silver → Gold → Platinum → Diamond → Master → Firestorm Legend.
- **Audio:** procedural SFX and a procedural synthwave loop in the menu, shop and room.
- **CrazyGames SDK v3:** rewarded-ad 1-match trials plus gameplay start/stop calls. Outside CrazyGames the ad is a mocked modal.

## Controls
`WASD` move · `Space` jump/double-jump · mouse look · `LMB` fire/swing/throw · `RMB` ADS / ability / sticky detonate · `R` reload · `1–5` slots · `F`/`V` thermal · `Tab` scoreboard · `B`/`M` loadout & shop

## Developer console (`F12`)
```js
DEV.help()
DEV.giveCoins(5000); DEV.unlockAll()
DEV.equip(1, 'mortar'); DEV.equip(3, 'slippers')
DEV.setHealth(150, 50)
DEV.loadMap('neon_market', 'ffa')           // DEV.maps() lists all 8; mode 'practice' = Practice Range
DEV.spawnBot('blue', 'katana'); DEV.clearBots()
DEV.noclip(); DEV.godMode()
DEV.inspectGun('rocket_launcher_ultra')       // studio turntable; drag to orbit, Esc to exit
DEV.ultra()                                   // grant the ULTRA variant of your primary now
```

## Development
```bash
npm install
npm run dev            # http://localhost:5190
npm test               # build + full headless suite (screenshots in test-results/)
GL=vulkan npm test     # GPU-accelerated local run
npm run test:mp        # two headless browsers share a room, vote, start the same map, sync and land a remote hit
npm run test:flow      # plays full TDM/FFA/2v2/1v1 matches to the results screen
```
The suite (68 checks) runs `vite preview`, launches headless Chrome (ANGLE/SwiftShader WebGL by default) and fails on any `pageerror` or `console.error`. It covers:
- **Movement and core combat:** run speeds, jump and double-jump heights, ladder and Fists-only wall climbing, Assault Rifle damage, Slippers, smoke and Thermal.
- **New systems:** every map's levels, open-centre ratio, climb links and spawns; bots reaching upper floors; mines and kill bounties; ULTRA unlock and loss rules; buffed explosives; the mortar no-ring change.
- **Bots:** view cone, flash and smoke blindness, rig gun orientation and weapon swapping.
- **UI and feedback:** tracers on every pellet, ADS zoom rules, nameplates, the low-HP tint, Practice Range, the room vote, rank, skin shop and Ultra preview.

It also captures screenshots for visual review.

CI (`.github/workflows/deploy.yml`) builds, runs the quick suite, then deploys `dist/` to GitHub Pages.

## Layout
```
src/data/weapons.js        all item stats
src/render/                procedural textures, gun/gear meshes, soldiers, icons
src/world/                 collision world + 8 map builders + layered nav grid
src/game/                  game loop, actors, combat, bots, effects, viewmodel, match modes
src/net/                   Trystero P2P layer + mode room / map vote (lobby.js)
src/ui/, src/meta/         HUD, menus/shop, profile/progression, ads
tests/                     headless E2E, multiplayer, match-flow, gallery
```
