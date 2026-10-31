import * as THREE from '../vendor/three.module.js';
import { createUnitModel, createBuildingModel, createTree, createGoldMine, createFountain } from './models.js';
import { GEO } from './materials.js';
import { RACES } from './data.js';

const ringMats = new Map();
function ringMat(color) {
  if (!ringMats.has(color)) ringMats.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  return ringMats.get(color);
}

class HealthBar {
  constructor(parent, width = 1.8, y = 2) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 128;
    this.canvas.height = 18;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(width, width * 0.14, 1);
    this.sprite.position.y = y;
    this.sprite.renderOrder = 30;
    this.sprite.visible = false;
    this.ratio = -1;
    this.color = '#4c8dff';
    this.construction = 0;
    this.width = width;
    parent.add(this.sprite);
  }
  set(ratio, color, construction = 0) {
    const r = Math.max(0, Math.min(1, ratio));
    const c = Math.round(construction * 100);
    if (Math.abs(r - this.ratio) < 0.004 && color === this.color && c === this.construction) return;
    this.ratio = r;
    this.color = color;
    this.construction = c;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5,9,13,.9)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    let fill = ratio > 0.55 ? '#58d06a' : ratio > 0.28 ? '#e8c34a' : '#ec5b4f';
    if (construction > 0 && construction < 100) fill = '#6ab8ff';
    ctx.fillStyle = fill;
    const innerW = (w - 6) * r;
    ctx.fillRect(3, 3, innerW, h - 6);
    if (construction > 0 && construction < 100) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(3, 13, (w - 6) * Math.min(1, construction / 100), 2);
    }
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.texture.dispose();
    this.material.dispose();
  }
}

class BaseView {
  constructor(game, entity, model, height) {
    this.game = game;
    this.entity = entity;
    this.model = model;
    this.root = new THREE.Group();
    this.root.position.set(entity.pos.x, 0, entity.pos.z);
    this.root.add(model);
    this.height = height;
    this.phase = Math.random() * 10;
    this.time = 0;
    this.selected = false;
    this.deathT = 0;
    game.scene.add(this.root);
    this.ring = null;
    this.bar = null;
    model.traverse((o) => {
      if (o.isMesh) o.userData.entityId = entity.id;
    });
  }
  addRing(radius, color) {
    const r = new THREE.Mesh(GEO.ring, ringMat(color));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.07;
    r.scale.setScalar(radius);
    r.visible = false;
    r.renderOrder = 12;
    this.root.add(r);
    this.ring = r;
  }
  setSelected(v) {
    this.selected = v;
    if (this.ring) this.ring.visible = v;
  }
  updateBar() {
    if (!this.bar) return;
    const e = this.entity;
    const damaged = e.hp < e.maxHp - 0.01;
    this.bar.sprite.visible = this.selected || damaged || (e.construction !== undefined && e.construction < 1);
    if (this.bar.sprite.visible) {
      const ratio = e.construction !== undefined && e.construction < 1 ? e.construction : e.hp / e.maxHp;
      this.bar.set(ratio, e.teamColor, e.construction !== undefined ? e.construction : 0);
    }
  }
  syncCommon() {
    this.root.position.x = this.entity.pos.x;
    this.root.position.z = this.entity.pos.z;
    if (this.entity.facing !== undefined) this.root.rotation.y = this.entity.facing;
    this.updateBar();
  }
  remove() {
    this.bar?.dispose();
    this.root.removeFromParent();
  }
}

