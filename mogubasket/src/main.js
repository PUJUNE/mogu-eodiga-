// main.js — 게임 루프 · 모드 전환 · 입력 (키보드 / 터치 스틱·버튼) · 이벤트 → 소리·알림·카메라
const M = window.MBK;
const $ = (id) => document.getElementById(id);
const A = M.audio;

let mode = 'title';            // title(뒤에서 시범 경기) | play | pause | result
let st = null, ai = null, demoAI = null;
const held = { up: false, down: false, left: false, right: false, shoot: false };
const edge = { act: false };
const stick = { x: 0, y: 0 };

M.save.load();
M.faceImg = new Image();
M.faceImg.onload = () => { M.ui.refreshTitle(); if (st) M.R3.setPlayers(st, M.faceImg); };
M.faceImg.src = M.ASSETS.mogu;
M.ui.init();
M.R3.init($('game'));
startDemo();
M.ui.show('title-screen');

function startDemo() {                       // 타이틀 뒤 시범 경기 — 컴퓨터끼리
  st = M.Logic.create((Date.now() & 0xffff) + 1, 'mogu', M.save.data.opp, 'normal');
  demoAI = [M.makeAI(st, 0), M.makeAI(st, 1)];
  M.R3.setPlayers(st, M.faceImg);
  $('hud').classList.add('hidden');
}

function startMatch() {
  const S = M.save.data;
  st = M.Logic.create((Date.now() & 0x7fffffff) || 1, S.my, S.opp, M.diff);
  ai = M.makeAI(st, 1); demoAI = null;
  M.R3.setPlayers(st, M.faceImg);
  for (const k in held) held[k] = false;
  mode = 'play';
  M.ui.hideAll(); M.ui.setupHud(st); M.ui.hud(st);
  $('hud').classList.remove('hidden');
  M.ui.msg(`VS ${st.pl[1].P.name}`, st.pl[1].P.line, false, 1.8);
  A.resume(); A.meow(); A.beatStart();
}
function toTitle() {
  mode = 'title'; A.beatStop();
  M.ui.refreshTitle(); M.ui.show('title-screen');
  $('meter').classList.add('hidden');
  startDemo();
}
function pause() { if (mode !== 'play') return; mode = 'pause'; A.beatStop(); M.ui.show('pause-screen'); }
function resume() { mode = 'play'; M.ui.hideAll(); A.beatStart(); }
function goNext() {
  const i = M.LADDER.indexOf(M.save.data.opp);
  if (M.LADDER[i + 1] && M.save.oppOpen(M.LADDER[i + 1])) { M.save.data.opp = M.LADDER[i + 1]; M.save.store(); }
  startMatch();
}

function handleEvents(evs) {
  const play = mode === 'play';
  const me = (i) => i === 0;
  for (const e of evs) {
    switch (e.type) {
      case 'check': if (play) { A.whistle(); M.ui.hint(e.off === 0 ? '🏀 내 공격 — 체크!' : '🛡 수비 — 공을 막아라', 1.3); } break;
      case 'cross': if (play) A.squeak(); break;
      case 'ankle':
        if (play) { A.ankle(); M.ui.msg('앵클 브레이크!', me(e.by) ? `${st.pl[e.idx].P.name}가 넘어졌다` : '넘어졌다… 일어나!', !me(e.by)); }
        M.R3.cam.shake = 0.2; break;
      case 'release': if (play) A.release(); break;
      case 'meter':
        if (play && me(e.idx)) M.ui.hint(e.q >= 1 ? '✨ 굿 릴리스!' : e.m < M.SWEET[0] ? '조금 빨랐어요 (초록에서 떼기)' : '조금 늦었어요 (초록에서 떼기)', 1.3);
        break;
      case 'rim': if (play) A.rim(); break;
      case 'board': if (play) A.board(); break;
      case 'bounce': if (play) A.bounce(e.v); break;
      case 'score':
        M.R3.netSway = 1;
        if (play) {
          if (e.kind !== 'dunk') A.swish();
          A.score(e.pts);
          M.ui.msg(`+${e.pts}${e.pts === 2 ? ' 2점슛!' : ''}`, `${st.pl[e.idx].P.name} ${e.total[0]} : ${e.total[1]}`, !me(e.idx), 1.3);
          if (e.kind !== 'dunk') M.R3.cinematic('score', 0.9);
        }
        break;
      case 'dunk-start': M.R3.cinematic('dunk', 1.5); break;
      case 'dunk': if (play) { A.dunk(); M.ui.msg('덩크!!', st.pl[e.idx].P.name, !me(e.idx), 1.3); } M.R3.cam.shake = 0.35; break;
      case 'dunk-miss': if (play) M.ui.msg('림을 맞고 튕겼다!', '', !me(e.idx)); break;
      case 'block': if (play) { A.block(); M.ui.msg('블록!', st.pl[e.idx].P.name, !me(e.idx)); } M.R3.cinematic('score', 0.6); break;
      case 'steal': if (play) { A.steal(); M.ui.msg('스틸!', st.pl[e.idx].P.name, !me(e.idx)); } break;
      case 'turnover': if (play && me(e.idx) && !e.cleared) M.ui.hint('공을 잡았다! 2점 라인 밖으로 빼야 슛할 수 있어요', 2.4); break;
      case 'need-clear': if (play && me(e.idx)) { A.oops(); M.ui.hint('먼저 2점 라인(깜빡이는 노란 선) 밖으로!', 2.0); } break;
      case 'cleared': if (play && me(e.idx)) M.ui.hint('클리어! 이제 슛할 수 있어요', 1.2); break;
      case 'violation': if (play) { A.buzzer(); M.ui.msg('샷 클락 바이얼레이션', '12초 안에 슛!', me(e.idx)); } break;
      case 'win': if (play) { if (me(e.idx)) A.win(); else A.lose(); } break;
      case 'over':
        if (play) {
          M.save.record(st.pl[1].key, st.diff, e.winner === 0, st.score);
          setTimeout(() => { if (mode === 'play') { mode = 'result'; M.ui.showResult(st); $('meter').classList.add('hidden'); } }, 300);
        } else if (demoAI) setTimeout(() => { if (mode === 'title') startDemo(); }, 600);
        break;
    }
  }
}

