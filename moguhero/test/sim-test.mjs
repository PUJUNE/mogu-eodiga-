// sim-test.mjs — 로직 단독 검증: 하루 시간 · 수련 · 알바 · 상점 · 타로 · 잠 · 침공 · 되감기 · 마을 충돌 · 전투 · 봇 30일 밸런스
// 사용: node moguhero/test/sim-test.mjs
import { season } from './season.mjs';

const M = window.MHR, G = M.Game, B = M.Battle;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const DT = 1 / 30;

// ══ 1. 하루 시간 · 수련 · 알바 ══
{
  const g = G.create('normal', 3);
  g.gold = 500;
  const r = G.train(g, 'atk');
  check('수련: 3시간 · 수련비 · 힘 +2(대성공 +4)', r.ok && g.hour === 11 && g.gold === 500 - 20 && (g.atk === 7 || g.atk === 9));
  check('수련비는 받을수록 오른다', M.trainCost(g.trains.atk) > 20);
  g.hour = 20;
  check('22시를 넘기는 행동은 못 한다', !G.train(g, 'agi').ok && !G.work(g).ok);
  g.hour = 8;
  const p1 = G.work(g).pay; g.day = 20; g.hour = 8; const p20 = G.work(g).pay;
  check('알바비는 날이 갈수록 오른다', p20 > p1 * 1.8, `${p1} → ${p20}`);
}

// ══ 2. 상점 · 타로 ══
{
  const g = G.create('normal', 4);
  g.gold = 100;
  check('금화가 모자라면 못 산다', !G.buy(g, 'bone').ok);
  g.gold = 5000;
  check('능력치가 모자라면 못 산다 (생선뼈 단검 = 힘 10)', !G.buy(g, 'bone').ok && g.gold === 5000);
  g.atk = 10;
  check('사면 바로 장착', G.buy(g, 'bone').ok && g.weapon === 'bone' && g.gold === 5000 - 120);
  G.buy(g, 'box');
  check('옷: 방어·체력', G.hero(g).def === 12 && G.hero(g).maxHp > M.BASE.hp + 25);
  check('회복약 최대 5개', (() => { for (let i = 0; i < 9; i++) G.buy(g, 'potion'); return g.potions === M.POTION.max; })());
  const t = G.drawTarot(g);
  check('타로는 하루 한 장', t.ok && !G.drawTarot(g).ok);
  g.tarot = { day: g.day, id: 'sun' }; const sun = G.goldMul(g);
  g.tarot = { day: g.day, id: 'fool' };
  check('태양 카드 = 금화 +30%', Math.abs(sun / G.goldMul(g) - 1.3) < 1e-9);
  g.tarot = { day: g.day - 1, id: 'str' };
  check('어제 카드는 오늘 효과 없음', G.card(g) === null);
}

// ══ 3. 잠 · 침공 · 되감기 · 물러서기 ══
{
  const g = G.create('normal', 5);
  const s = G.sleep(g);
  check('잠 → 다음 날 08시', s.ok && g.day === 2 && g.hour === 8);
  g.day = 8; g.hour = 10; g.snap = G.snapshot(g); g.gold = 999;
  check('8일째 18시 전엔 침공 없음', G.invasionDue(g) === null);
  g.hour = 18;
  check('8일째 18시 → 들개 깡패단', G.invasionDue(g)?.name === '들개 깡패단');
  const sl = G.sleep(g);
  check('침공 날은 자려 해도 먼저 쳐들어온다', !sl.ok && sl.invasion && g.day === 8);
  G.rollback(g);
  check('되감기 → 그날 아침 상태 (시간·금화) · 되감기 수는 남는다', g.day === 8 && g.hour === 10 && g.gold !== 999 && g.stats.rollbacks === 1);
  g.gold = 1000; const c = G.concede(g, G.invasionToday(g));
  check('물러서기 → 금화 30% 빼앗기고 그 침공은 끝', c.lost === 300 && G.invasionToday(g) === null);
  g.day = 30; const F = G.invasionToday(g);
  check('30일째 = 그림자 고양이', F && F.final);
  G.concede(g, F);
  check('마지막을 물러서면 7일 뒤 다시 온다', g.finalDay === 37 && G.invasionToday(g) === null);
}

// ══ 4. 마을 충돌 ══
{
  const H = M.BUILDINGS.home;
  const [x, y] = M.Village.push(H.x, H.y + 0.2);
  check('건물 안으로는 못 들어간다', Math.abs(x - H.x) >= H.w / 2 || Math.abs(y - H.y) >= H.d / 2);
  check('문 앞 = 그 건물', M.Village.nearDoor(M.BUILDINGS.dojo.door[0], M.BUILDINGS.dojo.door[1] + 0.3) === 'dojo');
  const [ex] = M.Village.push(99, 0);
  check('섬 밖으로는 못 나간다', ex < M.ISLAND);
}

