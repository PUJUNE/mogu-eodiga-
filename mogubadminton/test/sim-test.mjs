// sim-test.mjs — 로직 단독 검증: 셔틀 물리 · 타구 조준 · 판정(인·아웃·네트·서브) · 서브 위치 · 듀스 · 스윙 · 난이도
// 사용: node mogubadminton/test/sim-test.mjs
import './shim.mjs';

const M = window.MBD, L = M.Logic;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const DT = 1 / 60;

// ══ 1. 셔틀 물리 ══
{
  const r = L.simulate(0, 0, 40, 0, 0, 0, 10);
  const b = { x: 0, y: 0, z: 40, vx: 0, vy: 0, vz: 0 };
  let v = 0; for (let i = 0; i < 600; i++) { const s = Math.hypot(b.vx, b.vy, b.vz); b.vz += (-M.G - M.DRAG * s * b.vz) / 120; b.z += b.vz / 120; v = b.vz; }
  check('떨어뜨리면 종단 속도(6.8m/s) 근처에서 멈춘다', Math.abs(-v - M.SHUTTLE_VT) < 0.3, (-v).toFixed(2));
  const fast = L.simulate(0, 4, 2.5, 0, -30, -6);
  check('빠르게 쳐도 공기저항으로 금방 느려진다 (30m/s 스매시가 8m 안에 떨어짐)', Math.abs(fast.y - 4) < 8, `${(4 - fast.y).toFixed(1)}m`);
}

// ══ 2. 타구 조준: 각 샷이 목표 근처에 떨어지고 네트를 넘는다 ══
for (const [type, from, target] of [['clear', [0, 5, 1.0], [1.5, -5.9]], ['smash', [0, 3, 2.6], [-1, -3.6]], ['drop', [0, 4.5, 2.2], [0.5, -1.4]],
  ['net', [0, 1.2, 0.6], [0, -0.7]], ['lift', [0, 1.5, 0.5], [0, -5.6]], ['serveHigh', [0.9, 2.7, 1.05], [-1, -6.0]], ['serveShort', [0.9, 2.7, 1.05], [-1, -2.3]]]) {
  const sol = L.solve(from[0], from[1], from[2], target[0], target[1], M.SHOTS[type]);
  const r = L.simulate(from[0], from[1], from[2], sol.vx, sol.vy, sol.vz);
  const err = Math.hypot(r.x - target[0], r.y - target[1]);
  check(`${M.SHOTS[type].name}: 목표 0.35m 안 · 네트 위로`, err < 0.35 && r.netZ > M.NET_H, `오차 ${err.toFixed(2)}m · 네트 위 ${r.netZ.toFixed(2)}m · 초속 ${sol.spd.toFixed(1)}`);
}

// ══ 3. 판정 ══
function landAt(x, y, hitter, serve = false) {
  const st = L.create(5, 'mogu', 'mouse', 'normal');
  st.phase = 'rally';
  Object.assign(st.sh, { held: null, last: hitter, serve, netHit: false, x, y, z: 0.05, vx: 0, vy: 0, vz: -3, shot: 'clear' });
  const evs = []; for (let i = 0; i < 10 && st.phase === 'rally'; i++) evs.push(...L.step(st, DT, [{}, {}]));
  return evs.find((e) => e.type === 'point');
}
{
  let e = landAt(1, -4, 0); check('상대 코트 안에 떨어지면 친 쪽 득점 (인)', e && e.won === 0 && e.why === 'in');
  e = landAt(2.9, -4, 0); check('단식 사이드라인 밖이면 아웃 → 상대 득점', e && e.won === 1 && e.why === 'out');
  e = landAt(0, -6.9, 0); check('베이스라인 밖이면 아웃', e && e.won === 1 && e.why === 'out');
  e = landAt(0, -1.2, 0, true); check('서브가 숏 서비스 라인 앞에 떨어지면 폴트', e && e.won === 1);
  e = landAt(0, 3, 1); check('상대가 친 셔틀이 내 코트에 → 상대 득점', e && e.won === 1 && e.why === 'in');
  // 네트
  const st = L.create(6, 'mogu', 'mouse', 'normal'); st.phase = 'rally';
  Object.assign(st.sh, { held: null, last: 0, serve: false, netHit: false, x: 0, y: 0.6, z: 1.0, vx: 0, vy: -6, vz: 0, shot: 'drop' });
  const evs = []; for (let i = 0; i < 200 && st.phase === 'rally'; i++) evs.push(...L.step(st, DT, [{}, {}]));
  const p = evs.find((x) => x.type === 'point');
  check('네트에 걸리면 친 쪽 실점', evs.some((x) => x.type === 'net') && p && p.won === 1 && p.why === 'net');
}

