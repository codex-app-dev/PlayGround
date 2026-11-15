import * as THREE from 'three';
import {
  clamp, lerp, smoothstep, groundHeight, asphaltTexture, concreteTexture,
  gridTexture, makeCanvas, TAU, rand, noise2, fbm,
} from './util.js';

const Y_ROAD = 0.02;
const Y_LINE = 0.045;

function ribbon(scene, points, width, y, material, uRepeat = 40) {
  // points: array of {x,z}; builds a flat strip of given width
  const verts = [], uvs = [], idx = [];
  const n = points.length;
  const pos = new THREE.Vector3(), posN = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const next = points[Math.min(n - 1, i + 1)];
    const prev = points[Math.max(0, i - 1)];
    let dx = next.x - prev.x, dz = next.z - prev.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const nx = -dz, nz = dx;
    verts.push(p.x + nx * width / 2, y, p.z + nz * width / 2);
    verts.push(p.x - nx * width / 2, y, p.z - nz * width / 2);
    const u = i / (n - 1) * uRepeat;
    uvs.push(u, 0, u, 1);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, c, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}

function ellipsePoints(rx, rz, n = 256) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    pts.push({ x: Math.cos(a) * rx, z: Math.sin(a) * rz });
  }
  return pts;
}

function makeTextTexture(text, w = 512, h = 128, bg = '#15181c', fg = '#ff9d3d', sub = '') {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.lineWidth = 6;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg;
  g.font = `800 ${Math.floor(h * 0.42)}px "Arial Narrow", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h * (sub ? 0.42 : 0.5));
  if (sub) {
    g.fillStyle = '#cfd6dd';
    g.font = `600 ${Math.floor(h * 0.15)}px monospace`;
    g.fillText(sub, w / 2, h * 0.78);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.cylinders = [];
    this.ramps = [];
    this.checkpoints = [];
    this.trees = [];
    this.dynamic = [];
    this.onPropHit = null;
    this.skidGroups = [];

    this.buildGround();
    this.buildRoads();
    this.buildMarkings();
    this.buildRamps();
    this.buildCrashZone();
    this.buildProps();
    this.buildScenery();
    this.buildCheckpoints();
  }

  /* ---------------- terrain ---------------- */
  buildGround() {
    const size = 1700, seg = 190;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = groundHeight(x, z);
      pos.setY(i, h);
      const n = fbm(x * 0.05, z * 0.05, 2);
      const rocky = smoothstep(18, 62, h);
      const sand = smoothstep(140, 235, Math.hypot(x, z)) * 0.0;
      c.setRGB(
        lerp(0.25 + n * 0.04, 0.43 + n * 0.05, rocky) + sand,
        lerp(0.36 + n * 0.05, 0.42 + n * 0.04, rocky),
        lerp(0.19 + n * 0.03, 0.35 + n * 0.04, rocky)
      );
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    this.buildMountains();
  }

  buildMountains() {
    const layers = [
      { baseR: 690, peakR: 850, minH: 40, maxH: 170, color: 0x6b7368, seed: 3.2 },
      { baseR: 880, peakR: 1150, minH: 120, maxH: 300, color: 0x8d97a0, seed: 8.7 },
      { baseR: 1200, peakR: 1600, minH: 200, maxH: 430, color: 0xa5adb5, seed: 15.1 },
    ];
    for (const L of layers) {
      const N = 220;
      const positions = [], colors = [], idx = [];
      const col = new THREE.Color(L.color);
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU;
        const n = fbm(Math.cos(a) * 3 + L.seed, Math.sin(a) * 3 + L.seed, 4) * 0.5 + 0.5;
        const spike = Math.pow(Math.abs(Math.sin(a * 7.3 + L.seed)), 2) * 0.3;
        const h = L.minH + (L.maxH - L.minH) * (n * 0.85 + spike + 0.08);
        const baseH = groundHeight(Math.cos(a) * L.baseR, Math.sin(a) * L.baseR) - 6;
        positions.push(Math.cos(a) * L.baseR, baseH, Math.sin(a) * L.baseR);
        positions.push(Math.cos(a) * L.peakR, baseH + h, Math.sin(a) * L.peakR);
        const tint = 0.82 + n * 0.3;
        colors.push(col.r * 0.7, col.g * 0.7, col.b * 0.7);
        colors.push(col.r * tint, col.g * tint, col.b * tint);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, c, d, b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = false;
      this.scene.add(mesh);
    }
  }
  buildRoads() {
    const asphalt = asphaltTexture(512, '#3a3f45');
    asphalt.repeat.set(38, 38);
    const gridTex = gridTexture(1, 512);
    gridTex.repeat.set(18.6, 18.6);
    const gridMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.9, metalness: 0.02, color: 0xc9cdd2 });
    const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(186, 186), gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = Y_ROAD;
    gridMesh.receiveShadow = true;
    this.scene.add(gridMesh);

    // gridmap outer border
    const border = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), new THREE.MeshBasicMaterial({ color: 0xd9dfe4 }));
    border.visible = false;
    this.scene.add(border);

    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9, metalness: 0.02, color: 0xbfc3c7 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe7e9e5 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf1c453 });

    this.roadMat = roadMat;

    // main highway ellipse
    const RX = 205, RZ = 152, W = 20;
    const road = ribbon(this.scene, ellipsePoints(RX, RZ, 300), W, Y_ROAD, roadMat, 60);
    this.highway = road;
    const edgeOuter = ribbon(this.scene, ellipsePoints(RX + W / 2 - 0.7, RZ + W / 2 - 0.7, 300), 0.34, Y_LINE, lineMat, 1);
    const edgeInner = ribbon(this.scene, ellipsePoints(RX - W / 2 + 0.7, RZ - W / 2 + 0.7, 300), 0.34, Y_LINE, lineMat, 1);
    this.highwayEdges = [edgeOuter, edgeInner];

    // centre dashes
    const dashPts = [];
    const cols = [];
    const dashGeoVerts = [];
    const dashIdx = [];
    let vi = 0;
    const N = 110;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU;
      const a1 = a0 + (TAU / N) * 0.5;
      const p0 = { x: Math.cos(a0) * RX, z: Math.sin(a0) * RZ };
      const p1 = { x: Math.cos(a1) * RX, z: Math.sin(a1) * RZ };
      const dx = p1.x - p0.x, dz = p1.z - p0.z;
      const dl = Math.hypot(dx, dz);
      const nx = -dz / dl * 0.22, nz = dx / dl * 0.22;
      dashGeoVerts.push(p0.x + nx, Y_LINE, p0.z + nz, p0.x - nx, Y_LINE, p0.z - nz,
        p1.x + nx, Y_LINE, p1.z + nz, p1.x - nx, Y_LINE, p1.z - nz);
      dashIdx.push(vi, vi + 2, vi + 1, vi + 2, vi + 3, vi + 1);
      vi += 4;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dashGeoVerts, 3));
    dg.setIndex(dashIdx);
    this.scene.add(new THREE.Mesh(dg, yellowMat));

    // radial connectors
    const addRoad = (x, z, w, l, rot = 0) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rot;
      mesh.position.set(x, Y_ROAD + 0.002, z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      // edge lines
      for (const s of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, l), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x + Math.cos(rot) * s * (w / 2 - 0.5), Y_LINE, z - Math.sin(rot) * s * (w / 2 - 0.5));
        this.scene.add(line);
      }
    };
    addRoad(0, -119, 18, 58);   // north
    addRoad(0, 119, 18, 58);    // south
    addRoad(142.5, 0, 18, 105, Math.PI / 2); // east
    addRoad(-142.5, 0, 18, 105, Math.PI / 2); // west

    // start / finish line on the grid map
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.55), new THREE.MeshBasicMaterial({ color: 0xd7d3c8 }));
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, Y_LINE, 58);
    this.scene.add(startLine);
    const check = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.27), new THREE.MeshBasicMaterial({ color: 0x15181c }));
    check.rotation.x = -Math.PI / 2;
    check.position.set(0, Y_LINE + 0.001, 57.7);
    this.scene.add(check);

    // crash-lane dashes from spawn toward the wall
    for (let i = 0; i < 11; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.4), yellowMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(0, Y_LINE, 40 - i * 10);
      this.scene.add(d);
    }
  }


  buildMarkings() {
    const decal = (canvas, x, z, w, h, rot = 0, opacity = 1) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rot;
      mesh.position.set(x, 0.06, z);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      return mesh;
    };
    const textCanvas = (lines, w = 1024, h = 256, color = 'rgba(255,255,255,0.55)') => {
      const c = makeCanvas(w, h);
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      lines.forEach((ln, i) => {
        g.font = `800 ${ln.size}px "Arial Narrow", sans-serif`;
        g.fillText(ln.text, w / 2, ln.y);
      });
      return c;
    };

    // painted logo on the approach
    decal(textCanvas([
      { text: 'BEAMDRIVE', size: 130, y: 108 },
      { text: 'SOFT-BODY RESEARCH FACILITY · GRIDMAP 07', size: 30, y: 200 },
    ], 1024, 256, 'rgba(240,245,250,0.5)'), 0, 22, 34, 8.5);

    // direction chevrons toward the impact wall
    const arrow = makeCanvas(256, 256);
    {
      const g = arrow.getContext('2d');
      g.clearRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(255,170,70,0.55)';
      g.lineWidth = 26;
      g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(40, 168 + i * 66);
        g.lineTo(128, 90 + i * 66);
        g.lineTo(216, 168 + i * 66);
        g.stroke();
      }
    }
    for (const z of [44, -2, -24]) decal(arrow, 0, z, 7, 7, 0, 1);

    // skid pad ring
    const ring = makeCanvas(512, 512);
    {
      const g = ring.getContext('2d');
      g.clearRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(240,244,248,0.42)';
      g.lineWidth = 10;
      g.setLineDash([46, 26]);
      g.beginPath();
      g.arc(256, 256, 222, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.lineWidth = 5;
      g.beginPath();
      g.arc(256, 256, 120, 0, TAU);
      g.stroke();
      g.fillStyle = 'rgba(240,244,248,0.4)';
      g.font = '800 42px "Arial Narrow", sans-serif';
      g.textAlign = 'center';
      g.fillText('SKID PAD', 256, 268);
    }
    decal(ring, -44, 4, 46, 46);

    // parking grid for the containers
    const park = makeCanvas(512, 512);
    {
      const g = park.getContext('2d');
      g.clearRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(240,220,150,0.4)';
      g.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(20 + i * 94, 40);
        g.lineTo(20 + i * 94, 470);
        g.stroke();
      }
      g.beginPath(); g.moveTo(20, 40); g.lineTo(490, 40); g.stroke();
    }
    decal(park, -62, 4, 28, 28, Math.PI / 2);

    // checkered start / finish gate on the highway
    const checker = makeCanvas(512, 64);
    {
      const g = checker.getContext('2d');
      g.fillStyle = '#e9e7df';
      g.fillRect(0, 0, 512, 64);
      g.fillStyle = '#181b1f';
      const s = 32;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) {
        if ((x + y) % 2 === 0) g.fillRect(x * s, y * s, s, s);
      }
    }
    decal(checker, 0, 152, 21, 2.2, Math.PI / 2, 0.95);

    // hazard barriers framing the crash lane
    const stripeTex = makeCanvas(256, 64);
    {
      const g = stripeTex.getContext('2d');
      g.fillStyle = '#e8e4da';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#cf3f2c';
      for (let i = -2; i < 8; i++) {
        g.save();
        g.translate(i * 42, 0);
        g.rotate(-0.6);
        g.fillRect(0, -30, 22, 140);
        g.restore();
      }
    }
    const barTex = new THREE.CanvasTexture(stripeTex);
    barTex.colorSpace = THREE.SRGBColorSpace;
    barTex.wrapS = THREE.RepeatWrapping;
    barTex.repeat.set(2, 1);
    const barMat = new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.75 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const z = -6 - i * 9;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 2.4), barMat);
        b.position.set(sx * 14.5, 0.43, z);
        b.rotation.y = Math.PI / 2;
        b.castShadow = true;
        b.receiveShadow = true;
        this.scene.add(b);
        this.colliders.push({ type: 'box', min: new THREE.Vector3(sx * 14.5 - 1.2, 0, z - 0.25), max: new THREE.Vector3(sx * 14.5 + 1.2, 0.85, z + 0.25), tag: 'barrier' });
      }
    }

    // painted lane numbers near the start
    const startNum = textCanvas([{ text: '01', size: 170, y: 130 }], 256, 256, 'rgba(240,245,250,0.45)');
    decal(startNum, -5, 52, 5, 5, 0, 1);

    // landing zone distance markers for the jump
    for (let i = 0; i < 4; i++) {
      const d = 20 + i * 20;
      const z = 30 - d;
      const c = makeCanvas(256, 128);
      const g = c.getContext('2d');
      g.clearRect(0, 0, 256, 128);
      g.fillStyle = 'rgba(255,175,80,0.62)';
      g.fillRect(0, 52, 256, 9);
      g.font = '800 46px "Arial Narrow", sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(255,190,110,0.72)';
      g.fillText(d + 'm', 128, 44);
      decal(c, 64, z, 16, 8, 0, 1);
    }
    // jump gantry
    const steel = new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.55, metalness: 0.6 });
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.4, 0.4), steel);
      post.position.set(64 + sx * 7.2, 3.2, 32);
      post.castShadow = true;
      this.scene.add(post);
      this.cylinders.push({ x: 64 + sx * 7.2, z: 32, r: 0.3, h: 6.4, tag: 'pole' });
    }
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(15, 0.45, 0.45), steel);
    beam2.position.set(64, 6.3, 32);
    this.scene.add(beam2);
    const jumpSign = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.4), new THREE.MeshBasicMaterial({ map: makeTextTexture('JUMP ZONE', 512, 96, '#12161a', '#ffd27a', 'KICKER · 3.5 M'), side: THREE.DoubleSide }));
    jumpSign.position.set(64, 5.35, 31.75);
    this.scene.add(jumpSign);

    // tire walls beside the landing zone
    const tireGeo = new THREE.TorusGeometry(0.46, 0.19, 7, 14);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.92 });
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const stack = new THREE.Group();
        for (let h = 0; h < 3; h++) {
          const t = new THREE.Mesh(tireGeo, tireMat);
          t.rotation.x = Math.PI / 2;
          t.position.y = 0.22 + h * 0.34;
          t.castShadow = true;
          stack.add(t);
        }
        stack.position.set(64 + sx * 11, 0, 14 - k * 5);
        this.scene.add(stack);
        this.cylinders.push({ x: 64 + sx * 11, z: 14 - k * 5, r: 0.64, h: 1.3, tag: 'tires' });
      }
    }
  }

  /* ---------------- ramps ---------------- */
  addRamp(x, z, angle, length, width, height, label) {
    this.ramps.push({ x, z, angle, length, width, height });
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    const back = new THREE.Vector3(x, 0, z).sub(dir.clone().multiplyScalar(length / 2));
    const lip = new THREE.Vector3(x, 0, z).add(dir.clone().multiplyScalar(length / 2));

    const verts = [], idx = [], uvs = [];
    // top surface, back edge y=0, lip y=height
    const bl = back.clone().add(right.clone().multiplyScalar(width / 2));
    const br = back.clone().sub(right.clone().multiplyScalar(width / 2));
    const tl = lip.clone().add(right.clone().multiplyScalar(width / 2));
    const tr = lip.clone().sub(right.clone().multiplyScalar(width / 2));
    const push = (v, u, vv) => { verts.push(v.x, v.y, v.z); uvs.push(u, vv); return verts.length / 3 - 1; };
    const a = push(bl.clone().setY(0), 0, 0);
    const b = push(br.clone().setY(0), 1, 0);
    const c = push(tl.clone().setY(height), 0, 1);
    const d = push(tr.clone().setY(height), 1, 1);
    idx.push(a, b, c, c, b, d);
    // sides
    const a2 = push(bl.clone().setY(0), 0, 0), b2 = push(bl.clone().setY(0), 0, 0);
    // simple closed sides as quads
    const sL = verts.length / 3;
    verts.push(bl.x, 0, bl.z, tl.x, height, tl.z, tl.x, 0, tl.z);
    idx.push(sL, sL + 1, sL + 2);
    const sR = verts.length / 3;
    verts.push(br.x, 0, br.z, tr.x, 0, tr.z, tr.x, height, tr.z);
    idx.push(sR, sR + 1, sR + 2);
    // back face
    const sB = verts.length / 3;
    verts.push(bl.x, 0, bl.z, br.x, 0, br.z, tr.x, 0, tr.z);
    idx.push(sB, sB + 1, sB + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tex = concreteTexture(256);
    tex.repeat.set(3, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0x8f8c85, roughness: 0.92, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);

    // hazard stripes on the face of the lip
    const stripeTex = makeCanvas(256, 64);
    const g = stripeTex.getContext('2d');
    g.fillStyle = '#e8b33c'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#1a1c1e';
    for (let i = -4; i < 14; i++) { g.save(); g.translate(i * 24, 0); g.rotate(-0.5); g.fillRect(0, -30, 12, 130); g.restore(); }
    const st = new THREE.CanvasTexture(stripeTex);
    st.colorSpace = THREE.SRGBColorSpace;
    const lipMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.5), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 }));
    lipMesh.position.copy(lip); lipMesh.position.y = height - 0.26;
    lipMesh.lookAt(lip.clone().add(dir));
    this.scene.add(lipMesh);

    if (label) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({ map: makeTextTexture(label, 512, 128, '#111417', '#ffd27a'), transparent: false, side: THREE.DoubleSide }));
      sign.position.copy(back).add(right.clone().multiplyScalar(width / 2 + 1.2));
      sign.position.y = 0.9;
      sign.lookAt(sign.position.clone().add(new THREE.Vector3(Math.sin(angle + Math.PI / 2), 0, Math.cos(angle + Math.PI / 2))));
      this.scene.add(sign);
    }
  }

  buildRamps() {
    this.addRamp(64, 36, Math.PI, 11, 9, 3.5, 'JUMP RAMP');
    this.addRamp(-58, -12, -Math.PI / 2, 10, 8, 2.4, 'KICKER');
    this.addRamp(28, -40, Math.PI, 7, 6, 1.5, '');
    this.addRamp(-30, 54, Math.PI / 2, 9, 7, 1.9, '');
  }

  /* ---------------- crash test zone ---------------- */
  buildCrashZone() {
    const wallX = 0, wallZ = -74;
    const tex = concreteTexture(256);
    tex.repeat.set(8, 1.2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb3ada2, roughness: 0.95 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(38, 3.4, 1.3), mat);
    wall.position.set(wallX, 1.7, wallZ);
    wall.castShadow = true; wall.receiveShadow = true;
    this.scene.add(wall);
    this.colliders.push({ type: 'box', min: new THREE.Vector3(wallX - 19, 0, wallZ - 0.65), max: new THREE.Vector3(wallX + 19, 3.4, wallZ + 0.65), tag: 'wall', restitution: 0.1 });

    // hazard band
    const band = new THREE.Mesh(new THREE.BoxGeometry(38.05, 0.6, 1.34), new THREE.MeshStandardMaterial({ color: 0xd8a02f, roughness: 0.7 }));
    band.position.set(wallX, 0.55, wallZ);
    this.scene.add(band);
    const signs = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ map: makeTextTexture('IMPACT ZONE', 512, 96, '#171a1d', '#ff6b3d', 'DO NOT BRAKE'), side: THREE.DoubleSide }));
    signs.position.set(wallX, 2.5, wallZ + 0.67);
    this.scene.add(signs);

    // gantry over the approach
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.6 });
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.2, 0.4), gantryMat);
      post.position.set(sx * 17, 3.6, -38);
      post.castShadow = true;
      this.scene.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34.4, 0.55, 0.55), gantryMat);
    beam.position.set(0, 7.2, -38);
    this.scene.add(beam);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.0), new THREE.MeshBasicMaterial({ map: makeTextTexture('BEAMDRIVE', 640, 96, '#111418', '#ff9d3d', 'SOFT-BODY RESEARCH FACILITY'), side: THREE.DoubleSide }));
    banner.position.set(0, 5.95, -37.7);
    this.scene.add(banner);

    // distance boards next to jump
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshBasicMaterial({ map: makeTextTexture(`${20 + i * 20}m`, 256, 96, '#161a1e', '#e9edf0'), side: THREE.DoubleSide }));
      m.position.set(72.5, 1.15, 20 - i * 20);
      this.scene.add(m);
      const pMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), pMat);
      post.position.set(72.5, 0.8, 20 - i * 20);
      this.scene.add(post);
    }

    // concrete blocks flanking the impact lane
    for (const bx of [-33, -26, 26, 33]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.0), mat);
      b.position.set(bx, 0.5, -66);
      b.rotation.y = 0.06;
      b.castShadow = true;
      this.scene.add(b);
      this.colliders.push({ type: 'box', min: new THREE.Vector3(bx - 1.6, 0, -66.5), max: new THREE.Vector3(bx + 1.6, 1.0, -65.5), tag: 'barrier' });
    }
  }

  /* ---------------- static props ---------------- */
  addBox(x, y, z, sx, sy, sz, color, opts = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.1, map: opts.map || null });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y + sy / 2, z);
    mesh.rotation.y = opts.rot || 0;
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (opts.collide !== false) {
      this.colliders.push({ type: 'box', min: new THREE.Vector3(x - sx / 2, y, z - sz / 2), max: new THREE.Vector3(x + sx / 2, y + sy, z + sz / 2), tag: opts.tag || 'prop' });
    }
    return mesh;
  }

  buildProps() {
    const concrete = concreteTexture(256);
    const barrierMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0xb0aaa0, roughness: 0.9 });

    // jersey barriers along gridmap north edge
    for (let i = -3; i <= 3; i++) {
      if (Math.abs(i) < 1) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.75), barrierMat);
      b.position.set(i * 12, 0.45, -84);
      b.castShadow = true; b.receiveShadow = true;
      this.scene.add(b);
      this.colliders.push({ type: 'box', min: new THREE.Vector3(i * 12 - 3, 0, -84.4), max: new THREE.Vector3(i * 12 + 3, 0.9, -83.6), tag: 'barrier' });
    }

    // containers yard
    const containerColors = [0xb4462f, 0x2f6685, 0x517a3a, 0xb08a33];
    const yard = [[-66, -52, 0], [-66, -46, 0], [-60, -52, 0.04], [-73, -49, 0]];
    yard.forEach(([x, z, r], i) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(12, 2.7, 2.65), new THREE.MeshStandardMaterial({ color: containerColors[i % 4], roughness: 0.68, metalness: 0.35 }));
      c.position.set(x, 1.35, z);
      c.rotation.y = r;
      c.castShadow = true; c.receiveShadow = true;
      this.scene.add(c);
      this.colliders.push({ type: 'box', min: new THREE.Vector3(x - 6, 0, z - 1.35), max: new THREE.Vector3(x + 6, 2.7, z + 1.35), tag: 'container' });
      // corrugation
      for (let k = 0; k < 8; k++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 2.68), new THREE.MeshStandardMaterial({ color: 0x1d2227, roughness: 0.7 }));
        rib.position.set(x - 5.7 + k * 1.62, 1.35, z);
        this.scene.add(rib);
      }
    });

    // tire stacks
    const tireGeo = new THREE.TorusGeometry(0.45, 0.18, 8, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.9 });
    for (let s = 0; s < 8; s++) {
      const sx = -52 + (s % 4) * 2.4, sz = -22 + Math.floor(s / 4) * 2.4;
      for (let k = 0; k < 4; k++) {
        const t = new THREE.Mesh(tireGeo, tireMat);
        t.rotation.x = Math.PI / 2;
        t.position.set(sx, 0.22 + k * 0.32, sz);
        t.castShadow = true;
        this.scene.add(t);
      }
      this.cylinders.push({ x: sx, z: sz, r: 0.62, h: 1.4, tag: 'tires' });
    }

    // lamp posts along the east connector and gridmap corners
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c3035, roughness: 0.5, metalness: 0.7 });
    const lampPositions = [[95, 60], [95, -10], [95, -80], [-95, 40], [-95, -50], [120, 12], [160, 12], [120, -12], [160, -12]];
    for (const [x, z] of lampPositions) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), lampMat);
      post.position.set(x, 3.5, z);
      post.castShadow = true;
      this.scene.add(post);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.5), lampMat);
      head.position.set(x, 7, z);
      this.scene.add(head);
      this.cylinders.push({ x, z, r: 0.28, h: 7, tag: 'pole' });
    }

    // big billboard
    const bbCanvas = makeCanvas(1024, 512);
    const bg = bbCanvas.getContext('2d');
    const grd = bg.createLinearGradient(0, 0, 1024, 512);
    grd.addColorStop(0, '#191d22'); grd.addColorStop(1, '#2a2013');
    bg.fillStyle = grd; bg.fillRect(0, 0, 1024, 512);
    bg.fillStyle = '#ff9d3d'; bg.fillRect(0, 0, 1024, 14);
    bg.fillStyle = '#f4f7fa'; bg.font = '800 150px "Arial Narrow", sans-serif'; bg.textAlign = 'center';
    bg.fillText('BEND IT.', 512, 235);
    bg.fillStyle = '#ff9d3d'; bg.font = '800 110px "Arial Narrow", sans-serif';
    bg.fillText('LEARN NOTHING.', 512, 380);
    bg.fillStyle = '#9aa4ae'; bg.font = '600 26px monospace';
    bg.fillText('BEAMDRIVE SOFT-BODY RESEARCH', 512, 455);
    const bbTex = new THREE.CanvasTexture(bbCanvas);
    bbTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.8, emissive: 0x221a10, emissiveIntensity: 0.5 }));
    board.position.set(-84, 9.5, 66);
    board.rotation.y = Math.PI / 4;
    this.scene.add(board);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.7, metalness: 0.5 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 6), frameMat);
      leg.position.set(-84 + s * 6 * Math.cos(Math.PI / 4), 3, 66 - s * 6 * Math.sin(Math.PI / 4));
      this.scene.add(leg);
      this.cylinders.push({ x: leg.position.x, z: leg.position.z, r: 0.3, h: 6, tag: 'pole' });
    }

    // warehouse buildings to the east
    const winTex = (() => {
      const c = makeCanvas(256, 256);
      const g = c.getContext('2d');
      g.fillStyle = '#8d9298'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#3a4a58';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillRect(16 + x * 60, 16 + y * 58, 40, 34);
      g.strokeStyle = 'rgba(30,34,38,.5)'; g.lineWidth = 3;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.strokeRect(16 + x * 60, 16 + y * 58, 40, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();
    winTex.repeat.set(2, 1);
    const bldgs = [
      [128, 30, 26, 11, 18, 0x8f7c68],
      [128, 2, 22, 8, 16, 0x6f7d74],
      [158, -34, 30, 14, 20, 0x8a7b6c],
      [-128, -40, 24, 10, 26, 0x7c838a],
      [-126, 42, 20, 9, 18, 0x8d7f6d],
    ];
    for (const [x, z, sx, sy, sz, col] of bldgs) {
      const building = this.addBox(x, 0, z, sx, sy, sz, col, { tag: 'building', rough: 0.85 });
      // window band
      const win = new THREE.Mesh(new THREE.PlaneGeometry(sx * 0.82, sy * 0.55), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.5, metalness: 0.4 }));
      win.position.set(x, sy * 0.55, z + sz / 2 + 0.02);
      this.scene.add(win);
      // flat roof lip
      const lip = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.6, 0.5, sz + 0.6), new THREE.MeshStandardMaterial({ color: 0x5a5f64, roughness: 0.9 }));
      lip.position.set(x, sy + 0.25, z);
      this.scene.add(lip);
    }

    // low walls / kerbs marking corners of the grid
    for (const [x, z, sx, sz] of [[91, 91, 6, 6], [-91, 91, 6, 6], [91, -91, 6, 6], [-91, -91, 6, 6]]) {
      const curb = this.addBox(x, 0, z, sx, 0.35, sz, 0xc9c4b9, { collide: false, rough: 0.9 });
    }

    this.buildDynamicProps();
  }

  buildDynamicProps() {
    const crateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    // wooden crate texture
    const cc = makeCanvas(128, 128);
    const g = cc.getContext('2d');
    g.fillStyle = '#9a6f3f'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#7d562e'; g.fillRect(0, 0, 128, 10); g.fillRect(0, 118, 128, 10);
    g.fillRect(0, 0, 10, 128); g.fillRect(118, 0, 10, 128);
    g.strokeStyle = 'rgba(70,45,20,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.moveTo(120, 8); g.lineTo(8, 120); g.stroke();
    const crateTex = new THREE.CanvasTexture(cc); crateTex.colorSpace = THREE.SRGBColorSpace;
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
    const crateMesh = new THREE.InstancedMesh(crateGeo, crateMat, 22);
    crateMesh.castShadow = true; crateMesh.receiveShadow = true;
    crateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(crateMesh);

    const coneGeo = new THREE.ConeGeometry(0.24, 0.72, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xe85b28, roughness: 0.7 });
    const coneMesh = new THREE.InstancedMesh(coneGeo, coneMat, 26);
    coneMesh.castShadow = true;
    coneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(coneMesh);

    const barrelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.95, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xcf3f2e, roughness: 0.6, metalness: 0.4 });
    const barrelMesh = new THREE.InstancedMesh(barrelGeo, barrelMat, 10);
    barrelMesh.castShadow = true;
    barrelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(barrelMesh);

    const props = this.dynamic;
    const add = (type, x, z, y = 0) => {
      const p = {
        type, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
        quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, TAU), 0)),
        angVel: new THREE.Vector3(), r: type === 'crate' ? 0.56 : type === 'cone' ? 0.34 : 0.46,
        half: type === 'crate' ? 0.4 : type === 'cone' ? 0.36 : 0.48,
        rest: 0, sleeping: false, mass: type === 'crate' ? 40 : type === 'cone' ? 6 : 26, hit: 0,
      };
      props.push(p);
      return p;
    };
    // crate pyramid
    const cx = -34, cz = 22;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 3 - row; i++) {
        add('crate', cx + (i - (2 - row) / 2) * 0.84, cz, row * 0.81);
      }
    }
    for (let i = 0; i < 5; i++) add('crate', cx + 3.2 + (i % 2) * 0.85, cz - 1 + Math.floor(i / 2) * 0.85, 0);
    for (let i = 0; i < 3; i++) add('crate', 30 + i * 0.85, -18, 0);
    // cone slalom
    for (let i = 0; i < 12; i++) add('cone', -14 + (i % 2) * 3, 46 - i * 6, 0);
    for (let i = 0; i < 10; i++) add('cone', 46 + (i % 2) * 2.4, 6 + Math.floor(i / 2) * 3, 0);
    // barrels behind containers
    for (let i = 0; i < 8; i++) add('barrel', -80 + (i % 4) * 1.2, -38 + Math.floor(i / 4) * 1.2, 0);
    for (let i = 0; i < 2; i++) add('barrel', 20, -55 + i, 0);

    this.dynamicMeshes = { crate: crateMesh, cone: coneMesh, barrel: barrelMesh };
    this.dynamicMeshCount = { crate: 0, cone: 0, barrel: 0 };
    for (const p of props) {
      p.idx = this.dynamicMeshCount[p.type]++;
    }
    const m = new THREE.Matrix4();
    for (const p of props) {
      m.compose(p.pos, p.quat, new THREE.Vector3(1, 1, 1));
      this.dynamicMeshes[p.type].setMatrixAt(p.idx, m);
    }
    for (const k of Object.keys(this.dynamicMeshes)) {
      this.dynamicMeshes[k].count = this.dynamicMeshCount[k];
      this.dynamicMeshes[k].instanceMatrix.needsUpdate = true;
    }
  }

  /* ---------------- scenery ---------------- */
  buildScenery() {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3a29, roughness: 0.95 });
    const leafGeo = new THREE.IcosahedronGeometry(1, 1);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5d30, roughness: 0.95, flatShading: true });
    const N = 170;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
    trunks.castShadow = true; leaves.castShadow = true;
    leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    let count = 0;
    for (let i = 0; i < 900 && count < N; i++) {
      const a = rand(0, TAU);
      const r = rand(118, 420);
      const x = Math.cos(a) * r * 1.18, z = Math.sin(a) * r;
      const distRoad = this.distanceToRoad(x, z);
      if (distRoad < 12) continue;
      if (Math.abs(x) < 100 && Math.abs(z) < 100) continue;
      if (this.nearBuilding(x, z)) continue;
      const y = groundHeight(x, z);
      const s = rand(0.8, 1.9);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
      m.compose(new THREE.Vector3(x, y + 1.6 * s, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(count, m);
      m.compose(new THREE.Vector3(x, y + (3.4 + rand(0, 0.8)) * s, z), q, new THREE.Vector3(s * rand(1.4, 2.2), s * rand(1.8, 2.8), s * rand(1.4, 2.2)));
      leaves.setMatrixAt(count, m);
      col.setHSL(rand(0.23, 0.33), rand(0.3, 0.5), rand(0.16, 0.3));
      leaves.setColorAt(count, col);
      this.cylinders.push({ x, z, r: 0.45 * s, h: 3.2 * s, tag: 'tree' });
      count++;
    }
    trunks.count = count; leaves.count = count;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, leaves);

    // roadside chevrons on the highway
    const chevMat = new THREE.MeshBasicMaterial({ color: 0xe9e5da, side: THREE.DoubleSide });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const rx = 205 + 12, rz = 152 + 12;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x777d84 }));
      post.position.set(Math.cos(a) * rx, 0.7, Math.sin(a) * rz);
      this.scene.add(post);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.35), chevMat);
      sign.position.set(Math.cos(a) * rx, 1.5, Math.sin(a) * rz);
      sign.lookAt(0, 1.5, 0);
      this.scene.add(sign);
    }
  }

  nearBuilding(x, z) {
    return false;
  }

  distanceToRoad(x, z) {
    // elliptical distance to highway centreline
    const RX = 205, RZ = 152;
    const a = Math.atan2(z / RZ, x / RX);
    const px = Math.cos(a) * RX, pz = Math.sin(a) * RZ;
    return Math.hypot(x - px, z - pz);
  }

  buildCheckpoints() {
    const RX = 205, RZ = 152;
    const labels = ['START', 'CP 1', 'CP 2', 'CP 3', 'CP 4', 'CP 5', 'CP 6', 'CP 7'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 2;
      const x = Math.cos(a) * RX, z = Math.sin(a) * RZ;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = -a;
      const mat = new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.5, metalness: 0.5 });
      const glowMat = new THREE.MeshStandardMaterial({ color: 0xff9d3d, emissive: 0xff7a1a, emissiveIntensity: 1.5, roughness: 0.4 });
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.6, 0.26), mat);
        post.position.set(s * 10.6, 2.3, 0);
        group.add(post);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.2, 0.06), glowMat);
        strip.position.set(s * 10.6 - s * 0.16, 2.4, 0);
        group.add(strip);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.4, 0.4), mat);
      top.position.y = 4.6;
      group.add(top);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.0), new THREE.MeshBasicMaterial({ map: makeTextTexture(labels[i], 256, 72, '#121518', '#ff9d3d'), side: THREE.DoubleSide }));
      sign.position.set(0, 4.05, 0);
      group.add(sign);
      this.scene.add(group);
      this.checkpoints.push({ x, z, group, index: i, active: false });
    }
  }

  /* ---------------- queries ---------------- */
  surfaceHeight(x, z) {
    let h = groundHeight(x, z);
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      const dx = x - r.x, dz = z - r.z;
      const dirx = Math.sin(r.angle), dirz = Math.cos(r.angle);
      const along = dx * dirx + dz * dirz;
      const side = dx * dirz - dz * dirx;
      if (Math.abs(side) <= r.width / 2 && along >= -r.length / 2 && along <= r.length / 2) {
        const t = (along + r.length / 2) / r.length;
        h = Math.max(h, t * r.height);
      }
    }
    return h;
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    const hL = this.surfaceHeight(x - e, z), hR = this.surfaceHeight(x + e, z);
    const hD = this.surfaceHeight(x, z - e), hU = this.surfaceHeight(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  zoneAt(x, z) {
    if (Math.abs(x) < 93 && Math.abs(z) < 93) return 'grid';
    if (this.distanceToRoad(x, z) < 11) return 'road';
    return 'grass';
  }

  frictionAt(x, z) {
    const z0 = this.zoneAt(x, z);
    if (z0 === 'road' || z0 === 'grid') return 1.0;
    return 0.62;
  }

  /* ---------------- dynamic props update ---------------- */
  updateDynamicProps(dt, car) {
    const meshes = this.dynamicMeshes;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const tmp = new THREE.Vector3();

    for (const p of this.dynamic) {
      if (!p.sleeping) {
        p.vel.y -= 22 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const ground = this.surfaceHeight(p.pos.x, p.pos.z);
        if (p.pos.y < ground + p.half) {
          p.pos.y = ground + p.half;
          if (p.vel.y < 0) p.vel.y *= -0.25;
          p.vel.x *= 0.82; p.vel.z *= 0.82;
          p.angVel.multiplyScalar(0.86);
          if (Math.abs(p.vel.x) < 0.08 && Math.abs(p.vel.z) < 0.08 && Math.abs(p.vel.y) < 0.3) {
            p.vel.set(0, 0, 0);
            p.angVel.set(0, 0, 0);
            p.sleeping = true;
          }
        }
        // spin
        e.set(p.angVel.x * dt, p.angVel.y * dt, p.angVel.z * dt);
        q.setFromEuler(e);
        p.quat.multiply(q).normalize();
      }

      // car collision
      if (car) {
        const spheres = car.collisionSpheres();
        for (const s of spheres) {
          const dx = p.pos.x - s.pos.x, dy = p.pos.y - s.pos.y, dz = p.pos.z - s.pos.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const rad = p.r + s.r;
          if (d < rad && d > 0.0001) {
            const nx = dx / d, ny = dy / d, nz = dz / d;
            const speed = Math.abs(car.body.vel.x * nx + car.body.vel.z * nz);
            p.pos.x = s.pos.x + nx * rad;
            p.pos.y = s.pos.y + ny * rad * 0.9;
            p.pos.z = s.pos.z + nz * rad;
            const impulse = Math.min(18, 3 + speed * 0.9);
            p.vel.x += nx * impulse; p.vel.y += impulse * 0.35 + 1; p.vel.z += nz * impulse;
            p.angVel.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
            p.sleeping = false;
            p.hit = 0.4;
            if (this.onPropHit && speed > 3) this.onPropHit(p, speed);
            // car slows slightly
            car.body.vel.multiplyScalar(0.995);
          }
        }
      }

      m.compose(p.pos, p.quat, new THREE.Vector3(1, 1, 1));
      meshes[p.type].setMatrixAt(p.idx, m);
    }
    for (const k of Object.keys(meshes)) meshes[k].instanceMatrix.needsUpdate = true;
  }

  propCounts() {
    const counts = { total: 0, crates: 0, cones: 0, barrels: 0 };
    for (const p of this.dynamic) {
      counts.total++;
      if (p.type === 'crate') counts.crates++;
      if (p.type === 'cone') counts.cones++;
      if (p.type === 'barrel') counts.barrels++;
    }
    return counts;
  }
}
