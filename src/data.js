export const MAP_EXTENT = 280;
export const WORLD_SIZE = 540;
export const ISLAND_RADIUS = 232;

export const SITES = [
  { name: 'PRISON', x: -96, z: 70, r: 45 },
  { name: 'FARM', x: 104, z: 70, r: 46 },
  { name: 'DOCKS', x: -162, z: -96, r: 42 },
  { name: 'RADIO', x: 30, z: -128, r: 46 },
  { name: 'VILLAGE', x: 132, z: -28, r: 44 },
  { name: 'RUINS', x: -30, z: -18, r: 36 },
  { name: 'QUARRY', x: 46, z: 34, r: 32 },
];

export const ROAD_LINKS = [
  ['PRISON', 'FARM'],
  ['PRISON', 'RUINS'],
  ['PRISON', 'QUARRY'],
  ['FARM', 'VILLAGE'],
  ['FARM', 'QUARRY'],
  ['RUINS', 'QUARRY'],
  ['RUINS', 'DOCKS'],
  ['RUINS', 'RADIO'],
  ['RADIO', 'VILLAGE'],
];

export const LOOT_META = {
  ammo: { label: 'AMMUNITION', detail: 'RESERVE AMMO' },
  med: { label: 'FIELD MEDKIT', detail: '+45 HEALTH' },
  armor: { label: 'BALLISTIC PLATE', detail: '+50 ARMOR' },
};
