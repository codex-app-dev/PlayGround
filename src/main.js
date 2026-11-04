import "./style.css";
import * as THREE from "three";

/* ---------------------------------------------------------------------------
   SUNSET HEIST
   A self-contained open-world city game. All geometry, textures and audio are
   generated procedurally — no external assets beyond the bundled fonts.
--------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const dom = {
  canvas: $("game-canvas"),
  hud: $("hud"),
  start: $("start-screen"),
  startBtn: $("start-btn"),
  restartBtn: $("restart-btn"),
  loading: $("loading"),
  missionCount: $("mission-count"),
  missionTitle: $("mission-title"),
  missionObjective: $("mission-objective"),
  missionDistance: $("mission-distance"),
  missionPayout: $("mission-payout"),
  cash: $("cash"),
  health: $("health-fill"),
  armor: $("armor-fill"),
  wantedStars: [...document.querySelectorAll("#wanted .star")],
  ammo: $("ammo"),
  reload: $("reload-fill"),
  prompt: $("prompt"),
  promptKey: $("prompt-key"),
  promptText: $("prompt-text"),
  promptProgress: $("prompt-progress-fill"),
  heatBanner: $("heat-banner"),
  heatTime: $("heat-time"),
  toast: $("toast"),
  toastText: $("toast-text"),
  district: $("district"),
  streetName: $("street-name"),
  mapLabel: $("map-label"),
  minimap: $("minimap"),
  wasted: $("wasted"),
  jobComplete: $("job-complete"),
  completeCash: $("complete-cash"),
  completeSub: $("complete-sub"),
  final: $("final-screen"),
  touch: $("touch-controls"),
  crosshair: $("crosshair"),
  joystickZone: $("joystick-zone"),
  joystickKnob: $("joystick-knob"),
  touchLook: $("touch-look"),
  btnFire: $("btn-fire"),
  btnAction: $("btn-action"),
  btnJump: $("btn-jump"),
  btnRun: $("btn-run"),
  btnDrive: $("btn-drive"),
};

const IS_TOUCH = matchMedia("(pointer: coarse)").matches || innerWidth < 900;

/* ------------------------------------------------------------------ random */
let seed = 0x51f15e;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const rr = (a, b) => a + rand() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const TAU = Math.PI * 2;
function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

/* ------------------------------------------------------------------- scene */
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xef9b7c, 85, 330);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
camera.position.set(-72, 10, 84);

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const clock = new THREE.Clock();
const timeUniform = { value: 0 };

/* -------------------------------------------------------------------- light */
const sunDir = new THREE.Vector3(-0.18, 0.15, -0.98).normalize();

const hemi = new THREE.HemisphereLight(0xffb48d, 0x1b2441, 1.55);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x6472b0, 0.62);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffb066, 3.1);
sun.position.copy(sunDir).multiplyScalar(220);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);

const fill = new THREE.DirectionalLight(0x6f8dff, 1.05);
fill.position.set(100, 60, 100);
scene.add(fill);

/* ---------------------------------------------------------------------- sky */
const skyGeo = new THREE.SphereGeometry(760, 40, 20);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    sunDir: { value: sunDir },
    uTime: timeUniform,
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec3 vDir;
    uniform vec3 sunDir;
    uniform float uTime;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 top = vec3(0.055, 0.075, 0.21);
      vec3 high = vec3(0.18, 0.12, 0.34);
      vec3 mid = vec3(0.78, 0.25, 0.36);
      vec3 low = vec3(1.0, 0.49, 0.28);
      vec3 horizon = vec3(1.0, 0.74, 0.48);

      vec3 col = mix(horizon, low, smoothstep(-0.01, 0.075, h));
      col = mix(col, mid, smoothstep(0.05, 0.22, h));
      col = mix(col, high, smoothstep(0.18, 0.48, h));
      col = mix(col, top, smoothstep(0.45, 0.9, h));

      float sd = max(dot(d, sunDir), 0.0);
      col += vec3(1.0, 0.55, 0.2) * pow(sd, 18.0) * 0.7;
      col += vec3(1.0, 0.82, 0.55) * pow(sd, 260.0) * 4.2;
      col += vec3(1.0, 0.36, 0.14) * pow(sd, 4.0) * 0.22;

      // Soft, stylised cloud bands catching the last light.
      float band = sin(d.x * 5.2 + d.z * 3.1 + uTime * 0.005);
      band *= sin(d.x * 11.0 - d.z * 7.0 + 1.7);
      float cloud = smoothstep(0.32, 0.85, band) * smoothstep(0.02, 0.2, h) * (1.0 - smoothstep(0.32, 0.55, h));
      col = mix(col, vec3(1.0, 0.63, 0.49), cloud * 0.13);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.frustumCulled = false;
scene.add(sky);

/* -------------------------------------------------------------------- ocean */
const oceanGeo = new THREE.PlaneGeometry(720, 900, 90, 90);
const oceanMat = new THREE.ShaderMaterial({
  transparent: false,
  uniforms: {
    uTime: timeUniform,
    sunDir: { value: sunDir },
    fogColor: { value: new THREE.Color(0xef9b7c) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorld;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin(p.x * 0.045 + uTime * 0.8) + sin(p.y * 0.06 - uTime * 0.65);
      p.z += w * 0.22;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorld;
    uniform float uTime;
    uniform vec3 sunDir;
    uniform vec3 fogColor;

    void main() {
      vec3 deep = vec3(0.035, 0.07, 0.17);
      vec3 shallow = vec3(0.16, 0.19, 0.35);
      vec3 warm = vec3(1.0, 0.42, 0.26);

      float d = length(vWorld.xz - vec2(-105.0, 0.0));
      vec3 col = mix(shallow, deep, smoothstep(0.0, 340.0, d));
      float horizon = smoothstep(150.0, 480.0, distance(vWorld.xz, vec2(-200.0, 0.0)));
      col = mix(col, vec3(0.82, 0.35, 0.31), horizon * 0.35);

      float wave1 = sin(vWorld.x * 0.28 + uTime * 1.7) * 0.5 + 0.5;
      float wave2 = sin(vWorld.z * 0.36 - uTime * 1.25 + vWorld.x * 0.12) * 0.5 + 0.5;
      float crest = pow(wave1 * wave2, 5.0);
      col += warm * crest * 0.22;

      float sparkle = pow(max(0.0, sin(vWorld.x * 1.4 + vWorld.z * 0.9 + uTime * 2.2)), 16.0);
      col += vec3(1.0, 0.67, 0.43) * sparkle * 0.28 * smoothstep(-90.0, -160.0, vWorld.x);

      float fog = smoothstep(220.0, 540.0, distance(cameraPosition, vWorld));
      col = mix(col, fogColor, fog * 0.7);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(-468, -0.11, 0);
scene.add(ocean);

/* -------------------------------------------------------------- environment */
const CITY = {
  min: -128,
  max: 128,
  roadsX: [-90, -45, 0, 45, 90],
  roadsZ: [-90, -45, 0, 45, 90],
  roadWidth: 12,
  beachEdge: -128,
  cityEdge: -96,
};
const colliders = [];
const worldMeshes = [];
const signMeshes = [];
const neonFlickers = [];

function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#242633";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const v = ri(20, 62);
    g.fillStyle = `rgba(${v},${v + 2},${v + 8},${rr(0.06, 0.24)})`;
    g.fillRect(rr(0, 256), rr(0, 256), rr(0.5, 1.6), rr(0.5, 1.6));
  }
  for (let i = 0; i < 24; i++) {
    g.strokeStyle = `rgba(12,12,20,${rr(0.08, 0.22)})`;
    g.lineWidth = rr(0.5, 1.4);
    g.beginPath();
    let x = rr(0, 256);
    let y = rr(0, 256);
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += rr(-16, 16);
      y += rr(8, 25);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makePavingTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#9a8e8b";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const v = ri(80, 140);
    g.fillStyle = `rgba(${v},${v - 4},${v - 2},${rr(0.04, 0.16)})`;
    g.fillRect(rr(0, 128), rr(0, 128), rr(0.5, 1.4), rr(0.5, 1.4));
  }
  g.strokeStyle = "rgba(58,50,52,0.3)";
  g.lineWidth = 1.2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = 4;
  return t;
}

const mat = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x242635, roughness: 0.96, metalness: 0.02 }),
  asphaltDark: new THREE.MeshStandardMaterial({ color: 0x1b1d2a, roughness: 1 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xffffff, map: makePavingTexture(), roughness: 0.92 }),
  sidewalkEdge: new THREE.MeshStandardMaterial({ color: 0x72686f, roughness: 0.9 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xc79a70, roughness: 1 }),
  sandLight: new THREE.MeshStandardMaterial({ color: 0xe0b98d, roughness: 1 }),
  white: new THREE.MeshBasicMaterial({ color: 0xf8ead9 }),
  line: new THREE.MeshBasicMaterial({ color: 0xf6d78e }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.55, metalness: 0.55 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a5a42, roughness: 0.92, emissive: 0x1a0e07, emissiveIntensity: 0.5 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4e9d68, roughness: 0.76, side: THREE.DoubleSide, emissive: 0x123a20, emissiveIntensity: 1.15 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x4f9463, roughness: 0.8, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1c2b4b, roughness: 0.15, metalness: 0.55 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x111219, roughness: 0.95 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xbfc7d6, roughness: 0.25, metalness: 0.9 }),
};

const asphaltTexV = makeAsphaltTexture();
asphaltTexV.repeat.set(2.4, 46);
const asphaltTexH = makeAsphaltTexture();
asphaltTexH.repeat.set(46, 2.4);
const roadMatV = new THREE.MeshStandardMaterial({ map: asphaltTexV, roughness: 0.96, metalness: 0.02 });
const roadMatH = new THREE.MeshStandardMaterial({ map: asphaltTexH, roughness: 0.96, metalness: 0.02 });

// Dark foundation / land mass.
const land = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat.asphaltDark);
land.rotation.x = -Math.PI / 2;
land.position.set(35, -0.08, 0);
land.receiveShadow = true;
scene.add(land);

// Beach.
const beach = new THREE.Mesh(new THREE.BoxGeometry(34, 0.18, 272), mat.sand);
beach.position.set(-111, 0.01, 0);
beach.receiveShadow = true;
scene.add(beach);

const surfLine = new THREE.Mesh(
  new THREE.PlaneGeometry(3.5, 270),
  new THREE.MeshBasicMaterial({ color: 0xf7d7b1, transparent: true, opacity: 0.34 })
);
surfLine.rotation.x = -Math.PI / 2;
surfLine.position.set(-126.8, 0.13, 0);
scene.add(surfLine);

const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 272), mat.sidewalkEdge);
boardwalk.position.set(-96, 0.06, 0);
boardwalk.receiveShadow = true;
scene.add(boardwalk);

// Ocean-front railing.
const railMat = new THREE.MeshStandardMaterial({ color: 0x3b3948, roughness: 0.7, metalness: 0.35 });
for (let z = -130; z <= 130; z += 8) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.05, 0.13), railMat);
  post.position.set(-99.4, 0.55, z);
  scene.add(post);
}
const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 264), railMat);
railTop.position.set(-99.4, 1.06, 0);
scene.add(railTop);

/* ------------------------------------------------------------------- roads */
function addRoads() {
  for (const x of CITY.roadsX) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 264), roadMatV);
    road.position.set(x, 0.02, 0);
    road.receiveShadow = true;
    scene.add(road);
  }
  for (const z of CITY.roadsZ) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(264, 0.12, 12), roadMatH);
    road.position.set(0, 0.025, z);
    road.receiveShadow = true;
    scene.add(road);
  }

  // Dashed lane markings, instanced for speed.
  const dashGeo = new THREE.BoxGeometry(0.16, 0.02, 2.8);
  const dashCount = 5 * 42 * 2;
  const dashes = new THREE.InstancedMesh(dashGeo, mat.line, dashCount);
  const m = new THREE.Matrix4();
  let di = 0;
  for (const x of CITY.roadsX) {
    for (let z = -128; z <= 128; z += 6.4) {
      m.makeTranslation(x, 0.095, z);
      dashes.setMatrixAt(di++, m);
    }
  }
  for (const z of CITY.roadsZ) {
    for (let x = -128; x <= 128; x += 6.4) {
      m.makeRotationY(Math.PI / 2);
      m.setPosition(x, 0.095, z);
      dashes.setMatrixAt(di++, m);
    }
  }
  dashes.count = di;
  scene.add(dashes);

  // Crosswalk stripes around every intersection.
  const stripeGeo = new THREE.BoxGeometry(0.55, 0.02, 3.4);
  const stripes = new THREE.InstancedMesh(stripeGeo, mat.white, 25 * 32);
  let si = 0;
  for (const x of CITY.roadsX) {
    for (const z of CITY.roadsZ) {
      for (let i = -3; i <= 3; i++) {
        m.makeTranslation(x + i * 1.45, 0.1, z - 7.4);
        stripes.setMatrixAt(si++, m);
        m.makeTranslation(x + i * 1.45, 0.1, z + 7.4);
        stripes.setMatrixAt(si++, m);
        m.makeRotationY(Math.PI / 2);
        m.setPosition(x - 7.4, 0.1, z + i * 1.45);
        stripes.setMatrixAt(si++, m);
        m.setPosition(x + 7.4, 0.1, z + i * 1.45);
        stripes.setMatrixAt(si++, m);
      }
    }
  }
  stripes.count = si;
  scene.add(stripes);
}
addRoads();

