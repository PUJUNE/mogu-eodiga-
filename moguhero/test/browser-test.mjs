// browser-test.mjs — 런처 카드 + 모구 히어로 브라우저 검증 (데스크톱 키보드·마우스 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node moguhero/test/browser-test.mjs
// WebGL 은 헤드리스에서 SwiftShader 로 그린다 — 느려서 정해진 시간 대신 상태를 기다린다.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguhero', 'test');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8777, r));

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: true, args } : { channel: 'chrome', headless: true, args });
const fails = [], errors = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const S = (f, a) => page.evaluate(f, a);
const D = () => S(() => window.MHR._dbg());
const shot = (n) => page.screenshot({ path: join(shots, n) });
const until = (pg, f, ms = 30000, arg = null) => pg.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const key = (code, k, type = 'keydown') => S(([c, kk, t]) => window.dispatchEvent(new KeyboardEvent(t, { code: c, key: kk })), [code, k, type]);

// ══ 1. 런처 → 타이틀 ══
await page.goto('http://localhost:8777/');
await page.waitForTimeout(400);
check('런처: 모구 히어로 카드', await S(() => document.getElementById('card-moguhero')?.getAttribute('href') === 'moguhero.html'));
await page.fill('#game-search', '히어로');
await page.waitForTimeout(150);
check('런처 검색 "히어로" → 카드 1개', await S(() => [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-moguhero');
await page.waitForTimeout(2000);
await S(() => localStorage.removeItem('moguhero-save-v1'));
await page.reload(); await page.waitForTimeout(2000);
check('타이틀 · 저장 없으면 이어하기 숨김', await S(() => !document.getElementById('title-screen').classList.contains('hidden') && document.getElementById('btn-continue').style.display === 'none'));
check('WebGL: 복셀 마을 한 덩어리로 그림 · 카메라 정상 좌표', await S(() => { const R = window.MHR.R3; return R.renderer.info.render.triangles > 5000 && R.camera.position.toArray().every(Number.isFinite); }));
check('타이틀은 초당 20번 남짓만 그린다 (발열 방지)', await S(async () => { const R = window.MHR.R3, f0 = R.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 1000)); return R.renderer.info.render.frame - f0 <= 24; }));
await shot('shot-title.png');

// ══ 2. 새 게임 → 촌장 대화 → 마을 ══
await page.click('#btn-new');
check('새로 시작 → 촌장 대화', await until(page, () => window.MHR._dbg().mode === 'talk'));
for (let i = 0; i < 3; i++) { await key('Space', ' '); await page.waitForTimeout(120); }
check('대화 끝 → 마을 · 1일째 08시', await until(page, () => { const d = window.MHR._dbg(); return d.mode === 'village' && d.day === 1 && d.hour === 8; }));
const x0 = (await D()).x;
await key('KeyD', 'ㅇ'); await page.waitForTimeout(600); await key('KeyD', 'ㅇ', 'keyup');
check('한글 입력 상태 D(ㅇ) 키로 걷는다', (await D()).x !== x0);
await shot('shot-village.png');

// ══ 3. 건물 클릭 → 걸어가 들어가기 → 수련 ══
const tp = await S(() => { const B = window.MHR.BUILDINGS.tarot; return window.MHR.R3.toScreen(B.door[0], B.door[1], 0); });
await page.mouse.click(tp.x, tp.y);
check('점집 클릭 → 걸어가서 패널이 열린다', await until(page, () => window.MHR._dbg().panel === 'tarot', 40000));
await page.click('[data-act="tarot"]');
check('타로 한 장 · 상단에 오늘 카드', await until(page, () => document.getElementById('card-today').textContent.length > 0));
await key('Escape', 'Escape');
check('Esc → 패널 닫힘', await until(page, () => window.MHR._dbg().mode === 'village'));
await S(() => { window.MHR._g().gold = 500; });
await S(() => { const M = window.MHR; M._g(); document.getElementById('panel-wrap'); });
await S(() => { const M = window.MHR, B = M.BUILDINGS.dojo; window.__go = M.R3.toScreen(B.door[0], B.door[1], 0); });
await S(() => window.MHR.ui.openPanel('dojo', window.MHR._g()));
await page.click('[data-act="train"][data-k="agi"]');
check('수련 → 3시간 지나고 민첩 오름', await until(page, () => { const g = window.MHR._g(); return g.hour === 11 && g.agi >= 7; }));
await shot('shot-dojo.png');
await S(() => window.MHR.ui.closePanel());
await S(() => { window.MHR.ui.shopTab = 'armor'; window.MHR.ui.openPanel('shop', window.MHR._g()); });
await page.click('[data-act="buy"][data-id="box"]');
check('잡화점: 박스 갑옷 구매·착용', await until(page, () => window.MHR._g().armor === 'box'));
await S(() => window.MHR.ui.closePanel());

// ══ 4. 던전 — 직접 공격 · 냥보 · 자동 전투 → 결과 ══
await S(() => window.MHR.act.dungeon(0));
check('던전 입장 → 전투 · 3시간', await until(page, () => window.MHR._dbg().mode === 'battle' && window.MHR._g().hour === 14));
await until(page, () => window.MHR._b().mobs.some((m) => !m.dead), 20000);
await S(() => { const b = window.MHR._b(), m = b.mobs.find((q) => !q.dead); b.hero.x = m.x; b.hero.y = m.y + 1.2; });
await key('KeyJ', 'ㅓ');
check('J(ㅓ) → 공격 동작', await until(page, () => { const h = window.MHR._b().hero; return h.act && h.act.kind === 'atk' || h.hits > 0; }, 5000));
await key('Space', ' ');
check('Space → 냥보 (대기 시간 시작)', await until(page, () => window.MHR._b().hero.dashCd > 0, 5000));
await shot('shot-battle.png');
await key('KeyT', 'ㅅ');
check('T → 자동 전투로 클리어 → 결과', await until(page, () => window.MHR._dbg().mode === 'result', 240000));
await shot('shot-result.png');
check('클리어 보상 · 2번 던전 열림', await S(() => { const g = window.MHR._g(); return g.cleared.d1 === 1 && window.MHR.Game.dungeonOpen(g, 1); }));
await key('Enter', 'Enter');
check('Enter → 마을로 (던전 입구 앞)', await until(page, () => window.MHR._dbg().mode === 'village' && window.MHR._dbg().y > 7));

// ══ 5. 침공 → 패배 → 되감기 ══
await S(() => { const g = window.MHR._g(); g.day = 8; g.hour = 15; g.gold = 777; g.snap = window.MHR.Game.snapshot(g); g.gold = 50; });
await S(() => window.MHR.ui.openPanel('fish', window.MHR._g()));
await page.click('[data-act="work"]');
check('8일째 알바 끝 18시 → 들개 깡패 침공 대화', await until(page, () => window.MHR._dbg().mode === 'talk'));
for (let i = 0; i < 2; i++) { await key('Space', ' '); await page.waitForTimeout(120); }
check('침공 전투 시작', await until(page, () => window.MHR._dbg().mode === 'battle' && window.MHR._b().spec.kind === 'invasion'));
await S(() => { window.MHR._b().phase = 'lose'; });
check('지면 되감기/물러서기 선택', await until(page, () => window.MHR._dbg().mode === 'choice'));
await shot('shot-choice.png');
await key('Enter', 'Enter');
check('되감기 → 8일째 아침 상태로', await until(page, () => { const g = window.MHR._g(); return window.MHR._dbg().mode === 'village' && g.day === 8 && g.hour === 15 && g.gold === 777 && g.stats.rollbacks === 1; }, 10000));

// ══ 6. 30일째 그림자 고양이 → 엔딩 ══
await S(() => { const g = window.MHR._g(); g.day = 30; g.hour = 20; });
await S(() => window.MHR.ui.openPanel('home', window.MHR._g()));
await page.click('[data-act="sleep"]');
check('30일째 자려 하면 그림자 고양이', await until(page, () => window.MHR._dbg().mode === 'talk'));
for (let i = 0; i < 3; i++) { await key('Space', ' '); await page.waitForTimeout(120); }
check('마지막 전투', await until(page, () => window.MHR._dbg().mode === 'battle' && window.MHR._b().spec.final));
await S(() => { window.MHR._b().phase = 'win'; });
check('이기면 엔딩 · 랭크', await until(page, () => window.MHR._dbg().mode === 'ending' && /랭크/.test(document.getElementById('end-lines').textContent)));
await shot('shot-ending.png');

// ══ 7. 저장 → 다시 열면 이어하기 ══
await page.reload(); await page.waitForTimeout(1800);
check('다시 열면 이어하기 · 저장된 날', await S(() => document.getElementById('btn-continue').style.display !== 'none' && /30일째/.test(document.getElementById('save-line').textContent)));
check('콘솔 에러 0', errors.length === 0, errors.slice(0, 3).join(' | '));

// ══ 8. 모바일 (터치) ══
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const mp = await ctx.newPage();
const merr = []; mp.on('pageerror', (e) => merr.push(String(e)));
await mp.goto('http://localhost:8777/moguhero.html'); await mp.waitForTimeout(1800);
await mp.evaluate(() => localStorage.removeItem('moguhero-save-v1'));
await mp.tap('#btn-new');
await until(mp, () => window.MHR._dbg().mode === 'talk');
for (let i = 0; i < 3; i++) { await mp.tap('#talk'); await mp.waitForTimeout(150); }
check('모바일: 대화 탭으로 넘기기 → 마을', await until(mp, () => window.MHR._dbg().mode === 'village'));
const m0 = await mp.evaluate(() => window.MHR._dbg());
await mp.touchscreen.tap(422 + 120, 195 + 60);
check('모바일: 땅을 탭하면 걸어간다', await until(mp, (a) => { const d = window.MHR._dbg(); return Math.hypot(d.x - a.x, d.y - a.y) > 0.5; }, 15000, m0));
await mp.evaluate(() => window.MHR.act.dungeon(0));
await until(mp, () => window.MHR._dbg().mode === 'battle');
check('모바일: 공격·냥보·회오리 버튼', await mp.evaluate(() => ['sk-atk', 'sk-dash', 'sk-skill'].every((id) => getComputedStyle(document.getElementById(id)).display !== 'none')));
await mp.tap('#sk-dash');
check('모바일: 냥보 버튼', await until(mp, () => window.MHR._b().hero.dashCd > 0, 5000));
await mp.screenshot({ path: join(shots, 'shot-mobile.png') });
await mp.setViewportSize({ width: 390, height: 844 }); await mp.waitForTimeout(400);
check('모바일 세로 → 가로 전환 안내', await mp.evaluate(() => !document.getElementById('rotate-hint').classList.contains('hidden')));
check('모바일 콘솔 에러 0', merr.length === 0, merr.join(' | '));

await browser.close(); server.close();
console.log(fails.length ? `\n실패 ${fails.length}건` : '\n전부 통과');
process.exit(fails.length ? 1 : 0);
