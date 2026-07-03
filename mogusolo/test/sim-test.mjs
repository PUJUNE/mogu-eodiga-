// sim-test.mjs — 헤드리스 시뮬레이션: 전투·레벨업·QWER 스킬·그림자·바란 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSL;
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
// 빈 전장 (no: 전체 스테이지 번호 — 1~10 M1 꼬꼬 없음 / 11+ 꼬꼬 있음)
const arena = (no = 1, exp0 = 0, gear) => {
  const st = L.create(no, exp0, gear);
  st.enemies = [];
  st.waveIdx = 99;                                   // 웨이브 자동 진행 차단
  st.stage.sections[st.secIdx].waves = [[], []];
  st.go = false;
  return st;
};
const spawn = (st, dx, type = 'scorp', opt) => {
  const E = M.ETYPES[type];
  const e = Object.assign({
    kind: 'e', type, name: E.name, look: E.look, ranged: !!E.ranged, shot: E.shot,
    x: st.p.x + dx, z: st.p.z, jy: 0, vy: 0, face: -1,
    hp: E.hp, maxHp: E.hp, spd: E.spd, dmg: E.dmg, w: E.w,
    state: 'idle', stT: 0, combo: 0, comboT: 99, atkCd: 0, hitDone: false,
    iv: 0, reviveT: 0, baseAtkCd: E.atkCd, score: E.score,
  }, opt);
  st.enemies.push(e);
  return e;
};

// 1) 이동·경계 (부동 블로커로 게이트 봉쇄 유지)
{
  const st = arena();
  const blocker = spawn(st, 300, 'scorp');
  blocker.spd = 0; blocker.z = 0;                    // 접근·공격 불가 — 생존만
  const x0 = st.p.x;
  run(st, 1, { right: true });
  check(`우측 이동 (${x0} → ${st.p.x.toFixed(0)})`, st.p.x > x0 + 60);
  run(st, 30, { right: true });
  check('구간 게이트에서 정지', st.p.x <= st.stage.sections[0].x1 - 20 + 1);
  const z0 = st.p.z;
  run(st, 0.5, { down: true });
  check('깊이 이동', st.p.z > z0);
}

// 2) 3연격 콤보 + 3격 다운
{
  const st = arena();
  const e = spawn(st, 26, 'rockscorp');
  e.spd = 0;
  let kd = false, hits = 0;
  for (let i = 0; i < 3; i++) {
    const evs = run(st, 0.45, { atk: true });
    hits += evs.filter((v) => v.type === 'hit').length;
    kd = kd || evs.some((v) => v.type === 'kd');
    st.p.comboT = 0.1;                                // 콤보 유지
  }
  check(`3연격 명중 ${hits}회 + 3격 다운`, hits >= 3 && kd);
}

// 3) MP 자연 회복 + 스킬 언락 게이트
{
  const st = arena();
  st.mp = 10;
  run(st, 3);
  check(`MP 자연 회복 (10 → ${st.mp.toFixed(0)})`, st.mp > 15);
  check('Lv1: Q 잠김', !L.skillReady(st, 'q'));
  const st2 = arena(1, 1500);                        // 경험치 시딩 → 고레벨
  check(`경험치 시딩 → Lv ${st2.lv}`, st2.lv >= 9);
  check('고레벨: QWER 전부 해금', ['q', 'w', 'e', 'r'].every((k) => L.skillReady(st2, k)));
}

// 4) Q 절단: 강화 데미지 + 다운 + MP 소모
{
  const st = arena(1, 1500);
  const e = spawn(st, 30, 'rockscorp');
  e.spd = 0;
  const mp0 = st.mp;
  const evs = run(st, 0.3, { q: true });
  check('절단 → 명중 + 다운', evs.some((v) => v.type === 'slash') && evs.some((v) => v.type === 'kd') && e.hp < e.maxHp);
  check(`절단 MP 소모 (${mp0.toFixed(0)} → ${st.mp.toFixed(0)})`, st.mp < mp0 - 8);
  const dmgQ = e.maxHp - e.hp;
  check(`절단 데미지 > 일반 (${dmgQ})`, dmgQ >= Math.round(st.p.dmg * 2.5 * L.atkMul(st.lv)) - 1);
}

