import {
  createInitialState,
  cloneState,
  applyMove,
  getLegalMoves,
  findKing,
  squareName,
  rowOf,
  colOf,
  powerName,
  chooseAiMove,
  ROLE_NAMES,
} from './engine.js';
import { pieceArt, powerBadge, tinyPiece } from './pieces.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  cells: $('#cells'),
  highlights: $('#highlights'),
  pieceLayer: $('#pieceLayer'),
  board: $('#board'),
  boardRig: $('#boardRig'),
  swapPop: $('#swapPop'),
  whitePlayer: $('#whitePlayer'),
  blackPlayer: $('#blackPlayer'),
  statusKicker: $('#statusKicker'),
  statusSub: $('#statusSub'),
  statusTitle: $('#statusTitle'),
  statusDescription: $('#statusDescription'),
  turnOrb: $('#turnOrb'),
  checkChip: $('#checkChip'),
  moveCount: $('#moveCount'),
  modePill: $('#modePill'),
  modeLabel: $('#modeLabel'),
  levelLabel: $('#levelLabel'),
  captureFeed: $('#captureFeed'),
  swapTag: $('#swapTag'),
  capturedByWhite: $('#capturedByWhite'),
  capturedByBlack: $('#capturedByBlack'),
  moveLog: $('#moveLog'),
  moveLogMobile: $('#moveLogMobile'),
  mobileCapture: $('#mobileCapture'),
  mobileCaptureText: $('#mobileCaptureText'),
  mobileSwapTag: $('#mobileSwapTag'),
  mobileCaptureFeed: $('#mobileCaptureFeed'),
  mobileCapturedByWhite: $('#mobileCapturedByWhite'),
  mobileCapturedByBlack: $('#mobileCapturedByBlack'),
  undoBtn: $('#undoBtn'),
  undoBtnMobile: $('#undoBtnMobile'),
  newBtn: $('#newBtn'),
  newBtnMobile: $('#newBtnMobile'),
  soloBtn: $('#soloBtn'),
  localBtn: $('#localBtn'),
  casualBtn: $('#casualBtn'),
  sharpBtn: $('#sharpBtn'),
  settingsBtn: $('#settingsBtn'),
  settingsDialog: $('#settingsDialog'),
  settingsClose: $('#settingsClose'),
  settingsDone: $('#settingsDone'),
  settingsSolo: $('#settingsSolo'),
  settingsLocal: $('#settingsLocal'),
  settingsCasual: $('#settingsCasual'),
  settingsSharp: $('#settingsSharp'),
  tiltBtn: $('#tiltBtn'),
  tiltBtnMobile: $('#tiltBtnMobile'),
  soundBtn: $('#soundBtn'),
  rulesBtn: $('#rulesBtn'),
  rulesDialog: $('#rulesDialog'),
  rulesClose: $('#rulesClose'),
  rulesPlay: $('#rulesPlay'),
  movesBtnMobile: $('#movesBtnMobile'),
  movesDialog: $('#movesDialog'),
  movesClose: $('#movesClose'),
  gameOver: $('#gameOver'),
  gameOverKicker: $('#gameOverKicker'),
  gameOverTitle: $('#gameOverTitle'),
  gameOverText: $('#gameOverText'),
  playAgainBtn: $('#playAgainBtn'),
  reviewBtn: $('#reviewBtn'),
  toast: $('#toast'),
};

const COLOR_NAMES = { w: 'Ivory', b: 'Obsidian' };
const ROLE_GLYPHS = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

let state = createInitialState();
let selected = null;
let legalForSelected = [];
let mode = 'ai';
let difficulty = 'sharp';
let soundOn = true;
let aiThinking = false;
let undoStack = [];
let pendingAiTimer = null;
let tiltEnabled = false;
let tiltBaseline = null;
let audioContext = null;
let toastTimer = null;
let gameOverTimer = null;
let capturedRemovalTimers = new WeakMap();
let cellElements = [];
let pieceNodes = new Map();
let isReady = false;

/* ------------------------------------------------------------------ board */

