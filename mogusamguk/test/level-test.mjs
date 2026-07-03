// level-test.mjs — 미션 1~4 데이터 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSG;
let fail = 0;
const bad = (m, msg) => { console.log(`  ✗ M${m} ${msg}`); fail++; };

for (let m = 1; m <= 5; m++) {
  const st = M.makeStage(m);
  if (st.sections.length !== 4) bad(m, '구간 수 이상');
  if (!st.sections[3].boss) bad(m, '보스 구간 없음');
  let total = 0;
  st.sections.forEach((sec, i) => {
    if (sec.x1 <= sec.x0) bad(m, `구간 ${i} 폭 이상`);
    for (const wave of sec.waves) {
      for (const w of wave) {
        if (!M.ETYPES[w.type]) bad(m, `악당 타입 미정의 ${w.type}`);
        if (w.z < M.Z_MIN || w.z > M.Z_MAX) bad(m, '스폰 깊이 이탈');
        total++;
      }
    }
  });
  if (total < 6) bad(m, `악당 과소 ${total}`);
  const b = M.makeStage(m);
  if (JSON.stringify(b.sections) !== JSON.stringify(st.sections)) bad(m, '결정성 위반');
  console.log(`M${m} ${st.theme.name} — 악당 ${total} + 보스 ${st.sections[3].boss.name} (HP ${st.sections[3].boss.hp})`);
}
// 난도 상승: 후반 미션 악당 체력 배율
const h1 = M.makeStage(1).sections[0].waves[0][0].hpMul;
const h4 = M.makeStage(5).sections[0].waves[0][0].hpMul;
if (!(h4 > h1)) bad(5, '체력 배율 미상승');

console.log(fail === 0 ? '\n✅ 5 미션 데이터 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
