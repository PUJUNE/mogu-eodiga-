// ai.js — 모구의 마블 컴퓨터 플레이어 (휴리스틱)
var M = window.MBL;
var L = null;

M.AI = {
  // phase 'decision' 의 pending 에 대한 답 (true/false)
  choose: function (st) {
    L = M.Logic;
    var P = L.cur(st);
    var pd = st.pending;
    if (!pd) return false;
    var idx = pd.tile, def = M.TILES[idx];

    if (pd.type === 'buy') {
      // 여유 자금을 남기고 산다. 도시 독점에 다가갈수록 과감하게.
      var mine = L.cityCount(st, P.i, def.city);
      var reserve = mine >= 2 ? 60 : 180;
      return P.money - def.price >= reserve;
    }
    if (pd.type === 'upgrade') {
      var cost = L.upCost(idx);
      return P.money - cost >= 220;
    }
    if (pd.type === 'takeover') {
      var tc = L.takeoverCost(st, idx);
      if (P.money - tc < 250) return false;
      var owner = st.tiles[idx].owner;
      var myAfter = L.cityCount(st, P.i, def.city) + 1;
      var total = L.cityTotal(def.city);
      if (myAfter >= total) return true;                    // 인수로 도시 독점 완성 → 즉시 승리
      if (L.cityCount(st, owner, def.city) >= total - 1) return true;  // 상대 독점 저지
      return myAfter >= total - 1 && P.money - tc >= 500;   // 독점 직전이면 부자일 때만
    }
    return false;
  },

  // 무인도에서 탈출비를 낼지 (roll 전 판단)
  wantPayEscape: function (st) {
    var P = M.Logic.cur(st);
    return P.islandT > 0 && P.money >= M.ESCAPE_FEE + 400;
  },
};
