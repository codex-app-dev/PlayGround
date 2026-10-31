import * as THREE from '../vendor/three.module.js';
import { RACES } from './data.js';
import { createUnitModel, createTree, createRock } from './models.js';
import { M, C, GEO, add, GLOW_TEX, banner } from './materials.js';

// ---------------------------------------------------------------------------
// A small animated diorama shown behind the main menu: three champions on a
// torch-lit dais. It renders through the main WebGL renderer, so switching to
// the battlefield does not create another heavy rendering context.
// ---------------------------------------------------------------------------
export class Showcase {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a141d, 22, 62);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
    this.camera.position.set(0, 5.2, 17.5);
    this.camera.lookAt(0, 2.0, 0);
    this.time = 0;
    this.width = 1;
    this.height = 1;
    this.stageX = 0;
    this.activeRace = 'human';
    this.hoverRace = null;
    this.heroes = [];
    this.flags = [];
    this.flames = [];
    this.motes = null;
    this.stage = new THREE.Group();
    this.scene.add(this.stage);
    this.build();
  }

  build() {
    this.createSky();
    this.createLights();
    this.createGround();
    this.createDais();
    this.createHeroes();
    this.createProps();
    this.createMotes();
  }

  createSky() {
    const geo = new THREE.SphereGeometry(90, 28, 18);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x08131f) },
        mid: { value: new THREE.Color(0x183143) },
        bottom: { value: new THREE.Color(0x47615e) },
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
          vec3 col = mix(bottom, mid, smoothstep(-0.18, 0.18, h));
          col = mix(col, top, smoothstep(0.08, 0.8, h));
          float moon = pow(max(dot(normalize(vWorld), normalize(vec3(-0.36, 0.38, 0.72))), 0.0), 170.0);
          col += vec3(0.95, 0.86, 0.66) * moon * 0.85;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);

    // A misty moon halo behind the dais.
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,244,209,1)');
    grad.addColorStop(0.24, 'rgba(255,226,160,.58)');
    grad.addColorStop(1, 'rgba(255,211,130,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: 0xfff1ca,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    moon.position.set(-17, 25, -33);
    moon.scale.set(22, 22, 1);
    this.scene.add(moon);
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xb5d4ff, 0x241b12, 1.05));

    const key = new THREE.DirectionalLight(0xffdfae, 2.8);
    key.position.set(7, 12, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 38;
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.04;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x76a8ff, 1.0);
    rim.position.set(-9, 5, -6);
    this.scene.add(rim);

    const warm = new THREE.PointLight(0xff9b52, 26, 18, 2);
    warm.position.set(8, 3.5, 5);
    this.scene.add(warm);
  }

  createGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(76, 64),
      new THREE.MeshStandardMaterial({ color: 0x17251f, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.72;
    ground.receiveShadow = true;
    this.stage.add(ground);

    // Darker concentric bands so the void does not feel flat.
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(15 + i * 9, 15.6 + i * 9, 80),
        new THREE.MeshBasicMaterial({ color: 0x0b1415, transparent: true, opacity: 0.28 - i * 0.05, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.69;
      this.stage.add(ring);
    }
  }

  createDais() {
    const stone = M(0x4a4a45, { roughness: 0.92 });
    const stoneDark = M(0x2f302e, { roughness: 1 });
    const stoneLight = M(0x68645a, { roughness: 0.88 });
    const gold = M(0xb58b43, { metalness: 0.65, roughness: 0.34, emissive: 0x3b2406, emissiveIntensity: 0.4 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.9, 0.85, 56), stoneDark);
    base.position.y = -0.28;
    base.receiveShadow = true;
    base.castShadow = true;
    this.stage.add(base);

    const tier = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.6, 0.35, 56), stone);
    tier.position.y = 0.29;
    tier.receiveShadow = true;
    this.stage.add(tier);

    const inner = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, 0.12, 48), stoneLight);
    inner.position.y = 0.51;
    inner.receiveShadow = true;
    this.stage.add(inner);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.35, 0.075, 6, 80), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    this.stage.add(ring);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.18, 0.04, 5, 64), gold);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.59;
    this.stage.add(ring2);

    // Faint arcane runes around the rim.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rune = add(
        this.stage, 'box', M(0xd7b46b, { emissive: 0x8a5b16, emissiveIntensity: 0.6 }),
        Math.cos(a) * 6.75, 0.57, Math.sin(a) * 6.75,
        0.32, 0.018, 0.09, 0, -a, 0,
      );
      rune.receiveShadow = false;
    }

    // Steps at the front of the dais.
    for (let i = 0; i < 3; i++) {
      const w = 3.4 - i * 0.35;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.7), stone);
      step.position.set(0, -0.16 - i * 0.18, 8 + i * 0.62);
      step.receiveShadow = true;
      this.stage.add(step);
    }
  }

  createHeroes() {
    const spacing = 2.95;
    const specs = [
      { race: 'human', x: -spacing },
      { race: 'orc', x: 0 },
      { race: 'undead', x: spacing },
    ];

    for (const spec of specs) {
      const data = RACES[spec.race];
      const entry = {
        race: spec.race,
        baseX: spec.x,
        lift: 0,
        phase: Math.random() * 6,
        color: new THREE.Color(data.color3d),
      };

      // Pedestal.
      const ped = new THREE.Group();
      ped.position.x = spec.x;
      this.stage.add(ped);
      const pBase = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.38, 0.34, 8), M(0x33342f, { roughness: 1 }));
      pBase.position.y = 0.69;
      pBase.receiveShadow = true;
      pBase.castShadow = true;
      ped.add(pBase);
      const pTop = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.13, 0.22, 8), M(0x5a574d, { roughness: 0.9 }));
      pTop.position.y = 0.95;
      pTop.receiveShadow = true;
      ped.add(pTop);
      const pRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.12, 0.035, 5, 32),
        M(data.color3d, { metalness: 0.5, roughness: 0.35, emissive: data.color3d, emissiveIntensity: 1.1 }),
      );
      pRing.rotation.x = Math.PI / 2;
      pRing.position.y = 1.07;
      ped.add(pRing);

      // Glowing selection ring on the dais.
      const ringMat = new THREE.MeshBasicMaterial({
        color: data.color3d,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.7, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(spec.x, 0.61, 0);
      this.stage.add(ring);
      entry.ring = ring;

      // Soft light pool beneath the champion.
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color: data.color3d,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }));
      glow.position.set(spec.x, 0.7, 0);
      glow.scale.set(4.6, 4.6, 1);
      this.stage.add(glow);
      entry.glow = glow;

      // The champion itself.
      const holder = new THREE.Group();
      holder.position.set(spec.x, 1.08, 0);
      const model = createUnitModel(spec.race, 'heavy', data.color3d);
      const box = new THREE.Box3().setFromObject(model);
      model.position.y -= box.min.y;
      model.scale.setScalar(1.25);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      holder.add(model);
      this.stage.add(holder);
      entry.holder = holder;
      entry.model = model;
      entry.baseY = 1.08;

      // Race banner behind the pedestal.
      const pole = new THREE.Group();
      pole.position.x = spec.x;
      this.stage.add(pole);
      const flagPivot = banner(pole, data.color3d, -1.35, 1.08, -0.55, 2.9, 0.78, entry.phase);
      entry.flag = flagPivot;
      this.flags.push(flagPivot);

      // A narrow column of coloured light when focused.
      const beamMat = new THREE.MeshBasicMaterial({
        color: data.color3d,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.7, 20, 1, true), beamMat);
      beam.position.set(spec.x, 3.4, 0);
      beam.rotation.x = Math.PI;
      this.stage.add(beam);
      entry.beam = beam;

      // Coloured fill light.
      const light = new THREE.PointLight(data.color3d, 6, 8, 2);
      light.position.set(spec.x, 2.5, 1.2);
      this.stage.add(light);
      entry.light = light;

      // Tiny sigil disc hovering behind each champion.
      const sigilMat = new THREE.MeshBasicMaterial({
        color: data.color3d,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sigil = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.75, 6), sigilMat);
      sigil.position.set(spec.x + 0.9, 3.9, -1.1);
      this.stage.add(sigil);
      entry.sigil = sigil;

      this.heroes.push(entry);
    }
  }

  createProps() {
    const treeSpots = [
      [-11.5, -3.2, 1.05], [-10.2, -7.5, 0.8], [-12.7, 3.7, 0.9],
      [11.4, -4.1, 1.0], [12.8, 2.4, 0.82], [10.4, 7.0, 0.7],
      [-8.9, 9.2, 0.72], [8.6, 10.4, 0.68], [-14.5, -8.4, 1.1],
    ];
    for (const [x, z, s] of treeSpots) {
      const tree = createTree(Math.floor(Math.random() * 3), s);
      tree.position.set(x, -0.64, z);
      tree.rotation.y = Math.random() * 6;
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.stage.add(tree);
    }

    const rockSpots = [[-7.6, 11.8, 0.75], [7.2, 12.4, 0.6], [-13.2, 5.4, 0.55], [13.6, -6.7, 0.5]];
    for (const [x, z, s] of rockSpots) {
      const rock = createRock(s, Math.floor(Math.random() * 4));
      rock.position.set(x, -0.68, z);
      this.stage.add(rock);
    }

    // Silhouetted pines on the horizon.
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x101d1a, roughness: 1, flatShading: true });
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + 0.11;
      const r = 18 + Math.random() * 11;
      const h = 3.2 + Math.random() * 3.4;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1 + Math.random() * 0.6, h, 5), pineMat);
      cone.position.set(Math.cos(a) * r, -0.7 + h / 2, Math.sin(a) * r);
      cone.rotation.y = Math.random() * 6;
      this.stage.add(cone);
    }

    // Distant mountain teeth.
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x172522, roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.22;
      const r = 31 + Math.random() * 12;
      const h = 8 + Math.random() * 12;
      const mount = new THREE.Mesh(new THREE.ConeGeometry(5 + Math.random() * 5, h, 4), mountMat);
      mount.position.set(Math.cos(a) * r, -0.7 + h / 2, Math.sin(a) * r);
      mount.rotation.y = Math.random() * 3;
      this.stage.add(mount);
    }

    // Braziers on the dais rim, with tiny flame sprites.
    const brazierMat = M(C.iron, { metalness: 0.55, roughness: 0.55 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const x = Math.cos(a) * 5.75;
      const z = Math.sin(a) * 5.75;
      add(this.stage, 'cyl6', brazierMat, x, 0.95, z, 0.12, 1.2, 0.12);
      add(this.stage, 'cyl6', brazierMat, x, 1.58, z, 0.34, 0.16, 0.34);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color: 0xffa747,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }));
      flame.position.set(x, 1.82, z);
      flame.scale.set(1.05, 1.3, 1);
      flame.userData.phase = Math.random() * 6;
      this.stage.add(flame);
      this.flames.push(flame);
    }
  }

  createMotes() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 11;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 9 - 0.2;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: GLOW_TEX,
      color: 0xffd78d,
      size: 0.14,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.motes = new THREE.Points(geo, mat);
    this.stage.add(this.motes);
  }

  setActive(race) {
    if (RACES[race]) this.activeRace = race;
  }

  setHover(race) {
    this.hoverRace = race && RACES[race] ? race : null;
  }

  setLayout(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const aspect = this.width / this.height;
    const mobile = this.width < 900;
    const fov = mobile ? 42 : 38;
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    const dist = mobile ? 26 : aspect < 1.35 ? 20 : 18;
    const halfW = Math.tan((fov * Math.PI) / 360) * dist * aspect;
    this.stageX = mobile ? 0 : halfW * 0.54;
    this.stage.position.x = this.stageX;
    this.camera.position.set(mobile ? 0 : -0.35, mobile ? 6.6 : 4.85, dist);
    this.camera.lookAt(0, mobile ? 2.3 : 2.05, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const t = this.time;

    for (const h of this.heroes) {
      const active = h.race === this.activeRace;
      const hover = h.race === this.hoverRace;
      const focus = hover ? 1 : active ? 0.72 : 0;
      const lift = (hover ? 0.18 : active ? 0.12 : 0) + Math.sin(t * 1.1 + h.phase) * 0.018;
      h.holder.position.y = h.baseY + lift;
      h.holder.rotation.y = Math.sin(t * 0.25 + h.phase) * 0.32 + (hover ? -0.15 : 0);
      h.holder.scale.setScalar(1 + (hover ? 0.045 : active ? 0.025 : 0));

      h.ring.rotation.z += dt * (hover ? 0.7 : 0.25);
      h.ring.material.opacity = 0.16 + focus * 0.5 + Math.sin(t * 2 + h.phase) * 0.05;
      h.ring.scale.setScalar(1 + Math.sin(t * 1.7 + h.phase) * 0.025 + focus * 0.03);

      h.glow.material.opacity = 0.1 + focus * 0.32;
      h.light.intensity = 4 + focus * 14;
      h.beam.material.opacity = focus * 0.055;
      h.beam.rotation.y += dt * 0.18;
      h.sigil.rotation.z -= dt * 0.25;
      h.sigil.material.opacity = 0.08 + focus * 0.24;
      h.sigil.position.y = 3.8 + Math.sin(t * 0.9 + h.phase) * 0.1;
    }

    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      f.rotation.y = Math.sin(t * 1.7 + i * 1.3) * 0.18;
    }
    for (const f of this.flames) {
      const k = 0.9 + Math.sin(t * 8 + f.userData.phase) * 0.14;
      f.scale.set(1.05 * k, 1.3 / k, 1);
      f.material.opacity = 0.72 + Math.sin(t * 7 + f.userData.phase) * 0.18;
    }

    if (this.motes) {
      this.motes.rotation.y += dt * 0.016;
      this.motes.position.y = Math.sin(t * 0.3) * 0.18;
      this.motes.material.opacity = 0.55 + Math.sin(t * 0.8) * 0.14;
    }

    // A very slow camera drift keeps the "live scene" tag honest.
    const driftX = Math.sin(t * 0.09) * 0.6;
    this.camera.position.x = (this.width < 900 ? 0 : -0.35) + driftX;
    this.camera.position.y = (this.width < 900 ? 6.6 : 4.85) + Math.sin(t * 0.13) * 0.14;
    this.camera.lookAt(0, this.width < 900 ? 2.3 : 2.05, 0);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
