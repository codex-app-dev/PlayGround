// SWAP CHESS — rules engine
// Every capture exchanges the two pieces' movement powers.
// The captured piece leaves the board; the capturer inherits its power.

export const FILES = 'abcdefgh';

export const POWERS = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

export const POWER_META = {
  pawn: { label: 'Pawn', value: 1, hint: 'Steps forward · captures diagonally · promotes' },
  knight: { label: 'Knight', value: 3, hint: 'Leaps in an L' },
  bishop: { label: 'Bishop', value: 3, hint: 'Slides diagonally' },
  rook: { label: 'Rook', value: 5, hint: 'Slides in straight lines' },
  queen: { label: 'Queen', value: 9, hint: 'Slides any direction' },
  king: { label: 'King', value: 0, hint: 'Steps one square any direction' },
};

const BACK_RANK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const ROOK_RAYS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_RAYS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_RAYS = [...ROOK_RAYS, ...BISHOP_RAYS];

const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = (side) => (side === 'w' ? 'b' : 'w');

export const squareName = (r, c) => FILES[c] + (8 - r);

export function parseSquare(name) {
  const c = FILES.indexOf(name[0]);
  const r = 8 - Number(name[1]);
  if (c < 0 || r < 0 || r > 7) throw new Error(`Bad square: ${name}`);
  return [r, c];
}

export function createGame() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  let id = 0;
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = { id: `b${++id}`, side: 'b', identity: BACK_RANK[c], power: BACK_RANK[c] };
    board[1][c] = { id: `b${++id}`, side: 'b', identity: 'pawn', power: 'pawn' };
    board[6][c] = { id: `w${++id}`, side: 'w', identity: 'pawn', power: 'pawn' };
    board[7][c] = { id: `w${++id}`, side: 'w', identity: BACK_RANK[c], power: BACK_RANK[c] };
  }
  return {
    board,
    turn: 'w',
    status: 'playing',
    winner: null,
    check: false,
    lastMove: null,
    ply: 0,
  };
}

export function cloneState(state) {
  return {
    board: state.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: state.turn,
    status: state.status,
    winner: state.winner,
    check: state.check,
    lastMove: state.lastMove
      ? { ...state.lastMove, from: [...state.lastMove.from], to: [...state.lastMove.to] }
      : null,
    ply: state.ply,
  };
}

export function findKing(board, side) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p && p.side === side && p.identity === 'king') return { r, c };
    }
  }
  return null;
}

function attacksSquare(board, r, c, tr, tc) {
  const p = board[r][c];
  if (!p) return false;
  const dr = tr - r;
  const dc = tc - c;

  if (p.power === 'pawn') {
    const dir = p.side === 'w' ? -1 : 1;
    return dr === dir && Math.abs(dc) === 1;
  }
  if (p.power === 'knight') {
    return KNIGHT_OFFSETS.some(([a, b]) => a === dr && b === dc);
  }
  if (p.power === 'king') {
    return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  }

  let rays = null;
  if (p.power === 'rook') rays = ROOK_RAYS;
  else if (p.power === 'bishop') rays = BISHOP_RAYS;
  else if (p.power === 'queen') rays = QUEEN_RAYS;
  if (!rays) return false;

  for (const [sr, sc] of rays) {
    let rr = r + sr;
    let cc = c + sc;
    while (inBounds(rr, cc)) {
      if (rr === tr && cc === tc) return true;
      if (board[rr][cc]) break;
      rr += sr;
      cc += sc;
    }
  }
  return false;
}

export function isSquareAttacked(board, tr, tc, bySide) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p && p.side === bySide && attacksSquare(board, r, c, tr, tc)) return true;
    }
  }
  return false;
}

export function isInCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return false;
  return isSquareAttacked(board, king.r, king.c, other(side));
}

