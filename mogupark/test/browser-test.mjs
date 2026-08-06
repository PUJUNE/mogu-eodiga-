// browser-test.mjs — 모구의 주차 브라우저 검증 (데스크톱 마우스 + 터치 + 빌드본)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=<크로미움 경로> node browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogupark', 'test');

execSync('python3 mogupark/build.py', { cwd: root, stdio: 'inherit' });   // 빌드본 검증까지 한 번에

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8766, r));
const BASE = 'http://127.0.0.1:8766';

const launchOpts = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launchOpts);

let fail = 0;
const errors = [];
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`PASS — ${name}${extra ? ' (' + extra + ')' : ''}`);
  else { console.log(`FAIL — ${name}${extra ? ' (' + extra + ')' : ''}`); fail++; }
};
const wire = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
};

const W = 1280, H = 800;
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
wire(page);

// ── 런처 → 타이틀 ──
await page.goto(BASE + '/index.html');
ok(await page.locator('#card-mogupark').count() === 1, '런처: mogupark 카드 존재');

await page.goto(BASE + '/mogupark/index.html');
await page.waitForFunction(() => window.MPK && window.MPK._dbg, null, { timeout: 8000 });
ok(await page.locator('#title-screen').isVisible(), '타이틀 화면 표시');
ok((await page.locator('#title-icon').getAttribute('src')) !== null, '타이틀 모구 이미지 연결');
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ── 주차장 맵 ──
await page.click('#btn-start');
ok(await page.locator('#map-screen').isVisible(), '주차장 맵 표시');
ok(await page.locator('.stage-cell').count() === 50, '50칸 생성 (5월드 × 10)',
  `${await page.locator('.stage-cell').count()}칸`);
ok(await page.locator('.stage-cell.locked').count() === 49, '미해금 판 잠김');
await page.screenshot({ path: join(shots, 'shot-map.png') });

// ── 1판 진입 → 기준점 클릭 = 출발 ──
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(400);
let d = await page.evaluate(() => window.MPK._dbg());
ok(d.mode === 'run' && d.phase === 'ready', '진입 — 기준점 대기', d.phase);
ok(await page.locator('#ready-overlay').isVisible(), '준비 안내 표시');
await page.screenshot({ path: join(shots, 'shot-ready.png') });

const REF_X = Math.round(W / 2), CLICK_Y = Math.round(H * 0.8);
const CLAMP_Y = Math.round(Math.min(H * 0.78, Math.max(H * 0.34, CLICK_Y)));
await page.mouse.move(REF_X, CLICK_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(150);
d = await page.evaluate(() => window.MPK._dbg());
ok(Math.abs(d.refX - REF_X) < 3 && Math.abs(d.refY - CLAMP_Y) < 3, '클릭 지점이 기준점(클램프)',
  `클릭 ${CLICK_Y} → 기준점 ${d.refY}`);
ok(d.phase === 'run' && d.gear === 'N', '기준점 클릭 = 출발 (N단 정지)', `gear ${d.gear}`);
ok(await page.locator('#ready-overlay').isHidden(), '출발 후 안내 사라짐');
const RY = d.refY;

// ── 주차된 다른 차가 실제로 화면에 보이는지 ──
// 부딪히면 실패하는 장애물인데 안 보이면 안 된다. 앞유리 시야에 한 대 이상 잡혀야 한다.
const carsSeen = () => page.evaluate(() => window.MPK.Render.carsOnScreen);
ok(await carsSeen() >= 1, '앞유리 시야에 주차 차량이 보인다', `${await carsSeen()}대`);

// ── 휠 위로 = D단, 크리프 전진 ──
await page.mouse.wheel(0, -120);
await page.waitForTimeout(1600);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.gear === 'D', '휠 위 = D단', `gear ${d.gear}`);
ok(d.v > 0.4, '페달 없이 크리프 전진', `v=${d.v}`);

