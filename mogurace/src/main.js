// main.js — 게임 루프 + 상태 머신 + 마우스 입력
// 기준점은 주행 준비 화면에서 클릭한 지점으로 잡힌다. 이후 조작은 전부 그 점 대비 절대 위치.
const M = window.MRC;
const $ = (id) => document.getElementById(id);

let mode = 'title';                 // title | map | run | pause | result
let st = null;

const input = { active: false, shift: 0, gearTo: 0, w: 0, h: 0, refX: 0, refY: 0, x: 0, y: 0 };
let refSet = false;                 // 기준점이 잡히기 전에는 커서 움직임을 조작으로 읽지 않는다
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

M.save.load();
let trans = M.save.data.trans === 'stick' ? 'stick' : 'auto';   // 변속 모드 (타이틀에서 선택·저장)
if (M.DIFF_ORDER.includes(M.save.data.diff)) M.diff = M.save.data.diff;   // 난이도 (타이틀에서 선택·저장)
M.ui.init();
M.Render.init($('app'));
M.ui.show('title-screen');

function syncSize() { input.w = window.innerWidth; input.h = window.innerHeight; }
syncSize();
window.addEventListener('resize', syncSize);

// 기준점은 위(엑셀 30%)·아래(브레이크 20%)·좌우 여유가 남도록 클램프한다
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
  st = M.Logic.create(no, trans);
  mode = 'run';
  input.active = false; input.shift = 0; refSet = false;
  $('hud-gear').style.display = trans === 'stick' ? '' : 'none';   // 오토는 RPM 창만
  M.ui.hideAll();
  $('hud').classList.remove('hidden');
  $('ready-overlay').classList.remove('hidden');
  M.ui.hudRun(st);
  M.Render.setStage(st.stage);
  M.audio.resume(); M.audio.engineOn(); M.audio.meow();
}

M.ui.onStageClick = (no) => startStage(no);

function finishRun() {
  const isBest = M.save.record(st.no, st.stars, st.elapsed);
  mode = 'result';
  M.audio.engineOff();
  M.ui.showResult(st, isBest);
  if (st.phase === 'finish') M.audio.finish(st.stars); else M.audio.timeout();
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'start': M.audio.start(); $('ready-overlay').classList.add('hidden'); break;
      case 'hit': M.audio.hit(); break;
      case 'rail': M.audio.rail(); M.ui.toast('가드레일!', 0.9); break;
      case 'offroad': M.audio.offroad(); break;
      case 'shift': M.audio.shift(); break;
      case 'checkpoint':
        M.audio.checkpoint();
        M.ui.toast(`체크포인트 ${e.n} 통과  +${e.bonus}초`, 1.3);
        break;
      case 'finish': case 'timeout': break;
    }
  }
}

// ── 포인터 입력 ────────────────────────────────────────────────────────
const app = $('app');
app.addEventListener('contextmenu', (e) => e.preventDefault());

app.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.btn, .vbtn, .stage-cell, .gear-cell')) return;
  M.audio.resume();
  if (mode !== 'run' || !st) return;
  e.preventDefault();
  if (st.phase === 'ready') { setRef(e.clientX, e.clientY); return; }  // 클릭한 자리가 기준점
  if (st.trans === 'stick') {                                          // 좌클릭 ▲ / 우클릭 ▼
    if (e.button === 0) input.shift = 1;
    else if (e.button === 2) input.shift = -1;
  }
});
app.addEventListener('wheel', (e) => {                                 // 휠로도 변속
  if (mode === 'run' && st && st.trans === 'stick' && st.phase !== 'ready') {
    e.preventDefault();
    input.shift = e.deltaY < 0 ? 1 : -1;
  }
}, { passive: false });
app.addEventListener('pointercancel', () => { input.active = false; });
app.addEventListener('pointermove', (e) => {
  // 기어 패널 위에서는 커서 위치를 조작으로 읽지 않는다 — 변속하러 손을 뻗는 동안
  // 좌측 끝 좌표가 풀 카운터 조향으로 들어가면 차가 튕겨나간다. 마지막 입력 유지.
  if (e.target.closest('#gear-panel')) return;
  input.x = e.clientX; input.y = e.clientY;
  // 기준점만 잡혀 있으면 다시 활성화한다 — 터치는 손을 뗄 때마다 비활성화되므로
  // phase로 막으면 기준점 설정 직후의 드래그를 놓친다
  if (mode === 'run' && refSet) input.active = true;
});
app.addEventListener('pointerleave', () => { input.active = false; });
app.addEventListener('pointerenter', () => { if (mode === 'run' && refSet) input.active = true; });

