// level-test.mjs — 스테이지 1~10 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MNG;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prevLen = 0, prevSpd = 0;
for (let s = 1; s <= 10; s++) {
  const st = M.makeStage(s);

  if (st.length < prevLen) bad(s, '거리 역행');
  if (st.maxSpd < prevSpd) bad(s, '최고 속도 역행');
  prevLen = st.length; prevSpd = st.maxSpd;

  // 장애물 d 오름차순 + 위험물 간 최소 간격 (점프 체공 거리 고려 회피 가능성)
  const haz = st.objs.filter((o) => o.type !== 'flag' && o.type !== 'fish');
  for (let i = 1; i < st.objs.length; i++) {
    if (st.objs[i].d < st.objs[i - 1].d) bad(s, `장애물 정렬 위반 idx=${i}`);
  }
  for (let i = 1; i < haz.length; i++) {
    if (haz[i].d - haz[i - 1].d < 120) bad(s, `위험물 간격 과소 ${(haz[i].d - haz[i - 1].d).toFixed(0)}m`);
  }
  for (const o of st.objs) {
    if (o.d < 200 || o.d > st.length - 200) bad(s, '출발/도착 지점에 장애물');
    if (Math.abs(o.x) > M.TRACK_W) bad(s, '트랙 밖 배치');
  }
  if (st.flagsTotal < 10) bad(s, `깃발 부족 (${st.flagsTotal})`);
  // 커브 구간 정합
  for (const cv of st.curves) if (cv.d1 <= cv.d0) bad(s, '커브 구간 역전');
  // 시간이 이론상 도달 가능한지 (풀가속 기준 80% 이내)
  if (st.time * st.maxSpd < st.length * 1.25) bad(s, '제한시간 물리적 불가');

  const b = M.makeStage(s);
  if (JSON.stringify(b.objs) !== JSON.stringify(st.objs)) bad(s, '결정성 위반');

  console.log(`S${String(s).padStart(2)} ${st.from} → ${st.to} — ${st.length}m, 최고 ${st.maxSpd}, ⏱${st.time}s, 장애물·수집 ${st.objs.length} (🚩${st.flagsTotal})`);
}

console.log(fail === 0 ? '\n✅ 10 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
