import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND_RADIUS, MAP_EXTENT, ROAD_LINKS, SITES, WORLD_SIZE } from './data.js';
import { buildStructures } from './structures.js';
import { populateLoot } from './loot.js';
import { createMapCanvas } from './map.js';
import { buildPickupModel, WEAPONS } from './weapons.js';

const UP_VEC = new THREE.Vector3(0, 1, 0);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const len2 = vx * vx + vz * vz || 1;
  let t = (wx * vx + wz * vz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function rayAabb(origin, dir, box, maxDist) {
  let tmin = 0, tmax = maxDist;
  for (let i = 0; i < 3; i++) {
    const axis = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
    const o = origin[axis], d = dir[axis];
    const min = box['min' + axis.toUpperCase()], max = box['max' + axis.toUpperCase()];
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
    } else {
      let t1 = (min - o) / d, t2 = (max - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function groundAtHeight(x, z, raw) {
  const d = Math.hypot(x, z);
  let h = raw;
  if (d > 206) h -= (d - 206) * 0.175;
  return Math.max(-3.4, h);
}

export class World {
  constructor(scene, seed = 20261031) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.staticGroup = new THREE.Group();
    this.root.add(this.staticGroup);
    this.propGroup = new THREE.Group();
    this.root.add(this.propGroup);
    this.dynamicGroup = new THREE.Group();
    this.root.add(this.dynamicGroup);

    this.colliders = [];
    this.surfaces = [];
    this.buildings = [];
    this.lootSpots = [];
    this.botSpawns = [];
    this.loot = [];
    this.clouds = [];
    this.batches = new Map();
    this.builtPieces = [];

    this.sites = SITES.map(site => {
      const s = { ...site };
      s.h = groundAtHeight(s.x, s.z, this.rawHeight(s.x, s.z));
      return s;
    });
    this.flatteners = this.sites;

    const byName = Object.fromEntries(this.sites.map(s => [s.name, s]));
    this.roadSegments = ROAD_LINKS.map(([a, b]) => ({
      ax: byName[a].x, az: byName[a].z, bx: byName[b].x, bz: byName[b].z,
    }));

    this.palette = {
      grassA: new THREE.Color('#5c7b45'),
      grassB: new THREE.Color('#7c9252'),
      grassC: new THREE.Color('#93a05c'),
      dry: new THREE.Color('#a6a06c'),
      sand: new THREE.Color('#cdb887'),
      wetSand: new THREE.Color('#9d8e68'),
      rock: new THREE.Color('#747768'),
      rockDark: new THREE.Color('#565b50'),
      dirt: new THREE.Color('#8d7c59'),
      road: new THREE.Color('#a08a61'),
      underwater: new THREE.Color('#5e6a5c'),
    };
    this.tmpColor = new THREE.Color();
    this.spreadColor = new THREE.Color();

    this.createMaterials();
    this.createEnvironment();
    this.createTerrain();
    this.createWater();
    this.createClouds();
    this.createPlane();

    buildStructures(this);
    this.finalizeStatic();
    this.createVegetation();
    populateLoot(this);
    this.mapCanvas = createMapCanvas(this);
    this.generateBotSpawns();

    this.time = 0;
    this.planeTime = -9;
    this.zoneRing = null;
  }

  rawHeight(x, z) {
    const d = Math.hypot(x, z);
    let h = 3.1;
    h += 5.4 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.019 - 0.3);
    h += 3.0 * Math.sin(x * 0.047 - 1.2) * Math.cos(z * 0.041 + 0.8);
    h += 1.1 * Math.sin((x + z) * 0.09);
    h += 9.2 * Math.exp(-(((x - 26) ** 2) + ((z + 86) ** 2)) / 4700);
    h += 6.4 * Math.exp(-(((x + 122) ** 2) + ((z - 92) ** 2)) / 5400);
    h += 4.2 * Math.exp(-(((x - 142) ** 2) + ((z - 32) ** 2)) / 4200);
    h += 3.2 * Math.exp(-(((x - 36) ** 2) + ((z - 42) ** 2)) / 2600);
    if (d > 206) h -= (d - 206) * 0.175;
    return Math.max(-3.4, h);
  }

  terrainHeight(x, z) {
    let h = this.rawHeight(x, z);
    for (const s of this.flatteners) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r) {
        const w = 1 - smoothstep(s.r * 0.56, s.r, d);
        h = h * (1 - w) + s.h * w;
      }
    }
    return h;
  }

  surfaceHeight(x, z, feetY) {
    let top = this.terrainHeight(x, z);
    const limit = feetY + 0.7;
    for (const s of this.surfaces) {
      if (!s) continue;
      const dx = x - s.x, dz = z - s.z;
      const c = Math.cos(-s.ry), sn = Math.sin(-s.ry);
      const lx = dx * c - dz * sn;
      const lz = dx * sn + dz * c;
      if (Math.abs(lx) > s.w / 2 || Math.abs(lz) > s.d / 2) continue;
      let y = s.y;
      if (s.type === 'ramp') y = s.y + (s.d / 2 - lz) / s.d * s.rise;
      if (y > top && y <= limit) top = y;
    }
    return top;
  }

  addCollider(cx, cy, cz, w, h, d) {
    this.colliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minY: cy - h / 2, maxY: cy + h / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  }

  addSurface(surface) {
    this.surfaces.push(surface);
  }

  createMaterials() {
    const mat = (color, options = {}) => new THREE.MeshStandardMaterial({
      color, roughness: 0.85, metalness: 0.05, ...options,
    });
    this.materials = {
      plaster: mat(0xc9bda2),
      plasterWarm: mat(0xd4c4a0),
      plasterCool: mat(0xb3b1a2),
      brick: mat(0x9b5e47),
      wood: mat(0x795538),
      woodDark: mat(0x4f3827),
      roof: mat(0x7d4233),
      roofDark: mat(0x583029),
      roofMetal: mat(0x64706a, { metalness: 0.35, roughness: 0.62 }),
      metal: mat(0x707b74, { metalness: 0.4, roughness: 0.55 }),
      metalDark: mat(0x414b47, { metalness: 0.35, roughness: 0.6 }),
      containerRed: mat(0xa14c3c, { metalness: 0.25, roughness: 0.65 }),
      containerBlue: mat(0x3d6873, { metalness: 0.25, roughness: 0.65 }),
      containerGreen: mat(0x5b7050, { metalness: 0.25, roughness: 0.65 }),
      concrete: mat(0x97968a, { roughness: 0.96 }),
      concreteDark: mat(0x71736a, { roughness: 0.98 }),
      glass: mat(0x20363b, { roughness: 0.24, metalness: 0.4, emissive: 0x091417, emissiveIntensity: 0.75 }),
      sandbag: mat(0x99895f),
      trim: mat(0xd8cdb4),
      rust: mat(0x8a5a3f, { metalness: 0.2, roughness: 0.8 }),
      gable: mat(0xc7b99b, { side: THREE.DoubleSide }),
      gableWood: mat(0x735034, { side: THREE.DoubleSide }),
      hay: mat(0xc6a85c),
      black: mat(0x181c19),
      white: mat(0xe7dfcc),
    };
  }

  batch(matKey, geometry, matrix) {
    const g = geometry;
    if (matrix) g.applyMatrix4(matrix);
    let list = this.batches.get(matKey);
    if (!list) { list = []; this.batches.set(matKey, list); }
    list.push(g);
  }

  addBox(matKey, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, 1, 1));
    this.batch(matKey, geo, m);
    return this;
  }

  addCylinder(matKey, rTop, rBottom, height, segments, x, y, z, rx = 0, ry = 0, rz = 0) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, 1, 1));
    this.batch(matKey, geo, m);
    return this;
  }

  addTriangle(matKey, points) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    geo.computeVertexNormals();
    this.batch(matKey, geo);
    return this;
  }

  addLootSpot(x, z, site) {
    this.lootSpots.push({ x, z, site });
    return this;
  }

  addSpawn(x, z) {
    this.botSpawns.push({ x, z });
  }

  finalizeStatic() {
    for (const [matKey, list] of this.batches) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.materials[matKey] || this.materials.plaster);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.staticGroup.add(mesh);
      for (const geo of list) geo.dispose();
    }
    this.batches.clear();
  }

  createEnvironment() {
    const hemi = new THREE.HemisphereLight(0xb9d6e8, 0x6c603e, 0.95);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xfff4df, 0.16);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffd2a0, 2.35);
    sun.position.set(80, 120, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = -68;
    sun.shadow.camera.right = 68;
    sun.shadow.camera.top = 68;
    sun.shadow.camera.bottom = -68;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    this.scene.fog = new THREE.Fog(0xd8c2a4, 128, 430);

    const skyGeo = new THREE.SphereGeometry(620, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        sunDir: { value: new THREE.Vector3(0.42, 0.55, 0.3).normalize() },
        topColor: { value: new THREE.Color('#537fa5') },
        horizonColor: { value: new THREE.Color('#e8c49d') },
        hazeColor: { value: new THREE.Color('#f5d9b4') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 sunDir;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 hazeColor;
        void main() {
          float h = normalize(vDir).y;
          vec3 col = mix(horizonColor, topColor, smoothstep(-0.03, 0.72, h));
          col = mix(hazeColor, col, smoothstep(-0.16, 0.06, h));
          float sunDot = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.78, 0.48) * pow(sunDot, 9.0) * 0.28;
          col += vec3(1.0, 0.92, 0.68) * pow(sunDot, 900.0) * 2.2;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  createTerrain() {
    const segments = 184;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const p = this.palette;
    const color = new THREE.Color();
    const rockColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.terrainHeight(x, z);
      pos.setY(i, h);

      const hx = this.terrainHeight(x + 1.7, z);
      const hz = this.terrainHeight(x, z + 1.7);
      const slope = (Math.abs(h - hx) + Math.abs(h - hz)) / 1.7;
      const n = Math.sin(x * 0.73 + z * 1.11) * 0.5 + 0.5;
      const n2 = Math.sin(x * 0.17 - z * 0.23) * 0.5 + 0.5;

      color.copy(p.grassA).lerp(p.grassB, n * 0.7 + n2 * 0.3);
      if (n2 > 0.67) color.lerp(p.grassC, 0.35);
      if (n < 0.32 && h > 1.8) color.lerp(p.dry, 0.25);

      if (h < -0.4) color.copy(p.underwater);
      else if (h < 0.9) color.copy(p.wetSand).lerp(p.sand, (h + 0.4) / 1.3);
      else if (h < 1.8) color.copy(p.sand).lerp(p.dry, 0.3);

      if (h > 1.5 && slope > 0.92) {
        rockColor.copy(p.rock).lerp(p.rockDark, Math.min(1, (slope - 0.9) * 0.7));
        color.lerp(rockColor, Math.min(0.86, (slope - 0.9) * 0.95));
      }

      let roadDist = 99;
      for (const s of this.roadSegments) {
        const d = distToSegment(x, z, s.ax, s.az, s.bx, s.bz);
        if (d < roadDist) roadDist = d;
      }
      if (roadDist < 7.2) {
        const w = 1 - smoothstep(3.7, 7.2, roadDist);
        color.lerp(p.road, w * 0.55);
      }

      for (const site of this.sites) {
        const d = Math.hypot(x - site.x, z - site.z);
        if (d < site.r * 0.82) {
          const w = 1 - smoothstep(site.r * 0.35, site.r * 0.82, d);
          color.lerp(p.dirt, w * 0.28);
        }
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.97, metalness: 0.0, flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.terrain = mesh;
    this.root.add(mesh);
  }

  createWater() {
    const geo = new THREE.CircleGeometry(720, 72);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f7281, roughness: 0.26, metalness: 0.32,
      transparent: true, opacity: 0.92,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = -1.35;
    water.receiveShadow = false;
    this.water = water;
    this.root.add(water);

    const deepGeo = new THREE.CircleGeometry(760, 48);
    deepGeo.rotateX(-Math.PI / 2);
    const deep = new THREE.Mesh(deepGeo, new THREE.MeshBasicMaterial({ color: 0x194a56 }));
    deep.position.y = -2.2;
    this.root.add(deep);
  }

  createClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xfff4df, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
    });
    const blob = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 11; i++) {
      const group = new THREE.Group();
      const count = 3 + Math.floor(this.rng() * 4);
      for (let j = 0; j < count; j++) {
        const mesh = new THREE.Mesh(blob, cloudMat);
        const s = 8 + this.rng() * 13;
        mesh.scale.set(s, s * (0.32 + this.rng() * 0.2), s * (0.7 + this.rng() * 0.5));
        mesh.position.set((this.rng() - 0.5) * 38, (this.rng() - 0.5) * 5, (this.rng() - 0.5) * 18);
        group.add(mesh);
      }
      const angle = this.rng() * Math.PI * 2;
      const dist = 100 + this.rng() * 310;
      group.position.set(Math.cos(angle) * dist, 82 + this.rng() * 38, Math.sin(angle) * dist);
      group.userData.speed = 0.5 + this.rng() * 0.8;
      this.clouds.push(group);
      this.root.add(group);
    }
  }

  createPlane() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6e765f, roughness: 0.66, metalness: 0.18 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x56604f, roughness: 0.7, metalness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b332f, roughness: 0.7 });
    const add = (geo, mat, x, y, z) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(13, 2.1, 2.2), bodyMat, 0, 0, 0);
    add(new THREE.BoxGeometry(3.4, 1.4, 1.9), bodyMat, 6.4, -0.2, 0);
    add(new THREE.BoxGeometry(2.2, 0.5, 18), wingMat, -0.4, 0.35, 0);
    add(new THREE.BoxGeometry(2.6, 0.45, 7), wingMat, -5.7, 0.55, 0);
    add(new THREE.BoxGeometry(0.4, 2.2, 5), wingMat, -6.5, 1.1, 0);
    add(new THREE.BoxGeometry(0.5, 0.28, 15), darkMat, -0.4, 0.65, 0);
    const props = [];
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 8).rotateZ(Math.PI / 2), darkMat, 0.4, -0.1, side * 5.7);
      const prop = add(new THREE.BoxGeometry(0.1, 2.6, 0.24), darkMat, 1.7, -0.1, side * 5.7);
      props.push(prop);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff4030 }));
    beacon.position.set(-2, 1.4, 0);
    group.add(beacon);
    group.position.set(-420, 152, 40);
    group.scale.setScalar(1.1);
    this.plane = { group, props, beacon };
    this.root.add(group);
  }

  generateBotSpawns() {
    for (const site of this.sites) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + this.rng() * 0.5;
        const r = site.r * (0.62 + this.rng() * 0.3);
        const x = site.x + Math.cos(a) * r;
        const z = site.z + Math.sin(a) * r;
        if (this.terrainHeight(x, z) > 0.6) this.addSpawn(x, z);
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 28 + this.rng() * 175;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.terrainHeight(x, z) > 0.8) this.addSpawn(x, z);
    }
  }

  placeLoot(type, weaponId, x, z, yOverride) {
    const group = buildPickupModel(type, weaponId);
    const baseY = yOverride ?? this.terrainHeight(x, z);
    group.position.set(x, baseY + 0.02, z);
    group.rotation.y = this.rng() * Math.PI * 2;
    this.root.add(group);
    const weapon = weaponId ? WEAPONS[weaponId] : null;
    const item = {
      type, weaponId, group, baseY, x, z,
      phase: this.rng() * Math.PI * 2,
      taken: false,
      label: type === 'weapon' ? weapon?.name || 'WEAPON' : type === 'ammo' ? 'AMMUNITION' : type === 'med' ? 'FIELD MEDKIT' : 'BALLISTIC PLATE',
      detail: type === 'weapon' ? weapon?.typeLabel || '' : type === 'ammo' ? 'RESERVE AMMO' : type === 'med' ? '+45 HEALTH' : '+50 ARMOR',
    };
    this.loot.push(item);
    return item;
  }

  removeLoot(item) {
    if (!item || item.taken) return;
    item.taken = true;
    item.group.visible = false;
  }

  nearestLoot(pos, radius = 2.2) {
    let best = null;
    let bestD = radius * radius;
    for (const item of this.loot) {
      if (item.taken) continue;
      const dx = pos.x - item.group.position.x;
      const dz = pos.z - item.group.position.z;
      const dy = pos.y - item.group.position.y;
      const d = dx * dx + dz * dz + dy * dy * 0.6;
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }

  nearestSite(x, z) {
    let best = null, bestD = Infinity;
    for (const s of this.sites) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return { site: best, distance: bestD };
  }

  worldToMap(x, z, size) {
    const s = size / (MAP_EXTENT * 2);
    return [size * 0.5 + x * s, size * 0.5 + z * s];
  }

  raycastStatic(origin, dir, maxDist) {
    let best = null;
    for (const box of this.colliders) {
      const t = rayAabb(origin, dir, box, maxDist);
      if (t !== null && t >= 0 && t < maxDist && (!best || t < best.distance)) {
        best = { distance: t, box };
      }
    }
    if (best) {
      best.point = {
        x: origin.x + dir.x * best.distance,
        y: origin.y + dir.y * best.distance,
        z: origin.z + dir.z * best.distance,
      };
      return best;
    }
    return null;
  }

  raycast(origin, dir, maxDist = 300) {
    const staticHit = this.raycastStatic(origin, dir, maxDist);
    let best = staticHit || null;
    let terrainHit = null;
    const step = 2.2;
    for (let t = 0.5; t < maxDist; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      const h = this.terrainHeight(x, z);
      if (y <= h) {
        terrainHit = {
          distance: t,
          point: { x, y: h, z },
          kind: 'terrain',
        };
        break;
      }
    }
    if (terrainHit && (!best || terrainHit.distance < best.distance)) best = terrainHit;
    return best;
  }

  lineBlocked(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return false;
    const dir = { x: dx / len, y: dy / len, z: dz / len };
    const hit = this.raycastStatic(a, dir, len * 0.96);
    if (hit) return true;
    const steps = Math.max(3, Math.ceil(len / 9));
    for (let i = 1; i < steps; i++) {
      const t = (i / steps) * len;
      const y = a.y + dy * (i / steps);
      if (y < this.terrainHeight(a.x + dx * (i / steps), a.z + dz * (i / steps)) + 0.12) return true;
    }
    return false;
  }

  resolveCircle(pos, radius, height = 1.8) {
    const feet = pos.y;
    const head = pos.y + height;
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const box of this.colliders) {
        if (head < box.minY + 0.08 || feet > box.maxY - 0.08) continue;
        const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
        const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius) continue;
        if (d2 > 0.000001) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          const toLeft = pos.x - box.minX;
          const toRight = box.maxX - pos.x;
          const toBack = pos.z - box.minZ;
          const toFront = box.maxZ - pos.z;
          const min = Math.min(toLeft, toRight, toBack, toFront);
          if (min === toLeft) pos.x = box.minX - radius;
          else if (min === toRight) pos.x = box.maxX + radius;
          else if (min === toBack) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
      }
    }
    const d = Math.hypot(pos.x, pos.z);
    if (d > ISLAND_RADIUS - 2) {
      const s = (ISLAND_RADIUS - 2) / d;
      pos.x *= s;
      pos.z *= s;
    }
    return pos;
  }

  createVegetation() {
    const rng = this.rng;
    const inSite = (x, z, pad = 4) => this.sites.some(s => Math.hypot(x - s.x, z - s.z) < s.r + pad);
    const nearRoad = (x, z, pad = 4) => this.roadSegments.some(s => distToSegment(x, z, s.ax, s.az, s.bx, s.bz) < pad);

    const pineFoliage = mergeGeometries([
      new THREE.ConeGeometry(1.95, 3.1, 7).translate(0, 2.9, 0),
      new THREE.ConeGeometry(1.48, 2.7, 7).translate(0, 4.55, 0),
      new THREE.ConeGeometry(0.92, 2.2, 7).translate(0, 6.05, 0),
    ], false);
    const broadFoliage = mergeGeometries([
      new THREE.IcosahedronGeometry(2.35, 0).scale(1, 0.85, 1).translate(0, 4.15, 0),
      new THREE.IcosahedronGeometry(1.55, 0).translate(1.45, 3.55, 0.45),
      new THREE.IcosahedronGeometry(1.35, 0).translate(-1.15, 3.8, -0.6),
    ], false);
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2.9, 5);
    trunkGeo.translate(0, 1.45, 0);

    const treeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

    const trees = [];
    for (let attempts = 0; attempts < 2600 && trees.length < 310; attempts++) {
      const x = (rng() * 2 - 1) * 218;
      const z = (rng() * 2 - 1) * 218;
      const h = this.terrainHeight(x, z);
      if (h < 1.2) continue;
      if (Math.hypot(x, z) > 220) continue;
      if (inSite(x, z, 5)) continue;
      if (nearRoad(x, z, 3.5)) continue;
      const pine = rng() < 0.58;
      const scale = 0.72 + rng() * 0.72;
      trees.push({ x, z, y: h, scale, pine, rot: rng() * Math.PI * 2, tint: rng() });
    }

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const pineList = trees.filter(t => t.pine);
    const broadList = trees.filter(t => !t.pine);
    const pineMesh = new THREE.InstancedMesh(pineFoliage, treeMat, pineList.length);
    const broadMesh = new THREE.InstancedMesh(broadFoliage, treeMat, broadList.length);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();

    trees.forEach((t, i) => {
      quat.setFromAxisAngle(UP_VEC, t.rot);
      matrix.compose(
        new THREE.Vector3(t.x, t.y, t.z), quat,
        new THREE.Vector3(t.scale, t.scale * (0.92 + (i % 5) * 0.035), t.scale),
      );
      trunkMesh.setMatrixAt(i, matrix);
      color.setHex(i % 3 === 0 ? 0x5b4630 : i % 3 === 1 ? 0x6a513a : 0x4c3a29);
      trunkMesh.setColorAt(i, color);
      this.addCollider(t.x, t.y + 1.4 * t.scale, t.z, 0.55 * t.scale, 2.8 * t.scale, 0.55 * t.scale);
    });
    pineList.forEach((t, i) => {
      quat.setFromAxisAngle(UP_VEC, t.rot);
      matrix.compose(new THREE.Vector3(t.x, t.y, t.z), quat, new THREE.Vector3(t.scale, t.scale, t.scale));
      pineMesh.setMatrixAt(i, matrix);
      color.setHex(t.tint > 0.55 ? 0x42663c : t.tint > 0.2 ? 0x4b7042 : 0x365b35);
      pineMesh.setColorAt(i, color);
    });
    broadList.forEach((t, i) => {
      quat.setFromAxisAngle(UP_VEC, t.rot);
      matrix.compose(new THREE.Vector3(t.x, t.y, t.z), quat, new THREE.Vector3(t.scale, t.scale, t.scale));
      broadMesh.setMatrixAt(i, matrix);
      color.setHex(t.tint > 0.55 ? 0x65864a : t.tint > 0.2 ? 0x587a43 : 0x6f8d4b);
      broadMesh.setColorAt(i, color);
    });
    for (const mesh of [trunkMesh, pineMesh, broadMesh]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.propGroup.add(mesh);
    }

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, flatShading: true });
    const rocks = [];
    for (let attempts = 0; attempts < 900 && rocks.length < 92; attempts++) {
      const x = (rng() * 2 - 1) * 215;
      const z = (rng() * 2 - 1) * 215;
      const h = this.terrainHeight(x, z);
      if (h < 0.6) continue;
      if (inSite(x, z, 2) && rng() < 0.65) continue;
      const scale = 0.45 + rng() * 1.8;
      rocks.push({ x, z, y: h, scale, rot: rng() * Math.PI * 2, tint: rng() });
    }
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach((r, i) => {
      quat.setFromEuler(new THREE.Euler(rng() * 0.7, r.rot, rng() * 0.7));
      matrix.compose(new THREE.Vector3(r.x, r.y + r.scale * 0.35, r.z), quat, new THREE.Vector3(r.scale, r.scale * 0.75, r.scale));
      rockMesh.setMatrixAt(i, matrix);
      color.setHex(r.tint > 0.5 ? 0x76796c : r.tint > 0.2 ? 0x656a60 : 0x838477);
      rockMesh.setColorAt(i, color);
      if (r.scale > 1.05) this.addCollider(r.x, r.y + r.scale * 0.45, r.z, r.scale * 1.45, r.scale * 1.1, r.scale * 1.45);
    });
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    rockMesh.instanceMatrix.needsUpdate = true;
    if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    this.propGroup.add(rockMesh);

    const bushGeo = new THREE.IcosahedronGeometry(0.75, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const bushes = [];
    for (let attempts = 0; attempts < 700 && bushes.length < 170; attempts++) {
      const x = (rng() * 2 - 1) * 215;
      const z = (rng() * 2 - 1) * 215;
      const h = this.terrainHeight(x, z);
      if (h < 1.1 || inSite(x, z, 1)) continue;
      bushes.push({ x, z, y: h, scale: 0.6 + rng() * 1.25, tint: rng() });
    }
    const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
    bushes.forEach((b, i) => {
      quat.setFromAxisAngle(UP_VEC, rng() * Math.PI * 2);
      matrix.compose(new THREE.Vector3(b.x, b.y + b.scale * 0.55, b.z), quat, new THREE.Vector3(b.scale, b.scale * 0.8, b.scale));
      bushMesh.setMatrixAt(i, matrix);
      color.setHex(b.tint > 0.5 ? 0x688447 : b.tint > 0.2 ? 0x7d9050 : 0x5a7942);
      bushMesh.setColorAt(i, color);
    });
    bushMesh.castShadow = false;
    bushMesh.receiveShadow = true;
    bushMesh.instanceMatrix.needsUpdate = true;
    if (bushMesh.instanceColor) bushMesh.instanceColor.needsUpdate = true;
    this.propGroup.add(bushMesh);
  }

  resetPlane() {
    this.planeTime = -16;
  }

  update(dt, elapsed, playerPos, camera) {
    this.time = elapsed;
    const sun = this.sun;
    if (playerPos) {
      sun.position.set(playerPos.x + 74, 118, playerPos.z + 48);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      sun.target.updateMatrixWorld();
    }
    if (camera && this.sky) this.sky.position.copy(camera.position);

    this.water.position.y = -1.35 + Math.sin(elapsed * 0.7) * 0.035;

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 430) cloud.position.x = -430;
    }

    for (const item of this.loot) {
      if (item.taken) continue;
      const t = elapsed * 2.1 + item.phase;
      item.group.position.y = item.baseY + 0.02 + Math.sin(t) * 0.04;
      const ring = item.group.userData.ring;
      if (ring) ring.rotation.z = elapsed * 0.9 + item.phase;
      const beam = item.group.userData.beam;
      if (beam) beam.material.opacity = 0.055 + Math.sin(t * 0.7) * 0.018;
    }

    this.planeTime += dt;
    const plane = this.plane;
    if (plane) {
      const span = 900;
      const x = -440 + ((this.planeTime * 19 + 170) % span);
      plane.group.position.set(x, 152, 46);
      plane.group.rotation.z = Math.sin(elapsed * 0.5) * 0.02;
      plane.group.rotation.x = Math.sin(elapsed * 0.37) * 0.012;
      for (const prop of plane.props) prop.rotation.x += dt * 38;
      plane.beacon.material.color.setHex(Math.sin(elapsed * 3) > 0 ? 0xff4030 : 0x52120e);
    }

    if (this.beacon) {
      this.beacon.material.emissiveIntensity = 0.3 + (Math.sin(elapsed * 2.6) > 0.6 ? 2.4 : 0);
    }
  }
}
