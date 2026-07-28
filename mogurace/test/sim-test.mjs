// sim-test.mjs — 마우스 매핑 + 주행 물리 검증 (node 단독, 봇 주행)
import { M, mouse, SCREEN, runBot, DT } from './shim.mjs';

let fail = 0;
const bad = (msg) => { console.log(`  ✗ ${msg}`); fail++; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// 블록 안에서 bad()가 한 번이라도 불리면 PASS를 찍지 않는다
function section(name, fn) {
  const before = fail;
  const extra = fn() || '';
  if (fail === before) console.log(`PASS ${name}${extra ? '\n  · ' + extra : ''}`);
  else console.log(`FAIL ${name}`);
}

// ── 1. 마우스 → 조작 매핑 (사양 그대로) ──
section('마우스 매핑 (기준점 절대 위치 · 앞=엑셀 · 뒤=해제 · 클릭=브레이크)', () => {
  const base = { active: true, brake: false, w: SCREEN.w, h: SCREEN.h, refX: SCREEN.refX, refY: SCREEN.refY };
  const at = (x, y, brake = false) => M.Logic.readInput(Object.assign({}, base, { x, y, brake }));

  const stop = at(SCREEN.refX, SCREEN.refY);
  if (stop.throttle !== 0 || stop.steer !== 0) bad('기준점에서 엑셀·조향이 0이 아님');
  if (!near(at(SCREEN.refX, SCREEN.refY - 0.15 * SCREEN.h).throttle, 0.5)) bad('앞 15%에서 엑셀 0.5 아님');
  if (!near(at(SCREEN.refX, SCREEN.refY - 0.30 * SCREEN.h).throttle, 1)) bad('앞 30%에서 엑셀 전개 아님');
  if (at(SCREEN.refX, SCREEN.refY - 0.60 * SCREEN.h).throttle !== 1) bad('엑셀이 1을 넘어감');
  if (at(SCREEN.refX, SCREEN.refY + 0.20 * SCREEN.h).throttle !== 0) bad('기준점 뒤에서 엑셀이 0이 아님');
  if (!near(at(SCREEN.refX + 0.28 * SCREEN.w, SCREEN.refY).steer, 1)) bad('우측 28%에서 최대 타각 아님');
  if (!near(at(SCREEN.refX - 0.14 * SCREEN.w, SCREEN.refY).steer, -0.5)) bad('좌측 14%에서 -0.5 아님');
  if (at(SCREEN.refX - SCREEN.w, SCREEN.refY).steer !== -1) bad('조향이 -1을 넘어감');
  if (!at(SCREEN.refX, SCREEN.refY, true).brake) bad('좌클릭이 브레이크로 안 잡힘');
});

// ── 2. 손을 멈추면 입력이 유지된다 ──
section('마우스 정지 시 엑셀·조향 유지', () => {
  const st = M.Logic.create(1);
  const held = mouse(0.6, 0.3);
  for (let i = 0; i < 120; i++) M.Logic.step(st, DT, held);
  const t1 = st.throttle, s1 = st.steer;
  for (let i = 0; i < 120; i++) M.Logic.step(st, DT, held);   // 커서 이동 없음
  if (!near(st.throttle, t1) || !near(st.steer, s1)) bad('정지 상태에서 입력이 유지되지 않음');
  if (st.speed <= 0) bad('엑셀 0.6에서 가속되지 않음');
  return `엑셀 ${t1.toFixed(2)} 유지 · 속도 ${(st.speed * 3.6 / 1000).toFixed(0)} km/h`;
});

// ── 3. 커서 이탈 시 엑셀만 서서히 닫힘 ──
section('커서 이탈 — 엑셀만 감쇠', () => {
  const st = M.Logic.create(1);
  for (let i = 0; i < 180; i++) M.Logic.step(st, DT, mouse(1, 0.4));
  const before = st.throttle, steerBefore = st.steer;
  for (let i = 0; i < 60; i++) M.Logic.step(st, DT, { active: false, brake: false });
  if (st.throttle >= before) bad('커서 이탈 후 엑셀이 안 닫힘');
  if (st.steer !== steerBefore) bad('커서 이탈 시 조향이 흔들림');
  return `엑셀 ${before.toFixed(2)} → ${st.throttle.toFixed(2)} (조향 ${st.steer.toFixed(2)} 유지)`;
});

// ── 4. 브레이크가 실제로 감속시킨다 ──
section('좌클릭 브레이크 감속', () => {
  const st = M.Logic.create(1);
  for (let i = 0; i < 240; i++) M.Logic.step(st, DT, mouse(1, 0));
  const top = st.speed;
  for (let i = 0; i < 60; i++) M.Logic.step(st, DT, mouse(1, 0, true));
  if (st.speed >= top * 0.75) bad(`브레이크 효과 미약 ${(top / 1000).toFixed(1)} → ${(st.speed / 1000).toFixed(1)}`);
  return `${(top * 3.6 / 1000).toFixed(0)} → ${(st.speed * 3.6 / 1000).toFixed(0)} km/h (1초)`;
});

// ── 5. 노면 이탈 감속 + 가드레일 ──
section('노면 이탈 감속 + 가드레일', () => {
  const st = M.Logic.create(1);
  for (let i = 0; i < 300; i++) M.Logic.step(st, DT, mouse(1, 0));
  const onRoad = st.speed;
  for (let i = 0; i < 240; i++) M.Logic.step(st, DT, mouse(1, 1));   // 계속 우측으로
  if (Math.abs(st.playerX) <= 1) bad('조향을 끝까지 해도 도로를 못 벗어남');
  if (st.speed >= onRoad) bad('노면 이탈인데 감속하지 않음');
  if (Math.abs(st.playerX) > 2.1) bad('가드레일을 뚫고 나감');
  return `x=${st.playerX.toFixed(2)} · ${(onRoad * 3.6 / 1000).toFixed(0)} → ${(st.speed * 3.6 / 1000).toFixed(0)} km/h`;
});

// ── 6. 전 코스 완주 가능 (숙련 봇) ──
const times = [];
section('전 코스 완주 가능 (숙련 봇)', () => {
  let noStar3 = 0;
  for (let s = 1; s <= 30; s++) {
    const { st, trace, timedOut } = runBot(s, 1.0);
    if (timedOut) { bad(`S${s} 봇 주행이 끝나지 않음(무한 루프 의심)`); continue; }
    if (st.phase !== 'finish') { bad(`S${s} 숙련 봇 완주 실패 (진행률 ${(M.Logic.progress(st) * 100).toFixed(0)}%)`); continue; }
    if (st.stars < 3) noStar3++;
    times.push({ s, t: st.elapsed, stars: st.stars, hits: trace.hits, rails: trace.rails, cps: trace.cps });
  }
  if (times.length !== 30) return '';
  if (noStar3 > 6) bad(`숙련 봇이 ★3을 못 받은 코스 ${noStar3}개 — 제한시간 과소`);
  const tt = times.map((x) => x.t);
  const lo = Math.min(...tt), hi = Math.max(...tt);
  if (lo < 40) bad(`최단 완주 ${lo.toFixed(0)}초 — 코스가 너무 짧음`);
  if (hi > 130) bad(`최장 완주 ${hi.toFixed(0)}초 — 코스가 너무 긺`);
  const avgHit = times.reduce((a, b) => a + b.hits, 0) / times.length;
  if (avgHit > 25) bad(`평균 충돌 ${avgHit.toFixed(1)}회 — 교통이 벽처럼 막고 있음`);
  return `${times.length}/30 완주 · ${lo.toFixed(0)}~${hi.toFixed(0)}초 · ★3 ${times.length - noStar3}개 · 충돌 평균 ${avgHit.toFixed(1)}회`;
});
for (const x of times) if (x.s % 6 === 0 || x.s === 1) {
  console.log(`  · S${String(x.s).padStart(2)} ${x.t.toFixed(1)}초 ★${x.stars} 체크포인트 ${x.cps} 충돌 ${x.hits} 레일 ${x.rails}`);
}

// ── 7. 난이도가 실제로 작동 ──
section('난이도 상승이 실제로 작동', () => {
  let early = 0, late = 0;
  for (let s = 1; s <= 6; s++) if (runBot(s, 0.62).st.phase === 'finish') early++;
  for (let s = 25; s <= 30; s++) if (runBot(s, 0.62).st.phase === 'finish') late++;
  if (late >= early) bad(`난이도 무효 — 미숙 봇 완주 초반 ${early}/6, 후반 ${late}/6`);
  return `미숙 봇(62%) 완주 — 초반 ${early}/6 → 후반 ${late}/6`;
});

// ── 8. 체크포인트 시간 연장 ──
section('체크포인트 통과 시 제한시간 연장', () => {
  const st = M.Logic.create(1);
  let got = null;
  for (let i = 0; i < 60 * 200 && !got; i++) {
    for (const e of M.Logic.step(st, DT, mouse(1, 0))) if (e.type === 'checkpoint') got = e;
  }
  if (!got) { bad('체크포인트를 통과하지 못함'); return ''; }
  if (!near(got.bonus, st.stage.cpBonus)) bad('체크포인트 보너스 불일치');
  return `+${got.bonus}초`;
});

// ── 9. 시간 초과 종료 ──
section('제한시간 소진 시 주행 종료', () => {
  const st = M.Logic.create(30);
  let guard = 0;
  while (st.phase !== 'timeout' && st.phase !== 'finish' && guard++ < 60 * 400) {
    M.Logic.step(st, DT, mouse(0.05, 0));
  }
  if (st.phase !== 'timeout') bad(`기어가는 주행인데 시간 초과가 안 남 (${st.phase})`);
  return `진행률 ${(M.Logic.progress(st) * 100).toFixed(0)}%에서 종료`;
});

// ── 10. 결정성 ──
section('동일 입력 → 동일 결과 (결정성)', () => {
  const a = runBot(13, 0.9).st, b = runBot(13, 0.9).st;
  if (a.phase !== b.phase || !near(a.elapsed, b.elapsed) || !near(a.pos, b.pos, 1e-6)) bad('같은 입력인데 결과가 다름');
});

console.log(fail === 0 ? '\n✅ sim-test 전체 통과' : `\n❌ sim-test 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
