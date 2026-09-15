// browser-test.mjs — 런처 카드 + 모구 스케치 파이터 브라우저 검증 (데스크톱 키보드 + 모바일 터치 + 성능)
// 사용: GAME_ROOT=<저장소 루트> CHROMIUM=/opt/pw-browsers/chromium node mogusketch/test/browser-test.mjs
//      (CHROMIUM 미지정 시 설치된 Chrome 채널 사용)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogusketch', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8768, r));

const launch = process.env.CHROMIUM
  ? { executablePath: process.env.CHROMIUM, headless: true }
  : { channel: 'chrome', headless: true };
const browser = await chromium.launch(launch);
const fails = [];
const errors = [];
const check = (name, ok, extra) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra != null ? ` (${extra})` : '')); if (!ok) fails.push(name); };
const dbg = (page) => page.evaluate(() => window.MSK._dbg());
const wait = (page, ms) => page.waitForTimeout(ms);

// ══ 1. 런처 → 타이틀 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8768/');
await wait(page, 400);
check('런처: 모구 스케치 파이터 카드 존재', await page.evaluate(() => {
  const a = document.getElementById('card-mogusketch');
  return !!a && a.getAttribute('href') === 'mogusketch.html';
}));
await page.click('#card-mogusketch');
await page.waitForURL('**/mogusketch.html');
await wait(page, 600);
check('카드를 누르면 타이틀이 뜬다', await page.isVisible('#title-screen'));
check('난이도 버튼 4단계', (await page.$$('.diff-btn')).length === 4);
await page.click('.diff-btn[data-diff="hard"]');
check('난이도 선택이 반영된다', await page.evaluate(() => window.MSK.diff === 'hard'));
await page.click('.diff-btn[data-diff="normal"]');
await page.screenshot({ path: join(shots, 'shot-title.png') });

// ══ 2. 대전 시작 · 스케치 톤 ══
await page.evaluate(() => { try { localStorage.removeItem('mogusketch-save-v1'); } catch (e) {} });
await page.keyboard.press('Enter');
await wait(page, 700);
let d = await dbg(page);
check('Enter로 대전 시작 → 도전자 소개 단계', d.mode === 'play' && d.phase === 'intro' && d.p[1].id === 'bboy', `${d.mode}/${d.phase}`);
await page.screenshot({ path: join(shots, 'shot-intro.png') });
await wait(page, 2200);
d = await dbg(page);
check('소개가 끝나면 대전 진행', d.phase === 'fight', d.phase);
await page.evaluate(() => window.MSK._ai(false));

const sampleCanvas = () => page.evaluate(() => {
  const cv = document.getElementById('game');
  const c = cv.getContext('2d');
  const { data } = c.getImageData(0, 0, cv.width, cv.height);
  let paper = 0, blue = 0, red = 0, black = 0, total = 0, hash = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    total++;
    hash = (hash * 31 + r * 7 + g * 3 + b) | 0;
    if (r > 235 && g > 235 && b > 230) paper++;
    else if (b > r + 40 && b > g + 20) blue++;
    else if (r > 150 && g < 110 && b < 110) red++;
    else if (r < 90 && g < 90 && b < 90) black++;
  }
  return { paper: paper / total, blue: blue / total, red: red / total, black: black / total, hash };
});
const s1 = await sampleCanvas();
check('흰 종이 바탕이 화면 대부분 (채운 면이 없다)', s1.paper > 0.75, s1.paper.toFixed(2));
check('파란 투시 보조선이 그려진다', s1.blue > 0.01, s1.blue.toFixed(3));
check('모구는 검은 선, 도전자는 빨간 선', s1.black > 0.002 && s1.red > 0.002, `black ${s1.black.toFixed(3)} red ${s1.red.toFixed(3)}`);
await wait(page, 260);
const s2 = await sampleCanvas();
check('선이 초당 여러 번 흔들린다 (가만히 있어도 화면이 바뀜)', s1.hash !== s2.hash);

