import { SITES } from './config.js'

/**
 * Hand-placed sites. Every structure is snapped to the flattened pad that
 * World builds underneath it, so buildings sit flush on the ground.
 */
export function buildSites(world, b) {
  const rng = seeded(90125)

  /* ---------------------------------------------------------------- */
  /* CROSSROADS — the central village and player spawn               */
  /* ---------------------------------------------------------------- */
  const crossroads = SITES[0]
  b.house({ x: -12, z: -8, rot: 0, w: 13, d: 10, floors: 2, wall: 'plaster', roof: 'gable', doorAt: 0.5, chimney: true })
  b.warehouse({ x: 16, z: -10, rot: Math.PI / 2, w: 20, d: 12, wall: 'metal' })
  b.shop({ x: 1, z: -29, rot: 0, w: 12, d: 9 })
  b.cabin({ x: -21, z: 15, rot: Math.PI / 2, w: 8, d: 7, wall: 'wood' })
  b.house({ x: 24, z: 17, rot: Math.PI, w: 9, d: 8, floors: 1, wall: 'plasterWarm', roof: 'flat', chimney: false })
  b.tower({ x: -29, z: -1, rot: 0.2, size: 6, h: 11 })
  // Plaza cover
  b.sandbagWall(6, 4, 0.3, 7, 3)
  b.sandbagWall(-4, 12, -0.15, 5, 2)
  b.vehicle({ x: 15, z: 8, rot: 2.4, key: 'metalBlue' })
  b.vehicle({ x: -9, z: 22, rot: -0.4, key: 'rust' })
  for (const [x, z, s] of [[-2, 2, 1.1], [3, -2, 0.9], [20, -22, 1.2], [-18, -16, 1.0], [10, 20, 1.4]]) {
    b.crate({ x, z, rot: rng() * 3, baseY: world.getHeight(x, z) }, 0.4, 0.2, world.getHeight(x, z) + 0.05, s)
  }
  b.barrel(-25, 8)
  b.barrel(-24.2, 8.8)
  b.barrel(21, 2)
  b.fence(-6, 34, 0.2, 8)
  for (const [x, z] of [[-30, -20], [33, -24], [38, 27], [-6, 42], [30, -1], [-40, 10]]) world.addBotSpawn(x, z)
  // Loot around the plaza
  addLoot(world, -8, 24, 'weapon')
  addLoot(world, 9, 12, 'armor')
  addLoot(world, -20, 8, 'ammo')
  addLoot(world, 2, -20, 'weapon')
  addLoot(world, 28, 25, 'medkit')
  addLoot(world, -33, 24, 'ammo')

  /* ---------------------------------------------------------------- */
  /* RIVERSIDE — lakeside houses and a long dock                     */
  /* ---------------------------------------------------------------- */
  b.house({ x: 106, z: 35, rot: 0.15, w: 12, d: 9, floors: 2, wall: 'plasterBlue', roof: 'gable', chimney: false })
  b.cabin({ x: 120, z: 52, rot: -0.3, w: 8, d: 7, wall: 'wood', roof: 'gable' })
  b.house({ x: 96, z: 60, rot: Math.PI / 2, w: 9, d: 8, floors: 1, wall: 'plasterWarm', roof: 'flat', chimney: false })
  b.dock(128, 66, -1.05, 17, 4.0)
  b.vehicle({ x: 112, z: 28, rot: 2.2, key: 'rust' })
  b.sandbagWall(104, 48, -0.4, 5, 2)
  b.barrel(118, 40)
  b.barrel(119, 41)
  b.silo({ x: 92, z: 29, r: 2.4, h: 9 })
  for (const [x, z] of [[98, 42], [122, 58], [130, 70], [110, 70], [88, 54]]) world.addBotSpawn(x, z)
  addLoot(world, 128, 64, 'weapon')
  addLoot(world, 105, 40, 'ammo')
  addLoot(world, 121, 53, 'medkit')

  /* ---------------------------------------------------------------- */
  /* HALLOW FARM — barn, silo, crop rows, fences                     */
  /* ---------------------------------------------------------------- */
  b.warehouse({ x: -105, z: 104, rot: 0.18, w: 18, d: 12, wall: 'woodDark', h: 6.2 })
  b.house({ x: -86, z: 84, rot: 0, w: 10, d: 8, floors: 2, wall: 'plasterWarm', roof: 'gable', chimney: true })
  b.silo({ x: -118, z: 86, r: 3, h: 13 })
  b.silo({ x: -112, z: 92, r: 2.2, h: 10 })
  b.vehicle({ x: -93, z: 111, rot: -0.6, key: 'rust' })
  b.vehicle({ x: -80, z: 97, rot: 2.7, key: 'metalBlue' })
  for (let i = 0; i < 5; i++) {
    b.fence(-120 + i * 11, 118, 0, 10)
    b.fence(-125, 92 + i * 7, Math.PI / 2, 7)
  }
  // Hay bales
  for (const [x, z] of [[-97, 95], [-94, 93], [-100, 99], [-84, 108]]) {
    const y = world.getHeight(x, z)
    b.cylinder('sandbag', 0.95, 0.95, 1.3, x, y + 0.65, z, { rx: Math.PI / 2, segments: 14, collide: true })
  }
  b.sandbagWall(-100, 84, 0.1, 6, 2)
  for (const [x, z] of [[-96, 78], [-108, 112], [-122, 78], [-82, 92], [-114, 118]]) world.addBotSpawn(x, z)
  addLoot(world, -105, 99, 'weapon')
  addLoot(world, -100, 90, 'ammo')
  addLoot(world, -88, 86, 'medkit')
  addLoot(world, -115, 100, 'armor')

  /* ---------------------------------------------------------------- */
  /* OLD TOWN — tight multi-storey blocks and alleys                 */
  /* ---------------------------------------------------------------- */
  b.house({ x: -158, z: -55, rot: 0, w: 12, d: 9, floors: 2, wall: 'plasterWarm', roof: 'flat', chimney: false })
  b.house({ x: -140, z: -52, rot: Math.PI, w: 11, d: 10, floors: 2, wall: 'plaster', roof: 'gable' })
  b.house({ x: -160, z: -29, rot: 0.1, w: 10, d: 8, floors: 2, wall: 'plasterBlue', roof: 'gable', chimney: false })
  b.house({ x: -134, z: -30, rot: -0.05, w: 9, d: 8, floors: 2, wall: 'plasterWarm', roof: 'flat', chimney: false })
  b.shop({ x: -148, z: -72, rot: Math.PI, w: 10, d: 8 })
  b.tower({ x: -171, z: -45, size: 5, h: 12 })
  b.vehicle({ x: -146, z: -42, rot: 1.4, key: 'rust' })
  for (const [x, z] of [[-166, -50], [-130, -44], [-154, -24], [-138, -70], [-170, -24], [-124, -58]]) world.addBotSpawn(x, z)
  for (let i = 0; i < 8; i++) addLoot(world, -160 + rng() * 34, -70 + rng() * 50, rng() > 0.7 ? 'armor' : rng() > 0.5 ? 'weapon' : 'ammo')

  /* ---------------------------------------------------------------- */
  /* QUARRY — industrial pits, containers and machinery              */
  /* ---------------------------------------------------------------- */
  b.warehouse({ x: 46, z: -160, rot: Math.PI / 2, w: 22, d: 13, wall: 'metalBlue', h: 6.6 })
  b.container({ x: 62, z: -180, rot: 0.3, rust: false })
  b.container({ x: 61, z: -175, rot: 0.3, rust: true })
  b.container({ x: 28, z: -151, rot: -0.4, rust: false })
  b.container({ x: 30, z: -146, rot: -0.4, rust: true })
  b.vehicle({ x: 38, z: -180, rot: 1.1, key: 'rust' })
  b.vehicle({ x: 70, z: -145, rot: 2.9, key: 'metalBlue' })
  b.silo({ x: 21, z: -170, r: 2.6, h: 11 })
  b.sandbagWall(55, -145, 0.2, 6, 2)
  // Rock piles at the pit edge
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2
    const r = 12 + rng() * 22
    const x = 48 + Math.cos(a) * r
    const z = -168 + Math.sin(a) * r
    const s = 0.9 + rng() * 2.4
    const y = world.getHeight(x, z)
    if (y < 1) continue
    b.box('rock', s, s * 0.75, s, x, y + s * 0.28, z, { ry: rng() * 6, collide: true })
  }
  for (const [x, z] of [[30, -168], [60, -152], [72, -170], [40, -142], [54, -184], [18, -156]]) world.addBotSpawn(x, z)
  addLoot(world, 46, -156, 'weapon')
  addLoot(world, 62, -177, 'ammo')
  addLoot(world, 30, -149, 'armor')
  addLoot(world, 55, -174, 'medkit')

  /* ---------------------------------------------------------------- */
  /* AIRFIELD — hangar, tower, containers, runway                    */
  /* ---------------------------------------------------------------- */
  b.hangar({ x: 176, z: -92, rot: 0.12, w: 30, d: 20 })
  b.controlTower({ x: 201, z: -66, rot: -0.1, w: 7, d: 7 })
  b.container({ x: 150, z: -80, rot: 0.15, rust: false })
  b.container({ x: 148, z: -74, rot: 0.15, rust: true })
  b.container({ x: 195, z: -110, rot: -0.3, rust: false })
  b.vehicle({ x: 160, z: -108, rot: 0.5, key: 'metalBlue' })
  b.vehicle({ x: 188, z: -56, rot: 2.5, key: 'rust' })
  b.fence(146, -108, 0, 12)
  b.fence(220, -108, Math.PI / 2, 12)
  b.sandbagWall(166, -74, 0.1, 7, 3)
  b.barrel(158, -88)
  b.barrel(159, -87)
  for (const [x, z] of [[160, -88], [190, -100], [208, -78], [150, -70], [176, -115], [214, -96]]) world.addBotSpawn(x, z)
  addLoot(world, 176, -88, 'weapon')
  addLoot(world, 201, -66, 'weapon')
  addLoot(world, 150, -77, 'ammo')
  addLoot(world, 195, -108, 'armor')
  addLoot(world, 162, -100, 'medkit')

  /* ---------------------------------------------------------------- */
  /* FIREBASE — military tents, watchtower, helipad                  */
  /* ---------------------------------------------------------------- */
  b.tent({ x: 22, z: 174, rot: 0.2, w: 6, d: 5 })
  b.tent({ x: 34, z: 176, rot: -0.3, w: 6, d: 5 })
  b.tent({ x: 28, z: 190, rot: Math.PI + 0.15, w: 6, d: 5 })
  b.tent({ x: 42, z: 192, rot: 0.1, w: 5, d: 4 })
  b.tower({ x: 48, z: 174, size: 5, h: 12 })
  b.helipad(25, 204)
  b.sandbagWall(34, 198, 0.15, 9, 3)
  b.sandbagWall(15, 190, -0.4, 6, 2)
  b.vehicle({ x: 45, z: 200, rot: 2.1, key: 'metalBlue' })
  b.container({ x: 54, z: 188, rot: 0.4, rust: true })
  b.barrel(38, 184)
  b.barrel(39, 185)
  for (const [x, z] of [[20, 182], [40, 182], [30, 200], [52, 196], [12, 194], [46, 208]]) world.addBotSpawn(x, z)
  addLoot(world, 30, 186, 'weapon')
  addLoot(world, 24, 178, 'ammo')
  addLoot(world, 42, 194, 'medkit')
  addLoot(world, 48, 176, 'weapon')
  addLoot(world, 25, 204, 'armor')

  /* ---------------------------------------------------------------- */
  /* Scattered roadside cabins                                       */
  /* ---------------------------------------------------------------- */
  const cabins = [
    [74, 6, 0.7], [-58, 50, -0.5], [-112, 18, 1.2], [110, -30, -0.2],
    [18, -70, 0.4], [142, 10, 2.2], [-70, 150, -0.9], [-170, 100, 0.2]
  ]
  for (const [x, z, rot] of cabins) {
    b.cabin({ x, z, rot, w: 7, d: 6, wall: 'wood', roof: 'gable', chimney: false })
    b.barrel(x + 4, z + 2)
    world.addBotSpawn(x + 5, z - 5)
    addLoot(world, x, z + 3, rng() > 0.5 ? 'ammo' : 'medkit')
  }
}

function addLoot(world, x, z, kind) {
  world.addLootPoint(x, world.getHeight(x, z) + 0.07, z, kind)
}

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
