// level-test.mjs — 5미션 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSL;
let fail = 0;
const bad = (m, msg) => { console.log(`  ✗ M${m} ${msg}`); fail++; };

for (let m = 1; m <= 5; m++) {
  const st = M.makeStage(m);

  // 구간 4개 (마지막은 보스)
  if (st.sections.length !== 4) bad(m, `구간 수 ${st.sections.length}`);
  if (!st.sections[3].boss) bad(m, '보스 없음');
  if (st.sections[3].boss.name !== M.BOSSES[m].name) bad(m, '보스 불일치');

  // 웨이브 각 구간 2개 + 적 존재 + 타입 유효
  let total = 0, rangedN = 0;
  for (let s = 0; s < 3; s++) {
    const sec = st.sections[s];
    if (sec.waves.length !== 2) bad(m, `구간${s} 웨이브 수 ${sec.waves.length}`);
    for (const wave of sec.waves) {
      for (const w of wave) {
        const E = M.ETYPES[w.type];
        if (!E) { bad(m, `미정의 적 타입 ${w.type}`); continue; }
        total++;
        if (E.ranged) rangedN++;
        if (w.z < M.Z_MIN || w.z > M.Z_MAX) bad(m, `z 범위 밖 ${w.z}`);
      }
    }
  }
  if (total < 8) bad(m, `적 너무 적음 ${total}`);
  if (rangedN === 0 && m >= 1) console.log(`  (M${m} 원거리 0 — 허용)`);

  // 바란 벼락 필드
  if (m === 5 && M.BOSSES[5].base !== 'baran') bad(m, '바란 base 불일치');

  // 결정성
  const b = M.makeStage(m);
  if (JSON.stringify(b.sections) !== JSON.stringify(st.sections)) bad(m, '결정성 위반');

  console.log(`M${m} ${st.theme.name} — 적 ${total} (원거리 ${rangedN}) · 보스 ${st.sections[3].boss.name}`);
}

console.log(fail === 0 ? '\n✅ 5 미션 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
