import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const TAU = Math.PI * 2;

/* deterministic low-frequency value noise */
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h & 0x7fffffff) / 0x7fffffff) * 2 - 1;
}
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, y * f) * amp; amp *= 0.5; f *= 2.03; }
  return s;
}

/* ============ world height ============ */
export const PLAY_RADIUS = 235;
export function groundHeight(x, z) {
  const r = Math.hypot(x * 0.86, z);
  const rise = smoothstep(250, 560, r);
  if (rise <= 0.0001) return 0;
  const n = fbm(x * 0.0075 + 12.3, z * 0.0075 - 4.1, 3) * 0.55 + fbm(x * 0.028, z * 0.028, 2) * 0.12;
  return rise * (18 + n * 40) + rise * rise * 46;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* asphalt with fine grain — used for tiled surfaces */
export function asphaltTexture(size = 512, base = '#2b2e33') {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, Math.random() * 3 + 0.5, 0, TAU);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function concreteTexture(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#a9a49b';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.random() * 90;
    g.fillStyle = `rgba(${v},${v - 3},${v - 8},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * size, Math.random() * size, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  g.strokeStyle = 'rgba(60,58,55,.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(Math.random() * size, 0);
    g.lineTo(Math.random() * size, size);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function softDotTexture(size = 64, inner = 'rgba(255,255,255,1)') {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, 'rgba(255,255,255,.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function gridTexture(cells = 4, size = 512) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#34383e';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(230,235,240,.19)';
  g.lineWidth = Math.max(1, size / 340);
  const cell = size / cells;
  for (let i = 0; i <= cells; i++) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function formatNum(n) {
  return Math.round(n).toLocaleString('en-US');
}

/* normal from a height function */
export function surfaceNormal(x, z, hFn, out = new THREE.Vector3()) {
  const e = 0.6;
  const hL = hFn(x - e, z), hR = hFn(x + e, z);
  const hD = hFn(x, z - e), hU = hFn(x, z + e);
  out.set(hL - hR, 2 * e, hD - hU).normalize();
  return out;
}
