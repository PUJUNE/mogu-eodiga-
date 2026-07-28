// tune.mjs — 제한시간 테이블 굽기 (물리·트랙 상수를 바꾸면 반드시 다시 실행)
// 숙련 봇을 시간제한 없이 달리게 해 구간별 실제 소요를 재고, 여유율을 곱해
// levels.js 의 M.START_TIME / M.CP_BONUS 표를 만든다.
import { M, mouse, botControl, DT } from './shim.mjs';

// 시간제한을 무력화한 채 sim-test와 같은 정책으로 달리며 체크포인트 구간 소요를 잰다
function measure(no) {
  const st = M.Logic.create(no);
  const marks = [];
  let last = 0, guard = 0;

  while (st.phase !== 'finish' && guard++ < 60 * 600) {
    st.time = 1e9;                                   // 제한시간 무력화
    const c = botControl(st, 1.0);
    for (const e of M.Logic.step(st, DT, mouse(c.throttle, c.steer, c.brake))) {
      if (e.type === 'checkpoint' || e.type === 'finish') { marks.push(st.elapsed - last); last = st.elapsed; }
    }
  }
  return { marks, total: st.elapsed, ok: st.phase === 'finish' };
}

const startT = [], bonusT = [];
console.log('스테이지  완주    출발구간  최장구간  → 출발제한  체크포인트보너스');
for (let no = 1; no <= 30; no++) {
  const r = measure(no);
  if (!r.ok) { console.log(`S${no} 측정 실패`); process.exit(1); }
  // 여유율: 초반은 넉넉하게, 후반으로 갈수록 조인다
  const margin = 1.55 - (no - 1) * 0.0105;
  const first = r.marks[0];
  const worstGap = Math.max(...r.marks.slice(1));
  const start = Math.round(first * margin * 2) / 2;
  const bonus = Math.round(worstGap * margin * 2) / 2;
  startT.push(start); bonusT.push(bonus);
  console.log(`S${String(no).padStart(2)}  ${r.total.toFixed(1)}초  ${first.toFixed(1)}초    ` +
    `${worstGap.toFixed(1)}초     ${start}초      ${bonus}초  (여유 ${((margin - 1) * 100).toFixed(0)}%)`);
}

console.log('\n// levels.js 에 붙여넣기 ──');
console.log('M.START_TIME = [' + startT.join(', ') + '];');
console.log('M.CP_BONUS = [' + bonusT.join(', ') + '];');