export class UnitView extends BaseView {
  constructor(game, entity) {
    const model = createUnitModel(entity.race, entity.role, entity.teamColor);
    const height = model.userData.anim?.height || 2;
    super(game, entity, model, height);
    this.anim = model.userData.anim || {};
    this.walkPhase = Math.random() * 6;
    this.attackT = 0;
    this.workT = 0;
    this.facing = entity.facing || 0;
    this.addRing(Math.max(0.8, entity.radius * 1.7), entity.team === 0 ? 0x8fc2ff : 0xff6a5c);
    this.bar = new HealthBar(this.root, Math.max(1.2, entity.radius * 3.2), height + 0.35);
    this.bar.set(1, entity.teamColor);
    this.model.traverse((o) => { if (o.isMesh) o.userData.entityId = entity.id; });
  }
  update(dt) {
    const e = this.entity;
    this.time += dt;
    if (this.attackT > 0) this.attackT = Math.max(0, this.attackT - dt);
    const moving = e.moving && !e.dead;
    const working = e.working && !e.dead;
    if (e.dead) {
      this.deathT += dt;
      this.model.rotation.z = Math.min(1.5, this.deathT * 2.4);
      this.model.position.y = -Math.min(0.35, this.deathT * 0.12);
      this.ring.visible = false;
      this.bar.sprite.visible = false;
      this.syncCommon();
      return;
    }
    this.syncCommon();
    // Smooth turning toward the entity's facing direction.
    let target = e.facing || 0;
    let diff = target - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * Math.min(1, dt * 12);
    this.root.rotation.y = this.facing;

    const anim = this.anim;
    if (moving) this.walkPhase += dt * (e.role === 'heavy' ? 11 : 13);
    const swing = moving ? Math.sin(this.walkPhase) : Math.sin(this.time * 2 + this.phase) * 0.05;
    const legAmp = e.role === 'heavy' ? 0.55 : 0.62;
    if (anim.legs) {
      if (e.role === 'heavy') {
        anim.legs.forEach((leg, i) => {
          const off = i < 2 ? 0 : Math.PI;
          leg.rotation.x = swing * legAmp + off;
        });
      } else {
        anim.legs.forEach((leg, i) => { leg.rotation.x = swing * legAmp * (i ? -1 : 1); });
      }
    }
    // Arms: attack swing takes priority, then working, then walking.
    const attackK = this.attackT > 0 ? Math.sin((1 - this.attackT / 0.32) * Math.PI) : 0;
    if (anim.arms) {
      anim.arms.forEach((arm, i) => {
        let x = moving ? -swing * 0.35 * (i ? -1 : 1) : 0;
        if (i === 1 && attackK > 0) x = -1.35 * attackK;
        if (i === 1 && working) x = -0.9 + Math.sin(this.time * 15) * 0.55;
        arm.rotation.x = x;
      });
      if (anim.arms[0]) anim.arms[0].rotation.z = e.role === 'caster' ? -0.18 : 0.04;
    }
    // Whole-body gait bob.
    this.model.position.y = moving ? Math.abs(Math.sin(this.walkPhase)) * (e.role === 'heavy' ? 0.05 : 0.07) : Math.sin(this.time * 2.2 + this.phase) * 0.012;
    if (anim.glow) {
      const k = 1 + Math.sin(this.time * 5 + this.phase) * 0.16;
      anim.glow.scale.setScalar(1 * k);
    }
    if (anim.runes) {
      anim.runes.rotation.y += dt * 0.7;
    }
    if (anim.eyes) {
      const k = 1.4 + Math.sin(this.time * 3 + this.phase) * 0.4;
      anim.eyes.forEach(eye => { eye.material.emissiveIntensity = k; });
    }
    if (anim.mount) {
      this.model.position.y += Math.abs(Math.sin(this.walkPhase)) * 0.02;
    }
  }
}

export class BuildingView extends BaseView {
  constructor(game, entity) {
    const model = createBuildingModel(entity.race, entity.role, entity.teamColor);
    const size = entity.size;
    model.scale.setScalar(size);
    const box = new THREE.Box3().setFromObject(model);
    const height = box.max.y;
    super(game, entity, model, height);
    this.size = size;
    this.anim = model.userData.anim || {};
    this.baseScale = size;
    this.addRing(size * 1.15, entity.team === 0 ? 0x8fc2ff : 0xff6a5c);
    this.bar = new HealthBar(this.root, Math.min(4.6, size * 1.35), height + 0.55);
    this.bar.set(1, entity.teamColor);
    this.model.traverse((o) => { if (o.isMesh) o.userData.entityId = entity.id; });
  }
  update(dt) {
    const e = this.entity;
    this.time += dt;
    this.syncCommon();
    if (e.dead) {
      this.deathT += dt;
      this.root.rotation.z = Math.min(0.35, this.deathT * 0.6);
      this.root.position.y = -Math.min(0.8, this.deathT * 0.4);
      this.ring.visible = false;
      this.bar.sprite.visible = false;
      return;
    }
    const construction = e.construction !== undefined ? e.construction : 1;
    if (construction < 1) {
      const k = 0.35 + construction * 0.65;
      this.model.scale.set(this.baseScale * k, this.baseScale * (0.15 + construction * 0.85), this.baseScale * k);
      this.model.position.y = 0;
    } else if (Math.abs(this.model.scale.x - this.baseScale) > 0.001) {
      this.model.scale.setScalar(this.baseScale);
    }
    if (this.anim.flags) {
      this.anim.flags.forEach((flag) => {
        flag.rotation.y = Math.sin(this.time * 2.2 + (flag.userData.phase || 0)) * 0.24;
      });
    }
    if (this.anim.fire) {
      this.anim.fire.forEach((f) => {
        const s = 0.9 + Math.sin(this.time * 9 + this.phase) * 0.15;
        f.scale.set(f.scale.x, s, f.scale.z);
      });
    }
    if (this.anim.glow) {
      this.anim.glow.forEach((g) => {
        if (g.material) g.material.emissiveIntensity = 1.6 + Math.sin(this.time * 3 + this.phase) * 0.4;
      });
    }
  }
}

