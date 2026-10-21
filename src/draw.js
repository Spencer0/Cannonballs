// All procedural artwork. World space: x right, y down, ground at y = 0.

// Older Safari lacks roundRect; plain rectangles are a fine fallback.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
  };
}

export function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export function vnoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

let F = false; // flash-white mode for hit feedback
const c = (col) => (F ? '#ffffff' : col);

function poly(ctx, pts, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = c(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = c(stroke);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = c(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = c(stroke);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function rrect(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = c(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = c(stroke);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
function line(ctx, x1, y1, x2, y2, col, lw = 2) {
  ctx.strokeStyle = c(col);
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function wheel(ctx, x, y, r, rot, tire = '#1b1512') {
  circle(ctx, x, y, r, tire);
  // tread knobs
  ctx.fillStyle = c('#2c2420');
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.13, 0, 6.283);
    ctx.fill();
  }
  circle(ctx, x, y, r * 0.52, '#6a6560');
  ctx.strokeStyle = c('#3c3835');
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  circle(ctx, x, y, r * 0.16, '#a9a39b');
}

function spikes(ctx, x, y0, y1, n, len, col = '#c9c2b5') {
  const step = (y1 - y0) / n;
  ctx.fillStyle = c(col);
  for (let i = 0; i < n; i++) {
    const y = y0 + i * step;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + step / 2);
    ctx.lineTo(x, y + step);
    ctx.closePath();
    ctx.fill();
  }
}

function warboyHead(ctx, x, y, r = 5.5) {
  circle(ctx, x, y, r, '#e9e0d2', '#2a1a12', 1.2);
  // black eye paint
  ctx.fillStyle = c('#1a1010');
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.1, r * 0.35, r * 0.25, 0, 0, 6.283);
  ctx.fill();
  line(ctx, x + r * 0.2, y + r * 0.45, x - r * 0.7, y + r * 0.45, '#1a1010', 1);
}

// ---------------- Background ----------------

let stars = null;
export function drawBackground(ctx, R, dist, W, GY, H, time) {
  // sky
  const g = ctx.createLinearGradient(0, -GY, 0, 0);
  g.addColorStop(0, R.sky[0]);
  g.addColorStop(0.62, R.sky[1]);
  g.addColorStop(1, R.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -GY - 20, W + 40, GY + 22);

  if (R.night) {
    if (!stars) stars = Array.from({ length: 90 }, (_, i) => [hash(i * 3.1), hash(i * 7.7), hash(i * 1.3)]);
    for (const [sx, sy, sb] of stars) {
      ctx.globalAlpha = 0.25 + 0.6 * sb * (0.7 + 0.3 * Math.sin(time * 2 + sx * 40));
      ctx.fillStyle = '#ffe8d0';
      ctx.fillRect(sx * W, -GY + sy * GY * 0.6, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // sun with glow
  const sx = W * 0.7;
  const sy = -GY + GY * R.sunY;
  const sr = Math.min(70, GY * 0.13);
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
  sg.addColorStop(0, R.sun + 'aa');
  sg.addColorStop(1, R.sun + '00');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  ctx.fillStyle = R.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, 6.283);
  ctx.fill();

  // far layer
  ctx.fillStyle = R.far;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  const off1 = dist * 0.05;
  for (let x = -10; x <= W + 10; x += 6) {
    const wx = (x + off1) / 1;
    let h;
    if (R.mesa) {
      const n = vnoise(wx / 230);
      h = 18 + smooth(0.52, 0.58, n) * (70 + 40 * vnoise(wx / 90 + 9)) + 6 * vnoise(wx / 25);
    } else if (R.canyon) {
      h = 120 + 120 * vnoise(wx / 160) + 25 * vnoise(wx / 35 + 3);
    } else {
      const b = Math.floor(wx / 34);
      h = 30 + Math.floor(hash(b) * 5) * 22 + (hash(b * 1.7) > 0.82 ? 70 : 0);
    }
    ctx.lineTo(x, -Math.min(h, GY * 0.75));
  }
  ctx.lineTo(W + 10, 2);
  ctx.closePath();
  ctx.fill();

  if (R.night) {
    // flare stacks on the far citadel
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 260 - off1 * 1) % (W + 300) + W + 300) % (W + 300) - 150;
      const b = Math.floor((bx + off1) / 34);
      const hh = 30 + Math.floor(hash(b) * 5) * 22 + 70;
      const fl = 8 + 4 * Math.sin(time * 13 + i);
      ctx.fillStyle = '#ff7a2a';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(bx, -Math.min(hh, GY * 0.75) - fl, 4, fl, 0, 0, 6.283);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // mid layer
  ctx.fillStyle = R.mid;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  const off2 = dist * 0.2;
  for (let x = -10; x <= W + 10; x += 6) {
    const wx = x + off2;
    const h = R.canyon ? 50 + 60 * vnoise(wx / 120 + 50) + 10 * vnoise(wx / 20) : 16 + 26 * vnoise(wx / 170 + 20) + 7 * vnoise(wx / 45);
    ctx.lineTo(x, -h);
  }
  ctx.lineTo(W + 10, 2);
  ctx.closePath();
  ctx.fill();

  // haze
  const hz = ctx.createLinearGradient(0, -120, 0, 0);
  hz.addColorStop(0, R.sky[2] + '00');
  hz.addColorStop(1, R.sky[2] + '66');
  ctx.fillStyle = hz;
  ctx.fillRect(-10, -120, W + 20, 122);

  // near dunes
  ctx.fillStyle = R.near;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  const off3 = dist * 0.55;
  for (let x = -10; x <= W + 10; x += 6) {
    const wx = x + off3;
    ctx.lineTo(x, -(6 + 14 * vnoise(wx / 110 + 70)));
  }
  ctx.lineTo(W + 10, 2);
  ctx.closePath();
  ctx.fill();
}

export function drawGround(ctx, R, dist, W, depth) {
  const gg = ctx.createLinearGradient(0, 0, 0, depth);
  gg.addColorStop(0, R.ground);
  gg.addColorStop(1, R.groundDark);
  ctx.fillStyle = gg;
  ctx.fillRect(-20, -4, W + 40, depth + 10);
  // road
  ctx.fillStyle = R.road;
  ctx.fillRect(-20, -4, W + 40, 34);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-20, -4, W + 40, 4);
  ctx.fillRect(-20, 26, W + 40, 4);
  // dashes
  ctx.fillStyle = R.roadLine;
  ctx.globalAlpha = 0.55;
  const off = dist % 70;
  for (let x = -off - 10; x < W + 70; x += 70) ctx.fillRect(x, 12, 30, 3);
  ctx.globalAlpha = 1;
  // pebbles / cracks scroll with the road
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  const b0 = Math.floor(dist / 23);
  for (let b = b0; b < b0 + W / 23 + 2; b++) {
    const x = b * 23 - dist;
    const y = 36 + hash(b) * (depth - 40);
    const s = 1 + hash(b * 3.3) * 3;
    ctx.fillRect(x, y, s * 2, s);
  }
  ctx.fillStyle = 'rgba(255,240,210,0.08)';
  for (let b = b0; b < b0 + W / 23 + 2; b++) {
    const x = b * 23 - dist + 9;
    const y = 40 + hash(b * 9.1) * (depth - 44);
    ctx.fillRect(x, y, 3, 1.5);
  }
}

// Decorative roadside junk.
export function drawProp(ctx, kind, x, y, s, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  F = false;
  switch (kind) {
    case 'wreck':
      poly(ctx, [-30, 0, -26, -14, -10, -16, -4, -26, 14, -26, 22, -14, 32, -10, 30, 0], col);
      circle(ctx, -16, -2, 7, col);
      circle(ctx, 18, -1, 7, col);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(-2, -23, 13, 7);
      break;
    case 'skull':
      line(ctx, 0, 0, 0, -36, col, 3);
      line(ctx, -8, -28, 8, -28, col, 2.5);
      circle(ctx, 0, -42, 7, '#e8dccb');
      ctx.fillStyle = '#2a1a12';
      ctx.fillRect(-4, -44, 3, 3);
      ctx.fillRect(1, -44, 3, 3);
      break;
    case 'tire':
      circle(ctx, 0, -9, 9, col);
      circle(ctx, 0, -9, 4, 'rgba(0,0,0,0.35)');
      circle(ctx, 12, -6, 6, col);
      break;
    case 'sign':
      line(ctx, 0, 0, 0, -40, col, 3);
      poly(ctx, [-16, -46, 18, -46, 24, -40, 18, -34, -16, -34], '#9a6a3a', col, 1.5);
      ctx.fillStyle = '#3a2010';
      ctx.font = '8px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HAVEN →', 2, -37);
      break;
    case 'bones':
      ctx.strokeStyle = '#d8ccb8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(-14 + i * 4, -2);
        ctx.quadraticCurveTo(-2, -26 - i * 3, 14 + i * 5, -2);
      }
      ctx.stroke();
      break;
    case 'tree':
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(2, -30);
      ctx.lineTo(-8, -44);
      ctx.moveTo(2, -30);
      ctx.lineTo(12, -40);
      ctx.lineTo(16, -52);
      ctx.moveTo(12, -40);
      ctx.lineTo(22, -42);
      ctx.stroke();
      break;
    case 'derrick':
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(0, -70);
      ctx.lineTo(14, 0);
      for (let i = 1; i < 5; i++) {
        const yy = -i * 14;
        const w = 14 * (1 - i / 5);
        ctx.moveTo(-w, yy);
        ctx.lineTo(w, yy - 14);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------------- Player rig ----------------

export function drawRig(ctx, r) {
  // r: { x0, t, angle, recoil, flash, armed, heroAway, reloadFrac, wheelRot, damage }
  F = false;
  ctx.save();
  ctx.translate(r.x0, r.bounce || 0);
  const rot = r.wheelRot;
  F = r.flash > 0;
  // chassis
  rrect(ctx, 2, -34, 160, 14, 3, '#2a1e17');
  // water tank
  const tg = ctx.createLinearGradient(0, -72, 0, -30);
  tg.addColorStop(0, F ? '#fff' : '#a3a8ab');
  tg.addColorStop(0.45, F ? '#fff' : '#7b8186');
  tg.addColorStop(1, F ? '#fff' : '#4b5054');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(0, -72, 98, 42, 18);
  ctx.fill();
  ctx.strokeStyle = c('#2c2a28');
  ctx.lineWidth = 2;
  ctx.stroke();
  // rust patches + bands
  if (!F) {
    ctx.fillStyle = 'rgba(140,64,24,0.55)';
    ctx.beginPath();
    ctx.ellipse(18, -40, 12, 6, 0.3, 0, 6.283);
    ctx.ellipse(76, -62, 9, 4, -0.2, 0, 6.283);
    ctx.fill();
  }
  for (const bx of [24, 50, 76]) {
    ctx.fillStyle = c('#3f4246');
    ctx.fillRect(bx - 2, -72, 4, 42);
  }
  ctx.fillStyle = c('#e8f4f8');
  ctx.font = 'bold 13px "Black Ops One", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H₂O', 37, -50);
  // damage scorch
  if (r.damage > 0.5 && !F) {
    ctx.fillStyle = `rgba(20,10,5,${(r.damage - 0.5) * 1.2})`;
    ctx.beginPath();
    ctx.ellipse(62, -46, 20, 12, 0, 0, 6.283);
    ctx.ellipse(130, -40, 14, 10, 0, 0, 6.283);
    ctx.fill();
  }
  // deck
  rrect(ctx, 8, -77, 88, 6, 1, '#6b4426', '#3a2414', 1);
  // smokestacks
  rrect(ctx, 97, -100, 5, 70, 1, '#b8b2a8', '#4a4640', 1);
  rrect(ctx, 90, -92, 4, 22, 1, '#b8b2a8', '#4a4640', 1);
  // cab
  poly(ctx, [104, -24, 104, -76, 132, -76, 152, -54, 164, -50, 164, -24], '#a8542a', '#3b1d0e', 2);
  poly(ctx, [110, -71, 130, -71, 145, -55, 110, -55], '#2e5a66', '#1b2a2e', 1.5);
  if (!F) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(114, -69);
    ctx.lineTo(120, -69);
    ctx.lineTo(114, -59);
    ctx.fill();
  }
  // driver silhouette
  circle(ctx, 120, -62, 4.5, '#1c1410');
  line(ctx, 106, -48, 150, -48, '#6a2e14', 1.5);
  // grille + skull ornament
  for (let i = 0; i < 4; i++) line(ctx, 156, -46 + i * 5, 164, -46 + i * 5, '#3b1d0e', 1.5);
  circle(ctx, 150, -56, 4, '#e8dccb');
  // ram + spikes
  poly(ctx, [160, -34, 172, -30, 172, -18, 160, -18], '#4a4440', '#222', 1.5);
  spikes(ctx, 172, -34, -16, 3, 9);
  // wheels
  wheel(ctx, 22, -14, 14, rot);
  wheel(ctx, 50, -14, 14, rot);
  wheel(ctx, 138, -15, 15, rot);
  // mudflap chains
  line(ctx, 66, -20, 68, -6, '#5a5550', 1.5);

  // cannon mount
  poly(ctx, [42, -76, 62, -76, 58, -90, 46, -90], '#3a3633', '#1b1917', 1.5);
  // gunner (Cannonball himself)
  if (!r.armed && !r.heroAway) drawGunner(ctx, 26, -77, r.t, r.angle);
  // barrel
  ctx.save();
  ctx.translate(52, -86);
  ctx.rotate(r.angle);
  ctx.translate(-r.recoil, 0);
  circle(ctx, -12, 0, 7, '#2a2826');
  poly(ctx, [-12, -10, 34, -7.5, 34, 7.5, -12, 10], r.armed ? '#5a1a10' : '#34312e', '#141312', 1.5);
  if (!F) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-10, -7, 42, 3);
  }
  rrect(ctx, 30, -10, 9, 20, 2, '#24221f');
  rrect(ctx, 6, -10, 5, 20, 1, '#24221f');
  if (r.armed) {
    // mohawk sticking out of the muzzle
    ctx.fillStyle = '#e0371f';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(38, -5 + i * 3);
      ctx.lineTo(46 + Math.sin(r.t * 20 + i) * 2, -6 + i * 3.5);
      ctx.lineTo(38, -3 + i * 3);
      ctx.fill();
    }
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(r.t * 12);
    circle(ctx, 14, 0, 18, null, '#ff5a2a', 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // reload indicator
  if (r.reloadFrac > 0 && !r.armed) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(52, -86, 20, 0, 6.283);
    ctx.stroke();
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(52, -86, 20, -Math.PI / 2, -Math.PI / 2 + (1 - r.reloadFrac) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  F = false;
}

function drawGunner(ctx, x, y, t, angle) {
  const bob = Math.sin(t * 9) * 0.8;
  // legs
  line(ctx, x - 4, y, x - 5, y - 8, '#2c2018', 3);
  line(ctx, x + 4, y, x + 5, y - 8, '#2c2018', 3);
  // round iron body
  const by = y - 19 + bob;
  const g = ctx.createRadialGradient(x - 4, by - 4, 2, x, by, 13);
  g.addColorStop(0, F ? '#fff' : '#8a8e94');
  g.addColorStop(1, F ? '#fff' : '#2f3236');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, by, 12, 0, 6.283);
  ctx.fill();
  // leather strap
  line(ctx, x - 9, by - 8, x + 8, by + 9, '#6a3a1a', 3);
  // arm toward the cannon breech
  const hx = 40 + Math.cos(angle) * -6;
  const hy = -86 + Math.sin(angle) * -6;
  line(ctx, x + 8, by - 3, hx, hy, '#c08a5a', 3.5);
  // head
  const hy2 = by - 17;
  circle(ctx, x, hy2, 7, '#c99268', '#4a2a14', 1);
  // goggles
  rrect(ctx, x - 1, hy2 - 3, 9, 4, 2, '#e8b04a', '#2a1a0a', 1);
  line(ctx, x - 7, hy2 - 1, x - 1, hy2 - 1, '#2a1a0a', 1.5);
  // mohawk
  ctx.fillStyle = c('#e0371f');
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.85 + i * 0.32;
    const sx = x + Math.cos(a) * 6;
    const sy = hy2 + Math.sin(a) * 6;
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy);
    ctx.lineTo(x + Math.cos(a) * 13, hy2 + Math.sin(a) * 13 + Math.sin(t * 7 + i) * 0.8);
    ctx.lineTo(sx + 2, sy);
    ctx.fill();
  }
}