function buildBoard() {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const index = row * 8 + col;
      const cell = document.createElement('div');
      cell.className = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '-1');
      cell.addEventListener('click', () => onCellClick(index));

      if (row === 7) {
        const file = document.createElement('span');
        file.className = 'coord coord-file';
        file.textContent = 'abcdefgh'[col];
        cell.append(file);
      }
      if (col === 0) {
        const rank = document.createElement('span');
        rank.className = 'coord coord-rank';
        rank.textContent = String(8 - row);
        cell.append(rank);
      }

      els.cells.append(cell);
      cellElements.push(cell);
    }
  }
}

function renderAll(options = {}) {
  if (options.resetPieces) {
    for (const node of pieceNodes.values()) node.remove();
    pieceNodes.clear();
  }
  renderPieces(options);
  renderCells();
  renderStatus();
  renderCapture();
  renderLog();
  renderMode();
  updateUndoState();
}

function renderPieces(options = {}) {
  const positions = new Map();
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (piece) positions.set(piece.id, { piece, index });
  }

  const captureTargets = new Set(
    legalForSelected.filter((move) => move.capture).map((move) => move.to),
  );

  for (const [id, node] of [...pieceNodes.entries()]) {
    const entry = positions.get(id);
    if (!entry) {
      node.classList.add('captured');
      const timer = capturedRemovalTimers.get(node);
      if (timer) clearTimeout(timer);
      capturedRemovalTimers.set(node, window.setTimeout(() => {
        node.remove();
        if (pieceNodes.get(id) === node) pieceNodes.delete(id);
      }, 340));
      continue;
    }

    const timer = capturedRemovalTimers.get(node);
    if (timer) {
      clearTimeout(timer);
      capturedRemovalTimers.delete(node);
      node.classList.remove('captured');
    }

    const { piece, index } = entry;
    const previousPower = node.dataset.power;
    const previousSquare = node.dataset.square;
    node.style.setProperty('--row', String(rowOf(index)));
    node.style.setProperty('--col', String(colOf(index)));
    node.dataset.square = String(index);
    node.dataset.power = piece.power;
    node.dataset.role = piece.role;
    node.classList.toggle('has-power', piece.power !== piece.role);
    node.classList.toggle('selected', selected === index);
    node.classList.toggle('can-capture', captureTargets.has(index));
    node.classList.toggle('thinking', aiThinking && piece.color === 'b' && mode === 'ai');

    const badge = node.querySelector('.power-badge');
    if (badge) badge.textContent = piece.power.toUpperCase();

    if (previousPower && previousPower !== piece.power) {
      node.classList.remove('just-swapped');
      void node.offsetWidth;
      node.classList.add('just-swapped');
      node.classList.add('badge-pulse');
      window.setTimeout(() => node.classList.remove('badge-pulse'), 720);
    }

    if (previousSquare != null && previousSquare !== String(index)) {
      node.classList.remove('just-moved');
      void node.offsetWidth;
      node.classList.add('just-moved');
      window.setTimeout(() => node.classList.remove('just-moved'), 380);
    }

    node.setAttribute(
      'aria-label',
      `${COLOR_NAMES[piece.color]} ${ROLE_NAMES[piece.role]} on ${squareName(index)}, moves as ${powerName(piece.power)}`,
    );
  }

  for (const [id, { piece, index }] of positions) {
    if (pieceNodes.has(id)) continue;
    const node = createPieceNode(piece, index);
    els.pieceLayer.append(node);
    pieceNodes.set(id, node);
  }
}

function createPieceNode(piece, index) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `piece ${piece.color}`;
  node.dataset.id = piece.id;
  node.dataset.role = piece.role;
  node.dataset.power = piece.power;
  node.dataset.square = String(index);
  node.style.setProperty('--row', String(rowOf(index)));
  node.style.setProperty('--col', String(colOf(index)));
  node.classList.toggle('has-power', piece.power !== piece.role);
  node.innerHTML = `${pieceArt(piece.role, piece.color)}${powerBadge(piece.power)}`;
  node.setAttribute(
    'aria-label',
    `${COLOR_NAMES[piece.color]} ${ROLE_NAMES[piece.role]} on ${squareName(index)}, moves as ${powerName(piece.power)}`,
  );
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    onPieceClick(Number(node.dataset.square));
  });
  return node;
}

