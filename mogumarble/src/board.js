// board.js — 모구의 마블 보드 데이터 (24칸 · 성남/수원/원주 유명 지역) + 황금열쇠 카드
// 금액 단위: 만 (부루마블 감각). window.MBL 네임스페이스.
var M = window.MBL;

M.SIZE = 24;                       // 보드 한 바퀴 칸 수 (한 변 6칸 × 4)
M.START_MONEY = 1500;              // 시작 자금
M.SALARY = 200;                    // 출발지 통과 월급
M.ESCAPE_FEE = 150;                // 무인도 탈출비
M.ISLAND_TURNS = 3;                // 무인도 최대 대기 턴
M.MAX_ROUNDS = 25;                 // 라운드 제한 → 초과 시 총자산 1위 승리
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
M.TILES = [
  { kind: 'start',    name: '출발',            emoji: '🏁' },                       // 0
  { kind: 'city', city: 'wonju',    name: '원주역',          price: 80 },           // 1
  { kind: 'city', city: 'wonju',    name: '강원감영',        price: 100 },          // 2
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 3
  { kind: 'city', city: 'wonju',    name: '한지테마파크',    price: 120 },          // 4
  { kind: 'city', city: 'wonju',    name: '치악산',          price: 150 },          // 5
  { kind: 'island',   name: '무인도',          emoji: '🏝️' },                      // 6
  { kind: 'city', city: 'wonju',    name: '소금산 출렁다리', price: 170 },          // 7
  { kind: 'city', city: 'wonju',    name: '뮤지엄 산',       price: 190 },          // 8
  { kind: 'city', city: 'seongnam', name: '모란시장',        price: 220 },          // 9
  { kind: 'city', city: 'seongnam', name: '야탑역',          price: 240 },          // 10
  { kind: 'city', city: 'seongnam', name: '남한산성',        price: 260 },          // 11
  { kind: 'festival', name: '모구 축제',       emoji: '🎪' },                       // 12
  { kind: 'city', city: 'seongnam', name: '서현역',          price: 290 },          // 13
  { kind: 'city', city: 'seongnam', name: '정자동 카페거리', price: 320 },          // 14
  { kind: 'key',      name: '황금열쇠',        emoji: '🔑' },                       // 15
  { kind: 'city', city: 'seongnam', name: '판교 테크노밸리', price: 360 },          // 16
  { kind: 'city', city: 'suwon',    name: '수원역',          price: 390 },          // 17
  { kind: 'express',  name: '모구 특급열차',   emoji: '🚂' },                       // 18
  { kind: 'city', city: 'suwon',    name: '장안문',          price: 410 },          // 19
  { kind: 'city', city: 'suwon',    name: '행리단길',        price: 430 },          // 20
  { kind: 'city', city: 'suwon',    name: '나혜석거리',      price: 450 },          // 21
  { kind: 'city', city: 'suwon',    name: '광교호수공원',    price: 480 },          // 22
  { kind: 'city', city: 'suwon',    name: '수원화성',        price: 520 },          // 23
];

// 황금열쇠 카드 (효과는 logic.js _applyCard)
M.CARDS = [
  { id: 'lotto',   name: '츄르 복권 당첨!',        desc: '은행에서 300만을 받는다',            money: 300 },
  { id: 'refund',  name: '세금 환급',              desc: '은행에서 150만을 받는다',            money: 150 },
  { id: 'vet',     name: '동물병원 진료비',        desc: '150만을 은행에 낸다',                money: -150 },
  { id: 'repair',  name: '캣타워 수리비',          desc: '100만을 은행에 낸다',                money: -100 },
  { id: 'gift',    name: '집사들의 선물',          desc: '다른 플레이어 모두에게 50만씩 받는다', gift: 50 },
  { id: 'tostart', name: '집으로!',                desc: '출발지로 이동하고 월급을 받는다',    goto: 'start' },
  { id: 'island',  name: '태풍을 만났다…',         desc: '무인도로 이동한다',                  goto: 'island' },
  { id: 'chiak',   name: '치악산 등반',            desc: '치악산으로 이동한다',                goto: 5 },
  { id: 'back3',   name: '깜빡 낮잠',              desc: '뒤로 3칸 이동한다',                  back: 3 },
  { id: 'salary',  name: '보너스 월급날',          desc: '은행에서 200만을 받는다',            money: 200 },
];

// 플레이어 캐릭터 4종 (토큰 색 = 애니메이션 톤)
M.CHARS = [
  { key: 'mogu', name: '모구', emoji: '🐱', color: 0xe8453c, css: '#e8453c' },
  { key: 'kko',  name: '꼬꼬', emoji: '🐔', color: 0x3d6fe0, css: '#3d6fe0' },
  { key: 'jjik', name: '찍찍', emoji: '🐭', color: 0xf2a93b, css: '#f2a93b' },
  { key: 'mong', name: '몽이', emoji: '🐶', color: 0x43b649, css: '#43b649' },
];

// 결정적 RNG (mulberry32) — 시뮬 테스트용
M.makeRng = function (seed) {
  var s = seed >>> 0;
  var next = function () { s |= 0; s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next: next,
    int: function (n) { return Math.floor(next() * n); },
    die: function () { return 1 + Math.floor(next() * 6); },
  };
};