// ══ 3. 키보드 조작 ══
const place = (x0, x1) => page.evaluate(([a, b]) => {
  const st = window.MSK._st();
  st.p[0].x = a; st.p[1].x = b; st.p[0].face = 1; st.p[1].face = -1;
  for (const f of st.p) { f.hp = f.maxHp; f.state = 'idle'; f.mv = null; f.vx = 0; f.y = 0; f.vy = 0; f.invuln = 0; f.gauge = 0; f.combo = 0; }
  st.proj = []; st.haz = []; st.timer = 60; st.hitstop = 0;
}, [x0, x1]);

await place(300, 700);
const x0 = (await dbg(page)).p[0].x;
await page.keyboard.down('ArrowRight'); await wait(page, 400); await page.keyboard.up('ArrowRight');
d = await dbg(page);
check('→ 이동', d.p[0].x > x0 + 40, `${x0} → ${d.p[0].x}`);
await page.keyboard.down('ArrowUp');
let maxY = 0;
for (let i = 0; i < 10; i++) { await wait(page, 40); maxY = Math.max(maxY, (await dbg(page)).p[0].y); }
await page.keyboard.up('ArrowUp');
check('↑ 점프', maxY > 60, `max y ${maxY}`);
await wait(page, 700);
await page.keyboard.down('ArrowDown'); await wait(page, 120);
d = await dbg(page);
check('↓ 앉기', d.p[0].state === 'crouch', d.p[0].state);
await page.keyboard.up('ArrowDown'); await wait(page, 100);
await page.keyboard.press('z'); await wait(page, 90);
d = await dbg(page);
check('Z = 약 공격', d.p[0].mv === 'lp', d.p[0].mv);
await wait(page, 400);
await page.keyboard.press('x'); await wait(page, 110);
d = await dbg(page);
check('X = 강 공격', d.p[0].mv === 'hp', d.p[0].mv);
await wait(page, 500);
await page.screenshot({ path: join(shots, 'shot-fight.png') });

// 가드 — 상대 약 공격을 뒤로 누른 채 막으면 칩 4
await place(400, 468);
await page.keyboard.down('ArrowLeft');
await wait(page, 60);
await page.evaluate(() => { const st = window.MSK._st(); window.MSK.Logic.startMove(st, st.p[1], st.p[0], 'lp', []); });
await wait(page, 400);
await page.keyboard.up('ArrowLeft');
d = await dbg(page);
check('뒤로 누르면 가드 — 대미지가 10%로 줄어든다', d.p[0].hp === 996, `hp ${d.p[0].hp}`);

// 잡기 — Z+X 동시
await place(400, 456);
await page.evaluate(() => { const st = window.MSK._st(); st.p[1].inp = { right: true }; });
await page.keyboard.down('z'); await page.keyboard.down('x'); await wait(page, 60);
await page.keyboard.up('z'); await page.keyboard.up('x');
await wait(page, 500);
d = await dbg(page);
check('Z+X 동시 = 근접 잡기 (대미지 120, 가드 불가)', d.p[1].hp === 900 - 120, `hp ${d.p[1].hp}`);
await wait(page, 1500);

// 냥파동 — ↓ ↘ → + Z
await place(300, 640);
await page.keyboard.down('ArrowDown'); await wait(page, 50);
await page.keyboard.down('ArrowRight'); await wait(page, 50);
await page.keyboard.up('ArrowDown'); await wait(page, 30);
await page.keyboard.press('z');
await page.keyboard.up('ArrowRight');
await wait(page, 300);
d = await dbg(page);
check('↓→+Z로 냥파동이 날아간다', d.proj === 1, `proj ${d.proj}`);
await wait(page, 1200);
d = await dbg(page);
check('냥파동 적중 대미지 90', d.p[1].hp === 900 - 90, `hp ${d.p[1].hp}`);

