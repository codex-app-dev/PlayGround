import * as THREE from 'three';

export const ARENA = {
  length: 120,
  width: 80,
  halfLength: 60,
  halfWidth: 40,
  ceiling: 30,
  goalWidth: 26,
  goalHeight: 12,
  goalDepth: 9,
  ballRadius: 2.1,
  carBaseY: 0.82,
};

const C = {
  blue: 0x20c8ff,
  blueDeep: 0x075cff,
  orange: 0xff7a18,
  orangeDeep: 0xff3c00,
  ice: 0xc9f4ff,
  steel: 0x16202e,
  dark: 0x050b14,
};

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function neonMaterial(hex, intensity = 1.8, opacity = 1) {
  const c = new THREE.Color(hex).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: opacity < 1, opacity });
}

export function createEnvironment(renderer) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 512;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0b1a33');
  g.addColorStop(0.45, '#0a2030');
  g.addColorStop(0.55, '#0c101a');
  g.addColorStop(1, '#030609');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  // glowing arena light strips
  const colors = ['#1ac8ff', '#ff7a18', '#7fe9ff', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    const x = (i * 83 + 40) % 1024;
    const y = 220 + Math.sin(i * 1.7) * 60;
    const rg = ctx.createRadialGradient(x, y, 2, x, y, 90);
    rg.addColorStop(0, colors[i % colors.length]);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 90, y - 90, 180, 180);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

export class Arena {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'arena';
    scene.add(this.group);

    this.pads = [];
    this.flashes = [];
    this.time = 0;
    this.screenState = { blue: 0, orange: 0, clock: '3:00', label: 'REGULATION' };

