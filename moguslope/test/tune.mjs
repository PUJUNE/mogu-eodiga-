// tune.mjs — 난이도 × 코스 봇 주행 표
import { ride } from './ride.mjs';
const M = window.MSL;
for (const d of M.DIFF_ORDER) for (const sk of [1, 0.5]) {
  const row = [];
  for (let c = 0; c < M.COURSES.length; c++) {
    const { run, log } = ride(d, c, sk);
    row.push(`${c + 1}:${run.phase === 'done' && run.s >= run.L ? '완' : '✗'} ${run.t.toFixed(0)}s 충${run.crashes} 생${run.fish}/${run.fishTotal} ★${M.Run.stars(run)} 묘${log.tricks}`
      + (Object.keys(log.crash).length ? ' [' + Object.entries(log.crash).map(([k, v]) => k + v).join(',') + ']' : ''));
  }
  console.log(`${M.DIFFS[d].name} 봇${sk}\n  ` + row.join('\n  '));
}
