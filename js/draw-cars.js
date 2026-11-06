import { state } from './state.js';
import { rgba } from './config.js';

let ctx = null;
export function bindCarContext(context) {
  ctx = context;
}

function rr(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawGlow(x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function drawTrafficCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  rr(-17, -6, 44, 23, 5);
  ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(17, 0, 138, 0);
  beam.addColorStop(0, 'rgba(255,238,196,0.14)');
  beam.addColorStop(0.5, 'rgba(255,238,196,0.04)');
  beam.addColorStop(1, 'rgba(255,238,196,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(17, -7);
  ctx.lineTo(142, -44);
  ctx.lineTo(142, 44);
  ctx.lineTo(17, 7);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const body = ctx.createLinearGradient(0, -11, 0, 11);
  body.addColorStop(0, car.color);
  body.addColorStop(0.52, car.color);
  body.addColorStop(1, car.dark);
  ctx.fillStyle = body;
  rr(-22, -11, 44, 22, 5);
  ctx.fill();
  ctx.strokeStyle = rgba(car.color, 0.38);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(-16, -10.5, 26, 1.2);

  ctx.fillStyle = '#09121e';
  rr(-6, -8, 15, 16, 3.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(126,206,255,0.32)';
  rr(-4, -7, 5, 14, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(126,206,255,0.14)';
  rr(2, -7, 4, 14, 2);
  ctx.fill();

  ctx.fillStyle = '#fff4cc';
  ctx.fillRect(19.5, -7, 2.4, 4);
  ctx.fillRect(19.5, 3, 2.4, 4);
  ctx.fillStyle = 'rgba(255,74,74,0.9)';
  ctx.fillRect(-22.5, -7.5, 2, 4);
  ctx.fillRect(-22.5, 3.5, 2, 4);

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(22, 0, 10, '#ffe7b0', 0.16);
  drawGlow(-23, 0, 8, '#ff3b52', 0.12);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

export function drawPoliceCar(car, now) {
  const flash = Math.sin(now * 0.017 + car.seed) > 0;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(9, 17, 29, 15, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(0, 0, 58, flash ? '#ff2e55' : '#2e7bff', 0.18);
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(0, 14);
  ctx.strokeStyle = flash ? 'rgba(255,74,99,0.38)' : 'rgba(82,146,255,0.38)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(18, 0, 150, 0);
  beam.addColorStop(0, 'rgba(140,210,255,0.14)');
  beam.addColorStop(1, 'rgba(140,210,255,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(18, -8);
  ctx.lineTo(155, -48);
  ctx.lineTo(155, 48);
  ctx.lineTo(18, 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const body = ctx.createLinearGradient(0, -12, 0, 12);
  body.addColorStop(0, '#eef5ff');
  body.addColorStop(0.48, '#c6d5e8');
  body.addColorStop(1, '#4c5b6f');
  ctx.fillStyle = body;
  rr(-25, -12, 50, 24, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(184,218,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#0b1424';
  ctx.fillRect(-23, -11, 44, 3);
  ctx.fillRect(-23, 8, 44, 3);

  ctx.fillStyle = '#0a1524';
  rr(-8, -8.5, 18, 17, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(122,205,255,0.34)';
  rr(-5, -7, 6, 14, 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(13, -10.5, 10, 1.3);

  ctx.fillStyle = '#fff6d0';
  ctx.fillRect(21.5, -7.5, 2.4, 4.5);
  ctx.fillRect(21.5, 3, 2.4, 4.5);
  ctx.fillStyle = 'rgba(255,58,74,0.9)';
  ctx.fillRect(-25.5, -8, 2, 4);
  ctx.fillRect(-25.5, 4, 2, 4);

  ctx.fillStyle = flash ? '#ff3858' : '#4c1020';
  ctx.fillRect(-5, -10.5, 4, 7);
  ctx.fillStyle = !flash ? '#3f8dff' : '#101b3c';
  ctx.fillRect(-5, 3.5, 4, 7);

  ctx.globalCompositeOperation = 'lighter';
  if (flash) {
    drawGlow(-3, -6, 22, '#ff2e55', 0.45);
  } else {
    drawGlow(-3, 6, 22, '#2e7bff', 0.45);
  }
  drawGlow(23, 0, 9, '#e8f7ff', 0.14);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

export function drawPlayerCar(now) {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  if (state.damageCooldown > 0 && Math.floor(now / 70) % 2 === 0) {
    ctx.globalAlpha = 0.42;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  rr(-19, -6, 54, 27, 7);
  ctx.fill();

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(0, 0, 50, '#25e4ff', 0.18);
  const beam = ctx.createLinearGradient(19, 0, 210, 0);
  beam.addColorStop(0, 'rgba(181,248,255,0.2)');
  beam.addColorStop(0.36, 'rgba(129,235,255,0.07)');
  beam.addColorStop(1, 'rgba(129,235,255,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(19, -8);
  ctx.lineTo(214, -58);
  ctx.lineTo(214, 58);
  ctx.lineTo(19, 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const body = ctx.createLinearGradient(0, -13, 0, 13);
  body.addColorStop(0, '#62f8ff');
  body.addColorStop(0.34, '#19cfee');
  body.addColorStop(0.72, '#0878a6');
  body.addColorStop(1, '#06354e');
  ctx.fillStyle = body;
  rr(-27, -13, 54, 26, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,252,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(9, -1.1, 17, 2.2);

  ctx.fillStyle = '#071522';
  rr(-7, -9, 14, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(121,230,255,0.34)';
  rr(-4.5, -7.5, 5, 15, 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  rr(8, -9, 12, 18, 4);
  ctx.fill();

  ctx.fillStyle = '#e8ffff';
  ctx.fillRect(24, -8, 2.6, 4.5);
  ctx.fillRect(24, 3.5, 2.6, 4.5);
  ctx.fillStyle = '#ff4d8f';
  ctx.fillRect(-27, -8, 2.4, 4.2);
  ctx.fillRect(-27, 3.8, 2.4, 4.2);

  ctx.fillStyle = '#34f4ff';
  ctx.fillRect(-23, -13.2, 37, 1.2);
  ctx.fillRect(-23, 12, 37, 1.2);

  ctx.fillStyle = '#ff3d93';
  ctx.fillRect(-28.5, -9.5, 2.2, 19);

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(25, 0, 15, '#d9ffff', 0.28);
  drawGlow(-26, 0, 12, '#ff3d93', 0.22);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

export function drawParticles() {
  if (!state.particles.length) return;
  ctx.save();
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.max) * particle.alpha;
    if (alpha <= 0) continue;
    if (particle.type === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha * 0.36;
      ctx.fillStyle = '#56657f';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + (1 - particle.life / particle.max) * 2.2), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.type === 'trail') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(0.5, particle.size * alpha), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.type === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = Math.max(0.6, particle.size * alpha);
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.024, particle.y - particle.vy * 0.024);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
