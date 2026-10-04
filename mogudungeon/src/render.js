// render.js — 벨트스크롤 캔버스 렌더 (480×270): 던전 배경·모구 파티 4직업·적/보스·마법·HUD
const M = window.MDN;
const W = 480, H = 270;

M.Render = {
  cv: null, ctx: null, face: null, fx: [], texts: [], shake: 0, flash: 0,

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();                       // 모구 얼굴 사진 (전사 모구 머리 · HUD 초상)
    img.onload = () => { this.face = img; };
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

  reset() { this.fx = []; this.texts = []; this.shake = 0; this.flash = 0; },
  sy(z) { return M.FLOOR_Y + z * M.FLOOR_H; },
  addFx(kind, x, z, extra) { this.fx.push(Object.assign({ kind, x, z, t: 0, dur: 0.35 }, extra || {})); },
  addText(x, z, text, color, dy) { this.texts.push({ x, z, text, color: color || '#fff', t: 0, dy: dy || 0 }); if (this.texts.length > 16) this.texts.shift(); },

  // ── 머리 4종 (시리즈 캐릭터) — 원점 = 머리 중심 ──
  drawHead(c, who, r) {
    switch (who) {
      case 'mogu':
        c.save(); c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.closePath(); c.fillStyle = '#f0e6d8'; c.fill(); c.clip();
        if (this.face) { const a = this.face.width / this.face.height; c.drawImage(this.face, -r * 1.12 * a, -r * 1.05, r * 2.24 * a, r * 2.24); }
        c.restore();
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.stroke();
        break;
      case 'kko':                                        // 꼬꼬: 노란 얼굴 + 빨간 볏 + 주황 부리
        c.fillStyle = '#f5c531'; c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill();
        c.fillStyle = '#e8453c'; c.beginPath(); c.arc(-4, -r + 1, 3.5, 0, 6.28); c.arc(0, -r - 1, 4, 0, 6.28); c.arc(4, -r + 1, 3.5, 0, 6.28); c.fill();
        c.fillStyle = '#f08a1e'; c.beginPath(); c.moveTo(r - 3, -1); c.lineTo(r + 7, 2); c.lineTo(r - 3, 5); c.closePath(); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(r * 0.35, -3, 1.8, 0, 6.28); c.fill();
        break;
      case 'jjik':                                       // 찍찍: 회색 얼굴 + 큰 둥근 귀 + 분홍 코
        c.fillStyle = '#a8a8b8'; c.beginPath(); c.arc(-r * 0.7, -r * 0.7, r * 0.5, 0, 6.28); c.arc(r * 0.7, -r * 0.7, r * 0.5, 0, 6.28); c.fill();
        c.fillStyle = '#f0b0c0'; c.beginPath(); c.arc(-r * 0.7, -r * 0.7, r * 0.28, 0, 6.28); c.arc(r * 0.7, -r * 0.7, r * 0.28, 0, 6.28); c.fill();
        c.fillStyle = '#a8a8b8'; c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(r * 0.35, -2, 1.8, 0, 6.28); c.fill();
        c.fillStyle = '#f07090'; c.beginPath(); c.arc(r - 1, 2, 2.2, 0, 6.28); c.fill();
        break;
      case 'mong':                                       // 몽이: 갈색 얼굴 + 늘어진 귀 + 검은 코
        c.fillStyle = '#c8935a'; c.beginPath(); c.ellipse(-r * 0.85, 0, r * 0.32, r * 0.7, 0.2, 0, 6.28); c.ellipse(r * 0.85, 0, r * 0.32, r * 0.7, -0.2, 0, 6.28); c.fill();
        c.fillStyle = '#e8c08a'; c.beginPath(); c.arc(0, 0, r, 0, 6.28); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(r * 0.5, 2, r * 0.42, r * 0.36, 0, 0, 6.28); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(r * 0.35, -3, 1.8, 0, 6.28); c.fill();
        c.beginPath(); c.arc(r * 0.72, 2, 2.4, 0, 6.28); c.fill();
        break;
    }
  },

  // ── 주인공 (직업별 장비) — 원점 = 발끝 ──
  drawHero(c, st, t) {
    const p = st.p, C = M.CLASSES[st.cls];
    if (p.inv > 0 && p.state !== 'dead' && Math.floor(t * 20) % 2 === 0) return;
    c.save();
    c.translate(p.x - st.camX, this.sy(p.z));
    c.scale(p.face, 1);
    if (p.state === 'dead') { const k = Math.min(1, st.endT / 0.5); c.rotate(-k * 1.5); c.translate(0, k * 6); }
    const walking = p.state === 'walk';
    const bob = walking ? Math.abs(Math.sin(p.walk)) * 2 : Math.sin(t * 3) * 0.7;
    const atkK = p.state === 'atk' ? 1 - p.st / 0.28 : -1;
    const skK = p.state === 'skill' ? 1 - p.st / 0.42 : -1;
    // 다리
    c.fillStyle = '#3a2a24';
    const lg = walking ? Math.sin(p.walk) * 5 : 0;
    c.fillRect(-7 + lg, -12, 6, 12); c.fillRect(1 - lg, -12, 6, 12);
    // 몸통 (직업색 갑옷/로브)
    c.translate(0, -bob);
    if (p.state === 'hurt') c.rotate(-0.25);
    c.fillStyle = C.color;
    c.beginPath(); c.roundRect(-10, -34, 20, 24, 5); c.fill();
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-10, -16, 20, 4);            // 벨트
    if (st.cls === 'fighter') { c.fillStyle = '#8a1e2a'; c.beginPath(); c.moveTo(-10, -32); c.lineTo(-20, -6); c.lineTo(-8, -12); c.closePath(); c.fill(); }   // 망토
    if (st.cls === 'cleric') { c.fillStyle = '#fff'; c.fillRect(-3, -32, 6, 18); c.fillRect(-8, -27, 16, 5); }  // 십자
    // 팔 + 무기
    c.save();
    c.translate(6, -28);
    let ang = 0.5;
    if (atkK >= 0) ang = p.combo === 3 ? -1.3 + atkK * 2.6 : -0.9 + atkK * 2.2;
    if (skK >= 0) ang = st.cls === 'fighter' ? skK * 6.28 : -1.4 + skK * 1.2;
    c.rotate(ang);
    c.fillStyle = '#e8c9a0'; c.fillRect(-2, 0, 5, 12);                       // 팔
    c.translate(0, 12);
    switch (st.cls) {
      case 'fighter': c.fillStyle = '#d8dce8'; c.beginPath(); c.moveTo(-2, 0); c.lineTo(2, 0); c.lineTo(1, 26); c.lineTo(-1, 26); c.closePath(); c.fill(); c.fillStyle = '#ffd83d'; c.fillRect(-6, -2, 12, 3); break;
      case 'mage': c.fillStyle = '#8a5a2a'; c.fillRect(-1.5, -14, 3, 32); c.fillStyle = skK >= 0 ? '#ffb347' : '#5ad0ff'; c.beginPath(); c.arc(0, -16, 5, 0, 6.28); c.fill(); break;
      case 'thief': c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(-2, 0); c.lineTo(2, 0); c.lineTo(0, 14); c.closePath(); c.fill(); c.fillStyle = '#4a3a2a'; c.fillRect(-3, -3, 6, 3); break;
      case 'cleric': c.fillStyle = '#8a5a2a'; c.fillRect(-1.5, 0, 3, 18); c.fillStyle = '#b8bcc8'; c.beginPath(); c.arc(0, 20, 6, 0, 6.28); c.fill(); break;
    }
    c.restore();
    // 머리 + 직업 모자
    c.translate(0, -44);
    this.drawHead(c, C.who, 11);
    if (st.cls === 'mage') { c.fillStyle = '#2a4aa8'; c.beginPath(); c.moveTo(-13, -7); c.lineTo(13, -7); c.lineTo(2, -30); c.closePath(); c.fill(); c.fillStyle = '#ffd83d'; c.beginPath(); c.arc(4, -22, 2, 0, 6.28); c.fill(); }
    if (st.cls === 'thief') { c.fillStyle = '#1e6a3a'; c.beginPath(); c.arc(0, -3, 12.5, Math.PI, 0); c.lineTo(12, 4); c.lineTo(-12, 4); c.closePath(); c.fill(); }
    if (st.cls === 'fighter') { c.fillStyle = '#c8384a'; c.fillRect(-11, -8, 22, 4); }
    if (st.cls === 'cleric') { c.strokeStyle = '#ffe680'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -15, 9, 3, 0, 0, 6.28); c.stroke(); }
    c.restore();
  },

  // ── 적 — 원점 = 발끝 ──
  drawEnemy(c, e, st, t) {
    const K = M.ENEMY[e.kind];
    c.save();
    c.translate(e.x - st.camX, this.sy(e.z));
    if (e.state === 'dead') { c.globalAlpha = Math.max(0, e.st / 0.6); c.rotate(e.face * 1.4 * (1 - e.st / 0.6)); }
    c.scale(e.face, 1);
    if (e.state === 'kd') { c.rotate(-1.45); c.translate(-6, 10); }
    if (e.state === 'windup') c.rotate(-0.2);
    if (e.state === 'attack') c.rotate(0.28);
    const fl = e.flash > 0;
    const walk = e.state === 'walk' ? Math.sin(e.walk) * 4 : 0;
    const col = (base) => (fl ? '#fff' : base);
    switch (e.kind) {
      case 'kobold': {
        c.fillStyle = col('#8a6a48'); c.fillRect(-6 + walk, -9, 5, 9); c.fillRect(1 - walk, -9, 5, 9);
        c.beginPath(); c.ellipse(0, -20, 10, 13, 0, 0, 6.28); c.fill();
        c.beginPath(); c.arc(0, -36, 8, 0, 6.28); c.fill();
        c.beginPath(); c.moveTo(-8, -40); c.lineTo(-10, -50); c.lineTo(-2, -42); c.closePath(); c.moveTo(8, -40); c.lineTo(10, -50); c.lineTo(2, -42); c.closePath(); c.fill();
        c.fillStyle = '#ff5050'; c.beginPath(); c.arc(4, -37, 1.6, 0, 6.28); c.fill();
        c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(8, -28); c.lineTo(22, -40); c.stroke();
        c.fillStyle = '#c8ccd8'; c.beginPath(); c.moveTo(20, -42); c.lineTo(27, -46); c.lineTo(24, -38); c.closePath(); c.fill();
        break;
      }
      case 'skeleton': {
        c.strokeStyle = col('#e8e8e0'); c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-5 + walk, 0); c.lineTo(-3, -14); c.moveTo(5 - walk, 0); c.lineTo(3, -14); c.stroke();
        c.beginPath(); c.moveTo(0, -14); c.lineTo(0, -34); c.stroke();
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-7, -30 + i * 5); c.lineTo(7, -30 + i * 5); c.stroke(); }
        c.beginPath(); c.moveTo(-8, -32); c.lineTo(-14, -20); c.moveTo(8, -32); c.lineTo(20, -30); c.stroke();
        c.fillStyle = col('#f0f0e8'); c.beginPath(); c.arc(0, -42, 8, 0, 6.28); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(-3, -43, 2, 0, 6.28); c.arc(3, -43, 2, 0, 6.28); c.fill(); c.fillRect(-4, -37, 8, 2);
        c.fillStyle = '#b8bcc8'; c.beginPath(); c.moveTo(20, -30); c.lineTo(30, -44); c.lineTo(24, -28); c.closePath(); c.fill();
        c.lineCap = 'butt';
        break;
      }
      case 'orc': {
        c.fillStyle = col('#4a7a3a'); c.fillRect(-9 + walk, -12, 8, 12); c.fillRect(2 - walk, -12, 8, 12);
        c.beginPath(); c.roundRect(-15, -40, 30, 30, 8); c.fill();
        c.fillStyle = '#6a4a2a'; c.fillRect(-15, -18, 30, 5);
        c.fillStyle = col('#5a8a48'); c.beginPath(); c.arc(0, -48, 11, 0, 6.28); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-6, -42); c.lineTo(-4, -48); c.lineTo(-2, -42); c.moveTo(6, -42); c.lineTo(4, -48); c.lineTo(2, -42); c.fill();
        c.fillStyle = '#ff5050'; c.beginPath(); c.arc(5, -50, 2, 0, 6.28); c.fill();
        c.fillStyle = '#5a3a1a'; c.save(); c.translate(14, -34); c.rotate(e.state === 'attack' ? 1.2 : -0.5); c.fillRect(-2, -26, 4, 30); c.fillStyle = '#8a8a8a'; c.beginPath(); c.arc(0, -26, 6, 0, 6.28); c.fill(); c.restore();
        break;
      }
      case 'shaman': {
        c.fillStyle = col('#6a3a9a'); c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.lineTo(6, -34); c.lineTo(-6, -34); c.closePath(); c.fill();
        c.fillStyle = col('#a8a8b8'); c.beginPath(); c.arc(0, -40, 8, 0, 6.28); c.fill();
        c.beginPath(); c.arc(-6, -46, 3.5, 0, 6.28); c.arc(6, -46, 3.5, 0, 6.28); c.fill();
        c.fillStyle = '#ff5050'; c.beginPath(); c.arc(4, -41, 1.6, 0, 6.28); c.fill();
        c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, -20); c.lineTo(16, -52); c.stroke();
        c.fillStyle = e.state === 'windup' ? '#ffb347' : '#c04cff'; c.beginPath(); c.arc(16, -54, 4 + (e.state === 'windup' ? 2 : 0), 0, 6.28); c.fill();
        break;
      }
      case 'bat': {
        c.translate(0, -30 + Math.sin(t * 8 + e.wob) * 4);
        const flap = Math.sin(t * 18 + e.wob) * 0.6;
        c.fillStyle = col('#2a2434');
        for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(14, -12 - flap * 10, 24, -2 + flap * 8); c.quadraticCurveTo(14, 6, 4, 6); c.closePath(); c.fill(); c.restore(); }
        c.beginPath(); c.ellipse(0, 0, 6, 8, 0, 0, 6.28); c.fill();
        c.fillStyle = '#ff5050'; c.beginPath(); c.arc(-2, -2, 1.4, 0, 6.28); c.arc(2, -2, 1.4, 0, 6.28); c.fill();
        break;
      }
      default: {                                         // 보스 5종: 큰 몸 + 이모지 얼굴 + 왕관
        const r = e.r;
        const colors = { ogre: '#6a7a3a', lich: '#2a1a3a', shamanking: '#4a2a7a', orcchief: '#4a6a2a', dragon: '#5a1a1a' };
        c.fillStyle = col(colors[e.kind] || '#555');
        // 다리 · 몸통(짧은 토르소) · 그 위에 큰 이모지 머리 · 왕관
        c.fillRect(-r * 0.5 + walk, -r * 0.5, r * 0.35, r * 0.5); c.fillRect(r * 0.15 - walk, -r * 0.5, r * 0.35, r * 0.5);
        c.beginPath(); c.roundRect(-r * 0.8, -r * 1.35, r * 1.6, r * 0.95, r * 0.25); c.fill();
        c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-r * 0.8, -r * 0.62, r * 1.6, r * 0.14);
        c.save(); c.translate(r * 0.85, -r * 1.1); c.rotate(e.state === 'attack' ? 1.1 : -0.4); c.fillStyle = col(colors[e.kind] || '#555'); c.fillRect(-r * 0.12, 0, r * 0.24, r * 0.7); c.restore();   // 팔
        if (e.kind === 'dragon') {
          const flap = Math.sin(t * 6) * 0.3;
          for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.fillStyle = col('#8a2a2a'); c.beginPath(); c.moveTo(r * 0.5, -r * 1.3); c.quadraticCurveTo(r * 1.4, -r * 2.6 - flap * 30, r * 2.1, -r * 1.2); c.lineTo(r * 0.7, -r * 0.7); c.closePath(); c.fill(); c.restore(); }
        }
        const hy = -r * 1.35 - r * 0.62;                 // 머리 중심
        c.fillStyle = col(colors[e.kind] || '#555'); c.beginPath(); c.arc(0, hy, r * 0.66, 0, 6.28); c.fill();
        c.font = `${Math.round(r * 1.05)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.save(); c.translate(0, hy); c.scale(e.face, 1); c.fillStyle = '#fff'; c.fillText(K.emoji, 0, 2); c.restore();
        c.textBaseline = 'alphabetic';
        const cy = hy - r * 0.6;
        c.fillStyle = '#ffd83d'; c.beginPath(); c.moveTo(-10, cy); c.lineTo(-7, cy - 12); c.lineTo(-3, cy); c.lineTo(0, cy - 14); c.lineTo(3, cy); c.lineTo(7, cy - 12); c.lineTo(10, cy); c.closePath(); c.fill();
        if (e.state === 'windup') { c.fillStyle = 'rgba(255,80,80,.5)'; c.beginPath(); c.arc(r * 0.9, -r * 0.8, 10 + Math.sin(t * 30) * 3, 0, 6.28); c.fill(); }
      }
    }
    c.restore();
    // HP 바 (보스는 상단 HUD에)
    if (!e.boss && e.hp < e.maxHp && e.state !== 'dead') {
      const sx = e.x - st.camX, sy = this.sy(e.z) - (e.kind === 'bat' ? 50 : e.kind === 'orc' ? 66 : 56);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(sx - 14, sy, 28, 4);
      c.fillStyle = '#ff5252'; c.fillRect(sx - 13, sy + 1, 26 * Math.max(0, e.hp / e.maxHp), 2);
    }
  },

  drawChest(c, ch, st, t) {
    c.save(); c.translate(ch.x - st.camX, this.sy(ch.z));
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 1, 16, 5, 0, 0, 6.28); c.fill();
    c.fillStyle = '#7a4a1e'; c.fillRect(-14, -14, 28, 14);
    c.fillStyle = '#ffd83d'; c.fillRect(-14, -8, 28, 3);
    if (ch.opened) { c.fillStyle = '#5a3210'; c.fillRect(-14, -26, 28, 12); c.fillStyle = '#2a1a08'; c.fillRect(-12, -14, 24, 3); }
    else { c.fillStyle = '#9a5a26'; c.beginPath(); c.roundRect(-14, -22, 28, 9, 4); c.fill(); c.fillStyle = '#ffd83d'; c.fillRect(-3, -18, 6, 6); if (Math.floor(t * 2) % 2) { c.fillStyle = '#fff'; c.fillRect(8, -24, 2, 2); } }
    c.restore();
  },

  drawItem(c, it, st, t) {
    const I = M.ITEMS[it.kind];
    c.save(); c.translate(it.x - st.camX, this.sy(it.z) - 10 + Math.sin(t * 4 + it.id) * 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 12, 9, 3, 0, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(0, 0, 10, 0, 6.28); c.fill();
    c.strokeStyle = '#ffd83d'; c.lineWidth = 2; c.stroke();
    c.font = '12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(I.emoji, 0, 1);
    c.textBaseline = 'alphabetic';
    c.restore();
  },

  drawBullet(c, b, st, t) {
    const sx = b.x - st.camX, sy = this.sy(b.z) - 26;
    c.save(); c.translate(sx, sy);
    switch (b.kind) {
      case 'fireball': c.fillStyle = 'rgba(255,120,40,.5)'; c.beginPath(); c.ellipse(-Math.sign(b.vx) * 10, 0, 16, 7, 0, 0, 6.28); c.fill(); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(0, 0, 8, 0, 6.28); c.fill(); c.fillStyle = '#fff2a0'; c.beginPath(); c.arc(0, 0, 4, 0, 6.28); c.fill(); break;
      case 'dagger': c.rotate(t * 25); c.fillStyle = '#d8dce8'; c.beginPath(); c.moveTo(-8, -2); c.lineTo(8, 0); c.lineTo(-8, 2); c.closePath(); c.fill(); break;
      case 'fire': c.fillStyle = '#c04cff'; c.beginPath(); c.arc(0, 0, 6, 0, 6.28); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 2.5, 0, 6.28); c.fill(); break;
      case 'bone': c.rotate(t * 12); c.strokeStyle = '#f0f0e8'; c.lineWidth = 3; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke(); c.fillStyle = '#f0f0e8'; c.beginPath(); c.arc(-7, -2, 2.5, 0, 6.28); c.arc(-7, 2, 2.5, 0, 6.28); c.arc(7, -2, 2.5, 0, 6.28); c.arc(7, 2, 2.5, 0, 6.28); c.fill(); break;
      case 'breath': { const d = Math.sign(b.vx); c.fillStyle = 'rgba(255,90,30,.75)'; c.beginPath(); c.moveTo(-d * 28, 0); c.lineTo(d * 24, -18 - Math.sin(t * 30) * 3); c.lineTo(d * 30, 0); c.lineTo(d * 24, 18); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,220,80,.8)'; c.beginPath(); c.moveTo(-d * 20, 0); c.lineTo(d * 14, -8); c.lineTo(d * 18, 0); c.lineTo(d * 14, 8); c.closePath(); c.fill(); break; }
    }
    c.restore();
  },

  // ── 배경 (테마별 원경 + 바닥) ──
  drawBackground(c, st, t) {
    const T = M.THEMES[st.stage.theme];
    const g = c.createLinearGradient(0, 0, 0, M.FLOOR_Y);
    g.addColorStop(0, T.sky0); g.addColorStop(1, T.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, M.FLOOR_Y);
    const px = -st.camX * 0.35;                         // 원경 패럴랙스
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = -1; i < 8; i++) {
      const x = ((i * 90 + px) % 630 + 630) % 630 - 60;
      switch (T.prop) {
        case 'tree': c.beginPath(); c.moveTo(x, M.FLOOR_Y); c.lineTo(x + 22, 40 + (i % 3) * 12); c.lineTo(x + 44, M.FLOOR_Y); c.closePath(); c.fill(); break;
        case 'stalac': c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 14, 60 + (i % 3) * 20); c.lineTo(x + 28, 0); c.closePath(); c.fill(); c.fillRect(x + 30, M.FLOOR_Y - 30 - (i % 2) * 20, 18, 40); break;
        case 'grave': c.beginPath(); c.roundRect(x, M.FLOOR_Y - 34, 22, 36, 8); c.fill(); if (i % 2) { c.fillRect(x + 40, M.FLOOR_Y - 46, 6, 46); c.fillRect(x + 32, M.FLOOR_Y - 36, 22, 6); } break;
        case 'pillar': c.fillRect(x, 20, 26, M.FLOOR_Y); c.fillRect(x - 6, 20, 38, 8); break;
        case 'bars': c.fillRect(x, 30, 5, M.FLOOR_Y); c.fillRect(x + 14, 30, 5, M.FLOOR_Y); c.fillRect(x + 28, 30, 5, M.FLOOR_Y); break;
        case 'bones': c.beginPath(); c.arc(x + 14, M.FLOOR_Y - 14, 14, Math.PI, 0); c.fill(); c.fillRect(x + 36, M.FLOOR_Y - 30, 5, 30); break;
      }
    }
    if (T.prop === 'lair') { c.fillStyle = 'rgba(255,90,30,.15)'; c.fillRect(0, 100, W, 58); }
    // 횃불 (모든 테마) — 벽 위쪽에 줄지어 흔들리는 불
    for (let i = 0; i < 4; i++) {
      const x = ((i * 130 + 40 - st.camX * 0.7) % 520 + 520) % 520 - 20;
      c.fillStyle = '#5a3a1a'; c.fillRect(x - 2, 110, 4, 18);
      c.fillStyle = `rgba(255,${150 + Math.sin(t * 9 + i) * 40 | 0},50,.9)`; c.beginPath(); c.ellipse(x, 104, 4, 7 + Math.sin(t * 11 + i) * 2, 0, 0, 6.28); c.fill();
    }
    // 바닥
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, T.floor0); fg.addColorStop(1, T.floor1);
    c.fillStyle = fg; c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
    for (let i = -1; i < 12; i++) { const x = ((i * 48 - st.camX) % 528 + 528) % 528 - 24; c.beginPath(); c.moveTo(x, M.FLOOR_Y); c.lineTo(x - 30, H); c.stroke(); }
    for (let j = 0; j < 4; j++) { const y = M.FLOOR_Y + j * 28; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, M.FLOOR_Y, W, 2);
  },

  drawHud(c, st, t) {
    const p = st.p, C = M.CLASSES[st.cls];
    // 초상 + HP/MP
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.roundRect(6, 6, 168, 40, 8); c.fill();
    c.save(); c.translate(24, 26); this.drawHead(c, C.who, 12); c.restore();
    c.font = 'bold 10px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.fillText(`${C.name} · LV${p.level}`, 44, 16);
    c.fillStyle = '#333'; c.fillRect(44, 20, 122, 8); c.fillStyle = p.hp < p.maxHp * 0.3 ? '#ff5252' : '#58c85c'; c.fillRect(45, 21, 120 * Math.max(0, p.hp / p.maxHp), 6);
    c.fillStyle = '#333'; c.fillRect(44, 30, 122, 6); c.fillStyle = '#4c9cff'; c.fillRect(45, 31, 120 * (p.mp / M.MAX_MP), 4);
    c.fillStyle = '#333'; c.fillRect(44, 38, 122, 3); c.fillStyle = '#ffd83d'; c.fillRect(45, 39, 120 * Math.min(1, p.exp / M.expNeed(p.level)), 1);
    c.fillStyle = '#fff'; c.font = 'bold 8px sans-serif';
    c.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, 48, 27); c.fillText(`${C.skill.emoji}${C.skill.mp}`, 140, 36);
    // 우상단: 금화 · 스테이지 · 구간
    c.textAlign = 'right'; c.font = 'bold 13px sans-serif'; c.fillStyle = '#ffd83d';
    c.fillText(`💰 ${st.gold.toLocaleString()}`, W - 8, 18);
    c.font = 'bold 10px sans-serif'; c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText(`${st.stage.name} · ${st.section + 1}/${st.sections} · ${M.DIFFS[st.diff].name}`, W - 8, 32);
    // 보스 HP
    const boss = st.enemies.find((e) => e.boss && e.state !== 'dead');
    if (boss) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(120, 50, 240, 12);
      c.fillStyle = '#ff5252'; c.fillRect(122, 52, 236 * Math.max(0, boss.hp / boss.maxHp), 8);
      c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.fillText(`${M.ENEMY[boss.kind].emoji} ${M.ENEMY[boss.kind].name}`, W / 2, 60);
    }
    // 전진 화살표
    if (st.gateOpen && st.phase === 'play' && Math.floor(t * 3) % 2 === 0) {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'right'; c.fillStyle = '#ffd83d';
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4;
      c.strokeText('GO ➡', W - 12, 150); c.fillText('GO ➡', W - 12, 150);
    }
    c.textAlign = 'left';
  },

  draw(st, t, dt) {
    const c = this.ctx;
    c.save();
    if (this.shake > 0) { this.shake -= dt; c.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); }
    this.drawBackground(c, st, t);

    // 깊이순 정렬 그리기 (상자·아이템·적·주인공)
    const list = [];
    for (const ch of st.props) list.push({ z: ch.z, f: () => this.drawChest(c, ch, st, t) });
    for (const it of st.items) list.push({ z: it.z, f: () => this.drawItem(c, it, st, t) });
    for (const e of st.enemies) list.push({ z: e.z, f: () => this.drawEnemy(c, e, st, t) });
    list.push({ z: st.p.z, f: () => this.drawHero(c, st, t) });
    list.sort((a, b) => a.z - b.z);
    // 그림자 먼저
    c.fillStyle = 'rgba(0,0,0,.28)';
    for (const e of st.enemies) if (e.state !== 'dead') { c.beginPath(); c.ellipse(e.x - st.camX, this.sy(e.z) + 1, e.r + 2, 4, 0, 0, 6.28); c.fill(); }
    if (st.p.state !== 'dead') { c.beginPath(); c.ellipse(st.p.x - st.camX, this.sy(st.p.z) + 1, 14, 4, 0, 0, 6.28); c.fill(); }
    for (const o of list) o.f();
    for (const b of st.bullets) this.drawBullet(c, b, st, t);

    // FX
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const f of this.fx) {
      f.t += dt;
      const k = f.t / f.dur, sx = f.x - st.camX, sy = this.sy(f.z) - 26;
      c.globalAlpha = 1 - k;
      switch (f.kind) {
        case 'slash': c.strokeStyle = f.color || '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(sx, sy, 18 + k * 10, -1.1 * f.dir + (f.dir > 0 ? 0 : Math.PI), 1.1 * f.dir + (f.dir > 0 ? 0 : Math.PI), f.dir < 0); c.stroke(); break;
        case 'spark': c.fillStyle = f.color || '#fff2a0'; for (let i = 0; i < 5; i++) { const a = i * 1.26 + k * 2; c.beginPath(); c.arc(sx + Math.cos(a) * k * 22, sy + Math.sin(a) * k * 22, 3 - k * 2, 0, 6.28); c.fill(); } break;
        case 'ring': c.strokeStyle = f.color || '#ffd83d'; c.lineWidth = 4; c.beginPath(); c.ellipse(sx, this.sy(f.z), (f.r || 60) * k, (f.r || 60) * k * 0.45, 0, 0, 6.28); c.stroke(); break;
        case 'heal': c.fillStyle = '#7de08a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(sx + (i - 2.5) * 9, sy + 10 - k * 40 - (i % 2) * 10, 3, 0, 6.28); c.fill(); } break;
        case 'smash': c.fillStyle = 'rgba(255,200,80,.6)'; c.beginPath(); c.ellipse(sx, this.sy(f.z), 50 * k, 18 * k, 0, 0, 6.28); c.fill(); break;
      }
      c.globalAlpha = 1;
    }
    this.texts = this.texts.filter((x) => x.t < 0.9);
    for (const x of this.texts) {
      x.t += dt;
      c.globalAlpha = 1 - x.t / 0.9;
      c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = x.color;
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      const sx = x.x - st.camX, sy = this.sy(x.z) - 50 - x.dy - x.t * 30;
      c.strokeText(x.text, sx, sy); c.fillText(x.text, sx, sy);
      c.globalAlpha = 1;
    }
    if (this.flash > 0) { this.flash -= dt * 3; c.fillStyle = `rgba(255,255,255,${Math.max(0, this.flash)})`; c.fillRect(0, 0, W, H); }
    c.restore();
    this.drawHud(c, st, t);
  },
};
