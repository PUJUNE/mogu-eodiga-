// browser-test.mjs — 런처 10카드 + 모구 남극 대모험 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogunamgeuk', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8756, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 10장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8756/');
await page.waitForTimeout(600);
check('런처: 게임 카드 10개', await page.evaluate(() => document.querySelectorAll('.card').length >= 10));
await page.screenshot({ path: join(shots, 'shot-launcher10.png') });
await page.click('#card-mogunamgeuk');
await page.waitForTimeout(900);
check('런처 → 남극 대모험 타이틀', await page.evaluate(() =>
  !!window.MNG && !document.getElementById('title-screen').classList.contains('hidden')));
// 난이도 버튼
check('난이도 버튼 4개', await page.evaluate(() => document.querySelectorAll('.diff-btn').length === 4));
await page.click('.diff-btn[data-diff="hard"]');
await page.waitForTimeout(150);
check('하드 선택 + 저장', await page.evaluate(() => window.MNG.diff === 'hard' && JSON.parse(localStorage.getItem('mogunamgeuk-save-v1')).diff === 'hard'));
await page.click('.diff-btn[data-diff="normal"]');
await page.waitForTimeout(150);
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 가속 → 조향 → 점프 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → STAGE 1 주행', await page.evaluate(() => { const d = window.MNG._dbg(); return d.mode === 'play' && d.phase === 'run'; }));
const s0 = await page.evaluate(() => window.MNG._dbg().spd);
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowUp');
const s1 = await page.evaluate(() => window.MNG._dbg().spd);
check(`↑ 홀드 → 가속 (${s0} → ${s1})`, s1 > s0 + 40);
const x0 = await page.evaluate(() => window.MNG._dbg().x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(350);
await page.keyboard.up('ArrowRight');
const x1 = await page.evaluate(() => window.MNG._dbg().x);
check(`→ 홀드 → 조향 (x ${x0} → ${x1})`, x1 > x0 + 30);
await page.keyboard.press(' ');
await page.waitForTimeout(120);
check('Space → 점프 (체공)', await page.evaluate(() => window.MNG._dbg().jump > 0.2));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 클리어 흐름 (도착 직전 주입) ══
await page.evaluate(() => {
  const s = window.MNG._st();
  s.dist = s.stage.length - 60;
  s.time = 25;
});
await page.waitForTimeout(500);
await page.screenshot({ path: join(shots, 'shot-goal.png') });
await page.waitForTimeout(1800);
check('기지 도착 → 클리어 화면', await page.evaluate(() =>
  window.MNG._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 기지 → STAGE 2', await page.evaluate(() => window.MNG._dbg().no === 2));

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
await mp.goto('http://localhost:8756/mogunamgeuk.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MNG._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const ts0 = await mp.evaluate(() => window.MNG._dbg().spd);
await press('vbtn-up', true);
await mp.waitForTimeout(500);
await press('vbtn-up', false);
const ts1 = await mp.evaluate(() => window.MNG._dbg().spd);
check(`▲ 홀드 → 가속 (${ts0} → ${ts1})`, ts1 > ts0 + 30);
const tx0 = await mp.evaluate(() => window.MNG._dbg().x);
await press('vbtn-left', true);
await mp.waitForTimeout(350);
await press('vbtn-left', false);
const tx1 = await mp.evaluate(() => window.MNG._dbg().x);
check(`◀ 홀드 → 조향 (x ${tx0} → ${tx1})`, tx1 < tx0 - 30);
await press('vbtn-fire', true);
await mp.waitForTimeout(120);
await press('vbtn-fire', false);
check('🐧 탭 → 점프', await mp.evaluate(() => window.MNG._dbg().jump > 0.15));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