// ── 앞으로 밀면 엑셀, 좌우 = 핸들 ──
await page.mouse.move(REF_X, RY - H * 0.3, { steps: 8 });
await page.waitForTimeout(500);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.throttle > 0.9, '앞 28%에서 엑셀 전개', `throttle ${d.throttle}`);
ok(d.v > 1.2, '가속', `v=${d.v}`);
await page.mouse.move(REF_X + W * 0.3, RY - H * 0.05, { steps: 6 });
await page.waitForTimeout(600);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.steer > 0.5, '우측 30%에서 핸들 풀 록으로', `steer(로드휠) ${d.steer}`);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ── 뒤로 당기면 브레이크 → 정지 ──
await page.mouse.move(REF_X, RY + H * 0.18, { steps: 6 });
await page.waitForTimeout(900);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.brake > 0.8 && d.v === 0, '풀 브레이크로 정지', `brake ${d.brake} v=${d.v}`);

// ── 고개 돌리기 (← →) = 백미러 확인 ──
// 콕핏 오버레이 상태 — 씬 밝기가 아니라 실제로 그려진 미러/필러 좌표로 판정한다
const cockpit = () => page.evaluate(() => ({
  mirror: window.MPK.Render.mirrorRect, pillars: window.MPK.Render.pillarRect,
  cx: document.getElementById('game-canvas').width / 2,
}));
// 시야 한가운데(±6%)를 필러가 조금이라도 침범하면 '검은 세로 바'로 보인다
const centerBlocked = (c) => {
  const lo = c.cx * 0.88, hi = c.cx * 1.12;
  return c.pillars.some(([a, b]) => a < hi && b > lo);
};

await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.headYaw > 1.0 && d.headYaw < 1.45, '→ 홀드 = 백미러 확인 각도', `headYaw ${d.headYaw}`);
let ck = await cockpit();
ok(ck.mirror.right && ck.mirror.right.x >= 0 && ck.mirror.right.x + ck.mirror.right.w <= W,
  '→ 홀드 시 우측 백미러가 화면 안에 보인다',
  ck.mirror.right ? `x ${Math.round(ck.mirror.right.x)}~${Math.round(ck.mirror.right.x + ck.mirror.right.w)}` : '안 그려짐');
ok(ck.mirror.right && !ck.pillars.some(([a, b]) => a < ck.mirror.right.x + ck.mirror.right.w && b > ck.mirror.right.x),
  '백미러가 필러에 가리지 않음');
ok(!centerBlocked(ck), '백미러 확인 시 화면 한가운데를 필러가 막지 않음',
  `필러 ${JSON.stringify(ck.pillars.map(([a, b]) => [Math.round(a), Math.round(b)]))}`);
await page.screenshot({ path: join(shots, 'shot-look.png') });

// Shift 조합 = 어깨너머 확인 (B필러 너머 뒷좌석 창)
await page.keyboard.down('Shift');
await page.waitForTimeout(800);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.headYaw > 1.9, 'Shift + → = 어깨너머 확인', `headYaw ${d.headYaw}`);
ck = await cockpit();
ok(!centerBlocked(ck), '어깨너머에서도 한가운데를 B필러가 막지 않음',
  `필러 ${JSON.stringify(ck.pillars.map(([a, b]) => [Math.round(a), Math.round(b)]))}`);
await page.keyboard.up('Shift');
await page.waitForTimeout(700);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.headYaw > 1.0 && d.headYaw < 1.45, 'Shift 떼면 백미러 각도로 복귀', `headYaw ${d.headYaw}`);

await page.keyboard.up('ArrowRight');
await page.waitForTimeout(800);
d = await page.evaluate(() => window.MPK._dbg());
ok(Math.abs(d.headYaw) < 0.15, '놓으면 정면 복귀', `headYaw ${d.headYaw}`);

// ── 미러 조절 (M) ──
const adjOf = (k) => page.evaluate((kk) => ({ ...window.MPK.mirrorAdj[kk] }), k);
const mirrorPix = () => page.evaluate(() => {
  const c = window.MPK.Render.mirrorCv.left, g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 40) s += d[i];
  return s;
});
await page.keyboard.press('KeyM');
await page.waitForTimeout(900);
ok(await page.locator('#hud-adjust').isVisible(), 'M = 미러 조절 모드 진입 (안내 표시)');
d = await page.evaluate(() => window.MPK._dbg());
ok(d.headYaw < -1.0, '조절 중엔 고른 미러 쪽으로 고개 고정', `headYaw ${d.headYaw}`);
const pixBefore = await mirrorPix();
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(60); }
for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
await page.waitForTimeout(300);
let adj = await adjOf('left');
ok(adj.pitch < 0 && adj.yaw > 0, '방향키로 좌측 미러 겨눔 (↑ = 위로 = pitch 감소)',
  `yaw ${adj.yaw.toFixed(3)} pitch ${adj.pitch.toFixed(3)}`);
