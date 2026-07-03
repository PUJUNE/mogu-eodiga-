// render.js — 포트리스 캔버스 렌더 (480×270): 지형·탱크·탄도·바람 HUD
const M = window.MFT;
const W = 480, H = 270;

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

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  },

  addBoom(x, y) { this.fx.push({ kind: 'boom', x, y, t: 0 }); },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 하늘
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (th.night) {
      c.fillStyle = 'rgba(255,200,120,.5)';
      for (let i = 0; i < 12; i++) {
        c.globalAlpha = 0.3 + 0.4 * Math.sin(t * 2.5 + i * 1.7);
        c.fillRect((i * 173 + ((t * 12 + i * 30) % 40)) % W, (i * 61 + 20) % 130, 2, 2);
      }
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(255,255,255,.8)';
      for (const [ox, oy, s2] of [[80, 44, 1], [250, 30, 0.7], [390, 56, 0.85]]) {
        c.beginPath();
        c.arc(ox + Math.sin(t * 0.08) * 8, oy, 12 * s2, 0, Math.PI * 2);
        c.arc(ox + 13 * s2 + Math.sin(t * 0.08) * 8, oy + 4, 9 * s2, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 원경 능선
    c.fillStyle = th.far;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(0, 200);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, 150 + Math.sin(x * 0.02 + 2) * 22 + Math.sin(x * 0.006) * 14);
    c.lineTo(W, H); c.lineTo(0, H);
    c.fill();
    c.globalAlpha = 1;

    // ── 지형 ──
    for (let i = 0; i < M.NCOL; i++) {
      const x = i * M.TCOL, y = st.terrain[i];
      c.fillStyle = th.dirt;
      c.fillRect(x, y, M.TCOL, H - y);
      c.fillStyle = th.ground;
      c.fillRect(x, y, M.TCOL, 5);
    }
    if (st.stage.world === 4) {              // 화산: 바닥 용암 글로우
      c.fillStyle = 'rgba(255,90,40,.25)';
      c.fillRect(0, H - 10, W, 10);
    }

    // 탄도 궤적 + 포탄
    if (st.proj) {
      c.fillStyle = 'rgba(255,255,255,.35)';
      st.proj.trail.forEach((p, i) => {
        c.globalAlpha = (i / st.proj.trail.length) * 0.5;
        c.beginPath(); c.arc(p.x, p.y, 1.8, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
      c.fillStyle = '#1a1620';
      c.beginPath(); c.arc(st.proj.x, st.proj.y, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd83d'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(st.proj.x + 3, st.proj.y - 4);
      c.lineTo(st.proj.x + 6, st.proj.y - 8); c.stroke();
      c.fillStyle = Math.floor(t * 14) % 2 ? '#ff9d3c' : '#ffe08a';
      c.beginPath(); c.arc(st.proj.x + 6.5, st.proj.y - 9, 2, 0, Math.PI * 2); c.fill();
    }

    // 탱크
    this.drawTank(st, st.p, true, t);
    this.drawTank(st, st.e, false, t);

    // FX (폭발)
    this.fx = this.fx.filter((f) => f.t < 0.5);
    for (const f of this.fx) {
      f.t += dt;
      const p = f.t / 0.5;
      c.globalAlpha = 1 - p;
      c.fillStyle = p < 0.3 ? '#ffe08a' : '#ff9d3c';
      c.beginPath(); c.arc(f.x, f.y, 6 + p * 30, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#5a4a40'; c.lineWidth = 3; c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const rr = 12 + p * 34;
        c.beginPath();
        c.moveTo(f.x + Math.cos(a) * rr * 0.6, f.y + Math.sin(a) * rr * 0.6 + p * p * 30);
        c.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr + p * p * 30);
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    this.drawHud(st, t);
  },

  drawTank(st, who, isP, t) {
    const c = this.ctx;
    const x = M.Logic.tankX(st, who), y = M.Logic.tankY(st, who);
    const kind = st.stage.enemy.kind;
    const body = isP ? '#c85a3a' : '#5a6a7a';
    c.save();
    c.translate(x, y);
    // 포신
    const ang = (isP ? who.angle : who.angle) * Math.PI / 180;
    c.strokeStyle = '#2a2430'; c.lineWidth = 5.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -10);
    c.lineTo(Math.cos(ang) * 20, -10 - Math.sin(ang) * 20); c.stroke();
    c.strokeStyle = isP ? '#8a5a3a' : '#3a4a5a'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(0, -10);
    c.lineTo(Math.cos(ang) * 19, -10 - Math.sin(ang) * 19); c.stroke();
    // 차체
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2;
    c.fillStyle = body;
    c.beginPath(); c.roundRect(-15, -14, 30, 10, 4); c.fill(); c.stroke();
    // 무한궤도
    c.fillStyle = '#2a2430';
    c.beginPath(); c.roundRect(-16, -6, 32, 7, 3.5); c.fill();
    c.fillStyle = '#4a4454';
    for (let i = -12; i <= 12; i += 6) {
      c.beginPath(); c.arc(i, -2.5, 2.2, 0, Math.PI * 2); c.fill();
    }
    // 머리
    if (isP) {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height, hh = 20;
        c.save();
        c.scale(-1, 1);                    // 원본 사진이 왼쪽을 봄 → 오른쪽(적 방향) 반전
        c.drawImage(this.mogu, -hh * a / 2, -33, hh * a, hh);
        c.restore();
      }
    } else {
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      if (kind === 'vacuum' || kind === 'lord') {
        c.fillStyle = kind === 'lord' ? '#6a4a8a' : '#4a4a58';
        c.beginPath(); c.roundRect(-9, -28, 18, 13, 4); c.fill(); c.stroke();
        c.fillStyle = '#ff5252'; c.fillRect(-6, -24, 4, 3);
      } else if (kind === 'crow') {
        c.fillStyle = '#3a3a48';
        c.beginPath(); c.ellipse(0, -22, 9, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#f0b040';
        c.beginPath(); c.moveTo(-8, -22); c.lineTo(-14, -20); c.lineTo(-8, -19); c.fill();
        c.fillStyle = '#ffd83d'; c.fillRect(-5, -25, 2.5, 2.5);
      } else {
        c.fillStyle = '#9aa2ad';
        c.beginPath(); c.ellipse(0, -21, 8.5, 7.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#c8ccd4';
        c.beginPath(); c.arc(-4, -28, 3.6, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(3, -28, 3.6, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#1a1620'; c.fillRect(-6, -22, 2.2, 2.2);
      }
      if (st.stage.boss) {
        c.fillStyle = '#ffd83d';
        c.beginPath();
        c.moveTo(-6, -31); c.lineTo(-4, -37); c.lineTo(-1, -31.5); c.lineTo(2, -38); c.lineTo(5, -31);
        c.closePath(); c.fill();
      }
    }
    c.restore();

    // 조준 중 파워 게이지 (플레이어 탱크 위)
    if (isP && (st.phase === 'aim' || st.phase === 'charge')) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(x - 26, y - 52, 52, 7);
      c.fillStyle = st.power > 75 ? '#ff5a5a' : st.power > 40 ? '#ffd83d' : '#7de08a';
      c.fillRect(x - 25, y - 51, 50 * (st.power / 100), 5);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
      c.strokeRect(x - 26, y - 52, 52, 7);
      c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.fillText(`${Math.round(who.angle)}°`, x, y - 56);
      // 연료 게이지
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(x - 26, y - 43, 52, 4);
      c.fillStyle = '#5db8ff';
      c.fillRect(x - 25, y - 42.5, 50 * Math.max(0, st.fuel / 100), 3);
    }
  },

  drawHud(st, t) {
    const c = this.ctx;
    // HP 바 + 초상화
    this.bar(10, 8, 120, st.p.hp / st.p.maxHp, '#58c85c', true);
    this.bar(W - 150, 8, 120, st.e.hp / st.e.maxHp, '#ff5a5a', false, st.stage.enemy.name);
    // 바람
    const wmag = Math.abs(st.wind);
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath(); c.roundRect(W / 2 - 44, 6, 88, 22, 6); c.fill();
    c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.fillText('바람', W / 2, 15);
    c.fillStyle = wmag < 1 ? '#c8d6ee' : st.wind > 0 ? '#7de08a' : '#ffb35c';
    const arrow = wmag < 0.5 ? '·' : (st.wind > 0 ? '▶'.repeat(Math.min(3, Math.ceil(wmag / 2.2))) : '◀'.repeat(Math.min(3, Math.ceil(wmag / 2.2))));
    c.fillText(`${arrow} ${wmag.toFixed(1)}`, W / 2, 25);
    // 턴 표시
    c.font = 'bold 11px sans-serif';
    c.fillStyle = 'rgba(255,255,255,.9)';
    const label = st.phase === 'enemy' || (st.phase === 'fly' && st.proj && st.proj.from === 1)
      ? `${st.stage.enemy.name}의 턴…` : st.phase === 'fly' ? '' : '모구의 턴 — 꾹 눌러 파워!';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    if (label) { c.strokeText(label, W / 2, 44); c.fillText(label, W / 2, 44); }
    c.font = 'bold 10px sans-serif';
    c.strokeText(`STAGE ${st.no} · ${st.stage.theme.name}`, W / 2, H - 8);
    c.fillText(`STAGE ${st.no} · ${st.stage.theme.name}`, W / 2, H - 8);
  },

  bar(x, y, w2, ratio, color, isP, name) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.beginPath(); c.roundRect(x, y, 19, 19, 3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
    c.strokeRect(x, y, 19, 19);
    if (isP && this.mogu) {
      const a = this.mogu.width / this.mogu.height;
      c.save();
      c.beginPath(); c.rect(x + 1, y + 1, 17, 17); c.clip();
      c.drawImage(this.mogu, x + 9.5 - (17 * a) / 2, y + 1, 17 * a, 17);
      c.restore();
    } else if (!isP) {
      c.fillStyle = '#9aa2ad';
      c.beginPath(); c.ellipse(x + 9.5, y + 11, 6.5, 5.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c8ccd4';
      c.beginPath(); c.arc(x + 6, y + 5.5, 2.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 12, y + 5.5, 2.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1620'; c.fillRect(x + 7.5, y + 9, 1.8, 1.8); c.fillRect(x + 11, y + 9, 1.8, 1.8);
    }
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x + 23, y + 5, w2, 9);
    c.fillStyle = color;
    c.fillRect(x + 24, y + 6, Math.max(0, (w2 - 2) * Math.min(1, ratio)), 7);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, w2, 9);
    if (name) {
      c.font = 'bold 8px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff';
      c.fillText(name, x + 23, y - 1);
    }
  },
};
