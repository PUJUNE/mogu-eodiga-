// logic.js — 코스(중심선·단면) · 장애물/생선 배치 · 썰매 물리 · 판정 (DOM·THREE 없음, node 에서 그대로 돈다)
// 좌표: s = 코스를 따라 내려간 거리, u = 옆(오른쪽 +), z = 그 자리 바닥에서 잰 높이
// 세계 좌표: 진행 방향 F = (sinθ, 0, −cosθ), 오른쪽 R = (cosθ, 0, sinθ), 곡률 k > 0 이면 오른쪽으로 굽는다
const M = window.MSL;
const PH = M.PHYS;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ══ 단면 ══
const Prof = {
  half: (p) => p.f + p.r * Math.sin(p.tm),
  h(p, u) {
    let a = Math.abs(u) - p.f;
    if (a <= 0) return 0;
    a = Math.min(a, p.r * Math.sin(p.tm));
    return p.r - Math.sqrt(p.r * p.r - a * a);
  },
  // 바닥 기울기 각 (오른쪽 벽이 오르막이면 +)
  bank(p, u) {
    let a = Math.abs(u) - p.f;
    if (a <= 0) return 0;
    a = Math.min(a, p.r * Math.sin(p.tm));
    return Math.sign(u) * Math.asin(a / p.r);
  },
  rim: (p) => Prof.h(p, Prof.half(p)),
  mix: (a, b, t) => ({ f: lerp(a.f, b.f, t), r: lerp(a.r, b.r, t), tm: lerp(a.tm, b.tm, t) }),
};
M.Prof = Prof;

// ══ 중심선: 1m 간격 표본 ══
class Track {
  constructor() {
    this.X = [0]; this.Y = [0]; this.Z = [0]; this.TH = [0]; this.K = [0]; this.GR = [0.15];
    this.PF = [M.ZONES.canal.prof]; this.ZN = ['canal'];
  }
  get len() { return this.X.length - 1; }
  push(k, gr, prof, zone) {
    const i = this.len, th0 = this.TH[i], th = th0 + k, tm = (th0 + th) / 2;
    this.X.push(this.X[i] + Math.sin(tm)); this.Z.push(this.Z[i] - Math.cos(tm)); this.Y.push(this.Y[i] - Math.tan(gr));
    this.TH.push(th); this.K.push(k); this.GR.push(gr); this.PF.push(prof); this.ZN.push(zone);
  }
  // 소수 거리의 중심선 정보
  frame(s) {
    s = clamp(s, 0, this.len - 0.001);
    const i = Math.floor(s), t = s - i;
    return {
      x: lerp(this.X[i], this.X[i + 1], t), y: lerp(this.Y[i], this.Y[i + 1], t), z: lerp(this.Z[i], this.Z[i + 1], t),
      th: lerp(this.TH[i], this.TH[i + 1], t), k: this.K[i + 1], gr: this.GR[i + 1], prof: this.PF[i + 1], zone: this.ZN[i + 1],
    };
  }
  // (s, u, z) → 세계 좌표 [x, y, z]
  world(s, u, z = 0) {
    const f = this.frame(s), h = Prof.h(f.prof, u) + z;
    return [f.x + Math.cos(f.th) * u, f.y + h, f.z + Math.sin(f.th) * u];
  }
}
M.Track = Track;

// ── 구역 하나만큼 중심선을 늘린다 ──
function buildZone(run, zone, len, opts = {}) {
  const T = run.track, Z = M.ZONES[zone], rng = run.rng;
  const prev = T.PF[T.len], s0 = T.len;
  let k = T.K[T.len], gr = T.GR[T.len], j = 0;
  const pieces = [];
  let rest = len;
  if (opts.straight) { pieces.push({ len: opts.straight, k: 0, gr: Z.grade * 0.8 }); rest -= opts.straight; }
  let lastSign = rng.chance(0.5) ? 1 : -1;
  while (rest > 0) {
    let p;
    if (rng.chance(0.4)) p = { len: rng.int(20, 40), k: 0 };
    else { lastSign = rng.chance(0.7) ? -lastSign : lastSign; p = { len: rng.int(30, 60), k: lastSign / rng.range(Z.curveR[0], Z.curveR[1]) }; }
    p.gr = Z.grade + rng.range(-0.03, 0.04) + (rng.chance(0.15) ? 0.12 : 0);
    p.len = Math.min(p.len, rest); rest -= p.len;
    pieces.push(p);
  }
  for (const p of pieces) {
    for (let i = 0; i < p.len; i++, j++) {
      k += clamp(p.k - k, -0.0025, 0.0025);          // 곡률은 천천히 바뀐다
      gr += clamp(p.gr - gr, -0.006, 0.006);
      const prof = prev === Z.prof ? Z.prof : Prof.mix(prev, Z.prof, Math.min(1, j / 25));
      T.push(k, gr, prof, zone);
    }
  }
  run.zones.push({ zone, s0, s1: T.len });
}

