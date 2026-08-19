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
ok((await page.locator('#credits').textContent()).includes('CC BY'), 'CC-BY 크레딧 표기');
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ── 코스 맵 ──
await page.click('#btn-start');
ok(await page.locator('#map-screen').isVisible(), '코스 맵 표시');
ok(await page.locator('.stage-cell').count() === 90, '코스 90칸 생성 (15테마 × 6)',
  `${await page.locator('.stage-cell').count()}칸`);
ok(await page.locator('.stage-cell.locked').count() === 89, '미해금 코스 잠김');
await page.screenshot({ path: join(shots, 'shot-map.png') });

// ── 코스 1 진입 → 기준점 설정 ──
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(400);
let d = await page.evaluate(() => window.MRC._dbg());
ok(d.mode === 'run' && d.phase === 'ready', '주행 진입 — 기준점 대기', d.phase);
ok(await page.locator('#ready-overlay').isVisible(), '준비 안내 표시');
await page.screenshot({ path: join(shots, 'shot-ready.png') });

const REF_X = Math.round(W / 2), CLICK_Y = Math.round(H * 0.8);
// 기준점은 아래로 브레이크 20% 여유가 남도록 화면 78% 위로 클램프된다
const CLAMP_Y = Math.round(Math.min(H * 0.78, Math.max(H * 0.34, CLICK_Y)));
await page.mouse.move(REF_X, CLICK_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(120);
d = await page.evaluate(() => window.MRC._dbg());
ok(Math.abs(d.refX - REF_X) < 3 && Math.abs(d.refY - CLAMP_Y) < 3, '클릭 지점이 기준점(브레이크 여유 클램프)',
  `클릭 ${CLICK_Y} → 기준점 ${d.refY}`);
ok(d.phase === 'ready', '기준점만 잡고 아직 출발 안 함');
const RY = d.refY;                                   // 이후 조작은 실제 기준점 기준

// ── 앞으로 밀면 엑셀 ──
await page.mouse.move(REF_X, RY - H * 0.32, { steps: 8 });
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
// 전개 폭(RANGE_X)은 로직에서 읽어 온다 — 민감도를 조정해도 테스트가 따라온다.
const RANGE_X = await page.evaluate(() => window.MRC.Logic.RANGE_X);
const steerX = (s) => Math.max(2, Math.min(W - 2, REF_X + s * W * RANGE_X));   // 뷰포트 밖으로 나가지 않게
await page.mouse.move(steerX(1), RY - H * 0.32, { steps: 6 });
await page.waitForTimeout(400);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.steer > 0.95, `우측 ${RANGE_X * 100}%에서 최대 우조향`, `steer ${d.steer}`);
ok(d.playerX > 0, '차가 오른쪽으로 이동', `x ${d.playerX}`);
await page.mouse.move(REF_X, RY - H * 0.32, { steps: 6 });
await page.waitForTimeout(300);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ── 기준점 주변 데드존 = 관성 주행 ──
await page.mouse.move(REF_X, RY + 20, { steps: 6 });        // 데드존 안 (2.5% < 3.5%)
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.throttle === 0 && d.brake === 0, '데드존 — 엑셀도 브레이크도 안 밟음(관성)',
  `throttle ${d.throttle} brake ${d.brake}`);

// ── 뒤로 당긴 깊이에 비례한 브레이크 ──
await page.mouse.move(REF_X, RY - H * 0.32, { steps: 4 });
await page.waitForTimeout(600);
const fast = (await page.evaluate(() => window.MRC._dbg())).kmh;
await page.mouse.move(REF_X, RY + H * 0.07, { steps: 4 });      // 얕게
await page.waitForTimeout(250);
const shallowBrake = (await page.evaluate(() => window.MRC._dbg())).brake;
await page.mouse.move(REF_X, RY + H * 0.20, { steps: 4 });      // 깊게
await page.waitForTimeout(450);
d = await page.evaluate(() => window.MRC._dbg());
ok(shallowBrake > 0 && shallowBrake < 1 && d.brake === 1,
  '뒤로 당긴 깊이에 비례한 브레이크', `얕게 ${shallowBrake} → 깊게 ${d.brake}`);
