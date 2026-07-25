// render.js — 배경·날씨·초상·텍스트박스 연출 (DOM 기반)
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var R = (NS.Render = {});

  var el = {};
  var typeTimer = null;

  R.init = function () {
    el.bg = document.getElementById("vn-bg");
    el.weather = document.getElementById("vn-weather");
    el.chars = document.getElementById("vn-chars");
    el.namebox = document.getElementById("vn-name");
    el.text = document.getElementById("vn-text");
    el.hint = document.getElementById("vn-hint");
    el.choices = document.getElementById("vn-choices");
    el.statLove = document.getElementById("stat-love");
    el.statGrudge = document.getElementById("stat-grudge");
  };

  var BGS = ["liverpool", "hall", "kitchen", "barn", "heights_ext", "moor", "moor_night",
    "moor_sunset", "penistone", "grange", "night", "sea", "tavern"];
  var WEATHERS = ["rain", "storm", "snow", "stars", "cloud"];

  R.setScene = function (node) {
    BGS.forEach(function (b) { el.bg.classList.toggle("bg-" + b, node.bg === b); });
    WEATHERS.forEach(function (w) { el.weather.classList.toggle("w-" + w, node.weather === w); });
    NS.Audio.setMood(node.mood || "sad");
    R.setCast(node.cast || []);
  };

  R.setCast = function (cast) {
    el.chars.innerHTML = "";
    cast.forEach(function (id) {
      var c = NS.CHARS[id];
      if (!c) return;
      var d = document.createElement("div");
      d.className = "portrait";
      d.dataset.who = id;
      var art = document.createElement("div");
      art.className = "p-art";
      art.innerHTML = NS.Portraits.svg(id);
      d.appendChild(art);
      var nm = document.createElement("div");
      nm.className = "p-name";
      nm.textContent = c.name;
      nm.style.color = c.color;
      d.appendChild(nm);
      el.chars.appendChild(d);
    });
  };

  R.highlight = function (who) {
    var ps = el.chars.querySelectorAll(".portrait");
    for (var i = 0; i < ps.length; i++) {
      ps[i].classList.toggle("speaking", ps[i].dataset.who === who);
      ps[i].classList.toggle("dimmed", who !== "n" && ps[i].dataset.who !== who);
    }
  };

  R.updateStats = function (stats) {
    el.statLove.textContent = "♥ " + (stats.love || 0);
    el.statGrudge.textContent = "🔥 " + (stats.grudge || 0);
  };

  // 대사 1줄 타자기 출력. 반환: {done(), isDone()} — 클릭 시 즉시 완성용
  R.showLine = function (who, text, onShown) {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    var narration = who === "n";
    var c = NS.CHARS[who];
    el.namebox.textContent = narration ? "" : c ? c.name : who;
    el.namebox.style.color = c ? c.color : "#fff";
    el.namebox.style.display = narration ? "none" : "block";
    el.text.classList.toggle("narration", narration);
    R.highlight(who);
    el.hint.style.display = "none";

    var i = 0;
    var doneFlag = false;
    el.text.textContent = "";
    function finish() {
      if (doneFlag) return;
      doneFlag = true;
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
      el.text.textContent = text;
      el.hint.style.display = "block";
      if (onShown) onShown();
    }
    typeTimer = setInterval(function () {
      i += 1;
      el.text.textContent = text.slice(0, i);
      if (i >= text.length) finish();
    }, 18);
    return { finish: finish, isDone: function () { return doneFlag; } };
  };

  R.showChoices = function (choices, onPick) {
    el.choices.innerHTML = "";
    el.hint.style.display = "none";
    el.chars.classList.add("choices-open");
    choices.forEach(function (c, idx) {
      var b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = c.t;
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        NS.Audio.sfxChoice();
        el.choices.innerHTML = "";
        el.chars.classList.remove("choices-open");
        onPick(idx);
      });
      el.choices.appendChild(b);
    });
  };

  R.clearChoices = function () {
    el.choices.innerHTML = "";
    el.chars.classList.remove("choices-open");
  };
})();
