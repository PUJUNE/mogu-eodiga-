// main.js — 게임 루프 + 상태 머신 + 입력 (각도 홀드 + 파워 홀드-릴리즈)
const M = window.MNG;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, up: false, down: false };
let jumpQueued = false;
let overCount = 10, overAcc = 0, chargeTick = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`STAGE ${no} — ${st.stage.from} 출발! 목표 ${st.stage.to}`, 2.2);
  M.audio.resume(); M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'jump': M.audio.jump(); break;
      case 'flag': M.audio.flag(); break;
      case 'fish': M.audio.fish(); M.ui.toast('🐟 +300!', 0.9); break;
      case 'crash': M.audio.crash(); M.ui.toast('꽈당!!', 1.0); break;
      case 'clear':
        M.audio.clear(e.stars);
        M.save.record(st.no, e.stars);
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st); } }, 1200);
        break;
      case 'over':
        M.audio.over();
        setTimeout(() => {
          if (mode === 'play') {
            mode = 'over'; overCount = 10; overAcc = 0;
            M.ui.setCountdown(10);
            M.ui.show('over-screen');
          }
        }, 1000);
        break;
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') held.left = true;
  if (k === 'ArrowRight') held.right = true;
  if (k === 'ArrowUp') held.up = true;
  if (k === 'ArrowDown') held.down = true;
  if (k === ' ' && !e.repeat && mode === 'play') jumpQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startStage(M.save.data.best);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no);
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no);
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.no < 12) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
  } else if (mode === 'over') {
    if (k === 'Enter') startStage(st.no);
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') held.left = false;
  if (e.key === 'ArrowRight') held.right = false;
  if (e.key === 'ArrowUp') held.up = false;
  if (e.key === 'ArrowDown') held.down = false;
});

$('btn-continue').onclick = () => startStage(M.save.data.best);
$('btn-new').onclick = () => startStage(1);
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogufortress/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => startStage(st.no + 1);
$('btn-retry').onclick = () => startStage(st.no);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '◀▶ 조향 · ▲▼ 속도 · 🐧 점프! 깃발 모으며 기지까지!';
  const bindHold = (id, on, off) => {
    const el = document.getElementById(id);
    const setOn = (e) => { e.preventDefault(); M.audio.resume(); on(); el.classList.add('pressed'); };
    const setOff = () => { if (off) off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointercancel', setOff);
    el.addEventListener('pointerleave', setOff);
  };
  bindHold('vbtn-left', () => { held.left = true; }, () => { held.left = false; });
  bindHold('vbtn-right', () => { held.right = true; }, () => { held.right = false; });
  bindHold('vbtn-up', () => { held.up = true; }, () => { held.up = false; });
  bindHold('vbtn-down', () => { held.down = true; }, () => { held.down = false; });
  bindHold('vbtn-fire', () => { if (mode === 'play') jumpQueued = true; });
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  $('over-screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#btn-over-title')) return;
    M.audio.resume();
    if (mode === 'over') startStage(st.no);
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  dist: st ? +st.dist.toFixed(1) : 0, spd: st ? +st.spd.toFixed(1) : 0,
  x: st ? +st.x.toFixed(1) : 0, jump: st ? +st.jumpT.toFixed(2) : 0,
  time: st ? +st.time.toFixed(1) : 0, flags: st ? st.flags : 0,
  crashes: st ? st.crashes : 0, score: st ? st.score : 0, stars: st ? st.stars : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) vpad.classList.toggle('on', mode === 'play');

  if (mode === 'play' && st) {
    handleEvents(M.Logic.step(st, dt, { left: held.left, right: held.right, up: held.up, down: held.down, jump: jumpQueued }));
    jumpQueued = false;
    if (st.time < 10 && st.phase === 'run') {
      chargeTick += dt;
      if (chargeTick > 1.0) { chargeTick = 0; M.audio.tick(); }
    }
  } else {
    jumpQueued = false;
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
