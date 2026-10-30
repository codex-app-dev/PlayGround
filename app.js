import {
  FILES,
  POWER_META,
  chooseMove,
  createGame,
  findKing,
  isInCheck,
  legalMoves,
  makeMove,
  material,
  movesFrom,
  parseSquare,
  squareName,
} from './engine/engine.js';

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const boardEl = $('board');
const board3d = $('board3d');
const squaresEl = $('squares');
const piecesEl = $('pieces');
const turnPill = $('turnPill');
const turnText = $('turnText');
const turnChip = $('turnChip');
const swapCountText = $('swapCountText');
const plyCount = $('plyCount');
const hintText = $('hintText');
const playersEl = $('players');
const whiteSub = $('whiteSub');
const blackSub = $('blackSub');
const whiteScore = $('whiteScore');
const blackScore = $('blackScore');
const materialNote = $('materialNote');
const modeChip = $('modeChip');
const feedEl = $('feed');
const feedEmpty = $('feedEmpty');
const captureCount = $('captureCount');
const undoBtn = $('undoBtn');
const flipBtn = $('flipBtn');
const newBtn = $('newBtn');
const soundBtn = $('soundBtn');
const tiltBtn = $('tiltBtn');
const tiltPill = $('tiltPill');
const helpBtn = $('helpBtn');
const footerHelp = $('footerHelp');
const coach = $('coach');
const coachClose = $('coachClose');
const toastEl = $('toast');
const announcer = $('announcer');
const rulesDialog = $('rulesDialog');
const overDialog = $('overDialog');
const overKicker = $('overKicker');
const overTitle = $('overTitle');
const overText = $('overText');
const overStats = $('overStats');
const overMark = $('overMark');
const rematchBtn = $('rematchBtn');
const reviewBtn = $('reviewBtn');

const POWER_LETTER = {
  pawn: 'P',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
};

const SIDE_NAME = { w: 'White', b: 'Black' };
const sideName = (side) => SIDE_NAME[side];
const otherSide = (side) => (side === 'w' ? 'b' : 'w');
const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readSetting(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let state = createGame();
let timeline = [{ state, records: [] }];
let selected = null;
let currentMoves = [];
let flipped = false;
let mode = readSetting('swapchess.mode', '2p') === 'bot' ? 'bot' : '2p';
let soundOn = readSetting('swapchess.sound', 'on') !== 'off';
let busy = false;
let botToken = 0;
let botTimer = 0;
let overShown = false;
let focusRC = { r: 6, c: 4 };
let pieceEls = new Map();
let squareEls = new Map();
let toastTimer = 0;
let announceTimer = 0;

const records = () => timeline[timeline.length - 1].records;
const swapTotal = () => records().filter((record) => record.swap).length;
const gameOver = () => state.status === 'checkmate' || state.status === 'stalemate';
const isBotTurn = () => mode === 'bot' && state.turn === 'b' && !gameOver();

/* ------------------------------------------------------------------ */
/* Sound                                                               */
/* ------------------------------------------------------------------ */

let audioContext = null;

function ensureAudio() {
  if (!soundOn) return null;
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function tone({ freq, dur = 0.08, type = 'sine', gain = 0.03, slideTo = null, delay = 0 }) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

const sfx = {
  select() {
    tone({ freq: 620, dur: 0.04, type: 'triangle', gain: 0.014, slideTo: 760 });
  },
  move() {
    tone({ freq: 190, dur: 0.09, type: 'triangle', gain: 0.03, slideTo: 150 });
    tone({ freq: 88, dur: 0.1, type: 'sine', gain: 0.022, delay: 0.005 });
  },
  capture() {
    tone({ freq: 330, dur: 0.14, type: 'sawtooth', gain: 0.025, slideTo: 120 });
    tone({ freq: 840, dur: 0.07, type: 'sine', gain: 0.02, delay: 0.03 });
    tone({ freq: 1260, dur: 0.06, type: 'sine', gain: 0.014, delay: 0.08 });
  },
  check() {
    tone({ freq: 132, dur: 0.22, type: 'sawtooth', gain: 0.02, slideTo: 116 });
    tone({ freq: 264, dur: 0.12, type: 'sine', gain: 0.012, delay: 0.02 });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone({ freq, dur: 0.22, type: 'sine', gain: 0.024, delay: i * 0.085 });
    });
  },
  draw() {
    tone({ freq: 392, dur: 0.2, type: 'sine', gain: 0.02 });
    tone({ freq: 329.63, dur: 0.28, type: 'sine', gain: 0.018, delay: 0.12 });
  },
  undo() {
    tone({ freq: 300, dur: 0.08, type: 'triangle', gain: 0.02, slideTo: 210 });
  },
  start() {
    tone({ freq: 392, dur: 0.08, type: 'sine', gain: 0.02 });
    tone({ freq: 587.33, dur: 0.12, type: 'sine', gain: 0.018, delay: 0.07 });
  },
  error() {
    tone({ freq: 150, dur: 0.09, type: 'square', gain: 0.014, slideTo: 120 });
  },
};

