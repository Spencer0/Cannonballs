// Boot, main loop, scene flow and input wiring.

import { Battle } from './battle.js';
import { UI } from './ui.js';
import * as Save from './save.js';
import { initAudio, setAudioSettings, playMusic, suspend, engineOn, setQuiet } from './audio.js';
import { STAGES, ENDLESS } from './data.js';

const MINW = 600;
const MINH = 420;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const view = { W: MINW, H: MINH, GY: 320, scale: 1, dpr: 1 };

let save = Save.load();
let battle = null; // the active (player) battle
let demo = null; // attract-mode battle behind the menus
let paused = false;
let current = null; // { index } or { endless: true }
let lastInfo = null;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // portrait phones get a slightly tighter camera so the action isn't tiny
  const minW = h > w ? 540 : MINW;
  const scale = Math.min(w / minW, h / MINH);
  view.scale = scale;
  view.W = w / scale;
  view.H = h / scale;
  view.GY = view.H - (view.H > view.W ? view.H * 0.3 : Math.max(100, view.H * 0.24));
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * view.dpr);
  canvas.height = Math.round(h * view.dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}
window.addEventListener('resize', resize);
resize();

function persist() {
  Save.store(save);
}

function applySettings() {
  setAudioSettings(save.settings);
  persist();
  if (battle) {
    battle.aimMode = save.settings.aim;
    battle.shakeOn = save.settings.shake;
  }
}

function makeDemo() {
  const region = Math.min(2, Math.floor(save.unlocked / 4));
  demo = new Battle({ stage: { ...STAGES[region * 4], region }, save, view, demo: true });
  setQuiet(true);
}

const api = {
  save: () => save,
  battle: () => battle,
  persist,
  applySettings,
  endlessStage: () => ENDLESS,
  markIntroSeen() {
    save.seenIntro = true;
    persist();
  },
  startStage(i) {
    if (i > save.unlocked || !STAGES[i]) return;
    current = { index: i };
    beginBattle(STAGES[i], i);
  },
  startEndless() {
    current = { endless: true };
    beginBattle(ENDLESS, -1);
  },
  pause() {
    if (!battle || battle.state !== 'play') return;
    paused = true;
    battle.pointerCancel();
    engineOn(false);
    ui.pause();
  },
  resume() {
    paused = false;
    ui.hide();
    if (battle) engineOn(true);
  },
  restart() {
    if (!current) return;
    if (current.endless) api.startEndless();
    else api.startStage(current.index);
  },
  quit() {
    endBattle();
    ui.map();
  },
  resetSave() {
    Save.wipe();
    save = Save.defaults();
    applySettings();
    makeDemo();
  },
};

const ui = new UI(api);

function beginBattle(stage, index) {
  initAudio();
  engineOn(false);
  setQuiet(false);
  paused = false;
  ui.hide();
  battle = new Battle({ stage, stageIndex: index, save, view, onEnd: finishBattle });
  demo = null;
  ui.showHud(true);
}

function endBattle() {
  engineOn(false);
  battle = null;
  paused = false;
  ui.showHud(false);
  makeDemo();
  playMusic(0);
}

function finishBattle(r) {
  const info = { stageIndex: current?.index ?? -1, bonus: 0, total: 0, next: null };
  save.kills += r.kills;
  if (r.endless) {
    info.total = r.scrap + Math.floor(r.meters / 5);
    info.newBest = r.meters > save.endlessBest;
    save.endlessBest = Math.max(save.endlessBest, r.meters);
  } else if (r.won) {
    const i = current.index;
    info.bonus = 40 + 15 * i + 20 * r.stars;
    info.total = r.scrap + info.bonus;
    save.stars[i] = Math.max(save.stars[i] || 0, r.stars);
    const first = save.unlocked <= i;
    save.unlocked = Math.max(save.unlocked, i + 1);
    if (STAGES[i + 1]) info.next = i + 1;
    if (i === STAGES.length - 1 && !save.beaten) {
      save.beaten = true;
      info.ending = true;
    }
    info.firstClear = first;
  } else {
    info.total = Math.floor(r.scrap * 0.6);
  }
  save.scrap += info.total;
  persist();
  lastInfo = info;
  ui.showHud(false);
  engineOn(false);
  playMusic(0);
  if (info.ending) {
    ui.endingStep(0);
  } else ui.result(r, info);
}

// ---------------- Input ----------------
let activePointer = null;
const toLogical = (e) => ({ x: e.clientX / view.scale, y: e.clientY / view.scale });

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (!battle || paused || activePointer !== null) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const p = toLogical(e);
  battle.pointerDown(p.x, p.y);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!battle || e.pointerId !== activePointer) return;
  const p = toLogical(e);
  battle.pointerMove(p.x, p.y);
});
const release = (e, cancel) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (!battle) return;
  if (cancel) battle.pointerCancel();
  else battle.pointerUp();
};
canvas.addEventListener('pointerup', (e) => release(e, false));
canvas.addEventListener('pointercancel', (e) => release(e, true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => initAudio(), { capture: true });

window.addEventListener('keydown', (e) => {
  if (!battle) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (paused) api.resume();
    else api.pause();
    return;
  }
  if (paused) return;
  const keys = { 1: 'iron', 2: 'scatter', 3: 'napalm', 4: 'thunder' };
  if (keys[e.key]) battle.setAmmo(keys[e.key]);
  if (e.key === ' ') {
    battle.toggleArmed();
    e.preventDefault();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    api.pause();
    suspend(true);
  } else suspend(false);
});

// ---------------- Loop ----------------
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const scene = battle || demo;
  if (scene && !(battle && paused)) {
    while (dt > 0) {
      const step = Math.min(dt, 1 / 60);
      scene.update(step);
      dt -= step;
    }
  }
  ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
  if (scene) scene.draw(ctx);
  if (battle) ui.updateHud(battle);
  requestAnimationFrame(frame);
}

applySettings();
makeDemo();
playMusic(0);
ui.title();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// exposed for automated smoke tests
window.__cannonball = { api, view, get battle() { return battle; }, get lastInfo() { return lastInfo; } };
