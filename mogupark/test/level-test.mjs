// level-test.mjs — 50판 × 4난이도 주차장 기하 전수 검증
// node mogupark/test/level-test.mjs
import { M } from './shim.mjs';

let fails = 0;
function check(name, cond, detail = '') {
  if (cond) return;
  fails++;
  console.log(`FAIL  ${name}  ${detail}`);
}

const C = M.CAR;
const { corners, obbOverlap } = M.Logic;
const solid = (o) => o.kind !== 'curb';

for (const diff of M.DIFF_ORDER) {
  M.diff = diff;
  for (let no = 1; no <= M.COURSES; no++) {
    const s = M.makeStage(no);
    const tag = `#${no}(${diff})`;
    const t = s.target;

    // 목표 칸 존재 + 미점유
    check(`${tag} 목표 칸`, t && t.target && !t.occupied);

    // 칸 여유 하한 — 크레이지 포함 주차 가능선
    if (s.type === 'parallel' || s.type === 'parallel-tight') {
      check(`${tag} 평행 간격`, t.l >= C.L + 0.68, `gap=${t.l.toFixed(2)}`);
    } else {
      check(`${tag} 칸 폭`, t.w >= C.W + 0.28, `w=${t.w.toFixed(2)}`);
      check(`${tag} 차로 폭`, s.laneW >= 5.0, `lane=${s.laneW.toFixed(2)}`);
    }

    // 목표 칸에 정확히 세운 차가 어떤 장애물과도 겹치지 않는다 (기둥 스테이지 핵심)
    const parked = corners(t.x, t.z, C.W, C.L, t.yaw);
    for (const o of s.obstacles) {
      if (!solid(o)) continue;
      check(`${tag} 목표 칸 간섭`, !obbOverlap(parked, corners(o.x, o.z, o.w, o.l, o.yaw)),
        `${o.kind}@(${o.x.toFixed(1)},${o.z.toFixed(1)})`);
    }

    // 시작 포즈 무간섭 (연석 포함 — 시작부터 쿵 소리가 나면 안 된다)
    const startP = corners(s.start.x, s.start.z, C.W, C.L, s.start.h);
    for (const o of s.obstacles) {
      check(`${tag} 시작 위치 간섭`, !obbOverlap(startP, corners(o.x, o.z, o.w, o.l, o.yaw)),
        `${o.kind}@(${o.x.toFixed(1)},${o.z.toFixed(1)})`);
    }

    // 시작 위치가 부지 안
    check(`${tag} 시작 부지 안`,
      s.start.x > s.lot.x0 && s.start.x < s.lot.x1 && s.start.z > s.lot.z0 && s.start.z < s.lot.z1);

    // 주차된 차끼리 겹치지 않는다
    const cars = s.obstacles.filter((o) => o.kind === 'car');
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        check(`${tag} 주차 차량 겹침`, !obbOverlap(
          corners(cars[i].x, cars[i].z, cars[i].w, cars[i].l, cars[i].yaw),
          corners(cars[j].x, cars[j].z, cars[j].w, cars[j].l, cars[j].yaw)), `${i}~${j}`);
      }
    }

    // 제한시간 양수·상식 범위
    check(`${tag} 제한시간`, s.timeLimit >= 40 && s.timeLimit <= 300, `t=${s.timeLimit}`);
  }
}

// 결정성 — 같은 판은 언제나 같은 주차장
M.diff = 'normal';
const a = JSON.stringify(M.makeStage(17));
const b = JSON.stringify(M.makeStage(17));
check('결정성 #17', a === b);

// 난이도가 기하에 주는 영향은 칸 여유뿐, 배치 구조는 동일
M.diff = 'easy';
const easy = M.makeStage(25);
M.diff = 'crazy';
const crazy = M.makeStage(25);
check('난이도 간 유형 동일', easy.type === crazy.type);
check('난이도 간 시간 차', easy.timeLimit > crazy.timeLimit);

console.log(fails === 0 ? `PASS  50판 × ${M.DIFF_ORDER.length}난이도 전수 검증 통과` : `실패 ${fails}건`);
process.exit(fails ? 1 : 0);
