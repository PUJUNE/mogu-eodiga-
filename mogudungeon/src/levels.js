// levels.js — 상수 · 난이도 · 직업 4종 · 적/보스 · 스테이지(분기 루트) · 아이템 · 레벨 테이블
// 원작(던전 앤 드래곤: 타워 오브 둠 / 섀도우 오버 미스타라, 캡콤 오락실) 기준:
// 직업을 고르고 벨트스크롤로 던전을 돌파하며, 갈림길에서 루트를 고르고, 보물상자와 마법으로 보스를 잡는다.
const M = window.MDN;

// 화면 상수 (logic·render 공유) — 가로형 캔버스, 바닥 띠(z 0..1)가 깊이
M.W = 480; M.H = 270;
M.FLOOR_Y = 158; M.FLOOR_H = 100;     // 발끝 y = FLOOR_Y + z * FLOOR_H
M.SEC_W = 480;                        // 구간(섹션) 폭 = 화면 1장
M.MAX_MP = 100; M.MP_REGEN = 2.5;     // 마나 자연 회복 (초당)
M.INV_SEC = 0.7;                      // 피격 후 무적
M.MAX_LEVEL = 10;

// 시리즈 공통 난이도 4단계 — 적 체력·공격력·추가 마릿수
M.DIFFS = {
  easy:   { name: '이지',     hpMul: 0.75, atkMul: 0.7,  extra: 0, goldMul: 0.8 },
  normal: { name: '노말',     hpMul: 1.0,  atkMul: 1.0,  extra: 0, goldMul: 1.0 },
  hard:   { name: '하드',     hpMul: 1.3,  atkMul: 1.25, extra: 1, goldMul: 1.3 },
  crazy:  { name: '크레이지', hpMul: 1.7,  atkMul: 1.55, extra: 2, goldMul: 1.7 },
};
M.diff = 'normal';
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.nextDiff = function (d) {
  const i = M.DIFF_ORDER.indexOf(d);
  return i >= 0 && i < M.DIFF_ORDER.length - 1 ? M.DIFF_ORDER[i + 1] : null;
};

// 직업 4종 = 시리즈 캐릭터 4명 (원작의 파이터·매직유저·시프·클레릭 대응)
M.CLASSES = {
  fighter: { name: '전사 모구',   who: 'mogu', emoji: '🐱', hp: 120, atk: 14, spd: 1.0,  range: 36, color: '#c8384a',
             skill: { name: '회전베기', emoji: '🌀', mp: 30, desc: '주위의 적을 한 번에 베어 넘어뜨린다' } },
  mage:    { name: '마법사 꼬꼬', who: 'kko',  emoji: '🐔', hp: 80,  atk: 8,  spd: 1.0,  range: 84, color: '#3d6fe0',
             skill: { name: '파이어볼', emoji: '🔥', mp: 25, desc: '적을 꿰뚫는 불덩이를 날린다' } },
  thief:   { name: '도적 찍찍',   who: 'jjik', emoji: '🐭', hp: 90,  atk: 10, spd: 1.35, range: 32, color: '#2f9e5a',
             skill: { name: '단검 투척', emoji: '🗡️', mp: 20, desc: '단검 3개를 부채꼴로 던진다 · 보물 금화 2배' } },
  cleric:  { name: '성직자 몽이', who: 'mong', emoji: '🐶', hp: 110, atk: 11, spd: 0.95, range: 34, color: '#e8b13a',
             skill: { name: '치유의 빛', emoji: '✨', mp: 35, desc: 'HP를 45 회복하고 언데드를 불사른다' } },
};
M.CLASS_ORDER = ['fighter', 'mage', 'thief', 'cleric'];
M.cls = 'fighter';

// 적 5종 + 보스 5종
M.ENEMY = {
  kobold:   { name: '코볼트 쥐',   hp: 30,  atk: 8,  spd: 62, range: 26, exp: 10, gold: 20, r: 12 },
  skeleton: { name: '해골 병사',   hp: 45,  atk: 10, spd: 46, range: 28, exp: 14, gold: 25, r: 13, undead: true },
  orc:      { name: '오크',        hp: 90,  atk: 16, spd: 40, range: 32, exp: 25, gold: 40, r: 16, heavy: true },
  shaman:   { name: '쥐 주술사',   hp: 35,  atk: 12, spd: 50, range: 150, exp: 18, gold: 35, r: 12, ranged: true, fireCd: 2.4 },
  bat:      { name: '동굴 박쥐',   hp: 20,  atk: 6,  spd: 85, range: 22, exp: 8,  gold: 12, r: 10 },
  // 보스
  ogre:     { name: '오우거',       hp: 380, atk: 22, spd: 38, range: 44, exp: 120, gold: 300, r: 26, boss: true, emoji: '🧌', heavy: true, smash: 2.6 },
  lich:     { name: '리치',         hp: 300, atk: 14, spd: 30, range: 170, exp: 140, gold: 350, r: 20, boss: true, emoji: '💀', ranged: true, fireCd: 2.2, undead: true, summon: 7 },
  shamanking:{ name: '주술사 대왕', hp: 330, atk: 16, spd: 44, range: 160, exp: 130, gold: 320, r: 22, boss: true, emoji: '🧙', ranged: true, fireCd: 1.6 },
  orcchief: { name: '오크 대장',    hp: 450, atk: 20, spd: 42, range: 40, exp: 130, gold: 320, r: 26, boss: true, emoji: '👹', heavy: true, smash: 3.2 },
  dragon:   { name: '검은 드래곤',  hp: 700, atk: 26, spd: 34, range: 48, exp: 300, gold: 800, r: 34, boss: true, emoji: '🐉', heavy: true, breath: 3.0, final: true },
};

