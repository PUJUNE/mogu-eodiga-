// main.js — 게임 루프 + 상태 머신 + 마우스 앵커 입력 (모구레이스 문법)
// 기준점은 준비 화면에서 클릭한 지점. 이후 페달·핸들은 전부 그 점 대비 절대 위치.
const M = window.MPK;
const $ = (id) => document.getElementById(id);

let mode = 'title';                 // title | map | run | replay | result | pause
let st = null;
let endDelay = 0;                   // 종료 → 리플레이 전 정지 화면 (복기 예열)

const input = { active: false, shift: 0, gearTo: 0, look: 0, shoulder: 0, w: 0, h: 0, refX: 0, refY: 0, x: 0, y: 0 };
const LOOK_HOLD_MS = 700;        // 터치: 이만큼 계속 누르면 미러 확인 → 어깨너머로 넘어간다
let refSet = false;
const lookKeys = new Set();

// ── 미러 조절 ──────────────────────────────────────────────────────────
// 실제 차처럼 좌/우/룸 미러를 골라 상하좌우로 겨눈다. 고른 미러 쪽으로 고개가
// 고정되어 보면서 맞출 수 있고, 조절값은 세이브에 남아 다음 판에도 유지된다.
const MIRROR_CYCLE = ['left', 'right', 'room'];
const MIRROR_LABEL = { left: '좌측', right: '우측', room: '룸' };
const MIRROR_STEP = 0.055;       // 한 번 누를 때 움직이는 각도 (rad)
let adjust = null;               // null | 'left' | 'right' | 'room'
let adjustDrag = null;           // 터치·마우스 드래그로 겨눌 때의 시작점

function nudgeMirror(dyaw, dpitch) {
  if (!adjust) return;
  const a = M.mirrorAdj[adjust], lim = M.MIRROR_ADJ_MAX;
  a.yaw = Math.min(lim.yaw, Math.max(-lim.yaw, a.yaw + dyaw));
  a.pitch = Math.min(lim.pitch, Math.max(-lim.pitch, a.pitch + dpitch));
  M.save.storeMirror();
}
function setAdjust(k) {
  adjust = k;
  input.look = 0; input.shoulder = 0; lookKeys.clear();
  if (k) input.active = false;                                  // 조절 중엔 드래그가 페달·핸들로 안 읽히게
  adjustDrag = null;
  M.ui.hudAdjust(k, k ? MIRROR_LABEL[k] : '');
}
function cycleAdjust() {
  const i = adjust ? MIRROR_CYCLE.indexOf(adjust) : -1;
  setAdjust(i + 1 < MIRROR_CYCLE.length ? MIRROR_CYCLE[i + 1] : null);
}
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

M.save.load();
M.save.loadMirror();
if (M.DIFF_ORDER.includes(M.save.data.diff)) M.diff = M.save.data.diff;
M.ui.init();
M.Render.init($('app'));
M.ui.show('title-screen');

function syncSize() { input.w = window.innerWidth; input.h = window.innerHeight; }
syncSize();
window.addEventListener('resize', syncSize);

// 기준점은 위(엑셀)·아래(브레이크) 여유가 남도록 클램프
function setRef(x, y) {
  input.refX = Math.min(Math.max(x, input.w * 0.18), input.w * 0.82);
  input.refY = Math.min(Math.max(y, input.h * 0.34), input.h * 0.78);
  input.x = x; input.y = y;
  input.active = true;
  refSet = true;
}

function goMap() {
  mode = 'map';
  M.audio.engineOff();
  M.ui.buildMap();
  M.ui.show('map-screen');
  $('hud').classList.add('hidden');
  $('ready-overlay').classList.add('hidden');
}

function startStage(no) {
  st = M.Logic.create(no);
  mode = 'run';
  endDelay = 0;
  input.active = false; input.shift = 0; input.gearTo = 0; input.look = 0; input.shoulder = 0;
  refSet = false; lookKeys.clear();
  setAdjust(null);
  M.ui.hideAll();
  $('hud').classList.remove('hidden');
  $('ready-overlay').classList.remove('hidden');
  M.ui.hudRun(st);
  M.Render.setStage(st.stage);
  M.audio.resume(); M.audio.engineOn(); M.audio.meow();
}

M.ui.onStageClick = (no) => startStage(no);

function toReplay() {
  mode = 'replay';
  M.audio.engineOff();
  $('hud').classList.add('hidden');
  M.Render.startReplay(st);
}

