// sim-test.mjs — 모구워치 로직 검증 (DOM·THREE 없이)
// 사용: node moguwatch/test/sim-test.mjs
import { M } from './shim.mjs';
import { play } from './tune.mjs';

const G0 = M.Game, T = M.TOWER, DT = M.STEP;
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const run = (G, sec, f) => { for (let i = 0; i < sec / DT; i++) { if (f) f(G); G0.step(G, DT); G.ev.length = 0; if (G.phase !== 'play') break; } };
const fresh = (map = 0, diff = 'normal', o = {}) => G0.create(Object.assign({ map, diff }, o));
// 시험용 빈 판 — 공세가 저절로 오지 않게
const quiet = (map = 0) => { const G = fresh(map); G.nextIn = 1e9; return G; };

// ── 지역 · 길 · 터 ──
check('지역 여섯', M.MAPS.length === 6 && M.MAPS.map((m) => m.name).join() === '서울숲,성남,수원,원주,안양,신촌');
for (const map of M.MAPS) {
  const G = fresh(map.id);
  const okPlots = G.plots.length >= 13 && G.plots.every((p) => M.pathDist(G.paths, p.x, p.z) >= 1.45 && M.waterDist(map, p.x, p.z) >= 0.6);
  const apart = G.plots.every((p) => G.plots.every((q) => p === q || Math.hypot(p.x - q.x, p.z - q.z) >= 2.1));
  const inMap = G.plots.every((p) => p.x > 0 && p.x < M.MAP_W && p.z > 0 && p.z < M.MAP_H);
  const ends = G.paths.every((P) => { const e = P.pts[P.pts.length - 1]; return e[0] === G.base[0] && e[1] === G.base[1]; });
  check(`${map.name}: 터 ${G.plots.length}개 · 길·물에서 떨어짐 · 서로 떨어짐 · 맵 안 · 모든 길이 곳간으로`, okPlots && apart && inMap && ends);
}
{
  const G = fresh(1);
  check('성남·신촌은 길이 둘, 나머지는 하나', fresh(1).paths.length === 2 && fresh(5).paths.length === 2 && [0, 2, 3, 4].every((i) => fresh(i).paths.length === 1));
  const P = G.paths[0], q = P.at(P.len / 2), n = P.nearest(q.x + 0.3, q.z);
  check('길: 중간 자리 찾기 · 가장 가까운 자리', Math.abs(n.d - P.len / 2) < 0.5 && n.dist <= 0.31);
  check('같은 지역 · 같은 시드는 같은 공세', JSON.stringify(M.buildWave(fresh(2), 5)) === JSON.stringify(M.buildWave(fresh(2), 5)));
  const w8 = M.buildWave(fresh(0), 8);
  check('여덟째 공세엔 우두머리', w8.some((e) => e.type === 'bRaccoon') && fresh(5).map.boss === 'bCheer');
  check('첫 공세는 생쥐만', M.buildWave(fresh(0), 1).every((e) => e.type === 'mouse'));
}

// ── 짓기 · 증축 · 철거 ──
{
  const G = quiet(), g0 = G.gold;
  const t = G0.build(G, 0, 'yarn');
  check('짓기: 군자금이 빠지고 터에 탑', t && G.gold === g0 - 70 && G.towerAt[0] === t);
  check('같은 터에 또 못 짓는다', !G0.build(G, 0, 'can'));
  G.gold = 1000;
  check('증축 두 번 → 3단계, 더는 못 한다', G0.upgrade(G, 0) && G0.upgrade(G, 0) && t.lvl === 2 && !G0.upgrade(G, 0));
  const g1 = G.gold, ref = G0.refund(G, 0);
  check('철거: 들인 돈의 60% 돌려받기', ref === Math.round((70 + 100 + 150) * 0.6) && G0.sell(G, 0) && G.gold === g1 + ref && !G.towerAt[0]);
  G.gold = 10;
  check('군자금이 모자라면 못 짓는다', !G0.build(G, 1, 'yarn'));
}

