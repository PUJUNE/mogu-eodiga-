// sim-test.mjs — 헤드리스 시뮬레이션: 벨트스크롤 전투 규칙 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSG;
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
// 적을 특정 위치에 강제 배치한 깨끗한 판
const arena = (mission = 1) => {
  const st = L.create(mission);
  st.enemies = [];
  st.b.x = -999; st.b.z = 0; st.b.hp = 0; st.b.state = 'dead'; st.b.reviveT = -999;   // 꼬꼬 제외
  return st;
};
const spawn = (st, x, z, hp = 24) => {
  const e = { kind: 'e', type: 'thug', name: '쥐 양아치', x, z, jy: 0, vy: 0, face: -1,
    hp, maxHp: hp, spd: 0, dmg: 7, w: 15, state: 'idle', stT: 0, combo: 0, comboT: 99,
    atkCd: 999, hitDone: false, iv: 0, reviveT: 0, baseAtkCd: 999, score: 100 };
  st.enemies.push(e);
  return e;
};

// 1) 8방향 이동·경계
{
  const st = arena();
  const x0 = st.p.x, z0 = st.p.z;
  run(st, 0.5, { right: true, down: true });
  check('우+하 이동', st.p.x > x0 + 30 && st.p.z > z0 + 15);
  run(st, 5, { down: true });
  check('깊이 하한 클램프', st.p.z === M.Z_MAX);
}
// 1-b) 전진 게이트: 살아있는 적(불사·비공격)이 있는 동안 구간 끝에서 정지
{
  const st = L.create(1);
  st.b.hp = 0; st.b.state = 'dead'; st.b.reviveT = -999;
  st.p.hp = 1e9; st.p.maxHp = 1e9;
  for (const e of st.enemies) { e.hp = 1e9; e.maxHp = 1e9; e.spd = 0; e.atkCd = 999; e.baseAtkCd = 999; }
  run(st, 20, { right: true });
  check('전진 게이트 (구간 클리어 전 정지)', st.p.x <= st.stage.sections[0].x1 - 20 + 0.01 && st.secIdx === 0);
}

// 2) 공격 사거리: 맞음 / 빗나감
{
  const st = arena();
  const eNear = spawn(st, st.p.x + 26, st.p.z);
  const eFar = spawn(st, st.p.x + 120, st.p.z);
  const eDeep = spawn(st, st.p.x + 26, st.p.z + 40);
  st.p.face = 1;
  const evs = run(st, 0.3, { atk: true });
  check('전방 근접 적 명중', evs.some((e) => e.type === 'hit') && eNear.hp < eNear.maxHp);
  check('원거리·깊이 다른 적은 빗나감', eFar.hp === eFar.maxHp && eDeep.hp === eDeep.maxHp);
}

// 3) 3연타 콤보 → 다운
{
  const st = arena();
  const e = spawn(st, st.p.x + 26, st.p.z, 200);
  st.p.face = 1;
  const evs = [];
  for (let i = 0; i < 3; i++) {
    evs.push(...L.step(st, DT, { atk: true }));
    evs.push(...run(st, 0.4));
    e.x = st.p.x + 26; e.z = st.p.z; e.state = e.state === 'down' ? e.state : 'idle'; e.iv = 0;
  }
  check('3연타에 넉다운 발생', evs.some((ev2) => ev2.type === 'kd') && e.state === 'down');
}

// 4) 점프킥 = 다운
{
  const st = arena();
  const e = spawn(st, st.p.x + 28, st.p.z, 100);
  st.p.face = 1;
  L.step(st, DT, { jump: true });
  run(st, 0.12);
  const evs = run(st, 0.3, { atk: true });
  check('점프킥 → 넉다운', evs.some((ev2) => ev2.type === 'kd') && e.state === 'down');
}

// 5) 적 공격 → 플레이어 피격
{
  const st = arena();
  const e = spawn(st, st.p.x + 24, st.p.z);
  e.atkCd = 0; e.baseAtkCd = 0.5; e.spd = 40;
  const hp0 = st.p.hp;
  run(st, 1.2);
  check(`적 공격 → HP 감소 (${hp0} → ${st.p.hp})`, st.p.hp < hp0);
}

// 6) 처치 → 점수·웨이브 진행·GO 게이트
{
  const st = arena();
  const e = spawn(st, st.p.x + 26, st.p.z, 8);
  st.waveIdx = 1;                                 // 마지막 웨이브로 설정
  st.p.face = 1;
  const evs = [];
  evs.push(...L.step(st, DT, { atk: true }));
  evs.push(...run(st, 3));
  check('처치 → 점수 이벤트', evs.some((ev2) => ev2.type === 'edown') && st.score >= 100);
  check('적 전멸 → GO 개방', evs.some((ev2) => ev2.type === 'go') && st.go === true);
  const x1 = st.stage.sections[0].x1;
  run(st, 30, { right: true });
  check('GO 후 다음 구간 진입 + 새 웨이브', st.secIdx === 1 && st.enemies.length > 0);
}

