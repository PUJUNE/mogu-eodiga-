// scenes.js — 장소·시간대별 SVG 배경 장면 23종 (960×540, slice 커버)
// 화풍: 신카이 마코토·호소다 마모루 계열 애니 배경 문법
//   ① 다층 그라디언트 하늘 ② 림라이트 구름 ③ god ray(광선)·블룸 ④ 대기 원근(먼 층일수록
//   하늘색으로 수렴) ⑤ 전경 실루엣 + 얕은 심도 블러 ⑥ 공기 중 먼지·보케 입자
// 무대: 1980년 텍사스 서부 국경 — 치와와 사막, 리오그란데, 모텔, 국경 다리, 소도시.
// 인물 안전지대: x 340~620 / y 260~385 에는 초점 오브젝트를 두지 않는다.
// 외부 이미지 없이 오프라인 단일 파일 유지.
(function () {
  "use strict";
  var NS = (window.MNC = window.MNC || {});
  var SC = (NS.Scenes = {});

  var W = 960, H = 540;
  var uid = 0;
  function nid(p) { return p + (uid++); }

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
  // 대기 원근: 거리 t만큼 하늘색으로 수렴
  function aerial(col, skyCol, t) { return mix(col, skyCol, t); }

  /* ── 결정적 의사난수 (렌더마다 같은 그림) ── */
  function rnd(i) {
    var v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  /* ── defs 부품 ── */
  function lg(id, x1, y1, x2, y2, stops) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") +
      "</linearGradient>";
  }
  function rg(id, cx, cy, r, stops) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : "") + "/>"; }).join("") +
      "</radialGradient>";
  }
  function blur(id, sd) {
    return '<filter id="' + id + '" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }

  /* ── 공통 그림 부품 ── */

  function ray(x, y, ang, w, len, col, op) {
    var a1 = (ang - w) * Math.PI / 180, a2 = (ang + w) * Math.PI / 180;
    return '<path d="M' + x + " " + y +
      " L" + (x + len * Math.cos(a1)).toFixed(1) + " " + (y + len * Math.sin(a1)).toFixed(1) +
      " L" + (x + len * Math.cos(a2)).toFixed(1) + " " + (y + len * Math.sin(a2)).toFixed(1) +
      ' Z" fill="' + col + '" opacity="' + op + '"/>';
  }
  function rays(x, y, spec, col, fid) {
    return '<g filter="url(#' + fid + ')">' +
      spec.map(function (s) { return ray(x, y, s[0], s[1], s[2], col, s[3]); }).join("") + "</g>";
  }
  // 뭉게구름 — 바닥은 그늘, 윗면은 역광 림
  function cloud(cx, cy, s, base, rim, op) {
    function e(dx, dy, rx, ry, c, o) {
      return '<ellipse cx="' + (cx + dx * s).toFixed(1) + '" cy="' + (cy + dy * s).toFixed(1) +
        '" rx="' + (rx * s).toFixed(1) + '" ry="' + (ry * s).toFixed(1) + '" fill="' + c + '"' +
        (o != null ? ' opacity="' + o + '"' : "") + "/>";
    }
    return '<g opacity="' + op + '">' +
      e(0, 0, 62, 21, base) + e(-40, 5, 38, 15, base) + e(42, 7, 34, 14, base) +
      e(-14, -13, 36, 21, base) + e(22, -15, 30, 18, base) + e(2, -24, 24, 15, base) +
      e(-14, -22, 30, 12, rim, 0.9) + e(20, -24, 24, 11, rim, 0.85) + e(2, -32, 18, 8, rim, 0.75) +
      e(-40, -3, 26, 8, rim, 0.5) + e(42, 0, 22, 7, rim, 0.5) +
      "</g>";
  }
  function cirrus(y, col, op, n, seed) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = rnd(seed + i) * W;
      var w = 60 + rnd(seed + i + 40) * 190;
      var yy = y + (rnd(seed + i + 80) - 0.5) * 70;
      var h = 3 + rnd(seed + i + 120) * 5;
      s += '<ellipse cx="' + x.toFixed(0) + '" cy="' + yy.toFixed(0) + '" rx="' + w.toFixed(0) + '" ry="' + h.toFixed(1) + '" fill="' + col + '"/>';
    }
    return '<g opacity="' + op + '">' + s + "</g>";
  }
  function motes(n, seed, col, x0, y0, w, h, rmax, opMax) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = x0 + rnd(seed + i) * w;
      var y = y0 + rnd(seed + i + 60) * h;
      var r = 1 + rnd(seed + i + 120) * rmax;
      var o = (0.25 + rnd(seed + i + 180) * 0.75) * opMax;
      s += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + r.toFixed(1) + '" fill="' + col + '" opacity="' + o.toFixed(2) + '"/>';
    }
    return s;
  }
  function grass(y0, n, col, hgt, op, seed, x0, x1) {
    x0 = x0 || 0; x1 = x1 || W;
    var s = "", span = x1 - x0;
    for (var i = 0; i < n; i++) {
      var x = x0 + (i + 0.5) * span / n + (rnd(seed + i) - 0.5) * span / n * 1.1;
      var hh = hgt * (0.55 + rnd(seed + i + 50) * 0.9);
      var bend = (rnd(seed + i + 100) - 0.5) * 44;
      s += '<path d="M' + x.toFixed(1) + " " + y0 + " q" + (bend * 0.4).toFixed(1) + " " + (-hh * 0.62).toFixed(1) +
        " " + bend.toFixed(1) + " " + (-hh).toFixed(1) + '" stroke="' + col + '" stroke-width="' + (2 + rnd(seed + i + 150) * 2.2).toFixed(1) +
        '" fill="none" stroke-linecap="round"/>';
    }
    return '<g opacity="' + op + '">' + s + "</g>";
  }
  function ridge(pts, col, op) {
    var d = "M0 " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], q = pts[i - 1];
      var mx = (q[0] + p[0]) / 2;
      d += " Q" + q[0] + " " + q[1] + " " + mx + " " + ((q[1] + p[1]) / 2).toFixed(0);
    }
    d += " T" + W + " " + pts[pts.length - 1][1] + " L" + W + " " + H + " L0 " + H + " Z";
    return '<path d="' + d + '" fill="' + col + '"' + (op != null ? ' opacity="' + op + '"' : "") + "/>";
  }
  function orb(x, y, r, core, gid) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r * 5 + '" fill="url(#' + gid + ')"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + core + '"/>';
  }
  function birds(list, col, sc) {
    sc = sc || 1;
    return list.map(function (p) {
      var s = (p[2] || 1) * sc;
      return '<path d="M' + p[0] + " " + p[1] + " q" + 6 * s + " " + -6 * s + " " + 12 * s + " 0 q" + 6 * s + " " + -6 * s + " " + 12 * s +
        ' 0" stroke="' + col + '" stroke-width="' + (1.6 * s).toFixed(1) + '" fill="none" stroke-linecap="round"/>';
    }).join("");
  }

  /* ── 사막 전용 부품 ── */

  // 메사·뷰트 (평평한 꼭대기의 사암 지형)
  function mesa(x, baseY, w, h, lit, drk) {
    var t = w * 0.62;
    return '<path d="M' + (x - w / 2) + " " + baseY + " L" + (x - t / 2) + " " + (baseY - h) +
      " L" + (x + t / 2) + " " + (baseY - h) + " L" + (x + w / 2) + " " + baseY + ' Z" fill="' + drk + '"/>' +
      '<path d="M' + (x - w / 2) + " " + baseY + " L" + (x - t / 2) + " " + (baseY - h) +
      " L" + (x - t / 2 + t * 0.34) + " " + (baseY - h) + " L" + (x - w / 2 + w * 0.3) + " " + baseY + ' Z" fill="' + lit + '"/>' +
      '<path d="M' + (x - t / 2) + " " + (baseY - h) + " L" + (x + t / 2) + " " + (baseY - h) +
      " L" + (x + t / 2 - 6) + " " + (baseY - h + 7) + " L" + (x - t / 2 + 6) + " " + (baseY - h + 7) + ' Z" fill="' + lit + '" opacity=".75"/>' +
      // 침식 세로 홈
      '<g stroke="' + mix(drk, "#000000", 0.24) + '" stroke-width="2.4" opacity=".45" fill="none">' +
      '<path d="M' + (x - w * 0.22) + " " + (baseY - h + 8) + " L" + (x - w * 0.3) + " " + baseY +
      " M" + (x + w * 0.1) + " " + (baseY - h + 6) + " L" + (x + w * 0.16) + " " + baseY +
      " M" + (x + w * 0.3) + " " + (baseY - h + 10) + " L" + (x + w * 0.38) + " " + baseY + '"/></g>';
  }
  // 사와로 선인장
  function saguaro(x, y, s, lit, drk) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')">' +
      '<path d="M-7 0 L-7 -84 q0 -12 7 -12 q7 0 7 12 L7 0 Z" fill="' + drk + '"/>' +
      '<path d="M-7 0 L-7 -84 q0 -12 5 -12 L-2 0 Z" fill="' + lit + '"/>' +
      '<path d="M-7 -50 q-16 0 -18 14 L-25 -22 q0 6 5 6 q5 0 5 -6 L-15 -34 q0 -8 8 -8 Z" fill="' + drk + '"/>' +
      '<path d="M7 -60 q16 0 18 14 L25 -34 q0 6 -5 6 q-5 0 -5 -6 L15 -44 q0 -8 -8 -8 Z" fill="' + drk + '"/>' +
      '<path d="M-25 -22 q0 6 4 6 L-21 -44 q0 -8 6 -10 L-15 -34 q0 -8 8 -8 L-7 -50 q-16 0 -18 14 Z" fill="' + lit + '" opacity=".5"/>' +
      '<g stroke="' + mix(drk, "#000000", 0.3) + '" stroke-width="1.4" opacity=".5">' +
      '<path d="M-3 -92 V-4 M3 -92 V-4"/></g></g>';
  }
  // 크레오소트·메스키트 덤불
  function bush(x, y, s, col, op) {
    var d = "";
    for (var i = 0; i < 9; i++) {
      var a = rnd(x + i) * Math.PI * 2, r = (0.35 + rnd(x + i + 30) * 0.65) * s;
      d += '<ellipse cx="' + (x + Math.cos(a) * s * 0.5).toFixed(1) + '" cy="' + (y - Math.abs(Math.sin(a)) * s * 0.44).toFixed(1) +
        '" rx="' + r.toFixed(1) + '" ry="' + (r * 0.62).toFixed(1) + '" fill="' + col + '"/>';
    }
    return '<g opacity="' + (op == null ? 1 : op) + '">' + d + "</g>";
  }
  // 회전초
  function tumble(x, y, s, col) {
    var d = "";
    for (var i = 0; i < 10; i++) {
      var a = i * 36 * Math.PI / 180;
      d += '<path d="M' + x + " " + y + " q" + (Math.cos(a) * s * 0.7).toFixed(1) + " " + (Math.sin(a) * s * 0.7).toFixed(1) +
        " " + (Math.cos(a + 0.5) * s).toFixed(1) + " " + (Math.sin(a + 0.5) * s).toFixed(1) + '"/>';
    }
    return '<g stroke="' + col + '" stroke-width="1.6" fill="none" opacity=".85">' + d + "</g>";
  }
  // 총알 세례를 받은 픽업/브롱코 실루엣
  function truck(x, y, s, body, dark, holes) {
    var g = '<g transform="translate(' + x + " " + y + ") scale(" + s + ')">' +
      '<path d="M-84 0 L-84 -30 L-56 -30 L-44 -56 L26 -56 L34 -30 L84 -30 L84 0 Z" fill="' + body + '"/>' +
      '<path d="M-44 -52 L22 -52 L29 -32 L-52 -32 Z" fill="' + mix(dark, "#8fb0d0", 0.35) + '" opacity=".7"/>' +
      '<path d="M-84 -30 L-84 -12 L84 -12 L84 -30 Z" fill="' + dark + '" opacity=".55"/>' +
      '<circle cx="-50" cy="2" r="18" fill="#1a1a20"/><circle cx="-50" cy="2" r="8" fill="#3a3a44"/>' +
      '<circle cx="52" cy="2" r="18" fill="#141418"/><circle cx="52" cy="2" r="8" fill="#32323c"/>';
    if (holes) {
      var hd = "";
      for (var i = 0; i < 14; i++)
        hd += '<circle cx="' + (-78 + i * 11.4).toFixed(0) + '" cy="' + (-42 + rnd(i + x) * 26).toFixed(0) + '" r="2.4"/>';
      g += '<g fill="#101014" opacity=".85">' + hd + "</g>";
    }
    return g + "</g>";
  }

  /* ── 실내 전용 부품 ── */

  // 방 상자 — 뒷벽 + 바닥 + 좌우 벽 원근
  function room(wall, wallDark, floor, floorDark) {
    return '<rect width="' + W + '" height="' + H + '" fill="' + wall + '"/>' +
      '<path d="M0 0 L150 96 L150 420 L0 540 Z" fill="' + wallDark + '"/>' +
      '<path d="M' + W + ' 0 L810 96 L810 420 L' + W + " " + H + ' Z" fill="' + wallDark + '"/>' +
      '<path d="M0 540 L150 420 L810 420 L' + W + ' 540 Z" fill="' + floor + '"/>' +
      '<path d="M150 420 L810 420 L810 428 L150 428 Z" fill="' + floorDark + '" opacity=".6"/>';
  }
  // 창에서 들어오는 빛기둥 + 바닥 채광 사각형
  function windowLight(x, y, w, h, col, fid, skew) {
    skew = skew == null ? 120 : skew;
    return '<g filter="url(#' + fid + ')" opacity=".5">' +
      '<path d="M' + x + " " + y + " L" + (x + w) + " " + y + " L" + (x + w + skew) + " " + (y + h) +
      " L" + (x + skew) + " " + (y + h) + ' Z" fill="' + col + '"/></g>';
  }
  // 창틀 (격자)
  function windowFrame(x, y, w, h, frame, glassGid) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#' + glassGid + ')"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="' + frame + '" stroke-width="9"/>' +
      '<path d="M' + (x + w / 2) + " " + y + " V" + (y + h) + " M" + x + " " + (y + h / 2) + " H" + (x + w) +
      '" stroke="' + frame + '" stroke-width="6"/>';
  }
  // 형광등·전구 불빛
  function lampGlow(x, y, r, col, fid) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '" opacity=".24" filter="url(#' + fid + ')"/>';
  }

  var S = {};

  /* ════════ 사막 ════════ */

  // 1. 새벽 화산 마루 — 영양 사냥 (원작 I장)
  S.desert_dawn = function () {
    var sky = nid("sk"), sun = nid("sn"), bl = nid("bl"), gr = nid("gd");
    var SKY = "#f0b878";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#2c3a62"], [0.24, "#5a5a86"], [0.46, "#a8709a"], [0.66, "#e89a7a"], [0.84, "#f6c88a"], [1, "#fbe0ac"]]) +
      rg(sun, "50%", "50%", "50%", [[0, "#fff4d0", 0.9], [0.4, "#ffcf88", 0.4], [1, "#ffb060", 0]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#8a6a52"], [1, "#5a4436"]]) +
      blur(bl, 22) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(96, "#ffd8b0", 0.5, 12, 7) + cirrus(160, "#f0a890", 0.34, 8, 41) +
      orb(742, 268, 27, "#fff6dc", sun) +
      rays(742, 268, [[188, 2.6, 620, 0.14], [200, 1.8, 540, 0.11], [214, 2.2, 470, 0.1], [172, 2, 560, 0.12], [160, 1.6, 480, 0.09]], "#ffe0a8", bl) +
      cloud(180, 132, 0.9, "#8a6a86", "#ffc8a0", 0.7) + cloud(600, 100, 0.66, "#7a5a7c", "#ffbb96", 0.55) +
      // 먼 산 — 대기 원근
      ridge([[0, 292], [180, 274], [340, 288], [520, 266], [700, 282], [880, 268], [960, 280]], aerial("#4a3c54", SKY, 0.62), 1) +
      ridge([[0, 318], [200, 306], [420, 318], [640, 300], [820, 316], [960, 306]], aerial("#4a3a48", SKY, 0.42), 1) +
      // 헤이즈 밴드
      '<rect x="0" y="292" width="960" height="42" fill="#ffcfa0" opacity=".2" filter="url(#' + bl + ')"/>' +
      // 범람원
      '<path d="M0 336 L960 322 L960 540 L0 540 Z" fill="url(#' + gr + ')"/>' +
      '<path d="M0 336 L960 322 L960 352 L0 368 Z" fill="#a88462" opacity=".5"/>' +
      mesa(112, 336, 190, 74, "#a06848", "#6e4634") +
      mesa(866, 330, 160, 58, "#9a6444", "#684230") +
      // 전경 용암 마루
      '<path d="M0 470 Q140 424 300 452 Q420 472 520 448 Q680 414 820 448 Q900 466 960 442 L960 540 L0 540 Z" fill="#4a3628"/>' +
      '<path d="M0 470 Q140 424 300 452 Q420 472 520 448 Q680 414 820 448 Q900 466 960 442 L960 458 Q880 480 800 462 Q660 430 520 464 Q420 488 300 468 Q150 442 0 486 Z" fill="#6e5138" opacity=".7"/>' +
      saguaro(148, 496, 1.1, "#5a7a4a", "#33502e") +
      saguaro(838, 478, 0.85, "#547246", "#2e4a2a") +
      bush(258, 500, 30, "#3a4a30", 0.85) + bush(700, 492, 26, "#36462e", 0.8) +
      grass(524, 40, "#33261c", 34, 0.6, 11) +
      motes(30, 303, "#ffdcae", 520, 190, 420, 240, 2.6, 0.55) +
      birds([[268, 150, 1], [300, 138, 0.8], [332, 158, 0.9]], "rgba(48,34,44,.6)", 1) +
      "</svg>";
  };

  // 2. 정오 바하다 — 총격 현장 (원작 I장)
  S.massacre = function () {
    var sky = nid("sk"), bl = nid("bl"), gr = nid("gd"), hz = nid("hz");
    var SKY = "#bcd4e8";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#3f7ab8"], [0.34, "#7aa8cc"], [0.68, "#b8cfe0"], [1, "#ddd8c4"]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#c8a878"], [0.4, "#b09068"], [1, "#8a7050"]]) +
      lg(hz, 0, 0, 0, 1, [[0, "#ffffff", 0.4], [1, "#ffffff", 0]]) +
      blur(bl, 18) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(70, "#ffffff", 0.34, 9, 77) +
      cloud(200, 118, 0.78, "#c8d4de", "#ffffff", 0.66) + cloud(720, 96, 0.6, "#c0cdd8", "#ffffff", 0.6) +
      ridge([[0, 288], [200, 268], [420, 284], [640, 262], [860, 280], [960, 270]], aerial("#5a6a80", SKY, 0.66), 1) +
      '<rect x="0" y="278" width="960" height="46" fill="url(#' + hz + ')"/>' +
      '<path d="M0 320 L960 308 L960 540 L0 540 Z" fill="url(#' + gr + ')"/>' +
      mesa(96, 320, 210, 66, "#b07850", "#7a5238") +
      mesa(884, 314, 176, 54, "#a87048", "#725034") +
      // 트럭 세 대 — 인물 안전지대(340~620) 밖으로 배치
      truck(196, 434, 0.9, "#7a2a2a", "#3a1414", true) +
      truck(792, 424, 0.82, "#2a3a5a", "#141c2c", true) +
      truck(672, 470, 0.6, "#3a3a34", "#1c1c18", true) +
      // 마른 피가 눌어붙은 땅
      '<g fill="#5a2620" opacity=".55"><ellipse cx="262" cy="482" rx="46" ry="12"/><ellipse cx="748" cy="470" rx="38" ry="10"/></g>' +
      // 열기 아지랑이
      '<g filter="url(#' + bl + ')" opacity=".3"><rect x="0" y="336" width="960" height="20" fill="#fff0d0"/>' +
      '<rect x="0" y="372" width="960" height="14" fill="#ffe8c4"/></g>' +
      bush(120, 500, 32, "#4a5a34", 0.85) + bush(880, 494, 28, "#44522e", 0.8) +
      tumble(320, 498, 22, "#8a7a52") +
      grass(528, 34, "#5a4a2c", 26, 0.55, 23) +
      // 파리떼 점
      motes(26, 511, "#2a2620", 140, 400, 700, 110, 1.6, 0.5) +
      // 상공의 대머리수리
      birds([[440, 128, 1.4], [492, 106, 1.2], [540, 142, 1.1]], "rgba(30,28,32,.55)", 1) +
      "</svg>";
  };

  // 3. 달빛 사막 — 밤의 회귀·추격 (원작 II장)
  S.desert_moon = function () {
    var sky = nid("sk"), mn = nid("mn"), bl = nid("bl"), gr = nid("gd");
    var SKY = "#26324e";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#0a0f1e"], [0.34, "#182444"], [0.66, "#2c3a5e"], [1, "#46527a"]]) +
      rg(mn, "50%", "50%", "50%", [[0, "#eaf2ff", 0.85], [0.34, "#b8ccf0", 0.34], [1, "#8098d0", 0]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#3a4260"], [1, "#1c2032"]]) +
      blur(bl, 20) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(120, "#7a8ab4", 0.24, 8, 131) +
      orb(756, 118, 30, "#f4f8ff", mn) +
      cloud(200, 148, 0.8, "#26304e", "#8ea2cc", 0.6) + cloud(560, 96, 0.55, "#222c48", "#7e92bc", 0.45) +
      ridge([[0, 300], [200, 282], [420, 296], [640, 276], [860, 292], [960, 284]], aerial("#141a2c", SKY, 0.3), 1) +
      '<path d="M0 330 L960 318 L960 540 L0 540 Z" fill="url(#' + gr + ')"/>' +
      // 달빛 하이라이트 (지면 좌상단 수광)
      '<path d="M0 330 L960 318 L960 344 L0 358 Z" fill="#8fa4d0" opacity=".25"/>' +
      mesa(110, 330, 200, 70, "#3a4260", "#1e2438") +
      mesa(878, 324, 170, 56, "#343c58", "#1a2030") +
      saguaro(160, 486, 1.05, "#2e3a44", "#161e28") +
      saguaro(828, 470, 0.8, "#2a3640", "#141c24") +
      bush(266, 494, 30, "#1c2430", 0.9) + bush(700, 486, 26, "#1a2230", 0.85) +
      // 조사등이 훑고 간 자국
      '<g filter="url(#' + bl + ')" opacity=".16">' +
      ray(880, 300, 178, 3.4, 700, "#dfe8ff", 1) + "</g>" +
      grass(528, 38, "#121620", 32, 0.7, 57) +
      motes(24, 707, "#c8d8ff", 420, 180, 480, 220, 2, 0.4) +
      "</svg>";
  };

  // 4. 리오그란데 협곡 — 새벽 도하 (원작 II장)
  S.river = function () {
    var sky = nid("sk"), bl = nid("bl"), wt = nid("wt"), cl = nid("cl");
    var SKY = "#8ea8c8";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#1e2c4a"], [0.28, "#43567e"], [0.56, "#8a92aa"], [0.8, "#c8b098"], [1, "#e8cfa8"]]) +
      lg(wt, 0, 0, 0, 1, [[0, "#3a5470"], [0.5, "#26384e"], [1, "#16202e"]]) +
      lg(cl, 0, 0, 1, 0, [[0, "#4a4038"], [1, "#2a241e"]]) +
      blur(bl, 16) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(120, "#e8c0a0", 0.36, 9, 211) +
      cloud(240, 116, 0.72, "#4a4a68", "#e8b898", 0.6) +
      ridge([[0, 258], [220, 244], [460, 258], [700, 240], [960, 252]], aerial("#3a4258", SKY, 0.55), 1) +
      // 절벽 (좌우) — 인물 안전지대 비움
      '<path d="M0 236 L118 244 L176 300 L206 372 L188 540 L0 540 Z" fill="url(#' + cl + ')"/>' +
      '<path d="M0 236 L118 244 L176 300 L150 306 L96 262 L0 258 Z" fill="#63564a" opacity=".8"/>' +
      '<path d="M960 226 L842 238 L780 296 L752 372 L772 540 L960 540 Z" fill="#2e2820"/>' +
      '<path d="M960 226 L842 238 L780 296 L806 302 L862 254 L960 248 Z" fill="#524638" opacity=".7"/>' +
      // 강물
      '<path d="M188 372 Q480 344 772 372 L772 540 L188 540 Z" fill="url(#' + wt + ')"/>' +
      // 윤슬·물결
      '<g stroke="#a8c0e0" stroke-width="2" fill="none" opacity=".4">' +
      '<path d="M240 402 q60 -8 120 0 q60 8 120 0 q60 -8 120 0 q60 8 120 0"/>' +
      '<path d="M212 446 q70 -10 140 0 q70 10 140 0 q70 -10 140 0"/>' +
      '<path d="M256 494 q66 -9 132 0 q66 9 132 0"/></g>' +
      '<g fill="#dce8ff" opacity=".3">' + motes(30, 313, "#dce8ff", 220, 380, 520, 140, 3, 0.8) + "</g>" +
      // 카리조 케인 밭 (전경)
      grass(540, 46, "#1a2418", 120, 0.85, 71, 0, 300) +
      grass(540, 46, "#16200f", 110, 0.85, 91, 660, 960) +
      // 새벽 광선
      '<g filter="url(#' + bl + ')" opacity=".2">' + ray(560, 200, 96, 4, 380, "#ffd8a8", 1) + "</g>" +
      motes(22, 907, "#ffe0b8", 380, 200, 300, 180, 2.4, 0.4) +
      "</svg>";
  };

  // 5. 텍사스 하이웨이 — 석양의 90번 도로
  S.highway = function () {
    var sky = nid("sk"), sun = nid("sn"), bl = nid("bl"), rd = nid("rd");
    var SKY = "#f0a878";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#2a3260"], [0.22, "#6a4a80"], [0.46, "#c8628a"], [0.68, "#f09a68"], [0.88, "#f8cc88"], [1, "#fbe4b4"]]) +
      rg(sun, "50%", "50%", "50%", [[0, "#fff2c8", 0.95], [0.36, "#ffb872", 0.45], [1, "#ff8a50", 0]]) +
      lg(rd, 0, 0, 0, 1, [[0, "#4a4652"], [1, "#26242c"]]) +
      blur(bl, 22) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(110, "#ffd0a0", 0.55, 12, 401) + cirrus(172, "#e88a86", 0.34, 8, 431) +
      orb(480, 300, 30, "#fff8dc", sun) +
      rays(480, 300, [[248, 3, 300, 0.12], [262, 2.2, 260, 0.1], [278, 2.6, 280, 0.11], [292, 1.8, 240, 0.09]], "#ffdca8", bl) +
      cloud(180, 122, 0.86, "#7a4a70", "#ffc496", 0.7) + cloud(770, 104, 0.66, "#6a4468", "#ffb890", 0.6) +
      ridge([[0, 292], [220, 276], [460, 290], [700, 272], [960, 286]], aerial("#4a3450", SKY, 0.58), 1) +
      '<path d="M0 320 L960 310 L960 540 L0 540 Z" fill="#7a5a44"/>' +
      '<path d="M0 320 L960 310 L960 336 L0 348 Z" fill="#a87c58" opacity=".55"/>' +
      // 원근 도로 (소실점 480,316)
      '<path d="M480 316 L1180 540 L-220 540 Z" fill="url(#' + rd + ')"/>' +
      '<path d="M480 316 L500 316 L640 540 L560 540 Z" fill="#3a3840" opacity=".6"/>' +
      // 중앙선
      '<g fill="#e8d060" opacity=".8">' +
      '<path d="M478 320 L482 320 L484 336 L476 336 Z"/><path d="M474 352 L486 352 L490 380 L470 380 Z"/>' +
      '<path d="M466 404 L494 404 L502 452 L458 452 Z"/><path d="M450 486 L510 486 L524 540 L436 540 Z"/></g>' +
      // 갓길 전신주
      '<g stroke="#241c24" stroke-width="4" fill="none">' +
      '<path d="M188 470 V352 M186 372 h30 M124 540 V330 M120 358 h44"/></g>' +
      '<g stroke="#241c24" stroke-width="4" fill="none">' +
      '<path d="M786 466 V350 M770 370 h32 M862 540 V326 M840 354 h44"/></g>' +
      '<g stroke="#2a2028" stroke-width="2" fill="none" opacity=".8">' +
      '<path d="M124 336 Q156 348 188 358 Q400 384 560 384 Q740 372 862 332"/></g>' +
      saguaro(90, 486, 1.1, "#4a5a3c", "#283a26") +
      bush(852, 494, 30, "#3a4228", 0.85) + bush(268, 470, 22, "#3e4630", 0.8) +
      motes(26, 601, "#ffdcae", 300, 220, 400, 200, 2.6, 0.5) +
      "</svg>";
  };

  /* ════════ 트레일러·모텔 ════════ */

  // 6. 데저트 에어 트레일러 (외경, 밤)
  S.trailer = function () {
    var sky = nid("sk"), bl = nid("bl"), lt = nid("lt"), tr = nid("tr");
    var SKY = "#1e2842";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#0a1020"], [0.4, "#182240"], [0.75, "#2a3556"], [1, "#3e4868"]]) +
      lg(tr, 0, 0, 0, 1, [[0, "#9aa4ac"], [0.5, "#78828c"], [1, "#4e5860"]]) +
      rg(lt, "50%", "50%", "50%", [[0, "#ffe8b0", 0.7], [1, "#ffb860", 0]]) +
      blur(bl, 20) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(120, "#5a6a94", 0.2, 7, 503) +
      ridge([[0, 296], [240, 282], [500, 294], [740, 278], [960, 290]], aerial("#101828", SKY, 0.28), 1) +
      '<path d="M0 330 L960 320 L960 540 L0 540 Z" fill="#2a2c34"/>' +
      // 수은등 (푸르스름한 겨울 달 같은 불빛 — 원작)
      '<g stroke="#3a4050" stroke-width="6" fill="none"><path d="M148 340 V96 M148 100 q0 -16 22 -16 h22"/></g>' +
      '<circle cx="196" cy="88" r="11" fill="#dfe8ff"/>' +
      '<circle cx="196" cy="88" r="64" fill="#bcd0ff" opacity=".22" filter="url(#' + bl + ')"/>' +
      '<path d="M180 96 L212 96 L340 400 L52 400 Z" fill="#a8c0ff" opacity=".08" filter="url(#' + bl + ')"/>' +
      // 트레일러 (우측 — 인물 안전지대 비움)
      '<g transform="translate(690 300)">' +
      '<rect x="-260" y="0" width="520" height="150" rx="8" fill="url(#' + tr + ')"/>' +
      '<path d="M-260 0 h520 v18 h-520 Z" fill="#b4bcc4"/>' +
      '<g stroke="#5a646c" stroke-width="2" opacity=".7"><path d="M-260 40 h520 M-260 78 h520 M-260 116 h520"/></g>' +
      // 창 (불이 켜져 있다)
      '<rect x="-208" y="34" width="112" height="60" fill="#ffd88a"/>' +
      '<rect x="-208" y="34" width="112" height="60" fill="none" stroke="#4a545c" stroke-width="6"/>' +
      '<path d="M-152 34 V94" stroke="#4a545c" stroke-width="4"/>' +
      '<rect x="60" y="34" width="96" height="60" fill="#3a4450"/>' +
      '<rect x="60" y="34" width="96" height="60" fill="none" stroke="#4a545c" stroke-width="6"/>' +
      // 알루미늄 문 + 계단
      '<rect x="-52" y="24" width="72" height="126" rx="4" fill="#8e989e"/>' +
      '<rect x="-52" y="24" width="72" height="126" rx="4" fill="none" stroke="#5a646c" stroke-width="4"/>' +
      '<circle cx="6" cy="88" r="4" fill="#3a4148"/>' +
      '<path d="M-60 150 h88 v10 h-88 Z M-52 160 h72 v10 h-72 Z" fill="#6a747c"/>' +
      "</g>" +
      '<ellipse cx="690" cy="452" rx="290" ry="26" fill="#12141a" opacity=".55"/>' +
      // 문 앞 불빛
      '<circle cx="700" cy="330" r="60" fill="url(#' + lt + ')"/>' +
      // 픽업트럭 (좌측)
      truck(190, 452, 0.8, "#4a4a52", "#22222a", false) +
      bush(430, 486, 24, "#1c2418", 0.8) + tumble(330, 500, 18, "#4a4230") +
      grass(536, 32, "#12161c", 26, 0.7, 137) +
      motes(20, 809, "#cfe0ff", 80, 120, 400, 260, 2, 0.35) +
      "</svg>";
  };

  // 7. 트레일러 실내 — 소파와 텔레비전
  S.trailer_in = function () {
    var bl = nid("bl"), gl = nid("gl"), tv = nid("tv");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 20) +
      lg(gl, 0, 0, 0, 1, [[0, "#2a3a58"], [1, "#101828"]]) +
      rg(tv, "50%", "50%", "50%", [[0, "#cfe4ff", 0.7], [1, "#5a80c0", 0]]) +
      "</defs>" +
      room("#b8ac96", "#988c78", "#7a6a54", "#5e5240") +
      // 창 (밤 — 수은등 불빛)
      windowFrame(96, 120, 176, 128, "#6a5c48", gl) +
      '<circle cx="184" cy="176" r="70" fill="#bcd0ff" opacity=".18" filter="url(#' + bl + ')"/>' +
      // 벽 장식 — 사슴 뿔
      '<g stroke="#6a5a44" stroke-width="7" fill="none" stroke-linecap="round">' +
      '<path d="M812 200 q-24 -34 -12 -66 M812 200 q24 -34 12 -66 M800 148 q-20 -8 -30 -26 M824 148 q20 -8 30 -26"/></g>' +
      '<ellipse cx="812" cy="212" rx="26" ry="16" fill="#5a4a36"/>' +
      // 텔레비전 (좌하단)
      '<g transform="translate(178 400)">' +
      '<rect x="-96" y="-84" width="192" height="150" rx="10" fill="#6a5a48"/>' +
      '<rect x="-78" y="-68" width="156" height="112" rx="6" fill="#26303c"/>' +
      '<rect x="-72" y="-62" width="144" height="100" rx="4" fill="#8fb4d8" opacity=".55"/>' +
      '<g stroke="#dfeaf8" stroke-width="3" opacity=".35"><path d="M-72 -40 h144 M-72 -14 h144 M-72 12 h144"/></g>' +
      '<g stroke="#4a4038" stroke-width="4" fill="none"><path d="M-30 -84 l-30 -50 M30 -84 l34 -46"/></g>' +
      "</g>" +
      '<circle cx="178" cy="356" r="140" fill="url(#' + tv + ')"/>' +
      // 소파 (우측)
      '<g transform="translate(760 420)">' +
      '<rect x="-160" y="-80" width="320" height="72" rx="14" fill="#8a6a4a"/>' +
      '<rect x="-172" y="-16" width="344" height="72" rx="12" fill="#a07c58"/>' +
      '<rect x="-150" y="-28" width="130" height="26" rx="10" fill="#b28a62"/>' +
      '<rect x="20" y="-28" width="130" height="26" rx="10" fill="#b28a62"/>' +
      '<g stroke="#6e5238" stroke-width="2.4" fill="none" opacity=".6"><path d="M-20 -80 V56 M-172 20 h344"/></g>' +
      "</g>" +
      // 부엌 조리대 (좌측 벽)
      '<path d="M150 420 L150 340 L330 356 L330 428 Z" fill="#8a7c64"/>' +
      '<path d="M150 340 L330 356 L330 366 L150 350 Z" fill="#a89c84"/>' +
      // 낮은 탁자 + 맥주병
      '<g transform="translate(470 468)"><rect x="-90" y="-14" width="180" height="14" rx="4" fill="#6a5440"/>' +
      '<path d="M-70 0 v40 M70 0 v40" stroke="#5a4636" stroke-width="8"/>' +
      '<path d="M-24 -14 l-4 -34 h16 l-4 34 Z" fill="#3a5a2a" opacity=".9"/>' +
      '<path d="M20 -14 l-3 -30 h12 l-3 30 Z" fill="#3a5a2a" opacity=".8"/></g>' +
      lampGlow(480, 60, 180, "#ffe8b8", bl) +
      motes(20, 1013, "#ffe6bc", 300, 120, 400, 220, 2.2, 0.4) +
      "</svg>";
  };

  // 8. 모텔 방 — 통풍구가 있는 값싼 방
  S.motel_room = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 18) +
      lg(gl, 0, 0, 0, 1, [[0, "#2e3c58"], [1, "#141c2c"]]) +
      "</defs>" +
      room("#c0b49c", "#a0947c", "#6a5a48", "#544636") +
      // 커튼 친 창
      windowFrame(690, 112, 190, 140, "#7a6a52", gl) +
      '<path d="M676 100 h220 v18 h-220 Z" fill="#6a5c46"/>' +
      '<path d="M676 118 q22 70 8 150 h-46 q16 -80 -8 -150 Z" fill="#9a8a6c"/>' +
      '<path d="M896 118 q-22 70 -8 150 h46 q-16 -80 8 -150 Z" fill="#8a7a5e"/>' +
      // 커튼 틈으로 새는 주차장 불빛
      '<path d="M760 120 L800 120 L860 300 L720 300 Z" fill="#cfe0ff" opacity=".1" filter="url(#' + bl + ')"/>' +
      // 침대 (좌측)
      '<g transform="translate(190 430)">' +
      '<rect x="-170" y="-40" width="344" height="96" rx="8" fill="#8a7458"/>' +
      '<rect x="-176" y="-56" width="356" height="30" rx="6" fill="#c8bca4"/>' +
      '<rect x="-176" y="-30" width="356" height="14" rx="4" fill="#b0a488"/>' +
      '<rect x="-160" y="-108" width="40" height="60" rx="6" fill="#6a5844"/>' +
      // 셔닐 침대보 결
      '<g stroke="#a89478" stroke-width="2" opacity=".55"><path d="M-176 -46 h356 M-176 -8 h356 M-176 22 h356"/></g>' +
      "</g>" +
      // 화장대 + 거울
      '<g transform="translate(830 400)">' +
      '<rect x="-90" y="-30" width="180" height="86" rx="4" fill="#6a5540"/>' +
      '<rect x="-84" y="-14" width="80" height="28" rx="3" fill="#7c6549"/>' +
      '<rect x="4" y="-14" width="80" height="28" rx="3" fill="#7c6549"/>' +
      '<g fill="#4a3c2c"><circle cx="-44" cy="0" r="4"/><circle cx="44" cy="0" r="4"/></g></g>' +
      // 통풍구 그릴 (뒷벽 상단 — 원작의 은닉처)
      '<g transform="translate(470 168)">' +
      '<rect x="-56" y="-38" width="112" height="76" rx="4" fill="#8a8274"/>' +
      '<rect x="-50" y="-32" width="100" height="64" rx="3" fill="#5a5448"/>' +
      '<g stroke="#8e8878" stroke-width="5"><path d="M-50 -22 h100 M-50 -8 h100 M-50 6 h100 M-50 20 h100"/></g>' +
      '<g fill="#c8c0ae"><circle cx="-50" cy="-32" r="3"/><circle cx="50" cy="-32" r="3"/><circle cx="-50" cy="32" r="3"/><circle cx="50" cy="32" r="3"/></g></g>' +
      // 침대 맡 램프
      '<g transform="translate(392 380)"><path d="M-16 40 h32 l-6 -26 h-20 Z" fill="#5a4c3a"/>' +
      '<path d="M-28 14 h56 l-10 -34 h-36 Z" fill="#d8c8a0"/></g>' +
      lampGlow(392, 356, 130, "#ffe0a8", bl) +
      // 낡은 카펫 얼룩
      '<g fill="#4a3c2c" opacity=".4"><ellipse cx="520" cy="500" rx="80" ry="18"/><ellipse cx="300" cy="522" rx="60" ry="14"/></g>' +
      motes(18, 1103, "#ffe4bc", 300, 200, 380, 200, 2, 0.35) +
      "</svg>";
  };

  // 9. 모텔 야경 — 주차장과 네온 간판
  S.motel_night = function () {
    var sky = nid("sk"), bl = nid("bl"), nn = nid("nn");
    var SKY = "#1a2440";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#080e1c"], [0.42, "#16203c"], [0.78, "#283350"], [1, "#3a4462"]]) +
      rg(nn, "50%", "50%", "50%", [[0, "#ff9aa8", 0.6], [1, "#d0405a", 0]]) +
      blur(bl, 20) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      ridge([[0, 300], [240, 288], [520, 300], [780, 286], [960, 296]], aerial("#0e1424", SKY, 0.26), 1) +
      // 모텔 건물 (일렬 객실)
      '<path d="M60 316 L900 316 L900 452 L60 452 Z" fill="#4a4438"/>' +
      '<path d="M40 316 L920 316 L900 286 L60 286 Z" fill="#5a5244"/>' +
      '<path d="M40 316 L920 316 L920 326 L40 326 Z" fill="#6a6252"/>' +
      // 객실 문·창 (불 켜진 방 몇 개)
      (function () {
        var s = "";
        for (var i = 0; i < 7; i++) {
          var x = 96 + i * 116;
          var on = i === 1 || i === 4;
          s += '<rect x="' + x + '" y="348" width="42" height="104" rx="3" fill="' + (on ? "#e8bc70" : "#2a2820") + '"/>' +
            '<rect x="' + (x + 50) + '" y="352" width="48" height="52" fill="' + (on ? "#f0cc88" : "#222630") + '"/>' +
            '<rect x="' + (x + 50) + '" y="352" width="48" height="52" fill="none" stroke="#3a3a30" stroke-width="4"/>' +
            '<circle cx="' + (x + 21) + '" cy="336" r="5" fill="#ffe2a0"/>' +
            '<circle cx="' + (x + 21) + '" cy="336" r="24" fill="#ffd890" opacity=".2" filter="url(#' + bl + ')"/>';
        }
        return s;
      })() +
      // 주차장 아스팔트
      '<path d="M0 452 L960 452 L960 540 L0 540 Z" fill="#26262e"/>' +
      '<g stroke="#c8c0a0" stroke-width="3" opacity=".35"><path d="M120 460 V540 M320 460 V540 M640 460 V540 M840 460 V540"/></g>' +
      // 네온 간판 (좌측 기둥)
      '<g stroke="#3a3a44" stroke-width="8" fill="none"><path d="M96 316 V150"/></g>' +
      '<rect x="30" y="86" width="150" height="70" rx="6" fill="#2a2632"/>' +
      '<rect x="38" y="94" width="134" height="54" rx="4" fill="none" stroke="#ff6a86" stroke-width="4"/>' +
      '<text x="105" y="130" font-size="30" font-weight="900" fill="#ff8ea2" text-anchor="middle" font-family="Arial">MOTEL</text>' +
      '<circle cx="105" cy="120" r="98" fill="url(#' + nn + ')"/>' +
      // 주차된 픽업 (우측)
      truck(792, 508, 0.72, "#3a3a44", "#1c1c24", false) +
      // 출입 통제 테이프
      '<path d="M240 480 L560 470" stroke="#e8c840" stroke-width="7" stroke-dasharray="26 14" opacity=".85"/>' +
      motes(22, 1201, "#cfe0ff", 200, 140, 560, 260, 2, 0.35) +
      "</svg>";
  };

  /* ════════ 국경·도시 ════════ */

  // 10. 국경 다리 — 새벽
  S.bridge = function () {
    var sky = nid("sk"), bl = nid("bl"), wt = nid("wt");
    var SKY = "#9aa8bc";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#26304e"], [0.3, "#4e5a76"], [0.6, "#909aa8"], [0.84, "#c8b4a0"], [1, "#e0c8a8"]]) +
      lg(wt, 0, 0, 0, 1, [[0, "#40506a"], [1, "#1e2836"]]) +
      blur(bl, 18) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(112, "#d8b8a0", 0.4, 10, 1301) +
      ridge([[0, 250], [240, 238], [500, 250], [740, 234], [960, 246]], aerial("#2e3446", SKY, 0.5), 1) +
      // 강
      '<path d="M0 300 L960 292 L960 540 L0 540 Z" fill="url(#' + wt + ')"/>' +
      '<g stroke="#8ea4c0" stroke-width="2" fill="none" opacity=".3">' +
      '<path d="M0 350 q120 -8 240 0 q120 8 240 0 q120 -8 240 0 q120 8 240 0"/>' +
      '<path d="M0 410 q140 -10 280 0 q140 10 280 0 q140 -10 280 0"/></g>' +
      // 카리조 케인 밭 (미국 쪽 강변)
      grass(470, 40, "#1c2a1a", 90, 0.8, 1331, 0, 260) +
      // 다리 상판 (원근) — 인물 안전지대 통로로 비움
      '<path d="M0 452 L960 452 L960 540 L0 540 Z" fill="#5a5a62"/>' +
      '<path d="M0 452 L960 452 L960 462 L0 462 Z" fill="#75757e"/>' +
      '<g stroke="#4a4a52" stroke-width="3" opacity=".7"><path d="M0 492 H960 M0 520 H960"/></g>' +
      // 난간 (좌우)
      '<g stroke="#8e949c" stroke-width="6" fill="none">' +
      '<path d="M0 300 L0 452 M120 306 V452 M240 312 V452"/>' +
      '<path d="M960 296 V452 M840 302 V452 M720 308 V452"/>' +
      '<path d="M0 300 L240 312 M720 308 L960 296"/></g>' +
      // 철망
      '<g stroke="rgba(190,198,210,.4)" stroke-width="1.4" fill="none">' +
      (function () {
        var s = "";
        for (var i = 0; i < 10; i++) s += '<path d="M' + i * 26 + " 452 L" + (i * 26 + 40) + ' 302"/>';
        for (var j = 0; j < 10; j++) s += '<path d="M' + (960 - j * 26) + " 452 L" + (960 - j * 26 - 40) + ' 298"/>';
        return s;
      })() + "</g>" +
      // 관문소 (우측 끝)
      '<g transform="translate(886 400)"><rect x="-56" y="-90" width="112" height="90" rx="4" fill="#c8c0a8"/>' +
      '<rect x="-46" y="-76" width="92" height="42" fill="#5a6a78"/>' +
      '<rect x="-70" y="-104" width="140" height="18" rx="4" fill="#9a9280"/>' +
      '<circle cx="0" cy="-112" r="6" fill="#e8d060"/></g>' +
      lampGlow(886, 288, 90, "#ffe0a0", bl) +
      // 다리 가로등
      '<g stroke="#4a4a54" stroke-width="5" fill="none"><path d="M170 452 V330 M170 336 q0 -12 16 -12"/></g>' +
      '<circle cx="190" cy="324" r="8" fill="#ffe0b0"/><circle cx="190" cy="324" r="46" fill="#ffd890" opacity=".2" filter="url(#' + bl + ')"/>' +
      motes(20, 1401, "#ffe0bc", 300, 240, 380, 200, 2.2, 0.4) +
      "</svg>";
  };

  // 11. 이글패스 중심가 — 새벽 총격전
  S.eagle_st = function () {
    var sky = nid("sk"), bl = nid("bl"), nn = nid("nn");
    var SKY = "#2a3450";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#0e1428"], [0.42, "#1e2a48"], [0.76, "#3a4262"], [1, "#5a5a72"]]) +
      rg(nn, "50%", "50%", "50%", [[0, "#ffa8c0", 0.6], [1, "#d0406a", 0]]) +
      blur(bl, 20) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      // 좌측 건물 (이글 호텔)
      '<path d="M0 60 L300 130 L300 470 L0 470 Z" fill="#3a3038"/>' +
      '<path d="M0 60 L300 130 L300 150 L0 84 Z" fill="#4e4048"/>' +
      (function () {
        var s = "";
        for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) {
          var x = 30 + c * 88, y = 172 + r * 72;
          var lit = (r + c) % 3 === 0;
          s += '<rect x="' + x + '" y="' + y + '" width="56" height="52" fill="' + (lit ? "#e8c078" : "#1c2028") + '"/>' +
            '<rect x="' + x + '" y="' + y + '" width="56" height="52" fill="none" stroke="#544650" stroke-width="4"/>';
        }
        return s;
      })() +
      // 호텔 네온
      '<rect x="196" y="96" width="120" height="46" rx="5" fill="#2a2230"/>' +
      '<text x="256" y="130" font-size="26" font-weight="900" fill="#ff9ab4" text-anchor="middle" font-family="Arial">EAGLE</text>' +
      '<circle cx="256" cy="120" r="88" fill="url(#' + nn + ')"/>' +
      // 우측 건물 (아즈텍 극장)
      '<path d="M960 50 L660 128 L660 470 L960 470 Z" fill="#33303a"/>' +
      '<path d="M960 50 L660 128 L660 148 L960 72 Z" fill="#46424e"/>' +
      '<path d="M676 300 L944 300 L944 340 L676 340 Z" fill="#c8a848"/>' +
      '<g fill="#ffe8a0">' + (function () {
        var s = ""; for (var i = 0; i < 10; i++) s += '<circle cx="' + (692 + i * 27) + '" cy="320" r="5"/>';
        return s;
      })() + "</g>" +
      '<text x="810" y="286" font-size="24" font-weight="900" fill="#e8d0a0" text-anchor="middle" font-family="Arial">AZTEC</text>' +
      // 야자수
      '<g stroke="#2a2a30" stroke-width="10" fill="none"><path d="M628 470 V196"/></g>' +
      '<g stroke="#243026" stroke-width="7" fill="none" stroke-linecap="round">' +
      '<path d="M628 196 q-46 -14 -70 14 M628 196 q46 -14 70 14 M628 196 q-30 -40 -10 -58 M628 196 q34 -34 62 -30"/></g>' +
      // 도로
      '<path d="M0 470 L960 470 L960 540 L0 540 Z" fill="#25252d"/>' +
      '<g stroke="#c8c0a0" stroke-width="4" opacity=".3"><path d="M0 508 H960"/></g>' +
      // 깨진 유리 조각
      '<g fill="#a8c8e8" opacity=".6">' + motes(34, 1501, "#a8c8e8", 40, 476, 880, 56, 2.2, 1) + "</g>" +
      // 총구 섬광 잔광
      '<circle cx="176" cy="424" r="60" fill="#ffd070" opacity=".14" filter="url(#' + bl + ')"/>' +
      // 가로등
      '<g stroke="#3a3a44" stroke-width="6" fill="none"><path d="M336 470 V286 M336 292 q0 -14 18 -14"/></g>' +
      '<circle cx="358" cy="278" r="9" fill="#ffe0b0"/><circle cx="358" cy="278" r="56" fill="#ffd890" opacity=".22" filter="url(#' + bl + ')"/>' +
      motes(20, 1601, "#ffd8b0", 340, 180, 300, 200, 2, 0.3) +
      "</svg>";
  };

  // 12. 피에드라스 네그라스 병실
  S.hospital = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 20) +
      lg(gl, 0, 0, 0, 1, [[0, "#cfe4f4"], [1, "#8fb4d0"]]) +
      "</defs>" +
      room("#d8e2e0", "#b8c6c4", "#9aa8a6", "#7e8c8a") +
      // 큰 창 (아침 빛)
      windowFrame(660, 96, 230, 170, "#c8d2d0", gl) +
      windowLight(660, 266, 230, 220, "#ffeec8", bl, -140) +
      '<path d="M0 300 L960 300" stroke="#a8b6b4" stroke-width="0"/>' +
      // 흰 커튼 (병상 사이 — 좌측)
      '<g><path d="M60 120 h300 v14 h-300 Z" fill="#a8b2b0"/>' +
      '<path d="M70 134 q16 130 4 300 h-52 q14 -170 -2 -300 Z" fill="#eef4f2"/>' +
      '<path d="M122 134 q16 130 4 300 h-52 q14 -170 -2 -300 Z" fill="#e2eae8"/>' +
      '<path d="M174 134 q16 130 4 300 h-52 q14 -170 -2 -300 Z" fill="#eef4f2"/>' +
      '<path d="M226 134 q16 130 4 300 h-52 q14 -170 -2 -300 Z" fill="#e2eae8"/></g>' +
      // 병상 (우측)
      '<g transform="translate(756 424)">' +
      '<rect x="-160" y="-40" width="320" height="24" rx="6" fill="#dfe6e4"/>' +
      '<rect x="-160" y="-16" width="320" height="16" rx="4" fill="#b8c4c2"/>' +
      '<g stroke="#8e9c9a" stroke-width="7" fill="none"><path d="M-140 0 V70 M140 0 V70"/></g>' +
      '<g stroke="#c8d2d0" stroke-width="6" fill="none"><path d="M-160 -40 V-96 M-120 -40 V-96 M-160 -96 h40"/></g>' +
      '<rect x="-150" y="-58" width="80" height="20" rx="8" fill="#ffffff"/></g>' +
      // 링거 스탠드
      '<g stroke="#9aa8a6" stroke-width="5" fill="none"><path d="M560 460 V228 M544 460 h32 M560 240 h22"/></g>' +
      '<path d="M572 240 h26 v52 q-13 14 -26 0 Z" fill="#dfeef4" opacity=".9"/>' +
      '<path d="M585 292 q4 60 -10 96" stroke="#c8d8de" stroke-width="3" fill="none"/>' +
      // 철제 의자 (원작 — 웰스가 앉아 있던 자리)
      '<g transform="translate(240 460)"><rect x="-34" y="-16" width="68" height="12" rx="3" fill="#7a8280"/>' +
      '<rect x="-34" y="-80" width="68" height="14" rx="4" fill="#7a8280"/>' +
      '<g stroke="#6a7270" stroke-width="6" fill="none"><path d="M-28 -4 V56 M28 -4 V56 M-28 -66 V-16 M28 -66 V-16"/></g></g>' +
      // 침대 맡 탁자 + 꽃다발
      '<g transform="translate(430 452)"><rect x="-46" y="-14" width="92" height="14" rx="3" fill="#c8d2d0"/>' +
      '<g stroke="#a8b4b2" stroke-width="6" fill="none"><path d="M-36 0 V60 M36 0 V60"/></g>' +
      '<path d="M-16 -14 v-26 h32 v26 Z" fill="#dfe8f0"/>' +
      '<g fill="#e07890"><circle cx="-8" cy="-52" r="9"/><circle cx="10" cy="-58" r="8"/><circle cx="0" cy="-66" r="7"/></g>' +
      '<g stroke="#5a8a4a" stroke-width="2.6" fill="none"><path d="M-8 -44 V-40 M10 -50 V-40"/></g></g>' +
      lampGlow(480, 40, 200, "#eaf4ff", bl) +
      motes(22, 1701, "#fff0d0", 560, 160, 340, 240, 2.4, 0.5) +
      "</svg>";
  };

  // 13. 보안관 집무실
  S.sheriff = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 18) +
      lg(gl, 0, 0, 0, 1, [[0, "#e4d8b8"], [1, "#c0ac84"]]) +
      "</defs>" +
      room("#b8a882", "#9a8c68", "#7a6844", "#5e5234") +
      windowFrame(96, 108, 200, 150, "#6a5a3c", gl) +
      windowLight(96, 258, 200, 240, "#ffeec0", bl, 150) +
      // 텍사스 주 지도 + 게시판 (우측 벽)
      '<g transform="translate(778 210)"><rect x="-110" y="-90" width="220" height="180" rx="4" fill="#e8dcc0"/>' +
      '<rect x="-110" y="-90" width="220" height="180" rx="4" fill="none" stroke="#6a5a3c" stroke-width="7"/>' +
      '<path d="M-70 -50 L30 -56 L52 -20 L34 34 L-24 52 L-64 10 Z" fill="#c8b48c" stroke="#8a7a58" stroke-width="2"/>' +
      '<g fill="#b8404a"><circle cx="-20" cy="-14" r="5"/><circle cx="14" cy="10" r="5"/><circle cx="-44" cy="20" r="5"/></g></g>' +
      // 총기 캐비닛
      '<g transform="translate(170 380)"><rect x="-70" y="-140" width="140" height="200" rx="4" fill="#6a5436"/>' +
      '<rect x="-58" y="-128" width="116" height="150" fill="#3a2e20"/>' +
      '<g stroke="#8a7048" stroke-width="7" fill="none"><path d="M-34 -120 V16 M0 -120 V16 M34 -120 V16"/></g>' +
      '<g stroke="#2a2018" stroke-width="4" fill="none"><path d="M-34 -60 h16 M0 -60 h16 M34 -60 h16"/></g></g>' +
      // 책상 (중앙 하단 — 인물 안전지대 아래)
      '<g transform="translate(480 476)"><rect x="-230" y="-40" width="460" height="34" rx="5" fill="#7a5f3c"/>' +
      '<rect x="-230" y="-6" width="460" height="16" rx="4" fill="#5e4830"/>' +
      '<g stroke="#4a3a24" stroke-width="10" fill="none"><path d="M-200 10 V64 M200 10 V64"/></g>' +
      // 서류·전화기·커피
      '<rect x="-176" y="-56" width="86" height="16" rx="2" fill="#efe6cc"/>' +
      '<rect x="-166" y="-64" width="86" height="16" rx="2" fill="#f6efd8"/>' +
      '<g transform="translate(130 -46)"><rect x="-34" y="-14" width="68" height="16" rx="4" fill="#2a2a30"/>' +
      '<rect x="-28" y="-26" width="56" height="14" rx="6" fill="#3a3a42"/>' +
      '<path d="M-20 -26 q20 -14 40 0" stroke="#2a2a30" stroke-width="4" fill="none"/></g>' +
      '<g transform="translate(8 -50)"><path d="M-14 0 h28 l-4 22 h-20 Z" fill="#e8e2d0"/>' +
      '<path d="M14 4 q12 4 0 12" stroke="#e8e2d0" stroke-width="4" fill="none"/></g></g>' +
      // 벽시계
      '<circle cx="470" cy="130" r="34" fill="#e8dcbc" stroke="#5a4a30" stroke-width="6"/>' +
      '<g stroke="#3a2e1c" stroke-width="4" stroke-linecap="round"><path d="M470 130 V108 M470 130 l16 10"/></g>' +
      lampGlow(480, 40, 180, "#ffeec0", bl) +
      motes(18, 1801, "#ffe8bc", 140, 160, 300, 240, 2.2, 0.45) +
      "</svg>";
  };

  // 14. 국경 마을 다이너
  S.diner = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 18) +
      lg(gl, 0, 0, 0, 1, [[0, "#d8dcc8"], [1, "#98a48c"]]) +
      "</defs>" +
      room("#c8c0a0", "#a89c7c", "#8a7a58", "#6a5c40") +
      // 큰 통유리 (거리)
      windowFrame(620, 98, 280, 180, "#8a7c58", gl) +
      '<g opacity=".5"><path d="M660 240 h60 v38 h-60 Z" fill="#5a5a5a"/>' +
      '<path d="M790 236 h72 v42 h-72 Z" fill="#4a4a52"/></g>' +
      windowLight(620, 278, 280, 220, "#fff0cc", bl, -150) +
      // 카운터 + 스툴 (좌측)
      '<g transform="translate(160 400)">' +
      '<rect x="-140" y="-40" width="300" height="26" rx="6" fill="#c8b890"/>' +
      '<rect x="-140" y="-14" width="300" height="86" rx="4" fill="#8a5a4a"/>' +
      '<g stroke="#6a4438" stroke-width="3" opacity=".6"><path d="M-90 -14 V72 M-20 -14 V72 M50 -14 V72 M120 -14 V72"/></g>' +
      '<g><circle cx="-60" cy="-56" r="24" fill="#b83a4a"/><rect x="-64" y="-40" width="8" height="40" fill="#8a8a92"/>' +
      '<circle cx="40" cy="-56" r="24" fill="#b83a4a"/><rect x="36" y="-40" width="8" height="40" fill="#8a8a92"/></g></g>' +
      // 칸막이 좌석 (우측)
      '<g transform="translate(770 430)">' +
      '<rect x="-140" y="-110" width="34" height="150" rx="8" fill="#8a4a4a"/>' +
      '<rect x="106" y="-110" width="34" height="150" rx="8" fill="#7a4242"/>' +
      '<rect x="-110" y="-30" width="220" height="16" rx="4" fill="#d8c8a0"/>' +
      '<g stroke="#6a5a3c" stroke-width="8" fill="none"><path d="M0 -14 V40"/></g></g>' +
      // 메뉴 보드·시계
      '<g transform="translate(380 140)"><rect x="-96" y="-52" width="192" height="104" rx="4" fill="#3a3a34"/>' +
      '<g stroke="#e8dcb0" stroke-width="3" opacity=".7"><path d="M-76 -28 h152 M-76 -4 h152 M-76 20 h110"/></g></g>' +
      '<circle cx="540" cy="132" r="30" fill="#e8dcbc" stroke="#5a4a30" stroke-width="5"/>' +
      '<g stroke="#3a2e1c" stroke-width="3.4" stroke-linecap="round"><path d="M540 132 V112 M540 132 l14 8"/></g>' +
      // 천장 형광등
      '<g><rect x="180" y="52" width="240" height="16" rx="6" fill="#e8ecf0"/>' +
      '<rect x="560" y="52" width="240" height="16" rx="6" fill="#e8ecf0"/></g>' +
      lampGlow(300, 68, 150, "#ffffe0", bl) + lampGlow(680, 68, 150, "#ffffe0", bl) +
      motes(20, 1901, "#fff0cc", 560, 160, 340, 220, 2.2, 0.45) +
      "</svg>";
  };

  // 15. 잡화점 — 동전 던지기 (추가 각색 장면)
  S.store = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 18) +
      lg(gl, 0, 0, 0, 1, [[0, "#e8dcb8"], [1, "#b8a880"]]) +
      "</defs>" +
      room("#c0b088", "#a09068", "#8a7448", "#6a5836") +
      windowFrame(60, 110, 190, 150, "#7a6844", gl) +
      windowLight(60, 260, 190, 240, "#ffeec0", bl, 160) +
      // 진열 선반 (좌우)
      (function () {
        var s = "";
        for (var i = 0; i < 3; i++) {
          var y = 210 + i * 66;
          s += '<rect x="700" y="' + y + '" width="216" height="12" fill="#7a6440"/>';
          for (var j = 0; j < 6; j++)
            s += '<rect x="' + (708 + j * 35) + '" y="' + (y - 34) + '" width="24" height="34" rx="3" fill="' +
              ["#b8503a", "#4a7a58", "#c8a848", "#5a6a9a", "#8a5a7a", "#d8c090"][j] + '"/>';
        }
        return s;
      })() +
      // 계산대
      '<g transform="translate(420 440)">' +
      '<rect x="-230" y="-40" width="460" height="30" rx="5" fill="#c8b088"/>' +
      '<rect x="-230" y="-10" width="460" height="90" rx="4" fill="#8a6a44"/>' +
      '<g stroke="#6a5034" stroke-width="3" opacity=".6"><path d="M-120 -10 V80 M0 -10 V80 M120 -10 V80"/></g>' +
      // 금전등록기
      '<g transform="translate(150 -46)"><rect x="-44" y="-40" width="88" height="46" rx="4" fill="#8a8a94"/>' +
      '<rect x="-36" y="-32" width="72" height="18" rx="2" fill="#3a3a42"/>' +
      '<g fill="#d8d8e0"><circle cx="-20" cy="-2" r="4"/><circle cx="-4" cy="-2" r="4"/><circle cx="12" cy="-2" r="4"/><circle cx="28" cy="-2" r="4"/></g></g>' +
      // 카운터 위의 25센트 동전
      '<circle cx="-40" cy="-46" r="13" fill="#c8c8d0"/><circle cx="-40" cy="-49" r="13" fill="#dcdce4"/>' +
      '<circle cx="-40" cy="-49" r="8" fill="#c0c0c8"/></g>' +
      // 벽 시계·간판
      '<g transform="translate(480 132)"><rect x="-120" y="-40" width="240" height="80" rx="6" fill="#3a3428"/>' +
      '<text x="0" y="14" font-size="30" font-weight="900" fill="#e8d8a8" text-anchor="middle" font-family="Arial">STATION</text></g>' +
      lampGlow(480, 46, 190, "#ffeec8", bl) +
      motes(18, 2001, "#ffe8c0", 120, 160, 300, 240, 2.2, 0.45) +
      "</svg>";
  };

  // 16. 휴스턴 17층 사무실
  S.office17 = function () {
    var bl = nid("bl"), gl = nid("gl"), sk = nid("sk");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 20) +
      lg(sk, 0, 0, 0, 1, [[0, "#7a92b8"], [0.5, "#b8c4cc"], [1, "#d8c8a8"]]) +
      lg(gl, 0, 0, 0, 1, [[0, "#8aa2c0", 0.5], [1, "#6a7c94", 0.5]]) +
      "</defs>" +
      '<rect width="960" height="540" fill="#3a3a42"/>' +
      // 통유리 벽 — 스카이라인과 정유탱크
      '<rect x="0" y="0" width="960" height="430" fill="url(#' + sk + ')"/>' +
      // 먼 스카이라인
      '<g fill="#7d8ea8" opacity=".8">' +
      '<rect x="40" y="180" width="60" height="250"/><rect x="112" y="130" width="46" height="300"/>' +
      '<rect x="170" y="206" width="70" height="224"/><rect x="806" y="160" width="54" height="270"/>' +
      '<rect x="872" y="212" width="60" height="218"/></g>' +
      '<g fill="#94a4bc" opacity=".7">' +
      '<rect x="256" y="240" width="52" height="190"/><rect x="700" y="252" width="64" height="178"/></g>' +
      // 은색 정유 탱크와 불꽃
      '<g><ellipse cx="360" cy="382" rx="46" ry="12" fill="#c0c8d0"/><rect x="314" y="344" width="92" height="38" fill="#ced6de"/>' +
      '<ellipse cx="360" cy="344" rx="46" ry="12" fill="#e0e6ec"/>' +
      '<ellipse cx="600" cy="386" rx="40" ry="11" fill="#bcc4cc"/><rect x="560" y="352" width="80" height="34" fill="#cad2da"/>' +
      '<ellipse cx="600" cy="352" rx="40" ry="11" fill="#dce2e8"/></g>' +
      '<g stroke="#9aa4ac" stroke-width="5" fill="none"><path d="M470 386 V300"/></g>' +
      '<path d="M470 300 q-8 -18 0 -30 q8 12 0 30 Z" fill="#ffb050" opacity=".8"/>' +
      '<circle cx="470" cy="284" r="30" fill="#ffb050" opacity=".2" filter="url(#' + bl + ')"/>' +
      // 유리 프레임 (짙게 그을린 창)
      '<rect x="0" y="0" width="960" height="430" fill="url(#' + gl + ')"/>' +
      '<g stroke="#2a2e36" stroke-width="14" fill="none"><path d="M240 0 V430 M480 0 V430 M720 0 V430"/></g>' +
      '<rect x="0" y="418" width="960" height="16" fill="#2a2e36"/>' +
      // 바닥·책상
      '<path d="M0 434 L960 434 L960 540 L0 540 Z" fill="#4a4038"/>' +
      '<g transform="translate(480 502)"><rect x="-260" y="-56" width="520" height="26" rx="4" fill="#5a4a3a"/>' +
      '<rect x="-260" y="-30" width="520" height="12" fill="#3e3228"/>' +
      '<g stroke="#2e2620" stroke-width="12" fill="none"><path d="M-220 -18 V38 M220 -18 V38"/></g></g>' +
      lampGlow(480, 60, 220, "#eaf0f8", bl) +
      motes(20, 2101, "#e8f0ff", 300, 120, 400, 260, 2.2, 0.4) +
      "</svg>";
  };

  // 17. 버스 정류장 — 비 오는 새벽
  S.busstation = function () {
    var sky = nid("sk"), bl = nid("bl"), gl = nid("gl");
    var SKY = "#8a94a0";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#4a5460"], [0.5, "#78838f"], [1, "#a8b0b6"]]) +
      lg(gl, 0, 0, 0, 1, [[0, "#dfe4e0"], [1, "#a8b0ac"]]) +
      blur(bl, 18) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(110, "#98a2ac", 0.5, 10, 2201) +
      // 정류장 캐노피
      '<path d="M0 190 L960 190 L960 216 L0 216 Z" fill="#5a5a5e"/>' +
      '<path d="M0 216 L960 216 L960 228 L0 228 Z" fill="#44444a"/>' +
      '<g stroke="#4a4a50" stroke-width="12" fill="none"><path d="M110 228 V440 M850 228 V440"/></g>' +
      // 뒷벽·유리문
      '<path d="M150 228 L810 228 L810 440 L150 440 Z" fill="#8a8478"/>' +
      windowFrame(196, 262, 180, 140, "#5a5650", gl) +
      windowFrame(600, 262, 180, 140, "#5a5650", gl) +
      '<rect x="426" y="262" width="120" height="178" rx="4" fill="#c8ccc4" opacity=".7"/>' +
      '<rect x="426" y="262" width="120" height="178" rx="4" fill="none" stroke="#5a5650" stroke-width="7"/>' +
      '<path d="M486 262 V440" stroke="#5a5650" stroke-width="5"/>' +
      // 간판
      '<rect x="392" y="150" width="176" height="42" rx="5" fill="#2a3a52"/>' +
      '<text x="480" y="182" font-size="26" font-weight="900" fill="#e8ecf0" text-anchor="middle" font-family="Arial">BUS</text>' +
      // 버스 (우측, 시동 걸린 채)
      '<g transform="translate(880 430)"><rect x="-170" y="-140" width="340" height="140" rx="14" fill="#6a7a8a"/>' +
      '<rect x="-160" y="-126" width="130" height="52" rx="6" fill="#39485a"/>' +
      '<rect x="-16" y="-126" width="80" height="52" rx="6" fill="#39485a"/>' +
      '<rect x="80" y="-126" width="80" height="52" rx="6" fill="#39485a"/>' +
      '<circle cx="-100" cy="6" r="26" fill="#1a1a20"/><circle cx="100" cy="6" r="26" fill="#16161c"/></g>' +
      // 젖은 바닥 반사
      '<path d="M0 440 L960 440 L960 540 L0 540 Z" fill="#5a5a60"/>' +
      '<g fill="#c8d2d8" opacity=".22"><rect x="180" y="452" width="220" height="8" rx="4"/>' +
      '<rect x="560" y="470" width="260" height="8" rx="4"/><rect x="80" y="500" width="180" height="8" rx="4"/></g>' +
      lampGlow(480, 216, 200, "#ffeec8", bl) +
      motes(24, 2301, "#dfe8f0", 100, 240, 760, 200, 2, 0.35) +
      "</svg>";
  };

  // 18. 오뎃사 침실 — 슈거가 기다리는 밤
  S.bedroom = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 20) +
      lg(gl, 0, 0, 0, 1, [[0, "#2e3c58"], [1, "#141c30"]]) +
      "</defs>" +
      room("#8a7c86", "#6c6070", "#5a4a50", "#443840") +
      // 창 — 수은등의 푸른 빛과 새 나뭇잎
      windowFrame(650, 110, 210, 160, "#5a4a52", gl) +
      '<g fill="#3a5a48" opacity=".7"><circle cx="700" cy="170" r="20"/><circle cx="736" cy="150" r="16"/>' +
      '<circle cx="770" cy="186" r="18"/><circle cx="820" cy="160" r="14"/></g>' +
      windowLight(650, 270, 210, 230, "#a8c0ff", bl, -140) +
      // 천장 선풍기
      '<g transform="translate(470 96)"><path d="M0 0 V-46" stroke="#4a4048" stroke-width="6"/>' +
      '<g fill="#6a5a52"><ellipse cx="-84" cy="4" rx="84" ry="10"/><ellipse cx="84" cy="4" rx="84" ry="10"/>' +
      '<ellipse cx="0" cy="10" rx="26" ry="14"/></g>' +
      '<circle cx="0" cy="0" r="16" fill="#7a6a60"/></g>' +
      lampGlow(470, 110, 130, "#ffe8c0", bl) +
      // 침대 (좌측)
      '<g transform="translate(210 440)">' +
      '<rect x="-170" y="-46" width="350" height="100" rx="8" fill="#7a6a72"/>' +
      '<rect x="-176" y="-62" width="362" height="30" rx="6" fill="#c8bcc0"/>' +
      '<rect x="-176" y="-34" width="362" height="14" rx="4" fill="#a89aa0"/>' +
      '<rect x="-158" y="-124" width="44" height="68" rx="6" fill="#5a4a52"/>' +
      '<g stroke="#948490" stroke-width="2" opacity=".5"><path d="M-176 -50 h362 M-176 -12 h362 M-176 20 h362"/></g></g>' +
      // 작은 책상 + 의자 (우측 — 슈거가 앉아 있던 자리)
      '<g transform="translate(700 456)">' +
      '<rect x="-100" y="-40" width="200" height="16" rx="3" fill="#6a5850"/>' +
      '<g stroke="#4e4038" stroke-width="9" fill="none"><path d="M-84 -24 V54 M84 -24 V54"/></g>' +
      '<rect x="-56" y="-56" width="60" height="16" rx="2" fill="#d8ccc0"/></g>' +
      // 옷장·앨범
      '<g transform="translate(150 260)"><rect x="-70" y="-90" width="140" height="180" rx="4" fill="#5a4a4e"/>' +
      '<path d="M0 -90 V90" stroke="#463a3e" stroke-width="4"/>' +
      '<g fill="#c0b0a8"><circle cx="-12" cy="0" r="4"/><circle cx="12" cy="0" r="4"/></g></g>' +
      motes(20, 2401, "#c8d8ff", 560, 180, 340, 240, 2.2, 0.4) +
      "</svg>";
  };

  /* ════════ 벨의 세계 ════════ */

  // 19. 목장 우물·풍차 — 황혼
  S.ranch = function () {
    var sky = nid("sk"), sun = nid("sn"), bl = nid("bl");
    var SKY = "#e8b088";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#33406e"], [0.24, "#6a5a90"], [0.48, "#c47a86"], [0.72, "#f0a670"], [0.9, "#f8d09a"], [1, "#fbe6c0"]]) +
      rg(sun, "50%", "50%", "50%", [[0, "#fff4cc", 0.9], [0.38, "#ffbe80", 0.4], [1, "#ff9050", 0]]) +
      blur(bl, 22) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(104, "#ffd4a8", 0.55, 12, 2501) + cirrus(168, "#e8908e", 0.32, 8, 2531) +
      orb(206, 306, 28, "#fff6d8", sun) +
      rays(206, 306, [[-32, 3, 420, 0.12], [-16, 2.2, 380, 0.1], [0, 2.6, 400, 0.11], [16, 1.8, 350, 0.09]], "#ffdcb0", bl) +
      cloud(680, 116, 0.82, "#7a4a72", "#ffc498", 0.68) +
      ridge([[0, 300], [240, 286], [500, 300], [740, 282], [960, 296]], aerial("#4a3a58", SKY, 0.55), 1) +
      '<path d="M0 336 L960 326 L960 540 L0 540 Z" fill="#9a8258"/>' +
      '<path d="M0 336 L960 326 L960 356 L0 368 Z" fill="#c0a476" opacity=".55"/>' +
      // 풍차 (우측)
      '<g transform="translate(760 340)">' +
      '<g stroke="#4a4038" stroke-width="6" fill="none">' +
      '<path d="M-34 130 L-12 -80 M34 130 L12 -80 M-26 60 h52 M-20 0 h40"/></g>' +
      '<circle cx="0" cy="-88" r="9" fill="#5a5048"/>' +
      (function () {
        var s = "";
        for (var i = 0; i < 14; i++) {
          var a = i * (360 / 14) * Math.PI / 180;
          s += '<path d="M0 -88 L' + (Math.cos(a) * 52).toFixed(1) + " " + (-88 + Math.sin(a) * 52).toFixed(1) +
            '" stroke="#6a5c4c" stroke-width="7" stroke-linecap="round"/>';
        }
        return s;
      })() +
      '<circle cx="0" cy="-88" r="12" fill="#7a6a58"/>' +
      '<path d="M12 -88 h64 l-12 -18 v36 Z" fill="#6a5c4c"/></g>' +
      // 수조
      '<g transform="translate(760 486)"><ellipse cx="0" cy="0" rx="96" ry="26" fill="#5a5a58"/>' +
      '<ellipse cx="0" cy="-8" rx="92" ry="24" fill="#8fb0c0"/>' +
      '<ellipse cx="-20" cy="-12" rx="40" ry="10" fill="#c8e0ea" opacity=".55"/></g>' +
      // 마른 풀밭과 소나무 그림자
      bush(140, 470, 32, "#5a5a34", 0.8) + bush(400, 486, 24, "#54522e", 0.75) +
      grass(534, 44, "#4a4228", 34, 0.6, 2601) +
      '<g opacity=".35"><path d="M700 500 L920 520 L960 512 L740 492 Z" fill="#4a3a28"/></g>' +
      motes(24, 2701, "#ffdcb0", 200, 200, 400, 220, 2.6, 0.5) +
      birds([[420, 150, 1.1], [462, 132, 0.9], [500, 160, 1]], "rgba(48,34,44,.5)", 1) +
      "</svg>";
  };

  // 20. 엘리스 아저씨의 부엌
  S.ellis_kitchen = function () {
    var bl = nid("bl"), gl = nid("gl");
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + blur(bl, 18) +
      lg(gl, 0, 0, 0, 1, [[0, "#d8d0a8"], [1, "#98a078"]]) +
      "</defs>" +
      room("#a09878", "#847c60", "#6a5c40", "#52472f") +
      windowFrame(96, 118, 190, 146, "#5a4c34", gl) +
      windowLight(96, 264, 190, 240, "#ffe8b0", bl, 150) +
      // 장작 난로 (우측)
      '<g transform="translate(800 380)">' +
      '<rect x="-70" y="-100" width="140" height="160" rx="6" fill="#3a3630"/>' +
      '<rect x="-56" y="-70" width="112" height="70" rx="4" fill="#1e1a16"/>' +
      '<path d="M-40 -14 q22 -34 40 -6 q16 -26 34 4 Z" fill="#e8802a"/>' +
      '<path d="M-28 -14 q16 -22 28 -4 q10 -18 22 2 Z" fill="#ffc060"/>' +
      '<rect x="-80" y="-108" width="160" height="14" rx="4" fill="#4a453c"/>' +
      '<path d="M-14 -108 V-230" stroke="#3a3630" stroke-width="16"/></g>' +
      '<circle cx="800" cy="366" r="120" fill="#ff9a40" opacity=".16" filter="url(#' + bl + ')"/>' +
      // 식탁 (체크무늬 식탁보)
      '<g transform="translate(440 468)">' +
      '<rect x="-220" y="-48" width="440" height="30" rx="4" fill="#c8b48c"/>' +
      '<rect x="-224" y="-52" width="448" height="20" rx="4" fill="#d8d0c0"/>' +
      '<g stroke="#b04a4a" stroke-width="5" opacity=".55">' +
      '<path d="M-180 -52 V-32 M-100 -52 V-32 M-20 -52 V-32 M60 -52 V-32 M140 -52 V-32"/>' +
      '<path d="M-224 -46 H224 M-224 -38 H224"/></g>' +
      '<g stroke="#8a7250" stroke-width="10" fill="none"><path d="M-190 -18 V52 M190 -18 V52"/></g>' +
      // 약병·커피잔·경마 잡지
      '<g transform="translate(-130 -66)"><rect x="-10" y="0" width="20" height="26" rx="3" fill="#d8c8a0"/>' +
      '<rect x="-8" y="-6" width="16" height="8" rx="2" fill="#8a7a58"/></g>' +
      '<g transform="translate(-96 -64)"><rect x="-9" y="0" width="18" height="24" rx="3" fill="#c0d0c0"/></g>' +
      '<g transform="translate(56 -70)"><path d="M-16 0 h32 l-4 26 h-24 Z" fill="#e8e2d0"/>' +
      '<path d="M16 6 q13 5 0 14" stroke="#e8e2d0" stroke-width="4" fill="none"/></g>' +
      '<rect x="120" y="-58" width="80" height="10" rx="2" fill="#e0d0a8"/></g>' +
      // 싱크대 (좌측)
      '<g transform="translate(200 420)"><rect x="-130" y="-40" width="260" height="20" rx="4" fill="#9a9080"/>' +
      '<rect x="-130" y="-20" width="260" height="80" rx="3" fill="#7a6a4e"/>' +
      '<rect x="-70" y="-36" width="120" height="14" rx="4" fill="#5a5a58"/>' +
      '<path d="M-10 -40 q0 -30 26 -30 h20" stroke="#8a8a84" stroke-width="6" fill="none"/></g>' +
      // 고양이 실루엣 두 마리
      '<g fill="#3a342c" opacity=".8">' +
      '<path d="M140 512 q10 -26 30 -26 q20 0 26 26 Z"/><path d="M158 486 l-4 -12 l10 8 Z"/>' +
      '<path d="M880 520 q8 -20 24 -20 q16 0 20 20 Z"/></g>' +
      motes(20, 2801, "#ffdca0", 640, 200, 300, 240, 2.4, 0.5) +
      "</svg>";
  };

  // 21. 3월의 묘지 — 바람 부는 장례식
  S.cemetery = function () {
    var sky = nid("sk"), bl = nid("bl");
    var SKY = "#a8b0b8";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#5a6674"], [0.42, "#8e98a2"], [0.78, "#bcc0be"], [1, "#d0cbb8"]]) +
      blur(bl, 20) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(96, "#c8cdd2", 0.55, 14, 2901) + cirrus(168, "#a8b0b8", 0.4, 10, 2931) +
      cloud(240, 140, 0.9, "#7a848e", "#c8d0d6", 0.65) + cloud(720, 116, 0.7, "#727c86", "#c0c8ce", 0.55) +
      ridge([[0, 306], [240, 292], [500, 306], [760, 288], [960, 300]], aerial("#5a6058", SKY, 0.5), 1) +
      '<path d="M0 340 L960 330 L960 540 L0 540 Z" fill="#7a7a5c"/>' +
      '<path d="M0 340 L960 330 L960 360 L0 372 Z" fill="#98946e" opacity=".5"/>' +
      // 묘비들 — 인물 안전지대 밖
      (function () {
        var s = "";
        var spots = [[92, 420, 1], [176, 400, 0.85], [258, 434, 0.9], [706, 402, 0.9], [802, 428, 1], [886, 396, 0.8]];
        for (var i = 0; i < spots.length; i++) {
          var x = spots[i][0], y = spots[i][1], sc = spots[i][2];
          s += '<g transform="translate(' + x + " " + y + ") scale(" + sc + ')">' +
            '<path d="M-26 0 L-26 -56 q26 -22 52 0 L26 0 Z" fill="#b0aa9a"/>' +
            '<path d="M-26 0 L-26 -56 q13 -11 26 -13 L0 0 Z" fill="#c6c0b0"/>' +
            '<g stroke="#8a8474" stroke-width="2.4" opacity=".7"><path d="M-14 -34 h28 M-14 -22 h28"/></g>' +
            '<ellipse cx="0" cy="4" rx="34" ry="8" fill="#5a5a44" opacity=".5"/></g>';
        }
        return s;
      })() +
      // 갓 판 무덤 (우측)
      '<g transform="translate(768 486)"><ellipse cx="0" cy="0" rx="110" ry="26" fill="#4a4436"/>' +
      '<ellipse cx="0" cy="-6" rx="102" ry="22" fill="#3a3428"/>' +
      '<path d="M-130 8 q30 -22 66 -18" stroke="#6a6448" stroke-width="12" fill="none" opacity=".7"/></g>' +
      // 마른 나무 (좌측)
      '<g stroke="#3a3428" stroke-width="12" fill="none" stroke-linecap="round">' +
      '<path d="M120 470 V300 M120 340 q-40 -30 -66 -60 M120 320 q40 -34 74 -46 M120 380 q-34 -20 -52 -44"/></g>' +
      '<g stroke="#3a3428" stroke-width="5" fill="none" stroke-linecap="round">' +
      '<path d="M54 280 q-14 -18 -26 -24 M194 274 q16 -18 30 -22"/></g>' +
      // 바람에 날리는 마른 잎
      motes(26, 3001, "#8a7a52", 200, 300, 560, 200, 3, 0.55) +
      grass(534, 40, "#5a5a3c", 30, 0.6, 3031) +
      "</svg>";
  };

  // 22. 돌 구유 — 폐가의 마지막 장면 (원작 XIII장)
  S.trough = function () {
    var sky = nid("sk"), sun = nid("sn"), bl = nid("bl");
    var SKY = "#d8c8a8";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#4a6088"], [0.34, "#8ea2b8"], [0.68, "#c8c4ac"], [1, "#e8d8b0"]]) +
      rg(sun, "50%", "50%", "50%", [[0, "#fff8dc", 0.85], [0.4, "#ffd8a0", 0.34], [1, "#ffb870", 0]]) +
      blur(bl, 22) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(100, "#f0dcb8", 0.5, 11, 3101) +
      orb(196, 154, 24, "#fffbe8", sun) +
      rays(196, 154, [[54, 3, 460, 0.13], [70, 2.2, 420, 0.11], [86, 2.6, 440, 0.1]], "#ffe8bc", bl) +
      ridge([[0, 292], [240, 278], [500, 292], [760, 274], [960, 288]], aerial("#6a7284", SKY, 0.56), 1) +
      '<path d="M0 330 L960 320 L960 540 L0 540 Z" fill="#9a8c68"/>' +
      '<path d="M0 330 L960 320 L960 350 L0 362 Z" fill="#bca882" opacity=".5"/>' +
      // 무너진 집 — 돌 굴뚝만 남았다 (우측)
      '<g transform="translate(792 340)">' +
      '<path d="M-40 0 L-40 -190 L40 -190 L40 0 Z" fill="#8a8070"/>' +
      '<path d="M-40 0 L-40 -190 L0 -190 L0 0 Z" fill="#a09684"/>' +
      '<g stroke="#6a6254" stroke-width="2.6" fill="none" opacity=".7">' +
      '<path d="M-40 -30 h80 M-40 -62 h80 M-40 -94 h80 M-40 -126 h80 M-40 -158 h80 M-14 0 V-30 M14 -30 V-62 M-16 -62 V-94 M12 -94 V-126"/></g>' +
      '<path d="M-48 -190 h96 v14 h-96 Z" fill="#7a7264"/>' +
      // 무너진 벽 조각
      '<path d="M-160 0 L-160 -60 L-96 -76 L-96 0 Z" fill="#7e7566"/>' +
      '<path d="M-160 -60 L-96 -76 L-96 -64 L-160 -48 Z" fill="#98907e"/></g>' +
      // 돌 구유 (좌측 전경 — 인물 안전지대 밖)
      '<g transform="translate(226 448)">' +
      '<path d="M-140 -40 L140 -40 L128 40 L-128 40 Z" fill="#8a8272"/>' +
      '<path d="M-140 -40 L140 -40 L124 -26 L-124 -26 Z" fill="#a49c8a"/>' +
      '<path d="M-124 -26 L124 -26 L116 26 L-116 26 Z" fill="#4a5a5e"/>' +
      // 고인 물 — 하늘 반사
      '<path d="M-116 -18 L116 -18 L110 18 L-110 18 Z" fill="#8ab0c8" opacity=".85"/>' +
      '<path d="M-96 -12 q60 -6 120 0 q-60 8 -120 0 Z" fill="#dfeef8" opacity=".6"/>' +
      '<g stroke="#6a6254" stroke-width="2" opacity=".5" fill="none">' +
      '<path d="M-134 -10 L124 -10 M-130 8 L120 8"/></g>' +
      // 정 자국
      '<g stroke="#6e6658" stroke-width="1.6" opacity=".45">' +
      '<path d="M-120 -34 v6 M-96 -34 v6 M-72 -34 v6 M-48 -34 v6 M-24 -34 v6 M0 -34 v6 M24 -34 v6 M48 -34 v6 M72 -34 v6 M96 -34 v6 M120 -34 v6"/></g>' +
      '<ellipse cx="0" cy="46" rx="150" ry="16" fill="#5a5240" opacity=".45"/></g>' +
      // 잡초
      grass(470, 26, "#5a6038", 42, 0.75, 3201, 60, 400) +
      grass(524, 40, "#4a5030", 34, 0.7, 3231) +
      bush(560, 470, 28, "#4a5432", 0.8) +
      // 떨어진 백철관
      '<g transform="rotate(-12 470 500)"><rect x="410" y="494" width="120" height="12" rx="5" fill="#8a9098"/>' +
      '<rect x="410" y="494" width="120" height="5" rx="2" fill="#b0b6be"/></g>' +
      motes(26, 3301, "#ffe8bc", 220, 180, 500, 240, 2.6, 0.5) +
      "</svg>";
  };

  // 23. 사막 — 정오의 도보 (2부 도주)
  S.desert_noon = function () {
    var sky = nid("sk"), bl = nid("bl"), gr = nid("gd");
    var SKY = "#c8dcec";
    return '<svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      lg(sky, 0, 0, 0, 1, [[0, "#3f80c0"], [0.36, "#7fb0d8"], [0.7, "#c0d8e8"], [1, "#e4dcc4"]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#d8b078"], [0.4, "#bc9464"], [1, "#94764e"]]) +
      blur(bl, 18) +
      "</defs>" +
      '<rect width="960" height="540" fill="url(#' + sky + ')"/>' +
      cirrus(64, "#ffffff", 0.3, 8, 3401) +
      cloud(160, 106, 0.7, "#ccd8e2", "#ffffff", 0.6) + cloud(800, 88, 0.55, "#c4d0dc", "#ffffff", 0.55) +
      ridge([[0, 282], [220, 264], [460, 280], [700, 258], [960, 274]], aerial("#63738a", SKY, 0.66), 1) +
      ridge([[0, 306], [240, 296], [520, 308], [780, 294], [960, 302]], aerial("#7a6a58", SKY, 0.44), 1) +
      '<rect x="0" y="288" width="960" height="42" fill="#ffffff" opacity=".28" filter="url(#' + bl + ')"/>' +
      '<path d="M0 326 L960 314 L960 540 L0 540 Z" fill="url(#' + gr + ')"/>' +
      mesa(110, 326, 200, 70, "#c08050", "#8a5c38") +
      mesa(870, 320, 170, 56, "#b8784c", "#845834") +
      saguaro(206, 480, 1.15, "#5e8248", "#365a30") +
      saguaro(760, 462, 0.9, "#587c44", "#32542c") +
      bush(300, 494, 30, "#54622e", 0.85) + bush(690, 486, 26, "#4e5c2c", 0.8) +
      tumble(148, 508, 24, "#9a8a58") + tumble(830, 496, 18, "#8a7a4c") +
      // 열기 아지랑이
      '<g filter="url(#' + bl + ')" opacity=".34"><rect x="0" y="342" width="960" height="18" fill="#fff2d4"/>' +
      '<rect x="0" y="382" width="960" height="14" fill="#ffecc8"/><rect x="0" y="418" width="960" height="10" fill="#ffe8c0"/></g>' +
      grass(532, 36, "#6a5a30", 28, 0.55, 3431) +
      motes(24, 3501, "#fff0cc", 320, 200, 400, 220, 2.4, 0.45) +
      birds([[520, 118, 1.3], [566, 100, 1.1]], "rgba(30,28,32,.45)", 1) +
      "</svg>";
  };

  SC.svg = function (bg) {
    var b = S[bg];
    return b ? b() : "";
  };
  SC.keys = function () { return Object.keys(S); };
})();
