// logic.js — 단식 랠리 시뮬레이션 (DOM·THREE 없음 · node 테스트에서 그대로 돈다)
// 입력 { mx, my, strong(이번 프레임 눌림), soft(이번 프레임 눌림), aim(-1|0|1) }
//   strong = 강타 (높으면 스매시, 중간 드라이브, 낮으면 리프트 / 서브는 하이 서브)
//   soft   = 연타 (높으면 드롭, 네트 앞 낮으면 헤어핀 / 서브는 숏 서브)
const M = window.MBD;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;
const W2 = M.SINGLE_W / 2;

// ── 셔틀 물리: 중력 + 속도 제곱 공기저항 ──
function accel(v) {
  const s = hyp(v.vx, v.vy, v.vz);
  return { ax: -M.DRAG * s * v.vx, ay: -M.DRAG * s * v.vy, az: -M.G - M.DRAG * s * v.vz };
}
function integrate(b, dt) {
  const a = accel(b);
  b.vx += a.ax * dt; b.vy += a.ay * dt; b.vz += a.az * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
}
// 앞으로 날려 보기 — 착지점 · 시간 · 네트 위 높이
function simulate(x, y, z, vx, vy, vz, maxT = 6) {
  const b = { x, y, z, vx, vy, vz };
  const dt = 1 / 120;
  let netZ = null, t = 0;
  const path = [];
  while (t < maxT) {
    const py = b.y;
    integrate(b, dt); t += dt;
    if (netZ === null && Math.sign(py) !== Math.sign(b.y) && py !== 0) netZ = b.z;
    if (path.length < 800 && Math.round(t * 120) % 3 === 0) path.push({ x: b.x, y: b.y, z: b.z, vz: b.vz, t });
    if (b.z <= 0) break;
  }
  return { x: b.x, y: b.y, t, netZ, path };
}
M.simulate = simulate;

// 목표 지점으로 가는 초속을 찾는다 (각도 고정, 속도 이분법). 네트에 걸리면 각도를 올린다.
function solve(fromX, fromY, fromZ, tx, ty, shot) {
  const dx = tx - fromX, dy = ty - fromY, D = hyp(dx, dy) || 1;
  const ux = dx / D, uy = dy / D;
  let angle = shot.angle;
  let best = null;
  for (let tries = 0; tries < 6; tries++) {
    const ca = Math.cos(angle * Math.PI / 180), sa = Math.sin(angle * Math.PI / 180);
    let lo = shot.minSpd, hi = shot.maxSpd;
    for (let i = 0; i < 18; i++) {
      const s = (lo + hi) / 2;
      const r = simulate(fromX, fromY, fromZ, ux * ca * s, uy * ca * s, sa * s);
      const range = (r.x - fromX) * ux + (r.y - fromY) * uy;
      if (range < D) lo = s; else hi = s;
    }
    const s = (lo + hi) / 2;
    best = { vx: ux * ca * s, vy: uy * ca * s, vz: sa * s, spd: s, angle };
    const r = simulate(fromX, fromY, fromZ, best.vx, best.vy, best.vz);
    if (r.netZ === null || r.netZ > M.NET_H + 0.12) break;
    angle += angle < 0 ? 5 : 7;
  }
  return best;
}
M.solve = solve;

function makePlayer(key, idx, side, D, human) {
  const P = M.PLAYERS[key];
  const k = human ? 1 : D.stat;
  return {
    idx, key, P, side, human,
    spd: P.spd * k, pow: P.pow * k, ctl: P.ctl * (human ? 1 : D.stat), reach: P.reach, jmp: P.jmp, h: P.h,
    x: 0, y: side * 3.6, z: 0, vz: 0, vx: 0, vy: 0, fx: 0, fy: -side,
    swing: null, swingCd: 0, state: 'idle',
    pts: 0, smashes: 0, winners: 0, errors: 0, hits: 0,
  };
}

