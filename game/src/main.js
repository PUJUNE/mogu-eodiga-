// main.js — 게임 루프 + 상태 머신
import * as THREE from 'three';
const G = window.MOGU;

const app = document.getElementById('app');

// ── 렌더러/씬/카메라 ──
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
app.insertBefore(renderer.domElement, document.getElementById('fade'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 320);
camera.position.set(0, 6, -9);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── 전역 상태 ──
let state = 'title';
let stage = null, world = null, player = null;
let stageNo = 1, mapSel = 1;
let elapsed = 0, continuesUsed = 0, churTotal = 0, itemTotal = 0;
let countdown = 10, countdownAcc = 0, reviveDelay = 0;
let resultSel = 2, pauseSel = 0;
let boost = 0;
const keys = { left: false, right: false, up: false, down: false };

// ── 텍스처 (이미지 → 캔버스 경유: HTMLImage 직접 업로드가 일부 환경에서 실패) ──
let moguTex = null;
{
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    moguTex = t;
    if (player) {                       // 텍스처보다 스테이지가 먼저 시작된 경우 갱신
      player.moguMat.map = t;
      player.moguMat.needsUpdate = true;
      const a = cv.width / cv.height, h = 1.55;
      player.mogu.scale.set(h * a, h, 1);
    }
  };
  img.src = G.ASSETS.mogu;
}

G.save.load();
G.ui.init();
G.ui.show('title-screen');

// ── 화면 전환 ──
function transition(fn) {
  G.ui.fade(true);
  setTimeout(() => { fn(); G.ui.fade(false); }, 470);
}

function goMap() {
  state = 'map';
  mapSel = Math.min(G.save.unlocked(), Math.max(1, stageNo));
  G.ui.show('map-screen');
  G.ui.buildMap(mapSel);
  setTimeout(() => G.ui.selectMapNode(mapSel), 30);
  G.audio.stopWater();
}

function startStage(n) {
  if (world) { world.dispose(); world = null; }
  if (player) { player.dispose(); player = null; }
  stageNo = n;
  stage = G.makeStage(n);
  world = new G.WorldRenderer(scene, stage);
  player = new G.Player(scene, stage, moguTex || new THREE.Texture());
  elapsed = 0; continuesUsed = 0; boost = 0;
  churTotal = stage.items.filter((i) => i.kind === 'chur').length;
  itemTotal = stage.items.length;
  state = 'play';
  G.ui.hideAll();
  G.ui.toast(`WORLD ${stage.params.world} · ${stage.params.theme.name}`, 2.2);
  G.audio.resume(); G.audio.startWater(); G.audio.meow();
  // 카메라 초기 위치
  camera.position.set(stage.cx(0), 6.4, -8);
}

function dieAndOfferContinue() {
  state = 'continue';
  countdown = 10; countdownAcc = 0; reviveDelay = 0;
  G.ui.setCountdown(10);
  G.ui.show('continue-screen');
  G.audio.gameover();
}

function useCoin() {
  if (reviveDelay > 0) return;
  reviveDelay = 0.7;
  continuesUsed++;
  G.ui.coinDrop();
  G.audio.coin();
}

function giveUp() {
  transition(() => goMap());
}

function clearStage() {
  state = 'result';
  const pct = itemTotal > 0 ? player.itemCount / itemTotal : 1;
  let stars = 1;
  if (continuesUsed === 0 && player.hitCount === 0) stars = pct >= 0.8 ? 3 : 2;
  G.save.record(stageNo, stars, elapsed);
  resultSel = stageNo < 50 ? 2 : 1;
  G.ui.showResult({
    cleared: true, stage: stageNo, stars, time: elapsed,
    churGot: player.itemCount - player.fishCount, churTotal,
    itemPct: pct, fish: player.fishCount, continues: continuesUsed,
  });
  highlightResult();
  G.audio.fanfare();
  setTimeout(() => G.audio.meow(), 800);
  G.audio.setWaterLevel(0);
}

