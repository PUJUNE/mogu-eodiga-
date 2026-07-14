// sim-test.mjs — 헤드리스 시뮬레이션: 태그매치 규칙 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MMS;
const L = M.Logic;
const C = L.C;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};
// 적 AI·파워볼을 무력화한 무풍 상태 (규칙 단위 검증용)
const clean = (no) => {
  const st = L.create(no);
  st.stage.aggr = 0;
  st.ballT = 99999;
  for (const e of st.enemies) { e.spd = 0; e.x = M.RING_X - 14; e.z = -M.RING_Z + 10; }
  return st;
};

// 1) 이동 + 링 경계 클램프
{
  const st = clean(1);
  const P = st.players[0];
  P.x = 0; P.z = 0;
  run(st, 0.5, { right: true });
  check(`이동 (x 0 → ${P.x.toFixed(0)})`, P.x > 50);
  P.x = 500; P.z = 500;
  run(st, 0.05);
  check(`링 경계 클램프 (${P.x}, ${P.z})`, P.x === M.RING_X && P.z === M.RING_Z);
}

// 2) 로프 반동 대시: 로프를 밀면 반대편으로 돌진
{
  const st = clean(1);
  const P = st.players[0];
  P.x = -M.RING_X; P.z = 0;
  const evs = run(st, 0.05, { left: true });
  check('로프 반동 → 대시 상태', P.state === 'run' && P.runVx === C.RUN && evs.some((e) => e.type === 'bounce'));
  run(st, 0.4);                                  // 입력 없이도 대시 지속
  check(`대시 전진 (x → ${P.x.toFixed(0)})`, P.x > -M.RING_X + 80);
}

// 3) 펀치: 사거리 안 명중 / 밖 헛스윙
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0; E.x = 27; E.z = 0;
  const hp0 = E.hp;
  const evs = run(st, 0.05, { atk: true });
  check(`펀치 명중 (HP ${hp0} → ${E.hp})`, E.hp === hp0 - C.PUNCH_DMG && evs.some((e) => e.type === 'punch') && E.stunT > 0);
  const st2 = clean(1);
  st2.players[0].x = 0; st2.players[0].z = 0;
  st2.enemies[0].x = 100; st2.enemies[0].z = 0;
  const hp1 = st2.enemies[0].hp;
  const evs2 = run(st2, 0.05, { atk: true });
  check('사거리 밖 → 헛스윙', st2.enemies[0].hp === hp1 && evs2.some((e) => e.type === 'swing'));
}

// 4) 잡아 던지기: 근접 시 큰 데미지 + 다운 + 밀려남
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0; E.x = 15; E.z = 0;
  const hp0 = E.hp;
  const evs = run(st, 0.05, { atk: true });
  check(`던지기 (HP -${hp0 - E.hp}, 다운, 밀려남 x=${E.x.toFixed(0)})`,
    E.hp === hp0 - C.THROW_DMG && E.state === 'down' && E.x > 30 &&
    evs.some((e) => e.type === 'throw') && evs.some((e) => e.type === 'kd'));
}

// 5) 대시 라리아트: 대시 중 공격 = 강타 + 다운
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = -50; P.z = 0; P.state = 'run'; P.runVx = C.RUN; P.runVz = 0; P.runT = 1;
  E.x = -20; E.z = 0;
  const hp0 = E.hp;
  const evs = run(st, 0.05, { atk: true });
  check(`대시 라리아트 (HP -${hp0 - E.hp})`, E.hp === hp0 - C.LARIAT_DMG && E.state === 'down' &&
    evs.some((e) => e.type === 'lariat'));
}

// 6) 다운·기상 무적: 다운 중과 무적 중엔 공격 무효
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0; E.x = 15; E.z = 0;
  run(st, 0.05, { atk: true });                  // 던지기 → 다운
  const hpDown = E.hp;
  E.x = 27; E.z = 0;                             // 다운 자리 고정
  run(st, 0.8, { atk: true });                   // 다운 중 연타
  check('다운 중 무적', E.hp === hpDown);
  run(st, 0.8);                                  // 기상 (invT 진행)
  E.x = 27;
  run(st, 0.05, { atk: true });
  check('기상 무적', E.hp === hpDown && E.state !== 'down');
  run(st, 0.9);                                  // 무적 해제
  E.x = 27;
  run(st, 0.05, { atk: true });
  check('무적 해제 후 명중', E.hp === hpDown - C.PUNCH_DMG);
}