function finishRun() {
  const isBest = M.save.record(st.no, st.stars, st.elapsed);
  mode = 'result';
  M.ui.showResult(st, isBest);
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'gear': M.audio.gear(); break;
      case 'curb': M.audio.curb(); M.ui.toast('연석에 쿵!', 1.0); break;
      case 'crash': M.audio.crash(); M.ui.toast('쿵!! 사고', 1.4); endDelay = 1.1; break;
      case 'parked': M.audio.parked(st.stars); M.ui.toast('주차 완료!', 1.4); endDelay = 1.1; break;
      case 'timeout': M.audio.timeout(); M.ui.toast('시간 초과…', 1.4); endDelay = 1.1; break;
    }
  }
}

// ── 포인터 입력 ────────────────────────────────────────────────────────
const app = $('app');
app.addEventListener('contextmenu', (e) => e.preventDefault());

app.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn, .vbtn, .stage-cell, .gearp-cell, .save-btn, .diff-btn, .mode-btn')) return;
  M.audio.resume();
  if (mode === 'replay') { skipReplay(); return; }
  if (mode !== 'run' || !st) return;
  e.preventDefault();
  if (adjust) { adjustDrag = { x: e.clientX, y: e.clientY }; return; }   // 조절 중엔 드래그 = 겨누기
  if (st.phase === 'ready') {                                   // 클릭한 자리가 기준점 → 출발
    setRef(e.clientX, e.clientY);
    M.Logic.begin(st);
    $('ready-overlay').classList.add('hidden');
    return;
  }
  if (e.button === 0) input.shift = 1;                          // 좌클릭 = 기어 위로 (R→N→D)
  else if (e.button === 2) input.shift = -1;                    // 우클릭 = 기어 아래로
});
app.addEventListener('pointerup', () => { adjustDrag = null; });
app.addEventListener('wheel', (e) => {
  if (mode === 'run' && st && st.phase === 'run') {
    e.preventDefault();
    input.shift = e.deltaY < 0 ? 1 : -1;
  }
}, { passive: false });
app.addEventListener('pointercancel', () => { input.active = false; adjustDrag = null; });
app.addEventListener('pointermove', (e) => {
  if (e.target.closest('#gear-panel, .vbtn')) return;           // 기어·버튼 위 커서는 조작으로 안 읽음
  if (adjust) {
    if (adjustDrag) {                                           // 끌어서 미러 겨누기 (드래그 = 보이는 범위가 따라온다)
      const k = 0.0022;
      nudgeMirror((e.clientX - adjustDrag.x) * k, (e.clientY - adjustDrag.y) * k);
      adjustDrag = { x: e.clientX, y: e.clientY };
    }
    return;
  }
  input.x = e.clientX; input.y = e.clientY;
  if (mode === 'run' && refSet) input.active = true;
});
app.addEventListener('pointerleave', () => { input.active = false; });
app.addEventListener('pointerenter', () => { if (mode === 'run' && refSet) input.active = true; });

function skipReplay() {
  if (M.Render.replay && !M.Render.replay.done) {
    M.Render.replay.clock = M.Render.replay.dur;
    M.Render.replay.endT = 99;
    M.Render.replay.done = true;
  }
}

