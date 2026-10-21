// Persistent progress in localStorage (best effort — the game still works without it).

const KEY = 'cannonball-save-v1';

export function defaults() {
  return {
    scrap: 0,
    unlocked: 0, // highest stage index the player may enter
    stars: {}, // stageIndex -> 1..3
    upgrades: {},
    ammo: { iron: true },
    settings: { sfx: true, music: true, shake: true, aim: 'sling' },
    endlessBest: 0,
    seenIntro: false,
    beaten: false,
    kills: 0,
  };
}

export function load() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, ammo: { ...d.ammo, ...(s.ammo || {}) } };
  } catch {
    return d;
  }
}

export function store(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

export function wipe() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
