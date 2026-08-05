// levels.js — 웨이브(난이도 곡선) · 난이도 · 하늘 테마 · 똥 종류
// 원작(스베랑카/졸라맨 똥피하기) 기준: 5분 생존 = CLEAR, 시간이 갈수록 똥이 많아진다.
const M = window.MDD;

// 화면 상수 (logic·render 공유) — 세로형 캔버스
M.W = 360; M.H = 560;
M.GROUND = 522;                  // 모구가 서는 바닥 y (발끝)
M.PW = 17; M.PH = 50;            // 모구 히트박스 반폭 · 키 (바닥 위로 드러난 몸통에 맞춤)
M.FOOT = 0.58;                   // 스프라이트 접지점 — 이미지 높이의 58%(엉덩이/꼬리 시작점)가 바닥
                                 // (모구 남극 대모험과 같은 접지 문법, 꼬리는 바닥으로 늘어짐)
M.PSPD = 250;                    // 모구 이동 속도 (px/s)

M.CLEAR_TIME = 300;              // 원작과 동일한 5분 생존 클리어
M.WAVES = 10;                    // 30초마다 웨이브 상승 → 10웨이브
M.WAVE_SEC = 30;

// 시리즈 공통 난이도 4단계 (원작 모바일판 Slow/Medium/Fast 3단계의 확장)
M.DIFFS = {
  easy:   { name: '이지',     mult: 0.8,  rateMul: 0.56, speedMul: 0.80 },
  normal: { name: '노말',     mult: 1.0,  rateMul: 1.00, speedMul: 1.00 },
  hard:   { name: '하드',     mult: 1.2,  rateMul: 1.24, speedMul: 1.10 },
  // 크레이지의 총 낙하량(약 2600개)이 원작 5분(2900~3000개)에 가장 가깝다
  crazy:  { name: '크레이지', mult: 1.42, rateMul: 1.55, speedMul: 1.20 },
};
M.diff = 'normal';
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.nextDiff = function (d) {
  const i = M.DIFF_ORDER.indexOf(d);
  return i >= 0 && i < M.DIFF_ORDER.length - 1 ? M.DIFF_ORDER[i + 1] : null;
};

// 똥 3종 — 크기가 클수록 느리고 판정이 넓다
M.KINDS = {
  small: { r: 8,  spd: 1.34, wob: 9 },   // wob = 좌우 흔들림 진폭(px)
  mid:   { r: 12, spd: 1.00, wob: 5 },
  big:   { r: 17, spd: 0.76, wob: 2 },
};

// 60초마다 바뀌는 하늘 (경과 시간을 눈으로 읽게 하는 장치)
M.THEMES = [
  { name: '아침 하늘', sky0: '#9fd8f5', sky1: '#e2f4fc', ground: '#6aa84f', accent: '#ffd83d' },
  { name: '한낮',      sky0: '#57b0e8', sky1: '#cfeaf8', ground: '#5da24a', accent: '#ffd83d' },
  { name: '노을',      sky0: '#e8834a', sky1: '#fad8a8', ground: '#8a6a3a', accent: '#fff0a8' },
  { name: '밤',        sky0: '#101838', sky1: '#2c3a68', ground: '#2a4030', accent: '#a8d8ff', night: true },
  { name: '똥 폭풍',   sky0: '#241c30', sky1: '#4a3a50', ground: '#3a2c28', accent: '#ff9a5a', night: true, storm: true },
];

M.themeAt = function (t) {
  return M.THEMES[Math.max(0, Math.min(M.THEMES.length - 1, Math.floor(t / 60)))];
};

// 경과 시간 → 웨이브 (1..10)
M.waveAt = function (t) {
  return Math.max(1, Math.min(M.WAVES, Math.floor(t / M.WAVE_SEC) + 1));
};

// 웨이브 파라미터 — 난이도 배율 반영
M.makeWave = function (no, diff) {
  const w = Math.max(1, Math.min(M.WAVES, no));
  const D = M.DIFFS[diff || M.diff] || M.DIFFS.normal;
  return {
    no: w,
    rate: +((1.25 + (w - 1) * 0.68) * D.rateMul).toFixed(3),   // 초당 똥 생성 수
    fallV: +((168 + (w - 1) * 12) * D.speedMul).toFixed(2),  // 기본 낙하 속도 (px/s)
    // 종류 가중치: 초반엔 보통 똥만, 웨이브가 오르면 작고 빠른 똥 + 큰 똥이 섞인다
    weights: {
      small: w >= 3 ? Math.min(0.42, 0.10 + (w - 3) * 0.055) : 0,
      big:   w >= 5 ? Math.min(0.22, 0.06 + (w - 5) * 0.032) : 0,
    },
    wind: w >= 9,                                            // 마지막 60초 = 똥 폭풍(바람)
  };
};

// 생존 시간 → 등급
M.RANKS = [
  { t: 300, tag: '👑', name: '똥 마스터 모구' },
  { t: 240, tag: '🙀', name: '전설의 회피냥' },
  { t: 180, tag: '😾', name: '베테랑 모구' },
  { t: 120, tag: '😼', name: '날렵한 모구' },
  { t: 60,  tag: '🐱', name: '견습 회피냥' },
  { t: 20,  tag: '🐣', name: '초보 모구' },
  { t: 0,   tag: '💩', name: '똥 맞은 모구' },
];
M.rankOf = function (sec) {
  return M.RANKS.find((r) => sec >= r.t) || M.RANKS[M.RANKS.length - 1];
};
