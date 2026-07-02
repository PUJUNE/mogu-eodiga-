// browser-test.mjs — 런처 6카드 + 모구배구 브라우저 검증 (데스크톱 키보드 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguvolley', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8748, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 6장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8748/');
await page.waitForTimeout(600);
check('런처: 게임 카드 6개', await page.evaluate(() => document.querySelectorAll('.card').length === 6));
await page.screenshot({ path: join(shots, 'shot-launcher6.png') });
await page.click('#card-moguvolley');
await page.waitForTimeout(900);
check('런처 → 모구배구 타이틀', await page.evaluate(() =>
  !!window.MGV && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 시작 → 서브 → 이동·점프 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Enter → STAGE 1 (서브 대기)', await page.evaluate(() => { const d = window.MGV._dbg(); return d.mode === 'play' && d.phase === 'serve'; }));
await page.waitForTimeout(1100);
check('서브 → 랠리 전환', await page.evaluate(() => window.MGV._dbg().phase === 'rally'));
await page.evaluate(() => {   // 득점·서브 리셋 간섭 방지: 공을 상대 코트 공중에 파킹
  const s = window.MGV._st();
  s.phase = 'rally';
  s.ball = { x: 420, y: 60, vx: 0, vy: -80 };
});
const p0 = await page.evaluate(() => window.MGV._dbg().p.x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowRight');
const p1 = await page.evaluate(() => window.MGV._dbg().p.x);
check(`→ 이동 (x ${p0} → ${p1})`, p1 > p0 + 20);
await page.evaluate(() => {   // 점프 검사 전에도 재파킹
  const s = window.MGV._st();
  s.phase = 'rally';
  s.ball = { x: 420, y: 60, vx: 0, vy: -80 };
});
await page.keyboard.press('z');
await page.waitForTimeout(150);
check('점프 (공중)', await page.evaluate(() => !window.MGV._dbg().p.onGround));
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 히트: 공 근처 배치 → Space → 공이 상대 코트로 ══
await page.evaluate(() => {
  const s = window.MGV._st();
  s.phase = 'rally';
  s.p.x = 150; s.p.y = window.MGV.GROUND; s.p.onGround = true; s.p.hitCd = 0;
  s.ball = { x: 160, y: window.MGV.GROUND - 40, vx: 0, vy: 50 };
});
await page.keyboard.press(' ');
await page.waitForTimeout(200);
const bv = await page.evaluate(() => { const s = window.MGV._st(); return { vx: s.ball.vx, vy: s.ball.vy }; });
check(`히트 → 공 상승·전진 (vx=${bv.vx.toFixed(0)}, vy=${bv.vy.toFixed(0)})`, bv.vx > 100 && bv.vy < -300);

// ══ 4. 승리 흐름 (4:0에서 상대 코트에 공 낙하) ══
await page.evaluate(() => {
  const s = window.MGV._st();
  s.score = [4, 0]; s.phase = 'rally';
  s.a.x = 460; s.aiTargetX = 460; s.aiReactT = 99; s.aiJumpCd = 99;
  s.ball = { x: 300, y: 150, vx: 0, vy: 250 };
});
await page.waitForTimeout(2200);
check('5점 → 승리 화면 (★3)', await page.evaluate(() => {
  const d = window.MGV._dbg();
  return d.mode === 'win' && d.stars === 3 && !document.getElementById('win-screen').classList.contains('hidden');
}));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 상대 → STAGE 2', await page.evaluate(() => window.MGV._dbg().no === 2));

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

// ══ 6. 터치 (빌드본 moguvolley.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8748/moguvolley.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(1300);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MGV._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
await mp.evaluate(() => {     // 득점·서브 리셋 간섭 방지
  const s = window.MGV._st();
  s.phase = 'rally';
  s.ball = { x: 420, y: 60, vx: 0, vy: -80 };
});
const tp0 = await mp.evaluate(() => window.MGV._dbg().p.x);
await press('vbtn-right', true);
await mp.waitForTimeout(300);
await press('vbtn-right', false);
const tp1 = await mp.evaluate(() => window.MGV._dbg().p.x);
check(`▶ 홀드 이동 (x ${tp0} → ${tp1})`, tp1 > tp0 + 20);
await mp.evaluate(() => {     // 득점·서브 리셋 간섭 방지
  const s = window.MGV._st();
  s.phase = 'rally';
  s.ball = { x: 420, y: 60, vx: 0, vy: -80 };
});
await press('vbtn-jump', true);
await mp.waitForTimeout(150);
await press('vbtn-jump', false);
check('⬆ 점프 (공중)', await mp.evaluate(() => !window.MGV._dbg().p.onGround));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
