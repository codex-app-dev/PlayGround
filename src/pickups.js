import * as THREE from 'three';
import { makeCanvasTexture, shortestDelta } from './utils.js';

function questionTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 94px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(35, 10, 60, .75)';
    ctx.strokeText('?', w / 2, h / 2 + 4);
    const g = ctx.createLinearGradient(0, 10, 0, h - 10);
    g.addColorStop(0, '#fff8d0');
    g.addColorStop(0.5, '#ffd166');
    g.addColorStop(1, '#ff5d9e');
    ctx.fillStyle = g;
    ctx.fillText('?', w / 2, h / 2 + 4);
  });
}

export class Pickups {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.coins = [];
    this.boxes = [];
    this.time = 0;
    this._buildCoins();
    this._buildBoxes();
  }

  _buildCoins() {
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9e2f,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.85,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x8c4a11,
      roughness: 0.35,
      metalness: 0.6,
    });
    const coinGeo = new THREE.TorusGeometry(0.52, 0.15, 8, 18);
    const discGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16).rotateX(Math.PI / 2);
    const glowTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,240,160,.95)');
      g.addColorStop(0.3, 'rgba(255,209,102,.55)');
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });

    const rows = [
      [0.04, 0],
      [0.043, -4.4],
      [0.043, 4.4],
      [0.105, -4.2],
      [0.108, 0],
      [0.111, 4.2],
      [0.18, -2.6],
      [0.183, 2.6],
      [0.25, 0],
      [0.275, -4.5],
      [0.278, 4.5],
      [0.39, -3.2],
      [0.393, 3.2],
      [0.46, 0],
      [0.51, -4.3],
      [0.513, 4.3],
      [0.575, -2.2],
      [0.578, 2.2],
      [0.68, 0],
      [0.78, -4.2],
      [0.783, 4.2],
      [0.87, -2.6],
      [0.873, 2.6],
      [0.94, 0],
    ];

    for (const [u, lat] of rows) {
      const f = this.track.getFrame(u);
      const group = new THREE.Group();
      group.position.copy(f.pos).addScaledVector(f.right, lat).addScaledVector(f.up, 1.35);
      group.quaternion.copy(f.quat);
      const coin = new THREE.Mesh(coinGeo, gold);
      coin.castShadow = false;
      group.add(coin);
      const disc = new THREE.Mesh(discGeo, dark);
      group.add(disc);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        })
      );
      glow.scale.set(2.5, 2.5, 1);
      group.add(glow);
      this.group.add(group);
      this.coins.push({
        type: 'coin',
        u,
        lat,
        group,
        coin,
        glow,
        active: true,
        cooldown: 0,
        phase: Math.random() * 6,
        baseY: group.position.y,
      });
    }
  }

  _buildBoxes() {
    const tex = questionTexture();
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8d68ff,
      emissive: 0x6d3cff,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.26,
      roughness: 0.15,
      metalness: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x9dfbff, transparent: true, opacity: 0.85, toneMapped: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false });
    const cubeGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
    const coreGeo = new THREE.OctahedronGeometry(0.5, 0);

    const rows = [
      [0.095, -4.6],
      [0.095, 0],
      [0.095, 4.6],
      [0.455, -4.6],
      [0.455, 0],
      [0.455, 4.6],
      [0.79, -4.6],
      [0.79, 0],
      [0.79, 4.6],
    ];

    for (const [u, lat] of rows) {
      const f = this.track.getFrame(u);
      const group = new THREE.Group();
      group.position.copy(f.pos).addScaledVector(f.right, lat).addScaledVector(f.up, 1.6);
      group.quaternion.copy(f.quat);
      const cube = new THREE.Mesh(cubeGeo, glass);
      group.add(cube);
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      group.add(edges);
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        })
      );
      sprite.scale.set(1.5, 1.5, 1);
      sprite.renderOrder = 12;
      group.add(sprite);
      this.group.add(group);
      this.boxes.push({
        type: 'item',
        u,
        lat,
        group,
        cube,
        edges,
        core,
        sprite,
        active: true,
        cooldown: 0,
        phase: Math.random() * 6,
        baseY: group.position.y,
      });
    }
  }

  update(dt, time) {
    this.time = time;
    for (const c of this.coins) {
      if (!c.active) {
        c.cooldown -= dt;
        if (c.cooldown <= 0) {
          c.active = true;
          c.group.visible = true;
        }
        continue;
      }
      c.coin.rotation.y += dt * 3.2;
      c.group.position.y = c.baseY + Math.sin(time * 2.6 + c.phase) * 0.16;
      c.glow.material.opacity = 0.6 + Math.sin(time * 5 + c.phase) * 0.18;
    }
    for (const b of this.boxes) {
      if (!b.active) {
        b.cooldown -= dt;
        if (b.cooldown <= 0) {
          b.active = true;
          b.group.visible = true;
        }
        continue;
      }
      b.group.rotation.y += dt * 0.9;
      b.core.rotation.y -= dt * 2.4;
      b.core.rotation.x += dt * 0.7;
      b.group.position.y = b.baseY + Math.sin(time * 1.8 + b.phase) * 0.18;
      const pulse = 1 + Math.sin(time * 3.5 + b.phase) * 0.035;
      b.cube.scale.setScalar(pulse);
      b.edges.scale.setScalar(pulse);
    }
  }

  check(racer) {
    const collected = [];
    for (const c of this.coins) {
      if (!c.active) continue;
      if (Math.abs(shortestDelta(racer.u, c.u)) < 0.0045 && Math.abs(racer.lateral - c.lat) < 2.1) {
        c.active = false;
        c.group.visible = false;
        c.cooldown = 10;
        collected.push(c);
      }
    }
    for (const b of this.boxes) {
      if (!b.active) continue;
      if (Math.abs(shortestDelta(racer.u, b.u)) < 0.0045 && Math.abs(racer.lateral - b.lat) < 2.1) {
        b.active = false;
        b.group.visible = false;
        b.cooldown = 6;
        collected.push(b);
      }
    }
    return collected;
  }

  reset() {
    for (const c of this.coins) {
      c.active = true;
      c.cooldown = 0;
      c.group.visible = true;
    }
    for (const b of this.boxes) {
      b.active = true;
      b.cooldown = 0;
      b.group.visible = true;
    }
  }
}