function create(seed, myKey, oppKey, diff) {
  const D = M.DIFFS[diff];
  const st = {
    diff, D, rng: M.makeRng(seed), t: 0,
    pl: [makePlayer(myKey, 0, 1, D, true), makePlayer(oppKey, 1, -1, D, false)],
    sh: { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, held: 0, last: -1, serve: false, netHit: false, shot: null, landing: null },
    score: [0, 0], server: 0, phase: 'serve', phaseT: M.SERVE_T, winner: null,
    rally: 0, longest: 0, events: [],
  };
  setupServe(st, 0);
  return st;
}

// 서브 위치 — 서버 점수가 짝수면 오른쪽 코트, 대각선으로 넣는다
function setupServe(st, server) {
  st.server = server; st.phase = 'serve'; st.phaseT = M.SERVE_T; st.rally = 0; st.serveWait = 0;
  const s = st.pl[server], r = st.pl[1 - server];
  const even = st.score[server] % 2 === 0;
  const sx = s.side * (even ? 1 : -1) * 0.9;
  Object.assign(s, { x: sx, y: s.side * (M.SHORT_LINE + 0.7), z: 0, vz: 0, vx: 0, vy: 0, fx: 0, fy: -s.side, swing: null, state: 'idle' });
  Object.assign(r, { x: -sx, y: r.side * (M.SHORT_LINE + 1.4), z: 0, vz: 0, vx: 0, vy: 0, fx: 0, fy: -r.side, swing: null, state: 'idle' });
  Object.assign(st.sh, { held: server, last: -1, serve: true, netHit: false, shot: null, landing: null, vx: 0, vy: 0, vz: 0 });
  syncHeld(st);
  st.events.push({ type: 'serve-ready', server });
}
function syncHeld(st) {
  const b = st.sh;
  if (b.held === null) return;
  const p = st.pl[b.held];
  b.x = p.x + p.side * 0.25; b.y = p.y - p.side * 0.25; b.z = 1.05 * p.h;
}

// ── 타격 ──
function hit(st, p, kind, aim, contactQ) {
  const b = st.sh, rng = st.rng;
  let type;
  const z = b.z;
  if (b.held !== null) type = kind === 'strong' ? 'serveHigh' : 'serveShort';
  else if (kind === 'strong') type = z >= 2.0 * p.h ? 'smash' : z >= 1.05 && Math.abs(p.y) < 4.3 ? 'drive' : z >= 1.05 ? 'clear' : 'lift';
  else type = z >= 1.6 * p.h ? 'drop' : Math.abs(p.y) < 2.8 ? 'net' : 'drop';
  const shot = M.SHOTS[type];
  // 목표: 상대 코트 (y 부호 반대). 좌우 조준은 aim, 서브는 대각선
  const tSide = -p.side;
  let tx = aim * (W2 - 0.5);
  if (type === 'serveHigh' || type === 'serveShort') tx = -p.x * 1.1;
  let depth = shot.depth;
  if (type === 'smash') depth = clamp(shot.depth + (Math.abs(p.y) - 3) * 0.3, 2.4, 5.2);
  // 오차 — 컴퓨터는 난이도·정확도, 사람은 맞힌 자리(라켓 중심에 가까울수록 정확)
  const D = st.D;
  const errM = p.human ? (0.28 + (1 - contactQ) * 0.55) * D.myErr / p.ctl : D.err / p.ctl;
  const big = type === 'smash' ? 1.25 : type === 'net' ? 0.55 : type === 'drop' ? 0.7 : 1;
  tx += (rng.next() + rng.next() - 1) * errM * big;
  depth += (rng.next() + rng.next() - 1) * errM * big * 0.9;
  const ty = tSide * Math.max(0.35, depth);
  const fromZ = Math.max(0.35, z);
  let sol = solve(b.x, b.y, fromZ, tx, ty, shot);
  if (type === 'smash') {                                  // 파워 — 같은 낙하점이라도 빠르게
    const k = clamp(p.pow, 0.75, 1.3);
    sol = { vx: sol.vx * k, vy: sol.vy * k, vz: sol.vz * k, spd: sol.spd * k, angle: sol.angle };
  }
  // 낮은 확률로 네트에 꽂히는 실수 (사람·컴퓨터 공통, 정확도가 낮을수록)
  if (rng.next() < 0.035 * errM / 0.6 * (type === 'net' || type === 'drop' ? 1.6 : 1)) sol.vz -= 1.8;
  Object.assign(b, { held: null, x: b.x, y: b.y, z: fromZ, vx: sol.vx, vy: sol.vy, vz: sol.vz, last: p.idx, serve: type.startsWith('serve'), netHit: false, shot: type });
  const sim = simulate(b.x, b.y, b.z, b.vx, b.vy, b.vz);
  b.landing = { x: sim.x, y: sim.y, t: sim.t, path: sim.path, t0: st.t };
  p.hits++;
  if (type === 'smash') p.smashes++;
  st.rally++;
  st.events.push({ type: 'hit', idx: p.idx, shot: type, spd: hyp(sol.vx, sol.vy, sol.vz), q: contactQ });
}

