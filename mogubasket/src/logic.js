// logic.js — 1:1 하프코트 경기 시뮬레이션 (DOM·THREE 없음 · node 테스트에서 그대로 돈다)
// 선수 두 명이 같은 입력 형식 { mx, my, shoot(누르고 있음), act(이번 프레임 눌림) } 으로 움직인다.
//   act = 공을 가졌으면 크로스오버, 아니면 스틸.  shoot = 공을 가졌으면 슛(누르고 있다 놓기), 아니면 점프(블록)
const M = window.MBK;
const H = M.HOOP;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;
const distHoop = (x, y) => hyp(x - H.x, y - H.y);
// 2점 라인 바깥인가 (코너는 직선, 위는 호)
function outsideArc(x, y) {
  if (y < H.y + 1.4) return Math.abs(x) > M.CORNER_X;
  return distHoop(x, y) > M.ARC_R;
}
M.outsideArc = outsideArc;
M.distHoop = distHoop;

function makePlayer(key, idx, D, human) {
  const P = M.PLAYERS[key];
  const mul = human ? D.myBonus : D.stat;
  return {
    idx, key, P, human,
    spd: P.spd * (human ? 1 : D.stat), sht: P.sht * mul, hnd: P.hnd * (human ? 1 : D.stat), def: P.def * (human ? 1 : D.stat),
    jmp: P.jmp, h: P.h,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: -1,
    state: 'idle', stT: 0, crossCd: 0, stealCd: 0, crossSide: 1, shot: null, prevShoot: false,
    pts: 0, made: 0, att: 0, dunks: 0, steals: 0, blocks: 0, ankles: 0, reb: 0,
  };
}

function create(seed, myKey, oppKey, diff) {
  const D = M.DIFFS[diff];
  const st = {
    diff, D, rng: M.makeRng(seed), t: 0,
    pl: [makePlayer(myKey, 0, D, true), makePlayer(oppKey, 1, D, false)],
    ball: { x: 0, y: 8, z: 1, vx: 0, vy: 0, vz: 0, holder: null, shot: null, rimT: 0, spin: 0, lastTouch: 0, airT: 0 },
    off: 0, cleared: true, shotClock: M.SHOT_CLOCK,
    phase: 'check', phaseT: M.CHECK_T, score: [0, 0], winner: null,
    slow: 0, events: [],
  };
  setupCheck(st, 0);
  return st;
}

// 체크 볼 — 공격은 탑, 수비는 그 앞
function setupCheck(st, off) {
  st.off = off; st.cleared = true; st.shotClock = M.SHOT_CLOCK;
  st.phase = 'check'; st.phaseT = M.CHECK_T;
  const a = st.pl[off], d = st.pl[1 - off];
  Object.assign(a, { x: M.CHECK.x, y: M.CHECK.y, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: -1, state: 'idle', stT: 0, shot: null });
  Object.assign(d, { x: M.CHECK.x, y: M.CHECK.y - 1.5, z: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 1, state: 'idle', stT: 0, shot: null });
  Object.assign(st.ball, { holder: off, shot: null, vx: 0, vy: 0, vz: 0, airT: 0, lastTouch: off });
  st.events.push({ type: 'check', off });
}

function giveBall(st, p, why) {
  const b = st.ball;
  const was = st.off;
  b.holder = p.idx; b.shot = null; b.lastTouch = p.idx; b.airT = 0;
  if (p.idx !== was) {                      // 수비가 잡음 → 공수 교대, 2점 라인 밖으로 빼야 한다
    st.off = p.idx; st.cleared = outsideArc(p.x, p.y);
    st.events.push({ type: 'turnover', idx: p.idx, why, cleared: st.cleared });
  }
  st.shotClock = M.SHOT_CLOCK;
  if (why === 'rebound') p.reb++;
  st.events.push({ type: 'pick', idx: p.idx, why });
}

function loose(st, x, y, z, vx, vy, vz, who) {
  Object.assign(st.ball, { holder: null, shot: null, x, y, z, vx, vy, vz, lastTouch: who, airT: 0 });
}

