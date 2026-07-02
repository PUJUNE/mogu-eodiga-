// ui.js — 저장 + 힐 맵 + 화면 전환
const M = window.MSJ;
const $ = (id) => document.getElementById(id);

M.save = {
  KEY: 'moguski-save-v1',
  data: { stars: {}, best: {} },
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) this.data = Object.assign(this.data, JSON.parse(raw)); } catch (e) {}
    return this.data;
  },
  store() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  unlocked() {
    let max = 1;
    for (let s = 1; s <= 50; s++) if (this.data.stars[s] > 0) max = Math.max(max, Math.min(50, s + 1));
    return max;
  },
  record(no, stars, dist) {
    this.data.stars[no] = Math.max(this.data.stars[no] || 0, stars);
    if (dist > (this.data.best[no] || 0)) { this.data.best[no] = dist; this.store(); return true; }
    this.store();
    return false;
  },
};

M.ui = {
  screens: ['title-screen', 'map-screen', 'result-screen', 'pause-screen'],
  onStageClick: null,
  toastTimer: null,

  init() {
    $('title-icon').src = M.ASSETS.mogu;
  },

  show(id) {
    for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
  },
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
          cell.innerHTML = `<b>${no}</b>` +
            (no % 10 === 0 ? '<span class="crown">👑</span>' : '') +
            (stars > 0 ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
                       : `<span class="stars dim">${M.TARGETS[no - 1]}m</span>`);
          cell.addEventListener('click', () => this.onStageClick && this.onStageClick(no));
        }
        grid.appendChild(cell);
      }
      track.appendChild(grid);
    }
  },

  hudRun(st) {
    const stg = st.stage;
    $('hud-stage').textContent = `STAGE ${st.no} · ${stg.theme.name}${stg.rival ? ' · 👑 ' + stg.rival : ''}`;
    $('hud-target').textContent = `목표 ${stg.target}m · 최고 ${(M.save.data.best[st.no] || 0).toFixed(1)}m`;
  },

  toast(text, dur = 1.8) {
    const el = $('hud-toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
  },

  showResult(st, isBest) {
    const T = st.stage.target;
    $('result-dist').textContent = st.dist.toFixed(1) + ' m';
    $('result-stars').textContent = st.stars > 0 ? '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '';
    $('result-title').textContent = st.stars > 0 ? (st.stars === 3 ? '완벽한 비행!!' : 'CLEAR!') : '아쉽다...';
    $('result-title').style.color = st.stars > 0 ? '#ffd83d' : '#ff8a8a';
    const qLabel = st.jumpQ >= 0.9 ? '퍼펙트!' : st.jumpQ >= 0.6 ? '좋음' : st.jumpQ > 0 ? '아쉬움' : '미스';
    let html = `도약 타이밍 <b>${qLabel}</b> · 목표 ${T}m`;
    if (st.teleTapped && !st.crash) html += ` · 텔레마크 <b>+${((1.5 + st.stage.K * 0.02) * st.teleQ).toFixed(1)}m</b>`;
    if (st.crash) html += ' · <b style="color:#ff8a8a">데굴데굴 착지 🙀</b>';
    if (isBest) html += '<br><b style="color:#7de08a">신기록!</b>';
    $('result-stats').innerHTML = html;
    $('btn-next').style.display = st.stars > 0 && st.no < 50 ? '' : 'none';
    this.show('result-screen');
  },
};
