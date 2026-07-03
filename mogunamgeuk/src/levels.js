// levels.js — 스테이지(기지 구간·장애물·커브) 생성
const M = window.MNG;

M.W = 480; M.H = 270;
M.TRACK_W = 200;                 // 트랙 반폭 (월드 x 한계)

M.STATIONS = [
  '쇼와', '몰로데즈나야', '마이르니', '케이시', '뒤몽 뒤르빌',
  '스콧', '맥머도', '아문센-스콧', '보스토크', '쇼와 (귀환)',
];

M.makeStage = function (no) {
  const s = Math.max(1, Math.min(10, no));
  const rng = M.makeRng(s * 7919 + 3301);
  const t = (s - 1) / 9;

  const length = Math.round(8000 + t * 6000);          // 8 → 14 km (약 1분 주행)
  const maxSpd = Math.round(190 + t * 90);             // 190 → 280 m/s
  const time = Math.round(length / (maxSpd * 0.7));    // 풀가속 70% 효율 기준 빠듯하게

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
  const hazMin = 170 - t * 40;                         // 170 → 130 m
  d = 300;
  while (d < length - 300) {
    const r = rng.next();
    if (r < 0.34) {
      objs.push({ d, x: 0, type: 'crev', w: M.TRACK_W });          // 전폭 크레바스
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
