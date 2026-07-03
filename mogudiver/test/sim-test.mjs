// sim-test.mjs — 헤드리스 시뮬레이션: 유영·산소·발톱·물어 나르기·보스 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDV;
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
// 빈 바다 (어군 비움 + 재보충 차단)
const arena = (no = 1) => {
  const st = L.create(no);
  st.fish = [];
  st.spawnT = 1e9;
  return st;
};
const spawnFish = (st, type, dx, dy, opt) => {
  const F = M.FISH[type];
  const f = Object.assign({
    type, hp: F.hp, dir: -1,
    x: st.p.x + dx, y: st.p.y + dy,
    vx: 0, vy: 0, wob: 0, flipT: 99, fleeT: 0, iv: 0,
    dead: false, deadT: 0, gone: false,
  }, opt);
  st.fish.push(f);
  return f;
};

// 1) 유영: 가속·감속·경계
{
  const st = arena();
  const x0 = st.p.x;
  run(st, 1, { right: true });
  check(`우측 유영 (${x0} → ${st.p.x.toFixed(0)})`, st.p.x > x0 + 50);
  run(st, 1, { down: true });
  check('하강 유영', st.p.y > M.SURF + 40);
  st.p.y = M.SURF + 8;
  run(st, 2, { up: true });
  check('수면 위로 못 나감', st.p.y >= M.SURF - 0.01);
  run(st, 60, { down: true });
  check('바닥 경계', st.p.y <= st.stage.depth - 12 + 0.01);
  const st2 = arena();
  run(st2, 30, { left: true });
  check('좌측 경계', st2.p.x >= 12 - 0.01);
}

// 2) 대시: 속도 증가 + 산소 소모 + 쿨다운
{
  const st = arena();
  st.p.y = 200;
  run(st, 0.2);
  const o0 = st.p.o2;
  const evs = run(st, 0.05, { right: true, dash: true });
  check('대시 발동', evs.some((e) => e.type === 'dash') && st.p.vx > 150);
  check(`대시 산소 소모 (${o0.toFixed(0)} → ${st.p.o2.toFixed(0)})`, st.p.o2 < o0 - 2);
  const evs2 = run(st, 0.1, { right: true, dash: true });
  check('대시 쿨다운 중 재발동 불가', !evs2.some((e) => e.type === 'dash'));
}

// 3) 산소: 잠수 중 감소 + 깊을수록 빠름 + 수면 회복
{
  const st = arena();
  st.p.y = 100;
  const o0 = st.p.o2;
  run(st, 5);
  const shallow = o0 - st.p.o2;
  check(`얕은 곳 산소 감소 (5초에 ${shallow.toFixed(1)})`, shallow > 4 && shallow < 12);
  const st2 = arena();
  st2.p.y = st2.stage.depth - 20;
  run(st2, 5);
  const deep = 100 - st2.p.o2;
  check(`깊은 곳 더 빠른 감소 (${deep.toFixed(1)} > ${shallow.toFixed(1)})`, deep > shallow);
  st2.p.y = M.SURF + 2;
  run(st2, 4);
  check(`수면 회복 (→ ${st2.p.o2.toFixed(0)})`, st2.p.o2 >= 99);
}

// 4) 산소 경고 + 기절 (물었던 것 잃고 보트 복귀)
{
  const st = arena();
  st.p.y = 300; st.p.x = 500;
  st.p.o2 = 26;
  const evs = run(st, 1);
  check('산소 25 이하 경고', evs.some((e) => e.type === 'o2low'));
  st.p.carry = { type: 'bream', name: '도미', score: 120, weight: 0.92 };
  st.p.o2 = 0.5;
  const evs2 = run(st, 1);
  const ft = evs2.find((e) => e.type === 'faint');
  check('산소 고갈 → 기절 (물고기 잃음)', ft && ft.lost === '도미' && st.p.carry === null);
  check('보트 복귀 + 산소 충전', Math.abs(st.p.x - M.BOAT_X) < 1 && st.p.o2 >= L.O2MAX - 1 && st.deaths === 1);
}

// 5) 발톱: 명중 → 처치 → 시체 부유
{
  const st = arena();
  st.p.y = 200; st.p.face = 1;
  const f = spawnFish(st, 'anchovy', 18, 0);
  const evs = run(st, 0.05, { atk: true });
  check('발톱 명중 + 즉살 (멸치 1타)', evs.some((e) => e.type === 'hit') && evs.some((e) => e.type === 'kill') && f.dead);
  const y0 = f.y;
  run(st, 2);
  check(`시체 부유 (y ${y0.toFixed(0)} → ${f.y.toFixed(0)})`, f.y < y0 - 8);
}

