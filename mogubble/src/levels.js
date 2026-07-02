// levels.js — 라운드(스테이지) 배치 생성: 육각 오프셋 그리드, 좌우 대칭 패턴
const M = window.MGB;

// 그리드·플레이필드 상수 (logic·render 공유)
M.W = 320; M.H = 560;
M.D = 32;                       // 방울 지름
M.ROW_H = 28;                   // 줄 간격 (육각)
M.WALL_L = 32; M.WALL_R = 288;  // 플레이필드 좌우 벽 (내폭 256 = 8칸)
M.CEIL_Y = 36;                  // 천장 (row 0 상단)
M.DEADLINE = 392;               // 데드라인 y
M.LAUNCH_X = 160; M.LAUNCH_Y = 476;
M.MAX_SHOTS = 8;                // 압축 하강까지 발수
M.COLORS = ['#ff5a5a', '#4a90ff', '#ffd83d', '#58c85c', '#b06ae8', '#4ad8d0'];

M.THEMES = {
  1: { name: '모구네 거실',   bg0: '#2a3550', bg1: '#3d4a6b', wall: '#8a6238', accent: '#ffd83d' },
  2: { name: '비 오는 마당',  bg0: '#1d3a2a', bg1: '#2c5540', wall: '#5c7a3a', accent: '#9fe06a' },
  3: { name: '꿈속 밤하늘',   bg0: '#120a2a', bg1: '#3a2860', wall: '#54408c', accent: '#e08fff' },
};

// 줄별 칸수·셀 중심 좌표 (짝수 줄 8칸, 홀수 줄 7칸 — 반 칸 오프셋)
M.colsOf = (r) => (r % 2 === 0 ? 8 : 7);
M.cellX = (r, c) => M.WALL_L + M.D / 2 + c * M.D + (r % 2) * (M.D / 2);
// y는 압축 오프셋 포함 (logic이 st.drop 전달)
M.cellY = (r, drop) => M.CEIL_Y + M.D / 2 + (r + (drop || 0)) * M.ROW_H;

// 이웃 좌표 (오프셋 육각)
M.neighbors = (r, c) => {
  const odd = r % 2;
  return odd
    ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
    : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
};

// 라운드 배치: Map "r,c" → 색 인덱스
M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 113);
  const world = Math.min(3, Math.ceil(no / 10));
  const rows = Math.min(6, 3 + Math.floor((no - 1) / 8));
  const nColors = Math.min(6, 3 + Math.floor((no - 1) / 7));
  const holeP = no > 12 ? Math.min(0.22, (no - 12) * 0.02) : 0;

  const grid = new Map();
  for (let r = 0; r < rows; r++) {
    const cols = M.colsOf(r);
    const half = Math.ceil(cols / 2);
    for (let c = 0; c < half; c++) {
      if (r > 0 && rng.chance(holeP)) continue;        // row 0은 구멍 없음 (천장 부착 보장)
      const col = rng.int(0, nColors - 1);
      grid.set(r + ',' + c, col);
      grid.set(r + ',' + (cols - 1 - c), col);         // 좌우 대칭
    }
  }
  // 부유 방울 제거 (구멍 때문에 천장과 끊긴 덩어리)
  const seen = new Set();
  const q = [];
  for (let c = 0; c < 8; c++) if (grid.has('0,' + c)) { seen.add('0,' + c); q.push([0, c]); }
  while (q.length) {
    const [r, c] = q.shift();
    for (const [nr, nc] of M.neighbors(r, c)) {
      const k = nr + ',' + nc;
      if (grid.has(k) && !seen.has(k)) { seen.add(k); q.push([nr, nc]); }
    }
  }
  for (const k of [...grid.keys()]) if (!seen.has(k)) grid.delete(k);

  return { no, world, theme: M.THEMES[world], grid, nColors };
};
