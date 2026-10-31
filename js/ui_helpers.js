import { RACES, ROLE_NAMES, formatTime, costText } from './data.js';
import { icon, crest } from './icons.js';

export function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '∞';
  return Math.round(n).toLocaleString('ru-RU');
}

export function raceDetailHTML(race) {
  const data = RACES[race];
  if (!data) return '';
  return `
    <div class="detail-top">
      ${crest(race, 'detail-emblem')}
      <div class="detail-copy">
        <div class="detail-tagline">${data.tagline}</div>
        <div class="detail-lore">${data.lore}</div>
      </div>
    </div>
    <div class="detail-bonuses">
      ${data.bonuses.map((b) => `<span class="detail-bonus">${b}</span>`).join('')}
    </div>`;
}

export function costParts(cost = {}) {
  return {
    gold: cost.gold || 0,
    lumber: cost.lumber || 0,
    text: costText(cost),
  };
}

export function costHTML(cost = {}) {
  const parts = [];
  if (cost.gold) parts.push(`<span class="gold">${num(cost.gold)}</span>`);
  if (cost.lumber) parts.push(`<span class="lumber">${num(cost.lumber)}</span>`);
  return parts.join('');
}

function unitStats(unit) {
  if (!unit) return [];
  return [
    { label: 'Здоровье', value: num(unit.hp), cls: 'green' },
    { label: 'Атака', value: num(unit.damage), cls: 'red' },
    { label: 'Броня', value: num(unit.armor) },
    { label: 'Дальность', value: Number(unit.range).toFixed(1) },
  ];
}

function buildingStats(b) {
  const stats = [
    { label: 'Здоровье', value: num(b.hp), cls: 'green' },
    { label: 'Броня', value: num(b.armor || 0) },
  ];
  if (b.def.attack) {
    stats.push({ label: 'Урон', value: num(b.def.attack.damage), cls: 'red' });
    stats.push({ label: 'Радиус', value: Number(b.def.attack.range).toFixed(1) });
  } else if (b.def.supply) {
    stats.push({ label: 'Снабжение', value: `+${b.def.supply}`, cls: 'gold' });
    stats.push({ label: 'Очередь', value: `${b.queue.length} / 5` });
  } else if (b.def.trains) {
    stats.push({ label: 'Обучение', value: b.def.trains.length ? 'да' : 'нет', cls: 'blue' });
    stats.push({ label: 'Очередь', value: `${b.queue.length} / 5` });
  } else {
    stats.push({ label: 'Роль', value: ROLE_NAMES[b.role] || '—' });
    stats.push({ label: 'Статус', value: b.completed ? 'готово' : 'стройка' });
  }
  return stats;
}

function resourceStats(e) {
  if (e.resourceType === 'gold') {
    return [
      { label: 'Запас', value: num(e.amount), cls: 'gold' },
      { label: 'Тип', value: e.rich ? 'богатая' : 'руда' },
      { label: 'Добыча', value: '12 / 2.1с' },
      { label: 'Сбор', value: 'рабочие' },
    ];
  }
  if (e.resourceType === 'lumber') {
    return [
      { label: 'Запас', value: num(e.amount), cls: 'gold' },
      { label: 'Тип', value: 'древесина' },
      { label: 'Добыча', value: '12 / 2.35с' },
      { label: 'Сбор', value: 'рабочие' },
    ];
  }
  return [
    { label: 'Эффект', value: 'лечение', cls: 'green' },
    { label: 'Сила', value: '+5.5/с' },
    { label: 'Радиус', value: '4.6' },
    { label: 'Доступ', value: 'всем' },
  ];
}

function hpModel(value, max, cls) {
  const ratio = Number.isFinite(value) && Number.isFinite(max) && max > 0
    ? Math.max(0, Math.min(1, value / max))
    : 1;
  return {
    ratio,
    current: value,
    max,
    cls: cls || '',
    text: Number.isFinite(value) && Number.isFinite(max)
      ? `${num(value)} / ${num(max)}`
      : '∞',
  };
}

const DEFAULT_INFO = {
  kind: 'none',
  primary: null,
  name: 'Долина Трёх Ветров',
  sub: 'Обзор поля боя',
  desc: 'ЛКМ — выбрать, ПКМ — отдать приказ. Постройте фермы, чтобы увеличить предел снабжения.',
  stats: [],
  hp: { ratio: 0, current: 0, max: 0, cls: '', text: '—' },
  count: 0,
  portraitKind: 'none',
  fallbackIcon: null,
  race: null,
  enemy: false,
};

