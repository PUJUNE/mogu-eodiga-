// portraits.js — 의인화 동물 캐릭터 SVG 흉상 (빅토리아 시대 의상)
// 종족: 언쇼가=고양이(가장은 사자), 린턴가=개, 넬리=닭, 조지프=염소,
//       록우드=토끼, 선주=바다코끼리, 물주=쥐. 모구=실사 얼굴 + 드로잉 몸통.
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});
  var P = (NS.Portraits = {});
  var uid = 0;

  /* ── 공통 부품 ── */

  // 신사 코트 (어깨~가슴)
  function coat(c, shirt, tie) {
    return (
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="' + c.coat + '"/>' +
      '<path d="M49 88 L60 106 L71 88 L66 86 L60 92 L54 86 Z" fill="' + c.shirt + '"/>' +
      '<path d="M49 88 L60 106 L42 101 Z" fill="' + c.lapel + '"/>' +
      '<path d="M71 88 L60 106 L78 101 Z" fill="' + c.lapel + '"/>' +
      (tie || '<path d="M57 90 L63 90 L61 99 L59 99 Z" fill="' + (c.tie || "#8a2c34") + '"/>')
    );
  }
  // 드레스 (레이스 칼라)
  function dress(d, lace) {
    return (
      '<path d="M12 132 C17 98 37 85 60 85 C83 85 103 98 108 132 Z" fill="' + d + '"/>' +
      '<ellipse cx="60" cy="89" rx="17" ry="7.5" fill="' + (lace || "#fff6ee") + '"/>' +
      '<circle cx="60" cy="93" r="2.4" fill="#d8b048"/>'
    );
  }
  // 눈: mood = normal | scowl | kind | sly | weary
  function eyes(mood, col) {
    col = col || "#241f1a";
    var e =
      '<ellipse cx="48.5" cy="50" rx="4.6" ry="5.8" fill="' + col + '"/>' +
      '<ellipse cx="71.5" cy="50" rx="4.6" ry="5.8" fill="' + col + '"/>' +
      '<circle cx="50" cy="48" r="1.5" fill="#fff"/><circle cx="73" cy="48" r="1.5" fill="#fff"/>';
    if (mood === "scowl")
      e += '<path d="M42 42 L55 46 M78 42 L65 46" stroke="' + col + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>';
    if (mood === "kind")
      e += '<path d="M42 44 Q48.5 41 55 44 M65 44 Q71.5 41 78 44" stroke="' + col + '" stroke-width="2" stroke-linecap="round" fill="none"/>';
    if (mood === "sly")
      e += '<path d="M43 45 L54 44 M77 45 L66 44" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
    if (mood === "weary")
      e += '<path d="M43 57 Q48.5 60 54 57 M66 57 Q71.5 60 77 57" stroke="rgba(90,70,90,.5)" stroke-width="1.8" fill="none"/>';
    return e;
  }
  // 고양이 주둥이 + 수염
  function catMuzzle(muz) {
    return (
      '<ellipse cx="60" cy="63" rx="12" ry="8.5" fill="' + (muz || "#fff2e4") + '"/>' +
      '<path d="M56.5 59 L63.5 59 L60 63.5 Z" fill="#e08a92"/>' +
      '<path d="M60 63.5 Q56 68.5 51.5 65.5 M60 63.5 Q64 68.5 68.5 65.5" stroke="#7a5a48" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M30 56 L44 58 M30 63 L44 62 M90 56 L76 58 M90 63 L76 62" stroke="rgba(255,255,255,.75)" stroke-width="1.4" stroke-linecap="round"/>'
    );
  }
  // 고양이 귀
  function catEars(fur, inner) {
    return (
      '<path d="M31 36 L36 8 L54 24 Z" fill="' + fur + '"/><path d="M36 30 L38.5 15 L48 24 Z" fill="' + inner + '"/>' +
      '<path d="M89 36 L84 8 L66 24 Z" fill="' + fur + '"/><path d="M84 30 L81.5 15 L72 24 Z" fill="' + inner + '"/>'
    );
  }
  function catHead(fur) {
    return '<ellipse cx="60" cy="52" rx="30" ry="27.5" fill="' + fur + '"/>';
  }
  function catStripes(col) {
    return '<path d="M50 26 L52 34 M60 24 L60 33 M70 26 L68 34" stroke="' + col + '" stroke-width="3" stroke-linecap="round" fill="none"/>';
  }
  // 개 (늘어진 귀)
  function dogEars(ear) {
    return (
      '<path d="M33 32 C21 32 19 58 29 66 C37 62 39 44 38 33 Z" fill="' + ear + '"/>' +
      '<path d="M87 32 C99 32 101 58 91 66 C83 62 81 44 82 33 Z" fill="' + ear + '"/>'
    );
  }
  function dogMuzzle(muz) {
    return (
      '<ellipse cx="60" cy="64" rx="14" ry="10" fill="' + (muz || "#f6ecd8") + '"/>' +
      '<ellipse cx="60" cy="59.5" rx="5" ry="3.6" fill="#3a2e26"/>' +
      '<path d="M60 63 Q56 69 51 66 M60 63 Q64 69 69 66" stroke="#7a5a48" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    );
  }

  function wrap(inner) {
    return '<svg viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg">' + inner + "</svg>";
  }

  /* ── 캐릭터별 초상 ── */
  var B = {};

  // 모구 — 실사 얼굴 + 검은 벨벳 코트 (히스클리프)
  B.mogu = function () {
    var id = "mgclip" + uid++;
    return wrap(
      coat({ coat: "#252c3c", lapel: "#181e2c", shirt: "#d8dfec", tie: "#8a2c34" }) +
      '<defs><clipPath id="' + id + '"><circle cx="60" cy="49" r="31"/></clipPath></defs>' +
      '<circle cx="60" cy="49" r="32.5" fill="#161a24"/>' +
      '<image href="' + NS.ASSETS.mogu + '" x="25" y="14" width="70" height="70" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid slice"/>'
    );
  };
  // 캣서린 — 밤색 얼룩 고양이 아가씨
  B.cat = function () {
    var fur = "#e0aa6a";
    return wrap(
      dress("#c85a78") +
      catEars(fur, "#f6d8c0") + catHead(fur) + catStripes("#c08840") +
      eyes("normal", "#2e4a30") + catMuzzle() +
      '<path d="M84 14 L94 8 L92 20 Z" fill="#d8385a"/><circle cx="91" cy="14" r="3" fill="#f06a88"/>'
    );
  };
  // 힌들리 — 짙은 갈색 고양이, 찌푸린 눈
  B.hindley = function () {
    var fur = "#8a6238";
    return wrap(
      coat({ coat: "#4a3a26", lapel: "#38290f", shirt: "#d8cfc0", tie: "#5a4630" }) +
      catEars(fur, "#c09a70") + catHead(fur) + catStripes("#6a4826") +
      eyes("scowl", "#33261a") + catMuzzle("#e8d0b0")
    );
  };
  // 프랜시스 — 흰 고양이 새색시
  B.frances = function () {
    var fur = "#f4eeea";
    return wrap(
      dress("#e8a8b8", "#fff") +
      catEars(fur, "#f6cad4") + catHead(fur) +
      eyes("kind", "#5a4658") + catMuzzle("#fff") +
      '<path d="M30 20 Q36 12 42 20 Q36 26 30 20 Z" fill="#e87898"/>'
    );
  };
  // 에드거 — 금빛 리트리버 신사
  B.edgar = function () {
    var fur = "#e8c680";
    return wrap(
      coat({ coat: "#35548a", lapel: "#263e6a", shirt: "#f2ede0", tie: "#c8d6ea" }) +
      dogEars("#c89c50") + '<ellipse cx="60" cy="52" rx="29" ry="28" fill="' + fur + '"/>' +
      eyes("kind", "#43506e") + dogMuzzle("#f6e8c8")
    );
  };
  // 이사벨라 — 크림빛 스패니얼 아가씨
  B.isabella = function () {
    var fur = "#f2e8d4";
    return wrap(
      dress("#b088d0", "#fff6ff") +
      dogEars("#d8b070") + '<ellipse cx="60" cy="52" rx="28" ry="27" fill="' + fur + '"/>' +
      eyes("kind", "#6a4a76") + dogMuzzle("#faf2e2") +
      '<path d="M82 16 L92 10 L90 22 Z" fill="#c86ad8"/><circle cx="89" cy="16" r="3" fill="#e094ec"/>'
    );
  };
  // 넬리 꼬꼬 — 하녀 두건을 쓴 암탉
  B.nelly = function () {
    return wrap(
      dress("#8a6a4a", "#f6f0e0") +
      '<ellipse cx="60" cy="54" rx="26" ry="25" fill="#f6f2ea"/>' +
      '<path d="M46 32 Q48 20 54 28 Q56 16 62 26 Q66 16 70 28 Q74 22 74 32 Z" fill="#d84848"/>' +
      eyes("kind", "#4a3524") +
      '<path d="M55 58 L65 58 L60 69 Z" fill="#e8a030"/>' +
      '<path d="M57 69 Q60 76 63 69" fill="#d05858"/>' +
      '<path d="M34 46 Q28 54 34 62 M86 46 Q92 54 86 62" stroke="#e0d8c8" stroke-width="4" stroke-linecap="round" fill="none"/>'
    );
  };
  // 언쇼 영감 — 갈기 무성한 늙은 사자
  B.earnshaw = function () {
    return wrap(
      '<circle cx="60" cy="52" r="39" fill="#9a6c34"/>' +
      '<circle cx="60" cy="52" r="39" fill="none" stroke="#7c5426" stroke-width="3" stroke-dasharray="7 5"/>' +
      coat({ coat: "#5a4a34", lapel: "#463823", shirt: "#e8e0cc", tie: "#6a5638" }) +
      '<ellipse cx="60" cy="52" rx="27" ry="26" fill="#d8b070"/>' +
      eyes("kind", "#3e2e1a") + catMuzzle("#ecd8ac") +
      '<path d="M44 40 L56 43 M76 40 L64 43" stroke="#b89468" stroke-width="2.4" stroke-linecap="round"/>'
    );
  };
  // 조지프 — 성경책을 낀 늙은 염소
  B.joseph = function () {
    return wrap(
      coat({ coat: "#3a3a38", lapel: "#262624", shirt: "#cfc8ba", tie: "#4a4a44" }) +
      '<path d="M38 20 C28 12 30 2 40 8 C44 12 44 18 44 24 Z" fill="#c8bca8"/>' +
      '<path d="M82 20 C92 12 90 2 80 8 C76 12 76 18 76 24 Z" fill="#c8bca8"/>' +
      '<path d="M32 46 Q24 52 30 60 M88 46 Q96 52 90 60" stroke="#a8a094" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="60" cy="54" rx="26" ry="29" fill="#b8b0a0"/>' +
      eyes("scowl", "#33302a") +
      '<ellipse cx="60" cy="66" rx="11" ry="8" fill="#d8d0c0"/>' +
      '<ellipse cx="56" cy="63.5" rx="2" ry="2.8" fill="#443e34"/><ellipse cx="64" cy="63.5" rx="2" ry="2.8" fill="#443e34"/>' +
      '<path d="M54 76 Q60 92 66 76 Q63 80 60 79 Q57 80 54 76 Z" fill="#d8d0c0"/>' +
      '<rect x="76" y="104" width="20" height="26" rx="2" fill="#6a2c24" transform="rotate(-12 86 117)"/>' +
      '<path d="M82 108 L90 108 M86 104 L86 112" stroke="#d8b048" stroke-width="2" transform="rotate(-12 86 117)"/>'
    );
  };
  // 록우드 — 실크해트의 여행자 토끼
  B.lockwood = function () {
    return wrap(
      coat({ coat: "#5a4a3a", lapel: "#463828", shirt: "#e8e2d4", tie: "#8a6a3a" }) +
      '<ellipse cx="47" cy="14" rx="8" ry="20" fill="#d8cfc0" transform="rotate(-8 47 14)"/>' +
      '<ellipse cx="47" cy="16" rx="4" ry="13" fill="#eeb8b8" transform="rotate(-8 47 14)"/>' +
      '<ellipse cx="73" cy="14" rx="8" ry="20" fill="#d8cfc0" transform="rotate(8 73 14)"/>' +
      '<ellipse cx="73" cy="16" rx="4" ry="13" fill="#eeb8b8" transform="rotate(8 73 14)"/>' +
      '<ellipse cx="60" cy="54" rx="27" ry="26" fill="#e0d8ca"/>' +
      eyes("normal", "#4a4038") +
      '<ellipse cx="60" cy="64" rx="10" ry="7.5" fill="#f4efe6"/>' +
      '<path d="M57 60 L63 60 L60 64 Z" fill="#d89098"/>' +
      '<path d="M60 64 L60 69 M60 69 Q56 72 53 70 M60 69 Q64 72 67 70" stroke="#8a7a68" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<rect x="40" y="24" width="40" height="8" rx="3" fill="#2e2a26"/>' +
      '<rect x="46" y="2" width="28" height="24" rx="3" fill="#2e2a26"/>' +
      '<rect x="46" y="20" width="28" height="5" fill="#8a2c34"/>'
    );
  };
  // 헤어턴 — 거친 옷의 젊은 갈색 고양이
  B.hareton = function () {
    var fur = "#b08a58";
    return wrap(
      '<path d="M16 132 C19 98 38 87 60 87 C82 87 101 98 104 132 Z" fill="#8a7048"/>' +
      '<path d="M50 88 L60 103 L70 88 Z" fill="#d8ccb4"/>' +
      '<path d="M22 110 L38 108 M82 108 L98 110" stroke="#6a5636" stroke-width="4" stroke-linecap="round"/>' +
      catEars(fur, "#d8b888") + catHead(fur) + catStripes("#8a6838") +
      eyes("normal", "#3a2c1c") + catMuzzle("#e8d4b0") +
      '<path d="M40 34 L48 38" stroke="#6a5030" stroke-width="2.4" stroke-linecap="round"/>'
    );
  };
  // 캐시 — 어머니를 닮은 금빛 고양이 아가씨
  B.cathy = function () {
    var fur = "#eccf96";
    return wrap(
      dress("#88b0d8", "#fff") +
      catEars(fur, "#fce8cc") + catHead(fur) +
      eyes("normal", "#2e4a30") + catMuzzle("#fff6ea") +
      '<path d="M82 15 L92 9 L90 21 Z" fill="#4880c0"/><circle cx="89" cy="15" r="3" fill="#78aade"/>'
    );
  };
  // 린턴 — 창백하고 여린 강아지, 목도리
  B.linton = function () {
    return wrap(
      coat({ coat: "#8a95a8", lapel: "#707c92", shirt: "#eef0f4", tie: "#9ab0c0" }) +
      dogEars("#c8ccd8") + '<ellipse cx="60" cy="52" rx="26" ry="26" fill="#e8e6ee"/>' +
      eyes("weary", "#5a5a72") + dogMuzzle("#f4f2f8") +
      '<path d="M34 84 Q60 74 86 84 L86 94 Q60 84 34 94 Z" fill="#9ab0c0"/>'
    );
  };
  // 캣서린의 유령 — 반투명한 푸른 잔상
  B.ghost = function () {
    var fur = "#cfe4f8";
    return wrap(
      '<g opacity="0.85">' +
      '<path d="M20 130 Q26 120 24 108 C28 92 42 85 60 85 C78 85 92 92 96 108 Q94 120 100 130 L90 122 L80 131 L70 123 L60 131 L50 123 L40 131 L30 122 Z" fill="rgba(190,220,248,.75)"/>' +
      catEars(fur, "#e8f2fc") + catHead(fur) +
      '<ellipse cx="48.5" cy="50" rx="4.2" ry="5.4" fill="#5a7a9c"/><ellipse cx="71.5" cy="50" rx="4.2" ry="5.4" fill="#5a7a9c"/>' +
      '<ellipse cx="60" cy="63" rx="11" ry="8" fill="#e8f2fc"/>' +
      '<path d="M56.5 59 L63.5 59 L60 63.5 Z" fill="#a8c0d8"/>' +
      '<path d="M60 63.5 Q55 69 50 66" stroke="#88a8c4" stroke-width="1.5" fill="none"/>' +
      "</g>" +
      '<circle cx="34" cy="30" r="2.5" fill="#e8f4ff" opacity=".8"/><circle cx="90" cy="76" r="2" fill="#e8f4ff" opacity=".6"/>'
    );
  };
  // 선주 영감 — 선장 모자의 바다코끼리
  B.boss = function () {
    return wrap(
      coat({ coat: "#2c3a50", lapel: "#1e2a3c", shirt: "#e8e4d8", tie: "#3a4a60" }) +
      '<ellipse cx="60" cy="54" rx="30" ry="27" fill="#9a8570"/>' +
      eyes("kind", "#2e2620") +
      '<ellipse cx="52" cy="65" rx="9" ry="8" fill="#b8a68e"/><ellipse cx="68" cy="65" rx="9" ry="8" fill="#b8a68e"/>' +
      '<circle cx="49" cy="63" r="1" fill="#5a4a3a"/><circle cx="54" cy="66" r="1" fill="#5a4a3a"/><circle cx="66" cy="66" r="1" fill="#5a4a3a"/><circle cx="71" cy="63" r="1" fill="#5a4a3a"/>' +
      '<path d="M53 71 L51 86 L56 86 L57 72 Z" fill="#f2ecda"/><path d="M67 71 L69 86 L64 86 L63 72 Z" fill="#f2ecda"/>' +
      '<path d="M36 30 L84 30 L79 14 L41 14 Z" fill="#243448"/>' +
      '<rect x="33" y="28" width="54" height="8" rx="3" fill="#16202e"/>' +
      '<circle cx="60" cy="22" r="4" fill="#d8b048"/>'
    );
  };
  // 물주 쥐 — 카드를 든 도박장 쥐
  B.dealer = function () {
    return wrap(
      coat({ coat: "#5a3a3a", lapel: "#442a2a", shirt: "#d8d0c8", tie: "#2e2020" }) +
      '<circle cx="34" cy="24" r="14" fill="#9a9aa4"/><circle cx="34" cy="24" r="8" fill="#d8a8b0"/>' +
      '<circle cx="86" cy="24" r="14" fill="#9a9aa4"/><circle cx="86" cy="24" r="8" fill="#d8a8b0"/>' +
      '<ellipse cx="60" cy="54" rx="27" ry="25" fill="#a8a8b2"/>' +
      eyes("sly", "#2c2630") +
      '<ellipse cx="60" cy="65" rx="11" ry="8" fill="#c0c0ca"/>' +
      '<ellipse cx="60" cy="61" rx="4" ry="3" fill="#d87888"/>' +
      '<path d="M30 60 L46 62 M30 68 L46 66 M90 60 L74 62 M90 68 L74 66" stroke="rgba(230,230,240,.7)" stroke-width="1.3" stroke-linecap="round"/>' +
      '<rect x="82" y="102" width="17" height="24" rx="2" fill="#f2eee4" transform="rotate(14 90 114)"/>' +
      '<path d="M88 108 L94 116 M94 108 L88 116" stroke="#c03040" stroke-width="2.4" transform="rotate(14 90 114)"/>'
    );
  };

  P.svg = function (id) {
    var b = B[id];
    if (b) return b();
    // 미정의 캐릭터 폴백: 이모지
    var c = NS.CHARS[id] || {};
    return wrap('<text x="60" y="72" font-size="56" text-anchor="middle">' + (c.icon || "🐾") + "</text>");
  };
})();
