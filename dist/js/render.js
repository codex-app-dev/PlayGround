import { SYMBOLS } from './data/story.js';

const TAU = Math.PI * 2;
const hash = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function diamond(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawSymbol(ctx, cx, cy, r, symbol, color = '#f0d79b', lw = 2) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (symbol === 'sun') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    }
  } else if (symbol === 'wave') {
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = -r + (i / 16) * r * 2;
      const y = Math.sin(i / 16 * TAU) * r * 0.3;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.45); ctx.lineTo(r * 0.4, -r * 0.45); ctx.stroke();
  } else if (symbol === 'eye') {
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.75, r, 0);
    ctx.quadraticCurveTo(0, r * 0.75, -r, 0); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, TAU); ctx.fill();
  } else if (symbol === 'reed') {
    ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, -r); ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, -r * 0.35); ctx.quadraticCurveTo(s * r * 0.7, -r * 0.55, s * r * 0.85, -r); ctx.stroke();
    }
  } else if (symbol === 'moon') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.28, -r * 0.1, r * 0.62, 0.6, 5.2); ctx.stroke();
  }
  ctx.restore();
}

const PALETTES = {
  1: { sky: ['#17231a', '#0b1712', '#060d0a'], floor: ['#8b8c62', '#7d8058', '#70754f'], floorEdge: '#3a4530', wall: ['#646b4d', '#464e38', '#2e3525'], water: ['#2f6b5e', '#1e4c46'], accent: '#d7b36a', glow: '#e3c57f', fog: 'rgba(30,72,55,.2)' },
  2: { sky: ['#10252a', '#0a181d', '#060d10'], floor: ['#7c918a', '#6f847d', '#637770'], floorEdge: '#29453f', wall: ['#5c6f68', '#40534d', '#2b3b36'], water: ['#2d6d72', '#19484f'], accent: '#84d9c5', glow: '#b8f5e4', fog: 'rgba(40,120,112,.16)' },
  3: { sky: ['#0b2430', '#071720', '#040c11'], floor: ['#6f8f94', '#648489', '#59787d'], floorEdge: '#22434a', wall: ['#55737a', '#3b565d', '#263d44'], water: ['#2f7a8c', '#1b5062'], accent: '#8ed5df', glow: '#c5f4f8', fog: 'rgba(40,120,140,.16)' },
  4: { sky: ['#1a1822', '#100e18', '#07060c'], floor: ['#746e80', '#696374', '#5e5869'], floorEdge: '#332c3c', wall: ['#5b5568', '#423d50', '#2b2737'], water: ['#3c3f6a', '#24264a'], accent: '#cbb27a', glow: '#f0dca3', fog: 'rgba(80,50,100,.15)' },
  5: { sky: ['#291a15', '#180e0b', '#0b0605'], floor: ['#9c7c59', '#8d6f4f', '#7d6245'], floorEdge: '#4a3322', wall: ['#7a5e40', '#573f28', '#382719'], water: ['#2f6f7a', '#1a4f5a'], accent: '#ffd483', glow: '#ffe6ab', fog: 'rgba(150,70,40,.14)' },
  6: { sky: ['#1d1b2c', '#11101d', '#07060d'], floor: ['#8a7f92', '#7c7285', '#6e6578'], floorEdge: '#3b3345', wall: ['#71667c', '#524a60', '#373044'], water: ['#4a4f7e', '#2c3058'], accent: '#f0e0b3', glow: '#fff4cc', fog: 'rgba(100,80,130,.16)' },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = null;
    this.level = null;
    this.visual = { x: 0, y: 0 };
    this.from = { x: 0, y: 0 };
    this.to = { x: 0, y: 0 };
    this.animStart = 0;
    this.animDur = 170;
    this.particles = [];
    this.dust = [];
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = 'rgba(215,80,70,.3)';
    this.boardBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = parent.getBoundingClientRect();
    this.W = Math.max(320, rect.width);
    this.H = Math.max(300, rect.height);
    this.canvas.width = Math.floor(this.W * dpr);
    this.canvas.height = Math.floor(this.H * dpr);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.makeDust();
  }

  setGame(game) {
    const prevId = this.game?.levelId;
    const prevPlayer = this.visual;
    this.game = game;
    this.level = game.level;
    this.palette = PALETTES[this.level.chapter] || PALETTES[1];
    if (prevId !== this.level.id) {
      this.visual = { x: game.state.player.x, y: game.state.player.y };
      this.from = { ...this.visual }; this.to = { ...this.visual };
      this.particles = [];
      this.makeDust();
    } else {
      this.from = { ...this.visual };
      this.to = { x: game.state.player.x, y: game.state.player.y };
      this.animStart = performance.now();
      if (Math.abs(this.from.x - this.to.x) + Math.abs(this.from.y - this.to.y) > 2) this.visual = { ...this.to };
    }
    this.layout();
  }

  layout() {
    if (!this.level) return;
    const rows = this.level.map.length, cols = this.level.map[0].length;
    const maxTW = Math.min((this.W - 44) * 2 / (cols + rows), (this.H - 118) * 4 / (cols + rows));
    this.tw = Math.max(30, Math.min(84, maxTW));
    this.th = this.tw * 0.5;
    this.wallH = this.th * 1.45;
    this.ox = this.W / 2 - (cols - rows) * this.tw / 4;
    this.oy = this.H * 0.515 - (cols + rows - 2) * this.th / 4;
    this.boardBounds = {
      x: this.ox - rows * this.tw / 2, y: this.oy - this.wallH - this.th,
      w: (cols + rows) * this.tw / 2, h: (cols + rows) * this.th / 2 + this.wallH + this.th * 2,
    };
  }

  project(x, y) {
    return { x: this.ox + (x - y) * this.tw / 2, y: this.oy + (x + y) * this.th / 2 };
  }

  pick(cx, cy) {
    if (!this.level) return null;
    let best = null;
    for (let y = 0; y < this.level.map.length; y++) {
      for (let x = 0; x < this.level.map[0].length; x++) {
        const p = this.project(x, y);
        const dx = Math.abs(cx - p.x) / (this.tw * 0.52);
        const dy = Math.abs(cy - (p.y - 6)) / (this.th * 0.62);
        const d = dx + dy;
        if (d < 1.05 && (!best || d < best.d)) best = { x, y, d };
      }
    }
    return best;
  }

  makeDust() {
    this.dust = [];
    const n = 55;
    for (let i = 0; i < n; i++) {
      this.dust.push({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.7, s: 0.1 + Math.random() * 0.35, p: Math.random() * TAU });
    }
  }

  burst(x, y, color = '#f3dba2', count = 16) {
    const p = this.project(x, y);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, sp = 0.4 + Math.random() * 2.1;
      this.particles.push({ x: p.x, y: p.y - this.th * 0.9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5, life: 1, color, size: 1 + Math.random() * 3 });
    }
  }

  shakeScreen() { this.shake = 9; }
  flashScreen(color) { this.flash = 1; this.flashColor = color; }

  tick(now) {
    this.time = now / 1000;
    if (this.game && this.level) this.draw(now);
  }

  draw(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = this.palette;
    ctx.clearRect(0, 0, this.W, this.H);
    // cavern backdrop
    const bg = ctx.createRadialGradient(this.W * 0.55, this.H * 0.38, 20, this.W * 0.5, this.H * 0.5, Math.max(this.W, this.H) * 0.8);
    bg.addColorStop(0, p.sky[0]); bg.addColorStop(0.55, p.sky[1]); bg.addColorStop(1, p.sky[2]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, this.W, this.H);

    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawBackdrop(ctx, now);
    this.drawBoard(ctx, now);
    this.drawBeam(ctx, now);
    this.drawParticles(ctx);
    this.drawVignette(ctx);
    if (this.flash > 0.01) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flash * 0.7;
      ctx.fillRect(-20, -20, this.W + 40, this.H + 40);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    this.shake *= 0.88;
    this.flash *= 0.92;
    if (this.shake < 0.2) this.shake = 0;
    if (this.flash < 0.01) this.flash = 0;

    // player tween
    if (this.animStart) {
      const t = Math.min(1, (now - this.animStart) / this.animDur);
      const e = 1 - Math.pow(1 - t, 3);
      this.visual.x = this.from.x + (this.to.x - this.from.x) * e;
      this.visual.y = this.from.y + (this.to.y - this.from.y) * e;
      if (t >= 1) { this.animStart = 0; this.visual = { ...this.to }; }
    }
    this.drawDust(ctx, now);
  }

  drawBackdrop(ctx, now) {
    const p = this.palette;
    // distant columns / temple silhouette
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#030807';
    for (let i = 0; i < 7; i++) {
      const w = this.W * (0.09 + hash(i, 3) * 0.08);
      const x = this.W * (i / 7) + Math.sin(now / 9000 + i) * 8;
      const h = this.H * (0.3 + hash(i, 8) * 0.45);
      ctx.fillRect(x, this.H * 0.82 - h, w, h);
      ctx.fillRect(x - w * 0.2, this.H * 0.82 - h, w * 1.4, this.H * 0.035);
    }
    ctx.restore();

    // faint light shafts
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = this.W * (0.18 + i * 0.23) + Math.sin(now / 7000 + i) * 20;
      const g = ctx.createLinearGradient(x, 0, x + this.W * 0.08, this.H);
      g.addColorStop(0, 'rgba(255,235,190,.055)'); g.addColorStop(1, 'rgba(255,235,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + this.W * 0.05, 0); ctx.lineTo(x + this.W * 0.16, this.H); ctx.lineTo(x - this.W * 0.03, this.H); ctx.fill();
    }
    ctx.restore();
  }

  drawBoard(ctx, now) {
    const level = this.level, p = this.palette;
    const rows = level.map.length, cols = level.map[0].length;
    const order = [];
    for (let s = 0; s <= cols + rows - 2; s++) {
      for (let x = 0; x < cols; x++) {
        const y = s - x;
        if (y < 0 || y >= rows) continue;
        order.push([x, y]);
      }
    }
    // ground shadow under board
    const center = this.project((cols - 1) / 2, (rows - 1) / 2);
    const g = ctx.createRadialGradient(center.x, center.y, 10, center.x, center.y, (cols + rows) * this.tw * 0.33);
    g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    for (const [x, y] of order) this.drawCell(ctx, x, y, now);
    for (const [x, y] of order) this.drawEntities(ctx, x, y, now);
    this.drawExitBeacon(ctx, now);
    this.drawPlayer(ctx, now);
  }

  drawCell(ctx, x, y, now) {
    const p = this.palette;
    const level = this.level;
    const t = level.map[y][x];
    const pt = this.project(x, y);
    const w = this.tw, h = this.th;
    const hh = hash(x, y);
    const waterNow = (t === '~') ? this.game?.state.waterHigh : false;
    const occupiedWall = t === '#';
    if (t === 'o') {
      // chasm sides
      ctx.save();
      ctx.fillStyle = '#020504';
      diamond(ctx, pt.x, pt.y + h * 0.38, w, h); ctx.fill();
      const depth = h * 1.8;
      ctx.fillStyle = '#07100d';
      ctx.beginPath(); ctx.moveTo(pt.x - w / 2, pt.y); ctx.lineTo(pt.x, pt.y + h / 2); ctx.lineTo(pt.x, pt.y + h / 2 + depth); ctx.lineTo(pt.x - w / 2, pt.y + depth); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0a1510';
      ctx.beginPath(); ctx.moveTo(pt.x + w / 2, pt.y); ctx.lineTo(pt.x, pt.y + h / 2); ctx.lineTo(pt.x, pt.y + h / 2 + depth); ctx.lineTo(pt.x + w / 2, pt.y + depth); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(95,208,188,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pt.x - w / 2, pt.y); ctx.lineTo(pt.x, pt.y + h / 2); ctx.lineTo(pt.x + w / 2, pt.y); ctx.stroke();
      ctx.restore();
      return;
    }
    if (t === '#' || occupiedWall) {
      this.drawWall(ctx, x, y, pt, hh, now);
      return;
    }
    // floor base
    const stone = t === '~' && !waterNow ? p.floor[2] : p.floor[(x + y) % 2];
    diamond(ctx, pt.x, pt.y, w, h);
    const fg = ctx.createLinearGradient(pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2);
    fg.addColorStop(0, stone); fg.addColorStop(1, p.floorEdge);
    ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = 'rgba(12,25,20,.5)'; ctx.lineWidth = 1; ctx.stroke();

    // floor detail: inlaid lines and cracks
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = p.accent; ctx.lineWidth = 0.6;
    if ((x * 5 + y * 3) % 7 === 0) {
      ctx.beginPath();
      ctx.moveTo(pt.x - w * 0.24, pt.y + h * 0.1);
      ctx.lineTo(pt.x - w * 0.05, pt.y - h * 0.08);
      ctx.lineTo(pt.x + w * 0.18, pt.y + h * 0.12);
      ctx.stroke();
    }
    ctx.restore();

    if (t === '~') {
      if (waterNow) this.drawWater(ctx, pt, now, x, y);
      else {
        // dry basin: inner pit suggestion
        diamond(ctx, pt.x, pt.y + h * 0.18, w * 0.8, h * 0.68);
        ctx.fillStyle = 'rgba(3,10,12,.55)'; ctx.fill();
      }
    }

    if (this.game && this.game.isExit(x, y)) this.drawExit(ctx, pt, now);

    // crumble visual
    const cr = this.game?.state.entities.find((e) => e.type === 'crumble' && e.x === x && e.y === y);
    if (cr) {
      ctx.save();
      ctx.strokeStyle = 'rgba(20,24,18,.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(pt.x - w * 0.28, pt.y - h * 0.1);
      ctx.lineTo(pt.x - w * 0.05, pt.y + h * 0.1); ctx.lineTo(pt.x + w * 0.1, pt.y - h * 0.04); ctx.lineTo(pt.x + w * 0.3, pt.y + h * 0.12); ctx.stroke();
      if (cr.triggered) { ctx.fillStyle = 'rgba(0,0,0,.28)'; diamond(ctx, pt.x, pt.y, w * 0.8, h * 0.8); ctx.fill(); }
      ctx.restore();
    }
  }

  drawWall(ctx, x, y, pt, hh, now) {
    const p = this.palette;
    const w = this.tw, h = this.th, wh = this.wallH * (0.86 + hh * 0.2);
    const top = { x: pt.x, y: pt.y - wh };
    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    diamond(ctx, pt.x + 3, pt.y + 4, w * 1.02, h * 1.04); ctx.fill();
    // left face
    const lg = ctx.createLinearGradient(pt.x - w / 2, pt.y, pt.x, pt.y + h / 2);
    lg.addColorStop(0, p.wall[1]); lg.addColorStop(1, p.wall[2]);
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.moveTo(pt.x - w / 2, pt.y); ctx.lineTo(pt.x, pt.y + h / 2); ctx.lineTo(pt.x, pt.y + h / 2 - wh); ctx.lineTo(pt.x - w / 2, pt.y - wh); ctx.closePath(); ctx.fill();
    // right face
    ctx.fillStyle = p.wall[2];
    ctx.beginPath(); ctx.moveTo(pt.x + w / 2, pt.y); ctx.lineTo(pt.x, pt.y + h / 2); ctx.lineTo(pt.x, pt.y + h / 2 - wh); ctx.lineTo(pt.x + w / 2, pt.y - wh); ctx.closePath(); ctx.fill();
    // top
    ctx.fillStyle = p.wall[0];
    diamond(ctx, top.x, top.y, w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(8,16,12,.55)'; ctx.lineWidth = 1; ctx.stroke();
    // wall veins / carved lines
    if (hh > 0.45) {
      ctx.strokeStyle = 'rgba(215,179,106,.14)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(pt.x - w * 0.25, pt.y - wh * 0.15); ctx.lineTo(pt.x - w * 0.05, pt.y + h * 0.22 - wh * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pt.x + w * 0.22, pt.y - wh * 0.65); ctx.lineTo(pt.x + w * 0.1, pt.y + h * 0.15 - wh * 0.65); ctx.stroke();
    }
    // torch or hanging vine occasionally
    if (hh > 0.72 && (x + y) % 5 === 0) this.drawTorch(ctx, top.x, top.y + h * 0.1, now);
    else if (hh < 0.22 && (x + y) % 4 === 0) {
      ctx.strokeStyle = 'rgba(80,130,70,.45)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(top.x - w * 0.2 + i * w * 0.17, top.y + h * 0.3);
        ctx.quadraticCurveTo(top.x - w * 0.3 + i * w * 0.17, top.y + wh * 0.35, top.x - w * 0.16 + i * w * 0.17, top.y + wh * 0.62); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTorch(ctx, x, y, now) {
    const flick = 0.85 + Math.sin(now / 120 + x) * 0.12 + Math.sin(now / 47 + y) * 0.06;
    ctx.save();
    const g = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, this.tw * 0.75);
    g.addColorStop(0, `rgba(255,197,96,${0.34 * flick})`); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 4, this.tw * 0.75, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efc579';
    ctx.beginPath(); ctx.ellipse(x, y - 6, 2.2, 5.5 * flick, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff1c4';
    ctx.beginPath(); ctx.ellipse(x, y - 7, 1.0, 2.8 * flick, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawWater(ctx, pt, now, x, y) {
    const p = this.palette;
    ctx.save();
    diamond(ctx, pt.x, pt.y, this.tw * 0.97, this.th * 0.97);
    const g = ctx.createLinearGradient(pt.x, pt.y - this.th / 2, pt.x, pt.y + this.th / 2);
    g.addColorStop(0, p.water[0]); g.addColorStop(1, p.water[1]);
    ctx.fillStyle = g; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = p.glow; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const off = Math.sin(now / 900 + x * 1.3 + y + i * 2.1) * this.th * 0.18;
      ctx.beginPath();
      ctx.ellipse(pt.x + (i - 1) * this.tw * 0.18, pt.y + off, this.tw * 0.14, this.th * 0.08, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawExit(ctx, pt, now) {
    const p = this.palette;
    const pulse = 0.65 + Math.sin(now / 420) * 0.2;
    ctx.save();
    const g = ctx.createRadialGradient(pt.x, pt.y - 6, 2, pt.x, pt.y - 6, this.tw * 0.6);
    g.addColorStop(0, `rgba(255,225,150,${0.4 * pulse})`); g.addColorStop(1, 'rgba(255,225,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y - 6, this.tw * 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y, this.tw * 0.23, this.th * 0.22, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y, this.tw * 0.14, this.th * 0.13, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.45 + Math.sin(now / 300) * 0.2;
    const beam = ctx.createLinearGradient(pt.x, pt.y - 90, pt.x, pt.y + 5);
    beam.addColorStop(0, 'rgba(255,230,170,0)'); beam.addColorStop(1, 'rgba(255,230,170,.24)');
    ctx.fillStyle = beam; ctx.fillRect(pt.x - this.tw * 0.14, pt.y - 90, this.tw * 0.28, 95);
    ctx.restore();
  }

  drawExitBeacon(ctx, now) {
    if (!this.level) return;
    const [ex, ey] = this.level.exit;
    const pt = this.project(ex, ey);
    const pulse = 0.62 + Math.sin(now / 380) * 0.22;
    const y = pt.y - this.th * 0.95;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(pt.x, y, 2, pt.x, y, this.tw * 0.42);
    g.addColorStop(0, `rgba(255,236,176,${0.5 * pulse})`); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, y, this.tw * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,238,185,${0.55 + pulse * 0.3})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(pt.x, y, this.tw * 0.15, this.th * 0.12, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(pt.x, y, this.tw * 0.09, this.th * 0.08, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,246,210,${0.75 * pulse})`;
    ctx.beginPath(); ctx.arc(pt.x, y, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawEntities(ctx, x, y, now) {
    const state = this.game?.state;
    if (!state) return;
    const pt = this.project(x, y);
    for (const e of state.entities) {
      if (e.x !== x || e.y !== y) continue;
      if (e.type === 'shard' && state.collectedShards.includes(e.id)) continue;
      if (e.type === 'doc' && state.collectedDocs.includes(e.id)) continue;
      if (e.type === 'key' && state.keys.includes(e.id)) continue;
      if (e.type === 'relic' && state.relicCollected) continue;
      switch (e.type) {
        case 'shard': this.drawShard(ctx, pt, now); break;
        case 'doc': this.drawDoc(ctx, pt, now); break;
        case 'key': this.drawKey(ctx, pt, now); break;
        case 'relic': this.drawRelic(ctx, pt, now); break;
        case 'block': this.drawBlock(ctx, pt, now); break;
        case 'plate': this.drawPlate(ctx, pt, e, now); break;
        case 'door': this.drawDoor(ctx, pt, e, now); break;
        case 'mirror': this.drawMirror(ctx, pt, e, now); break;
        case 'dial': this.drawDial(ctx, pt, e, now); break;
        case 'valve': this.drawValve(ctx, pt, e, now); break;
        case 'emitter': this.drawEmitter(ctx, pt, e, now); break;
        case 'target': this.drawTarget(ctx, pt, e, now); break;
        case 'glyph': this.drawGlyph(ctx, pt, e, now); break;
        case 'guardian': this.drawGuardian(ctx, pt, e, now); break;
        case 'hazard': this.drawHazard(ctx, pt, e, now); break;
        case 'crumble': this.drawCrumble(ctx, pt, e, now); break;
        case 'platform': this.drawPlatform(ctx, pt, now); break;
        default: break;
      }
    }
    // interact prompt marker
    if (this.game?.findInteractable) {
      const it = this.game.findInteractable();
      if (it && it.x === x && it.y === y && state.status === 'playing') {
        ctx.save();
        ctx.strokeStyle = 'rgba(243,219,162,.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(pt.x, pt.y - this.th * 0.55, this.tw * 0.1 + Math.sin(now / 220) * 1.5, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  shadow(ctx, pt, rx, ry, alpha = 0.35) {
    ctx.save(); ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y + 2, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  floatY(now, seed = 0) { return Math.sin(now / 600 + seed) * 2.5; }

  drawShard(ctx, pt, now) {
    const y = pt.y - this.th * 0.85 + this.floatY(now, pt.x);
    const g = ctx.createRadialGradient(pt.x, y, 1, pt.x, y, 18);
    g.addColorStop(0, 'rgba(150,255,235,.55)'); g.addColorStop(1, 'rgba(95,208,188,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, y, 18, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(pt.x, y); ctx.rotate(Math.sin(now / 900 + pt.x) * 0.2);
    ctx.fillStyle = '#7ef0dc'; ctx.strokeStyle = '#d8fff5'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, -1); ctx.lineTo(0, 9); ctx.lineTo(-5, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawDoc(ctx, pt, now) {
    this.shadow(ctx, pt, 13, 5, 0.22);
    const y = pt.y - 8 + this.floatY(now, 4) * 0.4;
    ctx.save(); ctx.translate(pt.x, y);
    ctx.fillStyle = '#e4d5ae'; roundRect(ctx, -9, -6, 18, 12, 2); ctx.fill();
    ctx.strokeStyle = '#9a7d4c'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,40,.5)';
    for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(2, i); ctx.lineTo(7, i); ctx.stroke(); }
    ctx.restore();
  }

  drawKey(ctx, pt, now) {
    this.shadow(ctx, pt, 8, 3, 0.2);
    const y = pt.y - 9 + this.floatY(now, 2) * 0.5;
    ctx.save(); ctx.translate(pt.x, y); ctx.rotate(-0.4);
    ctx.strokeStyle = '#e0bd75'; ctx.fillStyle = '#e0bd75'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-5, 0, 4, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(9, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(5, 4); ctx.moveTo(8, 0); ctx.lineTo(8, 3); ctx.stroke();
    ctx.restore();
  }

  drawRelic(ctx, pt, now) {
    const y = pt.y - this.th * 0.9 + Math.sin(now / 700) * 3;
    const g = ctx.createRadialGradient(pt.x, y, 2, pt.x, y, 28);
    g.addColorStop(0, 'rgba(255,224,150,.6)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, y, 28, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(pt.x, y); ctx.rotate(Math.sin(now / 1100) * 0.3);
    ctx.fillStyle = '#f0cc7d'; ctx.strokeStyle = '#fff1c0'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, -3); ctx.lineTo(6, 10); ctx.lineTo(-6, 10); ctx.lineTo(-9, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2c18'; ctx.beginPath(); ctx.arc(0, 1, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawBlock(ctx, pt, now) {
    this.shadow(ctx, pt, this.tw * 0.28, this.th * 0.24, 0.35);
    const s = this.tw * 0.31, hgt = this.th * 0.95;
    const top = { x: pt.x, y: pt.y - hgt };
    ctx.fillStyle = '#4d493d';
    ctx.beginPath(); ctx.moveTo(pt.x - s, pt.y); ctx.lineTo(pt.x, pt.y + s * 0.55); ctx.lineTo(pt.x, pt.y + s * 0.55 - hgt); ctx.lineTo(pt.x - s, pt.y - hgt); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#39362e';
    ctx.beginPath(); ctx.moveTo(pt.x + s, pt.y); ctx.lineTo(pt.x, pt.y + s * 0.55); ctx.lineTo(pt.x, pt.y + s * 0.55 - hgt); ctx.lineTo(pt.x + s, pt.y - hgt); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#615b49';
    diamond(ctx, top.x, top.y, s * 2, s * 1.1); ctx.fill();
    ctx.strokeStyle = 'rgba(215,179,106,.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(top.x, top.y - s * 0.3); ctx.lineTo(top.x + s * 0.45, top.y); ctx.lineTo(top.x, top.y + s * 0.3); ctx.lineTo(top.x - s * 0.45, top.y); ctx.closePath(); ctx.stroke();
  }

  drawPlate(ctx, pt, e, now) {
    const pulse = e.pressed ? 0.8 + Math.sin(now / 250) * 0.2 : 0.25;
    diamond(ctx, pt.x, pt.y, this.tw * 0.62, this.th * 0.58);
    ctx.fillStyle = e.pressed ? 'rgba(215,179,106,.3)' : 'rgba(24,36,29,.65)'; ctx.fill();
    ctx.strokeStyle = `rgba(215,179,106,${0.3 + pulse * 0.6})`; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = `rgba(243,219,162,${pulse * 0.5})`;
    diamond(ctx, pt.x, pt.y, this.tw * 0.3, this.th * 0.28); ctx.fill();
  }

  drawDoor(ctx, pt, e, now) {
    const open = e.open;
    const s = this.tw * 0.34, hgt = this.th * 2.4;
    this.shadow(ctx, pt, s * 1.2, this.th * 0.3, 0.3);
    // frame pillars
    ctx.fillStyle = '#5a5342';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(pt.x + side * s, pt.y);
      ctx.lineTo(pt.x + side * s, pt.y - hgt);
      ctx.lineTo(pt.x + side * (s - 4), pt.y - hgt);
      ctx.lineTo(pt.x + side * (s - 4), pt.y);
      ctx.fill();
    }
    // lintel
    ctx.fillStyle = '#6a604b';
    ctx.fillRect(pt.x - s, pt.y - hgt - 4, s * 2, 7);
    if (!open) {
      const g = ctx.createLinearGradient(pt.x, pt.y - hgt, pt.x, pt.y);
      g.addColorStop(0, '#323d35'); g.addColorStop(1, '#1b2620');
      ctx.fillStyle = g;
      ctx.fillRect(pt.x - s + 4, pt.y - hgt, (s - 4) * 2, hgt);
      ctx.strokeStyle = 'rgba(215,179,106,.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(pt.x - s + 4, pt.y - hgt, (s - 4) * 2, hgt);
      drawSymbol(ctx, pt.x, pt.y - hgt * 0.55, this.tw * 0.1, 'eye', 'rgba(215,179,106,.65)', 1);
      ctx.fillStyle = 'rgba(95,208,188,.18)';
      ctx.fillRect(pt.x - s + 7, pt.y - hgt + 4, (s - 7) * 2, hgt - 8);
    } else {
      ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = 'rgba(243,219,162,.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const yy = pt.y - 8 - i * 12;
        ctx.beginPath(); ctx.moveTo(pt.x - s * 0.7, yy); ctx.lineTo(pt.x + s * 0.7, yy); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawMirror(ctx, pt, e, now) {
    this.shadow(ctx, pt, 13, 5, 0.25);
    const y = pt.y - this.th * 0.75;
    ctx.save(); ctx.translate(pt.x, y);
    ctx.strokeStyle = '#6f654e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(0, -5); ctx.stroke();
    ctx.fillStyle = '#544c3c'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(-10, -10, 10, 10);
    g.addColorStop(0, '#b8e6dc'); g.addColorStop(0.5, '#5b8f87'); g.addColorStop(1, '#c8b98e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f5e9c4'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (e.dir === '/') { ctx.moveTo(-6, 6); ctx.lineTo(6, -6); }
    else { ctx.moveTo(-6, -6); ctx.lineTo(6, 6); }
    ctx.stroke();
    ctx.restore();
  }

  drawDial(ctx, pt, e, now) {
    this.shadow(ctx, pt, 13, 5, 0.28);
    const y = pt.y - this.th * 0.6;
    ctx.save(); ctx.translate(pt.x, y);
    ctx.fillStyle = '#4e4a3e'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b09a69'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
    drawSymbol(ctx, 0, 0, 6.5, SYMBOLS[e.value], e.value === e.target ? '#8ef0cf' : '#e6d6a8', 1.5);
    ctx.fillStyle = e.value === e.target ? '#8ef0cf' : '#8a7e60';
    ctx.beginPath(); ctx.moveTo(Math.cos(-Math.PI / 2) * 12, Math.sin(-Math.PI / 2) * 12); ctx.lineTo(9, -16); ctx.lineTo(15, -16); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawValve(ctx, pt, e, now) {
    this.shadow(ctx, pt, 12, 4, 0.25);
    const y = pt.y - this.th * 0.55;
    ctx.save(); ctx.translate(pt.x, y);
    ctx.strokeStyle = '#b07a4a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + this.time * 0.05;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke();
    }
    ctx.fillStyle = '#d7b36a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawEmitter(ctx, pt, e, now) {
    const dir = e.dir;
    const x = pt.x, y = pt.y - this.th * 0.8;
    const pulse = 0.7 + Math.sin(now / 300) * 0.2;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, 18);
    g.addColorStop(0, `rgba(255,238,175,${0.5 * pulse})`); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3d382c'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffedb5'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawTarget(ctx, pt, e, now) {
    const hit = this.game?.state.beam.hit.includes(e.id);
    const y = pt.y - this.th * 0.9;
    const col = hit ? '#fff0b4' : '#7b7059';
    ctx.save();
    if (hit) {
      const g = ctx.createRadialGradient(pt.x, y, 2, pt.x, y, 26);
      g.addColorStop(0, 'rgba(255,236,160,.7)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, y, 26, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#443f33'; ctx.beginPath(); ctx.arc(pt.x, y, 9, 0, TAU); ctx.fill();
    drawSymbol(ctx, pt.x, y, 6, 'eye', col, 1.5);
    ctx.restore();
  }

  drawGlyph(ctx, pt, e, now) {
    const done = this.game.state.glyphSeq.includes(e.order);
    const glow = done ? 0.55 : 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(95,208,188,${glow * 0.15})`;
    diamond(ctx, pt.x, pt.y, this.tw * 0.62, this.th * 0.58); ctx.fill();
    drawSymbol(ctx, pt.x, pt.y, this.tw * 0.12, e.symbol, done ? 'rgba(180,255,230,.85)' : 'rgba(215,179,106,.45)', 1.1);
    ctx.restore();
  }

  drawGuardian(ctx, pt, e, now) {
    this.shadow(ctx, pt, this.tw * 0.3, this.th * 0.25, 0.4);
    const y = pt.y - this.th * 0.15;
    const dir = e.facing === 'w' ? -1 : 1;
    ctx.save(); ctx.translate(pt.x, y); ctx.scale(dir, 1);
    // body
    ctx.fillStyle = '#3b3f37';
    ctx.beginPath(); ctx.ellipse(0, -12, 13, 7, 0, 0, TAU); ctx.fill();
    // legs
    ctx.strokeStyle = '#2f342d'; ctx.lineWidth = 3;
    for (const lx of [-8, -2, 5, 10]) { ctx.beginPath(); ctx.moveTo(lx, -10); ctx.lineTo(lx, 1); ctx.stroke(); }
    // head
    ctx.fillStyle = '#44483d';
    ctx.beginPath(); ctx.ellipse(12, -17, 7, 5, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15, -20); ctx.lineTo(20, -26); ctx.lineTo(16, -15); ctx.fill();
    // eyes
    ctx.fillStyle = '#e9a15b'; ctx.beginPath(); ctx.arc(14, -18, 1.6, 0, TAU); ctx.fill();
    // back spines
    ctx.fillStyle = '#2b302a';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-5 + i * 4, -16); ctx.lineTo(-3 + i * 4, -22); ctx.lineTo(0 + i * 4, -16); ctx.fill(); }
    // glow
    const g = ctx.createRadialGradient(14, -18, 1, 14, -18, 11);
    g.addColorStop(0, 'rgba(255,185,80,.25)'); g.addColorStop(1, 'rgba(255,185,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(14, -18, 11, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawHazard(ctx, pt, e, now) {
    if (e.kind === 'dart') {
      const active = this.game.hazardActive(e);
      const cells = this.game.dartCells(e);
      ctx.save();
      if (active) {
        ctx.strokeStyle = 'rgba(228,107,93,.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const start = this.project(e.x, e.y);
        const end = cells.length ? this.project(cells[cells.length - 1][0], cells[cells.length - 1][1]) : start;
        ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      // dart hole
      ctx.fillStyle = active ? '#e46b5d' : '#42362c';
      ctx.beginPath(); ctx.arc(pt.x, pt.y - this.th * 0.5, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = active ? 'rgba(255,140,110,.8)' : 'rgba(120,90,60,.5)';
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pt.x, pt.y - this.th * 0.5, 6 + (active ? 2 : 0), 0, TAU); ctx.stroke();
      ctx.restore();
    } else if (e.kind === 'blade') {
      this.shadow(ctx, pt, 10, 4, 0.3);
      ctx.save(); ctx.translate(pt.x, pt.y - this.th * 0.5); ctx.rotate(now / 240);
      ctx.strokeStyle = '#c8d3c8'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i / 3 * TAU) * 12, Math.sin(i / 3 * TAU) * 12); ctx.stroke(); }
      ctx.fillStyle = '#8a6d43'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  drawCrumble(ctx, pt, e, now) {
    if (e.triggered) return;
    ctx.save(); ctx.strokeStyle = 'rgba(243,219,162,.25)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    diamond(ctx, pt.x, pt.y, this.tw * 0.45, this.th * 0.45); ctx.stroke(); ctx.restore();
  }

  drawPlatform(ctx, pt, now) {
    // floating slab
    ctx.save(); ctx.translate(pt.x, pt.y - this.th * 0.15);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 8, this.tw * 0.32, this.th * 0.25, 0, 0, TAU); ctx.fill();
    const hgt = this.th * 0.55;
    ctx.fillStyle = '#4d4a40';
    ctx.beginPath(); ctx.moveTo(-this.tw * 0.34, 0); ctx.lineTo(0, this.th * 0.25); ctx.lineTo(0, this.th * 0.25 - hgt); ctx.lineTo(-this.tw * 0.34, -hgt); ctx.fill();
    ctx.fillStyle = '#38362f';
    ctx.beginPath(); ctx.moveTo(this.tw * 0.34, 0); ctx.lineTo(0, this.th * 0.25); ctx.lineTo(0, this.th * 0.25 - hgt); ctx.lineTo(this.tw * 0.34, -hgt); ctx.fill();
    ctx.fillStyle = '#68614e'; diamond(ctx, 0, -hgt, this.tw * 0.68, this.th * 0.5); ctx.fill();
    ctx.strokeStyle = 'rgba(95,208,188,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -hgt, this.tw * 0.15, this.th * 0.11, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawBeam(ctx, now) {
    const beam = this.game?.state.beam;
    if (!beam || !beam.cells.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,248,205,.75)' : 'rgba(255,210,120,.22)';
      ctx.lineWidth = pass ? 1.6 : 8;
      ctx.beginPath();
      for (let i = 0; i < beam.cells.length; i++) {
        const [x, y] = beam.cells[i];
        const p = this.project(x, y);
        const yy = p.y - this.th * 0.7;
        i ? ctx.lineTo(p.x, yy) : ctx.moveTo(p.x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayer(ctx, now) {
    const outfit = this.game?.outfit || 'default';
    const colors = (this.outfitColors && this.outfitColors[outfit]) || { jacket: '#b7a06c', shirt: '#315c54', pants: '#2b3d3a', accent: '#d7b36a', skin: '#c99472', hair: '#2b1d17' };
    const p = this.project(this.visual.x, this.visual.y);
    const moving = this.animStart && now - this.animStart < this.animDur;
    const bob = moving ? Math.abs(Math.sin((now - this.animStart) / 45)) * 4 : Math.sin(now / 800) * 1.2;
    const x = p.x, y = p.y - bob;
    const scale = Math.max(0.85, Math.min(1.4, this.tw / 54));
    this.shadow(ctx, p, 12 * scale, 5 * scale, 0.38);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    // legs
    ctx.strokeStyle = colors.pants; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-5, 0); ctx.moveTo(3, -9); ctx.lineTo(4, 0); ctx.stroke();
    // boots
    ctx.strokeStyle = '#2b231c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, 0); ctx.moveTo(3, 0); ctx.lineTo(7, 0); ctx.stroke();
    // torso / jacket
    ctx.fillStyle = colors.jacket;
    roundRect(ctx, -7, -27, 14, 19, 4); ctx.fill();
    ctx.fillStyle = colors.shirt;
    roundRect(ctx, -3, -26, 6, 12, 2); ctx.fill();
    // belt
    ctx.fillStyle = colors.accent; ctx.fillRect(-7, -14, 14, 2.2);
    // backpack
    ctx.fillStyle = '#4b3b2a'; roundRect(ctx, -9, -24, 4, 11, 2); ctx.fill();
    // arms
    ctx.strokeStyle = colors.jacket; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    const swing = moving ? Math.sin((now - this.animStart) / 60) * 3 : 0;
    ctx.beginPath(); ctx.moveTo(-7, -24); ctx.lineTo(-10, -16 + swing); ctx.moveTo(7, -24); ctx.lineTo(10, -16 - swing); ctx.stroke();
    // hands
    ctx.fillStyle = colors.skin;
    ctx.beginPath(); ctx.arc(-10, -15 + swing, 1.7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -15 - swing, 1.7, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = colors.skin; ctx.beginPath(); ctx.arc(0, -32, 6.2, 0, TAU); ctx.fill();
    // hair
    ctx.fillStyle = colors.hair;
    ctx.beginPath(); ctx.arc(0, -33.5, 6.4, Math.PI, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -33); ctx.quadraticCurveTo(-9, -24, -4, -20); ctx.quadraticCurveTo(-7, -28, -2, -32); ctx.fill();
    // braid
    ctx.strokeStyle = colors.hair; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(4, -31); ctx.quadraticCurveTo(9, -26, 7, -19); ctx.stroke();
    // face hint / eyes
    ctx.fillStyle = '#2c211a'; ctx.beginPath(); ctx.arc(2.2, -33, 0.8, 0, TAU); ctx.fill();
    // accent scarf
    ctx.strokeStyle = colors.accent; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-5, -27); ctx.lineTo(4, -26); ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, TAU); ctx.fill();
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.022;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawDust(ctx, now) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const d of this.dust) {
      const x = d.x * this.W + Math.sin(now / 9000 + d.p) * 18;
      const y = ((d.y + now / (90000 / d.s)) % 1) * this.H;
      ctx.fillStyle = `rgba(255,238,190,${0.05 + d.r * 0.025})`;
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
  }
}

export class Ambient {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dust = [];
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.make();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.make();
  }
  make() {
    this.dust = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 2, s: .2 + Math.random() * .5, p: Math.random() * TAU }));
  }
  tick(now) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const g = ctx.createRadialGradient(W * .64, H * .4, 20, W * .5, H * .5, Math.max(W, H) * .8);
    g.addColorStop(0, '#284b3d'); g.addColorStop(.42, '#0f231d'); g.addColorStop(1, '#050c0a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // distant temple
    ctx.save();
    ctx.globalAlpha = .38;
    const base = H * .82;
    for (let i = 0; i < 5; i++) {
      const x = W * (.52 + i * .13), h = H * (.17 + (i % 3) * .07);
      ctx.fillStyle = '#07120f';
      ctx.fillRect(x, base - h, W * .075, h);
      ctx.beginPath(); ctx.moveTo(x - W * .015, base - h); ctx.lineTo(x + W * .0375, base - h - H * .06); ctx.lineTo(x + W * .09, base - h); ctx.fill();
    }
    ctx.fillStyle = '#06100d'; ctx.fillRect(0, base, W, H - base);
    // staircase
    for (let i = 0; i < 6; i++) { ctx.fillRect(W * .5 + i * 10, base - i * 8, W * .3 - i * 20, 4); }
    ctx.restore();
    // god rays
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = W * (.52 + i * .1) + Math.sin(now / 8000 + i) * 18;
      const grad = ctx.createLinearGradient(x, 0, x + W * .1, H * .8);
      grad.addColorStop(0, 'rgba(255,220,150,.05)'); grad.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + W * .03, 0); ctx.lineTo(x + W * .16, H * .8); ctx.lineTo(x - W * .02, H * .8); ctx.fill();
    }
    ctx.restore();
    // dust
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const d of this.dust) {
      const x = d.x * W + Math.sin(now / 10000 + d.p) * 22;
      const y = ((d.y + now / (100000 / d.s)) % 1) * H;
      ctx.fillStyle = `rgba(255,235,180,${.05 + d.r * .02})`;
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, W, H);
  }
}
