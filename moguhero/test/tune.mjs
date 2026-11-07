import { season } from './season.mjs';
const M = window.MHR;
const diff = process.argv[2] || 'normal';
const r = season(diff, +(process.argv[3] || 7), +(process.argv[4] || 1), true);
console.log(r.lines.join('\n'));
const g = r.g;
console.log(`끝: D${g.day} 최종보스 ${g.finalBeaten} Lv${g.lv} 힘${g.atk} 민${g.agi} 냥${g.mag} 무기 ${M.Game.weapon(g).name} 옷 ${M.Game.armor(g).name} 금화 ${g.gold} 되감기 ${g.stats.rollbacks} 승 ${r.wins}/${r.fights}`);
const h = M.Game.hero(g);
console.log('타격', M.Game.hitDmg(h).toFixed(0), '회오리', M.Game.skillDmg(h).toFixed(0), '졸개HP t6', M.mobHp(6), 't5', M.mobHp(5));
