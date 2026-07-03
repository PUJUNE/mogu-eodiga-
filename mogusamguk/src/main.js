// main.js — 게임 루프 + 상태 머신 + 입력
const M = window.MSG;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, up: false, down: false };
let atkQueued = false, jumpQueued = false, specialQueued = false;
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startMission(no) {
  st = M.Logic.create(no, M.save.data.exp || 0);
  M.Render.fx = [];
  M.Render.camX = 0;
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`MISSION ${no} · ${st.stage.theme.name}`, 2.0);
  M.audio.resume(); M.audio.meow();
  setTimeout(() => M.audio.cluck(), 500);
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'swing': case 'eswing': M.audio.swing(); break;
      case 'musou': M.audio.musou(); M.Render.addMusou(e.x, M.Render.sy(e.z, 24)); M.ui.toast('무쌍난무!!', 1.2); break;
      case 'arrow': M.audio.arrow(); break;
      case 'arrowhit': M.audio.hurt(); break;
      case 'jump': M.audio.jump(); break;
      case 'hit':
        M.audio.hit();
        M.Render.addSpark(e.x, M.Render.sy(e.z, 20), e.kd);
        break;
      case 'kd': M.audio.kd(); break;
      case 'levelup':
        M.audio.levelup();
        M.ui.toast(`⬆ LEVEL UP! Lv.${e.lv} — 공격력·체력 상승!`, 1.8);
        M.save.setExp(st.exp);
        break;
      case 'edown': M.audio.edown(); break;
      case 'chur': break;
      case 'pickup': M.audio.pickup(); M.ui.toast('🍡 츄르! +30', 1.2); break;
      case 'wave': M.audio.wave(); M.ui.toast('악당 증원…!', 1.2); break;
      case 'go': M.audio.go(); M.ui.toast('GO ▶▶', 1.4); break;
      case 'section': break;
      case 'bossintro': M.audio.bossintro(); M.ui.toast(`👑 ${e.name} 등장!!`, 2.2); break;
      case 'buddydown': M.ui.toast('꼬꼬가 쓰러졌다…!', 1.6); break;
      case 'buddyup': M.audio.buddyup(); M.audio.cluck(); M.ui.toast('🐔 꼬꼬 부활!', 1.4); break;
      case 'clear':
        M.save.setExp(st.exp);
        M.audio.clear(e.stars);
        M.save.record(st.mission, e.stars);
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st); } }, 1400);
        break;
      case 'over':
        M.audio.over();
        setTimeout(() => {
          if (mode === 'play') {
            mode = 'over'; overCount = 10; overAcc = 0;
            M.ui.setCountdown(10);
            M.ui.show('over-screen');
          }
        }, 900);
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
  if (k === 'ArrowUp') held.up = true;
  if (k === 'ArrowDown') held.down = true;
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') atkQueued = true;
  if ((k === 'x' || k === 'X') && !e.repeat && mode === 'play') jumpQueued = true;
  if ((k === 'c' || k === 'C' || k === 'Shift') && !e.repeat && mode === 'play') specialQueued = true;

  if (mode === 'title') {
    if (k === 'Enter') startMission(M.save.data.best);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startMission(st.mission);
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startMission(st.mission);
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.mission < 5) startMission(st.mission + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') { M.Logic.respawn(st); mode = 'play'; M.ui.hideAll(); }
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

$('btn-continue').onclick = () => startMission(M.save.data.best);
$('btn-new').onclick = () => { M.save.data.exp = 0; M.save.store(); startMission(1); };
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogudragon/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startMission(st.mission);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => startMission(st.mission + 1);
$('btn-retry').onclick = () => startMission(st.mission);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '패드로 이동 · 👊 공격 (3연타 콤보!) · ⬆ 점프 · 점프 중 공격 = 점프킥';
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
  bindHold('vbtn-jump', () => { if (mode === 'play') jumpQueued = true; });
  bindHold('vbtn-sp', () => { if (mode === 'play') specialQueued = true; });
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  $('over-screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#btn-over-title')) return;
    M.audio.resume();
    if (mode === 'over') { M.Logic.respawn(st); mode = 'play'; M.ui.hideAll(); }
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, mission: st ? st.mission : 0, phase: st ? st.phase : null,
  sec: st ? st.secIdx : 0, go: st ? st.go : false,
  p: st ? { x: +st.p.x.toFixed(1), z: +st.p.z.toFixed(1), hp: st.p.hp, state: st.p.state } : null,
  b: st ? { hp: st.b.hp, state: st.b.state } : null,
  enemies: st ? st.enemies.filter((e) => M.Logic.alive(e)).length : 0,
  score: st ? st.score : 0, lv: st ? st.lv : 1, exp: st ? st.exp : 0, stars: st ? st.stars : 0, deaths: st ? st.deaths : 0,
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
      atk: atkQueued, jump: jumpQueued, special: specialQueued,
    }));
    atkQueued = false; jumpQueued = false; specialQueued = false;
  } else {
    atkQueued = false; jumpQueued = false; specialQueued = false;
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
