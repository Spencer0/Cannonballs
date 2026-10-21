// Fully synthesized sound effects and a procedural war-drum soundtrack (Web Audio).

let ctx = null;
let sfxBus, musicBus, noiseBuf, distCurve, engine = null;
const settings = { sfx: true, music: true };
let musicLevel = -1, musicTimer = null, nextTime = 0, step = 0, tempo = 120;
let lastPlay = {};

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfx ? 0.9 : 0;
  sfxBus.connect(comp);
  musicBus = ctx.createGain();
  musicBus.gain.value = settings.music ? 0.42 : 0;
  musicBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  distCurve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    distCurve[i] = ((3 + 30) * x * 20 * (Math.PI / 180)) / (Math.PI + 30 * Math.abs(x));
  }
  if (musicLevel >= 0) startScheduler();
}

export function setAudioSettings(s) {
  settings.sfx = s.sfx;
  settings.music = s.music;
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(s.sfx ? 0.9 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(s.music ? 0.42 : 0, ctx.currentTime, 0.05);
}

export function suspend(on) {
  if (!ctx) return;
  if (on) ctx.suspend();
  else ctx.resume();
}

// Rate-limit identical sounds so a chain of explosions doesn't clip.
function gate(name, ms) {
  const now = performance.now();
  if (lastPlay[name] && now - lastPlay[name] < ms) return false;
  lastPlay[name] = now;
  return true;
}

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function noise(dest, t, dur, type, f0, f1, peak, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.004, peak, dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

function tone(dest, t, dur, type, f0, f1, peak, dist = false) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.005, peak, dur);
  if (dist) {
    const ws = ctx.createWaveShaper();
    ws.curve = distCurve;
    o.connect(ws).connect(g);
  } else o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const rawSfx = {
  fire(heavy = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, heavy ? 0.5 : 0.3, 'sine', heavy ? 110 : 150, 35, 0.9);
    noise(sfxBus, t, heavy ? 0.6 : 0.35, 'lowpass', 2400, 150, heavy ? 0.9 : 0.6);
  },
  boom(size = 1) {
    if (!ctx || !gate('boom', 45)) return;
    const t = ctx.currentTime;
    const d = 0.35 + size * 0.5;
    noise(sfxBus, t, d, 'lowpass', 600 + size * 900, 60, Math.min(1, 0.4 + size * 0.35));
    tone(sfxBus, t, d * 0.8, 'sine', 90, 28, Math.min(0.9, 0.3 + size * 0.3));
  },
  hit() {
    if (!ctx || !gate('hit', 30)) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, 0.09, 'square', 420, 140, 0.12);
    noise(sfxBus, t, 0.07, 'bandpass', 3000, 1500, 0.2, 3);
  },
  clank() {
    if (!ctx || !gate('clank', 40)) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, 0.12, 'triangle', 1200, 700, 0.18);
    tone(sfxBus, t, 0.2, 'square', 240, 180, 0.06);
  },
  hurt() {
    if (!ctx || !gate('hurt', 90)) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, 0.35, 'sawtooth', 160, 50, 0.35, true);
    noise(sfxBus, t, 0.3, 'lowpass', 1800, 200, 0.5);
  },
  pickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => tone(sfxBus, t + i * 0.06, 0.12, 'triangle', f, f, 0.2));
  },
  click() {
    if (!ctx) return;
    tone(sfxBus, ctx.currentTime, 0.05, 'square', 520, 380, 0.08);
  },
  reload() {
    if (!ctx || !gate('reload', 100)) return;
    const t = ctx.currentTime;
    noise(sfxBus, t, 0.04, 'bandpass', 2500, 2000, 0.15, 4);
    noise(sfxBus, t + 0.08, 0.05, 'bandpass', 1600, 1200, 0.18, 4);
  },
  special() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, 0.8, 'sawtooth', 90, 900, 0.25, true);
    noise(sfxBus, t, 0.9, 'highpass', 300, 3000, 0.4);
    tone(sfxBus, t, 0.5, 'sine', 120, 30, 1);
  },
  armed() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [220, 330, 440, 660].forEach((f, i) => tone(sfxBus, t + i * 0.07, 0.18, 'sawtooth', f, f, 0.12, true));
  },
  roar() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(sfxBus, t, 1.6, 'sawtooth', 70, 38, 0.45, true);
    tone(sfxBus, t, 1.6, 'sawtooth', 73, 40, 0.35, true);
    noise(sfxBus, t, 1.4, 'lowpass', 900, 100, 0.5);
  },
  victory() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [330, 392, 494, 659, 784].forEach((f, i) => tone(sfxBus, t + i * 0.11, 0.35, 'sawtooth', f, f, 0.14, true));
  },
  defeat() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [330, 294, 247, 165].forEach((f, i) => tone(sfxBus, t + i * 0.22, 0.45, 'sawtooth', f, f * 0.97, 0.16, true));
  },
};