export class ResourceView extends BaseView {
  constructor(game, entity) {
    let model;
    if (entity.resourceType === 'gold') model = createGoldMine();
    else if (entity.resourceType === 'lumber') model = createTree(entity.variant || 0, entity.scale || 1);
    else model = createFountain();
    const box = new THREE.Box3().setFromObject(model);
    const height = box.max.y;
    super(game, entity, model, height);
    this.kind = entity.resourceType;
    this.baseY = 0;
    this.anim = model.userData.anim || {};
    this.fountainWater = model.userData.water;
    this.fountainCrystal = model.userData.crystal;
    this.model.traverse((o) => { if (o.isMesh) o.userData.entityId = entity.id; });
  }
  update(dt) {
    this.time += dt;
    this.syncCommon();
    if (this.kind === 'lumber') {
      this.model.rotation.z = Math.sin(this.time * 0.9 + this.phase) * 0.012;
    }
    if (this.kind === 'fountain') {
      if (this.fountainCrystal) {
        this.fountainCrystal.rotation.y += dt * 0.8;
        this.fountainCrystal.position.y = 2.3 + Math.sin(this.time * 1.8) * 0.1;
      }
      if (this.fountainWater) {
        this.fountainWater.material.emissiveIntensity = 0.55 + Math.sin(this.time * 2.2) * 0.18;
      }
    }
    if (this.bar) this.updateBar();
  }
}

export function createView(game, entity) {
  if (entity.kind === 'unit') return new UnitView(game, entity);
  if (entity.kind === 'building') return new BuildingView(game, entity);
  return new ResourceView(game, entity);
}

// ---------------------------------------------------------------------------
// Offscreen 3D thumbnails for the command card and the live portrait.
// ---------------------------------------------------------------------------
class ThumbRenderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1.5);
    this.renderer.setSize(128, 128, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x53452e, 1.6));
    const key = new THREE.DirectionalLight(0xfff0d2, 2.6);
    key.position.set(2.5, 4, 3.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb2ff, 1.2);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    this.cache = new Map();
    this.backup = new THREE.Group();
    this.scene.add(this.backup);
  }
  fill(model, cameraAngle = 0.5) {
    this.backup.clear();
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.position.sub(center);
    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.y = cameraAngle;
    this.backup.add(holder);
    const dist = maxDim * 2.3;
    this.camera.position.set(0, maxDim * 0.45, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = Math.max(0.01, dist - maxDim * 2);
    this.camera.far = dist + maxDim * 4;
    this.camera.updateProjectionMatrix();
  }
  thumbnail(race, role, isBuilding, teamColor) {
    const key = `${race}:${role}:${isBuilding ? 'b' : 'u'}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const model = isBuilding ? createBuildingModel(race, role, teamColor) : createUnitModel(race, role, teamColor);
    if (isBuilding) model.scale.setScalar(1.7);
    this.fill(model, isBuilding ? 0.62 : 0.4);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.backup.clear();
    this.cache.set(key, url);
    return url;
  }
}

export const iconRenderer = new ThumbRenderer();

export class PortraitRenderer {
  constructor(holder) {
    this.holder = holder;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'portrait-canvas';
    holder.appendChild(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    this.scene.add(new THREE.HemisphereLight(0xd8ebff, 0x5b4a32, 1.5));
    this.key = new THREE.DirectionalLight(0xffe8c4, 2.8);
    this.key.position.set(2, 4, 3);
    this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0x7fb2ff, 1.6);
    this.rim.position.set(-3, 2.5, -2);
    this.scene.add(this.rim);
    this.holderGroup = new THREE.Group();
    this.scene.add(this.holderGroup);
    this.entity = null;
    this.model = null;
    this.time = 0;
    this.spin = 0.25;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const rect = this.holder.getBoundingClientRect();
    const w = Math.max(64, Math.floor(rect.width || 160));
    const h = Math.max(64, Math.floor(rect.height || 160));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  show(entity) {
    this.entity = entity;
    this.holderGroup.clear();
    this.model = null;
    if (!entity) { this.renderer.clear(); return; }
    const race = entity.race;
    let model;
    if (entity.kind === 'building') {
      model = createBuildingModel(race, entity.role, entity.teamColor);
      model.scale.setScalar(1.8);
    } else if (entity.kind === 'unit') {
      model = createUnitModel(race, entity.role, entity.teamColor);
    } else {
      return;
    }
    this.model = model;
    this.holderGroup.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.position.sub(center);
    model.position.y += maxDim * 0.06;
    const dist = maxDim * 1.85;
    this.camera.position.set(0, maxDim * 0.35, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = Math.max(0.01, dist - maxDim * 2);
    this.camera.far = dist + maxDim * 4;
    this.camera.updateProjectionMatrix();
    const color = entity.teamColor || 0x4c8dff;
    this.rim.color.set(color);
    this.time = 0;
    this.spin = entity.kind === 'building' ? 0.18 : 0.4;
    this.renderer.render(this.scene, this.camera);
  }
  update(dt) {
    if (!this.model) return;
    this.time += dt;
    if (this.model) {
      this.holderGroup.rotation.y = Math.sin(this.time * this.spin) * 0.35;
      if (this.entity?.kind === 'unit') {
        this.holderGroup.position.y = Math.sin(this.time * 2) * 0.015;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
