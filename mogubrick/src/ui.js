// ui.js — 저장 + 화면 전환
const M = window.MBK;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogubrick-save-v1',
  data: { best: 1, stars: {}, saved: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  record(no, stars, rescued) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    this.data.saved = (this.data.saved || 0) + rescued;
    if (no + 1 > this.data.best) this.data.best = Math.min(M.TOTAL, no + 1);
    this.store();
  },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'win-screen', 'over-screen', 'ending-screen'],
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;
    this.refreshTitle();
  },

  refreshTitle() {
    const best = M.save.data.best;
    $('btn-continue').style.display = best > 1 ? '' : 'none';
    $('btn-continue').textContent = `이어하기 — STAGE ${best}`;
    const total = Object.values(M.save.data.stars).reduce((a, b) => a + b, 0);
    $('title-hi').textContent = total > 0 ? `★ 합계 ${total} · 누적 구출 ${M.save.data.saved || 0}마리` : '';
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
    $('win-stats').innerHTML = `점수 ${st.score} · 모구 구출 ${st.rescued}/${st.stage.moguN}` +
      (st.livesLost === 0 ? '<br><b style="color:#7de08a">노 미스!</b>' : `<br>공 놓침 ${st.livesLost}회`) +
      (st.moguLost > 0 ? `<br><b style="color:#ff8a8a">놓친 모구 ${st.moguLost}마리…</b>` : '');
    $('btn-next').style.display = st.no < M.TOTAL ? '' : 'none';
    this.show('win-screen');
  },
};
