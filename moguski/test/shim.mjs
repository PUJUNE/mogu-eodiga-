// shim.mjs — node 단독 실행용 window 스텁 + 로직 모듈 로드
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.window = { MSJ: {} };

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const name of ['rng.js', 'levels.js', 'logic.js']) {
  const code = readFileSync(join(src, name), 'utf-8');
  new Function('window', code)(globalThis.window);
}

// ── 봇 (sim-test·튜닝 공용): 홀드-릴리즈 정책으로 주행 ──
const M = globalThis.window.MSJ;
const DT = 1 / 120;

// releasePolicy(st) → true면 이번 프레임부터 버튼을 뗀 상태
export function runBot(no, releasePolicy) {
  const st = M.Logic.create(no);
  let released = false, guard = 0;
  while (st.phase !== 'landed' && guard++ < 15000) {
    if (!released && releasePolicy(st)) released = true;
    M.Logic.step(st, DT, { btn: !released });
  }
  return st;
}

// 퍼펙트: 립 직전 프레임에 릴리즈
export const runPerfect = (no) => runBot(no, (st) => st.phase === 'slide' && st.untilLip <= DT);
// 무기술: 출발 0.15초 뒤 바로 릴리즈 (타이밍 스킬 없음)
export const runNone = (no) => runBot(no, (st) => st.t > 0.15);
// 어중간: 립 0.15초 전 릴리즈
export const runSloppy = (no) => runBot(no, (st) => st.phase === 'slide' && st.untilLip <= 0.15);
// 계속 홀드: 끝까지 안 뗌
export const runHold = (no) => runBot(no, () => false);
