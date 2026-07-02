// sim-test.mjs — 홀드-릴리즈 봇 전수 주행 + 코어 규칙 검증 (node 단독)
import { runBot, runPerfect, runNone, runSloppy, runHold } from './shim.mjs';

const M = globalThis.window.MSJ;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;

// 1) 50판 전수: 퍼펙트=★3, 무기술·계속홀드=실패, 거리 순서
let all3 = true, allFail = true, allOrder = true, worst = null;
for (let no = 1; no <= 50; no++) {
  const p = runPerfect(no), n = runNone(no), h = runHold(no);
  const T = M.makeStage(no).target;
  if (p.dist < T * 1.14) { all3 = false; worst = `S${no} perfect ${p.dist} < ${T * 1.14}`; }
  if (n.dist >= T || h.dist >= T) { allFail = false; worst = `S${no} 무기술 클리어`; }
  if (!(p.dist > n.dist)) allOrder = false;
}
check('50판 전수: 퍼펙트 릴리즈 ★3 라인 도달' + (worst ? ` (${worst})` : ''), all3);
check('50판 전수: 일찍 떼기·계속 홀드 = 클리어 실패', allFail);
check('50판 전수: 퍼펙트 > 무기술 거리 순서', allOrder);

// 2) 릴리즈 타이밍 차등: 정확 > 0.15초 이름 > 아주 이름
{
  const pd = runPerfect(5).dist, sd = runSloppy(5).dist, nd = runNone(5).dist;
  check(`릴리즈 타이밍 차등 (정확 ${pd} > 조금이름 ${sd} > 바로뗌 ${nd})`, pd > sd && sd > nd);
}

// 3) 늦은 릴리즈: 립 직후 뗌 = 부분 인정 (계속홀드보다 김, 퍼펙트보다 짧음)
{
  let crossed = -1;
  const late = runBot(8, (st) => {
    if (st.phase === 'flight' && crossed < 0) crossed = st.ft;
    return st.phase === 'flight' && st.ft > 0.08;
  });
  const pd = runPerfect(8).dist, hd = runHold(8).dist;
  check(`늦은 릴리즈 부분 인정 (${hd} < ${late.dist} < ${pd})`, late.dist > hd && late.dist < pd);
}

// 4) 차지(웅크림) 부족 페널티: 립 0.5초 전에야 누른 경우
{
  const st = L.create(5);
  let pressed = false, released = false, guard = 0;
  while (st.phase !== 'landed' && guard++ < 15000) {
    let btn = false;
    if (st.phase === 'ready') btn = true;                       // 출발
    else if (st.phase === 'slide') {
      if (!pressed && st.untilLip <= 0.5) pressed = true;       // 늦게 누름
      if (pressed && !released && st.untilLip <= DT) { released = true; }
      btn = pressed && !released;
    }
    L.step(st, DT, { btn });
  }
  // 주의: ready에서 btn=true 후 슬라이드 내내 뗀 상태 → releaseAt이 크게 잡힘.
  const full = runPerfect(5);
  check(`차지 부족 시 거리 감소 (${st.dist} < ${full.dist})`, st.dist < full.dist);
}

// 5) 바람: 맞바람 > 뒷바람 (동일 스테이지, 바람 치환)
{
  const windRun = (w) => {
    const st = L.create(25);
    st.stage.wind = w;
    let released = false, guard = 0;
    while (st.phase !== 'landed' && guard++ < 15000) {
      if (!released && st.phase === 'slide' && st.untilLip <= DT) released = true;
      L.step(st, DT, { btn: !released });
    }
    return st.dist;
  };
  const head = windRun(3), tail = windRun(-3);
  check(`바람 효과 (맞바람 ${head} > 뒷바람 ${tail})`, head > tail + 2);
}

// 6) 크래시: 타이밍 미스(q<0.15) 착지 = 데굴데굴 + 별 제한
{
  const n = runNone(3);
  check(`타이밍 미스 착지 = 크래시 (q=${n.q.toFixed(2)})`, n.crash === true && n.stars <= 1);
  const p = runPerfect(3);
  check('퍼펙트 착지 = 크래시 아님', p.crash === false);
}

// 7) 별점 경계
{
  const p = runPerfect(1), T = M.makeStage(1).target;
  check(`S1 퍼펙트 별점 3 (${p.dist}m / 목표 ${T}m)`, p.stars === 3);
  check(`S1 무기술 별점 0 (${runNone(1).dist}m)`, runNone(1).stars === 0);
}

// 8) 결정성
{
  const a = M.makeStage(17), b = M.makeStage(17);
  check('스테이지 생성 결정성', a.wind === b.wind && a.K === b.K && a.hillY(30) === b.hillY(30));
  const p1 = runPerfect(17).dist, p2 = runPerfect(17).dist;
  check('주행 결정성 (동일 정책 동일 거리)', p1 === p2);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
