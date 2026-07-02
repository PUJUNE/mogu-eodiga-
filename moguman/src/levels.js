// levels.js — 시드 기반 스테이지 생성 (고정 화면 아레나, 도달 가능 보장)
const M = window.MGM;

// 논리 해상도·아레나 상수 (logic.js와 공유)
M.W = 320; M.H = 240;
M.WALL = 10;             // 좌우 벽 두께
M.FLOOR = 222;           // 바닥 윗면 y
M.ROWS = [182, 142, 102, 62];   // 플랫폼 열 y (40 간격, 점프 정점 ~49)
M.PLAT_H = 8;

M.WORLDS = {
  1: { name: '모구네 거실', bg0: '#2a3550', bg1: '#3d4a6b', plat: '#8a6238', platTop: '#c89858', accent: '#ffd83d' },
  2: { name: '앞마당',      bg0: '#1d3a2a', bg1: '#2c5540', plat: '#5c7a3a', platTop: '#8fb85c', accent: '#9fe06a' },
  3: { name: '골목길',      bg0: '#3a2d3d', bg1: '#54405a', plat: '#6e6e78', platTop: '#a8a8b4', accent: '#ff9d5c' },
  4: { name: '지붕 위',     bg0: '#22304a', bg1: '#31456b', plat: '#8a4a26', platTop: '#c8764a', accent: '#5db8ff' },
  5: { name: '꿈속',        bg0: '#120a2a', bg1: '#241650', plat: '#54408c', platTop: '#8f68c8', accent: '#e08fff' },
};

// 월드별 적 풀 (누적 해금)
const ENEMY_POOLS = {
  1: ['mouse', 'mouse', 'mouse', 'fastmouse'],
  2: ['mouse', 'mouse', 'bird', 'bird', 'fastmouse'],
  3: ['mouse', 'bird', 'jumper', 'jumper', 'fastmouse'],
  4: ['mouse', 'bird', 'jumper', 'vacuum', 'vacuum'],
  5: ['mouse', 'bird', 'jumper', 'vacuum', 'fastmouse'],
};

const BOSSES = { 10: 'kingmouse', 20: 'crow', 30: 'bigvacuum', 40: 'shadowcat', 50: 'mouselord' };

// 보스전 고정 레이아웃: 양측 발판(1열) + 중앙 발판(2열) — 점프 40px 간격 준수
function bossLayout() {
  return [
    { x: M.WALL, y: 182, w: 110 },
    { x: M.W - M.WALL - 110, y: 182, w: 110 },
    { x: 96, y: 142, w: 128 },
  ];
}

// 일반 스테이지: 열마다 1~3개 구획, 각 구획은 아래 열(또는 바닥)과 24px 이상 겹침 강제
function genPlatforms(rng, rowCount) {
  const plats = [];
  let below = [{ x: M.WALL, w: M.W - M.WALL * 2 }];   // 바닥 = 전체 폭
  for (let r = 0; r < rowCount; r++) {
    const y = M.ROWS[r];
    const segs = [];
    const n = rng.int(1, r === 0 ? 2 : 3);
    let cursor = M.WALL + (rng.chance(0.5) ? 0 : rng.range(28, 60));
    for (let i = 0; i < n && cursor < M.W - M.WALL - 52; i++) {
      const maxW = Math.min(150, M.W - M.WALL - cursor - 8);
      if (maxW < 48) break;
      const w = rng.range(48, maxW);
      const seg = { x: cursor, y, w };
      // 아래 열과 24px 이상 겹침 → 점프로 도달 가능 보장
      const ok = below.some((b) => Math.min(seg.x + seg.w, b.x + b.w) - Math.max(seg.x, b.x) >= 24);
      if (ok) segs.push(seg);
      cursor += w + rng.range(44, 90);               // 구획 사이 44px 이상 = 점프 통과 틈
    }
    if (segs.length === 0) {
      // 최소 1구획: 아래 첫 구획 위에 겹쳐 배치
      const b = below[rng.int(0, below.length - 1)];
      const w = Math.max(48, Math.min(110, b.w));
      const x = Math.max(M.WALL, Math.min(M.W - M.WALL - w, b.x + (b.w - w) / 2));
      segs.push({ x, y, w });
    }
    plats.push(...segs);
    below = segs;
  }
  return plats;
}

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 41);
  const world = Math.min(5, Math.ceil(no / 10));
  const wi = (no - 1) % 10;                          // 월드 내 0~9
  const boss = BOSSES[no] || null;
  const theme = M.WORLDS[world];

  const platforms = boss ? bossLayout() : genPlatforms(rng, wi < 2 ? 3 : 4);

  // 적 스폰 (보스전은 부하를 보스가 소환)
  const enemies = [];
  if (!boss) {
    const pool = ENEMY_POOLS[world];
    const count = Math.min(8, 3 + Math.floor(wi * 0.6) + (world >= 4 ? 1 : 0));
    const spots = platforms.map((p) => ({ x: p.x + 10, x1: p.x + p.w - 10, y: p.y }));
    spots.push({ x: M.WALL + 14, x1: M.W - M.WALL - 14, y: M.FLOOR });
    for (let i = 0; i < count; i++) {
      const type = pool[rng.int(0, pool.length - 1)];
      const s = spots[rng.int(0, spots.length - 1)];
      let x = rng.range(s.x, s.x1);
      // 플레이어 시작점(중앙 바닥) 주변 70px 회피
      if (s.y === M.FLOOR && Math.abs(x - M.W / 2) < 70) x = x < M.W / 2 ? M.W / 2 - 75 : M.W / 2 + 75;
      x = Math.max(M.WALL + 10, Math.min(M.W - M.WALL - 10, x));
      enemies.push({ type, x, y: s.y });
    }
  }

  return { no, world, wi, theme, boss, platforms, enemies, angryAt: 50 };
};
