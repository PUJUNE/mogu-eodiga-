// ui.js — 기록 저장 · 코스 고르기 · 주행 HUD · 결과 화면
const M = window.MSL;
const $ = (id) => document.getElementById(id);

// ── 기록: { diff, best: { [난이도]: { c1: {stars, score, time}, ..., endless: {dist, score} } } } ──
const SAVE = 'moguslope-save-v1';
const S = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(SAVE)) || null; } catch (e) { this.data = null; }
    if (!this.data || !this.data.best) this.data = { diff: 'normal', best: {} };
    return this.data;
  },
  save() { try { localStorage.setItem(SAVE, JSON.stringify(this.data)); } catch (e) { /* 저장 안 돼도 게임은 돈다 */ } },
  rec(diff, id) { return (this.data.best[diff] || {})[id] || null; },
  starsAny(id) { return Math.max(0, ...M.DIFF_ORDER.map((d) => (this.rec(d, id) || {}).stars || 0)); },
  unlocked(i) { return i === 0 || this.starsAny(M.COURSES[i - 1].id) > 0; },
  // 기록 갱신 — 새 기록이면 true
  submit(run) {
    const b = this.data.best[run.diff] = this.data.best[run.diff] || {};
    const score = M.Run.score(run);
    let isNew = false;
    if (run.endless) {
      const old = b.endless || { dist: 0, score: 0 };
      if (run.s > old.dist) { b.endless = { dist: Math.floor(run.s), score: Math.max(score, old.score) }; isNew = true; }
      else if (score > old.score) { old.score = score; isNew = true; }
    } else {
      const id = M.COURSES[run.course].id, old = b[id] || { stars: 0, score: 0, time: 0 }, stars = M.Run.stars(run);
      const fin = run.s >= run.L;
      const nw = { stars: Math.max(old.stars, stars), score: Math.max(old.score, score), time: fin && (!old.time || run.finishT < old.time) ? +run.finishT.toFixed(2) : old.time };
      isNew = score > old.score || stars > old.stars || nw.time !== old.time;
      b[id] = nw;
    }
    this.save();
    return isNew;
  },
};
M.save = S;

const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const starStr = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;

const U = {
  sel: 0,          // 고른 코스 (숫자 또는 'endless')
  msgTimer: null,

  courseList(diff) {
    const el = $('courses');
    let h = '';
    M.COURSES.forEach((C, i) => {
      const r = S.rec(diff, C.id), lock = !S.unlocked(i);
      h += `<button class="course${lock ? ' lock' : ''}${U.sel === i ? ' sel' : ''}" data-c="${i}"><span class="no">${i + 1}</span>
        <div class="ic">${lock ? '🔒' : C.icon}</div><div class="nm">${C.name}</div>
        <div class="st">${r ? starStr(r.stars) : lock ? '' : '<i>★★★</i>'}</div><div class="ds">${lock ? '앞 코스를 완주하면 열려요' : C.desc}</div></button>`;
    });
    const e = S.rec(diff, 'endless');
    h += `<button class="course endless${U.sel === 'endless' ? ' sel' : ''}" data-c="endless"><span class="no">6</span><div class="ic">♾️</div><div class="nm">끝없는 슬로프</div>
      <div class="st" style="color:#2a2f45">${e ? '최고 ' + e.dist + 'm' : ''}</div><div class="ds">네 구역이 돌고 돌며 점점 빨라져요</div></button>`;
    el.innerHTML = h;
  },

  hud(run) {
    $('hearts').textContent = '❤'.repeat(Math.max(0, run.hearts)) + '♡'.repeat(Math.max(0, run.maxHearts - run.hearts));
    $('fish').textContent = run.fish;
    $('score').textContent = M.Run.score(run) + '점';
    const z = M.ZONES[run.track.frame(run.s).zone];
    $('zone-name').textContent = `${z.icon} ${z.name}`;
    if (run.endless) {
      $('dist').textContent = `${Math.floor(run.s)} m`;
      $('pbar-i').style.width = ((run.s % (M.ENDLESS_ZONE * 4)) / (M.ENDLESS_ZONE * 4) * 100) + '%';
    } else {
      const p = M.Run.progress(run);
      $('dist').textContent = `${Math.floor(run.s)} / ${run.L} m`;
      $('pbar-i').style.width = (p * 100) + '%';
      $('pbar-mogu').style.left = (p * 100) + '%';
    }
    const sp = $('speed');
    sp.textContent = `${Math.round(run.v * 3.6)} km/h` + (run.boostT > 0 ? ' 🔥' : '');
    sp.classList.toggle('boost', run.boostT > 0);
  },
  hudStart(run) {
    $('hud').classList.remove('hidden');
    const bar = $('pbar');
    bar.querySelectorAll('b').forEach((b) => b.remove());
    if (!run.endless) {
      // 구역이 바뀌는 자리에 아이콘, 끝에 결승 깃발
      for (const z of run.zones) if (z.s0 > 0 && z.s0 < run.L) { const b = document.createElement('b'); b.textContent = M.ZONES[z.zone].icon; b.style.left = (z.s0 / run.L * 100) + '%'; bar.appendChild(b); }
      const fin = document.createElement('b'); fin.textContent = '🏁'; fin.style.left = '100%'; bar.appendChild(fin);
      const mg = document.createElement('b'); mg.id = 'pbar-mogu'; mg.textContent = '🐱'; mg.style.zIndex = 2; bar.appendChild(mg);
    }
    this.hud(run);
  },

  msg(html, cls = '', ms = 900) {
    const el = $('msg'); el.className = cls; el.innerHTML = html; el.style.opacity = 1;
    clearTimeout(this.msgTimer); this.msgTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  },
  bump(id) { const el = $(id); el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 120); },

  result(run, isNew) {
    const fin = !run.endless && run.s >= run.L;
    const st = M.Run.stars(run);
    $('res-title').textContent = run.endless ? `${Math.floor(run.s)} m 활강!` : fin ? (st === 3 ? '완벽한 완주!' : '완주!') : '넘어졌다…';
    $('res-stars').innerHTML = run.endless ? '' : starStr(st);
    const L = [];
    if (!run.endless) L.push(fin ? `시간 <b>${fmtT(run.finishT)}</b>` : `간 거리 <b>${Math.floor(run.s)} / ${run.L} m</b>`);
    L.push(`생선 <b>${run.fish}</b>${run.endless ? '' : ' / ' + run.fishTotal} 🐟`);
    L.push(`공중 회전 <b>${run.tricks}</b>번` + (run.bestTrick ? ` (최고 ${run.bestTrick * 360}°)` : ''));
    L.push(`부딪힘 <b>${run.crashes}</b>번`);
    L.push(`점수 <b>${M.Run.score(run)}</b>` + (isNew ? ' 🎉 새 기록!' : ''));
    $('res-lines').innerHTML = L.join('<br>');
    const id = run.endless ? 'endless' : M.COURSES[run.course].id, r = S.rec(run.diff, id);
    $('res-best').textContent = r ? (run.endless ? `${M.DIFFS[run.diff].name} 최고: ${r.dist} m · ${r.score}점` : `${M.DIFFS[run.diff].name} 최고: ${r.score}점` + (r.time ? ` · ${fmtT(r.time)}` : '')) : '';
    const hasNext = !run.endless && run.course < M.COURSES.length - 1 && S.unlocked(run.course + 1);
    $('btn-next').classList.toggle('hidden', !hasNext);
    $('result-screen').classList.remove('hidden');
  },
};

M.ui = U;
M.fmtT = fmtT;
