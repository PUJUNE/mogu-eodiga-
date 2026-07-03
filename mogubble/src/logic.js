// logic.js — 발사·비행·스냅·팝·낙하·압축 (DOM 무의존 — node 헤드리스 테스트 가능)
const M = window.MGB;

const SPEED = 480;              // 발사 속도 (px/s)
const AIM_MAX = 78 * Math.PI / 180;   // 발사각 클램프 (수직 기준 ±78°)
const POP_DELAY = 0.42;         // 매치 하이라이트(빨갛게 점멸·부풀기) 시간 — 원작 모션

M.Logic = {
  create(no, carry) {
    const stage = M.makeStage(no);
    const st = {
      stage, no, phase: 'play', t: 0, clearT: 0,
      grid: stage.grid,                       // Map "r,c" → 색
      drop: 0, shots: 0,                      // 압축 오프셋·발사 수
      popping: null,                          // {keys, t} — 매치 하이라이트 중
      score: (carry && carry.score) || 0,
      aim: 0,                                 // 수직 기준 라디안 (+ = 오른쪽)
      flying: null,                           // {x,y,vx,vy,col}
      cur: 0, next: 0,                        // 현재·예고 색
      rng: M.makeRng(no * 131 + 7),           // 큐 전용 rng (배치와 분리)
      popped: 0, dropped: 0,
    };
    st.cur = this._draw(st);
    st.next = this._draw(st);
    return st;
  },

  // 판 위에 존재하는 색에서만 다음 방울 추첨 (퍼즐버블 규칙)
  _draw(st) {
    const present = [...new Set(st.grid.values())];
    if (present.length === 0) return 0;
    return present[st.rng.int(0, present.length - 1)];
  },

  boardBottom(st) {
    let maxR = -1;
    for (const k of st.grid.keys()) maxR = Math.max(maxR, +k.split(',')[0]);
    return maxR < 0 ? -Infinity : M.cellY(maxR, st.drop) + M.D / 2;
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;

    // 조준
    if (typeof input.aim === 'number') st.aim = Math.max(-AIM_MAX, Math.min(AIM_MAX, input.aim));

    // 매치 하이라이트 진행 (끝나면 팝) — 이 동안 발사 금지
    if (st.popping) {
      st.popping.t += dt;
      if (st.popping.t >= POP_DELAY) this._burst(st, ev);
      return ev;
    }

    // 발사
    if (input.shoot && !st.flying) {
      st.flying = {
        x: M.LAUNCH_X, y: M.LAUNCH_Y, col: st.cur,
        vx: Math.sin(st.aim) * SPEED, vy: -Math.cos(st.aim) * SPEED,
      };
      ev.push({ type: 'shoot' });
    }

    // 비행
    const f = st.flying;
    if (f) {
      // 터널링 방지 서브스텝
      const steps = Math.max(1, Math.ceil((SPEED * dt) / 6));
      for (let i = 0; i < steps && st.flying; i++) {
        f.x += (f.vx * dt) / steps;
        f.y += (f.vy * dt) / steps;
        if (f.x < M.WALL_L + M.D / 2) { f.x = M.WALL_L + M.D / 2; f.vx = Math.abs(f.vx); ev.push({ type: 'bounce' }); }
        if (f.x > M.WALL_R - M.D / 2) { f.x = M.WALL_R - M.D / 2; f.vx = -Math.abs(f.vx); ev.push({ type: 'bounce' }); }
        // 천장 또는 기존 방울 접촉 → 스냅
        let hit = f.y <= M.cellY(0, st.drop);
        if (!hit) {
          for (const k of st.grid.keys()) {
            const [r, c] = k.split(',').map(Number);
            const dx = f.x - M.cellX(r, c), dy = f.y - M.cellY(r, c, st.drop);
            if (dx * dx + dy * dy < (M.D - 3) * (M.D - 3)) { hit = true; break; }
          }
        }
        if (hit) this._land(st, ev);
      }
    }
    return ev;
  },

  _land(st, ev) {
    const f = st.flying;
    st.flying = null;
    // 가장 가까운 빈 셀(천장 줄 또는 기존 방울 인접)에 스냅
    const cand = new Set();
    for (let c = 0; c < 8; c++) if (!st.grid.has('0,' + c)) cand.add('0,' + c);
    for (const k of st.grid.keys()) {
      const [r, c] = k.split(',').map(Number);
      for (const [nr, nc] of M.neighbors(r, c)) {
        if (nr < 0 || nc < 0 || nc >= M.colsOf(nr)) continue;
        const nk = nr + ',' + nc;
        if (!st.grid.has(nk)) cand.add(nk);
      }
    }
    let best = null, bd = 1e9;
    for (const k of cand) {
      const [r, c] = k.split(',').map(Number);
      const dx = f.x - M.cellX(r, c), dy = f.y - M.cellY(r, c, st.drop);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    if (!best) best = '0,0';
    st.grid.set(best, f.col);
    const [br, bc] = best.split(',').map(Number);
    ev.push({ type: 'snap', r: br, c: bc, col: f.col });

    // 같은 색 3+ 연결 → 팝
    const same = [best];
    const seen = new Set([best]);
    for (let i = 0; i < same.length; i++) {
      const [r, c] = same[i].split(',').map(Number);
      for (const [nr, nc] of M.neighbors(r, c)) {
        const k = nr + ',' + nc;
        if (!seen.has(k) && st.grid.get(k) === f.col) { seen.add(k); same.push(k); }
      }
    }
    if (same.length >= 3) {
      // 원작 모션: 즉시 터뜨리지 않고 빨갛게 점멸·부풀기(하이라이트) 후 팝
      st.popping = { keys: same, t: 0 };
      ev.push({ type: 'match', n: same.length });
      return;                                        // 이후 진행은 팝 완료 시(_burst)
    }
    this._postLand(st, ev);
  },

  // 하이라이트가 끝난 뒤 실제 팝 + 낙하 + 후처리
  _burst(st, ev) {
    const same = st.popping.keys;
    st.popping = null;
    for (const k of same) {
      const [r, c] = k.split(',').map(Number);
      ev.push({ type: 'popfx', x: M.cellX(r, c), y: M.cellY(r, c, st.drop), col: st.grid.get(k) });
      st.grid.delete(k);
    }
    st.popped += same.length;
    st.score += 10 * same.length * same.length;
    ev.push({ type: 'pop', n: same.length });
    // 천장과 끊긴 방울 낙하
    const attached = new Set();
    const q = [];
    for (let c = 0; c < 8; c++) if (st.grid.has('0,' + c)) { attached.add('0,' + c); q.push([0, c]); }
    while (q.length) {
      const [r, c] = q.shift();
      for (const [nr, nc] of M.neighbors(r, c)) {
        const k = nr + ',' + nc;
        if (st.grid.has(k) && !attached.has(k)) { attached.add(k); q.push([nr, nc]); }
      }
    }
    let fell = 0;
    for (const k of [...st.grid.keys()]) {
      if (!attached.has(k)) {
        const [r, c] = k.split(',').map(Number);
        ev.push({ type: 'fallfx', x: M.cellX(r, c), y: M.cellY(r, c, st.drop), col: st.grid.get(k) });
        st.grid.delete(k);
        fell++;
      }
    }
    if (fell > 0) { st.dropped += fell; st.score += 20 * fell; ev.push({ type: 'fall', n: fell }); }
    this._postLand(st, ev);
  },

  // 착탄 후 공통 후처리: 클리어·압축·데드라인·다음 방울
  _postLand(st, ev) {
    // 클리어
    if (st.grid.size === 0) {
      st.score += 500;
      st.phase = 'clear'; st.clearT = 0;
      ev.push({ type: 'clear' });
      return;
    }

    // 압축 카운트
    st.shots++;
    if (st.shots >= M.MAX_SHOTS) {
      st.shots = 0;
      st.drop++;
      ev.push({ type: 'descend', drop: st.drop });
    }

    // 데드라인 판정
    if (this.boardBottom(st) >= M.DEADLINE) {
      st.phase = 'over'; st.clearT = 0;
      ev.push({ type: 'over' });
      return;
    }

    // 다음 방울
    st.cur = st.next;
    st.next = this._draw(st);
    // 현재 방울 색이 판에서 사라졌으면 교체 (막힌 색 방지)
    if (![...st.grid.values()].includes(st.cur)) st.cur = this._draw(st);
  },
};