// ══ 배치 ══
function addObst(run, kind, s, u, extra = {}) {
  const O = M.OBST[kind];
  run.obst.push(Object.assign({ kind, s, u, ru: O.ru || 0, rs: O.rs, h: O.h, low: !!O.low, hit: false }, extra));
}
function addCoin(run, s, u, z = 0.6, kind = 'fish') {
  run.coins.push({ s, u, z, kind, taken: false });
  if (kind === 'fish' && s < run.L) run.fishTotal++;
}

const PATTERNS = {
  coinLine(run, s0, Z, P) {
    const f = P.f, u0 = run.rng.range(-f * 0.8, f * 0.8), a = run.rng.range(0, f * 0.5);
    for (let i = 0; i < 10; i++) addCoin(run, s0 + i * 3, clamp(u0 + a * Math.sin(i * 0.5), -f, f));
    return 30;
  },
  slalom(run, s0, Z, P) {
    const side = run.rng.chance(0.5) ? 1 : -1, d = Math.max(0.9, P.f * 0.55);
    for (let i = 0; i < 4; i++) {
      const sg = i % 2 ? -side : side;
      addObst(run, run.rng.pick(Z.tall), s0 + i * 13, sg * d);
      addCoin(run, s0 + i * 13, -sg * d);
    }
    return 4 * 13;
  },
  wall3(run, s0, Z, P) {
    const n = Math.max(3, Math.floor((P.f * 2) / 1.6)), w = (P.f * 2) / n, gap = run.rng.int(0, n - 1);
    for (let i = 0; i < n; i++) {
      const u = -P.f + w * (i + 0.5);
      if (i === gap) { for (let j = 0; j < 4; j++) addCoin(run, s0 - 6 + j * 3, u); }
      else addObst(run, run.rng.pick(Z.tall), s0, u);
    }
    return 14;
  },
  jumpLow(run, s0, Z) {
    addObst(run, Z.low, s0 + 8, 0);
    for (let i = -2; i <= 2; i++) addCoin(run, s0 + 8 + i * 2.2, 0, 1.75 - Math.abs(i) * 0.2);
    return 18;
  },
  mover(run, s0, Z, P) {
    const half = Prof.half(P), amp = Z.mover === 'tractor' ? P.f * 0.7 : half * 0.5;
    addObst(run, Z.mover, s0 + 10, 0, { mv: { amp, w: run.rng.range(1.4, 2.0) * run.D.mover, ph: run.rng.range(0, 6.28) } });
    return 22;
  },
  boost(run, s0, Z, P) {
    const u = run.rng.range(-P.f * 0.5, P.f * 0.5);
    run.pads.push({ s: s0 + 4, u, used: false });
    for (let i = 0; i < 8; i++) addCoin(run, s0 + 10 + i * 4, u);
    return 44;
  },
  wallRide(run, s0, Z, P) {
    const k = run.track.K[Math.min(run.track.len, Math.round(s0 + 15))];
    if (Math.abs(k) < 0.006) return PATTERNS.coinLine(run, s0, Z, P);
    const side = k > 0 ? -1 : 1, half = Prof.half(P);
    for (let i = 0; i < 10; i++) addCoin(run, s0 + i * 3, side * (half - 0.7));
    return 30;
  },
  ramp(run, s0, Z, P) {
    const wide = P.f > 3, w = wide ? 4.2 : 3.4, h = 1.3, len = 6;
    const u = clamp(run.rng.range(-P.f * 0.4, P.f * 0.4), -P.f + w / 2, P.f - w / 2) || 0;
    run.ramps.push({ s: s0, len, u, w, h });
    const gr = run.track.GR[Math.min(run.track.len, Math.round(s0))];
    const v = run.D.vcap * run.vmul * (0.9 + (gr - 0.15) * 1.5), vz = v * PH.rampLaunch + 2;   // 목표 속도로 들어온다고 보고 궤적에 생선
    const air = (vz + Math.sqrt(vz * vz + 2 * PH.grav * h)) / PH.grav;
    for (let i = 1; i <= 9; i++) {
      const t = i * air / 10, z = h + vz * t - PH.grav * t * t / 2 + 0.5;
      if (z > 0.9) addCoin(run, s0 + len + v * t, u, z);
    }
    return len + v * air + 12;
  },
};
M.PATTERNS = PATTERNS;

