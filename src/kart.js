import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { radialGlowTexture } from './utils.js';

const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.34, 12);
wheelGeo.rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.37, 10);
hubGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x181226, roughness: 0.9, metalness: 0.1 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.55, metalness: 0.35 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xb9b6d7, roughness: 0.25, metalness: 0.9 });
const shadowTex = radialGlowTexture('rgba(0,0,0,.65)', 'rgba(0,0,0,0)');
const glowTex = radialGlowTexture('rgba(255,255,255,.7)', 'rgba(255,255,255,0)');
const flameGeo = new THREE.ConeGeometry(0.2, 1.25, 6);
flameGeo.rotateX(-Math.PI / 2);
flameGeo.translate(0, 0, 0.55);

export function createKart({
  color = 0xff3b5c,
  accent = 0xffd166,
  suit = 0xfff0e2,
  number = 1,
  isPlayer = false,
}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 });
  const paintLight = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.5 });
  const suitMat = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.75, metalness: 0.05 });
  const helmetMat = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x12162c,
    roughness: 0.08,
    metalness: 0.9,
    emissive: 0x102a4d,
    emissiveIntensity: 0.4,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c9, toneMapped: false });

  const chassis = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.46, 2.9, 4, 0.14), paint);
  chassis.position.y = 0.58;
  body.add(chassis);

  const belly = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.24, 2.25, 3, 0.1), darkMat);
  belly.position.set(0, 0.36, 0.05);
  body.add(belly);

  const nose = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.3, 1.1, 4, 0.12), paint);
  nose.position.set(0, 0.53, -1.62);
  nose.rotation.x = -0.08;
  body.add(nose);

  const noseTip = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.22, 0.32, 3, 0.06), paintLight);
  noseTip.position.set(0, 0.5, -2.18);
  body.add(noseTip);

  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.38, 1.35, 3, 0.1), paintLight);
    pod.position.set(side * 1.03, 0.56, 0.15);
    body.add(pod);

    const sideLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.72), glowMat);
    sideLight.position.set(side * 1.27, 0.59, 0.2);
    body.add(sideLight);

    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), headlightMat);
    headlight.position.set(side * 0.5, 0.58, -2.06);
    body.add(headlight);
  }

  const seatBack = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.88, 0.26, 3, 0.1), darkMat);
  seatBack.position.set(0, 1.0, 0.77);
  seatBack.rotation.x = 0.12;
  body.add(seatBack);

  const seatBase = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.22, 0.85, 3, 0.08), darkMat);
  seatBase.position.set(0, 0.84, 0.43);
  body.add(seatBase);

  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.72, 8), darkMat);
  engine.rotation.x = Math.PI / 2;
  engine.position.set(0, 0.73, 1.35);
  body.add(engine);

  const engineRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 5, 12), paintLight);
  engineRing.position.set(0, 0.73, 1.72);
  body.add(engineRing);

  const spoilerBar = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.13, 0.42, 3, 0.05), paint);
  spoilerBar.position.set(0, 1.36, 1.33);
  body.add(spoilerBar);

  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.13), darkMat);
    strut.position.set(side * 0.72, 1.08, 1.36);
    strut.rotation.z = side * 0.12;
    body.add(strut);
  }

  const bumper = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.2, 0.22, 3, 0.05), darkMat);
  bumper.position.set(0, 0.47, 1.6);
  body.add(bumper);

  // Driver.
  const driver = new THREE.Group();
  driver.position.set(0, 0.7, 0.34);
  body.add(driver);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 10), suitMat);
  torso.position.y = 0.58;
  torso.rotation.x = -0.16;
  driver.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 10), darkMat);
  belt.position.y = 0.48;
  driver.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), suitMat);
  head.position.set(0, 1.1, -0.03);
  driver.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), helmetMat);
  helmet.position.set(0, 1.12, -0.02);
  driver.add(helmet);

  const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.7), paintLight);
  helmetStripe.position.set(0, 1.42, -0.02);
  driver.add(helmetStripe);

  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.22, 0.16, 3, 0.06), visorMat);
  visor.position.set(0, 1.13, -0.36);
  driver.add(visor);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 4, 8), suitMat);
    arm.position.set(side * 0.32, 0.68, -0.25);
    arm.rotation.set(0.75, 0, side * -0.22);
    driver.add(arm);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), darkMat);
    glove.position.set(side * 0.22, 0.48, -0.58);
    driver.add(glove);
  }

  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 6, 14), darkMat);
  wheelRing.position.set(0, 0.55, -0.5);
  wheelRing.rotation.x = Math.PI / 2.4;
  driver.add(wheelRing);

  // Wheels.
  const wheels = [];
  const frontWheels = [];
  for (const [x, z, front] of [
    [-1.02, -1.03, true],
    [1.02, -1.03, true],
    [-1.04, 1.02, false],
    [1.04, 1.02, false],
  ]) {
    const steer = new THREE.Group();
    steer.position.set(x, 0.43, z);
    const spin = new THREE.Group();
    steer.add(spin);
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    spin.add(tire);
    const hub = new THREE.Mesh(hubGeo, paintLight);
    spin.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.39, 6).rotateZ(Math.PI / 2), glowMat);
    spin.add(cap);
    body.add(steer);
    wheels.push(spin);
    if (front) frontWheels.push(steer);
  }

  // Exhausts and flames.
  const flames = [];
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.4, 8), chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.43, 0.6, 1.76);
    body.add(pipe);

    const flame = new THREE.Mesh(
      flameGeo,
      new THREE.MeshBasicMaterial({
        color: 0x54f7ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    flame.position.set(side * 0.43, 0.6, 1.86);
    flame.scale.set(0.01, 0.01, 0.01);
    body.add(flame);
    flames.push(flame);

    const flameCore = new THREE.Mesh(
      flameGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    flameCore.position.set(side * 0.43, 0.6, 1.87);
    flameCore.scale.setScalar(0.01);
    body.add(flameCore);
    flames.push(flameCore);
  }

  // Glowing hover cushion and contact shadow.
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 3.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: glowTex,
      color: accent,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  glow.position.y = 0.05;
  root.add(glow);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 3.7).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: 0x080416,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    })
  );
  shadow.position.y = 0.025;
  root.add(shadow);

  // A little antenna flag.
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 4), chromeMat);
  antenna.position.set(0.75, 1.5, 1.25);
  antenna.rotation.z = -0.1;
  body.add(antenna);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.3, 2, 1),
    new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, toneMapped: false })
  );
  flag.position.set(0.98, 1.92, 1.25);
  flag.rotation.y = 0.2;
  body.add(flag);

  if (isPlayer) {
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.5, 4),
      new THREE.MeshBasicMaterial({ color: 0x54f7ff, toneMapped: false })
    );
    marker.position.set(0, 3.2, 0);
    marker.rotation.x = Math.PI;
    root.add(marker);
    root.userData.marker = marker;
  }

  // Tiny racing number plate.
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xfff4df, toneMapped: false })
  );
  plate.position.set(0, 0.73, -2.2);
  body.add(plate);

  root.userData.body = body;
  root.userData.driver = driver;
  root.userData.wheels = wheels;
  root.userData.frontWheels = frontWheels;
  root.userData.flames = flames;
  root.userData.glow = glow;
  root.userData.shadow = shadow;
  root.userData.number = number;
  return root;
}

