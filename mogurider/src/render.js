// render.js — 캔버스 2D 렌더 (360×560 세로형): 하늘·구름·드래곤+모구·적·탄·아이템·보스·HUD
const M = window.MDR;
const W = 360, H = 560;

M.Render = {
  cv: null, ctx: null, face: null, fx: [], texts: [], shake: 0, scroll: 0, flash: 0,
  clouds: [], stars: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();                       // 라이더 모구 = 모구 얼굴 사진
    img.onload = () => { this.face = img; };
    img.src = M.ASSETS.mogu;
    for (let i = 0; i < 9; i++) this.clouds.push({ x: (i * 137) % W, y: (i * 211) % H, s: 0.6 + (i % 3) * 0.35, v: 0.5 + (i % 4) * 0.2 });
    for (let i = 0; i < 60; i++) this.stars.push({ x: (i * 97 + 13) % W, y: (i * 151 + 7) % H, s: 1 + (i % 3) * 0.6, v: 0.3 + (i % 5) * 0.15 });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.5, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  reset() { this.fx = []; this.texts = []; this.shake = 0; this.flash = 0; },

  addBurst(x, y, r, color) { this.fx.push({ kind: 'burst', x, y, r, color: color || '#ffb347', t: 0, dur: 0.45 }); },
  addSpark(x, y) { this.fx.push({ kind: 'spark', x, y, r: 6, color: '#fff2a0', t: 0, dur: 0.18 }); },
  addText(x, y, text, color) { this.texts.push({ x, y, text, color: color || '#fff', t: 0 }); if (this.texts.length > 14) this.texts.shift(); },

  // ── 드래곤 + 모구 라이더 (위에서 내려다본 모습) ──
  drawDragon(c, st, t) {
    const p = st.p, dying = st.phase === 'over';
    const blink = p.inv > 0 && !dying && Math.floor(t * 18) % 2 === 0;
    if (blink) return;
    c.save();
    c.translate(p.x, M.PY);
    if (dying) {
      const k = Math.min(1, st.endT / M.Logic.DEATH_SEC);
      c.rotate(k * 6.5); c.scale(1 - k * 0.7, 1 - k * 0.7); c.translate(0, k * 90);
    } else {
      c.rotate((p.vx || 0) * 0.0005);               // 이동 방향으로 살짝 기울기
    }
    const flap = Math.sin(t * 13) * 0.35;
    const fever = p.fever > 0;
    const body = fever ? '#ff8a3d' : '#4cb86a', bodyD = fever ? '#c85a1e' : '#2e8a4a', belly = fever ? '#ffd3a0' : '#bfe8a8';
    // 날개
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.fillStyle = bodyD;
      c.beginPath();
      c.moveTo(8, -4);
      c.quadraticCurveTo(38, -30 - flap * 30, 58, -2 + flap * 12);
      c.quadraticCurveTo(44, 10 + flap * 6, 30, 22);
      c.quadraticCurveTo(20, 14, 8, 12);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(12, 2); c.lineTo(40, -6 - flap * 14); c.moveTo(14, 8); c.lineTo(44, 8 + flap * 4); c.stroke();
      c.restore();
    }
    // 꼬리
    c.strokeStyle = body; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 18); c.quadraticCurveTo(Math.sin(t * 5) * 10, 40, Math.sin(t * 5 + 1) * 14, 58); c.stroke();
    c.fillStyle = bodyD; c.beginPath(); c.moveTo(Math.sin(t * 5 + 1) * 14 - 7, 56); c.lineTo(Math.sin(t * 5 + 1) * 14 + 7, 56); c.lineTo(Math.sin(t * 5 + 1) * 14, 68); c.closePath(); c.fill();
    // 몸통
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 4, 20, 30, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = belly; c.beginPath(); c.ellipse(0, 8, 11, 20, 0, 0, Math.PI * 2); c.fill();
    // 머리 (위쪽) + 뿔
    c.fillStyle = body; c.beginPath(); c.ellipse(0, -30, 13, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe07a';
    c.beginPath(); c.moveTo(-9, -36); c.lineTo(-14, -50); c.lineTo(-4, -40); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(9, -36); c.lineTo(14, -50); c.lineTo(4, -40); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-6, -33, 3.2, 0, 6.28); c.arc(6, -33, 3.2, 0, 6.28); c.fill();
    c.fillStyle = '#222'; c.beginPath(); c.arc(-6, -34, 1.6, 0, 6.28); c.arc(6, -34, 1.6, 0, 6.28); c.fill();
    // 콧김 불꽃
    c.fillStyle = fever ? 'rgba(255,240,120,.9)' : 'rgba(255,150,60,.75)';
    c.beginPath(); c.ellipse(0, -46 - Math.abs(Math.sin(t * 20)) * 4, 5, 8, 0, 0, 6.28); c.fill();
    // 라이더 모구 (얼굴 사진을 둥글게 잘라 등 위에)
    c.save();
    c.translate(0, 2 + Math.sin(t * 13) * 1.5);
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.closePath();
    c.fillStyle = '#f0e6d8'; c.fill();
    c.clip();
    if (this.face) { const a = this.face.width / this.face.height; c.drawImage(this.face, -19 * a, -18, 38 * a, 38); }
    c.restore();
    c.strokeStyle = fever ? '#ffd83d' : '#fff'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 2 + Math.sin(t * 13) * 1.5, 17, 0, Math.PI * 2); c.stroke();
    // 방패
    if (p.shield) {
      c.strokeStyle = 'rgba(120,200,255,.85)'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, 44 + Math.sin(t * 6) * 2, 0, Math.PI * 2); c.stroke();
    }
    if (fever) {
      c.strokeStyle = `rgba(255,220,80,${0.4 + Math.sin(t * 20) * 0.25})`; c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  },

  drawEnemy(c, e, t) {
    c.save(); c.translate(e.x, e.y);
    const fl = e.flash > 0;
    switch (e.kind) {
      case 'crow': {
        const flap = Math.sin(t * 16 + e.sw) * 0.5;
        c.fillStyle = fl ? '#fff' : '#23232e';
        for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(16, -14 * flap - 6, 26, 2 + flap * 8); c.quadraticCurveTo(14, 8, 4, 8); c.closePath(); c.fill(); c.restore(); }
        c.beginPath(); c.ellipse(0, 0, 9, 12, 0, 0, 6.28); c.fill();
        c.fillStyle = '#ffb020'; c.beginPath(); c.moveTo(-4, 10); c.lineTo(4, 10); c.lineTo(0, 18); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, 3, 2.5, 0, 6.28); c.arc(4, 3, 2.5, 0, 6.28); c.fill();
        c.fillStyle = '#d02020'; c.beginPath(); c.arc(-4, 3.5, 1.2, 0, 6.28); c.arc(4, 3.5, 1.2, 0, 6.28); c.fill();
        break;
      }
      case 'balloon': {
        c.strokeStyle = '#888'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, 22); c.stroke();
        c.fillStyle = fl ? '#fff' : '#e8453c'; c.beginPath(); c.ellipse(0, -2, 14, 16, 0, 0, 6.28); c.fill();
        c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-5, -8, 4, 6, -0.5, 0, 6.28); c.fill();
        c.fillStyle = '#9a9aa8'; c.beginPath(); c.ellipse(0, 26, 8, 6, 0, 0, 6.28); c.fill();
        c.beginPath(); c.arc(-6, 22, 3, 0, 6.28); c.arc(6, 22, 3, 0, 6.28); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(-3, 26, 1.2, 0, 6.28); c.arc(3, 26, 1.2, 0, 6.28); c.fill();
        break;
      }
      case 'drone': {
        c.fillStyle = fl ? '#fff' : '#7d8593';
        c.beginPath(); c.roundRect(-16, -12, 32, 24, 7); c.fill();
        c.fillStyle = '#4a505c'; c.fillRect(-12, -3, 24, 6);
        c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(0, 0, 4 + Math.sin(t * 10) * 1, 0, 6.28); c.fill();
        c.strokeStyle = 'rgba(30,30,40,.8)'; c.lineWidth = 2;
        for (const [px, py] of [[-20, -14], [20, -14], [-20, 14], [20, 14]]) {
          c.save(); c.translate(px, py); c.rotate(t * 30 + px);
          c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke(); c.restore();
        }
        break;
      }
      case 'rock': {
        c.fillStyle = '#555c66';
        c.beginPath(); c.arc(-10, 2, 14, 0, 6.28); c.arc(8, -6, 15, 0, 6.28); c.arc(10, 8, 12, 0, 6.28); c.arc(-4, -10, 11, 0, 6.28); c.fill();
        c.fillStyle = '#3a3f48';
        c.beginPath(); c.arc(-8, 6, 9, 0, 6.28); c.arc(9, 8, 7, 0, 6.28); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(-12, -8); c.lineTo(-2, -4); c.lineTo(2, -12); c.stroke();
        break;
      }
    }
    c.restore();
  },

  drawBoss(c, b, t) {
    c.save(); c.translate(b.x, b.y);
    const flap = Math.sin(t * 9) * 0.4;
    c.fillStyle = b.flash > 0 ? '#fff' : b.def.color;
    for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.beginPath(); c.moveTo(b.r * 0.4, 0); c.quadraticCurveTo(b.r * 1.3, -b.r * 0.9 - flap * 30, b.r * 1.9, flap * 20); c.quadraticCurveTo(b.r * 1.2, b.r * 0.5, b.r * 0.4, b.r * 0.6); c.closePath(); c.fill(); c.restore(); }
    c.beginPath(); c.ellipse(0, 0, b.r * 0.9, b.r, 0, 0, 6.28); c.fill();
    c.font = `${Math.round(b.r * 1.1)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.fillText(b.def.emoji, 0, 2);
    c.textBaseline = 'alphabetic';
    // 왕관
    c.fillStyle = '#ffd83d'; c.beginPath(); c.moveTo(-14, -b.r + 2); c.lineTo(-10, -b.r - 14); c.lineTo(-4, -b.r + 0); c.lineTo(0, -b.r - 16); c.lineTo(4, -b.r); c.lineTo(10, -b.r - 14); c.lineTo(14, -b.r + 2); c.closePath(); c.fill();
    c.restore();
  },

  drawItem(c, it, t) {
    const I = M.ITEMS[it.kind];
    c.save(); c.translate(it.x, it.y + Math.sin(t * 4 + it.sw) * 2);
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(0, 0, M.ITEM_R, 0, 6.28); c.fill();
    c.strokeStyle = '#ffd83d'; c.lineWidth = 2.5; c.stroke();
    c.font = '17px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText(I.emoji, 0, 1);
    c.textBaseline = 'alphabetic';
    c.restore();
  },

  drawHud(c, st, zone) {
    const p = st.p;
    c.fillStyle = 'rgba(0,0,0,.36)'; c.fillRect(0, 0, W, 40);
    c.font = 'bold 15px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.fillText(`⭐ ${st.score.toLocaleString()}`, 9, 19);
    c.font = 'bold 12px sans-serif'; c.fillStyle = '#ffd83d';
    c.fillText(`🪙 ${st.coins}`, 9, 35);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif';
    c.fillText(`${Math.floor(st.dist).toLocaleString()} m`, W / 2, 19);
    c.font = 'bold 11px sans-serif'; c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(`${M.DIFFS[st.diff].name} · WAVE ${st.waveNo}`, W / 2, 34);
    c.textAlign = 'right'; c.font = '15px sans-serif';
    let hearts = ''; for (let i = 0; i < M.HEARTS; i++) hearts += i < p.hearts ? '❤️' : '🖤';
    c.fillText(hearts, W - 8, 19);
    c.font = 'bold 12px sans-serif'; c.fillStyle = '#9fe0ff';
    c.fillText(`🔥 LV${p.level}${p.shield ? ' 🛡️' : ''}`, W - 8, 35);
    // 달까지 진행 게이지
    const pr = Math.min(1, st.dist / M.CLEAR_DIST);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 40, W, 4);
    c.fillStyle = pr > 0.8 ? '#ffd83d' : '#7de08a'; c.fillRect(0, 40, W * pr, 4);
    for (const b of M.BOSSES) { c.fillStyle = '#ff5252'; c.fillRect(W * (b.at / M.CLEAR_DIST) - 1, 39, 2, 6); }
    // 피버 게이지
    if (p.fever > 0) {
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(W / 2 - 70, 50, 140, 12);
      c.fillStyle = '#ffd83d'; c.fillRect(W / 2 - 68, 52, 136 * (p.fever / M.FEVER_SEC), 8);
      c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('FEVER!!', W / 2, 61);
    }
    // 보스 HP
    if (st.boss) {
      const b = st.boss;
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(30, 70, W - 60, 16);
      c.fillStyle = '#ff5252'; c.fillRect(32, 72, (W - 64) * Math.max(0, b.hp / b.maxHp), 12);
      c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.fillText(`${b.def.emoji} ${b.name}`, W / 2, 82);
    }
    c.textAlign = 'left';
  },

  draw(st, t, dt) {
    const c = this.ctx, zone = M.ZONES[st.zoneIdx] || M.ZONES[0];
    const spd = st.phase === 'play' ? (st.boss ? 90 : M.Logic.scrollSpd(st)) : 40;
    this.scroll += spd * dt;
    c.save();
    if (this.shake > 0) { this.shake -= dt; c.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); }

    // ── 하늘 ──
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, zone.sky0); g.addColorStop(1, zone.sky1);
    c.fillStyle = g; c.fillRect(-10, -10, W + 20, H + 20);
    if (zone.night) {
      for (const s of this.stars) {
        const y = (s.y + this.scroll * s.v * 0.4) % H;
        c.globalAlpha = 0.45 + Math.sin(t * 2 + s.x) * 0.3;
        c.fillStyle = '#fff'; c.fillRect(s.x, y, s.s, s.s);
      }
      c.globalAlpha = 1;
    }
    if (zone.space) {                                   // 달이 점점 가까워진다
      const k = Math.min(1, (st.dist - 9000) / 3000);
      c.fillStyle = '#f2ecd2'; c.beginPath(); c.arc(W / 2, -60 + k * 200, 40 + k * 90, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(0,0,0,.12)';
      c.beginPath(); c.arc(W / 2 - 20, -60 + k * 200 - 10, 12 + k * 10, 0, 6.28); c.arc(W / 2 + 30, -60 + k * 200 + 20, 8 + k * 12, 0, 6.28); c.fill();
    } else if (!zone.night) {
      c.fillStyle = zone.name === '노을' ? '#ffd88a' : '#fff6c0';
      c.beginPath(); c.arc(W - 58, 78, 22, 0, 6.28); c.fill();
    }
    for (const cl of this.clouds) {
      const y = (cl.y + this.scroll * cl.v) % (H + 80) - 40;
      c.fillStyle = zone.cloud;
      c.beginPath();
      c.arc(cl.x, y, 18 * cl.s, 0, 6.28); c.arc(cl.x + 20 * cl.s, y + 6 * cl.s, 14 * cl.s, 0, 6.28); c.arc(cl.x - 18 * cl.s, y + 7 * cl.s, 12 * cl.s, 0, 6.28);
      c.fill();
    }

    // ── 코인 · 아이템 ──
    for (const co of st.coinsArr) {
      c.fillStyle = '#ffd83d'; c.beginPath(); c.arc(co.x, co.y, 8, 0, 6.28); c.fill();
      c.fillStyle = '#e0a020'; c.beginPath(); c.arc(co.x, co.y, 8 * Math.abs(Math.cos(co.t * 6)), 0, 6.28); c.fill();
      c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(co.x - 2, co.y - 3, 2, 0, 6.28); c.fill();
    }
    for (const it of st.items) this.drawItem(c, it, t);

    // ── 불꽃 ──
    for (const b of st.bullets) {
      c.fillStyle = b.big ? '#fff2a0' : '#ffb347';
      c.beginPath(); c.ellipse(b.x, b.y, b.big ? 6 : 4, b.big ? 12 : 9, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, 6.28); c.fill();
      c.fillStyle = '#ff5a1e'; c.beginPath(); c.arc(b.x, b.y + 3, b.big ? 3 : 2, 0, 6.28); c.fill();
    }
    // ── 적 · 보스 ──
    for (const e of st.enemies) this.drawEnemy(c, e, t);
    if (st.boss) this.drawBoss(c, st.boss, t);
    // ── 적 탄 ──
    for (const b of st.ebullets) {
      c.fillStyle = '#c04cff'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.28); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.4, 0, 6.28); c.fill();
    }

    // ── 드래곤 ──
    this.drawDragon(c, st, t);

    // ── FX ──
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const f of this.fx) {
      f.t += dt;
      const k = f.t / f.dur;
      c.globalAlpha = 1 - k;
      if (f.kind === 'burst') {
        c.fillStyle = f.color; c.beginPath(); c.arc(f.x, f.y, f.r * (0.6 + k * 1.6), 0, 6.28); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + k; c.beginPath(); c.moveTo(f.x + Math.cos(a) * f.r * k * 1.5, f.y + Math.sin(a) * f.r * k * 1.5); c.lineTo(f.x + Math.cos(a) * f.r * (k * 2.2 + 0.5), f.y + Math.sin(a) * f.r * (k * 2.2 + 0.5)); c.stroke(); }
      } else { c.fillStyle = f.color; c.beginPath(); c.arc(f.x, f.y, f.r * (1 - k * 0.5), 0, 6.28); c.fill(); }
      c.globalAlpha = 1;
    }
    this.texts = this.texts.filter((x) => x.t < 0.9);
    for (const x of this.texts) {
      x.t += dt;
      c.globalAlpha = 1 - x.t / 0.9;
      c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillStyle = x.color;
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      c.strokeText(x.text, x.x, x.y - x.t * 40); c.fillText(x.text, x.x, x.y - x.t * 40);
      c.globalAlpha = 1;
    }
    if (this.flash > 0) { this.flash -= dt * 3; c.fillStyle = `rgba(255,255,255,${Math.max(0, this.flash)})`; c.fillRect(0, 0, W, H); }
    c.restore();

    this.drawHud(c, st, zone);
  },
};