// ── 슛 판정 ──
function shotBase(d) {                       // 거리별 기본 성공률 (완벽한 릴리스 · 노마크 기준)
  if (d < M.LAYUP_R) return 0.86;
  return clamp(0.8 - 0.05 * (d - 2), 0.42, 0.8);
}
function releaseQuality(m) {
  const e = m < M.SWEET[0] ? M.SWEET[0] - m : m > M.SWEET[1] ? m - M.SWEET[1] : 0;
  return clamp(1 - e * 3.2, 0, 1);
}
M.releaseQuality = releaseQuality;
function contestOf(st, shooter) {            // 0(노마크) ~ 1(코앞에서 뛰어 막음)
  const d = st.pl[1 - shooter.idx];
  const dist = hyp(d.x - shooter.x, d.y - shooter.y);
  if (d.state === 'stumble') return 0;
  const near = clamp((1.8 - dist) / 1.8, 0, 1);
  return near * (d.z > 0.15 ? 1 : 0.55) * clamp(d.def, 0.6, 1.4);
}

function launch(st, p, quality, kind) {      // 공을 띄운다 — 성공이면 림 중앙, 실패면 림 가장자리를 노린다
  const b = st.ball, rng = st.rng;
  const d = distHoop(p.x, p.y);
  const pts = outsideArc(p.x, p.y) ? 2 : 1;
  const contest = contestOf(st, p);
  const prob = clamp(shotBase(d) * p.sht * (0.3 + 0.7 * quality) * (1 - 0.5 * contest), 0.03, 0.97);
  const make = rng.next() < prob;
  const rx = p.x + p.fx * 0.2, ry = p.y + p.fy * 0.2, rz = 2.05 * p.h + p.z;
  let tx = H.x, ty = H.y, tz = H.z + 0.04;
  if (!make) {
    const a = rng.range(0, Math.PI * 2);
    const off = rng.range(0.26, 0.42);
    tx += Math.cos(a) * off; ty += Math.sin(a) * off * 0.8 + (ty > H.y ? 0 : 0.1);
  }
  const T = 0.75 + d * 0.07;
  loose(st, rx, ry, rz, (tx - rx) / T, (ty - ry) / T, (tz - rz + 0.5 * M.G * T * T) / T, p.idx);
  b.shot = { idx: p.idx, pts, kind, make, prob, quality, contest, t: 0, rim: false, blockChecked: false };
  b.spin = 1;
  p.att++;
  st.events.push({ type: 'release', idx: p.idx, kind, quality, prob, pts, make });
}

// ── 공 물리 (림 · 백보드 · 바닥 · 펜스) ──
function stepBall(st, dt) {
  const b = st.ball;
  if (b.holder !== null) return;
  b.airT += dt;
  const sub = 4, h = dt / sub;
  for (let i = 0; i < sub; i++) {
    const pz = b.z;
    b.vz -= M.G * h;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    // 득점: 림 높이를 아래로 지나가며 림 안쪽
    if (pz >= H.z && b.z < H.z && hyp(b.x - H.x, b.y - H.y) < M.RIM_R - M.BALL_R * 0.35 && b.shot && !b.shot.scored) {
      b.shot.scored = true;
      score(st, b.shot);
    }
    // 림 (원형 고리와 공의 충돌)
    const dx = b.x - H.x, dy = b.y - H.y, r = hyp(dx, dy) || 1e-6;
    const px = H.x + dx / r * M.RIM_R, py = H.y + dy / r * M.RIM_R;
    const nx = b.x - px, ny = b.y - py, nz = b.z - H.z, nd = hyp(nx, ny, nz);
    if (nd < M.BALL_R + 0.012) {
      const ux = nx / nd, uy = ny / nd, uz = nz / nd;
      const vn = b.vx * ux + b.vy * uy + b.vz * uz;
      if (vn < 0) {
        const e = 0.55;
        b.vx -= (1 + e) * vn * ux; b.vy -= (1 + e) * vn * uy; b.vz -= (1 + e) * vn * uz;
        b.vx += st.rng.range(-0.25, 0.25); b.vy += st.rng.range(-0.15, 0.25);
        if (b.shot && !b.shot.rim) { b.shot.rim = true; st.shotClock = M.SHOT_CLOCK; st.events.push({ type: 'rim' }); }
      }
      const push = M.BALL_R + 0.012 - nd;
      b.x += ux * push; b.y += uy * push; b.z += uz * push;
    }
    // 백보드
    if (b.y - M.BALL_R < M.BOARD_Y && b.vy < 0 && Math.abs(b.x) < M.BOARD_W / 2 && b.z > M.BOARD_Z0 && b.z < M.BOARD_Z1 && b.y > M.BOARD_Y - 0.3) {
      b.y = M.BOARD_Y + M.BALL_R; b.vy = -b.vy * 0.6;
      st.events.push({ type: 'board' });
    }
    // 바닥
    if (b.z < M.BALL_R) {
      b.z = M.BALL_R;
      if (b.vz < -0.6) st.events.push({ type: 'bounce', v: -b.vz });
      b.vz = Math.abs(b.vz) > 0.6 ? -b.vz * 0.66 : 0;
      b.vx *= 0.9; b.vy *= 0.9;
    }
    // 옥상 펜스
    const lx = M.COURT_W / 2 + 0.6;
    if (Math.abs(b.x) > lx) { b.x = Math.sign(b.x) * lx; b.vx = -b.vx * 0.5; }
    if (b.y < 0.1) { b.y = 0.1; b.vy = -b.vy * 0.5; }
    if (b.y > M.COURT_L + 0.6) { b.y = M.COURT_L + 0.6; b.vy = -b.vy * 0.5; }
  }
  if (b.z <= M.BALL_R + 0.001 && hyp(b.vx, b.vy) < 0.05) { b.vx = b.vy = 0; }
  if (b.shot) b.shot.t += dt;
}

