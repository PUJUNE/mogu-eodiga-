// sim-test.mjs — 로직 단독 검증: 라인 판정 · 슛 타이밍 · 득점 · 클리어 · 덩크 · 크로스오버 · 스틸 · 샷 클락 · 난이도
// 사용: node mogubasket/test/sim-test.mjs
import './shim.mjs';

const M = window.MBK, L = M.Logic;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const DT = 1 / 60;
const live = (st) => { st.phase = 'live'; st.phaseT = 0; };
const run = (st, sec, f) => { const evs = []; for (let i = 0; i < sec * 60; i++) evs.push(...L.step(st, DT, f ? f(i) : [{}, {}])); return evs; };
const park = (p, x, y) => Object.assign(p, { x, y, vx: 0, vy: 0, z: 0, vz: 0, state: 'idle', shot: null });

// ══ 1. 라인 판정 ══
check('탑(0, 8.6)은 2점 라인 밖', L.outsideArc(0, 8.6));
check('자유투 부근(0, 5)은 안', !L.outsideArc(0, 5));
check('코너(6.5, 1)는 밖 · (5.8, 1)은 안', L.outsideArc(6.5, 1) && !L.outsideArc(5.8, 1));

// ══ 2. 체크 볼 → 경기 시작 ══
{
  const st = L.create(1, 'mogu', 'mouse', 'normal');
  check('시작은 체크 볼 · 내 공', st.phase === 'check' && st.ball.holder === 0);
  const evs = run(st, M.CHECK_T + 0.05);
  check('체크 대기 뒤 라이브', st.phase === 'live' && evs.some((e) => e.type === 'live'));
}

// ══ 3. 점프슛: 굿 릴리스 노마크면 잘 들어가고, 너무 이르면 덜 들어간다 ══
function shootTrials(holdFrames, n, x = 2.5, y = 6.8) {
  let made = 0, pts = 0, q = [];
  for (let s = 1; s <= n; s++) {
    const st = L.create(s * 7, 'mogu', 'mouse', 'normal'); live(st);
    park(st.pl[0], x, y); park(st.pl[1], -6.5, 10.5);
    for (let i = 0; i < 360 && st.phase === 'live'; i++) {
      for (const e of L.step(st, DT, [{ shoot: i < holdFrames }, {}])) {
        if (e.type === 'meter') q.push(e.q);
        if (e.type === 'score' && e.idx === 0) { made++; pts = e.pts; }
      }
    }
  }
  return { rate: made / n, pts, q: q.reduce((a, b) => a + b, 0) / q.length };
}
const goodHold = Math.round((M.GATHER_T + 0.78 * M.METER_T) * 60);
const good = shootTrials(goodHold, 120), early = shootTrials(Math.round((M.GATHER_T + 0.3 * M.METER_T) * 60), 120);
check('굿 릴리스(게이지 0.78) 품질 1', good.q > 0.99, good.q.toFixed(2));
check('노마크 굿 릴리스 성공률 45~80%', good.rate > 0.45 && good.rate < 0.8, (good.rate * 100).toFixed(0) + '%');
check('일찍 떼면 성공률이 확 떨어진다', early.rate < good.rate - 0.15, `${(early.rate * 100).toFixed(0)}% < ${(good.rate * 100).toFixed(0)}%`);
const three = shootTrials(goodHold, 60, 0, 8.8);
check('2점 라인 밖 득점은 2점', three.pts === 2, `${three.pts}점 · 성공률 ${(three.rate * 100).toFixed(0)}%`);
const two = shootTrials(goodHold, 60, 1.5, 4.5);
check('2점 라인 안 득점은 1점', two.pts === 1);

// ══ 4. 클리어 규칙 ══
{
  const st = L.create(3, 'mogu', 'mouse', 'normal'); live(st);
  st.cleared = false; park(st.pl[0], 1, 4); park(st.pl[1], -6, 10);
  const evs = run(st, 0.1, () => [{ shoot: true }, {}]);
  check('클리어 전 슛 → 막히고 안내', evs.some((e) => e.type === 'need-clear') && st.pl[0].state !== 'shoot');
  const evs2 = run(st, 2.5, () => [{ my: 1, shoot: false }, {}]);
  check('라인 밖으로 나가면 클리어', st.cleared && evs2.some((e) => e.type === 'cleared'));
}

