// main.js — 게임 루프 · 모드 전환 · 입력 (클릭 이동·드래그 회전·키보드·터치) · 행동 → 저장 · 전투 이벤트 → 소리·숫자
const M = window.MHR;
const $ = (id) => document.getElementById(id);
const A = M.audio, G = M.Game, U = M.ui, R3 = M.R3;

let mode = 'title';          // title | village | panel | talk | battle | result | choice | ending | pause | fade
let g = null, b = null, bot = null, auto = false, pendingI = null, battleEnd = 0, pausedFrom = null;
const vs = { x: 0, y: 2, fx: 0, fy: 1, spd: 0, moveTo: null, goal: null };
const held = { up: false, down: false, left: false, right: false };
const edge = { attack: false, dash: false, skill: false, potion: false };
let clickMove = null, attackId = null;

M.save.loadOpt();
M.faceImg = new Image();
M.faceImg.onload = () => { R3.setFace(M.faceImg); if (g) applyGear(); };
M.faceImg.src = M.ASSETS.mogu;
R3.init($('game'));
toTitle();

// ════════ 모드 ════════
function toTitle() {
  mode = 'title'; g = null; b = null;
  R3.showVillage();
  for (const id of ['topbar', 'prompt', 'ctl-hint', 'bhud']) $(id).classList.add('hidden');
  U.closePanel(); $('talk').classList.add('hidden');
  U.refreshTitle(M.save.load()); U.show('title-screen');
  A.stopBgm();
}
function startGame(fresh) {
  A.resume();
  const saved = M.save.load();
  if (fresh || !saved) g = G.create(M.save.opt.diff, (Date.now() & 0x7fffffff) || 1);
  else g = saved;
  applyGear();
  U.hideAll(); toVillage(fresh || !saved ? 'home' : 'plaza');
  A.bgm('village');
  if (fresh || !saved) {
    M.save.store(g);
    mode = 'talk';
    U.talk([
      { face: 'sumo', name: '스모 촌장', text: '모구야, 일어났느냐. 이 마을에 예언이 내려왔다 — 30일째 밤, 그림자 고양이가 온다.' },
      { face: 'sumo', name: '스모 촌장', text: '낮에는 도장에서 수련하고, 생선가게에서 일하고, 던전에서 몬스터를 잡아 강해지거라. 밤엔 집에서 자고.' },
      { face: 'photo', name: '모구', text: '…일단 츄르부터 먹고 생각하겠다냥. (클릭이나 WASD로 걷고, 건물을 누르면 들어간다)' },
    ], () => { mode = 'village'; });
  }
}
function applyGear() { if (!g) return; R3.setGear(G.weapon(g).col, G.armor(g).col); }
function toVillage(where) {
  R3.showVillage();
  const B = M.BUILDINGS;
  const at = where === 'home' ? B.home.door : where === 'dungeon' ? B.dungeon.door : [0.5, 2.5];
  vs.x = at[0]; vs.y = at[1] + (where === 'dungeon' ? -0.8 : where === 'home' ? 0.8 : 0); vs.moveTo = null; vs.goal = null;
  R3.view.target.set(vs.x, 0, vs.y);
  mode = 'village';
  for (const id of ['topbar', 'ctl-hint']) $(id).classList.remove('hidden');
  $('bhud').classList.add('hidden');
  U.top(g);
}
function save() { if (g) M.save.store(g); }

// ── 건물 · 사람 ──
function openBuilding(key) {
  A.click(); vs.moveTo = null; vs.goal = null;
  mode = 'panel'; U.openPanel(key, g);
}
function closePanel() { U.closePanel(); if (mode === 'panel') mode = 'village'; }
function talkTo(key) {
  const N = M.NPCS[key];
  vs.moveTo = null; vs.goal = null; A.click();
  const line = N.lines[(g.day * 3 + (talkTo.n = (talkTo.n || 0) + 1)) % N.lines.length];
  mode = 'talk';
  U.talk([{ face: N.face, name: N.name, text: line }], () => { mode = 'village'; });
}

