// data.js — 마을 건물 · 하루 시간 · 수련 · 알바 · 상점 · 타로 · 던전 · 몬스터 · 침공 · 난이도
// 김플립 「코드히어로」(복셀 마을 육성 RPG)를 모구 세계로 옮긴 것. 좌표: x(동서) · y(남북, 화면 아래 +) — 미터
const M = window.MHR;

// ── 하루 ──
M.DAY_START = 8; M.DAY_END = 22;          // 08:00 ~ 22:00
M.LAST_DAY = 30;                          // 30일째 저녁 그림자 고양이가 온다
M.COST = { train: 3, work: 3, dungeon: 3 };

// ── 마을 (섬 32×32) — 건물: 위치 · 크기 · 문(상호작용 지점) ──
M.ISLAND = 15;
M.BUILDINGS = {
  home:    { name: '모구네 집',   x: -8.5, y: -7.5, w: 4.2, d: 3.6, door: [-8.5, -5.2], col: 0xb88ad8, npc: null,     icon: '🏠' },
  dojo:    { name: '냥냥 도장',   x: 8.5,  y: -7.5, w: 5.0, d: 4.0, door: [8.5, -5.0],  col: 0xd8663a, npc: 'kkokko', icon: '🥋' },
  fish:    { name: '생선가게',   x: -9.0, y: 5.5,  w: 4.4, d: 3.4, door: [-6.4, 5.5],  col: 0x4a8ad8, npc: 'crow',   icon: '🐟' },
  shop:    { name: '잡화점',     x: 9.0,  y: 5.5,  w: 4.4, d: 3.4, door: [6.4, 5.5],   col: 0x6aa84a, npc: 'mouse',  icon: '🛒' },
  tarot:   { name: '키위 점집',   x: 0,    y: -10.5, w: 3.4, d: 3.0, door: [0, -8.6],   col: 0x7a4bb8, npc: 'kiwi',   icon: '🔮' },
  dungeon: { name: '던전 입구',   x: 0,    y: 11.2, w: 4.6, d: 2.6, door: [0, 9.3],    col: 0x5a5a66, npc: null,     icon: '⚔️' },
};

// ── 마을 사람들 (말 걸면 초상과 대사) ──
M.NPCS = {
  kkokko: { name: '꼬꼬 사범',     face: 'chick',  body: 0xf2b02c, home: 'dojo',
    lines: ['수련은 배신하지 않는다 꼬꼬! 힘은 발톱, 민첩은 캣타워, 냥력은 낮잠이다.', '오늘도 왔구나. 근육은 하루아침에 안 붙는다 꼬꼬.', '세 번째 타격에 체중을 실어라! 콤보 마지막이 제일 아프다.'] },
  crow:   { name: '까마귀 사장',   face: 'crow',   body: 0x3a3a48, home: 'fish',
    lines: ['생선 훔쳐 먹지 말고 팔기만 해라 까악.', '알바비는 날이 갈수록 올라간다. 경력직 우대다 까악.', '민첩한 놈이 손님을 더 받지. 팁도 더 받고.'] },
  mouse:  { name: '생쥐 상인',     face: 'mouse',  body: 0xe0503a, home: 'shop',
    lines: ['어서 와 찍! 무기는 능력치가 모자라면 못 든다 찍.', '집사 후드티는 방어력이 끝내줘 찍. 비싸지만.', '레이저 포인터는… 전설 속 무기야. 냥력이 높아야 해.'] },
  kiwi:   { name: '키위 점술사',   face: 'kiwi',   body: 0x6f9a45, home: 'tarot',
    lines: ['카드가 속삭이는군요… 하루 한 장, 공짜예요.', '운명은 정해져 있지 않아요. 지면 되감으면 그만이죠.', '탑 카드가 나온 날은 위험하지만 금화가 많이 떨어져요.'] },
  sumo:   { name: '스모 촌장',     face: 'sumo',   body: 0x7a4bb8, wander: true,
    lines: ['모구야, 이 마을을 지켜 다오. 들개 깡패가 8일마다 쳐들어온다.', '던전은 권장 레벨을 보고 들어가거라. 무리하면 기절한다.', '30일째 밤, 그림자 고양이가 온다는 예언이 있다…'] },
  ninja:  { name: '닌자 정보원',   face: 'ninja',  body: 0x22262e, wander: true,
    lines: ['정보다. 보스의 빨간 원이 보이면 Shift로 냥보를 써서 빠져나가라.', '냥냥 회오리(Q)는 몰려 있을 때 써라. 냥력이 높을수록 아프다.', '자동 전투도 있지만, 직접 피하는 쪽이 덜 맞는다.'] },
};

