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

## Swap Chess

A mobile-first chess variant where **every capture swaps the two pieces' movement powers**. The piece shapes never change — a small badge shows when a piece is carrying someone else's power. Take a knight with your rook and the rook starts moving like a knight, while the captured piece leaves the board with the rook's old power.

- Touch-first tap-to-select controls, with keyboard navigation and an optional accelerometer tilt mode (including the iOS motion-permission prompt).
- No castling or en passant; checkmate wins. Any piece that inherits pawn power promotes on the far rank, and pawn power can double-step only from its home rank.
- Two-player hotseat and a built-in bot (depth-2 negamax) that plays Black.
- Undo, board flip, sound and haptics, local settings, and a live swap log.
- Plain HTML/CSS/JS with ES modules — no build step.

### Run it

Serve the project folder over HTTP (ES modules do not load from `file://`), for example:

```sh
python3 -m http.server 3000
```

Then open <http://localhost:3000>.

### Test the rules engine

```sh
node --test tests/*.test.mjs
```
