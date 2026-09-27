// browser-test.mjs — 런처 카드 + 모구 송편공장 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node mogusongpyeon/test/browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogusongpyeon', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8771, r));

const launch = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launch);
const fails = [];
const errors = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const T = 60;

// ══ 1. 런처 → 게임 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8771/');
await page.waitForTimeout(500);
check('런처: 모구 송편공장 카드 존재', await page.evaluate(() => {
  const a = document.getElementById('card-mogusongpyeon');
  return !!a && a.getAttribute('href') === 'mogusongpyeon.html';
}));
await page.fill('#game-search', '송편');
await page.waitForTimeout(150);
check('런처 검색 "송편" → 카드 1개', await page.evaluate(() =>
  [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-mogusongpyeon');
await page.waitForTimeout(900);
check('런처 → 타이틀 화면', await page.evaluate(() =>
  !!window.MSP && !document.getElementById('title-screen').classList.contains('hidden')));
check('모구 얼굴 사진이 내장 이미지로 로드', await page.evaluate(() => {
  const i = document.getElementById('title-icon'); return i.complete && i.naturalWidth > 100 && i.src.startsWith('data:image/png');
}));
check('가게 5곳 · 2호점부터 잠김', await page.evaluate(() => {
  const b = [...document.querySelectorAll('.stage-btn')];
  return b.length === 5 && !b[0].classList.contains('locked') && b.slice(1).every((x) => x.classList.contains('locked'));
}));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 시작 → 실제 키 입력으로 한 접시 출하 (1호점, 상태 주입으로 주문 고정) ══
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('Enter → 영업 시작', await page.evaluate(() => window.MSP._dbg().mode === 'play'));
await page.evaluate(() => {
  const st = window.MSP._st();
  st.orders = [{ id: 99, items: [{ c: 'white', f: 'sesame' }], t: 200, max: 200, cust: 'penguin' }];
  st.nextOrderAt = 9999;
});
// 칸 중심에 세우고 방향을 맞춘 뒤 키 입력은 진짜로 보낸다
const stand = (c, r, fx, fy) => page.evaluate(([c, r, fx, fy]) => {
  Object.assign(window.MSP._st().p, { x: (c + 0.5) * 60, y: (r + 0.5) * 60, fx, fy });
}, [c, r, fx, fy]);
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(80); };
const held = () => page.evaluate(() => window.MSP._dbg().held);

await stand(1, 1, 0, -1); await press(' ');
check('Space → 흰 반죽 집기', (await held()) === 'dough');
await stand(9, 1, 0, -1); await press(' ');
await page.keyboard.down('k'); await page.waitForTimeout(1500); await page.keyboard.up('k');
check('K 꾹 → 도마 위 반죽이 송편피로', await page.evaluate(() => window.MSP._st().grid[0][9].item.t === 'skin'));
await page.screenshot({ path: join(shots, 'shot-play.png') });
await press(' ');
await stand(4, 1, 0, -1); await press(' ');
check('피를 들고 깨 통 → 소가 얹힘', await page.evaluate(() => window.MSP._st().p.held.fill === 'sesame'));
await stand(9, 1, 0, -1); await press(' ');
await page.keyboard.down('x'); await page.waitForTimeout(1200); await page.keyboard.up('x');
check('X 꾹 → 반달 생송편', await page.evaluate(() => window.MSP._st().grid[0][9].item.t === 'raw'));
await press('j');
await stand(14, 1, 0, -1); await press(' ');
check('찜기에 넣기', await page.evaluate(() => window.MSP._st().grid[0][14].steam.length === 1));
await page.evaluate(() => { window.MSP._st().grid[0][14].steam[0].cook = 6.9; });
await page.waitForTimeout(400);
await page.screenshot({ path: join(shots, 'shot-steam.png') });
await stand(1, 3, -1, 0); await press(' ');
check('접시 들기', (await held()) === 'plate');
await stand(14, 1, 0, -1); await press(' ');
check('익은 송편을 접시에', await page.evaluate(() => window.MSP._st().p.held.songs.length === 1));
const before = await page.evaluate(() => window.MSP._st().score);
await stand(14, 3, 1, 0); await press(' ');
check('출하 → 점수 오름', await page.evaluate((b) => window.MSP._st().score > b && window.MSP._st().served === 1, before));

// ══ 2-1. 한글 입력 상태 (key 가 'ㅏ'·'ㅌ', code 는 KeyK·KeyX) 에서도 빚기 ══
await page.evaluate(() => { const st = window.MSP._st(); st.p.held = { t: 'dough', c: 'white' }; st.grid[0][9].item = null; });
await stand(9, 1, 0, -1);
const kor = (type, key, code) => page.evaluate(([type, key, code]) => window.dispatchEvent(new KeyboardEvent(type, { key, code })), [type, key, code]);
await kor('keydown', 'ㅏ', 'KeyK'); await page.waitForTimeout(1500); await kor('keyup', 'ㅏ', 'KeyK');
check('한글 자판 K(ㅏ) 꾹 → 들고 있던 반죽이 도마에서 피로', await page.evaluate(() => window.MSP._st().grid[0][9].item?.t === 'skin' && !window.MSP._st().p.held));
await page.evaluate(() => { window.MSP._st().grid[0][9].item.fill = 'sesame'; });
await kor('keydown', 'ㅌ', 'KeyX'); await page.waitForTimeout(1200); await kor('keyup', 'ㅌ', 'KeyX');
check('한글 자판 X(ㅌ) 꾹 → 반달 접기', await page.evaluate(() => window.MSP._st().grid[0][9].item?.t === 'raw'));
await page.evaluate(() => { window.MSP._st().grid[0][9].item = null; });
await stand(1, 1, 0, -1);
await kor('keydown', ' ', 'Space'); await kor('keyup', ' ', 'Space'); await page.waitForTimeout(80);
check('한글 상태 Space 집기', (await held()) === 'dough');
await page.evaluate(() => { window.MSP._st().p.held = null; });
await stand(7, 5, 0, 1);
await kor('keydown', 'ㅏ', 'KeyK'); await page.waitForTimeout(120);
await page.screenshot({ path: join(shots, 'shot-hint.png') });
await kor('keyup', 'ㅏ', 'KeyK');

// ══ 3. 이동 · 대시 (키 입력) ══
await stand(7, 5, 0, 1);
const x0 = await page.evaluate(() => window.MSP._st().p.x);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
const x1 = await page.evaluate(() => window.MSP._st().p.x);
check('→ 키로 오른쪽 이동', x1 > x0 + 50, `${Math.round(x0)}→${Math.round(x1)}`);
await page.keyboard.down('ArrowLeft'); await press('Shift'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
check('Shift 대시', await page.evaluate(() => window.MSP._st().p.dashCd > 0));

// ══ 4. 일시정지 · 결과 · 해금 ══
await press('Escape');
check('Esc → 일시정지', await page.evaluate(() => window.MSP._dbg().mode === 'pause'));
await press('Escape');
await page.evaluate(() => { const st = window.MSP._st(); st.score = 999; st.timeLeft = 0.05; });
await page.waitForTimeout(2200);
check('시간 종료 → 결과 화면', await page.evaluate(() => window.MSP._dbg().mode === 'result' &&
  !document.getElementById('result-screen').classList.contains('hidden')));
check('별 3개 표시', await page.evaluate(() => document.querySelectorAll('#result-stars span:not(.off)').length === 3));
check('2호점 해금 + 다음 가게 버튼', await page.evaluate(() =>
  window.MSP.save.unlocked(1) && document.getElementById('btn-next').style.display !== 'none'));
await page.screenshot({ path: join(shots, 'shot-result.png') });

// ══ 5. 3호점 키위 (상태 주입) 그림 확인 ══
await page.evaluate(() => { window.MSP.save.data.best['normal:1'] = { score: 300, stars: 2 }; window.MSP.save.store(); });
await press('Escape');
await page.evaluate(() => { window.MSP.save.setStage(2); window.MSP.ui.refreshTitle(); });
await press('Enter');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const st = window.MSP._st();
  st.grid[2][4].item = { t: 'plate', songs: [{ c: 'ssuk', f: 'bean', hole: false }, { c: 'white', f: 'sesame', hole: true }] };
  st.grid[3][0].item = null;
  st.grid[1][0].item = null;
  st.grid[8][8].steam = [{ c: 'ssuk', f: 'sesame', cook: 3, burnt: false }, { c: 'white', f: 'bean', cook: 8, burnt: false }];
  st.grid[8][9].steam = [{ c: 'white', f: 'bean', cook: 0, burnt: true }];
  st.p.held = { t: 'skin', c: 'ssuk', fill: 'bean' };
  st.nextKiwiAt = st.t;
});
await page.waitForTimeout(3500);
check('3호점: 키위 등장', await page.evaluate(() => window.MSP._st().kiwis.length === 1));
await page.screenshot({ path: join(shots, 'shot-kiwi.png') });

// ══ 6. 4호점 컨베이어 그림 ══
await page.evaluate(() => {
  const M = window.MSP; M.save.data.best['normal:2'] = { score: 300, stars: 2 }; M.save.store();
});
await press('Escape'); await page.waitForTimeout(100);
await page.evaluate(() => { const M = window.MSP; M.ui.show('title-screen'); });
await page.evaluate(() => { window.MSP.save.setStage(3); window.MSP.ui.refreshTitle(); });
await page.screenshot({ path: join(shots, 'shot-title-open.png') });
await page.click('#btn-start');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const st = window.MSP._st();
  st.grid[3][7].item = { t: 'dough', c: 'pink', bt: 0 };
  st.grid[3][9].item = { t: 'skin', c: 'ssuk', fill: null, bt: 0 };
});
await page.waitForTimeout(1200);
check('4호점: 벨트가 반죽을 옮김', await page.evaluate(() => window.MSP._st().grid[3][8].item?.c === 'pink'));
await page.screenshot({ path: join(shots, 'shot-belt.png') });

