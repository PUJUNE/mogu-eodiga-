// main.js — 게임 루프 + 모드 전환 + 입력 (키보드 / 터치 8방향 패드·버튼)
const M = window.MSK;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | result | ending
let st = null, ai = null;
let resultT = 0, endingT = 0;
let worst = false;
const held = { left: false, right: false, up: false, down: false, lp: false, hp: false, grab: false, sp1: false, sp2: false, sp3: false, su: false };
// 한 프레임 안에 눌렀다 뗀 짧은 입력도 놓치지 않도록 다음 스텝까지 붙잡아 둔다
const tapped = {};
const press = (k) => { held[k] = true; tapped[k] = true; };

M.save.load();
M.ui.init();
M.Render.init($('game'));
M.ui.show('title-screen');

function startMatch(stage) {
  const s = stage != null ? stage : M.save.stageOf(M.diff);
  st = M.Logic.create((Date.now() & 0x7fffffff) || 1, M.diff, s);
  ai = M.AI.create(M.diff, (Date.now() * 7) & 0x7fffffff);
  M.Render.reset();
  for (const k of Object.keys(held)) held[k] = false;
  for (const k of Object.keys(tapped)) delete tapped[k];
  mode = 'play';
  M.ui.hideAll();
  M.audio.resume(); M.audio.page();
}

function toTitle() {
  mode = 'title';
  M.ui.updateDiffBtns();
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function handleEvents(evs) {
  for (const e of evs) {
    M.Render.addFx(e, st);
    switch (e.type) {
      case 'roundStart': M.audio.bell(); break;
      case 'fight': M.audio.fight(); break;
      case 'swing': M.audio.swing(e.strong); break;
      case 'hit': M.audio.hit(e.strong); break;
      case 'block': M.audio.block(); break;
      case 'grab': M.audio.grab(); break;
      case 'projectile': if (e.kind === 'shuriken') M.audio.shuriken(); else M.audio.fireball(); break;
      case 'special': M.audio.scratch(); if (e.kind === 'eraser') M.audio.eraser(); break;
      case 'hazard': M.audio.scratch(); break;
      case 'super': M.audio.super(); break;
      case 'jump': M.audio.jump(); break;
      case 'land': if (e.heavy) M.audio.land(); break;
      case 'ko': case 'timeup': M.audio.ko(); break;
      case 'matchEnd':
        resultT = 0;
        if (e.winner === 0) { M.save.beat(st.diff, st.stage); M.audio.win(); }
        else M.audio.lose();
        break;
    }
  }
}

function pause() { if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); } }
function resume() { if (mode === 'pause') { mode = 'play'; M.ui.hideAll(); } }

// ── 키보드 (설계 5-1절) ──
const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', z: 'lp', Z: 'lp', x: 'hp', X: 'hp', c: 'su', C: 'su' };
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (KEYMAP[k]) { if (e.repeat) held[KEYMAP[k]] = true; else press(KEYMAP[k]); }

  if (mode === 'title') {
    if (k === 'Enter' || k === ' ') startMatch();
    const n = ['1', '2', '3', '4'].indexOf(k);
    if (n >= 0) { M.save.setDiff(M.DIFF_ORDER[n]); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
  } else if (mode === 'play') {
    if (k === 'Escape') pause();
  } else if (mode === 'pause') {
    if (k === 'Escape' || k === 'Enter') resume();
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'result') {
    if (k === 'Enter' || k === ' ') resultPrimary();
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if ((k === 'Enter' || k === ' ') && endingT > 4.5) toTitle();
  }
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) held[KEYMAP[e.key]] = false; });
window.addEventListener('blur', () => { for (const k of Object.keys(held)) held[k] = false; });

function resultPrimary() {
  if (!st) return;
  if (st.winner === 0) startMatch(Math.min(M.LADDER.length - 1, st.stage + 1));
  else startMatch(st.stage);
}

