// sim-test.mjs — 로직 단독 검증: 배치 도달성 · 공정 규칙 · 키위 · 컨베이어 · 봇 완주 점수
// 사용: node mogusongpyeon/test/sim-test.mjs
import './shim.mjs';
import { makeBot } from './bot.mjs';

const M = window.MSP, L = M.Logic, T = M.TILE;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const NONE = { mx: 0, my: 0 };
const run = (st, sec, inp = NONE) => { const evs = []; for (let i = 0; i < sec * 60; i++) evs.push(...L.step(st, 1 / 60, inp)); return evs; };

// 모구를 칸 (c,r) 중심에 두고 (fx,fy)를 바라보게
const place = (st, c, r, fx, fy) => { Object.assign(st.p, { x: (c + 0.5) * T, y: (r + 0.5) * T, fx, fy }); };
const grab = (st) => L.step(st, 1 / 60, { mx: 0, my: 0, grab: true });

// ══ 1. 배치: 16×9 · 쓰는 칸이 모두 시작 칸에서 닿는다 ══
M.STAGES.forEach((S, i) => {
  check(`스테이지 ${i + 1} 크기 16×9`, S.map.length === 9 && S.map.every((r) => r.length === 16), S.map.map((r) => r.length).join(','));
  const st = L.create(1, i, 'normal');
  check(`스테이지 ${i + 1} 시작 칸은 바닥`, L.isWalk(L.tileAt(st, S.sx, S.sy)));
  const reach = new Set();
  M.bfs(st, S.sx, S.sy, (c, r) => { reach.add(r * 16 + c); return false; });
  const bad = [];
  for (const row of st.grid) for (const t of row) {
    if (['floor', 'door', 'wall', 'counter'].includes(t.kind)) continue;
    if (t.kind === 'belt') continue;
    const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => reach.has((t.r + dr) * 16 + t.c + dc));
    if (!ok) bad.push(`${t.ch}@${t.c},${t.r}`);
  }
  check(`스테이지 ${i + 1} 설비 전부 손이 닿음`, bad.length === 0, bad.join(' '));
  const need = ['plates', 'serve', 'trash', 'board', 'steamer'];
  check(`스테이지 ${i + 1} 필수 설비 있음`, need.every((k) => st.grid.flat().some((t) => t.kind === k)));
  const crates = st.grid.flat().filter((t) => t.kind === 'crate').map((t) => M.CRATE[t.ch]);
  check(`스테이지 ${i + 1} 주문 재료 통 모두 있음`,
    S.doughs.every((c) => crates.some((x) => x.c === c)) && S.fillings.every((f) => crates.some((x) => x.f === f)));
  if (S.kiwi) check(`스테이지 ${i + 1} 키위 뒷문 있음`, !!st.door);
});