function vibrate(pattern) {
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */

function toast(message, ms = 2400) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), ms);
}

function announce(message) {
  clearTimeout(announceTimer);
  announcer.textContent = '';
  announceTimer = window.setTimeout(() => {
    announcer.textContent = message;
  }, 30);
}

function formatPoints(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

function openDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (!dialog.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

/* ------------------------------------------------------------------ */
/* Board construction                                                  */
/* ------------------------------------------------------------------ */

function buildSquares() {
  squaresEl.replaceChildren();
  squareEls.clear();
  const fragment = document.createDocumentFragment();

  for (let visualRow = 0; visualRow < 8; visualRow += 1) {
    for (let visualCol = 0; visualCol < 8; visualCol += 1) {
      const r = flipped ? 7 - visualRow : visualRow;
      const c = flipped ? 7 - visualCol : visualCol;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
      button.dataset.r = String(r);
      button.dataset.c = String(c);
      button.dataset.square = squareName(r, c);
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', squareName(r, c));
      button.tabIndex = -1;

      if (visualRow === 7) {
        const file = document.createElement('span');
        file.className = 'coord file';
        file.textContent = FILES[c];
        button.append(file);
      }
      if (visualCol === 0) {
        const rank = document.createElement('span');
        rank.className = 'coord rank';
        rank.textContent = String(8 - r);
        button.append(rank);
      }

      squareEls.set(`${r},${c}`, button);
      fragment.append(button);
    }
  }

  squaresEl.append(fragment);
}

function resetPieces() {
  piecesEl.replaceChildren();
  pieceEls.clear();
}

function createPieceElement(piece) {
  const element = document.createElement('div');
  element.className = `piece ${piece.side}`;
  element.dataset.pieceId = piece.id;
  element.innerHTML = `<svg class="piece-art" viewBox="0 0 100 100" aria-hidden="true"><use href="#pc-${piece.identity}"></use></svg>`;
  piecesEl.append(element);
  return element;
}

function renderPieces() {
  const seen = new Set();
  const kingSide = state.check ? state.turn : null;
  const king = kingSide ? findKing(state.board, kingSide) : null;

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (!piece) continue;
      seen.add(piece.id);

      let element = pieceEls.get(piece.id);
      if (!element) {
        element = createPieceElement(piece);
        pieceEls.set(piece.id, element);
      }

      const visualRow = flipped ? 7 - r : r;
      const visualCol = flipped ? 7 - c : c;
      element.style.setProperty('--x', String(visualCol));
      element.style.setProperty('--y', String(visualRow));
      element.style.setProperty('--pc', `var(--pw-${piece.power})`);
      element.dataset.square = squareName(r, c);

      let className = `piece ${piece.side}`;
      if (piece.power !== piece.identity) className += ' mutated';
      if (selected && selected.r === r && selected.c === c) className += ' selected';
      if (king && king.r === r && king.c === c) className += ' in-check';
      element.className = className;

      let badge = element.querySelector('.power-badge');
      if (piece.power !== piece.identity) {
        if (!badge) {
          badge = document.createElement('span');
          element.append(badge);
        }
        badge.className = `power-badge pw-${piece.power}`;
        badge.textContent = POWER_LETTER[piece.power];
        badge.title = `${POWER_META[piece.power].label} power`;
      } else if (badge) {
        badge.remove();
      }
    }
  }

  for (const [id, element] of pieceEls) {
    if (!seen.has(id)) {
      element.remove();
      pieceEls.delete(id);
    }
  }
}

