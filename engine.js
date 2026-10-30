/*
 * Power Shift chess engine.
 *
 * Pieces keep their identity but swap movement powers whenever a capture
 * happens. A capture is resolved as a true swap: the capturing piece receives
 * the victim's power, the victim receives the capturer's power, then the
 * victim leaves the board.
 */

export const FILES = 'abcdefgh';
export const ROLES = ['p', 'n', 'b', 'r', 'q', 'k'];
export const ROLE_NAMES = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};
export const POWER_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const KNIGHT_STEPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_STEPS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1],
  [0, 1], [1, -1], [1, 0], [1, 1],
];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

let pieceSerial = 1;

export const indexOf = (row, col) => row * 8 + col;
export const rowOf = (index) => index >> 3;
export const colOf = (index) => index & 7;
export const onBoard = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;
export const squareName = (index) => `${FILES[colOf(index)]}${8 - rowOf(index)}`;
export const otherColor = (color) => (color === 'w' ? 'b' : 'w');
export const roleLetter = (role) => role.toUpperCase();

function makePiece(color, role, row, col) {
  return {
    id: `pc-${pieceSerial++}`,
    color,
    role,
    power: role,
    hasMoved: false,
    row,
    col,
  };
}

export function createInitialState() {
  pieceSerial = 1;
  const board = Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let col = 0; col < 8; col += 1) {
    board[indexOf(0, col)] = makePiece('b', back[col], 0, col);
    board[indexOf(1, col)] = makePiece('b', 'p', 1, col);
    board[indexOf(6, col)] = makePiece('w', 'p', 6, col);
    board[indexOf(7, col)] = makePiece('w', back[col], 7, col);
  }
  return {
    board,
    turn: 'w',
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    ply: 0,
    lastMove: null,
    moveLog: [],
    captured: { w: [], b: [] },
    check: false,
    status: { over: false, result: null, reason: null },
  };
}

export function cloneState(state) {
  return {
    board: state.board.map((piece) => (piece ? { ...piece } : null)),
    turn: state.turn,
    enPassant: state.enPassant ? { ...state.enPassant } : null,
    halfmove: state.halfmove,
    fullmove: state.fullmove,
    ply: state.ply,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    moveLog: state.moveLog.map((entry) => ({ ...entry })),
    captured: {
      w: state.captured.w.map((piece) => ({ ...piece })),
      b: state.captured.b.map((piece) => ({ ...piece })),
    },
    check: state.check,
    status: { ...state.status },
  };
}

export function findKing(state, color) {
  for (let i = 0; i < 64; i += 1) {
    const piece = state.board[i];
    if (piece && piece.color === color && piece.role === 'k') return i;
  }
  return -1;
}

function addMove(moves, state, piece, from, to, extras = {}) {
  const target = state.board[to];
  moves.push({
    from,
    to,
    pieceId: piece.id,
    color: piece.color,
    role: piece.role,
    power: piece.power,
    capture: Boolean(target) || Boolean(extras.enPassant),
    captured: target ? { ...target } : null,
    ...extras,
  });
}

