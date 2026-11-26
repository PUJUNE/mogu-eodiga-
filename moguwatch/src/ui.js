// ui.js — 기록 저장 · 동네 고르기 · 전투 HUD · 짓기 메뉴 · 알림 · 결과 화면
const M = window.MWT;
const $ = (id) => document.getElementById(id);
const T = M.TOWER, Game = M.Game;

// ── 기록: { diff, mode, best: { [난이도]: { [동네]: 별, endless: { [동네]: 공세 } } } } ──
const SAVE = 'moguwatch-save-v1';
const S = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(SAVE)) || null; } catch (e) { this.data = null; }
    if (!this.data || !this.data.best) this.data = { diff: 'normal', mode: 'campaign', best: {} };
    return this.data;
  },
  save() { try { localStorage.setItem(SAVE, JSON.stringify(this.data)); } catch (e) { /* 저장 안 돼도 게임은 돈다 */ } },
  stars(diff, id) { return ((this.data.best[diff] || {})[id]) || 0; },
  endless(diff, id) { return (((this.data.best[diff] || {}).endless) || {})[id] || 0; },
  starsAny(id) { return Math.max(0, ...M.DIFF_ORDER.map((d) => this.stars(d, id))); },
  unlocked(i) { return i === 0 || this.starsAny(M.MAPS[i - 1].id) > 0; },
  submit(G) {   // 새 기록이면 true
    const b = this.data.best[G.diff] = this.data.best[G.diff] || {};
    let isNew = false;
    if (G.endless) {
      const e = b.endless = b.endless || {}, w = Math.max(0, G.waveN - (G.phase === 'lose' ? 1 : 0));
      if (w > (e[G.map.id] || 0)) { e[G.map.id] = w; isNew = true; }
    } else if (G.phase === 'win') {
      const s = Game.stars(G);
      if (s > (b[G.map.id] || 0)) { b[G.map.id] = s; isNew = true; }
    }
    this.save();
    return isNew;
  },
};
M.save = S;

const starStr = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;

