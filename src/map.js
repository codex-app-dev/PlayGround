import { MAP_EXTENT } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createMapCanvas(world, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = size / (MAP_EXTENT * 2);
  const toX = x => size * 0.5 + x * scale;
  const toY = z => size * 0.5 + z * scale;

  const water = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.2, size * 0.5, size * 0.5, size * 0.72);
  water.addColorStop(0, '#173c42');
  water.addColorStop(0.62, '#102b31');
  water.addColorStop(1, '#091b20');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, size, size);

  const cells = 190;
  const cellSize = size / cells;
  const shade = (x, z) => {
    const hx = world.terrainHeight(x + 3.2, z);
    const hz = world.terrainHeight(x, z + 3.2);
    return (hx - hz) * 0.055;
  };

  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const u = (gx + 0.5) / cells;
      const v = (gy + 0.5) / cells;
      const x = -MAP_EXTENT + u * MAP_EXTENT * 2;
      const z = -MAP_EXTENT + v * MAP_EXTENT * 2;
      const h = world.terrainHeight(x, z);
      if (h < -0.45) continue;
      const s = shade(x, z);
      let r, g, b;
      if (h < 0.8) { r = clamp(137 + s * 90, 0, 255); g = clamp(124 + s * 80, 0, 255); b = clamp(89 + s * 60, 0, 255); }
      else if (h < 1.8) { r = clamp(112 + s * 80, 0, 255); g = clamp(112 + s * 80, 0, 255); b = clamp(76 + s * 60, 0, 255); }
      else {
        const t = clamp((h - 1) / 22, 0, 1);
        r = clamp(57 - t * 8 + s * 110, 0, 255);
        g = clamp(77 + t * 11 + s * 95, 0, 255);
        b = clamp(52 - t * 4 + s * 75, 0, 255);
      }
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(toX(x) - cellSize * 0.55, toY(z) - cellSize * 0.55, cellSize * 1.1, cellSize * 1.1);
    }
  }

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = '#cfc4a6';
  ctx.lineWidth = 1;
  for (const site of world.sites) {
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(toX(site.x), toY(site.z), (site.r * 1.15 + i * 8) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(126, 107, 76, 0.86)';
  ctx.lineWidth = 10 * scale * 0.72;
  for (const road of world.roadSegments) {
    ctx.beginPath();
    ctx.moveTo(toX(road.ax), toY(road.az));
    ctx.lineTo(toX(road.bx), toY(road.bz));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(181, 158, 113, 0.4)';
  ctx.lineWidth = 3 * scale * 0.72;
  for (const road of world.roadSegments) {
    ctx.beginPath();
    ctx.moveTo(toX(road.ax), toY(road.az));
    ctx.lineTo(toX(road.bx), toY(road.bz));
    ctx.stroke();
  }
  ctx.restore();

  for (const b of world.buildings) {
    const x = toX(b.x - b.w / 2);
    const y = toY(b.z - b.d / 2);
    const w = b.w * scale;
    const hh = b.d * scale;
    ctx.fillStyle = 'rgba(202, 193, 171, 0.82)';
    ctx.fillRect(x, y, w, hh);
    ctx.strokeStyle = 'rgba(16, 23, 21, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, hh);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const site of world.sites) {
    const x = toX(site.x);
    const y = toY(site.z);
    ctx.save();
    ctx.fillStyle = 'rgba(7, 12, 10, 0.55)';
    ctx.fillRect(x - 60, y - 31, 120, 20);
    ctx.fillStyle = '#e8dfc8';
    ctx.font = '600 13px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(site.name, x, y - 21);
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
    ctx.restore();
  }

  for (const cabin of [[4, 134], [-74, -139], [178, -78], [-4, -64], [186, 48]]) {
    const x = toX(cabin[0]);
    const y = toY(cabin[1]);
    ctx.fillStyle = 'rgba(206, 198, 177, 0.55)';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }

  ctx.save();
  ctx.translate(size / 2, size * 0.055);
  ctx.fillStyle = 'rgba(241, 234, 217, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(7, 6); ctx.lineTo(0, 2); ctx.lineTo(-7, 6); ctx.closePath();
  ctx.fill();
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillText('N', 0, 22);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(241, 234, 217, 0.055)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const p = (size / 8) * i;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  ctx.restore();

  return canvas;
}
