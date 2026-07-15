// ai.js — 모구의 마블 컴퓨터 플레이어 (난이도별 휴리스틱)
// aiSmart 확률로 최적 판단, 실패 시 소극적/무작위 선택. aiReserve 는 여유 자금 배율.
var M = window.MBL;
var L = null;

function knobs(st) { return M.DIFFS[st.diff] || M.DIFFS.normal; }

M.AI = {
  // phase 'decision' 의 pending 에 대한 답 (true/false)
  choose: function (st) {
    L = M.Logic;
    var P = L.cur(st);
    var pd = st.pending;
    if (!pd) return false;
    var D = knobs(st);
    var idx = pd.tile, def = M.TILES[idx];
    var smart = st.rng.chance(D.aiSmart);

    if (pd.type === 'buy') {
      if (!smart) return st.rng.chance(0.5);                  // 실수: 반반 무작위
      var mine = L.cityCount(st, P.i, def.city);
      var reserve = (mine >= 2 ? 60 : 180) * D.aiReserve;
      return P.money - def.price >= reserve;
    }
    if (pd.type === 'upgrade') {
      if (!smart) return false;                               // 실수: 소극적
      var cost = L.upCost(idx);
      return P.money - cost >= 220 * D.aiReserve;
    }
    if (pd.type === 'takeover') {
      if (!smart) return false;
      var tc = L.takeoverCost(st, idx);
      if (P.money - tc < 250 * D.aiReserve) return false;
      var owner = st.tiles[idx].owner;
      var myAfter = L.cityCount(st, P.i, def.city) + 1;
      var win = Math.min(M.CITY_WIN, L.cityTotal(def.city));
      if (myAfter >= win) return true;                        // 인수로 도시 제패 완성 → 즉시 승리
      if (L.cityCount(st, owner, def.city) >= win - 1) return true;    // 상대 제패 저지
      return myAfter >= win - 1 && P.money - tc >= 500 * D.aiReserve;  // 제패 직전이면 부자일 때만
    }
    return false;
  },

  // 산업단지(무인도 기믹)에서 탈출비를 낼지 (roll 전 판단)
  wantPayEscape: function (st) {
    var P = M.Logic.cur(st);
    var D = knobs(st);
    return P.islandT > 0 && P.money >= M.ESCAPE_FEE + 400 * D.aiReserve;
  },
};
