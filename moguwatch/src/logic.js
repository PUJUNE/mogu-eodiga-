// logic.js — 길 · 터 · 공세 · 도둑 이동과 능력 · 냥이 탑과 병사 · 판정 (DOM·THREE 없음, node 에서 그대로 돈다)
const M = window.MWT;
const T = M.TOWER, MON = M.MON;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
M.clamp = clamp;

// ══ 길 — 꺾은선, 길이 d 로 위치를 찾는다 ══
class Path {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  at(d) {
    const P = this.pts, C = this.cum; d = clamp(d, 0, this.len);
    let i = 1; while (i < C.length - 1 && C[i] < d) i++;
    const a = P[i - 1], b = P[i], L = C[i] - C[i - 1] || 1, f = (d - C[i - 1]) / L;
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, dx, dz };
  }
  // 점에서 가장 가까운 길 위 자리
  nearest(x, z) {
    const P = this.pts; let best = { dist: 1e9, d: 0, x: 0, z: 0 };
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
      const f = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / L2, 0, 1), px = a[0] + vx * f, pz = a[1] + vz * f;
      const dist = Math.hypot(x - px, z - pz);
      if (dist < best.dist) best = { dist, d: this.cum[i - 1] + Math.sqrt(L2) * f, x: px, z: pz };
    }
    return best;
  }
}
M.Path = Path;

function pathDist(paths, x, z) { let m = 1e9; for (const p of paths) m = Math.min(m, p.nearest(x, z).dist); return m; }
function waterDist(map, x, z) {   // 물가까지 거리 (물 안이면 음수)
  let m = 1e9;
  for (const w of map.water) {
    if (w.t === 'pond') m = Math.min(m, Math.hypot(x - w.x, z - w.z) - w.r);
    else m = Math.min(m, new Path(w.pts).nearest(x, z).dist - w.w / 2);
  }
  return m;
}
M.pathDist = pathDist; M.waterDist = waterDist;

// 길 위 표본에서 반지름 r 안에 드는 길이 (여러 길이 겹치는 구간은 그만큼 더 센다 — 모든 도둑이 지나는 곳)
function coverage(paths, x, z, r) {
  let c = 0; const r2 = r * r, step = 0.25;
  for (const p of paths) for (let d = 0; d < p.len; d += step) { const q = p.at(d); if (d2(q.x, q.z, x, z) < r2) c += step; }
  return c;
}
M.coverage = coverage;

// ══ 터 고르기 — 길 가까이, 물·랜드마크·곳간을 피해 길을 많이 덮는 자리부터 ══
const PLOT_CACHE = {};
function makePlots(map, paths) {
  if (PLOT_CACHE[map.id]) return PLOT_CACHE[map.id];
  const base = paths[0].pts[paths[0].pts.length - 1], cand = [];
  for (let x = 0.8; x <= M.MAP_W - 0.8; x += 0.5) for (let z = 0.8; z <= M.MAP_H - 0.8; z += 0.5) {
    const pd = pathDist(paths, x, z);
    if (pd < 1.45 || pd > 2.6) continue;
    if (waterDist(map, x, z) < 0.6) continue;
    if (map.marks.some((m) => m.r > 0 && Math.hypot(x - m.x, z - m.z) < m.r + 0.75)) continue;
    if (Math.hypot(x - base[0], z - base[1]) < 2.0) continue;
    if (paths.some((p) => Math.hypot(x - p.pts[0][0], z - p.pts[0][1]) < 2.2)) continue;
    cand.push({ x, z, s: coverage(paths, x, z, 3.6) });
  }
  cand.sort((a, b) => b.s - a.s || a.x - b.x || a.z - b.z);
  const plots = [];
  for (const c of cand) {
    if (plots.length >= map.plots) break;
    if (plots.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 2.15)) continue;
    plots.push({ x: c.x, z: c.z, s: c.s });
  }
  plots.sort((a, b) => a.z - b.z || a.x - b.x);
  plots.forEach((p, i) => {
    p.i = i;
    // 초소 병사가 설 자리 — 가장 가까운 길 위
    let best = null;
    paths.forEach((pa, pi) => { const n = pa.nearest(p.x, p.z); if (!best || n.dist < best.dist - 1e-6) best = Object.assign({ pi }, n); });
    const q = paths[best.pi].at(best.d);
    p.rally = { x: best.x, z: best.z, pi: best.pi, d: best.d, nx: -q.dz, nz: q.dx };
    p.cov = {}; for (const k of M.TOWER_KINDS) p.cov[k] = T[k].range.map((r) => coverage(paths, p.x, p.z, r));
  });
  return (PLOT_CACHE[map.id] = plots);
}
M.makePlots = makePlots;

