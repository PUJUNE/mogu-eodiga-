// main.js — 게임 루프 + 상태 머신 + 입력 (키보드 8방향·공격·스킬 / 터치 가상패드)
const M = window.MDN;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | branch | over(컨티뉴) | win | ending
let st = null;
let overCount = 10, overTimer = 0;
const held = { left: false, right: false, up: false, down: false, atk: false, skill: false };
const pulse = { atk: false, skill: false };   // 한 프레임보다 짧게 눌러도 공격·스킬이 들어가게 (탭 입력)

M.save.load();
M.ui.init();
M.Render.init($('game'));
M.ui.show('title-screen');

function startRun() {
  st = M.Logic.create((Date.now() & 0x7fffffff) || 1, M.diff, M.cls);
  M.Render.reset();
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`${M.STAGES[st.stageKey].name} — ${M.CLASSES[st.cls].name} 출동!`, 1.8);
  M.audio.resume(); M.audio.meow();
}

function toTitle() {
  mode = 'title';
  M.ui.updateDiffBtns(); M.ui.updateClassBtns(); M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function finish() {                                     // 결과 반영 (1회만)
  if (st.recorded) return;
  st.recorded = true;
  const cleared = st.phase === 'clear';
  st.isBest = M.save.record(st.diff, st.cls, st.gold, st.stagesDone, cleared);
}

function handleEvents(evs) {
  const R = M.Render;
  for (const e of evs) {
    switch (e.type) {
      case 'atk': M.audio.swing(); R.addFx('slash', st.p.x + st.p.face * 22, st.p.z, { dir: st.p.face, color: e.combo === 3 ? '#ffd83d' : '#fff' }); break;
      case 'hurt': M.audio.hit(e.kd); R.addFx('spark', e.x, e.z, { color: e.kd ? '#ffd83d' : '#fff2a0' }); R.addText(e.x, e.z, `${e.dmg}`, e.kd ? '#ffd83d' : '#fff'); if (e.kd) R.shake = 0.15; break;
      case 'bhit': R.addFx('spark', e.x, e.z, { color: '#ffb347' }); break;
      case 'kill': M.audio.kill(); R.addText(e.x, e.z, `+${e.gold}💰`, '#ffd83d', 14); break;
      case 'phit': M.audio.phit(); R.addFx('spark', e.x, e.z, { color: '#ff6a6a' }); R.shake = 0.25; R.addText(e.x, e.z, `-${e.dmg}`, '#ff6a6a'); break;
      case 'dead': M.audio.over(); break;
      case 'eatk': if (e.smash) { M.audio.smash(); R.addFx('smash', e.x, e.z, { dur: 0.4 }); R.shake = 0.3; } break;
      case 'efire': M.audio.efire(); break;
      case 'breath': M.audio.breath(); break;
      case 'summon': R.addFx('ring', e.x, e.z, { color: '#c04cff', r: 50 }); break;
      case 'skill':
        M.audio.skill(e.cls);
        if (e.cls === 'fighter') R.addFx('ring', e.x, e.z, { color: '#fff', r: 62, dur: 0.4 });
        if (e.cls === 'cleric') { R.addFx('heal', e.x, e.z, { dur: 0.8 }); R.addFx('ring', e.x, e.z, { color: '#7de08a', r: 90, dur: 0.5 }); }
        break;
      case 'nomp': M.audio.nomp(); M.ui.toast('MP가 부족하다! (💧 마나 물약)', 1.0); break;
      case 'chest': M.audio.chest(); R.addFx('spark', e.x, e.z, { color: '#ffd83d' }); break;
      case 'item': if (e.kind === 'gold') M.audio.coin(); else M.audio.item(); R.addText(e.x, e.z, e.text, e.kind === 'gold' ? '#ffd83d' : '#7de08a'); break;
      case 'levelup': M.audio.levelup(); R.addFx('ring', st.p.x, st.p.z, { color: '#ffd83d', r: 70, dur: 0.5 }); M.ui.toast(`⬆ LEVEL ${e.level}! 최대 HP·공격력 상승, HP 회복`, 1.6); break;
      case 'go': M.audio.go(); M.ui.toast('GO ➡ 오른쪽으로 전진!', 1.2); break;
      case 'section': break;
      case 'spawn': if (e.boss) { M.audio.boss(); R.shake = 0.5; M.ui.toast(`⚠️ 보스 등장 — ${M.ENEMY[e.kind].name}!!`, 2.2); } break;
      case 'bossdead': M.audio.bossdead(); R.flash = 0.6; R.shake = 0.5; M.ui.toast(`🏆 ${e.name} 격파!`, 1.8); break;
      case 'stageclear':
        M.audio.stage();
        setTimeout(() => {
          if (mode !== 'play') return;
          if (e.next.length >= 2) { mode = 'branch'; M.ui.showBranch(st, e.next); }
          else { M.Logic.chooseNext(st, e.next[0]); M.ui.toast(`➡ ${M.STAGES[st.stageKey].name}`, 1.8); }
        }, 1200);
        break;
      case 'clear':
        finish(); M.audio.clear();
        setTimeout(() => {
          if (mode !== 'play') return;
          if (M.save.data.cleared.crazy && st.diff === 'crazy') { mode = 'ending'; M.ui.show('ending-screen'); }
          else { mode = 'win'; M.ui.showClear(st); }
        }, 1800);
        break;
    }
  }
}

function chooseBranch(key) {
  if (mode !== 'branch') return;
  M.Logic.chooseNext(st, key);
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`➡ ${M.STAGES[key].name}`, 1.8);
}
$('branch-options').addEventListener('click', (e) => {
  const b = e.target.closest('.branch-btn');
  if (b) chooseBranch(b.dataset.key);
});

