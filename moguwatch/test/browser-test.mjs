// browser-test.mjs — 런처 카드 + 모구워치 브라우저 검증 (데스크톱 마우스·키보드 + 모바일 터치)
// 사용: GAME_ROOT=<저장소 루트> [CHROMIUM=<실행 파일>] node moguwatch/test/browser-test.mjs
// WebGL 은 헤드리스에서 SwiftShader 로 그린다 — 느려서 정해진 시간 대신 상태를 기다린다.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'moguwatch', 'test');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8781, r));

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: true, args } : { channel: 'chrome', headless: true, args });
const fails = [], errors = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const watch = (pg) => { pg.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); }); pg.on('pageerror', (e) => errors.push(String(e))); };
const until = (pg, f, ms = 30000, arg = null) => pg.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
watch(page);
const S = (f, a) => page.evaluate(f, a);
const D = () => S(() => window.MWT._dbg());
const shot = (n) => page.screenshot({ path: join(shots, n) });
// 터 i 의 화면 자리
const plotXY = (i) => S((i) => { const p = window.MWT._G().plots[i]; return window.MWT.R3.toScreen(p.x, 0.1, p.z); }, i);
// 군자금을 넉넉히 · 공세는 멈춰 둔다
const rich = () => S(() => { const G = window.MWT._G(); G.gold = 5000; G.nextIn = 1e9; });

// ══ 1. 런처 → 타이틀 ══
await page.goto('http://localhost:8781/');
await page.waitForTimeout(400);
check('런처: 모구워치 카드', await S(() => document.getElementById('card-moguwatch')?.getAttribute('href') === 'moguwatch.html'));
await page.fill('#game-search', '워치');
await page.waitForTimeout(150);
check('런처 검색 "워치" → 카드 1개', await S(() => [...document.querySelectorAll('#cards .card')].filter((c) => !c.classList.contains('filtered-out')).length === 1));
await page.fill('#game-search', '');
await page.click('#card-moguwatch');
await page.waitForTimeout(1500);
await S(() => localStorage.removeItem('moguwatch-save-v1'));
await page.reload(); await page.waitForTimeout(2500);
check('타이틀 · 동네 6칸 · 처음엔 서울숲만 열림', await S(() => {
  const c = [...document.querySelectorAll('#maps .map')];
  return !document.getElementById('title-screen').classList.contains('hidden') && c.length === 6 && !c[0].classList.contains('lock') && c.slice(1).every((x) => x.classList.contains('lock'));
}));
check('WebGL: 디오라마를 그린다 · 카메라 정상', await S(() => { const R = window.MWT.R3; return R.renderer.info.render.triangles > 5000 && R.world && R.camera.position.toArray().every(Number.isFinite); }));
check('타이틀 시연은 초당 20번 남짓만 그린다 (발열 방지)', await S(async () => { const R = window.MWT.R3, f0 = R.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 1000)); return R.renderer.info.render.frame - f0 <= 24; }));
check('잠긴 동네는 눌러도 안 골라진다', await S(() => { document.querySelector('.map[data-m="2"]').click(); return window.MWT.ui.sel === 0; }));
await S(() => document.querySelector('.mode-btn[data-mode="endless"]').click());
check('끝없는 방어로 바꾸면 여섯 동네 모두 열림', await S(() => [...document.querySelectorAll('#maps .map')].every((x) => !x.classList.contains('lock'))));
await S(() => document.querySelector('.mode-btn[data-mode="campaign"]').click());
await shot('shot-title.png');

