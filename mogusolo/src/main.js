// main.js — 게임 루프 + 상태 머신 + 입력 (QWER 스킬 키)
const M = window.MSL;
const $ = (id) => document.getElementById(id);

let mode = 'title';            // title | play | pause | win | over | ending
let st = null;
const held = { left: false, right: false, up: false, down: false };
let atkQueued = false, jumpQueued = false;
const skillQueued = { q: false, w: false, e: false, r: false };
let overCount = 10, overAcc = 0;

M.save.load();
M.ui.init();
M.Render.init(document.getElementById('game'));
M.ui.show('title-screen');

function startMission(no) {
  st = M.Logic.create(no, M.save.data.exp || 0, M.save.data.gear);
  M.Render.fx = [];
  M.Render.camX = 0;
  mode = 'play';
  M.ui.hideAll();
  M.ui.toast(`MISSION ${no} — ${M.STORY[no]}`, 3.0);
  M.audio.resume(); M.audio.meow();
  if (no >= 2) setTimeout(() => M.audio.cluck(), 500);
}

function toTitle() {
  mode = 'title';
  M.ui.refreshTitle();
  M.ui.show('title-screen');
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'swing': case 'eswing': M.audio.swing(); break;
      case 'slash': M.audio.slash(); M.Render.addSlash(e.x, M.Render.sy(e.z, 0), e.face); break;
      case 'stealth': M.audio.stealth(); M.ui.toast('🌫 은신 — 3초!', 1.2); break;
      case 'ambush': M.ui.toast('🗡 기습! ×2', 1.2); break;
      case 'extract':
        M.audio.extract();
        M.Render.addExtract(e.x, M.Render.sy(e.z, 0));
        M.ui.toast(`💜 그림자 병사 일어나라! (${e.n}/${M.Logic.SHADOW_MAX})`, 1.6);
        break;
      case 'extractfail':
        M.ui.toast(e.reason === 'full' ? '그림자 자리가 없다 (최대 3기)' : '주변에 추출할 시체가 없다', 1.3);
        break;
      case 'shadowdown': M.ui.toast('그림자 병사가 스러졌다…', 1.3); break;
      case 'ruler': M.audio.ruler(); M.Render.addRuler(e.x, M.Render.sy(e.z, 24)); M.ui.toast('👑 지배자의 권능!!', 1.2); break;
      case 'boltwarn': M.audio.boltwarn(); break;
      case 'bolt': M.audio.bolt(); M.Render.addBolt(e.x, M.Render.sy(e.z, 0)); break;
      case 'bolthit': M.audio.hurt(); break;
      case 'bossdash': M.audio.wave(); break;
      case 'shot': M.audio.shot(); break;
      case 'shothit': M.audio.hurt(); break;
      case 'jump': M.audio.jump(); break;
      case 'hit':
        M.audio.hit();
        M.Render.addSpark(e.x, M.Render.sy(e.z, 20), e.kd);
        break;
      case 'kd': M.audio.kd(); break;
      case 'levelup':
        M.audio.levelup();
        M.ui.toast(e.skill ? `⬆ Lv.${e.lv} — 스킬 해금! [${e.key.toUpperCase()}] ${e.skill}` : `⬆ LEVEL UP! Lv.${e.lv}`, 2.2);
        M.save.setExp(st.exp);
        break;
      case 'edown': M.audio.edown(); break;
      case 'drop': break;
      case 'pickup': M.audio.pickup(); M.ui.toast(e.kind === 'hp' ? '🧪 회복 물약 +30' : '🧪 마나 물약 +30', 1.1); break;
      case 'wave': M.audio.wave(); M.ui.toast('마수 증원…!', 1.2); break;
      case 'go': M.audio.go(); M.ui.toast('GO ▶▶', 1.4); break;
      case 'section': break;
      case 'bossintro': M.audio.bossintro(); M.ui.toast(`👑 ${e.name} 등장!!`, 2.2); break;
      case 'buddydown': M.ui.toast('꼬꼬가 쓰러졌다…!', 1.6); break;
      case 'buddyup': M.audio.buddyup(); M.audio.cluck(); M.ui.toast('🐔 꼬꼬 부활!', 1.4); break;
      case 'clear': {
        M.save.setExp(st.exp);
        M.audio.clear(e.stars);
        M.save.record(st.mission, e.stars);
        let gearMsg = null;
        if (e.mission === 2 && !M.save.data.gear.fang) { M.save.setGear('fang'); gearMsg = '🗡 카사카의 독니 획득! 공격력 +2'; M.audio.gear(); }
        if (e.mission === 4 && !M.save.data.gear.armor) { M.save.setGear('armor'); gearMsg = '🛡 파수견의 갑주 획득! 받는 피해 -2'; M.audio.gear(); }
        setTimeout(() => { if (mode === 'play') { mode = 'win'; M.ui.showWin(st, gearMsg); } }, 1400);
        break;
      }
      case 'over':
        M.audio.over();
        setTimeout(() => {
          if (mode === 'play') {
            mode = 'over'; overCount = 10; overAcc = 0;
            M.ui.setCountdown(10);
            M.ui.show('over-screen');
          }
        }, 900);
        break;
    }
  }
}

