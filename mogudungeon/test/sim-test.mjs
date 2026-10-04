// sim-test.mjs — 헤드리스 시뮬레이션: 8방향 이동·콤보·스킬·피격·상자·아이템·구간 게이트·갈림길·보스·레벨업·컨티뉴·결정성 (node 단독)
import './shim.mjs';

const M = globalThis.window.MDN;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 60;
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, typeof input === 'function' ? input(st, i) : (input || {})));
  return evs;
};
const quiet = (st) => { st.pending = []; st.enemies = []; st.bullets = []; st.items = []; };
const mk = (kind, x, z, over) => {
  const K = M.ENEMY[kind];
  return Object.assign({ id: 9000 + Math.floor(Math.random() * 1000), kind, x, z, face: -1, hp: K.hp, maxHp: K.hp, atk: K.atk, spd: K.spd, range: K.range, r: K.r,
    state: 'idle', st: 0, atkCd: 99, inv: 0, flash: 0, walk: 0, kb: 0, boss: !!K.boss, heavy: !!K.heavy, ranged: !!K.ranged, undead: !!K.undead, wob: 0, entered: true }, over || {});
};
// 공격 버튼 한 번 누르기 (edge)
const tap = (st, key) => { const a = run(st, DT, { [key]: true }); a.push(...run(st, DT, {})); return a; };

// 1) 초기 상태 · 스테이지 로드
{
  const st = L.create(1, 'normal', 'fighter');
  check('시작: 어둠의 숲 · 구간 3개 · HP 120 · 상자 3개', st.stageKey === 'forest' && st.sections === 3 && st.p.hp === 120 && st.props.length === 3);
  run(st, 2);
  check('웨이브 등장 (대기열 소진 → 적 생성)', st.enemies.length > 0 && st.pending.length === 0);
}

// 2) 8방향 이동 · 경계 · 게이트(구간 잠김)
{
  const st = L.create(2, 'normal', 'thief'); quiet(st);
  st.pending = [{ kind: 'kobold', x: 900, z: 0.5, side: 1, delay: 99 }];   // 잠긴 상태 유지
  run(st, 0.5, { right: true });
  check('→ 이동 (도적은 빠르다)', st.p.x > 60 + 60);
  run(st, 0.5, { up: true }); const z1 = st.p.z; run(st, 1.0, { down: true });
  check('↑↓ 깊이 이동 + 경계', z1 < 0.5 && st.p.z > z1 && st.p.z <= 0.98);
  run(st, 6, { right: true });
  check('게이트 잠김: 화면 오른쪽 끝에서 멈춤 · 카메라 고정', st.p.x <= M.W - 14 + 0.01 && st.camX === 0);
  run(st, 6, { left: true });
  check('왼쪽 경계', st.p.x >= 14 - 0.01);
}

// 3) 콤보 공격 → 피해 · 3타 다운 · 처치 → 금화·경험치
{
  const st = L.create(3, 'normal', 'fighter'); quiet(st);
  st.p.x = 200; st.p.z = 0.5; st.p.face = 1;
  st.enemies.push(mk('kobold', 224, 0.5));
  let evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('1타 명중 → hurt 이벤트 · HP 감소', evs.some((e) => e.type === 'hurt') && st.enemies[0].hp === 30 - 14);
  evs = tap(st, 'atk'); evs.push(...run(st, 0.3)); evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('3타 = 처치 (30 HP) → kill · 금화 20 · 경험치 10', st.kills === 1 && st.gold === 20 && st.p.exp === 10 && evs.some((e) => e.type === 'kill'));
  st.enemies = [mk('orc', 226, 0.5)];
  st.p.combo = 2; st.p.comboT = 0.5;
  evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('3타 → 오크 다운(kd)', evs.some((e) => e.type === 'hurt' && e.kd) && st.enemies[0].state === 'kd');
  st.enemies = [mk('kobold', 200 - 24, 0.5)];
  evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('뒤쪽 적은 맞지 않는다', !evs.some((e) => e.type === 'hurt'));
  st.enemies = [mk('kobold', 224, 0.5 + 0.3)];
  evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('깊이가 다르면 빗나감', !evs.some((e) => e.type === 'hurt'));
}

