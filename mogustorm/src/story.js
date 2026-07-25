// story.js — 모구 폭풍의 언덕: 노드 그래프 + 엔딩 메타 (순수 데이터, DOM 접근 없음)
// 노드 형식:
//   { bg, weather, mood, cast:[캐릭터id…], lines:[[화자,대사]…],
//     next:'노드id' | choices:[{t,next,fx:{love,grudge}}] | branch:{stat,gte,then,else} | ending:'엔딩id' }
// 화자 'n' = 내레이션(넬리 꼬꼬의 회상 톤).
(function () {
  "use strict";
  var NS = (window.MWH = window.MWH || {});

  NS.CHARS = {
    mogu:     { name: "모구",        icon: null,  color: "#ffd83d" }, // icon null = 실사 초상
    cat:      { name: "캣서린",      icon: "🐈",  color: "#ff9db8" },
    hindley:  { name: "힌들리",      icon: "🐈‍⬛", color: "#b0784a" },
    edgar:    { name: "에드거",      icon: "🎩",  color: "#8fb8ff" },
    isabella: { name: "이사벨라",    icon: "🎀",  color: "#e8a8ff" },
    nelly:    { name: "넬리 꼬꼬",   icon: "🐔",  color: "#ffc890" },
    earnshaw: { name: "언쇼 영감",   icon: "🦁",  color: "#d8c8a0" },
    hareton:  { name: "헤어턴",      icon: "🐾",  color: "#c0a878" },
    cathy:    { name: "캐시",        icon: "🌸",  color: "#ffb8d0" },
    linton:   { name: "린턴",        icon: "🌫️", color: "#b8c8d8" },
    ghost:    { name: "캣서린…?",    icon: "👻",  color: "#c8e8ff" },
    boss:     { name: "선주 영감",   icon: "⚓",  color: "#90b8c8" },
    dealer:   { name: "물주 쥐",     icon: "🐀",  color: "#a8a8a8" }
  };

  // 엔딩 메타 — tone 5=최고 행복 … 1=최심 절망, axis: 🏛사회 💰경제 💗개인
  NS.ENDINGS = {
    spring:     { n: 1,  title: "언덕 위의 봄",         tone: 5, axis: "💗 개인적 행복",  desc: "캣서린과 언덕에서 맺어졌다" },
    peace:      { n: 2,  title: "두 저택의 화해",       tone: 5, axis: "🏛 사회적 행복",  desc: "복수 대신 용서를 택했다" },
    tycoon:     { n: 3,  title: "리버풀의 거상",        tone: 5, axis: "💰 경제적 행복",  desc: "부두의 전설이 되었다" },
    captain:    { n: 4,  title: "먼바다의 선장",        tone: 4, axis: "💗💰 자유와 부", desc: "수평선 너머를 택했다" },
    afterstorm: { n: 5,  title: "폭풍이 지나간 언덕",   tone: 4, axis: "🏛💗 회복",      desc: "다음 세대를 축복했다" },
    seaside:    { n: 6,  title: "남쪽 바닷가의 요양원", tone: 4, axis: "💗 조용한 행복", desc: "캣서린과 은둔했다" },
    shadows:    { n: 7,  title: "황야의 두 그림자",     tone: 4, axis: "💗 소박한 행복", desc: "가난하지만 자유로운 사랑" },
    wanderer:   { n: 8,  title: "무어의 방랑자",        tone: 3, axis: "💗 무소유의 평화", desc: "전부 내려놓고 황야로" },
    solace:     { n: 9,  title: "뜻밖의 안식",          tone: 3, axis: "💗 작은 온기",   desc: "이사벨라 곁에 정착했다" },
    farewell:   { n: 10, title: "다시 리버풀로",        tone: 2, axis: "💗 체념",        desc: "거절을 안고 떠났다" },
    ghost:      { n: 11, title: "언덕의 유령",          tone: 2, axis: "💗 원작의 결말", desc: "창가의 그 애를 따라갔다" },
    star:       { n: 12, title: "별이 된 약속",         tone: 2, axis: "💗 서정적 비극", desc: "페니스톤 바위에서의 이별" },
    servant:    { n: 13, title: "잿빛 하인",            tone: 1, axis: "🏛 사회적 절망", desc: "평생 짓밟히며 살았다" },
    ruin:       { n: 14, title: "부둣가의 탕진",        tone: 1, axis: "💰 경제적 절망", desc: "도박이 전부를 삼켰다" },
    wreck:      { n: 15, title: "워더링 하이츠의 폐인", tone: 1, axis: "💗 자기 파괴",   desc: "술이 그를 삼켰다" },
    blizzard:   { n: 16, title: "눈보라 속의 목소리",   tone: 1, axis: "💗 광기",        desc: "유령을 쫓다 얼어붙었다" },
    tempest:    { n: 17, title: "폭풍이 삼킨 밤",       tone: 1, axis: "💗 이른 비극",   desc: "가출한 밤, 폭풍 속으로" },
    avatar:     { n: 18, title: "복수의 화신",          tone: 1, axis: "🏛💗 최심 절망", desc: "모두를 파괴하고 홀로 남았다" }
  };

  NS.START = "a1_1";
  NS.BASE_STATS = { love: 3, grudge: 0 };

  var S = (NS.STORY = {});

  /* ════════════ 1부 — 어린 시절 ════════════ */

  S.a1_1 = {
    bg: "liverpool", weather: "rain", mood: "sad", cast: ["nelly"],
    lines: [
      ["n", "이 이야기를 어디서부터 풀어야 할까요. 나, 넬리 꼬꼬가 폭풍의 언덕 저택에서 일한 지도 어느덧 수십 년…"],
      ["n", "모든 것은 언쇼 영감님이 리버풀 부두에서 비에 젖은 작은 고양이 한 마리를 외투에 싸 온 그날 밤부터 시작되었답니다."],
      ["earnshaw", "부둣가 상자 뒤에서 울고 있더구나. 이름은… 모구. 오늘부터 이 아이도 우리 식구다."]
    ],
    next: "a1_2"
  };
  S.a1_2 = {
    bg: "hall", weather: "none", mood: "warm", cast: ["hindley", "cat"],
    lines: [
      ["hindley", "뭐야 이 꼬질꼬질한 부둣가 떠돌이는! 아버지는 맨날 이상한 것만 주워 오셔!"],
      ["n", "장남 힌들리 도련님은 첫날부터 이빨을 드러냈지요. 하지만 아가씨는 달랐습니다."],
      ["cat", "…너, 눈이 폭풍우 치는 밤바다 색이네. 난 캣서린이야. 넌 이제 내 거야!"]
    ],
    next: "a1_3"
  };
  S.a1_3 = {
    bg: "hall", weather: "none", mood: "warm", cast: ["cat"],
    lines: [
      ["n", "그날 저녁, 캣서린 아가씨는 자기 몫의 츄르를 들고 몰래 헛간으로 찾아왔습니다."],
      ["cat", "자, 반 잘라 왔어. 폭풍의 언덕에 온 걸 환영해, 모구!"]
    ],
    choices: [
      { t: "🍦 같이 나눠 먹으며 마음을 연다", next: "a1_4a", fx: { love: 2 } },
      { t: "🧱 아직은 경계하며 물러선다",     next: "a1_4b", fx: { grudge: 1 } }
    ]
  };
  S.a1_4a = {
    bg: "hall", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "…맛있어. 이런 건 부두에서 한 번도 못 먹어 봤어."],
      ["cat", "그치? 내일은 황야를 보여 줄게. 여기서 제일 좋은 곳이야!"],
      ["n", "두 아이는 그날 밤 츄르 하나로 세상에서 가장 단단한 동맹을 맺었답니다."]
    ],
    next: "a1_5"
  };
  S.a1_4b = {
    bg: "hall", weather: "none", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "(…호의는 언제나 대가를 요구했다. 부두에서는 그랬다.)"],
      ["cat", "흥, 도도한 녀석. 그래도 츄르는 두고 갈 거야. 내일 또 올 거니까!"],
      ["n", "아가씨는 물러서는 법이 없었지요. 그 벽이 무너지는 건 시간문제였습니다."]
    ],
    next: "a1_5"
  };
  S.a1_5 = {
    bg: "moor", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["n", "바람 부는 황야는 두 아이의 왕국이 되었습니다. 히스꽃 언덕을 달리고, 페니스톤 바위 꼭대기에 나란히 앉아—"],
      ["cat", "약속해, 모구. 어른이 되어도, 무슨 일이 있어도, 이 바위에서 부르면 반드시 올 거라고."],
      ["mogu", "약속할게. 폭풍이 치는 날에도, 눈이 쌓이는 날에도."]
    ],
    fx: { love: 1 },
    next: "a1_6"
  };
  S.a1_6 = {
    bg: "heights_ext", weather: "cloud", mood: "tense", cast: ["hindley"],
    lines: [
      ["n", "하지만 힌들리 도련님의 심술은 날로 심해졌습니다. 아버지의 사랑을 빼앗겼다고 여긴 거지요."],
      ["hindley", "이 떠돌이! 내 말을 훔쳐 탔지? 마구간 청소는 네 몫이다. 밥은 그 다음이야!"]
    ],
    choices: [
      { t: "🤐 묵묵히 참는다 (언젠가는…)",        next: "a1_7a", fx: { grudge: 2 } },
      { t: "⚡ 정면으로 맞선다",                   next: "a1_7b", fx: { grudge: 1 } },
      { t: "💬 캣서린에게 털어놓는다",             next: "a1_7c", fx: { love: 2 } }
    ]
  };
  S.a1_7a = {
    bg: "heights_ext", weather: "cloud", mood: "tense", cast: ["mogu"],
    lines: [
      ["mogu", "(참자. 참고, 기억해 두자. 전부. 하나도 빠짐없이.)"],
      ["n", "어린 모구의 눈 속에 그때부터 차가운 불씨 같은 것이 자리 잡았습니다. 나는 그게 늘 마음에 걸렸어요."]
    ],
    next: "a1_8"
  };
  S.a1_7b = {
    bg: "heights_ext", weather: "cloud", mood: "tense", cast: ["earnshaw", "hindley"],
    lines: [
      ["mogu", "말은 네가 탔잖아. 거짓말로 남을 밟는 건 비겁해."],
      ["earnshaw", "힌들리! 또 네 짓이냐. 모구는 잘못이 없다. 방으로 올라가거라!"],
      ["n", "영감님은 모구의 편을 들어 주셨지만… 그럴수록 도련님의 미움은 안으로 곪아 갔지요."]
    ],
    next: "a1_8"
  };
  S.a1_7c = {
    bg: "moor", weather: "cloud", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "…힌들리가 또. 아니, 아무것도 아니야."],
      ["cat", "아무것도 아니긴! 얼굴에 다 쓰여 있는데. 이리 와, 오늘은 바위까지 경주야. 이기는 쪽이 대장!"],
      ["n", "아가씨는 서툴지만 가장 확실한 방법으로 모구의 상처를 어루만질 줄 알았습니다."]
    ],
    next: "a1_8"
  };
  S.a1_8 = {
    bg: "hall", weather: "rain", mood: "sad", cast: ["earnshaw", "hindley"],
    lines: [
      ["n", "그리고 그해 가을, 언쇼 영감님이 벽난로 앞 의자에서 조용히 숨을 거두셨습니다."],
      ["hindley", "이제 이 집의 주인은 나다. 모구, 네 방은 오늘부터 헛간이야. 하인은 하인답게 살아라."],
      ["n", "하루아침에 모구는 식구에서 하인으로 떨어졌습니다. 책도, 따뜻한 밥상도 빼앗긴 채로요."]
    ],
    fx: { grudge: 1 },
    next: "a1_9"
  };
  S.a1_9 = {
    bg: "moor_night", weather: "stars", mood: "tense", cast: ["cat"],
    lines: [
      ["n", "그런 나날에도 두 아이의 밤 산책만은 계속되었습니다. 어느 밤, 언덕 아래 골짜기의 저택 — 스러시크로스 그레인지의 불빛이 유난히 반짝였지요."],
      ["cat", "모구, 저기 봐! 그레인지의 무도회야. 몰래 창문으로 들여다보자. 딱 한 번만!"]
    ],
    choices: [
      { t: "🏃 함께 몰래 숨어든다",               next: "a1_10" },
      { t: "🛑 위험해 — 가지 말자고 말린다",       next: "e_1", fx: { love: 1 } }
    ]
  };
  S.a1_10 = {
    bg: "grange", weather: "stars", mood: "tense", cast: ["cat", "edgar"],
    lines: [
      ["n", "샹들리에, 벨벳 소파, 크림이 가득한 접시… 창문 너머는 딴 세상이었습니다. 그때, 경비견이 짖었습니다!"],
      ["cat", "아얏—! 모구, 발목이…!"],
      ["n", "붙잡힌 아가씨는 다리를 다쳐 그레인지에 머물게 되었고, 하인 차림의 모구만 쫓겨났습니다. 그리고 5주 — 언덕은 아가씨 없이 겨울을 났지요."]
    ],
    next: "b1_1"
  };

  /* ════════════ 2부A — 원작 루트 (그레인지 이후) ════════════ */

  S.b1_1 = {
    bg: "hall", weather: "none", mood: "tense", cast: ["cat", "edgar"],
    lines: [
      ["n", "다섯 주 만에 돌아온 아가씨는… 딴 고양이가 되어 있었습니다. 윤기 나는 털, 리본, 우아한 걸음걸이."],
      ["cat", "어머, 모구. 너 그동안 세수도 안 했니? 손이 온통 흙투성이야."],
      ["n", "그 곁에는 그레인지의 도련님, 에드거가 비단 목도리를 두르고 서 있었지요."]
    ],
    next: "b1_2"
  };
  S.b1_2 = {
    bg: "heights_ext", weather: "cloud", mood: "sad", cast: ["mogu"],
    lines: [
      ["mogu", "(흙투성이 손. 헛간의 짚 냄새. …나는 언제부터 부끄러운 존재가 된 거지?)"],
      ["n", "에드거 도련님의 방문이 잦아질수록, 모구의 자리는 점점 부엌 구석으로 밀려났습니다."]
    ],
    choices: [
      { t: "🧼 몸단장을 하고 어울리려 애쓴다",     next: "b1_3a", fx: { love: 1 } },
      { t: "🌑 헛간에서 혼자 삭인다",             next: "b1_3b", fx: { grudge: 1 } }
    ]
  };
  S.b1_3a = {
    bg: "hall", weather: "none", mood: "tense", cast: ["edgar", "hindley"],
    lines: [
      ["n", "모구는 세수를 하고 낡은 외투를 손질해 응접실에 들어섰습니다. 하지만—"],
      ["edgar", "어이쿠, 마구간 냄새. 하인은 뒷문을 쓰는 게 예의 아닌가?"],
      ["hindley", "하하! 들었냐? 꼴에 신사 흉내라니. 나가서 장작이나 패라!"],
      ["mogu", "(…기억해 두겠어. 이 웃음소리, 전부.)"]
    ],
    fx: { grudge: 1 },
    next: "b1_4"
  };
  S.b1_3b = {
    bg: "barn", weather: "rain", mood: "sad", cast: ["mogu"],
    lines: [
      ["mogu", "(비단 목도리, 은식기, 무도회… 그런 세상에 내 자리는 없어.)"],
      ["n", "헛간 지붕을 두드리는 빗소리만이 모구의 곁을 지켰습니다. 응어리는 소리 없이 자라났지요."]
    ],
    next: "b1_4"
  };
  S.b1_4 = {
    bg: "kitchen", weather: "rain", mood: "sad", cast: ["cat", "nelly"],
    lines: [
      ["n", "그리고 그 저녁이 왔습니다. 부엌에서 아가씨가 내게 털어놓던 — 모구가 문 뒤에 있는 줄도 모르고요."],
      ["cat", "넬리, 에드거가 청혼했어. …받아들일 생각이야."],
      ["cat", "모구와 결혼한다면? 격이 떨어질 거야. 지금의 그와 결혼하는 건 스스로를 낮추는 일이야."]
    ],
    choices: [
      { t: "👂 끝까지 듣는다",                     next: "b2_listen" },
      { t: "🌩️ 뛰쳐나간다",                        next: "b2_run" },
      { t: "🚪 문을 열고 맞선다",                  next: "b2_face", fx: { grudge: 2 } }
    ]
  };
  S.b2_listen = {
    bg: "kitchen", weather: "rain", mood: "sad", cast: ["cat", "nelly"],
    lines: [
      ["n", "모구는 주먹을 쥔 채 문 뒤에 남았습니다. 아가씨의 말은 거기서 끝나지 않았어요."],
      ["cat", "하지만 넬리… 내 영혼이 무엇으로 되어 있든, 모구의 영혼과 나의 영혼은 같은 것으로 되어 있어."],
      ["cat", "에드거를 향한 마음은 숲의 잎사귀 같아. 겨울이 오면 변하겠지. 하지만 모구를 향한 마음은 그 아래 바위야. …모구는 나야, 넬리."]
    ],
    next: "b2_listen2"
  };
  S.b2_listen2 = {
    bg: "moor_night", weather: "cloud", mood: "sad", cast: ["mogu"],
    lines: [
      ["mogu", "(격이 떨어진다… 그리고, 나는 캣서린이다…? 어느 쪽이 진짜 마음이야.)"],
      ["n", "빗속의 황야에서 모구는 밤새 서성였습니다. 대답은 하나뿐이었지요 — 본인에게 직접 듣는 것."]
    ],
    choices: [
      { t: "💛 캣서린에게 마음을 고백한다", next: "b2_confess_gate" },
      { t: "⚓ 아무 말 없이 언덕을 떠난다", next: "b2_leave", fx: { grudge: 1 } }
    ]
  };
  S.b2_confess_gate = { branch: { stat: "love", gte: 6, then: "b2_confess_ok", else: "b2_confess_no" } };
  S.b2_confess_ok = {
    bg: "penistone", weather: "cloud", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "다 들었어. 격이 떨어진다는 말도, …바위라는 말도. 캣서린, 네 입으로 말해 줘. 어느 쪽이 너야?"],
      ["cat", "…비겁했어, 나. 무도회장의 샹들리에가 아니라, 이 바람 부는 바위 위가 나야. 모구, 네 곁이 나야."],
      ["n", "페니스톤 바위 위, 두 그림자가 오래도록 흔들렸습니다."]
    ],
    choices: [
      { t: "🌄 오늘 밤, 함께 언덕을 떠나자", next: "b2_elope" },
      { t: "🕰️ 언덕에 남아 때를 기다리자",   next: "b2_stay" }
    ]
  };
  S.b2_elope = {
    bg: "moor_night", weather: "stars", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["cat", "에드거에게는 편지를 남겼어. 미안하다고, 그리고 고마웠다고."],
      ["mogu", "가진 건 이 보따리 하나뿐이야. 그래도 괜찮아?"],
      ["cat", "바보. 황야가 통째로 우리 건데 뭐가 더 필요해?"]
    ],
    next: "end_shadows"
  };
  S.b2_stay = {
    bg: "heights_ext", weather: "rain", mood: "tense", cast: ["hindley"],
    lines: [
      ["n", "하지만 언덕에 남는 길은 가시밭이었습니다. 눈치챈 힌들리 도련님의 학대는 도를 넘었고—"],
      ["hindley", "하인 주제에 내 동생을 넘봐? 오늘부로 넌 이 집에서 쫓겨나는 거다! 나가!"],
      ["mogu", "(좋아. 나가 주지. 대신 돌아올 때는… 이 집의 문서를 들고 오겠어.)"],
      ["n", "모구는 리버풀행 새벽 마차에 올랐습니다. 아가씨가 기다리겠다는 약속 하나를 품고서요."]
    ],
    next: "l_1"
  };
  S.b2_confess_no = {
    bg: "grange", weather: "rain", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "캣서린. 다 들었어. 나와… 나와 함께라면, 격이라는 게 그렇게 중요해?"],
      ["cat", "…지금은 안 돼, 모구. 미안해. 나는 이미 에드거에게 대답을 했어. 지금의 우리는… 안 돼."],
      ["mogu", "(지금의 우리. 그 말이 못이 되어 박혔다. 그래 — 그렇다면 '지금의 나'를 부수고 오겠어.)"]
    ],
    fx: { grudge: 1 },
    next: "l_1"
  };
  S.b2_leave = {
    bg: "moor_night", weather: "rain", mood: "sad", cast: ["mogu"],
    lines: [
      ["mogu", "(말해서 뭐 해. 격이 떨어진다는 게 저 애의 대답인걸.)"],
      ["n", "모구는 뒤도 돌아보지 않고 빗속을 걸었습니다. 리버풀 부두 — 시작의 자리로 돌아가는 길이었지요."]
    ],
    next: "l_1"
  };
  S.b2_run = {
    bg: "moor_night", weather: "storm", mood: "storm", cast: ["mogu"],
    lines: [
      ["n", "모구는 문을 박차고 폭풍우 속으로 뛰쳐나갔습니다. 천둥이 언덕을 통째로 흔들던 밤이었어요."],
      ["mogu", "(격이 떨어진다—— 격이—— 그 한마디만이 빗소리를 뚫고 귓가를 맴돌았다.)"]
    ],
    choices: [
      { t: "🌪️ 폭풍을 뚫고 황야 깊은 곳으로", next: "b2_run_deep" },
      { t: "⚓ 리버풀 부두로 향한다",          next: "l_1" }
    ]
  };
  S.b2_run_deep = {
    bg: "moor_night", weather: "storm", mood: "storm", cast: ["mogu"],
    lines: [
      ["n", "그날 밤 아가씨는 비를 맞으며 밤새 모구를 찾아 헤맸습니다. 페니스톤 바위, 히스 골짜기, 늪지대까지…"],
      ["n", "하지만 황야는 넓고, 폭풍은 무자비했지요."]
    ],
    next: "end_tempest"
  };
  S.b2_face = {
    bg: "kitchen", weather: "rain", mood: "storm", cast: ["cat", "hindley"],
    lines: [
      ["mogu", "격이 떨어진다고. …그 격이라는 걸 만든 게 누군지는 알아, 캣서린?"],
      ["cat", "모, 모구?! 듣고 있었어…? 아니, 그게 아니라—"],
      ["hindley", "이 하인 놈이 어디서 소란이야! 잘됐다, 오늘부로 꺼져라. 두 번 다시 이 문턱을 넘을 생각 마!"],
      ["n", "그렇게 모구는 언덕에서 내던져졌습니다. 주머니엔 동전 세 닢, 가슴엔 타오르는 것 하나."]
    ],
    next: "l_1"
  };

  /* ════════════ 2부B — 조기 순애 루트 (그레인지에 가지 않음) ════════════ */

  S.e_1 = {
    bg: "moor_night", weather: "stars", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "저 불빛은 우리 게 아니야. 들키면 넌 저 집에 붙잡히고, 난 쫓겨나. …그런 예감이 들어."],
      ["cat", "…이상한 애. 근데 그 말, 왠지 무섭도록 그럴듯하다. 좋아, 대신 바위까지 경주야!"],
      ["n", "그날 밤 두 아이는 그레인지 대신 페니스톤 바위에서 별을 셌습니다. 운명이 살짝 비껴간 밤이었지요."]
    ],
    fx: { love: 1 },
    next: "e_2"
  };
  S.e_2 = {
    bg: "heights_ext", weather: "cloud", mood: "tense", cast: ["hindley", "cat"],
    lines: [
      ["n", "그러나 언덕 안의 폭풍은 피할 수 없었습니다. 힌들리 도련님의 압제는 해가 갈수록 무거워졌어요."],
      ["hindley", "캣서린! 하인 놈과 어울리는 것도 오늘까지다. 그레인지의 에드거 도련님이 널 만나고 싶다더군. 이건 명령이야."],
      ["cat", "싫어! 오빠가 뭔데 내 마음을 정해?!"]
    ],
    choices: [
      { t: "🗣️ 힌들리와 정면으로 담판을 짓는다", next: "e_talk_gate" },
      { t: "🌙 캣서린과 야반도주한다",           next: "e_elope" },
      { t: "🤐 묵묵히 견딘다",                   next: "e_endure", fx: { grudge: 1 } }
    ]
  };
  S.e_talk_gate = { branch: { stat: "love", gte: 7, then: "e_talk_ok", else: "e_talk_no" } };
  S.e_talk_ok = {
    bg: "hall", weather: "none", mood: "tense", cast: ["hindley", "cat", "mogu"],
    lines: [
      ["mogu", "힌들리. 나는 이 집 마구간의 일을 다 안다. 장부의 구멍도, 당신이 도박장에 진 빚도. 내가 그걸 메워 온 것도."],
      ["mogu", "나를 내쫓으면 이 언덕은 1년 안에 넘어가. 나를 식구로 되돌려. 그리고 캣서린의 마음은 캣서린의 것이다."],
      ["cat", "나는 모구를 선택할 거야, 오빠. 백 번을 물어도 백 번 다."],
      ["hindley", "…빌어먹을. 마음대로 해라! 대신 장부는 계속 네가 맡는 거다!"]
    ],
    next: "end_spring"
  };
  S.e_talk_no = {
    bg: "hall", weather: "rain", mood: "storm", cast: ["hindley"],
    lines: [
      ["mogu", "캣서린을 도구처럼 쓰지 마. 이 집에서 일해 온 건—"],
      ["hindley", "하인이 감히 주인에게 훈계냐! 잘됐다, 오늘부로 넌 해고야. 황야로 꺼져!"],
      ["n", "담판은 계란으로 바위 치기였습니다. 아직 모구에겐 힘이 — 세상이 알아주는 종류의 힘이 없었으니까요."],
      ["mogu", "(힘을. 힘을 가져야 해. 돌아올 때는 이 문을 정면으로 열 수 있는 힘을.)"]
    ],
    next: "l_1"
  };
  S.e_elope = {
    bg: "penistone", weather: "stars", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["cat", "정말 갈 거야? 빵 두 덩이랑 담요 한 장뿐인데."],
      ["mogu", "황야 너머 목양지에 일손이 필요하대. 오두막도 있고. …가난할 거야. 그래도—"],
      ["cat", "그래도 바람은 공짜지! 가자, 모구. 페니스톤 바위가 증인이야."]
    ],
    next: "end_shadows"
  };
  S.e_endure = {
    bg: "heights_ext", weather: "snow", mood: "sad", cast: ["nelly"],
    lines: [
      ["n", "모구는 견뎠습니다. 한 해, 두 해… 다섯 해. 그동안 아가씨는 등 떠밀리듯 그레인지의 안주인이 되었지요."],
      ["n", "결혼식 날, 모구는 마구간에서 말굽만 닦았습니다. 종소리가 언덕을 넘어올 때까지, 하루 종일요."]
    ],
    choices: [
      { t: "⛓️ …이대로 아무것도 하지 않는다", next: "end_servant" },
      { t: "⚓ 이제라도 언덕을 떠난다",        next: "l_1", fx: { grudge: 1 } }
    ]
  };

  /* ════════════ 3부 — 리버풀 3년 ════════════ */

  S.l_1 = {
    bg: "liverpool", weather: "cloud", mood: "tense", cast: ["mogu"],
    lines: [
      ["n", "리버풀 부두는 모구가 버려졌던 그 자리 그대로였습니다. 소금 냄새, 뱃고동, 산더미 같은 짐짝들."],
      ["mogu", "(3년. 3년 안에 다른 존재가 되어 돌아간다. …어디서부터 시작하지?)"]
    ],
    choices: [
      { t: "📦 무역 상회에서 바닥부터 일한다",   next: "l_trade" },
      { t: "🎲 뒷골목 도박장에서 한탕을 노린다", next: "l_gamble" },
      { t: "⛵ 원양 항해선에 오른다",            next: "l_sail" }
    ]
  };
  S.l_trade = {
    bg: "liverpool", weather: "none", mood: "warm", cast: ["boss"],
    lines: [
      ["n", "모구는 새벽 짐꾼부터 시작했습니다. 헛간살이로 단련된 몸과 장부를 읽는 눈썰미는 곧 소문이 났지요."],
      ["boss", "허어, 면화 시세를 사흘 먼저 읽어냈다고? 다음 배부터 자네가 화물을 총괄하게."],
      ["n", "3년째 되던 해, 부두 사람들은 모구를 '언덕에서 온 젊은 거상'이라 불렀습니다."]
    ],
    choices: [
      { t: "🏙️ 리버풀에 남아 상회를 키운다",  next: "l_trade_stay" },
      { t: "🏔️ 언덕으로 돌아간다",            next: "r_1" }
    ]
  };
  S.l_trade_stay = {
    bg: "liverpool", weather: "none", mood: "warm", cast: ["mogu"],
    lines: [
      ["mogu", "(언덕은… 이제 지도 위의 점일 뿐이야. 내 세상은 이 항구에서 수평선까지다.)"],
      ["n", "가끔 북쪽에서 온 손님이 황야 이야기를 꺼내면, 모구는 잠시 창밖을 보았다가 — 다시 장부로 눈을 내렸습니다."]
    ],
    next: "end_tycoon"
  };
  S.l_gamble = {
    bg: "tavern", weather: "none", mood: "tense", cast: ["dealer"],
    lines: [
      ["n", "뒷골목 '검은 부두' 도박장. 초록 융 위에서 모구의 배포와 눈썰미는 무서운 무기였습니다."],
      ["dealer", "촌뜨기가 제법이군. 오늘 밤 큰 판이 선다. 전 재산을 걸 배짱, 있나?"],
      ["mogu", "(딴 돈이 이미 마차 한 대 값. 여기서 멈추느냐, 전부를 거느냐—)"]
    ],
    choices: [
      { t: "💥 전부를 건다",             next: "l_gamble_lose" },
      { t: "🧊 따는 즉시 손을 턴다",     next: "l_gamble_win", fx: { grudge: 1 } }
    ]
  };
  S.l_gamble_lose = {
    bg: "tavern", weather: "rain", mood: "storm", cast: ["dealer"],
    lines: [
      ["dealer", "저런, 저런. 에이스가 넉 장이라니 — 물주 쪽에 말이야. 크크크."],
      ["n", "판은 처음부터 기울어 있었습니다. 3년 치 땀이 하룻밤 초록 융 위에서 녹아 사라졌지요."]
    ],
    next: "end_ruin"
  };
  S.l_gamble_win = {
    bg: "tavern", weather: "none", mood: "tense", cast: ["mogu"],
    lines: [
      ["mogu", "여기까지. …도박은 이기는 법이 아니라 이긴 채로 일어서는 법이 어렵다더군. 잘 배웠다."],
      ["n", "모구는 검은 돈뭉치를 외투 안에 넣고 북쪽 마차에 올랐습니다. 부두의 3년이 가르친 건 셈법만이 아니었어요 — 사람을 무너뜨리는 법도였지요."]
    ],
    next: "r_1"
  };
  S.l_sail = {
    bg: "sea", weather: "cloud", mood: "tense", cast: ["boss"],
    lines: [
      ["n", "모구는 인도양을 오가는 상선 '그림자호'에 올랐습니다. 돛대 위에서 폭풍 여덟 번, 해적 두 번을 넘겼지요."],
      ["boss", "폭풍 속에서 키를 놓지 않은 건 자네뿐이었네. 다음 항해부터 '선장 모구'라 부르지."],
      ["n", "3년째, 모구의 이름은 일곱 항구에 알려졌습니다."]
    ],
    choices: [
      { t: "🌊 바다에 남는다 — 수평선이 내 집이다", next: "end_captain" },
      { t: "🏔️ 고향으로 뱃머리를 돌린다",           next: "r_1" }
    ]
  };

  /* ════════════ 4부 — 귀환 ════════════ */

  S.r_1 = {
    bg: "heights_ext", weather: "cloud", mood: "tense", cast: ["nelly", "mogu"],
    lines: [
      ["n", "3년 만에 언덕에 나타난 모구를 보고 나는 들고 있던 달걀 바구니를 떨어뜨릴 뻔했습니다."],
      ["n", "벨벳 외투, 곧은 어깨, 서늘한 눈 — 부둣가 떠돌이는 어디에도 없었어요. 신사가, 아니 폭풍이 문 앞에 서 있었지요."],
      ["mogu", "오랜만이야, 넬리 꼬꼬. …캣서린은 어디 있지?"],
      ["n", "나는 차마 바로 대답하지 못했습니다. 아가씨는 이미… 그레인지의 안주인이었으니까요."]
    ],
    next: "r_2"
  };
  S.r_2 = {
    bg: "grange", weather: "none", mood: "sad", cast: ["cat", "edgar"],
    lines: [
      ["n", "그레인지 응접실. 아가씨는 모구를 보자 찻잔을 놓친 것도 모르고 달려 나왔습니다."],
      ["cat", "모구…! 살아 있었구나. 3년 동안 한 통의 편지도 없이… 너 정말…!"],
      ["edgar", "(굳은 얼굴로) …아내의 옛 친구시군요. 어서 오십시오. '언쇼가의 하인'이었다고 들었습니다만."],
      ["mogu", "(하인. 그 단어를 아직도 쓰는군. 좋아 — 그렇다면 이쪽도 방식을 고르지.)"]
    ],
    choices: [
      { t: "🔥 복수를 시작한다",                 next: "rev_1" },
      { t: "🕊️ 모두 용서한다",                   next: "r_forgive_gate" },
      { t: "💘 캣서린만 되찾는다",               next: "r_love_gate" }
    ]
  };
  S.r_forgive_gate = { branch: { stat: "grudge", lte: 3, then: "r_forgive_ok", else: "r_forgive_no" } };
  S.r_forgive_ok = {
    bg: "hall", weather: "none", mood: "warm", cast: ["hindley", "mogu"],
    lines: [
      ["n", "모구가 처음 찾아간 곳은 뜻밖에도 언덕이었습니다. 도박빚에 절어 폐인이 되어 가던 힌들리에게—"],
      ["mogu", "당신 빚, 내가 갚았어. 문서도 여기. …당신이 미웠지만, 이 집까지 미워지고 싶지는 않아졌거든."],
      ["hindley", "…왜, 왜 이런 짓을. 내가 너한테 한 짓을 잊었나? 이 헛간에서 재웠던 나를…!"],
      ["mogu", "잊지 않았어. 잊지 않아서 — 여기서 끝내려는 거야."]
    ],
    next: "end_peace"
  };
  S.r_forgive_no = {
    bg: "hall", weather: "rain", mood: "storm", cast: ["hindley", "mogu"],
    lines: [
      ["n", "용서하려 했습니다. 정말로요. 하지만 힌들리의 비웃는 낯을 마주한 순간—"],
      ["hindley", "허, 부둣가 하인 놈이 외투 하나 걸치고 신사 흉내냐? 헛간 냄새는 평생 못 지워, 임마!"],
      ["mogu", "(…그래. 이 응어리는 기도문 몇 줄로 녹는 종류의 것이 아니었어.)"],
      ["n", "내밀려던 손은 주먹으로 바뀌었습니다. 폭풍은 방향을 정했지요."]
    ],
    next: "rev_1"
  };
  S.r_love_gate = { branch: { stat: "love", gte: 7, then: "r_elope_yes", else: "r_elope_no" } };
  S.r_elope_yes = {
    bg: "grange", weather: "stars", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["n", "달빛 아래 정원, 모구는 아가씨의 창 아래에 섰습니다."],
      ["mogu", "캣서린. 격도, 저택도, 반지도 다 잊어. 바위 위에서 했던 약속만 기억해. — 나와 가자."],
      ["cat", "…기다렸어. 3년 내내, 창밖 황야만 보면서. …갈게. 어디든."],
      ["n", "하지만 나는 알고 있었습니다. 아가씨의 기침이 요 며칠 부쩍 심해졌다는 것을요."]
    ],
    choices: [
      { t: "🌅 남쪽 바닷가에서 요양부터 하자", next: "r_elope_care" },
      { t: "🌪️ 지금 당장, 멀리 — 강행한다",    next: "r_elope_hard" }
    ]
  };
  S.r_elope_care = {
    bg: "sea", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "서두르지 않아도 돼. 우리한테서 시간을 뺏을 수 있는 건 이제 아무것도 없으니까."],
      ["cat", "바다는 처음 봐. …황야를 닮았네. 끝이 없는 게."],
      ["n", "리버풀에서 번 돈으로 모구는 남쪽 바닷가에 작은 요양원을 얻었습니다. 소문도, 격식도 닿지 않는 곳에요."]
    ],
    next: "end_seaside"
  };
  S.r_elope_hard = {
    bg: "penistone", weather: "storm", mood: "storm", cast: ["cat", "mogu"],
    lines: [
      ["n", "그날 밤 두 사람은 폭풍을 뚫고 페니스톤 바위를 넘었습니다. 그러나 아가씨의 몸은 이미 폭풍보다 위태로웠지요."],
      ["cat", "모구… 잠깐만. 잠깐만 쉬자. 여기, 우리 바위잖아. …여기면 됐어."]
    ],
    next: "end_star"
  };
  S.r_elope_no = {
    bg: "grange", weather: "rain", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "나와 가자, 캣서린. 지금의 나는 그때의 내가 아니야. 뭐든 줄 수 있어."],
      ["cat", "…늦었어, 모구. 나는 에드거의 아내고, 이 집엔 내가 지켜야 할 것들이 생겼어. 3년 전의 우리는… 이제 없어."],
      ["mogu", "(빗소리가 유난히 컸다. 그 애의 목소리가 흔들렸는지 아닌지도 들리지 않을 만큼.)"]
    ],
    choices: [
      { t: "🚢 조용히 언덕을 떠난다",       next: "end_farewell" },
      { t: "🔥 …그렇다면 남은 건 복수뿐",   next: "rev_1", fx: { grudge: 2 } }
    ]
  };

  S.rev_1 = {
    bg: "hall", weather: "rain", mood: "storm", cast: ["hindley", "mogu"],
    lines: [
      ["n", "그날부터 모구는 언덕에 눌러앉았습니다. 도박에 빠진 힌들리에게 판돈을 대주며 — 문서를, 마구간을, 목초지를 한 장씩 거둬들였지요."],
      ["hindley", "한 판만 더! 이번엔 진짜 느낌이 온다고! 저택 문서? 그, 그래, 걸겠어!"],
      ["mogu", "(천천히. 서두를 것 없어. 이 집이 나를 삼켰던 속도 그대로, 나도 이 집을 삼킨다.)"]
    ],
    next: "rev_2"
  };
  S.rev_2 = {
    bg: "grange", weather: "none", mood: "tense", cast: ["isabella"],
    lines: [
      ["n", "한편 그레인지에서는 뜻밖의 소동이 벌어졌습니다. 에드거의 여동생 이사벨라 아가씨가 모구에게 홀딱 반해 버린 거예요."],
      ["isabella", "오라버니는 몰라요! 모구 님의 그 그늘진 눈빛… 분명 상처 입은 영혼이라고요! 제가 치유해 드릴 거예요!"],
      ["mogu", "(에드거의 여동생이라. …린턴가의 상속권이 이쪽으로 걸어 들어오는군.)"]
    ],
    choices: [
      { t: "🗡️ 복수의 도구로 결혼한다",     next: "rev_tool", fx: { grudge: 1 } },
      { t: "🌷 …진심으로 대해 본다",        next: "rev_heart" }
    ]
  };
  S.rev_tool = {
    bg: "heights_ext", weather: "cloud", mood: "sad", cast: ["isabella"],
    lines: [
      ["n", "모구는 이사벨라 아가씨와 야반도주하듯 결혼했습니다. 사랑 없는 결혼 — 그레인지를 겨눈 칼이었지요."],
      ["isabella", "…여기가 제 새집인가요? 벽난로도 안 때는… 아, 아니에요. 괜찮아요. 사랑만 있다면…"],
      ["n", "그 소식은 그레인지의 아가씨를 병상에 눕혔습니다. 화병인지, 원래 약하던 몸이 꺾인 건지 — 아마 둘 다였겠지요."]
    ],
    next: "r_sick"
  };
  S.rev_heart = {
    bg: "moor", weather: "none", mood: "warm", cast: ["isabella", "mogu"],
    lines: [
      ["n", "처음엔 계산이었을 겁니다. 그런데 이사벨라 아가씨는… 계산이 통하지 않는 분이었어요."],
      ["isabella", "황야 산책은 처음이에요! 어머, 히스꽃! 모구 님, 이것 좀 보세요. 바위 틈에서도 피네요?"],
      ["mogu", "(바위 틈에서도 핀다라. …나더러 들으라는 말은 아니겠지만.)"]
    ],
    choices: [
      { t: "🏡 이 온기에 정착한다",                 next: "end_solace" },
      { t: "🌑 …그래도 마음은 캣서린뿐이다",        next: "rev_tool2" }
    ]
  };
  S.rev_tool2 = {
    bg: "heights_ext", weather: "rain", mood: "sad", cast: ["isabella"],
    lines: [
      ["n", "온기를 등지는 데는 한순간이면 충분했습니다. 모구의 눈은 다시 그레인지 쪽 하늘만 보았지요."],
      ["isabella", "…당신이 보는 건 늘 창밖이군요. 저는 한 번도 그 눈에 담긴 적이 없고요."],
      ["n", "그 무렵, 그레인지에서 급한 전갈이 왔습니다 — 아가씨가 몸져누웠다고요."]
    ],
    next: "r_sick"
  };
  S.r_sick = {
    bg: "grange", weather: "rain", mood: "sad", cast: ["cat"],
    lines: [
      ["n", "봄이 오기 전, 아가씨는 눈에 띄게 야위어 갔습니다. 에드거 몰래, 나는 모구를 병실로 들였지요. …그게 마지막이 될 줄 알면서도요."],
      ["cat", "왔구나. …화내지 마, 그런 얼굴로. 나 지금 싸울 힘도 없단 말이야."],
      ["cat", "모구. 내가 죽어도 황야에 있을게. 바람이 세게 부는 날엔… 그거, 나야."]
    ],
    choices: [
      { t: "💢 원망을 쏟아낸다",           next: "sick_hate", fx: { grudge: 2 } },
      { t: "💛 사랑만을 말한다",           next: "sick_love" },
      { t: "🌄 함께 도망치자고 한다",      next: "sick_flee" }
    ]
  };
  S.sick_hate = {
    bg: "grange", weather: "storm", mood: "storm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "왜 나를 버렸어! 격이 떨어진다고 말한 그 입으로, 이제 와서 황야에 있겠다고? 너는… 너는 스스로를 죽인 거야, 캣서린!"],
      ["cat", "…그래. 맞아. 그러니까 용서하지 마. 대신… 잊지도 마. 그게 내 벌이고, 네 벌이야."],
      ["n", "그날 밤 아가씨는 숨을 거두었습니다. 창밖에는 때아닌 폭풍 — 그리고 모구의 귀에는, 그날부터 창을 두드리는 소리가 들리기 시작했다고 합니다."]
    ],
    next: "ghost_1"
  };
  S.ghost_1 = {
    bg: "night", weather: "storm", mood: "storm", cast: ["ghost"],
    lines: [
      ["ghost", "…들여보내 줘… 모구… 창을 열어 줘… 황야가 추워…"],
      ["mogu", "(환청인가. 아니면 정말 그 애인가. 창을 열면 빗줄기뿐 — 닫으면 다시 두드리는 소리.)"],
      ["n", "모구는 밤마다 야위어 갔습니다. 언덕의 주인이 되었지만, 잠은 그 어느 하인보다 얕았지요."]
    ],
    choices: [
      { t: "🍾 술에 빠져든다",             next: "end_wreck" },
      { t: "👻 유령을 쫓아 황야로 나간다", next: "end_blizzard" }
    ]
  };
  S.sick_love = {
    bg: "grange", weather: "none", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "…원망하러 온 게 아니야. 고맙다고 하러 왔어. 부둣가 상자 뒤의 나를 세상으로 꺼내 준 건 츄르 반 개였다고."],
      ["cat", "…바보. 그 얘길 지금 하면… 나 못 가잖아."],
      ["mogu", "가도 돼. 바람이 되어도, 히스꽃이 되어도, 나는 알아볼 수 있어. 약속해."],
      ["n", "아가씨는 웃으며 눈을 감았습니다. 창밖에는 폭풍 대신, 그해 첫 히스꽃 바람이 불었지요."]
    ],
    next: "gen2_1"
  };
  S.sick_flee = {
    bg: "moor_night", weather: "storm", mood: "storm", cast: ["cat", "mogu"],
    lines: [
      ["mogu", "이런 데서 못 보내. 담요 챙겼어. 마차도 아래 세워 뒀고. — 가자, 지금."],
      ["cat", "…정말 너답다. 좋아… 마지막으로, 우리 바위까지만."],
      ["n", "빗속의 탈출이었습니다. 그러나 페니스톤 바위에 닿았을 때, 아가씨의 손은 이미 바람보다 가벼웠지요."]
    ],
    next: "end_star"
  };

  /* ════════════ 5부 — 2세대 ════════════ */

  S.gen2_1 = {
    bg: "heights_ext", weather: "snow", mood: "sad", cast: ["hareton", "cathy", "linton"],
    lines: [
      ["n", "세월이 흘렀습니다. 힌들리는 빈 술병 곁에서 생을 마쳤고, 그의 아들 헤어턴은 — 옛날의 모구처럼 — 언덕의 하인으로 자랐지요."],
      ["n", "아가씨가 남긴 딸 캐시, 이사벨라가 남기고 간 병약한 린턴까지. 언덕과 그레인지의 아이들은 전부 모구의 손아귀 안에서 자랐습니다."],
      ["mogu", "(저택 두 채, 목초지, 문서 전부. 복수의 판은 다 짜였다. 남은 건 마지막 한 수뿐.)"]
    ],
    next: "gen2_2"
  };
  S.gen2_2 = {
    bg: "hall", weather: "none", mood: "warm", cast: ["hareton", "cathy"],
    lines: [
      ["n", "그러던 어느 봄날이었습니다. 부엌 창 너머 — 캐시가 헤어턴에게 글자를 가르쳐 주고 있었어요."],
      ["cathy", "아니, 'ㅊ' 다음에 'ㅠ'! 츄-르. 자, 다시. 이걸 읽어야 간식 창고를 열지!"],
      ["hareton", "츄…르. …웃지 마! 처음 배우는 거란 말이야!"],
      ["mogu", "(…저 등을 안다. 흙투성이 손을 부끄러워하던 등. 그 옆에서 웃던 목소리도. — 저건, 나와 캣서린이잖아.)"]
    ],
    choices: [
      { t: "🌪️ 흔들리지 않는다 — 복수를 끝까지", next: "end_avatar" },
      { t: "🕊️ …모든 것을 놓아버린다",           next: "gen2_release" },
      { t: "🎒 재산을 아이들에게 주고 떠난다",    next: "end_wanderer" }
    ]
  };
  S.gen2_release = {
    bg: "moor_sunset", weather: "none", mood: "sad", cast: ["nelly", "mogu"],
    lines: [
      ["n", "그날 이후 모구는 변했습니다. 장부를 덮고, 소송 서류를 태우고, 며칠씩 황야를 걸었어요."],
      ["mogu", "이상하지, 넬리 꼬꼬. 원수들의 얼굴 위로 자꾸 그 애 얼굴이 겹쳐. 복수가 손끝에서 모래처럼 새 나가."],
      ["n", "그리고 요즘 모구는 밤마다 창가에 서 있습니다. 무언가를… 아니, 누군가를 기다리는 사람처럼요."]
    ],
    choices: [
      { t: "👻 창가의 그 애를 따라간다",     next: "end_ghost" },
      { t: "🌸 남은 아이들을 축복한다",      next: "end_afterstorm" }
    ]
  };

  /* ════════════ 엔딩 에필로그 노드 ════════════ */

  S.end_spring = {
    bg: "moor", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["n", "이듬해 봄, 언덕 저택의 문에는 두 이름이 나란히 걸렸습니다. 힌들리는 투덜대면서도 장부 덕에 도박을 끊었다나요."],
      ["cat", "모구! 바위까지 경주야. 지는 쪽이 오늘 저녁 츄르 당번!"],
      ["mogu", "언제나처럼 — 내가 이겨도 츄르는 반씩이야."],
      ["n", "황야의 히스꽃은 그해 유난히 흐드러졌답니다."]
    ],
    ending: "spring"
  };
  S.end_peace = {
    bg: "hall", weather: "none", mood: "warm", cast: ["cat", "edgar", "hindley"],
    lines: [
      ["n", "언덕과 그레인지 사이에 처음으로 '왕래'라는 것이 생겼습니다. 두 저택이 한 식탁에 앉는 날이 오다니요."],
      ["edgar", "…솔직히 당신이 두려웠소, 모구 씨. 하지만 당신은 복수 대신 더 어려운 걸 해냈군요."],
      ["mogu", "캣서린이 사랑한 세계를 부수지 않는 것 — 그게 내 남은 사랑의 방식이었을 뿐이야."],
      ["n", "모구는 언덕의 주인으로, 두 집안의 다리로 늙어 갔습니다. 황야의 바람은 여전히 세찼지만, 더는 아무도 춥지 않았지요."]
    ],
    ending: "peace"
  };
  S.end_tycoon = {
    bg: "liverpool", weather: "none", mood: "warm", cast: ["boss", "mogu"],
    lines: [
      ["n", "10년 뒤, 리버풀 부두에서 '모구 상회'의 깃발을 모르는 뱃사람은 없었습니다."],
      ["boss", "부둣가 상자 뒤에서 주워졌다는 소문이 사실인가, 회장?"],
      ["mogu", "사실이지. 그래서 우리 상회 창고엔 비 젖은 떠돌이가 몸을 말릴 난로가 꼭 있는 거고."],
      ["n", "북쪽 언덕의 이름은 이제 아프지 않은 옛날이야기 — 가끔 히스꽃 차를 마실 때만 잠깐 바람 냄새가 났답니다."]
    ],
    ending: "tycoon"
  };
  S.end_captain = {
    bg: "sea", weather: "none", mood: "warm", cast: ["mogu"],
    lines: [
      ["n", "선장 모구의 그림자호는 일곱 바다를 건넜습니다. 폭풍이 오면 선원들은 오히려 안심했다지요 — 우리 선장은 폭풍 출신이라고."],
      ["mogu", "(캣서린. 너는 황야가 세상 전부라고 했지. 아니야 — 세상은 이렇게 넓었어. 언젠가 항구에서 만나면 얘기해 줄게.)"],
      ["n", "수평선 너머로 노을이 지면, 선장실 창가엔 히스꽃 말린 것이 한 줌 놓여 있었습니다."]
    ],
    ending: "captain"
  };
  S.end_afterstorm = {
    bg: "moor_sunset", weather: "none", mood: "warm", cast: ["hareton", "cathy", "mogu"],
    lines: [
      ["n", "모구는 헤어턴을 하인에서 상속인으로 되돌리고, 캐시와의 혼약을 축복했습니다. 언덕의 문서는 원래 주인의 아들에게 돌아갔지요."],
      ["hareton", "왜… 왜 저한테 잘해 주시는 겁니까. 절 짓밟은 게 당신인데."],
      ["mogu", "짓밟힌 애가 어떻게 자라는지 아는 사람이 나뿐이라서야. …그 애랑 행복해라. 그게 명령이다."],
      ["n", "이듬해 봄 결혼식 날, 모구는 페니스톤 바위에 혼자 앉아 오래 바람을 맞았습니다. 그 얼굴이 어찌나 평온하던지요."]
    ],
    ending: "afterstorm"
  };
  S.end_seaside = {
    bg: "sea", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["n", "남쪽 바닷가의 공기는 아가씨의 기침을 천천히, 그러나 분명하게 거두어 갔습니다."],
      ["cat", "모구, 오늘은 방파제 끝까지 걸었어! 의사 선생이 기적이래."],
      ["mogu", "기적은 무슨. 넌 원래 황야를 뛰던 애야. 바다 하나쯤이야."],
      ["n", "두 사람은 세상이 잊은 바닷가 마을에서 조용히 늙어 갔습니다. 격이니 저택이니 하는 말은, 파도 소리에 다 씻겨서요."]
    ],
    ending: "seaside"
  };
  S.end_shadows = {
    bg: "moor_sunset", weather: "none", mood: "warm", cast: ["cat", "mogu"],
    lines: [
      ["n", "황야 너머 목양 오두막. 빵은 자주 딱딱했고 겨울은 길었지만 —"],
      ["cat", "모구! 양들이 또 울타리를 넘었어! …풉, 네 얼굴에 검댕 묻었다."],
      ["mogu", "네 웃음소리에 양이 놀라서 넘은 거야. 책임져."],
      ["n", "노을이 지면 언덕 위로 두 그림자가 길게 나란히 눕습니다. 세상에서 가장 가난하고, 가장 부유한 두 그림자가요."]
    ],
    ending: "shadows"
  };
  S.end_wanderer = {
    bg: "moor", weather: "cloud", mood: "sad", cast: ["mogu"],
    lines: [
      ["n", "모구는 문서 전부를 헤어턴과 캐시 앞으로 남기고, 어느 새벽 보따리 하나로 언덕을 떠났습니다."],
      ["mogu", "(저택도 복수도 무겁기만 하더라. 이 바람 — 이건 가볍네, 캣서린.)"],
      ["n", "이후로 황야 목동들 사이엔 이런 말이 돕니다. 히스꽃 필 무렵 바위 위에서 낮잠 자는 늙은 나그네 고양이를 보면, 츄르를 반만 나눠 주라고요. 꼭 반만."]
    ],
    ending: "wanderer"
  };
  S.end_solace = {
    bg: "heights_ext", weather: "none", mood: "warm", cast: ["isabella", "mogu"],
    lines: [
      ["n", "복수의 칼로 시작된 결혼은, 이상하게도 벽난로처럼 미지근하고 오래가는 것이 되었습니다."],
      ["isabella", "정원에 히스를 옮겨 심었어요. …당신, 그 꽃 볼 때만 눈빛이 부드러워지길래."],
      ["mogu", "…알고 있었나. (이 사람은 내 폭풍을 다 알면서 곁에 있는 거였군.)"],
      ["n", "첫사랑의 자리는 비워 둔 채로도, 사람은 온기 곁에서 살아지는 법입니다. 모구는 그걸 이사벨라에게 배웠지요."]
    ],
    ending: "solace"
  };
  S.end_farewell = {
    bg: "liverpool", weather: "rain", mood: "sad", cast: ["mogu"],
    lines: [
      ["n", "모구는 그레인지에 다시는 발을 들이지 않았습니다. 남행 마차 창밖으로 언덕이 멀어질 때, 딱 한 번 돌아보았을 뿐."],
      ["mogu", "(잘 있어, 캣서린. 네가 지키고 싶다던 것들이 부디 그럴 가치가 있기를.)"],
      ["n", "리버풀의 상회는 번창했습니다. 다만 회장실 창은 늘 북쪽으로 나 있었고, 히스꽃 피는 계절엔 며칠씩 닫혀 있었다지요."]
    ],
    ending: "farewell"
  };
  S.end_ghost = {
    bg: "night", weather: "storm", mood: "storm", cast: ["ghost", "mogu"],
    lines: [
      ["n", "그 겨울밤, 창 두드리는 소리에 모구는 처음으로 — 창을 활짝 열었습니다."],
      ["ghost", "…이제야 여는구나, 바보야. 황야에서 얼마나 기다렸는데."],
      ["mogu", "미안. 문단속이 심한 집에서 자랐거든. …가자. 바위까지 경주야."],
      ["n", "이튿날 아침, 모구는 창가 의자에서 미소 띤 채 잠들어 깨지 않았습니다. 마을 사람들은 지금도 말합니다 — 폭풍 치는 밤 황야에서 나란히 달리는 두 그림자를 봤다고요."]
    ],
    ending: "ghost"
  };
  S.end_star = {
    bg: "penistone", weather: "stars", mood: "sad", cast: ["cat", "mogu"],
    lines: [
      ["cat", "모구… 봐, 구름이 걷혔어. 별이… 우리가 세던 별이야."],
      ["mogu", "세지 마. 세면 끝나잖아. …캣서린? 캣서린—"],
      ["n", "폭풍이 걷힌 하늘 아래, 아가씨는 약속의 바위 위에서 바람이 되었습니다."],
      ["n", "모구는 그 후로 매년 그날 밤 바위에 올라 별을 셉니다. 끝까지 세지 않고, 꼭 하나를 남겨 두고 내려온다지요."]
    ],
    ending: "star"
  };
  S.end_servant = {
    bg: "barn", weather: "snow", mood: "sad", cast: ["mogu"],
    lines: [
      ["n", "모구는 떠나지 않았습니다. 맞서지도 않았습니다. 그저 마구간과 부엌 사이에서 늙어 갔지요."],
      ["mogu", "(그레인지 마차가 지나간다. 커튼 너머 실루엣… 보지 말자. 하인은 말굽만 보면 돼.)"],
      ["n", "언덕 사람들은 언제부턴가 모구의 목소리를 들은 기억이 없다고 했습니다. 잿빛 그림자처럼 일만 하는 하인 — 그게 그 아이의 남은 평생이 되었습니다."]
    ],
    ending: "servant"
  };
  S.end_ruin = {
    bg: "liverpool", weather: "rain", mood: "storm", cast: ["mogu"],
    lines: [
      ["n", "빈털터리가 된 모구는 부둣가 상자 뒤로 돌아갔습니다. 언쇼 영감님이 처음 주워 올린 바로 그 자리로요."],
      ["mogu", "(한 판만 더 있었으면… 아니, 한 판만 덜 했으면. 크크… 힌들리, 네가 이런 기분이었냐.)"],
      ["n", "복수하려던 자의 몰락을 가장 닮아 버린 몰락이었습니다. 언덕에는 끝내 소식 한 줄 닿지 않았지요."]
    ],
    ending: "ruin"
  };
  S.end_wreck = {
    bg: "hall", weather: "rain", mood: "storm", cast: ["mogu"],
    lines: [
      ["n", "언덕의 주인 모구는 힌들리가 앉던 바로 그 의자에서, 힌들리가 마시던 바로 그 술을 마셨습니다."],
      ["mogu", "(창 두드리는 소리는 술로만 멎는다. …이 의자, 이렇게 편했던 거냐, 힌들리.)"],
      ["n", "복수의 끝에서 원수의 삶을 그대로 물려받는 것 — 황야의 신은 가장 잔인한 형벌을 골랐습니다. 저택은 다시 웃음소리를 잃었지요."]
    ],
    ending: "wreck"
  };
  S.end_blizzard = {
    bg: "moor_night", weather: "snow", mood: "storm", cast: ["ghost", "mogu"],
    lines: [
      ["n", "눈보라 치던 밤, 모구는 외투도 없이 황야로 뛰쳐나갔습니다. 목소리가 부른다면서요."],
      ["mogu", "캣서린! 어디야! 바위야? 골짜기야? 부르지만 말고 기다리라고—!"],
      ["n", "사흘 뒤, 목동들이 페니스톤 바위 아래에서 모구를 찾았습니다. 눈 속에 잠든 그 얼굴은… 화가 난 듯도, 마침내 안도한 듯도 했다고 합니다."]
    ],
    ending: "blizzard"
  };
  S.end_tempest = {
    bg: "moor_night", weather: "storm", mood: "storm", cast: ["cat"],
    lines: [
      ["n", "사흘 뒤 늪지 가장자리에서 모구의 목도리만 발견되었습니다. 아가씨는 그날부터 폭풍만 치면 창을 열어 두는 버릇이 생겼지요."],
      ["cat", "…돌아와, 모구. 격이니 뭐니 다 취소할게. 바위에서 부르면 온다고 약속했잖아…"],
      ["n", "약속의 바위는 그 뒤로 오래, 아주 오래 비어 있었습니다."]
    ],
    ending: "tempest"
  };
  S.end_avatar = {
    bg: "heights_ext", weather: "storm", mood: "storm", cast: ["mogu"],
    lines: [
      ["n", "모구는 흔들리지 않았습니다. 캐시와 린턴을 강제로 혼인시켜 그레인지마저 삼켰고, 헤어턴에게선 글자마저 빼앗았지요."],
      ["mogu", "(두 저택, 전 재산, 원수의 핏줄 전부 내 발밑에. 이겼다. 완벽하게. ……그런데 왜, 아무 맛도 나지 않지?)"],
      ["n", "거대한 저택의 거대한 식탁에서 모구는 혼자 식사를 합니다. 창밖 황야에서 부르는 소리가 나도 — 이제는 돌아보는 법조차 잊었습니다."],
      ["n", "복수는 완성되었고, 복수만이 남았습니다."]
    ],
    ending: "avatar"
  };

  // 시뮬레이션 테스트용 노출
  NS.STORY_KEYS = Object.keys(S);
})();
