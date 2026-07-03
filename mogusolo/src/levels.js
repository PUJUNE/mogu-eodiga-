// levels.js — 미션·구간·웨이브 데이터 (5미션 × 10스테이지 = 50, 원작 사건 순서의 오리지널 각색)
const M = window.MSL;

M.W = 480; M.H = 270;
M.Z_MIN = 0; M.Z_MAX = 78;
M.FLOOR_Y = 176;

// 난이도: 적 HP·공격 배율, 크레이지는 웨이브 인원 +1 + 공속 가속
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.DIFFS = {
  easy:   { name: '이지',     hpMul: 0.8,  dmgMul: 0.75, cdMul: 1.1 },
  normal: { name: '노말',     hpMul: 1.0,  dmgMul: 1.0,  cdMul: 1.0 },
  hard:   { name: '하드',     hpMul: 1.25, dmgMul: 1.2,  cdMul: 0.95 },
  crazy:  { name: '크레이지', hpMul: 1.5,  dmgMul: 1.45, cdMul: 0.85, extra: 1 },
};
M.diff = 'normal';

M.MISSIONS = 5; M.STAGES_PER = 10; M.TOTAL = 50;
M.mOf = (no) => Math.min(M.MISSIONS, Math.ceil(no / M.STAGES_PER));
M.sOf = (no) => ((no - 1) % M.STAGES_PER) + 1;

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

// 중간보스: 미션당 9명 (스테이지 1~9), 스테이지 10은 메인보스
M.MIDBOSSES = {
  1: [
    { name: '모래귀 자칼',        base: 'melee'  },
    { name: '집게턱 로크',        base: 'melee'  },
    { name: '사구 도적 카릴',     base: 'ranged' },
    { name: '가시꼬리 스카라',    base: 'melee'  },
    { name: '왕전갈 데즈락',      base: 'melee'  },
    { name: '모래폭풍 진',        base: 'ranged' },
    { name: '독니 케레브',        base: 'melee'  },
    { name: '사막 수호자 오람',   base: 'melee'  },
    { name: '지네왕 근위 무락',   base: 'ranged' },
  ],
  2: [
    { name: '비늘병 참모 사스',   base: 'melee'  },
    { name: '맹독 나가 실라',     base: 'ranged' },
    { name: '굴지기 바곤',        base: 'melee'  },
    { name: '쌍두사 요르',        base: 'melee'  },
    { name: '독안개 주술사 헤바', base: 'ranged' },
    { name: '바위비늘 가르곤',    base: 'melee'  },
    { name: '그림자 살모사 닉스', base: 'melee'  },
    { name: '독왕 친위대장 라칸', base: 'ranged' },
    { name: '백사 장로 세프',     base: 'melee'  },
  ],
  3: [
    { name: '서리병 대장 울프릭', base: 'melee'  },
    { name: '고드름 저격수 옐가', base: 'ranged' },
    { name: '빙벽 파수꾼 토르그', base: 'melee'  },
    { name: '눈보라 무희 이리아', base: 'melee'  },
    { name: '얼음송곳 카이번',    base: 'ranged' },
    { name: '빙하 거병 몰드',     base: 'melee'  },
    { name: '서리마법사 에이라',  base: 'ranged' },
    { name: '설원 기사단장 브란', base: 'melee'  },
    { name: '빙군주 근위 스칼드', base: 'melee'  },
  ],
  4: [
    { name: '지옥문 문지기 고르',      base: 'melee'  },
    { name: '화염 임프 두목 잭스',     base: 'ranged' },
    { name: '가시채찍 파즈',           base: 'melee'  },
    { name: '용암 투사 마그론',        base: 'melee'  },
    { name: '지옥 사냥개 조련사 벨',   base: 'ranged' },
    { name: '흑철 갑주병 크론',        base: 'melee'  },
    { name: '화염구 술사 이그니스',    base: 'ranged' },
    { name: '하층 감시자 몰록',        base: 'melee'  },
    { name: '사육장지기 바르그',       base: 'melee'  },
  ],
  5: [
    { name: '악마 검성 자칸',          base: 'melee'  },
    { name: '화염 대마귀 프토스',      base: 'ranged' },
    { name: '어둠 기사 레이번',        base: 'melee'  },
    { name: '처형인 굴타르',           base: 'melee'  },
    { name: '마염 술사 베리트',        base: 'ranged' },
    { name: '공허 감시자 눌',          base: 'melee'  },
    { name: '왕좌 근위대장 아스몬',    base: 'ranged' },
    { name: '바란의 오른팔 그림로크',  base: 'melee'  },
    { name: '심연 대공 말파스',        base: 'melee'  },
  ],
};

