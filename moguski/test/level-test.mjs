// level-test.mjs — 스테이지 1~50 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSJ;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prevK = 0;
for (let s = 1; s <= 50; s++) {
  const st = M.makeStage(s);

  if (st.K < prevK) bad(s, `힐 크기 역행 K${st.K} < K${prevK}`);
  prevK = st.K;
  if (!(st.target > 0)) bad(s, '목표 거리 누락');
  if (st.vLip < 10 || st.vLip > 35) bad(s, `도약 속도 이상 ${st.vLip}`);
  if (st.world === 1 && st.wind !== 0) bad(s, '월드1은 무풍이어야 함');
  if (Math.abs(st.wind) > 4) bad(s, `바람 과대 ${st.wind}`);
  if (s % 10 === 0 && !st.rival) bad(s, '라이벌 힐에 라이벌 없음');

  // 인런: 립(0,0)에서 위로 올라가는 단조 프로파일
  const top = st.inrunAt(st.L), lip = st.inrunAt(0);
  if (Math.abs(lip.x) > 0.01 || Math.abs(lip.y) > 0.01) bad(s, '립이 원점 아님');
  if (top.y < 5 || top.x > -5) bad(s, `인런 형상 이상 top=(${top.x.toFixed(1)},${top.y.toFixed(1)})`);

  // 착지 언덕: 연속·단조 하강 후 평탄
  let py = 0, mono = true;
  for (let x = 0.5; x < st.K * 1.32 + 40; x += 0.5) {
    const y = st.hillY(x);
    if (y > py + 0.001) mono = false;
    if (Math.abs(y - py) > 0.5) bad(s, `언덕 불연속 x=${x}`);
    py = y;
  }
  if (!mono) bad(s, '언덕이 단조 하강 아님');
  const flatA = st.hillY(st.K * 1.32 + 40), flatB = st.hillY(st.K * 1.32 + 60);
  if (Math.abs(flatA - flatB) > 0.01) bad(s, '아웃런 평탄화 실패');

  // 결정성
  const b = M.makeStage(s);
  if (b.wind !== st.wind || b.K !== st.K || b.L !== st.L) bad(s, '결정성 위반');

  if (s % 10 === 1 || s % 10 === 0) {
    console.log(`S${String(s).padStart(2)} W${st.world} K${String(st.K).padStart(5)} 목표 ${String(st.target).padStart(5)}m v립 ${st.vLip.toFixed(1)} 바람 ${st.wind >= 0 ? '+' : ''}${st.wind}${st.rival ? ' 👑 ' + st.rival : ''}`);
  }
}

console.log(fail === 0 ? '\n✅ 50 스테이지 생성 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
