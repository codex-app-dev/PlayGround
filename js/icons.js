// Crisp inline SVG icons/Crests. No external icon font needed.
const P = {
  move: '<path d="M32 7v50M7 32h50M32 7l-7 8M32 7l7 8M32 57l-7-8M32 57l7-8M7 32l8-7M7 32l8 7M57 32l-8-7M57 32l-8 7"/>',
  stop: '<path d="M20 20h24v24H20z"/><path d="M27 27h10v10H27z" opacity=".35"/>',
  attack: '<path d="M12 52l28-28M40 24l8-8 4 4-8 8M12 12l8 8M52 52l-9-9M15 49l-4 4M49 49l4 4"/><path d="M34 16l14 14" opacity=".6"/>',
  attackMove: '<path d="M11 43l20-20M31 23l8-8 4 4-8 8"/><path d="M44 22v25M44 22l-6 6M44 22l6 6M13 54l8-8"/>',
  gather: '<path d="M12 40c12-15 28-17 42-7-2 14-17 22-30 16z"/><circle cx="27" cy="33" r="5"/><path d="M48 12l5 5M51 9l5 5"/>',
  lumber: '<path d="M16 44l28-28M44 16l7-7 7 7-7 7M16 44l-7 7M21 26l13 13"/><path d="M12 51l8-8" opacity=".5"/>',
  build: '<path d="M20 40L42 18l8 8-22 22z"/><path d="M15 45l-5 8 8 8 8-5M39 15l10 10M12 50l8 8" /><path d="M44 40l8 8-8 8" opacity=".3"/>',
  cancel: '<circle cx="32" cy="32" r="22" opacity=".35"/><path d="M23 23l18 18M41 23L23 41"/>',
  rally: '<path d="M18 56V8M18 10h27l-6 9 6 9H18"/>',
  gold: '<ellipse cx="32" cy="38" rx="19" ry="9"/><path d="M13 38V26c0-5 8-9 19-9s19 4 19 9v12c0 5-8 9-19 9s-19-4-19-9z"/><circle cx="32" cy="32" r="7" opacity=".5"/><path d="M24 29h16M28 35h8" opacity=".6"/>',
  supply: '<path d="M14 40c2-9 8-14 17-14 10 0 17 6 19 16"/><path d="M12 45h40M18 45v9M42 45v9" /><circle cx="47" cy="22" r="6"/><path d="M38 54h18"/>',
  house: '<path d="M10 31L32 12l22 19"/><path d="M16 30v26h32V30M27 56V40h10v16"/>',
  tower: '<path d="M20 56V20h24v36M14 56h36M17 20l-3-9h12l2 8M35 19l2-8h12l-3 9"/><path d="M27 31h10v11H27z"/>',
  temple: '<path d="M32 6l6 15M32 8l-6 14M13 56V31l19-13 19 13v25M18 56V75M46 56V75M8 56h48M25 55V40h14v15"/>',
  barracks: '<path d="M10 56V29l22-15 22 15v27M17 56V37h11v19M38 33h9v10h-9z"/><path d="M44 12v-7h12v12h-6"/>',
  farm: '<path d="M10 35L32 16l22 19v21H10z"/><path d="M20 56V41h9v15M38 34h7v8h-7M46 17V9h6v10"/><path d="M4 56h56"/>',
  special: '<path d="M32 8l7 12 13-4-4 13 12 7-12 7 4 13-13-4-7 12-7-12-13 4 4-13-12-7 12-7-4-13 13 4z"/><circle cx="32" cy="36" r="9"/>',
  skull: '<path d="M32 7c-13 0-21 9-21 21 0 8 4 13 10 16v9h22v-9c6-3 10-8 10-16 0-12-8-21-21-21z"/><circle cx="23" cy="31" r="5" fill="currentColor"/><circle cx="41" cy="31" r="5" fill="currentColor"/><path d="M28 45h8M24 56v6M32 56v7M40 56v6"/>',
  lion: '<path d="M32 6l24 9v18c0 13-10 22-24 26C18 55 8 46 8 33V15z"/><path d="M19 25l5-6 4 4 4-7 4 7 4-4 5 6M21 38c2 8 7 12 11 12s9-4 11-12"/><path d="M26 37h.1M38 37h.1M32 42v4" /><path d="M17 19l4-7 4 3 3-6 4 6 4-3 4 7" opacity=".5"/>',
  horde: '<path d="M32 4l6 8 10-4 1 11 10 5-7 9 4 11-11 1-5 10-8-7-8 7-5-10-11-1 4-11-7-9 10-5 1-11 10 4z"/><path d="M20 27l8 7M44 27l-8 7M25 44c4 3 10 3 14 0M29 36h6"/><path d="M32 15v12" opacity=".5"/>',
  sword: '<path d="M32 4l6 8v24l-6 7-6-7V12zM20 38h24M32 43v11M24 58h16"/>',
  bow: '<path d="M17 9c22 12 22 34 0 46M17 9l-5 8M17 55l-5-8M20 32h32M44 26l9 6-9 6"/>',
  horse: '<path d="M18 54l6-18c2-7 8-11 15-11l7 1 4-9 6 3-2 8 5 8-7 7-3 18M27 36l-8 7M42 39l8 5M23 54h-8M46 54h8"/>',
  staff: '<path d="M27 57L43 25M43 17c8 0 10 10 2 14-7 3-12-6-7-10 2-2 3-4 5-4zM19 58h18"/>',
  priest: '<path d="M32 7v34M16 20h32"/><path d="M16 50c0-8 7-13 16-13s16 5 16 13v7H16z"/><circle cx="32" cy="17" r="7" opacity=".35"/>',
  pawn: '<circle cx="32" cy="17" r="9"/><path d="M20 55c0-14 5-23 12-23s12 9 12 23M16 58h32"/>',
  flag: '<path d="M16 57V5M16 8h33l-6 10 6 10H16"/>',
  sound: '<path d="M10 25h10L34 13v38L20 39H10zM42 23c4 5 4 13 0 18M48 16c9 9 9 23 0 32"/>',
  mute: '<path d="M10 25h10L34 13v38L20 39H10zM43 24l14 16M57 24L43 40"/>',
  pause: '<path d="M22 12h7v40h-7zM37 12h7v40h-7z"/>',
  play: '<path d="M20 10l32 22-32 22z"/>',
  menu: '<path d="M10 17h44M10 32h44M10 47h44"/>',
  restart: '<path d="M16 18A23 23 0 1 1 10 35"/><path d="M16 8v12H4"/>',
  home: '<path d="M10 31L32 12l22 19M16 30v26h32V30M27 56V40h10v16"/>',
  help: '<circle cx="32" cy="32" r="24"/><path d="M24 24c1-6 5-9 11-9 7 0 11 4 11 10 0 7-9 9-11 15M32 47v2"/>',
  eye: '<path d="M6 32c7-10 16-15 26-15s19 5 26 15c-7 10-16 15-26 15S13 42 6 32z"/><circle cx="32" cy="32" r="8"/>',
  shield: '<path d="M32 5l22 8v16c0 13-9 23-22 29C19 52 10 42 10 30V13z"/><path d="M32 15v28" opacity=".4"/>',
  axe: '<path d="M18 56L46 16M34 8c12 0 20 8 22 20-10 2-18-4-22-20zM20 28l8 12" />',
  claw: '<path d="M12 12c12 7 17 17 20 36M25 8c10 8 15 19 17 38M38 7c8 10 11 22 12 37M8 43c10 3 19 2 26-1"/>',
  boot: '<path d="M15 10h16v24l14 8v10H15zM15 44h30" /><path d="M15 29h16" opacity=".4"/>',
  coin: '<circle cx="32" cy="32" r="22"/><path d="M32 15v34M24 23h16M24 41h16" opacity=".6"/>',
  log: '<path d="M10 45c0-5 10-9 22-9s22 4 22 9v2c0 5-10 9-22 9s-22-4-22-9z"/><path d="M10 45c0 5 10 9 22 9s22-4 22-9M54 45V31c0-5-10-9-22-9s-22 4-22 9v14M24 30c0 3 4 5 8 5s8-2 8-5-4-5-8-5-8 2-8 5z"/>',
  target: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="3" fill="currentColor"/>',
  stats: '<path d="M10 52V32M24 52V20M38 52V27M52 52V10"/><path d="M6 56h50"/>',
  arrow: '<path d="M8 32h48M32 8l24 24-24 24"/>',
};

export function icon(name, className = '') {
  const body = P[name] || P.help;
  return `<svg class="ico ${className}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function crest(race, className = '') {
  const body = race === 'human' ? P.lion : race === 'orc' ? P.horde : P.skull;
  return `<svg class="crest ${className}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
