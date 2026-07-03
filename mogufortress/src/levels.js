// levels.js — 스테이지(지형·상대 AI) 생성
const M = window.MFT;

M.W = 480; M.H = 270;
M.TCOL = 2;                      // 지형 컬럼 폭(px)
M.NCOL = M.W / M.TCOL;           // 240 컬럼

M.THEMES = {
  1: { name: '초원 언덕',  sky0: '#8ecdf0', sky1: '#d8f0fa', ground: '#5da24a', dirt: '#7a5a36', far: '#79b868', night: false },
  2: { name: '사막 협곡',  sky0: '#f2cf95', sky1: '#faecc8', ground: '#e0c084', dirt: '#b08050', far: '#d8b878', night: false },
  3: { name: '설원 능선',  sky0: '#a8c8e8', sky1: '#e8f2fa', ground: '#f0f6fa', dirt: '#8ea6b4', far: '#c8dcf0', night: false },
  4: { name: '화산 지대',  sky0: '#2a1020', sky1: '#5a2030', ground: '#5a4a50', dirt: '#3a2a30', far: '#402028', night: true },
};

const BOSSES = { 3: '왕생쥐 전차', 6: '사막의 청소기', 9: '까마귀 비행포대', 12: '쥐마왕 요새' };
const ENEMY_KIND = { 1: 'mouse', 2: 'vacuum', 3: 'crow', 4: 'lord' };

// 부드러운 1D 노이즈 (rng 기반 코사인 보간)
function noiseGen(rng, n, lo, hi, seg) {
  const knots = [];
  for (let i = 0; i <= Math.ceil(n / seg) + 1; i++) knots.push(rng.range(lo, hi));
  return (i) => {
    const f = i / seg;
    const k = Math.floor(f), u = f - k;
    const s = (1 - Math.cos(u * Math.PI)) / 2;
    return knots[k] * (1 - s) + knots[k + 1] * s;
  };
}

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 887);
  const world = Math.min(4, Math.ceil(no / 3));
  const t = (no - 1) / 11;
  const boss = !!BOSSES[no];

  // 지형: 노이즈 능선 (지면 y, 위가 하늘)
  const base = 195;
  const noise = noiseGen(rng, M.NCOL, -34, 30, 26);
  const terrain = new Array(M.NCOL);
  for (let i = 0; i < M.NCOL; i++) {
    // 중앙일수록 봉우리 성향 (양측 포대는 낮고 평탄)
    const mid = 1 - Math.abs(i - M.NCOL / 2) / (M.NCOL / 2);
    terrain[i] = Math.round(base - noise(i) * (0.5 + mid) - mid * rng.range(4, 10));
  }
  // 포대 자리 평탄화 (양측 30~46 컬럼 지점)
  const pCol = rng.int(22, 34), eCol = M.NCOL - rng.int(22, 34);
  for (const cc of [pCol, eCol]) {
    const h = terrain[cc];
    for (let i = cc - 8; i <= cc + 8; i++) {
      if (i >= 0 && i < M.NCOL) terrain[i] = h;
    }
  }

  return {
    no, world, theme: M.THEMES[world],
    terrain, pCol, eCol,
    boss,
    enemy: {
      name: boss ? BOSSES[no] : ['생쥐 포병', '빠른쥐 포병', '청소기 포대'][no % 3],
      kind: ENEMY_KIND[world],
      hp: boss ? 150 : 100,
      err: 34 - t * 30 - (boss ? 3 : 0),      // 조준 오차 (px)
      dmgMul: 1 + t * 0.25 + (boss ? 0.15 : 0),
    },
  };
};
