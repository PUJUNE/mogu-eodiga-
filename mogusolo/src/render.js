// render.js — 벨트스크롤 렌더: 그림자 군주 무드 + 미션별 배경 + QWER HUD (모구삼국지 계보)
const M = window.MSL;
const W = 480, H = 270;
const ZS = 0.62;

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [], camX: 0,

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
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  addSpark(x, y, kd) { this.fx.push({ kind: kd ? 'kd' : 'spark', x, y, t: 0 }); },
  addRuler(x, y) { this.fx.push({ kind: 'ruler', x, y, t: 0 }); },
  addSlash(x, y, face) { this.fx.push({ kind: 'slash', x, y, face, t: 0 }); },
  addExtract(x, y) { this.fx.push({ kind: 'extract', x, y, t: 0 }); },
  addBolt(x, y) { this.fx.push({ kind: 'bolt', x, y, t: 0 }); },

  sy(z, jy) { return M.FLOOR_Y + z * ZS - (jy || 0); },

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  },

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
    const target = Math.max(0, Math.min(st.stage.length - W, st.p.x - 210));
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    const cam = this.camX;

    this.drawBackground(st, t, cam);

    if (st.go && Math.floor(t * 2.5) % 2 === 0) {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'right';
      c.fillStyle = th.accent;
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4;
      c.strokeText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
      c.fillText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
    }

    // 벼락 경고 마커 (바닥 원)
    for (const bo of st.bolts) {
      if (bo.t <= 0) continue;
      const x = bo.x - cam, y = this.sy(bo.z, 0);
      const blink = 0.35 + 0.4 * Math.abs(Math.sin(t * 16));
      c.strokeStyle = `rgba(255,90,90,${blink})`; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(x, y, 20, 7, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = `rgba(255,220,120,${blink})`; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(x, y, 20 * (bo.t / 0.6), 7 * (bo.t / 0.6), 0, 0, Math.PI * 2); c.stroke();
    }

    // 물약 (HP 빨강 / MP 파랑)
    for (const it of st.items) {
      const x = it.x - cam, y = this.sy(it.z, 0);
      const bob = Math.sin(t * 5 + it.x) * 2;
      c.strokeStyle = 'rgba(20,16,28,.85)'; c.lineWidth = 1.6;
      c.fillStyle = it.kind === 'hp' ? '#e04848' : '#3a86e0';
      c.beginPath();
      c.moveTo(x - 4, y - 3 + bob);
      c.quadraticCurveTo(x - 6, y - 10 + bob, x - 2, y - 11 + bob);
      c.lineTo(x - 2, y - 14 + bob); c.lineTo(x + 2, y - 14 + bob); c.lineTo(x + 2, y - 11 + bob);
      c.quadraticCurveTo(x + 6, y - 10 + bob, x + 4, y - 3 + bob);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(x - 2.5, y - 9 + bob, 2, 4);
      c.fillStyle = '#c8a050';
      c.fillRect(x - 2.5, y - 16 + bob, 5, 2.5);
    }

    // 투사체 (독침·고드름·화염구)
    for (const sh of st.shots) {
      const x = sh.x - cam, y = this.sy(sh.z, 14);
      c.fillStyle = sh.color;
      c.strokeStyle = 'rgba(20,16,28,.7)'; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.arc(x - Math.sign(sh.vx) * 2, y - 1, 1.2, 0, Math.PI * 2); c.fill();
    }

    // 엔티티 (깊이 정렬) — 적 시체는 CORPSE_T 동안 유지 (그림자 추출 대상)
    const ents = [st.p, ...(st.b ? [st.b] : []), ...st.shadows, ...st.enemies]
      .filter((f) => f.state !== 'dead' || (f.kind === 'e' ? f.stT < M.Logic.CORPSE_T : f.stT < 1.6));
    ents.sort((a, b2) => a.z - b2.z);
    for (const f of ents) this.drawFighter(st, f, t);

    // FX
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'ruler' ? 0.5 : f.kind === 'bolt' ? 0.35 : f.kind === 'extract' ? 0.6 : 0.3));
    for (const f of this.fx) {
      f.t += dt;
      const x = f.x - cam;
      if (f.kind === 'ruler') {
        const p2 = f.t / 0.5;
        c.globalAlpha = 1 - p2;
        c.strokeStyle = '#b07dff'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(x, f.y, 22 + p2 * 78, 9 + p2 * 26, 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#e8d8ff'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a2 = p2 * 5 + i * 2.1;
          c.beginPath(); c.arc(x, f.y - 14, 28 + p2 * 44, a2, a2 + 1.2); c.stroke();
        }
        c.globalAlpha = 1;
        continue;
      }
      if (f.kind === 'slash') {
        const p2 = f.t / 0.3;
        c.globalAlpha = 1 - p2;
        c.strokeStyle = '#7dc8ff'; c.lineWidth = 3.5; c.lineCap = 'round';
        c.beginPath(); c.arc(x + f.face * 20, f.y - 16, 22 + p2 * 10, f.face > 0 ? -1.1 : Math.PI - 0.5, f.face > 0 ? 0.5 : Math.PI + 1.1); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6;
        c.beginPath(); c.arc(x + f.face * 20, f.y - 16, 17 + p2 * 10, f.face > 0 ? -1.0 : Math.PI - 0.4, f.face > 0 ? 0.4 : Math.PI + 1.0); c.stroke();
        c.globalAlpha = 1;
        continue;
      }
      if (f.kind === 'extract') {
        const p2 = Math.min(1, f.t / 0.6);
        c.globalAlpha = 1 - p2;
        c.fillStyle = '#6a4a9a';
        for (let i = 0; i < 5; i++) {
          const wx = x + Math.sin(i * 2.2 + p2 * 6) * (7 + i * 2);
          c.beginPath(); c.ellipse(wx, f.y - p2 * 44 - i * 5, 3.2, 6.5, 0, 0, Math.PI * 2); c.fill();
        }
        c.strokeStyle = '#b07dff'; c.lineWidth = 1.6;
        c.beginPath(); c.ellipse(x, f.y, 15 * (1 - p2), 5 * (1 - p2), 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
        continue;
      }
      if (f.kind === 'bolt') {
        const p2 = Math.min(1, f.t / 0.35);
        c.globalAlpha = 1 - p2;
        c.strokeStyle = '#e8e0ff'; c.lineWidth = 4.5; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x + 6, f.y - 150);
        c.lineTo(x - 5, f.y - 90); c.lineTo(x + 4, f.y - 84);
        c.lineTo(x - 6, f.y - 30); c.lineTo(x + 2, f.y - 26);
        c.lineTo(x, f.y);
        c.stroke();
        c.strokeStyle = '#b07dff'; c.lineWidth = 9;
        c.globalAlpha = (1 - p2) * 0.4;
        c.stroke();
        c.globalAlpha = 1 - p2;
        c.fillStyle = '#fff';
        c.beginPath(); c.ellipse(x, f.y, 16 * (1 - p2), 6 * (1 - p2), 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        continue;
      }
      const p = f.t / 0.3;
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
  },

  // ── 미션별 배경 ──
  drawBackground(st, t, cam) {
    const c = this.ctx, th = st.stage.theme, m = st.mission;
    const g = c.createLinearGradient(0, 0, 0, M.FLOOR_Y);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, M.FLOOR_Y);

    const wallTop = 62, wallH = M.FLOOR_Y - wallTop;
    if (m === 1) {
      // 페널티 존: 모래 언덕 + 백골 + 이글거리는 해
      c.fillStyle = 'rgba(255,240,200,.9)';
      c.beginPath(); c.arc(W - 70, 34, 17 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.14)';
      c.beginPath();
      c.moveTo(0, wallTop + 40);
      for (let x = 0; x <= W; x += 24) c.lineTo(x, wallTop + 28 + Math.sin((x + cam * 0.25) * 0.02) * 14);
      c.lineTo(W, M.FLOOR_Y); c.lineTo(0, M.FLOOR_Y); c.fill();
      c.fillStyle = th.wall;
      c.beginPath();
      c.moveTo(0, M.FLOOR_Y);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, wallTop + 62 + Math.sin((x + cam * 0.6) * 0.03 + 2) * 18);
      c.lineTo(W, M.FLOOR_Y); c.fill();
      for (let i = -1; i < 5; i++) {
        const x = i * 160 - ((cam * 0.6) % 160) + 60;
        c.strokeStyle = '#e8e0d0'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(x, M.FLOOR_Y - 16, 12, Math.PI, Math.PI * 1.9); c.stroke();
        c.beginPath(); c.moveTo(x - 12, M.FLOOR_Y - 16); c.lineTo(x - 12, M.FLOOR_Y - 4); c.stroke();
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - 12, M.FLOOR_Y - 12); c.lineTo(x - 20, M.FLOOR_Y - 14); c.stroke();
      }
    } else if (m === 2) {
      // 독사의 굴: 동굴 벽 + 독 웅덩이 + 종유석
      c.fillStyle = th.wall; c.fillRect(0, wallTop, W, wallH);
      c.fillStyle = this.shade(th.wall, 0.7);
      for (let i = -1; i < 12; i++) {
        const x = i * 48 - ((cam * 0.6) % 48);
        const len = 20 + ((i * 37) % 26);
        c.beginPath(); c.moveTo(x, wallTop - 2); c.lineTo(x + 9, wallTop - 2); c.lineTo(x + 4.5, wallTop + len); c.closePath(); c.fill();
      }
      for (let i = -1; i < 6; i++) {
        const x = i * 130 - ((cam * 0.6) % 130) + 40;
        const puls = 0.5 + 0.3 * Math.sin(t * 3 + i * 2);
        c.fillStyle = `rgba(125,224,74,${puls * 0.5})`;
        c.beginPath(); c.ellipse(x, M.FLOOR_Y - 8, 26, 7, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(184,224,74,${puls * 0.7})`;
        for (let b2 = 0; b2 < 3; b2++) {
          const bx = x - 12 + b2 * 11, bt = (t * 1.4 + b2 * 0.8 + i) % 1;
          c.beginPath(); c.arc(bx, M.FLOOR_Y - 8 - bt * 16, 2.4 * (1 - bt), 0, Math.PI * 2); c.fill();
        }
      }
    } else if (m === 3) {
      // 붉은 문: 설원 + 침엽수 + 지평선의 붉은 게이트
      const gx = W - 90 - cam * 0.12;
      const glow = 0.5 + 0.25 * Math.sin(t * 2.4);
      c.fillStyle = `rgba(255,60,60,${glow * 0.35})`;
      c.beginPath(); c.ellipse(gx, wallTop + 24, 46, 58, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,90,90,${glow})`; c.lineWidth = 5;
      c.beginPath(); c.arc(gx, wallTop + 40, 26, Math.PI, 0); c.lineTo(gx + 26, wallTop + 72); c.lineTo(gx - 26, wallTop + 72); c.closePath(); c.stroke();
      c.fillStyle = 'rgba(255,120,120,.35)';
      c.fill();
      // 눈 언덕
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.beginPath();
      c.moveTo(0, M.FLOOR_Y);
      for (let x = 0; x <= W; x += 22) c.lineTo(x, wallTop + 58 + Math.sin((x + cam * 0.45) * 0.025) * 12);
      c.lineTo(W, M.FLOOR_Y); c.fill();
      // 침엽수
      for (let i = -1; i < 7; i++) {
        const x = i * 110 - ((cam * 0.6) % 110) + 30;
        c.fillStyle = '#3a5a4a';
        for (let k = 0; k < 3; k++) {
          const wY = wallTop + 36 + k * 22, ww = 16 - k * 3.5;
          c.beginPath(); c.moveTo(x, wY - 18); c.lineTo(x + ww, wY + 12); c.lineTo(x - ww, wY + 12); c.closePath(); c.fill();
        }
        c.fillStyle = 'rgba(255,255,255,.75)';
        c.beginPath(); c.moveTo(x, wallTop + 18); c.lineTo(x + 9, wallTop + 34); c.lineTo(x - 9, wallTop + 34); c.closePath(); c.fill();
      }
      // 내리는 눈
      c.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 97 + t * 26 * ((i % 3) + 1)) % (W + 20)) - 10;
        const sYY = (i * 61 + t * 44 * ((i % 2) + 1)) % M.FLOOR_Y;
        c.fillRect(sx, sYY, 2, 2);
      }
    } else if (m === 4) {
      // 악마성 하층: 검붉은 석벽 + 사슬 + 횃불
      c.fillStyle = th.wall; c.fillRect(0, wallTop, W, wallH);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.5;
      for (let ry = 8; ry < wallH; ry += 17) {
        c.beginPath(); c.moveTo(0, wallTop + ry); c.lineTo(W, wallTop + ry); c.stroke();
        const off = (ry / 17) % 2 ? 21 : 0;
        for (let bx = -42; bx < W + 42; bx += 42) {
          const x = bx + off - ((cam * 0.6) % 42);
          c.beginPath(); c.moveTo(x, wallTop + ry); c.lineTo(x, wallTop + ry + 17); c.stroke();
        }
      }
      for (let i = -1; i < 5; i++) {
        const x = i * 140 - ((cam * 0.6) % 140) + 46;
        // 사슬
        c.strokeStyle = '#4a4050'; c.lineWidth = 2.4;
        for (let k = 0; k < 5; k++) {
          c.beginPath(); c.ellipse(x + 44, wallTop + 10 + k * 9 + Math.sin(t * 1.8 + i) * 2, 2.6, 4.6, 0, 0, Math.PI * 2); c.stroke();
        }
        // 횃불
        c.fillStyle = '#5a4030';
        c.fillRect(x - 2, wallTop + 38, 5, 16);
        const fl = Math.sin(t * 9 + i * 2.4) * 2.4;
        c.fillStyle = '#ff9a3d';
        c.beginPath(); c.ellipse(x + fl * 0.4, wallTop + 30, 5, 9 + fl, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd83d';
        c.beginPath(); c.ellipse(x + fl * 0.4, wallTop + 33, 2.6, 4.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,150,60,.12)';
        c.beginPath(); c.arc(x, wallTop + 34, 26, 0, Math.PI * 2); c.fill();
      }
    } else {
      // 악마성 최상층: 보라 하늘 번개 + 첨탑 기둥 + 균열 마법진
      if (Math.sin(t * 0.7) > 0.94 || Math.sin(t * 1.13 + 4) > 0.965) {
        c.fillStyle = 'rgba(200,180,255,.28)';
        c.fillRect(0, 0, W, M.FLOOR_Y);
        c.strokeStyle = '#e8e0ff'; c.lineWidth = 2.5; c.lineCap = 'round';
        const lx = ((t * 731) % W);
        c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx - 12, 26); c.lineTo(lx + 4, 32); c.lineTo(lx - 10, 58); c.stroke();
      }
      c.fillStyle = 'rgba(255,255,240,.5)';
      for (let i = 0; i < 18; i++) c.fillRect((i * 151 + 23) % W, (i * 67 + 9) % 52, 1.5, 1.5);
      for (let i = -1; i < 5; i++) {
        const x = i * 130 - ((cam * 0.6) % 130) + 24;
        c.fillStyle = '#241436';
        c.fillRect(x, wallTop - 6, 24, wallH + 6);
        c.fillStyle = 'rgba(176,125,255,.5)';
        c.fillRect(x + 3, wallTop - 6, 4, wallH + 6);
        c.fillStyle = '#38205c';
        c.beginPath(); c.moveTo(x - 4, wallTop - 6); c.lineTo(x + 12, wallTop - 26); c.lineTo(x + 28, wallTop - 6); c.closePath(); c.fill();
        const gl = 0.4 + 0.3 * Math.sin(t * 3 + i * 1.7);
        c.fillStyle = `rgba(176,125,255,${gl})`;
        c.beginPath(); c.arc(x + 12, wallTop + 30, 3.4, 0, Math.PI * 2); c.fill();
      }
    }

    // ── 바닥 ──
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, th.floor);
    fg.addColorStop(1, this.shade(th.floor, 0.72));
    c.fillStyle = fg;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    c.fillStyle = this.shade(th.floor, 1.25);
    c.fillRect(0, M.FLOOR_Y, W, 3);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(0, M.FLOOR_Y + 3, W, 1.5);
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (const zz of [20, 40, 60]) {
      const y = M.FLOOR_Y + zz * ZS;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
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
        c.strokeStyle = m === 5 ? 'rgba(176,125,255,.3)' : 'rgba(0,0,0,.25)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x + 14, y, 11, 4.5, 0, 0, Math.PI * 2); c.stroke();
      }
    }
  },

  // ── HUD ──
  drawHud(st, t) {
    const c = this.ctx;
    const L = M.Logic;
    this.portraitBar(10, 8, 120, st.p.hp / st.p.maxHp, '#58c85c', 'mogu');
    // MP 바
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(33, 21, 97, 6);
    c.fillStyle = '#4a9ae8';
    c.fillRect(34, 22, 95 * Math.min(1, st.mp / L.maxMp(st.lv)), 4);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1;
    c.strokeRect(33, 21, 97, 6);
    if (st.b) this.portraitBar(10, 32, 92, Math.max(0, st.b.hp) / st.b.maxHp, '#ffd83d', 'chick');
    // 레벨 + 경험치
    const lvY = st.b ? 61 : 43;
    c.font = 'bold 9px sans-serif'; c.textAlign = 'left';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.strokeText(`Lv.${st.lv}`, 10, lvY);
    c.fillStyle = '#ffd83d';
    c.fillText(`Lv.${st.lv}`, 10, lvY);
    if (st.lv < L.LV_MAX) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(38, lvY - 6, 52, 5);
      c.fillStyle = '#b07dff';
      c.fillRect(39, lvY - 5, 50 * Math.min(1, st.expInto / L.expNeed(st.lv)), 3);
    } else {
      c.fillStyle = '#b07dff';
      c.fillText('MAX', 38, lvY);
    }
    // 영구 장비 아이콘
    let gx = 96;
    if (st.gear.fang) {
      c.font = 'bold 8px sans-serif';
      c.fillStyle = '#9fe06a'; c.fillText('🗡독니', gx, lvY); gx += 30;
    }
    if (st.gear.armor) { c.fillStyle = '#8ab8e8'; c.fillText('🛡갑주', gx, lvY); }

    // QWER 스킬 슬롯 (좌하)
    const sx0 = 10, syy = H - 30;
    const keys = ['q', 'w', 'e', 'r'];
    for (let i = 0; i < 4; i++) {
      const k = keys[i], S = L.SKILLS[k];
      const x = sx0 + i * 24;
      const locked = st.lv < S.lv;
      const noMp = st.mp < S.mp;
      const cd = Math.max(0, st.skillCd[k]);
      c.fillStyle = locked ? 'rgba(20,20,28,.75)' : 'rgba(10,14,30,.68)';
      c.beginPath(); c.roundRect(x, syy, 20, 20, 4); c.fill();
      c.strokeStyle = locked ? 'rgba(120,120,140,.5)' : noMp ? 'rgba(90,130,220,.45)' : k === 'e' && st.shadows.length >= L.SHADOW_MAX ? 'rgba(176,125,255,.9)' : 'rgba(255,255,255,.75)';
      c.lineWidth = 1.3;
      c.beginPath(); c.roundRect(x, syy, 20, 20, 4); c.stroke();
      c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
      c.fillStyle = locked ? 'rgba(200,200,210,.4)' : noMp ? 'rgba(160,190,240,.6)' : '#fff';
      c.fillText(k.toUpperCase(), x + 10, syy + 14);
      if (locked) {
        c.font = 'bold 7px sans-serif';
        c.fillStyle = 'rgba(255,216,61,.85)';
        c.fillText(`Lv${S.lv}`, x + 10, syy + 26);
      } else if (cd > 0) {
        c.fillStyle = 'rgba(0,0,0,.62)';
        const hgt = 20 * Math.min(1, cd / S.cd);
        c.beginPath(); c.roundRect(x, syy + 20 - hgt, 20, hgt, 3); c.fill();
      }
    }
    // 그림자 병사 표시 (E 슬롯 위 점)
    for (let i = 0; i < st.shadows.length; i++) {
      c.fillStyle = '#b07dff';
      c.beginPath(); c.arc(sx0 + 2 * 24 + 4 + i * 6, syy - 5, 2.4, 0, Math.PI * 2); c.fill();
    }
    // 은신 남은 시간
    if (st.stealth > 0) {
      c.font = 'bold 9px sans-serif'; c.textAlign = 'left';
      c.fillStyle = 'rgba(180,220,255,.9)';
      c.fillText(`은신 ${st.stealth.toFixed(1)}s`, sx0 + 100, syy + 14);
    }

    // 보스 바
    const boss = st.enemies.find((e) => e.boss && M.Logic.alive(e));
    if (boss) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(W - 166, 10, 156, 12);
      c.fillStyle = boss.hp < boss.maxHp * 0.5 && boss.base === 'baran' ? '#b07dff' : '#ff5a5a';
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
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.beginPath(); c.roundRect(x, y, 19, 19, 3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
    c.strokeRect(x, y, 19, 19);
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
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x + 23, y + 5, w2, 9);
    c.fillStyle = color;
    c.fillRect(x + 24, y + 6, Math.max(0, (w2 - 2) * Math.min(1, ratio)), 7);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, w2, 9);
  },

  // ── 캐릭터 ──
  drawFighter(st, f, t) {
    const c = this.ctx;
    const x = f.x - this.camX;
    if (x < -70 || x > W + 70) return;
    const y = this.sy(f.z, f.jy);
    const down = f.state === 'down' || f.state === 'dead';
    const hurt = f.state === 'hurt';
    const atk = f.state === 'atk';
    const walk = f.state === 'walk';
    const dead = f.state === 'dead';
    const airkick = atk && f.jy > 0;
    const isP = f.kind === 'p', isB = f.kind === 'b', isS = f.kind === 's';

    // 그림자
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, this.sy(f.z, 0) + 3, 15, 4.5, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(x, y);
    if (f.face < 0) c.scale(-1, 1);
    if (dead) {
      if (f.kind === 'e') {
        // 적 시체: 빠르게 흐려진 뒤 반투명 유지, 소멸 직전 2초 페이드아웃
        const hold = 0.55;
        const endFade = Math.max(0, Math.min(1, (M.Logic.CORPSE_T - f.stT) / 2));
        c.globalAlpha = (f.stT < 0.6 ? hold + (1 - f.stT / 0.6) * (1 - hold) : hold) * endFade;
      } else {
        c.globalAlpha = Math.max(0, 1 - (f.stT - 0.8) / 0.8);
      }
    }
    if (isP && st.stealth > 0) c.globalAlpha = 0.35;
    if (down) { c.rotate(-Math.PI / 2); c.translate(4, 12); }
    if (hurt) { c.translate(Math.sin(t * 40) * 1.5, 0); c.rotate(-0.12); }

    const E = M.ETYPES[f.type];
    const tanky = (E && E.tanky) || (E && E.hp >= 60);
    const big = f.boss ? 1.35 : (!isP && !isB && !isS && tanky) ? 1.12 : 1;
    c.scale(big, big);

    // 팔레트 — 모구: 검은 롱코트 / 그림자: 검보라 단색
    const baseBody = f.body || (E && E.body) || '#9aa2ad';
    const shirtC = isP ? '#26222e' : isB ? '#3a7ec8' : isS ? '#2a2038' : this.shade(baseBody, 0.9);
    const skinC = isP ? '#3a3444' : isB ? '#f0e8d8' : isS ? '#3a2c4c' : this.shade(baseBody, 1.18);
    const pantC = isP ? '#1c1826' : isB ? '#4a3a2a' : isS ? '#241a30' : '#3a3644';
    const shoeC = isP ? '#3a3444' : '#2a2430';

    const step = walk ? Math.sin(t * 11) : 0;

    // ── 다리 ──
    if (airkick) {
      this.limb(0, -22, 16, -20, 7, pantC);
      this.limb(16, -20, 26, -18, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(29, -18, 5, 3.5, 0.2, 0, Math.PI * 2); c.fill();
      this.limb(-2, -22, -7, -12, 7, pantC);
      this.limb(-7, -12, -2, -8, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(-1, -7, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else if (f.jy > 0) {
      this.limb(1, -22, 4, -12, 7, pantC);
      this.limb(4, -12, 7, -8, 6, pantC);
      this.limb(-3, -22, -7, -13, 7, pantC);
      this.limb(-7, -13, -10, -9, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(8, -7, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(-11, -8, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else {
      const k1 = step * 5, k2 = -step * 5;
      this.limb(2, -22, 4 + k1, -11, 7, pantC);
      this.limb(4 + k1, -11, 5 + k1 * 1.2, -1, 6, pantC);
      this.limb(-3, -22, -4 + k2, -11, 7, pantC);
      this.limb(-4 + k2, -11, -5 + k2 * 1.2, -1, 6, pantC);
      c.fillStyle = shoeC;
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(7 + k1 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-3 + k2 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 몸통 ──
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2.4; c.lineJoin = 'round';
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(-11, -42); c.quadraticCurveTo(0, -45, 11, -42);
    c.lineTo(7, -21); c.quadraticCurveTo(0, -19, -7, -21);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = this.shade(shirtC === '#26222e' ? '#4a4458' : shirtC, 0.75);
    c.beginPath();
    c.moveTo(6, -41); c.lineTo(11, -42); c.lineTo(7, -21); c.lineTo(4, -21);
    c.closePath(); c.fill();
    if (isP) {
      // 롱코트 자락 (다리 뒤로 펄럭)
      const flap = walk ? Math.sin(t * 11) * 3 : Math.sin(t * 2.4) * 1.4;
      c.fillStyle = '#201c2a';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(-8, -24);
      c.quadraticCurveTo(-14 - flap, -14, -12 - flap, -3);
      c.lineTo(-6, -8); c.lineTo(-6, -21);
      c.closePath(); c.fill(); c.stroke();
      // 코트 앞선 + 보라 안감 포인트
      c.strokeStyle = 'rgba(176,125,255,.65)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, -41); c.lineTo(0, -22); c.stroke();
    } else {
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -30); c.stroke();
      c.beginPath(); c.moveTo(-6, -29); c.quadraticCurveTo(0, -26.5, 6, -29); c.stroke();
    }
    // 벨트
    c.fillStyle = '#1a1620';
    c.fillRect(-7, -22, 14, 3.5);
    c.fillStyle = isP ? '#b07dff' : '#d8b83a';
    c.fillRect(-2, -22, 4, 3.5);
    if (isB) {
      // 꼬꼬 견갑
      c.fillStyle = '#8a9aa8';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(-11, -39, 5.5, 4, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(11, -39, 5.5, 4, 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 팔 ──
    const shY = -38;
    const armC = isP ? '#26222e' : skinC;      // 모구는 코트 소매
    if (atk && f.jy === 0) {
      const upper = f.combo === 3;
      if (upper) {
        this.limb(-8, shY, -14, -32, 6, armC);
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -31, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 17, -46, 6.5, armC);
        this.limb(17, -46, 21, -56, 6, armC);
        c.beginPath(); c.arc(22, -59, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        this.limb(-8, shY, -14, -31, 6, armC);
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -30, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 18, -37, 6.5, armC);
        this.limb(18, -37, 28, -36, 6, armC);
        c.beginPath(); c.arc(31, -36, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (hurt || down) {
      this.limb(-8, shY, -15, -30, 6, armC);
      this.limb(8, shY, 15, -30, 6, armC);
    } else {
      const g2 = Math.sin(t * 4 + (isB ? 1 : 0)) * 0.8;
      this.limb(-8, shY, -12, -30 + g2, 6, armC);
      this.limb(-12, -30 + g2, -5, -27 + g2, 5.5, armC);
      this.limb(8, shY, 13, -31 - g2, 6, armC);
      this.limb(13, -31 - g2, 9, -27 - g2, 5.5, armC);
      c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(-4, -27 + g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(10, -27 - g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    this.drawWeapon(f, atk, t);
    this.drawHead(st, f, t);

    // 적 체력바
    if (!isP && !isB && !isS && f.hp < f.maxHp && !down) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-12, -70, 24, 3);
      c.fillStyle = '#ff5a5a'; c.fillRect(-12, -70, 24 * Math.max(0, f.hp / f.maxHp), 3);
    }
    // 그림자 병사 체력바 (보라)
    if (isS && f.hp < f.maxHp && !down) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-12, -70, 24, 3);
      c.fillStyle = '#b07dff'; c.fillRect(-12, -70, 24 * Math.max(0, f.hp / f.maxHp), 3);
    }
    c.restore();
  },

  // ── 무기 ──
  drawWeapon(f, atk, t) {
    const c = this.ctx;
    const isP = f.kind === 'p', isB = f.kind === 'b', isS = f.kind === 's';
    if (f.state === 'down' || f.state === 'dead') return;
    const upper = atk && f.combo === 3;
    const hx = atk ? (upper ? 22 : 31) : 10;
    const hy = atk ? (upper ? -59 : -36) : -27;
    c.save();
    c.translate(hx, hy);
    if (isP) {
      // 쌍단검 (앞손 + 뒷손)
      c.rotate(atk ? (upper ? -1.9 : -1.35) : -0.4);
      c.strokeStyle = '#1a1620'; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -6); c.stroke();
      c.fillStyle = '#c8d0e0';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-2.4, -6); c.quadraticCurveTo(0, -22, 2, -6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#b07dff';
      c.beginPath(); c.arc(0, -5.5, 1.8, 0, Math.PI * 2); c.fill();
      c.restore();
      // 뒷손 단검 (가드 자세일 때만)
      if (!atk) {
        c.save();
        c.translate(-4, -27);
        c.rotate(0.5);
        c.strokeStyle = '#1a1620'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(0, 5); c.lineTo(0, -4); c.stroke();
        c.fillStyle = '#c8d0e0';
        c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-2, -4); c.quadraticCurveTo(0, -16, 1.8, -4); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      return;
    }
    if (isB) {
      c.rotate(atk ? -1.62 : -0.72);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -24); c.stroke();
      c.fillStyle = '#d8dce4';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-3, -24); c.lineTo(0, -34); c.lineTo(3, -24); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a02828';
      c.beginPath(); c.arc(0, -23, 2, 0, Math.PI * 2); c.fill();
      c.restore();
      return;
    }
    if (isS) {
      // 그림자 병사: 검보라 검
      c.rotate(atk ? -1.5 : -0.6);
      c.strokeStyle = '#241a30'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -16); c.stroke();
      c.fillStyle = '#6a4a9a';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-2.5, -16); c.lineTo(0, -26); c.lineTo(2.5, -16); c.closePath(); c.fill(); c.stroke();
      c.restore();
      return;
    }
    if (atk && f.jy > 0) { c.restore(); return; }
    const E = M.ETYPES[f.type];
    const ranged = (E && E.ranged) || (f.boss && f.base === 'ranged');
    const heavy = (E && (E.tanky || E.hp >= 60)) || false;
    c.rotate(atk ? -1.5 : -0.6);
    if (ranged) {
      // 원거리: 지팡이 + 발광 구슬
      c.strokeStyle = '#4a3a5a'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -18); c.stroke();
      c.fillStyle = f.shot || '#b8e04a';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, -21, 4, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.arc(-1.4, -22.4, 1.4, 0, Math.PI * 2); c.fill();
    } else if (heavy) {
      c.fillStyle = '#5a6a7a';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.roundRect(2, -16, 9, 22, 4); c.fill(); c.stroke();
      c.fillStyle = '#d8b83a';
      c.beginPath(); c.arc(6.5, -5, 2.2, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -20); c.stroke();
      c.fillStyle = '#d8dce4';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-2.5, -20); c.lineTo(0, -28); c.lineTo(2.5, -20); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  },

  // ── 머리 ──
  drawHead(st, f, t) {
    const c = this.ctx;
    if (f.kind === 'p') {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height, hh = 25;
        c.save();
        c.scale(-1, 1);                   // 원본 사진이 왼쪽을 봄 → 로컬(오른쪽 향) 반전
        c.drawImage(this.mogu, -hh * a / 2, -64, hh * a, hh);
        c.restore();
      }
      // 그림자 군주 오라 (은신 아닐 때 은은한 보라 입자)
      if (st.stealth <= 0) {
        const gl = 0.3 + 0.2 * Math.sin(t * 3);
        c.fillStyle = `rgba(176,125,255,${gl})`;
        for (let i = 0; i < 3; i++) {
          const px = Math.sin(t * 2 + i * 2.1) * 12;
          const py = -46 - ((t * 14 + i * 9) % 22);
          c.beginPath(); c.arc(px, py, 1.6, 0, Math.PI * 2); c.fill();
        }
      }
      return;
    }
    if (f.kind === 'b') {
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(1, -50, 10.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#d83a3a';
      c.beginPath(); c.arc(-3, -60, 3, 0, Math.PI * 2); c.arc(1, -62, 3.2, 0, Math.PI * 2); c.arc(5, -60, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(9, -44); c.lineTo(12, -39); c.lineTo(7, -41); c.fill();
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(10, -51); c.lineTo(19, -49); c.lineTo(10, -46); c.fill(); c.stroke();
      c.fillStyle = '#22262e'; c.fillRect(4, -54, 3, 3);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
      c.beginPath(); c.arc(1, -50, 10.5, 0.6, 1.8); c.stroke();
      return;
    }
    if (f.kind === 's') {
      // 그림자 병사: 실루엣 머리 + 보라 눈광
      c.strokeStyle = 'rgba(20,16,28,.95)'; c.lineWidth = 1.8;
      c.fillStyle = '#2a2038';
      c.beginPath(); c.ellipse(0, -50, 10, 9.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      const gl = 0.7 + 0.3 * Math.sin(t * 6);
      c.fillStyle = `rgba(176,125,255,${gl})`;
      c.beginPath(); c.arc(4, -52, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(176,125,255,${gl * 0.5})`;
      c.beginPath(); c.arc(4, -52, 3.6, 0, Math.PI * 2); c.fill();
      return;
    }
    // 악당 머리 (look별)
    const E = M.ETYPES[f.type] || f;
    const bodyC = f.body || (E && E.body) || '#9aa2ad';
    const subC = f.ear || (E && E.ear) || '#c8ccd4';
    const look = f.look || (E && E.look) || 'bug';
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
    if (look === 'bug') {
      // 벌레: 둥근 머리 + 겹눈 + 집게턱 + 더듬이
      c.fillStyle = bodyC;
      c.beginPath(); c.ellipse(0, -50, 10, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = subC; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-3, -58); c.quadraticCurveTo(-8, -68, -13, -66); c.stroke();
      c.beginPath(); c.moveTo(3, -58); c.quadraticCurveTo(8, -70, 2, -72); c.stroke();
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      c.fillStyle = subC;
      c.beginPath(); c.moveTo(8, -46); c.quadraticCurveTo(16, -46, 15, -40); c.quadraticCurveTo(10, -41, 7, -43); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(8, -52); c.quadraticCurveTo(17, -54, 16, -48); c.quadraticCurveTo(11, -48, 7, -49); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#1a1620';
      c.beginPath(); c.arc(3, -52, 2.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.beginPath(); c.arc(2.2, -52.8, 0.9, 0, Math.PI * 2); c.fill();
    } else if (look === 'snake') {
      // 뱀: 쐐기 머리 + 갈라진 혀
      c.fillStyle = bodyC;
      c.beginPath();
      c.moveTo(-9, -54); c.quadraticCurveTo(2, -60, 9, -52);
      c.quadraticCurveTo(16, -47, 13, -44);
      c.quadraticCurveTo(2, -40, -8, -44);
      c.closePath(); c.fill(); c.stroke();
      const flick = Math.sin(t * 8 + f.x) > 0.4;
      if (flick) {
        c.strokeStyle = '#e04848'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(13, -46); c.lineTo(20, -47); c.stroke();
        c.beginPath(); c.moveTo(20, -47); c.lineTo(23, -49); c.moveTo(20, -47); c.lineTo(23, -45); c.stroke();
      }
      c.fillStyle = '#ffd83d';
      c.beginPath(); c.ellipse(4, -51, 2.6, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1620';
      c.fillRect(3.4, -53, 1.3, 4);
      c.fillStyle = subC;
      c.beginPath(); c.ellipse(-4, -56, 3, 1.8, -0.4, 0, Math.PI * 2); c.fill();
    } else if (look === 'ice') {
      // 얼음: 투구 + 차가운 눈 + 고드름 장식
      c.fillStyle = subC;
      c.beginPath(); c.ellipse(0, -50, 9.5, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = bodyC;
      c.beginPath();
      c.moveTo(-10, -52); c.quadraticCurveTo(0, -64, 10, -52);
      c.lineTo(10, -48); c.lineTo(-10, -48);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e8f4ff';
      for (const [ix, iy] of [[-6, -48], [0, -47], [6, -48]]) {
        c.beginPath(); c.moveTo(ix - 2, iy); c.lineTo(ix, iy + 6); c.lineTo(ix + 2, iy); c.closePath(); c.fill();
      }
      c.fillStyle = '#5ae0ff';
      c.fillRect(2.5, -53, 3, 2.6);
      c.fillStyle = 'rgba(90,224,255,.4)';
      c.fillRect(1.5, -54, 5, 4.6);
    } else {
      // 악마: 뿔 + 붉은 눈
      c.fillStyle = bodyC;
      c.beginPath(); c.ellipse(0, -50, 10, 9.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = subC;
      c.beginPath(); c.moveTo(-8, -57); c.quadraticCurveTo(-13, -66, -8, -70); c.quadraticCurveTo(-7, -63, -4, -58); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(6, -58); c.quadraticCurveTo(11, -67, 6, -71); c.quadraticCurveTo(5, -64, 2, -59); c.closePath(); c.fill(); c.stroke();
      const gl = 0.75 + 0.25 * Math.sin(t * 5 + f.x);
      c.fillStyle = `rgba(255,80,80,${gl})`;
      c.beginPath(); c.arc(4, -52, 2.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,80,80,${gl * 0.4})`;
      c.beginPath(); c.arc(4, -52, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(-2, -44); c.lineTo(2, -43); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(-1, -43.6); c.lineTo(0, -41.6); c.lineTo(1, -43.4); c.fill();
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