// ── 냥냥 도장 수련 ──
M.TRAINS = {
  atk: { name: '발톱 수련',     stat: 'atk', desc: '힘 +2 · 무기 공격력과 같이 타격 피해가 오른다' },
  agi: { name: '캣타워 오르기', stat: 'agi', desc: '민첩 +2 · 이동 속도 · 치명타 · 냥보 대기 시간' },
  mag: { name: '낮잠 명상',     stat: 'mag', desc: '냥력 +2 · 냥냥 회오리 피해 · 대기 시간' },
};
M.trainCost = (n) => 20 + n * 16;          // n = 그 과목을 받은 횟수
M.TRAIN_GAIN = 2; M.TRAIN_GREAT = 4; M.TRAIN_GREAT_P = 0.15;

// ── 생선가게 알바 ──
M.workPay = (day, agi) => Math.round(40 + day * 9 + agi * 1.2);

// ── 잡화점 ── (무기: 공격력 · 요구 능력치 / 옷: 방어 · 체력)
M.WEAPONS = [
  { id: 'stick',  name: '나뭇가지',           atk: 4,   price: 0,     req: null,         col: 0x8a5a2a },
  { id: 'bone',   name: '생선뼈 단검',        atk: 12,  price: 120,   req: ['atk', 10],  col: 0xeeeedd },
  { id: 'rod',    name: '고양이 낚싯대',       atk: 26,  price: 420,   req: ['agi', 18],  col: 0xff6aa8 },
  { id: 'spear',  name: '츄르 창',            atk: 46,  price: 1100,  req: ['atk', 28],  col: 0xffc83d },
  { id: 'hammer', name: '참치캔 망치',        atk: 74,  price: 2500,  req: ['atk', 42],  col: 0x9ab0c8 },
  { id: 'knuck',  name: '냥펀치 너클',        atk: 110, price: 5000,  req: ['agi', 52],  col: 0xe8402a },
  { id: 'laser',  name: '전설의 레이저 포인터', atk: 160, price: 10000, req: ['mag', 64],  col: 0xff2a2a },
];
M.ARMORS = [
  { id: 'fur',     name: '털 조끼',        def: 0,  hp: 0,   price: 0,    col: 0xfbfaf6 },
  { id: 'box',     name: '박스 갑옷',      def: 12, hp: 30,  price: 200,  col: 0xc8a06a },
  { id: 'sweater', name: '뜨개 스웨터',    def: 26, hp: 80,  price: 750,  col: 0xe86a6a },
  { id: 'hoodie',  name: '집사 후드티',    def: 45, hp: 160, price: 2200, col: 0x3a4a6a },
  { id: 'bell',    name: '황금 방울 목걸이', def: 75, hp: 300, price: 6000, col: 0xffd83d },
];
M.POTION = { name: '츄르 회복약', price: 40, heal: 0.4, max: 5 };   // 전투 중 H 로 체력 40% 회복

// ── 키위 점집 (하루 한 장) ──
M.TAROT = [
  { id: 'sun',   name: '태양',  icon: '☀️', desc: '오늘 버는 금화 +30%' },
  { id: 'str',   name: '힘',    icon: '💪', desc: '오늘 주는 피해 +15%' },
  { id: 'star',  name: '별',    icon: '⭐', desc: '오늘 얻는 경험치 +40%' },
  { id: 'moon',  name: '달',    icon: '🌙', desc: '오늘 수련 대성공 확률이 크게 오른다' },
  { id: 'tower', name: '탑',    icon: '🗼', desc: '오늘 몬스터가 15% 세지지만 금화 +60%' },
  { id: 'fool',  name: '바보',  icon: '🃏', desc: '평범한 하루. 아무 일도 없다' },
];

// ── 몬스터 ── (기본값 — 던전 단계로 곱해진다)  face 는 render3d 의 얼굴 그림 이름
M.MOBS = {
  hairball: { name: '털뭉치 슬라임', face: 'hairball', col: 0xb8b0a8, size: 0.7, spd: 2.4, range: 1.1 },
  vacuum:   { name: '꼬마 청소기',   face: 'vacuum',   col: 0x8a96a8, size: 0.75, spd: 2.9, range: 1.2 },
  cucumber: { name: '오이 병사',     face: 'cucumber', col: 0x4a9a3a, size: 0.8, spd: 2.6, range: 1.3 },
  drop:     { name: '목욕물 방울',   face: 'drop',     col: 0x5ab0f0, size: 0.7, spd: 3.3, range: 1.1 },
  cone:     { name: '넥카라 간호병', face: 'cone',     col: 0xf0f4f8, size: 0.8, spd: 3.0, range: 1.3 },
  scrow:    { name: '그림자 까마귀', face: 'scrow',    col: 0x2a2038, size: 0.75, spd: 3.6, range: 1.2 },
  dog:      { name: '들개 졸개',     face: 'dog',      col: 0xa8784a, size: 0.8, spd: 3.1, range: 1.3 },
};