// 터치: 드래그가 마우스와 같은 매핑 — 위 = 엑셀, 아래 = 브레이크, 손을 떼면 관성 주행
if (isTouch) {
  document.body.classList.add('touch');
  $('ready-hint').innerHTML = '화면을 눌러 기준점을 정하고<br>위로 밀면 엑셀 · 아래로 당기면 브레이크';
  $('title-hint').textContent = '누른 자리가 기준점 · 위로 엑셀 · 아래로 브레이크 · 좌우 조향';
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#map-scroll')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// 메뉴 조작만 키보드 보조 (주행은 마우스 전용)
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if (mode === 'title') { if (k === 'Enter') goMap(); }
  else if (mode === 'map') {
    if (k === 'Enter') startStage(Math.min(M.save.unlocked(), M.COURSES));
    if (k === 'Escape') { mode = 'title'; M.ui.show('title-screen'); }
  } else if (mode === 'run') {
    if (k === 'Escape') { mode = 'pause'; M.audio.engineOff(); M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startStage(st.no);
    // Q A W S E D = 1~6단 직결 (H패턴 열 순서). e.code라 한글 자판에서도 동작.
    if (st && st.trans === 'stick') {
      const g = { KeyQ: 1, KeyA: 2, KeyW: 3, KeyS: 4, KeyE: 5, KeyD: 6 }[e.code];
      if (g) input.gearTo = g;
    }
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'run'; M.audio.engineOn(); M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startStage(st.no);
    if (k === 'm' || k === 'M') goMap();
  } else if (mode === 'result') {
    if (k === 'Enter') { if (st.stars > 0 && st.no < M.COURSES) startStage(st.no + 1); else startStage(st.no); }
    if (k === 'm' || k === 'M') goMap();
  }
});

function syncModeBtns() {
  $('mode-auto').classList.toggle('sel', trans === 'auto');
  $('mode-stick').classList.toggle('sel', trans === 'stick');
}
syncModeBtns();
$('mode-auto').onclick = () => { trans = 'auto'; M.save.data.trans = trans; M.save.store(); syncModeBtns(); };
$('mode-stick').onclick = () => { trans = 'stick'; M.save.data.trans = trans; M.save.store(); syncModeBtns(); };

function syncDiffBtns() {
  for (const b of document.querySelectorAll('.diff-btn')) b.classList.toggle('sel', b.dataset.diff === M.diff);
}
syncDiffBtns();
for (const b of document.querySelectorAll('.diff-btn')) {
  b.onclick = () => { M.diff = b.dataset.diff; M.save.data.diff = M.diff; M.save.store(); syncDiffBtns(); };
}

