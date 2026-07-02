// tune.mjs — 목표 거리 테이블 재생성 도구 (물리 상수 변경 시 실행)
// 출력된 TARGETS 배열을 levels.js의 M.TARGETS에 붙여넣는다.
import { runPerfect, runNone } from './shim.mjs';

const M = globalThis.window.MSJ;
const targets = [];
for (let no = 1; no <= 50; no++) {
  const p = runPerfect(no), n = runNone(no);
  const t = Math.round(p.dist * 0.84 * 2) / 2;
  targets.push(t);
  if (no % 10 === 0 || no === 1) {
    console.log(`S${String(no).padStart(2)} perfect ${p.dist.toFixed(1)}m none ${n.dist.toFixed(1)}m → target ${t}m (현재 ${M.TARGETS[no - 1]}m)`);
  }
}
console.log('\nM.TARGETS = [' + targets.join(', ') + '];');
const drift = targets.filter((t, i) => Math.abs(t - M.TARGETS[i]) > 0.01).length;
console.log(drift === 0 ? '현재 테이블과 일치 (물리 무변경)' : `⚠ 현재 테이블과 ${drift}개 항목 상이 — levels.js 갱신 필요`);
