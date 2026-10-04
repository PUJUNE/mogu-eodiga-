// ui.js — 저장(이긴 상대 · 선택) + 타이틀 선수 고르기 + 점수판 · 알림 · 슛 게이지
const M = window.MBK;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogubasket-save-v1',
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
    $('opp-line').textContent = `「${P.name}」 ${P.line}  —  속도 ${stars(P.spd)} 슛 ${stars(P.sht)} 수비 ${stars(P.def)} 점프 ${stars(P.jmp)}`;
  },

  show(id) { for (const s of this.screens) $(s).classList.toggle('hidden', s !== id); },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  setupHud(st) {
    M.portrait($('hud-me'), st.pl[0].key); M.portrait($('hud-cpu'), st.pl[1].key);
    $('hud-me-nm').textContent = st.pl[0].P.name; $('hud-cpu-nm').textContent = st.pl[1].P.name;
    $('goal').textContent = `${M.WIN_SCORE}점 선승 · ${M.DIFFS[st.diff].name}`;
  },
  hud(st) {
    $('sc-me').textContent = st.score[0]; $('sc-cpu').textContent = st.score[1];
    $('poss-me').classList.toggle('on', st.off === 0); $('poss-cpu').classList.toggle('on', st.off === 1);
    const c = Math.max(0, Math.ceil(st.shotClock));
    $('clock').textContent = c; $('clock').classList.toggle('low', c <= 4 && st.phase === 'live');
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

  meter(st) {                                       // 내 선수가 점프슛 중이면 머리 옆에 게이지
    const el = $('meter'), p = st.pl[0];
    if (p.state !== 'shoot' || !p.shot || p.shot.layup) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const sp = M.R3.toScreen(p.x, p.y, p.z + 1.9 * p.h);
    el.style.left = (sp.x + 34) + 'px'; el.style.top = (sp.y - 60) + 'px';
    const zone = el.querySelector('.zone');
    zone.style.bottom = (M.SWEET[0] * 100) + '%'; zone.style.height = ((M.SWEET[1] - M.SWEET[0]) * 100) + '%';
    const m = p.shot.phase === 'air' ? p.shot.m : 0;
    el.querySelector('.fill').style.height = Math.min(100, m * 100) + '%';
    el.classList.toggle('good', m >= M.SWEET[0] && m <= M.SWEET[1]);
  },

  showResult(st) {
    const won = st.winner === 0;
    const me = st.pl[0], o = st.pl[1];
    $('res-title').textContent = won ? '승리! 🏆' : '패배…';
    $('res-score').textContent = `${st.score[0]} : ${st.score[1]}`;
    const pct = (p) => p.att ? Math.min(100, Math.round(p.made / p.att * 100)) + '%' : '-';
    $('res-stats').innerHTML =
      `${me.P.name} — 슛 ${me.made}/${me.att} (${pct(me)}) · 덩크 ${me.dunks} · 스틸 ${me.steals} · 블록 ${me.blocks} · 앵클 브레이크 ${me.ankles} · 리바운드 ${me.reb}<br>` +
      `${o.P.name} — 슛 ${o.made}/${o.att} (${pct(o)}) · 덩크 ${o.dunks} · 스틸 ${o.steals} · 블록 ${o.blocks}`;
    const i = M.LADDER.indexOf(o.key);
    const next = M.LADDER[i + 1];
    let m = '';
    if (won && next) m = `다음 상대 「${M.PLAYERS[next].name}」가 열렸어요 · ${o.P.name}(으)로도 플레이할 수 있어요`;
    else if (won) m = '그림자 고양이까지 꺾었다! 옥상 코트의 주인은 모구 🐱🏀';
    else m = '팁: 수비가 코앞이면 X로 크로스오버 → 넘어지면 골밑으로!';
    $('res-msg').textContent = m;
    $('btn-next').style.display = won && next ? '' : 'none';
    this.show('result-screen');
  },
};

function stars(v) { const n = Math.max(1, Math.min(5, Math.round((v - 0.7) / 0.11))); return '★'.repeat(n) + '☆'.repeat(5 - n); }
