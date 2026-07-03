// level-test.mjs — 6스테이지 데이터 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDV;
let fail = 0;
const bad = (no, msg) => { console.log(`  ✗ S${no} ${msg}`); fail++; };

let prevDepth = 0, prevBossHp = 0;
for (let no = 1; no <= M.TOTAL; no++) {
  const st = M.makeStage(no);

  if (!st.theme || !st.theme.name) bad(no, '테마 없음');
  if (!(st.quota >= 3)) bad(no, `할당량 이상 ${st.quota}`);
  if (!(st.depth > M.SURF + 200)) bad(no, `깊이 부족 ${st.depth}`);
  if (st.depth <= prevDepth) bad(no, `깊이 미증가 ${st.depth}`);
  prevDepth = st.depth;

  // 어군 풀 유효성
  if (!st.pool || st.pool.length < 3) bad(no, '어군 풀 부족');
  for (const t of st.pool) {
    const F = M.FISH[t];
    if (!F) { bad(no, `미정의 어종 ${t}`); continue; }
    if (F.hazard) bad(no, `풀에 위험물 ${t}`);
    if (!(F.hp >= 1 && F.score > 0 && F.spd > 0)) bad(no, `어종 스탯 이상 ${t}`);
  }
  if (!(st.jellyN >= 1)) bad(no, '해파리 없음');

  // 보스
  const B = st.boss;
  if (!B || !B.name) bad(no, '보스 없음');
  if (!['spikes', 'zap', 'charge', 'ink', 'kraken'].includes(B.base)) bad(no, `보스 base 이상 ${B.base}`);
  if (B.hp <= prevBossHp) bad(no, `보스 HP 미증가 ${B.hp}`);
  prevBossHp = B.hp;

  console.log(`S${no} ${st.theme.name} — 깊이 ${st.depth} · 할당 ${st.quota} · 보스 ${B.name} (${B.base}, HP ${B.hp})`);
}

// 어종 사전 무결
for (const [k, F] of Object.entries(M.FISH)) {
  if (!F.name || !F.body) bad(0, `어종 데이터 결손 ${k}`);
  if (!F.hazard && !(F.weight > 0.5 && F.weight <= 1)) bad(0, `weight 이상 ${k}`);
}

// 생성 결정성 (같은 스테이지 → 같은 초기 어군)
{
  const L = M.Logic;
  const a = L.create(3), b = L.create(3);
  const key = (st) => JSON.stringify(st.fish.map((f) => [f.type, +f.x.toFixed(2), +f.y.toFixed(2)]));
  if (key(a) !== key(b)) bad(3, '초기 어군 결정성 위반');
}

console.log(fail === 0 ? '\n✅ 6 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
