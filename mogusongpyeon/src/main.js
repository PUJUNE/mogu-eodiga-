// main.js — 게임 루프 + 모드 전환 + 입력 (키보드 / 터치 조이스틱·버튼)
const M = window.MSP;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | result
let st = null;
let tipIdx = 0, tipAt = 0;
const held = { up: false, down: false, left: false, right: false, work: false };
const edge = { grab: false, dash: false };
const stick = { x: 0, y: 0 };

M.save.load();
M.ui.init();
M.Render.init($('game'));
M.ui.show('title-screen');
// 타이틀 뒤에 1호점 주방을 깔아 둔다
st = M.Logic.create(1, M.stage, M.diff);

function startRun() {
  st = M.Logic.create((Date.now() & 0x7fffffff) || 1, M.stage, M.diff);
  M.Render.reset();
  for (const k in held) held[k] = false;
  mode = 'play';
  M.ui.hideAll();
  tipIdx = 0; tipAt = 2.2;
  M.Render.pop(M.W / 2, M.HUD + 250, `${M.stage + 1}호점 「${st.S.name}」 영업 시작!`, '#fff3d6', 30, 2);
  M.audio.resume(); M.audio.meow(); M.audio.bgmFast = false; M.audio.bgmStart();
}
function toTitle() {
  mode = 'title';
  M.audio.bgmStop();
  M.ui.refreshTitle();
  st = M.Logic.create(1, M.stage, M.diff);
  M.ui.show('title-screen');
}
function pause() { if (mode !== 'play') return; mode = 'pause'; M.audio.bgmStop(); M.ui.show('pause-screen'); }
function resume() { mode = 'play'; M.ui.hideAll(); M.audio.bgmStart(); }
function goNext() {
  if (M.stage < M.STAGES.length - 1 && M.save.unlocked(M.stage + 1)) M.save.setStage(M.stage + 1);
  startRun();
}

function finish() {
  if (st.recorded) return;
  st.recorded = true;
  const stars = M.Logic.starsOf(st);
  const isBest = M.save.record(st.stage, st.diff, st.score, stars);
  setTimeout(() => {
    if (mode !== 'play') return;
    mode = 'result';
    const n = M.ui.showResult(st, isBest);
    for (let i = 0; i < n; i++) setTimeout(() => M.audio.star(i), 250 + i * 260);
  }, 1300);
}

function handleEvents(evs) {
  const A = M.audio;
  for (const e of evs) {
    M.Render.event(e, st);
    switch (e.type) {
      case 'pick': A.pick(); break;
      case 'place': A.place(); break;
      case 'bump': A.bump(); break;
      case 'knead': A.knead(); break;
      case 'skin-done': case 'fold-done': A.done(); break;
      case 'fill': A.fill(); break;
      case 'steam-in': A.steamIn(); break;
      case 'cooked': A.cooked(); break;
      case 'burnt': A.burnt(); break;
      case 'serve': A.serve(); break;
      case 'wrong': case 'need-plate': A.wrong(); break;
      case 'miss': A.miss(); break;
      case 'order': A.order(); break;
      case 'kiwi-in': A.kiwiIn(); break;
      case 'peck': A.peck(); break;
      case 'shoo': A.shoo(); break;
      case 'dash': A.dash(); break;
      case 'trash': A.trash(); break;
      case 'hurry': A.hurry(); M.Render.pop(M.W / 2, M.HUD + 250, '마감 30초 전!', '#ff9a6a', 30); break;
      case 'end': A.end(); M.Render.pop(M.W / 2, M.HUD + 250, '영업 종료!', '#fff3d6', 40); finish(); break;
    }
  }
}