function updateSquares() {
  const last = state.lastMove;
  const checkedKing = state.check ? findKing(state.board, state.turn) : null;
  const focus = focusRC || { r: 6, c: 4 };

  for (const [key, element] of squareEls) {
    const [r, c] = key.split(',').map(Number);
    const piece = state.board[r][c];
    const move = currentMoves.find((entry) => entry.to[0] === r && entry.to[1] === c);
    const isSelected = Boolean(selected && selected.r === r && selected.c === c);

    let className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
    if (last && ((last.from[0] === r && last.from[1] === c) || (last.to[0] === r && last.to[1] === c))) {
      className += ' last';
    }
    if (isSelected) className += ' selected';
    if (checkedKing && checkedKing.r === r && checkedKing.c === c) className += ' check';
    if (move) className += move.capture ? ' capture' : ' move';
    element.className = className;

    let label = squareName(r, c);
    if (piece) {
      const powerNote = piece.power === piece.identity ? '' : ` with ${piece.power} power`;
      label += `, ${piece.side === 'w' ? 'white' : 'black'} ${piece.identity}${powerNote}`;
    } else {
      label += ', empty';
    }
    if (move) label += move.capture ? ', capture and swap powers' : ', legal move';
    if (isSelected) label += ', selected';
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    element.tabIndex = focus.r === r && focus.c === c ? 0 : -1;
  }

  boardEl.setAttribute('aria-label', `Swap Chess board. ${sideName(state.turn)} to move.`);
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

function updatePlayers() {
  const mat = material(state);
  whiteScore.textContent = formatPoints(mat.white);
  blackScore.textContent = formatPoints(mat.black);
  whiteSub.textContent = mode === 'bot' ? 'You' : 'Player 1';
  blackSub.textContent = mode === 'bot' ? 'Bot' : 'Player 2';

  const diff = mat.diff;
  if (Math.abs(diff) < 0.01) {
    materialNote.textContent = 'Material even';
    materialNote.classList.remove('is-edge');
  } else if (diff > 0) {
    materialNote.textContent = `White +${formatPoints(diff)}`;
    materialNote.classList.add('is-edge');
  } else {
    materialNote.textContent = `Black +${formatPoints(-diff)}`;
    materialNote.classList.add('is-edge');
  }

  for (const player of playersEl.querySelectorAll('.player')) {
    player.classList.toggle('is-turn', player.dataset.side === state.turn && !gameOver());
  }
}

function buildFeedPiece(identity, side) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('feed-piece');
  if (side === 'b') svg.classList.add('is-black');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#pc-${identity}`);
  svg.append(use);
  return svg;
}

function updateFeed() {
  const list = records();
  feedEl.replaceChildren();
  feedEmpty.classList.toggle('is-hidden', list.length > 0);

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const record = list[index];
    const row = document.createElement('li');
    row.className = `feed-row${record.swap ? ' is-capture' : ''}`;

    const ply = document.createElement('span');
    ply.className = 'feed-ply';
    ply.textContent = `${Math.ceil(record.ply / 2)}${record.side === 'w' ? '.' : '…'}`;

    const dot = document.createElement('span');
    dot.className = `feed-side${record.side === 'b' ? ' is-black' : ''}`;
    dot.setAttribute('aria-hidden', 'true');

    const icon = buildFeedPiece(record.identity, record.side);

    const move = document.createElement('span');
    move.className = 'feed-move';
    const from = squareName(record.from[0], record.from[1]);
    const to = squareName(record.to[0], record.to[1]);
    move.innerHTML = `<b>${from}</b>${record.swap ? ' × ' : ' → '}<b>${to}</b>`;
    move.title = `${sideName(record.side)} ${record.identity} ${record.swap ? 'takes' : 'moves'} ${from} to ${to}`;

    row.append(ply, dot, icon, move);

    if (record.swap) {
      const chip = document.createElement('span');
      chip.className = `feed-swap pw-${record.powerAfter}`;
      chip.textContent = POWER_LETTER[record.powerAfter];
      chip.title = `Gained ${POWER_META[record.powerAfter].label.toLowerCase()} power`;
      row.append(chip);
    } else if (record.promoted) {
      const chip = document.createElement('span');
      chip.className = 'feed-swap pw-queen';
      chip.textContent = '↑Q';
      chip.title = 'Promoted to queen power';
      row.append(chip);
    }

    feedEl.append(row);
  }
}

