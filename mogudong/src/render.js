// render.js — 캔버스 2D 렌더 (360×560 세로형): 하늘·떨어지는 똥·모구·HUD
const M = window.MDD;
const W = 360, H = 560;

M.Render = {
  cv: null, ctx: null, body: null, splats: [], fx: [], flash: 0, flashT: 3,

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();                       // 인게임 모구 = 모구 스키점프와 같은 전신 스프라이트
    img.onload = () => { this.body = img; };
    img.src = M.ASSETS.mogu;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.5, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    // 고해상도: 내부 버퍼를 표시 배율×DPR로 키우고 논리 좌표는 유지
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  reset() { this.splats = []; this.fx = []; this.flash = 0; this.flashT = 3; },

  addSplat(x, r) {
    this.splats.push({ x, r, t: 0 });
    if (this.splats.length > 70) this.splats.shift();
  },
  addBurst(x, y, r) { this.fx.push({ x, y, r, t: 0 }); },

  // ── 똥 한 덩이 ──
  drawPoop(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(rot) * 0.16);
    const g = c.createLinearGradient(-r, -r, r * 0.6, r);
    g.addColorStop(0, '#b07a38');
    g.addColorStop(0.45, '#8a5522');
    g.addColorStop(1, '#5e370f');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, r * 0.42, r * 1.02, r * 0.56, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(r * 0.06, -r * 0.06, r * 0.74, r * 0.46, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-r * 0.04, -r * 0.48, r * 0.46, r * 0.34, 0, 0, Math.PI * 2); c.fill();
    // 꼬다리
    c.beginPath();
    c.moveTo(-r * 0.14, -r * 0.66);
    c.quadraticCurveTo(r * 0.1, -r * 1.16, r * 0.24, -r * 0.7);
    c.fill();
    // 광택
    c.fillStyle = 'rgba(255,235,200,.34)';
    c.beginPath(); c.ellipse(-r * 0.3, -r * 0.5, r * 0.17, r * 0.1, -0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(-r * 0.46, r * 0.34, r * 0.2, r * 0.11, -0.35, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  drawMogu(c, st, t) {
    const p = st.p;
    const dying = st.phase === 'over';
    const h = 86, a = this.body ? this.body.width / this.body.height : 0.41;
    const w = h * a;                              // 스키점프 스프라이트는 길쭉한 뒷모습 (약 0.41)
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.beginPath(); c.ellipse(p.x, M.GROUND + 2, Math.max(14, w * 0.58), 5.5, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(p.x, M.GROUND);
    if (dying) {
      const k = Math.min(1, st.endT / 0.45);
      c.rotate(-k * 1.45);                        // 뒤로 발라당
      c.translate(0, k * 10);
    } else {
      c.translate(0, -Math.abs(Math.sin(p.walk)) * (p.vx ? 3 : 0));
      c.rotate((p.vx || 0) * 0.0006);             // 달리는 방향으로 살짝 기울기
    }
    c.scale(p.dir >= 0 ? -1 : 1, 1);              // 뒷모습이라 좌우 반전은 몸을 트는 정도의 의미
    // 꼬리 끝이 아니라 꼬리 시작점(엉덩이, 이미지 높이의 58% 지점)이 접지되게 내려 그린다
    // — 꼬리는 그림자 아래 바닥으로 늘어짐 (남극 대모험과 같은 접지 문법)
    if (this.body) c.drawImage(this.body, -w / 2, -h * M.FOOT, w, h);
    else { c.fillStyle = '#e0d4c4'; c.fillRect(-w / 2, -h * M.FOOT, w, h * M.FOOT); }
    if (dying) {                                  // 뒷모습이라 눈이 안 보인다 — 머리 위 어질어질 별
      c.strokeStyle = '#ffd83d'; c.lineWidth = 2.2; c.lineCap = 'round';
      const ey = -h * M.FOOT - 6;
      for (let i = 0; i < 3; i++) {
        const ang = st.endT * 5 + (i * Math.PI * 2) / 3;
        c.beginPath();
        c.arc(Math.cos(ang) * w * 0.5, ey + Math.sin(ang) * 4, 2.6, 0, Math.PI * 2);
        c.stroke();
      }
      c.lineCap = 'butt';
    }
    c.restore();
  },

  drawHud(c, st, th) {
    const left = Math.max(0, M.CLEAR_TIME - st.t);
    const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    c.fillStyle = 'rgba(0,0,0,.34)';
    c.fillRect(0, 0, W, 34);
    c.font = 'bold 17px sans-serif'; c.textAlign = 'left';
    c.fillStyle = left <= 30 ? '#ff9a5a' : '#fff';
    c.fillText(`⏱ ${mm}:${String(ss).padStart(2, '0')}`, 9, 23);
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
    c.fillStyle = th.accent;
    c.fillText(`WAVE ${st.waveNo}${st.wave.wind ? ' 🌪' : ''}`, W / 2, 15);
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(M.DIFFS[st.diff].name, W / 2, 28);
    c.font = 'bold 15px sans-serif'; c.textAlign = 'right';
    c.fillStyle = '#fff';
    c.fillText(`💩 ${st.dodged}`, W - 9, 23);
    // 5분 진행 게이지
    const pr = Math.min(1, st.t / M.CLEAR_TIME);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 34, W, 4);
    c.fillStyle = pr > 0.8 ? '#ffd83d' : '#7de08a'; c.fillRect(0, 34, W * pr, 4);
    c.textAlign = 'left';
  },

  draw(st, t, dt) {
    const c = this.ctx, th = M.THEMES[st.themeIdx] || M.THEMES[0];

    // ── 하늘 ──
    const g = c.createLinearGradient(0, 0, 0, M.GROUND);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    if (th.night) {
      c.fillStyle = 'rgba(255,255,240,.85)';
      for (let i = 0; i < 40; i++) {
        c.globalAlpha = 0.25 + Math.sin(t * 1.7 + i) * 0.22;
        c.fillRect((i * 149 + 23) % W, (i * 97 + 31) % (M.GROUND - 120) + 44, 1.7, 1.7);
      }
      c.globalAlpha = 1;
      if (!th.storm) {
        c.fillStyle = '#f5f0d8'; c.beginPath(); c.arc(W - 58, 78, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = th.sky0; c.beginPath(); c.arc(W - 64, 73, 13.5, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.fillStyle = th.name === '노을' ? '#ffd88a' : '#fff6c0';
      c.beginPath(); c.arc(W - 58, 78, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.82)';
      for (const [ox, oy, s2] of [[64, 96, 1], [232, 62, 0.72], [148, 140, 0.55]]) {
        const dx = ox + Math.sin(t * 0.08 + oy) * 8;
        c.beginPath();
        c.arc(dx, oy, 15 * s2, 0, Math.PI * 2);
        c.arc(dx + 16 * s2, oy + 5, 11 * s2, 0, Math.PI * 2);
        c.arc(dx - 15 * s2, oy + 6, 10 * s2, 0, Math.PI * 2);
        c.fill();
      }
    }

    // 똥 폭풍 번개
    if (th.storm) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flashT = 2.2 + Math.random() * 3.4; this.flash = 0.5; }
      if (this.flash > 0) {
        this.flash -= dt * 2.6;
        c.fillStyle = `rgba(255,240,200,${Math.max(0, this.flash) * 0.55})`;
        c.fillRect(0, 0, W, H);
      }
    }

    // ── 원경 언덕 + 울타리 (빈 하늘에 깊이를 준다) ──
    const hills = () => {
      c.beginPath();
      c.moveTo(-10, M.GROUND);
      c.quadraticCurveTo(60, M.GROUND - 30, 130, M.GROUND - 6);
      c.quadraticCurveTo(200, M.GROUND - 38, 290, M.GROUND - 8);
      c.quadraticCurveTo(330, M.GROUND - 22, W + 10, M.GROUND);
      c.lineTo(W + 10, M.GROUND + 4); c.lineTo(-10, M.GROUND + 4);
      c.closePath();
    };
    c.fillStyle = th.ground; hills(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.3)'; hills(); c.fill();

    // ── 바닥 ──
    c.fillStyle = th.ground;
    c.fillRect(0, M.GROUND, W, H - M.GROUND);
    c.fillStyle = 'rgba(255,255,255,.2)';
    c.fillRect(0, M.GROUND, W, 3);
    c.fillStyle = 'rgba(0,0,0,.16)';               // 잔디 결
    for (let x = 6; x < W; x += 17) c.fillRect(x, M.GROUND + 9 + ((x / 17) % 2) * 7, 7, 2);

    // 바닥에 남은 똥 자국
    this.splats = this.splats.filter((s) => s.t < 7);
    for (const s of this.splats) {
      s.t += dt;
      const a = Math.max(0, 1 - s.t / 7);
      c.globalAlpha = a * 0.8;
      c.fillStyle = '#4e2f11';
      c.beginPath(); c.ellipse(s.x, M.GROUND + 7, s.r * 1.25, s.r * 0.42, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6b4118';
      c.beginPath(); c.ellipse(s.x - s.r * 0.3, M.GROUND + 6, s.r * 0.45, s.r * 0.2, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }

    // ── 모구 ──
    this.drawMogu(c, st, t);

    // ── 떨어지는 똥 ──
    for (const q of st.poops) this.drawPoop(c, q.x, q.y, q.r, q.rot);

    // ── 착지·피격 FX ──
    this.fx = this.fx.filter((f) => f.t < 0.4);
    for (const f of this.fx) {
      f.t += dt;
      const p = f.t / 0.4;
      c.globalAlpha = 1 - p;
      c.strokeStyle = '#c8964a'; c.lineWidth = 3;
      c.beginPath(); c.arc(f.x, f.y, f.r + p * 34, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }

    // ── HUD ──
    this.drawHud(c, st, th);
  },
};
