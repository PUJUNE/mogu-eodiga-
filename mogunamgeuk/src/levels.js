// levels.js — 스테이지(기지 구간·장애물·커브) 생성
const M = window.MNG;

M.W = 480; M.H = 270;
M.TRACK_W = 200;                 // 트랙 반폭 (월드 x 한계)

M.STATIONS = [
  '쇼와', '몰로데즈나야', '마이르니', '케이시', '뒤몽 뒤르빌',
  '스콧', '맥머도', '아문센-스콧', '보스토크', '쇼와 (귀환)',
];

// ── 난이도 모드 (모구 어디가 문법) ──
// mult(최고 속도 배율): 제한시간이 같은 식으로 재계산되므로 어떤 배율에서도 클리어 가능.
// 크레이지 추가 노브: densityMul(장애물 밀도), popMul(크레바스 바다사자 출현률)
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     mult: 0.85 },
  normal: { name: '노말',     mult: 1.0 },
  hard:   { name: '하드',     mult: 1.2 },
  crazy:  { name: '크레이지', mult: 1.42, densityMul: 1.3, popMul: 1.7 },
};
M.diff = 'normal';

M.makeStage = function (no) {
  const s = Math.max(1, Math.min(10, no));
  const rng = M.makeRng(s * 7919 + 3301);
  const t = (s - 1) / 9;
  const D = M.DIFFS[M.diff] || M.DIFFS.normal;

  const length = Math.round(8000 + t * 6000);          // 8 → 14 km (약 1분 주행)
  const maxSpd = Math.round((190 + t * 90) * D.mult);  // 190 → 280 m/s × 난이도 배율
  // 제한시간: 순항 속도(최고의 55%) 기준 — 풀가속 없이도 도달 가능하고 충돌 몇 번의
  // 여유가 있다. 핵심 과제는 장애물 회피, 속도는 남은 시간 보너스(점수)용.
  const time = Math.round(length / (maxSpd * 0.55));

  // 커브 구간: 직선-좌-직선-우 … 시드 결정적
  const curves = [];
  let d = 400;
  while (d < length - 400) {
    const len = rng.range(280, 660);
    const c = rng.chance(0.42) ? 0 : rng.range(0.35, 0.85 + t * 0.5) * (rng.chance(0.5) ? 1 : -1);
    curves.push({ d0: d, d1: d + len, c });
    d += len;
  }

  // 장애물: 진행 간격 결정적 배치 (점프 체공 거리보다 넉넉한 최소 간격)
  const objs = [];
  const hazMin = (170 - t * 40) / (D.densityMul || 1); // 170 → 130 m (크레이지는 촘촘)
  const popP = Math.min(0.8, (0.22 + t * 0.28) * (D.popMul || 1));   // 크레바스 바다사자 출현률
  d = 300;
  while (d < length - 300) {
    const r = rng.next();
    if (r < 0.34) {
      // 전폭 크레바스 — 일부는 바다사자가 튀어나옴 (점프 + 측면 회피 필요)
      const px = rng.range(-140, 140);
      const pop = rng.chance(popP);
      objs.push({ d, x: 0, type: 'crev', w: M.TRACK_W, pop, px });
    } else if (r < 0.68) {
      objs.push({ d, x: rng.range(-150, 150), type: 'hole', w: 34 });
    } else {
      objs.push({ d, x: rng.range(-150, 150), type: 'seal', w: 30 });
    }
    d += hazMin + rng.range(0, 130);
  }
  // 깃발·물고기: 독립 격자 배치 (장애물과 겹치면 어긋난 지점에서도 재미 요소)
  d = 260;
  while (d < length - 260) {
    objs.push({
      d: d + rng.range(-40, 40),
      x: rng.range(-160, 160),
      type: rng.chance(0.78) ? 'flag' : 'fish',
      w: 26,
    });
    d += rng.range(330, 470);
  }
  objs.sort((a, b) => a.d - b.d);

  return {
    no: s, from: M.STATIONS[s - 1], to: M.STATIONS[s % 10],
    length, maxSpd, time, curves, objs,
    flagsTotal: objs.filter((o) => o.type === 'flag').length,
  };
};

// 현재 거리의 곡률
M.curveAt = function (stage, d) {
  for (const cv of stage.curves) {
    if (d >= cv.d0 && d < cv.d1) return cv.c;
  }
  return 0;
};
