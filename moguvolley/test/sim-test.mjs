// sim-test.mjs — 헤드리스 시뮬레이션: 배구 물리·득점·AI 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MGV;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};

// 1) 서브 → 랠리 전환, 공 자유 낙하
{
  const st = L.create(1);
  const evs = run(st, 1.2);
  check('서브 대기 → 랠리 시작', evs.some((e) => e.type === 'serve') && st.phase !== 'serve');
  const y0 = st.ball.y;
  run(st, 0.3);
  check('공 중력 낙하', st.ball.y > y0);
}

// 2) 점프
{
  const st = L.create(1);
  run(st, 1.0);
  L.step(st, DT, { jump: true });
  let peak = M.GROUND;
  for (let i = 0; i < 200; i++) { L.step(st, DT, IDLE); peak = Math.min(peak, st.p.y); }
  check(`점프 정점 ${(M.GROUND - peak).toFixed(0)}px`, M.GROUND - peak > 60);
}

// 3) 범프 → 공이 위로 + 오른쪽(상대 코트 방향)
{
  const st = L.create(1);
  run(st, 1.0);
  st.ball = { x: st.p.x + 10, y: M.GROUND - 40, vx: 0, vy: 100 };
  const evs = L.step(st, DT, { hit: true });
  check('지상 히트 = 범프 (위로 상승)', evs.some((e) => e.type === 'bump') && st.ball.vy < -300 && st.ball.vx > 0);
}

// 4) 벽·네트 반사
{
  const st = L.create(1);
  run(st, 1.0);
  st.ball = { x: 20, y: 100, vx: -300, vy: 0 };
  const evs = run(st, 0.3);
  check('왼쪽 벽 반사', evs.some((e) => e.type === 'wall') && st.ball.vx > 0);
  st.ball = { x: M.NET_X - 30, y: 240, vx: 260, vy: -30 };
  const evs2 = run(st, 0.3);
  check('네트 측면 반사 (넘어가지 못함)', evs2.some((e) => e.type === 'net') && st.ball.x < M.NET_X);
}

// 5) 스매시가 네트를 넘어 상대 코트에 떨어짐 → 플레이어 득점
{
  const st = L.create(1);
  run(st, 1.0);
  // 공중에서 네트 위 높이의 공을 스매시 (히트 반경 안에 배치)
  st.p.x = 200; st.p.y = M.GROUND - 100; st.p.onGround = false; st.p.vy = 0;
  st.ball = { x: 214, y: 140, vx: 0, vy: 0 };
  st.a.x = 460;                                  // AI를 구석으로 (수비 못 하게)
  st.aiTargetX = 460; st.aiReactT = 99;
  const evs = [];
  evs.push(...L.step(st, DT, { hit: true }));
  check('공중 히트 = 스매시', evs.some((e) => e.type === 'smash'));
  let g = 0;
  while (st.phase === 'rally' && g++ < 2000) evs.push(...L.step(st, DT, IDLE));
  const sc = evs.find((e) => e.type === 'score');
  check('스매시 → 상대 코트 바닥 → 플레이어 득점', sc && sc.scorer === 0 && st.score[0] === 1);
}

// 6) 우리 코트 바닥 → AI 득점 + 서브 리셋
{
  const st = L.create(1);
  run(st, 1.0);
  st.ball = { x: 100, y: 200, vx: 0, vy: 300 };
  st.p.x = 30;                                   // 못 받게 치움
  const evs = run(st, 0.6);
  const sc = evs.find((e) => e.type === 'score');
  check('우리 바닥 → AI 득점', sc && sc.scorer === 1 && st.score[1] === 1);
  check('득점 후 서브 리셋 (위치 초기화)', st.phase === 'serve' && Math.abs(st.p.x - 90) < 1);
}

// 7) 5점 선취 승리 + 별점 (셧아웃 ★3)
{
  const st = L.create(1);
  st.score = [4, 0];
  run(st, 1.0);
  st.ball = { x: 400, y: 200, vx: 0, vy: 300 };
  st.a.x = M.NET_X + 30; st.aiTargetX = M.NET_X + 30; st.aiReactT = 99;
  let g = 0; const evs = [];
  while (st.phase !== 'win' && g++ < 3000) evs.push(...L.step(st, DT, IDLE));
  check('5점 → 승리', st.phase === 'win' && evs.some((e) => e.type === 'win'));
  check('셧아웃 별점 3', st.stars === 3);
}

// 8) AI가 공을 향해 이동
{
  const st = L.create(15);
  run(st, 1.0);
  st.ball = { x: 300, y: 80, vx: 60, vy: -50 };  // AI 코트로 향하는 공
  const x0 = st.a.x;
  run(st, 0.8);
  check('AI가 낙하점으로 이동', Math.abs(st.a.x - x0) > 10);
}

// 9) AI 강도: 같은 공격에 대해 S30이 S1보다 실점(자기 코트 낙하)을 덜 함
{
  const concede = (no) => {
    let conceded = 0;
    for (let trial = 0; trial < 12; trial++) {
      const st = L.create(no);
      run(st, 1.0);
      st.ball = { x: 255, y: 60, vx: 10 + trial * 8, vy: 40 };    // 네트 앞 짧은 낙하 (홈 위치에서 멀어 몸통 구제 불가)
      let g = 0;
      while (st.phase === 'rally' && st.score[0] === 0 && st.score[1] === 0 && g++ < 420) L.step(st, DT, IDLE);
      if (st.score[0] > 0) conceded++;           // AI 코트 바닥에 떨어짐 = 수비 실패
    }
    return conceded;
  };
  const weak = concede(1), strong = concede(30);
  check(`AI 강도 차등 (S1 실점 ${weak}/12 > S30 실점 ${strong}/12)`, weak > strong);
}

// 10) 결정성
{
  const a = L.create(7), b = L.create(7);
  run(a, 3); run(b, 3);
  check('시뮬 결정성 (동일 시드 동일 상태)', a.ball.x === b.ball.x && a.a.x === b.a.x && a.score.join() === b.score.join());
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
