import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function beam(world, mat, x1, y1, z1, x2, y2, z2, thickness = 0.14) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const length = Math.hypot(dx, dy, dz);
  const geo = new THREE.BoxGeometry(thickness, length, thickness);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2),
    quat,
    new THREE.Vector3(1, 1, 1),
  );
  world.batch(mat, geo, m);
}

function localToWorld(cx, cz, ry, lx, lz) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

function makeCrate(world, x, z, size = 1.1, ry = 0, site = null) {
  const y0 = world.terrainHeight(x, z);
  world.addBox('wood', size, size * 0.82, size, x, y0 + size * 0.41, z, ry);
  world.addBox('woodDark', size * 1.02, 0.07, size * 0.14, x, y0 + size * 0.82, z, ry);
  world.addBox('woodDark', size * 0.14, 0.07, size * 1.02, x, y0 + size * 0.82, z, ry);
  world.addCollider(x, y0 + size * 0.41, z, size, size * 0.82, size);
  if (site) world.addLootSpot(x + 1.1, z, site);
}

function makeBarrel(world, x, z, color = 'rust') {
  const y0 = world.terrainHeight(x, z);
  world.addCylinder(color, 0.44, 0.44, 1.15, 8, x, y0 + 0.575, z);
  world.addCylinder('metalDark', 0.46, 0.46, 0.07, 8, x, y0 + 0.9, z);
  world.addCylinder('metalDark', 0.46, 0.46, 0.07, 8, x, y0 + 0.28, z);
  world.addCollider(x, y0 + 0.575, z, 0.88, 1.15, 0.88);
}

function makeSandbags(world, x, z, ry, length = 4.2) {
  const y0 = world.terrainHeight(x, z);
  const c = Math.cos(ry), s = Math.sin(ry);
  const count = Math.max(2, Math.round(length / 0.95));
  for (let row = 0; row < 2; row++) {
    const offset = row % 2 ? 0.46 : 0;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5;
      const lx = t * length;
      const lz = offset;
      world.addBox('sandbag', 0.94, 0.42, 0.62, x + lx * c + lz * s, y0 + 0.21 + row * 0.4, z - lx * s + lz * c, ry);
    }
  }
  const w = Math.abs(c) > 0.5 ? length : 0.95;
  const d = Math.abs(c) > 0.5 ? 0.95 : length;
  world.addCollider(x, y0 + 0.42, z, w, 0.84, d);
}

function makeContainer(world, x, z, ry = 0, color = 'containerRed') {
  const y0 = world.terrainHeight(x, z);
  const w = 6.2, h = 2.62, d = 2.55;
  world.addBox(color, w, h, d, x, y0 + h / 2, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < 7; i++) {
    const lx = -w / 2 + 0.35 + i * ((w - 0.7) / 6);
    for (const lz of [-d / 2 - 0.03, d / 2 + 0.03]) {
      world.addBox('metalDark', 0.1, h * 0.92, 0.08, x + lx * c + lz * s, y0 + h / 2, z - lx * s + lz * c, ry);
    }
  }
  for (const lz of [-d / 2 - 0.04, d / 2 + 0.04]) {
    world.addBox('rust', w, 0.12, 0.12, x + lz * s, y0 + 0.08, z + lz * c, ry);
    world.addBox('rust', w, 0.12, 0.12, x + lz * s, y0 + h - 0.08, z + lz * c, ry);
  }
  world.addBox('metalDark', 0.18, h * 0.8, 0.16, x - (w / 2) * c, y0 + h / 2, z + (w / 2) * s, ry);
  const cw = Math.abs(c) > 0.5 ? w : d;
  const cd = Math.abs(c) > 0.5 ? d : w;
  world.addCollider(x, y0 + h / 2, z, cw, h, cd);
  world.addLootSpot(x + Math.cos(ry + Math.PI / 2) * 2.2, z - Math.sin(ry + Math.PI / 2) * 2.2, null);
}

