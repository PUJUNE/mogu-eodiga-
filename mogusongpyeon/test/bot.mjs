// bot.mjs — 한 번에 주문 하나씩 처리하는 직렬 봇 (난도 하한선을 재는 용도)
// 사람은 찌는 동안 다음 반죽을 빚으므로 이 봇보다 점수가 높게 나온다.
const M = window.MSP;
const T = M.TILE;

export function makeBot(st) {
  const L = M.Logic;
  let plan = [], cur = null, stuck = 0, lastPos = null;

  const tiles = (pred) => { const a = []; for (const row of st.grid) for (const t of row) if (pred(t)) a.push(t); return a; };
  const crateOf = (kind, val) => tiles((t) => t.kind === 'crate' && M.CRATE[t.ch].t === kind && (M.CRATE[t.ch].c === val || M.CRATE[t.ch].f === val))[0];
  const myCell = () => [Math.floor(st.p.x / T), Math.floor(st.p.y / T)];

  // 목표 칸 옆 바닥까지 경로 → 칸 중심을 따라 이동 → 목표를 바라보게 한 번 밀기
  function goFace(tile) {
    const [c, r] = myCell();
    const adj = (x, y) => Math.abs(x - tile.c) + Math.abs(y - tile.r) === 1;
    const path = M.bfs(st, c, r, adj);
    if (!path) return null;
    return { path: path.slice(1), tile, faced: false };
  }
  function drive(nav) {                      // → 입력 벡터, 도착하면 null
    if (nav.path.length) {
      const [c, r] = nav.path[0];
      const tx = (c + 0.5) * T, ty = (r + 0.5) * T;
      const dx = tx - st.p.x, dy = ty - st.p.y, d = Math.hypot(dx, dy);
      if (d < 6) { nav.path.shift(); return drive(nav); }
      return { mx: dx / d, my: dy / d };
    }
    const tx = (nav.tile.c + 0.5) * T, ty = (nav.tile.r + 0.5) * T;
    const [c, r] = myCell();
    const cx = (c + 0.5) * T, cy = (r + 0.5) * T;
    if (Math.hypot(cx - st.p.x, cy - st.p.y) > 5) {           // 칸 중심에 맞춘 뒤
      const dx = cx - st.p.x, dy = cy - st.p.y, d = Math.hypot(dx, dy);
      return { mx: dx / d * 0.6, my: dy / d * 0.6 };
    }
    if (L.facingTile(st) !== nav.tile) { const dx = tx - st.p.x, dy = ty - st.p.y, d = Math.hypot(dx, dy); return { mx: dx / d * 0.25, my: dy / d * 0.25 }; }
    return null;
  }

  // 단계: { go: tile(or fn), then: 'grab' | 'work' | 'wait' , until: fn }
  function planOrder(o) {
    const steps = [];
    const boards = tiles((t) => t.kind === 'board');
    const steamers = tiles((t) => t.kind === 'steamer');
    o.items.forEach((it, i) => {
      const board = boards[0];
      steamers.sort((a, b) => a.steam.length - b.steam.length);
      steps.push({ go: () => crateOf('dough', it.c), act: 'grab' });
      steps.push({ go: () => board, act: 'grab' });
      steps.push({ go: () => board, act: 'work', until: () => board.item && board.item.t === 'skin' });
      steps.push({ go: () => board, act: 'grab' });
      steps.push({ go: () => crateOf('filling', it.f), act: 'grab' });
      steps.push({ go: () => board, act: 'grab' });
      steps.push({ go: () => board, act: 'work', until: () => board.item && board.item.t === 'raw' });
      steps.push({ go: () => board, act: 'grab' });
      steps.push({ go: () => tiles((t) => t.kind === 'steamer' && t.steam.length < M.STEAM_CAP && !t.steam.some((x) => x.burnt))[0], act: 'grab' });
    });
    steps.push({ go: () => tiles((t) => t.kind === 'plates')[0], act: 'grab' });
    steps.push({ act: 'wait', until: () => tiles((t) => t.kind === 'steamer').every((t) => t.steam.every((x) => x.cook >= M.COOK_T)) });
    for (const s of tiles((t) => t.kind === 'steamer')) {
      steps.push({ go: () => s, act: 'grab', when: () => s.steam.length > 0 });
    }
    steps.push({ go: () => tiles((t) => t.kind === 'serve')[0], act: 'grab' });
    return steps;
  }

  return function input() {
    const inp = { mx: 0, my: 0, grab: false, work: false, dash: false };
    if (!cur) {
      if (!plan.length) {
        if (st.p.held) { plan = [{ go: () => tiles((t) => t.kind === 'trash')[0], act: 'grab' }]; }
        else {
          // 끝낼 수 있는(남은 시간 > 예상 소요) 주문 중 가장 급한 것, 없으면 가장 여유 있는 것
          const est = (o) => 16 * o.items.length + 22;
          const ok = st.orders.filter((o) => o.t > est(o)).sort((a, b) => a.t - b.t);
          const o = ok[0] || st.orders.slice().sort((a, b) => b.t - a.t)[0];
          if (!o) return inp;
          plan = planOrder(o);
        }
      }
      cur = plan.shift();
      if (cur.when && !cur.when()) { cur = null; return inp; }
      const goal = cur.go ? cur.go() : null;
      if (cur.go && !goal) { plan.unshift(cur); cur = null; return inp; }   // 찜기가 다 차 있으면 빌 때까지 기다린다
      cur.nav = goal ? goFace(goal) : null;
      if (cur.go && !cur.nav) { cur = null; plan = []; return inp; }
    }
    if (cur.act === 'wait') { if (cur.until()) cur = null; return inp; }
    const v = drive(cur.nav);
    if (v) {
      Object.assign(inp, v);
      const pos = `${Math.round(st.p.x)},${Math.round(st.p.y)}`;
      stuck = pos === lastPos ? stuck + 1 : 0; lastPos = pos;
      if (stuck > 90) { cur = null; plan = []; stuck = 0; }   // 끼면 계획을 버리고 다시
      return inp;
    }
    if (cur.act === 'grab') { inp.grab = true; cur = null; }
    else if (cur.act === 'work') { inp.work = true; if (cur.until()) cur = null; }
    return inp;
  };
}
