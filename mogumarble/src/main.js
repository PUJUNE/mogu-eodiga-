// main.js — 모구의 마블 진행 오케스트레이션 (사람 입력 ↔ 컴퓨터 자동, 연출 순서 재생)
var M = window.MBL;
var L = M.Logic;
var $ = function (id) { return document.getElementById(id); };

var st = null;
var boardBuilt = false;
var lastSlots = null;

/* ══════════ 이벤트 연출 큐 ══════════ */
var queue = [], running = false;
function enq(fn) { queue.push(fn); }
function runQueue(done) {
  if (running) return;
  running = true;
  var step = function () {
    if (!queue.length) { running = false; if (done) done(); return; }
    var fn = queue.shift();
    fn(step);
  };
  step();
}
function delay(sec) { return function (next) { setTimeout(next, sec * 1000); }; }

function tileName(idx) { return M.TILES[idx].name; }

// 로직 이벤트 → 연출 큐 등록
function playEvents(evs, done) {
  if (!st) return;                       // 홈 복귀 후 잔여 타이머 가드
  var human = L.cur(st) ? L.cur(st).human : false;
  evs.forEach(function (e) {
    switch (e.type) {
      case 'dice':
        enq(function (next) {
          M.audio.dice();
          M.R3.rollDice(e.d1, e.d2, function () {
            M.ui.toast('🎲 ' + e.d1 + ' + ' + e.d2 + ' = ' + (e.d1 + e.d2) + (e.dbl ? ' — 더블!' : ''), 1.4);
            setTimeout(next, 350);
          });
        });
        break;
      case 'tripledouble':
        enq(function (next) { M.ui.toast('😵 더블 3연속! 무인도로 끌려간다…', 1.8); setTimeout(next, 700); });
        break;
      case 'move':
        enq(function (next) {
          M.R3.hideDice();
          M.R3.hopToken(e.pi, e.from, e.to, !!e.teleport,
            function () { M.audio.hop(); },
            function () { M.R3.setMarker(e.to); M.ui.refreshHud(st); next(); });
        });
        break;
      case 'salary':
        enq(function (next) { M.audio.money(); M.ui.toast('💰 월급 ' + M.ui.fmt(e.amount) + ' 수령!', 1.3); M.ui.refreshHud(st); setTimeout(next, 400); });
        break;
      case 'buy':
        enq(function (next) { M.audio.buy(); M.ui.toast('🏠 ' + tileName(e.tile) + ' 구매!', 1.4); refresh(); setTimeout(next, 500); });
        break;
      case 'upgrade':
        enq(function (next) { M.audio.buy(); M.ui.toast('🏗️ ' + tileName(e.tile) + ' — ' + M.LV_NAME[e.level] + ' 완공!', 1.4); refresh(); setTimeout(next, 500); });
        break;
      case 'toll':
        enq(function (next) {
          M.audio.pay();
          M.ui.toast('💸 ' + tileName(e.tile) + ' 통행료 ' + M.ui.fmt(e.amount) + ' → ' + st.players[e.to].name, 1.7);
          M.ui.refreshHud(st); setTimeout(next, 800);
        });
        break;
      case 'takeover':
        enq(function (next) { M.audio.buy(); M.ui.toast('🤝 ' + tileName(e.tile) + ' 인수! (' + M.ui.fmt(e.cost) + ')', 1.6); refresh(); setTimeout(next, 600); });
        break;
      case 'card':
        enq(function (next) {
          M.audio.card();
          M.ui.showCard(e.card, next);
          if (!human) setTimeout(function () { var b = $('gkey-ok'); if (!$('gkey').classList.contains('hidden')) b.click(); }, 1600);
        });
        break;
      case 'island':
        enq(function (next) { M.audio.island(); M.ui.toast('🏝️ 무인도! ' + M.ISLAND_TURNS + '턴 안에 더블이 필요해…', 1.8); M.ui.refreshHud(st); setTimeout(next, 700); });
        break;
      case 'stuck':
        enq(function (next) { M.ui.toast('🏝️ 탈출 실패… (남은 ' + e.left + '턴)', 1.4); M.ui.refreshHud(st); setTimeout(next, 500); });
        break;
      case 'escape':
        enq(function (next) {
          M.ui.toast(e.how === 'dice' ? '⛵ 더블! 무인도 탈출!' : '⛵ 탈출비 ' + M.ui.fmt(e.fee) + ' 지불 — 자유!', 1.5);
          M.ui.refreshHud(st); setTimeout(next, 500);
        });
        break;
      case 'festival':
        enq(function (next) {
          M.audio.festival();
          M.ui.toast(e.tile >= 0 ? '🎪 모구 축제! ' + tileName(e.tile) + ' 통행료 ×2!' : '🎪 축제… 아직 내 땅이 없다', 1.7);
          refresh(); setTimeout(next, 600);
        });
        break;
      case 'express':
        enq(function (next) { M.audio.hop(); M.ui.toast('🚂 모구 특급열차 — 출발지로!', 1.5); setTimeout(next, 500); });
        break;
      case 'liquidate':
        enq(function (next) { M.audio.pay(); M.ui.toast('📉 ' + tileName(e.tile) + ' 강제 매각 (+' + M.ui.fmt(e.value) + ')', 1.5); refresh(); setTimeout(next, 550); });
        break;
      case 'bankrupt':
        enq(function (next) { M.audio.bankrupt(); M.ui.toast('💀 ' + st.players[e.pi].name + ' 파산!', 2); refresh(); setTimeout(next, 900); });
        break;
      case 'monopoly':
        enq(function (next) { M.audio.win(); M.ui.toast('🏆 ' + M.CITIES[e.city].name + ' 제패!!', 2); setTimeout(next, 900); });
        break;
      case 'pass': break;
      case 'turn': break;
      case 'gameover': break;
    }
  });
  runQueue(done);
}