$('btn-start').onclick = () => goMap();
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogurace/') ? '../index.html' : 'index.html';
};
$('btn-retry').onclick = () => startStage(st.no);
$('btn-map').onclick = () => goMap();
$('btn-next').onclick = () => startStage(st.no + 1);
$('btn-resume').onclick = () => { mode = 'run'; M.audio.engineOn(); M.ui.hideAll(); };
$('btn-pmap').onclick = () => goMap();
for (const [id, dir] of [['vbtn-up', 1], ['vbtn-down', -1]]) {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'run' && st && st.trans === 'stick') input.shift = dir;
  });
}
$('vbtn-pause').addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  if (mode === 'run') { mode = 'pause'; M.audio.engineOff(); M.ui.show('pause-screen'); }
});
const gearCells = [...document.querySelectorAll('.gear-cell')];
for (const el of gearCells) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'run' && st && st.trans === 'stick') input.gearTo = +el.dataset.gear;
  });
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, no: st ? st.no : 0, phase: st ? st.phase : null,
  speed: st ? Math.round(st.speed) : 0, kmh: st ? Math.round(st.speed * M.KMH) : 0,
  throttle: st ? +st.throttle.toFixed(2) : 0, steer: st ? +st.steer.toFixed(2) : 0,
  brake: st ? +st.brake.toFixed(2) : 0, playerX: st ? +st.playerX.toFixed(2) : 0,
  time: st ? +st.time.toFixed(1) : 0, cp: st ? st.cpPassed : 0,
  progress: st ? +(M.Logic.progress(st) * 100).toFixed(1) : 0,
  gear: st ? st.gear : 0, rpm: st ? +st.rpm.toFixed(2) : 0, trans: st ? st.trans : null, diff: M.diff,
  stars: st ? st.stars : 0, refX: Math.round(input.refX), refY: Math.round(input.refY),
});
M._st = () => st;
M._input = input;
M._setRef = setRef;

// ── HUD ────────────────────────────────────────────────────────────────
function updateHud() {
  const kmh = st.speed * M.KMH;
  $('hud-speed').textContent = kmh.toFixed(0);
  $('hud-time').textContent = st.time.toFixed(1);
  $('hud-time').style.color = st.time < 5 ? '#ff7a6a' : '#fff';
  $('hud-prog').style.width = (M.Logic.progress(st) * 100).toFixed(1) + '%';
  $('hud-cp').textContent = `CP ${st.cpPassed}/${st.stage.checkpoints.length}`;

  // 조작 표시 — 기준점 십자선과 현재 커서, 그리고 엑셀·조향 게이지
  const ref = $('ref-cross'), dot = $('cursor-dot');
  const on = input.active && st.phase !== 'ready';
  ref.classList.toggle('hidden', !on);
  dot.classList.toggle('hidden', !on);
  if (on) {
    ref.style.left = input.refX + 'px'; ref.style.top = input.refY + 'px';
    dot.style.left = input.x + 'px'; dot.style.top = input.y + 'px';
    dot.style.background = st.brake > 0 ? '#ff5a4a' : st.throttle > 0 ? '#7de08a' : '#ffd83d';
  }
  const rpm = Math.min(1, st.rpm);
  $('hud-rpm').style.width = (rpm * 100).toFixed(0) + '%';
  $('hud-rpm').style.background = st.rpm > 0.9 ? '#ff5a4a' : '#7de08a';
  if (st.trans === 'stick') {
    $('hud-gear').textContent = st.gear;
    for (const el of gearCells) el.classList.toggle('cur', +el.dataset.gear === st.gear);
  }
  $('gauge-throttle').style.height = (st.throttle * 100).toFixed(0) + '%';
  $('gauge-brake').style.opacity = 0.18 + st.brake * 0.82;   // 깊이 비례
  $('gauge-steer-needle').style.left = (50 + st.steer * 46).toFixed(1) + '%';
}

// ── 메인 루프 ──────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(M.Logic.DT_CAP, (now - last) / 1000);   // 상한은 관통 임계와 물려 있다
  last = now;
  $('vbtn-pause').style.display = isTouch && mode === 'run' ? 'flex' : 'none';
  const stickTouch = isTouch && mode === 'run' && st && st.trans === 'stick';
  $('vbtn-up').style.display = stickTouch ? 'flex' : 'none';
  $('vbtn-down').style.display = stickTouch ? 'flex' : 'none';
  $('gear-panel').style.display = mode === 'run' && st && st.trans === 'stick' ? 'block' : 'none';

  if (mode === 'run' && st) {
    handleEvents(M.Logic.step(st, dt, input));
    M.audio.engineUpdate(st.rpm, st.speed / M.MAX_SPEED, st.throttle);
    updateHud();
    if (st.phase === 'finish' || st.phase === 'timeout') finishRun();
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
