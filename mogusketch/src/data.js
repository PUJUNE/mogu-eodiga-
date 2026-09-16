// data.js — 규칙 상수 · 난이도 · 기술 프레임 데이터 · 캐릭터 정의 (DOM 무의존)
// 수치는 「모구 스케치 파이터 설계.md」 3~4절 준거
const M = window.MSK;

// ── 화면·경기장 (논리 좌표 960×540, 바닥선 FLOOR) ──
M.W = 960; M.H = 540;
M.FLOOR = 440;                  // 캐릭터 발이 닿는 화면 y
M.WALL_L = 110; M.WALL_R = 850; // 좌우 로프(벽)
M.START_X = [330, 630];

// ── 경기 규칙 ──
M.ROUND_TIME = 60;
M.ROUNDS_TO_WIN = 2;
M.INTRO_FIRST = 2.4;            // 1라운드: 도전자 소개 1.2초 + ROUND/FIGHT
M.INTRO_NEXT = 1.4;
M.KO_TIME = 1.6;
M.ROUND_END_TIME = 1.8;

// ── 물리 ──
M.GRAVITY = 2300;
M.JUMP_V = 830;
M.JUMP_VX = 230;
M.BODY = 26;                    // 몸 반폭 — 두 캐릭터 최소 간격은 BODY*2
M.HURT = { stand: 150, crouch: 95, air: 120 };   // 피격 판정 높이
M.BANDS = { high: [100, 158], mid: [35, 128], low: [0, 48] };

// ── 공방 규칙 ──
M.CMD_WINDOW = 0.4;             // 커맨드 입력 유효 시간
M.GRAB_WINDOW = 0.05;           // 약+강 동시 입력 허용 간격
M.CHIP = 0.10;                  // 가드 시 칩 대미지 비율
M.COMBO_STEP = 0.10;            // 연속 적중마다 대미지 감소
M.COMBO_FLOOR = 0.40;           // 감소 하한
M.GAUGE_HIT = 8; M.GAUGE_HURT = 5; M.GAUGE_BLOCK = 3; M.GAUGE_MAX = 100;
M.DOWN_TIME = 0.8;
M.WAKE_INVULN = 0.5;
M.HITSTOP = 0.06; M.HITSTOP_STRONG = 0.10;

// ── 난이도 (설계 4절 표) ──
M.DIFFS = {
  easy:   { name: '이지',     react: 0.60, guard: 0.20, combo: 1,  antiAir: 0.00, superUse: 0.30, punish: false },
  normal: { name: '노말',     react: 0.40, guard: 0.45, combo: 2,  antiAir: 0.25, superUse: 0.60, punish: false },
  hard:   { name: '하드',     react: 0.25, guard: 0.70, combo: 3,  antiAir: 0.60, superUse: 1.00, punish: true },
  crazy:  { name: '크레이지', react: 0.15, guard: 0.85, combo: 99, antiAir: 0.90, superUse: 1.00, punish: true, superPunish: true },
};
M.DIFF_ORDER = ['easy', 'normal', 'hard', 'crazy'];
M.diff = 'normal';
M.nextDiff = (d) => M.DIFF_ORDER[M.DIFF_ORDER.indexOf(d) + 1] || null;

// ── 공통 통상기 (캐릭터 사거리 배율·대미지 배율로 보정) ──
// kd: 'always' 항상 다운 / 'combo' 콤보 막타(2타째 이상)일 때 다운 / false
M.MOVES = {
  lp:   { startup: .06, active: .06, recovery: .12, dmg: 40,  reach: 72,  band: 'high', hitstun: .36, blockstun: .18, push: 26, kd: false,    anim: 'jab' },
  hp:   { startup: .12, active: .08, recovery: .24, dmg: 80,  reach: 98,  band: 'mid',  hitstun: .42, blockstun: .24, push: 54, kd: 'combo',  anim: 'kick' },
  clp:  { startup: .06, active: .06, recovery: .12, dmg: 35,  reach: 74,  band: 'low',  hitstun: .34, blockstun: .16, push: 22, kd: false,    anim: 'cjab' },
  chp:  { startup: .12, active: .08, recovery: .30, dmg: 75,  reach: 108, band: 'low',  hitstun: .40, blockstun: .24, push: 40, kd: 'always', anim: 'sweep' },
  jlp:  { startup: .05, active: .14, recovery: 0,   dmg: 45,  reach: 64,  band: 'air',  hitstun: .30, blockstun: .18, push: 24, kd: false,    anim: 'jpunch' },
  jhp:  { startup: .08, active: .16, recovery: 0,   dmg: 85,  reach: 82,  band: 'air',  hitstun: .42, blockstun: .24, push: 40, kd: false,    anim: 'jkick' },
  grab: { startup: .05, active: .05, recovery: .40, dmg: 120, reach: 58,  band: 'grab', hitstun: 0,   blockstun: 0,   push: 90, kd: 'always', anim: 'grab' },
};

const SPEED = { slow: 150, normal: 190, fast: 230, vfast: 270 };
const RANGE = { short: 0.88, mid: 1.0, long: 1.18 };

