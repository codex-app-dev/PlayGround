import * as THREE from '../vendor/three.module.js';
import { M, C, GEO, add } from './materials.js';
import { MAP, generateLayout, mulberry32 } from './map.js';
import { createBush } from './models.js';

const SIZE = 1024;
const WORLD = 150;

function w2c(v) {
  return ((v + WORLD / 2) / WORLD) * SIZE;
}

function makeTerrainCanvas(layout) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const rnd = mulberry32(7741);

  // Base grass with painterly patches.
  ctx.fillStyle = '#638b4c';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const greens = ['#5d8447', '#6c9452', '#587d44', '#719b57', '#4f7440', '#7da05c', '#628a4b'];
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
    ctx.globalAlpha = 0.18 + rnd() * 0.3;
    const r = 8 + rnd() * 60;
    ctx.beginPath();
    ctx.ellipse(rnd() * SIZE, rnd() * SIZE, r, r * (0.4 + rnd() * 0.8), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Darker forest floor under clusters of trees.
  ctx.globalAlpha = 0.22;
  for (const t of layout.trees) {
    const grd = ctx.createRadialGradient(w2c(t.x), w2c(t.z), 0, w2c(t.x), w2c(t.z), 26 * t.scale);
    grd.addColorStop(0, '#2f4c2b');
    grd.addColorStop(1, 'rgba(47,76,43,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(w2c(t.x), w2c(t.z), 26 * t.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dirt road between bases.
  const ax = w2c(MAP.path.from.x), az = w2c(MAP.path.from.z);
  const bx = w2c(MAP.path.to.x), bz = w2c(MAP.path.to.z);
  const road = (width, color, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, az);
    ctx.bezierCurveTo(w2c(-10), w2c(18), w2c(6), w2c(-8), bx, bz);
    ctx.stroke();
  };
  road(86, '#8d7b56', 0.55);
  road(64, '#b19a6b', 0.72);
  road(40, '#c3ad7d', 0.65);
  // Worn wheel ruts.
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#6d5d40';
  ctx.lineWidth = 4;
  for (const offset of [-10, 10]) {
    ctx.beginPath();
    ctx.moveTo(ax + offset, az + offset * 0.2);
    ctx.bezierCurveTo(w2c(-10) + offset, w2c(18), w2c(6) + offset, w2c(-8), bx + offset, bz + offset * 0.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Side trails to gold mines.
  for (const mine of MAP.mines) {
    const base = mine.z < 0 ? MAP.enemyBase : MAP.playerBase;
    ctx.save();
    ctx.setLineDash([10, 18]);
    ctx.strokeStyle = '#b8a173';
    ctx.lineWidth = 22;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(w2c(mine.x), w2c(mine.z));
    ctx.lineTo(w2c(base.x), w2c(base.z));
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Stone plazas under both bases.
  for (const base of [MAP.playerBase, MAP.enemyBase]) {
    const x = w2c(base.x), z = w2c(base.z);
    const g = ctx.createRadialGradient(x, z, 2, x, z, 92);
    g.addColorStop(0, '#8f8368');
    g.addColorStop(0.72, '#81765f');
    g.addColorStop(1, 'rgba(129,118,95,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, z, 94, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#5d5545';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(x, z, 22 * i, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 20, z + Math.sin(a) * 20);
      ctx.lineTo(x + Math.cos(a) * 86, z + Math.sin(a) * 86);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Pond basin.
  const px = w2c(MAP.pond.x), pz = w2c(MAP.pond.z);
  const pondGrad = ctx.createRadialGradient(px - 10, pz - 10, 20, px, pz, 72);
  pondGrad.addColorStop(0, '#2f7486');
  pondGrad.addColorStop(0.7, '#23596b');
  pondGrad.addColorStop(1, '#2f5e4a');
  ctx.fillStyle = pondGrad;
  ctx.beginPath();
  ctx.ellipse(px, pz, 74, 66, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Fine noise so the terrain does not look flat. Draw it on a scratch canvas:
  // putImageData() would replace the painterly terrain instead of blending.
  const noise = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < noise.data.length; i += 4) {
    const v = Math.floor(rnd() * 34);
    noise.data[i] = v;
    noise.data[i + 1] = v + 5;
    noise.data[i + 2] = v;
    noise.data[i + 3] = 22;
  }
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseCanvas.height = SIZE;
  noiseCanvas.getContext('2d').putImageData(noise, 0, 0);
  ctx.drawImage(noiseCanvas, 0, 0);

  // Little flowers sprinkled into the texture.
  const petals = ['#e7dc8e', '#f0e6bf', '#c7a6e0', '#e8a9a9', '#f5c96a'];
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = petals[Math.floor(rnd() * petals.length)];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(rnd() * SIZE, rnd() * SIZE, 1.2 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export class World {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.clouds = [];
    this.pondMaterial = null;
    this.time = 0;
    this.build();
  }

  build() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x9fc7d6);
    scene.fog = new THREE.Fog(0xa9c9cf, 92, 185);

    this.createSky();
    this.createLights();

    this.terrainCanvas = makeTerrainCanvas(this.layout);
    const tex = new THREE.CanvasTexture(this.terrainCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.terrainTexture = tex;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD, WORLD, 1, 1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0, color: 0xffffff }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'terrain';
    scene.add(ground);

    // Base plazas: subtle raised stone discs under the starting halls.
    for (const base of [MAP.playerBase, MAP.enemyBase]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.4, 0.14, 36), M(0x81765f, { roughness: 0.95 }));
      disc.position.set(base.x, 0.04, base.z);
      disc.receiveShadow = true;
      scene.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.12, 4, 48), M(0x5a5244, { roughness: 1 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(base.x, 0.12, base.z);
      scene.add(ring);
    }

    this.createPond();
    this.createMountainRing();
    this.createClouds();
    this.createGroundDetail();
    this.createPollen();
  }

  createSky() {
    const geo = new THREE.SphereGeometry(280, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x4f93cf) },
        mid: { value: new THREE.Color(0xa8d4e4) },
        bottom: { value: new THREE.Color(0xf2d5a0) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y;
          vec3 col = mix(bottom, mid, smoothstep(-0.05, 0.25, h));
          col = mix(col, top, smoothstep(0.2, 0.85, h));
          float sun = pow(max(dot(normalize(vWorld), normalize(vec3(-0.45, 0.3, 0.65))), 0.0), 120.0);
          col += vec3(1.0, 0.74, 0.4) * sun * 0.65;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // A soft sun halo.
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffe3a3,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,244,205,1)');
    g.addColorStop(0.25, 'rgba(255,221,145,.65)');
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    sun.material.map = tex;
    sun.position.set(-95, 95, 150);
    sun.scale.set(70, 70, 1);
    this.scene.add(sun);
  }

  createLights() {
    const hemi = new THREE.HemisphereLight(0xcbe6ff, 0x4e5b3a, 1.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe4ba, 2.65);
    sun.position.set(38, 68, 34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -72;
    sun.shadow.camera.right = 72;
    sun.shadow.camera.top = 72;
    sun.shadow.camera.bottom = -72;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.0007;
    sun.shadow.normalBias = 0.045;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.42);
    fill.position.set(-45, 30, -25);
    this.scene.add(fill);
  }

  createPond() {
    const { x, z, radius } = MAP.pond;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2d7f95,
      emissive: 0x0f4653,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.9,
      roughness: 0.18,
      metalness: 0.15,
    });
    this.pondMaterial = mat;
    const water = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.4, 40), mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.07, z);
    this.scene.add(water);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.7, 32), new THREE.MeshBasicMaterial({ color: 0x6ec6ce, transparent: true, opacity: 0.13, depthWrite: false }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(x, 0.09, z);
    this.scene.add(inner);

    // Reeds and lily pads.
    const rnd = mulberry32(551);
    const reedMat = M(0x5a7a3b);
    const reedHead = M(0x6b4a2a);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const r = radius - 0.8 + rnd() * 1.8;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      add(this.scene, 'cyl6', reedMat, px, 0.55, pz, 0.035, 1.1, 0.035);
      if (i % 3 === 0) add(this.scene, 'cyl6', reedHead, px, 1.15, pz, 0.07, 0.3, 0.07);
    }
    const padMat = M(0x477a43, { roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * (radius - 2);
      const pad = add(this.scene, 'cyl', padMat, x + Math.cos(a) * r, 0.12, z + Math.sin(a) * r, 0.8 + rnd() * 0.5, 0.03, 0.8 + rnd() * 0.5);
      pad.rotation.y = rnd() * 3;
    }
    // Shore rocks.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + 0.15;
      const r = radius + 0.4;
      add(this.scene, 'dodeca', M(0x7b786e), x + Math.cos(a) * r, 0.18, z + Math.sin(a) * r, 0.7 + rnd() * 0.8, 0.45, 0.6, rnd(), rnd() * 3, 0);
    }
  }

  createMountainRing() {
    const rnd = mulberry32(9001);
    const matA = new THREE.MeshStandardMaterial({ color: 0x6d898c, roughness: 1, flatShading: true });
    const matB = new THREE.MeshStandardMaterial({ color: 0x58747a, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xd9e6e7, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + rnd() * 0.18;
      const r = 105 + rnd() * 35;
      const h = 22 + rnd() * 30;
      const w = 20 + rnd() * 26;
      const m = add(this.scene, 'cone4', i % 2 ? matA : matB, Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r, w, h, w, 0, rnd() * 3, 0, false);
      m.receiveShadow = false;
      if (h > 40) add(this.scene, 'cone4', snow, Math.cos(a) * r, h - 4, Math.sin(a) * r, w * 0.3, h * 0.18, w * 0.3, 0, m.rotation.y, 0, false);
    }
  }

  createClouds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false });
    const rnd = mulberry32(333);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(GEO.sphere, mat);
        m.position.set((j - n / 2) * 4 + rnd() * 2, rnd() * 1.5, rnd() * 2);
        m.scale.set(6 + rnd() * 5, 1.6 + rnd() * 1.5, 4 + rnd() * 3);
        g.add(m);
      }
      g.position.set(-80 + rnd() * 160, 40 + rnd() * 25, -80 + rnd() * 160);
      g.userData.speed = 0.35 + rnd() * 0.5;
      this.scene.add(g);
      this.clouds.push(g);
    }
  }

  createGroundDetail() {
    const rnd = mulberry32(4242);

    // Grass tufts, one instanced draw call.
    const grassGeo = new THREE.ConeGeometry(0.075, 0.42, 3);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, 1400);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = [0x6e9b50, 0x7fae58, 0x5d8746, 0x8db866, 0x668f4c];
    for (let i = 0; i < 1400; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 60;
      dummy.position.set(Math.cos(a) * r, 0.19, Math.sin(a) * r);
      dummy.rotation.y = rnd() * Math.PI;
      const s = 0.55 + rnd() * 1.05;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      color.setHex(palette[Math.floor(rnd() * palette.length)]);
      grass.setColorAt(i, color);
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Flowers.
    const flowerGeo = new THREE.IcosahedronGeometry(0.075, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x222211, emissiveIntensity: 0.2 });
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 260);
    const petalColors = [0xffe07a, 0xf8f0d0, 0xc79bea, 0xf08b8b, 0xffb45e];
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 58;
      dummy.position.set(Math.cos(a) * r, 0.11, Math.sin(a) * r);
      dummy.rotation.set(0, rnd() * 3, 0);
      const s = 0.7 + rnd() * 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      color.setHex(petalColors[Math.floor(rnd() * petalColors.length)]);
      flowers.setColorAt(i, color);
    }
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    this.scene.add(flowers);

    // Pebbles.
    const pebbleGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const pebbles = new THREE.InstancedMesh(pebbleGeo, new THREE.MeshStandardMaterial({ color: 0x8b8779, roughness: 1, flatShading: true }), 90);
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 57;
      dummy.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      dummy.rotation.set(rnd(), rnd() * 3, rnd());
      const s = 0.4 + rnd() * 0.9;
      dummy.scale.set(s, s * 0.55, s);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
    }
    pebbles.instanceMatrix.needsUpdate = true;
    pebbles.receiveShadow = true;
    this.scene.add(pebbles);

    // Bushes.
    for (const b of this.layout.bushes) {
      const bush = createBush(b.scale);
      bush.position.set(b.x, 0.05, b.z);
      bush.rotation.y = b.rot;
      this.scene.add(bush);
    }
  }

  createPollen() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    const rnd = mulberry32(101);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rnd() - 0.5) * 120;
      positions[i * 3 + 1] = 1 + rnd() * 12;
      positions[i * 3 + 2] = (rnd() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xfff2c9, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pollen = new THREE.Points(geo, mat);
    this.scene.add(this.pollen);
  }

  update(dt) {
    this.time += dt;
    if (this.pondMaterial) this.pondMaterial.emissiveIntensity = 0.32 + Math.sin(this.time * 1.4) * 0.1;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 105) c.position.x = -105;
    }
    if (this.pollen) this.pollen.rotation.y += dt * 0.008;
  }
}
