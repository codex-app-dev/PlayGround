const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const coinCountEl = document.getElementById('coinCount');
const livesEl = document.getElementById('lives');
const statusEl = document.getElementById('status');

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 720;
const keys = {};
const input = {
  left: false,
  right: false,
  jumpQueued: false,
};

const level = {
  solids: [
    { x: 0, y: 680, w: 470, h: 40 },
    { x: 700, y: 680, w: 420, h: 40 },
    { x: 1250, y: 680, w: 500, h: 40 },
    { x: 1860, y: 680, w: 540, h: 40 },

    { x: 180, y: 570, w: 160, h: 18 },
    { x: 380, y: 500, w: 150, h: 18 },
    { x: 610, y: 440, w: 150, h: 18 },
    { x: 820, y: 360, w: 210, h: 18 },
    { x: 1100, y: 470, w: 170, h: 18 },
    { x: 1360, y: 390, w: 170, h: 18 },
    { x: 1580, y: 540, w: 180, h: 18 },
    { x: 1750, y: 440, w: 190, h: 18 },
    { x: 2010, y: 520, w: 170, h: 18 },

    { x: 560, y: 510, w: 22, h: 170 },
    { x: 1220, y: 510, w: 22, h: 170 },
    { x: 1700, y: 510, w: 22, h: 170 },
    { x: 2140, y: 510, w: 22, h: 170 },
  ],
  coins: [
    { x: 240, y: 520, collected: false },
    { x: 440, y: 455, collected: false },
    { x: 680, y: 395, collected: false },
    { x: 890, y: 315, collected: false },
    { x: 1160, y: 425, collected: false },
    { x: 1440, y: 345, collected: false },
    { x: 2050, y: 470, collected: false },
  ],
  enemies: [
    { x: 258, y: 650, minX: 120, maxX: 420, w: 30, h: 24, vx: 60 },
    { x: 1360, y: 650, minX: 1290, maxX: 1630, w: 30, h: 24, vx: 72 },
    { x: 1905, y: 650, minX: 1880, maxX: 2310, w: 30, h: 24, vx: 86 },
  ],
  goal: { x: 2295, y: 565, w: 40, h: 115 },
};

const player = {
  x: 80,
  y: 600,
  w: 34,
  h: 44,
  vx: 0,
  vy: 0,
  speed: 260,
  accel: 1600,
  friction: 1800,
  airAccel: 1100,
  jumpStrength: 640,
  onGround: false,
  wallSliding: false,
  wallDir: 0,
  coyoteTime: 0,
  jumpBuffer: 0,
  facing: 1,
  lives: 3,
  invulnerable: 0,
  collectedCoins: 0,
  startX: 80,
  startY: 600,
};

let cameraX = 0;
let cameraY = 180;
let gameState = 'playing';
let lastTime = 0;

function resetCoins() {
  level.coins.forEach((coin) => {
    coin.collected = false;
  });
}

function resetEnemies() {
  level.enemies.forEach((enemy) => {
    enemy.x = enemy.minX;
  });
}

function resetLevel() {
  resetCoins();
  resetEnemies();
  player.x = player.startX;
  player.y = player.startY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.wallSliding = false;
  player.wallDir = 0;
  player.coyoteTime = 0;
  player.jumpBuffer = 0;
  player.invulnerable = 0;
  player.collectedCoins = 0;
  player.lives = 3;
  cameraX = 0;
  cameraY = 180;
  gameState = 'playing';
  updateHud();
}

function respawnPlayer() {
  player.x = player.startX;
  player.y = player.startY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.wallSliding = false;
  player.wallDir = 0;
  player.coyoteTime = 0;
  player.jumpBuffer = 0;
  player.invulnerable = 1.2;
  cameraX = 0;
  cameraY = 180;
}

