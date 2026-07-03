// levels.js — 미션·구간·웨이브 데이터 (5미션, 원작 사건 순서의 오리지널 각색)
const M = window.MSL;

M.W = 480; M.H = 270;
M.Z_MIN = 0; M.Z_MAX = 78;
M.FLOOR_Y = 176;

M.THEMES = {
  1: { name: '페널티 존',     sky0: '#e8a850', sky1: '#f4d898', wall: '#b08a50', floor: '#c8a468', floor2: '#b08a50', accent: '#ffd83d' },
  2: { name: '독사의 굴',     sky0: '#1a2a18', sky1: '#3a5a30', wall: '#2a3a24', floor: '#4a5a3a', floor2: '#3a4a2c', accent: '#9fe06a' },
  3: { name: '붉은 문',       sky0: '#6a88b8', sky1: '#d8e8f4', wall: '#8a9cb4', floor: '#e8f0f8', floor2: '#c8d4e4', accent: '#ff5a5a' },
  4: { name: '악마성 하층',   sky0: '#180a14', sky1: '#3a1424', wall: '#3a2030', floor: '#4a2c38', floor2: '#3a1c28', accent: '#ff7d5c' },
  5: { name: '악마성 최상층', sky0: '#0e0a1e', sky1: '#2e1440', wall: '#301c40', floor: '#3c2450', floor2: '#2c1840', accent: '#b07dff' },
};

// 미션 시작 브리핑 (오리지널 문구)
M.STORY = {
  1: '일일 퀘스트를 미룬 대가 — 페널티 존으로 강제 이송됐다!',
  2: '꼬꼬 합류! D급 게이트 최심부에 독왕이 도사린다',
  3: '붉은 문 안에 갇혔다. 살아서 나가려면 뚫는 수밖에',
  4: '악마성 입성. 파수견이 문을 지킨다',
  5: '최상층 — 악마왕 바란과의 결전!',
};

// 병졸 종별 (미션별 3종: 기본 / 원거리 / 중갑)
M.ETYPES = {
  scorp:    { name: '모래 전갈',   look: 'bug',   hp: 26, spd: 46, dmg: 7,  atkCd: 1.3,  w: 15, body: '#c8a050', ear: '#e8cc88', score: 100 },
  sting:    { name: '가시 지네',   look: 'bug',   hp: 18, spd: 52, dmg: 8,  atkCd: 2.1,  w: 14, body: '#a87848', ear: '#d0a878', score: 200, ranged: true, shot: '#b8e04a' },
  rockscorp:{ name: '바위 전갈',   look: 'bug',   hp: 62, spd: 28, dmg: 12, atkCd: 1.8,  w: 20, body: '#8a7050', ear: '#b09878', score: 300, tanky: true },
  snake:    { name: '독사병',     look: 'snake', hp: 30, spd: 50, dmg: 8,  atkCd: 1.25, w: 15, body: '#5a8a3a', ear: '#8ab868', score: 120 },
  naga:     { name: '독침 나가',   look: 'snake', hp: 22, spd: 54, dmg: 9,  atkCd: 2.0,  w: 14, body: '#4a7a5a', ear: '#78a888', score: 220, ranged: true, shot: '#7de08a' },
  lizard:   { name: '바위 도마뱀', look: 'snake', hp: 68, spd: 30, dmg: 13, atkCd: 1.75, w: 21, body: '#6a6a4a', ear: '#98987a', score: 320 },
  icesold:  { name: '얼음 병사',   look: 'ice',   hp: 36, spd: 48, dmg: 9,  atkCd: 1.2,  w: 16, body: '#7aa8d8', ear: '#b8d8f0', score: 150 },
  icicle:   { name: '고드름 궁수', look: 'ice',   hp: 26, spd: 50, dmg: 10, atkCd: 1.9,  w: 14, body: '#5a88c8', ear: '#98c0e8', score: 250, ranged: true, shot: '#b8e8ff' },
  iceknight:{ name: '빙갑 기사',   look: 'ice',   hp: 76, spd: 30, dmg: 14, atkCd: 1.7,  w: 21, body: '#4a6a9a', ear: '#7898c8', score: 350 },
  demon:    { name: '악마 병졸',   look: 'demon', hp: 42, spd: 52, dmg: 10, atkCd: 1.15, w: 16, body: '#8a3a48', ear: '#b86a78', score: 180 },
  imp:      { name: '화염 임프',   look: 'demon', hp: 28, spd: 56, dmg: 11, atkCd: 1.8,  w: 13, body: '#c85a30', ear: '#e89860', score: 280, ranged: true, shot: '#ff9a3d' },
  hdemon:   { name: '중갑 악마',   look: 'demon', hp: 84, spd: 32, dmg: 15, atkCd: 1.65, w: 22, body: '#5a2a3a', ear: '#8a5a6a', score: 380 },
  dblade:   { name: '악마 검병',   look: 'demon', hp: 50, spd: 56, dmg: 12, atkCd: 1.05, w: 16, body: '#6a2a5a', ear: '#9a5a8a', score: 220 },
  fmage:    { name: '화염 마귀',   look: 'demon', hp: 32, spd: 52, dmg: 12, atkCd: 1.7,  w: 14, body: '#a04028', ear: '#d07858', score: 320, ranged: true, shot: '#ff6a3d' },
  dknight:  { name: '악마 기사',   look: 'demon', hp: 92, spd: 34, dmg: 16, atkCd: 1.6,  w: 22, body: '#3a1a4a', ear: '#6a4a7a', score: 420 },
};

