// logic.js — 1:1 대전 시뮬레이션 (DOM 무의존 — node 테스트 가능)
// step(st, dt, [입력0, 입력1]) → 이벤트 배열. 입력은 누르고 있는 상태(boolean)만 받고,
// 눌린 순간 판정·커맨드 해석·약+강 동시 입력은 여기서 처리한다.
const M = window.MSK;

const ACTIONABLE = { idle: 1, walk: 1, crouch: 1 };
const BLOCKABLE_STATE = { idle: 1, walk: 1, crouch: 1, blockstun: 1 };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mkFighter(id, side) {
  const def = M.FIGHTERS[id];
  return {
    id, def, side,
    x: M.START_X[side], y: 0, vx: 0, vy: 0, pushV: 0,
    face: side === 0 ? 1 : -1,
    hp: def.hp, maxHp: def.hp, gauge: 0,
    state: 'idle', stT: 0,
    mv: null, stun: 0, invuln: 0, downT: 0, combo: 0,
    dead: false, airUsed: false, projOut: 0,
    hist: [], lastDir: 'n', prev: {}, pend: null, inp: {},
    walkPhase: 0, lastMoveName: '',
  };
}

function dirToken(f, inp) {
  const fwd = f.face === 1 ? inp.right : inp.left;
  const back = f.face === 1 ? inp.left : inp.right;
  if (inp.down && fwd) return 'df';
  if (inp.down && back) return 'db';
  if (inp.down) return 'd';
  if (inp.up) return 'u';
  if (fwd) return 'f';
  if (back) return 'b';
  return 'n';
}

// 방향 입력 순서 판정 — seq의 각 원소는 허용 토큰 집합
function matchCmd(f, t, seq) {
  const h = f.hist.filter((e) => t - e.t <= M.CMD_WINDOW);
  let k = 0;
  for (const e of h) if (seq[k].includes(e.d)) { k++; if (k === seq.length) return true; }
  return false;
}
const CMD_FIREBALL = [['d', 'df', 'db'], ['f', 'df']];
const CMD_CLAW = [['f'], ['d', 'df'], ['f', 'df']];

