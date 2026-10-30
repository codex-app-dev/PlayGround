export const TRACK_LENGTH = 7420;
export const BOSS_TRIGGER = 6550;
export const BOSS_HOLD = 250;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return lerp(
    lerp(hash(ix + iy * 57.13), hash(ix + 1 + iy * 57.13), ux),
    lerp(hash(ix + (iy + 1) * 57.13), hash(ix + 1 + (iy + 1) * 57.13), ux),
    uy
  );
}

/** Canyon centre line. s is metres flown forward. */
export function pathX(s) {
  return (
    40 * Math.sin(s * 0.00215 + 0.4) +
    14 * Math.sin(s * 0.0051 + 1.75) +
    5.5 * Math.sin(s * 0.0124 + 0.2)
  );
}

export function pathSlope(s) {
  return (
    40 * 0.00215 * Math.cos(s * 0.00215 + 0.4) +
    14 * 0.0051 * Math.cos(s * 0.0051 + 1.75) +
    5.5 * 0.0124 * Math.cos(s * 0.0124 + 0.2)
  );
}

/** Half-width of the flyable slot between the canyon walls. */
export function halfWidth(s) {
  const narrow = smoothstep(2150, 2950, s) * (1 - smoothstep(4550, 5350, s));
  const arena = smoothstep(6150, 6700, s);
  return (
    32 +
    5.5 * Math.sin(s * 0.0016 + 0.8) +
    3.5 * Math.sin(s * 0.0043 + 2.1) -
    10.5 * narrow +
    25 * arena
  );
}

export function wallHeight(s, side) {
  const base = 62 + 20 * Math.sin(s * 0.0021 + (side > 0 ? 0.4 : 2.1));
  return base + 13 * Math.sin(s * 0.0057 + side) + 7 * noise1(s * 0.013 + side * 9.1);
}

export function worldFromTrack(s, xRel = 0, y = 10) {
  return { x: pathX(s) + xRel, y, z: -s };
}

/** Forward direction of the canyon at s. Ship nose points down -Z. */
export function trackForward(s, out = { x: 0, y: 0, z: 0 }) {
  const dx = pathSlope(s);
  const inv = 1 / Math.hypot(dx, 1);
  out.x = dx * inv;
  out.y = 0;
  out.z = -inv;
  return out;
}

export function trackYaw(s) {
  return Math.atan2(-pathSlope(s), 1);
}

export function sectorAt(s) {
  if (s >= BOSS_TRIGGER) return 3;
  if (s >= 4700) return 2;
  if (s >= 2500) return 1;
  return 0;
}

export const SECTORS = [
  { name: 'OPEN BADLANDS', code: 'SECTOR 01', start: 0, end: 2500, color: '#2ef2ff' },
  { name: 'THE NARROWS', code: 'SECTOR 02', start: 2500, end: 4700, color: '#ff2f92' },
  { name: 'THE GAUNTLET', code: 'SECTOR 03', start: 4700, end: BOSS_TRIGGER, color: '#ffb347' },
  { name: 'BLOCKADE', code: 'FINAL SECTOR', start: BOSS_TRIGGER, end: TRACK_LENGTH, color: '#ff2f92' },
];
