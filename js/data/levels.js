const doc = (id, x, y) => ({ type: 'doc', id, x, y });
const shard = (id, x, y) => ({ type: 'shard', id, x, y });
const relic = (id, x, y) => ({ type: 'relic', id, x, y });
const block = (id, x, y) => ({ type: 'block', id, x, y });
const plate = (id, x, y, to) => ({ type: 'plate', id, x, y, to });
const door = (id, x, y, requires) => ({ type: 'door', id, x, y, requires });
const key = (id, x, y) => ({ type: 'key', id, x, y });
const mirror = (id, x, y, dir = '/') => ({ type: 'mirror', id, x, y, dir });
const dial = (id, x, y, value, target, to) => ({ type: 'dial', id, x, y, value, target, to });
const valve = (id, x, y) => ({ type: 'valve', id, x, y });
const emitter = (x, y, dir) => ({ type: 'emitter', x, y, dir });
const target = (id, x, y, to) => ({ type: 'target', id, x, y, to });
const glyph = (id, order, symbol, x, y) => ({ type: 'glyph', id, order, symbol, x, y });
const guardian = (id, x, y, path) => ({ type: 'guardian', id, x, y, path, pathIndex: 0 });
const dart = (id, x, y, dir, period, offset) => ({ type: 'hazard', kind: 'dart', id, x, y, dir, period, offset });
const blade = (id, x, y, path) => ({ type: 'hazard', kind: 'blade', id, x, y, path, pathIndex: 0 });
const crumble = (id, x, y) => ({ type: 'crumble', id, x, y });
const platform = (id, x, y, path) => ({ type: 'platform', id, x, y, path, pathIndex: 0 });

