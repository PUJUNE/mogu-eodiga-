// sim-test.mjs — 헤드리스 대전 시뮬레이션: 설계 8절 완료 기준 중 로직으로 확인할 수 있는 항목 (node 단독)
import './shim.mjs';

const M = globalThis.window.MSK;
const L = M.Logic;
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? ` (${extra})` : '')); if (!ok) fail++; };
const DT = 1 / 60;

function mk(stage = 0, diff = 'normal', seed = 1) {
  const st = L.create(seed, diff, stage);
  st.phase = 'fight'; st.phaseT = 0;
  return st;
}
function place(st, x0, x1) {
  st.p[0].x = x0; st.p[1].x = x1;
  st.p[0].face = Math.sign(x1 - x0); st.p[1].face = Math.sign(x0 - x1);
}
// 프레임별 입력 스크립트: frames = [[in0, in1, n], ...]
function play(st, frames) {
  const evs = [];
  for (const [a, b, n] of frames) for (let i = 0; i < (n || 1); i++) evs.push(...L.step(st, DT, [a || {}, b || {}]));
  return evs;
}
const idle = (st, sec, a, b) => play(st, [[a || {}, b || {}, Math.round(sec / DT)]]);

// 1) 시작 상태
{
  const st = L.create(1, 'normal', 0);
  check('시작: 도전자 소개 단계, 체력 모구 1000 / 후드 비보이 쥐 900',
    st.phase === 'intro' && st.p[0].hp === 1000 && st.p[1].hp === 900 && st.oppId === 'bboy');
  const ev = idle(st, M.INTRO_FIRST + 0.05);
  check('소개가 끝나면 FIGHT 이벤트와 함께 대전 시작', st.phase === 'fight' && ev.some((e) => e.type === 'fight'));
}

// 2) 서서 가드 — 약 공격 대미지 40 → 칩 4 (10%)
{
  const st = mk(); place(st, 400, 470);
  play(st, [[{ left: true }, { lp: true }, 2], [{ left: true }, {}, 30]]);
  check('서서 가드: 약 공격을 막으면 대미지 10%(4)만 들어간다', st.p[0].hp === 996 && st.stats.blocks[0] === 1, `hp=${st.p[0].hp}`);
}

// 3) 앉아 가드 vs 하단 / 서서 가드는 하단에 뚫린다
{
  const st = mk(); place(st, 400, 470);
  play(st, [[{ left: true, down: true }, { down: true, lp: true }, 2], [{ left: true, down: true }, { down: true }, 30]]);
  check('앉아 가드: 하단(앉아 약)을 막는다', st.p[0].hp === 1000 - 4 && st.stats.blocks[0] === 1, `hp=${st.p[0].hp}`);
  const s2 = mk(); place(s2, 400, 470);
  play(s2, [[{ left: true }, { down: true, lp: true }, 2], [{ left: true }, { down: true }, 30]]);
  check('서서 가드로는 하단이 막히지 않는다', s2.p[0].hp === 1000 - 35 && s2.stats.blocks[0] === 0, `hp=${s2.p[0].hp}`);
}

// 4) 상단은 앉은 상대에게 빗나간다
{
  const st = mk(); place(st, 400, 470);
  play(st, [[{ down: true }, { lp: true }, 2], [{ down: true }, {}, 30]]);
  check('서서 약(상단)은 앉은 상대 위로 빗나간다', st.p[0].hp === 1000);
}

// 5) 잡기 — 가드 중인 상대에게도 들어간다, 대미지 120, 다운
{
  const st = mk(); place(st, 400, 456);
  const ev = play(st, [[{ lp: true, hp: true }, { right: true }, 2], [{}, { right: true }, 40]]);
  check('약+강 동시 입력 = 잡기, 가드로 막히지 않고 대미지 120', st.p[1].hp === 900 - 120 && ev.some((e) => e.type === 'grab'), `hp=${st.p[1].hp}`);
  check('잡힌 상대는 다운된다', ev.some((e) => e.type === 'land' && e.side === 1 && e.heavy));
}

