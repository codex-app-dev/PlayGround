import * as THREE from '../vendor/three.module.js';
import { add, group, M, C, teamMat, banner, flagPole } from './materials.js';

// Buildings are modelled in a normalized footprint (about 2x2) and scaled by
// the building size in the game, so every structure shares a visual language.
const stone = M(C.stone);
const stoneL = M(C.stoneLight);
const stoneD = M(C.stoneDark);
const wood = M(C.wood);
const woodD = M(C.woodDark);
const gold = M(C.gold, { metalness: 0.55, roughness: 0.35 });
const windowGlow = M(0xffd77a, { emissive: 0xffb733, emissiveIntensity: 1.4 });
const blue = M(C.blueRoof);

export function humanHall(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.35 };

  add(g, 'box', stoneD, 0, 0.16, 0, 1.9, 0.32, 1.7);
  add(g, 'box', stone, 0, 0.43, 0, 1.6, 0.3, 1.45);
  add(g, 'box', stoneL, 0, 0.9, 0, 1.25, 0.72, 1.15);
  add(g, 'box', stone, 0, 1.31, 0, 1.34, 0.14, 1.24);
  add(g, 'cone', blue, 0, 1.62, 0, 1.5, 0.62, 1.5, 0, 0, 0);
  add(g, 'cone', M(0x1d3f80), 0, 1.72, 0, 0.45, 0.3, 0.45, 0, 0, 0);
  // corner tower
  add(g, 'box', stone, -0.52, 1.05, -0.48, 0.48, 1.5, 0.48);
  add(g, 'box', stoneL, -0.52, 1.82, -0.48, 0.56, 0.12, 0.56);
  add(g, 'cone', blue, -0.52, 2.06, -0.48, 0.62, 0.5, 0.62);
  // front steps and door
  add(g, 'box', stoneD, 0, 0.58, 0.68, 0.52, 0.36, 0.18);
  add(g, 'box', M(0x3b2a1b), 0, 0.78, 0.59, 0.32, 0.42, 0.06);
  add(g, 'box', gold, 0, 0.58, 0.62, 0.34, 0.04, 0.08);
  // windows
  add(g, 'box', windowGlow, -0.34, 1.05, 0.59, 0.12, 0.2, 0.05);
  add(g, 'box', windowGlow, 0.34, 1.05, 0.59, 0.12, 0.2, 0.05);
  add(g, 'box', windowGlow, -0.53, 1.56, -0.22, 0.06, 0.16, 0.12);
  // buttresses
  for (const x of [-0.7, 0.7]) {
    add(g, 'box', stoneL, x, 0.8, 0.48, 0.1, 0.56, 0.16);
    add(g, 'cone', stoneL, x, 1.14, 0.48, 0.14, 0.2, 0.16);
  }
  // banners
  anim.flags.push(banner(g, team, -0.85, 0.45, 0.55, 1.25, 0.4, 0.4));
  anim.flags.push(banner(g, team, 0.85, 0.45, 0.55, 1.25, 0.4, 1.7));
  anim.flags.push(flagPole(g, team, 0.52, 1.5, -0.48, 0.8));
  g.userData.anim = anim;
  return g;
}

export function humanFarm(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.25 };
  add(g, 'box', stoneD, 0, 0.08, 0, 1.7, 0.16, 1.5);
  add(g, 'box', M(0xd9cba4), 0, 0.45, 0, 1.1, 0.6, 0.86);
  add(g, 'box', woodD, 0, 0.79, 0, 1.2, 0.1, 0.95);
  add(g, 'cone4', M(C.redRoof), 0, 1.05, 0, 1.35, 0.55, 1.05, 0, Math.PI / 4, 0);
  add(g, 'box', stone, 0.34, 1.18, -0.2, 0.16, 0.38, 0.16);
  add(g, 'box', M(0x3b2a1b), 0, 0.39, 0.44, 0.28, 0.38, 0.05);
  add(g, 'box', windowGlow, -0.32, 0.5, 0.44, 0.15, 0.15, 0.05);
  // fence
  for (let i = 0; i < 5; i++) {
    add(g, 'cyl6', wood, -0.85 + i * 0.42, 0.25, 0.68, 0.05, 0.5, 0.05);
  }
  add(g, 'box', wood, -0.02, 0.36, 0.68, 1.74, 0.05, 0.05);
  add(g, 'box', wood, -0.02, 0.19, 0.68, 1.74, 0.05, 0.05);
  // hay and vegetable rows
  add(g, 'box', M(0xd8b45a), -0.55, 0.22, -0.5, 0.38, 0.18, 0.24);
  add(g, 'box', M(0xd8b45a), -0.56, 0.3, -0.55, 0.28, 0.1, 0.18, 0, 0.4, 0);
  for (let i = 0; i < 3; i++) add(g, 'box', M(0x5f7d39), 0.35, 0.14, -0.35 + i * 0.2, 0.4, 0.1, 0.08);
  anim.flags.push(flagPole(g, team, 0.56, 0.72, 0.35, 0.55));
  g.userData.anim = anim;
  return g;
}

