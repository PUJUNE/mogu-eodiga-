// sim-test.mjs — 헤드리스 시뮬레이션: 원작 머슬 태그매치 준거 규칙 검증 (node 단독)
// 정량 목표(원작): 파워 99·자연감소 1/s·점프 소모 2·구슬 트리거 59·회복 +20·점멸 10s·
//                  태그 등장 80·재태그 잠금 10s·폴 30s·3판 2선승
import './shim.mjs';

const M = globalThis.window.MMS;
const L = M.Logic;
const C = L.C;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const near = (a, b, tol = 0.35) => Math.abs(a - b) <= tol;
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};
const until = (st, cond, maxSec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(maxSec / DT); i++) {
    evs.push(...L.step(st, DT, input || IDLE));
    if (cond(st, evs)) return evs;
  }
  return evs;
};
// 적 AI·구슬을 무력화한 무풍 상태 (규칙 단위 검증용)
const clean = (no) => {
  const st = L.create(no);
  st.stage.aggr = 0;
  st.ballCd = 1e9;
  for (const e of st.enemies) { e.spd = 0; e.x = M.RING_X - 14; e.z = -M.RING_Z + 10; }
  return st;
};

// 1) 이동 + 링 경계 클램프
{
  const st = clean(1);
  const P = st.players[0];
  P.x = 0; P.z = 0;
  run(st, 0.5, { right: true });
  check(`이동 (x 0 → ${P.x.toFixed(0)})`, P.x > 40 && P.face === 1);
  P.x = 500; P.z = 500;
  run(st, 0.05);
  check(`링 경계 클램프 (${P.x}, ${P.z})`, P.x === M.RING_X && P.z === M.RING_Z);
}

// 2) 파워 자연 감소 1/s — 링 위만, 대기자는 불변 (원작)
{
  const st = clean(1);
  run(st, 3);
  check(`링 위 자연 감소 (99 → ${st.players[0].hp.toFixed(1)})`, near(st.players[0].hp, 99 - 3 * C.DRAIN, 0.1));
  check(`대기자 파워 불변 (${st.players[1].hp})`, st.players[1].hp === 99);
}

// 3) 점프: 파워 2 소모, 1칸(20) 미만이면 불가 (원작 B버튼)
{
  const st = clean(1);
  const P = st.players[0];
  P.x = 0; P.z = 0;
  const hp0 = P.hp;
  run(st, DT, { jump: true });
  check(`점프 → 공중 + 파워 -2 (${hp0.toFixed(1)} → ${P.hp.toFixed(1)})`, P.state === 'air' && near(P.hp, hp0 - C.JUMP_COST, 0.05));
  run(st, 0.7);
  check('착지', P.state !== 'air');
  P.hp = 15;
  run(st, DT, { jump: true });
  check('파워 1칸 미만 → 점프 불가 (원작)', P.state !== 'air');
}

// 4) 펀치: 원작 대미지 표 (모구 5) + 경직 / 사거리 밖 헛스윙
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0; E.x = 27; E.z = 0;
  const hp0 = E.hp;
  const evs = run(st, DT, { atk: true });
  check(`펀치 = 원작 대미지 5 (${hp0.toFixed(1)} → ${E.hp.toFixed(1)})`,
    near(E.hp, hp0 - P.mv.punch) && P.mv.punch === 5 && evs.some((e) => e.type === 'punch') && E.stunT > 0);
  const st2 = clean(1);
  st2.players[0].x = 0; st2.players[0].z = 0;
  const evs2 = run(st2, DT, { atk: true });
  check('사거리 밖 → 헛스윙', evs2.some((e) => e.type === 'swing'));
}

// 5) 밀치기: 정면 잡기 = 대미지 없이 좌우 로프로 → 반동 복귀 → 자연 소멸
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = -1;        // P가 정면
  const hp0 = E.hp;
  const evs = run(st, DT, { atk: true });
  check('정면 잡기 → 밀치기 (무대미지)', E.state === 'rope' && E.ropePhase === 'out' &&
    near(E.hp, hp0, 0.1) && evs.some((e) => e.type === 'shove'));
  until(st, () => E.ropePhase === 'back', 1);
  check('로프 반동 → 복귀', E.ropePhase === 'back' && E.ropeVx < 0);
  until(st, () => E.state !== 'rope', 3);
  check('카운터 없으면 복귀 종료', E.state !== 'rope' && E.state !== 'down');
}

