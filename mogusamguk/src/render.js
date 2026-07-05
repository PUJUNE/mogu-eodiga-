// render.js — 삼국전기풍 렌더: 갑옷 리그 + 무기 + 중화 배경 (모구드래곤 렌더 계보)
const M = window.MSG;
const W = 480, H = 270;
const ZS = 0.62;                        // 깊이 → 화면 y 계수

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [], camX: 0,

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    // CC0 에셋 (OGA 아시아 도시 타일셋, 퍼블릭 도메인): 상점 정면·기둥·간판·석상·등롱
    this.imgs = {};
    for (const k of ['bldDark', 'shopRed', 'colRed', 'signCat1', 'signCat2', 'statue', 'lantern2']) {
      if (!M.ASSETS[k]) continue;
      const im2 = new Image();
      im2.onload = () => { this.imgs[k] = im2; };
      im2.src = M.ASSETS[k];
    }
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

  addSpark(x, y, kd) { this.fx.push({ kind: kd ? 'kd' : 'spark', x, y, t: 0 }); },
  addMusou(x, y) { this.fx.push({ kind: 'musou', x, y, t: 0 }); },

  sy(z, jy) { return M.FLOOR_Y + z * ZS - (jy || 0); },

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  },

  // 다중 스톱 hex 보간 (밴드 그라데이션용)
  mixStops(stops, t) {
    const n = stops.length - 1;
    const k = Math.min(n - 1, Math.floor(t * n));
    const f = t * n - k;
    const a = parseInt(stops[k].slice(1), 16), b = parseInt(stops[k + 1].slice(1), 16);
    const ch = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  },

  // CRT 아케이드 후처리 (원작 스크린샷 분석 반영: 원작은 밝고 채도가 쨍함 — 그레이드 절제)
  retroPass() {
    const c = this.ctx;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = 'rgba(210,70,40,.05)';
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(0,0,0,.08)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.58, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(12,3,6,.26)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  },

  // 둥근 끝 두꺼운 선분 — 팔다리 (윤곽선 포함)
  limb(x1, y1, x2, y2, w2, color, outline = true) {
    const c = this.ctx;
    c.lineCap = 'round';
    if (outline) {
      c.strokeStyle = 'rgba(20,16,28,.9)';
      c.lineWidth = w2 + 2.6;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.strokeStyle = color;
    c.lineWidth = w2;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 카메라
    const target = Math.max(0, Math.min(st.stage.length - W, st.p.x - 210));
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    const cam = this.camX;

    this.drawBackground(st, t, cam);

    // GO → 표시
    if (st.go && Math.floor(t * 2.5) % 2 === 0) {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'right';
      c.fillStyle = th.accent;
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4;
      c.strokeText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
      c.fillText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
    }

    // 만두 (회복)
    for (const it of st.items) {
      const x = it.x - cam, y = this.sy(it.z, 0);
      const bob = Math.sin(t * 5 + it.x) * 2;
      c.strokeStyle = 'rgba(20,16,28,.8)'; c.lineWidth = 1.6;
      c.fillStyle = '#f6f0e2';
      c.beginPath(); c.arc(x, y - 6 + bob, 7, Math.PI, 0);
      c.quadraticCurveTo(x + 7, y - 2 + bob, x, y - 1 + bob);
      c.quadraticCurveTo(x - 7, y - 2 + bob, x - 7, y - 6 + bob);
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
      for (const a2 of [-0.5, 0, 0.5]) {
        c.beginPath(); c.moveTo(x + a2 * 6, y - 11 + bob); c.lineTo(x + a2 * 2, y - 7 + bob); c.stroke();
      }
    }

    // 화살
    for (const ar of st.arrows) {
      const x = ar.x - cam, y = this.sy(ar.z, 14);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - Math.sign(ar.vx) * 8, y); c.lineTo(x + Math.sign(ar.vx) * 4, y); c.stroke();
      c.fillStyle = '#c8ccd4';
      c.beginPath();
      c.moveTo(x + Math.sign(ar.vx) * 8, y);
      c.lineTo(x + Math.sign(ar.vx) * 3, y - 2.5);
      c.lineTo(x + Math.sign(ar.vx) * 3, y + 2.5);
      c.fill();
    }

    // 엔티티 (깊이 정렬)
    const ents = [st.p, st.b, ...st.enemies].filter((f) => f.state !== 'dead' || f.stT < 1.6);
    ents.sort((a, b2) => a.z - b2.z);
    for (const f of ents) this.drawFighter(st, f, t);

    // FX
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'musou' ? 0.5 : 0.3));
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'musou') {
        const p2 = f.t / 0.5, x2 = f.x - cam;
        // 전체 화면 방사 섬광 (원작 분석 — 필살기가 화면을 덮음)
        if (p2 < 0.45) {
          const fg2 = c.createRadialGradient(x2, f.y, 10, x2, f.y, W * 0.75);
          fg2.addColorStop(0, `rgba(255,240,160,${0.5 * (1 - p2 / 0.45)})`);
          fg2.addColorStop(0.55, `rgba(255,150,40,${0.32 * (1 - p2 / 0.45)})`);
          fg2.addColorStop(1, 'rgba(255,80,20,0)');
          c.fillStyle = fg2; c.fillRect(0, 0, W, H);
          c.globalAlpha = 1 - p2 / 0.45;
          c.strokeStyle = 'rgba(255,220,120,.55)'; c.lineWidth = 3;
          for (let k = 0; k < 10; k++) {
            const a2 = (k / 10) * Math.PI * 2 + p2 * 3;
            c.beginPath();
            c.moveTo(x2 + Math.cos(a2) * 30, f.y + Math.sin(a2) * 30);
            c.lineTo(x2 + Math.cos(a2) * (90 + p2 * 260), f.y + Math.sin(a2) * (90 + p2 * 260));
            c.stroke();
          }
        }
        c.globalAlpha = 1 - p2;
        c.strokeStyle = '#ffd83d'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(x2, f.y, 20 + p2 * 70, 8 + p2 * 24, 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a2 = p2 * 5 + i * 2.1;
          c.beginPath(); c.arc(x2, f.y - 14, 26 + p2 * 40, a2, a2 + 1.2); c.stroke();
        }
        c.globalAlpha = 1;
        continue;
      }
      const p = f.t / 0.3, x = f.x - cam;
      c.globalAlpha = 1 - p;
      c.strokeStyle = f.kind === 'kd' ? '#ffd83d' : '#fff';
      c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + p * 2;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 4, f.y + Math.sin(a) * 4);
        c.lineTo(x + Math.cos(a) * (9 + p * 15), f.y + Math.sin(a) * (9 + p * 15));
        c.stroke();
      }
      if (f.kind === 'kd') {
        c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
        c.fillStyle = '#ffd83d';
        c.fillText('POW!', x, f.y - 16 - p * 10);
      }
      c.globalAlpha = 1;
    }

    this.drawHud(st, t);
    this.retroPass();
  },

  // ── 미션별 배경 (수묵 산수 원경 — 하늘 띠 0~62px) ──
  drawBackground(st, t, cam) {
    const c = this.ctx, th = st.stage.theme, m = st.mission;
    // 하늘: 아케이드식 밴드 그라데이션 (이산 디더 밴딩)
    const stops = th.horizon ? [th.sky0, th.sky1, th.horizon] : [th.sky0, th.sky1];
    const BANDS = 9, bh = 66 / BANDS;
    for (let i = 0; i < BANDS; i++) {
      c.fillStyle = this.mixStops(stops, i / (BANDS - 1));
      c.fillRect(0, bh * i, W, bh + 1);
    }

    if (m === 1) {                      // 들판: 해 + 원경 봉화 연기
      c.fillStyle = 'rgba(255,240,200,.9)';
      c.beginPath(); c.arc(W - 96, 26, 10, 0, Math.PI * 2); c.fill();
      const hg = c.createRadialGradient(W - 96, 26, 4, W - 96, 26, 34);
      hg.addColorStop(0, 'rgba(255,230,160,.5)'); hg.addColorStop(1, 'rgba(255,230,160,0)');
      c.fillStyle = hg; c.fillRect(W - 132, -10, 72, 72);
      for (const sx2 of [110, 330]) {
        const x = sx2 - ((cam * 0.1) % (W + 200));
        c.strokeStyle = 'rgba(70,60,55,.4)'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, 64);
        c.quadraticCurveTo(x + Math.sin(t * 0.8) * 6, 40, x + 10 + Math.sin(t * 0.6) * 9, 14);
        c.stroke();
      }
    }
    if (m === 3) {                      // 성문 앞: 낮구름
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (const [cy2, cw, co] of [[16, 90, 40], [30, 130, 260], [22, 70, 420]]) {
        const x = (((co - cam * 0.05 - t * 4) % (W + cw)) + W + cw) % (W + cw) - cw;
        c.beginPath();
        c.ellipse(x + cw / 2, cy2, cw / 2, 7, 0, 0, Math.PI * 2);
        c.ellipse(x + cw / 2 - 18, cy2 + 3, cw / 3, 6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (m === 4) {                      // 성내 밤: 별
      c.fillStyle = 'rgba(255,255,240,.6)';
      for (let i = 0; i < 22; i++) c.fillRect((i * 151 + 23) % W, (i * 67 + 9) % 44, 1.5, 1.5);
    }

    // 원경 산수 2겹 + 산허리 안개 (하늘이 보이는 들판만)
    if (m === 1) {
      const MTN = {
        1: ['rgba(150,100,60,.3)', 'rgba(110,70,40,.5)'],
        2: ['rgba(30,70,50,.35)', 'rgba(20,50,35,.55)'],
        3: ['rgba(90,110,140,.4)', 'rgba(60,80,110,.55)'],
        4: ['rgba(70,40,60,.4)', 'rgba(50,25,45,.6)'],
      }[m];
      const ridge = (pf, base, amp, color) => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(-2, 66);
        for (let x = -2; x <= W + 2; x += 12) {
          const gx = x + cam * pf;
          const h = amp * (0.42 + 0.3 * Math.sin(gx * 0.014) + 0.28 * Math.sin(gx * 0.037 + 2.1));
          c.lineTo(x, 66 - base - h);
        }
        c.lineTo(W + 2, 66);
        c.closePath(); c.fill();
      };
      ridge(0.06, 10, 30, MTN[0]);
      const mg = c.createLinearGradient(0, 34, 0, 58);      // 산허리 안개 띠
      mg.addColorStop(0, 'rgba(255,255,255,0)');
      mg.addColorStop(0.5, 'rgba(255,255,255,.14)');
      mg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = mg; c.fillRect(0, 34, W, 24);
      ridge(0.14, 0, 22, MTN[1]);
    }
    if (m === 3) {                      // 원경 성곽 실루엣 (성가퀴 + 곡선 처마 망루)
      c.fillStyle = 'rgba(50,55,75,.55)';
      const wy = 50;
      c.fillRect(0, wy, W, 16);
      for (let bx = -12; bx < W + 12; bx += 12) {
        const x = bx - ((cam * 0.2) % 12);
        c.fillRect(x, wy - 4, 7, 4);
      }
      for (let i = -1; i < 3; i++) {
        const x = i * 260 - ((cam * 0.2) % 260) + 90;
        c.fillRect(x + 8, wy - 16, 24, 16);
        c.beginPath();
        c.moveTo(x, wy - 14);
        c.quadraticCurveTo(x + 20, wy - 26, x + 40, wy - 14);
        c.lineTo(x + 34, wy - 12); c.lineTo(x + 6, wy - 12);
        c.closePath(); c.fill();
      }
    }
    if (m === 4) {                      // 원경 기와지붕 행렬 + 등불빛
      c.fillStyle = 'rgba(30,18,32,.7)';
      for (let i = -1; i < 6; i++) {
        const x = i * 110 - ((cam * 0.2) % 110);
        c.beginPath();
        c.moveTo(x, 66);
        c.lineTo(x + 6, 46 + (i % 2) * 6);
        c.quadraticCurveTo(x + 50, 36 + (i % 2) * 6, x + 94, 46 + (i % 2) * 6);
        c.lineTo(x + 100, 66);
        c.closePath(); c.fill();
        c.fillStyle = `rgba(255,150,90,${0.5 + 0.3 * Math.sin(t * 2 + i)})`;
        c.fillRect(x + 46, 52 + (i % 2) * 5, 3, 3);
        c.fillStyle = 'rgba(30,18,32,.7)';
      }
    }
    if (m === 5) {                      // 왕좌의 방: 어두운 대들보 천장 + 높은 창 빛내림
      c.fillStyle = '#241018';
      c.fillRect(0, 0, W, 66);
      c.fillStyle = 'rgba(0,0,0,.35)';
      for (let bx = -60; bx < W + 60; bx += 60) {
        const x = bx - ((cam * 0.3) % 60);
        c.fillRect(x, 0, 14, 66);
      }
      c.fillStyle = 'rgba(255,214,110,.07)';
      for (let i = -1; i < 3; i++) {
        const x = i * 220 - ((cam * 0.3) % 220) + 60;
        c.beginPath();
        c.moveTo(x, 0); c.lineTo(x + 34, 0);
        c.lineTo(x + 90, M.FLOOR_Y); c.lineTo(x + 40, M.FLOOR_Y);
        c.closePath(); c.fill();
      }
    }

    // ── 근경 벽 (미션별 — 중화 테마) — 야외 들판만 하늘, 나머지는 상단까지 구조물 ──
    const wallTop = m === 1 ? 62 : 14, wallH = M.FLOOR_Y - wallTop;
    c.fillStyle = th.wall;
    c.fillRect(0, wallTop, W, wallH);
    if (m === 1) {
      // 황건적 들판: 목책 + 군기
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
      for (let bx = -14; bx < W + 14; bx += 14) {
        const x = bx - ((cam * 0.6) % 14);
        c.beginPath(); c.moveTo(x, wallTop + 26); c.lineTo(x, M.FLOOR_Y); c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,.2)';
      c.fillRect(0, wallTop + 22, W, 5);
      for (let i = -1; i < 5; i++) {
        const x = i * 150 - ((cam * 0.6) % 150) + 40;
        c.fillStyle = '#6a4a2a';
        c.fillRect(x, wallTop - 8, 4, 66);
        c.fillStyle = '#d8b83a';
        c.beginPath(); c.moveTo(x + 4, wallTop - 6); c.lineTo(x + 40, wallTop + 2); c.lineTo(x + 4, wallTop + 14); c.fill();
        c.fillStyle = '#8a2030';
        c.font = 'bold 11px sans-serif'; c.textAlign = 'left';
        c.fillText('黃', x + 12, wallTop + 7);
      }
      // 구간 2 (world 430~850): 황토 절벽길 — 목책이 끊기고 절벽 단층
      const cx0 = 430 - cam;
      if (cx0 < W && cx0 + 420 > 0) {
        c.save(); c.beginPath(); c.rect(cx0, wallTop - 8, 420, M.FLOOR_Y - wallTop + 8); c.clip();
        c.fillStyle = '#b08a4e';
        c.fillRect(cx0, wallTop - 8, 420, M.FLOOR_Y - wallTop + 8);
        for (let ry = 0; ry < M.FLOOR_Y - wallTop; ry += 18) {
          c.fillStyle = (ry / 18) % 2 ? 'rgba(130,88,34,.3)' : 'rgba(70,46,16,.18)';
          c.fillRect(cx0, wallTop + ry, 420, 7);
        }
        c.strokeStyle = 'rgba(70,45,15,.5)'; c.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          const xx = cx0 + 30 + k * 68;
          c.beginPath();
          c.moveTo(xx, wallTop + 10 + (k % 3) * 26);
          c.lineTo(xx + 12, wallTop + 44 + (k % 3) * 26);
          c.lineTo(xx + 6, wallTop + 74 + (k % 2) * 18);
          c.stroke();
        }
        c.fillStyle = 'rgba(60,90,40,.5)';                     // 절벽 틈 풀
        for (let k = 0; k < 5; k++) {
          c.beginPath(); c.ellipse(cx0 + 60 + k * 80, wallTop + 30 + (k % 3) * 34, 9, 3.5, 0, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      }
      // 구간 3 (world 850~1270): 계곡 로프 다리
      const bx0 = 850 - cam;
      if (bx0 < W && bx0 + 420 > 0) {
        c.save(); c.beginPath(); c.rect(bx0, wallTop - 10, 420, M.FLOOR_Y - wallTop + 10); c.clip();
        const gg = c.createLinearGradient(0, wallTop, 0, M.FLOOR_Y);
        gg.addColorStop(0, '#c8a86a'); gg.addColorStop(1, '#eadfc4');
        c.fillStyle = gg; c.fillRect(bx0, wallTop - 10, 420, M.FLOOR_Y - wallTop + 10);
        c.fillStyle = 'rgba(140,100,50,.55)';                  // 건너편 협곡 벽
        c.fillRect(bx0, wallTop - 10, 420, 38);
        c.fillStyle = 'rgba(255,255,255,.3)';                  // 계곡 안개
        c.beginPath(); c.ellipse(bx0 + 140, M.FLOOR_Y - 40, 120, 22, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(bx0 + 320, M.FLOOR_Y - 60, 100, 18, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#6a4a22'; c.lineWidth = 4; c.lineCap = 'round';
        for (let k = 0; k <= 6; k++) {                         // 다리 말뚝
          const xx = bx0 + k * 70;
          c.beginPath(); c.moveTo(xx, M.FLOOR_Y); c.lineTo(xx, M.FLOOR_Y - 52); c.stroke();
        }
        c.strokeStyle = '#8a6a38'; c.lineWidth = 2.4;
        for (let k = 0; k < 6; k++) {                          // 늘어진 로프 2줄
          const xx = bx0 + k * 70;
          c.beginPath(); c.moveTo(xx, M.FLOOR_Y - 48); c.quadraticCurveTo(xx + 35, M.FLOOR_Y - 34, xx + 70, M.FLOOR_Y - 48); c.stroke();
          c.beginPath(); c.moveTo(xx, M.FLOOR_Y - 24); c.quadraticCurveTo(xx + 35, M.FLOOR_Y - 12, xx + 70, M.FLOOR_Y - 24); c.stroke();
        }
        c.restore();
      }
    } else if (m === 2) {
      // 대나무 숲
      for (let i = -1; i < 14; i++) {
        const x = i * 42 - ((cam * 0.6) % 42);
        const sway = Math.sin(t * 1.2 + i) * 2;
        c.strokeStyle = i % 2 ? '#4a7a3a' : '#5a8a46';
        c.lineWidth = 7;
        c.beginPath(); c.moveTo(x, M.FLOOR_Y); c.quadraticCurveTo(x + sway, wallTop + 40, x + sway * 2, wallTop - 6); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.4;
        for (const sy2 of [wallTop + 20, wallTop + 52, wallTop + 84]) {
          c.beginPath(); c.moveTo(x - 4 + sway, sy2); c.lineTo(x + 4 + sway, sy2); c.stroke();
        }
        c.strokeStyle = '#3a6a2a'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + sway, wallTop + 24); c.lineTo(x + 14 + sway, wallTop + 12); c.stroke();
      }
      // 구간 3 (world 850~1270): 강 나루터 — 대나무가 걷히고 정박한 목선
      const nx0 = 850 - cam;
      if (nx0 < W && nx0 + 420 > 0) {
        c.save(); c.beginPath(); c.rect(nx0, wallTop - 8, 420, M.FLOOR_Y - wallTop + 8); c.clip();
        const wg = c.createLinearGradient(0, wallTop, 0, M.FLOOR_Y);
        wg.addColorStop(0, '#9fc8b0'); wg.addColorStop(1, '#4e8a78');
        c.fillStyle = wg; c.fillRect(nx0, wallTop - 8, 420, M.FLOOR_Y - wallTop + 8);
        c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.4;
        for (let k = 0; k < 8; k++) {                          // 물결
          const yy = wallTop + 34 + k * 14;
          c.beginPath();
          for (let xx = 0; xx <= 420; xx += 20) c.lineTo(nx0 + xx, yy + Math.sin((xx + t * 40) * 0.05 + k) * 2);
          c.stroke();
        }
        const shx = nx0 + 170, shy = M.FLOOR_Y - 42;           // 정박 목선
        const bob = Math.sin(t * 1.2) * 1.5;
        c.fillStyle = '#6a4526';
        c.beginPath();
        c.moveTo(shx - 95, shy + bob);
        c.quadraticCurveTo(shx, shy + 30 + bob, shx + 95, shy + bob);
        c.lineTo(shx + 76, shy - 24 + bob); c.lineTo(shx - 76, shy - 24 + bob);
        c.closePath(); c.fill();
        c.fillStyle = '#8a6236';
        c.fillRect(shx - 76, shy - 24 + bob, 152, 7);
        c.strokeStyle = 'rgba(40,24,10,.4)'; c.lineWidth = 1.4;
        for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(shx - 70 + k * 35, shy - 17 + bob); c.lineTo(shx - 58 + k * 35, shy + 8 + bob); c.stroke(); }
        c.fillStyle = '#5a3a1e';
        c.fillRect(shx - 3, shy - 82 + bob, 6, 60);            // 돛대
        c.fillStyle = '#d8cfb0';
        c.beginPath();                                          // 접힌 돛
        c.moveTo(shx + 4, shy - 78 + bob); c.lineTo(shx + 44, shy - 32 + bob); c.lineTo(shx + 4, shy - 32 + bob);
        c.closePath(); c.fill();
        c.strokeStyle = '#8a6a38'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(shx - 60, shy - 20 + bob); c.lineTo(nx0 + 40, M.FLOOR_Y - 4); c.stroke();   // 밧줄
        // 선착장 말뚝
        c.fillStyle = '#5a4226';
        for (const px2 of [nx0 + 40, nx0 + 330, nx0 + 390]) {
          c.fillRect(px2, M.FLOOR_Y - 26, 8, 26);
          c.beginPath(); c.ellipse(px2 + 4, M.FLOOR_Y - 26, 5, 3, 0, 0, Math.PI * 2); c.fill();
        }
        c.restore();
      }
    } else if (m === 3) {
      // 성문 앞: 석성벽 + 성가퀴 + 성문
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5;
      for (let ry = 8; ry < wallH; ry += 15) {
        c.beginPath(); c.moveTo(0, wallTop + ry); c.lineTo(W, wallTop + ry); c.stroke();
        const off = (ry / 15) % 2 ? 19 : 0;
        for (let bx = -38; bx < W + 38; bx += 38) {
          const x = bx + off - ((cam * 0.6) % 38);
          c.beginPath(); c.moveTo(x, wallTop + ry); c.lineTo(x, wallTop + ry + 15); c.stroke();
        }
      }
      c.fillStyle = this.shade(th.wall, 1.2);
      for (let bx = -48; bx < W + 48; bx += 48) {
        const x = bx - ((cam * 0.6) % 48);
        c.fillRect(x, wallTop - 4, 26, 12);
      }
      for (let i = -1; i < 3; i++) {
        const x = i * 300 - ((cam * 0.6) % 300) + 80;
        c.fillStyle = '#3a2418';
        c.beginPath();
        c.moveTo(x, M.FLOOR_Y); c.lineTo(x, wallTop + 34);
        c.arc(x + 30, wallTop + 34, 30, Math.PI, 0);
        c.lineTo(x + 60, M.FLOOR_Y);
        c.fill();
        c.fillStyle = '#d8b83a';
        for (let ny = 0; ny < 3; ny++) for (let nx = 0; nx < 4; nx++) {
          c.beginPath(); c.arc(x + 12 + nx * 12, wallTop + 56 + ny * 18, 1.8, 0, Math.PI * 2); c.fill();
        }
      }
    } else if (m === 4) {
      // 성내 시가: 기와 처마 + 홍등
      c.fillStyle = this.shade(th.wall, 0.8);
      c.fillRect(0, wallTop, W, 16);
      c.fillStyle = '#2a1a20';
      for (let bx = -22; bx < W + 22; bx += 22) {
        const x = bx - ((cam * 0.6) % 22);
        c.beginPath(); c.arc(x, wallTop + 16, 11, 0, Math.PI); c.fill();
      }
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
      for (let bx = -30; bx < W + 30; bx += 30) {
        const x = bx - ((cam * 0.6) % 30);
        c.beginPath(); c.moveTo(x, wallTop + 26); c.lineTo(x, M.FLOOR_Y); c.stroke();
      }
      for (let i = -1; i < 6; i++) {
        const x = i * 110 - ((cam * 0.6) % 110) + 30;
        const sway = Math.sin(t * 1.6 + i * 1.3) * 2.5;
        c.strokeStyle = '#3a2418'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x, wallTop + 16); c.lineTo(x + sway, wallTop + 34); c.stroke();
        c.fillStyle = '#e04838';
        c.beginPath(); c.ellipse(x + sway, wallTop + 44, 9, 11, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,220,140,.8)';
        c.beginPath(); c.ellipse(x + sway, wallTop + 44, 4.5, 6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#d8b83a';
        c.fillRect(x + sway - 3, wallTop + 32, 6, 3);
        c.fillRect(x + sway - 3, wallTop + 54, 6, 3);
      }
      // CC0 상점 정면 행 (아시아 도시 타일셋 — 픽셀 크리스프)
      if (this.imgs && this.imgs.shopRed && this.imgs.bldDark) {
        c.imageSmoothingEnabled = false;
        for (let i = -1; i < 5; i++) {
          const seg = Math.floor(cam * 0.6 / 130) + i;
          const x = seg * 130 - cam * 0.6;
          const im2 = (seg % 2 === 0) ? this.imgs.shopRed : this.imgs.bldDark;
          const sc = (seg % 2 === 0) ? 1.55 : 1.9;
          const wI = im2.width * sc, hI = im2.height * sc;
          c.drawImage(im2, x, M.FLOOR_Y - hI, wI, hI);
          if (this.imgs.colRed) {
            const cw2 = this.imgs.colRed.width * 1.55, ch2 = this.imgs.colRed.height * 1.55;
            c.drawImage(this.imgs.colRed, x + wI + (130 - wI - cw2) / 2, M.FLOOR_Y - ch2, cw2, ch2);
          }
        }
        // 고양이 간판 (흔들림)
        for (let i = -1; i < 4; i++) {
          const seg = Math.floor(cam * 0.6 / 170) + i;
          const sg2 = (seg % 2 === 0) ? this.imgs.signCat1 : this.imgs.signCat2;
          if (!sg2) continue;
          const x = seg * 170 - cam * 0.6 + 84;
          const sway = Math.sin(t * 1.8 + seg) * 2;
          c.strokeStyle = '#3a2418'; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(x + 15, wallTop + 4); c.lineTo(x + 15 + sway, wallTop + 14); c.stroke();
          c.drawImage(sg2, x + sway, wallTop + 14, 30, 29);
        }
        c.imageSmoothingEnabled = true;
      }
    } else {
      // 왕좌의 방: 붉은 기둥 + 금장 문양 + 옥좌 휘장
      c.fillStyle = this.shade(th.wall, 0.7);
      c.fillRect(0, wallTop, W, wallH);
      for (let i = -1; i < 5; i++) {
        const x = i * 130 - ((cam * 0.6) % 130) + 20;
        c.fillStyle = '#a02828';
        c.fillRect(x, wallTop - 4, 22, wallH + 4);
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.fillRect(x + 3, wallTop - 4, 5, wallH + 4);
        c.fillStyle = '#d8b83a';
        c.fillRect(x - 3, wallTop - 8, 28, 7);
        c.fillRect(x - 3, M.FLOOR_Y - 8, 28, 8);
        c.beginPath(); c.arc(x + 11, wallTop + 44, 6, 0, Math.PI * 2);
        c.moveTo(x + 11, wallTop + 78); c.arc(x + 11, wallTop + 82, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,216,61,.16)';
      for (let i = 0; i < 8; i++) {
        c.globalAlpha = 0.25 + 0.3 * Math.sin(t * 2 + i * 1.5);
        c.fillRect((i * 137 + 40) % W, wallTop + 10 + (i * 43) % 70, 2, 2);
      }
      c.globalAlpha = 1;
      // CC0 석상 (기둥 사이 수호상)
      if (this.imgs && this.imgs.statue) {
        c.imageSmoothingEnabled = false;
        for (let i = -1; i < 3; i++) {
          const x = i * 260 - ((cam * 0.6) % 260) + 75;
          const im2 = this.imgs.statue;
          const hI = 96, wI = im2.width * (hI / im2.height);
          c.drawImage(im2, x, M.FLOOR_Y - hI, wI, hI);
        }
        c.imageSmoothingEnabled = true;
      }
    }

    // ── 표면 질감 (명암 얼룩 — 회화 패스) ──
    for (let i = -1; i < 26; i++) {
      const seg = Math.floor(cam * 0.6 / 60) + i;
      const h2 = (seg * 2246822519 + 5) >>> 5;
      const x = seg * 60 - cam * 0.6 + (h2 % 40);
      const yy = wallTop + 6 + (h2 % 7) * 20;
      const w3 = 18 + (h2 % 34), h3 = 6 + (h2 % 14);
      c.fillStyle = h2 % 3 === 0 ? 'rgba(255,244,210,.05)' : 'rgba(10,6,10,.07)';
      c.fillRect(x, Math.min(yy, M.FLOOR_Y - h3 - 2), w3, h3);
    }
    // 벽-바닥 접합 AO (접지감)
    const ao = c.createLinearGradient(0, M.FLOOR_Y - 20, 0, M.FLOOR_Y);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,.24)');
    c.fillStyle = ao;
    c.fillRect(0, M.FLOOR_Y - 20, W, 20);

    // ── 바닥 (벽보다 밝게 + 미션별 대각 원근 텍스처 — 원작 문법) ──
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, this.shade(th.floor, 1.06));
    fg.addColorStop(1, this.shade(th.floor, 0.8));
    c.fillStyle = fg;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    // 보도 경계
    c.fillStyle = this.shade(th.floor, 1.3);
    c.fillRect(0, M.FLOOR_Y, W, 3);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(0, M.FLOOR_Y + 3, W, 1.5);
    if (m === 1 || m === 4) {
      // 흙길/판석: 수평 골 + 대각 이음
      c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1.4;
      for (const zz of [24, 48, 70]) {
        const y = M.FLOOR_Y + zz * ZS;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      for (let i = -1; i < 7; i++) {
        const x = i * 100 - (cam % 100) + 20;
        c.beginPath(); c.moveTo(x, M.FLOOR_Y + 4); c.lineTo(x - 26, H); c.stroke();
      }
    } else if (m === 2) {
      // 숲 흙바닥: 풀포기 데칼
      c.fillStyle = 'rgba(40,80,30,.5)';
      for (let i = -1; i < 10; i++) {
        const seg = Math.floor(cam / 70) + i;
        const x = seg * 70 - cam + ((seg * 31) % 40);
        const y = M.FLOOR_Y + 12 + ((seg * 53) % 60) * ZS;
        for (let k = -1; k <= 1; k++) {
          c.beginPath(); c.moveTo(x + k * 3, y); c.lineTo(x + k * 4, y - 5 - Math.abs(k)); c.lineTo(x + k * 3 + 1.5, y); c.closePath(); c.fill();
        }
      }
    } else if (m === 3) {
      // 석판: 격자 이음 + 원형 문양
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.4;
      for (const zz of [22, 44, 66]) {
        const y = M.FLOOR_Y + zz * ZS;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      for (let i = -1; i < 8; i++) {
        const x = i * 80 - (cam % 80);
        c.beginPath(); c.moveTo(x, M.FLOOR_Y + 4); c.lineTo(x - 20, H); c.stroke();
      }
      for (let i = -1; i < 3; i++) {                 // 대형 원형 석문양 (원작 분석 — 바닥이 캔버스)
        const seg = Math.floor(cam / 300) + i;
        const x = seg * 300 - cam + 140;
        const y = M.FLOOR_Y + 40;
        c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2.5;
        c.beginPath(); c.ellipse(x, y, 58, 24, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.ellipse(x, y, 40, 16.5, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.ellipse(x, y, 20, 8.5, 0, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(x, y, 1, 0, Math.PI * 2); c.stroke();
        for (let k = 0; k < 8; k++) {                // 방사 살
          const a = (k / 8) * Math.PI * 2;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 9);
          c.lineTo(x + Math.cos(a) * 56, y + Math.sin(a) * 23);
          c.stroke();
        }
      }
    } else {
      // 왕좌의 방: 붉은 카펫 + 금 테 + 마름모 문양
      c.fillStyle = '#d8b83a';
      c.fillRect(0, M.FLOOR_Y + 6, W, 2.5);
      c.fillRect(0, H - 7, W, 2.5);
      c.fillStyle = 'rgba(0,0,0,.13)';
      for (let i = -1; i < 8; i++) {
        const x = i * 70 - (cam % 70);
        c.beginPath();
        c.moveTo(x, M.FLOOR_Y + 40); c.lineTo(x + 15, M.FLOOR_Y + 28);
        c.lineTo(x + 30, M.FLOOR_Y + 40); c.lineTo(x + 15, M.FLOOR_Y + 52);
        c.closePath(); c.fill();
      }
    }
    // 바닥 균열·맨홀 (해시 데칼)
    for (let i = -1; i < 5; i++) {
      const seg = Math.floor(cam / 150) + i;
      const x = seg * 150 - cam + 40;
      const h2 = (seg * 40503 + 7) >>> 3;
      const zz = 14 + (h2 % 50);
      const y = M.FLOOR_Y + zz * ZS;
      if (h2 % 2 === 0) {
        c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + 4); c.lineTo(x + 20, y + 2); c.stroke();
      } else {
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x + 14, y, 11, 4.5, 0, 0, Math.PI * 2); c.stroke();
      }
    }

    // ── 무드 구간 오버레이 (원작 측정 팔레트 세트피스) ──
    // M3 청록 회랑(월드 430~850, S10 #365e52·#789f8c) · M4 불바다(월드 850~1270, S13 #f09515·#e52103)
    const mood = (x0, x1, draw) => {
      const sx = x0 - cam, ex = x1 - cam;
      if (ex < 0 || sx > W) return;
      c.save();
      c.beginPath(); c.rect(Math.max(0, sx), 0, Math.min(W, ex) - Math.max(0, sx), 300);
      c.clip();
      draw(sx, ex);
      c.restore();
    };
    if (m === 3) {
      mood(430, 850, (sx) => {
        // 청록 동굴 회랑: 전면 워시 + 종유석 + 이끼 바위 원반 (바닥이 캔버스)
        c.fillStyle = 'rgba(54,94,82,.42)';
        c.fillRect(sx, 0, 420, 300);
        c.fillStyle = '#365e52';
        for (let k = 0; k < 9; k++) {
          const x = sx + 20 + k * 46, len = 14 + ((k * 37) % 22);
          c.beginPath(); c.moveTo(x - 7, 12); c.lineTo(x, 12 + len); c.lineTo(x + 7, 12); c.closePath(); c.fill();
        }
        for (let k = 0; k < 4; k++) {
          const x = sx + 60 + k * 105, y = M.FLOOR_Y + 46 + (k % 2) * 26;
          c.fillStyle = 'rgba(120,159,140,.5)';
          c.beginPath(); c.ellipse(x, y, 40, 13, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(30,60,50,.55)'; c.lineWidth = 2;
          c.beginPath(); c.ellipse(x, y, 40, 13, 0, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.ellipse(x, y, 24, 8, 0, 0, Math.PI * 2); c.stroke();
        }
      });
    } else if (m === 4) {
      mood(850, 1270, (sx) => {
        // 불바다: 벽 밑 화염 혀 + 불기둥 + 전면 글로우
        c.fillStyle = 'rgba(229,33,3,.20)';
        c.fillRect(sx, 0, 420, 300);
        for (let k = 0; k < 12; k++) {
          const x = sx + 12 + k * 35;
          const fl = 22 + Math.sin(t * 7 + k * 1.7) * 9;
          const g2 = c.createLinearGradient(0, M.FLOOR_Y, 0, M.FLOOR_Y - fl - 16);
          g2.addColorStop(0, 'rgba(240,149,21,.85)');
          g2.addColorStop(0.6, 'rgba(229,33,3,.55)');
          g2.addColorStop(1, 'rgba(229,33,3,0)');
          c.fillStyle = g2;
          c.beginPath();
          c.moveTo(x - 9, M.FLOOR_Y);
          c.quadraticCurveTo(x - 4, M.FLOOR_Y - fl * 0.6, x, M.FLOOR_Y - fl - 10);
          c.quadraticCurveTo(x + 4, M.FLOOR_Y - fl * 0.6, x + 9, M.FLOOR_Y);
          c.closePath(); c.fill();
        }
        for (const px of [sx + 90, sx + 300]) {
          const g3 = c.createLinearGradient(0, M.FLOOR_Y, 0, 20);
          g3.addColorStop(0, 'rgba(240,149,21,.75)');
          g3.addColorStop(1, 'rgba(229,33,3,.08)');
          c.fillStyle = g3;
          const wob = Math.sin(t * 5 + px) * 4;
          c.fillRect(px + wob, 20, 14, M.FLOOR_Y - 20);
        }
        c.fillStyle = 'rgba(255,170,60,.10)';
        c.fillRect(sx, 0, 420, 300);
      });
    }

    // 미션별 공기 입자: 흙먼지 / 댓잎 / 꽃잎 / 불티 / 금빛 먼지
    for (let i = 0; i < 12; i++) {
      const ph = i * 1.7 + (i * i) % 5;
      if (m === 1) {                    // 마른 흙먼지 — 바람에 오른쪽으로
        const x = ((i * 173 + t * 26 - cam * 0.3) % (W + 20) + W + 20) % (W + 20) - 10;
        const y = 80 + ((i * 61) % 150) + Math.sin(t * 1.5 + ph) * 6;
        c.fillStyle = 'rgba(200,170,110,.35)';
        c.fillRect(x, y, 2, 1.5);
      } else if (m === 2) {             // 떨어지는 댓잎
        const y = ((i * 97 + t * 34) % 260);
        const x = ((i * 211 - cam * 0.5) % (W + 30) + W + 30) % (W + 30) - 15 + Math.sin(t * 1.8 + ph) * 14;
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2 + ph) * 0.9);
        c.fillStyle = 'rgba(130,180,90,.55)';
        c.beginPath(); c.ellipse(0, 0, 4, 1.4, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (m === 3) {             // 꽃잎
        const y = ((i * 83 + t * 22) % 260);
        const x = ((i * 191 - cam * 0.4) % (W + 30) + W + 30) % (W + 30) - 15 + Math.sin(t * 1.4 + ph) * 18;
        c.fillStyle = 'rgba(255,190,205,.6)';
        c.beginPath(); c.ellipse(x, y, 2.2, 1.4, Math.sin(t + ph), 0, Math.PI * 2); c.fill();
      } else if (m === 4) {             // 불티 — 위로 떠오름
        const y = 250 - ((i * 71 + t * 30) % 240);
        const x = ((i * 157 - cam * 0.4) % (W + 20) + W + 20) % (W + 20) - 10 + Math.sin(t * 3 + ph) * 8;
        c.fillStyle = `rgba(255,150,70,${0.25 + 0.3 * Math.sin(t * 6 + ph)})`;
        c.fillRect(x, y, 1.8, 1.8);
      } else {                          // 금빛 먼지 — 빛내림 속을 느리게
        const y = ((i * 89 + t * 9) % 250);
        const x = ((i * 199 - cam * 0.3) % (W + 20) + W + 20) % (W + 20) - 10 + Math.sin(t * 0.8 + ph) * 5;
        c.fillStyle = `rgba(255,216,110,${0.18 + 0.18 * Math.sin(t * 2.5 + ph)})`;
        c.fillRect(x, y, 1.6, 1.6);
      }
    }
  },

  // ── HUD: 초상화 + HP 바 ──
  drawHud(st, t) {
    const c = this.ctx;
    this.portraitBar(10, 8, 120, st.p.hp / st.p.maxHp, '#58c85c', 'mogu');
    this.portraitBar(10, 32, 92, Math.max(0, st.b.hp) / st.b.maxHp, '#ffd83d', 'chick');
    // 레벨 배지 + 경험치 게이지
    c.font = 'bold 9px sans-serif'; c.textAlign = 'left';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.strokeText(`LEV ${st.lv}`, 10, 61);
    c.fillStyle = '#ffd83d';
    c.fillText(`LEV ${st.lv}`, 10, 61);
    if (st.lv < M.Logic.LV_MAX) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(38, 55, 52, 5);
      c.fillStyle = '#b07dff';
      c.fillRect(39, 56, 50 * Math.min(1, st.expInto / M.Logic.expNeed(st.lv)), 3);
    } else {
      c.fillStyle = '#b07dff';
      c.fillText('MAX', 38, 61);
    }
    const boss = st.enemies.find((e) => e.boss && M.Logic.alive(e));
    if (boss) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(W - 166, 10, 156, 12);
      c.fillStyle = '#ff5a5a';
      c.fillRect(W - 165, 11, 154 * Math.max(0, boss.hp / boss.maxHp), 10);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
      c.strokeRect(W - 166, 10, 156, 12);
      c.font = 'bold 9px sans-serif'; c.textAlign = 'right'; c.fillStyle = '#fff';
      c.fillText('👑 ' + boss.name, W - 12, 32);
    }
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.fillStyle = 'rgba(255,255,255,.92)';
    const label = `MISSION ${st.mission} · ${st.stage.theme.name}`;
    c.strokeText(label, W / 2, 18);
    c.fillText(label, W / 2, 18);
  },

  portraitBar(x, y, w2, ratio, color, face) {
    const c = this.ctx;
    // 초상화 틀 (금장 프레임 — 사극 톤)
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.beginPath(); c.roundRect(x, y, 19, 19, 3); c.fill();
    c.strokeStyle = '#d8b83a'; c.lineWidth = 1.4;
    c.strokeRect(x, y, 19, 19);
    c.strokeStyle = 'rgba(90,20,20,.8)'; c.lineWidth = 0.8;
    c.strokeRect(x - 1, y - 1, 21, 21);
    if (face === 'mogu' && this.mogu) {
      const a = this.mogu.width / this.mogu.height;
      c.save();
      c.beginPath(); c.rect(x + 1, y + 1, 17, 17); c.clip();
      c.drawImage(this.mogu, x + 9.5 - (17 * a) / 2, y + 1, 17 * a, 17);
      c.restore();
    } else if (face === 'chick') {
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(x + 9.5, y + 11, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d83a3a';
      c.beginPath(); c.arc(x + 7, y + 4.5, 2, 0, Math.PI * 2); c.arc(x + 10.5, y + 3.8, 2, 0, Math.PI * 2); c.arc(x + 13, y + 4.5, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(x + 14, y + 10); c.lineTo(x + 18, y + 11.5); c.lineTo(x + 14, y + 13); c.fill();
      c.fillStyle = '#22262e'; c.fillRect(x + 10.5, y + 8.5, 2, 2);
    }
    // HP 바 (금테 + 노랑/빨강 이중층 — 사극 아케이드 문법)
    c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(x + 23, y + 5, w2, 9);
    c.fillStyle = '#a02418';
    c.fillRect(x + 24, y + 6, w2 - 2, 7);
    const fw2 = Math.max(0, (w2 - 2) * Math.min(1, ratio));
    c.fillStyle = '#ffd83d';
    c.fillRect(x + 24, y + 6, fw2, 7);
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.fillRect(x + 24, y + 6, fw2, 2);
    c.strokeStyle = '#d8b83a'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, w2, 9);
  },

  // ── 캐릭터 (더블드래곤풍 리그) ──
  // 스프라이트 패스: 본체를 오프스크린에 그린 뒤 균일 윤곽 + 상하 2톤 셀 셰이딩 합성 (아케이드 화풍)
  drawFighter(st, f, t) {
    const c0 = this.ctx;
    const x = f.x - this.camX;
    if (x < -70 || x > W + 70) return;
    const y = this.sy(f.z, f.jy);
    c0.fillStyle = 'rgba(0,0,0,.3)';
    c0.beginPath(); c0.ellipse(x, this.sy(f.z, 0) + 3, 15, 4.5, 0, 0, Math.PI * 2); c0.fill();
    if (!this.osc) {
      this.osc = document.createElement('canvas'); this.osc.width = 160; this.osc.height = 190;
      this.os2 = document.createElement('canvas'); this.os2.width = 160; this.os2.height = 190;
    }
    const oc = this.osc.getContext('2d');
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, 160, 190);
    oc.setTransform(1, 0, 0, 1, 80 - x, 136 - y);
    this.ctx = oc;
    this.drawFighterBody(st, f, t);
    this.ctx = c0;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.globalCompositeOperation = 'source-atop';
    const sg = oc.createLinearGradient(0, 56, 0, 152);
    sg.addColorStop(0, 'rgba(255,240,205,.12)');
    sg.addColorStop(0.5, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(24,12,34,.24)');
    oc.fillStyle = sg; oc.fillRect(0, 0, 160, 190);
    oc.globalCompositeOperation = 'source-over';
    const o2 = this.os2.getContext('2d');
    o2.setTransform(1, 0, 0, 1, 0, 0);
    o2.clearRect(0, 0, 160, 190);
    o2.drawImage(this.osc, 0, 0);
    o2.globalCompositeOperation = 'source-in';
    o2.fillStyle = 'rgba(22,14,28,.95)';
    o2.fillRect(0, 0, 160, 190);
    o2.globalCompositeOperation = 'source-over';
    const bx = x - 80, by = y - 136;
    for (const [ox, oy] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      c0.drawImage(this.os2, bx + ox, by + oy);
    }
    c0.drawImage(this.osc, bx, by);
  },

  drawFighterBody(st, f, t) {
    const c = this.ctx;
    const x = f.x - this.camX;
    const y = this.sy(f.z, f.jy);
    const down = f.state === 'down' || f.state === 'dead';
    const hurt = f.state === 'hurt';
    const atk = f.state === 'atk';
    const walk = f.state === 'walk';
    const dead = f.state === 'dead';
    const airkick = atk && f.jy > 0;

    c.save();
    c.translate(x, y);
    if (f.face < 0) c.scale(-1, 1);
    if (dead) c.globalAlpha = Math.max(0, 1 - (f.stT - 0.8) / 0.8);
    if (down) { c.rotate(-Math.PI / 2); c.translate(10, 14); }
    if (hurt) { c.translate(Math.sin(t * 40) * 1.5, 0); c.rotate(-0.12); }

    const big = f.boss ? 1.35 : f.type === 'tank' ? 1.15 : 1;
    c.scale(big, big);

    // 팔레트
    const isP = f.kind === 'p', isB = f.kind === 'b';
    const E = M.ETYPES[f.type];
    const shirtC = isP ? '#d84838' : isB ? '#3a7ec8' : this.shade((f.body || (E && E.body) || '#9aa2ad'), 0.9);
    const skinC = isP ? '#e8c8a0' : isB ? '#f0e8d8' : this.shade((f.body || (E && E.body) || '#9aa2ad'), 1.18);
    const pantC = isP ? '#3a4a7a' : isB ? '#4a3a2a' : '#3a3644';
    const shoeC = isP ? '#e8e4dc' : '#2a2430';

    const step = walk ? Math.sin(t * 11) : 0;      // 걷기 위상

    // ── 다리 (5~6등신 장수 비례 — 무릎 굽힘 워크 사이클) ──
    if (airkick) {
      this.limb(0, -30, 18, -27, 7, pantC);        // 앞차기 허벅지+정강이
      this.limb(18, -27, 30, -24, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(33, -24, 5, 3.5, 0.2, 0, Math.PI * 2); c.fill();
      this.limb(-2, -30, -8, -17, 7, pantC);       // 접은 뒷다리
      this.limb(-8, -17, -2, -11, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(-1, -10, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else if (f.jy > 0) {
      this.limb(1, -30, 5, -16, 7, pantC);
      this.limb(5, -16, 8, -10, 6, pantC);
      this.limb(-3, -30, -8, -18, 7, pantC);
      this.limb(-8, -18, -12, -12, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(9, -9, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(-13, -11, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else {
      // 지상: 앞다리·뒷다리 (걸을 때 무릎이 번갈아 굽음)
      const k1 = step * 6, k2 = -step * 6;
      this.limb(2, -30, 4 + k1, -15, 7, pantC);
      this.limb(4 + k1, -15, 5 + k1 * 1.2, -1, 6, pantC);
      this.limb(-3, -30, -4 + k2, -15, 7, pantC);
      this.limb(-4 + k2, -15, -5 + k2 * 1.2, -1, 6, pantC);
      c.fillStyle = shoeC;
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(7 + k1 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-3 + k2 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 치마갑 (허리 찰갑 3단) ──
    const armC = isP ? '#c8a030' : isB ? '#8a9aa8' : this.shade((f.body || (E && E.body) || '#9aa2ad'), 0.8);
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6; c.lineJoin = 'round';
    c.fillStyle = armC;
    c.beginPath();
    c.moveTo(-9, -31); c.lineTo(9, -31); c.lineTo(11, -18); c.lineTo(-11, -18);
    c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-10, -27); c.lineTo(10, -27); c.stroke();
    c.beginPath(); c.moveTo(-10.5, -22.5); c.lineTo(10.5, -22.5); c.stroke();
    c.beginPath(); c.moveTo(0, -31); c.lineTo(0, -18); c.stroke();

    // ── 몸통 (판금 흉갑 — 역삼각) ──
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2.4; c.lineJoin = 'round';
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(-12, -56); c.quadraticCurveTo(0, -59, 12, -56);
    c.lineTo(8, -29); c.quadraticCurveTo(0, -27, -8, -29);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = this.shade(shirtC, 0.75);        // 옆구리 음영
    c.beginPath();
    c.moveTo(7, -55); c.lineTo(12, -56); c.lineTo(8, -29); c.lineTo(5, -29);
    c.closePath(); c.fill();
    if (isP) {
      // 금장 흉갑 + 홍심
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      c.fillStyle = '#d8b83a';
      c.beginPath(); c.roundRect(-9, -51, 18, 14, 3); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-9, -44); c.lineTo(9, -44); c.stroke();
      c.fillStyle = '#a02828';
      c.beginPath(); c.arc(0, -43, 2.8, 0, Math.PI * 2); c.fill();
    } else {
      // 찰갑 가로줄 (병졸 갑주)
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.1;
      for (const yy of [-51, -46, -41, -36]) {
        c.beginPath(); c.moveTo(-10 + (yy + 51) * 0.1, yy); c.lineTo(10 - (yy + 51) * 0.1, yy); c.stroke();
      }
    }
    // 벨트
    c.fillStyle = '#1a1620';
    c.fillRect(-8, -32, 16, 3.5);
    c.fillStyle = '#d8b83a';
    c.fillRect(-2, -32, 4, 3.5);
    // 견갑 (전원 — 장수 실루엣)
    c.fillStyle = armC;
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(-12, -53, 6, 4.5, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(12, -53, 6, 4.5, 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    if (isP || isB) {
      // 견갑 밑 홍술 (장수 술 장식)
      c.strokeStyle = '#b03028'; c.lineWidth = 1.6; c.lineCap = 'round';
      for (const sd of [-1, 1]) {
        for (let k2 = -1; k2 <= 1; k2++) {
          c.beginPath();
          c.moveTo(sd * (12 + k2 * 2.5), -49);
          c.lineTo(sd * (12 + k2 * 3), -44 + Math.abs(k2));
          c.stroke();
        }
      }
    }
    if (isP) {
      // 금장 흉갑 위 용문양 (S자 곡선 각인)
      c.strokeStyle = 'rgba(120,70,10,.75)'; c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-5, -49);
      c.bezierCurveTo(-1, -51, 1, -46, 5, -48);
      c.stroke();
      c.beginPath();
      c.moveTo(-4, -46.5);
      c.bezierCurveTo(0, -48.5, 2, -44, 5.5, -46);
      c.stroke();
    }

    // ── 팔 (가드 자세 / 찌르기 / 올려베기) ──
    const shY = -52;
    if (atk && f.jy === 0) {
      const upper = f.combo === 3;
      if (upper) {
        this.limb(-9, shY, -16, -44, 6, skinC);    // 뒷팔 가드
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-17, -43, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(9, shY, 18, -60, 6.5, skinC);    // 올려베기!
        this.limb(18, -60, 22, -70, 6, skinC);
        c.beginPath(); c.arc(23, -73, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        this.limb(-9, shY, -16, -43, 6, skinC);
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-17, -42, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(9, shY, 20, -51, 6.5, skinC);    // 찌르기
        this.limb(20, -51, 31, -50, 6, skinC);
        c.beginPath(); c.arc(34, -50, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (hurt || down) {
      this.limb(-9, shY, -17, -42, 6, skinC);
      this.limb(9, shY, 17, -42, 6, skinC);
    } else {
      // 파이팅 가드: 두 주먹을 몸 앞에
      const g2 = Math.sin(t * 4 + (isB ? 1 : 0)) * 0.8;
      this.limb(-9, shY, -13, -42 + g2, 6, skinC);
      this.limb(-13, -42 + g2, -6, -39 + g2, 5.5, skinC);
      this.limb(9, shY, 14, -43 - g2, 6, skinC);
      this.limb(14, -43 - g2, 10, -39 - g2, 5.5, skinC);
      c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(-5, -39 + g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(11, -39 - g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 무기 ──
    this.drawWeapon(f, atk, t);

    // ── 머리 (장신 비례 — 어깨 위로 들어올림) ──
    c.save();
    c.translate(0, -14);
    this.drawHead(f, t);
    c.restore();

    // 적 체력바
    if (!isP && !isB && f.hp < f.maxHp && !down) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-12, -86, 24, 3);
      c.fillStyle = '#ff5a5a'; c.fillRect(-12, -86, 24 * Math.max(0, f.hp / f.maxHp), 3);
    }
    c.restore();
  },

  // 무기: 손 좌표는 팔 리그와 동일 좌표계
  drawWeapon(f, atk, t) {
    const c = this.ctx;
    const isP = f.kind === 'p', isB = f.kind === 'b';
    if (f.state === 'down' || f.state === 'dead') return;
    const upper = atk && f.combo === 3;
    const hx = atk ? (upper ? 23 : 34) : 11;
    const hy = atk ? (upper ? -73 : -50) : -41;
    c.save();
    c.translate(hx, hy);
    const swing = atk ? Math.min(1, f.stT / 0.14) : 0;
    if (isP) {
      c.rotate(atk ? (upper ? -1.9 + swing * 1.2 : -1.5 + swing * 1.6) : -0.5);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -30); c.stroke();
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.4;
      c.fillStyle = '#d8dce4';
      c.beginPath();
      c.moveTo(0, -30);
      c.quadraticCurveTo(10, -38, 3, -50);
      c.quadraticCurveTo(6, -40, 0, -38);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#d8b83a';
      c.beginPath(); c.arc(0, -30, 2.4, 0, Math.PI * 2); c.fill();
    } else if (isB) {
      c.rotate(atk ? -1.62 : -0.72);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -32); c.stroke();
      c.fillStyle = '#d8dce4';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-3, -32); c.lineTo(0, -42); c.lineTo(3, -32); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a02828';
      c.beginPath(); c.arc(0, -31, 2, 0, Math.PI * 2); c.fill();
    } else if (!(atk && f.jy > 0)) {
      const kind = f.base || f.type || 'spear';
      c.rotate(atk ? -1.5 : -0.6);
      if (kind === 'axe') {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -26); c.stroke();
        c.fillStyle = '#b8bcc8';
        c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(11, -24, 9, -14); c.lineTo(0, -18); c.closePath(); c.fill(); c.stroke();
      } else if (kind === 'archer') {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.2; c.lineCap = 'round';
        c.beginPath(); c.arc(0, -12, 15, -1.25, 1.25); c.stroke();
        c.strokeStyle = 'rgba(230,230,240,.7)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(Math.cos(-1.25) * 15, -12 + Math.sin(-1.25) * 15); c.lineTo(Math.cos(1.25) * 15, -12 + Math.sin(1.25) * 15); c.stroke();
      } else if (kind === 'shield' || f.type === 'tank') {
        c.fillStyle = '#5a6a7a';
        c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
        c.beginPath(); c.roundRect(2, -22, 10, 28, 4); c.fill(); c.stroke();
        c.fillStyle = '#d8b83a';
        c.beginPath(); c.arc(7, -8, 2.2, 0, Math.PI * 2); c.fill();
      } else {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -28); c.stroke();
        c.fillStyle = '#d8dce4';
        c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-2.5, -28); c.lineTo(0, -36); c.lineTo(2.5, -28); c.closePath(); c.fill(); c.stroke();
      }
    }
    c.restore();
  },

  drawHead(f, t) {
    const c = this.ctx;
    if (f.kind === 'p') {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height, hh = 25;
        c.save();
        c.scale(-1, 1);                   // 원본 사진이 왼쪽을 봄 → 로컬(오른쪽 향) 반전
        c.drawImage(this.mogu, -hh * a / 2, -64, hh * a, hh);
        c.restore();
      }
      // 투구: 금띠 + 홍술
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.4;
      c.fillStyle = '#d8b83a';
      c.beginPath(); c.roundRect(-10, -66, 20, 5, 2.5); c.fill(); c.stroke();
      c.fillStyle = '#a02828';
      const sway = Math.sin(t * 5) * 1.5;
      c.beginPath();
      c.moveTo(0, -66);
      c.quadraticCurveTo(2 + sway, -76, 6 + sway, -80);
      c.quadraticCurveTo(1 + sway, -74, -2, -66);
      c.fill();
      c.beginPath(); c.arc(0, -66.5, 2.6, 0, Math.PI * 2); c.fill();
      return;
    }
    if (f.kind === 'b') {
      // 꼬꼬
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(1, -50, 10.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#d83a3a';
      c.beginPath(); c.arc(-3, -60, 3, 0, Math.PI * 2); c.arc(1, -62, 3.2, 0, Math.PI * 2); c.arc(5, -60, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(9, -44); c.lineTo(12, -39); c.lineTo(7, -41); c.fill();   // 턱볏
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(10, -51); c.lineTo(19, -49); c.lineTo(10, -46); c.fill(); c.stroke();
      c.fillStyle = '#22262e'; c.fillRect(4, -54, 3, 3);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
      c.beginPath(); c.arc(1, -50, 10.5, 0.6, 1.8); c.stroke();
      return;
    }
    // 악당 머리
    const E = M.ETYPES[f.type] || f;
    const bodyC = f.body || (E && E.body) || '#9aa2ad';
    const earC = f.ear || (E && E.ear) || '#c8ccd4';
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
    if (f.type === 'tank' || f.base === 'tank') {
      // 로봇 머리
      c.fillStyle = bodyC;
      c.beginPath(); c.roundRect(-10, -60, 21, 15, 4); c.fill(); c.stroke();
      c.fillStyle = '#ff5252';
      c.fillRect(3, -56, 5, 3.5);
      c.fillStyle = 'rgba(255,255,255,.25)';
      c.fillRect(-8, -59, 17, 3);
      c.strokeStyle = earC; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-4, -60); c.lineTo(-6, -66); c.stroke();
      c.fillStyle = earC;
      c.beginPath(); c.arc(-6, -67, 2, 0, Math.PI * 2); c.fill();
    } else {
      // 쥐 머리: 주둥이 + 수염 + 귀
      c.fillStyle = bodyC;
      c.beginPath(); c.ellipse(0, -50, 10.5, 9.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(7, -52); c.quadraticCurveTo(16, -50, 15, -46);
      c.quadraticCurveTo(10, -43, 5, -45); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = earC;
      c.beginPath(); c.arc(-6, -59, 4.8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(2, -61, 4.8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = this.shade(earC, 0.7);
      c.beginPath(); c.arc(-6, -59, 2.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2, -61, 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1620';
      c.beginPath(); c.arc(14, -48.5, 1.6, 0, Math.PI * 2); c.fill();   // 코
      c.fillRect(3, -53, 2.6, 2.6);                                     // 눈
      c.strokeStyle = 'rgba(230,230,240,.6)'; c.lineWidth = 0.9;
      for (const wy of [-49, -47]) {
        c.beginPath(); c.moveTo(11, wy); c.lineTo(19, wy - 1.5); c.stroke();
      }
    }
    if (f.boss) {
      c.fillStyle = '#ffd83d';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-8, -63); c.lineTo(-5, -72); c.lineTo(-1, -64); c.lineTo(3, -73); c.lineTo(7, -63);
      c.closePath(); c.fill(); c.stroke();
    }
  },
};