function score(st, shot) {
  const p = st.pl[shot.idx];
  st.score[shot.idx] += shot.pts;
  p.pts += shot.pts; p.made++;
  if (shot.kind === 'dunk') p.dunks++;
  st.events.push({ type: 'score', idx: shot.idx, pts: shot.pts, kind: shot.kind, total: st.score.slice() });
  if (st.score[shot.idx] >= M.WIN_SCORE) {
    st.winner = shot.idx;
    st.phase = 'after'; st.phaseT = 1.6;
    st.events.push({ type: 'win', idx: shot.idx });
  } else {
    st.phase = 'after'; st.phaseT = 1.0;
    st.nextOff = 1 - shot.idx;              // 넣은 쪽이 아니라 먹힌 쪽 공격 (교대)
  }
}

// ── 선수 한 명 ──
function stepPlayer(st, p, inp, dt) {
  const b = st.ball;
  const o = st.pl[1 - p.idx];
  const hasBall = b.holder === p.idx;
  const pressShoot = inp.shoot && !p.prevShoot;
  const releaseShoot = !inp.shoot && p.prevShoot;
  p.prevShoot = !!inp.shoot;
  p.crossCd = Math.max(0, p.crossCd - dt);
  p.stealCd = Math.max(0, p.stealCd - dt);
  p.stT = Math.max(0, p.stT - dt);

  // 점프 높이
  if (p.z > 0 || p.vz > 0) {
    p.vz -= M.G * 1.15 * dt; p.z += p.vz * dt;
    if (p.z <= 0) { p.z = 0; p.vz = 0; if (p.state === 'block') p.state = 'idle'; }
  }

  // 상태별
  if (p.state === 'stumble') {                       // 앵클 브레이크 — 주저앉아 못 움직임
    p.vx *= 0.8; p.vy *= 0.8;
    if (p.stT <= 0) p.state = 'idle';
    move(st, p, dt); return;
  }
  if (p.state === 'dunk') { stepDunk(st, p, dt); return; }
  if (p.state === 'shoot') { stepShot(st, p, inp, releaseShoot, dt); return; }
  if ((p.state === 'cross' || p.state === 'reach' || p.state === 'off') && p.stT <= 0) p.state = 'idle';

  // 입력 → 목표 속도
  let mx = inp.mx || 0, my = inp.my || 0;
  const mm = hyp(mx, my);
  if (mm > 1) { mx /= mm; my /= mm; }
  let top = M.SPD * p.spd * (hasBall ? M.DRIBBLE_SPD : 1);
  if (p.state === 'off') top *= 0.3;
  if (hasBall && inFront(p, o) < 0.95) top *= 0.6;                     // 수비가 코앞을 막으면 느려진다
  if (p.z > 0) top *= 0.4;
  if (p.state !== 'cross' && p.state !== 'reach') {
    const tvx = mx * top, tvy = my * top;
    const ax = tvx - p.vx, ay = tvy - p.vy, am = hyp(ax, ay), lim = M.ACCEL * dt;
    if (am > lim && am > 1e-9) { p.vx += ax / am * lim; p.vy += ay / am * lim; } else { p.vx = tvx; p.vy = tvy; }
  }
  if (mm > 0.2) { const k = hyp(mx, my); p.fx = mx / k; p.fy = my / k; }
  if (p.state === 'idle' || p.state === 'run') p.state = hyp(p.vx, p.vy) > 0.5 ? 'run' : 'idle';

  if (hasBall) {
    // 슛 시작
    if (pressShoot && st.phase === 'live') {
      if (!st.cleared) { st.events.push({ type: 'need-clear', idx: p.idx }); }
      else startShot(st, p);
    }
    // 크로스오버
    if (inp.act && p.crossCd <= 0 && p.state !== 'shoot') crossover(st, p, o);
  } else {
    if (pressShoot && p.z === 0 && p.state !== 'off') {   // 수비 점프 (블록)
      p.vz = M.JUMP_V * p.jmp; p.z = 0.001; p.state = 'block';
      st.events.push({ type: 'jump', idx: p.idx });
    }
    if (inp.act && p.stealCd <= 0 && b.holder === o.idx) steal(st, p, o);
  }
  move(st, p, dt);
}

