// ui.js — 저장 + 주차장 맵 + 화면 전환 (모구레이스 문법)
const M = window.MPK;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'mogupark-save-v1',
  data: { stars: {}, best: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  // 미러 조절값은 판이 바뀌어도 유지된다 (실제로 한 번 맞추면 그대로 두는 것과 같게)
  loadMirror() {
    const m = this.data.mirror;
    if (!m) return;
    for (const k of ['room', 'left', 'right']) {
      if (m[k]) M.mirrorAdj[k] = { yaw: +m[k].yaw || 0, pitch: +m[k].pitch || 0 };
    }
  },
  storeMirror() { this.data.mirror = M.mirrorAdj; this.store(); },
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
  // 외부 세이브와 병합: 판별 높은 별점·빠른 기록만 취한다 (시리즈 공통 문법)
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

    // ── 세이브 내보내기 / 불러오기 ──
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
      a.download = `모구의주차_세이브_${ymd}.json`;
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
          msg(gained > 0 ? `불러옴 — ${gained}개 판 진행이 갱신됨` : '불러옴 — 이미 최신 진행입니다');
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
    for (let w = 1; w <= 5; w++) {
      const head = document.createElement('div');
      head.className = 'map-world';
      head.textContent = `WORLD ${w} · ${M.WORLDS[w].name}`;
      track.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'map-grid';
      for (let i = 1; i <= 10; i++) {
        const no = (w - 1) * 10 + i;
        const cell = document.createElement('button');
        cell.className = 'stage-cell';
        const stars = M.save.data.stars[no] || 0;
        if (stars > 0) cell.classList.add('cleared');
        if (no > unlocked) { cell.classList.add('locked'); cell.textContent = '🔒'; }
        else {
          const best = M.save.data.best[no];
          cell.innerHTML = `<b>${no}</b>` +
            (no % 10 === 0 ? '<span class="crown">👑</span>' : '') +
            (stars > 0 ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
                       : '<span class="stars dim">미주차</span>') +
            (best ? `<span class="best">${best.toFixed(1)}초</span>` : '');
          cell.addEventListener('click', () => this.onStageClick && this.onStageClick(no));
        }
        grid.appendChild(cell);
      }
      track.appendChild(grid);
    }
  },

  // 미러 조절 중 안내 띠 (null 이면 숨김)
  hudAdjust(kind, label) {
    const el = $('hud-adjust');
    el.style.display = kind ? 'block' : 'none';
    if (kind) {
      el.textContent = M.touch
        ? `🪞 ${label} 미러 조절 — 화면을 끌어 겨누기 · 🪞 버튼으로 다음 미러`
        : `🪞 ${label} 미러 조절 — 방향키(또는 드래그)로 겨누기 · M 다음 미러 · 0 초기화 · Esc 끝`;
    }
    const b = $('vbtn-mirror');
    if (b) b.classList.toggle('on', !!kind);
  },

  hudRun(st) {
    const stg = st.stage;
    const narrow = window.innerWidth < 620;                     // 좁은 화면은 제목을 줄여 TIME 과 안 겹치게
    $('hud-stage').textContent = (narrow ? `S${st.no} · ${stg.typeName}`
      : `STAGE ${st.no} · ${stg.theme.name} · ${stg.typeName}`) +
      (M.diff !== 'normal' ? ` · ${M.DIFFS[M.diff].name}` : '');
    const best = M.save.data.best[st.no];
    $('hud-target').textContent = (narrow ? `${stg.timeLimit}초 · 노란 칸에 정확히`
      : `제한 ${stg.timeLimit}초 · 노란 칸에 정확히 세우면 성공`) +
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
    const done = st.phase === 'parked';
    $('result-title').textContent = done ? (st.stars === 3 ? '완벽한 주차!!' : '주차 성공!')
      : st.phase === 'crash' ? '쿵! 사고' : 'TIME OVER';
    $('result-title').style.color = done ? '#ffd83d' : '#ff8a8a';
    $('result-dist').textContent = done ? st.elapsed.toFixed(1) + ' 초' : '';
    $('result-stars').textContent = st.stars > 0 ? '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
    let html = done
      ? `각도 <b>${st.resultAng.toFixed(1)}°</b> · 중심 이탈 <b>${(st.resultLat * 100).toFixed(0)}cm</b>` +
        ` · 기어 변경 <b>${st.gearShifts}회</b>` +
        (st.curbHits ? ` · 연석 <b>${st.curbHits}회</b>` : '')
      : st.phase === 'crash' ? '부딪히면 그 자리에서 실패 — 리플레이로 궤적을 복기하세요'
      : '제한시간 소진 — 크리프(페달 오프)로 천천히, 미리 정렬하세요';
    if (isBest) html += '<br><b style="color:#7de08a">신기록!</b>';
    $('result-stats').innerHTML = html;
    $('btn-next').style.display = st.stars > 0 && st.no < M.COURSES ? '' : 'none';
    this.clipNo = st.no;
    this.clipReady(M.Render.clip);
    this.show('result-screen');
  },

  // 리플레이 영상이 준비됐을 때만 저장 버튼을 띄운다 (녹화 미지원 브라우저에서는 안 뜸)
  clipReady(clip) {
    // CSS 기본이 display:none 이라 ''로는 안 켜진다 — 값을 명시해야 한다
    $('btn-clip').style.display = clip ? 'inline-block' : 'none';
    $('clip-msg').textContent = '';
  },

  saveClip() {
    const clip = M.Render.clip;
    if (!clip) return;
    const ext = clip.mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement('a');
    a.href = url;
    // 파일명은 ASCII 로 — 한글을 넣으면 크로미움이 이름을 통째로 버리고
    // 확장자 없는 'download' 로 저장해 버린다
    a.download = `mogupark-stage${String(this.clipNo).padStart(2, '0')}-replay.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    $('clip-msg').textContent = `저장했어요 · ${(clip.blob.size / 1024 / 1024).toFixed(1)}MB`;
  },
};
