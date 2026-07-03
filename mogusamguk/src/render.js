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
  },

  // ── 미션별 배경 ──
  drawBackground(st, t, cam) {
    const c = this.ctx, th = st.stage.theme, m = st.mission;
    // 하늘
    const g = c.createLinearGradient(0, 0, 0, M.FLOOR_Y);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, M.FLOOR_Y);
    if (m === 4 || m === 3) {           // 밤: 별·달
      c.fillStyle = 'rgba(255,255,240,.6)';
      for (let i = 0; i < 20; i++) c.fillRect((i * 151 + 23) % W, (i * 67 + 9) % 60, 1.5, 1.5);
    }

    // 원경 스카이라인 (느린 패럴랙스)
    c.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = -1; i < 9; i++) {
      const bx = i * 70 - ((cam * 0.25) % 70);
      const hgt = 26 + ((i * 53 + m * 17) % 34);
      c.fillRect(bx, 68 - hgt + 60, 52, hgt);
    }

    // ── 근경 벽 (미션별 — 중화 테마) ──
    const wallTop = 62, wallH = M.FLOOR_Y - wallTop;
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
    }

    // ── 바닥 (원근 라인 + 미션 톤) ──
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, th.floor);
    fg.addColorStop(1, this.shade(th.floor, 0.72));
    c.fillStyle = fg;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    // 보도 경계
    c.fillStyle = this.shade(th.floor, 1.25);
    c.fillRect(0, M.FLOOR_Y, W, 3);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(0, M.FLOOR_Y + 3, W, 1.5);
    // 깊이 라인 (희미한 수평선)
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (const zz of [20, 40, 60]) {
      const y = M.FLOOR_Y + zz * ZS;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
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
  },

  // ── HUD: 초상화 + HP 바 ──
  drawHud(st, t) {
    const c = this.ctx;
    this.portraitBar(10, 8, 120, st.p.hp / st.p.maxHp, '#58c85c', 'mogu');
    this.portraitBar(10, 32, 92, Math.max(0, st.b.hp) / st.b.maxHp, '#ffd83d', 'chick');
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
    // 초상화 틀
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
    // HP 바
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x + 23, y + 5, w2, 9);
    c.fillStyle = color;
    c.fillRect(x + 24, y + 6, Math.max(0, (w2 - 2) * Math.min(1, ratio)), 7);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, w2, 9);
  },

  // ── 캐릭터 (더블드래곤풍 리그) ──
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

    // 그림자
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, this.sy(f.z, 0) + 3, 15, 4.5, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(x, y);
    if (f.face < 0) c.scale(-1, 1);
    if (dead) c.globalAlpha = Math.max(0, 1 - (f.stT - 0.8) / 0.8);
    if (down) { c.rotate(-Math.PI / 2); c.translate(4, 12); }
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

    // ── 다리 (무릎 굽힘 워크 사이클) ──
    if (airkick) {
      this.limb(0, -22, 16, -20, 7, pantC);        // 앞차기 허벅지+정강이
      this.limb(16, -20, 26, -18, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(29, -18, 5, 3.5, 0.2, 0, Math.PI * 2); c.fill();
      this.limb(-2, -22, -7, -12, 7, pantC);       // 접은 뒷다리
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
      // 지상: 앞다리·뒷다리 (걸을 때 무릎이 번갈아 굽음)
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

    // ── 몸통 (역삼각 + 벨트 + 근육 음영) ──
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2.4; c.lineJoin = 'round';
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(-11, -42); c.quadraticCurveTo(0, -45, 11, -42);
    c.lineTo(7, -21); c.quadraticCurveTo(0, -19, -7, -21);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = this.shade(shirtC, 0.75);        // 옆구리 음영
    c.beginPath();
    c.moveTo(6, -41); c.lineTo(11, -42); c.lineTo(7, -21); c.lineTo(4, -21);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -30); c.stroke();       // 가슴 골
    c.beginPath(); c.moveTo(-6, -29); c.quadraticCurveTo(0, -26.5, 6, -29); c.stroke();   // 가슴 근육
    // 벨트
    c.fillStyle = '#1a1620';
    c.fillRect(-7, -22, 14, 3.5);
    c.fillStyle = '#d8b83a';
    c.fillRect(-2, -22, 4, 3.5);
    // 갑옷 (모구: 금장 흉갑, 둘 다 견갑)
    if (isP || isB) {
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      if (isP) {
        c.fillStyle = '#d8b83a';
        c.beginPath(); c.roundRect(-8, -37, 16, 11, 3); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-8, -32); c.lineTo(8, -32); c.stroke();
        c.fillStyle = '#a02828';
        c.beginPath(); c.arc(0, -31, 2.6, 0, Math.PI * 2); c.fill();
      }
      const padC = isP ? '#c8a030' : '#8a9aa8';
      c.fillStyle = padC;
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(-11, -39, 5.5, 4, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(11, -39, 5.5, 4, 0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 팔 (가드 자세 / 펀치 / 어퍼컷) ──
    const shY = -38;
    if (atk && f.jy === 0) {
      const upper = f.combo === 3;
      if (upper) {
        this.limb(-8, shY, -14, -32, 6, skinC);    // 뒷팔 가드
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -31, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 17, -46, 6.5, skinC);    // 어퍼컷!
        this.limb(17, -46, 21, -56, 6, skinC);
        c.beginPath(); c.arc(22, -59, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        this.limb(-8, shY, -14, -31, 6, skinC);
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -30, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 18, -37, 6.5, skinC);    // 스트레이트
        this.limb(18, -37, 28, -36, 6, skinC);
        c.beginPath(); c.arc(31, -36, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (hurt || down) {
      this.limb(-8, shY, -15, -30, 6, skinC);
      this.limb(8, shY, 15, -30, 6, skinC);
    } else {
      // 파이팅 가드: 두 주먹을 몸 앞에
      const g2 = Math.sin(t * 4 + (isB ? 1 : 0)) * 0.8;
      this.limb(-8, shY, -12, -30 + g2, 6, skinC);
      this.limb(-12, -30 + g2, -5, -27 + g2, 5.5, skinC);
      this.limb(8, shY, 13, -31 - g2, 6, skinC);
      this.limb(13, -31 - g2, 9, -27 - g2, 5.5, skinC);
      c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(-4, -27 + g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(10, -27 - g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 무기 ──
    this.drawWeapon(f, atk, t);

    // ── 머리 ──
    this.drawHead(f, t);

    // 적 체력바
    if (!isP && !isB && f.hp < f.maxHp && !down) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-12, -70, 24, 3);
      c.fillStyle = '#ff5a5a'; c.fillRect(-12, -70, 24 * Math.max(0, f.hp / f.maxHp), 3);
    }
    c.restore();
  },

  // 무기: 손 좌표는 팔 리그와 동일 좌표계
  drawWeapon(f, atk, t) {
    const c = this.ctx;
    const isP = f.kind === 'p', isB = f.kind === 'b';
    if (f.state === 'down' || f.state === 'dead') return;
    const upper = atk && f.combo === 3;
    const hx = atk ? (upper ? 22 : 31) : 10;
    const hy = atk ? (upper ? -59 : -36) : -27;
    c.save();
    c.translate(hx, hy);
    const swing = atk ? Math.min(1, f.stT / 0.14) : 0;
    if (isP) {
      c.rotate(atk ? (upper ? -1.9 + swing * 1.2 : -1.5 + swing * 1.6) : -0.5);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -22); c.stroke();
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.4;
      c.fillStyle = '#d8dce4';
      c.beginPath();
      c.moveTo(0, -22);
      c.quadraticCurveTo(10, -30, 3, -42);
      c.quadraticCurveTo(6, -32, 0, -30);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#d8b83a';
      c.beginPath(); c.arc(0, -22, 2.4, 0, Math.PI * 2); c.fill();
    } else if (isB) {
      c.rotate(atk ? -1.62 : -0.72);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -24); c.stroke();
      c.fillStyle = '#d8dce4';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-3, -24); c.lineTo(0, -34); c.lineTo(3, -24); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a02828';
      c.beginPath(); c.arc(0, -23, 2, 0, Math.PI * 2); c.fill();
    } else if (!(atk && f.jy > 0)) {
      const kind = f.base || f.type || 'spear';
      c.rotate(atk ? -1.5 : -0.6);
      if (kind === 'axe') {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -18); c.stroke();
        c.fillStyle = '#b8bcc8';
        c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, -18); c.quadraticCurveTo(11, -16, 9, -6); c.lineTo(0, -10); c.closePath(); c.fill(); c.stroke();
      } else if (kind === 'archer') {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.2; c.lineCap = 'round';
        c.beginPath(); c.arc(0, -6, 13, -1.25, 1.25); c.stroke();
        c.strokeStyle = 'rgba(230,230,240,.7)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(Math.cos(-1.25) * 13, -6 + Math.sin(-1.25) * 13); c.lineTo(Math.cos(1.25) * 13, -6 + Math.sin(1.25) * 13); c.stroke();
      } else if (kind === 'shield' || f.type === 'tank') {
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
