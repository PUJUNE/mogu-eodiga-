// level-test.mjs — 전 코스 생성 검증 (node 단독)
import { M } from './shim.mjs';

let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

if (M.START_TIME.length !== M.COURSES || M.CP_BONUS.length !== M.COURSES) {
  console.log(`  ✗ 제한시간 표가 ${M.COURSES}스테이지를 덮지 않음`); fail++;
}

let prevTotal = 0;
for (let s = 1; s <= M.COURSES; s++) {
  const stg = M.makeStage(s);

  // 길이·난이도 단조성
  if (stg.total <= prevTotal) bad(s, `코스 길이 역행 ${stg.total} ≤ ${prevTotal}`);
  prevTotal = stg.total;
  // 제한시간은 tune.mjs 실측으로 구운 표에서 온다 — 단조 곡선이 아니라 범위로 본다
  if (!(stg.cpBonus >= 15 && stg.cpBonus <= 32)) bad(s, `체크포인트 보너스 범위 이탈 ${stg.cpBonus}s`);
  if (!(stg.startTime >= 15 && stg.startTime <= 32)) bad(s, `출발 제한시간 범위 이탈 ${stg.startTime}s`);
  if (stg.world !== Math.min(15, Math.ceil(s / 6))) bad(s, '월드 배정 오류');
  if (!stg.theme || !stg.theme.name) bad(s, '테마 누락');
  if (s % 6 === 0 && !stg.rival) bad(s, '보스 구간에 라이벌 없음');
  if (s % 6 !== 0 && stg.boss) bad(s, '보스 플래그 오설정');

  // 세그먼트 연속성 (p1.y == 직전 p2.y, z 등간격)
  for (let i = 1; i < stg.total; i++) {
    const a = stg.segs[i - 1], b = stg.segs[i];
    if (Math.abs(b.p1.world.y - a.p2.world.y) > 1e-6) { bad(s, `고도 불연속 seg${i}`); break; }
    if (b.p1.world.z - a.p1.world.z !== M.SEG_LEN) { bad(s, `z 간격 오류 seg${i}`); break; }
  }

  // 커브 크기 상한 — 원심력이 조향 권한을 완전히 넘어서면 주행 불가
  let maxCurve = 0;
  for (const g of stg.segs) maxCurve = Math.max(maxCurve, Math.abs(g.curve));
  const breakEven = 1.25 / (maxCurve * 0.32);
  if (breakEven < 0.30) bad(s, `최대 커브 과다 ${maxCurve.toFixed(1)} (한계속도 ${(breakEven * 100).toFixed(0)}%)`);

  // 체크포인트: 코스 안에 있고 마지막 구간이 보너스 하나로 닿는 거리
  for (const cp of stg.checkpoints) if (cp <= 0 || cp >= stg.total) bad(s, `체크포인트 범위 이탈 ${cp}`);
  const lastCp = stg.checkpoints.length ? stg.checkpoints[stg.checkpoints.length - 1] : 0;
  if (stg.total - lastCp > stg.cpEvery) bad(s, `결승까지 ${stg.total - lastCp}세그먼트 — 보너스 간격 초과`);

  // 출발 직선: 처음 100세그먼트는 커브 없음
  for (let i = 0; i < 100; i++) if (stg.segs[i].curve !== 0) { bad(s, '출발 직선 아님'); break; }

  // 교통 차량 — 반드시 차선 중앙(-2/3·0·+2/3)에 정렬
  if (stg.cars.length !== stg.trafficN) bad(s, '교통 대수 불일치');
  const laneCenters = [-(2 / 3), 0, 2 / 3];
  for (const c of stg.cars) {
    if (!laneCenters.some((l) => Math.abs(c.offset - l) < 1e-9)) {
      bad(s, `차량 오프셋 ${c.offset.toFixed(3)} — 차선 중앙 아님`); break;
    }
    if (c.z < 0 || c.z > stg.length) { bad(s, '차량 z 범위 이탈'); break; }
  }

  // 결정성
  const b = M.makeStage(s);
  if (b.total !== stg.total || b.cars.length !== stg.cars.length ||
      b.segs[500].curve !== stg.segs[500].curve) bad(s, '결정성 위반');

  if (s % 6 === 1 || s % 6 === 0) {
    console.log(`S${String(s).padStart(2)} W${stg.world} ${stg.theme.name.padEnd(7)} ` +
      `${String(stg.total).padStart(4)}seg ${(stg.length / 1000).toFixed(0)}k ` +
      `CP${stg.checkpoints.length} +${stg.cpBonus}s 차량${String(stg.cars.length).padStart(3)} ` +
      `최대커브 ${maxCurve.toFixed(1)}(한계 ${(breakEven * 100).toFixed(0)}%)` +
      (stg.rival ? ` 👑 ${stg.rival}` : ''));
  }
}

console.log(fail === 0 ? '\n✅ level-test 전체 통과' : `\n❌ level-test 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
