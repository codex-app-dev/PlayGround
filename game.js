const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('scoreLabel');
const waveLabel = document.getElementById('waveLabel');
const livesLabel = document.getElementById('livesLabel');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startButton = document.getElementById('startButton');

const keys = new Set();
const touchState = { left: false, right: false, fire: false };

const game = {
  mode: 'menu',
  score: 0,
  wave: 1,
  lives: 3,
  elapsed: 0,
  spawnTimer: 0,
  pickupTimer: 0,
  lastShot: 0,
  flash: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height - 52,
  width: 34,
  height: 26,
  speed: 360,
  fireRate: 0.22,
  radius: 18,
};

const bullets = [];
const enemies = [];
const pickups = [];
const particles = [];
const stars = [];

function initStars() {
  stars.length = 0;
  for (let i = 0; i < 120; i += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.1 + 0.5,
      speed: Math.random() * 30 + 15,
      alpha: Math.random() * 0.8 + 0.2,
    });
  }
}

function updateHud() {
  scoreLabel.textContent = Math.floor(game.score);
  waveLabel.textContent = String(game.wave);
  livesLabel.textContent = String(game.lives);
}

function resetGame() {
  game.mode = 'running';
  game.score = 0;
  game.wave = 1;
  game.lives = 3;
  game.elapsed = 0;
  game.spawnTimer = 0;
  game.pickupTimer = 0;
  game.lastShot = 0;
  game.flash = 0;

  player.x = canvas.width / 2;
  player.y = canvas.height - 52;

  bullets.length = 0;
  enemies.length = 0;
  pickups.length = 0;
  particles.length = 0;

  updateHud();
  overlay.classList.remove('visible');
}

function setOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.add('visible');
}

function spawnEnemy() {
  const size = 16 + Math.random() * 18;
  const type = Math.random() < 0.2 ? 'heavy' : 'drone';
  const speed = type === 'heavy' ? 80 + game.wave * 6 : 110 + game.wave * 9;
  const drift = (Math.random() - 0.5) * 100;

  enemies.push({
    x: Math.random() * (canvas.width - 42) + 21,
    y: -20,
    radius: size,
    speed,
    drift,
    health: type === 'heavy' ? 2 : 1,
    color: type === 'heavy' ? '#ff8d67' : '#ff5fb7',
    value: type === 'heavy' ? 45 : 20,
    spin: Math.random() * Math.PI * 2,
  });
}

function shootBullet() {
  if (game.mode !== 'running') return;

  const now = performance.now();
  if (now - game.lastShot < player.fireRate * 1000) return;

  game.lastShot = now;
  const bulletSpeed = 520;
  bullets.push({
    x: player.x,
    y: player.y - 16,
    radius: 5,
    speed: bulletSpeed,
    color: '#5fe7ff',
  });

  particles.push({
    x: player.x,
    y: player.y - 12,
    vx: (Math.random() - 0.5) * 35,
    vy: -60 - Math.random() * 30,
    life: 0.25,
    color: '#9eeaff',
    size: 3,
  });
}

function createBurst(x, y, color, count, speedBase = 120) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.8;
    const speed = speedBase * (0.5 + Math.random());
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.45,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnPickup(x, y) {
  pickups.push({
    x,
    y,
    radius: 9,
    speed: 90,
    type: Math.random() < 0.6 ? 'shield' : 'score',
  });
}

