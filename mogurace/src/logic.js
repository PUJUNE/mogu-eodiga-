// logic.js — 차량 물리 + 마우스 입력 해석 + 충돌·체크포인트 (DOM 무의존 — node 헤드리스 테스트 가능)
// 조작: 주행 시작 시점의 커서가 기준점. 기준점 대비 위 = 엑셀, 정지 = 유지,
//       아래로 되돌리면 엑셀 뗌, 좌클릭 홀드 = 브레이크, 좌우 = 조향. 전부 절대 위치 매핑.
const M = window.MRC;

// ── 마우스 → 조작 매핑 범위 (화면 비율) ──
const RANGE_Y = 0.30;            // 화면 높이의 30% 위로 밀면 엑셀 전개
const RANGE_X = 0.28;            // 화면 폭의 28% 옆으로 밀면 최대 타각

// ── 차량 물리 ──
const ACCEL = M.MAX_SPEED / 4.6;
const BRAKING = -M.MAX_SPEED / 1.7;
const COAST = -M.MAX_SPEED / 5.5;        // 엑셀 뗐을 때 구름저항
const OFFROAD_DECEL = -M.MAX_SPEED / 1.9;
const OFFROAD_LIMIT = M.MAX_SPEED / 3.6; // 노면 이탈 시 유지 가능한 상한
const STEER = 1.25;                      // 조향 권한
const CENT = 0.32;                       // 커브 원심력 계수
const RAIL_X = 2.05;                     // 가드레일 위치 (도로 반폭 배수)
const CAR_HALF = 0.30, PLAYER_HALF = 0.26;
const HIT_COOL = 0.55;                   // 충돌 재판정 쿨다운 (초)
const IDLE_CLOSE = 1.8;                  // 커서 이탈 시 엑셀이 닫히는 속도 (1/초)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