// ── 결과/일시정지 버튼 ──
const RESULT_BTNS = ['btn-retry', 'btn-map', 'btn-next'];
const PAUSE_BTNS = ['btn-resume', 'btn-prestart', 'btn-pmap'];
function visibleResultBtns() {
  return RESULT_BTNS.filter((id) => document.getElementById(id).style.display !== 'none');
}
function highlightResult() {
  const vis = visibleResultBtns();
  resultSel = Math.min(resultSel, vis.length - 1);
  G.ui.highlightButtons(vis, resultSel);
}
function activateResult() {
  const id = visibleResultBtns()[resultSel];
  if (id === 'btn-retry') transition(() => startStage(stageNo));
  else if (id === 'btn-map') transition(() => goMap());
  else if (id === 'btn-next') transition(() => startStage(stageNo + 1));
}
document.getElementById('btn-retry').onclick = () => { resultSel = visibleResultBtns().indexOf('btn-retry'); activateResult(); };
document.getElementById('btn-map').onclick = () => { resultSel = visibleResultBtns().indexOf('btn-map'); activateResult(); };
document.getElementById('btn-next').onclick = () => { resultSel = visibleResultBtns().indexOf('btn-next'); activateResult(); };
document.getElementById('btn-resume').onclick = () => resumePlay();
document.getElementById('btn-prestart').onclick = () => transition(() => startStage(stageNo));
document.getElementById('btn-pmap').onclick = () => transition(() => goMap());

function resumePlay() { state = 'play'; G.ui.hideAll(); }

G.ui.onStageClick = (s) => { if (state === 'map') transition(() => startStage(s)); };

// ── 입력 ──
window.addEventListener('keydown', (e) => {
  G.audio.resume();
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();

  if (k === 'ArrowLeft') keys.left = true;
  if (k === 'ArrowRight') keys.right = true;
  if (k === 'ArrowUp') keys.up = true;
  if (k === 'ArrowDown') keys.down = true;

  if (state === 'title') {
    if (k === 'Enter' || k === ' ') transition(() => goMap());
  } else if (state === 'map') {
    const unlocked = G.save.unlocked();
    if (k === 'ArrowDown' || k === 'ArrowRight') { mapSel = Math.min(unlocked, mapSel + 1); G.ui.selectMapNode(mapSel); }
    if (k === 'ArrowUp' || k === 'ArrowLeft') { mapSel = Math.max(1, mapSel - 1); G.ui.selectMapNode(mapSel); }
    if (k === 'Enter' || k === ' ') transition(() => startStage(mapSel));
  } else if (state === 'play') {
    if (k === 'Escape') { state = 'pause'; pauseSel = 0; G.ui.show('pause-screen'); G.ui.highlightButtons(PAUSE_BTNS, 0); }
    if (k === 'r' || k === 'R') transition(() => startStage(stageNo));
  } else if (state === 'pause') {
    if (k === 'Enter' || k === 'Escape') resumePlay();
    if (k === 'r' || k === 'R') transition(() => startStage(stageNo));
    if (k === 'm' || k === 'M') transition(() => goMap());
    if (k === 'ArrowLeft') { pauseSel = Math.max(0, pauseSel - 1); G.ui.highlightButtons(PAUSE_BTNS, pauseSel); }
    if (k === 'ArrowRight') { pauseSel = Math.min(2, pauseSel + 1); G.ui.highlightButtons(PAUSE_BTNS, pauseSel); }
  } else if (state === 'continue') {
    if (k === 'Escape') giveUp();
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(k)) useCoin();
  } else if (state === 'result') {
    const vis = visibleResultBtns();
    if (k === 'ArrowLeft') { resultSel = Math.max(0, resultSel - 1); highlightResult(); }
    if (k === 'ArrowRight') { resultSel = Math.min(vis.length - 1, resultSel + 1); highlightResult(); }
    if (k === 'Enter' || k === ' ') activateResult();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
  if (e.key === 'ArrowUp') keys.up = false;
  if (e.key === 'ArrowDown') keys.down = false;
});

