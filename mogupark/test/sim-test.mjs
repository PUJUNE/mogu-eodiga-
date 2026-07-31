// sim-test.mjs — 입력 매핑 경계값 · 크리프/브레이크 · 회전 반경 · 충돌 · 주차 판정 · 궤적 기록
// node mogupark/test/sim-test.mjs
import { M, mouse, DT, place } from './shim.mjs';

let fails = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) fails++;
}
const L = M.Logic, C = M.CAR;

// ── 1. 입력 매핑 경계값 ──
{
  const inp = mouse(0, 0);
  const r0 = L.readInput(inp);
  check('데드존: 페달 둘 다 0', r0.throttle === 0 && r0.brake === 0 && r0.steer === 0);
  const rF = L.readInput(mouse(1, 0));
  check('풀 엑셀', rF.throttle === 1 && rF.brake === 0);
  const rB = L.readInput(mouse(0, 0, 1));
  check('풀 브레이크', rB.brake === 1 && rB.throttle === 0);
  const rS = L.readInput(mouse(0, 1));
  check('풀 조향 우', rS.steer === 1);
  const rS2 = L.readInput(mouse(0, -2));
  check('조향 클램프', rS2.steer === -1);
}

// ── 2. 기어·크리프·브레이크 ──
{
  M.diff = 'normal';
  const st = L.create(1);
  L.begin(st);
  const inp = mouse(0, 0);
  inp.gearTo = 'D';
  L.step(st, DT, inp);
  check('기어 D 진입', st.car.gear === 'D');
  for (let i = 0; i < 240; i++) L.step(st, DT, mouse(0, 0));       // 4초 크리프
  check('크리프 전진 (페달 없이)', st.car.v > 0.5 && st.car.v <= L.CREEP + 0.05, `v=${st.car.v.toFixed(2)}`);
  for (let i = 0; i < 120; i++) L.step(st, DT, mouse(0, 0, 1));    // 풀 브레이크
  check('브레이크 정지', st.car.v === 0, `v=${st.car.v}`);
  const inp2 = mouse(0, 0);
  inp2.gearTo = 'R';
  L.step(st, DT, inp2);
  for (let i = 0; i < 240; i++) L.step(st, DT, mouse(0, 0));
  check('R기어 크리프 후진', st.car.v < -0.5, `v=${st.car.v.toFixed(2)}`);
  check('기어 변경 카운트', st.gearShifts === 2, `${st.gearShifts}`);
}

// ── 3. 엑셀 상한·회전 반경 ──
{
  const st = L.create(1);
  L.begin(st);
  st.car.gear = 'D';
  st.car.x = -1000; st.car.z = -1000;                              // 장애물 없는 허공에서
  st._obs = [];
  for (let i = 0; i < 60 * 10; i++) L.step(st, DT, mouse(1, 0));
  check('전진 최고속 상한', st.car.v <= L.VMAX_F + 0.01 && st.car.v > L.VMAX_F - 0.3, `v=${st.car.v.toFixed(2)}`);
  // 풀 록 정속 원운동 → 뒷축 반경 = WB/tan(LOCK)
  const st2 = L.create(1);
  L.begin(st2);
  st2._obs = [];
  place(st2, -1000, -1000, 0, 0, 'D');
  const xs = [], zs = [];
  let armed = false;
  for (let i = 0; i < 60 * 60; i++) {
    L.step(st2, DT, mouse(0.4, 1));
    if (Math.abs(st2.car.steer - C.LOCK) < 1e-3) armed = true;
    if (armed) { xs.push(st2.car.x); zs.push(st2.car.z); }
    if (armed && xs.length > 60 * 25) break;
  }
  const rTurn = (Math.max(...xs) - Math.min(...xs)) / 2;
  const rTheory = C.WB / Math.tan(C.LOCK);
  check('회전 반경 ≈ 이론값', Math.abs(rTurn - rTheory) < 0.6, `r=${rTurn.toFixed(2)} vs ${rTheory.toFixed(2)}`);
}

// ── 4. 충돌: 벽에 박으면 crash, 연석은 쿵+정지 ──
{
  const st = L.create(11);                                         // 마트 (연석 경계)
  L.begin(st);
  st.car.gear = 'D';
  const wallLike = st.stage.obstacles.find((o) => o.kind === 'car');
  // 주차된 차를 정면으로 바라보고 3m 앞에서 돌진
  place(st, wallLike.x, wallLike.z - C.L / 2 - 3, 0, 2, 'D');
  let crashed = false;
  for (let i = 0; i < 60 * 6 && !crashed; i++) {
    for (const e of L.step(st, DT, mouse(1, 0))) if (e.type === 'crash') crashed = true;
  }
  check('주차 차량 충돌 = 실패', crashed && st.phase === 'crash' && !!st.crashAt);

  const st2 = L.create(1);                                         // 연습장 (연석 경계)
  L.begin(st2);
  const curb = st2.stage.obstacles.find((o) => o.kind === 'curb' && o.w > 10);
  let curbed = false;
  place(st2, (st2.stage.lot.x0 + st2.stage.lot.x1) / 2, curb.z + 2.5, Math.PI, 1.5, 'D'); // 연석을 향해 남진
  for (let i = 0; i < 60 * 6 && !curbed; i++) {
    for (const e of L.step(st2, DT, mouse(0.5, 0))) if (e.type === 'curb') curbed = true;
  }
  check('연석 = 쿵 + 정지 (실패 아님)', curbed && st2.phase === 'run' && st2.car.v === 0 && st2.curbHits === 1,
    `phase=${st2.phase} v=${st2.car.v}`);
}

