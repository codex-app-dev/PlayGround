export const MAP = {
  size: 150,
  playable: 62,
  playerBase: { x: -38, z: 34 },
  enemyBase: { x: 38, z: -34 },
  mines: [
    { x: -48, z: 23, amount: 9000, rich: false },
    { x: 48, z: -23, amount: 9000, rich: false },
    { x: 12, z: 8, amount: 14000, rich: true },
  ],
  fountain: { x: -8, z: 12, radius: 4.6 },
  pond: { x: -52, z: -18, radius: 9 },
  path: {
    from: { x: -38, z: 34 },
    to: { x: 38, z: -34 },
  },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / (abx * abx + abz * abz)));
  const dx = px - (ax + abx * t);
  const dz = pz - (az + abz * t);
  return Math.hypot(dx, dz);
}

export function generateLayout(seed = 20261031) {
  const rnd = mulberry32(seed);
  const trees = [];
  const rocks = [];
  const bushes = [];
  const flowers = [];
  const stones = [];

  const clusters = [
    { x: -49, z: 46, n: 10, r: 5.2 },
    { x: -28, z: 53, n: 8, r: 4.6 },
    { x: -56, z: 8, n: 8, r: 4.4 },
    { x: -58, z: -34, n: 7, r: 4.2 },
    { x: 49, z: -46, n: 10, r: 5.2 },
    { x: 28, z: -53, n: 8, r: 4.6 },
    { x: 56, z: -8, n: 8, r: 4.4 },
    { x: 58, z: 34, n: 7, r: 4.2 },
    { x: -18, z: -30, n: 6, r: 3.8 },
    { x: 8, z: 31, n: 6, r: 3.6 },
    { x: 22, z: 14, n: 5, r: 3.2 },
    { x: -30, z: -6, n: 5, r: 3.3 },
    { x: 30, z: 30, n: 6, r: 3.6 },
    { x: -8, z: -48, n: 7, r: 4.0 },
    { x: 40, z: 10, n: 5, r: 3.2 },
    { x: -10, z: 49, n: 5, r: 3.4 },
  ];

  const tooClose = (x, z, pad = 0) => {
    if (Math.hypot(x, z) > MAP.playable - 3) return true;
    for (const base of [MAP.playerBase, MAP.enemyBase]) {
      if (Math.hypot(x - base.x, z - base.z) < 14 + pad) return true;
    }
    for (const mine of MAP.mines) {
      if (Math.hypot(x - mine.x, z - mine.z) < 5.2 + pad) return true;
    }
    if (Math.hypot(x - MAP.fountain.x, z - MAP.fountain.z) < 6.5 + pad) return true;
    if (Math.hypot(x - MAP.pond.x, z - MAP.pond.z) < MAP.pond.radius + 2 + pad) return true;
    if (distToSegment(x, z, MAP.path.from.x, MAP.path.from.z, MAP.path.to.x, MAP.path.to.z) < 7.5 + pad) return true;
    return false;
  };

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * cluster.r;
      let x = cluster.x + Math.cos(a) * r;
      let z = cluster.z + Math.sin(a) * r;
      let tries = 0;
      while (tooClose(x, z) && tries++ < 12) {
        x += (rnd() - 0.5) * 3;
        z += (rnd() - 0.5) * 3;
      }
      if (tooClose(x, z)) continue;
      let overlap = false;
      for (const t of trees) {
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < 4.6) { overlap = true; break; }
      }
      if (overlap) continue;
      trees.push({
        x, z,
        variant: Math.floor(rnd() * 3),
        scale: 0.82 + rnd() * 0.42,
        rot: rnd() * Math.PI * 2,
      });
    }
  }

  // A few lone trees to break up the open ground.
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 20 + rnd() * 38;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(x, z, 2)) continue;
    trees.push({ x, z, variant: Math.floor(rnd() * 3), scale: 0.9 + rnd() * 0.35, rot: rnd() * Math.PI * 2 });
  }

  // Big collidable rocks.
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 28 + rnd() * 34;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(x, z, 1)) continue;
    rocks.push({ x, z, scale: 0.8 + rnd() * 1.2, variant: i % 4, rot: rnd() * Math.PI * 2 });
  }
  rocks.push({ x: -46, z: -14, scale: 1.4, variant: 2, rot: 0.4 });
  rocks.push({ x: 40, z: 28, scale: 1.1, variant: 1, rot: 1.2 });
  rocks.push({ x: 18, z: -38, scale: 1.2, variant: 3, rot: 2.1 });

  // Non-collidable ground dressing.
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 58;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - MAP.pond.x, z - MAP.pond.z) < MAP.pond.radius) continue;
    bushes.push({ x, z, scale: 0.55 + rnd() * 0.75, rot: rnd() * Math.PI * 2 });
  }
  for (let i = 0; i < 180; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 58;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - MAP.pond.x, z - MAP.pond.z) < MAP.pond.radius + 1) continue;
    flowers.push({ x, z, color: Math.floor(rnd() * 4), scale: 0.7 + rnd() * 0.7 });
  }
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 57;
    stones.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.25 + rnd() * 0.5, rot: rnd() * Math.PI });
  }

  return { trees, rocks, bushes, flowers, stones, seed };
}
