// level-test.mjs — 스테이지 1~30 AI 파라미터 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MGV;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prev = null;
for (let s = 1; s <= 30; s++) {
  const st = M.makeStage(s);
  const ai = st.ai;
  if (prev && s % 10 !== 1) {                    // 월드 경계(보스 직후)는 보스 보정 때문에 제외
    if (ai.speed < prev.speed - 20) bad(s, 'AI 속도 급락');
    if (ai.react > prev.react + 0.05) bad(s, 'AI 반응 급락');
  }
  if (ai.react < 0.03) bad(s, '반응 지연 과소');
  if (ai.err < 0) bad(s, '오차 음수');
  if (ai.smashP < 0 || ai.smashP > 1) bad(s, '스매시 확률 범위 밖');
  if (s % 10 === 0 && !st.rival.boss) bad(s, '보스 스테이지 표기 누락');
  const b = M.makeStage(s);
  if (JSON.stringify(b.ai) !== JSON.stringify(st.ai)) bad(s, '결정성 위반');
  prev = ai;

  if (s % 10 === 1 || s % 10 === 0) {
    console.log(`S${String(s).padStart(2)} W${st.world} ${st.rival.name} — 속도 ${ai.speed.toFixed(0)} 반응 ${ai.react.toFixed(2)}s 오차 ${ai.err.toFixed(0)}px 스매시 ${(ai.smashP * 100).toFixed(0)}%`);
  }
}
const a1 = M.makeStage(1).ai, a30 = M.makeStage(30).ai;
if (!(a30.speed > a1.speed && a30.react < a1.react && a30.err < a1.err && a30.smashP > a1.smashP)) bad(30, 'S30이 S1보다 강하지 않음');

console.log(fail === 0 ? '\n✅ 30 스테이지 파라미터 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
