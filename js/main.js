import { LEVELS, LEVEL_ORDER, nextLevel } from './data/levels.js';
import { CHAPTERS, SECRET_CHAPTER, DOCS, RELICS, OUTFITS, DEDUCTIONS, STORY_OPENING, ENDING } from './data/story.js';
import { Game } from './engine.js';
import { Renderer, Ambient } from './render.js';
import { chapterArt } from './art.js';
import { Sound } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SAVE_KEY = 'solt_save_v1';
const SAVE_VERSION = 1;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'IX'];

const defaultSave = () => ({
  version: SAVE_VERSION, started: false, levelStats: {}, docs: [], deductions: [], relics: [],
  outfits: ['default'], outfit: 'default', chapterIntroSeen: [], chapterOutroSeen: [],
  endingSeen: false, secretIntroSeen: false, secretDone: false,
});

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    return { ...defaultSave(), ...s, levelStats: s.levelStats || {} };
  } catch { return defaultSave(); }
}
let save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }

const sound = new Sound();
const ambient = new Ambient($('#stage'));
let renderer = null;
let game = null;
let currentLevelId = null;
let screen = 'title';
let overlayOpen = false;
let modalOpen = false;
let busy = false;
let hintIndex = 0;
let messageTimer = 0;
let toastTimer = 0;

function init() {
  renderer = new Renderer($('#game-canvas'));
  renderer.outfitColors = Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, v.colors]));
  bindGlobal();
  bindTitle();
  bindGame();
  refreshTitle();
  requestAnimationFrame(loop);
}
function loop(now) {
  ambient.tick(now);
  if (screen === 'game' && renderer) renderer.tick(now);
  requestAnimationFrame(loop);
}

function refreshTitle() {
  $('#btn-continue').style.display = save.started ? '' : 'none';
  $('#btn-begin').textContent = save.started ? 'Begin a New Expedition' : 'Begin the Expedition';
}

function bindTitle() {
  $('#btn-begin').addEventListener('click', () => {
    sound.init(); sound.click();
    if (save.started) {
      confirmDialog('Abandon this expedition? All stars, evidence, and relics will be lost.', () => {
        save = defaultSave(); persist(); refreshTitle();
        beginNew();
      });
    } else beginNew();
  });
  $('#btn-continue').addEventListener('click', () => { sound.init(); sound.click(); showMap(); });
  $('#btn-title-journal').addEventListener('click', () => { sound.init(); openJournal(); });
}

function beginNew() {
  sound.init();
  showStory(STORY_OPENING, {
    art: 'jungle', title: 'The Symbol', tag: 'Prologue · The Cloud Forest',
    onDone: () => {
      save.started = true; persist(); refreshTitle(); showMap();
      showStory(CHAPTERS[0].intro, {
        art: 'jungle', title: CHAPTERS[0].title, tag: `Chapter ${CHAPTERS[0].roman}`,
        onDone: () => { save.chapterIntroSeen.push(1); persist(); },
      });
    },
  });
}

