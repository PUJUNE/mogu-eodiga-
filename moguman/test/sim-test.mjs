// sim-test.mjs — 헤드리스 시뮬레이션: 코어 규칙 전체 흐름 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MGM;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const IDLE = { left: false, right: false, fire: false, jump: false };
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / 0.016); i++) evs.push(...L.step(st, 0.016, input || IDLE));
  return evs;
};

// 1) 낙하·착지
let st = L.create(1);
st.stage.platforms = [];                            // 중간 착지 방지 (바닥 검증)
st.enemies = [M.mkEnemy('mouse', 40, M.FLOOR)];     // 클리어 전환 방지용 1마리
st.player.invul = 99;
st.player.y = 100;
run(st, 1.0);
check('공중 시작 → 바닥 착지', st.player.y === M.FLOOR && st.player.onGround);
st.enemies = [];
run(st, 0.1);
check('적 전멸 시 클리어 전환', st.phase === 'clear');

// 2) 점프 → 상승 후 재착지
st = L.create(1); st.enemies = [M.mkEnemy('mouse', 60, M.FLOOR)];   // 클리어 방지용 1마리
run(st, 0.5);
L.step(st, 0.016, { ...IDLE, jump: true });
let peak = M.FLOOR;
for (let i = 0; i < 80; i++) { L.step(st, 0.016, IDLE); peak = Math.min(peak, st.player.y); }
check(`점프 정점 ${(M.FLOOR - peak).toFixed(0)}px (40px 초과 = 플랫폼 도달)`, M.FLOOR - peak > 40 && M.FLOOR - peak < 60);
check('점프 후 재착지', st.player.y === M.FLOOR);

// 3) 털 발사 → 적 감김 → 털뭉치
st = L.create(1);
st.enemies = [M.mkEnemy('mouse', st.player.x + 50, M.FLOOR)];
st.player.dir = 1;
let evs = run(st, 3.5, { ...IDLE, fire: true });
const e0 = st.enemies[0];
check('털 명중 이벤트 발생', evs.some((e) => e.type === 'fur'));
check('3발 누적 → 털뭉치 완성', e0.state === 'ball' && evs.some((e) => e.type === 'ball'));

// 4) 밀어서 굴리기 → 연쇄 킬 → 클리어
const e2 = M.mkEnemy('mouse', 270, M.FLOOR);        // 굴러갈 경로에 두 번째 적
e2.dir = 1;                                         // 벽 쪽으로 걷게 (플레이어 접촉 간섭 방지)
st.enemies.push(e2);
st.player.invul = 99;                               // 밀러 가는 동안 피격 간섭 방지
const scoreBefore = st.score;
evs = run(st, 1.2, { ...IDLE, right: true });       // 걸어가서 밀기
evs.push(...run(st, 3.0));
check('접촉 → 굴리기 시작', evs.some((e) => e.type === 'kick'));
check('구르는 털뭉치가 적 처치 (+500)', evs.some((e) => e.type === 'kill') && st.score >= scoreBefore + 500);
check('벽 반사 발생', evs.some((e) => e.type === 'bounce'));
evs = run(st, 8.0);
check('털뭉치 소멸 후 스테이지 클리어', st.phase === 'clear');

// 5) 털 방치 → 풀림
st = L.create(1);
st.enemies = [M.mkEnemy('mouse', st.player.x + 50, M.FLOOR)];
st.player.dir = 1;
L.step(st, 0.016, { ...IDLE, fire: true });         // 1발만
run(st, 0.6);
check('1발 감김 → 정지·무해(stun2)', st.enemies[0].fur === 1 && st.enemies[0].state !== 'walk');
evs = run(st, 3.2);
check('방치 시 털 풀림 → 보행 복귀', st.enemies[0].fur === 0 && st.enemies[0].state === 'walk');

// 6) 피격 → 목숨 감소·부활 무적, 3회 → 게임 오버
st = L.create(1);
st.enemies = [M.mkEnemy('mouse', st.player.x, M.FLOOR)];
st.player.invul = 0;
evs = run(st, 0.1);
check('맨몸 적 접촉 → 목숨 감소 + 무적 부활', st.lives === 2 && st.player.invul > 2);
st.player.invul = 0; st.enemies[0].x = st.player.x; run(st, 0.1);
st.player.invul = 0; st.enemies[0].x = st.player.x;
evs = run(st, 0.1);
check('목숨 소진 → 게임 오버', st.phase === 'over' && evs.some((e) => e.type === 'gameover'));

// 7) 분노 타이머
st = L.create(1);
st.player.invul = 9999;                             // 피격 게임오버 간섭 방지
run(st, 51);
check('50초 경과 → 전원 분노', st.angry && st.enemies.every((e) => e.angry));

// 8) 보스전: 소환·피격·격파
st = L.create(10);
check('S10 보스 생성 (왕생쥐)', !!st.boss && st.boss.type === 'kingmouse');
evs = run(st, 6.0);
check('보스가 부하 소환', evs.some((e) => e.type === 'spawn') && st.enemies.length > 0);
const hp0 = st.boss.hp;
st.puffs.push({ x: st.boss.x, y: st.boss.y - 5, w: 8, h: 8, vx: 0, vy: 0, life: 0.2 });
evs = run(st, 0.05);
check('털 명중 → 보스 HP 감소', st.boss.hp === hp0 - 1 && evs.some((e) => e.type === 'bosshit'));
st.boss.hp = 1;
st.puffs.push({ x: st.boss.x, y: st.boss.y - 5, w: 8, h: 8, vx: 0, vy: 0, life: 0.2 });
evs = run(st, 0.05);
check('HP 0 → 보스 격파 + 부하 일소', evs.some((e) => e.type === 'bossdead') && st.enemies.length === 0);
evs = run(st, 2.0);
check('격파 연출 후 클리어 전환', st.phase === 'clear');

// 9) 새: 털 맞으면 추락해 지상형으로
st = L.create(1);
const bird = M.mkEnemy('bird', 160, 142); bird.baseY = 142;
st.enemies = [bird];
run(st, 0.5);
check('새 비행 중 (지상 아님)', bird.y < M.FLOOR - 4);
bird.fur = 2; bird.grounded = true; bird.state = 'stun'; bird.stunT = 0.1;   // 명중 결과 재현
run(st, 4.0);
check('털 맞은 새 → 추락 후 지상 보행', bird.y === M.FLOOR || st.stage.platforms.some((p) => bird.y === p.y));

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
