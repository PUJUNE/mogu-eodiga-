// ui.js — 저장(난이도·직업·최고 기록) + 화면 전환 + 갈림길/컨티뉴 화면
const M = window.MDN;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogudungeon-save-v1',
  data: { diff: 'normal', cls: 'fighter', best: {}, cleared: {}, clearedCls: {}, plays: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    if (M.CLASSES[this.data.cls]) M.cls = this.data.cls;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setDiff(d) { if (!M.DIFFS[d]) return; M.diff = d; this.data.diff = d; this.store(); },
  setCls(c) { if (!M.CLASSES[c]) return; M.cls = c; this.data.cls = c; this.store(); },
  bestOf(d) { return this.data.best[d] || { gold: 0, stages: 0 }; },
  // 최고 금화 갱신 여부를 돌려준다
  record(d, cls, gold, stages, cleared) {
    const b = this.bestOf(d);
    const isBest = gold > b.gold;
    this.data.best[d] = { gold: Math.max(b.gold, gold), stages: Math.max(b.stages, stages) };
    if (cleared) { this.data.cleared[d] = true; this.data.clearedCls[cls] = true; }
    this.data.plays = (this.data.plays || 0) + 1;
    this.store();
    return isBest;
  },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'branch-screen', 'win-screen', 'over-screen', 'ending-screen'],
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => { M.save.setDiff(btn.dataset.diff); this.updateDiffBtns(); this.refreshTitle(); });
    });
    document.querySelectorAll('.class-btn').forEach((btn) => {
      btn.addEventListener('click', () => { M.save.setCls(btn.dataset.cls); this.updateClassBtns(); this.refreshTitle(); });
    });
    this.updateDiffBtns();
    this.updateClassBtns();
    this.refreshTitle();
  },

  updateDiffBtns() {
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.diff === M.diff);
      btn.textContent = M.DIFFS[btn.dataset.diff].name + (M.save.data.cleared[btn.dataset.diff] ? ' 👑' : '');
    });
  },
  updateClassBtns() {
    document.querySelectorAll('.class-btn').forEach((btn) => {
      const C = M.CLASSES[btn.dataset.cls];
      btn.classList.toggle('selected', btn.dataset.cls === M.cls);
      btn.innerHTML = `<span class="ce">${C.emoji}</span>${C.name}${M.save.data.clearedCls[btn.dataset.cls] ? ' 🏆' : ''}<small>HP ${C.hp} · 공격 ${C.atk} · ${C.skill.emoji} ${C.skill.name}</small>`;
    });
  },

  refreshTitle() {
    const b = M.save.bestOf(M.diff), C = M.CLASSES[M.cls];
    $('title-hi').innerHTML = (b.gold > 0
      ? `${M.DIFFS[M.diff].name} 최고 금화 <b>${b.gold.toLocaleString()}</b> · 최다 ${b.stages}스테이지 돌파<br>`
      : '') + `<span class="skill-desc">${C.skill.emoji} ${C.skill.name} (MP ${C.skill.mp}) — ${C.skill.desc}</span>`;
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title-screen' || id === 'ending-screen');
  },
  hideAll() {
    for (const s of this.screens) $(s).classList.add('hidden');
    $('hud').classList.remove('hidden');
  },

  toast(text, dur = 1.8) {
    const el = $('hud-toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  // 갈림길: 다음 스테이지 후보 2개
  showBranch(st, next) {
    $('branch-from').textContent = `${st.stage.name} 돌파! 다음 길은?`;
    const wrap = $('branch-options');
    wrap.innerHTML = '';
    next.forEach((key, i) => {
      const S = M.STAGES[key];
      const b = document.createElement('button');
      b.className = 'btn branch-btn'; b.dataset.key = key;
      b.innerHTML = `<span class="bk">${i === 0 ? '◀ 왼쪽' : '오른쪽 ▶'}</span><b>${S.name}</b><small>${M.STAGE_DESC[key] || ''}</small>`;
      wrap.appendChild(b);
    });
    this.show('branch-screen');
  },

  showClear(st) {
    $('win-stats').innerHTML =
      `${M.CLASSES[st.cls].name} · LV${st.p.level} · 금화 <b>${st.gold.toLocaleString()}</b><br>` +
      `처치 ${st.kills} · 보물상자 ${st.chests} · 컨티뉴 ${st.continues}회 · ${M.DIFFS[st.diff].name}<br>` +
      `루트: ${st.route.map((k) => M.STAGES[k].name).join(' → ')}` +
      (st.isBest ? '<br><b style="color:#7de08a">🎉 최고 금화 경신!</b>' : '');
    $('btn-next').style.display = M.nextDiff(st.diff) ? '' : 'none';
    if (M.nextDiff(st.diff)) $('btn-next').textContent = `${M.DIFFS[M.nextDiff(st.diff)].name}에 도전 →`;
    this.show('win-screen');
  },

  showOver(st) {
    $('over-stats').innerHTML = `${st.stage.name} ${st.section + 1}구간에서 쓰러졌다…<br>금화 ${st.gold.toLocaleString()} · 처치 ${st.kills} · LV${st.p.level}`;
    this.show('over-screen');
  },
};
