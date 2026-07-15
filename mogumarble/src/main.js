// main.js — 모구의 마블 진행 오케스트레이션 (사람 입력 ↔ 컴퓨터 자동, 연출 순서 재생)
var M = window.MBL;
var L = M.Logic;
var $ = function (id) { return document.getElementById(id); };

var st = null;
var boardBuilt = false;
var lastSlots = null;

/* ══════════ 세이브 (localStorage + 파일 내보내기/불러오기) ══════════ */
var DIFF_DESC = {
  easy: '컴퓨터가 실수를 자주 하고 소심하게 써요 (시작 자금 −15%)',
  normal: '표준 컴퓨터 상대',
  hard: '컴퓨터가 영리하고 공격적 (시작 자금 +15%)',
  crazy: '컴퓨터가 항상 최적 판단 + 과감한 인수 (시작 자금 +35%)',
};
function loadSave() {
  try {
    var s = JSON.parse(localStorage.getItem(M.SAVE_KEY));
    if (s && typeof s === 'object')
      return { diff: M.DIFFS[s.diff] ? s.diff : 'normal', match: s.match || null };
  } catch (e) { }
  return { diff: 'normal', match: null };
}
var save = loadSave();
function writeSave() { try { localStorage.setItem(M.SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
function autoSave() {
  if (st && st.phase === 'roll') { save.match = L.serialize(st); writeSave(); }
}
function clearMatch() { save.match = null; writeSave(); }

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
        enq(function (next) { M.ui.toast('😵 더블 3연속! 동화의료기기산업단지로 견학을 끌려간다…', 1.8); setTimeout(next, 700); });
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
        enq(function (next) { M.audio.island(); M.ui.toast('🏭 동화의료기기산업단지 견학! ' + M.ISLAND_TURNS + '턴 안에 더블이 필요해…', 1.9); M.ui.refreshHud(st); setTimeout(next, 700); });
        break;
      case 'stuck':
        enq(function (next) { M.ui.toast('🏭 탈출 실패… (남은 ' + e.left + '턴)', 1.4); M.ui.refreshHud(st); setTimeout(next, 500); });
        break;
      case 'escape':
        enq(function (next) {
          M.ui.toast(e.how === 'dice' ? '⛵ 더블! 산업단지 견학 끝 — 탈출!' : '⛵ 탈출비 ' + M.ui.fmt(e.fee) + ' 지불 — 자유!', 1.5);
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
  autoSave();                                  // 턴 시작 시점 자동 저장
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
      M.ui.setActions('🏭 산업단지 견학 ' + P.islandT + '턴째 — 어떻게 할까?', actions);
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
  clearMatch();                                // 끝난 판은 세이브 삭제
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
    diff: save.diff,
  });
  enterMatch('모구의 마블 — 성남·수원·원주를 접수하라!');
}

function resumeGame() {
  var loaded = L.load(save.match);
  if (!loaded) { M.ui.toast('세이브를 불러올 수 없어요', 1.6); clearMatch(); refreshTitle(); return; }
  st = loaded;
  lastSlots = st.players.map(function (p) { return { human: p.human }; });
  enterMatch('▶ 이어서 — 라운드 ' + st.round + '부터!');
}

function enterMatch(msg) {
  if (!boardBuilt) { M.R3.buildBoard(); boardBuilt = true; }
  M.R3.buildTokens(st);
  M.R3.refreshProps(st);
  M.ui.buildHud(st);
  M.ui.hideAll();
  $('hud').classList.remove('hidden');
  $('actionbar').classList.remove('hidden');
  M.ui.toast(msg, 2);
  beginTurn();
}

// 타이틀 갱신: 난이도 선택 + 이어서 하기 버튼
function refreshTitle() {
  document.querySelectorAll('.diff-btn').forEach(function (b) {
    b.classList.toggle('sel', b.dataset.diff === save.diff);
  });
  $('diff-desc').textContent = DIFF_DESC[save.diff] || '';
  var m = save.match;
  var btn = $('btn-continue');
  if (m && L.load(m)) {
    var humans = m.players.filter(function (p) { return p.human; }).length;
    btn.textContent = '▶ 이어서 하기 (라운드 ' + m.round + ' · ' + m.players.length + '인' +
      (humans < m.players.length ? ' · ' + (M.DIFFS[m.diff] || M.DIFFS.normal).name : '') + ')';
    btn.classList.remove('hidden');
  } else btn.classList.add('hidden');
}

function exportSave() {
  if (!save.match && st && st.phase !== 'over') autoSave();
  if (!save.match) { M.ui.toast('저장된 게임이 없어요 — 게임을 시작하면 자동 저장됩니다', 2); return; }
  var blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mogumarble-save.json';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  M.ui.toast('💾 세이브 파일을 내려받았어요', 1.6);
}
function importSave(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var s = JSON.parse(reader.result);
      var match = s && s.match ? s.match : s;              // 전체 세이브 또는 매치 단독 모두 허용
      if (!L.load(match)) throw new Error('bad');
      save.match = match;
      if (s && M.DIFFS[s.diff]) save.diff = s.diff;
      writeSave();
      refreshTitle();
      M.ui.toast('📂 세이브를 불러왔어요 — 이어서 하기!', 1.8);
    } catch (e) { M.ui.toast('세이브 파일을 읽을 수 없어요', 1.8); }
  };
  reader.readAsText(file);
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
  document.querySelectorAll('.diff-btn').forEach(function (b) {
    b.onclick = function () { save.diff = b.dataset.diff; writeSave(); refreshTitle(); };
  });
  $('btn-continue').onclick = function () { M.audio.resume(); resumeGame(); };
  $('btn-export').onclick = exportSave;
  $('btn-import').onclick = function () { $('file-input').click(); };
  $('file-input').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) importSave(f);
    e.target.value = '';
  });
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
  refreshTitle();                              // 자동 저장된 판이 있으면 '이어서 하기' 노출
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
  refreshTitle();
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
