// logic.js — 삼국전기식 무기 벨트스크롤: 모구드래곤 엔진 + 무기 리치·무쌍기·궁수 화살
const M = window.MSG;

const PSPD = 96, ZSPD = 64;
const JUMP_V = 250, GRAV = 900;
const HIT_X0 = 4, HIT_X1 = 46, HIT_Z = 16;   // 무기 리치 (맨주먹보다 김)
const MUSOU_R = 78, MUSOU_DMG = 22, MUSOU_COST = 10, MUSOU_CD = 2.2;
const ARROW_V = 175;
const COMBO_WIN = 0.9;

function mkFighter(kind, opt) {
  return Object.assign({
    kind, x: 0, z: 40, jy: 0, vy: 0, face: 1,
    hp: 100, maxHp: 100, spd: PSPD, dmg: 8, w: 16,
    state: 'idle', stT: 0, combo: 0, comboT: 99, atkCd: 0, hitDone: false,
    iv: 0, reviveT: 0, aiCd: 0,
  }, opt);
}

M.Logic = {
  create(mission) {
    const stage = M.makeStage(mission);
    const st = {
      stage, mission, phase: 'play', t: 0, clearT: 0,
      rng: M.makeRng(mission * 733 + 91),
      p: mkFighter('p', { x: 60, z: 40, hp: 100, maxHp: 100, dmg: 8 }),
      b: mkFighter('b', { x: 30, z: 55, hp: 80, maxHp: 80, dmg: 7, spd: 88 }),
      enemies: [], items: [], arrows: [],
      secIdx: 0, waveIdx: -1, go: false, bossSpawned: false,
      score: 0, deaths: 0, buddyDowns: 0, stars: 0, musouCd: 0,
    };
    this._startWave(st, 0, 0);
    return st;
  },

  sec(st) { return st.stage.sections[st.secIdx]; },

  _startWave(st, secIdx, waveIdx) {
    const sec = st.stage.sections[secIdx];
    const wave = sec.waves[waveIdx];
    if (!wave || wave.length === 0) return false;
    for (const w of wave) {
      const E = M.ETYPES[w.type];
      st.enemies.push(mkFighter('e', {
        type: w.type, name: E.name,
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
      type: 'boss', name: B.name, boss: true, base: B.base,
      x: this.sec(st).x1 - 60, z: 40,
      hp: B.hp, maxHp: B.hp, spd: B.spd, dmg: B.dmg, w: B.w, baseAtkCd: B.atkCd, score: 1000,
    }));
    st.bossSpawned = true;
  },

  alive(f) { return f.state !== 'dead' && f.hp > 0; },

  // 공격 히트 적용: att의 전방 박스에 있는 상대들
  _applyHit(st, att, targets, ev, opts) {
    let hit = false;
    for (const t of targets) {
      if (!this.alive(t) || t.state === 'down' || t.iv > 0) continue;
      const dx = (t.x - att.x) * att.face;
      if (dx < HIT_X0 || dx > HIT_X1 + (att.w - 16)) continue;
      if (Math.abs(t.z - att.z) > HIT_Z) continue;
      if (Math.abs(t.jy - att.jy) > 44) continue;
      t.hp -= opts.dmg;
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
    // 점프 물리
    if (f.jy > 0 || f.vy > 0) {
      f.jy += f.vy * dt;
      f.vy -= GRAV * dt;
      if (f.jy <= 0) { f.jy = 0; f.vy = 0; }
    }
    // 상태 종료
    if (f.state === 'atk' && f.stT > 0.28) { f.state = 'idle'; }
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
    f.combo = f.jy > 0 ? 0 : (f.combo % 3) + 1;    // 공중은 점프킥 (콤보 별도)
    f.comboT = 0;
    f.atkCd = f.jy > 0 ? 0.5 : 0.3;
    return true;
  },

  // 공격 판정 프레임 처리 (stT 0.1 통과 시 1회)
  _atkFrame(st, f, targets, ev) {
    if (f.state !== 'atk' || f.hitDone || f.stT < 0.1) return;
    f.hitDone = true;
    const jump = f.jy > 0;
    const third = f.combo === 3;
    const dmg = jump ? 12 : third ? 13 : f.dmg;
    this._applyHit(st, f, targets, ev, { dmg, kd: jump || third });
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;
    const sec = this.sec(st);
    const p = st.p, b = st.b;

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
      // 전진 게이트: 구간 클리어 전에는 x1 - 20 까지만
      const maxX = st.go || st.secIdx >= 3 ? st.stage.length - 14 : sec.x1 - 20;
      p.x = Math.max(14, Math.min(maxX, p.x));
      if (input.jump && p.jy === 0) { p.vy = JUMP_V; ev.push({ type: 'jump' }); }
      if (input.atk && this._attack(st, p)) ev.push({ type: 'swing', combo: p.combo, air: p.jy > 0 });
      // 무쌍기: HP 소모 광역 베기 (시전 무적)
      if (st.musouCd > 0) st.musouCd -= dt;
      if (input.special && st.musouCd <= 0 && p.hp > MUSOU_COST + 2 && p.jy === 0 && p.state !== 'atk') {
        st.musouCd = MUSOU_CD;
        p.hp -= MUSOU_COST;
        p.iv = Math.max(p.iv, 0.8);
        p.state = 'atk'; p.stT = 0; p.hitDone = true;   // 일반 판정과 분리
        let hitN = 0;
        for (const e of st.enemies) {
          if (!this.alive(e) || e.state === 'down' || e.state === 'dead') continue;
          if (Math.abs(e.x - p.x) < MUSOU_R && Math.abs(e.z - p.z) < 30) {
            e.hp -= MUSOU_DMG;
            e.state = 'down'; e.stT = 0; e.iv = 0.9;
            e.x += Math.sign(e.x - p.x || 1) * 30;
            hitN++;
          }
        }
        ev.push({ type: 'musou', n: hitN, x: p.x, z: p.z });
      }
    }
    this._atkFrame(st, p, st.enemies, ev);

    // ── 동료 꼬꼬 (AI) ──
    this._updateFighter(st, b, dt);
    if (b.state === 'dead' || (b.state === 'down' && b.hp <= 0)) {
      b.reviveT += dt;
      if (b.reviveT > 6) {
        b.hp = Math.round(b.maxHp * 0.6); b.state = 'idle'; b.iv = 1.5; b.reviveT = 0;
        b.x = p.x - 26; b.z = Math.min(M.Z_MAX, p.z + 12);
        ev.push({ type: 'buddyup' });
      }
    } else if (this.alive(b) && b.state !== 'hurt' && b.state !== 'down') {
      const foes = st.enemies.filter((e) => this.alive(e));
      let tgt = null, bd = 1e9;
      for (const e of foes) {
        const d = Math.abs(e.x - b.x) + Math.abs(e.z - b.z) * 2;
        if (d < bd) { bd = d; tgt = e; }
      }
      if (tgt) {
        const dx = tgt.x - b.x, dz = tgt.z - b.z;
        b.face = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) > 30 || Math.abs(dz) > 8) {
          if (b.state !== 'atk') {
            b.state = 'walk';
            b.x += Math.sign(dx) * Math.min(b.spd * dt, Math.max(0, Math.abs(dx) - 28));
            b.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, b.z + Math.sign(dz) * Math.min(ZSPD * dt, Math.abs(dz))));
          }
        } else if (this._attack(st, b)) ev.push({ type: 'swing', buddy: true });
      } else {
        // 적 없음 — 플레이어 곁으로
        const hx = p.x - 30, hz = Math.min(M.Z_MAX, p.z + 10);
        if (Math.abs(b.x - hx) > 8) { b.state = 'walk'; b.x += Math.sign(hx - b.x) * b.spd * 0.8 * dt; }
        else b.state = 'idle';
        b.z += Math.sign(hz - b.z) * Math.min(ZSPD * dt, Math.abs(hz - b.z));
      }
      b.x = Math.max(14, Math.min(st.stage.length - 14, b.x));
    }
    this._atkFrame(st, b, st.enemies, ev);

    // ── 악당 ──
    for (const e of st.enemies) {
      this._updateFighter(st, e, dt);
      if (!this.alive(e) || e.state === 'hurt' || e.state === 'down') continue;
      const tgts = [p, b].filter((f) => this.alive(f) && f.state !== 'down');
      if (tgts.length === 0) continue;
      let tgt = tgts[0], bd = 1e9;
      for (const f of tgts) {
        const d = Math.abs(f.x - e.x) + Math.abs(f.z - e.z) * 2;
        if (d < bd) { bd = d; tgt = f; }
      }
      const dx = tgt.x - e.x, dz = tgt.z - e.z;
      e.face = dx >= 0 ? 1 : -1;
      const E2 = M.ETYPES[e.type];
      const ranged = (E2 && E2.ranged) || (e.boss && e.base === 'archer');
      if (ranged) {
        // 궁수: 거리 유지(110~170) + 깊이 맞추고 활 쏘기
        const adx = Math.abs(dx);
        if (e.state !== 'atk') {
          if (adx < 100) { e.state = 'walk'; e.x -= Math.sign(dx) * e.spd * dt; }
          else if (adx > 180) { e.state = 'walk'; e.x += Math.sign(dx) * e.spd * dt; }
          else if (Math.abs(dz) > 5) { e.state = 'walk'; e.z = Math.max(M.Z_MIN, Math.min(M.Z_MAX, e.z + Math.sign(dz) * e.spd * 0.7 * dt)); }
          else e.state = 'idle';
        }
        if (e.atkCd <= 0 && Math.abs(dz) < 10 && adx >= 60) {
          e.atkCd = e.baseAtkCd;
          e.state = 'atk'; e.stT = 0; e.hitDone = true;   // 근접 판정 없음
          st.arrows.push({ x: e.x + e.face * 14, z: e.z, vx: e.face * ARROW_V, dmg: e.dmg, ttl: 3 });
          ev.push({ type: 'arrow' });
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
      this._atkFrame(st, e, [p, b], ev);
    }

    // 사망 정리 + 드롭
    for (const e of st.enemies) {
      if (e.state === 'dead' && !e.counted) {
        e.counted = true;
        st.score += e.score || 100;
        ev.push({ type: 'edown', name: e.name, score: e.score || 100 });
        if (st.rng.chance(st.stage.churP)) {
          st.items.push({ x: e.x, z: e.z, ttl: 10 });
          ev.push({ type: 'chur' });
        }
      }
    }
    st.enemies = st.enemies.filter((e) => !(e.state === 'dead' && e.stT > 1.6));

    // 플레이어 사망 → 컨티뉴 (down 1초 경과 또는 dead 전환 시)
    if (p.hp <= 0 && (p.state === 'dead' || (p.state === 'down' && p.stT > 1.0)) && st.phase === 'play') {
      st.deaths++;
      st.phase = 'over'; st.clearT = 0;
      ev.push({ type: 'over' });
      return ev;
    }
    // 꼬꼬 다운 카운트
    if (b.hp <= 0 && !b.downCounted) { b.downCounted = true; st.buddyDowns++; ev.push({ type: 'buddydown' }); }
    if (b.hp > 0) b.downCounted = false;

    // ── 화살 ──
    for (const ar of st.arrows) {
      ar.ttl -= dt;
      ar.x += ar.vx * dt;
      for (const f of [p, b]) {
        if (!this.alive(f) || f.iv > 0 || f.state === 'down' || f.jy > 24) continue;
        if (Math.abs(f.x - ar.x) < 12 && Math.abs(f.z - ar.z) < 9) {
          ar.ttl = 0;
          f.hp -= ar.dmg;
          f.state = 'hurt'; f.stT = 0; f.iv = 0.5;
          ev.push({ type: 'arrowhit', who: f.kind });
          if (f.hp <= 0) { f.state = 'down'; f.stT = 0; }
          break;
        }
      }
    }
    st.arrows = st.arrows.filter((a) => a.ttl > 0 && a.x > -60 && a.x < st.stage.length + 60);

    // ── 아이템 ──
    for (const it of st.items) {
      it.ttl -= dt;
      if (Math.abs(p.x - it.x) < 20 && Math.abs(p.z - it.z) < 14 && p.jy === 0) {
        it.ttl = 0;
        p.hp = Math.min(p.maxHp, p.hp + 30);
        ev.push({ type: 'pickup' });
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
        // 보스 격파 → 미션 클리어
        st.stars = st.deaths === 0 ? (st.buddyDowns === 0 ? 3 : 2) : 1;
        st.score += 2000;
        st.phase = 'clear'; st.clearT = 0;
        ev.push({ type: 'clear', stars: st.stars });
      } else if (st.waveIdx + 1 < sec2.waves.length && sec2.waves[st.waveIdx + 1].length > 0) {
        this._startWave(st, st.secIdx, st.waveIdx + 1);
        ev.push({ type: 'wave' });
      } else if (!st.go) {
        st.go = true;
        ev.push({ type: 'go' });
      }
    }
    // 다음 구간 진입
    if (st.go && p.x > sec.x1 - 24 && st.secIdx < 3) {
      st.secIdx++;
      st.go = false;
      this._startWave(st, st.secIdx, 0);
      ev.push({ type: 'section', idx: st.secIdx });
    }
    return ev;
  },

  // 컨티뉴: 현재 구간 재시작 (사망 수 유지)
  respawn(st) {
    st.enemies = [];
    st.items = [];
    st.p.hp = st.p.maxHp; st.p.state = 'idle'; st.p.iv = 1.5;
    st.p.x = this.sec(st).x0 + 40; st.p.z = 40; st.p.jy = 0; st.p.vy = 0;
    st.b.hp = st.b.maxHp; st.b.state = 'idle'; st.b.iv = 1.5; st.b.reviveT = 0;
    st.b.x = st.p.x - 26; st.b.z = 52;
    st.go = false; st.bossSpawned = false;
    this._startWave(st, st.secIdx, 0);
    st.phase = 'play';
  },
};