function doorSideGeometry(side, x, z, w, d, doorW, doorH, h, y0, wallMat, trimMat, awningMat) {
  const t = 0.28;
  const alongX = side === 'north' || side === 'south';
  const len = alongX ? w : d;
  const off = alongX ? (side === 'south' ? d / 2 : -d / 2) : (side === 'east' ? w / 2 : -w / 2);
  const seg = Math.max(0, (len - doorW) / 2);
  const axisOffset = (doorW / 2 + seg / 2);

  const piece = (place, width, height, cy) => {
    if (width <= 0.04) return;
    if (alongX) {
      worldBox(worldRef, wallMat, width, height, t, x + place, cy, z + off);
    } else {
      worldBox(worldRef, wallMat, t, height, width, x + off, cy, z + place);
    }
  };
  const worldRef = currentWorld;
  if (seg > 0.18) {
    piece(-axisOffset, seg, h, y0 + h / 2);
    piece(axisOffset, seg, h, y0 + h / 2);
    if (alongX) {
      currentWorld.addCollider(x - axisOffset, y0 + h / 2, z + off, seg, h, t);
      currentWorld.addCollider(x + axisOffset, y0 + h / 2, z + off, seg, h, t);
    } else {
      currentWorld.addCollider(x + off, y0 + h / 2, z - axisOffset, t, h, seg);
      currentWorld.addCollider(x + off, y0 + h / 2, z + axisOffset, t, h, seg);
    }
  }
  const lintelH = h - doorH;
  if (lintelH > 0.1) {
    if (alongX) worldBox(worldRef, wallMat, doorW, lintelH, t, x, y0 + doorH + lintelH / 2, z + off);
    else worldBox(worldRef, wallMat, t, lintelH, doorW, x + off, y0 + doorH + lintelH / 2, z);
  }

  const postT = 0.13;
  if (alongX) {
    worldBox(worldRef, trimMat, postT, doorH, t + 0.12, x - doorW / 2, y0 + doorH / 2, z + off);
    worldBox(worldRef, trimMat, postT, doorH, t + 0.12, x + doorW / 2, y0 + doorH / 2, z + off);
    worldBox(worldRef, trimMat, doorW + 0.3, 0.14, t + 0.14, x, y0 + doorH, z + off);
  } else {
    worldBox(worldRef, trimMat, t + 0.12, doorH, postT, x + off, y0 + doorH / 2, z - doorW / 2);
    worldBox(worldRef, trimMat, t + 0.12, doorH, postT, x + off, y0 + doorH / 2, z + doorW / 2);
    worldBox(worldRef, trimMat, t + 0.14, 0.14, doorW + 0.3, x + off, y0 + doorH, z);
  }

  const outward = alongX ? (side === 'south' ? 1 : -1) : (side === 'east' ? 1 : -1);
  if (alongX) {
    worldBox(worldRef, awningMat, doorW + 1.1, 0.12, 1.15, x, y0 + doorH + 0.2, z + off + outward * 0.56);
    worldBox(worldRef, trimMat, doorW + 1.0, 0.12, 0.12, x, y0 + doorH + 0.42, z + off + outward * 1.06);
  } else {
    worldBox(worldRef, awningMat, 1.15, 0.12, doorW + 1.1, x + off + outward * 0.56, y0 + doorH + 0.2, z);
    worldBox(worldRef, trimMat, 0.12, 0.12, doorW + 1.0, x + off + outward * 1.06, y0 + doorH + 0.42, z);
  }
  worldBox(worldRef, 'concreteDark', alongX ? doorW + 0.7 : 1.0, 0.16, alongX ? 1.0 : doorW + 0.7,
    x + (alongX ? 0 : outward * 0.45), y0 + 0.08, z + (alongX ? outward * 0.45 : 0));
}

let currentWorld = null;
function worldBox(world, mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  world.addBox(mat, w, h, d, x, y, z, ry, rx, rz);
}