function refresh() { M.ui.refreshHud(st); M.R3.refreshProps(st); }

/* ══════════ 턴 진행 ══════════ */
function beginTurn() {
  if (!st) return;
  if (st.phase === 'over') { finishGame(); return; }
  var P = L.cur(st);
  M.ui.refreshHud(st);
  M.R3.setMarker(P.pos);
  var ch = M.CHARS[P.char];
  M.audio.turn();
  M.ui.banner(ch.emoji + ' ' + P.name + '의 차례' + (P.human ? '' : ' (컴퓨터)'), 1);

  if (P.human) {
    var actions = [];
    if (P.islandT > 0) {
      actions.push({ label: '🎲 굴리기 (더블 노리기)', cb: doRoll });
      if (P.money >= M.ESCAPE_FEE)
        actions.push({ label: '⛵ 탈출비 ' + M.ui.fmt(M.ESCAPE_FEE), cls: 'alt', cb: function () {
          playEvents(L.payEscape(st), function () { M.ui.setActions(P.name + ' — 주사위를 굴리세요', [{ label: '🎲 주사위 굴리기', cb: doRoll }]); });
        } });
      M.ui.setActions('🏝️ 무인도 ' + P.islandT + '턴째 — 어떻게 할까?', actions);
    } else {
      M.ui.setActions(ch.emoji + ' ' + P.name + ' — 주사위를 굴리세요', [{ label: '🎲 주사위 굴리기', cb: doRoll }]);
    }
  } else {
    M.ui.setActions('🤖 ' + P.name + ' (컴퓨터) 생각 중…', []);
    setTimeout(function () {
      if (!st || st.phase !== 'roll') return;
      if (P.islandT > 0 && M.AI.wantPayEscape(st)) playEvents(L.payEscape(st), function () { setTimeout(doRoll, 400); });
      else doRoll();
    }, 850);
  }
}

function doRoll() {
  if (!st || st.phase !== 'roll') return;
  M.ui.setActions('', []);
  var evs = L.roll(st);
  playEvents(evs, afterResolve);
}

function afterResolve() {
  if (!st) return;
  refresh();
  if (st.phase === 'over') { finishGame(); return; }
  if (st.phase === 'decision') {
    var P = L.cur(st);
    if (P.human) showDecision();
    else setTimeout(function () {
      if (!st || st.phase !== 'decision') return;
      playEvents(L.decide(st, M.AI.choose(st)), afterResolve);
    }, 800);
    return;
  }
  if (st.phase === 'end') {
    setTimeout(function () {
      if (!st || st.phase !== 'end') return;
      var evs = L.endTurn(st);
      playEvents(evs, function () {
        if (st.phase === 'over') finishGame();
        else beginTurn();
      });
    }, 450);
  }
}

function showDecision() {
  var pd = st.pending;
  var P = L.cur(st);
  var idx = pd.tile, def = M.TILES[idx];
  var msg = '', yes = '';
  if (pd.type === 'buy') { msg = '🏠 ' + def.name + ' — ' + M.ui.fmt(def.price) + '에 구매할까?'; yes = '구매하기'; }
  else if (pd.type === 'upgrade') {
    msg = '🏗️ ' + def.name + ' — ' + M.LV_NAME[st.tiles[idx].level + 1] + ' 건설 (' + M.ui.fmt(L.upCost(idx)) + ')';
    yes = '건설하기';
  } else {
    msg = '🤝 ' + def.name + ' 인수? (' + M.ui.fmt(L.takeoverCost(st, idx)) + ')';
    yes = '인수하기';
  }
  M.ui.setActions(msg, [
    { label: yes, cb: function () { playEvents(L.decide(st, true), afterResolve); M.ui.setActions('', []); } },
    { label: '패스', cls: 'ghost', cb: function () { playEvents(L.decide(st, false), afterResolve); M.ui.setActions('', []); } },
  ]);
}

function finishGame() {
  M.ui.setActions('', []);
  M.R3.setMarker(-1);
  M.audio.win();
  setTimeout(function () { M.ui.showEnd(st); }, 900);
}

