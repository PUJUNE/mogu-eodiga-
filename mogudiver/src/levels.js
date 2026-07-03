// levels.js — 스테이지·어종·보스 데이터 (6스테이지, 잠수 사냥 오리지널 각색)
const M = window.MDV;

M.W = 480; M.H = 270;
M.WORLD_W = 960;
M.SURF = 36;                     // 수면 y (월드 좌표)
M.BOAT_X = 90;                   // 보트 위치 — 하역 지점
M.TOTAL = 6;

// 어종: hp(발톱 타수), spd, w(몸길이), score(하역 점수), weight(물었을 때 기동 배율)
M.FISH = {
  anchovy:  { name: '멸치',       hp: 1, spd: 72, w: 10, score: 50,  weight: 0.98, body: '#a8c8e0', belly: '#eef6ff' },
  clown:    { name: '흰동가리',   hp: 1, spd: 54, w: 12, score: 80,  weight: 0.97, body: '#ff8a3d', belly: '#ffffff', stripes: true },
  bream:    { name: '도미',       hp: 2, spd: 48, w: 16, score: 120, weight: 0.92, body: '#e05a6a', belly: '#f8d8d0' },
  mackerel: { name: '고등어',     hp: 2, spd: 84, w: 15, score: 140, weight: 0.93, body: '#4a7ab0', belly: '#d8e8f0', stripes: true },
  squid:    { name: '오징어',     hp: 2, spd: 62, w: 14, score: 150, weight: 0.94, body: '#d8b0e0', belly: '#f0e0f4', kind: 'squid' },
  icefish:  { name: '빙어',       hp: 1, spd: 76, w: 11, score: 100, weight: 0.97, body: '#c8e8f8', belly: '#ffffff' },
  lantern:  { name: '초롱 물고기', hp: 2, spd: 56, w: 13, score: 160, weight: 0.94, body: '#3a4a6a', belly: '#7a8ab0', glow: true },
  ray:      { name: '가오리',     hp: 3, spd: 44, w: 22, score: 200, weight: 0.85, body: '#6a8a9a', belly: '#c8d8e0', kind: 'ray' },
  angler:   { name: '아귀',       hp: 3, spd: 52, w: 17, score: 250, weight: 0.88, aggro: true, dmg: 12, body: '#5a4a3a', belly: '#8a7a6a', glow: true },
  shark:    { name: '꼬마 상어',   hp: 4, spd: 96, w: 24, score: 300, weight: 0.8,  aggro: true, dmg: 15, body: '#7a90a8', belly: '#d8e4ec', kind: 'shark' },
  jelly:    { name: '해파리',     hp: 1, spd: 14, w: 13, score: 30,  hazard: true, dmg: 12, nocorpse: true, body: '#b0d0ff', belly: '#d8e8ff', kind: 'jelly' },
};

// 스테이지: 수면색→심층색, 바닥, 깊이, 할당량, 어군 풀
M.STAGES = {
  1: { name: '햇살 산호초', w0: '#46c8e8', deep: '#08466a', sand: '#e8d8a0', accent: '#ff7d5c',
       depth: 560, quota: 4, jellyN: 1, pool: ['anchovy', 'anchovy', 'clown', 'bream'] },
  2: { name: '켈프 숲',     w0: '#3ab8c8', deep: '#06404e', sand: '#c8b880', accent: '#5a9a3a',
       depth: 640, quota: 5, jellyN: 2, pool: ['clown', 'mackerel', 'mackerel', 'squid'] },
  3: { name: '난파선',     w0: '#3898b8', deep: '#052e44', sand: '#a89878', accent: '#8a6a4a',
       depth: 720, quota: 5, jellyN: 2, pool: ['bream', 'mackerel', 'ray', 'squid'] },
  4: { name: '심해 동굴',   w0: '#2878a8', deep: '#041e36', sand: '#6a6a7a', accent: '#b07dff',
       depth: 800, quota: 6, jellyN: 3, pool: ['squid', 'lantern', 'lantern', 'angler'] },
  5: { name: '빙하 바다',   w0: '#58b8d8', deep: '#0a3050', sand: '#b8ccd8', accent: '#e8f4ff',
       depth: 880, quota: 6, jellyN: 3, pool: ['icefish', 'icefish', 'mackerel', 'ray'] },
  6: { name: '심연',       w0: '#1a4878', deep: '#020a18', sand: '#2a2a3a', accent: '#ff5a5a',
       depth: 960, quota: 7, jellyN: 4, pool: ['lantern', 'angler', 'angler', 'shark'] },
};

// 스테이지 시작 브리핑
M.STORY = {
  1: '오늘 저녁은 생선! 산호초에서 사냥 개시',
  2: '켈프 숲 사이 살진 고등어 떼가 산다',
  3: '가라앉은 배 주변 — 큰 놈들이 숨어 있다',
  4: '빛이 닿지 않는 동굴, 초롱불을 조심해',
  5: '얼음 바다 — 시린 물속에 진미가 헤엄친다',
  6: '심연의 바닥. 이 아래 무언가 도사린다…',
};

// 보스: base = spikes(방사 가시) | zap(전기 폭발) | charge(돌진) | ink(먹물 사격) | kraken(복합)
M.BOSSES = {
  1: { name: '가시왕 푸구',     kind: 'puffer', base: 'spikes', hp: 16, spd: 46,  dmg: 10, w: 34, body: '#d8b860', belly: '#f4ecc0' },
  2: { name: '스파크 일',       kind: 'eel',    base: 'zap',    hp: 20, spd: 75,  dmg: 11, w: 42, body: '#7a68e0', belly: '#c8c0f0' },
  3: { name: '난파선의 아귀',   kind: 'angler', base: 'charge', hp: 24, spd: 85,  dmg: 13, w: 38, body: '#5a4a3a', belly: '#8a7a6a' },
  4: { name: '잉크로드',       kind: 'squid',  base: 'ink',    hp: 28, spd: 65,  dmg: 13, w: 40, body: '#8a5ac8', belly: '#c8a8e8', shot: '#2a2038' },
  5: { name: '흰이빨',         kind: 'shark',  base: 'charge', hp: 34, spd: 118, dmg: 15, w: 48, body: '#8aa0b8', belly: '#e8f0f6' },
  6: { name: '심연의 크라켄',   kind: 'kraken', base: 'kraken', hp: 42, spd: 70,  dmg: 17, w: 54, body: '#4a1a4a', belly: '#8a4a8a', shot: '#b07dff' },
};

M.makeStage = function (no) {
  const n = Math.max(1, Math.min(M.TOTAL, no));
  const S = M.STAGES[n];
  return {
    no: n, theme: S, depth: S.depth, quota: S.quota, jellyN: S.jellyN,
    pool: S.pool, boss: M.BOSSES[n],
  };
};