// ══ 공세 만들기 ══
function waveMenu(G, k) {
  const map = G.map, menu = [];
  for (const ty in M.ROSTER) {
    const R = M.ROSTER[ty], w = map.weights[ty] || 0, un = map.early[ty] !== undefined ? map.early[ty] : R[4];
    if (w > 0 && k >= un) menu.push([ty, w * (k === un && k > 1 ? 2 : 1)]);
  }
  return menu;
}
function buildWave(G, k) {
  const rng = G.rng, lv = G.level, boss = k === M.WAVES, q = [];
  const mi = M.MAPS.indexOf(G.map);
  let budget = (28 + 21 * (k - 1)) * G.D.bud * (1 + 0.05 * mi) * (1 + 0.45 * lv) * (boss ? 0.65 : 1) * (G.paths.length > 1 ? 0.78 : 1), heavy = 0;
  let air = budget * 0.4;
  const hpMul = (1 + 0.11 * (k - 1)) * (1 + 0.05 * mi) * G.D.hp * (1 + 0.35 * lv);
  const menu = waveMenu(G, k), tot = menu.reduce((a, b) => a + b[1], 0), np = G.paths.length;
  let t = 0.5, grp = 0;
  if (boss) q.push({ t: 3, type: G.map.boss, hpMul: G.D.hp * (1 + 0.5 * lv), pi: 0 });
  while (budget > 0) {
    let r = rng.next() * tot, type = 'mouse';
    for (const [ty, w] of menu) { r -= w; if (r <= 0) { type = ty; break; } }
    let R = M.ROSTER[type];
    if (R[0] > budget + 5 || (R[0] >= 28 && heavy >= 1 + lv + (k >= 7 ? 1 : 0)) || (MON[type].fly && air <= 0)) { type = 'mouse'; R = M.ROSTER.mouse; }
    if (R[0] >= 28) heavy++;
    const n = rng.int(R[1], R[2]), pi = grp++ % np;
    for (let i = 0; i < n && budget > 0; i++) {
      q.push({ t, type, hpMul, pi }); t += R[3] * rng.range(0.8, 1.25); budget -= R[0];
      if (MON[type].fly) air -= R[0];
    }
    t += rng.range(1.2, 2.4) * (boss ? 1.4 : 1);
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}
M.buildWave = buildWave;

// ══ 게임 ══
const Game = {};
M.Game = Game;

Game.create = function (opt) {
  const map = typeof opt.map === 'number' ? M.MAPS[opt.map] : M.MAPS.find((m) => m.id === opt.map);
  const D = M.DIFFS[opt.diff || 'normal'];
  const paths = map.paths.map((p) => new Path(p));
  const G = {
    map, D, diff: opt.diff || 'normal', endless: !!opt.endless, rng: M.makeRng(opt.seed || (M.MAPS.indexOf(map) + 1) * 7919),
    paths, plots: makePlots(map, paths), base: paths[0].pts[paths[0].pts.length - 1],
    gold: D.gold, lives: D.lives, maxLives: D.lives, t: 0, wave: 0, level: 0, waveN: 0,
    nextIn: M.WAVE.first, spawning: false, queue: [], waveT: 0,
    towers: [], mons: [], men: [], shots: [], ev: [], phase: 'play',
    kills: 0, leaks: 0, spent: 0, nid: 1, bossAlive: false,
  };
  G.towerAt = new Array(G.plots.length).fill(null);
  return G;
};
const emit = (G, e) => { G.ev.push(e); };

Game.totalWaves = (G) => (G.endless ? Infinity : M.WAVES);
Game.startWave = function (G) {
  G.wave++; G.waveN++;
  const k = ((G.wave - 1) % M.WAVES) + 1;
  if (G.endless && G.wave > 1 && k === 1) G.level++;
  G.k = k; G.queue = buildWave(G, k); G.waveT = 0; G.spawning = true; G.nextIn = -1;
  G.waveIsBoss = k === M.WAVES;
  emit(G, { type: 'wave', n: G.waveN, boss: G.waveIsBoss, bossType: G.waveIsBoss ? G.map.boss : null, fresh: newTypes(G, k) });
};
function newTypes(G, k) {   // 이번 공세에 처음 나오는 도둑
  const seen = G.seen || (G.seen = {}), out = [];
  for (const e of G.queue) if (!seen[e.type]) { seen[e.type] = 1; out.push(e.type); }
  return out;
}
// 다음 공세를 일찍 부른다 — 남은 초만큼 군자금
Game.callWave = function (G) {
  if (G.phase !== 'play' || G.spawning || G.wave >= Game.totalWaves(G)) return false;
  const bonus = G.wave === 0 ? 0 : Math.round(Math.max(0, G.nextIn) * M.WAVE.earlyGold);
  G.gold += bonus; if (bonus) emit(G, { type: 'early', gold: bonus });
  Game.startWave(G); return true;
};

// ── 도둑 ──
function spawnMon(G, type, o = {}) {
  const def = MON[type], pi = o.pi || 0, P = G.paths[pi];
  const hp = Math.round(def.hp * (o.hpMul || 1));
  const m = {
    id: G.nid++, type, def, hp, maxHp: hp, pi, d: o.d !== undefined ? clamp(o.d, 0, P.len - 0.5) : 0,
    ofs: o.ofs !== undefined ? o.ofs : G.rng.range(-0.38, 0.38), x: 0, z: 0, y: def.fly || 0,
    slowT: 0, slowF: 0, blockers: [], atkCd: 0, dead: false, leaked: false, ghost: false, ghostT: def.ghost ? G.rng.range(0, def.ghost[0]) : 0,
    hopCd: def.hop ? def.hop.cd * 0.5 : 0, hopT: 0, sumCd: def.summon ? def.summon.every * 0.6 : 0, kids: 0, parent: o.parent || null,
    empCd: def.emp ? def.emp.every * 0.6 : 0, lastHit: -9, aura: 1, spdNow: def.spd, boss: !!def.boss, dir: 0, walk: G.rng.range(0, 6),
  };
  place(G, m);
  G.mons.push(m);
  if (m.boss) G.bossAlive = true;
  return m;
}
Game.spawnMon = spawnMon;
function place(G, m) {
  const q = G.paths[m.pi].at(m.d);
  m.x = q.x - q.dz * m.ofs; m.z = q.z + q.dx * m.ofs; m.dir = Math.atan2(q.dx, q.dz);
}
const remain = (G, m) => G.paths[m.pi].len - m.d;
Game.remain = remain;

function hurt(G, m, dmg, phys, src) {
  if (m.dead) return;
  if (phys && m.def.armor) dmg *= 1 - m.def.armor;
  m.hp -= dmg; m.lastHit = G.t;
  if (m.hp <= 0) kill(G, m, src);
}
function kill(G, m) {
  m.dead = true; m.hp = 0;
  G.gold += m.def.bounty; G.kills++;
  emit(G, { type: 'kill', mon: m, gold: m.def.bounty, x: m.x, z: m.z, y: m.y });
  for (const s of m.blockers) s.target = null;
  m.blockers.length = 0;
  if (m.parent) m.parent.kids--;
  const sp = m.def.split;
  if (sp) for (let i = 0; i < sp[1]; i++) spawnMon(G, sp[0], { pi: m.pi, d: m.d - 0.3 * i, hpMul: sp[2] * (m.maxHp / m.def.hp), ofs: (i - 1) * 0.3 });
  if (m.def.gas) {
    emit(G, { type: 'gas', x: m.x, z: m.z, r: m.def.gas.r });
    for (const s of G.men) if (!s.dead && d2(s.x, s.z, m.x, m.z) < m.def.gas.r * m.def.gas.r) hurtMan(G, s, m.def.gas.dmg);
  }
  if (m.boss) { G.bossAlive = G.mons.some((o) => o.boss && !o.dead); emit(G, { type: 'bossDown', mon: m }); }
}

function updateMons(G, dt) {
  const mons = G.mons;
  // 응원 북소리 — 주변 도둑 빠르게
  for (const m of mons) m.aura = 1;
  for (const a of mons) if (!a.dead && a.def.aura) {
    const r2 = a.def.aura.r * a.def.aura.r;
    for (const m of mons) if (m !== a && !m.dead && d2(a.x, a.z, m.x, m.z) < r2) m.aura = Math.max(m.aura, a.def.aura.mul);
  }
  for (const m of mons) {
    if (m.dead || m.leaked) continue;
    const def = m.def;
    m.slowT = Math.max(0, m.slowT - dt);
    if (def.ghost) { m.ghostT += dt; const per = def.ghost[0] + def.ghost[1]; if (m.ghostT > per) m.ghostT -= per; m.ghost = m.ghostT > def.ghost[0]; if (m.ghost && m.blockers.length) release(m); }
    if (def.regen && G.t - m.lastHit > 2 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + def.regen * m.maxHp * dt);
    if (def.summon) {
      m.sumCd -= dt;
      if (m.sumCd <= 0) {
        m.sumCd = def.summon.every;
        const n = Math.min(def.summon.n, def.summon.max - m.kids);
        for (let i = 0; i < n; i++) { spawnMon(G, def.summon.type, { pi: m.pi, d: m.d - 0.6 - i * 0.35, hpMul: def.summon.hp * (G.D.hp), parent: m }); m.kids++; }
        if (n > 0) emit(G, { type: 'summon', mon: m });
      }
    }
    if (def.emp) {
      m.empCd -= dt;
      if (m.empCd <= 0) {
        m.empCd = def.emp.every; const r2 = def.emp.r * def.emp.r;
        for (const t of G.towers) if (d2(t.x, t.z, m.x, m.z) < r2) t.stun = def.emp.stun;
        emit(G, { type: 'emp', x: m.x, z: m.z, r: def.emp.r });
      }
    }
    // 개구리 — 막히면 뛰어 넘는다
    if (def.hop) {
      m.hopCd -= dt;
      if (m.hopT > 0) {
        const step = (def.hop.leap / 0.55) * dt; m.d = Math.min(G.paths[m.pi].len, m.d + step); m.hopT -= dt;
        m.y = Math.sin((1 - Math.max(0, m.hopT) / 0.55) * Math.PI) * (m.boss ? 1.6 : 1.0);
        if (m.hopT <= 0) {
          m.y = 0;
          if (def.hop.stomp) { for (const s of G.men) if (!s.dead && d2(s.x, s.z, m.x, m.z) < 1.44) hurtMan(G, s, def.hop.stomp); emit(G, { type: 'stomp', x: m.x, z: m.z }); }
        }
        place(G, m); checkLeak(G, m); continue;
      }
      if (m.blockers.length && m.hopCd <= 0) { release(m); m.hopT = 0.55; m.hopCd = def.hop.cd; emit(G, { type: 'hop', mon: m }); continue; }
      if (def.hop.stomp && m.hopCd <= 0 && !m.blockers.length && G.men.some((s) => !s.dead && d2(s.x, s.z, m.x, m.z) < 6)) { m.hopT = 0.55; m.hopCd = def.hop.cd; emit(G, { type: 'hop', mon: m }); continue; }
    }
    // 빠르기
    let spd = def.spd * m.aura;
    if (m.slowT > 0) spd *= 1 - m.slowF * (1 - (def.slowRes || 0));
    if (def.frenzy) spd *= 1 + def.frenzy * (1 - m.hp / m.maxHp);
    if (def.enrage && m.hp / m.maxHp < def.enrage[0]) spd *= def.enrage[1];
    m.spdNow = spd;
    if (m.blockers.length) {
      // 막혔다 — 맨 앞 병사를 친다
      m.moving = false;
      const s = m.blockers[0];
      m.atkCd -= dt;
      if (m.atkCd <= 0 && def.dmg) { m.atkCd = def.atkT; hurtMan(G, s, def.dmg); emit(G, { type: 'monHit', mon: m, man: s }); }
      m.dir = Math.atan2(s.x - m.x, s.z - m.z);
    } else {
      m.moving = true;
      m.d += spd * dt; m.walk += spd * dt * 5;
      place(G, m);
      checkLeak(G, m);
    }
  }
}
function checkLeak(G, m) {
  if (m.d >= G.paths[m.pi].len - 0.05 && !m.dead) {
    m.leaked = true; m.dead = true; G.lives -= m.def.lives; G.leaks++;
    for (const s of m.blockers) s.target = null; m.blockers.length = 0;
    if (m.parent) m.parent.kids--;
    emit(G, { type: 'leak', mon: m, lives: m.def.lives });
    if (m.boss) G.bossAlive = G.mons.some((o) => o.boss && !o.dead);
  }
}
function release(m) { for (const s of m.blockers) s.target = null; m.blockers.length = 0; }

// ── 냥이 병사 ──
function hurtMan(G, s, dmg) {
  if (s.dead) return;
  s.hp -= dmg; s.hurtT = G.t;
  if (s.hp <= 0) {
    s.dead = true; s.respawn = T.guard.respawn[s.tower.lvl];
    if (s.target) { const i = s.target.blockers.indexOf(s); if (i >= 0) s.target.blockers.splice(i, 1); s.target = null; }
    emit(G, { type: 'manDown', man: s });
  }
}
function postOf(t, slot, n) {   // 초소 병사 서는 자리 — 길 위에 옆으로 나란히
  const r = t.rally, off = (slot - (n - 1) / 2) * 0.55, q = t.path.at(r.d), along = (slot % 2 ? 0.25 : -0.15);
  return { x: r.x - q.dz * off + q.dx * along, z: r.z + q.dx * off + q.dz * along };
}
function syncMen(G, t) {
  const def = T.guard, n = def.n[t.lvl];
  while (t.men.length < n) {
    const p = postOf(t, t.men.length, n);
    const s = { id: G.nid++, tower: t, slot: t.men.length, hp: def.hp[t.lvl], maxHp: def.hp[t.lvl], x: t.x, z: t.z, hx: p.x, hz: p.z, target: null, atkCd: 0, dead: false, respawn: 0, walk: 0, dir: 0, hurtT: -9 };
    t.men.push(s); G.men.push(s);
  }
  t.men.forEach((s, i) => { const p = postOf(t, i, n); s.hx = p.x; s.hz = p.z; s.maxHp = def.hp[t.lvl]; if (!s.dead) s.hp = s.maxHp; });
}
function updateMen(G, dt) {
  const def = T.guard;
  for (const s of G.men) {
    const t = s.tower;
    if (s.dead) {
      s.respawn -= dt;
      if (s.respawn <= 0) { s.dead = false; s.hp = s.maxHp; s.x = t.x; s.z = t.z; emit(G, { type: 'manUp', man: s }); }
      continue;
    }
    const lv = t.lvl, R = def.range[lv];
    if (s.target && (s.target.dead || s.target.ghost || d2(s.target.x, s.target.z, t.rally.x, t.rally.z) > (R + 0.6) * (R + 0.6))) {
      const i = s.target.blockers.indexOf(s); if (i >= 0) s.target.blockers.splice(i, 1); s.target = null;
    }
    if (!s.target) {
      // 막을 도둑 고르기 — 아직 아무도 안 막은 도둑, 그중 곳간에 가장 가까운 도둑
      let best = null, bs = 1e9;
      for (const m of G.mons) {
        if (m.dead || m.def.fly || m.def.slip || m.ghost || m.hopT > 0) continue;
        if (d2(m.x, m.z, t.rally.x, t.rally.z) > R * R) continue;
        const cap = m.boss ? 3 : 1;
        if (m.blockers.length >= cap) continue;
        const sc = remain(G, m) + m.blockers.length * 4;
        if (sc < bs) { bs = sc; best = m; }
      }
      if (best) { s.target = best; best.blockers.push(s); }
    }
    if (s.target) {
      const m = s.target, gx = m.x, gz = m.z;
      const dist = Math.hypot(gx - s.x, gz - s.z), want = m.def.rad + 0.28;
      if (dist > want) { const st = Math.min(dist - want, 2.6 * dt); s.x += (gx - s.x) / dist * st; s.z += (gz - s.z) / dist * st; s.walk += st * 6; }
      s.dir = Math.atan2(gx - s.x, gz - s.z);
      s.atkCd -= dt;
      if (s.atkCd <= 0 && dist < want + 0.25) { s.atkCd = def.rate[lv]; hurt(G, m, def.dmg[lv], true); emit(G, { type: 'manHit', man: s, mon: m }); }
    } else {
      const dist = Math.hypot(s.hx - s.x, s.hz - s.z);
      if (dist > 0.05) { const st = Math.min(dist, 2.2 * dt); s.x += (s.hx - s.x) / dist * st; s.z += (s.hz - s.z) / dist * st; s.walk += st * 6; s.dir = Math.atan2(s.hx - s.x, s.hz - s.z); }
      if (G.t - s.hurtT > 3) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.08 * dt);
    }
  }
}

