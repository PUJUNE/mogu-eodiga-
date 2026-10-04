// ui.js — 저장(스테이지·난이도별 최고 점수와 별) + 화면 전환
const M = window.MSP;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogusongpyeon-save-v1',
  data: { diff: 'normal', stage: 0, best: {}, plays: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    M.stage = Math.min(this.data.stage || 0, M.STAGES.length - 1);
    if (!this.unlocked(M.stage)) M.stage = 0;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setDiff(d) { if (!M.DIFFS[d]) return; M.diff = d; this.data.diff = d; this.store(); },
  setStage(i) { if (!this.unlocked(i)) return; M.stage = i; this.data.stage = i; this.store(); },
  bestOf(i, d) { return this.data.best[d + ':' + i] || { score: 0, stars: 0 }; },
  starsAny(i) { return Math.max(0, ...M.DIFF_ORDER.map((d) => this.bestOf(i, d).stars)); },
  // 앞 가게에서 별 하나라도 받으면(난이도 무관) 다음 가게가 열린다
  unlocked(i) { return i === 0 || this.starsAny(i - 1) >= 1; },
  totalStars() { let n = 0; for (let i = 0; i < M.STAGES.length; i++) n += this.starsAny(i); return n; },
  record(i, d, score, stars) {
    const b = this.bestOf(i, d);
    const isBest = score > b.score;
    this.data.best[d + ':' + i] = { score: Math.max(b.score, score), stars: Math.max(b.stars, stars) };
    this.data.plays = (this.data.plays || 0) + 1;
    this.store();
    return isBest;
  },
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'result-screen'],

  init() {
    $('title-icon').src = M.ASSETS.mogu;
    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => { M.save.setDiff(btn.dataset.diff); this.refreshTitle(); });
    });
    this.refreshTitle();
  },

  refreshTitle() {
    document.querySelectorAll('.diff-btn').forEach((btn) => btn.classList.toggle('selected', btn.dataset.diff === M.diff));
    const list = $('stage-list');
    list.innerHTML = '';
    M.STAGES.forEach((S, i) => {
      const b = document.createElement('button');
      const open = M.save.unlocked(i);
      const stars = M.save.bestOf(i, M.diff).stars;
      b.className = 'stage-btn' + (i === M.stage ? ' selected' : '') + (open ? '' : ' locked');
      b.dataset.stage = i;
      b.innerHTML = `<div class="no">${i + 1}호점</div><div>${open ? S.name : '🔒'}</div>` +
        `<div class="st">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`;
      b.onclick = () => { if (open) { M.save.setStage(i); this.refreshTitle(); } };
      list.appendChild(b);
    });
    const S = M.STAGES[M.stage];
    const b = M.save.bestOf(M.stage, M.diff);
    const th = M.Logic.thresholds(M.stage, M.diff);
    $('title-hi').innerHTML = `${M.stage + 1}호점 「${S.name}」 — ${S.sub} · ${Math.floor(S.time / 60)}분 ${S.time % 60 ? (S.time % 60) + '초' : ''}` +
      `<br>별 기준 ${th.join(' / ')}점` + (b.score ? ` · 최고 ${b.score}점` : '') + ` · 모은 별 ${M.save.totalStars()}/15`;
  },

  show(id) { for (const s of this.screens) $(s).classList.toggle('hidden', s !== id); },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  showResult(st, isBest) {
    const stars = M.Logic.starsOf(st);
    const th = M.Logic.thresholds(st.stage, st.diff);
    $('result-title').textContent = stars ? '영업 종료! 수고했어요' : '영업 종료…';
    $('result-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}">⭐</span>`).join('');
    $('result-score').textContent = `${st.score}점`;
    $('result-stats').innerHTML =
      `출하 ${st.served}접시 (송편 ${st.songsServed}개) · 놓친 주문 ${st.missed} · 잘못 낸 접시 ${st.wrong}<br>` +
      `최고 콤보 x${st.bestCombo}` + (st.S.kiwi ? ` · 쫓아낸 키위 ${st.shooed} · 구멍 난 송편 ${st.pecked}` : '') +
      `<br>별 기준 ${th.join(' / ')}점 · ${M.DIFFS[st.diff].name}`;
    let msg = isBest ? '🎉 이 가게 최고 기록!' : '';
    const last = st.stage === M.STAGES.length - 1;
    if (stars && last) msg += (msg ? ' · ' : '') + '🌕 추석 대목을 무사히 넘겼어요!';
    else if (stars && !last && M.save.unlocked(st.stage + 1)) msg += (msg ? ' · ' : '') + `${st.stage + 2}호점이 열렸어요`;
    if (!stars) msg = `별 하나까지 ${th[0] - st.score}점 — 찌는 동안 다음 반죽을 빚어 두면 빨라져요`;
    $('result-msg').textContent = msg;
    const canNext = !last && M.save.unlocked(st.stage + 1);
    $('btn-next').style.display = canNext ? '' : 'none';
    this.show('result-screen');
    return stars;
  },
};
