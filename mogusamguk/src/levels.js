// levels.js — 미션·구간·웨이브 데이터 (삼국전기 5미션)
const M = window.MSG;

M.W = 480; M.H = 270;
M.Z_MIN = 0; M.Z_MAX = 78;
M.FLOOR_Y = 176;

M.THEMES = {
  1: { name: '황건적 들판', sky0: '#e8b860', sky1: '#f4dca0', wall: '#8a7040', floor: '#a08c58', floor2: '#907c48', accent: '#ffd83d' },
  2: { name: '대나무 숲',   sky0: '#2a4a30', sky1: '#4a7a50', wall: '#1e3a24', floor: '#5a7a4a', floor2: '#4a6a3a', accent: '#9fe06a' },
  3: { name: '성문 앞',     sky0: '#8ea8c8', sky1: '#c8d8e8', wall: '#6a6058', floor: '#8a8078', floor2: '#7a7068', accent: '#5db8ff' },
  4: { name: '성내 시가',   sky0: '#2a1830', sky1: '#5a3048', wall: '#4a3038', floor: '#6a5048', floor2: '#5a4038', accent: '#ff7d5c' },
  5: { name: '왕좌의 방',   sky0: '#1a0a18', sky1: '#40182a', wall: '#582030', floor: '#6a3040', floor2: '#5a2030', accent: '#ffd83d' },
};

// 병졸 종별
M.ETYPES = {
  spear:  { name: '창병 쥐',     hp: 26, spd: 46, dmg: 7,  atkCd: 1.3,  w: 15, body: '#9aa2ad', ear: '#c8ccd4', score: 100 },
  axe:    { name: '도끼병 쥐',   hp: 44, spd: 36, dmg: 11, atkCd: 1.55, w: 17, body: '#b08050', ear: '#d8b088', score: 200 },
  archer: { name: '궁수 쥐',     hp: 18, spd: 52, dmg: 8,  atkCd: 2.1,  w: 14, body: '#7a9c5a', ear: '#a8c888', score: 200, ranged: true },
  shield: { name: '철갑 청소기', hp: 66, spd: 28, dmg: 13, atkCd: 1.8,  w: 21, body: '#4a4a58', ear: '#6a6a7c', score: 300 },
};
M.BOSSES = {
  1: { name: '황건 두목',       base: 'spear',  hp: 130, spd: 54, dmg: 10, atkCd: 1.05, w: 24, body: '#c8a030', ear: '#e8cc60' },
  2: { name: '죽림 자객 까마귀', base: 'archer', hp: 150, spd: 74, dmg: 11, atkCd: 0.9,  w: 24, body: '#2a2a38', ear: '#4a4a5c' },
  3: { name: '성문 장수',       base: 'axe',    hp: 175, spd: 46, dmg: 14, atkCd: 1.2,  w: 27, body: '#8a5a30', ear: '#b08858' },
  4: { name: '대장군 그림자 고양이', base: 'spear', hp: 200, spd: 62, dmg: 14, atkCd: 0.85, w: 27, body: '#1a1424', ear: '#2a2038' },
  5: { name: '쥐황제',          base: 'axe',    hp: 250, spd: 60, dmg: 16, atkCd: 0.8,  w: 30, body: '#6a4a8a', ear: '#9a78b8' },
};

M.makeStage = function (mission) {
  const m = Math.max(1, Math.min(5, mission));
  const rng = M.makeRng(m * 7919 + 1201);
  const pool = m === 1 ? ['spear', 'spear', 'axe']
    : m === 2 ? ['spear', 'archer', 'axe']
    : m === 3 ? ['spear', 'axe', 'archer', 'shield']
    : m === 4 ? ['axe', 'archer', 'shield', 'spear']
    : ['axe', 'archer', 'shield', 'shield'];
  const hpMul = 1 + (m - 1) * 0.18;

  const sections = [];
  for (let s = 0; s < 3; s++) {
    const waves = [];
    for (let w = 0; w < 2; w++) {
      const n = Math.min(5, 2 + Math.floor((m - 1) * 0.7) + w);
      const wave = [];
      for (let i = 0; i < n; i++) {
        wave.push({
          type: pool[rng.int(0, pool.length - 1)],
          side: rng.chance(0.6) ? 1 : -1,
          z: rng.range(M.Z_MIN + 8, M.Z_MAX - 8),
          hpMul,
        });
      }
      waves.push(wave);
    }
    sections.push({ x0: s * 420, x1: s * 420 + 420, waves });
  }
  sections.push({ x0: 3 * 420, x1: 3 * 420 + 420, waves: [[{ type: 'spear', side: 1, z: 30, hpMul }], []], boss: M.BOSSES[m] });

  return {
    mission: m, theme: M.THEMES[m],
    sections, length: 4 * 420,
    churP: 0.22,                                    // 만두 드롭 확률
  };
};
