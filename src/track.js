import * as THREE from 'three';
import {
  TAU,
  clamp,
  makeCanvasTexture,
  makeBasis,
  quaternionFromFrame,
  smootherstep,
  wrap,
} from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);

const CONTROL_POINTS = [
  [0, 12, 60],
  [0, 12, 24],
  [16, 14, -7],
  [50, 18, -25],
  [84, 26, -53],
  [94, 40, -91],
  [72, 55, -124],
  [32, 62, -136],
  [-8, 60, -128],
  [-28, 52, -102],
  [-18, 40, -70],
  [-44, 30, -46],
  [-82, 24, -34],
  [-112, 18, -2],
  [-114, 14, 42],
  [-90, 12, 78],
  [-50, 12, 94],
  [-10, 12, 94],
];

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.width = 18.4;
    this.roadHalf = 7.35;
    this.edgeHalf = 9.2;
    this.group = new THREE.Group();
    this.group.name = 'orbital-track';
    this.scene.add(this.group);

    const points = CONTROL_POINTS.map((p) => new THREE.Vector3(...p));
    this.curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    this.samples = 1800;
    this.frames = [];
    this._buildFrames();
    this._buildTrackMesh();
    this._buildStartGate();
    this._buildGravityRings();
    this._buildBoostPads();
    this._buildMapPoints();
    this._buildDecorations();
  }

  rollAt(u) {
    const uu = wrap(u);
    const first = smootherstep(0.29, 0.43, uu);
    const second = smootherstep(0.6, 0.74, uu);
    return TAU * (first - second);
  }

  gravityAmount(u) {
    const uu = wrap(u);
    const a = 1 - Math.abs(clamp((uu - 0.36) / 0.09, -1, 1));
    const b = 1 - Math.abs(clamp((uu - 0.67) / 0.09, -1, 1));
    return clamp(Math.max(a, b), 0, 1);
  }

  inGravityZone(u) {
    const uu = wrap(u);
    return (uu > 0.285 && uu < 0.445) || (uu > 0.595 && uu < 0.75);
  }

  _buildFrames() {
    const n = this.samples;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const pos = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      let baseRight = new THREE.Vector3().crossVectors(tangent, UP);
      if (baseRight.lengthSq() < 0.0001) baseRight.set(1, 0, 0);
      baseRight.normalize();
      const baseUp = new THREE.Vector3().crossVectors(baseRight, tangent).normalize();

      const roll = this.rollAt(u);
      const c = Math.cos(roll);
      const s = Math.sin(roll);
      const right = baseRight.clone().multiplyScalar(c).addScaledVector(baseUp, s).normalize();
      const up = baseUp.clone().multiplyScalar(c).addScaledVector(baseRight, -s).normalize();
      const quat = quaternionFromFrame(right, up, tangent);

      this.frames.push({ u, pos, tangent, right, up, roll, quat });
    }
  }

  getFrame(u, out = {}) {
    const uu = wrap(u);
    const f = uu * this.samples;
    const i0 = Math.floor(f) % this.samples;
    const i1 = (i0 + 1) % this.samples;
    const t = f - Math.floor(f);
    const a = this.frames[i0];
    const b = this.frames[i1];

    const pos = out.pos || new THREE.Vector3();
    const tangent = out.tangent || new THREE.Vector3();
    const right = out.right || new THREE.Vector3();
    const up = out.up || new THREE.Vector3();

    pos.lerpVectors(a.pos, b.pos, t);
    tangent.lerpVectors(a.tangent, b.tangent, t).normalize();
    up.lerpVectors(a.up, b.up, t).normalize();
    right.crossVectors(tangent, up).normalize();
    up.crossVectors(right, tangent).normalize();

    out.pos = pos;
    out.tangent = tangent;
    out.right = right;
    out.up = up;
    out.u = uu;
    out.roll = this.rollAt(uu);
    out.quat = quaternionFromFrame(right, up, tangent);
    return out;
  }

  pointAt(u, lateral = 0, height = 0) {
    const f = this.getFrame(u);
    return f.pos.clone().addScaledVector(f.right, lateral).addScaledVector(f.up, height);
  }

  _buildTrackMesh() {
    const roadTexture = makeCanvasTexture(
      256,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#241c48';
        ctx.fillRect(0, 0, w, h);
        const rng = (x) => {
          const v = Math.sin(x * 127.1) * 43758.5453;
          return v - Math.floor(v);
        };
        for (let i = 0; i < 1400; i++) {
          const x = rng(i * 2.17) * w;
          const y = rng(i * 3.31 + 9) * h;
          const a = 0.02 + rng(i * 5.7) * 0.08;
          ctx.fillStyle = rng(i * 7.1) > 0.5 ? `rgba(150,130,255,${a})` : `rgba(255,255,255,${a * 0.5})`;
          const r = 0.4 + rng(i * 1.9) * 1.6;
          ctx.fillRect(x, y, r, r);
        }
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'rgba(84,247,255,.08)');
        grad.addColorStop(0.5, 'rgba(255,45,126,.035)');
        grad.addColorStop(1, 'rgba(84,247,255,.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      },
      { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [1, 90] }
    );

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      color: 0x7b70c9,
      roughness: 0.78,
      metalness: 0.24,
      emissive: 0x0a0620,
      emissiveIntensity: 0.4,
    });

    const edgeL = new THREE.MeshStandardMaterial({
      color: 0x3a0b3c,
      emissive: 0xff2d7e,
      emissiveIntensity: 1.15,
      roughness: 0.35,
      metalness: 0.4,
    });
    const edgeR = new THREE.MeshStandardMaterial({
      color: 0x0b3340,
      emissive: 0x54f7ff,
      emissiveIntensity: 1.15,
      roughness: 0.35,
      metalness: 0.4,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x191133,
      roughness: 0.55,
      metalness: 0.65,
      side: THREE.DoubleSide,
    });
    const underMat = new THREE.MeshStandardMaterial({
      color: 0x120c29,
      roughness: 0.75,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const glowL = new THREE.MeshBasicMaterial({ color: 0xff4f9a, transparent: true, opacity: 0.55, toneMapped: true });
    const glowR = new THREE.MeshBasicMaterial({ color: 0x42dceb, transparent: true, opacity: 0.55, toneMapped: true });

    const road = new THREE.Mesh(this._ribbon(-this.roadHalf, this.roadHalf, 0, 1), roadMat);
    road.receiveShadow = true;
    this.group.add(road);

    const leftEdge = new THREE.Mesh(this._ribbon(-this.edgeHalf, -this.roadHalf, 0.015, 0.02), edgeL);
    const rightEdge = new THREE.Mesh(this._ribbon(this.roadHalf, this.edgeHalf, 0.015, 0.02), edgeR);
    this.group.add(leftEdge, rightEdge);

    this.group.add(new THREE.Mesh(this._vertical(-this.edgeHalf, 0, 1.18, -1), railMat));
    this.group.add(new THREE.Mesh(this._vertical(this.edgeHalf, 0, 1.18, 1), railMat));
    this.group.add(new THREE.Mesh(this._vertical(-this.edgeHalf, 0, -1.35, -1), underMat));
    this.group.add(new THREE.Mesh(this._vertical(this.edgeHalf, 0, -1.35, 1), underMat));
    this.group.add(new THREE.Mesh(this._ribbon(-this.edgeHalf, this.edgeHalf, -1.36, 1, -1), underMat));

    this.group.add(new THREE.Mesh(this._ribbon(-this.edgeHalf - 0.02, -this.edgeHalf + 0.2, 1.19, 0.02), glowL));
    this.group.add(new THREE.Mesh(this._ribbon(this.edgeHalf - 0.2, this.edgeHalf + 0.02, 1.19, 0.02), glowR));
    this.group.add(new THREE.Mesh(this._ribbon(-this.edgeHalf - 0.02, -this.edgeHalf + 0.22, -1.36, 0.02, -1), glowL));
    this.group.add(new THREE.Mesh(this._ribbon(this.edgeHalf - 0.22, this.edgeHalf + 0.02, -1.36, 0.02, -1), glowR));

    // Dashed center line.
    const dashVerts = [];
    const dashNormals = [];
    const dashUvs = [];
    const dashIndices = [];
    const dashCount = 110;
    for (let i = 0; i < dashCount; i++) {
      const u0 = i / dashCount;
      const u1 = u0 + 0.0042;
      const fa = this.getFrame(u0);
      const fb = this.getFrame(u1);
      const base = dashVerts.length / 3;
      for (const [f, side] of [
        [fa, -0.16],
        [fa, 0.16],
        [fb, 0.16],
        [fb, -0.16],
      ]) {
        const p = f.pos.clone().addScaledVector(f.right, side).addScaledVector(f.up, 0.026);
        dashVerts.push(p.x, p.y, p.z);
        dashNormals.push(f.up.x, f.up.y, f.up.z);
        dashUvs.push(side > 0 ? 1 : 0, i / dashCount);
      }
      dashIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashVerts, 3));
    dashGeo.setAttribute('normal', new THREE.Float32BufferAttribute(dashNormals, 3));
    dashGeo.setAttribute('uv', new THREE.Float32BufferAttribute(dashUvs, 2));
    dashGeo.setIndex(dashIndices);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xfff2d8,
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.group.add(new THREE.Mesh(dashGeo, dashMat));

    // Start / finish checker plate.
    const checkerTex = makeCanvasTexture(512, 128, (ctx, w, h) => {
      const cols = 16;
      const rows = 4;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          ctx.fillStyle = (x + y) % 2 ? '#f9f1dc' : '#171128';
          ctx.fillRect((x * w) / cols, (y * h) / rows, w / cols + 1, h / rows + 1);
        }
      }
    });
    const lineFrame = this.getFrame(0);
    const lineGroup = new THREE.Group();
    lineGroup.position.copy(lineFrame.pos).addScaledVector(lineFrame.up, 0.045);
    lineGroup.quaternion.copy(lineFrame.quat);
    const lineMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width - 0.3, 3.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: checkerTex, toneMapped: false })
    );
    lineGroup.add(lineMesh);
    this.group.add(lineGroup);
  }

  _ribbon(latA, latB, yOffset, uvRepeat = 1, normalSign = 1) {
    const n = this.samples;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= n; i++) {
      const f = this.frames[i % n];
      for (const lat of [latA, latB]) {
        const p = f.pos.clone().addScaledVector(f.right, lat).addScaledVector(f.up, yOffset);
        positions.push(p.x, p.y, p.z);
        normals.push(f.up.x * normalSign, f.up.y * normalSign, f.up.z * normalSign);
        uvs.push(lat === latA ? 0 : 1, (i / n) * uvRepeat);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  _vertical(lat, yA, yB, normalSign) {
    const n = this.samples;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= n; i++) {
      const f = this.frames[i % n];
      for (const y of [yA, yB]) {
        const p = f.pos.clone().addScaledVector(f.right, lat).addScaledVector(f.up, y);
        positions.push(p.x, p.y, p.z);
        normals.push(f.right.x * normalSign, f.right.y * normalSign, f.right.z * normalSign);
        uvs.push(0, (i / n) * 40);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  _buildStartGate() {
    const f = this.getFrame(0);
    const gate = new THREE.Group();
    gate.position.copy(f.pos);
    gate.quaternion.copy(f.quat);
    gate.position.addScaledVector(f.up, 0.05);

    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1138, roughness: 0.45, metalness: 0.6 });
    const light = new THREE.MeshStandardMaterial({
      color: 0x2a1558,
      emissive: 0x6d3cff,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0.5,
    });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x54f7ff, toneMapped: false });
    const pink = new THREE.MeshBasicMaterial({ color: 0xff2d7e, toneMapped: false });

    for (const side of [-1, 1]) {
      const pillar = new THREE.Group();
      pillar.position.set(side * 11.8, 0, 0);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 12, 8), dark);
      body.position.y = 6;
      pillar.add(body);
      const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.71, 0.96, 0.2, 8), side < 0 ? pink : cyan);
      trim.position.y = 1.2;
      pillar.add(trim);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.2, 8), light);
      cap.position.y = 12.4;
      pillar.add(cap);
      gate.add(pillar);
    }

    const bannerTex = makeCanvasTexture(1024, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#ff2d7e');
      g.addColorStop(0.48, '#ff9f43');
      g.addColorStop(1, '#54f7ff');
      ctx.fillStyle = '#100924';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, h - 8, w, 8);
      ctx.font = '900 88px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff4df';
      ctx.fillText('GRAVITY CUP', w / 2, h / 2 - 10);
      ctx.font = '900 24px "Arial Black", sans-serif';
      ctx.fillStyle = '#54f7ff';
      ctx.letterSpacing = '12px';
      ctx.fillText('ORBITAL CIRCUIT  //  SECTOR 01', w / 2, h / 2 + 62);
    });

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(22.4, 5.6),
      new THREE.MeshStandardMaterial({
        map: bannerTex,
        emissiveMap: bannerTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.24,
        roughness: 0.5,
        metalness: 0.2,
        side: THREE.DoubleSide,
      })
    );
    banner.position.y = 11.5;
    gate.add(banner);

    const topGlow = new THREE.Mesh(new THREE.BoxGeometry(22.8, 0.16, 0.16), cyan);
    topGlow.position.set(0, 14.3, 0);
    gate.add(topGlow);
    const bottomGlow = new THREE.Mesh(new THREE.BoxGeometry(22.8, 0.12, 0.12), pink);
    bottomGlow.position.set(0, 8.65, 0);
    gate.add(bottomGlow);

    // Countdown pods above the banner.
    const pods = [];
    for (let i = 0; i < 3; i++) {
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x25173f, toneMapped: false })
      );
      pod.position.set((i - 1) * 1.3, 14.9, 0);
      gate.add(pod);
      pods.push(pod);
    }

    this.startGate = gate;
    this.startPods = pods;
    this.group.add(gate);
  }

  _buildGravityRings() {
    const ringMatA = new THREE.MeshStandardMaterial({
      color: 0x281148,
      emissive: 0x54f7ff,
      emissiveIntensity: 2.5,
      roughness: 0.3,
      metalness: 0.6,
    });
    const ringMatB = new THREE.MeshStandardMaterial({
      color: 0x3c103d,
      emissive: 0xff2d7e,
      emissiveIntensity: 2.5,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.rings = [];
    const spots = [
      [0.305, 20.5, ringMatA],
      [0.335, 21.5, ringMatB],
      [0.365, 22.2, ringMatA],
      [0.395, 21.5, ringMatB],
      [0.425, 20.5, ringMatA],
      [0.615, 20.5, ringMatB],
      [0.645, 21.5, ringMatA],
      [0.675, 22.2, ringMatB],
      [0.705, 21.5, ringMatA],
      [0.735, 20.5, ringMatB],
    ];
    for (const [u, radius, mat] of spots) {
      const f = this.getFrame(u);
      const group = new THREE.Group();
      group.position.copy(f.pos);
      group.quaternion.copy(f.quat);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.28, 6, 64), mat);
      group.add(torus);
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(radius - 2.2, 0.08, 4, 64),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, toneMapped: false })
      );
      group.add(inner);
      this.group.add(group);
      this.rings.push({ u, group, torus, inner });
    }
  }

  _buildBoostPads() {
    const tex = makeCanvasTexture(256, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const y = 90 + i * 135;
        ctx.beginPath();
        ctx.moveTo(42, y);
        ctx.lineTo(w / 2, y + 88);
        ctx.lineTo(w - 42, y);
        ctx.lineTo(w - 42, y + 50);
        ctx.lineTo(w / 2, y + 138);
        ctx.lineTo(42, y + 50);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, y, 0, y + 140);
        g.addColorStop(0, '#fff7d0');
        g.addColorStop(0.4, '#54f7ff');
        g.addColorStop(1, '#ff2d7e');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowColor = '#54f7ff';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.boostPads = [];
    const pads = [
      [0.128, -3.2],
      [0.128, 3.2],
      [0.505, 0],
      [0.815, -3.4],
      [0.815, 3.4],
    ];
    for (const [u, lat] of pads) {
      const f = this.getFrame(u);
      const group = new THREE.Group();
      group.position.copy(f.pos).addScaledVector(f.up, 0.05);
      group.quaternion.copy(f.quat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 8.4).rotateX(-Math.PI / 2), mat);
      mesh.position.x = lat;
      group.add(mesh);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(6.6, 10.2).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      glow.position.set(lat, -0.01, 0);
      group.add(glow);
      this.group.add(group);
      this.boostPads.push({ u, lat, width: 5.4, length: 8.4, group, mesh, glow });
    }
  }

  _buildMapPoints() {
    this.mapPoints = [];
    const n = 220;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = this.curve.getPointAt(i / n);
      this.mapPoints.push([p.x, p.z]);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    this.mapBounds = { minX, maxX, minZ, maxZ };
    this.gravityMapZones = [
      [0.29, 0.43],
      [0.6, 0.74],
    ];
  }

  _buildDecorations() {
    // Tiny glowing beacons along the track shoulder.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x54f7ff, toneMapped: false });
    const beaconMatB = new THREE.MeshBasicMaterial({ color: 0xff2d7e, toneMapped: false });
    const geo = new THREE.CylinderGeometry(0.06, 0.12, 1.4, 5);
    const count = 54;
    const left = [];
    const right = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const u = i / count + 0.004;
      const f = this.getFrame(u);
      const side = i % 2 === 0 ? -1 : 1;
      dummy.position
        .copy(f.pos)
        .addScaledVector(f.right, side * (this.edgeHalf + 0.35))
        .addScaledVector(f.up, 0.7);
      dummy.quaternion.copy(f.quat);
      dummy.updateMatrix();
      (side < 0 ? left : right).push(dummy.matrix.clone());
    }
    for (const [list, mat] of [
      [left, beaconMatB],
      [right, beaconMat],
    ]) {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      for (let i = 0; i < list.length; i++) inst.setMatrixAt(i, list[i]);
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      this.group.add(inst);
    }
  }

}
