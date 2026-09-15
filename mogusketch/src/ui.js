// ui.js — 저장(난이도별 도달 도전자·격파 기록) + 화면 전환
const M = window.MSK;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogusketch-save-v1',
  data: { diff: 'normal', stage: {}, cleared: {}, wins: 0, plays: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setDiff(d) { if (!M.DIFFS[d]) return; M.diff = d; this.data.diff = d; this.store(); },
  stageOf(d) { return Math.min(M.LADDER.length - 1, this.data.stage[d] || 0); },
  beat(d, stage) {
    this.data.wins = (this.data.wins || 0) + 1;
    this.data.stage[d] = Math.max(this.data.stage[d] || 0, Math.min(M.LADDER.length - 1, stage + 1));
    if (stage === M.LADDER.length - 1) { this.data.cleared[d] = true; this.data.stage[d] = 0; }
    this.store();
  },
  resetStage(d) { this.data.stage[d] = 0; this.store(); },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'win-screen', 'over-screen', 'ending-screen'],

  init() {
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        M.audio.resume(); M.audio.select();
        M.save.setDiff(btn.dataset.diff);
        this.updateDiffBtns();
        this.refreshTitle();
      });
    });
    this.updateDiffBtns();
    this.refreshTitle();
  },

  updateDiffBtns() {
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.diff === M.diff);
      const done = M.save.data.cleared[btn.dataset.diff];
      btn.textContent = M.DIFFS[btn.dataset.diff].name + (done ? ' ✎' : '');
    });
  },

  refreshTitle() {
    const s = M.save.stageOf(M.diff);
    const def = M.FIGHTERS[M.LADDER[s]];
    $('btn-start').textContent = s > 0 ? `도전자 ${s + 1} ${def.name}부터 (Enter)` : '도전 시작 (Enter)';
    $('btn-fresh').classList.toggle('hidden', s === 0);
    $('title-hi').textContent = M.save.data.cleared[M.diff]
      ? `${M.DIFFS[M.diff].name} 격파 완료 ✎ — 다시 처음부터 도전할 수 있어요`
      : `${M.DIFFS[M.diff].name} · 도전자 ${s + 1} / ${M.LADDER.length}`;
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
  },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  showWin(st) {
    const def = st.p[1].def;
    $('win-title').textContent = `${def.name} 격파!`;
    const next = M.FIGHTERS[M.LADDER[st.stage + 1]];
    $('win-stats').innerHTML =
      `라운드 ${st.wins[0]} : ${st.wins[1]} · 최대 콤보 ${st.stats.maxCombo[0]}히트<br>` +
      (next ? `다음 도전자 — <b>${next.name}</b>` : '');
    this.show('win-screen');
  },

  showOver(st) {
    const def = st.p[1].def;
    $('over-title').textContent = `${def.name}에게 패배`;
    $('over-stats').innerHTML = `라운드 ${st.wins[0]} : ${st.wins[1]} · 난이도 ${M.DIFFS[st.diff].name}<br>같은 도전자에게 몇 번이든 다시 도전할 수 있어요`;
    this.show('over-screen');
  },
};
