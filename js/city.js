import { BLOCK, ROAD, BASES, ACCENTS, clamp, mulberry32 } from './config.js';

const blockCache = new Map();

function makeBuilding(rx, ry, rw, rh, rng) {
  const inset = 5 + rng() * 8;
  const x = rx + inset;
  const y = ry + inset;
  const w = rw - inset * 2;
  const h = rh - inset * 2;
  if (w < 18 || h < 18) return null;

  const base = BASES[Math.floor(rng() * BASES.length)];
  const accent = ACCENTS[Math.floor(rng() * ACCENTS.length)];
  const cols = clamp(Math.floor(w / (18 + rng() * 9)), 2, 9);
  const rows = clamp(Math.floor(h / (20 + rng() * 10)), 2, 11);
  const windows = new Uint8Array(cols * rows);
  for (let i = 0; i < windows.length; i++) {
    const roll = rng();
    windows[i] = roll < 0.52 ? 0 : roll < 0.72 ? 1 : roll < 0.88 ? 2 : 3;
  }

  const sign = rng() < 0.58 ? {
    side: rng() < 0.5 ? -1 : 1,
    color: rng() < 0.55 ? accent : ACCENTS[Math.floor(rng() * ACCENTS.length)],
    offset: 0.12 + rng() * 0.2,
    length: 0.24 + rng() * 0.42
  } : null;

  const roofs = [];
  const roofCount = Math.floor(rng() * 3);
  for (let i = 0; i < roofCount; i++) {
    const bw = Math.min(w * 0.32, 24 + rng() * 34);
    const bh = Math.min(h * 0.32, 18 + rng() * 28);
    roofs.push({
      x: x + (w - bw) * (0.2 + rng() * 0.6),
      y: y + (h - bh) * (0.2 + rng() * 0.6),
      w: bw,
      h: bh
    });
  }

  const billboard = w > 68 && h > 68 && rng() < 0.48 ? {
    x: x + w * (0.16 + rng() * 0.14),
    y: y + h * (0.18 + rng() * 0.3),
    w: w * (0.36 + rng() * 0.26),
    h: 9 + rng() * 13,
    color: rng() < 0.5 ? accent : ACCENTS[Math.floor(rng() * ACCENTS.length)]
  } : null;

  return {
    x, y, w, h, base, accent, cols, rows, windows, sign, roofs, billboard,
    neon: rng() < 0.74,
    antenna: rng() < 0.17,
    seed: Math.floor(rng() * 10000)
  };
}

export function getBlock(bx, by) {
  const key = `${bx},${by}`;
  const cached = blockCache.get(key);
  if (cached) return cached;

  const rng = mulberry32(((bx * 73856093) ^ (by * 19349663) ^ 0x9e3779b9) >>> 0);
  const x0 = bx * BLOCK + ROAD / 2;
  const y0 = by * BLOCK + ROAD / 2;
  const size = BLOCK - ROAD;
  const gap = 11 + rng() * 18;
  const mode = rng();
  const regions = [];

  if (mode < 0.3) {
    regions.push([x0, y0, size, size]);
  } else if (mode < 0.59) {
    const split = size * (0.38 + rng() * 0.24);
    regions.push([x0, y0, split - gap / 2, size], [x0 + split + gap / 2, y0, size - split - gap / 2, size]);
  } else if (mode < 0.85) {
    const split = size * (0.38 + rng() * 0.24);
    regions.push([x0, y0, size, split - gap / 2], [x0, y0 + split + gap / 2, size, size - split - gap / 2]);
  } else {
    const sx = size * (0.4 + rng() * 0.2);
    const sy = size * (0.4 + rng() * 0.2);
    regions.push(
      [x0, y0, sx - gap / 2, sy - gap / 2],
      [x0 + sx + gap / 2, y0, size - sx - gap / 2, sy - gap / 2],
      [x0, y0 + sy + gap / 2, sx - gap / 2, size - sy - gap / 2],
      [x0 + sx + gap / 2, y0 + sy + gap / 2, size - sx - gap / 2, size - sy - gap / 2]
    );
  }

  const rects = [];
  for (const region of regions) {
    if (rng() < 0.06) continue;
    const building = makeBuilding(region[0], region[1], region[2], region[3], rng);
    if (building) rects.push(building);
  }

  const block = { x0, y0, size, rects };
  blockCache.set(key, block);
  return block;
}

export function findBuildingPush(x, y, radius) {
  const bx = Math.floor(x / BLOCK);
  const by = Math.floor(y / BLOCK);
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const block = getBlock(bx + ox, by + oy);
      for (const b of block.rects) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
          const left = x - b.x;
          const right = b.x + b.w - x;
          const top = y - b.y;
          const bottom = b.y + b.h - y;
          const min = Math.min(left, right, top, bottom);
          if (min === left) return { nx: -1, ny: 0, depth: left + radius };
          if (min === right) return { nx: 1, ny: 0, depth: right + radius };
          if (min === top) return { nx: 0, ny: -1, depth: top + radius };
          return { nx: 0, ny: 1, depth: bottom + radius };
        }
        const nx = x < b.x ? b.x : x > b.x + b.w ? b.x + b.w : x;
        const ny = y < b.y ? b.y : y > b.y + b.h ? b.y + b.h : y;
        const dx = x - nx;
        const dy = y - ny;
        const distSq = dx * dx + dy * dy;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 0.001;
          return { nx: dx / dist, ny: dy / dist, depth: radius - dist };
        }
      }
    }
  }
  return null;
}

export function pointBlocked(x, y, radius) {
  return findBuildingPush(x, y, radius) !== null;
}