function addPawnMoves(state, piece, from, moves, attacksOnly) {
  const row = rowOf(from);
  const col = colOf(from);
  const direction = piece.color === 'w' ? -1 : 1;
  const startRow = piece.color === 'w' ? 6 : 1;

  if (!attacksOnly) {
    const oneRow = row + direction;
    if (onBoard(oneRow, col)) {
      const one = indexOf(oneRow, col);
      if (!state.board[one]) {
        addMove(moves, state, piece, from, one, {
          promotion: oneRow === (piece.color === 'w' ? 0 : 7) ? 'q' : null,
        });
        if (!piece.hasMoved && row === startRow) {
          const two = indexOf(row + direction * 2, col);
          if (!state.board[two]) {
            addMove(moves, state, piece, from, two, { doubleStep: true });
          }
        }
      }
    }
  }

  for (const dc of [-1, 1]) {
    const targetRow = row + direction;
    const targetCol = col + dc;
    if (!onBoard(targetRow, targetCol)) continue;
    const targetIndex = indexOf(targetRow, targetCol);
    const target = state.board[targetIndex];
    if (attacksOnly) {
      moves.push({ from, to: targetIndex, color: piece.color, power: 'p', attackOnly: true });
      continue;
    }
    if (target && target.color !== piece.color) {
      addMove(moves, state, piece, from, targetIndex, {
        promotion: targetRow === (piece.color === 'w' ? 0 : 7) ? 'q' : null,
      });
    } else if (!target && state.enPassant && state.enPassant.target === targetIndex) {
      const capturedPawn = state.board[state.enPassant.pawnSquare];
      if (capturedPawn && capturedPawn.color !== piece.color && capturedPawn.power === 'p') {
        addMove(moves, state, piece, from, targetIndex, {
          enPassant: true,
          captureSquare: state.enPassant.pawnSquare,
          captured: { ...capturedPawn },
        });
      }
    }
  }
}