function makeBuilding(world, opts) {
  const {
    x, z, w, d, h = 3.3, door = 'south', doorWidth = 2.05, doorHeight = 2.35,
    roof = 'gable', wall = 'plaster', roofMat = 'roof', windows = true,
    site = null, ruined = false, trim = 'trim', bigDoor = false,
  } = opts;
  currentWorld = world;
  const y0 = world.terrainHeight(x, z);
  const t = 0.28;

  world.addBox('concreteDark', w + 0.35, 0.12, d + 0.35, x, y0 + 0.02, z);

  const sides = {
    north: { alongX: true, off: -d / 2, len: w },
    south: { alongX: true, off: d / 2, len: w },
    west: { alongX: false, off: -w / 2, len: d },
    east: { alongX: false, off: w / 2, len: d },
  };

  for (const [side, s] of Object.entries(sides)) {
    if (ruined && (side === 'north' || side === 'east') && Math.sin(x * 0.7 + z * 0.3 + side.length) > 0.1) continue;
    if (side === door) {
      const dw = Math.min(bigDoor ? 3.8 : doorWidth, s.len - 1.2);
      doorSideGeometry(side, x, z, w, d, dw, bigDoor ? Math.min(doorHeight + 0.6, h - 0.2) : doorHeight, h, y0, wall, trim, roofMat);
      continue;
    }

    if (s.alongX) {
      world.addBox(wall, s.len, h, t, x, y0 + h / 2, z + s.off);
      world.addCollider(x, y0 + h / 2, z + s.off, s.len, h, t);
    } else {
      world.addBox(wall, t, h, s.len, x + s.off, y0 + h / 2, z);
      world.addCollider(x + s.off, y0 + h / 2, z, t, h, s.len);
    }

    if (windows && !ruined) {
      const count = s.len > 8 ? 2 : 1;
      const positions = count === 2 ? [-s.len * 0.26, s.len * 0.26] : [0];
      const outward = s.alongX ? (side === 'north' ? -1 : 1) : (side === 'east' ? 1 : -1);
      for (const pos of positions) {
        const wx = s.alongX ? x + pos : x + s.off + outward * (t / 2 + 0.035);
        const wz = s.alongX ? z + s.off + outward * (t / 2 + 0.035) : z + pos;
        if (s.alongX) {
          world.addBox(trim, 1.55, 1.22, 0.09, wx, y0 + 1.62, wz);
          world.addBox('glass', 1.2, 0.88, 0.11, wx, y0 + 1.62, wz + outward * 0.02);
          world.addBox(trim, 0.07, 0.98, 0.1, wx, y0 + 1.62, wz + outward * 0.04);
        } else {
          world.addBox(trim, 0.09, 1.22, 1.55, wx, y0 + 1.62, wz);
          world.addBox('glass', 0.11, 0.88, 1.2, wx + outward * 0.02, y0 + 1.62, wz);
          world.addBox(trim, 0.1, 0.98, 0.07, wx + outward * 0.04, y0 + 1.62, wz);
        }
      }
    }
  }

  if (!ruined) {
    if (roof === 'gable') {
      const rise = Math.min(2.5, w * 0.22);
      const half = d / 2 + 0.48;
      const slope = Math.hypot(half, rise);
      const angle = Math.atan2(rise, half);
      world.addBox(roofMat, w + 0.9, 0.24, slope, x, y0 + h + rise / 2, z - (d / 4 + 0.24), 0, -angle, 0);
      world.addBox(roofMat, w + 0.9, 0.24, slope, x, y0 + h + rise / 2, z + (d / 4 + 0.24), 0, angle, 0);
      world.addBox('woodDark', w + 1.0, 0.17, 0.28, x, y0 + h + rise + 0.03, z);
      const gableMat = wall === 'wood' ? 'gableWood' : 'gable';
      world.addTriangle(gableMat, [
        [x - w / 2, y0 + h, z - d / 2], [x - w / 2, y0 + h, z + d / 2], [x - w / 2, y0 + h + rise, z],
      ]);
      world.addTriangle(gableMat, [
        [x + w / 2, y0 + h, z + d / 2], [x + w / 2, y0 + h, z - d / 2], [x + w / 2, y0 + h + rise, z],
      ]);
    } else {
      world.addBox(roofMat, w + 0.8, 0.26, d + 0.8, x, y0 + h + 0.13, z);
      world.addBox(wall, w + 0.9, 0.5, 0.18, x, y0 + h + 0.42, z - d / 2 - 0.4);
      world.addBox(wall, w + 0.9, 0.5, 0.18, x, y0 + h + 0.42, z + d / 2 + 0.4);
      world.addBox(wall, 0.18, 0.5, d + 0.9, x - w / 2 - 0.4, y0 + h + 0.42, z);
      world.addBox(wall, 0.18, 0.5, d + 0.9, x + w / 2 + 0.4, y0 + h + 0.42, z);
      if (w > 9) {
        world.addBox('metalDark', 1.8, 1.1, 1.2, x + w * 0.22, y0 + h + 0.7, z - d * 0.16);
        world.addBox('metalDark', 1.2, 0.8, 1.4, x - w * 0.28, y0 + h + 0.55, z + d * 0.18);
      }
    }
  } else {
    world.addBox('concreteDark', 1.8, 0.55, 1.2, x - w * 0.2, y0 + 0.28, z + d * 0.18, 0.4);
    world.addBox('woodDark', 1.4, 0.25, 0.3, x + w * 0.15, y0 + 0.15, z - d * 0.1, -0.7);
  }

  if (!ruined) {
    if (w > 8 && d > 7) {
      makeCrate(world, x - w * 0.26, z + d * 0.18, 0.95, 0.2);
      makeCrate(world, x + w * 0.25, z + d * 0.2, 0.78, -0.3);
    }
    if (w > 10) {
      world.addBox('wood', 2.8, 0.16, 0.85, x, y0 + 1.02, z - d * 0.24);
      world.addBox('woodDark', 0.2, 0.9, 0.75, x - 1.22, y0 + 0.52, z - d * 0.24);
      world.addBox('woodDark', 0.2, 0.9, 0.75, x + 1.22, y0 + 0.52, z - d * 0.24);
      world.addCollider(x, y0 + 0.55, z - d * 0.24, 2.9, 1.1, 0.9);
    }
    world.addBox('metal', 0.55, 0.06, 0.55, x + w * 0.2, y0 + h, z - d * 0.1);
  }

  if (site) {
    const spots = [
      [x - w * 0.22, z - d * 0.2],
      [x + w * 0.2, z + d * 0.22],
      [x, z - d * 0.05],
    ];
    world.addLootSpot(spots[0][0], spots[0][1], site);
    world.addLootSpot(spots[1][0], spots[1][1], site);
    if (w > 8) world.addLootSpot(spots[2][0], spots[2][1], site);
  }

  world.buildings.push({ x, z, w, d, h, y0, site: site?.name });
  return { x, z, w, d, h, y0 };
}

