import * as THREE from '../vendor/three.module.js';

// Shared low-poly primitives. Reusing geometry keeps draw setup cheap.
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  sphereLo: new THREE.SphereGeometry(0.5, 7, 5),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  frustum: new THREE.CylinderGeometry(0.42, 0.62, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 9),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  dodeca: new THREE.DodecahedronGeometry(0.5, 0),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  torus: new THREE.TorusGeometry(0.5, 0.08, 5, 12),
  torusThin: new THREE.TorusGeometry(0.5, 0.035, 4, 14),
  plane: new THREE.PlaneGeometry(1, 1, 4, 1),
  ring: new THREE.RingGeometry(0.7, 1, 32),
};

const MATS = new Map();
export function M(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.82}|${opts.metalness ?? 0.05}|${opts.emissive ?? 0}|${opts.emissiveIntensity ?? 0}|${opts.opacity ?? 1}|${opts.transparent ? 1 : 0}|${opts.side ?? 0}|${opts.depthWrite === false ? 0 : 1}`;
  let m = MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.82,
      metalness: opts.metalness ?? 0.05,
      flatShading: true,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      depthWrite: opts.depthWrite ?? true,
    });
    MATS.set(key, m);
  }
  return m;
}

export const C = {
  steel: 0xb9c4d2,
  steelDark: 0x687787,
  iron: 0x4f5b68,
  gold: 0xd9b45b,
  goldBright: 0xffcf5a,
  wood: 0x7a512f,
  woodDark: 0x4b3220,
  woodLight: 0x9c6d3e,
  leather: 0x8a5a35,
  leatherDark: 0x533722,
  skin: 0xe3b187,
  skinDark: 0xc39067,
  orcSkin: 0x75a94d,
  orcDark: 0x4b7a34,
  bone: 0xd9d2b7,
  boneDark: 0x9e987f,
  undeadSkin: 0xaebcab,
  rot: 0x6d7d5e,
  stone: 0x8d8b80,
  stoneDark: 0x5e5d56,
  stoneLight: 0xada99a,
  redRoof: 0x9e4436,
  blueRoof: 0x2e62b4,
  hide: 0x8b6236,
  hideDark: 0x5e3f22,
  water: 0x3aa8c2,
  green: 0x4f7f3a,
  greenDark: 0x355c2a,
  greenLight: 0x6f9e4b,
  autumn: 0xb5742e,
  purple: 0x60408f,
  shadow: 0x1a2028,
};

export function add(parent, geoKey, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true) {
  const mesh = new THREE.Mesh(GEO[geoKey], material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// A limb pivots at the shoulder/hip, so swing animation looks natural.
export function limb(parent, x, y, z, material, w, h, d, geoKey = 'box') {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = add(pivot, geoKey, material, 0, -h / 2, 0, w, h, d);
  parent.add(pivot);
  return pivot;
}

export function teamMat(color) {
  return M(color, { roughness: 0.68 });
}

export function darkTeamMat(color) {
  const c = new THREE.Color(color).multiplyScalar(0.62);
  return M(c.getHex(), { roughness: 0.72 });
}

export function banner(parent, color, x, y, z, h = 1, w = 0.55, phase = 0) {
  const pole = add(parent, 'cyl6', M(C.woodDark), x, y + h / 2, z, 0.035, h, 0.035);
  const pivot = new THREE.Group();
  pivot.position.set(x, y + h * 0.72, z);
  parent.add(pivot);
  add(pivot, 'plane', M(color, { side: THREE.DoubleSide, roughness: 0.7 }), w / 2, 0, 0, w, h * 0.45, 1);
  pivot.userData.phase = phase;
  return pivot;
}

export function flagPole(parent, color, x, y, z, h = 1) {
  add(parent, 'cyl6', M(C.woodDark), x, y + h / 2, z, 0.03, h, 0.03);
  const pivot = new THREE.Group();
  pivot.position.set(x, y + h - 0.12, z);
  parent.add(pivot);
  add(pivot, 'plane', M(color, { side: THREE.DoubleSide }), 0.22, 0, 0, 0.44, 0.28, 1);
  pivot.userData.phase = Math.random() * Math.PI * 2;
  return pivot;
}

export function glowSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.32, 'rgba(255,240,190,.75)');
  g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const GLOW_TEX = glowSpriteTexture();
