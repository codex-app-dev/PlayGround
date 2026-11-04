import { LEVELS } from './data/levels.js';
import { SYMBOLS } from './data/story.js';

const DIRS = {
  nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1],
  n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0],
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const key = (x, y) => `${x},${y}`;

export class Game {
  constructor(levelId, options = {}) {
    this.levelId = levelId;
    this.level = LEVELS[levelId];
    if (!this.level) throw new Error(`Unknown level ${levelId}`);
    this.outfit = options.outfit || 'default';
    this.history = [];
    this.reset();
  }

  reset() {
    const level = this.level;
    this.state = {
      levelId: this.levelId,
      grid: level.map.map((row) => [...row]),
      player: { x: level.start[0], y: level.start[1], facing: 'se' },
      turn: 0,
      moves: 0,
      entities: clone(level.entities || []),
      waterHigh: !!level.waterHigh,
      glyphSeq: [],
      keys: [],
      collectedDocs: [],
      collectedShards: [],
      relicCollected: false,
      status: 'playing',
      message: level.objective,
      deathReason: '',
      events: [],
      beam: { cells: [], hit: [] },
      hazardsActive: [],
      lastMove: null,
    };
    this.history = [];
    this.recompute();
  }

  snapshot() {
    return clone(this.state);
  }

  pushHistory() {
    this.history.push(this.snapshot());
    if (this.history.length > 160) this.history.shift();
  }

  undo() {
    if (!this.history.length) return { ok: false, message: 'Nothing to undo.' };
    const prev = this.history.pop();
    this.state = prev;
    this.state.status = 'playing';
    this.state.deathReason = '';
    this.state.events = [{ type: 'undo' }];
    this.recompute();
    return { ok: true };
  }

  get entities() { return this.state.entities; }
  get waterHigh() { return this.state.waterHigh; }

  entityAt(x, y, type = null) {
    return this.state.entities.find((e) => e.x === x && e.y === y && (!type || e.type === type));
  }

  entityById(id) { return this.state.entities.find((e) => e.id === id); }

  inBounds(x, y) {
    return y >= 0 && y < this.state.grid.length && x >= 0 && x < this.state.grid[0].length;
  }

  terrain(x, y) {
    return this.inBounds(x, y) ? this.state.grid[y][x] : '#';
  }

  isExit(x, y) { return x === this.level.exit[0] && y === this.level.exit[1]; }

  doorOpen(door) {
    return !!door.open;
  }

  blockingEntityAt(x, y) {
    const e = this.entityAt(x, y);
    if (!e) return null;
    if (e.type === 'door') return e.open ? null : e;
    if (['block', 'mirror', 'dial', 'valve', 'emitter', 'target', 'guardian'].includes(e.type)) return e;
    if (e.type === 'hazard' && e.kind === 'blade') return e;
    return null;
  }

  platformAt(x, y) {
    return this.state.entities.find((e) => e.type === 'platform' && e.x === x && e.y === y);
  }

  isWater(x, y) { return this.terrain(x, y) === '~'; }

  basinPassable(x, y) {
    return this.isWater(x, y) && this.state.waterHigh;
  }

  passableTerrain(x, y, forBlock = false) {
    if (!this.inBounds(x, y)) return false;
    const t = this.terrain(x, y);
    if (t === '#' || t === 'o') {
      if (!forBlock && this.platformAt(x, y)) return true;
      return false;
    }
    if (t === '~') return forBlock ? false : this.state.waterHigh;
    return true;
  }

  canPlayerOccupy(x, y) {
    if (!this.passableTerrain(x, y)) return false;
    const e = this.blockingEntityAt(x, y);
    return !e;
  }

  canBlockOccupy(x, y) {
    if (!this.passableTerrain(x, y, true)) return false;
    const e = this.entityAt(x, y);
    return !e || ['plate', 'glyph', 'crumble'].includes(e.type);
  }

