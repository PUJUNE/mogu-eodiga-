// logic.js — 모구의 마블 코어 규칙 (부루마블·모두의 마블 모티브, DOM 무의존)
// 턴 상태머신: roll(주사위 대기) → decision(구매/업그레이드/인수 대기) → end(턴 종료 대기) → 다음 턴
// 파산·무인도·축제·황금열쇠·더블·도시 독점 승리·라운드 제한 판정 포함
var M = window.MBL;

M.Logic = {
  create: function (opts) {
    // opts: { players: [{name, char, human}], seed }
    var rng = M.makeRng(opts.seed || 1);
    var deck = [];
    for (var i = 0; i < M.CARDS.length; i++) deck.push(i);
    for (i = deck.length - 1; i > 0; i--) { var j = rng.int(i + 1); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    return {
      players: opts.players.map(function (p, idx) {
        return { i: idx, name: p.name, char: p.char, human: !!p.human,
          money: M.START_MONEY, pos: 0, alive: true, islandT: 0 };
      }),
      tiles: M.TILES.map(function (t) { return { owner: null, level: 0, invested: 0 }; }),
      turn: 0, round: 1,
      phase: 'roll',               // roll | decision | end | over
      dice: [0, 0], doubles: 0, lastDouble: false,
      pending: null,               // {type:'buy'|'upgrade'|'takeover', tile}
      deck: deck, deckPos: 0,
      festivalTile: -1,            // 축제 마커 (통행료 ×2, 전역 1곳)
      winner: -1, ranking: null, overReason: null,
      rng: rng,
    };
  },

  cur: function (st) { return st.players[st.turn]; },
  tileDef: function (idx) { return M.TILES[idx]; },
  upCost: function (idx) { return Math.round(M.TILES[idx].price * M.UP_COST); },
  takeoverCost: function (st, idx) { return (M.TILES[idx].price + st.tiles[idx].invested) * M.TAKEOVER_MUL; },
  toll: function (st, idx) {
    var base = Math.round(M.TILES[idx].price * M.TOLL_MUL[st.tiles[idx].level]);
    return st.festivalTile === idx ? base * 2 : base;
  },
  // 총자산 = 현금 + (땅값+투자금)
  assets: function (st, pi) {
    var sum = st.players[pi].money;
    for (var i = 0; i < st.tiles.length; i++)
      if (st.tiles[i].owner === pi) sum += M.TILES[i].price + st.tiles[i].invested;
    return sum;
  },
  cityCount: function (st, pi, city) {
    var n = 0;
    for (var i = 0; i < M.TILES.length; i++)
      if (M.TILES[i].kind === 'city' && M.TILES[i].city === city && st.tiles[i].owner === pi) n++;
    return n;
  },
  cityTotal: function (city) {
    var n = 0;
    for (var i = 0; i < M.TILES.length; i++)
      if (M.TILES[i].kind === 'city' && M.TILES[i].city === city) n++;
    return n;
  },
  aliveCount: function (st) {
    return st.players.filter(function (p) { return p.alive; }).length;
  },

  // ── 주사위 (무인도 처리 포함). forced=[d1,d2] 는 테스트용 ──
  roll: function (st, forced) {
    var ev = [];
    if (st.phase !== 'roll') return ev;
    var P = this.cur(st);
    var d1 = forced ? forced[0] : st.rng.die();
    var d2 = forced ? forced[1] : st.rng.die();
    st.dice = [d1, d2];
    var dbl = d1 === d2;
    ev.push({ type: 'dice', d1: d1, d2: d2, dbl: dbl });

    if (P.islandT > 0) {                       // 무인도: 더블이면 탈출+이동, 아니면 대기
      if (dbl) {
        P.islandT = 0;
        ev.push({ type: 'escape', how: 'dice' });
        st.lastDouble = false;                 // 탈출 더블은 추가 턴 없음
        this._move(st, d1 + d2, ev);
      } else {
        P.islandT--;
        ev.push({ type: 'stuck', left: P.islandT });
        st.lastDouble = false;
        st.phase = 'end';
      }
      return ev;
    }

    st.lastDouble = dbl;
    if (dbl) {
      st.doubles++;
      if (st.doubles >= 3) {                   // 더블 3연속 → 무인도 직행
        ev.push({ type: 'tripledouble' });
        this._teleport(st, 6, ev, false);
        P.islandT = M.ISLAND_TURNS;
        ev.push({ type: 'island' });
        st.lastDouble = false;
        st.phase = 'end';
        return ev;
      }
    } else st.doubles = 0;

    this._move(st, d1 + d2, ev);
    return ev;
  },

  // 무인도 탈출비 지불 (주사위 굴리기 전 선택)
  payEscape: function (st) {
    var ev = [];
    var P = this.cur(st);
    if (st.phase !== 'roll' || P.islandT <= 0 || P.money < M.ESCAPE_FEE) return ev;
    P.money -= M.ESCAPE_FEE;
    P.islandT = 0;
    ev.push({ type: 'escape', how: 'pay', fee: M.ESCAPE_FEE });
    return ev;
  },

  _move: function (st, steps, ev) {
    var P = this.cur(st);
    var from = P.pos;
    var to = (from + steps) % M.SIZE;
    var passed = from + steps >= M.SIZE;       // 출발지 통과/도착
    P.pos = to;
    ev.push({ type: 'move', pi: P.i, from: from, to: to, steps: steps });
    if (passed) { P.money += M.SALARY; ev.push({ type: 'salary', amount: M.SALARY }); }
    this._land(st, ev);
  },

  _teleport: function (st, to, ev, salaryIfPass) {
    var P = this.cur(st);
    var from = P.pos;
    P.pos = to;
    ev.push({ type: 'move', pi: P.i, from: from, to: to, teleport: true });
    if (salaryIfPass) { P.money += M.SALARY; ev.push({ type: 'salary', amount: M.SALARY }); }
  },

  // ── 도착 칸 처리 ──
  _land: function (st, ev) {
    var P = this.cur(st);
    var idx = P.pos;
    var def = M.TILES[idx];
    var T = st.tiles[idx];
    st.pending = null;

    if (def.kind === 'city') {
      if (T.owner === null) {                  // 무주지: 구매 제안
        if (P.money >= def.price) { st.pending = { type: 'buy', tile: idx }; st.phase = 'decision'; }
        else st.phase = 'end';
      } else if (T.owner === P.i) {            // 내 땅: 업그레이드 제안
        var cost = this.upCost(idx);
        if (T.level < 3 && P.money >= cost) { st.pending = { type: 'upgrade', tile: idx }; st.phase = 'decision'; }
        else st.phase = 'end';
      } else {                                 // 남의 땅: 통행료 → 인수 제안
        var amount = this.toll(st, idx);
        this._pay(st, P.i, T.owner, amount, ev);
        ev.push({ type: 'toll', tile: idx, amount: amount, to: T.owner });
        if (st.phase === 'over') return;
        var tc = this.takeoverCost(st, idx);
        if (P.alive && T.level < 3 && P.money >= tc) { st.pending = { type: 'takeover', tile: idx }; st.phase = 'decision'; }
        else st.phase = 'end';
      }
      return;
    }

    if (def.kind === 'island') {
      P.islandT = M.ISLAND_TURNS;
      st.lastDouble = false;                   // 무인도 도착 시 더블 추가 턴 무효
      ev.push({ type: 'island' });
      st.phase = 'end';
      return;
    }
    if (def.kind === 'festival') {             // 내 최고가 지역 통행료 ×2 마커
      var best = -1, bestPrice = -1;
      for (var i = 0; i < M.TILES.length; i++)
        if (st.tiles[i].owner === P.i && M.TILES[i].price > bestPrice) { best = i; bestPrice = M.TILES[i].price; }
      if (best >= 0) { st.festivalTile = best; ev.push({ type: 'festival', tile: best }); }
      else ev.push({ type: 'festival', tile: -1 });
      st.phase = 'end';
      return;
    }
    if (def.kind === 'express') {              // 출발지로 이동 + 월급
      ev.push({ type: 'express' });
      this._teleport(st, 0, ev, true);
      st.phase = 'end';
      return;
    }
    if (def.kind === 'key') {
      this._drawCard(st, ev);
      return;
    }
    st.phase = 'end';                          // start 등
  },

  _drawCard: function (st, ev) {
    var P = this.cur(st);
    var card = M.CARDS[st.deck[st.deckPos]];
    st.deckPos = (st.deckPos + 1) % st.deck.length;
    ev.push({ type: 'card', card: card });
    if (card.money != null) {
      if (card.money >= 0) P.money += card.money;
      else { this._pay(st, P.i, -1, -card.money, ev); if (st.phase === 'over') return; }
      st.phase = 'end';
    } else if (card.gift != null) {            // 다른 플레이어 모두에게서 받기
      for (var i = 0; i < st.players.length; i++) {
        var o = st.players[i];
        if (i === P.i || !o.alive) continue;
        var got = Math.min(card.gift, Math.max(0, o.money));
        o.money -= got; P.money += got;
      }
      st.phase = 'end';
    } else if (card.goto === 'start') {
      this._teleport(st, 0, ev, true);
      st.phase = 'end';
    } else if (card.goto === 'island') {
      this._teleport(st, 6, ev, false);
      P.islandT = M.ISLAND_TURNS;
      st.lastDouble = false;
      ev.push({ type: 'island' });
      st.phase = 'end';
    } else if (typeof card.goto === 'number') {
      this._teleport(st, card.goto, ev, false);
      this._land(st, ev);                      // 도착 칸 재처리 (구매 제안 등)
    } else if (card.back != null) {
      var to = (P.pos - card.back + M.SIZE) % M.SIZE;
      this._teleport(st, to, ev, false);
      this._land(st, ev);
    } else st.phase = 'end';
  },

  // ── 결정 응답 (buy/upgrade/takeover) ──
  decide: function (st, yes) {
    var ev = [];
    if (st.phase !== 'decision' || !st.pending) return ev;
    var P = this.cur(st);
    var idx = st.pending.tile;
    var def = M.TILES[idx], T = st.tiles[idx];
    var pd = st.pending;
    st.pending = null;
    st.phase = 'end';
    if (!yes) { ev.push({ type: 'pass' }); return ev; }

    if (pd.type === 'buy' && T.owner === null && P.money >= def.price) {
      P.money -= def.price;
      T.owner = P.i;
      ev.push({ type: 'buy', tile: idx, pi: P.i });
      this._checkMonopoly(st, P.i, def.city, ev);
    } else if (pd.type === 'upgrade' && T.owner === P.i && T.level < 3) {
      var cost = this.upCost(idx);
      if (P.money >= cost) {
        P.money -= cost; T.level++; T.invested += cost;
        ev.push({ type: 'upgrade', tile: idx, level: T.level });
      }
    } else if (pd.type === 'takeover' && T.owner !== null && T.owner !== P.i && T.level < 3) {
      var tc = this.takeoverCost(st, idx);
      if (P.money >= tc) {
        P.money -= tc;
        st.players[T.owner].money += tc;
        T.owner = P.i;
        ev.push({ type: 'takeover', tile: idx, pi: P.i, cost: tc });
        this._checkMonopoly(st, P.i, def.city, ev);
      }
    }
    return ev;
  },

  // ── 지불 (부족 시 자동 청산 → 파산). to=-1 은행 ──
  _pay: function (st, from, to, amount, ev) {
    var P = st.players[from];
    P.money -= amount;
    while (P.money < 0) {                      // 최저가 소유지부터 청산
      var sell = -1, sp = 1e9;
      for (var i = 0; i < st.tiles.length; i++)
        if (st.tiles[i].owner === from && M.TILES[i].price < sp) { sell = i; sp = M.TILES[i].price; }
      if (sell < 0) break;
      var value = Math.round((M.TILES[sell].price + st.tiles[sell].invested) * M.SELL_RATE);
      st.tiles[sell].owner = null; st.tiles[sell].level = 0; st.tiles[sell].invested = 0;
      if (st.festivalTile === sell) st.festivalTile = -1;
      P.money += value;
      ev.push({ type: 'liquidate', tile: sell, value: value });
    }
    if (to >= 0) st.players[to].money += amount + Math.min(0, P.money); // 부족분은 못 받음
    if (P.money < 0) {                         // 파산
      P.money = 0; P.alive = false;
      for (i = 0; i < st.tiles.length; i++)
        if (st.tiles[i].owner === from) { st.tiles[i].owner = null; st.tiles[i].level = 0; st.tiles[i].invested = 0; }
      if (st.festivalTile >= 0 && st.tiles[st.festivalTile].owner === null) st.festivalTile = -1;
      ev.push({ type: 'bankrupt', pi: from });
      if (this.aliveCount(st) <= 1) this._gameOver(st, 'lastman', ev);
    }
  },

  _checkMonopoly: function (st, pi, city, ev) {
    if (this.cityCount(st, pi, city) >= this.cityTotal(city)) {
      ev.push({ type: 'monopoly', city: city, pi: pi });
      this._gameOver(st, 'monopoly', ev, pi);
    }
  },

  _gameOver: function (st, reason, ev, forcedWinner) {
    var self = this;
    var order = st.players.slice().sort(function (a, b) {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return self.assets(st, b.i) - self.assets(st, a.i);
    });
    st.winner = forcedWinner != null ? forcedWinner
      : (reason === 'lastman' ? st.players.filter(function (p) { return p.alive; })[0].i : order[0].i);
    if (forcedWinner != null || reason === 'lastman') {
      var w = st.players[st.winner];
      order = [w].concat(order.filter(function (p) { return p.i !== st.winner; }));
    }
    st.ranking = order.map(function (p) { return p.i; });
    st.overReason = reason;
    st.phase = 'over';
    ev.push({ type: 'gameover', winner: st.winner, reason: reason, ranking: st.ranking });
  },

  // ── 턴 종료 → 다음 플레이어 (더블이면 같은 플레이어) ──
  endTurn: function (st) {
    var ev = [];
    if (st.phase !== 'end') return ev;
    if (st.phase === 'over') return ev;
    var P = this.cur(st);
    if (st.lastDouble && P.alive) {            // 더블: 한 번 더
      st.lastDouble = false;
      st.phase = 'roll';
      ev.push({ type: 'turn', pi: st.turn, again: true });
      return ev;
    }
    st.doubles = 0; st.lastDouble = false;
    var n = st.players.length, next = st.turn;
    for (var k = 0; k < n; k++) {
      next = (next + 1) % n;
      if (next === 0) {                        // 한 바퀴 = 라운드 증가
        st.round++;
        if (st.round > M.MAX_ROUNDS) { this._gameOver(st, 'rounds', ev); return ev; }
      }
      if (st.players[next].alive) break;
    }
    st.turn = next;
    st.phase = 'roll';
    ev.push({ type: 'turn', pi: st.turn });
    return ev;
  },
};
