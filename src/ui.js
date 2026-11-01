import * as THREE from 'three';

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const TONES = { gold: 'gold', red: 'red', blue: 'blue' };

export class UI {
  constructor(game) {
    this.game = game;
    this.$ = id => document.getElementById(id);
    this.root = this.$('hud');
    this.menu = this.$('menu');
    this.pause = this.$('pause');
    this.result = this.$('result');
    this.mapScreen = this.$('map-screen');
    this.minimap = this.$('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.bigMap = this.$('big-map');
    this.bigCtx = this.bigMap.getContext('2d');
    this.compass = this.$('compass');
    this.compassCtx = this.compass.getContext('2d');
    this.crosshair = this.$('crosshair');
    this.damageVignette = this.$('damage-vignette');
    this.zoneVignette = this.$('zone-vignette');
    this.healVignette = this.$('heal-vignette');
    this.hitmarkerEl = this.$('hitmarker');
    this.killfeedEl = this.$('killfeed');
    this.toastStack = this.$('toast-stack');
    this.phaseBanner = this.$('phase-banner');
    this.phaseKicker = this.$('phase-kicker');
    this.phaseTitle = this.$('phase-title');
    this.healthFill = this.$('health-fill');
    this.armorFill = this.$('armor-fill');
    this.healthValue = this.$('health-value');
    this.armorValue = this.$('armor-value');
    this.healthState = this.$('health-state');
    this.medCount = this.$('med-count');
    this.killCount = this.$('kill-count');
    this.magAmmo = this.$('mag-ammo');
    this.reserveAmmo = this.$('reserve-ammo');
    this.weaponName = this.$('weapon-name');
    this.weaponType = this.$('weapon-type');
    this.fireMode = this.$('fire-mode');
    this.weaponSlots = this.$('weapon-slots');
    this.reloadFill = this.$('reload-fill');
    this.reloadTrack = document.querySelector('.reload-track');
    this.zoneClock = this.$('zone-clock');
    this.zoneLabel = this.$('zone-label');
    this.aliveCount = this.$('alive-count');
    this.locationName = this.$('location-name');
    this.coordReadout = this.$('coord-readout');
    this.buildBar = this.$('build-bar');
    this.woodCount = this.$('wood-count');
    this.buildValid = this.$('build-valid');
    this.dropReadout = this.$('drop-readout');
    this.altitude = this.$('altitude');
    this.dropHint = this.$('drop-hint');
    this.controlHint = this.$('control-hint');
    this.interactPrompt = this.$('interact-prompt');
    this.touchFire = this.$('touch-fire');
    this.minimapWrap = this.$('minimap-wrap');
    this.vitalsPanel = document.querySelector('.vitals-panel');
    this.scope = this.$('scope-overlay');

    this.lastCompass = -1;
    this.lastMapDraw = 0;
    this.lastBigDraw = 0;
    this.lastWeaponSignature = '';
    this.weaponSlotEls = [];
    this.zoneOutside = false;
    this.hintTimer = 12;
    this.bannerTimer = 0;
    this.mapOpen = false;
    this.lastLocation = '';
    this.lastCoord = '';
    this.toastTimers = new Set();

    this.bind();
  }

  bind() {
    this.minimapWrap.addEventListener('click', () => {
      if (this.game.state === 'playing' || this.game.state === 'paused') this.openMap();
    });
    this.$('map-close').addEventListener('click', () => this.closeMap());
    this.$('map-screen').addEventListener('click', e => {
      if (e.target === this.mapScreen) this.closeMap();
    });
    document.querySelectorAll('.build-piece').forEach(btn => {
      btn.addEventListener('click', () => {
        this.game.player.setBuildType(btn.dataset.piece, this.game);
      });
    });
    this.$('sound-toggle').addEventListener('click', () => {
      const muted = this.game.audio.toggle();
      const b = this.$('sound-toggle').querySelector('b');
      b.textContent = muted ? 'OFF' : 'ON';
      this.$('sound-toggle').classList.toggle('off', muted);
    });
  }

  bootDone() {
    const boot = this.$('boot');
    boot.classList.add('done');
    setTimeout(() => boot.classList.add('hidden'), 900);
  }

  showMenu() {
    document.body.classList.remove('in-match');
    this.menu.classList.remove('hidden', 'leaving');
    this.root.classList.add('hidden');
    this.result.classList.add('hidden');
    this.pause.classList.add('hidden');
  }

  startGame() {
    document.body.classList.add('in-match');
    this.menu.classList.add('leaving');
    setTimeout(() => this.menu.classList.add('hidden'), 550);
    this.root.classList.remove('hidden');
    this.result.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.hintTimer = 13;
    this.controlHint.classList.remove('fade');
    this.weaponSlots.innerHTML = '';
    this.lastWeaponSignature = '';
    if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760) {
      document.body.classList.add('touch');
    }
  }