// 수비 o가 p와 골대 사이 정면에 있으면 그 거리, 아니면 큰 값
function inFront(p, o) {
  let hx = H.x - p.x, hy = H.y - p.y; const hm = hyp(hx, hy) || 1; hx /= hm; hy /= hm;
  const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
  if (o.state === 'stumble' || d < 1e-4) return 99;
  return (dx * hx + dy * hy) / d > 0.55 ? d : 99;
}

function move(st, p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, -M.COURT_W / 2 + 0.3, M.COURT_W / 2 - 0.3);
  p.y = clamp(p.y, 0.45, M.COURT_L - 0.2);
  // 골대 기둥 뒤로는 못 감
  if (p.y < M.BOARD_Y + 0.15 && Math.abs(p.x) < 1.0) p.y = M.BOARD_Y + 0.15;
}

function collidePlayers(st) {
  const [a, c] = st.pl;
  const dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
  const min = M.PR * 2;
  if (d < min && d > 1e-4) {
    const push = (min - d) / 2, ux = dx / d, uy = dy / d;
    // 수비가 자리를 지키면 공 가진 쪽이 더 밀린다 (몸싸움 — 정면 돌파로는 못 뚫는다)
    const wa = st.ball.holder === a.idx ? 0.65 : st.ball.holder === c.idx ? 0.35 : 0.5;
    a.x -= ux * push * 2 * wa; a.y -= uy * push * 2 * wa;
    c.x += ux * push * 2 * (1 - wa); c.y += uy * push * 2 * (1 - wa);
  }
}

function crossover(st, p, o) {
  // 골대 쪽을 기준으로 좌우를 번갈아 튼다
  let hx = H.x - p.x, hy = H.y - p.y; const hm = hyp(hx, hy) || 1; hx /= hm; hy /= hm;
  p.crossSide = -p.crossSide;
  const sx = -hy * p.crossSide, sy = hx * p.crossSide;
  const v = M.CROSS_V * clamp(p.hnd, 0.7, 1.3);
  p.vx = (sx * 0.85 + hx * 0.5) * v; p.vy = (sy * 0.85 + hy * 0.5) * v;
  p.state = 'cross'; p.stT = M.CROSS_T; p.crossCd = M.CROSS_CD;
  st.events.push({ type: 'cross', idx: p.idx, side: p.crossSide });
  // 앵클 브레이크 — 수비가 코앞에서 막고 있을 때
  const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
  const front = (dx * hx + dy * hy) / (d || 1);
  if (d < 1.8 && front > 0.3 && o.state !== 'stumble' && o.z === 0) {
    let ch = clamp(0.14 + (p.hnd - o.def) * 0.45, 0.04, 0.5);
    if (!o.human) ch *= 0.55 + st.D.react * 1.4;         // 컴퓨터 수비는 난이도가 낮을수록 잘 넘어진다
    if (o.state === 'reach') ch *= 2.2;                   // 손 뻗다 걸리면 크게 휘청
    if (st.rng.next() < ch) {
      o.state = 'stumble'; o.stT = M.STUMBLE_T; p.ankles++;
      st.events.push({ type: 'ankle', idx: o.idx, by: p.idx });
    }
  }
}