// 미션별 원거리 투사체 색 (중간보스 ranged용)
const MB_SHOT = { 1: '#b8e04a', 2: '#7de08a', 3: '#b8e8ff', 4: '#ff9a3d', 5: '#ff6a3d' };

// 중간보스 스탯: 메인보스 대비 스테이지 진행에 따라 47.5% → 91.5% 성장
M.midBoss = function (m, s) {
  const B = M.BOSSES[m];
  const mb = M.MIDBOSSES[m][s - 1];
  return {
    name: mb.name, look: B.look, base: mb.base,
    hp: Math.round(B.hp * (0.42 + 0.055 * s)),
    spd: B.spd - 8 + s,
    dmg: Math.round(B.dmg * (0.68 + 0.03 * s)),
    atkCd: B.atkCd * 1.15,
    w: B.w - 4,
    body: B.body, ear: B.ear,
    shot: mb.base === 'ranged' ? MB_SHOT[m] : undefined,
    score: 400 + 60 * s,
  };
};

// no: 전체 스테이지 번호 1~50 (미션 m의 s번째)
M.makeStage = function (no) {
  const n0 = Math.max(1, Math.min(M.TOTAL, no));
  const m = M.mOf(n0), s = M.sOf(n0);
  const D = M.DIFFS[M.diff] || M.DIFFS.normal;
  const rng = M.makeRng(n0 * 7919 + 1201);
  const pool = m === 1 ? ['scorp', 'scorp', 'sting', 'rockscorp']
    : m === 2 ? ['snake', 'snake', 'naga', 'lizard']
    : m === 3 ? ['icesold', 'icesold', 'icicle', 'iceknight']
    : m === 4 ? ['demon', 'imp', 'hdemon', 'demon']
    : ['dblade', 'fmage', 'dknight', 'dblade'];
  const hpMul = (1 + (m - 1) * 0.15) * (1 + (s - 1) * 0.06) * D.hpMul;
  const dmgMul = (1 + (m - 1) * 0.08 + (s - 1) * 0.03) * D.dmgMul;
  const final = s === M.STAGES_PER;
  const nCombat = final ? 3 : 2;                    // 중간보스 스테이지는 짧게

  const sections = [];
  for (let sc = 0; sc < nCombat; sc++) {
    const waves = [];
    for (let w = 0; w < 2; w++) {
      const n = Math.min(6, 2 + Math.floor((m - 1) * 0.7) + w + Math.floor((s - 1) / 3)) + (D.extra || 0);
      const wave = [];
      for (let i = 0; i < n; i++) {
        wave.push({
          type: pool[rng.int(0, pool.length - 1)],
          side: rng.chance(0.6) ? 1 : -1,
          z: rng.range(M.Z_MIN + 8, M.Z_MAX - 8),
          hpMul, dmgMul, cdMul: D.cdMul,
        });
      }
      waves.push(wave);
    }
    sections.push({ x0: sc * 420, x1: sc * 420 + 420, waves });
  }
  const B0 = final ? M.BOSSES[m] : M.midBoss(m, s);
  const boss = Object.assign({}, B0, {
    hp: Math.round(B0.hp * D.hpMul),
    dmg: Math.round(B0.dmg * D.dmgMul),
    atkCd: B0.atkCd * D.cdMul,
    final,
  });
  sections.push({ x0: nCombat * 420, x1: nCombat * 420 + 420, waves: [[{ type: pool[0], side: 1, z: 30, hpMul, dmgMul, cdMul: D.cdMul }], []], boss });

  return {
    no: n0, mission: m, stg: s, theme: M.THEMES[m],
    sections, length: (nCombat + 1) * 420,
    dropP: 0.24,                                    // 물약 드롭 확률 (HP/MP 반반)
  };
};
