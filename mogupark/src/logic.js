// logic.js — 저속 차량 물리 + 마우스 앵커 입력 해석 + OBB 충돌·주차 판정·궤적 기록
// (DOM 무의존 — node 헤드리스 테스트 가능)
// 조작은 모구레이스 문법: 준비 화면에서 클릭한 자리가 기준점, 위 = 엑셀,
// 데드존 = 페달 오프(크리프), 아래 = 브레이크, 좌우 = 핸들. 절대 위치 매핑.
const M = window.MPK;

// ── 마우스 → 조작 매핑 범위 (화면 비율, 모구레이스와 동일 계열) ──
const RANGE_Y = 0.28;            // 기준점에서 화면 높이 28% 위 = 엑셀 전개
const BRAKE_Y = 0.20;            // 20% 아래 = 풀 브레이크
const DEAD_Y = 0.035;            // 데드존 — 페달 오프 (크리프 주행)
const RANGE_X = 0.30;            // 화면 폭 30% 옆 = 핸들 풀 록

// ── 차량 물리 (주차 속도 영역) ──
const VMAX_F = 5.6;              // 전진 상한 (m/s, ≈20km/h)
const VMAX_R = 3.0;              // 후진 상한
const ACCEL = 2.4;               // 엑셀 최대 가속
const BRAKE_A = 6.5;             // 풀 브레이크 감속
const COAST = 0.9;               // N단 구름저항
const CREEP = 0.85;              // 오토 크리프 목표 속도 — 정밀 주차의 핵심
const STEER_RATE = 2.1;          // 핸들이 도는 속도 (로드휠 rad/s) — 풀 록까지 약 0.6초
const HEAD_MAX = 2.05;           // 고개 최대 회전 (rad, ≈117° — B필러 너머까지)
const PARK_HOLD = 1.0;           // 칸 안 정지 유지 시간 (초) → 성공
const ANG_TOL = 0.21;            // 주차 인정 각도 (rad, ≈12°)
const CURB_COOL = 0.5;           // 연석 쿵 재판정 쿨다운
const REC_DT = 0.08;             // 궤적 기록 주기 (리플레이용)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// 회전 사각형(OBB) 네 꼭짓점
function corners(x, z, w, l, yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw), hw = w / 2, hl = l / 2;
  // 로컬 (lx, lz) → 월드: x + lx·cos + lz·sin, z − lx·sin + lz·cos
  return [[-hw, hl], [hw, hl], [hw, -hl], [-hw, -hl]]
    .map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
}

// OBB 대 OBB 겹침 (SAT, 축 4개)
function obbOverlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < 2; i++) {
      const ex = P[(i + 1) % 4][0] - P[i][0], ez = P[(i + 1) % 4][1] - P[i][1];
      const ax = -ez, az = ex;                                  // 변의 법선축
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [px, pz] of A) { const d = px * ax + pz * az; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const [px, pz] of B) { const d = px * ax + pz * az; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      if (a1 < b0 || b1 < a0) return false;                     // 분리축 발견
    }
  }
  return true;
}

