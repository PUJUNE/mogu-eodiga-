// levels.js — 스테이지(상대 태그팀·능력치·필살기) 생성 — 원작 머슬 태그매치 수치 준거
// 기본기 대미지 mv(3~10)·필살기 dmg(10~40)·이속(90~128)은 원작 8초인 능력치 표 계보
const M = window.MMS;

M.W = 480; M.H = 270;
M.RING_X = 150;                  // 링 반폭 (월드 x 한계)
M.RING_Z = 62;                   // 링 반깊이 (월드 z 한계)

// 아군 (모구=킨니쿠맨 계보, 꼬꼬=라멘맨 계보)
// mv = { punch, kick, backdrop, dropkick, lariat, fba }
M.HEROES = {
  mogu: { name: '모구', spd: 107,
    mv: { punch: 5, kick: 5, backdrop: 8, dropkick: 7, lariat: 7, fba: 7 },
    sp: { name: '머슬 드라이버', kind: 'rear', dmg: 40 } },
  kko:  { name: '꼬꼬', spd: 110,
    mv: { punch: 3, kick: 7, backdrop: 6, dropkick: 10, lariat: 5, fba: 7 },
    sp: { name: '꼬꼬 공중살법', kind: 'jump', dmg: 30 } },
};

// 10개 쥐 레슬러 태그팀 (스테이지 순서 = 챔피언 로드)
// sp.kind: rear(잡기) | punch(타격) | jump(공중) | dash(돌진) | gas(원거리 — 유일한 투사체, 원작 브로켄 오마주)
M.TEAMS = [
  { name: '찍찍 브라더스',   a: { name: '찍찍A', mask: '#8a6a4a' }, b: { name: '찍찍B', mask: '#6a8a4a' },
    spd: 95,  mv: { punch: 5, kick: 3, backdrop: 6, dropkick: 5, lariat: 7, fba: 5 },
    sp: { name: '더블 찍찍 락', kind: 'punch', dmg: 20 } },
  { name: '카레쥐 콤비',     a: { name: '카레쥐', mask: '#c89a2a' }, b: { name: '난쥐', mask: '#a87a1a' },
    spd: 90,  mv: { punch: 3, kick: 5, backdrop: 6, dropkick: 7, lariat: 7, fba: 5 },
    sp: { name: '카레 가스 살법', kind: 'gas', dmg: 10 } },
  { name: '치즈 마스크 군단', a: { name: '치즈 마스크', mask: '#e8c83a' }, b: { name: '에멘탈', mask: '#d8b82a' },
    spd: 100, mv: { punch: 5, kick: 5, backdrop: 8, dropkick: 5, lariat: 7, fba: 7 },
    sp: { name: '치즈 타워 브리지', kind: 'rear', dmg: 40 } },
  { name: '라멘쥐 사단',     a: { name: '라멘쥐', mask: '#c84a3a' }, b: { name: '차슈', mask: '#a83a2a' },
    spd: 105, mv: { punch: 3, kick: 7, backdrop: 6, dropkick: 10, lariat: 5, fba: 7 },
    sp: { name: '라멘 공중살법', kind: 'jump', dmg: 30 } },
  { name: '워즈쥐 기계군',   a: { name: '워즈쥐', mask: '#8a9ab0' }, b: { name: '베어클로', mask: '#6a7a90' },
    spd: 128, mv: { punch: 7, kick: 3, backdrop: 7, dropkick: 7, lariat: 10, fba: 10 },
    sp: { name: '베어 클로', kind: 'punch', dmg: 30 } },
  { name: '버팔로 랫츠',     a: { name: '버팔로쥐', mask: '#7a5a3a' }, b: { name: '롱혼', mask: '#5a4a2a' },
    spd: 112, mv: { punch: 7, kick: 3, backdrop: 10, dropkick: 5, lariat: 10, fba: 10 },
    sp: { name: '허리케인 믹서', kind: 'dash', dmg: 40 } },
  { name: '아수라 마우스',   a: { name: '아수라쥐', mask: '#7a4ac8' }, b: { name: '수라', mask: '#5a3aa8' },
    spd: 118, mv: { punch: 3, kick: 7, backdrop: 7, dropkick: 10, lariat: 10, fba: 7 },
    sp: { name: '아수라 버스터', kind: 'rear', dmg: 40 } },
  { name: '네프튠 랫킹',     a: { name: '네프튠쥐', mask: '#3a7ac8' }, b: { name: '빅더쥐', mask: '#2a5aa8' },
    spd: 120, mv: { punch: 7, kick: 5, backdrop: 10, dropkick: 7, lariat: 10, fba: 7 },
    sp: { name: '크로스 봄버', kind: 'dash', dmg: 40 } },
  { name: '악마 초쥐 콤비',  a: { name: '데블랫', mask: '#c82a5a' }, b: { name: '서큐랫', mask: '#a81a4a' },
    spd: 122, mv: { punch: 5, kick: 7, backdrop: 8, dropkick: 10, lariat: 10, fba: 10 },
    sp: { name: '지옥 회전 살법', kind: 'jump', dmg: 40 } },
  { name: '완벽 초쥐 듀오',  a: { name: '퍼펙트랫', mask: '#d8d8e0' }, b: { name: '제로', mask: '#b8b8c8' },
    spd: 126, mv: { punch: 7, kick: 7, backdrop: 10, dropkick: 10, lariat: 10, fba: 10 },
    sp: { name: '퍼펙트 드라이버', kind: 'rear', dmg: 40 } },
];

// ── 난이도 모드 (모구 어디가 문법 — 남극 대모험과 동일 체계) ──
// mult(적 대미지 배율). 크레이지 추가 노브: aggrMul(공격성), ballIntMul(구슬 희소화)
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     mult: 0.8 },
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
    dmgMul: +((0.75 + t * 0.55) * D.mult).toFixed(3),             // 적 대미지 배율 0.75 → 1.3
    aggr: Math.min(0.95, +((0.35 + t * 0.45) * (D.aggrMul || 1)).toFixed(3)),  // 공격 판단 빈도
    counter: +(0.25 + t * 0.5).toFixed(3),                        // 로프 복귀 카운터 성공률 0.25 → 0.75
    spd: M.TEAMS[s - 1].spd,
    electric: s >= 7,                                             // 전류 로프 링 (원작 3라운드~ 대응)
    ballInt: +(8 * (D.ballIntMul || 1)).toFixed(2),               // 구슬 소멸 후 재등장 최소 간격
    time: 30,                                                     // 폴 제한시간 (원작 30초)
    seed: s * 6971 + 1237,
  };
};