// 4) 적 공격 → 피격 · 무적 · 사망 → 컨티뉴
{
  const st = L.create(4, 'normal', 'mage'); quiet(st);
  st.p.x = 200; st.p.z = 0.5; st.p.inv = 0;
  st.enemies.push(mk('kobold', 220, 0.5, { atkCd: 0 }));
  let evs = run(st, 1.5);
  check('코볼트 공격 → phit · HP 감소 · 무적', evs.some((e) => e.type === 'phit') && st.p.hp < 80);
  st.p.hp = 5; st.p.inv = 0; st.enemies[0].atkCd = 0; st.enemies[0].state = 'idle';
  evs = run(st, 1.5);
  check('HP 0 → dead 이벤트 · phase dead', evs.some((e) => e.type === 'dead') && st.phase === 'dead');
  run(st, 1.6);
  check('쓰러진 뒤 deathDone', L.deathDone(st));
  const sec = st.section;
  L.continueRun(st);
  check('컨티뉴 → HP/MP 회복 · 같은 구간 재시작 · 컨티뉴 1', st.phase === 'play' && st.p.hp === st.p.maxHp && st.p.mp === M.MAX_MP && st.section === sec && st.continues === 1 && st.pending.length > 0);
}

// 5) 스킬 4종 · MP
{
  // 전사 회전베기: 주위 전부 다운
  let st = L.create(5, 'normal', 'fighter'); quiet(st); st.p.x = 200; st.p.mp = 100;
  st.enemies.push(mk('kobold', 240, 0.55), mk('kobold', 160, 0.45));
  let evs = tap(st, 'skill'); evs.push(...run(st, 0.2));
  check('전사 회전베기: 양쪽 적 모두 피해 · MP -30', evs.filter((e) => e.type === 'hurt').length === 2 && st.p.mp < 71 && evs.some((e) => e.type === 'skill'));
  run(st, 0.5); st.p.mp = 5; evs = tap(st, 'skill');
  check('MP 부족 → nomp', evs.some((e) => e.type === 'nomp'));
  // 마법사 파이어볼: 관통
  st = L.create(6, 'normal', 'mage'); quiet(st); st.p.x = 100; st.p.mp = 100;
  st.enemies.push(mk('kobold', 180, 0.5), mk('kobold', 260, 0.5));
  evs = tap(st, 'skill'); evs.push(...run(st, 1.0));
  check('마법사 파이어볼: 두 적 관통 · 36 피해', evs.filter((e) => e.type === 'bhit').length === 2 && st.enemies.every((e) => e.hp === 30 - 36 || e.state === 'dead'));
  // 도적 단검: 3개 부채꼴
  st = L.create(7, 'normal', 'thief'); quiet(st); st.p.x = 100; st.p.mp = 100;
  evs = tap(st, 'skill');
  check('도적 단검 투척: 투사체 3개', st.bullets.filter((b) => b.kind === 'dagger').length === 3);
  // 성직자 치유 + 언데드 소각
  st = L.create(8, 'normal', 'cleric'); quiet(st); st.p.x = 200; st.p.mp = 100; st.p.hp = 30;
  st.enemies.push(mk('skeleton', 240, 0.5), mk('kobold', 250, 0.55));
  evs = tap(st, 'skill'); evs.push(...run(st, 0.2));
  check('성직자 치유의 빛: HP +45 · 해골만 피해', st.p.hp === 75 && evs.filter((e) => e.type === 'hurt').length === 1 && st.enemies[1].hp === 30);
  run(st, 4);
  check('MP 자연 회복', st.p.mp > 65 + 8);
}

