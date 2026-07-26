// portraits.js — 의인화 동물 캐릭터 SVG 흉상 (1980년 텍사스 서부 의상)
// 화풍: 애니 셀셰이딩 — 형태 그라디언트 + 2톤 하드 그림자 + 좌상단 광원의 림라이트,
//       홍채 그라디언트와 하이라이트 2점을 가진 애니풍 눈, 털 결·옷 주름 디테일.
// 종족: 벨 집안=하운드, 꼬꼬 집안=닭, 슈거=시궁쥐, 웰스=송골매, 소녀=새끼 고양이,
//       매킨타이어=여우, 사장=두꺼비, 카르텔=코요테. 모구=실사 얼굴 + 드로잉 몸통.
(function () {
  "use strict";
  var NS = (window.MNC = window.MNC || {});
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
    return "<defs>" + lgr("nk" + u, 0, 0, 1, 0, [[0, lite(col, 0.1)], [0.4, shade(col, 0.28)], [1, shade(col, 0.46)]]) + "</defs>" +
      '<path d="M52 62 Q60 66 68 62 L68 96 L52 96 Z" fill="url(#nk' + u + ')"/>';
  }

  // 웨스턴 셔츠 — 요크 이음선 + 스냅 단추 + 옷깃 (1980 텍사스 기본 복장)
  function shirt(c) {
    var u = uid++, g = "sh" + u, y = "yk" + u;
    var yoke = c.yoke || shade(c.body, 0.18);
    return "<defs>" +
      lgr(g, 0, 0, 1, 0.4, [[0, lite(c.body, 0.18)], [0.45, c.body], [1, shade(c.body, 0.4)]]) +
      lgr(y, 0, 0, 0, 1, [[0, lite(yoke, 0.2)], [1, shade(yoke, 0.26)]]) +
      "</defs>" +
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="url(#' + g + ')"/>' +
      // 웨스턴 요크 (어깨 V 이음선)
      '<path d="M20 118 C26 98 40 88 60 87 C80 88 94 98 100 118 L94 122 C88 104 76 95 60 94 C44 95 32 104 26 122 Z" fill="url(#' + y + ')" opacity=".9"/>' +
      // 소매·어깨 주름
      '<g stroke="' + shade(c.body, 0.44) + '" stroke-width="1.6" fill="none" opacity=".6">' +
      '<path d="M30 132 q5 -20 14 -30 M90 132 q-5 -20 -14 -30"/></g>' +
      '<path d="M23 120 q10 -19 25 -26" stroke="' + lite(c.body, 0.3) + '" stroke-width="2" fill="none" opacity=".5"/>' +
      // 앞섶·스냅 단추
      '<path d="M56 92 L56 132 L64 132 L64 92 Z" fill="' + lite(c.body, 0.1) + '" opacity=".7"/>' +
      '<path d="M60 94 V132" stroke="' + shade(c.body, 0.45) + '" stroke-width="1.2" opacity=".7"/>' +
      '<g fill="' + (c.snap || "#e8e4d8") + '"><circle cx="60" cy="104" r="1.9"/><circle cx="60" cy="116" r="1.9"/><circle cx="60" cy="128" r="1.9"/></g>' +
      // 옷깃
      '<path d="M48 88 L60 100 L52 90 Z" fill="' + lite(c.body, 0.24) + '"/>' +
      '<path d="M72 88 L60 100 L68 90 Z" fill="' + shade(c.body, 0.2) + '"/>' +
      '<path d="M47 87 L60 101 L53 88 Z" fill="none" stroke="' + shade(c.body, 0.4) + '" stroke-width="1.1"/>';
  }

  // 정장 (사장·웰스용) — 라펠 + 넥타이
  function suit(c) {
    var u = uid++, g = "st" + u, l = "lp" + u;
    return "<defs>" +
      lgr(g, 0, 0, 1, 0.4, [[0, lite(c.coat, 0.16)], [0.45, c.coat], [1, shade(c.coat, 0.4)]]) +
      lgr(l, 0, 0, 1, 0, [[0, lite(c.lapel, 0.14)], [1, shade(c.lapel, 0.3)]]) +
      "</defs>" +
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="url(#' + g + ')"/>' +
      '<g stroke="' + shade(c.coat, 0.42) + '" stroke-width="1.7" fill="none" opacity=".7">' +
      '<path d="M30 132 q6 -22 16 -32 M90 132 q-6 -22 -16 -32"/></g>' +
      '<path d="M22 118 q10 -20 26 -27" stroke="' + lite(c.coat, 0.3) + '" stroke-width="2.2" fill="none" opacity=".55"/>' +
      '<path d="M49 88 L60 106 L71 88 L66 86 L60 92 L54 86 Z" fill="' + c.shirt + '"/>' +
      '<path d="M49 88 L60 106 L42 101 Z" fill="url(#' + l + ')"/>' +
      '<path d="M71 88 L60 106 L78 101 Z" fill="' + shade(c.lapel, 0.24) + '"/>' +
      '<path d="M57 90 L63 90 L61 99 L59 99 Z" fill="' + (c.tie || "#8a2c34") + '"/>' +
      '<path d="M57.6 91 L59.4 91 L58.6 98 L58 98 Z" fill="' + lite(c.tie || "#8a2c34", 0.34) + '"/>';
  }

  // 여성 블라우스 (꼬꼬 진·로레타)
  function blouse(d, trim) {
    var u = uid++, g = "bl" + u;
    trim = trim || "#fff6ee";
    return "<defs>" + lgr(g, 0, 0, 1, 0.4, [[0, lite(d, 0.2)], [0.45, d], [1, shade(d, 0.4)]]) + "</defs>" +
      '<path d="M14 132 C18 98 37 86 60 86 C83 86 102 98 106 132 Z" fill="url(#' + g + ')"/>' +
      '<g stroke="' + shade(d, 0.4) + '" stroke-width="1.7" fill="none" opacity=".6">' +
      '<path d="M29 132 q8 -24 20 -33 M91 132 q-8 -24 -20 -33"/></g>' +
      '<path d="M21 120 q10 -21 26 -29" stroke="' + lite(d, 0.32) + '" stroke-width="2.2" fill="none" opacity=".5"/>' +
      '<path d="M47 88 L60 102 L73 88 L67 86 L60 93 L53 86 Z" fill="' + trim + '"/>' +
      '<path d="M60 102 V132" stroke="' + shade(d, 0.42) + '" stroke-width="1.2" opacity=".6"/>' +
      '<g fill="' + lite(d, 0.5) + '"><circle cx="60" cy="110" r="1.7"/><circle cx="60" cy="122" r="1.7"/></g>';
  }

  // 카우보이 모자 (스테츤) — 크라운 크리스·챙·모자띠
  function stetson(col, band) {
    var u = uid++, g = "hs" + u, b = "hb" + u;
    band = band || shade(col, 0.55);
    return "<defs>" +
      lgr(g, 0, 0, 0.3, 1, [[0, lite(col, 0.3)], [0.5, col], [1, shade(col, 0.34)]]) +
      lgr(b, 0, 0, 1, 0, [[0, lite(band, 0.2)], [1, shade(band, 0.3)]]) +
      "</defs>" +
      // 크라운
      '<path d="M38 30 C38 12 46 5 60 5 C74 5 82 12 82 30 Z" fill="url(#' + g + ')"/>' +
      // 크리스(가운데 홈)
      '<path d="M60 6 C56 12 55 22 56 30 L64 30 C65 22 64 12 60 6 Z" fill="' + shade(col, 0.3) + '" opacity=".75"/>' +
      '<path d="M47 10 q-4 10 -3 20" stroke="' + lite(col, 0.42) + '" stroke-width="2.2" fill="none" opacity=".6"/>' +
      // 모자띠
      '<path d="M37 26 h46 v7 h-46 Z" fill="url(#' + b + ')"/>' +
      '<circle cx="76" cy="29.5" r="2.4" fill="#d8b048"/><circle cx="75.3" cy="28.8" r="0.9" fill="#ffeaa8"/>' +
      // 챙 (앞뒤로 말린)
      '<path d="M20 33 C20 27 40 24 60 24 C80 24 100 27 100 33 C100 39 80 42 60 42 C40 42 20 39 20 33 Z" fill="' + shade(col, 0.16) + '"/>' +
      '<path d="M20 33 C20 28 40 25 60 25 C80 25 100 28 100 33 C100 31 80 28 60 28 C40 28 20 31 20 33 Z" fill="' + lite(col, 0.24) + '" opacity=".8"/>' +
      '<path d="M24 35 C34 39 48 41 60 41" stroke="' + shade(col, 0.44) + '" stroke-width="1.6" fill="none" opacity=".55"/>';
  }

  // 보안관 별 배지
  function badge(x, y, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = (-90 + i * 36) * Math.PI / 180;
      var rr = i % 2 ? r * 0.44 : r;
      pts.push((x + rr * Math.cos(a)).toFixed(1) + "," + (y + rr * Math.sin(a)).toFixed(1));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="#d8b048" stroke="#8a6a1e" stroke-width="1"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.3 + '" fill="#f2d888"/>';
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
      '<ellipse cx="' + (cx + rx * 0.72) + '" cy="' + (cy + ry * 0.62) + '" rx="' + rx * 1.05 + '" ry="' + ry * 1.05 +
      '" fill="' + shade(fur, 0.42) + '" opacity=".34"/>' +
      '<ellipse cx="' + (cx - rx * 0.2) + '" cy="' + (cy - ry * 0.24) + '" rx="' + rx * 0.95 + '" ry="' + ry * 0.95 +
      '" fill="none" stroke="' + lite(fur, 0.62) + '" stroke-width="5" opacity=".45"/>' +
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
      '<path d="M' + (x - r) + " " + (y - r * 0.5) + " a" + r + " " + r * 1.3 + " 0 0 1 " + r * 2 + ' 0 Z" fill="#2a1c34" opacity=".28"/>' +
      '<circle cx="' + (x - r * 0.36) + '" cy="' + (y - r * 0.52) + '" r="' + r * 0.34 + '" fill="#ffffff" opacity=".95"/>' +
      '<circle cx="' + (x + r * 0.34) + '" cy="' + (y + r * 0.56) + '" r="' + r * 0.18 + '" fill="#ffffff" opacity=".6"/>' +
      '<path d="M' + (x - r * 1.06) + " " + (y - r * 0.62) + " q" + r * 1.06 + " " + -r * 0.72 + " " + r * 2.12 + " 0" +
      '" stroke="#231a2e" stroke-width="' + r * 0.42 + '" fill="none" stroke-linecap="round"/>';
  }

  // 눈 한 쌍 + 표정 (mood: normal | scowl | kind | sly | weary | dead)
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
    // dead: 표정 없이 평평한 눈꺼풀 — 슈거 전용
    if (mood === "dead")
      s += '<g stroke="' + brow + '" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9">' +
        '<path d="M40 40 L57 40 M80 40 L63 40"/></g>';
    return s;
  }

  /* ── 종족 부품 ── */

  // 하운드(사냥개) 늘어진 귀
  function houndEars(ear) {
    var u = uid++, g = "he" + u;
    return "<defs>" + lgr(g, 0, 0, 1, 1, [[0, lite(ear, 0.18)], [0.55, ear], [1, shade(ear, 0.34)]]) + "</defs>" +
      '<path d="M32 32 C18 34 16 64 27 74 C37 68 39 46 38 33 Z" fill="url(#' + g + ')"/>' +
      '<path d="M88 32 C102 34 104 64 93 74 C83 68 81 46 82 33 Z" fill="' + shade(ear, 0.24) + '"/>' +
      '<path d="M30 38 C22 44 21 62 27 70" stroke="' + lite(ear, 0.4) + '" stroke-width="2.4" fill="none" opacity=".5"/>';
  }
  // 개·여우 주둥이
  function snout(muz, nose) {
    var u = uid++, g = "sn" + u;
    muz = muz || "#f6ecd8";
    return "<defs>" + rg(g, "40%", "26%", "78%", [[0, lite(muz, 0.3)], [0.6, muz], [1, shade(muz, 0.2)]]) + "</defs>" +
      '<ellipse cx="60" cy="64" rx="14" ry="10" fill="url(#' + g + ')"/>' +
      '<ellipse cx="60" cy="59.5" rx="5.2" ry="3.8" fill="' + (nose || "#332720") + '"/>' +
      '<ellipse cx="58.4" cy="58.4" rx="1.8" ry="1.2" fill="#6b5a4e"/>' +
      '<path d="M60 63 Q56 69.5 51 66.5 M60 63 Q64 69.5 69 66.5" stroke="#6f5040" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  }
  // 하운드 처진 볼주름 (늙은 개)
  function jowls(fur) {
    return '<path d="M36 58 C33 70 38 82 46 84 C42 74 41 66 42 58 Z" fill="' + shade(fur, 0.22) + '" opacity=".8"/>' +
      '<path d="M84 58 C87 70 82 82 74 84 C78 74 79 66 78 58 Z" fill="' + shade(fur, 0.3) + '" opacity=".8"/>';
  }
  // 흰 콧수염
  function mustache() {
    return '<path d="M60 66 C52 66 44 69 41 74 C48 73 54 71 60 71 C66 71 72 73 79 74 C76 69 68 66 60 66 Z" fill="#efe9dd"/>' +
      '<path d="M60 67 C54 67 48 69 45 72 C51 71 55 70 60 70 Z" fill="#ffffff" opacity=".7"/>';
  }
  // 쥐 귀 (크고 둥근)
  function ratEars(fur, inner) {
    var u = uid++, g = "re" + u;
    return "<defs>" + rg(g, "40%", "40%", "70%", [[0, lite(inner, 0.2)], [1, shade(inner, 0.3)]]) + "</defs>" +
      '<circle cx="33" cy="25" r="14.5" fill="' + lite(fur, 0.1) + '"/><circle cx="33" cy="25" r="8.6" fill="url(#' + g + ')"/>' +
      '<circle cx="87" cy="25" r="14.5" fill="' + shade(fur, 0.2) + '"/><circle cx="87" cy="25" r="8.6" fill="' + shade(inner, 0.22) + '"/>';
  }
  // 쥐 주둥이 + 수염
  function ratMuzzle(muz) {
    muz = muz || "#c0c0ca";
    return '<ellipse cx="60" cy="65" rx="11" ry="8" fill="' + muz + '"/>' +
      '<ellipse cx="60" cy="61" rx="4.2" ry="3.2" fill="#c07884"/>' +
      '<ellipse cx="58.8" cy="60" rx="1.6" ry="1" fill="#e8a8b0"/>' +
      '<path d="M60 64 Q56 69 52 66.6 M60 64 Q64 69 68 66.6" stroke="#6a5a60" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<g stroke="rgba(238,238,246,.72)" stroke-width="1.3" stroke-linecap="round">' +
      '<path d="M29 58 L46 62 M28 66 L46 66 M30 73 L46 69 M91 58 L74 62 M92 66 L74 66 M90 73 L74 69"/></g>';
  }
  // 닭 볏 + 부리 + 턱볏
  function comb(col) {
    return '<path d="M46 26 q5 -14 10 -2 q5 -13 10 -1 q5 -12 9 1 L74 32 L46 32 Z" fill="' + col + '"/>' +
      '<path d="M48 26 q4 -10 8 -1 q4 -9 8 0" fill="none" stroke="' + lite(col, 0.4) + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
  }
  function beakHen(col, wattle) {
    return '<path d="M52 60 L60 55 L68 60 L60 66 Z" fill="' + col + '"/>' +
      '<path d="M52 60 L60 55 L60 60 Z" fill="' + lite(col, 0.35) + '"/>' +
      '<path d="M52 60 L68 60" stroke="' + shade(col, 0.4) + '" stroke-width="1.2"/>' +
      '<path d="M54 66 q-3 9 2 11 q5 -3 3 -11 Z" fill="' + wattle + '"/>' +
      '<path d="M66 66 q3 9 -2 11 q-5 -3 -3 -11 Z" fill="' + shade(wattle, 0.2) + '"/>';
  }
  // 맹금 부리 (송골매)
  function beakHawk(col) {
    return '<path d="M53 56 L60 53 L67 56 L64 63 Q60 68 56 63 Z" fill="' + col + '"/>' +
      '<path d="M60 62 q-3 8 0 11 q3 -3 0 -11 Z" fill="' + shade(col, 0.35) + '"/>' +
      '<path d="M53 56 L60 53 L60 58 Z" fill="' + lite(col, 0.32) + '"/>' +
      '<circle cx="55.5" cy="57.5" r="1.1" fill="#2a2028"/><circle cx="64.5" cy="57.5" r="1.1" fill="#2a2028"/>';
  }
  // 고양이 귀·주둥이 (히치하이커 소녀)
  function catEars(fur, inner) {
    var u = uid++, g = "ce" + u;
    return "<defs>" + lgr(g, 0, 0, 0, 1, [[0, lite(inner, 0.2)], [1, shade(inner, 0.3)]]) + "</defs>" +
      '<path d="M31 36 L36 8 L54 24 Z" fill="' + lite(fur, 0.12) + '"/>' +
      '<path d="M36 30 L38.5 15 L48 24 Z" fill="url(#' + g + ')"/>' +
      '<path d="M89 36 L84 8 L66 24 Z" fill="' + shade(fur, 0.2) + '"/>' +
      '<path d="M84 30 L81.5 15 L72 24 Z" fill="url(#' + g + ')"/>';
  }
  function catMuzzle(muz) {
    muz = muz || "#fff2e4";
    return '<ellipse cx="60" cy="63" rx="12" ry="8.5" fill="' + muz + '"/>' +
      '<path d="M56.5 59 L63.5 59 L60 63.6 Z" fill="#dd8892"/>' +
      '<path d="M57.4 59.7 L60 59.7 L58.8 61.6 Z" fill="#f2b0b8"/>' +
      '<path d="M60 63.6 Q56 68.6 51.5 65.6 M60 63.6 Q64 68.6 68.5 65.6" stroke="#6f5040" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<g stroke="rgba(255,255,255,.8)" stroke-width="1.3" stroke-linecap="round">' +
      '<path d="M30 55 L44 58 M29 62 L44 62 M31 69 L45 66 M90 55 L76 58 M91 62 L76 62 M89 69 L75 66"/></g>';
  }
  // 여우 귀 (뾰족하고 큰)
  function foxEars(fur, inner) {
    return '<path d="M28 38 L33 6 L55 26 Z" fill="' + lite(fur, 0.1) + '"/>' +
      '<path d="M34 31 L36 14 L47 25 Z" fill="' + inner + '"/>' +
      '<path d="M92 38 L87 6 L65 26 Z" fill="' + shade(fur, 0.22) + '"/>' +
      '<path d="M86 31 L84 14 L73 25 Z" fill="' + shade(inner, 0.2) + '"/>';
  }

  function wrap(inner) {
    return '<svg viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg">' + inner + "</svg>";
  }

  /* ── 캐릭터별 초상 ── */
  var B = {};

  // 모구 — 실사 얼굴 + 데님 웨스턴 셔츠 + 스테츤 (르웰린 모스)
  B.mogu = function () {
    var u = uid++, cp = "mgc" + u, rl = "mgr" + u;
    return wrap(
      neck("#8a8274") +
      shirt({ body: "#3f5878", yoke: "#33496a", snap: "#e6e2d4" }) +
      "<defs>" +
      '<clipPath id="' + cp + '"><circle cx="60" cy="49" r="31"/></clipPath>' +
      rg(rl, "34%", "26%", "76%", [[0, "#ffffff", 0.34], [0.62, "#ffffff", 0], [1, "#2a2438", 0.34]]) +
      "</defs>" +
      // 멧돼지 송곳니 목걸이 (원작의 금 목걸이)
      '<path d="M44 92 Q60 104 76 92" stroke="#c8a848" stroke-width="1.8" fill="none"/>' +
      '<path d="M58 100 L57 112 L62.5 112 L61.6 101 Z" fill="#f2ecda"/>' +
      '<path d="M58 100 L57.6 109 L59.4 109 L59.8 101 Z" fill="#fffaf0"/>' +
      '<circle cx="60" cy="49" r="32.5" fill="#161a24"/>' +
      '<image href="' + NS.ASSETS.mogu + '" x="25" y="14" width="70" height="70" clip-path="url(#' + cp + ')" preserveAspectRatio="xMidYMid slice"/>' +
      // 사진 위에도 같은 광원의 셰이딩을 얹어 드로잉과 톤을 맞춘다
      '<circle cx="60" cy="49" r="31" fill="url(#' + rl + ')"/>' +
      '<path d="M33 38 A31 31 0 0 1 68 19" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.6" stroke-linecap="round"/>' +
      stetson("#c8a878", "#5a4028")
    );
  };

  // 슈거 — 잿빛 시궁쥐, 창백한 푸른 눈, 일자 단발, 산소탱크 호스
  B.sugar = function () {
    var fur = "#8e8e98";
    var u = uid++, hr = "sgh" + u;
    return wrap(
      neck(fur) +
      // 어두운 데님 셔츠 (원작의 검은 옷차림)
      shirt({ body: "#2a3040", yoke: "#222736", snap: "#9aa0ac" }) +
      // 소매에서 나온 캐틀건 고무 호스
      '<path d="M20 132 C24 116 30 108 40 104" stroke="#1c2028" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M20 132 C24 116 30 108 40 104" stroke="#3a4250" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="41" cy="103" r="4.4" fill="#4a525e"/><circle cx="41" cy="103" r="1.8" fill="#161a20"/>' +
      ratEars(fur, "#b09098") +
      head(60, 54, 27.5, 25.5, fur) +
      // 일자 단발 (영화·원작의 상징적 머리 모양)
      "<defs>" + lgr(hr, 0, 0, 0, 1, [[0, "#4a4650"], [1, "#2a2830"]]) + "</defs>" +
      '<path d="M32 44 C32 22 44 12 60 12 C76 12 88 22 88 44 L88 34 C80 30 70 28 60 28 C50 28 40 30 32 34 Z" fill="url(#' + hr + ')"/>' +
      '<path d="M32 34 C40 30 50 28 60 28 C70 28 80 30 88 34 L88 44 L82 44 C78 36 70 33 60 33 C50 33 42 36 38 44 L32 44 Z" fill="#3a3742"/>' +
      '<path d="M36 30 C42 25 50 23 58 23" stroke="#6a6470" stroke-width="2" fill="none" opacity=".6"/>' +
      eyes("dead", "#6ea8c8", 5.2) +
      ratMuzzle() +
      // 앞니
      '<path d="M57 70 L57 76 L59.4 76 L59.4 70 Z" fill="#f2eede"/>' +
      '<path d="M60.6 70 L60.6 76 L63 76 L63 70 Z" fill="#e6e2d2"/>'
    );
  };

  // 벨 보안관 — 늙은 블러드하운드, 흰 콧수염, 별 배지
  B.bell = function () {
    var fur = "#a87e58";
    return wrap(
      neck(fur) +
      shirt({ body: "#8a8f78", yoke: "#767b64", snap: "#e8e4d4" }) +
      badge(36, 106, 9) +
      houndEars("#8a6444") +
      head(60, 54, 28, 26, fur) +
      jowls(fur) +
      eyes("weary", "#6a5230", 5.2) +
      snout("#e8dcc4", "#3a2c22") +
      mustache() +
      stetson("#8a7250", "#4a3a24")
    );
  };

  // 꼬꼬 진 — 열아홉 살 붉은 깃 암탉 (칼라 진 모스)
  B.kko = function () {
    var fur = "#f2e4cc";
    return wrap(
      neck(fur) +
      blouse("#c85a58", "#fff2e2") +
      comb("#e0384a") +
      head(60, 52, 27, 25.5, fur) +
      eyes("kind", "#8a5a2a", 5.4) +
      beakHen("#e8b048", "#e0384a") +
      // 붉은 깃털 다발
      '<path d="M30 40 q-10 -8 -6 -18 q8 4 10 14 Z" fill="#c85040"/>' +
      '<path d="M90 40 q10 -8 6 -18 q-8 4 -10 14 Z" fill="#a8402e"/>' +
      // 월마트 앞치마 끈
      '<path d="M46 92 L38 132 M74 92 L82 132" stroke="#3a5a8a" stroke-width="3.4" fill="none"/>'
    );
  };

  // 어머니 꼬꼬 — 늙은 암탉, 흐린 깃, 암 환자
  B.granny = function () {
    var fur = "#ded4c2";
    return wrap(
      neck(fur) +
      blouse("#4a4a58", "#d8d2c4") +
      comb("#a86068") +
      head(60, 53, 26.5, 25, fur) +
      eyes("scowl", "#6a5a48", 5) +
      beakHen("#c8a878", "#a86068") +
      // 노안경
      '<g fill="none" stroke="#6a6058" stroke-width="1.8">' +
      '<circle cx="48.5" cy="50" r="9"/><circle cx="71.5" cy="50" r="9"/>' +
      '<path d="M57.5 50 h5 M39.5 48 l-7 -3 M80.5 48 l7 -3"/></g>' +
      '<g fill="rgba(220,235,245,.2)"><circle cx="48.5" cy="50" r="8"/><circle cx="71.5" cy="50" r="8"/></g>'
    );
  };

  // 웰스 — 송골매, 루케제 부츠의 청부업자
  B.wells = function () {
    var fur = "#9a8878";
    return wrap(
      neck(fur) +
      suit({ coat: "#5a5040", lapel: "#463e30", shirt: "#e8e2d2", tie: "#7a4a3a" }) +
      head(60, 53, 27, 25.5, fur) +
      // 맹금 두건 무늬 (눈 아래로 흐르는 짙은 줄)
      '<path d="M44 44 C40 56 42 68 48 76 L54 74 C48 66 46 56 48 46 Z" fill="#5a4a3e" opacity=".85"/>' +
      '<path d="M76 44 C80 56 78 68 72 76 L66 74 C72 66 74 56 72 46 Z" fill="#4a3c32" opacity=".85"/>' +
      eyes("sly", "#c8a030", 5.2) +
      beakHawk("#4a4038") +
      // 정수리 깃
      '<path d="M40 32 q8 -14 20 -16 q12 2 20 16 q-20 -8 -40 0 Z" fill="#6a5a4a"/>' +
      '<path d="M46 30 q7 -9 14 -11" stroke="#8a7a68" stroke-width="2" fill="none" opacity=".6"/>'
    );
  };

  // 웬델 — 젊은 폭스하운드 부관
  B.wendell = function () {
    var fur = "#d8b878";
    return wrap(
      neck(fur) +
      shirt({ body: "#6a7a5a", yoke: "#5a6a4c", snap: "#e8e4d4" }) +
      badge(36, 106, 8) +
      houndEars("#a87840") +
      head(60, 53, 27, 25, fur) +
      eyes("normal", "#5a7a3a", 5.4) +
      snout("#f2e8d0", "#3a2c22") +
      stetson("#b09868", "#5a4830")
    );
  };

  // 엘리스 — 휠체어의 늙은 하운드
  B.ellis = function () {
    var fur = "#b0a898";
    return wrap(
      neck(fur) +
      shirt({ body: "#7a6a58", yoke: "#68594a", snap: "#d8d2c2" }) +
      // 휠체어 등받이·바퀴 테
      '<path d="M12 132 V104 h10 v28 M108 132 V104 h-10 v28" stroke="#4a4a52" stroke-width="4" fill="none"/>' +
      '<path d="M8 128 a22 22 0 0 1 22 -18 M112 128 a22 22 0 0 0 -22 -18" stroke="#5a5a64" stroke-width="3" fill="none" opacity=".8"/>' +
      houndEars("#98907e") +
      head(60, 54, 27.5, 26, fur) +
      jowls(fur) +
      // 선인장 가시에 찔린 흐린 왼눈 (원작)
      eye(71.5, 50, 5.2, "#6a5230") +
      '<ellipse cx="48.5" cy="50" rx="5.1" ry="6.8" fill="#e2ddd2"/>' +
      '<ellipse cx="48.5" cy="50.3" rx="4.3" ry="6" fill="#c8c4bc"/>' +
      '<ellipse cx="48.5" cy="50.7" rx="2.1" ry="3.2" fill="#a8a49c"/>' +
      '<path d="M43.4 46.9 a5.2 6.8 0 0 1 10.2 0 Z" fill="#2a1c34" opacity=".28"/>' +
      '<g stroke="#4a3c22" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7">' +
      '<path d="M41 40 Q48.5 43 56 41 M79 40 Q71.5 43 64 41"/></g>' +
      snout("#ded6c4", "#4a3c30") +
      mustache()
    );
  };

  // 로레타 — 벨의 아내
  B.loretta = function () {
    var fur = "#c8a880";
    return wrap(
      neck(fur) +
      blouse("#6a8a9a", "#fff4e6") +
      houndEars("#a88458") +
      head(60, 53, 27, 25.5, fur) +
      eyes("kind", "#6a5a38", 5.4) +
      snout("#f2e8d4", "#3a2c22") +
      // 은발 웨이브
      '<path d="M32 40 C30 22 44 12 60 12 C76 12 90 22 88 40 C84 28 74 22 60 22 C46 22 36 28 32 40 Z" fill="#d8d0c2"/>' +
      '<path d="M38 30 C44 22 52 19 60 19" stroke="#f0eae0" stroke-width="2.4" fill="none" opacity=".7"/>'
    );
  };

  // 히치하이커 소녀 — 열다섯, 붉은 얼룩 새끼 고양이
  B.girl = function () {
    var fur = "#e8a878";
    return wrap(
      neck(fur) +
      // 티셔츠 + 배낭 어깨끈
      shirt({ body: "#d8d0c0", yoke: "#c8c0b0", snap: "#a8a090" }) +
      '<path d="M40 90 L34 132 M80 90 L86 132" stroke="#2a5aa8" stroke-width="5" fill="none"/>' +
      catEars(fur, "#f8d0b8") +
      head(60, 52, 26, 24.5, fur) +
      '<g stroke="#c07840" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85">' +
      '<path d="M50 26 L52 34 M60 24 L60 33 M70 26 L68 34"/></g>' +
      eyes("normal", "#4a8a6a", 5.6) +
      catMuzzle() +
      // 붉은 앞머리
      '<path d="M36 34 C40 20 50 14 60 14 C70 14 80 20 84 34 C76 26 68 23 60 23 C52 23 44 26 36 34 Z" fill="#d8683a"/>'
    );
  };

  // 매킨타이어 — 마약단속국 회색 여우
  B.mac = function () {
    var fur = "#9aa0a8";
    return wrap(
      neck(fur) +
      shirt({ body: "#5a6a5a", yoke: "#4c5a4c", snap: "#d8d4c8" }) +
      // 클립보드
      '<g transform="rotate(-8 26 116)"><rect x="14" y="98" width="26" height="34" rx="2" fill="#c8a870"/>' +
      '<rect x="17" y="102" width="20" height="28" fill="#f2eee2"/>' +
      '<rect x="20" y="96" width="14" height="5" rx="2" fill="#8a8a92"/></g>' +
      foxEars(fur, "#3a3a42") +
      head(60, 53, 26.5, 25, fur) +
      eyes("normal", "#8a7a3a", 5.2) +
      snout("#e2e6ea", "#2a2a32") +
      stetson("#7a8078", "#3a4038")
    );
  };

  // 사장 — 휴스턴 17층의 정장 두꺼비
  B.boss = function () {
    var fur = "#7a8a5a";
    return wrap(
      neck(fur) +
      suit({ coat: "#2a2e38", lapel: "#1e222a", shirt: "#f0eee6", tie: "#6a2a34" }) +
      head(60, 56, 32, 25, fur) +
      // 두꺼비 눈두덩 (머리 위로 솟은)
      '<circle cx="44" cy="36" r="11" fill="' + lite(fur, 0.14) + '"/><circle cx="76" cy="36" r="11" fill="' + shade(fur, 0.2) + '"/>' +
      eye(44, 36, 6, "#c8a030") + eye(76, 36, 6, "#c8a030") +
      // 넓은 입
      '<path d="M34 62 Q60 76 86 62" stroke="#3a3a2a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M36 62 Q60 72 84 62 Q60 66 36 62 Z" fill="#4a4a34" opacity=".5"/>' +
      // 사마귀
      '<g fill="' + shade(fur, 0.28) + '"><circle cx="46" cy="56" r="2.4"/><circle cx="72" cy="54" r="2"/><circle cx="62" cy="48" r="1.8"/></g>'
    );
  };

  // 코요테 — 카르텔 하수인
  B.coyote = function () {
    var fur = "#a89078";
    return wrap(
      neck(fur) +
      // 구아야베라 셔츠 (녹색, 세로 주름)
      shirt({ body: "#4a7a58", yoke: "#3e6a4c", snap: "#e8e4d4" }) +
      '<g stroke="' + shade("#4a7a58", 0.35) + '" stroke-width="1.3" opacity=".7" fill="none">' +
      '<path d="M46 94 V132 M52 94 V132 M68 94 V132 M74 94 V132"/></g>' +
      foxEars(fur, "#5a4838") +
      head(60, 53, 26.5, 25, fur) +
      eyes("scowl", "#8a6a2a", 5.2) +
      snout("#d8c8b0", "#2a2018")
    );
  };

  // 모구의 아버지 — 샌사바의 늙은 고양이
  B.dad = function () {
    var fur = "#b8b0a4";
    return wrap(
      neck(fur) +
      shirt({ body: "#7a7a6a", yoke: "#68685a", snap: "#d8d4c8" }) +
      catEars(fur, "#d8c8bc") +
      head(60, 54, 27, 25.5, fur) +
      eyes("weary", "#5a6a5a", 5.2) +
      catMuzzle("#e8e2d8") +
      mustache()
    );
  };

  // 디마코 — 사고 현장의 강아지 소년
  B.boy = function () {
    var fur = "#c8a068";
    return wrap(
      neck(fur) +
      shirt({ body: "#b83a4a", yoke: "#a03242", snap: "#f0ece0" }) +
      houndEars("#a87844") +
      head(60, 53, 25.5, 24, fur) +
      eyes("sly", "#5a7a4a", 5.6) +
      snout("#efe4cc", "#3a2c22")
    );
  };

  P.svg = function (id) {
    var b = B[id];
    if (b) return b();
    var c = NS.CHARS[id] || {};
    return wrap('<text x="60" y="72" font-size="56" text-anchor="middle">' + (c.icon || "🐾") + "</text>");
  };
})();
