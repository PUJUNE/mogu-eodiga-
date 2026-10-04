// logic.js — 주방 시뮬레이션 (DOM 없음 · node 테스트에서 그대로 돈다)
// 좌표는 주방 기준(HUD 제외): x 0..W, y 0..ROWS*TILE
const M = window.MSP;
const T = M.TILE;

const clone = (o) => JSON.parse(JSON.stringify(o));
const key = (s) => s.c + '/' + s.f;

function tileAt(st, c, r) {
  if (c < 0 || r < 0 || c >= M.COLS || r >= M.ROWS) return null;
  return st.grid[r][c];
}
const isWalk = (tile) => !!tile && (tile.kind === 'floor' || tile.kind === 'door');
const holdsItem = (tile) => tile && (tile.kind === 'counter' || tile.kind === 'board' || tile.kind === 'belt');

function create(seed, stageIdx, diff) {
  const S = M.STAGES[stageIdx];
  const D = M.DIFFS[diff];
  const rng = M.makeRng(seed);
  const grid = S.map.map((row, r) => row.split('').map((ch, c) => {
    const kind = M.TILE_KIND[ch] || 'floor';
    const t = { kind, ch, c, r, item: null, work: 0 };
    if (kind === 'steamer') t.steam = [];
    if (kind === 'belt') t.dir = M.BELT_DIR[ch];
    return t;
  }));
  let door = null;
  for (const row of grid) for (const t of row) if (t.kind === 'door') door = t;
  return {
    stage: stageIdx, diff, S, D, rng, grid, door,
    t: 0, timeLeft: S.time, phase: 'play', hurried: false,
    p: { x: (S.sx + 0.5) * T, y: (S.sy + 0.5) * T, fx: 0, fy: 1, held: null,
         dashT: 0, dashCd: 0, vx: 0, vy: 0, working: false, workTick: 0 },
    orders: [], nextOrderAt: 1.5, orderSeq: 0,
    kiwis: [], nextKiwiAt: S.kiwi ? 40 / D.kiwi : Infinity,
    score: 0, served: 0, songsServed: 0, missed: 0, wrong: 0, shooed: 0, pecked: 0, combo: 0, bestCombo: 0,
    events: [],
  };
}

// ── 주문 ──
function makeOrder(st) {
  const { rng, S, D } = st;
  const roll = rng.next();
  let n = roll < 0.7 ? 1 : roll < 0.95 ? 2 : 3;
  n = Math.min(n, S.maxItems);
  const items = [];
  for (let i = 0; i < n; i++) items.push({ c: rng.pick(S.doughs), f: rng.pick(S.fillings) });
  items.sort((a, b) => key(a) < key(b) ? -1 : 1);
  const max = (70 + 30 * n) * D.time;
  return { id: ++st.orderSeq, items, t: max, max, cust: rng.pick(M.CUSTOMERS) };
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const ka = a.map(key).sort(), kb = b.map(key).sort();
  return ka.every((k, i) => k === kb[i]);
}

function serve(st, plate) {
  const songs = plate.songs;
  const ok = songs.length > 0 && songs.every((s) => !s.hole);
  const ord = ok ? st.orders.find((o) => sameSet(o.items, songs)) : null;
  if (!ord) {
    st.score = Math.max(0, st.score - M.PENALTY_WRONG);
    st.wrong++; st.combo = 0;
    st.events.push({ type: 'wrong', hole: songs.some((s) => s.hole) });
    return;
  }
  st.orders.splice(st.orders.indexOf(ord), 1);
  st.combo = Math.min(M.COMBO_MAX, st.combo + 1);
  st.bestCombo = Math.max(st.bestCombo, st.combo);
  const n = songs.length;
  const tip = Math.round(M.TIP_EACH * n * (ord.t / ord.max) * st.combo);
  const pts = M.PTS_EACH * n + tip;
  st.score += pts;
  st.served++; st.songsServed += n;
  st.events.push({ type: 'serve', pts, tip, combo: st.combo, n });
  if (st.orders.length === 0) st.nextOrderAt = Math.min(st.nextOrderAt, st.t + 1.2);
}

