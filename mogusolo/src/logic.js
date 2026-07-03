// logic.js — 벨트스크롤 전투 + 레벨업·MP·QWER 스킬·그림자 병사 (DOM 무의존)
const M = window.MSL;

const PSPD = 96, ZSPD = 64;
const JUMP_V = 250, GRAV = 900;
const HIT_X0 = 4, HIT_X1 = 44, HIT_Z = 16;
const SHOT_V = 175;
const COMBO_WIN = 0.9;

// 스킬 정의: 언락 레벨 / MP / 쿨다운
const SKILLS = {
  q: { name: '절단',          lv: 2, mp: 10, cd: 1.2 },
  w: { name: '은신',          lv: 4, mp: 12, cd: 6.0 },
  e: { name: '그림자 추출',   lv: 6, mp: 15, cd: 1.0 },
  r: { name: '지배자의 권능', lv: 9, mp: 25, cd: 3.0 },
};
const RULER_R = 90, RULER_DMG = 24;
const SHADOW_MAX = 3, EXTRACT_R = 80;

function mkFighter(kind, opt) {
  return Object.assign({
    kind, x: 0, z: 40, jy: 0, vy: 0, face: 1,
    hp: 100, maxHp: 100, spd: PSPD, dmg: 8, w: 16,
    state: 'idle', stT: 0, combo: 0, comboT: 99, atkCd: 0, hitDone: false,
    iv: 0, reviveT: 0,
  }, opt);
}

