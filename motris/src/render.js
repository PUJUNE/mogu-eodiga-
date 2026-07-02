// render.js — 캔버스 2D 렌더 (360×560): 보드 + 우측 패널 + 모구 응원단
const M = window.MTR;
const W = 360, H = 560;
const CELL = 24, BX = 12, BY = 36;          // 보드 원점
const PX = 264;                             // 우측 패널 x

M.Render = {
  cv: null, ctx: null, mogu: null, blocks: {}, fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    this.buildBlocks();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
  },

  buildBlocks() {
    const colors = [...M.PIECE_KEYS.map((k) => M.PIECES[k].color), '#8a8a96'];
    for (const col of colors) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = CELL;
      const c = cv.getContext('2d');
      c.fillStyle = col;
      c.fillRect(0, 0, CELL, CELL);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.fillRect(0, 0, CELL, 3); c.fillRect(0, 0, 3, CELL);
      c.fillStyle = 'rgba(0,0,0,.3)';
      c.fillRect(0, CELL - 3, CELL, 3); c.fillRect(CELL - 3, 0, 3, CELL);
      this.blocks[col] = cv;
    }
  },

  cell(c, r, color, mogu) {
    if (r < 0) return;
    const x = BX + c * CELL, y = BY + r * CELL;
    this.ctx.drawImage(this.blocks[color] || this.blocks['#8a8a96'], x, y);
    if (mogu && this.mogu) {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(x, y, CELL, CELL);
      const a = this.mogu.width / this.mogu.height, h = CELL - 4;
      ctx.drawImage(this.mogu, x + CELL / 2 - (h * a) / 2, y + 3, h * a, h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    }
  },

  addClearFx(rows) { for (const r of rows) this.fx.push({ kind: 'row', r, t: 0 }); },
  addRescueFx(c, r) { this.fx.push({ kind: 'rescue', x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2, t: 0 }); },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (st.stage.world === 3) {
      c.fillStyle = 'rgba(255,255,240,.6)';
      for (let i = 0; i < 24; i++) {
        c.globalAlpha = 0.25 + Math.sin(t * 2 + i) * 0.2;
        c.fillRect((i * 151 + 23) % W, (i * 97 + 11) % H, 1.5, 1.5);
      }
      c.globalAlpha = 1;
    }

    // 보드 패널
    c.fillStyle = th.panel;
    c.fillRect(BX - 4, BY - 4, M.COLS * CELL + 8, M.ROWS * CELL + 8);
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
    c.strokeRect(BX - 4, BY - 4, M.COLS * CELL + 8, M.ROWS * CELL + 8);
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (let i = 1; i < M.COLS; i++) { c.beginPath(); c.moveTo(BX + i * CELL, BY); c.lineTo(BX + i * CELL, BY + M.ROWS * CELL); c.stroke(); }
    for (let i = 1; i < M.ROWS; i++) { c.beginPath(); c.moveTo(BX, BY + i * CELL); c.lineTo(BX + M.COLS * CELL, BY + i * CELL); c.stroke(); }

    // 고정 블록
    for (let r = 0; r < M.ROWS; r++) for (let cc = 0; cc < M.COLS; cc++) {
      const cell = st.board[r][cc];
      if (cell) this.cell(cc, r, cell.color, cell.mogu);
    }
    // 고스트 + 현재 조각
    if (st.phase === 'play' && st.cur) {
      const gy = M.Logic.ghostY(st);
      c.globalAlpha = 0.22;
      for (const [cx, cy] of M.PIECES[st.cur.key].rot[st.cur.rot]) this.cell(st.cur.x + cx, gy + cy, M.PIECES[st.cur.key].color, false);
      c.globalAlpha = 1;
      for (const cell of M.Logic.cells(st.cur)) this.cell(cell.c, cell.r, M.PIECES[st.cur.key].color, cell.mogu);
    }

    // 구조 감속 연출: 보드 양옆 ↑ + 모구 응원단
    if (st.rescueT > 0) {
      c.fillStyle = 'rgba(125,224,138,.8)';
      c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const yy = BY + M.ROWS * CELL - ((t * 60 + i * 160) % (M.ROWS * CELL));
        c.globalAlpha = 0.3 + 0.4 * Math.sin(t * 4 + i);
        c.fillText('↑', BX - 8, yy);
        c.fillText('↑', BX + M.COLS * CELL + 9, yy);
      }
      c.globalAlpha = 1;
    }

    // ── 우측 패널 ──
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(PX - 6, BY - 4, W - PX - 4, 300);
    c.font = 'bold 10px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#9fc0e8';
    c.fillText('NEXT', PX, BY + 12);
    if (st.next) {
      for (const [cx, cy] of M.PIECES[st.next.key].rot[0]) {
        const x = PX + 8 + cx * 18, y = BY + 22 + cy * 18;
        c.fillStyle = M.PIECES[st.next.key].color;
        c.fillRect(x, y, 16, 16);
        if (st.next.mogu[M.PIECES[st.next.key].rot[0].findIndex(([a, b]) => a === cx && b === cy)] && this.mogu) {
          const a = this.mogu.width / this.mogu.height;
          c.drawImage(this.mogu, x + 8 - (14 * a) / 2, y + 1, 14 * a, 14);
        }
      }
    }
    c.fillStyle = '#9fc0e8'; c.font = 'bold 10px sans-serif';
    c.fillText('STAGE', PX, BY + 116);
    c.fillStyle = '#fff'; c.font = 'bold 17px sans-serif';
    c.fillText(String(st.no), PX, BY + 134);
    c.fillStyle = '#9fc0e8'; c.font = 'bold 10px sans-serif';
    c.fillText('남은 줄', PX, BY + 158);
    c.fillStyle = '#fff'; c.font = 'bold 17px sans-serif';
    c.fillText(String(Math.max(0, st.stage.goal - st.lines)), PX, BY + 176);
    // 구조 현황
    c.fillStyle = '#9fc0e8'; c.font = 'bold 10px sans-serif';
    c.fillText(`구조 ${st.trappedRescued}/${st.stage.moguTrapped}`, PX, BY + 200);
    if (this.mogu) {
      const n = Math.min(5, st.rescued);
      const a = this.mogu.width / this.mogu.height;
      for (let i = 0; i < n; i++) {
        const bob = st.rescueT > 0 ? Math.abs(Math.sin(t * 6 + i)) * 4 : 0;
        c.drawImage(this.mogu, PX + i * 17, BY + 208 - bob, 16 * a, 16);
      }
    }
    if (st.rescueT > 0) {
      c.fillStyle = '#7de08a'; c.font = 'bold 10px sans-serif';
      c.fillText(`밀어올리는 중 ${st.rescueT.toFixed(0)}s`, PX, BY + 244);
      c.fillStyle = 'rgba(0,0,0,.4)';
      c.fillRect(PX, BY + 250, 80, 6);
      c.fillStyle = '#7de08a';
      c.fillRect(PX, BY + 250, 80 * Math.min(1, st.rescueT / 60), 6);
    }

    // FX
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'row' ? 0.3 : 0.8));
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'row') {
        c.globalAlpha = Math.max(0, 1 - f.t / 0.3);
        c.fillStyle = '#ffffff';
        c.fillRect(BX, BY + f.r * CELL, M.COLS * CELL, CELL);
        c.globalAlpha = 1;
      } else if (this.mogu) {
        const a = this.mogu.width / this.mogu.height;
        const p = f.t / 0.8;
        c.globalAlpha = Math.max(0, 1 - p);
        c.drawImage(this.mogu, f.x - (22 * a) / 2, f.y - p * 60 - 11, 22 * a, 22);
        c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#7de08a';
        c.fillText('구조!', f.x, f.y - p * 60 - 16);
        c.globalAlpha = 1;
      }
    }
  },
};