// 6) 라리아트: 반동 복귀 중 공격 = 원작 대미지 7 + 다운
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = -1;
  run(st, DT, { atk: true });                                // 밀치기 (잡기 사거리)
  P.x = 30;                                                  // 복귀 경로에서 대기
  const hp0 = E.hp;
  until(st, () => E.ropePhase === 'back' && Math.abs(E.x - P.x) < C.LARIAT_RANGE - 4, 2);
  const evs = run(st, DT, { atk: true });
  check(`라리아트 카운터 (대미지 ${(hp0 - E.hp).toFixed(1)}, 다운)`,
    near(E.hp, hp0 - P.mv.lariat, 0.6) && E.state === 'down' && evs.some((e) => e.type === 'lariat'));
}

// 7) 드롭킥: 반동 복귀 중 공중 공격 = 원작 대미지 7 + 다운 (비행 중 접촉 판정)
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = -1;
  run(st, DT, { atk: true });
  P.x = 30;
  const hp0 = E.hp;
  until(st, () => E.ropePhase === 'back' && Math.abs(E.x - P.x) < C.KICK_RANGE - 6, 2);
  run(st, DT, { jump: true });
  run(st, DT, { atk: true });
  const evs = until(st, (s, ee) => ee.some((e) => e.type === 'dropkick'), 0.8);
  check(`드롭킥 카운터 (대미지 ${(hp0 - E.hp).toFixed(1)}, 다운)`,
    near(E.hp, hp0 - P.mv.dropkick, 0.6) && E.state === 'down' && evs.some((e) => e.type === 'dropkick'));
}

// 8) 플라잉 드롭킥 (일반): 공중 공격 = 킥 대미지 + 다운, 사거리 밖은 전진 돌진으로 명중
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 0; P.z = 0; E.x = 26; E.z = 0;
  const hp0 = E.hp;
  run(st, DT, { jump: true });
  run(st, DT, { atk: true });
  const evs = until(st, (s, ee) => ee.some((e) => e.type === 'kick'), 0.6);
  check(`플라잉 드롭킥 명중 (대미지 ${(hp0 - E.hp).toFixed(1)}, 다운)`,
    near(E.hp, hp0 - P.mv.kick, 0.4) && E.state === 'down' && evs.some((e) => e.type === 'kick'));
  const st2 = clean(1);
  const P2 = st2.players[0], E2 = st2.enemies[0];
  P2.x = 0; P2.z = 0; P2.face = 1; E2.x = 85; E2.z = 0;      // 킥 사거리(34) 밖
  const hp2 = E2.hp;
  run(st2, DT, { jump: true });
  run(st2, DT, { atk: true });
  const evs2 = until(st2, (s, ee) => ee.some((e) => e.type === 'kick'), 0.8);
  check(`사거리 밖 → 돌진 비행으로 명중 (x0 → ${P2.x.toFixed(0)}, 다운)`,
    P2.x > 40 && near(E2.hp, hp2 - P2.mv.kick, 0.5) && E2.state === 'down' &&
    evs2.some((e) => e.type === 'kick'));
}

// 9) 백드롭: 배후 잡기 = 원작 대미지 8 + 다운
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = 1;         // E가 +x를 보는 사이 배후에서
  const hp0 = E.hp;
  const evs = run(st, DT, { atk: true });
  check(`백드롭 (대미지 ${(hp0 - E.hp).toFixed(1)}, 다운)`,
    near(E.hp, hp0 - P.mv.backdrop, 0.2) && E.state === 'down' && evs.some((e) => e.type === 'backdrop'));
}

// 10) 플라잉 바디 어택: 공중에 로프 도달 → 자동 발동 → 명중 + 다운
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = M.RING_X - 10; P.z = 0; E.x = 0; E.z = 0;
  const hp0 = E.hp;
  run(st, DT, { jump: true });
  const evs = until(st, () => P.state === 'fba', 0.6, { right: true });
  check('공중 로프 도달 → FBA 발동', P.state === 'fba' && evs.some((e) => e.type === 'fbago'));
  const evs2 = until(st, () => P.state !== 'fba', 2);
  check(`FBA 명중 (대미지 ${(hp0 - E.hp).toFixed(1)}, 다운)`,
    near(E.hp, hp0 - P.mv.fba, 0.6) && E.state === 'down' && evs2.some((e) => e.type === 'fba'));
}