// ── 키보드 ──
window.addEventListener('keydown', (e) => {
  M.audio.resume();
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft') held.left = true;
  if (k === 'ArrowRight') held.right = true;
  if (k === 'ArrowUp') held.up = true;
  if (k === 'ArrowDown') held.down = true;
  if ((k === ' ' || k === 'z' || k === 'Z') && !e.repeat && mode === 'play') atkQueued = true;
  if ((k === 'x' || k === 'X') && !e.repeat && mode === 'play') jumpQueued = true;
  if (mode === 'play' && !e.repeat) {
    const lk = k.toLowerCase();
    if (lk === 'q' || lk === 'w' || lk === 'e' || lk === 'r') skillQueued[lk] = true;
  }

  if (mode === 'title') {
    if (k === 'Enter') startMission(M.save.data.best);
  } else if (mode === 'play') {
    if (k === 'Escape') { mode = 'pause'; M.ui.show('pause-screen'); }
  } else if (mode === 'pause') {
    if (k === 'Enter' || k === 'Escape') { mode = 'play'; M.ui.hideAll(); }
    if (k === 'm' || k === 'M') toTitle();
  } else if (mode === 'win') {
    if (k === 'Enter') { if (st.mission < 5) startMission(st.mission + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } }
  } else if (mode === 'over') {
    if (k === 'Enter' || k === ' ') { M.Logic.respawn(st); mode = 'play'; M.ui.hideAll(); }
    if (k === 'Escape') toTitle();
  } else if (mode === 'ending') {
    if (k === 'Enter') toTitle();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') held.left = false;
  if (e.key === 'ArrowRight') held.right = false;
  if (e.key === 'ArrowUp') held.up = false;
  if (e.key === 'ArrowDown') held.down = false;
});

$('btn-continue').onclick = () => startMission(M.save.data.best);
$('btn-new').onclick = () => {
  M.save.data.exp = 0;
  M.save.data.gear = { fang: false, armor: false };
  M.save.store();
  startMission(1);
};
$('btn-series').onclick = () => {
  location.href = location.pathname.includes('/mogusolo/') ? '../index.html' : 'index.html';
};
$('btn-resume').onclick = () => { mode = 'play'; M.ui.hideAll(); };
$('btn-restage').onclick = () => startMission(st.mission);
$('btn-title').onclick = () => toTitle();
$('btn-next').onclick = () => { if (st.mission < 5) startMission(st.mission + 1); else { mode = 'ending'; M.ui.show('ending-screen'); } };
$('btn-retry').onclick = () => startMission(st.mission);
$('btn-win-title').onclick = () => toTitle();
$('btn-end-title').onclick = () => toTitle();
$('btn-over-title').onclick = () => { if (mode === 'over') toTitle(); };

// ── 터치 (가상 패드 + 스킬 버튼) ──
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const vpad = document.getElementById('vpad');
if (isTouch) {
  document.body.classList.add('touch');
  $('title-hint').textContent = '패드 이동 · 🗡 공격 · ⬆ 점프 · Q W E R 스킬 버튼 — 레벨업으로 해금!';
  const bindHold = (id, on, off) => {
    const el = document.getElementById(id);
    const setOn = (e) => { e.preventDefault(); M.audio.resume(); on(); el.classList.add('pressed'); };
    const setOff = () => { if (off) off(); el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', setOn);
    el.addEventListener('pointerup', setOff);
    el.addEventListener('pointercancel', setOff);
    el.addEventListener('pointerleave', setOff);
  };
  bindHold('vbtn-left', () => { held.left = true; }, () => { held.left = false; });
  bindHold('vbtn-right', () => { held.right = true; }, () => { held.right = false; });
  bindHold('vbtn-up', () => { held.up = true; }, () => { held.up = false; });
  bindHold('vbtn-down', () => { held.down = true; }, () => { held.down = false; });
  bindHold('vbtn-atk', () => { if (mode === 'play') atkQueued = true; });
  bindHold('vbtn-jump', () => { if (mode === 'play') jumpQueued = true; });
  for (const k of ['q', 'w', 'e', 'r']) {
    bindHold('vbtn-' + k, () => { if (mode === 'play') skillQueued[k] = true; });
  }
  document.getElementById('vbtn-pause').addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'play') { mode = 'pause'; M.ui.show('pause-screen'); }
  });
  $('over-screen').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#btn-over-title')) return;
    M.audio.resume();
    if (mode === 'over') { M.Logic.respawn(st); mode = 'play'; M.ui.hideAll(); }
  });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  vpad.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 디버그 훅 (테스트 자동화용) ──
