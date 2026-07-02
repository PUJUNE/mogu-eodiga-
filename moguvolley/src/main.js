// main.js — 게임 루프 + 상태 머신 + 입력
const M = window.MGV;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, jump: false, up: false };
let hitQueued = false, jumpQueued = false;
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`STAGE ${no} — ${st.stage.rival.name} 등장!`, 2.0);
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
      case 'serve': M.audio.serve(); break;
      case 'bump': M.audio.bump(); M.Render.addHit(st.ball.x, st.ball.y); break;
      case 'smash': M.audio.smash(); M.Render.addHit(st.ball.x, st.ball.y); break;
      case 'lob': M.audio.lob(); M.Render.addHit(st.ball.x, st.ball.y); break;
      case 'wall': case 'net': M.audio.wall(); break;
      case 'score':
        if (e.scorer === 0) M.audio.scoreMe(); else M.audio.scoreAi();
        M.Render.addScore(e.scorer === 0 ? 360 : 120, e.scorer);
        break;
      case 'win':
        M.audio.win(e.stars);
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
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') held.left = true;
  if (k === 'ArrowRight') held.right = true;
  if (k === 'ArrowUp' || k === 'z' || k === 'Z') { held.jump = true; held.up = true; if (!e.repeat) jumpQueued = true; }
  if ((k === ' ' || k === 'x' || k === 'X') && !e.repeat && mode === 'play') hitQueued = true;

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
    if (k === 'Enter') { if (st.no < 30) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') startStage(st.no);
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') held.left = false;
  if (e.key === 'ArrowRight') held.right = false;
  if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') { held.jump = false; held.up = false; }
});

$('btn-continue').onclick = () => startStage(M.save.data.best);
$('btn-new').onclick = () => startStage(1);
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/moguvolley/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => startStage(st.no + 1);
$('btn-retry').onclick = () => startStage(st.no);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '◀▶ 이동 · ⬆ 점프 · 🏐 히트 (점프 중 히트 = 스매시!)';
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
  bindHold('vbtn-jump', () => { held.jump = true; held.up = true; }, () => { held.jump = false; held.up = false; });
  bindHold('vbtn-hit', () => { if (mode === 'play') hitQueued = true; });
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
  score: st ? [...st.score] : [0, 0], stars: st ? st.stars : 0,
  p: st ? { x: +st.p.x.toFixed(1), y: +st.p.y.toFixed(1), onGround: st.p.onGround } : null,
  ball: st ? { x: +st.ball.x.toFixed(1), y: +st.ball.y.toFixed(1) } : null,
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
    handleEvents(M.Logic.step(st, dt, {
      left: held.left, right: held.right, jump: held.jump || jumpQueued, up: held.up, hit: hitQueued,
    }));
    hitQueued = false; jumpQueued = false;
  } else {
    hitQueued = false; jumpQueued = false;
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
