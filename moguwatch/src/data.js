// data.js — 지역(맵) · 냥이 탑 · 츄르 도둑단 · 공세 구성 · 난이도 (DOM·THREE 없음)
const M = window.MWT;

// 맵 크기 — x 0~24 · z 0~16 (z 는 화면 아래쪽이 +)
M.MAP_W = 24; M.MAP_H = 16;
M.WAVES = 8;           // 지역 하나의 공세 수 (마지막은 우두머리)
M.STEP = 1 / 60;

// ── 냥이 탑 — 레벨 1~3 값은 배열 ──
M.TOWER = {
  yarn: {
    name: '털실 망루', short: '털실', icon: '🧶', cost: [70, 100, 150], range: [3.5, 3.8, 4.1],
    dmg: [8, 12, 17], rate: [0.8, 0.7, 0.6], air: true, ground: true, phys: true,
    desc: ['털실 뭉치를 빠르게 던진다.', '나는 적도 맞힌다.'],
  },
  can: {
    name: '캔 포대', short: '캔', icon: '🥫', cost: [110, 140, 200], range: [3.9, 4.2, 4.6], minRange: 1.2,
    dmg: [32, 56, 90], splash: [1.25, 1.45, 1.7], rate: [2.6, 2.45, 2.3], air: false, ground: true, phys: true,
    desc: ['참치캔을 던져 한꺼번에 친다.', '땅 위의 적만 맞힌다.'],
  },
  laser: {
    name: '레이저 등대', short: '레이저', icon: '🔴', cost: [100, 130, 180], range: [3.3, 3.6, 3.9],
    dmg: [15, 23, 33], jumps: [3, 4, 5], jumpR: 1.9, rate: [2.1, 1.95, 1.8], slow: [0.35, 0.42, 0.5], slowT: [1.4, 1.6, 1.8],
    air: true, ground: true, phys: false,
    desc: ['빨간 점이 번지며 적을 홀린다.', '갑옷을 뚫고 느리게 만든다.'],
  },
  guard: {
    name: '냥냥 초소', short: '초소', icon: '🛡️', cost: [80, 100, 150], range: [2.7, 2.9, 3.1],
    n: [2, 3, 3], hp: [60, 90, 140], dmg: [6, 10, 15], rate: [1.0, 0.95, 0.9], respawn: [8, 7, 6],
    air: false, ground: true, phys: true,
    desc: ['냥이 병사가 길을 막고', '도둑과 맞서 싸운다.'],
  },
};
M.TOWER_KINDS = ['yarn', 'can', 'laser', 'guard'];
M.SELL = 0.6;