// ── 이동 · 충돌 ──
function collide(st, p) {
  for (let pass = 0; pass < 2; pass++) {
    const c0 = Math.floor(p.x / T), r0 = Math.floor(p.y / T);
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      const tile = tileAt(st, c, r);
      if (tile && isWalk(tile)) continue;
      const x0 = c * T, y0 = r * T;
      const nx = Math.max(x0, Math.min(p.x, x0 + T)), ny = Math.max(y0, Math.min(p.y, y0 + T));
      const dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
      if (d < M.PR) {
        if (d > 0.0001) { p.x += dx / d * (M.PR - d); p.y += dy / d * (M.PR - d); }
        else { p.y += M.PR; }
      }
    }
  }
  p.x = Math.max(M.PR, Math.min(M.W - M.PR, p.x));
  p.y = Math.max(M.PR, Math.min(M.ROWS * T - M.PR, p.y));
}

// 바라보는 칸 — 앞쪽 한 점이 든 칸, 없으면 가까운 축 방향으로 한 번 더
function facingTile(st) {
  const p = st.p;
  const probe = (fx, fy) => {
    const t = tileAt(st, Math.floor((p.x + fx * M.REACH) / T), Math.floor((p.y + fy * M.REACH) / T));
    return t && !isWalk(t) && t.kind !== 'wall' ? t : null;
  };
  let t = probe(p.fx, p.fy);
  if (t) return t;
  if (Math.abs(p.fx) >= Math.abs(p.fy)) t = probe(Math.sign(p.fx) || 1, 0);
  else t = probe(0, Math.sign(p.fy) || 1);
  if (t) return t;
  // 그래도 없으면 지금 선 칸의 상하좌우 설비 중 바라보는 방향에 가장 가까운 것 (등을 진 쪽은 제외)
  const c = Math.floor(p.x / T), r = Math.floor(p.y / T);
  let best = null, bd = 0.1;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = tileAt(st, c + dc, r + dr);
    if (!n || isWalk(n) || n.kind === 'wall') continue;
    const d = dc * p.fx + dr * p.fy;
    if (d > bd) { bd = d; best = n; }
  }
  return best;
}

// ── 집기 · 놓기 · 합치기 ──
function combine(a, b) {                     // a = 손, b = 칸 위. 합쳐지면 { hand, tile }
  if (a.t === 'filling' && b.t === 'skin' && !b.fill) return { hand: null, tile: { t: 'skin', c: b.c, fill: a.f } };
  if (a.t === 'skin' && !a.fill && b.t === 'filling') return { hand: null, tile: { t: 'skin', c: a.c, fill: b.f } };
  if (a.t === 'plate' && b.t === 'song' && a.songs.length < M.PLATE_CAP) {
    return { hand: { t: 'plate', songs: a.songs.concat([b]) }, tile: null };
  }
  if (a.t === 'song' && b.t === 'plate' && b.songs.length < M.PLATE_CAP) {
    return { hand: null, tile: { t: 'plate', songs: b.songs.concat([a]) } };
  }
  return null;
}