// ── 도둑 이동 · 곳간 ──
{
  const G = quiet(), m = G0.spawnMon(G, 'mouse');
  run(G, 2);
  check('생쥐가 길을 따라 걷는다 (초당 1.25)', Math.abs(m.d - 2.5) < 0.1, m.d.toFixed(2));
  const G2 = quiet(); const m2 = G0.spawnMon(G2, 'squirrel'); m2.d = G2.paths[0].len - 0.3;
  run(G2, 0.5);
  check('곳간에 닿으면 츄르를 잃고 사라진다', G2.lives === G2.maxLives - 1 && G2.mons.length === 0 && G2.leaks === 1);
  const G3 = quiet(); const r = G0.spawnMon(G3, 'robot'); r.d = G3.paths[0].len - 0.3; run(G3, 1);
  check('로봇청소기는 츄르 둘', G3.lives === G3.maxLives - 2);
  const G4 = quiet(); G4.lives = 1; const b = G0.spawnMon(G4, 'mouse'); b.d = G4.paths[0].len - 0.2; run(G4, 1);
  check('츄르가 0 이 되면 진다', G4.phase === 'lose');
}

// ── 탑마다 ──
const nearPlot = (G, kind, minCov = 4) => G.plots.find((p) => p.cov[kind][0] >= minCov);
{
  const G = quiet(), p = nearPlot(G, 'yarn'); G.gold = 9999; G0.build(G, p.i, 'yarn');
  const m = G0.spawnMon(G, 'mouse'); m.d = p.rally.d - 2; m.pi = p.rally.pi;
  run(G, 4);
  check('털실 망루가 생쥐를 잡는다 · 현상금', m.dead && G.kills === 1 && G.gold === 9999 - 70 + 6);
  const G2 = quiet(); const p2 = nearPlot(G2, 'yarn'); G2.gold = 9999; G2.nextIn = 1e9; G0.build(G2, p2.i, 'yarn');
  const bird = G0.spawnMon(G2, 'pigeon'); bird.d = p2.rally.d - 2; bird.pi = p2.rally.pi; run(G2, 4);
  check('털실 망루는 나는 비둘기도 맞힌다', bird.dead);
  const G3 = quiet(); const p3 = nearPlot(G3, 'can'); G3.gold = 9999; G0.build(G3, p3.i, 'can');
  const b3 = G0.spawnMon(G3, 'pigeon', { hpMul: 50 }); b3.d = p3.rally.d - 2; b3.pi = p3.rally.pi; run(G3, 3);
  check('캔 포대는 나는 적을 못 맞힌다', b3.hp === b3.maxHp);
  const G4 = quiet(); const p4 = nearPlot(G4, 'can'); G4.gold = 9999; G0.build(G4, p4.i, 'can');
  const grp = [0, 0.3, 0.6].map((o) => { const m4 = G0.spawnMon(G4, 'raccoon', { ofs: 0, d: p4.rally.d - 1.5 + o }); m4.pi = p4.rally.pi; return m4; });
  let booms = 0; for (let i = 0; i < 4 / DT; i++) { G0.step(G4, DT); booms += G4.ev.filter((e) => e.type === 'boom').length; G4.ev.length = 0; }
  check('캔 포대는 한꺼번에 여럿을 친다', booms >= 1 && grp.filter((m4) => m4.hp < m4.maxHp).length >= 2);
  const G5 = quiet(); const p5 = nearPlot(G5, 'laser'); G5.gold = 9999; G0.build(G5, p5.i, 'laser');
  const ch = [0, 0.6, 1.2].map((o) => { const m5 = G0.spawnMon(G5, 'raccoon', { d: p5.rally.d + o }); m5.pi = p5.rally.pi; return m5; });
  run(G5, 0.6);
  check('레이저 등대: 번져서 여럿을 느리게', ch.filter((m5) => m5.slowT > 0 && m5.hp < m5.maxHp).length >= 2);
  const r1 = ch[0], spd = r1.spdNow;
  check('레이저에 맞으면 느려진다', spd < M.MON.raccoon.spd * 0.8, spd.toFixed(2));
  // 갑옷 — 털실은 덜 박히고 레이저는 그대로
  const G6 = quiet(); const a1 = G0.spawnMon(G6, 'raccoon'); const before = a1.hp;
  const yarnDmg = 10; a1.hp = before; { const s = { kind: 'yarn', x: a1.x, z: a1.z, sx: a1.x, sz: a1.z, sy: 1, tgt: a1, tx: a1.x, tz: a1.z, ty: 0.4, dmg: yarnDmg, f: 0, dist0: 1 }; G6.shots.push(s); }
  run(G6, 0.05);
  check('갑옷: 너구리는 털실 피해를 35% 덜 받는다', Math.abs((before - a1.hp) - yarnDmg * 0.65) < 0.01, (before - a1.hp).toFixed(2));
}

