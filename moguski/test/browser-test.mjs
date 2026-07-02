// browser-test.mjs — 런처 3카드 + 모구 스키점프 브라우저 검증 (데스크톱 + 터치)
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

// 도약 타이밍에 맞춰 탭하는 헬퍼 (untilLip 폴링)
async function timedRun(pg, holdPosture) {
  await pg.evaluate(() => { /* 시작 탭 */ });
  for (let i = 0; i < 400; i++) {
    const d = await pg.evaluate(() => window.MSJ._dbg());
    if (d.phase === 'slide' && d.untilLip < 0.12) break;
    if (d.phase !== 'slide' && d.phase !== 'ready') break;
    await pg.waitForTimeout(40);
  }
  await pg.keyboard.press(' ');                       // 도약 탭
  if (holdPosture) {
    // 자세: P를 존 안에 유지하도록 펄스 홀드
    for (let i = 0; i < 120; i++) {
      const d = await pg.evaluate(() => window.MSJ._dbg());
      if (d.phase !== 'flight') break;
      if (d.P < 0.6) await pg.keyboard.down(' '); else await pg.keyboard.up(' ');
      await pg.waitForTimeout(45);
    }
    await pg.keyboard.up(' ');
  }
  for (let i = 0; i < 200; i++) {
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
check('런처: 게임 카드 3개', await page.evaluate(() => document.querySelectorAll('.card').length === 3));
await page.screenshot({ path: join(shots, 'shot-launcher3.png') });
await page.click('#card-moguski');
await page.waitForTimeout(1000);
check('런처 → 스키점프 타이틀', await page.evaluate(() => !!window.MSJ && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 힐 맵 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('힐 맵: 50칸 (해금 1)', await page.evaluate(() => {
  const cells = document.querySelectorAll('.stage-cell');
  return cells.length === 50 && document.querySelectorAll('.stage-cell.locked').length === 49;
}));
await page.screenshot({ path: join(shots, 'shot-map.png') });

// ══ 3. 런: 출발 → 활강 → 타이밍 도약 → 자세 → 착지 → 결과 ══
await page.click('.stage-cell:not(.locked)');
await page.waitForTimeout(500);
check('스테이지 1 시작 (ready)', await page.evaluate(() => window.MSJ._dbg().phase === 'ready'));
await page.keyboard.press(' ');                       // 출발
await page.waitForTimeout(300);
check('탭 → 활강 시작', await page.evaluate(() => window.MSJ._dbg().phase === 'slide'));
await timedRun(page, true);
const d1 = await page.evaluate(() => window.MSJ._dbg());
check(`착지 완료 (거리 ${d1.dist}m, 목표 41m)`, d1.dist > 10);
await page.waitForTimeout(1800);
check('결과 화면 표시', await page.evaluate(() => !document.getElementById('result-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-result.png') });
const cleared = d1.stars > 0;
console.log(`  (참고: 봇 주행 별점 ${d1.stars} — 타이밍 폴링 정밀도에 따라 변동)`);

// 클리어했다면 맵에서 2번 해금 확인
await page.click('#btn-map');
await page.waitForTimeout(400);
if (cleared) {
  check('클리어 → 다음 힐 해금', await page.evaluate(() => document.querySelectorAll('.stage-cell.locked').length === 48));
} else {
  check('미클리어 → 해금 유지', await page.evaluate(() => document.querySelectorAll('.stage-cell.locked').length === 49));
}

// ══ 4. 일시정지 ══
await page.click('.stage-cell:not(.locked)');
await page.waitForTimeout(400);
await page.keyboard.press(' ');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('재개', await page.evaluate(() => window.MSJ._dbg().mode === 'run'));
await page.close();

// ══ 5. 터치 (빌드본 moguski.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8738/moguski.html');
await mp.waitForTimeout(800);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const sb = await mp.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(sb.x, sb.y);
await mp.waitForTimeout(400);
const c1 = await mp.evaluate(() => { const r = document.querySelector('.stage-cell:not(.locked)').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(c1.x, c1.y);
await mp.waitForTimeout(500);
await mp.touchscreen.tap(195, 500);                   // 화면 탭 = 출발
await mp.waitForTimeout(300);
check('화면 탭 → 활강 시작 (터치)', await mp.evaluate(() => window.MSJ._dbg().phase === 'slide'));
check('터치 일시정지 버튼 표시', await mp.evaluate(() => getComputedStyle(document.getElementById('vbtn-pause')).display === 'flex'));
await mp.waitForTimeout(2500);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
const dphase = await mp.evaluate(() => window.MSJ._dbg().phase);
check(`터치 무개입 런 진행 (phase=${dphase})`, dphase === 'flight' || dphase === 'landed' || dphase === 'slide');
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
