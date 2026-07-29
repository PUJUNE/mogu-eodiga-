// levels.js — 시드 기반 코스 생성: 도로 세그먼트(커브·언덕) + 교통 + 노변 스프라이트
// 좌표: z = 전진, y = 고도, x = 도로 중심 기준 좌우(도로 반폭 = 1.0)
const M = window.MRC;

M.SEG_LEN = 200;        // 세그먼트 1개의 z 길이 (월드 단위)
M.ROAD_W = 2000;        // 도로 반폭 (월드 단위)
M.LANES = 3;
M.RUMBLE_LEN = 3;       // 갓길 줄무늬 교대 주기 (세그먼트)
M.MAX_SPEED = M.SEG_LEN * 90;   // 초당 90세그먼트 = 18000 (60은 속도감이 밋밋해 1.5배로 상향)
// 속도계 표시 전용 환산 — 월드 단위는 미터가 아니므로 물리와 무관하게 최고 속도를
// 아케이드 레이서 감각의 450 km/h로 잡는다 (세그먼트 통과율 1.5배 상향과 함께 300→450)
M.KMH = 450 / M.MAX_SPEED;

M.COURSES = 90;         // 총 코스 수 — 테마(월드)당 6개 × 15테마
// 테마 6~15는 배경 사진 5장을 재활용한다: bg = 쓸 사진 번호, tint = 사진 위에
// 덮는 색조(rgba)로 노을·새벽·눈보라 같은 분위기를 만든다 (render._background).
M.WORLDS = {
  1: {
    name: '해안 절벽', night: false, far: 'city', side: 'cliff', sea: true,
    sky0: '#2f7fd0', sky1: '#a8dcf2', haze: '#cfe7f2', sun: '#fff0c8',
    seaC: '#1a86a8', seaLine: '#7fd8e8', farC: '#7d93ac', midC: '#6b5f52', midLit: '#8c7b66',
    ground: '#4a695b', ground2: '#425f52', road: '#4a4d52', road2: '#44474c',
    rumble: '#d8d8d8', rumble2: '#b03a3a', lane: '#eef2f5', center: '#e8c23a',
  },
  2: {
    name: '협곡', night: false, far: 'mesa', side: 'canyon', sea: false,
    sky0: '#2a5fa8', sky1: '#f0c48a', haze: '#e8c9a4', sun: '#ffe0a0',
    seaC: null, seaLine: null, farC: '#9b6a52', midC: '#8a4a34', midLit: '#b06a46',
    ground: '#9c7656', ground2: '#8f6c4e', road: '#50504e', road2: '#4a4a48',
    rumble: '#e0d0b8', rumble2: '#a83828', lane: '#f0ead8', center: '#e8b83a',
  },
  3: {
    name: '사막 고속도로', night: false, far: 'dune', side: 'dune', sea: false,
    sky0: '#3f8fd8', sky1: '#f6e2b0', haze: '#f2e0bc', sun: '#fff4d0',
    seaC: null, seaLine: null, farC: '#d8b478', midC: '#c8a468', midLit: '#e6c88c',
    ground: '#b49069', ground2: '#a8865f', road: '#56534e', road2: '#504d48',
    rumble: '#f0e4c8', rumble2: '#b06838', lane: '#faf2dc', center: '#f0c23a',
  },
  4: {
    name: '설산 고개', night: false, far: 'peak', side: 'snow', sea: false,
    sky0: '#4a86c8', sky1: '#dceaf6', haze: '#e6f0f8', sun: '#ffffff',
    seaC: null, seaLine: null, farC: '#aac4dc', midC: '#8ea6c0', midLit: '#c8dcec',
    ground: '#b3c1d0', ground2: '#a5b3c2', road: '#5a5d62', road2: '#54575c',
    rumble: '#ffffff', rumble2: '#c03a4a', lane: '#ffffff', center: '#e8c23a',
  },
  5: {
    name: '도시 야경', night: true, far: 'skyline', side: 'building', sea: false,
    sky0: '#0a0a24', sky1: '#3a2a5c', haze: '#2a2440', sun: '#ffd8a0',
    seaC: null, seaLine: null, farC: '#1a1a38', midC: '#241f42', midLit: '#3a3260',
    ground: '#222b36', ground2: '#1c2530', road: '#2e2e36', road2: '#2a2a32',
    rumble: '#d0d0e0', rumble2: '#8a3a6a', lane: '#e8e8f4', center: '#f0c23a',
  },
  6: {
    name: '노을 해협', night: false, far: 'city', side: 'cliff', sea: true, bg: 1, tint: 'rgba(255,140,60,.28)',
    sky0: '#7a3050', sky1: '#f6b06a', haze: '#f2c9a0', sun: '#ffd8a0',
    seaC: '#8a5a68', seaLine: '#f0b088', farC: '#9a7080', midC: '#6b4a44', midLit: '#9a6a56',
    ground: '#5a5648', ground2: '#524e42', road: '#4e4a4c', road2: '#484446',
    rumble: '#e8d8c8', rumble2: '#b04838', lane: '#f5ead8', center: '#e8b83a',
  },
  7: {
    name: '새벽 협곡', night: false, far: 'mesa', side: 'canyon', sea: false, bg: 2, tint: 'rgba(120,140,220,.30)',
    sky0: '#3a4a7a', sky1: '#c8b8d8', haze: '#c0c2dc', sun: '#ffe8c0',
    seaC: null, seaLine: null, farC: '#6a5a74', midC: '#5c4050', midLit: '#84606a',
    ground: '#6a5a60', ground2: '#615258', road: '#48484e', road2: '#424248',
    rumble: '#d8d0d8', rumble2: '#8a3a5a', lane: '#ece8f0', center: '#d8b03a',
  },
  8: {
    name: '황혼 사막', night: false, far: 'dune', side: 'dune', sea: false, bg: 3, tint: 'rgba(150,80,180,.26)',
    sky0: '#4a2a6a', sky1: '#d89ab8', haze: '#d8b0c8', sun: '#ffd0b0',
    seaC: null, seaLine: null, farC: '#8a6a90', midC: '#7a5878', midLit: '#a87e9a',
    ground: '#8a6a70', ground2: '#7e6066', road: '#4c484e', road2: '#464248',
    rumble: '#e8d0d8', rumble2: '#983858', lane: '#f0e0e8', center: '#e0b03a',
  },
  9: {
    name: '오로라 설원', night: true, far: 'peak', side: 'snow', sea: false, bg: 4, tint: 'rgba(24,44,90,.52)',
    sky0: '#0a1428', sky1: '#1c3a54', haze: '#1e3448', sun: '#c8ffd8',
    seaC: null, seaLine: null, farC: '#2a4458', midC: '#31506a', midLit: '#4a7a8c',
    ground: '#3a4e62', ground2: '#344658', road: '#33363e', road2: '#2e3138',
    rumble: '#b8c8d8', rumble2: '#3a8a6a', lane: '#d8ecf4', center: '#c8b03a',
  },
  10: {
    name: '자정 도심', night: true, far: 'skyline', side: 'building', sea: false, bg: 5, tint: 'rgba(10,10,30,.35)',
    sky0: '#05050f', sky1: '#1a1430', haze: '#151228', sun: '#ffd8a0',
    seaC: null, seaLine: null, farC: '#100f22', midC: '#181430', midLit: '#282348',
    ground: '#161c24', ground2: '#12181f', road: '#26262e', road2: '#22222a',
    rumble: '#b8b8cc', rumble2: '#6a2a52', lane: '#d8d8ec', center: '#e0b83a',
  },
  11: {
    name: '폭풍 해안', night: false, far: 'city', side: 'cliff', sea: true, bg: 1, tint: 'rgba(70,85,100,.42)',
    sky0: '#4a5a68', sky1: '#8a9aa8', haze: '#93a2ae', sun: '#d8dce0',
    seaC: '#3a5a66', seaLine: '#7a9aa6', farC: '#5e6c7a', midC: '#4e5560', midLit: '#6e7a86',
    ground: '#3e5248', ground2: '#384a42', road: '#42454a', road2: '#3d4045',
    rumble: '#c8ccd2', rumble2: '#8a4a42', lane: '#e2e8ee', center: '#c8a83a',
  },
  12: {
    name: '붉은 바위 캐니언', night: false, far: 'mesa', side: 'canyon', sea: false, bg: 2, tint: 'rgba(200,70,30,.24)',
    sky0: '#2a4a88', sky1: '#e8a878', haze: '#daa284', sun: '#ffe0a0',
    seaC: null, seaLine: null, farC: '#a05a42', midC: '#963c26', midLit: '#c05e38',
    ground: '#a06246', ground2: '#925a40', road: '#524e4a', road2: '#4c4844',
    rumble: '#ecd4b8', rumble2: '#a82818', lane: '#f4e8d0', center: '#f0b83a',
  },
  13: {
    name: '모래폭풍 사막', night: false, far: 'dune', side: 'dune', sea: false, bg: 3, tint: 'rgba(210,170,110,.45)',
    sky0: '#a8823f', sky1: '#e0c088', haze: '#e2c896', sun: '#f2dca8',
    seaC: null, seaLine: null, farC: '#c0a070', midC: '#b08e5e', midLit: '#d0b080',
    ground: '#ab8a60', ground2: '#9e7f58', road: '#5b554c', road2: '#555046',
    rumble: '#e8dcc0', rumble2: '#a86030', lane: '#f2ead0', center: '#e8b83a',
  },
  14: {
    name: '눈보라 고개', night: false, far: 'peak', side: 'snow', sea: false, bg: 4, tint: 'rgba(230,240,250,.50)',
    sky0: '#9ab0c4', sky1: '#e4eef6', haze: '#eef4fa', sun: '#ffffff',
    seaC: null, seaLine: null, farC: '#b8c8da', midC: '#9cb2c6', midLit: '#d2e2ee',
    ground: '#c2ceda', ground2: '#b4c2d0', road: '#61646a', road2: '#5b5e64',
    rumble: '#ffffff', rumble2: '#b04a5a', lane: '#ffffff', center: '#d8b83a',
  },
  15: {
    name: '네온 시티', night: true, far: 'skyline', side: 'building', sea: false, bg: 5, tint: 'rgba(160,30,140,.30)',
    sky0: '#14061e', sky1: '#4a1a5c', haze: '#3a1a44', sun: '#ff9ad8',
    seaC: null, seaLine: null, farC: '#251038', midC: '#321a4e', midLit: '#5c2a78',
    ground: '#2a2238', ground2: '#241e30', road: '#302a3a', road2: '#2b2634',
    rumble: '#e0c8e8', rumble2: '#c03a8a', lane: '#f0d8f8', center: '#f0c23a',
  },
};

