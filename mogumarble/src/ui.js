// ui.js — 모구의 마블 DOM UI (HUD·행동 버튼·카드 팝업·화면 전환)
var M = window.MBL;
var $ = function (id) { return document.getElementById(id); };

M.ui = {
  toastT: null,

  show: function (id) { this.hideAll(); $(id).classList.remove('hidden'); },
  hideAll: function () {
    ['title-screen', 'setup-screen', 'name-screen', 'end-screen'].forEach(function (s) { $(s).classList.add('hidden'); });
  },

  toast: function (msg, sec) {
    var el = $('toast');
    el.textContent = msg;
    el.style.opacity = 1;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(function () { el.style.opacity = 0; }, (sec || 1.6) * 1000);
  },

  fmt: function (n) { return n.toLocaleString('ko-KR') + '만'; },

  // ── 플레이어 HUD 카드 ──
  buildHud: function (st) {
    var wrap = $('players');
    wrap.innerHTML = '';
    for (var i = 0; i < st.players.length; i++) {
      var P = st.players[i];
      var ch = M.CHARS[P.char];
      var d = document.createElement('div');
      d.className = 'pcard';
      d.id = 'pcard-' + i;
      d.style.borderColor = ch.css;
      d.innerHTML = '<div class="pc-top"><span class="pc-emoji">' + ch.emoji + '</span>' +
        '<span class="pc-name">' + P.name + '</span>' +
        '<span class="pc-kind">' + (P.human ? '사람' : '컴퓨터') + '</span></div>' +
        '<div class="pc-money" id="pc-money-' + i + '"></div>' +
        '<div class="pc-sub" id="pc-sub-' + i + '"></div>';
      wrap.appendChild(d);
    }
    this.refreshHud(st);
  },
  refreshHud: function (st) {
    for (var i = 0; i < st.players.length; i++) {
      var P = st.players[i];
      var card = $('pcard-' + i);
      if (!card) continue;
      $('pc-money-' + i).textContent = this.fmt(P.money);
      var sub = [];
      if (!P.alive) sub.push('💀 파산');
      else {
        var owned = 0;
        for (var t = 0; t < st.tiles.length; t++) if (st.tiles[t].owner === i) owned++;
        sub.push('🏠 ' + owned + '곳');
        if (P.islandT > 0) sub.push('🏭 ' + P.islandT + '턴');
      }
      $('pc-sub-' + i).textContent = sub.join(' · ');
      card.classList.toggle('turn', st.turn === i && st.phase !== 'over');
      card.classList.toggle('dead', !P.alive);
    }
    var hasAI = st.players.some(function (p) { return !p.human; });
    $('round-ind').textContent = '라운드 ' + Math.min(st.round, M.MAX_ROUNDS) + '/' + M.MAX_ROUNDS +
      (hasAI ? ' · ' + (M.DIFFS[st.diff] || M.DIFFS.normal).name : '');
  },

  // ── 하단 행동 버튼 (상황별) ──
  // actions: [{label, cls, cb}] — 비면 숨김
  setActions: function (msg, actions) {
    var bar = $('actionbar');
    $('action-msg').textContent = msg || '';
    var wrap = $('action-btns');
    wrap.innerHTML = '';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'abtn' + (a.cls ? ' ' + a.cls : '');
      b.textContent = a.label;
      b.onclick = a.cb;
      wrap.appendChild(b);
    });
    bar.classList.toggle('hidden', !msg && (!actions || !actions.length));
  },

  // ── 황금열쇠 카드 팝업 ──
  showCard: function (card, onClose) {
    $('gkey-name').textContent = card.name;
    $('gkey-desc').textContent = card.desc;
    $('gkey').classList.remove('hidden');
    var btn = $('gkey-ok');
    btn.onclick = function () {
      $('gkey').classList.add('hidden');
      if (onClose) onClose();
    };
  },

  // ── 턴 배너 ──
  banner: function (msg, sec) {
    var el = $('turn-banner');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('on'); }, (sec || 1.1) * 1000);
  },

  // ── 결과 화면 ──
  showEnd: function (st) {
    var reasonTxt = { monopoly: '🏆 도시 제패 승리!', lastman: '👑 최후의 생존자!', rounds: '⏱️ 라운드 종료 — 총자산 1위!' };
    $('end-reason').textContent = reasonTxt[st.overReason] || '게임 종료';
    var w = st.players[st.winner];
    $('end-winner').textContent = M.CHARS[w.char].emoji + ' ' + w.name + ' 승리!';
    var list = $('end-rank');
    list.innerHTML = '';
    for (var r = 0; r < st.ranking.length; r++) {
      var P = st.players[st.ranking[r]];
      var li = document.createElement('div');
      li.className = 'rank-row';
      li.innerHTML = '<span class="rk">' + (r + 1) + '위</span>' +
        '<span>' + M.CHARS[P.char].emoji + ' ' + P.name + (P.human ? '' : ' (컴)') + '</span>' +
        '<span class="rk-money">' + (P.alive ? this.fmt(M.Logic.assets(st, P.i)) : '파산') + '</span>';
      list.appendChild(li);
    }
    this.show('end-screen');
  },
};
