// logic.js — 차량 물리 + 마우스 입력 해석 + 충돌·체크포인트 (DOM 무의존 — node 헤드리스 테스트 가능)
// 조작: 준비 화면에서 클릭한 자리가 기준점. 기준점 위 = 엑셀(거리 비례),
//       기준점 주변 데드존 = 페달 오프(관성 감속), 기준점 아래 = 브레이크(거리 비례),
//       좌우 = 조향. 전부 절대 위치 매핑이고 손을 멈추면 그 입력이 유지된다.
const M = window.MRC;

// ── 마우스 → 조작 매핑 범위 (화면 비율) ──
const RANGE_Y = 0.30;            // 기준점에서 화면 높이 30% 위 = 엑셀 전개
const BRAKE_Y = 0.20;            // 기준점에서 화면 높이 20% 아래 = 풀 브레이크
const DEAD_Y = 0.035;            // 기준점 주변 데드존(작은 원) — 엑셀도 브레이크도 밟지 않음
const RANGE_X = 0.5;             // 화면 폭의 50% 옆으로 밀면 최대 타각
                                 // 28%였을 때는 포인터가 조금만 흔들려도 차가 휙휙 꺾여서 절반 남짓의
                                 // 민감도로 낮췄다. 조향 권한(STEER)은 그대로라 크게 밀면 타각은 다 나온다.
                                 // 화면 폭의 절반으로 잡은 건 기준점이 가운데일 때 화면 끝까지 밀면
                                 // 최대 타각에 닿게 하기 위함 — 더 넓히면 풀타각이 아예 안 나온다.

// ── 차량 물리 ──
const ACCEL = M.MAX_SPEED / 4.6;
const BRAKING = -M.MAX_SPEED / 1.7;
const COAST = -M.MAX_SPEED / 9;          // 엑셀 뗐을 때 구름저항 — 풀 속도에서 멈추기까지 9초
                                         // (5.5초는 페달만 떼도 브레이크처럼 섰고, 14초는 관성이
                                         //  너무 유지되어 감속이 전부 브레이크 몫이 됨 — 중간으로 조율)
const OFFROAD_DECEL = -M.MAX_SPEED / 1.9;
const OFFROAD_LIMIT = M.MAX_SPEED / 3.6; // 노면 이탈 시 유지 가능한 상한
const STEER = 1.25;                      // 조향 권한
const CENT = 0.32;                       // 커브 원심력 계수
const RAIL_X = 2.05;                     // 가드레일 위치 (도로 반폭 배수)
// 차폭은 도로 반폭(=1.0) 기준. 3차선이므로 차선 하나가 0.667.
// 렌더는 이 값을 그대로 투영해 그리므로 "보이는 폭 = 부딪히는 폭"이 성립한다.
const CAR_HALF = 0.19, PLAYER_HALF = 0.165;  // 차폭 0.38 / 0.33 ≈ 차선의 57% / 50%
const CAR_LEN = 260;                     // 차 길이(월드 단위) — 전후 충돌 판정 폭
// 실주행 프레임 dt 상한 — 한 프레임 이동(MAX_SPEED × dt)이 관통 임계(CAR_LEN×2)를
// 넘지 않도록 물리와 묶는다. 18000 × 1/36 = 500 < 520. (main.js와 테스트가 공유)
const DT_CAP = 1 / 36;
const HIT_COOL = 0.55;                   // 충돌 재판정 쿨다운 (초)

