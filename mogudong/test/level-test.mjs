// level-test.mjs — 웨이브 곡선 · 난이도 · 테마 · 등급 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDD;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ ${s} ${msg}`); fail++; };

// ── 1) 웨이브 1~10: 생성량·낙하 속도가 단조 증가 ──
let prev = null;
for (let w = 1; w <= M.WAVES; w++) {
  const cur = M.makeWave(w, 'normal');
  if (prev) {
    if (cur.rate <= prev.rate) bad(`W${w}`, '생성량이 늘지 않음');
    if (cur.fallV <= prev.fallV) bad(`W${w}`, '낙하 속도가 늘지 않음');
  }
  if (cur.weights.small < 0 || cur.weights.small + cur.weights.big > 0.9) bad(`W${w}`, '종류 가중치 범위 밖');
  if (JSON.stringify(M.makeWave(w, 'normal')) !== JSON.stringify(cur)) bad(`W${w}`, '결정성 위반');
  prev = cur;
}
if (M.makeWave(1, 'normal').weights.small !== 0) bad('W1', '초반부터 작은 똥 등장');
if (!M.makeWave(9, 'normal').wind) bad('W9', '마지막 60초 바람 없음');
if (M.makeWave(8, 'normal').wind) bad('W8', '바람이 너무 일찍 시작');

// ── 2) 난이도 4단계 정렬 ──
const rates = M.DIFF_ORDER.map((d) => M.makeWave(5, d).rate);
const spds = M.DIFF_ORDER.map((d) => M.makeWave(5, d).fallV);
for (let i = 1; i < rates.length; i++) {
  if (rates[i] <= rates[i - 1]) bad(M.DIFF_ORDER[i], '이전 난이도보다 생성량이 적음');
  if (spds[i] <= spds[i - 1]) bad(M.DIFF_ORDER[i], '이전 난이도보다 낙하 속도가 느림');
}
if (M.nextDiff('crazy') !== null) bad('crazy', '다음 난이도가 있음');
if (M.nextDiff('easy') !== 'normal') bad('easy', '다음 난이도 연결 오류');

// ── 3) 시간 → 웨이브·테마 매핑 ──
const waveCases = [[0, 1], [29.9, 1], [30, 2], [149, 5], [299.9, 10], [400, 10]];
for (const [t, w] of waveCases) if (M.waveAt(t) !== w) bad(`t=${t}`, `웨이브 ${M.waveAt(t)} (기대 ${w})`);
if (M.themeAt(0).name !== M.THEMES[0].name) bad('t=0', '테마 매핑 오류');
if (M.themeAt(299).name !== '똥 폭풍') bad('t=299', '마지막 테마가 똥 폭풍이 아님');
if (M.THEMES.length * 60 !== M.CLEAR_TIME) bad('테마', '테마 수 × 60초 ≠ 클리어 시간');
if (M.WAVES * M.WAVE_SEC !== M.CLEAR_TIME) bad('웨이브', '웨이브 수 × 30초 ≠ 클리어 시간');

// ── 4) 등급표 ──
if (M.rankOf(300).t !== 300) bad('rank', '5분 등급 오류');
if (M.rankOf(0).name !== '똥 맞은 모구') bad('rank', '최하 등급 오류');
if (M.rankOf(125).t !== 120) bad('rank', '중간 등급 경계 오류');

// ── 5) 총 낙하량 — 원작은 5분에 약 2900~3000개. 이쪽 똥이 더 크므로 같은 수를 쏟으면
//        피할 틈이 없다. 크레이지가 원작 밀도에 가장 가까운 난이도가 되도록 잡는다.
const totals = {};
for (const d of M.DIFF_ORDER) {
  let n = 0;
  for (let w = 1; w <= M.WAVES; w++) n += M.makeWave(w, d).rate * M.WAVE_SEC;
  totals[d] = Math.round(n);
  console.log(`${M.DIFFS[d].name.padEnd(5)} — 5분 총 낙하 ${totals[d]}개 · W1 ${M.makeWave(1, d).rate.toFixed(1)}/s → W10 ${M.makeWave(10, d).rate.toFixed(1)}/s · 속도 ${M.makeWave(1, d).fallV.toFixed(0)}→${M.makeWave(10, d).fallV.toFixed(0)}px/s`);
}
if (totals.crazy < 1900 || totals.crazy > 3000) bad('총량', `크레이지 ${totals.crazy}개 — 원작 밀도(2900~3000) 근사 범위 이탈`);
if (totals.easy > totals.normal || totals.normal > totals.hard || totals.hard > totals.crazy) bad('총량', '난이도 순서와 총 낙하량이 어긋남');

console.log(fail === 0 ? '\n✅ 웨이브·난이도·테마 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
