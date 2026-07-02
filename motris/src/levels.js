// levels.js — 스테이지 파라미터 + 방해 줄(garbage) 생성
const M = window.MTR;

M.COLS = 10; M.ROWS = 20;

M.THEMES = {
  1: { name: '모구네 거실', bg0: '#2a3550', bg1: '#3d4a6b', panel: '#1c2438', accent: '#ffd83d' },
  2: { name: '앞마당',      bg0: '#1d3a2a', bg1: '#2c5540', panel: '#142a1e', accent: '#9fe06a' },
  3: { name: '꿈속 밤하늘', bg0: '#120a2a', bg1: '#3a2860', panel: '#0e0820', accent: '#e08fff' },
};

// 조각 정의 (4회전 상태, 4×4 좌표)
M.PIECES = {
  I: { color: '#4ad8d0', rot: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]], [[0,2],[1,2],[2,2],[3,2]], [[1,0],[1,1],[1,2],[1,3]]] },
  O: { color: '#ffd83d', rot: [[[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]], [[1,0],[2,0],[1,1],[2,1]]] },
  T: { color: '#b06ae8', rot: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]] },
  S: { color: '#58c85c', rot: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]], [[1,1],[2,1],[0,2],[1,2]], [[0,0],[0,1],[1,1],[1,2]]] },
  Z: { color: '#ff5a5a', rot: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[1,2],[2,2]], [[1,0],[0,1],[1,1],[0,2]]] },
  J: { color: '#4a90ff', rot: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]] },
  L: { color: '#ff9d4a', rot: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]] },
};
M.PIECE_KEYS = Object.keys(M.PIECES);

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 211);
  const world = Math.min(3, Math.ceil(no / 10));
  const gravity = 0.9 + (no - 1) * 0.12;                 // 자동 낙하 (칸/초)
  const garbageRows = no < 4 ? 0 : Math.min(6, 1 + Math.floor((no - 4) / 5));
  const moguCount = garbageRows === 0 ? 0 : Math.min(4, 2 + Math.floor((no - 1) / 12));

  // 방해 줄: 아래에서부터, 줄마다 구멍 1~2개 (클리어 가능 보장)
  const garbage = [];                                    // {row(0=바닥), cells:[{c, mogu}]}
  const moguSpots = [];
  for (let r = 0; r < garbageRows; r++) {
    const holes = new Set([rng.int(0, 9)]);
    if (rng.chance(0.35)) holes.add(rng.int(0, 9));
    const cells = [];
    for (let c = 0; c < 10; c++) if (!holes.has(c)) cells.push({ c, mogu: false });
    garbage.push({ row: r, cells });
    for (const cell of cells) moguSpots.push(cell);
  }
  // 모구를 방해 줄 칸에 배치 (구멍과 안 겹침 — cells 자체가 구멍 제외)
  let placed = 0;
  while (placed < moguCount && moguSpots.length > 0) {
    const i = rng.int(0, moguSpots.length - 1);
    if (!moguSpots[i].mogu) { moguSpots[i].mogu = true; placed++; }
    moguSpots.splice(i, 1);
  }

  return {
    no, world, theme: M.THEMES[world],
    gravity, goal: 10,
    garbage, moguTrapped: placed,
    pieceMoguP: 0.08,                                    // 낙하 조각의 모구 칸 확률
  };
};
