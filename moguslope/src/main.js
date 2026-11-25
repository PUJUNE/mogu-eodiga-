// main.js — 화면 흐름 · 입력(키보드·끌기·터치) · 고정 시간 간격 루프
// 화면: title(봇 시연) → ready(3·2·1) → play → result / pause
const M = window.MSL;
const $ = (id) => document.getElementById(id);
const R = M.R3, A = M.audio, U = M.ui, S = M.save;
const DT = 1 / 60;

let mode = 'title', run = null, bot = null, demo = null, demoBot = null, countT = 0, lastBeep = 0;
let diff = 'normal';
const keys = {};
let jumpEdge = false;
const drag = { on: false, id: null, x0: 0, y0: 0, t0: 0, u0: 0, x: 0, moved: false, airX: 0, target: null };

// ══ 시작 ══
const data = S.load();
diff = M.DIFFS[data.diff] ? data.diff : 'normal';
const faceImg = new Image();
faceImg.onload = boot;
faceImg.src = M.ASSETS.mogu;

function boot() {
  R.init($('game'), faceImg);
  startDemo();
  pickDiff(diff);
  requestAnimationFrame(frame);
}

function startDemo() {
  demo = M.Run.create('normal', 'endless', 77);
  demoBot = M.makeBot(demo, 1);
  R.setRun(demo);
}

function pickDiff(d) {
  diff = d; S.data.diff = d; S.save();
  document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('selected', b.dataset.diff === d));
  if (U.sel !== 'endless' && !S.unlocked(U.sel)) U.sel = 0;
  U.courseList(d);
}

function showTitle() {
  mode = 'title';
  for (const id of ['hud', 'result-screen', 'pause-screen', 'count']) $(id).classList.add('hidden');
  $('title-screen').classList.remove('hidden');
  U.courseList(diff);
  startDemo();
  A.slide(0, true); A.bgm('title');
}

function startRun(course) {
  A.resume();
  U.sel = course;
  run = M.Run.create(diff, course);
  bot = null;
  R.setRun(run);
  for (const id of ['title-screen', 'result-screen', 'pause-screen']) $(id).classList.add('hidden');
  U.hudStart(run);
  mode = 'ready'; countT = 3; lastBeep = 4;
  $('count').classList.remove('hidden');
  A.stopBgm();
  Object.keys(keys).forEach((k) => { keys[k] = false; });
  drag.on = false;
}

function finishRun() {
  mode = 'result';
  A.slide(0, true);
  const isNew = S.submit(run);
  $('hud').classList.add('hidden');
  U.result(run, isNew);
}

function pause(on) {
  if (on && mode === 'play') { mode = 'pause'; $('pause-screen').classList.remove('hidden'); A.slide(0, true); A.stopBgm(); }
  else if (!on && mode === 'pause') { mode = 'play'; $('pause-screen').classList.add('hidden'); A.bgm('ride'); }
}

// ══ 이벤트 → 소리 · 글자 ══
function onEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'fish': A.fish(); U.bump('fishbox'); break;
      case 'heart': A.heart(); U.msg('❤ +1', '', 600); break;
      case 'jump': A.jump(); break;
      case 'ramp': A.ramp(); break;
      case 'land': A.land(); break;
      case 'trick': A.trick(e.n); U.msg(`${e.n * 360}°!<span class="s">+${e.pts}점 · 부스트</span>`, 'blue', 1000); break;
      case 'wipeout': U.msg('꽈당!<span class="s">한 바퀴를 다 못 돌았어요</span>', 'red', 1000); break;
      case 'crash': A.crash(); A.meow(); if (e.kind !== 'wipeout') U.msg('쿵!<span class="s">' + (M.OBST[e.kind] ? M.OBST[e.kind].name : '') + '</span>', 'red', 800); break;
      case 'boost': A.boost(); U.msg('부스트!', '', 600); break;
      case 'finish': A.finish(); U.msg('🏁 결승!', '', 1600); break;
      case 'over': A.over(); U.msg('넘어졌다…', 'red', 1600); break;
      case 'done': finishRun(); break;
    }
  }
}

// ══ 입력 ══
function steerInput() {
  let s = 0;
  if (keys.left) s -= 1;
  if (keys.right) s += 1;
  if (drag.on) {
    if (run.air) s = Math.max(-1, Math.min(1, (drag.x - drag.airX) / 50));
    else {
      const half = M.Prof.half(run.track.frame(run.s).prof);
      drag.target = Math.max(-half, Math.min(half, drag.u0 + (drag.x - drag.x0) / Math.min(window.innerWidth, 700) * half * 2.4));
      s = Math.max(-1, Math.min(1, (drag.target - run.u) * 1.5 - run.uv * 0.3));
    }
  }
  return s;
}

const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (mode === 'play') jumpEdge = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') pause(true); else if (mode === 'pause') pause(false); }
  if (e.code === 'Enter') {
    if (mode === 'title') startSelected();
    else if (mode === 'result') startRun(U.sel);
    else if (mode === 'pause') pause(false);
  }
  if (mode === 'title' && /^Digit[1-6]$/.test(e.code)) {
    const n = +e.code.slice(5) - 1, c = n === 5 ? 'endless' : n;
    if (c === 'endless' || S.unlocked(c)) { U.sel = c; U.courseList(diff); A.resume(); A.click(); }
  }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => { keys[k] = false; }); drag.on = false; });