// 6) 발톱: 다타수 어종 + 등 뒤 빗나감
{
  const st = arena();
  st.p.y = 200; st.p.face = 1;
  const f = spawnFish(st, 'bream', 18, 0);       // 도미 2타
  run(st, 0.05, { atk: true });
  check('도미 1타 생존', !f.dead && f.hp === 1);
  f.x = st.p.x + 18; f.y = st.p.y; f.iv = 0;     // 넉백 복귀
  st.p.clawCd = 0;
  run(st, 0.05, { atk: true });
  check('도미 2타 처치', f.dead);
  const back = spawnFish(st, 'anchovy', -18, 0); // 등 뒤
  st.p.clawCd = 0;
  run(st, 0.05, { atk: true });
  check('등 뒤 빗나감', !back.dead);
}

// 7) 해파리: 시체 없이 소멸 + 접촉 피해
{
  const st = arena();
  st.p.y = 200; st.p.face = 1;
  spawnFish(st, 'jelly', 16, 0);
  const evs = run(st, 0.05, { atk: true });
  check('해파리 처치 → 녹아 사라짐', evs.some((e) => e.type === 'dissolve') && st.fish.length === 0);
  const j2 = spawnFish(st, 'jelly', 6, 0);
  j2.dir = 0;
  const o0 = st.p.o2;
  const evs2 = run(st, 0.3);
  check(`해파리 접촉 피해 (O₂ ${o0.toFixed(0)} → ${st.p.o2.toFixed(0)})`, evs2.some((e) => e.type === 'hurt') && st.p.o2 < o0 - 8);
}

// 8) 물기 → 기동 저하 → 하역
{
  const st = arena();
  st.p.x = 400; st.p.y = 200; st.p.face = 1;
  const f = spawnFish(st, 'bream', 14, 0);
  run(st, 0.05, { atk: true });
  st.p.clawCd = 0;
  f.x = st.p.x + 14; f.y = st.p.y; f.iv = 0;
  const evs = run(st, 0.05, { atk: true });      // 처치 직후 시체가 사거리 안 → 즉시 물기
  evs.push(...run(st, 0.1));
  check('시체 물기', evs.some((e) => e.type === 'grab') && st.p.carry && st.p.carry.type === 'bream');
  // 무게 기동 저하: 같은 시간 가속 비교
  const stA = arena(); stA.p.y = 300;
  const stB = arena(); stB.p.y = 300;
  stB.p.carry = { type: 'ray', name: '가오리', score: 200, weight: 0.85 };
  run(stA, 0.5, { right: true });
  run(stB, 0.5, { right: true });
  check(`물면 느려짐 (${stB.p.vx.toFixed(0)} < ${stA.p.vx.toFixed(0)})`, stB.p.vx < stA.p.vx - 3);
  // 하역
  st.p.x = M.BOAT_X + 10; st.p.y = M.SURF + 5;
  const evs3 = run(st, 0.1);
  const dep = evs3.find((e) => e.type === 'deposit');
  check('보트 하역 (+점수, 카운트)', dep && dep.score === 120 && st.delivered === 1 && st.score === 120 && !st.p.carry);
}

// 9) 할당량 → 보스 등장
{
  const st = arena();
  st.delivered = st.stage.quota - 1;
  st.p.carry = { type: 'bream', name: '도미', score: 120, weight: 0.92 };
  st.p.x = M.BOAT_X; st.p.y = M.SURF + 5;
  const evs = run(st, 0.1);
  check('할당량 달성 이벤트', evs.some((e) => e.type === 'quota'));
  const evs2 = run(st, 2);
  check('보스 등장', evs2.some((e) => e.type === 'bossintro') && st.boss && !st.boss.dead);
}

// 10) 공격어: 추격 + 접촉 피해
{
  const st = arena(6);
  st.p.x = 480; st.p.y = 400; st.p.iv = 0;
  const s = spawnFish(st, 'shark', 100, 0);
  const d0 = Math.abs(s.x - st.p.x);
  run(st, 0.8);
  check(`상어 추격 (거리 ${d0.toFixed(0)} → ${Math.abs(s.x - st.p.x).toFixed(0)})`, Math.abs(s.x - st.p.x) < d0);
  const o0 = st.p.o2;
  const evs = run(st, 3);
  check('상어 접촉 피해', evs.some((e) => e.type === 'hurt') && st.p.o2 < o0);
}

