const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const ui = {
  chapter: $('chapterLabel'), kicker: $('chapterKicker'), title: $('levelTitle'), steps: $('turnCount'),
  objective: $('objectiveLabel'), objectiveState: $('objectiveState'), story: $('storyText'), clue: $('clueText'),
  journal: $('journalList'), evidence: $('evidenceCount'), track: $('chapterTrack'), stars: $('starCount'),
  outfit: $('outfitStatus'), toast: $('toast'), modal: $('modalBackdrop'), modalTitle: $('modalTitle'),
  ending: $('endingText'), stats: $('endingStats'),
};

const chapters = [
  { name: 'The Forgotten Expedition', kicker: 'CHAPTER 01 · THE DIG SITE', title: 'The Buried Threshold', theme: 'sand',
    story: 'Evelyn reaches Adrian Vale’s abandoned camp as the wind starts to carry a metallic hum beneath the sand. His notes end mid-sentence; fresh fingerprints mark a map to the first seal.',
    quote: '“The truth lies beneath the silence.”', mechanism: 'Turn the sundial',
    start: [1, 1], relic: [2, 6], switch: [6, 6], exit: [7, 1], clues: [[2, 1], [5, 6]], pits: [[4, 3], [4, 4], [1, 5]], blocks: [[3, 3], [3, 4], [5, 2]], patrol: [[5, 4], [6, 4], [7, 4], [6, 4]],
    journal: 'Adrian’s map bears the seal of an expedition that officially never existed.' },
  { name: 'Temple of Echoes', kicker: 'CHAPTER 02 · THE RESONANT HALLS', title: 'A Choir of Stone', theme: 'echo',
    story: 'The temple answers every footfall with a second, delayed sound. In a chamber of tuned stone, Evelyn finds Adrian’s initials beside a warning: “Do not trust the first voice.”',
    quote: '“Listen for the note that arrives alone.”', mechanism: 'Tune the resonator',
    start: [1, 7], relic: [6, 1], switch: [2, 2], exit: [7, 7], clues: [[2, 7], [6, 6]], pits: [[3, 3], [4, 3], [5, 3]], blocks: [[3, 5], [4, 5], [5, 5]], patrol: [[4, 1], [4, 2], [4, 3], [4, 2]],
    journal: 'The resonator repeats a voiceprint matching Adrian’s last transmission.' },
  { name: 'The Sunken City', kicker: 'CHAPTER 03 · BELOW THE TIDE', title: 'The Drowned Meridian', theme: 'tide',
    story: 'A drowned avenue opens below the waterline. The city’s ancient floodworks still turn, and the rising tide is uncovering a route that should not be there.',
    quote: '“The water remembers every door.”', mechanism: 'Set the floodwheel',
    start: [1, 1], relic: [6, 6], switch: [2, 6], exit: [7, 1], clues: [[2, 1], [6, 5]], pits: [[3, 2], [3, 3], [3, 4]], blocks: [[5, 3], [5, 4], [5, 5]], patrol: [[4, 6], [5, 6], [6, 6], [5, 6]],
    journal: 'A brass registry lists the city’s final evacuation—and Adrian’s name, written centuries too early.' },
  { name: 'The Library of Shadows', kicker: 'CHAPTER 04 · THE SEALED ARCHIVE', title: 'Margins of Silence', theme: 'archive',
    story: 'The forbidden stacks contain no books, only their shadows pressed into the walls. A ledger fragment suggests the Society of Silence edited history long before Adrian began investigating it.',
    quote: '“An omission is still a kind of signature.”', mechanism: 'Align the archive mirror',
    start: [1, 7], relic: [6, 2], switch: [2, 5], exit: [7, 1], clues: [[2, 7], [6, 3]], pits: [[4, 2], [4, 3], [4, 4]], blocks: [[3, 5], [4, 5], [5, 5]], patrol: [[6, 5], [6, 6], [6, 7], [6, 6]],
    journal: 'The ledger calls the Society’s mission “preservation,” then crosses out the word and writes “control.”' },
  { name: 'The Lost Sanctuary', kicker: 'CHAPTER 05 · THE LAST WITNESS', title: 'The Name Beneath', theme: 'sanctuary',
    story: 'At the sanctuary’s heart, Evelyn finds Adrian alive behind a veil of light. He has been hiding from the Society—not to protect a treasure, but to keep the names of its victims from being erased.',
    quote: '“A name survives when someone chooses to remember.”', mechanism: 'Unbind the final seal',
    start: [1, 7], relic: [6, 5], switch: [2, 2], exit: [7, 1], clues: [[2, 7], [6, 2]], pits: [[3, 4], [4, 4], [5, 4]], blocks: [[3, 2], [4, 2], [5, 2]], patrol: [[5, 6], [6, 6], [7, 6], [6, 6]],
    journal: 'Adrian’s final note names the Society’s founder: the expedition’s own celebrated benefactor.' },
];

