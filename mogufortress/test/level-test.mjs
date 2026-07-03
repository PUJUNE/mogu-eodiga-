// level-test.mjs — 스테이지 1~12 지형·AI 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MFT;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prevErr = 99;
for (let s = 1; s <= 12; s++) {
  const st = M.makeStage(s);

  if (st.terrain.length !== M.NCOL) bad(s, '지형 컬럼 수 이상');
  for (const h of st.terrain) if (h < 80 || h > 245) bad(s, `지형 높이 이탈 ${h}`);
  // 포대 자리 평탄성 (±8 컬럼 동일 높이)
  for (const cc of [st.pCol, st.eCol]) {
    for (let i = cc - 8; i <= cc + 8; i++) {
      if (st.terrain[i] !== st.terrain[cc]) bad(s, `포대 자리 비평탄 col=${cc}`);
    }
  }
  if (st.eCol - st.pCol < 100) bad(s, '포대 간격 과소');
  if (st.enemy.err > prevErr + 3.5) bad(s, 'AI 오차 역행');   // 보스 직후 소폭 상승 허용
  prevErr = st.enemy.err;
  if (s % 3 === 0 && !st.boss) bad(s, '보스 스테이지 표기 누락');
  const b = M.makeStage(s);
  if (JSON.stringify(b.terrain) !== JSON.stringify(st.terrain) || b.enemy.err !== st.enemy.err) bad(s, '결정성 위반');

  if (s % 3 === 1 || s % 3 === 0) {
    console.log(`S${String(s).padStart(2)} W${st.world} ${st.theme.name} — ${st.enemy.name} (HP ${st.enemy.hp}, 오차 ±${st.enemy.err.toFixed(0)}px)${st.boss ? ' 👑' : ''}`);
  }
}
const e1 = M.makeStage(1).enemy.err, e12 = M.makeStage(12).enemy.err;
if (!(e12 < e1)) bad(12, 'S12가 S1보다 정확하지 않음');

console.log(fail === 0 ? '\n✅ 12 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
