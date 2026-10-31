import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clamp,
  lerp,
  invLerp,
  smoothstep,
  damp,
  mod,
  mulberry32,
  shuffle,
  formatTime,
  angleDelta,
  rayAABB,
  raySphere,
  pointInCircle,
  resolveCircleBox,
  sampleGrid,
  weightedPick
} from '../src/utils.js'

test('scalar helpers', () => {
  assert.equal(clamp(5, 0, 1), 1)
  assert.equal(clamp(-2, 0, 1), 0)
  assert.equal(clamp(0.4, 0, 1), 0.4)
  assert.equal(lerp(10, 20, 0.25), 12.5)
  assert.equal(invLerp(10, 20, 15), 0.5)
  assert.equal(invLerp(5, 5, 9), 0)
  assert.equal(smoothstep(0, 1, -1), 0)
  assert.equal(smoothstep(0, 1, 2), 1)
  assert.equal(smoothstep(0, 1, 0.5), 0.5)
  assert.ok(damp(0, 10, 10, 1) > 9.9)
  assert.equal(mod(-1, 8), 7)
})

test('deterministic RNG and shuffle do not mutate input', () => {
  const a = mulberry32(1234)
  const b = mulberry32(1234)
  const seqA = Array.from({ length: 8 }, () => a())
  const seqB = Array.from({ length: 8 }, () => b())
  assert.deepEqual(seqA, seqB)
  assert.ok(seqA.every((v) => v >= 0 && v < 1))

  const input = [1, 2, 3, 4, 5]
  const shuffled = shuffle(mulberry32(7), input)
  assert.deepEqual(input, [1, 2, 3, 4, 5])
  assert.deepEqual([...shuffled].sort(), input)
})

test('formatTime clamps and pads', () => {
  assert.equal(formatTime(0), '0:00')
  assert.equal(formatTime(9.9), '0:09')
  assert.equal(formatTime(65), '1:05')
  assert.equal(formatTime(600), '10:00')
  assert.equal(formatTime(-3), '0:00')
})

test('angleDelta returns the shortest signed arc', () => {
  assert.ok(Math.abs(angleDelta(0, 0.1) - 0.1) < 1e-9)
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9)
  assert.ok(Math.abs(angleDelta(0, Math.PI * 2)) < 1e-9)
})

test('rayAABB hits, misses and respects maxDist', () => {
  const box = { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1 }
  assert.equal(rayAABB(0, 0, 5, 0, 0, -1, box), 4)
  assert.equal(rayAABB(0, 0, 5, 0, 0, 1, box), null)
  assert.equal(rayAABB(0, 0, 5, 0, 0, -1, box, 2), null)
  assert.equal(rayAABB(5, 5, 5, 0, 0, -1, box), null)
})

test('raySphere returns the near intersection', () => {
  const t = raySphere(0, 0, 5, 0, 0, -1, 0, 0, 0, 1)
  assert.ok(t !== null && Math.abs(t - 4) < 1e-9)
  assert.equal(raySphere(0, 0, 5, 0, 0, 1, 0, 0, 0, 1), null)
  assert.equal(raySphere(0, 0, 5, 0, 0, -1, 0, 0, 0, 1, 2), null)
})

test('circle and box resolve helpers', () => {
  assert.equal(pointInCircle(1, 1, 0, 0, 2), true)
  assert.equal(pointInCircle(2.1, 0, 0, 0, 2), false)

  const box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }
  const push = resolveCircleBox(0.9, 0, 0.5, box)
  assert.ok(push)
  assert.ok(push.x > 1)
  assert.equal(resolveCircleBox(5, 5, 0.5, box), null)
})

test('sampleGrid interpolates a known grid and clamps at edges', () => {
  // 3x3 grid, 2 cells, size 2 => values at x,z in [-1, 1]
  const grid = new Float32Array([
    0, 1, 2,
    10, 11, 12,
    20, 21, 22
  ])
  assert.equal(sampleGrid(grid, 2, 2, -1, -1), 0)
  assert.equal(sampleGrid(grid, 2, 2, 0, -1), 1)
  assert.equal(sampleGrid(grid, 2, 2, 0, 0), 11)
  assert.equal(sampleGrid(grid, 2, 2, 1, 1), 22)
  assert.equal(sampleGrid(grid, 2, 2, 0.5, 0), 11.5)
  // Points far outside clamp to the edge cells.
  assert.equal(sampleGrid(grid, 2, 2, 99, 99), 22)
})

test('weightedPick respects zero weights', () => {
  const rng = mulberry32(99)
  const entries = [{ id: 'a', weight: 0 }, { id: 'b', weight: 5 }]
  for (let i = 0; i < 50; i++) assert.equal(weightedPick(rng, entries).id, 'b')
})
