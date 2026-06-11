// ui.js — HUD / 타이틀 / 월드 맵 / 컨티뉴 / 결과 / 저장
const G = window.MOGU;

const $ = (id) => document.getElementById(id);

// ── 저장 ──
G.save = {
  KEY: 'mogu-eodiga-save-v1',
  data: { stars: {}, bestTime: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = JSON.parse(raw); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  unlocked() {
    let max = 1;
    for (let s = 1; s <= 50; s++) if (this.data.stars[s] > 0) max = Math.max(max, Math.min(50, s + 1));
    return max;
  },
  record(stage, stars, time) {
    this.data.stars[stage] = Math.max(this.data.stars[stage] || 0, stars);
    const bt = this.data.bestTime[stage];
    if (!bt || time < bt) this.data.bestTime[stage] = time;
    this.store();
  },
  // 외부 세이브와 병합: 스테이지별 높은 별점·빠른 기록 유지
  merge(ext) {
    let gained = 0;
    for (let s = 1; s <= 50; s++) {
      const a = this.data.stars[s] || 0, b = (ext.stars && ext.stars[s]) || 0;
      if (b > a) { this.data.stars[s] = b; gained++; }
      const bt = (ext.bestTime && ext.bestTime[s]) || null;
      if (bt && (!this.data.bestTime[s] || bt < this.data.bestTime[s])) this.data.bestTime[s] = bt;
    }
    this.store();
    return gained;
  },
};

// ── UI ──
G.ui = {
  screens: ['title-screen', 'map-screen', 'continue-screen', 'result-screen', 'pause-screen'],
  onStageClick: null,
  toastTimer: null,

  init() {
    $('title-icon').src = G.ASSETS.icon;

    // ── 세이브 내보내기 / 불러오기 ──
    const msg = (t) => {
      $('save-msg').textContent = t;
      clearTimeout(this._saveMsgTimer);
      this._saveMsgTimer = setTimeout(() => { $('save-msg').textContent = ''; }, 4000);
    };
    $('btn-save-export').addEventListener('click', () => {
      const cleared = Object.values(G.save.data.stars).filter((v) => v > 0).length;
      const blob = new Blob([JSON.stringify(G.save.data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      a.download = `모구어디가_세이브_${ymd}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      msg(`내보냄 (클리어 ${cleared}개) — 받은 파일을 드라이브 폴더에 두세요`);
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
          const gained = G.save.merge(ext);
          this.buildMap(G.save.unlocked());
          this.selectMapNode(G.save.unlocked());
          msg(gained > 0 ? `불러옴 — 스테이지 ${gained}개 진행이 갱신됨` : '불러옴 — 이미 최신 진행입니다');
        } catch (err) {
          msg('세이브 파일이 아닙니다');
        }
      };
      rd.readAsText(f);
    });
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id !== null && id !== 'continue-screen' && id !== 'pause-screen');
  },
  hideAll() {
    for (const s of this.screens) $(s).classList.add('hidden');
    $('hud').classList.remove('hidden');
  },
  fade(on) { $('fade').style.opacity = on ? 1 : 0; },

  // ── HUD ──
  hud(hearts, stageNo, progress, churGot, churTotal, fish, speedLabel) {
    $('hud-hearts').textContent = '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 3 - hearts));
    $('hud-stage').textContent = `STAGE ${stageNo}`;
    const pct = Math.min(100, Math.max(0, progress * 100));
    $('hud-progress-fill').style.width = pct + '%';
    $('hud-progress-icon').style.left = pct + '%';
    $('hud-items').innerHTML = `🐟 ${fish}&nbsp;&nbsp;🍡 ${churGot}/${churTotal}`;
    $('hud-speed').textContent = speedLabel;
  },

  toast(text, dur = 1.8) {
    const el = $('hud-toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  // ── 월드 맵 ──
  buildMap(selected) {
    const track = $('map-track');
    track.innerHTML = '';
    const GAP = 92, PAD = 60;
    track.style.height = PAD * 2 + GAP * 50 + 'px';
    const unlocked = G.save.unlocked();

    // 월드 배경 밴드
    for (let w = 1; w <= 5; w++) {
      const band = document.createElement('div');
      band.className = 'world-band';
      const T = G.THEMES[w];
      const c = '#' + T.sky.toString(16).padStart(6, '0');
      band.style.top = PAD + (w - 1) * 10 * GAP - GAP / 2 + 'px';
      band.style.height = 10 * GAP + 'px';
      band.style.background = `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.3)), ${c}`;
      const lab = document.createElement('div');
      lab.className = 'world-label';
      lab.textContent = `WORLD ${w} · ${T.name}`;
      band.appendChild(lab);
      track.appendChild(band);
    }

    this.nodeEls = [];
    for (let s = 1; s <= 50; s++) {
      const node = document.createElement('div');
      node.className = 'stage-node';
      const stars = G.save.data.stars[s] || 0;
      if (stars > 0) node.classList.add('cleared');
      if (s > unlocked) node.classList.add('locked');
      if (s === selected) node.classList.add('selected');
      node.style.top = PAD + (s - 1) * GAP + 'px';
      node.style.left = `calc(50% + ${Math.sin(s * 0.55) * 26}%)`;
      node.innerHTML = s > unlocked
        ? '🔒'
        : `<div>${s}</div>` + (stars > 0 ? `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>` : '');
      if (s <= unlocked) node.addEventListener('click', () => this.onStageClick && this.onStageClick(s));
      track.appendChild(node);
      this.nodeEls.push(node);
    }
  },

  selectMapNode(s) {
    if (!this.nodeEls) return;
    this.nodeEls.forEach((n, i) => n.classList.toggle('selected', i === s - 1));
    const el = this.nodeEls[s - 1];
    if (el) {
      const sc = $('map-scroll');
      sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 2, behavior: 'smooth' });
    }
  },

  // ── 컨티뉴 ──
  setCountdown(n) { $('continue-count').textContent = n; },
  coinDrop() {
    const c = $('coin');
    c.classList.remove('drop');
    void c.offsetWidth;        // 애니메이션 재시작
    c.classList.add('drop');
  },

  // ── 결과 ──
  showResult(o) {
    $('result-title').textContent = o.cleared ? (o.stage === 50 ? '🏠 집 도착!!' : 'CLEAR!') : 'GAME OVER';
    $('result-title').style.color = o.cleared ? '#ffd83d' : '#ff6b6b';
    $('result-stars').textContent = o.cleared ? '★'.repeat(o.stars) + '☆'.repeat(3 - o.stars) : '';
    $('result-stars').style.color = '#ffd83d';
    let html = '';
    if (o.cleared) {
      html += `소요 시간 <b>${o.time.toFixed(1)}초</b><br>`;
      html += `수집 🍡 <b>${o.churGot}/${o.churTotal}</b> (${Math.round(o.itemPct * 100)}%) · 🐟 <b>${o.fish}</b><br>`;
      html += o.continues > 0 ? `컨티뉴 <b>${o.continues}회</b> 사용 (별점 ★1 제한)` : '노컨티뉴 클리어!';
      if (o.stage === 50) html += '<br><br>모구가 무사히 집에 도착했습니다 🎉';
    } else {
      html = '월드 맵으로 돌아갑니다';
    }
    $('result-stats').innerHTML = html;
    $('btn-next').style.display = o.cleared && o.stage < 50 ? '' : 'none';
    this.show('result-screen');
  },

  highlightButtons(ids, sel) {
    ids.forEach((id, i) => $(id).classList.toggle('selected', i === sel));
  },
};