// 초필살 — 게이지 100에서 C
await place(390, 520);
await page.evaluate(() => { window.MSK._st().p[0].gauge = 100; });
await wait(page, 60);
await page.keyboard.press('c');
await wait(page, 300);
await page.screenshot({ path: join(shots, 'shot-super.png') });
await wait(page, 1600);
d = await dbg(page);
check('게이지 100에서 C = 초필살 (대미지 320)', d.p[1].hp === 900 - 320 && d.p[0].gauge < 100, `hp ${d.p[1].hp} gauge ${d.p[0].gauge}`);

// ══ 4. 성능 — 설계 7절 최악 장면 ══
await place(420, 540);
await page.evaluate(() => window.MSK._worst(true));
await wait(page, 500);
const perf = await page.evaluate(() => new Promise((res) => {
  let n = 0, maxSeg = 0; const t0 = performance.now();
  const tick = () => { n++; maxSeg = Math.max(maxSeg, window.MSK.Render.stats.segments); if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res({ fps: n / ((performance.now() - t0) / 1000), maxSeg }); };
  requestAnimationFrame(tick);
}));
await page.screenshot({ path: join(shots, 'shot-worst.png') });
await page.evaluate(() => window.MSK._worst(false));
check('최악 장면(동시 공격+기탄 3+타격 3+의성어 2)에서 55fps 이상', perf.fps >= 55, `${perf.fps.toFixed(1)} fps`);
check('프레임당 선 분절 3,000 이하', perf.maxSeg <= 3000, `${perf.maxSeg}`);

// ══ 5. 승리 도장 → 다음 도전자 ══
const waitFight = async (pg) => { for (let i = 0; i < 60; i++) { const q = await dbg(pg); if (q.phase === 'fight') return; await wait(pg, 100); } };
const waitNot = async (pg, ph) => { for (let i = 0; i < 80; i++) { const q = await dbg(pg); if (q.phase !== ph || q.mode !== 'play') return; await wait(pg, 100); } };
const koRound = async () => {
  await waitFight(page);
  await place(400, 470);
  await page.evaluate(() => { window.MSK._st().p[1].hp = 1; });
  await page.keyboard.press('z');
  await wait(page, 400);
  await waitNot(page, 'ko');
  await waitNot(page, 'roundEnd');
};
await koRound();
d = await dbg(page);
check('KO 후 1:0으로 2라운드', d.wins[0] === 1 && d.round === 2, `wins ${d.wins} round ${d.round}`);
await koRound();
await wait(page, 1800);
check('두 라운드를 먼저 이기면 승리 도장 화면', await page.isVisible('#win-screen'));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.keyboard.press('Enter');
await wait(page, 700);
d = await dbg(page);
check('다음 도전자로 진행 (꼬꼬 권법가)', d.stage === 1 && d.p[1].id === 'kkokko', `${d.stage} ${d.p[1].id}`);

// ══ 6. 도전자 8명 / 보스 엔딩 ══
const names = await page.evaluate(() => window.MSK.LADDER.map((id) => window.MSK.FIGHTERS[id].name));
check('도전자 8명 순서', names.join(',') === '후드 비보이 쥐,꼬꼬 권법가,복서 쥐,태권 쥐,스모 쥐,닌자 쥐,레슬러 쥐,연필 사범', names.join(','));
await page.evaluate(() => {
  const st = window.MSK._st();
  const fresh = window.MSK.Logic.create(5, 'normal', 7);
  Object.assign(st, fresh);
  st.wins = [1, 0];
});
await koRound();
await wait(page, 1800);
d = await dbg(page);
check('연필 사범을 이기면 엔딩 컷', d.mode === 'ending', d.mode);
await wait(page, 4200);
check('엔딩 뒤 타이틀로 돌아가는 버튼', await page.isVisible('#ending-screen'));
await page.screenshot({ path: join(shots, 'shot-ending.png') });

check('데스크톱 콘솔 오류 0건', errors.length === 0, errors.slice(0, 3).join(' | '));