function steal(st, p, o) {
  const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy) || 1;
  p.vx = dx / d * M.STEAL_V; p.vy = dy / d * M.STEAL_V; p.fx = dx / d; p.fy = dy / d;
  p.state = 'reach'; p.stT = M.STEAL_T; p.stealCd = M.STEAL_CD;
  st.events.push({ type: 'reach', idx: p.idx });
  if (d > M.STEAL_R || o.state === 'dunk' || (o.state === 'shoot' && o.shot && o.shot.phase !== 'gather')) {
    p.state = 'off'; p.stT = M.REACH_MISS_T; return;
  }
  let ch = clamp(0.26 * p.def / o.hnd, 0.06, 0.5);
  if (o.state === 'cross') ch *= 0.4;
  if (o.state === 'shoot') ch *= 1.6;                     // 슛 모으는 동작은 털린다
  if (st.rng.next() < ch) {
    const b = st.ball;
    o.state = o.state === 'shoot' ? 'idle' : o.state; o.shot = null;
    loose(st, o.x, o.y, 1.0, dx / d * -0.5 + (st.rng.next() - 0.5), dy / d * -0.5 + (st.rng.next() - 0.5), 2.2, p.idx);
    b.stolenBy = p.idx;
    p.steals++;
    st.events.push({ type: 'steal', idx: p.idx });
  } else {
    p.state = 'off'; p.stT = M.REACH_MISS_T;
  }
}

function startShot(st, p) {
  const d = distHoop(p.x, p.y);
  const speed = hyp(p.vx, p.vy);
  if (d < M.LAYUP_R) {
    const o = st.pl[1 - p.idx];
    if (p.P.dunk && d < M.DUNK_R && (speed > 3.0 || d < 1.0) && inFront(p, o) > 1.3) {   // 앞이 막혔으면 레이업
      p.state = 'dunk'; p.stT = 0;
      p.dunk = { t: 0, x0: p.x, y0: p.y, blocked: false, contest: contestOf(st, p) };
      st.events.push({ type: 'dunk-start', idx: p.idx });
      return;
    }
    p.state = 'shoot';
    p.shot = { phase: 'gather', t: 0, m: 0, layup: true };
    st.events.push({ type: 'gather', idx: p.idx, layup: true });
    return;
  }
  p.state = 'shoot';
  p.shot = { phase: 'gather', t: 0, m: 0, layup: false };
  // 골대를 바라보고 쏜다
  const hx = H.x - p.x, hy = H.y - p.y, hm = hyp(hx, hy);
  p.fx = hx / hm; p.fy = hy / hm;
  st.events.push({ type: 'gather', idx: p.idx });
}

function stepShot(st, p, inp, released, dt) {
  const s = p.shot;
  s.t += dt;
  p.vx *= 0.85; p.vy *= 0.85;
  const hx = H.x - p.x, hy = H.y - p.y, hm = hyp(hx, hy);
  p.fx = hx / hm; p.fy = hy / hm;
  if (s.layup) {                                 // 레이업 — 골대 쪽으로 두 걸음, 0.4초 뒤 자동으로 올려놓는다
    p.x += p.fx * 2.0 * dt; p.y += p.fy * 2.0 * dt;
    if (s.phase === 'gather' && s.t > 0.12) { s.phase = 'air'; p.vz = M.JUMP_V * 0.8 * p.jmp; p.z = 0.001; }
    if (s.t > 0.4) { p.shot = null; p.state = 'idle'; launch(st, p, 0.9, 'layup'); }
    move(st, p, dt);
    return;
  }
  if (s.phase === 'gather') {
    if (s.t >= M.GATHER_T) { s.phase = 'air'; s.t = 0; p.vz = M.JUMP_V * 0.72 * p.jmp; p.z = 0.001; }
    move(st, p, dt);
    return;
  }
  s.m = s.t / M.METER_T;
  if (released || s.m >= 1.08) {               // 손을 떼면 그 순간의 게이지로 판정 (끝까지 들고 있으면 늦은 릴리스)
    const q = releaseQuality(s.m);
    p.shot = null; p.state = 'idle';
    st.events.push({ type: 'meter', idx: p.idx, m: s.m, q });
    launch(st, p, q, 'jumper');
  }
  move(st, p, dt);
}