  move(dx, dy) {
    if (this.state.status !== 'playing') return this.result(false, 'The chamber is still.');
    if (!dx && !dy) return this.result(false, 'You do not move.');
    const { player } = this.state;
    let fx = Math.sign(dx), fy = Math.sign(dy);
    // Snap diagonal-free input if both axes are supplied by a buggy caller.
    if (fx !== 0 && fy !== 0) { fy = 0; }
    const tx = player.x + fx, ty = player.y + fy;
    player.facing = fx < 0 ? 'w' : fx > 0 ? 'e' : fy < 0 ? 'n' : 's';
    if (!this.inBounds(tx, ty)) return this.result(false, 'The wall does not give.');

    const occupant = this.entityAt(tx, ty);
    if (occupant && occupant.type === 'guardian') return this.result(false, 'The guardian blocks the way.');
    if (occupant && occupant.type === 'block') {
      const bx = tx + fx, by = ty + fy;
      if (!this.canBlockOccupy(bx, by)) return this.result(false, 'The block will not move there.');
      const snapshot = this.snapshot();
      const old = { x: player.x, y: player.y };
      occupant.x = bx; occupant.y = by;
      if (!this.canPlayerOccupy(tx, ty)) return this.result(false, 'The way is blocked.');
      this.history.push(snapshot);
      this.stepPlayer(old, tx, ty);
      return this.result(true);
    }

    if (!this.canPlayerOccupy(tx, ty)) {
      const door = this.entityAt(tx, ty, 'door');
      if (door) return this.result(false, door.open ? 'The doorway is clear.' : 'The door is sealed. Examine its marks.');
      if (this.isWater(tx, ty) && !this.state.waterHigh) return this.result(false, 'The basin is a dry pit. Find the valve.');
      return this.result(false, 'The temple does not open there.');
    }

    this.pushHistory();
    const old = { x: player.x, y: player.y };
    this.stepPlayer(old, tx, ty);
    return this.result(true);
  }

  stepPlayer(old, tx, ty) {
    const state = this.state;
    state.player.x = tx; state.player.y = ty;
    state.moves += 1;
    state.turn += 1;
    state.lastMove = { from: old, to: { x: tx, y: ty } };
    state.events = [];

    // A cracked tile remembers being stepped upon.
    if (old.x !== tx || old.y !== ty) {
      const leaving = this.entityAt(old.x, old.y, 'crumble');
      if (leaving && leaving.triggered && this.terrain(old.x, old.y) !== 'o') {
        state.grid[old.y][old.x] = 'o';
        state.events.push({ type: 'crumble', x: old.x, y: old.y });
      }
    }
    const steppingCrumble = this.entityAt(tx, ty, 'crumble');
    if (steppingCrumble) {
      steppingCrumble.triggered = true;
      state.events.push({ type: 'crack' });
    }

    this.collectAt(tx, ty);
    const glyph = this.entityAt(tx, ty, 'glyph');
    if (glyph) this.stepGlyph(glyph);

    if (this.isExit(tx, ty)) {
      this.complete();
      return;
    }
    this.advanceWorld();
  }

  stepGlyph(glyph) {
    const seq = this.state.glyphSeq;
    const expected = seq.length + 1;
    if (glyph.order === expected) {
      seq.push(glyph.order);
      this.state.events.push({ type: 'glyph', good: true });
      const total = this.state.entities.filter((e) => e.type === 'glyph').length;
      if (seq.length === total) this.state.message = 'The floor-sentence closes. Somewhere, a lock remembers its key.';
      else this.state.message = `${glyph.symbol.toUpperCase()} — the sentence continues.`;
    } else if (glyph.order === 1 && seq.length !== 1) {
      this.state.glyphSeq = [1];
      this.state.events.push({ type: 'glyph', good: true });
      this.state.message = 'The sentence begins again with the EYE.';
    } else {
      this.state.glyphSeq = [];
      this.state.events.push({ type: 'glyph', good: false });
      this.state.message = 'The floor rejects the order. The sentence resets.';
    }
  }

  collectAt(x, y) {
    const state = this.state;
    for (const e of state.entities) {
      if (e.x !== x || e.y !== y) continue;
      if (e.type === 'doc' && !state.collectedDocs.includes(e.id)) {
        state.collectedDocs.push(e.id); state.events.push({ type: 'doc', id: e.id });
        state.message = 'Evidence recovered. It has been added to the journal.';
      }
      if (e.type === 'shard' && !state.collectedShards.includes(e.id)) {
        state.collectedShards.push(e.id); state.events.push({ type: 'shard', id: e.id });
        state.message = 'Echo shard recovered.';
      }
      if (e.type === 'key' && !state.keys.includes(e.id)) {
        state.keys.push(e.id); state.events.push({ type: 'key', id: e.id });
        state.message = 'A bronze key, warm from a hand that is no longer here.';
      }
      if (e.type === 'relic' && !state.relicCollected) {
        state.relicCollected = true; state.relicId = e.id; state.events.push({ type: 'relic', id: e.id });
        state.message = 'A relic of the lost city. The air changes around it.';
      }
    }
  }

