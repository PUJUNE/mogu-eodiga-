// difficulty.js — 스테이지 1~50 난이도 파라미터 + 월드 테마
const G = window.MOGU;

G.THEMES = {
  1: { name: '평원 마을', sky: 0x87ceeb, fog: 0xa8d8ee, fogFar: 95,
       water: 0x3d7be8, waterOpacity: 0.86,
       grassTop: [0x6fbf44, 0x65b53c, 0x79c84e], dirt: 0x8a5a32, farGround: 0x6ab548,
       trunk: 0x7a4f2b, leaf: [0x3e9b3e, 0x46a946], deco: ['tree', 'house', 'flower'],
       sun: 0xfff2b0, ambient: 0.62, night: false },
  2: { name: '자작나무 숲', sky: 0x9fd6e8, fog: 0xb9e2ec, fogFar: 88,
       water: 0x2f86c8, waterOpacity: 0.86,
       grassTop: [0x6fae4d, 0x7aba58, 0x639f43], dirt: 0x7d5a36, farGround: 0x68a64b,
       trunk: 0xe8e3d5, leaf: [0x8fd45e, 0x7cc24e, 0xd9e86b], deco: ['tree', 'rockpile', 'flower'],
       sun: 0xfff6c8, ambient: 0.58, night: false },
  3: { name: '사막 캐니언', sky: 0xf2cf95, fog: 0xeed7a8, fogFar: 92,
       water: 0x2f9c8d, waterOpacity: 0.82,
       grassTop: [0xe7d6a3, 0xdfcc96, 0xeeddad], dirt: 0xc4854f, farGround: 0xdcc892,
       trunk: 0x4e9c3c, leaf: [0x4e9c3c], deco: ['cactus', 'rockpile', 'deadbush'],
       sun: 0xffe9a8, ambient: 0.66, night: false },
  4: { name: '설원 얼음 강', sky: 0xcfe0ee, fog: 0xdde9f2, fogFar: 70,
       water: 0x3a6fa8, waterOpacity: 0.88,
       grassTop: [0xf4f8fb, 0xeaf2f8, 0xfafdff], dirt: 0x9eb6c4, farGround: 0xedf4f9,
       trunk: 0x4a3526, leaf: [0x2f5d3a, 0x356842], deco: ['spruce', 'snowpile', 'icerock'],
       sun: 0xeef4ff, ambient: 0.62, night: false },
  5: { name: '밤의 강', sky: 0x0b1030, fog: 0x141c3e, fogFar: 72,
       water: 0x16306b, waterOpacity: 0.9,
       grassTop: [0x2e5c3a, 0x295234, 0x336441], dirt: 0x3a3148, farGround: 0x24482e,
       trunk: 0x4a3a2a, leaf: [0x1e4a2a, 0x245431], deco: ['tree', 'torch', 'mushroom'],
       sun: 0xc8d8ff, ambient: 0.3, night: true },
};

// 월드별 장애물 풀 (누적 해금 + 테마 고유)
const OBSTACLE_SETS = {
  1: ['rock', 'lily', 'log'],
  2: ['rock', 'lily', 'log', 'movelog', 'pillar'],
  3: ['rock', 'log', 'movelog', 'pillar', 'cactuswall', 'sandbar'],
  4: ['rock', 'movelog', 'pillar', 'icefloe', 'crevasse'],
  5: ['rock', 'lily', 'log', 'movelog', 'pillar', 'icefloe', 'cactuswall'],
};

function lerp(a, b, t) { return a + (b - a) * t; }

G.paramsFor = function (stage) {
  const world = Math.min(5, Math.ceil(stage / 10));      // 1~5
  const wi = (stage - 1) % 10;                            // 월드 내 0~9
  const t = (stage - 1) / 49;                             // 전체 진행도 0~1
  const isWorldStart = wi === 0 && stage > 1;
  const isBoss = wi === 9;

  let speed = lerp(6, 13, t);
  if (isWorldStart) speed -= 0.8;                         // 새 기믹 학습 구간
  if (isBoss) speed += 0.5;

  const widthMax = Math.max(8, lerp(16, 10, t));
  const widthMin = Math.max(6, lerp(13, 6, t));

  const density = lerp(4, 16, t);                         // 개/100블록
  let interval = Math.max(speed * 0.95, 100 / density);   // 패턴 간 거리(블록)
  if (isBoss) interval *= 0.85;

  const targetTime = lerp(60, 120, t);
  const length = Math.round(targetTime * speed);

  return {
    stage, world, theme: G.THEMES[world],
    speed, widthMin, widthMax, interval,
    targetTime, length,
    curveAmp: lerp(3, 11, t) * (isBoss ? 1.2 : 1),
    curvePeriod: lerp(150, 90, t),
    obstacles: OBSTACLE_SETS[world],
    latReach: 7,                                          // 좌우 이동 속도(블록/s)
    rapids: world === 3 || world === 5,
    blizzard: world === 4,
    ice: world === 4,
    waterfalls: world === 5 ? (wi >= 2 ? 1 + Math.floor(wi / 4) : 0) : 0,
    chicken: [7, 23, 44].includes(stage),
    isBoss,
  };
};
