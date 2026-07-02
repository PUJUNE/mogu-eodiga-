// browser-test.mjs — 런처 4카드 + 모구버블 브라우저 검증 (데스크톱 키보드·마우스 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogubble', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8746, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 4장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8746/');
await page.waitForTimeout(600);
check('런처: 게임 카드 4개', await page.evaluate(() => document.querySelectorAll('.card').length === 4));
await page.screenshot({ path: join(shots, 'shot-launcher4.png') });
await page.click('#card-mogubble');
await page.waitForTimeout(900);
check('런처 → 모구버블 타이틀', await page.evaluate(() =>
  !!window.MGB && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 시작 → 조준 → 발사 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → ROUND 1 시작', await page.evaluate(() => { const d = window.MGB._dbg(); return d.mode === 'play' && d.no === 1; }));
const b0 = await page.evaluate(() => window.MGB._dbg().bubbles);
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowLeft');
const aim1 = await page.evaluate(() => window.MGB._dbg().aim);
check(`← 홀드 → 조준 회전 (aim=${aim1})`, aim1 < -0.3);
await page.keyboard.press(' ');
await page.waitForTimeout(1500);
const d1 = await page.evaluate(() => window.MGB._dbg());
check(`발사 → 착탄 (방울 ${b0} → ${d1.bubbles})`, !d1.flying && d1.bubbles !== b0);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 마우스: 조준 + 클릭 발사 ══
const cv = await page.evaluate(() => {
  const r = document.getElementById('game').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
const px = cv.x + cv.w * 0.7, py = cv.y + cv.h * 0.4;
await page.mouse.move(px, py);
await page.waitForTimeout(120);
const aimM = await page.evaluate(() => window.MGB._dbg().aim);
check(`마우스 조준 (aim=${aimM})`, aimM > 0.1);
const s0 = await page.evaluate(() => window.MGB._dbg().shots);
await page.mouse.click(px, py);
await page.waitForTimeout(1500);
const d2 = await page.evaluate(() => window.MGB._dbg());
check('클릭 발사 → 착탄', !d2.flying && (d2.shots !== s0 || d2.bubbles !== d1.bubbles || d2.score > d1.score));

// ══ 4. 압축 하강 (8발째, 상태 직접 구성으로 결정적 검증) ══
{
  await page.evaluate(() => {
    const s = window.MGB._st();
    s.grid.clear();
    s.grid.set('0,0', 0); s.grid.set('0,7', 1);
    s.cur = 2; s.shots = 7; s.phase = 'play'; s.flying = null;
  });
  await page.keyboard.press(' ');
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => window.MGB._dbg());
  check(`8발째 → 천장 하강 (drop=${d.drop})`, d.drop === 1);
  await page.screenshot({ path: join(shots, 'shot-descend.png') });
}

// ══ 5. 일시정지 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('재개', await page.evaluate(() => window.MGB._dbg().mode === 'play'));
// 시리즈 버튼 (일시정지 → 타이틀 → 시리즈)
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.click('#btn-title');
await page.waitForTimeout(300);
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 6. 터치 (빌드본 mogubble.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8746/mogubble.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이', await mp.evaluate(() => window.MGB._dbg().mode === 'play'));
const tb0 = await mp.evaluate(() => window.MGB._dbg().bubbles);
const cvm = await mp.evaluate(() => {
  const r = document.getElementById('game').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
await mp.touchscreen.tap(cvm.x + cvm.w * 0.35, cvm.y + cvm.h * 0.45);   // 탭 = 조준+발사
await mp.waitForTimeout(1500);
const td = await mp.evaluate(() => window.MGB._dbg());
check(`캔버스 탭 → 발사·착탄 (방울 ${tb0} → ${td.bubbles})`, !td.flying && (td.bubbles !== tb0 || td.score > 0));
check('터치 일시정지 버튼 표시', await mp.evaluate(() => getComputedStyle(document.getElementById('vbtn-pause')).display === 'flex'));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