function showScreen(name) {
  screen = name;
  $$('.screen').forEach((el) => el.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
  if (name !== 'game') { game = null; }
}

function showMap() {
  showScreen('map');
  renderMap();
}

/* ---------------- MAP ---------------- */

function chapterUnlocked(chapter) {
  if (chapter.id === 1) return true;
  const prev = CHAPTERS.find((c) => c.id === chapter.id - 1);
  if (!prev) return false;
  const last = prev.levels[prev.levels.length - 1];
  return !!save.levelStats[last]?.completed;
}
function levelUnlocked(levelId) {
  const level = LEVELS[levelId];
  const chapter = CHAPTERS.find((c) => c.id === level.chapter);
  if (!chapter || !chapterUnlocked(chapter)) return false;
  const idx = chapter.levels.indexOf(levelId);
  if (idx <= 0) return true;
  return !!save.levelStats[chapter.levels[idx - 1]]?.completed;
}
function chapterStars(chapter) {
  return chapter.levels.reduce((a, id) => a + (save.levelStats[id]?.stars || 0), 0);
}
function totalStars() { return Object.values(save.levelStats).reduce((a, s) => a + (s.stars || 0), 0); }
function relicCount() { return save.relics.length; }
function allRelics() { return ['r1', 'r2', 'r3', 'r4', 'r5'].every((r) => save.relics.includes(r)); }
function secretUnlocked() { return allRelics() && !!save.levelStats['5-2']?.completed; }

function renderMap() {
  const stats = { stars: totalStars(), relics: relicCount(), docs: save.docs.length };
  $('#stat-stars').textContent = stats.stars;
  $('#stat-relics').textContent = stats.relics;
  $('#stat-docs').textContent = `${stats.docs}/${Object.keys(DOCS).length}`;
  $('#map-outfit-label').textContent = `Outfit: ${OUTFITS[save.outfit]?.name || 'Field Jacket'}`;
  const list = $('#chapter-list');
  list.innerHTML = CHAPTERS.map((ch) => {
    const unlocked = chapterUnlocked(ch);
    const stars = chapterStars(ch);
    const maxStars = ch.levels.length * 3;
    const relicLevel = ch.levels.find((id) => LEVELS[id].entities.some((e) => e.type === 'relic'));
    const hasRelic = relicLevel && save.relics.includes(LEVELS[relicLevel].entities.find((e) => e.type === 'relic').id);
    return `
      <article class="chapter ${unlocked ? '' : 'locked'}" style="--chapter-art:${chapterGlow(ch.id)}">
        <div class="chapter-head">
          <div class="chapter-num">${ch.roman}</div>
          <div>
            <h3>${ch.title}</h3>
            <div class="chapter-loc">${ch.location}</div>
          </div>
          <div class="chapter-progress">★ ${stars}/${maxStars}<br>${hasRelic ? '<span style="color:var(--teal)">◈ Relic found</span>' : relicLevel ? '◈ Relic hidden' : ''}</div>
        </div>
        <p style="font-size:.76rem;color:var(--muted);line-height:1.5;margin:.7rem 0 0;position:relative">${ch.blurb}</p>
        <div class="level-row">
          ${ch.levels.map((id) => levelCard(id)).join('')}
        </div>
      </article>`;
  }).join('');
  $$('.level-card', list).forEach((btn) => {
    btn.addEventListener('click', () => { sound.init(); sound.click(); enterLevel(btn.dataset.level); });
  });
  const node = $('#secret-node');
  const unlocked = secretUnlocked();
  if (!unlocked) {
    node.classList.remove('hidden');
    node.innerHTML = `<p class="eyebrow">Secret chamber</p><h3>The Ninth Echo</h3>
      <p>Recover all five relics and finish the Lost Sanctuary to unseal the hidden ossuary. Relics found: ${relicCount()}/5.</p>`;
  } else {
    node.classList.remove('hidden');
    node.innerHTML = `<p class="eyebrow">Secret chamber unlocked</p><h3>The Ninth Echo</h3>
      <p>A room that only exists for those who carried all five relics. It is not on Adrian's map.</p>
      <button class="btn primary" id="btn-secret">Enter the Ossuary</button>`;
    $('#btn-secret').addEventListener('click', () => { sound.init(); enterLevel('S-1'); });
  }
}

function chapterGlow(id) {
  return [
    '', 'radial-gradient(circle at 85% 20%,rgba(120,160,100,.2),transparent 45%)',
    'radial-gradient(circle at 85% 20%,rgba(95,208,188,.2),transparent 45%)',
    'radial-gradient(circle at 85% 20%,rgba(80,170,200,.2),transparent 45%)',
    'radial-gradient(circle at 85% 20%,rgba(150,110,190,.18),transparent 45%)',
    'radial-gradient(circle at 85% 20%,rgba(230,150,80,.18),transparent 45%)',
  ][id] || '';
}

function levelCard(id) {
  const level = LEVELS[id];
  const unlocked = levelUnlocked(id);
  const st = save.levelStats[id] || {};
  const relic = level.entities.find((e) => e.type === 'relic');
  const stars = [1, 2, 3].map((i) => `<span class="${(st.stars || 0) >= i ? '' : 'off'}">★</span>`).join('');
  return `<button class="level-card" data-level="${id}" ${unlocked ? '' : 'disabled'}>
    ${relic ? '<span class="tag">Relic</span>' : ''}
    <small>${level.subtitle}</small>
    <b>${level.name}</b>
    <div class="stars">${stars}</div>
  </button>`;
}

/* ---------------- LEVEL ENTRY ---------------- */

function enterLevel(id, opts = {}) {
  if (!LEVELS[id]) return;
  currentLevelId = id;
  const level = LEVELS[id];
  const chapter = CHAPTERS.find((c) => c.id === level.chapter) || SECRET_CHAPTER;
  game = new Game(id, { outfit: save.outfit });
  renderer.outfitColors = Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, v.colors]));
  renderer.setGame(game);
  hintIndex = 0;
  showScreen('game');
  $('#game-chapter').textContent = `Chapter ${level.chapter === 6 ? 'IX' : chapter.roman} · ${level.subtitle}`;
  $('#game-level').textContent = level.name;
  $('#game-objective').textContent = level.objective;
  $('#game-tip').textContent = level.tip;
  updateHUD();
  requestAnimationFrame(() => {
    renderer.resize();
    renderer.layout();
    renderer.setGame(game);
    renderer.burst(game.state.player.x, game.state.player.y, '#f3dba2', 8);
  });
  const introAlreadySeen = opts.skipIntro;
  const showLevelIntro = () => {
    if (introAlreadySeen) return;
    showLevelCard(level, chapter);
  };
  if (level.chapter === 6) {
    if (!save.secretIntroSeen) {
      showStory(SECRET_CHAPTER.intro, {
        art: 'secret', title: 'The Ninth Echo', tag: 'Secret Chapter',
        onDone: () => { save.secretIntroSeen = true; persist(); showLevelIntro(); },
      });
    } else showLevelIntro();
  } else if (!save.chapterIntroSeen.includes(level.chapter)) {
    showStory(chapter.intro, {
      art: chapter.art, title: chapter.title, tag: `Chapter ${chapter.roman} · ${chapter.location}`,
      onDone: () => {
        save.chapterIntroSeen.push(level.chapter); persist(); showLevelIntro();
      },
    });
  } else showLevelIntro();
}

function showLevelCard(level, chapter) {
  const art = chapterArt(chapter.art);
  openOverlay(`
    <div class="story-card overlay-card">
      <div class="story-art">${art}</div>
      <div class="story-body">
        <p class="eyebrow">${level.chapter === 6 ? 'Secret Chapter' : `Chapter ${chapter.roman}`} · ${level.subtitle}</p>
        <h2>${level.name}</h2>
        <p style="font-family:var(--serif);font-size:1.02rem">${level.objective}</p>
        <div class="stat-grid">
          <div><small>Par moves</small><b>${level.par}</b></div>
          <div><small>Echo shards</small><b>${level.entities.filter((e) => e.type === 'shard').length}</b></div>
          <div><small>Relic</small><b>${level.entities.some((e) => e.type === 'relic') ? 'Hidden' : '—'}</b></div>
        </div>
        <p class="hint-box" style="border:0;padding:0;font-size:.75rem;color:var(--muted)">${level.tip}</p>
        <div class="overlay-actions">
          <button class="btn primary" id="btn-enter-level">Enter the chamber</button>
          <button class="btn quiet" id="btn-level-back">Campaign map</button>
        </div>
      </div>
    </div>`);
  $('#btn-enter-level').addEventListener('click', () => { sound.click(); closeOverlay(); });
  $('#btn-level-back').addEventListener('click', () => { sound.click(); closeOverlay(); showMap(); });
}

