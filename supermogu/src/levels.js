// levels.js — 타일 스테이지 생성 (8월드 × 4, 시드 결정적)
const M = window.SMG;

M.W = 480; M.H = 270;
M.TILE = 16;
M.ROWS = 17;                     // 세로 17타일 (272px, 마지막 줄 지면 아래)

// 타일 코드
M.T = { AIR: 0, GND: 1, BRICK: 2, Q: 3, USED: 4, PIPE: 5, PIPE_T: 6, BLOCK: 7, LAVA: 8, FLAG: 9, CASTLE: 10 };

M.WORLDS = {
  1: { name: '초원',     sky0: '#63a4f0', sky1: '#b8ddf8', gnd: '#8a5a30', top: '#5db84a', deco: '#3a8a2a' },
  2: { name: '사막',     sky0: '#f0c878', sky1: '#fae8b8', gnd: '#c09858', top: '#e0c084', deco: '#8a6a3a' },
  3: { name: '숲',       sky0: '#2a6a4a', sky1: '#6aa87a', gnd: '#6a4a28', top: '#4a9a3a', deco: '#1e4a2e' },
  4: { name: '바다 절벽', sky0: '#4a8ac8', sky1: '#a8d4ee', gnd: '#7a7068', top: '#9aa27a', deco: '#3a6a9a' },
  5: { name: '설원',     sky0: '#a8c8e8', sky1: '#e8f2fa', gnd: '#8ea6b4', top: '#f0f6fa', deco: '#6a8aa4' },
  6: { name: '동굴',     sky0: '#1a1428', sky1: '#3a3050', gnd: '#5a5068', top: '#7a7088', deco: '#2a2438' },
  7: { name: '하늘',     sky0: '#7ab8f4', sky1: '#d8eefc', gnd: '#e8e4d8', top: '#f8f4ea', deco: '#ffffff' },
  8: { name: '마왕성',   sky0: '#1a0a14', sky1: '#40182a', gnd: '#584858', top: '#6a5a6a', deco: '#8a2030' },
};

M.stageNo = (world, sub) => (world - 1) * 4 + sub;
M.worldOf = (no) => ({ world: Math.floor((no - 1) / 4) + 1, sub: ((no - 1) % 4) + 1 });

