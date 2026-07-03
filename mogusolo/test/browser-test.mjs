// browser-test.mjs — 런처 12카드 + 모구 혼자 레벨업 브라우저 검증 (데스크톱 + 터치)
// 사용: GAME_ROOT=<저장소 루트> node browser-test.mjs   (playwright-core 설치 폴더에서 실행)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = process.env.GAME_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'mogusolo', 'test');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(root, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(8758, r));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const fails = [];
const errors = [];
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fails.push(name); };

// ══ 1. 런처: 카드 12장 ══
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:8758/');
await page.waitForTimeout(600);
check('런처: 게임 카드 12개', await page.evaluate(() => document.querySelectorAll('.card').length >= 12));
await page.screenshot({ path: join(shots, 'shot-launcher12.png') });
await page.click('#card-mogusolo');
await page.waitForTimeout(900);
check('런처 → 모구 혼자 레벨업 타이틀', await page.evaluate(() =>
  !!window.MSL && !document.getElementById('title-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-title.png') });

// 난이도 버튼: 크레이지 선택 → 저장 반영 → 노말 복원
check('타이틀: 난이도 버튼 4개', await page.evaluate(() => document.querySelectorAll('.diff-btn').length === 4));
await page.click('.diff-btn[data-diff="crazy"]');
await page.waitForTimeout(150);
check('크레이지 선택 반영', await page.evaluate(() =>
  window.MSL.diff === 'crazy' && document.querySelector('.diff-btn[data-diff="crazy"]').classList.contains('selected')));
await page.click('.diff-btn[data-diff="normal"]');
await page.waitForTimeout(150);

// ══ 2. 키보드: 이동 + 공격 + 스킬 게이트 ══
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Enter → MISSION 1 플레이', await page.evaluate(() => { const d = window.MSL._dbg(); return d.mode === 'play' && d.phase === 'play'; }));
check('M1: 꼬꼬 없음 (나 혼자)', await page.evaluate(() => window.MSL._dbg().b === null));
const x0 = await page.evaluate(() => window.MSL._dbg().p.x);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowRight');
const x1 = await page.evaluate(() => window.MSL._dbg().p.x);
check(`→ 홀드 → 이동 (x ${x0} → ${x1})`, x1 > x0 + 30);
await page.keyboard.press(' ');
await page.waitForTimeout(200);
check('Space → 공격 모션', true);
// 스킬: Lv1에서 Q 잠김 (MP 안 줄어야)
const mp0 = await page.evaluate(() => window.MSL._dbg().mp);
await page.keyboard.press('q');
await page.waitForTimeout(200);
const mp1 = await page.evaluate(() => window.MSL._dbg().mp);
check(`Lv1: Q 잠김 (MP ${mp0} → ${mp1})`, mp1 >= mp0 - 0.5);
// 경험치 주입 → 레벨업 → QWER 해금 + R 시전 (전장 정리로 피격 플레이크 차단)
await page.evaluate(() => {
  const s = window.MSL._st();
  window.MSL.Logic._gainExp(s, 1500, []);
  s.mp = 100;
  s.enemies = []; s.waveIdx = 99;
  s.stage.sections[s.secIdx].waves = [[], []];
  s.p.state = 'idle'; s.p.hp = s.p.maxHp; s.p.iv = 0;
});
await page.waitForTimeout(300);
check('경험치 주입 → Lv9+', await page.evaluate(() => window.MSL._dbg().lv >= 9));
await page.keyboard.press('w');
await page.waitForTimeout(200);
check('W → 은신 발동', await page.evaluate(() => window.MSL._dbg().stealth > 2));
await page.keyboard.press('r');
await page.waitForTimeout(300);
const mpAfterR = await page.evaluate(() => window.MSL._dbg().mp);
check(`R → 권능 시전 (MP ${mpAfterR})`, mpAfterR < 100 - 20);
await page.waitForTimeout(600);
await page.screenshot({ path: join(shots, 'shot-play.png') });

// ══ 3. 그림자 추출 (시체 주입 → E) ══
await page.evaluate(() => {
  const s = window.MSL._st();
  const M2 = window.MSL;
  const E = M2.ETYPES.scorp;
  for (let i = 0; i < 3; i++) {
    s.enemies.push({
      kind: 'e', type: 'scorp', name: E.name, look: E.look, ranged: false,
      x: s.p.x + 20 + i * 8, z: s.p.z, jy: 0, vy: 0, face: -1,
      hp: 0, maxHp: E.hp, spd: E.spd, dmg: E.dmg, w: E.w,
      state: 'dead', stT: 0.2, combo: 0, comboT: 99, atkCd: 0, hitDone: false,
      iv: 0, reviveT: 0, baseAtkCd: E.atkCd, score: E.score, counted: true,
    });
  }
  s.skillCd.e = 0; s.mp = 100;
});
await page.keyboard.press('e');
await page.waitForTimeout(150);
check('E → 그림자 병사 1기', await page.evaluate(() => window.MSL._dbg().shadows === 1));
await page.evaluate(() => { const s = window.MSL._st(); s.skillCd.e = 0; });
await page.keyboard.press('e');
await page.waitForTimeout(150);
check('E → 그림자 병사 2기', await page.evaluate(() => window.MSL._dbg().shadows === 2));
await page.screenshot({ path: join(shots, 'shot-shadow.png') });