M.Logic = {
  // 화면 좌표 → 조작량. 순수 함수라 테스트에서 경계값을 그대로 찍어볼 수 있다.
  readInput(inp) {
    const ry = Math.max(1, inp.h * RANGE_Y);
    const rx = Math.max(1, inp.w * RANGE_X);
    return {
      throttle: clamp((inp.refY - inp.y) / ry, 0, 1),
      steer: clamp((inp.x - inp.refX) / rx, -1, 1),
      brake: !!inp.brake,
    };
  },

  create(no) {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'ready',
      pos: 0, speed: 0, playerX: 0,
      time: stage.startTime, elapsed: 0,
      throttle: 0, steer: 0, brake: false,
      cpPassed: 0, nextCpAt: stage.checkpoints.length ? stage.checkpoints[0] : stage.total,
      cars: stage.cars.map((c) => Object.assign({}, c)),
      hitT: 0, railT: 0, offT: 0, stars: 0,
      maxSpeed: 0,
    };
  },

  step(st, dt, inp) {
    const ev = [];
    const stg = st.stage;

    // ── 입력 해석 (기준점 절대 매핑, 커서 이탈 시 엑셀만 서서히 닫힘) ──
    if (inp && inp.active) {
      const r = this.readInput(inp);
      st.throttle = r.throttle; st.steer = r.steer; st.brake = r.brake;
    } else {
      st.throttle = Math.max(0, st.throttle - IDLE_CLOSE * dt);
      if (inp) st.brake = !!inp.brake;
    }

    if (st.phase === 'ready') {
      if (st.throttle > 0.02) { st.phase = 'run'; ev.push({ type: 'start' }); }
      return ev;
    }
    if (st.phase !== 'run') return ev;

    st.elapsed += dt;
    st.time -= dt;

    const seg = stg.segAt(st.pos);
    const speedPct = st.speed / M.MAX_SPEED;

    // ── 종방향: 엑셀·브레이크·구름저항 ──
    if (st.brake) st.speed += BRAKING * dt;
    else if (st.throttle > 0) st.speed += ACCEL * st.throttle * dt;
    else st.speed += COAST * dt;

    // ── 횡방향: 조향 + 커브 원심력 ──
    const dx = dt * 2 * speedPct;
    st.playerX += st.steer * dx * STEER;
    st.playerX -= dx * speedPct * seg.curve * CENT;

    // ── 노면 이탈·가드레일 ──
    const off = Math.abs(st.playerX) > 1;
    if (off && st.speed > OFFROAD_LIMIT) {
      st.speed += OFFROAD_DECEL * dt;
      st.offT = 0.25;
      if (!st.offFlag) { st.offFlag = true; ev.push({ type: 'offroad' }); }
    } else if (!off) { st.offFlag = false; }
    if (st.offT > 0) st.offT -= dt;

    if (Math.abs(st.playerX) > RAIL_X) {
      st.playerX = clamp(st.playerX, -RAIL_X, RAIL_X) * 0.94;
      st.speed *= 0.55;
      st.railT = 0.4;
      ev.push({ type: 'rail' });
    }
    if (st.railT > 0) st.railT -= dt;

    st.speed = clamp(st.speed, 0, M.MAX_SPEED);
    if (st.speed > st.maxSpeed) st.maxSpeed = st.speed;

    // ── 교통 차량 전진 + 충돌 ──
    // 부딪히면 앞차를 밀어내는 대신 플레이어가 옆으로 스치며 빠진다.
    // (차를 앞으로 옮기면 다음 프레임에 곧바로 다시 받아 무한 재충돌이 난다)
    this._updateCars(st, dt);
    if (st.hitT <= 0) {
      const sep = CAR_HALF + PLAYER_HALF;
      for (const c of st.cars) {
        const gap = c.z - st.pos;
        if (gap < -M.SEG_LEN * 0.6 || gap > M.SEG_LEN * 1.2 || st.speed <= c.speed) continue;
        if (Math.abs(st.playerX - c.offset) >= sep) continue;
        st.speed = Math.min(st.speed, c.speed * 0.78);
        const outL = c.offset - sep - 0.10, outR = c.offset + sep + 0.10;
        st.playerX = Math.abs(outL) < Math.abs(outR) ? outL : outR;   // 도로 안쪽으로 밀려남
        st.hitT = HIT_COOL;
        ev.push({ type: 'hit' });
        break;
      }
    }
    if (st.hitT > 0) st.hitT -= dt;

    // ── 전진·체크포인트·종료 ──
    const before = st.pos;
    st.pos += st.speed * dt;
    const segIdx = Math.floor(st.pos / M.SEG_LEN);
    while (st.cpPassed < stg.checkpoints.length && segIdx >= stg.checkpoints[st.cpPassed]) {
      st.cpPassed++;
      st.time += stg.cpBonus;
      ev.push({ type: 'checkpoint', n: st.cpPassed, bonus: stg.cpBonus });
    }
    st.nextCpAt = st.cpPassed < stg.checkpoints.length ? stg.checkpoints[st.cpPassed] : stg.total;

    if (st.pos >= stg.length) {
      st.pos = stg.length;
      st.phase = 'finish';
      st.stars = st.time >= stg.cpBonus * 0.30 ? 3 : st.time >= stg.cpBonus * 0.15 ? 2 : 1;
      ev.push({ type: 'finish', stars: st.stars, time: st.elapsed, left: st.time });
    } else if (st.time <= 0) {
      st.time = 0;
      st.phase = 'timeout';
      st.stars = 0;
      ev.push({ type: 'timeout', dist: st.pos });
    }
    if (before === st.pos && st.speed === 0) st.stalled = (st.stalled || 0) + dt;
    else st.stalled = 0;

    return ev;
  },

  // 교통 차량: 전진 + 앞차를 만나면 차선을 살짝 비켜준다 (플레이어와 무관하게 결정적)
  _updateCars(st, dt) {
    const L = st.stage.length;
    for (const c of st.cars) {
      c.z += c.speed * dt;
      if (c.z > L) c.z -= L;
      c.offset += Math.sin(c.z / 9000 + c.hue) * 0.12 * dt;
      c.offset = clamp(c.offset, -0.82, 0.82);
    }
  },

  // 진행률 0~1 (HUD·결과 표시용)
  progress(st) { return clamp(st.pos / st.stage.length, 0, 1); },
};
