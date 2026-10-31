import test from 'node:test'
import assert from 'node:assert/strict'
import { Zone } from '../src/zone.js'
import { ZONE_PHASES, ZONE_START_RADIUS } from '../src/config.js'

function makeZone() {
  const scene = { add() {} }
  return new Zone(scene, null)
}

test('zone starts centered with the configured radius', () => {
  const zone = makeZone()
  zone.reset()
  assert.equal(zone.radius, ZONE_START_RADIUS)
  assert.equal(zone.state, 'wait')
  assert.equal(zone.timer, ZONE_PHASES[0].wait)
  assert.equal(zone.outside(0, 0), false)
  assert.equal(zone.outside(0, ZONE_START_RADIUS + 1), true)
  assert.equal(zone.distanceInside(0, 0), ZONE_START_RADIUS)
  assert.equal(zone.damagePerSecond(), ZONE_PHASES[0].dps)
})

test('zone shrinks to the next phase radius and advances the phase', () => {
  const zone = makeZone()
  zone.reset()
  zone.start()
  zone.startShrink()
  assert.equal(zone.state, 'shrink')
  assert.equal(zone.targetRadius, ZONE_PHASES[0].radius)

  const step = 0.25
  let guard = 0
  while (zone.state === 'shrink' && guard++ < 1000) zone.update(step)

  assert.equal(zone.radius, ZONE_PHASES[0].radius)
  assert.equal(zone.state, 'wait')
  assert.equal(zone.phaseIndex, 1)
  assert.equal(zone.timer, ZONE_PHASES[1].wait)
  assert.equal(zone.damagePerSecond(), ZONE_PHASES[1].dps)
})

test('zone closure is monotonic across every phase', () => {
  const zone = makeZone()
  zone.reset()
  zone.start()
  const radii = [zone.radius]
  for (let phase = 0; phase < ZONE_PHASES.length; phase++) {
    // Burn the wait timer, then the shrink timer.
    zone.timer = 0
    zone.update(0.016)
    if (zone.state === 'shrink') {
      while (zone.state === 'shrink') {
        zone.update(1)
        radii.push(zone.radius)
      }
    }
  }
  for (let i = 1; i < radii.length; i++) {
    assert.ok(radii[i] <= radii[i - 1] + 1e-9, 'radius must never grow')
  }
  assert.ok(zone.final)
  assert.equal(zone.countdown, 'FINAL')
  assert.equal(zone.phaseLabel, 'FINAL ZONE')
})

test('zone center confinement follows the animated center', () => {
  const zone = makeZone()
  zone.reset()
  zone.center = { x: 40, z: -25 }
  zone.radius = 50
  assert.equal(zone.outside(40, -25), false)
  assert.equal(zone.outside(90.1, -25), true)
  assert.equal(zone.distanceInside(70, -25), 20)
})
