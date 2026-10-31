# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/codex-app-dev/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/codex-app-dev/PlayGround)

- 🎮 [Open the project](https://omgithub.com/codex-app-dev/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=codex-app-dev%2FPlayGround).
- 💻 [Explore the source](https://github.com/codex-app-dev/PlayGround).
- 🛠️ [Check build runs](https://github.com/codex-app-dev/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/codex-app-dev/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/codex-app-dev).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

## LAST CIRCLE

A browser-native 3D battle royale built with Three.js and Vite. Drop onto a **4.2 km² island**, loot five weapons, harvest timber, raise cover, and outlast 29 AI hostiles as the blue zone closes.

### Play

```bash
npm install
npm run dev      # http://localhost:3002
npm run build    # production bundle in dist/
npm test         # gameplay + math invariants
```

Open the page, click **Start Game**, then click the world once to capture the mouse. On phones, rotate to landscape; touch sticks and action buttons appear automatically.

### Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move / sprint | `WASD` / `Shift` | left stick / push to edge |
| Look / aim / fire | mouse / `RMB` / `LMB` | right side / `ADS` / `FIRE` |
| Jump / crouch | `Space` / `Ctrl` | `JUMP` / `CROUCH` |
| Reload / interact / heal | `R` / `E` / `H` | `RELOAD` / `USE` / `HEAL` |
| Harvest wood | `F` (hold) | `USE` near a tree |
| Build mode | `Q`, then `1`-`3` pieces, `R` rotate | `BUILD` cycles wall → floor → ramp → exit |
| Place piece | `LMB` | `FIRE` |
| Pause / resume | `Esc` | pause button |

### Features

- 30-player solo match with 29 named bots, simulated rotations, bot-vs-bot fights, killfeed, and loot drops.
- Shrinking six-phase blue zone with damage-over-time and a live minimap/compass.
- Five weapons with recoil, spread, falloff, headshots, ADS, reloads, armor, and medkits.
- Harvestable trees and a snapped wall/floor/ramp builder with destructible cover and walkable ramps.
- Procedural 760×760 island with seven named sites, roads, runway, lakes, buildings, and instanced vegetation.
- Responsive tactical HUD, pointer-lock desktop controls, and touch layout with safe-area support.
- Procedural audio, tracers, impacts, hitmarkers, damage direction, end-of-match stats, and in-place redeploy.

All art, audio, and fonts are generated or self-hosted; no external runtime assets are required.

