// ui.js — 화면 흐름 (타이틀·플레이·엔딩 카드·엔딩 갤러리)·입력·디버그 훅
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var U = (NS.UI = {});
  var L = null, R = null, A = null;

  var st = null;          // 진행 상태 {node, stats, endingId}
  var lineIdx = 0;
  var curLine = null;     // R.showLine 핸들
  var screen = "title";   // title | play | ending | gallery
  var awaiting = null;    // 'line' | 'choices' | null

  var $ = function (id) { return document.getElementById(id); };

  U.init = function () {
    L = NS.Logic; R = NS.Render; A = NS.Audio;
    R.init();
    $("title-icon").src = NS.ASSETS.mogu;

    $("btn-new").addEventListener("click", function () { A.unlock(); A.sfxChoice(); U.startNew(); });
    $("btn-continue").addEventListener("click", function () { A.unlock(); A.sfxChoice(); U.continueGame(); });
    $("btn-gallery").addEventListener("click", function () { A.unlock(); A.sfxClick(); U.showGallery(); });
    $("btn-gallery-back").addEventListener("click", function () { A.sfxClick(); U.showTitle(); });
    $("btn-end-title").addEventListener("click", function () { A.sfxClick(); U.showTitle(); });
    $("btn-end-gallery").addEventListener("click", function () { A.sfxClick(); U.showGallery(); });
    $("btn-mute").addEventListener("click", function (ev) {
      ev.stopPropagation();
      $("btn-mute").textContent = A.toggleMute() ? "🔇" : "🔊";
    });
    $("btn-home").addEventListener("click", function (ev) { ev.stopPropagation(); });

    $("vn-stage").addEventListener("click", function () { U.tap(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "z" || e.key === "Z") {
        if (screen === "title") { A.unlock(); U.continueOrNew(); e.preventDefault(); }
        else if (screen === "play") { U.tap(); e.preventDefault(); }
      }
      if (e.key === "Escape" && (screen === "gallery" || screen === "ending")) U.showTitle();
    });

    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.body.classList.add("touch");
    U.showTitle();
  };

  function show(name) {
    screen = name;
    $("title-screen").classList.toggle("hidden", name !== "title");
    $("gallery-screen").classList.toggle("hidden", name !== "gallery");
    $("ending-screen").classList.toggle("hidden", name !== "ending");
    $("vn-ui").classList.toggle("hidden", name !== "play");
  }

  U.showTitle = function () {
    var d = L.load();
    $("btn-continue").style.display = d.cur ? "inline-block" : "none";
    $("title-progress").textContent = "엔딩 수집  " + L.endingCount() + " / " + Object.keys(NS.ENDINGS).length;
    A.setMood("sad");
    show("title");
  };

  U.continueOrNew = function () {
    var d = L.load();
    if (d.cur) U.continueGame(); else U.startNew();
  };

  U.startNew = function () {
    st = L.start();
    show("play");
    playNode();
  };

  U.continueGame = function () {
    var d = L.load();
    if (!d.cur) return U.startNew();
    st = L.newState();
    st.stats = d.cur.stats;
    L.enter(st, d.cur.node);
    show("play");
    playNode();
  };

  function node() { return NS.STORY[st.node]; }

  function playNode() {
    var n = node();
    L.saveProgress(st);
    R.setScene(n);
    R.updateStats(st.stats);
    lineIdx = 0;
    showLine();
  }

  function showLine() {
    var n = node();
    var ln = n.lines[lineIdx];
    awaiting = "line";
    curLine = R.showLine(ln[0], ln[1], null);
  }

  function afterLines() {
    var n = node();
    if (n.choices) {
      awaiting = "choices";
      R.showChoices(n.choices, function (idx) {
        L.choose(st, idx);
        playNode();
      });
    } else if (n.next) {
      L.advance(st);
      playNode();
    } else if (n.ending) {
      showEnding(n.ending);
    }
  }

  U.tap = function () {
    if (screen !== "play" || awaiting !== "line") return;
    A.sfxClick();
    if (curLine && !curLine.isDone()) { curLine.finish(); return; }
    var n = node();
    lineIdx += 1;
    if (lineIdx < n.lines.length) showLine();
    else { awaiting = null; afterLines(); }
  };

  /* ── 엔딩 카드 ── */
  var TONE_ICON = { 5: "☀️", 4: "🌤️", 3: "⛅", 2: "🌧️", 1: "⛈️" };
  var TONE_LABEL = { 5: "최고의 행복", 4: "따뜻한 행복", 3: "잔잔한 평온", 2: "씁쓸한 여운", 1: "깊은 절망" };

  function showEnding(id) {
    var e = NS.ENDINGS[id];
    var isNew = L.collectEnding(id);
    $("end-tone").textContent = TONE_ICON[e.tone] + " " + TONE_LABEL[e.tone];
    $("end-no").textContent = "ENDING " + e.n + " / " + Object.keys(NS.ENDINGS).length + (isNew ? "  ✨NEW!" : "");
    $("end-title").textContent = e.title;
    $("end-axis").textContent = e.axis;
    $("end-desc").textContent = e.desc;
    // 스펙트럼 바 위치: tone 5(왼쪽 행복) → 1(오른쪽 절망)
    $("end-marker").style.left = ((5 - e.tone) / 4 * 100) + "%";
    $("end-count").textContent = "수집한 엔딩  " + L.endingCount() + " / " + Object.keys(NS.ENDINGS).length;
    A.sfxEnding(e.tone);
    show("ending");
  }

  /* ── 엔딩 갤러리 ── */
  U.showGallery = function () {
    var d = L.load();
    var got = d.endings || {};
    var list = $("gallery-list");
    list.innerHTML = "";
    var ids = Object.keys(NS.ENDINGS).sort(function (a, b) { return NS.ENDINGS[a].n - NS.ENDINGS[b].n; });
    ids.forEach(function (id) {
      var e = NS.ENDINGS[id];
      var row = document.createElement("div");
      row.className = "g-row" + (got[id] ? " got" : "");
      var tone = document.createElement("span");
      tone.className = "g-tone";
      tone.textContent = got[id] ? TONE_ICON[e.tone] : "❔";
      var body = document.createElement("span");
      body.className = "g-body";
      body.textContent = got[id] ? e.n + ". " + e.title + " — " + e.desc : e.n + ". ???";
      var ax = document.createElement("span");
      ax.className = "g-axis";
      ax.textContent = got[id] ? e.axis : "";
      row.appendChild(tone); row.appendChild(body); row.appendChild(ax);
      list.appendChild(row);
    });
    $("gallery-count").textContent = "수집  " + L.endingCount() + " / " + ids.length + "  ·  ☀️행복 ↔ ⛈️절망";
    show("gallery");
  };

  /* ── 디버그 훅 (시리즈 관례) ── */
  NS._st = function () { return { screen: screen, state: st, lineIdx: lineIdx, awaiting: awaiting }; };
  NS._dbg = function () {
    return {
      screen: screen,
      node: st ? st.node : null,
      stats: st ? st.stats : null,
      endings: NS.Logic ? NS.Logic.endingCount() : 0
    };
  };
  NS._goto = function (id, stats) {
    st = L.newState();
    if (stats) for (var k in stats) st.stats[k] = stats[k];
    L.enter(st, id);
    show("play");
    playNode();
  };
  NS._skipLines = function () {
    if (screen !== "play") return;
    while (awaiting === "line") {
      if (curLine && !curLine.isDone()) curLine.finish();
      U.tap();
      if (awaiting !== "line") break;
    }
  };
})();