// 11) 보스 spikes: 텔레그래프 → 방사 가시 → 가시 피격
{
  const st = arena(1);
  st.bossSpawned = true;
  L._spawnBoss(st);
  const b = st.boss;
  b.x = st.p.x = 480; b.y = 300; st.p.y = 300; st.p.x = 420;
  b.atkCd = 0.01;
  const evs = run(st, 1.5);
  check('푸구 텔레그래프 → 방사 가시', evs.some((e) => e.type === 'bosstele') && evs.some((e) => e.type === 'spikes') && st.shots.length > 0);
  // 가시 명중
  st.shots = [{ x: st.p.x - 8, y: st.p.y, vx: 60, vy: 0, ttl: 2, dmg: 7, kind: 'spike' }];
  st.p.iv = 0;
  const o0 = st.p.o2;
  const evs2 = run(st, 0.3);
  check(`가시 피격 (O₂ ${o0.toFixed(0)} → ${st.p.o2.toFixed(0)})`, evs2.some((e) => e.type === 'hurt') && st.p.o2 <= o0 - 7);
}

// 12) 보스 charge: 돌진 상태 전이 + 접촉 피해
{
  const st = arena(5);
  st.bossSpawned = true;
  L._spawnBoss(st);
  const b = st.boss;
  b.x = 600; b.y = 500; st.p.x = 420; st.p.y = 500; st.p.iv = 0;
  b.atkCd = 0.01;
  const o0 = st.p.o2;
  const evs = run(st, 2.5);                      // 텔레→돌진→접촉까지 한 구간에서 수집
  check('흰이빨 텔레그래프 → 돌진', evs.some((e) => e.type === 'bossdash'));
  check('돌진 접촉 피해', evs.some((e) => e.type === 'hurt') && st.p.o2 < o0);
}

// 13) 보스 격파 → 클리어 + 별점
{
  const st = arena(1);
  st.bossSpawned = true;
  L._spawnBoss(st);
  const b = st.boss;
  b.x = st.p.x + 20; b.y = st.p.y = 300; st.p.x = b.x - 20; st.p.face = 1;
  b.hp = 1;
  b.atkCd = 99;
  const evs = run(st, 0.05, { atk: true });
  check('보스 마지막 타 → 격파', evs.some((e) => e.type === 'bossdown') && b.dead);
  const evs2 = run(st, 2);
  const cl = evs2.find((e) => e.type === 'clear');
  check(`클리어 ★${cl ? cl.stars : 0} (노기절=3)`, cl && cl.stars === 3 && st.phase === 'clear');
  check('클리어 보너스 점수', st.score >= 3000);
}

// 14) 기절 후 클리어 → 별점 감소
{
  const st = arena(1);
  st.deaths = 2;
  st.bossSpawned = true;
  L._spawnBoss(st);
  st.boss.hp = 1; st.boss.atkCd = 99;
  st.boss.x = st.p.x + 20; st.boss.y = st.p.y;
  run(st, 0.05, { atk: true });
  const evs = run(st, 2);
  const cl = evs.find((e) => e.type === 'clear');
  check(`기절 2회 → ★${cl ? cl.stars : 0}`, cl && cl.stars === 1);
}

// 15) 어군 재보충: 목표 개체수 유지
{
  const st = L.create(1);
  const target = 8 + st.no;
  st.fish = st.fish.filter((f) => M.FISH[f.type].hazard);   // 물고기 전멸시키고
  run(st, 20);
  const alive = st.fish.filter((f) => !f.dead && !M.FISH[f.type].hazard).length;
  check(`어군 재보충 (${alive}/${target})`, alive >= target - 1);
  const jn = st.fish.filter((f) => !f.dead && M.FISH[f.type].hazard).length;
  check(`해파리 유지 (${jn}/${st.stage.jellyN})`, jn >= st.stage.jellyN);
}

// 16) 결정성
{
  const a = L.create(2), b = L.create(2);
  run(a, 5, { right: true, down: true, atk: true });
  run(b, 5, { right: true, down: true, atk: true });
  check('시뮬 결정성', a.p.x === b.p.x && a.p.y === b.p.y && a.fish.length === b.fish.length && a.score === b.score);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
