// levels.js — 스테이지(상대 태그팀·능력치) 생성
const M = window.MMS;

M.W = 480; M.H = 270;
M.RING_X = 150;                  // 링 반폭 (월드 x 한계)
M.RING_Z = 62;                   // 링 반깊이 (월드 z 한계)

// 10개 쥐 레슬러 태그팀 (스테이지 순서 = 챔피언 로드)
M.TEAMS = [
  { name: '찍찍 브라더스',   a: { name: '찍찍A', mask: '#8a6a4a' }, b: { name: '찍찍B', mask: '#6a8a4a' } },
  { name: '카레쥐 콤비',     a: { name: '카레쥐', mask: '#c89a2a' }, b: { name: '난쥐', mask: '#a87a1a' } },
  { name: '치즈 마스크 군단', a: { name: '치즈 마스크', mask: '#e8c83a' }, b: { name: '에멘탈', mask: '#d8b82a' } },
  { name: '라멘쥐 사단',     a: { name: '라멘쥐', mask: '#c84a3a' }, b: { name: '차슈', mask: '#a83a2a' } },
  { name: '워즈쥐 기계군',   a: { name: '워즈쥐', mask: '#8a9ab0' }, b: { name: '베어클로', mask: '#6a7a90' } },
  { name: '버팔로 랫츠',     a: { name: '버팔로쥐', mask: '#7a5a3a' }, b: { name: '롱혼', mask: '#5a4a2a' } },
  { name: '아수라 마우스',   a: { name: '아수라쥐', mask: '#7a4ac8' }, b: { name: '수라', mask: '#5a3aa8' } },
  { name: '네프튠 랫킹',     a: { name: '네프튠쥐', mask: '#3a7ac8' }, b: { name: '빅더쥐', mask: '#2a5aa8' } },
  { name: '악마 초쥐 콤비',  a: { name: '데블랫', mask: '#c82a5a' }, b: { name: '서큐랫', mask: '#a81a4a' } },
  { name: '완벽 초쥐 듀오',  a: { name: '퍼펙트랫', mask: '#d8d8e0' }, b: { name: '제로', mask: '#b8b8c8' } },
];

// ── 난이도 모드 (모구 어디가 문법 — 남극 대모험과 동일 체계) ──
// mult(적 능력치 배율). 크레이지 추가 노브: aggrMul(공격성), ballIntMul(파워볼 희소화)
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     mult: 0.85 },
  normal: { name: '노말',     mult: 1.0 },
  hard:   { name: '하드',     mult: 1.2 },
  crazy:  { name: '크레이지', mult: 1.42, aggrMul: 1.45, ballIntMul: 1.6 },
};
M.diff = 'normal';

M.makeStage = function (no) {
  const s = Math.max(1, Math.min(10, no));
  const t = (s - 1) / 9;
  const D = M.DIFFS[M.diff] || M.DIFFS.normal;

  return {
    no: s,
    team: M.TEAMS[s - 1],
    hp: Math.round((70 + t * 80) * D.mult),                       // 적 1인 체력 70 → 150
    atk: +((0.7 + t * 0.7) * D.mult).toFixed(3),                  // 적 공격력 배율 0.7 → 1.4
    spd: Math.round((76 + t * 40) * Math.min(1.25, D.mult)),      // 적 이동 속도 76 → 116 (배율 상한)
    aggr: Math.min(0.95, +((0.35 + t * 0.45) * (D.aggrMul || 1)).toFixed(3)),  // 공격 빈도·대시 성향
    ballInt: +((11 - t * 3) * (D.ballIntMul || 1)).toFixed(2),    // 파워볼 스폰 간격 11 → 8s
    time: 99,                                                     // 경기 시간 (초과 시 체력 판정)
    seed: s * 6971 + 1237,
  };
};