function pickPattern(rng, w) {
  let tot = 0; for (const k in w) tot += w[k];
  let r = rng.next() * tot;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'coinLine';
}

function fillZone(run, zi, from, to) {
  const z = run.zones[zi], Z = M.ZONES[z.zone];
  let s = from;
  while (s < to - 20) {
    const P = run.track.PF[Math.min(run.track.len, Math.round(s + 10))];
    if (s - run.lastHeart > 380 && run.rng.chance(0.5)) {
      addCoin(run, s, 0, 0.6, 'heart'); run.lastHeart = s; s += 10; continue;
    }
    const used = PATTERNS[pickPattern(run.rng, Z.pat)](run, s, Z, P);
    s += used + run.D.gap * run.gapMul * run.rng.range(0.85, 1.2);
  }
}

// 끝없는 모드는 앞쪽을 계속 늘린다
function ensure(run, ahead) {
  while (run.endless && run.track.len < ahead) {
    const n = run.zones.length, zone = M.ZONE_ORDER[n % 4];
    run.lap = Math.floor(n / 4);
    run.vmul = Math.min(1.3, 1 + 0.05 * run.lap);
    run.gapMul = Math.max(0.5, Math.pow(0.9, run.lap)) * (n === 0 ? 1.2 : 1);
    buildZone(run, zone, M.ENDLESS_ZONE, n === 0 ? { straight: 50 } : {});
    const z = run.zones[n];
    fillZone(run, n, z.s0 + (n === 0 ? 60 : 25), z.s1 - 8);
  }
}

// ══ 한 판 ══
const Run = {
  create(diff = 'normal', course = 0, seed) {
    const D = M.DIFFS[diff];
    const endless = course === 'endless';
    const sd = seed != null ? seed : endless ? (Date.now() & 0x7fffffff) : 1000 + course * 37 + M.DIFF_ORDER.indexOf(diff) * 7;
    const run = {
      diff, D, course, endless, seed: sd, rng: M.makeRng(sd), track: new Track(), zones: [],
      obst: [], coins: [], ramps: [], pads: [], fishTotal: 0, lastHeart: 0,
      L: Infinity, lap: 0, vmul: 1, gapMul: 1,
      s: 10, u: 0, uv: 0, v: PH.startV, z: 0, vz: 0, air: false, spin: 0, onRamp: null,
      hearts: D.hearts, maxHearts: D.hearts, invuln: 0, boostT: 0, t: 0,
      fish: 0, crashes: 0, tricks: 0, bestTrick: 0, trickScore: 0, bonus: 0, phase: 'run', endT: 0, iO: 0, iC: 0,
    };
    if (endless) ensure(run, 500);
    else {
      const C = M.COURSES[course];
      run.L = C.zones.reduce((a, z) => a + z[1], 0);
      C.zones.forEach(([zone, len], i) => buildZone(run, zone, len, i === 0 ? { straight: 50 } : {}));
      const last = C.zones[C.zones.length - 1][0];
      buildZone(run, last, 170, { straight: 170 });                 // 결승선 뒤 감속 구간
      run.zones.pop();
      run.zones.forEach((z, i) => fillZone(run, i, z.s0 + (i === 0 ? 60 : 25), Math.min(z.s1, run.L - 40)));
    }
    return run;
  },
  score(run) {
    return run.fish * M.SCORE.fish + run.trickScore + run.bonus + (run.endless ? Math.floor(run.s) : 0);
  },
  stars(run) {
    if (run.endless || run.phase === 'over' || run.s < run.L) return 0;
    let n = 1;
    if (run.fish >= run.fishTotal * M.STAR_FISH) n++;
    if (run.crashes === 0) n++;
    return n;
  },
  moverU(o, t) { return o.mv ? o.mv.amp * Math.sin(o.mv.w * t + o.mv.ph) : o.u; },
  zoneAt(run, s) { return run.track.frame(s).zone; },
  progress(run) { return run.endless ? 0 : clamp(run.s / run.L, 0, 1); },
};
// 출발 로프를 놓는다 — power 0~1 에 따라 첫 속도, 93% 이상이면 부스트
Run.launch = function (run, power) {
  const L = PH.launch, p = clamp(power, 0, 1);
  run.v = run.D.vcap * run.vmul * (L.min + L.gain * p);
  const perfect = p >= L.perfect;
  if (perfect) run.boostT = PH.boostT;
  run.launchPower = p;
  return [{ type: 'launch', power: p, perfect }];
};
// 당긴 힘: 누른 시간 t 에 따라 0→1→0 을 오간다
Run.chargePower = function (t) {
  const x = (t / PH.launch.period) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
};

