# CANNONBALL — Fury of the Wasteland

A mobile-first, Mad Max–flavoured road-war artillery game. You are **Cannonball**, the iron-skinned gunner riding the
**Iron Mammoth** — a war rig hauling the last tank of clean water across the wastes to the free town of Haven.

**Play:** https://spencer0.github.io/Cannonballs/

## Features

- **Drag-back slingshot aiming** (or "point" aiming in settings) with a live trajectory guide — built for thumbs.
- **12 stages across 3 regions** — The Dust Flats, Bone Canyon, The Burning Citadel — each ending in a warlord boss
  fight with destructible weak points (Rustjaw's Behemoth, The Vulture Queen, The Gasoline Goliath).
- **Human Cannonball** special: wreck raiders to fill the skull meter, then fire *yourself* through everything.
- **9 enemy types**: rust buggies, war bikers, mortar wagons, gyro raiders, juggernauts, rear rats, sniper roosts,
  spike walls and explosive guzzoline drums. Enemy shells can be shot out of the sky.
- **Garage**: 7 upgrade tracks plus Scatter Shot, Napalm Pot and Thunder Keg special ammo, bought with salvaged scrap.
- **Endless Fury** survival mode with rotating warlords, unlocked after the first boss.
- Supply crates, multi-kill combos, star ratings, story intro and ending.
- Fully procedural art (Canvas 2D) and synthesized sound effects + war-drum soundtrack (Web Audio). No asset files.
- Installable PWA with offline support; progress saved in `localStorage`.

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Aim & fire | Drag back anywhere, release | Click-drag, release |
| Human Cannonball | Tap the skull | Space |
| Switch ammo | Ammo buttons | 1–4 |
| Pause | ❚❚ | P / Esc |

## Development

No build step — it's plain ES modules.

```sh
npm start   # serves the folder on http://localhost:8080
```

Code layout: `src/battle.js` (simulation), `src/draw.js` (all artwork), `src/fx.js` (particles), `src/audio.js`
(synth SFX + music), `src/ui.js` (menus & HUD), `src/data.js` (stages, enemies, upgrades), `src/main.js` (loop & flow).

## Deployment

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
