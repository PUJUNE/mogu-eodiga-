// ui.js — 저장 + 코스 맵 + 화면 전환
const M = window.MRC;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogurace-save-v1',
  data: { stars: {}, best: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  unlocked() {
    let max = 1;
    for (let s = 1; s <= M.COURSES; s++) if (this.data.stars[s] > 0) max = Math.max(max, Math.min(M.COURSES, s + 1));
    return max;
  },
  record(no, stars, sec) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    const prev = this.data.best[no];
    if (stars > 0 && (!prev || sec < prev)) { this.data.best[no] = sec; this.store(); return true; }
    this.store();
    return false;
  },
  // 외부 세이브와 병합: 코스별 높은 별점·빠른 기록만 취한다 (모구 어디가 문법)
  merge(ext) {
    let gained = 0;
    for (let s = 1; s <= M.COURSES; s++) {
      const a = this.data.stars[s] || 0, b = (ext.stars && ext.stars[s]) || 0;
      if (b > a) { this.data.stars[s] = b; gained++; }
      const bt = (ext.best && ext.best[s]) || null;
      if (bt && (!this.data.best[s] || bt < this.data.best[s])) this.data.best[s] = bt;
    }
    this.store();
    return gained;
  },
};

M.ui = {
  screens: ['title-screen', 'map-screen', 'result-screen', 'pause-screen'],
  onStageClick: null,
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;

    // ── 세이브 내보내기 / 불러오기 (모구 어디가 문법) ──
    const msg = (t) => {
      $('save-msg').textContent = t;
      clearTimeout(this._saveMsgTimer);
      this._saveMsgTimer = setTimeout(() => { $('save-msg').textContent = ''; }, 4000);
    };
    $('btn-save-export').addEventListener('click', () => {
      const cleared = Object.values(M.save.data.stars).filter((v) => v > 0).length;
      const blob = new Blob([JSON.stringify(M.save.data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      a.download = `모구레이스_세이브_${ymd}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      msg(`내보냄 (클리어 ${cleared}개) — 받은 파일을 안전한 곳에 두세요`);
    });
    $('btn-save-import').addEventListener('click', () => $('save-file-input').click());
    $('save-file-input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const ext = JSON.parse(rd.result);
          if (!ext || typeof ext.stars !== 'object') throw new Error('format');
          const gained = M.save.merge(ext);
          if (!$('map-screen').classList.contains('hidden')) this.buildMap();
          msg(gained > 0 ? `불러옴 — 코스 ${gained}개 진행이 갱신됨` : '불러옴 — 이미 최신 진행입니다');
        } catch (err) {
          msg('세이브 파일이 아닙니다');
        }
      };
      rd.readAsText(f);
    });
  },

  show(id) { for (const s of this.screens) $(s).classList.toggle('hidden', s !== id); },
  hideAll() { for (const s of this.screens) $(s).classList.add('hidden'); },

  buildMap() {
    const track = $('map-track');
    track.innerHTML = '';
    const unlocked = M.save.unlocked();
    for (let w = 1; w <= M.COURSES / 6; w++) {
      const head = document.createElement('div');
      head.className = 'map-world';
      head.textContent = `WORLD ${w} · ${M.WORLDS[w].name}`;
      track.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'map-grid';
      for (let i = 1; i <= 6; i++) {
        const no = (w - 1) * 6 + i;
        const cell = document.createElement('button');
        cell.className = 'stage-cell';
        const stars = M.save.data.stars[no] || 0;
        if (stars > 0) cell.classList.add('cleared');
        if (no > unlocked) { cell.classList.add('locked'); cell.textContent = '🔒'; }
        else {
          const best = M.save.data.best[no];
          cell.innerHTML = `<b>${no}</b>` +
            (no % 6 === 0 ? '<span class="crown">👑</span>' : '') +
            (stars > 0 ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
                       : '<span class="stars dim">미주파</span>') +
            (best ? `<span class="best">${best.toFixed(1)}초</span>` : '');
          cell.addEventListener('click', () => this.onStageClick && this.onStageClick(no));
        }
        grid.appendChild(cell);
      }
      track.appendChild(grid);
    }
  },

  hudRun(st) {
    const stg = st.stage;
    $('hud-stage').textContent = `COURSE ${st.no} · ${stg.theme.name}${stg.rival ? ' · 👑 ' + stg.rival : ''}` +
      (M.diff !== 'normal' ? ` · ${M.DIFFS[M.diff].name}` : '');
    const best = M.save.data.best[st.no];
    $('hud-target').textContent = `체크포인트 ${stg.checkpoints.length}곳 · 통과 시 +${stg.cpBonus}초` +
      (best ? ` · 최고 ${best.toFixed(1)}초` : '');
  },

  toast(text, dur = 1.6) {
    const el = $('hud-toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  showResult(st, isBest) {
    const done = st.phase === 'finish';
    $('result-title').textContent = done ? (st.stars === 3 ? '완벽한 주파!!' : 'COURSE CLEAR!') : 'TIME OVER';
    $('result-title').style.color = done ? '#ffd83d' : '#ff8a8a';
    $('result-dist').textContent = done ? st.elapsed.toFixed(1) + ' 초' : (M.Logic.progress(st) * 100).toFixed(0) + ' %';
    $('result-stars').textContent = st.stars > 0 ? '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
    let html = done
      ? `남은 시간 <b>${st.time.toFixed(1)}초</b> · 최고 속도 <b>${(st.maxSpeed * M.KMH).toFixed(0)} km/h</b>`
      : `체크포인트 <b>${st.cpPassed}/${st.stage.checkpoints.length}</b> 통과 · 제한시간 소진`;
    if (isBest) html += '<br><b style="color:#7de08a">신기록!</b>';
    $('result-stats').innerHTML = html;
    $('btn-next').style.display = st.stars > 0 && st.no < M.COURSES ? '' : 'none';
    this.show('result-screen');
  },
};
