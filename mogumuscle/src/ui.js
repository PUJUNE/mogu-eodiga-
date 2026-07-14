// ui.js — 저장 + 화면 전환
const M = window.MMS;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogumuscle-save-v1',
  data: { best: 1, stars: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setDiff(d) {
    if (!M.DIFFS[d]) return;
    M.diff = d;
    this.data.diff = d;
    this.store();
  },
  record(no, stars) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    if (no + 1 > this.data.best) this.data.best = Math.min(10, no + 1);
    this.store();
  },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'win-screen', 'over-screen', 'ending-screen'],
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        M.save.setDiff(btn.dataset.diff);
        this.updateDiffBtns();
      });
    });
    this.updateDiffBtns();
    this.refreshTitle();
  },

  updateDiffBtns() {
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.diff === M.diff);
    });
  },

  refreshTitle() {
    const best = M.save.data.best;
    $('btn-continue').style.display = best > 1 ? '' : 'none';
    $('btn-continue').textContent = `이어하기 — STAGE ${best}`;
    const total = Object.values(M.save.data.stars).reduce((a, b) => a + b, 0);
    $('title-hi').textContent = total > 0 ? `★ 합계 ${total}` : '';
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

  showWin(st) {
    $('win-stars').textContent = '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars);
    const pct = Math.round(M.Logic.teamHpPct(st.players) * 100);
    $('win-stats').innerHTML = `${st.stage.team.name} 격파! · 팀 체력 ${pct}% · 점수 ${st.score}` +
      (st.stars === 3 ? '<br><b style="color:#7de08a">무다운 완벽 승리!!</b>' : '');
    $('btn-next').style.display = st.no < 10 ? '' : 'none';
    this.show('win-screen');
  },

  setCountdown(n) { $('over-count').textContent = n; },
};
