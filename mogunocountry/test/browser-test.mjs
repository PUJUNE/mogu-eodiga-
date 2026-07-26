// browser-test.mjs — 모구 노인을 위한 나라는 없다 브라우저 검증 (데스크톱 + 터치 + 빌드본)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=<크로미움 경로> node browser-test.mjs
// PLAYWRIGHT_CORE: playwright-core 진입 파일 경로 (구글 드라이브 폴더에서는 npm install이 깨져
// 로컬 디스크에 설치한 뒤 경로를 넘긴다). 미지정 시 통상적인 모듈 해석을 따른다.
const pw = await import(
  process.env.PLAYWRIGHT_CORE
    ? (await import('url')).pathToFileURL(process.env.PLAYWRIGHT_CORE).href
    : 'playwright-core');
const chromium = pw.chromium || (pw.default && pw.default.chromium);
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogunocountry', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8764, r));

const launchOpts = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launchOpts);
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처 카드 → 타이틀 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8764/');
await page.waitForTimeout(600);
check('런처: mogunocountry 카드 존재', await page.evaluate(() => !!document.getElementById('card-mogunocountry')));
await page.click('#card-mogunocountry');
await page.waitForTimeout(900);
check('런처 → 타이틀 (window.MNC + title-screen)', await page.evaluate(() =>
  !!window.MNC && !document.getElementById('title-screen').classList.contains('hidden')));
check('타이틀: 엔딩 진행도 24종 표시', await page.evaluate(() =>
  document.getElementById('title-progress').textContent.includes('/ 24')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 새 게임 → 대사 진행 → 첫 선택지 ══
await page.click('#btn-new');
await page.waitForTimeout(400);
check('처음부터 → 플레이 화면 (1부 p1_1)', await page.evaluate(() => {
  const d = window.MNC._dbg();
  return d.screen === 'play' && d.node === 'p1_1';
}));
check('스탯 3종 HUD 표시 (🪙🎯🕯)', await page.evaluate(() => {
  const t = document.getElementById('stat-luck').textContent
    + document.getElementById('stat-guard').textContent
    + document.getElementById('stat-grace').textContent;
  return t.includes('🪙 2') && t.includes('🎯 2') && t.includes('🕯 2');
}));
check('의인화 SVG 초상 렌더 (벨 보안관)', await page.evaluate(() =>
  document.querySelectorAll('#vn-chars .portrait svg').length >= 1));
check('SVG 배경 장면 렌더 (sheriff)', await page.evaluate(() =>
  !!document.querySelector('#vn-bg svg')));
await page.click('#vn-stage');
await page.waitForTimeout(120);
check('클릭 → 대사 즉시 완성', await page.evaluate(() =>
  document.getElementById('vn-text').textContent.includes('테렐 군')));
await page.screenshot({ path: join(shots, 'shot-play.png') });

// 자동 스킵으로 첫 선택지(p1_5)까지
await page.evaluate(() => window.MNC._skipLines());
await page.waitForTimeout(200);
check('첫 선택지 도달 (p1_5, 버튼 3개)', await page.evaluate(() => {
  const d = window.MNC._dbg();
  return d.node === 'p1_5' && document.querySelectorAll('.choice-btn').length === 3;
}));
await page.screenshot({ path: join(shots, 'shot-choice.png') });
const guardBefore = await page.evaluate(() => window.MNC._dbg().stats.guard);
await page.click('.choice-btn:first-child'); // 사거리를 좁힌다 (+1 대비)
await page.waitForTimeout(300);
check('선택 → 다음 노드 + 대비 +1', await page.evaluate((gb) => {
  const d = window.MNC._dbg();
  return d.node === 'p1_6' && d.stats.guard === gb + 1;
}, guardBefore));
check('진행 자동 저장', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mogunocountry-save-v1'));
  return s && s.cur && s.cur.node === 'p1_6';
}));

// ══ 3. 게이트 판정 + 엔딩 + 갤러리 ══
// 🎯대비 부족 → 다리 위 코트 엔딩(병실에서 끝남)
await page.evaluate(() => window.MNC._goto('p4_11', { luck: 6, guard: 2, grace: 4 }));
await page.waitForTimeout(200);
await page.evaluate(() => window.MNC._skipLines());
await page.waitForTimeout(400);
check('🎯게이트: 대비 2 → 다리 위의 코트 엔딩', await page.evaluate(() =>
  !document.getElementById('ending-screen').classList.contains('hidden')
  && document.getElementById('end-title').textContent === '다리 위의 코트'
  && document.getElementById('end-no').textContent.includes('16')));
