import * as THREE from '../vendor/three.module.js';
import { add, group, M, C, GLOW_TEX } from './materials.js';
import { humanWorker, humanMelee, humanRanged, humanHeavy, humanCaster } from './models_human.js';
import { orcWorker, orcMelee, orcRanged, orcHeavy, orcCaster } from './models_orc.js';
import { undeadWorker, undeadMelee, undeadRanged, undeadHeavy, undeadCaster } from './models_undead.js';
import { humanHall, humanFarm, humanBarracks, humanTower, humanSpecial } from './models_human_buildings.js';
import { orcHall, orcFarm, orcBarracks, orcTower, orcSpecial } from './models_orc_buildings.js';
import { undeadHall, undeadFarm, undeadBarracks, undeadTower, undeadSpecial } from './models_undead_buildings.js';

const UNIT_FACTORY = {
  human: { worker: humanWorker, melee: humanMelee, ranged: humanRanged, heavy: humanHeavy, caster: humanCaster },
  orc: { worker: orcWorker, melee: orcMelee, ranged: orcRanged, heavy: orcHeavy, caster: orcCaster },
  undead: { worker: undeadWorker, melee: undeadMelee, ranged: undeadRanged, heavy: undeadHeavy, caster: undeadCaster },
};

const BUILDING_FACTORY = {
  human: { hall: humanHall, farm: humanFarm, barracks: humanBarracks, tower: humanTower, special: humanSpecial },
  orc: { hall: orcHall, farm: orcFarm, barracks: orcBarracks, tower: orcTower, special: orcSpecial },
  undead: { hall: undeadHall, farm: undeadFarm, barracks: undeadBarracks, tower: undeadTower, special: undeadSpecial },
};

export function createUnitModel(race, role, teamColor = 0x4c8dff) {
  const fn = UNIT_FACTORY[race]?.[role];
  if (!fn) throw new Error(`Unknown unit model ${race}/${role}`);
  return fn(teamColor);
}

export function createBuildingModel(race, role, teamColor = 0x4c8dff) {
  const fn = BUILDING_FACTORY[race]?.[role];
  if (!fn) throw new Error(`Unknown building model ${race}/${role}`);
  return fn(teamColor);
}

// ---------------------------------------------------------------------------
// Map props
// ---------------------------------------------------------------------------
const treeTrunk = M(0x5b3c24);
const leafMats = [
  M(0x3f7138), M(0x4f8340), M(0x356229), M(0x6a8a3e),
  M(0x9a6a2f), M(0xb07a32), M(0x35603a), M(0x2c5232),
];
const rockMats = [M(0x7a786d), M(0x8c897b), M(0x62615a), M(0x9a9687)];
const goldMats = [M(0xe3b83e, { metalness: 0.55, roughness: 0.35, emissive: 0x6b4300, emissiveIntensity: 0.35 })];

export function createTree(variant = 0, scale = 1) {
  const g = new THREE.Group();
  const s = scale;
  g.scale.setScalar(s);
  add(g, 'cyl6', treeTrunk, 0, 1.1, 0, 0.26, 2.2, 0.26);
  add(g, 'cyl6', M(0x6b482a), 0, 0.35, 0, 0.4, 0.5, 0.4);
  const v = variant % 3;
  if (v === 0) {
    // broadleaf
    const mat = leafMats[variant % 4];
    add(g, 'sphere', mat, 0, 2.5, 0, 2.4, 1.9, 2.4);
    add(g, 'sphere', mat, -0.65, 3.2, 0.2, 1.7, 1.5, 1.7);
    add(g, 'sphere', leafMats[(variant + 1) % 4], 0.7, 3.25, -0.1, 1.6, 1.4, 1.6);
    add(g, 'sphere', leafMats[(variant + 2) % 4], 0.15, 3.8, 0.1, 1.3, 1.1, 1.3);
  } else if (v === 1) {
    // autumn
    const mat = leafMats[4 + (variant % 2)];
    add(g, 'sphere', mat, 0, 2.6, 0, 2.3, 1.8, 2.3);
    add(g, 'sphere', leafMats[4], -0.55, 3.2, 0, 1.5, 1.5, 1.5);
    add(g, 'sphere', leafMats[5], 0.6, 3.15, 0.1, 1.45, 1.4, 1.45);
    add(g, 'sphere', leafMats[4], 0.05, 3.7, 0, 1.15, 1.1, 1.15);
  } else {
    // pine
    const mat = leafMats[6];
    add(g, 'cone', mat, 0, 2.2, 0, 2.2, 1.9, 2.2);
    add(g, 'cone', mat, 0, 3.1, 0, 1.8, 1.8, 1.8);
    add(g, 'cone', mat, 0, 4.0, 0, 1.3, 1.6, 1.3);
    add(g, 'cone', leafMats[7], 0, 4.8, 0, 0.8, 1.2, 0.8);
  }
  g.userData.height = 5 * s;
  return g;
}

export function createRock(scale = 1, variant = 0) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  add(g, 'dodeca', rockMats[variant % rockMats.length], 0, 0.45, 0, 1.3, 0.85, 1.1, 0.2, variant, 0.1);
  add(g, 'dodeca', rockMats[(variant + 1) % rockMats.length], 0.55, 0.25, 0.25, 0.7, 0.5, 0.7, 0.5, 1.2, 0);
  add(g, 'dodeca', rockMats[(variant + 2) % rockMats.length], -0.45, 0.2, 0.3, 0.5, 0.4, 0.45, 1.2, 0.3, 0.4);
  return g;
}

