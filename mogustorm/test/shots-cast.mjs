// shots-cast.mjs — 캐릭터 초상 비주얼 확인용 스크린샷 (dbg-*는 gitignore 대상)
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
await new Promise((r) => server.listen(8764, r));

const browser = await chromium.launch(process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8764/mogustorm/index.html');
await page.waitForTimeout(600);
await page.screenshot({ path: join(shots, 'dbg-cast-title.png') });
await page.click('#btn-new');
await page.waitForTimeout(300);

const scenes = [
  ['p_2', 'lockwood-ghost'], ['a1_1', 'earnshaw'], ['a1_6', 'hindley-joseph'],
  ['a1_8', 'hindley-frances'], ['a1_5', 'cat-mogu'], ['b1_1', 'cat-edgar'],
  ['rev_2', 'isabella'], ['gen2_1', 'gen2'], ['l_sail', 'boss'], ['l_gamble', 'dealer'],
  ['r_1', 'nelly-mogu'],
  // 배경 장면 확인용
  ['a1_9', 'bg-moor-night'], ['b1_4', 'bg-kitchen'], ['b1_3b', 'bg-barn'],
  ['e_elope', 'bg-penistone'], ['gen2_release', 'bg-moor-sunset'], ['r_2', 'bg-grange'],
];
for (const [node, name] of scenes) {
  await page.evaluate((n) => window.MWH._goto(n), node);
  await page.waitForTimeout(1100);  // 배경 페이드(0.9s) 완료 후 촬영
  await page.evaluate(() => { const s = window.MWH._st(); }); // settle
  await page.screenshot({ path: join(shots, `dbg-cast-${name}.png`) });
}
await browser.close();
server.close();
console.log('done');