/* ══════════ 게임 시작 / 화면 ══════════ */
function startGame(slots) {
  lastSlots = slots;
  st = L.create({
    players: slots.map(function (s, i) { return { name: M.CHARS[i].name, char: i, human: s.human }; }),
    seed: (Date.now() % 900000000) + 7,
  });
  if (!boardBuilt) { M.R3.buildBoard(); boardBuilt = true; }
  M.R3.buildTokens(st);
  M.R3.refreshProps(st);
  M.ui.buildHud(st);
  M.ui.hideAll();
  $('hud').classList.remove('hidden');
  $('actionbar').classList.remove('hidden');
  M.ui.toast('모구의 마블 — 성남·수원·원주를 접수하라!', 2);
  beginTurn();
}

// 설정 화면 (인원 수 + 슬롯별 사람/컴퓨터)
var setupCount = 4;
var setupHuman = [true, true, true, true];
function renderSetup() {
  document.querySelectorAll('.cnt-btn').forEach(function (b) {
    b.classList.toggle('sel', +b.dataset.n === setupCount);
  });
  var wrap = $('slot-rows');
  wrap.innerHTML = '';
  for (var i = 0; i < setupCount; i++) {
    (function (i) {
      var ch = M.CHARS[i];
      var row = document.createElement('div');
      row.className = 'slot-row';
      row.innerHTML = '<span class="slot-name" style="color:' + ch.css + '">' + ch.emoji + ' ' + ch.name + '</span>';
      var tg = document.createElement('button');
      tg.className = 'slot-toggle' + (setupHuman[i] ? ' human' : '');
      tg.textContent = setupHuman[i] ? '🙋 사람' : '🤖 컴퓨터';
      tg.onclick = function () { setupHuman[i] = !setupHuman[i]; renderSetup(); };
      row.appendChild(tg);
      wrap.appendChild(row);
    })(i);
  }
  var humans = 0;
  for (i = 0; i < setupCount; i++) if (setupHuman[i]) humans++;
  $('setup-hint').textContent = humans === 0 ? '⚠️ 최소 1명은 사람이어야 해요' :
    '사람 ' + humans + ' · 컴퓨터 ' + (setupCount - humans) + ' — 같은 기기에서 차례로 플레이!';
  $('btn-setup-start').disabled = humans === 0;
}

function bindScreens() {
  $('btn-vs-com').onclick = function () {
    M.audio.resume();
    startGame([{ human: true }, { human: false }, { human: false }, { human: false }]);
  };
  $('btn-multi').onclick = function () {
    M.audio.resume();
    setupCount = 2; setupHuman = [true, true, true, true];
    renderSetup();
    M.ui.show('setup-screen');
  };
  document.querySelectorAll('.cnt-btn').forEach(function (b) {
    b.onclick = function () { setupCount = +b.dataset.n; renderSetup(); };
  });
  $('btn-setup-start').onclick = function () {
    var slots = [];
    for (var i = 0; i < setupCount; i++) slots.push({ human: setupHuman[i] });
    startGame(slots);
  };
  $('btn-setup-back').onclick = function () { M.ui.show('title-screen'); };
  $('btn-again').onclick = function () { startGame(lastSlots); };
  $('btn-end-title').onclick = backToTitle;
  $('btn-cam-reset').onclick = function () { M.R3.resetCamera(); };
  $('btn-home').onclick = function () {
    if (st && st.phase !== 'over' && !confirm('게임을 끝내고 나갈까요?')) return;
    backToTitle();
  };
  $('btn-series').onclick = function () {
    location.href = location.pathname.indexOf('/mogumarble/') >= 0 ? '../index.html' : 'index.html';
  };
  window.addEventListener('pointerdown', function () { M.audio.resume(); }, { once: true });
}

function backToTitle() {
  st = null;
  queue = []; running = false;
  $('hud').classList.add('hidden');
  $('actionbar').classList.add('hidden');
  M.ui.setActions('', []);
  M.R3.setMarker(-1);
  M.ui.show('title-screen');
}

/* ══════════ 부트 ══════════ */
M.ASSET_BASE = location.pathname.indexOf('/mogumarble/') >= 0 ? '../' : '';
(function boot() {
  if (!M.R3.init($('app'))) {
    $('loading').textContent = '3D 엔진을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';
    return;
  }
  M.R3.buildBoard();
  boardBuilt = true;
  bindScreens();
  $('loading').classList.add('hidden');
  M.ui.show('title-screen');

  var last = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    M.R3.update(dt);
  })(last);
})();

// 디버그 훅 (브라우저 테스트용)
M._st = function () { return st; };
M._dbg = function () {
  return st ? {
    phase: st.phase, turn: st.turn, round: st.round,
    money: st.players.map(function (p) { return Math.round(p.money); }),
    pos: st.players.map(function (p) { return p.pos; }),
    alive: st.players.map(function (p) { return p.alive; }),
    winner: st.winner,
  } : null;
};
M._doRoll = doRoll;
M._begin = beginTurn;
