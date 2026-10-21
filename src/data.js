// Static game data: ammo, upgrades, enemies, regions, stages, story.

export const AMMO = {
  iron: {
    name: 'Iron Ball', short: 'IRON', desc: 'Trusty pig iron. Never runs out.',
    dmg: 10, r: 7, blast: 26, reload: 1, cost: 0, cap: Infinity, color: '#2b2b2b',
  },
  scatter: {
    name: 'Scatter Shot', short: 'SCAT', desc: 'Bursts into 5 hot shards at the top of its arc. Shreds bikers and gyros.',
    dmg: 7, r: 6, blast: 18, reload: 1.15, cost: 180, cap: 6, color: '#6b6f78',
  },
  napalm: {
    name: 'Napalm Pot', short: 'FIRE', desc: 'Shatters into sticky fire that keeps burning on the road.',
    dmg: 8, r: 7, blast: 40, reload: 1.2, cost: 350, cap: 5, color: '#c4471c',
  },
  thunder: {
    name: 'Thunder Keg', short: 'KEG', desc: 'A keg of black powder. Enormous blast, slow to load.',
    dmg: 48, r: 9, blast: 100, reload: 1.9, cost: 600, cap: 3, color: '#7a4b22',
  },
};
export const AMMO_ORDER = ['iron', 'scatter', 'napalm', 'thunder'];

export const UPGRADES = [
  { id: 'armor', name: 'Scrap Plating', desc: '+25 max armor on the rig.', max: 5, base: 60, mult: 1.6 },
  { id: 'reload', name: 'Greased Breech', desc: 'Reload 12% faster.', max: 5, base: 70, mult: 1.6 },
  { id: 'powder', name: 'Black Powder', desc: '+20% cannon damage.', max: 5, base: 80, mult: 1.65 },
  { id: 'blast', name: 'Shrapnel Packing', desc: '+15% blast radius.', max: 4, base: 90, mult: 1.7 },
  { id: 'scope', name: 'Rusty Scope', desc: 'Longer aiming guide.', max: 4, base: 50, mult: 1.6 },
  { id: 'rack', name: 'Ammo Rack', desc: '+1 of every special ammo per run.', max: 4, base: 120, mult: 1.7 },
  { id: 'guts', name: 'Iron Guts', desc: 'Human Cannonball meter fills 25% faster.', max: 4, base: 100, mult: 1.7 },
];

export function upgradeCost(u, level) {
  return Math.round(u.base * Math.pow(u.mult, level) / 5) * 5;
}

// hp: base hit points. dmg: damage dealt to the rig. scrap/meter: rewards.
export const ENEMIES = {
  buggy: { name: 'Rust Buggy', hp: 10, w: 54, h: 30, speed: [70, 105], dmg: 10, scrap: 6, meter: 8, info: 'Rams your rig. Pop it early.' },
  biker: { name: 'War Biker', hp: 7, w: 40, h: 34, speed: [140, 175], dmg: 8, scrap: 8, meter: 9, info: 'Fast. Hurls a thunder-lance at you.' },
  shooter: { name: 'Mortar Wagon', hp: 28, w: 64, h: 40, speed: [55, 75], dmg: 12, scrap: 16, meter: 14, info: 'Parks out of reach and lobs shells. Shoot shells down!' },
  gyro: { name: 'Gyro Raider', hp: 11, w: 52, h: 30, speed: [70, 95], scrap: 12, meter: 12, fly: true, info: 'Flies over and drops bombs.' },
  tank: { name: 'Juggernaut', hp: 75, w: 92, h: 50, speed: [26, 34], dmg: 30, scrap: 34, meter: 26, info: 'Armored brute. Hits like a landslide.' },
  chaser: { name: 'Rear Rat', hp: 12, w: 50, h: 28, speed: [40, 55], dmg: 10, scrap: 10, meter: 10, info: 'Sneaks up from BEHIND and throws firebombs.' },
  tower: { name: 'Sniper Roost', hp: 36, w: 42, h: 120, scrap: 18, meter: 12, static: true, info: 'Roadside tower that shoots as you pass.' },
  spikewall: { name: 'Spike Wall', hp: 26, w: 30, h: 46, dmg: 18, scrap: 6, meter: 5, static: true, info: 'Road block. Smash it before you hit it.' },
  barrel: { name: 'Guzzoline Drum', hp: 4, w: 22, h: 30, scrap: 2, meter: 2, static: true, info: 'Explodes. Blow it up when raiders are close.' },
};