export function summarizeSelection(game, selection) {
  const list = (selection || []).filter((e) => e && !e.dead);
  if (!list.length) {
    return {
      ...DEFAULT_INFO,
      race: game?.playerRace || 'human',
    };
  }

  const units = list.filter((e) => e.kind === 'unit');
  const buildings = list.filter((e) => e.kind === 'building');
  const resources = list.filter((e) => e.kind === 'resource');
  const primary = units[0] || buildings[0] || resources[0] || list[0];
  const enemy = primary.team === 1;

  if (units.length) {
    const totalHp = units.reduce((sum, u) => sum + Math.max(0, u.hp), 0);
    const totalMax = units.reduce((sum, u) => sum + u.maxHp, 0);
    const sameRole = units.every((u) => u.role === primary.role && u.race === primary.race);
    const def = primary.def;
    const roleName = ROLE_NAMES[primary.role] || 'Войска';
    const count = units.length;
    let name = def.name;
    let sub = `${RACES[primary.race]?.name || ''} · ${roleName}`;
    let desc = def.desc;
    if (count > 1) {
      name = sameRole ? def.name : 'Смешанный отряд';
      sub = `${count} ${sameRole ? roleName.toLowerCase() : 'бойцов'} · ${RACES[primary.race]?.name || ''}`;
      desc = sameRole
        ? `${def.desc} В отряде ${count}.`
        : 'Пехота, стрелки и поддержка под одним знаменем. Приказы выполняются всем отрядом.';
    }
    if (enemy) sub += ' · ВРАГ';
    return {
      kind: 'unit',
      primary,
      name,
      sub,
      desc,
      stats: count > 1
        ? [
            { label: 'Бойцов', value: num(count), cls: 'blue' },
            { label: 'Здоровье', value: num(totalHp), cls: 'green' },
            { label: 'Атака', value: num(def.damage), cls: 'red' },
            { label: 'Броня', value: num(def.armor) },
          ]
        : unitStats(primary),
      hp: hpModel(totalHp, totalMax, enemy ? 'enemy' : ''),
      count,
      portraitKind: 'unit',
      fallbackIcon: null,
      race: primary.race,
      enemy,
    };
  }

  if (buildings.length) {
    const b = primary;
    const def = b.def;
    const count = buildings.length;
    const sameRole = buildings.every((x) => x.role === primary.role);
    const totalHp = buildings.reduce((sum, x) => sum + Math.max(0, x.hp), 0);
    const totalMax = buildings.reduce((sum, x) => sum + x.maxHp, 0);
    const building = b.construction < 1 ? ' · строится ' + Math.floor(b.construction * 100) + '%' : '';
    return {
      kind: 'building',
      primary: b,
      name: count > 1 ? (sameRole ? def.name : 'Постройки') : def.name,
      sub: (enemy ? 'ВРАГ · ' : '') + (RACES[b.race]?.name || '') + building,
      desc: count > 1
        ? `Выбрано построек: ${count}. Оборона и производство работают независимо.`
        : def.desc,
      stats: count > 1
        ? [
            { label: 'Построек', value: num(count), cls: 'blue' },
            { label: 'Здоровье', value: num(totalHp), cls: 'green' },
            { label: 'Очередь', value: num(buildings.reduce((s, x) => s + x.queue.length, 0)) },
            { label: 'Статус', value: buildings.every((x) => x.completed) ? 'готово' : 'стройка' },
          ]
        : buildingStats(b),
      hp: hpModel(totalHp, totalMax, enemy ? 'enemy' : 'building'),
      count: count > 1 ? count : 0,
      portraitKind: 'building',
      fallbackIcon: null,
      race: b.race,
      enemy,
    };
  }

  if (resources.length) {
    const r = resources[0];
    let name = 'Источник жизни';
    let sub = 'Нейтральный объект';
    let desc = 'Живая вода исцеляет раненых воинов, стоящих рядом.';
    let fallbackIcon = 'supply';
    if (r.resourceType === 'gold') {
      name = r.rich ? 'Богатая золотая жила' : 'Золотая шахта';
      sub = 'Нейтральный объект · золото';
      desc = 'Рабочие добывают здесь золото. Истощённая жила исчезает из долины.';
      fallbackIcon = 'gold';
    } else if (r.resourceType === 'lumber') {
      name = 'Лес';
      sub = 'Нейтральный объект · древесина';
      desc = 'Рабочие валят деревья, чтобы пополнять запас древесины.';
      fallbackIcon = 'log';
    }
    const hp = r.resourceType === 'fountain'
      ? { ratio: 1, current: Infinity, max: Infinity, cls: 'green', text: 'Неиссякаемый' }
      : hpModel(r.amount, r.maxAmount, 'gold');
    return {
      kind: 'resource',
      primary: r,
      name,
      sub,
      desc,
      stats: resourceStats(r),
      hp,
      count: 0,
      portraitKind: 'resource',
      fallbackIcon,
      race: game?.playerRace || 'human',
      enemy: false,
    };
  }

  return DEFAULT_INFO;
}

export function endStatsHTML(teams, time, difficulty) {
  const stats = teams[0]?.stats || {};
  const enemy = teams[1]?.stats || {};
  const items = [
    { icon: 'stats', label: 'Длительность', value: formatTime(time) },
    { icon: 'coin', label: 'Золото', value: num(stats.goldGathered || 0) },
    { icon: 'log', label: 'Древесина', value: num(stats.lumberGathered || 0) },
    { icon: 'sword', label: 'Обучено', value: num(stats.trained || 0) },
    { icon: 'target', label: 'Убито', value: num(stats.killed || 0) },
    { icon: 'flag', label: 'Построено', value: num(stats.buildingsBuilt || 0) },
    { icon: 'shield', label: 'Потеряно', value: num(stats.lost || 0) },
    { icon: 'home', label: 'Сложность', value: difficulty?.name || 'Ветеран' },
    { icon: 'skull', label: 'Враг потерял', value: num(enemy.lost || 0) },
  ];
  return items.map((it) => `
    <div class="end-stat">
      ${icon(it.icon)}
      <div class="end-stat-copy">
        <span class="end-stat-label">${it.label}</span>
        <span class="end-stat-value">${it.value}</span>
      </div>
    </div>`).join('');
}