// ── 츄르 도둑단 — hp 체력 · spd 빠르기 · bounty 현상금 · lives 곳간에 닿으면 잃는 츄르 ──
// rad 몸 반지름 · dmg/atkT 냥이 병사를 치는 힘과 간격
M.MON = {
  mouse:    { name: '생쥐', tip: '츄르를 노리는 기본 도둑.', hp: 30, spd: 1.25, bounty: 6, lives: 1, rad: 0.28, dmg: 5, atkT: 1.0 },
  squirrel: { name: '청설모', tip: '빠르고 약하다. 떼로 온다.', hp: 10, spd: 2.4, bounty: 2, lives: 1, rad: 0.22, dmg: 3, atkT: 0.6 },
  pigeon:   { name: '비둘기', tip: '날아온다. 털실·레이저만 닿는다.', hp: 18, spd: 1.9, bounty: 6, lives: 1, rad: 0.24, fly: 1.9 },
  raccoon:  { name: '너구리', tip: '두꺼운 털이 털실을 막는다.', hp: 105, spd: 0.95, bounty: 13, lives: 1, rad: 0.34, dmg: 10, atkT: 1.05, armor: 0.35 },
  boxrat:   { name: '택배 상자 쥐', tip: '상자가 부서지면 생쥐 셋이 나온다.', hp: 85, spd: 0.8, bounty: 8, lives: 1, rad: 0.38, dmg: 7, atkT: 1.1, split: ['mouse', 3, 0.6] },
  boar:     { name: '멧돼지', tip: '다칠수록 더 빨리 달린다.', hp: 40, spd: 1.6, bounty: 6, lives: 1, rad: 0.3, dmg: 9, atkT: 0.7, frenzy: 0.6 },
  weasel:   { name: '족제비', tip: '냥이 병사 사이로 빠져나간다.', hp: 22, spd: 2.1, bounty: 3, lives: 1, rad: 0.22, dmg: 4, atkT: 0.6, slip: true },
  frog:     { name: '개구리', tip: '막히면 멀리 뛰어 넘는다.', hp: 70, spd: 0.95, bounty: 9, lives: 1, rad: 0.3, dmg: 8, atkT: 1.0, hop: { leap: 2.2, cd: 3.5 } },
  skunk:    { name: '스컹크', tip: '쓰러지면 방귀로 병사를 다치게 한다.', hp: 40, spd: 1.4, bounty: 7, lives: 2, rad: 0.28, dmg: 0, atkT: 1.0, gas: { r: 1.5, dmg: 32 } },
  fox:      { name: '안개 여우', tip: '흐려지면 털실도 발톱도 빗나간다.', hp: 55, spd: 1.25, bounty: 10, lives: 1, rad: 0.28, dmg: 8, atkT: 0.9, ghost: [2.2, 1.5] },
  crow:     { name: '까마귀', tip: '날아온다. 깃털이 단단하다.', hp: 80, spd: 1.5, bounty: 12, lives: 1, rad: 0.3, fly: 2.3, armor: 0.5 },
  cheer:    { name: '응원단 쥐', tip: '북을 쳐서 주변 도둑을 재촉한다.', hp: 90, spd: 1.1, bounty: 13, lives: 1, rad: 0.3, dmg: 6, atkT: 1.0, aura: { r: 2.4, mul: 1.3 } },
  captain:  { name: '쥐 대장', tip: '호루라기로 생쥐를 불러낸다.', hp: 110, spd: 0.85, bounty: 16, lives: 1, rad: 0.32, dmg: 7, atkT: 1.1, summon: { type: 'mouse', n: 2, every: 7, max: 4, hp: 0.6 } },
  badger:   { name: '오소리', tip: '한동안 안 맞으면 다시 낫는다.', hp: 340, spd: 0.78, bounty: 28, lives: 2, rad: 0.45, dmg: 22, atkT: 1.4, regen: 0.035 },
  robot:    { name: '로봇청소기', tip: '단단하고 잘 안 느려진다.', hp: 440, spd: 0.62, bounty: 32, lives: 2, rad: 0.48, dmg: 20, atkT: 1.4, armor: 0.45, slowRes: 0.5 },
  // 우두머리 — 지역마다 하나
  bRaccoon: { name: '대왕 너구리', tip: '청설모 떼를 불러낸다.', hp: 1300, spd: 0.8, bounty: 200, lives: 5, rad: 0.8, dmg: 40, atkT: 1.5, armor: 0.35, boss: true, summon: { type: 'squirrel', n: 3, every: 8, max: 99, hp: 1 } },
  bRobot:   { name: '판교 청소왕', tip: '흡입! 주변 탑을 잠깐 멈춘다.', hp: 1500, spd: 0.6, bounty: 200, lives: 5, rad: 0.85, dmg: 44, atkT: 1.6, armor: 0.6, slowRes: 0.3, boss: true, emp: { every: 10, r: 3.4, stun: 2 } },
  bRat:     { name: '왕갈비 쥐왕', tip: '택배 상자 쥐를 불러낸다.', hp: 1300, spd: 0.82, bounty: 200, lives: 5, rad: 0.8, dmg: 42, atkT: 1.5, boss: true, summon: { type: 'boxrat', n: 1, every: 9, max: 99, hp: 0.7 } },
  bSnake:   { name: '치악산 구렁이', tip: '병사를 미끄러져 지나고 다시 낫는다.', hp: 1250, spd: 0.78, bounty: 200, lives: 5, rad: 0.75, dmg: 40, atkT: 1.5, boss: true, slip: true, regen: 0.02 },
  bFrog:    { name: '안양천 왕개구리', tip: '크게 뛰어올라 병사를 깔아뭉갠다.', hp: 1350, spd: 0.8, bounty: 200, lives: 5, rad: 0.8, dmg: 42, atkT: 1.5, boss: true, hop: { leap: 3, cd: 3, stomp: 25 } },
  bCheer:   { name: '신촌 응원단장', tip: '응원으로 도둑단을 몰아친다.', hp: 1400, spd: 0.85, bounty: 200, lives: 5, rad: 0.8, dmg: 40, atkT: 1.5, boss: true, aura: { r: 3.2, mul: 1.35 }, enrage: [0.3, 1.4], summon: { type: 'weasel', n: 3, every: 8, max: 99, hp: 1 } },
};