// ── 냥냥 초소 · 병사 ──
{
  const G = quiet(), p = nearPlot(G, 'guard', 2); G.gold = 9999; const t = G0.build(G, p.i, 'guard');
  check('초소: 병사 둘이 나온다', t.men.length === 2 && G.men.length === 2);
  run(G, 2);
  const m = G0.spawnMon(G, 'raccoon', { hpMul: 3 }); m.pi = p.rally.pi; m.d = p.rally.d - 2.4;
  run(G, 4);
  check('병사가 도둑을 막아 세운다', m.blockers.length >= 1 && Math.abs(m.d - (p.rally.d - 2.4)) < 3.2 && !m.moving);
  const hp0 = m.hp; run(G, 2);
  check('막힌 도둑을 병사가 친다', m.hp < hp0);
  G0.upgrade(G, p.i);
  check('증축하면 병사 셋', t.men.length === 3);
  const G2 = quiet(); const p2 = nearPlot(G2, 'guard', 2); G2.gold = 9999; G0.build(G2, p2.i, 'guard'); run(G2, 2);
  const w = G0.spawnMon(G2, 'weasel', { hpMul: 20 }); w.pi = p2.rally.pi; w.d = p2.rally.d - 2; run(G2, 3);
  check('족제비는 병사를 빠져나간다', w.blockers.length === 0 && w.d > p2.rally.d);
  const G3 = quiet(); const p3 = nearPlot(G3, 'guard', 2); G3.gold = 9999; G0.build(G3, p3.i, 'guard'); run(G3, 2);
  const f = G0.spawnMon(G3, 'frog', { hpMul: 20 }); f.pi = p3.rally.pi; f.d = p3.rally.d - 2; let hops = 0;
  for (let i = 0; i < 8 / DT; i++) { G0.step(G3, DT); hops += G3.ev.filter((e) => e.type === 'hop').length; G3.ev.length = 0; }
  check('개구리는 막히면 뛰어 넘는다', hops >= 1 && f.d > p3.rally.d);
  const G4 = quiet(); const p4 = nearPlot(G4, 'guard', 2); G4.gold = 9999; const t4 = G0.build(G4, p4.i, 'guard'); run(G4, 2);
  const s0 = t4.men[0]; s0.hp = 5; const br = G0.spawnMon(G4, 'badger', { hpMul: 5 }); br.pi = p4.rally.pi; br.d = p4.rally.d - 1.5;
  let downs = 0, ups = 0; for (let i = 0; i < 14 / DT; i++) { G0.step(G4, DT); for (const e of G4.ev) { if (e.type === 'manDown') downs++; if (e.type === 'manUp') ups++; } G4.ev.length = 0; }
  check('병사가 쓰러지면 잠시 뒤 다시 나온다', downs >= 1 && ups >= 1);
}

// ── 도둑 능력 ──
{
  const G = quiet(); const bx = G0.spawnMon(G, 'boxrat', { d: 5 }); bx.hp = 1;
  G.shots.push({ kind: 'yarn', x: bx.x, z: bx.z, sx: bx.x, sz: bx.z, sy: 1, tgt: bx, tx: bx.x, tz: bx.z, ty: 0.4, dmg: 50, f: 0, dist0: 1 }); run(G, 0.05);
  check('택배 상자 쥐: 부서지면 생쥐 셋', G.mons.filter((m) => m.type === 'mouse').length === 3);
  const G2 = quiet(); const bo = G0.spawnMon(G2, 'boar'); run(G2, 0.1); const v0 = bo.spdNow; bo.hp = bo.maxHp * 0.2; run(G2, 0.1);
  check('멧돼지: 다칠수록 빨라진다', bo.spdNow > v0 * 1.3);
  const G3 = quiet(); const fx = G0.spawnMon(G3, 'fox'); let seen = 0, ghost = 0; for (let i = 0; i < 6 / DT; i++) { G0.step(G3, DT); if (fx.ghost) ghost++; else seen++; }
  check('안개 여우: 흐려졌다 돌아온다', ghost > 30 && seen > 30);
  const G4 = quiet(); const cap = G0.spawnMon(G4, 'captain'); run(G4, 7);
  check('쥐 대장: 생쥐를 불러낸다', G4.mons.filter((m) => m.type === 'mouse').length >= 2);
  const G5 = quiet(); const ch = G0.spawnMon(G5, 'cheer'); const mm = G0.spawnMon(G5, 'mouse', { d: 0.5 }); ch.d = 0.4; run(G5, 0.1);
  check('응원단 쥐: 곁의 도둑이 빨라진다', mm.spdNow > M.MON.mouse.spd * 1.2);
  const G6 = quiet(); const bd = G0.spawnMon(G6, 'badger'); bd.hp = bd.maxHp * 0.5; run(G6, 4);
  check('오소리: 안 맞으면 낫는다', bd.hp > bd.maxHp * 0.55);
  const G7 = quiet(); const p7 = nearPlot(G7, 'guard', 2); G7.gold = 9999; const t7 = G0.build(G7, p7.i, 'guard'); run(G7, 2);
  const sk = G0.spawnMon(G7, 'skunk'); sk.pi = p7.rally.pi; sk.d = p7.rally.d; sk.ofs = 0; run(G7, 0.02); sk.hp = 0.1;
  const hpB = t7.men.map((s) => s.hp).reduce((a, b) => a + b);
  G7.shots.push({ kind: 'yarn', x: sk.x, z: sk.z, sx: sk.x, sz: sk.z, sy: 1, tgt: sk, tx: sk.x, tz: sk.z, ty: 0.4, dmg: 5, f: 0, dist0: 1 });
  for (const s of t7.men) { s.x = sk.x; s.z = sk.z; }
  run(G7, 0.05);
  check('스컹크: 쓰러지며 방귀로 병사를 다치게 한다', t7.men.map((s) => s.hp).reduce((a, b) => a + b) < hpB);
  const G8 = quiet(); const pp = nearPlot(G8, 'yarn'); G8.gold = 9999; const tw = G0.build(G8, pp.i, 'yarn');
  const rb = G0.spawnMon(G8, 'bRobot'); rb.pi = pp.rally.pi; rb.d = pp.rally.d; run(G8, 0.02); rb.empCd = 0; run(G8, 0.05);
  check('판교 청소왕: 흡입으로 주변 탑을 멈춘다', tw.stun > 0);
}