function renderCells() {
  const targetMap = new Map(legalForSelected.map((move) => [move.to, move]));
  const last = state.lastMove;
  const kingSquare = state.check ? findKing(state, state.turn) : -1;

  for (let index = 0; index < 64; index += 1) {
    const cell = cellElements[index];
    const move = targetMap.get(index);
    cell.classList.toggle('selected', selected === index);
    cell.classList.toggle('legal', Boolean(move));
    cell.classList.toggle('legal-capture', Boolean(move && move.capture));
    cell.classList.toggle('last-from', Boolean(last && last.from === index));
    cell.classList.toggle('last-to', Boolean(last && last.to === index));
    cell.classList.toggle('check', index === kingSquare);

    const piece = state.board[index];
    const label = piece
      ? `${squareName(index)}, ${COLOR_NAMES[piece.color]} ${ROLE_NAMES[piece.role]}`
      : `${squareName(index)}, empty`;
    cell.setAttribute('aria-label', label);
  }
}

/* --------------------------------------------------------------- rendering */

function renderStatus() {
  const player = COLOR_NAMES[state.turn];
  const isCheck = Boolean(state.check);
  const over = state.status.over;

  els.whitePlayer.classList.toggle('is-active', state.turn === 'w' && !over);
  els.blackPlayer.classList.toggle('is-active', state.turn === 'b' && !over);
  els.turnOrb.className = `turn-orb ${state.turn === 'w' ? 'white' : 'black'}`;
  els.moveCount.textContent = `MOVE ${state.fullmove}`;

  let kicker = `${state.turn === 'w' ? 'WHITE' : 'BLACK'} TO MOVE`;
  if (over) kicker = 'GAME OVER';
  else if (aiThinking) kicker = 'OBSIDIAN THINKING';

  let title = `${player} to move`;
  let description = 'Choose a piece. Its badge shows how it moves.';
  let sub = 'Tap a piece to begin';

  if (over) {
    if (state.status.reason === 'checkmate') {
      title = `${COLOR_NAMES[state.status.result]} wins`;
      description = 'Checkmate. The king has no legal escape.';
      sub = `Checkmate · ${state.status.reason}`;
    } else {
      title = 'Draw';
      description = `The game ends by ${state.status.reason}.`;
      sub = `Draw · ${state.status.reason}`;
    }
  } else if (isCheck) {
    title = `${player} in check`;
    description = 'The king is under attack. Move it, block, or capture the attacker.';
    sub = 'King in check';
  } else if (selected != null && state.board[selected]) {
    const piece = state.board[selected];
    const powerText = piece.power === piece.role
      ? `${ROLE_NAMES[piece.power]} movement`
      : `moves as ${powerName(piece.power)}`;
    title = `${ROLE_NAMES[piece.role]} selected`;
    description = `${powerText} · ${legalForSelected.length} legal ${legalForSelected.length === 1 ? 'square' : 'squares'}.`;
    sub = legalForSelected.length
      ? 'Tap a highlighted square'
      : 'No legal moves for this piece';
  } else if (aiThinking) {
    title = 'Obsidian is thinking';
    description = 'The CPU is weighing captures, checks, and power swaps.';
    sub = 'Reading the board…';
  }

  els.statusKicker.textContent = kicker;
  els.statusSub.textContent = sub;
  els.statusTitle.textContent = title;
  els.statusDescription.textContent = description;

  if (isCheck || (over && state.status.reason === 'checkmate')) {
    els.checkChip.hidden = false;
    els.checkChip.textContent = over ? 'MATE' : 'CHECK';
  } else {
    els.checkChip.hidden = true;
  }
}