ok(Math.abs(await mirrorPix() - pixBefore) > 0, '겨눈 만큼 미러에 비치는 장면이 실제로 바뀐다');
// 한계값 클램프
for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
adj = await adjOf('left');
ok(Math.abs(adj.yaw - (await page.evaluate(() => window.MPK.MIRROR_ADJ_MAX.yaw))) < 1e-6,
  '한계 각도에서 멈춘다', `yaw ${adj.yaw.toFixed(3)}`);
// 0 = 초기화
await page.keyboard.press('Digit0');
await page.waitForTimeout(200);
adj = await adjOf('left');
ok(adj.yaw === 0 && adj.pitch === 0, '0 = 이 미러 초기화');
// 다시 겨눈 뒤 세이브에 남는지
for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); }
await page.waitForTimeout(200);
const savedAdj = await page.evaluate(() => JSON.parse(localStorage.getItem('mogupark-save-v1')).mirror);
ok(savedAdj && savedAdj.left && savedAdj.left.pitch > 0, '조절값이 세이브에 남는다',
  JSON.stringify(savedAdj && savedAdj.left));
// M 으로 좌 → 우 → 룸 → 종료
await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
ok((await page.locator('#hud-adjust').textContent()).includes('우측'), 'M = 다음 미러 (우측)');
await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
ok((await page.locator('#hud-adjust').textContent()).includes('룸'), 'M = 다음 미러 (룸)');
await page.keyboard.press('KeyM'); await page.waitForTimeout(700);
ok(await page.locator('#hud-adjust').isHidden(), 'M 한 번 더 = 조절 종료');
d = await page.evaluate(() => window.MPK._dbg());
ok(Math.abs(d.headYaw) < 0.15, '조절 끝나면 고개 정면 복귀', `headYaw ${d.headYaw}`);
await page.evaluate(() => {                                   // 뒤 검사에 영향 없게 원래대로
  window.MPK.mirrorAdj.left = { yaw: 0, pitch: 0 };
  window.MPK.save.storeMirror();
});

// 왼쪽도 같은 조건 (좌우 대칭 확인)
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(700);
ck = await cockpit();
ok(ck.mirror.left && ck.mirror.left.x >= 0 && ck.mirror.left.x + ck.mirror.left.w <= W,
  '← 홀드 시 좌측 백미러가 화면 안에 보인다',
  ck.mirror.left ? `x ${Math.round(ck.mirror.left.x)}~${Math.round(ck.mirror.left.x + ck.mirror.left.w)}` : '안 그려짐');
ok(!centerBlocked(ck), '좌측 확인에서도 한가운데를 필러가 막지 않음',
  `필러 ${JSON.stringify(ck.pillars.map(([a, b]) => [Math.round(a), Math.round(b)]))} headYaw ${(await page.evaluate(() => window.MPK._dbg())).headYaw}`);
await page.keyboard.down('Shift');
await page.waitForTimeout(800);
ck = await cockpit();
ok(!centerBlocked(ck), '좌측 어깨너머에서도 한가운데를 B필러가 막지 않음',
  `필러 ${JSON.stringify(ck.pillars.map(([a, b]) => [Math.round(a), Math.round(b)]))}`);
await page.keyboard.up('Shift');
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(800);

// ── 미러가 실제로 렌더되는지 (오프스크린 캔버스 픽셀 분산) ──
const mirrorVar = await page.evaluate(() => {
  const c = window.MPK.Render.mirrorCv.left;
  const g = c.getContext('2d');
  const px = g.getImageData(0, 0, c.width, c.height).data;
  let min = 255, max = 0;
  for (let i = 0; i < px.length; i += 40) { const v = px[i]; if (v < min) min = v; if (v > max) max = v; }
  return max - min;
});
ok(mirrorVar > 20, '좌측 백미러 장면 렌더', `픽셀 대비 ${mirrorVar}`);