const state = { index: 0, steps: 0, totalSteps: 0, found: new Set(), completed: new Set(), toastTimer: 0, gameWon: false };
let level;
const themes = {
  sand: ['#30342c', '#37382d', '#a88d58'], echo: ['#263535', '#2b3b3a', '#76aaa0'],
  tide: ['#20343a', '#263b40', '#68aeb0'], archive: ['#302d38', '#383440', '#a18cbd'],
  sanctuary: ['#333329', '#3a382a', '#d2bd75'],
};

function beginLevel(index, keepProgress = true) {
  state.index = index;
  state.steps = 0;
  state.gameWon = false;
  const c = chapters[index];
  level = { player: [...c.start], relicTaken: false, mechanismOn: false, patrolIndex: 0, enemy: [...c.patrol[0]] };
  ui.modal.classList.add('hidden');
  updateUI();
  render();
  if (!keepProgress) toast('The expedition begins again. Your evidence is retained.');
}
function updateUI() {
  const c = chapters[state.index];
  ui.chapter.textContent = c.name;
  ui.kicker.textContent = c.kicker;
  ui.title.textContent = c.title;
  ui.steps.textContent = state.steps;
  ui.story.textContent = c.story;
  ui.clue.textContent = c.quote;
  ui.evidence.textContent = `${state.found.size} / 10`;
  ui.stars.textContent = `${state.completed.size} / 5 seals`;
  ui.outfit.textContent = state.found.size >= 8 ? 'Vale field coat' : state.found.size >= 4 ? 'Trailblazer kit' : 'Field kit';
  ui.objectiveState.textContent = level.mechanismOn ? 'EXIT UNSEALED' : level.relicTaken ? 'MECHANISM NEEDED' : 'IN PROGRESS';
  ui.objective.textContent = level.mechanismOn ? 'The seal is open. Reach the marked exit.' : level.relicTaken ? `Use E beside the mechanism: ${c.mechanism.toLowerCase()}.` : 'Recover the artifact, then activate the chamber mechanism.';
  ui.journal.replaceChildren();
  const entries = [`Field note ${state.index + 1}: ${c.journal}`];
  if (level.relicTaken) entries.push('Artifact recovered. The chamber mechanism can now be operated.');
  if (level.mechanismOn) entries.push(`${c.mechanism} activated; the exit is open.`);
  for (const [i, note] of entries.entries()) {
    const li = document.createElement('li'); li.textContent = note; if (i === 0) li.className = 'journal-entry'; ui.journal.append(li);
  }
  ui.track.replaceChildren();
  chapters.forEach((chapter, i) => {
    const item = document.createElement('span'); item.className = `track-step${state.completed.has(i) ? ' complete' : ''}${i === state.index ? ' current' : ''}`;
    item.title = chapter.name; item.textContent = state.completed.has(i) ? '✓' : String(i + 1); ui.track.append(item);
  });
}
function toast(message) {
  ui.toast.textContent = message; ui.toast.classList.add('show');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
}
function same(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function distance(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function inArray(list, p) { return list.some(([x, y]) => x === p[0] && y === p[1]); }
function move(dx, dy) {
  if (!level || state.gameWon) return;
  const c = chapters[state.index], next = [level.player[0] + dx, level.player[1] + dy];
  if (next[0] < 0 || next[1] < 0 || next[0] > 8 || next[1] > 8 || next[0] === 0 || next[1] === 0 || next[0] === 8 || next[1] === 8 || inArray(c.blocks, next)) { toast('Solid stone blocks the way.'); return; }
  if (inArray(c.pits, next)) { toast('A broken tile gives way. Find another route.'); return; }
  if (same(next, c.exit) && (!level.relicTaken || !level.mechanismOn)) { toast(!level.relicTaken ? 'The exit seal needs the artifact.' : 'The mechanism is still dormant.'); return; }
  if (same(next, level.enemy)) { toast('A sentinel bars the tile. Let its patrol pass.'); return; }
  level.player = next; state.steps++; state.totalSteps++; ui.steps.textContent = state.steps;
  if (same(next, c.relic)) { level.relicTaken = true; toast('Artifact recovered. The mechanism is waiting.'); }
  c.clues.forEach((p, i) => {
    const id = `${state.index}-${i}`;
    if (same(next, p) && !state.found.has(id)) { state.found.add(id); toast('Evidence recorded in Evelyn’s field journal.'); }
  });
  advanceSentinel();
  if (same(level.player, level.enemy)) {
    level.player = [...c.start]; toast('The sentinel catches your trail. Evelyn retreats to the entrance.');
  }
  updateUI();
  if (same(level.player, c.exit) && level.relicTaken && level.mechanismOn) completeLevel();
  render();
}
function advanceSentinel() {
  const c = chapters[state.index];
  level.patrolIndex = (level.patrolIndex + 1) % c.patrol.length;
  const target = c.patrol[level.patrolIndex];
  if (!inArray(c.blocks, target) && !inArray(c.pits, target) && !same(target, chapters[state.index].exit)) level.enemy = [...target];
}
function interact() {
  if (!level || state.gameWon) return;
  const c = chapters[state.index];
  if (!level.relicTaken) { toast('The mechanism is sealed. Find the artifact first.'); return; }
  if (distance(level.player, c.switch) <= 1) {
    if (level.mechanismOn) toast('The mechanism is already engaged.');
    else { level.mechanismOn = true; toast(`${c.mechanism}: the exit seal releases.`); updateUI(); render(); }
  } else toast(`Move beside the mechanism to ${c.mechanism.toLowerCase()}, then press E.`);
}
function completeLevel() {
  const done = state.index;
  state.completed.add(done);
  if (done === chapters.length - 1) { finishGame(); return; }
  toast('Seal recovered. A new passage opens…');
  window.setTimeout(() => beginLevel(done + 1), 650);
}
function finishGame() {
  state.gameWon = true;
  ui.modalTitle.textContent = 'The truth was never buried.';
  ui.ending.textContent = 'Evelyn finds Adrian alive, and the truth behind his disappearance: the Society of Silence erased the lost civilization to hide its own founding crime. Together, they carry the names of its people back into the light. The final seal is not a treasure—it is a record, and now the world can read it.';
  ui.stats.textContent = `${state.found.size} / 10 evidence · ${state.totalSteps} steps · ${state.completed.size} / 5 seals recovered`;
  ui.modal.classList.remove('hidden');
  updateUI();
}
function restart() { beginLevel(state.index); toast('This chamber has been reset.'); }
function draw() {
  const c = chapters[state.index];
  const cell = Math.floor(Math.min(canvas.width, canvas.height) / 9), ox = Math.floor((canvas.width - cell * 9) / 2), oy = Math.floor((canvas.height - cell * 9) / 2);
  const [base, alt, accent] = themes[c.theme];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111817'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const px = ox + x * cell, py = oy + y * cell;
    ctx.fillStyle = (x + y) % 2 ? base : alt; ctx.fillRect(px, py, cell, cell);
    ctx.strokeStyle = '#d1c9a20c'; ctx.strokeRect(px + .5, py + .5, cell - 1, cell - 1);
    if (x === 0 || y === 0 || x === 8 || y === 8 || inArray(c.blocks, [x, y])) {
      ctx.fillStyle = '#101615'; ctx.fillRect(px + 3, py + 3, cell - 6, cell - 6);
      ctx.strokeStyle = '#9b8c6455'; ctx.strokeRect(px + 5, py + 5, cell - 10, cell - 10);
      ctx.fillStyle = '#d1bd7740'; ctx.font = `${Math.max(9, cell * .2)}px serif`; ctx.fillText('✳', px + cell * .39, py + cell * .61);
    }
    if (inArray(c.pits, [x, y])) {
      ctx.fillStyle = '#101819'; ctx.beginPath(); ctx.ellipse(px + cell / 2, py + cell / 2, cell * .34, cell * .28, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `${accent}88`; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  function seal(p, glyph, color, radius = .28) {
    const x = ox + (p[0] + .5) * cell, y = oy + (p[1] + .5) * cell;
    ctx.fillStyle = color + '2a'; ctx.beginPath(); ctx.arc(x, y, cell * radius * 1.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.font = `bold ${cell * radius * 1.6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, y + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
  if (!level.relicTaken) seal(c.relic, '✦', '#f1d58a', .28);
  c.clues.forEach((p, i) => { if (!state.found.has(`${state.index}-${i}`)) seal(p, '⌕', '#b9d1a5', .19); });
  seal(c.switch, level.mechanismOn ? '◉' : '◎', level.mechanismOn ? '#b7d0a6' : '#dbb36d', .25);
  seal(c.exit, level.mechanismOn && level.relicTaken ? '⌑' : '▣', level.mechanismOn && level.relicTaken ? '#b7d0a6' : '#bd765e', .3);
  seal(level.enemy, '◆', '#de806b', .24);
  seal(level.player, 'E', '#e8e4d4', .27);
}
function render() { if (level) draw(); }
function keydown(event) {
  const key = event.key.toLowerCase();
  const directions = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
  if (directions[key]) { event.preventDefault(); move(...directions[key]); }
  else if (key === 'e') { event.preventDefault(); interact(); }
  else if (key === 'r') { event.preventDefault(); restart(); }
}

document.addEventListener('keydown', keydown);
document.querySelectorAll('[data-move]').forEach((button) => {
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  button.addEventListener('click', () => move(...vectors[button.dataset.move]));
});
$('interactBtn').addEventListener('click', interact);
$('restartBtn').addEventListener('click', restart);
$('journalToggle').addEventListener('click', (event) => {
  const hidden = $('sidebar').classList.toggle('hidden');
  event.currentTarget.setAttribute('aria-expanded', String(!hidden));
});
$('playAgainBtn').addEventListener('click', () => {
  state.found.clear(); state.completed.clear(); state.totalSteps = 0; beginLevel(0); toast('A fresh expedition begins.');
});
window.addEventListener('resize', render);
beginLevel(0);