function interact(st) {
  const p = st.p, tile = facingTile(st);
  if (!tile) return;
  const held = p.held;
  const ev = (type, extra) => st.events.push(Object.assign({ type, c: tile.c, r: tile.r }, extra || {}));

  switch (tile.kind) {
    case 'crate':
      if (!held) { p.held = clone(M.CRATE[tile.ch]); ev('pick'); }
      else if (held.t === 'skin' && !held.fill && M.CRATE[tile.ch].t === 'filling') {
        held.fill = M.CRATE[tile.ch].f; ev('fill');                // 피를 들고 소 통에 대면 바로 소를 얹는다
      } else ev('bump');
      return;
    case 'plates':
      if (!held) { p.held = { t: 'plate', songs: [] }; ev('pick'); }
      else if (held.t === 'plate' && held.songs.length === 0) { p.held = null; ev('place'); }
      else if (held.t === 'song') { p.held = { t: 'plate', songs: [held] }; ev('pick'); }   // 접시 더미에 대면 새 접시에 얹어 든다
      else ev('plate-hint', { why: held.t === 'raw' ? 'not-cooked' : held.t === 'burnt' ? 'burnt' : held.t === 'plate' ? 'full-hands' : 'not-song' });
      return;
    case 'trash':
      if (!held) return;
      if (held.t === 'plate') { if (held.songs.length) { held.songs = []; ev('trash'); } }
      else { p.held = null; ev('trash'); }
      return;
    case 'serve':
      if (!held) return;
      // 접시째 내는 것이 기본이고, 익은 송편 한 개를 손에 들고 와도 한 접시로 쳐 준다
      if (held.t === 'plate' && held.songs.length) { serve(st, held); p.held = null; }
      else if (held.t === 'song') { serve(st, { t: 'plate', songs: [held] }); p.held = null; }
      else ev('serve-hint', { why: held.t === 'plate' ? 'empty-plate' : held.t === 'burnt' ? 'burnt' : 'not-cooked' });
      return;
    case 'steamer': {
      const s = tile.steam;
      if (!held) {
        const bi = s.findIndex((x) => x.burnt);
        const ci = s.findIndex((x) => !x.burnt && x.cook >= M.COOK_T);
        if (bi >= 0) { s.splice(bi, 1); p.held = { t: 'burnt' }; ev('pick'); }
        else if (ci >= 0) { const x = s.splice(ci, 1)[0]; p.held = { t: 'song', c: x.c, f: x.f, hole: false }; ev('pick'); }
        else ev('bump');
      } else if (held.t === 'raw') {
        if (s.length < M.STEAM_CAP && !s.some((x) => x.burnt)) {
          s.push({ c: held.c, f: held.f, cook: 0, burnt: false }); p.held = null; ev('steam-in');
        } else ev('bump');
      } else if (held.t === 'plate') {
        let moved = 0;
        for (let i = 0; i < s.length && held.songs.length < M.PLATE_CAP;) {
          const x = s[i];
          if (!x.burnt && x.cook >= M.COOK_T) { held.songs.push({ c: x.c, f: x.f, hole: false }); s.splice(i, 1); moved++; }
          else i++;
        }
        ev(moved ? 'pick' : 'bump');
      } else ev('bump');
      return;
    }
    default:
      if (!holdsItem(tile)) return;
      if (!held) {
        if (tile.item) { p.held = tile.item; tile.item = null; tile.work = 0; ev('pick'); }
        return;
      }
      if (tile.item) {
        const m = combine(held, tile.item);
        if (m) { p.held = m.hand; tile.item = m.tile; tile.work = 0; ev(m.tile && m.tile.t === 'skin' ? 'fill' : 'pick'); }
        else if ((held.t === 'plate') !== (tile.item.t === 'plate')) {     // 접시와 다른 것 — 왜 안 담기는지 알려 준다
          const other = held.t === 'plate' ? tile.item : held, plate = held.t === 'plate' ? held : tile.item;
          ev('plate-hint', { why: other.t === 'song' && plate.songs.length >= M.PLATE_CAP ? 'plate-full'
            : other.t === 'raw' ? 'not-cooked' : other.t === 'burnt' ? 'burnt' : 'not-song' });
        } else ev('bump');
      } else {
        tile.item = held; tile.item.bt = 0; tile.work = 0; p.held = null; ev('place');
      }
  }
}

// 도마 작업 — 반죽을 꾹꾹 눌러 피로, 소 넣은 피를 반달로 접는다
// 누른 순간(edge)에 빚을 게 없으면 이유를 알려 준다. 반죽·소 넣은 피를 든 채 빈 도마를 보면 올려놓고 바로 빚는다.
const kneadable = (it) => it && (it.t === 'dough' || (it.t === 'skin' && it.fill));
function work(st, dt, edge) {
  const tile = facingTile(st), p = st.p;
  p.working = false;
  const hint = (why) => { if (edge) st.events.push({ type: 'work-hint', why }); };
  if (!tile || tile.kind !== 'board') { hint(p.held && kneadable(p.held) ? 'face-board' : 'no-board'); return; }
  if (!tile.item && kneadable(p.held)) {
    tile.item = p.held; tile.work = 0; p.held = null;
    st.events.push({ type: 'place', c: tile.c, r: tile.r });
  }
  const it = tile.item;
  let need = 0;
  if (it && it.t === 'dough') need = M.KNEAD_T;
  else if (it && it.t === 'skin' && it.fill) need = M.FOLD_T;
  if (!need) { hint(!it ? 'empty' : it.t === 'skin' ? 'need-fill' : 'done'); return; }
  st.p.working = true;
  tile.work += dt;
  st.p.workTick -= dt;
  if (st.p.workTick <= 0) { st.p.workTick = 0.28; st.events.push({ type: 'knead', c: tile.c, r: tile.r }); }
  if (tile.work >= need) {
    tile.item = it.t === 'dough' ? { t: 'skin', c: it.c, fill: null } : { t: 'raw', c: it.c, f: it.fill };
    tile.work = 0;
    st.events.push({ type: it.t === 'dough' ? 'skin-done' : 'fold-done', c: tile.c, r: tile.r });
  }
}

