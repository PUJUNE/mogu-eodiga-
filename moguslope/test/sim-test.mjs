// sim-test.mjs — 로직 단독 검증: 단면 · 중심선 · 조향 · 벽 · 원심력 · 점프 · 도약대 · 공중 회전 · 부딪힘 · 생선 · 부스트 · 결승 · 끝없는 모드 · 봇 완주
// 사용: node moguslope/test/sim-test.mjs
import { ride } from './ride.mjs';

const M = window.MSL, Run = M.Run, P = M.Prof, PH = M.PHYS;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const DT = 1 / 60;
// 빈 코스: 장애물·생선 없이 물리만 본다
function bare(course = 0, diff = 'normal') { const r = Run.create(diff, course); r.obst = []; r.coins = []; r.ramps = []; r.pads = []; r.v = 18; return r; }
const steps = (r, n, inp = {}) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...Run.step(r, DT, typeof inp === 'function' ? inp(i) : inp)); return ev; };

// ══ 1. 단면 · 중심선 ══
{
  const c = M.ZONES.canal.prof, t = M.ZONES.tube.prof;
  check('수로 단면: 가운데는 평평, 벽은 올라간다', P.h(c, 0) === 0 && P.h(c, 2) === 0 && P.h(c, 4.5) > 1 && P.h(c, -4.5) === P.h(c, 4.5));
  check('터널은 수로보다 벽이 높다', P.rim(t) > P.rim(c), `${P.rim(t).toFixed(2)} > ${P.rim(c).toFixed(2)}`);
  check('오른쪽 벽 기울기는 +, 왼쪽은 −', P.bank(c, 4) > 0 && P.bank(c, -4) < 0 && P.bank(c, 0) === 0);
  const r = Run.create('normal', 0);
  check('코스 길이 1100m + 결승 뒤 감속 구간', r.L === 1100 && r.track.len > 1200);
  check('내리막: 결승선이 출발보다 낮다', r.track.Y[1100] < r.track.Y[0] - 100, `${r.track.Y[1100].toFixed(0)} m`);
  const r2 = Run.create('normal', 0);
  check('같은 코스·난이도는 같은 배치 (외워서 잘 탈 수 있다)', r2.obst.length === r.obst.length && r2.coins.every((c, i) => c.s === r.coins[i].s));
  const big = Run.create('normal', 4);
  check('모구 대활강 = 네 구역', big.zones.map((z) => z.zone).join() === 'canal,tube,field,snow');
  check('구역이 바뀌면 단면이 25m에 걸쳐 바뀐다', (() => { const s = big.zones[1].s0; const a = P.half(big.track.frame(s + 2).prof), b = P.half(big.track.frame(s + 30).prof); return a > b && Math.abs(b - P.half(M.ZONES.tube.prof)) < 0.01; })());
}

// ══ 2. 조향 · 벽 · 원심력 ══
{
  const r = bare();
  steps(r, 40, { steer: 1 });
  check('오른쪽 조향 → 오른쪽으로', r.u > 1, r.u.toFixed(2));
  const r2 = bare(); r2.u = 4.2; r2.uv = 0;
  // 곧은 곳에서 벽에 올려 두면 미끄러져 내려온다
  while (Math.abs(r2.track.K[Math.round(r2.s)]) > 0.001) r2.s += 5;
  steps(r2, 60);
  check('벽 위에서 손을 놓으면 가운데로 미끄러진다', r2.u < 3, r2.u.toFixed(2));
  const r3 = bare(); let s = 10; while (r3.track.K[s] < 0.015) s++;
  r3.s = s; r3.u = 0; r3.v = 22;
  steps(r3, 90);
  check('오른쪽으로 굽은 길 → 바깥(왼쪽) 벽으로 밀린다', r3.u < -0.5, r3.u.toFixed(2));
  const r4 = bare(); r4.u = 0; steps(r4, 200, { steer: 1 });
  check('벽 끝을 넘지 않는다', r4.u <= P.half(r4.track.frame(r4.s).prof) - 0.29);
}