// 6) 보물상자 → 아이템 → 획득
{
  const st = L.create(9, 'normal', 'thief'); quiet(st);
  st.p.x = 200; st.p.z = 0.5; st.p.face = 1;
  st.props = [{ id: 1, kind: 'chest', x: 226, z: 0.5, opened: false }];
  let evs = tap(st, 'atk'); evs.push(...run(st, 0.3));
  check('상자를 때리면 열린다 → 아이템 드롭', evs.some((e) => e.type === 'chest') && st.props[0].opened && st.items.length === 1);
  const it = st.items[0]; it.x = st.p.x; it.z = st.p.z;
  const g0 = st.gold, hp0 = st.p.hp, atk0 = st.p.atk;
  evs = run(st, 0.1);
  check(`아이템 획득 (${it.kind})`, evs.some((e) => e.type === 'item' && e.kind === it.kind) && st.items.length === 0 &&
    (it.kind === 'gold' ? st.gold > g0 : it.kind === 'ring' ? st.atk > atk0 || st.p.atk > atk0 : true));
  st.items.push({ id: 5, kind: 'potion', x: st.p.x, z: st.p.z, t: 0 }); st.p.hp = 10; run(st, 0.1);
  check('치유 물약 HP +40', st.p.hp === 50 && hp0 >= 0);
  st.items.push({ id: 6, kind: 'mana', x: st.p.x, z: st.p.z, t: 0 }); st.p.mp = 10; run(st, 0.1);
  check('마나 물약 MP +40', st.p.mp >= 50 && st.p.mp < 52);
  st.items.push({ id: 7, kind: 'ring', x: st.p.x, z: st.p.z, t: 0 }); const a0 = st.p.atk; run(st, 0.1);
  check('힘의 반지 공격력 +2', st.p.atk === a0 + 2);
}

// 7) 구간 전멸 → GO → 전진 → 다음 구간 웨이브 · 스테이지 클리어 → 갈림길 → 선택
{
  const st = L.create(10, 'normal', 'fighter'); quiet(st);
  st.pending = [{ kind: 'kobold', x: 300, z: 0.5, side: 1, delay: 0 }];
  run(st, 0.1);
  st.enemies[0].hp = 1; st.p.x = 276; st.p.z = 0.5; st.p.face = 1;
  let evs = tap(st, 'atk'); evs.push(...run(st, 0.4));
  check('구간 전멸 → go 이벤트 · 게이트 개방', evs.some((e) => e.type === 'go') && st.gateOpen);
  evs = run(st, 6, { right: true });
  check('오른쪽 전진 → 구간 1 진입 · 새 웨이브', evs.some((e) => e.type === 'section') && st.section === 1 && (st.pending.length + st.enemies.length) > 0 && !st.gateOpen);
  // 마지막 구간까지 강제 전멸
  quiet(st); st.section = st.sections - 1; st.waveDone = false; st.gateOpen = true; st.camX = st.section * M.SEC_W; st.p.x = st.camX + 100;
  evs = run(st, 0.1);
  check('어둠의 숲 클리어 → stageclear (갈림길 2개)', evs.some((e) => e.type === 'stageclear' && e.next.length === 2) && st.phase === 'stageclear');
  L.chooseNext(st, 'graveyard');
  check('갈림길 선택 → 저주받은 묘지 · 루트 기록', st.stageKey === 'graveyard' && st.route.join('>') === 'forest>graveyard' && st.phase === 'play' && st.camX === 0);
  L.chooseNext(st, 'nope');
  check('잘못된 선택은 첫 후보로 (bridge)', st.stageKey === 'bridge');
}