function updateHint() {
  if (gameOver()) {
    if (state.status === 'checkmate') {
      hintText.innerHTML = `<strong>Checkmate.</strong> ${sideName(state.winner)} wins.`;
    } else {
      hintText.innerHTML = `<strong>Stalemate.</strong> No legal moves — the game is drawn.`;
    }
    return;
  }

  if (busy) {
    hintText.textContent = `${sideName(state.turn)} is thinking…`;
    return;
  }

  if (selected) {
    const piece = state.board[selected.r][selected.c];
    if (!piece) {
      selected = null;
      return updateHint();
    }
    const meta = POWER_META[piece.power];
    const hasCapture = currentMoves.some((move) => move.capture);
    if (currentMoves.length === 0) {
      hintText.innerHTML = `<strong>${meta.label} power.</strong> No legal moves for this piece.`;
      return;
    }
    hintText.innerHTML = `<strong>${meta.label} power.</strong> ${meta.hint}${hasCapture ? ' · ringed squares capture & swap' : ''}`;
    return;
  }

  if (state.check) {
    hintText.innerHTML = `<strong>Check.</strong> ${sideName(state.turn)} must answer the threat.`;
    return;
  }

  const last = records()[records().length - 1];
  if (last && last.swap) {
    const gained = POWER_META[last.powerAfter].label.toLowerCase();
    hintText.innerHTML = `<strong>Power swapped.</strong> ${sideName(last.side)} ${last.identity} now moves like a ${gained}.`;
    return;
  }
  if (last && last.promoted) {
    hintText.innerHTML = `<strong>Promoted.</strong> Pawn power became queen power.`;
    return;
  }

  hintText.textContent = 'Tap a piece, then a lit square';
}

