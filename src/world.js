import * as THREE from 'three';
import { mulberry32, radialGlowTexture } from './utils.js';

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.animated = [];
    this.clouds = [];
    this.islands = [];
    this.time = 0;
    this._buildSky();
    this._buildStars();
    this._buildClouds();
    this._buildIslands();
    this._buildPlanet();
    this._buildDust();
  }

  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(1100, 40, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x10082f) },
        midColor: { value: new THREE.Color(0x52217a) },
        horizonColor: { value: new THREE.Color(0xff9a9f) },
        lowColor: { value: new THREE.Color(0xffc98c) },
        sunDir: { value: new THREE.Vector3(-0.42, 0.28, -0.86).normalize() },
        sunColor: { value: new THREE.Color(0xfff2c8) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 lowColor;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        varying vec3 vWorld;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vWorld);
          float h = dir.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.34, h));
          col = mix(col, topColor, smoothstep(0.3, 0.85, h));
          col = mix(lowColor, col, smoothstep(-0.28, 0.06, h));

          float sun = max(dot(dir, sunDir), 0.0);
          col += sunColor * pow(sun, 700.0) * 2.6;
          col += sunColor * pow(sun, 16.0) * 0.18;
          col += vec3(1.0, 0.36, 0.55) * pow(max(-dir.y + 0.08, 0.0), 4.0) * 0.08;

          // Subtle atmospheric banding.
          col += 0.025 * sin(h * 85.0 + dir.x * 7.0) * smoothstep(0.0, 0.25, h);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -100;
    this.scene.add(sky);
    this.sky = sky;

    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialGlowTexture('rgba(255,240,190,.95)', 'rgba(255,120,120,0)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        fog: false,
        opacity: 0.55,
      })
    );
    sunGlow.position.copy(skyMat.uniforms.sunDir.value).multiplyScalar(760);
    sunGlow.scale.set(95, 95, 1);
    sunGlow.renderOrder = -90;
    this.scene.add(sunGlow);
    this.sunGlow = sunGlow;
  }

  _buildStars() {
    const rng = mulberry32(7);
    const positions = [];
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < 700; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(0.15 + rng() * 0.85);
      const r = 880 + rng() * 120;
      const x = Math.sin(phi) * Math.cos(theta) * r;
      const y = Math.cos(phi) * r;
      const z = Math.sin(phi) * Math.sin(theta) * r;
      positions.push(x, y, z);
      color.setHSL(0.55 + rng() * 0.22, 0.45, 0.72 + rng() * 0.28);
      colors.push(color.r, color.g, color.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      sizeAttenuation: false,
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = -80;
    this.scene.add(stars);
    this.stars = stars;
  }

  _buildClouds() {
    const rng = mulberry32(42);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xffe8ec, roughness: 1, flatShading: true, emissive: 0x3a1e42, emissiveIntensity: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0xffc9d8, roughness: 1, flatShading: true, emissive: 0x4a1e42, emissiveIntensity: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0xd7c8ff, roughness: 1, flatShading: true, emissive: 0x2d1a52, emissiveIntensity: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0xfff1d7, roughness: 1, flatShading: true, emissive: 0x4b2b37, emissiveIntensity: 0.28 }),
    ];
    const buckets = mats.map(() => []);
    const dummy = new THREE.Object3D();

    const addCluster = (angle, dist, y, scale) => {
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      const count = 3 + Math.floor(rng() * 5);
      for (let i = 0; i < count; i++) {
        const s = scale * (0.55 + rng() * 0.75);
        dummy.position.set(
          cx + (rng() - 0.5) * scale * 3.2,
          y + (rng() - 0.5) * scale * 0.65,
          cz + (rng() - 0.5) * scale * 2.3
        );
        dummy.rotation.set(rng() * 0.4, rng() * Math.PI, rng() * 0.2);
        dummy.scale.set(s * (1.1 + rng() * 0.6), s * (0.55 + rng() * 0.3), s * (0.85 + rng() * 0.5));
        dummy.updateMatrix();
        buckets[Math.floor(rng() * mats.length)].push(dummy.matrix.clone());
      }
    };

    for (let i = 0; i < 26; i++) {
      addCluster((i / 26) * Math.PI * 2 + rng() * 0.22, 180 + rng() * 330, -28 + rng() * 120, 9 + rng() * 16);
    }
    for (let i = 0; i < 34; i++) {
      addCluster(rng() * Math.PI * 2, 40 + rng() * 310, -70 - rng() * 35, 22 + rng() * 26);
    }
    addCluster(2.55, 128, 28, 10);
    addCluster(5.8, 132, 18, 12);
    addCluster(0.25, 165, 36, 11);

    for (let i = 0; i < mats.length; i++) {
      const list = buckets[i];
      if (!list.length) continue;
      const inst = new THREE.InstancedMesh(geo, mats[i], list.length);
      for (let j = 0; j < list.length; j++) inst.setMatrixAt(j, list[j]);
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      this.group.add(inst);
    }
  }

  _buildIslands() {
    const rng = mulberry32(1337);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3b245d,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: true,
    });
    const rockMatDark = new THREE.MeshStandardMaterial({
      color: 0x24153f,
      roughness: 0.95,
      metalness: 0.06,
      flatShading: true,
    });
    const grassMats = [
      new THREE.MeshStandardMaterial({ color: 0x36c996, roughness: 0.9, flatShading: true, emissive: 0x0c3b38, emissiveIntensity: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x67e0b2, roughness: 0.9, flatShading: true, emissive: 0x0c3b38, emissiveIntensity: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x8a72e8, roughness: 0.9, flatShading: true, emissive: 0x241252, emissiveIntensity: 0.35 }),
    ];
    const crystalMats = [
      new THREE.MeshStandardMaterial({ color: 0xff8bd0, emissive: 0xff2d7e, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.35, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x9bfbff, emissive: 0x54f7ff, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.35, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xffe29b, emissive: 0xffb84d, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.35, flatShading: true }),
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a3b51, roughness: 0.95, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x27a67c, roughness: 0.9, flatShading: true, emissive: 0x0c3b38, emissiveIntensity: 0.35 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0xff5b9d, roughness: 0.9, flatShading: true, emissive: 0x4b1235, emissiveIntensity: 0.4 });

    const makeIsland = (radius, height, x, y, z, options = {}) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const segments = 7 + Math.floor(rng() * 3);

      const underside = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.92, height, segments, 1), rockMat);
      underside.rotation.x = Math.PI;
      underside.position.y = -height / 2 + 1.3;
      underside.rotation.y = rng() * Math.PI;
      group.add(underside);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.86, 2.5, segments), rockMatDark);
      rim.position.y = 0.2;
      group.add(rim);

      const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.94, radius * 0.99, 1.25, segments), grassMats[Math.floor(rng() * grassMats.length)]);
      top.position.y = 1.65;
      group.add(top);

      const crystalCount = options.crystals ?? 1 + Math.floor(rng() * 3);
      for (let i = 0; i < crystalCount; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * radius * 0.55;
        const size = radius * (0.08 + rng() * 0.12);
        const crystal = new THREE.Mesh(
          new THREE.ConeGeometry(size * 0.6, size * 3.5, 5),
          crystalMats[Math.floor(rng() * crystalMats.length)]
        );
        crystal.position.set(Math.cos(angle) * dist, 2.2 + size * 1.7, Math.sin(angle) * dist);
        crystal.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI, (rng() - 0.5) * 0.35);
        group.add(crystal);
        this.animated.push({ mesh: crystal, baseY: crystal.position.y, phase: rng() * 6, amp: 0.12, speed: 0.7 });
      }

      const treeCount = options.trees ?? Math.floor(rng() * 3);
      for (let i = 0; i < treeCount; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = radius * (0.25 + rng() * 0.48);
        const tree = new THREE.Group();
        tree.position.set(Math.cos(angle) * dist, 2.2, Math.sin(angle) * dist);
        const th = radius * (0.15 + rng() * 0.16);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(th * 0.07, th * 0.11, th, 5), trunkMat);
        trunk.position.y = th / 2;
        tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(th * 0.42, 0), rng() > 0.7 ? leafMatB : leafMat);
        crown.position.y = th * 1.02;
        crown.scale.y = 1.2;
        tree.add(crown);
        group.add(tree);
      }

      if (options.arch) {
        const archMat = new THREE.MeshStandardMaterial({
          color: 0x2a1552,
          emissive: options.archColor ?? 0x54f7ff,
          emissiveIntensity: 1.5,
          metalness: 0.7,
          roughness: 0.3,
        });
        const arch = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.55, radius * 0.03, 6, 30, Math.PI), archMat);
        arch.position.y = 2.2;
        arch.rotation.z = Math.PI;
        group.add(arch);
      }

      group.userData.baseY = y;
      group.userData.phase = rng() * Math.PI * 2;
      group.userData.bob = 0.6 + rng() * 1.1;
      this.islands.push(group);
      this.group.add(group);
      return group;
    };

    // Outer ring of floating islands.
    const islandData = [
      [42, 52, 205, 8, -50, { trees: 4, crystals: 2 }],
      [30, 42, -195, 30, -35, { trees: 2, crystals: 2 }],
      [34, 48, 55, -18, -240, { trees: 3, crystals: 3 }],
      [26, 36, -215, 4, 120, { trees: 2, crystals: 1 }],
      [48, 60, 190, -20, 150, { trees: 4, crystals: 3 }],
      [22, 30, -165, 44, 185, { trees: 1, crystals: 2 }],
      [38, 46, 10, -28, 235, { trees: 3, crystals: 2 }],
      [25, 34, 250, 40, -120, { trees: 2, crystals: 2 }],
      [20, 28, -255, 12, -130, { trees: 1, crystals: 1 }],
      [32, 40, 245, 5, 50, { trees: 2, crystals: 2 }],
    ];
    for (const [r, h, x, y, z, opts] of islandData) {
      makeIsland(r, h, x, y, z, opts);
    }

    // Central spectacle below the orbital circuit.
    const center = makeIsland(38, 72, -20, -78, -48, { trees: 5, crystals: 4, arch: true, archColor: 0xff2d7e });
    const bigCrystal = new THREE.Mesh(
      new THREE.ConeGeometry(5, 34, 6),
      new THREE.MeshStandardMaterial({
        color: 0xaefcff,
        emissive: 0x54f7ff,
        emissiveIntensity: 2.3,
        roughness: 0.12,
        metalness: 0.45,
        transparent: true,
        opacity: 0.92,
        flatShading: true,
      })
    );
    bigCrystal.position.set(0, 18, 0);
    bigCrystal.rotation.z = 0.12;
    center.add(bigCrystal);
    this.animated.push({ mesh: bigCrystal, baseY: 18, phase: 1, amp: 0.7, speed: 0.5 });

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(11, 0.4, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xff6fb5, transparent: true, opacity: 0.55, toneMapped: false })
    );
    halo.position.set(0, 20, 0);
    halo.rotation.x = Math.PI / 2.6;
    center.add(halo);
    this.animated.push({ mesh: halo, baseY: 20, phase: 0, amp: 0.4, speed: 0.4, spin: 0.16 });

    // A small cluster of floating rocks.
    for (let i = 0; i < 14; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 120 + rng() * 180;
      const s = 2 + rng() * 7;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 3 === 0 ? rockMat : rockMatDark);
      rock.position.set(Math.cos(angle) * dist, -25 + rng() * 110, Math.sin(angle) * dist);
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      this.group.add(rock);
      this.animated.push({ mesh: rock, baseY: rock.position.y, phase: rng() * 6, amp: 0.4 + rng() * 0.8, speed: 0.2 + rng() * 0.3, spin: 0.03 });
    }

    // Whimsical balloons.
    const balloonColors = [0xff2d7e, 0x54f7ff, 0xffd166];
    for (let i = 0; i < 3; i++) {
      const balloon = new THREE.Group();
      const angle = 1.1 + i * 2.1;
      balloon.position.set(Math.cos(angle) * 145, 35 + i * 9, Math.sin(angle) * 145);
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 10, 8),
        new THREE.MeshStandardMaterial({
          color: balloonColors[i],
          emissive: balloonColors[i],
          emissiveIntensity: 0.18,
          roughness: 0.6,
          flatShading: true,
        })
      );
      canopy.scale.y = 1.15;
      balloon.add(canopy);
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.65, 1.2, 6), trunkMat);
      basket.position.y = -4.4;
      balloon.add(basket);
      for (let j = 0; j < 4; j++) {
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 2.5, 3),
          new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
        );
        rope.position.set(Math.cos((j / 4) * Math.PI * 2) * 0.8, -2.8, Math.sin((j / 4) * Math.PI * 2) * 0.8);
        balloon.add(rope);
      }
      this.group.add(balloon);
      this.animated.push({ mesh: balloon, baseY: balloon.position.y, phase: rng() * 6, amp: 1.2, speed: 0.35 });
    }
  }

  _buildPlanet() {
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(42, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffb0c8,
        emissive: 0x8d2f6d,
        emissiveIntensity: 0.55,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: true,
      })
    );
    planet.position.set(-460, 230, -680);
    this.scene.add(planet);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(66, 2.8, 4, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd6b0, transparent: true, opacity: 0.45, toneMapped: false })
    );
    ring.position.copy(planet.position);
    ring.rotation.x = 1.1;
    ring.rotation.z = 0.3;
    this.scene.add(ring);
    this.planet = planet;
    this.planetRing = ring;
  }

  _buildDust() {
    const rng = mulberry32(9001);
    const count = 420;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 30 + rng() * 210;
      positions[i * 3] = Math.cos(angle) * dist;
      positions[i * 3 + 1] = -20 + rng() * 100;
      positions[i * 3 + 2] = Math.sin(angle) * dist;
      color.setHSL(0.5 + rng() * 0.35, 0.85, 0.65);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  update(dt, elapsed) {
    this.time += dt;
    for (const i of this.islands) {
      i.position.y = i.userData.baseY + Math.sin(this.time * 0.22 + i.userData.phase) * i.userData.bob;
    }
    for (const a of this.animated) {
      a.mesh.position.y = a.baseY + Math.sin(this.time * a.speed + a.phase) * a.amp;
      if (a.spin) a.mesh.rotation.y += dt * a.spin;
    }
    if (this.dust) {
      this.dust.rotation.y = this.time * 0.012;
      this.dust.rotation.x = Math.sin(this.time * 0.03) * 0.02;
    }
    if (this.planetRing) this.planetRing.rotation.z += dt * 0.004;
    if (this.sunGlow) {
      const s = 92 + Math.sin(this.time * 0.5) * 5;
      this.sunGlow.scale.set(s, s, 1);
    }
    if (this.stars) this.stars.rotation.y = this.time * 0.0015;
  }
}
