// diff-test.mjs — 난이도 모드 브라우저 검증 (선택 UI·배율 적용·저장 유지·D키 순환)
// 사용: GAME_ROOT=<game 폴더> node diff-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8735, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8735/');
await page.waitForTimeout(2500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);

// 1) 기본값 노말 + 버튼 4개 표시
check('기본 난이도 = 노말', await page.evaluate(() => window.MOGU.diff === 'normal'));
check('난이도 버튼 4개 표시', await page.evaluate(() =>
  document.querySelectorAll('.diff-btn').length === 4 &&
  document.querySelector('.diff-btn[data-diff="normal"]').classList.contains('selected')));
await page.screenshot({ path: join(root, 'test', 'diff-map.png') });

// 2) 하드 클릭 → 선택·speed 배율 적용
await page.click('.diff-btn[data-diff="hard"]');
await page.waitForTimeout(200);
check('하드 클릭 → 선택 반영', await page.evaluate(() => window.MOGU.diff === 'hard'));
const spdHard = await page.evaluate(() => window.MOGU.paramsFor(1).speed);
check(`하드 speed = 6×1.3 (${spdHard})`, Math.abs(spdHard - 7.8) < 0.01);

// 3) 스테이지 시작 → HUD 라벨 + 실주행 속도
await page.evaluate(() => { const n = document.querySelectorAll('.stage-node')[0]; n.click(); });
await page.waitForTimeout(1500);
check('하드 HUD 라벨', await page.evaluate(() =>
  document.getElementById('hud-stage').textContent.includes('하드')));
const z0 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.z));
await page.waitForTimeout(1000);
const z1 = await page.evaluate(() => parseFloat(window.MOGU._dbg().player.z));
check(`하드 실주행 속도 ≈7.8블록/s (측정 ${(z1 - z0).toFixed(1)})`, Math.abs((z1 - z0) - 7.8) < 1.2);
await page.screenshot({ path: join(root, 'test', 'diff-play-hard.png') });

// 4) 저장 유지 — 리로드 후에도 하드
await page.reload();
await page.waitForTimeout(2000);
check('리로드 후 난이도 유지', await page.evaluate(() => window.MOGU.diff === 'hard'));

// 5) D키 순환 (하드 → 크레이지) + 크레이지 스테이지 생성
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.keyboard.press('d');
await page.waitForTimeout(200);
check('D키 순환 → 크레이지', await page.evaluate(() => window.MOGU.diff === 'crazy'));
await page.evaluate(() => { const n = document.querySelectorAll('.stage-node')[0]; n.click(); });
await page.waitForTimeout(1500);
check('크레이지 플레이 시작 + HUD 라벨', await page.evaluate(() =>
  window.MOGU._dbg().state === 'play' && document.getElementById('hud-stage').textContent.includes('크레이지')));
const spdCrazy = await page.evaluate(() => window.MOGU._player().currentSpeed());
check(`크레이지 주행 속도 = 6×1.7 (${spdCrazy.toFixed(1)})`, Math.abs(spdCrazy - 10.2) < 0.01);
await page.screenshot({ path: join(root, 'test', 'diff-play-crazy.png') });

// 6) 이지 — 버튼 클릭 경로로 재확인
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('btn-pmap').click());
await page.waitForTimeout(1500);
await page.click('.diff-btn[data-diff="easy"]');
await page.waitForTimeout(200);
const spdEasy = await page.evaluate(() => window.MOGU.paramsFor(1).speed);
check(`이지 speed = 6×0.75 (${spdEasy})`, Math.abs(spdEasy - 4.5) < 0.01);

console.log(errors.length ? '콘솔 에러:\n' + errors.join('\n') : '콘솔 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
