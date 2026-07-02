// sim-test.mjs — 헤드리스 시뮬레이션: 테트리스 코어 + 모구 구조 규칙 (node 단독)
import './shim.mjs';

const M = globalThis.window.MTR;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};
// r행을 holeC 열만 비우고 채움
const fillRow = (st, r, holeC) => {
  for (let c = 0; c < M.COLS; c++) if (c !== holeC) st.board[r][c] = { color: '#888', mogu: false, trapped: false };
};
const fillBottom = (st, holeC) => fillRow(st, M.ROWS - 1, holeC);

// 1) 스폰·이동·회전
{
  const st = L.create(1);
  const x0 = st.cur.x;
  L.step(st, DT, { moveX: -1 });
  check('좌로 이동', st.cur.x === x0 - 1);
  const r0 = st.cur.rot;
  const evs = L.step(st, DT, { rotCW: true });
  check('시계 회전', st.cur.rot === (r0 + 1) % 4 && evs.some((e) => e.type === 'rotate'));
}

// 2) 하드드롭 → 즉시 잠금 + 낙하 점수
{
  const st = L.create(1);
  const s0 = st.score;
  const evs = L.step(st, DT, { hard: true });
  check('하드드롭 → 즉시 잠금 (+2/칸)', evs.some((e) => e.type === 'lock') && st.score > s0);
  check('잠금 후 다음 조각 스폰', st.cur !== null && st.cur.y <= 0);
}

// 3) 줄 지우기 + 점수
{
  const st = L.create(1);
  st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
  st.cur = { key: 'I', rot: 1, x: 7, y: 10, mogu: [false, false, false, false] };   // 세로 I를 (9,?)에
  st.cur.x = 7;                                             // rot1: cx=2 → col 9
  for (let r = 16; r < 20; r++) fillRow(st, r, 9);          // 4줄, col9만 구멍
  const evs = [];
  for (let i = 0; i < 360 && !evs.some((e) => e.type === 'clearline'); i++) evs.push(...L.step(st, DT, { down: true }));
  check('세로 I → 4줄 테트리스 (+800)', evs.some((e) => e.type === 'clearline' && e.n === 4) && evs.some((e) => e.type === 'tetris'));
  check('클리어 직후 하단 4줄 비워짐', st.board.slice(16).every((row) => row.every((x) => !x)));
}

// 4) 모구 구조 → 자동 낙하 감속, 소프트드롭 불변 (핵심 차별점)
{
  const st = L.create(1);
  st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
  fillBottom(st, 9);
  st.board[M.ROWS - 1][3].mogu = true;                      // 바닥 줄에 모구
  st.board[M.ROWS - 1][3].trapped = true;
  st.cur = { key: 'I', rot: 1, x: 7, y: 14, mogu: [false, false, false, false] };
  const evs = run(st, 2, { down: true });
  check('모구 줄 클리어 → 구조 이벤트 (+300)', evs.some((e) => e.type === 'rescue' && e.n === 1));
  check('구조 → 감속 타이머 가동', st.rescueT > 10 && st.trappedRescued === 1);
  const slow = L.autoGravity(st);
  st.rescueT = 0;
  const normal = L.autoGravity(st);
  check(`자동 낙하 감속 55% (${slow.toFixed(2)} < ${normal.toFixed(2)})`, Math.abs(slow - normal * 0.55) < 1e-9);
}

// 5) 소프트드롭 속도가 구조 감속과 무관함을 낙하 거리로 계측
{
  const measure = (rescueActive) => {
    const st = L.create(1);
    st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
    st.cur = { key: 'O', rot: 0, x: 4, y: 0, mogu: [false, false, false, false] };
    st.next = { key: 'O', rot: 0, x: 4, y: 0, mogu: [false, false, false, false] };
    if (rescueActive) st.rescueT = 60;
    const y0 = st.cur.y;
    for (let i = 0; i < 60; i++) L.step(st, DT, { down: true });   // 0.5초 소프트드롭
    return st.cur.y - y0;
  };
  const dNormal = measure(false), dRescue = measure(true);
  check(`소프트드롭 낙하량 불변 (일반 ${dNormal}칸 = 감속 중 ${dRescue}칸)`, dNormal === dRescue && dNormal >= 5);
  const auto = (rescueActive) => {
    const st = L.create(10);                               // 중력 빠른 스테이지
    st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
    st.cur = { key: 'O', rot: 0, x: 4, y: 0, mogu: [false, false, false, false] };
    if (rescueActive) st.rescueT = 60;
    const y0 = st.cur.y;
    for (let i = 0; i < 240; i++) L.step(st, DT, {});      // 2초 방치
    return st.cur.y - y0;
  };
  const aN = auto(false), aR = auto(true);
  check(`자동 낙하는 감속됨 (일반 ${aN}칸 > 감속 ${aR}칸)`, aN > aR);
}

// 6) 10줄 → 스테이지 클리어 + 별점
{
  const st = L.create(1);                                  // S1: 방해 줄 0 → 전원 구조 조건 자동 충족
  st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
  st.lines = 9; st.tetrisDone = true;
  fillBottom(st, 9);
  st.cur = { key: 'I', rot: 1, x: 7, y: 14, mogu: [false, false, false, false] };
  const evs = run(st, 2, { down: true });
  check('10줄 도달 → 스테이지 클리어', st.phase === 'clear' && evs.some((e) => e.type === 'stageclear'));
  check('별점 3 (전원 구조 + 테트리스)', st.stars === 3);
}

// 7) 갇힌 모구 미구조 시 ★1
{
  const st = L.create(10);                                 // 방해 줄 + 모구 있음 (메타만 사용)
  check('S10 방해 줄에 모구 갇힘', st.stage.moguTrapped >= 2);
  st.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));   // 모구 줄 없이 재구성
  st.lines = 9; st.tetrisDone = false;
  fillRow(st, M.ROWS - 1, 9);
  st.cur = { key: 'I', rot: 1, x: 7, y: 14, mogu: [false, false, false, false] };
  const evs = run(st, 2, { down: true });
  check('모구 못 구하고 클리어 → ★1', st.phase === 'clear' && st.stars === 1);
}

// 8) 톱아웃 → 게임 오버
{
  const st = L.create(1);
  for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c += 2) st.board[r][c] = { color: '#888', mogu: false };
  const evs = L.step(st, DT, { hard: true });
  check('천장 침범 → 게임 오버', st.phase === 'over');
}

// 9) 7-bag: 7조각마다 전 종류 등장 + 결정성
{
  const st = L.create(3);
  const seen = [st.cur.key, st.next.key];
  for (let i = 0; i < 5; i++) { st.bag.length ? null : null; seen.push(L._spawnPiece(st).key); }
  check('7-bag: 첫 7조각 전 종류', new Set(seen).size === 7);
  const a = L.create(9), b = L.create(9);
  check('스폰 결정성', a.cur.key === b.cur.key && a.next.key === b.next.key);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
