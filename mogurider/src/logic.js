// logic.js — 종스크롤 슈팅 물리 (DOM 무의존 — node 테스트 가능)
// 원작 규칙: 불꽃은 자동 발사, 플레이어는 좌우로만 움직인다. 적·탄에 닿으면 하트 -1.
const M = window.MDR;

const DEATH_SEC = 1.4;           // 격추 연출 시간 (이후 결과 화면)
const BULLET_V = 540;            // 불꽃 속도 (px/s)
const COIN_V = 95;               // 코인 낙하 속도
const ITEM_V = 120;              // 아이템 낙하 속도
const MAGNET = 64;               // 코인 자석 반경 (피버 시 3배)

M.Logic = {
  DEATH_SEC,

  create(seed, diff) {
    const d = M.DIFFS[diff || M.diff] ? (diff || M.diff) : 'normal';
    return {
      diff: d,
      t: 0, phase: 'play', endT: 0,
      dist: 0, score: 0, coins: 0, kills: 0,
      p: { x: M.W / 2, vx: 0, hearts: M.HEARTS, inv: 0, level: 1, fever: 0, shield: false },
      bullets: [], enemies: [], ebullets: [], coinsArr: [], items: [], boss: null,
      rng: M.makeRng((seed >>> 0) || 20120701),
      fireAcc: 1, spawnAcc: 0.8, itemT: 4.5,          // 첫 발사·첫 편대는 바로
      waveNo: 1, wave: M.makeWave(1, d),
      zoneIdx: 0, bossIdx: 0, bossKills: 0,
      hitAt: null, nextId: 1,
    };
  },

  scrollSpd(st) { return 110 + Math.min(1, st.dist / M.CLEAR_DIST) * 90; },

  // ── 편대 생성 ──
  _spawnPattern(st) {
    const w = st.wave, rng = st.rng;
    let total = 0;
    for (const [, k] of w.weights) total += k;
    let roll = rng.next() * total, pat = 'crow1';
    for (const [name, k] of w.weights) { if (k <= 0) continue; if (roll < k) { pat = name; break; } roll -= k; }
    const add = (kind, x, y, extra) => this._addEnemy(st, kind, x, y || 0, extra);
    const cx = rng.range(50, M.W - 50);
    switch (pat) {
      case 'crow1': add('crow', cx); break;
      case 'crow3': { const x0 = Math.max(30, Math.min(M.W - 150, cx - 60)); for (let i = 0; i < 3; i++) add('crow', x0 + i * 60, -i * 26); break; }
      case 'crowV': { const x0 = Math.max(30, Math.min(M.W - 30 - 200, cx - 100)); for (let i = 0; i < 5; i++) add('crow', x0 + i * 50, -Math.abs(i - 2) * 34); break; }
      case 'balloon': { const n = rng.int(1, 2); for (let i = 0; i < n; i++) add('balloon', rng.range(30, M.W - 30), -i * 50); break; }
      case 'drone': add('drone', cx); break;
      case 'rocks': add('rock', rng.range(40, M.W - 40)); break;
      case 'wall': {
        // 바위 2개가 통로(폭 110px)를 사이에 두고 막아선다 — 피할 수 없는 벽 금지
        const gx = rng.range(70, M.W - 70), half = 55, r = M.ENEMY.rock.r + 2;
        if (gx - half - r >= r) add('rock', gx - half - r);
        if (gx + half + r <= M.W - r) add('rock', gx + half + r);
        break;
      }
    }
  },

  _addEnemy(st, kind, x, yOff, extra) {
    const K = M.ENEMY[kind];
    st.enemies.push(Object.assign({
      id: st.nextId++, kind, r: K.r, x, bx: x, y: -K.r - 6 - (yOff || 0),
      hp: K.hp === Infinity ? Infinity : Math.max(1, Math.round(K.hp * st.wave.hpMul)),
      vy: st.wave.fallV * K.spd, sw: st.rng.range(0, Math.PI * 2), wob: K.wob,
      fireT: K.fire ? K.fire * 0.7 : 0, flash: 0,
    }, extra || {}));
  },

  _spawnItem(st) {
    const rng = st.rng, p = st.p;
    const pool = [];
    for (const k in M.ITEMS) {
      let w = M.ITEMS[k].w;
      if (k === 'heart' && p.hearts >= M.HEARTS) w = 0;         // 하트가 꽉 찼으면 안 나온다
      if (k === 'shield' && p.shield) w = 3;
      if (k === 'fish' && p.level >= M.MAX_LEVEL) w = 10;
      if (w > 0) pool.push([k, w]);
    }
    let total = 0; for (const [, w] of pool) total += w;
    let roll = rng.next() * total, kind = pool[0][0];
    for (const [k, w] of pool) { if (roll < w) { kind = k; break; } roll -= w; }
    st.items.push({ id: st.nextId++, kind, x: rng.range(30, M.W - 30), y: -M.ITEM_R - 4, sw: rng.range(0, 6.28) });
  },

  _spawnBoss(st, def) {
    st.boss = {
      def, name: def.name, r: def.r, x: M.W / 2, y: -def.r - 10, ty: 96,
      hp: Math.round(def.hp * st.wave.hpMul), maxHp: Math.round(def.hp * st.wave.hpMul),
      fireT: 2.0, t: 0, flash: 0, phase: 'enter',
    };
  },

  // ── 발사 ──
  _fire(st) {
    const p = st.p;
    const S = p.fever > 0 ? M.FEVER_SHOT : M.SHOT[p.level];
    for (const a of S.angles) {
      st.bullets.push({ x: p.x + Math.sin(a) * 6, y: M.PY - 26, vx: Math.sin(a) * BULLET_V, vy: -Math.cos(a) * BULLET_V, r: 5, big: p.fever > 0 });
    }
  },

  _damagePlayer(st, ev, src) {
    const p = st.p;
    if (p.inv > 0 || p.fever > 0 || st.phase !== 'play') return false;
    if (p.shield) { p.shield = false; p.inv = 0.8; ev.push({ type: 'shieldbreak', x: p.x }); return true; }
    p.hearts--;
    p.level = Math.max(1, p.level - 1);                 // 원작처럼 맞으면 불꽃이 한 단계 약해진다
    p.inv = M.INV_SEC;
    ev.push({ type: 'hit', x: p.x, y: M.PY, src });
    if (p.hearts <= 0) {
      st.phase = 'over'; st.endT = 0;
      ev.push({ type: 'over', dist: st.dist, score: st.score });
    }
    return true;
  },

  _killEnemy(st, e, ev, byBomb) {
    st.kills++;
    const sc = Math.round(M.ENEMY[e.kind].score * M.DIFFS[st.diff].scoreMul * (st.p.fever > 0 ? 2 : 1));
    st.score += sc;
    if (e.kind !== 'rock') st.coinsArr.push({ id: st.nextId++, x: e.x, y: e.y, sw: st.rng.range(0, 6.28), t: 0 });
    ev.push({ type: 'kill', x: e.x, y: e.y, r: e.r, kind: e.kind, score: sc, bomb: !!byBomb });
  },

  _useBomb(st, ev) {
    for (const e of st.enemies) this._killEnemy(st, e, ev, true);
    st.enemies = [];
    st.ebullets = [];
    if (st.boss) { st.boss.hp -= 15; st.boss.flash = 0.3; }
    ev.push({ type: 'bomb' });
  },

  _pickItem(st, it, ev) {
    const p = st.p;
    switch (it.kind) {
      case 'churu': p.fever = M.FEVER_SEC; ev.push({ type: 'fever' }); break;
      case 'fish':
        if (p.level < M.MAX_LEVEL) { p.level++; ev.push({ type: 'levelup', level: p.level }); }
        else { st.score += 500; ev.push({ type: 'bonus', score: 500 }); }
        break;
      case 'bomb': this._useBomb(st, ev); break;
      case 'heart': p.hearts = Math.min(M.HEARTS, p.hearts + 1); break;
      case 'shield': p.shield = true; break;
    }
    ev.push({ type: 'item', kind: it.kind, x: it.x, y: it.y });
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') {
      st.endT += dt;
      this._drift(st, dt, ev, false);
      return ev;
    }
    st.t += dt;
    const p = st.p;

    // ── 거리 · 웨이브 · 구역 · 보스 진입 ──
    if (!st.boss) {
      st.dist += this.scrollSpd(st) * dt;
      const b = M.BOSSES[st.bossIdx];
      if (b && st.dist >= b.at) { st.dist = b.at; this._spawnBoss(st, b); ev.push({ type: 'boss', name: b.name, idx: st.bossIdx }); }
    }
    const wn = M.waveAt(st.dist);
    if (wn !== st.waveNo) { st.waveNo = wn; st.wave = M.makeWave(wn, st.diff); ev.push({ type: 'wave', no: wn }); }
    const zi = M.zoneIdx(st.dist);
    if (zi !== st.zoneIdx) { st.zoneIdx = zi; ev.push({ type: 'zone', idx: zi, name: M.ZONES[zi].name }); }

    // ── 이동 (좌우만) ──
    let vx = 0;
    if (input && input.targetX != null) {
      const d = input.targetX - p.x;
      if (Math.abs(d) > 3) vx = Math.sign(d) * Math.min(M.PSPD, Math.abs(d) / dt);
    } else if (input) {
      if (input.left) vx = -M.PSPD;
      if (input.right) vx = M.PSPD;
      if (input.left && input.right) vx = 0;
    }
    p.x = Math.max(M.PR + 6, Math.min(M.W - M.PR - 6, p.x + vx * dt));
    p.vx = vx;
    if (p.inv > 0) p.inv -= dt;
    if (p.fever > 0) { p.fever -= dt; if (p.fever <= 0) ev.push({ type: 'feverend' }); }

    // ── 자동 발사 ──
    const S = p.fever > 0 ? M.FEVER_SHOT : M.SHOT[p.level];
    st.fireAcc += dt * S.rate;
    while (st.fireAcc >= 1) { st.fireAcc -= 1; this._fire(st); ev.push({ type: 'shoot' }); }

    // ── 편대 · 아이템 생성 (보스전 중엔 편대 없음) ──
    if (!st.boss) {
      st.spawnAcc += dt * st.wave.rate;
      let guard = 0;
      while (st.spawnAcc >= 1 && guard++ < 6) { st.spawnAcc -= 1; this._spawnPattern(st); }
    }
    st.itemT -= dt;
    if (st.itemT <= 0) { st.itemT = st.rng.range(5.5, 8.5); this._spawnItem(st); }

    // ── 보스 ──
    if (st.boss) this._stepBoss(st, dt, ev);

    // ── 이동·충돌 ──
    this._drift(st, dt, ev, true);

    // ── 달 착륙 = CLEAR ──
    if (st.phase === 'play' && st.dist >= M.CLEAR_DIST) {
      st.dist = M.CLEAR_DIST;
      st.phase = 'clear'; st.endT = 0;
      st.score += 5000;
      ev.push({ type: 'clear', score: st.score });
    }
    return ev;
  },

  _stepBoss(st, dt, ev) {
    const b = st.boss, p = st.p;
    b.t += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.phase === 'enter') { b.y += (b.ty - b.y) * Math.min(1, dt * 2.2); if (b.ty - b.y < 2) b.phase = 'fight'; return; }
    b.x = M.W / 2 + Math.sin(b.t * 0.9) * (M.W / 2 - b.r - 16);
    b.y = b.ty + Math.sin(b.t * 1.7) * 10;
    b.fireT -= dt;
    if (b.fireT <= 0) {
      b.fireT = b.def.fire;
      // 플레이어를 향한 부채꼴 탄막
      const base = Math.atan2(M.PY - b.y, p.x - b.x), n = b.def.spread;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.22;
        st.ebullets.push({ x: b.x, y: b.y + b.r * 0.6, vx: Math.cos(a) * b.def.bspd, vy: Math.sin(a) * b.def.bspd, r: 6 });
      }
      ev.push({ type: 'bossfire' });
    }
    // 몸통 박치기
    if (Math.hypot(p.x - b.x, M.PY - b.y) < b.r + M.PR) this._damagePlayer(st, ev, 'boss');
    if (b.hp <= 0) {
      const idx = st.bossIdx;
      const sc = Math.round(2000 * (idx + 1) * M.DIFFS[st.diff].scoreMul);
      st.score += sc; st.bossKills++;
      for (let i = 0; i < 8; i++) st.coinsArr.push({ id: st.nextId++, x: b.x + (i - 3.5) * 16, y: b.y, sw: i, t: 0 });
      st.items.push({ id: st.nextId++, kind: 'heart', x: b.x, y: b.y, sw: 0 });
      st.ebullets = [];
      ev.push({ type: 'bossdead', x: b.x, y: b.y, r: b.r, name: b.name, score: sc });
      st.boss = null;
      st.bossIdx = idx + 1;
    }
  },

  // 탄·적·코인·아이템 이동과 충돌 (live=false 면 연출용 이동만)
  _drift(st, dt, ev, live) {
    const p = st.p;
    // 불꽃
    const keepB = [];
    for (const b of st.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > M.W + 20) continue;
      let used = false;
      if (live) {
        for (const e of st.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
            used = true;
            if (e.kind === 'rock') { ev.push({ type: 'clank', x: b.x, y: b.y }); break; }
            e.hp -= b.big ? 2 : 1; e.flash = 0.12;
            ev.push({ type: 'hurt', x: b.x, y: b.y });
            if (e.hp <= 0) this._killEnemy(st, e, ev);
            break;
          }
        }
        if (!used && st.boss && st.boss.phase === 'fight' && Math.hypot(b.x - st.boss.x, b.y - st.boss.y) < b.r + st.boss.r) {
          used = true; st.boss.hp -= b.big ? 2 : 1; st.boss.flash = 0.1;
          ev.push({ type: 'hurt', x: b.x, y: b.y });
        }
      }
      if (!used) keepB.push(b);
    }
    st.bullets = keepB;

    // 적
    const keepE = [];
    for (const e of st.enemies) {
      if (e.hp <= 0) continue;
      e.y += e.vy * dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.wob) e.x = e.bx + Math.sin(st.t * 3 + e.sw) * e.wob;
      if (e.kind === 'drone' && live && e.y > 40 && e.y < M.PY - 80) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = M.ENEMY.drone.fire;
          const a = Math.atan2(M.PY - e.y, p.x - e.x);
          st.ebullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 5 });
          ev.push({ type: 'efire', x: e.x, y: e.y });
        }
      }
      if (e.y - e.r > M.H + 10) continue;               // 화면 아래로 사라짐
      if (live && st.phase === 'play' && Math.hypot(p.x - e.x, M.PY - e.y) < e.r + M.PR) {
        if (p.fever > 0 && e.kind !== 'rock') { this._killEnemy(st, e, ev); continue; }  // 피버 중엔 몸으로 부순다
        if (this._damagePlayer(st, ev, e.kind)) { if (e.kind !== 'rock') { ev.push({ type: 'kill', x: e.x, y: e.y, r: e.r, kind: e.kind, score: 0 }); continue; } }
      }
      keepE.push(e);
    }
    st.enemies = keepE;

    // 적 탄
    const keepEB = [];
    for (const b of st.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > M.H + 12 || b.y < -12 || b.x < -12 || b.x > M.W + 12) continue;
      if (live && st.phase === 'play' && Math.hypot(p.x - b.x, M.PY - b.y) < b.r + M.PR) {
        if (p.fever > 0 || this._damagePlayer(st, ev, 'bullet')) continue;
      }
      keepEB.push(b);
    }
    st.ebullets = keepEB;

    // 코인 (자석)
    const mag = p.fever > 0 ? MAGNET * 3 : MAGNET;
    const keepC = [];
    for (const c of st.coinsArr) {
      c.t += dt;
      const dx = p.x - c.x, dy = M.PY - c.y, d = Math.hypot(dx, dy);
      if (live && st.phase === 'play' && d < mag) { c.x += (dx / d) * 420 * dt; c.y += (dy / d) * 420 * dt; }
      else { c.y += COIN_V * dt; c.x += Math.sin(c.t * 4 + c.sw) * 20 * dt; }
      if (c.y > M.H + 12) continue;
      if (live && st.phase === 'play' && d < 18 + M.PR) {
        const v = Math.round(50 * (p.fever > 0 ? 2 : 1));
        st.coins++; st.score += v;
        ev.push({ type: 'coin', x: c.x, y: c.y, value: v });
        continue;
      }
      keepC.push(c);
    }
    st.coinsArr = keepC;

    // 아이템
    const keepI = [];
    for (const it of st.items) {
      it.y += ITEM_V * dt; it.x += Math.sin(st.t * 2 + it.sw) * 18 * dt;
      it.x = Math.max(M.ITEM_R, Math.min(M.W - M.ITEM_R, it.x));
      if (it.y > M.H + 16) continue;
      if (live && st.phase === 'play' && Math.hypot(p.x - it.x, M.PY - it.y) < M.ITEM_R + M.PR + 6) { this._pickItem(st, it, ev); continue; }
      keepI.push(it);
    }
    st.items = keepI;
  },

  deathDone(st) { return st.phase === 'over' && st.endT >= DEATH_SEC; },
};
