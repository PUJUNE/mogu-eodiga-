// browser-test.mjs — 런처 7카드 + 모구드래곤 브라우저 검증 (데스크톱 키보드 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogusamguk', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8754, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 7장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8754/');
await page.waitForTimeout(600);
check('런처: 게임 카드 9개', await page.evaluate(() => document.querySelectorAll('.card').length >= 9));
await page.screenshot({ path: join(shots, 'shot-launcher9.png') });
await page.click('#card-mogusamguk');
await page.waitForTimeout(900);
check('런처 → 모구드래곤 타이틀', await page.evaluate(() =>
  !!window.MSG && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 키보드: 시작 → 이동 → 공격 → 처치 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → MISSION 1 시작', await page.evaluate(() => { const d = window.MSG._dbg(); return d.mode === 'play' && d.mission === 1 && d.enemies > 0; }));
await page.evaluate(() => {   // 악당 간섭 제거: 격리 + 플레이어 상태 리셋·무적
  const s = window.MSG._st();
  s.p.iv = 999; s.p.state = 'idle'; s.p.stT = 1;
  for (const e of s.enemies) { e.spd = 0; e.atkCd = 999; e.baseAtkCd = 999; e.x = -400; }
});
const p0 = await page.evaluate(() => window.MSG._dbg().p);
await page.keyboard.down('ArrowRight');
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowRight');
await page.keyboard.up('ArrowDown');
const p1 = await page.evaluate(() => window.MSG._dbg().p);
check(`8방향 이동 (${p0.x},${p0.z} → ${p1.x},${p1.z})`, p1.x > p0.x + 15 && p1.z > p0.z + 8);
// 적을 바로 앞에 배치하고 공격
await page.evaluate(() => {
  const s = window.MSG._st();
  for (const e2 of s.enemies) { e2.spd = 0; e2.atkCd = 999; e2.baseAtkCd = 999; e2.x = -500; }
  const e = s.enemies[0];
  e.x = s.p.x + 26; e.z = s.p.z; e.hp = 8; e.state = 'idle'; e.iv = 0;
  s.p.face = 1; s.p.state = 'idle'; s.p.stT = 1; s.p.iv = 999; s.p.atkCd = 0; s.p.combo = 0;
});
await page.keyboard.press(' ');
await page.waitForTimeout(1600);   // 다운(1초) → 사망 전환 후 점수 산정
const d2 = await page.evaluate(() => window.MSG._dbg());
check(`공격 → 처치 (+점수 ${d2.score})`, d2.score >= 100);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 보스전 (상태 주입) ══
await page.evaluate(() => {
  const s = window.MSG._st();
  s.secIdx = 3; s.waveIdx = 0; s.enemies = []; s.bossSpawned = false;
  s.p.x = window.MSG.Logic.sec(s).x0 + 60;
});
await page.waitForTimeout(600);
const d3 = await page.evaluate(() => window.MSG._dbg());
check('보스 등장 (HP 바 표시)', await page.evaluate(() => {
  const s = window.MSG._st();
  return s.enemies.some((e) => e.boss);
}));
await page.screenshot({ path: join(shots, 'shot-boss.png') });
// 보스 HP 1 → 격파 → 클리어
await page.evaluate(() => {
  const s = window.MSG._st();
  const boss = s.enemies.find((e) => e.boss);
  boss.hp = 1; boss.spd = 0; boss.atkCd = 999; boss.baseAtkCd = 999;
  boss.x = s.p.x + 26; boss.z = s.p.z; boss.iv = 0; boss.state = 'idle';
  s.p.face = 1;
});
await page.keyboard.press(' ');
await page.waitForTimeout(2200);
check('보스 격파 → 미션 클리어 화면', await page.evaluate(() =>
  window.MSG._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(400);
check('다음 미션 → M2', await page.evaluate(() => window.MSG._dbg().mission === 2));

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

// ══ 5. 터치 (빌드본 mogusamguk.html) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8754/mogusamguk.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MSG._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
await mp.evaluate(() => {
  const s = window.MSG._st();
  s.p.iv = 999; s.p.state = 'idle'; s.p.stT = 1;
  for (const e of s.enemies) { e.spd = 0; e.atkCd = 999; e.baseAtkCd = 999; e.x = -400; }
});
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
const tp0 = await mp.evaluate(() => window.MSG._dbg().p);
await press('vbtn-right', true);
await mp.waitForTimeout(300);
await press('vbtn-right', false);
const tp1 = await mp.evaluate(() => window.MSG._dbg().p);
check(`▶ 홀드 이동 (x ${tp0.x} → ${tp1.x})`, tp1.x > tp0.x + 15);
// 터치 공격으로 처치
await mp.evaluate(() => {
  const s = window.MSG._st();
  for (const e2 of s.enemies) { e2.x = -500; }
  const e = s.enemies[0];
  e.x = s.p.x + 26; e.z = s.p.z; e.hp = 8; e.state = 'idle'; e.iv = 0;
  s.p.face = 1; s.p.state = 'idle'; s.p.stT = 1; s.p.iv = 999; s.p.atkCd = 0; s.p.combo = 0;
});
await press('vbtn-atk', true);
await mp.waitForTimeout(120);
await press('vbtn-atk', false);
await mp.waitForTimeout(1500);     // 다운 → 사망 전환 후 점수 산정
check('👊 탭 → 처치', await mp.evaluate(() => window.MSG._dbg().score >= 100));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
