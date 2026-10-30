# Power Shift — Chess, Rewritten

Power Shift is a touch-first chess variant where **every capture swaps movement powers**. Pieces keep their shape and identity, but the movement rules travel from piece to piece. A pawn that takes a rook suddenly slides like a rook. A queen that takes a pawn is reduced to one-step pawn movement. The board is never the same twice.

Built as a dependency-free static web app: no build step, no framework, no install.

## How it works

- **Capture to swap.** The capturing piece inherits the captured piece's movement power. The captured piece leaves the board.
- **Read the badge.** When a piece's power differs from its shape, a small letter badge shows how it actually moves (`P`, `N`, `B`, `R`, `Q`, `K`).
- **Kings stay kings.** Check, checkmate, and stalemate work as usual. Kings are identified by their role, not their current power.
- **Castling is conditional.** You can only castle while the king still has king movement and the rook still has rook movement.
- **En passant and promotion** are supported. A promoted pawn always gains queen movement.

## Features

- Solo vs. CPU with two strengths (Casual and Sharp) or local two-player pass-and-play.
- Responsive, touch-first layout for phones, tablets, and desktop.
- Optional accelerometer tilt with iOS motion-permission handling.
- Legal-move highlights, last-move and check indicators, capture feed, captured tray, and move log.
- Undo, new game, sound toggle, haptics, rules and settings dialogs, and a game-over summary.
- Custom SVG piece artwork and locally hosted fonts. All assets are local; there are no CDN or network calls at runtime.

## Run it

The app is plain HTML, CSS, and JavaScript. Serve the folder with any static server:

```bash
python3 -m http.server 3002
```

Then open <http://localhost:3002>. Opening `index.html` directly from the filesystem will not work because the app uses ES modules.

## Controls

- **Tap a piece**, then tap a highlighted square to move. Tap an enemy piece on a highlighted capture square to take it.
- **Undo** rewinds the last move (and the CPU reply in solo mode).
- **New** starts a fresh game.
- **Moves** opens the full move log on mobile.
- **Tilt** enables device-orientation board tilt; iOS asks for motion permission the first time.
- Keyboard shortcuts: `U` undo, `N` new game, `Esc` clear selection or close a dialog.

## Tests

The chess engine has a small regression suite covering legal moves, power swaps, en passant, castling, checkmate, stalemate, king tracking, and AI legality:

```bash
node --experimental-default-type=module --test tests/engine.test.mjs
```

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | App markup, dialogs, and board structure |
| `styles.css` | Visual design and responsive layouts |
| `app.js` | UI state, rendering, input, AI scheduling, sound, and tilt |
| `engine.js` | Rules, move generation, power swaps, status, and AI search |
| `pieces.js` | SVG piece artwork and badge helpers |
| `tests/engine.test.mjs` | Engine regression tests |
| `assets/fonts/` | Locally hosted Manrope and Fraunces fonts |

---

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
