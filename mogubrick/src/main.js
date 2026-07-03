// main.js — 게임 루프 + 상태 머신 + 입력 (키보드·마우스·터치 드래그)
const M = window.MBK;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false };
let launchQueued = false;
let pointerX = null;           // 캔버스 드래그 좌표 (월드 x)

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  mode = 'play';
  pointerX = null;
  M.ui.hideAll();
  M.ui.toast(`STAGE ${st.no}${M.STORY[st.no] ? ' — ' + M.STORY[st.no] : ' · ' + st.stage.theme.name}`, 2.6);
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
      case 'launch': M.audio.launch(); break;
      case 'wall': M.audio.wall(); break;
      case 'paddle': M.audio.paddle(); break;
      case 'brick': {
        M.audio.brick();
        const col = e.kind === 'mogu' ? '#ffe9b0' : st.stage.theme.rows[0];
        M.Render.addShatter(e.x, e.y, col);
        break;
      }
      case 'crack': M.audio.crack(); M.Render.addSpark(e.x, e.y); break;
      case 'clank': M.audio.clank(); M.Render.addSpark(e.x, e.y); break;
      case 'mogudrop': M.audio.mogudrop(); M.ui.toast('🐱 모구가 떨어진다! 바로 받아줘!', 1.6); break;
      case 'rescue':
        M.audio.rescue();
        M.Render.addFloat(e.x, M.Logic.PY - 14, '구출! +300', '#ffd83d');
        M.ui.toast(`🐱 모구 구출! 바가 넓어졌다 (${e.n}마리)`, 1.6);
        break;
      case 'mogulost': M.audio.mogulost(); M.ui.toast('모구를 놓쳤다…', 1.4); break;
      case 'balllost': M.audio.balllost(); if (e.lives > 0) M.ui.toast(`공 놓침! 남은 목숨 ${e.lives}`, 1.5); break;
      case 'over':
        M.audio.over();
        setTimeout(() => { if (mode === 'play') { mode = 'over'; M.ui.show('over-screen'); } }, 800);
        break;
      case 'clear': {
        M.audio.clear(e.stars);
        M.save.record(st.no, e.stars, e.rescued);
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st); } }, 1200);
        break;
      }
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') { held.left = true; pointerX = null; }
  if (k === 'ArrowRight') { held.right = true; pointerX = null; }
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') launchQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startStage(M.save.data.best);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.no < M.TOTAL) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
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
});

$('btn-continue').onclick = () => startStage(M.save.data.best);
$('btn-new').onclick = () => startStage(1);
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogubrick/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => { if (st.no < M.TOTAL) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } };
$('btn-retry').onclick = () => startStage(st.no);
$('btn-win-title').onclick = () => toTitle();
$('btn-over-retry').onclick = () => startStage(st.no);
$('btn-over-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();

// ── 마우스·터치: 캔버스 드래그로 바 이동, 탭/클릭으로 발사 ──
const cv = document.getElementById('game');
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '조종간으로 바 이동 · 🚀 또는 탭으로 발사 — 낙하하는 모구를 받아줘!';
}
function canvasX(e) {
  const r = cv.getBoundingClientRect();
  return (e.clientX - r.left) / r.width * M.W;
}
cv.addEventListener('pointerdown', (e) => {
  M.audio.resume();
  if (mode !== 'play') return;
  e.preventDefault();
  pointerX = canvasX(e);
  launchQueued = true;
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'play' || e.buttons === 0) return;
  e.preventDefault();
  pointerX = canvasX(e);
});
document.addEventListener('touchmove', (e) => { if (mode === 'play') e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
cv.addEventListener('contextmenu', (e) => e.preventDefault());
// 터치 일시정지 버튼
$('tbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
});

// ── 터치 조종간: 큰 원 안의 조종간을 기울인 만큼 바 이동 ──
const stick = { on: false, id: null, ax: 0 };
const vsBase = $('vstick'), vsKnob = $('vstick-knob');
function moveStick(e) {
  const r = vsBase.getBoundingClientRect();
  const rad = r.width / 2 - 24;
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy) || 1;
  const cl = Math.min(d, rad);
  dx = dx / d * cl; dy = dy / d * cl;
  vsKnob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
  stick.ax = Math.max(-1, Math.min(1, dx / rad));
  pointerX = null;                                   // 조종간 사용 중엔 드래그 좌표 해제
}
function endStick(e) {
  if (stick.id !== null && e.pointerId !== stick.id) return;
  stick.on = false; stick.id = null; stick.ax = 0;
  vsKnob.style.transform = 'translate(-50%, -50%)';
}
vsBase.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  M.audio.resume();
  stick.on = true; stick.id = e.pointerId;
  try { vsBase.setPointerCapture(e.pointerId); } catch (err) {}
  moveStick(e);
});
vsBase.addEventListener('pointermove', (e) => {
  if (!stick.on || e.pointerId !== stick.id) return;
  e.preventDefault();
  moveStick(e);
});
vsBase.addEventListener('pointerup', endStick);
vsBase.addEventListener('pointercancel', endStick);

// 발사 버튼
$('vbtn-launch').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  M.audio.resume();
  $('vbtn-launch').classList.add('pressed');
  if (mode === 'play') launchQueued = true;
});
$('vbtn-launch').addEventListener('pointerup', () => $('vbtn-launch').classList.remove('pressed'));
$('vbtn-launch').addEventListener('pointercancel', () => $('vbtn-launch').classList.remove('pressed'));

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  ball: st ? { x: +st.ball.x.toFixed(1), y: +st.ball.y.toFixed(1), stuck: st.ball.stuck } : null,
  paddle: st ? { x: +st.paddle.x.toFixed(1), w: st.paddle.w } : null,
  bricks: st ? st.bricks.filter((b) => b.alive).length : 0,
  breakable: st ? M.Logic.breakableLeft(st) : 0,
  drops: st ? st.drops.length : 0,
  rescued: st ? st.rescued : 0, lives: st ? st.lives : 0,
  score: st ? st.score : 0, stars: st ? st.stars : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) {
    const on = mode === 'play';
    $('tbtn-pause').classList.toggle('on', on);
    $('vstick').classList.toggle('on', on);
    $('vbtn-launch').classList.toggle('on', on);
  }

  if (mode === 'play' && st) {
    handleEvents(M.Logic.step(st, dt, {
      left: held.left, right: held.right,
      launch: launchQueued,
      px: stick.on ? null : pointerX,
      ax: stick.on ? stick.ax : 0,
    }));
  }
  launchQueued = false;
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