const RIVALS = {
  6: '갈매기 배달차', 12: '협곡 폭주쥐', 18: '모래바람 트럭', 24: '설원 제설차', 30: '야경 킹쥐',
  36: '노을 폭주갈매기', 42: '새벽 우편쥐', 48: '황혼 카라반', 54: '오로라 순록마차', 60: '자정 택배왕',
  66: '천둥 견인차', 72: '바위 덤프쥐', 78: '모래폭풍 로드트레인', 84: '눈보라 제설왕', 90: '네온 그랑프리 킹쥐',
};

// 제한시간 — 숙련 봇 주행의 실제 구간 소요 × 여유율(55%→25%)로 구워낸 표.
// (재생성 방법: test/tune.mjs — 물리·트랙 상수를 바꾸면 반드시 다시 구워야 함)
M.START_TIME = [20, 17, 18, 18.5, 20, 20, 19.5, 19.5, 18, 18, 22.5, 18, 21.5, 18, 19,
  21, 19.5, 18.5, 19.5, 20, 16.5, 16.5, 19, 18.5, 16.5, 22, 16.5, 20, 17, 17.5,
  19, 17, 21.5, 17, 21, 17.5, 17.5, 20, 23, 18, 21.5, 17.5, 16.5, 16, 19,
  21.5, 16, 16, 19, 19.5, 19.5, 21.5, 18.5, 17, 18.5, 19, 16, 16, 17, 21,
  20.5, 21, 22.5, 17, 21, 16.5, 23.5, 15, 15, 15.5, 16, 15, 19.5, 16, 19.5,
  19, 16.5, 20, 20, 16, 16, 22, 21, 24, 21.5, 16.5, 15.5, 19.5, 17.5, 20.5];
