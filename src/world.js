import * as THREE from 'three';

export const TEAM_COLORS = {
  blue: new THREE.Color('#37d9ff'),
  red: new THREE.Color('#ff5238'),
};

export const BASE_POSITIONS = {
  blue: new THREE.Vector3(-160, 0, 0),
  red: new THREE.Vector3(160, 0, 0),
};

const MAP_RADIUS = 345;

function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

function fbm(x, y) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    value += smoothNoise(x * freq, y * freq) * amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function rawHeight(x, z) {
  const broad = (fbm(x * 0.0062 + 12.4, z * 0.0062 - 9.1) - 0.5) * 54;
  const ridges = (fbm(x * 0.017 - 3.3, z * 0.017 + 7.8) - 0.5) * 18;
  const detail = (fbm(x * 0.055 + 1.7, z * 0.055 - 4.2) - 0.5) * 4.2;
  const radial = Math.hypot(x, z);
  const rim = Math.min(1, Math.max(0, (radial - 360) / 540));
  const edge = 170 * rim * rim * (3 - 2 * rim);
  const valley = -12 * Math.exp(-(x * x) / (2 * 120 * 120)) * Math.exp(-(z * z) / (2 * 210 * 210));
  return broad + ridges + detail + edge + valley;
}

const baseHeights = {
  blue: rawHeight(BASE_POSITIONS.blue.x, BASE_POSITIONS.blue.z) + 1.4,
  red: rawHeight(BASE_POSITIONS.red.x, BASE_POSITIONS.red.z) + 1.4,
};
BASE_POSITIONS.blue.y = baseHeights.blue;
BASE_POSITIONS.red.y = baseHeights.red;

export function terrainHeight(x, z) {
  let h = rawHeight(x, z);
  for (const team of ['blue', 'red']) {
    const base = BASE_POSITIONS[team];
    const d = Math.hypot(x - base.x, z - base.z);
    const flatten = 1 - smoothstep(17, 52, d);
    h = THREE.MathUtils.lerp(h, baseHeights[team], flatten);
  }
  const center = Math.hypot(x, z);
  const plateau = 1 - smoothstep(10, 34, center);
  h = THREE.MathUtils.lerp(h, rawHeight(0, 0) + 7, plateau * 0.8);
  return h;
}

export function groundHeight(x, z) {
  let h = terrainHeight(x, z);
  for (const team of ['blue', 'red']) {
    const base = BASE_POSITIONS[team];
    const d = Math.hypot(x - base.x, z - base.z);
    if (d < 34) {
      const platform = baseHeights[team] + 1.68;
      const t = 1 - smoothstep(24.5, 34, d);
      h = Math.max(h, THREE.MathUtils.lerp(h, platform, t));
    }
  }
  return h;
}