// ── 캐릭터 (설계 2절 표) ──
// sp1 = 커맨드 ↓→+약 (터치 필살 버튼) / sp2 = →↓→+강 (터치 필살+↑) / sup = 게이지 100 초필살
M.FIGHTERS = {
  mogu: {
    name: '모구', ink: '#18181c', hp: 1000, speed: SPEED.normal, range: RANGE.mid, style: 'mogu', sx: 1, sy: 1,
    trait: '밸런스형 도복 고양이',
    sp1: { type: 'projectile', name: '냥파동', startup: .18, recovery: .35, dmg: 90, speed: 420, count: 1, gap: 0, band: 'mid', hitstun: .45, blockstun: .26, kd: false, sound: 'fireball' },
    sp2: { type: 'rising', name: '고양이 발톱 연무', startup: .08, active: .30, recovery: .45, hits: [47, 47, 46], reach: 78, riseV: 660, band: 'mid', kd: 'always', invuln: .14 },
    sup: { type: 'rush', name: '초필살 스케치 러시', startup: .20, dashV: 780, active: .35, recovery: .60, hits: [40, 40, 40, 50, 50, 100], reach: 92, band: 'mid', kd: 'always' },
  },
  bboy: {
    name: '후드 비보이 쥐', ink: '#d6282e', hp: 900, speed: SPEED.fast, range: RANGE.short, style: 'bboy', sx: 1, sy: 1,
    trait: '비보잉 동작을 공격으로 쓴다', jumpRate: 0.10,
    sp1: { type: 'spin', name: '윈드밀 킥', startup: .14, dashV: 260, active: .45, recovery: .35, hits: [50, 50], reach: 86, band: 'low', kd: 'always' },
  },
  kkokko: {
    name: '꼬꼬 권법가', ink: '#d6282e', hp: 900, speed: SPEED.fast, range: RANGE.short, style: 'kkokko', sx: .95, sy: .95,
    trait: '점프 공격이 많다', jumpRate: 0.35,
    sp1: { type: 'dive', name: '공중 날개 치기', startup: .10, riseV: 780, diveVx: 430, diveVy: -950, active: .60, recovery: .30, hits: [100], reach: 70, band: 'air', kd: 'always' },
  },
  boxer: {
    name: '복서 쥐', ink: '#d6282e', hp: 1000, speed: SPEED.normal, range: RANGE.mid, style: 'boxer', sx: 1, sy: 1,
    trait: '가드가 단단하고 잡기를 쓰지 않는다', noGrab: true, guardBonus: 0.10, jumpRate: 0.04,
    sp1: { type: 'dash', name: '어퍼 러시', startup: .10, dashV: 520, active: .22, recovery: .40, hits: [110], reach: 80, band: 'mid', kd: 'always', invuln: .10, anti: true },
  },
  tkd: {
    name: '태권 쥐', ink: '#d6282e', hp: 950, speed: SPEED.normal, range: RANGE.long, style: 'tkd', sx: 1, sy: 1.02,
    trait: '발차기 사거리가 길다', jumpRate: 0.08,
    sp1: { type: 'chain', name: '돌려차기 3연', startup: .10, gap: .16, active: .12, recovery: .35, hits: [40, 40, 50], bands: ['high', 'mid', 'mid'], reach: 112, dashV: 120, kd: 'always' },
  },
  sumo: {
    name: '스모 쥐', ink: '#d6282e', hp: 1300, speed: SPEED.slow, range: RANGE.short, style: 'sumo', sx: 1.25, sy: 1.02,
    trait: '잡기 대미지가 크고 밀어낸다', grabMul: 1.5, jumpRate: 0.02,
    sp1: { type: 'push', name: '백 핸드 밀치기', startup: .16, active: .10, recovery: .40, hits: [90], reach: 92, band: 'mid', push: 320, wallBonus: 20, kd: false },
  },
  ninja: {
    name: '닌자 쥐', ink: '#d6282e', hp: 850, speed: SPEED.vfast, range: RANGE.mid, style: 'ninja', sx: .94, sy: 1,
    trait: '뒤로 순간이동한다', jumpRate: 0.14,
    sp1: { type: 'projectile', name: '수리검 3연', startup: .14, recovery: .40, dmg: 30, speed: 560, count: 3, gap: .10, band: 'mid', hitstun: .25, blockstun: .14, kd: false, sound: 'shuriken' },
    sp2: { type: 'teleport', name: '순간이동', startup: .12, recovery: .18 },
  },
  wrestler: {
    name: '레슬러 쥐', ink: '#d6282e', hp: 1200, speed: SPEED.slow, range: RANGE.short, style: 'wrestler', sx: 1.12, sy: 1.04,
    trait: '가드 불가 잡기가 두 가지다', grabMul: 1.3, jumpRate: 0.03,
    sp1: { type: 'cmdgrab', name: '파일 드라이버', startup: .10, active: .06, recovery: .55, dmg: 180, reach: 74 },
  },
  sensei: {
    name: '연필 사범', ink: '#d6282e', hp: 1500, speed: SPEED.normal, range: RANGE.long, style: 'sensei', sx: 1, sy: 1.04,
    trait: '선을 그어 벽과 함정을 만든다', jumpRate: 0.05, boss: true,
    sp1: { type: 'trap', name: '선 긋기', startup: .22, recovery: .30, delay: .55, dmg: 60, width: 90, band: 'low', kd: 'always' },
    sp2: { type: 'wall', name: '선 벽', startup: .20, recovery: .25, life: 3.0, offset: 120 },
    sp3: { type: 'eraser', name: '지우개 폭풍', startup: .35, active: .50, recovery: .50, dmg: 150, band: 'mid', width: 480, kd: 'always' },
  },
};

M.LADDER = ['bboy', 'kkokko', 'boxer', 'tkd', 'sumo', 'ninja', 'wrestler', 'sensei'];
M.PLAYER = 'mogu';

// 도전자 초필살 = 대표 필살기의 강화판 (대미지 ×2.4, 시작 무적). 사범은 지우개 폭풍 강화
M.superOf = function (def) {
  if (def.sup) return def.sup;
  const base = def.sp3 || def.sp1;
  const s = Object.assign({}, base, { name: '초필살 ' + base.name, invuln: Math.max(base.invuln || 0, .20), superMul: 2.4 });
  return s;
};