ok(d.kmh < fast, '브레이크로 감속', `${fast} → ${d.kmh} km/h`);
await page.screenshot({ path: join(shots, 'shot-brake.png') });

// ── 실제 주행으로 체크포인트 통과 ──
// 화면 좌표만 조작하는 미니 봇 — 중앙을 유지하며 전개 엑셀로 달린다
const t0 = Date.now();
let cp = 0;
while (Date.now() - t0 < 22000) {
  const s = await page.evaluate(() => window.MRC._dbg());
  if (s.cp > 0) { cp = s.cp; break; }
  if (s.phase !== 'run') break;
  const steer = Math.max(-1, Math.min(1, -s.playerX * 2.2));
  await page.mouse.move(steerX(steer), RY - H * 0.32);
  await page.waitForTimeout(60);
}
ok(cp >= 1, '주행으로 체크포인트 통과', `CP ${cp}`);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.progress > 3, '코스 진행률 증가', `${d.progress}%`);
ok(d.trans === 'auto' && d.gear >= 3, '오토 모드 — 자동 변속으로 기어 상승', `${d.gear}단 rpm ${d.rpm}`);
ok(await page.locator('#hud-rpm-bar').isVisible(), 'RPM 게이지 표시');
ok(await page.evaluate(() => document.getElementById('hud-gear').style.display === 'none'),
  '오토 모드 — 기어 숫자 숨김 (RPM 창만)');

// ── HUD·렌더 ──
ok((await page.locator('#hud-speed').textContent()) !== '0', 'HUD 속도계 갱신');
ok(parseFloat(await page.locator('#hud-time').textContent()) > 0, 'HUD 제한시간 표시');
ok(await page.locator('#ref-cross').isVisible(), '기준점 십자선 표시');
ok(await page.locator('#cursor-dot').isVisible(), '현재 커서 표시');
const assets = await page.evaluate(() => {
  const R = window.MRC.Render;
  const ok = (im) => !!(im && im.complete && im.naturalWidth > 0);
  return {
    backdrop: ok(R.backdrop),
    bgStrip: !!(R.bgStrip && R.bgStrip.width > 0 && R.bgStrip.height > 0),
    asphalt: !!(R.asphaltLayer && R.asphaltLayer.width === R.canvas.width),
    quality: R.quality,
    traffic: R.traffic ? ['sedan', 'van', 'truck'].every((t) => (R.traffic[t] || []).length === 6) : false,
  };
});
ok(assets.backdrop, '월드 실사 배경 이미지 로드');
ok(assets.bgStrip, '배경 타일 미리 굽기 (매 프레임 재확대 안 함)');
ok(assets.asphalt, '아스팔트 결 레이어 미리 굽기 (화면 크기)');
ok(assets.quality === 1, '가벼운 화면에서는 렌더 해상도 유지', `quality ${assets.quality}`);
ok(assets.traffic, '교통 차량 후방 스프라이트 3종×6색 생성');

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

// ── 스틱 6단 모드 ──
await page.keyboard.press('Escape');
await page.click('#mode-stick');
ok(await page.evaluate(() => document.getElementById('mode-stick').classList.contains('sel')),
  '타이틀에서 스틱 모드 선택');
await page.click('#btn-start');
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(300);
await page.mouse.move(REF_X, CLICK_Y);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(100);
await page.mouse.move(REF_X, RY - H * 0.32, { steps: 4 });
await page.waitForTimeout(2600);                       // 1단 상한까지 가속
d = await page.evaluate(() => window.MRC._dbg());
ok(d.trans === 'stick' && d.gear === 1, '스틱 모드 — 자동 변속 없음', `${d.gear}단 rpm ${d.rpm}`);
ok(await page.evaluate(() => document.getElementById('hud-gear').style.display !== 'none'),
  '스틱 모드 — 기어 숫자 표시');
