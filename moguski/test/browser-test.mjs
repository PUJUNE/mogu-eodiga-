// browser-test.mjs — 런처 3카드 + 모구 스키점프(3D) 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguski', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8738, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// 홀드-릴리즈 주행: 버튼을 누른 채 활강, untilLip이 임계 이하일 때 릴리즈
async function holdReleaseRun(pg, releaseAt = 0.1) {
  await pg.keyboard.down(' ');                          // 출발 + 홀드
  for (let i = 0; i < 500; i++) {
    const d = await pg.evaluate(() => window.MSJ._dbg());
    if (d.phase === 'slide' && d.untilLip < releaseAt) break;
    if (d.phase === 'flight' || d.phase === 'landed') break;
    await pg.waitForTimeout(35);
  }
  await pg.keyboard.up(' ');                            // 릴리즈 = 도약
  for (let i = 0; i < 250; i++) {
    const d = await pg.evaluate(() => window.MSJ._dbg());
    if (d.phase === 'landed' || d.mode === 'result') break;
    await pg.waitForTimeout(80);
  }
}

// ══ 1. 런처: 카드 3장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8738/');
await page.waitForTimeout(600);
check('런처: 게임 카드 3개', await page.evaluate(() => document.querySelectorAll('.card').length >= 3));
await page.click('#card-moguski');
await page.waitForTimeout(1800);
check('런처 → 스키점프 타이틀 (3D)', await page.evaluate(() =>
  !!window.MSJ && !document.getElementById('title-screen').classList.contains('hidden') &&
  !!document.querySelector('#app canvas')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 힐 맵 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('힐 맵: 50칸 (해금 1)', await page.evaluate(() => {
  const cells = document.querySelectorAll('.stage-cell');
  return cells.length === 50 && document.querySelectorAll('.stage-cell.locked').length === 49;
}));

// ══ 3. 런: 홀드 출발 → 웅크리기 → 릴리즈 도약 → 착지 → 결과 ══
await page.click('.stage-cell:not(.locked)');
await page.waitForTimeout(1200);
check('스테이지 1 시작 (ready + 3D 지형)', await page.evaluate(() => window.MSJ._dbg().phase === 'ready'));
await page.screenshot({ path: join(shots, 'shot-ready.png') });
await page.keyboard.down(' ');
await page.waitForTimeout(500);
const mid = await page.evaluate(() => window.MSJ._dbg());
check(`홀드 → 활강 + 차지 누적 (charge=${mid.charge})`, mid.phase === 'slide' && mid.holding && mid.charge > 0.3);
await page.screenshot({ path: join(shots, 'shot-slide.png') });
await page.keyboard.up(' ');
await page.keyboard.down(' ');                          // 다시 홀드는 무효 (이미 릴리즈) — 계속 진행
await page.keyboard.up(' ');
for (let i = 0; i < 250; i++) {
  const d = await page.evaluate(() => window.MSJ._dbg());
  if (d.phase === 'landed' || d.mode === 'result') break;
  if (d.phase === 'flight' && i === 0) await page.screenshot({ path: join(shots, 'shot-flight.png') });
  await page.waitForTimeout(80);
}
const d1 = await page.evaluate(() => window.MSJ._dbg());
check(`착지 완료 (거리 ${d1.dist}m)`, d1.dist > 5);
await page.waitForTimeout(1900);
check('결과 화면 표시', await page.evaluate(() => !document.getElementById('result-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-result.png') });

// ══ 4. 타이밍 릴리즈 주행 (봇) — 거리 우위 확인 ══
await page.click('#btn-retry');
await page.waitForTimeout(700);
await holdReleaseRun(page, 0.1);
const d2 = await page.evaluate(() => window.MSJ._dbg());
check(`타이밍 릴리즈 주행 (거리 ${d2.dist}m > 조기 릴리즈 ${d1.dist}m)`, d2.dist > d1.dist);
await page.waitForTimeout(1900);
await page.screenshot({ path: join(shots, 'shot-flight-far.png') });

// ══ 5. 일시정지 ══
await page.evaluate(() => document.getElementById('btn-retry').click());
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('재개', await page.evaluate(() => window.MSJ._dbg().mode === 'run'));
await page.close();

// ══ 6. 터치 (빌드본 moguski.html) — 화면 홀드/릴리즈 ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8738/moguski.html');
await mp.waitForTimeout(1800);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const sb = await mp.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(sb.x, sb.y);
await mp.waitForTimeout(400);
const c1 = await mp.evaluate(() => { const r = document.querySelector('.stage-cell:not(.locked)').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(c1.x, c1.y);
await mp.waitForTimeout(1200);
const pDown = () => mp.evaluate(() => document.getElementById('app').dispatchEvent(
  new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 195, clientY: 500 })));
const pUp = () => mp.evaluate(() => document.getElementById('app').dispatchEvent(
  new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })));
await pDown();
await mp.waitForTimeout(500);
const tmid = await mp.evaluate(() => window.MSJ._dbg());
check(`화면 홀드 → 활강 + 차지 (터치, charge=${tmid.charge})`, tmid.phase === 'slide' && tmid.charge > 0.3);
check('터치 일시정지 버튼 표시', await mp.evaluate(() => getComputedStyle(document.getElementById('vbtn-pause')).display === 'flex'));
for (let i = 0; i < 400; i++) {
  const d = await mp.evaluate(() => window.MSJ._dbg());
  if (d.phase === 'slide' && d.untilLip < 0.12) break;
  if (d.phase !== 'slide') break;
  await mp.waitForTimeout(35);
}
await pUp();                                            // 릴리즈 = 도약
await mp.waitForTimeout(1200);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
const tEnd = await mp.evaluate(() => window.MSJ._dbg());
check(`터치 릴리즈 → 비행/착지 (phase=${tEnd.phase}, q=${tEnd.q})`, tEnd.phase === 'flight' || tEnd.phase === 'landed');
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