function makeWatchtower(world, x, z) {
  const y0 = world.terrainHeight(x, z);
  const legY = y0 + 3.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    world.addBox('woodDark', 0.26, 6.2, 0.26, x + sx * 1.75, legY, z + sz * 1.75);
    world.addCollider(x + sx * 1.75, legY, z + sz * 1.75, 0.3, 6.2, 0.3);
  }
  for (const cy of [y0 + 1.4, y0 + 3.4]) {
    world.addBox('woodDark', 3.5, 0.14, 0.14, x, cy, z - 1.75);
    world.addBox('woodDark', 3.5, 0.14, 0.14, x, cy, z + 1.75);
    world.addBox('woodDark', 0.14, 0.14, 3.5, x - 1.75, cy, z);
    world.addBox('woodDark', 0.14, 0.14, 3.5, x + 1.75, cy, z);
  }
  world.addBox('wood', 4.2, 0.3, 4.2, x, y0 + 6.3, z);
  world.addCollider(x, y0 + 6.3, z, 4.2, 0.35, 4.2);
  for (const [sx, sz, ww, dd] of [[0, -2.05, 4.2, 0.12], [0, 2.05, 4.2, 0.12], [-2.05, 0, 0.12, 4.2], [2.05, 0, 0.12, 4.2]]) {
    world.addBox('woodDark', ww, 0.9, dd, x + sx, y0 + 6.9, z + sz);
  }
  world.addBox('roofMetal', 4.9, 0.16, 4.9, x, y0 + 8.1, z);
  for (const [sx, sz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
    world.addBox('woodDark', 0.15, 1.7, 0.15, x + sx, y0 + 7.2, z + sz);
  }
  world.addLootSpot(x + 1.2, z - 1.1, null);
}

