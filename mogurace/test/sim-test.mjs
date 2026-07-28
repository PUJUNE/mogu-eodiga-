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

// ── 1. 마우스 → 조작 매핑 (앞=엑셀 · 데드존=관성 · 뒤=브레이크 깊이 비례) ──
section('마우스 매핑 (앞=엑셀 · 데드존=관성 · 뒤=브레이크 깊이 비례)', () => {
  const { DEAD_Y, RANGE_Y, BRAKE_Y } = M.Logic;
  const base = { active: true, w: SCREEN.w, h: SCREEN.h, refX: SCREEN.refX, refY: SCREEN.refY };
  // dyFrac + = 기준점 위 (화면 높이 비율)
  const at = (dxFrac, dyFrac) => M.Logic.readInput(Object.assign({}, base, {
    x: SCREEN.refX + dxFrac * SCREEN.w, y: SCREEN.refY - dyFrac * SCREEN.h,
  }));

  const stop = at(0, 0);
  if (stop.throttle !== 0 || stop.brake !== 0 || stop.steer !== 0) bad('기준점에서 전 입력이 0이 아님');
  if (at(0, DEAD_Y * 0.9).throttle !== 0) bad('데드존 위쪽인데 엑셀이 걸림');
  if (at(0, -DEAD_Y * 0.9).brake !== 0) bad('데드존 아래쪽인데 브레이크가 걸림');
  if (!near(at(0, RANGE_Y).throttle, 1)) bad('엑셀 전개 지점에서 1이 아님');
  if (at(0, RANGE_Y * 2).throttle !== 1) bad('엑셀이 1을 넘어감');
  if (!near(at(0, (DEAD_Y + RANGE_Y) / 2).throttle, 0.5)) bad('엑셀 중간 지점에서 0.5가 아님');
  if (!near(at(0, -BRAKE_Y).brake, 1)) bad('브레이크 전개 지점에서 1이 아님');
  if (at(0, -BRAKE_Y * 2).brake !== 1) bad('브레이크가 1을 넘어감');
  const shallow = at(0, -(DEAD_Y + 0.02)).brake, deep = at(0, -BRAKE_Y * 0.8).brake;
  if (!(shallow > 0 && deep > shallow && deep < 1)) bad(`브레이크 깊이 비례 실패 (얕음 ${shallow.toFixed(2)} 깊음 ${deep.toFixed(2)})`);
  if (at(0, -0.1).throttle !== 0) bad('브레이크 중인데 엑셀이 걸림');
  if (!near(at(0.28, 0).steer, 1)) bad('우측 28%에서 최대 타각 아님');
  if (!near(at(-0.14, 0).steer, -0.5)) bad('좌측 14%에서 -0.5 아님');
  if (at(-2, 0).steer !== -1) bad('조향이 -1을 넘어감');
  return `데드존 ±${DEAD_Y} · 엑셀 전개 +${RANGE_Y} · 브레이크 전개 -${BRAKE_Y}`;
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
  return `엑셀 ${t1.toFixed(2)} 유지 · 속도 ${(st.speed * M.KMH).toFixed(0)} km/h`;
});

// ── 3. 커서 이탈 시 엑셀만 서서히 닫힘 ──
section('커서 이탈 — 엑셀만 감쇠', () => {
  const st = M.Logic.create(1);
  for (let i = 0; i < 180; i++) M.Logic.step(st, DT, mouse(1, 0.4));
  const before = st.throttle, steerBefore = st.steer;
  for (let i = 0; i < 60; i++) M.Logic.step(st, DT, { active: false });
  if (st.throttle >= before) bad('커서 이탈 후 엑셀이 안 닫힘');
  if (st.brake !== 0) bad('커서 이탈인데 브레이크가 남아 있음');
  if (st.steer !== steerBefore) bad('커서 이탈 시 조향이 흔들림');
  return `엑셀 ${before.toFixed(2)} → ${st.throttle.toFixed(2)} (조향 ${st.steer.toFixed(2)} 유지)`;
});