// ══ 2. 공정: 반죽 → 피 → 소 → 생송편 → 찜 → 접시 → 출하 ══
{
  const st = L.create(7, 0, 'normal');
  st.orders = [{ id: 1, items: [{ c: 'white', f: 'sesame' }], t: 60, max: 60, cust: 'penguin' }];
  st.nextOrderAt = 999;
  place(st, 1, 1, 0, -1); grab(st);                       // (1,0) 흰 반죽 통
  check('반죽 통 → 흰 반죽을 든다', st.p.held && st.p.held.t === 'dough' && st.p.held.c === 'white');
  place(st, 9, 1, 0, -1); grab(st);                       // (9,0) 도마
  const board = L.tileAt(st, 9, 0);
  check('도마에 반죽을 올린다', board.item && board.item.t === 'dough' && !st.p.held);
  run(st, 0.6, { mx: 0, my: 0, work: true });
  check('빚기 0.6초 = 아직 반죽', board.item.t === 'dough' && board.work > 0.5);
  run(st, 0.7, { mx: 0, my: 0, work: true });
  check('빚기 1.2초 → 송편피', board.item.t === 'skin' && !board.item.fill);
  place(st, 4, 1, 0, -1); grab(st);                       // (4,0) 깨 통 — 빈손
  check('깨 통 → 깨 소를 든다', st.p.held && st.p.held.t === 'filling');
  place(st, 9, 1, 0, -1); grab(st);
  check('피 위에 소를 얹는다', board.item.t === 'skin' && board.item.fill === 'sesame' && !st.p.held);
  run(st, 1.0, { mx: 0, my: 0, work: true });
  check('다시 빚기 → 반달 생송편', board.item.t === 'raw' && board.item.f === 'sesame');
  grab(st);
  place(st, 14, 1, 0, -1); grab(st);                      // (14,0) 찜기
  const stm = L.tileAt(st, 14, 0);
  check('찜기에 생송편을 넣는다', stm.steam.length === 1 && !st.p.held);
  grab(st);
  check('덜 익은 송편은 꺼낼 수 없다', !st.p.held && stm.steam.length === 1);
  const evs = run(st, M.COOK_T);
  check('7초 찌면 익음 이벤트', evs.some((e) => e.type === 'cooked'));
  place(st, 1, 3, -1, 0); grab(st);                       // (0,3) 접시
  check('접시를 든다', st.p.held && st.p.held.t === 'plate');
  place(st, 14, 1, 0, -1); grab(st);
  check('접시로 찜기의 익은 송편을 담는다', st.p.held.songs.length === 1 && stm.steam.length === 0);
  place(st, 14, 3, 1, 0);
  const before = st.score;
  const ev2 = L.step(st, 1 / 60, { mx: 0, my: 0, grab: true });   // (15,3) 출하구
  check('출하 → 주문 완료 + 점수', ev2.some((e) => e.type === 'serve') && st.score > before && st.orders.length === 0, `+${st.score - before}`);
}

// ══ 3. 피를 들고 소 통에 대면 바로 소가 얹힌다 · 타는 송편 · 오답 ══
{
  const st = L.create(3, 0, 'normal');
  st.nextOrderAt = 999;
  st.p.held = { t: 'skin', c: 'white', fill: null };
  place(st, 4, 1, 0, -1); grab(st);
  check('피를 들고 소 통 → 소 얹힘', st.p.held.fill === 'sesame');
  const stm = L.tileAt(st, 14, 0);
  stm.steam.push({ c: 'white', f: 'sesame', cook: 0, burnt: false });
  const evs = run(st, M.COOK_T + M.BURN_T + 0.1);
  check('너무 오래 찌면 탄다', evs.some((e) => e.type === 'burnt') && stm.steam[0].burnt);
  st.p.held = { t: 'raw', c: 'white', f: 'sesame' };
  place(st, 14, 1, 0, -1); grab(st);
  check('탄 송편이 든 찜기엔 새로 못 넣는다', st.p.held && st.p.held.t === 'raw');
  st.p.held = null; grab(st);
  check('빈손으로 탄 송편을 꺼낸다', st.p.held && st.p.held.t === 'burnt' && stm.steam.length === 0);
  place(st, 8, 2, 0, 1); grab(st);                        // (8,3) 쓰레기통
  check('쓰레기통에 버린다', !st.p.held);
  st.orders = [{ id: 1, items: [{ c: 'white', f: 'sesame' }], t: 60, max: 60, cust: 'chick' }];
  st.p.held = { t: 'plate', songs: [{ c: 'white', f: 'sesame', hole: true }] };
  place(st, 14, 3, 1, 0);
  const ev = L.step(st, 1 / 60, { mx: 0, my: 0, grab: true });
  check('구멍 난 송편은 주문으로 안 받는다', ev.some((e) => e.type === 'wrong' && e.hole) && st.orders.length === 1);
}

