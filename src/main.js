import * as THREE from 'three';
import { VEHICLES, Vehicle } from './car.js';
import { ColliderWorld } from './physics.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8bdca);
scene.fog = new THREE.Fog(0xa8bdca, 100, 430);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);
const clock = new THREE.Clock();
const hemi = new THREE.HemisphereLight(0xdbeeff, 0x56514a, 2.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b8, 3.1);
sun.position.set(-48, 80, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.00025;
scene.add(sun);

const ground = {
  height: () => 0,
  gripAt: (x, z) => (Math.abs(x) > 30 || z < -90 || z > 190 ? 0.76 : 1),
  normal: (x, z, out) => { out.x = 0; out.y = 1; out.z = 0; return out; },
};
const colliders = new ColliderWorld(ground);
const worldMeshes = [];
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const asphalt = mat(0x343b3e, 0.94);
const concrete = mat(0x777d7c, 0.9);
const paint = mat(0xd7d3c8, 0.72);
const amber = mat(0xffb33e, 0.58, 0.12);
const darkMetal = mat(0x252b2e, 0.65, 0.35);

function addMesh(geometry, material, position, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.yaw) mesh.rotation.y = options.yaw;
  scene.add(mesh);
  worldMeshes.push(mesh);
  return mesh;
}
function addBox(x, y, z, hx, hy, hz, color, yaw = 0, name = 'solid', soft = 0) {
  colliders.addBox(x, y, z, hx, hy, hz, yaw, { name, soft, mu: 0.62 });
  return addMesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat(color, 0.83), [x, y, z], { yaw });
}