// ── 상태 주입: 목표 칸에 정렬 → 1초 유지 → 성공 → 리플레이 ──
await page.evaluate(() => {
  const st = window.MPK._st();
  const t = st.stage.target;
  st.car.x = t.x; st.car.z = t.z; st.car.h = t.yaw; st.car.v = 0; st.car.gear = 'N';
});
await page.mouse.move(REF_X, RY, { steps: 3 });                  // 데드존 (페달 오프)
await page.waitForTimeout(1500);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.phase === 'parked' && d.stars >= 1, '칸 정렬 정지 → 주차 성공', `stars ${d.stars}`);
await page.waitForTimeout(1400);
d = await page.evaluate(() => window.MPK._dbg());
ok(d.mode === 'replay', '성공 후 탑다운 리플레이 진입', d.mode);
ok(d.rec > 10, '궤적 샘플 기록됨', `${d.rec}개`);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(shots, 'shot-replay.png') });

// ── 리플레이 스킵 → 결과 ──
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
ok(await page.locator('#result-screen').isVisible(), '결과 화면 표시');
ok((await page.locator('#result-stars').textContent()).includes('★'), '별점 표기');
await page.screenshot({ path: join(shots, 'shot-result.png') });

// ── 저장: 클리어 기록 + 다음 판 해금 ──
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mogupark-save-v1')));
ok(saved && saved.stars && saved.stars[1] >= 1, '세이브에 별점 기록', JSON.stringify(saved && saved.stars));
await page.click('#btn-map');
ok(await page.locator('.stage-cell.locked').count() === 48, '다음 판 해금',
  `잠김 ${await page.locator('.stage-cell.locked').count()}`);

// ── 난이도 버튼 저장 ──
await page.keyboard.press('Escape');
await page.click('.diff-btn[data-diff="hard"]');
const diffSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('mogupark-save-v1')).diff);
ok(diffSaved === 'hard', '난이도 선택 저장');
await page.click('.diff-btn[data-diff="normal"]');

// ── 차가 양옆에 늘어선 판(11: 마트 주차장)에서 좌우로 고개를 돌리면 보이는지 ──
await page.evaluate(() => {
  const s = { stars: {} };
  for (let i = 1; i <= 50; i++) s.stars[i] = 3;
  localStorage.setItem('mogupark-save-v1', JSON.stringify(s));
});
await page.goto(BASE + '/mogupark/index.html');
await page.waitForFunction(() => window.MPK && window.MPK._dbg, null, { timeout: 8000 });
await page.click('#btn-start');
await page.waitForTimeout(300);
await page.locator('.stage-cell').nth(10).click();
await page.waitForTimeout(400);
await page.mouse.move(REF_X, CLICK_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(300);
for (const [key, label] of [['ArrowLeft', '왼쪽'], ['ArrowRight', '오른쪽']]) {
  await page.keyboard.down(key);
  await page.waitForTimeout(900);
  ok(await carsSeen() >= 1, `11판: 고개를 ${label}으로 돌리면 주차 차량이 보인다`, `${await carsSeen()}대`);
  await page.keyboard.up(key);
  await page.waitForTimeout(800);
}
await page.screenshot({ path: join(shots, 'shot-cars.png') });
await page.goto(BASE + '/mogupark/index.html');            // 타이틀로 복귀
await page.waitForFunction(() => window.MPK && window.MPK._dbg, null, { timeout: 8000 });

// ── 충돌 → 실패 리플레이 흐름 ──
await page.click('#btn-start');
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(300);
await page.mouse.move(REF_X, CLICK_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(150);
const hasCar = await page.evaluate(() => {
  const st = window.MPK._st();
  const c = st.stage.obstacles.find((o) => o.kind === 'car');
  if (!c) return false;
  st.car.x = c.x; st.car.z = c.z - 4; st.car.h = 0; st.car.v = 2; st.car.gear = 'D';
  return true;
});
if (hasCar) {
  await page.mouse.move(REF_X, RY - H * 0.25, { steps: 4 });
  await page.waitForFunction(() => window.MPK._dbg().phase === 'crash', null, { timeout: 6000 });
  d = await page.evaluate(() => window.MPK._dbg());
  ok(d.phase === 'crash', '충돌 → 실패', `${d.phase}/${d.mode}`);
  // 정지 화면(1.1초) → 리플레이 → 결과까지 자연 진행을 기다린다 (리플레이가 짧으면 스킵 불필요)
  await page.waitForFunction(() => window.MPK._dbg().mode === 'result', null, { timeout: 15000 });
  ok(await page.locator('#result-screen').isVisible(), '실패 후에도 결과 화면');
}

ok(errors.length === 0, '데스크톱 콘솔 에러 0건', errors.slice(0, 3).join(' | '));
await ctx.close();

// ── 빌드본 (단일 html) ──
const ctx2 = await browser.newContext({ viewport: { width: W, height: H } });
const page2 = await ctx2.newPage();
const errors2 = [];
page2.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors2.push(m.text()); });
page2.on('pageerror', (e) => errors2.push(String(e)));
await page2.goto(BASE + '/mogupark.html');
await page2.waitForFunction(() => window.MPK && window.MPK._dbg, null, { timeout: 8000 });
ok(await page2.locator('#title-screen').isVisible(), '빌드본: 타이틀 표시');
const iconSrc = await page2.locator('#title-icon').getAttribute('src');
ok(iconSrc && iconSrc.startsWith('data:image'), '빌드본: 에셋 base64 내장');
await page2.click('#btn-start');
await page2.locator('.stage-cell').first().click();
await page2.waitForTimeout(400);
await page2.mouse.move(W / 2, H * 0.7);
await page2.mouse.down(); await page2.mouse.up();
await page2.waitForTimeout(300);
const d2 = await page2.evaluate(() => window.MPK._dbg());
ok(d2.phase === 'run', '빌드본: 주행 진입');
ok(errors2.length === 0, '빌드본 콘솔 에러 0건', errors2.slice(0, 3).join(' | '));
await ctx2.close();

