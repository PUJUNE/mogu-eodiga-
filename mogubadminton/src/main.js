// main.js — 게임 루프 · 모드 전환 · 입력 (키보드 / 터치 스틱·버튼) · 이벤트 → 소리·알림
const M = window.MBD;
const $ = (id) => document.getElementById(id);
const A = M.audio;

let mode = 'title';            // title(뒤에서 시범 경기) | play | pause | result
let st = null, ai = null, demoAI = null;
const held = { up: false, down: false, left: false, right: false };
const edge = { strong: false, soft: false };
const stick = { x: 0, y: 0 };

M.save.load();
M.faceImg = new Image();
M.faceImg.onload = () => { M.ui.refreshTitle(); if (st) M.R3.setPlayers(st, M.faceImg); };
M.faceImg.src = M.ASSETS.mogu;
M.ui.init();
M.R3.init($('game'));
startDemo();
M.ui.show('title-screen');

function startDemo() {
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
function toTitle() { mode = 'title'; A.beatStop(); M.ui.refreshTitle(); M.ui.show('title-screen'); startDemo(); }
function pause() { if (mode !== 'play') return; mode = 'pause'; A.beatStop(); M.ui.show('pause-screen'); }
function resume() { mode = 'play'; M.ui.hideAll(); A.beatStart(); }
function goNext() {
  const i = M.LADDER.indexOf(M.save.data.opp);
  if (M.LADDER[i + 1] && M.save.oppOpen(M.LADDER[i + 1])) { M.save.data.opp = M.LADDER[i + 1]; M.save.store(); }
  startMatch();
}

const WHY = { in: '인!', out: '아웃!', net: '네트!', own: '넘기지 못했다' };
function handleEvents(evs) {
  const play = mode === 'play';
  for (const e of evs) {
    switch (e.type) {
      case 'serve-ready':
        if (play && e.server === 0) M.ui.hint('내 서브 — Space 하이 서브 · X 숏 서브', 1.8);
        break;
      case 'hit':
        if (play) { if (e.shot === 'smash') { A.smash(); M.R3.cam.shake = 0.15; } else A.hit(e.spd); }
        if (play && e.shot === 'smash') M.ui.msg('스매시!', st.pl[e.idx].P.name, e.idx !== 0, 0.8);
        else if (play && e.shot === 'net' && e.idx === 0) M.ui.hint('헤어핀', 0.8);
        break;
      case 'swing': if (play) A.swish(); break;
      case 'net': if (play) A.net(); M.R3.netShake = 1; break;
      case 'point':
        if (play) {
          A.land(); A.point(e.won === 0);
          if (e.rally >= 10) A.clap();
          const who = st.pl[e.won].P.name;
          M.ui.msg(`${e.score[0]} : ${e.score[1]}`, `${WHY[e.why]} ${who} 득점` + (e.rally >= 8 ? ` · ${e.rally}타 랠리` : ''), e.won !== 0, 1.2);
        }
        break;
      case 'auto-serve': if (play && e.idx === 0) M.ui.hint('너무 오래 기다려서 자동 서브', 1.4); break;
      case 'win': if (play) { if (e.idx === 0) A.win(); else A.lose(); } break;
      case 'over':
        if (play) {
          M.save.record(st.pl[1].key, st.diff, e.winner === 0, st.score);
          setTimeout(() => { if (mode === 'play') { mode = 'result'; M.ui.showResult(st); } }, 300);
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
    if (e.repeat) return;
    if (k === ' ' || k === 'j') edge.strong = true;
    if (k === 'x' || k === 'k') edge.soft = true;
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
window.addEventListener('keyup', (e) => { const k = keyOf(e); if (MOVE[k]) held[MOVE[k]] = false; });
window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

$('btn-start').onclick = () => startMatch();
$('btn-series').onclick = () => { location.href = location.pathname.includes('/mogubadminton/') ? '../index.html' : 'index.html'; };
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
  $('title-hint').innerHTML = '왼쪽 스틱 이동 · <b>노란 고리 = 셔틀이 떨어질 자리</b><br>' +
    '<b>강타</b> = 높으면 스매시 · 낮으면 리프트 / <b>연타</b> = 드롭·헤어핀 · 칠 때 스틱을 좌우로 기울이면 그쪽으로<br>서브: 강타 하이 서브 · 연타 숏 서브';
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
  const bind = (id, on) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.resume(); on(); el.classList.add('pressed'); });
    const up = () => el.classList.remove('pressed');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  bind('vb-shoot', () => { edge.strong = true; });
  bind('vb-act', () => { edge.soft = true; });
  $('vb-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(); });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._st = () => st;
M._dbg = () => ({ mode, phase: st && st.phase, score: st && st.score.slice(), server: st && st.server, held: st && st.sh.held,
  me: st && { x: +st.pl[0].x.toFixed(2), y: +st.pl[0].y.toFixed(2), swing: !!st.pl[0].swing } });

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));   // 첫 프레임은 now 가 last 보다 앞설 수 있다
  last = now;
  if (isTouch) {
    vpad.classList.toggle('on', mode === 'play');
    $('rotate-hint').classList.toggle('hidden', !(window.innerHeight > window.innerWidth));
  }
  if (!st) return;
  if (mode === 'play') {
    const mx = (held.right ? 1 : 0) - (held.left ? 1 : 0) + stick.x;
    const my = (held.down ? 1 : 0) - (held.up ? 1 : 0) + stick.y;
    // 조준: 치는 순간 좌우로 누르고 있던 쪽 (상대 코트에서 보면 반대가 아니라 화면 그대로)
    const aim = mx > 0.3 ? 1 : mx < -0.3 ? -1 : 0;
    const inp0 = { mx, my, strong: edge.strong, soft: edge.soft, aim };
    edge.strong = edge.soft = false;
    handleEvents(M.Logic.step(st, dt, [inp0, M._freezeAI ? {} : ai()]));   // _freezeAI = 테스트에서 상대를 세워 둘 때
    M.ui.hud(st);
  } else if (mode === 'title' && demoAI) {
    handleEvents(M.Logic.step(st, dt, [demoAI[0](), demoAI[1]()]));
  }
  M.R3.draw(st, mode === 'pause' ? 0 : dt);
}
requestAnimationFrame(frame);