check('엔딩 후 이어하기 세이브 소거 + 수집 기록', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mogunocountry-save-v1'));
  return s && !s.cur && s.endings && s.endings.coat === true;
}));
await page.screenshot({ path: join(shots, 'shot-ending.png') });

// 🕯게이트 반대편: 대비 충분 → 5부로 진행
await page.evaluate(() => window.MNC._goto('p4_11', { luck: 6, guard: 8, grace: 4 }));
await page.waitForTimeout(200);
await page.evaluate(() => window.MNC._skipLines());
await page.waitForTimeout(300);
check('🎯게이트 반대편: 대비 8 → 5부 진입', await page.evaluate(() =>
  /^p5_/.test(window.MNC._dbg().node)));

// 동전 던지기 노드
await page.evaluate(() => window.MNC._goto('p9_5', { luck: 9, guard: 4, grace: 4 }));
await page.waitForTimeout(200);
await page.evaluate(() => window.MNC._skipLines());
await page.waitForTimeout(250);
check('동전 던지기 선택지 3개 (앞면/뒷면/거절)', await page.evaluate(() =>
  document.querySelectorAll('.choice-btn').length === 3));
await page.click('.choice-btn:first-child'); // 앞면 → 운 9 ≥ 7 → 살아남는다
await page.waitForTimeout(250);
check('🪙게이트: 운 9 → 앞면이었다면 경로(p9_5b)', await page.evaluate(() =>
  window.MNC._dbg().node === 'p9_5b'));

await page.evaluate(() => window.MNC._goto('p1_1', {}));
await page.waitForTimeout(150);
await page.evaluate(() => { window.MNC.UI.showGallery(); });
await page.waitForTimeout(300);
check('갤러리: 24칸 + 수집분 표시', await page.evaluate(() =>
  document.querySelectorAll('.g-row').length === 24
  && document.querySelectorAll('.g-row.got').length >= 1));
await page.screenshot({ path: join(shots, 'shot-gallery.png') });

// ══ 4. 빌드본 (터치 뷰포트) ══
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
});
const tp = await ctx.newPage();
tp.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('[build] ' + m.text()); });
tp.on('pageerror', (e) => errors.push('[build] ' + String(e)));
await tp.goto('http://localhost:8764/mogunocountry.html');
await tp.waitForTimeout(700);
check('빌드본: 타이틀 + 터치 감지', await tp.evaluate(() =>
  !!window.MNC && document.body.classList.contains('touch')
  && !document.getElementById('title-screen').classList.contains('hidden')));
check('빌드본: 모구 에셋 base64 내장', await tp.evaluate(() =>
  window.MNC.ASSETS.mogu.startsWith('data:image/png;base64,')));
await tp.tap('#btn-new');
await tp.waitForTimeout(400);
check('빌드본: 터치로 게임 시작', await tp.evaluate(() => window.MNC._dbg().screen === 'play'));
await tp.tap('#vn-stage');
await tp.waitForTimeout(150);
await tp.tap('#vn-stage');
await tp.waitForTimeout(300);
check('빌드본: 탭으로 대사 진행', await tp.evaluate(() => {
  const s = window.MNC._st();
  return s.lineIdx >= 1 || s.state.node !== 'p1_1';
}));
check('빌드본: 선택지 버튼이 화면 안에 들어옴', await tp.evaluate(() => {
  window.MNC._skipLines();
  const b = document.querySelector('.choice-btn');
  if (!b) return false;
  const r = b.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
}));
await tp.screenshot({ path: join(shots, 'shot-touch.png') });

// ══ 마무리 ══
check('콘솔 에러 0건', errors.length === 0);
if (errors.length) console.log('콘솔 에러:', errors.slice(0, 5));
await browser.close();
server.close();
console.log(fails.length === 0 ? '\n✅ browser-test 전체 통과' : `\n❌ 실패 ${fails.length}건: ${fails.join(' | ')}`);
process.exit(fails.length === 0 ? 0 : 1);
