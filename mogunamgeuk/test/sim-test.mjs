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
  st.stage.curves = [{ d0: -9999, d1: 9999, c: 0.8 }];   // 경계가 멀어 전 구간 풀 곡률
  run(st, 1.2);
  check(`커브 드리프트 (x → ${st.x.toFixed(0)})`, st.x > 40);
}

// 3-b) 커브 전환 스무딩: 경계 ±60m에서 곡률이 계단 없이 서서히 변함
{
  const stage = { curves: [{ d0: 0, d1: 500, c: 0 }, { d0: 500, d1: 1000, c: 0.8 }] };
  const cs = [430, 470, 500, 530, 570].map((d) => M.curveAt(stage, d));
  const mono = cs.every((c, i) => i === 0 || c >= cs[i - 1]);
  check(`커브 전환 스무딩 (${cs.map((c) => c.toFixed(2)).join(' → ')})`,
    cs[0] === 0 && cs[4] === 0.8 && Math.abs(cs[2] - 0.4) < 0.01 &&
    mono && cs[1] > 0 && cs[1] < cs[2] && cs[3] > cs[2] && cs[3] < 0.8);
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

// 10) 난이도: 속도 배율·밀도·바다사자 출현·결정성
{
  const mk = (d) => { M.diff = d; const s = M.makeStage(5); M.diff = 'normal'; return s; };
  const n = mk('normal'), cz = mk('crazy'), ez = mk('easy');
  check(`난이도 속도 배율 (이지 ${ez.maxSpd} < 노말 ${n.maxSpd} < 크레이지 ${cz.maxSpd})`,
    ez.maxSpd < n.maxSpd && n.maxSpd < cz.maxSpd);
  const haz = (s) => s.objs.filter((o) => o.type !== 'flag' && o.type !== 'fish').length;
  check(`크레이지 장애물 밀도 증가 (${haz(n)} → ${haz(cz)})`, haz(cz) > haz(n));
  const pops = (s) => s.objs.filter((o) => o.type === 'crev' && o.pop).length;
  check(`크레이지 바다사자 출현 증가 (${pops(n)} → ${pops(cz)})`, pops(cz) >= pops(n) && pops(cz) > 0);
  check('크레이지 제한시간 물리 가능', cz.time * cz.maxSpd >= cz.length * 1.25);
  M.diff = 'crazy';
  const a = M.makeStage(3), b = M.makeStage(3);
  M.diff = 'normal';
  check('난이도별 결정성', JSON.stringify(a.objs) === JSON.stringify(b.objs));
}

// 11) 점프 연타 호버: 체공 연장 + 상한
{
  const air = (flaps) => {
    const st = clean(1);
    let frames = 0, pressed = 0;
    L.step(st, DT, { jump: true });
    for (let i = 1; i < 600; i++) {
      let inp = IDLE;
      if (pressed < flaps && i % 12 === 0 && st.jumpT > 0) { inp = { jump: true }; pressed++; }
      L.step(st, DT, inp);
      if (L.jy(st) > 0) frames++;
      if (st.jumpT <= 0 && i > 20) break;
    }
    return frames;
  };
  const single = air(0), triple = air(3), over = air(8);
  check(`연타 호버 체공 연장 (${single} → ${triple} 프레임)`, triple > single + 30);
  check(`연장 상한 ${L.FLAP_MAX}회 (연타 8회 = ${over} 프레임)`, over <= triple + 8);
}

// 12) 충돌 비틀거림: 전진 정지 + 미끄러지던 방향으로 탁탁탁 밀려남
{
  const st = clean(1);
  st.stage.objs = [{ d: 200, x: 0, type: 'hole', w: 34 }];
  st.dist = 170; st.x = 0; st.vx = 150;
  run(st, 0.6);
  check(`충돌 비틀 횡밀림 (x → ${st.x.toFixed(0)}, dir ${st.tumbleDir})`,
    st.crashes === 1 && st.tumbleDir === 1 && st.x > 15);
  check(`경직 중 전진 정지 (spd ${st.spd}, dist ${st.dist.toFixed(0)})`,
    st.stunT > 0 && st.spd === 0 && st.dist < 210);
  run(st, 1.5, { up: true });                        // 경직 해제 후 재출발
  check(`경직 해제 → 재출발 (dist ${st.dist.toFixed(0)})`, st.stunT <= 0 && st.spd > 60 && st.dist > 220);
}

// 13) 크레바스 바다사자: 점프+정면 → 충돌 / 점프+측면 → 통과
{
  const mk = (px, x0) => {
    const st = clean(1);
    run(st, 3, { up: true });
    st.stage.objs = [{ d: st.dist + 60, x: 0, type: 'crev', w: M.TRACK_W, pop: true, px }];
    st.x = x0;
    const crevD = st.stage.objs[0].d;
    let jumped = false;
    const evs = [];
    for (let i = 0; i < 600 && st.dist < crevD + 80; i++) {
      const inJump = st.dist > crevD - 45 && !jumped ? (jumped = true) : false;
      evs.push(...L.step(st, DT, { jump: inJump }));
    }
    return evs;
  };
  check('바다사자 정면 점프 → 충돌', mk(0, 0).some((e) => e.type === 'crash' && e.seal));
  check('바다사자 측면 회피 → 통과', !mk(120, -60).some((e) => e.type === 'crash'));
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