export function humanBarracks(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 1.55 };
  add(g, 'box', stoneD, 0, 0.1, 0, 1.85, 0.2, 1.35);
  add(g, 'box', stone, 0, 0.62, 0, 1.5, 0.84, 1.0);
  add(g, 'box', stoneL, 0, 1.1, 0, 1.58, 0.14, 1.08);
  // gable roof from two slabs
  add(g, 'box', blue, -0.42, 1.38, 0, 0.98, 0.14, 1.18, 0, 0, 0.52);
  add(g, 'box', blue, 0.42, 1.38, 0, 0.98, 0.14, 1.18, 0, 0, -0.52);
  add(g, 'box', M(0x1d3f80), 0, 1.63, 0, 0.12, 0.18, 1.14);
  // door
  add(g, 'box', M(0x3b2a1b), 0, 0.54, 0.52, 0.42, 0.72, 0.05);
  add(g, 'box', gold, 0, 0.84, 0.55, 0.5, 0.06, 0.05);
  add(g, 'box', windowGlow, -0.55, 0.67, 0.51, 0.14, 0.18, 0.05);
  add(g, 'box', windowGlow, 0.55, 0.67, 0.51, 0.14, 0.18, 0.05);
  // training dummy
  add(g, 'cyl6', wood, 0.78, 0.4, -0.62, 0.06, 0.8, 0.06);
  add(g, 'box', M(0xd8b45a), 0.78, 0.58, -0.62, 0.3, 0.36, 0.18);
  add(g, 'box', wood, 0.78, 0.77, -0.62, 0.48, 0.05, 0.05);
  // weapon rack
  add(g, 'box', woodD, -0.76, 0.25, 0.45, 0.45, 0.06, 0.12);
  add(g, 'cyl6', M(C.steelDark), -0.82, 0.45, 0.45, 0.025, 0.55, 0.025, 0.2, 0, 0.15);
  add(g, 'cyl6', M(C.steelDark), -0.7, 0.45, 0.45, 0.025, 0.55, 0.025, -0.1, 0, -0.2);
  anim.flags.push(banner(g, team, -0.82, 0.25, -0.42, 1.05, 0.35, 0.9));
  anim.flags.push(flagPole(g, team, 0.74, 1.12, 0.4, 0.48));
  g.userData.anim = anim;
  return g;
}

export function humanTower(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.45 };
  add(g, 'box', stoneD, 0, 0.12, 0, 1.0, 0.24, 1.0);
  add(g, 'cyl', stone, 0, 0.95, 0, 0.9, 1.7, 0.9);
  add(g, 'cyl', stoneL, 0, 1.82, 0, 0.98, 0.16, 0.98);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    add(g, 'box', stoneL, Math.cos(a) * 0.4, 1.98, Math.sin(a) * 0.4, 0.22, 0.2, 0.22);
  }
  add(g, 'cone', blue, 0, 2.23, 0, 0.92, 0.55, 0.92);
  add(g, 'box', M(0x3b2a1b), 0, 0.52, 0.44, 0.26, 0.45, 0.05);
  add(g, 'box', windowGlow, 0, 1.2, 0.44, 0.1, 0.24, 0.05);
  add(g, 'box', windowGlow, 0.24, 1.55, 0.34, 0.08, 0.14, 0.05);
  add(g, 'box', windowGlow, -0.24, 1.55, 0.34, 0.08, 0.14, 0.05);
  anim.flags.push(flagPole(g, team, 0, 2.38, 0, 0.55));
  anim.flags.push(banner(g, team, 0.58, 0.2, 0.48, 0.8, 0.3, 2.4));
  g.userData.anim = anim;
  return g;
}

export function humanSpecial(team) {
  const g = new THREE.Group();
  const t = teamMat(team);
  const anim = { flags: [], height: 2.65 };
  add(g, 'box', stoneD, 0, 0.12, 0, 1.9, 0.24, 1.6);
  add(g, 'box', stone, 0, 0.5, 0, 1.5, 0.55, 1.25);
  add(g, 'box', stoneL, 0, 0.9, 0, 1.0, 0.9, 0.85);
  add(g, 'box', M(0x3b2a1b), 0, 0.62, 0.45, 0.36, 0.6, 0.05);
  // twin towers
  for (const x of [-0.62, 0.62]) {
    add(g, 'box', stone, x, 1.25, 0.2, 0.34, 1.4, 0.34);
    add(g, 'cone', blue, x, 2.05, 0.2, 0.42, 0.62, 0.42);
    add(g, 'box', windowGlow, x, 1.35, 0.39, 0.08, 0.2, 0.03);
  }
  add(g, 'cone', blue, 0, 1.9, -0.05, 0.95, 0.95, 0.95);
  // rose window
  add(g, 'cyl', M(0x5aa7ff, { emissive: 0x2c6cff, emissiveIntensity: 1.2 }), 0, 1.2, 0.47, 0.3, 0.03, 0.3, Math.PI / 2, 0, 0);
  add(g, 'torus', gold, 0, 1.2, 0.5, 0.38, 0.08, 0.38);
  add(g, 'box', gold, 0, 1.2, 0.49, 0.5, 0.05, 0.03);
  // cross
  add(g, 'box', gold, 0, 2.55, -0.05, 0.08, 0.55, 0.08);
  add(g, 'box', gold, 0, 2.6, -0.05, 0.34, 0.08, 0.08);
  // statues
  for (const x of [-0.45, 0.45]) {
    add(g, 'cyl', stoneL, x, 0.68, 0.62, 0.14, 0.16, 0.14);
    add(g, 'sphere', stoneL, x, 0.82, 0.62, 0.14, 0.2, 0.12);
  }
  anim.flags.push(banner(g, team, -0.86, 0.3, 0.65, 1.2, 0.36, 1.1));
  anim.flags.push(banner(g, team, 0.86, 0.3, 0.65, 1.2, 0.36, 2.5));
  anim.flags.push(flagPole(g, team, 0, 2.4, -0.06, 0.7));
  g.userData.anim = anim;
  return g;
}
