// board.js — 모구의 마블 보드 데이터 (24칸 · 성남/수원/원주 유명 지역) + 황금열쇠 카드
// 금액 단위: 만 (부루마블 감각). window.MBL 네임스페이스.
var M = window.MBL;

M.START_MONEY = 2000;              // 시작 자금
M.SALARY = 200;                    // 출발지 통과 월급
M.ESCAPE_FEE = 150;                // 무인도 탈출비
M.ISLAND_TURNS = 3;                // 무인도 최대 대기 턴
M.MAX_ROUNDS = 30;                 // 라운드 제한 → 초과 시 총자산 1위 승리
M.CITY_WIN = 8;                    // 한 도시에서 이만큼 소유 = 도시 제패 즉시 승리
M.UP_COST = 0.6;                   // 업그레이드 비용 = 땅값 × 0.6 (레벨당)
M.TAKEOVER_MUL = 2;                // 인수 비용 = (땅값+투자금) × 2
M.SELL_RATE = 0.6;                 // 파산 청산 환급률
M.TOLL_MUL = [0.35, 1.0, 2.5, 5.0];// 레벨별 통행료 배율 (땅/별장/빌딩/호텔)
M.LV_NAME = ['땅', '별장', '빌딩', '호텔'];

// 도시 (애니메이션 톤 비비드 컬러)
M.CITIES = {
  wonju:    { name: '원주', color: 0x37b24d, css: '#37b24d' },
  seongnam: { name: '성남', color: 0xff922b, css: '#ff922b' },
  suwon:    { name: '수원', color: 0xf03e3e, css: '#f03e3e' },
};

// kind: start | island | festival | express | key | city
// 한 변 12칸 × 4 = 48칸. 코너 0/12/24/36, 황금열쇠 8칸, 도시 3곳 × 12지역
M.TILES = [
  { kind: 'start',    name: '출발',            emoji: '🏁' },                       // 0
  { kind: 'city', city: 'wonju',    name: '원주역',          price: 60 },           // 1
  { kind: 'city', city: 'wonju',    name: '원주 중앙시장',   price: 80 },           // 2
  { kind: 'city', city: 'wonju',    name: '반계리 은행나무', price: 90 },           // 3
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 4
  { kind: 'city', city: 'wonju',    name: '박경리 문학공원', price: 110 },          // 5
  { kind: 'city', city: 'wonju',    name: '강원감영',        price: 120 },          // 6
  { kind: 'city', city: 'wonju',    name: '한지 테마파크',   price: 140 },          // 7
  { kind: 'city', city: 'wonju',    name: '구룡사',          price: 150 },          // 8
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 9
  { kind: 'city', city: 'wonju',    name: '치악산',          price: 170 },          // 10
  { kind: 'city', city: 'wonju',    name: '간현관광지',      price: 190 },          // 11
  { kind: 'island',   name: '동화의료기기 산업단지', emoji: '🏭' },                  // 12 (원주 문막 — 3턴 발묶임)
  { kind: 'city', city: 'wonju',    name: '소금산 출렁다리', price: 210 },          // 13
  { kind: 'city', city: 'wonju',    name: '뮤지엄 산',       price: 230 },          // 14
  { kind: 'city', city: 'wonju',    name: '원주 혁신도시',   price: 240 },          // 15
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 16
  { kind: 'city', city: 'seongnam', name: '모란시장',        price: 260 },          // 17
  { kind: 'city', city: 'seongnam', name: '탄천',            price: 280 },          // 18
  { kind: 'city', city: 'seongnam', name: '야탑역',          price: 300 },          // 19
  { kind: 'city', city: 'seongnam', name: '율동공원',        price: 310 },          // 20
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 21
  { kind: 'city', city: 'seongnam', name: '남한산성',        price: 330 },          // 22
  { kind: 'city', city: 'seongnam', name: '성남 아트센터',   price: 350 },          // 23
  { kind: 'festival', name: '모구 축제',       emoji: '🎪' },                       // 24
  { kind: 'city', city: 'seongnam', name: '서현역',          price: 370 },          // 25
  { kind: 'city', city: 'seongnam', name: '분당 중앙공원',   price: 380 },          // 26
  { kind: 'city', city: 'seongnam', name: '위례신도시',      price: 400 },          // 27
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 28
  { kind: 'city', city: 'seongnam', name: '정자동 카페거리', price: 410 },          // 29
  { kind: 'city', city: 'seongnam', name: '백현동 카페거리', price: 420 },          // 30
  { kind: 'city', city: 'seongnam', name: '판교 테크노밸리', price: 440 },          // 31
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 32
  { kind: 'city', city: 'suwon',    name: '수원역',          price: 460 },          // 33
  { kind: 'city', city: 'suwon',    name: '지동시장',        price: 480 },          // 34
  { kind: 'city', city: 'suwon',    name: '팔달문',          price: 500 },          // 35
  { kind: 'express',  name: '모구 특급열차',   emoji: '🚂' },                       // 36
  { kind: 'city', city: 'suwon',    name: '인계동',          price: 520 },          // 37
  { kind: 'city', city: 'suwon',    name: '수원 월드컵경기장', price: 540 },        // 38
  { kind: 'city', city: 'suwon',    name: '화성행궁',        price: 560 },          // 39
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 40
  { kind: 'city', city: 'suwon',    name: '장안문',          price: 580 },          // 41
  { kind: 'city', city: 'suwon',    name: '행리단길',        price: 600 },          // 42
  { kind: 'city', city: 'suwon',    name: '나혜석거리',      price: 620 },          // 43
  { kind: 'city', city: 'suwon',    name: '광교산',          price: 640 },          // 44
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 45
  { kind: 'city', city: 'suwon',    name: '광교 호수공원',   price: 660 },          // 46
  { kind: 'city', city: 'suwon',    name: '수원화성',        price: 700 },          // 47
];
M.SIZE = M.TILES.length;           // 48
M.ISLAND_IDX = 12;                 // 무인도 칸 (더블 3연속·카드 이동 목적지)