export function getPseudoMoves(board, r, c) {
  const p = board[r][c];
  if (!p) return [];
  const moves = [];
  const add = (rr, cc) => {
    const target = board[rr][cc];
    if (target && target.identity === 'king') return false;
    if (target && target.side === p.side) return false;
    moves.push({ from: [r, c], to: [rr, cc], capture: target ? { ...target } : null });
    return !target;
  };

  if (p.power === 'pawn') {
    const dir = p.side === 'w' ? -1 : 1;
    const startRow = p.side === 'w' ? 6 : 1;
    const one = r + dir;
    if (inBounds(one, c) && !board[one][c]) {
      add(one, c);
      const two = r + 2 * dir;
      if (r === startRow && inBounds(two, c) && !board[two][c]) add(two, c);
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir;
      const cc = c + dc;
      if (!inBounds(rr, cc)) continue;
      const target = board[rr][cc];
      if (target && target.side !== p.side && target.identity !== 'king') {
        moves.push({ from: [r, c], to: [rr, cc], capture: { ...target } });
      }
    }
    return moves;
  }

  if (p.power === 'knight' || p.power === 'king') {
    const offsets = p.power === 'knight' ? KNIGHT_OFFSETS : KING_OFFSETS;
    for (const [dr, dc] of offsets) {
      const rr = r + dr;
      const cc = c + dc;
      if (inBounds(rr, cc)) add(rr, cc);
    }
    return moves;
  }

  const rays = p.power === 'rook' ? ROOK_RAYS : p.power === 'bishop' ? BISHOP_RAYS : QUEEN_RAYS;
  for (const [dr, dc] of rays) {
    let rr = r + dr;
    let cc = c + dc;
    while (inBounds(rr, cc)) {
      const target = board[rr][cc];
      if (!target) {
        moves.push({ from: [r, c], to: [rr, cc], capture: null });
      } else {
        if (target.side !== p.side && target.identity !== 'king') {
          moves.push({ from: [r, c], to: [rr, cc], capture: { ...target } });
        }
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  return moves;
}

export function applyMove(state, move) {
  const next = cloneState(state);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = next.board[fr][fc];
  const captured = next.board[tr][tc];

  const powerBefore = piece.power;
  next.board[fr][fc] = null;
  next.board[tr][tc] = piece;

  if (captured) piece.power = captured.power;

  let promoted = false;
  const promotionRow = piece.side === 'w' ? 0 : 7;
  if (piece.power === 'pawn' && tr === promotionRow) {
    piece.power = 'queen';
    promoted = true;
  }

  next.turn = other(piece.side);
  next.ply = state.ply + 1;
  next.lastMove = {
    from: [fr, fc],
    to: [tr, tc],
    side: piece.side,
    pieceId: piece.id,
    identity: piece.identity,
    capturedId: captured ? captured.id : null,
    capturedPower: captured ? captured.power : null,
    powerBefore,
    powerAfter: piece.power,
    swap: Boolean(captured),
    promoted,
  };

  return { state: next, captured, powerBefore, powerAfter: piece.power, promoted };
}

export function legalMoves(state, side = state.turn) {
  const moves = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.side !== side) continue;
      for (const move of getPseudoMoves(state.board, r, c)) {
        const { state: next } = applyMove(state, move);
        const king = findKing(next.board, side);
        if (!king) {
          moves.push(move);
        } else if (!isSquareAttacked(next.board, king.r, king.c, other(side))) {
          moves.push(move);
        }
      }
    }
  }
  return moves;
}

export function movesFrom(state, r, c) {
  const p = state.board[r][c];
  if (!p || p.side !== state.turn) return [];
  return getPseudoMoves(state.board, r, c).filter((move) => {
    const { state: next } = applyMove(state, move);
    const king = findKing(next.board, p.side);
    return !king || !isSquareAttacked(next.board, king.r, king.c, other(p.side));
  });
}

export function makeMove(state, from, to) {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const move = movesFrom(state, fr, fc).find((m) => m.to[0] === tr && m.to[1] === tc);
  if (!move) return null;

  const result = applyMove(state, move);
  const next = result.state;
  const replies = legalMoves(next, next.turn);
  const check = isInCheck(next.board, next.turn);
  next.check = check;

  if (replies.length === 0) {
    if (check) {
      next.status = 'checkmate';
      next.winner = other(next.turn);
    } else {
      next.status = 'stalemate';
      next.winner = null;
    }
  } else {
    next.status = check ? 'check' : 'playing';
  }

  const record = {
    ...next.lastMove,
    check,
    checkmate: next.status === 'checkmate',
    stalemate: next.status === 'stalemate',
    status: next.status,
    ply: next.ply,
  };

  return { state: next, record, move, captured: result.captured, replies };
}

export function material(state) {
  let white = 0;
  let black = 0;
  for (const row of state.board) {
    for (const p of row) {
      if (!p) continue;
      const value = POWER_META[p.power].value;
      if (p.side === 'w') white += value;
      else black += value;
    }
  }
  return { white, black, diff: white - black };
}

function evaluate(state) {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p) continue;
      let value = POWER_META[p.power].value;
      if (p.power === 'pawn') {
        value += (p.side === 'w' ? 6 - r : r - 1) * 0.07;
      }
      const center = 3.5 - Math.max(Math.abs(c - 3.5), Math.abs(r - 3.5));
      value += center * 0.035;
      score += p.side === 'w' ? value : -value;
    }
  }
  return state.turn === 'w' ? score : -score;
}

const MATE = 1_000_000;

function orderMoves(state, moves) {
  return moves
    .map((move) => {
      const captured = state.board[move.to[0]][move.to[1]];
      let score = captured ? POWER_META[captured.power].value * 10 : 0;
      const mover = state.board[move.from[0]][move.from[1]];
      if (mover && mover.power === 'pawn' && (move.to[0] === 0 || move.to[0] === 7)) score += 8;
      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

function negamax(state, depth, alpha, beta, ply) {
  if (depth <= 0) return evaluate(state);
  const moves = legalMoves(state);
  if (moves.length === 0) {
    return isInCheck(state.board, state.turn) ? -MATE + ply : 0;
  }
  let best = -Infinity;
  for (const move of orderMoves(state, moves)) {
    const { state: next } = applyMove(state, move);
    const score = -negamax(next, depth - 1, -beta, -alpha, ply + 1);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(state, { depth = 2, random = Math.random } = {}) {
  const moves = legalMoves(state);
  if (!moves.length) return null;

  let bestScore = -Infinity;
  let best = [];
  for (const move of orderMoves(state, moves)) {
    const { state: next } = applyMove(state, move);
    const score = -negamax(next, depth - 1, -Infinity, Infinity, 1);
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  const pick = best[Math.floor(random() * best.length)] || moves[0];
  return { from: pick.from, to: pick.to };
}
