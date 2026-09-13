// levels.js — 상수 · 난이도 · 적/아이템/보스 정의 · 구역(하늘 테마) · 등급
// 원작(드래곤플라이트, 2012) 기준: 드래곤을 타고 위로 날며 자동 발사, 좌우로만 움직여 피한다.
const M = window.MDR;

// 화면 상수 (logic·render 공유) — 세로형 캔버스
M.W = 360; M.H = 560;
M.PY = 462;                      // 드래곤(플레이어) 고정 y
M.PR = 14;                       // 플레이어 피격 반경 (보이는 몸보다 관대하게)
M.PSPD = 300;                    // 좌우 이동 속도 (px/s)
M.HEARTS = 3;                    // 시작 하트
M.INV_SEC = 1.5;                 // 피격 후 무적
M.FEVER_SEC = 5;                 // 츄르 피버 지속
M.CLEAR_DIST = 12000;            // 12,000m 도달 = 달 착륙 CLEAR
M.MAX_LEVEL = 5;                 // 드래곤 불꽃 레벨 (생선으로 상승)

// 시리즈 공통 난이도 4단계 — 적 체력·낙하 속도·등장 빈도·점수 배율
M.DIFFS = {
  easy:   { name: '이지',     hpMul: 0.8, spdMul: 0.85, rateMul: 0.75, scoreMul: 0.8 },
  normal: { name: '노말',     hpMul: 1.0, spdMul: 1.0,  rateMul: 1.0,  scoreMul: 1.0 },
  hard:   { name: '하드',     hpMul: 1.3, spdMul: 1.12, rateMul: 1.25, scoreMul: 1.3 },
  crazy:  { name: '크레이지', hpMul: 1.7, spdMul: 1.25, rateMul: 1.55, scoreMul: 1.7 },
};
M.diff = 'normal';
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.nextDiff = function (d) {
  const i = M.DIFF_ORDER.indexOf(d);
  return i >= 0 && i < M.DIFF_ORDER.length - 1 ? M.DIFF_ORDER[i + 1] : null;
};

// 적 4종 — 바위구름은 격추 불가(피해야 한다)
M.ENEMY = {
  crow:    { name: '까마귀',     r: 13, hp: 1,  spd: 1.30, score: 100, wob: 26 },
  balloon: { name: '풍선쥐',     r: 16, hp: 3,  spd: 0.80, score: 200, wob: 0 },
  drone:   { name: '청소기 드론', r: 18, hp: 6,  spd: 0.55, score: 400, wob: 0, fire: 1.7 },
  rock:    { name: '바위구름',   r: 24, hp: Infinity, spd: 0.95, score: 0, wob: 0 },
};

// 불꽃 레벨별 발사 패턴 — 각도(라디안) 목록과 초당 발사 수
M.SHOT = [
  null,
  { angles: [0],                                  rate: 6.0 },
  { angles: [-0.04, 0.04],                        rate: 6.0 },
  { angles: [0, -0.3, 0.3],                       rate: 6.5 },
  { angles: [0, -0.3, 0.3],                       rate: 8.5 },
  { angles: [0, -0.2, 0.2, -0.42, 0.42],          rate: 8.5 },
];
M.FEVER_SHOT = { angles: [0, -0.18, 0.18, -0.36, 0.36], rate: 14 };

// 아이템 5종 (하늘에서 내려오는 선물) — 가중치는 logic이 상황에 맞게 조정
M.ITEMS = {
  churu:  { name: '츄르',   emoji: '🍢', w: 30, desc: '피버! 5초간 무적 + 5갈래 연사' },
  fish:   { name: '생선',   emoji: '🐟', w: 30, desc: '불꽃 레벨 업' },
  bomb:   { name: '폭탄',   emoji: '💣', w: 15, desc: '화면의 적 전멸' },
  heart:  { name: '하트',   emoji: '❤️', w: 12, desc: '하트 +1' },
  shield: { name: '방패',   emoji: '🛡️', w: 13, desc: '한 번 막아 준다' },
};
M.ITEM_R = 15;

