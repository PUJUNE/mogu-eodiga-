// logic.js — 육성(하루 시간 · 수련 · 알바 · 상점 · 타로 · 침공 · 되감기) + 마을 이동 충돌 + 실시간 전투
// DOM·THREE 없음 — node 테스트와 밸런스 봇이 같은 코드를 돈다
const M = window.MHR;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const weaponOf = (id) => M.WEAPONS.find((w) => w.id === id);
const armorOf = (id) => M.ARMORS.find((a) => a.id === id);

// ════════════════════ 육성 ════════════════════
const G = {
  create(diff = 'normal', seed = 1) {
    const g = {
      v: 1, diff, seed: seed >>> 0 || 1, n: 0,
      day: 1, hour: M.DAY_START, gold: 60, lv: 1, exp: 0,
      atk: M.BASE.atk, agi: M.BASE.agi, mag: M.BASE.mag,
      trains: { atk: 0, agi: 0, mag: 0 },
      weapon: 'stick', armor: 'fur', owned: { stick: 1, fur: 1 }, potions: 1,
      cleared: {}, tarot: null, invaded: {}, finalDay: M.LAST_DAY, finalBeaten: false,
      stats: { kills: 0, works: 0, trains: 0, rollbacks: 0, faints: 0, dungeons: 0 },
      snap: null,
    };
    g.snap = G.snapshot(g);
    return g;
  },
  rng(g) { g.n++; return M.makeRng((g.seed * 2654435761 + g.n * 40503 + g.day * 977) >>> 0); },
  snapshot(g) { const c = Object.assign({}, g); delete c.snap; return JSON.stringify(c); },

  weapon: (g) => weaponOf(g.weapon),
  armor: (g) => armorOf(g.armor),
  card(g) { return g.tarot && g.tarot.day === g.day ? g.tarot.id : null; },
  hero(g) {
    const w = weaponOf(g.weapon), a = armorOf(g.armor), c = G.card(g);
    return {
      maxHp: M.BASE.hp + (g.lv - 1) * M.LV_HP + a.hp + Math.round(g.atk * 0.8),
      wpn: w.atk, atk: g.atk, agi: g.agi, mag: g.mag, def: a.def,
      dmgMul: c === 'str' ? 1.15 : 1,
      crit: Math.min(0.45, 0.03 + g.agi * 0.005),
      spd: M.HERO_SPD * (1 + Math.min(0.4, g.agi * 0.004)),
      dashCd: Math.max(0.55, M.DASH.cd * (1 - g.agi * 0.005)),
      skillCd: Math.max(3, M.SKILL.cd * (1 - g.mag * 0.005)),
    };
  },
  hitDmg: (h) => (h.wpn + h.atk * 1.6) * h.dmgMul,
  skillDmg: (h) => (30 + h.mag * 5.2 + h.wpn * 0.5) * h.dmgMul,

  hoursLeft: (g) => M.DAY_END - g.hour,
  canSpend(g, h) { return g.hour + h <= M.DAY_END; },
  spend(g, h) { g.hour += h; },

  addExp(g, n) {
    const ups = [];
    g.exp += Math.round(n);
    while (g.exp >= M.expNeed(g.lv)) { g.exp -= M.expNeed(g.lv); g.lv++; g.atk++; g.agi++; g.mag++; ups.push(g.lv); }
    return ups;
  },
  goldMul(g) { const c = G.card(g); return M.DIFFS[g.diff].gold * (c === 'sun' ? 1.3 : c === 'tower' ? 1.6 : 1); },

  // ── 냥냥 도장 ──
  train(g, k) {
    const T = M.TRAINS[k];
    if (!T) return { ok: false, msg: '없는 수련' };
    const cost = M.trainCost(g.trains[k]);
    if (!G.canSpend(g, M.COST.train)) return { ok: false, msg: '오늘은 너무 늦었어요. 집에 가서 자요.' };
    if (g.gold < cost) return { ok: false, msg: `수련비 ${cost}G가 모자라요` };
    const r = G.rng(g);
    const great = r.chance(G.card(g) === 'moon' ? 0.55 : M.TRAIN_GREAT_P);
    const gain = great ? M.TRAIN_GREAT : M.TRAIN_GAIN;
    g.gold -= cost; g[T.stat] += gain; g.trains[k]++; G.spend(g, M.COST.train); g.stats.trains++;
    return { ok: true, great, gain, stat: T.stat, cost };
  },

  // ── 생선가게 알바 ──
  work(g) {
    if (!G.canSpend(g, M.COST.work)) return { ok: false, msg: '가게 문 닫을 시간이에요. 내일 와요.' };
    const r = G.rng(g);
    const customers = 6 + r.int(0, 4) + Math.floor(g.agi / 12);
    const tip = r.chance(0.12 + g.agi * 0.003);
    const pay = Math.round(M.workPay(g.day, g.agi) * (tip ? 1.5 : 1) * G.goldMul(g));
    g.gold += pay; G.spend(g, M.COST.work); g.stats.works++;
    return { ok: true, pay, customers, tip };
  },

  // ── 잡화점 ──
  canUse(g, item) { return !item.req || g[item.req[0]] >= item.req[1]; },
  buy(g, id) {
    if (id === 'potion') {
      if (g.potions >= M.POTION.max) return { ok: false, msg: `츄르 회복약은 ${M.POTION.max}개까지` };
      if (g.gold < M.POTION.price) return { ok: false, msg: '금화가 모자라요' };
      g.gold -= M.POTION.price; g.potions++; return { ok: true };
    }
    const item = weaponOf(id) || armorOf(id);
    if (!item) return { ok: false, msg: '없는 물건' };
    if (g.owned[id]) { return G.equip(g, id); }
    if (g.gold < item.price) return { ok: false, msg: '금화가 모자라요' };
    if (!G.canUse(g, item)) return { ok: false, msg: `${STAT_NAME[item.req[0]]} ${item.req[1]} 이상이어야 들 수 있어요` };
    g.gold -= item.price; g.owned[id] = 1; G.equip(g, id);
    return { ok: true, bought: true };
  },
  equip(g, id) {
    if (!g.owned[id]) return { ok: false, msg: '아직 없어요' };
    if (weaponOf(id)) { if (!G.canUse(g, weaponOf(id))) return { ok: false, msg: '능력치가 모자라요' }; g.weapon = id; }
    else g.armor = id;
    return { ok: true, equipped: true };
  },

  // ── 키위 점집 (하루 한 장, 시간 안 듦) ──
  drawTarot(g) {
    if (G.card(g)) return { ok: false, msg: '오늘 카드는 이미 뽑았어요', id: G.card(g) };
    const id = G.rng(g).pick(M.TAROT).id;
    g.tarot = { day: g.day, id };
    return { ok: true, id };
  },

  // ── 던전 ──
  dungeonOpen(g, i) { return i === 0 || !!g.cleared[M.DUNGEONS[i - 1].id]; },
  dungeonSpec(g, i) {
    const D = M.DUNGEONS[i];
    return { kind: 'dungeon', idx: i, id: D.id, name: D.name, t: D.t, mob: D.mob, kills: D.kills, boss: D.boss, bossFace: D.bossFace,
      ground: D.ground, prop: D.prop, time: M.DUNGEON_TIME };
  },
  enterDungeon(g, i) {
    if (!G.dungeonOpen(g, i)) return { ok: false, msg: '앞 던전을 먼저 깨야 열려요' };
    if (!G.canSpend(g, M.COST.dungeon)) return { ok: false, msg: '던전에 들어가기엔 늦었어요' };
    G.spend(g, M.COST.dungeon); g.stats.dungeons++;
    return { ok: true, spec: G.dungeonSpec(g, i) };
  },

  // ── 침공 ──
  invasionToday(g) {
    if (g.day === g.finalDay && !g.finalBeaten) return Object.assign({ key: 30 }, M.INVASIONS[30]);
    const I = M.INVASIONS[g.day];
    if (I && !I.final && !g.invaded[g.day]) return Object.assign({ key: g.day }, I);
    return null;
  },
  invasionDue(g) { return g.hour >= M.INVASION_HOUR ? G.invasionToday(g) : null; },
  invasionSpec(g, I) {
    return { kind: 'invasion', key: I.key, final: !!I.final, name: I.name, t: I.t, mob: I.mob, kills: I.kills, boss: I.boss, bossFace: I.bossFace,
      ground: 0x7ab86a, prop: 0x4a8a3a, time: 180 };
  },

  // ── 전투 결과 반영 ──
  finishBattle(g, b) {
    const S = b.spec, won = b.phase === 'win';
    const expMul = G.card(g) === 'star' ? 1.4 : 1;
    const out = { won, exp: Math.round(b.exp * expMul), gold: 0, ups: [], kind: S.kind };
    g.stats.kills += b.killed;
    if (won) {
      const base = S.kind === 'dungeon' ? M.dungeonGold(S.t) : Math.round(M.dungeonGold(S.t) * 1.6);
      out.gold = Math.round((base + b.gold) * G.goldMul(g));
      g.gold += out.gold;
      if (S.kind === 'dungeon') { g.cleared[S.id] = (g.cleared[S.id] || 0) + 1; out.first = g.cleared[S.id] === 1; }
      else if (S.final) g.finalBeaten = true;
      else g.invaded[S.key] = true;
    } else if (S.kind === 'dungeon') g.stats.faints++;
    g.potions = b.hero.potions;
    out.ups = G.addExp(g, out.exp);
    return out;
  },
  // 침공에서 졌을 때 — 되감기(그날 아침) 또는 물러서기(금화를 뺏기고 넘어감 · 마지막은 7일 연기)
  rollback(g) {
    const keep = g.stats.rollbacks + 1;
    const s = JSON.parse(g.snap);
    for (const k of Object.keys(g)) if (k !== 'snap') delete g[k];
    Object.assign(g, s);
    g.stats.rollbacks = keep;
    return { ok: true };
  },
  concede(g, I) {
    if (I.final) { g.finalDay += 7; return { ok: true, delay: 7 }; }
    const lost = Math.round(g.gold * 0.3);
    g.gold -= lost; g.invaded[I.key] = 'lost';
    return { ok: true, lost };
  },

  // ── 잠자기 → 다음 날 (침공 날이면 먼저 쳐들어온다) ──
  sleep(g) {
    const I = G.invasionToday(g);
    if (I) { g.hour = Math.max(g.hour, M.INVASION_HOUR); return { ok: false, invasion: I }; }
    g.day++; g.hour = M.DAY_START;
    g.snap = G.snapshot(g);
    return { ok: true, day: g.day };
  },
  rank(g) {
    const d = g.day, r = g.stats.rollbacks;
    if (d <= 26 && r === 0) return 'S';
    if (d <= 30 && r <= 1) return 'A';
    if (d <= 37) return 'B';
    return 'C';
  },
};
const STAT_NAME = { atk: '힘', agi: '민첩', mag: '냥력' };
M.STAT_NAME = STAT_NAME;
M.Game = G;

