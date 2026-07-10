// world.js — 왕국 지형·정착지·가문·건물 계획 생성
{
const M=window.MKR;
M.WORLD_SIZE=2600;
M.GOODS=['grain','fish','timber','ore','tools','cloth','churu'];
M.GOOD_NAMES={grain:'곡물',fish:'생선',timber:'목재',ore:'광석',tools:'도구',cloth:'천',churu:'츄르'};
M.SPEEDS=[0,.1,1,5,30,120];
M.SEASONS=['봄','여름','가을','겨울'];
M.SEASON_ICONS=['🌸','☀','🍁','❄'];

// 문명 발전: 시대·기술 트리
M.ERAS=['털가죽 시대','방울 시대','비단 시대','황금 시대'];
M.ERA_STEP=3; // 시대마다 필요한 기술 수
// 기술 하나를 해금하면 mult 값이 왕국 전체 보너스에 곱해짐
M.TECHS=[
  {id:'net',   era:0,name:'그물 코 개량', cost:90, mult:{fish:1.28},            desc:'포구의 생선 어획이 크게 늘어남'},
  {id:'plow',  era:0,name:'나무 쟁기',   cost:90, mult:{grain:1.22},           desc:'밭갈이가 쉬워져 곡물 수확이 늘어남'},
  {id:'store', era:0,name:'마른 곳간',   cost:100,mult:{food:1.25},            desc:'식량 보존이 좋아져 굶주림이 줄어듦'},
  {id:'road',  era:1,name:'다진 흙길',   cost:200,mult:{trade:1.3},            desc:'수레가 빨라져 교역량이 늘어남'},
  {id:'herb',  era:1,name:'들풀 약방',   cost:210,mult:{med:1.4},             desc:'고양이 감기의 전파와 치명률이 낮아짐'},
  {id:'coin',  era:1,name:'조개 화폐',   cost:220,mult:{tax:1.3,research:1.12},desc:'세금이 잘 걷히고 배움이 빨라짐'},
  {id:'stone', era:2,name:'돌쌓기 기술', cost:400,mult:{ward:1.5},            desc:'재난 피해가 줄고 성벽이 튼튼해짐'},
  {id:'loom',  era:2,name:'비단 물레',   cost:420,mult:{culture:1.2,tax:1.1}, desc:'비단 교역으로 번영과 재정이 함께 오름'},
  {id:'lib',   era:2,name:'필사 서고',   cost:450,mult:{research:1.4},        desc:'서고에서 배움이 크게 빨라짐'},
  {id:'sail',  era:3,name:'먼바다 돛',   cost:750,mult:{trade:1.35,fish:1.2}, desc:'먼 포구까지 교역과 어획이 뻗어감'},
  {id:'med',   era:3,name:'고양이 의학', cost:800,mult:{med:1.8},             desc:'역병이 왕국을 거의 넘보지 못함'},
  {id:'edict', era:3,name:'황금 율령',   cost:900,mult:{tax:1.35,culture:1.25},desc:'율령으로 나라가 부강하고 번영함'}
];
M.techBonusDefault=function(){return{fish:1,grain:1,food:1,trade:1,med:1,ward:1,tax:1,research:1,culture:1};};
M.DEV_TIERS=[[1050,'전설의 왕국'],[850,'황금 왕국'],[620,'융성한 왕국'],[420,'번성하는 왕국'],[250,'자리잡은 왕국'],[120,'싹트는 왕국'],[0,'갓 세운 왕국']];
M.DEV_WIN=1050;
M.devTier=function(dev){
  for(let i=0;i<M.DEV_TIERS.length;i++)if(dev>=M.DEV_TIERS[i][0])return M.DEV_TIERS[i][1];
  return'갓 세운 왕국';
};

const PLACE_A=['보드라','나비','구름','달빛','참치','연어','보리','별빛','단풍','하늘','호박','복숭아','은방울','새벽','산들','초롱'];
const PLACE_B=['성','골','마루','포구','뜰','고개','내','들','숲','울','터','평야','나루','샘','고을','항'];
const HOUSE_A=['턱시도','치즈','고등어','삼색','검은발','흰수염','노랑눈','긴꼬리','점박이','은갈기'];
const HOUSE_B=['가문','묘가','문중','왕가','일족'];
const CAT_NAMES=['모구','모모','구름','나비','호두','보리','망고','치즈','탄이','콩이','루루','라떼','단추','초코','별이','설이','봄이','마루','쿠키','소금','두부','참치','연어','후추','감자','복숭아','하양','까망'];
const TRAITS=['용맹함','신중함','공정함','냉정함','영리함','느긋함','다정함','완고함','야심참','절제함','호기심','사교적임','검소함','화려함','병약함','건강함'];
const COLORS=['#85443f','#3d6088','#47734c','#795d91','#9a6c2d','#3d7274','#8a4e72','#6b6b35'];
const SIGILS=['🐟','🐾','🌙','🌾','🧶','👑','🐚','⭐'];

function namePlace(r,used){
  let n='',guard=0;
  do{n=r.pick(PLACE_A)+r.pick(PLACE_B);}while(used.has(n)&&guard++<30);
  used.add(n);return n;
}
function terrainHeight(seed,x,z){
  const s=Number(seed)||1;
  const a=Math.sin((x+s%137)/205)*44;
  const b=Math.cos((z-s%173)/260)*35;
  const c=Math.sin((x+z+s%97)/112)*15;
  const rim=Math.pow(Math.hypot(x,z)/(M.WORLD_SIZE*.75),2)*58;
  return a+b+c+rim-35;
}
M.heightAt=function(x,z){
  const W=M.state;
  if(!W)return 0;
  return terrainHeight(W.seed,x,z);
};
M.riverX=function(z,seed){
  return Math.sin((z+(Number(seed)||0)%311)/300)*190+Math.sin(z/91)*35;
};

function settlementPosition(r,i,count,seed){
  if(i===0)return{x:-230,z:-40};
  const ring=i<=3?610:1000;
  const a=(i-1)/(count-1)*Math.PI*2+r.range(-.24,.24);
  let x=Math.cos(a)*ring+r.range(-120,120);
  let z=Math.sin(a)*ring+r.range(-120,120);
  const rx=M.riverX(z,seed);
  if(Math.abs(x-rx)>440)x=M.lerp(x,rx+r.pick([-1,1])*r.range(120,330),.55);
  return{x:M.clamp(x,-1120,1120),z:M.clamp(z,-1120,1120)};
}

function planBuildings(s,r){
  const count=s.kind==='capital'?82:s.kind==='town'?r.int(32,42):r.int(11,17);
  const out=[];
  for(let i=0;i<count;i++){
    const a=r.range(0,Math.PI*2);
    const rad=Math.sqrt(r.next())*s.radius;
    const x=s.x+Math.cos(a)*rad;
    const z=s.z+Math.sin(a)*rad;
    const large=s.kind==='capital'&&i<7||s.kind==='town'&&i<2;
    out.push({
      x:x,z:z,w:large?r.range(18,28):r.range(8,16),d:large?r.range(16,27):r.range(8,15),
      h:large?r.range(16,31):r.range(7,15),rot:r.range(-.3,.3),
      roof:r.int(0,3),color:r.int(0,5),alive:true
    });
  }
  return out;
}

function makeNotable(r,house,role,age){
  const first=r.pick(CAT_NAMES);
  return{
    id:0,given:first,name:first+(house>=0?' '+HOUSE_A[house%HOUSE_A.length]:' 모구'),
    house:house,role:role||'귀족',age:age==null?r.range(18,62):age,alive:true,
    traits:[r.pick(TRAITS),r.pick(TRAITS)],spouse:null,children:[],born:0
  };
}

M.generateWorld=function(seed){
  seed=String(seed||Math.floor(Math.random()*9000000+1000000));
  const r=M.rng(seed+':world');
  const used=new Set();
  const nTown=r.int(2,3),nVillage=r.int(3,5),total=1+nTown+nVillage;
  const settlements=[];
  for(let i=0;i<total;i++){
    const kind=i===0?'capital':i<=nTown?'town':'village';
    const p=settlementPosition(r,i,total,seed);
    const pop=kind==='capital'?r.int(2150,2900):kind==='town'?r.int(430,1150):r.int(70,290);
    const radius=kind==='capital'?250:kind==='town'?125:62;
    const s={
      id:i,name:namePlace(r,used),kind:kind,x:p.x,z:p.z,y:terrainHeight(seed,p.x,p.z),
      pop:pop,radius:radius,harbor:Math.abs(p.x-M.riverX(p.z,seed))<230,
      buildings:[],owner:i===0?-1:0,prosperity:.5,hunger:0,unrest:r.range(5,13),inf:0,sus:1,
      fire:0,flood:0,ruins:0,civic:{granary:0,market:0,harbor:0,wall:0,temple:0},
      stores:{grain:pop*72,fish:pop*7,timber:pop*2,ore:pop*.3,tools:pop*.5,cloth:pop*.35,churu:pop*.15},
      production:{},trade:0,lastEvent:0
    };
    s.buildings=planBuildings(s,M.rng(seed+':build:'+i));
    settlements.push(s);
  }
  const houses=[];
  for(let i=0;i<5;i++){
    houses.push({
      id:i,name:HOUSE_A[i]+' '+HOUSE_B[i%HOUSE_B.length],color:COLORS[i],sigil:SIGILS[i],
      seat:settlements[1+i%(settlements.length-1)].id,loyalty:r.range(52,76),exiled:false,head:null,grudge:0
    });
  }
  settlements.slice(1).forEach(function(s,i){s.owner=i%houses.length;});

  const notables=[];
  function add(n){n.id=notables.length+1;notables.push(n);return n;}
  const monarch=add(makeNotable(r,-1,'국왕',r.range(27,54)));
  const spouse=add(makeNotable(r,-1,'왕비',r.range(23,49)));
  monarch.spouse=spouse.id;spouse.spouse=monarch.id;
  for(let i=0;i<r.int(2,4);i++){
    const child=add(makeNotable(r,-1,'왕자녀',r.range(2,22)));
    monarch.children.push(child.id);spouse.children.push(child.id);
  }
  houses.forEach(function(h){
    const head=add(makeNotable(r,h.id,'가주',r.range(31,62)));h.head=head.id;
    const partner=add(makeNotable(r,h.id,'배우자',r.range(27,58)));
    head.spouse=partner.id;partner.spouse=head.id;
    for(let i=0;i<r.int(1,3);i++){
      const c=add(makeNotable(r,h.id,'후계자',r.range(3,24)));head.children.push(c.id);partner.children.push(c.id);
    }
  });

  const roads=[];
  for(let i=1;i<settlements.length;i++){
    let to=0,best=Infinity;
    for(let j=0;j<i;j++){const d=M.dist(settlements[i],settlements[j]);if(d<best){best=d;to=j;}}
    roads.push({id:roads.length,from:i,to:to,volume:0});
  }
  if(nTown>1)roads.push({id:roads.length,from:1,to:2,volume:0});

  return{
    seed:seed,rng:M.rng(seed+':history'),realmName:settlements[0].name+' 고양이 왕국',
    settlements:settlements,houses:houses,notables:notables,roads:roads,
    clock:{day:0,speed:2,last:performance.now()},treasury:800,realmPop:0,
    monarch:monarch.id,legitimacy:62,regency:false,war:null,peaceUntil:0,
    tech:{points:0,era:0,unlocked:[],bonus:M.techBonusDefault()},dev:0,devTier:'갓 세운 왕국',devMark:0,victory:false,
    rates:{harvest:1,birth:1,mortality:1,trade:1,tax:.12,plagueV:1,plagueL:1,disaster:1,bandit:1,aggression:1,fertility:1,myth:1},
    weather:{state:'맑음',until:0},drought:0,bandits:[],dragon:{name:'솜구름용 냥그라',state:'sleeping',until:720,dead:false,target:null},
    caravans:[],armies:[],events:[],history:[],selected:null,overlay:'',watch:false,director:true,labels:true,
    nextIds:{settlement:settlements.length,notable:notables.length+1}
  };
};

M.worldMetrics=function(W){
  W.realmPop=W.settlements.reduce(function(a,s){return a+s.pop;},0);
  let pros=0,unrest=0,civic=0;
  W.settlements.forEach(function(s){
    pros+=s.prosperity;unrest+=s.unrest;
    const c=s.civic;if(c)civic+=c.granary+c.market+c.harbor+c.wall+c.temple;
  });
  const n=Math.max(1,W.settlements.length);
  pros/=n;unrest/=n;
  const tech=W.tech?W.tech.unlocked.length:0,era=W.tech?W.tech.era:0;
  W.dev=Math.max(0,Math.round(
    W.realmPop/45 + pros*240 + tech*30 + era*15 + civic*14 +
    Math.min(180,W.treasury/70) + W.legitimacy*.6 - unrest*1.4
  ));
  W.devTier=M.devTier(W.dev);
  return W;
};
}