  advanceWorld() {
    const state = this.state;
    state.events = state.events || [];

    // Moving platforms carry whoever is standing on them.
    for (const p of state.entities.filter((e) => e.type === 'platform')) {
      if (!p.path || p.path.length < 2) continue;
      const oldPos = { x: p.x, y: p.y };
      let dir = p.dir == null ? 1 : p.dir;
      let next = p.pathIndex + dir;
      if (next >= p.path.length) { dir = -1; next = p.path.length - 2; }
      if (next < 0) { dir = 1; next = 1; }
      p.dir = dir; p.pathIndex = next;
      const dest = p.path[next];
      const riding = state.player.x === oldPos.x && state.player.y === oldPos.y;
      p.x = dest[0]; p.y = dest[1];
      if (riding) {
        const before = { x: state.player.x, y: state.player.y };
        state.player.x = p.x; state.player.y = p.y;
        state.events.push({ type: 'ride' });
        this.collectAt(p.x, p.y);
        const glyph = this.entityAt(p.x, p.y, 'glyph');
        if (glyph) this.stepGlyph(glyph);
        if (this.isExit(p.x, p.y)) { this.complete(); return; }
        const leaving = this.entityAt(before.x, before.y, 'crumble');
        if (leaving && leaving.triggered) state.grid[before.y][before.x] = 'o';
      }
    }

    // Guardians keep their ancient rounds.
    for (const g of state.entities.filter((e) => e.type === 'guardian')) {
      if (!g.path || !g.path.length) continue;
      g.pathIndex = (g.pathIndex + 1) % g.path.length;
      const pos = g.path[g.pathIndex];
      g.x = pos[0]; g.y = pos[1];
      g.facing = g.pathIndex % 2 ? 'w' : 'e';
      if (state.player.x === g.x && state.player.y === g.y) this.kill('A silent guardian finds you between heartbeats.');
    }

    // Moving blades advance before the trap check.
    for (const h of state.entities.filter((e) => e.type === 'hazard' && e.kind === 'blade')) {
      if (!h.path || !h.path.length) continue;
      h.pathIndex = (h.pathIndex + 1) % h.path.length;
      const pos = h.path[h.pathIndex];
      h.x = pos[0]; h.y = pos[1];
      if (state.player.x === h.x && state.player.y === h.y) this.kill('The blade passes through the space you chose to stand in.');
    }

    this.recompute();

    // Active traps.
    for (const h of state.entities.filter((e) => e.type === 'hazard' && e.kind === 'dart')) {
      if (!this.hazardActive(h)) continue;
      const cells = this.dartCells(h);
      if (cells.some(([x, y]) => x === state.player.x && y === state.player.y)) {
        this.kill('A poisoned dart finds the gap in your armour.');
        break;
      }
    }

    if (state.status === 'playing' && this.isExit(state.player.x, state.player.y)) this.complete();
  }

  hazardActive(h) {
    const period = h.period || 2;
    return ((this.state.turn + (h.offset || 0)) % period) === 0;
  }

  dartCells(h) {
    const cells = [];
    let x = h.x + h.dir[0], y = h.y + h.dir[1];
    for (let i = 0; i < 30; i++) {
      if (!this.inBounds(x, y)) break;
      const t = this.terrain(x, y);
      if (t === '#') break;
      const door = this.entityAt(x, y, 'door');
      if (door && !door.open) break;
      const blocker = this.entityAt(x, y);
      if (blocker && blocker.type === 'block') break;
      cells.push([x, y]);
      x += h.dir[0]; y += h.dir[1];
    }
    return cells;
  }

  kill(reason) {
    if (this.state.status !== 'playing') return;
    this.state.status = 'dead';
    this.state.deathReason = reason;
    this.state.events.push({ type: 'death' });
  }

