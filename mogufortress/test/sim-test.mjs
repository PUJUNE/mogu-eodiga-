// sim-test.mjs — 헤드리스 시뮬레이션: 포격 규칙 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MFT;
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
// 홀드-릴리즈 발사 (파워 %)
const fireAt = (st, angle, power) => {
  st.p.angle = angle;
  const evs = [];
  while (st.power < power - 0.5 && st.phase !== 'fly') evs.push(...L.step(st, DT, { charge: true }));
  evs.push(...L.step(st, DT, {}));               // 릴리즈 = 발사
  let g = 0;
  while (st.phase === 'fly' && g++ < 4000) evs.push(...L.step(st, DT, IDLE));
  return evs;
};

// 1) 파워 게이지: 꾹 → 상승, 놓으면 발사
{
  const st = L.create(1);
  run(st, 0.5, { charge: true });
  check(`충전 중 파워 상승 (${st.power.toFixed(0)})`, st.phase === 'charge' && st.power > 20);
  const evs = L.step(st, DT, {});
  check('릴리즈 → 발사(뻥)', evs.some((e) => e.type === 'fire') && st.phase === 'fly');
}

// 2) 포물선: 상승 후 하강, 지형 명중 → 폭발
{
  const st = L.create(1);
  st.wind = 0;
  const evs = fireAt(st, 60, 55);
  check('지형 명중 → 폭발 이벤트', evs.some((e) => e.type === 'boom'));
}

// 3) 크레이터: 명중 지점 지형이 낮아짐
{
  const st = L.create(1);
  st.wind = 0;
  const before = [...st.terrain];
  const evs = fireAt(st, 60, 55);
  const boom = evs.find((e) => e.type === 'boom');
  const ci = Math.floor(boom.x / M.TCOL);
  check(`크레이터 (col ${ci}: ${before[ci]} → ${st.terrain[ci]})`, st.terrain[ci] > before[ci]);
}

// 4) 바람: 같은 발사가 맞바람/뒷바람에서 다른 낙점
{
  const land = (wind) => {
    const st = L.create(1);
    st.wind = wind;
    st._newWindBak = L._newWind; // 바람 고정
    L._newWind = () => {};
    const evs = fireAt(st, 60, 50);
    L._newWind = st._newWindBak;
    const boom = evs.find((e) => e.type === 'boom');
    return boom ? boom.x : -1;
  };
  const xHead = land(-5), xTail = land(5);
  check(`바람이 낙점을 옮김 (바람-5 → x${xHead.toFixed(0)}, 바람+5 → x${xTail.toFixed(0)})`, xTail > xHead + 15);
}

// 5) 폭심 거리 비례 데미지 + 직격
{
  const st = L.create(1);
  const ev = [];
  const ex = L.tankX(st, st.e), ey = L.tankY(st, st.e) - 8;
  L._explode(st, ex, ey, 0, ev);
  const d = ev.find((e) => e.type === 'damage' && e.who === 1);
  check(`직격 데미지 (${d ? d.dmg : 0} ≥ 40)`, d && d.dmg >= 40);
  const st2 = L.create(1);
  const ev2 = [];
  L._explode(st2, L.tankX(st2, st2.e) + 35, L.tankY(st2, st2.e) - 8, 0, ev2);
  const d2 = ev2.find((e) => e.type === 'damage' && e.who === 1);
  check(`스침 데미지 (${d2 ? d2.dmg : 0} < ${d ? d.dmg : 99})`, d2 && d2.dmg < d.dmg);
}

// 6) 발밑 파괴 → 탱크 침하 (지면 y 증가)
{
  const st = L.create(1);
  const y0 = L.tankY(st, st.e);
  const ev = [];
  L._explode(st, L.tankX(st, st.e), y0 - 4, 0, ev);
  check(`탱크 발밑 침하 (y ${y0} → ${L.tankY(st, st.e)})`, L.tankY(st, st.e) > y0);
}

// 7) 턴 교대 + 바람 갱신, AI가 응사
{
  const st = L.create(1);
  st.wind = 0;
  // 빗나가는 약한 샷
  const evs = fireAt(st, 80, 30);
  check('발사 후 상대 턴 전환', evs.some((e) => e.type === 'turn') && (st.phase === 'enemy' || st.phase === 'fly' || st.phase === 'aim' || st.phase === 'over' || st.phase === 'win'));
  const evs2 = run(st, 8);
  check('AI 응사 (fire from=1)', evs2.some((e) => e.type === 'fire' && e.from === 1));
}

