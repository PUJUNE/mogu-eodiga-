// browser-test.mjs — 런처 카드 + 모구 1on1 농구 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node mogubasket/test/browser-test.mjs
// WebGL 은 헤드리스에서 SwiftShader 로 그린다.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogubasket', 'test');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8774, r));

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: true, args } : { channel: 'chrome', headless: true, args });
const fails = [], errors = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const S = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: join(shots, n) });
// 헤드리스 SwiftShader 는 프레임이 느려 게임 시간이 실제보다 늦게 흐른다 — 정해진 시간 대신 상태를 기다린다
const until = (pg, f, ms = 20000, arg = null) => pg.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

// ══ 1. 런처 → 타이틀 ══
await page.goto('http://localhost:8774/');
await page.waitForTimeout(400);
check('런처: 모구 1on1 농구 카드', await S(() => document.getElementById('card-mogubasket')?.getAttribute('href') === 'mogubasket.html'));
await page.fill('#game-search', '농구');
await page.waitForTimeout(150);
check('런처 검색 "농구" → 카드 1개', await S(() => [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-mogubasket');
await page.waitForTimeout(2500);
check('타이틀 · 뒤에서 시범 경기', await S(() => !document.getElementById('title-screen').classList.contains('hidden') && window.MBK._dbg().mode === 'title'));
check('WebGL 렌더러 동작', await S(() => !!window.MBK.R3.renderer && window.MBK.R3.renderer.info.render.triangles > 1000));
check('상대 7명 · 첫 상대만 열림', await S(() => { const b = [...document.querySelectorAll('#opp-list .pick')]; return b.length === 7 && !b[0].classList.contains('locked') && b.slice(1).every((x) => x.classList.contains('locked')); }));
await shot('shot-title.png');

// ══ 2. 경기 시작 · 이동 · 드리블 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(1600);
check('Enter → 경기 시작 (라이브)', await S(() => window.MBK._dbg().mode === 'play' && window.MBK._dbg().phase === 'live'));
await S(() => { window.MBK._freezeAI = true; Object.assign(window.MBK._st().pl[1], { x: -6, y: 10, vx: 0, vy: 0 }); });
const y0 = await S(() => window.MBK._st().pl[0].y);
await page.keyboard.down('ArrowUp');
const moved = await until(page, (y) => window.MBK._st().pl[0].y < y - 0.8, 15000, y0);
await page.keyboard.up('ArrowUp');
check('↑ = 골대 쪽으로 이동', moved);
await S(() => { window.MBK._freezeAI = false; });
await shot('shot-play.png');

// ══ 3. 점프슛 게이지 (한글 입력 상태 키 이벤트로도) ══
await S(() => { const st = window.MBK._st(); const p = st.pl[0], o = st.pl[1]; Object.assign(p, { x: 2.2, y: 6.6, vx: 0, vy: 0, state: 'idle' }); Object.assign(o, { x: -6, y: 10, vx: 0, vy: 0 }); st.ball.holder = 0; st.off = 0; st.cleared = true; st.shotClock = 12; window.MBK._freezeAI = true; });
await S(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' })));
await page.waitForTimeout(700);
check('Space 꾹 → 점프슛 게이지 표시', await S(() => window.MBK._st().pl[0].state === 'shoot' && !document.getElementById('meter').classList.contains('hidden')));
await shot('shot-meter.png');
await S(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' })));
await page.waitForTimeout(300);
check('Space 떼면 슛이 올라간다', await S(() => window.MBK._st().ball.holder === null && !!window.MBK._st().ball.shot));
await page.waitForTimeout(1600);

// ══ 4. 덩크 컷 (낮은 각도 카메라) ══
await S(() => { const st = window.MBK._st(); st.phase = 'live'; const p = st.pl[0], o = st.pl[1]; Object.assign(p, { x: 0.2, y: 3.0, vx: 0, vy: -4.5, z: 0, state: 'run', shot: null }); Object.assign(o, { x: 5, y: 9, vx: 0, vy: 0, z: 0, state: 'idle' }); st.ball.holder = 0; st.ball.shot = null; st.off = 0; st.cleared = true; st.shotClock = 12; });
await page.keyboard.down('ArrowUp'); await page.keyboard.down('Space'); await page.waitForTimeout(80); await page.keyboard.up('Space');
await page.waitForTimeout(450);
check('달려들며 슛 → 덩크', await S(() => ['dunk', 'hang'].includes(window.MBK._st().pl[0].state) || window.MBK._st().pl[0].dunks > 0));
await shot('shot-dunk.png');
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(2200);

// ══ 5. 크로스오버 → 넘어진 수비 그림 ══
await S(() => { const st = window.MBK._st(); st.phase = 'live'; const p = st.pl[0], o = st.pl[1]; Object.assign(p, { x: 0, y: 7.6, vx: 0, vy: 0, z: 0, state: 'idle', shot: null }); Object.assign(o, { x: 0, y: 6.5, vx: 0, vy: 0, z: 0, state: 'stumble', stT: 2 }); st.ball.holder = 0; st.ball.shot = null; st.off = 0; st.cleared = true; st.shotClock = 12; });
await page.keyboard.press('KeyX');
await page.waitForTimeout(250);
check('X = 크로스오버', await S(() => window.MBK._st().pl[0].crossCd > 0));
await S(() => { window.MBK._freezeAI = false; });
await shot('shot-ankle.png');

// ══ 6. 일시정지 · 결과 · 해금 ══
await page.keyboard.press('Escape');
check('Esc → 타임아웃', await S(() => window.MBK._dbg().mode === 'pause'));
await page.keyboard.press('Escape');
await S(() => { const st = window.MBK._st(); st.score = [10, 6]; st.phase = 'live'; Object.assign(st.pl[0], { x: 0.1, y: 2.2, vx: 0, vy: 0, state: 'idle', shot: null }); Object.assign(st.pl[1], { x: 6, y: 10, state: 'idle' }); st.ball.holder = null; Object.assign(st.ball, { x: 0, y: 1.6, z: 3.4, vx: 0, vy: 0, vz: -3, shot: { idx: 0, pts: 1, kind: 'layup', make: true, t: 1, rim: true } }); });
check('11점 → 결과 화면 (승리)', await until(page, () => window.MBK._dbg().mode === 'result' && document.getElementById('res-title').textContent.includes('승리'), 30000));
check('다음 상대 해금 + 이긴 상대를 내 선수로', await S(() => window.MBK.save.oppOpen('kkokko') && window.MBK.save.canPlayAs('mouse')));
await shot('shot-result.png');
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
check('타이틀에 생쥐가 내 선수 후보로', await S(() => [...document.querySelectorAll('#my-list .pick')].some((b) => b.dataset.key === 'mouse')));
await S(() => { const M = window.MBK; for (const k of M.LADDER) M.save.data.beaten[k] = { normal: true }; M.save.store(); M.ui.refreshTitle(); });
await shot('shot-roster.png');

// ══ 7. 모바일 (가로) ══
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const mp = await ctx.newPage();
mp.on('pageerror', (e) => errors.push('[mobile] ' + String(e)));
await mp.goto('http://localhost:8774/mogubasket.html');
await mp.waitForTimeout(1500);
check('모바일: 터치 모드', await mp.evaluate(() => document.body.classList.contains('touch')));
await mp.tap('#btn-start');
await mp.waitForTimeout(1500);
check('모바일: 시작 · 패드 표시', await mp.evaluate(() => window.MBK._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display !== 'none'));
const sb = await mp.locator('#vstick').boundingBox();
await mp.evaluate(() => { window.MBK._freezeAI = true; Object.assign(window.MBK._st().pl[1], { x: -6, y: 10, vx: 0, vy: 0 }); });
const my0 = await mp.evaluate(() => window.MBK._st().pl[0].y);
const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
await mp.dispatchEvent('#vstick', 'pointerdown', { pointerId: 7, clientX: cx, clientY: cy });
await mp.dispatchEvent('#vstick', 'pointermove', { pointerId: 7, clientX: cx, clientY: cy - 60 });
const mMoved = await until(mp, (y) => window.MBK._st().pl[0].y < y - 0.5, 15000, my0);
await mp.dispatchEvent('#vstick', 'pointerup', { pointerId: 7 });
check('모바일: 스틱 위 = 골대 쪽', mMoved);
await mp.evaluate(() => { const st = window.MBK._st(); st.phase = 'live'; Object.assign(st.pl[0], { x: 2, y: 6.8, state: 'idle', shot: null }); st.ball.holder = 0; st.off = 0; st.cleared = true; });
await mp.dispatchEvent('#vb-shoot', 'pointerdown', { pointerId: 8 });
await mp.waitForTimeout(500);
check('모바일: 슛 버튼 꾹 → 게이지', await mp.evaluate(() => window.MBK._st().pl[0].state === 'shoot'));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.dispatchEvent('#vb-shoot', 'pointerup', { pointerId: 8 });
const pp = await ctx.newPage();
await pp.setViewportSize({ width: 390, height: 844 });
await pp.goto('http://localhost:8774/mogubasket.html');
await pp.waitForTimeout(800);
check('모바일 세로: 가로 전환 안내', await pp.evaluate(() => !document.getElementById('rotate-hint').classList.contains('hidden')));

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
