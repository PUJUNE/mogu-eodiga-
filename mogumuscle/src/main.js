// main.js — 게임 루프 + 상태 머신 + 입력
const M = window.MMS;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, up: false, down: false };
let atkQueued = false, tagQueued = false;
let overCount = 10, overAcc = 0, tickAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`STAGE ${no} — vs ${st.stage.team.name}!` +
    (M.diff !== 'normal' ? ` · ${M.DIFFS[M.diff].name}` : ''), 2.2);
  M.audio.resume(); M.audio.bell();
  setTimeout(() => M.audio.meow(), 300);
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'bounce': M.audio.bounce(); break;
      case 'swing': M.audio.swing(); break;
      case 'punch': M.audio.punch(); M.Render.addHit(e.x, e.z, e.amount); break;
      case 'throw': M.audio.throwSlam(); M.Render.addHit(e.x, e.z, e.amount); break;
      case 'lariat': M.audio.lariat(); M.Render.addHit(e.x, e.z, e.amount); break;
      case 'special':
        M.audio.special();
        M.Render.addHit(e.x, e.z, e.amount, true);
        M.ui.toast('💥 머슬 드라이버!!', 1.2);
        break;
      case 'kd': M.audio.kd(); break;
      case 'ball': M.audio.ball(); M.ui.toast('✨ 파워볼 등장!', 1.2); break;
      case 'powered':
        M.audio.powered();
        M.ui.toast(e.team === 'p' ? '⚡ 파워 충전! 다음 공격 = 필살기!' : '⚡ 상대가 파워볼을 가져갔다!', 1.5);
        break;
      case 'tag': M.audio.tag(); M.ui.toast(`🔄 태그! ${e.name} 입장!`, 1.2); break;
      case 'etag': M.audio.tag(); M.ui.toast(`상대 태그 — ${e.name} 입장…`, 1.2); break;
      case 'edash': M.audio.bounce(); break;
      case 'ko': M.audio.ko(); M.ui.toast(`💫 ${e.name} K.O.!!`, 1.4); break;
      case 'enter': M.ui.toast(`${e.name} 등판!`, 1.2); break;
      case 'penter': M.audio.cluck(); M.ui.toast(`${e.name} 교대 투입!`, 1.4); break;
      case 'clear':
        M.audio.bell();
        M.audio.clear(e.stars);
        M.save.record(st.no, e.stars);
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st); } }, 2300);
        break;
      case 'over':
        M.audio.over();
        setTimeout(() => {
          if (mode === 'play') {
            mode = 'over'; overCount = 10; overAcc = 0;
            M.ui.setCountdown(10);
            M.ui.show('over-screen');
          }
        }, 1600);
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
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') atkQueued = true;
  if ((k === 'x' || k === 'X') && !e.repeat && mode === 'play') tagQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startStage(M.save.data.best);
    if (k === 'd' || k === 'D') {
      const next = M.DIFF_ORDER[(M.DIFF_ORDER.indexOf(M.diff) + 1) % M.DIFF_ORDER.length];
      M.save.setDiff(next);
      M.ui.updateDiffBtns();
    }
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no);
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no);
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.no < 10) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
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
  location.href = location.pathname.includes('/mogumuscle/') ? '../index.html' : 'index.html';
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
  $('title-hint').textContent = '패드로 이동 · 로프에 밀면 대시 · 👊 공격 (근접 = 던지기!) · 🔄 코너 태그';
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
  bindHold('vbtn-atk', () => { if (mode === 'play') atkQueued = true; });
  bindHold('vbtn-tag', () => { if (mode === 'play') tagQueued = true; });
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
M._dbg = () => {
  const P = st ? st.players[st.pi] : null;
  return {
    mode, no: st ? st.no : 0, phase: st ? st.phase : null,
    p: P ? { x: +P.x.toFixed(1), z: +P.z.toFixed(1), hp: +P.hp.toFixed(1), state: P.state, powered: P.powered } : null,
    pi: st ? st.pi : 0, ei: st ? st.ei : 0,
    ehp: st ? +st.enemies[st.ei].hp.toFixed(1) : 0,
    time: st ? +st.time.toFixed(1) : 0,
    score: st ? st.score : 0, stars: st ? st.stars : 0, pDowns: st ? st.pDowns : 0,
  };
};
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
      left: held.left, right: held.right, up: held.up, down: held.down,
      atk: atkQueued, tag: tagQueued,
    }));
    atkQueued = false; tagQueued = false;
    if (st.time < 15 && st.phase === 'fight') {
      tickAcc += dt;
      if (tickAcc > 1.0) { tickAcc = 0; M.audio.tick(); }
    }
  } else {
    atkQueued = false; tagQueued = false;
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
