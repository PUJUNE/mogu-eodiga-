// main.js — 게임 루프 + 상태 머신 + 입력 (키보드 조준 / 포인터 조준·탭 발사)
const M = window.MGB;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | over | ending
let st = null;
let aim = 0, shootQueued = false;
const keys = { left: false, right: false };
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startRound(no, carry) {
  st = M.Logic.create(no, carry);
  aim = 0; shootQueued = false;
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.hud(st);
  M.ui.toast(`ROUND ${no} · ${st.stage.theme.name}`, 1.8);
  M.audio.resume(); M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function roundCleared() {
  M.save.score(st.score);
  if (st.no >= 30) {
    M.save.reach(30);
    mode = 'ending';
    $('ending-score').textContent = `SCORE ${st.score}`;
    M.ui.show('ending-screen');
  } else {
    M.save.reach(st.no + 1);
    startRound(st.no + 1, { score: st.score });
  }
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'shoot': M.audio.shoot(); break;
      case 'bounce': M.audio.bounce(); break;
      case 'snap': M.audio.snap(); break;
      case 'popfx': M.Render.addPop(e.x, e.y, e.col); break;
      case 'fallfx': M.Render.addFall(e.x, e.y, e.col); break;
      case 'pop': M.audio.pop(e.n); if (e.n >= 5) M.ui.toast(`${e.n}연쇄 팝!!`, 1.2); break;
      case 'fall': M.audio.fall(e.n); M.ui.toast(`+${e.n} 낙하 보너스!`, 1.2); break;
      case 'descend': M.audio.descend(); M.ui.toast('천장이 내려온다…!', 1.4); break;
      case 'clear': M.audio.clear(); M.ui.toast('ROUND CLEAR!', 1.8); break;
      case 'over':
        M.audio.over();
        mode = 'over'; overCount = 10; overAcc = 0;
        M.ui.setCountdown(10);
        M.ui.show('over-screen');
        break;
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') keys.left = true;
  if (k === 'ArrowRight') keys.right = true;
  if ((k === ' ' || k === 'ArrowUp' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') shootQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startRound(M.save.data.best, { score: 0 });
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startRound(st.no, { score: st.score });
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startRound(st.no, { score: st.score });
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') startRound(st.no, { score: Math.floor(st.score * 0.9) });
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
});

$('btn-continue').onclick = () => startRound(M.save.data.best, { score: 0 });
$('btn-new').onclick = () => startRound(1, { score: 0 });
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogubble/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startRound(st.no, { score: st.score });
$('btn-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 포인터: 이동 = 조준, 탭/클릭 = 발사 ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '터치로 조준하고 손을 떼면 발사!';
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
const cvEl = document.getElementById('game');
function aimFromPointer(e) {
  const r = cvEl.getBoundingClientRect();
  const x = (e.clientX - r.left) * (M.W / r.width);
  const y = (e.clientY - r.top) * (M.H / r.height);
  const dx = x - M.LAUNCH_X, dy = M.LAUNCH_Y - y;
  if (dy > 8) aim = Math.atan2(dx, dy);
}
cvEl.addEventListener('pointermove', (e) => { if (mode === 'play') aimFromPointer(e); });
cvEl.addEventListener('pointerdown', (e) => {
  M.audio.resume();
  if (mode === 'play') { e.preventDefault(); aimFromPointer(e); }
});
cvEl.addEventListener('pointerup', (e) => {
  if (mode === 'play') { aimFromPointer(e); shootQueued = true; }
});
// 게임 오버: 화면 탭 = 이어서 (버튼 제외)
$('over-screen').addEventListener('pointerdown', (e) => {
  if (e.target.closest('#btn-over-title')) return;
  M.audio.resume();
  if (mode === 'over') startRound(st.no, { score: Math.floor(st.score * 0.9) });
});
$('vbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
});

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  bubbles: st ? st.grid.size : 0, score: st ? st.score : 0,
  cur: st ? st.cur : -1, drop: st ? st.drop : 0, shots: st ? st.shots : 0,
  aim: +aim.toFixed(3), flying: st ? !!st.flying : false,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  $('vbtn-pause').style.display = isTouch && mode === 'play' ? 'flex' : 'none';

  if (mode === 'play' && st) {
    if (keys.left) aim -= 1.7 * dt;
    if (keys.right) aim += 1.7 * dt;
    handleEvents(M.Logic.step(st, dt, { aim, shoot: shootQueued }));
    shootQueued = false;
    aim = st.aim;                                    // 로직 클램프 반영
    M.ui.hud(st);
    if (st.phase === 'clear' && st.clearT > 2.0) roundCleared();
  } else {
    shootQueued = false;
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
