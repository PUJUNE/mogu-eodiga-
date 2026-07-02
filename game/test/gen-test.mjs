// gen-test.mjs — 스테이지 1~50 × 난이도 4종 생성 검증 (node 단독 실행)
// 검사: (1) 생성 성공 (2) 모든 정적 장애물 행에 폭 2.0 이상의 틈 존재
//       (3) 연속 행 사이 틈 이동이 좌우 이동 속도로 도달 가능 (4) 통계 출력
import './shim.mjs';

const G = globalThis.window.MOGU;
let fail = 0;

for (const diff of G.DIFF_ORDER) {
G.diff = diff;
console.log(`\n── 난이도 ${G.DIFFS[diff].name} (speed ×${G.DIFFS[diff].mult}) ──`);

for (let s = 1; s <= 50; s++) {
  const st = G.makeStage(s);
  const P = st.params;

  // 정적 장애물을 z 근접(±1.2) 행으로 묶기
  const rows = [];
  const statics = st.obstacles.filter((o) => !['movelog', 'lily', 'sandbar'].includes(o.type));
  for (const o of statics) {
    let row = rows.find((r) => Math.abs(r.z - o.z) < 1.2);
    if (!row) { row = { z: o.z, obs: [] }; rows.push(row); }
    row.obs.push(o);
  }
  rows.sort((a, b) => a.z - b.z);

  const extent = (o) => {
    switch (o.type) {
      case 'rock': return o.r * 0.95;
      case 'icefloe': return o.r * 1.15;
      case 'pillar': return 0.8;
      case 'logwall': case 'icewall': case 'cactuswall': return o.half;
      default: return 0.5;
    }
  };

  // 도달 가능 집합 DP: 각 행에서 "지나갈 수 있는 구간들"을 앞 행에서 전파
  let reachSet = [[-99, 99]];
  let prevZ = 0, minGapW = 99;
  for (const row of rows) {
    const hw = st.halfW(row.z);
    const blocks = row.obs.map((o) => [o.off - extent(o), o.off + extent(o)]).sort((a, b) => a[0] - b[0]);
    const free = [];
    let cur = -hw + 0.85;
    for (const [b0, b1] of blocks) {
      if (b0 > cur) free.push([cur, Math.min(b0, hw - 0.85)]);
      cur = Math.max(cur, b1);
    }
    if (cur < hw - 0.85) free.push([cur, hw - 0.85]);
    const best = free.filter(([a, b]) => b - a >= 2.0);
    if (best.length === 0) {
      console.log(`  ✗ S${s} z=${row.z.toFixed(0)} 통과 틈 없음 (hw=${hw.toFixed(1)}, obs=${row.obs.map(o=>o.type)})`);
      fail++; continue;
    }
    minGapW = Math.min(minGapW, Math.max(...best.map(([a, b]) => b - a)));
    // 이전 도달 집합을 좌우 이동 가능 폭만큼 확장 후 현재 틈과 교차
    const dz = row.z - prevZ;
    const reach = P.latReach * (dz / P.speed) + 1.2;
    const expanded = reachSet.map(([a, b]) => [a - reach, b + reach]);
    const next = best.filter(([a, b]) => expanded.some(([ea, eb]) => b >= ea && a <= eb));
    if (next.length === 0) {
      console.log(`  ✗ S${s} z=${row.z.toFixed(0)} 틈 도달 불가 (reach=${reach.toFixed(1)})`);
      fail++;
      reachSet = best;          // 이후 행 검사를 계속하기 위해 리셋
    } else {
      reachSet = next;
    }
    prevZ = row.z;
  }

  if (s % 10 === 1 || s === 50) {
    console.log(`S${String(s).padStart(2)} W${P.world} len=${st.length} t=${P.targetTime.toFixed(0)}s spd=${P.speed.toFixed(1)} ` +
      `obs=${st.obstacles.length} rows=${rows.length} items=${st.items.length} zones=${st.zones.length} gates=${st.gates.length} ` +
      `minGap=${minGapW === 99 ? '-' : minGapW.toFixed(1)}`);
  }
}
}
G.diff = 'normal';

console.log(fail === 0 ? '\n✅ 50 스테이지 × 난이도 4종 전부 통과 가능 경로 확인' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