M.Logic = {
  LV_MAX: 12,
  SKILLS,
  SHADOW_MAX,
  expNeed(lv) { return 50 + (lv - 1) * 30; },
  atkMul(lv) { return 1 + 0.05 * (lv - 1); },
  maxMp(lv) { return 40 + 4 * (lv - 1); },

  _gainExp(st, n, ev) {
    st.exp += n;
    if (st.lv >= this.LV_MAX) return;
    st.expInto += n;
    while (st.lv < this.LV_MAX && st.expInto >= this.expNeed(st.lv)) {
      st.expInto -= this.expNeed(st.lv);
      st.lv++;
      st.p.maxHp = 100 + 6 * (st.lv - 1);
      st.p.hp = Math.min(st.p.maxHp, st.p.hp + 20);
      st.mp = Math.min(this.maxMp(st.lv), st.mp + 15);
      if (st.b) {
        st.b.maxHp = 80 + 5 * (st.lv - 1);
        if (st.b.hp > 0) st.b.hp = Math.min(st.b.maxHp, st.b.hp + 12);
      }
      const unlocked = Object.keys(SKILLS).find((k) => SKILLS[k].lv === st.lv);
      ev.push({ type: 'levelup', lv: st.lv, skill: unlocked ? SKILLS[unlocked].name : null, key: unlocked || null });
    }
  },

  // gear: { fang: 공격+2, armor: 받는 피해 -2 }
  create(mission, exp0, gear) {
    const stage = M.makeStage(mission);
    const st = {
      stage, mission, phase: 'play', t: 0, clearT: 0,
      rng: M.makeRng(mission * 733 + 91),
      gear: Object.assign({ fang: false, armor: false }, gear),
      p: mkFighter('p', { x: 60, z: 40, hp: 100, maxHp: 100, dmg: 8 }),
      b: mission >= 2 ? mkFighter('b', { x: 30, z: 55, hp: 80, maxHp: 80, dmg: 7, spd: 88 }) : null,
      shadows: [],
      enemies: [], items: [], shots: [], bolts: [],
      secIdx: 0, waveIdx: -1, go: false, bossSpawned: false,
      score: 0, deaths: 0, stars: 0,
      exp: 0, lv: 1, expInto: 0,
      mp: 40, stealth: 0,
      skillCd: { q: 0, w: 0, e: 0, r: 0 },
    };
    if (st.gear.fang) st.p.dmg += 2;
    if (exp0 > 0) {
      this._gainExp(st, exp0, []);
      st.p.hp = st.p.maxHp;
      if (st.b) st.b.hp = st.b.maxHp;
      st.mp = this.maxMp(st.lv);
    }
    this._startWave(st, 0, 0);
    return st;
  },

  sec(st) { return st.stage.sections[st.secIdx]; },
  allies(st) { return [st.p, ...(st.b ? [st.b] : []), ...st.shadows]; },
  skillReady(st, k) {
    return st.lv >= SKILLS[k].lv && st.skillCd[k] <= 0 && st.mp >= SKILLS[k].mp;
  },

  _startWave(st, secIdx, waveIdx) {
    const sec = st.stage.sections[secIdx];
    const wave = sec.waves[waveIdx];
    if (!wave || wave.length === 0) return false;
    for (const w of wave) {
      const E = M.ETYPES[w.type];
      st.enemies.push(mkFighter('e', {
        type: w.type, name: E.name, look: E.look, ranged: !!E.ranged, shot: E.shot,
        x: w.side > 0 ? sec.x1 + 30 : Math.max(10, sec.x0 - 30),
        z: w.z, hp: Math.round(E.hp * w.hpMul), maxHp: Math.round(E.hp * w.hpMul),
        spd: E.spd, dmg: E.dmg, w: E.w, baseAtkCd: E.atkCd, score: E.score,
      }));
    }
    st.waveIdx = waveIdx;
    return true;
  },

  _spawnBoss(st) {
    const B = this.sec(st).boss;
    st.enemies.push(mkFighter('e', {
      type: 'boss', name: B.name, look: B.look, boss: true, base: B.base, shot: B.shot,
      x: this.sec(st).x1 - 60, z: 40,
      hp: B.hp, maxHp: B.hp, spd: B.spd, dmg: B.dmg, w: B.w, baseAtkCd: B.atkCd, score: 1000,
      boltCd: 2.2, dashCd: 3,
    }));
    st.bossSpawned = true;
  },

  alive(f) { return !!f && f.state !== 'dead' && f.hp > 0; },

  _dmgTaken(st, f, dmg) {
    // 파수견의 갑주: 아군이 받는 피해 -2 (최소 1)
    if ((f.kind === 'p' || f.kind === 'b') && st.gear.armor) return Math.max(1, dmg - 2);
    return dmg;
  },

  _applyHit(st, att, targets, ev, opts) {
    let hit = false;
    for (const t of targets) {
      if (!this.alive(t) || t.state === 'down' || t.iv > 0) continue;
      if (t.kind === 'p' && st.stealth > 0) continue;          // 은신 중 피격 없음
      const dx = (t.x - att.x) * att.face;
      const reach = (opts.reach || HIT_X1) + (att.w - 16);
      if (dx < HIT_X0 || dx > reach) continue;
      if (Math.abs(t.z - att.z) > HIT_Z) continue;
      if (Math.abs(t.jy - att.jy) > 44) continue;
      t.hp -= this._dmgTaken(st, t, opts.dmg);
      hit = true;
      ev.push({ type: 'hit', x: t.x, z: t.z, kd: !!opts.kd });
      if (t.hp <= 0 || opts.kd) {
        t.state = 'down'; t.stT = 0; t.iv = 0.9;
        t.x += att.face * 22;
        if (opts.kd) ev.push({ type: 'kd' });
      } else {
        t.state = 'hurt'; t.stT = 0;
        t.x += att.face * 7;
      }
    }
    return hit;
  },

  _updateFighter(st, f, dt) {
    f.stT += dt;
    if (f.atkCd > 0) f.atkCd -= dt;
    if (f.iv > 0) f.iv -= dt;
    f.comboT += dt;
    if (f.jy > 0 || f.vy > 0) {
      f.jy += f.vy * dt;
      f.vy -= GRAV * dt;
      if (f.jy <= 0) { f.jy = 0; f.vy = 0; }
    }
    if (f.state === 'atk' && f.stT > 0.28) f.state = 'idle';
    if (f.state === 'hurt' && f.stT > 0.32) f.state = 'idle';
    if (f.state === 'down' && f.stT > 1.0) {
      if (f.hp <= 0) f.state = 'dead';
      else { f.state = 'idle'; f.iv = 0.8; }
    }
  },

  _attack(st, f) {
    if (f.state === 'atk' || f.state === 'hurt' || f.state === 'down' || f.state === 'dead') return false;
    if (f.atkCd > 0) return false;
    if (f.comboT > COMBO_WIN) f.combo = 0;
    f.state = 'atk'; f.stT = 0; f.hitDone = false;
    f.combo = f.jy > 0 ? 0 : (f.combo % 3) + 1;
    f.comboT = 0;
    f.atkCd = f.jy > 0 ? 0.5 : 0.3;
    return true;
  },

  _atkFrame(st, f, targets, ev) {
    if (f.state !== 'atk' || f.hitDone || f.stT < 0.1) return;
    f.hitDone = true;
    const jump = f.jy > 0;
    const third = f.combo === 3;
    const isAlly = f.kind === 'p' || f.kind === 'b' || f.kind === 's';
    const lvMul = isAlly ? this.atkMul(st.lv) : 1;
    let dmg = Math.round((jump ? 12 : third ? 13 : f.dmg) * lvMul);
    let kd = jump || third;
    // 은신 기습: 은신 중 첫 공격 2배 + 다운
    if (f.kind === 'p' && st.stealth > 0) {
      dmg *= 2; kd = true;
      st.stealth = 0;
      ev.push({ type: 'ambush' });
    }
    this._applyHit(st, f, targets, ev, { dmg, kd });
  },

  // 동료·그림자 공용 AI (가장 가까운 적 추적·공격, 없으면 anchor 곁으로)
  _allyAI(st, f, dt, anchorX, anchorZ, ev) {
    const foes = st.enemies.filter((e) => this.alive(e));
    let tgt = null, bd = 1e9;
    for (const e of foes) {
      const d = Math.abs(e.x - f.x) + Math.abs(e.z - f.z) * 2;
      if (d < bd) { bd = d; tgt = e; }
    }
    if (tgt) {
      const dx = tgt.x - f.x, dz = tgt.z - f.z;
      f.face = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > 30 || Math.abs(dz) > 8) {
        if (f.state !== 'atk') {
          f.state = 'walk';
          f.x += Math.sign(dx) * Math.min(f.spd * dt, Math.max(0, Math.abs(dx) - 28));
          f.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, f.z + Math.sign(dz) * Math.min(ZSPD * dt, Math.abs(dz))));
        }
      } else if (this._attack(st, f)) ev.push({ type: 'swing', ally: f.kind });
    } else {
      if (Math.abs(f.x - anchorX) > 8) { f.state = 'walk'; f.x += Math.sign(anchorX - f.x) * f.spd * 0.8 * dt; }
      else f.state = 'idle';
      f.z += Math.sign(anchorZ - f.z) * Math.min(ZSPD * dt, Math.abs(anchorZ - f.z));
    }
    f.x = Math.max(14, Math.min(st.stage.length - 14, f.x));
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;
    const sec = this.sec(st);
    const p = st.p, b = st.b;

    // MP 자연 회복 + 쿨다운·은신 타이머
    st.mp = Math.min(this.maxMp(st.lv), st.mp + 2 * dt);
    for (const k of ['q', 'w', 'e', 'r']) if (st.skillCd[k] > 0) st.skillCd[k] -= dt;
    if (st.stealth > 0) st.stealth -= dt;

    // ── 플레이어 ──
    this._updateFighter(st, p, dt);
    if (this.alive(p) && p.state !== 'hurt' && p.state !== 'down') {
      let mx = 0, mz = 0;
      if (input.left) { mx = -1; p.face = -1; }
      if (input.right) { mx = 1; p.face = 1; }
      if (input.up) mz = -1;
      if (input.down) mz = 1;
      if (p.state !== 'atk' && (mx || mz)) {
        p.state = p.jy > 0 ? p.state : 'walk';
        p.x += mx * PSPD * dt;
        p.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, p.z + mz * ZSPD * dt));
      } else if (p.state === 'walk') p.state = 'idle';
      const maxX = st.go || st.secIdx >= 3 ? st.stage.length - 14 : sec.x1 - 20;
      p.x = Math.max(14, Math.min(maxX, p.x));
      if (input.jump && p.jy === 0) { p.vy = JUMP_V; ev.push({ type: 'jump' }); }
      if (input.atk && this._attack(st, p)) ev.push({ type: 'swing', combo: p.combo, air: p.jy > 0 });

      // ── QWER 스킬 ──
      if (input.q && this.skillReady(st, 'q') && p.jy === 0 && p.state !== 'atk') {
        st.mp -= SKILLS.q.mp; st.skillCd.q = SKILLS.q.cd;
        p.state = 'atk'; p.stT = 0; p.hitDone = true; p.comboT = 99;
        const dmg = Math.round(p.dmg * 2.5 * this.atkMul(st.lv) * (st.stealth > 0 ? 2 : 1));
        if (st.stealth > 0) { st.stealth = 0; ev.push({ type: 'ambush' }); }
        this._applyHit(st, p, st.enemies, ev, { dmg, kd: true, reach: HIT_X1 + 12 });
        ev.push({ type: 'slash', x: p.x, z: p.z, face: p.face });
      }
      if (input.w && this.skillReady(st, 'w') && st.stealth <= 0) {
        st.mp -= SKILLS.w.mp; st.skillCd.w = SKILLS.w.cd;
        st.stealth = 3.0;
        ev.push({ type: 'stealth' });
      }
      if (input.e && this.skillReady(st, 'e')) {
        // 근처 시체(비보스)를 그림자 병사로
        let corpse = null, bd = 1e9;
        for (const e2 of st.enemies) {
          if (e2.state !== 'dead' || e2.boss || e2.extracted) continue;
          const d = Math.abs(e2.x - p.x) + Math.abs(e2.z - p.z) * 2;
          if (d < EXTRACT_R && d < bd) { bd = d; corpse = e2; }
        }
        if (!corpse) {
          ev.push({ type: 'extractfail', reason: 'nocorpse' });
        } else if (st.shadows.length >= SHADOW_MAX) {
          ev.push({ type: 'extractfail', reason: 'full' });
        } else {
          st.mp -= SKILLS.e.mp; st.skillCd.e = SKILLS.e.cd;
          corpse.extracted = true; corpse.stT = 99;      // 시체 소멸
          const E = M.ETYPES[corpse.type];
          st.shadows.push(mkFighter('s', {
            type: corpse.type, look: corpse.look, name: '그림자 ' + corpse.name,
            x: corpse.x, z: corpse.z,
            hp: Math.round(corpse.maxHp * 0.7), maxHp: Math.round(corpse.maxHp * 0.7),
            spd: E.spd + 10, dmg: Math.max(5, Math.round(E.dmg * 0.7)), w: E.w,
            iv: 0.8,
          }));
          ev.push({ type: 'extract', x: corpse.x, z: corpse.z, n: st.shadows.length });
        }
      }
      if (input.r && this.skillReady(st, 'r') && p.jy === 0 && p.state !== 'atk') {
        st.mp -= SKILLS.r.mp; st.skillCd.r = SKILLS.r.cd;
        p.iv = Math.max(p.iv, 0.8);
        p.state = 'atk'; p.stT = 0; p.hitDone = true; p.comboT = 99;
        let hitN = 0;
        for (const e2 of st.enemies) {
          if (!this.alive(e2) || e2.state === 'down' || e2.state === 'dead') continue;
          if (Math.abs(e2.x - p.x) < RULER_R && Math.abs(e2.z - p.z) < 30) {
            e2.hp -= Math.round(RULER_DMG * this.atkMul(st.lv));
            e2.state = 'down'; e2.stT = 0; e2.iv = 0.9;
            e2.x += Math.sign(e2.x - p.x || 1) * 30;
            hitN++;
          }
        }
        ev.push({ type: 'ruler', n: hitN, x: p.x, z: p.z });
      }
    }
    this._atkFrame(st, p, st.enemies, ev);

    // ── 동료 꼬꼬 (M2+) ──
    if (b) {
      this._updateFighter(st, b, dt);
      if (b.state === 'dead' || (b.state === 'down' && b.hp <= 0)) {
        b.reviveT += dt;
        if (b.reviveT > 6) {
          b.hp = Math.round(b.maxHp * 0.6); b.state = 'idle'; b.iv = 1.5; b.reviveT = 0;
          b.x = p.x - 26; b.z = Math.min(M.Z_MAX, p.z + 12);
          ev.push({ type: 'buddyup' });
        }
      } else if (this.alive(b) && b.state !== 'hurt' && b.state !== 'down') {
        this._allyAI(st, b, dt, p.x - 30, Math.min(M.Z_MAX, p.z + 10), ev);
      }
      this._atkFrame(st, b, st.enemies, ev);
    }

    // ── 그림자 병사 ──
    for (const s of st.shadows) {
      this._updateFighter(st, s, dt);
      if (this.alive(s) && s.state !== 'hurt' && s.state !== 'down') {
        this._allyAI(st, s, dt, p.x + 26, Math.max(M.Z_MIN, p.z - 10), ev);
      }
      this._atkFrame(st, s, st.enemies, ev);
    }
    const nShadow = st.shadows.length;
    st.shadows = st.shadows.filter((s) => !(s.state === 'dead' && s.stT > 1.2));
    if (st.shadows.length < nShadow) ev.push({ type: 'shadowdown' });

    // ── 악당 ──
    for (const e of st.enemies) {
      this._updateFighter(st, e, dt);
      if (!this.alive(e) || e.state === 'hurt' || e.state === 'down') continue;
      // 은신 중 플레이어는 타겟 제외
      const tgts = this.allies(st).filter((f) => this.alive(f) && f.state !== 'down' && !(f.kind === 'p' && st.stealth > 0));
      if (tgts.length === 0) { e.state = 'idle'; continue; }
      let tgt = tgts[0], bd = 1e9;
      for (const f of tgts) {
        const d = Math.abs(f.x - e.x) + Math.abs(f.z - e.z) * 2;
        if (d < bd) { bd = d; tgt = f; }
      }
      const dx = tgt.x - e.x, dz = tgt.z - e.z;
      e.face = dx >= 0 ? 1 : -1;

      if (e.boss && e.base === 'baran') {
        // 악마왕 바란: 중거리 유지 + 벼락 소환 + 돌진, HP 50% 이하 2페이즈 가속
        const ph2 = e.hp < e.maxHp * 0.5;
        const spd = e.spd * (ph2 ? 1.3 : 1);
        e.boltCd -= dt * (ph2 ? 1.5 : 1);
        e.dashCd -= dt;
        const adx = Math.abs(dx);
        if (e.dashing) {
          e.x += e.face * spd * 2.6 * dt;
          e.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, e.z + Math.sign(dz) * ZSPD * dt));
          if (adx < 34) {
            e.dashing = false;
            if (e.atkCd <= 0 && e.state !== 'atk') { e.state = 'atk'; e.stT = 0; e.hitDone = false; e.atkCd = e.baseAtkCd * (ph2 ? 0.6 : 1); ev.push({ type: 'eswing' }); }
          }
        } else if (e.boltCd <= 0 && adx > 60) {
          e.boltCd = ph2 ? 2.2 : 3.4;
          st.bolts.push({ x: tgt.x, z: tgt.z, t: 0.6 });
          ev.push({ type: 'boltwarn', x: tgt.x, z: tgt.z });
        } else if (e.dashCd <= 0 && adx > 90) {
          e.dashCd = ph2 ? 2.6 : 4;
          e.dashing = true;
          ev.push({ type: 'bossdash' });
        } else if (adx > 120) {
          if (e.state !== 'atk') { e.state = 'walk'; e.x += Math.sign(dx) * spd * dt; }
        } else if (adx < 40 && Math.abs(dz) < 10) {
          if (e.atkCd <= 0 && e.state !== 'atk') { e.state = 'atk'; e.stT = 0; e.hitDone = false; e.atkCd = e.baseAtkCd * (ph2 ? 0.6 : 1); ev.push({ type: 'eswing' }); }
        } else if (e.state !== 'atk') {
          e.state = 'walk';
          e.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, e.z + Math.sign(dz) * spd * 0.7 * dt));
          e.x += Math.sign(dx) * spd * 0.4 * dt;
        }
      } else if (e.ranged || (e.boss && e.base === 'ranged')) {
        // 원거리: 거리 유지 + 투사체
        const adx = Math.abs(dx);
        if (e.state !== 'atk') {
          if (adx < 100) { e.state = 'walk'; e.x -= Math.sign(dx) * e.spd * dt; }
          else if (adx > 180) { e.state = 'walk'; e.x += Math.sign(dx) * e.spd * dt; }
          else if (Math.abs(dz) > 5) { e.state = 'walk'; e.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, e.z + Math.sign(dz) * e.spd * 0.7 * dt)); }
          else e.state = 'idle';
        }
        if (e.atkCd <= 0 && Math.abs(dz) < 10 && adx >= 60) {
          e.atkCd = e.baseAtkCd;
          e.state = 'atk'; e.stT = 0; e.hitDone = true;
          st.shots.push({ x: e.x + e.face * 14, z: e.z, vx: e.face * SHOT_V, dmg: e.dmg, ttl: 3, color: e.shot || '#b8e04a' });
          ev.push({ type: 'shot' });
        }
      } else if (Math.abs(dx) > 32 || Math.abs(dz) > 9) {
        if (e.state !== 'atk') {
          e.state = 'walk';
          e.x += Math.sign(dx) * Math.min(e.spd * dt, Math.max(0, Math.abs(dx) - 30));
          e.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, e.z + Math.sign(dz) * Math.min(e.spd * 0.7 * dt, Math.abs(dz))));
        }
      } else if (e.atkCd <= 0 && e.state !== 'atk') {
        e.state = 'atk'; e.stT = 0; e.hitDone = false;
        e.atkCd = e.baseAtkCd;
        ev.push({ type: 'eswing' });
      }
      this._atkFrame(st, e, this.allies(st).filter((f) => !(f.kind === 'p' && st.stealth > 0)), ev);
    }

    // 사망 정리 + 경험치·드롭
    for (const e of st.enemies) {
      if (e.state === 'dead' && !e.counted) {
        e.counted = true;
        st.score += e.score || 100;
        ev.push({ type: 'edown', name: e.name, score: e.score || 100 });
        this._gainExp(st, Math.round((e.score || 100) / 10), ev);
        if (st.rng.chance(st.stage.dropP)) {
          st.items.push({ x: e.x, z: e.z, ttl: 10, kind: st.rng.chance(0.5) ? 'hp' : 'mp' });
          ev.push({ type: 'drop' });
        }
      }
    }
    st.enemies = st.enemies.filter((e) => !(e.state === 'dead' && e.stT > 1.6));

    // 플레이어 사망 → 컨티뉴
    if (p.hp <= 0 && (p.state === 'dead' || (p.state === 'down' && p.stT > 1.0)) && st.phase === 'play') {
      st.deaths++;
      st.phase = 'over'; st.clearT = 0;
      ev.push({ type: 'over' });
      return ev;
    }
    if (b) {
      if (b.hp <= 0 && !b.downCounted) { b.downCounted = true; ev.push({ type: 'buddydown' }); }
      if (b.hp > 0) b.downCounted = false;
    }

    // ── 투사체 (독침·고드름·화염구) ──
    for (const sh of st.shots) {
      sh.ttl -= dt;
      sh.x += sh.vx * dt;
      for (const f of this.allies(st)) {
        if (!this.alive(f) || f.iv > 0 || f.state === 'down' || f.jy > 24) continue;
        if (f.kind === 'p' && st.stealth > 0) continue;
        if (Math.abs(f.x - sh.x) < 12 && Math.abs(f.z - sh.z) < 9) {
          sh.ttl = 0;
          f.hp -= this._dmgTaken(st, f, sh.dmg);
          f.state = 'hurt'; f.stT = 0; f.iv = 0.5;
          ev.push({ type: 'shothit', who: f.kind });
          if (f.hp <= 0) { f.state = 'down'; f.stT = 0; }
          break;
        }
      }
    }
    st.shots = st.shots.filter((a) => a.ttl > 0 && a.x > -60 && a.x < st.stage.length + 60);

    // ── 벼락 (바란) ──
    for (const bo of st.bolts) {
      bo.t -= dt;
      if (bo.t <= 0 && !bo.struck) {
        bo.struck = true;
        ev.push({ type: 'bolt', x: bo.x, z: bo.z });
        for (const f of this.allies(st)) {
          if (!this.alive(f) || f.iv > 0 || f.state === 'down') continue;
          if (f.kind === 'p' && st.stealth > 0) continue;
          if (Math.abs(f.x - bo.x) < 18 && Math.abs(f.z - bo.z) < 12 && f.jy < 30) {
            f.hp -= this._dmgTaken(st, f, 20);
            f.state = 'down'; f.stT = 0; f.iv = 0.8;
            ev.push({ type: 'bolthit', who: f.kind });
          }
        }
      }
    }
    st.bolts = st.bolts.filter((bo) => bo.t > -0.3);

    // ── 물약 ──
    for (const it of st.items) {
      it.ttl -= dt;
      if (Math.abs(p.x - it.x) < 20 && Math.abs(p.z - it.z) < 14 && p.jy === 0) {
        it.ttl = 0;
        if (it.kind === 'hp') p.hp = Math.min(p.maxHp, p.hp + 30);
        else st.mp = Math.min(this.maxMp(st.lv), st.mp + 30);
        ev.push({ type: 'pickup', kind: it.kind });
      }
    }
    st.items = st.items.filter((i) => i.ttl > 0);

    // ── 웨이브·구간 진행 ──
    const liveEnemies = st.enemies.some((e) => this.alive(e));
    if (!liveEnemies && st.phase === 'play') {
      const sec2 = this.sec(st);
      if (sec2.boss && !st.bossSpawned && st.waveIdx >= 0) {
        this._spawnBoss(st);
        ev.push({ type: 'bossintro', name: sec2.boss.name });
      } else if (sec2.boss && st.bossSpawned) {
        st.stars = st.deaths === 0 ? (st.shadows.length >= M.Logic.SHADOW_MAX ? 3 : 2) : 1;
        st.score += 2000;
        st.phase = 'clear'; st.clearT = 0;
        ev.push({ type: 'clear', stars: st.stars, mission: st.mission });
      } else if (st.waveIdx + 1 < sec2.waves.length && sec2.waves[st.waveIdx + 1].length > 0) {
        this._startWave(st, st.secIdx, st.waveIdx + 1);
        ev.push({ type: 'wave' });
      } else if (!st.go) {
        st.go = true;
        ev.push({ type: 'go' });
      }
    }
    if (st.go && p.x > sec.x1 - 24 && st.secIdx < 3) {
      st.secIdx++;
      st.go = false;
      this._startWave(st, st.secIdx, 0);
      ev.push({ type: 'section', idx: st.secIdx });
    }
    return ev;
  },

  // 컨티뉴: 현재 구간 재시작 (경험치 유지, 그림자 해산)
  respawn(st) {
    st.enemies = [];
    st.items = []; st.shots = []; st.bolts = [];
    st.shadows = [];
    st.stealth = 0;
    st.mp = this.maxMp(st.lv);
    st.skillCd = { q: 0, w: 0, e: 0, r: 0 };
    st.p.hp = st.p.maxHp; st.p.state = 'idle'; st.p.iv = 1.5;
    st.p.x = this.sec(st).x0 + 40; st.p.z = 40; st.p.jy = 0; st.p.vy = 0;
    if (st.b) {
      st.b.hp = st.b.maxHp; st.b.state = 'idle'; st.b.iv = 1.5; st.b.reviveT = 0;
      st.b.x = st.p.x - 26; st.b.z = 52;
    }
    st.go = false; st.bossSpawned = false;
    this._startWave(st, st.secIdx, 0);
    st.phase = 'play';
  },
};
