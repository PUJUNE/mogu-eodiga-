// browser-test.mjs — 모구레이스 브라우저 검증 (데스크톱 마우스 + 터치 + 빌드본)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=<크로미움 경로> node browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogurace', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }   // 브라우저 기본 요청
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8764, r));
const BASE = 'http://127.0.0.1:8764';

const launchOpts = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launchOpts);

let fail = 0;
const errors = [];
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`PASS — ${name}${extra ? ' (' + extra + ')' : ''}`);
  else { console.log(`FAIL — ${name}${extra ? ' (' + extra + ')' : ''}`); fail++; }
};
const wire = (p) => {
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
};

const W = 1280, H = 800;
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
wire(page);

// ── 런처 → 타이틀 ──
await page.goto(BASE + '/index.html');
ok(await page.locator('#card-mogurace').count() === 1, '런처: mogurace 카드 존재');

await page.goto(BASE + '/mogurace/index.html');
await page.waitForFunction(() => window.MRC && window.MRC._dbg, null, { timeout: 8000 });
ok(await page.locator('#title-screen').isVisible(), '타이틀 화면 표시');
ok((await page.locator('#title-icon').getAttribute('src')) !== null, '타이틀 모구 이미지 연결');
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ── 코스 맵 ──
await page.click('#btn-start');
ok(await page.locator('#map-screen').isVisible(), '코스 맵 표시');
ok(await page.locator('.stage-cell').count() === 30, '코스 30칸 생성',
  `${await page.locator('.stage-cell').count()}칸`);
ok(await page.locator('.stage-cell.locked').count() === 29, '미해금 코스 잠김');
await page.screenshot({ path: join(shots, 'shot-map.png') });

// ── 코스 1 진입 → 기준점 설정 ──
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(400);
let d = await page.evaluate(() => window.MRC._dbg());
ok(d.mode === 'run' && d.phase === 'ready', '주행 진입 — 기준점 대기', d.phase);
ok(await page.locator('#ready-overlay').isVisible(), '준비 안내 표시');
await page.screenshot({ path: join(shots, 'shot-ready.png') });

const REF_X = Math.round(W / 2), REF_Y = Math.round(H * 0.8);
await page.mouse.move(REF_X, REF_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(120);
d = await page.evaluate(() => window.MRC._dbg());
ok(Math.abs(d.refX - REF_X) < 3 && Math.abs(d.refY - REF_Y) < 3, '클릭한 자리가 기준점',
  `(${d.refX}, ${d.refY})`);
ok(d.phase === 'ready', '기준점만 잡고 아직 출발 안 함');

// ── 앞으로 밀면 엑셀 ──
await page.mouse.move(REF_X, REF_Y - H * 0.30, { steps: 8 });
await page.waitForTimeout(500);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.phase === 'run', '앞으로 밀어 출발');
ok(d.throttle > 0.95, '앞 30%에서 엑셀 전개', `throttle ${d.throttle}`);
ok(d.kmh > 0, '가속 시작', `${d.kmh} km/h`);
ok(await page.locator('#ready-overlay').isHidden(), '출발 후 안내 사라짐');

// ── 마우스를 멈추면 엑셀 유지 ──
await page.waitForTimeout(700);
const before = (await page.evaluate(() => window.MRC._dbg()));
await page.waitForTimeout(700);
const after = await page.evaluate(() => window.MRC._dbg());
ok(after.throttle === before.throttle && after.kmh > before.kmh,
  '마우스 정지 — 엑셀 유지된 채 계속 가속', `${before.kmh} → ${after.kmh} km/h`);

// ── 좌우 이동 = 조향 ──
await page.mouse.move(REF_X + W * 0.28, REF_Y - H * 0.30, { steps: 6 });
await page.waitForTimeout(400);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.steer > 0.95, '우측 28%에서 최대 우조향', `steer ${d.steer}`);
ok(d.playerX > 0, '차가 오른쪽으로 이동', `x ${d.playerX}`);
await page.mouse.move(REF_X, REF_Y - H * 0.30, { steps: 6 });
await page.waitForTimeout(300);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ── 뒤로 되돌리면 엑셀 뗌 ──
await page.mouse.move(REF_X, REF_Y + 20, { steps: 6 });
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.throttle === 0, '기준점 뒤로 되돌리면 엑셀 뗌', `throttle ${d.throttle}`);