function makeSilo(world, x, z) {
  const y0 = world.terrainHeight(x, z);
  world.addCylinder('metal', 2.9, 2.9, 8.6, 14, x, y0 + 4.3, z);
  world.addCylinder('metalDark', 3.05, 2.95, 0.5, 14, x, y0 + 8.55, z);
  const dome = new THREE.SphereGeometry(2.9, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + 8.7, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  world.batch('metal', dome, m);
  world.addCollider(x, y0 + 4.3, z, 5.8, 8.6, 5.8);
  for (let i = 0; i < 8; i++) {
    world.addBox('metalDark', 0.9, 0.08, 0.3, x + 2.95, y0 + 1 + i * 0.9, z + 0.5, 0, 0, 0);
  }
}

function makeRadioTower(world, x, z) {
  const y0 = world.terrainHeight(x, z);
  const height = 27;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    beam(world, 'metalDark', x + sx * 2.4, y0, z + sz * 2.4, x + sx * 0.55, y0 + height, z + sz * 0.55, 0.18);
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const r = 2.4 + (0.55 - 2.4) * t;
    const y = y0 + height * t;
    beam(world, 'metalDark', x - r, y, z - r, x + r, y, z - r, 0.09);
    beam(world, 'metalDark', x - r, y, z + r, x + r, y, z + r, 0.09);
    beam(world, 'metalDark', x - r, y, z - r, x - r, y, z + r, 0.09);
    beam(world, 'metalDark', x + r, y, z - r, x + r, y, z + r, 0.09);
    beam(world, 'metalDark', x - r, y, z - r, x + r, y, z + r, 0.07);
  }
  world.addCylinder('metalDark', 0.12, 0.16, 6, 6, x, y0 + height + 3, z);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3b2e, emissive: 0xff2418, emissiveIntensity: 0.5, roughness: 0.4 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), beaconMat);
  beacon.position.set(x, y0 + height + 6.1, z);
  world.dynamicGroup.add(beacon);
  world.beacon = beacon;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    world.addBox('concrete', 0.65, 0.4, 0.65, x + sx * 2.4, y0 + 0.2, z + sz * 2.4);
    world.addCollider(x + sx * 2.4, y0 + 0.4, z + sz * 2.4, 0.7, 0.8, 0.7);
  }
  world.addLootSpot(x + 3.2, z + 2.5, null);
}

function makeFenceLine(world, x1, z1, x2, z2, gap = false, gapSize = 5) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return;
  const ux = dx / len, uz = dz / len;
  const horizontal = Math.abs(ux) > Math.abs(uz);
  const segments = gap ? [[0, (len - gapSize) / 2 / len], [(len + gapSize) / 2 / len, 1]] : [[0, 1]];
  for (const [a, b] of segments) {
    if (b - a < 0.04) continue;
    const sx = x1 + dx * a, sz = z1 + dz * a;
    const ex = x1 + dx * b, ez = z1 + dz * b;
    const sl = Math.hypot(ex - sx, ez - sz);
    const mx = (sx + ex) / 2, mz = (sz + ez) / 2;
    const y0 = world.terrainHeight(mx, mz);
    world.addBox('woodDark', horizontal ? sl : 0.12, 0.12, horizontal ? 0.12 : sl, mx, y0 + 0.52, mz);
    world.addBox('woodDark', horizontal ? sl : 0.12, 0.12, horizontal ? 0.12 : sl, mx, y0 + 1.0, mz);
    const posts = Math.max(2, Math.round(sl / 3.1));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      world.addBox('woodDark', 0.18, 1.45, 0.18, sx + (ex - sx) * t, world.terrainHeight(sx + (ex - sx) * t, sz + (ez - sz) * t) + 0.72, sz + (ez - sz) * t);
    }
    world.addCollider(mx, y0 + 0.7, mz, horizontal ? sl : 0.2, 1.35, horizontal ? 0.2 : sl);
  }
}

function makeHayBale(world, x, z, ry = 0) {
  const y0 = world.terrainHeight(x, z);
  world.addCylinder('hay', 1.0, 1.0, 1.8, 10, x, y0 + 1.0, z, Math.PI / 2, ry, 0);
  world.addCollider(x, y0 + 1.0, z, 2.0, 2.0, 1.8);
}

function makeShed(world, x, z, w = 7, d = 5.5, h = 3, site = null, door = 'south', wall = 'wood') {
  return makeBuilding(world, { x, z, w, d, h, door, doorWidth: 1.9, wall, roof: 'flat', roofMat: 'roofMetal', site, trim: 'woodDark' });
}