// The hero, curled into a living cannonball.
export function drawHero(ctx, x, y, rot, scale = 1) {
  F = false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(rot);
  ctx.fillStyle = '#e0371f';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 - 0.9 + i * 0.36;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.12) * 13, Math.sin(a - 0.12) * 13);
    ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    ctx.lineTo(Math.cos(a + 0.12) * 13, Math.sin(a + 0.12) * 13);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 16);
  g.addColorStop(0, '#9aa0a6');
  g.addColorStop(1, '#25282c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, 6.283);
  ctx.fill();
  rrect(ctx, -2, -8, 12, 5, 2, '#e8b04a', '#2a1a0a', 1);
  line(ctx, -12, 6, 12, -2, '#6a3a1a', 3);
  ctx.restore();
}

// ---------------- Enemies ----------------

export function drawEnemy(ctx, e, t) {
  F = e.flash > 0;
  ctx.save();
  ctx.translate(e.x, e.y + (e.bob || 0));
  if (e.dir > 0) ctx.scale(-1, 1); // art faces left by default
  if (e.tilt) ctx.rotate(e.tilt);
  const rot = -t * 10;
  switch (e.type) {
    case 'buggy':
    case 'chaser': {
      const body = e.type === 'chaser' ? '#5d6b3a' : '#9a3b22';
      wheel(ctx, -16, -9, 9, rot);
      wheel(ctx, 17, -9, 9, rot);
      poly(ctx, [-28, -12, -22, -22, 6, -24, 26, -20, 28, -12, 20, -8, -20, -8], body, '#2a120a', 1.5);
      // roll cage
      ctx.strokeStyle = c('#2b2522');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -23);
      ctx.lineTo(-4, -36);
      ctx.lineTo(12, -36);
      ctx.lineTo(18, -22);
      ctx.stroke();
      warboyHead(ctx, 4, -29);
      spikes(ctx, -28, -22, -8, 3, -8);
      // exhaust flame
      if (!F && Math.sin(t * 40 + e.seed) > 0) {
        ctx.fillStyle = '#ffb040';
        ctx.beginPath();
        ctx.moveTo(26, -20);
        ctx.lineTo(36 + Math.random() * 6, -23);
        ctx.lineTo(26, -25);
        ctx.fill();
      }
      if (e.type === 'chaser') {
        // firebomb in hand
        circle(ctx, -6, -34, 3, '#6a8a40');
      }
      break;
    }
    case 'biker': {
      wheel(ctx, -14, -9, 9, rot);
      wheel(ctx, 14, -9, 9, rot);
      poly(ctx, [-16, -12, -8, -20, 10, -20, 16, -12, 4, -10], '#3a3a3e', '#151515', 1.5);
      line(ctx, -14, -9, -8, -24, '#8a8a8a', 2);
      line(ctx, -10, -24, -4, -26, '#8a8a8a', 2);
      // rider
      line(ctx, 2, -20, -2, -32, '#5a3a24', 5);
      line(ctx, -2, -30, -9, -24, '#c99a7a', 2.5);
      warboyHead(ctx, -3, -37, 5);
      if (!e.thrown) {
        // lance over shoulder
        line(ctx, 8, -26, -12, -50, '#7a5a3a', 2);
        circle(ctx, -12, -50, 3.5, '#c43a1a');
      }
      break;
    }
    case 'shooter': {
      wheel(ctx, -22, -10, 10, rot);
      wheel(ctx, 22, -10, 10, rot);
      poly(ctx, [-32, -12, -30, -30, 30, -30, 32, -12], '#6b5a3a', '#2a1e10', 1.5);
      for (let i = -24; i < 30; i += 12) line(ctx, i, -30, i, -12, '#4a3c24', 1.5);
      // mortar tube angled back toward rig (art faces left)
      ctx.save();
      ctx.translate(4, -32);
      ctx.rotate(-2.25 + (e.recoil || 0) * 0.3);
      rrect(ctx, -3, -7, 30, 14, 3, '#2d2a28', '#111', 1.5);
      ctx.restore();
      warboyHead(ctx, 20, -36);
      break;
    }
    case 'tank': {
      for (const wx of [-34, -12, 12, 34]) wheel(ctx, wx, -12, 12, rot);
      poly(ctx, [-50, -18, -44, -46, 40, -50, 48, -18], '#4a4f45', '#1a1c18', 2);
      // armor plates
      for (let i = 0; i < 4; i++) rrect(ctx, -40 + i * 21, -44, 18, 22, 2, '#5f6556', '#262922', 1.2);
      // ram plow
      poly(ctx, [-50, -46, -62, -22, -50, -6], '#8a8070', '#222', 1.5);
      spikes(ctx, -62, -40, -8, 4, -10);
      // stacks w/ fire
      rrect(ctx, 26, -66, 6, 18, 1, '#9a9488');
      if (!F) {
        ctx.fillStyle = '#ff9a30';
        ctx.beginPath();
        ctx.ellipse(29, -70 - Math.random() * 3, 3, 6, 0, 0, 6.283);
        ctx.fill();
      }
      warboyHead(ctx, -20, -54, 6);
      break;
    }
    case 'gyro': {
      // rotor
      ctx.strokeStyle = c('#2a2522');
      ctx.lineWidth = 3;
      const s = Math.sin(t * 50) * 30;
      line(ctx, 0, -10, 0, -22, '#3a3330', 3);
      ctx.globalAlpha = 0.7;
      line(ctx, -s, -22, s, -22, '#3a3330', 3);
      ctx.globalAlpha = 1;
      // body
      poly(ctx, [-22, -2, -14, -12, 14, -12, 26, -6, 30, 4, 14, 8, -14, 8], '#b0782a', '#3a2008', 1.5);
      line(ctx, 26, -2, 40, -4, '#5a4020', 2);
      // tail rotor
      circle(ctx, 40, -4, 5, null, '#3a3330', 1.5);
      warboyHead(ctx, -6, -6, 5);
      line(ctx, -14, 8, -14, 14, '#2a2522', 2);
      line(ctx, 10, 8, 10, 14, '#2a2522', 2);
      line(ctx, -18, 14, 14, 14, '#2a2522', 2);
      break;
    }
    case 'tower': {
      ctx.strokeStyle = c('#3a2416');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-10, -96);
      ctx.moveTo(18, 0);
      ctx.lineTo(10, -96);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const y0 = -i * 24;
        ctx.moveTo(-18 + i * 2, y0);
        ctx.lineTo(16 - i * 2, y0 - 24);
        ctx.moveTo(18 - i * 2, y0);
        ctx.lineTo(-16 + i * 2, y0 - 24);
      }
      ctx.stroke();
      rrect(ctx, -22, -122, 44, 28, 2, '#6a4628', '#2a170a', 2);
      poly(ctx, [-26, -122, 0, -136, 26, -122], '#4a2e18', '#2a170a', 1.5);
      warboyHead(ctx, -6, -108);
      line(ctx, -8, -104, -26, -110, '#2a2522', 2.5);
      circle(ctx, 14, -132, 4, '#e8dccb');
      break;
    }
    case 'spikewall': {
      poly(ctx, [-14, 0, -10, -40, 10, -44, 14, 0], '#5a3a22', '#2a170a', 2);
      for (let i = 0; i < 4; i++) line(ctx, -12, -8 - i * 10, 12, -10 - i * 10, '#3a2414', 2);
      spikes(ctx, -14, -42, -2, 5, -14, '#bdb6aa');
      break;
    }
    case 'barrel': {
      rrect(ctx, -11, -30, 22, 30, 3, '#b0261a', '#3a0a06', 1.5);
      ctx.fillStyle = c('#f0c030');
      ctx.fillRect(-11, -21, 22, 4);
      ctx.fillRect(-11, -11, 22, 4);
      ctx.fillStyle = c('#2a0a06');
      ctx.font = 'bold 9px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('☠', 0, -24);
      break;
    }
  }
  ctx.restore();
  F = false;
}

