// ui.js — 저장 · 상단 바 · 건물 패널(도장·생선가게·잡화점·점집·던전·집) · 대화 상자 · 전투 HUD · 결과 화면
const M = window.MHR;
const $ = (id) => document.getElementById(id);
const G = M.Game;

M.save = {
  KEY: 'moguhero-save-v1', OPT: 'moguhero-opt-v1',
  opt: { diff: 'normal' },
  loadOpt() { try { Object.assign(this.opt, JSON.parse(localStorage.getItem(this.OPT) || '{}')); } catch (e) {} },
  storeOpt() { try { localStorage.setItem(this.OPT, JSON.stringify(this.opt)); } catch (e) {} },
  load() { try { const s = localStorage.getItem(this.KEY); if (s) { const g = JSON.parse(s); if (g && g.v === 1) return g; } } catch (e) {} return null; },
  store(g) { try { localStorage.setItem(this.KEY, JSON.stringify(g)); } catch (e) {} },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
};

const hh = (h) => String(Math.floor(h)).padStart(2, '0') + ':00';
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
M.fmt = fmt;

// 초상 — 모구는 사진, 나머지는 그림
M.portrait = function (canvas, face, bg = '#f4f6fa') {
  const g = canvas.getContext('2d'), S = canvas.width;
  g.clearRect(0, 0, S, S); g.fillStyle = bg; g.fillRect(0, 0, S, S);
  if (face === 'photo') { if (M.faceImg && M.faceImg.complete) g.drawImage(M.faceImg, S * 0.06, S * 0.12, S * 0.88, S * 0.88 * 221 / 256); }
  else { g.save(); g.scale(S / 256, S / 256); M.drawFace(face, g, 256); g.restore(); }
};