// While only the title-screen demo runs, its explosions stay silent.
let quiet = false;
const noop = () => {};
export function setQuiet(q) {
  quiet = q;
}
const QUIETABLE = new Set(['fire', 'boom', 'hit', 'clank', 'reload']);
export const sfx = new Proxy(rawSfx, { get: (t, k) => (quiet && QUIETABLE.has(k) ? noop : t[k]) });

// Low engine drone while driving.
export function engineOn(on) {
  if (!ctx) return;
  if (on && !engine) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 42;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lg = ctx.createGain();
    lg.gain.value = 4;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.07, ctx.currentTime, 0.3);
    o.connect(f).connect(g).connect(sfxBus);
    o.start();
    lfo.start();
    engine = { o, lfo, g };
  } else if (!on && engine) {
    const e = engine;
    engine = null;
    e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { e.o.stop(); e.lfo.stop(); }, 800);
  }
}

// ---------------- Music ----------------
// level 0: menu, 1: battle, 2: boss
const PAT = {
  kick: ['x.......x.......', 'x..x..x.x..x....', 'x.x.x..xx.x.x..x'],
  snare: ['........x.......', '....x.......x...', '....x.......x..x'],
  hat: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'],
  bass: ['x...............', 'x.xx..x.x.xx..x.', 'xxx.xx.xxxx.xx.x'],
};
const ROOTS = [
  [82.41, 82.41, 98.0, 73.42],
  [82.41, 82.41, 98.0, 110.0],
  [82.41, 87.31, 82.41, 116.54],
];

export function playMusic(level) {
  if (level === musicLevel) return;
  musicLevel = level;
  tempo = [92, 126, 142][level];
  if (ctx) startScheduler();
}

function startScheduler() {
  if (musicTimer) return;
  nextTime = ctx.currentTime + 0.06;
  step = 0;
  musicTimer = setInterval(schedule, 25);
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.12) {
    playStep(step, nextTime);
    nextTime += 60 / tempo / 4;
    step = (step + 1) % 64;
  }
}

function playStep(s, t) {
  const L = musicLevel;
  const i = s % 16;
  const bar = Math.floor(s / 16);
  const sl = 60 / tempo / 4;
  const fill = bar === 3 && i >= 12 && L > 0;
  if (fill) {
    const f = [210, 180, 150, 120][i - 12];
    tone(musicBus, t, 0.25, 'sine', f, f * 0.5, 0.7);
    noise(musicBus, t, 0.08, 'lowpass', 1200, 300, 0.25);
  } else {
    if (PAT.kick[L][i] === 'x') tone(musicBus, t, 0.22, 'sine', 140, 40, 1);
    if (PAT.snare[L][i] === 'x') {
      noise(musicBus, t, 0.16, 'highpass', 1200, 900, 0.45);
      tone(musicBus, t, 0.1, 'triangle', 190, 150, 0.25);
    }
    if (L === 0 && (i === 4 || i === 12)) tone(musicBus, t, 0.4, 'sine', 110, 70, 0.45);
  }
  if (PAT.hat[L][i] === 'x') noise(musicBus, t, 0.03, 'highpass', 7000, 6000, i % 4 === 0 ? 0.12 : 0.07);
  if (PAT.bass[L][i] === 'x') {
    let f = ROOTS[L][bar];
    if (L > 0 && (i === 6 || i === 14)) f *= 2;
    const dur = L === 0 ? sl * 14 : sl * 1.7;
    tone(musicBus, t, dur, 'sawtooth', f, f, L === 0 ? 0.12 : 0.18, true);
  }
  // Power-chord stabs on the boss track, guitar-on-a-truck style.
  if (L === 2 && (i === 0 || i === 10)) {
    const f = ROOTS[2][bar] * 2;
    tone(musicBus, t, sl * 3, 'sawtooth', f, f, 0.09, true);
    tone(musicBus, t, sl * 3, 'sawtooth', f * 1.498, f * 1.498, 0.07, true);
  }
}