export const BOSSES = {
  behemoth: { name: "RUSTJAW'S BEHEMOTH", title: 'Warlord of the Dust Flats' },
  vulture: { name: 'THE VULTURE QUEEN', title: 'Mistress of Bone Canyon' },
  goliath: { name: 'THE GASOLINE GOLIATH', title: 'Tyrant of the Burning Citadel' },
};

export const REGIONS = [
  {
    name: 'THE DUST FLATS',
    sky: ['#2f6f80', '#d98f4e', '#f7d08a'], sun: '#fff1c9', sunY: 0.32,
    far: '#d49a62', mid: '#b86a3a', near: '#d9a05b', ground: '#c98a4b', groundDark: '#9c6233',
    road: '#7d5233', roadLine: '#e8c48a', prop: '#5a3a24', dust: '#e2b07a', mesa: true,
  },
  {
    name: 'BONE CANYON',
    sky: ['#24183a', '#9c3e5a', '#f0904e'], sun: '#ffd0a0', sunY: 0.55,
    far: '#7a3a46', mid: '#5a2a36', near: '#9a5440', ground: '#8f4c34', groundDark: '#653222',
    road: '#563024', roadLine: '#d9a77a', prop: '#2e1a1c', dust: '#b97a5a', canyon: true,
  },
  {
    name: 'THE BURNING CITADEL',
    sky: ['#07060d', '#35111d', '#c9442a'], sun: '#ff6a3a', sunY: 0.78,
    far: '#2a1218', mid: '#1c0c10', near: '#3a1e18', ground: '#3b2219', groundDark: '#24130e',
    road: '#21130e', roadLine: '#c2683c', prop: '#120a08', dust: '#6a3a2a', night: true, embers: true,
  },
];

