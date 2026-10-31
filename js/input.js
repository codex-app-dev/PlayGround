import * as THREE from '../vendor/three.module.js';
import { buildingDef, unitDef } from './data.js';

export class InputController {
  constructor(renderer, cameraRig, game, ui, audio) {
    this.renderer = renderer;
    this.dom = renderer.domElement;
    this.cameraRig = cameraRig;
    this.camera = cameraRig.camera;
    this.game = game;
    this.ui = ui;
    this.audio = audio;
    this.enabled = true;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointers = new Map();
    this.leftDown = null;
    this.rightDown = null;
    this.middleDown = null;
    this.touchStart = null;
    this.touchDragged = false;
    this.pinch = null;
    this.selectBox = null;
    this.placement = null;
    this.attackMoveMode = false;
    this.groups = new Map();
    this.onEscape = null;
    this.onPause = null;
    this.onHelp = null;
    this.marquee = document.createElement('div');
    this.marquee.className = 'marquee';
    this.marquee.style.display = 'none';
    document.body.appendChild(this.marquee);
    this.ghost = this.makeGhost();
    this.bind();
  }

  makeGhost() {
    const g = new THREE.Group();
    const boxMat = new THREE.MeshBasicMaterial({ color: 0x7fffb0, transparent: true, opacity: 0.22, depthWrite: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boxMat);
    box.position.y = 0.35;
    g.add(box);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x7fffb0, transparent: true, opacity: 0.9 }));
    edges.position.y = 0.35;
    g.add(edges);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32), new THREE.MeshBasicMaterial({ color: 0x7fffb0, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    g.visible = false;
    g.userData.box = box;
    g.userData.edges = edges;
    g.userData.ring = ring;
    this.game.scene.add(g);
    return g;
  }

  bind() {
    const dom = this.dom;
    this.handlers = {
      down: (e) => this.onPointerDown(e),
      move: (e) => this.onPointerMove(e),
      up: (e) => this.onPointerUp(e),
      cancel: (e) => this.onPointerUp(e, true),
      wheel: (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.cameraRig.zoomBy(Math.sign(e.deltaY) * 0.09);
      },
      context: (e) => e.preventDefault(),
      keydown: (e) => this.onKeyDown(e),
      keyup: (e) => this.onKeyUp(e),
      blur: () => { this.cameraRig.keys.clear(); this.pointers.clear(); },
    };
    const h = this.handlers;
    dom.addEventListener('pointerdown', h.down);
    window.addEventListener('pointermove', h.move);
    window.addEventListener('pointerup', h.up);
    window.addEventListener('pointercancel', h.cancel);
    dom.addEventListener('wheel', h.wheel, { passive: false });
    dom.addEventListener('contextmenu', h.context);
    window.addEventListener('keydown', h.keydown);
    window.addEventListener('keyup', h.keyup);
    window.addEventListener('blur', h.blur);
  }

  dispose() {
    const h = this.handlers;
    if (!h) return;
    const dom = this.dom;
    dom.removeEventListener('pointerdown', h.down);
    window.removeEventListener('pointermove', h.move);
    window.removeEventListener('pointerup', h.up);
    window.removeEventListener('pointercancel', h.cancel);
    dom.removeEventListener('wheel', h.wheel);
    dom.removeEventListener('contextmenu', h.context);
    window.removeEventListener('keydown', h.keydown);
    window.removeEventListener('keyup', h.keyup);
    window.removeEventListener('blur', h.blur);
    this.handlers = null;
    this.marquee?.remove();
    this.ghost?.removeFromParent();
    this.ghost?.traverse?.((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.cameraRig.keys.clear();
      this.cancelPlacement(true);
      this.attackMoveMode = false;
    }
  }

  screenPoint(e) {
    const rect = this.dom.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, clientX: e.clientX, clientY: e.clientY };
  }

  pickEntity(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots = [];
    for (const e of this.game.entities) {
      if (!e.view || e.dead) continue;
      roots.push(e.view.model);
    }
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o) {
        if (o.userData && o.userData.entityId) {
          const e = this.game.entities.find(x => x.id === o.userData.entityId);
          if (e && !e.dead) return e;
        }
        o = o.parent;
      }
    }
    return null;
  }

  onPointerDown(e) {
    if (!this.enabled) return;
    if (e.button === 2) {
      this.rightDown = this.screenPoint(e);
      return;
    }
    if (e.pointerType === 'touch') {
      this.pointers.set(e.pointerId, this.screenPoint(e));
      if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinch = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2,
        };
        this.touchDragged = true;
        this.touchStart = null;
        this.selectBox = null;
        this.marquee.style.display = 'none';
      } else {
        this.touchStart = this.screenPoint(e);
        this.touchStart.time = performance.now();
        this.touchDragged = false;
      }
      return;
    }
    if (e.button === 1) {
      this.middleDown = this.screenPoint(e);
      return;
    }
    if (e.button === 0) {
      this.leftDown = this.screenPoint(e);
      this.leftDown.moved = false;
      this.selectBox = null;
    }
  }

  onPointerMove(e) {
    if (!this.enabled) return;
    if (this.placement) {
      const p = this.cameraRig.screenToGround(e.clientX, e.clientY);
      if (p) this.updateGhost(p.x, p.z);
    }
    if (e.pointerType === 'touch' && this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, this.screenPoint(e));
      if (this.pointers.size >= 2 && this.pinch) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        if (this.pinch.dist > 4) this.cameraRig.zoomFactor(this.pinch.dist / Math.max(4, dist));
        this.cameraRig.panScreen(midX - this.pinch.midX, midY - this.pinch.midY);
        this.pinch = { dist, midX, midY };
        return;
      }
      if (this.touchStart) {
        const dx = e.clientX - this.touchStart.clientX;
        const dy = e.clientY - this.touchStart.clientY;
        if (Math.hypot(dx, dy) > 8) this.touchDragged = true;
        if (this.touchDragged) this.cameraRig.panScreen(dx, dy);
        this.touchStart.clientX = e.clientX;
        this.touchStart.clientY = e.clientY;
        this.touchStart.x = e.clientX;
        this.touchStart.y = e.clientY;
      }
      return;
    }
    if (this.middleDown) {
      const p = this.screenPoint(e);
      const dx = p.x - this.middleDown.x;
      const dy = p.y - this.middleDown.y;
      this.cameraRig.panScreen(dx, dy);
      this.middleDown = p;
      return;
    }
    if (this.leftDown && !this.placement) {
      const p = this.screenPoint(e);
      const dx = p.x - this.leftDown.x;
      const dy = p.y - this.leftDown.y;
      if (!this.leftDown.moved && Math.hypot(dx, dy) > 6) {
        this.leftDown.moved = true;
        this.selectBox = { x0: this.leftDown.x, y0: this.leftDown.y, x1: p.x, y1: p.y };
      }
      if (this.selectBox) {
        this.selectBox.x1 = p.x;
        this.selectBox.y1 = p.y;
        this.drawMarquee();
      }
    }
  }

  onPointerUp(e, cancelled = false) {
    if (!this.enabled) return;
    if (e.pointerType === 'touch') {
      const hadPinch = !!this.pinch;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (hadPinch || cancelled) {
        this.touchStart = null;
        this.touchDragged = false;
        return;
      }
      if (this.touchStart) {
        const wasDrag = this.touchDragged;
        this.touchStart = null;
        this.touchDragged = false;
        if (!wasDrag) this.handleTap(e);
      }
      return;
    }
    if (e.button === 2) {
      if (cancelled) return;
      if (this.placement) { this.cancelPlacement(); return; }
      if (this.attackMoveMode) { this.cancelAttackMove(); return; }
      this.issueContextOrder(e.clientX, e.clientY);
      return;
    }
    if (e.button === 1) {
      this.middleDown = null;
      return;
    }
    if (e.button === 0 && this.leftDown) {
      if (cancelled) { this.leftDown = null; this.cancelSelectBox(); return; }
      if (this.selectBox) {
        this.finishSelectBox(e.shiftKey);
      } else {
        const p = this.screenPoint(e);
        if (this.placement) {
          const ground = this.cameraRig.screenToGround(e.clientX, e.clientY);
          if (ground) { this.updateGhost(ground.x, ground.z); this.commitPlacement(ground.x, ground.z); }
        } else if (this.attackMoveMode) {
          this.commitAttackMove(e.clientX, e.clientY);
        } else {
          this.handleLeftClick(e, p, e.shiftKey);
        }
      }
      this.leftDown = null;
      this.selectBox = null;
    }
  }

  handleLeftClick(e, p, shift) {
    const entity = this.pickEntity(e.clientX, e.clientY);
    if (!entity) {
      if (e.pointerType === 'touch' && this.game.selection.some(s => s.kind === 'unit' && s.team === 0)) {
        this.issueContextOrder(e.clientX, e.clientY);
      } else if (!shift) {
        this.game.deselect();
      }
      return;
    }
    if (shift) {
      const list = [...this.game.selection];
      if (list.includes(entity)) this.game.setSelection(list.filter(x => x !== entity));
      else {
        if (entity.kind === 'unit') this.game.setSelection([...list.filter(x => x.kind === 'unit' && x.team === entity.team), entity]);
        else this.game.setSelection([entity]);
      }
      this.audio?.select();
      return;
    }
    this.game.setSelection([entity]);
    this.audio?.select();
  }

  // Touch taps combine selection and context orders.
  handleTap(e) {
    const entity = this.pickEntity(e.clientX, e.clientY);
    const ownUnits = this.game.selection.filter(s => s.kind === 'unit' && s.team === 0 && !s.dead);
    if (this.placement) {
      const ground = this.cameraRig.screenToGround(e.clientX, e.clientY);
      if (ground) { this.updateGhost(ground.x, ground.z); this.commitPlacement(ground.x, ground.z); }
      return;
    }
    if (this.attackMoveMode) {
      this.commitAttackMove(e.clientX, e.clientY);
      return;
    }
    if (!entity) {
      if (ownUnits.length) this.issueContextOrder(e.clientX, e.clientY);
      else this.game.deselect();
      return;
    }
    if (ownUnits.length && entity.team !== 0) {
      this.issueContextOrder(e.clientX, e.clientY);
      return;
    }
    if (ownUnits.length && entity.kind === 'resource') {
      this.issueContextOrder(e.clientX, e.clientY);
      return;
    }
    this.game.setSelection([entity]);
    this.audio?.select();
  }

  drawMarquee() {
    const b = this.selectBox;
    const x = Math.min(b.x0, b.x1);
    const y = Math.min(b.y0, b.y1);
    const w = Math.abs(b.x1 - b.x0);
    const h = Math.abs(b.y1 - b.y0);
    const rect = this.dom.getBoundingClientRect();
    this.marquee.style.display = 'block';
    this.marquee.style.left = `${rect.left + x}px`;
    this.marquee.style.top = `${rect.top + y}px`;
    this.marquee.style.width = `${w}px`;
    this.marquee.style.height = `${h}px`;
  }

  cancelSelectBox() {
    this.selectBox = null;
    this.marquee.style.display = 'none';
  }

  finishSelectBox(additive) {
    const b = this.selectBox;
    this.cancelSelectBox();
    if (!b) return;
    const rect = this.dom.getBoundingClientRect();
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
    const y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    const picked = [];
    const v = new THREE.Vector3();
    for (const u of this.game.units) {
      if (u.dead || u.team !== 0) continue;
      v.set(u.pos.x, 1.1, u.pos.z).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) picked.push(u);
    }
    let list = picked;
    if (additive) list = [...this.game.selection.filter(e => e.team === 0 && e.kind === 'unit'), ...picked];
    this.game.setSelection(list);
    if (picked.length) this.audio?.select();
  }

  issueContextOrder(clientX, clientY) {
    const entity = this.pickEntity(clientX, clientY);
    const own = this.game.selection.filter(e => !e.dead && e.team === 0);
    const units = own.filter(e => e.kind === 'unit');
    const buildings = own.filter(e => e.kind === 'building');
    if (!own.length) return;
    if (buildings.length === 1 && buildings[0].team === 0 && (buildings[0].isProduction || buildings[0].isHall)) {
      const b = buildings[0];
      if (entity && entity.kind === 'resource' && (entity.resourceType === 'gold' || entity.resourceType === 'lumber')) {
        this.game.setRally(b, { x: entity.pos.x, z: entity.pos.z }, entity);
        this.audio?.order();
        return;
      }
      const point = this.cameraRig.screenToGround(clientX, clientY);
      if (point) {
        this.game.setRally(b, { x: point.x, z: point.z });
        this.game.effects.ring(point.x, point.z, this.game.teams[0].color3d, 1.4, 0.5, 0.6);
        this.audio?.order();
      }
      return;
    }
    if (!units.length) return;
    if (entity && entity.team >= 0 && entity.team !== 0) {
      this.game.orderAttack(units, entity);
      this.audio?.attackOrder();
      return;
    }
    if (entity && entity.kind === 'resource' && (entity.resourceType === 'gold' || entity.resourceType === 'lumber')) {
      this.game.orderGather(units, entity);
      this.audio?.order();
      return;
    }
    const point = this.cameraRig.screenToGround(clientX, clientY);
    if (point) {
      this.game.orderMove(units, { x: point.x, z: point.z });
      this.audio?.order();
    }
  }

  beginAttackMove() {
    const units = this.game.selection.filter(e => e.kind === 'unit' && e.team === 0 && !e.dead);
    if (!units.length) { this.ui?.toast('Сначала выберите войска', 'warn'); return; }
    this.attackMoveMode = true;
    this.dom.classList.add('attack-cursor');
    this.ui?.toast('Укажите точку атаки', 'info');
  }

  cancelAttackMove() {
    this.attackMoveMode = false;
    this.dom.classList.remove('attack-cursor');
  }

  commitAttackMove(clientX, clientY) {
    const point = this.cameraRig.screenToGround(clientX, clientY);
    const units = this.game.selection.filter(e => e.kind === 'unit' && e.team === 0 && !e.dead);
    if (point && units.length) {
      this.game.orderMove(units, { x: point.x, z: point.z }, { attackMove: true });
      this.audio?.attackOrder();
    }
    this.cancelAttackMove();
  }

  beginPlacement(role) {
    const workers = this.game.selection.filter(e => e.kind === 'unit' && e.role === 'worker' && e.team === 0 && !e.dead);
    if (!workers.length) { this.ui?.toast('Выберите рабочего', 'warn'); return; }
    const team = this.game.teams[0];
    const def = buildingDef(team.race, role);
    if (!this.game.canAfford(team, def.cost)) {
      this.ui?.toast(`Не хватает: ${this.game.costMissing(team, def.cost)}`, 'warn');
      return;
    }
    if (this.placement?.role === role) { this.cancelPlacement(); return; }
    this.attackMoveMode = false;
    this.placement = { role, size: def.size, def, valid: false, x: 0, z: 0 };
    this.ghost.visible = true;
    this.dom.classList.add('build-cursor');
    const center = this.cameraRig.target;
    this.updateGhost(center.x, center.z);
    this.ui?.toast(`Разместите: ${def.name}`, 'info');
  }

  updateGhost(x, z) {
    if (!this.placement) return;
    this.placement.x = x;
    this.placement.z = z;
    const size = this.placement.size;
    const valid = this.game.canPlaceAt(x, z, size);
    this.placement.valid = valid;
    this.ghost.position.set(x, 0, z);
    const box = this.ghost.userData.box;
    const edges = this.ghost.userData.edges;
    const ring = this.ghost.userData.ring;
    box.scale.set(size * 1.76, 0.7, size * 1.76);
    edges.scale.set(size * 1.76, 0.7, size * 1.76);
    ring.scale.setScalar(size * 1.1);
    const color = valid ? 0x7fffb0 : 0xff5a5a;
    box.material.color.setHex(color);
    edges.material.color.setHex(color);
    ring.material.color.setHex(color);
  }

  commitPlacement(x, z) {
    if (!this.placement) return;
    const workers = this.game.selection.filter(e => e.kind === 'unit' && e.role === 'worker' && e.team === 0 && !e.dead);
    if (!workers.length) { this.cancelPlacement(); return; }
    if (!this.placement.valid) {
      this.ui?.toast('Здесь нельзя строить', 'warn');
      this.audio?.deny();
      return;
    }
    const role = this.placement.role;
    const res = this.game.startBuilding(this.game.teams[0], role, x, z, workers[0]);
    if (res.ok) {
      if (workers.length > 1) this.game.orderBuild(workers.slice(1), res.building);
      this.audio?.buildStart();
    } else {
      this.audio?.deny();
    }
    this.cancelPlacement();
  }

  cancelPlacement(silent = false) {
    if (!this.placement) return;
    this.placement = null;
    this.ghost.visible = false;
    this.dom.classList.remove('build-cursor');
    if (!silent) this.ui?.refreshCommands();
  }

  onKeyDown(e) {
    if (!this.enabled) return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      // Do not capture command keys while the player is typing in a menu.
      this.cameraRig.keys.add(key);
      if (key.startsWith('arrow')) e.preventDefault();
    }
    if (e.key === 'Escape') {
      if (this.placement) { this.cancelPlacement(); return; }
      if (this.attackMoveMode) { this.cancelAttackMove(); return; }
      this.game.deselect();
      if (this.onEscape) this.onEscape();
      return;
    }
    if (key === 'x') { this.beginAttackMove(); return; }
    if (key === 'z') { this.game.orderStop(this.game.selection.filter(u => u.kind === 'unit' && u.team === 0)); return; }
    if (key === 'tab') {
      e.preventDefault();
      const idle = this.game.unitsOf(0).filter(u => u.role === 'worker' && u.state === 'idle');
      if (idle.length) this.game.setSelection(idle);
      else this.ui?.toast('Все рабочие заняты', 'info');
      return;
    }
    if (key === ' ') {
      e.preventDefault();
      this.cameraRig.focusBase();
      return;
    }
    if (key === 'p') { if (this.onPause) this.onPause(); return; }
    if (e.key === 'F1') { e.preventDefault(); if (this.onHelp) this.onHelp(); return; }
    if (e.ctrlKey && key === 'a') {
      e.preventDefault();
      this.game.setSelection(this.game.unitsOf(0).filter(u => u.role !== 'worker'));
      return;
    }
    if (e.ctrlKey && /^[1-9]$/.test(key)) {
      e.preventDefault();
      const list = this.game.selection.filter(x => x.team === 0);
      if (list.length) {
        this.groups.set(key, list);
        this.ui?.toast(`Группа ${key} назначена`, 'info');
      }
      return;
    }
    if (!e.ctrlKey && /^[1-9]$/.test(key)) {
      const g = this.groups.get(key);
      if (g) {
        const alive = g.filter(x => !x.dead);
        if (alive.length) { this.game.setSelection(alive); this.audio?.select(); }
      }
      return;
    }
  }

  onKeyUp(e) {
    this.cameraRig.keys.delete(e.key.toLowerCase());
  }

  update(dt) {
    if (this.placement) {
      // Keep the ghost in sync when the camera moves by keyboard.
      const center = this.cameraRig.screenToGround(
        this.dom.getBoundingClientRect().left + this.dom.clientWidth / 2,
        this.dom.getBoundingClientRect().top + this.dom.clientHeight / 2,
      );
      if (center && this.cameraRig.keys.size) this.updateGhost(center.x, center.z);
    }
  }
}
