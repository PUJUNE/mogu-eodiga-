// scenes.js — 장소·시간대별 SVG 배경 장면 13종 (960×540, slice 커버)
// 화풍: 신카이 마코토·호소다 마모루 계열 애니 배경 문법
//   ① 다층 그라디언트 하늘 ② 림라이트 구름 ③ god ray(광선)·블룸 ④ 대기 원근(먼 층일수록
//   하늘색으로 수렴) ⑤ 전경 실루엣 + 얕은 심도 블러 ⑥ 공기 중 먼지·보케 입자
// 외부 이미지 없이 오프라인 단일 파일 유지.
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
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

  /* ── 그림 부품 ── */

  // 광선 한 줄기 (삼각형)
  function ray(x, y, ang, w, len, col, op) {
    var a1 = (ang - w) * Math.PI / 180, a2 = (ang + w) * Math.PI / 180;
    return '<path d="M' + x + " " + y +
      " L" + (x + len * Math.cos(a1)).toFixed(1) + " " + (y + len * Math.sin(a1)).toFixed(1) +
      " L" + (x + len * Math.cos(a2)).toFixed(1) + " " + (y + len * Math.sin(a2)).toFixed(1) +
      ' Z" fill="' + col + '" opacity="' + op + '"/>';
  }
  // 광선 다발 (god ray)
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
  // 성긴 새털구름 (수평 스트로크)
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
  // 공기 중 먼지·보케
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
  // 풀숲 실루엣 (전경 심도용)
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
  // 바람에 기운 전나무 — 줄기 + 층층 가지 (황야의 상징목)
  function conifer(x, baseY, h, w, lit, dark, lean) {
    var tiers = 6, s = "";
    for (var i = 0; i < tiers; i++) {
      var t = i / (tiers - 1);                    // 0=아래 1=꼭대기
      var cy = baseY - h * (0.18 + t * 0.78);
      var hw = w * (1 - t * 0.78);
      var drop = h * 0.13 * (1 - t * 0.4);
      var sag = w * 0.12;                          // 가지 처짐
      s += '<path d="M' + (x - hw).toFixed(1) + " " + (cy + drop).toFixed(1) +
        " Q" + (x - hw * 0.4).toFixed(1) + " " + (cy + drop - sag).toFixed(1) + " " + x + " " + (cy - drop * 0.9).toFixed(1) +
        " Q" + (x + hw * 0.4).toFixed(1) + " " + (cy + drop - sag).toFixed(1) + " " + (x + hw).toFixed(1) + " " + (cy + drop).toFixed(1) +
        " Q" + x + " " + (cy + drop * 1.5).toFixed(1) + " " + (x - hw).toFixed(1) + " " + (cy + drop).toFixed(1) + ' Z" fill="' + dark + '"/>';
      // 윗면 수광
      s += '<path d="M' + (x - hw * 0.86).toFixed(1) + " " + (cy + drop * 0.55).toFixed(1) +
        " Q" + x + " " + (cy - drop * 0.8).toFixed(1) + " " + (x + hw * 0.86).toFixed(1) + " " + (cy + drop * 0.55).toFixed(1) +
        " Q" + x + " " + (cy - drop * 0.1).toFixed(1) + " " + (x - hw * 0.86).toFixed(1) + " " + (cy + drop * 0.55).toFixed(1) +
        ' Z" fill="' + lit + '" opacity=".55"/>';
    }
    return '<g transform="rotate(' + lean + " " + x + " " + baseY + ')">' +
      '<path d="M' + (x - w * 0.07) + " " + baseY + " L" + (x - w * 0.035) + " " + (baseY - h) + " L" + (x + w * 0.035) + " " + (baseY - h) +
      " L" + (x + w * 0.07) + " " + baseY + ' Z" fill="' + dark + '"/>' + s + "</g>";
  }
  // 요크셔 드라이스톤 월 — 이어진 담에 돌 이음매를 새긴다 (조각조각 뜨지 않게)
  function drywall(x0, x1, yTop, h, face, cap, joint, seed) {
    var s = '<rect x="' + x0 + '" y="' + yTop + '" width="' + (x1 - x0) + '" height="' + h + '" fill="' + face + '"/>' +
      '<rect x="' + x0 + '" y="' + (yTop - 5) + '" width="' + (x1 - x0) + '" height="7" fill="' + cap + '"/>';
    var rows = 3, jr = "";
    for (var r = 0; r < rows; r++) {
      var y = yTop + h * (r + 1) / (rows + 0.6);
      jr += '<path d="M' + x0 + " " + y.toFixed(1) + " H" + x1 + '"/>';
      var x = x0 + rnd(seed + r * 17) * 40;
      while (x < x1) {
        jr += '<path d="M' + x.toFixed(1) + " " + y.toFixed(1) + " V" + (y - h / (rows + 0.6)).toFixed(1) + '"/>';
        x += 26 + rnd(seed + r * 31 + x) * 34;
      }
    }
    return s + '<g stroke="' + joint + '" stroke-width="2.2" fill="none">' + jr + "</g>";
  }
  // 굴뚝 연기
  function smoke(x, y, sc, col, fid) {
    return '<path d="M' + x + " " + y + " q" + 16 * sc + " " + -26 * sc + " " + 2 * sc + " " + -52 * sc +
      " q" + -16 * sc + " " + -28 * sc + " " + 10 * sc + " " + -56 * sc +
      '" stroke="' + col + '" stroke-width="' + 15 * sc + '" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>';
  }
  // 히스 꽃 무리
  function heather(y0, n, seed, cols, sMin, sMax) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = rnd(seed + i) * W;
      var y = y0 + rnd(seed + i + 30) * 70;
      var r = sMin + rnd(seed + i + 60) * (sMax - sMin);
      var c = cols[Math.floor(rnd(seed + i + 90) * cols.length)];
      s += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + r.toFixed(1) + '" fill="' + c + '" opacity="' + (0.5 + rnd(seed + i + 110) * 0.5).toFixed(2) + '"/>';
    }
    return s;
  }
  // 산등성이 실루엣 (부드러운 능선)
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
  // 태양/달 + 블룸 (gid = 미리 정의한 방사 그라디언트 id)
  function orb(x, y, r, core, gid) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r * 5 + '" fill="url(#' + gid + ')"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + core + '"/>';
  }
  // 새 무리
  function birds(list, col, sc) {
    sc = sc || 1;
    return list.map(function (p) {
      var s = (p[2] || 1) * sc;
      return '<path d="M' + p[0] + " " + p[1] + " q" + 6 * s + " " + -6 * s + " " + 12 * s + " 0 q" + 6 * s + " " + -6 * s + " " + 12 * s +
        ' 0" stroke="' + col + '" stroke-width="' + (2 * s).toFixed(1) + '" fill="none" stroke-linecap="round"/>';
    }).join("");
  }
  // 창밖으로 쏟아지는 빛기둥 (실내용)
  function shaft(x0, y0, x1, y1, x2, y2, x3, y3, col, op, fid) {
    return '<path d="M' + x0 + " " + y0 + " L" + x1 + " " + y1 + " L" + x2 + " " + y2 + " L" + x3 + " " + y3 +
      ' Z" fill="' + col + '" opacity="' + op + '" filter="url(#' + fid + ')"/>';
  }

  function svg(defs, body) {
    return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" + defs + "</defs>" + body + "</svg>";
  }

  var S = {};

  /* ══════ 리버풀 부두 — 비 갠 잿빛 저녁, 역광의 범선 숲 ══════ */
  S.liverpool = function () {
    var sk = nid("sk"), sn = nid("sn"), hz = nid("hz"), bl = nid("bl"), wt = nid("wt"), bl2 = nid("b2");
    var SKY = "#8ea3b6";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#3f5470"], [0.3, "#6a819a"], [0.55, "#93a7b8"], [0.74, "#c2b8a8"], [0.88, "#d8bb95"], [1, "#b99777"]]) +
      rg(sn, "50%", "50%", "50%", [[0, "#fff0cc", 0.85], [0.35, "#ffd79a", 0.35], [1, "#ffc98a", 0]]) +
      lg(hz, 0, 0, 0, 1, [[0, "#c9c0b2", 0], [1, "#c9c0b2", 0.85]]) +
      lg(wt, 0, 0, 0, 1, [[0, "#7b8896"], [0.4, "#59677a"], [1, "#33404f"]]) +
      blur(bl, 26) + blur(bl2, 6),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      cirrus(96, "#d3cec2", 0.5, 9, 12) +
      cirrus(170, "#e4d2b8", 0.4, 6, 33) +
      // 저무는 해 + 광선
      orb(676, 268, 26, "#fff2d2", sn) +
      rays(676, 268, [[-118, 2.2, 420, 0.16], [-96, 1.4, 380, 0.13], [-72, 2.6, 400, 0.15], [-46, 1.2, 340, 0.1]], "#ffe9bd", bl) +
      cloud(190, 132, 1.25, "#7c8ea2", "#e0cdb4", 0.92) +
      cloud(560, 92, 0.95, "#8492a4", "#e8d5ba", 0.8) +
      cloud(860, 150, 1.1, "#78889c", "#d8c4ab", 0.75) +
      birds([[404, 148, 1], [452, 126, 0.8], [486, 160, 0.6], [300, 176, 0.5]], "rgba(30,38,50,.55)") +
      // 먼 도시 실루엣 (대기 원근)
      '<g fill="' + aerial("#3c4655", SKY, 0.55) + '">' +
      '<rect x="0" y="292" width="140" height="30"/><rect x="34" y="268" width="18" height="26"/>' +
      '<rect x="150" y="300" width="96" height="22"/><rect x="188" y="276" width="14" height="26"/>' +
      '<rect x="820" y="288" width="140" height="34"/><rect x="884" y="258" width="16" height="32"/>' +
      "</g>" +
      // 범선 숲 — 뒤(옅음) → 앞(짙음)
      '<g fill="' + aerial("#232c3a", SKY, 0.34) + '">' +
      '<rect x="300" y="192" width="4" height="132"/><rect x="342" y="214" width="3" height="110"/>' +
      '<path d="M303 198 L303 300 L262 292 Z" opacity=".85"/><path d="M305 214 L305 296 L340 288 Z" opacity=".8"/>' +
      '<rect x="800" y="206" width="4" height="118"/><path d="M803 212 L803 300 L768 292 Z" opacity=".8"/>' +
      "</g>" +
      // 수면
      '<rect y="322" width="960" height="86" fill="url(#' + wt + ')"/>' +
      // 해 반사 (물결 조각)
      '<g fill="#ffdda6" opacity=".55">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
        var y = 328 + i * 10, w = 46 - i * 4 + rnd(i) * 22;
        return '<rect x="' + (676 - w / 2).toFixed(0) + '" y="' + y + '" width="' + w.toFixed(0) + '" height="3.4" rx="1.7"/>';
      }).join("") + "</g>" +
      '<g stroke="rgba(214,230,242,.24)" stroke-width="2.6" fill="none" stroke-linecap="round">' +
      [0, 1, 2, 3, 4, 5].map(function (i) {
        var y = 334 + i * 12, x = rnd(i + 5) * 700;
        return '<path d="M' + x.toFixed(0) + " " + y + ' q26 -5 52 0"/>' +
          '<path d="M' + (x + 160).toFixed(0) + " " + (y + 4) + ' q22 -5 44 0"/>';
      }).join("") + "</g>" +
      // 앞 범선 (짙은 실루엣)
      '<g fill="#1b222e">' +
      '<path d="M96 326 L336 326 L316 286 L120 286 Z"/>' +
      '<rect x="182" y="86" width="9" height="204"/><rect x="262" y="120" width="7" height="170"/>' +
      '<path d="M187 96 L187 246 L108 236 Z" fill="#2b3442"/><path d="M189 112 L189 240 L258 232 Z" fill="#242c39"/>' +
      '<path d="M266 130 L266 244 L212 238 Z" fill="#2b3442"/>' +
      '<path d="M182 86 L226 98 L182 110 Z" fill="#7e2f36"/>' +
      "</g>" +
      '<path d="M96 326 q120 26 240 0" stroke="rgba(255,221,166,.3)" stroke-width="4" fill="none"/>' +
      // 부두 판자 + 짐짝 + 가로등
      '<rect y="408" width="960" height="132" fill="#4a3d2c"/>' +
      '<rect y="404" width="960" height="10" fill="#2f2618"/>' +
      '<g stroke="rgba(24,18,10,.5)" stroke-width="3">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return '<path d="M' + (i * 100 + 20) + ' 414 V540"/>'; }).join("") +
      '<path d="M0 452 H960" stroke-width="2.4"/><path d="M0 496 H960" stroke-width="2.4"/></g>' +
      '<rect y="404" width="960" height="136" fill="url(#' + hz + ')" opacity=".25"/>' +
      '<g><rect x="742" y="330" width="86" height="76" fill="#6b5638"/><rect x="742" y="330" width="86" height="12" fill="#7d6746"/>' +
      '<rect x="766" y="266" width="76" height="64" fill="#7a6342"/><rect x="766" y="266" width="76" height="11" fill="#8c7550"/>' +
      '<path d="M742 366 H828 M785 330 V406 M766 296 H842 M804 266 V330" stroke="#41331e" stroke-width="4"/></g>' +
      '<ellipse cx="640" cy="414" rx="34" ry="12" fill="#332a1c"/>' +
      '<rect x="98" y="252" width="10" height="160" fill="#20222a"/>' +
      '<path d="M86 250 h34 l-6 -14 h-22 Z" fill="#2a2c34"/>' +
      '<circle cx="103" cy="240" r="11" fill="#ffe0a2"/><circle cx="103" cy="240" r="30" fill="#ffd88f" opacity=".22" filter="url(#' + bl2 + ')"/>' +
      motes(26, 7, "#ffe6bb", 60, 200, 860, 220, 2, 0.5) +
      grass(540, 26, "#171208", 40, 0.6, 91)
    );
  };

  /* ══════ 언덕 저택 거실 — 벽난로 불빛과 창의 냉광 대비 ══════ */
  S.hall = function () {
    var wl = nid("wl"), fr = nid("fr"), wn = nid("wn"), bl = nid("bl"), bl2 = nid("b2"), fl = nid("fl");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#2b1d10"], [0.35, "#4b331d"], [0.62, "#6d4a29"], [1, "#241708"]]) +
      rg(fr, "50%", "62%", "62%", [[0, "#ffc169", 0.55], [0.45, "#e2802f", 0.24], [1, "#c0561a", 0]]) +
      lg(wn, 0, 0, 0, 1, [[0, "#9fb2c4"], [1, "#65798e"]]) +
      rg(fl, "50%", "60%", "55%", [[0, "#fff0c0", 0.9], [0.4, "#ffc266", 0.35], [1, "#ff9a2e", 0]]) +
      blur(bl, 22) + blur(bl2, 5),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 천장 들보
      '<rect width="960" height="52" fill="#241708"/>' +
      '<rect y="52" width="960" height="9" fill="#150d04"/>' +
      '<g fill="#1b1106"><rect x="180" y="0" width="26" height="56"/><rect x="500" y="0" width="26" height="56"/><rect x="820" y="0" width="26" height="56"/></g>' +
      // 벽 패널
      '<g fill="none" stroke="rgba(22,13,4,.45)" stroke-width="6">' +
      '<rect x="60" y="118" width="150" height="184"/><rect x="742" y="118" width="150" height="184"/></g>' +
      // 창 + 냉광 유입
      '<rect x="742" y="130" width="126" height="172" fill="url(#' + wn + ')"/>' +
      '<path d="M742 236 Q805 214 868 236 V302 H742 Z" fill="#4e6270" opacity=".8"/>' +
      '<path d="M805 130 V302 M742 216 H868" stroke="#2b1d0f" stroke-width="9"/>' +
      '<rect x="734" y="122" width="142" height="188" fill="none" stroke="#1d1206" stroke-width="12"/>' +
      shaft(742, 302, 868, 302, 700, 540, 420, 540, "#b9d2e8", 0.1, bl) +
      // 벽난로 — 인물이 서는 화면 중앙을 비우기 위해 좌측으로 배치
      '<g transform="translate(-232 0)">' +
      '<rect x="316" y="150" width="292" height="234" fill="#5f5344"/>' +
      '<rect x="300" y="150" width="324" height="26" fill="#71624f"/>' +
      '<rect x="300" y="150" width="324" height="8" fill="#877558"/>' +
      '<g stroke="rgba(30,22,12,.35)" stroke-width="3">' +
      '<path d="M316 210 H608 M316 264 H608 M316 318 H608 M370 176 V210 M470 210 V264 M540 264 V318 M400 318 V384"/></g>' +
      '<path d="M348 202 h228 v182 h-228 z" fill="#180c04"/>' +
      // 장작 + 불꽃 (다층)
      '<g><rect x="386" y="352" width="150" height="16" rx="7" fill="#4a3018" transform="rotate(-5 461 360)"/>' +
      '<rect x="398" y="336" width="126" height="14" rx="6" fill="#402913" transform="rotate(6 461 343)"/></g>' +
      '<path d="M378 384 q26 -78 70 -42 q14 -60 52 -20 q34 -36 42 18 q28 -22 22 44 z" fill="#e0651f"/>' +
      '<path d="M404 384 q20 -52 46 -26 q14 -38 34 -12 q24 -22 26 38 z" fill="#ff9c30"/>' +
      '<path d="M428 384 q12 -32 28 -14 q10 -22 20 6 z" fill="#ffe08a"/>' +
      '<ellipse cx="462" cy="330" rx="180" ry="120" fill="url(#' + fr + ')"/>' +
      '<rect x="300" y="378" width="324" height="16" fill="#3a2c1a"/>' +
      "</g>" +
      // 촛대 + 초상화 (중앙 상단 벽)
      '<rect x="656" y="232" width="9" height="52" fill="#8a744e"/><ellipse cx="660" cy="288" rx="17" ry="6" fill="#6d5a38"/>' +
      '<ellipse cx="660" cy="222" rx="15" ry="21" fill="url(#' + fl + ')"/>' +
      '<path d="M660 208 q7 9 0 20 q-7 -11 0 -20 z" fill="#ffd682"/><circle cx="660" cy="224" r="3.4" fill="#fff6d2"/>' +
      '<g><rect x="432" y="112" width="96" height="124" fill="#3d3122" stroke="#967c4e" stroke-width="9"/>' +
      '<ellipse cx="480" cy="164" rx="24" ry="31" fill="#7a6746"/><path d="M450 236 q30 -42 60 0 z" fill="#5e4e33"/></g>' +
      // 바닥·양탄자
      '<rect y="392" width="960" height="148" fill="#3a2a17"/>' +
      '<g stroke="rgba(14,8,2,.38)" stroke-width="3">' +
      '<path d="M0 420 H960 M0 462 H960 M0 506 H960"/></g>' +
      '<path d="M186 540 L300 424 H660 L774 540 Z" fill="#63301f"/>' +
      '<path d="M240 540 L332 446 H628 L720 540 Z" fill="none" stroke="#9c5a34" stroke-width="6"/>' +
      '<path d="M292 540 L364 468 H596 L668 540 Z" fill="none" stroke="rgba(220,170,110,.35)" stroke-width="4"/>' +
      '<ellipse cx="230" cy="470" rx="300" ry="112" fill="#ff9a3c" opacity=".12"/>' +
      motes(34, 21, "#ffd9a0", 40, 190, 440, 230, 2.2, 0.55)
    );
  };

  /* ══════ 부엌 — 화덕의 온광, 비 내리는 창의 냉광 ══════ */
  S.kitchen = function () {
    var wl = nid("wl"), ov = nid("ov"), wn = nid("wn"), bl = nid("bl"), fl = nid("fl");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#2a2013"], [0.4, "#46362a"], [0.7, "#5a4327"], [1, "#1d1409"]]) +
      rg(ov, "50%", "58%", "60%", [[0, "#ffb75e", 0.5], [0.5, "#e0701e", 0.2], [1, "#b74e12", 0]]) +
      lg(wn, 0, 0, 0, 1, [[0, "#8fa6bb"], [1, "#54687e"]]) +
      rg(fl, "50%", "60%", "55%", [[0, "#fff0c0", 0.9], [0.4, "#ffc266", 0.32], [1, "#ff9a2e", 0]]) +
      blur(bl, 20),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 석회벽 얼룩
      '<g fill="rgba(255,225,180,.05)"><ellipse cx="240" cy="120" rx="180" ry="90"/><ellipse cx="720" cy="200" rx="200" ry="100"/></g>' +
      // 선반 + 그릇
      '<rect x="540" y="88" width="380" height="13" fill="#1e1408"/><rect x="540" y="86" width="380" height="4" fill="#43331c"/>' +
      '<g><circle cx="592" cy="64" r="24" fill="#c9b894"/><circle cx="592" cy="60" r="18" fill="#d8c7a2"/>' +
      '<circle cx="660" cy="64" r="24" fill="#b8a685"/><circle cx="660" cy="60" r="18" fill="#c6b494"/>' +
      '<circle cx="732" cy="60" r="28" fill="#c9b894"/><circle cx="732" cy="56" r="21" fill="#d8c7a2"/>' +
      '<circle cx="808" cy="64" r="24" fill="#b0a084"/><circle cx="808" cy="60" r="18" fill="#c0b092"/></g>' +
      '<rect x="540" y="184" width="380" height="13" fill="#1e1408"/><rect x="540" y="182" width="380" height="4" fill="#43331c"/>' +
      '<g><rect x="576" y="132" width="34" height="52" rx="4" fill="#8a7248"/><rect x="576" y="132" width="12" height="52" fill="#9c8354"/>' +
      '<rect x="638" y="124" width="40" height="60" rx="5" fill="#9a8258"/><rect x="638" y="124" width="13" height="60" fill="#ab9366"/>' +
      '<rect x="706" y="132" width="34" height="52" rx="4" fill="#8a7248"/><rect x="706" y="132" width="12" height="52" fill="#9c8354"/>' +
      '<ellipse cx="812" cy="160" rx="30" ry="25" fill="#7c6844"/><ellipse cx="804" cy="152" rx="15" ry="12" fill="#8e7a52"/></g>' +
      // 걸린 팬·허브 다발
      '<path d="M80 56 q30 46 0 92 M148 50 q-26 50 0 100" stroke="#150d04" stroke-width="9" fill="none"/>' +
      '<circle cx="80" cy="168" r="28" fill="#4a3f33"/><circle cx="74" cy="160" r="14" fill="#5a4e40"/>' +
      '<circle cx="148" cy="172" r="24" fill="#443828"/><circle cx="142" cy="164" r="12" fill="#544636"/>' +
      '<g stroke="#556a32" stroke-width="6" fill="none" stroke-linecap="round">' +
      '<path d="M216 56 q10 40 -4 66 M232 54 q4 36 12 62 M248 58 q-2 40 -14 60"/></g>' +
      '<path d="M210 50 h48" stroke="#3a2c18" stroke-width="7"/>' +
      // 비 내리는 창 + 빛기둥
      '<rect x="386" y="106" width="128" height="156" fill="url(#' + wn + ')"/>' +
      '<g stroke="rgba(226,238,250,.35)" stroke-width="2.4">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<path d="M' + (392 + i * 16) + ' 108 l-10 152"/>'; }).join("") + "</g>" +
      '<path d="M450 106 V262 M386 184 H514" stroke="#1e1408" stroke-width="9"/>' +
      '<rect x="378" y="98" width="144" height="172" fill="none" stroke="#150d04" stroke-width="12"/>' +
      shaft(386, 262, 514, 262, 560, 540, 300, 540, "#c2d8ec", 0.09, bl) +
      // 화덕
      '<rect x="40" y="242" width="252" height="150" fill="#4e4234"/>' +
      '<rect x="40" y="234" width="252" height="14" fill="#5f5241"/>' +
      '<path d="M66 264 h200 v128 h-200 z" fill="#1c1008"/>' +
      '<path d="M92 392 q22 -56 52 -28 q16 -42 40 -8 q22 -22 26 36 z" fill="#df6620"/>' +
      '<path d="M112 392 q16 -36 36 -18 q12 -26 26 -4 z" fill="#ff9c30"/>' +
      '<ellipse cx="166" cy="352" rx="150" ry="98" fill="url(#' + ov + ')"/>' +
      '<ellipse cx="166" cy="270" rx="56" ry="20" fill="#33281c"/>' +
      '<path d="M120 268 q46 -62 92 0" stroke="#120c06" stroke-width="9" fill="none"/>' +
      // 테이블
      '<rect y="392" width="960" height="148" fill="#33260f"/>' +
      '<g stroke="rgba(12,7,2,.36)" stroke-width="3"><path d="M0 424 H960 M0 470 H960 M0 516 H960"/></g>' +
      '<rect x="530" y="330" width="392" height="26" rx="4" fill="#6e5636"/>' +
      '<rect x="530" y="326" width="392" height="8" fill="#836941"/>' +
      '<rect x="556" y="356" width="22" height="184" fill="#523d1c"/><rect x="876" y="356" width="22" height="184" fill="#523d1c"/>' +
      '<ellipse cx="626" cy="318" rx="42" ry="16" fill="#c2a262"/><ellipse cx="626" cy="308" rx="30" ry="13" fill="#dcbc7c"/>' +
      '<ellipse cx="716" cy="320" rx="26" ry="11" fill="#9d8354"/>' +
      '<rect x="796" y="272" width="9" height="54" fill="#8a744e"/><ellipse cx="800" cy="330" rx="17" ry="6" fill="#6d5a38"/>' +
      '<ellipse cx="800" cy="262" rx="15" ry="21" fill="url(#' + fl + ')"/>' +
      '<path d="M800 248 q7 9 0 20 q-7 -11 0 -20 z" fill="#ffd682"/><circle cx="800" cy="264" r="3.4" fill="#fff6d2"/>' +
      motes(30, 41, "#ffd9a0", 60, 230, 420, 200, 2, 0.5)
    );
  };

  /* ══════ 헛간 — 판자 틈으로 쏟아지는 빛기둥과 떠다니는 짚먼지 ══════ */
  S.barn = function () {
    var wl = nid("wl"), bl = nid("bl"), lt = nid("lt"), hy = nid("hy");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#1c1509"], [0.45, "#33280f"], [0.8, "#241a0b"], [1, "#120c05"]]) +
      lg(hy, 0, 0, 0, 1, [[0, "#b39449"], [0.5, "#93762f"], [1, "#5f4a1c"]]) +
      rg(lt, "50%", "50%", "50%", [[0, "#ffe1a0", 0.85], [0.45, "#ffc76a", 0.3], [1, "#ffb347", 0]]) +
      blur(bl, 16),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 판자벽
      '<g stroke="#0f0a03" stroke-width="12">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<path d="M' + (i * 92 + 46) + ' 0 V540"/>'; }).join("") + "</g>" +
      '<g stroke="rgba(90,66,30,.35)" stroke-width="3">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return '<path d="M' + (i * 92 + 90) + ' 0 V540"/>'; }).join("") + "</g>" +
      // 서까래
      '<path d="M0 88 L480 16 L960 88" stroke="#0c0803" stroke-width="20" fill="none"/>' +
      '<path d="M0 150 H960" stroke="#0c0803" stroke-width="14"/>' +
      '<path d="M180 22 V150 M480 16 V150 M780 22 V150" stroke="#0c0803" stroke-width="11"/>' +
      // 판자 틈 빛 + 빛기둥
      '<g>' +
      [[160, 0.16], [432, 0.2], [700, 0.14]].map(function (g) {
        return '<path d="M' + g[0] + ' 0 V540" stroke="rgba(255,226,160,' + (g[1] * 2.4).toFixed(2) + ')" stroke-width="5"/>' +
          shaft(g[0] - 8, 0, g[0] + 8, 0, g[0] + 150, 540, g[0] + 96, 540, "#ffd98f", g[1], bl);
      }).join("") + "</g>" +
      // 건초 더미
      '<ellipse cx="190" cy="470" rx="250" ry="110" fill="url(#' + hy + ')"/>' +
      '<ellipse cx="140" cy="418" rx="140" ry="72" fill="#a98a3e"/>' +
      '<ellipse cx="110" cy="392" rx="86" ry="42" fill="#bd9c4c"/>' +
      '<g stroke="#cdb05c" stroke-width="3" stroke-linecap="round" opacity=".8">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) {
        var x = 30 + rnd(i) * 330, y = 366 + rnd(i + 20) * 90;
        return '<path d="M' + x.toFixed(0) + " " + y.toFixed(0) + " l" + ((rnd(i + 40) - 0.5) * 40).toFixed(0) + " -" + (12 + rnd(i + 60) * 20).toFixed(0) + '"/>';
      }).join("") + "</g>" +
      '<ellipse cx="856" cy="500" rx="160" ry="72" fill="#7f6428"/>' +
      '<ellipse cx="880" cy="466" rx="96" ry="42" fill="#93762f"/>' +
      // 랜턴
      '<path d="M660 150 V218" stroke="#0c0803" stroke-width="7"/>' +
      '<rect x="634" y="218" width="52" height="66" rx="8" fill="#3a3020"/>' +
      '<rect x="644" y="228" width="32" height="46" fill="#241b10"/>' +
      '<ellipse cx="660" cy="252" rx="26" ry="34" fill="url(#' + lt + ')"/>' +
      '<path d="M660 236 q8 11 0 24 q-8 -13 0 -24 z" fill="#ffdd8e"/>' +
      '<circle cx="660" cy="256" r="4" fill="#fff6d2"/>' +
      '<circle cx="660" cy="252" r="110" fill="#ffc466" opacity=".1" filter="url(#' + bl + ')"/>' +
      // 짚 바닥
      '<rect y="492" width="960" height="48" fill="#241a0c"/>' +
      grass(540, 40, "#1a1206", 46, 0.85, 71) +
      motes(46, 61, "#ffdda2", 80, 60, 800, 440, 2.6, 0.75)
    );
  };

  /* ══════ 폭풍의 언덕 저택 외경 — 흐린 하늘, 바람에 굽은 나무 ══════ */
  S.heights_ext = function () {
    var sk = nid("sk"), bl = nid("bl"), st = nid("st"), gl = nid("gl"), gr = nid("gr"), bl2 = nid("b2");
    var SKY = "#9aa8b4";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#41526a"], [0.28, "#6d7f92"], [0.52, "#9aa8b4"], [0.72, "#b4bcbe"], [1, "#a8ab9c"]]) +
      lg(st, 0, 0, 0, 1, [[0, "#77736a"], [0.55, "#5c5951"], [1, "#3d3b34"]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#354729"], [1, "#1e2a17"]]) +
      rg(gl, "50%", "50%", "50%", [[0, "#fff4d8", 0.5], [1, "#ffeec8", 0]]) +
      blur(bl, 22) + blur(bl2, 14),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      cirrus(70, "#8e9dab", 0.55, 8, 5) +
      // 구름 사이로 새는 빛
      '<circle cx="700" cy="120" r="150" fill="url(#' + gl + ')"/>' +
      rays(700, 120, [[64, 2.6, 460, 0.13], [82, 1.6, 420, 0.1], [104, 2.2, 440, 0.11]], "#fff2d4", bl) +
      cloud(180, 108, 1.5, "#68788c", "#c6ced6", 0.95) +
      cloud(560, 76, 1.2, "#72808f", "#d0d6da", 0.85) +
      cloud(880, 130, 1.3, "#5e6d80", "#b8c2cc", 0.8) +
      birds([[560, 190, 1], [612, 168, 0.8], [648, 204, 0.6]], "rgba(26,32,38,.6)") +
      // 먼 능선 (대기 원근 3겹)
      ridge([[0, 330], [200, 300], [420, 322], [660, 296], [960, 318]], aerial("#4a5a48", SKY, 0.62)) +
      ridge([[0, 366], [240, 342], [520, 362], [780, 344], [960, 358]], aerial("#44543f", SKY, 0.4)) +
      // 저택 (돌집)
      '<g>' +
      '<path d="M296 206 L470 128 L644 206 V352 H296 Z" fill="url(#' + st + ')"/>' +
      '<path d="M296 206 L470 128 L644 206 L644 224 L470 148 L296 224 Z" fill="#31302b"/>' +
      '<path d="M470 128 L644 206 L644 224 L470 148 Z" fill="#3d3c36"/>' +
      '<rect x="330" y="106" width="30" height="76" fill="#4b4941"/><rect x="326" y="100" width="38" height="12" fill="#585549"/>' +
      '<rect x="586" y="96" width="30" height="86" fill="#4b4941"/><rect x="582" y="90" width="38" height="12" fill="#585549"/>' +
      smoke(600, 88, 1, "rgba(224,230,236,.34)", bl2) +
      // 슬레이트 지붕 결 (처마와 나란한 가로 단)
      '<g stroke="rgba(22,20,17,.32)" stroke-width="2.4">' +
      [1, 2, 3, 4, 5].map(function (i) {
        var y = 128 + (206 - 128) * (i / 6);
        var hw = ((y - 128) / 78) * 174;
        return '<path d="M' + (470 - hw).toFixed(0) + " " + y.toFixed(0) + " H" + (470 + hw).toFixed(0) + '"/>';
      }).join("") + "</g>" +
      // 석재 결
      '<g stroke="rgba(28,26,22,.4)" stroke-width="3">' +
      '<path d="M312 240 h58 M400 262 h52 M520 244 h66 M340 288 h48 M488 292 h60 M310 320 h44 M580 318 h50"/></g>' +
      // 창 (하나는 불빛)
      '<rect x="352" y="252" width="48" height="66" fill="#22201a"/><path d="M376 252 V318 M352 285 H400" stroke="#15130f" stroke-width="5"/>' +
      '<rect x="540" y="252" width="48" height="66" fill="#e8b063"/><path d="M564 252 V318 M540 285 H588" stroke="#2a251b" stroke-width="5"/>' +
      '<rect x="536" y="248" width="56" height="74" fill="#ffcf86" opacity=".25" filter="url(#' + bl + ')"/>' +
      '<rect x="444" y="272" width="52" height="80" fill="#1e1a14"/><rect x="440" y="266" width="60" height="10" fill="#16130e"/>' +
      "</g>" +
      // 바람에 기운 전나무 (원작의 상징목)
      conifer(150, 356, 190, 62, "#4a6a3c", "#22301c", -11) +
      conifer(232, 352, 118, 42, "#43613a", "#1e2b19", -8) +
      conifer(844, 350, 156, 54, "#456439", "#202d1a", 9) +
      // 언덕 앞면 + 돌담 (담 아랫동은 지면에 묻히게 순서 배치)
      ridge([[0, 430], [260, 406], [560, 424], [820, 408], [960, 420]], "#3f5236") +
      drywall(-10, 970, 412, 40, "#6d6b60", "#84826f", "rgba(38,36,30,.5)", 3) +
      '<path d="M0 442 Q240 430 480 440 Q720 450 960 438 V540 H0 Z" fill="#354729"/>' +
      '<path d="M0 442 Q240 430 480 440 Q720 450 960 438" stroke="rgba(150,180,130,.2)" stroke-width="3" fill="none"/>' +
      '<rect y="480" width="960" height="60" fill="url(#' + gr + ')"/>' +
      heather(452, 40, 101, ["#8b6aa6", "#a07eb8", "#6f5590"], 4, 9) +
      grass(500, 30, "#2a3a22", 40, 0.7, 131) +
      grass(540, 46, "#1a2416", 62, 0.92, 111) +
      motes(18, 121, "#e2ecd8", 0, 300, 960, 200, 2, 0.35)
    );
  };

  /* ══════ 황야 낮 — 히스 벌판, 뭉게구름, 대기 원근 ══════ */
  S.moor = function () {
    var sk = nid("sk"), bl = nid("bl"), sn = nid("sn"), hz = nid("hz"), gr = nid("gr");
    var SKY = "#a9cfe4";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#3f7fb8"], [0.24, "#69a6ce"], [0.5, "#a9cfe4"], [0.76, "#d6e9ef"], [1, "#eaf0e4"]]) +
      rg(sn, "50%", "50%", "50%", [[0, "#fffbe8", 0.9], [0.3, "#fff3c8", 0.4], [1, "#ffeeb8", 0]]) +
      lg(hz, 0, 0, 0, 1, [[0, "#dcecef", 0], [0.34, "#dcecef", 0.9], [1, "#dcecef", 0]]) +
      lg(gr, 0, 0, 0, 1, [[0, "#5e8a4c"], [0.5, "#48713c"], [1, "#2f5028"]]) +
      blur(bl, 24),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      cirrus(58, "#ffffff", 0.5, 8, 3) +
      orb(792, 96, 30, "#fffdf0", sn) +
      rays(792, 96, [[112, 2.4, 440, 0.12], [134, 1.6, 400, 0.1], [156, 2, 380, 0.09]], "#fff8dc", bl) +
      cloud(210, 138, 1.5, "#c3d7e6", "#ffffff", 0.98) +
      cloud(520, 96, 1.15, "#cadcea", "#ffffff", 0.9) +
      cloud(830, 168, 1.25, "#bed3e4", "#fdfeff", 0.85) +
      cloud(380, 200, 0.8, "#cddeeb", "#ffffff", 0.6) +
      birds([[430, 150, 1], [478, 128, 0.8], [514, 164, 0.6], [640, 200, 0.5]], "rgba(50,70,90,.45)") +
      // 능선 4겹 — 멀수록 하늘색으로 수렴
      ridge([[0, 296], [220, 272], [460, 290], [720, 268], [960, 286]], aerial("#6f8f5e", SKY, 0.66)) +
      ridge([[0, 334], [260, 310], [540, 330], [800, 312], [960, 326]], aerial("#5f8450", SKY, 0.45)) +
      ridge([[0, 382], [240, 356], [520, 378], [780, 360], [960, 374]], aerial("#547a46", SKY, 0.24)) +
      '<rect y="270" width="960" height="130" fill="url(#' + hz + ')" opacity=".55"/>' +
      // 먼 나무 (원근감)
      conifer(120, 356, 66, 24, aerial("#4a6a3c", SKY, 0.42), aerial("#22301c", SKY, 0.42), -7) +
      conifer(880, 352, 54, 20, aerial("#4a6a3c", SKY, 0.5), aerial("#22301c", SKY, 0.5), 6) +
      // 돌담 (아랫동은 앞 벌판에 묻힘)
      drywall(548, 970, 390, 40, "#9d9c88", "#b4b29a", "rgba(96,92,74,.55)", 9) +
      // 가까운 벌판
      ridge([[0, 424], [280, 406], [600, 424], [860, 410], [960, 422]], "#55804a") +
      '<path d="M0 424 Q280 406 600 424 Q860 410 960 422" stroke="rgba(220,240,190,.3)" stroke-width="3" fill="none"/>' +
      '<rect y="462" width="960" height="78" fill="url(#' + gr + ')"/>' +
      // 구름 그림자 (지면의 얼룩)
      '<g fill="#2f5028" opacity=".18"><ellipse cx="230" cy="470" rx="220" ry="26"/><ellipse cx="760" cy="500" rx="260" ry="30"/></g>' +
      heather(420, 64, 201, ["#9a72b4", "#b48ecc", "#8358a4", "#c9a6dc"], 4, 10) +
      grass(468, 30, "#3f6234", 34, 0.7, 241) +
      grass(506, 34, "#33512a", 46, 0.85, 211) +
      grass(540, 46, "#1f3a1a", 66, 0.95, 221) +
      // 전경 흔들리는 히스 (짙은 실루엣)
      '<g fill="#1e3618">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
        var x = rnd(i + 40) * 960, y = 528 - rnd(i + 50) * 26;
        return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (6 + rnd(i + 60) * 5).toFixed(1) + '"/>';
      }).join("") + "</g>" +
      motes(22, 231, "#ffffff", 0, 240, 960, 250, 2.4, 0.45)
    );
  };

  /* ══════ 황야 밤 — 달빛, 별, 은하 ══════ */
  S.moor_night = function () {
    var sk = nid("sk"), mn = nid("mn"), bl = nid("bl"), mw = nid("mw");
    var SKY = "#1b2a48";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#050b1c"], [0.3, "#111f3e"], [0.58, "#1e3055"], [0.8, "#2b3d5e"], [1, "#1b2438"]]) +
      rg(mn, "50%", "50%", "50%", [[0, "#eef4ff", 0.75], [0.28, "#c8d8f4", 0.3], [1, "#a8c0e8", 0]]) +
      lg(mw, 0, 0, 1, 1, [[0, "#8ea6d8", 0], [0.5, "#a8bce4", 0.16], [1, "#8ea6d8", 0]]) +
      blur(bl, 26),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      // 은하수
      '<g transform="rotate(-18 480 160)"><rect x="-100" y="60" width="1160" height="150" fill="url(#' + mw + ')" filter="url(#' + bl + ')"/></g>' +
      // 별 (크기·밝기 분포)
      '<g fill="#ffffff">' +
      [].concat.apply([], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (b) {
        return [0, 1, 2, 3, 4, 5, 6, 7].map(function (a) {
          var i = b * 8 + a;
          var x = rnd(i) * 960, y = rnd(i + 300) * 330;
          var r = 0.7 + rnd(i + 600) * 1.9;
          var o = 0.35 + rnd(i + 900) * 0.65;
          return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + r.toFixed(1) + '" opacity="' + o.toFixed(2) + '"/>';
        });
      })).join("") + "</g>" +
      // 밝은 별 몇 개 (십자 반짝임)
      '<g stroke="#ffffff" stroke-linecap="round" opacity=".85">' +
      [[160, 86, 9], [612, 54, 11], [880, 130, 8]].map(function (p) {
        return '<path d="M' + p[0] + " " + (p[1] - p[2]) + " V" + (p[1] + p[2]) + " M" + (p[0] - p[2]) + " " + p[1] + " H" + (p[0] + p[2]) + '" stroke-width="2"/>';
      }).join("") + "</g>" +
      // 달 + 블룸
      orb(724, 118, 40, "#e9f0fb", mn) +
      '<g fill="#c9d6ea" opacity=".55"><circle cx="710" cy="106" r="10"/><circle cx="736" cy="130" r="7"/><circle cx="716" cy="136" r="5"/></g>' +
      rays(724, 118, [[100, 3, 400, 0.07], [126, 2, 360, 0.06]], "#dfe9fb", bl) +
      cloud(280, 130, 1.3, "#1b2740", "#5f7398", 0.8) +
      cloud(840, 96, 1, "#1a2540", "#54688c", 0.6) +
      // 능선 (달빛 림)
      ridge([[0, 320], [230, 292], [470, 312], [730, 288], [960, 308]], aerial("#14203a", SKY, 0.35)) +
      '<path d="M0 320 Q230 292 470 312 Q730 288 960 308" stroke="rgba(190,212,248,.22)" stroke-width="3" fill="none"/>' +
      ridge([[0, 372], [260, 344], [540, 366], [800, 346], [960, 362]], "#101a30") +
      '<path d="M0 372 Q260 344 540 366 Q800 346 960 362" stroke="rgba(180,204,244,.14)" stroke-width="2.6" fill="none"/>' +
      ridge([[0, 432], [280, 408], [600, 428], [860, 412], [960, 424]], "#0b1322") +
      '<rect y="466" width="960" height="74" fill="#070d19"/>' +
      // 달빛 물결 (지면 반사광)
      '<g stroke="rgba(180,204,248,.1)" stroke-width="3" fill="none">' +
      '<path d="M300 470 q80 -8 160 0 M520 490 q70 -8 140 0 M120 500 q60 -8 120 0"/></g>' +
      heather(430, 30, 301, ["rgba(150,124,196,.5)", "rgba(122,100,168,.42)"], 4, 8) +
      grass(540, 44, "#050a13", 62, 0.95, 311) +
      motes(24, 321, "#cfe0ff", 0, 300, 960, 220, 2, 0.4)
    );
  };

  /* ══════ 황야 노을 — 역광 능선, 하늘 그라디언트의 정점 ══════ */
  S.moor_sunset = function () {
    var sk = nid("sk"), sn = nid("sn"), bl = nid("bl"), gl = nid("gl");
    var SKY = "#e08a58";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#25275c"], [0.16, "#4b3a76"], [0.34, "#8d4f74"], [0.52, "#cd6a5c"], [0.68, "#ef9a4e"], [0.82, "#ffc772"], [1, "#ffe0a0"]]) +
      rg(sn, "50%", "50%", "50%", [[0, "#fff6d2", 0.95], [0.24, "#ffd98a", 0.55], [0.6, "#ff9f52", 0.18], [1, "#ff8c3c", 0]]) +
      rg(gl, "50%", "70%", "60%", [[0, "#ffd08a", 0.35], [1, "#ff9a52", 0]]) +
      blur(bl, 26),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      cirrus(80, "#a25e86", 0.55, 7, 15) +
      cirrus(150, "#ffb877", 0.5, 6, 25) +
      cirrus(210, "#ffd49a", 0.45, 5, 35) +
      // 지는 해 (능선에 반쯤 걸림)
      orb(486, 336, 56, "#fff3cc", sn) +
      rays(486, 336, [[-118, 3, 420, 0.16], [-96, 2, 400, 0.13], [-74, 3, 420, 0.15], [-52, 1.6, 360, 0.1], [-140, 2, 380, 0.12]], "#ffdca0", bl) +
      cloud(190, 116, 1.4, "#6e3f6e", "#ffb277", 0.92) +
      cloud(760, 92, 1.2, "#7a4570", "#ffbf84", 0.85) +
      cloud(430, 178, 0.9, "#8b4f6e", "#ffcd94", 0.7) +
      birds([[280, 178, 1], [330, 156, 0.8], [366, 192, 0.6], [700, 168, 0.7]], "rgba(48,24,52,.75)") +
      // 역광 능선 (뒤로 갈수록 밝고 흐림)
      ridge([[0, 344], [240, 322], [500, 340], [760, 320], [960, 336]], aerial("#5b3a62", SKY, 0.5)) +
      ridge([[0, 388], [260, 362], [540, 384], [800, 364], [960, 380]], aerial("#482e54", SKY, 0.26)) +
      '<path d="M0 388 Q260 362 540 384 Q800 364 960 380" stroke="rgba(255,206,140,.5)" stroke-width="3" fill="none"/>' +
      ridge([[0, 438], [280, 414], [600, 434], [860, 418], [960, 430]], "#331f42") +
      '<path d="M0 438 Q280 414 600 434 Q860 418 960 430" stroke="rgba(255,186,120,.45)" stroke-width="3.4" fill="none"/>' +
      '<rect y="470" width="960" height="70" fill="#241631"/>' +
      '<ellipse cx="486" cy="440" rx="380" ry="120" fill="url(#' + gl + ')"/>' +
      heather(430, 26, 401, ["rgba(120,74,132,.7)", "rgba(96,58,110,.6)"], 4, 9) +
      grass(540, 48, "#170d20", 68, 0.95, 411) +
      motes(26, 421, "#ffd9a0", 0, 260, 960, 240, 2.6, 0.6)
    );
  };

  /* ══════ 페니스톤 바위 — 황혼의 크래그, 아래로 펼쳐진 황야 ══════ */
  S.penistone = function () {
    var sk = nid("sk"), bl = nid("bl"), rk = nid("rk"), gl = nid("gl");
    var SKY = "#5d6a96";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#141a38"], [0.24, "#2f3a68"], [0.48, "#5d6a96"], [0.68, "#98859e"], [0.86, "#d09a86"], [1, "#e8b48c"]]) +
      lg(rk, 0, 0, 1, 1, [[0, "#8b849c"], [0.45, "#635d78"], [1, "#3a3550"]]) +
      rg(gl, "50%", "50%", "50%", [[0, "#ffd8a8", 0.4], [1, "#ffb478", 0]]) +
      blur(bl, 24),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      // 초저녁 별
      '<g fill="#e8eefc">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (i) {
        var x = rnd(i + 70) * 960, y = rnd(i + 170) * 190;
        return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (0.9 + rnd(i + 270) * 1.5).toFixed(1) + '" opacity="' + (0.4 + rnd(i + 370) * 0.6).toFixed(2) + '"/>';
      }).join("") + "</g>" +
      '<circle cx="820" cy="376" r="180" fill="url(#' + gl + ')"/>' +
      cirrus(150, "#8e7a9c", 0.5, 6, 45) +
      cirrus(240, "#d09a86", 0.45, 5, 55) +
      cloud(240, 128, 1.3, "#2f3660", "#9d8ba4", 0.85) +
      cloud(700, 100, 1, "#333a64", "#a894ac", 0.7) +
      birds([[380, 190, 0.9], [424, 170, 0.7]], "rgba(20,22,44,.7)") +
      // 발아래 황야 (높은 시점, 아득한 대기)
      ridge([[0, 330], [240, 314], [520, 326], [780, 312], [960, 322]], aerial("#4a4a72", SKY, 0.55)) +
      ridge([[0, 372], [280, 354], [560, 370], [820, 356], [960, 366]], aerial("#3e3e62", SKY, 0.33)) +
      ridge([[0, 420], [300, 400], [620, 418], [880, 404], [960, 414]], "#302f4e") +
      '<rect y="452" width="960" height="88" fill="#26253e"/>' +
      // 크래그 — 왼쪽 큰 바위 (역광 림라이트)
      '<g>' +
      '<path d="M20 540 L52 336 L150 268 L246 314 L286 540 Z" fill="url(#' + rk + ')"/>' +
      '<path d="M52 336 L150 268 L246 314 L226 330 L148 292 L74 348 Z" fill="#9990ab"/>' +
      '<path d="M150 268 L246 314 L226 330 L148 292 Z" fill="#b0a6c0"/>' +
      '<g stroke="rgba(24,20,40,.45)" stroke-width="4" fill="none">' +
      '<path d="M78 400 l86 -22 M66 462 l112 -26 M104 350 l58 -16 M120 500 l120 -20"/></g>' +
      '<path d="M52 336 L150 268 L246 314" stroke="rgba(255,206,152,.55)" stroke-width="4" fill="none"/>' +
      "</g>" +
      // 오른쪽 바위
      '<g>' +
      '<path d="M660 540 L692 372 L812 320 L916 376 L944 540 Z" fill="url(#' + rk + ')"/>' +
      '<path d="M692 372 L812 320 L916 376 L896 392 L810 344 L714 386 Z" fill="#8f86a4"/>' +
      '<path d="M812 320 L916 376 L896 392 L810 344 Z" fill="#a89dbc"/>' +
      '<g stroke="rgba(24,20,40,.45)" stroke-width="4" fill="none"><path d="M716 440 l100 -20 M704 494 l124 -22"/></g>' +
      '<path d="M692 372 L812 320 L916 376" stroke="rgba(255,206,152,.6)" stroke-width="4" fill="none"/>' +
      "</g>" +
      // 바람 결
      '<g stroke="rgba(226,226,250,.16)" stroke-width="3" fill="none" stroke-linecap="round">' +
      '<path d="M360 258 q60 -14 120 0 M400 288 q52 -12 104 0 M340 318 q46 -10 92 0"/></g>' +
      heather(438, 22, 501, ["rgba(150,116,178,.55)", "rgba(120,92,150,.5)"], 4, 8) +
      grass(540, 30, "#181630", 54, 0.9, 511, 260, 700) +
      motes(24, 521, "#e8d8ff", 200, 240, 560, 240, 2.2, 0.5)
    );
  };

  /* ══════ 스러시크로스 그레인지 — 샹들리에와 정원 창의 빛 ══════ */
  S.grange = function () {
    var wl = nid("wl"), wn = nid("wn"), bl = nid("bl"), fl = nid("fl"), ch = nid("ch"), fldr = nid("fd");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#7d6c4c"], [0.34, "#a89263"], [0.62, "#c4ad7c"], [1, "#6b5a3c"]]) +
      lg(wn, 0, 0, 0, 1, [[0, "#cfe6f2"], [0.45, "#a7d0c4"], [1, "#7aa878"]]) +
      rg(fl, "50%", "60%", "55%", [[0, "#fff4cc", 0.95], [0.4, "#ffc978", 0.35], [1, "#ffa53c", 0]]) +
      rg(ch, "50%", "40%", "60%", [[0, "#ffe9b8", 0.45], [0.5, "#ffcf82", 0.18], [1, "#ffb45a", 0]]) +
      lg(fldr, 0, 0, 1, 0, [[0, "#8a3c40"], [0.45, "#b04c50"], [1, "#6e2c32"]]) +
      blur(bl, 22),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 벽지 줄무늬 + 다마스크
      '<g stroke="rgba(122,100,62,.25)" stroke-width="18">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return '<path d="M' + (i * 84 + 30) + ' 0 V300"/>'; }).join("") + "</g>" +
      '<g fill="rgba(140,116,72,.22)">' +
      [].concat.apply([], [0, 1, 2].map(function (r) {
        return [0, 1, 2, 3, 4, 5, 6].map(function (c) {
          return '<ellipse cx="' + (c * 140 + 70) + '" cy="' + (r * 96 + 56) + '" rx="16" ry="26"/>';
        });
      })).join("") + "</g>" +
      // 웨인스코트
      '<rect y="300" width="960" height="46" fill="#6a583c"/>' +
      '<rect y="296" width="960" height="8" fill="#8b7550"/>' +
      '<rect y="340" width="960" height="8" fill="#4c3e28"/>' +
      // 샹들리에
      '<path d="M480 0 V44" stroke="#6b5a34" stroke-width="7"/>' +
      '<ellipse cx="480" cy="52" rx="14" ry="10" fill="#a48c52"/>' +
      '<path d="M372 92 Q480 148 588 92" stroke="#a48c52" stroke-width="8" fill="none"/>' +
      '<path d="M408 108 V78 M480 124 V92 M552 108 V78" stroke="#a48c52" stroke-width="7"/>' +
      '<g>' +
      [[408, 66], [480, 80], [552, 66]].map(function (p) {
        return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="15" ry="21" fill="url(#' + fl + ')"/>' +
          '<path d="M' + p[0] + " " + (p[1] - 14) + " q7 9 0 20 q-7 -11 0 -20 z\" fill=\"#ffd682\"/><circle cx=\"" + p[0] + '" cy="' + (p[1] + 2) + '" r="3.4" fill="#fff8dc"/>';
      }).join("") + "</g>" +
      // 크리스털 장식
      '<g fill="rgba(255,240,200,.55)">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        var x = 386 + i * 24, y = 108 + Math.abs(4 - i) * -5 + 18;
        return '<path d="M' + x + " " + y + " l5 9 l-5 9 l-5 -9 Z\"/>";
      }).join("") + "</g>" +
      '<circle cx="480" cy="96" r="190" fill="url(#' + ch + ')"/>' +
      // 큰 창 + 정원 + 빛기둥
      '<rect x="646" y="84" width="200" height="248" fill="url(#' + wn + ')"/>' +
      '<g><ellipse cx="700" cy="252" rx="60" ry="40" fill="#6b9a62"/><ellipse cx="800" cy="240" rx="70" ry="46" fill="#5e8e58"/>' +
      '<circle cx="686" cy="140" r="24" fill="#fffbe4"/><circle cx="686" cy="140" r="44" fill="#fff6cc" opacity=".4" filter="url(#' + bl + ')"/>' +
      '<path d="M646 286 Q746 262 846 286 V332 H646 Z" fill="#4f7c4a"/></g>' +
      '<path d="M746 84 V332 M646 172 H846 M646 254 H846" stroke="#41351f" stroke-width="9"/>' +
      '<rect x="636" y="74" width="220" height="268" fill="none" stroke="#4f4026" stroke-width="14"/>' +
      shaft(646, 332, 846, 332, 700, 540, 340, 540, "#fff2c8", 0.12, bl) +
      // 커튼
      '<path d="M628 66 q28 138 -6 280 L562 346 q26 -142 6 -280 Z" fill="url(#' + fldr + ')"/>' +
      '<path d="M596 76 q18 132 -4 264" stroke="rgba(255,190,170,.25)" stroke-width="7" fill="none"/>' +
      '<path d="M866 66 q-28 138 6 280 L932 346 q-26 -142 -6 -280 Z" fill="url(#' + fldr + ')"/>' +
      '<path d="M898 76 q-18 132 4 264" stroke="rgba(255,190,170,.25)" stroke-width="7" fill="none"/>' +
      // 액자
      '<g><rect x="120" y="116" width="94" height="120" fill="#5c4c34" stroke="#a58a56" stroke-width="9"/>' +
      '<ellipse cx="167" cy="164" rx="24" ry="31" fill="#8a7454"/><path d="M138 236 q29 -42 58 0 z" fill="#6e5c3c"/></g>' +
      '<g><rect x="266" y="130" width="72" height="90" fill="#5c4c34" stroke="#a58a56" stroke-width="8"/>' +
      '<ellipse cx="302" cy="168" rx="18" ry="23" fill="#8a7454"/></g>' +
      // 바닥
      '<rect y="346" width="960" height="194" fill="#7d5c36"/>' +
      '<g stroke="rgba(48,32,14,.28)" stroke-width="3">' +
      '<path d="M0 380 H960 M0 424 H960 M0 472 H960 M0 522 H960"/>' +
      [0, 1, 2, 3, 4, 5].map(function (i) { return '<path d="M' + (i * 170 + 40) + ' 346 l-30 194"/>'; }).join("") + "</g>" +
      '<ellipse cx="480" cy="440" rx="330" ry="110" fill="#ffce7c" opacity=".12"/>' +
      // 소파
      '<g><rect x="86" y="300" width="300" height="92" rx="30" fill="#b78a48"/>' +
      '<rect x="106" y="256" width="256" height="70" rx="28" fill="#c99c58"/>' +
      '<path d="M126 268 q106 -14 212 0" stroke="rgba(255,226,170,.4)" stroke-width="5" fill="none"/>' +
      '<rect x="74" y="332" width="38" height="86" rx="16" fill="#9a7238"/><rect x="362" y="332" width="38" height="86" rx="16" fill="#9a7238"/>' +
      '<rect x="118" y="410" width="16" height="34" fill="#6d4f24"/><rect x="340" y="410" width="16" height="34" fill="#6d4f24"/></g>' +
      motes(36, 601, "#ffeec4", 560, 120, 400, 320, 2.4, 0.6)
    );
  };

  /* ══════ 밤 침실 — 달빛 창, 커튼 그림자, 촛불 ══════ */
  S.night = function () {
    var wl = nid("wl"), wn = nid("wn"), bl = nid("bl"), fl = nid("fl"), mn = nid("mn");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#080d1c"], [0.4, "#141d38"], [0.72, "#1b2440"], [1, "#0a0f1e"]]) +
      lg(wn, 0, 0, 0, 1, [[0, "#22355f"], [0.5, "#37527f"], [1, "#4a668f"]]) +
      rg(mn, "50%", "50%", "50%", [[0, "#f2f7ff", 0.9], [0.3, "#cfe0f8", 0.35], [1, "#a8c4ec", 0]]) +
      rg(fl, "50%", "60%", "55%", [[0, "#fff0c0", 0.95], [0.4, "#ffc266", 0.35], [1, "#ff9a2e", 0]]) +
      blur(bl, 22),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 창 + 달
      '<rect x="546" y="66" width="248" height="286" fill="url(#' + wn + ')"/>' +
      '<g fill="#ffffff">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) {
        var x = 556 + rnd(i + 90) * 228, y = 76 + rnd(i + 190) * 200;
        return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (0.9 + rnd(i + 290) * 1.4).toFixed(1) + '" opacity="' + (0.4 + rnd(i + 390) * 0.5).toFixed(2) + '"/>';
      }).join("") + "</g>" +
      orb(626, 150, 34, "#f0f6ff", mn) +
      '<g fill="#cbd8ee" opacity=".5"><circle cx="614" cy="140" r="9"/><circle cx="638" cy="162" r="6"/></g>' +
      // 창밖 언덕
      '<path d="M546 300 Q640 274 730 296 Q770 306 794 298 V352 H546 Z" fill="#16223c"/>' +
      '<path d="M546 300 Q640 274 730 296" stroke="rgba(190,214,250,.28)" stroke-width="2.6" fill="none"/>' +
      // 창틀
      '<path d="M670 66 V352 M546 210 H794" stroke="#080c18" stroke-width="12"/>' +
      '<rect x="536" y="56" width="268" height="306" fill="none" stroke="#060a14" stroke-width="15"/>' +
      // 달빛 기둥 + 바닥 채광 사각형
      shaft(546, 352, 794, 352, 872, 540, 388, 540, "#bcd4f4", 0.13, bl) +
      '<path d="M470 462 L836 462 L900 540 L406 540 Z" fill="#a8c8ee" opacity=".12"/>' +
      '<path d="M646 462 V540" stroke="rgba(10,14,28,.4)" stroke-width="14"/>' +
      '<path d="M470 500 H872" stroke="rgba(10,14,28,.35)" stroke-width="12"/>' +
      // 커튼
      '<path d="M528 48 q30 158 -8 314 L456 358 q30 -160 8 -314 Z" fill="#1e2742"/>' +
      '<path d="M498 60 q22 148 -6 292" stroke="rgba(150,180,230,.14)" stroke-width="7" fill="none"/>' +
      // 침대
      '<rect x="34" y="120" width="20" height="300" fill="#1e160d"/><circle cx="44" cy="112" r="14" fill="#2c2114"/>' +
      '<rect x="34" y="150" width="230" height="14" fill="#1a130b"/>' +
      '<path d="M20 400 Q200 366 380 402 V540 H20 Z" fill="#2a3454"/>' +
      '<path d="M20 424 Q200 392 380 428" stroke="rgba(190,210,244,.16)" stroke-width="6" fill="none"/>' +
      '<path d="M20 468 Q200 440 380 474" stroke="rgba(190,210,244,.1)" stroke-width="5" fill="none"/>' +
      '<ellipse cx="130" cy="392" rx="80" ry="30" fill="#3b476c"/>' +
      // 촛대 탁자
      '<rect x="286" y="330" width="150" height="16" rx="4" fill="#2c2014"/>' +
      '<rect x="322" y="346" width="20" height="94" fill="#241a10"/>' +
      '<rect x="352" y="288" width="9" height="44" fill="#8a744e"/><ellipse cx="356" cy="336" rx="17" ry="6" fill="#6d5a38"/>' +
      '<ellipse cx="356" cy="276" rx="17" ry="24" fill="url(#' + fl + ')"/>' +
      '<path d="M356 260 q8 10 0 22 q-8 -12 0 -22 z" fill="#ffd682"/><circle cx="356" cy="278" r="3.8" fill="#fff6d2"/>' +
      '<circle cx="356" cy="276" r="120" fill="#ffbe64" opacity=".08" filter="url(#' + bl + ')"/>' +
      '<rect y="440" width="960" height="100" fill="#080d19"/>' +
      motes(30, 701, "#cfe2ff", 480, 120, 420, 340, 2.2, 0.5)
    );
  };

  /* ══════ 남쪽 바다 — 수평선, 윤슬, 역광 범선 ══════ */
  S.sea = function () {
    var sk = nid("sk"), sn = nid("sn"), wt = nid("wt"), bl = nid("bl"), hz = nid("hz");
    var SKY = "#a9d6e6";
    return svg(
      lg(sk, 0, 0, 0, 1, [[0, "#2f86b8"], [0.26, "#63b0d2"], [0.52, "#a9d6e6"], [0.78, "#dcf0f2"], [1, "#f6f2dc"]]) +
      rg(sn, "50%", "50%", "50%", [[0, "#fffdf0", 0.95], [0.28, "#fff4c8", 0.45], [1, "#ffeeb0", 0]]) +
      lg(wt, 0, 0, 0, 1, [[0, "#7fc4d8"], [0.22, "#4d9cbe"], [0.6, "#2f7ba2"], [1, "#1d5b80"]]) +
      lg(hz, 0, 0, 0, 1, [[0, "#e2f2f4", 0.9], [1, "#e2f2f4", 0]]) +
      blur(bl, 24),
      '<rect width="960" height="540" fill="url(#' + sk + ')"/>' +
      cirrus(56, "#ffffff", 0.55, 8, 65) +
      orb(214, 118, 34, "#fffef2", sn) +
      rays(214, 118, [[42, 2.6, 460, 0.14], [64, 1.6, 420, 0.11], [86, 2.2, 440, 0.12]], "#fff8dc", bl) +
      cloud(560, 108, 1.3, "#c8e0ea", "#ffffff", 0.95) +
      cloud(830, 160, 1.05, "#bcd8e6", "#ffffff", 0.85) +
      cloud(360, 178, 0.85, "#cee4ee", "#ffffff", 0.6) +
      birds([[420, 150, 1], [472, 126, 0.8], [508, 164, 0.6], [700, 200, 0.5]], "rgba(255,255,255,.9)") +
      // 먼 곶 (대기 원근)
      '<path d="M0 292 Q80 276 170 288 L200 300 H0 Z" fill="' + aerial("#5a7f6a", SKY, 0.66) + '"/>' +
      // 바다
      '<rect y="300" width="960" height="240" fill="url(#' + wt + ')"/>' +
      '<rect y="292" width="960" height="60" fill="url(#' + hz + ')" opacity=".7"/>' +
      '<path d="M0 300 H960" stroke="rgba(255,255,255,.35)" stroke-width="2.4"/>' +
      // 윤슬 (해 아래 반짝임 — 아래로 갈수록 넓고 성기게)
      '<g fill="#fff5cc">' +
      [].concat.apply([], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (r) {
        return [0, 1, 2, 3, 4].map(function (c) {
          var i = r * 5 + c;
          var spread = 30 + r * 22;
          var x = 214 + (rnd(i) - 0.5) * spread * 2;
          var y = 306 + r * 19 + rnd(i + 40) * 8;
          var w = (10 + rnd(i + 80) * 26) * (1 + r * 0.12);
          return '<rect x="' + (x - w / 2).toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + (2.4 + rnd(i + 120) * 2.2).toFixed(1) + '" rx="1.6" opacity="' + (0.35 + rnd(i + 160) * 0.55).toFixed(2) + '"/>';
        });
      })).join("") + "</g>" +
      // 파도 결
      '<g stroke="rgba(230,248,252,.4)" stroke-width="3" fill="none" stroke-linecap="round">' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        var y = 330 + i * 22, x = rnd(i + 200) * 800;
        return '<path d="M' + x.toFixed(0) + " " + y + " q" + (20 + i * 3) + " -6 " + (40 + i * 6) + ' 0"/>' +
          '<path d="M' + ((x + 260) % 900).toFixed(0) + " " + (y + 8) + " q" + (18 + i * 3) + " -6 " + (36 + i * 6) + ' 0"/>';
      }).join("") + "</g>" +
      // 범선 (역광)
      '<g><path d="M596 300 L788 300 L772 268 L610 268 Z" fill="#3d3428"/>' +
      '<rect x="668" y="112" width="9" height="162" fill="#2f2820"/><rect x="726" y="150" width="7" height="124" fill="#2f2820"/>' +
      '<path d="M672 120 L672 258 L594 248 Z" fill="#f4ecd8"/><path d="M674 132 L674 254 L722 246 Z" fill="#e6dcc2"/>' +
      '<path d="M730 158 L730 258 L688 252 Z" fill="#eee6d0"/>' +
      '<path d="M668 112 L706 122 L668 132 Z" fill="#b8434a"/></g>' +
      '<path d="M596 300 q96 22 192 0" stroke="rgba(255,255,255,.4)" stroke-width="4" fill="none"/>' +
      // 전경 모래톱·잔물결
      '<path d="M0 500 Q240 476 480 496 Q720 514 960 492 V540 H0 Z" fill="#d8c9a2"/>' +
      '<path d="M0 500 Q240 476 480 496 Q720 514 960 492" stroke="rgba(255,255,255,.55)" stroke-width="5" fill="none"/>' +
      '<g stroke="rgba(255,255,255,.5)" stroke-width="3" fill="none">' +
      '<path d="M120 516 q40 -8 80 0 M420 524 q36 -8 72 0 M700 512 q40 -8 80 0"/></g>' +
      motes(20, 801, "#ffffff", 0, 200, 960, 240, 2.4, 0.45)
    );
  };

  /* ══════ 도박장 '검은 부두' — 초록 융, 매달린 등의 좁은 광원 ══════ */
  S.tavern = function () {
    var wl = nid("wl"), tb = nid("tb"), bl = nid("bl"), lt = nid("lt"), lp = nid("lp");
    return svg(
      lg(wl, 0, 0, 0, 1, [[0, "#1a1009"], [0.4, "#33200f"], [0.72, "#42291a"], [1, "#150d07"]]) +
      rg(tb, "50%", "40%", "62%", [[0, "#3f7c54"], [0.55, "#2a5c3c"], [1, "#193c28"]]) +
      rg(lt, "50%", "50%", "50%", [[0, "#fff0c4", 0.95], [0.35, "#ffc46a", 0.4], [1, "#ff9c33", 0]]) +
      rg(lp, "50%", "20%", "80%", [[0, "#ffcd7a", 0.3], [0.6, "#e88a34", 0.1], [1, "#c05a18", 0]]) +
      blur(bl, 20),
      '<rect width="960" height="540" fill="url(#' + wl + ')"/>' +
      // 벽 판자
      '<g stroke="rgba(12,7,3,.4)" stroke-width="5">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<path d="M' + (i * 124 + 40) + ' 0 V300"/>'; }).join("") + "</g>" +
      // 술병 선반 2단
      '<rect x="60" y="86" width="380" height="13" fill="#160d06"/><rect x="60" y="84" width="380" height="4" fill="#3a2716"/>' +
      '<g>' +
      [[96, "#3c5a3c"], [148, "#5a3c2c"], [200, "#3c4c5a"], [252, "#5a4a2c"], [304, "#4c3c5a"], [360, "#4a5a3c"]].map(function (b, i) {
        var h = 44 + rnd(i) * 22;
        return '<rect x="' + b[0] + '" y="' + (86 - h) + '" width="24" height="' + h + '" rx="6" fill="' + b[1] + '"/>' +
          '<rect x="' + (b[0] + 4) + '" y="' + (86 - h + 6) + '" width="6" height="' + (h - 14) + '" rx="3" fill="rgba(255,220,150,.22)"/>' +
          '<rect x="' + (b[0] + 8) + '" y="' + (86 - h - 12) + '" width="8" height="14" rx="3" fill="' + b[1] + '"/>';
      }).join("") + "</g>" +
      '<rect x="60" y="196" width="380" height="13" fill="#160d06"/><rect x="60" y="194" width="380" height="4" fill="#3a2716"/>' +
      '<g>' +
      [[104, "#5a3c2c"], [166, "#3c5a44"], [232, "#5a2c2c"], [298, "#2c3c5a"], [358, "#4a3a5a"]].map(function (b, i) {
        var h = 42 + rnd(i + 30) * 24;
        return '<rect x="' + b[0] + '" y="' + (196 - h) + '" width="26" height="' + h + '" rx="6" fill="' + b[1] + '"/>' +
          '<rect x="' + (b[0] + 5) + '" y="' + (196 - h + 6) + '" width="6" height="' + (h - 14) + '" rx="3" fill="rgba(255,220,150,.2)"/>';
      }).join("") + "</g>" +
      // 매달린 등
      '<path d="M660 0 V72" stroke="#120a04" stroke-width="7"/>' +
      '<path d="M614 74 h92 l-16 34 h-60 Z" fill="#2a1e12"/>' +
      '<path d="M614 74 h92 l-4 8 h-84 Z" fill="#3b2b1a"/>' +
      '<ellipse cx="660" cy="120" rx="26" ry="34" fill="url(#' + lt + ')"/>' +
      '<path d="M660 104 q9 12 0 24 q-9 -14 0 -24 z" fill="#ffd682"/><circle cx="660" cy="124" r="4.4" fill="#fff8dc"/>' +
      '<path d="M596 108 L724 108 L900 470 L420 470 Z" fill="url(#' + lp + ')" filter="url(#' + bl + ')" opacity=".55"/>' +
      // 초록 융 테이블
      '<ellipse cx="660" cy="418" rx="384" ry="132" fill="#152e1e"/>' +
      '<ellipse cx="660" cy="406" rx="368" ry="120" fill="url(#' + tb + ')"/>' +
      '<ellipse cx="660" cy="406" rx="368" ry="120" fill="none" stroke="#5c3c22" stroke-width="10"/>' +
      '<ellipse cx="660" cy="392" rx="300" ry="88" fill="#ffd88a" opacity=".07"/>' +
      // 카드
      '<g transform="rotate(-9 566 404)"><rect x="538" y="376" width="54" height="76" rx="6" fill="#f4f0e2"/>' +
      '<rect x="538" y="376" width="54" height="76" rx="6" fill="none" stroke="#cfc8b2" stroke-width="2"/>' +
      '<path d="M554 396 l22 30 M576 396 l-22 30" stroke="#b03040" stroke-width="5"/></g>' +
      '<g transform="rotate(12 700 420)"><rect x="672" y="392" width="54" height="76" rx="6" fill="#f4f0e2"/>' +
      '<circle cx="699" cy="430" r="15" fill="none" stroke="#2c2c34" stroke-width="5"/></g>' +
      '<g transform="rotate(-3 800 386)"><rect x="774" y="360" width="52" height="74" rx="6" fill="#e8e2d2"/>' +
      '<path d="M800 376 l12 20 l-12 20 l-12 -20 Z" fill="#b03040"/></g>' +
      // 칩·금화
      '<g><circle cx="880" cy="428" r="19" fill="#d8b048"/><circle cx="880" cy="422" r="19" fill="#e8c058"/><circle cx="880" cy="416" r="19" fill="#f0cc70"/>' +
      '<circle cx="880" cy="416" r="11" fill="#d4a83c"/></g>' +
      '<g><circle cx="482" cy="440" r="20" fill="#6e2028"/><circle cx="482" cy="432" r="20" fill="#8a2c34"/>' +
      '<circle cx="482" cy="432" r="12" fill="none" stroke="#e8d0b0" stroke-width="3"/></g>' +
      // 술잔
      '<g><path d="M300 400 h44 l-6 40 h-32 Z" fill="rgba(190,150,90,.5)"/>' +
      '<path d="M304 412 h36 l-4 26 h-28 Z" fill="#b5722c"/>' +
      '<ellipse cx="322" cy="400" rx="22" ry="7" fill="rgba(255,220,160,.4)"/></g>' +
      // 담배 연기
      '<g stroke="rgba(226,226,226,.13)" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#' + bl + ')">' +
      '<path d="M250 380 q22 -46 0 -84 q-18 -32 8 -62 M846 344 q-18 -40 2 -72"/></g>' +
      motes(34, 901, "#ffd9a0", 460, 120, 420, 300, 2.4, 0.6)
    );
  };

  SC.svg = function (bg) {
    var b = S[bg];
    return b ? b() : "";
  };
})();