    this._buildSky();
    this._buildLights();
    this._buildField();
    this._buildWalls();
    this._buildGoals();
    this._buildStands();
    this._buildCrowd();
    this._buildScreens();
    this._buildBoostPads();
    this._buildAtmosphere();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(240, 40, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.85 + 0.18, 0.0, 1.0);
          vec3 low = vec3(0.035, 0.10, 0.15);
          vec3 mid = vec3(0.012, 0.035, 0.075);
          vec3 top = vec3(0.004, 0.008, 0.022);
          vec3 col = mix(low, mid, smoothstep(0.0, 0.32, h));
          col = mix(col, top, smoothstep(0.30, 0.95, h));
          float glow = pow(max(0.0, 1.0 - abs(vDir.y + 0.02) * 7.0), 3.0);
          col += vec3(0.02, 0.10, 0.16) * glow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    // star points add depth
    const n = 700;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const phi = Math.random() * Math.PI * 2;
      const cost = 0.18 + Math.random() * 0.8;
      const sint = Math.sqrt(1 - cost * cost);
      const r = 210 + Math.random() * 18;
      positions[i * 3] = Math.cos(phi) * sint * r;
      positions[i * 3 + 1] = cost * r;
      positions[i * 3 + 2] = Math.sin(phi) * sint * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sm = new THREE.PointsMaterial({ color: 0x9fd8ff, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.8, toneMapped: false });
    this.stars = new THREE.Points(sg, sm);
    this.group.add(this.stars);
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x78b8ff, 0x09131c, 1.45);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0x29425e, 0.6));

    const key = new THREE.DirectionalLight(0xeaf7ff, 2.5);
    key.position.set(34, 55, 26);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -76;
    key.shadow.camera.right = 76;
    key.shadow.camera.top = 54;
    key.shadow.camera.bottom = -54;
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 140;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.04;
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0x2d7dff, 0.85);
    fill.position.set(-45, 32, -38);
    this.scene.add(fill);

    this.goalLights = {};
    for (const side of [-1, 1]) {
      const color = side < 0 ? C.blue : C.orange;
      const light = new THREE.PointLight(color, 260, 46, 2);
      light.position.set(side * 64, 8, 0);
      this.scene.add(light);
      this.goalLights[side] = light;
    }

    // one broad overhead fill keeps the light count low for weaker GPUs
    const overhead = new THREE.PointLight(0x86dcff, 120, 82, 2);
    overhead.position.set(0, 27, 0);
    this.scene.add(overhead);
  }

  _fieldTexture() {
    const W = 2048, H = 1365;
    return canvasTexture(W, H, (ctx) => {
      const px = (x) => ((x + 60) / 120) * W;
      const pz = (z) => ((z + 40) / 80) * H;
      // base
      ctx.fillStyle = '#123c35';
      ctx.fillRect(0, 0, W, H);
      // mowing stripes along the length
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? '#0d2e2b' : '#123d36';
        ctx.fillRect((i / 12) * W, 0, W / 12 + 1, H);
      }
      // subtle diagonal sheen
      const sheen = ctx.createLinearGradient(0, 0, W, H);
      sheen.addColorStop(0, 'rgba(70,200,220,0.10)');
      sheen.addColorStop(0.45, 'rgba(30,120,140,0.02)');
      sheen.addColorStop(1, 'rgba(255,130,40,0.07)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, W, H);

      // hex mesh
      ctx.strokeStyle = 'rgba(100,220,210,0.045)';
      ctx.lineWidth = 1.5;
      const r = 34;
      for (let yy = 0; yy < H + r; yy += r * 1.5) {
        for (let xx = 0; xx < W + r; xx += r * Math.sqrt(3)) {
          const ox = (Math.round(yy / (r * 1.5)) % 2) * r * Math.sqrt(3) / 2;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 3 * k + Math.PI / 6;
            const x = xx + ox + Math.cos(a) * r;
            const y = yy + Math.sin(a) * r;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // wear / speckle
      for (let i = 0; i < 5200; i++) {
        const a = Math.random() * 0.09;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(200,255,240,${a})` : `rgba(0,10,8,${a})`;
        const s = Math.random() * 3;
        ctx.fillRect(Math.random() * W, Math.random() * H, s, s);
      }

      // field lines
      const line = (a = 0.85, width = 5) => { ctx.strokeStyle = `rgba(220,248,255,${a})`; ctx.lineWidth = width; };
      const marginX = px(-54), marginZ = pz(-35);
      line(0.9, 6);
      ctx.strokeRect(marginX, marginZ, px(54) - marginX, pz(35) - marginZ);
      line(0.78, 4);
      ctx.beginPath(); ctx.moveTo(px(0), marginZ); ctx.lineTo(px(0), pz(35)); ctx.stroke();
      ctx.beginPath(); ctx.arc(px(0), pz(0), (pz(10) - pz(0)), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px(0), pz(0), 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(220,248,255,0.9)'; ctx.fill();

      // goal boxes
      for (const side of [-1, 1]) {
        const gx = px(side * 54);
        const dir = -side;
        line(0.8, 4);
        ctx.strokeRect(
          Math.min(gx, gx + dir * (px(18) - px(0))),
          pz(-22),
          Math.abs(px(18) - px(0)),
          pz(22) - pz(-22)
        );
        ctx.strokeRect(
          Math.min(gx, gx + dir * (px(8) - px(0))),
          pz(-13),
          Math.abs(px(8) - px(0)),
          pz(13) - pz(-13)
        );
        // penalty arc
        ctx.beginPath();
        ctx.arc(gx + dir * (px(10) - px(0)), pz(0), pz(11) - pz(0), side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5);
        ctx.stroke();
      }

      // team crests
      for (const side of [-1, 1]) {
        const cx = px(side * 39), cy = pz(0);
        const col = side < 0 ? '#3fdcff' : '#ff9a3c';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = 0.24;
        ctx.strokeStyle = col; ctx.lineWidth = 5;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 3 * k + Math.PI / 6 + ring * 0.09;
            const rr = 66 + ring * 24;
            const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
            if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.stroke();
        }
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = col;
        ctx.font = '700 20px "Rajdhani", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(side < 0 ? 'BLUE' : 'ORANGE', 0, 6);
        ctx.restore();
      }

      // center mark
      ctx.save();
      ctx.translate(px(0), pz(0));
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = '#dbffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d8ffff';
      ctx.font = '700 22px "Russo One", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RL · 3D', 0, 8);
      ctx.restore();
    });
  }

  _buildField() {
    // large surrounding slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(166, 2.4, 126),
      new THREE.MeshStandardMaterial({ color: 0x070d15, metalness: 0.6, roughness: 0.45 })
    );
    slab.position.y = -1.22;
    slab.receiveShadow = true;
    this.group.add(slab);

    const tex = this._fieldTexture();
    tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.52,
      metalness: 0.18,
      envMapIntensity: 0.55,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.y = 0;
    this.group.add(floor);
    this.floor = floor;

    // subtle glowing boundary rails
    const railMat = neonMaterial(0x6ff2ff, 1.15);
    const railGeoX = new THREE.BoxGeometry(120, 0.09, 0.22);
    const railGeoZ = new THREE.BoxGeometry(0.22, 0.09, 80);
    for (const z of [-39.2, 39.2]) {
      const m = new THREE.Mesh(railGeoX, railMat);
      m.position.set(0, 0.05, z);
      this.group.add(m);
    }
    for (const x of [-59.2, 59.2]) {
      const m = new THREE.Mesh(railGeoZ, railMat);
      m.position.set(x, 0.05, 0);
      this.group.add(m);
    }
  }

  _buildWalls() {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x6fb8d8,
      metalness: 0.1,
      roughness: 0.12,
      transparent: true,
      opacity: 0.085,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.8,
    });
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x0d1824, metalness: 0.72, roughness: 0.34 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.9, roughness: 0.28 });
    const trimBlue = neonMaterial(C.blue, 1.15);
    const trimOrange = neonMaterial(C.orange, 1.15);
    const trimIce = neonMaterial(0xa9efff, 0.5, 0.55);

    const addBox = (w, h, d, x, y, z, mat, shadow = false) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = shadow;
      this.group.add(mesh);
      return mesh;
    };

    // side walls
    for (const side of [-1, 1]) {
      const z = side * 40.5;
      addBox(122, 5, 1.2, 0, 2.5, z, lowerMat);
      const glass = addBox(122, 23, 0.3, 0, 17.5, z, glassMat);
      glass.renderOrder = 2;
      // top rail
      addBox(122, 0.5, 1.4, 0, 29.2, z, frameMat);
      // vertical mullions
      for (let x = -60; x <= 60; x += 10) {
        addBox(0.36, 24, 1.45, x, 16.5, z, frameMat);
      }
      // neon strips
      const strip = new THREE.Mesh(new THREE.BoxGeometry(120, 0.12, 0.4), side < 0 ? trimBlue : trimOrange);
      strip.position.set(0, 9.8, z - side * 0.75);
      this.group.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(120, 0.08, 0.35), trimIce);
      strip2.position.set(0, 20.5, z - side * 0.7);
      this.group.add(strip2);

      // angled support braces
      for (let x = -50; x <= 50; x += 20) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 3.2), frameMat);
        brace.position.set(x, 7.7, z + side * 1.8);
        brace.rotation.x = side * 0.48;
        this.group.add(brace);
      }

      // sponsor boards
      for (let i = 0; i < 4; i++) {
        const board = this._sponsorBoard(i, side);
        board.position.set(-37 + i * 25, 5.1, z - side * 0.72);
        if (side > 0) board.rotation.y = Math.PI;
        this.group.add(board);
      }
    }

    // end walls, split around goal opening
    for (const side of [-1, 1]) {
      const x = side * 60.5;
      const teamTrim = side < 0 ? trimBlue : trimOrange;
      // side segments
      for (const zs of [-1, 1]) {
        addBox(1.2, 5, 27, x, 2.5, zs * 26.5, lowerMat);
        const glass = addBox(0.3, 23, 27, x, 17.5, zs * 26.5, glassMat);
        glass.renderOrder = 2;
        addBox(1.4, 0.5, 27, x, 29.2, zs * 26.5, frameMat);
      }
      // above goal
      addBox(1.2, 5, 26, x, 2.5, 0, lowerMat);
      addBox(1.3, 17, 26, x, 17.5, 0, glassMat);
      addBox(1.5, 0.5, 26, x, 29.2, 0, frameMat);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 80), teamTrim);
      strip.position.set(x - side * 0.7, 9.6, 0);
      this.group.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 80), trimIce);
      strip2.position.set(x - side * 0.7, 22.5, 0);
      this.group.add(strip2);

      // vertical mullions
      for (const z of [-37, -28, -20, 20, 28, 37]) {
        addBox(1.45, 24, 0.36, x, 16.5, z, frameMat);
      }
    }

    // ceiling truss grid (mostly atmosphere, bolted to walls)
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x192633, metalness: 0.85, roughness: 0.35 });
    for (let x = -50; x <= 50; x += 20) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 80), trussMat);
      beam.position.set(x, 30.6, 0);
      this.group.add(beam);
    }
    for (let z = -30; z <= 30; z += 20) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(120, 0.7, 0.7), trussMat);
      beam.position.set(0, 30.6, z);
      this.group.add(beam);
    }

    // rim light ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(48, 0.28, 8, 96), neonMaterial(0xc9f7ff, 1.25));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 30.2;
    this.group.add(ring);
  }

  _sponsorBoard(index, side) {
    const words = ['TURBO', 'NEON', 'BOOST', 'AERIAL'];
    const cols = ['#1fc8ff', '#ff7a18', '#9aeaff', '#ffc03f'];
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#08131f';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = 'rgba(100,190,230,.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 506, 122);
    ctx.strokeStyle = cols[index % cols.length];
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(26, 95); ctx.lineTo(84, 30); ctx.stroke();
    ctx.fillStyle = cols[index % cols.length];
    ctx.font = '700 54px "Russo One", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(words[index % words.length], 108, 83);
    ctx.fillStyle = 'rgba(170,225,250,.55)';
    ctx.font = '600 17px "Rajdhani", sans-serif';
    ctx.fillText('OMG ARENA SERIES', 110, 108);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    return new THREE.Mesh(new THREE.PlaneGeometry(20, 5), mat);
  }

  _netMaterial(color) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i <= 16; i++) {
      const p = i * 16;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(color).multiplyScalar(1.35),
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return mat;
  }

  _buildGoals() {
    const { goalWidth, goalHeight, goalDepth } = ARENA;
    this.goalFrames = [];
    for (const side of [-1, 1]) {
      const color = side < 0 ? C.blue : C.orange;
      const x = side * 60;
      const g = new THREE.Group();
      g.position.set(x, 0, 0);
      this.group.add(g);

      const frameMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.2,
        metalness: 0.7,
        roughness: 0.2,
        toneMapped: true,
      });
      const postW = 0.7;
      // posts
      for (const z of [-goalWidth / 2, goalWidth / 2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(postW, goalHeight, postW), frameMat);
        post.position.set(0, goalHeight / 2, z);
        g.add(post);
      }
      // crossbar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(postW, postW, goalWidth + postW), frameMat);
      bar.position.set(0, goalHeight, 0);
      g.add(bar);
      // inner goal frame trim
      const trimMat = neonMaterial(color, 2.4);
      const glowBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, goalWidth - 1), trimMat);
      glowBar.position.set(-side * 0.6, goalHeight - 0.45, 0);
      g.add(glowBar);

      // net planes
      const netMat = this._netMaterial(side < 0 ? '#55ddff' : '#ffac55');
      const back = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight), netMat);
      back.rotation.y = -side * Math.PI / 2;
      back.position.set(side * goalDepth, goalHeight / 2, 0);
      g.add(back);
      for (const z of [-goalWidth / 2, goalWidth / 2]) {
        const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalHeight), netMat);
        sideNet.rotation.y = 0;
        sideNet.position.set(side * goalDepth / 2, goalHeight / 2, z);
        g.add(sideNet);
      }
      const top = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalWidth), netMat);
      top.rotation.x = Math.PI / 2;
      top.position.set(side * goalDepth / 2, goalHeight, 0);
      g.add(top);

      // goal floor glow
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(goalDepth, goalWidth),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(side * goalDepth / 2, 0.05, 0);
      g.add(glow);

      // goal mouth light strip on floor
      const mouth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, goalWidth),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      mouth.rotation.x = -Math.PI / 2;
      mouth.position.set(-side * 0.4, 0.07, 0);
      g.add(mouth);

      this.goalFrames.push({ side, group: g, color, frameMat, light: this.goalLights[side] });
    }
  }

  _buildStands() {
    const standMat = new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.52, roughness: 0.55 });
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x101c2a, metalness: 0.35, roughness: 0.72 });
    const accentBlue = neonMaterial(C.blue, 1.25);
    const accentOrange = neonMaterial(C.orange, 1.25);

    // side stands
    for (const side of [-1, 1]) {
      for (let row = 0; row < 8; row++) {
        const z = side * (47 + row * 3.5);
        const y = 1.1 + row * 1.35;
        const step = new THREE.Mesh(new THREE.BoxGeometry(114, 1.35, 3.55), row % 2 ? standMat : stepMat);
        step.position.set(0, y, z);
        step.receiveShadow = true;
        this.group.add(step);
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(118, 18, 1.5), standMat);
      wall.position.set(0, 10, side * 74);
      this.group.add(wall);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(116, 0.22, 0.5), side < 0 ? accentBlue : accentOrange);
      trim.position.set(0, 17.5, side * 73.2);
      this.group.add(trim);
    }

    // end stands behind goals
    for (const side of [-1, 1]) {
      for (let row = 0; row < 6; row++) {
        const x = side * (70 + row * 3.2);
        const y = 1.1 + row * 1.35;
        const step = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.35, 68), row % 2 ? stepMat : standMat);
        step.position.set(x, y, 0);
        this.group.add(step);
      }
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 16, 74), standMat);
      wall.position.set(side * 90, 9, 0);
      this.group.add(wall);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 72), side < 0 ? accentBlue : accentOrange);
      trim.position.set(side * 89.2, 15.5, 0);
      this.group.add(trim);
    }
  }

  _buildCrowd() {
    const count = 3600;
    const geo = new THREE.BoxGeometry(0.52, 1.02, 0.46);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = [
      0x1b4a66, 0x173b52, 0x255d7a, 0x404852, 0x2b3340,
      0x1ac8ff, 0x1889cc, 0xff7a18, 0xffb34f, 0xd8ecff,
      0x8c1f27, 0x3e2a5e, 0x145c4c,
    ];
    let idx = 0;
    const place = (x, y, z) => {
      if (idx >= count) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(0.8 + Math.random() * 0.45, 0.8 + Math.random() * 0.42, 0.8 + Math.random() * 0.35);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      const c = palette[Math.floor(Math.random() * palette.length)];
      color.setHex(c).multiplyScalar(0.42 + Math.random() * 0.55);
      mesh.setColorAt(idx, color);
      idx++;
    };

    // side crowd
    for (let row = 0; row < 8; row++) {
      const y = 2.25 + row * 1.35;
      const z = 47 + row * 3.5;
      for (let i = 0; i < 190; i++) {
        const x = -57 + (i / 189) * 114 + (Math.random() - 0.5) * 0.55;
        if (Math.random() < 0.12) continue;
        place(x, y, z + (Math.random() - 0.5) * 1.8);
        if (Math.random() < 0.78) place(x + (Math.random() - 0.5) * 0.65, y, -z + (Math.random() - 0.5) * 1.8);
      }
    }
    // end crowd
    for (let row = 0; row < 6; row++) {
      const y = 2.25 + row * 1.35;
      const x = 70 + row * 3.2;
      for (let i = 0; i < 120; i++) {
        const z = -33 + (i / 119) * 66 + (Math.random() - 0.5) * 0.55;
        if (Math.random() < 0.14) continue;
        place(x + (Math.random() - 0.5) * 1.4, y, z);
        if (Math.random() < 0.76) place(-x + (Math.random() - 0.5) * 1.4, y, z);
      }
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);

    // camera flashes
    const n = 110;
    const pos = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      let x, y, z;
      if (side < 2) {
        x = -56 + Math.random() * 112;
        z = (side === 0 ? 1 : -1) * (48 + Math.random() * 24);
        y = 2.6 + Math.random() * 11.5;
      } else {
        x = (side === 2 ? 1 : -1) * (71 + Math.random() * 18);
        z = -33 + Math.random() * 66;
        y = 2.6 + Math.random() * 10;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      colors[i * 3] = 0; colors[i * 3 + 1] = 0; colors[i * 3 + 2] = 0;
      this.flashes.push({ next: Math.random() * 5, life: 0 });
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    fg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const fm = new THREE.PointsMaterial({
      size: 1.7, map: this._glowTexture(), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9,
    });
    this.flashPoints = new THREE.Points(fg, fm);
    this.flashPoints.frustumCulled = false;
    this.group.add(this.flashPoints);
  }

  _glowTexture() {
    if (this._glowTex) return this._glowTex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.9)');
    g.addColorStop(0.55, 'rgba(255,255,255,.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    this._glowTex = new THREE.CanvasTexture(cv);
    return this._glowTex;
  }

  _screenTexture() {
    const cv = document.createElement('canvas');
    cv.width = 768; cv.height = 384;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { cv, ctx: cv.getContext('2d'), tex };
  }

  _drawScreen(screen) {
    const { ctx, cv } = screen;
    const s = this.screenState;
    ctx.fillStyle = '#050d18';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // grid
    ctx.strokeStyle = 'rgba(40,170,220,.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cv.width; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
    }
    for (let y = 0; y < cv.height; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
    }
    // header
    ctx.fillStyle = 'rgba(16, 50, 78, .9)';
    ctx.fillRect(0, 0, cv.width, 58);
    ctx.fillStyle = '#86e6ff';
    ctx.font = '700 24px "Russo One", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OMG ARENA', 24, 39);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#577e95';
    ctx.font = '600 19px "Rajdhani", sans-serif';
    ctx.fillText('LIVE · NEON DOME', cv.width - 24, 37);

    // score blocks
    const bx = 52, bw = 270, by = 86, bh = 172;
    ctx.fillStyle = 'rgba(14, 70, 105, .55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(105, 42, 10, .55)';
    ctx.fillRect(cv.width - bx - bw, by, bw, bh);
    ctx.strokeStyle = '#2bd5ff'; ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ff8a2e';
    ctx.strokeRect(cv.width - bx - bw, by, bw, bh);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#45d6ff';
    ctx.font = '700 31px "Russo One", sans-serif';
    ctx.fillText('BLUE', bx + bw / 2, by + 44);
    ctx.fillStyle = '#ff9b48';
    ctx.fillText('ORANGE', cv.width - bx - bw / 2, by + 44);
    ctx.font = '700 84px "Russo One", sans-serif';
    ctx.fillStyle = '#eafcff';
    ctx.fillText(String(s.blue), bx + bw / 2, by + 132);
    ctx.fillStyle = '#fff1e4';
    ctx.fillText(String(s.orange), cv.width - bx - bw / 2, by + 132);

    // center clock
    ctx.fillStyle = '#e9f9ff';
    ctx.font = '700 53px "Russo One", sans-serif';
    ctx.fillText(s.clock, cv.width / 2, 178);
    ctx.fillStyle = '#58839c';
    ctx.font = '700 15px "Rajdhani", sans-serif';
    ctx.fillText(s.label, cv.width / 2, 204);
    ctx.strokeStyle = 'rgba(100,220,255,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cv.width / 2 - 55, 224); ctx.lineTo(cv.width / 2 + 55, 224); ctx.stroke();

    // bottom ticker
    ctx.fillStyle = 'rgba(14, 42, 64, .85)';
    ctx.fillRect(0, cv.height - 54, cv.width, 54);
    ctx.fillStyle = '#8de9ff';
    ctx.font = '600 18px "Rajdhani", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ROCKET LEAGUE 3D  //  CAR SOCCER', 24, cv.height - 21);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffab52';
    ctx.fillText('SEASON 01', cv.width - 24, cv.height - 21);

    screen.tex.needsUpdate = true;
  }

  _buildScreens() {
    this.screens = [];
    const mat = () => {
      const s = this._screenTexture();
      this._drawScreen(s);
      this.screens.push(s);
      return new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false });
    };
    // side broadcast boards
    for (const side of [-1, 1]) {
      for (const x of [-28, 28]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), mat());
        m.position.set(x, 18.8, side * 39.6);
        m.rotation.y = side < 0 ? 0 : Math.PI;
        this.group.add(m);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(25.2, 13.1, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x101c28, metalness: 0.8, roughness: 0.35 })
        );
        frame.position.set(x, 18.8, side * 39.95);
        this.group.add(frame);
      }
    }
  }

  setScore(blue, orange, clock, label) {
    if (this.screenState.blue === blue && this.screenState.orange === orange && this.screenState.clock === clock && this.screenState.label === label) return;
    this.screenState = { blue, orange, clock, label };
    for (const s of this.screens) this._drawScreen(s);
  }

  _buildBoostPads() {
    const smallPositions = [
      [0, 0], [0, -17], [0, 17], [-20, -26], [-20, 26], [20, -26], [20, 26],
      [-36, 0], [36, 0], [-12, -34], [-12, 34], [12, -34], [12, 34],
    ];
    const bigPositions = [[-48, -30], [-48, 30], [48, -30], [48, 30]];
    for (const [x, z] of smallPositions) this._addPad(x, z, false);
    for (const [x, z] of bigPositions) this._addPad(x, z, true);
  }

  _addPad(x, z, big) {
    const group = new THREE.Group();
    group.position.set(x, 0.12, z);
    this.group.add(group);
    const color = big ? 0xffb01e : 0xffdf6a;
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(big ? 1.8 : 1.1),
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(big ? 1.55 : 0.72, big ? 1.95 : 0.94, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(big ? 1.45 : 0.62, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.02;
    group.add(inner);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(big ? 0.6 : 0.32, 16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5, metalness: 0.2, roughness: 0.3 })
    );
    orb.position.y = big ? 1.0 : 0.55;
    group.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTexture(), color: new THREE.Color(color).multiplyScalar(1.5), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, toneMapped: false,
    }));
    halo.scale.setScalar(big ? 5.5 : 2.6);
    halo.position.y = big ? 1.1 : 0.6;
    group.add(halo);

    this.pads.push({
      x, z, big, group, orb, halo, ring,
      radius: big ? 4 : 2.3,
      active: true,
      timer: 0,
      respawn: big ? 10 : 4,
      phase: Math.random() * Math.PI * 2,
    });
  }

  takePad(pad) {
    pad.active = false;
    pad.timer = pad.respawn;
    pad.group.visible = false;
    return pad.big ? 100 : 12;
  }

  _buildAtmosphere() {
    // floating dust
    const n = 420;
    const pos = new Float32Array(n * 3);
    this.dustSeeds = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 110;
      pos[i * 3 + 1] = 1 + Math.random() * 24;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 74;
      this.dustSeeds.push({ speed: 0.12 + Math.random() * 0.35, phase: Math.random() * Math.PI * 2 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x9bdcff, size: 0.16, transparent: true, opacity: 0.36,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.dust = new THREE.Points(g, m);
    this.group.add(this.dust);

    // distant arena halo sprites
    for (const side of [-1, 1]) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._glowTexture(), color: side < 0 ? C.blue : C.orange,
        transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      halo.scale.set(40, 26, 1);
      halo.position.set(side * 88, 10, 0);
      this.group.add(halo);
    }
  }

  update(dt, elapsed, ballPos) {
    this.time += dt;
    // pads
    for (const pad of this.pads) {
      if (pad.active) {
        pad.orb.position.y = (pad.big ? 1.0 : 0.55) + Math.sin(elapsed * 2.4 + pad.phase) * 0.16;
        pad.orb.rotation.y += dt * 1.3;
        pad.halo.material.opacity = 0.62 + Math.sin(elapsed * 3 + pad.phase) * 0.18;
        pad.ring.rotation.z += dt * 0.35;
      } else {
        pad.timer -= dt;
        if (pad.timer <= 0) {
          pad.active = true;
          pad.group.visible = true;
          pad.group.scale.setScalar(0.01);
        }
      }
      if (pad.active && pad.group.scale.x < 1) {
        const s = Math.min(1, pad.group.scale.x + dt * 2.6);
        pad.group.scale.setScalar(s);
        pad.group.rotation.y = (1 - s) * Math.PI * 2;
      }
    }

    // crowd flashes
    const colors = this.flashPoints.geometry.attributes.color;
    for (let i = 0; i < this.flashes.length; i++) {
      const f = this.flashes[i];
      f.next -= dt;
      if (f.next <= 0) {
        f.next = 0.9 + Math.random() * 6.5;
        f.life = 0.1 + Math.random() * 0.16;
      }
      let v = 0;
      if (f.life > 0) {
        f.life -= dt;
        v = Math.random() > 0.24 ? 2.3 : 0.2;
      }
      colors.array[i * 3] = v;
      colors.array[i * 3 + 1] = v;
      colors.array[i * 3 + 2] = v * 1.12;
    }
    colors.needsUpdate = true;

    // dust drift
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < this.dustSeeds.length; i++) {
      const seed = this.dustSeeds[i];
      p.array[i * 3 + 1] += dt * seed.speed * 0.5;
      if (p.array[i * 3 + 1] > 25) p.array[i * 3 + 1] = 1.2;
    }
    p.needsUpdate = true;

    // subtle goal light breathing
    if (this.goalLights) {
      const pulse = 0.86 + Math.sin(elapsed * 1.7) * 0.08;
      this.goalLights[-1].intensity = 220 * pulse;
      this.goalLights[1].intensity = 220 * pulse;
    }
  }

  goalFlash(side, intensity = 1) {
    const light = this.goalLights[side];
    if (!light) return;
    light.intensity = 220 + 900 * intensity;
    setTimeout(() => { light.intensity = 220; }, 900);
  }
}