export function drawCrate(ctx, k) {
  F = k.flash > 0;
  ctx.save();
  ctx.translate(k.x, k.y);
  if (!k.landed) {
    // parachute
    ctx.strokeStyle = 'rgba(40,20,10,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.lineTo(-24, -44);
    ctx.moveTo(12, -14);
    ctx.lineTo(24, -44);
    ctx.stroke();
    ctx.fillStyle = c('#d8c8a0');
    ctx.beginPath();
    ctx.moveTo(-28, -44);
    ctx.quadraticCurveTo(0, -78, 28, -44);
    ctx.quadraticCurveTo(0, -52, -28, -44);
    ctx.fill();
    ctx.fillStyle = c('#b03a22');
    ctx.beginPath();
    ctx.moveTo(-8, -48);
    ctx.quadraticCurveTo(0, -70, 8, -48);
    ctx.fill();
  }
  rrect(ctx, -13, -13, 26, 26, 2, '#8a6436', '#3a2410', 2);
  line(ctx, -13, -13, 13, 13, '#3a2410', 2);
  line(ctx, 13, -13, -13, 13, '#3a2410', 2);
  circle(ctx, 0, 0, 7, '#f0c030', '#3a2410', 1.5);
  ctx.fillStyle = '#3a2410';
  ctx.font = 'bold 10px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', 0, 1);
  ctx.restore();
  F = false;
}

