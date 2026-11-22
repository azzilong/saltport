# Saltport

[![Saltport on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Saltport rank](https://make.fun/badge/gta6-01/azzilong/saltport/rank.svg)](https://make.fun/bounty/gta6-01)
[![Saltport reward](https://make.fun/badge/gta6-01/azzilong/saltport/reward.svg)](https://make.fun/bounty/gta6-01)

**Saltport** is a 3D low-poly open-world crime game built for
[make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).
Play it offline in a desktop browser — no network, no build step.

## The story

Kade Rowan, an ex-dockhand, comes home to find the Rusthooks gang
running the docks of Saltport — his harbour city of six districts:
Harborlight, Old Cannery, Saltmarket, Gulltown, The Terraces, and
Breakwater. With the Saltport PD (SPD) watching every move, Kade takes
on the Rusthooks across 3 missions to take back the docks, one street
at a time.

## What is in the game

- A full 3D open world: 6 districts with standing 0–100, drivable
  streets, pedestrians, and a beach + sea along the south edge.
- Realistic-proportion characters and vehicles: sedan, van, scooter,
  police car, and a helicopter, seen from an over-the-shoulder camera.
- 3 staged missions with timers — each with a stage number, objective,
  and a NEXT step to follow.
- A 3-star wanted system with named SPD dispatch units: SPD-7 'Harbor'
  (pursuit), SPD-12 'Gull' (foot patrol), and SPD-AIR 'Kestrel' (air
  support), plus a live dispatch log.
- Combat with 3 weapon slots (Fists, Pistol, SMG), health, and armour.
- A full HUD with a minimap, district standing bar, money, and an
  in-game clock — plus an in-game phone with a labelled city map,
  3 save slots, and a day/night cycle.

## Play

```sh
# serve the game folder, then open http://localhost:8080
python3 -m http.server 8080 --directory game
# or just open game/index.html in a desktop browser
```

- WASD / arrow keys — move (the hero turns to face where he walks)
- 1 / 2 / 3 — switch weapon (Fists / Pistol / SMG)
- TAB / P — open the phone (city map)
- Q — save menu (3 slots)
- ESC — close overlays

Saltport is original work built for the make.fun "Make GTA 6" bounty:
new city, new characters, new story — nothing copied from another game.
