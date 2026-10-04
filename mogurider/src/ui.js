// ui.js — 저장(난이도별 최고 기록) + 화면 전환
const M = window.MDR;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogurider-save-v1',
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
  bestOf(d) { return this.data.best[d] || { score: 0, dist: 0 }; },
  // 최고 점수 갱신 여부를 돌려준다
  record(d, score, dist, cleared) {
    const b = this.bestOf(d);
    const isBest = score > b.score;
    this.data.best[d] = { score: Math.max(b.score, score), dist: Math.max(b.dist, Math.floor(dist)) };
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
    $('title-hi').innerHTML = b.score > 0
      ? `${M.DIFFS[M.diff].name} 최고 점수 <b>${b.score.toLocaleString()}</b> · 최고 거리 ${b.dist.toLocaleString()}m`
      : '12,000m 위의 달까지 날아오르면 CLEAR!';
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
      `점수 <b>${st.score.toLocaleString()}</b> · 코인 ${st.coins} · 격추 ${st.kills}<br>` +
      `난이도 ${M.DIFFS[st.diff].name} · 보스 ${st.bossKills}마리 격파` +
      (st.isBest ? '<br><b style="color:#7de08a">🎉 최고 점수 경신!</b>' : '');
    $('btn-next').style.display = M.nextDiff(st.diff) ? '' : 'none';
    if (M.nextDiff(st.diff)) $('btn-next').textContent = `${M.DIFFS[M.nextDiff(st.diff)].name}에 도전 →`;
    this.show('win-screen');
  },

  showOver(st, isBest) {
    const rank = M.rankOf(st.dist);
    $('over-rank').textContent = `${rank.tag} ${rank.name}`;
    $('over-count').textContent = `${Math.floor(st.dist).toLocaleString()} m`;
    const b = M.save.bestOf(st.diff);
    $('over-stats').innerHTML =
      `점수 <b>${st.score.toLocaleString()}</b> · 코인 ${st.coins} · 격추 ${st.kills} · ${M.DIFFS[st.diff].name}<br>` +
      (isBest ? '<b style="color:#7de08a">🎉 최고 점수 경신!</b>' : `최고 점수 ${b.score.toLocaleString()}`);
    this.show('over-screen');
  },
};