// A wide proving ground with a marked central crash lane.
addMesh(new THREE.PlaneGeometry(700, 700), mat(0x667467, 1), [0, -0.09, 35], { receiveShadow: true }).rotation.x = -Math.PI / 2;
addMesh(new THREE.PlaneGeometry(34, 330), asphalt, [0, -0.035, 45], { receiveShadow: true }).rotation.x = -Math.PI / 2;
// Lane center dashes and edge lines.
for (let z = -105; z < 198; z += 13) {
  addMesh(new THREE.BoxGeometry(0.18, 0.025, 6), paint, [0, 0.005, z], { castShadow: false });
}
for (const x of [-16.2, 16.2]) {
  addMesh(new THREE.BoxGeometry(0.16, 0.025, 324), paint, [x, 0.005, 43], { castShadow: false });
}
// Crash test wall: collidable, visually striped concrete.
addBox(0, 1.45, 118, 9.5, 1.45, 0.9, 0xb9b8ad, 0, 'crash wall');
for (let x = -8.5; x <= 8.5; x += 2.2) {
  const stripe = addMesh(new THREE.BoxGeometry(0.42, 2.1, 0.035), x % 4.4 < 0.1 ? amber : mat(0x353a3b, 0.85), [x, 1.48, 117.06]);
  stripe.castShadow = false;
}
// Ramps and impact targets.
const rampData = [
  { x: -9, z: 42, w: 7, l: 15, h: 2.7, yaw: 0 },
  { x: 9, z: 77, w: 7, l: 13, h: 2.2, yaw: 0 },
];
for (const r of rampData) {
  colliders.addRamp(r.x, r.z, r.w, r.l, r.h, r.yaw, { mu: 0.8 });
  const geo = new THREE.BufferGeometry();
  const hw = r.w / 2, hl = r.l / 2;
  const verts = new Float32Array([-hw, 0, -hl, hw, 0, -hl, -hw, r.h, hl, hw, r.h, hl, -hw, 0, -hl, -hw, r.h, hl, hw, 0, -hl, hw, r.h, hl]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex([0, 2, 1, 1, 2, 3, 4, 5, 6, 6, 5, 7]); geo.computeVertexNormals();
  addMesh(geo, mat(0x555b5b, 0.9), [r.x, 0.02, r.z], { yaw: r.yaw });
  for (let side of [-1, 1]) addBox(r.x + side * (hw + 0.18), 0.42, r.z, 0.12, 0.42, hl, 0xffb33e, r.yaw, 'ramp rail', 0);
}
// Jersey barriers, poles, cones, and test fixtures along the shoulders.
for (const side of [-1, 1]) {
  for (let z = -70; z < 112; z += 22) {
    addBox(side * 20.5, 0.55, z, 0.55, 0.55, 4.8, z % 44 === 0 ? 0xc47a38 : 0x9a9d96, 0, 'barrier');
  }
  for (let z = -55; z < 115; z += 34) {
    colliders.addCylinder(side * 27, z, 0.16, 0, 5, { name: 'light pole' });
    const pole = addMesh(new THREE.CylinderGeometry(0.09, 0.14, 5, 8), darkMetal, [side * 27, 2.5, z]);
    addMesh(new THREE.BoxGeometry(1.3, 0.13, 0.3), mat(0x596165, 0.55, 0.25), [side * 27 + (side < 0 ? 0.45 : -0.45), 4.85, z]);
    void pole;
  }
}
// Distant low industrial blocks form a readable horizon without external assets.
let seed = 92471;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (let i = 0; i < 80; i++) {
  const side = i % 2 ? 1 : -1;
  const x = side * (48 + rand() * 105), z = -90 + rand() * 290;
  const w = 8 + rand() * 22, h = 5 + rand() * 21, d = 8 + rand() * 25;
  const building = addMesh(new THREE.BoxGeometry(w, h, d), mat([0x68747a, 0x77817e, 0x8c9189][i % 3], 0.95), [x, h / 2 - 0.04, z]);
  building.castShadow = false;
}

let vehicleIndex = 0;
let vehicle = new Vehicle(VEHICLES[vehicleIndex]);
vehicle.setColliders(colliders);
vehicle.place(0, 0, 0, ground.height);
// Dynamic soft-body vehicle mesh. Each triangle follows the XPBD chassis nodes.
let carRoot = null, shell = null, wheels = [], trim = [];
const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.23, 18, 1);
wheelGeo.rotateZ(Math.PI / 2);
const tireMat = mat(0x17191a, 0.9), rimMat = mat(0xaeb5b6, 0.35, 0.72);
const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.245, 12);
hubGeo.rotateZ(Math.PI / 2);
function buildCar() {
  if (carRoot) scene.remove(carRoot);
  carRoot = new THREE.Group();
  const rows = vehicle.grid.length, cols = vehicle.grid[0].length;
  const positions = new Float32Array(rows * cols * 3);
  const indices = [];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = i * cols + (j + 1) % cols;
    const c = (i + 1) * cols + j, d = (i + 1) * cols + (j + 1) % cols;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(indices);
  const bodyMat = new THREE.MeshStandardMaterial({ color: vehicle.spec.color, roughness: 0.34, metalness: 0.28, side: THREE.DoubleSide });
  shell = new THREE.Mesh(geo, bodyMat);
  shell.castShadow = true; shell.receiveShadow = true;
  carRoot.add(shell);
  wheels = [];
  for (const w of vehicle.wheels) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    const hub = new THREE.Mesh(hubGeo, rimMat);
    tire.castShadow = hub.castShadow = true;
    carRoot.add(tire, hub);
    wheels.push({ tire, hub, data: w });
  }
  // Simple recognizable front fascia details.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.06), darkMetal);
  grille.position.set(0, 0.53, vehicle.spec.shape.half + 0.015);
  carRoot.add(grille);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0ce, emissive: 0x332711, roughness: 0.25 });
  for (const x of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.045), lampMat);
    lamp.position.set(x, 0.78, vehicle.spec.shape.half + 0.02); carRoot.add(lamp);
  }
  scene.add(carRoot);
  updateCarMesh();
}
function updateCarMesh() {
  if (!shell) return;
  const attr = shell.geometry.attributes.position;
  const nodes = vehicle.body.nodes;
  for (let i = 0; i < vehicle.grid.length; i++) for (let j = 0; j < vehicle.grid[i].length; j++) {
    const node = nodes[vehicle.grid[i][j]], k = (i * vehicle.grid[i].length + j) * 3;
    attr.array[k] = node.x; attr.array[k + 1] = node.y; attr.array[k + 2] = node.z;
  }
  attr.needsUpdate = true;
  shell.geometry.computeVertexNormals();
  for (const item of wheels) {
    const w = item.data;
    item.tire.position.set(w.hubX, w.hubY, w.hubZ);
    item.hub.position.copy(item.tire.position);
    const yaw = w.steer ? w.steerAngle : 0;
    item.tire.rotation.set(0, yaw, w.spin);
    item.hub.rotation.set(0, yaw, 0);
  }
}