const cv = $('game');
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  drag.on = true; drag.id = e.pointerId; drag.x0 = drag.x = e.clientX; drag.y0 = e.clientY; drag.t0 = performance.now();
  drag.u0 = run.u; drag.moved = false; drag.airX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (!drag.on || e.pointerId !== drag.id) return;
  drag.x = e.clientX;
  if (Math.abs(e.clientX - drag.x0) > 12 || Math.abs(e.clientY - drag.y0) > 12) drag.moved = true;
  if (drag.y0 - e.clientY > 50 && performance.now() - drag.t0 < 350 && !run.air) { jumpEdge = true; drag.y0 = -9999; }   // 위로 쓸면 점프
});
window.addEventListener('pointerup', (e) => {
  if (!drag.on || e.pointerId !== drag.id) return;
  if (!drag.moved && performance.now() - drag.t0 < 250 && mode === 'play') jumpEdge = true;   // 톡 치면 점프
  drag.on = false;
});
window.addEventListener('pointercancel', () => { drag.on = false; });
$('btn-jump').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (mode === 'play') jumpEdge = true; });

// 버튼
document.querySelectorAll('.diff-btn').forEach((b) => b.addEventListener('click', () => { A.resume(); A.click(); pickDiff(b.dataset.diff); }));
$('courses').addEventListener('click', (e) => {
  const b = e.target.closest('.course'); if (!b) return;
  const c = b.dataset.c === 'endless' ? 'endless' : +b.dataset.c;
  if (c !== 'endless' && !S.unlocked(c)) return;
  A.resume(); A.click();
  if (U.sel === c) startRun(c);            // 같은 코스를 한 번 더 누르면 출발
  else { U.sel = c; U.courseList(diff); }
});
function startSelected() { startRun(U.sel); }
$('btn-start').onclick = startSelected;
$('btn-retry').onclick = () => startRun(U.sel);
$('btn-next').onclick = () => startRun(U.sel + 1);
$('btn-menu').onclick = showTitle;
$('btn-quit').onclick = showTitle;
$('btn-resume').onclick = () => pause(false);
$('btn-pause').onclick = () => pause(true);
$('btn-mute').onclick = () => { const m = A.toggleMute(); $('btn-mute').textContent = m ? '🔇 소리 꺼짐' : '🔊 소리'; };
$('btn-series').onclick = () => { location.href = location.pathname.includes('/moguslope/') ? '../index.html' : 'index.html'; };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  $('ctl-hint').textContent = '좌우로 끌어 조향 · 톡/⤴ 점프 · 공중에서 끌면 빙글';
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

// ══ 루프 ══
let last = performance.now(), acc = 0, lastDraw = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;

  if (mode === 'play') {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 5) {
      const inp = bot ? bot(DT) : { steer: steerInput(), jump: jumpEdge };
      jumpEdge = false;
      const wasAir = run.air;
      const evs = M.Run.step(run, DT, inp);
      if (!wasAir && run.air) drag.airX = drag.x;
      R.update(run, DT, evs);
      onEvents(evs);
      acc -= DT; n++;
      if (mode !== 'play') break;
    }
    if (acc > DT * 5) acc = 0;
    if (mode === 'play' || mode === 'result') {
      U.hud(run);
      A.slide(run.v, run.air, run.track.frame(run.s).zone);
    }
    R.render();
    return;
  }

  if (mode === 'ready') {
    countT -= dt;
    const c = Math.ceil(countT);
    if (c !== lastBeep && c >= 1) { lastBeep = c; A.beep(false); $('count').textContent = c; }
    if (countT <= 0) {
      mode = 'play'; A.beep(true); $('count').textContent = '출발!';
      setTimeout(() => $('count').classList.add('hidden'), 600);
      A.bgm('ride'); acc = 0;
    }
    R.update(run, dt * 0, []);
    R.render();
    return;
  }

  // 타이틀 · 결과 · 쉬기: 초당 20번만 그린다 (발열 방지)
  if (now - lastDraw < 50) return;
  const step = (now - lastDraw) / 1000; lastDraw = now;
  if (mode === 'title') {
    const d = Math.min(0.1, step);
    for (let t = 0; t < d; t += DT) {
      const evs = M.Run.step(demo, DT, demoBot(DT));
      R.update(demo, DT, evs);
    }
    if (demo.phase !== 'run' || demo.s > 3000) startDemo();
    R.render();
  } else if (mode === 'result') {
    R.render();
  }
}

// 시험용
M._dbg = () => ({ mode, sel: U.sel, diff, s: run ? run.s : 0, u: run ? run.u : 0, v: run ? run.v : 0, air: run ? run.air : false, hearts: run ? run.hearts : 0, fish: run ? run.fish : 0, phase: run ? run.phase : null, chunks: R.chunks.size });
M._run = () => run;
M._autopilot = (on) => { bot = on && run ? M.makeBot(run, 1) : null; };
