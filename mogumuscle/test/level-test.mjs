// level-test.mjs — 스테이지 1~10 생성 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MMS;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

let prevHp = 0, prevAtk = 0, prevAggr = 0, prevBall = Infinity;
const names = new Set();
for (let s = 1; s <= 10; s++) {
  const st = M.makeStage(s);

  if (st.hp < prevHp) bad(s, '적 체력 역행');
  if (st.atk < prevAtk) bad(s, '적 공격력 역행');
  if (st.aggr < prevAggr) bad(s, '공격성 역행');
  if (st.ballInt > prevBall) bad(s, '파워볼 간격 역행 (갈수록 짧아져야)');
  prevHp = st.hp; prevAtk = st.atk; prevAggr = st.aggr; prevBall = st.ballInt;

  if (!st.team || !st.team.name || !st.team.a.name || !st.team.b.name) bad(s, '팀 데이터 누락');
  if (names.has(st.team.name)) bad(s, '팀 이름 중복');
  names.add(st.team.name);
  if (st.time !== 99) bad(s, '경기 시간 오류');
  if (st.aggr > 0.95) bad(s, '공격성 상한 초과');

  const b = M.makeStage(s);
  if (JSON.stringify(b) !== JSON.stringify(st)) bad(s, '결정성 위반');

  console.log(`S${String(s).padStart(2)} ${st.team.name} — HP ${st.hp}, ATK ×${st.atk}, SPD ${st.spd}, 공격성 ${st.aggr}, 파워볼 ${st.ballInt}s`);
}

// 난이도 배율
{
  const mk = (d) => { M.diff = d; const s = M.makeStage(5); M.diff = 'normal'; return s; };
  const ez = mk('easy'), n = mk('normal'), hd = mk('hard'), cz = mk('crazy');
  if (!(ez.hp < n.hp && n.hp < hd.hp && hd.hp < cz.hp)) bad('D', `난이도 체력 배율 (${ez.hp} ${n.hp} ${hd.hp} ${cz.hp})`);
  if (!(ez.atk < n.atk && n.atk < cz.atk)) bad('D', '난이도 공격력 배율');
  if (!(cz.aggr > n.aggr)) bad('D', '크레이지 공격성 증가');
  if (!(cz.ballInt > n.ballInt)) bad('D', '크레이지 파워볼 희소화');
  console.log(`난이도 HP: 이지 ${ez.hp} < 노말 ${n.hp} < 하드 ${hd.hp} < 크레이지 ${cz.hp}`);
}

console.log(fail === 0 ? '\n✅ 10 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
