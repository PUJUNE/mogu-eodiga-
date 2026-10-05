// browser-test.mjs — 런처 카드 + 모구 배드민턴 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node mogubadminton/test/browser-test.mjs
// WebGL 은 헤드리스에서 SwiftShader 로 그린다.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogubadminton', 'test');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8777, r));

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
await page.goto('http://localhost:8777/');
await page.waitForTimeout(400);
check('런처: 모구 배드민턴 카드', await S(() => document.getElementById('card-mogubadminton')?.getAttribute('href') === 'mogubadminton.html'));
await page.fill('#game-search', '배드민턴');
await page.waitForTimeout(150);
check('런처 검색 "배드민턴" → 카드 1개', await S(() => [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-mogubadminton');
await page.waitForTimeout(2500);
check('타이틀 · 뒤에서 시범 경기', await S(() => !document.getElementById('title-screen').classList.contains('hidden') && window.MBD._dbg().mode === 'title'));
check('WebGL 렌더러 동작 · 카메라 정상 좌표', await S(() => { const R = window.MBD.R3; return R.renderer.info.render.triangles > 1000 && R.camera.position.toArray().every(Number.isFinite); }));
check('상대 7명 · 첫 상대만 열림', await S(() => { const b = [...document.querySelectorAll('#opp-list .pick')]; return b.length === 7 && !b[0].classList.contains('locked') && b.slice(1).every((x) => x.classList.contains('locked')); }));
await shot('shot-title.png');

// ══ 2. 서브 (한글 입력 상태 키 이벤트) ══
await page.keyboard.press('Enter');
check('Enter → 경기 시작 · 내 서브', await until(page, () => window.MBD._dbg().mode === 'play' && window.MBD._st().phase === 'serve' && window.MBD._st().sh.held === 0));
await until(page, () => window.MBD._st().phaseT <= 0);
await S(() => { window.MBD._freezeAI = true; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' })); });
check('Space → 하이 서브가 날아간다', await until(page, () => window.MBD._st().phase === 'rally' && window.MBD._st().sh.held === null && window.MBD._st().sh.shot === 'serveHigh'));
await S(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' })));
await shot('shot-serve.png');
check('상대가 가만히 있으면 내 득점', await until(page, () => window.MBD._st().score[0] === 1, 30000));

// ══ 3. 상대가 친 셔틀 → 낙하점 고리 → 받아 치기 ══
await until(page, () => window.MBD._st().phase === 'serve');
await S(() => {
  const st = window.MBD._st(); st.phase = 'rally';
  Object.assign(st.pl[0], { x: 0.4, y: 4.2, z: 0, vx: 0, vy: 0, swing: null, swingCd: 0 });
  Object.assign(st.pl[1], { x: 0, y: -3.5, z: 0, vx: 0, vy: 0, swing: null });
  const b = st.sh; Object.assign(b, { held: null, last: 1, serve: false, netHit: false, shot: 'clear', x: 0.6, y: -2, z: 4.5, vx: 0, vy: 3.2, vz: 2 });
  const r = window.MBD.simulate(b.x, b.y, b.z, b.vx, b.vy, b.vz); b.landing = { x: r.x, y: r.y, t: r.t, path: r.path, t0: st.t };
  Object.assign(st.pl[0], { x: r.x - 0.2, y: r.y });
});
check('상대 타구 → 노란 낙하점 고리 표시', await until(page, () => window.MBD.R3.marker.visible));
await shot('shot-marker.png');
await until(page, () => { const st = window.MBD._st(); return st.sh.z < 2.4 && st.sh.vz < 0; });
await page.keyboard.press('Space');
check('라켓에 닿을 때 Space → 받아 친다', await until(page, () => window.MBD._st().sh.last === 0 || window.MBD._st().pl[0].hits > 0, 8000));
await shot('shot-hit.png');

// ══ 4. 일시정지 · 결과 · 해금 ══
await page.keyboard.press('Escape');
check('Esc → 휴식', await S(() => window.MBD._dbg().mode === 'pause'));
await page.keyboard.press('Escape');
await S(() => {
  const st = window.MBD._st(); st.score = [10, 6]; st.phase = 'rally';
  Object.assign(st.sh, { held: null, last: 0, serve: false, netHit: false, shot: 'smash', x: 1, y: -3, z: 0.05, vx: 0, vy: 0, vz: -3 });
});
check('11점 → 결과 화면 (승리)', await until(page, () => window.MBD._dbg().mode === 'result' && document.getElementById('res-title').textContent.includes('승리'), 30000));
check('다음 상대 해금 + 이긴 상대를 내 선수로', await S(() => window.MBD.save.oppOpen('kkokko') && window.MBD.save.canPlayAs('mouse')));
await shot('shot-result.png');
await page.keyboard.press('Escape');
await S(() => { window.MBD._freezeAI = false; });

// ══ 5. 모바일 (가로) ══
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const mp = await ctx.newPage();
mp.on('pageerror', (e) => errors.push('[mobile] ' + String(e)));
await mp.goto('http://localhost:8777/mogubadminton.html');
await mp.waitForTimeout(1500);
check('모바일: 터치 모드', await mp.evaluate(() => document.body.classList.contains('touch')));
await mp.tap('#btn-start');
check('모바일: 시작 · 패드 표시', await until(mp, () => window.MBD._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display !== 'none'));
await until(mp, () => window.MBD._st().phaseT <= 0);
await mp.evaluate(() => { window.MBD._freezeAI = true; });
await mp.dispatchEvent('#vb-shoot', 'pointerdown', { pointerId: 8 });
await mp.dispatchEvent('#vb-shoot', 'pointerup', { pointerId: 8 });
check('모바일: 강타 버튼 = 서브', await until(mp, () => window.MBD._st().phase === 'rally'));
await mp.evaluate(() => { const st = window.MBD._st(); st.pl[0].x = 0; st.pl[0].y = 3.5; });
const my0 = await mp.evaluate(() => window.MBD._st().pl[0].x);
const sb = await mp.locator('#vstick').boundingBox();
const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
await mp.dispatchEvent('#vstick', 'pointerdown', { pointerId: 7, clientX: cx, clientY: cy });
await mp.dispatchEvent('#vstick', 'pointermove', { pointerId: 7, clientX: cx + 60, clientY: cy });
const moved = await until(mp, (x) => window.MBD._st().pl[0].x > x + 0.5, 15000, my0);
await mp.dispatchEvent('#vstick', 'pointerup', { pointerId: 7 });
check('모바일: 스틱으로 이동', moved);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
const pp = await ctx.newPage();
await pp.setViewportSize({ width: 390, height: 844 });
await pp.goto('http://localhost:8777/mogubadminton.html');
await pp.waitForTimeout(800);
check('모바일 세로: 가로 전환 안내', await pp.evaluate(() => !document.getElementById('rotate-hint').classList.contains('hidden')));

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
