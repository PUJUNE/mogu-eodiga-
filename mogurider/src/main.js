// main.js — 게임 루프 + 상태 머신 + 입력 (키보드 ←→ / 터치 드래그·가상패드)
const M = window.MDR;
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
  M.ui.toast(`${M.DIFFS[M.diff].name} — 달까지 12,000m!`, 1.8);
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
  st.isBest = M.save.record(st.diff, st.score, st.dist, cleared);
}

function handleEvents(evs) {
  const R = M.Render;
  for (const e of evs) {
    switch (e.type) {
      case 'shoot': M.audio.shoot(); break;
      case 'hurt': M.audio.hurt(); R.addSpark(e.x, e.y); break;
      case 'clank': M.audio.clank(); R.addSpark(e.x, e.y); break;
      case 'kill':
        if (!e.bomb) M.audio.kill();
        R.addBurst(e.x, e.y, e.r, e.kind === 'rock' ? '#9aa0aa' : '#ffb347');
        if (e.score) R.addText(e.x, e.y - 10, `+${e.score}`, '#fff');
        break;
      case 'coin': M.audio.coin(); R.addText(e.x, e.y, `+${e.value}`, '#ffd83d'); break;
      case 'item': M.audio.item(); M.ui.toast(`${M.ITEMS[e.kind].emoji} ${M.ITEMS[e.kind].name} — ${M.ITEMS[e.kind].desc}`, 1.4); break;
      case 'levelup': M.audio.levelup(); R.addText(st.p.x, M.PY - 60, `🔥 LEVEL ${e.level}!`, '#9fe0ff'); break;
      case 'bonus': R.addText(st.p.x, M.PY - 60, `+${e.score}`, '#fff'); break;
      case 'fever': M.audio.fever(); M.ui.toast('🍢 FEVER!! 5초간 무적 + 5갈래 연사', 1.6); break;
      case 'feverend': M.ui.toast('피버 종료', 0.8); break;
      case 'bomb': M.audio.bomb(); R.flash = 0.9; R.shake = 0.35; break;
      case 'shieldbreak': M.audio.shield(); R.addText(e.x, M.PY - 50, '🛡️ 막았다!', '#9fe0ff'); break;
      case 'hit': M.audio.hit(); R.addBurst(e.x, e.y, 24, '#ff6a6a'); R.shake = 0.3; M.ui.toast('앗! 하트 -1 · 불꽃 레벨 -1', 1.2); break;
      case 'wave': M.audio.wave(e.no); break;
      case 'zone': M.ui.toast(`🌍 ${e.name}에 진입!`, 1.4); break;
      case 'boss': M.audio.boss(); M.ui.toast(`⚠️ 보스 등장 — ${e.name}!!`, 2.2); R.shake = 0.5; break;
      case 'bossfire': break;
      case 'bossdead':
        M.audio.bossdead(); R.addBurst(e.x, e.y, e.r * 1.4, '#ffd83d'); R.flash = 0.6; R.shake = 0.5;
        R.addText(e.x, e.y, `+${e.score.toLocaleString()}`, '#ffd83d');
        M.ui.toast(`🏆 ${e.name} 격파!`, 1.8);
        break;
      case 'over': finish(); M.audio.over(); break;
      case 'clear':
        finish();
        M.audio.clear();
        setTimeout(() => {
          if (mode !== 'play') return;
          if (M.save.data.cleared.crazy && st.diff === 'crazy') { mode = 'ending'; M.ui.show('ending-screen'); }
          else { mode = 'win'; M.ui.showClear(st); }
        }, 1800);
        break;
    }
  }
}

// ── 키보드 (←→ 이동, Space 시작·일시정지) ──
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
  location.href = location.pathname.includes('/mogurider/') ? '../index.html' : 'index.html';
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

// ── 포인터: 화면을 잡고 끌면 드래곤이 손가락(마우스)을 따라간다 ──
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
  $('title-hint').innerHTML = '◀▶ 버튼 또는 화면을 끌어서 이동 · 불꽃은 자동 발사<br>12,000m 위의 달까지 날아오르면 CLEAR!';
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
  dist: st ? Math.floor(st.dist) : 0, score: st ? st.score : 0, wave: st ? st.waveNo : 0,
  hearts: st ? st.p.hearts : 0, level: st ? st.p.level : 0, boss: st && st.boss ? st.boss.name : null,
  enemies: st ? st.enemies.length : 0, px: st ? +st.p.x.toFixed(1) : 0,
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