// Input, camera and game state.
const keys = new Set();
const touch = { left: false, right: false, gas: false, brake: false };
let slowmo = false, hudVisible = true, garageOpen = false, cameraMode = 0;
let topSpeed = 0, bestAccel = null, accelStart = null, jumpBest = 0, lastAir = 0;
let toastTimer = 0, impactFlash = 0, cameraYaw = 0, cameraPitch = 0.2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function showToast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); toastTimer = 2.2; }
function setVehicle(index) {
  vehicleIndex = (index + VEHICLES.length) % VEHICLES.length;
  vehicle = new Vehicle(VEHICLES[vehicleIndex]); vehicle.setColliders(colliders);
  vehicle.place(0, 0, 0, ground.height); buildCar();
  topSpeed = 0; bestAccel = null; accelStart = null; jumpBest = 0;
  $('vehName').textContent = vehicle.spec.name;
  $('vehSub').textContent = vehicle.spec.sub;
  $('massRead').textContent = `${vehicle.spec.mass.toLocaleString()} kg`;
  $('powerRead').textContent = `${vehicle.spec.power} hp`;
  showToast(`${vehicle.spec.name} ready`);
}
buildCar();

// Garage cards are generated directly from the original vehicle specs.
const garageGrid = $('garageGrid');
VEHICLES.forEach((v, i) => {
  const card = document.createElement('button'); card.className = 'garage-card';
  card.innerHTML = `<span class="garage-swatch" style="background:#${v.color.toString(16).padStart(6, '0')}"></span><b>${v.name}</b><small>${v.sub}</small>`;
  card.addEventListener('click', () => { setVehicle(i); garageOpen = false; $('garage').classList.remove('open'); });
  garageGrid.append(card);
});
function toggleGarage() { garageOpen = !garageOpen; $('garage').classList.toggle('open', garageOpen); }
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
  keys.add(key);
  if (e.repeat) return;
  if (key === 'r') { vehicle.repair(); showToast('Vehicle reset'); }
  if (key === 't') { slowmo = !slowmo; document.body.classList.toggle('slowmo', slowmo); $('slowmoTag').classList.toggle('show', slowmo); }
  if (key === 'c') { cameraMode = (cameraMode + 1) % 3; showToast(['CHASE CAM', 'CLOSE CAM', 'HOOD CAM'][cameraMode]); }
  if (key === 'h') { hudVisible = !hudVisible; $('hud').classList.toggle('hidden', !hudVisible); }
  if (key === 'v') toggleGarage();
  if (key === 'escape' && garageOpen) toggleGarage();
  if (key >= '1' && key <= String(VEHICLES.length)) { setVehicle(Number(key) - 1); }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
for (const button of document.querySelectorAll('[data-touch]')) {
  const name = button.dataset.touch;
  const down = (e) => { e.preventDefault(); touch[name] = true; button.classList.add('pressed'); };
  const up = (e) => { e.preventDefault(); touch[name] = false; button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
}

// Lightweight synthesized engine sound; audio only starts after a user gesture.
let audioCtx = null, engineOsc = null, engineGain = null;
function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  engineOsc = audioCtx.createOscillator(); engineOsc.type = 'sawtooth';
  const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520;
  engineGain = audioCtx.createGain(); engineGain.gain.value = 0.0001;
  engineOsc.connect(filter).connect(engineGain).connect(audioCtx.destination); engineOsc.start();
  $('audioGate').classList.add('gone');
}
$('audioGate').addEventListener('pointerdown', startAudio);

// HUD graphics.
const tachTicks = $('tachTicks');
for (let i = 0; i <= 8; i++) {
  const angle = (-120 + i * 30) * Math.PI / 180;
  const x1 = 100 + Math.cos(angle) * 72, y1 = 100 + Math.sin(angle) * 72;
  const x2 = 100 + Math.cos(angle) * 82, y2 = 100 + Math.sin(angle) * 82;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2); line.setAttribute('class', 'tach-tick'); tachTicks.append(line);
}
const gctx = $('gcanvas').getContext('2d');
function drawG() {
  const c = $('gcanvas'), w = c.width, h = c.height, cx = w / 2, cy = h / 2;
  gctx.clearRect(0, 0, w, h); gctx.strokeStyle = 'rgba(255,255,255,.25)'; gctx.lineWidth = 1;
  for (const r of [25, 50, 72]) { gctx.beginPath(); gctx.arc(cx, cy, r, 0, Math.PI * 2); gctx.stroke(); }
  gctx.beginPath(); gctx.moveTo(cx - 76, cy); gctx.lineTo(cx + 76, cy); gctx.moveTo(cx, cy - 76); gctx.lineTo(cx, cy + 76); gctx.stroke();
  const gx = clamp(vehicle.gforce.x, -2.5, 2.5), gy = clamp(vehicle.gforce.z, -2.5, 2.5);
  gctx.fillStyle = '#ffb340'; gctx.beginPath(); gctx.arc(cx + gx * 27, cy - gy * 27, 6, 0, Math.PI * 2); gctx.fill();
}

