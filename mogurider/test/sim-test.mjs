// sim-test.mjs — 헤드리스 시뮬레이션: 이동·자동발사·격추·피격·아이템·보스·클리어·결정성 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDR;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 60;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, typeof input === 'function' ? input(st) : (input || IDLE)));
  return evs;
};
const quiet = (st) => { st.wave.rate = 0; st.itemT = 1e9; st.enemies = []; st.items = []; };

// 1) 초기 상태 + 자동 발사
{
  const st = L.create(1, 'normal');
  check('시작 상태 (플레이 / 중앙 / 하트 3 / 레벨 1)',
    st.phase === 'play' && Math.abs(st.p.x - M.W / 2) < 1 && st.p.hearts === 3 && st.p.level === 1 && st.dist === 0);
  const evs = run(st, 1);
  const shots = evs.filter((e) => e.type === 'shoot').length;
  check(`1초 자동 발사 ≈ 6발 (${shots})`, shots >= 6 && shots <= 7);
  run(st, 1);
  check('거리 증가 · 편대 등장', st.dist > 200 && st.enemies.length > 0);
}

// 2) 좌우 이동 · 경계
{
  const st = L.create(2, 'normal'); quiet(st);
  run(st, 0.5, { left: true });
  check('← 이동', st.p.x < M.W / 2 - 100);
  run(st, 3, { left: true });
  check('왼쪽 경계에서 멈춤', st.p.x >= M.PR + 6 - 0.01 && st.p.x < 40);
  run(st, 3, { right: true });
  check('오른쪽 경계에서 멈춤', st.p.x <= M.W - M.PR - 6 + 0.01 && st.p.x > M.W - 40);
  run(st, 1, { targetX: 100 });
  check('드래그 목표 x로 이동', Math.abs(st.p.x - 100) < 4);
}