// ── 키위 도둑 ──
function bfs(st, sc, sr, goalFn) {
  const prev = new Map(), q = [[sc, sr]], k = (c, r) => r * M.COLS + c;
  prev.set(k(sc, sr), null);
  while (q.length) {
    const [c, r] = q.shift();
    if (goalFn(c, r)) {
      const path = []; let cur = [c, r];
      while (cur) { path.unshift(cur); cur = prev.get(k(cur[0], cur[1])); }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!isWalk(tileAt(st, nc, nr)) || prev.has(k(nc, nr))) continue;
      prev.set(k(nc, nr), [c, r]); q.push([nc, nr]);
    }
  }
  return null;
}
M.bfs = bfs;

const peckable = (tile) => holdsItem(tile) && tile.item &&
  ((tile.item.t === 'song' && !tile.item.hole) || (tile.item.t === 'plate' && tile.item.songs.some((s) => !s.hole)));

function kiwiRetarget(st, k) {
  const kc = Math.floor(k.x / T), kr = Math.floor(k.y / T);
  const targets = [];
  for (const row of st.grid) for (const t of row) if (peckable(t)) targets.push(t);
  if (targets.length && k.life > 0) {
    const set = new Set(targets.map((t) => t.r * M.COLS + t.c));
    const path = bfs(st, kc, kr, (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => set.has((r + dr) * M.COLS + c + dc)));
    if (path) {
      const [ec, er] = path[path.length - 1];
      k.tgt = targets.find((t) => Math.abs(t.c - ec) + Math.abs(t.r - er) === 1);
      k.path = path.slice(1); k.st = 'seek';
      return;
    }
  }
  if (k.life > 0) {                                        // 노릴 송편이 없으면 어슬렁
    const fl = [];
    for (const row of st.grid) for (const t of row) if (t.kind === 'floor') fl.push(t);
    const g = st.rng.pick(fl);
    k.path = (bfs(st, kc, kr, (c, r) => c === g.c && r === g.r) || []).slice(1);
    k.tgt = null; k.st = 'wander';
    return;
  }
  kiwiLeave(st, k, 'leave');
}

function kiwiLeave(st, k, why) {
  const d = st.door;
  k.path = (bfs(st, Math.floor(k.x / T), Math.floor(k.y / T), (c, r) => c === d.c && r === d.r) || []).slice(1);
  k.st = why; k.tgt = null;
}

function stepKiwis(st, dt) {
  const { D, S } = st;
  if (S.kiwi && st.t >= st.nextKiwiAt && st.kiwis.length < S.kiwi && st.timeLeft > 12) {
    const d = st.door;
    st.kiwis.push({ x: (d.c + 0.5) * T, y: (d.r + 0.5) * T, st: 'seek', path: [], tgt: null, pt: 0,
      life: 16 + st.rng.range(0, 6), dir: 1, id: st.t });
    kiwiRetarget(st, st.kiwis[st.kiwis.length - 1]);
    st.events.push({ type: 'kiwi-in' });
    st.nextKiwiAt = st.t + st.rng.range(40, 60) / D.kiwi;
  }
  const p = st.p;
  for (const k of st.kiwis) {
    k.life -= dt;
    const fleeing = k.st === 'flee' || k.st === 'leave';
    if (!fleeing && Math.hypot(k.x - p.x, k.y - p.y) < M.PR + 17) {
      st.shooed++; st.score += M.SHOO_BONUS;
      st.events.push({ type: 'shoo', x: k.x, y: k.y });
      kiwiLeave(st, k, 'flee');
      continue;
    }
    if (k.st === 'peck') {
      if (!peckable(k.tgt)) { kiwiRetarget(st, k); continue; }
      k.pt += dt;
      if (k.pt >= M.PECK_T) {
        const it = k.tgt.item;
        const s = it.t === 'song' ? it : it.songs.find((x) => !x.hole);
        s.hole = true; st.pecked++; k.pt = 0;
        st.events.push({ type: 'peck', c: k.tgt.c, r: k.tgt.r });
        kiwiRetarget(st, k);
      }
      continue;
    }
    if (k.path.length) {
      const [c, r] = k.path[0];
      const tx = (c + 0.5) * T, ty = (r + 0.5) * T;
      const spd = fleeing ? 200 : 96;
      const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 1) k.dir = Math.sign(dx);
      if (d <= spd * dt) { k.x = tx; k.y = ty; k.path.shift(); }
      else { k.x += dx / d * spd * dt; k.y += dy / d * spd * dt; }
      continue;
    }
    // 목적지 도착
    if (fleeing) { k.gone = true; continue; }
    if (k.st === 'seek' && peckable(k.tgt)) { k.st = 'peck'; k.pt = 0; k.dir = Math.sign(k.tgt.c + 0.5 - k.x / T) || k.dir; }
    else kiwiRetarget(st, k);
  }
  st.kiwis = st.kiwis.filter((k) => !k.gone);
}

