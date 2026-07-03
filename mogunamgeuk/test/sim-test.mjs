// sim-test.mjs — 헤드리스 시뮬레이션: 러너 규칙 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MNG;
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
// 특정 오브젝트 직전까지 전진 (장애물 없는 무풍 상태로 세팅 후 이동)
const clean = (no) => {
  const st = L.create(no);
  st.stage.objs = [];
  st.stage.curves = [];
  st.stage.flagsTotal = 0;
  return st;
};

// 1) 가속·감속 클램프
{
  const st = clean(1);
  run(st, 5, { up: true });
  check(`가속 → 최고 속도 클램프 (${st.spd} = ${st.stage.maxSpd})`, st.spd === st.stage.maxSpd);
  run(st, 5, { down: true });
  check(`감속 → 최저 속도 클램프 (${st.spd})`, st.spd === 60);
}

// 2) 조향 + 트랙 경계
{
  const st = clean(1);
  run(st, 0.5, { right: true });
  const x1 = st.x;
  check(`→ 조향 (x 0 → ${x1.toFixed(0)})`, x1 > 60);
  run(st, 5, { right: true });
  check(`트랙 경계 클램프 (${st.x} = ${M.TRACK_W})`, st.x === M.TRACK_W);
}

// 2-b) 빙판 관성: 입력을 놓아도 미끄러지고, 반대로 꺾으면 스키드
{
  const st = clean(1);
  run(st, 0.6, { right: true });
  const x1 = st.x;
  run(st, 0.4);                                  // 입력 없음 — 관성으로 계속 미끄러짐
  check(`관성 활주 (x ${x1.toFixed(0)} → ${st.x.toFixed(0)})`, st.x > x1 + 20);
  const evs = run(st, 0.5, { left: true });      // 반대로 꺾기
  check('방향 전환 → 스키드 이벤트', evs.some((e) => e.type === 'skid') && st.skidT !== undefined);
}

// 3) 커브 드리프트: 조향 없으면 바깥으로 밀림
{
  const st = clean(1);
  st.stage.curves = [{ d0: 0, d1: 9999, c: 0.8 }];
  run(st, 1.2);
  check(`커브 드리프트 (x → ${st.x.toFixed(0)})`, st.x > 40);
}

// 4) 크레바스: 점프로 통과, 미점프 → 충돌 경직 + 최저속
{
  const mk = () => {
    const st = clean(1);
    run(st, 3, { up: true });                    // 먼저 가속 (장애물 없음)
    st.stage.objs = [{ d: st.dist + 60, x: 0, type: 'crev', w: M.TRACK_W }];
    return st;
  };
  const a = mk();
  const evA = [];
  const crevD = a.stage.objs[0].d;
  let jumped = false;
  for (let i = 0; i < 600 && a.dist < crevD + 80; i++) {
    const inJump = a.dist > crevD - 45 && !jumped ? (jumped = true) : false;
    evA.push(...L.step(a, DT, { jump: inJump }));
  }
  check('점프 → 크레바스 통과 (무충돌)', jumped && !evA.some((e) => e.type === 'crash') && a.crashes === 0);
  const b = mk();
  const evB = run(b, 2);
  check(`미점프 → 충돌 (경직·최저속 ${b.spd})`, evB.some((e) => e.type === 'crash') && b.crashes === 1 && b.spd === 60);
}

// 5) 구멍: 측면 회피 가능
{
  const st = clean(1);
  st.stage.objs = [{ d: 200, x: 0, type: 'hole', w: 34 }];
  st.dist = 170; st.x = 120;
  const evs = run(st, 1.5);
  check('구멍 측면 회피 (x=120)', !evs.some((e) => e.type === 'crash'));
  const st2 = clean(1);
  st2.stage.objs = [{ d: 200, x: 0, type: 'hole', w: 34 }];
  st2.dist = 170; st2.x = 0;
  const evs2 = run(st2, 1.5);
  check('구멍 정면 → 충돌', evs2.some((e) => e.type === 'crash'));
}

// 6) 깃발·물고기 수집 + 점수
{
  const st = clean(1);
  st.stage.objs = [
    { d: 200, x: 0, type: 'flag', w: 26 },
    { d: 300, x: 0, type: 'fish', w: 26 },
    { d: 400, x: 150, type: 'flag', w: 26 },   // 반대편 — 못 먹음
  ];
  st.stage.flagsTotal = 2;
  st.dist = 170; st.x = 0;
  const evs = run(st, 3);
  check(`깃발·물고기 수집 (🚩${st.flags} 🐟${st.fish}, 점수 ${st.score})`,
    st.flags === 1 && st.fish === 1 && st.score === 400 && evs.some((e) => e.type === 'flag'));
}

// 7) 시간 초과 → 실패
{
  const st = clean(1);
  st.time = 0.5;
  const evs = run(st, 1);
  check('시간 초과 → 실패', st.phase === 'over' && evs.some((e) => e.type === 'over'));
}

// 8) 도착 → 클리어 + 시간 보너스 + 별점
{
  const st = clean(1);
  st.stage.length = 300;
  st.dist = 280; st.time = 30;
  const evs = run(st, 2, { up: true });
  const cl = evs.find((e) => e.type === 'clear');
  check(`도착 → 클리어 (보너스 ${cl ? cl.bonus : 0})`, st.phase === 'clear' && cl && cl.bonus >= 280);
  check('깃발 전부 + 무충돌 → ★3', st.stars === 3);
}
{
  const st = clean(1);
  st.stage.length = 300;
  st.stage.flagsTotal = 4;                       // 하나도 못 먹은 상태
  st.dist = 290; st.time = 10;
  run(st, 1, { up: true });
  check('깃발 0/4 → ★1', st.stars === 1);
}

// 9) 결정성
{
  const a = L.create(5), b = L.create(5);
  const ea = run(a, 20, { up: true });
  const eb = run(b, 20, { up: true });
  check('시뮬 결정성', a.dist === b.dist && a.crashes === b.crashes && a.flags === b.flags &&
    ea.length === eb.length);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
