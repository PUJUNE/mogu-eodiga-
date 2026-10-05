// ui.js — 저장(이긴 상대 · 선택) + 타이틀 선수 고르기 + 점수판 · 알림
const M = window.MBD;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogubadminton-save-v1',
  data: { diff: 'normal', my: 'mogu', opp: 'mouse', beaten: {}, best: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    if (M.DIFFS[this.data.diff]) M.diff = this.data.diff;
    if (!this.canPlayAs(this.data.my)) this.data.my = 'mogu';
    if (!this.oppOpen(this.data.opp)) this.data.opp = M.LADDER[0];
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  beatenAny(k) { return !!this.data.beaten[k]; },
  oppOpen(k) { const i = M.LADDER.indexOf(k); return i === 0 || (i > 0 && this.beatenAny(M.LADDER[i - 1])); },
  canPlayAs(k) { return k === 'mogu' || this.beatenAny(k); },
  record(opp, diff, won, score) {
    if (won) { this.data.beaten[opp] = this.data.beaten[opp] || {}; this.data.beaten[opp][diff] = true; }
    const key = diff + ':' + opp, b = this.data.best[key];
    const margin = score[0] - score[1];
    if (!b || margin > b) this.data.best[key] = margin;
    this.store();
  },
};

// 얼굴 초상 — 모구는 사진, 나머지는 그림
M.portrait = function (canvas, key) {
  const g = canvas.getContext('2d'), S = canvas.width;
  g.clearRect(0, 0, S, S);
  const P = M.PLAYERS[key];
  g.fillStyle = '#' + P.jersey.toString(16).padStart(6, '0');
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
  if (P.face === 'photo') {
    if (M.faceImg && M.faceImg.complete) g.drawImage(M.faceImg, S * 0.06, S * 0.12, S * 0.88, S * 0.88 * 221 / 256);
  } else { g.save(); g.scale(S / 256, S / 256); M.drawFace(P.face, g, 256); g.restore(); }
};

M.ui = {
  screens: ['title-screen', 'pause-screen', 'result-screen'],
  msgTimer: null, hintTimer: null,

  init() {
    document.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => {
      M.save.data.diff = M.diff = b.dataset.diff; M.save.store(); this.refreshTitle();
    }));
    this.refreshTitle();
  },

  refreshTitle() {
    const S = M.save;
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b.dataset.diff === M.diff));
    const mk = (key, open, sel, sub, onClick) => {
      const el = document.createElement('button');
      el.className = 'pick' + (sel ? ' selected' : '') + (open ? '' : ' locked');
      el.dataset.key = key;
      const cv = document.createElement('canvas'); cv.width = cv.height = 104;
      el.appendChild(cv);
      el.insertAdjacentHTML('beforeend', `<div>${open ? M.PLAYERS[key].name : '???'}</div>${sub ? `<div class="won">${sub}</div>` : ''}`);
      if (open) M.portrait(cv, key);
      el.onclick = () => { if (open) onClick(); };
      return el;
    };
    const my = $('my-list'); my.innerHTML = '';
    ['mogu', ...M.LADDER].forEach((k) => {
      if (k !== 'mogu' && !S.beatenAny(k)) return;
      my.appendChild(mk(k, true, S.data.my === k, '', () => { S.data.my = k; S.store(); this.refreshTitle(); }));
    });
    const opp = $('opp-list'); opp.innerHTML = '';
    M.LADDER.forEach((k, i) => {
      const won = S.data.beaten[k] ? Object.keys(S.data.beaten[k]).map((d) => M.DIFFS[d].name[0]).join('') : '';
      opp.appendChild(mk(k, S.oppOpen(k), S.data.opp === k, won ? '🏆 ' + won : `${i + 1}번째`, () => { S.data.opp = k; S.store(); this.refreshTitle(); }));
    });
    const P = M.PLAYERS[S.data.opp];
    $('opp-line').textContent = `「${P.name}」 ${P.line}  —  속도 ${stars(P.spd)} 파워 ${stars(P.pow)} 정확 ${stars(P.ctl)} 점프 ${stars(P.jmp)}`;
  },

  show(id) { for (const s of this.screens) $(s).classList.toggle('hidden', s !== id); },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  setupHud(st) {
    M.portrait($('hud-me'), st.pl[0].key); M.portrait($('hud-cpu'), st.pl[1].key);
    $('hud-me-nm').textContent = st.pl[0].P.name; $('hud-cpu-nm').textContent = st.pl[1].P.name;
    $('goal').textContent = `${M.WIN}점 랠리 포인트 · ${M.DIFFS[st.diff].name}`;
  },
  hud(st) {
    $('sc-me').textContent = st.score[0]; $('sc-cpu').textContent = st.score[1];
    $('poss-me').classList.toggle('on', st.server === 0); $('poss-cpu').classList.toggle('on', st.server === 1);
    const [a, b] = st.score;
    const deuce = a >= M.WIN - 1 && b >= M.WIN - 1;
    const gp = Math.max(a, b) >= M.WIN - 1 && Math.abs(a - b) >= 1;
    $('clock').textContent = deuce && a === b ? '듀스' : gp ? (a > b ? '매치 포인트!' : '상대 매치 포인트') : `랠리 ${st.rally}`;
    $('clock').classList.toggle('deuce', deuce || gp);
  },

  // 큰 알림 (덩크!, 앵클 브레이크! …)
  msg(text, sub = '', red = false, dur = 1.2) {
    const el = $('msg');
    el.innerHTML = text + (sub ? `<span class="s">${sub}</span>` : '');
    el.classList.toggle('red', red); el.style.opacity = 1;
    clearTimeout(this.msgTimer); this.msgTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },
  // 아래쪽 안내판
  hint(text, dur = 2.2) {
    const el = $('hint'); el.textContent = text; el.style.opacity = 1;
    clearTimeout(this.hintTimer); this.hintTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  showResult(st) {
    const won = st.winner === 0;
    const me = st.pl[0], o = st.pl[1];
    $('res-title').textContent = won ? '승리! 🏆' : '패배…';
    $('res-score').textContent = `${st.score[0]} : ${st.score[1]}`;
    $('res-stats').innerHTML =
      `${me.P.name} — 타구 ${me.hits} · 스매시 ${me.smashes} · 득점 샷 ${me.winners} · 실수 ${me.errors}<br>` +
      `${o.P.name} — 타구 ${o.hits} · 스매시 ${o.smashes} · 득점 샷 ${o.winners} · 실수 ${o.errors}<br>최장 랠리 ${st.longest}타`;
    const i = M.LADDER.indexOf(o.key);
    const next = M.LADDER[i + 1];
    let m = '';
    if (won && next) m = `다음 상대 「${M.PLAYERS[next].name}」가 열렸어요 · ${o.P.name}(으)로도 플레이할 수 있어요`;
    else if (won) m = '그림자 고양이까지 꺾었다! 냥 체육관 챔피언 모구 🐱🏸';
    else m = '팁: 노란 고리 근처에 미리 가 있다가, 높이 뜬 셔틀은 Space로 점프 스매시!';
    $('res-msg').textContent = m;
    $('btn-next').style.display = won && next ? '' : 'none';
    this.show('result-screen');
  },
};

function stars(v) { const n = Math.max(1, Math.min(5, Math.round((v - 0.7) / 0.11))); return '★'.repeat(n) + '☆'.repeat(5 - n); }
