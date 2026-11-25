// browser-test.mjs — 런처 카드 + 모구 슬로프 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node moguslope/test/browser-test.mjs
// WebGL 은 헤드리스에서 SwiftShader 로 그린다 — 느려서 정해진 시간 대신 상태를 기다린다.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguslope', 'test');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8779, r));

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: true, args } : { channel: 'chrome', headless: true, args });
const fails = [], errors = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const watch = (pg) => { pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push(String(e))); };
const until = (pg, f, ms = 30000, arg = null) => pg.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
watch(page);
const S = (f, a) => page.evaluate(f, a);
const D = () => S(() => window.MSL._dbg());
const shot = (n) => page.screenshot({ path: join(shots, n) });
const key = (code, k, type = 'keydown') => S(([c, kk, t]) => window.dispatchEvent(new KeyboardEvent(t, { code: c, key: kk })), [code, k, type]);

// ══ 1. 런처 → 타이틀 ══
await page.goto('http://localhost:8779/');
await page.waitForTimeout(400);
check('런처: 모구 슬로프 카드', await S(() => document.getElementById('card-moguslope')?.getAttribute('href') === 'moguslope.html'));
await page.fill('#game-search', '슬로프');
await page.waitForTimeout(150);
check('런처 검색 "슬로프" → 카드 1개', await S(() => [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-moguslope');
await page.waitForTimeout(1500);
await S(() => localStorage.removeItem('moguslope-save-v1'));
await page.reload(); await page.waitForTimeout(2500);
check('타이틀 · 코스 6칸 · 1코스와 끝없는 모드만 열림', await S(() => {
  const c = [...document.querySelectorAll('#courses .course')];
  return !document.getElementById('title-screen').classList.contains('hidden') && c.length === 6 && !c[0].classList.contains('lock') && c[1].classList.contains('lock') && !c[5].classList.contains('lock');
}));
check('WebGL: 코스 조각을 그린다 · 카메라 정상 좌표', await S(() => { const R = window.MSL.R3; return R.chunks.size >= 4 && R.renderer.info.render.triangles > 3000 && R.camera.position.toArray().every(Number.isFinite); }));
check('타이틀은 초당 20번 남짓만 그린다 (발열 방지)', await S(async () => { const R = window.MSL.R3, f0 = R.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 1000)); return R.renderer.info.render.frame - f0 <= 24; }));
check('잠긴 코스는 눌러도 안 골라진다', await S(() => { document.querySelector('.course[data-c="1"]').click(); return window.MSL.ui.sel === 0; }));
await shot('shot-title.png');

// ══ 2. 1코스 출발 → 3·2·1 → 조향 · 점프 ══
await key('Enter', 'Enter');
check('Enter → 3·2·1 카운트다운', await until(page, () => window.MSL._dbg().mode === 'ready' && !document.getElementById('count').classList.contains('hidden')));
check('카운트다운 끝 → 출발', await until(page, () => window.MSL._dbg().mode === 'play', 15000));
const u0 = (await D()).u;
await key('KeyD', 'ㅇ'); await page.waitForTimeout(700); await key('KeyD', 'ㅇ', 'keyup');
check('한글 입력 상태 D(ㅇ) 키로 오른쪽 조향', (await D()).u > u0 + 0.5, `${u0.toFixed(2)} → ${(await D()).u.toFixed(2)}`);
await key('Space', ' ');
check('Space → 점프', await until(page, () => window.MSL._dbg().air, 3000));
check('HUD: 하트 3 · 진행 막대 · 속도', await S(() => document.getElementById('hearts').textContent.startsWith('❤❤❤') && /\/ 1100 m/.test(document.getElementById('dist').textContent) && /km\/h/.test(document.getElementById('speed').textContent)));
await page.waitForTimeout(800);
await shot('shot-ride.png');

// ══ 3. 쉬기 · 자동 운전으로 결승 → 결과 · 기록 ══
await key('Escape', 'Escape');
check('Esc → 쉬기 (주행 멈춤)', await until(page, () => window.MSL._dbg().mode === 'pause'));
const sP = (await D()).s; await page.waitForTimeout(500);
check('쉬는 동안 안 움직인다', (await D()).s === sP);
await key('Escape', 'Escape');
check('Esc → 다시 주행', await until(page, () => window.MSL._dbg().mode === 'play'));
check('조각은 앞뒤 일부만 남긴다 (메모리)', (await D()).chunks <= 8, `${(await D()).chunks}`);
await S(() => window.MSL._autopilot(true));
check('자동 운전 → 결승 → 결과 화면', await until(page, () => window.MSL._dbg().mode === 'result', 240000));
check('결과: 별 · 시간 · 생선', await S(() => /★/.test(document.getElementById('res-stars').textContent) && /시간/.test(document.getElementById('res-lines').textContent)));
check('기록 저장 → 2코스가 열린다', await S(() => { const d = JSON.parse(localStorage.getItem('moguslope-save-v1')); return d.best.normal.c1.stars >= 1; }) && await S(() => !document.getElementById('btn-next').classList.contains('hidden')));
await shot('shot-result.png');

// ══ 4. 다음 코스 (수로 → 물미끄럼 터널) ══
await page.click('#btn-next');
check('다음 코스 → 2코스 출발', await until(page, () => window.MSL._dbg().mode === 'play' && window.MSL._dbg().sel === 1, 15000));
await S(() => { const r = window.MSL._run(); r.s = 200; });
check('터널 구역에 들어서면 구역 이름이 바뀐다', await until(page, () => /물미끄럼/.test(document.getElementById('zone-name').textContent), 20000));
await page.waitForTimeout(1500);
await shot('shot-tube.png');

// ══ 5. 넘어지면 끝 → 결과 → 코스 고르기 ══
await S(() => { const r = window.MSL._run(); r.hearts = 1; r.invuln = 0; r.obst.push({ kind: 'duck', s: r.s + 3, u: r.u, ru: 0.7, rs: 0.6, h: 1.4, low: false, hit: false }); r.iO = 0; r.obst.sort((a, b) => a.s - b.s); });
check('하트를 다 잃으면 결과 화면 (넘어졌다)', await until(page, () => window.MSL._dbg().mode === 'result', 20000) && await S(() => /넘어졌다/.test(document.getElementById('res-title').textContent)));
await page.click('#btn-menu');
check('코스 고르기 → 타이틀 · 1코스 별 표시', await until(page, () => window.MSL._dbg().mode === 'title') && await S(() => /★/.test(document.querySelector('.course[data-c="0"] .st').textContent)));

// ══ 6. 끝없는 슬로프 ══
await S(() => { document.querySelector('.course[data-c="endless"]').click(); });
await S(() => document.getElementById('btn-start').click());
check('끝없는 슬로프 출발', await until(page, () => window.MSL._dbg().mode === 'play' && window.MSL._dbg().sel === 'endless', 15000));
await S(() => window.MSL._autopilot(true));
await page.waitForTimeout(3000);
check('끝없는 모드: 거리 표시 · 앞으로 간다', await S(() => /^\d+ m$/.test(document.getElementById('dist').textContent)) && (await D()).s > 30);
await shot('shot-endless.png');

// ══ 7. 모바일: 세로 · 끌어서 조향 · 톡 점프 · 점프 버튼 ══
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const mp = await ctx.newPage(); watch(mp);
await mp.goto('http://localhost:8779/moguslope.html'); await mp.waitForTimeout(2500);
check('모바일: 터치 모드 · 점프 버튼', await mp.evaluate(() => document.body.classList.contains('touch')));
await mp.screenshot({ path: join(shots, 'shot-mobile-title.png') });
await mp.evaluate(() => document.getElementById('btn-start').click());
await until(mp, () => window.MSL._dbg().mode === 'play', 15000);
const mu0 = await mp.evaluate(() => window.MSL._dbg().u);
const drag = async (x0, x1) => mp.evaluate(([a, b]) => {
  const cv = document.getElementById('game'), y = 500;
  const ev = (t, x) => new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' });
  cv.dispatchEvent(ev('pointerdown', a));
  return new Promise((res) => { let i = 0; const id = setInterval(() => { i++; window.dispatchEvent(ev('pointermove', a + (b - a) * Math.min(1, i / 5))); if (i > 25) { clearInterval(id); window.dispatchEvent(ev('pointerup', b)); res(); } }, 40); });
}, [x0, x1]);
await drag(195, 330);
check('끌어서 오른쪽 조향', (await mp.evaluate(() => window.MSL._dbg().u)) > mu0 + 0.8, `${mu0.toFixed(2)} → ${(await mp.evaluate(() => window.MSL._dbg().u)).toFixed(2)}`);
await mp.evaluate(() => { const cv = document.getElementById('game'); const ev = (t) => new PointerEvent(t, { pointerId: 8, clientX: 200, clientY: 500, bubbles: true, pointerType: 'touch' }); cv.dispatchEvent(ev('pointerdown')); window.dispatchEvent(ev('pointerup')); });
check('톡 치면 점프', await until(mp, () => window.MSL._dbg().air, 3000));
await until(mp, () => !window.MSL._dbg().air, 5000);
await mp.evaluate(() => document.getElementById('btn-jump').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
check('⤴ 점프 버튼', await until(mp, () => window.MSL._dbg().air, 3000));
await mp.waitForTimeout(600);
await mp.screenshot({ path: join(shots, 'shot-mobile.png') });
check('세로 화면: HUD 가 화면 안에 들어온다', await mp.evaluate(() => { const r = document.getElementById('hud-top').getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.height < 90; }));

check('콘솔 에러 0', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
