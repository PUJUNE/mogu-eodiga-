// browser-test.mjs — 런처 카드 + 모구 던전 브라우저 검증 (데스크톱 키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=/opt/pw-browsers/chromium node mogudungeon/test/browser-test.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogudungeon', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8769, r));

const launch = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launch);
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처 → 게임 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8769/');
await page.waitForTimeout(500);
check('런처: 모구 던전 카드 존재', await page.evaluate(() => {
  const a = document.getElementById('card-mogudungeon');
  return !!a && a.getAttribute('href') === 'mogudungeon.html';
}));
await page.click('#card-mogudungeon');
await page.waitForTimeout(800);
check('런처 → 타이틀 화면', await page.evaluate(() =>
  !!window.MDN && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 직업 · 난이도 선택 ══
await page.click('.class-btn[data-cls="mage"]');
await page.waitForTimeout(150);
check('직업 마법사 선택 반영', await page.evaluate(() =>
  window.MDN.cls === 'mage' && document.querySelector('.class-btn[data-cls="mage"]').classList.contains('selected')));
await page.click('.class-btn[data-cls="fighter"]');
await page.click('.diff-btn[data-diff="easy"]');
await page.waitForTimeout(150);
check('난이도 이지 선택 반영', await page.evaluate(() => window.MDN.diff === 'easy'));
await page.click('.diff-btn[data-diff="normal"]');
await page.waitForTimeout(150);

// ══ 3. Enter 시작 → 이동 → 공격 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → 플레이 시작 (어둠의 숲)', await page.evaluate(() => { const d = window.MDN._dbg(); return d.mode === 'play' && d.stage === 'forest'; }));
await page.waitForTimeout(2000);
check('웨이브 적 등장', await page.evaluate(() => window.MDN._dbg().enemies > 0));
const x0 = await page.evaluate(() => { window.MDN._st().p.inv = 1e9; return window.MDN._dbg().px; });   // 이동 측정 중 피격 넉백 방지
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(400);
await page.keyboard.up('ArrowRight');
const x1 = await page.evaluate(() => window.MDN._dbg().px);
check(`→ 이동 (x ${x0} → ${x1})`, x1 > x0 + 30);
// 적을 눈앞에 두고 Z 공격
await page.evaluate(() => {
  const s = window.MDN._st(); s.p.inv = 1e9; s.p.face = 1;
  for (const e of s.enemies) { e.x = s.p.x + 24; e.z = s.p.z; e.atkCd = 99; }
});
await page.keyboard.press('z');
await page.waitForTimeout(350);
check('Z 공격 → 적 HP 감소', await page.evaluate(() => window.MDN._st().enemies.some((e) => e.hp < e.maxHp || e.state === 'dead')));
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 4. 스킬 (X) ══
await page.evaluate(() => { const s = window.MDN._st(); s.p.mp = 100; });
await page.keyboard.press('x');
await page.waitForTimeout(300);
check('X 스킬 → MP 소모', await page.evaluate(() => window.MDN._dbg().mp < 75));

// ══ 5. 구간 전멸 → GO → 갈림길 화면 ══
await page.evaluate(() => {
  const s = window.MDN._st(); const L = window.MDN.Logic;
  s.pending = []; s.enemies = []; s.bullets = [];
  s.section = s.sections - 1; s.camX = s.section * window.MDN.SEC_W; s.p.x = s.camX + 100; s.waveDone = false; s.gateOpen = true;
});
await page.waitForTimeout(1800);
check('스테이지 클리어 → 갈림길 화면 (후보 2)', await page.evaluate(() =>
  window.MDN._dbg().mode === 'branch' && document.querySelectorAll('.branch-btn').length === 2));
await page.screenshot({ path: join(shots, 'shot-branch.png') });
await page.click('.branch-btn[data-key="cave"]');
await page.waitForTimeout(400);
check('오우거 동굴 선택 → 스테이지 전환', await page.evaluate(() => { const d = window.MDN._dbg(); return d.mode === 'play' && d.stage === 'cave' && d.section === 0; }));

// ══ 6. 보스 등장 + 보스 HP 바 ══
await page.evaluate(() => {
  const s = window.MDN._st(); s.pending = []; s.enemies = [];
  s.section = s.sections - 1; s.camX = s.section * window.MDN.SEC_W; s.p.x = s.camX + 80; s.waveDone = false;
  window.MDN.Logic.startSection(s); s.p.inv = 1e9;
});
await page.waitForTimeout(1500);
check('보스 구간 → 오우거 등장', await page.evaluate(() => window.MDN._st().enemies.some((e) => e.kind === 'ogre')));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(shots, 'shot-boss.png') });