// 6) 냥파동 — ↓ → ↘ → → + 약, 적중 대미지 90
{
  const st = mk(); place(st, 300, 620);
  const ev = play(st, [
    [{ down: true }, {}, 3], [{ down: true, right: true }, {}, 3], [{ right: true, lp: true }, {}, 2], [{}, {}, 80],
  ]);
  check('아래→앞+약으로 냥파동 발사', ev.some((e) => e.type === 'projectile' && e.side === 0));
  check('냥파동 적중 대미지 90', st.p[1].hp === 900 - 90, `hp=${st.p[1].hp}`);
}

// 7) 고양이 발톱 연무 — →↓↘+강 커맨드
{
  const st = mk(); place(st, 400, 470);
  const ev = play(st, [
    [{ right: true }, {}, 3], [{ down: true }, {}, 3], [{ down: true, right: true }, {}, 2], [{ hp: true }, {}, 2], [{}, {}, 90],
  ]);
  const sp = ev.find((e) => e.type === 'special' && e.side === 0);
  check('앞→아래→앞+강으로 고양이 발톱 연무', sp && sp.name === '고양이 발톱 연무', sp && sp.name);
}

// 8) 필살 게이지 — 적중 +8 / 피격 +5 / 가드 +3, 100에서 초필살(320)
{
  const st = mk(); place(st, 400, 470);
  play(st, [[{ lp: true }, {}, 2], [{}, {}, 40]]);
  check('적중 시 공격자 +8, 피격자 +5', st.p[0].gauge === 8 && st.p[1].gauge === 5, `${st.p[0].gauge}/${st.p[1].gauge}`);
  const s2 = mk(); place(s2, 400, 470);
  play(s2, [[{ lp: true }, { right: true }, 2], [{}, { right: true }, 40]]);
  check('가드 시 막은 쪽 +3', s2.p[1].gauge === 3, `${s2.p[1].gauge}`);

  const s3 = mk(); place(s3, 380, 520);
  s3.p[0].gauge = 100;
  s3.p[1].hp = 900;
  const ev = play(s3, [[{ su: true }, {}, 2], [{}, {}, 150]]);
  check('게이지 100에서 C = 초필살 발동', ev.some((e) => e.type === 'super' && e.side === 0) && s3.p[0].gauge === 0);
  check('초필살 스케치 러시 대미지 320', s3.p[1].hp === 900 - 320, `hp=${s3.p[1].hp}`);
}

// 9) 콤보 보정 — 10%씩 감소, 하한 40%
{
  const st = mk();
  const a = st.p[0], d = st.p[1];
  const dmgs = [];
  for (let i = 0; i < 10; i++) {
    d.state = 'hitstun'; d.invuln = 0; d.hp = 10000;
    const before = d.hp;
    L.applyHit(st, a, d, 100, { band: 'mid', hitstun: 1, push: 0, kd: false }, []);
    dmgs.push(before - d.hp);
  }
  check('연속 적중 대미지가 단계적으로 줄고 40% 아래로 내려가지 않는다',
    dmgs.join(',') === '100,90,80,70,60,50,40,40,40,40', dmgs.join(','));
}

// 10) 실제 입력으로 약→약→강 링크 콤보
{
  const st = mk(); place(st, 400, 468);
  const ev = play(st, [
    [{ lp: true }, {}, 2], [{}, {}, 18], [{ lp: true }, {}, 2], [{}, {}, 18], [{ hp: true }, {}, 2], [{}, {}, 60],
  ]);
  const maxCombo = Math.max(...ev.filter((e) => e.type === 'hit' && e.side === 0).map((e) => e.combo));
  check('약→약→강이 끊기지 않고 3히트 콤보로 이어진다', maxCombo === 3, `max combo ${maxCombo}`);
}