// 스테이지 · 분기 루트 (원작의 갈림길 선택 오마주) — 5스테이지를 지나 용의 둥지까지
M.STAGES = {
  forest:    { name: '어둠의 숲',     theme: 'forest', waves: 3, boss: null,         pool: ['kobold', 'kobold', 'bat'],            next: ['cave', 'graveyard'] },
  cave:      { name: '오우거 동굴',   theme: 'cave',   waves: 2, boss: 'ogre',       pool: ['kobold', 'bat', 'bat', 'orc'],        next: ['bridge'] },
  graveyard: { name: '저주받은 묘지', theme: 'grave',  waves: 2, boss: 'lich',       pool: ['skeleton', 'skeleton', 'bat'],        next: ['bridge'] },
  bridge:    { name: '성 앞 다리',    theme: 'bridge', waves: 3, boss: null,         pool: ['kobold', 'skeleton', 'orc', 'shaman'],next: ['tower', 'prison'] },
  tower:     { name: '주술사의 탑',   theme: 'tower',  waves: 2, boss: 'shamanking', pool: ['shaman', 'shaman', 'bat', 'kobold'],  next: ['lair'] },
  prison:    { name: '지하 감옥',     theme: 'prison', waves: 2, boss: 'orcchief',   pool: ['orc', 'orc', 'kobold', 'skeleton'],   next: ['lair'] },
  lair:      { name: '용의 둥지',     theme: 'lair',   waves: 2, boss: 'dragon',     pool: ['skeleton', 'orc', 'shaman', 'bat'],   next: [] },
};
M.FIRST_STAGE = 'forest';
M.STAGE_DESC = {
  cave: '🧌 오우거가 지키는 어두운 동굴', graveyard: '💀 리치가 잠든 안개 낀 묘지',
  tower: '🧙 주술사들의 마법 탑', prison: '👹 오크 대장의 지하 감옥',
};
M.THEMES = {
  forest: { sky0: '#1c2a3e', sky1: '#35564a', floor0: '#4e7a3a', floor1: '#2f4f26', prop: 'tree' },
  cave:   { sky0: '#151018', sky1: '#33263a', floor0: '#5a4e4a', floor1: '#33292a', prop: 'stalac' },
  grave:  { sky0: '#1a1e30', sky1: '#3a4260', floor0: '#4a5a48', floor1: '#2a3428', prop: 'grave' },
  bridge: { sky0: '#2a3d6a', sky1: '#7a94c0', floor0: '#8a8478', floor1: '#5a5650', prop: 'pillar' },
  tower:  { sky0: '#2a1a40', sky1: '#5a3a80', floor0: '#6a5a8a', floor1: '#3e3258', prop: 'pillar' },
  prison: { sky0: '#141414', sky1: '#3a3a3a', floor0: '#5a5a5a', floor1: '#333', prop: 'bars' },
  lair:   { sky0: '#2a0a0a', sky1: '#6a1e14', floor0: '#5a3a2a', floor1: '#33201a', prop: 'bones' },
};

// 아이템 (보물상자·적 드롭)
M.ITEMS = {
  potion: { name: '치유 물약', emoji: '🧪', desc: 'HP +40' },
  mana:   { name: '마나 물약', emoji: '💧', desc: 'MP +40' },
  gold:   { name: '금화 주머니', emoji: '💰', desc: '금화' },
  ring:   { name: '힘의 반지', emoji: '💍', desc: '공격력 +2' },
  churu:  { name: '츄르', emoji: '🍢', desc: 'HP 전부 회복' },
};

// 레벨업에 필요한 경험치 (레벨 1→2 = 30, 이후 +25씩)
M.expNeed = function (level) { return 30 + (level - 1) * 25; };

// 웨이브 구성 — 스테이지·구간·난이도로 결정적 생성 (같은 시드 = 같은 던전)
M.makeWave = function (stageKey, section, diff, rng) {
  const S = M.STAGES[stageKey], D = M.DIFFS[diff] || M.DIFFS.normal;
  const n = 2 + section + D.extra + (stageKey === 'lair' ? 1 : 0);
  const list = [];
  for (let i = 0; i < n; i++) list.push({ kind: rng.pick(S.pool), side: rng.chance(0.7) ? 1 : -1, z: rng.range(0.1, 0.9), delay: i * 0.5 });
  return list;
};