// 라켓이 닿는가 — 수평 거리와 높이
function reachable(p, b) {
  const d = hyp(b.x - p.x, b.y - p.y);
  const r = M.REACH * p.reach * p.h + 0.12;
  const top = 2.55 * p.h + p.z + 0.2;
  if (d > r || b.z < 0.12 || b.z > top) return null;
  return 1 - d / r;                                         // 1 = 라켓 정중앙
}

function stepPlayer(st, p, inp, dt) {
  const b = st.sh;
  p.swingCd = Math.max(0, p.swingCd - dt);
  if (p.z > 0 || p.vz > 0) { p.vz -= M.G * 1.2 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }

  // 이동 (서브 대기 중 서버·리시버는 제자리)
  const frozen = st.phase === 'serve';
  let mx = frozen ? 0 : inp.mx || 0, my = frozen ? 0 : inp.my || 0;
  const mm = hyp(mx, my); if (mm > 1) { mx /= mm; my /= mm; }
  const top = M.SPD * p.spd * (p.swing ? 0.45 : 1) * (p.z > 0 ? 0.5 : 1);
  const tvx = mx * top, tvy = my * top;
  const ax = tvx - p.vx, ay = tvy - p.vy, am = hyp(ax, ay), lim = M.ACCEL * dt;
  if (am > lim && am > 1e-9) { p.vx += ax / am * lim; p.vy += ay / am * lim; } else { p.vx = tvx; p.vy = tvy; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, -W2 - 1.2, W2 + 1.2);
  p.y = p.side > 0 ? clamp(p.y, 0.35, M.HALF_L + 1.2) : clamp(p.y, -M.HALF_L - 1.2, -0.35);
  p.state = p.swing ? 'swing' : hyp(p.vx, p.vy) > 0.4 ? 'run' : 'idle';

  // 스윙 시작
  const press = inp.strong ? 'strong' : inp.soft ? 'soft' : null;
  if (press && !p.swing && p.swingCd <= 0) {
    if (st.phase === 'serve') {
      if (b.held === p.idx && st.phaseT <= 0) { p.swing = { t: 0, kind: press, aim: inp.aim || 0, done: true, high: false }; p.swingCd = M.SWING_CD; hit(st, p, press, inp.aim || 0, 1); st.phase = 'rally'; }
    } else {
      const high = b.held === null && b.z > 1.9 * p.h;
      p.swing = { t: 0, kind: press, aim: inp.aim || 0, done: false, high };
      p.swingCd = M.SWING_CD;
      if (press === 'strong' && high && p.z === 0 && b.z > 2.25 * p.h) { p.vz = M.JUMP_V * p.jmp; p.z = 0.001; }   // 점프 스매시
      st.events.push({ type: 'swing', idx: p.idx, kind: press, high });
    }
  }
  if (p.swing) {
    const s = p.swing;
    s.t += dt;
    if (!s.done && st.phase === 'rally' && b.held === null && b.last !== p.idx && s.t >= M.SWING_HIT[0] && s.t <= M.SWING_HIT[1]) {
      const onMySide = b.y * p.side > -0.4;
      const q = onMySide ? reachable(p, b) : null;
      if (q !== null) { s.done = true; hit(st, p, s.kind, inp.aim || s.aim, q); }
    }
    if (s.t >= M.SWING_T) p.swing = null;
  }
}

