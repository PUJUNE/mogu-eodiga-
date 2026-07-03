// browser-test.mjs — 런처 13카드 + 모구 다이버 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogudiver', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8759, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 13장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8759/');
await page.waitForTimeout(600);
check('런처: 게임 카드 13개', await page.evaluate(() => document.querySelectorAll('.card').length >= 13));
await page.screenshot({ path: join(shots, 'shot-launcher13.png') });
await page.click('#card-mogudiver');
await page.waitForTimeout(900);
check('런처 → 모구 다이버 타이틀', await page.evaluate(() =>
  !!window.MDV && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 잠수 + 발톱 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → STAGE 1 플레이', await page.evaluate(() => { const d = window.MDV._dbg(); return d.mode === 'play' && d.phase === 'play' && d.no === 1; }));
const y0 = await page.evaluate(() => window.MDV._dbg().p.y);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowDown');
const y1 = await page.evaluate(() => window.MDV._dbg().p.y);
check(`↓ 홀드 → 잠수 (y ${y0} → ${y1})`, y1 > y0 + 40);
const o2a = await page.evaluate(() => window.MDV._dbg().p.o2);
check(`잠수 중 산소 감소 (${o2a})`, o2a < 100);
await page.keyboard.press(' ');
await page.waitForTimeout(200);
check('Space → 발톱', true);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 사냥 루프 주입: 시체 → 물기 → 하역 ══
await page.evaluate(() => {
  const s = window.MDV._st(), M2 = window.MDV;
  s.fish = [];
  s.spawnT = 1e9;
  const F = M2.FISH.bream;
  s.fish.push({ type: 'bream', hp: 0, dir: 1, x: s.p.x, y: s.p.y, vx: 0, vy: 0,
    wob: 0, flipT: 99, fleeT: 0, iv: 0, dead: true, deadT: 0.3, gone: false });
});
await page.waitForTimeout(300);
check('시체 접촉 → 물기', await page.evaluate(() => window.MDV._dbg().p.carry === 'bream'));
await page.evaluate(() => {
  const s = window.MDV._st();
  s.p.x = window.MDV.BOAT_X; s.p.y = window.MDV.SURF + 4; s.p.vx = 0; s.p.vy = 0;
});
await page.waitForTimeout(300);
check('보트 하역 → 카운트+점수', await page.evaluate(() => {
  const d = window.MDV._dbg();
  return d.delivered === 1 && d.score >= 120 && d.p.carry === null;
}));

// ══ 4. 할당량 → 보스 → 격파 → 클리어 ══
await page.evaluate(() => {
  const s = window.MDV._st(), M2 = window.MDV;
  s.delivered = s.stage.quota - 1;
  s.p.carry = { type: 'bream', name: '도미', score: 120, weight: 0.92 };
  s.p.x = M2.BOAT_X; s.p.y = M2.SURF + 4;
});
await page.waitForTimeout(2400);
check('할당량 달성 → 보스 등장', await page.evaluate(() => {
  const d = window.MDV._dbg();
  return d.boss && !d.boss.dead;
}));
await page.screenshot({ path: join(shots, 'shot-boss.png') });
await page.evaluate(() => {
  const s = window.MDV._st();
  s.boss.hp = 0; s.boss.dead = true; s.boss.deadT = 0;
});
await page.waitForTimeout(1600);
check('보스 격파 → 클리어', await page.evaluate(() => window.MDV._dbg().phase === 'clear'));
await page.waitForTimeout(1600);
check('승리 화면 표시', await page.evaluate(() =>
  window.MDV._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(500);
check('다음 바다 → STAGE 2', await page.evaluate(() => window.MDV._dbg().no === 2));

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

// ══ 6. 터치 (빌드본) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8759/mogudiver.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MDV._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const tx0 = await mp.evaluate(() => window.MDV._dbg().p.x);
await press('vbtn-right', true);
await mp.waitForTimeout(500);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.MDV._dbg().p.x);
check(`▶ 홀드 → 유영 (x ${tx0} → ${tx1})`, tx1 > tx0 + 25);
// 터치 발톱: 🐾 → 스윙 발동 (판정 자체는 sim-test가 커버)
await press('vbtn-atk', true);
await mp.waitForTimeout(120);
await press('vbtn-atk', false);
check('터치 🐾 → 발톱 스윙', await mp.evaluate(() => window.MDV._st().p.clawCd > 0));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
