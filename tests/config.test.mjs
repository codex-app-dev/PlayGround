import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MATCH,
  WEAPONS,
  WEAPON_IDS,
  LOOT_WEIGHTS,
  ZONE_PHASES,
  ZONE_START_RADIUS,
  BUILD_COSTS,
  BUILD_PIECES,
  BOT_NAMES,
  SITES,
  LAKES,
  RARITY
} from '../src/config.js'

test('match is a 30-player solo with 29 bots', () => {
  assert.equal(MATCH.botCount, 29)
  assert.equal(MATCH.totalPlayers, 30)
  assert.equal(MATCH.botCount + 1, MATCH.totalPlayers)
  assert.ok(MATCH.matchTimeLimit > 0)
  assert.ok(MATCH.spawnWood >= BUILD_COSTS.wall)
})

test('weapon table is internally consistent', () => {
  assert.equal(WEAPON_IDS.length, 5)
  for (const id of WEAPON_IDS) {
    const def = WEAPONS[id]
    assert.equal(def.id, id)
    assert.ok(def.name.length > 0)
    assert.ok(def.damage > 0)
    assert.ok(def.rpm > 0)
    assert.ok(def.mag > 0)
    assert.ok(def.reserve >= 0)
    assert.ok(def.reload > 0)
    assert.ok(def.spread >= def.adsSpread)
    assert.equal(def.falloff.length, 2)
    assert.ok(def.falloff[0] < def.falloff[1])
    assert.ok(def.tracer >= 0 && def.tracer <= 0xffffff)
  }
})

test('loot weights reference real weapons and are positive', () => {
  const ids = new Set(LOOT_WEIGHTS.map((entry) => entry.id))
  assert.deepEqual([...ids].sort(), [...WEAPON_IDS].sort())
  for (const entry of LOOT_WEIGHTS) assert.ok(entry.weight > 0)
})

test('zone phases close monotonically into a final circle', () => {
  let previous = ZONE_START_RADIUS
  for (const phase of ZONE_PHASES) {
    assert.ok(phase.radius < previous, 'radius must shrink every phase')
    assert.ok(phase.wait > 0)
    assert.ok(phase.shrink > 0)
    assert.ok(phase.dps > 0)
    previous = phase.radius
  }
  assert.ok(ZONE_START_RADIUS > 0)
  assert.ok(ZONE_PHASES.at(-1).radius < 10)
})

test('build pieces each have a wood cost', () => {
  assert.ok(BUILD_PIECES.length >= 3)
  for (const piece of BUILD_PIECES) assert.ok(BUILD_COSTS[piece] > 0)
})

test('bot names are unique and cover the roster', () => {
  assert.equal(new Set(BOT_NAMES).size, BOT_NAMES.length)
  assert.ok(BOT_NAMES.length >= MATCH.botCount)
})

test('sites and lakes are unique and inside the map bounds', () => {
  const ids = new Set(SITES.map((site) => site.id))
  assert.equal(ids.size, SITES.length)
  assert.ok(SITES.length >= 7)
  for (const site of SITES) {
    assert.ok(Math.hypot(site.x, site.z) < 380)
    assert.ok(site.radius > 0 && site.flatten >= site.radius)
  }
  for (const lake of LAKES) {
    assert.ok(lake.radius > 0 && lake.depth > 0)
  }
})

test('every weapon has rarity presentation data', () => {
  for (const id of WEAPON_IDS) {
    assert.ok(RARITY[id], `missing rarity for ${id}`)
    assert.match(RARITY[id].color, /^#[0-9a-f]{6}$/i)
  }
})
