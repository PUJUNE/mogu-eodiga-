// main.js — 화면 흐름 · 입력(마우스·키보드·터치·끌기·확대) · 고정 시간 간격 루프
// 화면: title(군사 모구 시연) → play → result / pause
const M = window.MWT;
const $ = (id) => document.getElementById(id);
const R = M.R3, A = M.audio, U = M.ui, S = M.save, Game = M.Game, T = M.TOWER;
const DT = M.STEP;

let mode = 'title', G = null, bot = null, auto = false, speed = 1, diff = 'normal';
let demo = null, demoBot = null, demoN = 0, resultT = 0;
const ptrs = new Map();
const drag = { on: false, x: 0, y: 0, moved: false, pinch: 0 };

// ══ 시작 ══
const data = S.load();
diff = M.DIFFS[data.diff] ? data.diff : 'normal';
U.mode = data.mode === 'endless' ? 'endless' : 'campaign';
const faceImg = new Image();
faceImg.onload = boot;
faceImg.src = M.ASSETS.mogu;

function boot() {
  R.init($('game'), faceImg);
  startDemo();
  pickDiff(diff); U.setMode(U.mode); U.mapList(diff);
  requestAnimationFrame(frame);
}

function startDemo() {
  demo = Game.create({ map: demoN % M.MAPS.length, diff: 'normal', seed: 1234 + demoN });
  demoBot = M.makeBot({ think: 0.5 });
  demoN++;
  R.setGame(demo); R.pulse = false;
}
function pickDiff(d) {
  diff = d; S.data.diff = d; S.save(); U.setDiff(d);
  if (U.mode === 'campaign' && !S.unlocked(U.sel)) U.sel = 0;
  U.mapList(d);
}
function pickMode(m) { U.setMode(m); S.data.mode = m; S.save(); if (m === 'campaign' && !S.unlocked(U.sel)) U.sel = 0; U.mapList(diff); }