const U = {
  sel: 0, mode: 'campaign', toastTimer: null, banTimer: null, menu: null,

  mapList(diff) {
    let h = '';
    M.MAPS.forEach((m, i) => {
      const lock = !S.unlocked(i) && U.mode === 'campaign', st = S.stars(diff, m.id), ew = S.endless(diff, m.id);
      const line = U.mode === 'endless' ? (ew ? `최고 ${ew}공세` : '') : st ? starStr(st) : lock ? '' : '<i>★★★</i>';
      h += `<button class="map${lock ? ' lock' : ''}${U.sel === i ? ' sel' : ''}" data-m="${i}"><span class="no">${i + 1}</span>
        <div class="ic">${lock ? '🔒' : m.icon}</div><div class="nm">${m.name}</div>
        <div class="st">${line}</div><div class="ds">${lock ? '앞 동네를 지키면 열려요' : m.sub}</div></button>`;
    });
    $('maps').innerHTML = h;
  },
  setDiff(diff) { document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b.dataset.diff === diff)); },
  setMode(mode) { U.mode = mode; document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('selected', b.dataset.mode === mode)); },

  // ── HUD ──
  hud(G, auto, speed) {
    const lv = `🐟 ${G.lives}`, gd = `🪙 ${G.gold}`;
    if ($('s-lives').textContent !== lv) { $('s-lives').textContent = lv; }
    if ($('s-gold').textContent !== gd) $('s-gold').textContent = gd;
    $('s-kills').textContent = `🐭 ${G.kills}`;
    const tot = G.endless ? '' : ` / ${M.WAVES}`;
    if (G.wave === 0) { $('w1').textContent = `${G.map.icon} ${G.map.name} · 공세 준비`; $('w2').textContent = `첫 공세까지 ${Math.ceil(G.nextIn)}초`; }
    else {
      $('w1').textContent = `⚑ 제${G.waveN}공세${tot}` + (G.waveIsBoss && G.bossAlive ? ' · 우두머리!' : '');
      $('w2').textContent = G.spawning || G.mons.length ? `남은 도둑 ${Game.remainingEnemies(G)}` : G.nextIn > 0 ? `다음 공세까지 ${Math.ceil(G.nextIn)}초` : '마지막 도둑까지!';
    }
    const can = !G.spawning && G.wave < Game.totalWaves(G) && G.phase === 'play';
    $('call').classList.toggle('hidden', !can);
    if (can) {
      const bonus = G.wave === 0 ? 0 : Math.round(Math.max(0, G.nextIn) * M.WAVE.earlyGold);
      $('call-s').textContent = G.wave === 0 ? '첫 공세 시작 (Space)' : `일찍 부르면 +${bonus}🪙 (Space)`;
      $('call').classList.toggle('pulse', G.wave === 0 && G.towers.length > 0);
    }
    $('auto').classList.toggle('on', auto);
    $('auto-t').textContent = auto ? '🐱 군사 모구가 지휘 중' : '🐱 직접 지휘 중';
    $('auto-s').textContent = auto ? '터를 누르면 직접 지휘' : '눌러서 군사 모구에게 맡기기';
    $('b-speed').textContent = speed + '×';
  },
  bump(id) { const e = $(id); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); },

  toast(html, sec = 3) {
    const e = $('toast'); e.innerHTML = html; e.classList.remove('hidden');
    clearTimeout(U.toastTimer); U.toastTimer = setTimeout(() => e.classList.add('hidden'), sec * 1000);
  },
  banner(a, b, c, sec, boss) {
    $('ban1').textContent = a; $('ban2').textContent = b || ''; $('ban3').innerHTML = c || '';
    const e = $('banner'); e.classList.toggle('boss', !!boss); e.classList.remove('hidden');
    clearTimeout(U.banTimer); U.banTimer = setTimeout(() => e.classList.add('hidden'), sec * 1000);
  },
  hideBanner() { clearTimeout(U.banTimer); $('banner').classList.add('hidden'); },
  float(x, y, text, col) {
    if (document.querySelectorAll('.float').length > 14) return;
    const e = document.createElement('div'); e.className = 'float'; e.textContent = text; if (col) e.style.color = col;
    e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e);
    requestAnimationFrame(() => { e.style.transform = 'translate(-50%, -150%)'; e.style.opacity = '0'; });
    setTimeout(() => e.remove(), 850);
  },

  // ── 짓기 메뉴 ──
  // menu = { plot, pick: 고른 종류 또는 'up' · 'sell' }
  openMenu(G, plot) { U.menu = { plot, pick: null }; U.drawMenu(G); },
  closeMenu() { U.menu = null; $('bmenu').classList.add('hidden'); },
  drawMenu(G) {
    const mu = U.menu; if (!mu) return;
    const t = G.towerAt[mu.plot]; let row = '', info = '';
    if (!t) {
      M.TOWER_KINDS.forEach((k, i) => {
        const d = T[k], no = G.gold < d.cost[0];
        row += `<button class="bt${mu.pick === k ? ' sel' : ''}${no ? ' no' : ''}" data-k="${k}"><span class="i">${d.icon}</span><span class="n">${i + 1} ${d.short}</span><span class="c">🪙${d.cost[0]}</span></button>`;
      });
      if (mu.pick) {
        const d = T[mu.pick];
        info = `<b>${d.name}</b><br>${d.desc[0]} ${d.desc[1]}<br>${U.statLine(mu.pick, 0)}<br>` + (G.gold < d.cost[0] ? '<span class="hint">군자금이 모자라요</span>' : '<span class="hint">한 번 더 눌러 짓기</span>');
      } else info = '무엇을 지을까? <span class="hint">누르면 쓰임새가 보여요</span>';
    } else {
      const d = T[t.kind], c = Game.upgradeCost(G, mu.plot), refund = Game.refund(G, mu.plot);
      info = `<b>${d.name} ${t.lvl + 1}단계</b><br>${U.statLine(t.kind, t.lvl)}`;
      if (mu.pick === 'up' && c !== null) info += `<br>다음: ${U.statLine(t.kind, t.lvl + 1)}<br><span class="hint">${G.gold < c ? '군자금이 모자라요' : '한 번 더 눌러 증축'}</span>`;
      if (mu.pick === 'sell') info += `<br><span class="hint">한 번 더 누르면 철거 +🪙${refund}</span>`;
      row += c !== null ? `<button class="bt wide${mu.pick === 'up' ? ' sel' : ''}${G.gold < c ? ' no' : ''}" data-k="up"><span class="i">⬆️</span><span class="n">증축</span><span class="c">🪙${c}</span></button>`
        : `<button class="bt wide no" data-k="max"><span class="i">👑</span><span class="n">최고 단계</span><span class="c">&nbsp;</span></button>`;
      row += `<button class="bt wide${mu.pick === 'sell' ? ' sel' : ''}" data-k="sell"><span class="i">🔨</span><span class="n">철거</span><span class="c">+🪙${refund}</span></button>`;
    }
    $('binfo').innerHTML = info; $('brow').innerHTML = row; $('bmenu').classList.remove('hidden');
    U.placeMenu(G);
  },
  placeMenu(G) {
    const mu = U.menu; if (!mu) return;
    const p = G.plots[mu.plot], s = M.R3.toScreen(p.x, 0.3, p.z), e = $('bmenu');
    const w = e.offsetWidth, h = e.offsetHeight, W = window.innerWidth;
    let x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, s.x)), y = s.y - 26 * Math.max(1, M.R3.view.zoom * 0.7);
    if (y - h < 50) y = s.y + h + 40;   // 위로 넘치면 아래에
    e.style.left = x + 'px'; e.style.top = y + 'px';
  },
  statLine(k, lv) {
    const d = T[k];
    if (k === 'guard') return `병사 ${d.n[lv]} · 체력 ${d.hp[lv]} · 피해 ${d.dmg[lv]}`;
    if (k === 'laser') return `피해 ${d.dmg[lv]} · ${d.jumps[lv]}마리까지 번짐 · 사거리 ${d.range[lv]}`;
    if (k === 'can') return `피해 ${d.dmg[lv]} · 범위 ${d.splash[lv]} · 사거리 ${d.range[lv]}`;
    return `피해 ${d.dmg[lv]} · ${(1 / d.rate[lv]).toFixed(1)}발/초 · 사거리 ${d.range[lv]}`;
  },

  // ── 결과 ──
  result(G, isNew) {
    const win = G.phase === 'win', st = Game.stars(G);
    $('res-title').textContent = G.endless ? `제${Math.max(0, G.waveN - 1)}공세까지 버텼다!` : win ? '츄르 곳간을 지켜냈다!' : '츄르를 다 뺏겼다…';
    $('res-stars').innerHTML = G.endless ? '' : starStr(win ? st : 0);
    $('res-lines').innerHTML = `${G.map.icon} <b>${G.map.name}</b> · ${G.D.name}<br>남은 츄르 <b>${G.lives} / ${G.maxLives}</b> · 잡은 도둑 <b>${G.kills}</b><br>지은 탑 <b>${G.towers.length}</b> · 쓴 군자금 <b>${G.spent}</b>`;
    $('res-best').textContent = isNew ? '🎉 새 기록!' : '';
    const i = M.MAPS.indexOf(G.map);
    $('btn-next').classList.toggle('hidden', G.endless || !win || i >= M.MAPS.length - 1);
    $('result-screen').classList.remove('hidden');
  },
};
M.ui = U;
