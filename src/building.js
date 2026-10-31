import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WALL_H = 2.85;
const PANEL_W = 4;
const RAMP_RISE = 2.6;
const RAMP_LEN = 4.6;
const RAMP_ANGLE = Math.atan2(RAMP_RISE, RAMP_LEN);

const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d613a, roughness: 0.82, metalness: 0.04 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x5b3c26, roughness: 0.86, metalness: 0.05 });
const bracketMat = new THREE.MeshStandardMaterial({ color: 0x3a413d, roughness: 0.55, metalness: 0.45 });
const ghostMat = new THREE.MeshBasicMaterial({
  color: 0x84e89a, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide,
});
const ghostLineMat = new THREE.LineBasicMaterial({ color: 0xa2ffb7, transparent: true, opacity: 0.72 });

function boxGeo(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, 1, 1)));
  return geo;
}

function mergedMesh(geos, mat) {
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (const g of geos) g.dispose();
  return mesh;
}

function wallVisual() {
  const group = new THREE.Group();
  const wood = [
    boxGeo(PANEL_W, WALL_H, 0.16, 0, WALL_H / 2, 0),
  ];
  for (let i = -1; i <= 1; i++) wood.push(boxGeo(0.045, WALL_H - 0.18, 0.19, i * 1.25, WALL_H / 2, 0));
  const frame = [
    boxGeo(PANEL_W + 0.12, 0.16, 0.24, 0, 0.09, 0),
    boxGeo(PANEL_W + 0.12, 0.16, 0.24, 0, WALL_H - 0.09, 0),
    boxGeo(0.19, WALL_H, 0.25, -PANEL_W / 2, WALL_H / 2, 0),
    boxGeo(0.19, WALL_H, 0.25, PANEL_W / 2, WALL_H / 2, 0),
    boxGeo(0.13, WALL_H * 0.94, 0.27, 0, WALL_H / 2, 0.02, 0, 0, 0.52),
    boxGeo(0.13, WALL_H * 0.94, 0.27, 0, WALL_H / 2, -0.02, 0, 0, -0.52),
  ];
  group.add(mergedMesh(wood, woodMat));
  group.add(mergedMesh(frame, frameMat));
  const brackets = [
    boxGeo(0.32, 0.1, 0.3, -1.65, 0.52, 0),
    boxGeo(0.32, 0.1, 0.3, 1.65, 0.52, 0),
    boxGeo(0.32, 0.1, 0.3, -1.65, WALL_H - 0.38, 0),
    boxGeo(0.32, 0.1, 0.3, 1.65, WALL_H - 0.38, 0),
  ];
  group.add(mergedMesh(brackets, bracketMat));
  return group;
}

function floorVisual() {
  const group = new THREE.Group();
  const wood = [boxGeo(PANEL_W, 0.17, PANEL_W, 0, -0.085, 0)];
  for (let i = -1; i <= 1; i++) wood.push(boxGeo(0.04, 0.19, PANEL_W, i * 1.3, -0.08, 0));
  const frame = [
    boxGeo(PANEL_W + 0.1, 0.16, 0.2, 0, -0.2, -PANEL_W / 2),
    boxGeo(PANEL_W + 0.1, 0.16, 0.2, 0, -0.2, PANEL_W / 2),
    boxGeo(0.2, 0.16, PANEL_W, -PANEL_W / 2, -0.2, 0),
    boxGeo(0.2, 0.16, PANEL_W, PANEL_W / 2, -0.2, 0),
  ];
  group.add(mergedMesh(wood, woodMat));
  group.add(mergedMesh(frame, frameMat));
  return group;
}

function rampVisual() {
  const group = new THREE.Group();
  const board = boxGeo(PANEL_W, 0.18, RAMP_LEN, 0, RAMP_RISE / 2, 0, RAMP_ANGLE, 0, 0);
  const rails = [
    boxGeo(0.16, 0.38, RAMP_LEN, -PANEL_W / 2, RAMP_RISE / 2 + 0.18, 0, RAMP_ANGLE, 0, 0),
    boxGeo(0.16, 0.38, RAMP_LEN, PANEL_W / 2, RAMP_RISE / 2 + 0.18, 0, RAMP_ANGLE, 0, 0),
  ];
  const frame = [
    boxGeo(PANEL_W + 0.12, 0.14, 0.2, 0, 0.1, RAMP_LEN / 2 - 0.05, 0, 0, 0),
    boxGeo(PANEL_W + 0.12, 0.14, 0.2, 0, RAMP_RISE + 0.1, -RAMP_LEN / 2 + 0.05, 0, 0, 0),
  ];
  group.add(mergedMesh([board, ...rails], woodMat));
  group.add(mergedMesh(frame, frameMat));
  return group;
}

export function createBuildGhost(type) {
  const group = new THREE.Group();
  let geo;
  if (type === 'wall') geo = new THREE.BoxGeometry(PANEL_W, WALL_H, 0.18).translate(0, WALL_H / 2, 0);
  else if (type === 'floor') geo = new THREE.BoxGeometry(PANEL_W, 0.18, PANEL_W).translate(0, -0.09, 0);
  else geo = new THREE.BoxGeometry(PANEL_W, 0.18, RAMP_LEN).rotateX(RAMP_ANGLE).translate(0, RAMP_RISE / 2, 0);
  const mesh = new THREE.Mesh(geo, ghostMat.clone());
  mesh.renderOrder = 5;
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostLineMat.clone());
  lines.renderOrder = 6;
  group.add(mesh);
  group.add(lines);
  group.userData.mat = mesh.material;
  group.userData.lineMat = lines.material;
  group.userData.mesh = mesh;
  return group;
}

export function setBuildGhostValid(group, valid) {
  const color = valid ? 0x8af0a0 : 0xef5a4e;
  group.userData.mat.color.setHex(color);
  group.userData.lineMat.color.setHex(valid ? 0xb4ffc4 : 0xff9b91);
  group.userData.mat.opacity = valid ? 0.16 : 0.2;
}

export function placeBuildPiece(world, type, x, z, baseY, ry) {
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = ry;

  if (type === 'wall') {
    group.add(wallVisual());
    const swapped = Math.abs(Math.sin(ry)) > 0.5;
    const w = swapped ? 0.26 : PANEL_W;
    const d = swapped ? PANEL_W : 0.26;
    world.addCollider(x, baseY + WALL_H / 2, z, w, WALL_H, d);
  } else if (type === 'floor') {
    group.add(floorVisual());
    world.addSurface({ type: 'floor', x, z, ry, w: PANEL_W, d: PANEL_W, y: baseY });
  } else {
    group.add(rampVisual());
    world.addSurface({ type: 'ramp', x, z, ry, w: PANEL_W, d: RAMP_LEN, y: baseY, rise: RAMP_RISE });
  }

  world.dynamicGroup.add(group);
  const piece = { type, x, z, y: baseY, ry, group };
  world.builtPieces.push(piece);
  return piece;
}

export const BUILD_COST = 10;
export const BUILD_MATERIALS = 150;
export const BUILD_WALL_HEIGHT = WALL_H;
export const BUILD_RAMP_RISE = RAMP_RISE;
