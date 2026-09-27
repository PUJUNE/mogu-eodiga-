// data.js — 화면 상수 · 재료 · 스테이지 배치 · 난이도
// 참고 영상: 새들이 컨베이어를 따라 반죽→누르기→소 넣기→솔잎 찜으로 송편을 만들고,
// 마지막에 키위가 부리로 송편을 콕 찍는다. 그 공정을 오버쿡식 주방으로 옮겼다.
const M = window.MSP;

// ── 화면 ──
M.TILE = 60;
M.COLS = 16; M.ROWS = 9;
M.HUD = 84;                                  // 상단 주문표 띠 높이
M.W = M.COLS * M.TILE;                       // 960
M.H = M.HUD + M.ROWS * M.TILE;               // 624

// ── 모구 ──
M.PR = 19;                                   // 몸 반지름 (충돌)
M.PSPD = 236;                                // 걷기 속도 px/s
M.DASH_SPD = 560; M.DASH_T = 0.16; M.DASH_CD = 0.7;
M.REACH = 44;                                // 바라보는 방향으로 이만큼 앞 칸을 만진다

// ── 공정 시간(초) ──
M.KNEAD_T = 1.2;                             // 반죽 → 송편피 (도마에서 꾹꾹)
M.FOLD_T = 0.9;                              // 소 넣은 피 → 생송편 (반달 접기)
M.COOK_T = 7;                                // 솔잎 찜
M.BURN_T = 11;                               // 다 익은 뒤 이만큼 더 두면 탄다
M.STEAM_CAP = 3;                             // 찜기 한 대에 들어가는 생송편 수
M.PLATE_CAP = 3;                             // 접시 하나에 담는 송편 수
M.BELT_T = 0.9;                              // 컨베이어가 한 칸 옮기는 시간
M.PECK_T = 2.2;                              // 키위가 송편에 구멍 내는 시간

// ── 재료 ──
M.DOUGHS = {
  white: { name: '흰',    col: '#f6f2e6', edge: '#d8cfb8' },
  ssuk:  { name: '쑥',    col: '#8fae6a', edge: '#6a8a4a' },
  pink:  { name: '분홍',  col: '#f2a9ba', edge: '#d88598' },
};
M.FILLINGS = {
  sesame:   { name: '깨',  col: '#d9a441', dot: '#3b2a1a' },
  bean:     { name: '콩',  col: '#7b4b3a', dot: '#a7745f' },
  chestnut: { name: '밤',  col: '#c8913d', dot: '#f3d48a' },
};

// 배치 문자 → 칸 종류
//  . 바닥  R 키위가 드나드는 뒷문(바닥)  # 조리대  X 벽(못 올림)
//  w/g/k 반죽 통(흰/쑥/분홍)  e/b/n 소 통(깨/콩/밤)
//  B 도마  S 솔잎 찜기  P 접시 더미  O 출하구  T 쓰레기통  > < ^ v 컨베이어
M.TILE_KIND = {
  '.': 'floor', 'R': 'door', '#': 'counter', 'X': 'wall',
  'w': 'crate', 'g': 'crate', 'k': 'crate', 'e': 'crate', 'b': 'crate', 'n': 'crate',
  'B': 'board', 'S': 'steamer', 'P': 'plates', 'O': 'serve', 'T': 'trash',
  '>': 'belt', '<': 'belt', '^': 'belt', 'v': 'belt',
};
M.CRATE = {
  w: { t: 'dough', c: 'white' }, g: { t: 'dough', c: 'ssuk' }, k: { t: 'dough', c: 'pink' },
  e: { t: 'filling', f: 'sesame' }, b: { t: 'filling', f: 'bean' }, n: { t: 'filling', f: 'chestnut' },
};
M.BELT_DIR = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], 'v': [0, 1] };