// 3) 격추 → 코인 드롭 → 자석 수집 → 점수
{
  const st = L.create(3, 'normal'); quiet(st);
  st.enemies.push({ id: 900, kind: 'crow', r: 13, x: st.p.x, bx: st.p.x, y: 200, hp: 1, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  const evs = run(st, 1.5);
  check('불꽃 명중 → 격추 이벤트 + 점수 100', evs.some((e) => e.type === 'kill' && e.kind === 'crow') && st.score >= 100 && st.kills === 1);
  run(st, 4);
  check('코인 낙하 → 자석 수집 (+50)', st.coins === 1 && evs.concat(run(st, 0.1)).length >= 0 && st.score === 150);
}

// 4) 바위구름은 격추 불가 (탄 튕김)
{
  const st = L.create(4, 'normal'); quiet(st);
  st.enemies.push({ id: 901, kind: 'rock', r: 24, x: st.p.x, bx: st.p.x, y: 150, hp: Infinity, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  const evs = run(st, 1);
  check('바위구름 → clank, 격추 없음', evs.some((e) => e.type === 'clank') && !evs.some((e) => e.type === 'kill') && st.enemies.length === 1);
}

// 5) 피격 → 하트 -1 · 레벨 -1 · 무적 / 하트 0 → 게임오버
{
  const st = L.create(5, 'normal'); quiet(st);
  st.p.level = 3;
  st.enemies.push({ id: 902, kind: 'balloon', r: 16, x: st.p.x, bx: st.p.x, y: M.PY - 20, hp: 99, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  let evs = run(st, 0.1);
  check('충돌 → hit · 하트 2 · 레벨 2 · 무적', evs.some((e) => e.type === 'hit') && st.p.hearts === 2 && st.p.level === 2 && st.p.inv > 0);
  st.enemies = [{ id: 903, kind: 'balloon', r: 16, x: st.p.x, bx: st.p.x, y: M.PY - 20, hp: 99, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 }];
  evs = run(st, 0.2);
  check('무적 중엔 추가 피격 없음', !evs.some((e) => e.type === 'hit') && st.p.hearts === 2);
  st.p.inv = 0; st.p.hearts = 1;
  evs = run(st, 0.1);
  check('하트 0 → over 이벤트 + phase over', evs.some((e) => e.type === 'over') && st.phase === 'over');
  run(st, 1.5);
  check('격추 연출 후 deathDone', L.deathDone(st));
}

// 6) 방패 · 츄르 피버 · 생선 레벨업 · 폭탄 · 하트
{
  const st = L.create(6, 'normal'); quiet(st);
  const give = (kind) => { st.items.push({ id: st.nextId++, kind, x: st.p.x, y: M.PY - 10, sw: 0 }); return run(st, 0.05); };
  let evs = give('shield');
  check('방패 획득', st.p.shield === true && evs.some((e) => e.type === 'item' && e.kind === 'shield'));
  st.enemies.push({ id: 904, kind: 'crow', r: 13, x: st.p.x, bx: st.p.x, y: M.PY, hp: 99, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  evs = run(st, 0.05);
  check('방패가 한 번 막아 준다 (하트 유지)', evs.some((e) => e.type === 'shieldbreak') && st.p.hearts === 3 && !st.p.shield);
  st.enemies = []; st.p.inv = 0;
  evs = give('fish'); evs.push(...give('fish'));
  check('생선 2개 → 레벨 3', st.p.level === 3 && evs.filter((e) => e.type === 'levelup').length === 2);
  st.p.level = 5; give('fish');
  check('최대 레벨에서 생선 = 보너스 500', st.p.level === 5 && st.score >= 500);
  evs = give('churu');
  check('츄르 → 피버 시작', evs.some((e) => e.type === 'fever') && st.p.fever > 4.5);
  st.enemies.push({ id: 905, kind: 'crow', r: 13, x: st.p.x, bx: st.p.x, y: M.PY, hp: 99, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  evs = run(st, 0.05);
  check('피버 중 몸통 충돌 = 적 격파 · 무피해', evs.some((e) => e.type === 'kill') && st.p.hearts === 3);
  const fev = run(st, 6);
  check('5초 후 피버 종료', st.p.fever <= 0 && fev.some((e) => e.type === 'feverend'));
  st.p.hearts = 1; give('heart');
  check('하트 아이템 → 하트 +1', st.p.hearts === 2);
  for (let i = 0; i < 4; i++) st.enemies.push({ id: 910 + i, kind: 'balloon', r: 16, x: 40 + i * 80, bx: 0, y: 100, hp: 3, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 });
  evs = give('bomb');
  check('폭탄 → 화면의 적 전멸', evs.some((e) => e.type === 'bomb') && evs.filter((e) => e.type === 'kill').length === 4 && st.enemies.length === 0);
}

// 7) 드론 탄 → 피격
{
  const st = L.create(7, 'normal'); quiet(st);
  st.ebullets.push({ x: st.p.x, y: M.PY - 30, vx: 0, vy: 300, r: 5 });
  const evs = run(st, 0.2);
  check('적 탄 피격 → 하트 -1', evs.some((e) => e.type === 'hit' && e.src === 'bullet') && st.p.hearts === 2);
}

// 8) 보스 등장 → 거리 정지 → 격파 → 진행 재개 · 하트 드롭
{
  const st = L.create(8, 'normal'); quiet(st);
  st.dist = M.BOSSES[0].at - 5;
  let evs = run(st, 0.5);
  check('2,800m → 보스 등장 · 거리 정지', evs.some((e) => e.type === 'boss') && st.boss && Math.floor(st.dist) === M.BOSSES[0].at);
  st.p.inv = 1e9;
  evs = run(st, 5.5, (s) => ({ targetX: s.boss ? s.boss.x : 180 }));
  check('보스 탄막 발사', evs.some((e) => e.type === 'bossfire') && st.boss.hp < st.boss.maxHp);
  st.boss.hp = 1;
  evs = run(st, 2, (s) => ({ targetX: s.boss ? s.boss.x : 180 }));
  check('보스 격파 → bossdead · 점수 · 하트 드롭', evs.some((e) => e.type === 'bossdead') && !st.boss && st.bossIdx === 1 && st.items.some((i) => i.kind === 'heart'));
  const d0 = st.dist; run(st, 1);
  check('격파 후 거리 다시 증가', st.dist > d0 + 50);
}

// 9) 달 착륙 CLEAR
{
  const st = L.create(9, 'normal'); quiet(st);
  st.bossIdx = 4; st.dist = M.CLEAR_DIST - 30;
  const evs = run(st, 1);
  check('12,000m → clear · 보너스 5000', evs.some((e) => e.type === 'clear') && st.phase === 'clear' && st.score >= 5000);
}

// 10) 웨이브·구역·편대 통로 보장
{
  const st = L.create(10, 'normal');
  st.bossIdx = 1; st.dist = 3999; run(st, 0.2);
  check('4,000m → 웨이브 5 · 구역 노을', st.waveNo === 5 && st.zoneIdx === 1);
  let bad = 0;
  for (let k = 0; k < 400; k++) {
    st.enemies = [];
    st.wave = M.makeWave(8, 'crazy');
    L._spawnPattern(st);
    const rocks = st.enemies.filter((e) => e.kind === 'rock').sort((a, b) => a.x - b.x);
    if (rocks.length >= 2) { const gap = (rocks[1].x - rocks[1].r) - (rocks[0].x + rocks[0].r); if (gap < 2 * M.PR + 20) bad++; }
    for (const r of rocks) if (r.x - r.r < -5 || r.x + r.r > M.W + 5) bad++;
  }
  check('바위 벽 400회: 항상 통로 확보', bad === 0);
}

// 11) 무적 봇 완주 + 결정성
{
  const bot = (s) => { s.p.inv = 9; return { targetX: s.boss ? s.boss.x : (s.enemies[0] ? s.enemies[0].x : 180) }; };
  const play = (seed) => { const s = L.create(seed, 'hard'); let n = 0; while (s.phase === 'play' && n++ < 60 * 600) L.step(s, DT, bot(s)); return s; };
  const a = play(77), b = play(77);
  check(`무적 봇 하드 완주 (보스 ${a.bossKills}마리 · ${a.kills}격추)`, a.phase === 'clear' && a.bossKills === 4);
  check('같은 시드 = 같은 결과 (결정성)', a.score === b.score && a.kills === b.kills && a.coins === b.coins);
}

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 시뮬레이션 전체 통과');
process.exit(fail ? 1 : 0);
