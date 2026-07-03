// browser-test.mjs — 런처 14카드 + 벽돌깨서 모구 구하기 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogubrick', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8761, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 14장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8761/');
await page.waitForTimeout(600);
check('런처: 게임 카드 14개', await page.evaluate(() => document.querySelectorAll('.card').length >= 14));
await page.screenshot({ path: join(shots, 'shot-launcher14.png') });
await page.click('#card-mogubrick');
await page.waitForTimeout(900);
check('런처 → 벽돌깨서 모구 구하기 타이틀', await page.evaluate(() =>
  !!window.MBK && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 바 이동 + 발사 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Enter → STAGE 1 플레이 (공 장전)', await page.evaluate(() => {
  const d = window.MBK._dbg();
  return d.mode === 'play' && d.phase === 'play' && d.no === 1 && d.ball.stuck;
}));
const px0 = await page.evaluate(() => window.MBK._dbg().paddle.x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(400);
await page.keyboard.up('ArrowRight');
const px1 = await page.evaluate(() => window.MBK._dbg().paddle.x);
check(`→ 홀드 → 바 이동 (x ${px0} → ${px1})`, px1 > px0 + 60);
await page.keyboard.press(' ');
await page.waitForTimeout(400);
check('Space → 발사 (공 비행)', await page.evaluate(() => {
  const d = window.MBK._dbg();
  return !d.ball.stuck;
}));
await page.waitForTimeout(1200);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 모구 구출 주입: 낙하 → 받기 → 바 확장 ══
const w0 = await page.evaluate(() => window.MBK._dbg().paddle.w);
await page.evaluate(() => {
  const s = window.MBK._st();
  s.ball.stuck = true; s.ball.vx = 0; s.ball.vy = 0;   // 공 정지
  s.drops.push({ x: s.paddle.x, y: 200, wob: 0 });
});
await page.waitForTimeout(1500);
check('모구 받기 → 구출 + 바 확장', await page.evaluate(([w0]) => {
  const d = window.MBK._dbg();
  return d.rescued === 1 && d.paddle.w === w0 + 16;
}, [w0]));
await page.screenshot({ path: join(shots, 'shot-rescue.png') });

// ══ 4. 클리어 흐름 (벽돌 정리 주입) ══
await page.evaluate(() => {
  const s = window.MBK._st();
  for (const b of s.bricks) if (b.kind !== 'steel') b.alive = false;
  s.bricks.filter((b) => b.alive).length;
});
await page.waitForTimeout(600);
check('벽돌 소진 → 클리어', await page.evaluate(() => window.MBK._dbg().phase === 'clear'));
await page.waitForTimeout(1400);
check('승리 화면 표시', await page.evaluate(() =>
  window.MBK._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 스테이지 → S2', await page.evaluate(() => window.MBK._dbg().no === 2));

// ══ 5. 마우스 드래그 + 일시정지 + 시리즈 ══
const cvBox = await page.evaluate(() => {
  const r = document.getElementById('game').getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
});
await page.mouse.move(cvBox.left + cvBox.w * 0.2, cvBox.top + cvBox.h * 0.9);
await page.mouse.down();
await page.mouse.move(cvBox.left + cvBox.w * 0.8, cvBox.top + cvBox.h * 0.9, { steps: 8 });
await page.waitForTimeout(200);
const pxDrag = await page.evaluate(() => window.MBK._dbg().paddle.x);
await page.mouse.up();
check(`마우스 드래그 → 바 이동 (x ${pxDrag})`, pxDrag > 300);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.click('#btn-title');
await page.waitForTimeout(300);
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 6. 터치 (빌드본) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8761/mogubrick.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이', await mp.evaluate(() => window.MBK._dbg().mode === 'play'));
// 탭 = 발사
const cb = await mp.evaluate(() => {
  const r = document.getElementById('game').getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
});
await mp.touchscreen.tap(cb.left + cb.w * 0.5, cb.top + cb.h * 0.6);
await mp.waitForTimeout(300);
check('탭 → 발사', await mp.evaluate(() => !window.MBK._dbg().ball.stuck));
// 드래그 = 바 이동
await mp.evaluate(() => {                              // 좌표 주입으로 드래그 재현
  const cv = document.getElementById('game');
  const r = cv.getBoundingClientRect();
  cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.8, buttons: 1 }));
  cv.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: r.left + r.width * 0.15, clientY: r.top + r.height * 0.8, buttons: 1 }));
});
await mp.waitForTimeout(300);
check('터치 드래그 → 바 이동', await mp.evaluate(() => window.MBK._dbg().paddle.x < 160));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
