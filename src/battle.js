// The battle simulation: the rig, the cannon, raiders, bosses, and everything that explodes.

import { AMMO, AMMO_ORDER, ENEMIES, BOSSES, REGIONS } from './data.js';
import { sfx, playMusic, engineOn } from './audio.js';
import { FX } from './fx.js';
import * as D from './draw.js';

const G = 900;
const ROAD = 130;
const X0 = 46; // rig left edge
const X1 = 218; // rig ram tip
const RIG_TOP = -80;
const PIV = { x: X0 + 52, y: -86 };
const BARREL = 40;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pick(weights) {
  let sum = 0;
  for (const k in weights) sum += weights[k];
  let r = Math.random() * sum;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

function lob(x, y, tx, ty, T) {
  return { vx: (tx - x) / T, vy: (ty - y) / T - 0.5 * G * T };
}

const PROPS = [
  ['wreck', 'tire', 'sign', 'tree', 'wreck'],
  ['skull', 'bones', 'tree', 'wreck', 'skull'],
  ['derrick', 'wreck', 'skull', 'tire', 'derrick'],
];

export class Battle {
  constructor({ stage, stageIndex = -1, save, view, demo = false, onEnd = () => {} }) {
    this.stage = stage;
    this.stageIndex = stageIndex;
    this.demo = demo;
    this.onEnd = onEnd;
    this.R = REGIONS[stage.region];
    this.regionIndex = stage.region;
    this.view = view;
    const up = save.upgrades || {};
    this.maxHp = 100 + 25 * (up.armor || 0);
    this.hp = this.maxHp;
    this.reloadTime = 0.8 * Math.pow(0.88, up.reload || 0);
    this.dmgMul = 1 + 0.2 * (up.powder || 0);
    this.blastMul = 1 + 0.15 * (up.blast || 0);
    this.scopeT = 0.32 + 0.16 * (up.scope || 0);
    this.meterMul = 1 + 0.25 * (up.guts || 0);
    this.aimMode = save.settings.aim;
    this.shakeOn = save.settings.shake;
    this.ammoCount = { iron: Infinity };
    for (const k of AMMO_ORDER) if (k !== 'iron' && save.ammo[k]) this.ammoCount[k] = AMMO[k].cap + (up.rack || 0);
    this.ammo = 'iron';

    this.dmgLog = {};
    this.enemies = [];
    this.shots = [];
    this.hostile = [];
    this.crates = [];
    this.fires = [];
    this.props = [];
    this.pending = [];
    this.fx = new FX();
    this.boss = null;
    this.hero = null;

    this.time = 0;
    this.dist = 0;
    this.speed = ROAD;
    this.scrap = 0;
    this.kills = 0;
    this.meter = 0;
    this.armed = false;
    this.reload = 0;
    this.queued = null;
    this.aim = null;
    this.angle = -0.5;
    this.recoil = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.rigFlash = 0;
    this.slowT = 0;
    this.hitstop = 0;
    this.combo = 0;
    this.comboT = 0;
    this.state = 'play';
    this.endT = 0;
    this.banner = null;
    this.hint = null;
    this.shotsFired = 0;
    this.meterHinted = false;
    this.bossesKilled = 0;
    this.nextBossAt = 120;

    this.spawnT = stage.tutorial ? 3.5 : 2;
    this.staticT = 5;
    this.crateT = rand(14, 20);
    this.propT = 0;
    this.smokeT = 0;
    this.bossDue = !!stage.boss;
    this.bossT = 10;

    for (let i = 0; i < 6; i++) this.addProp(rand(0, view.W));

    if (!demo) {
      if (stage.endless) this.showBanner('ENDLESS FURY', 'Survive as long as you can', 2.6);
      else if (stage.boss) this.showBanner(stage.name.toUpperCase(), 'Warlord ahead!', 2.6);
      else this.showBanner(stage.name.toUpperCase(), this.R.name, 2.6);
      if (stage.tutorial) this.hint = { text: 'DRAG BACK & RELEASE TO FIRE', demo: true };
      playMusic(1);
      engineOn(true);
    }
  }

  get W() { return this.view.W; }
  get GY() { return this.view.GY; }

  showBanner(text, sub = '', dur = 2.2) {
    this.banner = { text, sub, t: 0, dur };
  }

  // ---------------- Input ----------------
  pointerDown(x, y) {
    if (this.state !== 'play' || this.demo) return;
    this.aim = { sx: x, sy: y - this.GY, cx: x, cy: y - this.GY };
  }
  pointerMove(x, y) {
    if (!this.aim) return;
    this.aim.cx = x;
    this.aim.cy = y - this.GY;
  }
  pointerUp() {
    if (!this.aim) return;
    const v = this.aimVector();
    this.aim = null;
    if (v) this.requestFire(v);
  }
  pointerCancel() {
    this.aim = null;
  }

  aimVector() {
    const a = this.aim;
    if (!a) return null;
    let dx, dy, pw;
    if (this.aimMode === 'point') {
      dx = a.cx - PIV.x;
      dy = a.cy - PIV.y;
      const L = Math.hypot(dx, dy);
      if (L < 8) return null;
      pw = clamp(L / 380, 0.12, 1);
    } else {
      dx = a.sx - a.cx;
      dy = a.sy - a.cy;
      const L = Math.hypot(dx, dy);
      if (L < 10) return null;
      pw = Math.min(L, 150) / 150;
    }
    return { angle: Math.atan2(dy, dx), power: 280 + 920 * pw, pw };
  }

  setAmmo(k) {
    if (k === 'iron' || this.ammoCount[k] > 0) {
      this.ammo = k;
      sfx.reload();
    }
  }

  toggleArmed() {
    if (this.meter < 100 || this.hero || this.state !== 'play') return;
    this.armed = !this.armed;
    if (this.armed) sfx.armed();
    else sfx.click();
  }

  requestFire(v) {
    if (this.hero) return;
    if (this.reload > 0 && !this.armed) {
      this.queued = v;
      return;
    }
    this.fire(v);
  }

  muzzle(angle) {
    return { x: PIV.x + Math.cos(angle) * BARREL, y: PIV.y + Math.sin(angle) * BARREL };
  }

  fire(v) {
    const m = this.muzzle(v.angle);
    const vx = Math.cos(v.angle) * v.power;
    const vy = Math.sin(v.angle) * v.power;
    this.angle = v.angle;
    this.recoil = 10;
    this.shotsFired++;
    if (this.hint && this.hint.demo) this.hint = null;
    for (let i = 0; i < 8; i++) this.fx.flame(m.x, m.y, vx * 0.15 + rand(-40, 40), vy * 0.15 + rand(-40, 40), rand(5, 10));
    this.fx.smoke(m.x, m.y, 4, 7, 150, vx * 0.05);
    if (this.armed) {
      this.armed = false;
      this.meter = 0;
      this.hero = { x: m.x, y: m.y, vx: vx * 1.05, vy: vy * 1.05, rot: 0, phase: 'fly', hit: new Set(), t: 0 };
      sfx.special();
      this.slowT = 0.25;
      this.addShake(10);
      return;
    }
    let k = this.ammo;
    if (k !== 'iron' && !(this.ammoCount[k] > 0)) k = this.ammo = 'iron';
    const A = AMMO[k];
    if (k !== 'iron') {
      this.ammoCount[k]--;
      if (this.ammoCount[k] <= 0) this.ammo = 'iron';
    }
    this.shots.push({ kind: k, x: m.x, y: m.y, vx, vy, r: A.r, dmg: A.dmg * this.dmgMul, blast: A.blast * this.blastMul, t: 0, rot: 0, rising: vy < 0 });
    this.reload = this.reloadTime * A.reload;
    sfx.fire(k === 'thunder');
    this.addShake(k === 'thunder' ? 6 : 3);
  }

  addShake(v) {
    if (this.shakeOn) this.shake = Math.min(18, Math.max(this.shake, v));
  }

  // ---------------- Spawning ----------------
  addProp(x) {
    const kinds = PROPS[this.regionIndex];
    const back = Math.random() < 0.6;
    this.props.push({ x, kind: kinds[Math.floor(Math.random() * kinds.length)], back, s: back ? rand(0.6, 0.85) : rand(1.1, 1.5), y: back ? -2 : rand(50, Math.max(60, this.view.H - this.GY - 10)) });
  }

  enemyHpMul() {
    if (this.stage.endless) return 1 + this.time / 150;
    return this.stage.hpMul || 1;
  }

  spawnEnemy(type) {
    const d = ENEMIES[type];
    const W = this.W;
    const hp = d.hp * this.enemyHpMul();
    const e = { type, ...d, hp, maxHp: hp, t: 0, flash: 0, seed: Math.random() * 100, dir: -1, y: 0, vy: 0, fire: rand(0.5, 1.5) };
    if (type === 'chaser') {
      e.x = -40;
      e.dir = 1;
      e.vx = rand(d.speed[0], d.speed[1]);
      e.stopX = rand(6, 18);
      e.fire = 2.2;
      this.showBannerOnce('chaser', 'BEHIND YOU!', 'Rear Rats — swing the cannon back');
    } else if (type === 'gyro') {
      e.x = W + 40;
      e.y = -clamp(this.GY * rand(0.5, 0.8), 160, 380);
      e.baseY = e.y;
      e.vx = -rand(d.speed[0], d.speed[1]);
      e.fire = 0;
    } else if (d.static) {
      e.x = W + 30;
      e.vx = -this.speed;
      e.fire = 0.5;
    } else {
      e.x = W + 50;
      e.vx = -rand(d.speed[0], d.speed[1]);
      if (type === 'shooter') e.stopX = rand(Math.max(X1 + 150, W * 0.6), W - 40);
      if (type === 'biker') e.throwX = rand(X1 + 120, Math.min(W - 40, X1 + 300));
      if (type === 'tank') e.fire = 3;
    }
    this.enemies.push(e);
    return e;
  }

  showBannerOnce(key, text, sub) {
    this.seen = this.seen || {};
    if (this.seen[key]) return;
    this.seen[key] = true;
    this.showBanner(text, sub, 2);
  }

  endlessPool() {
    const t = this.time;
    const p = { buggy: 3, biker: t > 20 ? 2 : 0 };
    if (t > 50) p.gyro = 2;
    if (t > 80) p.shooter = 1;
    if (t > 110) p.chaser = 1.5;
    if (t > 150) p.tank = 1;
    for (const k in p) if (!p[k]) delete p[k];
    return p;
  }

  updateSpawns(dt) {
    if (this.demo || this.state !== 'play') return;
    const st = this.stage;
    const progress = st.len === Infinity ? 0 : this.time / st.len;
    const spawning = st.boss ? true : st.endless ? true : this.time < st.len;
    let rate = st.rate;
    if (st.endless) rate = Math.max(0.85, 2.2 - this.time / 110);
    else rate /= 1 + 0.45 * Math.min(1, progress);
    if (this.boss) rate *= 1.6;

    if (spawning) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const pool = st.endless ? this.endlessPool() : st.spawns;
        let type = pick(pool);
        const count = (k) => this.enemies.filter((e) => e.type === k && !e.dead).length;
        if ((type === 'shooter' && count('shooter') >= 2) || (type === 'tank' && count('tank') >= 1) || (type === 'chaser' && count('chaser') >= 2)) type = 'buggy';
        const active = this.enemies.filter((e) => !e.dead && !e.static).length;
        if (active < 8) this.spawnEnemy(type);
        this.spawnT = rate * rand(0.7, 1.3);
        // occasional pairs later on
        if (progress > 0.5 && Math.random() < 0.25 && active < 6) this.spawnT *= 0.35;
      }
      if (st.statics) {
        this.staticT -= dt;
        if (this.staticT <= 0) {
          this.spawnEnemy(pick(st.statics));
          this.staticT = st.staticRate * rand(0.7, 1.3);
        }
      }
      this.crateT -= dt;
      if (this.crateT <= 0) {
        this.crates.push({ x: rand(Math.max(X1 + 80, this.W * 0.4), this.W - 40), y: -this.GY - 40, vy: 38, flash: 0, landed: false });
        this.crateT = rand(16, 24);
      }
    }

    if (st.boss && this.bossDue) {
      this.bossT -= dt;
      if (this.bossT <= 0) {
        this.bossDue = false;
        this.spawnBoss(st.boss);
      }
    }
    if (st.endless && !this.boss && this.time >= this.nextBossAt) {
      this.nextBossAt = this.time + 120;
      this.spawnBoss(['behemoth', 'vulture', 'goliath'][this.bossesKilled % 3]);
    }
  }

  spawnBoss(kind) {
    const W = this.W;
    const mul = this.enemyHpMul() * (this.stage.endless ? 0.8 : 1);
    const P = (name, ox, oy, r, hp, extra = {}) => ({ name, ox, oy, r, hp: hp * mul, maxHp: hp * mul, flash: 0, ...extra });
    let b;
    if (kind === 'behemoth') {
      const s = Math.min(1, W / 720);
      b = { kind, s, x: W + 200 * s, y: 0, parts: [
        P('turret', -40, -140, 24, 60),
        P('tankA', 20, -71, 27, 45),
        P('tankB', 84, -71, 27, 45),
        P('cab', -118, -108, 30, 90, { vital: true, armoredBy: ['tankA', 'tankB'] }),
      ] };
      b.homeX = W - 165 * s;
    } else if (kind === 'vulture') {
      const s = Math.min(1, W / 640);
      const y = -clamp(this.GY * 0.62, 190, 330);
      b = { kind, s, x: W + 200 * s, y, baseY: y, parts: [
        P('rotorL', -142, 4, 26, 55),
        P('rotorR', 142, 4, 26, 55),
        P('gondola', 0, 78, 36, 110, { vital: true, armoredBy: ['rotorL', 'rotorR'] }),
      ] };
      b.homeX = W * 0.6;
    } else {
      const s = Math.min(1, W / 780);
      b = { kind, s, x: W + 230 * s, y: 0, aims: {}, parts: [
        P('snout', -210, -64, 24, 70),
        P('turretA', -96, -156, 23, 60),
        P('turretB', 60, -156, 23, 60),
        P('boiler', 0, -110, 38, 170, { vital: true, armoredBy: ['turretA', 'turretB'] }),
      ] };
      b.homeX = W - 205 * s;
    }
    Object.assign(b, { t: 0, flash: 0, fire: 3, spawn: 6, phase: 'enter', phaseT: 0, dead: false, ...BOSSES[kind] });
    this.boss = b;
    this.showBanner(b.name, b.title, 3);
    sfx.roar();
    playMusic(2);
    this.addShake(8);
  }

  // ---------------- Damage ----------------
  enemyBox(e) {
    if (e.fly) return { x0: e.x - e.w / 2, y0: e.y - e.h / 2, x1: e.x + e.w / 2, y1: e.y + e.h / 2 };
    return { x0: e.x - e.w / 2, y0: e.y - e.h, x1: e.x + e.w / 2, y1: e.y };
  }

  partPos(b, p) {
    return { x: b.x + p.ox * b.s, y: b.y + p.oy * b.s, r: p.r * b.s };
  }

  partArmored(b, p) {
    return p.armoredBy && p.armoredBy.some((n) => b.parts.find((q) => q.name === n).hp > 0);
  }

  hurtEnemy(e, dmg) {
    if (e.dead || e.falling) return;
    e.hp -= dmg;
    e.flash = 0.07;
    if (e.hp <= 0) this.killEnemy(e);
    else sfx.hit();
  }

  hurtPart(b, p, dmg) {
    if (p.hp <= 0 || b.dead) return;
    if (this.partArmored(b, p)) {
      p.flash = 0.05;
      if (!this.armorMsgT || this.time - this.armorMsgT > 1.2) {
        this.armorMsgT = this.time;
        const pp = this.partPos(b, p);
        this.fx.text(pp.x, pp.y - 20, 'ARMORED!', '#c9c2b5', 16);
        sfx.clank();
      }
      return;
    }
    p.hp -= dmg;
    p.flash = 0.07;
    b.flash = 0.04;
    sfx.hit();
    if (p.hp <= 0) {
      p.hp = 0;
      const pp = this.partPos(b, p);
      this.fx.explosion(pp.x, pp.y, 60);
      sfx.boom(1.5);
      this.addShake(10);
      this.hitstop = 0.08;
      this.reward(pp.x, pp.y, 25, 20);
      if (p.vital) this.killBoss(b);
      else {
        const left = b.parts.filter((q) => !q.vital && q.hp > 0).length;
        if (left === 0) this.showBanner('WEAK POINT EXPOSED!', 'Hit the ' + (b.kind === 'vulture' ? 'gondola' : b.kind === 'goliath' ? 'boiler' : 'cab'), 1.8);
      }
    }
  }

  reward(x, y, scrap, meter) {
    this.scrap += scrap;
    const before = this.meter;
    this.meter = Math.min(100, this.meter + meter * this.meterMul);
    if (before < 100 && this.meter >= 100 && !this.demo && this.state === 'play') {
      this.showBanner('CANNONBALL READY!', 'Tap the skull, then fire YOURSELF', 2);
      sfx.armed();
    }
    this.fx.text(x, y - 10, '+' + scrap, '#ffd36a', 16);
  }

  killEnemy(e) {
    e.dead = true;
    this.kills++;
    const box = this.enemyBox(e);
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    if (e.type === 'gyro') {
      e.dead = false;
      e.falling = true;
      e.vy = -60;
      this.fx.explosion(cx, cy, 24, { debris: false });
      sfx.boom(0.6);
    } else if (e.type === 'barrel') {
      this.pending.push({ t: 0.06, x: cx, y: -16, r: 85 * this.blastMul, dmg: 40, big: true });
    } else {
      const size = e.type === 'tank' ? 70 : e.type === 'tower' ? 55 : e.type === 'shooter' ? 45 : 32;
      this.fx.explosion(cx, cy, size);
      sfx.boom(size / 40);
      this.addShake(size / 8);
      if (e.type === 'tank' || e.type === 'tower') this.hitstop = 0.05;
    }
    // combos for multi-kills
    if (this.comboT > 0) {
      this.combo++;
      if (this.combo >= 2) {
        const bonus = 4 * this.combo;
        this.scrap += bonus;
        this.fx.text(cx, cy - 40, ['', '', 'DOUBLE!', 'TRIPLE!', 'CARNAGE!', 'MAYHEM!'][Math.min(5, this.combo)] + ' +' + bonus, '#ff8a3a', 20);
      }
    } else this.combo = 1;
    this.comboT = 0.45;
    this.reward(cx, cy, e.scrap, e.meter);
  }

  killBoss(b) {
    b.dead = true;
    b.deathT = 0;
    this.bossesKilled++;
    this.reward(b.x, -120, 150 + 50 * this.bossesKilled, 50);
    this.showBanner('WARLORD DESTROYED!', b.name, 3);
    this.slowT = 1;
    this.hitstop = 0.15;
    // clear their shells
    for (const h of this.hostile) h.dead = true;
  }

  hurtRig(dmg, x, y, src = 'other') {
    if (this.state !== 'play' || this.demo) return;
    this.hp -= dmg;
    this.dmgLog[src] = (this.dmgLog[src] || 0) + dmg;
    this.rigFlash = 0.1;
    this.flash = 0.25;
    this.flashColor = '255,40,20';
    this.addShake(6 + dmg * 0.3);
    sfx.hurt();
    this.fx.sparks(x, y, 10);
    this.fx.debris(x, y, 3, '#5c6166');
    if (this.hp <= 0) {
      this.hp = 0;
      this.lose();
    }
  }

  explode(x, y, r, dmg, opts = {}) {
    this.fx.explosion(x, y, r * 0.6 + 8, { dark: opts.dark });
    sfx.boom(r / 50);
    this.addShake(Math.min(14, r / 7));
    for (const e of this.enemies) {
      if (e.dead || e.falling) continue;
      const b = this.enemyBox(e);
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dy = Math.max(b.y0 - y, 0, y - b.y1);
      const d = Math.hypot(dx, dy);
      if (d <= r) this.hurtEnemy(e, dmg * (1 - 0.5 * (d / r)));
    }
    const B = this.boss;
    if (B && !B.dead && B.phase !== 'enter') {
      for (const p of B.parts) {
        if (p.hp <= 0) continue;
        const pp = this.partPos(B, p);
        const d = Math.max(0, Math.hypot(pp.x - x, pp.y - y) - pp.r);
        if (d <= r) this.hurtPart(B, p, dmg * (1 - 0.5 * (d / r)));
      }
    }
    for (const h of this.hostile) {
      if (h.dead || h.kind === 'flame') continue;
      if (Math.hypot(h.x - x, h.y - y) < r + h.r) this.intercept(h);
    }
    for (const k of this.crates) {
      if (!k.dead && Math.hypot(k.x - x, k.y - y) < r + 14) this.openCrate(k);
    }
  }

  intercept(h) {
    h.dead = true;
    this.fx.explosion(h.x, h.y, 18, { debris: false });
    this.scrap += 3;
    this.meter = Math.min(100, this.meter + 3 * this.meterMul);
    this.fx.text(h.x, h.y - 12, 'INTERCEPT +3', '#9ae6ff', 14);
  }

  openCrate(k) {
    k.dead = true;
    sfx.pickup();
    this.fx.sparks(k.x, k.y, 14, '#ffe08a');
    const specials = Object.keys(this.ammoCount).filter((a) => a !== 'iron');
    const opts = ['repair', 'scrap', 'meter'];
    if (specials.length) opts.push('ammo', 'ammo');
    const r = opts[Math.floor(Math.random() * opts.length)];
    let txt;
    if (r === 'repair') {
      const amt = Math.round(this.maxHp * 0.25);
      this.hp = Math.min(this.maxHp, this.hp + amt);
      txt = 'REPAIR +' + amt;
    } else if (r === 'scrap') {
      this.scrap += 30;
      txt = 'SCRAP +30';
    } else if (r === 'meter') {
      this.meter = Math.min(100, this.meter + 35);
      txt = 'GUTS +35';
    } else {
      const a = specials[Math.floor(Math.random() * specials.length)];
      this.ammoCount[a] += 2;
      txt = AMMO[a].short + ' +2';
    }
    this.fx.text(k.x, k.y - 20, txt, '#9effa0', 18);
  }

  // ---------------- Update ----------------
  update(dt) {
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      dt *= 0.35;
    }
    this.time += dt;
    this.dist += this.speed * dt;
    this.flash = Math.max(0, this.flash - dt * 2);
    this.rigFlash = Math.max(0, this.rigFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.recoil = Math.max(0, this.recoil - dt * 60);
    this.comboT -= dt;
    this.reload = Math.max(0, this.reload - dt);
    if (this.reload <= 0 && this.reloadWas > 0) sfx.reload();
    this.reloadWas = this.reload;

    if (this.queued && this.reload <= 0 && !this.hero && this.state === 'play') {
      this.fire(this.queued);
      this.queued = null;
    }

    // cannon follows aim
    const av = this.aimVector();
    if (av) this.angle = av.angle;
    else if (this.demo) {
      this.angle = -0.45 + Math.sin(this.time * 0.8) * 0.15;
      this.demoT = (this.demoT || 1) - dt;
      if (this.demoT <= 0) {
        this.demoT = rand(1.4, 2.6);
        this.fire({ angle: this.angle, power: rand(650, 900), pw: 0.6 });
      }
    }

    this.updateSpawns(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updateHostile(dt);
    this.updateHero(dt);
    this.updateCrates(dt);
    this.updateFires(dt);
    this.updateAmbient(dt);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        this.explode(p.x, p.y, p.r, p.dmg);
      }
    }
    this.fx.update(dt, this.speed);
    this.checkEnd(dt);
  }

  updateAmbient(dt) {
    const W = this.W;
    // props
    this.propT -= dt * this.speed;
    if (this.propT <= 0) {
      this.addProp(W + 60);
      this.propT = rand(90, 260);
    }
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      p.x -= this.speed * (p.back ? 0.85 : 1.25) * dt;
      if (p.x < -80) this.props.splice(i, 1);
    }
    // stack smoke & wheel dust
    this.smokeT -= dt;
    if (this.smokeT <= 0 && this.state !== 'lost') {
      this.smokeT = 0.09;
      const dmg = 1 - this.hp / this.maxHp;
      this.fx.smoke(X0 + 99, -102, 1, 5, dmg > 0.5 ? 35 : 80);
      if (this.speed > 20) this.fx.dust(X0 + rand(-4, 30), -3, 5, this.R.dust);
      if (dmg > 0.6) this.fx.flame(X0 + 128 + rand(-6, 6), -70, rand(-20, 20), -40, 6);
      for (const e of this.enemies) if (!e.dead && !e.static && !e.fly && Math.random() < 0.4) this.fx.dust(e.x + e.w * 0.4 * -e.dir, -3, 4, this.R.dust);
    }
    if (this.R.embers && Math.random() < dt * 8) this.fx.ember(rand(0, W + 100), -rand(0, this.GY));
    if (this.stage.storm && Math.random() < dt * 30) {
      this.fx.add({ k: 'dust', x: W + 20, y: -rand(0, this.GY), vx: -rand(500, 800), vy: rand(-10, 10), life: 1.6, size: rand(2, 5), grow: 4, drag: 0, g: 0, color: this.R.dust });
    }
  }

  updateEnemies(dt) {
    const W = this.W;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.falling) {
        e.vy += G * 0.6 * dt;
        e.y += e.vy * dt;
        e.x += e.vx * 0.6 * dt;
        e.tilt = (e.tilt || 0) + dt * 6;
        if (Math.random() < 0.6) this.fx.smoke(e.x, e.y, 1, 6, 40);
        if (e.y >= -10) {
          e.dead = true;
          this.explode(e.x, -10, 55 * this.blastMul, 25);
        }
        continue;
      }
      switch (e.type) {
        case 'buggy':
        case 'tank':
          e.x += e.vx * dt;
          e.bob = -Math.abs(Math.sin(e.t * 11 + e.seed)) * 1.6;
          if (e.type === 'tank') {
            e.fire -= dt;
            if (e.fire <= 0 && e.x < W - 30) {
              e.fire = 4.5;
              this.enemyShell(e.x - 40, -60, 12, 6, 'tank');
            }
          }
          if (e.x - e.w / 2 <= X1) this.ram(e);
          break;
        case 'biker':
          e.x += e.vx * dt;
          if (e.y < 0 || e.vy < 0) {
            e.vy += G * dt;
            e.y = Math.min(0, e.y + e.vy * dt);
            if (e.y >= 0) e.vy = 0;
          } else if (Math.random() < dt * 0.4) e.vy = -rand(160, 240);
          e.tilt = e.y < 0 ? -0.15 : 0;
          if (!e.thrown && e.x <= e.throwX) {
            e.thrown = true;
            const s = lob(e.x - 10, e.y - 45, rand(X0 + 40, X1 - 20), -50, rand(0.9, 1.15));
            this.hostile.push({ kind: 'lance', x: e.x - 10, y: e.y - 45, ...s, r: 6, dmg: 8 * this.enemyDmgMul() });
          }
          if (e.x - e.w / 2 <= X1) this.ram(e);
          break;
        case 'shooter':
          if (e.x > e.stopX) e.x += e.vx * dt;
          e.recoil = Math.max(0, (e.recoil || 0) - dt * 3);
          e.fire -= dt;
          if (e.fire <= 0 && e.x < W - 20) {
            e.fire = rand(4, 5.2);
            e.recoil = 1;
            this.enemyShell(e.x - 10, -50, 10, 7, 'mortar');
          }
          e.bob = -Math.abs(Math.sin(e.t * 9 + e.seed)) * 1.2;
          if (e.x - e.w / 2 <= X1) this.ram(e);
          break;
        case 'chaser':
          if (e.x < e.stopX) e.x += e.vx * dt;
          e.bob = -Math.abs(Math.sin(e.t * 11 + e.seed)) * 1.6;
          e.fire -= dt;
          if (e.fire <= 0 && e.x >= e.stopX - 5) {
            e.fire = rand(3.2, 4.2);
            const s = lob(e.x, -34, rand(X0 + 10, X0 + 90), -60, 0.8);
            this.hostile.push({ kind: 'molotov', x: e.x, y: -34, ...s, r: 6, dmg: 7 * this.enemyDmgMul() });
          }
          if (e.t > 12) e.stopX = X0 + 10; // lunge for the rear axle
          if (e.x + e.w / 2 >= X0 + 8) this.ram(e);
          break;
        case 'gyro': {
          e.x += e.vx * dt;
          e.y = e.baseY + Math.sin(e.t * 2.5 + e.seed) * 14;
          e.fire -= dt;
          if (e.fire <= 0 && e.x > X0 && e.x < X1 + 60) {
            e.fire = 1.3;
            this.hostile.push({ kind: 'bomb', x: e.x, y: e.y + 12, vx: e.vx * 0.6, vy: 30, r: 6, dmg: 9 * this.enemyDmgMul() });
          }
          if (e.x < -70) e.dead = true;
          break;
        }
        case 'tower':
          e.x += e.vx * dt;
          e.fire -= dt;
          if (e.fire <= 0 && e.x < W - 10 && e.x > X1 + 60) {
            e.fire = 2.2;
            const s = lob(e.x - 20, -110, rand(X0 + 30, X1 - 30), -50, 0.95);
            this.hostile.push({ kind: 'shell', src: 'tower', x: e.x - 20, y: -110, ...s, r: 5, dmg: 7 * this.enemyDmgMul() });
          }
          if (e.x < -60) e.dead = true;
          break;
        case 'spikewall':
          e.x += e.vx * dt;
          if (e.x - e.w / 2 <= X1) this.ram(e);
          break;
        case 'barrel':
          e.x += e.vx * dt;
          if (e.x < -40) e.dead = true;
          break;
      }
      if (e.x > W + 200 || e.x < -200) e.dead = true;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  enemyDmgMul() {
    return 0.8 + (this.enemyHpMul() - 1) * 0.4;
  }

  enemyShell(x, y, dmg, r, src) {
    const tx = rand(X0 + 20, X1 - 20);
    const T = clamp(0.9 + (x - tx) / 700, 1, 2);
    const s = lob(x, y, tx, -50, T);
    this.hostile.push({ kind: 'shell', src, x, y, ...s, r, dmg: dmg * this.enemyDmgMul() });
    this.fx.smoke(x, y, 3, 6, 120);
    this.fx.flame(x, y, s.vx * 0.1, s.vy * 0.1, 8);
    sfx.fire();
    return s;
  }

  ram(e) {
    e.dead = true;
    const x = e.dir < 0 ? X1 : X0;
    this.fx.explosion(x, -25, 36);
    sfx.boom(1);
    this.hurtRig((e.dmg || 10) * this.enemyDmgMul(), x, -30, 'ram:' + e.type);
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    for (const p of b.parts) p.flash = Math.max(0, p.flash - dt);
    if (b.dead) {
      b.deathT += dt;
      if (Math.random() < dt * 14) {
        const p = b.parts[Math.floor(Math.random() * b.parts.length)];
        const pp = this.partPos(b, p);
        this.fx.explosion(pp.x + rand(-60, 60) * b.s, pp.y + rand(-40, 40) * b.s, rand(30, 60));
        sfx.boom(1.2);
        this.addShake(6);
      }
      if (b.kind === 'vulture') {
        b.y += 60 * dt;
        b.x -= 20 * dt;
      } else b.x += 40 * dt;
      if (b.deathT > 2.4) {
        this.fx.explosion(b.x, b.y - 60 * b.s, 140);
        sfx.boom(3);
        this.addShake(16);
        this.flash = 0.6;
        this.flashColor = '255,230,180';
        this.boss = null;
        if (!this.stage.endless) this.win();
        else {
          this.regionIndex = (this.regionIndex + 1) % 3;
          this.R = REGIONS[this.regionIndex];
          this.showBanner(this.R.name, 'The road goes on…', 2.4);
          playMusic(1);
        }
      }
      return;
    }
    const alive = (n) => b.parts.find((p) => p.name === n).hp > 0;
    const shellFrom = (n, dmg) => {
      const p = b.parts.find((q) => q.name === n);
      const pp = this.partPos(b, p);
      const s = this.enemyShell(pp.x - 30 * b.s, pp.y - 6, dmg, 8, 'boss');
      return Math.atan2(s.vy, s.vx);
    };

    if (b.phase === 'enter') {
      b.x += (b.homeX - b.x) * Math.min(1, dt * 1.2) - 30 * dt;
      if (b.x <= b.homeX + 4) {
        b.phase = 'fight';
        b.phaseT = 0;
      }
      return;
    }
    b.phaseT += dt;
    b.fire -= dt;
    b.spawn -= dt;

    if (b.kind === 'behemoth') {
      if (b.phase === 'fight') {
        b.x = b.homeX + Math.sin(b.t * 0.5) * 30 * b.s;
        if (alive('turret') && b.fire <= 0) {
          b.fire = 2.4;
          b.aim = shellFrom('turret', 14);
        }
        if (b.spawn <= 0) {
          b.spawn = 7;
          this.spawnEnemy(Math.random() < 0.5 ? 'biker' : 'buggy');
        }
        if (b.phaseT > 13) {
          b.phase = 'charge';
          b.phaseT = 0;
          this.showBanner('CHARGE!', 'Brace for impact', 1.2);
          sfx.roar();
        }
      } else if (b.phase === 'charge') {
        const front = b.x - 158 * b.s;
        if (b.phaseT > 1) b.x -= 260 * dt;
        else b.x += Math.sin(b.t * 40) * 1.5;
        if (front <= X1) {
          this.hurtRig(18 * this.enemyDmgMul(), X1, -40, 'charge');
          this.fx.explosion(X1, -40, 40);
          b.phase = 'retreat';
          b.phaseT = 0;
        }
      } else if (b.phase === 'retreat') {
        b.x += (b.homeX - b.x) * Math.min(1, dt * 1.5);
        if (b.phaseT > 2) {
          b.phase = 'fight';
          b.phaseT = 0;
        }
      }
      if (Math.random() < dt * 6) this.fx.smoke(b.x + 125 * b.s, -168 * b.s, 1, 7, 40);
    } else if (b.kind === 'vulture') {
      const crippled = !alive('rotorL') && !alive('rotorR');
      const targetY = crippled ? b.baseY * 0.55 : b.baseY;
      b.y += (targetY + Math.sin(b.t * 1.3) * 12 - b.y) * Math.min(1, dt * 1.5);
      const span = this.W * 0.22;
      b.x = b.homeX + Math.sin(b.t * 0.35) * span;
      const engines = (alive('rotorL') ? 1 : 0) + (alive('rotorR') ? 1 : 0);
      if (b.fire <= 0) {
        b.fire = 1.5 + (2 - engines) * 0.3;
        const gx = b.x;
        const gy = b.y + 96 * b.s;
        const T = Math.sqrt((2 * Math.max(40, -gy)) / G);
        const tx = rand(X0 + 10, X1 - 10);
        this.hostile.push({ kind: 'bomb', x: gx, y: gy, vx: (tx - gx) / T, vy: 0, r: 7, dmg: 11 * this.enemyDmgMul() });
      }
      if (b.spawn <= 0) {
        b.spawn = crippled ? 6 : 8;
        this.spawnEnemy('gyro');
      }
    } else if (b.kind === 'goliath') {
      b.aims = b.aims || {};
      if (b.phase === 'fight') {
        b.x = b.homeX + Math.sin(b.t * 0.45) * 26 * b.s;
        if (b.fire <= 0) {
          b.fire = 1.5;
          b.flip = !b.flip;
          const n = b.flip ? 'turretA' : 'turretB';
          if (alive(n)) b.aims[n] = shellFrom(n, 13);
        }
        if (b.spawn <= 0) {
          b.spawn = 6.5;
          this.spawnEnemy(['chaser', 'biker', 'buggy'][Math.floor(Math.random() * 3)]);
        }
        if (b.phaseT > 11 && alive('snout')) {
          b.phase = 'flame';
          b.phaseT = 0;
          this.showBanner('FLAMETHROWER!', 'Knock out the snout!', 1.2);
          sfx.roar();
        }
      } else if (b.phase === 'flame') {
        const front = b.x - 212 * b.s;
        const want = X1 + 90;
        if (front > want) b.x -= 160 * dt;
        if (!alive('snout')) b.phaseT = Math.max(b.phaseT, 5);
        if (b.phaseT > 1.2 && b.phaseT < 4.5 && alive('snout')) {
          const p = this.partPos(b, b.parts[0]);
          for (let i = 0; i < 2; i++) {
            this.hostile.push({ kind: 'flame', x: p.x - 10, y: p.y, vx: -rand(300, 380), vy: rand(-60, 40), r: rand(8, 14), dmg: 1.4 * this.enemyDmgMul(), life: 0.6 });
          }
        }
        if (b.phaseT > 5) {
          b.phase = 'retreat';
          b.phaseT = 0;
        }
      } else if (b.phase === 'retreat') {
        b.x += (b.homeX - b.x) * Math.min(1, dt * 1.5);
        if (b.phaseT > 2) {
          b.phase = 'fight';
          b.phaseT = 0;
        }
      }
      if (Math.random() < dt * 8) this.fx.smoke(b.x + rand(100, 150) * b.s, -210 * b.s, 1, 8, 30);
    }
  }

  updateShots(dt) {
    const W = this.W;
    for (const s of this.shots) {
      if (s.dead) continue;
      const steps = 2;
      const h = dt / steps;
      for (let k = 0; k < steps && !s.dead; k++) {
        s.vy += G * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
        s.t += h;
        s.rot += h * 8;
        this.collideShot(s);
      }
      if (s.dead) continue;
      if (s.kind === 'scatter' && ((s.rising && s.vy >= 0) || (!s.rising && s.t > 0.3))) {
        s.dead = true;
        this.splitScatter(s);
        continue;
      }
      if (Math.random() < 0.5) this.fx.smoke(s.x, s.y, 1, 2.5, s.kind === 'napalm' ? 60 : 150);
      if (s.kind === 'napalm') this.fx.flame(s.x, s.y, 0, 0, 5);
      if (s.x > W + 400 || s.x < -400 || s.y > 60) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  splitScatter(s) {
    const sp = Math.hypot(s.vx, s.vy);
    const a0 = Math.atan2(s.vy, s.vx);
    this.fx.sparks(s.x, s.y, 10);
    sfx.clank();
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i - 2) * 0.17;
      this.shots.push({ kind: 'shard', x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: s.dmg, blast: s.blast, t: 0, rot: 0 });
    }
  }

  collideShot(s) {
    // vs hostile projectiles
    for (const h of this.hostile) {
      if (h.dead || h.kind === 'flame') continue;
      if (Math.hypot(h.x - s.x, h.y - s.y) < s.r + h.r + 12) {
        this.intercept(h);
        if (s.kind !== 'thunder') {
          s.dead = true;
          return;
        }
      }
    }
    // vs crates
    for (const k of this.crates) {
      if (!k.dead && Math.abs(k.x - s.x) < 16 + s.r && Math.abs(k.y - s.y) < 16 + s.r) {
        this.openCrate(k);
        this.impact(s, s.x, s.y);
        return;
      }
    }
    // vs enemies
    for (const e of this.enemies) {
      if (e.dead || e.falling) continue;
      const b = this.enemyBox(e);
      if (s.x + s.r > b.x0 && s.x - s.r < b.x1 && s.y + s.r > b.y0 && s.y - s.r < b.y1) {
        this.impact(s, s.x, s.y);
        return;
      }
    }
    // vs boss
    const B = this.boss;
    if (B && !B.dead && B.phase !== 'enter') {
      for (const p of B.parts) {
        if (p.hp <= 0) continue;
        const pp = this.partPos(B, p);
        if (Math.hypot(pp.x - s.x, pp.y - s.y) < pp.r + s.r) {
          this.impact(s, s.x, s.y);
          return;
        }
      }
      if (this.bossHull(B, s.x, s.y)) {
        sfx.clank();
        this.impact(s, s.x, s.y);
        return;
      }
    }
    if (s.y >= -2) this.impact(s, s.x, Math.min(s.y, 0));
  }

  bossHull(b, x, y) {
    const lx = (x - b.x) / b.s;
    const ly = (y - b.y) / b.s;
    if (b.kind === 'behemoth') return lx > -152 && lx < 158 && ly > -138 && ly < -36;
    if (b.kind === 'goliath') return lx > -214 && lx < 196 && ly > -170 && ly < -40;
    if (b.kind === 'vulture') return (lx / 150) ** 2 + ((ly + 5) / 55) ** 2 < 1 || (lx > -50 && lx < 50 && ly > 60 && ly < 96);
    return false;
  }

  impact(s, x, y) {
    s.dead = true;
    if (s.kind === 'scatter') {
      this.explode(x, y, s.blast * 1.4, s.dmg * 1.5);
    } else if (s.kind === 'napalm') {
      this.explode(x, y, s.blast, s.dmg);
      this.fires.push({ x, w: 100 * this.blastMul, t: 4.5, tick: 0 });
    } else if (s.kind === 'thunder') {
      this.explode(x, y, s.blast, s.dmg);
      this.flash = 0.35;
      this.flashColor = '255,220,160';
      this.hitstop = 0.06;
    } else {
      this.explode(x, y, s.blast, s.dmg);
    }
  }

  updateFires(dt) {
    for (const f of this.fires) {
      f.t -= dt;
      f.x -= this.speed * dt;
      f.tick -= dt;
      if (Math.random() < dt * 40) this.fx.flame(f.x + rand(-f.w / 2, f.w / 2), -rand(0, 8), rand(-10, 10), -rand(40, 120), rand(5, 11));
      if (f.tick <= 0) {
        f.tick = 0.25;
        for (const e of this.enemies) {
          if (e.dead || e.fly || e.falling) continue;
          if (Math.abs(e.x - f.x) < f.w / 2 + e.w / 2) this.hurtEnemy(e, 4 * this.dmgMul);
        }
        const B = this.boss;
        if (B && !B.dead && B.kind !== 'vulture' && B.phase !== 'enter') {
          for (const p of B.parts) {
            const pp = this.partPos(B, p);
            if (p.hp > 0 && Math.abs(pp.x - f.x) < f.w / 2 + pp.r && pp.y > -100) this.hurtPart(B, p, 3 * this.dmgMul);
          }
        }
      }
    }
    this.fires = this.fires.filter((f) => f.t > 0);
  }

  updateHostile(dt) {
    for (const h of this.hostile) {
      if (h.dead) continue;
      if (h.kind === 'flame') {
        h.life -= dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.r += dt * 14;
        if (Math.random() < 0.5) this.fx.flame(h.x, h.y, h.vx * 0.3, h.vy * 0.3 - 40, h.r * 0.8);
        if (h.life <= 0) h.dead = true;
      } else {
        h.vy += G * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
      }
      if (h.x > X0 - 4 && h.x < X1 && h.y > RIG_TOP && h.y < 0) {
        h.dead = true;
        if (h.kind !== 'flame') this.fx.explosion(h.x, h.y, 22, { debris: false });
        if (h.kind === 'molotov') for (let i = 0; i < 6; i++) this.fx.flame(h.x, h.y, rand(-60, 60), rand(-80, 0), 8);
        this.hurtRig(h.dmg, h.x, h.y, h.src || h.kind);
        continue;
      }
      if (h.y >= 0) {
        h.dead = true;
        if (h.kind !== 'flame') {
          this.fx.explosion(h.x, 0, 16, { debris: false });
          sfx.boom(0.3);
        }
      }
      if (h.x < -100 || h.x > this.W + 300) h.dead = true;
    }
    this.hostile = this.hostile.filter((h) => !h.dead);
  }

  updateHero(dt) {
    const h = this.hero;
    if (!h) return;
    h.t += dt;
    if (h.phase === 'fly') {
      h.vy += G * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += dt * 14;
      for (let i = 0; i < 3; i++) this.fx.flame(h.x + rand(-6, 6), h.y + rand(-6, 6), -h.vx * 0.2, -h.vy * 0.2, rand(7, 12));
      const R = 20;
      for (const e of this.enemies) {
        if (e.dead || e.falling || h.hit.has(e)) continue;
        const b = this.enemyBox(e);
        if (h.x + R > b.x0 && h.x - R < b.x1 && h.y + R > b.y0 && h.y - R < b.y1) {
          h.hit.add(e);
          this.hurtEnemy(e, 60 * this.dmgMul);
          this.fx.explosion(h.x, h.y, 30);
          this.hitstop = 0.04;
          this.addShake(8);
        }
      }
      const B = this.boss;
      if (B && !B.dead && B.phase !== 'enter') {
        for (const p of B.parts) {
          if (p.hp <= 0 || h.hit.has(p)) continue;
          const pp = this.partPos(B, p);
          if (Math.hypot(pp.x - h.x, pp.y - h.y) < pp.r + R) {
            h.hit.add(p);
            // the hero punches straight through armor
            const ab = p.armoredBy;
            p.armoredBy = null;
            this.hurtPart(B, p, 80 * this.dmgMul);
            p.armoredBy = ab;
            this.fx.explosion(h.x, h.y, 40);
            this.hitstop = 0.06;
            this.addShake(10);
          }
        }
      }
      for (const o of this.hostile) if (!o.dead && o.kind !== 'flame' && Math.hypot(o.x - h.x, o.y - h.y) < R + o.r) this.intercept(o);
      for (const k of this.crates) if (!k.dead && Math.hypot(k.x - h.x, k.y - h.y) < R + 16) this.openCrate(k);
      const off = h.x > this.W + 60 || h.x < -60;
      if (h.y >= -8 || off) {
        const lx = clamp(h.x, 10, this.W - 10);
        this.explode(lx, -8, 135 * this.blastMul, 70 * this.dmgMul);
        this.flash = 0.4;
        this.flashColor = '255,200,140';
        this.hitstop = 0.08;
        h.phase = 'return';
        h.t = 0;
        h.sx = lx;
        h.sy = off ? -40 : -8;
        this.fx.text(lx, -80, 'CANNONBALL!', '#ff6a3a', 26);
      }
    } else {
      // tumble back onto the rig
      const T = 1.1;
      const f = Math.min(1, h.t / T);
      h.x = h.sx + (PIV.x - 30 - h.sx) * f;
      h.y = h.sy + (PIV.y + 10 - h.sy) * f - Math.sin(f * Math.PI) * 220;
      h.rot -= dt * 10;
      if (f >= 1) {
        this.hero = null;
        sfx.clank();
        this.fx.dust(PIV.x - 30, -80, 8);
      }
    }
  }

  updateCrates(dt) {
    for (const k of this.crates) {
      if (k.dead) continue;
      k.flash = Math.max(0, k.flash - dt);
      if (!k.landed) {
        k.y += k.vy * dt;
        k.x += Math.sin(this.time * 1.5 + k.x) * 12 * dt - 12 * dt;
        if (k.y >= -13) {
          k.y = -13;
          k.landed = true;
        }
      } else k.x -= this.speed * dt;
      if (k.x < -40) k.dead = true;
    }
    this.crates = this.crates.filter((k) => !k.dead);
  }

  win() {
    if (this.state !== 'play') return;
    this.state = 'won';
    this.endT = 0;
    this.aim = null;
    sfx.victory();
    if (!this.stage.boss) this.showBanner('ROAD CLEAR!', 'On to the next stretch', 3);
    for (const e of this.enemies) if (!e.static) this.killEnemy(e);
  }

  lose() {
    this.state = 'lost';
    this.endT = 0;
    this.aim = null;
    this.armed = false;
    this.showBanner('THE MAMMOTH HAS FALLEN', this.stage.endless ? `Distance: ${this.meters()} m` : 'The water spills into the sand…', 3);
    sfx.defeat();
    engineOn(false);
  }

  meters() {
    return Math.floor(this.dist / 10);
  }

  checkEnd(dt) {
    if (this.demo) return;
    if (this.state === 'play') {
      const st = this.stage;
      if (!st.boss && !st.endless && this.time >= st.len) {
        const left = this.enemies.filter((e) => !e.static && !e.dead).length;
        if (left === 0 || this.time > st.len + 10) this.win();
      }
      return;
    }
    this.endT += dt;
    if (this.state === 'lost') {
      this.speed = Math.max(0, this.speed - 70 * dt);
      if (Math.random() < dt * 10 && this.endT < 2) {
        this.fx.explosion(rand(X0, X1), -rand(10, 70), rand(25, 50));
        sfx.boom(1);
        this.addShake(8);
      }
    }
    if (this.endT > 3.2 && !this.ended) {
      this.ended = true;
      engineOn(false);
      const hpFrac = this.hp / this.maxHp;
      const won = this.state === 'won';
      const stars = won ? (hpFrac >= 0.75 ? 3 : hpFrac >= 0.4 ? 2 : 1) : 0;
      this.onEnd({ won, stars, scrap: this.scrap, kills: this.kills, hpFrac, meters: this.meters(), endless: !!this.stage.endless, time: this.time });
    }
  }

  // ---------------- HUD info ----------------
  progress() {
    if (this.boss) {
      let hp = 0;
      let max = 0;
      for (const p of this.boss.parts) {
        hp += Math.max(0, p.hp);
        max += p.maxHp;
      }
      return hp / max;
    }
    if (this.stage.endless) return 0;
    if (this.stage.boss) return this.bossDue ? 1 : 0;
    return Math.min(1, this.time / this.stage.len);
  }

  // ---------------- Render ----------------
  draw(ctx) {
    const { W, H, GY } = this.view;
    const R = this.R;
    ctx.save();
    const sh = this.shake;
    ctx.translate((Math.random() - 0.5) * sh, GY + (Math.random() - 0.5) * sh);
    D.drawBackground(ctx, R, this.dist, W, GY, H, this.time);
    for (const p of this.props) if (p.back) D.drawProp(ctx, p.kind, p.x, p.y, p.s, R.prop);
    D.drawGround(ctx, R, this.dist, W, H - GY);
    this.fx.drawBack(ctx);

    for (const e of this.enemies) if (e.static) D.drawEnemy(ctx, e, this.time);
    if (this.boss) this.drawBossWithParts(ctx);
    for (const e of this.enemies) if (!e.static && !e.fly) D.drawEnemy(ctx, e, this.time);
    for (const k of this.crates) if (k.landed) D.drawCrate(ctx, k);

    const dmg = 1 - this.hp / this.maxHp;
    D.drawRig(ctx, {
      x0: X0, t: this.time, angle: this.angle, recoil: this.recoil, flash: this.rigFlash, armed: this.armed,
      heroAway: !!this.hero, reloadFrac: this.reload / (this.reloadTime * AMMO[this.ammo].reload), wheelRot: this.dist / 14,
      damage: dmg, bounce: this.speed > 0 ? Math.sin(this.time * 13) * 0.6 : 0,
    });
    for (const e of this.enemies) if (e.fly) D.drawEnemy(ctx, e, this.time);
    for (const k of this.crates) if (!k.landed) D.drawCrate(ctx, k);
    for (const s of this.shots) D.drawBall(ctx, s);
    for (const h of this.hostile) D.drawHostile(ctx, h, this.time);
    if (this.hero) D.drawHero(ctx, this.hero.x, this.hero.y, this.hero.rot);
    this.fx.drawFront(ctx);
    this.drawOffscreenMarkers(ctx);
    this.drawAim(ctx);
    for (const p of this.props) if (!p.back) D.drawProp(ctx, p.kind, p.x, p.y, p.s, R.prop);
    this.fx.drawTexts(ctx);

    if (this.stage.storm) {
      const g = ctx.createLinearGradient(X1, 0, W, 0);
      g.addColorStop(0, R.dust + '00');
      g.addColorStop(0.55, R.dust + '99');
      g.addColorStop(1, R.dust + 'ee');
      ctx.fillStyle = g;
      ctx.fillRect(0, -GY - 20, W + 20, H + 40);
    }
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.5, this.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.hp / this.maxHp < 0.3 && this.state === 'play' && !this.demo) {
      const a = 0.18 + 0.12 * Math.sin(this.time * 8);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(200,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawBanner(ctx);
    this.drawHint(ctx);
  }

  drawBossWithParts(ctx) {
    const b = this.boss;
    D.drawBoss(ctx, b, this.time);
    if (b.dead) return;
    // weak point markers
    for (const p of b.parts) {
      if (p.hp <= 0) continue;
      const pp = this.partPos(b, p);
      const armored = this.partArmored(b, p);
      ctx.save();
      ctx.globalAlpha = p.flash > 0 ? 1 : 0.55 + 0.25 * Math.sin(this.time * 6);
      ctx.strokeStyle = armored ? '#9a9a9a' : '#ff3a2a';
      ctx.lineWidth = 2;
      ctx.setLineDash(armored ? [3, 4] : [6, 4]);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pp.r + 4, this.time * 2, this.time * 2 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // mini health bar
      const w = pp.r * 1.6;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pp.x - w / 2, pp.y - pp.r - 12, w, 4);
      ctx.fillStyle = armored ? '#9a9a9a' : '#ff5a2a';
      ctx.fillRect(pp.x - w / 2, pp.y - pp.r - 12, (w * p.hp) / p.maxHp, 4);
      ctx.restore();
    }
  }

  drawOffscreenMarkers(ctx) {
    const top = -this.GY + 6;
    ctx.fillStyle = '#ff4a2a';
    for (const h of this.hostile) {
      if (h.y > top || h.vy < 0) continue;
      const x = clamp(h.x, 10, this.W - 10);
      ctx.beginPath();
      ctx.moveTo(x, top + 12);
      ctx.lineTo(x - 7, top);
      ctx.lineTo(x + 7, top);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawAim(ctx) {
    const v = this.aimVector();
    if (!v || this.state !== 'play' || this.hero) return;
    const a = this.aim;
    // drag gizmo
    if (this.aimMode !== 'point') {
      ctx.strokeStyle = 'rgba(255,240,200,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.sx, a.sy, 16, 0, 6.283);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(a.cx, a.cy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,200,0.7)';
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, 8, 0, 6.283);
      ctx.fill();
    }
    // trajectory preview
    const m = this.muzzle(v.angle);
    const mul = this.armed ? 1.05 : 1;
    let x = m.x;
    let y = m.y;
    let vx = Math.cos(v.angle) * v.power * mul;
    let vy = Math.sin(v.angle) * v.power * mul;
    const dt = 1 / 60;
    const T = this.armed ? this.scopeT + 0.3 : this.scopeT;
    const col = this.armed ? '255,90,40' : '255,236,180';
    for (let t = 0, i = 0; t < T; t += dt, i++) {
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      if (y > 0) break;
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(${col},${0.9 * (1 - t / T)})`;
        ctx.beginPath();
        ctx.arc(x, y, 3.2 - (t / T) * 1.5, 0, 6.283);
        ctx.fill();
      }
    }
    // power meter by the cannon
    const bx = PIV.x - 70;
    const by = PIV.y - 60;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, 7, 44);
    ctx.fillStyle = v.pw > 0.85 ? '#ff5a2a' : '#ffd27a';
    ctx.fillRect(bx + 1, by + 1 + 42 * (1 - v.pw), 5, 42 * v.pw);
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b || this.demo) return;
    const { W, H } = this.view;
    const f = b.t / b.dur;
    const a = f < 0.12 ? f / 0.12 : f > 0.8 ? (1 - f) / 0.2 : 1;
    const y = H * (H > W ? 0.3 : 0.32);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(20,8,2,0.55)';
    ctx.fillRect(0, y - 40, W, b.sub ? 78 : 60);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.min(40, (W * 0.9) / Math.max(8, b.text.length) * 1.5);
    const sc = 1 + Math.max(0, 0.3 - f * 3);
    ctx.font = `${size * sc}px "Black Ops One", Impact, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a0a02';
    ctx.strokeText(b.text, W / 2, y - 8);
    ctx.fillStyle = '#ffcf5a';
    ctx.fillText(b.text, W / 2, y - 8);
    if (b.sub) {
      ctx.font = '16px "Oswald", Impact, sans-serif';
      ctx.fillStyle = '#f3e3c3';
      ctx.fillText(b.sub, W / 2, y + 22);
    }
    ctx.restore();
  }

  drawHint(ctx) {
    const h = this.hint;
    if (!h || this.state !== 'play' || this.banner) return;
    const { W, GY } = this.view;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px "Black Ops One", Impact, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1a0a02';
    const y = GY * 0.45;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(this.time * 5);
    ctx.strokeText(h.text, W / 2, y);
    ctx.fillStyle = '#fff1c9';
    ctx.fillText(h.text, W / 2, y);
    if (h.demo) {
      // animated finger: press near cannon, pull back-down-left
      const p = (this.time % 2) / 2;
      const sx = W * 0.5;
      const sy = GY - 40;
      const pull = Math.min(1, p * 1.6);
      const fx = sx - 90 * pull;
      const fy = sy + 50 * pull;
      ctx.globalAlpha = p > 0.85 ? 0 : 0.85;
      ctx.strokeStyle = 'rgba(255,240,200,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.fillStyle = '#fff1c9';
      ctx.beginPath();
      ctx.arc(fx, fy, 14, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#1a0a02';
      ctx.font = '14px sans-serif';
      ctx.fillText('👆', fx, fy + 2);
      // arrow showing shot direction
      ctx.strokeStyle = '#ffcf5a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + 20, sy - 20);
      ctx.lineTo(sx + 20 + 60 * pull, sy - 20 - 34 * pull);
      ctx.stroke();
    }
    ctx.restore();
  }
}