// 던전 — 단계 t 가 몬스터 체력·공격력·보상을 정한다
M.DUNGEONS = [
  { id: 'd1', name: '뒷산 털뭉치 숲',     t: 0.6, mob: 'hairball', kills: 6,  boss: '왕털뭉치',      bossFace: 'hairball', rec: 1,  ground: 0x7ab86a, prop: 0x4a8a3a },
  { id: 'd2', name: '창고 청소기 동굴',   t: 2, mob: 'vacuum',   kills: 7,  boss: '청소기 대왕',    bossFace: 'vacuum',   rec: 4,  ground: 0x9a9088, prop: 0x6a6460 },
  { id: 'd3', name: '공포의 오이 밭',     t: 3, mob: 'cucumber', kills: 8,  boss: '거대 오이',      bossFace: 'cucumber', rec: 8,  ground: 0x8a6a40, prop: 0x3a8a2a },
  { id: 'd4', name: '목욕탕 폐허',       t: 4, mob: 'drop',     kills: 8,  boss: '샤워기 골렘',    bossFace: 'drop',     rec: 12, ground: 0xa8d0e0, prop: 0xe8f0f4 },
  { id: 'd5', name: '동물병원 지하',     t: 5, mob: 'cone',     kills: 9,  boss: '주사기 원장',    bossFace: 'cone',     rec: 16, ground: 0xd8e0e4, prop: 0x8ab0c0 },
  { id: 'd6', name: '그림자 사원',       t: 6, mob: 'scrow',    kills: 10, boss: '그림자 까마귀왕', bossFace: 'scrow',    rec: 18, ground: 0x4a3a5a, prop: 0x2a2038 },
];
M.DUNGEON_TIME = 150;                     // 제한 시간(초)
M.mobHp  = (t) => Math.round(78 * Math.pow(1.9, t - 1));
M.mobAtk = (t) => Math.round(11 * Math.pow(1.5, t - 1));
M.mobExp = (t) => Math.round(8 * Math.pow(1.75, t - 1));
M.dungeonGold = (t) => Math.round(70 * Math.pow(1.8, t - 1));
M.BOSS_HP = 12; M.BOSS_ATK = 1.5;         // 보스 = 졸개 × 배율

// ── 침공 (마을 광장 전투) ── 지면 게임 오버 대신 그날 아침으로 되감기
M.INVASIONS = {
  8:  { name: '들개 깡패단',       mob: 'dog', kills: 5, boss: '들개 두목',       bossFace: 'dog',    t: 2.2 },
  16: { name: '들개 깡패단 2차',   mob: 'dog', kills: 7, boss: '들개 두목 (진심)', bossFace: 'dog',    t: 3.6 },
  24: { name: '들개 깡패단 최후',  mob: 'dog', kills: 8, boss: '들개 대두목',     bossFace: 'dog',    t: 5.0 },
  30: { name: '그림자 고양이',     mob: 'scrow', kills: 6, boss: '그림자 고양이', bossFace: 'shadow', t: 6.0, final: true },
};
M.INVASION_HOUR = 18;                     // 그날 18시가 넘으면 쳐들어온다

// ── 주인공 성장 ──
M.BASE = { hp: 120, atk: 5, agi: 5, mag: 5 };
M.expNeed = (lv) => Math.round(26 * Math.pow(lv, 1.55));
M.LV_HP = 18;                             // 레벨당 최대 체력, 능력치는 각 +1

// ── 전투 ──
M.ARENA = 11;                             // 전장 반경(정사각 ±11m)
M.HERO_R = 0.38;
M.HERO_SPD = 5.0;
M.ATK_RANGE = 1.75; M.ATK_ARC = 1.15;     // 앞쪽 부채꼴(라디안 반각)
M.COMBO = [{ t: 0.34, mult: 1.0 }, { t: 0.34, mult: 1.15 }, { t: 0.5, mult: 1.9, knock: 2.6 }];
M.COMBO_WINDOW = 0.55;
M.DASH = { t: 0.2, spd: 17, cd: 1.4, iframe: 0.28 };
M.SKILL = { r: 2.9, cd: 7.5, t: 0.45 };
M.MOB_WINDUP = 0.55; M.MOB_CD = 1.25; M.MAX_ALIVE = 4;
M.BOSS_SLAM = { r: 3.0, warn: 1.1, cd: 5.5 };

// ── 난이도 (몬스터 체력·공격력 · 금화 배율) ──
M.DIFFS = {
  easy:   { name: '이지',     hp: 0.7,  atk: 0.6,  gold: 1.25 },
  normal: { name: '노말',     hp: 1.0,  atk: 1.0,  gold: 1.0 },
  hard:   { name: '하드',     hp: 1.2,  atk: 1.18, gold: 0.9 },
  crazy:  { name: '크레이지', hp: 1.4,  atk: 1.38, gold: 0.85 },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
