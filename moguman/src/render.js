// render.js — 캔버스 2D 드로잉 (픽셀 스타일, 논리 320×240 정수 확대)
const M = window.MGM;

const EC = {   // 적 색상
  mouse:     { body: '#9aa2ad', ear: '#c8ccd4', eye: '#22262e' },
  fastmouse: { body: '#e0985a', ear: '#f0c090', eye: '#3a2410' },
  jumper:    { body: '#7ab86a', ear: '#a8dc98', eye: '#1e3a18' },
  bird:      { body: '#5da8e0', ear: '#8ec8f0', eye: '#102a40' },
  vacuum:    { body: '#4a4a58', ear: '#6a6a7c', eye: '#ff5252' },
};
const BOSS_BASE = { kingmouse: 'mouse', crow: 'bird', bigvacuum: 'vacuum', shadowcat: 'mouse', mouselord: 'fastmouse' };

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    // 2배 이상이면 정수 배율(픽셀 선명), 그 미만(폰 세로 등)은 소수 배율로 폭을 채움
    let s = Math.min(window.innerWidth / M.W, window.innerHeight / M.H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.8, s * 0.97);
    this.cv.style.width = M.W * s + 'px';
    this.cv.style.height = M.H * s + 'px';
  },

  addFx(x, y, text, color) { this.fx.push({ x, y, text, color: color || '#fff', t: 0 }); },

  draw(st, t) {
    const c = this.ctx, th = st.stage.theme;
    // 배경
    const g = c.createLinearGradient(0, 0, 0, M.H);
    g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
    c.fillStyle = g; c.fillRect(0, 0, M.W, M.H);
    // 배경 점 장식 (월드별 결정적 패턴)
    c.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 26; i++) {
      const dx = (i * 53 + st.stage.world * 17) % (M.W - 20) + 10;
      const dy = (i * 91 + st.stage.world * 31) % (M.FLOOR - 30) + 10;
      c.fillRect(dx, dy, 2, 2);
    }
    // 벽·바닥
    c.fillStyle = th.plat;
    c.fillRect(0, 0, M.WALL, M.H);
    c.fillRect(M.W - M.WALL, 0, M.WALL, M.H);
    c.fillRect(0, M.FLOOR, M.W, M.H - M.FLOOR);
    c.fillStyle = th.platTop;
    c.fillRect(0, M.FLOOR, M.W, 3);
    c.fillRect(M.WALL - 2, 0, 2, M.H); c.fillRect(M.W - M.WALL, 0, 2, M.H);
    // 플랫폼
    for (const p of st.stage.platforms) {
      c.fillStyle = th.plat; c.fillRect(p.x, p.y, p.w, M.PLAT_H);
      c.fillStyle = th.platTop; c.fillRect(p.x, p.y, p.w, 2);
    }
    // 아이템
    for (const it of st.items) this.drawItem(it, t);
    // 적
    for (const e of st.enemies) this.drawEnemy(e, t);
    // 보스
    if (st.boss) this.drawBoss(st.boss, t);
    if (st.bossBall) this.drawBallShape(st.bossBall.x, st.bossBall.y - st.bossBall.r, st.bossBall.r, st.bossBall.t * 8);
    // 털 탄환
    for (const pf of st.puffs) this.drawPuff(pf.x, pf.y - pf.h / 2, 4, t);
    // 플레이어
    this.drawPlayer(st.player, t);
    // 점수 팝업
    c.textAlign = 'center'; c.font = 'bold 9px sans-serif';
    for (const f of this.fx) {
      f.t += 0.016;
      c.globalAlpha = Math.max(0, 1 - f.t / 0.9);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y - 14 - f.t * 22);
      c.globalAlpha = 1;
    }
    this.fx = this.fx.filter((f) => f.t < 0.9);
    // 보스 HP 바
    if (st.boss) {
      const b = st.boss;
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(60, 8, 200, 8);
      c.fillStyle = b.hitT > 0 ? '#fff' : '#ff5252';
      c.fillRect(61, 9, 198 * (b.hp / b.hpMax), 6);
    }
  },

  drawPlayer(pl, t) {
    const c = this.ctx;
    if (pl.invul > 0 && Math.floor(t * 14) % 3 === 2) return;   // 무적 점멸
    const bob = pl.onGround && pl.vx !== 0 ? Math.abs(Math.sin(t * 11)) * 2 : 0;
    const h = 20, y = pl.y - h - bob;
    c.save();
    c.translate(pl.x, 0);
    if (pl.dir < 0) c.scale(-1, 1);
    if (this.mogu) {
      const a = this.mogu.width / this.mogu.height, w = h * a;
      c.drawImage(this.mogu, -w / 2, y, w, h);
    } else {
      c.fillStyle = '#e8dcc8'; c.fillRect(-7, y, 14, h);
    }
    // 발 (걷기 애니메이션)
    c.fillStyle = '#d8c8b0';
    const step = pl.vx !== 0 ? Math.sin(t * 11) * 3 : 0;
    c.fillRect(-6 + step, pl.y - 3 - bob, 5, 3);
    c.fillRect(2 - step, pl.y - 3 - bob, 5, 3);
    c.restore();
    if (pl.invul > 0) { c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(pl.x, pl.y - 10, 14, 0, Math.PI * 2); c.stroke(); }
  },

  drawPuff(x, y, r, t) {
    const c = this.ctx;
    c.fillStyle = 'rgba(255,255,255,.92)';
    for (let i = 0; i < 4; i++) {
      const a = t * 6 + i * 1.57;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#f0ece0';
    c.beginPath(); c.arc(x, y, r * 0.55, 0, Math.PI * 2); c.fill();
  },

  // 완성 털뭉치 공통 셰이프
  drawBallShape(x, yTop, r, spin) {
    const c = this.ctx;
    const cy = yTop + r;
    c.fillStyle = '#f2eee2';
    c.beginPath(); c.arc(x, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + spin * 0.35;
      c.beginPath(); c.arc(x + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72, r * 0.34, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#cfc8b4'; c.lineWidth = 1;
    c.beginPath(); c.arc(x, cy, r * 0.55, spin, spin + 4.2); c.stroke();
    // 귀 끝 살짝
    c.fillStyle = '#b8ae96';
    c.beginPath(); c.arc(x - r * 0.4, cy - r * 0.95, r * 0.14, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + r * 0.4, cy - r * 0.95, r * 0.14, 0, Math.PI * 2); c.fill();
  },

  drawEnemy(e, t) {
    const c = this.ctx;
    if (e.state === 'ball' || e.state === 'roll') {
      this.drawBallShape(e.x, e.y - e.h, e.w / 2, e.state === 'roll' ? t * 14 * e.rollDir : Math.sin(t * 3) * 0.2);
      return;
    }
    const col = EC[e.type];
    const wob = e.state === 'stun' || e.state === 'stun2' ? Math.sin(t * 26) * 1.5 : 0;
    c.save();
    c.translate(e.x + wob, e.y);
    if (e.dir < 0) c.scale(-1, 1);
    const w = e.P.w, h = e.P.h;
    if (e.angry) { c.fillStyle = 'rgba(255,60,60,.35)'; c.beginPath(); c.arc(0, -h / 2, w * 0.8, 0, Math.PI * 2); c.fill(); }
    if (e.type === 'vacuum') {
      c.fillStyle = col.body;
      c.beginPath(); c.roundRect(-w / 2, -h, w, h, 4); c.fill();
      c.fillStyle = col.eye;
      c.fillRect(w / 2 - 5, -h + 2, 3, 2);
      c.fillStyle = col.ear; c.fillRect(-w / 2 + 2, -2, w - 4, 2);
    } else if (e.type === 'bird' && !e.grounded) {
      c.fillStyle = col.body;
      c.beginPath(); c.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
      const flap = Math.sin(t * 12) * 4;
      c.fillStyle = col.ear;
      c.beginPath(); c.moveTo(-2, -h / 2); c.lineTo(-w / 2 - 4, -h / 2 - flap); c.lineTo(-2, -h / 2 + 3); c.fill();
      c.fillStyle = '#f0b040'; c.beginPath(); c.moveTo(w / 2, -h / 2); c.lineTo(w / 2 + 4, -h / 2 + 1); c.lineTo(w / 2, -h / 2 + 3); c.fill();
      c.fillStyle = col.eye; c.fillRect(w / 2 - 5, -h / 2 - 2, 2, 2);
    } else {
      // 쥐 계열 (착지한 새 포함)
      c.fillStyle = col.body;
      c.beginPath(); c.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.ear;
      c.beginPath(); c.arc(-w * 0.15, -h + 1, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(w * 0.2, -h + 1, 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col.body; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-w / 2, -3); c.quadraticCurveTo(-w / 2 - 5, -6 + Math.sin(t * 7) * 2, -w / 2 - 7, -2); c.stroke();
      c.fillStyle = col.eye; c.fillRect(w / 2 - 5, -h + 4, 2, 2);
    }
    c.restore();
    // 부분 감김 털 표시
    if (e.fur > 0) {
      const fr = (e.fur / e.P.furMax) * (e.P.w / 2 + 3) + 3;
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 2 + e.fur * 2; i++) {
        const a = (i / (2 + e.fur * 2)) * Math.PI * 2 + t * 2;
        c.beginPath();
        c.arc(e.x + Math.cos(a) * fr * 0.6, e.y - e.h / 2 + Math.sin(a) * fr * 0.5, 3 + e.fur, 0, Math.PI * 2);
        c.fill();
      }
    }
  },

  drawBoss(b, t) {
    const c = this.ctx;
    const base = BOSS_BASE[b.type], col = EC[base];
    c.save();
    c.translate(b.x, b.y);
    if (b.dir < 0) c.scale(-1, 1);
    if (b.hitT > 0) c.globalAlpha = 0.55;
    const w = b.w, h = b.h;
    const dark = b.type === 'shadowcat';
    // 몸통
    c.fillStyle = dark ? '#1a1424' : col.body;
    c.beginPath(); c.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
    // 귀
    c.fillStyle = dark ? '#2a2038' : col.ear;
    c.beginPath(); c.arc(-w * 0.22, -h + 3, w * 0.14, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w * 0.18, -h + 3, w * 0.14, 0, Math.PI * 2); c.fill();
    // 눈
    c.fillStyle = dark ? '#ffd83d' : col.eye;
    c.fillRect(w * 0.16, -h * 0.72, 4, 4);
    c.fillRect(w * 0.34, -h * 0.72, 4, 4);
    // 왕관 (왕쥐·쥐마왕)
    if (b.type === 'kingmouse' || b.type === 'mouselord') {
      c.fillStyle = '#ffd83d';
      c.beginPath();
      c.moveTo(-w * 0.2, -h - 1); c.lineTo(-w * 0.12, -h - 9); c.lineTo(-w * 0.02, -h - 2);
      c.lineTo(w * 0.08, -h - 10); c.lineTo(w * 0.18, -h - 1);
      c.fill();
    }
    c.restore();
  },

  drawItem(it, t) {
    const c = this.ctx;
    const bob = Math.sin(t * 5 + it.x) * 1.5;
    if (it.kind === 'fish') {
      c.fillStyle = '#5db8ff';
      c.beginPath(); c.ellipse(it.x, it.y - 5 + bob, 6, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(it.x + 5, it.y - 5 + bob); c.lineTo(it.x + 9, it.y - 8 + bob); c.lineTo(it.x + 9, it.y - 2 + bob); c.fill();
      c.fillStyle = '#102a40'; c.fillRect(it.x - 4, it.y - 6 + bob, 1.5, 1.5);
    } else {
      c.save();
      c.translate(it.x, it.y - 5 + bob); c.rotate(-0.5);
      c.fillStyle = '#f0e0c8'; c.fillRect(-6, -2.5, 12, 5);
      c.fillStyle = '#e08830'; c.fillRect(-6, -2.5, 4, 5);
      c.fillStyle = '#c86820'; c.fillRect(4, -1.5, 3, 3);
      c.restore();
    }
  },
};