M.CP_BONUS = [15, 16.5, 16.5, 19, 16, 17, 16, 18, 16.5, 19.5, 20.5, 17.5, 21, 18, 20,
  20.5, 19.5, 20.5, 17.5, 15, 18, 19.5, 18.5, 15.5, 20.5, 17.5, 16.5, 17, 20.5, 17.5,
  18.5, 18.5, 17.5, 18.5, 17, 21.5, 19.5, 18, 20.5, 20, 18.5, 21.5, 19, 18, 15.5,
  20, 16, 16.5, 18.5, 20, 17, 19.5, 18, 20, 21, 21.5, 16.5, 20, 17, 21.5,
  20, 17, 21.5, 19.5, 19, 20, 22.5, 17.5, 17, 19, 17, 21, 16.5, 21.5, 16.5,
  20, 18, 18.5, 22.5, 21.5, 18, 18.5, 18.5, 23, 22, 21.5, 22, 17.5, 22.5, 23.5];

// ── 트랙 조각 규격 ──
const LEN = { SHORT: 60, MEDIUM: 130, LONG: 240 };
// 커브 값은 원심력 계수(0.32)·조향 권한(1.25)과 물려 있다.
// 한계 속도 = 1.25 / (curve × 0.32) — 이 값이 30% 밑으로 떨어지면 주행이 불가능해진다.
const CURVE = { EASY: 1.8, MEDIUM: 3.4, HARD: 5.4 };
const HILL = { LOW: 24, MEDIUM: 48, HIGH: 82 };

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 131);
  const world = Math.min(15, Math.ceil(no / 6));
  const theme = M.WORLDS[world];
  const boss = no % 6 === 0;

  // ── 난이도 프로파일 ──
  // 코스 길이·체크포인트 간격·교통 대수는 MAX_SPEED 1.5배 상향과 함께 1.5배로 늘려
  // 레이스 소요 시간·체크포인트 시간 간격(약 10초)·단위 길이당 교통 밀도를 유지한다.
  // 난이도 곡선은 종전 1→30 범위(길이 ~7000세그 · 곡률 ×1.49 · 기복 ×2.4)를 1→90에
  // 걸쳐 완만하게 편 것 — 기울기를 그대로 두면 후반 곡률이 주행 가능 한계(아래
  // CURVE 주석의 한계 속도 30%)를 넘어 코스가 물리적으로 깨진다.
  const segsTarget = Math.round(3750 + (no - 1) * 36.5);        // 코스 길이 (세그먼트)
  const curviness = 1 + (no - 1) * 0.0055;                      // 커브 곡률 배수
  const hilliness = 1 + (no - 1) * 0.0157;                      // 언덕 기복 배수
  const cpEvery = 900;                                          // 체크포인트 간격 (세그먼트)
  const cpBonus = M.CP_BONUS[no - 1];
  const startTime = M.START_TIME[no - 1];
  // 코스가 길어지는 만큼 대수도 늘리되, 단위 길이당 밀도가 3배씩 뛰지 않게 완만히
  const trafficN = Math.round((15 + (no - 1) * 0.367) * (boss ? 1.35 : 1));

  // ── 도로 세그먼트 조립 ──
  const segs = [];
  const lastY = () => (segs.length === 0 ? 0 : segs[segs.length - 1].p2.world.y);

  function addSegment(curve, y) {
    const n = segs.length;
    segs.push({
      index: n, curve,
      p1: { world: { x: 0, y: lastY(), z: n * M.SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { x: 0, y, z: (n + 1) * M.SEG_LEN }, camera: {}, screen: {} },
      color: Math.floor(n / M.RUMBLE_LEN) % 2,
      sprites: [], cars: [], cp: false,
    });
  }
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeOut = (a, b, p) => a + (b - a) * (1 - (1 - p) * (1 - p));
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  function addRoad(enter, hold, leave, curve, dy) {
    const y0 = lastY(), y1 = y0 + dy * M.SEG_LEN / 100;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total));
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(y0, y1, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSegment(easeOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total));
  }

  // 조각을 이어 붙이되 남은 길이에 맞춰 마지막 조각을 줄여, 코스 총 길이를 정확히 맞춘다.
  // (커브는 leave 구간에서 0으로 돌아오므로 결승 직선과 매끄럽게 이어진다)
  addRoad(0, LEN.SHORT * 2, 0, 0, 0);                            // 출발 직선
  while (segs.length < segsTarget) {
    const remain = segsTarget - segs.length;
    const kind = rng.next();
    const dir = rng.chance(0.5) ? 1 : -1;
    const lenKey = rng.pick([LEN.SHORT, LEN.MEDIUM, LEN.MEDIUM, LEN.LONG]);
    const dy = rng.chance(0.55)
      ? dir * rng.pick([HILL.LOW, HILL.MEDIUM, HILL.HIGH]) * hilliness * rng.range(0.5, 1)
      : 0;
    if (remain < 40) { addRoad(0, remain, 0, 0, dy * 0.3); break; }

    const straight = kind < 0.3;
    const curve = straight ? 0 : dir * rng.pick([CURVE.EASY, CURVE.MEDIUM, CURVE.HARD]) * curviness;
    let e = straight ? 0 : Math.round(lenKey / 2);
    let h = straight ? lenKey * 2 : lenKey;
    let l = straight ? 0 : Math.round(lenKey / 2);
    const need = e + h + l;
    if (need > remain) {                                         // 남은 길이에 맞춰 축소
      const k = remain / need;
      e = Math.round(e * k); h = Math.round(h * k); l = remain - e - h;
      if (l < 0) { h += l; l = 0; }
    }
    addRoad(e, h, l, curve, dy);
  }
  addRoad(0, LEN.SHORT, LEN.SHORT, 0, 0);                        // 결승 직선
  const total = segs.length;

  // ── 체크포인트 ──
  // 코스 전체에 균등 배치한다. 앞에서부터 cpEvery 간격으로 깔면 코스 길이에 따라
  // 마지막 체크포인트→결승 구간이 간격 상한을 넘는 코스가 생긴다.
  const checkpoints = [];
  const cpN = Math.ceil(total / cpEvery) - 1;
  const cpGap = Math.floor(total / (cpN + 1));
  for (let i = 1; i <= cpN; i++) { segs[i * cpGap].cp = true; checkpoints.push(i * cpGap); }

  // ── 노변 스프라이트 ──
  // 노변은 인공물만 둔다 — 실사 배경 위에 벡터 초목을 얹으면 화풍이 충돌한다.
  // 규칙적으로 지나가는 가로등이 속도감을 만든다.
  const spriteFrom = 40;
  for (let n = spriteFrom; n < total; n += 20) {
    segs[n].sprites.push({ type: 'lamp', offset: 1.32, scale: 1 });
    if (n % 100 === 0) segs[n].sprites.push({ type: 'sign', offset: -1.36, scale: 1 });
  }

  // ── 교통 (추월 대상) ──
  // 차선 중앙(-2/3 · 0 · +2/3)에 정렬해 제 차선을 지키며 달린다 — 표류·차선 이탈 없음
  const cars = [];
  for (let i = 0; i < trafficN; i++) {
    const z = rng.range(300, total - 120) * M.SEG_LEN;
    const lane = rng.int(0, M.LANES - 1);
    cars.push({
      offset: (lane - (M.LANES - 1) / 2) * (2 / M.LANES),
      lane, z,
      speed: M.MAX_SPEED * rng.range(0.22, 0.46),
      type: rng.pick(['sedan', 'van', 'truck', 'sedan']),
      hue: rng.int(0, 5),
    });
  }

  return {
    no, world, theme, boss, rival: RIVALS[no] || null,
    segs, total, length: total * M.SEG_LEN,
    checkpoints, cpEvery, cpBonus, startTime,
    curviness, hilliness, trafficN, cars,
    segAt(z) {
      const l = this.length;
      let zz = z % l; if (zz < 0) zz += l;
      return this.segs[Math.floor(zz / M.SEG_LEN) % this.total];
    },
  };
};