function doContinue() {                                 // 아케이드 코인 투입 → 현재 구간 재개
  M.audio.coinIn();
  M.Logic.continueRun(st);
  M.Render.reset();
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`🪙 CONTINUE ${st.continues} — 다시 간다!`, 1.5);
}

// ── 키보드 ──
const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  z: 'atk', Z: 'atk', ' ': 'atk', x: 'skill', X: 'skill', Shift: 'skill' };
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (KEYMAP[k]) { held[KEYMAP[k]] = true; if (!e.repeat && pulse[KEYMAP[k]] !== undefined) pulse[KEYMAP[k]] = true; }

  if (mode === 'title') {
    if (k === 'Enter') startRun();
    if (k === '1') { M.save.setDiff('easy'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '2') { M.save.setDiff('normal'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '3') { M.save.setDiff('hard'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
    if (k === '4') { M.save.setDiff('crazy'); M.ui.updateDiffBtns(); M.ui.refreshTitle(); }
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
    if (k === 'r' || k === 'R') startRun();
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'r' || k === 'R') startRun();
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'branch') {
    if (k === 'ArrowLeft' || k === 'Enter') chooseBranch(st.stage.next[0]);
    if (k === 'ArrowRight') chooseBranch(st.stage.next[1]);
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') doContinue();
    if (k === 'Escape') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') {
      const nx = M.nextDiff(st.diff);
      if (nx) { M.save.setDiff(nx); M.ui.updateDiffBtns(); startRun(); } else toTitle();
    }
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) held[KEYMAP[e.key]] = false; });

$('btn-start').onclick = () => startRun();
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogudungeon/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restart').onclick = () => startRun();
$('btn-title').onclick = () => toTitle();
$('btn-retry').onclick = () => startRun();
$('btn-over-continue').onclick = () => doContinue();
$('btn-over-title').onclick = () => toTitle();
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-next').onclick = () => {
  const nx = M.nextDiff(st.diff);
  if (nx) { M.save.setDiff(nx); M.ui.updateDiffBtns(); }
  startRun();
};
$('over-screen').addEventListener('pointerdown', (e) => {
  if (mode === 'over' && !e.target.closest('button')) doContinue();
});

// ── 터치 (가상 패드) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = $('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').innerHTML = '왼쪽 패드 이동 · 👊 공격(연타 콤보) · ✨ 스킬(MP)<br>보물상자를 때려서 열고, 구간의 적을 전멸시키면 GO ➡';
  const bindHold = (id, key) => {
    const el = $(id);
    const setOn = (e) => { e.preventDefault(); M.audio.resume(); held[key] = true; if (pulse[key] !== undefined) pulse[key] = true; el.classList.add('pressed'); };
    const setOff = () => { held[key] = false; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointercancel', setOff);
    el.addEventListener('pointerleave', setOff);
  };
  bindHold('vbtn-left', 'left'); bindHold('vbtn-right', 'right');
  bindHold('vbtn-up', 'up'); bindHold('vbtn-down', 'down');
  bindHold('vbtn-atk', 'atk'); bindHold('vbtn-skill', 'skill');
  $('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, diff: st ? st.diff : M.diff, cls: st ? st.cls : M.cls, phase: st ? st.phase : null,
  stage: st ? st.stageKey : null, section: st ? st.section : 0, gate: st ? st.gateOpen : false,
  hp: st ? Math.ceil(st.p.hp) : 0, mp: st ? Math.floor(st.p.mp) : 0, level: st ? st.p.level : 0, gold: st ? st.gold : 0,
  enemies: st ? st.enemies.filter((e) => e.state !== 'dead').length : 0,
  px: st ? +st.p.x.toFixed(1) : 0, pz: st ? +st.p.z.toFixed(2) : 0, continues: st ? st.continues : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) vpad.classList.toggle('on', mode === 'play');

  if (st && (mode === 'play' || mode === 'win' || mode === 'ending')) {
    const inp = Object.assign({}, held, { atk: held.atk || pulse.atk, skill: held.skill || pulse.skill });
    pulse.atk = pulse.skill = false;
    handleEvents(M.Logic.step(st, dt, inp));
    if (mode === 'play' && M.Logic.deathDone(st)) {
      mode = 'over'; overCount = 10; overTimer = 0;
      $('over-count').textContent = overCount;
      M.ui.showOver(st);
    }
  } else if (mode === 'over') {                            // 컨티뉴 카운트다운
    overTimer += dt;
    if (overTimer >= 1) { overTimer = 0; overCount--; $('over-count').textContent = Math.max(0, overCount); if (overCount <= 0) { finish(); toTitle(); } }
  }
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