// ══ 3. 점프 · 도약대 · 공중 회전 ══
{
  const r = bare(); steps(r, 1, { jump: true });
  check('점프 → 공중', r.air && r.vz > 5);
  steps(r, 120);
  check('점프 뒤 착지', !r.air && r.z === 0);
  const r2 = bare(); r2.ramps = [{ s: r2.s + 5, len: 6, u: 0, w: 3.4, h: 1.3 }];
  const ev = steps(r2, 40);
  check('도약대 끝 → 높이 뜬다', ev.some((e) => e.type === 'ramp') && r2.air && r2.vz > 5);
  const r3 = bare(); r3.ramps = [{ s: r3.s + 5, len: 6, u: 0, w: 3.4, h: 1.3 }];
  // 한 바퀴(2π)를 돌 만큼만 오른쪽 키
  let spun = false;
  const ev3 = steps(r3, 200, () => { const go = r3.air && Math.abs(r3.spin) < Math.PI * 2 - 0.08; return { steer: go ? 1 : 0 }; });
  check('공중에서 한 바퀴 돌고 착지 → 360° 묘기 · 점수', ev3.some((e) => e.type === 'trick' && e.n === 1) && r3.trickScore === M.SCORE.trick[1]);
  check('묘기 착지 → 부스트', ev3.some((e) => e.type === 'trick') && r3.boostT > 0 || r3.tricks === 1);
  const r4 = bare(); r4.ramps = [{ s: r4.s + 5, len: 6, u: 0, w: 3.4, h: 1.3 }];
  const ev4 = steps(r4, 200, () => ({ steer: r4.air && Math.abs(r4.spin) < Math.PI ? 1 : 0 }));
  check('반 바퀴만 돌고 내리면 꽈당 (하트 −1)', ev4.some((e) => e.type === 'wipeout') && r4.hearts === r4.maxHearts - 1);
}

// ══ 4. 부딪힘 · 생선 · 부스트 · 하트 ══
{
  const r = bare(); r.obst = [{ kind: 'rock', s: r.s + 6, u: 0, ru: 0.7, rs: 0.6, h: 1.1, low: false, hit: false }];
  const v0 = r.v, ev = steps(r, 40);
  check('바위에 부딪히면 하트 −1 · 느려짐', ev.some((e) => e.type === 'crash') && r.hearts === r.maxHearts - 1 && r.v < v0 * 0.6);
  const r2 = bare(); r2.obst = [{ kind: 'rock', s: r2.s + 6, u: 0, ru: 0.7, rs: 0.6, h: 1.1, low: false, hit: false }]; r2.u = 2;
  check('옆으로 비켜 가면 안 부딪힘', !steps(r2, 40).some((e) => e.type === 'crash'));
  const r3 = bare(); r3.obst = [{ kind: 'log', s: r3.s + 9, u: 0, ru: 0, rs: 0.4, h: 0.7, low: true, hit: false }];
  const ev3 = steps(r3, 60, (i) => ({ jump: i === 12 }));
  check('통나무는 점프로 넘는다', !ev3.some((e) => e.type === 'crash'));
  const r4 = bare(); r4.obst = [{ kind: 'log', s: r4.s + 9, u: 0, ru: 0, rs: 0.4, h: 0.7, low: true, hit: false }];
  check('통나무는 비켜 갈 수 없다 (너비 전체)', (r4.u = 3.5, steps(r4, 60).some((e) => e.type === 'crash')));
  const r5 = bare(); r5.hearts = 1; r5.obst = [{ kind: 'rock', s: r5.s + 6, u: 0, ru: 0.7, rs: 0.6, h: 1.1, low: false, hit: false }];
  steps(r5, 200);
  check('하트가 다 떨어지면 끝', r5.phase === 'done' && Run.stars(r5) === 0);
  const r6 = bare(); r6.coins = [{ s: r6.s + 4, u: 0, z: 0.6, kind: 'fish', taken: false }, { s: r6.s + 8, u: 0, z: 0.6, kind: 'heart', taken: false }]; r6.hearts = 1;
  steps(r6, 40);
  check('생선 · 하트 줍기', r6.fish === 1 && r6.hearts === 2);
  const r7 = bare(); r7.pads = [{ s: r7.s + 4, u: 0, used: false }];
  steps(r7, 30);
  check('부스트 발판 → 빨라진다', r7.boostT > 0 && r7.v > M.DIFFS.normal.vcap);
  const r8 = bare(); r8.obst = [{ kind: 'tractor', s: r8.s + 10, u: 0, ru: 1.3, rs: 1.6, h: 2.2, low: false, hit: false, mv: { amp: 4, w: 2, ph: 0 } }];
  check('트랙터는 좌우로 움직인다', Run.moverU(r8.obst[0], 0) !== Run.moverU(r8.obst[0], 0.7));
}

