/*
 * Hand-drawn Staunton-inspired piece silhouettes. Each piece is rendered with
 * a subtle metal gradient and a highlight so it reads well on both square
 * colors at phone size.
 */

let gradientSerial = 0;

const BASE = `
  <path d="M25 82.5h50c2.8 0 5 2.2 5 5s-2.2 5-5 5H25c-2.8 0-5-2.2-5-5s2.2-5 5-5Z"/>
  <path d="M31 75.5h38c2.2 0 4 1.8 4 4s-1.8 4-4 4H31c-2.2 0-4-1.8-4-4s1.8-4 4-4Z" opacity=".92"/>
`;

const PATHS = {
  p: `
    <circle cx="50" cy="24" r="12.5"/>
    <path d="M43 36.5h14l-1.6 7.4c9.1 4.2 15.1 14.1 15.1 25.1 0 6.4-2 11.6-5.9 15.5H35.4c-3.9-3.9-5.9-9.1-5.9-15.5 0-11 6-20.9 15.1-25.1L43 36.5Z"/>
    ${BASE}
  `,
  n: `
    <g transform="translate(10.8 4.5) scale(.175)">
      <path stroke-width="17" d="M96 48L82.7 61.3C70.7 73.3 64 89.5 64 106.5l0 132.4c0 10.7 5.3 20.7 14.2 26.6l10.6 7c14.3 9.6 32.7 10.7 48.1 3l3.2-1.6c2.6-1.3 5-2.8 7.3-4.5l49.4-37c6.6-5 15.7-5 22.3 0c10.2 7.7 9.9 23.1-.7 30.3L90.4 350C73.9 361.3 64 380 64 400l320 0 28.9-159c2.1-11.3 3.1-22.8 3.1-34.3l0-14.7C416 86 330 0 224 0L83.8 0C72.9 0 64 8.9 64 19.8c0 7.5 4.2 14.3 10.9 17.7L96 48zM22.6 473.4c-4.2 4.2-6.6 10-6.6 16C16 501.9 26.1 512 38.6 512l370.7 0c12.5 0 22.6-10.1 22.6-22.6c0-6-2.4-11.8-6.6-16L384 432 64 432 22.6 473.4z"/>
    </g>
    <circle cx="35.3" cy="24.8" r="1.8" fill="var(--piece-line)" stroke="none"/>
    <path d="M43 40.5c4.5-4.6 8.1-9.7 10.8-15.3" fill="none" stroke="var(--piece-shine)" stroke-width="2.2" stroke-linecap="round" opacity=".46"/>
    <path d="M65.5 42.5c-2.8 3.4-4.6 7.2-5.4 11.3" fill="none" stroke="var(--piece-shine)" stroke-width="1.8" stroke-linecap="round" opacity=".24"/>
  `,
  b: `
    <path d="M50 10.5v8.2M45.9 14.6h8.2" fill="none" stroke="var(--piece-line)" stroke-width="3.1" stroke-linecap="round"/>
    <path d="M50 17.2c-3.5 7.2-10.2 11.2-10.2 20.1 0 6.3 3.2 10.9 8.1 13.6l-2.7 5.1h9.6l-2.7-5.1c4.9-2.7 8.1-7.3 8.1-13.6 0-8.9-6.7-12.9-10.2-20.1Z"/>
    <path d="M38.5 53.5h23l4.5 21.5h-32l4.5-21.5Z"/>
    ${BASE}
  `,
  r: `
    <path d="M28.5 17.5h10.2v10.3h7.1V17.5h8.4v10.3h7.1V17.5h10.2v23.2l-8.1 6.5v24.1l8.1 6.2v2.5h-43v-2.5l8.1-6.2V47.2l-8.1-6.5V17.5Z"/>
    ${BASE}
  `,
  q: `
    <path d="M26.5 27.2l7.8 27.3h31.4l7.8-27.3-13.2 12.1-5.2-17.7-5.1 17.7-13.5-12.1Z"/>
    <circle cx="26.5" cy="23.8" r="4.1"/>
    <circle cx="50" cy="16.4" r="4.1"/>
    <circle cx="73.5" cy="23.8" r="4.1"/>
    <circle cx="34.2" cy="36.2" r="2.5"/>
    <circle cx="65.8" cy="36.2" r="2.5"/>
    <path d="M35.8 54.5h28.4l3.5 20.5h-35.4l3.5-20.5Z"/>
    ${BASE}
  `,
  k: `
    <path d="M50 7v15.1M43.7 13.1h12.6" fill="none" stroke="var(--piece-line)" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M29.6 28.7l7.9 25.8h25l7.9-25.8-11.9 10.2-4.5-14.1-4.5 14.1-9.9-10.2Z"/>
    <path d="M36.2 54.5h27.6l3.8 20.5H32.4l3.8-20.5Z"/>
    ${BASE}
  `,
};

const HIGHLIGHTS = {
  p: `<path d="M42.8 48.5c-2.2 3.2-3.4 7.3-3.3 11.8" fill="none" stroke="var(--piece-shine)" stroke-width="2.2" stroke-linecap="round" opacity=".45"/>`,
  n: `<path d="M36 72c.3-7.4 2.2-13.7 6.4-19" fill="none" stroke="var(--piece-shine)" stroke-width="2" stroke-linecap="round" opacity=".3"/>`,
  b: `<path d="M43.6 52.6c-1.3-2.6-1.8-5.5-1.4-8.7" fill="none" stroke="var(--piece-shine)" stroke-width="2" stroke-linecap="round" opacity=".45"/>`,
  r: `<path d="M35.6 25.5v12.2" fill="none" stroke="var(--piece-shine)" stroke-width="2.2" stroke-linecap="round" opacity=".42"/>`,
  q: `<path d="M39.2 43.2c-1.1-3.2-1.6-6.3-1.4-9.4" fill="none" stroke="var(--piece-shine)" stroke-width="2" stroke-linecap="round" opacity=".42"/>`,
  k: `<path d="M40.4 43.2c-1.2-3-1.7-5.8-1.6-8.7" fill="none" stroke="var(--piece-shine)" stroke-width="2" stroke-linecap="round" opacity=".42"/>`,
};

export function pieceArt(role, color) {
  const id = `metal-${gradientSerial++}`;
  const light = color === 'w' ? '#fffdf4' : '#5a6b62';
  const mid = color === 'w' ? '#e6d8b8' : '#202a26';
  const dark = color === 'w' ? '#bdac81' : '#070b0a';
  const line = color === 'w' ? '#5d5038' : '#a8b9af';
  const shine = color === 'w' ? '#ffffff' : '#e7f0e9';
  return `
    <svg class="piece-art" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2=".58" y2="1">
          <stop offset="0" stop-color="${light}"/>
          <stop offset=".42" stop-color="${mid}"/>
          <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
      </defs>
      <g fill="url(#${id})" stroke="${line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        ${PATHS[role]}
      </g>
      <g style="--piece-shine:${shine}">
        ${HIGHLIGHTS[role]}
      </g>
    </svg>
  `;
}

export function powerBadge(power) {
  return `<span class="power-badge" aria-hidden="true">${power.toUpperCase()}</span>`;
}

export function tinyPiece(role, color, className = '') {
  return `<span class="tiny-piece ${color} ${className}" aria-hidden="true">${pieceArt(role, color)}</span>`;
}

export function roleGlyph(role) {
  return { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }[role] || '?';
}