export function terrainNormal(x, z, target = new THREE.Vector3()) {
  const e = 0.75;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return target.set(-dx / (2 * e), 1, -dz / (2 * e)).normalize();
}

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 46; i++) {
    const x = 40 + Math.random() * 432;
    const y = 80 + Math.random() * 96;
    const r = 18 + Math.random() * 58;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.04 + Math.random() * 0.075;
    g.addColorStop(0, `rgba(214,240,255,${alpha})`);
    g.addColorStop(0.55, `rgba(186,222,245,${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(170,210,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSky(scene) {
  const sunDirection = new THREE.Vector3(0.5, 0.42, -0.52).normalize();
  const uniforms = {
    sunDirection: { value: sunDirection },
    horizon: { value: new THREE.Color('#e2836f').convertSRGBToLinear() },
    mid: { value: new THREE.Color('#3a4f96').convertSRGBToLinear() },
    zenith: { value: new THREE.Color('#060a26').convertSRGBToLinear() },
    sunColor: { value: new THREE.Color('#ffd6a6').convertSRGBToLinear() },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDirection;
      uniform vec3 horizon;
      uniform vec3 mid;
      uniform vec3 zenith;
      uniform vec3 sunColor;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 color = mix(horizon, mid, smoothstep(-0.06, 0.28, h));
        color = mix(color, zenith, smoothstep(0.18, 0.82, h));

        float sun = max(dot(dir, sunDirection), 0.0);
        color += sunColor * pow(sun, 1200.0) * 1.7;
        color += sunColor * pow(sun, 28.0) * 0.16;
        color += sunColor * pow(sun, 600.0) * 0.75;

        float band = exp(-pow((h - 0.09) * 9.0, 2.0));
        color += vec3(0.16, 0.09, 0.22) * band * 0.55;

        vec3 starField = floor(dir * 620.0);
        float star = hash(starField.xz + starField.y * 1.7);
        float starMask = smoothstep(0.31, 0.72, h);
        color += vec3(0.72, 0.88, 1.0) * step(0.9985, star) * starMask * 0.9;

        float grain = hash(gl_FragCoord.xy * 0.5) - 0.5;
        color += grain * 0.008;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), material);
  sky.frustumCulled = false;
  scene.add(sky);

  const glow = makeGlowTexture();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow, color: 0xffd3a6, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.position.copy(sunDirection).multiplyScalar(1500);
  sunSprite.scale.set(220, 220, 1);
  scene.add(sunSprite);

  const planetMat = new THREE.MeshBasicMaterial({ color: 0xb084e6, fog: false });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(52, 32, 24), planetMat);
  planet.position.set(-620, 240, -1050);
  scene.add(planet);
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(56, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xd8b6ff, transparent: true, opacity: 0.16, side: THREE.BackSide, fog: false })
  );
  haze.position.copy(planet.position);
  scene.add(haze);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(70, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0xcbb4ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, fog: false })
  );
  ring.position.copy(planet.position);
  ring.rotation.set(Math.PI * 0.62, -0.35, 0.4);
  scene.add(ring);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(13, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xd9f4ff, fog: false })
  );
  moon.position.set(780, 360, -920);
  scene.add(moon);

  return { sky, sunDirection, sunSprite, planet, ring, moon };
}

function buildClouds(scene) {
  const texture = makeCloudTexture();
  const clouds = [];
  const group = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture, color: 0xbfd0ea, transparent: true,
      opacity: 0.07 + Math.random() * 0.11, depthWrite: false, fog: false,
    });
    const sprite = new THREE.Sprite(material);
    const angle = Math.random() * Math.PI * 2;
    const radius = 700 + Math.random() * 700;
    sprite.position.set(Math.cos(angle) * radius, 140 + Math.random() * 180, Math.sin(angle) * radius);
    const scale = 110 + Math.random() * 160;
    sprite.scale.set(scale, scale * (0.34 + Math.random() * 0.16), 1);
    sprite.userData.speed = 0.8 + Math.random() * 1.8;
    group.add(sprite);
    clouds.push(sprite);
  }
  scene.add(group);
  return { group, clouds };
}

function buildTerrain(scene) {
  const size = 1300;
  const segments = 220;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color('#3f6b52');
  const grass = new THREE.Color('#7d9a5e');
  const dry = new THREE.Color('#b6a06a');
  const rock = new THREE.Color('#7f7d78');
  const snow = new THREE.Color('#e8eef4');
  const blueTint = new THREE.Color('#2b9aad');
  const redTint = new THREE.Color('#a04a3f');
  const c = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = terrainHeight(x, z);
    position.setY(i, y);

    const moisture = fbm(x * 0.02 + 11, z * 0.02 - 4);
    if (y < 4) c.copy(low).lerp(grass, smoothstep(-12, 5, y) * 0.8);
    else if (y < 22) c.copy(grass).lerp(dry, smoothstep(4, 22, y) * 0.7);
    else if (y < 110) c.copy(dry).lerp(rock, smoothstep(30, 95, y));
    else c.copy(rock).lerp(snow, smoothstep(110, 168, y));

    c.lerp(grass, (moisture - 0.44) * 0.28);
    const db = Math.hypot(x - BASE_POSITIONS.blue.x, z - BASE_POSITIONS.blue.z);
    const dr = Math.hypot(x - BASE_POSITIONS.red.x, z - BASE_POSITIONS.red.z);
    if (db < 78) c.lerp(blueTint, (1 - smoothstep(28, 78, db)) * 0.24);
    if (dr < 78) c.lerp(redTint, (1 - smoothstep(28, 78, dr)) * 0.24);

    const shade = 0.9 + hash2(x * 3.1, z * 2.7) * 0.16;
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, metalness: 0.04,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

function buildScatter(scene) {
  const dummy = new THREE.Object3D();
  const rand = (min, max) => min + Math.random() * (max - min);
  const baseClear = (x, z) => {
    return Math.hypot(x - BASE_POSITIONS.blue.x, z - BASE_POSITIONS.blue.z) > 50 &&
      Math.hypot(x - BASE_POSITIONS.red.x, z - BASE_POSITIONS.red.z) > 50 &&
      Math.hypot(x - BASE_POSITIONS.blue.x, z - BASE_POSITIONS.blue.z) > 50 &&
      Math.hypot(x, z) > 36;
  };

  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7b7f8c, roughness: 0.9, metalness: 0.12, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 340);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  let index = 0;
  for (let i = 0; i < 900 && index < 340; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 410;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!baseClear(x, z)) continue;
    const y = terrainHeight(x, z);
    if (y > 70) continue;
    const s = rand(0.6, 4.6);
    dummy.position.set(x, y + s * 0.3, z);
    dummy.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    dummy.scale.set(s * rand(0.7, 1.3), s * rand(0.55, 1.2), s * rand(0.7, 1.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(index, dummy.matrix);
    const tint = new THREE.Color().setHSL(rand(0.52, 0.62), rand(0.04, 0.16), rand(0.34, 0.52));
    rocks.setColorAt(index, tint);
    index++;
  }
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.46, 5, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x313e42, roughness: 0.9, flatShading: true });
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, 220);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  const canopyGeo = new THREE.ConeGeometry(2.1, 6.2, 6);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x3a6e67, roughness: 0.82, metalness: 0.05, flatShading: true,
    emissive: 0x0c3c3a, emissiveIntensity: 0.55,
  });
  const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, 220);
  canopy.castShadow = true;
  canopy.receiveShadow = true;

  let trees = 0;
  for (let i = 0; i < 900 && trees < 220; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 55 + Math.sqrt(Math.random()) * 345;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!baseClear(x, z)) continue;
    const y = terrainHeight(x, z);
    if (y > 55) continue;
    const scale = rand(0.7, 1.8);
    dummy.position.set(x, y + 2.5 * scale, z);
    dummy.rotation.set(0, rand(0, Math.PI * 2), rand(-0.06, 0.06));
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunk.setMatrixAt(trees, dummy.matrix);
    dummy.position.y = y + 4.9 * scale;
    dummy.updateMatrix();
    canopy.setMatrixAt(trees, dummy.matrix);
    const tint = new THREE.Color().setHSL(rand(0.42, 0.5), rand(0.18, 0.36), rand(0.24, 0.38));
    canopy.setColorAt(trees, tint);
    trees++;
  }
  trunk.count = trees;
  canopy.count = trees;
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  scene.add(trunk, canopy);

  const crystalGeo = new THREE.OctahedronGeometry(1, 0);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x5ff5ef, emissive: 0x27d7d9, emissiveIntensity: 2.4,
    roughness: 0.2, metalness: 0.25, flatShading: true,
  });
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, 90);
  crystals.castShadow = false;
  let ci = 0;
  for (let i = 0; i < 300 && ci < 90; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.sqrt(Math.random()) * 340;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!baseClear(x, z)) continue;
    const y = terrainHeight(x, z);
    const s = rand(0.35, 1.4);
    dummy.position.set(x, y + s * 0.9, z);
    dummy.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI * 2), rand(-0.3, 0.3));
    dummy.scale.set(s * rand(0.5, 0.9), s * rand(1.4, 3.2), s * rand(0.5, 0.9));
    dummy.updateMatrix();
    crystals.setMatrixAt(ci, dummy.matrix);
    crystals.setColorAt(ci, new THREE.Color().setHSL(rand(0.47, 0.56), 0.9, rand(0.55, 0.72)));
    ci++;
  }
  crystals.count = ci;
  crystals.instanceMatrix.needsUpdate = true;
  if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
  scene.add(crystals);

  const tuftGeo = new THREE.ConeGeometry(0.22, 1.5, 4);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4f7a5e, roughness: 0.9, flatShading: true });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 900);
  let ti = 0;
  for (let i = 0; i < 2200 && ti < 900; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 410;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrainHeight(x, z);
    if (y < -3 || y > 40) continue;
    const s = rand(0.5, 1.5);
    dummy.position.set(x, y + 0.5 * s, z);
    dummy.rotation.set(rand(-0.16, 0.16), rand(0, Math.PI * 2), rand(-0.16, 0.16));
    dummy.scale.set(s, s * rand(0.7, 1.6), s);
    dummy.updateMatrix();
    tufts.setMatrixAt(ti, dummy.matrix);
    ti++;
  }
  tufts.count = ti;
  tufts.instanceMatrix.needsUpdate = true;
  scene.add(tufts);

  return { rocks, trunk, canopy, crystals, tufts };
}

function buildFloatingIslands(scene) {
  const group = new THREE.Group();
  const islands = [];
  const positions = [
    [-280, 74, -260, 15], [260, 102, 210, 20], [-60, 122, 320, 12],
    [330, 86, -280, 16], [30, 142, -240, 9],
  ];
  for (const [x, y, z, scale] of positions) {
    const island = new THREE.Group();
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(scale, 0),
      new THREE.MeshStandardMaterial({ color: 0x5c606b, roughness: 0.95, flatShading: true })
    );
    rock.scale.set(1.5, 0.75, 1.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    island.add(rock);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(scale * 1.38, scale * 1.18, scale * 0.36, 7),
      new THREE.MeshStandardMaterial({ color: 0x4e7458, roughness: 0.9, flatShading: true })
    );
    top.position.y = scale * 0.58;
    top.castShadow = true;
    island.add(top);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(scale * 0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0x6ffcf4, emissive: 0x24c8d4, emissiveIntensity: 2.1, flatShading: true })
    );
    crystal.position.set(scale * 0.25, scale * 1.02, 0);
    crystal.scale.y = 2.3;
    island.add(crystal);

    island.position.set(x, y, z);
    island.userData.baseY = y;
    island.userData.phase = Math.random() * Math.PI * 2;
    group.add(island);
    islands.push(island);
  }
  scene.add(group);
  return { group, islands };
}

function teamMaterial(team, intensity = 2.2) {
  return new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[team], emissive: TEAM_COLORS[team], emissiveIntensity: intensity,
    roughness: 0.32, metalness: 0.35,
  });
}

function buildHoloBanner(team) {
  const uniforms = {
    color: { value: TEAM_COLORS[team].clone() },
    time: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 color;
      uniform float time;
      void main(){
        float scan = 0.55 + 0.45 * sin((vUv.y + time * 0.22) * 90.0);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float fade = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        float bands = 0.35 + 0.25 * sin(vUv.y * 22.0 + time * 1.5);
        float alpha = edge * fade * (0.18 + scan * 0.14) * bands;
        gl_FragColor = vec4(color * (0.65 + scan * 0.5), alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 11), material);
  mesh.userData.uniforms = uniforms;
  return mesh;
}

function buildBase(scene, team) {
  const base = BASE_POSITIONS[team];
  const group = new THREE.Group();
  group.position.set(base.x, base.y, base.z);
  const inward = team === 'blue' ? 1 : -1;
  const accent = teamMaterial(team, 2.6);
  const accentSoft = teamMaterial(team, 1.1);

  const metal = new THREE.MeshStandardMaterial({ color: 0x556e7c, roughness: 0.4, metalness: 0.6, emissive: 0x0e1b24, emissiveIntensity: 0.8 });
  const metalLight = new THREE.MeshStandardMaterial({ color: 0x9db4c0, roughness: 0.32, metalness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3c48, roughness: 0.55, metalness: 0.42, emissive: 0x071018, emissiveIntensity: 0.8 });

  const dais = new THREE.Mesh(new THREE.CylinderGeometry(27, 29, 1.8, 8), metal);
  dais.position.y = 0.6;
  dais.receiveShadow = true;
  dais.castShadow = true;
  group.add(dais);

  const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(24.5, 24.5, 0.24, 8), dark);
  daisTop.position.y = 1.56;
  daisTop.receiveShadow = true;
  group.add(daisTop);

  for (const radius of [12.5, 23]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.1, 8, 96), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.72;
    group.add(ring);
  }

  const rim = new THREE.Mesh(new THREE.TorusGeometry(28.4, 0.18, 6, 64), accentSoft);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.0;
  group.add(rim);

  for (let i = 0; i < 4; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 11.4), accentSoft);
    strip.position.set(0, 1.71, 0);
    strip.rotation.y = (i / 4) * Math.PI;
    strip.position.x = Math.sin((i / 4) * Math.PI) * 6.2;
    strip.position.z = Math.cos((i / 4) * Math.PI) * 6.2;
    group.add(strip);
  }

  for (const side of [-1, 1]) {
    const pillar = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.3, 9.5, 2.3), metal);
    shaft.position.y = 4.75;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pillar.add(shaft);
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 8.4, 2.36), accent);
    glowStrip.position.set(side * 0.9, 5, 0);
    pillar.add(glowStrip);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 3.4), metalLight);
    crown.position.y = 9.6;
    crown.castShadow = true;
    pillar.add(crown);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), accent);
    lamp.position.y = 10.4;
    pillar.add(lamp);
    pillar.position.set(-3.6 + side * 7.2, 0.5, -17);
    group.add(pillar);
  }

  const baseLight = new THREE.PointLight(team === 'blue' ? 0x54e8ff : 0xff6a47, 55, 62, 1.8);
  baseLight.position.set(0, 9, 0);
  group.add(baseLight);

  const arch = new THREE.Mesh(new THREE.TorusGeometry(9, 0.55, 8, 40, Math.PI), metal);
  arch.position.set(0, 1.5, -17);
  arch.rotation.z = 0;
  arch.castShadow = true;
  group.add(arch);
  const archGlow = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.09, 6, 40, Math.PI), accent);
  archGlow.position.copy(arch.position);
  group.add(archGlow);

  const flagStand = new THREE.Group();
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.4, 0.75, 8), metalLight);
  standBase.position.y = 1.95;
  standBase.castShadow = true;
  standBase.receiveShadow = true;
  flagStand.add(standBase);
  const standRing = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.13, 8, 64), accent);
  standRing.rotation.x = Math.PI / 2;
  standRing.position.y = 2.38;
  flagStand.add(standRing);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 7.4, 8), metalLight);
  pole.position.y = 6.1;
  pole.castShadow = true;
  flagStand.add(pole);
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), accent);
  finial.position.y = 10;
  flagStand.add(finial);
  flagStand.position.set(0, 0, 0);
  group.add(flagStand);

  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.16, 16), accentSoft);
    pad.position.set(inward * (10 + i * 3.4), 1.66, 8 - i * 2.4);
    pad.receiveShadow = true;
    group.add(pad);
  }

  for (const side of [-1, 1]) {
    const banner = buildHoloBanner(team);
    banner.position.set(side * 15, 8.2, -12);
    banner.rotation.y = side * 0.3;
    group.add(banner);
  }

  const beamMat = new THREE.MeshBasicMaterial({
    color: TEAM_COLORS[team], transparent: true, opacity: 0.055,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 6.5, 100, 18, 1, true), beamMat);
  beam.position.set(0, 51, 0);
  group.add(beam);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 18, 6), metalLight);
  antenna.position.set(0, 10.5, -17);
  antenna.castShadow = true;
  group.add(antenna);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = child.castShadow ?? false;
    }
  });

  scene.add(group);
  return { group, accent, accentSoft, bannerUniforms: group.children.filter(c => c.userData.uniforms).map(c => c.userData.uniforms) };
}

function buildCenterpiece(scene) {
  const group = new THREE.Group();
  const centerY = terrainHeight(0, 0);
  group.position.set(0, centerY, 0);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.45, metalness: 0.7 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x63ecff, emissive: 0x2cc9e6, emissiveIntensity: 1.35, roughness: 0.25,
  });

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.8, 44, 6), dark);
  spire.position.y = 22;
  spire.castShadow = true;
  spire.receiveShadow = true;
  group.add(spire);

  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), glow);
  tip.position.y = 46;
  group.add(tip);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(17 + i * 5, 0.1 + i * 0.025, 8, 96), glow);
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.18;
    ring.rotation.y = i * 0.35;
    ring.position.y = 25 + i * 6;
    group.add(ring);
    rings.push(ring);
  }

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.4), dark);
    pylon.position.set(Math.cos(angle) * 13, 4.5, Math.sin(angle) * 13);
    pylon.rotation.y = angle;
    pylon.castShadow = true;
    group.add(pylon);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glow);
    lamp.position.set(Math.cos(angle) * 13, 9.3, Math.sin(angle) * 13);
    group.add(lamp);
  }

  scene.add(group);
  return { group, rings, tip };
}

function buildFlag(team) {
  const group = new THREE.Group();
  const accent = teamMaterial(team, 2.1);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.1, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xb9ccd4, roughness: 0.3, metalness: 0.85 })
  );
  pole.position.y = 2.7;
  group.add(pole);

  const geometry = new THREE.PlaneGeometry(3.1, 1.8, 14, 7);
  geometry.translate(1.55, 0, 0);
  const material = new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[team], emissive: TEAM_COLORS[team], emissiveIntensity: 1.35,
    side: THREE.DoubleSide, transparent: true, opacity: 0.94, roughness: 0.55, metalness: 0.15,
  });
  const cloth = new THREE.Mesh(geometry, material);
  cloth.position.set(0.06, 4.5, 0);
  cloth.castShadow = true;
  group.add(cloth);

  const basePositions = geometry.attributes.position.array.slice();
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: TEAM_COLORS[team], transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.position.set(1.5, 5.4, 0);
  glow.scale.set(8, 8, 1);
  group.add(glow);

  return { group, cloth, basePositions, glow };
}

export function createWorld(scene) {
  scene.fog = new THREE.FogExp2(0x9a8fa8, 0.00095);
  scene.background = new THREE.Color(0x0a1424);

  const sky = buildSky(scene);
  const clouds = buildClouds(scene);
  const terrain = buildTerrain(scene);
  const scatter = buildScatter(scene);
  const islands = buildFloatingIslands(scene);
  const blueBase = buildBase(scene, 'blue');
  const redBase = buildBase(scene, 'red');
  const centerpiece = buildCenterpiece(scene);

  const hemi = new THREE.HemisphereLight(0xb4e3ff, 0x33473a, 1.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe0bd, 3.8);
  sun.position.copy(sky.sunDirection).multiplyScalar(140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x7fc0ff, 1.05);
  fill.position.set(80, 100, 120);
  scene.add(fill);

  const flags = {};
  for (const team of ['blue', 'red']) {
    const data = buildFlag(team);
    const base = BASE_POSITIONS[team];
    const home = new THREE.Vector3(base.x, base.y + 2.2, base.z);
    data.group.position.copy(home);
    data.home = home.clone();
    data.team = team;
    data.carrier = null;
    data.dropped = false;
    data.returnTimer = 0;
    data.phase = Math.random() * Math.PI * 2;
    scene.add(data.group);
    flags[team] = data;
  }

  const dust = (() => {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 340;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 2 + Math.random() * 38;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x9fd8ff, size: 0.26, map: makeGlowTexture(), transparent: true,
      opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    return points;
  })();

  const tmpColor = new THREE.Color();

  function update(dt, elapsed, cameraPos) {
    clouds.group.children.forEach((cloud) => {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 1100) cloud.position.x = -1100;
    });

    islands.islands.forEach((island, i) => {
      island.position.y = island.userData.baseY + Math.sin(elapsed * 0.32 + island.userData.phase) * 1.6;
      island.rotation.y += dt * (0.008 + i * 0.0015);
    });

    centerpiece.rings.forEach((ring, i) => {
      ring.rotation.z += dt * (0.12 + i * 0.05) * (i % 2 === 0 ? 1 : -1);
    });
    centerpiece.tip.rotation.y += dt * 0.4;

    for (const team of ['blue', 'red']) {
      const base = team === 'blue' ? blueBase : redBase;
      base.bannerUniforms.forEach((u) => { u.time.value = elapsed; });
      const flag = flags[team];
      const attribute = flag.cloth.geometry.attributes.position;
      const arr = attribute.array;
      const baseArr = flag.basePositions;
      for (let i = 0; i < arr.length; i += 3) {
        const x = baseArr[i];
        const y = baseArr[i + 1];
        const wave = Math.sin(x * 2.1 + elapsed * 4.2 + flag.phase) * 0.16 * (x / 3.1);
        const flutter = Math.sin(y * 3.4 + elapsed * 6.1) * 0.05 * (x / 3.1);
        arr[i] = x;
        arr[i + 1] = y + flutter;
        arr[i + 2] = wave;
      }
      attribute.needsUpdate = true;
      flag.cloth.geometry.computeVertexNormals();
      flag.glow.material.opacity = 0.35 + Math.sin(elapsed * 2 + flag.phase) * 0.13;
    }

    dust.rotation.y += dt * 0.006;

    if (cameraPos) {
      sun.position.copy(cameraPos).addScaledVector(sky.sunDirection, 140);
      sun.target.position.copy(cameraPos);
      sun.target.updateMatrixWorld();
    }

    const ring = islands.islands[1];
    if (ring) {
      tmpColor.copy(TEAM_COLORS.blue).lerp(TEAM_COLORS.red, (Math.sin(elapsed * 0.2) + 1) / 2);
    }
  }

  return {
    terrain, scatter, sky, islands, dust,
    blueBase, redBase, centerpiece, sun, hemi, flags, update,
    materials: { metal: blueBase.group.children[0].material },
  };
}

export { MAP_RADIUS };