// ── 행동 (패널 버튼) ──
const ACT = {
  train(k) {
    const r = G.train(g, k);
    if (!r.ok) return U.toast(r.msg);
    A.train(); if (r.great) A.levelup();
    U.toast(`${r.great ? '✨ 수련 대성공! ' : '🐾 '}${M.TRAINS[k].name} — ${M.STAT_NAME[r.stat]} +${r.gain}`, 1.8);
    after();
  },
  work() {
    const r = G.work(g);
    if (!r.ok) return U.toast(r.msg);
    A.coin(); U.toast(`🐟 알바 끝! 손님 ${r.customers}명${r.tip ? ' · 단골 팁!' : ''} — 💰 +${M.fmt(r.pay)}`, 2);
    after();
  },
  buy(id) {
    const r = G.buy(g, id);
    if (!r.ok) return U.toast(r.msg);
    A.coin(); U.toast(r.bought ? '샀다! 바로 장착했어요' : id === 'potion' ? '츄르 회복약 +1' : '장착했어요');
    applyGear(); after(false);
  },
  tarot() {
    const r = G.drawTarot(g);
    if (!r.ok) return U.toast(r.msg);
    A.card(); after(false);
    const el = $('tarot-card'); if (el) requestAnimationFrame(() => el.classList.add('flip'));
  },
  dungeon(i) {
    const r = G.enterDungeon(g, +i);
    if (!r.ok) return U.toast(r.msg);
    save(); U.closePanel(); startBattle(r.spec);
  },
  sleep() {
    const r = G.sleep(g);
    U.closePanel();
    if (!r.ok && r.invasion) { U.top(g); startInvasion(r.invasion); return; }
    A.sleep(); save();
    dayFade(`${g.day}일째`, g.day === g.finalDay ? '오늘 밤, 그림자 고양이가 온다…' : M.INVASIONS[g.day] && !g.invaded[g.day] && g.day !== 30 ? '오늘 밤 들개 깡패가 쳐들어온다는 소문이…' : '좋은 아침이다냥', () => toVillage('home'));
  },
};
M.act = ACT;
function after(spent = true) {
  save(); U.top(g);
  if (spent) { const I = G.invasionDue(g); if (I) { U.closePanel(); startInvasion(I); return; } }
  if (U.panelOpen) U.renderPanel(g);
}
$('panel-body').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-tab]'); if (!t || t.disabled) return;
  A.resume();
  if (t.dataset.tab) { U.shopTab = t.dataset.tab; U.renderPanel(g); A.click(); return; }
  const a = t.dataset.act;
  ACT[a](t.dataset.k || t.dataset.id || t.dataset.i);
});
$('panel-close').onclick = () => closePanel();
$('panel-wrap').addEventListener('pointerdown', (e) => { if (e.target.id === 'panel-wrap') closePanel(); });

function dayFade(big, small, done) {
  mode = 'fade'; $('df-d').textContent = big; $('df-s').textContent = small;
  $('dayfade').classList.add('on');
  setTimeout(() => { $('dayfade').classList.remove('on'); if (done) done(); if (mode === 'fade') mode = 'village'; U.top(g); }, 1500);
}

