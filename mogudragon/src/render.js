// render.js — 벨트스크롤 캔버스 렌더 (480×270): 근육 모구·근육 꼬꼬·악당
const M = window.MDG;
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
  },

  addSpark(x, y, kd) { this.fx.push({ kind: kd ? 'kd' : 'spark', x, y, t: 0 }); },

  sy(z, jy) { return M.FLOOR_Y + z * ZS - (jy || 0); },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 카메라
    const target = Math.max(0, Math.min(st.stage.length - W, st.p.x - 210));
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    const cam = this.camX;

    // 하늘·벽
    const g = c.createLinearGradient(0, 0, 0, M.FLOOR_Y);
    g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, M.FLOOR_Y);
    // 배경 실루엣 (테마별, 패럴랙스)
    c.fillStyle = th.wall;
    for (let i = -1; i < 8; i++) {
      const bx = i * 90 - ((cam * 0.5) % 90);
      const hgt = 40 + ((i * 37 + st.mission * 13) % 50);
      if (st.mission === 3) {           // 숲: 나무
        c.fillRect(bx + 18, M.FLOOR_Y - hgt - 8, 10, hgt + 8);
        c.beginPath(); c.arc(bx + 23, M.FLOOR_Y - hgt - 14, 24, 0, Math.PI * 2); c.fill();
      } else {                          // 건물/기계
        c.fillRect(bx, M.FLOOR_Y - hgt, 64, hgt);
        c.fillStyle = 'rgba(255,220,120,.25)';
        for (let wy = 0; wy < 3; wy++) for (let wx2 = 0; wx2 < 3; wx2++) {
          if ((i + wy + wx2) % 3 === 0) c.fillRect(bx + 8 + wx2 * 18, M.FLOOR_Y - hgt + 8 + wy * 14, 8, 8);
        }
        c.fillStyle = th.wall;
      }
    }
    // 바닥
    c.fillStyle = th.floor;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    c.fillStyle = th.floor2;
    for (let i = -1; i < 9; i++) {
      const fx2 = i * 64 - (cam % 64);
      c.fillRect(fx2, M.FLOOR_Y, 32, H - M.FLOOR_Y);
    }
    c.fillStyle = 'rgba(255,255,255,.15)';
    c.fillRect(0, M.FLOOR_Y, W, 2);

    // GO → 표시
    if (st.go && Math.floor(t * 2.5) % 2 === 0) {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'right';
      c.fillStyle = th.accent;
      c.fillText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
    }

    // 츄르
    for (const it of st.items) {
      const x = it.x - cam, y = this.sy(it.z, 0);
      c.save();
      c.translate(x, y - 4 + Math.sin(t * 5 + it.x) * 2); c.rotate(-0.5);
      c.fillStyle = '#f0e0c8'; c.fillRect(-8, -3, 16, 6);
      c.fillStyle = '#e08830'; c.fillRect(-8, -3, 5, 6);
      c.restore();
    }

    // 엔티티 (깊이 정렬)
    const ents = [st.p, st.b, ...st.enemies].filter((f) => f.state !== 'dead' || f.stT < 1.6);
    ents.sort((a, b2) => a.z - b2.z);
    for (const f of ents) this.drawFighter(st, f, t);

    // FX
    this.fx = this.fx.filter((f) => f.t < 0.3);
    for (const f of this.fx) {
      f.t += dt;
      const p = f.t / 0.3, x = f.x - cam;
      c.globalAlpha = 1 - p;
      c.strokeStyle = f.kind === 'kd' ? '#ffd83d' : '#fff';
      c.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + p * 2;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 4, f.y + Math.sin(a) * 4);
        c.lineTo(x + Math.cos(a) * (8 + p * 14), f.y + Math.sin(a) * (8 + p * 14));
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // ── HUD (캔버스 상단) ──
    this.bar(10, 10, 120, st.p.hp / st.p.maxHp, '#58c85c', '모구');
    this.bar(10, 30, 90, Math.max(0, st.b.hp) / st.b.maxHp, '#ffd83d', '꼬꼬');
    const boss = st.enemies.find((e) => e.boss && M.Logic.alive(e));
    if (boss) this.bar(W - 160, 10, 150, boss.hp / boss.maxHp, '#ff5a5a', boss.name);
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.fillText(`MISSION ${st.mission} · ${th.name}`, W / 2, 18);
  },

  bar(x, y, w2, ratio, color, label) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x, y, w2, 9);
    c.fillStyle = color;
    c.fillRect(x + 1, y + 1, Math.max(0, (w2 - 2) * Math.min(1, ratio)), 7);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x, y, w2, 9);
    c.font = 'bold 8px sans-serif'; c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(label, x + 2, y - 2);
  },

  // 근육질 몸 공통 (머리는 kind별)
  drawFighter(st, f, t) {
    const c = this.ctx;
    const x = f.x - this.camX;
    if (x < -60 || x > W + 60) return;
    const y = this.sy(f.z, f.jy);
    const down = f.state === 'down' || f.state === 'dead';
    const hurt = f.state === 'hurt';
    const atk = f.state === 'atk';
    const walk = f.state === 'walk';
    const dead = f.state === 'dead';

    // 그림자
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath(); c.ellipse(x, this.sy(f.z, 0) + 3, 14, 4, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(x, y);
    if (f.face < 0) c.scale(-1, 1);
    if (dead) c.globalAlpha = Math.max(0, 1 - (f.stT - 0.8) / 0.8);
    if (down) { c.rotate(-Math.PI / 2); c.translate(6, 10); }
    if (hurt) c.translate(Math.sin(t * 40) * 1.5, 0);

    const big = f.boss ? 1.35 : f.type === 'tank' ? 1.15 : 1;
    c.scale(big, big);

    // 다리
    const step = walk ? Math.sin(t * 12) * 4 : 0;
    c.fillStyle = '#3a4a6a';
    if (atk && f.jy > 0) {              // 점프킥: 앞차기
      c.save(); c.translate(2, -12); c.rotate(-1.1); c.fillRect(0, 0, 7, 16); c.restore();
      c.fillRect(-7, -14, 6, 14);
    } else {
      c.fillRect(-8 + step, -14, 6, 14);
      c.fillRect(2 - step, -14, 6, 14);
    }
    // 근육 몸통 (역삼각 + 팔뚝)
    const bodyC = f.kind === 'p' ? '#e05a4a' : f.kind === 'b' ? '#4a90d8' : (M.ETYPES[f.type] ? M.ETYPES[f.type].body : f.body || '#9aa2ad');
    const skin = f.kind === 'p' ? '#e8c8a0' : f.kind === 'b' ? '#f0e8d8' : '#b8b8c0';
    c.fillStyle = bodyC;
    c.beginPath();
    c.moveTo(-12, -38); c.lineTo(12, -38); c.lineTo(8, -14); c.lineTo(-8, -14);
    c.closePath(); c.fill();
    // 가슴 근육 라인
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -36); c.lineTo(0, -26); c.stroke();
    c.beginPath(); c.moveTo(-8, -30); c.lineTo(-2, -28); c.stroke();
    c.beginPath(); c.moveTo(8, -30); c.lineTo(2, -28); c.stroke();
    // 팔 (공격 시 앞으로 뻗음)
    c.fillStyle = skin;
    if (atk && f.jy === 0) {
      const up = f.combo === 3;
      c.save();
      c.translate(8, -32);
      c.rotate(up ? -0.7 : 0);
      c.fillRect(0, -3.5, 22, 8);       // 뻗은 팔
      c.beginPath(); c.arc(24, 0.5, 5.5, 0, Math.PI * 2); c.fill();   // 주먹
      c.restore();
      c.fillRect(-14, -34, 7, 14);      // 뒷팔
    } else {
      c.fillRect(-14, -34, 7, 15);
      c.fillRect(7, -34, 7, 15);
    }
    // 머리
    if (f.kind === 'p') {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height, hh = 24;
        c.save();
        c.scale(-1, 1);                   // 원본 사진이 왼쪽을 봄 → 로컬 기준(오른쪽 향)으로 반전
        c.drawImage(this.mogu, -hh * a / 2, -62, hh * a, hh);
        c.restore();
      }
    } else if (f.kind === 'b') {
      // 꼬꼬: 닭 머리
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(0, -47, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d83a3a';            // 볏
      c.beginPath(); c.arc(-3, -57, 3.2, 0, Math.PI * 2); c.arc(1, -59, 3.2, 0, Math.PI * 2); c.arc(5, -57, 3.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0a030';            // 부리
      c.beginPath(); c.moveTo(9, -47); c.lineTo(17, -45); c.lineTo(9, -42); c.fill();
      c.fillStyle = '#22262e'; c.fillRect(3, -50, 3, 3);
    } else {
      // 악당: 쥐/기계 머리
      const E = M.ETYPES[f.type] || f;
      const ear = f.ear || (E && E.ear) || '#c8ccd4';
      const bodyC2 = f.body || (E && E.body) || '#9aa2ad';
      if (f.type === 'tank' || f.base === 'tank') {
        c.fillStyle = bodyC2;
        c.beginPath(); c.roundRect(-10, -56, 20, 13, 4); c.fill();
        c.fillStyle = '#ff5252'; c.fillRect(4, -52, 4, 3);
      } else {
        c.fillStyle = bodyC2;
        c.beginPath(); c.arc(0, -47, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = ear;
        c.beginPath(); c.arc(-6, -56, 4.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(5, -56, 4.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#22262e'; c.fillRect(4, -50, 3, 3);
      }
      if (f.boss) {
        c.fillStyle = '#ffd83d';
        c.beginPath();
        c.moveTo(-8, -58); c.lineTo(-5, -66); c.lineTo(-1, -59); c.lineTo(3, -67); c.lineTo(7, -58);
        c.fill();
      }
      // 체력바 (피해 입은 적)
      if (f.hp < f.maxHp && !down) {
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-11, -66, 22, 3);
        c.fillStyle = '#ff5a5a'; c.fillRect(-11, -66, 22 * Math.max(0, f.hp / f.maxHp), 3);
      }
    }
    c.restore();
  },
};