// 터치: 드래그 동일 매핑, 고개·기어는 화면 버튼
if (isTouch) {
  document.body.classList.add('touch');
  M.touch = true;
  $('ready-hint').innerHTML = '화면을 눌러 기준점을 정하세요<br>위로 밀면 엑셀 · 아래로 브레이크 · 좌우 핸들<br>기어는 R N D 버튼';
  $('title-hint').textContent = '누른 자리가 기준점 · 위 엑셀 · 아래 브레이크 · ◀▶ 버튼으로 백미러 보기(길게 = 어깨너머)';
  // 안내에서 PC 전용 조작(Shift·M·휠)을 빼고 버튼 기준으로 바꾼다
  $('hud-look').textContent = '◀▶ 백미러 · 길게 = 어깨너머 · 🪞 미러 조절';
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#map-scroll')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// ── 키보드 ─────────────────────────────────────────────────────────────
function syncLook() {
  input.look = (lookKeys.has('L') ? -1 : 0) + (lookKeys.has('R') ? 1 : 0);
  input.shoulder = lookKeys.has('S') ? 1 : 0;         // Shift = 어깨너머 확인
}
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if (mode === 'title') { if (k === 'Enter') goMap(); }
  else if (mode === 'map') {
    if (k === 'Enter') startStage(Math.min(M.save.unlocked(), M.COURSES));
    if (k === 'Escape') { mode = 'title'; M.ui.show('title-screen'); }
  } else if (mode === 'run') {
    // M = 미러 조절 (좌 → 우 → 룸 → 끝). 조절 중엔 방향키가 미러를 겨눈다.
    if (e.code === 'KeyM') { cycleAdjust(); e.preventDefault(); return; }
    if (adjust) {
      if (k === 'Escape' || k === 'Enter') { setAdjust(null); e.preventDefault(); return; }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {          // 0 = 이 미러 초기화
        M.mirrorAdj[adjust].yaw = 0; M.mirrorAdj[adjust].pitch = 0;
        M.save.storeMirror(); e.preventDefault(); return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { nudgeMirror(-MIRROR_STEP, 0); e.preventDefault(); return; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { nudgeMirror(MIRROR_STEP, 0); e.preventDefault(); return; }
      // pitch 를 키우면 미러가 아래를 향한다 → ↑ 는 pitch 를 줄여야 "보이는 범위가 위로"
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { nudgeMirror(0, -MIRROR_STEP); e.preventDefault(); return; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { nudgeMirror(0, MIRROR_STEP); e.preventDefault(); return; }
      return;
    }
    if (k === 'Escape') { mode = 'pause'; M.audio.engineOff(); M.ui.show('pause-screen'); return; }
    if (k === 'r' || k === 'R') { startStage(st.no); return; }
    // ← → (또는 A/D) 누르는 동안 고개 돌리기 — e.code라 한글 자판에서도 동작
    // 기본은 백미러가 보이는 각도까지, Shift를 같이 누르면 어깨너머(B필러 너머)까지
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { lookKeys.add('L'); syncLook(); e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { lookKeys.add('R'); syncLook(); e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { lookKeys.add('S'); syncLook(); }
    if (e.code === 'KeyW') input.gearTo = 'D';
    if (e.code === 'KeyS') input.gearTo = 'R';
    if (e.code === 'KeyX') input.gearTo = 'N';
  } else if (mode === 'replay') {
    if (k === 'Enter' || k === 'Escape' || k === ' ') skipReplay();
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'run'; M.audio.engineOn(); M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no);
    if (k === 'm' || k === 'M') goMap();
  } else if (mode === 'result') {
    if (k === 'Enter') { if (st.stars > 0 && st.no < M.COURSES) startStage(st.no + 1); else startStage(st.no); }
    if (k === 'm' || k === 'M') goMap();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { lookKeys.delete('L'); syncLook(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { lookKeys.delete('R'); syncLook(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { lookKeys.delete('S'); syncLook(); }
});

function syncDiffBtns() {
  for (const b of document.querySelectorAll('.diff-btn')) b.classList.toggle('sel', b.dataset.diff === M.diff);
}
syncDiffBtns();
for (const b of document.querySelectorAll('.diff-btn')) {
  b.onclick = () => { M.diff = b.dataset.diff; M.save.data.diff = M.diff; M.save.store(); syncDiffBtns(); };
}

$('btn-start').onclick = () => goMap();
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogupark/') ? '../index.html' : 'index.html';
};
$('btn-retry').onclick = () => startStage(st.no);
$('btn-map').onclick = () => goMap();
$('btn-next').onclick = () => startStage(st.no + 1);
$('btn-resume').onclick = () => { mode = 'run'; M.audio.engineOn(); M.ui.hideAll(); };
$('btn-pmap').onclick = () => goMap();

// 기어 버튼 (R N D) — 데스크톱 클릭·터치 공용
for (const el of document.querySelectorAll('.gearp-cell')) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'run' && st && st.phase === 'run') input.gearTo = el.dataset.gear;
  });
}
// 고개 돌리기 홀드 버튼 (터치) — 짧게 잡으면 미러 확인, 계속 누르면 어깨너머까지
for (const [id, dir] of [['vbtn-look-l', -1], ['vbtn-look-r', 1]]) {
  const el = $(id);
  let holdTimer = null;
  const on = (e) => {
    e.preventDefault(); e.stopPropagation();
    input.look = dir; input.shoulder = 0;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if (input.look === dir) input.shoulder = 1; }, LOOK_HOLD_MS);
  };
  const offF = () => {
    clearTimeout(holdTimer);
    if (input.look === dir) { input.look = 0; input.shoulder = 0; }
  };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', offF);
  el.addEventListener('pointercancel', offF);
  el.addEventListener('pointerleave', offF);
}
// 미러 조절 버튼 (터치) — 누를 때마다 좌 → 우 → 룸 → 끝
$('vbtn-mirror').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'run') cycleAdjust();
});
$('vbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'run') { mode = 'pause'; M.audio.engineOff(); M.ui.show('pause-screen'); }
});

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  v: st ? +st.car.v.toFixed(2) : 0, kmh: st ? Math.round(Math.abs(st.car.v) * 3.6) : 0,
  x: st ? +st.car.x.toFixed(2) : 0, z: st ? +st.car.z.toFixed(2) : 0,
  h: st ? +st.car.h.toFixed(2) : 0, gear: st ? st.car.gear : null,
  steer: st ? +st.car.steer.toFixed(3) : 0, headYaw: st ? +st.car.headYaw.toFixed(2) : 0,
  throttle: st ? +st.throttle.toFixed(2) : 0, brake: st ? +st.brake.toFixed(2) : 0,
  time: st ? +st.time.toFixed(1) : 0, parkT: st ? +st.parkT.toFixed(2) : 0,
  stars: st ? st.stars : 0, diff: M.diff, rec: st ? st.rec.length : 0,
  refX: Math.round(input.refX), refY: Math.round(input.refY),
});
M._st = () => st;
M._input = input;
M._setRef = setRef;
M._startStage = startStage;

