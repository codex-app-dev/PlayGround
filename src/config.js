// Pure gameplay data — no three.js imports so tests can load it in node.

export const MATCH = {
  botCount: 29,
  totalPlayers: 30,
  spawnWood: 40,
  playerHealth: 100,
  playerArmor: 0,
  medkitHeal: 45,
  medkitTime: 2.4,
  interactRange: 3.1,
  harvestRange: 4.4,
  eyeHeight: 1.68,
  crouchEyeHeight: 1.05,
  playerRadius: 0.42,
  playerHeight: 1.8,
  walkSpeed: 5.1,
  sprintSpeed: 7.6,
  crouchSpeed: 2.5,
  adsSpeed: 3.6,
  jumpSpeed: 7.2,
  gravity: 23,
  buildRange: 6.4,
  buildGrid: 4,
  matchTimeLimit: 480
}

export const WEAPONS = {
  p92: {
    id: 'p92', name: 'P92', class: 'PISTOL', slot: 2, auto: false,
    damage: 26, headMult: 2.3, rpm: 390, mag: 15, reserve: 60,
    spread: 0.016, adsSpread: 0.005, recoil: 1.5, recoilYaw: 0.5, reload: 1.55,
    pellets: 1, falloff: [28, 70], falloffMin: 0.55, tracer: 0xffd48a,
    adsFov: 62, weight: 1
  },
  ump45: {
    id: 'ump45', name: 'UMP45', class: 'SMG', slot: 1, auto: true,
    damage: 23, headMult: 2.0, rpm: 620, mag: 25, reserve: 100,
    spread: 0.024, adsSpread: 0.011, recoil: 1.1, recoilYaw: 0.85, reload: 2.0,
    pellets: 1, falloff: [38, 95], falloffMin: 0.55, tracer: 0xffcf7a,
    adsFov: 58, weight: 1.2
  },
  m416: {
    id: 'm416', name: 'M416', class: 'RIFLE', slot: 1, auto: true,
    damage: 31, headMult: 2.2, rpm: 700, mag: 30, reserve: 120,
    spread: 0.019, adsSpread: 0.0055, recoil: 1.35, recoilYaw: 0.9, reload: 2.15,
    pellets: 1, falloff: [60, 150], falloffMin: 0.62, tracer: 0xffd88f,
    adsFov: 54, weight: 1.7
  },
  s686: {
    id: 's686', name: 'S686', class: 'SHOTGUN', slot: 1, auto: false,
    damage: 16, headMult: 1.7, rpm: 140, mag: 2, reserve: 28,
    spread: 0.065, adsSpread: 0.048, recoil: 3.8, recoilYaw: 1.3, reload: 2.3,
    pellets: 8, falloff: [8, 32], falloffMin: 0.2, tracer: 0xffc06a,
    adsFov: 62, weight: 1.5
  },
  kar98: {
    id: 'kar98', name: 'KAR98K', class: 'SNIPER', slot: 1, auto: false,
    damage: 88, headMult: 2.4, rpm: 46, mag: 5, reserve: 30,
    spread: 0.007, adsSpread: 0.0006, recoil: 5.2, recoilYaw: 1.1, reload: 3.0,
    pellets: 1, falloff: [100, 260], falloffMin: 0.85, tracer: 0xffe2ad,
    adsFov: 28, weight: 2.0
  }
}

export const WEAPON_IDS = Object.keys(WEAPONS)

export const LOOT_WEIGHTS = [
  { id: 'p92', weight: 12 },
  { id: 'ump45', weight: 22 },
  { id: 'm416', weight: 26 },
  { id: 's686', weight: 18 },
  { id: 'kar98', weight: 14 }
]

export const ZONE_PHASES = [
  { wait: 30, shrink: 45, radius: 250, dps: 1.5 },
  { wait: 26, shrink: 38, radius: 176, dps: 3 },
  { wait: 22, shrink: 32, radius: 118, dps: 5.5 },
  { wait: 18, shrink: 26, radius: 66, dps: 8 },
  { wait: 15, shrink: 22, radius: 26, dps: 12 },
  { wait: 12, shrink: 20, radius: 7, dps: 18 }
]

export const ZONE_START_RADIUS = 338

export const BUILD_COSTS = { wall: 10, floor: 10, ramp: 10 }
export const BUILD_MAX_HP = 260
export const BUILD_PIECES = ['wall', 'floor', 'ramp']

export const BUILD_LABELS = { wall: 'WALL', floor: 'FLOOR', ramp: 'RAMP' }

export const BOT_NAMES = [
  'Vulture', 'Kilo', 'GhostByte', 'Marrow', 'SixTen', 'Wraith', 'Rook',
  'Havoc', 'Pilgrim', 'Stone', 'NineLine', 'DustDevil', 'Cinder', 'Nomad',
  'Ranger', 'Sable', 'Talon', 'Warden', 'Jackal', 'Onyx', 'Sparrow',
  'Frost', 'Crowbar', 'Maverick', 'Vandal', 'Sentry', 'Wisp', 'Grit',
  'Apex', 'Lark', 'Reaper', 'Coyote', 'Quill', 'Bishop', 'Static',
  'Thorn', 'Rookery', 'Ash', 'Drift', 'Kestrel'
]

export const SITES = [
  { id: 'crossroads', name: 'CROSSROADS', x: 0, z: 0, radius: 40, flatten: 47 },
  { id: 'riverside', name: 'RIVERSIDE', x: 112, z: 46, radius: 30, flatten: 38 },
  { id: 'farm', name: 'HALLOW FARM', x: -98, z: 96, radius: 32, flatten: 40 },
  { id: 'oldtown', name: 'OLD TOWN', x: -146, z: -44, radius: 34, flatten: 44 },
  { id: 'quarry', name: 'QUARRY', x: 48, z: -168, radius: 36, flatten: 46 },
  { id: 'airfield', name: 'AIRFIELD', x: 172, z: -86, radius: 42, flatten: 54 },
  { id: 'camp', name: 'FIREBASE', x: 34, z: 186, radius: 32, flatten: 40 }
]

export const LAKES = [
  { x: 138, z: 72, radius: 31, depth: 26 },
  { x: -52, z: -94, radius: 22, depth: 22 }
]

export const RARITY = {
  p92: { label: 'COMMON', color: '#b9c1bd' },
  ump45: { label: 'UNCOMMON', color: '#7fce7a' },
  m416: { label: 'RARE', color: '#6db8ff' },
  s686: { label: 'UNCOMMON', color: '#7fce7a' },
  kar98: { label: 'EPIC', color: '#c894ff' },
  ammo: { label: 'AMMO', color: '#d9c88c' },
  medkit: { label: 'MEDICAL', color: '#7fe39a' },
  armor: { label: 'ARMOR', color: '#8fc8ff' }
}
