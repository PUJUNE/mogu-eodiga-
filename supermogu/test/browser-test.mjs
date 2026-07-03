// browser-test.mjs — 런처 11카드 + 슈퍼모구 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'supermogu', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8757, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 11장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8757/');
await page.waitForTimeout(600);
check('런처: 게임 카드 11개', await page.evaluate(() => document.querySelectorAll('.card').length >= 11));
await page.screenshot({ path: join(shots, 'shot-launcher11.png') });
await page.click('#card-supermogu');
await page.waitForTimeout(900);
check('런처 → 슈퍼모구 타이틀', await page.evaluate(() =>
  !!window.SMG && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 달리기 → 점프 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → STAGE 1 플레이', await page.evaluate(() => { const d = window.SMG._dbg(); return d.mode === 'play' && d.phase === 'play'; }));
const x0 = await page.evaluate(() => window.SMG._dbg().x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
const x1 = await page.evaluate(() => window.SMG._dbg().x);
check(`→ 홀드 → 달리기 (x ${x0} → ${x1})`, x1 > x0 + 40);
await page.keyboard.down(' ');
await page.waitForTimeout(180);
check('Space → 점프 (체공)', await page.evaluate(() => { const d = window.SMG._dbg(); return !d.onG || d.vy < -20; }));
await page.keyboard.up(' ');
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(700);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 클리어 흐름 (깃발 직전 주입) ══
await page.evaluate(() => {
  const s = window.SMG._st();
  s.p.x = s.stage.flagX - 24;   // 골인 계단 위 공중에서 낙하하며 깃발 통과
  s.p.y = 3 * 16;
  s.p.vy = 0;
});
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: join(shots, 'shot-goal.png') });
await page.waitForTimeout(1600);
check('깃발 도달 → 클리어 화면', await page.evaluate(() =>
  window.SMG._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 스테이지 → STAGE 2', await page.evaluate(() => window.SMG._dbg().no === 2));

// ══ 4. 일시정지 + 시리즈 버튼 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.click('#btn-title');
await page.waitForTimeout(300);
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 5. 터치 (빌드본) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8757/supermogu.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.SMG._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const tx0 = await mp.evaluate(() => window.SMG._dbg().x);
await press('vbtn-right', true);
await mp.waitForTimeout(600);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.SMG._dbg().x);
check(`▶ 홀드 → 달리기 (x ${tx0} → ${tx1})`, tx1 > tx0 + 30);
await press('vbtn-a', true);
await mp.waitForTimeout(150);
const jumped = await mp.evaluate(() => { const d = window.SMG._dbg(); return !d.onG || d.vy < -20; });
await press('vbtn-a', false);
check('Ⓐ 탭 → 점프', jumped);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
