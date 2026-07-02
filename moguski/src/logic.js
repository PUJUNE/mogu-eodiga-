// logic.js — 활강·도약·비행·착지 물리 (DOM 무의존 — node 헤드리스 테스트 가능)
const M = window.MSJ;

const G0 = 9.81;
const TAP_WIN = 0.28;            // 도약 타이밍 허용 오차 (초)
const ZONE_LO = 0.45, ZONE_HI = 0.80;   // 자세 게이지 초록 존
const TELE_H = 3.2;              // 착지 창이 열리는 고도 (m)

const BASE_HOP = 2.3, JUMP_BONUS = 3.1;   // 자동 점프 / 타이밍 보너스 (m/s)

M.Logic = {
  create(no) {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'ready', t: 0, ft: 0,
      s: stage.L, v: 0,                     // 활강: 립까지 남은 거리·속도
      x: 0, y: 0, vx: 0, vy: 0,             // 비행 (y 위+)
      P: 0.55,                              // 자세 게이지 0..1
      untilLip: 99, tapAt: null, jumpQ: 0, lateOk: true,
      teleOpen: false, teleTapped: false, teleQ: 0,
      dist: 0, crash: false, stars: 0, styleWobble: 0,
      pqSum: 0, pqN: 0,
    };
  },

  postureQ(P) {
    if (P >= ZONE_LO && P <= ZONE_HI) return 1;
    const d = P < ZONE_LO ? ZONE_LO - P : P - ZONE_HI;
    return Math.max(0, 1 - d / 0.4);
  },

  step(st, dt, input) {
    const ev = [];
    const stg = st.stage;
    st.t += dt;

    if (st.phase === 'ready') {
      if (input.tap) { st.phase = 'slide'; ev.push({ type: 'start' }); }

    } else if (st.phase === 'slide') {
      st.v += stg.a * dt;
      st.s -= st.v * dt;
      st.untilLip = st.s / Math.max(st.v, 0.1);
      if (input.tap) {
        if (st.untilLip <= 0.9) { st.tapAt = st.untilLip; ev.push({ type: 'tap' }); }
        else ev.push({ type: 'earlytap' });      // 너무 이른 탭은 무효
      }
      if (st.s <= 0) {
        // ── 도약 ──
        const q = st.tapAt !== null ? Math.max(0, 1 - st.tapAt / TAP_WIN) : 0;
        st.jumpQ = q;
        st.lateOk = st.tapAt === null;           // 립 직후 늦은 탭 허용 여부
        const th = 9.5 * Math.PI / 180;
        st.x = 0; st.y = 0;
        st.vx = st.v * Math.cos(th);
        st.vy = -st.v * Math.sin(th) + BASE_HOP + JUMP_BONUS * q;
        st.phase = 'flight'; st.ft = 0;
        ev.push({ type: 'takeoff', q });
      }

    } else if (st.phase === 'flight') {
      st.ft += dt;
      // 늦은 탭 (립 통과 직후 0.18초까지 부분 인정)
      if (input.tap && st.lateOk && st.ft < 0.18) {
        st.lateOk = false;
        st.jumpQ = Math.max(st.jumpQ, 0.65 - st.ft * 2.5);
        st.vy += JUMP_BONUS * (0.65 - st.ft * 2.5) * 0.6;
        ev.push({ type: 'takeoff', q: st.jumpQ, late: true });
      }
      // 자세 게이지
      st.P += (input.btn ? 1.5 : -1.7) * dt;
      st.P = Math.max(0, Math.min(1, st.P));
      const pq = this.postureQ(st.P);
      st.pqSum += pq * dt; st.pqN += dt;
      if (pq < 0.3) st.styleWobble += dt;
      // 양력·항력·바람
      let lift = stg.cl * st.vx * st.vx * pq + 0.055 * stg.wind;
      lift = Math.min(lift, 8.8);
      st.vy += (-G0 + lift) * dt;
      st.vx -= 0.016 * (1.3 - pq) * st.vx * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      // 착지 창 (텔레마크)
      const h = st.y - stg.hillY(st.x);
      st.teleOpen = h < TELE_H;
      if (st.teleOpen && input.tap && !st.teleTapped) {
        st.teleTapped = true;
        st.teleQ = Math.max(0.2, Math.min(1, (TELE_H - h) / 2.2));
        ev.push({ type: 'telemark', q: st.teleQ });
      }
      // 착지
      if (st.y <= stg.hillY(st.x)) {
        st.crash = st.P < 0.18 || st.P > 0.94;
        let d = Math.sqrt(st.x * st.x + st.y * st.y);
        if (st.teleTapped && !st.crash) d += (1.5 + stg.K * 0.02) * st.teleQ;
        st.dist = Math.round(d * 2) / 2;                 // 0.5m 단위 (스키점프 관례)
        const T = stg.target;
        st.stars = st.dist >= T * 1.14 ? 3 : st.dist >= T * 1.07 ? 2 : st.dist >= T ? 1 : 0;
        if (st.crash && st.stars > 1) st.stars = 1;      // 구르면 별 제한
        st.phase = 'landed'; st.landT = 0;
        ev.push({ type: 'land', dist: st.dist, stars: st.stars, crash: st.crash, tele: st.teleTapped ? st.teleQ : 0 });
      }

    } else if (st.phase === 'landed') {
      st.landT += dt;
      // 착지 후 관성 미끄러짐 (연출용)
      st.x += Math.max(0, st.vx * Math.exp(-st.landT * 1.4)) * dt;
      st.y = stg.hillY(st.x);
    }
    return ev;
  },
};