M.makeStage = function (no) {
  const s = Math.max(1, Math.min(32, no));
  const { world, sub } = M.worldOf(s);
  const castle = sub === 4;
  const rng = M.makeRng(s * 7919 + 4507);
  const t = (s - 1) / 31;
  const T = M.T;

  const len = castle ? 130 : Math.round(150 + t * 70 + sub * 8);   // 가로 타일 수
  const R = M.ROWS;
  const g = new Array(len);                       // g[x][y]
  for (let x = 0; x < len; x++) g[x] = new Array(R).fill(T.AIR);
  const gndY = R - 2;                             // 기본 지면 y (15)

  const enemies = [];
  const fill = (x, yTop) => { for (let y = yTop; y < R; y++) g[x][y] = T.GND; };

  if (!castle) {
    // ── 필드: 세그먼트 연쇄 ──
    let x = 0;
    while (x < 14) { fill(x, gndY); x++; }        // 시작 안전지대
    const endSafe = len - 14;
    let lastGap = false;
    while (x < endSafe) {
      const r = rng.next();
      if (r < 0.16 && x > 20 && !lastGap) {
        // 갭 (점프 상한 4타일)
        const w = rng.int(2, Math.min(4, 2 + Math.floor(t * 3)));
        x += w;
        lastGap = true;
        continue;
      } else if (r < 0.3) {
        // 토관
        const flat = rng.int(3, 5);
        for (let i = 0; i < flat; i++) { fill(x, gndY); x++; }
        const ph = rng.int(2, 3);
        fill(x, gndY); fill(x + 1, gndY);
        for (let y = gndY - ph; y < gndY; y++) { g[x][y] = T.PIPE; g[x + 1][y] = T.PIPE; }
        g[x][gndY - ph] = T.PIPE_T; g[x + 1][gndY - ph] = T.PIPE_T;
        x += 2;
      } else if (r < 0.48) {
        // 벽돌·?블록 열 (공중 4타일 위)
        const w = rng.int(3, 6);
        const y = gndY - 4;
        for (let i = 0; i < w; i++) {
          fill(x, gndY);
          g[x][y] = rng.chance(0.38) ? T.Q : T.BRICK;
          if (rng.chance(0.5) && i > 0) enemies.push({ type: rng.chance(0.7) ? 'rat' : 'hedge', tx: x, ty: gndY - 1 });
          x++;
        }
      } else if (r < 0.6) {
        // 언덕 (계단 오르내림)
        const h = rng.int(2, 4);
        for (let i = 0; i < h; i++) { fill(x, gndY - 1 - i); x++; }
        const top = rng.int(2, 4);
        for (let i = 0; i < top; i++) { fill(x, gndY - h); x++; }
        for (let i = h - 1; i >= 0; i--) { fill(x, gndY - 1 - i); x++; }
      } else {
        // 평지 + 적
        const w = rng.int(4, 9);
        for (let i = 0; i < w; i++) {
          fill(x, gndY);
          if (i === 2 && rng.chance(0.34 + t * 0.3)) {
            enemies.push({ type: rng.chance(0.6) ? 'rat' : rng.chance(0.5) ? 'bird' : 'hedge', tx: x, ty: gndY - 1 });
          }
          x++;
        }
      }
      lastGap = false;
      if (x >= endSafe) break;
    }
    // 골인 계단 + 깃발 + 성
    for (let i = 0; i < 8 && x < len; i++) {
      for (let k = 0; k <= i; k++) g[x][gndY - 1 - k] = T.BLOCK;
      fill(x, gndY); x++;
    }
    while (x < len) { fill(x, gndY); x++; }
    g[len - 8][gndY - 9] = T.FLAG;                // 깃발 폴 상단 마커
    for (let y = gndY - 8; y < gndY; y++) g[len - 8][y] = T.FLAG;
    for (let cx = len - 5; cx < len - 1; cx++) {
      for (let y = gndY - 4; y < gndY; y++) g[cx][y] = T.CASTLE;
    }
  } else {
    // ── 성: 천장 + 용암 갭 + 보스방 ──
    for (let x = 0; x < len; x++) {
      g[x][2] = T.BLOCK;                          // 천장
      if (x < 12 || x >= len - 26) { fill(x, gndY); continue; }
      // 용암 갭 or 지면
      if (rng.chance(0.22) && x > 16) {
        const w = rng.int(2, 4);
        for (let i = 0; i < w && x < len - 26; i++) {
          g[x][R - 1] = T.LAVA; g[x][gndY] = T.LAVA;
          x++;
        }
        x--;
      } else {
        fill(x, gndY);
        if (rng.chance(0.16)) enemies.push({ type: 'hedge', tx: x, ty: gndY - 1 });
        if (rng.chance(0.1)) g[x][gndY - 4] = rng.chance(0.5) ? T.Q : T.BRICK;
      }
    }
    // 보스방 (평탄)
    for (let x = len - 26; x < len; x++) fill(x, gndY);
  }

  // ?블록 내용물: 코인 위주 + 파워업 1~3개 보장
  const qs = [];
  for (let x = 0; x < len; x++) for (let y = 0; y < R; y++) if (g[x][y] === T.Q) qs.push([x, y]);
  const contents = {};
  qs.forEach(([x, y], i) => { contents[x + ',' + y] = 'coin'; });
  // 파워업 배치 (앞·중·후반 각 1)
  const nPow = Math.max(1, Math.min(3, Math.floor(qs.length / 4)));
  for (let i = 0; i < nPow && qs.length > 0; i++) {
    const idx = Math.min(qs.length - 1, Math.floor((i + 0.5) / nPow * qs.length));
    contents[qs[idx][0] + ',' + qs[idx][1]] = 'power';
  }
  if (qs.length > 5) {
    const coinKeys = qs.map((q) => q.join(',')).filter((k) => contents[k] === 'coin');
    if (coinKeys.length > 0) contents[coinKeys[rng.int(0, coinKeys.length - 1)]] = 'star';
  }

  return {
    no: s, world, sub, castle, theme: M.WORLDS[world],
    g, len, gndY,
    enemies,
    qContents: contents,
    coinTotal: Object.values(contents).filter((v) => v === 'coin').length,
    flagX: castle ? -1 : (len - 8) * M.TILE,
    bossX: castle ? (len - 14) * M.TILE : -1,
    time: castle ? 200 : 240,
  };
};