// ════════ 침공 · 전투 ════════
const VILLAIN = {
  dog: ['이 마을 츄르는 이제 우리 거다 멍!', '두목님 나가신다, 길 비켜라 멍멍!'],
  shadow: ['모구… 이 마을 햇볕 드는 자리는 전부 내 것이다.', '30일 동안 기다렸다. 덤벼라.'],
};
function startInvasion(I) {
  pendingI = I; mode = 'talk';
  A.boss();
  const lines = I.final
    ? [{ face: 'kiwi', name: '키위 점술사', text: '카드가 떨려요… 그림자 고양이가 왔어요!' }, { face: 'shadow', name: '그림자 고양이', text: VILLAIN.shadow[0], bg: '#d8d0e8' }, { face: 'photo', name: '모구', text: '그 자리는 내 낮잠 자리다냥!' }]
    : [{ face: 'sumo', name: '스모 촌장', text: `큰일이다! ${I.name}이 광장으로 몰려온다!` }, { face: 'dog', name: I.boss, text: VILLAIN.dog[I.key === 8 ? 0 : 1] }];
  U.talk(lines, () => startBattle(G.invasionSpec(g, I)));
}
function startBattle(spec) {
  A.resume();
  U.hideAll(); U.closePanel(); $('talk').classList.add('hidden');
  b = M.Battle.create(g, spec, (Date.now() & 0x7fffffff) || 1);
  bot = M.makeBattleBot(b, 0.9); auto = false; battleEnd = 0; attackId = null; clickMove = null;
  for (const k in edge) edge[k] = false;
  R3.showBattle(b);
  mode = 'battle';
  for (const id of ['topbar', 'prompt', 'ctl-hint']) $(id).classList.add('hidden');
  $('bhud').classList.remove('hidden'); U.battleHud(b, auto);
  A.bgm(spec.final ? 'boss' : 'battle');
  U.msg(spec.name, spec.kind === 'invasion' ? `${spec.boss}와 졸개 ${spec.kills}마리` : `${M.MOBS[spec.mob].name} ${spec.kills}마리를 잡으면 보스`, spec.final ? 'purple' : '', 1.8);
}
function battleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'swing': A.swing(e.i); break;
      case 'hit': A.hit(e.crit); U.dmg(e.x, e.y, M.fmt(e.dmg), e.crit ? 'crit' : ''); break;
      case 'heavy': A.heavy(); break;
      case 'hurt': A.hurt(); U.dmg(e.x, e.y, '-' + e.dmg, 'hurt'); break;
      case 'kill': A.kill(); break;
      case 'dash': A.dash(); break;
      case 'skill-start': A.skill(); break;
      case 'potion': A.coin(); U.dmg(b.hero.x, b.hero.y, '+' + e.heal, 'heal'); break;
      case 'boss': A.boss(); A.bgm('boss'); U.msg('보스 등장!', e.name, 'red', 1.6); break;
      case 'slam-warn': A.slamWarn(); break;
      case 'slam': A.slam(); break;
      case 'win': U.msg(b.spec.kind === 'invasion' ? '격퇴!' : '클리어!', '', '', 1.2); break;
      case 'lose': U.msg('으앗…', '', 'red', 1.2); break;
      case 'timeout': U.msg('시간 초과', '', 'red', 1.2); break;
    }
  }
  R3.battleFx(b, evs);
}
function endBattle() {
  const out = G.finishBattle(g, b);
  const S = b.spec;
  $('bhud').classList.add('hidden');
  if (out.won) A.win(); else A.lose();
  if (out.ups.length) setTimeout(() => A.levelup(), 700);
  if (S.kind === 'invasion' && !out.won) { mode = 'choice'; U.showChoice(pendingI, g); return; }
  save();
  if (S.kind === 'invasion' && S.final) { mode = 'ending'; U.showEnding(g); return; }
  mode = 'result'; U.showResult(b, out, g);
  endBattle.where = S.kind === 'dungeon' ? (out.won || b.phase === 'retreat' ? 'dungeon' : 'home') : 'plaza';
}
function resultOk() {
  U.hideAll(); toVillage(endBattle.where); A.bgm('village'); save();
  const I = G.invasionDue(g); if (I) startInvasion(I);
  else if (G.hoursLeft(g) < 3) U.toast('오늘은 늦었다냥 — 🏠 집에 가서 자자', 2.6);
}
$('btn-res-ok').onclick = () => resultOk();
$('btn-rewind').onclick = () => {
  G.rollback(g); A.rewind(); applyGear(); save(); U.hideAll(); R3.showVillage();
  dayFade('⏪ 되감기', `${g.day}일째 아침으로 돌아왔다`, () => { toVillage('home'); A.bgm('village'); });
};
$('btn-concede').onclick = () => {
  const I = pendingI, r = G.concede(g, I);
  if (!I.final) G.sleep(g); else G.sleep(g);
  save(); U.hideAll(); R3.showVillage();
  dayFade(`${g.day}일째`, I.final ? `그림자 고양이는 ${g.finalDay}일째에 다시 온다` : `금화 ${M.fmt(r.lost)}를 빼앗겼다…`, () => { toVillage('home'); A.bgm('village'); });
};
$('btn-free').onclick = () => { U.hideAll(); toVillage('plaza'); A.bgm('village'); };
$('btn-end-title').onclick = () => toTitle();
$('b-auto').onclick = () => { auto = !auto; };
$('b-retreat').onclick = () => { if (mode === 'battle' && b.spec.kind === 'dungeon') M.Battle.retreat(b); else U.toast('마을을 버리고 도망칠 순 없다냥!'); };