export function createGoldMine() {
  const g = new THREE.Group();
  const rock = M(0x706b5c);
  const rockD = M(0x524e44);
  add(g, 'dodeca', rock, -0.3, 0.55, 0, 2.0, 1.5, 1.8, 0.1, 0.3, 0);
  add(g, 'dodeca', rockD, 0.55, 0.5, -0.15, 1.5, 1.2, 1.5, 0.2, 0.8, 0.2);
  add(g, 'dodeca', rock, 0.1, 0.85, 0.35, 1.45, 1.15, 1.3, 0.3, 0.1, 0.4);
  add(g, 'dodeca', rockD, -0.55, 0.3, 0.45, 0.9, 0.7, 0.8, 0.6, 0.2, 0);
  // entrance
  add(g, 'box', M(0x151411), 0, 0.5, 0.62, 0.75, 1.0, 0.3);
  add(g, 'cyl6', M(C.woodDark), -0.55, 0.65, 0.78, 0.09, 1.3, 0.09);
  add(g, 'cyl6', M(C.woodDark), 0.55, 0.65, 0.78, 0.09, 1.3, 0.09);
  add(g, 'box', M(C.woodDark), 0, 1.32, 0.78, 1.3, 0.16, 0.16);
  add(g, 'cone', goldMats[0], -0.55, 1.5, 0.78, 0.14, 0.28, 0.14);
  // nuggets
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    const r = 0.4 + (i % 4) * 0.22;
    add(g, 'dodeca', goldMats[0], Math.cos(a) * r, 0.2 + (i % 5) * 0.18, Math.sin(a) * r * 0.7 + 0.3, 0.16 + (i % 3) * 0.04, 0.14, 0.16);
  }
  // cart
  add(g, 'box', M(C.woodDark), 1.05, 0.35, 0.4, 0.7, 0.35, 0.5);
  add(g, 'cyl', M(C.iron), 0.85, 0.15, 0.18, 0.26, 0.08, 0.26, Math.PI / 2, 0, 0);
  add(g, 'cyl', M(C.iron), 1.25, 0.15, 0.18, 0.26, 0.08, 0.26, Math.PI / 2, 0, 0);
  add(g, 'dodeca', goldMats[0], 1.05, 0.55, 0.4, 0.5, 0.3, 0.4);
  g.userData.height = 2.2;
  return g;
}

export function createFountain() {
  const g = new THREE.Group();
  const stone = M(C.stoneLight);
  const stoneD = M(C.stoneDark);
  add(g, 'cyl', stoneD, 0, 0.18, 0, 6.2, 0.35, 6.2);
  add(g, 'cyl', stone, 0, 0.42, 0, 5.4, 0.2, 5.4);
  const water = add(g, 'cyl', M(0x40c9d9, { emissive: 0x1a94b5, emissiveIntensity: 0.7, transparent: true, opacity: 0.82 }), 0, 0.55, 0, 4.7, 0.08, 4.7);
  water.userData.water = true;
  // four pillars and statue base
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    add(g, 'cyl', stoneD, Math.cos(a) * 4.0, 0.9, Math.sin(a) * 4.0, 0.45, 1.5, 0.45);
    add(g, 'sphere', stone, Math.cos(a) * 4.0, 1.7, Math.sin(a) * 4.0, 0.6, 0.5, 0.6);
    add(g, 'cone', stone, Math.cos(a) * 4.0, 1.95, Math.sin(a) * 4.0, 0.35, 0.45, 0.35);
  }
  add(g, 'cyl', stoneD, 0, 0.9, 0, 1.7, 1.4, 1.7);
  add(g, 'cyl', stone, 0, 1.65, 0, 1.2, 0.2, 1.2);
  // central crystal
  const crystal = add(g, 'dodeca', M(0x7ff5e5, { emissive: 0x2ed6c9, emissiveIntensity: 1.8, transparent: true, opacity: 0.9 }), 0, 2.3, 0, 0.8, 1.5, 0.8);
  crystal.userData.spin = true;
  add(g, 'torus', M(0x9ffcf0, { emissive: 0x2ed6c9, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 }), 0, 2.3, 0, 1.1, 0.25, 1.1, Math.PI / 2, 0, 0);
  // glow
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0x6ff5e0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.position.set(0, 2.3, 0);
  sprite.scale.set(7, 7, 1);
  g.add(sprite);
  const light = new THREE.PointLight(0x59e6dd, 28, 17, 2);
  light.position.set(0, 2.6, 0);
  g.add(light);
  g.userData.water = water;
  g.userData.crystal = crystal;
  g.userData.height = 3;
  return g;
}

export function createBush(scale = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);
  add(g, 'sphere', leafMats[2], -0.3, 0.3, 0, 0.8, 0.55, 0.7);
  add(g, 'sphere', leafMats[1], 0.25, 0.35, 0.1, 0.75, 0.55, 0.75);
  add(g, 'sphere', leafMats[3], 0, 0.4, -0.25, 0.6, 0.45, 0.6);
  return g;
}
