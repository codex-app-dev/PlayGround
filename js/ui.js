import * as THREE from '../vendor/three.module.js';
import { RACES, DIFFICULTY, unitDef, buildingDef, formatTime, costText, TEAM_COLORS } from './data.js';
import { icon, crest } from './icons.js';
import { PortraitRenderer, iconRenderer } from './render.js';
import { num, raceDetailHTML, costHTML, summarizeSelection, endStatsHTML } from './ui_helpers.js';

const RESOURCE_ICON = { gold: 'gold', lumber: 'log', supply: 'supply' };
const TOAST_ICON = { info: 'flag', success: 'shield', warn: 'target', danger: 'sword' };

function $(id) { return document.getElementById(id); }

export class UI {
  constructor(options = {}) {
    this.audio = options.audio || null;
    this.cb = options;
    this.game = null;
    this.cameraRig = null;
    this.input = null;
    this.portrait = null;
    this.portraitEntity = null;
    this.selection = [];
    this.summary = null;
    this.menuRace = 'human';
    this.difficulty = 'normal';
    this.starting = false;
    this.paused = false;
    this.helpOpen = false;
    this.helpFromPause = false;
    this.ended = false;
    this.commands = [];
    this.queueSignature = '';
    this.queueEls = [];
    this.floats = [];
    this.toastTimes = new Map();
    this.statsDigest = '';
    this.lastBuildingDone = null;
    this.timers = { hud: 0, info: 0, commands: 0, queue: 0, minimap: 0 };
    this.el = this.cacheElements();
    this.fillStaticMarkup();
    this.bindMenu();
    this.bindHud();
    this.bindMinimap();
    this.bindGlobalKeys();
    this.selectRace('human', { silent: true });
    this.setDifficulty('normal', { silent: true });
  }

  cacheElements() {
    return {
      menu: $('menu'),
      menuStart: $('start-btn'),
      startSub: document.querySelector('#start-btn .start-sub'),
      raceCards: [...document.querySelectorAll('.race-card')],
      raceDetail: $('race-detail'),
      difficulty: $('difficulty'),
      difficultyButtons: [...document.querySelectorAll('#difficulty button')],
      loading: $('loading-screen'),
      loadingCrest: $('loading-crest'),
      loadingTitle: document.querySelector('#loading-screen .loading-title'),
      hud: $('hud'),
      playerCrest: $('player-crest'),
      playerRace: $('player-race'),
      resGold: $('res-gold'),
      resLumber: $('res-lumber'),
      resSupply: $('res-supply'),
      resSupplyWrap: document.querySelector('.resource.supply'),
      clock: $('game-clock'),
      mapClock: $('map-clock'),
      objectiveCrest: $('objective-crest'),
      objectiveTitle: $('objective-title'),
      objectiveName: $('objective-name'),
      toasts: $('toasts'),
      floatLayer: $('float-layer'),
      portraitHolder: $('portrait-holder'),
      portraitFallback: $('portrait-fallback'),
      portraitCount: $('portrait-count'),
      portraitName: $('portrait-name'),
      portraitSub: $('portrait-sub'),
      portraitHp: $('portrait-hp'),
      portraitHpText: $('portrait-hp-text'),
      infoName: $('info-name'),
      infoSub: $('info-sub'),
      infoDesc: $('info-desc'),
      statGrid: $('stat-grid'),
      commandTitle: $('command-title'),
      commandHint: $('command-hint'),
      commandGrid: $('command-grid'),
      queueRow: $('queue-row'),
      minimap: $('minimap'),
      btnHelp: $('btn-help'),
      btnSound: $('btn-sound'),
      btnPause: $('btn-pause'),
      pauseScreen: $('pause-screen'),
      pauseMenu: $('pause-menu-btn'),
      resume: $('resume-btn'),
      pauseHelp: $('pause-help-btn'),
      helpScreen: $('help-screen'),
      helpClose: $('help-close'),
      endScreen: $('end-screen'),
      endCrest: $('end-crest'),
      endKicker: $('end-kicker'),
      endTitle: $('end-title'),
      endSub: $('end-sub'),
      endStats: $('end-stats'),
      rematch: $('rematch-btn'),
      endMenu: $('end-menu-btn'),
    };
  }

  fillStaticMarkup() {
    document.querySelectorAll('[data-icon]').forEach((node) => {
      node.innerHTML = icon(node.dataset.icon);
    });
    document.querySelectorAll('[data-emblem]').forEach((node) => {
      node.innerHTML = crest(node.dataset.emblem);
    });
    this.el.btnHelp.innerHTML = icon('help');
    this.el.btnSound.innerHTML = icon('sound');
    this.el.btnPause.innerHTML = icon('pause');
    this.el.portraitFallback.innerHTML = crest('human');
  }

