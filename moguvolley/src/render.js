// render.js — 캔버스 2D 렌더 (480×300 가로): 코트·네트·모구·라이벌·배구공
const M = window.MGV;
const W = 480, H = 300;

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    // 고해상도: 내부 버퍼를 표시 배율×DPR로 키우고 논리 좌표는 유지
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  addHit(x, y) { this.fx.push({ kind: 'hit', x, y, t: 0 }); },
  addScore(x, side) { this.fx.push({ kind: 'score', x, y: M.GROUND - 40, side, t: 0 }); },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 하늘
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (th.night) {
      c.fillStyle = 'rgba(255,255,240,.75)';
      for (let i = 0; i < 34; i++) {
        c.globalAlpha = 0.3 + Math.sin(t * 2 + i) * 0.22;
        c.fillRect((i * 137 + 31) % W, (i * 89 + 17) % (M.GROUND - 60), 1.6, 1.6);
      }
      c.globalAlpha = 1;
      c.fillStyle = '#f5f0d8'; c.beginPath(); c.arc(W - 60, 44, 15, 0, Math.PI * 2); c.fill();
      c.fillStyle = th.sky0; c.beginPath(); c.arc(W - 66, 40, 13, 0, Math.PI * 2); c.fill();
    } else if (st.stage.world === 2) {
      c.fillStyle = '#ffdf8a';
      c.beginPath(); c.arc(W - 80, 60, 22, 0, Math.PI * 2); c.fill();     // 노을 해
      c.fillStyle = 'rgba(60,110,160,.5)';
      c.fillRect(0, M.GROUND - 34, W, 10);                                 // 바다 띠
    } else {
      c.fillStyle = 'rgba(255,255,255,.8)';
      for (const [ox, oy, s2] of [[70, 50, 1], [200, 34, 0.7], [360, 62, 0.85]]) {
        c.beginPath();
        c.arc(ox + Math.sin(t * 0.1) * 6, oy, 13 * s2, 0, Math.PI * 2);
        c.arc(ox + 14 * s2 + Math.sin(t * 0.1) * 6, oy + 4, 10 * s2, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 지면
    c.fillStyle = th.ground;
    c.fillRect(0, M.GROUND, W, H - M.GROUND);
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(0, M.GROUND, W, 3);
    // 네트
    c.fillStyle = '#6a5238';
    c.fillRect(M.NET_X - 2.5, M.NET_TOP, 5, M.GROUND - M.NET_TOP);
    c.strokeStyle = th.net; c.lineWidth = 1;
    for (let y = M.NET_TOP + 3; y < M.GROUND; y += 8) {
      c.beginPath(); c.moveTo(M.NET_X - 5, y); c.lineTo(M.NET_X + 5, y); c.stroke();
    }
    c.fillStyle = '#fff';
    c.fillRect(M.NET_X - 6, M.NET_TOP - 3, 12, 5);

    // 점수판
    c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 4;
    c.strokeText(String(st.score[0]), M.NET_X - 60, 40);
    c.fillText(String(st.score[0]), M.NET_X - 60, 40);
    c.strokeText(String(st.score[1]), M.NET_X + 60, 40);
    c.fillText(String(st.score[1]), M.NET_X + 60, 40);
    c.font = 'bold 11px sans-serif'; c.fillStyle = th.accent;
    c.fillText(`STAGE ${st.no} · ${st.stage.rival.name}`, M.NET_X, 18);
    if (st.phase === 'serve') {
      c.font = 'bold 15px sans-serif'; c.fillStyle = '#fff';
      c.fillText(st.server === 0 ? '모구 서브!' : '라이벌 서브!', M.NET_X, 62);
    }

    // 그림자
    const shadow = (x, w2) => {
      c.fillStyle = 'rgba(0,0,0,.2)';
      c.beginPath(); c.ellipse(x, M.GROUND + 4, w2, 4, 0, 0, Math.PI * 2); c.fill();
    };
    shadow(st.p.x, 20); shadow(st.a.x, 20); shadow(st.ball.x, 10);

    // ── 모구 (플레이어) ──
    if (this.mogu) {
      const a = this.mogu.width / this.mogu.height, mh = 50;
      const squash = st.p.onGround ? 1 : 1.06;
      c.save();
      c.translate(st.p.x, st.p.y);
      c.scale(-1, squash);                        // 원본이 왼쪽을 봄 → 네트(오른쪽) 방향 반전
      c.drawImage(this.mogu, -mh * a / 2, -mh, mh * a, mh);
      c.restore();
    }

    // ── 라이벌 ──
    this.drawRival(st, t);

    // ── 배구공 ──
    const b = st.ball;
    c.save();
    c.translate(b.x, b.y);
    c.rotate(t * (b.vx > 0 ? 6 : -6));
    c.fillStyle = '#f4f4f0';
    c.beginPath(); c.arc(0, 0, M.BALL_R, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#d84a4a'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, M.BALL_R - 1.5, 0.3, 2.1); c.stroke();
    c.strokeStyle = '#4a76d8';
    c.beginPath(); c.arc(0, 0, M.BALL_R - 1.5, Math.PI + 0.3, Math.PI + 2.1); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, M.BALL_R - 0.5, 0, Math.PI * 2); c.stroke();
    c.restore();

    // FX
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'hit' ? 0.25 : 0.9));
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'hit') {
        const p = Math.min(1, f.t / 0.25);
        c.globalAlpha = 1 - p;
        c.strokeStyle = '#fff'; c.lineWidth = 3;
        c.beginPath(); c.arc(f.x, f.y, 10 + p * 26, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      } else {
        const p = f.t / 0.9;
        c.globalAlpha = 1 - p;
        c.font = 'bold 22px sans-serif'; c.textAlign = 'center';
        c.fillStyle = f.side === 0 ? '#7de08a' : '#ff8a8a';
        c.fillText(f.side === 0 ? '+1 모구!' : '+1 라이벌', f.x, f.y - p * 30);
        c.globalAlpha = 1;
      }
    }
  },

  drawRival(st, t) {
    const c = this.ctx, r = st.stage.rival;
    const x = st.a.x, y = st.a.y;
    const wob = st.phase === 'rally' ? Math.sin(t * 8) * 1.5 : 0;
    c.save();
    c.translate(x + wob, y);
    const s = r.boss ? 1.2 : 1;
    c.scale(s, s);
    if (r.kind === 'bird') {
      c.fillStyle = r.body;
      c.beginPath(); c.ellipse(0, -22, 17, 15, 0, 0, Math.PI * 2); c.fill();
      const flap = st.a.onGround ? 2 : Math.sin(t * 14) * 7;
      c.beginPath(); c.moveTo(2, -26); c.lineTo(22, -26 - flap); c.lineTo(4, -18); c.fill();
      c.fillStyle = '#f0b040';
      c.beginPath(); c.moveTo(-16, -22); c.lineTo(-24, -19); c.lineTo(-15, -16); c.fill();
      c.fillStyle = r.eye; c.fillRect(-13, -27, 3.5, 3.5);
    } else {
      c.fillStyle = r.body;
      c.beginPath(); c.ellipse(0, -20, 16, 17, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = r.ear;
      c.beginPath(); c.arc(-7, -36, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(6, -36, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = r.body; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(14, -14); c.quadraticCurveTo(24, -20 + Math.sin(t * 6) * 3, 26, -10); c.stroke();
      c.fillStyle = r.eye; c.fillRect(-12, -26, 3.5, 3.5); c.fillRect(-4, -26, 3.5, 3.5);
    }
    if (r.boss) {
      c.fillStyle = '#ffd83d';
      c.beginPath();
      c.moveTo(-8, -38); c.lineTo(-5, -46); c.lineTo(-1, -39); c.lineTo(3, -47); c.lineTo(7, -38);
      c.fill();
    }
    c.restore();
  },
};
