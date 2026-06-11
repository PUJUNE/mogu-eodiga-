// shot.mjs — 시스템 Chrome으로 게임 구동 + 스크린샷 캡처
// 사용: node test/shot.mjs [stage] [playSeconds]
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const stageArg = parseInt(process.argv[2] || '1', 10);
const playSec = parseFloat(process.argv[3] || '6');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8732, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8732/');
await page.waitForTimeout(2500);
await page.screenshot({ path: join(root, 'test', 'shot-title.png') });

// 타이틀 → 맵
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.screenshot({ path: join(root, 'test', 'shot-map.png') });

// 저장 데이터를 직접 열어 원하는 스테이지로 (테스트용 강제 해금)
if (stageArg > 1) {
  await page.evaluate((s) => {
    const stars = {};
    for (let i = 1; i < s; i++) stars[i] = 1;
    localStorage.setItem('mogu-eodiga-save-v1', JSON.stringify({ stars, bestTime: {} }));
  }, stageArg);
  await page.reload();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
}
// 맵에서 스테이지 노드 클릭
await page.evaluate((s) => {
  const nodes = document.querySelectorAll('.stage-node');
  nodes[s - 1].click();
}, stageArg);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(root, 'test', `shot-s${stageArg}-start.png`) });

// 잠깐 플레이 (오른쪽 + 가속 약간)
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(playSec * 400);
await page.keyboard.up('ArrowUp');
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(playSec * 600);
await page.screenshot({ path: join(root, 'test', `shot-s${stageArg}-mid.png`) });

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const loop = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(loop); else res((n / 2).toFixed(0)); };
  requestAnimationFrame(loop);
}));
const stat = await page.evaluate(() => {
  const G = window.MOGU; return { state: undefined, calls: undefined };
});
console.log('FPS ~', fps);
console.log(errors.length ? '콘솔 에러:\n' + errors.join('\n') : '콘솔 에러 없음');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
