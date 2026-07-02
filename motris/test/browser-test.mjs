// browser-test.mjs — 런처 5카드 + 모트리스 브라우저 검증 (데스크톱 키보드 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'motris', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8747, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 5장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8747/');
await page.waitForTimeout(600);
check('런처: 게임 카드 5개', await page.evaluate(() => document.querySelectorAll('.card').length === 5));
await page.screenshot({ path: join(shots, 'shot-launcher5.png') });
await page.click('#card-motris');
await page.waitForTimeout(900);
check('런처 → 모트리스 타이틀', await page.evaluate(() =>
  !!window.MTR && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 시작 → 이동·회전·소프트·하드드롭 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → STAGE 1 시작', await page.evaluate(() => { const d = window.MTR._dbg(); return d.mode === 'play' && d.no === 1; }));
const c0 = await page.evaluate(() => window.MTR._dbg().cur);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(120);
const c1 = await page.evaluate(() => window.MTR._dbg().cur);
check(`← 이동 (x ${c0.x} → ${c1.x})`, c1.x === c0.x - 1);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(120);
const c2 = await page.evaluate(() => window.MTR._dbg().cur);
check('↑ 회전', c2.rot !== c1.rot || c2.key === 'O');
const f0 = await page.evaluate(() => window.MTR._dbg().filled);
await page.keyboard.press(' ');
await page.waitForTimeout(200);
const f1 = await page.evaluate(() => window.MTR._dbg().filled);
check(`하드드롭 → 고정 (칸 ${f0} → ${f1})`, f1 >= f0 + 4);
// 소프트드롭
const y0 = await page.evaluate(() => window.MTR._dbg().cur.y);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(400);
await page.keyboard.up('ArrowDown');
const y1 = await page.evaluate(() => window.MTR._dbg().cur.y);
check(`↓ 소프트드롭 (y ${y0} → ${y1})`, y1 > y0 + 2);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 모구 구조 흐름 (상태 주입: 바닥 줄에 모구 + 세로 I) ══
await page.evaluate(() => {
  const M = window.MTR, s = M._st();
  s.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
  for (let c = 0; c < 9; c++) s.board[M.ROWS - 1][c] = { color: '#8a8a96', mogu: c === 3, trapped: c === 3 };
  s.cur = { key: 'I', rot: 1, x: 7, y: 10, mogu: [false, false, false, false] };
  s.lines = 0; s.rescueT = 0;
});
await page.keyboard.press(' ');                       // 하드드롭 → 줄 클리어 + 구조
await page.waitForTimeout(400);
const d3 = await page.evaluate(() => window.MTR._dbg());
check(`모구 구조 → 감속 타이머 (rescued=${d3.rescued}, rescueT=${d3.rescueT})`, d3.rescued >= 1 && d3.rescueT > 5);
await page.screenshot({ path: join(shots, 'shot-rescue.png') });

// ══ 4. 스테이지 클리어 (9줄 + 마지막 1줄) ══
await page.evaluate(() => {
  const M = window.MTR, s = M._st();
  s.board = Array.from({ length: M.ROWS }, () => Array(M.COLS).fill(null));
  for (let c = 0; c < 9; c++) s.board[M.ROWS - 1][c] = { color: '#8a8a96', mogu: false, trapped: false };
  s.lines = 9;
  s.cur = { key: 'I', rot: 1, x: 7, y: 10, mogu: [false, false, false, false] };
});
await page.keyboard.press(' ');
await page.waitForTimeout(400);
check('10줄 → 스테이지 클리어', await page.evaluate(() => window.MTR._dbg().phase === 'clear'));
await page.waitForTimeout(2300);
check('자동으로 STAGE 2 진입', await page.evaluate(() => { const d = window.MTR._dbg(); return d.no === 2 && d.mode === 'play'; }));

// ══ 5. 일시정지 + 시리즈 버튼 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.click('#btn-title');
await page.waitForTimeout(300);
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 6. 터치 (빌드본 motris.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8747/motris.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MTR._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const tc0 = await mp.evaluate(() => window.MTR._dbg().cur);
await press('vbtn-left', true); await mp.waitForTimeout(80); await press('vbtn-left', false);
const tc1 = await mp.evaluate(() => window.MTR._dbg().cur);
check('◀ 탭 → 이동', tc1.x === tc0.x - 1);
await press('vbtn-rot', true); await mp.waitForTimeout(80); await press('vbtn-rot', false);
const tc2 = await mp.evaluate(() => window.MTR._dbg().cur);
check('🔄 탭 → 회전', tc2.rot !== tc1.rot || tc2.key === 'O');
const tf0 = await mp.evaluate(() => window.MTR._dbg().filled);
await press('vbtn-hard', true); await mp.waitForTimeout(200); await press('vbtn-hard', false);
const tf1 = await mp.evaluate(() => window.MTR._dbg().filled);
check('⤓ 탭 → 하드드롭', tf1 >= tf0 + 4);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
