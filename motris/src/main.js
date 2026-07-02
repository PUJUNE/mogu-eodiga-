// main.js — 게임 루프 + 상태 머신 + 입력 (키보드 DAS + 터치 패드)
const M = window.MTR;
const $ = (id) => document.getElementById(id);

const STAGE_NAMES = { 1: '모구네 거실', 2: '앞마당', 3: '꿈속 밤하늘' };
const DAS = 0.17, ARR = 0.05;

let mode = 'title';            // title | play | pause | over | ending
let st = null;
const held = { left: false, right: false, down: false };
let dasT = 0, dasDir = 0;
const edge = { moveX: 0, rotCW: false, rotCCW: false, hard: false };
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no, carry) {
  st = M.Logic.create(no, carry);
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.hud(st);
  M.ui.toast(`STAGE ${no} · ${st.stage.theme.name}` + (st.stage.moguTrapped > 0 ? ` · 갇힌 모구 ${st.stage.moguTrapped}` : ''), 2.0);
  M.audio.resume(); M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function stageCleared() {
  M.save.record(st.no, st.stars);
  M.save.score(st.score);
  if (st.no >= 30) {
    mode = 'ending';
    $('ending-score').textContent = `SCORE ${st.score}`;
    M.ui.show('ending-screen');
  } else {
    startStage(st.no + 1, { score: st.score });
  }
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'rotate': M.audio.rotate(); break;
      case 'lock': M.audio.lockp(); break;
      case 'clearline': M.audio.clearline(e.n); M.Render.addClearFx(e.rows); break;
      case 'tetris': M.audio.tetris(); M.ui.toast('테트리스!!', 1.4); break;
      case 'rescuefx': M.Render.addRescueFx(e.c, e.r); break;
      case 'rescue': M.audio.rescue(); M.ui.toast(`🐱 모구 ${e.n}마리 구조! 낙하 느려짐`, 1.8); break;
      case 'stageclear': M.audio.stageclear(); M.ui.toast('STAGE CLEAR! ' + '★'.repeat(e.stars), 2.0); break;
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
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (mode === 'play' && !e.repeat) {
    if (k === 'ArrowLeft') { held.left = true; dasDir = -1; dasT = 0; edge.moveX = -1; M.audio.move(); }
    if (k === 'ArrowRight') { held.right = true; dasDir = 1; dasT = 0; edge.moveX = 1; M.audio.move(); }
    if (k === 'ArrowDown') held.down = true;
    if (k === 'ArrowUp' || k === 'x' || k === 'X') edge.rotCW = true;
    if (k === 'z' || k === 'Z') edge.rotCCW = true;
    if (k === ' ') { edge.hard = true; M.audio.hard(); }
  }
  if (mode === 'title') {
    if (k === 'Enter') startStage(M.save.data.best, { score: 0 });
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no, { score: st.score });
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no, { score: st.score });
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') startStage(st.no, { score: Math.floor(st.score * 0.9) });
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') { held.left = false; if (dasDir === -1) dasDir = held.right ? 1 : 0; }
  if (e.key === 'ArrowRight') { held.right = false; if (dasDir === 1) dasDir = held.left ? -1 : 0; }
  if (e.key === 'ArrowDown') held.down = false;
});

$('btn-continue').onclick = () => startStage(M.save.data.best, { score: 0 });
$('btn-new').onclick = () => startStage(1, { score: 0 });
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/motris/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no, { score: st.score });
$('btn-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '◀▶ 이동 · 🔄 회전 · ▼ 소프트드롭 · ⤓ 하드드롭';
  const bindHold = (id, fn, up) => {
    const el = document.getElementById(id);
    const setOn = (e) => { e.preventDefault(); M.audio.resume(); fn(); el.classList.add('pressed'); };
    const setOff = () => { if (up) up(); el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointercancel', setOff);
    el.addEventListener('pointerleave', setOff);
  };
  bindHold('vbtn-left', () => { held.left = true; dasDir = -1; dasT = 0; edge.moveX = -1; }, () => { held.left = false; if (dasDir === -1) dasDir = 0; });
  bindHold('vbtn-right', () => { held.right = true; dasDir = 1; dasT = 0; edge.moveX = 1; }, () => { held.right = false; if (dasDir === 1) dasDir = 0; });
  bindHold('vbtn-down', () => { held.down = true; }, () => { held.down = false; });
  bindHold('vbtn-rot', () => { if (mode === 'play') edge.rotCW = true; });
  bindHold('vbtn-hard', () => { if (mode === 'play') { edge.hard = true; M.audio.hard(); } });
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  $('over-screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#btn-over-title')) return;
    M.audio.resume();
    if (mode === 'over') startStage(st.no, { score: Math.floor(st.score * 0.9) });
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  lines: st ? st.lines : 0, score: st ? st.score : 0,
  rescued: st ? st.rescued : 0, rescueT: st ? +st.rescueT.toFixed(1) : 0,
  cur: st && st.cur ? { key: st.cur.key, x: st.cur.x, y: st.cur.y, rot: st.cur.rot } : null,
  filled: st ? st.board.flat().filter(Boolean).length : 0,
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
    // DAS 반복
    if (dasDir !== 0 && (dasDir === -1 ? held.left : held.right)) {
      dasT += dt;
      if (dasT > DAS) { edge.moveX = dasDir; dasT -= ARR; }
    }
    handleEvents(M.Logic.step(st, dt, {
      moveX: edge.moveX, down: held.down,
      rotCW: edge.rotCW, rotCCW: edge.rotCCW, hard: edge.hard,
    }));
    edge.moveX = 0; edge.rotCW = false; edge.rotCCW = false; edge.hard = false;
    M.ui.hud(st);
    if (st.phase === 'clear' && st.clearT > 2.2) stageCleared();
  } else if (mode === 'over' && st) {
    overAcc += dt;
    if (overAcc >= 1) {
      overAcc -= 1; overCount--;
      if (overCount <= 0) toTitle();
      else M.ui.setCountdown(overCount);
    }
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