/* ---------------- GAME UI ---------------- */

function bindGame() {
  $('#btn-pause').addEventListener('click', () => { sound.init(); sound.click(); showPause(); });
  $('#btn-game-journal').addEventListener('click', () => { sound.init(); openJournal(); });
  $('#btn-undo').addEventListener('click', undoAction);
  $('#btn-interact').addEventListener('click', () => doInteract());
  $('#btn-wait').addEventListener('click', () => doWait());
  $('#btn-hint').addEventListener('click', showHint);
  $$('.dpad').forEach((b) => b.addEventListener('click', () => {
    const map = { nw: [-1, 0], ne: [0, -1], sw: [0, 1], se: [1, 0] };
    doMove(...map[b.dataset.dir]);
  }));
  $('#game-canvas').addEventListener('pointerdown', (ev) => {
    if (!game || !renderer || screen !== 'game' || overlayOpen || modalOpen || game.state.status !== 'playing') return;
    const rect = $('#game-canvas').getBoundingClientRect();
    const tile = renderer.pick(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!tile) return;
    const dx = tile.x - game.state.player.x, dy = tile.y - game.state.player.y;
    if (Math.abs(dx) + Math.abs(dy) === 0) { doInteract(); return; }
    if (Math.abs(dx) + Math.abs(dy) === 1) doMove(dx, dy);
    else showBoardMessage('Evelyn must move one stone at a time.');
  });
  window.addEventListener('resize', () => { if (screen === 'game' && renderer) { renderer.resize(); renderer.layout(); renderer.setGame(game); } });
}

function bindGlobal() {
  window.addEventListener('keydown', (e) => {
    sound.init();
    if (e.key === 'Escape') {
      if (modalOpen) { closeModal(); e.preventDefault(); return; }
      if (overlayOpen) { const c = $('[data-close]', $('#overlay-root')); if (c) c.click(); return; }
      if (screen === 'game') { showPause(); e.preventDefault(); }
      return;
    }
    if (overlayOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        const next = $('[data-story-next]');
        if (next) { next.click(); e.preventDefault(); }
      }
      return;
    }
    if (modalOpen) return;
    if (screen !== 'game' || !game) return;
    if (game.state.status !== 'playing') return;
    const k = e.key.toLowerCase();
    const dirs = {
      arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
      arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
      e: 'interact', ' ': 'wait', u: 'undo', r: 'retry', j: 'journal', m: 'mute',
    };
    const a = dirs[k];
    if (!a) return;
    e.preventDefault();
    if (a === 'interact') doInteract();
    else if (a === 'wait') doWait();
    else if (a === 'undo') undoAction();
    else if (a === 'retry') retryLevel();
    else if (a === 'journal') openJournal();
    else if (a === 'mute') { sound.setMuted(!sound.muted); showToast(sound.muted ? 'Sound off' : 'Sound on'); }
    else doMove(...a);
  });
}

function doMove(dx, dy) {
  if (!game || busy || overlayOpen || modalOpen || game.state.status !== 'playing') return;
  const beforeShards = game.state.collectedShards.length;
  const beforeRelic = game.state.relicCollected;
  const r = game.move(dx, dy);
  afterAction(r, 'move', { beforeShards, beforeRelic });
}
function doWait() {
  if (!game || busy || overlayOpen || modalOpen || game.state.status !== 'playing') return;
  const r = game.wait();
  afterAction(r, 'wait');
}
function doInteract() {
  if (!game || busy || overlayOpen || modalOpen || game.state.status !== 'playing') return;
  const r = game.interact();
  afterAction(r, 'interact');
}
function undoAction() {
  if (!game || busy) return;
  const r = game.undo();
  if (!r.ok) { showToast('Nothing to undo'); sound.error(); return; }
  closeOverlay(); closeModal();
  renderer.setGame(game);
  updateHUD();
  showToast('Time steps back.');
  sound.mirror();
}
function retryLevel() {
  if (!game) return;
  closeOverlay(); closeModal();
  game.reset();
  busy = false;
  renderer.setGame(game);
  hintIndex = 0;
  $('#game-tip').textContent = game.level.tip;
  updateHUD();
  showToast('The chamber resets.');
  sound.water();
  setTimeout(() => { if (game) renderer.setGame(game); }, 30);
}

