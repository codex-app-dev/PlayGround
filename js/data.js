// Game data — three asymmetrical Warcraft-style races.
// All numbers are tuned for a readable 15–25 minute duel against the AI.

export const TEAM_COLORS = {
  player: '#4c8dff',
  player3d: 0x4c8dff,
  enemy: '#ef5350',
  enemy3d: 0xef5350,
  neutral: '#d8b45a',
  neutral3d: 0xd8b45a,
};

export const RACES = {
  human: {
    id: 'human',
    name: 'Альянс',
    raceName: 'Люди',
    color: '#4c8dff',
    color3d: 0x4c8dff,
    dark: '#163a7a',
    accent: '#ffd166',
    emblem: 'lion',
    tagline: 'Дисциплина. Сталь. Вера.',
    lore: 'Стройные ряды рыцарей, меткие лучники и жрецы, исцеляющие раны. Альянс побеждает подготовкой.',
    bonuses: ['+1 броня пехоте', 'Жрецы лечат союзников', 'Рыцари сокрушают ряды'],
    units: {
      worker: {
        role: 'worker', name: 'Крестьянин', hp: 55, damage: 5, armor: 0, range: 1.3,
        speed: 3.55, train: 8, cost: { gold: 50 }, supply: 1, radius: 0.42,
        attackSpeed: 1.2, desc: 'Добывает золото и древесину, возводит постройки.',
      },
      melee: {
        role: 'melee', name: 'Пехотинец', hp: 130, damage: 13, armor: 2, range: 1.4,
        speed: 3.1, train: 14, cost: { gold: 80 }, supply: 2, radius: 0.52,
        attackSpeed: 1.25, desc: 'Крепкий щитоносец. Держит строй и прикрывает стрелков.',
      },
      ranged: {
        role: 'ranged', name: 'Лучник', hp: 82, damage: 11, armor: 0, range: 6.6,
        speed: 3.0, train: 16, cost: { gold: 70, lumber: 20 }, supply: 2, radius: 0.45,
        attackSpeed: 1.55, projectile: 'arrow', desc: 'Стреляет издалека. Хрупок в ближнем бою.',
      },
      heavy: {
        role: 'heavy', name: 'Рыцарь', hp: 255, damage: 24, armor: 4, range: 1.8,
        speed: 2.9, train: 24, cost: { gold: 140, lumber: 40 }, supply: 4, radius: 0.78,
        attackSpeed: 1.6, desc: 'Тяжёлая кавалерия. Требует Собор.', requires: 'special',
      },
      caster: {
        role: 'caster', name: 'Жрец', hp: 95, damage: 9, armor: 0, range: 5.6,
        speed: 3.0, train: 22, cost: { gold: 100, lumber: 35 }, supply: 2, radius: 0.45,
        attackSpeed: 1.8, projectile: 'holy', heal: 32, healRange: 7.5, healCooldown: 5.5,
        desc: 'Лечит раненых союзников и карает врагов светом. Требует Собор.', requires: 'special',
      },
    },
    buildings: {
      hall: {
        role: 'hall', name: 'Ратуша', hp: 1800, size: 4.6, cost: { gold: 385, lumber: 205 },
        build: 45, supply: 10, dropoff: true, trains: ['worker'],
        desc: 'Сердце города. Обучает крестьян, принимает ресурсы, даёт 10 снабжения.',
      },
      farm: {
        role: 'farm', name: 'Ферма', hp: 480, size: 2.55, cost: { lumber: 80 },
        build: 13, supply: 8, desc: 'Повышает предел снабжения на 8.',
      },
      barracks: {
        role: 'barracks', name: 'Казармы', hp: 950, size: 3.9, cost: { gold: 120, lumber: 40 },
        build: 20, trains: ['melee', 'ranged'], desc: 'Готовит пехотинцев и лучников.',
      },
      tower: {
        role: 'tower', name: 'Башня', hp: 760, size: 2.2, cost: { gold: 100, lumber: 60 },
        build: 18, attack: { damage: 17, range: 8.2, cooldown: 1.35, projectile: 'arrow' },
        desc: 'Обстреливает врагов в радиусе 8 метров.',
      },
      special: {
        role: 'special', name: 'Собор', hp: 1100, size: 4.0, cost: { gold: 160, lumber: 80 },
        build: 26, trains: ['heavy', 'caster'], desc: 'Открывает рыцарей и жрецов.',
      },
    },
  },

  orc: {
    id: 'orc',
    name: 'Орда',
    raceName: 'Орки',
    color: '#e2673c',
    color3d: 0xe2673c,
    dark: '#632515',
    accent: '#f0b34e',
    emblem: 'horde',
    tagline: 'Ярость. Кровь. Честь.',
    lore: 'Орда сокрушает врага грубой силой. Бугаи выносливы, таурены неудержимы, а шаманы поддерживают воинов.',
    bonuses: ['Больше здоровья у воинов', 'Таурены — живые осадные машины', 'Шаманы исцеляют в бою'],
    units: {
      worker: {
        role: 'worker', name: 'Пеон', hp: 60, damage: 5, armor: 0, range: 1.3,
        speed: 3.45, train: 8, cost: { gold: 50 }, supply: 1, radius: 0.44,
        attackSpeed: 1.2, desc: 'Добывает золото и древесину, возводит постройки.',
      },
      melee: {
        role: 'melee', name: 'Бугай', hp: 150, damage: 14, armor: 1, range: 1.5,
        speed: 3.0, train: 15, cost: { gold: 80 }, supply: 2, radius: 0.56,
        attackSpeed: 1.35, desc: 'Свирепый воин с тяжёлым топором.',
      },
      ranged: {
        role: 'ranged', name: 'Охотник', hp: 88, damage: 12, armor: 0, range: 6.1,
        speed: 3.05, train: 16, cost: { gold: 70, lumber: 20 }, supply: 2, radius: 0.46,
        attackSpeed: 1.5, projectile: 'spear', desc: 'Метает копья с безопасного расстояния.',
      },
      heavy: {
        role: 'heavy', name: 'Таурен', hp: 300, damage: 27, armor: 3, range: 2.0,
        speed: 2.7, train: 26, cost: { gold: 140, lumber: 50 }, supply: 4, radius: 0.85,
        attackSpeed: 1.75, desc: 'Огромный воин-бык. Требует Тотем войны.', requires: 'special',
      },
      caster: {
        role: 'caster', name: 'Шаман', hp: 100, damage: 10, armor: 0, range: 5.2,
        speed: 3.0, train: 22, cost: { gold: 100, lumber: 40 }, supply: 2, radius: 0.46,
        attackSpeed: 1.75, projectile: 'lightning', heal: 26, healRange: 7, healCooldown: 5.2,
        desc: 'Призывает духов, лечащих союзников. Требует Тотем войны.', requires: 'special',
      },
    },
    buildings: {
      hall: {
        role: 'hall', name: 'Большой зал', hp: 1900, size: 4.7, cost: { gold: 385, lumber: 205 },
        build: 45, supply: 10, dropoff: true, trains: ['worker'],
        desc: 'Сердце Орды. Обучает пеонов, принимает ресурсы, даёт 10 снабжения.',
      },
      farm: {
        role: 'farm', name: 'Свинарник', hp: 500, size: 2.55, cost: { lumber: 80 },
        build: 13, supply: 8, desc: 'Повышает предел снабжения на 8.',
      },
      barracks: {
        role: 'barracks', name: 'Казармы', hp: 1000, size: 3.9, cost: { gold: 120, lumber: 40 },
        build: 20, trains: ['melee', 'ranged'], desc: 'Готовит бугаев и охотников.',
      },
      tower: {
        role: 'tower', name: 'Сторожевая башня', hp: 800, size: 2.2, cost: { gold: 100, lumber: 60 },
        build: 18, attack: { damage: 18, range: 8.0, cooldown: 1.45, projectile: 'spear' },
        desc: 'Обстреливает врагов копьями.',
      },
      special: {
        role: 'special', name: 'Тотем войны', hp: 1150, size: 4.0, cost: { gold: 160, lumber: 80 },
        build: 26, trains: ['heavy', 'caster'], desc: 'Открывает тауренов и шаманов.',
      },
    },
  },

  undead: {
    id: 'undead',
    name: 'Плеть',
    raceName: 'Нежить',
    color: '#a06bff',
    color3d: 0xa06bff,
    dark: '#2c1a53',
    accent: '#7dffb2',
    emblem: 'skull',
    tagline: 'Смерть. Голод. Тьма.',
    lore: 'Нежить не знает жалости. Гули рвут плоть, абоминации ломают стены, а некроманты возвращают павших.',
    bonuses: ['Абоминации очень живучи', 'Некроманты лечат войско', 'Гули быстры и дешевы'],
    units: {
      worker: {
        role: 'worker', name: 'Аколит', hp: 48, damage: 4, armor: 0, range: 1.3,
        speed: 3.6, train: 8, cost: { gold: 50 }, supply: 1, radius: 0.42,
        attackSpeed: 1.2, desc: 'Добывает золото и древесину, возводит постройки.',
      },
      melee: {
        role: 'melee', name: 'Гуль', hp: 105, damage: 12, armor: 0, range: 1.35,
        speed: 3.35, train: 13, cost: { gold: 80 }, supply: 2, radius: 0.5,
        attackSpeed: 1.1, desc: 'Быстрый и дешёвый хищник с острыми когтями.',
      },
      ranged: {
        role: 'ranged', name: 'Крипт-лучник', hp: 72, damage: 10, armor: 0, range: 6.7,
        speed: 3.0, train: 16, cost: { gold: 70, lumber: 20 }, supply: 2, radius: 0.45,
        attackSpeed: 1.55, projectile: 'bone', desc: 'Скелет-стрелок с костяным луком.',
      },
      heavy: {
        role: 'heavy', name: 'Абоминация', hp: 330, damage: 25, armor: 3, range: 2.0,
        speed: 2.45, train: 27, cost: { gold: 140, lumber: 50 }, supply: 4, radius: 0.9,
        attackSpeed: 1.85, desc: 'Гора сшитой плоти. Требует Алтарь тьмы.', requires: 'special',
      },
      caster: {
        role: 'caster', name: 'Некромант', hp: 82, damage: 10, armor: 0, range: 5.6,
        speed: 2.95, train: 22, cost: { gold: 100, lumber: 40 }, supply: 2, radius: 0.45,
        attackSpeed: 1.8, projectile: 'shadow', heal: 28, healRange: 7, healCooldown: 5.4,
        desc: 'Вытягивает жизнь и латает мёртвую плоть. Требует Алтарь тьмы.', requires: 'special',
      },
    },
    buildings: {
      hall: {
        role: 'hall', name: 'Некрополь', hp: 1750, size: 4.6, cost: { gold: 385, lumber: 205 },
        build: 45, supply: 10, dropoff: true, trains: ['worker'],
        desc: 'Сердце Плети. Обучает аколитов, принимает ресурсы, даёт 10 снабжения.',
      },
      farm: {
        role: 'farm', name: 'Могильник', hp: 460, size: 2.55, cost: { lumber: 80 },
        build: 13, supply: 8, desc: 'Повышает предел снабжения на 8.',
      },
      barracks: {
        role: 'barracks', name: 'Крипта', hp: 900, size: 3.9, cost: { gold: 120, lumber: 40 },
        build: 20, trains: ['melee', 'ranged'], desc: 'Готовит гулей и крипт-лучников.',
      },
      tower: {
        role: 'tower', name: 'Башня душ', hp: 720, size: 2.2, cost: { gold: 100, lumber: 60 },
        build: 18, attack: { damage: 16, range: 8.4, cooldown: 1.3, projectile: 'shadow' },
        desc: 'Пронзает врагов призрачными стрелами.',
      },
      special: {
        role: 'special', name: 'Алтарь тьмы', hp: 1050, size: 4.0, cost: { gold: 160, lumber: 80 },
        build: 26, trains: ['heavy', 'caster'], desc: 'Открывает абоминаций и некромантов.',
      },
    },
  },
};

