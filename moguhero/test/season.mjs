// season.mjs — 봇이 30일을 통째로 플레이하는 밸런스 러너 (sim-test 와 수치 조정에 같이 쓴다)
import './shim.mjs';
const M = window.MHR, G = M.Game;

export function fight(g, spec, seed, skill = 1) {
  const b = M.Battle.create(g, spec, seed);
  const bot = M.makeBattleBot(b, skill);
  let k = 0;
  while (b.phase === 'fight' && k++ < 30 * 400) M.Battle.step(b, 1 / 30, bot());
  return { b, out: G.finishBattle(g, b) };
}

export function season(diff, seed, skill = 1, log = false) {
  const g = G.create(diff, seed);
  let fights = 0, wins = 0, guard = 0;
  const lines = [];
  const doInvasion = (I) => {
    const { b, out } = fight(g, G.invasionSpec(g, I), seed * 31 + g.day * 7 + guard, skill);
    fights++;
    if (log) lines.push(`  D${g.day} 침공 ${I.name}: ${out.won ? '승' : '패'} (Lv${g.lv} HP ${b.hero.hp}/${b.hero.maxHp}, ${b.t.toFixed(0)}s)`);
    if (out.won) { wins++; return true; }
    if (g.stats.rollbacks < 2 && !I.final) { G.rollback(g); return 'rb'; }
    if (I.final && g.stats.rollbacks < 2) { G.rollback(g); return 'rb'; }
    G.concede(g, I); return false;
  };
  while (!g.finalBeaten && g.day < 60 && guard++ < 400) {
    G.drawTarot(g);
    M.Bot.shop(g);
    let rolled = false;
    // 하루: 던전 1번 → 수련(돈 되는 만큼) → 남는 시간 알바
    const di = M.Bot.pickDungeon(g);
    if (di >= 0) {
      const r = G.enterDungeon(g, di);
      if (r.ok) {
        const { b, out } = fight(g, r.spec, seed * 13 + g.day * 3 + guard, skill);
        fights++; if (out.won) wins++;
        if (log) lines.push(`D${g.day} ${M.DUNGEONS[di].name}: ${out.won ? '클리어' : b.phase} Lv${g.lv} 무기 ${G.weapon(g).name} HP ${b.hero.hp}/${b.hero.maxHp} ${b.t.toFixed(0)}s 금화 ${g.gold}`);
        M.Bot.shop(g);
      }
    }
    while (G.hoursLeft(g) >= M.COST.train) {
      const k = M.Bot.wantStat(g);
      if (g.gold >= M.trainCost(g.trains[k]) + 20) G.train(g, k);
      else if (G.hoursLeft(g) >= M.COST.work) G.work(g);
      else break;
      const I = G.invasionDue(g);
      if (I) { const r = doInvasion(I); if (r === 'rb') { rolled = true; break; } }
    }
    if (rolled) continue;
    M.Bot.shop(g);
    const s = G.sleep(g);
    if (!s.ok && s.invasion) { const r = doInvasion(s.invasion); if (r === 'rb') continue; G.sleep(g); }
  }
  return { g, fights, wins, lines };
}