// ── 좌클릭 = 브레이크 ──
await page.mouse.move(REF_X, REF_Y - H * 0.30, { steps: 4 });
await page.waitForTimeout(600);
const fast = (await page.evaluate(() => window.MRC._dbg())).kmh;
await page.mouse.down();
await page.waitForTimeout(700);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.brake === true, '좌클릭이 브레이크로 전달됨');
ok(d.kmh < fast, '브레이크로 감속', `${fast} → ${d.kmh} km/h`);
await page.screenshot({ path: join(shots, 'shot-brake.png') });
await page.mouse.up();

// ── 실제 주행으로 체크포인트 통과 ──
// 화면 좌표만 조작하는 미니 봇 — 중앙을 유지하며 전개 엑셀로 달린다
const t0 = Date.now();
let cp = 0;
while (Date.now() - t0 < 22000) {
  const s = await page.evaluate(() => window.MRC._dbg());
  if (s.cp > 0) { cp = s.cp; break; }
  if (s.phase !== 'run') break;
  const steer = Math.max(-1, Math.min(1, -s.playerX * 2.2));
  await page.mouse.move(REF_X + steer * W * 0.28, REF_Y - H * 0.30);
  await page.waitForTimeout(60);
}
ok(cp >= 1, '주행으로 체크포인트 통과', `CP ${cp}`);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.progress > 3, '코스 진행률 증가', `${d.progress}%`);

// ── HUD·렌더 ──
ok((await page.locator('#hud-speed').textContent()) !== '0', 'HUD 속도계 갱신');
ok(parseFloat(await page.locator('#hud-time').textContent()) > 0, 'HUD 제한시간 표시');
ok(await page.locator('#ref-cross').isVisible(), '기준점 십자선 표시');
ok(await page.locator('#cursor-dot').isVisible(), '현재 커서 표시');
const painted = await page.evaluate(() => {
  const c = document.getElementById('game-canvas');
  const g = c.getContext('2d');
  const px = g.getImageData(0, 0, c.width, Math.min(c.height, 400)).data;
  const seen = new Set();
  for (let i = 0; i < px.length; i += 4 * 997) seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
  return seen.size;
});
ok(painted > 6, '배경·도로가 실제로 그려짐', `색 ${painted}종`);

// ── 결과 화면 ──
await page.evaluate(() => { window.MRC._st().time = 0.2; });
await page.waitForTimeout(900);
ok(await page.locator('#result-screen').isVisible(), '시간 초과 시 결과 화면');
ok((await page.locator('#result-title').textContent()).includes('TIME OVER'), '시간 초과 판정 표시');
await page.screenshot({ path: join(shots, 'shot-result.png') });
await page.click('#btn-map');
ok(await page.locator('#map-screen').isVisible(), '결과 → 코스 목록 복귀');

// ── 빌드본 (단일 html) + 터치 ──
const tctx = await browser.newContext({
  viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
});
const tp = await tctx.newPage();
wire(tp);
await tp.goto(BASE + '/mogurace.html');
await tp.waitForFunction(() => window.MRC && window.MRC._dbg, null, { timeout: 8000 });
ok(await tp.locator('#title-screen').isVisible(), '빌드본: 타이틀 표시');
ok(await tp.evaluate(() => document.body.classList.contains('touch')), '빌드본: 터치 감지');
ok(await tp.evaluate(() => window.MRC.ASSETS.mogu.startsWith('data:image/png;base64,')),
  '빌드본: 모구 에셋 base64 내장');
ok(await tp.evaluate(() => document.querySelectorAll('script[src]').length === 0),
  '빌드본: 외부 스크립트 의존 없음');

await tp.tap('#btn-start');
await tp.locator('.stage-cell').first().tap();
await tp.waitForTimeout(400);
await tp.touchscreen.tap(206, 700);
await tp.waitForTimeout(200);
let td = await tp.evaluate(() => window.MRC._dbg());
ok(td.refY > 0, '빌드본: 터치로 기준점 설정', `(${td.refX}, ${td.refY})`);
await tp.locator('#app').dispatchEvent('pointermove', { clientX: 206, clientY: 430, pointerType: 'touch' });
await tp.waitForTimeout(600);
td = await tp.evaluate(() => window.MRC._dbg());
ok(td.phase === 'run' && td.throttle > 0, '빌드본: 위로 밀어 출발', `throttle ${td.throttle}`);
await tp.screenshot({ path: join(shots, 'shot-touch.png') });

ok(errors.length === 0, '콘솔 에러 0건', errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fail === 0 ? '\n✅ browser-test 전체 통과' : `\n❌ browser-test 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
