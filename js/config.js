export const TAU = Math.PI * 2;
export const BLOCK = 390;
export const ROAD = 118;
export const MAX_TRAFFIC = 18;
export const MAX_PICKUPS = 12;
export const MAX_MULTIPLIER = 9;
export const STORE_KEY = 'neonPursuitBest';
export const MUTE_KEY = 'neonPursuitMuted';

export const BASES = ['#111a2f', '#121d35', '#161430', '#10182b', '#191633', '#132138', '#151b31'];
export const ACCENTS = ['#35e7ff', '#ff3d93', '#b45cff', '#ffb84d', '#4dffb8', '#6d8dff'];
export const TRAFFIC_COLORS = [
  ['#d9556d', '#591b2a'],
  ['#d99b3f', '#59380d'],
  ['#5b8cff', '#1b2f63'],
  ['#8b6bff', '#31235f'],
  ['#3fd0a0', '#0e483a'],
  ['#cfd8e6', '#3b4453'],
  ['#e8c547', '#5c4a0c'],
  ['#e56b9f', '#5a2140']
];

export const clamp = (value, min, max) => value < min ? min : value > max ? max : value;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const fmt = (value) => Math.floor(value).toLocaleString('en-US');

export function angleDiff(a, b) {
  let diff = (b - a + Math.PI) % TAU;
  if (diff < 0) diff += TAU;
  return diff - Math.PI;
}

export function loadBest() {
  try {
    const value = parseInt(localStorage.getItem(STORE_KEY) || '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try { localStorage.setItem(STORE_KEY, String(Math.floor(value))); } catch {}
}

export function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function saveMuted(value) {
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch {}
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgbCache = new Map();
export function rgba(hex, alpha) {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const h = hex.replace('#', '');
    rgb = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, rgb);
  }
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
