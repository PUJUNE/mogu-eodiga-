// render.js — 캔버스 2D 렌더 (320×560 세로형): 모구 얼굴 물방울 + 발사대
const M = window.MGB;
const W = 320, H = 560;

M.Render = {
  cv: null, ctx: null, mogu: null, sprites: [], fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { this.mogu = img; this.buildSprites(); };
    img.src = M.ASSETS.mogu;
    this.buildSprites();                    // 이미지 로드 전 폴백 (단색 방울)
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

  // 색 6종 물방울 스프라이트 사전 생성 (그라데이션 + 모구 얼굴 + 광택)
  buildSprites() {
    this.sprites = M.COLORS.map((col) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(24, 22, 4, 32, 32, 32);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, col);
      g.addColorStop(1, this.shade(col, 0.55));
      c.fillStyle = g;
      c.beginPath(); c.arc(32, 32, 31, 0, Math.PI * 2); c.fill();
      // 모구 얼굴 (원형 클립, 은은하게)
      if (this.mogu) {
        c.save();
        c.beginPath(); c.arc(32, 34, 24, 0, Math.PI * 2); c.clip();
        c.globalAlpha = 0.85;
        const a = this.mogu.width / this.mogu.height;
        const w = 46 * a, h = 46;
        c.drawImage(this.mogu, 32 - w / 2, 34 - h / 2, w, h);
        c.globalAlpha = 0.22;
        c.fillStyle = col;
        c.fillRect(0, 0, 64, 64);
        c.restore();
      }
      // 광택
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.ellipse(22, 17, 9, 5.5, -0.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(32, 32, 30, 0, Math.PI * 2); c.stroke();
      return cv;
    });
  },

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  },

  bubble(x, y, col, scale = 1) {
    const s = M.D * scale;
    this.ctx.drawImage(this.sprites[col], x - s / 2, y - s / 2, s, s);
  },

  addPop(x, y, col) { this.fx.push({ kind: 'pop', x, y, col, t: 0 }); },
  addFall(x, y, col) { this.fx.push({ kind: 'fall', x, y, col, t: 0, vy: -40 - Math.random() * 40, vx: (Math.random() - 0.5) * 60 }); },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 배경
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (st.stage.world === 3) {
      c.fillStyle = 'rgba(255,255,240,.7)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137 + 31) % W, sy = (i * 89 + 17) % H;
        c.globalAlpha = 0.25 + Math.sin(t * 2 + i) * 0.2;
        c.fillRect(sx, sy, 1.5, 1.5);
      }
      c.globalAlpha = 1;
    } else if (st.stage.world === 2) {
      c.strokeStyle = 'rgba(180,220,255,.16)'; c.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const sx = ((i * 71 + t * 130) % (W + 40)) - 20, sy = (i * 113 + t * 320) % H;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 3, sy + 12); c.stroke();
      }
    }

    // 벽·천장(압축기)
    c.fillStyle = th.wall;
    c.fillRect(M.WALL_L - 10, 0, 10, M.DEADLINE + 24);
    c.fillRect(M.WALL_R, 0, 10, M.DEADLINE + 24);
    const ceilBot = M.CEIL_Y + st.drop * M.ROW_H;
    c.fillStyle = this.shade(th.wall, 0.7);
    c.fillRect(M.WALL_L - 10, 0, M.WALL_R - M.WALL_L + 20, ceilBot);
    c.fillStyle = this.shade(th.wall, 0.5);
    for (let x = M.WALL_L; x < M.WALL_R; x += 16) {       // 압축기 톱니
      c.beginPath(); c.moveTo(x, ceilBot); c.lineTo(x + 8, ceilBot + 6); c.lineTo(x + 16, ceilBot); c.fill();
    }

    // 데드라인
    c.strokeStyle = 'rgba(255,120,120,.7)'; c.lineWidth = 2;
    c.setLineDash([8, 6]);
    c.beginPath(); c.moveTo(M.WALL_L, M.DEADLINE); c.lineTo(M.WALL_R, M.DEADLINE); c.stroke();
    c.setLineDash([]);

    // 그리드 방울 (매치 하이라이트 중인 방울은 빨갛게 점멸하며 부풂)
    const popSet = st.popping ? new Set(st.popping.keys) : null;
    for (const [k, col] of st.grid) {
      const [r, cc] = k.split(',').map(Number);
      const x = M.cellX(r, cc), y = M.cellY(r, st.drop);
      if (popSet && popSet.has(k)) {
        const p = st.popping.t / 0.42;
        const pulse = 1 + 0.14 * p + 0.06 * Math.sin(st.popping.t * 34);
        this.bubble(x, y, col, pulse);
        c.globalAlpha = 0.35 + 0.35 * (Math.floor(st.popping.t * 16) % 2);   // 빨간 점멸
        c.fillStyle = '#ff3030';
        c.beginPath(); c.arc(x, y, (M.D / 2) * pulse - 1, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      } else {
        this.bubble(x, y, col);
      }
    }

    // 발사 가이드 (점선)
    if (st.phase === 'play' && !st.flying) {
      const dx = Math.sin(st.aim), dy = -Math.cos(st.aim);
      c.fillStyle = 'rgba(255,255,255,.45)';
      for (let i = 1; i <= 5; i++) {
        let gx = M.LAUNCH_X + dx * i * 26, gy = M.LAUNCH_Y + dy * i * 26;
        if (gx < M.WALL_L + 4) gx = 2 * (M.WALL_L + 4) - gx;      // 1회 반사 근사
        if (gx > M.WALL_R - 4) gx = 2 * (M.WALL_R - 4) - gx;
        c.beginPath(); c.arc(gx, gy, 2.5, 0, Math.PI * 2); c.fill();
      }
    }

    // 발사대: 화살표 + 현재 방울 + 모구
    c.save();
    c.translate(M.LAUNCH_X, M.LAUNCH_Y);
    c.rotate(st.aim);
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.moveTo(0, -34); c.lineTo(-8, -18); c.lineTo(8, -18); c.fill();
    c.fillStyle = 'rgba(255,255,255,.3)';
    c.fillRect(-3, -20, 6, 20);
    c.restore();
    c.fillStyle = this.shade(th.wall, 0.9);
    c.beginPath(); c.arc(M.LAUNCH_X, M.LAUNCH_Y, 12, 0, Math.PI * 2); c.fill();
    if (st.phase === 'play' && !st.flying) this.bubble(M.LAUNCH_X, M.LAUNCH_Y, st.cur);
    // 모구 (발사수) — 발사대 왼쪽
    if (this.mogu) {
      const a = this.mogu.width / this.mogu.height, mh = 56;
      const bob = Math.sin(t * 2.2) * 2;
      c.drawImage(this.mogu, 58 - (mh * a) / 2, M.LAUNCH_Y - mh + 12 + bob, mh * a, mh);
    }
    // NEXT 예고
    c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.fillText('NEXT', 262, M.LAUNCH_Y - 26);
    this.bubble(262, M.LAUNCH_Y - 4, st.next, 0.72);
    // 압축까지 남은 발수 핍
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < M.MAX_SHOTS - st.shots; i++) {
      c.beginPath(); c.arc(M.WALL_L + 8 + i * 12, M.DEADLINE + 16, 3.4, 0, Math.PI * 2); c.fill();
    }
    c.font = 'bold 8px sans-serif'; c.textAlign = 'left';
    c.fillText('하강까지', M.WALL_L, M.DEADLINE + 34);

    // 비행 방울
    if (st.flying) this.bubble(st.flying.x, st.flying.y, st.flying.col);

    // FX (수명 필터를 먼저 — 만료 프레임에 음수 반지름으로 그리지 않도록)
    this.fx = this.fx.filter((f) => (f.kind === 'pop' ? f.t < 0.38 : f.y < H + 40));
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'pop') {
        const p = Math.min(1, f.t / 0.38);
        c.globalAlpha = Math.max(0, 1 - p);
        c.strokeStyle = M.COLORS[f.col]; c.lineWidth = 3;
        c.beginPath(); c.arc(f.x, f.y, 16 + p * 22, 0, Math.PI * 2); c.stroke();
        const pr = Math.max(0.2, 3 * (1 - p));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          c.fillStyle = M.COLORS[f.col];
          c.beginPath(); c.arc(f.x + Math.cos(a) * p * 30, f.y + Math.sin(a) * p * 30 + p * p * 20, pr, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
      } else {
        f.vy += 900 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        this.bubble(f.x, f.y, f.col, Math.max(0.4, 1 - f.t * 0.4));
      }
    }
  },
};