// ══ 2. 서울숲 시작 → 짓기 ══
await page.keyboard.press('Enter');
check('Enter → 전투 · HUD · 동네 소개', await until(page, () => window.MWT._dbg().mode === 'play' && !document.getElementById('hud').classList.contains('hidden') && !document.getElementById('banner').classList.contains('hidden')));
check('처음 군자금·츄르 (노말 260 · 20)', await S(() => { const d = window.MWT._dbg(); return d.gold === 260 && d.lives === 20 && d.wave === 0; }));
let p0 = await plotXY(0);
await page.mouse.click(p0.x, p0.y);
check('터를 누르면 짓기 메뉴 (탑 4종)', await until(page, () => { const d = window.MWT._dbg(); return d.menu && d.menu.plot === 0 && document.querySelectorAll('#brow .bt').length === 4; }, 5000));
await page.click('#brow .bt[data-k="yarn"]');
check('한 번 누르면 쓰임새 · 사거리 고리', await S(() => window.MWT._dbg().menu.pick === 'yarn' && document.getElementById('binfo').textContent.includes('한 번 더') && window.MWT.R3.ring.visible));
await page.click('#brow .bt[data-k="yarn"]');
check('한 번 더 누르면 털실 망루 · 군자금 −70', await until(page, () => { const d = window.MWT._dbg(); return d.towers === 1 && d.gold === 190 && !d.menu; }, 5000));
let p1 = await plotXY(1);
await page.mouse.click(p1.x, p1.y);
await page.waitForTimeout(150);
await page.keyboard.press('Digit2'); await page.keyboard.press('Digit2');
check('키보드 2·2 → 캔 포대', await until(page, () => window.MWT._G().towerAt[1]?.kind === 'can', 5000));
await rich();
await page.mouse.click(p0.x, p0.y);
await page.waitForTimeout(150);
check('지은 탑을 누르면 증축·철거 메뉴', await S(() => !!document.querySelector('#brow .bt[data-k="up"]') && !!document.querySelector('#brow .bt[data-k="sell"]')));
await page.click('#brow .bt[data-k="up"]'); await page.click('#brow .bt[data-k="up"]');
check('증축 두 번 누르기 → 2단계', await until(page, () => window.MWT._G().towerAt[0]?.lvl === 1, 5000));
const g0 = (await D()).gold;
await page.click('#brow .bt[data-k="sell"]'); await page.click('#brow .bt[data-k="sell"]');
check('철거 두 번 누르기 → 사라지고 60% 돌려받기', await until(page, (g0) => !window.MWT._G().towerAt[0] && window.MWT._dbg().gold === g0 + Math.round((70 + 100) * 0.6), 5000, g0));
// 초소 · 레이저
for (const [i, k] of [[2, 'guard'], [3, 'laser']]) {
  const p = await plotXY(i); await page.mouse.click(p.x, p.y); await page.waitForTimeout(120);
  await page.click(`#brow .bt[data-k="${k}"]`); await page.click(`#brow .bt[data-k="${k}"]`);
}
check('냥냥 초소 · 레이저 등대 · 병사 둘', await until(page, () => { const G = window.MWT._G(); return G.towerAt[2]?.kind === 'guard' && G.towerAt[3]?.kind === 'laser' && G.men.length === 2; }, 5000));
await page.mouse.click(5, 360);
check('빈 곳을 누르면 메뉴 닫힘', await until(page, () => !window.MWT._dbg().menu, 3000));