export const STAGES = [
  {
    region: 0, name: 'Leaving Gastown', len: 42, rate: 2.5, hpMul: 1,
    spawns: { buggy: 1 }, statics: { barrel: 1 }, staticRate: 9, tutorial: true,
    brief: 'The Iron Mammoth rolls out with the last tank of clean water. Rust buggies already smell it. Drag back and let fly.',
  },
  {
    region: 0, name: 'Rattlesnake Run', len: 52, rate: 2.15, hpMul: 1,
    spawns: { buggy: 3, biker: 2 }, statics: { barrel: 2 }, staticRate: 7,
    brief: "Rustjaw's war bikers ride fast and throw explosive lances. Lead your shots.",
  },
  {
    region: 0, name: 'Spike Alley', len: 58, rate: 2.0, hpMul: 1.05,
    spawns: { buggy: 3, biker: 2, shooter: 1 }, statics: { spikewall: 2, barrel: 1 }, staticRate: 6,
    brief: 'They have walled the road with spikes and parked mortar wagons beyond. Smash a path. Shells can be shot out of the sky.',
  },
  {
    region: 0, name: "Rustjaw's Behemoth", boss: 'behemoth', rate: 5, hpMul: 1.05,
    spawns: { buggy: 2, biker: 1 }, statics: { barrel: 1 }, staticRate: 10,
    brief: 'Rustjaw himself rides a land-whale of welded steel. Blow off its turret and fuel tanks, then crack the cab.',
  },
  {
    region: 1, name: 'Vulture Pass', len: 58, rate: 2.0, hpMul: 1.1,
    spawns: { buggy: 2, biker: 2, gyro: 2 }, statics: { barrel: 1 }, staticRate: 8,
    brief: 'The canyon sky is full of gyro raiders. Aim high — they drop bombs when they pass overhead.',
  },
  {
    region: 1, name: 'The Ossuary', len: 62, rate: 2.1, hpMul: 1.15,
    spawns: { buggy: 2, biker: 2, shooter: 1, gyro: 2 }, statics: { tower: 2, spikewall: 1, barrel: 1 }, staticRate: 6,
    brief: 'A road paved with bones, watched by sniper roosts. Knock the towers down as you pass.',
  },
  {
    region: 1, name: 'Rear Guard', len: 62, rate: 2.05, hpMul: 1.2,
    spawns: { buggy: 2, biker: 2, gyro: 1, chaser: 2, shooter: 1 }, statics: { spikewall: 1, barrel: 1, tower: 1 }, staticRate: 6,
    brief: 'Rear Rats creep up behind the rig. Swing the cannon round — you can fire in ANY direction.',
  },
  {
    region: 1, name: 'The Vulture Queen', boss: 'vulture', rate: 5, hpMul: 1.2,
    spawns: { biker: 1, buggy: 1, chaser: 1 }, statics: { barrel: 1 }, staticRate: 10,
    brief: 'Her sky fortress blots out the sun. Take out both rotor engines to bring her down, then smash the gondola.',
  },
  {
    region: 2, name: 'Oil Fields', len: 62, rate: 2.0, hpMul: 1.25,
    spawns: { buggy: 2, biker: 2, tank: 1, shooter: 1, gyro: 1 }, statics: { barrel: 3, tower: 1 }, staticRate: 5,
    brief: 'Juggernauts guard the derricks. The road is lined with guzzoline drums — use them.',
  },
  {
    region: 2, name: 'Storm of Sand', len: 66, rate: 1.95, hpMul: 1.3, storm: true,
    spawns: { buggy: 3, biker: 3, gyro: 2, chaser: 1, shooter: 1, tank: 1 }, statics: { spikewall: 1, barrel: 2 }, staticRate: 6,
    brief: 'A sandstorm swallows the road. You will see them late. Trust your aim.',
  },
  {
    region: 2, name: 'Gates of Fire', len: 70, rate: 1.85, hpMul: 1.35,
    spawns: { buggy: 3, biker: 3, gyro: 2, chaser: 2, shooter: 2, tank: 1 }, statics: { tower: 2, spikewall: 1, barrel: 2 }, staticRate: 5,
    brief: 'Everything the Citadel has left. Survive the gates and only the Goliath remains.',
  },
  {
    region: 2, name: 'The Gasoline Goliath', boss: 'goliath', rate: 4.5, hpMul: 1.35,
    spawns: { biker: 1, buggy: 1, chaser: 1, gyro: 1 }, statics: { barrel: 1 }, staticRate: 9,
    brief: 'The tyrant\'s fortress-on-wheels: twin turrets, a flamethrower snout, a heart of boiling fuel. End it. Haven waits.',
  },
];

export const STORY = {
  intro: [
    'The world burned. Water became gold. Guzzoline became blood.',
    'They call you CANNONBALL — the man the warlords fired from a siege cannon at the Battle of Rust Hill… who got up, dusted off, and walked away.',
    'Your war rig, the IRON MAMMOTH, hauls the last tank of clean water to the free town of HAVEN.',
    'Three territories. Three warlords. A thousand road-crazed raiders.',
    'Load the cannon.',
  ],
  regions: [
    'THE DUST FLATS — Rustjaw\'s hunting ground. Open road, fast raiders.',
    'BONE CANYON — The Vulture Queen rules the sky between the cliffs.',
    'THE BURNING CITADEL — Oil, fire, and the Gasoline Goliath.',
  ],
  ending: [
    'The Goliath burns behind you, a second sunset on the horizon.',
    'The Iron Mammoth limps through the gates of HAVEN, dented, scorched, and still full of water.',
    'Children run to the tank. Gardens will grow. The road is quiet.',
    'For now.',
    'THANKS FOR PLAYING CANNONBALL. Endless Fury awaits on the map.',
  ],
};

export const ENDLESS = {
  name: 'Endless Fury', region: 0, len: Infinity, rate: 2.2, hpMul: 1, endless: true,
  spawns: { buggy: 3 }, statics: { barrel: 2, spikewall: 1 }, staticRate: 7,
  brief: 'How far can the Iron Mammoth go? The raiders never stop coming. A warlord shows up every 2 minutes.',
};