M.BOSSES = {
  1: { name: '거대 사막 지네',     look: 'bug',   base: 'melee',  hp: 150, spd: 56, dmg: 11, atkCd: 1.0,  w: 26, body: '#b8863a', ear: '#e0b868' },
  2: { name: '독왕 카사카',       look: 'snake', base: 'ranged', hp: 170, spd: 66, dmg: 12, atkCd: 1.15, w: 25, body: '#3a7a2a', ear: '#68a858', shot: '#7de08a' },
  3: { name: '얼음 군주 바루카',   look: 'ice',   base: 'melee',  hp: 210, spd: 68, dmg: 14, atkCd: 0.85, w: 27, body: '#3a5a9a', ear: '#6a90c8' },
  4: { name: '지옥 파수견 케르베로스', look: 'demon', base: 'melee', hp: 240, spd: 74, dmg: 15, atkCd: 0.8, w: 28, body: '#6a1a20', ear: '#a04a50' },
  5: { name: '악마왕 바란',       look: 'demon', base: 'baran',  hp: 320, spd: 62, dmg: 17, atkCd: 1.0,  w: 30, body: '#38104a', ear: '#6a3a8a', shot: '#b07dff' },
};

M.makeStage = function (mission) {
  const m = Math.max(1, Math.min(5, mission));
  const rng = M.makeRng(m * 7919 + 1201);
  const pool = m === 1 ? ['scorp', 'scorp', 'sting', 'rockscorp']
    : m === 2 ? ['snake', 'snake', 'naga', 'lizard']
    : m === 3 ? ['icesold', 'icesold', 'icicle', 'iceknight']
    : m === 4 ? ['demon', 'imp', 'hdemon', 'demon']
    : ['dblade', 'fmage', 'dknight', 'dblade'];
  const hpMul = 1 + (m - 1) * 0.15;

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
  sections.push({ x0: 3 * 420, x1: 3 * 420 + 420, waves: [[{ type: pool[0], side: 1, z: 30, hpMul }], []], boss: M.BOSSES[m] });

  return {
    mission: m, theme: M.THEMES[m],
    sections, length: 4 * 420,
    dropP: 0.24,                                    // 물약 드롭 확률 (HP/MP 반반)
  };
};
