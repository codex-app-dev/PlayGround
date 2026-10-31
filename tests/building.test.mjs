import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { Building } from '../src/building.js'
import { BUILD_COSTS, BUILD_MAX_HP, MATCH } from '../src/config.js'

function makeBuilding({ wood = 100, height = 5, obstacles = [] } = {}) {
  const scene = { add() {}, remove() {} }
  const world = {
    textures: { wood: new THREE.Texture(), metal: new THREE.Texture() },
    obstacles,
    dynamicObstacles: [],
    dynamicPlatforms: [],
    getHeight: () => height,
    addDynamicObstacle(box, ref) {
      const entry = { ...box, ref }
      this.dynamicObstacles.push(entry)
      return entry
    },
    addDynamicPlatform(box, ref) {
      const entry = { ...box, ref }
      this.dynamicPlatforms.push(entry)
      return entry
    },
    removeDynamicObstacle(entry) {
      const i = this.dynamicObstacles.indexOf(entry)
      if (i >= 0) this.dynamicObstacles.splice(i, 1)
    },
    removeDynamicPlatform(entry) {
      const i = this.dynamicPlatforms.indexOf(entry)
      if (i >= 0) this.dynamicPlatforms.splice(i, 1)
    }
  }
  const player = { pos: { x: 0, y: height, z: 0 }, yaw: 0, wood }
  return { building: new Building(scene, world, player, null, null, null), world, player }
}

test('piece bounds match the 4m grid', () => {
  const { building } = makeBuilding()
  const wall = building._boundsFor(0, 0, 5, 0, 'wall')
  assert.equal(wall.maxX - wall.minX, 4)
  assert.equal(wall.maxZ - wall.minZ, 0.32)
  assert.ok(Math.abs(wall.maxY - wall.minY - 3.15) < 1e-9)

  const wallRotated = building._boundsFor(0, 0, 5, Math.PI / 2, 'wall')
  assert.equal(wallRotated.maxX - wallRotated.minX, 0.32)
  assert.equal(wallRotated.maxZ - wallRotated.minZ, 4)

  const floor = building._boundsFor(0, 0, 5, 0, 'floor')
  assert.equal(floor.maxX - floor.minX, 4)
  assert.equal(floor.maxZ - floor.minZ, 4)

  const ramp = building._boundsFor(0, 0, 5, 0, 'ramp')
  assert.equal(ramp.maxZ - ramp.minZ, 5)
  assert.ok(Math.abs(ramp.maxY - ramp.minY - 3.15) < 1e-9)
})

test('validation accepts open ground and rejects water, poor players and overlap', () => {
  const { building, world, player } = makeBuilding()
  assert.equal(building._validate(4, 0, 5, 0, 'wall'), true)

  world.getHeight = () => 0
  assert.equal(building._validate(4, 0, 5, 0, 'wall'), false)

  world.getHeight = () => 5
  player.wood = BUILD_COSTS.wall - 1
  assert.equal(building._validate(4, 0, 5, 0, 'wall'), false)

  player.wood = 100
  world.obstacles = [{ minX: 3, maxX: 5, minY: 4, maxY: 8, minZ: -1, maxZ: 1, kind: 'plaster' }]
  assert.equal(building._validate(4, 0, 5, 0, 'wall'), false)
})

test('validation respects the structure cap and far placement', () => {
  const { building } = makeBuilding()
  building.structures = new Array(building.maxStructures).fill({ hp: 1, bounds: {} })
  assert.equal(building._validate(4, 0, 5, 0, 'wall'), false)

  building.structures = []
  assert.equal(building._validate(50, 0, 5, 0, 'wall'), false)
})

test('placing a wall spends wood and registers physics', () => {
  const { building, world, player } = makeBuilding({ wood: 100 })
  building.setActive(true)
  building.setPiece('wall')
  building.valid = true
  building.target.set(4, 0, 0)
  building.baseY = 5

  assert.equal(building.place(), true)
  assert.equal(player.wood, 100 - BUILD_COSTS.wall)
  assert.equal(building.structures.length, 1)
  assert.equal(building.structures[0].hp, BUILD_MAX_HP)
  assert.equal(world.dynamicObstacles.length, 1)
  assert.equal(world.dynamicPlatforms.length, 0)
})

test('inactive build mode cannot place', () => {
  const { building } = makeBuilding()
  building.valid = true
  assert.equal(building.place(), false)
})

test('building range uses the configured reach', () => {
  assert.ok(MATCH.buildRange > 0)
  const { building } = makeBuilding()
  assert.equal(building._validate(MATCH.buildRange, 0, 5, 0, 'wall'), true)
  assert.equal(building._validate(MATCH.buildRange + 3, 0, 5, 0, 'wall'), false)
})
