// main.js — 게임 루프 + 상태 머신 + 입력 (키보드·터치, 가변 점프 홀드)
const M = window.SMG;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, dash: false, jump: false };
let jumpQueued = false;
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  M.Render.camX = 0;
  mode = 'play';
  M.ui.hideAll();
  const { world, sub } = M.worldOf(no);
  M.ui.toast(`WORLD ${world}-${sub} · ${st.stage.theme.name}${st.stage.castle ? ' 🏰' : ''} 출발!`, 2.0);
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
      case 'stomp': M.audio.stomp(); break;
      case 'coin': M.audio.coin(); break;
      case 'bump': M.audio.bump(); break;
      case 'break': M.audio.brk(); M.Render.addBreak(e.tx, e.ty); break;
      case 'sprout': M.audio.sprout(); break;
      case 'grow': M.audio.grow(); M.ui.toast(st.p.size === 2 ? '🌿 캣닢! Shift로 털뭉치 발사!' : '🍢 츄르! 슈퍼 모구!', 1.6); break;
      case 'shrink': M.audio.shrink(); break;
      case 'shoot': M.audio.shoot(); break;
      case 'kick': M.audio.kick(); break;
      case 'shellhit': M.audio.kick(); break;
      case 'kill': M.audio.stomp(); break;
      case 'starman': M.audio.starman(); M.ui.toast('✨ 8초 무적!!', 1.4); break;
      case 'bossintro': M.audio.meow(); M.ui.toast('👑 쥐마왕 등장!! 3번 밟아라!', 2.2); break;
      case 'bosshit': M.audio.bosshit(); if (e.hp > 0) M.ui.toast(`👑 쥐마왕 HP ${e.hp}`, 1.0); break;
      case 'die': M.audio.die(); break;
      case 'clear':
        M.audio.clear(e.stars);
        M.save.record(st.no, e.stars);
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
  if (k === 'Shift' || k === 'x' || k === 'X') held.dash = true;
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat) {
    held.jump = true;
    if (mode === 'play') jumpQueued = true;
  }

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
    if (k === 'Enter') { if (st.no < 32) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
  } else if (mode === 'over') {
    if (k === 'Enter') startStage(st.no);
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft') held.left = false;
  if (k === 'ArrowRight') held.right = false;
  if (k === 'Shift' || k === 'x' || k === 'X') held.dash = false;
  if (k === ' ' || k === 'z' || k === 'Z') held.jump = false;
});

$('btn-continue').onclick = () => startStage(M.save.data.best);
$('btn-new').onclick = () => startStage(1);
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/supermogu/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => { if (st.no < 32) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } };
$('btn-retry').onclick = () => startStage(st.no);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '◀▶ 달리기 · Ⓐ 점프(길게 = 높이) · Ⓑ 대시/털뭉치 · 쥐·새를 밟고 깃발까지!';
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
  bindHold('vbtn-a', () => { held.jump = true; if (mode === 'play') jumpQueued = true; }, () => { held.jump = false; });
  bindHold('vbtn-b', () => { held.dash = true; }, () => { held.dash = false; });
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
  x: st ? +st.p.x.toFixed(1) : 0, y: st ? +st.p.y.toFixed(1) : 0,
  vx: st ? +st.p.vx.toFixed(1) : 0, vy: st ? +st.p.vy.toFixed(1) : 0,
  onG: st ? st.p.onG : false, size: st ? st.p.size : 0,
  coins: st ? st.coins : 0, score: st ? st.score : 0,
  time: st ? +st.time.toFixed(1) : 0, stars: st ? st.stars || 0 : 0,
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
      left: held.left, right: held.right, dash: held.dash,
      jump: jumpQueued, jumpHold: held.jump, fire: held.dash,
    }));
    jumpQueued = false;
    // 클리어·게임오버 화면 전환 (깃발 하강·낙하 연출 후)
    if (st.phase === 'clear' && st.endT > 1.5) {
      mode = 'win'; M.ui.showWin(st);
    } else if (st.phase === 'over' && st.endT > 1.6) {
      mode = 'over'; overCount = 10; overAcc = 0;
      M.ui.setCountdown(10);
      M.ui.show('over-screen');
    }
  } else if (mode === 'over') {
    jumpQueued = false;
    overAcc += dt;
    if (overAcc >= 1) {
      overAcc = 0; overCount--;
      M.ui.setCountdown(Math.max(0, overCount));
      if (overCount <= 0) toTitle();
    }
  } else {
    jumpQueued = false;
  }
  if (st && mode !== 'title' && mode !== 'ending') M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
