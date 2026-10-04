// logic.js — 벨트스크롤 전투·AI·진행 (DOM 무의존 — node 테스트 가능)
// 원작 규칙: 8방향 이동, 연타 콤보(3타 다운), 마법(MP), 보물상자, 구간 전멸 → 전진, 갈림길, 보스.
const M = window.MDN;

const DEATH_SEC = 1.5;           // 쓰러지는 연출 시간 (이후 컨티뉴 화면)
const ATK_DUR = 0.28, HIT_T = 0.09, COMBO_WIN = 0.55, SKILL_DUR = 0.42;
const Z_TOL = 0.14;              // 깊이 판정 허용치
const HURT_SEC = 0.3, KD_SEC = 1.1;

M.Logic = {
  DEATH_SEC, Z_TOL,

  create(seed, diff, cls) {
    const d = M.DIFFS[diff || M.diff] ? (diff || M.diff) : 'normal';
    const ck = M.CLASSES[cls || M.cls] ? (cls || M.cls) : 'fighter';
    const C = M.CLASSES[ck];
    const st = {
      diff: d, cls: ck, seed: (seed >>> 0) || 19930101,
      t: 0, phase: 'play', endT: 0,
      rng: M.makeRng((seed >>> 0) || 19930101),
      p: { x: 60, z: 0.5, face: 1, hp: C.hp, maxHp: C.hp, mp: 60, atk: C.atk, spd: C.spd, range: C.range,
           state: 'idle', st: 0, combo: 0, comboT: 0, inv: 0, walk: 0, level: 1, exp: 0,
           atkHeld: false, skillHeld: false, hitDone: false, vx: 0, kb: 0 },
      gold: 0, kills: 0, continues: 0, stagesDone: 0, route: [], chests: 0,
      stageKey: null, stage: null, section: 0, sections: 0, camX: 0, gateOpen: false, waveDone: false,
      enemies: [], bullets: [], items: [], props: [], pending: [], nextId: 1, summonT: 0,
    };
    this.loadStage(st, M.FIRST_STAGE);
    return st;
  },

  loadStage(st, key) {
    const S = M.STAGES[key];
    st.stageKey = key; st.stage = S; st.route.push(key);
    st.section = 0; st.sections = S.waves + (S.boss ? 1 : 0);
    st.camX = 0; st.phase = 'play';
    const p = st.p;
    p.x = 60; p.z = 0.5; p.face = 1; p.state = 'idle'; p.st = 0; p.combo = 0; p.inv = 1.0;
    st.enemies = []; st.bullets = []; st.items = []; st.pending = []; st.props = [];
    for (let s = 0; s < S.waves; s++) {                       // 웨이브 구간마다 보물상자 1개
      st.props.push({ id: st.nextId++, kind: 'chest', x: s * M.SEC_W + st.rng.range(150, 420), z: st.rng.range(0.15, 0.85), opened: false, hp: 1 });
    }
    this.startSection(st);
  },

  startSection(st) {
    st.gateOpen = false; st.waveDone = false; st.pending = [];
    const S = st.stage, sec = st.section, base = sec * M.SEC_W;
    if (S.boss && sec === S.waves) {
      st.pending.push({ kind: S.boss, side: 1, z: 0.5, delay: 0.8 });
      st.pending.push({ kind: S.pool[0], side: -1, z: 0.25, delay: 2.5 });
      st.pending.push({ kind: S.pool[1], side: 1, z: 0.8, delay: 3.5 });
    } else {
      st.pending = M.makeWave(st.stageKey, sec, st.diff, st.rng);
    }
    for (const q of st.pending) q.x = base + (q.side > 0 ? M.W + 30 : -30);
  },

  _spawn(st, q) {
    const K = M.ENEMY[q.kind], D = M.DIFFS[st.diff];
    const hp = Math.round(K.hp * D.hpMul);
    st.enemies.push({
      id: st.nextId++, kind: q.kind, x: q.x, z: q.z, face: q.side > 0 ? -1 : 1,
      hp, maxHp: hp, atk: Math.round(K.atk * D.atkMul), spd: K.spd, range: K.range, r: K.r,
      state: 'idle', st: 0, atkCd: 1.2 + st.rng.next(), inv: 0, flash: 0, walk: 0, kb: 0,
      boss: !!K.boss, heavy: !!K.heavy, ranged: !!K.ranged, undead: !!K.undead, wob: st.rng.range(0, 6.28), entered: false,
    });
  },

  // ── 플레이어 피해 ──
  _damagePlayer(st, dmg, fromX, ev, src) {
    const p = st.p;
    if (p.inv > 0 || st.phase !== 'play' || p.state === 'dead') return false;
    p.hp = Math.max(0, p.hp - dmg);
    p.inv = M.INV_SEC; p.state = 'hurt'; p.st = HURT_SEC; p.combo = 0;
    p.kb = (p.x >= fromX ? 1 : -1) * 90;
    ev.push({ type: 'phit', x: p.x, z: p.z, dmg, src });
    if (p.hp <= 0) {
      p.state = 'dead'; st.phase = 'dead'; st.endT = 0;
      ev.push({ type: 'dead', x: p.x, z: p.z });
    }
    return true;
  },

  _addExp(st, n, ev) {
    const p = st.p;
    p.exp += n;
    while (p.level < M.MAX_LEVEL && p.exp >= M.expNeed(p.level)) {
      p.exp -= M.expNeed(p.level);
      p.level++; p.maxHp += 12; p.atk += 2; p.hp = p.maxHp;
      ev.push({ type: 'levelup', level: p.level });
    }
  },

  _damageEnemy(st, e, dmg, kd, ev, fromX) {
    if (e.state === 'dead' || e.inv > 0) return false;
    e.hp -= dmg; e.flash = 0.12;
    const dir = e.x >= fromX ? 1 : -1;
    if (e.hp <= 0) { this._kill(st, e, ev); ev.push({ type: 'hurt', x: e.x, z: e.z, kd: true, dmg }); return true; }
    if (e.boss) { if (kd) { e.state = 'hurt'; e.st = 0.45; } }         // 보스는 3타에만 잠깐 멈춘다
    else if (kd || (e.heavy && dmg >= 20)) { e.state = 'kd'; e.st = KD_SEC; e.kb = dir * 140; }
    else if (!e.heavy) { e.state = 'hurt'; e.st = HURT_SEC; e.kb = dir * 60; }
    ev.push({ type: 'hurt', x: e.x, z: e.z, kd: !!kd, dmg });
    return true;
  },

  _kill(st, e, ev) {
    const K = M.ENEMY[e.kind], D = M.DIFFS[st.diff];
    e.state = 'dead'; e.st = 0.6;
    st.kills++;
    const g = Math.round(K.gold * D.goldMul);
    st.gold += g;
    this._addExp(st, K.exp, ev);
    ev.push({ type: 'kill', x: e.x, z: e.z, kind: e.kind, gold: g, boss: e.boss });
    if (e.boss) {
      st.items.push({ id: st.nextId++, kind: 'churu', x: e.x, z: e.z, t: 0 });
      st.items.push({ id: st.nextId++, kind: 'ring', x: e.x + 24, z: Math.min(0.95, e.z + 0.08), t: 0 });
      ev.push({ type: 'bossdead', x: e.x, z: e.z, name: K.name });
    } else {
      const r = st.rng.next();
      if (r < 0.12) st.items.push({ id: st.nextId++, kind: 'potion', x: e.x, z: e.z, t: 0 });
      else if (r < 0.2) st.items.push({ id: st.nextId++, kind: 'mana', x: e.x, z: e.z, t: 0 });
      else if (r < 0.45) st.items.push({ id: st.nextId++, kind: 'gold', x: e.x, z: e.z, t: 0, val: Math.round(st.rng.int(20, 60) * D.goldMul) });
    }
  },

  _openChest(st, ch, ev) {
    ch.opened = true; st.chests++;
    const D = M.DIFFS[st.diff];
    const r = st.rng.next();
    let kind = r < 0.35 ? 'gold' : r < 0.6 ? 'potion' : r < 0.8 ? 'mana' : r < 0.93 ? 'ring' : 'churu';
    const it = { id: st.nextId++, kind, x: ch.x + 6, z: ch.z, t: 0 };
    if (kind === 'gold') it.val = Math.round(st.rng.int(120, 300) * D.goldMul * (st.cls === 'thief' ? 2 : 1));
    st.items.push(it);
    ev.push({ type: 'chest', x: ch.x, z: ch.z, kind });
  },

  _pickItem(st, it, ev) {
    const p = st.p;
    let text = '';
    switch (it.kind) {
      case 'potion': p.hp = Math.min(p.maxHp, p.hp + 40); text = 'HP +40'; break;
      case 'mana': p.mp = Math.min(M.MAX_MP, p.mp + 40); text = 'MP +40'; break;
      case 'gold': st.gold += it.val || 50; text = `+${it.val || 50} 금화`; break;
      case 'ring': p.atk += 2; text = '공격력 +2'; break;
      case 'churu': p.hp = p.maxHp; text = 'HP 전부 회복!'; break;
    }
    ev.push({ type: 'item', kind: it.kind, x: it.x, z: it.z, text });
  },

  // ── 공격 판정 (근접 호) ──
  _meleeHit(st, ev) {
    const p = st.p, C = M.CLASSES[st.cls];
    const third = p.combo === 3;
    let dmg = Math.round(p.atk * (third ? 1.7 : 1));
    let any = false;
    for (const e of st.enemies) {
      if (e.state === 'dead') continue;
      const dx = (e.x - p.x) * p.face;
      if (dx < -8 || dx > p.range + e.r * 0.5 || Math.abs(e.z - p.z) > Z_TOL) continue;
      const d = st.cls === 'cleric' && e.undead ? Math.round(dmg * 1.5) : dmg;
      if (this._damageEnemy(st, e, d, third, ev, p.x)) any = true;
    }
    for (const ch of st.props) {
      if (ch.opened) continue;
      const dx = (ch.x - p.x) * p.face;
      if (dx >= -10 && dx <= p.range + 8 && Math.abs(ch.z - p.z) < Z_TOL + 0.04) { this._openChest(st, ch, ev); any = true; }
    }
    if (st.cls === 'mage' && !any) {
      // 마법사의 기본 공격은 사거리가 긴 지팡이 빛 — 빗나가도 연출용 이벤트
      ev.push({ type: 'swing', x: p.x + p.face * C.range * 0.6, z: p.z });
    } else ev.push({ type: 'swing', x: p.x + p.face * 24, z: p.z, hit: any, combo: p.combo });
  },

  _skill(st, ev) {
    const p = st.p, C = M.CLASSES[st.cls];
    if (p.mp < C.skill.mp) { ev.push({ type: 'nomp' }); return; }
    p.mp -= C.skill.mp;
    p.state = 'skill'; p.st = SKILL_DUR; p.combo = 0;
    switch (st.cls) {
      case 'fighter':                                     // 회전베기: 주위 전부 다운
        for (const e of st.enemies) {
          if (e.state === 'dead') continue;
          if (Math.abs(e.x - p.x) < 62 && Math.abs(e.z - p.z) < 0.22) this._damageEnemy(st, e, Math.round(p.atk * 2.2), true, ev, p.x);
        }
        break;
      case 'mage':                                        // 파이어볼: 관통 투사체
        st.bullets.push({ id: st.nextId++, kind: 'fireball', x: p.x + p.face * 14, z: p.z, vx: p.face * 260, vz: 0, dmg: Math.round(p.atk * 4.5), pierce: true, life: 1.4, hit: [] });
        break;
      case 'thief':                                       // 단검 3개 부채꼴
        for (const dz of [-0.28, 0, 0.28]) st.bullets.push({ id: st.nextId++, kind: 'dagger', x: p.x + p.face * 12, z: p.z, vx: p.face * 330, vz: dz, dmg: Math.round(p.atk * 1.6), pierce: false, life: 0.9, hit: [] });
        break;
      case 'cleric':                                      // 치유 + 언데드 소각
        p.hp = Math.min(p.maxHp, p.hp + 45);
        for (const e of st.enemies) {
          if (e.state === 'dead' || !e.undead) continue;
          if (Math.abs(e.x - p.x) < 90 && Math.abs(e.z - p.z) < 0.3) this._damageEnemy(st, e, Math.round(p.atk * 2.5), true, ev, p.x);
        }
        break;
    }
    ev.push({ type: 'skill', cls: st.cls, x: p.x, z: p.z });
  },

  step(st, dt, input) {
    const ev = [];
    input = input || {};
    if (st.phase !== 'play') {
      st.endT += dt;
      this._stepEnemies(st, dt, ev, false);
      this._stepBullets(st, dt, ev, false);
      return ev;
    }
    st.t += dt;
    const p = st.p, C = M.CLASSES[st.cls];

    // ── 타이머 ──
    if (p.inv > 0) p.inv -= dt;
    if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    p.mp = Math.min(M.MAX_MP, p.mp + M.MP_REGEN * dt);
    if (p.state === 'atk' || p.state === 'skill' || p.state === 'hurt') {
      const before = p.st;
      p.st -= dt;
      if (p.state === 'atk' && !p.hitDone && before > ATK_DUR - HIT_T && p.st <= ATK_DUR - HIT_T) { p.hitDone = true; this._meleeHit(st, ev); }
      if (p.st <= 0) { p.state = 'idle'; if (p.combo >= 3) { p.combo = 0; p.comboT = 0; } }
    }
    if (p.kb) { p.x += p.kb * dt; p.kb *= Math.max(0, 1 - dt * 9); if (Math.abs(p.kb) < 4) p.kb = 0; }

    // ── 입력: 이동 ──
    const busy = p.state === 'atk' || p.state === 'skill' || p.state === 'hurt';
    let mx = 0, mz = 0;
    if (!busy) {
      if (input.left) mx -= 1; if (input.right) mx += 1;
      if (input.up) mz -= 1; if (input.down) mz += 1;
      if (mx && mz) { mx *= 0.75; mz *= 0.75; }
      if (mx) p.face = mx > 0 ? 1 : -1;
      const sp = 118 * p.spd;
      p.x += mx * sp * dt; p.z += mz * sp * dt / M.FLOOR_H * 0.8;
      p.state = mx || mz ? 'walk' : 'idle';
      if (mx || mz) p.walk += dt * 10;
      p.vx = mx;
    }
    // ── 입력: 공격 (누른 순간) / 스킬 ──
    const atkEdge = !!input.atk && !p.atkHeld; p.atkHeld = !!input.atk;
    const skEdge = !!input.skill && !p.skillHeld; p.skillHeld = !!input.skill;
    if (!busy && skEdge) this._skill(st, ev);
    else if (!busy && atkEdge) {
      p.combo = p.comboT > 0 && p.combo < 3 ? p.combo + 1 : 1;
      p.comboT = COMBO_WIN; p.state = 'atk'; p.st = ATK_DUR; p.hitDone = false;
      ev.push({ type: 'atk', combo: p.combo });
    }

    // ── 카메라 · 구간 게이트 ──
    const secStart = st.section * M.SEC_W;
    const camMax = st.gateOpen ? secStart + M.SEC_W : secStart;
    st.camX = Math.max(secStart, Math.min(camMax, p.x - 200));
    p.x = Math.max(st.camX + 14, Math.min(st.camX + M.W - 14, p.x));
    p.z = Math.max(0.02, Math.min(0.98, p.z));
    if (st.gateOpen && st.camX >= camMax - 0.5) {
      st.section++;
      this.startSection(st);
      ev.push({ type: 'section', section: st.section });
    }

    // ── 웨이브 등장 ──
    if (st.pending.length) {
      const keep = [];
      for (const q of st.pending) { q.delay -= dt; if (q.delay <= 0) { this._spawn(st, q); ev.push({ type: 'spawn', kind: q.kind, boss: !!M.ENEMY[q.kind].boss }); } else keep.push(q); }
      st.pending = keep;
    }

    this._stepEnemies(st, dt, ev, true);
    this._stepBullets(st, dt, ev, true);

    // ── 아이템 줍기 ──
    const keepI = [];
    for (const it of st.items) {
      it.t += dt;
      if (st.phase === 'play' && Math.abs(it.x - p.x) < 18 && Math.abs(it.z - p.z) < Z_TOL) { this._pickItem(st, it, ev); continue; }
      keepI.push(it);
    }
    st.items = keepI;

    // ── 구간 전멸 → 전진 개방 / 스테이지 클리어 ──
    if (!st.waveDone && !st.pending.length && !st.enemies.some((e) => e.state !== 'dead')) {
      st.waveDone = true;
      if (st.section < st.sections - 1) { st.gateOpen = true; ev.push({ type: 'go' }); }
      else {
        st.stagesDone++;
        const nx = st.stage.next;
        if (nx.length === 0) { st.phase = 'clear'; st.endT = 0; st.gold += 1000; ev.push({ type: 'clear', gold: st.gold }); }
        else { st.phase = 'stageclear'; st.endT = 0; ev.push({ type: 'stageclear', next: nx.slice(), stage: st.stageKey }); }
      }
    }
    return ev;
  },

  _stepEnemies(st, dt, ev, live) {
    const p = st.p, keep = [];
    let alive = 0;
    for (const e of st.enemies) if (e.state !== 'dead') alive++;
    for (const e of st.enemies) {
      if (e.state === 'dead') { e.st -= dt; if (e.st > 0) keep.push(e); continue; }
      if (e.flash > 0) e.flash -= dt;
      if (e.inv > 0) e.inv -= dt;
      if (e.atkCd > 0) e.atkCd -= dt;
      if (e.kb) { e.x += e.kb * dt; e.kb *= Math.max(0, 1 - dt * 8); if (Math.abs(e.kb) < 4) e.kb = 0; }
      const dx = p.x - e.x, dz = p.z - e.z, adx = Math.abs(dx);
      if (e.state === 'hurt' || e.state === 'kd' || e.state === 'attack') {
        e.st -= dt;
        if (e.st <= 0) { if (e.state === 'kd') e.inv = 0.5; e.state = 'idle'; e.atkCd = Math.max(e.atkCd, 0.5); }
      } else if (e.state === 'windup') {
        e.st -= dt;
        if (e.st <= 0) {
          e.state = 'attack'; e.st = 0.32;
          const K = M.ENEMY[e.kind];
          if (live && st.phase === 'play') {
            const inFront = (p.x - e.x) * e.face > -10 && adx <= e.range + (K.smash ? 24 : 6);
            if (inFront && Math.abs(dz) < (K.smash ? 0.26 : Z_TOL)) this._damagePlayer(st, e.atk, e.x, ev, e.kind);
          }
          ev.push({ type: 'eatk', x: e.x, z: e.z, kind: e.kind, smash: !!M.ENEMY[e.kind].smash });
        }
      } else if (live) {
        // ── AI ──
        const K = M.ENEMY[e.kind];
        e.face = dx >= 0 ? 1 : -1;
        let mx = 0, mz = 0;
        if (e.ranged) {
          const want = 130;
          if (adx < want - 40) mx = -e.face; else if (adx > want + 40) mx = e.face;
          if (Math.abs(dz) > 0.05) mz = Math.sign(dz);
          if (e.entered && e.atkCd <= 0 && adx <= e.range && Math.abs(dz) < 0.35) {
            e.atkCd = K.fireCd; e.state = 'windup'; e.st = 0.35;
            const n = e.boss ? 3 : 1;
            for (let i = 0; i < n; i++) st.bullets.push({ id: st.nextId++, kind: e.kind === 'lich' ? 'bone' : 'fire', x: e.x + e.face * 10, z: e.z, vx: e.face * 230, vz: (dz / Math.max(0.4, adx / 230)) + (i - (n - 1) / 2) * 0.3, dmg: e.atk, enemy: true, life: 1.6, hit: [] });
            ev.push({ type: 'efire', x: e.x, z: e.z });
          }
          if (e.kind === 'lich') {                           // 리치는 해골을 불러낸다
            e.summonT = (e.summonT || 3) - dt;
            if (e.summonT <= 0 && alive < 4) { e.summonT = M.ENEMY.lich.summon; this._spawn(st, { kind: 'skeleton', x: e.x + (st.rng.chance(0.5) ? 40 : -40), z: e.z, side: e.face }); ev.push({ type: 'summon', x: e.x, z: e.z }); }
          }
        } else {
          const goal = e.range * 0.8;
          if (adx > goal) mx = e.face; else if (adx < goal - 14) mx = -e.face;
          if (Math.abs(dz) > 0.04) mz = Math.sign(dz);
          if (e.kind === 'bat') mz += Math.sin(st.t * 6 + e.wob) * 0.8;
          if (e.entered && e.atkCd <= 0 && adx <= e.range && Math.abs(dz) < Z_TOL) {
            e.state = 'windup'; e.st = K.smash ? 0.7 : e.heavy ? 0.55 : 0.42; mx = 0; mz = 0;
            e.atkCd = (K.smash || 1.3) + st.rng.next() * 0.6;
          }
          if (e.kind === 'dragon' && e.atkCd <= 0.2 && adx > e.range && adx < 200 && Math.abs(dz) < 0.2 && st.rng.chance(0.02)) {
            e.state = 'windup'; e.st = 0.6; e.atkCd = M.ENEMY.dragon.breath;                 // 불 브레스
            st.bullets.push({ id: st.nextId++, kind: 'breath', x: e.x + e.face * 30, z: e.z, vx: e.face * 170, vz: 0, dmg: e.atk, enemy: true, life: 1.2, hit: [], r: 26 });
            ev.push({ type: 'breath', x: e.x, z: e.z });
          }
        }
        // 아직 화면 밖이면 무조건 화면 안으로 걸어 들어온다 (사거리 밖에서 서성이는 교착 방지)
        if (!e.entered) { mx = e.x < st.camX + M.W / 2 ? 1 : -1; if (e.state === 'windup') e.state = 'idle'; }
        if (e.state === 'idle' || e.state === 'walk') {
          e.x += mx * e.spd * dt; e.z += mz * e.spd * dt / M.FLOOR_H * 0.9;
          e.state = mx || mz ? 'walk' : 'idle';
          if (mx || mz) e.walk += dt * 9;
        }
      }
      // 화면에 들어온 적은 화면 밖으로 못 나간다 (원거리 적이 사거리 밖으로 도망치는 것 방지)
      if (!e.entered && e.x > st.camX + 24 && e.x < st.camX + M.W - 24) e.entered = true;
      if (e.entered) e.x = Math.max(st.camX + 16, Math.min(st.camX + M.W - 16, e.x));
      else e.x = Math.max(st.camX - 40, Math.min(st.camX + M.W + 40, e.x));
      e.z = Math.max(0.02, Math.min(0.98, e.z));
      keep.push(e);
    }
    st.enemies = keep;
  },

  _stepBullets(st, dt, ev, live) {
    const p = st.p, keep = [];
    for (const b of st.bullets) {
      b.x += b.vx * dt; b.z += (b.vz || 0) * dt; b.life -= dt;
      b.z = Math.max(0.02, Math.min(0.98, b.z));
      if (b.life <= 0 || b.x < st.camX - 60 || b.x > st.camX + M.W + 60) continue;
      let dead = false;
      if (live && st.phase === 'play') {
        if (b.enemy) {
          if (Math.abs(b.x - p.x) < (b.r || 12) + 4 && Math.abs(b.z - p.z) < Z_TOL) { if (this._damagePlayer(st, b.dmg, b.x, ev, b.kind) && b.kind !== 'breath') dead = true; }
        } else {
          for (const e of st.enemies) {
            if (e.state === 'dead' || b.hit.includes(e.id)) continue;
            if (Math.abs(b.x - e.x) < e.r + 8 && Math.abs(b.z - e.z) < Z_TOL + 0.05) {
              b.hit.push(e.id);
              this._damageEnemy(st, e, b.dmg, b.kind === 'fireball', ev, b.x - b.vx);
              ev.push({ type: 'bhit', x: b.x, z: b.z, kind: b.kind });
              if (!b.pierce) { dead = true; break; }
            }
          }
          for (const ch of st.props) {
            if (!ch.opened && Math.abs(b.x - ch.x) < 16 && Math.abs(b.z - ch.z) < Z_TOL + 0.05) { this._openChest(st, ch, ev); if (!b.pierce) dead = true; }
          }
        }
      }
      if (!dead) keep.push(b);
    }
    st.bullets = keep;
  },

  // 컨티뉴: 현재 구간을 처음부터 (HP·MP 회복, 상자는 연 상태 유지)
  continueRun(st) {
    const p = st.p;
    st.continues++;
    p.hp = p.maxHp; p.mp = M.MAX_MP; p.inv = 2; p.state = 'idle'; p.st = 0; p.combo = 0; p.kb = 0;
    st.phase = 'play'; st.endT = 0;
    st.enemies = []; st.bullets = [];
    st.camX = st.section * M.SEC_W;
    p.x = st.camX + 60; p.z = 0.5; p.face = 1;
    this.startSection(st);
  },

  // 갈림길 선택 → 다음 스테이지
  chooseNext(st, key) {
    if (!st.stage.next.includes(key)) key = st.stage.next[0];
    this.loadStage(st, key);
  },

  deathDone(st) { return st.phase === 'dead' && st.endT >= DEATH_SEC; },
};