  showPause() {
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  toast(title, detail = '', tone = '') {
    const el = document.createElement('div');
    el.className = `toast ${TONES[tone] || ''}`;
    el.innerHTML = `<strong></strong><span></span>`;
    el.querySelector('strong').textContent = title;
    el.querySelector('span').textContent = detail;
    this.toastStack.appendChild(el);
    while (this.toastStack.children.length > 3) {
      this.toastStack.firstElementChild.remove();
    }
    const timer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 380);
      this.toastTimers.delete(timer);
    }, 2700);
    this.toastTimers.add(timer);
  }

  zoneUpdate(zone) {
    if (!zone || !zone.active) return;
    this.zoneLabel.textContent = 'NEXT ZONE';
    this.zoneLabel.style.color = 'var(--blue)';
    this.refreshMap();
  }

  zonePhase(title, subtitle) {
    this.phaseKicker.textContent = subtitle;
    this.phaseTitle.textContent = title;
    this.phaseBanner.classList.add('visible');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.phaseBanner.classList.remove('visible'), 3600);
  }

  killfeed(entry) {
    const el = document.createElement('div');
    el.className = 'kill-entry';
    const killer = document.createElement('b');
    killer.textContent = entry.killer || 'ZONE';
    if (entry.killer === 'YOU') killer.classList.add('you');
    const arrow = document.createElement('i');
    arrow.textContent = '▸';
    const victim = document.createElement('b');
    victim.textContent = entry.victim;
    const weapon = document.createElement('em');
    weapon.textContent = entry.weapon || 'ZONE';
    el.append(killer, arrow, victim, weapon);
    this.killfeedEl.appendChild(el);
    while (this.killfeedEl.children.length > 5) this.killfeedEl.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 420);
    }, 6000);
  }

  hitmarker(head = false, killed = false) {
    const el = this.hitmarkerEl;
    el.classList.remove('show', 'head', 'kill');
    void el.offsetWidth;
    el.classList.add('show');
    if (head) el.classList.add('head');
    if (killed) el.classList.add('kill');
  }

  damage(amount, attacker) {
    this.damageVignette.classList.add('hit');
    clearTimeout(this._damageTimer);
    this._damageTimer = setTimeout(() => this.damageVignette.classList.remove('hit'), 170);
    if (amount > 12) this.game.player.shake = Math.max(this.game.player.shake, 0.12);
  }

  setOutside(active, dps) {
    this.zoneOutside = active;
    this.zoneVignette.classList.toggle('active', active);
    if (active) {
      this.zoneLabel.textContent = 'OUTSIDE';
      this.zoneLabel.style.color = 'var(--red)';
    }
  }

  setBuildMode(active, type = 'wall', materials = 0) {
    this.buildBar.classList.toggle('hidden', !active);
    document.body.classList.toggle('building', active);
    this.touchFire.textContent = active ? 'PLACE' : 'FIRE';
    this.touchFire.classList.toggle('placing', active);
    if (active) {
      document.querySelectorAll('.build-piece').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.piece === type);
      });
      this.woodCount.textContent = materials;
      this.weaponName.textContent = 'BUILD MODE';
      this.weaponType.textContent = 'STRUCTURES';
    }
  }

  updateBuildValid(valid, materials) {
    this.woodCount.textContent = materials;
    this.buildBar.style.borderTopColor = valid ? 'var(--gold)' : 'var(--red)';
  }

  update(game) {
    const player = game.player;
    const world = game.world;
    const zone = game.zone;

    if (player.mode === 'drop') {
      this.dropReadout.classList.remove('hidden');
      this.altitude.textContent = Math.max(0, Math.round(player.pos.y - world.terrainHeight(player.pos.x, player.pos.z)));
      this.dropHint.textContent = player.chuteOpen ? 'STEER WITH WASD · LAND NEAR LOOT' : 'STEER WITH WASD · CHUTE AUTO-DEPLOYS AT 55M';
    } else {
      this.dropReadout.classList.add('hidden');
    }

    const def = player.activeDef;
    const ammo = player.ammoText();
    this.magAmmo.textContent = ammo.mag;
    this.reserveAmmo.textContent = ammo.reserve;
    if (!player.buildMode) {
      this.weaponName.textContent = def ? def.name : 'UNARMED';
      this.weaponType.textContent = def ? def.typeLabel : 'NO WEAPON';
      this.fireMode.textContent = def ? def.mode : '—';
    }
    this.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.armorFill.style.width = `${Math.max(0, player.armor)}%`;
    this.healthValue.textContent = Math.ceil(player.health);
    this.armorValue.textContent = Math.ceil(player.armor);
    this.medCount.textContent = player.meds;
    this.killCount.textContent = player.kills;
    this.vitalsPanel.classList.toggle('low', player.health <= 30);
    this.healthState.textContent = player.health <= 0 ? 'DOWN' : player.health < 30 ? 'CRITICAL' : player.health < 65 ? 'WOUNDED' : 'STABLE';
    this.woodCount.textContent = player.materials;

    if (this.reloadTrack) {
      const reloading = player.reloadTimer > 0;
      this.reloadTrack.classList.toggle('active', reloading);
      if (reloading) this.reloadFill.style.width = `${(1 - player.reloadTimer / player.reloadTotal) * 100}%`;
    }

    const sig = player.weapons.map(w => w ? `${w.id}:${w.mag}:${w.reserve}` : 'empty').join('|');
    if (sig !== this.lastWeaponSignature || this.weaponSlotEls.length === 0) {
      this.updateWeaponSlots(player);
      this.lastWeaponSignature = sig;
    } else {
      this.weaponSlotEls.forEach((el, i) => el.classList.toggle('active', i === player.currentSlot));
    }

    this.crosshair.style.setProperty('--spread', `${Math.round(7 + player.shotSpread * 380 + Math.min(8, player.moveSpeed * 0.8))}px`);
    this.crosshair.classList.toggle('aiming', player.aiming);
    this.crosshair.style.opacity = player.buildMode || player.mode === 'drop' || player.dead ? '0' : '1';

    const remaining = game.botManager.spawned ? game.botManager.aliveCount : game.botManager.rosterSize;
    this.aliveCount.textContent = (player.dead ? 0 : 1) + remaining;
    this.zoneClock.textContent = zone.active ? this.formatTime(zone.timeLeft()) : '--:--';
    if (zone.state === 'shrink') {
      this.zoneLabel.textContent = 'CLOSING';
      this.zoneLabel.style.color = 'var(--red)';
    } else if (zone.state === 'final') {
      this.zoneLabel.textContent = 'FINAL';
      this.zoneLabel.style.color = 'var(--red)';
    } else if (!this.zoneOutside) {
      this.zoneLabel.textContent = 'NEXT ZONE';
      this.zoneLabel.style.color = 'var(--blue)';
    }
    document.querySelector('.zone-readout').classList.toggle('danger', zone.state === 'shrink' || zone.state === 'final' || this.zoneOutside);
    this.zoneClock.style.color = zone.state === 'shrink' || this.zoneOutside ? 'var(--red)' : '';

    const { site, distance } = world.nearestSite(player.pos.x, player.pos.z);
    const location = distance < site.r * 1.25 ? site.name : distance < 80 ? 'OUTSKIRTS' : 'ISLA VERDE';
    if (location !== this.lastLocation) {
      this.locationName.textContent = location;
      this.lastLocation = location;
    }
    const coord = `X ${String(Math.round(player.pos.x)).padStart(3, '0')} · Z ${String(Math.round(player.pos.z)).padStart(3, '0')}`;
    if (coord !== this.lastCoord) {
      this.coordReadout.textContent = coord;
      this.lastCoord = coord;
    }

    if (Math.abs(player.yaw - this.lastCompass) > 0.003) {
      this.drawCompass(player);
      this.lastCompass = player.yaw;
    }
    const now = performance.now();
    if (now - this.lastMapDraw > 90) {
      this.drawMinimap(game);
      this.lastMapDraw = now;
    }
    if (this.mapOpen && now - this.lastBigDraw > 90) {
      this.drawBigMap(game);
      this.lastBigDraw = now;
    }

    this.controlHint.classList.toggle('fade', game.elapsed > 13);
    if (player.dropShield > 0) {
      this.healthState.textContent = `PROTECTED ${Math.ceil(player.dropShield)}S`;
    } else if (this.zoneOutside) {
      this.healthState.textContent = 'IN THE BLUE';
    }
  }

  updateWeaponSlots(player) {
    this.weaponSlots.innerHTML = '';
    this.weaponSlotEls = [];
    player.weapons.forEach((w, i) => {
      const el = document.createElement('div');
      el.className = `wslot${i === player.currentSlot ? ' active' : ''}`;
      const b = document.createElement('b');
      b.textContent = i + 1;
      const span = document.createElement('span');
      if (w) {
        const wd = w.id === 'ar' ? 'RANGER' : w.id === 'shotgun' ? 'BREACH' : w.id === 'sniper' ? 'M40' : 'P9';
        span.textContent = wd;
      } else {
        span.textContent = 'EMPTY';
      }
      el.append(b, span);
      this.weaponSlots.appendChild(el);
      this.weaponSlotEls.push(el);
    });
  }

  drawCompass(player) {
    const ctx = this.compassCtx;
    const w = this.compass.width;
    const h = this.compass.height;
    const heading = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const span = 120;
    const pxPerDeg = w / span;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let d = Math.floor(heading - span / 2); d <= heading + span / 2; d++) {
      const norm = ((d % 360) + 360) % 360;
      const x = w / 2 + (d - heading) * pxPerDeg;
      if (x < 0 || x > w) continue;
      const major = norm % 45 === 0;
      const mid = norm % 15 === 0;
      const alpha = 0.2 + 0.7 * (1 - Math.abs(d - heading) / (span / 2));
      ctx.strokeStyle = major ? `rgba(242,193,78,${alpha})` : `rgba(241,234,217,${alpha * 0.55})`;
      ctx.lineWidth = major ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(x, h - (major ? 16 : mid ? 9 : 5));
      ctx.lineTo(x, h - 1);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = `rgba(241,234,217,${alpha})`;
        ctx.font = '500 15px "IBM Plex Mono", monospace';
        ctx.fillText(DIRS[(norm / 45) % 8], x, 12);
        if (norm % 90 === 45) {
          ctx.font = '500 10px "IBM Plex Mono", monospace';
          ctx.fillStyle = `rgba(165,169,157,${alpha})`;
          ctx.fillText(String(norm).padStart(3, '0'), x, 27);
        }
      } else if (mid) {
        ctx.fillStyle = `rgba(165,169,157,${alpha * 0.6})`;
        ctx.font = '400 8px "IBM Plex Mono", monospace';
        ctx.fillText(String(norm), x, 26);
      }
    }
    ctx.fillStyle = 'rgba(242,193,78,0.9)';
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.fillText(String(Math.round(heading)).padStart(3, '0') + '°', w / 2, 39);
  }

  drawZone(ctx, game, size) {
    const zone = game.zone;
    if (!zone || !zone.active) return;
    const scale = size / 560;
    const [cx, cy] = game.world.worldToMap(zone.center.x, zone.center.z, size);
    const r = zone.radius * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    if (r > 0.5) ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(52, 163, 218, 0.26)';
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(96, 188, 232, 0.9)';
    ctx.lineWidth = Math.max(1.5, size / 340);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (zone.state !== 'final' && zone.nextRadius > 0.5) {
      const [nx, ny] = game.world.worldToMap(zone.nextCenter.x, zone.nextCenter.z, size);
      ctx.save();
      ctx.setLineDash([size / 90, size / 90]);
      ctx.strokeStyle = 'rgba(241, 234, 217, 0.8)';
      ctx.lineWidth = Math.max(1, size / 500);
      ctx.beginPath();
      ctx.arc(nx, ny, zone.nextRadius * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayerArrow(ctx, game, size, scale = 1) {
    const player = game.player;
    if (player.dead) return;
    const [px, py] = game.world.worldToMap(player.pos.x, player.pos.z, size);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -10 * scale);
    ctx.lineTo(7 * scale, 8 * scale);
    ctx.lineTo(0, 4 * scale);
    ctx.lineTo(-7 * scale, 8 * scale);
    ctx.closePath();
    ctx.fillStyle = '#f2c14e';
    ctx.shadowColor = 'rgba(242,193,78,.8)';
    ctx.shadowBlur = 7 * scale;
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,17,14,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const size = this.minimap.width;
    const world = game.world;
    ctx.clearRect(0, 0, size, size);
    if (world.mapCanvas) ctx.drawImage(world.mapCanvas, 0, 0, size, size);
    this.drawZone(ctx, game, size);

    const player = game.player;
    const [px, py] = world.worldToMap(player.pos.x, player.pos.z, size);
    const scale = size / 560;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 74 * scale, -Math.PI / 2 - 0.38, -Math.PI / 2 + 0.38);
    ctx.closePath();
    ctx.fillStyle = 'rgba(242,193,78,0.09)';
    ctx.fill();
    ctx.restore();

    for (const bot of game.botManager.bots) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.pos.x - player.pos.x, bot.pos.z - player.pos.z);
      if (d > 72) continue;
      const [bx, by] = world.worldToMap(bot.pos.x, bot.pos.z, size);
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2.2, size / 180), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,79,69,0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,8,6,0.75)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    this.drawPlayerArrow(ctx, game, size, 1.15);
  }

  drawBigMap(game) {
    const ctx = this.bigCtx;
    const size = this.bigMap.width;
    const world = game.world;
    ctx.clearRect(0, 0, size, size);
    if (world.mapCanvas) ctx.drawImage(world.mapCanvas, 0, 0, size, size);
    this.drawZone(ctx, game, size);
    this.drawPlayerArrow(ctx, game, size, 1.6);
    const zone = game.zone;
    this.$('map-zone-label').textContent = zone.state === 'final'
      ? 'FINAL CIRCLE'
      : zone.state === 'shrink'
        ? `ZONE CLOSING · ${Math.ceil(zone.timeLeft())}S`
        : `NEXT SHRINK · ${Math.ceil(zone.timeLeft())}S`;
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  openMap() {
    this.mapOpen = true;
    this.mapScreen.classList.remove('hidden');
    this.drawBigMap(this.game);
    this.game.onMapOpened?.();
  }

  closeMap() {
    const wasOpen = this.mapOpen;
    this.mapOpen = false;
    this.mapScreen.classList.add('hidden');
    if (wasOpen) this.game.onMapClosed?.();
  }

  toggleMap() {
    if (this.mapOpen) this.closeMap();
    else if (this.game.state === 'playing' || this.game.state === 'paused') this.openMap();
  }

  showResult(win, stats) {
    this.result.classList.remove('hidden');
    this.result.classList.toggle('win', win);
    this.$('result-kicker').textContent = win ? 'MATCH VICTORY' : 'MATCH COMPLETE';
    this.$('result-title').textContent = win ? 'WINNER' : 'ELIMINATED';
    this.$('result-subtitle').textContent = win
      ? 'Last operator standing. The island is yours.'
      : stats.killedBy ? `Taken down by ${stats.killedBy}. The circle moves on.` : 'The island claims another operator.';
    this.$('stat-placement').textContent = `#${stats.placement}`;
    this.$('stat-kills').textContent = stats.kills;
    this.$('stat-damage').textContent = stats.damage;
    this.$('stat-time').textContent = this.formatTime(stats.time);
    if (win) this.confetti();
  }

  confetti() {
    const old = this.result.querySelector('.confetti');
    if (old) old.remove();
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const colors = ['#f2c14e', '#e46b42', '#60bce8', '#f1ead9', '#83d783'];
    for (let i = 0; i < 46; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
      piece.style.animationDelay = `${Math.random() * 0.8}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      layer.appendChild(piece);
    }
    this.result.querySelector('.result-inner').appendChild(layer);
  }

  refreshMap() {
    this.lastMapDraw = 0;
    this.lastBigDraw = 0;
  }
}