// ── 탑 ──
function pickTarget(G, t, range, kind) {
  const def = T[kind], r2 = range * range, min2 = def.minRange ? def.minRange * def.minRange : 0;
  let best = null, bs = 1e9;
  for (const m of G.mons) {
    if (m.dead || m.ghost) continue;
    if (m.def.fly ? !def.air : !def.ground) continue;
    const dd = d2(m.x, m.z, t.x, t.z);
    if (dd > r2 || dd < min2) continue;
    const sc = remain(G, m);
    if (sc < bs) { bs = sc; best = m; }
  }
  return best;
}
function updateTowers(G, dt) {
  for (const t of G.towers) {
    t.fireT += dt;
    if (t.stun > 0) { t.stun -= dt; continue; }
    if (t.kind === 'guard') continue;
    t.cd -= dt;
    if (t.cd > 0) continue;
    const def = T[t.kind], lv = t.lvl, m = pickTarget(G, t, def.range[lv], t.kind);
    if (!m) { t.cd = 0.1; continue; }
    t.cd = def.rate[lv]; t.fireT = 0; t.aim = Math.atan2(m.x - t.x, m.z - t.z);
    if (t.kind === 'yarn') {
      G.shots.push({ kind: 'yarn', x: t.x, z: t.z, sx: t.x, sz: t.z, sy: t.top, tgt: m, tx: m.x, tz: m.z, ty: m.y + 0.4, dmg: def.dmg[lv], f: 0, dist0: Math.hypot(m.x - t.x, m.z - t.z) + 0.01 });
      emit(G, { type: 'shoot', tower: t });
    } else if (t.kind === 'can') {
      const fl = 0.75 + Math.hypot(m.x - t.x, m.z - t.z) * 0.06;
      // 날아가는 동안 갈 자리를 내다보고 던진다
      const P = G.paths[m.pi], ahead = m.blockers.length ? 0 : m.spdNow * fl, q = P.at(m.d + ahead);
      const tx = q.x - q.dz * m.ofs, tz = q.z + q.dx * m.ofs;
      G.shots.push({ kind: 'can', sx: t.x, sz: t.z, sy: t.top, tx, tz, x: t.x, z: t.z, y: t.top, t: 0, T: fl, dmg: def.dmg[lv], splash: def.splash[lv] });
      emit(G, { type: 'shoot', tower: t });
    } else if (t.kind === 'laser') {
      const hit = [m], pts = [[m.x, m.y + 0.4, m.z]];
      let cur = m, dmg = def.dmg[lv];
      zap(G, m, dmg, def, lv);
      for (let j = 1; j < def.jumps[lv]; j++) {
        let nb = null, nd = def.jumpR * def.jumpR;
        for (const o of G.mons) { if (o.dead || o.ghost || hit.includes(o)) continue; const dd = d2(o.x, o.z, cur.x, cur.z); if (dd < nd) { nd = dd; nb = o; } }
        if (!nb) break;
        hit.push(nb); pts.push([nb.x, nb.y + 0.4, nb.z]); dmg *= 0.85; zap(G, nb, dmg, def, lv); cur = nb;
      }
      emit(G, { type: 'beam', tower: t, pts });
    }
  }
}
function zap(G, m, dmg, def, lv) {
  m.slowT = def.slowT[lv]; m.slowF = Math.max(m.slowT > 0 ? m.slowF : 0, def.slow[lv]);
  hurt(G, m, dmg, false);
}
function updateShots(G, dt) {
  const keep = [];
  for (const s of G.shots) {
    if (s.kind === 'yarn') {
      if (s.tgt && !s.tgt.dead && !s.tgt.ghost) { s.tx = s.tgt.x; s.tz = s.tgt.z; s.ty = s.tgt.y + 0.4; } else s.tgt = null;
      const dx = s.tx - s.x, dz = s.tz - s.z, dist = Math.hypot(dx, dz), st = 11 * dt;
      if (dist <= st + 0.05) {
        if (s.tgt) { hurt(G, s.tgt, s.dmg, true); emit(G, { type: 'hit', kind: 'yarn', x: s.tx, z: s.tz, y: s.ty }); }
        continue;
      }
      s.x += dx / dist * st; s.z += dz / dist * st;
      s.f = clamp(1 - dist / s.dist0, 0, 1); s.y = s.sy + (s.ty - s.sy) * s.f + Math.sin(s.f * Math.PI) * 0.6;
      keep.push(s);
    } else if (s.kind === 'can') {
      s.t += dt; const f = s.t / s.T;
      if (f >= 1) {
        const r2 = s.splash * s.splash;
        for (const m of G.mons) {
          if (m.dead || m.def.fly || m.ghost || m.hopT > 0) continue;
          const dd = d2(m.x, m.z, s.tx, s.tz);
          if (dd < r2) hurt(G, m, s.dmg * (1 - 0.5 * Math.sqrt(dd) / s.splash), true);
        }
        emit(G, { type: 'boom', x: s.tx, z: s.tz, r: s.splash });
        continue;
      }
      s.x = s.sx + (s.tx - s.sx) * f; s.z = s.sz + (s.tz - s.sz) * f; s.y = s.sy * (1 - f) + Math.sin(f * Math.PI) * (2 + s.T);
      keep.push(s);
    }
  }
  G.shots = keep;
}