// Fixed-step simulation keeps suspension, tire forces, and collisions stable across frame rates.
const FIXED_H = vehicle.solver.h;
let accumulator = 0, elapsed = 0, bootTimer = 0;
let cameraReady = false;
const cameraTarget = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const lookDesired = new THREE.Vector3();
const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
const minimap = $('minimap');
const mmctx = minimap.getContext('2d');
const mph = (mps) => Math.round(Math.abs(mps) * 3.6);

function readInput() {
  const steer = (keys.has('a') || keys.has('arrowleft') || touch.left ? -1 : 0)
    + (keys.has('d') || keys.has('arrowright') || touch.right ? 1 : 0);
  return {
    steer: clamp(steer, -1, 1),
    throttle: keys.has('w') || keys.has('arrowup') || touch.gas ? 1 : 0,
    brake: keys.has('s') || keys.has('arrowdown') || touch.brake ? 1 : 0,
    handbrake: keys.has(' '),
  };
}

function drawMinimap() {
  const w = minimap.width, h = minimap.height;
  mmctx.clearRect(0, 0, w, h);
  mmctx.fillStyle = '#151a1d'; mmctx.fillRect(0, 0, w, h);
  const scale = 0.56, cx = w / 2, cy = h * 0.72;
  const mapPoint = (x, z) => [cx + x * scale, cy - (z - vehicle.body.center().z) * scale];
  mmctx.fillStyle = '#343b3e'; mmctx.fillRect(cx - 17 * scale, 0, 34 * scale, h);
  mmctx.strokeStyle = 'rgba(230,225,205,.65)'; mmctx.lineWidth = 1;
  mmctx.setLineDash([6, 7]); mmctx.beginPath(); mmctx.moveTo(cx, 0); mmctx.lineTo(cx, h); mmctx.stroke(); mmctx.setLineDash([]);
  const wall = mapPoint(0, 118);
  mmctx.fillStyle = '#d2d0c3'; mmctx.fillRect(wall[0] - 8, wall[1] - 2, 16, 4);
  for (const z of [42, 77]) {
    const ramp = mapPoint(z === 42 ? -9 : 9, z);
    mmctx.fillStyle = '#ffb340'; mmctx.fillRect(ramp[0] - 3, ramp[1] - 4, 6, 8);
  }
  const center = vehicle.body.center();
  const [px, py] = mapPoint(center.x, center.z);
  const f = vehicle.frame.fwd;
  mmctx.save(); mmctx.translate(px, py); mmctx.rotate(Math.atan2(f.x, -f.z));
  mmctx.fillStyle = '#ffb340'; mmctx.beginPath(); mmctx.moveTo(0, -7); mmctx.lineTo(5, 5); mmctx.lineTo(0, 3); mmctx.lineTo(-5, 5); mmctx.closePath(); mmctx.fill();
  mmctx.restore();
}

function updateHud(dt) {
  const speed = vehicle.speedKph;
  $('speedVal').textContent = String(Math.round(speed));
  $('rpmVal').textContent = String(Math.round(vehicle.engine.rpm / 100) * 100);
  $('gearVal').textContent = vehicle.engine.gear < 0 ? 'R' : String(vehicle.engine.gear);
  const rpmFraction = clamp(vehicle.engine.rpm / vehicle.spec.redline, 0, 1);
  $('needle').setAttribute('transform', `rotate(${-120 + rpmFraction * 240} 100 100)`);
  $('tachFill').style.strokeDasharray = `${rpmFraction * 258} 258`;
  $('vehDmg').textContent = `${Math.round(vehicle.damage.overall * 100)}%`;
  $('engineState').textContent = vehicle.engine.running ? (vehicle.damage.engine > 0.55 ? 'DAMAGED' : 'RUNNING') : 'STOPPED';
  $('engineState').classList.toggle('damaged', !vehicle.engine.running || vehicle.damage.engine > 0.55);
  for (const part of ['body', 'engine', 'wheels', 'chassis']) {
    const value = clamp(vehicle.damage[part] || 0, 0, 1);
    const bar = document.querySelector(`[data-part="${part}"]`);
    const label = document.querySelector(`[data-val="${part}"]`);
    bar.style.width = `${value * 100}%`;
    bar.classList.toggle('critical', value > 0.65);
    label.textContent = String(Math.round(value * 100));
  }
  topSpeed = Math.max(topSpeed, speed);
  $('recSpeed').textContent = String(Math.round(topSpeed));
  $('recAccel').textContent = bestAccel === null ? '—' : bestAccel.toFixed(2);
  $('recJump').textContent = jumpBest.toFixed(1);
  $('recCrash').textContent = Math.round(vehicle.crashScore).toLocaleString();
  $('gPeak').textContent = Math.max(1, vehicle.gforce.peak).toFixed(1);
  const moving = speed > 1.5;
  if (moving && accelStart === null && readInput().throttle) accelStart = elapsed;
  if (speed >= 100 && accelStart !== null) {
    const result = elapsed - accelStart;
    bestAccel = bestAccel === null ? result : Math.min(bestAccel, result);
    accelStart = null;
  }
  if (speed < 3 && !readInput().throttle) accelStart = null;

  const speedlines = $('speedlines');
  speedlines.style.opacity = String(clamp((speed - 105) / 105, 0, 0.55));
  drawG();
  drawMinimap();
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  if (impactFlash > 0) {
    impactFlash = Math.max(0, impactFlash - dt * 2.8);
    $('impactFlash').style.opacity = String(impactFlash);
  }
}

