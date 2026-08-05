// sim-test.mjs — 헤드리스 시뮬레이션: 낙하·회피·피격·클리어 + 회피 봇 난이도 곡선 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDD;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 60;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};

// 1) 초기 상태
{
  const st = L.create(1, 'normal');
  check('시작 상태 (플레이 / 중앙 / 웨이브 1)',
    st.phase === 'play' && Math.abs(st.p.x - M.W / 2) < 1 && st.waveNo === 1 && st.poops.length === 0);
  run(st, 3);
  check(`3초 후 똥이 떨어지는 중 (${st.poops.length}개)`, st.poops.length > 0 && st.spawned >= 3);
}

// 2) 낙하 → 착지 = 회피 카운트
{
  const st = L.create(2, 'normal');
  st.p.x = 20;                                    // 낙하 지점에서 비켜서기
  st.poops = [{ id: 99, kind: 'mid', r: 10, bx: 300, x: 300, y: 100, vy: 300, wob: 0, sw: 0, spin: 0, rot: 0 }];
  st.wave.rate = 0;                               // 추가 생성 정지
  const evs = run(st, 2);
  check('바닥 착지 → land 이벤트 + 회피 수 증가',
    evs.some((e) => e.type === 'land') && st.dodged >= 1 && !st.poops.some((q) => q.id === 99));
}

// 3) 피격 = 즉사 (원작: 한 번 맞으면 끝)
{
  const st = L.create(3, 'normal');
  st.wave.rate = 0;
  st.p.x = 180;
  st.poops = [{ id: 1, kind: 'mid', r: 10, bx: 180, x: 180, y: M.GROUND - 120, vy: 320, wob: 0, sw: 0, spin: 0, rot: 0 }];
  const evs = run(st, 1.2);
  check('머리 위 똥 → 피격 → 게임오버',
    evs.some((e) => e.type === 'hit') && evs.some((e) => e.type === 'over') && st.phase === 'over');
  check('피격 후 시간 정지 (기록 확정)', st.t < 1.2);
  const t0 = st.t;
  run(st, 1.0);
  check('쓰러지는 동안 생존 시간 증가 없음', st.t === t0);
  check('연출 종료 판정', L.deathDone(st));
}

// 4) 옆으로 스쳐 지나가면 안 맞는다
{
  const st = L.create(4, 'normal');
  st.wave.rate = 0;
  st.p.x = 180;
  const gap = M.PW + 10 + 6;
  st.poops = [{ id: 1, kind: 'mid', r: 10, bx: 180 + gap, x: 180 + gap, y: 100, vy: 320, wob: 0, sw: 0, spin: 0, rot: 0 }];
  run(st, 2);
  check(`히트박스 옆 ${gap}px 통과 = 무사`, st.phase === 'play' && st.dodged === 1);
}

// 5) 좌우 이동 + 화면 경계 클램프
{
  const st = L.create(5, 'normal');
  st.wave.rate = 0;
  const x0 = st.p.x;
  run(st, 0.5, { right: true });
  check(`→ 이동 (x ${x0.toFixed(0)} → ${st.p.x.toFixed(0)})`, st.p.x > x0 + 80);
  run(st, 5, { right: true });
  check('오른쪽 경계 클램프', st.p.x <= M.W - M.PW - 2 + 0.01 && st.p.x > M.W - M.PW - 10);
  run(st, 8, { left: true });
  check('왼쪽 경계 클램프', st.p.x >= M.PW + 2 - 0.01 && st.p.x < M.PW + 10);
  const xn = st.p.x;
  run(st, 0.5, { left: true, right: true });
  check('좌우 동시 입력 = 정지', Math.abs(st.p.x - xn) < 0.01);
}

// 6) 터치 드래그(targetX) 추종
{
  const st = L.create(6, 'normal');
  st.wave.rate = 0;
  run(st, 1.2, { targetX: 40 });
  check(`드래그 목표 추종 (x=${st.p.x.toFixed(0)})`, Math.abs(st.p.x - 40) < 6);
}

// 7) 웨이브·테마 전환
{
  const st = L.create(7, 'normal');
  st.wave.rate = 0;
  const evs = [];
  for (let i = 0; i < 61 * 60; i++) {
    evs.push(...L.step(st, DT, IDLE));
    st.wave.rate = 0;                             // 생성 없이 시간만 흐르게
  }
  const waves = evs.filter((e) => e.type === 'wave').map((e) => e.no);
  check(`30·60초 웨이브 상승 (${waves.join(',')})`, waves[0] === 2 && waves[1] === 3);
  check('60초에 테마 전환', evs.some((e) => e.type === 'theme' && e.idx === 1));
}

// 8) 5분 생존 = CLEAR
{
  const st = L.create(8, 'normal');
  st.wave.rate = 0;
  st.t = M.CLEAR_TIME - 0.5;
  const evs = run(st, 1);
  check('5:00 생존 → CLEAR', evs.some((e) => e.type === 'clear') && st.phase === 'clear');
}