  // -------------------------------------------------------------------------
  // Menu
  // -------------------------------------------------------------------------
  bindMenu() {
    for (const card of this.el.raceCards) {
      const race = card.dataset.race;
      card.addEventListener('click', () => this.selectRace(race));
      card.addEventListener('mouseenter', () => {
        this.cb.onRaceHover?.(race);
        this.el.raceDetail.innerHTML = raceDetailHTML(race);
      });
      card.addEventListener('mouseleave', () => {
        this.cb.onRaceHover?.(null);
        this.el.raceDetail.innerHTML = raceDetailHTML(this.menuRace);
      });
    }

    for (const button of this.el.difficultyButtons) {
      button.addEventListener('click', () => {
        this.setDifficulty(button.dataset.difficulty);
        this.audio?.click();
      });
    }

    this.el.menuStart.addEventListener('click', () => this.beginStart());
  }

  selectRace(race, opts = {}) {
    if (!RACES[race]) return;
    this.menuRace = race;
    for (const card of this.el.raceCards) {
      card.classList.toggle('active', card.dataset.race === race);
    }
    this.el.raceDetail.innerHTML = raceDetailHTML(race);
    this.updateStartSub();
    this.cb.onRaceSelect?.(race);
    if (!opts.silent) this.audio?.click();
  }

  setDifficulty(difficulty, opts = {}) {
    if (!DIFFICULTY[difficulty]) return;
    this.difficulty = difficulty;
    for (const button of this.el.difficultyButtons) {
      button.classList.toggle('active', button.dataset.difficulty === difficulty);
    }
    this.updateStartSub();
    if (!opts.silent) this.audio?.click();
  }

  updateStartSub() {
    const diff = DIFFICULTY[this.difficulty]?.name || '';
    this.el.startSub.textContent = `Начать сражение · ${diff}`;
  }

  beginStart() {
    if (this.starting) return;
    this.starting = true;
    this.el.menuStart.disabled = true;
    this.audio?.init();
    this.audio?.click();
    this.cb.onStart?.(this.menuRace, this.difficulty);
  }

  showLoading(race) {
    this.el.loadingCrest.innerHTML = crest(race || this.menuRace);
    this.el.loadingTitle.textContent = 'Собираем армию…';
    this.el.loading.classList.remove('hidden');
  }

  hideLoading() {
    this.el.loading.classList.add('hidden');
    this.starting = false;
    this.el.menuStart.disabled = false;
  }

  // -------------------------------------------------------------------------
  // Game attachment and team chrome
  // -------------------------------------------------------------------------
  attachGame(game, cameraRig, input) {
    this.game = game;
    this.cameraRig = cameraRig;
    this.input = input;
    this.selection = [];
    this.summary = null;
    this.paused = false;
    this.helpOpen = false;
    this.helpFromPause = false;
    this.ended = false;
    this.starting = false;
    this.lastBuildingDone = null;
    this.queueSignature = '';
    this.statsDigest = '';
    this.el.starting = false;

    this.el.hud.classList.remove('hidden');
    this.el.menu.classList.add('hidden');
    this.el.loading.classList.add('hidden');
    this.hideOverlays();
    this.el.endScreen.classList.add('hidden');
    document.body.classList.add('in-game');

    this.ensurePortrait();
    this.portrait?.show(null);
    this.portraitEntity = null;
    this.renderTeamChrome();

    game.onSelectionChanged = (list) => this.handleSelection(list);
    game.onNotify = (text, type) => this.toast(text, type);
    game.onFloatText = (pos, text, color) => this.floatText(pos, text, color);
    game.onGameOver = (winner, teams, time) => this.showEnd(winner, teams, time);

    this.handleSelection([]);
    this.updateHud(true);
    this.clearToasts();
    this.clearFloats();
  }

  showMenu() {
    this.input?.setEnabled(false);
    this.game = null;
    this.cameraRig = null;
    this.input = null;
    this.selection = [];
    this.summary = null;
    this.paused = false;
    this.helpOpen = false;
    this.ended = false;
    this.starting = false;
    this.portrait?.show(null);
    this.portraitEntity = null;
    this.el.hud.classList.add('hidden');
    this.el.menu.classList.remove('hidden');
    this.el.loading.classList.add('hidden');
    this.el.menuStart.disabled = false;
    document.body.classList.remove('in-game');
    this.hideOverlays();
    this.clearToasts();
    this.clearFloats();
  }

  renderTeamChrome() {
    const game = this.game;
    if (!game) return;
    const player = RACES[game.playerRace];
    const enemy = RACES[game.aiRace];
    this.el.playerCrest.innerHTML = crest(game.playerRace);
    this.el.playerRace.textContent = player.name;
    this.el.objectiveCrest.innerHTML = crest(game.aiRace);
    this.el.objectiveTitle.textContent = 'Уничтожьте цитадель';
    this.el.objectiveName.textContent = enemy.buildings.hall.name;
    this.el.portraitFallback.innerHTML = crest(game.playerRace);
    this.el.portraitFallback.style.opacity = '1';
    this.updateSoundIcon();
  }

  ensurePortrait() {
    if (this.portrait) return;
    try {
      this.portrait = new PortraitRenderer(this.el.portraitHolder);
    } catch (err) {
      console.warn('Live portrait unavailable', err);
      this.portrait = null;
    }
  }

