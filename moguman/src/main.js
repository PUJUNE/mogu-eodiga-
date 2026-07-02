// main.js — 게임 루프 + 상태 머신 + 입력 (키보드·터치)
const M = window.MGM;

const BOSS_NAMES = { kingmouse: '왕생쥐', crow: '심술 까마귀', bigvacuum: '폭주 청소기', shadowcat: '그림자 고양이', mouselord: '쥐마왕' };

let mode = 'title';           // title | play | pause | over | ending
let st = null;                // 로직 상태
let overCount = 10, overAcc = 0;
const keys = { left: false, right: false, fire: false };
let jumpQueued = false;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(n, carry) {
  st = M.Logic.create(n, carry);
  mode = 'play';
  M.ui.hideAll();
  M.ui.hud(st);
  const name = st.stage.boss
    ? `STAGE ${n} — ${BOSS_NAMES[st.stage.boss]} 등장!!`
    : `STAGE ${n} · ${st.stage.theme.name}`;
  M.ui.toast(name, 2.2);
  M.audio.resume();
  M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function stageCleared() {
  if (st.no >= 50) {
    M.save.reach(50); M.save.score(st.score);
    mode = 'ending';
    document.getElementById('ending-score').textContent = `SCORE ${st.score}`;
    M.ui.show('ending-screen');
  } else {
    M.save.reach(st.no + 1); M.save.score(st.score);
    startStage(st.no + 1, { score: st.score, lives: st.lives });
  }
}

function gameOverContinue() {
  startStage(st.no, { score: st.score, lives: 3 });
}

// ── 로직 이벤트 → 연출 ──
function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'shoot': M.audio.shoot(); break;
      case 'jump': M.audio.jump(); break;
      case 'fur': M.audio.fur(); break;
      case 'ball': M.audio.ball(); break;
      case 'kick': M.audio.kick(); break;
      case 'bounce': M.audio.bounce(); break;
      case 'unball': case 'angry': M.audio.angry(); if (e.type === 'angry') M.ui.toast('적들이 화났다!', 1.6); break;
      case 'kill': M.audio.kill(); M.Render.addFx(e.x, e.y, `${e.pts}`, '#ffd83d'); break;
      case 'ballpop': M.audio.fur(); break;
      case 'item': M.audio.item(); break;
      case 'fish': M.audio.fish(); M.ui.toast('🐟 목숨 +1', 1.4); break;
      case 'hurt': M.audio.hurt(); break;
      case 'spawn': M.audio.spawn(); break;
      case 'bosshit': M.audio.bosshit(); break;
      case 'bossdead': M.audio.bossdead(); M.ui.toast('보스 격파!!', 2.0); break;
      case 'clear': M.audio.clear(); break;
      case 'gameover':
        mode = 'over'; overCount = 10; overAcc = 0;
        M.ui.setCountdown(10);
        M.ui.show('over-screen');
        M.audio.gameover();
        break;
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') keys.left = true;
  if (k === 'ArrowRight') keys.right = true;
  if ((k === 'ArrowUp' || k === 'z' || k === 'Z') && !e.repeat) jumpQueued = true;
  if (k === ' ' || k === 'x' || k === 'X') keys.fire = true;

  if (mode === 'title') {
    if (k === 'Enter') startTitle(false);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no, { score: st.score, lives: st.lives });
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no, { score: st.score, lives: st.lives });
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') gameOverContinue();
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === ' ' || e.key === 'x' || e.key === 'X') keys.fire = false;
});

function startTitle(fresh) {
  const from = fresh ? 1 : M.save.data.best;
  startStage(from, { score: 0, lives: 3 });
}
document.getElementById('btn-series').onclick = () => {
  // 개발 페이지(/moguman/)와 빌드본(루트) 양쪽에서 런처로 이동
  location.href = location.pathname.includes('/moguman/') ? '../index.html' : 'index.html';
};
document.getElementById('btn-continue').onclick = () => startTitle(false);
document.getElementById('btn-new').onclick = () => startTitle(true);
document.getElementById('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
document.getElementById('btn-restage').onclick = () => startStage(st.no, { score: st.score, lives: st.lives });
document.getElementById('btn-title').onclick = () => toTitle();
document.getElementById('btn-end-title').onclick = () => toTitle();

// ── 터치 (html-game-mobile-touch 워크플로우) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  const bindHold = (id, fn) => {
    const el = document.getElementById(id);
    const set = (v) => (e) => { e.preventDefault(); M.audio.resume(); fn(v); el.classList.toggle('pressed', v); };
    el.addEventListener('pointerdown', set(true));
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('pointerleave', set(false));
  };
  bindHold('vbtn-left', (v) => { keys.left = v; });
  bindHold('vbtn-right', (v) => { keys.right = v; });
  bindHold('vbtn-fire', (v) => { keys.fire = v; });
  bindHold('vbtn-jump', (v) => { if (v) jumpQueued = true; });
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  // 게임 오버: 화면 탭 = 컨티뉴 (버튼 제외)
  document.getElementById('over-screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#btn-over-title')) return;
    M.audio.resume();
    if (mode === 'over') gameOverContinue();
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}
document.getElementById('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  score: st ? st.score : 0, lives: st ? st.lives : 0,
  enemies: st ? st.enemies.length : 0,
  puffs: st ? st.puffs.length : 0,
  states: st ? st.enemies.map((e) => e.state) : [],
  boss: st && st.boss ? { hp: st.boss.hp } : null,
  player: st ? { x: +st.player.x.toFixed(1), y: +st.player.y.toFixed(1), onGround: st.player.onGround } : null,
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
    const ev = M.Logic.step(st, dt, { left: keys.left, right: keys.right, fire: keys.fire, jump: jumpQueued });
    jumpQueued = false;
    handleEvents(ev);
    M.ui.hud(st);
    if (st.phase === 'clear' && st.clearT === 0) M.ui.toast('CLEAR!', 1.6);
    if (st.phase === 'clear' && st.clearT > 2.2) stageCleared();
  } else if (mode === 'over' && st) {
    overAcc += dt;
    if (overAcc >= 1) {
      overAcc -= 1; overCount--;
      if (overCount <= 0) toTitle();
      else M.ui.setCountdown(overCount);
    }
  }
  if (st) M.Render.draw(st, now / 1000);
}
requestAnimationFrame(frame);