// ── 키보드 ──
const KEYMAP = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  k: 'work', K: 'work', x: 'work', X: 'work', Control: 'work',
};
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (KEYMAP[k]) held[KEYMAP[k]] = true;

  if (mode === 'title') {
    if (k === 'Enter' || k === ' ') startRun();
    const n = '1234'.indexOf(k);
    if (n >= 0) { M.save.setDiff(M.DIFF_ORDER[n]); M.ui.refreshTitle(); }
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const i = M.stage + (k === 'ArrowRight' ? 1 : -1);
      if (i >= 0 && i < M.STAGES.length) { M.save.setStage(i); M.ui.refreshTitle(); }
    }
  } else if (mode === 'play') {
    if (e.repeat) return;
    if (k === ' ' || k === 'j' || k === 'J' || k === 'z' || k === 'Z') edge.grab = true;
    if (k === 'Shift' || k === 'l' || k === 'L' || k === 'c' || k === 'C') edge.dash = true;
    if (k === 'Escape' || k === 'p' || k === 'P') pause();
    if (k === 'r' || k === 'R') startRun();
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape' || k === ' ' || k === 'p' || k === 'P') resume();
    if (k === 'r' || k === 'R') startRun();
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'result') {
    if (k === 'Enter') { if ($('btn-next').style.display !== 'none') goNext(); else startRun(); }
    if (k === 'r' || k === 'R') startRun();
    if (k === 'Escape') toTitle();
  }
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) held[KEYMAP[e.key]] = false; });
window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

$('btn-start').onclick = () => startRun();
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogusongpyeon/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => resume();
$('btn-restart').onclick = () => startRun();
$('btn-title').onclick = () => toTitle();
$('btn-retry').onclick = () => startRun();
$('btn-res-title').onclick = () => toTitle();
$('btn-next').onclick = () => goNext();

// ── 터치 ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = $('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').innerHTML = '<b>반죽</b> → <b>도마</b>에서 빚기 → <b>소</b> 얹기 → 다시 빚기 → <b>솔잎 찜기</b> → <b>접시</b> → <b>출하</b><br>' +
    '왼쪽 스틱 이동 · 집기 = 집기/놓기 · 빚기 = 꾹 누르고 있기 · 대시<br>🥝 키위는 몸으로 부딪쳐 쫓아내요!';
  const pad = $('vstick'), knob = $('vstick-knob');
  let padId = null;
  const setDir = (e) => {
    const r = pad.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    stick.x = m < 0.18 ? 0 : dx; stick.y = m < 0.18 ? 0 : dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  };
  const clearDir = () => { padId = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); M.audio.resume(); padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (err) {} setDir(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) setDir(e); });
  pad.addEventListener('pointerup', clearDir);
  pad.addEventListener('pointercancel', clearDir);

  const bind = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); M.audio.resume(); on(); el.classList.add('pressed'); });
    const up = () => { if (off) off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  bind('vb-grab', () => { edge.grab = true; });
  bind('vb-work', () => { held.work = true; }, () => { held.work = false; });
  bind('vb-dash', () => { edge.dash = true; });
  $('vb-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(); });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, stage: st ? st.stage : M.stage, diff: st ? st.diff : M.diff, phase: st ? st.phase : null,
  t: st ? +st.t.toFixed(2) : 0, score: st ? st.score : 0, orders: st ? st.orders.length : 0,
  held: st && st.p.held ? st.p.held.t : null, px: st ? Math.round(st.p.x) : 0, py: st ? Math.round(st.p.y) : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) {
    vpad.classList.toggle('on', mode === 'play');
    $('rotate-hint').classList.toggle('hidden', !(window.innerHeight > window.innerWidth));
  }
  if (st && mode === 'play') {
    const mx = (held.right ? 1 : 0) - (held.left ? 1 : 0) + stick.x;
    const my = (held.down ? 1 : 0) - (held.up ? 1 : 0) + stick.y;
    handleEvents(M.Logic.step(st, dt, { mx, my, grab: edge.grab, dash: edge.dash, work: held.work }));
    edge.grab = edge.dash = false;
    // 1호점 안내 — 처음 몇 번은 공정을 순서대로 띄운다
    if (st.S.tips && tipIdx < st.S.tips.length && st.t >= tipAt) {
      M.Render.pop(M.W / 2, M.HUD + 200, st.S.tips[tipIdx], '#fff3d6', 22, 3.4);
      tipIdx++; tipAt = st.t + 3.2;
    }
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
