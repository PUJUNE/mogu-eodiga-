// ride.mjs — 봇이 코스를 끝까지 타고 결과를 돌려준다 (sim-test · 밸런스 조정 공용)
import './shim.mjs';
const M = window.MSL;
export function ride(diff, course, skill = 1, seed, maxT = 400) {
  const run = M.Run.create(diff, course, seed);
  const bot = M.makeBot(run, skill);
  const DT = 1 / 60, log = { crash: {}, tricks: 0, wipeout: 0, jumps: 0, boost: 0 };
  while (run.phase !== 'done' && run.t < maxT) {
    for (const e of M.Run.step(run, DT, bot(DT))) {
      if (e.type === 'crash') log.crash[e.kind] = (log.crash[e.kind] || 0) + 1;
      if (e.type === 'trick') log.tricks++;
      if (e.type === 'wipeout') log.wipeout++;
      if (e.type === 'jump') log.jumps++;
      if (e.type === 'boost') log.boost++;
    }
  }
  return { run, log };
}