function renderCapture() {
  const lastCapture = state.moveLog.slice().reverse().find((entry) => entry.capture && entry.captured);
  const totalCaptures = state.captured.w.length + state.captured.b.length;
  const emptyFeed = '<span class="capture-empty">The board is still balanced. Make the first move.</span>';

  if (lastCapture) {
    const victim = lastCapture.captured;
    const feed = captureFeedMarkup(lastCapture);
    const tag = `SWAP ${String(totalCaptures).padStart(2, '0')}`;
    els.captureFeed.innerHTML = feed;
    els.mobileCaptureFeed.innerHTML = captureFeedMarkup(lastCapture);
    els.swapTag.textContent = tag;
    els.mobileSwapTag.textContent = tag;
    els.mobileCaptureText.textContent = `${ROLE_NAMES[victim.role]} taken · ${ROLE_NAMES[lastCapture.role]} now moves as ${powerName(lastCapture.powerAfter)}`;
  } else {
    els.captureFeed.innerHTML = emptyFeed;
    els.mobileCaptureFeed.innerHTML = emptyFeed;
    els.swapTag.textContent = 'NO SWAPS YET';
    els.mobileSwapTag.textContent = 'NO SWAPS YET';
    els.mobileCaptureText.textContent = "Every capture rewrites a piece's movement.";
  }

  els.capturedByWhite.innerHTML = capturedListHTML(state.captured.b);
  els.capturedByBlack.innerHTML = capturedListHTML(state.captured.w);
  els.mobileCapturedByWhite.innerHTML = capturedListHTML(state.captured.b);
  els.mobileCapturedByBlack.innerHTML = capturedListHTML(state.captured.w);
}

function captureFeedMarkup(last) {
  const victim = last.captured;
  return `
    <div class="swap-line">
      ${tinyPiece(victim.role, victim.color)}
      <span class="swap-x">×</span>
      ${tinyPiece(last.role, last.color)}
      <span class="swap-arrow">→</span>
      <span class="swap-power">${last.powerAfter.toUpperCase()}</span>
      <span class="swap-copy"><strong>${ROLE_NAMES[last.role]}</strong> now moves as <strong>${powerName(last.powerAfter)}</strong></span>
    </div>
  `;
}

function capturedListHTML(list) {
  if (!list.length) return '<span class="captured-none">—</span>';
  return list.map((piece) => tinyPiece(piece.role, piece.color)).join('');
}

function renderLog() {
  const html = state.moveLog.length ? state.moveLog.map((entry) => {
    const num = entry.color === 'w' ? `${Math.ceil(entry.ply / 2)}.` : '';
    const moveText = entry.castle
      ? (entry.castle === 'king' ? 'O-O' : 'O-O-O')
      : `${squareName(entry.from)}${entry.capture ? '×' : '–'}${squareName(entry.to)}${entry.promotion ? '=Q' : ''}`;
    const suffix = entry.check ? (entry.mate ? '#' : '+') : '';
    const swap = entry.capture
      ? `<span class="log-swap">⇄<span class="log-badge">${entry.powerAfter.toUpperCase()}</span></span>`
      : '';
    return `
      <div class="log-row">
        <span class="log-num">${num}</span>
        <span class="log-icon">${tinyPiece(entry.role, entry.color)}</span>
        <span class="log-move ${entry.check ? 'log-check' : ''}">${moveText}${suffix}</span>
        ${swap}
      </div>
    `;
  }).join('') : '<div class="log-empty">No moves yet. White opens.</div>';

  els.moveLog.innerHTML = html;
  els.moveLogMobile.innerHTML = html;
  requestAnimationFrame(() => {
    els.moveLog.scrollTop = els.moveLog.scrollHeight;
    els.moveLogMobile.scrollTop = els.moveLogMobile.scrollHeight;
  });
}