function stepDunk(st, p, dt) {
  const k = p.dunk;
  k.t += dt;
  const T = 0.62;
  const u = Math.min(1, k.t / T);
  const tx = H.x, ty = H.y + 0.45;
  p.x = k.x0 + (tx - k.x0) * u; p.y = k.y0 + (ty - k.y0) * u;
  p.z = Math.sin(u * Math.PI * 0.5) * (0.85 + 0.35 * p.jmp);
  p.fx = 0; p.fy = -1;
  const o = st.pl[1 - p.idx];
  if (!k.checked && u > 0.55) {                  // 수비가 림 앞에서 뛰어 있으면 막힐 수 있다
    k.checked = true;
    const dd = hyp(o.x - H.x, o.y - (H.y + 0.6));
    if (o.z > 0.3 && dd < 1.8 && o.state !== 'stumble') {
      const ch = clamp(0.42 * o.def * o.jmp / p.h, 0.1, 0.65);
      if (st.rng.next() < ch) {
        k.blocked = true;
        p.state = 'idle'; p.dunk = null; p.vz = -1;
        loose(st, p.x, p.y + 0.4, 2.8, st.rng.range(-3, 3), 4.5, 1.5, o.idx);
        o.blocks++; p.att++;
        st.events.push({ type: 'block', idx: o.idx, dunk: true });
        return;
      }
    }
  }
  if (u >= 1) {                                  // 꽂는다 — 따라붙은 수비가 있으면 림을 맞고 튈 수 있다
    p.att++;
    const c = Math.max(k.contest, contestOf(st, p));
    if (st.rng.next() > clamp(0.95 - c * 0.55, 0.4, 0.95)) {
      loose(st, H.x + st.rng.range(-0.3, 0.3), H.y + 0.3, H.z + 0.15, st.rng.range(-2, 2), 2.5, 3.2, p.idx);
      st.ball.shot = { idx: p.idx, pts: 1, kind: 'dunk', make: false, t: 0.5, rim: true };
      p.state = 'hang'; p.stT = 0.3; p.dunk = null; p.vz = 0;
      st.events.push({ type: 'rim' }); st.events.push({ type: 'dunk-miss', idx: p.idx });
      return;
    }
    loose(st, H.x, H.y, H.z + 0.25, 0, 0, -5, p.idx);
    st.ball.shot = { idx: p.idx, pts: 1, kind: 'dunk', make: true, t: 0, rim: true };
    p.state = 'hang'; p.stT = 0.35; p.dunk = null; p.vz = 0;
    st.events.push({ type: 'dunk', idx: p.idx });
    st.slow = 0.9;
  }
}

// 막 쏜 슛을 수비가 뛰어서 쳐 낼 수 있는지 (공이 아직 올라가는 짧은 순간)
function checkBlock(st) {
  const b = st.ball, s = b.shot;
  if (!s || s.blockChecked || s.kind === 'dunk') return;
  if (s.t > 0.22) { s.blockChecked = true; return; }
  const o = st.pl[1 - s.idx];
  const d = hyp(o.x - b.x, o.y - b.y);
  if (o.z > 0.2 && d < M.BLOCK_R && b.z < 2.3 * o.h + o.z + 0.4) {
    s.blockChecked = true;
    const shooter = st.pl[s.idx];
    const ch = clamp(0.2 * o.def * o.jmp * (s.kind === 'layup' ? 1.3 : 1) / shooter.h, 0.04, 0.45);
    if (st.rng.next() < ch) {
      loose(st, b.x, b.y, b.z, (b.x - o.x) * 3 + st.rng.range(-2, 2), (b.y - o.y) * 3 + 2.5, -1, o.idx);
      o.blocks++;
      st.events.push({ type: 'block', idx: o.idx });
    }
  }
}