// ── 일시정지 ──
function pause() { if (mode !== 'village' && mode !== 'battle') return; pausedFrom = mode; mode = 'pause'; U.show('pause-screen'); A.stopBgm(); }
function resume() { mode = pausedFrom || 'village'; U.hideAll(); A.bgm(mode === 'battle' ? (b && b.boss ? 'boss' : 'battle') : 'village'); }
$('btn-resume').onclick = () => resume();
$('btn-title').onclick = () => { save(); toTitle(); };
$('btn-mute').onclick = () => { $('btn-mute').textContent = A.toggleMute() ? '🔇 소리 꺼짐' : '🔊 소리'; };
$('tb-pause').onclick = () => pause();
$('tb-status').onclick = () => { if (mode === 'village') { mode = 'panel'; U.openStatus(g); } };

// ── 타이틀 ──
document.querySelectorAll('.diff-btn').forEach((bt) => bt.addEventListener('click', () => { M.save.opt.diff = bt.dataset.diff; M.save.storeOpt(); U.refreshTitle(M.save.load()); }));
$('btn-continue').onclick = () => startGame(false);
let newArm = 0;
$('btn-new').onclick = () => {
  if (M.save.load() && performance.now() - newArm > 2500) { newArm = performance.now(); U.toast('저장된 모험이 지워져요 — 한 번 더 누르면 처음부터', 2.5); return; }
  startGame(true);
};
$('btn-series').onclick = () => { location.href = location.pathname.includes('/moguhero/') ? '../index.html' : 'index.html'; };
$('talk').addEventListener('click', () => { A.click(); U.nextTalk(); });
$('prompt').addEventListener('click', () => interact());

// ════════ 입력 ════════
const keyOf = (e) => {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (e.code === 'Space') return ' ';
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.key;
};
const MOVE = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
window.addEventListener('keydown', (e) => {
  A.resume();
  const k = keyOf(e);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
  if (MOVE[k]) held[MOVE[k]] = true;
  if (e.repeat) return;
  if (mode === 'title') {
    if (k === 'Enter') startGame(!M.save.load());
    const n = '1234'.indexOf(k); if (n >= 0) { M.save.opt.diff = M.DIFF_ORDER[n]; M.save.storeOpt(); U.refreshTitle(M.save.load()); }
  } else if (mode === 'village') {
    if (k === 'e' || k === ' ' || k === 'Enter') interact();
    else if (k === 'c') { mode = 'panel'; U.openStatus(g); }
    else if (k === 'Escape' || k === 'p') pause();
  } else if (mode === 'panel') {
    if (k === 'Escape' || k === 'e' || k === 'c') closePanel();
  } else if (mode === 'talk') {
    if (k === ' ' || k === 'Enter' || k === 'e') { A.click(); U.nextTalk(); }
  } else if (mode === 'battle') {
    if (k === 'j' || k === 'f') edge.attack = true;
    if (k === ' ' || k === 'k' || k === 'Shift') edge.dash = true;
    if (k === 'q' || k === 'l') edge.skill = true;
    if (k === 'h') edge.potion = true;
    if (k === 't' || k === 'Tab') auto = !auto;
    if (k === 'Escape' || k === 'p') pause();
  } else if (mode === 'pause') {
    if (k === 'Escape' || k === 'p' || k === 'Enter') resume();
  } else if (mode === 'result') {
    if (k === 'Enter' || k === ' ') resultOk();
  } else if (mode === 'choice') {
    if (k === 'Enter') $('btn-rewind').click();
  }
});
window.addEventListener('keyup', (e) => { const k = keyOf(e); if (MOVE[k]) held[MOVE[k]] = false; });
window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

// 마우스·터치: 짧게 누르면 클릭(이동·공격), 끌면 화면 회전, 더블클릭은 냥보
const cv = $('game');
let pd = null, lastClick = 0;
cv.addEventListener('pointerdown', (e) => { A.resume(); pd = { x: e.clientX, y: e.clientY, drag: false, id: e.pointerId }; });
cv.addEventListener('pointermove', (e) => {
  if (!pd || e.pointerId !== pd.id) return;
  const dx = e.clientX - pd.x;
  if (!pd.drag && Math.hypot(dx, e.clientY - pd.y) > 8) pd.drag = true;
  if (pd.drag) { R3.rotate(dx); pd.x = e.clientX; pd.y = e.clientY; }
});
cv.addEventListener('pointerup', (e) => {
  if (!pd) return;
  const wasDrag = pd.drag; pd = null;
  if (wasDrag) return;
  const now = performance.now(), dbl = now - lastClick < 280; lastClick = now;
  const p = R3.pickGround(e.clientX, e.clientY); if (!p) return;
  if (mode === 'village') villageClick(p);
  else if (mode === 'battle') battleClick(p, dbl);
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); R3.zoomBy(e.deltaY > 0 ? 0.9 : 1.1); }, { passive: false });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

