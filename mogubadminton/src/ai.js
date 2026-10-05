// ai.js — 컴퓨터 선수. 사람과 같은 입력 { mx, my, strong, soft, aim } 을 만든다.
// 상대가 친 순간 궤적을 읽어(반응 지연 뒤) 칠 자리로 가고, 라켓에 닿으면 휘두른다.
const M = window.MBD;
const hyp = Math.hypot;

M.makeAI = function (st, idx) {
  const me = st.pl[idx], D = st.D, rng = st.rng;
  const mem = { readFor: null, readAt: 0, target: null, plan: null, serveAt: -1 };

  // 칠 자리 고르기: 내 코트에 들어온 뒤, 키 높이쯤(높으면 스매시 각) 내려올 때의 지점
  function readShot() {
    const b = st.sh;
    const path = b.landing ? b.landing.path : [];
    const ideal = rng.next() < D.smash ? 2.3 * me.h : 1.5 * me.h;
    const spd = M.SPD * me.spd * 0.9, now = st.t - (b.landing.t0 || st.t);
    let pick = null, fallback = null;
    for (const q of path) {
      if (q.y * me.side < 0.3 || q.z > 2.5 * me.h + 0.3) continue;
      const need = hyp(q.x - me.x, q.y - me.y) / spd + D.react * 0.5;
      fallback = q;
      // 제때 닿을 수 있는 첫 지점 중 노린 높이 아래로 내려온 곳
      if (need <= q.t - now && (q.vz < 0 && q.z <= ideal)) { pick = q; break; }
      if (need <= q.t - now && !pick) pick = q;
    }
    if (!pick) pick = fallback;
    if (!pick && b.landing) pick = { x: b.landing.x, y: b.landing.y, t: b.landing.t };
    if (!pick) return null;
    // 예측 오차 — 난이도가 낮으면 낙하점을 잘못 읽는다
    const miss = (1 - D.read) * 1.6;
    return { x: pick.x + (rng.next() - 0.5) * miss, y: pick.y + (rng.next() - 0.5) * miss * 1.4, t: pick.t };
  }

  function chooseShot() {
    const b = st.sh, o = st.pl[1 - idx];
    const z = b.z;
    // 조준 — 상대가 없는 쪽
    const aim = o.x > 0.4 ? -1 : o.x < -0.4 ? 1 : (rng.next() < 0.5 ? -1 : 1);
    if (z >= 2.0 * me.h) {
      const front = Math.abs(me.y) < 4.8;
      if (front && rng.next() < D.smash * (0.6 + me.pow * 0.4)) return { strong: true, aim };
      return rng.next() < 0.55 ? { soft: true, aim } : { strong: true, aim };
    }
    if (Math.abs(me.y) < 2.6) return rng.next() < 0.6 ? { soft: true, aim } : { strong: true, aim };   // 네트 앞: 헤어핀 or 리프트
    return rng.next() < 0.25 ? { soft: true, aim } : { strong: true, aim };
  }

  return function input() {
    const inp = { mx: 0, my: 0, strong: false, soft: false, aim: 0 };
    const b = st.sh;
    if (st.phase === 'serve') {
      if (b.held === idx && st.phaseT <= 0) {
        if (mem.serveAt < 0) mem.serveAt = st.t + 0.5 + rng.next() * 0.6;
        if (st.t >= mem.serveAt) { mem.serveAt = -1; if (rng.next() < 0.68) inp.strong = true; else inp.soft = true; }
      }
      return inp;
    }
    if (st.phase !== 'rally') return inp;
    const coming = b.held === null && b.last !== idx;
    // 상대가 새로 친 공 → 반응 지연 뒤 읽는다
    if (coming && mem.readFor !== b.landing) {
      if (mem.readAt === 0) mem.readAt = st.t + D.react;
      if (st.t >= mem.readAt) { mem.target = readShot(); mem.readFor = b.landing; mem.readAt = 0; mem.plan = null; }
    }
    let tx, ty;
    if (coming && mem.target && mem.readFor === b.landing) { tx = mem.target.x; ty = mem.target.y; }
    else { tx = 0; ty = me.side * 3.4; mem.target = coming ? mem.target : null; }      // 기본 자리 (코트 가운데)
    // 라켓이 오른쪽에 있으니 셔틀을 몸 약간 왼쪽에 두도록 선다
    tx -= me.side * 0.25;
    const dx = tx - me.x, dy = ty - me.y, d = hyp(dx, dy);
    if (d > 0.12) { const k = Math.min(1, d / 0.6); inp.mx = dx / d * k; inp.my = dy / d * k; }
    // 휘두르기
    if (coming && !me.swing && me.swingCd <= 0) {
      const q = M.Logic.reachable(me, b);
      const onMySide = b.y * me.side > -0.2;
      const good = b.vz < 0 || b.z < 1.2 * me.h || hyp(b.x - me.x, b.y - me.y) < 0.7;
      if (q !== null && onMySide && good) { if (!mem.plan) mem.plan = chooseShot(); Object.assign(inp, mem.plan); mem.plan = null; }
    }
    return inp;
  };
};