function makeRuinWall(world, x, z, len, h, ry = 0, mat = 'plasterCool') {
  const y0 = world.terrainHeight(x, z);
  world.addBox(mat, len, h, 0.42, x, y0 + h / 2, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  world.addCollider(x, y0 + h / 2, z, Math.abs(c) > 0.5 ? len : 0.42, h, Math.abs(c) > 0.5 ? 0.42 : len);
  for (let i = 0; i < 3; i++) {
    const lx = -len / 2 + 0.8 + i * (len - 1.6) / 2;
    world.addBox('concreteDark', 0.5, 0.25, 0.75, x + lx * c, y0 + 0.14, z - lx * s);
  }
}

export function buildStructures(world) {
  const site = name => world.sites.find(s => s.name === name);

  /* ---------------- PRISON ---------------- */
  {
    const s = site('PRISON');
    makeBuilding(world, { x: -96, z: 60, w: 23, d: 13, h: 5.4, door: 'south', bigDoor: true, doorWidth: 3.8, roof: 'flat', wall: 'plasterCool', roofMat: 'roofMetal', site: s });
    makeBuilding(world, { x: -72, z: 86, w: 17, d: 10, h: 4.9, door: 'south', bigDoor: true, roof: 'flat', wall: 'brick', roofMat: 'roofMetal', site: s });
    makeWatchtower(world, -120, 44);
    makeWatchtower(world, -72, 44);
    makeWatchtower(world, -120, 96);
    makeWatchtower(world, -72, 96);
    makeContainer(world, -118, 80, 0, 'containerBlue');
    makeContainer(world, -110, 91, Math.PI / 2, 'containerRed');
    makeContainer(world, -80, 48, Math.PI / 2, 'containerGreen');
    for (const [cx, cz, sz] of [[-88, 47, 1.2], [-84, 49, 0.9], [-110, 68, 1.1], [-66, 73, 1.0], [-83, 92, 1.2]]) makeCrate(world, cx, cz, sz, 0.3, s);
    for (const [bx, bz] of [[-107, 56], [-103, 58], [-64, 54], [-126, 68]]) makeBarrel(world, bx, bz);
    makeSandbags(world, -96, 72, 0, 5.4);
    makeSandbags(world, -82, 78, Math.PI / 2, 3.8);
    makeFenceLine(world, -124, 104, -64, 104, true, 6);
    world.addLootSpot(-90, 48, s);
    world.addLootSpot(-120, 64, s);
    world.addLootSpot(-64, 64, s);
  }

  /* ---------------- FARM ---------------- */
  {
    const s = site('FARM');
    makeBuilding(world, { x: 102, z: 58, w: 16, d: 11, h: 5.1, door: 'south', bigDoor: true, doorWidth: 3.4, roof: 'gable', wall: 'wood', roofMat: 'roof', site: s, trim: 'woodDark' });
    makeBuilding(world, { x: 121, z: 87, w: 9.5, d: 8, h: 3.5, door: 'south', roof: 'gable', wall: 'plasterWarm', roofMat: 'roof', site: s });
    makeSilo(world, 87, 87);
    makeHayBale(world, 88, 59, 0.2);
    makeHayBale(world, 87, 66, 1.4);
    makeHayBale(world, 92, 72, 0.7);
    makeHayBale(world, 98, 76, 2.1);
    makeFenceLine(world, 78, 44, 130, 44, true, 7);
    makeFenceLine(world, 78, 104, 130, 104, true, 7);
    makeFenceLine(world, 78, 44, 78, 104, true, 6);
    makeFenceLine(world, 130, 44, 130, 104, true, 6);
    for (const [cx, cz, sz] of [[113, 46, 1.1], [110, 49, 0.9], [72, 92, 1.2], [132, 91, 1.0]]) makeCrate(world, cx, cz, sz, -0.2, s);
    for (const [bx, bz] of [[96, 48], [100, 50], [129, 62], [117, 98]]) makeBarrel(world, bx, bz);
    makeSandbags(world, 104, 74, 0, 4.6);
    world.addLootSpot(82, 62, s);
    world.addLootSpot(122, 66, s);
    world.addLootSpot(108, 96, s);
  }

  /* ---------------- DOCKS ---------------- */
  {
    const s = site('DOCKS');
    makeBuilding(world, { x: -162, z: -84, w: 20, d: 11, h: 5.2, door: 'south', bigDoor: true, doorWidth: 3.9, roof: 'flat', wall: 'plasterCool', roofMat: 'roofMetal', site: s });
    makeShed(world, -181, -108, 7.5, 6, 3.1, s, 'east', 'brick');
    makeContainer(world, -142, -108, Math.PI / 2, 'containerRed');
    makeContainer(world, -136, -101, 0, 'containerBlue');
    makeContainer(world, -176, -66, 0, 'containerGreen');
    for (const [cx, cz, sz] of [[-149, -84, 1.2], [-146, -80, 0.9], [-184, -91, 1.1], [-158, -112, 1.0], [-148, -116, 1.2]]) makeCrate(world, cx, cz, sz, 0.4, s);
    for (const [bx, bz] of [[-171, -70], [-168, -73], [-130, -94], [-188, -100], [-154, -73]]) makeBarrel(world, bx, bz);
    makeSandbags(world, -162, -70, 0, 5.6);
    makeSandbags(world, -150, -90, Math.PI / 2, 4.2);
    makeWatchtower(world, -190, -78);
    world.addLootSpot(-140, -88, s);
    world.addLootSpot(-178, -96, s);
    world.addLootSpot(-126, -112, s);
  }

  /* ---------------- RADIO ---------------- */
  {
    const s = site('RADIO');
    makeRadioTower(world, 30, -124);
    makeShed(world, 50, -143, 8, 6, 3.2, s, 'south', 'plasterCool');
    makeShed(world, 13, -143, 6, 5, 2.8, s, 'east', 'wood');
    makeSandbags(world, 30, -116, 0, 4.8);
    makeSandbags(world, 24, -124, Math.PI / 2, 3.6);
    makeSandbags(world, 36, -124, Math.PI / 2, 3.6);
    for (const [cx, cz, sz] of [[44, -126, 1.2], [47, -130, 1.0], [16, -118, 1.1], [58, -138, 0.9]]) makeCrate(world, cx, cz, sz, 0.2, s);
    for (const [bx, bz] of [[22, -106], [39, -108], [62, -124]]) makeBarrel(world, bx, bz);
    world.addLootSpot(44, -149, s);
    world.addLootSpot(22, -148, s);
    world.addLootSpot(37, -112, s);
  }

  /* ---------------- VILLAGE ---------------- */
  {
    const s = site('VILLAGE');
    makeBuilding(world, { x: 114, z: -47, w: 9, d: 8, h: 3.4, door: 'east', roof: 'gable', wall: 'plasterWarm', roofMat: 'roof', site: s });
    makeBuilding(world, { x: 151, z: -46, w: 8.5, d: 7.5, h: 3.3, door: 'west', roof: 'gable', wall: 'brick', roofMat: 'roofDark', site: s });
    makeBuilding(world, { x: 114, z: -9, w: 8.5, d: 7.5, h: 3.3, door: 'east', roof: 'gable', wall: 'plaster', roofMat: 'roof', site: s });
    makeBuilding(world, { x: 151, z: -10, w: 9, d: 8, h: 3.5, door: 'west', roof: 'gable', wall: 'plasterWarm', roofMat: 'roofDark', site: s });
    makeBuilding(world, { x: 132, z: -28, w: 11, d: 8, h: 3.1, door: 'south', roof: 'flat', wall: 'plasterCool', roofMat: 'roofMetal', site: s });
    makeFenceLine(world, 106, -58, 162, -58, true, 8);
    makeFenceLine(world, 106, 2, 162, 2, true, 8);
    makeFenceLine(world, 103, -58, 103, 2, false);
    makeFenceLine(world, 165, -58, 165, 2, false);
    for (const [cx, cz, sz] of [[128, -42, 1.0], [139, -24, 1.1], [124, -17, 0.9], [145, -35, 1.2], [118, -58, 0.8]]) makeCrate(world, cx, cz, sz, 0.4, s);
    for (const [bx, bz] of [[107, -36], [103, -28], [158, -20], [158, -40], [133, -48]]) makeBarrel(world, bx, bz);
    makeSandbags(world, 132, -14, 0, 4.8);
    world.addLootSpot(100, -28, s);
    world.addLootSpot(164, -28, s);
    world.addLootSpot(132, -56, s);
  }

  /* ---------------- RUINS ---------------- */
  {
    const s = site('RUINS');
    makeBuilding(world, { x: -30, z: -18, w: 15, d: 11, h: 4.2, door: 'south', bigDoor: true, doorWidth: 3.2, roof: 'gable', wall: 'plasterCool', site: s, ruined: true, trim: 'woodDark' });
    makeRuinWall(world, -49, -8, 8, 2.2, 0.25);
    makeRuinWall(world, -49, -6, 6, 1.4, 1.15);
    makeRuinWall(world, -16, -30, 7, 2.6, 1.5);
    makeRuinWall(world, -36, -36, 10, 1.8, 0);
    makeContainer(world, -47, -27, 0.4, 'containerBlue');
    makeContainer(world, -17, -6, 1.2, 'containerRed');
    for (const [cx, cz, sz] of [[-22, -22, 1.2], [-36, -12, 1.0], [-44, -18, 0.9], [-24, -34, 1.1]]) makeCrate(world, cx, cz, sz, 0.3, s);
    for (const [bx, bz] of [[-14, -20], [-46, -12]]) makeBarrel(world, bx, bz);
    makeSandbags(world, -26, -4, 0, 4.4);
    makeSandbags(world, -40, -22, Math.PI / 2, 3.4);
    world.addLootSpot(-52, -32, s);
    world.addLootSpot(-12, -30, s);
    world.addLootSpot(-38, -16, s);
  }

  /* ---------------- QUARRY ---------------- */
  {
    const s = site('QUARRY');
    makeShed(world, 46, 34, 8, 6, 3.2, s, 'south', 'plasterCool');
    makeContainer(world, 30, 46, 0.2, 'containerRed');
    makeContainer(world, 60, 23, Math.PI / 2 + 0.1, 'containerGreen');
    makeSandbags(world, 48, 46, Math.PI / 2, 4.2);
    makeSandbags(world, 38, 28, 0, 3.8);
    for (const [cx, cz, sz] of [[35, 30, 1.2], [40, 32, 1.0], [55, 42, 1.1], [28, 38, 0.9], [62, 36, 1.2]]) makeCrate(world, cx, cz, sz, 0.2, s);
    for (const [bx, bz] of [[52, 22], [56, 26], [34, 50]]) makeBarrel(world, bx, bz);
    world.addLootSpot(25, 52, s);
    world.addLootSpot(64, 16, s);
    world.addLootSpot(40, 46, s);
  }

  /* ---------------- OUTLYING CAMPS ---------------- */
  {
    const cabins = [
      { x: 4, z: 134, w: 8, d: 7, h: 3.2, wall: 'plasterWarm' },
      { x: -74, z: -139, w: 7, d: 6, h: 3, wall: 'wood' },
      { x: 178, z: -78, w: 6.5, d: 5.5, h: 2.9, wall: 'plaster' },
      { x: -4, z: -64, w: 5.5, d: 4.5, h: 2.6, wall: 'wood' },
      { x: 186, z: 48, w: 7, d: 6, h: 3.1, wall: 'plasterWarm' },
    ];
    for (const c of cabins) {
      makeBuilding(world, { ...c, door: 'south', roof: 'gable', roofMat: 'roofDark', site: null });
      makeCrate(world, c.x + c.w * 0.8, c.z + 1.5, 0.9, 0.2, null);
      world.addLootSpot(c.x + 1.4, c.z + 0.4, null);
    }
  }

  /* ---------------- ROADSIDE PROPS ---------------- */
  for (const road of world.roadSegments) {
    const mx = (road.ax + road.bx) / 2;
    const mz = (road.az + road.bz) / 2;
    if (Math.abs(mx) < 190 && Math.abs(mz) < 190) {
      const px = mx + (world.rng() - 0.5) * 10;
      const pz = mz + (world.rng() - 0.5) * 10;
      makeBarrel(world, px, pz, 'rust');
    }
  }
}
