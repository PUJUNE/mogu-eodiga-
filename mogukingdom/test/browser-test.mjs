// 모구 고양이 왕국 브라우저 검증: 런처·생성·시뮬레이션·사건·모바일
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root=process.env.GAME_ROOT||join(dirname(fileURLToPath(import.meta.url)),'..','..');
const pwHome=process.env.PW_HOME;
if(!pwHome)throw new Error('PW_HOME 필요');
const require=createRequire(join(pwHome,'package.json'));
const { chromium }=require('playwright-core');
const chrome=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const shots=join(root,'mogukingdom','test');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};

const server=createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const f=join(root,p);
  if(!existsSync(f)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});
  res.end(readFileSync(f));
});
await new Promise(r=>server.listen(8876,r));

const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const fails=[],errors=[];
const check=(name,ok)=>{console.log((ok?'PASS':'FAIL')+' — '+name);if(!ok)fails.push(name);};

const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon')&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
await page.goto('http://127.0.0.1:8876/');
check('런처 게임 카드 16개',await page.locator('.card').count()===16);
check('모구 고양이 왕국 카드',await page.locator('#card-mogukingdom').isVisible());
await page.click('#card-mogukingdom');
await page.waitForFunction(()=>window.MKR&&window.MKR._dbg&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:30000});
let d=await page.evaluate(()=>window.MKR._dbg());
check('참조 씨앗 5601216',d.seed==='5601216');
check('정착지 6~9개',d.settlements>=6&&d.settlements<=9);
check('가문 5개',d.houses===5);
check('초기 연대기',d.events>=3);
check('3D 캔버스 표시',await page.locator('#app canvas').isVisible());
await page.screenshot({path:join(shots,'shot-kingdom.png')});

await page.evaluate(()=>window.MKR._tick(360));
d=await page.evaluate(()=>window.MKR._dbg());
check('1년 진행',d.day>=360);
check('인구 양수',d.pop>0);
check('연대기 누적',d.events>=5);
await page.evaluate(()=>window.MKR._act('plague',0));
check('감염병 사건 주입',await page.evaluate(()=>window.MKR._state().settlements[0].inf>0));
await page.click('#btnOverlay');
await page.click('[data-overlay="pop"]');
check('인구 오버레이',await page.evaluate(()=>window.MKR._dbg().overlay==='pop'));
await page.click('[data-tab="houses"]');
check('가문 5개 렌더링',await page.locator('#tab-houses .house').count()===5);
await page.evaluate(()=>window.MKR.focusSettlement(0));
await page.waitForTimeout(700);
await page.screenshot({path:join(shots,'shot-capital.png')});
await page.evaluate(()=>window.MKR._tick(3600));
d=await page.evaluate(()=>window.MKR._dbg());
check('11년 장기 진행 후 수치 정상',Number.isFinite(d.pop)&&d.pop>0&&Number.isFinite(d.treasury));
check('장기 사건 누적',d.events>=12);

const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
mobile.on('pageerror',e=>errors.push('mobile '+String(e)));
await mobile.goto('http://127.0.0.1:8876/mogukingdom.html#s=5601216');
await mobile.waitForFunction(()=>window.MKR&&window.MKR._dbg&&document.getElementById('loading').classList.contains('hidden'),null,{timeout:30000});
check('모바일 장부 접힘',await mobile.locator('#drawer').evaluate(el=>el.classList.contains('hidden')));
check('모바일 지도 버튼',await mobile.locator('#btnOverlay').isVisible());
await mobile.tap('#btnQuickWatch');
check('모바일 관람 모드',await mobile.evaluate(()=>window.MKR._dbg().watch));
await mobile.screenshot({path:join(shots,'shot-mobile.png')});

console.log(errors.length?'콘솔/페이지 오류:\n'+errors.join('\n'):'콘솔/페이지 오류 없음');
console.log(fails.length?'실패 '+fails.length+'건':'전체 통과');
await browser.close();server.close();
process.exit(errors.length||fails.length?1:0);