// ── 키보드 (글자 키는 자판 위치로 — 한글 입력 상태에서도 동작) ──
const keyOf = (e) => {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (e.code === 'Space') return ' ';
  return e.key;
};
const MOVE = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
window.addEventListener('keydown', (e) => {
  A.resume();
  const k = keyOf(e);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (MOVE[k]) held[MOVE[k]] = true;
  if (mode === 'title') {
    if (k === 'Enter') startMatch();
    const n = '1234'.indexOf(k);
    if (n >= 0) { M.save.data.diff = M.diff = M.DIFF_ORDER[n]; M.save.store(); M.ui.refreshTitle(); }
  } else if (mode === 'play') {
    if (k === ' ' || k === 'j') held.shoot = true;
    if ((k === 'x' || k === 'k') && !e.repeat) edge.act = true;
    if (k === 'Escape' || k === 'p') pause();
  } else if (mode === 'pause') {
    if (k === 'Escape' || k === 'Enter' || k === 'p') resume();
    if (k === 'r') startMatch();
  } else if (mode === 'result') {
    if (k === 'Enter') { if ($('btn-next').style.display !== 'none') goNext(); else startMatch(); }
    if (k === 'r') startMatch();
    if (k === 'Escape') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  const k = keyOf(e);
  if (MOVE[k]) held[MOVE[k]] = false;
  if (k === ' ' || k === 'j') held.shoot = false;
});
window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

$('btn-start').onclick = () => startMatch();
$('btn-series').onclick = () => { location.href = location.pathname.includes('/mogubasket/') ? '../index.html' : 'index.html'; };
$('btn-resume').onclick = () => resume();
$('btn-restart').onclick = () => startMatch();
$('btn-title').onclick = () => toTitle();
$('btn-retry').onclick = () => startMatch();
$('btn-res-title').onclick = () => toTitle();
$('btn-next').onclick = () => goNext();

// ── 터치 ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = $('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').innerHTML = '왼쪽 스틱 이동 · <b>슛 버튼 꾹 눌렀다 떼기</b>(게이지 초록에서) · 골밑에서 달려들며 슛 = 덩크<br>' +
    '<b>크로스/스틸</b> = 공 있으면 크로스오버, 없으면 스틸 · 수비 때 슛 버튼 = 점프 블록<br>2점 라인 안 1점 · 밖 2점 · 공을 뺏으면 라인 밖으로 빼고 슛';
  const pad = $('vstick'), knob = $('vstick-knob');
  let padId = null;
  const setDir = (e) => {
    const r = pad.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = m < 0.18 ? 0 : dx; stick.y = m < 0.18 ? 0 : dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  };
  const clearDir = () => { padId = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); A.resume(); padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (err) {} setDir(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) setDir(e); });
  pad.addEventListener('pointerup', clearDir); pad.addEventListener('pointercancel', clearDir);
  const bind = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.resume(); on(); el.classList.add('pressed'); });
    const up = () => { if (off) off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  bind('vb-shoot', () => { held.shoot = true; }, () => { held.shoot = false; });
  bind('vb-act', () => { edge.act = true; });
  $('vb-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(); });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._st = () => st;
M._dbg = () => ({ mode, phase: st && st.phase, score: st && st.score.slice(), off: st && st.off, holder: st && st.ball.holder,
  me: st && { x: +st.pl[0].x.toFixed(2), y: +st.pl[0].y.toFixed(2), state: st.pl[0].state }, cleared: st && st.cleared });
M._ai = () => ai;

// ── 메인 루프 ──
let last = performance.now();
const ui = { onDribble: () => { if (mode === 'play') A.dribble(); } };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) {
    vpad.classList.toggle('on', mode === 'play');
    $('rotate-hint').classList.toggle('hidden', !(window.innerHeight > window.innerWidth));
  }
  if (!st) return;
  if (mode === 'play') {
    const inp0 = {
      mx: (held.right ? 1 : 0) - (held.left ? 1 : 0) + stick.x,
      my: (held.down ? 1 : 0) - (held.up ? 1 : 0) + stick.y,
      shoot: held.shoot, act: edge.act,
    };
    edge.act = false;
    handleEvents(M.Logic.step(st, dt, [inp0, M._freezeAI ? {} : ai()]));   // _freezeAI = 테스트에서 상대를 세워 둘 때
    M.ui.hud(st); M.ui.meter(st);
  } else if (mode === 'title' && demoAI) {
    handleEvents(M.Logic.step(st, dt, [demoAI[0](), demoAI[1]()]));
  }
  M.R3.draw(st, mode === 'pause' ? 0 : dt, ui);
}
requestAnimationFrame(frame);
