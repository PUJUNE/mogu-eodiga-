// main.js — 게임 루프 + 상태 머신 + 입력 (키보드·터치 공용 원버튼)
const M = window.MSJ;

let mode = 'title';            // title | map | run | pause | result
let st = null;
const input = { btn: false, tap: false };

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function goMap() {
  mode = 'map';
  M.ui.buildMap();
  M.ui.show('map-screen');
}

function startStage(no) {
  st = M.Logic.create(no);
  mode = 'run';
  M.ui.hideAll();
  M.ui.hudRun(st);
  M.Render.setStage(st.stage, M.save.data.best[no] || 0);
  document.getElementById('ready-overlay').classList.remove('hidden');
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
      case 'start': M.audio.start(); document.getElementById('ready-overlay').classList.add('hidden'); break;
      case 'tap': M.audio.tapNoise(); break;
      case 'takeoff':
        M.audio.takeoff(e.q);
        if (e.q >= 0.9) { M.audio.perfect(); M.ui.toast('퍼펙트 도약!!', 1.4); }
        else if (e.q >= 0.6) M.ui.toast('좋은 도약!', 1.2);
        else if (e.q > 0) M.ui.toast('조금 빨랐다…', 1.2);
        else M.ui.toast('타이밍 미스…', 1.2);
        break;
      case 'telemark': M.audio.telemark(); M.ui.toast('텔레마크!', 1.2); break;
      case 'land': if (e.crash) M.audio.crash(); else M.audio.land(); break;
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp'].includes(k)) e.preventDefault();
  if ((k === ' ' || k === 'z' || k === 'Z' || k === 'ArrowUp') && !e.repeat) { input.btn = true; input.tap = true; }

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

document.getElementById('btn-start').onclick = () => goMap();
document.getElementById('btn-retry').onclick = () => startStage(st.no);
document.getElementById('btn-map').onclick = () => goMap();
document.getElementById('btn-next').onclick = () => startStage(st.no + 1);
document.getElementById('btn-resume').onclick = () => { mode = 'run'; M.ui.hideAll(); };
document.getElementById('btn-prestart').onclick = () => startStage(st.no);
document.getElementById('btn-pmap').onclick = () => goMap();

// ── 터치: 화면 전체가 버튼 (메뉴·버튼 요소 제외) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  document.getElementById('ready-hint').textContent = '화면을 탭해서 출발 — 도약대 끝에서 탭! · 공중에서 꾹 눌러 자세 유지';
  document.getElementById('title-hint').textContent = '화면 탭 = 점프 버튼 · 공중에서는 꾹 눌러 자세 유지';
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
const app = document.getElementById('app');
app.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn, .vbtn, .stage-cell')) return;   // 메뉴 요소는 버튼 입력에서 제외
  M.audio.resume();
  if (mode === 'run') { e.preventDefault(); input.btn = true; input.tap = true; }
});
app.addEventListener('pointerup', () => { input.btn = false; });
app.addEventListener('pointercancel', () => { input.btn = false; });
document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'run') { mode = 'pause'; M.ui.show('pause-screen'); }
});

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  dist: st ? st.dist : 0, stars: st ? st.stars : 0,
  untilLip: st ? +st.untilLip.toFixed(3) : 99,
  P: st ? +st.P.toFixed(2) : 0, x: st ? +st.x.toFixed(1) : 0, y: st ? +st.y.toFixed(1) : 0,
  v: st ? +st.v.toFixed(1) : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const pauseBtn = document.getElementById('vbtn-pause');
  pauseBtn.style.display = isTouch && mode === 'run' ? 'flex' : 'none';

  if (mode === 'run' && st) {
    handleEvents(M.Logic.step(st, dt, input));
    input.tap = false;
    if (st.phase === 'landed' && st.landT > 1.5) finishRun();
  } else {
    input.tap = false;
  }
  if (st) M.Render.draw(st, now / 1000);
}
requestAnimationFrame(frame);
