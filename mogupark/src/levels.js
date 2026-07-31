// levels.js — 시드 기반 주차장 생성: 슬롯 열·주차 차량·기둥·연석·시작 위치
// 좌표: x = 동, z = 북 (미터, 지면 y=0). 헤딩 h: 전방 = (sin h, cos h), h=0 → +z.
// 차로는 x축을 따라 놓이고(중심 z=0), 슬롯 열은 차로 북/남쪽에 붙는다.
const M = window.MPK;

// 차체 규격 — logic(물리·판정)과 levels(칸 여유 계산)가 같은 값을 쓴다
M.CAR = { L: 4.4, W: 1.76, WB: 2.65, LOCK: 0.61 };

M.COURSES = 50;

// ── 난이도 모드 (시리즈 공통 문법) ──
// 기하 전부를 바꾸지 않고 제한시간 배율과 칸 여유폭 가감만 조절한다.
// slotAdd를 빼도 생성 하한(칸 폭 ≥ 차폭+0.30 등)은 지켜진다 — level-test가 전수 검증.
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     timeMul: 1.5,  slotAdd: 0.14 },
  normal: { name: '노말',     timeMul: 1.0,  slotAdd: 0 },
  hard:   { name: '하드',     timeMul: 0.88, slotAdd: -0.06 },
  crazy:  { name: '크레이지', timeMul: 0.75, slotAdd: -0.12 },
};
M.diff = 'normal';

// 주차된 차 도색 — 플랫 셰이딩(주변광 0.62)을 거쳐도 검게 뭉개지지 않을 밝기로 잡는다
M.CAR_HUES = ['#d3d8de', '#5a6d80', '#b0493c', '#4a7ab0', '#6a6e76', '#cfc0a4', '#7a9070', '#96688c'];

M.WORLDS = {
  1: { name: '운전연습장', bg: 1, dark: false, outside: '#7d8f6a', asphalt: '#5a5e64', asphalt2: '#555960',
       line: '#e8e8e8', target: '#ffd83d', curbC: '#c9c9c2', wallC: '#9aa4ae',
       sky0: '#3f8fd8', sky1: '#cfe7f2' },
  2: { name: '마트 주차장', bg: 3, dark: false, outside: '#948a76', asphalt: '#53575f', asphalt2: '#4e525a',
       line: '#e8e8e8', target: '#ffd83d', curbC: '#c4c4bc', wallC: '#8f96a0',
       sky0: '#3f8fd8', sky1: '#f6e2b0' },
  3: { name: '골목 평행주차', bg: 5, dark: false, outside: '#4c5058', asphalt: '#4e5258', asphalt2: '#494d53',
       line: '#dcdcd4', target: '#ffd83d', curbC: '#c2beb2', wallC: '#7a716a',
       sky0: '#2a3a5c', sky1: '#8a86a0' },
  4: { name: '지하주차장', bg: 0, dark: true, outside: '#26282e', asphalt: '#3a3d45', asphalt2: '#363940',
       line: '#d8d8c4', target: '#ffd83d', curbC: '#8f8d84', wallC: '#5d6067',
       sky0: '#1e2026', sky1: '#2a2c34' },
  5: { name: '복합 시험장', bg: 2, dark: false, outside: '#9c8668', asphalt: '#565a60', asphalt2: '#51555b',
       line: '#ffd83d', target: '#7de08a', curbC: '#cfc7b4', wallC: '#a08a6c',
       sky0: '#2a5fa8', sky1: '#f0c48a' },
};

// 스테이지 → 과제 유형
function typeOf(no) {
  if (no <= 3) return 'bay-front';
  if (no <= 10) return 'bay';
  if (no <= 20) return 'bay2';            // 양쪽 만차 열 + 카트
  if (no <= 30) return 'parallel';
  if (no <= 40) return 'pillar';          // 지하 기둥 T자
  if (no === 50) return 'final';
  return ['angled', 'bay-tight', 'parallel-tight', 'pillar-tight'][(no - 41) % 4];
}
M.TYPE_NAMES = {
  'bay-front': '전진 주차', bay: '후진 T자', bay2: '후진 T자', parallel: '평행 주차',
  pillar: '기둥 사이 T자', angled: '사선 주차', 'bay-tight': '협소 T자',
  'parallel-tight': '극한 평행', 'pillar-tight': '기둥 협소 T자', final: '최종 시험',
};

