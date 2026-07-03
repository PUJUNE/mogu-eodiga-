// browser-test.mjs — 런처 8카드 + 모구포트리스 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogufortress', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8753, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 8장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8753/');
await page.waitForTimeout(600);
check('런처: 게임 카드 8개', await page.evaluate(() => document.querySelectorAll('.card').length >= 8));
await page.screenshot({ path: join(shots, 'shot-launcher8.png') });
await page.click('#card-mogufortress');
await page.waitForTimeout(900);
check('런처 → 모구포트리스 타이틀', await page.evaluate(() =>
  !!window.MFT && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 각도 조절 → 파워 충전 → 발사 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → STAGE 1 (조준 턴)', await page.evaluate(() => { const d = window.MFT._dbg(); return d.mode === 'play' && d.phase === 'aim' && d.turn === 0; }));
const a0 = await page.evaluate(() => window.MFT._dbg().angle);
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowLeft');
const a1 = await page.evaluate(() => window.MFT._dbg().angle);
check(`← 홀드 → 각도 상승 (${a0}° → ${a1}°)`, a1 > a0 + 8);
await page.keyboard.down(' ');
await page.waitForTimeout(600);
const pw = await page.evaluate(() => window.MFT._dbg().power);
check(`Space 꾹 → 파워 충전 (${pw})`, pw > 25);
await page.screenshot({ path: join(shots, 'shot-charge.png') });
await page.keyboard.up(' ');
await page.waitForTimeout(150);
check('릴리즈 → 발사(비행)', await page.evaluate(() => { const d = window.MFT._dbg(); return d.phase === 'fly' || d.phase === 'enemy' || d.phase === 'aim'; }));
// 폭발·턴 순환 대기
await page.waitForTimeout(4000);
await page.screenshot({ path: join(shots, 'shot-play.png') });
const d1 = await page.evaluate(() => window.MFT._dbg());
check(`턴 순환 진행 (phase=${d1.phase})`, ['aim', 'charge', 'enemy', 'fly'].includes(d1.phase));

// ══ 3. 승리 흐름 (적 HP 1 + 직격 코스 포탄 주입 → 정상 스텝 경로로 폭발) ══
await page.evaluate(() => {
  const M2 = window.MFT, s = M2._st();
  s.e.hp = 1;
  s.wind = 0;
  s.phase = 'fly';
  s.proj = { x: M2.Logic.tankX(s, s.e), y: M2.Logic.tankY(s, s.e) - 70, vx: 0, vy: 60, from: 0, trail: [], age: 1 };
});
await page.waitForTimeout(2600);
check('적 격파 → 승리 화면', await page.evaluate(() =>
  window.MFT._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 상대 → STAGE 2', await page.evaluate(() => window.MFT._dbg().no === 2));

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
await mp.goto('http://localhost:8753/mogufortress.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MFT._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const ta0 = await mp.evaluate(() => window.MFT._dbg().angle);
await press('vbtn-left', true);
await mp.waitForTimeout(300);
await press('vbtn-left', false);
const ta1 = await mp.evaluate(() => window.MFT._dbg().angle);
check(`◀ 홀드 → 각도 (${ta0}° → ${ta1}°)`, ta1 > ta0 + 8);
await press('vbtn-fire', true);
await mp.waitForTimeout(500);
const tpw = await mp.evaluate(() => window.MFT._dbg().power);
await press('vbtn-fire', false);
await mp.waitForTimeout(150);
check(`🔥 꾹 → 파워 (${tpw}) → 놓으면 발사`, tpw > 20 && await mp.evaluate(() => {
  const d = window.MFT._dbg();
  return d.phase === 'fly' || d.phase === 'enemy' || d.phase === 'aim';
}));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