// 황금열쇠 카드 (효과는 logic.js _drawCard)
M.CARDS = [
  { id: 'lotto',   name: '츄르 복권 당첨!',        desc: '은행에서 300만을 받는다',            money: 300 },
  { id: 'refund',  name: '세금 환급',              desc: '은행에서 150만을 받는다',            money: 150 },
  { id: 'vet',     name: '동물병원 진료비',        desc: '150만을 은행에 낸다',                money: -150 },
  { id: 'repair',  name: '캣타워 수리비',          desc: '100만을 은행에 낸다',                money: -100 },
  { id: 'gift',    name: '집사들의 선물',          desc: '다른 플레이어 모두에게 50만씩 받는다', gift: 50 },
  { id: 'tostart', name: '집으로!',                desc: '출발지로 이동하고 월급을 받는다',    goto: 'start' },
  { id: 'island',  name: '공장 견학 초대장',       desc: '동화의료기기산업단지로 이동한다',    goto: 'island' },
  { id: 'chiak',   name: '치악산 등반',            desc: '치악산으로 이동한다',                goto: 10 },
  { id: 'back3',   name: '깜빡 낮잠',              desc: '뒤로 3칸 이동한다',                  back: 3 },
  { id: 'salary',  name: '보너스 월급날',          desc: '은행에서 200만을 받는다',            money: 200 },
  { id: 'pangyo',  name: '판교 출장',              desc: '판교 테크노밸리로 이동한다',         goto: 31 },
  { id: 'hwaseong',name: '수원 나들이',            desc: '수원화성으로 이동한다',              goto: 47 },
  { id: 'treat',   name: '츄르 쏘기',              desc: '다른 플레이어 모두에게 30만씩 준다',  gift: -30 },
  { id: 'fwd5',    name: '신나는 산책',            desc: '앞으로 5칸 이동한다',                fwd: 5 },
];

// 플레이어 캐릭터 4종 (토큰 색 = 애니메이션 톤)
M.CHARS = [
  { key: 'mogu', name: '모구', emoji: '🐱', color: 0xe8453c, css: '#e8453c' },
  { key: 'kko',  name: '꼬꼬', emoji: '🐔', color: 0x3d6fe0, css: '#3d6fe0' },
  { key: 'jjik', name: '찍찍', emoji: '🐭', color: 0xf2a93b, css: '#f2a93b' },
  { key: 'mong', name: '몽이', emoji: '🐶', color: 0x43b649, css: '#43b649' },
];

// ── 난이도 4단계 (모구 시리즈 공통 문법) — 컴퓨터 플레이어에게만 적용 ──
// aiSmart: 최적 판단 확률 / aiReserve: 지출 후 남길 여유 자금 배율 (낮을수록 공격적) /
// aiMoney: 컴퓨터 시작 자금 배율
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     aiSmart: 0.55, aiReserve: 1.5,  aiMoney: 0.85 },
  normal: { name: '노말',     aiSmart: 0.80, aiReserve: 1.0,  aiMoney: 1.0 },
  hard:   { name: '하드',     aiSmart: 0.95, aiReserve: 0.75, aiMoney: 1.15 },
  crazy:  { name: '크레이지', aiSmart: 1.0,  aiReserve: 0.55, aiMoney: 1.35 },
};
M.SAVE_KEY = 'mogumarble.v1';

// 결정적 RNG (mulberry32) — 시뮬 테스트·세이브 복원용 (getState/setState)
M.makeRng = function (seed, state) {
  var s = (state != null ? state : seed) >>> 0;
  var next = function () { s |= 0; s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next: next,
    int: function (n) { return Math.floor(next() * n); },
    die: function () { return 1 + Math.floor(next() * 6); },
    chance: function (p) { return next() < p; },
    getState: function () { return s; },
  };
};