export function updateKartVisual(kart, {
  steer = 0,
  speed = 0,
  drifting = false,
  boosting = false,
  dt = 0.016,
  time = 0,
  spinSpeed = 0,
  isPlayer = false,
}) {
  const body = kart.userData.body;
  const targetLean = -steer * (drifting ? 0.2 : 0.1);
  body.rotation.z += (targetLean - body.rotation.z) * Math.min(1, dt * 8);
  const targetPitch = boosting ? -0.06 : 0;
  body.rotation.x += (targetPitch - body.rotation.x) * Math.min(1, dt * 6);
  body.position.y = Math.sin(time * 12 + kart.userData.number) * 0.018;

  for (const wheel of kart.userData.wheels) {
    wheel.rotation.x -= spinSpeed * dt;
  }
  for (const steerGroup of kart.userData.frontWheels) {
    steerGroup.rotation.y += (steer * 0.42 - steerGroup.rotation.y) * Math.min(1, dt * 12);
  }

  const flames = kart.userData.flames;
  const flameScale = boosting ? 1 : 0.01;
  for (let i = 0; i < flames.length; i++) {
    const f = flames[i];
    const isCore = i % 2 === 1;
    const target = flameScale * (isCore ? 0.48 : 1) * (0.88 + Math.sin(time * 55 + i) * 0.12);
    f.scale.x += (target * 0.9 - f.scale.x) * Math.min(1, dt * 18);
    f.scale.y += (target * 0.9 - f.scale.y) * Math.min(1, dt * 18);
    f.scale.z += (target - f.scale.z) * Math.min(1, dt * 18);
    f.material.opacity = boosting ? 0.95 : 0;
  }

  const glow = kart.userData.glow;
  glow.material.opacity = 0.32 + (boosting ? 0.4 : 0) + Math.sin(time * 5) * 0.06;

  if (isPlayer && kart.userData.marker) {
    const marker = kart.userData.marker;
    marker.position.y = 3.25 + Math.sin(time * 3.2) * 0.15;
    marker.rotation.y = time * 1.8;
  }
}