// ══ 7. 일시정지 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
const tPause = await page.evaluate(() => window.MDN._st().t);
await page.waitForTimeout(500);
check('일시정지 중 시간 멈춤', await page.evaluate((t) => window.MDN._st().t === t, tPause));
await page.click('#btn-resume');
await page.waitForTimeout(200);

// ══ 8. 사망 → CONTINUE 화면 → 코인 투입 ══
await page.evaluate(() => {
  const s = window.MDN._st(); s.p.inv = 0; s.p.hp = 1;
  s.enemies = [{ id: 9999, kind: 'kobold', x: s.p.x + 18, z: s.p.z, face: -1, hp: 30, maxHp: 30, atk: 8, spd: 62, range: 26, r: 12, state: 'idle', st: 0, atkCd: 0, inv: 0, flash: 0, walk: 0, kb: 0, boss: false, heavy: false, ranged: false, undead: false, wob: 0, entered: true }];
});
await page.waitForTimeout(3200);
check('HP 0 → CONTINUE 화면', await page.evaluate(() =>
  window.MDN._dbg().mode === 'over' && !document.getElementById('over-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-continue.png') });
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('코인 투입 → 같은 구간 재개 · 컨티뉴 1', await page.evaluate(() => { const d = window.MDN._dbg(); return d.mode === 'play' && d.continues === 1 && d.hp === 120; }));

// ══ 9. 최종 클리어 ══
await page.evaluate(() => {
  const s = window.MDN._st(); const L = window.MDN.Logic;
  L.loadStage(s, 'lair'); s.pending = []; s.enemies = [];
  s.section = s.sections - 1; s.camX = s.section * window.MDN.SEC_W; s.p.x = s.camX + 100; s.waveDone = false; s.p.inv = 1e9;
});
await page.waitForTimeout(2600);
check('용의 둥지 전멸 → 드래곤 토벌 화면', await page.evaluate(() =>
  window.MDN._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
check('클리어 기록 저장 (난이도·직업)', await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('mogudungeon-save-v1') || '{}');
  return (raw.cleared || {}).normal === true && (raw.clearedCls || {}).fighter === true && raw.best.normal.gold > 0;
}));
await page.screenshot({ path: join(shots, 'shot-clear.png') });
await page.click('#btn-win-title');
await page.waitForTimeout(300);
check('타이틀 복귀 + 클리어 표식', await page.evaluate(() =>
  window.MDN._dbg().mode === 'title' &&
  document.querySelector('.diff-btn[data-diff="normal"]').textContent.includes('👑') &&
  document.querySelector('.class-btn[data-cls="fighter"]').textContent.includes('🏆')));

// ══ 10. 시리즈 런처 복귀 ══
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 11. 터치 (빌드본 mogudungeon.html) ══
const mp = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
mp.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await mp.goto('http://localhost:8769/mogudungeon.html');
await mp.waitForTimeout(800);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
check('빌드본에 에셋 내장', await mp.evaluate(() => window.MDN.ASSETS.mogu.startsWith('data:image/png;base64,')));
const sb = await mp.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(sb.x, sb.y);
await mp.waitForTimeout(900);
check('시작 탭 → 플레이 + 가상패드 표시', await mp.evaluate(() =>
  window.MDN._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
await mp.evaluate(() => { const s = window.MDN._st(); s.p.inv = 1e9; });
const tx0 = await mp.evaluate(() => window.MDN._dbg().px);
await press('vbtn-right', true);
await mp.waitForTimeout(400);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.MDN._dbg().px);
check(`▶ 홀드 이동 (x ${tx0} → ${tx1})`, tx1 > tx0 + 30);
await mp.evaluate(() => { const s = window.MDN._st(); s.p.face = 1; for (const e of s.enemies) { e.x = s.p.x + 24; e.z = s.p.z; e.atkCd = 99; } });
await press('vbtn-atk', true); await mp.waitForTimeout(60); await press('vbtn-atk', false);
await mp.waitForTimeout(350);
check('👊 탭 → 공격 명중', await mp.evaluate(() => window.MDN._st().enemies.some((e) => e.hp < e.maxHp || e.state === 'dead')));
await mp.waitForTimeout(600);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