// 9) 결정성
{
  const a = L.create(42, 'normal'), b = L.create(42, 'normal');
  run(a, 20); run(b, 20);
  check('시뮬 결정성 (동일 시드 동일 상태)',
    a.spawned === b.spawned && a.dodged === b.dodged &&
    JSON.stringify(a.poops.map((q) => [q.id, +q.x.toFixed(4), +q.y.toFixed(4)])) ===
    JSON.stringify(b.poops.map((q) => [q.id, +q.x.toFixed(4), +q.y.toFixed(4)])));
}

// 10) 회피 봇 — 난이도 곡선이 실제로 체감되는지 (봇이 easy에서 가장 오래 산다)
// 후보 위치마다 (a) 거기까지 걸어가는 경로가 안전한지 (b) 도착 후 얼마나 여유로운지를 본다.
const CANDS = [];
for (let x = M.PW + 2; x <= M.W - M.PW - 2; x += 12) CANDS.push(x);

function pathSafe(st, x) {
  const dir = Math.sign(x - st.p.x);
  const travelT = Math.abs(x - st.p.x) / M.PSPD;
  for (const q of st.poops) {
    const tIn = (M.GROUND - M.PH - q.y) / q.vy;        // 모구 키 높이에 진입
    const tOut = (M.GROUND + q.r - q.y) / q.vy;        // 완전히 통과
    if (tOut < 0 || tIn > 1.8) continue;
    const a = Math.max(0, tIn), b = Math.min(tOut, 1.8);
    for (let s = a; s <= b + 1e-6; s += 0.04) {
      const px = st.p.x + dir * Math.min(travelT, s) * M.PSPD;
      if (Math.abs(q.x - px) < q.r + M.PW + 1.5) return false;
    }
  }
  return true;
}

function scoreAt(st, x) {
  const moveT = Math.abs(x - st.p.x) / M.PSPD;
  let danger = 999;
  for (const q of st.poops) {
    const tIn = (M.GROUND - M.PH - q.y) / q.vy;
    const tOut = (M.GROUND + q.r - q.y) / q.vy;
    if (tOut < 0 || tIn > 2.6) continue;
    danger = Math.min(danger, Math.abs(q.x - x) - q.r - M.PW + Math.max(0, tIn) * 50);
  }
  return danger - moveT * 12 - (x < 30 || x > M.W - 30 ? 18 : 0);
}

function botTarget(st) {
  let best = st.p.x, bestScore = -Infinity, safeBest = null, safeScore = -Infinity;
  for (const x of CANDS) {
    const score = scoreAt(st, x);
    if (score > bestScore) { bestScore = score; best = x; }
    if (score > safeScore && pathSafe(st, x)) { safeScore = score; safeBest = x; }
  }
  const pick = safeBest != null ? safeBest : best;
  // 히스테리시스 — 기존 목표가 여전히 안전하면 웬만해선 유지 (좌우 갈팡질팡 방지)
  if (st._bt != null && pathSafe(st, st._bt) &&
      scoreAt(st, st._bt) + 22 > (safeBest != null ? safeScore : bestScore)) return st._bt;
  st._bt = pick;
  return pick;
}

function botRun(diff, seed) {
  const st = L.create(seed, diff);
  for (let i = 0; i < M.CLEAR_TIME / DT; i++) {
    L.step(st, DT, { targetX: botTarget(st) });
    if (st.phase !== 'play') break;
  }
  return st;
}

// 봇은 1스텝 그리디라 사람보다 약하다 — 절대 수치가 아니라 난이도 간 상대 비교용
const TRIALS = 14;
const survive = {};
for (const d of M.DIFF_ORDER) {
  let sum = 0, cleared = 0, dodged = 0;
  for (let s = 0; s < TRIALS; s++) {
    const st = botRun(d, 1000 + s * 977);
    sum += st.phase === 'clear' ? M.CLEAR_TIME : st.t;
    dodged += st.dodged;
    if (st.phase === 'clear') cleared++;
  }
  survive[d] = sum / TRIALS;
  console.log(`  🤖 ${M.DIFFS[d].name.padEnd(5)} 평균 생존 ${survive[d].toFixed(1)}초 · 평균 회피 ${Math.round(dodged / TRIALS)}개 · 클리어 ${cleared}/${TRIALS}`);
}
check(`봇 난이도 곡선 (이지 ${survive.easy.toFixed(0)}s ≥ 노말 ${survive.normal.toFixed(0)}s ≥ 크레이지 ${survive.crazy.toFixed(0)}s)`,
  survive.easy >= survive.normal && survive.normal >= survive.crazy);
check(`이지가 크레이지보다 두 배 이상 오래 버틴다`, survive.easy > survive.crazy * 2);
check('크레이지: 봇으로는 5분 완주 불가', survive.crazy < M.CLEAR_TIME);

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