const v1 = d.kmh;
await page.mouse.down(); await page.mouse.up();        // 좌클릭 = 시프트 업
await page.waitForTimeout(1300);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.gear === 2 && d.kmh > v1, '좌클릭 시프트 업 → 2단 가속', `${v1} → ${d.kmh} km/h`);

// ── H패턴 기어 셀렉터 + QAWSED 직결 변속 ──
ok(await page.locator('#gear-panel').isVisible(), '스틱 모드 — H패턴 기어 패널 표시');
ok(await page.evaluate(() => document.querySelector('.gear-cell[data-gear="2"]').classList.contains('cur')),
  'H패턴 — 현재 단(2단) 하이라이트');
await page.keyboard.press('KeyW');                     // W = 3단 직결
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.gear === 3, 'W 키 → 3단 직결 변속', `${d.gear}단`);
await page.keyboard.press('KeyD');                     // D = 6단 (단 건너뛰기)
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.gear === 6, 'D 키 → 6단 직결 (단 건너뛰기)', `${d.gear}단`);
await page.locator('.gear-cell[data-gear="4"]').click();   // 버튼 클릭 = 4단
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.gear === 4, 'H패턴 버튼 클릭 → 4단', `${d.gear}단`);
const steerHold = d.steer;
await page.mouse.move(30, Math.round(H * 0.5));        // 커서가 패널 위 — 조작 좌표로 안 읽혀야
await page.waitForTimeout(250);
d = await page.evaluate(() => window.MRC._dbg());
ok(d.steer === steerHold, '기어 패널 위 커서 — 조향 유지', `steer ${d.steer}`);
await page.screenshot({ path: join(shots, 'shot-stick.png') });
await page.evaluate(() => { window.MRC._st().time = 0.1; });   // 정리
await page.waitForTimeout(700);
await page.click('#btn-map');

// ── 난이도 모드 ──
await page.keyboard.press('Escape');                   // 코스 맵 → 타이틀
const normalTime = await page.evaluate(() => window.MRC.START_TIME[0]);
await page.click('[data-diff="hard"]');
ok(await page.evaluate(() => window.MRC.diff === 'hard' && window.MRC.save.data.diff === 'hard'),
  '타이틀에서 난이도 하드 선택·저장');
await page.click('#btn-start');
await page.locator('.stage-cell').first().click();
await page.waitForTimeout(300);
const hd = await page.evaluate(() => ({ time: window.MRC._st().time, cars: window.MRC._st().cars.length }));
ok(hd.time < normalTime, '하드 — 제한시간 감소 적용', `${normalTime} → ${hd.time}초`);
ok(await page.evaluate(() => window.MRC._st().cars.length === window.MRC._st().stage.trafficN),
  '하드 — 교통량 배율 적용', `차량 ${hd.cars}대`);
ok((await page.locator('#hud-stage').textContent()).includes('하드'), 'HUD에 난이도 표기');
await page.keyboard.press('Escape');                   // 주행 → 일시정지
await page.keyboard.press('m');                        // 일시정지 → 코스 맵
await page.keyboard.press('Escape');                   // 코스 맵 → 타이틀
await page.click('[data-diff="normal"]');              // 원복

// ── 세이브 내보내기 / 불러오기 ──
await page.click('#btn-save-export');
ok((await page.locator('#save-msg').textContent()).includes('내보냄'), '세이브 내보내기 실행');
await page.setInputFiles('#save-file-input', {
  name: 'save.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ stars: { 1: 3, 2: 2 }, best: { 1: 45.5 } })),
});
await page.waitForTimeout(250);
ok((await page.locator('#save-msg').textContent()).includes('불러옴'), '세이브 불러오기 병합');
ok(await page.evaluate(() => window.MRC.save.unlocked() >= 3 && window.MRC.save.data.stars[1] === 3),
  '불러온 진행으로 별점·해금 갱신', `해금 ${await page.evaluate(() => window.MRC.save.unlocked())}코스`);
await page.setInputFiles('#save-file-input', {
  name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}'),
});
await page.waitForTimeout(250);
ok((await page.locator('#save-msg').textContent()).includes('아닙니다'), '형식이 아닌 파일 거부');

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
