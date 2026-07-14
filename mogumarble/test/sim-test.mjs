// sim-test.mjs — 모구의 마블 헤드리스 규칙 검증 (node 단독)
// 보드 구성 · 이동/월급 · 구매/업그레이드/통행료 · 인수 · 더블 · 무인도 · 축제 ·
// 특급열차 · 황금열쇠 · 파산 · 도시 독점 승리 · 라운드 제한 · AI 완주 · 결정성
import './shim.mjs';

const M = globalThis.window.MBL;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };

const mk = (n, seed) => L.create({
  players: Array.from({ length: n }, (_, i) => ({ name: M.CHARS[i].name, char: i, human: false })),
  seed: seed || 7,
});
// 강제 주사위로 한 턴 진행 (pending 은 answer 로 응답)
const step = (st, d1, d2, answer) => {
  const evs = L.roll(st, [d1, d2]);
  if (st.phase === 'decision') evs.push(...L.decide(st, answer !== false));
  if (st.phase === 'end') evs.push(...L.endTurn(st));
  return evs;
};

// 1) 보드 구성: 24칸, 도시 3곳 × 6지역, 코너 배치
{
  check('보드 24칸', M.TILES.length === 24);
  const cnt = { wonju: 0, seongnam: 0, suwon: 0 };
  for (const t of M.TILES) if (t.kind === 'city') cnt[t.city]++;
  check(`도시별 6지역 (원주 ${cnt.wonju} · 성남 ${cnt.seongnam} · 수원 ${cnt.suwon})`,
    cnt.wonju === 6 && cnt.seongnam === 6 && cnt.suwon === 6);
  check('코너: 출발/무인도/축제/특급열차', M.TILES[0].kind === 'start' && M.TILES[6].kind === 'island' &&
    M.TILES[12].kind === 'festival' && M.TILES[18].kind === 'express');
  check('황금열쇠 2칸', M.TILES.filter((t) => t.kind === 'key').length === 2);
  const prices = M.TILES.filter((t) => t.kind === 'city').map((t) => t.price);
  check('가격 오름차순 (원주 저가 → 수원 고가)', prices.every((p, i) => i === 0 || p > prices[i - 1]));
}

// 2) 이동 + 구매 + 통행료
{
  const st = mk(2);
  const evs = step(st, 1, 3, true);                     // P0 → 4 한지테마파크 구매
  check('구매: 소유·잔액 차감', st.tiles[4].owner === 0 &&
    st.players[0].money === M.START_MONEY - M.TILES[4].price && evs.some((e) => e.type === 'buy'));
  const evs2 = step(st, 1, 3, false);                   // P1 → 4 통행료
  const toll = Math.round(M.TILES[4].price * M.TOLL_MUL[0]);
  check(`통행료 ${toll} 지불 → 소유주 수령`, evs2.some((e) => e.type === 'toll' && e.amount === toll) &&
    st.players[1].money === M.START_MONEY - toll &&
    st.players[0].money === M.START_MONEY - M.TILES[4].price + toll);
}

// 3) 업그레이드: 내 땅 도착 → 레벨 상승 + 출발 통과 월급 + 더블 추가 턴
{
  const st = mk(2);
  step(st, 1, 3, true);                                 // P0 buy 4 (한지테마파크)
  step(st, 2, 3, false);                                // P1 → 5 패스
  st.players[0].pos = 22;                               // 한 바퀴 돈 상태로 세팅
  const m0 = st.players[0].money;
  step(st, 2, 4, true);                                 // 22+6 → 4 (출발 통과) → 업그레이드
  const cost = L.upCost(4);
  check('업그레이드: 별장 레벨 1', st.tiles[4].level === 1 && st.tiles[4].invested === cost);
  check('월급 수령 (출발 통과)', st.players[0].money === m0 + M.SALARY - cost);
  step(st, 3, 8, false);                                // P1 → 16 패스
  st.players[0].pos = 22;
  step(st, 3, 3, true);                                 // 더블! 22+6 → 4 업그레이드 레벨 2
  check('레벨 2 빌딩', st.tiles[4].level === 2);
  check('더블 → 같은 플레이어 턴 유지', st.turn === 0 && st.phase === 'roll');
}

// 4) 통행료 배율 정밀 검증 (레벨 0~3)
{
  const st = mk(2);
  st.tiles[23].owner = 0;
  for (let lv = 0; lv <= 3; lv++) {
    st.tiles[23].level = lv;
    const expect = Math.round(M.TILES[23].price * M.TOLL_MUL[lv]);
    check(`수원화성 Lv${lv}(${M.LV_NAME[lv]}) 통행료 = ${expect}`, L.toll(st, 23) === expect);
  }
}