// ════════════════════ 마을 이동 (섬 경계 · 건물 충돌) ════════════════════
M.Village = {
  push(x, y, r = M.HERO_R) {
    const L = M.ISLAND - 0.6;
    x = clamp(x, -L, L); y = clamp(y, -L, L);
    for (const B of Object.values(M.BUILDINGS)) {
      const hw = B.w / 2 + r, hd = B.d / 2 + r;
      const dx = x - B.x, dy = y - B.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hd) {
        const ox = hw - Math.abs(dx), oy = hd - Math.abs(dy);
        if (ox < oy) x = B.x + Math.sign(dx || 1) * hw; else y = B.y + Math.sign(dy || 1) * hd;
      }
    }
    return [x, y];
  },
  nearDoor(x, y, d = 1.5) {
    let best = null, bd = d;
    for (const [k, B] of Object.entries(M.BUILDINGS)) {
      const dd = Math.hypot(x - B.door[0], y - B.door[1]);
      if (dd < bd) { bd = dd; best = k; }
    }
    return best;
  },
};

// ════════════════════ 실시간 전투 ════════════════════
let uid = 1;
const B = {
  create(g, spec, seed = 1) {
    const h = G.hero(g), D = M.DIFFS[g.diff];
    const tower = G.card(g) === 'tower' ? 1.15 : 1;
    const b = {
      spec, g: null, rng: M.makeRng(seed >>> 0 || 1), t: 0, timeLeft: spec.time, phase: 'fight',
      killed: 0, spawned: 0, bossSpawned: false, boss: null, exp: 0, gold: 0, slams: [],
      mobHp: Math.round(M.mobHp(spec.t) * D.hp * tower), mobAtk: Math.round(M.mobAtk(spec.t) * D.atk * tower),
      hs: h,
      hero: { x: 0, y: 3.5, fx: 0, fy: -1, vx: 0, vy: 0, hp: h.maxHp, maxHp: h.maxHp, dashCd: 0, skillCd: 0, dash: null, act: null,
        combo: 0, comboT: 0, buf: 0, iframe: 0, hurtT: 0, moveTo: null, potions: g.potions, hits: 0, crits: 0, taken: 0 },
      mobs: [],
    };
    return b;
  },

  spawn(b, boss = false) {
    const S = b.spec, T = M.MOBS[S.mob], r = b.rng, hr = b.hero;
    let x, y, tries = 0;
    do {
      const side = r.int(0, 3), u = r.range(-M.ARENA + 1, M.ARENA - 1), e = M.ARENA - 0.8;
      [x, y] = side === 0 ? [u, -e] : side === 1 ? [u, e] : side === 2 ? [-e, u] : [e, u];
    } while (Math.hypot(x - hr.x, y - hr.y) < 6 && ++tries < 12);
    if (boss) { x = 0; y = -M.ARENA + 3; }
    const m = {
      id: uid++, type: S.mob, boss, x, y, vx: 0, vy: 0, fx: 0, fy: 1,
      hp: b.mobHp * (boss ? M.BOSS_HP : 1), maxHp: b.mobHp * (boss ? M.BOSS_HP : 1),
      atk: b.mobAtk * (boss ? M.BOSS_ATK : 1),
      spd: T.spd * (boss ? 0.85 : r.range(0.9, 1.1)), range: T.range * (boss ? 1.6 : 1), size: T.size * (boss ? 2.1 : 1),
      state: 'chase', st: boss ? 1.2 : 0.6 + r.range(0, 0.4), stun: 0, flash: 0, slamCd: 3,
      name: boss ? S.boss : T.name, face: boss ? S.bossFace : T.face,
    };
    b.mobs.push(m);
    if (boss) { b.bossSpawned = true; b.boss = m; } else b.spawned++;
    return m;
  },

  damageMob(b, m, dmg, crit, kx, ky, evs) {
    dmg = Math.max(1, Math.round(dmg));
    m.hp -= dmg; m.flash = 0.12;
    evs.push({ type: 'hit', id: m.id, x: m.x, y: m.y, dmg, crit });
    if (kx || ky) { m.vx += kx; m.vy += ky; if (!m.boss) { m.stun = Math.max(m.stun, 0.35); m.state = 'chase'; } }
    if (m.hp <= 0) {
      m.dead = true;
      b.exp += M.mobExp(b.spec.t) * (m.boss ? 8 : 1);
      b.gold += Math.round(M.dungeonGold(b.spec.t) * (m.boss ? 0 : 0.06));
      if (!m.boss) b.killed++;
      evs.push({ type: 'kill', id: m.id, x: m.x, y: m.y, boss: m.boss });
      if (m.boss) { b.phase = 'win'; evs.push({ type: 'win' }); }
    }
  },

  hurtHero(b, dmg, evs) {
    const h = b.hero;
    if (h.iframe > 0 || b.phase !== 'fight') return;
    dmg = Math.max(1, Math.round(dmg * 100 / (100 + b.hs.def)));
    h.hp -= dmg; h.taken += dmg; h.hurtT = 0.25; h.iframe = 0.35;
    evs.push({ type: 'hurt', dmg, x: h.x, y: h.y });
    if (h.hp <= 0) { h.hp = 0; b.phase = 'lose'; evs.push({ type: 'lose' }); }
  },

  nearest(b, x, y, maxD = 99) {
    let best = null, bd = maxD;
    for (const m of b.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - x, m.y - y) - m.size * 0.5; if (d < bd) { bd = d; best = m; } }
    return best;
  },

  retreat(b) { if (b.phase === 'fight') b.phase = 'retreat'; },

  // inp: { mx, my, moveTo:{x,y}, attack, dash, skill, potion }
  step(b, dt, inp = {}) {
    const evs = [];
    if (b.phase !== 'fight') return evs;
    const h = b.hero, hs = b.hs, S = b.spec;
    b.t += dt; b.timeLeft -= dt;
    if (b.timeLeft <= 0) { b.timeLeft = 0; b.phase = 'timeout'; evs.push({ type: 'timeout' }); return evs; }

    // ── 스폰 ──
    const alive = b.mobs.filter((m) => !m.dead && !m.boss).length;
    if (b.killed < S.kills && alive < M.MAX_ALIVE && b.spawned < S.kills && b.t > 0.5) { B.spawn(b); evs.push({ type: 'spawn' }); }
    if (b.killed >= S.kills && !b.bossSpawned) { const m = B.spawn(b, true); evs.push({ type: 'boss', name: m.name }); }

    // ── 타이머 ──
    h.dashCd = Math.max(0, h.dashCd - dt); h.skillCd = Math.max(0, h.skillCd - dt);
    h.iframe = Math.max(0, h.iframe - dt); h.hurtT = Math.max(0, h.hurtT - dt);
    h.comboT = Math.max(0, h.comboT - dt); h.buf = Math.max(0, h.buf - dt);
    if (h.comboT <= 0 && !h.act) h.combo = 0;

    // ── 입력 ──
    let mx = inp.mx || 0, my = inp.my || 0;
    if (inp.moveTo) h.moveTo = { x: inp.moveTo.x, y: inp.moveTo.y };
    if (mx || my) h.moveTo = null;
    if (!mx && !my && h.moveTo) {
      const dx = h.moveTo.x - h.x, dy = h.moveTo.y - h.y, d = Math.hypot(dx, dy);
      if (d < 0.15) h.moveTo = null; else { mx = dx / d; my = dy / d; }
    }
    const mm = Math.hypot(mx, my);
    if (mm > 1) { mx /= mm; my /= mm; }
    if (inp.attack) h.buf = 0.28;
    if (inp.potion && h.potions > 0 && h.hp < h.maxHp) {
      h.potions--; const heal = Math.round(h.maxHp * M.POTION.heal); h.hp = Math.min(h.maxHp, h.hp + heal);
      evs.push({ type: 'potion', heal });
    }
    if (inp.dash && h.dashCd <= 0 && !h.dash) {
      let dx = mx, dy = my;
      if (!dx && !dy) { dx = h.fx; dy = h.fy; }
      const d = Math.hypot(dx, dy) || 1;
      h.dash = { t: 0, dx: dx / d, dy: dy / d }; h.act = null; h.dashCd = hs.dashCd; h.iframe = Math.max(h.iframe, M.DASH.iframe);
      h.moveTo = null;
      evs.push({ type: 'dash' });
    }
    if (inp.skill && h.skillCd <= 0 && !h.dash && !(h.act && h.act.kind === 'skill')) {
      h.act = { kind: 'skill', t: 0, done: false }; h.skillCd = hs.skillCd; evs.push({ type: 'skill-start' });
    }
    if (h.buf > 0 && !h.act && !h.dash) {
      const i = h.comboT > 0 ? h.combo % 3 : 0;
      h.act = { kind: 'atk', i, t: 0, done: false }; h.buf = 0;
      const tgt = B.nearest(b, h.x, h.y, 3.2);
      if (tgt) { const dx = tgt.x - h.x, dy = tgt.y - h.y, d = Math.hypot(dx, dy) || 1; h.fx = dx / d; h.fy = dy / d; }
      evs.push({ type: 'swing', i });
    }

    // ── 이동 ──
    if (h.dash) {
      h.dash.t += dt;
      h.vx = h.dash.dx * M.DASH.spd; h.vy = h.dash.dy * M.DASH.spd;
      if (h.dash.t >= M.DASH.t) h.dash = null;
    } else {
      const slow = h.act ? (h.act.kind === 'skill' ? 0.2 : 0.3) : 1;
      h.vx = mx * hs.spd * slow; h.vy = my * hs.spd * slow;
      if ((mx || my) && !h.act) { h.fx = mx / (Math.hypot(mx, my) || 1); h.fy = my / (Math.hypot(mx, my) || 1); }
    }
    h.x = clamp(h.x + h.vx * dt, -M.ARENA, M.ARENA); h.y = clamp(h.y + h.vy * dt, -M.ARENA, M.ARENA);

    // ── 공격 판정 ──
    if (h.act) {
      const a = h.act; a.t += dt;
      if (a.kind === 'atk') {
        const C = M.COMBO[a.i];
        if (!a.done && a.t >= C.t * 0.4) {
          a.done = true;
          let any = false;
          for (const m of b.mobs) {
            if (m.dead) continue;
            const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy);
            if (d - m.size * 0.45 > M.ATK_RANGE) continue;
            const ang = Math.acos(clamp((dx * h.fx + dy * h.fy) / (d || 1), -1, 1));
            if (d > 0.6 && ang > M.ATK_ARC) continue;
            const crit = b.rng.chance(hs.crit);
            const dmg = G.hitDmg(hs) * C.mult * (crit ? 1.8 : 1) * b.rng.range(0.92, 1.08);
            const k = C.knock ? C.knock * (m.boss ? 0.25 : 1) : 0.4;
            B.damageMob(b, m, dmg, crit, (dx / (d || 1)) * k * 3, (dy / (d || 1)) * k * 3, evs);
            h.hits++; if (crit) h.crits++; any = true;
          }
          if (any && a.i === 2) evs.push({ type: 'heavy' });
        }
        if (a.t >= C.t) { h.act = null; h.combo = a.i + 1 >= 3 ? 0 : a.i + 1; h.comboT = a.i + 1 >= 3 ? 0 : M.COMBO_WINDOW; }
      } else if (a.kind === 'skill') {
        if (!a.done && a.t >= 0.2) {
          a.done = true;
          evs.push({ type: 'skill', x: h.x, y: h.y });
          for (const m of b.mobs) {
            if (m.dead) continue;
            const dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy);
            if (d - m.size * 0.45 > M.SKILL.r) continue;
            const k = m.boss ? 1.5 : 6;
            B.damageMob(b, m, G.skillDmg(hs) * b.rng.range(0.92, 1.08), false, (dx / (d || 1)) * k, (dy / (d || 1)) * k, evs);
          }
        }
        if (a.t >= M.SKILL.t) h.act = null;
      }
    }

    // ── 몬스터 ──
    for (const m of b.mobs) {
      if (m.dead) continue;
      m.flash = Math.max(0, m.flash - dt);
      // 넉백 감쇠
      m.x += m.vx * dt; m.y += m.vy * dt;
      const damp = Math.pow(0.002, dt); m.vx *= damp; m.vy *= damp;
      m.x = clamp(m.x, -M.ARENA, M.ARENA); m.y = clamp(m.y, -M.ARENA, M.ARENA);
      if (m.stun > 0) { m.stun -= dt; continue; }
      const dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 0.001;
      const reach = m.range + M.HERO_R + m.size * 0.3;
      m.st -= dt;
      if (m.state === 'chase') {
        m.fx = dx / d; m.fy = dy / d;
        if (d > reach * 0.85) { m.x += m.fx * m.spd * dt; m.y += m.fy * m.spd * dt; }
        if (d <= reach && m.st <= 0) { m.state = 'windup'; m.st = M.MOB_WINDUP * (m.boss ? 1.3 : 1); evs.push({ type: 'windup', id: m.id }); }
      } else if (m.state === 'windup') {
        if (m.st <= 0) {
          if (d <= reach + 0.45) B.hurtHero(b, m.atk * b.rng.range(0.9, 1.1), evs);
          evs.push({ type: 'strike', id: m.id });
          m.state = 'chase'; m.st = M.MOB_CD * (m.boss ? 0.9 : b.rng.range(0.9, 1.3));
        }
      }
      // 보스 내려찍기 — 주인공 발밑에 빨간 원, 잠시 뒤 터진다
      if (m.boss) {
        m.slamCd -= dt;
        if (m.slamCd <= 0 && d < 9) {
          m.slamCd = M.BOSS_SLAM.cd * b.rng.range(0.85, 1.15);
          b.slams.push({ x: h.x, y: h.y, t: M.BOSS_SLAM.warn, r: M.BOSS_SLAM.r, warn: M.BOSS_SLAM.warn });
          evs.push({ type: 'slam-warn' });
        }
      }
    }
    // 몬스터끼리 겹치지 않게
    const live = b.mobs.filter((m) => !m.dead);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const p = live[i], q = live[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      const min = (p.size + q.size) * 0.5;
      if (d < min) { const o = (min - d) / 2; p.x -= dx / d * o; p.y -= dy / d * o; q.x += dx / d * o; q.y += dy / d * o; }
    }
    for (const s of b.slams) {
      s.t -= dt;
      if (s.t <= 0 && !s.done) {
        s.done = true;
        evs.push({ type: 'slam', x: s.x, y: s.y });
        if (Math.hypot(h.x - s.x, h.y - s.y) < s.r + M.HERO_R * 0.5) B.hurtHero(b, b.boss.atk * 1.6, evs);
      }
    }
    b.slams = b.slams.filter((s) => s.t > -0.35);
    if (b.mobs.length > 30) b.mobs = b.mobs.filter((m) => !m.dead || m === b.boss);
    return evs;
  },
};
M.Battle = B;
