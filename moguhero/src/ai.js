// ai.js — 자동 전투 봇(사람과 같은 입력 형식) + 하루 계획 봇(밸런스 테스트용 — 영상의 「봇이 대신 플레이」)
const M = window.MHR;

// ── 자동 전투 ── 반환 함수가 매 프레임 입력을 만든다
M.makeBattleBot = function (b, skill = 1) {
  let wait = 0;
  return function () {
    const h = b.hero, inp = {};
    if (b.phase !== 'fight') return inp;
    // 빨간 원 안이면 냥보로 빠져나간다
    for (const s of b.slams) {
      if (s.done) continue;
      const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
      if (d < s.r + 0.6) {
        const ex = d > 0.05 ? dx / d : 1, ey = d > 0.05 ? dy / d : 0;
        inp.mx = ex; inp.my = ey;
        if (h.dashCd <= 0 && s.t < 0.75 && d < s.r - 0.2) inp.dash = true;
        return inp;
      }
    }
    if (h.hp < h.maxHp * 0.35 && h.potions > 0) inp.potion = true;
    const live = b.mobs.filter((m) => !m.dead);
    if (!live.length) { inp.mx = -h.x * 0.2; inp.my = -h.y * 0.2; return inp; }
    let tgt = null, bd = 1e9;
    for (const m of live) { const d = Math.hypot(m.x - h.x, m.y - h.y); if (d < bd) { bd = d; tgt = m; } }
    // 회오리: 둘 이상 붙었거나 보스가 가까울 때
    const near = live.filter((m) => Math.hypot(m.x - h.x, m.y - h.y) < M.SKILL.r * 0.9).length;
    if (h.skillCd <= 0 && (near >= 2 || (tgt.boss && bd < M.SKILL.r * 0.8))) inp.skill = true;
    // 숙련도가 높으면 내려치기 직전에 뒤로 빠진다
    if (tgt.state === 'windup' && tgt.st < 0.25 && skill > 0.6 && h.dashCd <= 0 && h.hp < h.maxHp * 0.7 && bd < 2.4) {
      inp.dash = true; inp.mx = -(tgt.x - h.x) / bd; inp.my = -(tgt.y - h.y) / bd; return inp;
    }
    const reach = M.ATK_RANGE * 0.8 + tgt.size * 0.4;
    if (bd > reach) { inp.mx = (tgt.x - h.x) / bd; inp.my = (tgt.y - h.y) / bd; }
    else if ((wait -= 1) <= 0) { inp.attack = true; wait = skill >= 1 ? 1 : 4; }
    return inp;
  };
};

// ── 하루 계획 봇 ── 무엇을 할지 고른다 (수련할 능력치 · 살 물건 · 갈 던전)
M.Bot = {
  wantStat(g) {
    // 다음 무기 요구 능력치를 먼저 채우고, 그다음은 힘 2 : 민첩 1 : 냥력 1
    const next = M.WEAPONS.find((w) => !g.owned[w.id]);
    if (next && next.req && g[next.req[0]] < next.req[1]) return next.req[0];
    const t = g.trains;
    if (t.atk <= (t.agi + t.mag)) return 'atk';
    return t.agi <= t.mag ? 'agi' : 'mag';
  },
  shop(g) {
    const G = M.Game;
    for (const w of M.WEAPONS) if (!g.owned[w.id] && g.gold >= w.price && G.canUse(g, w) && w.atk > G.weapon(g).atk) G.buy(g, w.id);
    for (const a of M.ARMORS) if (!g.owned[a.id] && g.gold >= a.price * 1.3 && a.def > G.armor(g).def) G.buy(g, a.id);
    while (g.potions < 2 && g.gold >= M.POTION.price * 4) G.buy(g, 'potion');
  },
  pickDungeon(g) {
    let pick = -1;
    M.DUNGEONS.forEach((D, i) => { if (M.Game.dungeonOpen(g, i) && g.lv >= D.rec) pick = i; });
    return pick;
  },
};