function villageClick(p) {
  const npc = R3.npcNear(p.x, p.y, 1.1);
  if (npc) { const n = R3.npcs[npc]; vs.goal = { type: 'npc', key: npc }; vs.moveTo = { x: n.x, y: n.y }; R3.showMark(n.x, n.y); return; }
  for (const [k, B] of Object.entries(M.BUILDINGS)) {
    if (Math.abs(p.x - B.x) < B.w / 2 + 0.4 && Math.abs(p.y - B.y) < B.d / 2 + 0.6 || Math.hypot(p.x - B.door[0], p.y - B.door[1]) < 1) {
      vs.goal = { type: 'door', key: k }; vs.moveTo = { x: B.door[0], y: B.door[1] }; R3.showMark(B.door[0], B.door[1]); return;
    }
  }
  vs.goal = null; vs.moveTo = { x: p.x, y: p.y }; R3.showMark(p.x, p.y);
}
function battleClick(p, dbl) {
  if (dbl) { edge.dash = true; clickMove = null; const h = b.hero, d = Math.hypot(p.x - h.x, p.y - h.y) || 1; edge.dashDir = { x: (p.x - h.x) / d, y: (p.y - h.y) / d }; return; }
  let tgt = null, bd = 1.3;
  for (const m of b.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - p.x, m.y - p.y) - m.size * 0.4; if (d < bd) { bd = d; tgt = m; } }
  if (tgt) { attackId = tgt.id; clickMove = null; }
  else { attackId = null; clickMove = { x: p.x, y: p.y }; }
}
function interact() {
  if (mode !== 'village') return;
  const door = M.Village.nearDoor(vs.x, vs.y, 1.6);
  if (door) return openBuilding(door);
  const npc = R3.npcNear(vs.x, vs.y, 1.9);
  if (npc) return talkTo(npc);
}

// 화면 회전에 맞춘 이동 방향
function camDir(mx, my) {
  const a = R3.view.angle;
  return [mx * Math.cos(a) + my * Math.sin(a), -mx * Math.sin(a) + my * Math.cos(a)];
}

// ── 터치 버튼 (전투) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) {
  document.body.classList.add('touch');
  $('ctl-hint').textContent = '탭 이동 · 건물/사람 탭 · 끌어서 회전';
  $('title-hint').innerHTML = '탭으로 걷고, 건물·사람을 탭하면 들어가거나 말을 건다 · 화면을 끌면 회전<br>' +
    '낮엔 🥋 수련 · 🐟 알바 · ⚔️ 던전, 밤엔 🏠 자기 · <b>30일째 밤 그림자 고양이</b><br>전투: 탭 이동 · 몬스터 탭 = 공격 · 더블탭 = 냥보 · 🌀 회오리';
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
const bindSk = (id, f) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.resume(); f(); });
bindSk('sk-atk', () => { edge.attack = true; });
bindSk('sk-dash', () => { edge.dash = true; });
bindSk('sk-skill', () => { edge.skill = true; });

// ════════ 디버그 훅 (테스트 자동화용) ════════
M._g = () => g; M._b = () => b;
M._dbg = () => ({ mode, day: g && g.day, hour: g && g.hour, gold: g && g.gold, lv: g && g.lv, x: +vs.x.toFixed(2), y: +vs.y.toFixed(2), panel: U.panelOpen,
  battle: b && { phase: b.phase, killed: b.killed, boss: !!b.boss, hp: b.hero.hp } });
M._set = (k, v) => { if (k === 'auto') auto = v; };