// ── 공세 흐름 ──
{
  const G = fresh(0);
  check('처음엔 공세 준비 (30초)', G.wave === 0 && Math.abs(G.nextIn - 30) < 1e-9);
  G0.callWave(G); G.ev.length = 0;
  check('공세 부르기 → 1공세', G.wave === 1 && G.spawning);
  const g0 = G.gold; run(G, 9);
  check('공세 다 나오면 다음 공세까지 세기 · 마친 군자금', !G.spawning && G.nextIn > 0 && G.wave === 1 && G.gold === g0 + 25 + 6, `gold ${G.gold - g0} next ${G.nextIn.toFixed(1)}`);
  const G2 = fresh(0); G0.callWave(G2); run(G2, 30); G2.ev.length = 0;
  if (!G2.spawning && G2.nextIn > 3) { const g = G2.gold, left = G2.nextIn; G0.callWave(G2); check('일찍 부르면 남은 초 × 2 군자금', G2.gold === g + Math.round(left * 2)); }
  else check('일찍 부르면 남은 초 × 2 군자금', false, 'spawning=' + G2.spawning);
  const G3 = fresh(0, 'normal', { endless: true }); for (let i = 0; i < 9; i++) { G3.spawning = false; G0.startWave(G3); }
  check('끝없는 방어: 여덟 공세 뒤 한 바퀴 더 (단계 +1)', G3.level === 1 && G3.k === 1 && G3.waveN === 9);
}

// ── 별 ──
{
  const G = fresh(0); G.phase = 'win';
  G.lives = 20; const a = G0.stars(G); G.lives = 15; const b = G0.stars(G); G.lives = 3; const c = G0.stars(G);
  check('별: 츄르 90%↑ ★3 · 50%↑ ★2 · 그 밖 ★1', a === 3 && b === 2 && c === 1);
}

// ── 봇이 끝까지 지킨다 ──
const res = {};
for (const diff of ['easy', 'normal', 'hard']) {
  const row = M.MAPS.map((m, i) => { const G = play(i, diff); return G.phase === 'win' ? G0.stars(G) : 0; });
  res[diff] = row;
}
console.log('  봇 별:', JSON.stringify(res));
check('봇: 이지·노말 여섯 동네 모두 지킨다', res.easy.every((s) => s > 0) && res.normal.every((s) => s > 0));
check('봇: 하드는 넷 이상 지킨다', res.hard.filter((s) => s > 0).length >= 4);
{
  const G = play(0, 'normal', { endless: 10 });
  check('봇: 끝없는 방어 10공세 넘김', G.waveN > 10 || G.phase === 'play', 'wave ' + G.waveN);
}

console.log(fails.length ? `\n${fails.length}개 실패: ${fails.join(', ')}` : '\n모두 통과');
process.exit(fails.length ? 1 : 0);
