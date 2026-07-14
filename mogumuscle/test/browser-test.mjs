// browser-test.mjs — 런처 카드 + 모구맨 머슬 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
// 크로미엄 경로 지정: CHROMIUM=/path/to/chromium
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogumuscle', 'test');

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

const exe = process.env.CHROMIUM;
const browser = await chromium.launch(exe ? { executablePath: exe, headless: true } : { channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 모구맨 머슬 카드 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8759/');
await page.waitForTimeout(600);
check('런처: 모구맨 머슬 카드', await page.evaluate(() => !!document.getElementById('card-mogumuscle')));
await page.screenshot({ path: join(shots, 'shot-launcher.png') });
await page.click('#card-mogumuscle');
await page.waitForTimeout(900);
check('런처 → 모구맨 머슬 타이틀', await page.evaluate(() =>
  !!window.MMS && !document.getElementById('title-screen').classList.contains('hidden')));
check('난이도 버튼 4개', await page.evaluate(() => document.querySelectorAll('.diff-btn').length === 4));
await page.click('.diff-btn[data-diff="hard"]');
await page.waitForTimeout(150);
check('하드 선택 + 저장', await page.evaluate(() => window.MMS.diff === 'hard' && JSON.parse(localStorage.getItem('mogumuscle-save-v1')).diff === 'hard'));
await page.click('.diff-btn[data-diff="normal"]');
await page.waitForTimeout(150);
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 이동 → 공격 → 태그 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Enter → STAGE 1 경기 시작', await page.evaluate(() => { const d = window.MMS._dbg(); return d.mode === 'play' && d.phase === 'fight'; }));
const x0 = (await page.evaluate(() => window.MMS._dbg().p)).x;
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(350);
await page.keyboard.up('ArrowRight');
const x1 = (await page.evaluate(() => window.MMS._dbg().p)).x;
check(`→ 홀드 → 이동 (x ${x0} → ${x1})`, x1 > x0 + 25);
// 적을 근접에 배치하고 펀치
await page.evaluate(() => {
  const s = window.MMS._st();
  const P = s.players[s.pi], E = s.enemies[s.ei];
  E.x = P.x + 28; E.z = P.z; E.spd = 0; s.stage.aggr = 0; E.invT = 0; E.stunT = 0;
});
const ehp0 = await page.evaluate(() => window.MMS._dbg().ehp);
await page.keyboard.press(' ');
await page.waitForTimeout(200);
const ehp1 = await page.evaluate(() => window.MMS._dbg().ehp);
check(`Space → 공격 명중 (적 HP ${ehp0} → ${ehp1})`, ehp1 < ehp0);
// X = 점프 (원작 B버튼) — 적을 멀리 치우고 무풍 상태에서
await page.waitForTimeout(500);
await page.evaluate(() => {
  const s = window.MMS._st();
  const P = s.players[s.pi], E = s.enemies[s.ei];
  E.x = 140; E.z = -50;
  P.state = 'idle'; P.stunT = 0; P.atkT = 0;
});
await page.keyboard.press('x');
await page.waitForTimeout(120);
check('X → 점프 (공중)', await page.evaluate(() => window.MMS._dbg().p.state === 'air'));
// 코너로 이동 후 태그 (공격 모션이 끝나길 기다렸다가)
await page.waitForTimeout(700);
await page.evaluate(() => {
  const s = window.MMS._st();
  const P = s.players[s.pi];
  P.x = s.pC.x; P.z = s.pC.z;
});
await page.keyboard.press('c');
await page.waitForTimeout(200);
check('C → 코너 태그 (꼬꼬 입장)', await page.evaluate(() => window.MMS._dbg().pi === 1));
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 클리어 흐름 (폴 2선취 — 1폴 선점 상태에서 KO 주입) ══
await page.evaluate(() => {
  const s = window.MMS._st();
  s.falls.p = 1;
  const P = s.players[s.pi];
  P.x = 0; P.z = 0; P.state = 'idle'; P.stunT = 0; P.atkT = 0; P.cd = 0;  // 코너에서 떨어진 곳 (태그 오발 방지)
  const E = s.enemies[s.ei];
  E.hp = 1; E.spd = 0; E.invT = 0; E.stunT = 0;
  if (E.state === 'down') { E.state = 'idle'; E.downT = 0; }
  E.x = 27; E.z = 0;                                       // 펀치 사거리 (잡기 밖)
  s.stage.aggr = 0; E.aiT = -99;
});
await page.keyboard.press(' ');
await page.waitForTimeout(600);
check('KO → 2폴 → 승리 연출', await page.evaluate(() => window.MMS._dbg().phase === 'clear'));
await page.screenshot({ path: join(shots, 'shot-pin.png') });
await page.waitForTimeout(2200);
check('승리 화면 표시', await page.evaluate(() =>
  window.MMS._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 경기 → STAGE 2', await page.evaluate(() => window.MMS._dbg().no === 2));

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
await mp.goto('http://localhost:8759/mogumuscle.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MMS._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const tx0 = (await mp.evaluate(() => window.MMS._dbg().p)).x;
await press('vbtn-right', true);
await mp.waitForTimeout(350);
await press('vbtn-right', false);
const tx1 = (await mp.evaluate(() => window.MMS._dbg().p)).x;
check(`▶ 홀드 → 이동 (x ${tx0} → ${tx1})`, tx1 > tx0 + 25);
await mp.evaluate(() => {
  const s = window.MMS._st();
  const P = s.players[s.pi], E = s.enemies[s.ei];
  E.x = P.x + 28; E.z = P.z; E.spd = 0; s.stage.aggr = 0; E.invT = 0; E.stunT = 0;
});
const tehp0 = await mp.evaluate(() => window.MMS._dbg().ehp);
await press('vbtn-atk', true);
await mp.waitForTimeout(200);
await press('vbtn-atk', false);
const tehp1 = await mp.evaluate(() => window.MMS._dbg().ehp);
check(`👊 탭 → 공격 명중 (${tehp0} → ${tehp1})`, tehp1 < tehp0);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