function updateHUD() {
  const over = gameOver();
  const side = state.turn;
  const check = state.check && !over;
  const thinking = busy && mode === 'bot' && side === 'b';

  turnPill.classList.toggle('is-black', side === 'b');
  turnPill.classList.toggle('is-check', check);
  turnPill.classList.toggle('is-thinking', thinking);

  if (over) {
    turnText.textContent = state.status === 'checkmate' ? 'Checkmate' : 'Stalemate';
  } else if (thinking) {
    turnText.textContent = `${sideName(side)} is thinking…`;
  } else if (check) {
    turnText.textContent = `${sideName(side)} in check`;
  } else {
    turnText.textContent = `${sideName(side)} to move`;
  }

  turnChip.textContent = over ? 'Over' : sideName(side);
  modeChip.textContent = mode === 'bot' ? 'Vs bot' : '2 players';

  const swaps = swapTotal();
  swapCountText.textContent = `${swaps} swap${swaps === 1 ? '' : 's'}`;
  captureCount.textContent = `${swaps} capture${swaps === 1 ? '' : 's'}`;
  plyCount.textContent = over ? 'Final' : `Move ${Math.floor(state.ply / 2) + 1}`;

  updatePlayers();
  updateFeed();
  updateHint();

  undoBtn.disabled = timeline.length <= 1;
  flipBtn.disabled = false;
  newBtn.disabled = false;

  for (const button of document.querySelectorAll('.mode-btn')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  const soundUse = soundBtn.querySelector('use');
  if (soundUse) soundUse.setAttribute('href', soundOn ? '#i-sound' : '#i-muted');
  soundBtn.classList.toggle('is-on', soundOn);
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');

  tiltBtn.classList.toggle('is-on', tiltEnabled);
  tiltBtn.setAttribute('aria-pressed', String(tiltEnabled));
  tiltBtn.setAttribute('aria-label', tiltEnabled ? 'Disable tilt controls' : 'Enable tilt controls');
}

function render() {
  updateSquares();
  renderPieces();
  updateHUD();
}

/* ------------------------------------------------------------------ */
/* Selection & moves                                                   */
/* ------------------------------------------------------------------ */

function clearSelection() {
  selected = null;
  currentMoves = [];
}

function selectSquare(r, c) {
  const piece = state.board[r][c];
  if (!piece) return;
  selected = { r, c };
  focusRC = { r, c };
  currentMoves = movesFrom(state, r, c);
  render();
  sfx.select();
  vibrate(8);
  const meta = POWER_META[piece.power];
  announce(
    `${sideName(piece.side)} ${piece.identity}${piece.power !== piece.identity ? ` with ${piece.power} power` : ''} on ${squareName(r, c)} selected. ${currentMoves.length} legal move${currentMoves.length === 1 ? '' : 's'}.`,
  );
  if (currentMoves.length === 0) {
    toast(`${cap(meta.label)} power has no legal moves here`, 1700);
  }
}

function onSquare(r, c) {
  if (busy) return;
  if (gameOver()) {
    toast('Game over — tap New or Rematch to play again');
    return;
  }
  if (isBotTurn()) {
    toast('The bot is thinking…', 1200);
    return;
  }

  const piece = state.board[r][c];

  if (selected) {
    const move = currentMoves.find((entry) => entry.to[0] === r && entry.to[1] === c);
    if (move) {
      doMove(selected.r, selected.c, r, c);
      return;
    }
    if (piece && piece.side === state.turn) {
      if (selected.r === r && selected.c === c) {
        clearSelection();
        focusRC = { r, c };
        render();
        return;
      }
      selectSquare(r, c);
      return;
    }
    clearSelection();
    focusRC = { r, c };
    render();
    if (piece) sfx.error();
    return;
  }

  if (piece && piece.side === state.turn) {
    selectSquare(r, c);
  } else if (piece) {
    toast(`${sideName(state.turn)} to move`, 1400);
    sfx.error();
  }
}

function doMove(fr, fc, tr, tc) {
  if (busy) return;
  const result = makeMove(state, [fr, fc], [tr, tc]);
  if (!result) {
    sfx.error();
    return;
  }

  const moverId = result.record.pieceId;
  const capturedId = result.captured ? result.captured.id : null;

  if (capturedId) {
    const capturedElement = pieceEls.get(capturedId);
    if (capturedElement) {
      pieceEls.delete(capturedId);
      capturedElement.classList.add('captured');
      window.setTimeout(() => capturedElement.remove(), 320);
    }
  }

  clearSelection();
  focusRC = { r: tr, c: tc };
  state = result.state;
  timeline.push({
    state,
    records: [...timeline[timeline.length - 1].records, result.record],
  });

  render();

  const moverElement = pieceEls.get(moverId);
  if (moverElement) {
    moverElement.classList.add('moving');
    window.setTimeout(() => moverElement.classList.remove('moving'), 320);
  }

  const record = result.record;
  const to = [tr, tc];

  if (record.swap) {
    burstPower(to, record.powerAfter, `+${POWER_META[record.powerAfter].label} power`);
    boardEl.classList.add('flash');
    window.setTimeout(() => boardEl.classList.remove('flash'), 520);
    sfx.capture();
    vibrate([12, 26, 16]);
  } else {
    sfx.move();
    vibrate(9);
  }

  if (record.promoted) {
    window.setTimeout(() => {
      burstPower(to, 'queen', 'Promoted · queen power');
      toast('Pawn power promoted to queen power', 2200);
    }, 180);
  }

  if (record.check && !record.checkmate) {
    window.setTimeout(() => sfx.check(), 90);
    vibrate([16, 40, 16]);
  }

  if (record.checkmate) {
    window.setTimeout(() => sfx.win(), 180);
    vibrate([20, 40, 20, 40, 70]);
  } else if (record.stalemate) {
    window.setTimeout(() => sfx.draw(), 120);
  }

  announceMove(record);

  if (gameOver()) {
    window.setTimeout(() => {
      if (!overShown) showOver();
    }, 720);
  } else if (mode === 'bot' && state.turn === 'b') {
    maybeBot();
  }
}

function announceMove(record) {
  const from = squareName(record.from[0], record.from[1]);
  const to = squareName(record.to[0], record.to[1]);
  const side = sideName(record.side);
  let text = `${side} ${record.identity} from ${from} to ${to}.`;
  if (record.swap) {
    text += ` Capture. Power swapped to ${POWER_META[record.powerAfter].label.toLowerCase()}.`;
  }
  if (record.promoted) text += ' Promoted to queen power.';
  if (record.checkmate) text += ` Checkmate. ${sideName(state.winner)} wins.`;
  else if (record.stalemate) text += ' Stalemate. The game is drawn.';
  else if (record.check) text += ` ${sideName(state.turn)} is in check.`;
  announce(text);
}

/* ------------------------------------------------------------------ */
/* Visual feedback                                                     */
/* ------------------------------------------------------------------ */

function squareCenter(r, c) {
  const rect = boardEl.getBoundingClientRect();
  const size = rect.width / 8;
  const visualRow = flipped ? 7 - r : r;
  const visualCol = flipped ? 7 - c : c;
  return {
    x: visualCol * size + size / 2,
    y: visualRow * size + size / 2,
    size,
  };
}

function burstPower([r, c], power, label) {
  const { x, y, size } = squareCenter(r, c);

  const ring = document.createElement('span');
  ring.className = 'power-ring';
  ring.style.setProperty('--pc', `var(--pw-${power})`);
  ring.style.left = `${x - size / 2}px`;
  ring.style.top = `${y - size / 2}px`;
  boardEl.append(ring);
  window.setTimeout(() => ring.remove(), 700);

  const float = document.createElement('span');
  float.className = 'power-float';
  float.style.setProperty('--pc', `var(--pw-${power})`);
  float.style.left = `${Math.min(Math.max(x, 62), boardEl.clientWidth - 62)}px`;
  float.style.top = `${Math.max(y - size * 0.35, 24)}px`;
  float.textContent = label;
  boardEl.append(float);
  window.setTimeout(() => float.remove(), 1300);
}

/* ------------------------------------------------------------------ */
/* Bot                                                                 */
/* ------------------------------------------------------------------ */

function maybeBot() {
  if (mode !== 'bot' || state.turn !== 'b' || gameOver()) return;
  busy = true;
  const token = ++botToken;
  updateHUD();

  clearTimeout(botTimer);
  botTimer = window.setTimeout(() => {
    if (token !== botToken) return;
    const pick = chooseMove(state, { depth: 2 });
    if (token !== botToken) return;
    busy = false;
    if (!pick) {
      updateHUD();
      return;
    }
    doMove(pick.from[0], pick.from[1], pick.to[0], pick.to[1]);
  }, 460);
}

function cancelBot() {
  botToken += 1;
  busy = false;
  clearTimeout(botTimer);
}

/* ------------------------------------------------------------------ */
/* Game actions                                                        */
/* ------------------------------------------------------------------ */

function undo() {
  if (timeline.length <= 1) return;
  cancelBot();
  overShown = false;
  closeDialog(overDialog);

  let index = timeline.length - 2;
  if (mode === 'bot') {
    while (index > 0 && timeline[index].state.turn !== 'w') index -= 1;
  }

  timeline = timeline.slice(0, index + 1);
  state = timeline[timeline.length - 1].state;
  clearSelection();
  focusRC = state.lastMove ? { r: state.lastMove.to[0], c: state.lastMove.to[1] } : { r: 6, c: 4 };
  resetPieces();
  render();
  sfx.undo();
  toast('Move undone', 1500);
  announce('Move undone.');

  if (mode === 'bot' && state.turn === 'b') maybeBot();
}

function newGame({ silent = false } = {}) {
  cancelBot();
  closeDialog(overDialog);
  state = createGame();
  timeline = [{ state, records: [] }];
  clearSelection();
  overShown = false;
  focusRC = { r: 6, c: 4 };
  resetPieces();
  render();
  if (!silent) {
    sfx.start();
    toast('New game', 1400);
  }
  announce('New game. White to move.');
}

function flipBoard() {
  flipped = !flipped;
  piecesEl.classList.add('no-anim');
  buildSquares();
  render();
  window.requestAnimationFrame(() => piecesEl.classList.remove('no-anim'));
  sfx.select();
  announce(`Board flipped. ${sideName(state.turn)} to move.`);
}

function setMode(nextMode) {
  if (nextMode !== '2p' && nextMode !== 'bot') return;
  if (mode === nextMode) return;
  mode = nextMode;
  writeSetting('swapchess.mode', mode);
  cancelBot();
  clearSelection();
  closeDialog(overDialog);
  overShown = false;
  render();
  sfx.select();
  toast(mode === 'bot' ? 'Solo mode — the bot plays black' : 'Two players — pass and play', 1900);
  announce(mode === 'bot' ? 'Bot mode. You play white.' : 'Two player mode.');
  if (mode === 'bot' && state.turn === 'b' && !gameOver()) maybeBot();
}

/* ------------------------------------------------------------------ */
/* Game over                                                           */
/* ------------------------------------------------------------------ */

function showOver() {
  if (!gameOver()) return;
  overShown = true;
  const winner = state.winner;
  const isDraw = state.status === 'stalemate';
  overDialog.classList.toggle('is-draw', isDraw);
  overMark.innerHTML = isDraw
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow"></use></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-crown"></use></svg>';

  if (isDraw) {
    overKicker.textContent = 'Stalemate';
    overTitle.textContent = 'Draw';
    overText.textContent = 'No legal moves remain. The board is locked.';
  } else {
    overKicker.textContent = 'Checkmate';
    overTitle.textContent = `${sideName(winner)} wins`;
    if (mode === 'bot') {
      overText.textContent = winner === 'w' ? 'You trapped the bot. Every power was yours.' : 'The bot found the trap. Rematch?';
    } else {
      overText.textContent = `The ${sideName(otherSide(winner)).toLowerCase()} king has no escape.`;
    }
  }

  overStats.replaceChildren();
  const stats = isDraw
    ? [`${Math.ceil(state.ply / 2)} moves`, `${swapTotal()} swaps`, 'no legal moves']
    : [`${Math.ceil(state.ply / 2)} moves`, `${swapTotal()} swap${swapTotal() === 1 ? '' : 's'}`, `${sideName(winner)} wins`];
  for (const stat of stats) {
    const chip = document.createElement('span');
    chip.className = 'over-stat';
    chip.textContent = stat;
    overStats.append(chip);
  }

  openDialog(overDialog);
  window.setTimeout(() => rematchBtn.focus({ preventScroll: true }), 60);
}

/* ------------------------------------------------------------------ */
/* Tilt                                                                */
/* ------------------------------------------------------------------ */

let tiltEnabled = false;
let tiltBase = null;
let tiltTarget = { x: 0, y: 0 };
let tiltCurrent = { x: 0, y: 0 };
let tiltFrame = 0;
let tiltTimer = 0;
let tiltGotData = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function orientationAngles(event) {
  const beta = Number.isFinite(event.beta) ? event.beta : 0;
  const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
  const angle = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * (Math.PI / 180);
  return {
    dx: gamma * Math.cos(angle) + beta * Math.sin(angle),
    dy: -gamma * Math.sin(angle) + beta * Math.cos(angle),
  };
}

function onTilt(event) {
  if (!tiltEnabled) return;
  if (!Number.isFinite(event.beta) && !Number.isFinite(event.gamma)) return;
  tiltGotData = true;
  clearTimeout(tiltTimer);

  const raw = orientationAngles(event);
  if (!tiltBase) {
    tiltBase = raw;
    return;
  }

  const range = reducedMotion ? 6 : 10;
  tiltTarget.x = clamp((raw.dx - tiltBase.dx) / 2.2, -range, range);
  tiltTarget.y = clamp((raw.dy - tiltBase.dy) / 2.2, -range, range);
}

function tiltLoop() {
  if (!tiltEnabled) return;
  tiltCurrent.x += (tiltTarget.x - tiltCurrent.x) * 0.11;
  tiltCurrent.y += (tiltTarget.y - tiltCurrent.y) * 0.11;
  board3d.style.transform = `rotateX(${tiltCurrent.y.toFixed(2)}deg) rotateY(${tiltCurrent.x.toFixed(2)}deg)`;
  boardEl.style.setProperty('--shine-x', `${50 + tiltCurrent.x * 4}%`);
  boardEl.style.setProperty('--shine-y', `${18 - tiltCurrent.y * 3}%`);
  tiltPill.style.setProperty('--tilt-x', String(tiltCurrent.x / 10));
  tiltPill.style.setProperty('--tilt-y', String(tiltCurrent.y / 10));
  tiltFrame = window.requestAnimationFrame(tiltLoop);
}

function startTilt() {
  if (tiltEnabled) return;
  tiltEnabled = true;
  tiltBase = null;
  tiltTarget = { x: 0, y: 0 };
  tiltCurrent = { x: 0, y: 0 };
  tiltGotData = false;
  tiltPill.hidden = false;
  window.addEventListener('deviceorientation', onTilt, true);
  tiltFrame = window.requestAnimationFrame(tiltLoop);
  updateHUD();
  toast('Tilt on — move your device', 2000);

  clearTimeout(tiltTimer);
  tiltTimer = window.setTimeout(() => {
    if (tiltEnabled && !tiltGotData) {
      toast('No motion data on this device', 2200);
      stopTilt({ quiet: true });
    }
  }, 1700);
}

function stopTilt({ quiet = false } = {}) {
  if (!tiltEnabled) return;
  tiltEnabled = false;
  clearTimeout(tiltTimer);
  window.cancelAnimationFrame(tiltFrame);
  window.removeEventListener('deviceorientation', onTilt, true);
  tiltPill.hidden = true;
  board3d.style.transition = 'transform 0.35s ease';
  board3d.style.transform = '';
  boardEl.style.removeProperty('--shine-x');
  boardEl.style.removeProperty('--shine-y');
  window.setTimeout(() => {
    board3d.style.transition = '';
  }, 380);
  updateHUD();
  if (!quiet) toast('Tilt off', 1200);
}

async function toggleTilt() {
  if (tiltEnabled) {
    stopTilt();
    return;
  }

  if (!('DeviceOrientationEvent' in window)) {
    toast('This device has no motion sensor', 2200);
    return;
  }

  const requestPermission = window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission;
  if (typeof requestPermission === 'function') {
    try {
      const permission = await requestPermission();
      if (permission !== 'granted') {
        toast('Motion access denied — allow it in Settings › Safari', 3200);
        return;
      }
    } catch {
      toast('Motion access needs a secure page', 2600);
      return;
    }
  }

  startTilt();
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

squaresEl.addEventListener('click', (event) => {
  const square = event.target.closest('.square');
  if (!square) return;
  onSquare(Number(square.dataset.r), Number(square.dataset.c));
});

squaresEl.addEventListener('focusin', (event) => {
  const square = event.target.closest('.square');
  if (!square) return;
  focusRC = { r: Number(square.dataset.r), c: Number(square.dataset.c) };
});

squaresEl.addEventListener('keydown', (event) => {
  const directions = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  const direction = directions[event.key];
  if (!direction) return;
  event.preventDefault();
  const step = flipped ? -1 : 1;
  const nextR = clamp(focusRC.r + direction[0] * step, 0, 7);
  const nextC = clamp(focusRC.c + direction[1] * step, 0, 7);
  focusRC = { r: nextR, c: nextC };
  const target = squareEls.get(`${nextR},${nextC}`);
  if (target) {
    for (const element of squareEls.values()) element.tabIndex = -1;
    target.tabIndex = 0;
    target.focus({ preventScroll: true });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (rulesDialog.open || overDialog.open) return;
  const tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (event.key === 'Escape') {
    if (selected) {
      clearSelection();
      render();
    }
    return;
  }
  if (event.key === 'u' || event.key === 'U') {
    event.preventDefault();
    undo();
  } else if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    flipBoard();
  } else if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    newGame();
  } else if (event.key === '?' || event.key === 'h' || event.key === 'H') {
    event.preventDefault();
    openDialog(rulesDialog);
  }
});

undoBtn.addEventListener('click', undo);
flipBtn.addEventListener('click', flipBoard);
newBtn.addEventListener('click', () => newGame());
rematchBtn.addEventListener('click', () => {
  closeDialog(overDialog);
  newGame();
});
reviewBtn.addEventListener('click', () => closeDialog(overDialog));

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  writeSetting('swapchess.sound', soundOn ? 'on' : 'off');
  updateHUD();
  if (soundOn) {
    ensureAudio();
    sfx.select();
    toast('Sound on', 1200);
  } else {
    toast('Sound off', 1200);
  }
});