// ══ 3. 공세 · 빠르기 · 쉬기 · 둘러보기 ══
await S(() => { window.MWT._G().nextIn = 20; });
await page.keyboard.press('Space');
check('Space → 1공세 · 알림', await until(page, () => window.MWT._dbg().wave === 1 && document.getElementById('ban1').textContent.includes('제1공세'), 5000));
check('도둑이 나와 길을 걷는다', await until(page, () => window.MWT._G().mons.some((m) => m.d > 1), 15000));
await page.keyboard.press('Tab');
check('Tab → 2배 빠르기', (await D()).speed === 2 && await until(page, () => document.getElementById('b-speed').textContent === '2×', 3000));
await page.click('#b-speed'); await page.click('#b-speed');
check('빠르기 버튼 3× → 1×', (await D()).speed === 1);
await page.keyboard.press('Escape');
check('Esc → 쉬기 화면', await until(page, () => window.MWT._dbg().mode === 'pause' && !document.getElementById('pause-screen').classList.contains('hidden'), 3000));
await page.keyboard.press('Escape');
check('Esc → 계속', await until(page, () => window.MWT._dbg().mode === 'play', 3000));
const z0 = await S(() => window.MWT.R3.view.zoom);
await page.mouse.move(640, 360); await page.mouse.wheel(0, -300); await page.waitForTimeout(200);
check('휠로 확대', await S((z0) => window.MWT.R3.view.zoom > z0, z0));
const v0 = await S(() => ({ ...window.MWT.R3.view }));
await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(540, 300, { steps: 6 }); await page.mouse.up();
check('끌어서 둘러보기 (짓기 메뉴는 안 열림)', await S((v0) => { const v = window.MWT.R3.view; return (v.px !== v0.px || v.pz !== v0.pz) && !window.MWT._dbg().menu; }, v0));
await page.click('#b-zout'); await page.click('#b-zout'); await page.click('#b-zout'); await page.click('#b-zout');
check('− 버튼으로 다시 전체 보기', await S(() => window.MWT.R3.view.zoom === 1));
await shot('shot-battle.png');

// ══ 4. 자동 지휘 → 끝까지 지키기 → 결과 · 기록 · 다음 동네 ══
await page.click('#auto');
check('자동 지휘 켜기', (await D()).auto && await until(page, () => document.getElementById('auto-t').textContent.includes('군사 모구'), 3000));
// 헤드리스는 느려서 시뮬레이션만 빨리 돌린다 (봇 + 걸음). 사건은 다음 그림에서 처리된다
await S(() => { const M = window.MWT, G = M._G(), bot = M.makeBot(); G.gold += 300; for (let i = 0; i < 60 * 60 * 25 && G.phase === 'play'; i++) { bot.step(G, M.STEP); M.Game.step(G, M.STEP); if (G.ev.length > 400) G.ev.splice(0, G.ev.length - 50); } });
check('지켜냄 → 결과 화면 · 별', await until(page, () => !document.getElementById('result-screen').classList.contains('hidden') && document.getElementById('res-title').textContent.includes('지켜냈다') && document.getElementById('res-stars').textContent.includes('★'), 15000));
check('기록 저장 · 성남 열림', await S(() => { const s = JSON.parse(localStorage.getItem('moguwatch-save-v1')); return s.best.normal.seoulforest >= 1 && window.MWT.save.unlocked(1); }));
await shot('shot-result.png');
await page.click('#btn-next');
check('다음 동네 → 성남 (길 둘)', await until(page, () => window.MWT._dbg().map === 'seongnam' && window.MWT._G().paths.length === 2 && window.MWT._dbg().mode === 'play', 8000));
await page.waitForTimeout(1500);
await shot('shot-seongnam.png');
// 우두머리 · 능력 — 청소왕 흡입이 탑을 멈춘다
await rich();
await S(() => { const M = window.MWT, G = M._G(); const p = G.plots.find((q) => q.cov.yarn[0] > 4); M.Game.build(G, p.i, 'yarn'); const b = M.Game.spawnMon(G, 'bRobot', { pi: p.rally.pi, d: p.rally.d }); b.empCd = 0.05; });
check('우두머리 판교 청소왕 · 흡입 알림 · 탑 멈춤', await until(page, () => window.MWT._G().towers.some((t) => t.stun > 0) && document.getElementById('toast').textContent.includes('흡입'), 8000));
// 지기
await S(() => { const M = window.MWT, G = M._G(); G.lives = 1; const m = M.Game.spawnMon(G, 'mouse'); m.d = G.paths[0].len - 0.3; });
check('츄르를 다 뺏기면 결과 화면', await until(page, () => !document.getElementById('result-screen').classList.contains('hidden') && document.getElementById('res-title').textContent.includes('뺏겼다'), 8000));
await page.click('#btn-menu');
check('동네 고르기 → 타이틀 시연', await until(page, () => window.MWT._dbg().mode === 'title' && !document.getElementById('title-screen').classList.contains('hidden'), 5000));