  // -------------------------------------------------------------------------
  // Selection, portrait and info panel
  // -------------------------------------------------------------------------
  handleSelection(list) {
    this.selection = (list || []).filter((e) => e && !e.dead);
    this.lastBuildingDone = null;
    this.refreshSummary(true);
    this.refreshCommands();
    this.updateQueue(true);
  }

  refreshSummary(force = false) {
    if (!this.game) return;
    const summary = summarizeSelection(this.game, this.selection);
    this.summary = summary;

    // Portrait renderer is only re-built when the primary unit/building changes.
    const portraitable = summary.portraitKind === 'unit' || summary.portraitKind === 'building';
    if (portraitable && summary.primary) {
      if (this.portraitEntity !== summary.primary) {
        this.ensurePortrait();
        this.portrait?.show(summary.primary);
        this.portraitEntity = summary.primary;
      }
      this.el.portraitFallback.style.opacity = '0';
    } else {
      if (this.portraitEntity) {
        this.portrait?.show(null);
        this.portraitEntity = null;
      }
      this.el.portraitFallback.style.opacity = '1';
      this.el.portraitFallback.innerHTML = summary.fallbackIcon
        ? icon(summary.fallbackIcon)
        : crest(summary.race || this.game.playerRace);
    }

    this.el.portraitName.textContent = summary.name;
    this.el.portraitSub.textContent = summary.sub;
    this.el.portraitCount.textContent = summary.count > 1 ? `${summary.count}` : '';
    this.el.portraitCount.classList.toggle('show', summary.count > 1);
    this.updatePortraitHp();

    if (summary.kind === 'building' && summary.primary) {
      const done = !!summary.primary.completed;
      if (this.lastBuildingDone !== null && this.lastBuildingDone !== done) {
        this.refreshCommands();
      }
      this.lastBuildingDone = done;
    }

    const digest = `${summary.name}|${summary.sub}|${summary.desc}|${summary.stats.map((s) => `${s.label}:${s.value}`).join(';')}`;
    if (force || digest !== this.statsDigest) {
      this.statsDigest = digest;
      this.renderInfo(summary);
    }
  }

  renderInfo(summary) {
    if (!this.game) return;
    this.el.infoName.textContent = summary.name;
    this.el.infoSub.textContent = summary.sub;
    this.el.infoDesc.textContent = summary.desc || '';
    const team = this.game.teams[0];
    const stats = summary.stats.length
      ? summary.stats
      : [
          { label: 'Сложность', value: this.game.difficulty.name, cls: 'gold' },
          { label: 'Раса', value: RACES[this.game.playerRace].name, cls: 'blue' },
          { label: 'Противник', value: RACES[this.game.aiRace].name, cls: 'red' },
          { label: 'Снабжение', value: `${team.supplyUsed} / ${team.supplyCap}` },
        ];
    this.el.statGrid.innerHTML = stats.map((s) => `
      <div class="stat ${s.cls || ''}">
        <span class="stat-label">${s.label}</span>
        <span class="stat-value">${s.value}</span>
      </div>`).join('');
  }

  updatePortraitHp() {
    if (!this.summary) return;
    const hp = this.summary.hp;
    this.el.portraitHp.style.width = `${Math.round(hp.ratio * 100)}%`;
    this.el.portraitHp.className = hp.cls || '';
    this.el.portraitHpText.textContent = hp.text;
  }

  // -------------------------------------------------------------------------
  // Command card
  // -------------------------------------------------------------------------
  thumb(race, role, isBuilding) {
    try {
      return iconRenderer.thumbnail(race, role, isBuilding, TEAM_COLORS.player3d);
    } catch (err) {
      console.warn('Thumbnail unavailable', err);
      return null;
    }
  }

