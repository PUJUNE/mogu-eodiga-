// ai.js — 자동 운전 봇 (타이틀 배경 시연 · 코스 완주 가능성 시험)
// skill 1 = 잘 탐, 0.5 = 반응이 느리고 공중 회전을 덜 시도
const M = window.MSL;
const PH = M.PHYS;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

M.makeBot = function (run, skill = 1) {
  let target = 0, think = 0, spinDir = 1, spinning = false;
  return function (dt) {
    const inp = { steer: 0, jump: false };
    if (run.phase !== 'run') return inp;

    // ── 공중: 착지 전에 한 바퀴를 끝낼 수 있으면 돈다 ──
    if (run.air) {
      const tl = (run.vz + Math.sqrt(run.vz * run.vz + 2 * PH.grav * Math.max(0, run.z))) / PH.grav;
      const a = Math.abs(run.spin), off = a - Math.round(a / TAU) * TAU;
      const aligned = Math.abs(off) < 0.12;
      if (spinning && aligned && a > 1) spinning = tl > TAU / PH.spinRate + 0.1 && skill >= 0.8;
      else if (!spinning && aligned) spinning = tl > TAU / PH.spinRate + 0.12 && (skill >= 0.8 || a < 1);
      if (!aligned && a > 0.2) spinning = true;      // 돌다 만 채로 내리면 넘어진다
      inp.steer = spinning ? spinDir : 0;
      return inp;
    }
    spinning = false; spinDir = Math.floor(run.s / 50) % 2 ? 1 : -1;

    // ── 땅: 갈 자리 고르기 ──
    const fr = run.track.frame(run.s), half = M.Prof.half(fr.prof), look = run.v * 1.5 + 6;
    think -= dt;
    if (think <= 0) {
      think = skill >= 1 ? 0 : 0.25 * (1 - skill) + 0.05;
      let best = run.u, bestC = Infinity;
      for (let c = -half + 0.4; c <= half - 0.4; c += 0.35) {
        let cost = Math.abs(c - run.u) * 0.25 + Math.abs(c) * 0.05;
        for (let i = run.iO; i < run.obst.length; i++) {
          const o = run.obst[i], ds = o.s - run.s;
          if (ds > look) break;
          if (o.low || o.hit || ds < -1) continue;
          const t = Math.max(0, ds) / run.v, ou = M.Run.moverU(o, run.t + t);
          const pu = run.u + Math.sign(c - run.u) * Math.min(Math.abs(c - run.u), 4.5 * Math.max(0, t - 0.08));   // 그때 닿아 있을 자리
          if (Math.abs(pu - ou) < o.ru + 0.7) cost += 60 / (1 + Math.max(0, ds) * 0.08);
        }
        for (let i = run.iC; i < run.coins.length; i++) {
          const k = run.coins[i], ds = k.s - run.s;
          if (ds > look) break;
          if (k.taken || ds < 0 || k.z > 1.4) continue;
          if (Math.abs(c - k.u) < 0.8) cost -= 3 / (1 + ds * 0.1);
        }
        for (const r of run.ramps) { const ds = r.s - run.s; if (ds > 0 && ds < look && Math.abs(c - r.u) < r.w / 2 - 0.4) cost -= 5 * (1 - Math.abs(c - r.u) / (r.w / 2)); }
        for (const p of run.pads) { const ds = p.s - run.s; if (!p.used && ds > 0 && ds < look && Math.abs(c - p.u) < 0.9) cost -= 2; }
        if (cost < bestC) { bestC = cost; best = c; }
      }
      target = best;
    }
    inp.steer = clamp((target - run.u) * 1.4 - run.uv * 0.35, -1, 1);

    // ── 낮은 장애물은 뛰어넘는다 ──
    for (let i = run.iO; i < run.obst.length; i++) {
      const o = run.obst[i], ds = o.s - run.s;
      if (ds > run.v * 0.8) break;
      if (o.hit || ds < 0) continue;
      const t = ds / run.v;
      if (o.low && t > 0.22 && t < 0.5) inp.jump = true;
    }
    return inp;
  };
};
