import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getLegalMoves,
  getMoveFor,
  applyMove,
  indexOf,
  getGameStatus,
  isKingInCheck,
  findKing,
  chooseAiMove,
} from '../engine.js';

test('initial position has 20 legal moves', () => {
  assert.equal(getLegalMoves(createInitialState()).length, 20);
});

test('a capture transfers the victim power to the capturer', () => {
  let state = createInitialState();
  state = applyMove(state, getMoveFor(state, indexOf(6, 4), indexOf(4, 4))); // e4
  state = applyMove(state, getMoveFor(state, indexOf(1, 3), indexOf(3, 3))); // d5
  state = applyMove(state, getMoveFor(state, indexOf(4, 4), indexOf(3, 3))); // exd5
  state = applyMove(state, getMoveFor(state, indexOf(0, 3), indexOf(3, 3))); // Qxd5

  const queen = state.board[indexOf(3, 3)];
  assert.equal(queen.role, 'q');
  assert.equal(queen.power, 'p');
  assert.equal(state.captured.w.length, 1);
});

test('en passant removes the pawn behind the target square', () => {
  let state = createInitialState();
  state = applyMove(state, getMoveFor(state, indexOf(6, 4), indexOf(4, 4))); // e4
  state = applyMove(state, getMoveFor(state, indexOf(1, 0), indexOf(3, 0))); // a5
  state = applyMove(state, getMoveFor(state, indexOf(4, 4), indexOf(3, 4))); // e5
  state = applyMove(state, getMoveFor(state, indexOf(1, 3), indexOf(3, 3))); // d5

  const enPassant = getMoveFor(state, indexOf(3, 4), indexOf(2, 3));
  assert.ok(enPassant?.enPassant);
  state = applyMove(state, enPassant);
  assert.equal(state.board[indexOf(2, 3)].role, 'p');
  assert.equal(state.board[indexOf(3, 3)], null);
});

test('castling requires a king and rook that still move as themselves', () => {
  let state = createInitialState();
  state = applyMove(state, getMoveFor(state, indexOf(6, 4), indexOf(4, 4))); // e4
  state = applyMove(state, getMoveFor(state, indexOf(1, 4), indexOf(3, 4))); // e5
  state = applyMove(state, getMoveFor(state, indexOf(7, 6), indexOf(5, 5))); // Nf3
  state = applyMove(state, getMoveFor(state, indexOf(0, 1), indexOf(2, 2))); // Nc6
  state = applyMove(state, getMoveFor(state, indexOf(7, 5), indexOf(4, 2))); // Bc4
  state = applyMove(state, getMoveFor(state, indexOf(0, 5), indexOf(3, 2))); // Bc5

  const castle = getMoveFor(state, indexOf(7, 4), indexOf(7, 6));
  assert.equal(castle?.castle, 'king');
});

test('fool\'s mate is reported as checkmate', () => {
  let state = createInitialState();
  state = applyMove(state, getMoveFor(state, indexOf(6, 5), indexOf(5, 5))); // f3
  state = applyMove(state, getMoveFor(state, indexOf(1, 4), indexOf(3, 4))); // e5
  state = applyMove(state, getMoveFor(state, indexOf(6, 6), indexOf(4, 6))); // g4
  state = applyMove(state, getMoveFor(state, indexOf(0, 3), indexOf(4, 7))); // Qh4#

  assert.equal(state.status.over, true);
  assert.equal(state.status.reason, 'checkmate');
  assert.equal(state.status.result, 'b');
});

test('stalemate is a draw', () => {
  const state = createInitialState();
  state.board = Array(64).fill(null);
  state.board[indexOf(0, 0)] = { id: 'bk', color: 'b', role: 'k', power: 'k', hasMoved: true, row: 0, col: 0 };
  state.board[indexOf(2, 1)] = { id: 'wq', color: 'w', role: 'q', power: 'q', hasMoved: true, row: 2, col: 1 };
  state.board[indexOf(7, 7)] = { id: 'wk', color: 'w', role: 'k', power: 'k', hasMoved: true, row: 7, col: 7 };
  state.turn = 'b';

  const status = getGameStatus(state);
  assert.equal(status.over, true);
  assert.equal(status.reason, 'stalemate');
  assert.equal(isKingInCheck(state, 'b'), false);
});

test('a king remains identifiable after swapping its power', () => {
  let state = createInitialState();
  state.board = Array(64).fill(null);
  state.board[indexOf(4, 4)] = { id: 'wk', color: 'w', role: 'k', power: 'k', hasMoved: true, row: 4, col: 4 };
  state.board[indexOf(4, 5)] = { id: 'br', color: 'b', role: 'r', power: 'r', hasMoved: true, row: 4, col: 5 };
  state.board[indexOf(0, 0)] = { id: 'bk', color: 'b', role: 'k', power: 'k', hasMoved: true, row: 0, col: 0 };
  state.turn = 'w';

  const capture = getMoveFor(state, indexOf(4, 4), indexOf(4, 5));
  assert.ok(capture);
  state = applyMove(state, capture);
  assert.equal(state.board[indexOf(4, 5)].power, 'r');
  assert.equal(findKing(state, 'w'), indexOf(4, 5));
});

test('the AI always returns a legal move', () => {
  let state = createInitialState();
  for (let i = 0; i < 12; i += 1) {
    const legal = getLegalMoves(state);
    if (!legal.length) break;
    const move = chooseAiMove(state, { maxDepth: 1, timeBudget: 250 });
    assert.ok(legal.some((candidate) => candidate.from === move.from && candidate.to === move.to));
    state = applyMove(state, move);
  }
});