// ── 한 프레임 ──
// input = { mx, my (-1..1 이동 벡터), grab (이번 프레임에 눌림), work (누르고 있음), dash (이번 프레임에 눌림) }
function step(st, dt, input) {
  st.events = [];
  if (st.phase !== 'play') return st.events;
  st.t += dt;
  st.timeLeft -= dt;
  const p = st.p;

  // 이동
  let mx = input.mx || 0, my = input.my || 0;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  if (mag > 0.2) { const m2 = Math.hypot(mx, my); p.fx = mx / m2; p.fy = my / m2; }
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (input.dash && p.dashCd <= 0) { p.dashT = M.DASH_T; p.dashCd = M.DASH_CD; st.events.push({ type: 'dash' }); }
  let spd = M.PSPD;
  if (p.dashT > 0) { p.dashT -= dt; spd = M.DASH_SPD; mx = p.fx; my = p.fy; }
  p.vx = mx * spd; p.vy = my * spd;
  p.x += p.vx * dt; p.y += p.vy * dt;
  collide(st, p);

  if (input.grab) interact(st);
  if (input.work) work(st, dt, !!input.workEdge); else p.working = false;

  // 찜기
  const burnAt = M.COOK_T + M.BURN_T * st.D.burn;
  for (const row of st.grid) for (const tile of row) {
    if (tile.kind === 'steamer') {
      for (const x of tile.steam) {
        if (x.burnt) continue;
        const was = x.cook;
        x.cook += dt;
        if (was < M.COOK_T && x.cook >= M.COOK_T) st.events.push({ type: 'cooked', c: tile.c, r: tile.r });
        if (x.cook >= burnAt) { x.burnt = true; st.events.push({ type: 'burnt', c: tile.c, r: tile.r }); }
      }
    }
  }
  // 컨베이어 — 끝 칸까지 한 칸씩, 앞이 차 있으면 기다린다 (먼 칸부터 옮겨 줄이 한 번에 밀리게)
  const belts = [];
  for (const row of st.grid) for (const tile of row) if (tile.kind === 'belt' && tile.item) belts.push(tile);
  belts.sort((a, b) => (b.c * a.dir[0] + b.r * a.dir[1]) - (a.c * a.dir[0] + a.r * a.dir[1]));
  for (const tile of belts) {
    const it = tile.item;
    const nt = tileAt(st, tile.c + tile.dir[0], tile.r + tile.dir[1]);
    if (!nt || nt.kind !== 'belt') { it.bt = 0; continue; }
    it.bt = (it.bt || 0) + dt;
    if (it.bt >= M.BELT_T && !nt.item) { nt.item = it; it.bt = 0; tile.item = null; tile.work = 0; }
  }

  // 주문
  for (const o of st.orders) o.t -= dt;
  for (const o of st.orders.filter((o) => o.t <= 0)) {
    st.orders.splice(st.orders.indexOf(o), 1);
    st.missed++; st.combo = 0;
    st.score = Math.max(0, st.score - M.PENALTY_MISS);
    st.events.push({ type: 'miss' });
  }
  if (st.t >= st.nextOrderAt && st.orders.length < 4 && st.timeLeft > 10) {
    st.orders.push(makeOrder(st));
    st.events.push({ type: 'order' });
    const ramp = Math.max(0.7, 1 - st.t / st.S.time * 0.3);  // 뒤로 갈수록 조금 잦아진다
    st.nextOrderAt = st.t + 36 * st.D.gap * ramp;
  }

  stepKiwis(st, dt);

  if (!st.hurried && st.timeLeft <= 30) { st.hurried = true; st.events.push({ type: 'hurry' }); }
  if (st.timeLeft <= 0) {
    st.timeLeft = 0; st.phase = 'end';
    st.events.push({ type: 'end' });
  }
  return st.events;
}

function starsOf(st) {
  const th = st.S.stars.map((s) => Math.round(s * st.D.star));
  return th.filter((x) => st.score >= x).length;
}
function thresholds(stageIdx, diff) {
  return M.STAGES[stageIdx].stars.map((s) => Math.round(s * M.DIFFS[diff].star));
}

M.Logic = { create, step, facingTile, starsOf, thresholds, tileAt, isWalk, interact, sameSet };