function stepShuttle(st, dt) {
  const b = st.sh;
  if (b.held !== null) { syncHeld(st); return; }
  const sub = 3, h = dt / sub;
  for (let i = 0; i < sub; i++) {
    const py = b.y;
    integrate(b, h);
    // 네트
    if (!b.netHit && Math.sign(py) !== Math.sign(b.y) && py !== 0 && b.z < M.NET_H && b.z > 0) {
      b.netHit = true;
      b.y = py; b.vy = -b.vy * 0.08; b.vx *= 0.3; b.vz = Math.min(b.vz, 0) * 0.3;
      st.events.push({ type: 'net' });
    }
    if (b.z <= 0) { b.z = 0; land(st); return; }
  }
}

function land(st) {
  const b = st.sh;
  const hitter = st.pl[b.last];
  const sideOfLand = b.y >= 0 ? 0 : 1;                       // 떨어진 쪽 선수
  let inside = Math.abs(b.x) <= W2 + 0.02 && Math.abs(b.y) <= M.HALF_L + 0.02;
  if (b.serve && Math.abs(b.y) < M.SHORT_LINE) inside = false; // 서브는 숏 서비스 라인을 넘어야
  let won, why;
  if (b.netHit && sideOfLand === hitter.idx) { won = 1 - hitter.idx; why = 'net'; }
  else if (sideOfLand === hitter.idx) { won = 1 - hitter.idx; why = 'own'; }
  else if (inside) { won = hitter.idx; why = 'in'; }
  else { won = 1 - hitter.idx; why = 'out'; }
  if (won === hitter.idx) hitter.winners++; else hitter.errors++;
  point(st, won, why, b.shot);
}

function point(st, won, why, shot) {
  st.score[won]++;
  st.pl[won].pts++;
  st.longest = Math.max(st.longest, st.rally);
  const [a, c] = st.score;
  const done = (Math.max(a, c) >= M.WIN && Math.abs(a - c) >= 2) || Math.max(a, c) >= M.CAP;
  st.events.push({ type: 'point', won, why, shot, rally: st.rally, score: st.score.slice() });
  st.phase = 'point'; st.phaseT = done ? 1.8 : 1.25; st.nextServer = won;
  if (done) { st.winner = won; st.events.push({ type: 'win', idx: won }); }
}

function step(st, dt, inputs) {
  st.events = [];
  if (st.phase === 'over') return st.events;
  st.t += dt;
  if (st.phase === 'point') {
    st.phaseT -= dt;
    for (const p of st.pl) { p.vx *= 0.85; p.vy *= 0.85; if (p.swing) { p.swing.t += dt; if (p.swing.t >= M.SWING_T) p.swing = null; } if (p.z > 0) { p.vz -= M.G * dt; p.z = Math.max(0, p.z + p.vz * dt); } }
    if (st.phaseT <= 0) {
      if (st.winner !== null) { st.phase = 'over'; st.events.push({ type: 'over', winner: st.winner }); }
      else setupServe(st, st.nextServer);
    }
    return st.events;
  }
  if (st.phase === 'serve') {
    st.phaseT -= dt;
    st.serveWait += dt;
    if (st.serveWait > M.SERVE_AUTO + M.SERVE_T) {           // 너무 오래 안 치면 자동 하이 서브
      const s = st.pl[st.server];
      hit(st, s, 'strong', 0, 1); st.phase = 'rally';
      st.events.push({ type: 'auto-serve', idx: s.idx });
    }
  }
  for (const p of st.pl) stepPlayer(st, p, inputs[p.idx] || {}, dt);
  if (st.phase === 'rally') stepShuttle(st, dt);
  else syncHeld(st);
  return st.events;
}

M.Logic = { create, step, simulate, solve, reachable, W2 };
