// levels.js — 스테이지 벽돌 배치 생성 (24스테이지, 패턴 8종 × 테마 6종)
const M = window.MBK;

M.W = 480; M.H = 270;
M.TOTAL = 24;
M.COLS = 12; M.BW = 36; M.BH = 13;
M.X0 = 24; M.Y0 = 40;
M.TOP = 22;                       // 천장 (HUD 아래)

M.THEMES = [
  { name: '캔디 광장',   bg0: '#2a1a3a', bg1: '#4a2a5a', accent: '#ff8ab0', rows: ['#ff8ab0', '#ffb06a', '#ffe066', '#7de08a', '#6ac8ff', '#c8a0ff', '#ff9a8a', '#8ae0d0', '#f0c8ff'] },
  { name: '바다 유적',   bg0: '#0a2438', bg1: '#14486a', accent: '#4ac8f0', rows: ['#4ac8f0', '#6ae0c8', '#a0e8ff', '#3a9ad8', '#7de08a', '#c8e8a0', '#5ab0ff', '#8ad0e8', '#b0f0d8'] },
  { name: '숲속 성벽',   bg0: '#14260e', bg1: '#2a4a1e', accent: '#9fe06a', rows: ['#9fe06a', '#ffe066', '#7dc84a', '#c8a050', '#a8e088', '#e8c86a', '#88b858', '#d0e090', '#b8d070'] },
  { name: '노을 요새',   bg0: '#301018', bg1: '#5c2428', accent: '#ff9a5a', rows: ['#ff9a5a', '#ff7d7d', '#ffd06a', '#e06a9a', '#ffb088', '#ff8ab0', '#f0c060', '#ff6a6a', '#ffca9a'] },
  { name: '한밤 미궁',   bg0: '#0e0a24', bg1: '#241a4a', accent: '#b07dff', rows: ['#b07dff', '#7d8aff', '#e08aff', '#6ac8ff', '#c8a0ff', '#9a7dff', '#ff8ad8', '#8aa0ff', '#d8b0ff'] },
  { name: '용암 지하',   bg0: '#240a08', bg1: '#4a1810', accent: '#ff6a3d', rows: ['#ff6a3d', '#ffb03d', '#ff8a5a', '#e05a3a', '#ffd06a', '#ff7d50', '#f09a40', '#ff5a50', '#ffc888'] },
];

M.STORY = {
  1: '벽돌 성에 모구들이 갇혔다! 공을 튕겨 구출 개시',
  7: '강철 벽돌 등장 — 깨지지 않으니 돌아서 가자',
  13: '갇힌 모구가 늘었다. 한 마리도 놓치지 말 것',
  19: '마지막 구역 — 모든 모구를 집으로!',
};

// 스테이지별 공 속도
M.speed = (no) => Math.min(225, 150 + no * 3);

// 벽돌 배치 생성: kind = 'n'(일반 1타) | 'hard'(2타) | 'steel'(불괴) | 'mogu'(모구 구출)
M.makeStage = function (no) {
  const n = Math.max(1, Math.min(M.TOTAL, no));
  const rng = M.makeRng(n * 6133 + 41);
  const theme = M.THEMES[Math.floor((n - 1) / 4) % 6];
  const pat = (n - 1) % 8;
  const rows = 4 + Math.min(5, Math.floor((n - 1) / 5));
  const mid = (rows - 1) / 2;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < M.COLS; c++) {
      let on = false;
      if (pat === 0) on = true;
      else if (pat === 1) on = (c + r) % 2 === 0;
      else if (pat === 2) on = Math.abs(c - 5.5) <= (r + 0.5) * (6 / rows);
      else if (pat === 3) on = Math.abs(c - 5.5) / 6 + Math.abs(r - mid) / (rows / 2) <= 0.95;
      else if (pat === 4) on = c % 3 !== 2;
      else if (pat === 5) on = (c + r * 2) % 5 !== 0;
      else if (pat === 6) on = r === 0 || r === rows - 1 || c === 0 || c === M.COLS - 1 || (r === Math.round(mid) && c >= 4 && c <= 7);
      else on = rng.chance(0.62);
      if (on) cells.push({ c, r });
    }
  }

  const hardP = Math.min(0.4, 0.05 + n * 0.015);
  const bricks = cells.map(({ c, r }) => ({
    c, r, kind: rng.chance(hardP) ? 'hard' : 'n', hp: 1,
  }));
  for (const b of bricks) if (b.kind === 'hard') b.hp = 2;

  // 강철 (스테이지 7+): 불괴 장애물
  const steelN = n >= 7 ? Math.min(6, 2 + Math.floor((n - 7) / 4)) : 0;
  for (let i = 0; i < steelN && bricks.length > 14; i++) {
    const b = bricks[rng.int(0, bricks.length - 1)];
    if (b.kind !== 'steel') { b.kind = 'steel'; b.hp = Infinity; }
  }

  // 모구 벽돌: 깨면 모구 낙하 → 바로 받아 구출
  const moguN = 2 + Math.floor((n - 1) / 8);
  const breakables = bricks.filter((b) => b.kind !== 'steel');
  let placed = 0;
  while (placed < moguN) {
    const b = breakables[rng.int(0, breakables.length - 1)];
    if (b.kind === 'mogu') continue;
    b.kind = 'mogu'; b.hp = 1;
    placed++;
  }

  return { no: n, theme, rows, bricks, moguN, spd: M.speed(n) };
};