function tryPickups(st) {
  const b = st.ball;
  if (b.holder !== null) return;
  let best = null, bd = 1e9;
  for (const p of st.pl) {
    if (p.state === 'stumble' || p.state === 'dunk' || p.state === 'hang') continue;
    if (b.shot && b.shot.idx === p.idx && b.shot.t < 0.45) continue;      // 막 쏜 사람은 바로 못 잡음
    const reachZ = 2.35 * p.h + p.z;
    if (b.shot && !b.shot.rim && b.z > H.z - 0.2 && distHoop(b.x, b.y) < 1.2) continue;  // 림 위 공은 못 건드림
    const d = hyp(b.x - p.x, b.y - p.y);
    if (d < M.PICK_R && b.z < reachZ && d < bd) { bd = d; best = p; }
  }
  if (best) {
    const why = b.stolenBy === best.idx ? 'steal' : b.shot ? 'rebound' : 'loose';
    b.stolenBy = undefined;
    giveBall(st, best, why);
  }
}

// ── 한 프레임 ──
function step(st, dt, inputs) {
  st.events = [];
  if (st.phase === 'over') return st.events;
  if (st.slow > 0) { st.slow -= dt; dt *= 0.4; }
  st.t += dt;
  const b = st.ball;

  if (st.phase === 'check') {
    st.phaseT -= dt;
    if (st.phaseT <= 0) { st.phase = 'live'; st.events.push({ type: 'live', off: st.off }); }
    syncHeld(st);
    return st.events;
  }
  if (st.phase === 'after') {                         // 득점 뒤 잠깐 — 공은 그물을 빠져나와 떨어진다
    st.phaseT -= dt;
    stepBall(st, dt);
    for (const p of st.pl) { p.vx *= 0.9; p.vy *= 0.9; if (p.z > 0 || p.vz > 0) { p.vz -= M.G * 1.15 * dt; p.z = Math.max(0, p.z + p.vz * dt); } if (p.state === 'hang') { p.stT -= dt; if (p.stT <= 0) p.state = 'idle'; } }
    if (st.phaseT <= 0) {
      if (st.winner !== null) { st.phase = 'over'; st.events.push({ type: 'over', winner: st.winner }); }
      else setupCheck(st, st.nextOff);
    }
    return st.events;
  }

  for (const p of st.pl) {
    if (p.state === 'hang') { p.stT -= dt; if (p.stT <= 0) { p.state = 'idle'; p.z = 0; } continue; }
    stepPlayer(st, p, inputs[p.idx] || {}, dt);
  }
  collidePlayers(st);

  // 클리어 확인
  if (!st.cleared && b.holder !== null && outsideArc(st.pl[b.holder].x, st.pl[b.holder].y)) {
    st.cleared = true; st.events.push({ type: 'cleared', idx: b.holder });
  }

  stepBall(st, dt);
  checkBlock(st);
  if (st.phase !== 'live') return st.events;
  tryPickups(st);
  syncHeld(st);

  // 샷 클락 — 공격권을 가진 쪽이 공을 쥐고 있거나 흘린 동안 줄어든다 (림에 맞으면 리셋)
  if (!(b.shot && b.shot.t < 3)) {
    st.shotClock -= dt;
    if (st.shotClock <= 0) {
      st.events.push({ type: 'violation', idx: st.off });
      setupCheck(st, 1 - st.off);
    }
  }
  return st.events;
}

// 쥔 공은 손 위치에 붙인다 (드리블 높이는 렌더가 흔든다)
function syncHeld(st) {
  const b = st.ball;
  if (b.holder === null) return;
  const p = st.pl[b.holder];
  const sx = -p.fy, sy = p.fx;                       // 오른손 쪽
  b.x = p.x + p.fx * 0.3 + sx * 0.28; b.y = p.y + p.fy * 0.3 + sy * 0.28;
  b.z = p.state === 'shoot' || p.state === 'dunk' ? 2.0 * p.h + p.z : 0.7;
  b.vx = b.vy = b.vz = 0;
}

M.Logic = { create, step, outsideArc, distHoop, releaseQuality, shotBase, contestOf };