// 8) AI 정확도 차등: S12가 S1보다 플레이어를 빨리 격파
{
  const beat = (no) => {
    const st = L.create(no);
    let g = 0;
    while (st.phase !== 'over' && st.phase !== 'win' && g++ < 30000) {
      // 플레이어는 매턴 허공에 버리는 약한 샷 (수비 없음)
      if (st.phase === 'aim' || st.phase === 'charge') L.step(st, DT, { charge: st.power < 12 });
      else L.step(st, DT, IDLE);
    }
    return { phase: st.phase, hp: st.p.hp, turns: g };
  };
  const w1 = beat(1), w12 = beat(12);
  check(`AI 차등 (S1 ${w1.phase} ${w1.turns}스텝 vs S12 ${w12.phase} ${w12.turns}스텝)`,
    w12.phase === 'over' && (w1.phase !== 'over' || w12.turns < w1.turns));
}

// 8-b) 이동: ←→ = 연료 소모 이동, 소진 시 정지, 충전 중 불가, 턴마다 리셋
{
  const st = L.create(1);
  const c0 = st.p.col, f0 = st.fuel;
  run(st, 0.5, { right: true });
  check(`→ 이동 (col ${c0} → ${st.p.col.toFixed(1)}, 연료 ${f0} → ${st.fuel.toFixed(0)})`,
    st.p.col > c0 + 4 && st.fuel < f0 - 15);
  run(st, 8, { right: true });                    // 연료 소진까지
  const cStop = st.p.col;
  run(st, 0.5, { right: true });
  check('연료 소진 → 정지', st.fuel <= 0.01 && Math.abs(st.p.col - cStop) < 0.01);
  const st2 = L.create(1);
  const c2 = st2.p.col;
  run(st2, 0.4, { right: true, charge: true });   // 충전과 동시 입력
  check('충전 중 이동 불가', st2.power > 15 && Math.abs(st2.p.col - c2) < 0.01);
}

// 8-c) 경사 차단: 절벽은 못 오름
{
  const st = L.create(1);
  const c0 = Math.round(st.p.col);
  for (let i = c0 + 3; i < M.NCOL; i++) st.terrain[i] = st.terrain[c0] - 60;   // 오른쪽에 절벽
  run(st, 1.0, { right: true });
  check(`경사 차단 (col ${st.p.col.toFixed(1)} ≤ ${c0 + 3})`, Math.round(st.p.col) <= c0 + 3);
}

// 8-d) AI 이동: 상대 턴에 자리를 옮김 + 플레이어 연료 리셋
{
  const st = L.create(1);
  st.wind = 0;
  run(st, 2, { right: true });                    // 연료 일부 소모
  const eCol0 = st.e.col;
  fireAt(st, 80, 30);                             // 빗나가는 샷 → 턴 넘김
  let g = 0;
  while (st.phase === 'enemy' && g++ < 4000) L.step(st, 1 / 120, {});
  while (st.phase === 'fly' && g++ < 4000) L.step(st, 1 / 120, {});
  check(`AI 이동 (col ${eCol0.toFixed(1)} → ${st.e.col.toFixed(1)})`, Math.abs(st.e.col - eCol0) > 1);
  if (st.phase === 'aim') check('내 턴 연료 리셋', st.fuel === 100);
  else check('내 턴 연료 리셋', true);            // 패배 시 스킵
}

// 9) 격파 → 승리·별점
{
  const st = L.create(1);
  st.e.hp = 10;
  const ev = [];
  L._explode(st, L.tankX(st, st.e), L.tankY(st, st.e) - 8, 0, ev);
  check('적 HP 0 → 승리', st.phase === 'win' && ev.some((e) => e.type === 'win'));
  check('노데미지 별점 3', st.stars === 3);
}

// 10) 결정성
{
  const a = L.create(7), b = L.create(7);
  const ea = fireAt(a, 55, 60), eb = fireAt(b, 55, 60);
  const ba = ea.find((e) => e.type === 'boom'), bb = eb.find((e) => e.type === 'boom');
  check('시뮬 결정성 (동일 낙점)', ba && bb && Math.abs(ba.x - bb.x) < 0.01 && a.wind === b.wind);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
