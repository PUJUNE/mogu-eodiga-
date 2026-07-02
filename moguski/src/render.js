// render.js — 사이드뷰 캔버스 렌더 (480×270, 카메라 추적 + 힐 크기별 축척)
const M = window.MSJ;
const W = 480, H = 270;

M.Render = {
  cv: null, ctx: null, mogu: null,
  cam: { cx: 0, cy: 0, sc: 4 },
  targetX: 0,                       // 목표 거리의 언덕 x 좌표 (스테이지별 계산)

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
    s = s >= 2 ? Math.floor(s) : Math.max(0.7, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
  },

  setStage(stage, best) {
    // 목표·최고 거리의 언덕 좌표 역산 (거리 = sqrt(x²+y²))
    const solve = (d) => {
      for (let x = 1; x < stage.K * 2.2; x += 0.25) {
        const y = stage.hillY(x);
        if (Math.sqrt(x * x + y * y) >= d) return x;
      }
      return stage.K * 1.5;
    };
    this.targetX = solve(stage.target);
    this.bestX = best > 0 ? solve(best) : null;
  },

  w2s(wx, wy) {
    return [W / 2 + (wx - this.cam.cx) * this.cam.sc, H / 2 - (wy - this.cam.cy) * this.cam.sc];
  },

  draw(st, t) {
    const c = this.ctx, stg = st.stage, th = stg.theme;
    // ── 카메라 ──
    let mx, my;
    if (st.phase === 'ready' || st.phase === 'slide') {
      const p = stg.inrunAt(Math.max(0, st.s));
      mx = p.x; my = p.y;
    } else { mx = st.x; my = st.y; }
    const flightSc = Math.min(4.2, 480 / (stg.K * 1.75 + 50));
    const scT = st.phase === 'ready' || st.phase === 'slide' ? Math.max(flightSc, 3.2) : flightSc;
    const k = 1 - Math.exp(-4 * (1 / 60));
    this.cam.sc += (scT - this.cam.sc) * k;
    this.cam.cx += (mx + 70 / this.cam.sc - this.cam.cx) * k;
    this.cam.cy += (my - 30 / this.cam.sc - this.cam.cy) * k;

    // ── 하늘 ──
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (th.night) {
      c.fillStyle = 'rgba(255,255,240,.8)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137 + 31) % W, sy = (i * 89 + 17) % (H * 0.7);
        c.globalAlpha = 0.3 + ((i * 53) % 60) / 100 + Math.sin(t * 2 + i) * 0.15;
        c.fillRect(sx, sy, 1.6, 1.6);
      }
      c.globalAlpha = 1;
      c.fillStyle = '#f5f0d8'; c.beginPath(); c.arc(W - 70, 46, 17, 0, Math.PI * 2); c.fill();
      c.fillStyle = th.sky0; c.beginPath(); c.arc(W - 77, 42, 15, 0, Math.PI * 2); c.fill();
    }
    // 원경 능선 (패럴랙스)
    c.fillStyle = th.far;
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 16) {
      const wx = this.cam.cx * 0.25 + sx;
      c.lineTo(sx, H * 0.62 + Math.sin(wx * 0.02) * 26 + Math.sin(wx * 0.007) * 40);
    }
    c.lineTo(W, H); c.fill();
    c.globalAlpha = 1;

    // ── 지형 (인런 + 착지 언덕) ──
    c.beginPath();
    let first = true;
    const pts = stg.inrunPts;
    for (let i = pts.length - 1; i >= 0; i--) {
      const [sx, sy] = this.w2s(pts[i].x, pts[i].y);
      if (first) { c.moveTo(sx, sy); first = false; } else c.lineTo(sx, sy);
    }
    const xEnd = stg.K * 1.32 + 80;
    for (let hx = 0; hx <= xEnd; hx += 2) {
      const [sx, sy] = this.w2s(hx, stg.hillY(hx));
      c.lineTo(sx, sy);
    }
    const [ex, ey] = this.w2s(xEnd, stg.hillY(xEnd));
    c.lineTo(ex, H + 20); c.lineTo(this.w2s(pts[pts.length - 1].x, 0)[0], H + 20);
    c.closePath();
    c.fillStyle = th.ground; c.fill();
    c.strokeStyle = th.track; c.lineWidth = Math.max(2.5, this.cam.sc * 1.1); c.stroke();

    // 거리 눈금 (10m 간격, 20m 라벨)
    c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
    for (let d = 20; d < stg.target * 1.6; d += 10) {
      const hx = this._distX(stg, d);
      const [sx, sy] = this.w2s(hx, stg.hillY(hx));
      if (sx < -20 || sx > W + 20) continue;
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(sx, sy - 3); c.lineTo(sx, sy + 3); c.stroke();
      if (d % 20 === 0) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(String(d), sx, sy + 12); }
    }
    // 목표 라인 + 깃발
    {
      const [sx, sy] = this.w2s(this.targetX, stg.hillY(this.targetX));
      c.strokeStyle = th.accent; c.lineWidth = 2;
      c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(sx, sy - 26); c.lineTo(sx, sy + 4); c.stroke();
      c.setLineDash([]);
      c.fillStyle = th.accent;
      c.beginPath(); c.moveTo(sx, sy - 26); c.lineTo(sx + 16, sy - 21); c.lineTo(sx, sy - 16); c.fill();
      c.font = 'bold 9px sans-serif';
      c.fillText(`${stg.rival ? stg.rival + ' ' : '목표 '}${stg.target}m`, sx + 2, sy - 30);
    }
    if (this.bestX) {
      const [sx, sy] = this.w2s(this.bestX, stg.hillY(this.bestX));
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.moveTo(sx, sy - 14); c.lineTo(sx + 9, sy - 11); c.lineTo(sx, sy - 8); c.fill();
      c.fillRect(sx - 0.5, sy - 14, 1, 14);
    }

    // ── 모구 (포대 + 사진) ──
    let ang, wob = 0;
    if (st.phase === 'ready' || st.phase === 'slide') ang = -stg.inrunAt(Math.max(0, st.s)).th;
    else if (st.phase === 'flight') {
      ang = Math.max(-0.55, Math.min(0.35, Math.atan2(st.vy, st.vx) * 0.5));
      if (M.Logic.postureQ(st.P) < 0.3) wob = Math.sin(t * 30) * 0.18;
    } else ang = st.crash ? st.landT * 9 : 0;
    const [px, py] = this.w2s(mx, my);
    const sz = Math.max(15, this.cam.sc * 3.4);
    c.save();
    c.translate(px, py);
    c.rotate(-ang + wob);
    // 포대 (엉덩이 밑 자루)
    c.fillStyle = '#a8783c';
    c.beginPath(); c.roundRect(-sz * 0.55, -sz * 0.16, sz * 1.1, sz * 0.34, sz * 0.1); c.fill();
    c.strokeStyle = '#7a5424'; c.lineWidth = 1; c.stroke();
    // 모구 (사진 — 원본이 왼쪽을 보므로 진행 방향(오른쪽)으로 반전)
    if (this.mogu) {
      const a = this.mogu.width / this.mogu.height, mh = sz * 1.05;
      c.scale(-1, 1);
      c.drawImage(this.mogu, -mh * a / 2, -sz * 0.16 - mh, mh * a, mh);
    }
    c.restore();

    // ── 게이지·안내 ──
    if (st.phase === 'slide' && st.untilLip < 1.15) this.takeoffMeter(st);
    if (st.phase === 'flight') {
      this.postureGauge(st);
      if (st.teleOpen && !st.teleTapped) {
        c.fillStyle = Math.floor(t * 9) % 2 ? '#ffd83d' : '#fff';
        c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
        c.fillText('착지 탭!', px, py - sz - 10);
      }
    }
    // 라이브 거리
    if (st.phase === 'flight' || st.phase === 'landed') {
      const d = st.phase === 'landed' ? st.dist : Math.round(Math.sqrt(st.x * st.x + st.y * st.y) * 2) / 2;
      c.font = 'bold 22px sans-serif'; c.textAlign = 'center';
      c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3;
      c.strokeText(d.toFixed(1) + ' m', W / 2, 34);
      c.fillText(d.toFixed(1) + ' m', W / 2, 34);
    }
    // 바람 표시
    if (stg.wind !== 0) {
      const fav = stg.wind > 0;
      c.font = 'bold 10px sans-serif'; c.textAlign = 'left';
      c.fillStyle = fav ? '#7de08a' : '#ff8a8a';
      c.fillText(`${fav ? '◀ 맞바람' : '▶ 뒷바람'} ${Math.abs(stg.wind).toFixed(1)}m/s ${fav ? '(유리)' : '(불리)'}`, 10, 18);
    }
    // 활강 속도
    if (st.phase === 'slide') {
      c.font = 'bold 10px sans-serif'; c.textAlign = 'left';
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.fillText(`${(st.v * 3.6).toFixed(0)} km/h`, 10, th === M.WORLDS[1] ? 18 : 32);
    }
  },

  _distX(stg, d) {
    // 근사: 거리 d의 언덕 x (렌더 전용 — 이진 탐색 간이판)
    let lo = 0, hi = stg.K * 2.2;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const y = stg.hillY(mid);
      if (Math.sqrt(mid * mid + y * y) < d) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  },

  takeoffMeter(st) {
    const c = this.ctx;
    const bw = 190, bx = W / 2 - bw / 2, by = 46;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(bx, by, bw, 14);
    // 초록 존: 립 시점(오른쪽 끝) 근처 ±0.28s
    const zone = (0.28 / 1.15) * bw;
    c.fillStyle = 'rgba(90,220,110,.75)'; c.fillRect(bx + bw - zone, by, zone, 14);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(bx + bw - zone * 0.35, by, zone * 0.35, 14);
    const nx = bx + bw * (1 - Math.min(1, st.untilLip / 1.15));
    c.fillStyle = '#fff'; c.fillRect(nx - 1.5, by - 3, 3, 20);
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd83d';
    c.fillText('도약 타이밍 — 탭!', W / 2, by - 7);
  },

  postureGauge(st) {
    const c = this.ctx;
    const gx = W - 26, gy = 60, gh = 90;
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(gx, gy, 12, gh);
    // 초록 존 [0.45, 0.80]
    c.fillStyle = 'rgba(90,220,110,.6)';
    c.fillRect(gx, gy + gh * (1 - 0.80), 12, gh * 0.35);
    const fy = gy + gh * (1 - st.P);
    c.fillStyle = M.Logic.postureQ(st.P) >= 1 ? '#7de08a' : M.Logic.postureQ(st.P) > 0.4 ? '#ffd83d' : '#ff7070';
    c.fillRect(gx + 1.5, fy - 2.5, 9, 5);
    c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText('자세', gx + 6, gy + gh + 12);
  },
};