// ══ 5. 덩크: 달려 들어가면 덩크로 1점, 앞이 막히면 레이업 ══
{
  let dunks = 0, made = 0;
  for (let s = 1; s <= 20; s++) {
    const st = L.create(s, 'mogu', 'mouse', 'normal'); live(st);
    park(st.pl[0], 0.3, 5.2); park(st.pl[1], -6, 10);
    for (let i = 0; i < 300 && st.phase === 'live'; i++) {
      const d = L.distHoop(st.pl[0].x, st.pl[0].y);
      for (const e of L.step(st, DT, [{ my: -1, shoot: d < 1.6 }, {}])) { if (e.type === 'dunk') dunks++; if (e.type === 'score') made++; }
    }
  }
  check('노마크로 달려 들어가 슛 → 덩크', dunks >= 18, `${dunks}/20`);
  check('노마크 덩크는 거의 다 들어간다', made >= 17, `${made}/20`);
  const st = L.create(5, 'mogu', 'sumo', 'normal'); live(st);
  park(st.pl[0], 0, 3.5); park(st.pl[1], 0, 2.4);
  st.pl[0].vy = -4;
  const evs = run(st, 0.05, () => [{ my: -1, shoot: true }, {}]);
  check('수비가 골대 앞을 막으면 덩크 대신 레이업', !evs.some((e) => e.type === 'dunk-start') && evs.some((e) => e.type === 'gather' && e.layup));
  const mouse = L.create(5, 'mouse', 'mogu', 'normal'); live(mouse);
  park(mouse.pl[0], 0, 3.0); park(mouse.pl[1], -6, 10); mouse.pl[0].vy = -4;
  const ev2 = run(mouse, 0.05, () => [{ my: -1, shoot: true }, {}]);
  check('덩크 못 하는 선수(생쥐)는 레이업', ev2.some((e) => e.type === 'gather' && e.layup));
}

// ══ 6. 크로스오버 → 앵클 브레이크 · 스틸 ══
{
  let ankles = 0, steals = 0;
  for (let s = 1; s <= 200; s++) {
    const st = L.create(s, 'ninja', 'mouse', 'easy'); live(st);
    park(st.pl[0], 0, 7.5); park(st.pl[1], 0, 6.4);
    for (const e of L.step(st, DT, [{ act: true }, {}])) if (e.type === 'ankle') ankles++;
    const s2 = L.create(s, 'mogu', 'mouse', 'normal'); live(s2);
    park(s2.pl[0], 0, 6.4); park(s2.pl[1], 0, 7.3); s2.ball.holder = 1; s2.off = 1;
    for (const e of L.step(s2, DT, [{ act: true }, {}])) if (e.type === 'steal') steals++;
  }
  check('정면 수비에 크로스오버 → 가끔 넘어진다 (10~60%)', ankles > 20 && ankles < 120, `${ankles}/200`);
  check('붙어서 스틸 → 가끔 성공 (10~50%)', steals > 20 && steals < 100, `${steals}/200`);
  const st = L.create(9, 'mogu', 'mouse', 'normal'); live(st);
  park(st.pl[0], 0, 7.5); park(st.pl[1], 0, 6.4); st.pl[1].state = 'stumble'; st.pl[1].stT = M.STUMBLE_T;
  run(st, 0.3, () => [{}, { mx: 1 }]);
  check('넘어진 수비는 못 움직인다', Math.abs(st.pl[1].x) < 0.2);
}

// ══ 7. 샷 클락 ══
{
  const st = L.create(4, 'mogu', 'mouse', 'normal'); live(st);
  const evs = run(st, M.SHOT_CLOCK + 0.2);
  check('12초 안에 안 쏘면 바이얼레이션 → 상대 공', evs.some((e) => e.type === 'violation') && st.off === 1);
}

// ══ 8. 컴퓨터끼리 전 경기 · 난이도 효과 ══
let stuck = 0, games = 0, T = 0;
const oppWin = {};
const kinds = {};
for (const d of M.DIFF_ORDER) {
  let w = 0, n = 0;
  for (const opp of M.LADDER) for (let s = 1; s <= 3; s++) {
    const st = L.create(s * 97 + opp.length, 'mogu', opp, d);
    const a0 = M.makeAI(st, 0), a1 = M.makeAI(st, 1);
    let k = 0;
    while (st.phase !== 'over' && k++ < 60 * 600) for (const e of L.step(st, DT, [a0(), a1()])) if (e.type === 'score') kinds[e.kind] = (kinds[e.kind] || 0) + e.pts;
    games++; T += st.t; n++;
    if (st.phase !== 'over') stuck++;
    if (st.winner === 1) w++;
  }
  oppWin[d] = w / n;
}
check('모든 경기가 끝난다 (멈춤 없음)', stuck === 0, `${games}경기 · 평균 ${(T / games).toFixed(0)}초`);
console.log('  상대 승률 (같은 컴퓨터가 모구를 조종할 때):', Object.entries(oppWin).map(([d, v]) => `${d} ${(v * 100).toFixed(0)}%`).join(' · '));
console.log('  득점 구성:', JSON.stringify(kinds));
check('어려울수록 상대가 강하다 (이지 < 크레이지)', oppWin.easy < oppWin.crazy);
const tot = Object.values(kinds).reduce((a, b) => a + b, 0);
check('덩크만 하는 경기가 아니다 (덩크 득점 50% 미만)', (kinds.dunk || 0) / tot < 0.5, ((kinds.dunk || 0) / tot * 100).toFixed(0) + '%');
check('점프슛 득점이 25% 이상', (kinds.jumper || 0) / tot > 0.25, ((kinds.jumper || 0) / tot * 100).toFixed(0) + '%');

console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
