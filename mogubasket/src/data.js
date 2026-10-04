// data.js — 코트 치수 · 경기 규칙 · 선수(모구와 시리즈 캐릭터) · 난이도
// 참고 영상: 「3D to Anime Basketball」 — 옥상 코트에서 빨간 타원구(수비)와 파란 직육면체(공격)가
// 1:1로 드리블·크로스오버·돌파·덩크를 하는 블렌더 블록아웃. 그 도형 자리에 모구와 친구들을 세웠다.
// 좌표: 코트 x(좌우, m) · y(베이스라인에서 하프라인 쪽, m) · z(높이, m)
const M = window.MBK;

// ── 코트 (하프 코트, FIBA 치수를 조금 줄임) ──
M.COURT_W = 15;                 // x ∈ [-7.5, 7.5]
M.COURT_L = 11;                 // y ∈ [0, 11]
M.HOOP = { x: 0, y: 1.6, z: 3.05 };
M.RIM_R = 0.23;                 // 림 반지름
M.BALL_R = 0.12;
M.BOARD_Y = 1.2;                // 백보드 면 y
M.BOARD_W = 1.8; M.BOARD_Z0 = 2.9; M.BOARD_Z1 = 3.95;
M.ARC_R = 6.25;                 // 2점 라인(스트리트 룰: 안쪽 1점, 바깥 2점)
M.CORNER_X = 6.1;               // 코너 직선 구간 x
M.KEY_W = 4.9; M.KEY_L = 5.8;   // 페인트존
M.CHECK = { x: 0, y: 8.6 };     // 체크 볼 위치 (탑)

// ── 경기 규칙 ──
M.WIN_SCORE = 11;               // 11점 선승 (스트리트 1·2점)
M.SHOT_CLOCK = 12;
M.CHECK_T = 1.1;                // 득점·교대 뒤 체크 볼 대기
M.G = 9.8;

// ── 움직임 ──
M.PR = 0.38;                    // 선수 몸 반지름
M.SPD = 5.0;                    // 기본 속도 m/s (선수 능력치로 보정)
M.DRIBBLE_SPD = 0.88;           // 공 가진 쪽 속도 배율
M.ACCEL = 28;                   // 가속 m/s²
M.CROSS_T = 0.24; M.CROSS_V = 7.2; M.CROSS_CD = 0.75;
M.STEAL_T = 0.28; M.STEAL_V = 5.5; M.STEAL_CD = 0.9; M.STEAL_R = 1.05;
M.STUMBLE_T = 0.85;             // 앵클 브레이크로 넘어진 시간
M.REACH_MISS_T = 0.45;          // 헛손질 뒤 휘청
M.JUMP_V = 4.4;                 // 블록·슛 점프 초속 (선수 점프력 배율)
M.PICK_R = 0.7;                 // 공을 줍는 수평 거리

// ── 슛 ──
M.GATHER_T = 0.18;              // 모으는 동작
M.METER_T = 0.95;               // 게이지가 끝까지 차는 시간
M.SWEET = [0.70, 0.86];         // 이 구간에서 놓으면 '굿 릴리스'
M.LAYUP_R = 2.1;                // 이 거리 안에서 슛 = 레이업/덩크
M.DUNK_R = 1.7;                 // 덩크 가능 거리 (달려 들어올 때)
M.BLOCK_R = 1.35;               // 슛 막기 유효 거리

// ── 선수 ── (spd 속도 · sht 슛 · hnd 핸들 · def 수비 · jmp 점프 · dunk 덩크 가능)
// face: 머리 그림 종류. 모구는 사진, 나머지는 코드로 그린 얼굴
M.PLAYERS = {
  mogu:   { name: '모구',         face: 'photo',  jersey: 0x2f6fe0, trim: 0xffffff, num: 1,  spd: 1.0,  sht: 1.0,  hnd: 1.0,  def: 1.0,  jmp: 1.0,  dunk: true,  h: 1.0,
            line: '집사 츄르 걸고 한 판!' },
  mouse:  { name: '재빠른 생쥐',  face: 'mouse',  jersey: 0xe0503a, trim: 0xffe08a, num: 3,  spd: 1.12, sht: 0.82, hnd: 1.05, def: 0.85, jmp: 0.85, dunk: false, h: 0.88,
            line: '배구장에서 넘어왔다 찍!' },
  kkokko: { name: '꼬꼬 권법가',  face: 'chick',  jersey: 0xf2b02c, trim: 0x8a2a1a, num: 7,  spd: 1.0,  sht: 0.9,  hnd: 0.9,  def: 1.0,  jmp: 1.25, dunk: true,  h: 0.95,
            line: '날개 치기로 블록이다 꼬꼬!' },
  crow:   { name: '심술 까마귀',  face: 'crow',   jersey: 0x3a3a48, trim: 0xffd83d, num: 13, spd: 1.05, sht: 1.08, hnd: 0.95, def: 1.0,  jmp: 1.05, dunk: false, h: 1.0,
            line: '반짝이는 공은 내 거다 까악!' },
  kiwi:   { name: '키위 도둑',    face: 'kiwi',   jersey: 0x6f9a45, trim: 0xf0dcae, num: 0,  spd: 0.95, sht: 0.9,  hnd: 1.0,  def: 1.25, jmp: 0.7,  dunk: false, h: 0.85,
            line: '송편 대신 공을 콕 쪼아 주지' },
  sumo:   { name: '스모 쥐',      face: 'sumo',   jersey: 0x7a4bb8, trim: 0xffffff, num: 55, spd: 0.82, sht: 0.85, hnd: 0.85, def: 1.2,  jmp: 0.9,  dunk: true,  h: 1.12,
            line: '골밑은 내 도효다' },
  ninja:  { name: '닌자 쥐',      face: 'ninja',  jersey: 0x22262e, trim: 0xd6282e, num: 8,  spd: 1.15, sht: 1.05, hnd: 1.2,  def: 1.1,  jmp: 1.1,  dunk: true,  h: 0.96,
            line: '그림자 크로스오버를 보아라' },
  shadow: { name: '그림자 고양이', face: 'shadow', jersey: 0x1a1424, trim: 0xb48cff, num: 99, spd: 1.12, sht: 1.15, hnd: 1.15, def: 1.2,  jmp: 1.2,  dunk: true,  h: 1.05,
            line: '모구… 너의 그림자다' },
};
// 도전 순서 (사다리) — 이기면 다음 상대가 열린다
M.LADDER = ['mouse', 'kkokko', 'crow', 'kiwi', 'sumo', 'ninja', 'shadow'];

// ── 난이도 (시리즈 공통 4단계) — 컴퓨터 상대의 실력 ──
//  react 반응 지연(초) · aim 슛 타이밍 오차(게이지 표준편차) · contest 슛 견제 확률 · steal 스틸 시도 빈도 · stat 능력치 배율
M.DIFFS = {
  easy:   { name: '이지',     react: 0.45, aim: 0.16, contest: 0.30, steal: 0.25, stat: 0.85, myBonus: 1.12 },
  normal: { name: '노말',     react: 0.30, aim: 0.10, contest: 0.55, steal: 0.45, stat: 0.95, myBonus: 1.0 },
  hard:   { name: '하드',     react: 0.20, aim: 0.07, contest: 0.75, steal: 0.65, stat: 1.03, myBonus: 1.0 },
  crazy:  { name: '크레이지', react: 0.12, aim: 0.045, contest: 0.9, steal: 0.8,  stat: 1.1,  myBonus: 1.0 },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.diff = 'normal';
