import { BLOCK, TAU, clamp } from './config.js';
import { state } from './state.js';
import { drawCity, bindCityContext } from './draw-city.js';
import { drawTrafficCar, drawPoliceCar, drawPlayerCar, drawParticles, bindCarContext } from './draw-cars.js';

let ctx = null;
let W = 1;
let H = 1;
let DPR = 1;

export function initRender(context, width, height, dpr) {
  ctx = context;
  W = width;
  H = height;
  DPR = dpr;
  bindCityContext(ctx);
  bindCarContext(ctx);
}

export function resizeRender(width, height, dpr) {
  W = width;
  H = height;
  DPR = dpr;
}

function worldToScreen(x, y) {
  const cam = state.cam;
  const theta = -cam.angle - Math.PI / 2;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = x - cam.x;
  const dy = y - cam.y;
  return {
    x: W / 2 + (dx * cos - dy * sin) * cam.zoom,
    y: H / 2 + (dx * sin + dy * cos) * cam.zoom
  };
}

export function render(now, dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, W, H);

  const cam = state.cam;
  const shake = cam.shake;
  const shakeX = shake > 0.1 ? (Math.random() * 2 - 1) * shake * 0.55 : 0;
  const shakeY = shake > 0.1 ? (Math.random() * 2 - 1) * shake * 0.55 : 0;

  const radius = Math.hypot(W, H) / 2 / cam.zoom + 320;
  const view = {
    minX: cam.x - radius,
    maxX: cam.x + radius,
    minY: cam.y - radius,
    maxY: cam.y + radius,
    minBX: Math.floor((cam.x - radius) / BLOCK) - 1,
    maxBX: Math.ceil((cam.x + radius) / BLOCK) + 1,
    minBY: Math.floor((cam.y - radius) / BLOCK) - 1,
    maxBY: Math.ceil((cam.y + radius) / BLOCK) + 1
  };

  ctx.save();
  ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.rotate(-cam.angle - Math.PI / 2);
  ctx.translate(-cam.x, -cam.y);

  drawCity(view, now);
  for (const car of state.traffic) drawTrafficCar(car);
  for (const car of state.police) drawPoliceCar(car, now);
  if (!state.over || Math.sin(now * 0.03) > -0.2) drawPlayerCar(now);
  drawParticles();

  ctx.restore();

  drawFloaters();
  drawRain(dt);
  drawSpeedFx(now);
  drawAtmosphere(now);
}

function drawFloaters() {
  if (!state.floaters.length) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const floater of state.floaters) {
    const progress = 1 - floater.life / floater.max;
    const pos = worldToScreen(floater.x, floater.y);
    const alpha = clamp(floater.life * 1.7, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${floater.size}px "SFMono-Regular", "Cascadia Mono", Consolas, monospace`;
    ctx.fillStyle = floater.color;
    ctx.shadowColor = floater.color;
    ctx.shadowBlur = 9;
    ctx.fillText(floater.text, pos.x, pos.y - progress * 34);
  }
  ctx.restore();
}

function drawRain(dt) {
  if (!state.rain.length) return;
  const drops = state.rain;
  for (const drop of drops) {
    if (dt > 0) {
      drop.y += drop.speed * dt;
      drop.x -= drop.speed * 0.12 * dt;
      if (drop.y > H + 24) {
        drop.y = -24 - Math.random() * 90;
        drop.x = Math.random() * (W + 80);
      }
      if (drop.x < -30) drop.x = W + 20;
    }
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(157,207,255,0.13)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (const drop of drops) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + drop.length * 0.12, drop.y + drop.length);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSpeedFx(now) {
  const speed = Math.hypot(state.player.vx, state.player.vy);
  const intensity = clamp((speed - 410) / 300, 0, 1);
  if (intensity <= 0.01) return;
  const cx = W / 2;
  const cy = H / 2;
  const minDim = Math.min(W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * TAU + Math.sin(now * 0.0004 + i * 1.7) * 0.02;
    const start = minDim * (0.34 + ((i * 13) % 11) * 0.018);
    const length = 55 + intensity * 115;
    ctx.strokeStyle = `rgba(86,215,255,${0.018 + intensity * 0.055})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * start, cy + Math.sin(angle) * start);
    ctx.lineTo(cx + Math.cos(angle) * (start + length), cy + Math.sin(angle) * (start + length));
    ctx.stroke();
  }
  ctx.restore();
}

function drawAtmosphere(now) {
  const edge = ctx.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(28,170,255,0.045)');
  edge.addColorStop(0.23, 'rgba(0,0,0,0)');
  edge.addColorStop(0.76, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(255,46,136,0.05)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.24, W / 2, H / 2, Math.max(W, H) * 0.76);
  vignette.addColorStop(0, 'rgba(2,4,12,0)');
  vignette.addColorStop(0.72, 'rgba(2,4,12,0.16)');
  vignette.addColorStop(1, 'rgba(1,3,9,0.78)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  if (state.health <= 34 && !state.over) {
    const pulse = 0.55 + Math.sin(now * 0.006) * 0.25;
    const red = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    red.addColorStop(0, 'rgba(255,30,70,0)');
    red.addColorStop(1, `rgba(255,25,65,${0.16 * pulse})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.flash > 0.01) {
    ctx.fillStyle = `rgba(255,42,84,${state.flash * 0.2})`;
    ctx.fillRect(0, 0, W, H);
  }
}
