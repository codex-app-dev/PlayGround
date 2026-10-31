function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function jitter(world, spot) {
  return {
    x: spot.x + (world.rng() - 0.5) * 0.8,
    z: spot.z + (world.rng() - 0.5) * 0.8,
    site: spot.site,
  };
}

export function populateLoot(world) {
  const groups = new Map();
  for (const spot of world.lootSpots) {
    const key = spot.site?.name || 'WILD';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(spot);
  }

  const sitePlans = {
    PRISON: ['ar', 'shotgun', 'ammo', 'med', 'armor', 'ammo'],
    FARM: ['shotgun', 'ar', 'med', 'ammo', 'armor'],
    DOCKS: ['sniper', 'ar', 'ammo', 'med', 'armor', 'ammo'],
    RADIO: ['sniper', 'shotgun', 'med', 'ammo', 'armor'],
    VILLAGE: ['ar', 'shotgun', 'med', 'med', 'ammo', 'armor'],
    RUINS: ['ar', 'sniper', 'ammo', 'med', 'armor', 'ammo'],
    QUARRY: ['shotgun', 'ar', 'med', 'ammo', 'armor'],
  };

  for (const site of world.sites) {
    const spots = shuffle(groups.get(site.name) || [], world.rng);
    const plan = sitePlans[site.name] || ['ar', 'ammo', 'med', 'armor'];
    if (!spots.length) {
      for (let i = 0; i < 4; i++) {
        const a = world.rng() * Math.PI * 2;
        const r = 6 + world.rng() * site.r * 0.5;
        spots.push({ x: site.x + Math.cos(a) * r, z: site.z + Math.sin(a) * r, site });
      }
    }
    plan.forEach((type, i) => {
      const spot = spots[i % spots.length];
      if (!spot) return;
      const p = jitter(world, spot);
      if (type === 'weapon') world.placeLoot('weapon', pick(['ar', 'shotgun', 'sniper'], world.rng), p.x, p.z);
      else if (type === 'ar' || type === 'shotgun' || type === 'sniper' || type === 'pistol') world.placeLoot('weapon', type, p.x, p.z);
      else world.placeLoot(type, null, p.x, p.z);
    });
  }

  const wild = shuffle(groups.get('WILD') || [], world.rng);
  const wildPlan = ['ammo', 'med', 'weapon', 'armor', 'ammo', 'med', 'weapon', 'ammo', 'med', 'armor'];
  wildPlan.forEach((type, i) => {
    if (!wild.length) return;
    const spot = wild[i % wild.length];
    const p = jitter(world, spot);
    if (type === 'weapon') world.placeLoot('weapon', pick(['ar', 'shotgun', 'sniper', 'pistol'], world.rng), p.x, p.z);
    else world.placeLoot(type, null, p.x, p.z);
  });
}