  refreshCommands() {
    const game = this.game;
    if (!game) return;
    this.commands = [];
    this.el.commandGrid.innerHTML = '';
    const own = this.selection.filter((e) => e.team === 0 && !e.dead);
    const units = own.filter((e) => e.kind === 'unit');
    const buildings = own.filter((e) => e.kind === 'building');
    const primary = units[0] || buildings[0] || this.selection[0] || null;
    let title = 'ОБЗОР';
    let hint = 'ЛКМ — выбор';
    const items = [];

    if (units.length) {
      const workers = units.filter((u) => u.role === 'worker');
      const fighters = units.filter((u) => u.role !== 'worker');
      if (workers.length && !fighters.length) {
        title = 'СТРОИТЕЛЬСТВО';
        hint = workers.length > 1 ? `${workers.length} рабочих` : 'рабочий';
        const race = game.teams[0].race;
        for (const role of ['farm', 'barracks', 'tower', 'special', 'hall']) {
          const def = buildingDef(race, role);
          if (!def) continue;
          items.push({
            id: `build-${role}`,
            label: def.name,
            iconName: role,
            thumb: this.thumb(race, role, true),
            cost: def.cost,
            requireCost: true,
            onClick: () => this.input?.beginPlacement(role),
          });
        }
        items.push({
          id: 'gather-gold',
          label: 'Добывать золото',
          iconName: 'gold',
          onClick: () => this.sendWorkersTo('gold'),
        });
        items.push({
          id: 'gather-lumber',
          label: 'Добывать лес',
          iconName: 'lumber',
          onClick: () => this.sendWorkersTo('lumber'),
        });
        items.push({
          id: 'stop-workers',
          label: 'Стоп',
          iconName: 'stop',
          key: 'Z',
          onClick: () => this.stopSelection(units),
        });
      } else {
        title = 'ПРИКАЗЫ ОТРЯДУ';
        hint = `${fighters.length || units.length} бойцов`;
        items.push({
          id: 'attack-move',
          label: 'Атака по площади',
          iconName: 'attackMove',
          key: 'X',
          onClick: () => this.input?.beginAttackMove(),
        });
        items.push({
          id: 'stop',
          label: 'Остановить',
          iconName: 'stop',
          key: 'Z',
          onClick: () => this.stopSelection(units),
        });
        items.push({
          id: 'all-army',
          label: 'Вся армия',
          iconName: 'sword',
          onClick: () => this.selectArmy(),
        });
        items.push({
          id: 'all-workers',
          label: 'Все рабочие',
          iconName: 'pawn',
          onClick: () => this.selectWorkers(),
        });
      }
    } else if (buildings.length) {
      const b = buildings[0];
      const def = b.def;
      if (!b.completed) {
        title = `СТРОЙКА · ${def.name}`;
        hint = `${Math.floor(b.construction * 100)}% готово`;
        items.push({
          id: 'under-construction',
          label: 'Идёт стройка…',
          iconName: 'build',
          disabled: true,
          alwaysDisabled: true,
          onClick: null,
        });
      } else if (def.trains && def.trains.length) {
        title = `ОБУЧЕНИЕ · ${def.name}`;
        hint = b.queue.length ? `${b.queue.length} в очереди` : 'ПКМ — точка сбора';
        const race = game.teams[0].race;
        for (const role of def.trains) {
          const udef = unitDef(race, role);
          items.push({
            id: `train-${role}`,
            label: udef.name,
            iconName: role === 'worker' ? 'pawn' : role,
            thumb: this.thumb(race, role, false),
            cost: udef.cost,
            requireCost: true,
            trainBuilding: b,
            supplyCost: udef.supply,
            onClick: () => this.trainUnit(b, role),
          });
        }
      } else if (b.role === 'tower') {
        title = `ОБОРОНА · ${def.name}`;
        hint = 'автоматический обстрел';
        items.push({
          id: 'tower-auto',
          label: 'Автообстрел',
          iconName: 'tower',
          disabled: true,
          alwaysDisabled: true,
          onClick: null,
        });
      } else {
        title = def.name.toUpperCase();
        hint = 'ПКМ — точка сбора';
        items.push({
          id: 'no-orders',
          label: 'Нет приказов',
          iconName: 'flag',
          disabled: true,
          alwaysDisabled: true,
          onClick: null,
        });
      }
    } else if (primary && primary.kind === 'resource') {
      title = primary.resourceType === 'fountain' ? 'ИСТОЧНИК ЖИЗНИ' : 'РЕСУРС';
      hint = primary.resourceType === 'fountain' ? 'лечит союзников' : 'добыча ресурсов';
      items.push({
        id: 'resource-gather',
        label: primary.resourceType === 'lumber' ? 'Отправить лесорубов' : 'Отправить рабочих',
        iconName: primary.resourceType === 'lumber' ? 'lumber' : 'gather',
        onClick: () => this.sendWorkersToResource(primary),
      });
      items.push({
        id: 'resource-workers',
        label: 'Все рабочие',
        iconName: 'pawn',
        onClick: () => this.selectWorkers(),
      });
      items.push({
        id: 'resource-base',
        label: 'К базе',
        iconName: 'home',
        key: 'SPACE',
        onClick: () => this.cameraRig?.focusBase(),
      });
    } else if (primary && primary.kind === 'unit') {
      title = 'ВРАЖЕСКИЙ ОТРЯД';
      hint = 'выберите своих бойцов';
      items.push({
        id: 'enemy-army',
        label: 'Вся армия',
        iconName: 'sword',
        onClick: () => this.selectArmy(),
      });
      items.push({
        id: 'enemy-base',
        label: 'К базе',
        iconName: 'home',
        key: 'SPACE',
        onClick: () => this.cameraRig?.focusBase(),
      });
    } else {
      title = 'ОБЗОР';
      hint = 'карта долины';
      items.push({
        id: 'overview-workers',
        label: 'Все рабочие',
        iconName: 'pawn',
        key: 'TAB',
        onClick: () => this.selectWorkers(),
      });
      items.push({
        id: 'overview-army',
        label: 'Вся армия',
        iconName: 'sword',
        key: 'CTRL A',
        onClick: () => this.selectArmy(),
      });
      items.push({
        id: 'overview-base',
        label: 'К базе',
        iconName: 'home',
        key: 'SPACE',
        onClick: () => this.cameraRig?.focusBase(),
      });
    }

    this.el.commandTitle.textContent = title;
    this.el.commandHint.textContent = hint;
    for (const item of items) this.addCommand(item);
    this.updateCommandStates();
    this.updateQueue(true);
  }