// 보스 4종 — 3,000m마다 길을 막는다 (최종 보스를 잡아야 달에 닿는다)
M.BOSSES = [
  { at: 2800,  name: '까마귀 대장',   emoji: '🐦‍⬛', hp: 60,  color: '#2a2a3a', r: 42, fire: 1.4, spread: 3, bspd: 190 },
  { at: 5800,  name: '폭주 청소기왕', emoji: '🤖', hp: 100, color: '#7a8090', r: 46, fire: 1.2, spread: 4, bspd: 210 },
  { at: 8800,  name: '어둠의 박쥐',   emoji: '🦇', hp: 140, color: '#3c1e5a', r: 48, fire: 1.0, spread: 5, bspd: 230 },
  { at: 11800, name: '쥐마왕 드래곤', emoji: '🐉', hp: 200, color: '#6a1e2a', r: 54, fire: 0.85, spread: 6, bspd: 250 },
];

// 3,000m마다 바뀌는 하늘 (거리를 눈으로 읽게 하는 장치)
M.ZONES = [
  { at: 0,    name: '아침 하늘', sky0: '#58b6f0', sky1: '#c8ecfc', cloud: 'rgba(255,255,255,.85)' },
  { at: 3000, name: '노을',      sky0: '#e8734a', sky1: '#fbd9a0', cloud: 'rgba(255,240,220,.8)' },
  { at: 6000, name: '밤하늘',    sky0: '#0e1636', sky1: '#2c3a72', cloud: 'rgba(200,210,255,.35)', night: true },
  { at: 9000, name: '우주',      sky0: '#05060f', sky1: '#141a3a', cloud: 'rgba(150,160,255,.18)', night: true, space: true },
];
M.zoneIdx = function (dist) {
  let i = 0;
  for (let k = 0; k < M.ZONES.length; k++) if (dist >= M.ZONES[k].at) i = k;
  return i;
};

// 거리 → 웨이브 (1,000m마다 상승, 1..12)
M.waveAt = function (dist) { return Math.max(1, Math.min(12, Math.floor(dist / 1000) + 1)); };

// 웨이브 파라미터 — 난이도 배율 반영
M.makeWave = function (no, diff) {
  const w = Math.max(1, Math.min(12, no));
  const D = M.DIFFS[diff || M.diff] || M.DIFFS.normal;
  return {
    no: w,
    rate: +((0.75 + (w - 1) * 0.11) * D.rateMul).toFixed(3),   // 초당 편대 등장 수
    fallV: +((118 + (w - 1) * 9) * D.spdMul).toFixed(2),      // 기본 하강 속도 (px/s)
    hpMul: D.hpMul,
    // 편대 가중치: 초반엔 까마귀·풍선쥐, 웨이브가 오르면 드론·바위구름·V자 편대
    weights: [
      ['crow1', 30], ['crow3', 22], ['balloon', 20],
      ['drone', w >= 2 ? 14 : 0], ['rocks', w >= 2 ? 16 : 0],
      ['crowV', w >= 3 ? 12 : 0], ['wall', w >= 5 ? 10 : 0],
    ],
  };
};

// 도달 거리 → 등급
M.RANKS = [
  { d: 12000, tag: '👑', name: '달 착륙 모구' },
  { d: 9000,  tag: '🌌', name: '별의 기사' },
  { d: 6000,  tag: '🌆', name: '노을 라이더' },
  { d: 3000,  tag: '☁️', name: '구름 위 모구' },
  { d: 1000,  tag: '🐣', name: '견습 라이더' },
  { d: 0,     tag: '🥚', name: '알에서 갓 깬 모구' },
];
M.rankOf = function (dist) {
  return M.RANKS.find((r) => dist >= r.d) || M.RANKS[M.RANKS.length - 1];
};