function startGame(i = U.sel) {
  A.resume(); A.click();
  U.sel = i;
  G = Game.create({ map: i, diff, endless: U.mode === 'endless' });
  bot = M.makeBot({ early: false });
  mode = 'play'; speed = 1; auto = false;
  R.view.zoom = 1; R.view.px = R.view.pz = 0;
  R.setGame(G); R.pulse = true;
  U.closeMenu(); U.hideBanner();
  $('title-screen').classList.add('hidden'); $('result-screen').classList.add('hidden'); $('pause-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  U.banner(`${G.map.icon} ${G.map.name}`, G.endless ? `끝없는 방어 · ${G.D.name}` : `${G.map.sub} · ${G.D.name}`, `${G.map.lore}<br>터를 눌러 냥이 탑을 지어요`, 4);
  A.bgm('battle');
}
function toTitle() {
  mode = 'title'; G = null; U.closeMenu(); U.hideBanner();
  $('hud').classList.add('hidden'); $('result-screen').classList.add('hidden'); $('pause-screen').classList.add('hidden');
  $('title-screen').classList.remove('hidden');
  U.mapList(diff);
  startDemo(); A.bgm('title');
}
function pause(on) {
  if (on && mode === 'play') { mode = 'pause'; $('pause-screen').classList.remove('hidden'); U.closeMenu(); }
  else if (!on && mode === 'pause') { mode = 'play'; $('pause-screen').classList.add('hidden'); }
}
function setAuto(on, quiet) {
  auto = on; if (!quiet) U.toast(on ? '🐱 군사 모구가 지휘해요 — 터를 누르면 직접 지휘' : '🐱 직접 지휘해요', 2.2);
  if (on) { U.closeMenu(); R.showSel(-1); }
}

// ══ 게임 사건 → 소리 · 화면 ══
function handle(evs, live) {
  if (live) R.onEvents(evs);
  if (!live) return;
  for (const e of evs) {
    switch (e.type) {
      case 'shoot': A[e.tower.kind === 'yarn' ? 'yarn' : 'can'](); break;
      case 'beam': A.laser(); break;
      case 'boom': A.boom(); break;
      case 'kill': {
        A.squeak(); A.coin();
        const s = R.toScreen(e.x, e.y + 0.8, e.z); U.float(s.x, s.y, '+' + e.gold);
        if (e.mon.boss) U.banner('우두머리를 물리쳤다!', M.MON[e.mon.type].name, '', 2.6);
        break;
      }
      case 'leak': A.leak(); U.bump('s-lives'); break;
      case 'manHit': A.scratch(); break;
      case 'gas': A.gas(); break;
      case 'emp': A.emp(); U.toast('🌀 <b>흡입!</b> 주변 탑이 잠깐 멈췄어요', 2); break;
      case 'hop': A.hop(); break;
      case 'early': A.early(); U.bump('s-gold'); { const s = R.toScreen(G.base[0], 2, G.base[1]); U.float(s.x, s.y, '+' + e.gold + ' 일찍 부른 덤'); } break;
      case 'wave': {
        A.horn(e.boss);
        if (e.boss) {
          const b = M.MON[e.bossType];
          U.banner(`제${e.n}공세 · 우두머리`, b.name, b.tip, 3.6, true); A.bgm('boss');
        } else U.banner(`제${e.n}공세`, G.map.name, '', 1.8);
        const fresh = e.fresh.filter((t) => !M.MON[t].boss);
        if (fresh.length) U.toast(fresh.slice(0, 2).map((t) => `새 도둑: <b>${M.MON[t].name}</b> — ${M.MON[t].tip}`).join('<br>'), 4.5);
        break;
      }
      case 'bossDown': A.bgm('battle'); break;
      case 'build': A.build(); break;
      case 'upgrade': A.upgrade(); break;
      case 'sell': A.sell(); break;
      case 'win': case 'lose': endGame(); break;
    }
  }
}
function endGame() {
  const isNew = S.submit(G);
  if (G.phase === 'win') A.win(); else A.lose();
  U.closeMenu(); R.showSel(-1);
  mode = 'result'; resultT = 0;
  setTimeout(() => { if (mode === 'result') { U.hideBanner(); $('toast').classList.add('hidden'); U.result(G, isNew); } }, 900);
}

// ══ 플레이어 명령 ══
function tapPlot(i) {
  if (!G || mode !== 'play') return;
  if (auto) setAuto(false);
  if (i < 0) { U.closeMenu(); R.showSel(-1); return; }
  A.resume();
  if (U.menu && U.menu.plot === i) { U.closeMenu(); R.showSel(-1); return; }
  U.openMenu(G, i); R.showSel(i); A.click();
}
function menuPick(k) {
  const mu = U.menu; if (!mu || !G) return;
  const t = G.towerAt[mu.plot];
  if (!t && M.TOWER_KINDS.includes(k)) {
    if (mu.pick === k) {
      if (Game.build(G, mu.plot, k)) { U.closeMenu(); R.showSel(-1); handle(G.ev.splice(0), true); return; }
      A.deny(); U.toast('🪙 군자금이 모자라요', 1.5);
    } else { mu.pick = k; R.showSel(mu.plot, k, 0); A.click(); }
  } else if (t && k === 'up') {
    if (mu.pick === 'up') {
      if (Game.upgrade(G, mu.plot)) { handle(G.ev.splice(0), true); mu.pick = null; R.showSel(mu.plot); }
      else { A.deny(); U.toast('🪙 군자금이 모자라요', 1.5); }
    } else { mu.pick = 'up'; R.showSel(mu.plot, t.kind, t.lvl + 1); A.click(); }
  } else if (t && k === 'sell') {
    if (mu.pick === 'sell') { Game.sell(G, mu.plot); handle(G.ev.splice(0), true); U.closeMenu(); R.showSel(-1); return; }
    mu.pick = 'sell'; R.showSel(mu.plot); A.click();
  }
  U.drawMenu(G);
}
function callWave() {
  if (!G || mode !== 'play') return;
  A.resume();
  if (Game.callWave(G)) handle(G.ev.splice(0), true);
}
function cycleSpeed() { speed = speed >= 3 ? 1 : speed + 1; A.click(); }

// ══ 입력 ══
$('bmenu').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const b = e.target.closest('.bt'); if (b) menuPick(b.dataset.k);
});
$('maps').addEventListener('click', (e) => {
  const b = e.target.closest('.map'); if (!b) return;
  const i = +b.dataset.m;
  if (U.mode === 'campaign' && !S.unlocked(i)) { A.resume(); A.deny(); return; }
  if (U.sel === i) { startGame(i); return; }
  U.sel = i; A.resume(); A.click(); U.mapList(diff);
});
document.querySelectorAll('.diff-btn').forEach((b) => { b.onclick = () => { A.resume(); A.click(); pickDiff(b.dataset.diff); }; });
document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => { A.resume(); A.click(); pickMode(b.dataset.mode); }; });
$('btn-start').onclick = () => startGame();
$('btn-retry').onclick = () => startGame(U.sel);
$('btn-next').onclick = () => startGame(Math.min(M.MAPS.length - 1, U.sel + 1));
$('btn-menu').onclick = toTitle;
$('btn-resume').onclick = () => pause(false);
$('btn-restart').onclick = () => startGame(U.sel);
$('btn-quit').onclick = toTitle;
$('btn-series').onclick = () => { location.href = location.pathname.includes('/moguwatch/') ? '../index.html' : 'index.html'; };
$('auto').onclick = () => { A.resume(); A.click(); setAuto(!auto); };
$('b-pause').onclick = () => pause(true);
$('b-speed').onclick = cycleSpeed;
$('b-mute').onclick = () => { A.resume(); $('b-mute').textContent = A.toggleMute() ? '🔇' : '🔊'; };
$('b-zin').onclick = () => { R.zoomBy(1.25); U.placeMenu(G); };
$('b-zout').onclick = () => { R.zoomBy(0.8); U.placeMenu(G); };
$('call').onclick = callWave;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