// ── 짓기 · 키우기 · 팔기 ──
Game.canBuild = (G, i, kind) => G.phase === 'play' && !G.towerAt[i] && G.gold >= T[kind].cost[0];
Game.build = function (G, i, kind) {
  if (!Game.canBuild(G, i, kind)) return null;
  const p = G.plots[i], def = T[kind];
  G.gold -= def.cost[0]; G.spent += def.cost[0];
  const t = { id: G.nid++, plot: i, kind, lvl: 0, x: p.x, z: p.z, cd: 0.4, stun: 0, spent: def.cost[0], men: [], rally: p.rally, path: G.paths[p.rally.pi], aim: 0, fireT: 9, top: 1.9 };
  G.towers.push(t); G.towerAt[i] = t;
  if (kind === 'guard') syncMen(G, t);
  emit(G, { type: 'build', tower: t });
  return t;
};
Game.upgradeCost = (G, i) => { const t = G.towerAt[i]; return t && t.lvl < 2 ? T[t.kind].cost[t.lvl + 1] : null; };
Game.upgrade = function (G, i) {
  const t = G.towerAt[i], c = Game.upgradeCost(G, i);
  if (G.phase !== 'play' || c === null || G.gold < c) return false;
  G.gold -= c; G.spent += c; t.spent += c; t.lvl++; t.top = 1.9 + t.lvl * 0.35;
  if (t.kind === 'guard') syncMen(G, t);
  emit(G, { type: 'upgrade', tower: t });
  return true;
};
Game.refund = (G, i) => { const t = G.towerAt[i]; return t ? Math.round(t.spent * M.SELL) : 0; };
Game.sell = function (G, i) {
  const t = G.towerAt[i];
  if (!t || G.phase !== 'play') return false;
  const r = Game.refund(G, i); G.gold += r;
  for (const s of t.men) { if (s.target) { const k = s.target.blockers.indexOf(s); if (k >= 0) s.target.blockers.splice(k, 1); } }
  G.men = G.men.filter((s) => s.tower !== t);
  G.towers.splice(G.towers.indexOf(t), 1); G.towerAt[i] = null;
  emit(G, { type: 'sell', tower: t, gold: r });
  return true;
};