// ══ 7. 모바일 터치 (가로) ══
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const mp = await ctx.newPage();
mp.on('pageerror', (e) => errors.push('[mobile] ' + String(e)));
await mp.goto('http://localhost:8771/mogusongpyeon.html');
await mp.waitForTimeout(600);
check('모바일: 터치 모드', await mp.evaluate(() => document.body.classList.contains('touch')));
await mp.tap('#btn-start');
await mp.waitForTimeout(400);
check('모바일: 탭으로 시작 · 패드 표시', await mp.evaluate(() => window.MSP._dbg().mode === 'play' &&
  getComputedStyle(document.getElementById('vpad')).display !== 'none'));
const sb = await mp.locator('#vstick').boundingBox();
await mp.evaluate(() => { const st = window.MSP._st(); st.p.x = 7.5 * 60; st.p.y = 5.5 * 60; });
const mx0 = await mp.evaluate(() => window.MSP._st().p.x);
const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
await mp.dispatchEvent('#vstick', 'pointerdown', { pointerId: 7, clientX: cx, clientY: cy, isPrimary: true });
await mp.dispatchEvent('#vstick', 'pointermove', { pointerId: 7, clientX: cx + 60, clientY: cy, isPrimary: true });
await mp.waitForTimeout(400);
await mp.dispatchEvent('#vstick', 'pointerup', { pointerId: 7, clientX: cx + 60, clientY: cy, isPrimary: true });
const mx1 = await mp.evaluate(() => window.MSP._st().p.x);
check('모바일: 스틱으로 이동', mx1 > mx0 + 40, `${Math.round(mx0)}→${Math.round(mx1)}`);
await mp.evaluate(() => { Object.assign(window.MSP._st().p, { x: 1.5 * 60, y: 1.5 * 60, fx: 0, fy: -1 }); });
await mp.dispatchEvent('#vb-grab', 'pointerdown', { pointerId: 8 });
await mp.dispatchEvent('#vb-grab', 'pointerup', { pointerId: 8 });
await mp.waitForTimeout(100);
check('모바일: 집기 버튼', await mp.evaluate(() => window.MSP._dbg().held === 'dough'));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
const pp = await ctx.newPage();
await pp.setViewportSize({ width: 390, height: 844 });
await pp.goto('http://localhost:8771/mogusongpyeon.html');
await pp.waitForTimeout(400);
check('모바일 세로: 가로 전환 안내', await pp.evaluate(() => !document.getElementById('rotate-hint').classList.contains('hidden')));

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
