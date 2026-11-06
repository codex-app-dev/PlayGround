import { BLOCK, ROAD, rgba } from './config.js';
import { state } from './state.js';
import { getBlock } from './city.js';

const coolWindow = 'rgba(134,208,255,';
const warmWindow = 'rgba(255,196,110,';

function drawGround(view) {
  for (let bx = view.minBX; bx <= view.maxBX; bx++) {
    for (let by = view.minBY; by <= view.maxBY; by++) {
      const x = bx * BLOCK + ROAD / 2;
      const y = by * BLOCK + ROAD / 2;
      const size = BLOCK - ROAD;
      ctxFillRect(x, y, size, size, '#070b14');
      ctxStrokeRect(x + 0.75, y + 0.75, size - 1.5, size - 1.5, 'rgba(72,105,145,0.16)', 1.5);
      ctxStrokeRect(x + 8.5, y + 8.5, size - 17, size - 17, 'rgba(56,242,255,0.035)', 1);
    }
  }
}

function ctxFillRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function ctxStrokeRect(x, y, w, h, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x, y, w, h);
}

let ctx = null;
export function bindCityContext(context) {
  ctx = context;
}

function drawRoads(view) {
  const i0 = Math.ceil(view.minX / BLOCK) - 1;
  const i1 = Math.floor(view.maxX / BLOCK) + 1;
  const j0 = Math.ceil(view.minY / BLOCK) - 1;
  const j1 = Math.floor(view.maxY / BLOCK) + 1;
  const minY = view.minY;
  const height = view.maxY - view.minY;
  const minX = view.minX;
  const width = view.maxX - view.minX;

  for (let i = i0; i <= i1; i++) {
    const cx = i * BLOCK;
    const gradient = ctx.createLinearGradient(cx - ROAD / 2, 0, cx + ROAD / 2, 0);
    gradient.addColorStop(0, '#060a13');
    gradient.addColorStop(0.5, '#0a1120');
    gradient.addColorStop(1, '#060a13');
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - ROAD / 2, minY, ROAD, height);
  }

  for (let j = j0; j <= j1; j++) {
    const cy = j * BLOCK;
    const gradient = ctx.createLinearGradient(0, cy - ROAD / 2, 0, cy + ROAD / 2);
    gradient.addColorStop(0, '#060a13');
    gradient.addColorStop(0.5, '#0a1120');
    gradient.addColorStop(1, '#060a13');
    ctx.fillStyle = gradient;
    ctx.fillRect(minX, cy - ROAD / 2, width, ROAD);
  }

  ctx.save();
  ctx.lineCap = 'butt';

  for (let i = i0; i <= i1; i++) {
    const cx = i * BLOCK;
    ctx.strokeStyle = 'rgba(86,150,210,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - ROAD / 2 + 1, minY);
    ctx.lineTo(cx - ROAD / 2 + 1, view.maxY);
    ctx.moveTo(cx + ROAD / 2 - 1, minY);
    ctx.lineTo(cx + ROAD / 2 - 1, view.maxY);
    ctx.stroke();

    ctx.setLineDash([17, 28]);
    ctx.strokeStyle = 'rgba(88,178,224,0.15)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, minY);
    ctx.lineTo(cx, view.maxY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(156,224,255,0.24)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, minY);
    ctx.lineTo(cx, view.maxY);
    ctx.stroke();
  }

  for (let j = j0; j <= j1; j++) {
    const cy = j * BLOCK;
    ctx.strokeStyle = 'rgba(86,150,210,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(minX, cy - ROAD / 2 + 1);
    ctx.lineTo(view.maxX, cy - ROAD / 2 + 1);
    ctx.moveTo(minX, cy + ROAD / 2 - 1);
    ctx.lineTo(view.maxX, cy + ROAD / 2 - 1);
    ctx.stroke();

    ctx.setLineDash([17, 28]);
    ctx.strokeStyle = 'rgba(88,178,224,0.15)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(minX, cy);
    ctx.lineTo(view.maxX, cy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(156,224,255,0.24)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(minX, cy);
    ctx.lineTo(view.maxX, cy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();

  drawCrosswalks(i0, i1, j0, j1);
  drawLightPools(i0, i1, j0, j1);
}

function drawCrosswalks(i0, i1, j0, j1) {
  ctx.fillStyle = 'rgba(184,216,244,0.075)';
  const stripe = 5;
  const step = (ROAD - 24) / 7;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const cx = i * BLOCK;
      const cy = j * BLOCK;
      for (let k = 0; k < 7; k++) {
        const offset = -ROAD / 2 + 12 + k * step;
        ctx.fillRect(cx + offset, cy - ROAD / 2 + 7, stripe, 9);
        ctx.fillRect(cx + offset, cy + ROAD / 2 - 16, stripe, 9);
        ctx.fillRect(cx - ROAD / 2 + 7, cy + offset, 9, stripe);
        ctx.fillRect(cx + ROAD / 2 - 16, cy + offset, 9, stripe);
      }
    }
  }
}

