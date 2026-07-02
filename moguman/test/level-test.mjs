// level-test.mjs — 스테이지 1~50 생성 검증 (node 단독)
// 검사: (1) 경계·플랫폼 형식 (2) 바닥에서 전 플랫폼 도달 가능(BFS)
//       (3) 적 스폰 유효 위치 (4) 보스판 구성 (5) 결정성
import './shim.mjs';

const M = globalThis.window.MGM;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

for (let s = 1; s <= 50; s++) {
  const st = M.makeStage(s);

  // 경계·행 정합
  for (const p of st.platforms) {
    if (p.x < M.WALL - 0.01 || p.x + p.w > M.W - M.WALL + 0.01) bad(s, `플랫폼 경계 초과 x=${p.x.toFixed(1)} w=${p.w.toFixed(1)}`);
    if (!M.ROWS.includes(p.y)) bad(s, `플랫폼 행 이탈 y=${p.y}`);
    if (p.w < 40) bad(s, `플랫폼 폭 과소 w=${p.w.toFixed(1)}`);
  }

  // 도달 가능성 BFS: 바닥(전체 폭)에서 시작, 40px 위 플랫폼과 24px 이상 겹치면 점프 도달
  const nodes = [{ x: M.WALL, w: M.W - M.WALL * 2, y: M.FLOOR }, ...st.platforms];
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const a = nodes[queue.shift()];
    nodes.forEach((b, i) => {
      if (seen.has(i)) return;
      const dy = a.y - b.y;
      const ovl = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      // 위로 점프(40~52px) 또는 아래로 낙하(겹치면 언제든)
      if ((dy >= 38 && dy <= 52 && ovl >= 24) || (dy < 0 && ovl >= 10)) { seen.add(i); queue.push(i); }
    });
  }
  if (seen.size !== nodes.length) bad(s, `도달 불가 플랫폼 ${nodes.length - seen.size}개`);

  // 적 스폰
  if (st.boss) {
    if (st.enemies.length !== 0) bad(s, '보스판에 초기 적 존재');
    if (!M.BTYPES[st.boss]) bad(s, `보스 타입 미정의 ${st.boss}`);
  } else {
    if (st.enemies.length < 3) bad(s, `적 과소 ${st.enemies.length}`);
    for (const e of st.enemies) {
      if (!M.ETYPES[e.type]) bad(s, `적 타입 미정의 ${e.type}`);
      const onFloor = e.y === M.FLOOR;
      const onPlat = st.platforms.some((p) => p.y === e.y && e.x >= p.x && e.x <= p.x + p.w);
      if (!onFloor && !onPlat) bad(s, `적 스폰 공중 (${e.type} x=${e.x.toFixed(0)} y=${e.y})`);
      if (onFloor && Math.abs(e.x - M.W / 2) < 60) bad(s, '적이 플레이어 시작점 인접');
    }
  }

  // 결정성
  const again = M.makeStage(s);
  if (JSON.stringify(again.platforms) !== JSON.stringify(st.platforms) ||
      JSON.stringify(again.enemies) !== JSON.stringify(st.enemies)) bad(s, '결정성 위반');

  if (s % 10 === 1 || s % 10 === 0) {
    console.log(`S${String(s).padStart(2)} W${st.world} ${st.boss ? '👑 ' + st.boss : '적 ' + st.enemies.length + ' [' + st.enemies.map((e) => e.type[0]).join('') + ']'} plats=${st.platforms.length}`);
  }
}

console.log(fail === 0 ? '\n✅ 50 스테이지 생성·도달성·스폰 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