// ── 교통 차량 차선 변경 ──
// 순서는 실제 도로와 같다: ① 깜빡이 점등 → ② 잠깐 뒤 차선 이동 → ③ 도착하면 소등.
// 깜빡이 없이 움직이는 경로는 없다 (_updateCars의 상태 기계가 유일한 이동 통로다).
const LANE_OFF = (lane) => (lane - (M.LANES - 1) / 2) * (2 / M.LANES);
const BLINK_LEAD = 0.9;                  // 깜빡이를 켜고 실제로 움직이기까지 (초)
const LANE_MOVE = 1.15;                  // 차선 하나를 건너는 데 걸리는 시간 (초)
const LANE_GAP = 2.6;                    // 옮겨갈 차선 앞뒤로 비어 있어야 하는 거리 (CAR_LEN 배수)
const LANE_WAIT = [1.6, 4.2];            // 다음 차선 변경을 노리기까지 (초) — 자주 바꾼다
const LANE_RETRY = [0.6, 1.4];           // 옆 차선이 막혀 있었을 때 다시 볼 때까지 (초)
const IDLE_CLOSE = 1.8;                  // 커서 이탈 시 엑셀이 닫히는 속도 (1/초)

// ── 변속 (오토·스틱 공용 물리 — 오토는 변속만 자동) ──
// 기어별 도달 상한과 견인 배수. 저단은 세게 당기고 일찍 한계가 온다.
const GEAR_TOPS = [0.17, 0.31, 0.47, 0.63, 0.81, 1.0].map((f) => f * M.MAX_SPEED);
const GEAR_PULL = [1.9, 1.55, 1.3, 1.12, 0.97, 0.85];
const SHIFT_CUT = 0.16;                  // 변속 직후 토크 컷 (초) — 다운시프트는 절반
const RPM_UP = 0.93, RPM_DOWN = 0.34;    // 오토 변속 임계 (히스테리시스)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

