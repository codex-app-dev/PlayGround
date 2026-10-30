import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  legalMoves,
  makeMove,
  movesFrom,
  parseSquare,
  isInCheck,
  getPseudoMoves,
  chooseMove,
  POWER_META,
} from '../engine/engine.js';

function emptyState(pieces, turn = 'w') {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  let n = 0;
  for (const spec of pieces) {
    const [r, c] = parseSquare(spec.square);
    board[r][c] = {
      id: `t${++n}`,
      side: spec.side,
      identity: spec.identity,
      power: spec.power || spec.identity,
    };
  }
  return { board, turn, status: 'playing', winner: null, check: false, lastMove: null, ply: 0 };
}

const kings = [
  { square: 'a1', side: 'w', identity: 'king' },
  { square: 'h8', side: 'b', identity: 'king' },
];

test('initial position has twenty legal moves and no castling', () => {
  const game = createGame();
  const moves = legalMoves(game);
  assert.equal(moves.length, 20);
  assert.equal(POWER_META.queen.value, 9);
});

test('pawns may double-step from home rank only', () => {
  const game = createGame();
  const e2 = movesFrom(game, ...parseSquare('e2'));
  assert.ok(e2.some((m) => m.to.join() === parseSquare('e4').join()));
  assert.ok(e2.some((m) => m.to.join() === parseSquare('e3').join()));
  assert.ok(!e2.some((m) => m.to.join() === parseSquare('e5').join()));
});

test('capture swaps powers onto the capturing piece', () => {
  const game = emptyState([
    ...kings,
    { square: 'a1', side: 'w', identity: 'rook' },
    { square: 'd1', side: 'b', identity: 'knight' },
  ]);
  const result = makeMove(game, parseSquare('a1'), parseSquare('d1'));
  assert.ok(result);
  const capturer = result.state.board[7][3];
  assert.equal(capturer.identity, 'rook');
  assert.equal(capturer.power, 'knight');
  assert.equal(result.record.swap, true);
  assert.equal(result.record.powerBefore, 'rook');
  assert.equal(result.record.powerAfter, 'knight');
  assert.equal(result.record.capturedPower, 'knight');
  assert.equal(result.captured.identity, 'knight');
});

test('non-captures keep the moving piece power', () => {
  const game = emptyState([
    ...kings,
    { square: 'a1', side: 'w', identity: 'rook' },
  ]);
  const result = makeMove(game, parseSquare('a1'), parseSquare('a4'));
  assert.ok(result);
  assert.equal(result.state.board[4][0].power, 'rook');
});

test('pawn power promotes to queen power on the far rank', () => {
  const game = emptyState([
    ...kings,
    { square: 'b7', side: 'w', identity: 'rook', power: 'pawn' },
  ]);
  const result = makeMove(game, parseSquare('b7'), parseSquare('b8'));
  assert.ok(result);
  assert.equal(result.state.board[0][1].power, 'queen');
  assert.equal(result.record.promoted, true);
});

test('capturing a pawn power on the far rank promotes the inherited power', () => {
  const game = emptyState([
    ...kings,
    { square: 'a8', side: 'w', identity: 'bishop', power: 'rook' },
    { square: 'b8', side: 'b', identity: 'knight', power: 'pawn' },
  ]);
  const result = makeMove(game, parseSquare('a8'), parseSquare('b8'));
  assert.ok(result);
  assert.equal(result.state.board[0][1].power, 'queen');
  assert.equal(result.record.promoted, true);
});

test('king can capture and lose its king power', () => {
  const game = emptyState([
    { square: 'e1', side: 'w', identity: 'king' },
    { square: 'e2', side: 'b', identity: 'knight' },
    { square: 'h8', side: 'b', identity: 'king' },
  ]);
  const result = makeMove(game, parseSquare('e1'), parseSquare('e2'));
  assert.ok(result);
  assert.equal(result.state.board[6][4].identity, 'king');
  assert.equal(result.state.board[6][4].power, 'knight');
});

test('a pinned piece may not expose its king', () => {
  const game = emptyState([
    { square: 'e1', side: 'w', identity: 'king' },
    { square: 'e2', side: 'w', identity: 'rook' },
    { square: 'e8', side: 'b', identity: 'rook' },
    { square: 'h8', side: 'b', identity: 'king' },
  ]);
  const moves = movesFrom(game, ...parseSquare('e2'));
  assert.ok(!moves.some((m) => m.to.join() === parseSquare('d2').join()));
  assert.ok(moves.some((m) => m.to.join() === parseSquare('e8').join()));
});

test('kings are never offered as capture targets', () => {
  const game = emptyState([
    { square: 'e5', side: 'w', identity: 'king' },
    { square: 'd4', side: 'b', identity: 'queen' },
    { square: 'h8', side: 'b', identity: 'king' },
  ]);
  const moves = getPseudoMoves(game.board, ...parseSquare('d4'));
  assert.ok(!moves.some((m) => m.to.join() === parseSquare('e5').join()));
  assert.ok(isInCheck(game.board, 'w'));
});

test("fool's mate is checkmate in swap chess", () => {
  let game = createGame();
  const play = (from, to) => {
    const result = makeMove(game, parseSquare(from), parseSquare(to));
    assert.ok(result, `${from}${to} should be legal`);
    game = result.state;
  };
  play('f2', 'f3');
  play('e7', 'e5');
  play('g2', 'g4');
  play('d8', 'h4');
  assert.equal(game.status, 'checkmate');
  assert.equal(game.winner, 'b');
  assert.equal(legalMoves(game).length, 0);
});

test('king has no castling move even on an open rank', () => {
  const game = emptyState([
    { square: 'e1', side: 'w', identity: 'king' },
    { square: 'a1', side: 'w', identity: 'rook' },
    { square: 'h1', side: 'w', identity: 'rook' },
    { square: 'h8', side: 'b', identity: 'king' },
  ]);
  const moves = movesFrom(game, ...parseSquare('e1'));
  assert.ok(!moves.some((m) => m.to.join() === parseSquare('g1').join()));
});

test('the bot returns a legal move from the opening', () => {
  const game = createGame();
  const pick = chooseMove(game, { depth: 2, random: () => 0 });
  assert.ok(pick);
  const legal = legalMoves(game);
  assert.ok(legal.some((m) => m.from.join() === pick.from.join() && m.to.join() === pick.to.join()));
});
