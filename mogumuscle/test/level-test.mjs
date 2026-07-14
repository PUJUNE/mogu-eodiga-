// level-test.mjs — 스테이지 1~10 생성 검증 (node 단독) — 원작 준거 능력치 범위 포함
import './shim.mjs';

const M = globalThis.window.MMS;
let fail = 0;
const bad = (s, msg) => { console.log(`  ✗ S${s} ${msg}`); fail++; };

const SP_KINDS = ['rear', 'punch', 'jump', 'dash', 'gas'];

let prevDmg = 0, prevAggr = 0, prevCounter = 0;
const names = new Set();
for (let s = 1; s <= 10; s++) {
  const st = M.makeStage(s);

  if (st.dmgMul < prevDmg) bad(s, '적 대미지 배율 역행');
  if (st.aggr < prevAggr) bad(s, '공격성 역행');
  if (st.counter < prevCounter) bad(s, '카운터율 역행');
  prevDmg = st.dmgMul; prevAggr = st.aggr; prevCounter = st.counter;

  if (!st.team || !st.team.name || !st.team.a.name || !st.team.b.name) bad(s, '팀 데이터 누락');
  if (names.has(st.team.name)) bad(s, '팀 이름 중복');
  names.add(st.team.name);

  // 원작 능력치 범위: 기본기 3~10, 필살기 10~40, 이속 90~128
  for (const [k, v] of Object.entries(st.team.mv)) {
    if (v < 3 || v > 10) bad(s, `기본기 ${k}=${v} 원작 범위(3~10) 밖`);
  }
  if (!SP_KINDS.includes(st.team.sp.kind)) bad(s, `필살기 유형 오류 (${st.team.sp.kind})`);
  if (st.team.sp.dmg < 10 || st.team.sp.dmg > 40) bad(s, `필살기 대미지 ${st.team.sp.dmg} 원작 범위(10~40) 밖`);
  if (st.spd < 90 || st.spd > 128) bad(s, `이속 ${st.spd} 원작 범위(90~128) 밖`);

  if (st.time !== 30) bad(s, '폴 제한시간 오류 (원작 30초)');
  if (st.electric !== (s >= 7)) bad(s, '전류 링 구간 오류 (7~10)');
  if (st.aggr > 0.95) bad(s, '공격성 상한 초과');

  const b = M.makeStage(s);
  if (JSON.stringify(b) !== JSON.stringify(st)) bad(s, '결정성 위반');

  console.log(`S${String(s).padStart(2)} ${st.team.name} — DMG ×${st.dmgMul}, SPD ${st.spd}, 공격성 ${st.aggr}, 카운터 ${st.counter}, 필살 ${st.team.sp.name}(${st.team.sp.kind} ${st.team.sp.dmg})${st.electric ? ' ⚡전류' : ''}`);
}

// 아군 (원작 계보: 모구=킨니쿠맨, 꼬꼬=라멘맨)
{
  for (const [k, h] of Object.entries(M.HEROES)) {
    for (const [mk, v] of Object.entries(h.mv)) if (v < 3 || v > 10) bad('H', `${k} 기본기 ${mk}=${v} 범위 밖`);
    if (!SP_KINDS.includes(h.sp.kind)) bad('H', `${k} 필살기 유형 오류`);
  }
  if (M.HEROES.mogu.sp.dmg !== 40) bad('H', '모구 필살기 40 아님 (원작 킨니쿠 드라이버)');
  if (M.HEROES.kko.sp.dmg !== 30) bad('H', '꼬꼬 필살기 30 아님 (원작 공중살법)');
  console.log(`아군 — 모구 SPD ${M.HEROES.mogu.spd} 필살 ${M.HEROES.mogu.sp.dmg} / 꼬꼬 SPD ${M.HEROES.kko.spd} 필살 ${M.HEROES.kko.sp.dmg}`);
}

// 필살기 유형 다양성 (원작: 발동 유형 4갈래 + 투사체는 단 1인)
{
  const kinds = new Set(M.TEAMS.map((t) => t.sp.kind));
  if (kinds.size < 4) bad('V', `필살기 유형 ${kinds.size}종 — 4종 이상이어야`);
  const gasTeams = M.TEAMS.filter((t) => t.sp.kind === 'gas');
  if (gasTeams.length !== 1) bad('V', '투사체(가스) 팀은 정확히 1팀 (원작 브로켄 유일)');
  console.log(`필살기 유형 ${kinds.size}종, 투사체 팀: ${gasTeams.map((t) => t.name).join()}`);
}

// 난이도 배율
{
  const mk = (d) => { M.diff = d; const s = M.makeStage(5); M.diff = 'normal'; return s; };
  const ez = mk('easy'), n = mk('normal'), hd = mk('hard'), cz = mk('crazy');
  if (!(ez.dmgMul < n.dmgMul && n.dmgMul < hd.dmgMul && hd.dmgMul < cz.dmgMul)) bad('D', `난이도 대미지 배율 (${ez.dmgMul} ${n.dmgMul} ${hd.dmgMul} ${cz.dmgMul})`);
  if (!(cz.aggr > n.aggr)) bad('D', '크레이지 공격성 증가');
  if (!(cz.ballInt > n.ballInt)) bad('D', '크레이지 구슬 희소화');
  console.log(`난이도 DMG: 이지 ${ez.dmgMul} < 노말 ${n.dmgMul} < 하드 ${hd.dmgMul} < 크레이지 ${cz.dmgMul}`);
}

console.log(fail === 0 ? '\n✅ 10 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
