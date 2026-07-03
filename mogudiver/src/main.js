// main.js — 게임 루프 + 상태 머신 + 입력 (키보드·터치)
const M = window.MDV;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | ending
let st = null;
const held = { left: false, right: false, up: false, down: false };
let atkQueued = false, dashQueued = false;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startStage(no) {
  st = M.Logic.create(no);
  M.Render.fx = [];
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`STAGE ${st.no} — ${M.STORY[st.no]}`, 3.0);
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
      case 'swing': M.audio.swing(); break;
      case 'hit': M.audio.hit(); M.Render.addSpark(e.x, e.y); break;
      case 'kill': M.audio.kill(); break;
      case 'dissolve': M.Render.addPuff(e.x, e.y, 'rgba(176,208,255,.5)'); break;
      case 'grab': M.audio.grab(); M.ui.toast(`🐟 ${e.name}을(를) 물었다! 보트로 가져가자`, 1.5); break;
      case 'deposit':
        M.audio.deposit();
        M.Render.addFloat(st.p.x, st.p.y - 16, `+${e.score}`, '#ffd83d');
        M.ui.toast(`🧺 ${e.name} 하역! (${Math.min(e.n, e.need)}/${e.need})`, 1.4);
        break;
      case 'quota': M.audio.quota(); M.ui.toast('할당량 달성! 깊은 곳에서 무언가 다가온다…', 2.4); break;
      case 'dash': M.audio.dash(); M.Render.addBubbles(e.x, e.y, 6); break;
      case 'hurt': M.audio.hurt(); break;
      case 'o2low': M.audio.o2low(); M.ui.toast('⚠ 산소 부족! 수면으로!', 1.6); break;
      case 'o2full': M.audio.o2full(); break;
      case 'faint':
        M.audio.faint();
        M.ui.toast(e.lost ? `😵 기절… ${e.lost}을(를) 놓쳤다` : '😵 기절… 보트로 돌아왔다', 2.2);
        break;
      case 'bossintro': M.audio.bossintro(); M.ui.toast(`👑 ${e.name} 등장!!`, 2.2); break;
      case 'bosstele': M.audio.bosstele(); break;
      case 'bossdash': M.audio.dash(); break;
      case 'spikes': M.audio.spikes(); break;
      case 'zap': M.audio.zap(); M.Render.addRing(e.x, e.y, e.r, 'rgba(180,180,255,.8)'); break;
      case 'ink': M.audio.ink(); break;
      case 'bosshit': M.audio.bosshit(); M.Render.addSpark(e.x, e.y); break;
      case 'bossdown': M.audio.bossdown(); M.ui.toast(`💥 ${e.name} 격파!!`, 2.0); break;
      case 'clear': {
        M.audio.clear(e.stars);
        M.save.record(st.no, e.stars);
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st); } }, 1400);
        break;
      }
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
  if (k === 'ArrowUp') held.up = true;
  if (k === 'ArrowDown') held.down = true;
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') atkQueued = true;
  if ((k === 'x' || k === 'X') && !e.repeat && mode === 'play') dashQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startStage(M.save.data.best);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.no < M.TOTAL) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
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
  location.href = location.pathname.includes('/mogudiver/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startStage(st.no);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => { if (st.no < M.TOTAL) startStage(st.no + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } };
$('btn-retry').onclick = () => startStage(st.no);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '패드 이동 · 🐾 발톱 · 💨 대시 — 물고기를 물고 보트로!';
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
  bindHold('vbtn-dash', () => { if (mode === 'play') dashQueued = true; });
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  p: st ? { x: +st.p.x.toFixed(1), y: +st.p.y.toFixed(1), o2: +st.p.o2.toFixed(1), carry: st.p.carry ? st.p.carry.type : null } : null,
  fish: st ? st.fish.filter((f) => !f.dead).length : 0,
  corpses: st ? st.fish.filter((f) => f.dead).length : 0,
  boss: st && st.boss ? { hp: st.boss.hp, dead: st.boss.dead, state: st.boss.state } : null,
  delivered: st ? st.delivered : 0, quota: st ? st.stage.quota : 0,
  score: st ? st.score : 0, deaths: st ? st.deaths : 0, stars: st ? st.stars : 0,
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
      left: held.left, right: held.right, up: held.up, down: held.down,
      atk: atkQueued, dash: dashQueued,
    }));
  }
  atkQueued = false; dashQueued = false;
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
