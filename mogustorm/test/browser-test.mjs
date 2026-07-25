// browser-test.mjs — 모구 폭풍의 언덕 브라우저 검증 (데스크톱 + 터치 + 빌드본)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=<크로미움 경로> node browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogustorm', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8763, r));

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
await page.goto('http://localhost:8763/');
await page.waitForTimeout(600);
check('런처: mogustorm 카드 존재', await page.evaluate(() => !!document.getElementById('card-mogustorm')));
await page.click('#card-mogustorm');
await page.waitForTimeout(900);
check('런처 → 타이틀 (window.MWH + title-screen)', await page.evaluate(() =>
  !!window.MWH && !document.getElementById('title-screen').classList.contains('hidden')));
check('타이틀: 엔딩 진행도 표시', await page.evaluate(() =>
  document.getElementById('title-progress').textContent.includes('/ 18')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 새 게임 → 대사 진행 → 첫 선택지 ══
await page.click('#btn-new');
await page.waitForTimeout(400);
check('처음부터 → 플레이 화면 (프롤로그 p_1)', await page.evaluate(() => {
  const d = window.MWH._dbg();
  return d.screen === 'play' && d.node === 'p_1';
}));
check('내레이션 타자기 출력 시작', await page.evaluate(() =>
  document.getElementById('vn-text').textContent.length > 0));
check('의인화 SVG 초상 렌더 (록우드)', await page.evaluate(() =>
  document.querySelectorAll('#vn-chars .portrait svg').length >= 1));
// 클릭 1회 = 즉시 완성 → 대사 전문 노출
await page.click('#vn-stage');
await page.waitForTimeout(120);
check('클릭 → 대사 즉시 완성', await page.evaluate(() =>
  document.getElementById('vn-text').textContent.includes('록우드')));
await page.screenshot({ path: join(shots, 'shot-play.png') });
// 자동 스킵으로 첫 선택지(a1_3)까지
await page.evaluate(() => window.MWH._skipLines());
await page.waitForTimeout(200);
check('첫 선택지 도달 (a1_3, 버튼 2개)', await page.evaluate(() => {
  const d = window.MWH._dbg();
  return d.node === 'a1_3' && document.querySelectorAll('.choice-btn').length === 2;
}));
await page.screenshot({ path: join(shots, 'shot-choice.png') });
const loveBefore = await page.evaluate(() => window.MWH._dbg().stats.love);
await page.click('.choice-btn:first-child'); // 츄르를 나눠 먹는다 (+2 사랑)
await page.waitForTimeout(300);
check('선택 → 다음 노드 + 사랑 +2', await page.evaluate((lb) => {
  const d = window.MWH._dbg();
  return d.node === 'a1_4a' && d.stats.love === lb + 2;
}, loveBefore));
check('진행 자동 저장', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mogustorm-save-v1'));
  return s && s.cur && s.cur.node === 'a1_4a';
}));

// ══ 3. 상태 주입 → 엔딩 도달 → 갤러리 ══
await page.evaluate(() => window.MWH._goto('gen2_2', { love: 9, grudge: 8 }));
await page.waitForTimeout(200);
await page.evaluate(() => window.MWH._skipLines());
await page.waitForTimeout(200);
check('2세대 분기 선택지 3개', await page.evaluate(() =>
  document.querySelectorAll('.choice-btn').length === 3));
await page.click('.choice-btn:first-child'); // 복수를 끝까지 → end_avatar
await page.waitForTimeout(200);
await page.evaluate(() => window.MWH._skipLines());
await page.waitForTimeout(400);
check('엔딩 화면: 복수의 화신 (18번)', await page.evaluate(() =>
  !document.getElementById('ending-screen').classList.contains('hidden')
  && document.getElementById('end-title').textContent === '복수의 화신'
  && document.getElementById('end-no').textContent.includes('18')));
check('엔딩 후 이어하기 세이브 소거', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mogustorm-save-v1'));
  return s && !s.cur && s.endings && s.endings.avatar === true;
}));
await page.screenshot({ path: join(shots, 'shot-ending.png') });
await page.click('#btn-end-gallery');
await page.waitForTimeout(300);
check('갤러리: 18칸 + 수집 1종 표시', await page.evaluate(() =>
  document.querySelectorAll('.g-row').length === 18
  && document.querySelectorAll('.g-row.got').length === 1));
await page.screenshot({ path: join(shots, 'shot-gallery.png') });

// 게이트 판정: 사랑 부족 상태에서 캣서린만 되찾기 → 거절 노드
await page.evaluate(() => window.MWH._goto('r_2', { love: 4, grudge: 2 }));
await page.evaluate(() => window.MWH._skipLines());
await page.waitForTimeout(200);
await page.click('.choice-btn:nth-child(3)'); // 캣서린만 되찾는다
await page.waitForTimeout(200);
check('♥게이트: 사랑 4 → 거절 노드(r_elope_no)', await page.evaluate(() =>
  window.MWH._dbg().node === 'r_elope_no'));

// ══ 4. 빌드본 (터치 뷰포트) ══
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
});
const tp = await ctx.newPage();
tp.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('[build] ' + m.text()); });
tp.on('pageerror', (e) => errors.push('[build] ' + String(e)));
await tp.goto('http://localhost:8763/mogustorm.html');
await tp.waitForTimeout(700);
check('빌드본: 타이틀 + 터치 감지', await tp.evaluate(() =>
  !!window.MWH && document.body.classList.contains('touch')
  && !document.getElementById('title-screen').classList.contains('hidden')));
check('빌드본: 모구 에셋 base64 내장', await tp.evaluate(() =>
  window.MWH.ASSETS.mogu.startsWith('data:image/png;base64,')));
await tp.tap('#btn-new');
await tp.waitForTimeout(400);
check('빌드본: 터치로 게임 시작', await tp.evaluate(() => window.MWH._dbg().screen === 'play'));
await tp.tap('#vn-stage');
await tp.waitForTimeout(150);
await tp.tap('#vn-stage');
await tp.waitForTimeout(300);
check('빌드본: 탭으로 대사 진행', await tp.evaluate(() => {
  const s = window.MWH._st();
  return s.lineIdx >= 1 || s.state.node !== 'p_1';
}));
await tp.screenshot({ path: join(shots, 'shot-touch.png') });

// ══ 마무리 ══
check('콘솔 에러 0건', errors.length === 0);
if (errors.length) console.log('콘솔 에러:', errors.slice(0, 5));
await browser.close();
server.close();
console.log(fails.length === 0 ? '\n✅ browser-test 전체 통과' : `\n❌ 실패 ${fails.length}건: ${fails.join(' | ')}`);
process.exit(fails.length === 0 ? 0 : 1);