// ══ 4. 클리어 흐름 (보스 직접 처치 주입) ══
await page.evaluate(() => {
  const s = window.MSL._st();
  s.secIdx = s.stage.sections.length - 1; s.bossSpawned = true; s.waveIdx = 0;
  s.stage.sections[s.secIdx].waves = [[], []];
  s.enemies = [];
});
await page.waitForTimeout(500);
check('중간보스 격파 → 클리어 화면', await page.evaluate(() =>
  window.MSL._dbg().phase === 'clear'));
await page.waitForTimeout(1600);
check('승리 화면 표시', await page.evaluate(() =>
  window.MSL._dbg().mode === 'win' && !document.getElementById('win-screen').classList.contains('hidden')));
await page.screenshot({ path: join(shots, 'shot-win.png') });
await page.click('#btn-next');
await page.waitForTimeout(500);
check('다음 스테이지 → M1-2 (아직 나 혼자)', await page.evaluate(() => {
  const d = window.MSL._dbg();
  return d.no === 2 && d.mission === 1 && d.stg === 2 && d.b === null;
}));
// M2 진입: 꼬꼬 합류 (no 11 직접 주입 클리어)
await page.evaluate(() => {
  const s = window.MSL._st();
  s.secIdx = s.stage.sections.length - 1; s.bossSpawned = true; s.waveIdx = 0;
  s.stage.sections[s.secIdx].waves = [[], []];
  s.enemies = [];
  window.MSL.save.data.best = 11;                    // M2-1
});
await page.waitForTimeout(2200);
await page.click('#btn-win-title');
await page.waitForTimeout(300);
await page.click('#btn-continue');
await page.waitForTimeout(500);
check('이어하기 → M2-1 + 꼬꼬 합류', await page.evaluate(() => {
  const d = window.MSL._dbg();
  return d.no === 11 && d.mission === 2 && d.b !== null;
}));

// ══ 5. 일시정지 + 시리즈 버튼 ══
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('ESC → 일시정지', await page.evaluate(() => !document.getElementById('pause-screen').classList.contains('hidden')));
await page.click('#btn-title');
await page.waitForTimeout(300);
await page.click('#btn-series');
await page.waitForTimeout(600);
check('시리즈 버튼 → 런처 복귀', (await page.title()) === '모구 게임 시리즈');
await page.close();

// ══ 6. 터치 (빌드본) ══
const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto('http://localhost:8758/mogusolo.html');
await mp.waitForTimeout(900);
check('터치 감지 (body.touch)', await mp.evaluate(() => document.body.classList.contains('touch')));
const nb = await mp.evaluate(() => { const r = document.getElementById('btn-new').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await mp.touchscreen.tap(nb.x, nb.y);
await mp.waitForTimeout(500);
check('처음부터 탭 → 플레이 + 패드 표시', await mp.evaluate(() =>
  window.MSL._dbg().mode === 'play' && getComputedStyle(document.getElementById('vpad')).display === 'block'));
const press = (id, v) => mp.evaluate(([id, v]) => {
  document.getElementById(id).dispatchEvent(new PointerEvent(v ? 'pointerdown' : 'pointerup', { bubbles: true, pointerType: 'touch' }));
}, [id, v]);
await mp.evaluate(() => {                                      // 이동 측정 방해 제거 (웨이브 재스폰까지 차단)
  const s = window.MSL._st();
  s.enemies = []; s.waveIdx = 99;
  s.stage.sections[s.secIdx].waves = [[], []];
  s.p.state = 'idle'; s.p.hp = s.p.maxHp; s.p.iv = 0;
});
await mp.waitForTimeout(300);
const tx0 = await mp.evaluate(() => window.MSL._dbg().p.x);
await press('vbtn-right', true);
await mp.waitForTimeout(500);
await press('vbtn-right', false);
const tx1 = await mp.evaluate(() => window.MSL._dbg().p.x);
check(`▶ 홀드 → 이동 (x ${tx0} → ${tx1})`, tx1 > tx0 + 25);
// 터치 스킬 버튼: 경험치 주입 후 W 은신
await mp.evaluate(() => { const s = window.MSL._st(); window.MSL.Logic._gainExp(s, 1500, []); s.mp = 100; });
await press('vbtn-w', true);
await mp.waitForTimeout(150);
await press('vbtn-w', false);
check('터치 W → 은신 발동', await mp.evaluate(() => window.MSL._dbg().stealth > 2));
await mp.screenshot({ path: join(shots, 'shot-touch.png') });
await mp.close();

console.log(errors.length ? '콘솔/페이지 에러:\n' + errors.join('\n') : '콘솔/페이지 에러 없음(404 제외)');
console.log(fails.length ? `실패 ${fails.length}건` : '전체 통과');
await browser.close();
server.close();
process.exit(errors.length || fails.length ? 1 : 0);