// ── 4. 뒤로 당긴 깊이에 비례한 브레이크 + 데드존 자연 감속 ──
section('브레이크 깊이 비례 · 데드존 관성 감속', () => {
  const run = (brake, coast = false) => {              // 4초 가속 후 1초 조작
    const st = M.Logic.create(1);
    for (let i = 0; i < 240; i++) M.Logic.step(st, DT, mouse(1, 0));
    const top = st.speed;
    for (let i = 0; i < 60; i++) M.Logic.step(st, DT, coast ? mouse(0, 0) : mouse(0, 0, brake));
    return { top, end: st.speed };
  };
  const deep = run(1), shallow = run(0.3), coast = run(0, true);
  if (coast.end >= coast.top) bad('데드존 관성 주행인데 자연 감속하지 않음');
  if (shallow.end >= coast.end) bad(`얕은 브레이크(${(shallow.end / 1000).toFixed(1)})가 관성(${(coast.end / 1000).toFixed(1)})보다 덜 감속`);
  if (deep.end >= shallow.end) bad(`깊은 브레이크(${(deep.end / 1000).toFixed(1)})가 얕은(${(shallow.end / 1000).toFixed(1)})보다 덜 감속`);
  const k = (v) => (v * M.KMH).toFixed(0);
  return `1초 감속 — 관성 ${k(coast.top)}→${k(coast.end)} · 얕게 →${k(shallow.end)} · 깊게 →${k(deep.end)} km/h`;
});

// ── 4b. 변속 — 오토 6단 · 스틱 수동 ──
section('변속 (오토 6단 자동 · 스틱 수동 시프트)', () => {
  const tops = M.Logic.GEAR_TOPS;
  // 조향 없는 검증이므로 직선·무교통으로 격리 (커브에 밀려 노면을 벗어나면 속도 상한이 걸림)
  const flat = (st) => { st.stage.segAt = () => ({ curve: 0 }); st.cars = []; return st; };
  // 오토: 풀 스로틀로 달리면 6단까지 자동으로 올라간다
  const a = flat(M.Logic.create(1));
  for (let i = 0; i < 60 * 14; i++) M.Logic.step(a, DT, mouse(1, 0));
  if (a.trans !== 'auto') bad('기본 변속이 오토가 아님');
  if (a.gear !== 6) bad(`오토 14초 풀 스로틀인데 ${a.gear}단`);
  if (!(a.rpm > 0 && a.rpm <= 1.15)) bad(`rpm 범위 이탈 ${a.rpm}`);
  // 스틱: 변속하지 않으면 1단 상한에 묶인다
  const s = flat(M.Logic.create(1, 'stick'));
  const inp = mouse(1, 0);
  for (let i = 0; i < 60 * 12; i++) M.Logic.step(s, DT, inp);
  if (s.gear !== 1) bad(`스틱인데 기어가 저절로 ${s.gear}단으로 바뀜`);
  if (s.speed > tops[0] * 1.02) bad(`1단 고정인데 상한(${(tops[0] * M.KMH).toFixed(0)}km/h)을 넘음`);
  // 시프트 업 → 입력 소비 → 다시 가속
  inp.shift = 1;
  M.Logic.step(s, DT, inp);
  if (s.gear !== 2) bad('시프트 업이 안 먹힘');
  if (inp.shift !== 0) bad('시프트 입력이 원샷으로 소비되지 않음');
  const v0 = s.speed;
  for (let i = 0; i < 60 * 3; i++) M.Logic.step(s, DT, inp);
  if (s.speed <= v0 * 1.15) bad(`2단으로 올려도 가속되지 않음 (${(v0 * M.KMH).toFixed(0)} → ${(s.speed * M.KMH).toFixed(0)})`);
  // 과속 상태로 다운시프트 → 오버레브 (rpm > 1)
  const o = flat(M.Logic.create(1, 'stick'));
  o.phase = 'run'; o.gear = 6; o.speed = M.MAX_SPEED * 0.8;
  const inp2 = mouse(1, 0);
  inp2.shift = -1; M.Logic.step(o, DT, inp2);      // 6 → 5단 (top5 = 0.81, 0.8이라 안전)
  inp2.shift = -1; M.Logic.step(o, DT, inp2);      // 5 → 4단 (top4 = 0.63 — 과속)
  if (o.gear !== 4) bad(`연속 다운시프트 실패 (${o.gear}단)`);
  if (o.rpm <= 1) bad(`과속 다운시프트인데 오버레브가 아님 (rpm ${o.rpm.toFixed(2)})`);
  const vOver = o.speed;
  for (let i = 0; i < 30; i++) M.Logic.step(o, DT, inp2);
  if (o.speed >= vOver) bad('오버레브인데 엔진 브레이크가 안 걸림');
  return `오토 14초 → 6단 ${(a.speed * M.KMH).toFixed(0)}km/h · 스틱 1단 상한 ${(tops[0] * M.KMH).toFixed(0)}km/h · 오버레브 감속 확인`;
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
  return `x=${st.playerX.toFixed(2)} · ${(onRoad * M.KMH).toFixed(0)} → ${(st.speed * M.KMH).toFixed(0)} km/h`;
});