// 5) 인수: 통행료 지불 후 (땅값+투자)×2 로 소유권 이전, 호텔 인수 불가
{
  const st = mk(2);
  st.tiles[9].owner = 1; st.tiles[9].level = 1; st.tiles[9].invested = L.upCost(9);
  st.players[0].money = 5000;
  const evs = step(st, 4, 5, true);                     // P0 → 9 모란시장: 통행료 → 인수
  const tc = (M.TILES[9].price + st.tiles[9].invested) * M.TAKEOVER_MUL;
  check(`인수 성공 (비용 ${tc})`, st.tiles[9].owner === 0 && evs.some((e) => e.type === 'takeover' && e.cost === tc));
  const st2 = mk(2);
  st2.tiles[9].owner = 1; st2.tiles[9].level = 3;       // 호텔
  st2.players[0].money = 99999;
  const evs2 = L.roll(st2, [4, 5]);
  check('호텔은 인수 제안 없음 (통행료만)', st2.pending === null && evs2.some((e) => e.type === 'toll'));
}

// 6) 무인도: 도착 → 3턴 대기 / 더블 탈출 / 탈출비 지불
{
  const st = mk(2);
  step(st, 2, 4, false);                                // P0 → 6 무인도
  check('무인도 도착', st.players[0].islandT === M.ISLAND_TURNS && st.turn === 1);
  step(st, 1, 2, false);                                // P1 넘어감
  step(st, 1, 2, false);                                // P0 무인도: 더블 실패 → 대기
  check('더블 실패 → 대기 (남은 2턴)', st.players[0].islandT === 2 && st.turn === 1);
  step(st, 1, 3, false);                                // P1
  const evs = L.roll(st, [3, 3]);                       // P0 더블 → 탈출 + 6칸 이동
  check('더블 탈출 → 이동 (6+6=12 축제)', evs.some((e) => e.type === 'escape' && e.how === 'dice') &&
    st.players[0].pos === 12 && st.players[0].islandT === 0);
  check('탈출 더블은 추가 턴 없음', st.lastDouble === false);
  if (st.phase === 'end') L.endTurn(st);
  // 탈출비 지불
  const st2 = mk(2);
  step(st2, 2, 4, false);                               // P0 → 무인도
  step(st2, 1, 2, false);                               // P1
  const m0 = st2.players[0].money;
  const evs2 = L.payEscape(st2);
  check(`탈출비 ${M.ESCAPE_FEE} 지불 → 즉시 자유`, st2.players[0].islandT === 0 &&
    st2.players[0].money === m0 - M.ESCAPE_FEE && evs2.some((e) => e.type === 'escape' && e.how === 'pay'));
  step(st2, 1, 3, true);                                // 정상 이동 가능
  check('지불 후 정상 이동', st2.players[0].pos === 10);
}

// 7) 더블 3연속 → 무인도 직행
{
  const st = mk(2);
  step(st, 1, 1, false);                                // 더블 1 (→2 강원감영 패스)
  check('더블 1 → 턴 유지', st.turn === 0);
  step(st, 2, 2, false);                                // 더블 2 (→6 무인도!)... 6은 무인도라 lastDouble 무효
  check('무인도 도착 시 더블 무효', st.turn === 1);
}
{
  const st = mk(2);
  step(st, 1, 1, false);                                // →2
  step(st, 5, 5, false);                                // 더블 2 →12 축제
  check('더블 2 → 턴 유지', st.turn === 0);
  const evs = L.roll(st, [4, 4]);                       // 더블 3연속!
  check('더블 3연속 → 무인도 직행', evs.some((e) => e.type === 'tripledouble') &&
    st.players[0].pos === 6 && st.players[0].islandT === M.ISLAND_TURNS);
  L.endTurn(st);
  check('무인도 직행 후 턴 넘어감', st.turn === 1);
}

// 8) 축제: 내 최고가 지역 통행료 ×2
{
  const st = mk(2);
  st.tiles[4].owner = 0; st.tiles[16].owner = 0;        // 한지(120), 판교(360)
  const evs = step(st, 5, 7, false);                    // P0 → 12 축제
  check('축제 → 최고가(판교)에 마커', st.festivalTile === 16 &&
    evs.some((e) => e.type === 'festival' && e.tile === 16));
  check('축제 통행료 ×2', L.toll(st, 16) === Math.round(M.TILES[16].price * M.TOLL_MUL[0]) * 2);
}

// 9) 특급열차: 출발지로 이동 + 월급
{
  const st = mk(2);
  const m0 = st.players[0].money;
  const evs = step(st, 8, 10, false);                   // P0 → 18 특급열차
  check('특급열차 → 출발지 + 월급', st.players[0].pos === 0 &&
    st.players[0].money === m0 + M.SALARY && evs.some((e) => e.type === 'express'));
}

