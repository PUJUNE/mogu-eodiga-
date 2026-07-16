// board.js — 모구의 마블 보드 데이터 + 지명 모드 2종 (성남·원주·수원 / 하와이 북클럽)
// 금액 단위: 만 (부루마블 감각). window.MBL 네임스페이스.
// 골격은 두 모드 공통: 48칸 · 코너 0/12/24/36 · 도시칸 3색 그룹 · 나머지 황금열쇠.
var M = window.MBL;

// ── 모드 공통 상수 (규칙·경제) ──
M.START_MONEY = 2000;              // 시작 자금
M.SALARY = 200;                    // 출발지 통과 월급
M.ESCAPE_FEE = 150;                // 발묶임 탈출비
M.ISLAND_TURNS = 3;                // 발묶임 최대 대기 턴
M.MAX_ROUNDS = 30;                 // 라운드 제한 → 초과 시 총자산 1위 승리
M.UP_COST = 0.6;                   // 업그레이드 비용 = 땅값 × 0.6 (레벨당)
M.TAKEOVER_MUL = 2;                // 인수 비용 = (땅값+투자금) × 2
M.SELL_RATE = 0.6;                 // 파산 청산 환급률
M.TOLL_MUL = [0.35, 1.0, 2.5, 5.0];// 레벨별 통행료 배율 (땅/별장/빌딩/호텔)
M.LV_NAME = ['땅', '별장', '빌딩', '호텔'];

// ══════════════════════════════════════════════════════════════════
//  모드 A — 성남 · 원주 · 수원 (원작)
// ══════════════════════════════════════════════════════════════════
var MODE_MOGU = {
  key: 'mogu',
  label: '성남·원주·수원',
  saveKey: 'mogumarble.v1',
  cityWin: 8,
  islandIdx: 12,
  cities: {
    wonju:    { name: '원주', color: 0x37b24d, css: '#37b24d' },
    seongnam: { name: '성남', color: 0xff922b, css: '#ff922b' },
    suwon:    { name: '수원', color: 0xf03e3e, css: '#f03e3e' },
  },
  logo: { title: '모구의 마블', sub: '성남 · 수원 · 원주' },
  theme: { islandEmoji: '🏭', festivalEmoji: '🎪', expressEmoji: '🚂',
           tagline: '모구의 마블 — 성남·수원·원주를 접수하라!' },
  ui: {
    logo: '모구의 마블',
    sub: 'MOGU MARBLE · 성남 × 수원 × 원주',
    icon: '🐱🎲',
    info:
      '부루마블 · 모두의 마블 모티브 3D 보드게임! (48칸 · 도시별 명소 12곳)<br>' +
      '주사위를 굴려 <b>성남·수원·원주의 명소</b>를 사들이고 별장→빌딩→호텔을 지어요.<br>' +
      '<b>한 도시 8곳 제패 = 즉시 승리!</b> 통행료로 상대를 파산시켜도 승리!<br>' +
      '🎪 축제 = 통행료 ×2 · 🔑 황금열쇠 · 🏭 산업단지(3턴 발묶임) · 🤝 남의 땅 인수 · 더블은 한 번 더<br>' +
      '🎥 드래그 = 회전 · 우클릭/Shift 드래그 · 두 손가락 = 시점 이동 · 휠/핀치 = 줌',
  },
  // kind: start | island | festival | express | key | city
  tiles: [
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
    { kind: 'island',   name: '동화의료기기 산업단지', emoji: '🏭' },                  // 12
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
  ],
  cards: [
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
  ],
};

