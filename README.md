# Gravity Grand Prix

A 3D anti-gravity kart racer that runs in the browser. Eight racers, four laps, two barrel-roll gravity-flip sectors, and a full arcade layer of drifting, mini-turbos, coins, items, and boost pads. Built with Vite + Three.js and procedurally generated assets — no external models or textures.

## Play

```bash
npm install
npm run dev      # http://localhost:3002
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Open the page, press **Enter** (or tap **START ENGINE**), and race.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Accelerate | `W` / `↑` (auto-throttle is on) | Automatic |
| Steer | `A` / `D` or `←` / `→` | Left / right pads |
| Drift + mini-turbo | `Space` while steering | **DRIFT** |
| Use item | `E` | **ITEM** |
| Pause | `P` / `Esc` | Pause button |

## Features

- Spline-based 3D ribbon track with banked turns, a start gate, boost pads, and two gravity-flip barrel-roll sectors.
- Eight racers with light rubber-banding, item rolls, spin-outs, and shield/star/turbo/pulse effects.
- Drift charge with three mini-turbo tiers, coin-based top-speed bonus, and boost pads.
- HUD with position, lap counter, race clock, speedometer, drift charge, item slot, and minimap.
- Responsive layout with safe-area padding and dedicated touch controls for phones and tablets in portrait and landscape.
- Procedural audio: engine pitch, countdown, pickups, drift release, music, and finish sting.
- Automatic low-power fallback for software WebGL renderers (`llvmpipe` / SwiftShader): disables bloom and lowers the render resolution.

## Notes

- Race length is 4 laps; results include total time, best lap, top speed, and a full eight-racer classification.
- Tested with Chromium at 390×844, 844×390, and desktop sizes.
- On a CPU software renderer the frame rate is low by nature; real GPU-backed browsers run the intended path with bloom enabled.