// 11) 다운·기상 무적
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = 1;
  run(st, DT, { atk: true });                                // 백드롭 → 다운
  const noHit = (evs) => !evs.some((e) => ['punch', 'backdrop', 'kick', 'special', 'shove'].includes(e.type));
  const evsDown = run(st, 0.9, { atk: true });               // 다운 중 연타 (자연 감소만 허용)
  check('다운 중 무적', noHit(evsDown));
  const evsInv = until(st, () => E.state !== 'down', 1.5, { atk: true });
  const evsInv2 = run(st, DT, { atk: true });
  check('기상 무적', noHit(evsInv) && noHit(evsInv2) && E.state !== 'down');
  run(st, 0.9);
  E.x = P.x + P.face * 27; E.z = P.z; E.face = -P.face;
  const hpUp = E.hp;
  run(st, DT, { atk: true });
  check('무적 해제 후 명중', E.hp < hpUp - 3);
}

// 12) 태그: C 전용 입력으로만 교대 (공격 버튼은 코너에서도 공격 — 오태그 방지)
//     + 등장 파워 80 + 재태그 10s 잠금 + 대기 회복 없음
{
  const st = clean(1);
  const P = st.players[0];
  st.players[1].hp = 42;                                     // 대기 중 꼬꼬 (저파워)
  P.x = st.pC.x; P.z = st.pC.z;
  const evsAtk = run(st, DT, { atk: true });
  check('코너 + 공격 → 태그 없음 (공격만)', st.pi === 0 && !evsAtk.some((e) => e.type === 'tag'));
  run(st, 0.4);                                              // 공격 모션 종료 대기
  P.hp = 99;                                                 // 점프 파워 확보
  const evsAir = run(st, DT, { jump: true, tag: true });     // 점프와 동시 입력 → 공중 태그 금지
  check('공중에서는 태그 불가', st.pi === 0 && !evsAir.some((e) => e.type === 'tag'));
  until(st, () => P.state !== 'air', 1);
  const evs = run(st, DT, { tag: true });
  check('코너 + C(전용 태그) → 교대', st.pi === 1 && evs.some((e) => e.type === 'tag'));
  check(`태그 등장 파워 4칸=80 (42 → ${st.players[1].hp.toFixed(1)})`, near(st.players[1].hp, C.TAG_IN_POWER, 0.1));
  check(`재태그 잠금 ${C.TAG_LOCK}s`, st.tagCd > C.TAG_LOCK - 0.5);
  const restHp = st.players[0].hp;
  run(st, 2);
  check('대기자 회복 없음 (원작)', near(st.players[0].hp, restHp, 0.05));
  run(st, 8.5);
  st.players[1].x = st.pC.x; st.players[1].z = st.pC.z;
  const evs2 = run(st, DT, { tag: true });
  check('잠금 해제 후 전용 태그 입력', st.pi === 0 && evs2.some((e) => e.type === 'tag'));
}

// 13) 생명의 구슬: 파워 59 이하 → 매니저 → 낮은 쪽으로 투척 → +20 회복 + 10s 점멸 + 이속 +50
{
  const st = clean(1);
  const P = st.players[0];
  P.x = 0; P.z = 0;
  st.ballCd = 0;
  P.hp = 50;                                                 // 트리거 (≤59)
  const evs = run(st, DT);
  check('파워 59 이하 → 매니저 등장', !!st.meat && evs.some((e) => e.type === 'meat'));
  const evs2 = until(st, (s) => !!s.ball && !s.ball.flying, 3);
  check('구슬 투척 → 착지 (파워 낮은 쪽 근처)', evs2.some((e) => e.type === 'ball') &&
    Math.abs(st.ball.x - P.x) < 40 && Math.abs(st.ball.z - P.z) < 30);
  P.x = st.ball.x; P.z = st.ball.z;
  const hp0 = P.hp;
  const evs3 = run(st, DT);
  check(`획득 → +20 회복 (${hp0.toFixed(1)} → ${P.hp.toFixed(1)}) + 점멸 ${C.POWER_T}s`,
    evs3.some((e) => e.type === 'powered') && near(P.hp, hp0 + C.BALL_HEAL, 0.1) && near(P.poweredT, C.POWER_T, 0.1));
  const x0 = P.x;
  run(st, 0.5, { right: true });
  const spdBoost = (P.x - x0) / 0.5;
  check(`점멸 중 이속 +50 (실측 ${spdBoost.toFixed(0)}/s)`, spdBoost > P.spd + C.POWER_SPD - 15);
  run(st, 10);
  check('점멸 10초 후 해제', P.poweredT === 0);
}