function renderMode() {
  els.modeLabel.textContent = mode === 'ai' ? 'SOLO' : '2P';
  els.levelLabel.textContent = mode === 'ai' ? (difficulty === 'sharp' ? 'SHARP' : 'CASUAL') : 'LOCAL';

  els.soloBtn.classList.toggle('is-active', mode === 'ai');
  els.localBtn.classList.toggle('is-active', mode === 'local');
  els.soloBtn.setAttribute('aria-pressed', String(mode === 'ai'));
  els.localBtn.setAttribute('aria-pressed', String(mode === 'local'));

  els.casualBtn.classList.toggle('is-active', difficulty === 'casual');
  els.sharpBtn.classList.toggle('is-active', difficulty === 'sharp');
  els.casualBtn.setAttribute('aria-pressed', String(difficulty === 'casual'));
  els.sharpBtn.setAttribute('aria-pressed', String(difficulty === 'sharp'));

  if (els.settingsSolo) {
    els.settingsSolo.classList.toggle('is-active', mode === 'ai');
    els.settingsLocal.classList.toggle('is-active', mode === 'local');
    els.settingsSolo.setAttribute('aria-pressed', String(mode === 'ai'));
    els.settingsLocal.setAttribute('aria-pressed', String(mode === 'local'));
    els.settingsCasual.classList.toggle('is-active', difficulty === 'casual');
    els.settingsSharp.classList.toggle('is-active', difficulty === 'sharp');
    els.settingsCasual.setAttribute('aria-pressed', String(difficulty === 'casual'));
    els.settingsSharp.setAttribute('aria-pressed', String(difficulty === 'sharp'));
  }

  const tiltLabel = tiltEnabled ? 'Motion tilt on' : 'Motion tilt';
  els.tiltBtn.classList.toggle('is-on', tiltEnabled);
  els.tiltBtn.setAttribute('aria-pressed', String(tiltEnabled));
  els.tiltBtn.querySelector('strong').textContent = tiltLabel;
  els.tiltBtnMobile.classList.toggle('is-on', tiltEnabled);
  els.tiltBtnMobile.setAttribute('aria-pressed', String(tiltEnabled));
}

function updateUndoState() {
  const disabled = aiThinking || undoStack.length === 0;
  els.undoBtn.disabled = disabled;
  els.undoBtnMobile.disabled = disabled;
}

/* --------------------------------------------------------------- gameplay */

function canInteract() {
  if (!isReady || state.status.over || aiThinking) return false;
  if (mode === 'ai' && state.turn !== 'w') return false;
  return true;
}

function onPieceClick(index) {
  const piece = state.board[index];
  if (!piece) return;
  if (!canInteract()) {
    if (aiThinking) showToast('Obsidian is still thinking.');
    return;
  }

  if (selected != null) {
    const move = legalForSelected.find((candidate) => candidate.to === index);
    if (move) {
      commitMove(move);
      return;
    }
  }

  if (piece.color !== state.turn) {
    if (selected != null) showToast('That piece belongs to the other side.');
    return;
  }

  if (selected === index) {
    clearSelection();
    return;
  }
  selectPiece(index);
}

function onCellClick(index) {
  if (!canInteract()) return;
  if (selected != null) {
    const move = legalForSelected.find((candidate) => candidate.to === index);
    if (move) {
      commitMove(move);
      return;
    }
  }
  if (state.board[index]) {
    onPieceClick(index);
  } else {
    clearSelection();
  }
}

function selectPiece(index) {
  const piece = state.board[index];
  if (!piece || piece.color !== state.turn) return;
  selected = index;
  legalForSelected = getLegalMoves(state, state.turn).filter((move) => move.from === index);
  playSound(legalForSelected.length ? 'select' : 'deny');
  if (!legalForSelected.length) showToast(`${ROLE_NAMES[piece.role]} has no legal move right now.`);
  renderPieces();
  renderCells();
  renderStatus();
}

function clearSelection() {
  if (selected == null) return;
  selected = null;
  legalForSelected = [];
  renderPieces();
  renderCells();
  renderStatus();
}

