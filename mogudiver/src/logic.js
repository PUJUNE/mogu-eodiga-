// logic.js — 잠수·발톱 사냥·물어 나르기·산소·보스 (DOM 무의존)
const M = window.MDV;

const ACC = 300, DRAG = 2.6;
const CLAW_CD = 0.38, CLAW_X0 = 2, CLAW_X1 = 30, CLAW_Y = 18;
const GRAB_R = 18, DEPOSIT_R = 55;
const O2MAX = 100;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

M.Logic = {
  O2MAX,

  create(no) {
    const stage = M.makeStage(no);
    const st = {
      stage, no: stage.no, phase: 'play', t: 0, clearT: 0,
      rng: M.makeRng(stage.no * 4271 + 77),
      p: { x: M.BOAT_X, y: M.SURF + 8, vx: 0, vy: 0, face: 1, o2: O2MAX,
           carry: null, clawCd: 0, clawT: 0, dashCd: 0, iv: 0 },
      fish: [], shots: [], boss: null,
      delivered: 0, score: 0, deaths: 0, stars: 0,
      spawnT: 0, bossIntroT: -1, bossSpawned: false, o2warned: false,
    };
    for (let i = 0; i < 8 + stage.no; i++) this._spawnFish(st, true);
    for (let i = 0; i < stage.jellyN; i++) this._spawnJelly(st);
    return st;
  },

  _spawnFish(st, init) {
    const type = st.rng.pick(st.stage.pool);
    const F = M.FISH[type];
    st.fish.push({
      type, hp: F.hp, dir: st.rng.chance(0.5) ? 1 : -1,
      x: init ? st.rng.range(180, M.WORLD_W - 40) : (st.rng.chance(0.5) ? -16 : M.WORLD_W + 16),
      y: st.rng.range(M.SURF + 55, st.stage.depth - 45),
      vx: 0, vy: 0, wob: st.rng.range(0, 6.28), flipT: st.rng.range(1.5, 4),
      fleeT: 0, iv: 0, dead: false, deadT: 0, gone: false,
    });
  },

  _spawnJelly(st) {
    st.fish.push({
      type: 'jelly', hp: 1, dir: st.rng.chance(0.5) ? 1 : -1,
      x: st.rng.range(200, M.WORLD_W - 60),
      y: st.rng.range(M.SURF + 90, st.stage.depth - 60),
      vx: 0, vy: 0, wob: st.rng.range(0, 6.28), flipT: st.rng.range(2, 5),
      fleeT: 0, iv: 0, dead: false, deadT: 0, gone: false,
    });
  },

  _spawnBoss(st) {
    const B = st.stage.boss;
    st.boss = {
      x: M.WORLD_W / 2, y: st.stage.depth - 90, vx: 0, vy: 0, face: -1,
      hp: B.hp, maxHp: B.hp, w: B.w, spd: B.spd, dmg: B.dmg, base: B.base, kind: B.kind,
      state: 'wander', stT: 0, atkCd: 2.4, aimX: 0, aimY: 0, alt: false,
      dead: false, deadT: 0,
    };
    st.bossSpawned = true;
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;
    const p = st.p, S = st.stage, D = S.depth;

    // ── 플레이어 유영 ──
    p.clawCd -= dt; p.dashCd -= dt; p.clawT -= dt;
    if (p.iv > 0) p.iv -= dt;
    let ax = 0, ay = 0;
    if (input.left) { ax = -1; p.face = -1; }
    if (input.right) { ax = 1; p.face = 1; }
    if (input.up) ay = -1;
    if (input.down) ay = 1;
    const wmul = p.carry ? p.carry.weight : 1;
    p.vx += ax * ACC * wmul * dt;
    p.vy += ay * ACC * wmul * dt;
    if (input.dash && p.dashCd <= 0) {
      p.dashCd = 1.4;
      p.vx += p.face * 230 * wmul;
      p.vy += ay * 120 * wmul;
      p.o2 = Math.max(0, p.o2 - 3);
      ev.push({ type: 'dash', x: p.x, y: p.y });
    }
    const dr = Math.exp(-DRAG * dt);
    p.vx *= dr; p.vy *= dr;
    p.x = clamp(p.x + p.vx * dt, 12, M.WORLD_W - 12);
    p.y += p.vy * dt;
    if (p.y < M.SURF) { p.y = M.SURF; if (p.vy < 0) p.vy = 0; }
    if (p.y > D - 12) { p.y = D - 12; if (p.vy > 0) p.vy = 0; }

    // ── 산소 ──
    if (p.y <= M.SURF + 4) {
      const before = p.o2;
      p.o2 = Math.min(O2MAX, p.o2 + 45 * dt);
      if (before < O2MAX && p.o2 >= O2MAX) { ev.push({ type: 'o2full' }); st.o2warned = false; }
    } else {
      p.o2 -= (1.1 + 0.9 * (p.y / D)) * dt;
    }
    if (p.o2 <= 25 && p.o2 > 0 && !st.o2warned) { st.o2warned = true; ev.push({ type: 'o2low' }); }

    // ── 발톱 ──
    if (input.atk && p.clawCd <= 0) {
      p.clawCd = CLAW_CD; p.clawT = 0.16;
      ev.push({ type: 'swing', x: p.x, y: p.y, face: p.face });
      const inArc = (t, big) => {
        const dx = (t.x - p.x) * p.face, dy = t.y - p.y;
        return dx >= CLAW_X0 && dx <= CLAW_X1 + (big ? 12 : 0) && Math.abs(dy) <= CLAW_Y + (big ? 10 : 0);
      };
      for (const f of st.fish) {
        if (f.dead || f.iv > 0 || !inArc(f)) continue;
        f.hp--; f.iv = 0.3; f.fleeT = 1.0;
        f.vx = p.face * 130; f.dir = p.face;
        ev.push({ type: 'hit', x: f.x, y: f.y });
        if (f.hp <= 0) {
          const F = M.FISH[f.type];
          f.dead = true; f.deadT = 0; f.vx *= 0.4; f.vy = -6;
          if (F.nocorpse) { f.gone = true; ev.push({ type: 'dissolve', x: f.x, y: f.y }); }
          ev.push({ type: 'kill', name: F.name, x: f.x, y: f.y });
        }
      }
      const b = st.boss;
      if (b && !b.dead && inArc(b, true)) {
        b.hp--;
        ev.push({ type: 'bosshit', x: b.x, y: b.y });
        if (b.hp <= 0) { b.dead = true; b.deadT = 0; ev.push({ type: 'bossdown', name: S.boss.name }); }
      }
    }

    // ── 시체 물기 ──
    if (!p.carry) {
      for (const f of st.fish) {
        if (!f.dead || f.gone) continue;
        if (Math.abs(f.x - p.x) < GRAB_R && Math.abs(f.y - p.y) < GRAB_R) {
          const F = M.FISH[f.type];
          p.carry = { type: f.type, name: F.name, score: F.score, weight: F.weight || 0.95 };
          f.gone = true;
          ev.push({ type: 'grab', name: F.name });
          break;
        }
      }
    }

    // ── 보트 하역 ──
    if (p.carry && Math.abs(p.x - M.BOAT_X) < DEPOSIT_R && p.y <= M.SURF + 26) {
      st.delivered++;
      st.score += p.carry.score;
      ev.push({ type: 'deposit', name: p.carry.name, score: p.carry.score, n: st.delivered, need: S.quota });
      p.carry = null;
      if (st.delivered >= S.quota && !st.bossSpawned && st.bossIntroT < 0) {
        st.bossIntroT = 1.6;
        ev.push({ type: 'quota' });
      }
    }

    // ── 어군 ──
    for (const f of st.fish) {
      if (f.gone) continue;
      if (f.iv > 0) f.iv -= dt;
      const F = M.FISH[f.type];
      if (f.dead) {
        // 시체: 천천히 떠오름 — 물어 갈 수 있음
        f.deadT += dt;
        f.vx *= Math.exp(-2 * dt);
        f.vy += (-12 - f.vy) * Math.min(1, 3 * dt);
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y < M.SURF + 6) { f.y = M.SURF + 6; f.vy = 0; }
        if (f.deadT > 25) f.gone = true;
        continue;
      }
      f.flipT -= dt;
      if (f.flipT <= 0) { f.flipT = st.rng.range(1.5, 4); if (st.rng.chance(0.5)) f.dir *= -1; }
      if (f.fleeT > 0) f.fleeT -= dt;
      const dxp = p.x - f.x, dyp = p.y - f.y, dp = Math.hypot(dxp, dyp);
      if (F.hazard) {
        f.x += f.dir * F.spd * 0.5 * dt;
        f.y += Math.sin(st.t * 1.3 + f.wob) * 10 * dt;
      } else if (F.aggro && f.fleeT <= 0 && dp < 150) {
        const s = F.spd;
        f.dir = dxp >= 0 ? 1 : -1;
        f.x += Math.sign(dxp) * s * dt;
        f.y += Math.sign(dyp) * s * 0.8 * dt;
      } else {
        // 배회 + 도주 (플레이어 접근 시)
        if (!F.aggro && dp < 70 && f.fleeT <= 0.5) { f.fleeT = 0.8; f.dir = f.x >= p.x ? 1 : -1; }
        const s = F.spd * (f.fleeT > 0 ? 1.7 : 0.5);
        f.x += f.dir * s * dt;
        f.y += Math.sin(st.t * 2 + f.wob) * 12 * dt;
      }
      if (f.x < 8) { f.x = 8; f.dir = 1; }
      if (f.x > M.WORLD_W - 8) { f.x = M.WORLD_W - 8; f.dir = -1; }
      f.y = clamp(f.y, M.SURF + 16, D - 14);
      // 접촉 피해 (해파리·공격어)
      const cdmg = F.hazard ? F.dmg : (F.aggro ? F.dmg : 0);
      if (cdmg && p.iv <= 0 && dp < F.w * 0.6 + 9) {
        p.o2 = Math.max(0, p.o2 - cdmg);
        p.iv = 1.0;
        p.vx += Math.sign(p.x - f.x || 1) * 160;
        p.vy += Math.sign(p.y - f.y || -1) * 120;
        if (F.aggro) { f.fleeT = 1.2; f.dir = f.x >= p.x ? 1 : -1; }
        ev.push({ type: 'hurt', dmg: cdmg });
      }
    }
    st.fish = st.fish.filter((f) => !f.gone);

    // ── 어군 재보충 (보스 등장 전) ──
    if (!st.bossSpawned) {
      st.spawnT -= dt;
      if (st.spawnT <= 0) {
        st.spawnT = 1.2;
        const alive = st.fish.filter((f) => !f.dead && !M.FISH[f.type].hazard).length;
        if (alive < 8 + st.no) this._spawnFish(st, false);
        const jn = st.fish.filter((f) => !f.dead && M.FISH[f.type].hazard).length;
        if (jn < S.jellyN) this._spawnJelly(st);
      }
    }

    // ── 보스 등장 ──
    if (st.bossIntroT > 0) {
      st.bossIntroT -= dt;
      if (st.bossIntroT <= 0) {
        this._spawnBoss(st);
        ev.push({ type: 'bossintro', name: S.boss.name });
      }
    }

    // ── 보스 AI ──
    const b = st.boss;
    if (b && !b.dead) {
      b.stT += dt;
      const ph2 = b.hp < b.maxHp * 0.5;
      const sm = ph2 ? 1.25 : 1, cm = ph2 ? 0.6 : 1;
      const dx = p.x - b.x, dy = p.y - b.y, dp = Math.hypot(dx, dy);
      b.atkCd -= dt;
      if (b.state === 'wander') {
        b.face = dx >= 0 ? 1 : -1;
        const want = b.base === 'ink' ? (dp < 130 ? -1 : (dp > 210 ? 1 : 0)) : (dp > 90 ? 1 : 0);
        b.x += Math.sign(dx) * want * b.spd * 0.45 * sm * dt;
        b.y += (Math.sign(dy) * b.spd * 0.35 * sm + Math.sin(st.t * 1.6) * 14) * dt;
        if (b.atkCd <= 0) {
          b.state = 'tele'; b.stT = 0; b.aimX = p.x; b.aimY = p.y;
          ev.push({ type: 'bosstele', base: b.base });
        }
      } else if (b.state === 'tele') {
        const dur = b.base === 'zap' ? 0.7 : (b.base === 'spikes' ? 0.55 : 0.5);
        if (b.stT >= dur) {
          b.stT = 0;
          const doCharge = b.base === 'charge' || (b.base === 'kraken' && b.alt);
          if (doCharge) {
            b.state = 'dash';
            const d = Math.hypot(b.aimX - b.x, b.aimY - b.y) || 1;
            b.vx = (b.aimX - b.x) / d * b.spd * 3 * sm;
            b.vy = (b.aimY - b.y) / d * b.spd * 3 * sm;
            ev.push({ type: 'bossdash' });
          } else if (b.base === 'spikes' || b.base === 'kraken') {
            const n = ph2 ? 12 : 8;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              st.shots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, ttl: 2.4, dmg: Math.max(6, b.dmg - 3), kind: 'spike' });
            }
            ev.push({ type: 'spikes', x: b.x, y: b.y });
            b.state = 'wander'; b.atkCd = 2.4 * cm;
          } else if (b.base === 'zap') {
            const R = ph2 ? 92 : 72;
            if (p.iv <= 0 && dp < R) {
              p.o2 = Math.max(0, p.o2 - b.dmg);
              p.iv = 1.1;
              p.vx += Math.sign(p.x - b.x || 1) * 200;
              ev.push({ type: 'hurt', dmg: b.dmg });
            }
            ev.push({ type: 'zap', r: R, x: b.x, y: b.y });
            b.state = 'wander'; b.atkCd = 2.6 * cm;
          } else if (b.base === 'ink') {
            const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
            st.shots.push({ x: b.x, y: b.y, vx: (p.x - b.x) / d * 115, vy: (p.y - b.y) / d * 115, ttl: 3.2, dmg: Math.max(6, b.dmg - 2), kind: 'ink' });
            ev.push({ type: 'ink', x: b.x, y: b.y });
            b.state = 'wander'; b.atkCd = 2.0 * cm;
          }
          if (b.base === 'kraken') b.alt = !b.alt;
        }
      } else if (b.state === 'dash') {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.stT > 0.6) {
          b.state = 'wander'; b.vx = 0; b.vy = 0;
          b.atkCd = (b.base === 'kraken' ? 2.0 : 2.2) * cm;
        }
      }
      b.x = clamp(b.x, 16, M.WORLD_W - 16);
      b.y = clamp(b.y, M.SURF + 30, D - 16);
      // 보스 접촉
      if (p.iv <= 0 && dp < b.w * 0.5 + 10) {
        p.o2 = Math.max(0, p.o2 - b.dmg);
        p.iv = 1.1;
        p.vx += Math.sign(p.x - b.x || 1) * 200;
        p.vy += Math.sign(p.y - b.y || -1) * 150;
        ev.push({ type: 'hurt', dmg: b.dmg });
      }
    } else if (b && b.dead) {
      b.deadT += dt;
      b.y = Math.min(D - 20, b.y + 10 * dt);
      if (b.deadT > 1.3 && st.phase === 'play') {
        st.stars = st.deaths === 0 ? 3 : (st.deaths <= 1 ? 2 : 1);
        st.score += 3000;
        st.phase = 'clear'; st.clearT = 0;
        ev.push({ type: 'clear', stars: st.stars, no: st.no });
      }
    }

    // ── 투사체 (가시·먹물) ──
    for (const sh of st.shots) {
      sh.ttl -= dt;
      sh.x += sh.vx * dt; sh.y += sh.vy * dt;
      if (sh.y < M.SURF + 4 || sh.y > D - 6) sh.ttl = 0;
      if (sh.ttl > 0 && p.iv <= 0 && Math.hypot(p.x - sh.x, p.y - sh.y) < 11) {
        sh.ttl = 0;
        p.o2 = Math.max(0, p.o2 - sh.dmg);
        p.iv = 1.0;
        ev.push({ type: 'hurt', dmg: sh.dmg });
      }
    }
    st.shots = st.shots.filter((s) => s.ttl > 0);

    // ── 기절 (산소 고갈) — 물고 있던 물고기만 잃고 보트에서 재개 ──
    if (p.o2 <= 0) {
      st.deaths++;
      const lost = p.carry;
      p.carry = null;
      p.x = M.BOAT_X; p.y = M.SURF + 6; p.vx = 0; p.vy = 0;
      p.o2 = O2MAX; p.iv = 2.5;
      st.o2warned = false;
      ev.push({ type: 'faint', lost: lost ? lost.name : null });
    }

    return ev;
  },
};