// ══ 3-1. 빚기 키 편의: 반죽을 든 채 빈 도마 → 올리고 바로 빚기 · 못 빚으면 이유 안내 ══
{
  const st = L.create(4, 0, 'normal');
  st.nextOrderAt = 999;
  st.p.held = { t: 'dough', c: 'white' };
  place(st, 9, 1, 0, -1);
  const ev0 = L.step(st, 1 / 60, { mx: 0, my: 0, work: true, workEdge: true });
  const board = L.tileAt(st, 9, 0);
  check('반죽을 든 채 빚기 → 도마에 올라감', !st.p.held && board.item && board.item.t === 'dough' && ev0.some((e) => e.type === 'place'));
  run(st, 1.3, { mx: 0, my: 0, work: true });
  check('그대로 꾹 누르면 송편피', board.item.t === 'skin');
  const ev1 = L.step(st, 1 / 60, { mx: 0, my: 0, work: true, workEdge: true });
  check('소 없는 피에 빚기 → "소를 먼저" 안내', ev1.some((e) => e.type === 'work-hint' && e.why === 'need-fill'));
  place(st, 7, 5, 0, 1);
  const ev2 = L.step(st, 1 / 60, { mx: 0, my: 0, work: true, workEdge: true });
  check('도마 아닌 곳에서 빚기 → 안내', ev2.some((e) => e.type === 'work-hint' && e.why === 'no-board'));
  const ev3 = L.step(st, 1 / 60, { mx: 0, my: 0, work: true });
  check('안내는 누른 순간 한 번만', !ev3.some((e) => e.type === 'work-hint'));
}

// ══ 3-2. 출하구 편의: 송편 한 개를 손에 들고 내도 받는다 · 못 내는 이유 안내 · 비스듬히 서도 닿음 ══
{
  const st = L.create(6, 0, 'normal');
  st.nextOrderAt = 999;
  st.orders = [{ id: 1, items: [{ c: 'white', f: 'sesame' }], t: 60, max: 60, cust: 'pigeon' }];
  st.p.held = { t: 'song', c: 'white', f: 'sesame', hole: false };
  place(st, 14, 3, 1, 0);
  const ev = grab(st);
  check('익은 송편 한 개를 손에 들고 출하 → 주문 완료', ev.some((e) => e.type === 'serve') && !st.p.held && st.orders.length === 0);
  st.p.held = { t: 'raw', c: 'white', f: 'sesame' };
  const ev2 = grab(st);
  check('안 찐 송편 출하 → "아직 안 쪘어요" 안내', ev2.some((e) => e.type === 'serve-hint' && e.why === 'not-cooked') && st.p.held);
  st.p.held = { t: 'song', c: 'white', f: 'sesame', hole: false };
  st.orders = [{ id: 2, items: [{ c: 'white', f: 'sesame' }], t: 60, max: 60, cust: 'pigeon' }];
  place(st, 14, 3, 0.3, 0.95);                          // 출하구 옆 칸에서 아래쪽을 보고 있어도
  const ft = L.facingTile(st);
  check('출하구 옆에서 거의 아래를 봐도 앞이 비면 출하구를 잡는다', ft && ft.kind === 'serve', ft ? ft.kind : 'null');
  const ev3 = grab(st);
  check('그 자세로 집기 → 출하', ev3.some((e) => e.type === 'serve'));
  place(st, 14, 3, -1, 0);
  check('등진 쪽 설비는 잡지 않는다', L.facingTile(st) === null || L.facingTile(st).kind !== 'serve');
  place(st, 14, 3, 0.9, 0.4);
  check('출하구 쪽으로 기울면 출하구가 잡힌다', L.facingTile(st)?.kind === 'serve');
}

// ══ 4. 주문 시간 초과 · 콤보 ══
{
  const st = L.create(5, 1, 'normal');
  const evs = run(st, 140);
  check('주문이 들어온다', st.orderSeq >= 3, `${st.orderSeq}건`);
  check('안 만들면 시간 초과', evs.some((e) => e.type === 'miss') && st.missed > 0, `놓침 ${st.missed}`);
}