  addCommand(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmd-btn';
    btn.dataset.command = item.id;
    btn.title = item.cost
      ? `${item.label} — ${costText(item.cost)}`
      : item.label;
    if (item.disabled) btn.classList.add('disabled');

    const iconWrap = document.createElement('span');
    iconWrap.className = 'cmd-icon';
    if (item.thumb) {
      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = '';
      img.draggable = false;
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = icon(item.iconName || 'help');
    }
    btn.appendChild(iconWrap);

    const label = document.createElement('span');
    label.className = 'cmd-name';
    label.textContent = item.label;
    btn.appendChild(label);

    if (item.cost && (item.cost.gold || item.cost.lumber)) {
      const cost = document.createElement('span');
      cost.className = 'cmd-cost';
      cost.innerHTML = costHTML(item.cost);
      btn.appendChild(cost);
    }
    if (item.key) {
      const key = document.createElement('span');
      key.className = 'cmd-key';
      key.textContent = item.key;
      btn.appendChild(key);
    }

    btn.addEventListener('click', () => {
      if (this.ended) return;
      if (btn.classList.contains('disabled')) {
        this.audio?.deny();
        this.toast(item.blockedText || 'Сейчас это недоступно', 'warn');
        return;
      }
      this.audio?.click();
      item.onClick?.();
    });

    this.el.commandGrid.appendChild(btn);
    this.commands.push({
      el: btn,
      item,
      cost: item.cost,
      requireCost: !!item.requireCost,
      trainBuilding: item.trainBuilding || null,
      supplyCost: item.supplyCost || 0,
      alwaysDisabled: !!item.alwaysDisabled,
    });
  }

  updateCommandStates() {
    if (!this.game) return;
    const game = this.game;
    const team = game.teams[0];
    const queued = game.totalQueuedSupply(0);
    for (const cmd of this.commands) {
      let disabled = this.ended || game.over || cmd.alwaysDisabled;
      if (cmd.requireCost && cmd.cost && !game.canAfford(team, cmd.cost)) disabled = true;
      if (cmd.trainBuilding) {
        const b = cmd.trainBuilding;
        if (b.dead || !b.completed || b.queue.length >= 5) disabled = true;
        if (team.supplyUsed + queued + cmd.supplyCost > team.supplyCap) disabled = true;
      }
      cmd.el.classList.toggle('disabled', disabled);
    }
    if (this.commands.length) {
      const b = this.productionBuilding();
      if (b) this.el.commandHint.textContent = b.queue.length ? `${b.queue.length} в очереди` : 'ПКМ — точка сбора';
    }
  }

  productionBuilding() {
    if (this.selection.length !== 1) return null;
    const b = this.selection[0];
    if (!b || b.kind !== 'building' || b.team !== 0 || !b.def?.trains?.length) return null;
    return b;
  }

  sendWorkersTo(type) {
    const workers = this.selection.filter((e) => e.kind === 'unit' && e.role === 'worker' && e.team === 0 && !e.dead);
    if (!workers.length) return;
    let cx = 0;
    let cz = 0;
    for (const w of workers) { cx += w.pos.x; cz += w.pos.z; }
    cx /= workers.length;
    cz /= workers.length;
    const node = this.game.findNearestResource(this.game.teams[0], type, cx, cz);
    if (!node) {
      this.toast(type === 'gold' ? 'Золотых жил больше не осталось' : 'Лес вырублен', 'warn');
      return;
    }
    this.game.orderGather(workers, node);
    this.audio?.order();
  }

  sendWorkersToResource(node) {
    if (!node || node.dead) return;
    const workers = this.game.unitsOf(0)
      .filter((u) => u.role === 'worker')
      .sort((a, b) => Math.hypot(a.pos.x - node.pos.x, a.pos.z - node.pos.z) - Math.hypot(b.pos.x - node.pos.x, b.pos.z - node.pos.z));
    if (!workers.length) {
      this.toast('У вас нет рабочих', 'warn');
      return;
    }
    this.game.orderGather(workers.slice(0, 3), node);
    this.audio?.order();
  }

  stopSelection(units) {
    this.game.orderStop(units.filter((u) => u.kind === 'unit' && u.team === 0));
    this.audio?.order();
  }

  trainUnit(building, role) {
    if (!building || building.dead) return;
    this.game.enqueueUnit(building, role);
    this.updateQueue(true);
    this.updateCommandStates();
  }

  selectArmy() {
    const army = this.game.unitsOf(0).filter((u) => u.role !== 'worker');
    if (!army.length) {
      this.toast('Армия ещё не собрана', 'info');
      return;
    }
    this.game.setSelection(army);
    this.audio?.select();
  }