function drawLightPools(i0, i1, j0, j1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (((i * 31 + j * 17) & 3) !== 0) continue;
      const cx = i * BLOCK;
      const cy = j * BLOCK;
      const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, 150);
      gradient.addColorStop(0, 'rgba(255,193,112,0.035)');
      gradient.addColorStop(1, 'rgba(255,193,112,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 150, cy - 150, 300, 300);
    }
  }
  ctx.restore();
}

function roundedRect(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawBuilding(b, now) {
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(b.x + 13, b.y + 17, b.w, b.h);

  const gradient = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  gradient.addColorStop(0, b.base);
  gradient.addColorStop(0.55, b.base);
  gradient.addColorStop(1, '#04070f');
  ctx.fillStyle = gradient;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  ctx.fillStyle = 'rgba(170,218,255,0.055)';
  ctx.fillRect(b.x, b.y, b.w, 1.5);
  ctx.fillRect(b.x, b.y, 1.5, b.h);

  const padX = Math.max(7, b.w * 0.1);
  const padY = Math.max(7, b.h * 0.08);
  const stepX = (b.w - padX * 2) / b.cols;
  const stepY = (b.h - padY * 2) / b.rows;
  const winW = Math.max(2, Math.min(7, stepX * 0.44));
  const winH = Math.max(2, Math.min(9, stepY * 0.4));

  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      const type = b.windows[row * b.cols + col];
      const x = b.x + padX + col * stepX + (stepX - winW) / 2;
      const y = b.y + padY + row * stepY + (stepY - winH) / 2;
      if (type === 0) {
        ctx.fillStyle = 'rgba(110,155,200,0.045)';
      } else if (type === 1) {
        ctx.fillStyle = `${coolWindow}0.62)`;
      } else if (type === 2) {
        ctx.fillStyle = `${warmWindow}0.68)`;
      } else {
        ctx.fillStyle = rgba(b.accent, 0.58);
      }
      ctx.fillRect(x, y, winW, winH);
    }
  }

  if (b.cols > 1 || b.rows > 1) {
    const left = b.x + padX;
    const right = b.x + b.w - padX;
    const top = b.y + padY;
    const bottom = b.y + b.h - padY;
    ctx.strokeStyle = 'rgba(118,164,214,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 1; col < b.cols; col++) {
      const x = left + col * stepX;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let row = 1; row < b.rows; row++) {
      const y = top + row * stepY;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  if (b.billboard) {
    const bb = b.billboard;
    ctx.fillStyle = rgba(bb.color, 0.1);
    ctx.fillRect(bb.x - 5, bb.y - 5, bb.w + 10, bb.h + 10);
    ctx.fillStyle = rgba(bb.color, 0.58);
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
    ctx.fillStyle = 'rgba(4,7,15,0.62)';
    for (let y = bb.y + 3; y < bb.y + bb.h; y += 4) ctx.fillRect(bb.x, y, bb.w, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bb.x + 4, bb.y + bb.h * 0.3, bb.w * 0.18, 2);
    ctx.fillRect(bb.x + bb.w * 0.25, bb.y + bb.h * 0.3, bb.w * 0.1, 2);
    ctx.fillStyle = rgba(bb.color, 0.92);
    ctx.fillRect(bb.x + bb.w * 0.46, bb.y + bb.h * 0.5, bb.w * 0.4, 2);
    ctx.fillRect(bb.x + bb.w * 0.55, bb.y + bb.h * 0.66, bb.w * 0.24, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bb.x, bb.y, bb.w, 1);
  }

  if (b.neon) {
    ctx.strokeStyle = rgba(b.accent, 0.12);
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    ctx.strokeStyle = rgba(b.accent, 0.48);
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1);
  }

  if (b.sign) {
    const sx = b.sign.side < 0 ? b.x + 5 : b.x + b.w - 9;
    const sy = b.y + b.h * b.sign.offset;
    const length = b.h * b.sign.length;
    ctx.fillStyle = rgba(b.sign.color, 0.12);
    ctx.fillRect(sx - 6, sy - 6, 16, length + 12);
    ctx.fillStyle = rgba(b.sign.color, 0.82);
    ctx.fillRect(sx, sy, 4, length);
    ctx.fillStyle = 'rgba(4,8,16,0.82)';
    for (let y = sy + 9; y < sy + length; y += 13) ctx.fillRect(sx, y, 4, 2.5);
  }

  for (const roof of b.roofs) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(roof.x + 3, roof.y + 4, roof.w, roof.h);
    ctx.fillStyle = '#0d1626';
    ctx.fillRect(roof.x, roof.y, roof.w, roof.h);
    ctx.strokeStyle = rgba(b.accent, 0.14);
    ctx.lineWidth = 1;
    ctx.strokeRect(roof.x + 0.5, roof.y + 0.5, roof.w - 1, roof.h - 1);
  }

  if (b.antenna) {
    const ax = b.x + b.w * 0.5;
    const ay = b.y + b.h * 0.24;
    ctx.strokeStyle = 'rgba(150,180,210,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay - 22);
    ctx.stroke();
    const blink = Math.sin(now * 0.006 + b.seed) > 0.25;
    if (blink) {
      ctx.fillStyle = 'rgba(255,73,104,0.24)';
      ctx.beginPath();
      ctx.arc(ax, ay - 23, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff607e';
      ctx.beginPath();
      ctx.arc(ax, ay - 23, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(view, now) {
  for (let bx = view.minBX; bx <= view.maxBX; bx++) {
    for (let by = view.minBY; by <= view.maxBY; by++) {
      const block = getBlock(bx, by);
      for (const building of block.rects) drawBuilding(building, now);
    }
  }
}

export function drawCity(view, now) {
  drawGround(view);
  drawRoads(view);
  drawSkids();
  drawBuildings(view, now);
  drawPickups(now);
}

function drawSkids() {
  if (!state.skids.length) return;
  ctx.strokeStyle = 'rgba(2,4,10,0.48)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const mark of state.skids) {
    ctx.globalAlpha = Math.min(1, mark.life * 1.8);
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
  }
  ctx.globalAlpha = 1;
  ctx.stroke();
}

function drawPickups(now) {
  for (const pickup of state.pickups) {
    const bob = Math.sin(now * 0.003 + pickup.phase) * 3;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);

    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 42);
    glow.addColorStop(0, 'rgba(255,214,112,0.3)');
    glow.addColorStop(0.45, 'rgba(255,179,66,0.1)');
    glow.addColorStop(1, 'rgba(255,179,66,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-42, -42, 84, 84);
    ctx.globalCompositeOperation = 'source-over';

    ctx.rotate(now * 0.0017 + pickup.phase);
    ctx.strokeStyle = 'rgba(255,220,135,0.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,135,0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffcf63';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.2, 0);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-3.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export { roundedRect };
