// logic.js — 낙하 물리 + 회피 판정 (DOM 무의존 — node 테스트 가능)
// 원작 규칙: 모구는 좌우로만 움직이고, 똥에 한 번이라도 맞으면 그 자리에서 끝.
const M = window.MDD;

const DEATH_SEC = 1.35;          // 맞고 쓰러지는 연출 시간 (이후 결과 화면)
const WIND_AMP = 52;             // 똥 폭풍 웨이브의 좌우 바람 세기 (px/s)

M.Logic = {
  create(seed, diff) {
    const d = M.DIFFS[diff || M.diff] ? (diff || M.diff) : 'normal';
    const st = {
      diff: d,
      t: 0, phase: 'play', endT: 0,
      p: { x: M.W / 2, dir: 1, walk: 0 },
      poops: [],
      rng: M.makeRng((seed >>> 0) || 20240915),
      spawnAcc: 0, lastX: -999,
      waveNo: 1, wave: M.makeWave(1, d),
      themeIdx: 0,
      dodged: 0, spawned: 0,
      hitAt: null,
      nextId: 1,
    };
    return st;
  },

  // 원 vs 모구 히트박스(사각) 충돌
  hitTest(px, poop) {
    const left = px - M.PW, right = px + M.PW;
    const top = M.GROUND - M.PH, bot = M.GROUND;
    const cx = Math.max(left, Math.min(right, poop.x));
    const cy = Math.max(top, Math.min(bot, poop.y));
    const dx = poop.x - cx, dy = poop.y - cy;
    return dx * dx + dy * dy < poop.r * poop.r;
  },

  _spawn(st) {
    const w = st.wave, rng = st.rng;
    const roll = rng.next();
    const kindName = roll < w.weights.small ? 'small'
      : roll < w.weights.small + w.weights.big ? 'big' : 'mid';
    const K = M.KINDS[kindName];
    // 같은 자리에 겹쳐 쏟아지면 피할 수 없는 벽이 되므로 직전 생성 위치와 너무 가까우면 한 번만 다시 뽑는다
    const pick = () => rng.range(K.r + 3, M.W - K.r - 3);
    let x = pick();
    if (Math.abs(x - st.lastX) < M.PW * 1.6) x = pick();
    st.lastX = x;

    st.poops.push({
      id: st.nextId++, kind: kindName, r: K.r,
      bx: x, x, y: -K.r - 4,
      vy: w.fallV * K.spd * rng.range(0.88, 1.14),
      wob: K.wob * rng.range(0.6, 1.2),
      sw: rng.range(0, Math.PI * 2),
      spin: rng.range(-2.2, 2.2),
      rot: rng.range(0, Math.PI * 2),
    });
    st.spawned++;
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') {
      st.endT += dt;
      // 쓰러지는 동안에도 남은 똥은 계속 떨어진다 (연출)
      this._fall(st, dt, ev, false);
      return ev;
    }

    st.t += dt;

    // ── 웨이브 · 하늘 전환 ──
    const wn = M.waveAt(st.t);
    if (wn !== st.waveNo) {
      st.waveNo = wn;
      st.wave = M.makeWave(wn, st.diff);
      ev.push({ type: 'wave', no: wn, wind: st.wave.wind });
    }
    const ti = Math.min(M.THEMES.length - 1, Math.floor(st.t / 60));
    if (ti !== st.themeIdx) { st.themeIdx = ti; ev.push({ type: 'theme', idx: ti }); }

    // ── 모구 이동 (좌우만) ──
    const p = st.p;
    let vx = 0;
    if (input && input.targetX != null) {
      const d = input.targetX - p.x;
      if (Math.abs(d) > 3) vx = Math.sign(d) * M.PSPD;
    } else if (input) {
      if (input.left) vx = -M.PSPD;
      if (input.right) vx = M.PSPD;
      if (input.left && input.right) vx = 0;
    }
    if (vx !== 0) { p.dir = Math.sign(vx); p.walk += dt * 9; }
    p.x = Math.max(M.PW + 2, Math.min(M.W - M.PW - 2, p.x + vx * dt));
    p.vx = vx;

    // ── 똥 생성 ──
    st.spawnAcc += dt * st.wave.rate;
    let guard = 0;
    while (st.spawnAcc >= 1 && guard++ < 40) { st.spawnAcc -= 1; this._spawn(st); }

    // ── 낙하 · 착지 · 피격 ──
    this._fall(st, dt, ev, true);

    // ── 5분 생존 = CLEAR (원작과 동일) ──
    if (st.phase === 'play' && st.t >= M.CLEAR_TIME) {
      st.phase = 'clear'; st.endT = 0;
      ev.push({ type: 'clear', time: M.CLEAR_TIME, dodged: st.dodged });
    }
    return ev;
  },

  _fall(st, dt, ev, live) {
    const wind = st.wave.wind ? Math.sin(st.t * 0.42) * WIND_AMP : 0;
    const keep = [];
    for (const q of st.poops) {
      q.y += q.vy * dt;
      q.rot += q.spin * dt;
      q.bx += wind * dt * (12 / (q.r + 6));
      q.bx = Math.max(q.r + 2, Math.min(M.W - q.r - 2, q.bx));
      q.x = q.bx + Math.sin(st.t * 2.6 + q.sw) * q.wob;

      if (q.y - q.r >= M.GROUND) {                     // 바닥에 닿음 = 피했다
        if (live) { st.dodged++; ev.push({ type: 'land', x: q.x, r: q.r, kind: q.kind }); }
        continue;
      }
      if (live && st.phase === 'play' && this.hitTest(st.p.x, q)) {
        st.phase = 'over'; st.endT = 0;
        st.hitAt = { x: q.x, y: q.y, r: q.r };
        ev.push({ type: 'hit', x: q.x, y: q.y, r: q.r });
        ev.push({ type: 'over', time: st.t, dodged: st.dodged });
        continue;                                       // 맞은 똥은 터진다
      }
      keep.push(q);
    }
    st.poops = keep;
  },

  // 결과 화면 전환 타이밍 (맞고 쓰러지는 연출이 끝났는가)
  deathDone(st) { return st.phase === 'over' && st.endT >= DEATH_SEC; },
  DEATH_SEC,
};