// ── 터치 (390×844) ──
const ctx3 = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
});
const page3 = await ctx3.newPage();
const errors3 = [];
page3.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors3.push(m.text()); });
page3.on('pageerror', (e) => errors3.push(String(e)));
await page3.goto(BASE + '/mogupark.html');
await page3.waitForFunction(() => window.MPK && window.MPK._dbg, null, { timeout: 8000 });
ok(await page3.evaluate(() => document.body.classList.contains('touch')), '터치 환경 감지');
await page3.tap('#btn-start');
await page3.locator('.stage-cell').first().tap();
await page3.waitForTimeout(400);
await page3.tap('#app', { position: { x: 195, y: 640 } });
await page3.waitForTimeout(300);
let d3 = await page3.evaluate(() => window.MPK._dbg());
ok(d3.phase === 'run', '터치: 기준점 탭 = 출발');
await page3.locator('.gearp-cell[data-gear="D"]').dispatchEvent('pointerdown', { pointerType: 'touch' });
await page3.waitForTimeout(1400);
d3 = await page3.evaluate(() => window.MPK._dbg());
ok(d3.gear === 'D' && d3.v > 0.3, '터치: 기어 버튼 + 크리프', `gear ${d3.gear} v=${d3.v}`);
ok(await page3.locator('#vbtn-look-l').isVisible(), '터치: 고개 버튼 표시');
ok(await page3.locator('#vbtn-mirror').isVisible(), '터치: 미러 조절 버튼 표시');
await page3.locator('#vbtn-mirror').dispatchEvent('pointerdown');
await page3.waitForTimeout(700);
ok(await page3.locator('#hud-adjust').isVisible(), '터치: 미러 버튼 → 조절 모드');
const tw = await page3.evaluate(() => window.MPK.mirrorAdj.left.yaw);
await page3.mouse.move(180, 420); await page3.mouse.down();
await page3.mouse.move(300, 420, { steps: 6 }); await page3.mouse.up();
await page3.waitForTimeout(200);
ok(await page3.evaluate(() => window.MPK.mirrorAdj.left.yaw) > tw, '터치: 드래그로 미러 겨눔');
await page3.locator('#vbtn-mirror').dispatchEvent('pointerdown');
await page3.locator('#vbtn-mirror').dispatchEvent('pointerdown');
await page3.locator('#vbtn-mirror').dispatchEvent('pointerdown');
await page3.waitForTimeout(500);
await page3.screenshot({ path: join(shots, 'shot-touch.png') });
ok(errors3.length === 0, '터치 콘솔 에러 0건', errors3.slice(0, 3).join(' | '));
await ctx3.close();

await browser.close();
server.close();
console.log(fail === 0 ? '\n브라우저 검증 전체 통과' : `\n실패 ${fail}건`);
process.exit(fail ? 1 : 0);
