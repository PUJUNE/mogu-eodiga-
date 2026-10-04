// ui.js — 저장(난이도별 도달 도전자·격파 기록) + 화면 전환
const M = window.MSK;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogusketch-save-v1',
  data: { diff: 'normal', player: 'mogu', stage: {}, cleared: {}, charCleared: {}, wins: 0, plays: 0 },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    if (M.FIGHTERS[this.data.player]) M.player = this.data.player;
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  setDiff(d) { if (!M.DIFFS[d]) return; M.diff = d; this.data.diff = d; this.store(); },
  setPlayer(id) { if (!M.FIGHTERS[id]) return; M.player = id; this.data.player = id; this.store(); },
  stageOf(d) { return Math.min(M.LADDER.length - 1, this.data.stage[d] || 0); },
  beat(d, stage, playerId) {
    this.data.wins = (this.data.wins || 0) + 1;
    this.data.stage[d] = Math.max(this.data.stage[d] || 0, Math.min(M.LADDER.length - 1, stage + 1));
    if (stage === M.LADDER.length - 1) {
      this.data.cleared[d] = true; this.data.stage[d] = 0;
      if (!this.data.charCleared) this.data.charCleared = {};
      this.data.charCleared[playerId || M.player] = true;
    }
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
    document.querySelectorAll('.char-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        M.audio.resume(); M.audio.select();
        M.save.setPlayer(btn.dataset.char);
        this.updateCharBtns();
        this.refreshTitle();
      });
    });
    this.updateDiffBtns();
    this.updateCharBtns();
    this.refreshTitle();
  },

  // 플레이어 캐릭터 9종 — 선택한 캐릭터는 검은 잉크, 격파한 적 있는 캐릭터엔 ✎
  updateCharBtns() {
    document.querySelectorAll('.char-btn').forEach((btn) => {
      const id = btn.dataset.char, def = M.FIGHTERS[id];
      btn.classList.toggle('selected', id === M.player);
      const done = (M.save.data.charCleared || {})[id];
      btn.textContent = def.name + (done ? ' ✎' : '');
    });
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
    const me = M.FIGHTERS[M.player];
    const def = M.FIGHTERS[M.ladderFor(M.player)[s]];
    $('btn-start').textContent = s > 0 ? `도전자 ${s + 1} ${def.name}부터 (Enter)` : '도전 시작 (Enter)';
    $('btn-fresh').classList.toggle('hidden', s === 0);
    $('title-hi').textContent = (M.save.data.cleared[M.diff]
      ? `${M.DIFFS[M.diff].name} 격파 완료 ✎ — 다시 처음부터 도전할 수 있어요`
      : `${M.DIFFS[M.diff].name} · 도전자 ${s + 1} / ${M.LADDER.length}`) + ` · ${me.name} — ${me.trait}`;
    const hint = $('title-hint');
    if (hint.dataset.touch === '1') {
      hint.innerHTML = '왼쪽 패드로 이동·점프·앉기 · 약·강·잡기·필살 버튼<br>' +
        `필살 버튼 = ${me.sp1 ? me.sp1.name : '없음'}${me.sp2 ? ` · 패드 위+필살 = ${me.sp2.name}` : ''}${me.sp3 ? ` · 패드 아래+필살 = ${me.sp3.name}` : ''} · 게이지가 차면 초필살`;
    } else {
      hint.innerHTML = '←→ 이동 · ↑ 점프 · ↓ 앉기 · Z 약 · X 강 · Z+X 잡기 · C 초필살 · Esc 일시정지<br>' +
        `${M.cmdHint(M.player)} · 뒤로 누르면 가드(앉아서 뒤 = 하단 가드)`;
    }
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
  },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  showWin(st) {
    const def = st.p[1].def;
    $('win-title').textContent = `${def.name} 격파!`;
    const next = M.FIGHTERS[st.ladder[st.stage + 1]];
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
