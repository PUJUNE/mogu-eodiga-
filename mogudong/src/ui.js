// ui.js — 저장(난이도별 최고 기록) + 화면 전환
const M = window.MDD;
const $ = (id) => document.getElementById(id);

const fmt = (sec) => {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
};
M.fmtTime = fmt;

M.save = {
  KEY: 'mogudong-save-v1',
  data: { diff: 'normal', best: {}, cleared: {}, plays: 0 },
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
  bestOf(d) { return this.data.best[d] || { time: 0, dodged: 0 }; },
  // 최고 기록 갱신 여부를 돌려준다
  record(d, time, dodged, cleared) {
    const b = this.bestOf(d);
    const isBest = time > b.time + 0.05;
    this.data.best[d] = { time: Math.max(b.time, time), dodged: Math.max(b.dodged, dodged) };
    if (cleared) this.data.cleared[d] = true;
    this.data.plays = (this.data.plays || 0) + 1;
    this.store();
    return isBest;
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
      btn.textContent = M.DIFFS[btn.dataset.diff].name + (done ? ' 👑' : '');
    });
  },

  refreshTitle() {
    const b = M.save.bestOf(M.diff);
    $('title-hi').innerHTML = b.time > 0
      ? `${M.DIFFS[M.diff].name} 최고 기록 <b>${fmt(b.time)}</b> · 피한 똥 ${b.dodged}개`
      : '5분(5:00)을 버티면 CLEAR!';
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

  showClear(st) {
    $('win-stats').innerHTML =
      `5분 완주! 피한 똥 <b>${st.dodged}</b>개<br>` +
      `난이도 ${M.DIFFS[st.diff].name} · 웨이브 ${M.WAVES} 돌파`;
    $('btn-next').style.display = M.nextDiff(st.diff) ? '' : 'none';
    if (M.nextDiff(st.diff)) $('btn-next').textContent = `${M.DIFFS[M.nextDiff(st.diff)].name}에 도전 →`;
    this.show('win-screen');
  },

  showOver(st, isBest) {
    const rank = M.rankOf(st.t);
    $('over-rank').textContent = `${rank.tag} ${rank.name}`;
    $('over-count').textContent = fmt(st.t);
    const b = M.save.bestOf(st.diff);
    $('over-stats').innerHTML =
      `피한 똥 <b>${st.dodged}</b>개 · 웨이브 ${st.waveNo} · ${M.DIFFS[st.diff].name}<br>` +
      (isBest ? '<b style="color:#7de08a">🎉 최고 기록 경신!</b>' : `최고 기록 ${fmt(b.time)}`);
    this.show('over-screen');
  },
};