// 10) 황금열쇠: 카드 효과 (돈/이동/뒤로)
{
  const st = mk(2);
  st.deck = [0]; st.deckPos = 0;                        // lotto +300
  const m0 = st.players[0].money;
  const evs = step(st, 1, 2, false);                    // → 3 황금열쇠
  check('복권 +300', st.players[0].money === m0 + 300 && evs.some((e) => e.type === 'card'));
  const st2 = mk(2);
  st2.deck = [6]; st2.deckPos = 0;                      // 태풍 → 무인도
  step(st2, 1, 2, false);
  check('카드: 무인도 이동', st2.players[0].pos === 6 && st2.players[0].islandT === M.ISLAND_TURNS);
  const st3 = mk(2);
  st3.deck = [8]; st3.deckPos = 0;                      // 뒤로 3칸 → 0 출발 (월급 없음: 후진)
  step(st3, 1, 2, false);
  check('카드: 뒤로 3칸 → 출발지', st3.players[0].pos === 0);
  const st4 = mk(2);
  st4.deck = [7]; st4.deckPos = 0;                      // 치악산 이동 → 구매 제안
  L.roll(st4, [1, 2]);
  check('카드: 치악산 이동 → 구매 제안', st4.players[0].pos === 5 &&
    st4.pending && st4.pending.type === 'buy' && st4.pending.tile === 5);
  L.decide(st4, true); L.endTurn(st4);
  check('카드 이동 후 구매 성공', st4.tiles[5].owner === 0);
}

// 11) 파산: 통행료 못 내면 청산 → 탈락 → 남은 1인 승리
{
  const st = mk(2);
  st.tiles[23].owner = 0; st.tiles[23].level = 3;       // 수원화성 호텔 (통행료 2600)
  st.players[1].money = 100;
  st.players[1].pos = 18;
  st.tiles[1].owner = 1;                                // 청산해도 부족
  const evs = step(st, 2, 3, false);                    // P1 차례로 만들기 위해 먼저 P0 소비
  const evs2 = L.roll(st, [2, 3]);                      // P1: 18+5 → 23 호텔!
  check('청산 발생', evs2.some((e) => e.type === 'liquidate'));
  check('파산 → 탈락', st.players[1].alive === false && evs2.some((e) => e.type === 'bankrupt'));
  check('파산 소유지 무주지로', st.tiles[1].owner === null);
  check('남은 1인 → 즉시 승리', st.phase === 'over' && st.winner === 0 &&
    evs2.some((e) => e.type === 'gameover' && e.reason === 'lastman'));
}

// 12) 도시 독점 → 즉시 승리
{
  const st = mk(3);
  for (const i of [1, 2, 4, 5, 7]) st.tiles[i].owner = 0;   // 원주 5/6
  const evs = step(st, 3, 5, true);                     // P0 → 8 뮤지엄 산 구매 = 원주 독점
  check('도시 독점 → 즉시 승리', st.phase === 'over' && st.winner === 0 &&
    evs.some((e) => e.type === 'monopoly' && e.city === 'wonju') &&
    evs.some((e) => e.type === 'gameover' && e.reason === 'monopoly'));
}

// 13) 라운드 제한 → 총자산 1위 승리
{
  const st = mk(2);
  st.round = M.MAX_ROUNDS;
  st.tiles[23].owner = 1;                               // P1 자산 우세
  step(st, 1, 2, false);                                // P0
  const evs = step(st, 1, 2, false);                    // P1 → 라운드 초과
  check('라운드 제한 → 자산 1위 승리', st.phase === 'over' && st.winner === 1 &&
    evs.some((e) => e.type === 'gameover' && e.reason === 'rounds'));
  check(`총자산 계산 (현금+부동산)`, L.assets(st, 1) > L.assets(st, 0));
}

// 14) AI 휴리스틱: 구매/인수 판단
{
  const st = mk(2);
  L.roll(st, [1, 3]);                                   // → 4 구매 제안
  check('AI: 여유 있으면 구매', M.AI.choose(st) === true);
  L.decide(st, false); L.endTurn(st);
  const st2 = mk(2);
  st2.players[0].money = 130;
  L.roll(st2, [1, 3]);
  check('AI: 자금 빠듯하면 패스', st2.pending && M.AI.choose(st2) === false);
}

// 15) AI 4인 완주: 시드 20개 — 항상 게임 종결 + 승자 존재
{
  let done = 0, guardFail = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = mk(4, seed * 131 + 7);
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 5000) {
      if (st.phase === 'roll') {
        const P = L.cur(st);
        if (P.islandT > 0 && M.AI.wantPayEscape(st)) L.payEscape(st);
        L.roll(st);
      } else if (st.phase === 'decision') L.decide(st, M.AI.choose(st));
      else if (st.phase === 'end') L.endTurn(st);
    }
    if (st.phase === 'over' && st.winner >= 0 && st.ranking.length === 4) done++;
    if (guard >= 5000) guardFail++;
  }
  check(`AI 4인전 20판 완주 (${done}/20)`, done === 20 && guardFail === 0);
}

// 16) 결정성: 같은 시드 = 같은 결과
{
  const play = (seed) => {
    const st = mk(4, seed);
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 5000) {
      if (st.phase === 'roll') { if (L.cur(st).islandT > 0 && M.AI.wantPayEscape(st)) L.payEscape(st); L.roll(st); }
      else if (st.phase === 'decision') L.decide(st, M.AI.choose(st));
      else L.endTurn(st);
    }
    return JSON.stringify([st.winner, st.ranking, st.round, st.players.map((p) => p.money)]);
  };
  check('시뮬 결정성', play(42) === play(42));
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
