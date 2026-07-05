// levels.js — 미션·구간·웨이브 데이터 (삼국전기 5미션)
const M = window.MSG;

M.W = 480; M.H = 270;
M.Z_MIN = 0; M.Z_MAX = 78;
M.FLOOR_Y = 176;

// 사극 드라마 팔레트: 깊은 채도 + 전화(戰火)의 붉은 기운 (90년대 중화 아케이드 톤)
M.THEMES = {
  1: { name: '황건적 들판', sky0: '#a04818', sky1: '#e09838', horizon: '#f8dc90', wall: '#8a6432', floor: '#a68e4e', floor2: '#948040', accent: '#ffd83d' },
  2: { name: '대나무 숲',   sky0: '#12321e', sky1: '#3a6a3e', horizon: '#8fb868', wall: '#1a3a22', floor: '#5a7a44', floor2: '#4c6c38', accent: '#9fe06a' },
  3: { name: '성문 앞',     sky0: '#6684b4', sky1: '#b0c8dc', horizon: '#e8ecdc', wall: '#6e645c', floor: '#948a7c', floor2: '#847a6c', accent: '#5db8ff' },
  4: { name: '성내 시가',   sky0: '#1c0e2a', sky1: '#4e1e3c', horizon: '#8a2c38', wall: '#4e3034', floor: '#7a6252', floor2: '#6a5244', accent: '#ff7d5c' },
  5: { name: '왕좌의 방',   sky0: '#160812', sky1: '#3a1a14', wall: '#6a4a20', floor: '#a8842e', floor2: '#96742a', accent: '#ffd83d' },
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
