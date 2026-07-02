// level-test.mjs — 라운드 1~30 배치 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MGB;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ R${s} ${msg}`); fail++; };

for (let s = 1; s <= 30; s++) {
  const st = M.makeStage(s);

  if (st.grid.size === 0) bad(s, '빈 판');
  let row0 = 0;
  for (const [k, col] of st.grid) {
    const [r, c] = k.split(',').map(Number);
    if (r < 0 || c < 0 || c >= M.colsOf(r)) bad(s, `셀 경계 이탈 ${k}`);
    if (col < 0 || col >= st.nColors) bad(s, `색 팔레트 밖 ${k}=${col}`);
    if (r === 0) row0++;
  }
  if (row0 === 0) bad(s, '천장 줄이 비어 있음');

  // 전 방울 천장 연결 (부유 없음)
  const attached = new Set();
  const q = [];
  for (let c = 0; c < 8; c++) if (st.grid.has('0,' + c)) { attached.add('0,' + c); q.push([0, c]); }
  while (q.length) {
    const [r, c] = q.shift();
    for (const [nr, nc] of M.neighbors(r, c)) {
      const k = nr + ',' + nc;
      if (st.grid.has(k) && !attached.has(k)) { attached.add(k); q.push([nr, nc]); }
    }
  }
  if (attached.size !== st.grid.size) bad(s, `부유 방울 ${st.grid.size - attached.size}개`);

  // 결정성
  const b = M.makeStage(s);
  if (JSON.stringify([...b.grid]) !== JSON.stringify([...st.grid])) bad(s, '결정성 위반');

  if (s % 10 === 1 || s % 10 === 0) {
    const colors = new Set(st.grid.values());
    console.log(`R${String(s).padStart(2)} W${st.world} 방울 ${String(st.grid.size).padStart(2)} 색 ${colors.size}/${st.nColors} ${st.theme.name}`);
  }
}

console.log(fail === 0 ? '\n✅ 30 라운드 배치 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
