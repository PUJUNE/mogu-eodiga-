// ai.js — 컴퓨터 선수. 사람과 같은 입력 { mx, my, shoot, act } 을 만든다.
// 난이도는 반응 지연(react) · 슛 타이밍 오차(aim) · 견제(contest) · 스틸 시도(steal)로 갈린다.
const M = window.MBK;
const H = M.HOOP;
const hyp = Math.hypot;

function toward(p, x, y, slow = 0.35) {
  const dx = x - p.x, dy = y - p.y, d = hyp(dx, dy);
  if (d < slow) return { mx: 0, my: 0, d };
  const k = Math.min(1, d / 1.2);
  return { mx: dx / d * k, my: dy / d * k, d };
}

M.makeAI = function (st, idx) {
  const me = st.pl[idx], D = st.D, rng = st.rng;
  const mem = { seen: null, seenAt: -1, plan: null, planOff: -1, aimM: 0, holdShoot: false, jumpAt: -1, lastShotSeen: null, spot: null };

  // 상대 위치를 반응 지연만큼 늦게 본다
  function perceive() {
    if (st.t - mem.seenAt >= D.react || !mem.seen) {
      const o = st.pl[1 - idx];
      mem.seen = { x: o.x, y: o.y, vx: o.vx, vy: o.vy, state: o.state, shooting: o.state === 'shoot' || o.state === 'dunk', z: o.z };
      mem.seenAt = st.t;
    }
    return mem.seen;
  }

  function offense(o) {
    const inp = { mx: 0, my: 0, shoot: false, act: false };
    if (me.state === 'shoot') {                      // 게이지를 보고 노린 지점에서 놓는다
      inp.shoot = !(me.shot && me.shot.phase === 'air' && me.shot.m >= mem.aimM);
      return inp;
    }
    if (!st.cleared) {                               // 공을 뺏었으면 2점 라인 밖으로
      const a = Math.atan2(me.y - H.y, me.x - H.x);
      const t = toward(me, H.x + Math.cos(a) * (M.ARC_R + 0.8), Math.max(H.y + 1.8, H.y + Math.sin(a) * (M.ARC_R + 0.8)));
      return Object.assign(inp, t);
    }
    if (mem.planOff !== st.shotClock || !mem.plan) {
      // 공격 시작마다 계획: 슛이 좋으면 슛 자리, 아니면 돌파
      if (!mem.plan || mem.plan.until < st.t) {
        const shooterish = me.sht > 1.02 ? 0.65 : me.sht > 0.92 ? 0.5 : 0.35;
        const kind = rng.next() < shooterish ? 'shoot' : 'drive';
        const a = rng.range(Math.PI * 0.18, Math.PI * 0.82);
        const r = kind === 'shoot' ? rng.range(M.ARC_R - 1.5, M.ARC_R + 0.7) : 1.0;
        mem.plan = { kind, x: H.x + Math.cos(a) * r, y: H.y + Math.sin(a) * r, until: st.t + rng.range(2.5, 4.5), side: rng.next() < 0.5 ? -1 : 1 };
      }
    }
    const d = M.distHoop(me.x, me.y);
    const od = hyp(o.x - me.x, o.y - me.y);
    // 수비가 골대 쪽 앞을 막고 있나
    let hx = H.x - me.x, hy = H.y - me.y; const hm = hyp(hx, hy) || 1; hx /= hm; hy /= hm;
    const front = ((o.x - me.x) * hx + (o.y - me.y) * hy) / (od || 1);
    const open = od > 2.1 || front < 0 || o.state === 'stumble';
    const late = st.shotClock < 2.6;

    // 가까우면 마무리
    if (d < (me.P.dunk ? M.DUNK_R : M.LAYUP_R - 0.2) && (open || rng.next() < 0.08 || late)) {
      const t = toward(me, H.x, H.y, 0);
      inp.mx = t.mx; inp.my = t.my; inp.shoot = true;
      return inp;
    }
    // 열린 슛 자리
    const roomy = od > 1.55 || front < 0.2 || o.state === 'stumble';
    if ((mem.plan.kind === 'shoot' && roomy && d < M.ARC_R + 1.2 && d > 2.5) || (late && d < 7.5) ||
        (mem.plan.kind === 'drive' && open && d > 3 && d < M.ARC_R + 0.5 && rng.next() < 0.02 * me.sht)) {
      inp.shoot = true;
      mem.aimM = (M.SWEET[0] + M.SWEET[1]) / 2 + (rng.next() + rng.next() + rng.next() - 1.5) * D.aim * 1.6;
      return inp;
    }
    // 돌파 — 수비 옆으로 비켜서 골대로
    let tx = mem.plan.kind === 'shoot' ? mem.plan.x : H.x, ty = mem.plan.kind === 'shoot' ? mem.plan.y : H.y + 0.6;
    if (!open && od < 2.4) {
      tx = me.x + hx * 2 + (-hy) * mem.plan.side * 1.6; ty = me.y + hy * 2 + hx * mem.plan.side * 1.6;
      if (od < 1.5 && me.crossCd <= 0 && rng.next() < 0.06 + me.hnd * 0.05) { inp.act = true; mem.plan.side = -mem.plan.side; }
    }
    Object.assign(inp, toward(me, tx, ty, 0.2));
    return inp;
  }

  function defense(o, seen) {
    const inp = { mx: 0, my: 0, shoot: false, act: false };
    const b = st.ball;
    // 골대와 공잡이 사이, 1.1m 앞
    let hx = H.x - seen.x, hy = H.y - seen.y; const hm = hyp(hx, hy) || 1; hx /= hm; hy /= hm;
    const gap = Math.min(1.15, hm * 0.5);
    const t = toward(me, seen.x + hx * gap, seen.y + hy * gap, 0.12);
    Object.assign(inp, t);
    // 슛 견제 — 반응 지연 뒤 점프
    const shooting = o.state === 'shoot' || o.state === 'dunk';
    if (shooting && mem.lastShotSeen !== o.shot && hyp(o.x - me.x, o.y - me.y) < 2.0) {
      mem.lastShotSeen = o.shot;
      if (rng.next() < D.contest) mem.jumpAt = st.t + D.react * 0.7 + (o.state === 'dunk' ? 0.05 : 0.12);
    }
    if (mem.jumpAt > 0 && st.t >= mem.jumpAt) { inp.shoot = true; mem.jumpAt = -1; }
    // 스틸
    const od = hyp(o.x - me.x, o.y - me.y);
    if (b.holder === o.idx && od < 1.0 && me.stealCd <= 0 && rng.next() < D.steal * 0.02) inp.act = true;
    return inp;
  }

  function chase() {                                 // 떠 있는 공 — 떨어질 곳으로
    const b = st.ball;
    let tx = b.x, ty = b.y;
    if (b.z > 2.2 && b.vz !== 0) { const tt = Math.max(0, (b.vz + Math.sqrt(Math.max(0, b.vz * b.vz + 2 * M.G * (b.z - 1.6)))) / M.G); tx = b.x + b.vx * tt * 0.8; ty = b.y + b.vy * tt * 0.8; }
    const inp = toward(me, tx, ty, 0);
    inp.shoot = false; inp.act = false;
    return inp;
  }

  return function input() {
    if (st.phase !== 'live') return { mx: 0, my: 0 };
    const seen = perceive();
    const o = st.pl[1 - idx];
    const b = st.ball;
    if (b.holder === idx) return offense(o);
    if (b.holder === o.idx) return defense(o, seen);
    if (b.shot && b.shot.idx === o.idx && b.shot.t < 0.25 && me.z === 0) return defense(o, seen);   // 막 올라간 슛도 견제
    return chase();
  };
};