function commitMove(move) {
  if (!move) return;
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }

  undoStack.push(cloneState(state));
  const capture = Boolean(move.captured);
  const promotion = Boolean(move.promotion);
  state = applyMove(state, move);
  selected = null;
  legalForSelected = [];
  aiThinking = false;
  renderAll({ justMoved: move });

  if (capture) {
    showSwapPop(state.lastMove);
    vibrate(18);
    playSound('capture');
  } else {
    playSound('move');
  }

  if (promotion) {
    showToast('Promotion — that piece now moves as a queen.');
  }
  if (state.check && !state.status.over) {
    playSound('check');
    window.setTimeout(() => showToast('Check. The king must answer.'), 420);
  }
  if (state.status.over) {
    gameOverTimer = window.setTimeout(showGameOver, 620);
  } else if (mode === 'ai' && state.turn === 'b') {
    scheduleAi();
  }
}

function scheduleAi() {
  if (mode !== 'ai' || state.turn !== 'b' || state.status.over) return;
  if (pendingAiTimer) clearTimeout(pendingAiTimer);
  aiThinking = true;
  renderAll();
  pendingAiTimer = window.setTimeout(() => {
    pendingAiTimer = null;
    if (mode !== 'ai' || state.turn !== 'b' || state.status.over) {
      aiThinking = false;
      renderAll();
      return;
    }
    const depth = difficulty === 'sharp' ? 3 : 1;
    const budget = difficulty === 'sharp' ? 1200 : 350;
    const move = chooseAiMove(state, { maxDepth: depth, timeBudget: budget });
    aiThinking = false;
    if (move) {
      commitMove(move);
    } else {
      renderAll();
    }
  }, 430 + Math.random() * 260);
}

function undo() {
  if (aiThinking) {
    showToast('Wait for Obsidian to finish its move.');
    return;
  }
  if (!undoStack.length) {
    showToast('Nothing to undo yet.');
    return;
  }
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }
  if (pendingAiTimer) {
    clearTimeout(pendingAiTimer);
    pendingAiTimer = null;
  }

  let snapshot;
  if (mode === 'ai' && state.turn === 'w' && undoStack.length >= 2) {
    undoStack.pop();
    snapshot = undoStack.pop();
  } else {
    snapshot = undoStack.pop();
  }
  if (!snapshot) return;
  state = cloneState(snapshot);
  selected = null;
  legalForSelected = [];
  aiThinking = false;
  hideGameOver();
  renderAll();
  playSound('undo');
  showToast('Move undone.');
}

function newGame() {
  if (pendingAiTimer) {
    clearTimeout(pendingAiTimer);
    pendingAiTimer = null;
  }
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }
  state = createInitialState();
  selected = null;
  legalForSelected = [];
  undoStack = [];
  aiThinking = false;
  hideGameOver();
  renderAll({ resetPieces: true });
  playSound('new');
  showToast('New game. Ivory opens.');
}

/* ------------------------------------------------------------------- sound */

function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playSound(kind) {
  if (!soundOn) return;
  const context = ensureAudio();
  if (!context) return;
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.11, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  master.connect(context.destination);

  const tones = {
    select: [[540, 0, 0.05, 'sine', 0.018]],
    move: [[250, 0, 0.08, 'triangle', 0.025], [360, 0.02, 0.08, 'sine', 0.014]],
    capture: [[180, 0, 0.16, 'sawtooth', 0.026], [112, 0.045, 0.22, 'triangle', 0.03], [420, 0.08, 0.12, 'sine', 0.015]],
    check: [[680, 0, 0.12, 'sine', 0.02], [900, 0.09, 0.16, 'sine', 0.016]],
    undo: [[430, 0, 0.08, 'sine', 0.016], [320, 0.05, 0.1, 'sine', 0.014]],
    deny: [[160, 0, 0.08, 'square', 0.012]],
    new: [[360, 0, 0.1, 'sine', 0.02], [540, 0.06, 0.14, 'sine', 0.018], [720, 0.12, 0.18, 'sine', 0.016]],
    win: [[520, 0, 0.18, 'sine', 0.022], [660, 0.08, 0.22, 'sine', 0.022], [880, 0.17, 0.3, 'sine', 0.02]],
  };
  for (const [frequency, offset, duration, type, gainValue] of tones[kind] || tones.select) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + duration + 0.02);
  }
  window.setTimeout(() => master.disconnect(), 650);
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ---------------------------------------------------------------- overlays */