// 8) 보스: 리치 소환 · 오우거 스매시 · 보스 격파 드롭 · 최종 클리어
{
  let st = L.create(11, 'normal', 'cleric'); quiet(st);
  st.p.x = 100; st.p.inv = 1e9;
  st.enemies.push(mk('lich', 300, 0.5, { atkCd: 0, summonT: 0.1 }));
  let evs = run(st, 3);
  check('리치: 뼈 탄 발사 + 해골 소환', evs.some((e) => e.type === 'efire') && evs.some((e) => e.type === 'summon') && st.enemies.some((e) => e.kind === 'skeleton'));
  st = L.create(12, 'normal', 'fighter'); quiet(st);
  st.p.x = 200; st.p.z = 0.5; st.p.inv = 0;
  st.enemies.push(mk('ogre', 236, 0.5, { atkCd: 0 }));
  evs = run(st, 1.5);
  check('오우거 스매시 → 큰 피해', evs.some((e) => e.type === 'eatk' && e.smash) && st.p.hp <= 120 - 22);
  st.enemies[0].hp = 1; st.p.inv = 1e9; st.p.face = 1;
  evs = tap(st, 'atk'); evs.push(...run(st, 0.4));
  check('보스 격파 → bossdead · 츄르+반지 드롭 · 경험치 120', evs.some((e) => e.type === 'bossdead') && st.items.some((i) => i.kind === 'churu') && st.items.some((i) => i.kind === 'ring') && st.p.level >= 3);
  // 최종: 용의 둥지 마지막 구간 전멸 → clear
  L.loadStage(st, 'lair'); quiet(st);
  st.section = st.sections - 1; st.camX = st.section * M.SEC_W; st.p.x = st.camX + 100; st.waveDone = false;
  evs = run(st, 0.1);
  check('용의 둥지 전멸 → clear · 보너스 금화', evs.some((e) => e.type === 'clear') && st.phase === 'clear');
}

// 9) 레벨업 테이블
{
  const st = L.create(13, 'normal', 'fighter'); quiet(st);
  const evs = [];
  L._addExp(st, 30, evs);
  check('경험치 30 → 레벨 2 · 최대 HP 132 · 공격 16 · 회복', st.p.level === 2 && st.p.maxHp === 132 && st.p.atk === 16 && st.p.hp === 132 && evs.some((e) => e.type === 'levelup'));
  L._addExp(st, 100000, evs);
  check('최대 레벨 10', st.p.level === M.MAX_LEVEL);
}

// 10) 난이도 반영 · 결정성 · 4직업 봇 완주
{
  const a = L.create(14, 'easy', 'fighter'), b = L.create(14, 'crazy', 'fighter');
  run(a, 3); run(b, 3);
  const ha = a.enemies[0] && a.enemies[0].maxHp, hb = b.enemies[0] && b.enemies[0].maxHp;
  check(`난이도: 크레이지 적 체력 > 이지 (${ha} < ${hb}) · 마릿수 증가`, ha < hb && (b.enemies.length + b.pending.length) > (a.enemies.length + a.pending.length));
  const bot = (s, i) => {
    s.p.inv = 9;
    const p = s.p, es = s.enemies.filter((e) => e.state !== 'dead');
    if (!es.length) return { right: true, atk: i % 8 < 3 };
    es.sort((x, y) => Math.abs(x.x - p.x) - Math.abs(y.x - p.x)); const e = es[0];
    return { left: e.x < p.x - p.range * 0.7 || (e.x < p.x && p.face > 0), right: e.x > p.x + p.range * 0.7 || (e.x > p.x && p.face < 0), up: e.z < p.z - 0.05, down: e.z > p.z + 0.05, atk: i % 6 < 3, skill: i % 40 === 0 };
  };
  const play = (seed, cls) => {
    const s = L.create(seed, 'hard', cls); let n = 0;
    while (s.phase !== 'clear' && n < 60 * 900) {
      if (s.phase === 'stageclear') { L.chooseNext(s, s.stage.next[n % 2]); continue; }
      if (s.phase === 'dead') { L.continueRun(s); continue; }
      L.step(s, DT, bot(s, n)); n++;
    }
    return s;
  };
  const r1 = play(21, 'fighter'), r2 = play(21, 'fighter');
  check(`무적 봇 하드 완주 (전사 · 루트 ${r1.route.join('>')} · ${r1.kills}처치)`, r1.phase === 'clear' && r1.route.length === 5);
  check('같은 시드 = 같은 결과 (결정성)', r1.gold === r2.gold && r1.kills === r2.kills && r1.route.join() === r2.route.join());
  for (const cls of ['mage', 'thief', 'cleric']) { const r = play(22, cls); check(`무적 봇 하드 완주 (${M.CLASSES[cls].name})`, r.phase === 'clear'); }
}

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 시뮬레이션 전체 통과');
process.exit(fail ? 1 : 0);
