// level-test.mjs — 스테이지 1~30 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MTR;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prevG = 0;
for (let s = 1; s <= 30; s++) {
  const st = M.makeStage(s);

  if (st.gravity <= prevG - 1e-9) bad(s, '중력 역행');
  prevG = st.gravity;
  if (st.goal !== 10) bad(s, '목표 줄수 이상');

  // 방해 줄: 각 줄에 구멍 ≥1 (칸수 < 10), 모구는 배치 칸에만
  let moguFound = 0;
  for (const g of st.garbage) {
    if (g.cells.length >= 10) bad(s, `방해 줄 ${g.row} 구멍 없음`);
    if (g.cells.length < 5) bad(s, `방해 줄 ${g.row} 과소 채움`);
    for (const cell of g.cells) {
      if (cell.c < 0 || cell.c > 9) bad(s, '칸 경계 이탈');
      if (cell.mogu) moguFound++;
    }
  }
  if (moguFound !== st.moguTrapped) bad(s, `모구 수 불일치 ${moguFound}≠${st.moguTrapped}`);
  if (s >= 4 && st.moguTrapped < 2) bad(s, '갇힌 모구 과소');
  if (s < 4 && st.garbage.length !== 0) bad(s, '초반 스테이지에 방해 줄');

  // 결정성
  const b = M.makeStage(s);
  if (JSON.stringify(b.garbage) !== JSON.stringify(st.garbage)) bad(s, '결정성 위반');

  if (s % 10 === 1 || s % 10 === 0 || s === 4) {
    console.log(`S${String(s).padStart(2)} W${st.world} 중력 ${st.gravity.toFixed(2)}칸/s 방해줄 ${st.garbage.length} 모구 ${st.moguTrapped} ${st.theme.name}`);
  }
}

console.log(fail === 0 ? '\n✅ 30 스테이지 생성 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