// 7) 태그: 코너에서 교체 + 휴식 회복
{
  const st = clean(1);
  const P = st.players[0];
  P.hp = 50;
  P.x = st.pC.x; P.z = st.pC.z;
  const evs = run(st, 0.05, { tag: true });
  check('코너 태그 → 교체', st.pi === 1 && evs.some((e) => e.type === 'tag'));
  run(st, 2);
  check(`휴식 회복 (50 → ${st.players[0].hp.toFixed(1)})`, st.players[0].hp > 50 + C.REST_HEAL * 1.5);
  // 코너에서 멀면 태그 불가
  const st2 = clean(1);
  st2.players[0].x = 0; st2.players[0].z = 0;
  run(st2, 0.05, { tag: true });
  check('코너 밖 태그 불가', st2.pi === 0);
}

// 8) 적 2명 KO → 승리 + 별점 (무다운·고체력 = ★3)
{
  const st = clean(1);
  const P = st.players[0];
  for (const e of st.enemies) e.hp = 1;
  P.x = 0; P.z = 0;
  st.enemies[0].x = 15; st.enemies[0].z = 0;
  let evs = run(st, 0.05, { atk: true });        // 1번째 KO
  check('첫 KO → 파트너 교대 입장', evs.some((e) => e.type === 'ko') && evs.some((e) => e.type === 'enter') && st.ei === 1);
  P.x = st.eC.x - 24; P.z = st.eC.z;             // 코너로 접근
  run(st, 1.0);                                  // 무적·쿨다운 해제 대기
  evs = run(st, 0.05, { atk: true });            // 2번째 KO
  check('둘째 KO → 승리', st.phase === 'clear' && evs.some((e) => e.type === 'clear'));
  check(`무다운 + 고체력 → ★3 (${st.stars})`, st.stars === 3);
}

// 9) 아군 2명 KO → 패배
{
  const st = clean(1);
  const E = st.enemies[0];
  const evs = [];
  L._hit(st, E, st.players[0], 999, true, 'punch', evs);
  check('아군 첫 KO → 파트너 입장', evs.some((e) => e.type === 'penter') && st.pi === 1 && st.pDowns === 1);
  L._hit(st, E, st.players[1], 999, true, 'punch', evs);
  check('아군 전멸 → 패배', st.phase === 'over' && evs.some((e) => e.type === 'over'));
}

// 10) 시간 초과 → 체력 비율 판정
{
  const st = clean(1);
  st.time = 0.1;
  for (const e of st.enemies) e.hp = 10;
  const evs = run(st, 0.3);
  const cl = evs.find((e) => e.type === 'clear');
  check('시간 초과 + 체력 우세 → 판정승 (★1)', st.phase === 'clear' && cl && cl.judge && st.stars === 1);
  const st2 = clean(1);
  st2.time = 0.1;
  for (const p of st2.players) p.hp = 10;
  const evs2 = run(st2, 0.3);
  check('시간 초과 + 체력 열세 → 판정패', st2.phase === 'over' && evs2.some((e) => e.type === 'over' && e.judge));
}

// 11) 파워볼: 획득 → 다음 공격이 필살기
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0;
  st.ball = { x: 5, z: 0, t: 5 };
  run(st, 0.1);
  check('파워볼 획득', P.powered && st.ball === null);
  E.x = 27; E.z = 0;
  const hp0 = E.hp;
  const evs = run(st, 0.05, { atk: true });
  check(`필살기 (HP -${hp0 - E.hp}, 다운)`, E.hp === hp0 - C.SPECIAL_DMG && E.state === 'down' &&
    evs.some((e) => e.type === 'special') && !P.powered);
}

// 12) 적 AI: 접근·공격 / 저체력 시 코너 태그
{
  const st = L.create(5);
  st.ballT = 99999;
  st.players[0].x = 0; st.players[0].z = 0;
  run(st, 5);
  check(`적 AI 접근·공격 (모구 HP 130 → ${st.players[st.pi].hp.toFixed(0)})`, st.players[0].hp < 130);
  const st2 = L.create(5);
  st2.ballT = 99999;
  st2.enemies[0].hp = 5;                          // 30% 미만 → 태그하러 후퇴
  st2.players[0].x = -100; st2.players[0].z = 40;
  const evs = run(st2, 4);
  check('적 저체력 → 코너 태그', evs.some((e) => e.type === 'etag') && st2.ei === 1);
}

// 13) 시뮬 결정성
{
  const a = L.create(3), b = L.create(3);
  const ea = run(a, 10, { right: true, atk: true });
  const eb = run(b, 10, { right: true, atk: true });
  const key = (s) => JSON.stringify([s.players, s.enemies, s.score, s.phase]);
  check('시뮬 결정성', key(a) === key(b) && ea.length === eb.length);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