// ── 5b. 충돌 판정 — 차폭·차선·터널링 ──
section('충돌 판정 (차폭 · 차선 · 고속 터널링)', () => {
  const { CAR_HALF, PLAYER_HALF, CAR_LEN } = M.Logic;
  const sep = CAR_HALF + PLAYER_HALF;
  const LANE = 2 / 3;                                    // 3차선이므로 차선 간격

  // 차폭이 차선을 넘지 않아야 옆 차선 차와 스쳐도 부딪히지 않는다
  if (sep >= LANE) bad(`차폭 합 ${sep.toFixed(2)}이 차선 간격 ${LANE.toFixed(2)} 이상 — 옆 차선도 충돌함`);

  // 한 대만 남기고 원하는 자리에 놓아 판정을 본다
  const place = (offset, z, speed) => {
    const st = M.Logic.create(1);
    st.phase = 'run';
    st.cars = [{ offset, z, speed: 0, type: 'sedan', hue: 0, lane: 0 }];
    st.speed = speed; st.playerX = 0; st.pos = 0;
    return st;
  };
  const hits = (st, dt) => M.Logic.step(st, dt, mouse(1, 0)).some((e) => e.type === 'hit');

  // 같은 차선 정면 → 충돌
  if (!hits(place(0, CAR_LEN * 0.5, 3000), 1 / 60)) bad('같은 차선 앞차와 충돌하지 않음');
  // 옆 차선(한 칸 옆) → 충돌 없음
  if (hits(place(LANE, CAR_LEN * 0.5, 3000), 1 / 60)) bad('옆 차선 차와 충돌함 — 차폭 과대');
  // 프레임 도약이 차 길이의 2배를 넘으면 앞차를 통째로 건너뛸 수 있다.
  // main.js가 dt를 1/30로 묶어 실주행에서는 396단위(< 520)라 관통이 나지 않지만,
  // logic은 임의 dt로 호출될 수 있으므로 스윕 판정이 이를 막는지 확인한다.
  const bigDt = 0.1;
  const jump = M.MAX_SPEED * bigDt;                      // 1200단위 — 차 길이(260)의 4배
  if (jump <= CAR_LEN * 2) bad('도약 폭이 작아 스윕 판정을 시험하지 못함');
  if (!hits(place(0, jump * 0.5, M.MAX_SPEED), bigDt)) bad(`한 프레임 ${jump.toFixed(0)}단위 도약에서 앞차를 통과해 버림`);
  // 실주행 상한(1/30)에서는 애초에 관통 폭에 못 미쳐야 한다
  const realJump = M.MAX_SPEED / 30;
  if (realJump > CAR_LEN * 2) bad(`실주행 프레임 도약 ${realJump.toFixed(0)}단위가 관통 임계(${CAR_LEN * 2})를 넘음`);
  return `차폭 합 ${sep.toFixed(2)} < 차선 ${LANE.toFixed(2)} · 실주행 도약 ${realJump.toFixed(0)} < 임계 ${CAR_LEN * 2} · 도약 ${jump}단위도 스윕이 감지`;
});

// ── 5c. 교통 차량 차선 준수 ──
section('교통 차량 차선 준수', () => {
  const st = M.Logic.create(7);
  const before = st.cars.map((c) => c.offset);
  for (let i = 0; i < 60 * 30; i++) M.Logic.step(st, DT, mouse(0.5, 0));   // 30초 주행
  const drifted = st.cars.filter((c, i) => Math.abs(c.offset - before[i]) > 1e-9).length;
  if (drifted) bad(`주행 중 차선을 벗어난 차량 ${drifted}대`);
  const lane = 2 / 3;
  if (M.Logic.CAR_HALF * 2 >= lane) bad(`차폭 ${(M.Logic.CAR_HALF * 2).toFixed(2)}이 차선 폭 ${lane.toFixed(2)} 이상`);
  return `30초 주행 후 전 차량(${st.cars.length}대) 차선 유지 · 차폭 ${(M.Logic.CAR_HALF * 2).toFixed(2)} < 차선 ${lane.toFixed(2)}`;
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