// ══ 5. 컨베이어: 올린 송편이 끝 칸까지 간다 ══
{
  const st = L.create(9, 3, 'normal');
  st.nextOrderAt = 999;
  st.p.held = { t: 'dough', c: 'pink' };
  place(st, 6, 2, 1, 1);                                  // (7,3) 벨트 첫 칸을 대각으로
  st.p.fx = 0.7; st.p.fy = 0.7;
  const ft = L.facingTile(st);
  place(st, 6, 3, 1, 0); grab(st);
  const b0 = L.tileAt(st, 7, 3), bEnd = L.tileAt(st, 9, 3);
  check('벨트에 반죽을 올린다', b0.item && b0.item.t === 'dough', ft ? ft.kind : '');
  run(st, M.BELT_T * 2 + 0.2);
  check('벨트 끝 칸에 도착', bEnd.item && bEnd.item.c === 'pink' && !b0.item);
  run(st, 3);
  check('끝 칸에서 멈춘다', bEnd.item && bEnd.item.c === 'pink');
}

// ══ 6. 키위: 들어와 송편에 구멍 → 부딪치면 쫓겨남 ══
{
  const st = L.create(11, 2, 'normal');
  st.nextOrderAt = 999;
  const ctr = L.tileAt(st, 4, 2);                         // (4,2) 조리대
  ctr.item = { t: 'song', c: 'white', f: 'bean', hole: false };
  place(st, 12, 7, 0, 1);
  st.nextKiwiAt = st.t + 0.01;
  let evs = run(st, 1);
  check('키위가 뒷문으로 들어온다', evs.some((e) => e.type === 'kiwi-in') && st.kiwis.length === 1);
  evs = run(st, 12);
  check('키위가 송편에 구멍을 낸다', evs.some((e) => e.type === 'peck') && ctr.item.hole === true);
  const k = st.kiwis[0];
  if (k) {
    place(st, Math.floor(k.x / T), Math.floor(k.y / T), 0, 1);
    evs = run(st, 0.1);
    check('모구가 부딪치면 키위가 달아난다', evs.some((e) => e.type === 'shoo') && st.shooed === 1);
    place(st, 12, 7, 0, 1);
    run(st, 8);
    check('달아난 키위는 사라진다', st.kiwis.length === 0 || st.kiwis.every((x) => x !== k));
  } else check('키위가 남아 있어야 쫓을 수 있다', false);
}

// ══ 7. 직렬 봇 완주 — 모든 스테이지 · 난이도에서 점수가 난다 ══
console.log('\n봇 점수 (시드 3개 평균) — 별 기준과 비교');
for (let i = 0; i < M.STAGES.length; i++) {
  for (const d of M.DIFF_ORDER) {
    const scores = [];
    let served = 0, missed = 0;
    for (const seed of [101, 202, 303]) {
      const st = L.create(seed, i, d);
      const bot = makeBot(st);
      let n = 0;
      while (st.phase === 'play' && n++ < 400 * 60) L.step(st, 1 / 60, bot());
      scores.push(st.score); served += st.served; missed += st.missed;
    }
    const avg = Math.round(scores.reduce((a, b) => a + b) / scores.length);
    const th = L.thresholds(i, d);
    console.log(`  S${i + 1} ${d.padEnd(6)} 평균 ${String(avg).padStart(4)}  [${scores.join(',')}]  완료 ${served} 놓침 ${missed}  별 ${th.join('/')}`);
    if (d === 'normal') {
      check(`S${i + 1} 노말: 직렬 봇도 별 1개 이상`, avg >= th[0], `${avg} ≥ ${th[0]}`);
      check(`S${i + 1} 노말: 직렬 봇은 별 3개 미만 (사람 몫을 남긴다)`, avg < th[2], `${avg} < ${th[2]}`);
    }
  }
}

console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
