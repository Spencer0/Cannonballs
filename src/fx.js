// Particle effects: fire, smoke, sparks, debris, dust, shockwaves and floating text.

const rand = (a, b) => a + Math.random() * (b - a);
const MAX = 900;

export class FX {
  constructor() {
    this.p = [];
    this.rings = [];
    this.texts = [];
  }

  add(o) {
    if (this.p.length >= MAX) this.p.splice(0, 40);
    o.max = o.life;
    this.p.push(o);
  }

  explosion(x, y, r = 40, opts = {}) {
    const n = Math.min(60, 10 + r * 0.45);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.2, 1) * r * 4;
      this.add({ k: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - r, life: rand(0.25, 0.6), size: rand(r * 0.18, r * 0.42), drag: 3.5, g: -60 });
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.1, 0.6) * r * 3;
      this.add({ k: 'smoke', x: x + rand(-r, r) * 0.4, y: y + rand(-r, r) * 0.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.8, 1.8), size: rand(r * 0.25, r * 0.5), grow: r * 0.9, drag: 2.5, g: -30, scroll: 0.5, shade: opts.dark ? 30 : rand(50, 90) });
    }
    for (let i = 0; i < n * 0.7; i++) {
      const a = rand(-Math.PI, 0);
      const s = rand(200, 520) * (0.6 + r / 120);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.2, 0.5), size: rand(1, 2.5), drag: 1.5, g: 500 });
    }
    if (opts.debris !== false) this.debris(x, y, Math.round(r / 6), opts.color || '#3a2a20');
    this.rings.push({ x, y, r: r * 0.3, max: r * 1.25, life: 0.3, t: 0 });
  }

  debris(x, y, n, color = '#3a2a20') {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = rand(150, 420);
      this.add({ k: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(1, 2.2), size: rand(2.5, 6), rot: rand(0, 6), vr: rand(-12, 12), g: 900, ground: true, scroll: 1, color });
    }
  }

  sparks(x, y, n = 8, color = '#ffd27a') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(120, 360);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.35), size: rand(1, 2), drag: 2, g: 400, color });
    }
  }

  smoke(x, y, n = 1, size = 8, shade = 70, vx = 0) {
    for (let i = 0; i < n; i++) {
      this.add({ k: 'smoke', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: vx + rand(-15, 15), vy: rand(-50, -20), life: rand(0.6, 1.2), size, grow: size * 2.2, drag: 1, g: -10, scroll: 0.7, shade });
    }
  }

  flame(x, y, vx, vy, size = 6) {
    this.add({ k: 'fire', x, y, vx, vy, life: rand(0.15, 0.3), size, drag: 2, g: -200 });
  }

  dust(x, y, size = 6, color) {
    this.add({ k: 'dust', x, y, vx: rand(-40, -10), vy: rand(-40, -10), life: rand(0.4, 0.8), size, grow: size * 2, drag: 1.5, g: 0, scroll: 1, color });
  }

  ember(x, y) {
    this.add({ k: 'spark', x, y, vx: rand(-60, -20), vy: rand(-40, 10), life: rand(1.5, 3), size: rand(1, 2), drag: 0.2, g: -8, color: '#ff8a3a' });
  }

  text(x, y, str, color = '#ffe08a', size = 18) {
    this.texts.push({ x, y, str, color, size, life: 1.1, max: 1.1 });
  }

  update(dt, roadSpeed) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const o = p[i];
      o.life -= dt;
      if (o.life <= 0) {
        p.splice(i, 1);
        continue;
      }
      if (o.drag) {
        const k = Math.max(0, 1 - o.drag * dt);
        o.vx *= k;
        o.vy *= k;
      }
      o.vy += (o.g || 0) * dt;
      o.x += o.vx * dt - (o.scroll ? roadSpeed * o.scroll * dt : 0);
      o.y += o.vy * dt;
      if (o.grow) o.size += o.grow * dt;
      if (o.rot !== undefined) o.rot += o.vr * dt;
      if (o.ground && o.y > 0) {
        o.y = 0;
        o.vy *= -0.35;
        o.vx *= 0.5;
        o.vr *= 0.5;
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 40 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  drawBack(ctx) {
    // smoke & dust are drawn behind vehicles' foreground effects
    for (const o of this.p) {
      if (o.k !== 'smoke' && o.k !== 'dust') continue;
      const a = Math.min(1, o.life / o.max) * (o.k === 'dust' ? 0.45 : 0.55);
      ctx.globalAlpha = a;
      if (o.k === 'smoke') {
        const s = o.shade;
        ctx.fillStyle = `rgb(${s},${s * 0.9},${s * 0.85})`;
      } else ctx.fillStyle = o.color || '#d8a870';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.size, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFront(ctx) {
    for (const o of this.p) {
      if (o.k !== 'debris') continue;
      ctx.globalAlpha = Math.min(1, o.life * 2);
      ctx.fillStyle = o.color;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.fillRect(-o.size / 2, -o.size / 2, o.size, o.size * 0.6);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.p) {
      if (o.k === 'fire') {
        const f = o.life / o.max;
        ctx.globalAlpha = Math.min(1, f * 1.4);
        ctx.fillStyle = f > 0.6 ? '#fff0a0' : f > 0.35 ? '#ffa030' : '#d8401a';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size * (0.4 + f * 0.6), 0, 6.283);
        ctx.fill();
      } else if (o.k === 'spark') {
        ctx.globalAlpha = Math.min(1, (o.life / o.max) * 1.5);
        ctx.strokeStyle = o.color || '#ffd27a';
        ctx.lineWidth = o.size;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(o.x - o.vx * 0.03, o.y - o.vy * 0.03);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const r of this.rings) {
      const f = r.t / r.life;
      ctx.globalAlpha = (1 - f) * 0.7;
      ctx.strokeStyle = '#fff3d0';
      ctx.lineWidth = 3 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.max - r.r) * f, 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const f = t.life / t.max;
      ctx.globalAlpha = Math.min(1, f * 2.5);
      const s = t.size * (f > 0.85 ? 1 + (f - 0.85) * 3 : 1);
      ctx.font = `${s}px "Black Ops One", Impact, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30,12,4,0.9)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