M.Logic = {
  create(seed, diff, stage) {
    const idx = clamp(stage | 0, 0, M.LADDER.length - 1);
    const st = {
      rng: M.makeRng((seed >>> 0) || 20260915),
      diff: M.DIFFS[diff] ? diff : 'normal',
      stage: idx, oppId: M.LADDER[idx],
      p: [mkFighter(M.PLAYER, 0), mkFighter(M.LADDER[idx], 1)],
      phase: 'intro', phaseT: 0, introLen: M.INTRO_FIRST,
      round: 1, wins: [0, 0], roundWinner: null, winner: null,
      timer: M.ROUND_TIME, t: 0, hitstop: 0,
      proj: [], haz: [], nextId: 1,
      stats: { hits: [0, 0], blocks: [0, 0], specials: [0, 0], supers: [0, 0], grabs: [0, 0], maxCombo: [0, 0] },
    };
    return st;
  },

  resetRound(st) {
    for (const f of st.p) {
      Object.assign(f, {
        x: M.START_X[f.side], y: 0, vx: 0, vy: 0, pushV: 0, face: f.side === 0 ? 1 : -1,
        hp: f.maxHp, state: 'idle', stT: 0, mv: null, stun: 0, invuln: 0, downT: 0, combo: 0,
        dead: false, airUsed: false, projOut: 0, hist: [], pend: null,
      });
    }
    st.proj = []; st.haz = [];
    st.timer = M.ROUND_TIME;
    st.phase = 'intro'; st.phaseT = 0; st.introLen = M.INTRO_NEXT;
    st.roundWinner = null;
  },

  step(st, dt, inputs) {
    const ev = [];
    st.t += dt;
    const I = inputs || [{}, {}];

    // ── 경기 진행 단계 ──
    if (st.phase === 'intro') {
      if (st.phaseT === 0) ev.push({ type: 'roundStart', round: st.round });
      st.phaseT += dt;
      this.idleAnim(st, dt);
      if (st.phaseT >= st.introLen) { st.phase = 'fight'; st.phaseT = 0; ev.push({ type: 'fight' }); }
      return ev;
    }
    if (st.phase === 'matchEnd') { st.phaseT += dt; this.physics(st, dt, ev); return ev; }
    if (st.phase === 'roundEnd') {
      st.phaseT += dt;
      this.physics(st, dt, ev);
      if (st.phaseT >= M.ROUND_END_TIME) this.afterRound(st, ev);
      return ev;
    }
    if (st.phase === 'ko') {
      st.phaseT += dt;
      const slow = st.phaseT < 0.8 ? 0.35 : 1;
      this.physics(st, dt * slow, ev);
      this.timers(st, dt * slow, ev);
      if (st.phaseT >= M.KO_TIME) {
        st.phase = 'roundEnd'; st.phaseT = 0;
        const w = st.roundWinner;
        if (w === 'draw') { st.wins[0]++; st.wins[1]++; }
        else { st.wins[w]++; const wf = st.p[w]; if (!wf.dead) { wf.state = 'win'; wf.mv = null; wf.stT = 0; } }
        ev.push({ type: 'roundEnd', winner: w, wins: st.wins.slice() });
      }
      return ev;
    }

    // ── fight ──
    if (st.hitstop > 0) { st.hitstop -= dt; return ev; }

    for (const f of st.p) this.control(st, f, st.p[1 - f.side], I[f.side] || {}, dt, ev);
    this.physics(st, dt, ev);
    for (const f of st.p) this.updateMove(st, f, st.p[1 - f.side], dt, ev);
    this.updateProjectiles(st, dt, ev);
    this.updateHazards(st, dt, ev);
    this.timers(st, dt, ev);

    // KO / 시간 초과
    const d0 = st.p[0].hp <= 0, d1 = st.p[1].hp <= 0;
    if (d0 || d1) {
      st.roundWinner = d0 && d1 ? 'draw' : d0 ? 1 : 0;
      for (const f of st.p) if (f.hp <= 0 && !f.dead) this.kill(f, st.p[1 - f.side]);
      st.phase = 'ko'; st.phaseT = 0;
      ev.push({ type: 'ko', winner: st.roundWinner });
    } else {
      st.timer -= dt;
      if (st.timer <= 0) {
        st.timer = 0;
        const r0 = st.p[0].hp / st.p[0].maxHp, r1 = st.p[1].hp / st.p[1].maxHp;
        st.roundWinner = Math.abs(r0 - r1) < 1e-9 ? 'draw' : r0 > r1 ? 0 : 1;
        st.phase = 'ko'; st.phaseT = 0;
        ev.push({ type: 'timeup', winner: st.roundWinner });
      }
    }
    return ev;
  },

  afterRound(st, ev) {
    const [a, b] = st.wins;
    if (a >= M.ROUNDS_TO_WIN && b >= M.ROUNDS_TO_WIN) { st.wins = [1, 1]; }   // 동시 달성 = 서든데스
    else if (a >= M.ROUNDS_TO_WIN || b >= M.ROUNDS_TO_WIN) {
      st.phase = 'matchEnd'; st.phaseT = 0;
      st.winner = a >= M.ROUNDS_TO_WIN ? 0 : 1;
      ev.push({ type: 'matchEnd', winner: st.winner, stage: st.stage, last: st.stage === M.LADDER.length - 1 });
      return;
    }
    st.round++;
    this.resetRound(st);
  },

  idleAnim(st, dt) { for (const f of st.p) f.stT += dt; },

  kill(f, killer) {
    f.dead = true; f.mv = null;
    if (f.state !== 'airhit') {
      f.state = 'airhit';
      f.vy = 560;
      f.vx = (Math.sign(f.x - killer.x) || -killer.face) * 200;
    }
  },

  // ── 입력 해석 ──
  control(st, f, o, inp, dt, ev) {
    f.inp = inp;
    const t = st.t;
    const press = (k) => !!inp[k] && !f.prev[k];

    // 방향 기록 (커맨드용)
    const d = dirToken(f, inp);
    if (d !== f.lastDir) { f.hist.push({ d, t }); f.lastDir = d; if (f.hist.length > 16) f.hist.shift(); }

    const pressed = {
      lp: press('lp'), hp: press('hp'), grab: press('grab'),
      sp1: press('sp1'), sp2: press('sp2'), sp3: press('sp3'), su: press('su'),
    };
    f.prev = Object.assign({}, inp);

    if (f.dead || f.state === 'win') return;

    const grounded = f.y <= 0 && f.vy <= 0;
    const canAct = ACTIONABLE[f.state] && grounded && !f.mv;
    const canAir = f.state === 'jump' && !f.mv && !f.airUsed;

    // 입력 선행 — 행동 불가 중에 누른 약·강은 0.12초 안에 풀리면 바로 나간다 (링크 콤보용)
    if (!canAct && !canAir && (pressed.lp || pressed.hp) && f.state !== 'down' && f.state !== 'airhit') {
      f.buf = { btn: pressed.hp ? 'hp' : 'lp', t, crouch: !!inp.down };
    }
    if (canAct && f.buf) {
      const b = f.buf; f.buf = null;
      if (t - b.t <= 0.12) { this.startMove(st, f, o, (inp.down || b.crouch ? 'c' : '') + b.btn, ev); return; }
    }

    // 약+강 동시 입력 대기 해소
    if (f.pend) {
      f.pend.t += dt;
      const other = f.pend.btn === 'lp' ? pressed.hp : pressed.lp;
      if (other && canAct) { f.pend = null; this.startMove(st, f, o, 'grab', ev); return; }
      if (f.pend.t >= M.GRAB_WINDOW) {
        const btn = f.pend.btn; const crouch = f.pend.crouch; f.pend = null;
        if (canAct) { this.startMove(st, f, o, crouch ? 'c' + btn : btn, ev); return; }
      }
    }

    if (canAct || canAir) {
      // 초필살
      if (pressed.su && f.gauge >= M.GAUGE_MAX && canAct) { this.startSpecial(st, f, o, 'sup', ev); return; }
      // 명시 필살 (터치 버튼 / AI)
      if (canAct) {
        if (pressed.sp3 && f.def.sp3) { this.startSpecial(st, f, o, 'sp3', ev); return; }
        if (pressed.sp2 && f.def.sp2) { this.startSpecial(st, f, o, 'sp2', ev); return; }
        if (pressed.sp1 && f.def.sp1) { this.startSpecial(st, f, o, 'sp1', ev); return; }
        if (pressed.grab) { this.startMove(st, f, o, 'grab', ev); return; }
        // 커맨드 필살
        if (pressed.hp && f.def.sp2 && matchCmd(f, t, CMD_CLAW)) { this.startSpecial(st, f, o, 'sp2', ev); return; }
        if (pressed.lp && f.def.sp1 && matchCmd(f, t, CMD_FIREBALL)) { this.startSpecial(st, f, o, 'sp1', ev); return; }
        if (pressed.lp && pressed.hp) { this.startMove(st, f, o, 'grab', ev); return; }
        if (pressed.lp || pressed.hp) {
          f.pend = { btn: pressed.lp ? 'lp' : 'hp', t: 0, crouch: !!inp.down };
          return;
        }
      } else if (canAir && (pressed.lp || pressed.hp)) {
        f.airUsed = true;
        this.startMove(st, f, o, pressed.hp ? 'jhp' : 'jlp', ev);
        return;
      }
    }

    // 이동
    if (canAct) {
      const fwd = f.face === 1 ? inp.right : inp.left;
      const back = f.face === 1 ? inp.left : inp.right;
      if (inp.down) { f.state = 'crouch'; f.vx = 0; }
      else if (inp.up) {
        f.state = 'jump'; f.stT = 0; f.airUsed = false;
        f.vy = M.JUMP_V;
        f.vx = (fwd ? 1 : back ? -1 : 0) * f.face * M.JUMP_VX;
        ev.push({ type: 'jump', side: f.side });
      } else if (fwd || back) {
        if (f.state !== 'walk') f.stT = 0;
        f.state = 'walk';
        f.vx = (fwd ? 1 : -0.8) * f.face * f.def.speed;
      } else {
        if (f.state !== 'idle') f.stT = 0;
        f.state = 'idle'; f.vx = 0;
      }
    }
  },

  // ── 기술 시작 ──
  startMove(st, f, o, key, ev) {
    const base = M.MOVES[key];
    if (!base) return;
    f.mv = { key, kind: key === 'grab' ? 'grab' : 'normal', d: base, t: 0, hits: 0, done: false };
    if (!base.band || base.band !== 'air') { f.vx = 0; f.state = 'attack'; }
    else f.state = 'jump';
    f.stT = 0;
    ev.push({ type: 'swing', side: f.side, key, strong: key.endsWith('hp') });
  },

  startSpecial(st, f, o, slot, ev) {
    const d = slot === 'sup' ? M.superOf(f.def) : f.def[slot];
    if (!d) return;
    if (d.type === 'projectile' && d.count === 1 && f.projOut > 0) return;   // 기탄은 화면에 하나만
    if (slot === 'sup') {
      f.gauge = 0;
      st.stats.supers[f.side]++;
      st.hitstop = Math.max(st.hitstop, 0.18);
      ev.push({ type: 'super', side: f.side, name: d.name });
    } else {
      st.stats.specials[f.side]++;
      ev.push({ type: 'special', side: f.side, slot, name: d.name, kind: d.type });
    }
    f.mv = { key: slot, kind: d.type, d, t: 0, hits: 0, spawned: 0, done: false, phase: 0, superMul: d.superMul || (slot === 'sup' && f.def.sup ? 1 : 1), isSuper: slot === 'sup' };
    f.state = 'attack'; f.stT = 0; f.vx = 0;
    f.lastMoveName = d.name;
  },

  // ── 기술 진행 · 판정 ──
  updateMove(st, f, o, dt, ev) {
    const mv = f.mv;
    if (!mv) return;
    mv.t += dt;
    const d = mv.d;
    const mul = (mv.superMul || 1);

    switch (mv.kind) {
      case 'normal':
      case 'grab': {
        const air = d.band === 'air';
        if (mv.t >= d.startup && mv.t < d.startup + d.active && mv.hits === 0) {
          if (mv.kind === 'grab') {
            if (this.tryGrab(st, f, o, d.dmg * (f.def.grabMul || 1), d.reach, ev)) mv.hits = 1;
          } else if (this.meleeHit(st, f, o, d, air ? 'air' : d.band, d.dmg * mul, ev)) mv.hits = 1;
        }
        if (air) {
          if (f.y <= 0 && mv.t > 0.02) { f.mv = null; f.state = 'idle'; f.stT = 0; }
        } else if (mv.t >= d.startup + d.active + d.recovery) { this.endMove(f); }
        break;
      }
      case 'projectile': {
        while (mv.spawned < d.count && mv.t >= d.startup + mv.spawned * d.gap) {
          const dmg = d.dmg * mul;
          st.proj.push({ id: st.nextId++, owner: f.side, kind: f.id === 'ninja' ? 'shuriken' : 'fireball',
            x: f.x + f.face * 50, y: 92, vx: f.face * d.speed, dmg, band: d.band,
            hitstun: d.hitstun, blockstun: d.blockstun, kd: mv.isSuper ? 'always' : d.kd, age: 0, isSuper: mv.isSuper });
          f.projOut++;
          mv.spawned++;
          ev.push({ type: 'projectile', side: f.side, kind: f.id === 'ninja' ? 'shuriken' : 'fireball' });
        }
        if (mv.t >= d.startup + (d.count - 1) * d.gap + d.recovery) this.endMove(f);
        break;
      }
      case 'rising': {
        if (mv.phase === 0 && mv.t >= d.startup) { mv.phase = 1; f.vy = d.riseV; f.vx = f.face * 70; }
        f.invuln = Math.max(f.invuln, mv.t < (d.invuln || 0) ? 0.02 : 0);
        if (mv.phase === 1) {
          const k = Math.floor((mv.t - d.startup) / (d.active / d.hits.length));
          if (k >= mv.hits && mv.hits < d.hits.length && k < d.hits.length) {
            if (this.meleeHit(st, f, o, { reach: d.reach, hitstun: .30, blockstun: .16, push: 14, kd: mv.hits === d.hits.length - 1 ? d.kd : false }, 'rise', d.hits[mv.hits] * mul, ev, true)) mv.hits++;
            else if (mv.t - d.startup > (mv.hits + 1) * (d.active / d.hits.length)) mv.hits++;   // 빗나간 타는 넘김
          }
          if (f.y <= 0 && mv.t > d.startup + 0.1) { mv.phase = 2; mv.landT = mv.t; f.vx = 0; }
        }
        if (mv.phase === 2 && mv.t >= mv.landT + d.recovery) this.endMove(f);
        break;
      }
      case 'rush': case 'dash': case 'spin': case 'chain': case 'push': {
        const startup = d.startup;
        const active = d.type === 'chain' ? d.gap * d.hits.length : (d.active || 0.1);
        if (mv.t < startup) { f.invuln = Math.max(f.invuln, mv.t < (d.invuln || 0) ? 0.02 : 0); break; }
        // 초필살 연출 연타는 활성 시간과 무관하게 끝까지 넣는다
        if (d.type === 'rush' && mv.connected === 'hit') {
          f.vx = 0;
          const k = 1 + Math.floor((mv.t - mv.connT) / 0.07);
          while (mv.hits < Math.min(k, d.hits.length)) {
            const last = mv.hits === d.hits.length - 1;
            o.stun = Math.max(o.stun, 0.3);
            this.applyHit(st, f, o, d.hits[mv.hits] * mul, { band: 'mid', hitstun: .5, blockstun: .2, push: last ? 40 : 4, kd: last ? 'always' : false, unblockable: true, isSuper: true, hx: o.x, hy: 90 }, ev);
            o.invuln = 0;
            mv.hits++;
          }
          if (mv.hits >= d.hits.length && !mv.doneT) mv.doneT = mv.t;
          if (mv.doneT && mv.t >= mv.doneT + d.recovery) this.endMove(f);
          break;
        }
        if (mv.t < startup + active) {
          if (d.dashV) f.vx = f.face * d.dashV;
          if (d.type === 'rush' && mv.hits === 0 && !mv.connected) {
            const r = this.meleeHit(st, f, o, { reach: d.reach, hitstun: .9, blockstun: .3, push: 10, kd: false }, 'mid', d.hits[0] * mul, ev, false, { isSuper: true, returnKind: true });
            if (r === 'hit') { mv.connected = 'hit'; mv.hits = 1; mv.connT = mv.t; f.vx = 0; }
            else if (r === 'block') { mv.connected = 'block'; mv.hits = d.hits.length; f.vx = 0; }
          } else if (d.type !== 'rush') {
            const per = active / d.hits.length;
            const k = Math.floor((mv.t - startup) / per);
            if (k >= mv.hits && mv.hits < d.hits.length) {
              const band = d.bands ? d.bands[mv.hits] : d.band;
              const last = mv.hits === d.hits.length - 1;
              const r = this.meleeHit(st, f, o, { reach: d.reach, hitstun: .34, blockstun: .2, push: d.push && last ? d.push : 16, kd: last ? d.kd : false, wallBonus: d.wallBonus }, band, d.hits[mv.hits] * mul, ev, false, { returnKind: true });
              if (r || (mv.t - startup) > (mv.hits + 1) * per) mv.hits++;
            }
          }
        } else {
          f.vx = 0;
          if (mv.t >= startup + active + d.recovery) this.endMove(f);
        }
        break;
      }
      case 'dive': {
        if (mv.phase === 0 && mv.t >= d.startup) { mv.phase = 1; f.vy = d.riseV; f.vx = f.face * 60; mv.p1 = mv.t; }
        if (mv.phase === 1 && mv.t >= mv.p1 + 0.28) { mv.phase = 2; f.vx = f.face * d.diveVx; f.vy = d.diveVy; }
        if (mv.phase === 2) {
          if (mv.hits === 0 && this.meleeHit(st, f, o, { reach: d.reach, hitstun: .4, blockstun: .22, push: 30, kd: d.kd }, 'air', d.hits[0] * mul, ev)) mv.hits = 1;
          if (f.y <= 0) { mv.phase = 3; mv.landT = mv.t; f.vx = 0; }
        }
        if (mv.phase === 3 && mv.t >= mv.landT + d.recovery) this.endMove(f);
        break;
      }
      case 'teleport': {
        if (mv.phase === 0 && mv.t >= d.startup) {
          mv.phase = 1;
          const side = Math.sign(o.x - f.x) || 1;
          f.x = clamp(o.x + side * 70, M.WALL_L + M.BODY, M.WALL_R - M.BODY);
          if (Math.abs(f.x - o.x) < M.BODY * 2) f.x = clamp(o.x - side * 70, M.WALL_L + M.BODY, M.WALL_R - M.BODY);
          f.face = Math.sign(o.x - f.x) || f.face;
          ev.push({ type: 'teleport', side: f.side, x: f.x });
        }
        if (mv.t >= d.startup + d.recovery) this.endMove(f);
        break;
      }
      case 'cmdgrab': {
        if (mv.t >= d.startup && mv.t < d.startup + d.active && mv.hits === 0) {
          if (this.tryGrab(st, f, o, d.dmg * mul, d.reach, ev, true)) mv.hits = 1;
        }
        if (mv.t >= d.startup + d.active + d.recovery) this.endMove(f);
        break;
      }
      case 'trap': {
        if (mv.phase === 0 && mv.t >= d.startup) {
          mv.phase = 1;
          st.haz.push({ id: st.nextId++, kind: 'trap', owner: f.side, x: o.x, width: d.width, t: 0, arm: d.delay, life: d.delay + 0.35,
            dmg: d.dmg * mul, band: d.band, kd: d.kd, hit: false });
          ev.push({ type: 'hazard', side: f.side, kind: 'trap' });
        }
        if (mv.t >= d.startup + d.recovery) this.endMove(f);
        break;
      }
      case 'wall': {
        if (mv.phase === 0 && mv.t >= d.startup) {
          mv.phase = 1;
          st.haz = st.haz.filter((h) => !(h.kind === 'wall' && h.owner === f.side));
          st.haz.push({ id: st.nextId++, kind: 'wall', owner: f.side, x: clamp(f.x + f.face * d.offset, M.WALL_L + 40, M.WALL_R - 40), t: 0, life: d.life });
          ev.push({ type: 'hazard', side: f.side, kind: 'wall' });
        }
        if (mv.t >= d.startup + d.recovery) this.endMove(f);
        break;
      }
      case 'eraser': {
        if (mv.t >= d.startup && mv.t < d.startup + d.active) {
          const prog = (mv.t - d.startup) / d.active;
          mv.front = f.x + f.face * (40 + prog * d.width);
          if (mv.hits === 0) {
            const lo = Math.min(f.x, mv.front), hi = Math.max(f.x, mv.front);
            if (o.x + M.BODY >= lo && o.x - M.BODY <= hi && o.y < 140) {
              const r = this.applyHit(st, f, o, d.dmg * mul, { band: 'mid', hitstun: .5, blockstun: .3, push: 60, kd: d.kd, hx: o.x, hy: 90 }, ev);
              if (r !== 'whiff') mv.hits = 1;
            }
          }
        } else if (mv.t >= d.startup + d.active) { mv.front = null; }
        if (mv.t >= d.startup + d.active + d.recovery) this.endMove(f);
        break;
      }
      default: this.endMove(f);
    }
  },

  endMove(f) {
    f.mv = null;
    if (f.state === 'attack') { f.state = f.y > 0 ? 'jump' : 'idle'; f.stT = 0; }
  },

  // 공격 판정 영역 (세로) — 지상 기술은 바닥 기준, 공중 기술은 공격자 높이 기준
  attackBand(f, band) {
    if (band === 'air') return [f.y + 10, f.y + 112];
    if (band === 'rise') return [f.y + 40, f.y + 210];
    return M.BANDS[band] || M.BANDS.mid;
  },
  hurtBand(o) {
    if (o.y > 0 || o.state === 'airhit') return [o.y, o.y + M.HURT.air];
    if (o.state === 'down' || o.state === 'ko') return [0, 20];
    const crouching = o.state === 'crouch' || (o.inp.down && BLOCKABLE_STATE[o.state]) || (o.mv && (o.mv.key === 'clp' || o.mv.key === 'chp'));
    return [0, crouching ? M.HURT.crouch : M.HURT.stand];
  },

  meleeHit(st, f, o, d, band, dmg, ev, isRising, opt) {
    const reachR = M.BODY + d.reach * f.def.range;
    const dist = (o.x - f.x) * f.face;
    if (dist < -M.BODY || dist - M.BODY > reachR) return false;
    const [a0, a1] = this.attackBand(f, band);
    const [h0, h1] = this.hurtBand(o);
    if (a1 < h0 || a0 > h1) return false;
    const r = this.applyHit(st, f, o, dmg, {
      band: band === 'rise' ? 'mid' : band, hitstun: d.hitstun, blockstun: d.blockstun, push: d.push, kd: d.kd,
      wallBonus: d.wallBonus, isSuper: opt && opt.isSuper,
      hx: f.x + f.face * Math.min(reachR, Math.max(0, dist)), hy: (Math.max(a0, h0) + Math.min(a1, h1)) / 2,
    }, ev);
    if (r === 'whiff') return false;
    return opt && opt.returnKind ? r : true;
  },

  canBlock(o, att, band) {
    if (!BLOCKABLE_STATE[o.state] || o.y > 0 || o.mv || o.dead) return false;
    const back = Math.sign(att.x - o.x) >= 0 ? o.inp.left : o.inp.right;
    if (!back) return false;
    if (band === 'low') return !!o.inp.down;
    return !o.inp.down;                               // 상단·중단·공중 = 서서 가드
  },

  applyHit(st, att, def, dmgBase, opt, ev) {
    if (def.invuln > 0 || def.state === 'down' || def.state === 'ko' || def.dead) return 'whiff';
    const away = Math.sign(def.x - att.x) || att.face;
    const blocked = !opt.unblockable && this.canBlock(def, att, opt.band);
    if (blocked) {
      const chip = Math.max(1, Math.round(dmgBase * M.CHIP));
      def.hp = Math.max(0, def.hp - chip);
      def.state = 'blockstun'; def.stun = opt.blockstun || .18; def.stT = 0; def.pend = null;
      def.gauge = Math.min(M.GAUGE_MAX, def.gauge + M.GAUGE_BLOCK);
      this.knock(def, att, away, (opt.push || 20) * 0.8);
      st.hitstop = Math.max(st.hitstop, M.HITSTOP * 0.7);
      st.stats.blocks[def.side]++;
      ev.push({ type: 'block', side: att.side, dmg: chip, x: opt.hx != null ? opt.hx : def.x, y: opt.hy != null ? opt.hy : 90 });
      return 'block';
    }
    // 콤보 보정 — 초필살 연출 연타는 설계 대미지(320)를 그대로 준다
    const scale = opt.isSuper ? 1 : Math.max(M.COMBO_FLOOR, 1 - M.COMBO_STEP * def.combo);
    let dmg = Math.round(dmgBase * scale);
    def.hp = Math.max(0, def.hp - dmg);
    def.combo++;
    st.stats.maxCombo[att.side] = Math.max(st.stats.maxCombo[att.side], def.combo);
    st.stats.hits[att.side]++;
    if (!opt.isSuper) att.gauge = Math.min(M.GAUGE_MAX, att.gauge + M.GAUGE_HIT);
    def.gauge = Math.min(M.GAUGE_MAX, def.gauge + M.GAUGE_HURT);
    if (def.mv && def.mv.kind === 'projectile') { /* 이미 나간 기탄은 유지 */ }
    def.mv = null; def.pend = null;
    const kd = opt.kd === 'always' || (opt.kd === 'combo' && def.combo >= 2) || def.y > 0 || def.hp <= 0;
    if (kd) {
      def.state = 'airhit'; def.stT = 0; def.stun = 0;
      def.vy = def.y > 0 ? 300 : 520;
      def.vx = away * 190;
    } else {
      def.state = 'hitstun'; def.stun = opt.hitstun || .3; def.stT = 0;
      const atWall = this.knock(def, att, away, opt.push || 20);
      if (atWall && opt.wallBonus) {
        def.hp = Math.max(0, def.hp - opt.wallBonus); dmg += opt.wallBonus;
        ev.push({ type: 'wallsplat', side: att.side, x: def.x });
      }
    }
    const strong = dmgBase >= 80 || kd;
    st.hitstop = Math.max(st.hitstop, strong ? M.HITSTOP_STRONG : M.HITSTOP);
    ev.push({ type: 'hit', side: att.side, dmg, combo: def.combo, strong, kd,
      x: opt.hx != null ? opt.hx : def.x, y: opt.hy != null ? opt.hy : 90, isSuper: !!opt.isSuper });
    return 'hit';
  },

  // 밀어내기 — 벽에 붙어 있으면 반동을 공격자에게 넘긴다. 벽 도달 여부 반환
  knock(def, att, away, push) {
    const edge = away > 0 ? M.WALL_R - M.BODY : M.WALL_L + M.BODY;
    const room = Math.abs(edge - def.x);
    if (room < push) {
      def.pushV = away * room * 12;
      att.pushV = -away * (push - room) * 12 * 0.7;
      return room < 8;
    }
    def.pushV = away * push * 12;
    return false;
  },

  tryGrab(st, f, o, dmg, reach, ev, command) {
    const dist = Math.abs(o.x - f.x) - M.BODY * 2;
    const facingOk = Math.sign(o.x - f.x) === f.face || Math.abs(o.x - f.x) < 4;
    if (!facingOk || dist > reach) return false;
    if (o.y > 0 || o.invuln > 0 || o.dead || o.state === 'down' || o.state === 'hitstun' || o.state === 'blockstun' || o.state === 'airhit') return false;
    o.combo = 0;
    st.stats.grabs[f.side]++;
    ev.push({ type: 'grab', side: f.side, command: !!command, x: (f.x + o.x) / 2 });
    this.applyHit(st, f, o, dmg, { band: 'grab', unblockable: true, kd: 'always', push: 90, hx: o.x, hy: 110 }, ev);
    return true;
  },

  // ── 물리 ──
  physics(st, dt, ev) {
    const [a, b] = st.p;
    for (const f of st.p) {
      f.stT += dt;
      f.x += (f.vx + f.pushV) * dt;
      f.pushV *= Math.exp(-12 * dt);
      if (Math.abs(f.pushV) < 2) f.pushV = 0;
      const airborne = f.y > 0 || f.vy > 0;
      if (airborne) {
        f.y += f.vy * dt;
        f.vy -= M.GRAVITY * dt;
        if (f.y <= 0) {
          f.y = 0; f.vy = 0;
          if (f.state === 'airhit') {
            f.vx = 0;
            f.state = f.dead ? 'ko' : 'down'; f.stT = 0; f.downT = M.DOWN_TIME;
            ev.push({ type: 'land', side: f.side, heavy: true, x: f.x });
          } else if (f.state === 'jump') {
            f.vx = 0; f.state = 'idle'; f.stT = 0; f.airUsed = false;
            if (f.mv && f.mv.d && f.mv.d.band === 'air' && f.mv.kind === 'normal') f.mv = null;
            ev.push({ type: 'land', side: f.side, heavy: false, x: f.x });
          } else if (f.state === 'attack' && !f.mv) { f.vx = 0; f.state = 'idle'; }
        }
      } else if (f.state === 'hitstun' || f.state === 'blockstun' || f.state === 'down' || f.state === 'ko' || f.state === 'win') {
        f.vx = 0;
      }
      f.x = clamp(f.x, M.WALL_L + M.BODY, M.WALL_R - M.BODY);
    }
    // 선 벽: 소유자가 아닌 쪽은 벽을 넘지 못한다
    for (const h of st.haz) {
      if (h.kind !== 'wall') continue;
      const enemy = st.p[1 - h.owner], owner = st.p[h.owner];
      const side = Math.sign(owner.x - h.x) || 1;
      if (Math.sign(enemy.x - h.x) === side || Math.abs(enemy.x - h.x) < M.BODY) {
        enemy.x = h.x - side * (M.BODY + 2);
        enemy.pushV = 0;
      }
    }
    // 몸 겹침 방지 (한쪽이 높이 떠 있으면 넘어갈 수 있다)
    const dx = b.x - a.x;
    if (Math.abs(dx) < M.BODY * 2 && Math.abs(a.y - b.y) < 90 && !a.dead && !b.dead) {
      const overlap = M.BODY * 2 - Math.abs(dx);
      const s = Math.sign(dx) || (a.face > 0 ? 1 : -1);
      a.x = clamp(a.x - s * overlap / 2, M.WALL_L + M.BODY, M.WALL_R - M.BODY);
      b.x = clamp(b.x + s * overlap / 2, M.WALL_L + M.BODY, M.WALL_R - M.BODY);
      if (Math.abs(b.x - a.x) < M.BODY * 2) {       // 벽에 끼면 반대쪽이 밀린다
        if (a.x <= M.WALL_L + M.BODY + 1) b.x = a.x + M.BODY * 2;
        else if (b.x <= M.WALL_L + M.BODY + 1) a.x = b.x + M.BODY * 2;
        else if (a.x >= M.WALL_R - M.BODY - 1) b.x = a.x - M.BODY * 2;
        else if (b.x >= M.WALL_R - M.BODY - 1) a.x = b.x - M.BODY * 2;
      }
    }
    // 방향 전환 — 땅에서 행동 가능할 때만
    for (const f of st.p) {
      const o = st.p[1 - f.side];
      if (f.y <= 0 && (ACTIONABLE[f.state]) && !f.mv && Math.abs(o.x - f.x) > 2) f.face = Math.sign(o.x - f.x);
    }
  },

  timers(st, dt, ev) {
    for (const f of st.p) {
      if (f.invuln > 0) f.invuln = Math.max(0, f.invuln - dt);
      if (f.state === 'hitstun' || f.state === 'blockstun') {
        f.stun -= dt;
        if (f.stun <= 0) { f.state = 'idle'; f.stT = 0; if (f.state === 'idle') f.combo = f.combo; }
      }
      if (f.state === 'down') {
        f.downT -= dt;
        if (f.downT <= 0) {
          f.state = 'idle'; f.stT = 0; f.invuln = M.WAKE_INVULN;
          ev.push({ type: 'wakeup', side: f.side });
        }
      }
      // 콤보 카운트 초기화 — 피격·가드·다운에서 완전히 벗어났을 때
      if (ACTIONABLE[f.state] || f.state === 'jump' || (f.state === 'attack' && f.mv)) f.combo = 0;
    }
  },

  updateProjectiles(st, dt, ev) {
    const keep = [];
    for (const p of st.proj) {
      p.x += p.vx * dt; p.age += dt;
      let gone = p.x < M.WALL_L - 20 || p.x > M.WALL_R + 20;
      // 상대 기탄과 상쇄
      if (!gone) {
        for (const q of st.proj) {
          if (q === p || q.owner === p.owner || q.dead) continue;
          if (Math.abs(q.x - p.x) < 30) { q.dead = true; gone = true; ev.push({ type: 'clash', x: (p.x + q.x) / 2 }); break; }
        }
      }
      // 선 벽에 막힘
      if (!gone) for (const h of st.haz) if (h.kind === 'wall' && h.owner !== p.owner && Math.abs(h.x - p.x) < 16) { gone = true; ev.push({ type: 'clash', x: h.x }); }
      if (!gone && !p.dead) {
        const o = st.p[1 - p.owner];
        const att = st.p[p.owner];
        if (Math.abs(o.x - p.x) < M.BODY + 16) {
          const [h0, h1] = this.hurtBand(o);
          if (p.y + 16 >= h0 && p.y - 16 <= h1) {
            const r = this.applyHit(st, att, o, p.dmg, { band: p.band, hitstun: p.hitstun, blockstun: p.blockstun, push: 22, kd: p.kd, isSuper: p.isSuper, hx: p.x, hy: p.y }, ev);
            if (r !== 'whiff') gone = true;
          }
        }
      }
      if (gone || p.dead) { st.p[p.owner].projOut = Math.max(0, st.p[p.owner].projOut - 1); continue; }
      keep.push(p);
    }
    st.proj = keep;
  },

  updateHazards(st, dt, ev) {
    const keep = [];
    for (const h of st.haz) {
      h.t += dt;
      if (h.kind === 'trap' && !h.hit && h.t >= h.arm) {
        const o = st.p[1 - h.owner];
        if (Math.abs(o.x - h.x) < h.width / 2 + M.BODY && o.y < 30) {
          const r = this.applyHit(st, st.p[h.owner], o, h.dmg, { band: 'low', hitstun: .4, blockstun: .24, push: 30, kd: h.kd, hx: h.x, hy: 20 }, ev);
          if (r !== 'whiff') h.hit = true;
        }
      }
      if (h.t < h.life) keep.push(h);
    }
    st.haz = keep;
  },
};