// ── 스테이지 ── (16×9, 모구 시작 칸 sx·sy)
M.STAGES = [
  {
    name: '첫 출근', sub: '흰 반죽 · 깨', time: 150,
    doughs: ['white'], fillings: ['sesame'], maxItems: 2, kiwi: 0,
    stars: [60, 160, 260], sx: 7, sy: 5,
    map: [
      '#w##e####B##B#S#',
      '#..............#',
      '#..............#',
      'P....###T###...O',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '####S###########',
    ],
    tips: ['반죽 통에서 반죽을 집어 도마로 가요', '도마를 바라보고 빚기 키(K·X)를 꾹 → 송편피', '깨 소를 피에 얹고 다시 빚기 → 반달 접기',
      '솔잎 찜기에 넣고 익으면 접시에 담아 출하!'],
  },
  {
    name: '쑥 향기', sub: '흰·쑥 반죽 · 깨·콩', time: 170,
    doughs: ['white', 'ssuk'], fillings: ['sesame', 'bean'], maxItems: 2, kiwi: 0,
    stars: [70, 190, 310], sx: 8, sy: 4,
    map: [
      '##w#g##e#b##SS##',
      '#..............#',
      'B..............O',
      '#...#B##T##B#..#',
      '#..............#',
      '#..............#',
      'P...##########.#',
      '#..............#',
      '########S#######',
    ],
  },
  {
    name: '키위 출몰', sub: '뒷문으로 키위가 들어와요', time: 180,
    doughs: ['white', 'ssuk'], fillings: ['sesame', 'bean'], maxItems: 3, kiwi: 1,
    stars: [80, 210, 340], sx: 8, sy: 4,
    map: [
      '#w#g####e##b#SS#',
      '#..............#',
      '#...##B##B##...O',
      '#..............#',
      'R..............#',
      '#...##T###P#...#',
      '#..............#',
      '#..............#',
      '###B####SS###B##',
    ],
  },
  {
    name: '컨베이어 공장', sub: '벨트 위에 올리면 옆방으로', time: 190,
    doughs: ['white', 'ssuk', 'pink'], fillings: ['sesame', 'bean'], maxItems: 3, kiwi: 0,
    stars: [40, 150, 270], sx: 3, sy: 4,
    map: [
      '#w#g#k#Xe#b#SS##',
      '#......X.......#',
      'B......X.......O',
      'B......>>>.....#',
      '#......X...T...#',
      '#......X.......#',
      '#......X...B...P',
      '#..............#',
      '###T####S#######',
    ],
  },
  {
    name: '추석 대목', sub: '분홍·밤까지 · 키위 떼', time: 210,
    doughs: ['white', 'ssuk', 'pink'], fillings: ['sesame', 'bean', 'chestnut'], maxItems: 3, kiwi: 2,
    stars: [60, 200, 340], sx: 8, sy: 4,
    map: [
      '#w#g#k##e#b#n###',
      '#..............#',
      'B..##B###B##...O',
      '#..............#',
      'R..............#',
      '#...#SSS#T#....#',
      '#..............P',
      '#..............#',
      '###B#####B######',
    ],
  },
];

// ── 난이도 (시리즈 공통 4단계) ──
//  time = 주문 제한시간 배율, gap = 주문 간격 배율, kiwi = 키위 출몰 빈도 배율, burn = 타기까지 배율
M.DIFFS = {
  easy:   { name: '이지',     time: 1.45, gap: 1.25, kiwi: 0.6, burn: 1.5, star: 1.1 },
  normal: { name: '노말',     time: 1.0,  gap: 1.0,  kiwi: 1.0, burn: 1.0, star: 1.0 },
  hard:   { name: '하드',     time: 0.8,  gap: 0.85, kiwi: 1.3, burn: 0.8, star: 0.95 },
  crazy:  { name: '크레이지', time: 0.64, gap: 0.72, kiwi: 1.7, burn: 0.62, star: 0.9 },
};
M.diff = 'normal';
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.nextDiff = function (d) {
  const i = M.DIFF_ORDER.indexOf(d);
  return i >= 0 && i < M.DIFF_ORDER.length - 1 ? M.DIFF_ORDER[i + 1] : null;
};

// ── 점수 ──
M.PTS_EACH = 20;                             // 송편 하나당
M.TIP_EACH = 8;                              // 남은 시간 비율 × 개수 × 이만큼 (콤보 배율 곱)
M.PENALTY_MISS = 10;                         // 주문 시간 초과
M.PENALTY_WRONG = 10;                        // 주문에 없는 접시를 냄
M.SHOO_BONUS = 5;                            // 키위 쫓아내기
M.COMBO_MAX = 4;

// 주문 손님 (영상 속 새들) — 주문표 아바타
M.CUSTOMERS = ['penguin', 'kakapo', 'pigeon', 'chick', 'ostrich'];
