// ui.js — 저장 + 화면 전환
const M = window.MSL;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogusolo-save-v2',
  KEY_V1: 'mogusolo-save-v1',
  data: { best: 1, stars: {}, exp: 0, gear: { fang: false, armor: false }, diff: 'normal' },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
      else {
        // v1(미션 단위) → v2(스테이지 단위) 마이그레이션
        const old = localStorage.getItem(this.KEY_V1);
        if (old) {
          const d = JSON.parse(old);
          this.data.best = ((d.best || 1) - 1) * M.STAGES_PER + 1;
          this.data.exp = d.exp || 0;
          this.data.gear = Object.assign({ fang: false, armor: false }, d.gear);
          for (const k of Object.keys(d.stars || {})) this.data.stars[k * M.STAGES_PER] = d.stars[k];
          this.store();
        }
      }
    } catch (e) {}
    if (!this.data.gear) this.data.gear = { fang: false, armor: false };
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setExp(exp) { this.data.exp = Math.max(this.data.exp || 0, exp); this.store(); },
  setGear(key) { this.data.gear[key] = true; this.store(); },
  setDiff(d) {
    if (!M.DIFFS[d]) return;
    M.diff = d;
    this.data.diff = d;
    this.store();
  },
  record(no, stars) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    if (no + 1 > this.data.best) this.data.best = Math.min(M.TOTAL, no + 1);
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
    $('btn-continue').textContent = `이어하기 — M${M.mOf(best)}-${M.sOf(best)}`;
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

  showWin(st, gearMsg) {
    const boss = st.stage.sections[st.stage.sections.length - 1].boss;
    $('win-big').textContent = boss.final ? '⚔️ 미션 클리어!!' : '⚔️ 스테이지 클리어!';
    $('win-stars').textContent = '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars);
    $('win-stats').innerHTML = `M${st.mission}-${st.stg} ${boss.name} 격파! · 점수 ${st.score} · Lv.${st.lv}` +
      (st.deaths === 0 ? '<br><b style="color:#7de08a">노 컨티뉴!</b>' : `<br>컨티뉴 ${st.deaths}회`) +
      (gearMsg ? `<br><b style="color:#b07dff">${gearMsg}</b>` : '');
    $('btn-next').style.display = st.no < M.TOTAL ? '' : 'none';
    $('btn-next').textContent = boss.final ? '다음 미션 →' : '다음 스테이지 →';
    this.show('win-screen');
  },

  setCountdown(n) { $('over-count').textContent = n; },
};