function afterAction(r, kind, info = {}) {
  if (!game) return;
  updateHUD();
  if (!r.ok) {
    showBoardMessage(r.message);
    sound.error();
    return;
  }
  busy = true;
  if (kind === 'move') sound.step();
  if (kind === 'wait') sound.block();
  if (kind === 'interact') sound.click();
  closeModal();
  const events = game.state.events || [];
  for (const ev of events) {
    if (ev.type === 'shard') {
      sound.collect(); renderer.burst(game.state.player.x, game.state.player.y, '#7ef0dc', 18);
      showToast('Echo shard recovered'); updateHUD();
    } else if (ev.type === 'relic') {
      const relic = RELICS[ev.id];
      sound.relic(); renderer.burst(game.state.player.x, game.state.player.y, '#ffe6ab', 34);
      renderer.flashScreen('rgba(255,220,130,.2)');
      showToast(`${relic?.name || 'Relic'} recovered`);
    } else if (ev.type === 'doc') {
      sound.collect(); renderer.burst(game.state.player.x, game.state.player.y, '#f0dca3', 14);
      showToast('Evidence recovered');
    } else if (ev.type === 'key') {
      sound.collect(); showToast('Bronze key recovered');
    } else if (ev.type === 'glyph') {
      sound.glyph(ev.good); if (ev.good) renderer.burst(game.state.player.x, game.state.player.y, '#7ef0dc', 12);
    } else if (ev.type === 'water') {
      sound.water(); showToast(ev.high ? 'The tide rises' : 'The tide falls');
    } else if (ev.type === 'crumble') {
      renderer.shakeScreen(); sound.block(); showToast('The floor gives way behind you');
    } else if (ev.type === 'mirror') sound.mirror();
    else if (ev.type === 'dial') sound.dial();
    else if (ev.type === 'death') { sound.death(); renderer.shakeScreen(); renderer.flashScreen('rgba(190,40,30,.38)'); }
    else if (ev.type === 'complete') sound.complete();
    else if (ev.type === 'ride') { sound.block(); showToast('The slab carries you'); }
  }
  renderer.setGame(game);
  updateHUD();
  showBoardMessage(game.state.message);
  if (game.state.status === 'dead') {
    setTimeout(() => { if (game?.state.status === 'dead') showDeath(); }, 520);
  } else if (game.state.status === 'complete') {
    setTimeout(() => { if (game?.state.status === 'complete') finishLevel(); }, 640);
  }
  setTimeout(() => { busy = false; }, 170);
}

function updateHUD() {
  if (!game) return;
  const s = game.state;
  $('#game-moves').textContent = `Moves ${s.moves}`;
  $('#game-shards').textContent = `◈ ${s.collectedShards.length}/${game.shardCount}`;
  $('#game-objective').textContent = game.level.objective;
  const docsHere = s.collectedDocs.map((id) => DOCS[id]).filter(Boolean);
  $('#game-evidence').innerHTML = docsHere.length
    ? docsHere.map((d) => `<span class="ev">✧ ${escape(d.title)}</span>`).join('')
    : 'No evidence recovered in this chamber.';
  const types = new Set(s.entities.map((e) => e.type === 'hazard' ? `trap-${e.kind}` : e.type));
  const legends = [];
  const add = (cond, txt) => { if (cond) legends.push(`<span>${txt}</span>`); };
  add(types.has('plate') && types.has('block'), 'Pressure plate · block');
  add(types.has('key'), 'Bronze key');
  add(types.has('doc'), 'Evidence');
  add(types.has('mirror') || types.has('emitter'), 'Mirror · light');
  add(types.has('dial'), 'Symbol dial');
  add(types.has('valve') || s.waterHigh, 'Tide valve');
  add(types.has('glyph'), 'Floor glyphs');
  add(types.has('guardian'), 'Guardian patrol');
  add(types.has('trap-dart') || types.has('trap-blade'), 'Ancient trap');
  add(types.has('platform'), 'Moving slab');
  add(types.has('relic'), 'Relic');
  $('#game-legend').innerHTML = legends.join('') || '<span>Silence</span>';
  const p = game.interactPrompt();
  const prompt = $('#interact-prompt');
  if (p) { prompt.textContent = `${p.label}  ·  E`; prompt.classList.remove('hidden'); }
  else prompt.classList.add('hidden');
}

function showHint() {
  if (!game) return;
  const hints = game.level.hints || [game.level.tip];
  showBoardMessage(hints[hintIndex % hints.length], 4200);
  hintIndex++;
  sound.click();
}