$('btn-start').onclick = () => startMatch();
$('btn-fresh').onclick = () => { M.save.resetStage(M.diff); M.ui.refreshTitle(); startMatch(0); };
$('btn-series').onclick = () => { location.href = location.pathname.includes('/mogusketch/') ? '../index.html' : 'index.html'; };
$('btn-resume').onclick = () => resume();
$('btn-restart').onclick = () => startMatch(st ? st.stage : undefined);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => resultPrimary();
$('btn-win-title').onclick = () => toTitle();
$('btn-over-retry').onclick = () => resultPrimary();
$('btn-over-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();

// ── 터치 (설계 5-2절: 8방향 패드 + 약·강·잡기·필살·초필살) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = $('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').innerHTML = '왼쪽 패드로 이동·점프·앉기 · 약·강·잡기·필살 버튼<br>필살 버튼 = 냥파동, 패드 위+필살 = 발톱 연무 · 게이지가 차면 초필살';
  const pad = $('vdpad'), knob = $('vdpad-knob');
  let padId = null;
  const setDir = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const mag = Math.hypot(dx, dy);
    held.left = held.right = held.up = held.down = false;
    if (mag > 0.22) {
      const ang = Math.atan2(dy, dx);
      const sec = Math.round(ang / (Math.PI / 4));                 // 8방향
      const dirs = { 0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['left', 'down'], 4: ['left'], '-4': ['left'], '-3': ['left', 'up'], '-2': ['up'], '-1': ['right', 'up'] };
      for (const d of dirs[sec] || []) held[d] = true;
    }
    const kx = Math.max(-1, Math.min(1, dx)), ky = Math.max(-1, Math.min(1, dy));
    knob.style.transform = `translate(${kx * 28}px, ${ky * 28}px)`;
  };
  const clearDir = () => { padId = null; held.left = held.right = held.up = held.down = false; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); M.audio.resume(); padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (err) {} setDir(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) setDir(e); });
  pad.addEventListener('pointerup', clearDir);
  pad.addEventListener('pointercancel', clearDir);

  const bindHold = (id, on, off) => {
    const el = $(id);
    const down = (e) => { e.preventDefault(); e.stopPropagation(); M.audio.resume(); on(); el.classList.add('pressed'); };
    const up = () => { off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  };
  bindHold('vb-lp', () => { press('lp'); }, () => { held.lp = false; });
  bindHold('vb-hp', () => { press('hp'); }, () => { held.hp = false; });
  bindHold('vb-grab', () => { press('grab'); }, () => { held.grab = false; });
  bindHold('vb-sp', () => { if (held.up) press('sp2'); else press('sp1'); }, () => { held.sp1 = held.sp2 = false; });
  bindHold('vb-su', () => { press('su'); }, () => { held.su = false; });
  $('vb-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(); });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, diff: st ? st.diff : M.diff, phase: st ? st.phase : null,
  stage: st ? st.stage : null, round: st ? st.round : 0, wins: st ? st.wins.slice() : [0, 0],
  timer: st ? +st.timer.toFixed(2) : 0, segments: M.Render.stats.segments,
  p: st ? st.p.map((f) => ({ id: f.id, hp: f.hp, state: f.state, x: +f.x.toFixed(1), y: +f.y.toFixed(1), gauge: f.gauge, face: f.face, mv: f.mv ? f.mv.key : null })) : [],
  proj: st ? st.proj.length : 0, fx: M.Render.fx.length,
});
M._st = () => st;
M._ai = (on) => { M._aiOff = !on; };
M._worst = (on) => { worst = !!on; };
M._startEnding = () => { mode = 'ending'; endingT = 0; M.ui.hideAll(); };

// 설계 7절 최악 장면: 두 캐릭터 동시 공격 + 기탄 3 + 타격 효과 3 + 의성어 2 + 링 보조선
function keepWorstScene() {
  if (!st) return;
  st.timer = 60;
  for (const f of st.p) { f.hp = f.maxHp; }
  st.p[0].x = 420; st.p[1].x = 540;
  for (const f of st.p) {
    if (!f.mv) M.Logic.startMove(st, f, st.p[1 - f.side], f.side ? 'hp' : 'lp', []);
  }
  while (st.proj.length < 3) {
    const side = st.proj.length % 2;
    st.proj.push({ id: st.nextId++, owner: side, kind: side ? 'shuriken' : 'fireball', x: 200 + st.proj.length * 260, y: 150 + st.proj.length * 20, vx: 0, dmg: 0, band: 'mid', age: 0 });
  }
  const sparks = M.Render.fx.filter((e) => e.kind === 'spark').length;
  const texts = M.Render.fx.filter((e) => e.kind === 'text').length;
  for (let i = sparks; i < 3; i++) M.Render.fx.push({ kind: 'spark', x: 300 + i * 150, y: 300, t: 0, life: 0.5, ink: '#18181c', strong: true, seed: i + 1 });
  for (let i = texts; i < 2; i++) M.Render.fx.push({ kind: 'text', x: 360 + i * 240, y: 200, t: 0, life: 0.5, ink: '#d6282e', text: '쾅!', size: 46, rot: 0.1 });
}

// ── 메인 루프 ──
let last = performance.now();
const previewCv = $('title-preview');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const tsec = now / 1000;
  if (isTouch) {
    vpad.classList.toggle('on', mode === 'play');
    if (st) $('vb-su').classList.toggle('ready', st.p[0].gauge >= M.GAUGE_MAX);
  }
  $('rotate-hint').classList.toggle('hidden', !(isTouch && window.innerHeight > window.innerWidth));

  if (mode === 'title') {
    if (previewCv && previewCv.offsetParent) M.Render.drawPreview(previewCv, tsec);
    return;
  }
  if (mode === 'ending') {
    endingT += dt;
    M.Render.drawEnding(tsec, endingT);
    if (endingT > 4.5 && $('ending-screen').classList.contains('hidden')) M.ui.show('ending-screen');
    return;
  }
  if (!st) return;

  if (mode === 'play') {
    if (worst) keepWorstScene();
    const inp1 = M._aiOff ? {} : M.AI.think(ai, st, 1, dt);
    const inp0 = Object.assign({}, held);
    for (const k of Object.keys(tapped)) { inp0[k] = true; delete tapped[k]; }
    handleEvents(M.Logic.step(st, dt, [inp0, inp1]));
    if (st.phase === 'matchEnd') {
      resultT += dt;
      if (resultT > 1.4) {
        const lastStage = st.stage === M.LADDER.length - 1;
        if (st.winner === 0 && lastStage) { mode = 'ending'; endingT = 0; M.ui.hideAll(); }
        else { mode = 'result'; if (st.winner === 0) M.ui.showWin(st); else M.ui.showOver(st); }
      }
    }
  }
  M.Render.draw(st, tsec, mode === 'play' ? dt : 0);
}
requestAnimationFrame(frame);