// ══ 4. 서브 위치 · 듀스 ══
{
  const st = L.create(7, 'mogu', 'mouse', 'normal');
  check('0점(짝수) 서브는 오른쪽 코트, 리시버는 대각선', st.pl[0].x > 0 && st.pl[1].x < 0 && st.pl[0].y > 0 && st.pl[1].y < 0);
  st.score = [10, 10];
  st.phase = 'rally';
  Object.assign(st.sh, { held: null, last: 0, serve: false, netHit: false, x: 0, y: -4, z: 0.02, vx: 0, vy: 0, vz: -2, shot: 'clear' });
  let evs = []; for (let i = 0; i < 5; i++) evs.push(...L.step(st, DT, [{}, {}]));
  check('10:10 → 11:10 은 아직 안 끝난다 (듀스)', st.winner === null && st.score[0] === 11);
  for (let i = 0; i < 120; i++) L.step(st, DT, [{}, {}]);
  check('득점한 쪽이 다음 서브 · 홀수 점수면 왼쪽 코트', st.phase === 'serve' && st.server === 0 && st.pl[0].x < 0);
  st.score = [14, 14]; st.phase = 'rally';
  Object.assign(st.sh, { held: null, last: 1, serve: false, netHit: false, x: 0, y: 4, z: 0.02, vx: 0, vy: 0, vz: -2, shot: 'clear' });
  for (let i = 0; i < 5; i++) L.step(st, DT, [{}, {}]);
  check('14:14 다음 점수로 15점에서 끝 (상한)', st.winner === 1 && st.score[1] === 15);
}

// ══ 5. 스윙: 닿으면 맞고, 높이·버튼에 따라 샷이 갈린다 ══
function swingAt(px, py, sx, sy, sz, key) {
  const st = L.create(9, 'mogu', 'mouse', 'normal'); st.phase = 'rally';
  Object.assign(st.pl[0], { x: px, y: py, z: 0, vx: 0, vy: 0, swing: null, swingCd: 0 });
  Object.assign(st.sh, { held: null, last: 1, serve: false, netHit: false, x: sx, y: sy, z: sz, vx: 0, vy: 0.2, vz: -0.5, shot: 'clear' });
  const evs = []; for (let i = 0; i < 8; i++) evs.push(...L.step(st, DT, [{ [key]: i === 0 }, {}]));
  return evs.find((e) => e.type === 'hit');
}
{
  let h = swingAt(0, 4, 0.3, 4, 2.4, 'strong'); check('높은 셔틀 + 강타 = 스매시', h && h.shot === 'smash', h && h.shot);
  h = swingAt(0, 4, 0.3, 4, 2.3, 'soft'); check('높은 셔틀 + 연타 = 드롭', h && h.shot === 'drop', h && h.shot);
  h = swingAt(0, 1.6, 0.3, 1.6, 0.5, 'soft'); check('네트 앞 낮은 셔틀 + 연타 = 헤어핀', h && h.shot === 'net', h && h.shot);
  h = swingAt(0, 5.5, 0.3, 5.5, 0.6, 'strong'); check('뒤쪽 낮은 셔틀 + 강타 = 리프트', h && h.shot === 'lift', h && h.shot);
  h = swingAt(0, 4, 2.0, 4, 1.5, 'strong'); check('라켓이 안 닿으면 헛스윙', !h);
}

// ══ 6. 컴퓨터끼리 전 경기 · 난이도 효과 ══
let stuck = 0, games = 0, T = 0, hits = 0, rallies = 0;
const oppWin = {};
for (const d of M.DIFF_ORDER) {
  let w = 0, n = 0;
  for (const opp of M.LADDER) for (let s = 1; s <= 2; s++) {
    const st = L.create(s * 131 + opp.length * 7, 'mogu', opp, d);
    const a0 = M.makeAI(st, 0), a1 = M.makeAI(st, 1);
    let k = 0;
    while (st.phase !== 'over' && k++ < 60 * 900) for (const e of L.step(st, DT, [a0(), a1()])) { if (e.type === 'hit') hits++; if (e.type === 'point') rallies++; }
    games++; T += st.t; n++;
    if (st.phase !== 'over') stuck++;
    if (st.winner === 1) w++;
  }
  oppWin[d] = w / n;
}
check('모든 경기가 끝난다 (멈춤 없음)', stuck === 0, `${games}경기 · 평균 ${(T / games).toFixed(0)}초`);
console.log('  상대 승률 (컴퓨터가 모구를 조종할 때):', Object.entries(oppWin).map(([d, v]) => `${d} ${(v * 100).toFixed(0)}%`).join(' · '));
check('어려울수록 상대가 강하다 (이지 < 크레이지)', oppWin.easy < oppWin.crazy);
check('랠리가 이어진다 (점수당 평균 3타 이상)', hits / rallies >= 3, (hits / rallies).toFixed(1) + '타');

console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