function showSwapPop(move) {
  if (!move.captured) return;
  const left = ((colOf(move.to) + 0.5) / 8) * 100;
  const top = ((rowOf(move.to) + 0.5) / 8) * 100;
  els.swapPop.style.left = `${left}%`;
  els.swapPop.style.top = `${top}%`;
  els.swapPop.innerHTML = `
    ${tinyPiece(move.captured.role, move.captured.color)}
    <span class="swap-x">×</span>
    ${tinyPiece(move.role, move.color)}
    <span class="swap-arrow">→</span>
    <span class="swap-power">${move.powerAfter.toUpperCase()}</span>
  `;
  els.swapPop.classList.remove('show');
  void els.swapPop.offsetWidth;
  els.swapPop.classList.add('show');
}

function showGameOver() {
  if (!state.status.over) return;
  const result = state.status.result;
  const reason = state.status.reason;
  if (reason === 'checkmate') {
    els.gameOverKicker.textContent = 'CHECKMATE';
    els.gameOverTitle.textContent = `${COLOR_NAMES[result]} wins.`;
    els.gameOverText.textContent = result === 'w'
      ? 'Obsidian’s king has nowhere left to go.'
      : 'Ivory’s king has nowhere left to go.';
  } else {
    els.gameOverKicker.textContent = 'DRAW';
    els.gameOverTitle.textContent = 'A quiet board.';
    els.gameOverText.textContent = `The game ends by ${reason}.`;
  }
  els.gameOver.hidden = false;
  playSound(reason === 'checkmate' ? 'win' : 'move');
}

function hideGameOver() {
  els.gameOver.hidden = true;
}

function showToast(message, duration = 1900) {
  if (toastTimer) clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('show');
    toastTimer = null;
  }, duration);
}

/* -------------------------------------------------------------------- tilt */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function toggleTilt() {
  if (tiltEnabled) {
    disableTilt();
    return;
  }
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    showToast('This device has no motion sensor.');
    return;
  }

  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        showToast('Motion access was not granted.');
        return;
      }
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
    tiltBaseline = null;
    tiltEnabled = true;
    renderMode();
    playSound('select');
    showToast('Tilt enabled. Move your device to shift the board.');
  } catch (error) {
    showToast('Motion access is unavailable in this browser.');
  }
}

function disableTilt() {
  window.removeEventListener('deviceorientation', handleOrientation, true);
  tiltEnabled = false;
  tiltBaseline = null;
  els.boardRig.style.setProperty('--tilt-x', '0deg');
  els.boardRig.style.setProperty('--tilt-y', '0deg');
  renderMode();
  showToast('Tilt disabled.');
}

function handleOrientation(event) {
  if (!tiltEnabled || event.beta == null || event.gamma == null) return;
  if (!tiltBaseline) {
    tiltBaseline = { beta: event.beta, gamma: event.gamma };
    return;
  }
  const tiltY = clamp((event.gamma - tiltBaseline.gamma) * 0.16, -6.5, 6.5);
  const tiltX = clamp((event.beta - tiltBaseline.beta) * 0.11, -5.5, 5.5);
  els.boardRig.style.setProperty('--tilt-x', `${-tiltX}deg`);
  els.boardRig.style.setProperty('--tilt-y', `${tiltY}deg`);
}

/* ------------------------------------------------------------------ setup */