// 디버그 (테스트 자동화용)
G.THREE = THREE;
G._scene = scene; G._camera = camera; G._renderer = renderer;
G._player = () => player;
G._die = () => dieAndOfferContinue();
G._dbg = () => ({
  state, stageNo,
  hasTex: !!moguTex, texSize: moguTex && moguTex.image ? [moguTex.image.width, moguTex.image.height] : null,
  player: player ? { x: player.x.toFixed(1), z: player.z.toFixed(1), hearts: player.hearts,
    moguVisible: player.mogu.visible, moguScale: [player.mogu.scale.x.toFixed(2), player.mogu.scale.y.toFixed(2)],
    moguHasMap: !!player.moguMat.map, moguMapImg: !!(player.moguMat.map && player.moguMat.map.image) } : null,
});

// ── 메인 루프 ──
const clock = new THREE.Clock();
let gameTime = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  if (state === 'play' && player && world) {
    gameTime += dt;
    elapsed += dt;
    if (boost > 0) boost -= dt;

    const ev = player.update(gameTime, dt, keys);
    for (const e of ev) {
      if (e.type === 'hit') {
        G.audio.hit();
        if (e.hearts <= 0) dieAndOfferContinue();
      } else if (e.type === 'pickup') {
        world.setCollected(e.id);
        if (e.kind === 'fish') G.audio.fish(); else G.audio.pickup();
      } else if (e.type === 'slow') { G.audio.stuck(); }
      else if (e.type === 'stuck') { G.audio.stuck(); G.ui.toast('모래톱에 걸렸다!', 1.2); }
      else if (e.type === 'gateboost') { boost = 1.2; G.audio.whoosh(); G.ui.toast('폭포 통과!', 1.2); }
      else if (e.type === 'chicken') {
        player.attachChicken(() => world.makeChicken());
        G.audio.cluck();
        G.ui.toast('🐔 닭이 바구니에 올라탔다!', 2.2);
      } else if (e.type === 'finish') {
        clearStage();
      }
    }

    const zone = player.zoneAt(player.z);
    world.update(gameTime, dt, player.z, player.x, zone === 'blizzard');

    // HUD
    const speedLabel = zone === 'rapid' ? '🌊 급류!' : zone === 'blizzard' ? '❄ 눈보라'
      : keys.up ? '▲▲ 가속' : keys.down ? '▽ 감속' : '';
    G.ui.hud(player.hearts, stageNo, player.z / stage.finishZ,
      player.itemCount - player.fishCount, churTotal, player.fishCount, speedLabel);
    G.audio.setWaterLevel(Math.min(1, player.currentSpeed() / 16) + (zone === 'rapid' ? 0.3 : 0));

    // 카메라
    const cz = player.z;
    const tx = player.x * 0.72 + stage.cx(cz) * 0.28;
    const damp = 1 - Math.exp(-dt * 5);
    camera.position.x += (tx - camera.position.x) * damp;
    camera.position.y += (6.4 - camera.position.y) * damp;
    camera.position.z = cz - 8.6;
    const lx = stage.cx(cz + 13) * 0.8 + player.x * 0.2;
    camera.lookAt(lx, 0.6, cz + 13);
    camera.rotateZ(-player.vx * 0.011);
    const fovT = 60 + (zone === 'rapid' || boost > 0 || keys.up ? 6 : 0);
    camera.fov += (fovT - camera.fov) * damp;
    camera.updateProjectionMatrix();
  } else if (state === 'continue') {
    // 컨티뉴 카운트다운
    if (reviveDelay > 0) {
      reviveDelay -= dt;
      if (reviveDelay <= 0) {
        player.reviveAtCurrent();
        state = 'play';
        G.ui.hideAll();
        G.ui.toast('GO!', 1.0);
      }
    } else {
      countdownAcc += dt;
      if (countdownAcc >= 1) {
        countdownAcc -= 1;
        countdown--;
        if (countdown <= 0) { giveUp(); }
        else { G.ui.setCountdown(countdown); G.audio.beep(countdown <= 3); }
      }
    }
    if (world && player) world.update(gameTime, dt * 0.15, player.z, player.x, false);
  } else if ((state === 'result' || state === 'pause') && world && player) {
    // 배경 살짝 살아있게
    world.update(gameTime, dt * 0.25, player.z, player.x, false);
  }

  renderer.render(scene, camera);
}
frame();