// ---------------- Projectiles ----------------

export function drawBall(ctx, s) {
  if (s.kind === 'thunder') {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot || 0);
    rrect(ctx, -9, -8, 18, 16, 4, '#7a4b22', '#2a170a', 1.5);
    ctx.fillStyle = '#2a170a';
    ctx.fillRect(-9, -4, 18, 2);
    ctx.fillRect(-9, 2, 18, 2);
    ctx.restore();
  } else if (s.kind === 'napalm') {
    circle(ctx, s.x, s.y, s.r, '#c4471c', '#3a1206', 1.5);
    circle(ctx, s.x - 2, s.y - 2, 2.5, '#ffb070');
  } else {
    const g = ctx.createRadialGradient(s.x - s.r * 0.35, s.y - s.r * 0.35, 1, s.x, s.y, s.r);
    g.addColorStop(0, '#8a8a8a');
    g.addColorStop(1, '#111');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.283);
    ctx.fill();
  }
}

export function drawHostile(ctx, h, t) {
  ctx.save();
  ctx.translate(h.x, h.y);
  if (h.kind === 'lance') {
    ctx.rotate(Math.atan2(h.vy, h.vx));
    line(ctx, -18, 0, 10, 0, '#7a5a3a', 2.5);
    circle(ctx, 12, 0, 4, '#c43a1a');
  } else if (h.kind === 'bomb') {
    ctx.rotate(Math.atan2(h.vy, h.vx) - Math.PI / 2);
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 8, 0, 0, 6.283);
    ctx.fill();
    poly(ctx, [-5, -6, 5, -6, 7, -12, -7, -12], '#4a4440');
  } else if (h.kind === 'molotov') {
    ctx.rotate(t * 12);
    rrect(ctx, -3, -7, 6, 12, 2, '#5a8a3a', '#1a2a10', 1);
    ctx.fillStyle = '#ffa030';
    ctx.beginPath();
    ctx.ellipse(0, -10, 3, 5, 0, 0, 6.283);
    ctx.fill();
  } else if (h.kind === 'flame') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff7a20';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, 6.283);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // shell
    circle(ctx, 0, 0, h.r, '#1a1716', '#000', 1);
    circle(ctx, -h.r * 0.35, -h.r * 0.35, h.r * 0.3, '#5a5550');
    // fuse spark
    ctx.fillStyle = Math.sin(t * 60) > 0 ? '#fff4a0' : '#ff8a30';
    ctx.beginPath();
    ctx.arc(h.r * 0.6, -h.r * 0.8, 2.5, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------- Bosses ----------------

function partDead(b, name) {
  const p = b.parts.find((q) => q.name === name);
  return !p || p.hp <= 0;
}

export function drawBoss(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.s, b.s);
  const rot = -t * 8;
  F = b.flash > 0;
  if (b.kind === 'behemoth') {
    for (const wx of [-120, -56, 56, 120]) wheel(ctx, wx, -24, 24, rot);
    // hull
    poly(ctx, [-150, -40, -150, -112, 150, -112, 158, -40], '#5c3420', '#1e0f08', 3);
    for (let i = 0; i < 7; i++) rrect(ctx, -140 + i * 41, -106, 36, 30, 3, '#7a4428', '#2a140a', 1.5);
    // rivets
    ctx.fillStyle = c('#2a140a');
    for (let i = 0; i < 20; i++) ctx.fillRect(-144 + i * 15, -50, 3, 3);
    // cab front (left)
    poly(ctx, [-150, -40, -150, -136, -96, -136, -82, -112, -82, -40], '#8a4a26', '#1e0f08', 3);
    poly(ctx, [-144, -130, -102, -130, -94, -112, -144, -112], '#2e4a50', '#111', 2);
    if (!partDead(b, 'cab')) {
      // Rustjaw: big iron jaw
      circle(ctx, -120, -120, 8, '#c99268');
      rrect(ctx, -128, -116, 16, 7, 2, '#8a8e94', '#222', 1);
    }
    // front grille & spikes
    for (let i = 0; i < 6; i++) line(ctx, -150, -100 + i * 10, -138, -100 + i * 10, '#2a140a', 2);
    spikes(ctx, -150, -98, -40, 5, -22);
    circle(ctx, -150, -60, 9, '#e8dccb');
    // fuel tanks
    for (const [nm, x] of [['tankA', 20], ['tankB', 84]]) {
      if (partDead(b, nm)) {
        poly(ctx, [x - 26, -50, x - 20, -82, x + 4, -70, x + 18, -88, x + 26, -50], '#1c1410');
      } else {
        rrect(ctx, x - 28, -94, 56, 46, 18, '#c8a030', '#3a2a08', 2);
        ctx.fillStyle = c('#1a1a1a');
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x - 22 + i * 14, -94);
          ctx.lineTo(x - 14 + i * 14, -94);
          ctx.lineTo(x - 22 + i * 14, -48);
          ctx.lineTo(x - 30 + i * 14, -48);
          ctx.fill();
        }
      }
    }
    // stacks
    rrect(ctx, 120, -168, 9, 58, 2, '#9a9488', '#333', 1);
    rrect(ctx, 136, -156, 9, 46, 2, '#9a9488', '#333', 1);
    // turret
    if (!partDead(b, 'turret')) {
      rrect(ctx, -70, -136, 60, 26, 6, '#4a4440', '#1a1816', 2);
      ctx.save();
      ctx.translate(-40, -140);
      ctx.rotate(b.aim || -2.6);
      rrect(ctx, 0, -8, 52, 16, 3, '#2a2826', '#0a0a0a', 2);
      rrect(ctx, 44, -10, 10, 20, 2, '#1a1816');
      ctx.restore();
      circle(ctx, -40, -140, 16, '#3a3633', '#111', 2);
    } else {
      poly(ctx, [-70, -112, -64, -128, -50, -120, -36, -134, -14, -112], '#1c1410');
    }
  } else if (b.kind === 'vulture') {
    // ropes
    ctx.strokeStyle = c('#3a2414');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const x of [-60, -20, 20, 60]) {
      ctx.moveTo(x, 40);
      ctx.lineTo(x * 0.5, 66);
    }
    ctx.stroke();
    // balloon (patchwork)
    const g = ctx.createLinearGradient(0, -60, 0, 50);
    g.addColorStop(0, F ? '#fff' : '#c8b088');
    g.addColorStop(1, F ? '#fff' : '#6a4a30');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -5, 150, 55, 0, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = c('#3a2414');
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (!F) {
      ctx.fillStyle = 'rgba(120,40,30,0.45)';
      ctx.fillRect(-90, -40, 40, 30);
      ctx.fillRect(40, -10, 50, 26);
      ctx.fillStyle = 'rgba(40,40,60,0.35)';
      ctx.fillRect(-20, 10, 34, 24);
    }
    for (const x of [-100, -50, 0, 50, 100]) {
      ctx.beginPath();
      ctx.ellipse(0, -5, Math.abs(x) + 1, 55, 0, -Math.PI / 2, Math.PI / 2, x < 0);
      ctx.strokeStyle = 'rgba(40,20,10,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // skull emblem
    circle(ctx, 0, -12, 18, '#e8dccb', '#3a2414', 2);
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(-9, -18, 6, 6);
    ctx.fillRect(3, -18, 6, 6);
    ctx.fillRect(-5, -3, 10, 4);
    // engines
    for (const [nm, x] of [['rotorL', -142], ['rotorR', 142]]) {
      if (partDead(b, nm)) {
        circle(ctx, x, 4, 14, '#1c1410');
        continue;
      }
      rrect(ctx, x - 16, -8, 32, 24, 6, '#5a5550', '#1a1816', 2);
      const s = Math.sin(t * 45 + x) * 36;
      ctx.globalAlpha = 0.8;
      line(ctx, x, -8, x, -22, '#2a2522', 3);
      line(ctx, x - s, -24, x + s, -24, '#2a2522', 4);
      ctx.globalAlpha = 1;
    }
    // gondola
    poly(ctx, [-50, 62, 50, 62, 40, 96, -40, 96], '#6a4628', '#2a170a', 2.5);
    for (let i = -40; i <= 40; i += 16) line(ctx, i, 64, i * 0.85, 94, '#3a2414', 1.5);
    if (!partDead(b, 'gondola')) {
      // the Queen: feathered headdress
      circle(ctx, 0, 56, 8, '#d8c0a0');
      ctx.fillStyle = '#1a1010';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI + 0.3 + i * 0.42;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, 54 + Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 20, 52 + Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a + 0.15) * 7, 54 + Math.sin(a + 0.15) * 7);
        ctx.fill();
      }
    }
  } else if (b.kind === 'goliath') {
    for (const wx of [-150, -100, -20, 30, 110, 160]) wheel(ctx, wx, -26, 26, rot);
    // hull
    poly(ctx, [-180, -44, -170, -128, 190, -128, 196, -44], '#3a2a24', '#100806', 3);
    for (let i = 0; i < 8; i++) rrect(ctx, -164 + i * 44, -122, 38, 32, 3, '#4e3a30', '#1a0e0a', 1.5);
    // chains
    ctx.strokeStyle = c('#8a8478');
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(-160, -60);
    ctx.quadraticCurveTo(0, -30, 180, -60);
    ctx.stroke();
    ctx.setLineDash([]);
    // boiler core
    if (!partDead(b, 'boiler')) {
      rrect(ctx, -40, -150, 80, 78, 30, '#6a6058', '#1a1410', 3);
      const glow = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.fillStyle = F ? '#fff' : `rgba(255,${100 + glow * 80},30,${0.7 + glow * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, -110, 18, 0, 6.283);
      ctx.fill();
      for (let i = 0; i < 5; i++) line(ctx, -16 + i * 8, -126, -16 + i * 8, -94, '#2a1e18', 2);
    } else {
      poly(ctx, [-40, -80, -30, -130, -10, -112, 10, -150, 40, -80], '#120a08');
    }
    // stacks with fire
    for (const sx of [100, 124, 148]) {
      rrect(ctx, sx, -200, 12, 74, 2, '#7a746a', '#222', 1.5);
      if (!F) {
        ctx.fillStyle = '#ff8a20';
        ctx.beginPath();
        ctx.ellipse(sx + 6, -206 - Math.random() * 4, 6, 12, 0, 0, 6.283);
        ctx.fill();
      }
    }
    // snout flamethrower
    if (!partDead(b, 'snout')) {
      poly(ctx, [-170, -84, -208, -76, -212, -52, -170, -46], '#7a5a2a', '#1a1006', 2.5);
      circle(ctx, -210, -64, 10, '#1a1010', '#ff7a20', 2);
    } else {
      poly(ctx, [-170, -84, -186, -70, -176, -50, -170, -46], '#120a08');
    }
    spikes(ctx, -180, -124, -48, 6, -18);
    // turrets
    for (const [nm, x] of [['turretA', -96], ['turretB', 60]]) {
      if (partDead(b, nm)) {
        poly(ctx, [x - 26, -128, x - 18, -146, x, -136, x + 14, -150, x + 26, -128], '#120a08');
        continue;
      }
      rrect(ctx, x - 26, -152, 52, 26, 6, '#4a3e36', '#100806', 2);
      ctx.save();
      ctx.translate(x, -156);
      ctx.rotate(b.aims?.[nm] ?? -2.6);
      rrect(ctx, 0, -7, 46, 14, 3, '#221c18', '#000', 2);
      ctx.restore();
      circle(ctx, x, -156, 14, '#3a302a', '#100806', 2);
    }
    // Goliath himself, in a cage on top
    rrect(ctx, -150, -170, 40, 42, 3, null, '#8a8478', 2);
    circle(ctx, -130, -150, 9, '#c99268');
    rrect(ctx, -138, -164, 16, 8, 2, '#d8b040');
  }
  ctx.restore();
  F = false;
}