function addRayMoves(state, piece, from, directions, moves, attacksOnly) {
  const row = rowOf(from);
  const col = colOf(from);
  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    while (onBoard(r, c)) {
      const to = indexOf(r, c);
      const target = state.board[to];
      if (!target) {
        if (!attacksOnly) addMove(moves, state, piece, from, to);
        else moves.push({ from, to, color: piece.color, power: piece.power, attackOnly: true });
      } else {
        if (attacksOnly) {
          moves.push({ from, to, color: piece.color, power: piece.power, attackOnly: true });
        } else if (target.color !== piece.color) {
          addMove(moves, state, piece, from, to);
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

function addStepMoves(state, piece, from, steps, moves, attacksOnly) {
  const row = rowOf(from);
  const col = colOf(from);
  for (const [dr, dc] of steps) {
    const r = row + dr;
    const c = col + dc;
    if (!onBoard(r, c)) continue;
    const to = indexOf(r, c);
    const target = state.board[to];
    if (attacksOnly) {
      moves.push({ from, to, color: piece.color, power: piece.power, attackOnly: true });
    } else if (!target) {
      addMove(moves, state, piece, from, to);
    } else if (target.color !== piece.color) {
      addMove(moves, state, piece, from, to);
    }
  }
}

function addCastlingMoves(state, piece, from, moves) {
  if (piece.role !== 'k' || piece.power !== 'k' || piece.hasMoved) return;
  if (isSquareAttacked(state, from, otherColor(piece.color))) return;
  const row = rowOf(from);
  const kingCol = colOf(from);
  const homeRow = piece.color === 'w' ? 7 : 0;
  if (row !== homeRow || kingCol !== 4) return;

  const specs = [
    { side: 'king', rookCol: 7, empty: [5, 6], through: 5, rookTo: 5 },
    { side: 'queen', rookCol: 0, empty: [1, 2, 3], through: 3, rookTo: 3 },
  ];

  for (const spec of specs) {
    const rookSquare = indexOf(row, spec.rookCol);
    const rook = state.board[rookSquare];
    if (!rook || rook.color !== piece.color || rook.role !== 'r' || rook.power !== 'r' || rook.hasMoved) continue;
    if (spec.empty.some((col) => state.board[indexOf(row, col)])) continue;
    if (isSquareAttacked(state, indexOf(row, spec.through), otherColor(piece.color))) continue;
    addMove(moves, state, piece, from, indexOf(row, kingCol + (spec.side === 'king' ? 2 : -2)), {
      castle: spec.side,
      rookFrom: rookSquare,
      rookTo: indexOf(row, spec.rookTo),
    });
  }
}

export function getPseudoMoves(state, color, attacksOnly = false) {
  const moves = [];
  for (let from = 0; from < 64; from += 1) {
    const piece = state.board[from];
    if (!piece || piece.color !== color) continue;
    switch (piece.power) {
      case 'p':
        addPawnMoves(state, piece, from, moves, attacksOnly);
        break;
      case 'n':
        addStepMoves(state, piece, from, KNIGHT_STEPS, moves, attacksOnly);
        break;
      case 'b':
        addRayMoves(state, piece, from, BISHOP_DIRS, moves, attacksOnly);
        break;
      case 'r':
        addRayMoves(state, piece, from, ROOK_DIRS, moves, attacksOnly);
        break;
      case 'q':
        addRayMoves(state, piece, from, [...BISHOP_DIRS, ...ROOK_DIRS], moves, attacksOnly);
        break;
      case 'k':
        addStepMoves(state, piece, from, KING_STEPS, moves, attacksOnly);
        if (!attacksOnly) addCastlingMoves(state, piece, from, moves);
        break;
      default:
        break;
    }
  }
  return moves;
}

export function isSquareAttacked(state, square, byColor) {
  const attacks = getPseudoMoves(state, byColor, true);
  return attacks.some((move) => move.to === square);
}

export function isKingInCheck(state, color) {
  const kingSquare = findKing(state, color);
  if (kingSquare < 0) return false;
  return isSquareAttacked(state, kingSquare, otherColor(color));
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  if (!piece) return next;

  let capturedPiece = null;
  let captureSquare = move.to;
  if (move.enPassant && move.captureSquare != null) {
    captureSquare = move.captureSquare;
    capturedPiece = next.board[captureSquare];
    next.board[captureSquare] = null;
  } else if (next.board[move.to]) {
    capturedPiece = next.board[move.to];
    next.board[move.to] = null;
  }

  const powerBefore = piece.power;
  next.board[move.from] = null;
  piece.row = rowOf(move.to);
  piece.col = colOf(move.to);
  piece.hasMoved = true;
  next.board[move.to] = piece;

  let victimPower = null;
  if (capturedPiece) {
    victimPower = capturedPiece.power;
    // A true swap: the capturer takes the victim's power. The victim takes the
    // capturer's old power, but leaves the board immediately afterwards.
    piece.power = victimPower;
    capturedPiece.power = powerBefore;
    next.captured[capturedPiece.color].push({
      role: capturedPiece.role,
      power: victimPower,
      color: capturedPiece.color,
    });
    next.halfmove = 0;
  } else {
    next.halfmove += 1;
  }

  if (move.promotion) {
    piece.power = 'q';
  }

  if (move.castle) {
    const rook = next.board[move.rookFrom];
    if (rook) {
      next.board[move.rookFrom] = null;
      rook.row = rowOf(move.rookTo);
      rook.col = colOf(move.rookTo);
      rook.hasMoved = true;
      next.board[move.rookTo] = rook;
    }
  }

  if (move.doubleStep) {
    const direction = piece.color === 'w' ? -1 : 1;
    next.enPassant = {
      target: indexOf(rowOf(move.from) + direction, colOf(move.from)),
      pawnSquare: move.to,
    };
  } else {
    next.enPassant = null;
  }

  next.turn = otherColor(state.turn);
  next.ply += 1;
  if (state.turn === 'b') next.fullmove += 1;

  const capturedForLog = capturedPiece
    ? { role: capturedPiece.role, power: victimPower, color: capturedPiece.color }
    : null;
  const check = isKingInCheck(next, next.turn);
  const legalForNext = check || next.ply > 0 ? getLegalMoves(next, next.turn) : [];
  const mate = legalForNext.length === 0 && check;
  const stalemate = legalForNext.length === 0 && !check;

  next.check = check;
  next.lastMove = {
    from: move.from,
    to: move.to,
    pieceId: piece.id,
    color: piece.color,
    role: piece.role,
    powerBefore,
    powerAfter: piece.power,
    captured: capturedForLog,
    promotion: move.promotion || null,
    castle: move.castle || null,
    enPassant: Boolean(move.enPassant),
    check,
    mate,
    stalemate,
  };

  next.moveLog.push({
    ply: next.ply,
    color: piece.color,
    role: piece.role,
    from: move.from,
    to: move.to,
    capture: Boolean(capturedPiece),
    captured: capturedForLog,
    powerBefore,
    powerAfter: piece.power,
    promotion: move.promotion || null,
    castle: move.castle || null,
    enPassant: Boolean(move.enPassant),
    check,
    mate,
    stalemate,
  });

  next.status = evaluateStatus(next, { check, mate, stalemate, legalForNext });
  return next;
}

function evaluateStatus(state, hints = {}) {
  const check = hints.check ?? isKingInCheck(state, state.turn);
  const legal = hints.legalForNext ?? getLegalMoves(state, state.turn);
  if (legal.length === 0) {
    if (check) {
      return {
        over: true,
        result: otherColor(state.turn),
        reason: 'checkmate',
        check,
      };
    }
    return { over: true, result: 'draw', reason: 'stalemate', check };
  }
  if (state.halfmove >= 100) {
    return { over: true, result: 'draw', reason: 'fifty-move rule', check };
  }
  const pieces = state.board.filter(Boolean);
  const nonKings = pieces.filter((piece) => piece.role !== 'k');
  if (nonKings.length === 0) {
    return { over: true, result: 'draw', reason: 'insufficient material', check };
  }
  if (
    nonKings.length === 1 &&
    ['n', 'b'].includes(nonKings[0].power) &&
    pieces.length === 3
  ) {
    return { over: true, result: 'draw', reason: 'insufficient material', check };
  }
  return { over: false, result: null, reason: null, check };
}

export function getLegalMoves(state, color = state.turn) {
  const pseudo = getPseudoMoves(state, color);
  const legal = [];
  for (const move of pseudo) {
    if (move.captured && move.captured.role === 'k') continue;
    const next = applyMoveFast(state, move);
    if (!isKingInCheck(next, color)) legal.push(move);
  }
  return legal;
}

// Fast simulation used for legality checks and AI search. It intentionally
// omits status evaluation and move logging, which keeps search inexpensive.
export function applyMoveFast(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  if (!piece) return next;
  let capturedPiece = null;
  if (move.enPassant && move.captureSquare != null) {
    capturedPiece = next.board[move.captureSquare];
    next.board[move.captureSquare] = null;
  } else if (next.board[move.to]) {
    capturedPiece = next.board[move.to];
    next.board[move.to] = null;
  }
  const powerBefore = piece.power;
  next.board[move.from] = null;
  piece.row = rowOf(move.to);
  piece.col = colOf(move.to);
  piece.hasMoved = true;
  next.board[move.to] = piece;
  if (capturedPiece) piece.power = capturedPiece.power;
  if (move.promotion) piece.power = 'q';
  if (move.castle) {
    const rook = next.board[move.rookFrom];
    if (rook) {
      next.board[move.rookFrom] = null;
      rook.row = rowOf(move.rookTo);
      rook.col = colOf(move.rookTo);
      rook.hasMoved = true;
      next.board[move.rookTo] = rook;
    }
  }
  if (move.doubleStep) {
    const direction = piece.color === 'w' ? -1 : 1;
    next.enPassant = {
      target: indexOf(rowOf(move.from) + direction, colOf(move.from)),
      pawnSquare: move.to,
    };
  } else {
    next.enPassant = null;
  }
  next.turn = otherColor(state.turn);
  if (state.turn === 'b') next.fullmove += 1;
  next.ply += 1;
  void powerBefore;
  return next;
}

export function getGameStatus(state) {
  const check = isKingInCheck(state, state.turn);
  const legal = getLegalMoves(state, state.turn);
  return evaluateStatus(state, { check, legalForNext: legal });
}

export function movesFrom(state, from) {
  return getLegalMoves(state, state.turn).filter((move) => move.from === from);
}

export function getMoveFor(state, from, to) {
  return getLegalMoves(state, state.turn).find((move) => move.from === from && move.to === to) || null;
}

export function hasAnyLegalMove(state, color = state.turn) {
  return getLegalMoves(state, color).length > 0;
}

export function moveNotation(move) {
  const prefix = move.castle === 'king' ? 'O-O' : move.castle === 'queen' ? 'O-O-O' : '';
  if (prefix) return `${prefix}${move.check ? (move.mate ? '#' : '+') : ''}`;
  const separator = move.capture ? 'x' : '-';
  const promotion = move.promotion ? '=Q' : '';
  return `${move.pieceId ? '' : ''}${squareName(move.from)}${separator}${squareName(move.to)}${promotion}${move.check ? (move.mate ? '#' : '+') : ''}`;
}

// ---------------------------------------------------------------------------
// A compact alpha-beta opponent. Evaluation is intentionally power-first:
// movement is the resource that changes hands in this variant.

const CENTER_BONUS = [0, 1, 2, 3, 4, 3, 2, 1];
const POWER_VALUE = { p: 100, n: 320, b: 335, r: 510, q: 950, k: 0 };

function evaluate(state) {
  let score = 0;
  for (let i = 0; i < 64; i += 1) {
    const piece = state.board[i];
    if (!piece) continue;
    const row = rowOf(i);
    const col = colOf(i);
    const sign = piece.color === 'w' ? 1 : -1;
    let value = piece.role === 'k' ? 50000 : POWER_VALUE[piece.power];
    if (piece.power !== 'p' && piece.role !== 'k') {
      value += CENTER_BONUS[col] + CENTER_BONUS[row];
    }
    if (piece.power === 'p') {
      const advancement = piece.color === 'w' ? 6 - row : row - 1;
      value += Math.max(0, advancement) * 8;
    }
    if (piece.role === 'k') {
      const homeRow = piece.color === 'w' ? 7 : 0;
      if (row !== homeRow) value -= 25;
    }
    score += sign * value;
  }
  return score;
}

function orderMoves(moves) {
  return moves
    .map((move) => {
      let score = 0;
      if (move.captured) score += 1000 + POWER_VALUE[move.captured.power] * 10;
      if (move.promotion) score += 900;
      if (move.castle) score += 30;
      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

function negamax(state, depth, alpha, beta, deadline) {
  if (Date.now() > deadline) return evaluate(state) * (state.turn === 'w' ? 1 : -1);
  if (depth <= 0) return evaluate(state) * (state.turn === 'w' ? 1 : -1);
  const moves = getLegalMoves(state, state.turn);
  if (moves.length === 0) {
    if (isKingInCheck(state, state.turn)) return -100000 - depth * 100;
    return 0;
  }
  let best = -Infinity;
  for (const move of orderMoves(moves)) {
    const next = applyMoveFast(state, move);
    const score = -negamax(next, depth - 1, -beta, -alpha, deadline);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
    if (Date.now() > deadline) break;
  }
  return best;
}

export function chooseAiMove(state, { maxDepth = 2, timeBudget = 900 } = {}) {
  const color = state.turn;
  const moves = getLegalMoves(state, color);
  if (moves.length === 0) return null;
  const deadline = Date.now() + timeBudget;
  let bestMoves = [];
  let bestScore = -Infinity;

  for (const move of orderMoves(moves)) {
    if (Date.now() > deadline) break;
    const next = applyMoveFast(state, move);
    const score = -negamax(next, maxDepth - 1, -Infinity, Infinity, deadline);
    const jitter = Math.random() * 3;
    if (score + jitter > bestScore + 0.0001) {
      bestScore = score + jitter;
      bestMoves = [move];
    } else if (Math.abs(score + jitter - bestScore) < 0.001) {
      bestMoves.push(move);
    }
  }
  if (!bestMoves.length) return moves[0];
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

export function powerName(power) {
  return ROLE_NAMES[power] || power;
}
