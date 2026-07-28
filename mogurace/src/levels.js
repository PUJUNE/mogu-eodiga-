// levels.js — 시드 기반 코스 생성: 도로 세그먼트(커브·언덕) + 교통 + 노변 스프라이트
// 좌표: z = 전진, y = 고도, x = 도로 중심 기준 좌우(도로 반폭 = 1.0)
const M = window.MRC;

M.SEG_LEN = 200;        // 세그먼트 1개의 z 길이 (월드 단위)
M.ROAD_W = 2000;        // 도로 반폭 (월드 단위)
M.LANES = 3;
M.RUMBLE_LEN = 3;       // 갓길 줄무늬 교대 주기 (세그먼트)
M.MAX_SPEED = M.SEG_LEN * 60;   // 초당 60세그먼트 = 12000

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
};

const RIVALS = { 6: '갈매기 배달차', 12: '협곡 폭주쥐', 18: '모래바람 트럭', 24: '설원 제설차', 30: '야경 킹쥐' };

// 제한시간 — 숙련 봇 주행의 실제 구간 소요 × 여유율(55%→25%)로 구워낸 표.
// (재생성 방법: test/tune.mjs — 물리·트랙 상수를 바꾸면 반드시 다시 구워야 함)
M.START_TIME = [22, 19, 19, 21.5, 22.5, 22, 18.5, 18.5, 18, 18, 23.5, 17.5, 23.5, 18, 20.5,
  23, 20.5, 17, 24, 26, 16.5, 16.5, 17.5, 17, 18.5, 25.5, 18, 24, 18, 18];
M.CP_BONUS = [18.5, 19.5, 20.5, 19.5, 24, 19, 20, 20, 18, 19.5, 22.5, 20.5, 21.5, 18.5, 20.5,
  21, 23, 21, 22, 19, 22.5, 23.5, 22.5, 20, 23, 23, 23, 21.5, 24.5, 23];

// ── 트랙 조각 규격 ──
const LEN = { SHORT: 60, MEDIUM: 130, LONG: 240 };
// 커브 값은 원심력 계수(0.32)·조향 권한(1.25)과 물려 있다.
// 한계 속도 = 1.25 / (curve × 0.32) — 이 값이 30% 밑으로 떨어지면 주행이 불가능해진다.
const CURVE = { EASY: 1.8, MEDIUM: 3.4, HARD: 5.4 };
const HILL = { LOW: 24, MEDIUM: 48, HIGH: 82 };

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 131);
  const world = Math.min(5, Math.ceil(no / 6));
  const theme = M.WORLDS[world];
  const boss = no % 6 === 0;

  // ── 난이도 프로파일 ──
  const segsTarget = Math.round(2500 + (no - 1) * 75);          // 코스 길이 (세그먼트)
  const curviness = 1 + (no - 1) * 0.017;                       // 커브 곡률 배수
  const hilliness = 1 + (no - 1) * 0.048;                       // 언덕 기복 배수
  const cpEvery = 600;                                          // 체크포인트 간격 (세그먼트)
  const cpBonus = M.CP_BONUS[no - 1];
  const startTime = M.START_TIME[no - 1];
  // 코스가 길어지는 만큼 대수도 늘리되, 단위 길이당 밀도가 3배씩 뛰지 않게 완만히
  const trafficN = Math.round((10 + (no - 1) * 0.75) * (boss ? 1.35 : 1));

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
  const checkpoints = [];
  for (let s = cpEvery; s < total - LEN.SHORT; s += cpEvery) { segs[s].cp = true; checkpoints.push(s); }

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