// 14) 필살기 (모구 = 잡기): 점멸 중 잡기 = 머슬 드라이버 40 + 다운
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = -1;
  P.poweredT = 10;
  const hp0 = E.hp;
  const evs = run(st, DT, { atk: true });
  check(`머슬 드라이버 (대미지 ${(hp0 - E.hp).toFixed(1)} = 원작 40)`,
    near(E.hp, hp0 - P.sp.dmg, 0.2) && P.sp.dmg === 40 && E.state === 'down' &&
    evs.some((e) => e.type === 'special'));
  check('점멸 중 반복 사용 가능 (원작)', P.poweredT > 0);
}

// 15) 필살기 (꼬꼬 = 공중): 점멸 중 점프 공격 = 30
{
  const st = clean(1);
  st.pi = 1;
  const K = st.players[1], E = st.enemies[0];
  K.x = 0; K.z = 0; E.x = 26; E.z = 0;
  K.poweredT = 10;
  const hp0 = E.hp;
  run(st, DT, { jump: true });
  run(st, DT, { atk: true });
  const evs = until(st, (s, ee) => ee.some((e) => e.type === 'special'), 0.6);
  check(`꼬꼬 공중살법 (대미지 ${(hp0 - E.hp).toFixed(1)} = 원작 30)`,
    near(E.hp, hp0 - K.sp.dmg, 0.4) && K.sp.dmg === 30 && evs.some((e) => e.type === 'special'));
}

// 16) 가스 (스테이지 2 적 필살기 — 원작 유일 투사체): 원거리 발사 → 명중 + 경직
{
  const st = clean(2);
  const P = st.players[0], E = st.enemies[0];
  P.x = -60; P.z = 0; E.x = 60; E.z = 0; E.spd = 0;
  E.poweredT = 10; E.aiT = 99;
  st.stage.aggr = 0.5;
  const evs = until(st, (s) => s.shots.length > 0, 3);
  check('가스 발사 (투사체 생성)', evs.some((e) => e.type === 'gas'));
  const hp0 = P.hp;
  const evs2 = until(st, (s, ee) => ee.some((e) => e.type === 'gashit'), 2);
  check(`가스 명중 (대미지 ${(hp0 - P.hp).toFixed(1)}) + 경직`,
    evs2.some((e) => e.type === 'gashit') && P.hp < hp0 - 3 && P.stunT > 0);
}

// 17) 폴: 적 1명 KO = 1폴 (원작) → 휴지 → 다음 폴 (KO자 40 부활, 타이머 30 리셋)
{
  const st = clean(1);
  const P = st.players[0], E = st.enemies[0];
  E.hp = 3;
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = 1;
  const evs = run(st, DT, { atk: true });
  check('KO → 아군 폴 획득', st.falls.p === 1 && st.phase === 'break' &&
    evs.some((e) => e.type === 'ko') && evs.some((e) => e.type === 'fall' && e.team === 'p'));
  const evs2 = run(st, C.FALL_BREAK + 0.2);
  check(`다음 폴 시작 (KO자 부활 40, 타이머 ${st.stage.time}s)`,
    st.fallNo === 2 && st.phase === 'fight' && near(st.enemies[0].hp, 40, 0.5) &&
    st.time > st.stage.time - 1 && evs2.some((e) => e.type === 'fallstart'));
}

// 18) 2폴 선취 → 승리 + 별점 (2-0 + 무다운 = ★3)
{
  const st = clean(1);
  st.falls.p = 1; st.fallNo = 2;
  const P = st.players[0], E = st.enemies[0];
  E.hp = 3;
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = 1;
  const evs = run(st, DT, { atk: true });
  check('2폴 → 승리', st.phase === 'clear' && evs.some((e) => e.type === 'clear'));
  check(`2-0 무다운 → ★3 (${st.stars})`, st.stars === 3);
}

// 19) 아군 2폴 상실 → 패배
{
  const st = clean(1);
  const E = st.enemies[0];
  const evs = [];
  L._damage(st, E, st.players[0], 999, true, 'punch', evs);
  check('아군 KO → 상대 폴', st.falls.e === 1 && st.phase === 'break');
  run(st, C.FALL_BREAK + 0.2);
  L._damage(st, E, st.players[st.pi], 999, true, 'punch', evs);
  check('2폴 상실 → 패배', st.phase === 'over');
}