// ══ 한 걸음 ══
Game.step = function (G, dt) {
  if (G.phase !== 'play') return;
  G.t += dt;
  // 공세
  if (G.spawning) {
    G.waveT += dt;
    while (G.queue.length && G.queue[0].t <= G.waveT) {
      if (G.mons.length > 110) break;
      const e = G.queue.shift(); spawnMon(G, e.type, { hpMul: e.hpMul, pi: e.pi });
    }
    if (!G.queue.length) {
      G.spawning = false;
      G.gold += M.WAVE.clearGold[0] + M.WAVE.clearGold[1] * G.k;
      G.nextIn = G.wave >= Game.totalWaves(G) ? -1 : (G.waveIsBoss ? M.WAVE.between + 6 : M.WAVE.between);
    }
  } else if (G.nextIn > 0) {
    G.nextIn -= dt;
    if (G.nextIn <= 0) Game.startWave(G);
  }
  updateMons(G, dt);
  updateMen(G, dt);
  updateTowers(G, dt);
  updateShots(G, dt);
  if (G.mons.some((m) => m.dead)) G.mons = G.mons.filter((m) => !m.dead);
  if (G.lives <= 0) { G.lives = 0; G.phase = 'lose'; emit(G, { type: 'lose' }); return; }
  if (!G.endless && G.wave >= M.WAVES && !G.spawning && G.mons.length === 0) { G.phase = 'win'; emit(G, { type: 'win', stars: Game.stars(G) }); }
};

// 별 — 남은 츄르 90% 이상 ★★★ · 50% 이상 ★★ · 지키기만 하면 ★
Game.stars = (G) => (G.phase === 'lose' && !G.endless ? 0 : G.lives >= G.maxLives * 0.9 ? 3 : G.lives >= G.maxLives * 0.5 ? 2 : 1);
Game.remainingEnemies = (G) => G.queue.length + G.mons.length;
