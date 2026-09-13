// browser-test.mjs — 런처 카드 + 모구 드래곤 라이더 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=/opt/pw-browsers/chromium node mogurider/test/browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogurider', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8768, r));

const launch = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launch);
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처 → 게임 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8768/');
await page.waitForTimeout(500);
check('런처: 모구 드래곤 라이더 카드 존재', await page.evaluate(() => {
  const a = document.getElementById('card-mogurider');
  return !!a && a.getAttribute('href') === 'mogurider.html';
}));
await page.click('#card-mogurider');
await page.waitForTimeout(800);
check('런처 → 타이틀 화면', await page.evaluate(() =>
  !!window.MDR && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 난이도 선택 ══
await page.click('.diff-btn[data-diff="easy"]');
await page.waitForTimeout(150);
check('난이도 이지 선택 반영', await page.evaluate(() =>
  window.MDR.diff === 'easy' && document.querySelector('.diff-btn[data-diff="easy"]').classList.contains('selected')));
await page.click('.diff-btn[data-diff="normal"]');
await page.waitForTimeout(150);

// ══ 3. Space 시작 → 자동 발사 → 좌우 이동 ══
await page.keyboard.press(' ');
await page.waitForTimeout(500);
check('Space → 플레이 시작', await page.evaluate(() => window.MDR._dbg().mode === 'play'));
await page.waitForTimeout(2000);
check('불꽃 자동 발사 · 편대 등장 · 거리 증가', await page.evaluate(() => {
  const s = window.MDR._st(); return s.bullets.length > 0 && s.enemies.length > 0 && s.dist > 100;
}));
const x0 = await page.evaluate(() => { const s = window.MDR._st(); s.enemies = []; s.wave.rate = 0; s.itemT = 1e9; return s.p.x; });
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(350);
await page.keyboard.up('ArrowLeft');
const x1 = await page.evaluate(() => window.MDR._dbg().px);
check(`← 이동 (x ${x0.toFixed(0)} → ${x1})`, x1 < x0 - 30);
await page.evaluate(() => { const s = window.MDR._st(); s.wave.rate = 1.5; s.p.level = 3; });
await page.waitForTimeout(2200);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 4. 보스 등장 ══
await page.evaluate(() => { const s = window.MDR._st(); s.enemies = []; s.wave.rate = 0; s.dist = window.MDR.BOSSES[0].at - 3; s.p.inv = 1e9; });
await page.waitForTimeout(2600);
check('2,800m → 보스 등장 · HP 바', await page.evaluate(() => window.MDR._dbg().boss === '까마귀 대장'));
await page.screenshot({ path: join(shots, 'shot-boss.png') });
await page.evaluate(() => { const s = window.MDR._st(); s.boss.hp = 1; });
await page.waitForTimeout(1500);
check('보스 격파 → 진행 재개', await page.evaluate(() => { const d = window.MDR._dbg(); return d.boss === null && d.dist > 2800; }));

// ══ 5. 일시정지 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
const dPause = await page.evaluate(() => window.MDR._dbg().dist);
await page.waitForTimeout(600);
check('일시정지 중 거리 멈춤', await page.evaluate((d) => window.MDR._dbg().dist === d, dPause));
await page.click('#btn-resume');
await page.waitForTimeout(200);

// ══ 6. 피격 → 게임오버 화면 + 기록 저장 ══
await page.evaluate(() => {
  const s = window.MDR._st(); s.p.inv = 0; s.p.hearts = 1; s.p.shield = false; s.p.fever = 0; s.items = []; s.coinsArr = [];
  s.enemies = [{ id: 9999, kind: 'balloon', r: 16, x: s.p.x, bx: s.p.x, y: window.MDR.PY - 16, hp: 99, vy: 0, sw: 0, wob: 0, fireT: 0, flash: 0 }];
});
await page.waitForTimeout(2300);
check('충돌 → GAME OVER 화면', await page.evaluate(() =>
  window.MDR._dbg().mode === 'over' && !document.getElementById('over-screen').classList.contains('hidden')));
check('거리·등급 표시', await page.evaluate(() =>
  /\d+ m/.test(document.getElementById('over-count').textContent) &&
  document.getElementById('over-rank').textContent.length > 2));
check('최고 기록 저장', await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('mogurider-save-v1') || '{}');
  return raw.best && raw.best.normal && raw.best.normal.score > 0;
}));
await page.screenshot({ path: join(shots, 'shot-over.png') });

// ══ 7. 재도전 → 달 착륙 CLEAR ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → 재도전', await page.evaluate(() => window.MDR._dbg().mode === 'play'));
await page.evaluate(() => {
  const s = window.MDR._st();
  s.enemies = []; s.wave.rate = 0; s.itemT = 1e9; s.bossIdx = 4; s.p.inv = 1e9;
  s.dist = window.MDR.CLEAR_DIST - 30;
});
await page.waitForTimeout(2600);
check('12,000m → 달 착륙 CLEAR 화면', await page.evaluate(() =>
  window.MDR._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
check('클리어 기록 저장', await page.evaluate(() =>
  (JSON.parse(localStorage.getItem('mogurider-save-v1') || '{}').cleared || {}).normal === true));
await page.screenshot({ path: join(shots, 'shot-clear.png') });
await page.click('#btn-win-title');
await page.waitForTimeout(300);
check('타이틀 복귀 + 클리어 표식', await page.evaluate(() =>
  window.MDR._dbg().mode === 'title' &&
  document.querySelector('.diff-btn[data-diff="normal"]').textContent.includes('👑')));

// ══ 8. 시리즈 런처 복귀 ══
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 9. 터치 (빌드본 mogurider.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
mp.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await mp.goto('http://localhost:8768/mogurider.html');
await mp.waitForTimeout(800);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
check('빌드본에 에셋 내장', await mp.evaluate(() => window.MDR.ASSETS.mogu.startsWith('data:image/png;base64,')));
const sb = await mp.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(sb.x, sb.y);
await mp.waitForTimeout(900);
check('시작 탭 → 플레이 + 가상패드 표시', await mp.evaluate(() =>
  window.MDR._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
await mp.evaluate(() => { const s = window.MDR._st(); s.enemies = []; s.wave.rate = 0; s.p.inv = 1e9; });
const tx0 = await mp.evaluate(() => window.MDR._dbg().px);
await press('vbtn-right', true);
await mp.waitForTimeout(350);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.MDR._dbg().px);
check(`▶ 홀드 이동 (x ${tx0} → ${tx1})`, tx1 > tx0 + 30);
await mp.evaluate(() => { const s = window.MDR._st(); s.wave.rate = 2; });
await mp.waitForTimeout(1500);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
