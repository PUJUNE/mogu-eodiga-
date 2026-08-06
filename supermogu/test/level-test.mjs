// level-test.mjs — 32스테이지 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.SMG;
const T = M.T;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

for (let s = 1; s <= 32; s++) {
  const st = M.makeStage(s);
  const g = st.g;

  // 시작 안전지대: 처음 10타일 지면 + 적 없음
  for (let x = 0; x < 10; x++) {
    if (g[x][st.gndY] !== T.GND && !st.castle) bad(s, `시작 지면 구멍 x=${x}`);
  }
  for (const e of st.enemies) if (e.tx < 12) bad(s, `시작 지대에 적 tx=${e.tx}`);

  // 골: 깃발(필드) 또는 보스(성)
  if (!st.castle) {
    if (st.flagX <= 0) bad(s, '깃발 없음');
    let flagFound = false;
    for (let y = 0; y < M.ROWS; y++) if (g[Math.round(st.flagX / M.TILE)][y] === T.FLAG) flagFound = true;
    if (!flagFound) bad(s, '깃발 타일 없음');
  } else if (st.bossX <= 0) bad(s, '보스 없음');

  // 갭 폭: 연속 비지면(용암 포함) ≤ 4타일 (점프 상한)
  // y<3 은 성 스테이지의 천장(BLOCK) — 밟을 수 없으므로 발판으로 세지 않는다.
  // (예전엔 천장까지 세는 바람에 성의 모든 열이 "발판 있음"이 되어 10타일 용암도 통과했다)
  let gap = 0;
  for (let x = 4; x < st.len - 4; x++) {
    let hasGround = false;
    for (let y = 3; y < M.ROWS; y++) {
      const v = g[x][y];
      if (v === T.GND || v === T.BLOCK || v === T.PIPE_T || v === T.CASTLE) { hasGround = true; break; }
    }
    if (!hasGround) { gap++; if (gap > 4) { bad(s, `갭 과대 x=${x} (${gap})`); gap = -99; } }
    else gap = 0;
  }

  // 성: 지면행의 연속 용암 폭 (천장에 가려지지 않도록 직접 검사)
  if (st.castle) {
    let lava = 0;
    for (let x = 0; x < st.len; x++) {
      if (g[x][st.gndY] === T.LAVA) {
        lava++;
        if (lava > 4) { bad(s, `연속 용암 과대 x=${x - lava + 1} (${lava}타일)`); lava = -99; }
      } else lava = 0;
    }
  }

  // ? 블록 내용물 정합: power 1개 이상 (블록이 있을 때)
  const kinds = Object.values(st.qContents);
  if (kinds.length > 0 && !kinds.includes('power')) bad(s, '파워업 없음');

  // 결정성
  const b = M.makeStage(s);
  if (JSON.stringify(b.g) !== JSON.stringify(st.g) || JSON.stringify(b.enemies) !== JSON.stringify(st.enemies)) bad(s, '결정성 위반');

  if (s % 4 === 1 || st.castle) {
    console.log(`S${String(s).padStart(2)} W${st.world}-${st.sub} ${st.theme.name}${st.castle ? ' 🏰보스' : ''} — ${st.len}타일, 적 ${st.enemies.length}, ?블록 ${kinds.length} (코인 ${st.coinTotal})`);
  }
}

console.log(fail === 0 ? '\n✅ 32 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
