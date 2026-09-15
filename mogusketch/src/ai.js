// ai.js — CPU 입력 생성기 (DOM 무의존). 플레이어와 같은 입력 규칙만 쓴다.
// 난이도 표(설계 4절)의 반응 지연은 「react 초 전의 상대 모습」을 보고 판단하는 방식으로 구현한다.
const M = window.MSK;

const KEYS = ['left', 'right', 'up', 'down', 'lp', 'hp', 'grab', 'sp1', 'sp2', 'sp3', 'su'];

M.AI = {
  create(diff, seed) {
    return {
      cfg: M.DIFFS[diff] || M.DIFFS.normal,
      rng: M.makeRng((seed >>> 0) || 7),
      buf: [],                 // 상대 스냅숏 (지연 인지용)
      hold: {},                // 키 → 남은 시간
      thinkT: 0,
      threatId: null, guarding: false, guardBand: 'mid', guardUntil: 0,
      airId: null, punishId: null,
      chain: 0, lastHits: 0,
      cool: { sp: 0, tele: 0, wall: 0, eraser: 0, jump: 0 },
      superRolled: false,
      stats: { threats: 0, guards: 0, antiAir: 0, punish: 0, specials: 0 },
    };
  },

  press(ai, key, dur) { ai.hold[key] = Math.max(ai.hold[key] || 0, dur || 0.05); },

  snapshot(st, o) {
    const mv = o.mv;
    const d = mv && mv.d;
    let reach = 0, startup = 0, active = 0, band = 'mid';
    if (d) {
      startup = d.startup || 0;
      active = d.active || (d.gap ? d.gap * (d.hits ? d.hits.length : 1) : 0.1);
      reach = (d.reach || 60) * (o.def.range || 1) + (d.dashV ? d.dashV * active : 0) + (d.width || 0);
      band = d.bands ? d.bands[0] : (d.band || 'mid');
      if (mv.kind === 'grab' || mv.kind === 'cmdgrab') band = 'grab';
    }
    return {
      t: st.t, x: o.x, y: o.y, vy: o.vy, state: o.state, face: o.face,
      mvStart: mv ? st.t - mv.t : null, mvT: mv ? mv.t : 0, kind: mv ? mv.kind : null,
      startup, active, reach, band,
      proj: st.proj.filter((p) => p.owner === o.side).map((p) => ({ id: p.id, x: p.x, vx: p.vx })),
      haz: st.haz.filter((h) => h.owner === o.side && h.kind === 'trap').map((h) => ({ id: h.id, x: h.x, arm: h.arm - h.t, w: h.width })),
    };
  },

  think(ai, st, side, dt) {
    const me = st.p[side], o = st.p[1 - side];
    const cfg = ai.cfg, def = me.def, rng = ai.rng;

    // 키 유지 시간 소모
    for (const k of Object.keys(ai.hold)) { ai.hold[k] -= dt; if (ai.hold[k] <= 0) delete ai.hold[k]; }
    for (const k of Object.keys(ai.cool)) ai.cool[k] = Math.max(0, ai.cool[k] - dt);

    ai.buf.push(this.snapshot(st, o));
    while (ai.buf.length > 2 && ai.buf[1].t <= st.t - cfg.react) ai.buf.shift();
    const seen = ai.buf[0];
    if (st.phase !== 'fight') { ai.hold = {}; return {}; }

    const fwdKey = me.face === 1 ? 'right' : 'left';
    const backKey = me.face === 1 ? 'left' : 'right';
    const dist = Math.abs(o.x - me.x) - M.BODY * 2;
    const seenDist = Math.abs(seen.x - me.x) - M.BODY * 2;
    const canAct = (me.state === 'idle' || me.state === 'walk' || me.state === 'crouch') && !me.mv && me.y <= 0;
    const low = me.hp / me.maxHp < 0.3;

    // ── 1) 방어: 인지한 위협마다 한 번씩 가드 여부를 굴린다 ──
    let threat = null;
    if (seen.kind && seen.band !== 'grab' && seen.mvT < seen.startup + seen.active + 0.05 && seenDist <= seen.reach + 40) {
      threat = { id: 'm' + seen.mvStart.toFixed(3), band: seen.band };
    }
    if (!threat) {
      for (const p of seen.proj) {
        const toward = Math.sign(me.x - p.x) === Math.sign(p.vx);
        if (toward && Math.abs(me.x - p.x) < 240) { threat = { id: 'p' + p.id, band: 'mid' }; break; }
      }
    }
    if (!threat) {
      for (const h of seen.haz) if (Math.abs(me.x - h.x) < h.w && h.arm < 0.5) { threat = { id: 'h' + h.id, band: 'low' }; break; }
    }
    if (threat && threat.id !== ai.threatId) {
      ai.threatId = threat.id;
      ai.stats.threats++;
      const g = Math.min(0.97, cfg.guard + (low ? 0.15 : 0) + (def.guardBonus || 0));
      ai.guarding = rng.next() < g;
      ai.guardBand = threat.band;
      if (ai.guarding) { ai.stats.guards++; ai.guardUntil = st.t + 0.5; }
    }
    if (ai.guarding && (threat || me.state === 'blockstun' || st.t < ai.guardUntil)) {
      if (threat) ai.guardUntil = st.t + 0.15;
      const inp = { [backKey]: true, down: ai.guardBand === 'low' };
      return inp;
    }
    if (!threat && st.t >= ai.guardUntil) ai.guarding = false;

    // ── 2) 콤보 이어가기 ──
    const hitsNow = st.stats.hits[side];
    if (hitsNow > ai.lastHits) { ai.lastHits = hitsNow; ai.chain++; }
    if (o.state !== 'hitstun') ai.chain = 0;
    if (canAct && o.state === 'hitstun' && ai.chain > 0 && ai.chain < cfg.combo && dist < M.MOVES.hp.reach * def.range) {
      const lastStep = ai.chain === cfg.combo - 1 || ai.chain >= 2;
      if (lastStep && def.sp1 && ['spin', 'dash', 'chain', 'rising'].includes(def.sp1.type)) this.press(ai, 'sp1');
      else this.press(ai, lastStep ? 'hp' : 'lp');
      return this.output(ai);
    }

    if (!canAct) return this.output(ai);

    // ── 3) 대공 ──
    // 상대가 땅에서 떠오르는 순간을 점프 하나로 보고 한 번만 굴린다
    if (seen.y <= 0) ai.airSeen = false;
    if (seen.y > 30 && !ai.airSeen && seenDist < 230) {
      ai.airSeen = true;
      if (rng.next() < cfg.antiAir) {
        ai.stats.antiAir++;
        if (me.id === 'mogu') this.press(ai, 'sp2');
        else if (def.sp1 && def.sp1.anti) this.press(ai, 'sp1');
        else this.press(ai, 'hp');
        return this.output(ai);
      }
    }

    // ── 4) 헛친 기술 확정 반격 ──
    if (cfg.punish && seen.kind && seen.mvT > seen.startup + seen.active && seenDist < M.MOVES.hp.reach * def.range + 10 && ai.punishId !== seen.mvStart) {
      ai.punishId = seen.mvStart;
      ai.stats.punish++;
      if (cfg.superPunish && me.gauge >= M.GAUGE_MAX) this.press(ai, 'su');
      else this.press(ai, 'hp');
      return this.output(ai);
    }

    // ── 5) 초필살 ──
    if (me.gauge >= M.GAUGE_MAX) {
      if (!ai.superRolled) {
        ai.superRolled = true;
        ai.superGo = rng.next() < cfg.superUse;
      }
      const sup = M.superOf(def);
      const ranged = sup.type === 'projectile' || sup.type === 'eraser' || sup.type === 'trap';
      if (ai.superGo && (ranged || dist < 160)) { this.press(ai, 'su'); ai.superRolled = false; return this.output(ai); }
    } else ai.superRolled = false;

    // ── 6) 운영 판단 (반응 지연 주기) ──
    ai.thinkT -= dt;
    if (ai.thinkT > 0) return this.output(ai);
    ai.thinkT = cfg.react * 0.7 + rng.next() * 0.15;

    const reachHP = M.MOVES.hp.reach * def.range;
    const sp = def.sp1;
    if (dist > reachHP * 1.5) {
      if (sp && (sp.type === 'projectile' || sp.type === 'trap') && dist > 200 && ai.cool.sp <= 0 && rng.next() < 0.35) {
        ai.cool.sp = 2.2; ai.stats.specials++; this.press(ai, 'sp1'); return this.output(ai);
      }
      if (def.sp2 && def.sp2.type === 'teleport' && ai.cool.tele <= 0 && rng.next() < 0.10) {
        ai.cool.tele = 4; ai.stats.specials++; this.press(ai, 'sp2'); return this.output(ai);
      }
      if (def.sp2 && def.sp2.type === 'wall' && ai.cool.wall <= 0 && rng.next() < 0.08) {
        ai.cool.wall = 5; ai.stats.specials++; this.press(ai, 'sp2'); return this.output(ai);
      }
      if (def.sp3 && ai.cool.eraser <= 0 && dist < 460 && rng.next() < 0.07) {
        ai.cool.eraser = 7; ai.stats.specials++; this.press(ai, 'sp3'); return this.output(ai);
      }
      if (sp && ['dash', 'spin', 'dive', 'chain'].includes(sp.type) && dist < 320 && ai.cool.sp <= 0 && rng.next() < 0.18) {
        ai.cool.sp = 2.5; ai.stats.specials++; this.press(ai, 'sp1'); return this.output(ai);
      }
      if (ai.cool.jump <= 0 && rng.next() < (def.jumpRate || 0.05)) {
        ai.cool.jump = 1.2;
        this.press(ai, 'up', 0.06); this.press(ai, fwdKey, 0.5);
        this.press(ai, 'hp', 0.05);   // 공중에서 눌리도록 다음 판단 전에 한 번 더
        ai.airAttack = true;
        return this.output(ai);
      }
      this.press(ai, fwdKey, ai.thinkT + 0.02);
      return this.output(ai);
    }

    // 사거리 안
    const r = rng.next();
    if (r < 0.08) { this.press(ai, backKey, 0.25); return this.output(ai); }
    const grabReach = M.MOVES.grab.reach;
    const opts = [
      ['lp', 0.34], ['clp', 0.14], ['hp', 0.20], ['chp', 0.10],
      ['grab', !def.noGrab && dist < grabReach ? 0.12 : 0],
      ['sp1', sp && ai.cool.sp <= 0 && ['spin', 'dash', 'chain', 'push', 'cmdgrab', 'rising'].includes(sp.type) ? 0.10 : 0],
      ['walk', dist > M.MOVES.lp.reach * def.range ? 0.25 : 0.04],
    ];
    const total = opts.reduce((a, o2) => a + o2[1], 0);
    let pick = rng.next() * total, choice = 'lp';
    for (const [k, w] of opts) { if ((pick -= w) <= 0) { choice = k; break; } }
    switch (choice) {
      case 'clp': this.press(ai, 'down', 0.12); this.press(ai, 'lp'); break;
      case 'chp': this.press(ai, 'down', 0.18); this.press(ai, 'hp'); break;
      case 'grab': this.press(ai, 'grab'); break;
      case 'sp1': ai.cool.sp = 2.0; ai.stats.specials++; this.press(ai, 'sp1'); break;
      case 'walk': this.press(ai, fwdKey, 0.2); break;
      default: this.press(ai, choice);
    }
    return this.output(ai);
  },

  output(ai) {
    const inp = {};
    for (const k of KEYS) if (ai.hold[k] > 0) inp[k] = true;
    return inp;
  },
};
