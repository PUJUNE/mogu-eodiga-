// render.js — 캔버스 그리기 (그림은 전부 코드 드로잉, 모구 얼굴만 사진)
// 위에서 약간 비스듬히 내려다보는 오버쿡식 주방. 상단 HUD 띠에 주문표·시간·점수.
const M = window.MSP;
const T = M.TILE;
const TAU = Math.PI * 2;

const R = {
  cv: null, g: null, face: null, faceOk: false,
  pops: [], parts: [], shake: 0,

  init(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.face = new Image();
    this.face.onload = () => { this.faceOk = true; };
    this.face.src = M.ASSETS.mogu;
    const fit = () => {
      const s = Math.min(window.innerWidth / M.W, window.innerHeight / M.H);
      cv.style.width = Math.floor(M.W * s) + 'px';
      cv.style.height = Math.floor(M.H * s) + 'px';
    };
    window.addEventListener('resize', fit); fit();
  },
  reset() { this.pops = []; this.parts = []; this.shake = 0; },

  // ── 효과 ──
  pop(x, y, text, col = '#fff', size = 22, life = 1.3) { this.pops.push({ x, y, text, col, size, t: 0, life }); },
  puff(x, y, col, n = 6, spd = 40, life = 0.8, up = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.parts.push({ x, y, vx: Math.cos(a) * spd * Math.random(), vy: Math.sin(a) * spd * Math.random() - up,
        r: 4 + Math.random() * 5, col, t: 0, life });
    }
  },
  tileCenter(c, r) { return [(c + 0.5) * T, M.HUD + (r + 0.5) * T]; },

  event(e, st) {
    const at = e.c !== undefined ? this.tileCenter(e.c, e.r) : [st.p.x, st.p.y + M.HUD];
    switch (e.type) {
      case 'knead': this.puff(at[0], at[1] - 6, 'rgba(255,255,255,.8)', 3, 50, 0.4, 20); if (Math.random() < 0.5) this.pop(at[0] + 18, at[1] - 22, '꾹', '#fff3d6', 15, 0.5); break;
      case 'skin-done': case 'fold-done': this.puff(at[0], at[1] - 8, 'rgba(255,255,255,.9)', 7, 60, 0.5, 20); break;
      case 'cooked': this.pop(at[0], at[1] - 30, '익었다!', '#fff6b0', 17); break;
      case 'burnt': this.pop(at[0], at[1] - 30, '탔다…', '#ff7a5c', 18); this.puff(at[0], at[1] - 10, 'rgba(40,40,40,.7)', 10, 30, 1.2, 40); break;
      case 'serve':
        this.pop(M.W - 150, M.HUD + 40, `+${e.pts}` + (e.combo > 1 ? `  콤보 x${e.combo}` : ''), '#ffe45c', 26);
        this.puff(at[0], at[1], '#ffd35c', 12, 120, 0.7, 10); break;
      case 'wrong': this.pop(st.p.x, st.p.y + M.HUD - 50, e.hole ? '구멍 송편은 못 팔아요!' : '주문에 없는 접시!', '#ff8a6a', 18); this.shake = 0.25; break;
      case 'need-plate': this.pop(st.p.x, st.p.y + M.HUD - 50, '접시에 담아야 해요', '#fff', 16); break;
      case 'miss': this.pop(480, M.HUD + 30, '주문을 놓쳤어요 -' + M.PENALTY_MISS, '#ff8a6a', 20); this.shake = 0.2; break;
      case 'peck': this.pop(at[0], at[1] - 30, '콕! 구멍', '#ffb08a', 17); break;
      case 'shoo': this.pop(e.x, e.y + M.HUD - 40, '훠이! +' + M.SHOO_BONUS, '#bff28a', 20); this.puff(e.x, e.y + M.HUD, '#b98b5c', 8, 90, 0.5, 0); break;
      case 'kiwi-in': if (st.door) { const d = this.tileCenter(st.door.c, st.door.r); this.pop(d[0] + 40, d[1] - 34, '키위 출몰!', '#ffe0b0', 17); } break;
      case 'dash': this.puff(st.p.x - st.p.fx * 16, st.p.y + M.HUD + 12, 'rgba(255,255,255,.6)', 5, 30, 0.35, 0); break;
      case 'work-hint': {
        const msg = { 'no-board': '빚기는 도마 앞에서! (도마를 바라보기)', 'face-board': '도마 쪽을 바라보고 빚어요',
          empty: '도마에 반죽을 먼저 올려요', 'need-fill': '소를 먼저 얹어야 접을 수 있어요', done: '다 빚었어요 — 집어서 다음 단계로' }[e.why];
        this.pop(st.p.x, st.p.y + M.HUD - 56, msg, '#fff3d6', 17, 1.6); break;
      }
      case 'trash': this.puff(at[0], at[1] - 10, 'rgba(120,120,120,.6)', 5, 40, 0.5, 20); break;
    }
  },

  // ── 재료 그림 ──
  songShape(g, x, y, s, fill, edge) {        // 반달 송편
    g.beginPath();
    g.moveTo(x - 13 * s, y + 4 * s);
    g.bezierCurveTo(x - 12 * s, y - 12 * s, x + 12 * s, y - 12 * s, x + 13 * s, y + 4 * s);
    g.quadraticCurveTo(x, y + 9 * s, x - 13 * s, y + 4 * s);
    g.closePath();
    g.fillStyle = fill; g.fill();
    g.lineWidth = 1.5 * s; g.strokeStyle = edge; g.stroke();
  },
  badge(g, x, y, f, s = 1) {                 // 소 표시 (깨/콩/밤)
    const F = M.FILLINGS[f];
    g.beginPath(); g.arc(x, y, 5.5 * s, 0, TAU);
    g.fillStyle = F.col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = F.dot;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + (i - 1) * 2.4 * s, y + (i === 1 ? -1.5 : 1) * s, 1 * s, 0, TAU); g.fill(); }
  },
  item(g, it, x, y, s = 1, now = 0) {
    if (!it) return;
    switch (it.t) {
      case 'dough': {
        const D = M.DOUGHS[it.c];
        g.beginPath(); g.ellipse(x, y + 5 * s, 12 * s, 4 * s, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.15)'; g.fill();
        g.beginPath(); g.arc(x, y - 2 * s, 12 * s, 0, TAU); g.fillStyle = D.col; g.fill();
        g.lineWidth = 1.5 * s; g.strokeStyle = D.edge; g.stroke();
        g.beginPath(); g.arc(x - 4 * s, y - 6 * s, 3.5 * s, 0, TAU); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
        break;
      }
      case 'skin': {
        const D = M.DOUGHS[it.c];
        g.beginPath(); g.ellipse(x, y, 15 * s, 9 * s, 0, 0, TAU); g.fillStyle = D.col; g.fill();
        g.lineWidth = 1.5 * s; g.strokeStyle = D.edge; g.stroke();
        if (it.fill) {
          const F = M.FILLINGS[it.fill];
          g.beginPath(); g.ellipse(x, y - 1 * s, 6 * s, 4 * s, 0, 0, TAU); g.fillStyle = F.col; g.fill();
          g.fillStyle = F.dot;
          for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x - 3 * s + i * 2 * s, y - 1 * s + (i % 2) * s, 0.9 * s, 0, TAU); g.fill(); }
        }
        break;
      }
      case 'raw': {
        const D = M.DOUGHS[it.c];
        this.songShape(g, x, y, s, D.col, D.edge);
        g.beginPath(); g.moveTo(x - 9 * s, y - 3 * s); g.quadraticCurveTo(x, y - 9 * s, x + 9 * s, y - 3 * s);
        g.strokeStyle = D.edge; g.lineWidth = 1 * s; g.stroke();
        this.badge(g, x + 12 * s, y + 6 * s, it.f, s * 0.9);
        break;
      }
      case 'song': {
        const D = M.DOUGHS[it.c];
        this.songShape(g, x, y, s, D.col, D.edge);
        g.beginPath(); g.ellipse(x - 4 * s, y - 4 * s, 5 * s, 2.2 * s, -0.4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
        g.strokeStyle = 'rgba(70,110,50,.55)'; g.lineWidth = 0.9 * s;       // 솔잎 자국
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 6 * s + i * 5 * s, y + 3 * s); g.lineTo(x - 2 * s + i * 5 * s, y - 2 * s); g.stroke(); }
        if (it.hole) {
          g.beginPath(); g.arc(x + 3 * s, y - 2 * s, 3.2 * s, 0, TAU); g.fillStyle = '#3a2418'; g.fill();
          g.lineWidth = 1; g.strokeStyle = D.edge; g.stroke();
        }
        this.badge(g, x + 12 * s, y + 6 * s, it.f, s * 0.9);
        break;
      }
      case 'filling': {
        const F = M.FILLINGS[it.f];
        g.beginPath(); g.ellipse(x, y + 2 * s, 13 * s, 8 * s, 0, 0, TAU); g.fillStyle = '#f7f3ea'; g.fill();
        g.lineWidth = 1.5 * s; g.strokeStyle = '#b9ad98'; g.stroke();
        g.beginPath(); g.ellipse(x, y, 9 * s, 5 * s, 0, 0, TAU); g.fillStyle = F.col; g.fill();
        g.fillStyle = F.dot;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x - 6 * s + i * 2.4 * s, y - 1 * s + (i % 2) * 2 * s, 1 * s, 0, TAU); g.fill(); }
        break;
      }
      case 'burnt':
        this.songShape(g, x, y, s, '#2b2320', '#111');
        g.fillStyle = 'rgba(90,90,90,.5)';
        g.beginPath(); g.arc(x - 2 * s, y - 16 * s - Math.sin(now * 4) * 2, 4 * s, 0, TAU); g.fill();
        break;
      case 'plate': {
        g.beginPath(); g.ellipse(x, y + 3 * s, 22 * s, 12 * s, 0, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
        g.lineWidth = 2 * s; g.strokeStyle = '#c9c2b4'; g.stroke();
        g.beginPath(); g.ellipse(x, y + 3 * s, 15 * s, 7.5 * s, 0, 0, TAU); g.strokeStyle = '#e3ddd0'; g.lineWidth = 1.2 * s; g.stroke();
        const n = it.songs.length;
        const offs = n === 1 ? [[0, 0]] : n === 2 ? [[-8, 1], [8, 1]] : [[-9, 3], [9, 3], [0, -4]];
        it.songs.forEach((sg, i) => this.item(g, Object.assign({ t: 'song' }, sg), x + offs[i][0] * s, y + offs[i][1] * s, s * 0.62, now));
        break;
      }
    }
  },

  // ── 칸 그림 ──
  counter(g, x, y, top = '#eadcc0', front = '#c7aa7c') {
    g.fillStyle = front; g.fillRect(x + 1, y + 6, T - 2, T - 6);
    g.fillStyle = top; g.fillRect(x + 1, y + 1, T - 2, T - 12);
    g.strokeStyle = 'rgba(80,50,20,.35)'; g.lineWidth = 1; g.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
  },
  tile(g, st, t, now) {
    const x = t.c * T, y = M.HUD + t.r * T, cx = x + T / 2, cy = y + T / 2 - 5;
    switch (t.kind) {
      case 'floor': case 'door': {
        g.fillStyle = (t.c + t.r) % 2 ? '#e7c894' : '#e0bf88'; g.fillRect(x, y, T, T);
        g.strokeStyle = 'rgba(150,105,55,.25)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y + T / 2); g.lineTo(x + T, y + T / 2); g.stroke();
        if (t.kind === 'door') {
          g.fillStyle = '#7a4e2e'; g.fillRect(x + 4, y + 6, T - 8, T - 12);
          g.fillStyle = '#9a6a42'; g.fillRect(x + 8, y + 10, T - 16, T - 20);
          g.fillStyle = '#fff3d6'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
          g.fillText('뒷문', cx, cy + 9);
        }
        return;
      }
      case 'wall':
        g.fillStyle = '#8b5a3c'; g.fillRect(x, y, T, T);
        g.strokeStyle = 'rgba(0,0,0,.18)';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x, y + i * 15); g.lineTo(x + T, y + i * 15); g.stroke(); }
        return;
      case 'belt': {
        g.fillStyle = '#4b4a52'; g.fillRect(x + 1, y + 4, T - 2, T - 8);
        g.save(); g.beginPath(); g.rect(x + 1, y + 4, T - 2, T - 8); g.clip();
        const [dx, dy] = t.dir, off = (now * T / M.BELT_T) % 20;
        g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
        for (let k = -2; k < 5; k++) {
          const px = cx + dx * (k * 20 + off - 30), py = cy + 5 + dy * (k * 20 + off - 30);
          g.beginPath();
          if (dx) { g.moveTo(px - dx * 5, py - 12); g.lineTo(px + dx * 3, py); g.lineTo(px - dx * 5, py + 12); }
          else { g.moveTo(px - 12, py - dy * 5); g.lineTo(px, py + dy * 3); g.lineTo(px + 12, py - dy * 5); }
          g.stroke();
        }
        g.restore();
        break;
      }
      default: this.counter(g, x, y);
    }
    switch (t.kind) {
      case 'crate': {
        const C = M.CRATE[t.ch];
        g.fillStyle = '#a8703f'; g.fillRect(x + 7, y + 7, T - 14, T - 22);
        g.strokeStyle = '#6e4424'; g.lineWidth = 2; g.strokeRect(x + 7, y + 7, T - 14, T - 22);
        g.beginPath(); g.moveTo(x + 7, y + 20); g.lineTo(x + T - 7, y + 20); g.stroke();
        if (C.t === 'dough') {
          for (const [ox, oy] of [[-8, 2], [8, 2], [0, -4]]) this.item(g, { t: 'dough', c: C.c }, cx + ox, cy + oy, 0.6);
        } else this.item(g, { t: 'filling', f: C.f }, cx, cy, 0.85);
        g.fillStyle = '#4a2a14'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
        g.fillText(C.t === 'dough' ? M.DOUGHS[C.c].name + ' 반죽' : M.FILLINGS[C.f].name, cx, y + T - 3);
        break;
      }
      case 'board':
        g.fillStyle = '#d9a466'; g.beginPath(); g.roundRect(x + 6, y + 6, T - 12, T - 20, 6); g.fill();
        g.strokeStyle = '#9c6a34'; g.lineWidth = 1.5; g.stroke();
        break;
      case 'steamer': {
        g.beginPath(); g.arc(cx, cy, 24, 0, TAU); g.fillStyle = '#caa56a'; g.fill();
        g.lineWidth = 3; g.strokeStyle = '#8f6a36'; g.stroke();
        g.beginPath(); g.arc(cx, cy, 19, 0, TAU); g.fillStyle = '#b9d39a'; g.fill();   // 솔잎 깔개
        g.strokeStyle = '#5f8a3c'; g.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU; g.beginPath();
          g.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); g.lineTo(cx + Math.cos(a + 0.3) * 18, cy + Math.sin(a + 0.3) * 18); g.stroke();
        }
        const pos = [[-8, 4], [8, 4], [0, -8]];
        const burnAt = M.COOK_T + M.BURN_T * st.D.burn;
        t.steam.forEach((s, i) => {
          const it = s.burnt ? { t: 'burnt' } : s.cook >= M.COOK_T ? { t: 'song', c: s.c, f: s.f } : { t: 'raw', c: s.c, f: s.f };
          this.item(g, it, cx + pos[i][0], cy + pos[i][1], 0.62, now);
        });
        const live = t.steam.filter((s) => !s.burnt);
        if (live.length) {
          const worst = Math.max(...live.map((s) => s.cook));
          if (Math.random() < 0.25) this.puff(cx + (Math.random() - 0.5) * 30, cy - 10, 'rgba(255,255,255,.55)', 1, 10, 1.0, 34);
          const frac = Math.min(1, Math.min(...live.map((s) => s.cook)) / M.COOK_T);
          g.beginPath(); g.arc(cx, cy, 27, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
          g.lineWidth = 4; g.strokeStyle = frac >= 1 ? '#6fd36a' : '#ffd35c'; g.stroke();
          if (worst > burnAt - 4 && Math.floor(now * 6) % 2) {
            g.fillStyle = '#ff4a2e'; g.beginPath(); g.arc(cx + 20, cy - 22, 9, 0, TAU); g.fill();
            g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText('!', cx + 20, cy - 17);
          }
        }
        if (t.steam.some((s) => s.burnt) && Math.random() < 0.3) this.puff(cx, cy - 8, 'rgba(50,50,50,.55)', 1, 10, 1.2, 30);
        break;
      }
      case 'plates':
        for (let i = 0; i < 4; i++) {
          g.beginPath(); g.ellipse(cx, cy + 6 - i * 4, 19, 9, 0, 0, TAU); g.fillStyle = '#fff'; g.fill();
          g.strokeStyle = '#c9c2b4'; g.lineWidth = 1.5; g.stroke();
        }
        break;
      case 'serve':
        g.fillStyle = '#3a2a22'; g.fillRect(x + 6, y + 6, T - 12, T - 20);
        g.fillStyle = '#ffd35c'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
        g.fillText('출하', cx, cy + 1);
        g.fillStyle = 'rgba(255,211,92,' + (0.45 + Math.sin(now * 5) * 0.35) + ')';
        g.beginPath(); g.moveTo(cx - 8, cy + 8); g.lineTo(cx + 8, cy + 8); g.lineTo(cx, cy + 15); g.fill();
        break;
      case 'trash':
        g.fillStyle = '#7d8a8f'; g.beginPath(); g.roundRect(cx - 14, cy - 12, 28, 30, 4); g.fill();
        g.fillStyle = '#5c686c'; g.fillRect(cx - 17, cy - 16, 34, 6);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
        for (const ox of [-6, 0, 6]) { g.beginPath(); g.moveTo(cx + ox, cy - 6); g.lineTo(cx + ox, cy + 13); g.stroke(); }
        break;
    }
    if (t.item) this.item(g, t.item, cx, cy, 1, now);
    if (t.kind === 'board' && t.work > 0 && t.item) {
      const need = t.item.t === 'dough' ? M.KNEAD_T : M.FOLD_T;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(x + 2, y - 10, T - 4, 12, 5); g.fill();
      g.fillStyle = '#6fd36a'; g.beginPath(); g.roundRect(x + 4, y - 8, (T - 8) * Math.min(1, t.work / need), 8, 4); g.fill();
    }
  },

  // ── 모구 ──
  mogu(g, st, now) {
    const p = st.p, x = p.x, y = p.y + M.HUD;
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const bob = moving ? Math.abs(Math.sin(now * 14)) * 3 : p.working ? Math.abs(Math.sin(now * 18)) * 2.5 : 0;
    const flip = p.fx < -0.15;
    const back = p.fy < -0.6;
    g.beginPath(); g.ellipse(x, y + 16, 20, 8, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill();

    const held = () => {
      if (!p.held) return;
      const hx = x + p.fx * 20, hy = y + 4 + p.fy * 10 - bob;
      this.item(g, p.held, hx, hy, 0.95, now);
    };
    if (back) held();
    // 발
    g.fillStyle = '#fff';
    const step = moving ? Math.sin(now * 14) * 4 : 0;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 9, y + 14 + s * step * 0.4, 6, 4, 0, 0, TAU); g.fill(); g.strokeStyle = '#ccc'; g.lineWidth = 1; g.stroke(); }
    // 몸 (흰 바탕 + 삼색 얼룩 + 앞치마)
    const by = y + 2 - bob;
    g.beginPath(); g.ellipse(x, by, 17, 15, 0, 0, TAU); g.fillStyle = '#fbfaf6'; g.fill();
    g.strokeStyle = '#d9d4c8'; g.lineWidth = 1.5; g.stroke();
    g.save(); g.beginPath(); g.ellipse(x, by, 17, 15, 0, 0, TAU); g.clip();
    g.fillStyle = '#3a3230'; g.beginPath(); g.ellipse(x + (flip ? -9 : 9), by - 4, 7, 5, 0.4, 0, TAU); g.fill();
    g.fillStyle = '#c99260'; g.beginPath(); g.ellipse(x + (flip ? 10 : -10), by + 6, 6, 5, 0, 0, TAU); g.fill();
    if (!back) {
      g.fillStyle = '#e8553c'; g.beginPath(); g.roundRect(x - 10, by - 4, 20, 20, 4); g.fill();
      g.fillStyle = '#ffd35c'; g.fillRect(x - 5, by + 4, 10, 6);
    } else {
      g.strokeStyle = '#e8553c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 14, by - 6); g.lineTo(x + 14, by - 6); g.stroke();
    }
    g.restore();
    // 꼬리
    g.strokeStyle = '#3a3230'; g.lineWidth = 5; g.lineCap = 'round';
    const tw = Math.sin(now * 3) * 4;
    g.beginPath(); g.moveTo(x + (flip ? 14 : -14), by + 6); g.quadraticCurveTo(x + (flip ? 26 : -26), by, x + (flip ? 24 : -24) + tw, by - 12); g.stroke();
    g.lineCap = 'butt';
    // 앞발 (빚는 중이면 꾹꾹)
    const pawOff = p.working ? Math.sin(now * 18) * 4 : 0;
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 9 + p.fx * 12, by + 4 + p.fy * 6 + (s > 0 ? pawOff : -pawOff), 5, 0, TAU); g.fill(); g.strokeStyle = '#ccc'; g.stroke(); }
    // 머리 = 모구 사진
    const hw = 74, hh = Math.round(74 * 221 / 256), hx = x - hw / 2, hy = by - hh - 5;
    if (this.faceOk) {
      g.save();
      if (flip) { g.translate(x * 2, 0); g.scale(-1, 1); }
      if (back) g.globalAlpha = 0.92;
      g.drawImage(this.face, hx, hy, hw, hh);
      g.restore();
    } else {
      g.beginPath(); g.arc(x, hy + hh / 2, 20, 0, TAU); g.fillStyle = '#fbfaf6'; g.fill();
    }
    if (!back) held();
    if (p.dashT > 0) {
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - p.fx * (24 + i * 6) - p.fy * (i - 1) * 9, y - p.fy * 24 + p.fx * (i - 1) * 9); g.lineTo(x - p.fx * (38 + i * 6) - p.fy * (i - 1) * 9, y - p.fy * 38 + p.fx * (i - 1) * 9); g.stroke(); }
    }
  },

  // ── 키위 (날개는 장식) ──
  kiwi(g, k, now) {
    const x = k.x, y = k.y + M.HUD;
    const pecking = k.st === 'peck', fleeing = k.st === 'flee';
    const walk = k.path.length ? Math.sin(now * 16) * 3 : 0;
    g.beginPath(); g.ellipse(x, y + 16, 15, 6, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
    g.strokeStyle = '#d9b77a'; g.lineWidth = 2.5;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * 5, y + 6); g.lineTo(x + s * 5 + (s > 0 ? walk : -walk), y + 16); g.stroke(); }
    const tilt = pecking ? Math.max(0, Math.sin(now * 9)) * 0.45 : 0;
    g.save(); g.translate(x, y); g.scale(k.dir, 1); g.rotate(tilt);
    g.beginPath(); g.ellipse(0, -4, 15, 17, 0.1, 0, TAU); g.fillStyle = '#9b6a42'; g.fill();
    g.fillStyle = 'rgba(70,40,20,.35)';
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-8 + (i * 7) % 16, -14 + (i * 11) % 22, 1.6, 0, TAU); g.fill(); }
    g.fillStyle = '#1a120c'; g.beginPath(); g.arc(8, -11, 2.2, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(8.6, -11.8, 0.8, 0, TAU); g.fill();
    g.strokeStyle = '#f0dcae'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, -8); g.quadraticCurveTo(22, -2, 27, 8); g.stroke();
    g.lineCap = 'butt';
    g.restore();
    if (fleeing) {
      g.fillStyle = '#9fd8ff';
      g.beginPath(); g.ellipse(x - k.dir * 14, y - 22, 3, 5, 0.3, 0, TAU); g.fill();
    }
    if (pecking) {
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - 16, y - 34, 32, 5);
      g.fillStyle = '#ff7a5c'; g.fillRect(x - 15, y - 33, 30 * Math.min(1, k.pt / M.PECK_T), 3);
    }
  },

  // ── 새 손님 아바타 (주문표) ──
  bird(g, kind, x, y) {
    const C = { penguin: ['#2d3448', '#fff', '#f0a93c'], kakapo: ['#9bb25a', '#c9d98a', '#e8d9a0'],
      pigeon: ['#9aa7d8', '#c7cff0', '#6a5a52'], chick: ['#ffe07a', '#fff2b8', '#f08a3c'], ostrich: ['#9a9aa4', '#c9c9d0', '#f0b0a0'] }[kind];
    g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fillStyle = C[0]; g.fill();
    g.beginPath(); g.ellipse(x, y + 3, 8, 7, 0, 0, TAU); g.fillStyle = C[1]; g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.arc(x - 4, y - 3, 1.6, 0, TAU); g.arc(x + 4, y - 3, 1.6, 0, TAU); g.fill();
    g.fillStyle = C[2]; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.lineTo(x, y + 4); g.fill();
    if (kind === 'chick') { g.fillStyle = '#e8553c'; g.beginPath(); g.arc(x, y - 13, 3.5, 0, TAU); g.arc(x + 3, y - 12, 3, 0, TAU); g.fill(); }
  },

  hud(g, st, now) {
    const grd = g.createLinearGradient(0, 0, 0, M.HUD);
    grd.addColorStop(0, '#4a3122'); grd.addColorStop(1, '#3a2619');
    g.fillStyle = grd; g.fillRect(0, 0, M.W, M.HUD);
    // 주문표
    st.orders.forEach((o, i) => {
      const x = 10 + i * 168, y = 8, w = 158, h = 68;
      const frac = Math.max(0, o.t / o.max);
      const urgent = frac < 0.25 && Math.floor(now * 4) % 2;
      g.fillStyle = urgent ? '#ffd9cc' : '#fff6e2'; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
      this.bird(g, o.cust, x + 20, y + 26);
      o.items.forEach((it, k) => this.item(g, Object.assign({ t: 'song' }, it), x + 58 + k * 36, y + 30, 0.95, now));
      g.fillStyle = '#d8ccb4'; g.fillRect(x + 8, y + h - 12, w - 16, 6);
      g.fillStyle = frac > 0.5 ? '#6fbf5a' : frac > 0.25 ? '#f0b83c' : '#e8553c';
      g.fillRect(x + 8, y + h - 12, (w - 16) * frac, 6);
    });
    // 시간 · 점수
    const tl = Math.ceil(st.timeLeft), mm = Math.floor(tl / 60), ss = String(tl % 60).padStart(2, '0');
    g.textAlign = 'right';
    g.fillStyle = st.timeLeft <= 30 && Math.floor(now * 3) % 2 ? '#ff7a5c' : '#fff3d6';
    g.font = 'bold 30px sans-serif'; g.fillText(`⏱ ${mm}:${ss}`, M.W - 14, 36);
    g.fillStyle = '#ffd35c'; g.font = 'bold 24px sans-serif'; g.fillText(`${st.score}점`, M.W - 14, 68);
    if (st.combo > 1) { g.fillStyle = '#a8e08a'; g.font = 'bold 15px sans-serif'; g.fillText(`콤보 x${st.combo}`, M.W - 110, 66); }
  },

  draw(st, now, dt) {
    const g = this.g;
    g.save();
    if (this.shake > 0) { this.shake -= dt; g.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6); }
    g.fillStyle = '#e0bf88'; g.fillRect(0, M.HUD, M.W, M.H - M.HUD);
    for (const row of st.grid) for (const t of row) if (t.kind === 'floor' || t.kind === 'door') this.tile(g, st, t, now);
    // 바라보는 칸 강조
    const ft = st.phase === 'play' ? M.Logic.facingTile(st) : null;
    for (const row of st.grid) for (const t of row) if (t.kind !== 'floor' && t.kind !== 'door') this.tile(g, st, t, now);
    if (ft) {
      g.strokeStyle = 'rgba(255,240,120,' + (0.6 + Math.sin(now * 8) * 0.3) + ')'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(ft.c * T + 2, M.HUD + ft.r * T + 2, T - 4, T - 4, 6); g.stroke();
    }
    // 캐릭터 (y 순서)
    const actors = st.kiwis.map((k) => ({ y: k.y, f: () => this.kiwi(g, k, now) }));
    actors.push({ y: st.p.y, f: () => this.mogu(g, st, now) });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.f());
    // 파티클 · 팝업
    for (const q of this.parts) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= 0.96;
      const a = 1 - q.t / q.life;
      if (a <= 0) continue;
      g.globalAlpha = a; g.beginPath(); g.arc(q.x, q.y, q.r * (1 + q.t), 0, TAU); g.fillStyle = q.col; g.fill();
    }
    g.globalAlpha = 1;
    this.parts = this.parts.filter((q) => q.t < q.life);
    g.textAlign = 'center';
    for (const q of this.pops) {
      q.t += dt;
      const a = Math.min(1, 2 * (q.life - q.t));
      if (a <= 0) continue;
      g.globalAlpha = a; g.font = `900 ${q.size}px sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(40,20,10,.8)'; const rise = Math.min(q.t, 1.3) * 26;
      g.strokeText(q.text, q.x, q.y - rise);
      g.fillStyle = q.col; g.fillText(q.text, q.x, q.y - rise);
    }
    g.globalAlpha = 1;
    this.pops = this.pops.filter((q) => q.t < q.life);
    g.restore();
    this.hud(g, st, now);
  },
};

M.Render = R;