export const LEVELS = {
  '1-1': {
    id: '1-1', chapter: 1, index: 1, name: 'Dust and Silence', subtitle: 'Vale Expedition Camp',
    objective: 'Follow the professor\'s trail out of the abandoned camp.',
    tip: 'Move with WASD, arrow keys, the D-pad, or by tapping a tile beside Evelyn.',
    hints: ['The camp path runs along the bottom of the ruins, then climbs the eastern wall.', 'Adrian left a note in the north-west corner. Old habits die hard.'],
    par: 20, map: [
      '#########',
      '#.......#',
      '#.###.#.#',
      '#...#.#.#',
      '#.#.#.#.#',
      '#.......#',
      '#########',
    ],
    start: [1, 5], exit: [7, 1],
    entities: [
      doc('d_camp', 1, 1), shard('s1', 3, 3), shard('s2', 7, 5),
      { type: 'inscription', id: 'i1', x: 5, y: 1, text: 'The stone has been recently cleaned. A single bootprint crosses the dust heading east.' },
    ],
  },

  '1-2': {
    id: '1-2', chapter: 1, index: 2, name: 'The Weight of History', subtitle: 'The Lower Cut',
    objective: 'Weigh down the ancient pressure plate and reach the sealed inner room.',
    tip: 'Walk into a carved block to push it. Pressure plates answer to weight — not always yours.',
    hints: ['Push the block east along the bottom corridor until it rests on the plate.', 'A dart trap fires south down the eastern colonnade. Cross when its warning line fades.'],
    par: 42, map: [
      '#########',
      '#.......#',
      '#.#####.#',
      '#.#...#.#',
      '#.#.x.#.#',
      '#.#...#.#',
      '#.##.##.#',
      '#.......#',
      '#########',
    ],
    start: [1, 7], exit: [4, 4],
    entities: [
      block('b1', 3, 7), plate('p1', 6, 7, 'door1'), door('door1', 4, 6, { type: 'plate', id: 'p1' }),
      dart('t1', 7, 2, [0, 1], 3, 1), shard('s1', 7, 3), shard('s2', 3, 3), doc('d_ledger', 1, 1),
    ],
  },

  '1-3': {
    id: '1-3', chapter: 1, index: 3, name: 'The Sealed Archive', subtitle: 'Temple of the First Door',
    objective: 'Recover the archivist\'s seal, the bronze key, and the jade relic.',
    tip: 'Some doors are not locked. They are waiting for the right words.',
    hints: ['Find the seal at the top-west corner before approaching the sealed door in the north corridor.', 'The bronze key is behind the seal. The inner archive opens with it.', 'Cracked floor tiles crumble after you leave them. Do not plan on coming back.'],
    par: 54, map: [
      '###########',
      '#.........#',
      '#.#######.#',
      '#.#.....#.#',
      '#.#.....#.#',
      '#.#..x..#.#',
      '#.#.....#.#',
      '#.#.....#.#',
      '#.###.###.#',
      '#.........#',
      '###########',
    ],
    start: [1, 9], exit: [5, 5],
    entities: [
      doc('d_seal', 1, 1), door('sealDoor', 5, 1, { type: 'doc', id: 'd_seal' }),
      key('k1', 9, 1), door('archiveDoor', 5, 8, { type: 'key', id: 'k1' }),
      crumble('c1', 3, 9), crumble('c2', 7, 9),
      shard('s1', 9, 9), shard('s2', 3, 3), relic('r1', 7, 7),
    ],
  },

  '2-1': {
    id: '2-1', chapter: 2, index: 1, name: 'Chamber of Whispers', subtitle: 'The Resonant Caves',
    objective: 'Turn the mirrors until the old light reaches its mark.',
    tip: 'Interact with a mirror to turn it. Light travels in straight lines — and turns only where it is told.',
    hints: ['Both mirrors must catch the beam on their back-slash face.', 'The emitter is set into the western wall. Follow the light: east, south, east.'],
    par: 30, map: [
      '###########',
      '#.....#...#',
      '#.....#...#',
      '#.....#...#',
      '#.......x.#',
      '#.....#...#',
      '#.....#...#',
      '#.....#...#',
      '###########',
    ],
    start: [1, 7], exit: [8, 4],
    entities: [
      emitter(0, 2, [1, 0]), mirror('m1', 4, 2, '/'), mirror('m2', 4, 6, '/'),
      target('t1', 5, 6, 'lightDoor'), door('lightDoor', 6, 4, { type: 'beam', id: 't1' }),
      shard('s1', 1, 5), shard('s2', 9, 2), doc('d_survey', 1, 1),
    ],
  },

  '2-2': {
    id: '2-2', chapter: 2, index: 2, name: 'The Resonant Hall', subtitle: 'The Instrument',
    objective: 'Bind the three seals to open the inner sanctum.',
    tip: 'Turn the symbol dials to match the marks above the sanctum door. The block must keep the lower seal pressed.',
    hints: ['The hymn gives the order: the sun, the wave, the reed.', 'Push the carved block west onto the pressure plate near the start.', 'A single dial can be turned more than once. The door shows the three marks it wants.'],
    par: 48, map: [
      '###########',
      '#.........#',
      '#.........#',
      '#...#x#...#',
      '#...#.#...#',
      '#...#.#...#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [5, 3],
    entities: [
      block('b1', 7, 7), plate('p1', 2, 7, 'sanctum'), 
      dial('d1', 2, 2, 2, 0, 'sanctum'), dial('d2', 9, 2, 0, 1, 'sanctum'), dial('d3', 8, 6, 3, 2, 'sanctum'),
      door('sanctum', 5, 5, { type: 'all', items: [{ type: 'plate', id: 'p1' }, { type: 'dials', id: 'sanctum' }] }),
      shard('s1', 1, 1), shard('s2', 9, 6), doc('d_hymn', 9, 7), relic('r2', 5, 4),
    ],
  },

  '3-1': {
    id: '3-1', chapter: 3, index: 1, name: 'The Drowned Stair', subtitle: 'Vaelor, the Outer Quarter',
    objective: 'Raise the water to cross the drowned hall, then drain it to open the sea gate.',
    tip: 'Valves turn a tide, not a tap. You cannot work a valve while standing in the basin.',
    hints: ['Raise the water at the southern valve, cross the flooded hall, then find the northern valve.', 'The gate to the stair opens only when the water is low.'],
    par: 38, map: [
      '###########',
      '#.........#',
      '#~~~~~~~~##',
      '#~~~~~~~~##',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [9, 1], waterHigh: false,
    entities: [
      valve('v1', 2, 4), valve('v2', 7, 2), door('tideDoor', 8, 1, { type: 'waterLow', id: 'water' }),
      shard('s1', 1, 1), shard('s2', 9, 7), doc('d_tide', 5, 7),
    ],
  },

  '3-2': {
    id: '3-2', chapter: 3, index: 2, name: 'The Sleeping Machinery', subtitle: 'The Engine Hall',
    objective: 'Wake the sunken machine and recover the tide compass.',
    tip: 'Water carries you; stone carries weight. The light does not care about either.',
    hints: ['Raise the basin at the valve, then cross to the northern ledge.', 'Push the block west onto the high plate, then return to the vault below.', 'The eastern colonnade is swept by a dart trap. Keep to its rhythm.'],
    par: 52, map: [
      '###########',
      '#.........#',
      '#~~~~~~~~~#',
      '#~~~~~~~~~#',
      '#.........#',
      '#......####',
      '#.........#',
      '#......#..#',
      '###########',
    ],
    start: [1, 7], exit: [9, 6], waterHigh: false,
    entities: [
      valve('v1', 2, 4), block('b1', 7, 1), plate('p1', 3, 1, 'vault'),
      door('vault', 7, 6, { type: 'plate', id: 'p1' }),
      dart('t1', 9, 4, [-1, 0], 3, 2),
      shard('s1', 9, 1), shard('s2', 9, 7), doc('d_engine', 5, 7), relic('r3', 8, 7),
    ],
  },

  '4-1': {
    id: '4-1', chapter: 4, index: 1, name: 'Forbidden Stacks', subtitle: 'The Black Archive',
    objective: 'Step the floor-sentence in the correct order and reach the eastern stair.',
    tip: 'Stepping on the wrong glyph resets the sentence. Read the cipher before you trust your feet.',
    hints: ['The cipher order is eye, wave, reed, sun.', 'The glyphs are scattered across the reading room. Only their order matters, not the route between them.', 'The eastern stair door opens only when all four glyphs have answered in sequence.'],
    par: 55, map: [
      '###########',
      '#.........#',
      '#.##.##.###',
      '#.........#',
      '#.##.##.#.#',
      '#.........#',
      '#.##.##.#.#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [9, 1],
    entities: [
      glyph('g1', 1, 'eye', 2, 7), glyph('g2', 2, 'wave', 5, 5), glyph('g3', 3, 'reed', 8, 3), glyph('g4', 4, 'sun', 4, 1),
      door('stairDoor', 8, 1, { type: 'glyphs', id: 'seq' }),
      dart('t1', 10, 5, [-1, 0], 4, 1),
      shard('s1', 9, 7), shard('s2', 1, 1), doc('d_cipher', 1, 1),
    ],
  },

  '4-2': {
    id: '4-2', chapter: 4, index: 2, name: 'The Shadow Bridge', subtitle: 'The Void Between Shelves',
    objective: 'Wake the shadow bridge, cross the chasm, and recover the black codex.',
    tip: 'The platform moves when you do. To ride it, step on and wait for the next turn.',
    hints: ['Set both mirrors to the back-slash face before crossing.', 'Wait on the moving slab to ride it across. Do not step off over the void.', 'The stair gate on the far side answers the light.'],
    par: 62, map: [
      '###########',
      '#..######x#',
      '#..ooooo..#',
      '#..ooooo..#',
      '#..ooooo..#',
      '#..ooooo..#',
      '#..ooooo..#',
      '#..#####..#',
      '###########',
    ],
    start: [1, 7], exit: [9, 1],
    entities: [
      emitter(0, 2, [1, 0]), mirror('m1', 2, 2, '/'), mirror('m2', 2, 5, '/'),
      target('t1', 10, 5, 'lightDoor'), door('lightDoor', 9, 2, { type: 'beam', id: 't1' }),
      platform('pl1', 3, 4, [[3,4],[4,4],[5,4],[6,4],[7,4],[8,4]]),
      shard('s1', 1, 1), shard('s2', 8, 7), doc('d_confession', 9, 7), relic('r4', 9, 6),
    ],
  },

  '5-1': {
    id: '5-1', chapter: 5, index: 1, name: 'Hall of the Curator', subtitle: 'The Ninth Chamber',
    objective: 'Open the Curator\'s door. Recover the Sun Key.',
    tip: 'The last door wants everything you have learned: weight, tide, and symbol.',
    hints: ['Push the block west onto the lower plate before crossing the flood.', 'Raise the water, cross, and turn the dial to the crescent moon.', 'The guardian walks the top colonnade. Plan your approach to the dial around its patrol.'],
    par: 58, map: [
      '###########',
      '#........x#',
      '#~~~~~~~~##',
      '#~~~~~~~~##',
      '#.........#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [9, 1], waterHigh: false,
    entities: [
      valve('v1', 2, 4), block('b1', 6, 7), plate('p1', 3, 7, 'curator'),
      dial('d1', 5, 1, 1, 4, 'curator'),
      door('curator', 8, 1, { type: 'all', items: [{ type: 'plate', id: 'p1' }, { type: 'dials', id: 'curator' }] }),
      guardian('g1', 2, 1, [[2,1],[3,1],[4,1],[3,1]]),
      shard('s1', 9, 7), shard('s2', 1, 1), doc('d_ledger2', 1, 6), relic('r5', 7, 1),
    ],
  },

  '5-2': {
    id: '5-2', chapter: 5, index: 2, name: 'Beneath the Silence', subtitle: 'The Dirge Engine',
    objective: 'Open the final door and face the Curator of the Choir of Ash.',
    tip: 'Every lesson returns. The floor remembers order; the light remembers direction; the dark remembers you.',
    hints: ['Step the three floor glyphs in the cipher order: eye, wave, reed.', 'Turn both mirrors to carry the beam east, then south, then east again.', 'The final gate needs both the glyph sentence and the beam. Keep the guardian in sight.'],
    par: 78, map: [
      '###########',
      '#........x#',
      '#.##.#.####',
      '#.........#',
      '#.##.#.##.#',
      '#.........#',
      '#.##.#.##.#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [9, 1],
    entities: [
      glyph('g1', 1, 'eye', 2, 7), glyph('g2', 2, 'wave', 5, 5), glyph('g3', 3, 'reed', 8, 3),
      emitter(0, 3, [1, 0]), mirror('m1', 4, 3, '/'), mirror('m2', 4, 7, '/'),
      target('t1', 9, 7, 'finalDoor'),
      door('finalDoor', 8, 1, { type: 'all', items: [{ type: 'glyphs', id: 'seq' }, { type: 'beam', id: 't1' }] }),
      guardian('g1', 5, 3, [[5,3],[5,7],[2,7],[2,3],[5,3]]),
      dart('t1d', 9, 5, [-1, 0], 4, 2),
      shard('s1', 1, 1), shard('s2', 9, 8), doc('d_final', 1, 8),
    ],
  },

  'S-1': {
    id: 'S-1', chapter: 6, index: 1, name: 'The Ninth Echo', subtitle: 'The Hidden Ossuary',
    objective: 'Answer the room. Leave with the name that was never erased.',
    tip: 'The ossuary asks for all three languages: word, light, and symbol.',
    hints: ['The floor glyphs are eye, wave, reed.', 'The beam wants two mirrors turned away from the sun.', 'The three dials must show sun, wave, and eye. The hidden door needs them all.'],
    par: 80, map: [
      '###########',
      '#.........#',
      '#.#####...#',
      '#.#...#...#',
      '#.#.x.#...#',
      '#.#...#...#',
      '#.##.##...#',
      '#.........#',
      '###########',
    ],
    start: [1, 7], exit: [4, 4],
    entities: [
      glyph('g1', 1, 'eye', 3, 1), glyph('g2', 2, 'wave', 5, 7), glyph('g3', 3, 'reed', 1, 5),
      dial('d1', 9, 1, 2, 0, 'echoDoor'), dial('d2', 9, 4, 1, 1, 'echoDoor'), dial('d3', 9, 7, 0, 2, 'echoDoor'),
      door('echoDoor', 4, 6, { type: 'all', items: [{ type: 'glyphs', id: 'seq' }, { type: 'dials', id: 'echoDoor' }] }),
      guardian('g1', 7, 2, [[7,2],[7,6],[8,6],[8,2],[7,2]]),
      shard('s1', 8, 1), shard('s2', 3, 3),
    ],
  },
};

export const LEVEL_ORDER = ['1-1','1-2','1-3','2-1','2-2','3-1','3-2','4-1','4-2','5-1','5-2','S-1'];

export function nextLevel(id) {
  const i = LEVEL_ORDER.indexOf(id);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}