// ══ 출발 로프 ══
{
  check('로프 게이지: 0 → 100% → 0 을 오간다', Run.chargePower(0) === 0 && Math.abs(Run.chargePower(PH.launch.period / 2) - 1) < 1e-9 && Run.chargePower(PH.launch.period) < 0.01);
  const a = Run.create('normal', 0), b = Run.create('normal', 0);
  const ea = Run.launch(a, 0.3), eb = Run.launch(b, 1);
  check('세게 당길수록 빠르게 튕겨 나간다', b.v > a.v * 1.5, `${a.v.toFixed(1)} → ${b.v.toFixed(1)} m/s`);
  check('93% 이상 = 완벽한 출발 · 부스트', eb[0].perfect && b.boostT > 0 && !ea[0].perfect && a.boostT <= 0);
}

// ══ 5. 결승 · 별 · 끝없는 모드 ══
{
  const r = bare(); r.s = r.L - 5;
  const ev = steps(r, 150);
  check('결승선 → 감속 뒤 끝 · 완주 보너스', ev.some((e) => e.type === 'finish') && r.phase === 'done' && r.bonus >= M.SCORE.finish);
  r.fishTotal = 10; r.fish = 7; r.crashes = 0;
  check('★3 = 완주 + 생선 70% + 무사고', Run.stars(r) === 3);
  r.crashes = 1; r.fish = 3;
  check('★1 = 완주만', Run.stars(r) === 1);
  const e = Run.create('normal', 'endless', 5);
  e.s = 2000; Run.step(e, DT, {});
  check('끝없는 모드: 앞쪽이 계속 늘어난다', e.track.len > 2300 && e.zones.length >= 5);
  check('끝없는 모드: 바퀴가 돌수록 빨라진다', e.vmul > 1 && e.lap >= 1);
}

// ══ 6. 봇이 모든 코스·난이도를 탄다 ══
let allFin = true, line = [];
for (const d of M.DIFF_ORDER) {
  let fin = 0, stars = 0;
  for (let c = 0; c < M.COURSES.length; c++) {
    const { run } = ride(d, c, 1);
    if (run.s >= run.L) fin++; stars += Run.stars(run);
  }
  line.push(`${M.DIFFS[d].name} 완주 ${fin}/5 ★${stars}`);
  if (d !== 'crazy' && fin < 5) allFin = false;
}
console.log('  봇 주행:', line.join(' · '));
check('이지·노말·하드: 잘 타는 봇은 다섯 코스 모두 완주', allFin);
const e1 = ride('easy', 0, 0.5);
check('이지 1코스는 서툰 봇도 ★2 이상', Run.stars(e1.run) >= 2, `★${Run.stars(e1.run)}`);
const en = ride('normal', 'endless', 1, 9, 120);
check('끝없는 모드 2분 주행 — 멈춤 없음', en.run.s > 1500, `${Math.floor(en.run.s)} m · 하트 ${en.run.hearts}`);

console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