tiltBtn.addEventListener('click', toggleTilt);

helpBtn.addEventListener('click', () => openDialog(rulesDialog));
footerHelp.addEventListener('click', () => openDialog(rulesDialog));

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => {
    const dialog = $(button.dataset.close);
    if (dialog) closeDialog(dialog);
  });
}

for (const dialog of [rulesDialog, overDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
}

for (const button of document.querySelectorAll('.mode-btn')) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

if (readSetting('swapchess.coach', 'on') === 'off') {
  coach.classList.add('is-hidden');
}
coachClose.addEventListener('click', () => {
  coach.classList.add('is-hidden');
  writeSetting('swapchess.coach', 'off');
});

document.addEventListener(
  'pointerdown',
  () => {
    ensureAudio();
  },
  { once: true, passive: true },
);

if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
  screen.orientation.addEventListener('change', () => {
    tiltBase = null;
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && tiltEnabled) stopTilt({ quiet: true });
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

buildSquares();
resetPieces();
render();

/* ------------------------------------------------------------------ */
/* Debug hooks (used by the browser test harness)                       */
/* ------------------------------------------------------------------ */

window.__swapchess = {
  get state() {
    return state;
  },
  legal() {
    return legalMoves(state).map((move) => ({
      from: squareName(move.from[0], move.from[1]),
      to: squareName(move.to[0], move.to[1]),
      capture: Boolean(move.capture),
    }));
  },
  play(from, to) {
    const [fr, fc] = parseSquare(from);
    const [tr, tc] = parseSquare(to);
    doMove(fr, fc, tr, tc);
    return state;
  },
  setMode,
  flip() {
    flipBoard();
  },
  reset() {
    newGame({ silent: true });
  },
  setPosition(pieces, turn = 'w') {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    let id = 0;
    for (const spec of pieces) {
      const [r, c] = parseSquare(spec.square);
      board[r][c] = {
        id: spec.id || `debug${++id}`,
        side: spec.side,
        identity: spec.identity,
        power: spec.power || spec.identity,
      };
    }
    const check = isInCheck(board, turn);
    const moves = legalMoves({ board, turn, status: 'playing', winner: null, check, lastMove: null, ply: 0 });
    const status = moves.length === 0 ? (check ? 'checkmate' : 'stalemate') : check ? 'check' : 'playing';
    state = {
      board,
      turn,
      status,
      winner: status === 'checkmate' ? (turn === 'w' ? 'b' : 'w') : null,
      check,
      lastMove: null,
      ply: 0,
    };
    timeline = [{ state, records: [] }];
    cancelBot();
    clearSelection();
    overShown = false;
    resetPieces();
    render();
    return state;
  },
};