// 11) 다운 0.8초 + 기상 무적 0.5초
{
  const st = mk(); place(st, 400, 470);
  const d = st.p[1];
  L.applyHit(st, st.p[0], d, 50, { band: 'mid', kd: 'always', push: 0 }, []);
  st.hitstop = 0;
  let landT = null, wakeT = null, t = 0;
  for (let i = 0; i < 240; i++) {
    const ev = L.step(st, DT, [{}, {}]); t += DT;
    if (ev.some((e) => e.type === 'land' && e.side === 1)) landT = t;
    if (ev.some((e) => e.type === 'wakeup' && e.side === 1)) { wakeT = t; break; }
  }
  check('다운 시간 0.8초 후 기상', landT !== null && wakeT !== null && Math.abs(wakeT - landT - M.DOWN_TIME) < 0.05, `${landT && (wakeT - landT).toFixed(2)}s`);
  check('기상 직후 무적 0.5초', Math.abs(d.invuln - M.WAKE_INVULN) < 0.03);
}

// 12) 시간 초과 — 남은 체력 비율이 높은 쪽 승리
{
  const st = mk(); place(st, 300, 660);
  st.timer = 0.2;
  st.p[0].hp = 600;          // 60%
  st.p[1].hp = 500;          // 55.6%
  const ev = idle(st, 0.5);
  const tu = ev.find((e) => e.type === 'timeup');
  check('60초가 지나면 체력 비율이 높은 쪽이 라운드를 가져간다', tu && tu.winner === 0);
}

// 13) 3판 2선승
{
  const st = mk();
  const koRound = () => {
    place(st, 400, 470);
    st.p[1].hp = 1;
    play(st, [[{ lp: true }, {}, 2]]);
    idle(st, M.KO_TIME + M.ROUND_END_TIME + 0.4);
    if (st.phase === 'intro') idle(st, st.introLen + 0.05);
  };
  koRound();
  check('1라운드 KO 후 승수 1:0, 2라운드 시작', st.wins[0] === 1 && st.round === 2 && st.phase === 'fight', `wins=${st.wins} round=${st.round} phase=${st.phase}`);
  st.p[1].hp = 1;
  place(st, 400, 470);
  const ev = play(st, [[{ lp: true }, {}, 2], [{}, {}, Math.round((M.KO_TIME + M.ROUND_END_TIME + 0.4) / DT)]]);
  const me = ev.find((e) => e.type === 'matchEnd');
  check('두 라운드를 먼저 이긴 쪽이 경기 승리', me && me.winner === 0 && st.phase === 'matchEnd');
}

// 14) 도전자 8명 — 순서와 필살기
{
  const names = M.LADDER.map((id) => M.FIGHTERS[id].name).join(',');
  check('도전자 8명이 설계 순서대로', names === '후드 비보이 쥐,꼬꼬 권법가,복서 쥐,태권 쥐,스모 쥐,닌자 쥐,레슬러 쥐,연필 사범', names);
  const expected = { bboy: '윈드밀 킥', kkokko: '공중 날개 치기', boxer: '어퍼 러시', tkd: '돌려차기 3연', sumo: '백 핸드 밀치기', ninja: '수리검 3연', wrestler: '파일 드라이버', sensei: '지우개 폭풍' };
  M.LADDER.forEach((id, idx) => {
    const st = mk(idx, 'hard', 100 + idx);
    const ai = M.AI.create('hard', 7 + idx);
    const used = new Set();
    let t = 0;
    const rng = M.makeRng(55 + idx);
    let dummy = {};
    for (let i = 0; i < 60 * 90 && !used.has(expected[id]); i++) {
      if (i % 40 === 0) {
        const r = rng.next();
        dummy = r < 0.3 ? { left: true } : r < 0.6 ? { right: true } : r < 0.7 ? { up: true, right: true } : {};
      }
      st.p[0].hp = st.p[0].maxHp; st.p[1].hp = st.p[1].maxHp; st.timer = 60;
      const inp1 = M.AI.think(ai, st, 1, DT);
      for (const e of L.step(st, DT, [dummy, inp1])) if (e.type === 'special' || e.type === 'super') used.add(e.name.replace('초필살 ', ''));
      t += DT;
    }
    check(`도전자 ${idx + 1} ${M.FIGHTERS[id].name}가 필살기 「${expected[id]}」를 쓴다`, used.has(expected[id]), [...used].join('/'));
  });
}