function bindEvents() {
  els.newBtn.addEventListener('click', newGame);
  els.newBtnMobile.addEventListener('click', newGame);
  els.undoBtn.addEventListener('click', undo);
  els.undoBtnMobile.addEventListener('click', undo);

  els.soloBtn.addEventListener('click', () => setMode('ai'));
  els.localBtn.addEventListener('click', () => setMode('local'));
  els.casualBtn.addEventListener('click', () => setDifficulty('casual'));
  els.sharpBtn.addEventListener('click', () => setDifficulty('sharp'));
  els.settingsSolo.addEventListener('click', () => setMode('ai'));
  els.settingsLocal.addEventListener('click', () => setMode('local'));
  els.settingsCasual.addEventListener('click', () => setDifficulty('casual'));
  els.settingsSharp.addEventListener('click', () => setDifficulty('sharp'));

  els.settingsBtn.addEventListener('click', () => {
    if (!els.settingsDialog.open) els.settingsDialog.showModal();
    playSound('select');
  });
  els.settingsClose.addEventListener('click', () => els.settingsDialog.close());
  els.settingsDone.addEventListener('click', () => els.settingsDialog.close());
  els.settingsDialog.addEventListener('click', (event) => {
    if (event.target === els.settingsDialog) els.settingsDialog.close();
  });

  els.soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    document.body.classList.toggle('is-muted', !soundOn);
    els.soundBtn.setAttribute('aria-pressed', String(soundOn));
    els.soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
    if (soundOn) playSound('select');
  });

  els.tiltBtn.addEventListener('click', toggleTilt);
  els.tiltBtnMobile.addEventListener('click', toggleTilt);

  const openRules = () => {
    if (!els.rulesDialog.open) els.rulesDialog.showModal();
    playSound('select');
  };
  els.rulesBtn.addEventListener('click', openRules);
  els.rulesClose.addEventListener('click', () => els.rulesDialog.close());
  els.rulesPlay.addEventListener('click', () => els.rulesDialog.close());
  els.rulesDialog.addEventListener('click', (event) => {
    if (event.target === els.rulesDialog) els.rulesDialog.close();
  });

  const openMoves = () => {
    renderLog();
    if (!els.movesDialog.open) els.movesDialog.showModal();
    playSound('select');
  };
  els.movesBtnMobile.addEventListener('click', openMoves);
  els.movesClose.addEventListener('click', () => els.movesDialog.close());
  els.movesDialog.addEventListener('click', (event) => {
    if (event.target === els.movesDialog) els.movesDialog.close();
  });

  els.playAgainBtn.addEventListener('click', newGame);
  els.reviewBtn.addEventListener('click', hideGameOver);

  document.addEventListener('pointerdown', () => ensureAudio(), { once: true, passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (els.rulesDialog.open) els.rulesDialog.close();
      else if (els.settingsDialog.open) els.settingsDialog.close();
      else if (els.movesDialog.open) els.movesDialog.close();
      else if (selected != null) clearSelection();
    }
    if (event.key.toLowerCase() === 'u' && !event.metaKey && !event.ctrlKey) undo();
    if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey) newGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (pendingAiTimer) {
        clearTimeout(pendingAiTimer);
        pendingAiTimer = null;
        aiThinking = false;
      }
      return;
    }
    // Resume an interrupted CPU turn when the player comes back to the tab.
    if (mode === 'ai' && state.turn === 'b' && !state.status.over && !pendingAiTimer) {
      scheduleAi();
    }
  });
}

function setMode(nextMode) {
  if (mode === nextMode) return;
  mode = nextMode;
  if (pendingAiTimer) {
    clearTimeout(pendingAiTimer);
    pendingAiTimer = null;
  }
  aiThinking = false;
  clearSelection();
  renderMode();
  renderStatus();
  updateUndoState();
  playSound('select');
  if (mode === 'local') {
    showToast('Two-player mode. Pass the device after each move.');
  } else {
    showToast('Solo mode. You play Ivory against Obsidian.');
    if (state.turn === 'b' && !state.status.over) scheduleAi();
  }
}

function setDifficulty(nextDifficulty) {
  if (difficulty === nextDifficulty) return;
  difficulty = nextDifficulty;
  renderMode();
  playSound('select');
  showToast(nextDifficulty === 'sharp' ? 'Obsidian is playing sharp.' : 'Obsidian is playing casual.');
}

function init() {
  buildBoard();
  bindEvents();
  renderAll({ resetPieces: true });
  isReady = true;
  requestAnimationFrame(() => document.body.classList.add('is-ready'));
}

init();