// 공세 구성표 — [값, 한 무리 최소, 최대, 간격(초), 처음 나오는 공세]
M.ROSTER = {
  mouse: [4, 4, 7, 0.55, 1], squirrel: [2, 4, 7, 0.3, 2], pigeon: [4, 3, 5, 0.45, 2], raccoon: [12, 1, 3, 0.9, 3],
  boxrat: [10, 1, 3, 1.0, 3], boar: [6, 2, 4, 0.5, 3], weasel: [3, 3, 6, 0.3, 3], frog: [8, 1, 3, 0.8, 4],
  skunk: [6, 1, 2, 0.9, 4], fox: [9, 1, 3, 0.8, 4], crow: [10, 1, 3, 0.7, 5], cheer: [13, 1, 1, 1.2, 5],
  captain: [16, 1, 1, 1.4, 6], badger: [28, 1, 1, 2, 6], robot: [34, 1, 1, 2, 6],
};

// ── 여섯 지역 ──
// paths: 도둑이 오는 길(마지막 점 = 츄르 곳간). water: river(중심선·폭) · pond(원)
// marks: 랜드마크 { k 종류, x, z, r 차지하는 반지름, rot }. 길이 물을 건너는 곳엔 다리가 저절로 놓인다
M.MAPS = [
  {
    id: 'seoulforest', name: '서울숲', icon: '🌳', sub: '사슴 방사장과 호수 사이 숲길',
    lore: '은행나무 숲길로 청설모와 너구리가 몰려온다.',
    paths: [[[-1, 3], [7, 3], [7, 9], [2.5, 9], [2.5, 13.5], [12, 13.5], [12, 7], [17, 7], [17, 12.5], [21.5, 12.5], [21.5, 3]]],
    water: [{ t: 'pond', x: 15.2, z: 2.6, r: 2.1 }],
    marks: [{ k: 'deer', x: 9.5, z: 3.2, r: 1.8 }, { k: 'brick', x: 19.5, z: 15.2, r: 1.6 }, { k: 'apt', x: 23.6, z: 9.5, r: 0.9 }, { k: 'horse', x: 0.9, z: 15, r: 0.9 }],
    trees: ['ginkgo', 'metaseq', 'round'], plots: 14,
    pal: { ground: 0x6fae4a, ground2: 0x5f9e40, path: 0xd8b886, path2: 0xc8a676, edge: 0x7a5a3a, sky: 0xcfeaf6, fog: 0xd8f0e0, sun: 0xfff2d8, hemi: [0xdff4ff, 0x4a7a3a], light: 1.0 },
    weights: { mouse: 3, squirrel: 3, pigeon: 2, raccoon: 1.6, boar: 1, weasel: 0.6, fox: 0.6, badger: 0.6, boxrat: 0.6, frog: 0.5, skunk: 0.5, crow: 0.5, cheer: 0.3, captain: 0.6, robot: 0 },
    early: {}, boss: 'bRaccoon',
  },
  {
    id: 'seongnam', name: '성남', icon: '🏯', sub: '남한산성 남문과 탄천, 판교 빌딩숲',
    lore: '산성 남문과 탄천 두 길로 로봇청소기가 밀려온다.',
    paths: [
      [[2, -1], [2, 6], [8, 6], [8, 2], [14, 2], [14, 12.5], [19.5, 12.5], [19.5, 4.5], [22.5, 4.5]],
      [[-1, 13], [6, 13], [6, 10], [11, 10], [11, 8], [14, 8], [14, 12.5], [19.5, 12.5], [19.5, 4.5], [22.5, 4.5]],
    ],
    water: [{ t: 'river', pts: [[16.8, -1.5], [16.4, 6], [16.9, 11], [16.5, 17.5]], w: 1.5 }],
    marks: [{ k: 'gate', x: 2, z: -0.2, r: 0.5 }, { k: 'wall', x: -0.3, z: -0.5, r: 0.4, len: 2.6 }, { k: 'wall', x: 5.3, z: -0.5, r: 0.4, len: 5 },
      { k: 'glass', x: 22.4, z: 9.4, r: 1.3 }, { k: 'glass2', x: 22.6, z: 13.6, r: 1.2 }, { k: 'market', x: 9.3, z: 13.8, r: 1.7 }],
    trees: ['pine', 'round'], plots: 14,
    pal: { ground: 0x84b65a, ground2: 0x74a64e, path: 0xb8b0a0, path2: 0xa8a090, edge: 0x6a5a4a, sky: 0xbfe2f8, fog: 0xd4eaf6, sun: 0xffffff, hemi: [0xe4f4ff, 0x5a7a4a], light: 1.05 },
    weights: { mouse: 3, boxrat: 2, robot: 1.5, pigeon: 1.5, raccoon: 1, captain: 1, squirrel: 1.5, weasel: 1, boar: 0.6, crow: 0.6, cheer: 0.6, skunk: 0.5, frog: 0.4, fox: 0.4, badger: 0.5 },
    early: { robot: 5 }, boss: 'bRobot',
  },
  {
    id: 'suwon', name: '수원', icon: '🏰', sub: '화성 장안문 · 화홍문 · 플라잉수원',
    lore: '노을 진 화성 성벽을 넘어 쥐왕의 무리가 들이닥친다.',
    paths: [[[12, -1], [12, 3.5], [4, 3.5], [4, 9], [9, 9], [9, 13.5], [16, 13.5], [16, 7.5], [21, 7.5], [21, 2.5]]],
    water: [{ t: 'river', pts: [[13.6, 17.5], [13.2, 10], [13.7, 5.5], [14.2, -1.5]], w: 1.3 }],
    marks: [{ k: 'jangan', x: 12, z: -0.3, r: 0.5 }, { k: 'hwall', x: 5, z: -0.5, r: 0.4, len: 10 }, { k: 'hwall', x: 20, z: -0.5, r: 0.4, len: 8 },
      { k: 'pavilion', x: 16.6, z: 3.2, r: 1.3 }, { k: 'balloon', x: 3.2, z: 13.3, r: 1.2 }, { k: 'chicken', x: 20.5, z: 14.9, r: 1.4 }],
    trees: ['pine', 'round', 'cherry'], plots: 14,
    pal: { ground: 0x93a85a, ground2: 0x84984e, path: 0xc9a27a, path2: 0xb8926a, edge: 0x6a4a3a, sky: 0xf6c8a0, fog: 0xf4d0b0, sun: 0xffd2a0, hemi: [0xffe0c8, 0x6a5a4a], light: 0.95 },
    weights: { captain: 1.4, boxrat: 1.6, crow: 1.4, pigeon: 2, mouse: 3, boar: 1, skunk: 1, raccoon: 1, squirrel: 1.5, weasel: 0.8, fox: 0.6, cheer: 0.6, frog: 0.5, badger: 0.6, robot: 0.5 },
    early: { captain: 4 }, boss: 'bRat',
  },
  {
    id: 'wonju', name: '원주', icon: '🍁', sub: '치악산 단풍과 소금산 출렁다리',
    lore: '단풍 든 치악산에서 멧돼지와 구렁이가 내려온다.',
    paths: [[[-1, 2.5], [6, 2.5], [6, 8], [1.5, 8], [1.5, 13.5], [9, 13.5], [9, 5], [15, 5], [15, 13], [20.5, 13], [20.5, 6.5], [23, 6.5]]],
    water: [{ t: 'river', pts: [[11.5, -1.5], [12, 6], [12.2, 11], [11.8, 17.5]], w: 1.9 }],
    marks: [{ k: 'chiak', x: 19, z: -4.5, r: 0 }, { k: 'gamyeong', x: 17.8, z: 9, r: 1.3 }, { k: 'museum', x: 5.4, z: 15.2, r: 1.2 }, { k: 'chiak2', x: 4, z: -4, r: 0 }],
    trees: ['maple', 'maple2', 'pine'], plots: 14,
    pal: { ground: 0xb8a050, ground2: 0xa89044, path: 0xa88a64, path2: 0x987a56, edge: 0x5a4030, sky: 0xf2dcae, fog: 0xf0d8b0, sun: 0xffe6b8, hemi: [0xfff0d8, 0x6a4a2a], light: 1.0 },
    weights: { boar: 2.4, fox: 1.6, badger: 1.4, squirrel: 2.4, weasel: 1.2, crow: 1, mouse: 2.5, pigeon: 1.2, raccoon: 1, frog: 0.6, skunk: 0.6, captain: 0.6, cheer: 0.4, boxrat: 0.5, robot: 0.3 },
    early: { boar: 2, fox: 3 }, boss: 'bSnake',
  },
  {
    id: 'anyang', name: '안양', icon: '🌉', sub: '안양천 다리 넷과 예술공원',
    lore: '안양천을 건너며 개구리 떼가 폴짝폴짝 다가온다.',
    paths: [[[-1, 4], [5, 4], [5, 12.5], [10, 12.5], [10, 3], [15, 3], [15, 12.5], [20, 12.5], [20, 5], [23, 5]]],
    water: [{ t: 'river', pts: [[-1.5, 8.2], [8, 7.7], [16, 8.5], [25.5, 8]], w: 1.5 }],
    marks: [{ k: 'art', x: 12.5, z: 14.6, r: 1.2 }, { k: 'apt', x: 22.6, z: 10.6, r: 0.9 }, { k: 'apt', x: 22.8, z: 14, r: 0.9 }, { k: 'station', x: 2, z: 15, r: 1.6 }, { k: 'samsung', x: 12, z: -4.5, r: 0 }],
    trees: ['round', 'willow', 'cherry'], plots: 14,
    pal: { ground: 0x7cae6a, ground2: 0x6c9e5c, path: 0xb4b4ac, path2: 0xa4a49c, edge: 0x5a5a5a, sky: 0xc6d4e0, fog: 0xd0dae2, sun: 0xf4f4f0, hemi: [0xe0e8f0, 0x50604a], light: 0.95 },
    weights: { frog: 2.6, pigeon: 2.2, skunk: 1.4, weasel: 1.4, raccoon: 1, robot: 0.6, mouse: 2.6, squirrel: 1.5, boxrat: 1, crow: 0.8, fox: 0.6, boar: 0.6, cheer: 0.6, captain: 0.6, badger: 0.6 },
    early: { frog: 2 }, boss: 'bFrog',
  },
  {
    id: 'sinchon', name: '신촌', icon: '🦅', sub: '옛 신촌역 · 연세로 · 독수리 동상',
    lore: '네온 켜진 연세로로 응원단 쥐들이 행진해 온다.',
    paths: [
      [[3, -1], [3, 5], [9, 5], [9, 1.5], [15, 1.5], [15, 11], [20.5, 11], [20.5, 4], [23, 4]],
      [[-1, 12.5], [6, 12.5], [6, 9], [11, 9], [11, 14], [15, 14], [15, 11], [20.5, 11], [20.5, 4], [23, 4]],
    ],
    water: [],
    marks: [{ k: 'sstation', x: 6, z: 2.2, r: 1.5 }, { k: 'rail', x: 12, z: -0.7, r: 0.3, len: 26 }, { k: 'eagle', x: 18, z: 6.5, r: 1.0 },
      { k: 'hall', x: 22.8, z: 14.2, r: 1.5 }, { k: 'shops', x: 2.4, z: 15.3, r: 1.4 }, { k: 'bus', x: 18, z: 13.6, r: 1.2 }],
    trees: ['round', 'ginkgo'], plots: 15,
    pal: { ground: 0x5a7e68, ground2: 0x50725e, path: 0x8a8a9a, path2: 0x7e7e8e, edge: 0x4a4a5a, sky: 0x1a1e3a, fog: 0x2a2a4a, sun: 0xc8d0ff, hemi: [0xb0b0ff, 0x4a4a5a], light: 1.0, night: true },
    weights: { cheer: 2, weasel: 2, pigeon: 2.4, crow: 1.4, skunk: 1.4, fox: 1.2, robot: 1, captain: 1, mouse: 2.6, squirrel: 1.4, boxrat: 1, raccoon: 1, boar: 0.6, frog: 0.6, badger: 0.6 },
    early: { cheer: 3 }, boss: 'bCheer',
  },
];

// 난이도 — hp 체력 배수 · bud 도둑 수 배수 · gold 시작 군자금 · lives 츄르
M.DIFFS = {
  easy:   { name: '이지', hp: 0.75, bud: 0.8, gold: 300, lives: 25 },
  normal: { name: '노말', hp: 1.0, bud: 1.0, gold: 260, lives: 20 },
  hard:   { name: '하드', hp: 1.25, bud: 1.12, gold: 240, lives: 20 },
  crazy:  { name: '크레이지', hp: 1.55, bud: 1.25, gold: 220, lives: 12 },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];

M.WAVE = { first: 30, between: 12, earlyGold: 2, clearGold: [25, 6] };   // 첫 공세까지 · 공세 사이 · 일찍 부르면 남은 1초당 · 공세 마치면 25 + 6×차례