function showBoardMessage(text, ms = 2600) {
  if (!text) return;
  const el = $('#board-message');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function showToast(text) {
  const el = $('#game-toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- RESULTS / DEATH / PAUSE ---------------- */

function finishLevel() {
  if (!game || !currentLevelId) return;
  const stats = game.stats();
  const id = currentLevelId;
  const level = LEVELS[id];
  const prev = save.levelStats[id] || {};
  const newBest = !prev.completed || stats.stars > (prev.stars || 0);
  save.levelStats[id] = {
    completed: true,
    stars: Math.max(stats.stars, prev.stars || 0),
    bestMoves: prev.bestMoves ? Math.min(prev.bestMoves, stats.moves) : stats.moves,
    shards: Math.max(stats.shards, prev.shards || 0),
    totalShards: game.shardCount,
    relic: prev.relic || stats.relic,
  };
  for (const d of stats.docs) if (!save.docs.includes(d)) save.docs.push(d);
  let newRelic = null;
  if (stats.relic && !save.relics.includes(stats.relicId)) {
    save.relics.push(stats.relicId);
    newRelic = RELICS[stats.relicId];
    if (newRelic && !save.outfits.includes(newRelic.outfit)) save.outfits.push(newRelic.outfit);
  }
  if (id === 'S-1') save.secretDone = true;
  if (!secretUnlocked() && allRelics() && save.levelStats['5-2']?.completed) { /* derived */ }
  persist();
  sound.complete();
  renderer.burst(game.state.player.x, game.state.player.y, '#ffe6ab', 40);
  showResult({ stats, level, newBest, newRelic });
}

function showResult({ stats, level, newBest, newRelic }) {
  const stars = [1, 2, 3].map((i) => `<span class="${stats.stars >= i ? 'on' : ''}">★</span>`).join('');
  openOverlay(`
    <div class="overlay-card">
      <p class="eyebrow">${level.chapter === 6 ? 'Secret chapter' : `Chapter ${CHAPTERS.find((c) => c.id === level.chapter).roman}`} · Chamber cleared</p>
      <h2>${escape(level.name)}</h2>
      <div class="result-stars">${stars}</div>
      <div class="stat-grid">
        <div><small>Moves</small><b>${stats.moves} <span style="font-size:.7rem;color:var(--muted)">/ par ${level.par}</span></b></div>
        <div><small>Echo shards</small><b>${stats.shards}/${stats.totalShards}</b></div>
        <div><small>Evidence</small><b>${stats.docs.length}</b></div>
        <div><small>Relic</small><b>${stats.relic ? 'Recovered' : '—'}</b></div>
      </div>
      ${newRelic ? `<p style="color:var(--gold2)">◈ <b>${newRelic.name}</b> recovered. Outfit unlocked: <b>${OUTFITS[newRelic.outfit].name}</b>.</p>` : ''}
      <p style="font-size:.76rem;color:var(--muted)">${stats.stars < 3 ? 'Three stars require all echo shards and a par-or-better route.' : 'A perfect reading of the chamber.'}</p>
      <div class="overlay-actions">
        <button class="btn primary" id="btn-continue-level">Continue</button>
        <button class="btn" id="btn-result-map">Campaign map</button>
        <button class="btn quiet" id="btn-result-replay">Replay chamber</button>
        <button class="btn quiet" id="btn-result-journal">Journal</button>
      </div>
    </div>`);
  $('#btn-result-map').addEventListener('click', () => { closeOverlay(); showMap(); });
  $('#btn-result-replay').addEventListener('click', () => { closeOverlay(); enterLevel(level.id, { skipIntro: true }); });
  $('#btn-result-journal').addEventListener('click', openJournal);
  $('#btn-continue-level').addEventListener('click', () => {
    closeOverlay();
    const chapter = CHAPTERS.find((c) => c.id === level.chapter);
    if (level.chapter === 5 && level.index === chapter.levels.length) { showEnding(); return; }
    if (level.chapter === 6) {
      showStory(SECRET_CHAPTER.outro, { art: 'secret', title: 'The Ninth Echo', tag: 'Secret chapter complete', onDone: showMap });
      return;
    }
    const isChapterEnd = level.index === chapter.levels.length;
    const next = nextLevel(level.id);
    if (isChapterEnd && !save.chapterOutroSeen.includes(level.chapter)) {
      save.chapterOutroSeen.push(level.chapter); persist();
      showStory(chapter.outro, {
        art: chapter.art, title: chapter.title, tag: `Chapter ${chapter.roman} · Epilogue`,
        onDone: () => { if (next && next !== 'S-1') enterLevel(next); else showMap(); },
      });
    } else if (next && next !== 'S-1') enterLevel(next);
    else showMap();
  });
}

function showEnding() {
  showStory(ENDING, {
    art: 'sanctuary', title: 'The Silence Remembered', tag: 'Finale · The Ninth Chamber',
    onDone: () => {
      save.endingSeen = true; persist();
      showCredits();
    },
  });
}

function showCredits() {
  openOverlay(`
    <div class="overlay-card wide" style="text-align:center">
      <p class="eyebrow">Shadows of the Lost Temple</p>
      <h2 style="font-size:clamp(2rem,5vw,3.4rem)">The Silence Remembered</h2>
      <div style="display:flex;justify-content:center;margin:1rem 0"><div class="sigil" style="width:70px"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="none" stroke="#d7b36a"/><path d="M60 16 L74 60 L60 104 L46 60 Z" fill="none" stroke="#d7b36a"/><circle cx="60" cy="60" r="8" fill="#d7b36a"/></svg></div></div>
      <p style="max-width:560px;margin:0 auto;font-family:var(--serif);font-size:1.1rem">Nine hundred years of silence, ended by a cartographer who knew how to read what was missing.</p>
      <div class="stat-grid" style="max-width:620px;margin:1.5rem auto">
        <div><small>Total stars</small><b>${totalStars()} / 36</b></div>
        <div><small>Relics</small><b>${relicCount()} / 5</b></div>
        <div><small>Evidence</small><b>${save.docs.length} / ${Object.keys(DOCS).length}</b></div>
        <div><small>Secret chamber</small><b>${save.secretDone ? 'Heard' : 'Sealed'}</b></div>
      </div>
      <p style="font-size:.7rem;color:var(--muted)">Original story, characters, art, and puzzles. Built for keyboard, touch, and the patient.</p>
      <div class="overlay-actions" style="justify-content:center">
        <button class="btn primary" id="btn-credits-map">Return to the map</button>
        <button class="btn" id="btn-credits-journal">Open the journal</button>
      </div>
    </div>`);
  $('#btn-credits-map').addEventListener('click', () => { closeOverlay(); showMap(); });
  $('#btn-credits-journal').addEventListener('click', openJournal);
}

function showDeath() {
  if (!game) return;
  openOverlay(`
    <div class="overlay-card" style="max-width:560px">
      <p class="eyebrow" style="color:var(--danger)">The chamber closes</p>
      <h2>${escape(game.state.deathReason || 'The temple claims another.')}</h2>
      <p style="font-size:.8rem;color:var(--muted)">The temple does not punish mistakes. It simply remembers them.</p>
      <div class="overlay-actions">
        <button class="btn primary" id="btn-death-undo">Undo the last step</button>
        <button class="btn" id="btn-death-retry">Retry chamber</button>
        <button class="btn quiet" id="btn-death-map">Campaign map</button>
      </div>
    </div>`);
  $('#btn-death-undo').addEventListener('click', undoAction);
  $('#btn-death-retry').addEventListener('click', retryLevel);
  $('#btn-death-map').addEventListener('click', () => { closeOverlay(); showMap(); });
}

function showPause() {
  if (!game || overlayOpen) return;
  const s = game.state;
  openOverlay(`
    <div class="overlay-card" style="max-width:620px">
      <p class="eyebrow">${CHAPTERS.find((c) => c.id === game.level.chapter)?.title || 'The Ninth Echo'}</p>
      <h2>${escape(game.level.name)}</h2>
      <p style="font-family:var(--serif);font-size:1.05rem">${escape(game.level.objective)}</p>
      <div class="stat-grid">
        <div><small>Moves</small><b>${s.moves}</b></div>
        <div><small>Turn</small><b>${s.turn}</b></div>
        <div><small>Shards</small><b>${s.collectedShards.length}/${game.shardCount}</b></div>
        <div><small>Par</small><b>${game.level.par}</b></div>
      </div>
      <p class="hint-box" style="border:1px solid var(--line);padding:.7rem;font-size:.75rem;color:var(--muted)">${escape(game.level.hints?.[0] || game.level.tip)}</p>
      <div class="pause-grid">
        <button class="btn primary" id="btn-resume">Resume</button>
        <button class="btn" id="btn-pause-journal">Investigation journal</button>
        <button class="btn" id="btn-pause-hint">Whisper a hint</button>
        <button class="btn" id="btn-pause-mute">${sound.muted ? 'Sound: off' : 'Sound: on'}</button>
        <button class="btn quiet" id="btn-pause-retry">Restart chamber</button>
        <button class="btn quiet" id="btn-pause-map">Return to map</button>
        <button class="btn quiet full" id="btn-pause-wardrobe">Wardrobe</button>
      </div>
    </div>`);
  $('#btn-resume').addEventListener('click', closeOverlay);
  $('#btn-pause-journal').addEventListener('click', openJournal);
  $('#btn-pause-hint').addEventListener('click', () => { closeOverlay(); showHint(); });
  $('#btn-pause-mute').addEventListener('click', () => { sound.setMuted(!sound.muted); showPause(); });
  $('#btn-pause-retry').addEventListener('click', retryLevel);
  $('#btn-pause-map').addEventListener('click', () => { closeOverlay(); showMap(); });
  $('#btn-pause-wardrobe').addEventListener('click', () => { closeOverlay(); openWardrobe(); });
}

/* ---------------- OVERLAYS & STORY ---------------- */

function openOverlay(html) {
  overlayOpen = true;
  const root = $('#overlay-root');
  root.innerHTML = `<div class="overlay">${html}</div>`;
}

function closeOverlay() {
  overlayOpen = false;
  $('#overlay-root').innerHTML = '';
}

let storyState = null;
function showStory(lines, opts = {}) {
  if (!lines || !lines.length) { opts.onDone?.(); return; }
  storyState = { lines, i: 0, opts };
  openOverlay(`
    <div class="story-card overlay-card" style="padding:0">
      <div class="story-art">${chapterArt(opts.art || 'jungle')}</div>
      <div class="story-body">
        <p class="eyebrow">${opts.tag || 'Field record'}</p>
        <h2 style="font-size:1.35rem;margin-bottom:1rem">${escape(opts.title || '')}</h2>
        <div class="story-line" id="story-line"></div>
        <div class="story-progress" id="story-progress"></div>
        <div class="overlay-actions" style="align-items:center">
          <button class="btn primary" data-story-next id="btn-story-next">Continue</button>
          <button class="btn quiet" id="btn-story-skip">Skip</button>
          <span style="font-size:.65rem;color:var(--muted)">Enter / Space</span>
        </div>
      </div>
    </div>`);
  renderStoryLine();
  $('#btn-story-next').addEventListener('click', advanceStory);
  $('#btn-story-skip').addEventListener('click', endStory);
}

function renderStoryLine() {
  if (!storyState) return;
  const { lines, i, opts } = storyState;
  const line = lines[i];
  const speakers = { Evelyn: 'var(--gold2)', Adrian: 'var(--teal)', Rook: '#e0a0a0', Narrator: 'var(--muted)' };
  const initials = line.who === 'Narrator' ? '✧' : line.who.slice(0, 1);
  $('#story-line').innerHTML = `<div class="story-speaker-row"><span class="story-medallion" style="color:${speakers[line.who] || 'var(--gold)'}">${initials}</span><div><div class="speaker" style="color:${speakers[line.who] || 'var(--gold)'}">${escape(line.who)}</div><div>${escape(line.text)}</div></div></div>`;
  $('#story-progress').innerHTML = lines.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('');
  $('#btn-story-next').textContent = i === lines.length - 1 ? 'Continue' : 'Next';
}
function advanceStory() {
  if (!storyState) return;
  sound.click();
  if (storyState.i >= storyState.lines.length - 1) { endStory(); return; }
  storyState.i++;
  renderStoryLine();
}
function endStory() {
  if (!storyState) return;
  const done = storyState.opts.onDone;
  storyState = null;
  closeOverlay();
  if (done) setTimeout(done, 40);
}

function confirmDialog(text, onYes) {
  openOverlay(`
    <div class="overlay-card" style="max-width:520px">
      <p class="eyebrow">A different path</p>
      <h2>Are you certain?</h2>
      <p>${escape(text)}</p>
      <div class="overlay-actions">
        <button class="btn primary" id="btn-confirm-yes">Yes, begin again</button>
        <button class="btn quiet" id="btn-confirm-no">Keep this expedition</button>
      </div>
    </div>`);
  $('#btn-confirm-yes').addEventListener('click', () => { closeOverlay(); onYes(); });
  $('#btn-confirm-no').addEventListener('click', closeOverlay);
}

/* ---------------- JOURNAL ---------------- */

let journalTab = 'evidence';
let threadSelection = [];
function openJournal() {
  if (!save.started) { showToast('Begin an expedition to open the journal.'); return; }
  sound.click();
  modalOpen = true;
  threadSelection = [];
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal"><div class="modal-card">
    <div class="modal-head"><h2>Investigation Journal</h2><button class="overlay-close" id="btn-journal-close" aria-label="Close">×</button></div>
    <div class="tabs">
      <button class="tab" data-jtab="evidence">Evidence · ${save.docs.length}/${Object.keys(DOCS).length}</button>
      <button class="tab" data-jtab="threads">Threads · ${save.deductions.length}/${DEDUCTIONS.length}</button>
      <button class="tab" data-jtab="story">Story</button>
    </div>
    <div class="modal-body" id="journal-body"></div>
  </div></div>`;
  $$('[data-jtab]').forEach((b) => b.addEventListener('click', () => { journalTab = b.dataset.jtab; threadSelection = []; renderJournal(); sound.click(); }));
  $('#btn-journal-close').addEventListener('click', closeModal);
  renderJournal();
}
function closeModal() { modalOpen = false; $('#modal-root').innerHTML = ''; }

function renderJournal() {
  $$('[data-jtab]').forEach((b) => b.classList.toggle('on', b.dataset.jtab === journalTab));
  const body = $('#journal-body');
  if (!body) return;
  if (journalTab === 'evidence') {
    const cards = Object.entries(DOCS).map(([id, d]) => {
      const found = save.docs.includes(id);
      return `<button class="evidence-card ${found ? '' : 'locked'}" ${found ? `data-doc="${id}"` : 'disabled'}>
        <small>${found ? escape(d.type) : 'Unrecovered'}</small>
        <b>${found ? escape(d.title) : 'A missing record'}</b>
        <p>${found ? escape(d.body.slice(0, 140)) + '…' : 'The expedition has not yet crossed this page.'}</p>
      </button>`;
    }).join('');
    body.innerHTML = `<div class="thread-hint">Documents are recovered in the field. Some doors will only open for words you have already found. Click a recovered record to read it.</div><div class="evidence-grid">${cards}</div>`;
    $$('[data-doc]', body).forEach((b) => b.addEventListener('click', () => showDocReader(b.dataset.doc)));
  } else if (journalTab === 'threads') {
    const docs = save.docs.map((id) => ({ id, ...DOCS[id] })).filter((d) => d.title);
    body.innerHTML = `
      <div class="thread-hint">Select two pieces of evidence and bind them. A true connection becomes a deduction; every deduction fills in the story. ${docs.length < 2 ? 'Recover at least two records first.' : ''}</div>
      <div class="thread-actions">
        <button class="btn primary" id="btn-bind" ${threadSelection.length === 2 ? '' : 'disabled'}>Bind the threads</button>
        <button class="btn quiet" id="btn-clear-threads" ${threadSelection.length ? '' : 'disabled'}>Clear</button>
        <span style="font-size:.68rem;color:var(--muted)">${threadSelection.length}/2 selected</span>
      </div>
      <div class="evidence-grid" style="margin-bottom:1.2rem">
        ${docs.map((d) => `<button class="evidence-card ${threadSelection.includes(d.id) ? 'sel' : ''}" data-thread="${d.id}">
          <small>${escape(d.type)}</small><b>${escape(d.title)}</b><p>${escape(d.body.slice(0, 90))}…</p>
        </button>`).join('') || '<p style="color:var(--muted)">No evidence recovered.</p>'}
      </div>
      <p class="eyebrow">Deductions</p>
      ${save.deductions.map((id) => {
        const d = DEDUCTIONS.find((x) => x.id === id);
        return d ? `<div class="deduction"><b>${escape(d.title)}</b><p>${escape(d.text)}</p></div>` : '';
      }).join('') || '<p style="color:var(--muted);font-size:.75rem">No connections made yet.</p>'}`;
    $$('[data-thread]', body).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.thread;
      if (threadSelection.includes(id)) threadSelection = threadSelection.filter((x) => x !== id);
      else if (threadSelection.length < 2) threadSelection.push(id);
      else threadSelection = [threadSelection[1], id];
      renderJournal();
    }));
    $('#btn-clear-threads')?.addEventListener('click', () => { threadSelection = []; renderJournal(); });
    $('#btn-bind')?.addEventListener('click', bindThreads);
  } else {
    const items = [];
    const seenChapters = new Set(Object.keys(save.levelStats).map((id) => LEVELS[id]?.chapter));
    for (const ch of CHAPTERS) {
      if (seenChapters.has(ch.id)) items.push({ tag: `Chapter ${ch.roman}`, title: ch.title, text: ch.blurb });
    }
    for (const rid of save.relics) {
      const r = RELICS[rid];
      if (r) items.push({ tag: 'Relic', title: r.name, text: r.blurb });
    }
    for (const did of save.deductions) {
      const d = DEDUCTIONS.find((x) => x.id === did);
      if (d) items.push({ tag: 'Deduction', title: d.title, text: d.text });
    }
    if (save.endingSeen) items.push({ tag: 'Finale', title: 'The Silence Remembered', text: 'The Engine was opened. Nine hundred names returned. Evelyn Cross walks into the morning.' });
    body.innerHTML = `<div class="timeline">${items.map((it) => `<div class="timeline-item"><small>${escape(it.tag)}</small><b>${escape(it.title)}</b><p>${escape(it.text)}</p></div>`).join('') || '<p style="color:var(--muted)">The story begins when you enter the first chamber.</p>'}</div>`;
  }
}
function showDocReader(id) {
  const d = DOCS[id];
  if (!d) return;
  const body = $('#journal-body');
  body.innerHTML = `<div class="doc-reader"><button class="btn quiet tiny" id="btn-doc-back">← Back to evidence</button><div class="doc-paper" style="margin-top:.8rem"><div class="doc-meta">${escape(d.type)} · Chapter ${d.chapter}</div><div class="doc-title">${escape(d.title)}</div>${escape(d.body)}</div></div>`;
  $('#btn-doc-back').addEventListener('click', renderJournal);
  sound.chime(720, 0.03, 1.2);
}
function bindThreads() {
  if (threadSelection.length !== 2) return;
  const found = DEDUCTIONS.find((d) => (d.pair[0] === threadSelection[0] && d.pair[1] === threadSelection[1]) || (d.pair[1] === threadSelection[0] && d.pair[0] === threadSelection[1]));
  if (!found) { sound.error(); showJournalToast('These records do not answer one another.'); return; }
  if (save.deductions.includes(found.id)) { showJournalToast('You have already bound these threads.'); return; }
  save.deductions.push(found.id); persist(); sound.relic(); threadSelection = [];
  renderJournal();
  showJournalToast(`Deduction: ${found.title}`);
}
function showJournalToast(text) {
  const b = $('#journal-body');
  if (!b) return;
  const t = document.createElement('div');
  t.className = 'deduction';
  t.style.borderColor = 'var(--gold)';
  t.innerHTML = `<b>${escape(text)}</b>`;
  b.prepend(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------------- WARDROBE ---------------- */

function openWardrobe() {
  sound.click();
  modalOpen = true;
  const unlocked = new Set(save.outfits);
  $('#modal-root').innerHTML = `<div class="modal"><div class="modal-card" style="height:auto;max-height:82dvh">
    <div class="modal-head"><h2>Wardrobe</h2><button class="overlay-close" id="btn-wardrobe-close">×</button></div>
    <div class="modal-body">
      <div class="thread-hint">Outfits are recovered with relics. They change Evelyn's field colours; the temple does not care what you wear, but the journal remembers.</div>
      <div class="outfit-grid">
        ${Object.entries(OUTFITS).map(([id, o]) => {
          const on = save.outfit === id;
          const isUnlocked = unlocked.has(id);
          const relic = Object.entries(RELICS).find(([, r]) => r.outfit === id);
          return `<button class="outfit-card ${on ? 'on' : ''} ${isUnlocked ? '' : 'locked'}" data-outfit="${id}" ${isUnlocked ? '' : 'disabled'}>
            <div class="outfit-swatch" style="--swatch:linear-gradient(135deg,${o.colors.jacket},${o.colors.shirt} 60%,${o.colors.accent})"></div>
            <b>${escape(o.name)}</b><small>${escape(o.desc)}</small>
            ${isUnlocked ? `<small style="display:block;margin-top:.4rem;color:var(--teal)">${on ? 'Wearing' : 'Wear'}</small>` : `<small style="display:block;margin-top:.4rem">Locked · ${relic ? escape(RELICS[relic[0]].name) : 'Secret'}</small>`}
          </button>`;
        }).join('')}
      </div>
    </div>
  </div></div>`;
  $('#btn-wardrobe-close').addEventListener('click', closeModal);
  $$('[data-outfit]').forEach((b) => b.addEventListener('click', () => {
    if (!unlocked.has(b.dataset.outfit)) return;
    save.outfit = b.dataset.outfit; persist(); sound.chime(660, .04, 1);
    renderer.outfitColors = Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, v.colors]));
    if (game) renderer.setGame(game);
    openWardrobe();
  }));
}

function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

/* ---------------- BOOT ---------------- */

const params = new URLSearchParams(location.search);
if (params.get('skipintro') === '1' && save.started) {
  // Development-friendly direct start; no effect on normal play.
}
init();

// Map controls
$('#btn-map-menu').addEventListener('click', () => { sound.init(); showPauseFromMap(); });
$('#btn-journal').addEventListener('click', openJournal);
$('#btn-wardrobe').addEventListener('click', openWardrobe);

function showPauseFromMap() {
  openOverlay(`<div class="overlay-card" style="max-width:520px">
    <p class="eyebrow">Expedition menu</p><h2>Shadows of the Lost Temple</h2>
    <p>Stars: ${totalStars()} · Relics: ${relicCount()}/5 · Evidence: ${save.docs.length}/${Object.keys(DOCS).length}</p>
    <div class="pause-grid">
      <button class="btn primary" id="btn-map-resume">Return</button>
      <button class="btn" id="btn-map-journal">Journal</button>
      <button class="btn" id="btn-map-wardrobe">Wardrobe</button>
      <button class="btn" id="btn-map-sound">${sound.muted ? 'Sound: off' : 'Sound: on'}</button>
      <button class="btn quiet full" id="btn-map-title">Return to title</button>
    </div>
  </div>`);
  $('#btn-map-resume').addEventListener('click', closeOverlay);
  $('#btn-map-journal').addEventListener('click', openJournal);
  $('#btn-map-wardrobe').addEventListener('click', openWardrobe);
  $('#btn-map-sound').addEventListener('click', () => { sound.setMuted(!sound.muted); showPauseFromMap(); });
  $('#btn-map-title').addEventListener('click', () => { closeOverlay(); showScreen('title'); refreshTitle(); });
}