// ══════════════════════════════════════════════════════════════════
//  모드 B — 하와이 북클럽 방문장소 (2022~2026 실제 모임 30곳)
//  3색 그룹 = 시기순 (초기 2022~23 · 중기 2024 · 최근 2025~26).
//  실장소만 사용 → 그룹 크기 비대칭(10/7/13), 남는 도시칸은 황금열쇠(북클럽 이벤트)로 흡수.
// ══════════════════════════════════════════════════════════════════
var MODE_HAWAII = {
  key: 'hawaii',
  label: '하와이 북클럽',
  saveKey: 'mogumarble.v1.hawaii',
  cityWin: 8,
  islandIdx: 12,
  cities: {
    eraA: { name: '2022–23', color: 0x1098ad, css: '#1098ad' },
    eraB: { name: '2024',    color: 0xf59f00, css: '#f59f00' },
    eraC: { name: '2025–26', color: 0x9c36b5, css: '#9c36b5' },
  },
  logo: { title: '하와이 마블', sub: '독서모임 방문장소' },
  theme: { islandEmoji: '🏝️', festivalEmoji: '🎄', expressEmoji: '🎬',
           tagline: '하와이 마블 — 독서모임이 다녀간 장소를 접수하라!' },
  // 컴퓨터 상대 후보 (하와이 북클럽 전용) — 이 중 3명을 골라 모구의 상대로.
  opponents: ['석준', '형섭', '연지', '상훈', '지원'],
  ui: {
    logo: '하와이 마블',
    sub: 'HAWAII BOOKCLUB · 2022 × 2024 × 2026',
    icon: '📚🎲',
    info:
      '하와이 독서모임 방문장소로 즐기는 3D 마블! (2022~2026 · 실제 모임 30곳)<br>' +
      '주사위를 굴려 <b>독서모임이 다녀간 장소</b>를 사들이고 별장→빌딩→호텔을 지어요.<br>' +
      '<b>한 시기 명소를 제패하면 즉시 승리!</b> 통행료로 상대를 파산시켜도 승리!<br>' +
      '🎄 송년회 = 통행료 ×2 · 🔑 북클럽 이벤트 · 🏝️ 휴회(3턴 발묶임) · 🤝 남의 땅 인수 · 더블은 한 번 더<br>' +
      '🎥 드래그 = 회전 · 우클릭/Shift 드래그 · 두 손가락 = 시점 이동 · 휠/핀치 = 줌',
  },
  tiles: [
    { kind: 'start',    name: '첫 모임',          emoji: '🏁' },                       // 0
    { kind: 'city', city: 'eraA', name: '손기정 도서관',    price: 60 },              // 1
    { kind: 'city', city: 'eraA', name: '잠원 한강공원',    price: 70 },              // 2
    { kind: 'city', city: 'eraA', name: '남산 피크닉',      price: 80 },              // 3
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 4
    { kind: 'city', city: 'eraA', name: '경동1960 스벅',    price: 90 },              // 5
    { kind: 'city', city: 'eraA', name: '수원 여민각',      price: 110 },             // 6
    { kind: 'city', city: 'eraA', name: '서울숲',           price: 120 },             // 7
    { kind: 'city', city: 'eraA', name: '강남역',           price: 140 },             // 8
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 9
    { kind: 'city', city: 'eraA', name: '코엑스 메가박스',  price: 150 },             // 10
    { kind: 'city', city: 'eraA', name: '덕수궁 돈덕전',    price: 170 },             // 11
    { kind: 'island',   name: '휴회 (모임 없음)', emoji: '🏝️' },                      // 12
    { kind: 'city', city: 'eraA', name: '국립과천과학관',   price: 190 },             // 13
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 14
    { kind: 'city', city: 'eraB', name: '소수책방',         price: 210 },             // 15
    { kind: 'city', city: 'eraB', name: '커피한약방',       price: 230 },             // 16
    { kind: 'city', city: 'eraB', name: '아시아문화전당',   price: 250 },             // 17
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 18
    { kind: 'city', city: 'eraB', name: '마이아트뮤지엄',   price: 270 },             // 19
    { kind: 'city', city: 'eraB', name: '과천과학관',       price: 290 },             // 20
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 21
    { kind: 'city', city: 'eraB', name: '창경궁',           price: 310 },             // 22
    { kind: 'city', city: 'eraB', name: '봉은사',           price: 330 },             // 23
    { kind: 'festival', name: '송년 책 교환회',   emoji: '🎄' },                       // 24
    { kind: 'city', city: 'eraC', name: '국립중앙박물관',   price: 350 },             // 25
    { kind: 'city', city: 'eraC', name: '용산 CGV 4DX',     price: 370 },             // 26
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 27
    { kind: 'city', city: 'eraC', name: '과천식물원',       price: 390 },             // 28
    { kind: 'city', city: 'eraC', name: '후암거실',         price: 410 },             // 29
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 30
    { kind: 'city', city: 'eraC', name: '로봇AI과학관',     price: 430 },             // 31
    { kind: 'city', city: 'eraC', name: '화폐박물관',       price: 450 },             // 32
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 33
    { kind: 'city', city: 'eraC', name: 'DDP 바스키아전',   price: 470 },             // 34
    { kind: 'city', city: 'eraC', name: '왕십리 신년회',    price: 490 },             // 35
    { kind: 'express',  name: '번외 모임',        emoji: '🎬' },                       // 36
    { kind: 'city', city: 'eraC', name: '남서울미술관',     price: 510 },             // 37
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 38
    { kind: 'city', city: 'eraC', name: '정독도서관',       price: 530 },             // 39
    { kind: 'city', city: 'eraC', name: '장교숙소 5단지',   price: 560 },             // 40
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 41
    { kind: 'city', city: 'eraC', name: '이케아 광명점',    price: 600 },             // 42
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 43
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 44
    { kind: 'city', city: 'eraC', name: '왕십리 CGV',       price: 650 },             // 45
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 46
    { kind: 'key',      name: '북클럽 이벤트',    emoji: '🔑' },                       // 47
  ],
  cards: [
    { id: 'lotto',   name: '서점 상품권 당첨!',      desc: '은행에서 300만을 받는다',            money: 300 },
    { id: 'refund',  name: '모임비 환급',            desc: '은행에서 150만을 받는다',            money: 150 },
    { id: 'late',    name: '지각 벌금',              desc: '150만을 은행에 낸다',                money: -150 },
    { id: 'book',    name: '이달의 책 구입',         desc: '100만을 은행에 낸다',                money: -100 },
    { id: 'gift',    name: '회원들의 선물',          desc: '다른 플레이어 모두에게 50만씩 받는다', gift: 50 },
    { id: 'tostart', name: '첫 모임으로!',           desc: '첫 모임 자리로 이동하고 월급을 받는다', goto: 'start' },
    { id: 'island',  name: '이달은 휴회',            desc: '휴회 칸으로 이동한다',               goto: 'island' },
    { id: 'museum',  name: '전시 관람',              desc: '국립중앙박물관으로 이동한다',        goto: 25 },
    { id: 'back3',   name: '깜빡 지각',              desc: '뒤로 3칸 이동한다',                  back: 3 },
    { id: 'salary',  name: '개근 보너스',            desc: '은행에서 200만을 받는다',            money: 200 },
    { id: 'movie',   name: '번외 영화 모임',         desc: '용산 CGV로 이동한다',                goto: 26 },
    { id: 'garden',  name: '정원 산책 정모',         desc: '과천식물원으로 이동한다',            goto: 28 },
    { id: 'treat',   name: '커피 쏘기',              desc: '다른 플레이어 모두에게 30만씩 준다',  gift: -30 },
    { id: 'walk',    name: '산책 모임',              desc: '앞으로 5칸 이동한다',                fwd: 5 },
  ],
};

// ── 모드 레지스트리 + 적용 ──
M.MODES = { mogu: MODE_MOGU, hawaii: MODE_HAWAII };
M.MODE_ORDER = ['mogu', 'hawaii'];

// 선택 모드의 지명 데이터셋을 M의 평면 별칭에 반영 (렌더·로직·UI가 참조하는 진입점)
M.applyMode = function (key) {
  var mode = M.MODES[key] || M.MODES.mogu;
  M.MODE = mode;
  M.MODE_KEY = mode.key;
  M.CITIES = mode.cities;
  M.TILES = mode.tiles;
  M.CARDS = mode.cards;
  M.SIZE = mode.tiles.length;
  M.ISLAND_IDX = mode.islandIdx;
  M.CITY_WIN = mode.cityWin;
  M.LOGO = mode.logo;
  M.THEME = mode.theme;
  M.SAVE_KEY = mode.saveKey;
  M.OPPONENTS = mode.opponents || null;        // 상대 이름 후보 (없으면 캐릭터 기본명 사용)
  return mode;
};

// 플레이어 캐릭터 4종 (모드 공통)
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

// 기본 모드 적용 (성남·원주·수원)
M.applyMode('mogu');