export const ROLE_NAMES = {
  worker: 'Рабочий',
  melee: 'Ближний бой',
  ranged: 'Дальний бой',
  heavy: 'Тяжёлая пехота',
  caster: 'Поддержка',
  hall: 'Цитадель',
  farm: 'Снабжение',
  barracks: 'Казармы',
  tower: 'Оборона',
  special: 'Элитные войска',
};

export const RESOURCE_INFO = {
  gold: { name: 'Золото', icon: 'gold' },
  lumber: { name: 'Древесина', icon: 'lumber' },
};

export function unitDef(race, role) {
  return RACES[race].units[role];
}

export function buildingDef(race, role) {
  return RACES[race].buildings[role];
}

export function costText(cost) {
  const parts = [];
  if (cost.gold) parts.push(`${cost.gold} зол.`);
  if (cost.lumber) parts.push(`${cost.lumber} древ.`);
  return parts.join(' · ') || 'Бесплатно';
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const DIFFICULTY = {
  easy: {
    id: 'easy', name: 'Опытный', desc: 'Спокойный темп. Хорошо для знакомства.',
    aiWorkers: 8, aiArmy: 8, aiAttackDelay: 62, aiThink: 0.8, aiBonus: 0,
  },
  normal: {
    id: 'normal', name: 'Ветеран', desc: 'Сбалансированная война. Рекомендуется.',
    aiWorkers: 11, aiArmy: 6, aiAttackDelay: 48, aiThink: 0.55, aiBonus: 0.06,
  },
  hard: {
    id: 'hard', name: 'Полководец', desc: 'Быстрые волны и жёсткая экономика.',
    aiWorkers: 14, aiArmy: 5, aiAttackDelay: 36, aiThink: 0.4, aiBonus: 0.14,
  },
};
