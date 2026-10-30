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

---

# Canyon Overdrive

A phone-first neon canyon flight shooter built with Three.js. Fly a fighter through a sunset canyon, auto-cannon incoming raiders, spend missiles on armored targets, barrel-roll through plasma, and break **The Anvil** blockade.

This is an original fan-made tribute inspired by the arcade canyon shooter genre. All code, models, effects, and audio are generated procedurally in this project.

## Play

```bash
./start.sh
```

The static site is served at **http://localhost:3002**. There is no build step — `index.html` uses ES modules and a local import map, so it also works from any static file server.

## Controls

| Action | Phone / tablet | Desktop |
| --- | --- | --- |
| Steer | Drag inside the left joystick zone | `WASD` / arrow keys |
| Optional tilt steer | Tap **Accelerometer Tilt**, hold the device level, use **Recenter** | — |
| Afterburner | Hold **Boost** | Hold `Shift` |
| Barrel roll | **Roll** | `X` or `.` |
| Missiles | **Missile** | `Z` or `/` |
| Pause | Top-right pause button | `Esc` / `P` |
| Mute | Sound toggle | `M` |

Cannons fire automatically and lead the nearest target inside the reticle. A pink reticle means a lock; a red screen flash means hull damage.

### iOS motion permission

Tilt steering is optional. On iOS 13+ the game calls `DeviceOrientationEvent.requestPermission()` directly from the **Accelerometer Tilt** tap, then listens for `deviceorientation`. If permission is denied or the sensor sends no data, the game keeps touch steering active and shows a clear status message. Serve over HTTPS (or localhost) for sensors to work on a real device.

### Landscape and portrait

The HUD, joystick, and action cluster reflow for both orientations. Landscape gives the widest view; portrait keeps the same controls with a compact top-left status stack.

## What’s in the run

- Procedural canyon geometry, arches, lane grid, neon pylons, stars, and a custom sunset sky shader.
- Twin auto-cannons with aim assist, homing missile volleys, barrel-roll invulnerability, boost meter, hull, score combos, and pickups.
- Scout and heavy raiders, wall turrets, and two-phase boss fight: destroy three generators, then hit the exposed reactor core.
- Bloom post-processing, GPU particles, shockwaves, camera shake, and a procedural WebAudio synthwave score with SFX.
- Persistent local best score, distance, kills, and settings. Nothing leaves the browser.

## Tech

- [Three.js](https://threejs.org/) r180, vendored locally under `vendor/`.
- `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `OutputPass` for the final image.
- Web Audio API for all music and sound effects.
- Plain HTML/CSS/ES modules — no bundler, framework, or network requests at runtime.

## Project layout

```
index.html          UI, screens, HUD, import map
styles.css          responsive visual system and touch controls
src/main.js         game state, input, tilt, camera, HUD, scoring
src/world.js        canyon, sky, arches, grid, stars
src/ship.js         player fighter and engine effects
src/combat.js       enemies, bullets, missiles, pickups, boss
src/effects.js      particles, rings, flashes, shake
src/audio.js        synthwave sequencer and SFX
src/track.js        canyon path math and sector definitions
vendor/             Three.js modules, addons, shaders, fonts
```

## Notes

- Tested in Chromium with software rendering; performance scales with the **Quality** setting in the game menu.
- `window.__canyon` exposes a small read/debug API for automated checks (state, combat, boss helpers, and `advance(seconds)`).