M.Run = Run;
M.ensure = ensure;

function crash(run, ev, kind) {
  if (run.invuln > 0 || run.phase !== 'run') return;
  run.hearts--; run.crashes++;
  run.v = Math.max(3, run.v * PH.crashSlow);
  run.invuln = PH.invuln; run.boostT = 0;
  ev.push({ type: 'crash', kind });
  if (run.hearts <= 0) { run.phase = 'over'; run.endT = 0; ev.push({ type: 'over' }); }
}

// 목표 속도 (경사·구역·부스트·벽 높이)
function capOf(run, fr) {
  let cap = run.D.vcap * run.vmul * (0.9 + (fr.gr - 0.15) * 1.5);
  if (run.boostT > 0) cap *= PH.boost;
  if (!run.air) { const r = Prof.rim(fr.prof); if (r > 0) cap *= 1 - 0.12 * Prof.h(fr.prof, run.u) / r; }
  return cap;
}

// inp: { steer: −1~1, jump: 이번 프레임에 눌렀는가 }
Run.step = function (run, dt, inp = {}) {
  const ev = [];
  if (run.phase === 'done') return ev;
  run.t += dt;
  if (run.endless) ensure(run, run.s + 420);
  const fr = run.track.frame(run.s), p = fr.prof, half = Prof.half(p);
  const steer = clamp(inp.steer || 0, -1, 1);

  // ── 속도 ──
  const ending = run.phase !== 'run';
  const cap = ending ? 0 : capOf(run, fr);
  run.v += (cap - run.v) * (ending ? 1.6 : PH.approach) * dt;
  run.v = Math.max(ending ? 0 : 2, run.v);
  run.s += run.v * dt;
  if (run.boostT > 0) run.boostT -= dt;
  if (run.invuln > 0) run.invuln -= dt;

  // ── 옆 ──
  if (!run.air) {
    const b = Prof.bank(p, run.u);
    const a = (ending ? 0 : steer * PH.steer) - run.uv * PH.damp - Math.sin(b) * Math.cos(b) * M.G * PH.wall - run.v * run.v * fr.k * PH.cf;
    run.uv += a * dt;
  } else {
    run.uv -= run.uv * PH.airDamp * dt;
    if (Math.abs(steer) > 0.2 && !ending) run.spin += Math.sign(steer) * PH.spinRate * dt;
  }
  run.u += run.uv * dt;
  const lim = half - 0.3;
  if (Math.abs(run.u) > lim) { run.u = Math.sign(run.u) * lim; run.uv = 0; }

  // ── 높이 · 도약대 · 점프 ──
  if (run.air) {
    run.vz -= PH.grav * dt; run.z += run.vz * dt;
    if (run.z <= 0 && run.vz < 0) {
      run.z = 0; run.vz = 0; run.air = false;
      const a = Math.abs(run.spin), n = Math.round(a / (Math.PI * 2)), off = Math.abs(a - n * Math.PI * 2);
      run.spin = 0;
      if (off > PH.spinTol) { ev.push({ type: 'wipeout' }); crash(run, ev, 'wipeout'); }
      else {
        ev.push({ type: 'land' });
        if (n >= 1 && run.phase === 'run') {
          const pts = M.SCORE.trick[Math.min(n, 4)];
          run.tricks++; run.trickScore += pts; run.bestTrick = Math.max(run.bestTrick, n);
          run.boostT = PH.trickBoostT;
          ev.push({ type: 'trick', n, pts });
        }
      }
    }
  } else {
    let ramp = null;
    for (const r of run.ramps) if (run.s >= r.s && run.s <= r.s + r.len && Math.abs(run.u - r.u) < r.w / 2) { ramp = r; break; }
    if (ramp) { run.z = ramp.h * (run.s - ramp.s) / ramp.len; run.onRamp = ramp; }
    else if (run.onRamp) {
      const r = run.onRamp; run.onRamp = null;
      run.air = true; run.spin = 0;
      if (run.s >= r.s + r.len) { run.z = r.h; run.vz = run.v * PH.rampLaunch + 2; ev.push({ type: 'ramp' }); }
      else run.vz = 0;   // 옆으로 미끄러져 떨어짐
    } else run.z = 0;
    if (inp.jump && !run.air && !ending) {
      run.air = true; run.vz = PH.jump + (run.onRamp ? 1 : 0); run.onRamp = null; run.spin = 0;
      ev.push({ type: 'jump' });
    }
  }

  // ── 장애물 ──
  while (run.iO < run.obst.length && run.obst[run.iO].s + run.obst[run.iO].rs < run.s - 3) run.iO++;
  for (let i = run.iO; i < run.obst.length; i++) {
    const o = run.obst[i];
    if (o.s - o.rs > run.s + 3) break;
    if (o.hit || run.z >= o.h) continue;
    if (Math.abs(run.s - o.s) > o.rs + 0.5) continue;
    if (!o.low && Math.abs(run.u - Run.moverU(o, run.t)) > o.ru + 0.4) continue;
    if (run.invuln > 0) continue;
    o.hit = true; crash(run, ev, o.kind);
  }

  // ── 생선 · 하트 · 부스트 발판 ──
  while (run.iC < run.coins.length && run.coins[run.iC].s < run.s - 3) run.iC++;
  for (let i = run.iC; i < run.coins.length; i++) {
    const c = run.coins[i];
    if (c.s > run.s + 3) break;
    if (c.taken || Math.abs(run.s - c.s) > 1.0 || Math.abs(run.u - c.u) > 1.15 || Math.abs(run.z + 0.5 - c.z) > 1.1) continue;
    c.taken = true;
    if (c.kind === 'heart') { run.hearts = Math.min(run.maxHearts, run.hearts + 1); ev.push({ type: 'heart' }); }
    else { run.fish++; ev.push({ type: 'fish' }); }
  }
  if (!run.air) for (const pd of run.pads) {
    if (pd.used || Math.abs(run.s - pd.s) > 1.6 || Math.abs(run.u - pd.u) > 1.3) continue;
    pd.used = true; run.boostT = PH.boostT; run.v = Math.max(run.v, run.D.vcap * run.vmul * 1.25);
    ev.push({ type: 'boost' });
  }

  // ── 결승 · 끝 ──
  if (run.phase === 'run' && run.s >= run.L) {
    run.phase = 'finish'; run.endT = 0; run.finishT = run.t;
    run.bonus += M.SCORE.finish + run.hearts * M.SCORE.heart;
    ev.push({ type: 'finish' });
  }
  if (run.phase === 'finish' || run.phase === 'over') {
    run.endT += dt;
    if (run.endT > 1.8) { run.phase = 'done'; ev.push({ type: 'done' }); }
  }
  return ev;
};