// ══ 5. 끝없는 방어 · 신촌 밤 ══
await S(() => { document.querySelector('.mode-btn[data-mode="endless"]').click(); document.querySelector('.map[data-m="5"]').click(); });
await page.click('#btn-start');
check('끝없는 방어 · 신촌', await until(page, () => { const d = window.MWT._dbg(); return d.mode === 'play' && d.map === 'sinchon' && d.endless; }, 8000));
await S(() => { window.MWT._auto(true); window.MWT._speed(3); window.MWT.Game.callWave(window.MWT._G()); });
await page.waitForTimeout(5000);
await shot('shot-sinchon.png');
await S(() => { const M = window.MWT, G = M._G(), bot = M.makeBot(); for (let i = 0; i < 60 * 60 * 12 && G.phase === 'play' && G.waveN <= 9; i++) { bot.step(G, M.STEP); M.Game.step(G, M.STEP); if (G.ev.length > 400) G.ev.splice(0, G.ev.length - 50); } });
check('끝없는 방어: 8공세를 넘어 계속', await S(() => window.MWT._G().waveN >= 9 && window.MWT._G().level >= 1));
await page.keyboard.press('Escape'); await page.click('#btn-quit');
await until(page, () => window.MWT._dbg().mode === 'title', 4000);

// ══ 6. 모바일 터치 ══
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
watch(mob);
await mob.goto('http://localhost:8781/moguwatch.html');
await mob.waitForTimeout(2500);
await mob.screenshot({ path: join(shots, 'shot-mobile-title.png') });
await mob.tap('.map[data-m="0"]');   // 이미 고른 동네라 한 번이면 시작
check('모바일: 고른 동네를 톡 → 전투', await until(mob, () => window.MWT._dbg().mode === 'play', 8000));
await mob.waitForTimeout(800);
const mp = await mob.evaluate(() => { const G = window.MWT._G(); const i = G.plots.findIndex((p) => { const s = window.MWT.R3.toScreen(p.x, 0.1, p.z); return s.y > 200 && s.y < 640; }); const p = G.plots[i]; return Object.assign({ i }, window.MWT.R3.toScreen(p.x, 0.1, p.z)); });
await mob.touchscreen.tap(mp.x, mp.y);
check('모바일: 터를 톡 → 짓기 메뉴', await until(mob, (i) => window.MWT._dbg().menu?.plot === i, 4000, mp.i));
await mob.tap('#brow .bt[data-k="yarn"]'); await mob.tap('#brow .bt[data-k="yarn"]');
check('모바일: 두 번 톡 → 털실 망루', await until(mob, (i) => window.MWT._G().towerAt[i]?.kind === 'yarn', 4000, mp.i));
check('모바일: 세로 HUD가 화면 안에', await mob.evaluate(() => ['stat', 'wavebox', 'auto', 'call', 'bl', 'br'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= 391 && r.top >= 0 && r.bottom <= 845; })));
{ await mob.evaluate(() => { window.MWT._G().nextIn = 1e9; }); await mob.waitForTimeout(200); const r = await mob.evaluate(() => { const b = document.getElementById('call').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); await mob.touchscreen.tap(r.x, r.y); }
check('모바일: 공세 부르기 버튼', await until(mob, () => window.MWT._dbg().wave === 1, 4000));
await mob.waitForTimeout(2500);
await mob.screenshot({ path: join(shots, 'shot-mobile.png') });

check('콘솔 에러 0', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log(fails.length ? `\n${fails.length}개 실패: ${fails.join(', ')}` : '\n모두 통과');
process.exit(fails.length ? 1 : 0);