M.ui = {
  screens: ['title-screen', 'result-screen', 'choice-screen', 'ending-screen', 'pause-screen'],
  msgT: null, toastT: null,
  show(id) { for (const s of this.screens) $(s).classList.toggle('hidden', s !== id); },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  msg(text, sub = '', cls = '', dur = 1.3) {
    const el = $('msg'); el.innerHTML = text + (sub ? `<span class="s">${sub}</span>` : '');
    el.className = cls; el.style.opacity = 1;
    clearTimeout(this.msgT); this.msgT = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },
  toast(text, dur = 1.8) {
    const el = $('toast'); el.textContent = text; el.style.opacity = 1;
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },
  dmg(x, y, text, cls = '') {
    const p = M.R3.toScreen(x, y, 1.4);
    const el = document.createElement('div'); el.className = 'dmg ' + cls; el.textContent = text;
    el.style.left = (p.x + (Math.random() - 0.5) * 24) + 'px'; el.style.top = p.y + 'px';
    $('dmg-layer').appendChild(el);
    const t0 = performance.now();
    const tick = (now) => { const u = (now - t0) / 700; el.style.transform = `translate(-50%, calc(-50% - ${u * 40}px))`; el.style.opacity = 1 - Math.max(0, u - 0.5) * 2; if (u < 1) requestAnimationFrame(tick); else el.remove(); };
    requestAnimationFrame(tick);
  },

  // ── 타이틀 ──
  refreshTitle(saved) {
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b.dataset.diff === M.save.opt.diff));
    $('btn-continue').style.display = saved ? '' : 'none';
    $('btn-new').classList.toggle('primary', !saved);
    $('save-line').textContent = saved ? `저장된 모험: ${saved.day}일째 · Lv ${saved.lv} · ${M.DIFFS[saved.diff].name}${saved.finalBeaten ? ' · 🏆 클리어' : ''}` : '';
  },

  // ── 상단 바 ──
  top(g) {
    $('tb-day').textContent = `${g.day}일째` + (g.finalBeaten ? ' 🏆' : g.day <= g.finalDay ? ` / ${g.finalDay}` : '');
    $('tb-clock').textContent = hh(g.hour);
    $('tb-daybar').style.width = ((g.hour - M.DAY_START) / (M.DAY_END - M.DAY_START) * 100) + '%';
    $('tb-gold').textContent = fmt(g.gold);
    $('tb-lv').textContent = g.lv;
    $('tb-exp').style.width = Math.min(100, g.exp / M.expNeed(g.lv) * 100) + '%';
    const c = G.card(g), T = c && M.TAROT.find((t) => t.id === c);
    $('card-today').textContent = T ? `${T.icon} ${T.name}` : '';
  },

  // ── 건물 패널 ──
  panelOpen: null,
  openPanel(key, g) { this.panelOpen = key; $('panel-wrap').classList.remove('hidden'); this.renderPanel(g); },
  closePanel() { this.panelOpen = null; $('panel-wrap').classList.add('hidden'); },
  who(face, name, line) {
    return `<div class="who"><canvas width="104" height="104" data-face="${face}"></canvas><div><b>${name}</b><br>${line}</div></div>`;
  },
  paintFaces(root) { root.querySelectorAll('canvas[data-face]').forEach((c) => M.portrait(c, c.dataset.face)); },
  shopTab: 'weapon',
  renderPanel(g) {
    const key = this.panelOpen; if (!key) return;
    const B = M.BUILDINGS[key], N = B.npc && M.NPCS[B.npc];
    const left = G.hoursLeft(g);
    const line = N ? N.lines[(g.day + g.n) % N.lines.length] : '';
    let h = `<h2>${B.icon} ${B.name}</h2><div class="note" style="margin-top:0">${g.day}일째 ${hh(g.hour)} · 남은 시간 ${left}시간 · 💰 ${fmt(g.gold)}</div>`;
    if (N) h += this.who(N.face, N.name, line);
    if (key === 'dojo') {
      for (const [k, T] of Object.entries(M.TRAINS)) {
        const cost = M.trainCost(g.trains[k]), ok = G.canSpend(g, M.COST.train) && g.gold >= cost;
        h += `<div class="row"><div class="ic">${{ atk: '🐾', agi: '🗼', mag: '💤' }[k]}</div><div class="tx"><b>${T.name}</b> · 지금 ${M.STAT_NAME[k]} ${g[T.stat]} · ${g.trains[k]}회 받음<br>${T.desc}<br>⏳ ${M.COST.train}시간 · 💰 ${fmt(cost)}</div>
          <button class="pbtn go" data-act="train" data-k="${k}" ${ok ? '' : 'disabled'}>수련</button></div>`;
      }
      h += `<div class="note">수련비는 받을수록 올라가요. 가끔 <b>대성공</b>(+${M.TRAIN_GREAT}) — 🌙 달 카드가 나온 날은 대성공이 잦아요.</div>`;
    } else if (key === 'fish') {
      const pay = Math.round(M.workPay(g.day, g.agi) * G.goldMul(g));
      h += `<div class="row"><div class="ic">🐟</div><div class="tx"><b>생선 팔기 알바</b><br>⏳ ${M.COST.work}시간 · 예상 알바비 💰 약 ${fmt(pay)} (날이 갈수록 · 민첩이 높을수록 오른다, 가끔 팁 +50%)</div>
        <button class="pbtn go" data-act="work" ${G.canSpend(g, M.COST.work) ? '' : 'disabled'}>일하기</button></div>`;
    } else if (key === 'shop') {
      h += `<div class="tabs"><button class="pbtn ${this.shopTab === 'weapon' ? '' : 'alt'}" data-tab="weapon">무기</button><button class="pbtn ${this.shopTab === 'armor' ? '' : 'alt'}" data-tab="armor">옷</button><button class="pbtn ${this.shopTab === 'item' ? '' : 'alt'}" data-tab="item">회복약</button></div>`;
      if (this.shopTab === 'weapon') for (const w of M.WEAPONS) {
        const own = !!g.owned[w.id], cur = g.weapon === w.id, can = G.canUse(g, w);
        const req = w.req ? `<span style="color:${can ? '#3a9a4a' : '#e8402a'}">${M.STAT_NAME[w.req[0]]} ${w.req[1]}</span>` : '요구 없음';
        h += `<div class="row ${cur ? 'cur' : ''} ${!can && !own ? 'lock' : ''}"><div class="ic" style="color:${'#' + w.col.toString(16).padStart(6, '0')}">🗡️</div><div class="tx"><b>${w.name}</b><br>공격력 ${w.atk} · ${req}${own ? '' : ` · 💰 ${fmt(w.price)}`}</div>
          <button class="pbtn ${own ? 'alt' : 'go'}" data-act="buy" data-id="${w.id}" ${cur || (!own && (g.gold < w.price || !can)) ? 'disabled' : ''}>${cur ? '장착 중' : own ? '장착' : '구매'}</button></div>`;
      }
      else if (this.shopTab === 'armor') for (const a of M.ARMORS) {
        const own = !!g.owned[a.id], cur = g.armor === a.id;
        h += `<div class="row ${cur ? 'cur' : ''}"><div class="ic">👕</div><div class="tx"><b>${a.name}</b><br>방어 ${a.def} · 체력 +${a.hp}${own ? '' : ` · 💰 ${fmt(a.price)}`}</div>
          <button class="pbtn ${own ? 'alt' : 'go'}" data-act="buy" data-id="${a.id}" ${cur || (!own && g.gold < a.price) ? 'disabled' : ''}>${cur ? '입는 중' : own ? '입기' : '구매'}</button></div>`;
      }
      else h += `<div class="row"><div class="ic">🍥</div><div class="tx"><b>${M.POTION.name}</b> · 가진 수 ${g.potions} / ${M.POTION.max}<br>전투 중 H 로 체력 ${M.POTION.heal * 100}% 회복 · 💰 ${M.POTION.price}</div>
          <button class="pbtn go" data-act="buy" data-id="potion" ${g.gold < M.POTION.price || g.potions >= M.POTION.max ? 'disabled' : ''}>구매</button></div>`;
      h += `<div class="note">물건을 사는 데는 시간이 들지 않아요.</div>`;
    } else if (key === 'tarot') {
      const c = G.card(g), T = c && M.TAROT.find((t) => t.id === c);
      h += T ? `<div class="tarot-card" id="tarot-card"><div class="big">${T.icon}</div>${T.name}</div><div style="text-align:center;font-weight:800">${T.desc}</div><div class="note" style="text-align:center">내일 또 오세요. 카드는 하루에 한 장.</div>`
        : `<div class="tarot-card"><div class="big">🂠</div>?</div><div style="text-align:center"><button class="pbtn go" data-act="tarot">카드 뽑기 (공짜 · 시간 안 듦)</button></div>`;
    } else if (key === 'dungeon') {
      M.DUNGEONS.forEach((D, i) => {
        const open = G.dungeonOpen(g, i), cl = g.cleared[D.id] || 0, ok = open && G.canSpend(g, M.COST.dungeon);
        const warn = g.lv < D.rec ? ` <span style="color:#e8402a">권장 Lv ${D.rec}</span>` : ` 권장 Lv ${D.rec}`;
        h += `<div class="row ${open ? '' : 'lock'}"><div class="ic">${cl ? '✅' : open ? '⚔️' : '🔒'}</div><div class="tx"><b>${i + 1}. ${open ? D.name : '???'}</b>${open ? warn : ''}<br>${open ? `${M.MOBS[D.mob].name} ${D.kills}마리 → 보스 「${D.boss}」 · 보상 💰 ${fmt(M.dungeonGold(D.t) * M.DIFFS[g.diff].gold)}${cl ? ` · ${cl}번 깸` : ''}` : '앞 던전을 깨면 열려요'}</div>
          <button class="pbtn go" data-act="dungeon" data-i="${i}" ${ok ? '' : 'disabled'}>입장</button></div>`;
      });
      h += `<div class="note">던전은 ⏳ ${M.COST.dungeon}시간 · 제한 ${M.DUNGEON_TIME / 60 | 0}분 30초. 쓰러지면 경험치만 남고 금화는 못 받아요.</div>`;
    } else if (key === 'home') {
      const I = G.invasionToday(g);
      h += this.who('photo', '모구', I ? `오늘 밤은 왠지 불길하다냥… (${I.name}가 올 것 같다)` : left < 3 ? '오늘은 할 만큼 했다냥. 자자.' : '아직 시간이 남았는데 벌써 잘까냥?');
      h += `<div class="row"><div class="ic">🛏️</div><div class="tx"><b>잠자기</b> — 다음 날 08:00 (자동 저장)<br>${g.day + 1 > g.finalDay && !g.finalBeaten ? '내일은…' : ''}</div><button class="pbtn go" data-act="sleep">자기</button></div>`;
      h += this.statusHtml(g);
    }
    $('panel-body').innerHTML = h;
    this.paintFaces($('panel-body'));
  },
  statusHtml(g) {
    const hs = G.hero(g), w = G.weapon(g), a = G.armor(g);
    return `<div class="stats">
      <div>❤ 최대 체력 <b>${hs.maxHp}</b></div><div>⭐ Lv ${g.lv} (${g.exp}/${M.expNeed(g.lv)})</div>
      <div>🐾 힘 <b>${g.atk}</b></div><div>🗼 민첩 <b>${g.agi}</b></div>
      <div>💤 냥력 <b>${g.mag}</b></div><div>💥 치명타 ${(hs.crit * 100).toFixed(0)}%</div>
      <div>🗡️ ${w.name} (${w.atk})</div><div>👕 ${a.name} (방어 ${a.def})</div>
      <div>타격 피해 ≈ <b>${fmt(G.hitDmg(hs))}</b></div><div>회오리 ≈ <b>${fmt(G.skillDmg(hs))}</b></div>
      <div>🍥 회복약 ${g.potions}</div><div>🔁 되감기 ${g.stats.rollbacks}번</div>
    </div><div class="note">8·16·24일째 밤 들개 깡패 · ${g.finalDay}일째 밤 그림자 고양이 · 난이도 ${M.DIFFS[g.diff].name}</div>`;
  },
  openStatus(g) {
    this.panelOpen = 'status'; $('panel-wrap').classList.remove('hidden');
    $('panel-body').innerHTML = `<h2>📋 모구 상태</h2>` + this.who('photo', '모구', `${g.day}일째 · 처치 ${g.stats.kills} · 수련 ${g.stats.trains}번 · 알바 ${g.stats.works}번 · 던전 ${g.stats.dungeons}번`) + this.statusHtml(g);
    this.paintFaces($('panel-body'));
  },

  // ── 대화 ──
  talkQueue: [], talkDone: null,
  talk(lines, done) { this.talkQueue = lines.slice(); this.talkDone = done || null; $('talk').classList.remove('hidden'); this.nextTalk(); },
  nextTalk() {
    const L = this.talkQueue.shift();
    if (!L) { $('talk').classList.add('hidden'); const d = this.talkDone; this.talkDone = null; if (d) d(); return false; }
    M.portrait($('talk-face'), L.face, L.bg || '#f4f6fa');
    $('talk-nm').textContent = L.name; $('talk-tx').textContent = L.text;
    return true;
  },
  talking() { return !$('talk').classList.contains('hidden'); },

  // ── 전투 HUD ──
  battleHud(b, auto) {
    const S = b.spec, h = b.hero;
    $('bname').textContent = (S.kind === 'invasion' ? '🚨 ' : '⚔️ ') + S.name;
    const t = Math.ceil(b.timeLeft);
    $('btimer').textContent = `⏱ ${t / 60 | 0}:${String(t % 60).padStart(2, '0')}`;
    $('btimer').classList.toggle('low', t <= 20);
    if (b.boss && !b.boss.dead) {
      $('bboss-nm').textContent = '👑 ' + b.boss.name; $('bboss-v').textContent = `${fmt(Math.max(0, b.boss.hp))} / ${fmt(b.boss.maxHp)}`;
      $('bbar-i').style.width = Math.max(0, b.boss.hp / b.boss.maxHp * 100) + '%'; $('bbar').classList.add('boss');
    } else {
      $('bboss-nm').textContent = `잡은 수 — ${M.MOBS[S.mob].name}`; $('bboss-v').textContent = `${b.killed} / ${S.kills}`;
      $('bbar-i').style.width = (b.killed / S.kills * 100) + '%'; $('bbar').classList.remove('boss');
    }
    $('bpot').textContent = `🍥 회복약 ${h.potions} (H)`;
    $('b-auto').classList.toggle('on', auto); $('b-auto').textContent = auto ? '자동 ON (T)' : '자동 (T)';
    $('bhp-v').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
    $('hpbar-i').style.width = (h.hp / h.maxHp * 100) + '%';
    $('hpbar-i').style.background = h.hp < h.maxHp * 0.3 ? '#e84a3a' : '#5ac86a';
    $('cd-skill').style.setProperty('--p', (h.skillCd / b.hs.skillCd * 100) + '%');
    $('cd-dash').style.setProperty('--p', (h.dashCd / b.hs.dashCd * 100) + '%');
  },

  // ── 결과 ──
  showResult(b, out, g) {
    const S = b.spec;
    let title, lines = [];
    if (out.won) {
      title = S.kind === 'invasion' ? '마을을 지켰다! 🛡️' : '던전 클리어! ✨';
      lines.push(`처치 <b>${b.killed + 1}</b> · 걸린 시간 ${b.t.toFixed(0)}초 · 받은 피해 ${fmt(b.hero.taken)}`);
      lines.push(`💰 <b>+${fmt(out.gold)}</b> · ⭐ 경험치 <b>+${fmt(out.exp)}</b>`);
      if (out.first && S.kind === 'dungeon' && M.DUNGEONS[S.idx + 1]) lines.push(`🔓 다음 던전 「${M.DUNGEONS[S.idx + 1].name}」이 열렸다`);
    } else {
      title = b.phase === 'retreat' ? '후퇴했다' : b.phase === 'timeout' ? '시간 초과…' : '기절했다…';
      lines.push(`처치 ${b.killed} · 경험치 <b>+${fmt(out.exp)}</b>만 챙겼다`);
      lines.push(b.phase === 'retreat' ? '무리하지 않는 것도 실력이다냥' : '집에서 눈을 떴다. 수련하고 다시 오자');
    }
    if (out.ups.length) lines.push(`🎉 레벨 업! Lv <b>${out.ups[out.ups.length - 1]}</b> (모든 능력치 +${out.ups.length})`);
    lines.push(`지금 ${g.day}일째 ${hh(g.hour)}`);
    $('res-title').textContent = title; $('res-lines').innerHTML = lines.join('<br>');
    this.show('result-screen');
  },
  showChoice(I, g) {
    $('ch-title').textContent = I.final ? '그림자 고양이에게 졌다…' : `${I.name}에게 졌다…`;
    $('ch-lines').innerHTML = I.final
      ? '키위 점술사가 카드를 뒤집는다… 「운명은 정해져 있지 않아요.」<br><b>되감기</b> — 오늘 아침으로 돌아가 다시 준비한다<br><b>물러서기</b> — 그림자 고양이가 <b>7일 뒤</b> 다시 온다 (더 수련할 수 있다)'
      : `<b>되감기</b> — 오늘 아침으로 돌아가 다시 준비한다<br><b>물러서기</b> — 금화 30%(💰 ${fmt(g.gold * 0.3)})를 빼앗기고 다음 날로`;
    $('btn-concede').textContent = I.final ? '7일 더 수련' : '물러서기';
    this.show('choice-screen');
  },
  showEnding(g) {
    const r = G.rank(g);
    $('end-lines').innerHTML = `그림자 고양이를 물리치고 모구 마을을 지켰다!<br>` +
      `<b>${g.day}일째</b> · Lv ${g.lv} · 힘 ${g.atk} 민첩 ${g.agi} 냥력 ${g.mag}<br>` +
      `무기 ${G.weapon(g).name} · 처치 ${g.stats.kills} · 되감기 ${g.stats.rollbacks}번 · 난이도 ${M.DIFFS[g.diff].name}<br>` +
      `랭크 <b style="font-size:28px">${r}</b>`;
    this.show('ending-screen');
  },
};