// ── HUD ────────────────────────────────────────────────────────────────
function updateHud() {
  $('hud-time').textContent = st.time.toFixed(1);
  $('hud-time').style.color = st.time < 10 ? '#ff7a6a' : '#fff';
  $('hud-speed').textContent = (Math.abs(st.car.v) * 3.6).toFixed(0);

  const ref = $('ref-cross'), dot = $('cursor-dot');
  const on = input.active && st.phase === 'run';
  ref.classList.toggle('hidden', !on);
  dot.classList.toggle('hidden', !on);
  if (on) {
    ref.style.left = input.refX + 'px'; ref.style.top = input.refY + 'px';
    dot.style.left = input.x + 'px'; dot.style.top = input.y + 'px';
    dot.style.background = st.brake > 0 ? '#ff5a4a' : st.throttle > 0 ? '#7de08a' : '#ffd83d';
  }
  for (const el of document.querySelectorAll('.gearp-cell'))
    el.classList.toggle('cur', el.dataset.gear === st.car.gear);
  $('gauge-throttle').style.height = (st.throttle * 100).toFixed(0) + '%';
  $('gauge-brake').style.opacity = 0.18 + st.brake * 0.82;
}

// ── 메인 루프 ──────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  $('vbtn-pause').style.display = isTouch && mode === 'run' ? 'flex' : 'none';
  const lookBtns = isTouch && mode === 'run';
  $('vbtn-look-l').style.display = lookBtns ? 'flex' : 'none';
  $('vbtn-look-r').style.display = lookBtns ? 'flex' : 'none';
  $('gear-panel').style.display = mode === 'run' ? 'block' : 'none';
  $('vbtn-mirror').style.display = lookBtns ? 'flex' : 'none';

  if (mode === 'run' && st) {
    if (adjust) {                                               // 조절 중엔 고른 미러 쪽으로 고개 고정
      input.look = adjust === 'left' ? -1 : adjust === 'right' ? 1 : 0;
      input.shoulder = 0;
    }
    handleEvents(M.Logic.step(st, dt, input));
    M.audio.engineUpdate(Math.abs(st.car.v) / M.Logic.VMAX_F, st.throttle, st.car.gear);
    updateHud();
    M.Render.drawRun(st, now / 1000);
    if (st.phase !== 'run' && st.phase !== 'ready') {
      endDelay -= dt;
      if (endDelay <= 0) toReplay();
    }
  } else if (mode === 'replay' && st) {
    M.Render.drawReplay(st, now / 1000, dt);
    if (M.Render.replay && M.Render.replay.done) finishRun();
  } else if ((mode === 'result' || mode === 'pause') && st) {
    if (M.Render.replay) M.Render.drawReplay(st, now / 1000, 0);
    else M.Render.drawRun(st, now / 1000);
  }
}
requestAnimationFrame(frame);
