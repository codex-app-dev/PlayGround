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

## TRIBES: SKYFALL

A playable browser-based 3D capture-the-flag FPS inspired by Tribes, built with Vite and
Three.js. Jetpack over the ridges, ski down the slopes, and land mid-air spinfusor shots to
steal the enemy flag.

### Play

```bash
npm install
npm run dev
```

Open the printed local URL, press **PLAY NOW**, then click the canvas to lock the mouse.

### Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Aim / fire |
| `Space` | Jump / hold to jetpack |
| `Shift` / `Ctrl` | Ski (hold on slopes) |
| Right mouse | Zoom |
| `R` | Reload |

On phones and tablets, on-screen controls appear automatically: a left thumbstick to move,
drag anywhere else to look and aim, and right-side buttons for fire, jump/jetpack, ski,
zoom, and reload. Append `?touch=1` to force the touch layout while testing on desktop.

### Rules

- Two teams, blue and red, first to **5 flag captures** wins.
- 9-minute match timer with sudden-death overtime when tied.
- Touch the enemy flag to pick it up, return it to your own base to score.
- Flag must be home to capture; dropped flags return after 20 seconds.
- Six bots (4 red, 2 blue) fight, ski, jet, and chase objectives on their own.

`window.__tribes` is exposed for debugging state, player, bots, combat, and the world.

