// sim-test.mjs — 헤드리스 시뮬레이션: 코어 규칙 전체 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MGB;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const fire = (st, aim) => {
  const evs = [...L.step(st, DT, { aim, shoot: true })];
  let g = 0;
  while ((st.flying || st.popping) && g++ < 3000) evs.push(...L.step(st, DT, IDLE));
  return evs;
};

// 1) 생성: 큐 색이 판 위 색에서만
{
  const st = L.create(1);
  const present = new Set(st.grid.values());
  check('생성: 현재·예고 색이 판 위 색', present.has(st.cur) && present.has(st.next));
}

// 2) 직사 발사 → 스냅
{
  const st = L.create(1);
  const before = st.grid.size;
  const evs = fire(st, 0);
  const popped = evs.some((e) => e.type === 'pop');
  check('수직 발사 → 스냅' + (popped ? ' (+팝)' : ''), evs.some((e) => e.type === 'snap') && (popped || st.grid.size === before + 1));
}

// 3) 큰 각도 → 벽 반사
{
  const st = L.create(1);
  const evs = fire(st, 70 * Math.PI / 180);
  check('큰 각도 발사 → 벽 반사', evs.some((e) => e.type === 'bounce') && evs.some((e) => e.type === 'snap'));
}

// 4) 같은 색 3연결 팝 → 판 비면 클리어
{
  const st = L.create(1);
  st.grid = new Map([['0,3', 0], ['1,3', 0]]);   // 발사대(x160) 바로 위 세로 2개
  st.cur = 0;
  const evs = fire(st, 0);
  check('3연결 팝 (10×n² 점수)', evs.some((e) => e.type === 'pop' && e.n === 3) && st.score >= 90);
  check('판 비움 → 라운드 클리어', st.phase === 'clear' && evs.some((e) => e.type === 'clear'));
}

// 5) 팝 후 천장과 끊긴 방울 낙하
{
  const st = L.create(1);
  // 빨강 2개(천장) + 그 오른쪽 아래 매달린 파랑 1개 (발사 경로 밖)
  st.grid = new Map([['0,3', 0], ['0,4', 0], ['1,4', 1]]);
  st.cur = 0;
  const evs = fire(st, 0);   // (1,3)에 스냅 → 빨강 3연결 팝 → (1,4)는 지지 상실로 낙하
  check('부유 방울 낙하 (+20/개)', evs.some((e) => e.type === 'fall' && e.n === 1));
  check('낙하 후 판 비움 → 클리어', st.phase === 'clear');
}

// 6) 압축: 8발마다 천장 하강
{
  const st = L.create(1);
  st.grid = new Map([['0,0', 0], ['0,7', 1]]);   // 매치 안 되게
  st.shots = M.MAX_SHOTS - 1;
  st.cur = 2;
  const y0 = M.cellY(0, st.drop);
  const evs = fire(st, -60 * Math.PI / 180);
  check('8발째 → 천장 한 줄 하강', evs.some((e) => e.type === 'descend') && st.drop === 1);
  check('하강 후 셀 y가 한 줄 내려감', M.cellY(0, st.drop) === y0 + M.ROW_H);
}

// 7) 데드라인 침범 → 패배
{
  const st = L.create(1);
  st.grid = new Map([['0,0', 0], ['0,7', 1]]);
  st.drop = 12;                                  // 판을 데드라인 근처로
  st.cur = 2;
  const evs = fire(st, -60 * Math.PI / 180);
  check('데드라인 침범 → 게임 오버', st.phase === 'over' && evs.some((e) => e.type === 'over'));
}

// 8) 소진된 색은 큐에서 제외
{
  const st = L.create(1);
  st.grid = new Map([['0,0', 4], ['0,1', 4]]);
  let only4 = true;
  for (let i = 0; i < 30; i++) if (L._draw(st) !== 4) only4 = false;
  check('큐 추첨이 판 위 색(4)만 반환', only4);
}

// 8-b) 매치 하이라이트 모션: 착탄 → 빨간 점멸 단계(방울 유지) → 지연 후 팝
{
  const st = L.create(1);
  st.grid = new Map([['0,3', 0], ['1,3', 0]]);
  st.cur = 0;
  const evs = [...L.step(st, DT, { aim: 0, shoot: true })];
  let g = 0;
  while (st.flying && g++ < 3000) evs.push(...L.step(st, DT, IDLE));   // 착탄까지만
  check('착탄 직후 매치 이벤트 + 방울 유지(하이라이트 중)', evs.some((e) => e.type === 'match') &&
    st.popping !== null && st.grid.size === 3 && !evs.some((e) => e.type === 'pop'));
  const evs2 = [];
  for (let i = 0; i < Math.round(0.5 / DT); i++) evs2.push(...L.step(st, DT, IDLE));
  check('지연(0.42초) 후 팝 발생', evs2.some((e) => e.type === 'pop') && st.popping === null && st.phase === 'clear');
}

// 9) 결정성
{
  const a = L.create(9), b = L.create(9);
  check('라운드 생성·큐 결정성', JSON.stringify([...a.grid]) === JSON.stringify([...b.grid]) && a.cur === b.cur && a.next === b.next);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
