// scenes.js — 장소·시간대별 SVG 배경 장면 13종 (480×270, slice 커버)
// 초상(portraits.js)과 같은 벡터 화풍. 외부 이미지 없이 오프라인 단일 파일 유지.
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var SC = (NS.Scenes = {});

  function wrap(id, inner) {
    return (
      '<svg viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      inner + "</svg>"
    );
  }
  function sky(id, c1, c2, c3) {
    return (
      '<defs><linearGradient id="sky-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + c1 + '"/>' +
      (c3 ? '<stop offset=".55" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c3 + '"/>' :
        '<stop offset="1" stop-color="' + c2 + '"/>') +
      "</linearGradient></defs>" +
      '<rect width="480" height="270" fill="url(#sky-' + id + ')"/>'
    );
  }
  // 갈매기/까마귀 무리
  function birds(col, pts) {
    return pts.map(function (p) {
      return '<path d="M' + p[0] + " " + p[1] + " q4 -4 8 0 q4 -4 8 0\" stroke=\"" + col + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    }).join("");
  }
  // 촛불 불꽃
  function flame(x, y, s) {
    s = s || 1;
    return (
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 7 * s + '" ry="' + 10 * s + '" fill="rgba(255,190,80,.35)"/>' +
      '<path d="M' + x + " " + (y - 6 * s) + " q" + 3.4 * s + " " + 4 * s + " 0 " + 9 * s + " q-" + 3.4 * s + " -" + 5 * s + " 0 -" + 9 * s + ' z" fill="#ffcf6a"/>' +
      '<circle cx="' + x + '" cy="' + (y + 1.5 * s) + '" r="' + 1.7 * s + '" fill="#fff2c0"/>'
    );
  }

  var S = {};

  /* 리버풀 부두 — 잿빛 저녁, 정박한 범선과 짐짝 */
  S.liverpool = function () {
    return wrap("lv",
      sky("lv", "#5f6c7c", "#93a0ac", "#7a8894") +
      '<circle cx="368" cy="52" r="17" fill="rgba(232,238,244,.35)"/>' +
      '<rect y="150" width="480" height="46" fill="#46545e"/>' +
      '<path d="M0 156 H480 M0 168 H480 M0 181 H480" stroke="rgba(220,230,240,.08)" stroke-width="3"/>' +
      // 범선 두 척 (실루엣)
      '<g fill="#272d36">' +
      '<path d="M64 156 L180 156 L170 138 L76 138 Z"/>' +
      '<rect x="100" y="52" width="5" height="88"/><rect x="140" y="66" width="4" height="74"/>' +
      '<path d="M103 56 L103 120 L66 116 Z" fill="#3a4450"/><path d="M104 62 L104 118 L138 114 Z" fill="#333c48"/>' +
      '<path d="M300 158 L376 158 L370 146 L306 146 Z"/><rect x="334" y="88" width="4" height="60"/>' +
      '<path d="M336 92 L336 140 L312 137 Z" fill="#3a4450"/>' +
      "</g>" +
      birds("rgba(230,238,246,.6)", [[214, 74], [242, 62], [262, 80]]) +
      // 부두 판자
      '<rect y="196" width="480" height="74" fill="#4e4232"/>' +
      '<path d="M0 196 H480" stroke="#372e22" stroke-width="4"/>' +
      '<path d="M60 200 V270 M150 200 V270 M240 200 V270 M330 200 V270 M420 200 V270" stroke="rgba(30,24,16,.4)" stroke-width="3"/>' +
      '<path d="M0 222 H480 M0 248 H480" stroke="rgba(30,24,16,.28)" stroke-width="2"/>' +
      // 짐짝·밧줄·가로등
      '<g><rect x="368" y="160" width="42" height="36" fill="#6a5638"/><rect x="380" y="128" width="38" height="32" fill="#7a6444"/>' +
      '<path d="M368 178 H410 M389 160 V196 M380 144 H418 M399 128 V160" stroke="#463822" stroke-width="2.6"/></g>' +
      '<ellipse cx="326" cy="200" rx="16" ry="7" fill="#3c3226"/>' +
      '<rect x="52" y="120" width="6" height="80" fill="#2c2820"/><circle cx="55" cy="116" r="9" fill="#3a362c"/>' +
      '<circle cx="55" cy="116" r="5.5" fill="#ffd98a"/><circle cx="55" cy="116" r="14" fill="rgba(255,214,130,.18)"/>'
    );
  };

  /* 언덕 저택 거실 — 벽난로와 촛불 */
  S.hall = function () {
    return wrap("hl",
      sky("hl", "#4c3a28", "#63482e", "#332413") +
      '<rect width="480" height="26" fill="#2e2113"/><path d="M0 26 H480" stroke="#1e1408" stroke-width="4"/>' +
      '<path d="M120 0 V26 M360 0 V26" stroke="#1e1408" stroke-width="8"/>' +
      // 벽 패널
      '<path d="M40 60 h84 v96 h-84 z M356 60 h84 v96 h-84 z" fill="none" stroke="rgba(20,12,4,.35)" stroke-width="4"/>' +
      // 창(잿빛 하늘)
      '<rect x="368" y="66" width="60" height="84" fill="#8d99a6"/><path d="M398 66 V150 M368 108 H428" stroke="#2c2013" stroke-width="5"/>' +
      '<rect x="364" y="62" width="68" height="92" fill="none" stroke="#241808" stroke-width="6"/>' +
      // 벽난로
      '<rect x="150" y="80" width="140" height="112" fill="#5e5142"/>' +
      '<path d="M150 80 h140 v14 h-140 z" fill="#6e6150"/>' +
      '<path d="M170 108 h100 v84 h-100 z" fill="#241408"/>' +
      '<path d="M180 192 q10 -34 30 -18 q6 -26 22 -8 q14 -16 18 8 q12 -10 10 18 z" fill="#e8722c"/>' +
      '<path d="M192 192 q8 -22 20 -10 q6 -16 16 -2 q10 -10 12 12 z" fill="#ffb03c"/>' +
      '<ellipse cx="220" cy="176" rx="66" ry="40" fill="rgba(255,150,60,.14)"/>' +
      '<rect x="146" y="188" width="148" height="10" fill="#3a2c1a"/>' +
      // 촛대·초상화
      '<rect x="66" y="96" width="34" height="44" fill="#514434"/><rect x="66" y="96" width="34" height="44" fill="none" stroke="#8a744e" stroke-width="4"/>' +
      '<ellipse cx="83" cy="116" rx="9" ry="12" fill="#8f7a58"/>' +
      '<rect x="317" y="120" width="5" height="26" fill="#8a744e"/>' + flame(319.5, 112, 0.8) +
      // 바닥·양탄자
      '<rect y="196" width="480" height="74" fill="#3c2c18"/>' +
      '<path d="M0 210 H480 M0 232 H480 M0 254 H480" stroke="rgba(16,10,4,.35)" stroke-width="2.6"/>' +
      '<path d="M92 270 L150 214 H330 L388 270 Z" fill="#5e2f26"/>' +
      '<path d="M120 270 L166 224 H314 L360 270 Z" fill="none" stroke="#8a5038" stroke-width="3"/>'
    );
  };

  /* 부엌 — 화덕과 선반, 비 오는 창 */
  S.kitchen = function () {
    return wrap("kt",
      sky("kt", "#3c2e1e", "#55432c", "#241a0e") +
      // 선반과 그릇
      '<rect x="270" y="44" width="170" height="7" fill="#241808"/><rect x="270" y="92" width="170" height="7" fill="#241808"/>' +
      '<circle cx="296" cy="32" r="12" fill="#c8b998"/><circle cx="330" cy="32" r="12" fill="#b8a988"/><circle cx="366" cy="30" r="14" fill="#c8b998"/><circle cx="404" cy="32" r="12" fill="#b0a184"/>' +
      '<rect x="288" y="66" width="16" height="26" fill="#8a7248"/><rect x="318" y="62" width="20" height="30" fill="#9a8258"/><rect x="352" y="66" width="16" height="26" fill="#8a7248"/><ellipse cx="404" cy="80" rx="14" ry="12" fill="#7c6844"/>' +
      // 걸린 팬·허브
      '<path d="M40 30 q14 22 0 44 M70 26 q-12 24 0 48" stroke="#1c1206" stroke-width="5" fill="none"/>' +
      '<circle cx="40" cy="80" r="13" fill="#4c4034"/><circle cx="70" cy="82" r="11" fill="#443828"/>' +
      '<path d="M104 28 q4 18 -2 30 M112 28 q2 16 6 28" stroke="#5a6a34" stroke-width="4" fill="none"/>' +
      // 창(비 오는 저녁)
      '<rect x="196" y="52" width="56" height="72" fill="#5d6b7a"/><path d="M224 52 V124 M196 88 H252" stroke="#241808" stroke-width="5"/>' +
      '<rect x="192" y="48" width="64" height="80" fill="none" stroke="#1c1206" stroke-width="6"/>' +
      // 화덕
      '<rect x="24" y="120" width="120" height="76" fill="#4e4234"/><path d="M36 132 h96 v64 h-96 z" fill="#20130a"/>' +
      '<path d="M48 196 q10 -24 24 -12 q8 -18 20 -2 q10 -10 14 14 z" fill="#e8722c"/>' +
      '<ellipse cx="84" cy="182" rx="46" ry="26" fill="rgba(255,150,60,.13)"/>' +
      '<ellipse cx="84" cy="140" rx="26" ry="10" fill="#33281c"/><path d="M62 140 q22 -32 44 0" stroke="#151008" stroke-width="5" fill="none"/>' +
      // 테이블
      '<rect y="196" width="480" height="74" fill="#38291a"/>' +
      '<rect x="280" y="170" width="176" height="14" fill="#6a5334"/><rect x="292" y="184" width="12" height="86" fill="#54401e"/><rect x="432" y="184" width="12" height="86" fill="#54401e"/>' +
      '<ellipse cx="330" cy="164" rx="20" ry="8" fill="#c8a868"/><ellipse cx="330" cy="158" rx="14" ry="7" fill="#daba7a"/>' +
      '<rect x="386" y="140" width="5" height="26" fill="#8a744e"/>' + flame(388.5, 132, 0.8)
    );
  };

  /* 헛간 — 건초와 랜턴, 판자 틈 달빛 */
  S.barn = function () {
    return wrap("bn",
      sky("bn", "#241c10", "#332815", "#1a1208") +
      // 판자벽 + 틈새 빛
      '<path d="M40 0 V270 M96 0 V270 M152 0 V270 M208 0 V270 M264 0 V270 M320 0 V270 M376 0 V270 M432 0 V270" stroke="#170f06" stroke-width="7"/>' +
      '<path d="M68 0 V270 M292 0 V270 M404 0 V270" stroke="rgba(190,205,230,.10)" stroke-width="3"/>' +
      // 서까래
      '<path d="M0 44 L240 8 L480 44" stroke="#0f0a04" stroke-width="10" fill="none"/>' +
      '<path d="M0 88 H480" stroke="#0f0a04" stroke-width="7"/>' +
      // 건초 더미
      '<ellipse cx="96" cy="240" rx="120" ry="52" fill="#8a7034"/>' +
      '<ellipse cx="70" cy="216" rx="66" ry="34" fill="#9e8340"/>' +
      '<path d="M28 204 l-14 -14 M60 196 l-8 -18 M104 198 l10 -16 M140 214 l16 -12" stroke="#b89a50" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="420" cy="252" rx="76" ry="34" fill="#7c6530"/>' +
      // 랜턴
      '<path d="M330 88 V126" stroke="#0f0a04" stroke-width="4"/>' +
      '<rect x="318" y="126" width="24" height="32" rx="4" fill="#3a3020"/><rect x="323" y="131" width="14" height="22" fill="#ffd98a"/>' +
      flame(330, 138, 0.9) +
      '<circle cx="330" cy="142" r="40" fill="rgba(255,205,110,.13)"/>' +
      // 밀짚 바닥
      '<rect y="246" width="480" height="24" fill="#2c2110"/>' +
      '<path d="M180 258 l20 -6 M220 262 l24 -4 M300 256 l20 -8" stroke="#6a5628" stroke-width="3" stroke-linecap="round"/>'
    );
  };

  /* 폭풍의 언덕 저택 외경 — 바람에 굽은 나무와 돌집 */
  S.heights_ext = function () {
    return wrap("he",
      sky("he", "#4e5a68", "#7e8b96", "#5a6a5c") +
      '<ellipse cx="130" cy="52" rx="90" ry="20" fill="rgba(40,48,58,.35)"/>' +
      '<ellipse cx="350" cy="34" rx="110" ry="18" fill="rgba(40,48,58,.28)"/>' +
      // 먼 황야 능선
      '<path d="M0 168 Q120 138 260 160 Q380 176 480 152 V270 H0 Z" fill="#4c5c42"/>' +
      // 돌집 (박공지붕 + 굴뚝)
      '<g><path d="M150 96 L235 62 L320 96 V172 H150 Z" fill="#5c5a54"/>' +
      '<path d="M150 96 L235 62 L320 96 L320 104 L235 72 L150 104 Z" fill="#3a3834"/>' +
      '<rect x="166" y="52" width="14" height="34" fill="#4a4842"/><rect x="292" y="48" width="14" height="38" fill="#4a4842"/>' +
      '<path d="M160 108 h30 M200 122 h26 M260 112 h34 M172 140 h24 M244 142 h30" stroke="rgba(30,28,24,.5)" stroke-width="3"/>' +
      '<rect x="178" y="118" width="22" height="30" fill="#2c2820"/><rect x="264" y="118" width="22" height="30" fill="#8b8452"/>' +
      '<path d="M275 118 V148 M264 133 H286" stroke="#241f16" stroke-width="3"/>' +
      '<rect x="222" y="128" width="26" height="44" fill="#241f18"/><path d="M222 128 h26" stroke="#181410" stroke-width="5"/></g>' +
      // 바람에 굽은 나무들 (원작의 기운 전나무)
      '<g stroke="#2a3226" fill="#2a3226">' +
      '<path d="M84 172 q-2 -34 8 -52 q2 22 8 30" stroke-width="7" fill="none"/>' +
      '<path d="M92 120 q26 -8 44 4 q-20 2 -30 10 q18 0 26 8 q-18 2 -28 8" stroke-width="0"/>' +
      '<path d="M398 168 q0 -28 10 -44 q2 18 6 24" stroke-width="6" fill="none"/>' +
      '<path d="M408 124 q22 -6 36 4 q-16 2 -24 8 q14 0 20 8 q-16 0 -24 6" stroke-width="0"/>' +
      "</g>" +
      birds("rgba(30,34,30,.7)", [[368, 66], [392, 56]]) +
      // 돌담과 히스 언덕
      '<path d="M0 208 Q140 188 300 204 Q400 214 480 202 V270 H0 Z" fill="#3c4a34"/>' +
      '<path d="M18 216 h34 v12 h-34 z M64 212 h30 v16 h-30 z M106 218 h34 v10 h-34 z" fill="#55534c" stroke="#333029" stroke-width="2.6"/>' +
      '<circle cx="330" cy="238" r="5" fill="#7c5a90"/><circle cx="352" cy="230" r="4" fill="#8a68a0"/><circle cx="372" cy="242" r="5" fill="#7c5a90"/><circle cx="420" cy="234" r="4" fill="#8a68a0"/>'
    );
  };

  /* 황야 낮 — 히스 벌판과 돌담 */
  S.moor = function () {
    return wrap("mr",
      sky("mr", "#7ea6c8", "#b8d2e2", "#d8e6ea") +
      '<circle cx="392" cy="52" r="22" fill="#fff2c8"/><circle cx="392" cy="52" r="34" fill="rgba(255,242,200,.25)"/>' +
      '<ellipse cx="120" cy="60" rx="66" ry="16" fill="rgba(255,255,255,.75)"/>' +
      '<ellipse cx="170" cy="48" rx="46" ry="12" fill="rgba(255,255,255,.6)"/>' +
      '<ellipse cx="300" cy="86" rx="56" ry="12" fill="rgba(255,255,255,.5)"/>' +
      // 능선 3겹
      '<path d="M0 150 Q110 118 240 142 Q370 164 480 134 V270 H0 Z" fill="#87a068"/>' +
      '<path d="M0 186 Q140 158 300 180 Q400 194 480 180 V270 H0 Z" fill="#6d8a52"/>' +
      // 히스 꽃밭
      '<path d="M0 222 Q160 200 330 220 Q420 230 480 222 V270 H0 Z" fill="#5c7444"/>' +
      '<g fill="#9a72b4"><circle cx="46" cy="238" r="7"/><circle cx="70" cy="248" r="5"/><circle cx="96" cy="236" r="6"/><circle cx="130" cy="250" r="7"/><circle cx="170" cy="240" r="5"/><circle cx="210" cy="252" r="6"/><circle cx="258" cy="242" r="7"/><circle cx="304" cy="252" r="5"/><circle cx="348" cy="240" r="6"/><circle cx="396" cy="250" r="7"/><circle cx="440" cy="238" r="5"/></g>' +
      '<g fill="#b48ecc"><circle cx="58" cy="230" r="4"/><circle cx="112" cy="244" r="4"/><circle cx="188" cy="246" r="4"/><circle cx="278" cy="248" r="4"/><circle cx="368" cy="246" r="4"/><circle cx="424" cy="246" r="4"/></g>' +
      // 돌담
      '<path d="M300 196 h40 v10 h-40 z M346 192 h34 v14 h-34 z M386 196 h38 v10 h-38 z M430 192 h34 v14 h-34 z" fill="#8a8878" stroke="#5c5a4c" stroke-width="2.4"/>' +
      birds("rgba(255,255,255,.85)", [[220, 70], [248, 58]])
    );
  };

  /* 황야 밤 — 달과 언덕 실루엣 */
  S.moor_night = function () {
    return wrap("mn",
      sky("mn", "#0a1226", "#20304e", "#141c30") +
      '<circle cx="360" cy="62" r="26" fill="#e8eef8"/><circle cx="352" cy="56" r="7" fill="#c8d2e2"/><circle cx="368" cy="70" r="5" fill="#cfd8e6"/>' +
      '<circle cx="360" cy="62" r="42" fill="rgba(220,232,250,.10)"/>' +
      '<ellipse cx="120" cy="80" rx="70" ry="12" fill="rgba(10,16,30,.6)"/>' +
      // 능선 실루엣
      '<path d="M0 158 Q120 124 260 150 Q380 170 480 144 V270 H0 Z" fill="#1c2838"/>' +
      '<path d="M0 200 Q150 172 320 196 Q420 208 480 198 V270 H0 Z" fill="#131c2a"/>' +
      // 어둠 속 히스
      '<path d="M0 234 Q180 214 360 232 Q430 238 480 232 V270 H0 Z" fill="#0c141e"/>' +
      '<g fill="rgba(140,120,180,.4)"><circle cx="60" cy="248" r="5"/><circle cx="130" cy="256" r="4"/><circle cx="220" cy="248" r="5"/><circle cx="330" cy="256" r="4"/><circle cx="420" cy="248" r="5"/></g>' +
      // 굽은 나무 실루엣
      '<path d="M430 232 q-2 -26 8 -40 q2 16 6 22" stroke="#0a1018" stroke-width="6" fill="none"/>' +
      '<path d="M438 192 q20 -6 32 4 q-14 2 -20 7 q12 0 17 7 q-14 0 -21 5" fill="#0a1018"/>'
    );
  };

  /* 황야 노을 — 큰 해와 역광 능선 */
  S.moor_sunset = function () {
    return wrap("ms",
      sky("ms", "#5c3a6e", "#c86a4a", "#e8a05a") +
      '<circle cx="240" cy="150" r="40" fill="#ffd27a"/><circle cx="240" cy="150" r="62" fill="rgba(255,210,122,.28)"/>' +
      '<ellipse cx="120" cy="72" rx="80" ry="10" fill="rgba(90,50,90,.4)"/>' +
      '<ellipse cx="360" cy="52" rx="70" ry="9" fill="rgba(90,50,90,.32)"/>' +
      // 역광 능선
      '<path d="M0 172 Q130 148 280 168 Q390 182 480 162 V270 H0 Z" fill="#4a3050"/>' +
      '<path d="M0 208 Q160 186 340 206 Q430 216 480 208 V270 H0 Z" fill="#332040"/>' +
      '<path d="M0 240 Q200 224 480 240 V270 H0 Z" fill="#241630"/>' +
      // 실루엣 풀·히스
      '<g stroke="#180e20" stroke-width="2.6" stroke-linecap="round" fill="none">' +
      '<path d="M60 258 q-2 -14 -8 -20 M66 258 q0 -16 4 -22 M74 258 q4 -12 10 -16"/>' +
      '<path d="M300 262 q-2 -12 -7 -18 M308 262 q1 -15 5 -20 M316 262 q4 -10 9 -14"/>' +
      "</g>" +
      birds("rgba(30,16,40,.8)", [[150, 96], [178, 84], [330, 100]])
    );
  };

  /* 페니스톤 바위 — 황혼의 바위 꼭대기 */
  S.penistone = function () {
    return wrap("pn",
      sky("pn", "#2c3450", "#5a6490", "#8a7898") +
      '<circle cx="120" cy="60" r="3" fill="#e8eef8"/><circle cx="200" cy="40" r="2" fill="#d8e0f0"/><circle cx="330" cy="52" r="2.5" fill="#e8eef8"/><circle cx="420" cy="76" r="2" fill="#d8e0f0"/>' +
      '<ellipse cx="300" cy="96" rx="90" ry="12" fill="rgba(40,40,70,.35)"/>' +
      // 아래로 펼쳐진 황야 (높은 시점)
      '<path d="M0 190 Q140 172 300 188 Q400 196 480 186 V270 H0 Z" fill="#3a3a54"/>' +
      '<path d="M0 220 Q200 204 480 222 V270 H0 Z" fill="#2c2c42"/>' +
      // 페니스톤 크래그 (겹쳐 쌓인 바위)
      '<g><path d="M20 270 L36 176 L96 150 L150 176 L166 270 Z" fill="#565068"/>' +
      '<path d="M36 176 L96 150 L150 176 L140 186 L94 162 L48 188 Z" fill="#6e6884"/>' +
      '<path d="M60 210 l40 -8 M52 240 l52 -8" stroke="rgba(20,18,32,.5)" stroke-width="3"/>' +
      '<path d="M330 270 L344 190 L404 168 L456 192 L470 270 Z" fill="#4c4660"/>' +
      '<path d="M344 190 L404 168 L456 192 L446 200 L402 180 L356 200 Z" fill="#645e7a"/>' +
      '<path d="M368 224 l44 -8 M360 248 l56 -8" stroke="rgba(20,18,32,.5)" stroke-width="3"/></g>' +
      // 바람 자국
      '<path d="M190 128 q30 -8 60 0 M210 144 q26 -6 50 0" stroke="rgba(220,220,245,.18)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<circle cx="240" cy="238" r="5" fill="rgba(150,120,180,.5)"/><circle cx="270" cy="248" r="4" fill="rgba(150,120,180,.4)"/>'
    );
  };

  /* 스러시크로스 그레인지 — 샹들리에 응접실 */
  S.grange = function () {
    return wrap("gr",
      sky("gr", "#a08c62", "#c4b088", "#7c6a48") +
      // 벽지 줄무늬 + 웨인스코트
      '<path d="M30 0 V150 M90 0 V150 M150 0 V150 M210 0 V150 M270 0 V150 M330 0 V150 M390 0 V150 M450 0 V150" stroke="rgba(120,100,64,.25)" stroke-width="10"/>' +
      '<rect y="150" width="480" height="26" fill="#6a583c"/><path d="M0 150 H480" stroke="#4c3e28" stroke-width="4"/>' +
      // 샹들리에
      '<path d="M240 0 V26" stroke="#5a4a2e" stroke-width="4"/>' +
      '<path d="M186 44 Q240 74 294 44" stroke="#8a7648" stroke-width="5" fill="none"/>' +
      '<path d="M204 52 V38 M240 60 V44 M276 52 V38" stroke="#8a7648" stroke-width="4"/>' +
      flame(204, 32, 0.7) + flame(240, 38, 0.7) + flame(276, 32, 0.7) +
      '<circle cx="240" cy="46" r="52" fill="rgba(255,214,130,.10)"/>' +
      // 큰 창 + 정원 + 커튼
      '<rect x="330" y="44" width="96" height="118" fill="#9ec49a"/>' +
      '<path d="M330 108 Q378 88 426 108 V162 H330 Z" fill="#6a9464"/>' +
      '<circle cx="352" cy="72" r="12" fill="#fff8dc"/>' +
      '<path d="M378 44 V162 M330 92 H426 M330 130 H426" stroke="#3c3220" stroke-width="5"/>' +
      '<rect x="324" y="38" width="108" height="130" fill="none" stroke="#4c3e26" stroke-width="7"/>' +
      '<path d="M318 36 q14 66 -2 132 L302 168 q12 -66 2 -132 Z" fill="#8a3c40"/>' +
      '<path d="M438 36 q-14 66 2 132 L454 168 q-12 -66 -2 -132 Z" fill="#8a3c40"/>' +
      // 액자 두 점
      '<rect x="64" y="56" width="44" height="56" fill="#5c4c34" stroke="#9a8050" stroke-width="4"/><ellipse cx="86" cy="84" rx="12" ry="16" fill="#8a7454"/>' +
      '<rect x="150" y="62" width="36" height="44" fill="#5c4c34" stroke="#9a8050" stroke-width="4"/><ellipse cx="168" cy="84" rx="9" ry="12" fill="#8a7454"/>' +
      // 소파와 바닥
      '<rect y="176" width="480" height="94" fill="#7a5c38"/>' +
      '<path d="M0 190 H480 M0 214 H480 M0 240 H480" stroke="rgba(50,36,18,.3)" stroke-width="2.6"/>' +
      '<g><rect x="48" y="152" width="150" height="46" rx="16" fill="#b08848"/>' +
      '<rect x="60" y="132" width="126" height="34" rx="14" fill="#c09a58"/>' +
      '<rect x="42" y="168" width="18" height="42" rx="7" fill="#96703a"/><rect x="186" y="168" width="18" height="42" rx="7" fill="#96703a"/></g>'
    );
  };

  /* 밤 침실 — 달빛 창가와 촛불 */
  S.night = function () {
    return wrap("nt",
      sky("nt", "#0c1020", "#181f38", "#0e1322") +
      // 달빛 창
      '<rect x="286" y="36" width="110" height="140" fill="#31456e"/>' +
      '<circle cx="322" cy="72" r="20" fill="#dfe8f6"/><circle cx="316" cy="67" r="5" fill="#bcc8dc"/>' +
      '<path d="M341 36 V176 M286 106 H396" stroke="#0a0e1a" stroke-width="6"/>' +
      '<rect x="280" y="30" width="122" height="152" fill="none" stroke="#080c16" stroke-width="7"/>' +
      // 달빛 줄기
      '<path d="M286 176 L246 270 H436 L396 176 Z" fill="rgba(190,210,240,.08)"/>' +
      // 커튼
      '<path d="M276 26 q12 76 -4 156 L252 182 q14 -78 4 -156 Z" fill="#232a44"/>' +
      // 침대 기둥·이불 (한 귀퉁이)
      '<rect x="20" y="60" width="9" height="150" fill="#231a10"/><circle cx="24.5" cy="56" r="7" fill="#32261a"/>' +
      '<path d="M20 200 Q120 178 220 200 V270 H20 Z" fill="#2c3452"/>' +
      '<path d="M20 214 Q120 194 220 214" stroke="rgba(200,214,240,.14)" stroke-width="4" fill="none"/>' +
      // 촛불 탁자
      '<rect x="150" y="156" width="64 " height="10" fill="#2c2014"/><rect x="172" y="166" width="10" height="44" fill="#241a10"/>' +
      '<rect x="174" y="132" width="5" height="24" fill="#8a744e"/>' + flame(176.5, 124, 0.9) +
      '<circle cx="176" cy="130" r="30" fill="rgba(255,205,110,.10)"/>' +
      '<rect y="210" width="480" height="60" fill="#0a0d18"/>'
    );
  };

  /* 남쪽 바다 — 수평선과 범선 */
  S.sea = function () {
    return wrap("se",
      sky("se", "#78b0c8", "#b6d8e4", "#d8ecf0") +
      '<circle cx="96" cy="56" r="20" fill="#fff6d0"/><circle cx="96" cy="56" r="32" fill="rgba(255,246,208,.3)"/>' +
      '<ellipse cx="300" cy="52" rx="60" ry="11" fill="rgba(255,255,255,.7)"/>' +
      '<ellipse cx="410" cy="80" rx="46" ry="9" fill="rgba(255,255,255,.55)"/>' +
      // 바다
      '<rect y="150" width="480" height="120" fill="#3a7e9e"/>' +
      '<path d="M0 150 H480" stroke="#2c6480" stroke-width="3"/>' +
      '<path d="M20 176 q20 -6 40 0 M120 190 q22 -6 44 0 M260 174 q20 -6 40 0 M380 196 q22 -6 44 0 M60 226 q26 -8 52 0 M210 232 q24 -8 48 0 M340 244 q26 -8 52 0" stroke="rgba(220,240,248,.35)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      // 범선
      '<g><path d="M300 148 L388 148 L376 128 L310 128 Z" fill="#4c3a28"/>' +
      '<rect x="336" y="52" width="5" height="78" fill="#3a2c1c"/>' +
      '<path d="M339 58 L339 122 L296 116 Z" fill="#f2ead6"/><path d="M340 64 L340 120 L378 114 Z" fill="#e6dcc4"/>' +
      '<path d="M339 52 L360 58 L339 64 Z" fill="#c04848"/></g>' +
      birds("rgba(255,255,255,.9)", [[180, 92], [212, 78], [240, 96]])
    );
  };

  /* 도박장 '검은 부두' — 초록 융 테이블과 술병 */
  S.tavern = function () {
    return wrap("tv",
      sky("tv", "#2a1a12", "#46281c", "#1c120c") +
      // 술병 선반
      '<rect x="40" y="40" width="180" height="7" fill="#160d08"/>' +
      '<g><rect x="56" y="10" width="12" height="30" rx="3" fill="#3c5a3c"/><rect x="84" y="6" width="12" height="34" rx="3" fill="#5a3c2c"/><rect x="112" y="12" width="12" height="28" rx="3" fill="#3c4c5a"/><rect x="140" y="8" width="12" height="32" rx="3" fill="#5a4a2c"/><rect x="168" y="12" width="12" height="28" rx="3" fill="#4c3c5a"/></g>' +
      '<rect x="40" y="96" width="180" height="7" fill="#160d08"/>' +
      '<g><rect x="64" y="66" width="12" height="30" rx="3" fill="#5a3c2c"/><rect x="96" y="62" width="12" height="34" rx="3" fill="#3c5a44"/><rect x="130" y="68" width="12" height="28" rx="3" fill="#5a2c2c"/><rect x="162" y="64" width="12" height="32" rx="3" fill="#2c3c5a"/></g>' +
      // 매달린 등 + 빛 원뿔
      '<path d="M330 0 V38" stroke="#120a06" stroke-width="4"/>' +
      '<path d="M312 38 h36 l-6 16 h-24 Z" fill="#2c2014"/>' + flame(330, 48, 0.9) +
      '<path d="M300 56 L360 56 L420 200 L240 200 Z" fill="rgba(255,200,100,.07)"/>' +
      // 초록 융 테이블
      '<ellipse cx="330" cy="216" rx="190" ry="66" fill="#1e4630"/>' +
      '<ellipse cx="330" cy="210" rx="180" ry="58" fill="#2a5e40"/>' +
      // 카드·동전·칩
      '<g transform="rotate(-8 300 206)"><rect x="286" y="196" width="26" height="36" rx="3" fill="#f2eee0"/><path d="M294 206 l10 14 M304 206 l-10 14" stroke="#b03040" stroke-width="3"/></g>' +
      '<g transform="rotate(10 356 216)"><rect x="344" y="200" width="26" height="36" rx="3" fill="#f2eee0"/><circle cx="357" cy="218" r="7" fill="none" stroke="#2c2c34" stroke-width="3"/></g>' +
      '<circle cx="416" cy="232" r="9" fill="#d8b048"/><circle cx="432" cy="224" r="9" fill="#c8a038"/><circle cx="424" cy="240" r="9" fill="#e0bc58"/>' +
      '<circle cx="262" cy="238" r="10" fill="#8a2c34"/><circle cx="278" cy="246" r="10" fill="#742430"/>' +
      // 담배 연기
      '<path d="M120 200 q10 -20 0 -36 q-8 -14 4 -28" stroke="rgba(220,220,220,.14)" stroke-width="5" fill="none" stroke-linecap="round"/>'
    );
  };

  SC.svg = function (bg) {
    var b = S[bg];
    return b ? b() : "";
  };
})();
