// render.js — 캔버스 렌더: 벽돌·공·모구 바·낙하 모구·HUD
const M = window.MBK;

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [], trail: [],

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.fx = []; this.trail = [];
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const W = M.W, H = M.H;
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  // 모구 얼굴 (원본 종횡비 유지, size 상자 안에 맞춤)
  drawMogu(x, y, size) {
    const c = this.ctx;
    if (this.mogu && this.mogu.width) {
      const iw = this.mogu.width, ih = this.mogu.height;
      const s = Math.min(size / iw, size / ih);
      const w = iw * s, h = ih * s;
      c.drawImage(this.mogu, x - w / 2, y - h / 2, w, h);
    } else {
      c.fillStyle = '#f4b64a';
      c.beginPath(); c.arc(x, y, size / 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222';
      c.beginPath(); c.arc(x - size * 0.15, y - size * 0.08, 1.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + size * 0.15, y - size * 0.08, 1.2, 0, Math.PI * 2); c.fill();
    }
  },

  addShatter(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.fx.push({ kind: 'shard', x, y, vx: (Math.random() - 0.5) * 130, vy: -40 - Math.random() * 70, t: 0.55, color });
    }
  },
  addSpark(x, y) { for (let i = 0; i < 4; i++) this.fx.push({ kind: 'spark', x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, t: 0.25 }); },
  addFloat(x, y, text, color) { this.fx.push({ kind: 'float', x, y, vx: 0, vy: -24, t: 1.1, text, color }); },

  draw(st, t, dt) {
    const c = this.ctx, W = M.W, H = M.H;
    const th = st.stage.theme, p = st.paddle, ball = st.ball;

    // ── 배경 ──
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.03)';
    for (let i = 0; i < 6; i++) c.fillRect(0, 45 * i + ((t * 6) % 45), W, 10);
    // 천장 라인
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(0, M.TOP - 2, W, 2);

    // ── 벽돌 ──
    for (const b of st.bricks) {
      if (!b.alive) continue;
      const x = b.x + 1, y = b.y + 1, w = b.w - 2, h = b.h - 2;
      if (b.kind === 'steel') {
        c.fillStyle = '#5a626e';
        c.fillRect(x, y, w, h);
        c.fillStyle = '#7a828e';
        c.fillRect(x, y, w, 3);
        c.fillStyle = '#3a424e';
        for (const rx of [x + 4, x + w - 6]) { c.beginPath(); c.arc(rx, y + h / 2, 1.5, 0, Math.PI * 2); c.fill(); }
      } else if (b.kind === 'mogu') {
        c.fillStyle = '#ffe9b0';
        c.fillRect(x, y, w, h);
        c.strokeStyle = '#e8a23d'; c.lineWidth = 1.4;
        c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        this.drawMogu(x + w / 2, y + h / 2, h - 1);
        c.fillStyle = `rgba(255,216,61,${0.25 + 0.2 * Math.sin(t * 4 + b.c)})`;
        c.fillRect(x, y, w, h);
      } else {
        const col = th.rows[b.r % th.rows.length];
        c.fillStyle = col;
        c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,.35)';
        c.fillRect(x, y, w, 2.5);
        c.fillStyle = 'rgba(0,0,0,.22)';
        c.fillRect(x, y + h - 2, w, 2);
        if (b.kind === 'hard') {
          c.fillStyle = b.hp >= 2 ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.12)';
          c.fillRect(x + 3, y + 3, w - 6, h - 6);
          c.fillStyle = 'rgba(255,255,255,.5)';
          c.fillRect(x + w / 2 - 1.5, y + 4, 3, h - 8);
        }
      }
    }

    // ── 낙하 모구 (파라솔 낙하) ──
    for (const d of st.drops) {
      const sway = Math.sin(st.t * 3 + d.wob) * 4;
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath();
      c.moveTo(d.x - 8 + sway * 0.4, d.y - 9);
      c.quadraticCurveTo(d.x + sway * 0.4, d.y - 17, d.x + 8 + sway * 0.4, d.y - 9);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(d.x - 7 + sway * 0.4, d.y - 9); c.lineTo(d.x, d.y - 1);
      c.moveTo(d.x + 7 + sway * 0.4, d.y - 9); c.lineTo(d.x, d.y - 1);
      c.stroke();
      this.drawMogu(d.x, d.y + 3, 15);
    }

    // ── 바 (양 끝에 구출된 모구) ──
    const px = p.x - p.w / 2, py2 = M.Logic.PY;
    const pg = c.createLinearGradient(0, py2, 0, py2 + 8);
    pg.addColorStop(0, '#f0f4ff'); pg.addColorStop(0.5, th.accent); pg.addColorStop(1, '#3a3a4a');
    c.fillStyle = pg;
    c.beginPath(); c.roundRect(px, py2, p.w, 8, 4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(px, py2, p.w, 8, 4); c.stroke();
    const nSide = Math.min(st.rescued, M.Logic.WIDEN_MAX);
    for (let i = 0; i < nSide; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const k = Math.floor(i / 2);
      const mx = p.x + side * (p.w / 2 - 7 - k * 15);
      this.drawMogu(mx, py2 - 4 + Math.sin(t * 3 + i) * 1.2, 14);
    }

    // ── 공 (잔상 포함) ──
    if (!ball.stuck) {
      this.trail.unshift({ x: ball.x, y: ball.y });
      if (this.trail.length > 7) this.trail.pop();
    } else this.trail.length = 0;
    for (let i = this.trail.length - 1; i >= 1; i--) {
      c.fillStyle = `rgba(255,255,255,${0.1 * (this.trail.length - i)})`;
      c.beginPath(); c.arc(this.trail[i].x, this.trail[i].y, M.Logic.BR * (1 - i * 0.09), 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(ball.x, ball.y, M.Logic.BR, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,216,61,.9)';
    c.beginPath(); c.arc(ball.x - 1, ball.y - 1, 1.6, 0, Math.PI * 2); c.fill();
    if (ball.stuck && st.phase === 'play') {
      c.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 5)})`;
      c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
      c.fillText('SPACE / 탭 — 발사!', p.x, py2 - 18);
    }

    // ── FX ──
    for (const f of this.fx) {
      f.t -= dt;
      f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      if (f.kind === 'shard') {
        f.vy += 260 * dt;
        c.fillStyle = f.color;
        c.globalAlpha = Math.min(1, f.t / 0.3);
        c.fillRect(f.x - 2, f.y - 1.5, 4, 3);
        c.globalAlpha = 1;
      } else if (f.kind === 'spark') {
        c.fillStyle = `rgba(255,240,180,${Math.min(1, f.t / 0.25)})`;
        c.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
      } else if (f.kind === 'float') {
        c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
        c.globalAlpha = Math.min(1, f.t);
        c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2.5; c.strokeText(f.text, f.x, f.y);
        c.fillStyle = f.color || '#ffd83d'; c.fillText(f.text, f.x, f.y);
        c.globalAlpha = 1;
      }
    }
    this.fx = this.fx.filter((f) => f.t > 0);

    this.drawHud(st, t);
  },

  drawHud(st, t) {
    const c = this.ctx, W = M.W;
    // 목숨
    c.font = 'bold 11px sans-serif'; c.textAlign = 'left';
    c.fillStyle = '#ff6a8a';
    c.fillText('♥'.repeat(Math.max(0, st.lives)) + '♡'.repeat(Math.max(0, 3 - st.lives)), 10, 15);
    // 스테이지 라벨
    c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.fillStyle = 'rgba(255,255,255,.92)';
    const label = `STAGE ${st.no} · ${st.stage.theme.name}`;
    c.strokeText(label, W / 2, 15);
    c.fillText(label, W / 2, 15);
    // 구출 카운트
    c.textAlign = 'right'; c.fillStyle = '#ffd83d';
    c.fillText(`🐱 ${st.rescued}/${st.stage.moguN}`, W - 10, 15);
    // 점수
    c.textAlign = 'left'; c.font = 'bold 9px sans-serif';
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(`SCORE ${st.score}`, 10, M.H - 8);
  },
};