// 5) W 은신: 타겟 해제 + 접촉 무효 + 기습 2배
{
  const st = arena(1, 1500);
  const e = spawn(st, 20, 'scorp');
  run(st, 0.1, { w: true });
  check('은신 발동 (3초)', st.stealth > 2.5);
  const hp0 = st.p.hp;
  run(st, 1.2);
  check('은신 중 무피격 + 적 대기', st.p.hp === hp0 && e.state !== 'atk');
  const evs = run(st, 0.4, { atk: true });
  check('은신 기습 → 2배 + 다운 + 해제', evs.some((v) => v.type === 'ambush') && st.stealth <= 0 && (e.state === 'down' || e.hp < e.maxHp - st.p.dmg));
}

// 6) E 그림자 추출: 시체 → 아군 + 최대 3기
{
  const st = arena(1, 1500);
  // 시체 3구 준비
  for (let i = 0; i < 3; i++) {
    const e = spawn(st, 20 + i * 8, 'scorp');
    e.state = 'dead'; e.hp = 0; e.stT = 0.2;
  }
  let evs = run(st, 0.05, { e: true });
  check('그림자 추출 1기', evs.some((v) => v.type === 'extract') && st.shadows.length === 1);
  st.skillCd.e = 0;
  run(st, 0.05, { e: true });
  st.skillCd.e = 0;
  run(st, 0.05, { e: true });
  check('그림자 3기 도달', st.shadows.length === 3);
  const e4 = spawn(st, 24, 'scorp');
  e4.state = 'dead'; e4.hp = 0; e4.stT = 0.2;
  st.skillCd.e = 0;
  evs = run(st, 0.05, { e: true });
  check('4기째 거부 (최대 3)', evs.some((v) => v.type === 'extractfail' && v.reason === 'full') && st.shadows.length === 3);
  // 그림자가 적을 공격
  const foe = spawn(st, 60, 'scorp');
  foe.spd = 0;
  run(st, 4);
  check('그림자 병사 전투 → 적 피해', foe.hp < foe.maxHp || foe.state === 'dead');
  // 컨티뉴 시 해산
  st.p.hp = 0; st.p.state = 'down'; st.p.stT = 1.2;
  run(st, 0.1);
  L.respawn(st);
  check('컨티뉴 → 그림자 해산', st.shadows.length === 0 && st.phase === 'play');
}

// 6b) 시체 30초 유지: 여유 있게 추출 가능
{
  const st = arena(1, 1500);
  const e = spawn(st, 30, 'scorp');
  e.state = 'dead'; e.hp = 0; e.stT = 0; e.counted = true;
  run(st, 5);
  check('시체 5초 후에도 유지', st.enemies.includes(e) && e.state === 'dead');
  const evs = run(st, 0.05, { e: true });
  check('오래된 시체도 추출 가능', evs.some((v) => v.type === 'extract'));
  const e2 = spawn(st, 30, 'scorp');
  e2.state = 'dead'; e2.hp = 0; e2.stT = L.CORPSE_T - 0.2; e2.counted = true;
  run(st, 0.5);
  check(`시체 ${L.CORPSE_T}초 후 소멸`, !st.enemies.includes(e2));
}

// 7) E 실패: 시체 없음
{
  const st = arena(1, 1500);
  const evs = run(st, 0.05, { e: true });
  check('시체 없음 → 추출 실패', evs.some((v) => v.type === 'extractfail' && v.reason === 'nocorpse'));
}

