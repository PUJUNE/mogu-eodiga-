// main.js — 게임 루프 + 상태 머신 + 입력 (꾹 누르고 → 도약대 끝에서 떼기)
const M = window.MSJ;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | map | run | pause | result
let st = null;
const input = { btn: false };

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('app'));
M.ui.show('title-screen');

function goMap() {
  mode = 'map';
  M.ui.buildMap();
  M.ui.show('map-screen');
  $('hud').classList.add('hidden');
  $('ready-overlay').classList.add('hidden');
}

function startStage(no) {
  st = M.Logic.create(no);
  mode = 'run';
  M.ui.hideAll();
  $('hud').classList.remove('hidden');
  $('hud-dist').classList.add('hidden');
  $('ready-overlay').classList.remove('hidden');
  M.ui.hudRun(st);
  M.Render.setStage(st.stage, M.save.data.best[no] || 0);
  const stg = st.stage;
  $('hud-wind').textContent = stg.wind === 0 ? '' :
    `${stg.wind > 0 ? '◀ 맞바람' : '▶ 뒷바람'} ${Math.abs(stg.wind).toFixed(1)}m/s ${stg.wind > 0 ? '(유리)' : '(불리)'}`;
  $('hud-wind').style.color = stg.wind > 0 ? '#7de08a' : '#ff8a8a';
  M.audio.resume(); M.audio.meow();
}

M.ui.onStageClick = (no) => startStage(no);

function finishRun() {
  const isBest = M.save.record(st.no, st.stars, st.dist);
  mode = 'result';
  M.ui.showResult(st, isBest);
  if (st.stars > 0) M.audio.clear(st.stars); else M.audio.fail();
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'start': M.audio.start(); $('ready-overlay').classList.add('hidden'); break;
      case 'release': M.audio.tapNoise(); break;
      case 'takeoff':
        if (e.pending) break;                       // 아직 홀드 중 (늦은 릴리즈 대기)
        M.audio.takeoff(e.q);
        if (e.q >= 0.9) { M.audio.perfect(); M.ui.toast('퍼펙트 릴리즈!!', 1.4); }
        else if (e.q >= 0.6) M.ui.toast('좋은 도약!', 1.2);
        else if (e.q > 0.15) M.ui.toast('조금 어긋났다…', 1.2);
        else M.ui.toast('타이밍 미스…', 1.2);
        break;
      case 'land': if (e.crash) M.audio.crash(); else M.audio.land(); break;
    }
  }
}

// ── 키보드 (Space/Z/↑ = 버튼 홀드) ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp'].includes(k)) e.preventDefault();
  if (k === ' ' || k === 'z' || k === 'Z' || k === 'ArrowUp') input.btn = true;

  if (mode === 'title') {
    if (k === 'Enter') goMap();
  } else if (mode === 'map') {
    if (k === 'Enter') startStage(Math.min(M.save.unlocked(), 50));
    if (k === 'Escape') { mode = 'title'; M.ui.show('title-screen'); }
  } else if (mode === 'run') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no);
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'run'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no);
    if (k === 'm' || k === 'M') goMap();
  } else if (mode === 'result') {
    if (k === 'Enter') { if (st.stars > 0 && st.no < 50) startStage(st.no + 1); else startStage(st.no); }
    if (k === 'm' || k === 'M') goMap();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'z' || e.key === 'Z' || e.key === 'ArrowUp') input.btn = false;
});

$('btn-start').onclick = () => goMap();
$('btn-series').onclick = () => {
  // 개발 페이지(/moguski/)와 빌드본(루트) 양쪽에서 런처로 이동
  location.href = location.pathname.includes('/moguski/') ? '../index.html' : 'index.html';
};
$('btn-retry').onclick = () => startStage(st.no);
$('btn-map').onclick = () => goMap();
$('btn-next').onclick = () => startStage(st.no + 1);
$('btn-resume').onclick = () => { mode = 'run'; M.ui.hideAll(); };
$('btn-prestart').onclick = () => startStage(st.no);
$('btn-pmap').onclick = () => goMap();

// ── 터치: 화면 전체가 버튼 (누르고 있기 → 떼기) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  $('ready-hint').innerHTML = '화면을 꾹 누르면 모구가 웅크려요<br>도약대 끝에서 손을 떼면 점프!';
  $('title-hint').textContent = '화면을 꾹 눌러 활강 — 도약대 끝에서 떼면 점프!';
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
const app = document.getElementById('app');
app.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn, .vbtn, .stage-cell')) return;
  M.audio.resume();
  if (mode === 'run') { e.preventDefault(); input.btn = true; }
});
app.addEventListener('pointerup', () => { input.btn = false; });
app.addEventListener('pointercancel', () => { input.btn = false; });
$('vbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'run') { mode = 'pause'; M.ui.show('pause-screen'); }
});

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  dist: st ? st.dist : 0, stars: st ? st.stars : 0,
  untilLip: st ? +st.untilLip.toFixed(3) : 99,
  charge: st ? +st.charge.toFixed(2) : 0, q: st ? +st.q.toFixed(2) : 0,
  holding: st ? st.holding : false,
  x: st ? +st.x.toFixed(1) : 0, y: st ? +st.y.toFixed(1) : 0, v: st ? +st.v.toFixed(1) : 0,
});
M._st = () => st;

// ── HUD 갱신 ──
function updateHud() {
  const slide = st.phase === 'slide';
  // 타이밍 바·차지 게이지를 모구 머리 위에 앵커
  const hp = M.Render.headScreen;
  if (hp) {
    $('meter-wrap').style.left = hp.x + 'px';
    $('meter-wrap').style.top = hp.y + 'px';
    $('charge-wrap').style.left = hp.x + 'px';
    $('charge-wrap').style.top = hp.y + 'px';
  }
  $('meter-wrap').classList.toggle('hidden', !(slide && st.untilLip < 1.15 && st.holding));
  if (slide && st.untilLip < 1.15) {
    $('meter-needle').style.left = `calc(${((1 - Math.min(1, st.untilLip / 1.15)) * 100).toFixed(1)}% - 2px)`;
  }
  $('charge-wrap').classList.toggle('hidden', !(slide && st.holding && st.untilLip >= 1.15));
  if (slide) $('charge-fill').style.width = (st.charge * 100).toFixed(0) + '%';
  $('hud-speed').textContent = slide ? `${(st.v * 3.6).toFixed(0)} km/h` : '';
  const flying = st.phase === 'flight' || st.phase === 'landed';
  $('hud-dist').classList.toggle('hidden', !flying);
  if (flying) {
    const d = st.phase === 'landed' ? st.dist : Math.round(Math.hypot(st.x, st.y) * 2) / 2;
    $('hud-dist').textContent = d.toFixed(1) + ' m';
  }
}

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  $('vbtn-pause').style.display = isTouch && mode === 'run' ? 'flex' : 'none';

  if (mode === 'run' && st) {
    handleEvents(M.Logic.step(st, dt, input));
    updateHud();
    if (st.phase === 'landed' && st.landT > 1.6) finishRun();
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
