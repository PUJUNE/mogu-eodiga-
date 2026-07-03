// level-test.mjs — 24스테이지 배치 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MBK;
let fail = 0;
const bad = (no, msg) => { console.log(`  ✗ S${no} ${msg}`); fail++; };

let prevSpd = 0;
for (let no = 1; no <= M.TOTAL; no++) {
  const st = M.makeStage(no);

  if (!st.theme || !st.theme.name) bad(no, '테마 없음');
  if (!(st.spd >= prevSpd)) bad(no, `속도 역행 ${st.spd}`);
  prevSpd = st.spd;

  const breakable = st.bricks.filter((b) => b.kind !== 'steel');
  const mogu = st.bricks.filter((b) => b.kind === 'mogu');
  const steel = st.bricks.filter((b) => b.kind === 'steel');
  const wantMogu = 2 + Math.floor((no - 1) / 8);

  if (breakable.length < 10) bad(no, `깰 벽돌 부족 ${breakable.length}`);
  if (mogu.length !== wantMogu) bad(no, `모구 벽돌 ${mogu.length} (기대 ${wantMogu})`);
  for (const b of mogu) if (b.hp !== 1) bad(no, '모구 벽돌 hp 이상');
  if (no < 7 && steel.length > 0) bad(no, `이른 강철 ${steel.length}`);
  if (steel.length > 6) bad(no, `강철 과다 ${steel.length}`);

  // 격자 범위·중복
  const seen = new Set();
  for (const b of st.bricks) {
    if (b.c < 0 || b.c >= M.COLS || b.r < 0 || b.r >= st.rows) bad(no, `격자 밖 (${b.c},${b.r})`);
    const k = b.c + ',' + b.r;
    if (seen.has(k)) bad(no, `중복 배치 ${k}`);
    seen.add(k);
    if (b.kind === 'hard' && b.hp !== 2) bad(no, 'hard hp 이상');
    if (b.kind === 'n' && b.hp !== 1) bad(no, 'n hp 이상');
  }

  // 결정성
  const b2 = M.makeStage(no);
  if (JSON.stringify(b2.bricks) !== JSON.stringify(st.bricks)) bad(no, '결정성 위반');

  if (no % 4 === 0) console.log(`S${no} ${st.theme.name} — 벽돌 ${st.bricks.length} (깰 것 ${breakable.length} · 모구 ${mogu.length} · 강철 ${steel.length}) · 속도 ${st.spd}`);
}

console.log(fail === 0 ? '\n✅ 24 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