function updateHud() {
  const totalCoins = level.coins.length;
  coinCountEl.textContent = `${player.collectedCoins}/${totalCoins}`;
  livesEl.textContent = String(player.lives);

  if (player.collectedCoins >= totalCoins) {
    statusEl.textContent = 'Portal unlocked!';
  } else {
    statusEl.textContent = 'Collect all coins';
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collidingAt(x, y, w, h) {
  for (const solid of level.solids) {
    if (intersects({ x, y, w, h }, solid)) {
      return true;
    }
  }
  return false;
}

function handleJumpInput() {
  if (input.jumpQueued) {
    input.jumpQueued = false;
    player.jumpBuffer = 0.18;
  }
}

function queueJump() {
  input.jumpQueued = true;
}

function isTouchingWall() {
  const pad = 3;
  const aboveGround = player.y + player.h > 12;
  const leftTouch = collidingAt(player.x - pad, player.y + 8, player.w, player.h - 8);
  const rightTouch = collidingAt(player.x + pad, player.y + 8, player.w, player.h - 8);
  return { leftTouch, rightTouch, aboveGround };
}

function handleInput() {
  const moveLeft = keys.ArrowLeft || keys.a || input.left;
  const moveRight = keys.ArrowRight || keys.d || input.right;

  if (moveLeft && !moveRight) {
    player.facing = -1;
  } else if (moveRight && !moveLeft) {
    player.facing = 1;
  }

  const moveDir = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  const accel = player.onGround ? player.accel : player.airAccel;

  if (moveDir !== 0) {
    player.vx += moveDir * accel * (1 / 60);
  } else {
    const friction = player.onGround ? player.friction : player.friction * 0.45;
    const drag = Math.sign(player.vx) * Math.min(Math.abs(player.vx), friction * (1 / 60));
    player.vx -= drag;
    if (Math.abs(player.vx) < 1) {
      player.vx = 0;
    }
  }

  player.vx = clamp(player.vx, -player.speed, player.speed);

  if (player.jumpBuffer > 0) {
    player.jumpBuffer -= 1 / 60;
  }

  if (player.invulnerable > 0) {
    player.invulnerable -= 1 / 60;
  }
}

function tryJump() {
  const wallState = isTouchingWall();
  const grounded = player.onGround;
  const canWallJump = wallState.leftTouch || wallState.rightTouch;

  if (player.jumpBuffer > 0) {
    if (grounded || player.coyoteTime > 0) {
      player.vy = -player.jumpStrength;
      player.onGround = false;
      player.coyoteTime = 0;
      player.jumpBuffer = 0;
      return;
    }

    if (canWallJump && !grounded) {
      const wallSide = wallState.leftTouch ? -1 : 1;
      player.vx = -wallSide * 420;
      player.vy = -player.jumpStrength * 0.94;
      player.wallSliding = false;
      player.wallDir = 0;
      player.jumpBuffer = 0;
      return;
    }
  }
}

function movePlayer(dt) {
  player.onGround = false;

  const wallState = isTouchingWall();
  player.wallSliding = !player.onGround && (wallState.leftTouch || wallState.rightTouch) && player.vy > 0;

  if (player.wallSliding) {
    player.wallDir = wallState.leftTouch ? -1 : 1;
    player.vy = Math.min(player.vy, 210);
  } else {
    player.wallDir = 0;
  }

  if (!player.onGround) {
    player.vy += 1200 * dt;
  }

  const nextX = player.x + player.vx * dt;
  player.x = nextX;

  for (const solid of level.solids) {
    if (intersects(player, solid)) {
      if (player.vx > 0) {
        player.x = solid.x - player.w;
      } else if (player.vx < 0) {
        player.x = solid.x + solid.w;
      }
      player.vx = 0;
    }
  }

  const nextY = player.y + player.vy * dt;
  player.y = nextY;

  for (const solid of level.solids) {
    if (intersects(player, solid)) {
      if (player.vy > 0) {
        player.y = solid.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) {
        player.y = solid.y + solid.h;
        player.vy = 0;
      }
    }
  }

  if (player.onGround) {
    player.coyoteTime = 0.12;
  } else {
    player.coyoteTime = Math.max(0, player.coyoteTime - dt);
  }

  player.x = clamp(player.x, 0, WORLD_WIDTH - player.w);
  player.y = clamp(player.y, -50, WORLD_HEIGHT + 120);
}

function collectCoins() {
  for (const coin of level.coins) {
    if (coin.collected) {
      continue;
    }

    const coinHitbox = {
      x: coin.x - 12,
      y: coin.y - 12,
      w: 24,
      h: 24,
    };

    if (intersects(player, coinHitbox)) {
      coin.collected = true;
      player.collectedCoins += 1;
      updateHud();
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of level.enemies) {
    enemy.x += enemy.vx * dt;

    if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) {
      enemy.vx *= -1;
      enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX - enemy.w);
    }

    const enemyBox = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    if (intersects(player, enemyBox)) {
      loseLife();
      return;
    }
  }
}

function loseLife() {
  if (player.invulnerable > 0) {
    return;
  }

  player.lives -= 1;
  livesEl.textContent = String(player.lives);

  if (player.lives <= 0) {
    gameState = 'gameover';
    statusEl.textContent = 'Game over — press R';
    return;
  }

  respawnPlayer();
    updateHud();
}

function checkGoal() {
  if (player.collectedCoins < level.coins.length) {
    return;
  }

  const goalBox = { x: level.goal.x, y: level.goal.y, w: level.goal.w, h: level.goal.h };
  if (intersects(player, goalBox)) {
    gameState = 'won';
    statusEl.textContent = 'You win! Press R to replay';
  }
}

function update(dt) {
  if (gameState === 'gameover' || gameState === 'won') {
    return;
  }

  handleInput();
  handleJumpInput();
  tryJump();
  movePlayer(dt);
  collectCoins();
  updateEnemies(dt);
  checkGoal();

  if (player.y > WORLD_HEIGHT + 80) {
    loseLife();
  }

  cameraX = clamp(player.x - canvas.width * 0.5, 0, WORLD_WIDTH - canvas.width);
  cameraY = clamp(player.y - canvas.height * 0.58, 0, WORLD_HEIGHT - canvas.height);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#7fc9ff');
  gradient.addColorStop(0.6, '#bee8ff');
  gradient.addColorStop(1, '#e7f6ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 8; i += 1) {
    const x = (i * 180 - cameraX * 0.18) % (canvas.width + 180) - 60;
    const y = 60 + (i % 3) * 36;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.arc(x + 28, y - 8, 22, 0, Math.PI * 2);
    ctx.arc(x - 28, y - 5, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#a6d7a8';
  for (let i = 0; i < 12; i += 1) {
    const baseX = i * 210 - (cameraX * 0.25) % 210;
    ctx.beginPath();
    ctx.moveTo(baseX, canvas.height - 50);
    ctx.lineTo(baseX + 90, 200 + (i % 3) * 30);
    ctx.lineTo(baseX + 180, canvas.height - 50);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#7bbd82';
  ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
}

function drawSolid(solid) {
  const x = solid.x - cameraX;
  ctx.fillStyle = '#a66d46';
  const y = solid.y - cameraY;
  ctx.fillRect(x, y, solid.w, solid.h);
  ctx.fillStyle = '#c5895f';
  ctx.fillRect(x, y, solid.w, 6);
}

function drawCoin(coin) {
  if (coin.collected) {
    return;
  }

  const x = coin.x - cameraX;
  const y = coin.y - cameraY;
  ctx.fillStyle = '#f7da5b';
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d1a942';
  ctx.fillRect(x - 3, y - 10, 6, 20);
}

function drawEnemy(enemy) {
  const x = enemy.x - cameraX;
  const y = enemy.y - cameraY;
  ctx.fillStyle = '#7f2c2c';
  ctx.fillRect(x, y, enemy.w, enemy.h);
  ctx.fillStyle = '#d46d6d';
  ctx.fillRect(x + 4, y + 6, 8, 8);
  ctx.fillRect(x + enemy.w - 12, y + 6, 8, 8);
}

function drawGoal() {
  const x = level.goal.x - cameraX;
  const y = level.goal.y - cameraY;
  const unlocked = player.collectedCoins >= level.coins.length;
  ctx.fillStyle = unlocked ? '#dfffd3' : '#a2b4c7';
  ctx.fillRect(x, y, level.goal.w, level.goal.h);
  ctx.fillStyle = unlocked ? '#66d17d' : '#7d8ba7';
  ctx.fillRect(x + 8, y + 10, level.goal.w - 16, level.goal.h - 20);
  ctx.fillStyle = unlocked ? '#ffeb93' : '#bdc9d9';
  ctx.fillRect(x + 12, y + 20, level.goal.w - 24, 24);
}

function drawPlayer() {
  const x = player.x - cameraX;
  const y = player.y - cameraY;

  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) {
    return;
  }

  ctx.fillStyle = '#f05d5d';
  ctx.fillRect(x + 8, y + 8, player.w - 16, player.h - 8);
  ctx.fillStyle = '#ffd2d2';
  ctx.beginPath();
  ctx.arc(x + player.w / 2, y + 12, 12, 0, Math.PI * 2);
  ctx.fill();

  const eyeX = player.facing === 1 ? x + player.w - 12 : x + 12;
  ctx.fillStyle = '#1b233d';
  ctx.fillRect(eyeX - 2, y + 9, 4, 4);

  ctx.strokeStyle = '#3a1e1e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + player.h - 2);
  ctx.lineTo(x + 7, y + player.h + 10);
  ctx.moveTo(x + player.w - 12, y + player.h - 2);
  ctx.lineTo(x + player.w - 7, y + player.h + 10);
  ctx.stroke();
}

function draw() {
  drawBackground();

  for (const solid of level.solids) {
    drawSolid(solid);
  }

  for (const coin of level.coins) {
    drawCoin(coin);
  }

  for (const enemy of level.enemies) {
    drawEnemy(enemy);
  }

  drawGoal();
  drawPlayer();

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, canvas.width, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Segoe UI';
  ctx.fillText('Wall Jump Platformer', 18, 18);
}

function step(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 1 / 60, 0.025);
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(step);
}

function keyDownHandler(event) {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'a', 'd', 'w', ' '].includes(key) || ['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === 'ArrowLeft' || key === 'a') {
    keys.ArrowLeft = true;
    keys.a = true;
  }
  if (event.key === 'ArrowRight' || key === 'd') {
    keys.ArrowRight = true;
    keys.d = true;
  }
  if (event.key === 'ArrowUp' || key === 'w' || event.key === ' ') {
    keys.ArrowUp = true;
    keys.w = true;
    queueJump();
  }
  if (event.key.toLowerCase() === 'r' && (gameState === 'gameover' || gameState === 'won')) {
    resetLevel();
  }
}

function keyUpHandler(event) {
  const key = event.key.toLowerCase();
  if (event.key === 'ArrowLeft' || key === 'a') {
    keys.ArrowLeft = false;
    keys.a = false;
  }
  if (event.key === 'ArrowRight' || key === 'd') {
    keys.ArrowRight = false;
    keys.d = false;
  }
  if (event.key === 'ArrowUp' || key === 'w' || event.key === ' ') {
    keys.ArrowUp = false;
    keys.w = false;
  }
}

function bindTouchControls() {
  document.querySelectorAll('[data-key]').forEach((button) => {
    const key = button.dataset.key;
    const press = (e) => {
      e.preventDefault();
      if (key === 'ArrowLeft') input.left = true;
      if (key === 'ArrowRight') input.right = true;
      if (key === 'ArrowUp') queueJump();
      button.style.transform = 'scale(0.96)';
      button.style.opacity = '0.9';
    };
    const release = (e) => {
      e.preventDefault();
      if (key === 'ArrowLeft') input.left = false;
      if (key === 'ArrowRight') input.right = false;
      button.style.transform = '';
      button.style.opacity = '';
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  });
}

window.addEventListener('keydown', keyDownHandler);
window.addEventListener('keyup', keyUpHandler);
window.addEventListener('blur', () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  input.left = false;
  input.right = false;
  input.jumpQueued = false;
});

bindTouchControls();
updateHud();
resetLevel();
requestAnimationFrame(step);
