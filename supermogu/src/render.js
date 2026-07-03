// render.js — 횡스크롤 타일 렌더 (480×270): 테마 하늘·타일·캐릭터 (전부 코드 드로잉)
const M = window.SMG;
const W = 480, H = 270;
const TL = 16;

M.Render = {
  cv: null, ctx: null, mogu: null, camX: 0, fx: [],

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

  addBreak(tx, ty) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0], [1, 0]]) {
      this.fx.push({ kind: 'shard', x: tx * TL + 8, y: ty * TL + 8, vx: dx * 60, vy: dy * 120 - 60, t: 0 });
    }
  },

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g2 = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g2},${b})`;
  },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme, T = M.T;
    // 카메라
    const target = Math.max(0, Math.min(st.stage.len * TL - W, st.p.x - 200));
    this.camX += (target - this.camX) * Math.min(1, dt * 8);
    const cam = this.camX;

    // ── 하늘 ──
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (st.stage.world === 6 || st.stage.world === 8) {
      c.fillStyle = 'rgba(255,255,240,.5)';
      for (let i = 0; i < 16; i++) c.fillRect((i * 151 + 23 - cam * 0.1) % W + (W % 1), (i * 67 + 9) % 90, 1.5, 1.5);
    } else {
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 170 + 40 - cam * 0.3) % (W + 120) + W + 120) % (W + 120) - 60;
        const y = 26 + (i * 37) % 60;
        c.beginPath();
        c.arc(x, y, 11, 0, Math.PI * 2);
        c.arc(x + 12, y + 3, 8, 0, Math.PI * 2);
        c.arc(x - 12, y + 4, 8, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 원경 언덕
    c.fillStyle = this.shade(th.deco, 1.1);
    c.globalAlpha = 0.4;
    c.beginPath();
    c.moveTo(0, 210);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 178 + Math.sin((x + cam * 0.35) * 0.016) * 20);
    c.lineTo(W, H); c.lineTo(0, H);
    c.fill();
    c.globalAlpha = 1;

    // ── 타일 ──
    const x0 = Math.floor(cam / TL) - 1, x1 = Math.ceil((cam + W) / TL) + 1;
    for (let tx = Math.max(0, x0); tx < Math.min(st.stage.len, x1); tx++) {
      for (let ty = 0; ty < M.ROWS; ty++) {
        const v = st.stage.g[tx][ty];
        if (v === T.AIR) continue;
        const x = tx * TL - cam, y = ty * TL;
        if (v === T.GND) {
          c.fillStyle = th.gnd;
          c.fillRect(x, y, TL, TL);
          if (ty === 0 || st.stage.g[tx][ty - 1] === T.AIR || st.stage.g[tx][ty - 1] === T.FLAG) {
            c.fillStyle = th.top;
            c.fillRect(x, y, TL, 5);
          }
          c.fillStyle = 'rgba(0,0,0,.12)';
          c.fillRect(x + ((tx * 7 + ty * 13) % 3) * 4 + 2, y + 8 + ((tx * 5) % 2) * 3, 3, 2);
        } else if (v === T.BRICK) {
          c.fillStyle = '#b8683a';
          c.fillRect(x, y, TL, TL);
          c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
          c.strokeRect(x + 0.5, y + 0.5, TL - 1, TL - 1);
          c.beginPath();
          c.moveTo(x, y + 8); c.lineTo(x + TL, y + 8);
          c.moveTo(x + 8, y); c.lineTo(x + 8, y + 8);
          c.moveTo(x + 4, y + 8); c.lineTo(x + 4, y + 16);
          c.moveTo(x + 12, y + 8); c.lineTo(x + 12, y + 16);
          c.stroke();
        } else if (v === T.Q) {
          const blink = 0.75 + 0.25 * Math.sin(t * 5);
          c.fillStyle = `rgba(240,180,40,${blink})`;
          c.fillRect(x, y, TL, TL);
          c.fillStyle = '#f8d878';
          c.fillRect(x + 1, y + 1, TL - 2, 3);
          c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1;
          c.strokeRect(x + 0.5, y + 0.5, TL - 1, TL - 1);
          c.fillStyle = '#7a4a10';
          c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
          c.fillText('?', x + 8, y + 12.5);
        } else if (v === T.USED) {
          c.fillStyle = '#8a6a4a';
          c.fillRect(x, y, TL, TL);
          c.strokeStyle = 'rgba(0,0,0,.4)';
          c.strokeRect(x + 0.5, y + 0.5, TL - 1, TL - 1);
        } else if (v === T.PIPE || v === T.PIPE_T) {
          c.fillStyle = '#2a9a3a';
          const isL = tx === 0 || st.stage.g[tx - 1][ty] !== v;
          c.fillRect(x - (v === T.PIPE_T && isL ? 2 : 0), y, TL + (v === T.PIPE_T ? 2 : 0), TL);
          c.fillStyle = 'rgba(255,255,255,.3)';
          c.fillRect(x + 2, y, 3, TL);
          c.fillStyle = 'rgba(0,0,0,.25)';
          c.fillRect(x + TL - 3, y, 3, TL);
          if (v === T.PIPE_T) {
            c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.4;
            c.strokeRect(x - (isL ? 2 : 0) + 0.5, y + 0.5, TL + 2 - 1, TL - 1);
          }
        } else if (v === T.BLOCK || v === T.CASTLE) {
          c.fillStyle = v === T.CASTLE ? '#8a8290' : this.shade(th.gnd, 1.15);
          c.fillRect(x, y, TL, TL);
          c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
          c.strokeRect(x + 0.5, y + 0.5, TL - 1, TL - 1);
          c.fillStyle = 'rgba(255,255,255,.16)';
          c.fillRect(x + 1, y + 1, TL - 2, 3);
        } else if (v === T.LAVA) {
          c.fillStyle = '#e04a20';
          c.fillRect(x, y, TL, TL);
          c.fillStyle = '#ffb03a';
          const w1 = Math.sin(t * 4 + tx * 1.7) * 2;
          c.fillRect(x, y, TL, 3 + w1);
        } else if (v === T.FLAG) {
          // 폴 (기둥 열 전체에서 한 번만 — 상단 마커에서 그림)
          if (ty === 0 || st.stage.g[tx][ty - 1] !== T.FLAG) {
            const poleH = (st.stage.gndY - ty) * TL;
            c.fillStyle = '#c8ccd4';
            c.fillRect(x + 7, y, 3, poleH);
            c.fillStyle = '#e8e4dc';
            c.beginPath(); c.arc(x + 8.5, y - 2, 4, 0, Math.PI * 2); c.fill();
            // 깃발 (클리어 시 아래로)
            const fy = st.phase === 'clear' ? y + Math.min(poleH - 20, st.endT * 60) : y + 2;
            c.fillStyle = '#e83838';
            c.beginPath();
            c.moveTo(x + 7, fy);
            c.lineTo(x - 8, fy + 6);
            c.lineTo(x + 7, fy + 12);
            c.closePath(); c.fill();
          }
        }
      }
    }

    // 코인 팝
    for (const cp of st.pops) {
      const p2 = cp.t / 0.5;
      const y = cp.y - 14 - p2 * 30 + p2 * p2 * 22;
      c.fillStyle = '#ffd83d';
      c.beginPath();
      c.ellipse(cp.x - cam, y, 5 * Math.abs(Math.cos(cp.t * 14)), 7, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#b8860b'; c.lineWidth = 1;
      c.stroke();
    }

    // 벽돌 파편 FX
    this.fx = this.fx.filter((f) => f.t < 0.6);
    for (const f of this.fx) {
      f.t += dt; f.vy += 500 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      c.globalAlpha = 1 - f.t / 0.6;
      c.fillStyle = '#b8683a';
      c.fillRect(f.x - cam - 3, f.y - 3, 6, 6);
      c.globalAlpha = 1;
    }

    // ── 아이템 ──
    for (const it of st.items) {
      const x = it.x - cam, y = it.y;
      if (it.kind === 'chur') {
        c.save();
        c.translate(x + 6, y + 6); c.rotate(-0.5);
        c.strokeStyle = 'rgba(20,16,28,.8)'; c.lineWidth = 8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
        c.strokeStyle = '#f0e0c8'; c.lineWidth = 5.5;
        c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
        c.strokeStyle = '#e08830';
        c.beginPath(); c.moveTo(-5, 0); c.lineTo(-1, 0); c.stroke();
        c.restore();
      } else if (it.kind === 'catnip') {
        c.fillStyle = '#4aba4a';
        c.strokeStyle = 'rgba(20,16,28,.8)'; c.lineWidth = 1.2;
        for (const a of [-0.7, 0, 0.7]) {
          c.save();
          c.translate(x + 6, y + 8); c.rotate(a);
          c.beginPath(); c.ellipse(0, -5, 3, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
          c.restore();
        }
        c.strokeStyle = '#2a7a2a'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x + 6, y + 8); c.lineTo(x + 6, y + 12); c.stroke();
      } else {
        // 반짝 방울 (무적)
        const pulse = 1 + Math.sin(t * 8) * 0.15;
        c.fillStyle = `hsl(${(t * 260) % 360}, 90%, 70%)`;
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6;
        c.beginPath(); c.arc(x + 6, y + 6, 6.5 * pulse, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.8)';
        c.beginPath(); c.arc(x + 4, y + 4, 2, 0, Math.PI * 2); c.fill();
      }
    }

    // ── 털뭉치 ──
    c.fillStyle = '#d8ccb8';
    c.strokeStyle = 'rgba(20,16,28,.7)'; c.lineWidth = 1.2;
    for (const sh of st.shots) {
      c.beginPath(); c.arc(sh.x - cam + 3.5, sh.y + 3.5, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120,100,80,.5)';
      c.beginPath(); c.arc(sh.x - cam + 3.5, sh.y + 3.5, 2.2, t * 10, t * 10 + 2); c.stroke();
      c.strokeStyle = 'rgba(20,16,28,.7)';
    }

    // ── 악당 ──
    for (const e of st.enemies) {
      if (!e.alive) continue;
      const x = e.x - cam;
      if (x < -30 || x > W + 30) continue;
      this.drawEnemy(st, e, x, t);
    }

    // ── 보스 ──
    if (st.boss && st.boss.alive) this.drawBoss(st, st.boss, st.boss.x - cam, t);

    // ── 모구 ──
    this.drawMogu(st, t, cam);

    this.drawHud(st, t);
  },

  drawEnemy(st, e, x, t) {
    const c = this.ctx;
    const squish = e.squashT > 0;
    c.save();
    c.translate(x + e.w / 2, e.y + e.h);
    if (e.type === 'bird') {
      c.fillStyle = '#5a8ac8';
      c.strokeStyle = 'rgba(20,16,28,.85)'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, -5.5, 7, 5.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      const flap = Math.sin(t * 12 + e.phase) * 0.8;
      c.fillStyle = '#7aaae0';
      c.beginPath();
      c.moveTo(-2, -7); c.quadraticCurveTo(-9, -10 - flap * 6, -13, -6 - flap * 8);
      c.quadraticCurveTo(-8, -4, -2, -4); c.fill(); c.stroke();
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(6, -6); c.lineTo(11, -5); c.lineTo(6, -3.5); c.fill();
      c.fillStyle = '#1a1620';
      c.fillRect(2.5, -8, 2, 2);
    } else if (e.type === 'hedge') {
      if (e.shell) {
        c.fillStyle = '#8a6a4a';
        c.strokeStyle = 'rgba(20,16,28,.85)'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(0, -6, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = '#5a4028'; c.lineWidth = 1.2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + (e.sliding ? t * 12 : 0);
          c.beginPath();
          c.moveTo(Math.cos(a) * 6, -6 + Math.sin(a) * 6);
          c.lineTo(Math.cos(a) * 9, -6 + Math.sin(a) * 9);
          c.stroke();
        }
      } else {
        c.fillStyle = '#a87a50';
        c.strokeStyle = 'rgba(20,16,28,.85)'; c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(0, -6.5, 7, 6.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = '#5a4028'; c.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const a = -0.4 - i * 0.5;
          c.beginPath();
          c.moveTo(Math.cos(a) * 6, -6.5 + Math.sin(a) * 6);
          c.lineTo(Math.cos(a) * 9.5, -6.5 + Math.sin(a) * 9.5);
          c.stroke();
        }
        c.fillStyle = '#e8c8a0';
        c.beginPath(); c.ellipse(Math.sign(e.vx) * 4, -4, 3.5, 3, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a1620';
        c.fillRect(Math.sign(e.vx) * 5, -6, 1.6, 1.6);
      }
    } else {
      // 쥐
      const sc = squish ? 0.4 : 1;
      const wob = squish ? 0 : Math.sin(t * 9 + e.phase) * 0.08;
      c.rotate(wob);
      c.fillStyle = '#9aa2ad';
      c.strokeStyle = 'rgba(20,16,28,.85)'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, -6.5 * sc, 7, 6.5 * sc, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      if (!squish) {
        c.fillStyle = '#c8ccd4';
        c.beginPath(); c.arc(-3, -12, 3, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.arc(3, -12, 3, 0, Math.PI * 2); c.fill(); c.stroke();
        c.strokeStyle = '#8a929d'; c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(-Math.sign(e.vx) * 6, -4);
        c.quadraticCurveTo(-Math.sign(e.vx) * 12, -6, -Math.sign(e.vx) * 13, -2);
        c.stroke();
        c.fillStyle = '#1a1620';
        c.fillRect(Math.sign(e.vx) * 2 - 1, -9, 2, 2);
        c.beginPath(); c.arc(Math.sign(e.vx) * 6.5, -6, 1.4, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = '#1a1620';
        c.font = 'bold 6px sans-serif'; c.textAlign = 'center';
        c.fillText('××', 0, -4);
      }
    }
    c.restore();
  },

  drawBoss(st, bo, x, t) {
    const c = this.ctx;
    c.save();
    c.translate(x + bo.w / 2, bo.y + bo.h);
    if (bo.iv > 0 && Math.floor(t * 14) % 2) c.globalAlpha = 0.5;
    c.fillStyle = '#6a4a8a';
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, -14, 14, 14, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#9a78b8';
    c.beginPath(); c.arc(-7, -27, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(7, -27, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#1a1620';
    c.fillRect(-5, -19, 3, 3); c.fillRect(2, -19, 3, 3);
    c.beginPath(); c.arc(0, -13, 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(230,230,240,.7)'; c.lineWidth = 1;
    for (const wy of [-14, -12]) {
      c.beginPath(); c.moveTo(4, wy); c.lineTo(13, wy - 1); c.stroke();
      c.beginPath(); c.moveTo(-4, wy); c.lineTo(-13, wy - 1); c.stroke();
    }
    // 왕관
    c.fillStyle = '#ffd83d';
    c.beginPath();
    c.moveTo(-8, -30); c.lineTo(-5, -38); c.lineTo(-1, -31); c.lineTo(3, -39); c.lineTo(7, -30);
    c.closePath(); c.fill(); c.stroke();
    c.restore();
    // HP
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x - 2, bo.y - 18, 30, 4);
    c.fillStyle = '#ff5a5a';
    c.fillRect(x - 1, bo.y - 17, 28 * (bo.hp / 3), 2);
  },

  drawMogu(st, t, cam) {
    const c = this.ctx;
    const p = st.p;
    const x = p.x - cam;
    c.save();
    c.translate(x + p.w / 2, p.y + p.h);
    if (p.face < 0) c.scale(-1, 1);
    if (p.inv > 0 && Math.floor(t * 16) % 2) c.globalAlpha = 0.45;
    if (p.star > 0) {
      c.shadowColor = `hsl(${(t * 400) % 360}, 95%, 60%)`;
      c.shadowBlur = 10;
    }
    if (p.dead) c.rotate(Math.PI);
    const big = p.size > 0;
    // 모구 사진이 캐릭터 전체 — 파워업 시 사진 자체가 커짐 (발은 지면 고정)
    if (this.mogu) {
      const a = this.mogu.width / this.mogu.height;
      const hh = big ? 27 : 18;
      c.drawImage(this.mogu, -hh * a / 2, -hh, hh * a, hh);   // 원본이 오른쪽을 봄 → 그대로
      if (p.size === 2) {
        // 캣닢 상태 표시: 머리 위 작은 잎
        c.fillStyle = '#4aba4a';
        c.strokeStyle = 'rgba(20,16,28,.8)'; c.lineWidth = 1;
        for (const ang of [-0.55, 0.15]) {
          c.save();
          c.translate(4, -hh + 2); c.rotate(ang);
          c.beginPath(); c.ellipse(0, -3.5, 2, 4.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
          c.restore();
        }
      }
    }
    c.restore();
  },

  drawHud(st, t) {
    const c = this.ctx;
    c.fillStyle = 'rgba(10,16,32,.55)';
    c.fillRect(0, 0, W, 18);
    c.font = 'bold 9.5px sans-serif'; c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(`SCORE ${String(st.score).padStart(6, '0')}`, 8, 12.5);
    c.fillStyle = '#ffd83d';
    c.fillText(`● × ${st.coins}/${st.stage.coinTotal}`, 118, 12.5);
    c.textAlign = 'center';
    c.fillStyle = '#c8d6ee';
    c.fillText(`WORLD ${st.stage.world}-${st.stage.sub} · ${st.stage.theme.name}`, W / 2 + 20, 12.5);
    c.textAlign = 'right';
    const tc = st.time < 40 ? (Math.floor(t * 4) % 2 ? '#ff6a6a' : '#ffd0d0') : '#fff';
    c.fillStyle = tc;
    c.fillText(`TIME ${Math.ceil(st.time)}`, W - 10, 12.5);
    // 파워 상태 (TIME 왼쪽, 중앙 텍스트와 겹침 방지)
    const label = st.p.star > 0 ? '★무적' : ['꼬마', '슈퍼', '캣닢'][st.p.size];
    c.textAlign = 'right';
    c.fillStyle = st.p.star > 0 ? `hsl(${(t * 300) % 360},90%,70%)` : '#9fe06a';
    c.fillText(label, W - 78, 12.5);
  },
};