// ══ 7. 모바일 터치 ══
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const mp = await ctx.newPage();
const merr = [];
mp.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) merr.push(m.text()); });
mp.on('pageerror', (e) => merr.push(String(e)));
await mp.goto('http://localhost:8768/mogusketch.html');
await wait(mp, 600);
check('모바일: 터치 모드 인식', await mp.evaluate(() => document.body.classList.contains('touch')));
await mp.tap('#btn-start');
await wait(mp, 2900);
await mp.evaluate(() => window.MSK._ai(false));
check('모바일: 대전 중 가상 패드 표시', await mp.isVisible('#vdpad') && await mp.isVisible('#vb-lp'));
const mplace = (a, b) => mp.evaluate(([x0, x1]) => {
  const st = window.MSK._st();
  st.p[0].x = x0; st.p[1].x = x1; st.p[0].face = 1; st.p[1].face = -1;
  for (const f of st.p) { f.hp = f.maxHp; f.state = 'idle'; f.mv = null; f.vx = 0; f.invuln = 0; }
  st.timer = 60; st.hitstop = 0;
}, [a, b]);
await mplace(300, 700);
const pad = await mp.$('#vdpad');
const pb = await pad.boundingBox();
const mx0 = (await dbg(mp)).p[0].x;
await mp.dispatchEvent('#vdpad', 'pointerdown', { pointerId: 7, clientX: pb.x + pb.width * 0.95, clientY: pb.y + pb.height / 2, isPrimary: true, pointerType: 'touch' });
await wait(mp, 400);
await mp.dispatchEvent('#vdpad', 'pointerup', { pointerId: 7, pointerType: 'touch' });
d = await dbg(mp);
check('모바일: 패드 오른쪽 = 이동', d.p[0].x > mx0 + 30, `${mx0} → ${d.p[0].x}`);
await mplace(300, 700);
await mp.dispatchEvent('#vb-lp', 'pointerdown', { pointerId: 8, pointerType: 'touch' });
await wait(mp, 90);
d = await dbg(mp);
await mp.dispatchEvent('#vb-lp', 'pointerup', { pointerId: 8, pointerType: 'touch' });
check('모바일: 약 버튼 = 약 공격', d.p[0].mv === 'lp', d.p[0].mv);
await wait(mp, 400);
await mplace(300, 700);
await mp.dispatchEvent('#vb-sp', 'pointerdown', { pointerId: 9, pointerType: 'touch' });
await wait(mp, 250);
await mp.dispatchEvent('#vb-sp', 'pointerup', { pointerId: 9, pointerType: 'touch' });
d = await dbg(mp);
check('모바일: 필살 버튼 = 냥파동', d.proj === 1 || d.p[0].mv === 'sp1', `proj ${d.proj} mv ${d.p[0].mv}`);
await wait(mp, 900);
await mplace(390, 520);
await mp.evaluate(() => { window.MSK._st().p[0].gauge = 100; });
await wait(mp, 80);
check('모바일: 게이지가 차면 초필살 버튼 활성', await mp.evaluate(() => document.getElementById('vb-su').classList.contains('ready')));
await mp.dispatchEvent('#vb-su', 'pointerdown', { pointerId: 10, pointerType: 'touch' });
await wait(mp, 60);
await mp.dispatchEvent('#vb-su', 'pointerup', { pointerId: 10, pointerType: 'touch' });
await wait(mp, 1800);
d = await dbg(mp);
check('모바일: 초필살 버튼 = 초필살', d.p[1].hp === 900 - 320, `hp ${d.p[1].hp}`);
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
check('모바일 콘솔 오류 0건', merr.length === 0, merr.slice(0, 3).join(' | '));

await browser.close();
server.close();
console.log(fails.length ? `\n실패 ${fails.length}건: ${fails.join(' / ')}` : '\n브라우저 테스트 전부 통과');
process.exit(fails.length ? 1 : 0);
