// logic.js — 활강·도약·비행·착지 물리 (DOM 무의존 — node 헤드리스 테스트 가능)
// 조작: 버튼을 꾹 누르면 출발 + 웅크려 점프 준비(차지), 도약대 끝에서 손을 떼면 도약.
// 릴리즈 타이밍이 도약력과 활공 자세를 함께 정한다 (공중 추가 조작 없음).
const M = window.MSJ;

const G0 = 9.81;
const REL_WIN = 0.28;            // 릴리즈 타이밍 허용 오차 (초)
const LATE_WIN = 0.18;           // 립 통과 후 늦은 릴리즈 부분 인정 (초)
const CHARGE_T = 0.8;            // 완충까지 필요한 홀드 시간 (초)
const BASE_HOP = 2.3, JUMP_BONUS = 3.1;

M.Logic = {
  create(no) {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'ready', t: 0, ft: 0,
      s: stage.L, v: 0,                     // 활강: 립까지 남은 거리·속도
      x: 0, y: 0, vx: 0, vy: 0,             // 비행 (x=전진거리, y=높이)
      holding: false, charge: 0, releaseAt: null,
      untilLip: 99, q: 0,
      dist: 0, crash: false, stars: 0, landT: 0,
    };
  },

  // 활공 자세 품질: 릴리즈 품질이 비행 전체의 자세를 정함
  poseQ(st) { return 0.35 + 0.65 * st.q; },

  _quality(st) {
    if (st.releaseAt === null) return 0;
    const cf = Math.min(1, st.charge / (CHARGE_T * 0.9));   // 충분히 웅크렸는가
    return Math.max(0, 1 - st.releaseAt / REL_WIN) * cf;
  },

  step(st, dt, input) {
    const ev = [];
    const stg = st.stage;
    st.t += dt;

    if (st.phase === 'ready') {
      if (input.btn) {
        st.phase = 'slide'; st.holding = true;
        ev.push({ type: 'start' });
      }

    } else if (st.phase === 'slide') {
      st.v += stg.a * dt;
      st.s -= st.v * dt;
      st.untilLip = st.s / Math.max(st.v, 0.1);
      if (st.holding) {
        if (input.btn) st.charge = Math.min(1, st.charge + dt / CHARGE_T);
        else { st.holding = false; st.releaseAt = st.untilLip; ev.push({ type: 'release' }); }
      }
      if (st.s <= 0) {
        // ── 도약 (릴리즈 품질 확정 — 아직 안 뗐으면 늦은 릴리즈 대기) ──
        st.q = this._quality(st);
        const th = 9.5 * Math.PI / 180;
        st.x = 0; st.y = 0;
        st.vx = st.v * Math.cos(th);
        st.vy = -st.v * Math.sin(th) + BASE_HOP + JUMP_BONUS * st.q;
        st.phase = 'flight'; st.ft = 0;
        ev.push({ type: 'takeoff', q: st.q, pending: st.holding });
      }

    } else if (st.phase === 'flight') {
      st.ft += dt;
      // 립 통과 직후의 늦은 릴리즈 (부분 인정)
      if (st.holding && !input.btn) {
        st.holding = false;
        if (st.ft < LATE_WIN) {
          st.q = Math.max(st.q, (0.65 - st.ft * 2.5) * Math.min(1, st.charge / (CHARGE_T * 0.9)));
          st.vy += JUMP_BONUS * st.q * 0.6;
          ev.push({ type: 'takeoff', q: st.q, late: true });
        }
      }
      // 활공 (자세 = 릴리즈 품질로 고정, 추가 조작 없음)
      const pq = this.poseQ(st);
      let lift = stg.cl * st.vx * st.vx * pq + 0.055 * stg.wind;
      lift = Math.min(lift, 8.8);
      st.vy += (-G0 + lift) * dt;
      st.vx -= 0.016 * (1.3 - pq) * st.vx * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      // 착지
      if (st.y <= stg.hillY(st.x)) {
        st.crash = st.q < 0.15;                          // 타이밍을 놓치면 데굴데굴
        st.dist = Math.round(Math.sqrt(st.x * st.x + st.y * st.y) * 2) / 2;
        const T = stg.target;
        st.stars = st.dist >= T * 1.14 ? 3 : st.dist >= T * 1.07 ? 2 : st.dist >= T ? 1 : 0;
        if (st.crash && st.stars > 1) st.stars = 1;
        st.phase = 'landed'; st.landT = 0;
        ev.push({ type: 'land', dist: st.dist, stars: st.stars, crash: st.crash });
      }

    } else if (st.phase === 'landed') {
      st.landT += dt;
      st.x += Math.max(0, st.vx * Math.exp(-st.landT * 1.4)) * dt;
      st.y = stg.hillY(st.x);
    }
    return ev;
  },
};
