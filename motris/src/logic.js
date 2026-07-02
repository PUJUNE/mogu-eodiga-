// logic.js — 보드·조각·중력·줄 지우기·모구 구조 (DOM 무의존 — node 테스트 가능)
const M = window.MTR;

const SOFT = 13;                 // 소프트드롭 속도 (칸/초) — 구조 감속과 무관 (핵심 규칙)
const LOCK_DELAY = 0.45;
const RESCUE_PER = 12, RESCUE_MAX = 60, RESCUE_SLOW = 0.55;
const LINE_SCORE = [0, 100, 300, 500, 800];

M.Logic = {
  create(no, carry) {
    const stage = M.makeStage(no);
    const board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
    // 방해 줄 채우기 (row 0 = 바닥 기준 → 보드 인덱스로 변환)
    for (const g of stage.garbage) {
      const r = M.ROWS - 1 - g.row;
      for (const cell of g.cells) board[r][cell.c] = { color: '#8a8a96', mogu: cell.mogu, trapped: cell.mogu };
    }
    const st = {
      stage, no, phase: 'play', t: 0, clearT: 0,
      board, rng: M.makeRng(no * 373 + 17), bag: [],
      cur: null, next: null,
      gravAcc: 0, lockT: 0,
      lines: 0, score: (carry && carry.score) || 0,
      rescued: 0, trappedRescued: 0, rescueT: 0, tetrisDone: false,
      stars: 0,
    };
    st.next = this._spawnPiece(st);
    this._advance(st);
    return st;
  },

  _spawnPiece(st) {
    if (st.bag.length === 0) {
      st.bag = [...M.PIECE_KEYS];
      for (let i = st.bag.length - 1; i > 0; i--) {       // 7-bag 셔플
        const j = st.rng.int(0, i);
        [st.bag[i], st.bag[j]] = [st.bag[j], st.bag[i]];
      }
    }
    const key = st.bag.pop();
    const mogu = [false, false, false, false];
    if (st.rng.chance(st.stage.pieceMoguP)) mogu[st.rng.int(0, 3)] = true;
    return { key, rot: 0, x: 3, y: -1, mogu };
  },

  _advance(st) {
    st.cur = st.next;
    st.next = this._spawnPiece(st);
    st.gravAcc = 0; st.lockT = 0;
    if (this._hit(st, st.cur.x, st.cur.y, st.cur.rot)) {   // 스폰 충돌 = 톱아웃
      st.phase = 'over'; st.clearT = 0;
      return false;
    }
    return true;
  },

  cells(p) { return M.PIECES[p.key].rot[p.rot].map(([cx, cy], i) => ({ c: p.x + cx, r: p.y + cy, mogu: p.mogu[i] })); },

  _hit(st, x, y, rot) {
    for (const [cx, cy] of M.PIECES[st.cur.key].rot[rot]) {
      const c = x + cx, r = y + cy;
      if (c < 0 || c >= M.COLS || r >= M.ROWS) return true;
      if (r >= 0 && st.board[r][c]) return true;
    }
    return false;
  },

  ghostY(st) {
    let y = st.cur.y;
    while (!this._hit(st, st.cur.x, y + 1, st.cur.rot)) y++;
    return y;
  },

  // 현재 유효 자동 낙하 속도 (칸/초) — 구조 감속 반영
  autoGravity(st) { return st.stage.gravity * (st.rescueT > 0 ? RESCUE_SLOW : 1); },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;
    if (st.rescueT > 0) st.rescueT = Math.max(0, st.rescueT - dt);

    const p = st.cur;
    // 좌우 (main이 DAS 반복으로 edge 전달)
    if (input.moveX && !this._hit(st, p.x + input.moveX, p.y, p.rot)) { p.x += input.moveX; st.lockT = 0; }
    // 회전 (간이 벽차기)
    for (const [flag, dir] of [[input.rotCW, 1], [input.rotCCW, -1]]) {
      if (!flag) continue;
      const nr = (p.rot + dir + 4) % 4;
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!this._hit(st, p.x + dx, p.y, nr)) { p.x += dx; p.rot = nr; st.lockT = 0; ev.push({ type: 'rotate' }); break; }
      }
    }
    // 하드드롭
    if (input.hard) {
      const gy = this.ghostY(st);
      st.score += (gy - p.y) * 2;
      p.y = gy;
      this._lock(st, ev);
      return ev;
    }
    // 중력: 자동은 구조 감속 적용, 소프트드롭(수동)은 고정 속도 — 더 빠른 쪽
    const speed = Math.max(this.autoGravity(st), input.down ? SOFT : 0);
    st.gravAcc += speed * dt;
    while (st.gravAcc >= 1) {
      st.gravAcc -= 1;
      if (!this._hit(st, p.x, p.y + 1, p.rot)) { p.y++; st.lockT = 0; if (input.down) st.score += 1; }
      else { st.gravAcc = 0; break; }
    }
    // 착지 잠금 (락 딜레이)
    if (this._hit(st, p.x, p.y + 1, p.rot)) {
      st.lockT += dt;
      if (st.lockT >= LOCK_DELAY) this._lock(st, ev);
    }
    return ev;
  },

  _lock(st, ev) {
    for (const { c, r, mogu } of this.cells(st.cur)) {
      if (r < 0) { st.phase = 'over'; st.clearT = 0; ev.push({ type: 'over' }); return; }
      st.board[r][c] = { color: M.PIECES[st.cur.key].color, mogu, trapped: false };
    }
    ev.push({ type: 'lock' });
    // 줄 지우기
    const full = [];
    for (let r = 0; r < M.ROWS; r++) if (st.board[r].every((x) => x)) full.push(r);
    if (full.length > 0) {
      let saved = 0, savedTrapped = 0;
      for (const r of full) {
        for (let c = 0; c < M.COLS; c++) {
          const cell = st.board[r][c];
          if (cell.mogu) { saved++; if (cell.trapped) savedTrapped++; ev.push({ type: 'rescuefx', c, r }); }
        }
      }
      for (const r of full) {
        st.board.splice(r, 1);
        st.board.unshift(Array(M.COLS).fill(null));
      }
      st.lines += full.length;
      st.score += LINE_SCORE[full.length];
      if (full.length === 4) { st.tetrisDone = true; ev.push({ type: 'tetris' }); }
      ev.push({ type: 'clearline', n: full.length, rows: full });
      if (saved > 0) {
        st.rescued += saved;
        st.trappedRescued += savedTrapped;
        st.rescueT = Math.min(RESCUE_MAX, st.rescueT + RESCUE_PER * saved);
        st.score += 300 * saved;
        ev.push({ type: 'rescue', n: saved });
      }
      // 스테이지 클리어
      if (st.lines >= st.stage.goal) {
        const all = st.stage.moguTrapped === 0 || st.trappedRescued >= st.stage.moguTrapped;
        st.stars = all ? (st.tetrisDone ? 3 : 2) : 1;
        st.score += 1000;
        st.phase = 'clear'; st.clearT = 0;
        ev.push({ type: 'stageclear', stars: st.stars });
        return;
      }
    }
    if (st.phase === 'play') this._advance(st) || ev.push({ type: 'over' });
  },
};
