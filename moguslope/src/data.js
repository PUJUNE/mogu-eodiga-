// data.js — 구역 · 코스 · 장애물 · 난이도 · 물리 상수 (DOM·THREE 없음)
const M = window.MSL;

M.G = 9.8;

// 물리 — 단위는 m · 초. 옆 좌표 u 는 오른쪽이 +, 높이 z 는 그 자리 바닥에서 잰 높이
M.PHYS = {
  steer: 38,          // 좌우 조향 가속도
  damp: 6,            // 옆 속도 감쇠
  airDamp: 0.6,
  cf: 0.6,            // 곡선 원심력 비율 (곡선 바깥 벽으로 밀려 올라간다)
  wall: 2.4,          // 벽 위에서 가운데로 끌어내리는 중력 비율
  approach: 0.45,     // 목표 속도로 다가가는 빠르기 (1/초)
  jump: 6.2,          // 점프 위로 속도
  grav: 13.7,         // 공중 중력 (조금 가볍게)
  rampLaunch: 0.42,   // 도약대 끝 위로 속도 = 속도 × 이 값 + 2
  spinRate: 9.42,     // 공중 회전 빠르기 (라디안/초 = 540°)
  spinTol: 0.87,      // 착지할 때 허용하는 각도 오차 (50°)
  crashSlow: 0.35,
  invuln: 1.6,
  boost: 1.35, boostT: 1.5, trickBoostT: 1.0,
  startV: 4,
};

// 구역 — 바닥 단면은 평평한 가운데 f + 반지름 r 의 둥근 벽(최대 각도 tm)
M.ZONES = {
  canal: {
    name: '벚꽃 수로', icon: '🌸', prof: { f: 2.2, r: 2.6, tm: 1.31 }, grade: 0.15, curveR: [38, 70],
    tall: ['rock', 'crate', 'cone'], low: 'log', mover: 'bucket',
    pat: { coinLine: 3, slalom: 3, wall3: 2, jumpLow: 2, mover: 1, boost: 1, wallRide: 2, ramp: 1 },
  },
  tube: {
    name: '물미끄럼 터널', icon: '🌊', prof: { f: 0.8, r: 3.6, tm: 1.40 }, grade: 0.2, curveR: [34, 60],
    tall: ['duck', 'ball'], low: 'noodle', mover: 'ring',
    pat: { coinLine: 2, slalom: 2, wall3: 1, jumpLow: 1, mover: 2, boost: 2, wallRide: 4, ramp: 1 },
  },
  field: {
    name: '단풍 농장', icon: '🍁', prof: { f: 7, r: 3, tm: 0.52 }, grade: 0.16, curveR: [60, 110],
    tall: ['hay', 'pumpkin', 'scarecrow'], low: 'hayrow', mover: 'tractor',
    pat: { coinLine: 2, slalom: 3, wall3: 2, jumpLow: 2, mover: 3, boost: 1, wallRide: 0.5, ramp: 3 },
  },
  snow: {
    name: '눈꽃 산', icon: '⛄', prof: { f: 6, r: 4, tm: 0.7 }, grade: 0.2, curveR: [55, 100],
    tall: ['snowman', 'rock', 'pine'], low: 'mound', mover: 'snowball',
    pat: { coinLine: 2, slalom: 3, wall3: 2, jumpLow: 2, mover: 2, boost: 1, wallRide: 1, ramp: 3 },
  },
};
M.ZONE_ORDER = ['canal', 'tube', 'field', 'snow'];

// 장애물 — ru 옆 반폭 · rs 앞뒤 반길이 · h 높이 (h 이하로 넘으면 안 부딪힘)
M.OBST = {
  rock:      { name: '바위', ru: 0.7, rs: 0.6, h: 1.1 },
  crate:     { name: '나무 상자', ru: 0.6, rs: 0.6, h: 1.2 },
  cone:      { name: '고깔', ru: 0.45, rs: 0.45, h: 1.0 },
  log:       { name: '통나무', low: true, rs: 0.4, h: 0.7 },
  bucket:    { name: '떠다니는 대야', ru: 0.8, rs: 0.8, h: 0.9 },
  duck:      { name: '고무 오리', ru: 0.7, rs: 0.6, h: 1.4 },
  ball:      { name: '비치볼', ru: 0.65, rs: 0.65, h: 1.3 },
  noodle:    { name: '풀누들', low: true, rs: 0.3, h: 0.65 },
  ring:      { name: '튜브', ru: 0.9, rs: 0.9, h: 0.8 },
  hay:       { name: '건초 더미', ru: 0.8, rs: 0.7, h: 1.4 },
  pumpkin:   { name: '호박', ru: 0.65, rs: 0.65, h: 1.0 },
  scarecrow: { name: '허수아비', ru: 0.5, rs: 0.3, h: 2.0 },
  hayrow:    { name: '건초 줄', low: true, rs: 0.45, h: 0.75 },
  tractor:   { name: '트랙터', ru: 1.3, rs: 1.6, h: 2.2 },
  snowman:   { name: '눈사람', ru: 0.6, rs: 0.6, h: 1.8 },
  pine:      { name: '소나무', ru: 0.7, rs: 0.7, h: 3.0 },
  mound:     { name: '눈 둔덕', low: true, rs: 0.5, h: 0.7 },
  snowball:  { name: '굴러오는 눈덩이', ru: 1.0, rs: 1.0, h: 2.0 },
};

// 코스 — zones: [구역, 길이(m)]
M.COURSES = [
  { id: 'c1', name: '벚꽃 수로', icon: '🌸', zones: [['canal', 1100]], desc: '역 옆 돌담 수로를 따라 — 굽은 길에선 벽을 타요' },
  { id: 'c2', name: '물미끄럼 터널', icon: '🌊', zones: [['canal', 150], ['tube', 1000]], desc: '둥근 물길 터널 — 벽을 높이 타고 생선을' },
  { id: 'c3', name: '단풍 농장', icon: '🍁', zones: [['field', 1200]], desc: '넓은 주황 비탈 — 트랙터 조심, 도약대에서 빙글' },
  { id: 'c4', name: '눈꽃 산', icon: '⛄', zones: [['snow', 1300]], desc: '눈사람 사이로 — 큰 점프와 눈덩이' },
  { id: 'c5', name: '모구 대활강', icon: '🏔️', zones: [['canal', 500], ['tube', 500], ['field', 600], ['snow', 700]], desc: '네 구역을 한 번에 내려가는 긴 코스' },
];
M.ENDLESS_ZONE = 450;   // 끝없는 슬로프: 구역 하나 길이

// 난이도
M.DIFFS = {
  easy:   { name: '이지', hearts: 5, vcap: 17, gap: 42, mover: 0.7 },
  normal: { name: '노말', hearts: 3, vcap: 21, gap: 30, mover: 1 },
  hard:   { name: '하드', hearts: 3, vcap: 24, gap: 24, mover: 1.15 },
  crazy:  { name: '크레이지', hearts: 2, vcap: 27, gap: 19, mover: 1.3 },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];

// 점수
M.SCORE = { fish: 10, finish: 500, heart: 200, trick: [0, 100, 300, 600, 1000] };
M.STAR_FISH = 0.7;   // ★2: 생선 70% 이상 · ★3: 한 번도 안 부딪힘