// 20) 시간 초과 → 파워 합 우세 팀이 폴 (judge)
{
  const st = clean(1);
  st.time = 0.1;
  for (const e of st.enemies) e.hp = 10;
  const evs = run(st, 0.3);
  const f = evs.find((e) => e.type === 'fall');
  check('시간 초과 → 판정 폴 (아군)', f && f.judge && f.team === 'p' && st.falls.p === 1);
}

// 21) 전류 로프 (스테이지 7+): 접촉 지속 대미지 / 밀치기 = 반동 없이 강타 다운 / 점멸 중 무효
{
  const st = clean(7);
  const P = st.players[0];
  check('스테이지 7 = 전류 링', st.stage.electric === true);
  P.x = M.RING_X; P.z = 0;
  const hp0 = P.hp;
  run(st, 1, { right: true });
  check(`전류 접촉 지속 대미지 (${hp0.toFixed(1)} → ${P.hp.toFixed(1)})`, P.hp < hp0 - C.ZAP_DPS * 0.7);
  const E = st.enemies[0];
  P.x = 85; P.z = 0; E.x = 100; E.z = 0; E.face = -1; E.invT = 0; E.stunT = 0;
  const ehp0 = E.hp;
  run(st, DT, { atk: true });                                // 밀치기 → 전류 로프로
  const evs = until(st, () => E.state !== 'rope', 2);
  check(`전류 로프 강타 → 반동 없이 다운 (대미지 ${(ehp0 - E.hp).toFixed(1)})`,
    E.state === 'down' && near(E.hp, ehp0 - C.ZAP_HIT, 0.8) && evs.some((e) => e.type === 'zap'));
  const st2 = clean(7);
  const P2 = st2.players[0], E2 = st2.enemies[0];
  P2.x = 85; P2.z = 0; E2.x = 100; E2.z = 0; E2.face = -1;
  E2.poweredT = 10;                                          // 점멸 중 = 전류 무효 (원작)
  run(st2, DT, { atk: true });
  until(st2, () => E2.ropePhase === 'back' || E2.state !== 'rope', 1.5);
  check('점멸 중 전류 무효 → 정상 반동', E2.ropePhase === 'back');
}

// 22) 적 AI: 접근·공격 / 저파워 코너 태그 (등장 파워 80)
{
  const st = L.create(5);
  st.ballCd = 1e9;
  st.players[0].x = 0; st.players[0].z = 0;
  run(st, 6);
  check(`적 AI 접근·공격 (아군 파워 99 → ${st.players[st.pi].hp.toFixed(0)})`,
    st.players[st.pi].hp < 99 - 6 * C.DRAIN - 0.5 || st.pDowns > 0);
  const st2 = L.create(5);
  st2.ballCd = 1e9;
  st2.enemies[0].hp = 25;
  st2.players[0].x = -100; st2.players[0].z = 40;
  const evs = until(st2, (s) => s.ei === 1, 6);
  check('적 저파워 → 코너 태그 + 등장 80', evs.some((e) => e.type === 'etag') &&
    st2.ei === 1 && st2.enemies[1].hp >= C.TAG_IN_POWER - 1);
}

// 23) 시뮬 결정성
{
  const a = L.create(3), b = L.create(3);
  const ea = run(a, 12, { right: true, atk: true });
  const eb = run(b, 12, { right: true, atk: true });
  const key = (s) => JSON.stringify([s.players, s.enemies, s.score, s.phase, s.falls, s.shots, s.ball]);
  check('시뮬 결정성', key(a) === key(b) && ea.length === eb.length);
}

// 24) 실전성 (정량 목표): 노말 스테이지 1, 단순 봇 → 3폴 이내 경기 종결 + 폴 발생
{
  const st = L.create(1);
  const bot = () => {
    const P = st.players[st.pi], E = st.enemies[st.ei];
    return {
      left: E.x < P.x - 6, right: E.x > P.x + 6,
      up: E.z < P.z - 4, down: E.z > P.z + 4,
      atk: true,
    };
  };
  let steps = 0;
  const evs = [];
  while (st.phase !== 'clear' && st.phase !== 'over' && steps < Math.round(120 / DT)) {
    evs.push(...L.step(st, DT, bot()));
    steps++;
  }
  const falls = st.falls.p + st.falls.e;
  check(`경기 종결 (${(steps * DT).toFixed(0)}s, 폴 ${st.falls.p}-${st.falls.e}, ${st.phase})`,
    (st.phase === 'clear' || st.phase === 'over') && falls >= 2);
  check('폴 이벤트 발생', evs.some((e) => e.type === 'fall'));
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
