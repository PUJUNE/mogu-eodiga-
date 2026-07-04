// levels.js — 미션·구간·웨이브 데이터
const M = window.MDG;

M.W = 480; M.H = 270;
M.Z_MIN = 0; M.Z_MAX = 78;              // 깊이(세로 이동) 범위
M.FLOOR_Y = 176;                        // z=0일 때 발 위치 (z가 클수록 아래)

M.THEMES = {
  1: { name: '시내 골목',   sky0: '#1e2450', sky1: '#6a4a74', horizon: '#e8845a', wall: '#5a4a58', floor: '#6a6a74', floor2: '#5a5a64', accent: '#ffd83d' },
  2: { name: '공장 지대',   sky0: '#3a3040', sky1: '#5a4a50', horizon: '#b8906a', wall: '#4a4450', floor: '#7a7060', floor2: '#6a6050', accent: '#ff9d5c' },
  3: { name: '어두운 숲길', sky0: '#0a1c2e', sky1: '#1e3a2a', wall: '#1a3012', floor: '#4a6a3a', floor2: '#3a5a2a', accent: '#9fe06a' },
  4: { name: '악당 아지트', sky0: '#12081e', sky1: '#341448', horizon: '#5c1830', wall: '#2a1438', floor: '#54406a', floor2: '#44305a', accent: '#e08fff' },
};

// 악당 종별 파라미터
M.ETYPES = {
  thug:  { name: '쥐 양아치',   hp: 24, spd: 46, dmg: 7,  atkCd: 1.3, w: 15, body: '#9aa2ad', ear: '#c8ccd4', score: 100 },
  quick: { name: '빠른 쥐',     hp: 14, spd: 78, dmg: 5,  atkCd: 0.95, w: 13, body: '#e0985a', ear: '#f0c090', score: 150 },
  tank:  { name: '덩치 청소기', hp: 55, spd: 30, dmg: 12, atkCd: 1.7, w: 21, body: '#4a4a58', ear: '#6a6a7c', score: 250 },
};
M.BOSSES = {
  1: { name: '왕생쥐',     base: 'thug',  hp: 120, spd: 52, dmg: 10, atkCd: 1.1, w: 24, body: '#8a92a0', ear: '#b8bcc8' },
  2: { name: '폭주 청소기', base: 'tank',  hp: 160, spd: 44, dmg: 14, atkCd: 1.3, w: 28, body: '#3a3a48', ear: '#5a5a6c' },
  3: { name: '심술 까마귀', base: 'quick', hp: 150, spd: 70, dmg: 11, atkCd: 0.9, w: 24, body: '#2a2a38', ear: '#4a4a5c' },
  4: { name: '쥐마왕',     base: 'thug',  hp: 220, spd: 58, dmg: 14, atkCd: 0.85, w: 28, body: '#6a4a8a', ear: '#9a78b8' },
};

// 미션: 구간 3개(웨이브 2개씩) + 보스 구간. 구간 폭 = 420px
M.makeStage = function (mission) {
  const m = Math.max(1, Math.min(4, mission));
  const rng = M.makeRng(m * 7919 + 501);
  const pool = m === 1 ? ['thug', 'thug', 'quick']
    : m === 2 ? ['thug', 'quick', 'tank']
    : m === 3 ? ['quick', 'quick', 'thug', 'tank']
    : ['thug', 'quick', 'tank', 'tank'];
  const hpMul = 1 + (m - 1) * 0.22;

  const sections = [];
  for (let s = 0; s < 3; s++) {
    const waves = [];
    const nWaves = 2;
    for (let w = 0; w < nWaves; w++) {
      const n = Math.min(5, 2 + Math.floor((m - 1) * 0.8) + w);
      const wave = [];
      for (let i = 0; i < n; i++) {
        wave.push({
          type: pool[rng.int(0, pool.length - 1)],
          side: rng.chance(0.6) ? 1 : -1,           // 1 = 오른쪽에서 등장
          z: rng.range(M.Z_MIN + 8, M.Z_MAX - 8),
          hpMul,
        });
      }
      waves.push(wave);
    }
    sections.push({ x0: s * 420, x1: s * 420 + 420, waves });
  }
  // 보스 구간
  sections.push({ x0: 3 * 420, x1: 3 * 420 + 420, waves: [[{ type: 'thug', side: 1, z: 30, hpMul }], []], boss: M.BOSSES[m] });

  return {
    mission: m, theme: M.THEMES[m],
    sections, length: 4 * 420,
    churP: 0.22,                                    // 처치 시 츄르 드롭 확률
  };
};
