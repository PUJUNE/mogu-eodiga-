// tune.mjs — 봇이 지역·난이도마다 끝까지 지켜 보고 남은 츄르·별을 적는다
// 사용: node moguwatch/test/tune.mjs [diff...]
import { M } from './shim.mjs';
const diffs = process.argv.slice(2).length ? process.argv.slice(2) : M.DIFF_ORDER;
export function play(map, diff, opt = {}) {
  const G = M.Game.create({ map, diff, endless: opt.endless }), bot = M.makeBot();
  const dt = M.STEP; let n = 0;
  while (G.phase === 'play' && n < 60 * 60 * 30) { bot.step(G, dt); M.Game.step(G, dt); G.ev.length = 0; n++; if (opt.endless && G.waveN > opt.endless) break; }
  return G;
}
if ((process.argv[1] || '').endsWith('tune.mjs')) {
  for (const diff of diffs) {
    const row = [];
    for (let i = 0; i < M.MAPS.length; i++) {
      const G = play(i, diff);
      row.push(`${M.MAPS[i].name} ${G.phase === 'win' ? '★' + M.Game.stars(G) : '✗w' + G.waveN} ${G.lives}/${G.maxLives} t${G.towers.length}`);
    }
    console.log(diff.padEnd(7), row.join(' | '));
  }
}
