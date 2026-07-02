// touch.mjs — 모바일 터치 에뮬레이션 검증 (뷰포트 390x844 + hasTouch)
// 사용: GAME_ROOT=<game 폴더> node touch.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8733, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8733/');
await page.waitForTimeout(2500);

// 1) 터치 감지 + 타이틀 문구
check('터치 모드 감지 (body.touch)', await page.evaluate(() => document.body.classList.contains('touch')));
check('타이틀 문구 = 터치 안내', await page.evaluate(() => document.getElementById('title-press').textContent.includes('터치')));
await page.screenshot({ path: join(root, 'test', 'touch-title.png') });

// 2) 타이틀 탭 → 맵
await page.touchscreen.tap(195, 400);
await page.waitForTimeout(1200);
check('타이틀 탭 → 맵 화면', await page.evaluate(() => !document.getElementById('map-screen').classList.contains('hidden')));
await page.screenshot({ path: join(root, 'test', 'touch-map.png') });

// 3) 스테이지 1 노드 탭 → 플레이 시작 + 가상 패드 표시
const node1 = await page.evaluate(() => {
  const el = document.querySelectorAll('.stage-node')[0];
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.touchscreen.tap(node1.x, node1.y);
await page.waitForTimeout(1500);
check('스테이지 탭 → 플레이 시작', await page.evaluate(() => window.MOGU._dbg().state === 'play'));
check('가상 패드 표시됨', await page.evaluate(() => getComputedStyle(document.getElementById('vpad')).display === 'block'));
await page.screenshot({ path: join(root, 'test', 'touch-play.png') });

// 4) ◀ 버튼 홀드 → 좌로 이동 (pointer 이벤트 경유)
const press = (id, v) => page.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const x0 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.x));
await press('vbtn-left', true);
await page.waitForTimeout(700);
await press('vbtn-left', false);
const x1 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.x));
check(`◀ 홀드 → 좌로 이동 (x ${x0} → ${x1})`, x1 > x0); // 화면 왼쪽 = 월드 +X
check('버튼 뗀 뒤 키 해제', await page.evaluate(() => !window.__keysStuck && true));

// 5) ▲ 가속 홀드 → 전진 빨라짐
const z0 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.z));
await press('vbtn-up', true);
await page.waitForTimeout(800);
await press('vbtn-up', false);
const z1 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.z));
check(`▲ 가속 전진 (z ${z0} → ${z1})`, z1 > z0 + 3);
await page.screenshot({ path: join(root, 'test', 'touch-play-mid.png') });

// 6) ⏸ 탭 → 일시정지 → 계속 탭 → 재개
await press('vbtn-pause', true);
await page.waitForTimeout(300);
check('⏸ 탭 → 일시정지', await page.evaluate(() => window.MOGU._dbg().state === 'pause'));
check('일시정지 중 패드 숨김', await page.evaluate(() => getComputedStyle(document.getElementById('vpad')).display === 'none'));
await page.screenshot({ path: join(root, 'test', 'touch-pause.png') });
const resumeBtn = await page.evaluate(() => {
  const r = document.getElementById('btn-resume').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.touchscreen.tap(resumeBtn.x, resumeBtn.y);
await page.waitForTimeout(300);
check('계속 탭 → 재개', await page.evaluate(() => window.MOGU._dbg().state === 'play'));

// 7) 사망 → 컨티뉴: 화면 탭 = 코인 → 부활
await page.evaluate(() => window.MOGU._die());
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, 'test', 'touch-continue.png') });
await page.touchscreen.tap(195, 300);
await page.waitForTimeout(1200);
check('컨티뉴 화면 탭 → 코인 → 부활', await page.evaluate(() => window.MOGU._dbg().state === 'play' && window.MOGU._dbg().player.hearts === 3));

// 8) 사망 → 포기 버튼 탭 → 맵
await page.evaluate(() => window.MOGU._die());
await page.waitForTimeout(400);
const giveupBtn = await page.evaluate(() => {
  const r = document.getElementById('btn-giveup').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.touchscreen.tap(giveupBtn.x, giveupBtn.y);
await page.waitForTimeout(1500);
check('포기 탭 → 맵 복귀', await page.evaluate(() => window.MOGU._dbg().state === 'map'));

console.log(errors.length ? '콘솔 에러:\n' + errors.join('\n') : '콘솔 에러 없음');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