const cv = $('game');
cv.addEventListener('pointerdown', (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (e.pointerType === 'touch') document.body.classList.add('touch');
  cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 1) { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = false; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); drag.moved = true; }
});
cv.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (mode === 'play' && G && e.pointerType === 'mouse') R.hover = R.pickPlot(e.clientX, e.clientY); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (drag.pinch > 0) R.zoomBy(d / drag.pinch); drag.pinch = d; U.placeMenu(G); return;
  }
  if (!drag.on || mode !== 'play') return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
  if (drag.moved) { R.panBy(dx, dy); U.placeMenu(G); }
});
const up = (e) => {
  const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
  if (ptrs.size < 2) drag.pinch = 0;
  if (!had || ptrs.size > 0) return;
  if (drag.on && !drag.moved && mode === 'play') tapPlot(R.pickPlot(e.clientX, e.clientY));
  drag.on = false;
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag.on = false; });
cv.addEventListener('wheel', (e) => { if (mode !== 'play') return; e.preventDefault(); R.zoomBy(e.deltaY < 0 ? 1.12 : 0.89); U.placeMenu(G); }, { passive: false });

window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (mode === 'title') {
    if (c === 'Enter') startGame();
    return;
  }
  if (mode === 'result') { if (c === 'Enter' && resultT > 1) startGame(U.sel); if (c === 'Escape') toTitle(); return; }
  if (mode === 'pause') { if (c === 'Escape' || c === 'KeyP') pause(false); return; }
  if (mode !== 'play') return;
  if (c === 'Escape') { if (U.menu) { U.closeMenu(); R.showSel(-1); } else pause(true); }
  else if (c === 'KeyP') pause(true);
  else if (c === 'Space') { e.preventDefault(); callWave(); }
  else if (c === 'Tab') { e.preventDefault(); cycleSpeed(); }
  else if (c === 'KeyM') $('b-mute').click();
  else if (c === 'KeyA') setAuto(!auto);
  else if (c === 'Equal' || c === 'NumpadAdd') R.zoomBy(1.25);
  else if (c === 'Minus' || c === 'NumpadSubtract') R.zoomBy(0.8);
  else if (U.menu && /^Digit[1-4]$/.test(c)) {
    const t = G.towerAt[U.menu.plot], n = +c.slice(5);
    if (!t) menuPick(M.TOWER_KINDS[n - 1]); else menuPick(n === 1 ? 'up' : 'sell');
  } else if (U.menu && c === 'KeyU') menuPick('up');
  else if (U.menu && c === 'KeyS') menuPick('sell');
});

// ══ 루프 ══
let last = performance.now(), acc = 0, titleAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'title') {
    // 시연은 초당 20번만 그린다 (발열 방지)
    titleAcc += dt; if (titleAcc < 0.05) return;
    const tdt = Math.min(0.1, titleAcc); titleAcc = 0;
    for (let k = 0; k < Math.round(tdt / DT * 1.5); k++) { demoBot.step(demo, DT); Game.step(demo, DT); R.onEvents(demo.ev); demo.ev.length = 0; }
    if (demo.phase !== 'play' || demo.waveN >= 6) startDemo();
    R.update(tdt, demo); R.render();
    return;
  }
  if (mode === 'play') {
    acc += dt * speed;
    let n = 0;
    while (acc >= DT && n < 12) {
      if (auto) bot.step(G, DT);
      Game.step(G, DT); acc -= DT; n++;
      if (G.ev.length) handle(G.ev.splice(0), true);
      if (mode !== 'play') break;
    }
    if (n >= 12) acc = 0;
    if (U.menu) { U.drawMenuThrottle = (U.drawMenuThrottle || 0) + dt; if (U.drawMenuThrottle > 0.25) { U.drawMenuThrottle = 0; U.drawMenu(G); } }
    U.hud(G, auto, speed);
  } else if (mode === 'result') {
    resultT += dt;
    if (resultT < 2) { R.update(dt, G); R.render(); }
    return;
  } else if (mode === 'pause') return;
  R.update(dt, G); R.render();
}

// 시험용 손잡이
M._dbg = () => ({ mode, auto, speed, diff, map: G && G.map.id, wave: G && G.waveN, gold: G && G.gold, lives: G && G.lives, phase: G && G.phase,
  towers: G ? G.towers.length : 0, mons: G ? G.mons.length : 0, menu: U.menu && { plot: U.menu.plot, pick: U.menu.pick }, endless: G && G.endless });
M._G = () => G;
M._auto = (on) => setAuto(on, true);
M._speed = (s) => { speed = s; };
M._start = (i) => startGame(i);
