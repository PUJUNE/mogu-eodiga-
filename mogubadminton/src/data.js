// data.js — 코트 치수 · 셔틀콕 물리 · 경기 규칙 · 선수 · 난이도
// 모구 1on1 농구와 같은 선수 명단·사다리·난이도 문법을 쓰는 실내 체육관 단식 배드민턴.
// 좌표: x(좌우, m) · y(네트 0 기준, 내 코트 +, 상대 코트 −) · z(높이, m)
const M = window.MBD;

// ── 코트 (단식, 실제 치수) ──
M.HALF_L = 6.7;                 // 네트에서 베이스라인까지
M.SINGLE_W = 5.18;              // 단식 사이드라인 폭 (x ∈ ±2.59)
M.SHORT_LINE = 1.98;            // 숏 서비스 라인
M.NET_H = 1.55;                 // 네트 높이 (가운데)
M.G = 9.8;
M.SHUTTLE_VT = 6.8;             // 셔틀 종단 속도 m/s — 공기저항이 커서 빨리 멈추고 뚝 떨어진다
M.DRAG = M.G / (M.SHUTTLE_VT * M.SHUTTLE_VT);

// ── 경기 ──
M.WIN = 11; M.CAP = 15;         // 11점 랠리 포인트, 듀스면 2점 차, 15점에서 끝
M.SERVE_T = 0.9;                // 점수 뒤 서브 준비 시간
M.SERVE_AUTO = 6;               // 서버가 이만큼 안 치면 자동 서브

// ── 움직임 · 스윙 ──
M.PR = 0.35;
M.SPD = 4.6;                    // 기본 이동 속도 (선수 능력치로 보정)
M.ACCEL = 30;
M.SWING_T = 0.34;               // 스윙 동작 전체
M.SWING_HIT = [0.02, 0.24];     // 이 구간에 셔틀이 닿을 거리면 맞는다
M.REACH = 1.05;                 // 몸에서 라켓까지 수평 거리
M.SWING_CD = 0.42;
M.JUMP_V = 3.2;

// 타구 종류 — 각도(도) · 목표 거리 · 난이도 노이즈 배율
M.SHOTS = {
  clear: { name: '클리어',  angle: 48,  depth: 5.9, minSpd: 8,  maxSpd: 75 },   // 실제 클리어도 초속 50m 안팎에서 출발
  lift:  { name: '리프트',  angle: 58,  depth: 5.6, minSpd: 6,  maxSpd: 70 },
  smash: { name: '스매시',  angle: -14, depth: 3.6, minSpd: 18, maxSpd: 42 },
  drop:  { name: '드롭',    angle: 8,   depth: 1.4, minSpd: 4,  maxSpd: 20 },
  net:   { name: '헤어핀',  angle: 62,  depth: 0.7, minSpd: 2,  maxSpd: 10 },
  drive: { name: '드라이브', angle: 6,  depth: 4.4, minSpd: 8,  maxSpd: 60 },
  serveHigh:  { name: '하이 서브', angle: 60, depth: 6.0, minSpd: 8, maxSpd: 75 },
  serveShort: { name: '숏 서브',   angle: 30, depth: 2.3, minSpd: 3, maxSpd: 16 },
};

// ── 선수 ── (spd 속도 · pow 파워 · ctl 정확도 · reach 리치 · jmp 점프)  — 얼굴·유니폼은 농구와 같다
M.PLAYERS = {
  mogu:   { name: '모구',          face: 'photo',  jersey: 0x2f6fe0, trim: 0xffffff, num: 1,  h: 1.0,  spd: 1.0,  pow: 1.0,  ctl: 1.0,  reach: 1.0,  jmp: 1.0,
            line: '셔틀콕은 원래 고양이 장난감이다냥' },
  mouse:  { name: '재빠른 생쥐',   face: 'mouse',  jersey: 0xe0503a, trim: 0xffe08a, num: 3,  h: 0.88, spd: 1.15, pow: 0.8,  ctl: 0.9,  reach: 0.88, jmp: 0.9,
            line: '어디로 쳐도 다 받는다 찍!' },
  kkokko: { name: '꼬꼬 권법가',   face: 'chick',  jersey: 0xf2b02c, trim: 0x8a2a1a, num: 7,  h: 0.95, spd: 1.0,  pow: 1.05, ctl: 0.9,  reach: 0.95, jmp: 1.3,
            line: '날개 스매시를 받아 봐라 꼬꼬!' },
  crow:   { name: '심술 까마귀',   face: 'crow',   jersey: 0x3a3a48, trim: 0xffd83d, num: 13, h: 1.0,  spd: 1.05, pow: 0.95, ctl: 1.12, reach: 1.0,  jmp: 1.05,
            line: '깃털 달린 건 내 전문이지 까악' },
  kiwi:   { name: '키위 도둑',     face: 'kiwi',   jersey: 0x6f9a45, trim: 0xf0dcae, num: 0,  h: 0.85, spd: 0.95, pow: 0.85, ctl: 1.18, reach: 0.9,  jmp: 0.7,
            line: '헤어핀으로 네트 앞에서 콕' },
  sumo:   { name: '스모 쥐',       face: 'sumo',   jersey: 0x7a4bb8, trim: 0xffffff, num: 55, h: 1.12, spd: 0.82, pow: 1.25, ctl: 0.95, reach: 1.15, jmp: 0.85,
            line: '받기만 하면 스매시 한 방' },
  ninja:  { name: '닌자 쥐',       face: 'ninja',  jersey: 0x22262e, trim: 0xd6282e, num: 8,  h: 0.96, spd: 1.15, pow: 1.05, ctl: 1.1,  reach: 1.0,  jmp: 1.1,
            line: '그림자처럼 코트를 덮는다' },
  shadow: { name: '그림자 고양이', face: 'shadow', jersey: 0x1a1424, trim: 0xb48cff, num: 99, h: 1.05, spd: 1.12, pow: 1.15, ctl: 1.15, reach: 1.08, jmp: 1.2,
            line: '모구… 랠리는 끝나지 않는다' },
};
M.LADDER = ['mouse', 'kkokko', 'crow', 'kiwi', 'sumo', 'ninja', 'shadow'];

// ── 난이도 — 컴퓨터 상대의 실력 ──
//  react 반응 지연 · err 타구 오차(m) · smash 스매시 적극성 · read 낙하점 예측 정확도 · stat 능력치 배율 · myErr 내 타구 오차 배율
M.DIFFS = {
  easy:   { name: '이지',     react: 0.38, err: 0.95, smash: 0.25, read: 0.75, stat: 0.86, myErr: 0.6 },
  normal: { name: '노말',     react: 0.26, err: 0.62, smash: 0.5,  read: 0.9,  stat: 0.96, myErr: 0.85 },
  hard:   { name: '하드',     react: 0.18, err: 0.42, smash: 0.7,  read: 0.97, stat: 1.03, myErr: 0.9 },
  crazy:  { name: '크레이지', react: 0.11, err: 0.28, smash: 0.85, read: 1.0,  stat: 1.1,  myErr: 0.9 },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.diff = 'normal';
