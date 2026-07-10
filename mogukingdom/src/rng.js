// rng.js — 씨앗 기반 난수와 공통 수학 도구
{
const M = window.MKR;

M.xmur3 = function(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i),3432918353);
    h = h << 13 | h >>> 19;
  }
  return function(){
    h = Math.imul(h ^ h >>> 16,2246822507);
    h = Math.imul(h ^ h >>> 13,3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};

M.sfc32 = function(a,b,c,d){
  return function(){
    a>>>=0;b>>>=0;c>>>=0;d>>>=0;
    let t=(a+b)|0;
    a=b^b>>>9;b=c+(c<<3)|0;c=c<<21|c>>>11;d=d+1|0;
    t=t+d|0;c=c+t|0;
    return (t>>>0)/4294967296;
  };
};

M.rng = function(seed){
  const h=M.xmur3(String(seed));
  const f=M.sfc32(h(),h(),h(),h());
  return {
    next:f,
    range:function(a,b){return a+f()*(b-a);},
    int:function(a,b){return Math.floor(a+f()*(b-a+1));},
    pick:function(a){return a[Math.floor(f()*a.length)];},
    chance:function(p){return f()<p;}
  };
};

M.clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
M.lerp=function(a,b,t){return a+(b-a)*t;};
M.smooth=function(t){t=M.clamp(t,0,1);return t*t*(3-2*t);};
M.dist=function(a,b){return Math.hypot(a.x-b.x,a.z-b.z);};
M.fmt=function(n){return Math.round(n).toLocaleString('ko-KR');};
M.pickWeighted=function(rng,items){
  let sum=0;
  for(let i=0;i<items.length;i++)sum+=items[i][1];
  let q=rng.range(0,sum);
  for(let i=0;i<items.length;i++){q-=items[i][1];if(q<=0)return items[i][0];}
  return items[items.length-1][0];
};
}