function updateCamera(dt) {
  vehicle.computeFrame();
  const center = vehicle.body.center();
  const f = vehicle.frame.fwd, up = vehicle.frame.up;
  let distance = cameraMode === 1 ? 7.0 : 11.5;
  let height = cameraMode === 1 ? 3.2 : 5.2;
  if (cameraMode === 2) { distance = 0.15; height = 1.42; }
  cameraDesired.set(center.x - f.x * distance + up.x * height, center.y - f.y * distance + up.y * height, center.z - f.z * distance + up.z * height);
  lookDesired.set(center.x + f.x * (cameraMode === 2 ? 10 : 4), center.y + 0.75 + f.y * 4, center.z + f.z * (cameraMode === 2 ? 10 : 4));
  if (!cameraReady) { cameraTarget.copy(cameraDesired); cameraLook.copy(lookDesired); cameraReady = true; }
  const blend = 1 - Math.exp(-dt * (cameraMode === 2 ? 8 : 3.6));
  cameraTarget.lerp(cameraDesired, blend);
  cameraLook.lerp(lookDesired, blend);
  camera.position.copy(cameraTarget);
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraLook);
}

function processEvents() {
  while (vehicle.events.length) {
    const event = vehicle.events.shift();
    if (event.type !== 'impact') continue;
    const strength = clamp((event.speed - 3) / 22, 0, 1);
    impactFlash = Math.max(impactFlash, strength * 0.72);
    if (event.speed > 7) showToast(`IMPACT · ${Math.round(event.speed * 3.6)} KM/H`);
  }
  const airborne = vehicle.grounded <= 1;
  if (airborne) {
    if (!lastAir) { lastAir = 1; vehicle.lap.airY = vehicle.body.center().y; vehicle.lap.jumpStartX = vehicle.body.center().x; vehicle.lap.jumpStartZ = vehicle.body.center().z; }
  } else if (lastAir) {
    const center = vehicle.body.center();
    const distance = Math.hypot(center.x - vehicle.lap.jumpStartX, center.z - vehicle.lap.jumpStartZ);
    if (vehicle.airTime > 0.22) jumpBest = Math.max(jumpBest, distance);
    lastAir = 0;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  accumulator = Math.min(accumulator + dt * (slowmo ? 0.3 : 1), FIXED_H * 12);
  const input = readInput();
  let steps = 0;
  while (accumulator >= FIXED_H && steps < 12) {
    vehicle.applyControls(FIXED_H, input);
    vehicle.solver.step();
    vehicle.post(FIXED_H);
    accumulator -= FIXED_H;
    steps++;
  }
  processEvents();
  updateCarMesh();
  updateCamera(dt);
  updateHud(dt);
  if (audioCtx && engineOsc) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const rpm = vehicle.engine.rpm;
    engineOsc.frequency.setTargetAtTime(28 + rpm / 24, audioCtx.currentTime, 0.06);
    engineGain.gain.setTargetAtTime(vehicle.engine.running ? 0.018 + vehicle.engine.throttle * 0.026 : 0.0001, audioCtx.currentTime, 0.08);
  }
  renderer.render(scene, camera);
  bootTimer += dt;
  if (bootTimer > 0.7) $('boot').classList.add('gone');
}

window.addEventListener('resize', () => {
  const width = window.innerWidth, height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
});
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === ' ') startAudio(); }, { once: true });
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
drawG();
frame();