M.Logic = {
  // 렌더·테스트가 같은 값을 쓰도록 공개한다 — 여기서 갈라지면 판정과 표시가 어긋난다
  CAR_HALF, PLAYER_HALF, CAR_LEN, DT_CAP,
  RANGE_Y, BRAKE_Y, DEAD_Y, RANGE_X,
  GEAR_TOPS,

  // 화면 좌표 → 조작량. 순수 함수라 테스트에서 경계값을 그대로 찍어볼 수 있다.
  // Y축: 데드존 위 = 엑셀 0→1, 데드존 안 = 둘 다 0(관성), 데드존 아래 = 브레이크 0→1.
  readInput(inp) {
    const dy = (inp.refY - inp.y) / Math.max(1, inp.h);   // + = 기준점 위
    let throttle = 0, brake = 0;
    if (dy > DEAD_Y) throttle = clamp((dy - DEAD_Y) / (RANGE_Y - DEAD_Y), 0, 1);
    else if (dy < -DEAD_Y) brake = clamp((-dy - DEAD_Y) / (BRAKE_Y - DEAD_Y), 0, 1);
    return {
      throttle, brake,
      steer: clamp((inp.x - inp.refX) / Math.max(1, inp.w * RANGE_X), -1, 1),
    };
  },

  create(no, trans = 'auto') {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'ready',
      // 주행 중 판단(차선 변경)용 난수. 스테이지 생성 난수와 분리해 두고 st에 담아야
      // 같은 코스를 다시 달릴 때 처음부터 같은 흐름이 재현된다.
      rng: M.makeRng(no * 104729 + 977),
      pos: 0, speed: 0, playerX: 0,
      time: stage.startTime, elapsed: 0,
      throttle: 0, steer: 0, brake: 0,
      trans, gear: 1, rpm: 0, shiftT: 0,
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
      st.brake = 0;
    }

    if (st.phase === 'ready') {
      if (inp) { inp.shift = 0; inp.gearTo = 0; }                // 출발 전 변속 입력 무시
      if (st.throttle > 0.02) { st.phase = 'run'; ev.push({ type: 'start' }); }
      return ev;
    }
    if (st.phase !== 'run') return ev;

    st.elapsed += dt;
    st.time -= dt;

    const seg = stg.segAt(st.pos);
    const speedPct = st.speed / M.MAX_SPEED;

    // ── 변속·RPM ──
    // rpm = 현재 기어 상한 대비 속도. 저단으로 과속 상태면 1을 넘는 오버레브.
    if (st.shiftT > 0) st.shiftT -= dt;
    if (st.trans === 'auto') {
      if (st.shiftT <= 0) {
        const r = st.speed / GEAR_TOPS[st.gear - 1];
        if (r > RPM_UP && st.gear < 6) { st.gear++; st.shiftT = SHIFT_CUT; ev.push({ type: 'shift', gear: st.gear }); }
        else if (r < RPM_DOWN && st.gear > 1) { st.gear--; st.shiftT = SHIFT_CUT * 0.5; }
      }
    } else if (inp && (inp.shift || inp.gearTo)) {
      // 순차(휠·클릭 ±1)와 직결(H패턴 버튼·QAWSED 키, 원하는 단으로 바로) 둘 다 지원.
      // 직결은 단을 건너뛸 수 있다 — 급다운시프트의 오버레브 엔진 브레이크는 rpm 물리가 처리.
      const g = inp.gearTo ? inp.gearTo : st.gear + (inp.shift > 0 ? 1 : -1);
      inp.shift = 0; inp.gearTo = 0;                             // 원샷 소비
      if (g >= 1 && g <= 6 && g !== st.gear) {
        st.shiftT = SHIFT_CUT * (g > st.gear ? 1 : 0.5);
        st.gear = g;
        ev.push({ type: 'shift', gear: st.gear });
      }
    }
    st.rpm = clamp(st.speed / GEAR_TOPS[st.gear - 1], 0, 1.15);

    // ── 종방향: 엑셀·브레이크·구름저항 ──
    // 브레이크는 관성 감속(COAST)에서 시작해 깊이에 따라 풀 브레이크(BRAKING)로 보간한다
    // (BRAKING×깊이로 하면 얕은 브레이크가 구름저항보다 약한 모순이 난다).
    // 엔진 견인은 기어에 물려 있다 — 레드라인에서 토크 0, 고단 저회전에서는 약하게 붙는다.
    if (st.brake > 0) st.speed += (COAST + (BRAKING - COAST) * st.brake) * dt;
    else if (st.throttle > 0 && st.shiftT <= 0) {
      let tq = 1;
      if (st.rpm >= 1) tq = 0;                                   // 레드라인 리미터
      else if (st.rpm > 0.9) tq = 0.4 + ((1 - st.rpm) / 0.1) * 0.6;   // 상단 테이퍼
      else if (st.rpm < 0.15) tq = 0.35 + (st.rpm / 0.15) * 0.65;     // 저회전 럭
      st.speed += ACCEL * GEAR_PULL[st.gear - 1] * tq * st.throttle * dt;
      if (tq === 0) st.speed += COAST * 0.4 * dt;                // 리미터에 걸린 채 유지 방지
    } else st.speed += COAST * dt;                               // 데드존·변속 토크 컷 — 관성 감속
    if (st.rpm > 1.04) st.speed += COAST * 2.2 * dt;             // 오버레브 엔진 브레이크

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

    // ── 교통 차량 전진 ──
    this._updateCars(st, dt);

    // ── 전진·체크포인트·종료 ──
    const before = st.pos;
    st.pos += st.speed * dt;

    // ── 충돌 (전진 뒤에 스윕으로 판정) ──
    // 고정 폭 창으로 보면 최고 속도에서 한 프레임에 200~400단위를 뛰므로 앞차를
    // 통째로 지나쳐 버린다. 직전 위치와 현재 위치 사이를 훑어 통과 여부를 본다.
    // 부딪히면 앞차를 밀어내는 대신 플레이어가 옆으로 스치며 빠진다
    // (차를 앞으로 옮기면 다음 프레임에 곧바로 다시 받아 무한 재충돌이 난다).
    if (st.hitT <= 0) {
      const sep = CAR_HALF + PLAYER_HALF;
      for (const c of st.cars) {
        if (Math.abs(st.playerX - c.offset) >= sep) continue;
        const relNow = c.z - st.pos, relBefore = c.z - before;
        const inside = relNow < CAR_LEN && relNow > -CAR_LEN;          // 지금 겹쳐 있는가
        const swept = relBefore > CAR_LEN && relNow <= CAR_LEN;        // 이번 프레임에 앞차를 파고들었는가
        if (!inside && !swept) continue;
        if (relNow >= relBefore) continue;                             // 멀어지는 중이면 무시
        st.speed = Math.min(st.speed, c.speed * 0.78);
        const outL = c.offset - sep - 0.06, outR = c.offset + sep + 0.06;
        st.playerX = Math.abs(outL) < Math.abs(outR) ? outL : outR;   // 도로 안쪽으로 밀려남
        st.hitT = HIT_COOL;
        ev.push({ type: 'hit' });
        break;
      }
    }
    if (st.hitT > 0) st.hitT -= dt;

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

  // 교통 차량: 전진하면서, 깜빡이를 켠 뒤에만 차선을 바꾼다.
  // c.blink 는 -1(좌) · 0(끔) · +1(우) — 렌더가 이 값으로 방향지시등을 켠다.
  _updateCars(st, dt) {
    const L = st.stage.length, rng = st.rng;
    for (const c of st.cars) {
      c.z += c.speed * dt;
      if (c.z > L) c.z -= L;

      // ③ 도착한 '다음' 프레임에 소등한다 — 조금이라도 움직이는 프레임에는
      // 깜빡이가 반드시 켜져 있어야 한다 (도착 프레임에 같이 끄면 그 한 프레임이 예외가 된다).
      if (c.blink && c.moveT <= 0 && c.blinkT <= 0) c.blink = 0;

      if (c.moveT > 0) {                                  // ② 차선 이동 중 — 깜빡이 켠 채
        c.moveT -= dt;
        const p = clamp(1 - c.moveT / LANE_MOVE, 0, 1);
        c.offset = c.fromOff + (c.toOff - c.fromOff) * p * p * (3 - 2 * p);   // 부드럽게 들고 난다
        if (c.moveT <= 0) {                               // 도착 (소등은 다음 프레임에)
          c.moveT = 0; c.offset = c.toOff; c.lane = c.toLane;
          c.nextT = rng.range(LANE_WAIT[0], LANE_WAIT[1]);
        }
        continue;
      }
      if (c.blinkT > 0) {                                 // ① 깜빡이만 켜고 대기
        c.blinkT -= dt;
        if (c.blinkT <= 0) {
          c.blinkT = 0; c.moveT = LANE_MOVE;
          c.fromOff = c.offset; c.toOff = LANE_OFF(c.toLane);
        }
        continue;
      }

      c.nextT -= dt;                                      // 다음 차선 변경을 노린다
      if (c.nextT > 0) continue;
      const first = rng.chance(0.5) ? -1 : 1;             // 한쪽을 먼저 보고, 막혔으면 반대쪽
      let dir = 0;
      for (const d of (first === -1 ? [-1, 1] : [1, -1])) {
        const to = c.lane + d;
        if (to < 0 || to >= M.LANES) continue;
        if (!this._laneClear(st, c, to)) continue;
        dir = d; c.toLane = to; break;
      }
      if (dir) { c.blink = dir; c.blinkT = BLINK_LEAD; }
      else c.nextT = rng.range(LANE_RETRY[0], LANE_RETRY[1]);
    }
  },

  // 옮겨갈 차선이 앞뒤로 비어 있는가. 이미 그 차선으로 들어가겠다고 깜빡이를 켠
  // 차도 그 차선을 차지한 것으로 본다 — 아니면 둘이 같은 자리로 동시에 들어간다.
  _laneClear(st, car, lane) {
    const L = st.stage.length, gap = CAR_LEN * LANE_GAP;
    for (const o of st.cars) {
      if (o === car) continue;
      if (o.lane !== lane && o.toLane !== lane) continue;
      let d = Math.abs(o.z - car.z);
      if (d > L / 2) d = L - d;                           // 순환 코스라 양끝이 이어져 있다
      if (d < gap) return false;
    }
    return true;
  },

  // 진행률 0~1 (HUD·결과 표시용)
  progress(st) { return clamp(st.pos / st.stage.length, 0, 1); },
};
