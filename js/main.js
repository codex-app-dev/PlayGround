import * as THREE from '../vendor/three.module.js';
import { MAP } from './map.js';
import { RACES } from './data.js';
import { Game } from './game.js';
import { CameraRig } from './camera.js';
import { InputController } from './input.js';
import { UI } from './ui.js';
import { Showcase } from './showcase.js';
import { AudioEngine } from './audio.js';

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'stage-canvas';
stage.appendChild(renderer.domElement);

const audio = new AudioEngine();
const showcase = new Showcase(renderer);
const ui = new UI({
  audio,
  onStart: startGame,
  onMenu: returnToMenu,
  onRematch: rematch,
  onRaceSelect: (race) => showcase.setActive(race),
  onRaceHover: (race) => showcase.setHover(race),
});

let mode = 'menu';
let game = null;
let scene = null;
let camera = null;
let rig = null;
let input = null;
let lastSettings = { race: 'human', difficulty: 'normal' };

const clock = new THREE.Clock();

function chooseAiRace(race) {
  const options = Object.keys(RACES).filter((r) => r !== race);
  return options[Math.floor(Math.random() * options.length)] || 'orc';
}

function startGame(race, difficulty) {
  if (mode === 'loading') return;
  mode = 'loading';
  lastSettings = { race, difficulty };
  ui.showLoading(race);

  // Let the loading veil paint before the heavy world generation begins.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      buildGame(race, difficulty);
    } catch (err) {
      console.error('Failed to start match', err);
      mode = 'menu';
      ui.hideLoading();
      ui.showMenu();
      const title = document.querySelector('#loading-screen .loading-title');
      if (title) title.textContent = 'Не удалось собрать армию';
    }
  }));
}

function buildGame(race, difficulty) {
  if (input) {
    input.setEnabled(false);
    input.dispose?.();
    input = null;
  }
  game = null;
  scene = null;
  camera = null;
  rig = null;

  simAccumulator = 0;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 700);
  game = new Game(scene, {
    playerRace: race,
    aiRace: chooseAiRace(race),
    difficulty,
  });

  rig = new CameraRig(camera, renderer.domElement, game);
  rig.setTarget(MAP.playerBase.x, MAP.playerBase.z, true);
  rig.dist = 60;
  rig.desiredDist = 50;

  input = new InputController(renderer, rig, game, ui, audio);
  input.onPause = () => ui.togglePause();
  input.onHelp = () => ui.openHelp(false);
  input.onEscape = () => ui.pause();

  ui.attachGame(game, rig, input);
  mode = 'game';

  // A short, safe fade from the loading veil into the battlefield.
  setTimeout(() => {
    ui.hideLoading();
    rig.flyTo(MAP.playerBase.x, MAP.playerBase.z, 50, 0.7);
  }, 220);
}

function returnToMenu() {
  if (input) {
    input.setEnabled(false);
    input.dispose?.();
    input = null;
  }
  game = null;
  scene = null;
  camera = null;
  rig = null;
  mode = 'menu';
  ui.showMenu();
  showcase.setLayout(window.innerWidth, window.innerHeight);
  showcase.setActive(ui.menuRace);
  showcase.setHover(null);
}

function rematch() {
  startGame(lastSettings.race, lastSettings.difficulty);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  showcase.setLayout(window.innerWidth, window.innerHeight);
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
}

window.addEventListener('resize', onResize);
showcase.setLayout(window.innerWidth, window.innerHeight);
showcase.setActive('human');

// Simulation runs in small fixed steps so that a slow renderer (or a heavy
// fight) never turns the battle into slow motion. Rendering still happens once
// per animation frame.
const SIM_STEP = 1 / 30;
const MAX_CATCH_UP = 0.5;
let simAccumulator = 0;

function frame() {
  requestAnimationFrame(frame);
  const elapsed = clock.getDelta();
  const dt = Math.min(elapsed, MAX_CATCH_UP);

  if (mode === 'menu' || mode === 'loading') {
    showcase.update(dt);
    showcase.render();
    return;
  }

  if (mode === 'game' && game) {
    simAccumulator = Math.min(simAccumulator + dt, MAX_CATCH_UP);
    let steps = 0;
    while (simAccumulator >= SIM_STEP && steps < 16) {
      game.update(SIM_STEP);
      input?.update(SIM_STEP);
      rig?.update(SIM_STEP);
      simAccumulator -= SIM_STEP;
      steps++;
    }
    ui.update(dt);
    renderer.render(scene, camera);
  }
}

frame();
