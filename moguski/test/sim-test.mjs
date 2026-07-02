// sim-test.mjs — 헤드리스 봇 전수 주행 + 코어 규칙 검증 (node 단독)
import { runPerfect, runNone, runSloppy } from './shim.mjs';

const M = globalThis.window.MSJ;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;

// 1) 50판 전수: 퍼펙트=★3 도달, 무입력=클리어 실패, 퍼펙트>무입력
let all3 = true, allFail = true, allOrder = true, worst = null;
for (let no = 1; no <= 50; no++) {
  const p = runPerfect(no), n = runNone(no);
  const T = M.makeStage(no).target;
  if (p.dist < T * 1.14) { all3 = false; worst = `S${no} perfect ${p.dist} < ★3 ${T * 1.14}`; }
  if (n.dist >= T) { allFail = false; worst = `S${no} none ${n.dist} ≥ target ${T}`; }
  if (p.dist <= n.dist) allOrder = false;
}
check('50판 전수: 퍼펙트 봇 ★3 라인 도달' + (worst ? ` (${worst})` : ''), all3);
check('50판 전수: 무입력 봇 클리어 실패 (눌러야 깨짐)', allFail);
check('50판 전수: 퍼펙트 > 무입력 거리 순서', allOrder);

// 2) 별점 경계
{
  const p = runPerfect(1);
  const T = M.makeStage(1).target;
  check(`S1 퍼펙트 별점 3 (${p.dist}m / 목표 ${T}m)`, p.stars === 3);
  const n = runNone(1);
  check(`S1 무입력 별점 0 (${n.dist}m)`, n.stars === 0);
}

// 3) 타이밍 품질: 정확 탭 > 0.15초 이른 탭 > 무탭
{
  const pd = runPerfect(5).dist, sd = runSloppy(5).dist, nd = runNone(5).dist;
  check(`도약 타이밍 차등 (정확 ${pd} > 어중간 ${sd} > 무탭 ${nd})`, pd > sd && sd > nd);
}

// 4) 자세 존 유지가 거리를 늘림 (같은 탭, 홀드 정책만 차이)
{
  const runHold = (no, hold) => {
    const st = L.create(no);
    L.step(st, DT, { btn: false, tap: true });
    let g = 0;
    while (st.phase !== 'landed' && g++ < 12000) {
      let tap = st.phase === 'slide' && st.untilLip <= DT;
      const btn = hold ? st.P < 0.62 : false;
      L.step(st, DT, { btn, tap });
    }
    return st.dist;
  };
  const withPose = runHold(20, true), noPose = runHold(20, false);
  check(`자세 유지 효과 (존 유지 ${withPose} > 방치 ${noPose})`, withPose > noPose + 5);
}

// 5) 바람: 맞바람이 뒷바람보다 멀리 남 (동일 스테이지, 바람만 치환)
{
  const windRun = (w) => {
    const st = L.create(25);
    st.stage.wind = w;
    L.step(st, DT, { btn: false, tap: true });
    let g = 0;
    while (st.phase !== 'landed' && g++ < 12000) {
      const tap = st.phase === 'slide' && st.untilLip <= DT;
      L.step(st, DT, { btn: st.phase === 'flight' && st.P < 0.62, tap });
    }
    return st.dist;
  };
  const head = windRun(3), tail = windRun(-3);
  check(`바람 효과 (맞바람 ${head} > 뒷바람 ${tail})`, head > tail + 2);
}

// 6) 텔레마크 보너스: 착지 탭 있는 쪽이 김 + 이벤트 발생
{
  const teleRun = (doTele) => {
    const st = L.create(10);
    L.step(st, DT, { btn: false, tap: true });
    let g = 0, evs = [];
    while (st.phase !== 'landed' && g++ < 12000) {
      let tap = st.phase === 'slide' && st.untilLip <= DT;
      if (doTele && st.phase === 'flight' && st.teleOpen && !st.teleTapped && (st.y - st.stage.hillY(st.x)) < 1.6) tap = true;
      evs.push(...L.step(st, DT, { btn: st.phase === 'flight' && st.P < 0.62, tap }));
    }
    return { d: st.dist, evs };
  };
  const a = teleRun(true), b = teleRun(false);
  check(`텔레마크 보너스 (${a.d} > ${b.d})`, a.d > b.d && a.evs.some((e) => e.type === 'telemark'));
}

// 7) 크래시: 자세 방치(P→0) 착지 → crash + 별 제한
{
  const n = runNone(3);
  check(`자세 붕괴 착지 = 크래시 (P=${n.P.toFixed(2)})`, n.crash === true);
}

// 8) 결정성: 같은 스테이지 두 번 생성 동일
{
  const a = M.makeStage(17), b = M.makeStage(17);
  check('스테이지 생성 결정성 (바람·프로파일)', a.wind === b.wind && a.K === b.K && a.hillY(30) === b.hillY(30));
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