  selectWorkers() {
    const workers = this.game.unitsOf(0).filter((u) => u.role === 'worker');
    if (!workers.length) {
      this.toast('У вас нет рабочих', 'warn');
      return;
    }
    this.game.setSelection(workers);
    this.audio?.select();
  }

  // -------------------------------------------------------------------------
  // Production queue
  // -------------------------------------------------------------------------
  updateQueue(force = false) {
    if (!this.game) return;
    const b = this.productionBuilding();
    const signature = b ? `${b.id}:${b.queue.map((q) => q.role).join(',')}` : '';
    if (force || signature !== this.queueSignature) {
      this.queueSignature = signature;
      this.el.queueRow.innerHTML = '';
      this.queueEls = [];
      if (b && b.queue.length) {
        b.queue.forEach((q, index) => {
          const udef = unitDef(this.game.teams[0].race, q.role);
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'queue-item';
          item.title = `${udef.name} — нажмите, чтобы отменить`;
          item.dataset.index = index;
          const label = document.createElement('span');
          label.className = 'queue-label';
          label.textContent = udef.name;
          const fill = document.createElement('span');
          fill.className = 'queue-fill';
          item.appendChild(fill);
          item.appendChild(label);
          item.addEventListener('click', () => {
            this.game?.cancelQueue(b, index);
            this.audio?.click();
            this.updateQueue(true);
            this.refreshSummary(true);
            this.updateCommandStates();
          });
          this.el.queueRow.appendChild(item);
          this.queueEls.push({ el: item, fill, queue: q });
        });
      }
    }
    this.updateQueueProgress();
  }

  updateQueueProgress() {
    for (const row of this.queueEls) {
      const q = row.queue;
      if (!q) continue;
      const ratio = q.total > 0 ? Math.min(1, q.time / q.total) : 0;
      row.fill.style.width = `${Math.round(ratio * 100)}%`;
    }
  }

  // -------------------------------------------------------------------------
  // HUD numbers and objective
  // -------------------------------------------------------------------------
  updateHud(force = false) {
    if (!this.game) return;
    const team = this.game.teams[0];
    this.el.resGold.textContent = num(team.gold);
    this.el.resLumber.textContent = num(team.lumber);
    this.el.resSupply.textContent = `${team.supplyUsed} / ${team.supplyCap}`;
    this.el.resSupplyWrap.classList.toggle('low', team.supplyUsed >= team.supplyCap);
    const clock = formatTime(this.game.time);
    this.el.clock.textContent = clock;
    this.el.mapClock.textContent = clock;

    const enemyHall = this.game.getHall(1) || this.game.buildingsOf(1).find((b) => b.role === 'hall');
    if (enemyHall) {
      const ratio = Math.max(0, Math.min(1, enemyHall.hp / enemyHall.maxHp));
      this.el.objectiveName.textContent = `${enemyHall.def.name} · ${Math.round(ratio * 100)}%`;
    } else if (this.game.over) {
      this.el.objectiveName.textContent = 'Цитадель пала';
    }
  }

