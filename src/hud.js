export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.healthValue = document.getElementById('health-value');
    this.energyFill = document.getElementById('energy-fill');
    this.energyValue = document.getElementById('energy-value');
    this.ammoValue = document.getElementById('ammo-value');
    this.reloadFill = document.getElementById('reload-fill');
    this.weaponState = document.getElementById('weapon-state');
    this.speedValue = document.getElementById('speed-value');
    this.skiReadout = document.getElementById('ski-readout');
    this.blueScore = document.getElementById('blue-score');
    this.redScore = document.getElementById('red-score');
    this.blueFlagStatus = document.getElementById('blue-flag-status');
    this.redFlagStatus = document.getElementById('red-flag-status');
    this.matchTimer = document.getElementById('match-timer');
    this.matchBarFill = document.getElementById('match-bar-fill');
    this.killfeed = document.getElementById('killfeed');
    this.banner = document.getElementById('objective-banner');
    this.crosshair = document.getElementById('crosshair');
    this.hitmarkerEl = document.getElementById('hitmarker');
    this.damageFlash = document.getElementById('damage-flash');
    this.carriedFlag = document.getElementById('carried-flag');
    this.radar = document.getElementById('radar');
    this.ctx = this.radar.getContext('2d');
    this.lockHint = document.getElementById('lock-hint');
    this.deathScreen = document.getElementById('death-screen');
    this.deathBy = document.getElementById('death-by');
    this.respawnTimer = document.getElementById('respawn-timer');
    this.matchScreen = document.getElementById('match-screen');
    this.matchResultKicker = document.getElementById('match-result-kicker');
    this.matchResultTitle = document.getElementById('match-result-title');
    this.matchFinal = document.getElementById('match-final');
    this.killTimer = new Map();
    this.bannerTimeout = null;
    this.damageTimeout = null;
    this.hitTimeout = null;
    this.radarSweep = 0;
    this.vitals = document.querySelector('.vitals');
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  setPointerLocked(locked, playing) {
    this.lockHint.classList.toggle('show', playing && !locked);
  }

  update(dt, state) {
    const { player, scores, timeLeft, flags } = state;
    const health = Math.max(0, Math.round(player.health));
    this.healthFill.style.width = `${(health / player.maxHealth) * 100}%`;
    this.healthValue.textContent = String(health);
    this.energyFill.style.width = `${(player.energy / player.maxEnergy) * 100}%`;
    this.energyValue.textContent = String(Math.round(player.energy));
    this.vitals.classList.toggle('health-low', health <= 34);

    this.ammoValue.textContent = String(player.ammo);
    if (player.reloading) {
      const progress = 1 - player.reloadTimer / player.reloadDuration;
      this.reloadFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
      this.weaponState.textContent = 'RELOADING';
      this.weaponState.classList.remove('ready');
    } else {
      this.reloadFill.style.width = player.ammo === 0 ? '0%' : `${(player.ammo / player.maxAmmo) * 100}%`;
      this.weaponState.textContent = player.ammo === 0 ? 'EMPTY' : 'READY';
      this.weaponState.classList.toggle('ready', player.ammo > 0);
    }

    this.speedValue.textContent = String(Math.round(player.speed * 3.6));
    this.skiReadout.classList.toggle('active', player.skiing);
    this.skiReadout.textContent = player.jetting ? 'JET' : player.skiing ? 'SKI' : 'SKI';

    this.blueScore.textContent = String(scores.blue);
    this.redScore.textContent = String(scores.red);
    const limit = state.scoreLimit || 5;
    this.matchBarFill.style.width = `${Math.max(0, timeLeft / state.matchDuration) * 100}%`;
    const mins = Math.floor(Math.max(0, timeLeft) / 60);
    const secs = Math.floor(Math.max(0, timeLeft) % 60);
    this.matchTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.matchTimer.style.color = timeLeft < 60 ? '#ff9b88' : '';

    this.updateFlagStatus(this.blueFlagStatus, flags.blue, 'blue');
    this.updateFlagStatus(this.redFlagStatus, flags.red, 'red');
    this.carriedFlag.textContent = player.carriedFlag ? 'YOU ARE CARRYING THE ENEMY FLAG' : '';

    const moving = player.speed > 7 && player.onGround;
    this.crosshair.classList.toggle('spread', moving || player.jetting || player.reloading);
    this.radarSweep += dt * 1.2;
    this.drawRadar(player, state.bots, flags, state.cameraYaw);
    this.blueScore.parentElement.classList.toggle('blue', true);
    this.redScore.parentElement.classList.toggle('red', true);
  }

  updateFlagStatus(el, flag, team) {
    let text = 'FLAG SECURE';
    let cls = 'home';
    if (flag.carrier) {
      text = flag.carrier === 'player' ? 'FLAG TAKEN' : 'FLAG TAKEN';
      cls = 'taken';
    } else if (flag.dropped) {
      text = 'FLAG DROPPED';
      cls = 'taken';
    }
    el.textContent = text;
    el.classList.toggle('taken', cls === 'taken');
    el.classList.toggle('home', cls === 'home');
  }

  drawRadar(player, bots, flags, cameraYaw) {
    const ctx = this.ctx;
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 98;
    const range = 155;
    const scale = radius / range;
    const yaw = cameraYaw ?? player.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);

    ctx.clearRect(0, 0, size, size);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(8, 28, 42, 0.82)');
    gradient.addColorStop(0.72, 'rgba(5, 19, 30, 0.78)');
    gradient.addColorStop(1, 'rgba(3, 12, 20, 0.9)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(80, 218, 245, 0.1)';
    ctx.lineWidth = 1;
    for (let r = 26; r <= radius; r += 26) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8);
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }

    const sweep = this.radarSweep % (Math.PI * 2);
    const sweepGradient = ctx.createConicGradient(sweep - 0.6, cx, cy);
    sweepGradient.addColorStop(0, 'rgba(80, 232, 255, 0.2)');
    sweepGradient.addColorStop(0.12, 'rgba(80, 232, 255, 0.03)');
    sweepGradient.addColorStop(0.14, 'rgba(80, 232, 255, 0)');
    sweepGradient.addColorStop(1, 'rgba(80, 232, 255, 0)');
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const toScreen = (worldPos) => {
      const dx = worldPos.x - player.position.x;
      const dz = worldPos.z - player.position.z;
      const forward = dx * fx + dz * fz;
      const right = dx * rx + dz * rz;
      return { x: cx + right * scale, y: cy - forward * scale, dist: Math.hypot(dx, dz) };
    };

    for (const team of ['blue', 'red']) {
      const flag = flags[team];
      if (flag.carrier === 'player') continue;
      if (flag.carrier && flag.carrier.team) {
        const pos = toScreen(flag.group.position);
        this.drawDiamond(ctx, pos.x, pos.y, team === 'blue' ? '#47e5ff' : '#ff644a', 5, flag.team === 'blue');
      } else {
        const pos = toScreen(flag.group.position);
        if (pos.dist < range) this.drawDiamond(ctx, pos.x, pos.y, team === 'blue' ? '#47e5ff' : '#ff644a', 5, true);
      }
    }

    for (const bot of bots) {
      if (!bot.alive) continue;
      const pos = toScreen(bot.position);
      if (pos.dist > range || pos.x < 0 || pos.x > size || pos.y < 0 || pos.y > size) continue;
      ctx.beginPath();
      ctx.fillStyle = bot.team === 'red' ? 'rgba(255, 96, 68, 0.95)' : 'rgba(86, 230, 255, 0.9)';
      ctx.arc(pos.x, pos.y, bot.team === 'red' ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (bot.team === 'red') {
        ctx.strokeStyle = 'rgba(255, 120, 90, 0.35)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ddfbff';
    ctx.shadowColor = '#45e6ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(80, 232, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawDiamond(ctx, x, y, color, size, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.globalAlpha = filled ? 0.9 : 0.4;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  hitmarker() {
    clearTimeout(this.hitTimeout);
    this.hitmarkerEl.classList.remove('show');
    void this.hitmarkerEl.offsetWidth;
    this.hitmarkerEl.classList.add('show');
    this.hitTimeout = setTimeout(() => this.hitmarkerEl.classList.remove('show'), 240);
  }

  damage() {
    clearTimeout(this.damageTimeout);
    this.damageFlash.classList.add('on');
    this.damageTimeout = setTimeout(() => this.damageFlash.classList.remove('on'), 130);
  }

  killfeedMessage(killer, victim) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    const killerSpan = document.createElement('span');
    killerSpan.className = killer.team === 'blue' ? 'k-blue' : 'k-red';
    killerSpan.textContent = killer.name;
    const weapon = document.createElement('span');
    weapon.className = 'k-weapon';
    weapon.textContent = 'SPINFUSOR';
    const victimSpan = document.createElement('span');
    victimSpan.className = victim.team === 'blue' ? 'k-blue' : 'k-red';
    victimSpan.textContent = victim.name;
    item.append(killerSpan, weapon, victimSpan);
    this.killfeed.appendChild(item);
    while (this.killfeed.children.length > 5) this.killfeed.removeChild(this.killfeed.firstChild);
    setTimeout(() => {
      item.classList.add('out');
      setTimeout(() => item.remove(), 420);
    }, 4200);
  }

  showBanner(text, sub = '', duration = 2200) {
    clearTimeout(this.bannerTimeout);
    this.banner.innerHTML = '';
    const main = document.createElement('span');
    main.textContent = text;
    this.banner.appendChild(main);
    if (sub) {
      const small = document.createElement('span');
      small.className = 'sub';
      small.textContent = sub;
      this.banner.appendChild(small);
    }
    this.banner.classList.add('show');
    this.bannerTimeout = setTimeout(() => this.banner.classList.remove('show'), duration);
  }

  showDeath(source, respawnIn) {
    this.deathBy.textContent = source?.name ? `BY ${String(source.name).toUpperCase()}` : 'BY HOSTILE FORCES';
    this.respawnTimer.textContent = String(Math.max(1, Math.ceil(respawnIn)));
    this.deathScreen.classList.remove('hidden');
  }

  updateDeath(respawnIn) {
    this.respawnTimer.textContent = String(Math.max(1, Math.ceil(respawnIn)));
  }

  hideDeath() {
    this.deathScreen.classList.add('hidden');
  }

  showMatch(blueWon, blueScore, redScore) {
    this.matchResultKicker.textContent = blueWon ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
    this.matchResultKicker.style.color = blueWon ? 'var(--cyan)' : 'var(--red)';
    this.matchResultTitle.textContent = blueWon ? 'BLUE TEAM WINS' : 'RED TEAM WINS';
    this.matchFinal.textContent = `${blueScore} — ${redScore}`;
    this.matchScreen.classList.remove('hidden');
  }

  hideMatch() {
    this.matchScreen.classList.add('hidden');
  }
}
