// browser-test.mjs — 런처 + 모구맨 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguman', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8736, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };
const errors = [];

// ══ 1. 런처 (데스크톱) ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:8736/');
await page.waitForTimeout(800);
check('런처: 시리즈 타이틀 표시', (await page.title()) === '모구 게임 시리즈');
check('런처: 게임 카드 2개', await page.evaluate(() => document.querySelectorAll('.card').length >= 2));
await page.screenshot({ path: join(shots, 'shot-launcher.png') });

await page.click('#card-eodiga');
await page.waitForTimeout(2200);
check('런처 → 모구 어디가 진입', await page.evaluate(() => !!window.MOGU && !document.getElementById('title-screen').classList.contains('hidden')));
await page.goBack();
await page.waitForTimeout(600);
await page.click('#card-moguman');
await page.waitForTimeout(1200);
check('런처 → 모구맨 진입 (타이틀)', await page.evaluate(() => !!window.MGM && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 모구맨 데스크톱 키보드 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
check('Enter → 플레이 시작 (STAGE 1)', await page.evaluate(() => { const d = window.MGM._dbg(); return d.mode === 'play' && d.no === 1; }));
await page.evaluate(() => { window.MGM._st().player.invul = 99; });   // 피격 간섭 방지 (이동량 측정)
const x0 = await page.evaluate(() => window.MGM._dbg().player.x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.up('ArrowRight');
const x1 = await page.evaluate(() => window.MGM._dbg().player.x);
check(`→ 이동 (x ${x0} → ${x1})`, x1 > x0 + 20);
await page.keyboard.press('z');
await page.waitForTimeout(150);
check('점프 (공중)', await page.evaluate(() => !window.MGM._dbg().player.onGround));
await page.keyboard.down(' ');
await page.waitForTimeout(300);
const puffs = await page.evaluate(() => window.MGM._dbg().puffs);
await page.keyboard.up(' ');
check(`털 발사 (탄 ${puffs}개)`, puffs > 0);
await page.waitForTimeout(600);
await page.screenshot({ path: join(shots, 'shot-play.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check('일시정지 해제', await page.evaluate(() => window.MGM._dbg().mode === 'play'));

// ══ 3. 보스 스테이지 (세이브 주입) ══
await page.evaluate(() => localStorage.setItem('moguman-save-v1', JSON.stringify({ best: 10, hiscore: 7700 })));
await page.reload();
await page.waitForTimeout(900);
check('이어하기 버튼 = STAGE 10', await page.evaluate(() => document.getElementById('btn-continue').textContent.includes('10')));
await page.click('#btn-continue');
await page.waitForTimeout(900);
check('보스전 진입 (왕생쥐 HP)', await page.evaluate(() => { const d = window.MGM._dbg(); return d.no === 10 && d.boss && d.boss.hp > 0; }));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(shots, 'shot-boss.png') });
await page.close();

// ══ 4. 모바일 터치 ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8736/moguman.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(700);
check('처음부터 탭 → 플레이', await mp.evaluate(() => window.MGM._dbg().mode === 'play'));
check('가상 패드 표시', await mp.evaluate(() => getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
await mp.evaluate(() => { window.MGM._st().player.invul = 99; });     // 피격 간섭 방지 (이동량 측정)
const tx0 = await mp.evaluate(() => window.MGM._dbg().player.x);
await press('vbtn-right', true);
await mp.waitForTimeout(500);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.MGM._dbg().player.x);
check(`▶ 홀드 이동 (x ${tx0} → ${tx1})`, tx1 > tx0 + 20);
await press('vbtn-jump', true);
await mp.waitForTimeout(150);
await press('vbtn-jump', false);
check('점프 버튼 (공중)', await mp.evaluate(() => !window.MGM._dbg().player.onGround));
await press('vbtn-fire', true);
await mp.waitForTimeout(300);
const tpuffs = await mp.evaluate(() => window.MGM._dbg().puffs);
await press('vbtn-fire', false);
check(`발사 버튼 (탄 ${tpuffs}개)`, tpuffs > 0);
await mp.screenshot({ path: join(shots, 'shot-touch-play.png') });
await press('vbtn-pause', true);
await mp.waitForTimeout(200);
check('⏸ 탭 → 일시정지', await mp.evaluate(() => window.MGM._dbg().mode === 'pause'));
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
