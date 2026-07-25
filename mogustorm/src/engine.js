// engine.js — 진행 상태·게이트 판정·세이브 (순수 로직, DOM 접근 없음)
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var E = (NS.Logic = {});

  E.SAVE_KEY = "mogustorm-save-v1";

  function cloneStats(s) {
    var o = {};
    for (var k in s) o[k] = s[k];
    return o;
  }

  E.newState = function () {
    return { node: null, stats: cloneStats(NS.BASE_STATS), endingId: null };
  };

  // branch 노드를 스탯으로 판정해 콘텐츠 노드 id까지 따라간다
  E.resolveBranch = function (id, stats) {
    var guard = 0;
    var n = NS.STORY[id];
    while (n && n.branch && guard++ < 20) {
      var b = n.branch;
      var v = stats[b.stat] || 0;
      var ok = b.gte != null ? v >= b.gte : v <= b.lte;
      id = ok ? b.then : b.else;
      n = NS.STORY[id];
    }
    return id;
  };

  E.applyFx = function (stats, fx) {
    if (!fx) return;
    for (var k in fx) stats[k] = (stats[k] || 0) + fx[k];
  };

  // 노드 진입: branch 해소 → 노드 fx 적용 → 엔딩이면 endingId 기록
  E.enter = function (st, id) {
    id = E.resolveBranch(id, st.stats);
    var n = NS.STORY[id];
    if (!n) throw new Error("존재하지 않는 노드: " + id);
    st.node = id;
    E.applyFx(st.stats, n.fx);
    st.endingId = n.ending || null;
    return n;
  };

  E.start = function () {
    var st = E.newState();
    E.enter(st, NS.START);
    return st;
  };

  E.choose = function (st, idx) {
    var n = NS.STORY[st.node];
    var c = n.choices[idx];
    E.applyFx(st.stats, c.fx);
    return E.enter(st, c.next);
  };

  E.advance = function (st) {
    var n = NS.STORY[st.node];
    if (n.next) return E.enter(st, n.next);
    return null;
  };

  /* ── 세이브 ── */
  E.load = function () {
    try {
      return JSON.parse(localStorage.getItem(E.SAVE_KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  E.saveProgress = function (st) {
    var d = E.load();
    d.cur = st.endingId ? null : { node: st.node, stats: cloneStats(st.stats) };
    try { localStorage.setItem(E.SAVE_KEY, JSON.stringify(d)); } catch (e) {}
  };
  E.collectEnding = function (endingId) {
    var d = E.load();
    d.endings = d.endings || {};
    var isNew = !d.endings[endingId];
    d.endings[endingId] = true;
    d.cur = null;
    try { localStorage.setItem(E.SAVE_KEY, JSON.stringify(d)); } catch (e) {}
    return isNew;
  };
  E.endingCount = function () {
    var d = E.load();
    var n = 0;
    for (var k in d.endings || {}) if (d.endings[k]) n++;
    return n;
  };
})();