// 7) 꼬꼬: 적을 추격·공격, 다운 후 부활
{
  const st = L.create(1);
  st.enemies = [];
  const e = spawn(st, st.b.x + 90, st.b.z, 30);
  e.atkCd = 999;
  const bx0 = st.b.x;
  const evs = run(st, 4);
  check('꼬꼬가 적을 추격·공격', evs.some((ev2) => ev2.type === 'swing' && ev2.buddy) && e.hp < e.maxHp);
  st.b.hp = 0; st.b.state = 'down'; st.b.stT = 0;
  const evs2 = run(st, 8.5);
  check('꼬꼬 다운 → 6초 후 부활', evs2.some((ev2) => ev2.type === 'buddyup') && st.b.hp > 0);
}

// 8) 츄르 회복
{
  const st = arena();
  st.p.hp = 40;
  st.items.push({ x: st.p.x, z: st.p.z, ttl: 5 });
  const evs = run(st, 0.2);
  check('츄르 픽업 → +30 HP', evs.some((ev2) => ev2.type === 'pickup') && st.p.hp === 70);
}

// 9) 플레이어 사망 → 컨티뉴(구간 재시작)
{
  const st = arena();
  st.p.hp = 1;
  const e = spawn(st, st.p.x + 24, st.p.z);
  e.atkCd = 0; e.baseAtkCd = 0.4;
  const evs = run(st, 4);
  check('HP 0 → 게임 오버', st.phase === 'over' && evs.some((ev2) => ev2.type === 'over') && st.deaths === 1);
  L.respawn(st);
  check('컨티뉴 → 구간 재시작 (HP 회복·적 리스폰)', st.phase === 'play' && st.p.hp === st.p.maxHp && st.enemies.length > 0);
}

// 10) 보스 격파 → 미션 클리어 + 별점
{
  const st = L.create(1);
  st.secIdx = 3; st.waveIdx = 0; st.enemies = []; st.bossSpawned = false;
  st.b.hp = 0; st.b.state = 'dead'; st.b.reviveT = -999;
  const evs = run(st, 0.5);
  check('보스 등장 이벤트', evs.some((ev2) => ev2.type === 'bossintro') && st.enemies.some((e) => e.boss));
  const boss = st.enemies.find((e) => e.boss);
  boss.hp = 1; boss.spd = 0; boss.atkCd = 999; boss.baseAtkCd = 999;
  boss.x = st.p.x + 26; boss.z = st.p.z;
  st.p.face = 1;
  const evs2 = [];
  evs2.push(...L.step(st, DT, { atk: true }));
  evs2.push(...run(st, 3));
  check('보스 격파 → 미션 클리어', st.phase === 'clear' && evs2.some((ev2) => ev2.type === 'clear'));
  check('별점 (사망 0 + 꼬꼬 다운 0 기준 반영)', st.stars >= 1 && st.stars <= 3);
}

// 10-b) 무기 리치: 원거리(40px)도 명중, 60px는 빗나감
{
  const st = arena();
  const eFar = spawn(st, st.p.x + 44, st.p.z);
  const eTooFar = spawn(st, st.p.x + 62, st.p.z);
  st.p.face = 1;
  run(st, 0.3, { atk: true });
  check('무기 리치 — 44px 명중', eFar.hp < eFar.maxHp);
  check('무기 리치 — 62px 빗나감', eTooFar.hp === eTooFar.maxHp);
}

// 10-c) 무쌍기: HP 소모 + 광역 다운 + 무적
{
  const st = arena();
  const e1 = spawn(st, st.p.x + 50, st.p.z, 100);
  const e2 = spawn(st, st.p.x - 50, st.p.z + 15, 100);
  const eFar = spawn(st, st.p.x + 200, st.p.z, 100);
  const hp0 = st.p.hp;
  const evs = L.step(st, DT, { special: true });
  check('무쌍기 발동 (HP -10, 양방향 광역 다운)', evs.some((v) => v.type === 'musou' && v.n === 2) &&
    st.p.hp === hp0 - 10 && e1.state === 'down' && e2.state === 'down' && eFar.state !== 'down');
  check('무쌍 시전 무적', st.p.iv > 0.5);
  const evs2 = L.step(st, DT, { special: true });
  check('무쌍 쿨다운 중 재발동 불가', !evs2.some((v) => v.type === 'musou'));
}

// 10-d) 궁수: 거리 유지 + 화살 발사 → 명중, 화살은 시간에 소멸
{
  const st = arena();
  const a = spawn(st, st.p.x + 140, st.p.z, 30);
  a.type = 'archer'; a.spd = 52; a.atkCd = 0; a.baseAtkCd = 2.1; a.dmg = 8;
  st.p.iv = 0;
  const evs = run(st, 1.5);
  check('궁수 화살 발사', evs.some((v) => v.type === 'arrow'));
  check('화살 명중 → 피격', evs.some((v) => v.type === 'arrowhit' && v.who === 'p') && st.p.hp < st.p.maxHp);
}

// 11) 결정성
{
  const a = L.create(2), b = L.create(2);
  run(a, 3, { right: true }); run(b, 3, { right: true });
  check('시뮬 결정성', a.p.x === b.p.x && a.enemies.length === b.enemies.length &&
    a.enemies.every((e, i) => e.x === b.enemies[i].x && e.hp === b.enemies[i].hp));
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
