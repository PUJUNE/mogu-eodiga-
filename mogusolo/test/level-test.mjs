// level-test.mjs — 50스테이지(5미션×10) 생성 + 난이도 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSL;
let fail = 0;
const bad = (no, msg) => { console.log(`  ✗ M${M.mOf(no)}-${M.sOf(no)} ${msg}`); fail++; };

for (let no = 1; no <= M.TOTAL; no++) {
  const m = M.mOf(no), s = M.sOf(no);
  const st = M.makeStage(no);
  const final = s === M.STAGES_PER;
  const nSec = final ? 4 : 3;
  const last = st.sections[st.sections.length - 1];

  // 구간 수 (중간보스 3 / 메인보스 4) + 마지막은 보스
  if (st.sections.length !== nSec) bad(no, `구간 수 ${st.sections.length} (기대 ${nSec})`);
  if (!last.boss) bad(no, '보스 없음');
  const wantBoss = final ? M.BOSSES[m].name : M.MIDBOSSES[m][s - 1].name;
  if (last.boss.name !== wantBoss) bad(no, `보스 불일치 ${last.boss.name} ≠ ${wantBoss}`);
  if (!!last.boss.final !== final) bad(no, 'final 플래그 불일치');
  if (st.length !== st.sections.length * 420) bad(no, `길이 불일치 ${st.length}`);

  // 웨이브 각 구간 2개 + 적 존재 + 타입 유효
  let total = 0, rangedN = 0;
  for (let sc = 0; sc < st.sections.length - 1; sc++) {
    const sec = st.sections[sc];
    if (sec.waves.length !== 2) bad(no, `구간${sc} 웨이브 수 ${sec.waves.length}`);
    for (const wave of sec.waves) {
      for (const w of wave) {
        const E = M.ETYPES[w.type];
        if (!E) { bad(no, `미정의 적 타입 ${w.type}`); continue; }
        total++;
        if (E.ranged) rangedN++;
        if (w.z < M.Z_MIN || w.z > M.Z_MAX) bad(no, `z 범위 밖 ${w.z}`);
      }
    }
  }
  if (total < (final ? 8 : 5)) bad(no, `적 너무 적음 ${total}`);

  // 미션 내 성장: 같은 미션 이전 스테이지보다 웨이브 HP 배율 증가
  if (s > 1) {
    const prev = M.makeStage(no - 1);
    if (st.sections[0].waves[0][0].hpMul <= prev.sections[0].waves[0][0].hpMul) bad(no, 'hpMul 미성장');
  }
  // 중간보스 < 메인보스 HP
  if (!final && last.boss.hp >= M.BOSSES[m].hp) bad(no, `중간보스 HP ${last.boss.hp} ≥ 메인 ${M.BOSSES[m].hp}`);

  // 결정성
  const b = M.makeStage(no);
  if (JSON.stringify(b.sections) !== JSON.stringify(st.sections)) bad(no, '결정성 위반');

  if (final) console.log(`M${m} ${st.theme.name} — 적 ${total} (원거리 ${rangedN}) · 메인보스 ${last.boss.name}`);
}

// 바란 벼락 필드
if (M.BOSSES[5].base !== 'baran') bad(50, '바란 base 불일치');

// 난이도: 배율 적용 확인 (이지 < 노말 < 하드 < 크레이지, 크레이지는 인원 +1)
{
  const stats = {};
  for (const d of M.DIFF_ORDER) {
    M.diff = d;
    const st = M.makeStage(25);
    stats[d] = {
      hp: st.sections[0].waves[0][0].hpMul,
      dmg: st.sections[0].waves[0][0].dmgMul,
      bossHp: st.sections[st.sections.length - 1].boss.hp,
      n: st.sections[0].waves[0].length,
    };
  }
  M.diff = 'normal';
  const ord = M.DIFF_ORDER;
  for (let i = 1; i < ord.length; i++) {
    const a = stats[ord[i - 1]], b = stats[ord[i]];
    if (!(a.hp < b.hp && a.dmg < b.dmg && a.bossHp < b.bossHp)) bad(25, `난이도 단조 증가 위반 ${ord[i]}`);
  }
  if (stats.crazy.n !== stats.normal.n + 1) bad(25, `크레이지 인원 +1 아님 (${stats.normal.n} → ${stats.crazy.n})`);
  console.log(`난이도 보스HP: 이지 ${stats.easy.bossHp} / 노말 ${stats.normal.bossHp} / 하드 ${stats.hard.bossHp} / 크레이지 ${stats.crazy.bossHp}`);
}

// 중간보스 데이터 무결: 미션당 9명 + 이름 중복 없음
{
  const names = new Set();
  for (let m = 1; m <= 5; m++) {
    if (M.MIDBOSSES[m].length !== 9) bad(m * 10, `중간보스 ${M.MIDBOSSES[m].length}명 (기대 9)`);
    for (const mb of M.MIDBOSSES[m]) {
      if (names.has(mb.name)) bad(m * 10, `중간보스 이름 중복 ${mb.name}`);
      names.add(mb.name);
    }
  }
}

console.log(fail === 0 ? '\n✅ 50 스테이지 전수 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
