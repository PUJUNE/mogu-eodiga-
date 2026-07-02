// ui.js — 저장 + HUD + 화면 전환
const M = window.MTR;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'motris-save-v1',
  data: { best: 1, stars: {}, hiscore: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  record(no, stars) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    if (no + 1 > this.data.best) this.data.best = Math.min(30, no + 1);
    this.store();
  },
  score(s) { if (s > this.data.hiscore) { this.data.hiscore = s; this.store(); } },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'over-screen', 'ending-screen'],
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;
    this.refreshTitle();
  },

  refreshTitle() {
    const best = M.save.data.best;
    $('btn-continue').style.display = best > 1 ? '' : 'none';
    $('btn-continue').textContent = `이어하기 — STAGE ${best}`;
    $('title-hi').textContent = M.save.data.hiscore > 0 ? `HI-SCORE ${M.save.data.hiscore}` : '';
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title-screen' || id === 'ending-screen');
  },
  hideAll() {
    for (const s of this.screens) $(s).classList.add('hidden');
    $('hud').classList.remove('hidden');
  },

  hud(st) {
    $('hud-score').textContent = String(st.score).padStart(6, '0');
    $('hud-hi').textContent = String(Math.max(st.score, M.save.data.hiscore)).padStart(6, '0');
  },

  toast(text, dur = 1.8) {
    const el = $('hud-toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  setCountdown(n) { $('over-count').textContent = n; },
};