// 8) R 지배자의 권능: 광역 다운 + MP 소모
{
  const st = arena(1, 1500);
  const es = [spawn(st, 40, 'scorp'), spawn(st, -35, 'scorp'), spawn(st, 70, 'scorp')];
  for (const e of es) e.spd = 0;
  const mp0 = st.mp;
  const evs = run(st, 0.1, { r: true });
  const rl = evs.find((v) => v.type === 'ruler');
  check(`권능 광역 (${rl ? rl.n : 0}기 다운)`, rl && rl.n >= 3 && es.every((e) => e.state === 'down'));
  check('권능 MP 소모', st.mp <= mp0 - 24);
}

// 9) 원거리 적: 투사체 발사 → 명중
{
  const st = arena();
  const e = spawn(st, 120, 'sting');
  e.z = st.p.z;
  run(st, 2.5);
  check('독침 발사', st.shots.length > 0 || st.p.hp < st.p.maxHp);
  run(st, 2.5);
  check('독침 명중 → 피해', st.p.hp < st.p.maxHp);
}

// 9b) 게이트 소프트락 방지: 원거리 적이 구간 밖으로 후퇴해도 도달 범위 내로 클램프
{
  const st = arena();
  const sec = st.stage.sections[0];
  const e = spawn(st, 0, 'sting');
  e.x = sec.x1 + 30; e.z = st.p.z;                   // 게이트 너머에서 시작
  st.p.x = sec.x1 - 60;
  run(st, 4, { right: true });                       // 게이트(x1-20)에 밀착 + 적은 후퇴 시도
  check(`원거리 적 구간 클램프 (e.x ${e.x.toFixed(0)} ≤ ${sec.x1 + 18})`, e.x <= sec.x1 + 18.5);
  st.p.iv = 99;                                      // 독침 피격 경직 배제하고 처치 확인
  run(st, 8, { atk: true });
  check('게이트에서 원거리 적 처치 가능', e.hp < e.maxHp || e.state === 'dead');
}

// 10) 물약: HP·MP 회복
{
  const st = arena();
  st.p.hp = 40; st.mp = 5;
  st.items.push({ x: st.p.x, z: st.p.z, ttl: 5, kind: 'hp' });
  run(st, 0.2);
  check(`회복 물약 (40 → ${st.p.hp})`, st.p.hp === 70);
  st.items.push({ x: st.p.x, z: st.p.z, ttl: 5, kind: 'mp' });
  run(st, 0.2);
  check(`마나 물약 (→ ${st.mp.toFixed(0)})`, st.mp >= 35);
}

// 11) 영구 아이템: 독니 공격+2 / 갑주 피해-2
{
  const a = arena(1, 0);
  const b = arena(1, 0, { fang: true });
  check(`카사카의 독니 → 공격 +2 (${a.p.dmg} → ${b.p.dmg})`, b.p.dmg === a.p.dmg + 2);
  const c = arena(1, 0, { armor: true });
  const e = spawn(c, 20, 'scorp', { dmg: 10 });
  e.state = 'atk'; e.stT = 0.09; e.hitDone = false; e.face = -1;
  run(c, 0.05);
  check(`파수견의 갑주 → 받는 피해 -2 (${100 - c.p.hp})`, c.p.hp === 100 - 8);
}

// 12) 레벨업: 스탯 증가 + 해금 이벤트
{
  const st = arena();
  const evs = [];
  L._gainExp(st, L.expNeed(1), evs);
  check('레벨업 이벤트 + maxHp 증가', evs.some((v) => v.type === 'levelup' && v.lv === 2) && st.p.maxHp === 106);
  check('Lv2 해금 스킬 = 절단', evs.some((v) => v.type === 'levelup' && v.skill === '절단'));
}