M._dbg = () => ({
  mode, mission: st ? st.mission : 0, phase: st ? st.phase : null,
  sec: st ? st.secIdx : 0, go: st ? st.go : false,
  p: st ? { x: +st.p.x.toFixed(1), z: +st.p.z.toFixed(1), hp: st.p.hp, state: st.p.state } : null,
  b: st && st.b ? { hp: st.b.hp, state: st.b.state } : null,
  shadows: st ? st.shadows.length : 0, mp: st ? +st.mp.toFixed(1) : 0, stealth: st ? +st.stealth.toFixed(2) : 0,
  enemies: st ? st.enemies.filter((e) => M.Logic.alive(e)).length : 0,
  score: st ? st.score : 0, lv: st ? st.lv : 1, exp: st ? st.exp : 0, stars: st ? st.stars : 0, deaths: st ? st.deaths : 0,
});
M._st = () => st;

// ── 메인 루프 ──
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (isTouch) vpad.classList.toggle('on', mode === 'play');

  if (mode === 'play' && st) {
    handleEvents(M.Logic.step(st, dt, {
      left: held.left, right: held.right, up: held.up, down: held.down,
      atk: atkQueued, jump: jumpQueued,
      q: skillQueued.q, w: skillQueued.w, e: skillQueued.e, r: skillQueued.r,
    }));
  } else if (mode === 'over') {
    overAcc += dt;
    if (overAcc >= 1) {
      overAcc = 0; overCount--;
      M.ui.setCountdown(Math.max(0, overCount));
      if (overCount <= 0) toTitle();
    }
  }
  atkQueued = false; jumpQueued = false;
  skillQueued.q = skillQueued.w = skillQueued.e = skillQueued.r = false;
  if (st) M.Render.draw(st, now / 1000, dt);
}
requestAnimationFrame(frame);
