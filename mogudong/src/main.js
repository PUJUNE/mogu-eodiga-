// main.js — 게임 루프 + 상태 머신 + 입력 (키보드 ←→ / 터치 드래그·가상패드)
const M = window.MDD;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
let dragX = null;              // 터치 드래그 목표 x (논리 좌표)
const held = { left: false, right: false };

M.save.load();
M.ui.init();
M.Render.init($('game'));
M.ui.show('title-screen');

function startRun() {
  st = M.Logic.create((Date.now() & 0x7fffffff) || 1, M.diff);
  M.Render.reset();
  dragX = null;
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`${M.DIFFS[M.diff].name} — 5분을 버텨라!`, 1.8);
  M.audio.resume(); M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.updateDiffBtns();
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function finish() {                                     // 결과 반영 (1회만)
  if (st.recorded) return;
  st.recorded = true;
  const cleared = st.phase === 'clear';
  st.isBest = M.save.record(st.diff, cleared ? M.CLEAR_TIME : st.t, st.dodged, cleared);
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'land': M.audio.plop(e.r); M.Render.addSplat(e.x, e.r); break;
      case 'wave':
        M.audio.wave(e.no);
        if (e.wind) { M.audio.storm(); M.ui.toast('🌪 똥 폭풍!! 바람에 휩쓸린다', 2.0); }
        else M.ui.toast(`WAVE ${e.no} — 똥이 더 쏟아진다!`, 1.4);
        break;
      case 'theme': M.ui.toast(`☁ ${M.THEMES[e.idx].name}`, 1.2); break;
      case 'hit':
        M.audio.splat();
        M.Render.addBurst(e.x, e.y, e.r);
        break;
      case 'over': finish(); M.audio.over(); break;
      case 'clear':
        finish();
        M.audio.clear();
        setTimeout(() => {
          if (mode !== 'play') return;
          if (M.save.data.cleared.crazy && st.diff === 'crazy') { mode = 'ending'; M.ui.show('ending-screen'); }
          else { mode = 'win'; M.ui.showClear(st); }
        }, 1500);
        break;
    }
  }
}

// ── 키보드 (원작 조작: ←→ 이동, Space 시작·일시정지) ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { held.left = true; dragX = null; }
  if (k === 'ArrowRight' || k === 'd' || k === 'D') { held.right = true; dragX = null; }

  if (mode === 'title') {
    if (k === 'Enter' || k === ' ') startRun();
    if (k === '1') { M.save.setDiff('easy'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '2') { M.save.setDiff('normal'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '3') { M.save.setDiff('hard'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '4') { M.save.setDiff('crazy'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
  } else if (mode === 'play') {
    if (k === 'Escape' || k === ' ') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startRun();
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape' || k === ' ') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startRun();
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') startRun();
    if (k === 'Escape') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') {
      const nx = M.nextDiff(st.diff);
      if (nx) { M.save.setDiff(nx); M.ui.updateDiffBtns(); startRun(); } else toTitle();
    }
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') held.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') held.right = false;
});

$('btn-start').onclick = () => startRun();
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogudong/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restart').onclick = () => startRun();
$('btn-title').onclick = () => toTitle();
$('btn-retry').onclick = () => startRun();
$('btn-over-retry').onclick = () => startRun();
$('btn-over-title').onclick = () => toTitle();
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-next').onclick = () => {
  const nx = M.nextDiff(st.diff);
  if (nx) { M.save.setDiff(nx); M.ui.updateDiffBtns(); }
  startRun();
};

// ── 포인터: 화면을 잡고 끌면 모구가 손가락(마우스)을 따라간다 ──
const wrap = $('stage-wrap');
function toLogicX(clientX) {
  const r = M.Render.cv.getBoundingClientRect();
  return Math.max(0, Math.min(M.W, ((clientX - r.left) / r.width) * M.W));
}
const onMove = (e) => { if (mode === 'play' && dragX !== null) dragX = toLogicX(e.clientX); };
wrap.addEventListener('pointerdown', (e) => {
  M.audio.resume();
  if (mode !== 'play') return;
  e.preventDefault();
  dragX = toLogicX(e.clientX);
});
wrap.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', () => { dragX = null; });
window.addEventListener('pointercancel', () => { dragX = null; });

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = $('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').innerHTML = '◀▶ 버튼 또는 화면을 끌어서 이동<br>5분(5:00)을 버티면 CLEAR! 한 번이라도 맞으면 끝';
  const bindHold = (id, on, off) => {
    const el = $(id);
    const setOn = (e) => { e.preventDefault(); M.audio.resume(); on(); el.classList.add('pressed'); };
    const setOff = () => { if (off) off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointercancel', setOff);
    el.addEventListener('pointerleave', setOff);
  };
  bindHold('vbtn-left', () => { held.left = true; dragX = null; }, () => { held.left = false; });
  bindHold('vbtn-right', () => { held.right = true; dragX = null; }, () => { held.right = false; });
  $('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, diff: st ? st.diff : M.diff, phase: st ? st.phase : null,
  t: st ? +st.t.toFixed(2) : 0, wave: st ? st.waveNo : 0,
  dodged: st ? st.dodged : 0, poops: st ? st.poops.length : 0,
  px: st ? +st.p.x.toFixed(1) : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) vpad.classList.toggle('on', mode === 'play');

  if (st && (mode === 'play' || mode === 'over' || mode === 'win' || mode === 'ending')) {
    handleEvents(M.Logic.step(st, dt, {
      left: held.left, right: held.right,
      targetX: mode === 'play' && dragX !== null && !held.left && !held.right ? dragX : null,
    }));
    if (mode === 'play' && M.Logic.deathDone(st)) {
      mode = 'over';
      M.ui.showOver(st, st.isBest);
      if (st.isBest) M.audio.best();
    }
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