/* --------------------------------------------------------------- utilities */
function makeWindowTexture(baseHex, floors, cols, warmth = 0.5) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  const base = new THREE.Color(baseHex);

  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.1).getHexString()}`);
  grad.addColorStop(1, `#${base.clone().offsetHSL(0, 0, -0.09).getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);

  // Subtle plaster streaks.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${rr(0.01, 0.055)})`;
    g.fillRect(rr(0, 128), rr(0, 256), rr(0.5, 2), rr(10, 70));
  }

  const marginX = 15;
  const top = 20;
  const usableW = 128 - marginX * 2;
  const cellW = usableW / cols;
  const cellH = 202 / floors;
  const winW = cellW * 0.56;
  const winH = cellH * 0.55;

  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * cellW + (cellW - winW) / 2;
      const y = top + r * cellH + (cellH - winH) / 2;
      const lit = rand() < warmth;
      if (lit) {
        const warm = pick(["#ffd69a", "#ffc477", "#ffe7ba", "#9fe7ef"]);
        g.fillStyle = warm;
        g.globalAlpha = rr(0.55, 1);
        g.fillRect(x, y, winW, winH);
        g.globalAlpha = 0.18;
        g.fillStyle = warm;
        g.fillRect(x - 2, y - 2, winW + 4, winH + 4);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = `rgba(22,28,48,${rr(0.62, 0.9)})`;
        g.fillRect(x, y, winW, winH);
        g.fillStyle = "rgba(120,160,210,0.11)";
        g.fillRect(x, y, winW, winH * 0.28);
      }
      g.fillStyle = "rgba(20,16,24,0.34)";
      g.fillRect(x, y + winH, winW, 1.2);
      g.fillStyle = "rgba(255,255,255,0.13)";
      g.fillRect(x, y, 1, winH);
    }
    // Floor band.
    g.fillStyle = "rgba(20,18,28,0.13)";
    g.fillRect(0, top + r * cellH, 128, 1.2);
  }

  // Art-deco vertical trim.
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(8, 0, 2, 256);
  g.fillRect(118, 0, 2, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeStorefrontTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#2b170c");
  grad.addColorStop(0.48, "#66300f");
  grad.addColorStop(1, "#180c07");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);

  // Warm interior pools.
  for (let i = 0; i < 3; i++) {
    const x = 42 + i * 86;
    const rad = g.createRadialGradient(x, 38, 2, x, 38, 56);
    rad.addColorStop(0, "rgba(255,206,126,0.95)");
    rad.addColorStop(0.5, "rgba(255,145,55,0.32)");
    rad.addColorStop(1, "rgba(255,100,30,0)");
    g.fillStyle = rad;
    g.fillRect(x - 58, 0, 116, 118);
  }

  // Shelves and bottle silhouettes.
  g.fillStyle = "rgba(20,10,6,0.86)";
  for (const y of [58, 82, 106]) g.fillRect(8, y, 240, 4);
  for (let i = 0; i < 28; i++) {
    const row = i % 2;
    const x = 12 + (i % 14) * 17 + (row ? 5 : 0);
    const y = row ? 60 : 84;
    g.fillStyle = `rgba(${18 + (i * 13) % 35},${8 + (i * 7) % 20},6,0.92)`;
    g.fillRect(x, y - 15, 5, 15);
    g.fillRect(x + 1, y - 19, 3, 4);
    g.fillStyle = "rgba(255,196,110,0.18)";
    g.fillRect(x + 1, y - 13, 1, 9);
  }

  // Cool glass reflection.
  g.fillStyle = "rgba(175,225,255,0.075)";
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(86, 0);
  g.lineTo(22, 128);
  g.lineTo(0, 128);
  g.closePath();
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeSignTexture(text, color = "#ff3f91", sub = "") {
  const c = document.createElement("canvas");
  const vertical = text.length > 8;
  c.width = vertical ? 256 : 512;
  c.height = vertical ? 512 : 160;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);

  if (!vertical) {
    g.fillStyle = "rgba(8,8,20,0.66)";
    g.fillRect(0, 18, c.width, 124);
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.strokeRect(5, 23, c.width - 10, 114);
    g.shadowColor = color;
    g.shadowBlur = 28;
    g.fillStyle = color;
    g.font = `700 ${text.length > 11 ? 58 : 78}px "Rajdhani", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, c.width / 2, 76);
    g.shadowBlur = 0;
    if (sub) {
      g.fillStyle = "rgba(255,240,220,0.75)";
      g.font = '600 19px "Rajdhani", sans-serif';
      g.fillText(sub, c.width / 2, 120);
    }
  } else {
    g.fillStyle = "rgba(8,8,20,0.72)";
    g.fillRect(58, 0, 140, 512);
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.strokeRect(63, 5, 130, 502);
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.fillStyle = color;
    g.font = '700 62px "Rajdhani", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    const chars = text.split("");
    chars.forEach((ch, i) => g.fillText(ch, 128, 55 + i * (400 / Math.max(chars.length - 1, 1))));
    g.shadowBlur = 0;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addNeonSign(parent, text, color, side, y, width, height, sub = "", flicker = false) {
  const tex = makeSignTexture(text, color, sub);
  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  const d = parent.userData.depth || 12;
  const w = parent.userData.width || 12;
  if (side === "south") {
    plane.position.set(0, y, d / 2 + 0.07);
  } else if (side === "north") {
    plane.position.set(0, y, -d / 2 - 0.07);
    plane.rotation.y = Math.PI;
  } else if (side === "east") {
    plane.position.set(w / 2 + 0.07, y, 0);
    plane.rotation.y = Math.PI / 2;
  } else {
    plane.position.set(-w / 2 - 0.07, y, 0);
    plane.rotation.y = -Math.PI / 2;
  }
  parent.add(plane);
  signMeshes.push(plane);
  if (flicker) neonFlickers.push({ mesh: plane, base: 0.86, phase: rr(0, 20) });
  return plane;
}

/* -------------------------------------------------------------- buildings */
const palette = [
  "#e9b7a2", "#f1d4b4", "#a9d2c8", "#efadc4", "#c8b9e4",
  "#f2c279", "#92c8df", "#d8a28b", "#e8ddc9", "#b5cea0",
  "#f0a78b", "#b6b9df", "#f5cda5", "#d5b1d7", "#9fc6bb",
];

const reservedBlocks = new Set(["0,4", "2,2", "3,0"]);
const blockXs = [[-84, -51], [-39, -6], [6, 39], [51, 84], [96, 124]];
const blockZs = [[-124, -96], [-84, -51], [-39, -6], [6, 39], [51, 84], [96, 124]];

function addBuilding(x, z, w, d, h, colorHex, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, 0.1, z);
  group.userData.width = w;
  group.userData.depth = d;

  const floors = clamp(Math.round(h / 3.1), 3, 16);
  const cols = clamp(Math.round(w / 3.4), 3, 9);
  const tex = makeWindowTexture(colorHex, floors, cols, options.warmth ?? rr(0.28, 0.62));
  const sideMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.83,
    metalness: 0.03,
    color: 0xffffff,
  });
  const roofColor = new THREE.Color(colorHex).offsetHSL(0, -0.03, -0.12);
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.92 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    sideMat, sideMat, roofMat, roofMat, sideMat, sideMat,
  ]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  worldMeshes.push(body);

  // Roof lip.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.38, d + 0.5), roofMat);
  lip.position.y = h + 0.12;
  lip.castShadow = true;
  group.add(lip);

  // Art-deco stepped crown on taller buildings.
  let crown = null;
  if (h > 28 && options.crown !== false) {
    const cw = w * rr(0.52, 0.72);
    const cd = d * rr(0.52, 0.72);
    const ch = rr(2.5, 7);
    crown = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), sideMat);
    crown.position.y = h + ch / 2;
    crown.castShadow = true;
    group.add(crown);
    const crownTop = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.3, 0.25, cd + 0.3), roofMat);
    crownTop.position.y = h + ch + 0.1;
    group.add(crownTop);
    // Neon crown strip.
    if (rand() < 0.55) {
      const stripMat = new THREE.MeshBasicMaterial({ color: pick([0xff5b8f, 0x48e2ff, 0xffb04b, 0x9d7bff]), toneMapped: false });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.2, 0.13, cd + 0.2), stripMat);
      strip.position.y = h + ch - 0.8;
      group.add(strip);
    }
  }

  // Rooftop utilities.
  if (rand() < 0.75) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(rr(1.4, 3.2), rr(0.6, 1.4), rr(1.4, 3)), mat.darkMetal);
    ac.position.set(rr(-w * 0.25, w * 0.25), h + 0.7, rr(-d * 0.25, d * 0.25));
    group.add(ac);
  }
  if (h > 38 && rand() < 0.5) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 5), mat.darkMetal);
    mast.position.set(0, h + 5.5, 0);
    group.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b52, toneMapped: false }));
    beacon.position.set(0, h + 9.2, 0);
    group.add(beacon);
  }

  // Neon roofline and storefront spill for a lived-in, after-dark skyline.
  if (rand() < 0.46) {
    const neonColor = pick([0xff4d8f, 0x39e3ff, 0xffb13d, 0xb27bff]);
    const crownNeon = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08),
      new THREE.MeshBasicMaterial({ color: neonColor, toneMapped: false })
    );
    crownNeon.position.y = h - 0.6;
    group.add(crownNeon);
  }
  if (rand() < 0.32 && h > 16) {
    const stripColor = pick([0xff4d8f, 0x39e3ff, 0xffb13d, 0xb27bff]);
    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, h * 0.72, 0.1),
      new THREE.MeshBasicMaterial({ color: stripColor, toneMapped: false })
    );
    vertical.position.set(w / 2 + 0.06, h * 0.46, d / 2 + 0.06);
    group.add(vertical);
  }
  if (rand() < 0.56) {
    const shopColor = pick([0xffc478, 0xff7c96, 0x64e6e0, 0xffe0a0, 0x9d8bff]);
    const shop = new THREE.Mesh(
      new THREE.PlaneGeometry(w * rr(0.36, 0.6), rr(1.8, 2.7)),
      new THREE.MeshBasicMaterial({
        color: shopColor,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const side = pick(["south", "west", "east"]);
    shop.position.y = 1.65;
    if (side === "south") shop.position.set(0, 1.65, d / 2 + 0.08);
    if (side === "west") { shop.position.set(-w / 2 - 0.08, 1.65, 0); shop.rotation.y = -Math.PI / 2; }
    if (side === "east") { shop.position.set(w / 2 + 0.08, 1.65, 0); shop.rotation.y = Math.PI / 2; }
    group.add(shop);
  }

  // Ground-floor canopy for some buildings.
  if (rand() < 0.38) {
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.55, 0.18, 1.7),
      new THREE.MeshStandardMaterial({ color: pick([0x2f6c6a, 0x8b3357, 0xc96a39, 0x343c77]), roughness: 0.8 })
    );
    canopy.position.set(0, 3.2, d / 2 + 0.85);
    group.add(canopy);
  }

  scene.add(group);

  colliders.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    height: h,
  });

  return group;
}

function generateCity() {
  for (let xi = 0; xi < blockXs.length; xi++) {
    for (let zi = 0; zi < blockZs.length; zi++) {
      const [x0, x1] = blockXs[xi];
      const [z0, z1] = blockZs[zi];
      const key = `${xi},${zi}`;

      // Sidewalk pad.
      const sw = x1 - x0;
      const sd = z1 - z0;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.16, sd), mat.sidewalk);
      pad.position.set((x0 + x1) / 2, 0.1, (z0 + z1) / 2);
      pad.receiveShadow = true;
      scene.add(pad);

      // Curb trim.
      const curb = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.4, 0.18, sd + 0.4), mat.sidewalkEdge);
      curb.position.set((x0 + x1) / 2, 0.075, (z0 + z1) / 2);
      scene.add(curb);

      if (reservedBlocks.has(key)) continue;

      const inset = 4.2;
      const ax = x0 + inset;
      const bx = x1 - inset;
      const az = z0 + inset;
      const bz = z1 - inset;
      const blockCenterX = (x0 + x1) / 2;
      const blockCenterZ = (z0 + z1) / 2;
      const downtown = 1 - clamp(Math.hypot(blockCenterX - 16, blockCenterZ - 16) / 150, 0, 1);
      const split = rand() < 0.42;

      if (split) {
        const mid = lerp(az, bz, rr(0.42, 0.58));
        const h1 = rr(8, 20) + downtown * rr(4, 22);
        const h2 = rr(8, 24) + downtown * rr(2, 24);
        const w1 = bx - ax;
        const d1 = mid - az - 1.4;
        const d2 = bz - mid - 1.4;
        addBuilding((ax + bx) / 2 + rr(-1, 1), az + d1 / 2, w1, d1, h1, pick(palette));
        addBuilding((ax + bx) / 2 + rr(-1, 1), mid + 1.4 + d2 / 2, w1, d2, h2, pick(palette));
      } else {
        const mid = lerp(ax, bx, rr(0.46, 0.56));
        const h1 = rr(9, 25) + downtown * rr(6, 28);
        const h2 = rr(8, 22) + downtown * rr(2, 22);
        const w1 = mid - ax - 1.2;
        const w2 = bx - mid - 1.2;
        const d1 = bz - az;
        addBuilding(ax + w1 / 2, (az + bz) / 2 + rr(-1, 1), w1, d1, h1, pick(palette));
        addBuilding(mid + 1.2 + w2 / 2, (az + bz) / 2 + rr(-1, 1), w2, d1, h2, pick(palette));
      }

      // Random storefront neon on street-facing sides.
      if (rand() < 0.34) {
        const b = scene.children[scene.children.length - 1];
        if (b && b.isGroup) {
          addNeonSign(
            b,
            pick(["HOTEL", "CLUB 84", "MOTEL", "TATTOO", "DINER", "VINYL", "ARCADE", "PAWN", "SUSHI", "BAR"]),
            pick(["#ff4d8f", "#39e3ff", "#ffb13d", "#b27bff"]),
            pick(["south", "west", "east"]),
            rr(4, 8),
            rr(4.5, 7.5),
            rr(1.4, 2.1),
            rand() < 0.5 ? "OPEN LATE" : "",
            rand() < 0.4
          );
        }
      }
    }
  }
}
generateCity();

/* ------------------------------------------------------- custom heist venues */
function addHeistVenue(heist) {
  const g = addBuilding(heist.bx, heist.bz, heist.bw, heist.bd, heist.bh, heist.colorHex, {
    crown: false,
    warmth: 0.48,
  });
  g.userData.width = heist.bw;
  g.userData.depth = heist.bd;
  addNeonSign(g, heist.sign, heist.signColor, heist.signSide, heist.signY, heist.signW, heist.signH, heist.signSub, true);

  // Glowing entrance.
  const doorMat = new THREE.MeshBasicMaterial({ color: heist.signColor, transparent: true, opacity: 0.55, toneMapped: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.2), doorMat);
  if (heist.signSide === "west") {
    door.position.set(-heist.bw / 2 - 0.06, 1.7, 0);
    door.rotation.y = -Math.PI / 2;
  } else if (heist.signSide === "south") {
    door.position.set(0, 1.7, heist.bd / 2 + 0.06);
  } else {
    door.position.set(heist.bw / 2 + 0.06, 1.7, 0);
    door.rotation.y = Math.PI / 2;
  }
  g.add(door);

  // Ground-floor storefront glazing and trim, so the venue reads as a real
  // street-level business instead of a blank box when approached up close.
  if (heist.signSide === "west" || heist.signSide === "east") {
    const west = heist.signSide === "west";
    const sx = west ? -heist.bw / 2 - 0.07 : heist.bw / 2 + 0.07;
    const ry = west ? -Math.PI / 2 : Math.PI / 2;
    const glassMat = new THREE.MeshBasicMaterial({
      map: makeStorefrontTexture(),
      toneMapped: true,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18141d, roughness: 0.62, metalness: 0.4 });
    for (const oz of [-6.6, 6.6]) {
      const w = 5.4;
      const h = 2.45;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
      panel.position.set(sx, 1.52, oz);
      panel.rotation.y = ry;
      g.add(panel);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, w + 0.22), frameMat);
      top.position.set(sx, 1.52 + h / 2, oz);
      g.add(top);
      const bottom = top.clone();
      bottom.position.y = 1.52 - h / 2;
      g.add(bottom);
      for (const oz2 of [-w / 2, 0, w / 2]) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), frameMat);
        mullion.position.set(sx, 1.52, oz + oz2);
        g.add(mullion);
      }
      const spill = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.12, h * 1.3),
        new THREE.MeshBasicMaterial({
          color: heist.color,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      spill.position.set(sx + (west ? 0.03 : -0.03), 1.52, oz);
      spill.rotation.y = ry;
      g.add(spill);
    }
    // Low plinth and a neon kick-strip under the windows.
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, heist.bd * 0.9), frameMat);
    plinth.position.set(sx, 0.24, 0);
    g.add(plinth);
    const kick = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, heist.bd * 0.86),
      new THREE.MeshBasicMaterial({ color: heist.color, toneMapped: false })
    );
    kick.position.set(sx + (west ? 0.05 : -0.05), 0.51, 0);
    g.add(kick);
  }

  // Awning / marquee.
  const awn = new THREE.Mesh(
    new THREE.BoxGeometry(heist.signSide === "west" || heist.signSide === "east" ? 2.8 : 7, 0.24, heist.signSide === "west" || heist.signSide === "east" ? 7 : 2.8),
    new THREE.MeshStandardMaterial({ color: 0x241826, roughness: 0.78, metalness: 0.2 })
  );
  if (heist.signSide === "west") awn.position.set(-heist.bw / 2 - 1.2, 3.35, 0);
  else if (heist.signSide === "east") awn.position.set(heist.bw / 2 + 1.2, 3.35, 0);
  else awn.position.set(0, 3.35, heist.bd / 2 + 1.2);
  g.add(awn);
  const awnGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.05, heist.signSide === "west" || heist.signSide === "east" ? 6.8 : 0.1),
    new THREE.MeshBasicMaterial({ color: heist.color, toneMapped: false })
  );
  awnGlow.position.copy(awn.position);
  awnGlow.position.y -= 0.15;
  g.add(awnGlow);
  return g;
}

/* -------------------------------------------------------------- palm trees */
function addPalms() {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 6.4, 6, 3);
  trunkGeo.translate(0, 3.2, 0);
  const leafGeo = new THREE.PlaneGeometry(0.8, 4.4);
  leafGeo.translate(0, 2.2, 0);

  const positions = [];
  for (let z = -122; z <= 122; z += 15) positions.push([rr(-121, -116), z + rr(-2, 2), rr(0.82, 1.25)]);
  for (let z = -110; z <= 110; z += 24) positions.push([rr(-101, -98), z + rr(-2, 2), rr(0.75, 1.05)]);
  for (let z = -108; z <= 108; z += 31) positions.push([rr(-95.1, -93.6), z + rr(-1.4, 1.4), rr(0.74, 0.98)]);
  for (let i = 0; i < 18; i++) {
    const x = pick([-87, -48, -3, 42, 87, 118]);
    const z = pick([-121, -87, -48, -3, 42, 87, 121]);
    positions.push([x + rr(-1.6, 1.6), z + rr(-1.6, 1.6), rr(0.7, 1)]);
  }

  const filteredPalms = positions.filter(([x, z]) =>
    dist2(x, z, -88, 86) > 11 && !(x > -103 && x < -82 && z > 54 && z < 80)
  );
  positions.length = 0;
  positions.push(...filteredPalms);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat.trunk, positions.length);
  const leaves = new THREE.InstancedMesh(leafGeo, mat.leaf, positions.length * 8);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let li = 0;
  positions.forEach(([x, z, scale], i) => {
    e.set(rr(-0.04, 0.04), rr(0, TAU), rr(-0.04, 0.04));
    q.setFromEuler(e);
    p.set(x, 0.1, z);
    s.set(scale, scale, scale);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);

    for (let l = 0; l < 8; l++) {
      const ang = (l / 8) * TAU + rr(-0.2, 0.2);
      const droop = rr(0.45, 0.9);
      e.set(droop, ang, rr(-0.12, 0.12));
      q.setFromEuler(e);
      p.set(x, 6.15 * scale, z);
      s.set(scale, scale, scale);
      m.compose(p, q, s);
      leaves.setMatrixAt(li++, m);
    }
  });
  trunks.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunks, leaves);
}
addPalms();

/* ------------------------------------------------------------- street lights */
function addStreetLights() {
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 5);
  poleGeo.translate(0, 2.7, 0);
  const bulbGeo = new THREE.SphereGeometry(0.17, 6, 6);
  const armGeo = new THREE.BoxGeometry(1.5, 0.08, 0.08);

  const spots = [];
  for (const x of CITY.roadsX) {
    for (let z = -118; z <= 118; z += 31) spots.push([x - 6.4, z, 0]);
    for (let z = -103; z <= 118; z += 31) spots.push([x + 6.4, z, Math.PI]);
  }
  for (const z of CITY.roadsZ) {
    for (let x = -118; x <= 118; x += 31) spots.push([x, z - 6.4, Math.PI / 2]);
    for (let x = -103; x <= 118; x += 31) spots.push([x, z + 6.4, -Math.PI / 2]);
  }

  const filteredSpots = spots.filter(([x, z]) =>
    dist2(x, z, -88, 86) > 13 && !(x > -103 && x < -82 && z > 54 && z < 80)
  );
  spots.length = 0;
  spots.push(...filteredSpots);
  const poles = new THREE.InstancedMesh(poleGeo, mat.darkMetal, spots.length);
  const arms = new THREE.InstancedMesh(armGeo, mat.darkMetal, spots.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffc47d, toneMapped: false }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const haloPositions = [];
  spots.forEach(([x, z, rot], i) => {
    q.setFromEuler(e.set(0, rot, 0));
    p.set(x, 0.1, z);
    m.compose(p, q, s);
    poles.setMatrixAt(i, m);
    e.set(0, rot, 0);
    q.setFromEuler(e);
    p.set(x + Math.sin(rot) * 0.7, 5.32, z + Math.cos(rot) * 0.7);
    m.compose(p, q, s);
    arms.setMatrixAt(i, m);
    p.set(x + Math.sin(rot) * 1.42, 5.28, z + Math.cos(rot) * 1.42);
    m.compose(p, q, s);
    bulbs.setMatrixAt(i, m);
    haloPositions.push(p.clone());
  });
  const haloGeo = new THREE.BufferGeometry().setFromPoints(haloPositions);
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({
    map: makeGlowTexture(),
    color: 0xffb45b,
    size: 2.1,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  }));
  scene.add(poles, arms, bulbs, halos);
}
addStreetLights();

/* ------------------------------------------------------------------- props */
function addStreetProps() {
  // Bus stop benches / planters around the beach.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x4a3e3c, roughness: 0.85 });
  for (let z = -100; z <= 100; z += 34) {
    if (z > 54 && z < 80) continue;
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.7), benchMat);
    seat.position.y = 0.7;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.12), benchMat);
    back.position.set(0, 1.02, -0.3);
    bench.add(seat, back);
    bench.position.set(-94.3, 0.1, z);
    scene.add(bench);
  }

  // A couple of lifeguard towers.
  for (const z of [-72, 46]) {
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0xe9b7a2, roughness: 0.8 }));
    base.position.y = 2.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xff7b58, roughness: 0.75 }));
    roof.position.y = 4.4;
    roof.rotation.y = Math.PI / 4;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x6d5649, roughness: 1 }));
    legs.position.y = 1.3;
    tower.add(base, roof, legs);
    tower.position.set(-117, 0.1, z);
    scene.add(tower);
  }

  // Beach umbrellas.
  const umbrellaColors = [0xff5a76, 0x49d7db, 0xffc75a, 0xb581ff];
  for (let i = 0; i < 12; i++) {
    const x = rr(-122, -102);
    const z = rr(-118, 118);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 4), mat.chrome);
    pole.position.set(x, 1.45, z);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 0.6, 10),
      new THREE.MeshStandardMaterial({ color: pick(umbrellaColors), roughness: 0.8 })
    );
    top.position.set(x, 2.8, z);
    scene.add(pole, top);
  }

  // Ocean buoys.
  for (let i = 0; i < 8; i++) {
    const buoy = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 6, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4f76 : 0xffd166 })
    );
    buoy.position.set(rr(-210, -135), 0.35, rr(-150, 150));
    scene.add(buoy);
  }
}
addStreetProps();

/* --------------------------------------------------------------- heist data */
const HEISTS = [
  {
    id: 0,
    title: "THE CORNER STORE",
    district: "OCEAN DRIVE",
    reward: 1200,
    guards: 2,
    wanted: 2,
    color: 0xff4f8b,
    signColor: "#ff4f8b",
    pos: new THREE.Vector3(-83.8, 0.15, 67),
    bx: -68,
    bz: 67,
    bw: 26,
    bd: 26,
    bh: 15,
    sign: "LIQUOR",
    signSide: "west",
    signY: 7.4,
    signW: 7.5,
    signH: 2.3,
    signSub: "OPEN ALL NIGHT",
    colorHex: "#8fb3ac",
    objective: "Reach the liquor store",
    drive: "Drive to the liquor store",
    approach: "Start the heist at the marker",
    venue: "Corner Store",
  },
  {
    id: 1,
    title: "DIAMOND EXCHANGE",
    district: "NEON MILE",
    reward: 4500,
    guards: 3,
    wanted: 3,
    color: 0x4be5ff,
    signColor: "#4be5ff",
    pos: new THREE.Vector3(7.4, 0.15, 22),
    bx: 23,
    bz: 22,
    bw: 28,
    bd: 26,
    bh: 38,
    sign: "DIAMOND EXCHANGE",
    signSide: "west",
    signY: 16.5,
    signW: 9.5,
    signH: 2.6,
    signSub: "BUY • SELL • DISAPPEAR",
    colorHex: "#c8b9e4",
    objective: "Reach the Diamond Exchange",
    drive: "Drive to the Diamond Exchange",
    approach: "Start the heist at the marker",
    venue: "Diamond Exchange",
  },
  {
    id: 2,
    title: "THE GRAND VAULT",
    district: "GOLD COAST",
    reward: 12000,
    guards: 4,
    wanted: 4,
    color: 0xffd35a,
    signColor: "#ffd35a",
    pos: new THREE.Vector3(52.4, 0.15, -68),
    bx: 69,
    bz: -68,
    bw: 28,
    bd: 30,
    bh: 48,
    sign: "GRAND BANK",
    signSide: "west",
    signY: 21,
    signW: 10,
    signH: 2.8,
    signSub: "EST. 1928",
    colorHex: "#e8ddc9",
    objective: "Reach the Grand Bank",
    drive: "Drive to the Grand Bank",
    approach: "Start the heist at the marker",
    venue: "Grand Bank",
  },
];

// Build the three bespoke venues.
for (const h of HEISTS) addHeistVenue(h);

// Landmark rooftop sign.
const landmark = addBuilding(20, -34, 27, 23, 56, "#d5b1d7", { warmth: 0.5 });
addNeonSign(landmark, "SUNSET CITY", "#ff6b57", "south", 47, 18, 5, "THE CITY NEVER SLEEPS", false);

/* -------------------------------------------------------------- minimap base */
const MAP_SIZE = 440;
const MAP_RANGE = 280;
const mapBase = document.createElement("canvas");
mapBase.width = MAP_SIZE;
mapBase.height = MAP_SIZE;
function drawMapBase() {
  const g = mapBase.getContext("2d");
  const toPx = (v) => ((v + MAP_RANGE / 2) / MAP_RANGE) * MAP_SIZE;

  g.fillStyle = "#0b1322";
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

  // Ocean.
  g.fillStyle = "#142c4d";
  g.fillRect(0, 0, toPx(-128), MAP_SIZE);
  // Beach.
  g.fillStyle = "#6e5b58";
  g.fillRect(toPx(-128), 0, toPx(-96) - toPx(-128), MAP_SIZE);

  // City ground.
  g.fillStyle = "#1d2232";
  g.fillRect(toPx(-96), 0, toPx(128) - toPx(-96), MAP_SIZE);

  // Blocks.
  for (const [x0, x1] of blockXs) {
    for (const [z0, z1] of blockZs) {
      g.fillStyle = "#35313e";
      g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    }
  }

  // Roads.
  g.fillStyle = "#0d101a";
  for (const x of CITY.roadsX) {
    g.fillRect(toPx(x - 6), 0, toPx(x + 6) - toPx(x - 6), MAP_SIZE);
  }
  for (const z of CITY.roadsZ) {
    g.fillRect(0, toPx(z - 6), MAP_SIZE, toPx(z + 6) - toPx(z - 6));
  }
  g.strokeStyle = "rgba(255,210,130,0.2)";
  g.lineWidth = 1;
  for (const x of CITY.roadsX) {
    g.beginPath();
    g.moveTo(toPx(x), 0);
    g.lineTo(toPx(x), MAP_SIZE);
    g.stroke();
  }
  for (const z of CITY.roadsZ) {
    g.beginPath();
    g.moveTo(0, toPx(z));
    g.lineTo(MAP_SIZE, toPx(z));
    g.stroke();
  }

  // Coast line.
  g.strokeStyle = "rgba(88,203,228,0.55)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(toPx(-128), 0);
  g.lineTo(toPx(-128), MAP_SIZE);
  g.stroke();

  // Pier.
  g.fillStyle = "#5a4741";
  g.fillRect(toPx(-170), toPx(-8), toPx(-128) - toPx(-170), toPx(8) - toPx(-8));
}
drawMapBase();

/* --------------------------------------------------------------- export-ish */
const world = {
  scene,
  camera,
  renderer,
  colliders,
  worldMeshes,
  HEISTS,
  mapBase,
  MAP_SIZE,
  MAP_RANGE,
  mat,
};

// Expose for automated smoke checks and curious players.
window.__SUNSET__ = {
  ready: false,
  state: null,
  world,
};

export { THREE, scene, camera, renderer, world, dom, HEISTS, colliders, worldMeshes };

/* ------------------------------------------------------------------ vehicles */
const cars = [];
const carColors = [0xff5a5f, 0x4ec5d8, 0xffc857, 0x9a7bff, 0xf7f0df, 0x1f9d7a, 0xff8a3d, 0x6d83ff];

function makeCar(color, opts = {}) {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.isPolice ? 0.46 : 0.38,
    metalness: 0.55,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x161820, roughness: 0.62, metalness: 0.2 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.5, 4.25), paint);
  chassis.position.y = 0.62;
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.26, 1.1), paint);
  nose.position.set(0, 0.92, 1.58);
  bodyGroup.add(nose);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.22, 0.9), paint);
  trunk.position.set(0, 0.9, -1.68);
  bodyGroup.add(trunk);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.56, 1.82),
    new THREE.MeshStandardMaterial({ color: 0x182c48, roughness: 0.12, metalness: 0.72 })
  );
  glass.position.set(0, 1.18, -0.1);
  bodyGroup.add(glass);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 1.55), paint);
  roof.position.set(0, 1.48, -0.1);
  bodyGroup.add(roof);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.14, 0.12), mat.chrome);
  bumperFront.position.set(0, 0.44, 2.17);
  bodyGroup.add(bumperFront);
  const bumperRear = bumperFront.clone();
  bumperRear.position.z = -2.17;
  bodyGroup.add(bumperRear);

  // Lights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff1c7, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff274e, toneMapped: false });
  for (const x of [-0.62, 0.62]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    head.position.set(x, 0.76, 2.15);
    bodyGroup.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailMat);
    tail.position.set(x, 0.76, -2.15);
    bodyGroup.add(tail);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const x of [-1.02, 1.02]) {
    for (const z of [-1.38, 1.38]) {
      const wheel = new THREE.Mesh(wheelGeo, mat.tire);
      wheel.position.set(x, 0.38, z);
      bodyGroup.add(wheel);
      wheels.push(wheel);
    }
  }

  // Police light bar.
  let lightBar = null;
  if (opts.isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.1, 0.32), mat.darkMetal);
    bar.position.set(0, 1.58, -0.1);
    bodyGroup.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.24), new THREE.MeshBasicMaterial({ color: 0xff244e, toneMapped: false }));
    red.position.set(-0.3, 1.66, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.24), new THREE.MeshBasicMaterial({ color: 0x2f7dff, toneMapped: false }));
    blue.position.set(0.3, 1.66, -0.1);
    bodyGroup.add(red, blue);
    lightBar = { red, blue };
    // Police door stripe.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: 0x1b2d63 }));
    stripe.position.set(0, 0.9, 0.97);
    bodyGroup.add(stripe);
  }

  // Soft contact shadow.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 18),
    new THREE.MeshBasicMaterial({ color: 0x05050b, transparent: true, opacity: 0.36, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.35, 1, 2.1);
  shadow.position.y = 0.035;
  root.add(shadow);

  if (opts.underglow) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 5.2),
      new THREE.MeshBasicMaterial({ color: opts.underglow, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    root.add(glow);
  }

  root.position.y = 0.09;
  const car = {
    root,
    bodyGroup,
    wheels,
    lightBar,
    isPolice: !!opts.isPolice,
    isPlayerCar: false,
    driverless: opts.driverless ?? true,
    parked: opts.parked ?? false,
    traffic: opts.traffic ?? null,
    heading: opts.heading ?? 0,
    speed: 0,
    health: opts.isPolice ? 100 : 70,
    type: opts.isPolice ? "police" : opts.type || "car",
    color,
    lastHit: 0,
  };
  root.userData.car = car;
  root.traverse((o) => { if (o.isMesh) o.userData.car = car; });
  root.rotation.y = car.heading;
  scene.add(root);
  cars.push(car);
  return car;
}

function addTraffic() {
  for (let i = 0; i < 15; i++) {
    const vertical = rand() < 0.5;
    const dir = rand() < 0.5 ? 1 : -1;
    const color = pick(carColors);
    let x, z, heading, traffic;
    if (vertical) {
      const road = pick(CITY.roadsX);
      x = road + (dir > 0 ? -2.7 : 2.7);
      z = rr(-125, 125);
      heading = dir > 0 ? 0 : Math.PI;
      traffic = { axis: "z", dir, speed: rr(7, 12) };
    } else {
      const road = pick(CITY.roadsZ);
      z = road + (dir > 0 ? 2.7 : -2.7);
      x = rr(-125, 125);
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      traffic = { axis: "x", dir, speed: rr(7, 12) };
    }
    const car = makeCar(color, { heading, driverless: true, traffic });
    car.root.position.set(x, 0.09, z);
    car.traffic = traffic;
  }

  // The player's first ride, parked on Ocean Drive.
  const starter = makeCar(0xff7a35, { heading: Math.PI, parked: true, underglow: 0xff7a35 });
  starter.root.position.set(-86.5, 0.09, 78);
  starter.speed = 0;

  // A few curbside cars for variety.
  const parked = [
    [-47.2, 15, Math.PI, 0x53c7b5],
    [3.2, 58, 0, 0x9c7cff],
    [48.8, -30, Math.PI, 0xf5e6cf],
    [92.7, 22, 0, 0xff5678],
    [-41.8, -74, Math.PI / 2, 0xffbf52],
  ];
  for (const [x, z, heading, color] of parked) {
    const c = makeCar(color, { heading, parked: true });
    c.root.position.set(x, 0.09, z);
  }
}
addTraffic();

/* ---------------------------------------------------------------- humanoids */
const skinTones = [0xd8a47f, 0x9b6547, 0x6d432f, 0xf0c3a1, 0xb97d58, 0x4f3126];
const jacketColors = [0xf3e7d4, 0xff6b7e, 0x58c5c9, 0xffc04d, 0x7a7ee8, 0x3c8d6b, 0xd8d8e8];
const pantsColors = [0x202534, 0x3a3349, 0x4a3d36, 0x2d4250, 0x1b1c24];

function makeHumanoid(opts = {}) {
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);

  const skin = new THREE.MeshStandardMaterial({ color: opts.skin ?? pick(skinTones), roughness: 0.72 });
  const jacket = new THREE.MeshStandardMaterial({ color: opts.jacket ?? pick(jacketColors), roughness: 0.72 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants ?? pick(pantsColors), roughness: 0.84 });
  const shoes = new THREE.MeshStandardMaterial({ color: opts.shoes ?? 0x171820, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hair ?? 0x17131a, roughness: 0.9 });

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.32), pants);
  hips.position.y = 1.02;
  model.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.38), jacket);
  torso.position.y = 1.48;
  model.add(torso);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.36), new THREE.MeshStandardMaterial({ color: 0xf2dcc2, roughness: 0.8 }));
  collar.position.y = 1.85;
  model.add(collar);

  if (opts.backpack) {
    const packMat = new THREE.MeshStandardMaterial({ color: 0x262a35, roughness: 0.82 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.22), packMat);
    pack.position.set(0, 1.42, -0.28);
    model.add(pack);
    const strapMat = new THREE.MeshStandardMaterial({ color: 0xff7a35, roughness: 0.7 });
    for (const sx of [-0.2, 0.2]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.03), strapMat);
      strap.position.set(sx, 1.48, -0.39);
      model.add(strap);
    }
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.4), strapMat);
    belt.position.y = 1.13;
    model.add(belt);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 2.02;
  head.scale.set(1, 1.08, 0.96);
  model.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, TAU, 0, Math.PI * 0.62), hairMat);
  hair.position.y = 2.04;
  hair.scale.set(1.02, 1.02, 1.02);
  model.add(hair);

  if (opts.glasses) {
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x0b0b12 }));
    glasses.position.set(0, 2.04, 0.21);
    model.add(glasses);
  }

  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.17, 1.0, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.52, 0.25), pants);
    thigh.position.y = -0.26;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.22), pants);
    shin.position.y = -0.74;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.42), shoes);
    shoe.position.set(0, -1.01, 0.08);
    leg.add(thigh, shin, shoe);
    model.add(leg);
    legs.push(leg);

    const arm = new THREE.Group();
    arm.position.set(side * 0.47, 1.72, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.42, 0.22), jacket);
    upper.position.y = -0.2;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), skin);
    fore.position.y = -0.58;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), skin);
    hand.position.y = -0.82;
    arm.add(upper, fore, hand);
    model.add(arm);
    arms.push(arm);
  }

  // Pistol in right hand.
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.42), mat.darkMetal);
  gunBody.position.set(0, -0.8, 0.16);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.26), mat.chrome);
  barrel.position.set(0, -0.78, 0.42);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.78, 0.56);
  gun.add(gunBody, barrel, muzzle);
  arms[1].add(gun);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 16),
    new THREE.MeshBasicMaterial({ color: 0x05050b, transparent: true, opacity: 0.34, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  shadow.scale.set(1, 1, 1.35);
  scene.add(shadow);

  scene.add(root);
  const human = {
    root,
    model,
    hips,
    torso,
    head,
    hair,
    legs,
    arms,
    gun,
    muzzle,
    shadow,
    animPhase: rr(0, 10),
    baseY: 0.09,
    aiming: false,
    dead: false,
    deathTime: 0,
  };
  root.userData.human = human;
  root.traverse((o) => { if (o.isMesh) o.userData.human = human; });
  return human;
}

function animateHumanoid(h, speed, dt, opts = {}) {
  if (h.dead) {
    h.deathTime += dt;
    const t = Math.min(1, h.deathTime * 4.5);
    h.model.rotation.x = lerp(0, -Math.PI / 2.1, t);
    h.model.position.y = lerp(0, 0.2, t);
    return;
  }
  const moving = speed > 0.2;
  h.animPhase += dt * (moving ? 3.5 + speed * 0.85 : 1.2);
  const swing = moving ? Math.min(1, speed / 6) : 0;
  const s = Math.sin(h.animPhase);
  const c = Math.cos(h.animPhase);

  if (opts.aiming) {
    h.aiming = true;
    h.arms[1].rotation.x = damp(h.arms[1].rotation.x, -Math.PI / 2 - 0.05, 16, dt);
    h.arms[1].rotation.z = damp(h.arms[1].rotation.z, 0.05, 16, dt);
    h.arms[0].rotation.x = damp(h.arms[0].rotation.x, -0.32, 10, dt);
  } else {
    h.aiming = false;
    h.arms[1].rotation.x = damp(h.arms[1].rotation.x, s * 0.55 * swing, 10, dt);
    h.arms[0].rotation.x = damp(h.arms[0].rotation.x, -s * 0.55 * swing, 10, dt);
    h.arms[1].rotation.z = damp(h.arms[1].rotation.z, 0, 10, dt);
  }
  h.legs[0].rotation.x = s * 0.62 * swing;
  h.legs[1].rotation.x = -s * 0.62 * swing;
  h.model.position.y = moving ? Math.abs(c) * 0.045 * swing : Math.sin(h.animPhase * 1.4) * 0.012;
  h.torso.rotation.y = s * 0.045 * swing;
  h.head.rotation.y = -s * 0.03 * swing;
  h.shadow.position.set(h.root.position.x, 0.035, h.root.position.z);
  h.shadow.material.opacity = 0.34;
  h.shadow.scale.setScalar(1 - h.model.position.y * 0.5);
}

/* ------------------------------------------------------------------- player */
const player = makeHumanoid({
  skin: 0xd4a17c,
  jacket: 0xf3e7d4,
  pants: 0x252b3a,
  shoes: 0xf4f0e6,
  hair: 0x1a1418,
  glasses: true,
  backpack: true,
});
player.root.position.set(-90.5, 0.09, 67);
player.root.rotation.y = Math.PI / 2;
player.gun.visible = true;
const playerShadow = player.shadow;

/* -------------------------------------------------------------- pedestrians */
const pedestrians = [];
const pedRoutes = [];
for (let z = -112; z <= 112; z += 27) {
  pedRoutes.push({ x: -93.8, z0: z, z1: z + 20, axis: "z" });
  pedRoutes.push({ x: -84.8, z0: z, z1: z + 20, axis: "z" });
}
for (let x = -70; x <= 110; x += 29) {
  pedRoutes.push({ x0: x, x1: x + 20, z: -47.6, axis: "x" });
  pedRoutes.push({ x0: x, x1: x + 20, z: -42.4, axis: "x" });
}

function addPedestrians() {
  for (let i = 0; i < 16; i++) {
    const route = pick(pedRoutes);
    const h = makeHumanoid({ glasses: rand() < 0.2 });
    h.root.scale.setScalar(rr(0.9, 1.04));
    let x, z, heading;
    if (route.axis === "z") {
      x = route.x;
      z = rr(route.z0, route.z1);
      heading = rand() < 0.5 ? 0 : Math.PI;
    } else {
      x = rr(route.x0, route.x1);
      z = route.z;
      heading = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    h.root.position.set(x, 0.09, z);
    h.root.rotation.y = heading;
    const ped = {
      human: h,
      heading,
      speed: rr(1.1, 1.9),
      timer: rr(2, 7),
      route,
      alive: true,
      panic: 0,
      x,
      z,
    };
    pedestrians.push(ped);
  }
}
addPedestrians();

/* --------------------------------------------------------------- game state */
const SPAWN = new THREE.Vector3(-90.5, 0.09, 67);
const game = {
  started: false,
  paused: false,
  dead: false,
  respawnTimer: 0,
  pos: new THREE.Vector3().copy(SPAWN),
  y: 0.09,
  vy: 0,
  onGround: true,
  heading: Math.PI / 2,
  health: 100,
  armor: 100,
  money: 3420,
  wanted: 0,
  currentHeist: 0,
  stage: "approach",
  lootProgress: 0,
  escapeTimer: 0,
  freeHeatTimer: 0,
  lastDamage: -99,
  aimTimer: 0,
  firing: false,
  fireCooldown: 0,
  ammo: 12,
  maxAmmo: 12,
  reloading: false,
  reloadTimer: 0,
  driving: null,
  nearCar: null,
  nearHeist: false,
  nearSafe: false,
  toastTimer: 0,
  completeTimer: 0,
  time: 0,
  lastPrompt: "",
  jobsDone: 0,
  kills: 0,
  touchMove: { x: 0, y: 0 },
  touchSprint: false,
};

const cam = {
  yaw: 0,
  pitch: 0.12,
  dist: 7.0,
  driveLook: 0,
  shake: 0,
  initialised: false,
};

const keys = {
  w: false, a: false, s: false, d: false,
  shift: false, space: false, e: false, f: false, r: false,
  up: false, down: false, left: false, right: false,
};

/* -------------------------------------------------------------- heist props */
const heistMarkers = [];
const heistSafes = [];
const glowTexture = makeGlowTexture();

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,220,150,0.9)");
  grad.addColorStop(0.55, "rgba(255,120,50,0.32)");
  grad.addColorStop(1, "rgba(255,80,30,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHeistMarker(heist) {
  const group = new THREE.Group();
  group.position.copy(heist.pos);
  const color = new THREE.Color(0xffd35a);

  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.075, 8, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.025, 6, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false }));
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.1;
  group.add(ring2);

  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 6.4, 20, 1, true), beamMat);
  beam.position.y = 3.2;
  group.add(beam);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.09;
  group.add(disc);

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98, toneMapped: false })
  );
  diamond.position.y = 3.1;
  diamond.scale.set(1.15, 1.6, 1.15);
  group.add(diamond);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.set(3.6, 3.6, 1);
  halo.position.y = 3.1;
  group.add(halo);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 96;
  const lg = labelCanvas.getContext("2d");
  lg.fillStyle = "rgba(8,8,18,0.72)";
  lg.fillRect(16, 18, 224, 60);
  lg.strokeStyle = "#ffd35a";
  lg.lineWidth = 3;
  lg.strokeRect(16, 18, 224, 60);
  lg.fillStyle = "#ffd35a";
  lg.font = '700 42px "Rajdhani", sans-serif';
  lg.textAlign = "center";
  lg.textBaseline = "middle";
  lg.fillText("HEIST", 128, 49);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, toneMapped: false }));
  label.scale.set(2.6, 0.98, 1);
  label.position.y = 4.85;
  group.add(label);

  group.visible = false;
  scene.add(group);

  // Safe prop at the door.
  const safe = new THREE.Group();
  safe.position.copy(heist.pos);
  safe.position.x += 1.15;
  const safeBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x242a39, roughness: 0.4, metalness: 0.75 })
  );
  safeBody.position.y = 0.52;
  safeBody.castShadow = true;
  const safeDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.64, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xd8b66d, roughness: 0.28, metalness: 0.9, emissive: 0x5e3a00, emissiveIntensity: 0.6 })
  );
  safeDoor.position.set(0.44, 0.52, 0);
  safe.add(safeBody, safeDoor);
  safe.visible = false;
  scene.add(safe);

  const marker = { group, ring, ring2, beam, disc, diamond, halo, label, safe, heist };
  heistMarkers.push(marker);
  heistSafes.push(safe);
  return marker;
}

HEISTS.forEach(makeHeistMarker);

function showMarker(index) {
  heistMarkers.forEach((m, i) => {
    m.group.visible = i === index && game.stage !== "escape" && game.stage !== "complete";
    m.safe.visible = false;
  });
  if (heistMarkers[index]) {
    heistMarkers[index].group.visible = true;
  }
}

function updateMarkers(dt) {
  const t = game.time;
  heistMarkers.forEach((m, i) => {
    if (!m.group.visible) return;
    const active = i === game.currentHeist;
    m.ring.rotation.z += dt * 0.7;
    m.ring2.rotation.z -= dt * 0.45;
    m.diamond.rotation.y += dt * 1.7;
    m.diamond.position.y = 3.1 + Math.sin(t * 2.2 + i) * 0.22;
    m.halo.position.y = m.diamond.position.y;
    const pulse = 0.5 + Math.sin(t * 3 + i) * 0.12;
    const dist = camera.position.distanceTo(m.group.position);
    m.disc.material.opacity = active ? pulse * 0.42 : 0.08;
    m.beam.material.opacity = active ? 0.13 + Math.sin(t * 2.4) * 0.03 : 0.02;
    m.ring.material.opacity = active ? 0.95 : 0.25;
    // Keep the billboard legible at range without letting it swallow the
    // screen when the player is standing on the marker.
    const labelVisible = dist > 9.5;
    m.label.visible = labelVisible;
    if (labelVisible) {
      const s = clamp(dist * 0.135, 1.55, 3.1);
      m.label.scale.set(s, s * 0.377, 1);
      m.label.position.y = 4.85;
      m.label.material.opacity = clamp((dist - 9.5) / 5, 0, 1);
    }
    m.halo.material.opacity = clamp((dist - 5) / 10, 0.12, 0.6);
  });
  for (const m of heistMarkers) {
    if (m.safe.visible) {
      m.safe.rotation.y = Math.sin(t * 1.3) * 0.12;
      m.safe.children[1].material.emissiveIntensity = 0.6 + Math.sin(t * 5) * 0.3;
    }
  }
}

/* ------------------------------------------------------------------ effects */
const effects = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const enemyTracerMat = new THREE.LineBasicMaterial({ color: 0xff5f75, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

function addTracer(from, to, friendly = true) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, friendly ? tracerMat.clone() : enemyTracerMat.clone());
  line.frustumCulled = false;
  scene.add(line);
  effects.push({ obj: line, life: 0.08, max: 0.08, fade: true });
}

function addFlash(pos, scale = 1, color = 0xffd27a, life = 0.08) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  sprite.position.copy(pos);
  sprite.scale.set(scale, scale, 1);
  scene.add(sprite);
  effects.push({ obj: sprite, life, max: life, fade: true });
}

function addExplosion(pos, scale = 8) {
  addFlash(pos, scale, 0xff7a32, 0.5);
  addFlash(pos.clone().add(new THREE.Vector3(0, 1, 0)), scale * 0.65, 0xffd35a, 0.34);
  for (let i = 0; i < 7; i++) {
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(rr(0.12, 0.3), rr(0.12, 0.3), rr(0.12, 0.3)),
      new THREE.MeshBasicMaterial({ color: pick([0x23242e, 0xff7a35, 0xffb04b]), toneMapped: false })
    );
    debris.position.copy(pos);
    scene.add(debris);
    effects.push({
      obj: debris,
      life: rr(0.6, 1.1),
      max: 1.1,
      vel: new THREE.Vector3(rr(-7, 7), rr(3, 9), rr(-7, 7)),
      gravity: true,
    });
  }
  cam.shake = Math.max(cam.shake, 0.45);
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.vel) {
      e.vel.y -= 14 * dt;
      e.obj.position.addScaledVector(e.vel, dt);
      e.obj.rotation.x += dt * 8;
      e.obj.rotation.y += dt * 6;
    }
    if (e.fade && e.obj.material) {
      e.obj.material.opacity = clamp(e.life / e.max, 0, 1);
    }
    if (e.life <= 0) {
      scene.remove(e.obj);
      if (e.obj.geometry) e.obj.geometry.dispose();
      if (e.obj.material) e.obj.material.dispose();
      effects.splice(i, 1);
    }
  }
}

/* -------------------------------------------------------------------- audio */
const audio = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  sirenGain: null,
  sirenOsc: null,
  noiseBuffer: null,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);

      // Engine drone.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 52;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 220;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();

      // Siren.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "triangle";
      this.sirenOsc.frequency.value = 620;
      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 150;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      lfo.start();
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();

      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.ctx.state === "suspended") this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  },
  shot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.16);

    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.2, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  },
  reload() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [delay, freq] of [[0, 900], [0.15, 600]]) {
      const osc = this.ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
      osc.connect(g).connect(this.master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.06);
    }
  },
  engine(speed, driving) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const active = driving ? 1 : 0;
    this.engineGain.gain.setTargetAtTime(active * (0.04 + Math.min(0.1, Math.abs(speed) * 0.003)), t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(42 + Math.abs(speed) * 3.4, t, 0.12);
  },
  siren(active) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(active ? 0.018 : 0, this.ctx.currentTime, 0.25);
  },
};

/* --------------------------------------------------------------- collision */
function collides(x, z, radius = 0.5) {
  if (x < -124 || x > 127 || z < -127 || z > 127) return true;
  for (const c of colliders) {
    if (
      x + radius > c.minX &&
      x - radius < c.maxX &&
      z + radius > c.minZ &&
      z - radius < c.maxZ
    ) return true;
  }
  return false;
}

function moveEntity(pos, dx, dz, radius) {
  let moved = false;
  if (!collides(pos.x + dx, pos.z, radius)) {
    pos.x += dx;
    moved = true;
  }
  if (!collides(pos.x, pos.z + dz, radius)) {
    pos.z += dz;
    moved = true;
  }
  pos.x = clamp(pos.x, -123, 126);
  pos.z = clamp(pos.z, -126, 126);
  return moved;
}

function nearestFreePoint(x, z, radius = 0.6) {
  if (!collides(x, z, radius)) return new THREE.Vector3(x, 0.09, z);
  for (let ring = 1; ring <= 8; ring++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const nx = x + Math.cos(a) * ring * 1.4;
      const nz = z + Math.sin(a) * ring * 1.4;
      if (!collides(nx, nz, radius)) return new THREE.Vector3(nx, 0.09, nz);
    }
  }
  return new THREE.Vector3(x, 0.09, z);
}

/* ------------------------------------------------------------------ guards */
const guards = [];

function spawnGuards(count) {
  const heist = HEISTS[game.currentHeist];
  const offsets = [
    [-1.8, 2.0], [-2.4, -4.0], [-1.2, 5.2], [-3.0, -1.0], [-1.5, -2.5],
  ];
  for (let i = 0; i < count; i++) {
    const [ox, oz] = offsets[i % offsets.length];
    let x = heist.pos.x + ox + rr(-0.5, 0.5);
    let z = heist.pos.z + oz + rr(-0.5, 0.5);
    if (collides(x, z, 0.6)) {
      x = heist.pos.x - 3.4 - i * 0.7;
      z = heist.pos.z + rr(-3, 3);
    }
    const human = makeHumanoid({
      jacket: 0x8d263c,
      pants: 0x17171f,
      skin: pick(skinTones),
      shoes: 0x0c0c12,
      hair: pick([0x17131a, 0x2c1a16, 0x5b412e]),
    });
    human.root.position.set(x, 0.09, z);
    const guard = {
      human,
      x,
      z,
      health: 44 + game.currentHeist * 12,
      alive: true,
      shootTimer: rr(0.5, 1.7),
      heading: 0,
      deathTimer: 0,
      hitFlash: 0,
    };
    human.root.userData.guard = guard;
    human.root.traverse((o) => { if (o.isMesh) o.userData.guard = guard; });

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 2.2, 0.75),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    hitbox.position.y = 1.1;
    hitbox.userData.guard = guard;
    hitbox.userData.isHitbox = true;
    human.root.add(hitbox);

    guards.push(guard);
    addFlash(new THREE.Vector3(x, 1.5, z), 2.6, 0xff3f72, 0.35);
  }
  updateMissionUI(true);
}

function guardShoot(guard) {
  if (!guard.alive) return;
  const muzzle = new THREE.Vector3();
  guard.human.muzzle.getWorldPosition(muzzle);
  const target = new THREE.Vector3(game.pos.x, game.y + 1.35, game.pos.z);
  addTracer(muzzle, target, false);
  addFlash(muzzle, 0.75, 0xffb070, 0.05);
  if (rand() < 0.72) damagePlayer(rr(3.5, 7.5));
  audio.shot();
}

function damageGuard(guard, amount) {
  if (!guard.alive) return;
  guard.health -= amount;
  guard.hitFlash = 0.14;
  if (guard.health <= 0) {
    guard.alive = false;
    guard.deathTimer = 0;
    game.kills++;
    addFlash(new THREE.Vector3(guard.x, 1.4, guard.z), 1.5, 0xff2450, 0.25);
    const hitbox = guard.human.root.children.find((c) => c.userData.isHitbox);
    if (hitbox) hitbox.userData.guard = null;
    if (game.stage === "combat" && guards.every((g) => !g.alive)) {
      game.stage = "loot";
      const m = heistMarkers[game.currentHeist];
      m.safe.visible = true;
      m.group.visible = false;
      showToast("ALL CLEAR — CRACK THE SAFE", 2.6);
      updateMissionUI(true);
      audio.reload();
    }
  } else {
    addFlash(new THREE.Vector3(guard.x, 1.4, guard.z), 0.65, 0xff4466, 0.1);
  }
}

function updateGuards(dt) {
  for (let i = guards.length - 1; i >= 0; i--) {
    const g = guards[i];
    const h = g.human;
    if (!g.alive) {
      animateHumanoid(h, 0, dt);
      g.deathTimer += dt;
      if (g.deathTimer > 7) {
        scene.remove(h.root);
        scene.remove(h.shadow);
        guards.splice(i, 1);
      }
      continue;
    }
    const dx = game.pos.x - g.x;
    const dz = game.pos.z - g.z;
    const d = Math.hypot(dx, dz);
    g.heading = Math.atan2(dx, dz);
    h.root.rotation.y = damp(h.root.rotation.y, g.heading, 8, dt);

    let moveSpeed = 0;
    if (d > 9 && game.stage === "combat") {
      const nx = g.x + (dx / d) * 1.9 * dt;
      const nz = g.z + (dz / d) * 1.9 * dt;
      if (!collides(nx, nz, 0.45)) {
        g.x = nx;
        g.z = nz;
        moveSpeed = 1.9;
      }
    }
    h.root.position.set(g.x, 0.09, g.z);

    g.shootTimer -= dt;
    if (d < 34 && g.shootTimer <= 0 && game.stage === "combat") {
      guardShoot(g);
      g.shootTimer = rr(0.9, 1.8);
    }
    animateHumanoid(h, moveSpeed, dt, { aiming: d < 36 });
    if (g.hitFlash > 0) {
      g.hitFlash -= dt;
      h.torso.material.emissive = new THREE.Color(0x661020);
      h.torso.material.emissiveIntensity = g.hitFlash * 8;
    } else {
      h.torso.material.emissiveIntensity = 0;
    }
  }
}

/* ------------------------------------------------------------------ police */
const policeCars = [];

function removeCar(car) {
  scene.remove(car.root);
  const ci = cars.indexOf(car);
  if (ci >= 0) cars.splice(ci, 1);
  const pi = policeCars.indexOf(car);
  if (pi >= 0) policeCars.splice(pi, 1);
}

function spawnPolice(count) {
  const positions = [];
  for (const x of CITY.roadsX) {
    const z = clamp(game.pos.z + rr(-85, 85), -118, 118);
    if (dist2(x, z, game.pos.x, game.pos.z) > 34) positions.push([x, z]);
  }
  for (const z of CITY.roadsZ) {
    const x = clamp(game.pos.x + rr(-85, 85), -118, 118);
    if (dist2(x, z, game.pos.x, game.pos.z) > 34) positions.push([x, z]);
  }
  let attempts = 0;
  while (policeCars.length < count && attempts < 40) {
    attempts++;
    const [x, z] = positions.length ? pick(positions) : [rr(-100, 100), rr(-100, 100)];
    if (collides(x, z, 1.8)) continue;
    const heading = Math.atan2(game.pos.x - x, game.pos.z - z);
    const car = makeCar(0x111d3a, { isPolice: true, heading, driverless: false });
    car.root.position.set(x, 0.09, z);
    car.health = 125;
    car.speed = 0;
    car.shootTimer = rr(0.7, 1.8);
    policeCars.push(car);
  }
}

function clearPolice() {
  for (const p of [...policeCars]) {
    addFlash(new THREE.Vector3(p.root.position.x, 1.2, p.root.position.z), 2.2, 0x3b7bff, 0.25);
    removeCar(p);
  }
  policeCars.length = 0;
  audio.siren(false);
}

function setWanted(n, spawn = true) {
  game.wanted = clamp(Math.round(n), 0, 5);
  if (game.wanted > 0) {
    audio.siren(true);
    if (spawn) spawnPolice(game.wanted + 1);
    if (game.stage !== "escape") game.freeHeatTimer = 12;
  } else {
    clearPolice();
  }
  updateWantedUI();
}

function nearestCopDistance() {
  let best = Infinity;
  for (const p of policeCars) {
    const d = dist2(p.root.position.x, p.root.position.z, game.pos.x, game.pos.z);
    if (d < best) best = d;
  }
  return best;
}

function policeShoot(car) {
  const start = new THREE.Vector3(car.root.position.x, 1.4, car.root.position.z);
  start.add(new THREE.Vector3(Math.sin(car.heading) * 2.2, 0, Math.cos(car.heading) * 2.2));
  const target = new THREE.Vector3(game.pos.x, game.y + 1.1, game.pos.z);
  addTracer(start, target, false);
  addFlash(start, 0.7, 0x8ec8ff, 0.05);
  if (rand() < 0.55) damagePlayer(rr(2.4, 5.6));
  audio.shot();
}

function updatePolice(dt) {
  for (let i = policeCars.length - 1; i >= 0; i--) {
    const car = policeCars[i];
    if (game.wanted <= 0) {
      removeCar(car);
      continue;
    }
    const px = car.root.position.x;
    const pz = car.root.position.z;
    const dx = game.pos.x - px;
    const dz = game.pos.z - pz;
    const d = Math.hypot(dx, dz) || 0.01;
    const desired = Math.atan2(dx, dz);
    const diff = angleDelta(car.heading, desired);
    car.heading += clamp(diff, -2.1 * dt, 2.1 * dt);
    const targetSpeed = d < 5 ? 0 : d < 18 ? 9 : 20;
    car.speed = damp(car.speed, targetSpeed, 2.5, dt);

    const nx = px + Math.sin(car.heading) * car.speed * dt;
    const nz = pz + Math.cos(car.heading) * car.speed * dt;
    if (!collides(nx, nz, 1.7)) {
      car.root.position.x = nx;
      car.root.position.z = nz;
    } else {
      car.speed *= -0.2;
      car.heading += rr(-1, 1);
    }
    car.root.rotation.y = car.heading;
    car.bodyGroup.rotation.z = damp(car.bodyGroup.rotation.z, clamp(-diff, -1, 1) * 0.04, 5, dt);

    if (car.lightBar) {
      const blink = Math.floor(game.time * 7) % 2 === 0;
      car.lightBar.red.material.color.setHex(blink ? 0xff244e : 0x3a0812);
      car.lightBar.blue.material.color.setHex(blink ? 0x18245a : 0x2f7dff);
    }

    car.shootTimer -= dt;
    if (d < 38 && car.shootTimer <= 0) {
      policeShoot(car);
      car.shootTimer = rr(1.3, 2.5);
    }
    if (d < 3.4 && car.speed > 7) {
      damagePlayer(rr(3, 7));
      car.speed *= -0.3;
      cam.shake = Math.max(cam.shake, 0.3);
    }
  }
}

function damageCar(car, amount) {
  if (car.isPlayerCar && game.driving === car) {
    // The player's car can take a few hits, but is not the health UI.
  }
  car.health -= amount;
  addFlash(new THREE.Vector3(car.root.position.x, 1.2, car.root.position.z), 1.1, 0xffb55b, 0.12);
  if (car.health <= 0) {
    const pos = new THREE.Vector3(car.root.position.x, 0.8, car.root.position.z);
    if (game.driving === car) exitCar(true);
    addExplosion(pos, 7.5);
    audio.siren(false);
    removeCar(car);
    if (game.stage !== "escape") setWanted(Math.min(5, game.wanted + 1));
  }
}

/* ------------------------------------------------------------------ damage */
function damagePlayer(amount) {
  if (game.dead || game.paused) return;
  game.lastDamage = game.time;
  let left = amount;
  if (game.armor > 0) {
    const absorbed = Math.min(game.armor, left * 0.62);
    game.armor -= absorbed;
    left -= absorbed;
  }
  game.health -= left;
  cam.shake = Math.max(cam.shake, 0.18);
  dom.hud.classList.add("hurt");
  setTimeout(() => dom.hud.classList.remove("hurt"), 90);
  if (game.health <= 0) {
    game.health = 0;
    die();
  }
  updateVitals();
}

function die() {
  if (game.dead) return;
  game.dead = true;
  game.respawnTimer = 2.6;
  game.aimTimer = 0;
  if (game.driving) exitCar(true);
  player.root.visible = false;
  player.shadow.visible = false;
  dom.wasted.classList.add("show");
  clearPolice();
  game.wanted = 0;
  updateWantedUI();
  audio.siren(false);
}

function respawn() {
  game.dead = false;
  game.respawnTimer = 0;
  game.health = 100;
  game.armor = 50;
  game.money = Math.max(0, game.money - 500);
  game.wanted = 0;
  game.stage = "approach";
  game.lootProgress = 0;
  game.escapeTimer = 0;
  game.pos.copy(SPAWN);
  game.y = 0.09;
  game.vy = 0;
  game.heading = Math.PI / 2;
  player.root.visible = true;
  player.shadow.visible = true;
  player.root.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
  player.root.rotation.y = Math.PI / 2;
  clearPolice();
  for (const g of guards) {
    scene.remove(g.human.root);
    scene.remove(g.human.shadow);
  }
  guards.length = 0;
  heistSafes.forEach((s) => (s.visible = false));
  showMarker(game.currentHeist);
  dom.wasted.classList.remove("show");
  cam.yaw = game.heading + Math.PI;
  cam.pitch = 0.12;
  cam.initialised = false;
  showToast("HOSPITAL BILL −$500", 2.4);
  updateMissionUI(true);
  updateVitals();
  updateWantedUI();
}
/* ------------------------------------------------------------------ mission */
function startHeist() {
  if (game.stage !== "approach" || game.dead) return;
  game.stage = "combat";
  game.lootProgress = 0;
  spawnGuards(HEISTS[game.currentHeist].guards);
  const m = heistMarkers[game.currentHeist];
  m.safe.visible = false;
  m.group.visible = true;
  showToast("JOB UNDERWAY — CLEAR THE GUARDS", 2.5);
  updateMissionUI(true);
  audio.reload();
}

function lootComplete() {
  const heist = HEISTS[game.currentHeist];
  game.stage = "escape";
  game.lootProgress = 1;
  game.money += heist.reward;
  game.escapeTimer = 16;
  const m = heistMarkers[game.currentHeist];
  m.group.visible = false;
  m.safe.visible = false;
  setWanted(heist.wanted);
  showToast(`SCORE SECURED +$${heist.reward.toLocaleString()}`, 2.8);
  updateMissionUI(true);
  updateVitals();
  audio.siren(true);
}

function completeHeist() {
  if (game.stage === "complete") return;
  const heist = HEISTS[game.currentHeist];
  game.stage = "complete";
  game.jobsDone++;
  game.escapeTimer = 0;
  setWanted(0);
  dom.heatBanner.classList.remove("show");
  dom.completeCash.textContent = `+$${heist.reward.toLocaleString()}`;
  dom.jobComplete.classList.add("show");
  game.completeTimer = 3.4;
  game.paused = true;
  cam.shake = 0;
  audio.siren(false);
  updateMissionUI(true);
}

function nextHeist() {
  dom.jobComplete.classList.remove("show");
  game.paused = false;
  if (game.currentHeist < HEISTS.length - 1) {
    game.currentHeist++;
    game.stage = "approach";
    game.lootProgress = 0;
    game.escapeTimer = 0;
    showMarker(game.currentHeist);
    updateMissionUI(true);
    showToast(`NEW JOB — ${HEISTS[game.currentHeist].title}`, 3);
  } else {
    dom.final.classList.add("show");
    game.paused = true;
    game.started = false;
    dom.touch.classList.add("is-hidden");
  }
}

/* ------------------------------------------------------------------ driving */
function findNearestCar() {
  let best = null;
  let bestD = 5.0;
  for (const car of cars) {
    if (car === game.driving) continue;
    const d = dist2(car.root.position.x, car.root.position.z, game.pos.x, game.pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  if (!car || game.dead) return;
  game.driving = car;
  car.isPlayerCar = true;
  car.driverless = false;
  car.traffic = null;
  car.speed = 0;
  const pi = policeCars.indexOf(car);
  if (pi >= 0) policeCars.splice(pi, 1);
  player.root.visible = false;
  player.shadow.visible = false;
  cam.driveLook = 0;
  cam.dist = 9.4;
  cam.initialised = false;
  showToast(car.isPolice ? "POLICE CRUISER ACQUIRED" : "RIDE ACQUIRED", 1.8);
  updateMissionUI(true);
}

function exitCar(force = false) {
  const car = game.driving;
  if (!car) return;
  const heading = car.heading;
  let px = car.root.position.x - Math.cos(heading) * 2.0;
  let pz = car.root.position.z + Math.sin(heading) * 2.0;
  if (collides(px, pz, 0.5)) {
    px = car.root.position.x + Math.cos(heading) * 2.0;
    pz = car.root.position.z - Math.sin(heading) * 2.0;
  }
  if (collides(px, pz, 0.5)) {
    const p = nearestFreePoint(car.root.position.x, car.root.position.z, 0.5);
    px = p.x;
    pz = p.z;
  }
  car.isPlayerCar = false;
  car.speed = 0;
  car.driverless = true;
  car.parked = true;
  car.traffic = null;
  game.driving = null;
  game.pos.set(px, 0.09, pz);
  game.y = 0.09;
  game.vy = 0;
  game.heading = heading;
  player.root.visible = true;
  player.shadow.visible = true;
  player.root.position.set(px, 0.09, pz);
  player.root.rotation.y = heading;
  cam.yaw = heading + Math.PI;
  cam.pitch = 0.12;
  cam.dist = 7.0;
  cam.initialised = false;
  if (!force) showToast("ON FOOT", 1.1);
  updateMissionUI(true);
}

function updateDriving(dt) {
  const car = game.driving;
  if (!car) return;
  const keyboardY = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const keyboardX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let throttle = clamp(keyboardY + game.touchMove.y, -1, 1);
  let steer = clamp(keyboardX + game.touchMove.x, -1, 1);
  if (Math.abs(throttle) < 0.08) throttle = 0;
  if (Math.abs(steer) < 0.08) steer = 0;

  const maxForward = 27;
  const maxReverse = -8;
  if (throttle > 0) {
    car.speed += 9.5 * throttle * dt * (1 - clamp(car.speed / maxForward, 0, 0.55));
  } else if (throttle < 0) {
    car.speed += 8.0 * throttle * dt;
  }
  // Drag / rolling resistance.
  car.speed *= 1 - 0.75 * dt;
  if (throttle === 0 && Math.abs(car.speed) < 0.15) car.speed = 0;
  car.speed = clamp(car.speed, maxReverse, maxForward);

  const speedFactor = clamp(Math.abs(car.speed) / 9, 0, 1);
  car.heading += steer * 1.55 * speedFactor * dt * (car.speed < 0 ? -1 : 1);

  const nx = car.root.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.root.position.z + Math.cos(car.heading) * car.speed * dt;
  if (!collides(nx, nz, 1.75)) {
    car.root.position.x = nx;
    car.root.position.z = nz;
  } else {
    car.speed *= -0.18;
    cam.shake = Math.max(cam.shake, 0.22);
    addFlash(new THREE.Vector3(nx, 1.2, nz), 1.2, 0xffb570, 0.1);
  }
  car.root.rotation.y = car.heading;
  car.bodyGroup.rotation.z = damp(car.bodyGroup.rotation.z, -steer * speedFactor * 0.055, 5, dt);
  car.bodyGroup.rotation.x = damp(car.bodyGroup.rotation.x, throttle * 0.012, 4, dt);
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;

  game.pos.set(car.root.position.x, 0.09, car.root.position.z);
  game.heading = car.heading;
  audio.engine(car.speed, true);

  // Smash through a pedestrian? The city remembers.
  if (Math.abs(car.speed) > 5) {
    for (const ped of pedestrians) {
      if (!ped.alive) continue;
      if (dist2(ped.human.root.position.x, ped.human.root.position.z, game.pos.x, game.pos.z) < 1.7) {
        killPed(ped, true);
      }
    }
  }
}

function updatePlayer(dt) {
  if (game.driving) {
    updateDriving(dt);
    return;
  }
  audio.engine(0, false);

  const keyboardY = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const keyboardX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let ix = clamp(keyboardX + game.touchMove.x, -1, 1);
  let iy = clamp(keyboardY + game.touchMove.y, -1, 1);
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }
  const moving = Math.hypot(ix, iy) > 0.08;
  const sprint = keys.shift || game.touchSprint;
  let speed = sprint ? 7.1 : 4.4;
  if (game.aimTimer > 0.15) speed = Math.min(speed, 4.9);

  if (moving) {
    const forwardX = -Math.sin(cam.yaw);
    const forwardZ = -Math.cos(cam.yaw);
    const rightX = Math.cos(cam.yaw);
    const rightZ = -Math.sin(cam.yaw);
    const dx = (forwardX * iy + rightX * ix) * speed * dt;
    const dz = (forwardZ * iy + rightZ * ix) * speed * dt;
    const targetHeading = Math.atan2(dx, dz);
    game.heading += angleDelta(game.heading, targetHeading) * Math.min(1, 14 * dt);
    moveEntity(game.pos, dx, dz, 0.48);
  }

  // Jump and gravity.
  if (keys.space && game.onGround) {
    game.vy = 5.7;
    game.onGround = false;
  }
  game.vy -= 15.5 * dt;
  game.y += game.vy * dt;
  if (game.y <= 0.09) {
    game.y = 0.09;
    game.vy = 0;
    game.onGround = true;
  }

  player.root.position.set(game.pos.x, game.y, game.pos.z);
  player.root.rotation.y = game.heading;
  player.shadow.visible = true;
  player.shadow.position.set(game.pos.x, 0.035, game.pos.z);
  player.shadow.scale.setScalar(1 - clamp((game.y - 0.09) * 0.35, 0, 0.45));
  animateHumanoid(player, moving ? speed : 0, dt, { aiming: game.aimTimer > 0.05 });
  if (game.aimTimer > 0) game.aimTimer -= dt;
  if (game.firing) game.aimTimer = 0.55;
}

/* ------------------------------------------------------------------- camera */
function segmentBoxDistance(origin, dir, box) {
  let tmin = 0;
  let tmax = 1;
  const axes = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, 0, box.height],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-6) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function clipCamera(target, desired) {
  const dir = desired.clone().sub(target);
  const len = dir.length();
  if (len < 0.001) return desired;
  dir.multiplyScalar(1 / len);
  let closest = 1;
  for (const c of colliders) {
    const t = segmentBoxDistance(target, dir, c);
    if (t !== null && t > 0.01 && t < closest) closest = t;
  }
  if (closest < 1) {
    const p = target.clone().addScaledVector(dir, Math.max(0.5, len * closest - 0.35));
    return p;
  }
  return desired;
}

function updateCamera(dt) {
  let target;
  let yaw;
  let pitch;
  let dist;

  if (game.driving) {
    const car = game.driving;
    target = new THREE.Vector3(car.root.position.x, 1.45, car.root.position.z);
    cam.driveLook = damp(cam.driveLook, 0, 2.2, dt);
    yaw = car.heading + Math.PI + cam.driveLook;
    pitch = 0.26;
    dist = 9.4;
  } else {
    target = new THREE.Vector3(game.pos.x, game.y + 1.5, game.pos.z);
    yaw = cam.yaw;
    pitch = cam.pitch;
    dist = cam.dist;
    // Over-the-shoulder framing keeps the reticle clear of the character.
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    target.x += rightX * 0.72;
    target.z += rightZ * 0.72;
  }

  const cp = Math.cos(pitch);
  const desired = new THREE.Vector3(
    target.x + Math.sin(yaw) * cp * dist,
    target.y + Math.sin(pitch) * dist + 0.55,
    target.z + Math.cos(yaw) * cp * dist
  );
  const clipped = clipCamera(target, desired);

  if (!cam.initialised) {
    camera.position.copy(clipped);
    cam.initialised = true;
  } else {
    camera.position.lerp(clipped, 1 - Math.exp(-12 * dt));
  }

  // Camera shake.
  cam.shake = Math.max(0, cam.shake - dt * 2.2);
  if (cam.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * cam.shake * 0.42;
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.3;
    camera.position.z += (Math.random() - 0.5) * cam.shake * 0.42;
  }

  const look = target.clone();
  look.y += 0.08;
  camera.lookAt(look);

  const targetFov = game.driving && Math.abs(game.driving.speed) > 12 ? 68 : 62;
  camera.fov = damp(camera.fov, targetFov, 2.5, dt);
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ shooting */
const raycaster = new THREE.Raycaster();
raycaster.far = 120;

function startReload() {
  if (game.reloading || game.ammo === game.maxAmmo) return;
  game.reloading = true;
  game.reloadTimer = 1.15;
  audio.reload();
}

function updateReload(dt) {
  if (!game.reloading) {
    dom.reload.style.width = "100%";
    return;
  }
  game.reloadTimer -= dt;
  dom.reload.style.width = `${clamp(1 - game.reloadTimer / 1.15, 0, 1) * 100}%`;
  if (game.reloadTimer <= 0) {
    game.reloading = false;
    game.ammo = game.maxAmmo;
    updateAmmo();
  }
}

function updateAmmo() {
  dom.ammo.textContent = `${game.ammo} / ∞`;
}

function attemptFire() {
  if (!game.started || game.paused || game.dead || game.driving && false) return;
  if (game.reloading || game.fireCooldown > 0) return;
  if (game.ammo <= 0) {
    startReload();
    return;
  }
  game.ammo--;
  game.fireCooldown = 0.24;
  game.aimTimer = 0.75;
  game.firing = true;
  updateAmmo();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  raycaster.set(origin, dir);

  const targets = [...worldMeshes];
  for (const g of guards) if (g.alive) targets.push(g.human.root);
  for (const p of pedestrians) if (p.alive) targets.push(p.human.root);
  for (const c of cars) if (c !== game.driving) targets.push(c.root);

  const hits = raycaster.intersectObjects(targets, true);
  let hit = hits.find((h) => {
    const c = h.object.userData.car;
    if (c && c === game.driving) return false;
    return true;
  });

  const start = new THREE.Vector3();
  if (game.driving) {
    const car = game.driving;
    start.set(car.root.position.x, 1.25, car.root.position.z);
    start.x += Math.sin(car.heading) * 2.0;
    start.z += Math.cos(car.heading) * 2.0;
  } else {
    player.muzzle.getWorldPosition(start);
  }

  let end = origin.clone().addScaledVector(dir, 100);
  if (hit) {
    end = hit.point.clone();
    const guard = hit.object.userData.guard;
    const ped = hit.object.userData.ped;
    const car = hit.object.userData.car;
    if (guard && guard.alive) {
      const headshot = hit.object === guard.human.head || hit.object === guard.human.hair;
      damageGuard(guard, headshot ? 100 : rr(28, 38));
      markHit(headshot);
    } else if (ped && ped.alive) {
      killPed(ped, false);
      markHit(false);
    } else if (car) {
      damageCar(car, rr(20, 30));
      markHit(false);
      if (car.isPolice || game.wanted === 0) setWanted(Math.min(5, game.wanted + 1));
    } else {
      addFlash(end, 0.65, 0xffd9a2, 0.08);
    }
  }

  addTracer(start, end, true);
  addFlash(start, 0.9, 0xffd28a, 0.055);
  cam.shake = Math.max(cam.shake, 0.1);
  audio.shot();
  dom.crosshair.classList.add("is-firing");
  setTimeout(() => dom.crosshair.classList.remove("is-firing"), 80);
  if (game.ammo <= 0) setTimeout(startReload, 140);
}

function markHit(headshot) {
  dom.crosshair.classList.add("is-hit");
  setTimeout(() => dom.crosshair.classList.remove("is-hit"), headshot ? 180 : 100);
}

/* ---------------------------------------------------------------- peds/cars */
function killPed(ped, byCar = false) {
  if (!ped.alive) return;
  ped.alive = false;
  ped.human.dead = true;
  ped.human.deathTime = 0;
  addFlash(new THREE.Vector3(ped.human.root.position.x, 1.2, ped.human.root.position.z), 1.3, 0xff3355, 0.2);
  if (!byCar) setWanted(Math.min(5, game.wanted + 1));
}

function updatePedestrians(dt) {
  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const p = pedestrians[i];
    const h = p.human;
    if (!p.alive) {
      animateHumanoid(h, 0, dt);
      if (h.deathTime > 6) {
        scene.remove(h.root);
        scene.remove(h.shadow);
        pedestrians.splice(i, 1);
      }
      continue;
    }
    p.timer -= dt;
    if (p.timer <= 0) {
      p.timer = rr(3, 8);
      if (rand() < 0.35) {
        p.heading += Math.PI;
      }
    }
    const nx = h.root.position.x + Math.sin(p.heading) * p.speed * dt;
    const nz = h.root.position.z + Math.cos(p.heading) * p.speed * dt;
    if (collides(nx, nz, 0.35) || nx < -124 || nx > 126 || nz < -126 || nz > 126) {
      p.heading += Math.PI;
    } else {
      h.root.position.x = nx;
      h.root.position.z = nz;
    }
    h.root.rotation.y = damp(h.root.rotation.y, p.heading, 5, dt);
    animateHumanoid(h, p.speed, dt);
  }
}

function updateTraffic(dt) {
  for (const car of cars) {
    if (car === game.driving || !car.traffic) continue;
    const t = car.traffic;
    const delta = t.dir * t.speed * dt;
    if (t.axis === "z") {
      car.root.position.z += delta;
      if (car.root.position.z > 130) car.root.position.z = -130;
      if (car.root.position.z < -130) car.root.position.z = 130;
    } else {
      car.root.position.x += delta;
      if (car.root.position.x > 130) car.root.position.x = -130;
      if (car.root.position.x < -130) car.root.position.x = 130;
    }
    car.heading = t.axis === "z" ? (t.dir > 0 ? 0 : Math.PI) : (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.root.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += t.speed * dt * 2;
  }
}

/* --------------------------------------------------------------- interaction */
function updateInteraction() {
  game.nearCar = null;
  game.nearHeist = false;
  game.nearSafe = false;
  if (!game.started || game.paused || game.dead) {
    dom.prompt.classList.remove("show");
    return;
  }

  const heist = HEISTS[game.currentHeist];
  const dHeist = dist2(game.pos.x, game.pos.z, heist.pos.x, heist.pos.z);

  if (game.driving) {
    setPrompt("E", "Exit vehicle", 0);
    return;
  }
  if (game.stage === "approach" && dHeist < 7.2) {
    game.nearHeist = true;
    setPrompt("E", `Start ${heist.venue} heist`, 0);
    return;
  }
  if (game.stage === "loot" && dHeist < 3.8) {
    game.nearSafe = true;
    setPrompt("E", "Hold to crack the safe", game.lootProgress);
    return;
  }
  const car = findNearestCar();
  if (car) {
    game.nearCar = car;
    setPrompt("E", car.isPolice ? "Steal police cruiser" : "Get in vehicle", 0);
    return;
  }
  dom.prompt.classList.remove("show");
  game.lastPrompt = "";
}

function setPrompt(key, text, progress) {
  if (game.lastPrompt !== text) {
    dom.promptKey.textContent = key;
    dom.promptText.textContent = text;
    game.lastPrompt = text;
  }
  dom.prompt.classList.add("show");
  dom.promptProgress.style.width = `${clamp(progress, 0, 1) * 100}%`;
}

function handleInteract() {
  if (!game.started || game.paused || game.dead) return;
  if (game.driving) {
    exitCar(false);
    return;
  }
  const heist = HEISTS[game.currentHeist];
  const dHeist = dist2(game.pos.x, game.pos.z, heist.pos.x, heist.pos.z);
  if (game.stage === "approach" && dHeist < 7.2) {
    startHeist();
    return;
  }
  if (game.stage === "loot" && dHeist < 3.8) return;
  if (game.nearCar) enterCar(game.nearCar);
}

function updateLoot(dt) {
  if (game.stage !== "loot" || game.dead) return;
  const heist = HEISTS[game.currentHeist];
  const d = dist2(game.pos.x, game.pos.z, heist.pos.x, heist.pos.z);
  if (d < 3.8 && keys.e) {
    game.lootProgress += dt / 2.7;
    if (game.lootProgress >= 1) {
      game.lootProgress = 1;
      lootComplete();
    }
  } else {
    game.lootProgress = Math.max(0, game.lootProgress - dt * 0.35);
  }
}

/* ------------------------------------------------------------------- timers */
function updateTimers(dt) {
  if (game.completeTimer > 0) {
    game.completeTimer -= dt;
    if (game.completeTimer <= 0) nextHeist();
  }
  if (game.dead) {
    game.respawnTimer -= dt;
    if (game.respawnTimer <= 0) respawn();
    return;
  }
  if (game.paused) return;

  if (game.stage === "escape") {
    const near = nearestCopDistance();
    if (!isFinite(near) || near > 26) {
      game.escapeTimer -= dt;
    } else {
      game.escapeTimer = Math.min(16, game.escapeTimer + dt * 0.2);
    }
    if (game.escapeTimer <= 0) completeHeist();
  } else if (game.wanted > 0) {
    const near = nearestCopDistance();
    if (!isFinite(near) || near > 24) game.freeHeatTimer -= dt;
    else game.freeHeatTimer = Math.min(12, game.freeHeatTimer + dt * 0.4);
    if (game.freeHeatTimer <= 0) setWanted(0);
  }

  if (game.lastDamage + 6 < game.time && game.health > 0 && game.health < 100) {
    game.health = Math.min(100, game.health + 2.2 * dt);
    updateVitals();
  }
  if (game.fireCooldown > 0) game.fireCooldown -= dt;
  if (!game.firing && game.aimTimer <= 0.2) game.aimTimer = Math.max(0, game.aimTimer - dt);
  game.firing = false;
  updateReload(dt);
}

/* ---------------------------------------------------------------------- HUD */
function money(n) {
  return `$${Math.max(0, Math.round(n)).toLocaleString("en-US")}`;
}

function updateVitals() {
  dom.health.style.width = `${clamp(game.health, 0, 100)}%`;
  dom.armor.style.width = `${clamp(game.armor, 0, 100)}%`;
  dom.cash.textContent = money(game.money);
}

function updateWantedUI() {
  dom.wantedStars.forEach((s, i) => {
    s.classList.toggle("on", i < game.wanted);
    s.classList.toggle("flash", i < game.wanted && game.wanted > 0);
  });
}

function updateMissionUI(force = false) {
  const heist = HEISTS[game.currentHeist];
  if (!heist) return;
  dom.missionCount.textContent = `JOB 0${game.currentHeist + 1} / 03`;
  dom.missionTitle.textContent = heist.title;
  dom.missionPayout.textContent = `PAYOUT ${money(heist.reward)}`;
  let objective = heist.objective;
  if (game.stage === "approach") {
    const d = dist2(game.pos.x, game.pos.z, heist.pos.x, heist.pos.z);
    objective = d < 7.2 ? heist.approach : heist.drive;
  } else if (game.stage === "combat") {
    const alive = guards.filter((g) => g.alive).length;
    objective = alive > 0 ? `Eliminate the guards — ${alive} left` : "Move to the safe";
  } else if (game.stage === "loot") {
    objective = "Crack the safe — hold E";
  } else if (game.stage === "escape") {
    objective = "Lose the police";
  } else if (game.stage === "complete") {
    objective = "Score secured";
  }
  dom.missionObjective.textContent = objective;
  if (game.stage === "escape") {
    dom.missionDistance.textContent = "HEAT";
  } else if (game.stage === "complete") {
    dom.missionDistance.textContent = "DONE";
  } else {
    const d = dist2(game.pos.x, game.pos.z, heist.pos.x, heist.pos.z);
    dom.missionDistance.textContent = `${Math.round(d)} M`;
  }
}

function updateLocationUI() {
  let district = "SUNSET BAY";
  if (game.pos.x < -84) district = "OCEAN DRIVE";
  else if (game.pos.z < -44) district = "GOLD COAST";
  else if (game.pos.x > 44) district = "NEON MILE";
  else if (game.pos.z > 44) district = "PALM HEIGHTS";
  else district = "DOWNTOWN";

  if (game.stage === "escape") district = "WANTED";
  const clock = "19:42";
  dom.district.textContent = `${district} • ${clock}`;
  dom.mapLabel.textContent = district;

  let street = "OCEAN DRIVE";
  let best = Infinity;
  const namesX = { "-90": "OCEAN DRIVE", "-45": "PALM AVENUE", "0": "SUNSET BLVD", "45": "NEON BOULEVARD", "90": "GOLD COAST DR" };
  const namesZ = { "-90": "1ST STREET", "-45": "2ND STREET", "0": "3RD STREET", "45": "4TH STREET", "90": "5TH STREET" };
  for (const x of CITY.roadsX) {
    const d = Math.abs(game.pos.x - x);
    if (d < best) { best = d; street = namesX[String(x)]; }
  }
  for (const z of CITY.roadsZ) {
    const d = Math.abs(game.pos.z - z);
    if (d < best) { best = d; street = namesZ[String(z)]; }
  }
  dom.streetName.textContent = street;
}

function updateHeatUI() {
  if (game.stage === "escape" && !game.dead) {
    dom.heatBanner.classList.add("show");
    const s = Math.max(0, Math.ceil(game.escapeTimer));
    dom.heatTime.textContent = `0:${String(s).padStart(2, "0")}`;
  } else {
    dom.heatBanner.classList.remove("show");
  }
}

function updateHud() {
  updateVitals();
  updateWantedUI();
  updateMissionUI();
  updateLocationUI();
  updateHeatUI();
  updateAmmo();
}

function showToast(text, duration = 2.2) {
  dom.toastText.textContent = text;
  dom.toast.classList.add("show");
  game.toastTimer = duration;
}

/* ------------------------------------------------------------------ minimap */
const mapCtx = dom.minimap.getContext("2d");
let mapTimer = 0;

function worldToMap(x, z) {
  return [
    ((x + MAP_RANGE / 2) / MAP_RANGE) * MAP_SIZE,
    ((z + MAP_RANGE / 2) / MAP_RANGE) * MAP_SIZE,
  ];
}

function drawMinimap() {
  const g = mapCtx;
  g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
  g.drawImage(mapBase, 0, 0);

  // Heist locations.
  HEISTS.forEach((h, i) => {
    const [x, y] = worldToMap(h.pos.x, h.pos.z);
    const active = i === game.currentHeist && game.stage !== "complete";
    const done = i < game.currentHeist || game.stage === "complete" && i <= game.currentHeist;
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillStyle = done ? "rgba(150,255,120,0.55)" : active ? "#ffd35a" : "rgba(255,211,90,0.3)";
    g.shadowColor = active ? "#ffd35a" : "transparent";
    g.shadowBlur = active ? 14 : 0;
    const s = active ? 9 + Math.sin(game.time * 4) * 2 : 6;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.restore();
  });

  // Police.
  for (const p of policeCars) {
    const [x, y] = worldToMap(p.root.position.x, p.root.position.z);
    g.beginPath();
    g.arc(x, y, 5, 0, TAU);
    g.fillStyle = Math.floor(game.time * 8) % 2 ? "#ff305b" : "#4b84ff";
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 9;
    g.fill();
    g.shadowBlur = 0;
  }

  // Player.
  const [px, py] = worldToMap(game.pos.x, game.pos.z);
  const angle = Math.atan2(Math.sin(game.heading), -Math.cos(game.heading));
  g.save();
  g.translate(px, py);
  g.rotate(angle);
  g.shadowColor = "#ffb45b";
  g.shadowBlur = 12;
  g.beginPath();
  g.moveTo(0, -11);
  g.lineTo(7.5, 8);
  g.lineTo(0, 4.5);
  g.lineTo(-7.5, 8);
  g.closePath();
  g.fillStyle = game.driving ? "#ff8a3d" : "#fff1dd";
  g.fill();
  g.strokeStyle = "rgba(10,10,20,0.75)";
  g.lineWidth = 2;
  g.stroke();
  g.restore();

  // Radar sweep.
  g.save();
  g.translate(px, py);
  g.rotate(game.time * 0.55);
  const grad = g.createLinearGradient(0, 0, 75, 0);
  grad.addColorStop(0, "rgba(255,166,90,0.18)");
  grad.addColorStop(1, "rgba(255,166,90,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, 75, -0.35, 0.35);
  g.closePath();
  g.fill();
  g.restore();
}

/* -------------------------------------------------------------------- input */
let pointerLocked = false;
let dragging = false;
let lastPointer = { x: 0, y: 0 };
let joystickPointer = null;
let lookPointer = null;

function initInput() {
  const keyMap = {
    KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    ShiftLeft: "shift", ShiftRight: "shift", Space: "space",
    KeyE: "e", KeyF: "f", KeyR: "r",
  };

  addEventListener("keydown", (e) => {
    if (keyMap[e.code]) {
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!keys[keyMap[e.code]]) {
        keys[keyMap[e.code]] = true;
        if (e.code === "KeyE") handleInteract();
        if (e.code === "KeyF") attemptFire();
        if (e.code === "KeyR") startReload();
      }
    }
    if (!game.started && (e.code === "Enter" || e.code === "Space")) {
      e.preventDefault();
      startGame();
    }
    if (e.code === "Escape" && document.pointerLockElement) document.exitPointerLock();
  });

  addEventListener("keyup", (e) => {
    if (keyMap[e.code]) keys[keyMap[e.code]] = false;
  });

  addEventListener("blur", () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    dragging = false;
  });

  dom.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  dom.canvas.addEventListener("pointerdown", (e) => {
    if (!game.started) return;
    if (e.pointerType === "mouse") {
      dragging = true;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      if (document.pointerLockElement !== dom.canvas) {
        dom.canvas.requestPointerLock?.();
      }
      if (e.button === 0) attemptFire();
    }
  });

  addEventListener("pointerup", () => {
    dragging = false;
  });

  addEventListener("pointermove", (e) => {
    if (!game.started || e.pointerType !== "mouse") return;
    if (document.pointerLockElement === dom.canvas) {
      cam.yaw -= e.movementX * 0.0024;
      if (game.driving) cam.driveLook -= e.movementX * 0.0022;
      else cam.pitch = clamp(cam.pitch + e.movementY * 0.0022, -0.08, 0.72);
    } else if (dragging) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      cam.yaw -= dx * 0.005;
      if (game.driving) cam.driveLook -= dx * 0.005;
      else cam.pitch = clamp(cam.pitch + dy * 0.004, -0.08, 0.72);
    }
  });

  dom.canvas.addEventListener("wheel", (e) => {
    if (!game.started) return;
    e.preventDefault();
    if (!game.driving) cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 0.55, 3.8, 9.5);
  }, { passive: false });

  // Mouse look uses pointer lock; this small prompt is intentionally absent so
  // first-time players are not pulled out of the world.
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === dom.canvas;
  });

  // Touch joystick.
  dom.joystickZone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    joystickPointer = e.pointerId;
    updateJoystick(e);
    dom.joystickZone.setPointerCapture(e.pointerId);
  });
  dom.joystickZone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joystickPointer) return;
    e.preventDefault();
    updateJoystick(e);
  });
  const endJoystick = (e) => {
    if (e.pointerId !== joystickPointer) return;
    joystickPointer = null;
    game.touchMove.x = 0;
    game.touchMove.y = 0;
    dom.joystickKnob.style.transform = "translate(0px, 0px)";
  };
  dom.joystickZone.addEventListener("pointerup", endJoystick);
  dom.joystickZone.addEventListener("pointercancel", endJoystick);

  // Touch look.
  dom.touchLook.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    lookPointer = e.pointerId;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    dom.touchLook.setPointerCapture(e.pointerId);
  });
  dom.touchLook.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookPointer) return;
    e.preventDefault();
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    cam.yaw -= dx * 0.006;
    if (game.driving) cam.driveLook -= dx * 0.006;
    else cam.pitch = clamp(cam.pitch + dy * 0.0045, -0.08, 0.72);
  });
  const endLook = (e) => {
    if (e.pointerId !== lookPointer) return;
    lookPointer = null;
  };
  dom.touchLook.addEventListener("pointerup", endLook);
  dom.touchLook.addEventListener("pointercancel", endLook);

  dom.btnFire.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.touchFire = true;
    attemptFire();
  });
  const stopFire = (e) => {
    e.preventDefault();
    game.touchFire = false;
  };
  dom.btnFire.addEventListener("pointerup", stopFire);
  dom.btnFire.addEventListener("pointercancel", stopFire);
  dom.btnFire.addEventListener("pointerleave", stopFire);

  dom.btnAction.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    keys.e = true;
    handleInteract();
  });
  dom.btnAction.addEventListener("pointerup", (e) => {
    e.preventDefault();
    keys.e = false;
  });
  dom.btnAction.addEventListener("pointercancel", () => { keys.e = false; });

  dom.btnJump.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    keys.space = true;
    setTimeout(() => { keys.space = false; }, 130);
  });

  dom.btnRun.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.touchSprint = !game.touchSprint;
    dom.btnRun.classList.toggle("active", game.touchSprint);
    dom.btnRun.textContent = game.touchSprint ? "RUN" : "WALK";
  });

  dom.startBtn.addEventListener("click", startGame);
  dom.restartBtn.addEventListener("click", () => location.reload());
}

function updateJoystick(e) {
  const rect = dom.joystickZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width * 0.34;
  const mag = Math.hypot(dx, dy);
  if (mag > max) {
    dx = (dx / mag) * max;
    dy = (dy / mag) * max;
  }
  dom.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  game.touchMove.x = clamp(dx / max, -1, 1);
  game.touchMove.y = clamp(-dy / max, -1, 1);
}

/* --------------------------------------------------------------------- loop */
let lastHud = 0;
let firstFrame = true;

function cinematicCamera() {
  const t = game.time;
  camera.position.set(-112 + Math.sin(t * 0.035) * 3.2, 15.5 + Math.cos(t * 0.045) * 1.2, 96);
  camera.lookAt(28, 10, -22);
  camera.fov = 62;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.time += dt;
  timeUniform.value = game.time;

  // World life continues even while the briefing is open.
  updateTraffic(dt);
  updatePedestrians(dt);
  updateEffects(dt);
  updateMarkers(dt);
  updateTimers(dt);

  if (!game.started) {
    cinematicCamera();
    animateHumanoid(player, 0, dt);
    player.shadow.position.set(game.pos.x, 0.035, game.pos.z);
  } else {
    if (!game.paused && !game.dead) {
      updatePlayer(dt);
      updateGuards(dt);
      updatePolice(dt);
      updateInteraction();
      updateLoot(dt);
      if (game.touchFire && game.fireCooldown <= 0) attemptFire();
    } else {
      updateInteraction();
    }
    updateCamera(dt);
  }

  // Neon flicker.
  for (const f of neonFlickers) {
    const flick = 0.78 + Math.sin(game.time * 7.4 + f.phase) * 0.06;
    const glitch = Math.sin(game.time * 2.1 + f.phase * 3) > 0.985 ? 0.2 : 1;
    f.mesh.material.opacity = flick * glitch;
  }

  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) dom.toast.classList.remove("show");
  }

  if (game.started) {
    if (game.time - lastHud > 0.1) {
      lastHud = game.time;
      updateHud();
    }
    mapTimer += dt;
    if (mapTimer > 0.06) {
      mapTimer = 0;
      drawMinimap();
    }
  }

  if (game.driving) {
    audio.siren(game.wanted > 0);
  }

  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    dom.loading.classList.add("is-gone");
    setTimeout(() => { dom.loading.style.display = "none"; }, 700);
    window.__SUNSET__.ready = true;
  }
}

/* --------------------------------------------------------------------- boot */
function startGame() {
  if (game.started) return;
  game.started = true;
  game.paused = false;
  audio.init();
  dom.start.classList.add("is-gone");
  dom.hud.classList.remove("is-hidden");
  dom.touch.classList.remove("is-hidden");
  dom.loading.classList.add("is-gone");
  cam.initialised = false;
  cam.yaw = game.heading + Math.PI;
  cam.pitch = 0.12;
  cam.dist = 7.0;
  cam.driveLook = 0;
  showMarker(0);
  updateMissionUI(true);
  updateHud();
  drawMinimap();
  const startDist = Math.round(dist2(game.pos.x, game.pos.z, HEISTS[0].pos.x, HEISTS[0].pos.z));
  showToast(`MEET THE MARKER — ${startDist} M`, 2.8);
  setTimeout(() => {
    if (!game.dead && game.stage === "approach") showToast("STEAL A RIDE OR GO ON FOOT", 2.4);
  }, 3300);
}

function init() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
  renderer.compile(scene, camera);
  dom.touch.classList.add("is-hidden");
  initInput();
  updateVitals();
  updateWantedUI();
  updateMissionUI(true);
  updateAmmo();
  showMarker(0);
  drawMinimap();

  window.__SUNSET__.state = game;
  window.__SUNSET__.start = startGame;
  window.__SUNSET__.heists = HEISTS;
  window.__SUNSET__.markers = heistMarkers;
  window.__SUNSET__.guards = guards;
  window.__SUNSET__.police = policeCars;
  window.__SUNSET__.cam = cam;
  window.__SUNSET__.camera = camera;
  window.__SUNSET__.THREE = THREE;
  window.__SUNSET__.keys = keys;
  window.__SUNSET__.colliders = colliders;
  window.__SUNSET__.teleport = (x, z) => {
    game.pos.set(x, 0.09, z);
    game.y = 0.09;
    player.root.position.set(x, 0.09, z);
    cam.initialised = false;
    updateMissionUI(true);
    drawMinimap();
  };
  window.__SUNSET__.spawnPolice = () => setWanted(3);

  addEventListener("resize", () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  animate();
}

init();