// ════════ 메인 루프 ════════ (메뉴·대화 중에는 초당 20번만 그려서 발열을 줄인다)
let last = performance.now(), idleAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (document.hidden) return;
  if (isTouch) $('rotate-hint').classList.toggle('hidden', !(window.innerHeight > window.innerWidth));
  const active = mode === 'village' || mode === 'battle';
  if (!active) { idleAcc += dt; if (idleAcc < 0.05) return; }
  const fdt = active ? dt : Math.min(0.1, idleAcc); idleAcc = 0;

  if (mode === 'title') { R3.drawTitle(fdt); return; }
  if (mode === 'battle' || ((mode === 'pause' || mode === 'result' || mode === 'choice' || mode === 'ending') && b && R3.inBattle)) {
    if (mode === 'battle') stepBattle(dt);
    R3.drawBattle(b, mode === 'battle' ? dt : 0);
    return;
  }
  if (mode === 'village') stepVillage(dt);
  if (g) R3.drawVillage(vs, mode === 'village' ? dt : fdt, g.hour);
}
function stepVillage(dt) {
  let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0), my = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  let dx = 0, dy = 0;
  if (mx || my) { [dx, dy] = camDir(mx, my); vs.moveTo = null; vs.goal = null; R3.moveMark.visible = false; }
  else if (vs.moveTo) {
    const ex = vs.moveTo.x - vs.x, ey = vs.moveTo.y - vs.y, d = Math.hypot(ex, ey);
    const reach = vs.goal ? (vs.goal.type === 'npc' ? 1.3 : 0.45) : 0.12;
    if (d < reach) {
      vs.moveTo = null;
      const gl = vs.goal; vs.goal = null;
      if (gl && gl.type === 'door') openBuilding(gl.key);
      else if (gl && gl.type === 'npc') talkTo(gl.key);
    } else { dx = ex / d; dy = ey / d; if (vs.goal && vs.goal.type === 'npc') { const n = R3.npcs[vs.goal.key]; vs.moveTo = { x: n.x, y: n.y }; } }
  }
  const m = Math.hypot(dx, dy);
  if (m > 0) {
    dx /= m; dy /= m;
    const spd = 5.2;
    const px = vs.x, py = vs.y;
    [vs.x, vs.y] = M.Village.push(vs.x + dx * spd * dt, vs.y + dy * spd * dt);
    vs.spd = Math.hypot(vs.x - px, vs.y - py) / Math.max(dt, 1e-4);
    vs.fx = dx; vs.fy = dy;
    if (vs.moveTo && vs.spd < 0.4) { vs.stuck = (vs.stuck || 0) + dt; if (vs.stuck > 0.6) { vs.moveTo = null; vs.goal = null; vs.stuck = 0; } } else vs.stuck = 0;
  } else vs.spd = 0;
  // 문 · 사람 근처 안내
  const door = M.Village.nearDoor(vs.x, vs.y, 1.6), npc = !door && R3.npcNear(vs.x, vs.y, 1.9);
  const pr = $('prompt');
  if (door) { const B = M.BUILDINGS[door]; pr.innerHTML = `${B.icon} ${B.name} — <b>E</b> / 클릭 들어가기`; pr.classList.remove('hidden'); }
  else if (npc) { pr.innerHTML = `💬 ${M.NPCS[npc].name} — <b>E</b> / 클릭 말 걸기`; pr.classList.remove('hidden'); }
  else pr.classList.add('hidden');
}
function stepBattle(dt) {
  const h = b.hero;
  if (b.phase !== 'fight') {
    battleEnd += dt;
    if (battleEnd > 1.4) endBattle();
    return;
  }
  let inp;
  if (auto) { inp = bot(); if (edge.potion) inp.potion = true; }
  else {
    const mx = (held.right ? 1 : 0) - (held.left ? 1 : 0), my = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    let [dx, dy] = mx || my ? camDir(mx, my) : [0, 0];
    if (mx || my) { clickMove = null; attackId = null; }
    inp = { mx: dx, my: dy, attack: edge.attack, dash: edge.dash, skill: edge.skill, potion: edge.potion };
    if (edge.dash && edge.dashDir) { inp.mx = edge.dashDir.x; inp.my = edge.dashDir.y; }
    if (clickMove) { inp.moveTo = clickMove; clickMove = null; }
    // 클릭한 몬스터 쫓아가 때리기
    if (attackId) {
      const t = b.mobs.find((m) => m.id === attackId && !m.dead);
      if (!t) attackId = null;
      else {
        const d = Math.hypot(t.x - h.x, t.y - h.y);
        if (d > M.ATK_RANGE * 0.8 + t.size * 0.4) inp.moveTo = { x: t.x, y: t.y };
        else { inp.moveTo = { x: h.x, y: h.y }; if (!h.act) inp.attack = true; }
      }
    }
  }
  for (const k in edge) edge[k] = false;
  edge.dashDir = null;
  battleEvents(M.Battle.step(b, dt, inp));
  U.battleHud(b, auto);
}
requestAnimationFrame(frame);