function hitPlayer() {
  if (game.mode !== 'running') return;
  game.lives -= 1;
  game.flash = 0.8;
  createBurst(player.x, player.y, '#ff7d6b', 22, 160);
  updateHud();

  if (game.lives <= 0) {
    game.mode = 'gameover';
    setOverlay('Mission Failed', `Final score: ${Math.floor(game.score)}. The sky is still full of metal.`, 'Retry Mission');
  }
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const shot = bullets[i];
    shot.y -= shot.speed * dt;

    if (shot.y < -16) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const dist = Math.hypot(shot.x - enemy.x, shot.y - enemy.y);
      if (dist < shot.radius + enemy.radius) {
        enemy.health -= 1;
        bullets.splice(i, 1);

        if (enemy.health <= 0) {
          createBurst(enemy.x, enemy.y, enemy.color, 18, 145);
          game.score += enemy.value;
          if (Math.random() < 0.18) spawnPickup(enemy.x, enemy.y);
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    const pace = Math.max(0.38, 1.2 - game.wave * 0.05);
    game.spawnTimer = pace;
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.x += enemy.drift * dt;
    enemy.y += enemy.speed * dt;
    enemy.spin += dt * 2.6;

    if (enemy.x < enemy.radius || enemy.x > canvas.width - enemy.radius) {
      enemy.drift *= -1;
      enemy.x = Math.max(enemy.radius, Math.min(canvas.width - enemy.radius, enemy.x));
    }

    if (enemy.y > canvas.height + enemy.radius) {
      enemies.splice(i, 1);
      hitPlayer();
      continue;
    }

    const playerDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (playerDist < enemy.radius + player.radius) {
      enemies.splice(i, 1);
      createBurst(enemy.x, enemy.y, '#ffb38a', 20, 180);
      hitPlayer();
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.y += pickup.speed * dt;

    if (pickup.y > canvas.height + pickup.radius) {
      pickups.splice(i, 1);
      continue;
    }

    const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (dist < pickup.radius + player.radius) {
      if (pickup.type === 'shield') {
        game.lives = Math.min(5, game.lives + 1);
        createBurst(pickup.x, pickup.y, '#7ef7a8', 16, 140);
      } else {
        game.score += 140;
        createBurst(pickup.x, pickup.y, '#ffd76a', 16, 140);
      }
      pickups.splice(i, 1);
      updateHud();
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 30 * dt;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateWave() {
  const nextWave = Math.floor(game.score / 600) + 1;
  if (nextWave > game.wave) {
    game.wave = nextWave;
    waveLabel.textContent = String(game.wave);
  }
}

function updatePlayer(dt) {
  const left = keys.has('ArrowLeft') || keys.has('a') || touchState.left;
  const right = keys.has('ArrowRight') || keys.has('d') || touchState.right;
  const fire = keys.has(' ') || keys.has('ArrowUp') || keys.has('w') || touchState.fire;

  if (left && !right) player.x -= player.speed * dt;
  if (right && !left) player.x += player.speed * dt;
  player.x = Math.max(player.width / 2 + 8, Math.min(canvas.width - player.width / 2 - 8, player.x));

  if (fire) {
    shootBullet();
  }
}

function update(dt) {
  if (game.mode !== 'running') return;

  game.elapsed += dt;
  game.flash = Math.max(0, game.flash - dt * 2.4);

  updateStars(dt);
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateWave();
  updateHud();
}

function drawStars() {
  for (const star of stars) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = '#8ed8ff';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(12, 18);
  ctx.lineTo(0, 12);
  ctx.lineTo(-12, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4ca9ff';
  ctx.fillRect(-5, 8, 10, 14);

  ctx.fillStyle = '#ffe780';
  ctx.fillRect(-2, -26, 4, 10);
  ctx.restore();
}

function drawBullets() {
  for (const shot of bullets) {
    ctx.beginPath();
    ctx.fillStyle = shot.color;
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.spin);

    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius * 0.85, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius * 0.85, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 0.6, 0);
    ctx.lineTo(enemy.radius * 0.6, 0);
    ctx.stroke();

    ctx.restore();
  }
}

function drawPickups() {
  for (const pickup of pickups) {
    ctx.save();
    ctx.translate(pickup.x, pickup.y);

    if (pickup.type === 'shield') {
      ctx.fillStyle = '#7ef7a8';
      ctx.beginPath();
      ctx.arc(0, 0, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c1d25';
      ctx.fillRect(-3, -6, 6, 12);
      ctx.fillRect(-6, -3, 12, 6);
    } else {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(0, -pickup.radius);
      ctx.lineTo(pickup.radius * 0.8, 0);
      ctx.lineTo(0, pickup.radius);
      ctx.lineTo(-pickup.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.6);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawVignette() {
  const grd = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    90,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.8
  );
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWarningFlash() {
  if (game.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 125, 107, ${game.flash * 0.45})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#060c1f');
  sky.addColorStop(1, '#0b1530');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();

  ctx.fillStyle = 'rgba(149, 180, 255, 0.12)';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  drawPickups();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawVignette();
  drawWarningFlash();
}

let lastTimestamp = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000 || 0.016, 0.033);
  lastTimestamp = timestamp;

  if (game.mode === 'running') update(dt);
  drawScene();
  requestAnimationFrame(loop);
}

function startGame() {
  resetGame();
}

function onKeyChange(event, isDown) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'].includes(event.key)) {
    event.preventDefault();
  }

  if (isDown) {
    keys.add(event.key);
  } else {
    keys.delete(event.key);
  }
}

document.addEventListener('keydown', (event) => onKeyChange(event, true));
document.addEventListener('keyup', (event) => onKeyChange(event, false));
startButton.addEventListener('click', startGame);

for (const button of document.querySelectorAll('.touch-btn')) {
  const control = button.dataset.control;
  const press = (active) => {
    if (control === 'left' || control === 'right' || control === 'fire') {
      touchState[control] = active;
    }
  };

  button.addEventListener('pointerdown', () => press(true));
  button.addEventListener('pointerup', () => press(false));
  button.addEventListener('pointerleave', () => press(false));
  button.addEventListener('pointercancel', () => press(false));
}

initStars();
setOverlay('Starfall Defense', 'Pilot the cruiser, hold the line, and survive the meteor storm.', 'Start Mission');
updateHud();
requestAnimationFrame(loop);
