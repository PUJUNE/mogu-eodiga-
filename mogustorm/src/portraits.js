// portraits.js — 의인화 동물 캐릭터 SVG 흉상 (빅토리아 시대 의상)
// 화풍: 애니 셀셰이딩 — 형태 그라디언트 + 2톤 하드 그림자 + 좌상단 광원의 림라이트,
//       홍채 그라디언트와 하이라이트 2점을 가진 애니풍 눈, 털 결·옷 주름 디테일.
// 종족: 언쇼가=고양이(가장은 사자), 린턴가=개, 넬리=닭, 조지프=염소,
//       록우드=토끼, 선주=바다코끼리, 물주=쥐. 모구=실사 얼굴 + 드로잉 몸통.
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var P = (NS.Portraits = {});
  var uid = 0;

  /* ── 색 유틸 ── */
  function hx(c) {
    c = c.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function toHex(a) {
    return "#" + a.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  function mix(a, b, t) {
    var x = hx(a), y = hx(b);
    return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function lite(c, t) { return mix(c, "#ffffff", t); }
  function dark(c, t) { return mix(c, "#1a1420", t); }
  // 그림자는 순수 검정이 아니라 보라-남색 쪽으로 (애니 채색 관습)
  function shade(c, t) { return mix(c, "#4a3a68", t); }

  function rg(id, cx, cy, r, stops) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") +
      "</radialGradient>";
  }
  function lgr(id, x1, y1, x2, y2, stops) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") +
      "</linearGradient>";
  }

  /* ── 공통 부품 ── */

  // 목 — 몸통보다 먼저 그려 아래는 옷깃, 위는 머리에 가려지고 틈만 남는다
  function neck(col) {
    var u = uid++;
    return '<defs>' + lgr("nk" + u, 0, 0, 1, 0, [[0, lite(col, 0.1)], [0.4, shade(col, 0.28)], [1, shade(col, 0.46)]]) + "</defs>" +
      '<path d="M52 62 Q60 66 68 62 L68 96 L52 96 Z" fill="url(#nk' + u + ')"/>';
  }

  // 신사 코트 (어깨~가슴) — 그라디언트 + 주름 + 옷깃 수광
  function coat(c) {
    var u = uid++, g = "ct" + u, l = "lp" + u;
    return "<defs>" +
      lgr(g, 0, 0, 1, 0.4, [[0, lite(c.coat, 0.16)], [0.45, c.coat], [1, shade(c.coat, 0.4)]]) +
      lgr(l, 0, 0, 1, 0, [[0, lite(c.lapel, 0.14)], [1, shade(c.lapel, 0.3)]]) +
      "</defs>" +
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="url(#' + g + ')"/>' +
      // 어깨 접힘 주름
      '<g stroke="' + shade(c.coat, 0.42) + '" stroke-width="1.7" fill="none" opacity=".7">' +
      '<path d="M30 132 q6 -22 16 -32 M90 132 q-6 -22 -16 -32"/></g>' +
      '<path d="M22 118 q10 -20 26 -27" stroke="' + lite(c.coat, 0.3) + '" stroke-width="2.2" fill="none" opacity=".55"/>' +
      // 셔츠·라펠
      '<path d="M49 88 L60 106 L71 88 L66 86 L60 92 L54 86 Z" fill="' + c.shirt + '"/>' +
      '<path d="M49 88 L60 106 L42 101 Z" fill="url(#' + l + ')"/>' +
      '<path d="M71 88 L60 106 L78 101 Z" fill="' + shade(c.lapel, 0.24) + '"/>' +
      '<path d="M49 88 L60 106" stroke="' + lite(c.lapel, 0.35) + '" stroke-width="1.4" opacity=".6" fill="none"/>' +
      '<path d="M57 90 L63 90 L61 99 L59 99 Z" fill="' + (c.tie || "#8a2c34") + '"/>' +
      '<path d="M57.6 91 L59.4 91 L58.6 98 L58 98 Z" fill="' + lite(c.tie || "#8a2c34", 0.34) + '"/>';
  }

  // 드레스 (레이스 칼라)
  function dress(d, lace) {
    var u = uid++, g = "ds" + u;
    lace = lace || "#fff6ee";
    return "<defs>" + lgr(g, 0, 0, 1, 0.4, [[0, lite(d, 0.2)], [0.45, d], [1, shade(d, 0.4)]]) + "</defs>" +
      '<path d="M12 132 C17 98 37 85 60 85 C83 85 103 98 108 132 Z" fill="url(#' + g + ')"/>' +
      '<g stroke="' + shade(d, 0.4) + '" stroke-width="1.8" fill="none" opacity=".65">' +
      '<path d="M28 132 q8 -24 20 -34 M92 132 q-8 -24 -20 -34 M60 132 V104"/></g>' +
      '<path d="M20 120 q10 -22 26 -30" stroke="' + lite(d, 0.34) + '" stroke-width="2.4" fill="none" opacity=".5"/>' +
      // 레이스 칼라 (물결 가장자리)
      '<ellipse cx="60" cy="89" rx="17" ry="7.5" fill="' + lace + '"/>' +
      '<path d="M43 90 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0" stroke="' + mix(lace, "#c8b8d0", 0.5) + '" stroke-width="1.5" fill="none"/>' +
      '<ellipse cx="60" cy="86.5" rx="12" ry="4" fill="' + lite(lace, 0.4) + '" opacity=".8"/>' +
      '<circle cx="60" cy="93" r="2.6" fill="#d8b048"/><circle cx="59.2" cy="92.2" r="1" fill="#ffeaa8"/>';
  }

  // 머리 — 형태 그라디언트 + 하드 셀 그림자 + 림라이트 (좌상단 광원)
  function head(cx, cy, rx, ry, fur, extraClipShapes) {
    var u = uid++, g = "hd" + u, c = "hc" + u;
    var shp = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"/>';
    return "<defs>" +
      rg(g, "34%", "26%", "76%", [[0, lite(fur, 0.24)], [0.5, fur], [1, shade(fur, 0.2)]]) +
      '<clipPath id="' + c + '">' + shp + (extraClipShapes || "") + "</clipPath>" +
      "</defs>" +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#' + g + ')"/>' +
      '<g clip-path="url(#' + c + ')">' +
      // 2톤 셀 그림자 (우하단)
      '<ellipse cx="' + (cx + rx * 0.72) + '" cy="' + (cy + ry * 0.62) + '" rx="' + rx * 1.05 + '" ry="' + ry * 1.05 +
      '" fill="' + shade(fur, 0.42) + '" opacity=".34"/>' +
      // 림라이트 (좌상단 테두리)
      '<ellipse cx="' + (cx - rx * 0.2) + '" cy="' + (cy - ry * 0.24) + '" rx="' + rx * 0.95 + '" ry="' + ry * 0.95 +
      '" fill="none" stroke="' + lite(fur, 0.62) + '" stroke-width="5" opacity=".45"/>' +
      // 털 결
      '<g stroke="' + lite(fur, 0.22) + '" stroke-width="1.2" opacity=".38" fill="none" stroke-linecap="round">' +
      '<path d="M' + (cx - rx * 0.7) + " " + (cy - ry * 0.3) + " l-5 -6 M" + (cx - rx * 0.55) + " " + (cy + ry * 0.1) + " l-6 -4 M" +
      (cx + rx * 0.66) + " " + (cy - ry * 0.24) + " l6 -6 M" + (cx + rx * 0.56) + " " + (cy + ry * 0.16) + ' l6 -4"/></g>' +
      "</g>";
  }

  // 애니풍 눈
  function eye(x, y, r, iris) {
    var u = uid++, g = "ir" + u;
    return "<defs>" + lgr(g, 0, 0, 0, 1, [[0, dark(iris, 0.5)], [0.5, iris], [1, lite(iris, 0.5)]]) + "</defs>" +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r * 0.98 + '" ry="' + r * 1.3 + '" fill="#fbf8f4"/>' +
      '<ellipse cx="' + x + '" cy="' + (y + r * 0.06) + '" rx="' + r * 0.82 + '" ry="' + r * 1.16 + '" fill="url(#' + g + ')"/>' +
      '<ellipse cx="' + x + '" cy="' + (y + r * 0.14) + '" rx="' + r * 0.4 + '" ry="' + r * 0.62 + '" fill="#180f22"/>' +
      // 윗눈꺼풀 그림자
      '<path d="M' + (x - r) + " " + (y - r * 0.5) + " a" + r + " " + r * 1.3 + " 0 0 1 " + r * 2 + ' 0 Z" fill="#2a1c34" opacity=".28"/>' +
      // 하이라이트 2점
      '<circle cx="' + (x - r * 0.36) + '" cy="' + (y - r * 0.52) + '" r="' + r * 0.34 + '" fill="#ffffff" opacity=".95"/>' +
      '<circle cx="' + (x + r * 0.34) + '" cy="' + (y + r * 0.56) + '" r="' + r * 0.18 + '" fill="#ffffff" opacity=".6"/>' +
      // 속눈썹 라인
      '<path d="M' + (x - r * 1.06) + " " + (y - r * 0.62) + " q" + r * 1.06 + " " + -r * 0.72 + " " + r * 2.12 + " 0" +
      '" stroke="#231a2e" stroke-width="' + r * 0.42 + '" fill="none" stroke-linecap="round"/>';
  }

  // 눈 한 쌍 + 표정 (mood: normal | scowl | kind | sly | weary)
  function eyes(mood, iris, r) {
    r = r || 5.4;
    var brow = dark(iris, 0.55);
    var s = eye(48.5, 50, r, iris) + eye(71.5, 50, r, iris);
    if (mood === "scowl")
      s += '<g stroke="' + brow + '" stroke-width="2.8" stroke-linecap="round" fill="none">' +
        '<path d="M40 39 L56 45 M80 39 L64 45"/></g>';
    if (mood === "kind")
      s += '<g stroke="' + brow + '" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85">' +
        '<path d="M41 41 Q48.5 37 56 41 M64 41 Q71.5 37 79 41"/></g>';
    if (mood === "sly")
      s += '<g stroke="' + brow + '" stroke-width="2.5" stroke-linecap="round" fill="none">' +
        '<path d="M41 42 L56 40 M79 42 L64 40"/></g>' +
        '<path d="M38 46 q10 -4 20 -1 M82 46 q-10 -4 -20 -1" stroke="' + brow + '" stroke-width="2.4" fill="none" opacity=".5" stroke-linecap="round"/>';
    if (mood === "weary")
      s += '<g stroke="rgba(96,74,110,.55)" stroke-width="1.8" fill="none" stroke-linecap="round">' +
        '<path d="M42 58 Q48.5 61 55 58 M65 58 Q71.5 61 78 58"/></g>' +
        '<g stroke="' + brow + '" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7">' +
        '<path d="M41 40 Q48.5 43 56 41 M79 40 Q71.5 43 64 41"/></g>';
    return s;
  }

  // 고양이 주둥이 + 수염
  function catMuzzle(muz) {
    muz = muz || "#fff2e4";
    var u = uid++, g = "mz" + u;
    return "<defs>" + rg(g, "40%", "28%", "80%", [[0, lite(muz, 0.35)], [0.6, muz], [1, shade(muz, 0.2)]]) + "</defs>" +
      '<ellipse cx="60" cy="63" rx="12" ry="8.5" fill="url(#' + g + ')"/>' +
      '<path d="M56.5 59 L63.5 59 L60 63.6 Z" fill="#dd8892"/>' +
      '<path d="M57.4 59.7 L60 59.7 L58.8 61.6 Z" fill="#f2b0b8"/>' +
      '<path d="M60 63.6 Q56 68.6 51.5 65.6 M60 63.6 Q64 68.6 68.5 65.6" stroke="#6f5040" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<g stroke="rgba(255,255,255,.8)" stroke-width="1.3" stroke-linecap="round">' +
      '<path d="M30 55 L44 58 M29 62 L44 62 M31 69 L45 66 M90 55 L76 58 M91 62 L76 62 M89 69 L75 66"/></g>';
  }

  // 고양이 귀 (안쪽 그라디언트 + 털)
  function catEars(fur, inner) {
    var u = uid++, g = "er" + u;
    return "<defs>" + lgr(g, 0, 0, 0, 1, [[0, lite(inner, 0.2)], [1, shade(inner, 0.3)]]) + "</defs>" +
      '<path d="M31 36 L36 8 L54 24 Z" fill="' + lite(fur, 0.12) + '"/>' +
      '<path d="M36 30 L38.5 15 L48 24 Z" fill="url(#' + g + ')"/>' +
      '<path d="M36 8 L31 36" stroke="' + lite(fur, 0.55) + '" stroke-width="2.2" opacity=".55" fill="none"/>' +
      '<path d="M89 36 L84 8 L66 24 Z" fill="' + shade(fur, 0.2) + '"/>' +
      '<path d="M84 30 L81.5 15 L72 24 Z" fill="url(#' + g + ')"/>';
  }
  function catStripes(col) {
    return '<g stroke="' + col + '" stroke-width="3.2" stroke-linecap="round" fill="none" opacity=".85">' +
      '<path d="M50 26 L52 35 M60 24 L60 34 M70 26 L68 35"/>' +
      '<path d="M34 52 l-6 -3 M34 60 l-6 1 M86 52 l6 -3 M86 60 l6 1" stroke-width="2.4" opacity=".55"/></g>';
  }
  // 개 (늘어진 귀)
  function dogEars(ear) {
    var u = uid++, g = "de" + u;
    return "<defs>" + lgr(g, 0, 0, 1, 1, [[0, lite(ear, 0.18)], [0.55, ear], [1, shade(ear, 0.34)]]) + "</defs>" +
      '<path d="M33 32 C21 32 19 58 29 66 C37 62 39 44 38 33 Z" fill="url(#' + g + ')"/>' +
      '<path d="M87 32 C99 32 101 58 91 66 C83 62 81 44 82 33 Z" fill="' + shade(ear, 0.24) + '"/>' +
      '<path d="M31 36 C24 40 23 56 28 62" stroke="' + lite(ear, 0.4) + '" stroke-width="2.4" fill="none" opacity=".5"/>';
  }
  function dogMuzzle(muz) {
    muz = muz || "#f6ecd8";
    var u = uid++, g = "dm" + u;
    return "<defs>" + rg(g, "40%", "26%", "78%", [[0, lite(muz, 0.3)], [0.6, muz], [1, shade(muz, 0.2)]]) + "</defs>" +
      '<ellipse cx="60" cy="64" rx="14" ry="10" fill="url(#' + g + ')"/>' +
      '<ellipse cx="60" cy="59.5" rx="5.2" ry="3.8" fill="#332720"/>' +
      '<ellipse cx="58.4" cy="58.4" rx="1.8" ry="1.2" fill="#6b5a4e"/>' +
      '<path d="M60 63 Q56 69.5 51 66.5 M60 63 Q64 69.5 69 66.5" stroke="#6f5040" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  }

  function wrap(inner) {
    return '<svg viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg">' + inner + "</svg>";
  }

  /* ── 캐릭터별 초상 ── */
  var B = {};

  // 모구 — 실사 얼굴 + 벨벳 코트 (히스클리프)
  B.mogu = function () {
    var u = uid++, cp = "mgc" + u, rl = "mgr" + u;
    return wrap(
      neck("#8a8274") +
      coat({ coat: "#252c3c", lapel: "#181e2c", shirt: "#d8dfec", tie: "#8a2c34" }) +
      "<defs>" +
      '<clipPath id="' + cp + '"><circle cx="60" cy="49" r="31"/></clipPath>' +
      rg(rl, "34%", "26%", "76%", [[0, "#ffffff", 0.34], [0.62, "#ffffff", 0], [1, "#2a2438", 0.34]]) +
      "</defs>" +
      '<circle cx="60" cy="49" r="32.5" fill="#161a24"/>' +
      '<image href="' + NS.ASSETS.mogu + '" x="25" y="14" width="70" height="70" clip-path="url(#' + cp + ')" preserveAspectRatio="xMidYMid slice"/>' +
      // 사진 위에도 같은 광원의 셰이딩을 얹어 드로잉과 톤을 맞춘다
      '<circle cx="60" cy="49" r="31" fill="url(#' + rl + ')"/>' +
      // 좌상단 림라이트 호 (드로잉 캐릭터와 같은 광원)
      '<path d="M33 38 A31 31 0 0 1 68 19" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.6" stroke-linecap="round"/>'
    );
  };

  // 캣서린 — 밤색 얼룩 고양이 아가씨
  B.cat = function () {
    var fur = "#e0aa6a";
    return wrap(
      neck(fur) + dress("#c85a78") +
      catEars(fur, "#f6d8c0") + head(60, 52, 30, 27.5, fur) + catStripes("#bd8038") +
      eyes("normal", "#3f7a52") + catMuzzle() +
      '<path d="M84 14 L96 7 L94 21 Z" fill="#d8385a"/><path d="M84 14 L96 7 L92 13 Z" fill="#f0607e"/>' +
      '<circle cx="91" cy="14" r="3.2" fill="#f06a88"/><circle cx="90" cy="13" r="1.2" fill="#ffc0d0"/>'
    );
  };

  // 힌들리 — 짙은 갈색 고양이, 찌푸린 눈
  B.hindley = function () {
    var fur = "#8a6238";
    return wrap(
      neck(fur) +
      coat({ coat: "#4a3a26", lapel: "#38290f", shirt: "#d8cfc0", tie: "#5a4630" }) +
      catEars(fur, "#c09a70") + head(60, 52, 30, 27.5, fur) + catStripes("#63421f") +
      eyes("scowl", "#7a5a2e") + catMuzzle("#e8d0b0")
    );
  };

  // 프랜시스 — 흰 고양이 새색시
  B.frances = function () {
    var fur = "#f4eeea";
    return wrap(
      neck(fur) + dress("#e8a8b8", "#fff") +
      catEars(fur, "#f6cad4") + head(60, 52, 30, 27.5, fur) +
      eyes("kind", "#8a6ea8") + catMuzzle("#fff") +
      '<path d="M28 20 Q35 10 43 19 Q36 27 28 20 Z" fill="#e87898"/>' +
      '<path d="M30 19 Q35 13 40 18" stroke="#ffb0c4" stroke-width="2" fill="none"/>' +
      '<circle cx="35" cy="19.5" r="2.4" fill="#fff0f4"/>'
    );
  };

  // 에드거 — 금빛 리트리버 신사
  B.edgar = function () {
    var fur = "#e8c680";
    return wrap(
      neck(fur) +
      coat({ coat: "#35548a", lapel: "#263e6a", shirt: "#f2ede0", tie: "#c8d6ea" }) +
      dogEars("#c89c50") + head(60, 52, 29, 28, fur) +
      eyes("kind", "#4a6ea8") + dogMuzzle("#f6e8c8")
    );
  };

  // 이사벨라 — 크림빛 스패니얼 아가씨
  B.isabella = function () {
    var fur = "#f2e8d4";
    return wrap(
      neck(fur) + dress("#b088d0", "#fff6ff") +
      dogEars("#d8b070") + head(60, 52, 28, 27, fur) +
      eyes("kind", "#8a5aa8") + dogMuzzle("#faf2e2") +
      '<path d="M82 16 L94 9 L92 23 Z" fill="#c86ad8"/><path d="M82 16 L94 9 L90 15 Z" fill="#dd8cea"/>' +
      '<circle cx="89" cy="16" r="3.2" fill="#e094ec"/><circle cx="88" cy="15" r="1.2" fill="#f8d8fc"/>'
    );
  };

  // 넬리 꼬꼬 — 하녀 두건의 암탉
  B.nelly = function () {
    var u = uid++, cb = "cb" + u;
    return wrap(
      neck("#f6f2ea") + dress("#8a6a4a", "#f6f0e0") +
      "<defs>" + lgr(cb, 0, 0, 0, 1, [[0, "#ef6a6a"], [1, "#b83434"]]) + "</defs>" +
      head(60, 54, 26, 25, "#f6f2ea") +
      // 볏
      '<path d="M46 32 Q48 19 54 27 Q56 15 62 25 Q66 15 70 27 Q74 21 74 32 Z" fill="url(#' + cb + ')"/>' +
      '<path d="M48 30 Q50 22 54 27" stroke="#ff9a9a" stroke-width="1.8" fill="none" opacity=".8"/>' +
      eyes("kind", "#6a4a28", 4.8) +
      // 부리
      '<path d="M54 58 L66 58 L60 70 Z" fill="#e8a030"/>' +
      '<path d="M54 58 L66 58 L60 62 Z" fill="#f7bd5a"/>' +
      '<path d="M56 69 Q60 77 64 69" fill="#d05858"/>' +
      // 두건
      '<path d="M33 44 Q26 54 33 64" stroke="#e6dcc6" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<path d="M87 44 Q94 54 87 64" stroke="#d8ceb6" stroke-width="5" stroke-linecap="round" fill="none"/>'
    );
  };

  // 언쇼 영감 — 갈기 무성한 늙은 사자
  B.earnshaw = function () {
    var u = uid++, mg = "mn" + u;
    return wrap(
      neck("#d8b070") +
      "<defs>" + rg(mg, "36%", "28%", "74%", [[0, "#b98442"], [0.6, "#996a32"], [1, "#6f4a20"]]) + "</defs>" +
      '<circle cx="60" cy="52" r="39" fill="url(#' + mg + ')"/>' +
      // 갈기 결
      '<g stroke="#7e5527" stroke-width="3" stroke-linecap="round" opacity=".7">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) {
        var a = (i / 12) * Math.PI * 2, x = 60 + Math.cos(a) * 30, y = 52 + Math.sin(a) * 30;
        return '<path d="M' + x.toFixed(1) + " " + y.toFixed(1) + " L" + (60 + Math.cos(a) * 40).toFixed(1) + " " + (52 + Math.sin(a) * 40).toFixed(1) + '"/>';
      }).join("") + "</g>" +
      '<circle cx="60" cy="52" r="39" fill="none" stroke="#c79a52" stroke-width="2.4" opacity=".45"/>' +
      coat({ coat: "#5a4a34", lapel: "#463823", shirt: "#e8e0cc", tie: "#6a5638" }) +
      head(60, 52, 27, 26, "#d8b070") +
      eyes("kind", "#8a6224") + catMuzzle("#ecd8ac") +
      '<g stroke="#b08f5e" stroke-width="2.6" stroke-linecap="round" opacity=".8">' +
      '<path d="M42 38 L56 43 M78 38 L64 43"/></g>'
    );
  };

  // 조지프 — 성경책을 낀 늙은 염소
  B.joseph = function () {
    var u = uid++, hn = "hn" + u;
    return wrap(
      neck("#b8b0a0") +
      coat({ coat: "#3a3a38", lapel: "#262624", shirt: "#cfc8ba", tie: "#4a4a44" }) +
      "<defs>" + lgr(hn, 0, 0, 1, 1, [[0, "#d8ccb6"], [1, "#9a9082"]]) + "</defs>" +
      // 뿔
      '<path d="M38 20 C27 11 30 1 40 7 C44 11 44 18 44 24 Z" fill="url(#' + hn + ')"/>' +
      '<path d="M82 20 C93 11 90 1 80 7 C76 11 76 18 76 24 Z" fill="#b8ac96"/>' +
      '<path d="M36 16 C30 10 32 5 38 8" stroke="#f0e6d2" stroke-width="1.8" fill="none" opacity=".7"/>' +
      // 늘어진 귀
      '<path d="M32 46 Q22 53 30 62" stroke="#a8a094" stroke-width="7" stroke-linecap="round" fill="none"/>' +
      '<path d="M88 46 Q98 53 90 62" stroke="#948c80" stroke-width="7" stroke-linecap="round" fill="none"/>' +
      head(60, 54, 26, 29, "#b8b0a0") +
      eyes("scowl", "#6a6252", 5) +
      // 염소 주둥이
      '<ellipse cx="60" cy="66" rx="11" ry="8" fill="#d8d0c0"/>' +
      '<ellipse cx="60" cy="64" rx="8" ry="4.6" fill="#e6dfd0"/>' +
      '<ellipse cx="56" cy="63.5" rx="2" ry="2.9" fill="#3e382e"/><ellipse cx="64" cy="63.5" rx="2" ry="2.9" fill="#3e382e"/>' +
      // 수염
      '<path d="M54 76 Q60 94 66 76 Q63 81 60 80 Q57 81 54 76 Z" fill="#dcd4c4"/>' +
      '<path d="M57 78 Q60 88 63 78" stroke="#b4ab9a" stroke-width="1.4" fill="none"/>' +
      // 성경책
      '<g transform="rotate(-12 86 117)">' +
      '<rect x="76" y="104" width="20" height="26" rx="2" fill="#5e241d"/>' +
      '<rect x="76" y="104" width="5" height="26" fill="#7c3327"/>' +
      '<path d="M82 108 L90 108 M86 104 L86 112" stroke="#d8b048" stroke-width="2"/></g>'
    );
  };

  // 록우드 — 실크해트의 여행자 토끼
  B.lockwood = function () {
    var u = uid++, er = "lr" + u, ht = "lh" + u;
    return wrap(
      neck("#e0d8ca") +
      coat({ coat: "#5a4a3a", lapel: "#463828", shirt: "#e8e2d4", tie: "#8a6a3a" }) +
      "<defs>" +
      lgr(er, 0, 0, 1, 0, [[0, "#e8e0d2"], [1, "#c3b9a8"]]) +
      lgr(ht, 0, 0, 1, 0, [[0, "#3c3833"], [0.45, "#2a2622"], [1, "#191614"]]) +
      "</defs>" +
      '<ellipse cx="47" cy="14" rx="8" ry="20" fill="url(#' + er + ')" transform="rotate(-8 47 14)"/>' +
      '<ellipse cx="47" cy="16" rx="4" ry="13" fill="#efb9bb" transform="rotate(-8 47 14)"/>' +
      '<ellipse cx="73" cy="14" rx="8" ry="20" fill="#cec4b2" transform="rotate(8 73 14)"/>' +
      '<ellipse cx="73" cy="16" rx="4" ry="13" fill="#dda6a8" transform="rotate(8 73 14)"/>' +
      head(60, 54, 27, 26, "#e0d8ca") +
      eyes("normal", "#5a6a8a") +
      '<ellipse cx="60" cy="64" rx="10" ry="7.5" fill="#f6f1e8"/>' +
      '<path d="M57 60 L63 60 L60 64 Z" fill="#d68f97"/>' +
      '<path d="M60 64 V69 M60 69 Q56 72.5 53 70.5 M60 69 Q64 72.5 67 70.5" stroke="#8a7a68" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      // 실크해트
      '<rect x="40" y="24" width="40" height="8" rx="3.5" fill="#211e1b"/>' +
      '<rect x="46" y="1" width="28" height="25" rx="3" fill="url(#' + ht + ')"/>' +
      '<rect x="46" y="19" width="28" height="5" fill="#7e2f36"/>' +
      '<path d="M49 3 V24" stroke="rgba(255,255,255,.18)" stroke-width="2.4"/>'
    );
  };

  // 헤어턴 — 거친 옷의 젊은 갈색 고양이
  B.hareton = function () {
    var fur = "#b08a58", u = uid++, g = "hg" + u;
    return wrap(
      neck(fur) +
      "<defs>" + lgr(g, 0, 0, 1, 0.4, [[0, "#9c8054"], [0.5, "#8a7048"], [1, "#5e4c2e"]]) + "</defs>" +
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="url(#' + g + ')"/>' +
      '<path d="M50 88 L60 103 L70 88 Z" fill="#d8ccb4"/>' +
      '<path d="M50 88 L60 103 L60 92 Z" fill="#eee2ca"/>' +
      '<g stroke="#5e4c2e" stroke-width="3.4" stroke-linecap="round"><path d="M22 112 L38 109 M82 109 L98 112"/></g>' +
      '<path d="M28 132 q6 -22 16 -32" stroke="#4e4026" stroke-width="1.8" fill="none" opacity=".7"/>' +
      catEars(fur, "#d8b888") + head(60, 52, 30, 27.5, fur) + catStripes("#7f6033") +
      eyes("normal", "#6a5a36") + catMuzzle("#e8d4b0") +
      '<path d="M38 33 L48 38" stroke="#6a5030" stroke-width="2.6" stroke-linecap="round"/>'
    );
  };

  // 캐시 — 어머니를 닮은 금빛 고양이 아가씨
  B.cathy = function () {
    var fur = "#eccf96";
    return wrap(
      neck(fur) + dress("#88b0d8", "#fff") +
      catEars(fur, "#fce8cc") + head(60, 52, 30, 27.5, fur) +
      eyes("normal", "#3f7a52") + catMuzzle("#fff6ea") +
      '<path d="M82 15 L94 8 L92 22 Z" fill="#4880c0"/><path d="M82 15 L94 8 L90 14 Z" fill="#6ea2dc"/>' +
      '<circle cx="89" cy="15" r="3.2" fill="#78aade"/><circle cx="88" cy="14" r="1.2" fill="#cfe6fa"/>'
    );
  };

  // 린턴 — 창백하고 여린 강아지, 목도리
  B.linton = function () {
    var u = uid++, sc = "sc" + u;
    return wrap(
      neck("#e8e6ee") +
      coat({ coat: "#8a95a8", lapel: "#707c92", shirt: "#eef0f4", tie: "#9ab0c0" }) +
      "<defs>" + lgr(sc, 0, 0, 1, 0.3, [[0, "#b6c8d6"], [1, "#7e94a6"]]) + "</defs>" +
      dogEars("#c8ccd8") + head(60, 52, 26, 26, "#e8e6ee") +
      eyes("weary", "#7a86a8") + dogMuzzle("#f4f2f8") +
      '<path d="M34 84 Q60 74 86 84 L86 95 Q60 85 34 95 Z" fill="url(#' + sc + ')"/>' +
      '<path d="M34 88 Q60 78 86 88" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/>'
    );
  };

  // 캣서린의 유령 — 반투명한 푸른 잔상
  B.ghost = function () {
    var fur = "#cfe4f8", u = uid++, g = "gh" + u;
    return wrap(
      "<defs>" + lgr(g, 0, 0, 0, 1, [[0, "#dceaf8", 0.85], [1, "#96b4d8", 0.35]]) + "</defs>" +
      '<g opacity="0.88">' +
      neck(fur) +
      '<path d="M20 130 Q26 120 24 108 C28 92 42 85 60 85 C78 85 92 92 96 108 Q94 120 100 130 L90 122 L80 131 L70 123 L60 131 L50 123 L40 131 L30 122 Z" fill="url(#' + g + ')"/>' +
      catEars(fur, "#e8f2fc") + head(60, 52, 30, 27.5, fur) +
      '<ellipse cx="48.5" cy="50" rx="4.4" ry="5.6" fill="#6a8aac"/><ellipse cx="71.5" cy="50" rx="4.4" ry="5.6" fill="#6a8aac"/>' +
      '<circle cx="47" cy="48" r="1.6" fill="#eaf4ff"/><circle cx="70" cy="48" r="1.6" fill="#eaf4ff"/>' +
      '<ellipse cx="60" cy="63" rx="11" ry="8" fill="#e8f2fc"/>' +
      '<path d="M56.5 59 L63.5 59 L60 63.5 Z" fill="#a8c0d8"/>' +
      '<path d="M60 63.5 Q55 69 50 66 M60 63.5 Q65 69 70 66" stroke="#88a8c4" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      "</g>" +
      '<g fill="#eaf6ff"><circle cx="32" cy="28" r="2.6" opacity=".85"/><circle cx="92" cy="74" r="2" opacity=".6"/><circle cx="26" cy="66" r="1.6" opacity=".5"/><circle cx="86" cy="24" r="1.8" opacity=".55"/></g>'
    );
  };

  // 선주 영감 — 선장 모자의 바다코끼리
  B.boss = function () {
    var u = uid++, cp = "cp" + u;
    return wrap(
      neck("#9a8570") +
      coat({ coat: "#2c3a50", lapel: "#1e2a3c", shirt: "#e8e4d8", tie: "#3a4a60" }) +
      "<defs>" + lgr(cp, 0, 0, 1, 0.3, [[0, "#2e4058"], [1, "#16202e"]]) + "</defs>" +
      head(60, 54, 30, 27, "#9a8570") +
      eyes("kind", "#4a5a4a", 5) +
      // 볼주머니
      '<ellipse cx="52" cy="65" rx="9.4" ry="8.4" fill="#b4a28a"/><ellipse cx="68" cy="65" rx="9.4" ry="8.4" fill="#a89678"/>' +
      '<ellipse cx="50" cy="62" rx="4" ry="3" fill="#c6b69e" opacity=".7"/>' +
      '<g fill="#5a4a3a"><circle cx="49" cy="63" r="1"/><circle cx="54" cy="66" r="1"/><circle cx="66" cy="66" r="1"/><circle cx="71" cy="63" r="1"/></g>' +
      // 엄니
      '<path d="M53 71 L51 88 L56.5 88 L57.4 72 Z" fill="#f4eedc"/>' +
      '<path d="M53 71 L52 84 L54 84 L54.6 72 Z" fill="#fffaf0"/>' +
      '<path d="M67 71 L69 88 L63.5 88 L62.6 72 Z" fill="#e8e2d0"/>' +
      // 선장 모자
      '<path d="M36 30 L84 30 L79 13 L41 13 Z" fill="url(#' + cp + ')"/>' +
      '<rect x="33" y="28" width="54" height="8" rx="3" fill="#121a26"/>' +
      '<circle cx="60" cy="21" r="4.4" fill="#d8b048"/><circle cx="59" cy="20" r="1.6" fill="#ffe8a8"/>'
    );
  };

  // 물주 쥐 — 카드를 든 도박장 쥐
  B.dealer = function () {
    var fur = "#a8a8b2";
    return wrap(
      neck(fur) +
      coat({ coat: "#5a3a3a", lapel: "#442a2a", shirt: "#d8d0c8", tie: "#2e2020" }) +
      '<circle cx="34" cy="24" r="14" fill="#9a9aa4"/><circle cx="34" cy="24" r="8.4" fill="#d8a8b0"/>' +
      '<circle cx="86" cy="24" r="14" fill="#8c8c96"/><circle cx="86" cy="24" r="8.4" fill="#c298a0"/>' +
      head(60, 54, 27, 25, fur) +
      eyes("sly", "#8a3a4a", 5) +
      '<ellipse cx="60" cy="65" rx="11" ry="8" fill="#c0c0ca"/>' +
      '<ellipse cx="60" cy="61" rx="4.2" ry="3.2" fill="#d87888"/>' +
      '<ellipse cx="58.8" cy="60" rx="1.6" ry="1" fill="#f0aab4"/>' +
      '<g stroke="rgba(235,235,245,.75)" stroke-width="1.3" stroke-linecap="round">' +
      '<path d="M30 59 L46 62 M30 67 L46 66 M90 59 L74 62 M90 67 L74 66"/></g>' +
      '<g transform="rotate(14 90 114)">' +
      '<rect x="82" y="102" width="17" height="24" rx="2" fill="#f4f0e2"/>' +
      '<path d="M88 108 L94 116 M94 108 L88 116" stroke="#b8303e" stroke-width="2.4"/></g>'
    );
  };

  P.svg = function (id) {
    var b = B[id];
    if (b) return b();
    var c = NS.CHARS[id] || {};
    return wrap('<text x="60" y="72" font-size="56" text-anchor="middle">' + (c.icon || "🐾") + "</text>");
  };
})();
