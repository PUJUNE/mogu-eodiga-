// ai.js — 자동 지휘 「군사 모구」: 터를 골라 탑을 짓고 키운다 (DOM·THREE 없음)
const M = window.MWT;
const T = M.TOWER, Game = M.Game;

// 지역의 하늘 도둑 비율 — 높으면 털실·레이저를 더 짓는다
function airShare(map) {
  let a = 0, s = 0;
  for (const ty in map.weights) { const w = map.weights[ty]; s += w; if (M.MON[ty].fly) a += w; }
  return s ? a / s : 0;
}
// 탑 종류별 목표 비율 (들인 돈 기준)
function mix(map) {
  const air = airShare(map);
  return { yarn: 0.26 + air * 0.5, can: 0.3 - air * 0.3, laser: 0.22 + air * 0.1, guard: 0.2 - air * 0.2 };
}

M.makeBot = function (opt = {}) {
  const bot = { t: 0, think: opt.think || 0.4, early: opt.early !== false, lastAct: '' };
  bot.step = function (G, dt) {
    bot.t -= dt;
    if (bot.t > 0 || G.phase !== 'play') return null;
    bot.t = bot.think;
    const act = decide(G);
    if (act) bot.lastAct = act;
    // 아직 공세 전이면 탑을 몇 개 지은 뒤 바로 부른다
    if (bot.early && !G.spawning && G.wave < Game.totalWaves(G)) {
      const ready = G.wave === 0 ? G.towers.length >= 2 && G.gold < 80 : G.mons.length === 0 && G.lives === G.maxLives && G.towers.length >= 4 && G.nextIn > 2;
      if (ready) Game.callWave(G);
    }
    return act;
  };
  return bot;
};

// 탑 한 채의 힘 (초당 피해에 광역·막기 값을 얹은 대강의 값)
function power(k, lv) {
  const d = T[k];
  if (k === 'yarn') return d.dmg[lv] / d.rate[lv];
  if (k === 'can') return d.dmg[lv] / d.rate[lv] * 2.2;
  if (k === 'laser') { let s = 0, m = 1; for (let j = 0; j < d.jumps[lv]; j++) { s += m; m *= 0.85; } return d.dmg[lv] * s / d.rate[lv] * 0.75 + d.slow[lv] * 12; }
  return d.n[lv] * (d.dmg[lv] / d.rate[lv] * 1.5 + d.hp[lv] / 25);
}
M.towerPower = power;

function decide(G) {
  const want = mix(G.map), spentBy = { yarn: 0, can: 0, laser: 0, guard: 0 };
  let tot = 0;
  for (const t of G.towers) { spentBy[t.kind] += t.spent; tot += t.spent; }
  const needW = (k) => M.clamp(1 + 2.5 * (want[k] - (tot ? spentBy[k] / tot : 0)), 0.35, 2);
  // 할 수 있는 일마다 값/비용을 매긴다
  let best = null;
  const consider = (gain, cost, act) => { const v = gain / cost; if (!best || v > best.v) best = { v, cost, act }; };
  const free = G.plots.filter((p) => !G.towerAt[p.i]);
  for (const k of M.TOWER_KINDS) {
    let bp = null;
    for (const p of free) if (!bp || p.cov[k][0] > bp.cov[k][0]) bp = p;
    if (bp) consider(power(k, 0) * bp.cov[k][0] * needW(k) * (G.towers.length < 2 ? 1.6 : 1), T[k].cost[0], { b: bp.i, k });
  }
  for (const t of G.towers) {
    if (t.lvl >= 2) continue;
    const p = G.plots[t.plot], k = t.kind;
    const gain = (power(k, t.lvl + 1) * p.cov[k][t.lvl + 1] - power(k, t.lvl) * p.cov[k][t.lvl]) * Math.max(0.8, needW(k));
    consider(gain, T[k].cost[t.lvl + 1], { u: t.plot, k });
  }
  if (!best || G.gold < best.cost) return null;   // 모아서 한다
  if (best.act.b !== undefined) return Game.build(G, best.act.b, best.act.k) ? 'build:' + best.act.k + '@' + best.act.b : null;
  return Game.upgrade(G, best.act.u) ? 'up:' + best.act.k + '@' + best.act.u : null;
}