// ── 5. 주차 판정: 칸 안 정지 1초 유지 → 성공, 별점 ──
{
  const st = L.create(1);
  L.begin(st);
  const t = st.stage.target;
  place(st, t.x + 0.05, t.z, t.yaw + 0.02, 0, 'N');                // 거의 완벽히 정렬
  let parked = false;
  for (let i = 0; i < 60 * 2 && !parked; i++) {
    for (const e of L.step(st, DT, mouse(0, 0))) if (e.type === 'parked') parked = true;
  }
  check('칸 안 정지 1초 → 성공', parked && st.phase === 'parked');
  check('완벽 주차 별 3개', st.stars === 3, `stars=${st.stars} ang=${st.resultAng} lat=${st.resultLat}`);

  const st2 = L.create(1);
  L.begin(st2);
  const t2 = st2.stage.target;
  place(st2, t2.x + 0.28, t2.z, t2.yaw + 0.1, 0, 'N');             // 삐딱 (5.7°, 28cm)
  let parked2 = false;
  for (let i = 0; i < 60 * 3 && !parked2; i++) {
    for (const e of L.step(st2, DT, mouse(0, 0))) if (e.type === 'parked') parked2 = true;
  }
  check('삐딱 주차 별 2개', parked2 && st2.stars === 2, `stars=${st2.stars}`);

  // 후면 주차(칸 축 반대 방향)도 인정
  const st3 = L.create(1);
  L.begin(st3);
  const t3 = st3.stage.target;
  place(st3, t3.x, t3.z, t3.yaw + Math.PI - 0.01, 0, 'N');
  let parked3 = false;
  for (let i = 0; i < 60 * 2 && !parked3; i++) {
    for (const e of L.step(st3, DT, mouse(0, 0))) if (e.type === 'parked') parked3 = true;
  }
  check('후면 주차 인정', parked3 && st3.stars >= 2, `stars=${st3.stars}`);

  // 칸 밖(모서리 걸침)은 성공 안 됨
  const st4 = L.create(1);
  L.begin(st4);
  const t4 = st4.stage.target;
  place(st4, t4.x + t4.w / 2, t4.z, t4.yaw, 0, 'N');
  let parked4 = false;
  for (let i = 0; i < 60 * 3; i++) {
    for (const e of L.step(st4, DT, mouse(0, 0))) if (e.type === 'parked') parked4 = true;
  }
  check('모서리 걸침 미인정', !parked4 && st4.parkT === 0);
}

// ── 6. 제한시간·궤적 기록 ──
{
  const st = L.create(2);
  L.begin(st);
  st.time = 1.0;
  let to = false;
  for (let i = 0; i < 60 * 3 && !to; i++) {
    for (const e of L.step(st, DT, mouse(0, 0))) if (e.type === 'timeout') to = true;
  }
  check('제한시간 소진 → 실패', to && st.phase === 'timeout' && st.stars === 0);
  check('궤적 기록 존재', st.rec.length >= 5 && st.rec[st.rec.length - 1].length === 5,
    `n=${st.rec.length}`);
  const dtRec = st.rec[2][0] - st.rec[1][0];
  check('기록 주기 상식 범위', dtRec > 0.05 && dtRec < 0.2, `dt=${dtRec.toFixed(3)}`);
}

// ── 7. 엔드투엔드: 1판을 직진 크리프만으로 전진 주차 (튜토리얼 성립 검증) ──
{
  M.diff = 'normal';
  const st = L.create(1);
  L.begin(st);
  const inp = mouse(0, 0);
  inp.gearTo = 'D';
  L.step(st, DT, inp);
  let parked = false, crashed = false;
  for (let i = 0; i < 60 * 40 && !parked && !crashed; i++) {
    // 칸 중심까지 남은 거리 대비 제동거리로 브레이크 시점을 잡는다 (1판은 칸 정면 6m 앞 시작)
    const d = st.stage.target.z - st.car.z;
    const stopDist = st.car.v * st.car.v / (2 * 5.0) + 0.12;
    const ctl = d <= stopDist ? mouse(0, 0, 1) : mouse(0.12, 0);
    for (const e of L.step(st, DT, ctl)) {
      if (e.type === 'parked') parked = true;
      if (e.type === 'crash') crashed = true;
    }
  }
  check('1판 직진 전진 주차 성공', parked && st.stars >= 1, `phase=${st.phase} stars=${st.stars}`);
}

console.log(fails === 0 ? '\n전체 통과' : `\n실패 ${fails}건`);
process.exit(fails ? 1 : 0);