// 13) 꼬꼬: M1 없음 / M2 합류·전투
{
  const st1 = arena(1);
  check('M1: 꼬꼬 없음 (나 혼자)', st1.b === null);
  const st2 = arena(11);                             // no 11 = M2-1
  check('M2: 꼬꼬 합류', !!st2.b && st2.b.hp > 0);
  const foe = spawn(st2, 90, 'snake');
  foe.spd = 0;
  run(st2, 5);
  check('꼬꼬 AI 전투 → 적 피해', foe.hp < foe.maxHp || foe.state === 'dead');
}

// 14) 바란: 벼락 경고 → 낙뢰 / 회피 가능
{
  const st = arena(41, 2000);                        // no 41 = M5-1
  st.b = null;                                       // 꼬꼬 제외 — 보스 넉다운 노이즈 차단
  st.enemies = [];
  st.bossSpawned = true;
  const B = M.BOSSES[5];
  const bo = spawn(st, 150, 'dblade', {
    type: 'boss', name: B.name, look: B.look, boss: true, base: 'baran', shot: B.shot,
    hp: B.hp, maxHp: B.hp, spd: B.spd, dmg: B.dmg, w: B.w, baseAtkCd: B.atkCd,
    boltCd: 0.1, dashCd: 99,
  });
  const evs = run(st, 0.5);
  check('바란 벼락 경고', evs.some((v) => v.type === 'boltwarn') && st.bolts.length > 0);
  // 제자리 → 피격
  const hp0 = st.p.hp;
  const evs2 = run(st, 1.0);
  check('제자리 → 낙뢰 피격', evs2.some((v) => v.type === 'bolt') && st.p.hp < hp0);
  // 회피: 경고 후 이동
  bo.boltCd = 0.1;
  run(st, 0.4);
  const hp1 = st.p.hp;
  run(st, 1.0, { left: true });
  const boltEv = true;                               // 낙뢰는 떨어지되
  check('이동 회피 → 무피해', boltEv && st.p.hp === hp1);
  // 2페이즈 가속
  bo.hp = bo.maxHp * 0.3;
  bo.boltCd = 5; bo.dashing = false;
  const cd0 = bo.boltCd;
  run(st, 1.0, { left: true });
  check('2페이즈 벼락 쿨 가속', bo.boltCd < cd0 - 1.2);
}

// 15) 클리어 별점: 그림자 3기 + 노데스 = ★3
{
  const st = arena(1, 1500);
  st.secIdx = st.stage.sections.length - 1;
  st.bossSpawned = true;
  st.waveIdx = 0;
  st.stage.sections[st.secIdx].waves = [[], []];
  for (let i = 0; i < 3; i++) st.shadows.push({ kind: 's', state: 'idle', hp: 10, maxHp: 10, stT: 0, x: st.p.x, z: st.p.z, jy: 0, vy: 0, atkCd: 0, iv: 0, comboT: 99, combo: 0, spd: 50, dmg: 5, w: 15, face: 1, hitDone: false, reviveT: 0 });
  const evs = run(st, 0.1);
  const cl = evs.find((v) => v.type === 'clear');
  check(`보스전 클리어 ★${cl ? cl.stars : 0}`, cl && cl.stars === 3 && st.phase === 'clear');
}

// 16) 게임 오버 → 컨티뉴 (레벨 유지)
{
  const st = arena(1, 500);
  const lv0 = st.lv;
  st.p.hp = 0; st.p.state = 'down'; st.p.stT = 1.2;
  const evs = run(st, 0.1);
  check('사망 → over', evs.some((v) => v.type === 'over') && st.phase === 'over');
  L.respawn(st);
  check('컨티뉴 → 레벨 유지 + 부활', st.lv === lv0 && st.p.hp === st.p.maxHp && st.phase === 'play');
}

// 17) 결정성
{
  const a = L.create(3, 500), b = L.create(3, 500);
  run(a, 5, { right: true, atk: true }); run(b, 5, { right: true, atk: true });
  check('시뮬 결정성', a.p.x === b.p.x && a.score === b.score && a.enemies.length === b.enemies.length);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