// 15) 난이도별 AI — 가드 확률·반응 지연이 표대로
{
  const rates = {};
  for (const diff of M.DIFF_ORDER) {
    const st = mk(0, diff, 9);
    const ai = M.AI.create(diff, 31);
    let tick = 0;
    for (let i = 0; i < 60 * 240; i++) {
      st.p[0].hp = 1000; st.p[1].hp = 900; st.timer = 60;
      if (st.phase !== 'fight') { st.phase = 'fight'; }
      place(st, 400, 468);
      // 0.7초마다 약 공격 — CPU는 가드 여부만 판단하게 둔다
      const a = (tick++ % 42) < 2 ? { lp: true } : {};
      const b = M.AI.think(ai, st, 1, DT);
      delete b.lp; delete b.hp; delete b.grab; delete b.sp1; delete b.sp2; delete b.sp3; delete b.su; delete b.up;
      L.step(st, DT, [a, b]);
      st.hitstop = 0;
    }
    rates[diff] = ai.stats.guards / Math.max(1, ai.stats.threats);
    const lag = st.t - ai.buf[0].t;
    check(`${M.DIFFS[diff].name}: 가드 확률 ≈ ${M.DIFFS[diff].guard} (위협 ${ai.stats.threats}회)`,
      Math.abs(rates[diff] - M.DIFFS[diff].guard) < 0.12, rates[diff].toFixed(2));
    check(`${M.DIFFS[diff].name}: 반응 지연 ${M.DIFFS[diff].react * 1000}ms`, Math.abs(lag - M.DIFFS[diff].react) < 0.03, `${(lag * 1000).toFixed(0)}ms`);
  }
  check('난이도가 오를수록 가드 확률이 높아진다', rates.easy < rates.normal && rates.normal < rates.hard && rates.hard < rates.crazy);
}

// 16) 보스 격파 = 마지막 경기
{
  const st = mk(7);
  st.wins = [1, 0];
  place(st, 400, 470);
  st.p[1].hp = 1;
  const ev = play(st, [[{ lp: true }, {}, 2], [{}, {}, Math.round((M.KO_TIME + M.ROUND_END_TIME + 0.4) / DT)]]);
  const me = ev.find((e) => e.type === 'matchEnd');
  check('연필 사범을 이기면 마지막 경기 완료 이벤트(엔딩 진입)', me && me.winner === 0 && me.last === true);
}

// 17) 벽 — 로프 밖으로 나가지 않는다
{
  const st = mk(); place(st, 150, 600);
  idle(st, 2, { left: true });
  check('왼쪽 로프에서 멈춘다', st.p[0].x >= M.WALL_L + M.BODY - 0.01);
}

// 18) AI 대 AI 완주 — 예외 없이 경기가 끝난다
{
  let ok = true, ended = false;
  try {
    for (const idx of [0, 4, 7]) {
      const st = L.create(77 + idx, 'crazy', idx);
      const a0 = M.AI.create('crazy', 1 + idx), a1 = M.AI.create('crazy', 2 + idx);
      for (let i = 0; i < 60 * 60 * 6 && st.phase !== 'matchEnd'; i++) {
        L.step(st, DT, [M.AI.think(a0, st, 0, DT), M.AI.think(a1, st, 1, DT)]);
        for (const f of st.p) if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || f.hp < 0) ok = false;
      }
      if (st.phase === 'matchEnd') ended = true; else ok = false;
    }
  } catch (e) { ok = false; console.log(e); }
  check('크레이지 AI끼리 세 경기를 예외 없이 끝낸다', ok && ended);
}

console.log(fail === 0 ? '\n모든 시뮬레이션 테스트 통과' : `\n실패 ${fail}건`);
process.exit(fail ? 1 : 0);
