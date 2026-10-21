// DOM menus and the in-battle HUD.

import { AMMO, AMMO_ORDER, UPGRADES, upgradeCost, STAGES, REGIONS, ENEMIES, BOSSES, STORY } from './data.js';
import { sfx } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const starStr = (n, max = 3) => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(max - n) + '</span>';

const ICON = { iron: '●', scatter: '⁂', napalm: '🔥', thunder: '💥' };

export class UI {
  constructor(api) {
    this.api = api;
    this.root = $('#screens');
    this.hud = $('#hud');
    this.hudCache = {};
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      sfx.click();
      this.onAct(b.dataset.act, b.dataset.arg, b);
    });
    $('#btn-pause').addEventListener('click', () => {
      sfx.click();
      api.pause();
    });
    $('#btn-special').addEventListener('click', () => api.battle()?.toggleArmed());
    $('#ammo-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ammo]');
      if (b) api.battle()?.setAmmo(b.dataset.ammo);
    });
    // HUD buttons must not start an aim drag on the canvas underneath
    for (const el of [$('#btn-pause'), $('#btn-special'), $('#ammo-bar')]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  get save() {
    return this.api.save();
  }

  show(html, cls = '') {
    this.root.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    this.root.hidden = false;
    this.root.scrollTop = 0;
  }

  hide() {
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  onAct(act, arg) {
    const api = this.api;
    switch (act) {
      case 'play':
        if (!this.save.seenIntro) this.intro();
        else this.map();
        break;
      case 'map':
        this.map();
        break;
      case 'title':
        this.title();
        break;
      case 'brief':
        this.brief(+arg);
        break;
      case 'start':
        api.startStage(+arg);
        break;
      case 'endless':
        this.brief(-1);
        break;
      case 'start-endless':
        api.startEndless();
        break;
      case 'garage':
        this.garage(arg);
        break;
      case 'buy':
        this.buy(arg);
        break;
      case 'buy-ammo':
        this.buyAmmo(arg);
        break;
      case 'settings':
        this.settings(arg);
        break;
      case 'toggle':
        this.toggleSetting(arg);
        break;
      case 'howto':
        this.howto(arg);
        break;
      case 'resume':
        api.resume();
        break;
      case 'restart':
        api.restart();
        break;
      case 'quit':
        api.quit();
        break;
      case 'next':
        api.startStage(+arg);
        break;
      case 'intro-next':
        this.introStep(+arg);
        break;
      case 'ending-next':
        this.endingStep(+arg);
        break;
      case 'reset':
        if (confirm('Wipe all progress? This cannot be undone.')) {
          api.resetSave();
          this.title();
        }
        break;
      case 'back':
        if (this.backTo) this.backTo();
        break;
    }
  }

  // ---------------- Screens ----------------
  title() {
    const s = this.save;
    const endless = s.unlocked >= 4;
    this.show(`
      <div class="title-wrap">
        <div class="logo">
          <div class="logo-top">CANNON</div>
          <div class="logo-bot">BALL</div>
          <div class="logo-tag">FURY OF THE WASTELAND</div>
        </div>
        <div class="menu">
          <button class="btn big" data-act="play">${s.seenIntro ? 'CONTINUE' : 'PLAY'}</button>
          <button class="btn" data-act="endless" ${endless ? '' : 'disabled'}>ENDLESS FURY ${endless ? '' : '🔒'}</button>
          <div class="row">
            <button class="btn small" data-act="garage" data-arg="title">GARAGE</button>
            <button class="btn small" data-act="howto" data-arg="title">HOW TO</button>
            <button class="btn small" data-act="settings" data-arg="title">⚙</button>
          </div>
          ${s.endlessBest ? `<p class="foot">Endless best: ${s.endlessBest} m</p>` : endless ? '' : '<p class="foot">Defeat the first warlord to unlock Endless Fury</p>'}
        </div>
      </div>`, 'title-screen');
  }

  intro() {
    this.introStep(0);
  }

  introStep(i) {
    const lines = STORY.intro;
    if (i >= lines.length) {
      this.api.markIntroSeen();
      this.map();
      return;
    }
    this.show(`
      <div class="story" data-act="intro-next" data-arg="${i + 1}">
        <p class="story-line">${esc(lines[i])}</p>
        <p class="story-tap">tap to continue</p>
      </div>
      <button class="btn small skip" data-act="intro-next" data-arg="${lines.length}">SKIP</button>`, 'story-screen');
  }

  endingStep(i) {
    const lines = STORY.ending;
    if (i >= lines.length) {
      this.map();
      return;
    }
    this.show(`
      <div class="story" data-act="ending-next" data-arg="${i + 1}">
        <p class="story-line">${esc(lines[i])}</p>
        <p class="story-tap">tap to continue</p>
      </div>`, 'story-screen ending');
  }

  map() {
    const s = this.save;
    let html = `
      <div class="topbar">
        <button class="btn icon" data-act="title">←</button>
        <h2>THE FURY ROAD</h2>
        <div class="scrap">⚙ ${s.scrap}</div>
      </div>
      <div class="map">`;
    REGIONS.forEach((R, ri) => {
      html += `<section class="region r${ri}">
        <h3>${esc(R.name)}</h3>
        <p class="region-sub">${esc(STORY.regions[ri].split('—')[1] || '')}</p>
        <div class="nodes">`;
      STAGES.forEach((st, i) => {
        if (st.region !== ri) return;
        const locked = i > s.unlocked;
        const stars = s.stars[i] || 0;
        const current = i === s.unlocked;
        html += `<button class="node ${st.boss ? 'boss' : ''} ${locked ? 'locked' : ''} ${current ? 'current' : ''}" data-act="brief" data-arg="${i}" ${locked ? 'disabled' : ''}>
          <span class="num">${st.boss ? '☠' : i + 1}</span>
          <span class="name">${esc(st.name)}</span>
          <span class="stars">${locked ? '🔒' : starStr(stars)}</span>
        </button>`;
      });
      html += `</div></section>`;
    });
    html += `<section class="region endless-card">
        <button class="node ${s.unlocked >= 4 ? '' : 'locked'}" data-act="endless" ${s.unlocked >= 4 ? '' : 'disabled'}>
          <span class="num">∞</span><span class="name">Endless Fury</span>
          <span class="stars">${s.unlocked >= 4 ? (s.endlessBest ? s.endlessBest + ' m' : 'NEW') : '🔒'}</span>
        </button>
      </section>
      </div>
      <div class="bottombar"><button class="btn" data-act="garage" data-arg="map">🔧 GARAGE</button></div>`;
    this.show(html, 'map-screen');
    const cur = $('.node.current', this.root);
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  brief(i) {
    const endless = i < 0;
    const st = endless ? this.api.endlessStage() : STAGES[i];
    const types = endless ? ['buggy', 'biker', 'gyro', 'shooter', 'chaser', 'tank'] : [...Object.keys(st.spawns), ...Object.keys(st.statics || {})];
    const chips = types.map((t) => `<li><b>${esc(ENEMIES[t].name)}</b> — ${esc(ENEMIES[t].info)}</li>`).join('');
    const boss = st.boss ? BOSSES[st.boss] : null;
    this.show(`
      <div class="panel brief">
        <p class="kicker">${endless ? 'SURVIVAL' : esc(REGIONS[st.region].name) + ' · STAGE ' + (i + 1)}</p>
        <h2>${esc(st.name)}</h2>
        ${boss ? `<p class="boss-warn">☠ WARLORD: ${esc(boss.name)}</p>` : ''}
        <p class="brief-text">${esc(st.brief)}</p>
        <h4>ON THE ROAD</h4>
        <ul class="enemy-list">${chips}</ul>
        <div class="row">
          <button class="btn" data-act="map">BACK</button>
          <button class="btn" data-act="garage" data-arg="${endless ? 'brief:-1' : 'brief:' + i}">🔧 GARAGE</button>
        </div>
        <button class="btn big go" data-act="${endless ? 'start-endless' : 'start'}" data-arg="${i}">ROLL OUT!</button>
      </div>`, 'brief-screen');
  }

  garage(from = 'map', keepScroll = false) {
    this.garageFrom = from;
    const s = this.save;
    let html = `
      <div class="topbar">
        <button class="btn icon" data-act="back">←</button>
        <h2>GARAGE</h2>
        <div class="scrap">⚙ ${s.scrap}</div>
      </div>
      <div class="garage">
        <h4>RIG UPGRADES</h4>`;
    for (const u of UPGRADES) {
      const lv = s.upgrades[u.id] || 0;
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lv);
      const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
      html += `<div class="card">
        <div class="card-main"><b>${esc(u.name)}</b><span>${esc(u.desc)}</span><div class="pips">${pips}</div></div>
        <button class="btn buy" data-act="buy" data-arg="${u.id}" ${maxed || cost > s.scrap ? 'disabled' : ''}>${maxed ? 'MAX' : '⚙ ' + cost}</button>
      </div>`;
    }
    html += `<h4>SPECIAL AMMO</h4>`;
    for (const k of AMMO_ORDER) {
      if (k === 'iron') continue;
      const A = AMMO[k];
      const owned = s.ammo[k];
      html += `<div class="card">
        <div class="ammo-ico">${ICON[k]}</div>
        <div class="card-main"><b>${esc(A.name)}</b><span>${esc(A.desc)} (${A.cap}+ per run)</span></div>
        <button class="btn buy" data-act="buy-ammo" data-arg="${k}" ${owned || A.cost > s.scrap ? 'disabled' : ''}>${owned ? 'OWNED' : '⚙ ' + A.cost}</button>
      </div>`;
    }
    html += `<p class="foot">Earn scrap by wrecking raiders. Clearing a stage pays a bonus.</p></div>`;
    this.backTo = () => {
      const f = this.garageFrom;
      if (f === 'title') this.title();
      else if (f && f.startsWith('brief:')) this.brief(+f.split(':')[1]);
      else this.map();
    };
    const scroll = this.root.scrollTop;
    this.show(html, 'garage-screen');
    if (keepScroll) this.root.scrollTop = scroll;
  }

  buy(id) {
    const s = this.save;
    const u = UPGRADES.find((q) => q.id === id);
    const lv = s.upgrades[id] || 0;
    const cost = upgradeCost(u, lv);
    if (lv >= u.max || cost > s.scrap) return;
    s.scrap -= cost;
    s.upgrades[id] = lv + 1;
    this.api.persist();
    sfx.pickup();
    this.garage(this.garageFrom, true);
  }

  buyAmmo(k) {
    const s = this.save;
    const A = AMMO[k];
    if (s.ammo[k] || A.cost > s.scrap) return;
    s.scrap -= A.cost;
    s.ammo[k] = true;
    this.api.persist();
    sfx.pickup();
    this.garage(this.garageFrom, true);
  }

  settings(from = 'title') {
    if (from !== 'self') this.settingsFrom = from;
    const st = this.save.settings;
    const tog = (k, label) => `<button class="toggle ${st[k] ? 'on' : ''}" data-act="toggle" data-arg="${k}"><span>${label}</span><i>${st[k] ? 'ON' : 'OFF'}</i></button>`;
    this.show(`
      <div class="panel">
        <h2>SETTINGS</h2>
        ${tog('sfx', 'Sound effects')}
        ${tog('music', 'Music')}
        ${tog('shake', 'Screen shake')}
        <button class="toggle on" data-act="toggle" data-arg="aim"><span>Aim style</span><i>${st.aim === 'point' ? 'POINT' : 'SLINGSHOT'}</i></button>
        <p class="foot">${st.aim === 'point' ? 'Point: touch where you want to shoot. Farther from the cannon = more power.' : 'Slingshot: drag back anywhere and release. Longer pull = more power.'}</p>
        <button class="btn" data-act="back">DONE</button>
        ${this.settingsFrom === 'title' ? '<button class="btn small danger" data-act="reset">RESET PROGRESS</button>' : ''}
      </div>`, 'settings-screen');
    this.backTo = () => (this.settingsFrom === 'pause' ? this.pause() : this.title());
  }

  toggleSetting(k) {
    const st = this.save.settings;
    if (k === 'aim') st.aim = st.aim === 'point' ? 'sling' : 'point';
    else st[k] = !st[k];
    this.api.applySettings();
    this.settings('self');
  }

  howto(from = 'title') {
    this.show(`
      <div class="panel howto">
        <h2>HOW TO PLAY</h2>
        <ul>
          <li><b>AIM & FIRE:</b> drag back anywhere on the screen and release, like a slingshot. Pull further for more power. The dotted line shows your arc.</li>
          <li><b>PROTECT THE RIG:</b> raiders ram you, lob shells and drop bombs. If your armor hits zero, the water is lost.</li>
          <li><b>SHOOT SHELLS DOWN:</b> enemy shells and bombs can be blown out of the sky for bonus scrap.</li>
          <li><b>☠ HUMAN CANNONBALL:</b> wrecking raiders fills your skull meter. When it's full, tap the skull and fire <i>yourself</i> — you smash through everything and land with a huge blast.</li>
          <li><b>SPECIAL AMMO:</b> buy Scatter, Napalm and Thunder Kegs in the Garage. Pick them on the right side of the HUD.</li>
          <li><b>SUPPLY CRATES:</b> parachute crates drop now and then. Shoot them for repairs, ammo or scrap.</li>
          <li><b>WARLORDS:</b> bosses have glowing weak points. Grey ones are armored until you break the others.</li>
          <li><b>KEYBOARD:</b> 1–4 switch ammo, SPACE arms the Human Cannonball, P / ESC pauses.</li>
        </ul>
        <button class="btn" data-act="back">GOT IT</button>
      </div>`, 'howto-screen');
    this.backTo = () => (from === 'pause' ? this.pause() : this.title());
  }

  pause() {
    this.show(`
      <div class="panel pause">
        <h2>PAUSED</h2>
        <button class="btn big" data-act="resume">RESUME</button>
        <button class="btn" data-act="restart">RESTART</button>
        <div class="row">
          <button class="btn small" data-act="settings" data-arg="pause">SETTINGS</button>
          <button class="btn small" data-act="howto" data-arg="pause">HOW TO</button>
        </div>
        <button class="btn danger" data-act="quit">QUIT TO MAP</button>
      </div>`, 'pause-screen');
  }

  result(r, info) {
    // info: { stageIndex, bonus, total, firstClear, next, newBest }
    const won = r.won;
    let body;
    if (r.endless) {
      body = `<div class="stats">
          <div><span>Distance</span><b>${r.meters} m ${info.newBest ? '<em>NEW BEST!</em>' : ''}</b></div>
          <div><span>Raiders wrecked</span><b>${r.kills}</b></div>
          <div><span>Scrap salvaged</span><b>⚙ ${info.total}</b></div>
        </div>`;
    } else {
      body = `
        ${won ? `<div class="big-stars">${starStr(r.stars)}</div>` : ''}
        <div class="stats">
          <div><span>Raiders wrecked</span><b>${r.kills}</b></div>
          <div><span>Armor left</span><b>${Math.round(r.hpFrac * 100)}%</b></div>
          <div><span>Scrap collected</span><b>⚙ ${r.scrap}</b></div>
          ${won ? `<div><span>Clear bonus</span><b>⚙ ${info.bonus}</b></div>` : `<div><span>Salvaged (60%)</span><b>⚙ ${info.total}</b></div>`}
        </div>`;
    }
    const nextBtn = won && info.next != null ? `<button class="btn big" data-act="next" data-arg="${info.next}">NEXT STAGE →</button>` : '';
    this.show(`
      <div class="panel result ${won ? 'won' : 'lost'}">
        <h2>${r.endless ? 'RUN OVER' : won ? (STAGES[info.stageIndex].boss ? 'WARLORD SLAIN!' : 'ROAD CLEAR!') : 'WRECKED!'}</h2>
        ${body}
        ${nextBtn}
        <div class="row">
          <button class="btn" data-act="restart">${won ? 'REPLAY' : 'RETRY'}</button>
          <button class="btn" data-act="garage" data-arg="map">🔧 GARAGE</button>
        </div>
        <button class="btn small" data-act="map">MAP</button>
      </div>`, 'result-screen');
  }

  // ---------------- HUD ----------------
  showHud(on) {
    this.hud.hidden = !on;
    this.hudCache = {};
  }

  buildAmmo(b) {
    const keys = AMMO_ORDER.filter((k) => k in b.ammoCount);
    $('#ammo-bar').innerHTML = keys.length > 1
      ? keys.map((k, i) => `<button class="ammo-btn" data-ammo="${k}"><span class="ai">${ICON[k]}</span><span class="an">${AMMO[k].short}</span><span class="ac" id="ac-${k}"></span><span class="key">${i + 1}</span></button>`).join('')
      : '';
  }

  updateHud(b) {
    const c = this.hudCache;
    const set = (key, val, fn) => {
      if (c[key] !== val) {
        c[key] = val;
        fn(val);
      }
    };
    if (c.battle !== b) {
      c.battle = b;
      this.buildAmmo(b);
      c.ammoSig = null;
    }
    const hpPct = Math.max(0, Math.round((b.hp / b.maxHp) * 100));
    set('hp', hpPct, (v) => {
      $('#hp-fill').style.width = v + '%';
      $('#hp-fill').className = v < 30 ? 'low' : '';
      $('#hp-num').textContent = Math.ceil(b.hp);
    });
    set('scrap', b.scrap, (v) => ($('#scrap-num').textContent = v));
    const boss = b.boss;
    set('bossOn', !!boss, (v) => {
      $('#boss-bar').hidden = !v;
      $('#prog').hidden = v;
      if (v) $('#boss-name').textContent = boss.name;
    });
    if (boss) set('bossHp', Math.round(b.progress() * 1000), (v) => ($('#boss-fill').style.width = v / 10 + '%'));
    else if (b.stage.endless) set('prog', b.meters(), (v) => {
      $('#prog-fill').style.width = '100%';
      $('#prog-label').textContent = v + ' m';
    });
    else if (b.stage.boss) set('prog', 'boss', () => {
      $('#prog-fill').style.width = '100%';
      $('#prog-label').textContent = '☠ WARLORD AHEAD';
    });
    else set('prog', Math.round(b.progress() * 100), (v) => {
      $('#prog-fill').style.width = v + '%';
      $('#prog-label').textContent = v >= 100 ? 'CLEAR THE ROAD!' : 'TO CHECKPOINT ' + v + '%';
    });
    const m = Math.floor(b.meter);
    set('meter', m + (b.armed ? 'a' : '') + (b.hero ? 'h' : ''), () => {
      const el = $('#btn-special');
      el.style.setProperty('--fill', m + '%');
      el.classList.toggle('ready', m >= 100 && !b.hero);
      el.classList.toggle('armed', b.armed);
    });
    const sig = AMMO_ORDER.map((k) => (k in b.ammoCount ? b.ammoCount[k] : '')).join(',') + b.ammo;
    set('ammoSig', sig, () => {
      for (const k in b.ammoCount) {
        const el = $(`#ac-${k}`);
        if (!el) continue;
        el.textContent = k === 'iron' ? '∞' : b.ammoCount[k];
        const btn = el.parentElement;
        btn.classList.toggle('sel', b.ammo === k);
        btn.classList.toggle('empty', k !== 'iron' && b.ammoCount[k] <= 0);
      }
    });
  }
}