  complete() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'complete';
    const totalShards = this.state.entities.filter((e) => e.type === 'shard').length;
    const got = this.state.collectedShards.length;
    const stars = 1 + (this.state.moves <= this.level.par ? 1 : 0) + (got >= totalShards ? 1 : 0);
    this.state.stars = stars;
    this.state.totalShards = totalShards;
    this.state.events.push({ type: 'complete' });
  }

  findInteractable() {
    const { player } = this.state;
    const candidates = [];
    for (const e of this.state.entities) {
      if (!['mirror', 'dial', 'valve', 'door', 'inscription', 'glyph'].includes(e.type)) continue;
      const d = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
      if (d > 1) continue;
      candidates.push({ ...e, _distance: d });
    }
    const priority = { valve: 6, dial: 5, mirror: 4, door: 3, inscription: 2, glyph: 1 };
    candidates.sort((a, b) => (a._distance - b._distance) || (priority[b.type] - priority[a.type]));
    return candidates[0] || null;
  }

  interactPrompt() {
    const e = this.findInteractable();
    if (!e) return null;
    if (e.type === 'mirror') return { label: `Turn mirror · ${e.dir === '/' ? 'slash' : 'backslash'}`, type: e.type };
    if (e.type === 'dial') return { label: `Turn dial · ${SYMBOLS[e.value].toUpperCase()} → ${SYMBOLS[(e.value + 1) % SYMBOLS.length].toUpperCase()}`, type: e.type };
    if (e.type === 'valve') return { label: this.state.waterHigh ? 'Lower the water' : 'Raise the water', type: e.type };
    if (e.type === 'door') return { label: e.open ? 'Examine open door' : 'Examine sealed door', type: e.type };
    if (e.type === 'inscription') return { label: 'Read inscription', type: e.type };
    if (e.type === 'glyph') return { label: `Examine ${e.symbol} glyph`, type: e.type };
    return null;
  }

  interact() {
    if (this.state.status !== 'playing') return this.result(false, 'The chamber is still.');
    const e = this.findInteractable();
    if (!e) return this.result(false, 'There is nothing within reach.');
    if (e.type === 'inscription' || e.type === 'glyph' || e.type === 'door') {
      const message = this.describe(e);
      return this.result(false, message, { inspect: message });
    }
    this.pushHistory();
    this.state.events = [];
    if (e.type === 'mirror') {
      const ent = this.entityById(e.id);
      ent.dir = ent.dir === '/' ? '\\' : '/';
      this.state.message = 'The mirror turns with a sound like a held breath.';
      this.state.events.push({ type: 'mirror' });
    } else if (e.type === 'dial') {
      const ent = this.entityById(e.id);
      ent.value = (ent.value + 1) % SYMBOLS.length;
      this.state.message = `The dial settles on ${SYMBOLS[ent.value].toUpperCase()}.`;
      this.state.events.push({ type: 'dial' });
    } else if (e.type === 'valve') {
      if (this.isWater(this.state.player.x, this.state.player.y)) {
        this.history.pop();
        return this.result(false, 'You cannot work the valve while standing in the basin.');
      }
      this.state.waterHigh = !this.state.waterHigh;
      this.state.message = this.state.waterHigh ? 'Water climbs the walls. The city inhales.' : 'The water falls. Old stairs remember the air.';
      this.state.events.push({ type: 'water', high: this.state.waterHigh });
    }
    this.state.turn += 1;
    this.advanceWorld();
    return this.result(true);
  }

  describe(e) {
    if (e.type === 'door') {
      if (e.open) return 'The door stands open. Cold air moves through it.';
      const r = e.requires || {};
      if (r.type === 'doc') return 'A phrase is cut into the seal. It is waiting for words you have not yet found.';
      if (r.type === 'key') return 'A bronze keyhole, shaped like a mouth. Something is missing.';
      if (r.type === 'plate') return 'The door is tied to a pressure plate. Somewhere, a weight is missing.';
      if (r.type === 'beam') return 'A crystal socket above the door. It is dark.';
      if (r.type === 'waterLow') return 'The door will only release when the tide is low.';
      if (r.type === 'waterHigh') return 'The door will only release when the basin is full.';
      if (r.type === 'glyphs') return 'Four small sockets in the frame. A floor-sentence must be completed.';
      if (r.type === 'dials') return 'The seal shows the marks the dials must match.';
      if (r.type === 'all') return 'The seal is a composite of everything this temple has taught you.';
      return 'The seal is quiet.';
    }
    if (e.type === 'inscription') return e.text || 'The inscription has been worn away by patient hands.';
    if (e.type === 'glyph') return `The ${e.symbol} glyph is carved deep enough to catch a finger.`;
    return 'You examine it, but learn nothing new.';
  }

  wait() {
    if (this.state.status !== 'playing') return this.result(false, 'The chamber is still.');
    this.pushHistory();
    this.state.events = [];
    this.state.turn += 1;
    this.state.moves += 0;
    this.state.message = 'You hold still. The temple does not.';
    this.state.events.push({ type: 'wait' });
    this.advanceWorld();
    return this.result(true);
  }

  recompute() {
    const state = this.state;
    // Pressure plates.
    for (const p of state.entities.filter((e) => e.type === 'plate')) {
      p.pressed = state.entities.some((e) =>
        (e.type === 'block' && e.x === p.x && e.y === p.y) ||
        (e.type === 'guardian' && false) ||
        (state.player.x === p.x && state.player.y === p.y)
      );
    }
    // Light beam.
    state.beam = this.computeBeam();
    // Hazards currently active (for rendering).
    state.hazardsActive = state.entities
      .filter((e) => e.type === 'hazard' && e.kind === 'dart' && this.hazardActive(e))
      .map((e) => ({ id: e.id, cells: this.dartCells(e), x: e.x, y: e.y }));
    // Doors.
    for (const d of state.entities.filter((e) => e.type === 'door')) {
      d.open = this.requirementMet(d.requires);
      d.pressed = d.open;
    }
  }

  requirementMet(req) {
    if (!req) return true;
    const s = this.state;
    switch (req.type) {
      case 'plate': return !!this.entityById(req.id)?.pressed;
      case 'key': return s.keys.includes(req.id);
      case 'doc': return s.collectedDocs.includes(req.id);
      case 'beam': return s.beam.hit.includes(req.id);
      case 'glyphs': {
        const total = s.entities.filter((e) => e.type === 'glyph').length;
        return s.glyphSeq.length >= total && total > 0;
      }
      case 'waterHigh': return s.waterHigh;
      case 'waterLow': return !s.waterHigh;
      case 'dials': {
        const dials = s.entities.filter((e) => e.type === 'dial' && e.to === req.id);
        return dials.length > 0 && dials.every((d) => d.value === d.target);
      }
      case 'all': return req.items.every((r) => this.requirementMet(r));
      case 'any': return req.items.some((r) => this.requirementMet(r));
      default: return false;
    }
  }

  computeBeam() {
    const s = this.state;
    const em = s.entities.find((e) => e.type === 'emitter');
    if (!em) return { cells: [], hit: [] };
    const targets = s.entities.filter((e) => e.type === 'target');
    const hit = [];
    const cells = [];
    const seen = new Set();
    let x = em.x + em.dir[0], y = em.y + em.dir[1];
    let dx = em.dir[0], dy = em.dir[1];
    for (let i = 0; i < 220; i++) {
      if (!this.inBounds(x, y)) break;
      const k = key(x, y);
      if (seen.has(`${k}:${dx},${dy}`)) break;
      seen.add(`${k}:${dx},${dy}`);
      if (targets.some((t) => t.x === x && t.y === y)) {
        cells.push([x, y]);
        const t = targets.find((t) => t.x === x && t.y === y);
        hit.push(t.id);
        break;
      }
      const t = this.terrain(x, y);
      if (t === '#') break;
      const door = this.entityAt(x, y, 'door');
      if (door && !door.open) break;
      const blocker = this.entityAt(x, y);
      if (blocker && ['block', 'guardian'].includes(blocker.type)) break;
      const mirror = this.entityAt(x, y, 'mirror');
      if (mirror) {
        if (mirror.dir === '/') {
          if (dx === 1) { dx = 0; dy = -1; }
          else if (dx === -1) { dx = 0; dy = 1; }
          else if (dy === 1) { dx = -1; dy = 0; }
          else if (dy === -1) { dx = 1; dy = 0; }
        } else {
          if (dx === 1) { dx = 0; dy = 1; }
          else if (dx === -1) { dx = 0; dy = -1; }
          else if (dy === 1) { dx = 1; dy = 0; }
          else if (dy === -1) { dx = -1; dy = 0; }
        }
        cells.push([x, y]);
      } else {
        cells.push([x, y]);
      }
      // Dials and doors are solid to light only when closed (doors already handled).
      if (blocker && blocker.type === 'dial') break;
      x += dx; y += dy;
    }
    return { cells, hit };
  }

  result(ok, message = null, extra = {}) {
    if (message && ok) this.state.message = message;
    return { ok, message: message || this.state.message, ...extra };
  }

  get shardCount() {
    return this.state.entities.filter((e) => e.type === 'shard').length;
  }

  stats() {
    return {
      moves: this.state.moves, turn: this.state.turn, stars: this.state.stars || 0,
      shards: this.state.collectedShards.length, totalShards: this.shardCount,
      relic: this.state.relicCollected, relicId: this.state.relicId || null,
      docs: [...this.state.collectedDocs], deathReason: this.state.deathReason,
      status: this.state.status,
    };
  }
}

export { DIRS };