  // -------------------------------------------------------------------------
  // Toasts and floating text
  // -------------------------------------------------------------------------
  toast(text, type = 'info') {
    if (!text) return;
    const now = performance.now();
    const last = this.toastTimes.get(text) || 0;
    if (now - last < 900) return;
    this.toastTimes.set(text, now);
    while (this.el.toasts.children.length >= 4) {
      this.el.toasts.firstElementChild?.remove();
    }
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `${icon(TOAST_ICON[type] || 'flag')}<span>${text}</span>`;
    this.el.toasts.appendChild(node);
    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 300);
    }, type === 'danger' ? 4200 : 3200);
  }

  clearToasts() {
    this.el.toasts.innerHTML = '';
    this.toastTimes.clear();
  }

  floatText(pos, text, color = '#ffd166') {
    if (!this.game || !this.cameraRig) return;
    const node = document.createElement('span');
    node.className = `float-text ${String(text).startsWith('+') ? 'plus' : ''}`;
    node.textContent = text;
    node.style.color = color;
    this.el.floatLayer.appendChild(node);
    this.floats.push({
      el: node,
      world: new THREE.Vector3(pos.x, pos.y ?? 1.6, pos.z),
      life: 0,
      total: 1.55,
    });
  }

  updateFloats(dt) {
    if (!this.floats.length) return;
    const camera = this.cameraRig?.camera;
    const v = new THREE.Vector3();
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      if (f.life >= f.total || !camera) {
        f.el.remove();
        this.floats.splice(i, 1);
        continue;
      }
      f.world.y += dt * 0.72;
      v.copy(f.world).project(camera);
      if (v.z > 1 || v.z < -1) {
        f.el.style.opacity = '0';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const k = f.life / f.total;
      f.el.style.opacity = `${Math.max(0, 1 - k * k)}`;
      f.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 + k * 0.18})`;
    }
  }

  clearFloats() {
    for (const f of this.floats) f.el.remove();
    this.floats = [];
  }

  // -------------------------------------------------------------------------
  // Minimap
  // -------------------------------------------------------------------------
  bindMinimap() {
    const canvas = this.el.minimap;
    let down = false;
    const move = (e) => {
      if (!this.cameraRig) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 150 - 75;
      const z = ((e.clientY - rect.top) / rect.height) * 150 - 75;
      this.cameraRig.focusOn(x, z);
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      down = true;
      canvas.setPointerCapture?.(e.pointerId);
      move(e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (down) move(e);
    });
    canvas.addEventListener('pointerup', () => { down = false; });
    canvas.addEventListener('pointercancel', () => { down = false; });
  }

  drawMinimap() {
    if (!this.game || !this.cameraRig) return;
    const canvas = this.el.minimap;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const toX = (x) => ((x + 75) / 150) * size;
    const toY = (z) => ((z + 75) / 150) * size;
    const terrain = this.game.world?.terrainCanvas;
    if (terrain) ctx.drawImage(terrain, 0, 0, size, size);
    else {
      ctx.fillStyle = '#45603b';
      ctx.fillRect(0, 0, size, size);
    }
    ctx.fillStyle = 'rgba(2, 7, 10, 0.15)';
    ctx.fillRect(0, 0, size, size);

    const time = performance.now() / 1000;
    const fountain = this.game.resources.find((r) => r.resourceType === 'fountain');
    if (fountain) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(93, 224, 216, 0.7)';
      ctx.arc(toX(fountain.pos.x), toY(fountain.pos.z), 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(128, 255, 240, 0.4)';
      ctx.arc(toX(fountain.pos.x), toY(fountain.pos.z), 6 + Math.sin(time * 2) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const r of this.game.resources) {
      if (r.dead || r.resourceType !== 'gold' || r.amount <= 0) continue;
      const x = toX(r.pos.x);
      const y = toY(r.pos.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = r.rich ? '#ffe27a' : '#e1b44e';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
      if (r.rich) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 226, 122, 0.35)';
        ctx.arc(x, y, 6 + Math.sin(time * 1.7) * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const b of this.game.buildings) {
      if (b.dead) continue;
      ctx.globalAlpha = b.construction < 1 ? 0.55 : 0.95;
      ctx.fillStyle = b.team === 0 ? '#5d9bff' : '#ee665c';
      const s = Math.max(4, b.size * 1.1);
      ctx.fillRect(toX(b.pos.x) - s / 2, toY(b.pos.z) - s / 2, s, s);
      if (b.role === 'hall') {
        ctx.strokeStyle = b.team === 0 ? 'rgba(164, 205, 255, 0.7)' : 'rgba(255, 170, 160, 0.7)';
        ctx.strokeRect(toX(b.pos.x) - s / 2 - 1, toY(b.pos.z) - s / 2 - 1, s + 2, s + 2);
      }
    }
    ctx.globalAlpha = 1;

    for (const u of this.game.units) {
      if (u.dead) continue;
      ctx.fillStyle = u.team === 0 ? '#a9d1ff' : '#ff978e';
      ctx.fillRect(toX(u.pos.x) - 1.1, toY(u.pos.z) - 1.1, 2.2, 2.2);
    }

    for (const e of this.game.selection) {
      if (e.dead || e.kind === 'resource') continue;
      ctx.beginPath();
      ctx.strokeStyle = '#ffe19a';
      ctx.lineWidth = 1.2;
      ctx.arc(toX(e.pos.x), toY(e.pos.z), 4.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    const enemyHall = this.game.getHall(1);
    if (enemyHall) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 106, 94, ${0.25 + Math.sin(time * 2.4) * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.arc(toX(enemyHall.pos.x), toY(enemyHall.pos.z), 8 + Math.sin(time * 2.4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Camera footprint.
    const rect = this.cameraRig.dom.getBoundingClientRect();
    const corners = [
      [rect.left + 2, rect.top + 2],
      [rect.right - 2, rect.top + 2],
      [rect.right - 2, rect.bottom - 2],
      [rect.left + 2, rect.bottom - 2],
    ];
    const points = [];
    for (const [x, y] of corners) {
      const ground = this.cameraRig.screenToGround(x, y);
      if (ground) points.push([toX(ground.x), toY(ground.z)]);
    }
    if (points.length === 4) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 225, 154, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 225, 154, 0.72)';
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // Pause, help, sound
  // -------------------------------------------------------------------------
  bindHud() {
    this.el.btnPause.addEventListener('click', () => this.togglePause());
    this.el.btnHelp.addEventListener('click', () => this.openHelp(false));
    this.el.btnSound.addEventListener('click', () => this.toggleSound());
    this.el.resume.addEventListener('click', () => this.resume());
    this.el.pauseHelp.addEventListener('click', () => this.openHelp(true));
    this.el.pauseMenu.addEventListener('click', () => this.cb.onMenu?.());
    this.el.helpClose.addEventListener('click', () => this.closeHelp());
    this.el.rematch.addEventListener('click', () => this.cb.onRematch?.());
    this.el.endMenu.addEventListener('click', () => this.cb.onMenu?.());
  }

  updateSoundIcon() {
    const on = this.audio ? this.audio.enabled : true;
    this.el.btnSound.innerHTML = icon(on ? 'sound' : 'mute');
    this.el.btnSound.title = on ? 'Звук включён' : 'Звук выключен';
  }

  toggleSound() {
    if (!this.audio) return;
    this.audio.init();
    this.audio.setEnabled(!this.audio.enabled);
    this.updateSoundIcon();
    this.audio.click?.();
    this.toast(this.audio.enabled ? 'Звук включён' : 'Звук выключен', 'info');
  }

  pause() {
    if (!this.game || this.paused || this.ended) return;
    this.paused = true;
    this.game.paused = true;
    this.input?.setEnabled(false);
    this.el.pauseScreen.classList.remove('hidden');
    this.el.btnPause.innerHTML = icon('play');
    this.audio?.click();
  }

  resume() {
    if (!this.game || !this.paused) return;
    this.paused = false;
    this.helpOpen = false;
    this.game.paused = false;
    this.input?.setEnabled(true);
    this.el.pauseScreen.classList.add('hidden');
    this.el.helpScreen.classList.add('hidden');
    this.el.btnPause.innerHTML = icon('pause');
    this.audio?.click();
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  openHelp(fromPause = false) {
    if (!this.game || this.ended) return;
    this.helpFromPause = fromPause || this.paused;
    if (!this.paused) {
      this.paused = true;
      this.game.paused = true;
      this.input?.setEnabled(false);
    }
    this.el.pauseScreen.classList.add('hidden');
    this.el.helpScreen.classList.remove('hidden');
    this.el.btnPause.innerHTML = icon('play');
    this.helpOpen = true;
    this.audio?.click();
  }

  closeHelp() {
    if (!this.helpOpen) return;
    this.helpOpen = false;
    this.el.helpScreen.classList.add('hidden');
    this.audio?.click();
    if (this.helpFromPause) {
      this.el.pauseScreen.classList.remove('hidden');
    } else {
      this.resume();
    }
  }

  hideOverlays() {
    this.el.pauseScreen.classList.add('hidden');
    this.el.helpScreen.classList.add('hidden');
    this.el.endScreen.classList.add('hidden');
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.game && !this.el.menu.classList.contains('hidden')) {
        e.preventDefault();
        this.beginStart();
        return;
      }
      if (!this.game || this.ended) return;
      const key = e.key.toLowerCase();
      if (this.helpOpen) {
        if (e.key === 'Escape' || e.key === 'F1') {
          e.preventDefault();
          this.closeHelp();
        }
        return;
      }
      if (this.paused && (e.key === 'Escape' || key === 'p')) {
        e.preventDefault();
        this.resume();
      }
    });
  }

  // -------------------------------------------------------------------------
  // End screen
  // -------------------------------------------------------------------------
  showEnd(winner, teams, time) {
    if (!this.game) return;
    this.ended = true;
    this.paused = false;
    this.helpOpen = false;
    this.el.pauseScreen.classList.add('hidden');
    this.el.helpScreen.classList.add('hidden');
    this.input?.setEnabled(false);
    this.el.btnPause.innerHTML = icon('pause');

    const victory = winner === 0;
    this.el.endScreen.classList.toggle('defeat', !victory);
    this.el.endScreen.classList.remove('hidden');
    this.el.endCrest.innerHTML = crest(victory ? this.game.playerRace : this.game.aiRace);
    this.el.endKicker.textContent = victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    this.el.endTitle.textContent = victory ? 'Трон ваш' : 'Долина пала';
    this.el.endSub.textContent = victory
      ? `Цитадель врага обращена в прах. Долина признала нового владыку за ${formatTime(time)}.`
      : `Ваша цитадель пала. Немногие выжившие скрылись в лесах. Сложность: ${this.game.difficulty.name}.`;
    this.el.endStats.innerHTML = endStatsHTML(teams, time, this.game.difficulty);

    if (victory) this.audio?.victory?.();
    else this.audio?.defeat?.();
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------
  update(dt) {
    if (!this.game) return;
    this.portrait?.update(dt);
    this.updateFloats(dt);

    this.timers.hud += dt;
    if (this.timers.hud >= 0.12) {
      this.timers.hud = 0;
      this.updateHud();
    }
    this.timers.info += dt;
    if (this.timers.info >= 0.25) {
      this.timers.info = 0;
      this.refreshSummary(false);
    }
    this.timers.commands += dt;
    if (this.timers.commands >= 0.22) {
      this.timers.commands = 0;
      this.updateCommandStates();
    }
    this.timers.queue += dt;
    if (this.timers.queue >= 0.09) {
      this.timers.queue = 0;
      this.updateQueue(false);
    }
    this.timers.minimap += dt;
    if (this.timers.minimap >= 0.13) {
      this.timers.minimap = 0;
      this.drawMinimap();
    }
  }
}