M.Logic = {
  RANGE_Y, BRAKE_Y, DEAD_Y, RANGE_X, VMAX_F, VMAX_R, CREEP, HEAD_MAX, PARK_HOLD,
  corners, obbOverlap, wrapPi,

  // 화면 좌표 → 조작량. 순수 함수 — 테스트에서 경계값을 그대로 찍는다.
  readInput(inp) {
    const dy = (inp.refY - inp.y) / Math.max(1, inp.h);         // + = 기준점 위
    let throttle = 0, brake = 0;
    if (dy > DEAD_Y) throttle = clamp((dy - DEAD_Y) / (RANGE_Y - DEAD_Y), 0, 1);
    else if (dy < -DEAD_Y) brake = clamp((-dy - DEAD_Y) / (BRAKE_Y - DEAD_Y), 0, 1);
    return {
      throttle, brake,
      steer: clamp((inp.x - inp.refX) / Math.max(1, inp.w * RANGE_X), -1, 1),
    };
  },

  create(no) {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'ready',                                // ready | run | parked | crash | timeout
      car: { x: stage.start.x, z: stage.start.z, h: stage.start.h, v: 0, steer: 0, gear: 'N', headYaw: 0 },
      time: stage.timeLimit, elapsed: 0,
      throttle: 0, brake: 0, steerIn: 0,
      parkT: 0, curbT: 0, curbHits: 0, gearShifts: 0,
      stars: 0, resultAng: 0, resultLat: 0,
      rec: [], recT: 0, crashAt: null,
      // 장애물 OBB 캐시 (충돌 판정용)
      _obs: stage.obstacles.map((o) => ({ o, poly: corners(o.x, o.z, o.w, o.l, o.yaw), solid: o.kind !== 'curb' })),
    };
  },

  carPoly(car) { return corners(car.x, car.z, M.CAR.W, M.CAR.L, car.h); },

  // 목표 칸 기준 좌표에서의 (횡 오프셋, 각도 차). 전면·후면 주차 모두 인정.
  slotFit(st) {
    const t = st.stage.target, car = st.car;
    const s = Math.sin(t.yaw), c = Math.cos(t.yaw);
    const dx = car.x - t.x, dz = car.z - t.z;
    const lx = dx * c - dz * s;                                 // 칸 축 기준 횡 방향
    let ang = wrapPi(car.h - t.yaw);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    const inside = this.carPoly(car).every(([px, pz]) => {
      const rx = (px - t.x) * c - (pz - t.z) * s, rz = (px - t.x) * s + (pz - t.z) * c;
      return Math.abs(rx) <= t.w / 2 + 0.02 && Math.abs(rz) <= t.l / 2 + 0.02;
    });
    return { lat: lx, ang, inside };
  },

  step(st, dt, inp) {
    const ev = [];
    const car = st.car;

    // ── 입력 해석 ──
    if (inp && inp.active) {
      const r = this.readInput(inp);
      st.throttle = r.throttle; st.brake = r.brake; st.steerIn = r.steer;
    } else { st.throttle = 0; st.brake = 0; }                   // 커서 이탈 = 페달 오프 (크리프는 유지)

    // 고개 돌리기 — 누르는 동안 돌아가고 놓으면 정면 복귀 (판정과 무관, 항상 동작)
    const lookTgt = (inp ? inp.look : 0) * HEAD_MAX;
    car.headYaw += (lookTgt - car.headYaw) * Math.min(1, 6.5 * dt);

    if (st.phase === 'ready') { if (inp) { inp.shift = 0; inp.gearTo = 0; } return ev; }
    if (st.phase !== 'run') return ev;

    st.elapsed += dt;
    st.time -= dt;

    // ── 기어 (R ↔ N ↔ D 순차 + 직결) ──
    if (inp && (inp.shift || inp.gearTo)) {
      const ORDER = ['R', 'N', 'D'];
      let g = car.gear;
      if (inp.gearTo) g = inp.gearTo;
      else g = ORDER[clamp(ORDER.indexOf(car.gear) + inp.shift, 0, 2)];
      inp.shift = 0; inp.gearTo = 0;
      if (g !== car.gear) { car.gear = g; st.gearShifts++; ev.push({ type: 'gear', gear: g }); }
    }

    // ── 종방향: 브레이크 > 엑셀 > 크리프 (오토차 감각) ──
    const dir = car.gear === 'D' ? 1 : car.gear === 'R' ? -1 : 0;
    if (st.brake > 0.02) {
      const d = (1.4 + BRAKE_A * st.brake) * dt;
      car.v = Math.abs(car.v) <= d ? 0 : car.v - Math.sign(car.v) * d;
    } else if (dir !== 0 && st.throttle > 0.02) {
      car.v += dir * (0.8 + ACCEL * st.throttle) * dt;
    } else if (dir !== 0) {
      // 크리프: 기어 방향 0.85m/s로 수렴 — 페달 없이 슬금슬금
      car.v += clamp(dir * CREEP - car.v, -1.6 * dt, 1.6 * dt);
    } else {
      const d = COAST * dt;
      car.v = Math.abs(car.v) <= d ? 0 : car.v - Math.sign(car.v) * d;
    }
    car.v = clamp(car.v, -VMAX_R, VMAX_F);

    // ── 핸들: 목표 조향각으로 일정 속도 추종 ──
    const steerTgt = st.steerIn * M.CAR.LOCK;
    const ds = STEER_RATE * dt;
    car.steer += clamp(steerTgt - car.steer, -ds, ds);

    // ── 자전거 모델 적분 ──
    const px = car.x, pz = car.z, ph = car.h;
    if (Math.abs(car.v) > 1e-4) {
      car.h += (car.v / M.CAR.WB) * Math.tan(car.steer) * dt;
      car.x += Math.sin(car.h) * car.v * dt;
      car.z += Math.cos(car.h) * car.v * dt;
    }

    // ── 충돌: 연석은 쿵+정지, 그 외는 실패 ──
    if (st.curbT > 0) st.curbT -= dt;
    const poly = this.carPoly(car);
    for (const ob of st._obs) {
      if (!obbOverlap(poly, ob.poly)) continue;
      if (ob.solid) {
        st.phase = 'crash';
        st.crashAt = [(car.x + ob.o.x) / 2, (car.z + ob.o.z) / 2];
        this._record(st, true);
        ev.push({ type: 'crash' });
        return ev;
      }
      // 연석: 이동 취소 + 정지. ★3 조건(연석 무접촉)을 잃는다.
      car.x = px; car.z = pz; car.h = ph; car.v = 0;
      if (st.curbT <= 0) { st.curbHits++; st.curbT = CURB_COOL; ev.push({ type: 'curb' }); }
      break;
    }

    // ── 주차 판정: 네 모서리가 칸 안 + 각도 정렬 + 정지 1초 유지 ──
    const fit = this.slotFit(st);
    st.fitNow = fit;
    if (fit.inside && Math.abs(fit.ang) < ANG_TOL && Math.abs(car.v) < 0.06) {
      st.parkT += dt;
      if (st.parkT >= PARK_HOLD) {
        st.phase = 'parked';
        st.resultAng = Math.abs(fit.ang) * 180 / Math.PI;
        st.resultLat = Math.abs(fit.lat);
        st.stars = (st.resultAng <= 3.5 && st.resultLat <= 0.16 && st.curbHits === 0) ? 3
          : (st.resultAng <= 8 && st.resultLat <= 0.34) ? 2 : 1;
        this._record(st, true);
        ev.push({ type: 'parked', stars: st.stars });
        return ev;
      }
    } else st.parkT = 0;

    if (st.time <= 0) {
      st.time = 0; st.phase = 'timeout'; st.stars = 0;
      this._record(st, true);
      ev.push({ type: 'timeout' });
      return ev;
    }

    this._record(st, false);
    return ev;
  },

  // 리플레이용 궤적 샘플 (t, x, z, h, steer)
  _record(st, force) {
    if (!force && st.elapsed - st.recT < REC_DT) return;
    st.recT = st.elapsed;
    st.rec.push([st.elapsed, st.car.x, st.car.z, st.car.h, st.car.steer]);
  },

  // 준비 → 주행 시작 (기준점이 잡힌 순간 타이머가 흐른다)
  begin(st) { if (st.phase === 'ready') { st.phase = 'run'; this._record(st, true); } },
};