const lerp = (a, b, p) => a + (b - a) * Math.min(1, Math.max(0, p));

M.makeStage = function (no) {
  const rng = M.makeRng(no * 6271 + 977);
  const world = Math.min(5, Math.ceil(no / 10));
  const theme = M.WORLDS[world];
  const type = typeOf(no);
  const D = M.DIFFS[M.diff] || M.DIFFS.normal;
  const t = (no - 1) / (M.COURSES - 1);       // 0→1 전체 진행도
  const C = M.CAR;

  // ── 공통 파라미터 (하한은 크레이지 포함 주차 가능선) ──
  const pillarComp = (type === 'pillar' || type === 'pillar-tight' || type === 'final') ? 0.42 : 0;
  let margin = { 'bay-front': 1.1, bay: lerp(1.0, 0.85, (no - 4) / 6), bay2: lerp(0.85, 0.62, (no - 11) / 9),
    parallel: 0.9, pillar: lerp(0.78, 0.58, (no - 31) / 9), angled: 0.62, 'bay-tight': 0.5,
    'parallel-tight': 0.8, 'pillar-tight': 0.52, final: 0.5 }[type] + D.slotAdd + pillarComp;
  margin = Math.max(0.32 + pillarComp, margin);
  const slotW = C.W + margin;
  const slotL = C.L + lerp(1.0, 0.55, t);
  let laneW = { 'bay-front': 9.0, bay: lerp(7.8, 6.6, (no - 4) / 6), bay2: lerp(7.2, 6.0, (no - 11) / 9),
    parallel: 0, pillar: lerp(6.4, 5.5, (no - 31) / 9), angled: 5.8, 'bay-tight': 5.4,
    'parallel-tight': 0, 'pillar-tight': 5.2, final: 5.2 }[type];
  laneW = Math.max(5.0, laneW);
  const occupancy = Math.min(0.95, 0.45 + no * 0.01);

  const obstacles = [], slots = [];
  let start, lot, target;
  const parkedCar = (slot, rng) => ({
    kind: 'car', hue: rng.int(0, M.CAR_HUES.length - 1),
    x: slot.x + rng.range(-0.07, 0.07), z: slot.z + rng.range(-0.1, 0.1),
    w: C.W, l: C.L,
    yaw: slot.yaw + (rng.chance(0.45) ? Math.PI : 0) + rng.range(-0.035, 0.035),
  });

  // ══ T자(직각) 열 배치 — bay 계열 공통 ══
  if (type !== 'parallel' && type !== 'parallel-tight' && type !== 'angled') {
    const N = 11;
    const spacing = slotW;
    const rowX0 = -N * spacing / 2;
    const rowZ = laneW / 2 + slotL / 2;
    const i0 = rng.int(4, 6);                                  // 목표 칸 (중앙 근처)
    const twoSided = type === 'bay2' || type === 'final';
    const withPillars = pillarComp > 0;

    for (let i = 0; i < N; i++) {
      const slot = { x: rowX0 + (i + 0.5) * spacing, z: rowZ, yaw: 0, w: slotW - 0.06, l: slotL,
        target: i === i0, occupied: false };
      if (!slot.target) {
        const forced = type !== 'bay-front' && Math.abs(i - i0) === 1;  // 목표 양옆은 만차
        slot.occupied = forced || rng.chance(occupancy);
        if (type === 'bay-front' && Math.abs(i - i0) === 1) slot.occupied = no === 3; // 1~2판은 옆이 빔
      }
      slots.push(slot);
      if (slot.occupied) obstacles.push(parkedCar(slot, rng));
    }
    if (twoSided) {
      for (let i = 0; i < N; i++) {
        const slot = { x: rowX0 + (i + 0.5) * spacing, z: -rowZ, yaw: 0, w: slotW - 0.06, l: slotL,
          target: false, occupied: rng.chance(0.9) };
        slots.push(slot);
        if (slot.occupied) obstacles.push(parkedCar(slot, rng));
      }
    }
    target = slots[i0];

    // 기둥 — 칸 경계선 위에 세운다. 후반은 목표 칸 양쪽 경계에 바로 붙는다.
    if (withPillars) {
      const bounds = [];
      const tight = type === 'pillar-tight' || type === 'final' || no >= 36;
      if (tight) bounds.push(i0, i0 + 1);
      else bounds.push(i0 - 1, i0 + 2);
      for (let i = 0; i <= N; i += 3) if (!bounds.includes(i) && Math.abs(i - i0 - 0.5) > 1.6) bounds.push(i);
      for (const b of bounds) {
        obstacles.push({ kind: 'pillar', x: rowX0 + b * spacing, z: rowZ, w: 0.52, l: 0.52, yaw: 0 });
        if (twoSided) obstacles.push({ kind: 'pillar', x: rowX0 + b * spacing, z: -rowZ, w: 0.52, l: 0.52, yaw: 0 });
      }
    }

    // 카트(콘) — 차로 가장자리, 목표 진입로에서 비켜 둔다
    if (type === 'bay2') {
      const nCones = rng.int(2, 4);
      for (let i = 0; i < nCones; i++) {
        const side = rng.chance(0.5) ? 1 : -1;
        const cx = target.x + side * rng.range(4.5, 10);
        obstacles.push({ kind: 'cone', x: cx, z: rng.pick([1, -1]) * (laneW / 2 - 0.5), w: 0.34, l: 0.34, yaw: rng.range(0, 3) });
      }
    }

    // ── 시작 위치 ──
    const startDist = lerp(8, 13, t);
    if (type === 'bay-front') {
      // 튜토리얼: 칸 정면 6m 앞에서 슬롯을 마주 보고 시작 (3판은 3m 옆으로 어긋남)
      start = { x: target.x + (no === 3 ? 3 : 0), z: rowZ - slotL / 2 - 6, h: no === 3 ? -0.25 : 0 };
    } else {
      const fromLeft = rng.chance(0.5);
      start = { x: target.x + (fromLeft ? -startDist : startDist), z: twoSided ? 0 : -laneW / 2 + C.W / 2 + 0.9,
        h: fromLeft ? Math.PI / 2 : -Math.PI / 2 };
    }

    // ── 경계 (연석 or 벽) ──
    const x0 = Math.min(rowX0, start.x - 5) - 2.5, x1 = Math.max(rowX0 + N * spacing, start.x + 5) + 2.5;
    const zTop = rowZ + slotL / 2, zBot = twoSided ? -zTop : -laneW / 2;
    lot = { x0, z0: zBot - 0.6, x1, z1: zTop + 0.6 };
    const edge = world === 4 ? 'wall' : 'curb';
    const put = (kind, x, z, w, l) => obstacles.push({ kind, x, z, w, l, yaw: 0 });
    put(edge, (x0 + x1) / 2, zTop + 0.25, x1 - x0, edge === 'wall' ? 0.35 : 0.24);        // 열 뒤
    if (twoSided) put(edge, (x0 + x1) / 2, zBot - 0.25, x1 - x0, edge === 'wall' ? 0.35 : 0.24);
    else put('curb', (x0 + x1) / 2, zBot - 0.12, x1 - x0, 0.24);                          // 차로 남쪽
    put(edge, x0 + 0.2, 0, edge === 'wall' ? 0.35 : 0.24, lot.z1 - lot.z0);               // 양끝
    put(edge, x1 - 0.2, 0, edge === 'wall' ? 0.35 : 0.24, lot.z1 - lot.z0);
  }

  // ══ 평행 주차 — 남쪽 연석에 붙여 세운 열의 빈틈으로 후진 ══
  else if (type === 'parallel' || type === 'parallel-tight') {
    const streetW = Math.max(4.2, type === 'parallel' ? lerp(6.4, 4.9, (no - 21) / 9) : 4.6);
    const gapMargin = Math.max(0.7, (type === 'parallel' ? lerp(2.1, 1.05, (no - 21) / 9) : 0.82) + D.slotAdd * 2);
    const gapLen = C.L + gapMargin;
    const curbZ = -streetW / 2;
    const carZ = curbZ + C.W / 2 + 0.14;
    const gapX = 0;

    // 목표 칸: 간격 그 자체. 연석에서 도로 쪽 2.2m 안에 들어와야 한다.
    target = { x: gapX, z: curbZ + 1.1, yaw: Math.PI / 2, w: 2.2, l: gapLen, target: true, occupied: false };
    slots.push(target);

    // 앞뒤로 이어지는 주차 열
    for (const dir of [-1, 1]) {
      let x = gapX + dir * (gapLen / 2 + C.L / 2 + 0.05);
      for (let i = 0; i < 3; i++) {
        obstacles.push({ kind: 'car', hue: rng.int(0, M.CAR_HUES.length - 1),
          x: x + rng.range(-0.05, 0.05), z: carZ + rng.range(-0.04, 0.06), w: C.W, l: C.L,
          yaw: Math.PI / 2 + rng.range(-0.02, 0.02) });
        x += dir * (C.L + rng.range(0.8, 1.4));
      }
    }

    // 간격 앞차 옆에 나란히 선 상태에서 시작 (클래식 평행주차 진입 자세)
    start = { x: gapX + gapLen / 2 + C.L * 0.62, z: carZ + C.W + 0.55, h: Math.PI / 2 };
    lot = { x0: gapX - 15, z0: curbZ - 2.6, x1: gapX + 15, z1: streetW / 2 + 1.6 };
    obstacles.push({ kind: 'curb', x: 0, z: curbZ - 0.12, w: lot.x1 - lot.x0, l: 0.24, yaw: 0 });
    obstacles.push({ kind: 'wall', x: 0, z: curbZ - 1.9, w: lot.x1 - lot.x0, l: 0.5, yaw: 0 });      // 남쪽 담장
    obstacles.push({ kind: 'curb', x: 0, z: streetW / 2 + 0.12, w: lot.x1 - lot.x0, l: 0.24, yaw: 0 });
    obstacles.push({ kind: 'wall', x: 0, z: streetW / 2 + 1.2, w: lot.x1 - lot.x0, l: 0.5, yaw: 0 }); // 북쪽 건물
  }

  // ══ 사선 주차 — 기울어진 칸에 전진 진입 ══
  else {
    const tilt = 0.62;                                          // 칸 축이 +x 쪽으로 기운 각
    const N = 9;
    const spacing = (slotW + 0.12) / Math.cos(tilt);
    const rowX0 = -N * spacing / 2;
    const rowZ = laneW / 2 + (slotL / 2) * Math.cos(tilt);
    const i0 = rng.int(3, 5);
    for (let i = 0; i < N; i++) {
      const slot = { x: rowX0 + (i + 0.5) * spacing + (slotL / 2) * Math.sin(tilt) * 0.5, z: rowZ,
        yaw: tilt, w: slotW - 0.06, l: slotL, target: i === i0, occupied: false };
      if (!slot.target) { slot.occupied = Math.abs(i - i0) === 1 || rng.chance(occupancy); }
      slots.push(slot);
      if (slot.occupied) obstacles.push(parkedCar(slot, rng));
    }
    target = slots[i0];
    const startDist = lerp(9, 12, t);
    start = { x: target.x - startDist, z: -laneW / 2 + C.W / 2 + 0.8, h: Math.PI / 2 };  // 사선은 일방통행 진입
    const x0 = Math.min(rowX0, start.x - 5) - 2.5, x1 = rowX0 + N * spacing + 4;
    lot = { x0, z0: -laneW / 2 - 0.6, x1, z1: rowZ + slotL / 2 + 1.2 };
    obstacles.push({ kind: 'curb', x: (x0 + x1) / 2, z: lot.z1 - 0.3, w: x1 - x0, l: 0.24, yaw: 0 });
    obstacles.push({ kind: 'curb', x: (x0 + x1) / 2, z: -laneW / 2 - 0.12, w: x1 - x0, l: 0.24, yaw: 0 });
    obstacles.push({ kind: 'curb', x: x0 + 0.2, z: 0, w: 0.24, l: lot.z1 - lot.z0, yaw: 0 });
    obstacles.push({ kind: 'curb', x: x1 - 0.2, z: 0, w: 0.24, l: lot.z1 - lot.z0, yaw: 0 });
  }

  // ── 제한시간 ──
  const baseTime = { 'bay-front': 70, bay: 90, bay2: 95, parallel: 125, pillar: 115,
    angled: 90, 'bay-tight': 110, 'parallel-tight': 145, 'pillar-tight': 120, final: 170 }[type];
  const timeLimit = Math.round((baseTime + (no - 1) * 0.4) * D.timeMul / 5) * 5;

  return { no, world, theme, type, typeName: M.TYPE_NAMES[type], timeLimit,
    lot, obstacles, slots, target, start, slotW, slotL, laneW };
};