// ══ 5. 전투 ══
const spec = (over = {}) => Object.assign(G.dungeonSpec(G.create(), 0), over);
function arena(over = {}) {
  const g = G.create('normal', 9); g.atk = 20;
  const b = B.create(g, spec(over), 11);
  b.spawned = 99;                     // 자동 스폰 막고 손으로 배치
  return b;
}
{
  // 3타 콤보: 세 번째가 가장 세고 밀어낸다
  const b = arena();
  const m = B.spawn(b); b.spawned = 99; Object.assign(m, { x: 0, y: 2.4, hp: 1e6, maxHp: 1e6, st: 99 });
  b.hero.x = 0; b.hero.y = 3.5; b.hero.fx = 0; b.hero.fy = -1;
  const dmgs = [];
  for (let i = 0; i < 90 && dmgs.length < 3; i++) {
    for (const e of B.step(b, DT, { attack: !b.hero.act })) if (e.type === 'hit') dmgs.push(e.dmg);
    m.st = 99; m.x = 0; m.y = 2.4; m.vx = m.vy = 0;
  }
  check('3타 콤보 — 세 번째 타격이 가장 아프다', dmgs.length === 3 && dmgs[2] > dmgs[0] * 1.5, dmgs.join(' → '));
}
{
  // 회오리: 주변 여러 마리
  const b = arena();
  for (const [x, y] of [[1.5, 3.5], [-1.5, 3.5], [0, 2]]) { const m = B.spawn(b); Object.assign(m, { x, y, st: 99 }); }
  b.spawned = 99;
  let hits = 0;
  for (let i = 0; i < 20; i++) for (const e of B.step(b, DT, { skill: i === 0 })) if (e.type === 'hit') hits++;
  check('냥냥 회오리 — 둘러싼 몬스터를 한 번에', hits === 3);
  check('회오리 뒤엔 대기 시간', b.hero.skillCd > 0);
}
{
  // 냥보 무적: 몬스터가 내려치는 순간 냥보면 안 맞는다
  const run = (dash) => {
    const b = arena();
    const m = B.spawn(b); b.spawned = 99; Object.assign(m, { x: 0, y: 2.6, state: 'windup', st: 0.1 });
    b.hero.x = 0; b.hero.y = 3.5;
    const hp0 = b.hero.hp;
    for (let i = 0; i < 6; i++) B.step(b, DT, { dash: dash && i === 0, mx: 1, my: 0 });
    return b.hero.hp < hp0;
  };
  check('가만히 있으면 맞는다', run(false));
  check('냥보(무적 시간)로 피한다', !run(true));
}
{
  // 보스 빨간 원
  const b = arena();
  b.killed = b.spec.kills;
  B.step(b, DT, {});
  check('졸개를 다 잡으면 보스 등장', !!b.boss);
  b.boss.slamCd = 0; b.boss.x = 0; b.boss.y = 0; b.hero.x = 0; b.hero.y = 3;
  B.step(b, DT, {});
  check('보스가 주인공 발밑에 빨간 원', b.slams.length === 1);
  const hp0 = b.hero.hp; b.boss.st = 99;
  for (let i = 0; i < 40; i++) { B.step(b, DT, {}); b.boss.st = 99; b.boss.x = 0; b.boss.y = -6; }
  check('원 안에 서 있으면 터질 때 맞는다', b.hero.hp < hp0);
  const b2 = arena(); b2.killed = b2.spec.kills; B.step(b2, DT, {}); b2.boss.slamCd = 0; b2.hero.x = 0; b2.hero.y = 3; b2.boss.y = -6; B.step(b2, DT, {});
  const h2 = b2.hero.hp;
  for (let i = 0; i < 40; i++) { B.step(b2, DT, { mx: 1, my: 0 }); b2.boss.st = 99; b2.boss.x = -6; b2.boss.y = -6; }
  check('원 밖으로 걸어 나가면 안 맞는다', b2.hero.hp === h2);
  b2.boss.hp = 1; b2.hero.x = b2.boss.x; b2.hero.y = b2.boss.y + 1.2; b2.hero.fx = 0; b2.hero.fy = -1;
  for (let i = 0; i < 20 && b2.phase === 'fight'; i++) B.step(b2, DT, { attack: true });
  check('보스를 쓰러뜨리면 승리', b2.phase === 'win');
}
{
  const b = arena({ time: 0.1 });
  for (let i = 0; i < 10; i++) B.step(b, DT, {});
  check('제한 시간이 끝나면 시간 초과', b.phase === 'timeout');
  const g = G.create('normal', 1), b3 = B.create(g, spec(), 2);
  for (let i = 0; i < 60; i++) B.step(b3, DT, {});
  b3.exp = 50; B.retreat(b3);
  const out = G.finishBattle(g, b3);
  check('후퇴: 금화는 없고 경험치는 남는다', !out.won && out.gold === 0 && out.exp === 50 && g.gold === 60);
}

// ══ 6. 봇이 30일을 통째로 — 멈춤 없음 · 난이도 효과 · 마지막 보스 ══
const days = {};
let stuck = 0;
for (const d of M.DIFF_ORDER) {
  const ds = [];
  for (const sd of [7, 21]) {
    const r = season(d, sd, 1);
    if (!r.g.finalBeaten) stuck++;
    ds.push(r.g.finalBeaten ? r.g.day - 1 : 99);
  }
  days[d] = ds.reduce((a, b) => a + b) / ds.length;
}
console.log('  그림자 고양이를 이긴 날 (봇 평균):', Object.entries(days).map(([d, v]) => `${M.DIFFS[d].name} ${v.toFixed(0)}일`).join(' · '));
check('모든 난이도에서 언젠가 엔딩에 닿는다 (60일 안)', stuck === 0);
check('어려울수록 늦게 이긴다 (이지 ≤ 노말 ≤ 크레이지)', days.easy <= days.normal && days.normal <= days.crazy);
check('노말에서 잘하는 봇은 30일째에 이긴다', days.normal <= 31);
const weak = season('normal', 7, 0.5);
check('서툰 봇도 연기하면 결국 이긴다', weak.g.finalBeaten, `${weak.g.day - 1}일 · 되감기 ${weak.g.stats.rollbacks}`);

console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
