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

// ── 봇 3종 (sim-test·튜닝 공용) ──
const M = globalThis.window.MSJ;
const DT = 1 / 120;

// 퍼펙트 봇: 립 정확 탭 + 존 중앙 유지 + 텔레마크
export function runPerfect(no) {
  const st = M.Logic.create(no);
  M.Logic.step(st, DT, { btn: false, tap: true });          // 출발
  let guard = 0;
  while (st.phase !== 'landed' && guard++ < 12000) {
    let tap = false, btn = false;
    if (st.phase === 'slide') tap = st.untilLip <= DT * st.v / Math.max(st.v, 0.1) + DT;  // 립 직전 프레임
    if (st.phase === 'flight') {
      btn = st.P < 0.62;                                    // 존 중앙 유지
      if (st.teleOpen && !st.teleTapped && (st.y - st.stage.hillY(st.x)) < 1.6) tap = true;
    }
    M.Logic.step(st, DT, { btn, tap });
  }
  return st;
}

// 무입력 봇: 출발만 하고 방치
export function runNone(no) {
  const st = M.Logic.create(no);
  M.Logic.step(st, DT, { btn: false, tap: true });
  let guard = 0;
  while (st.phase !== 'landed' && guard++ < 12000) M.Logic.step(st, DT, { btn: false, tap: false });
  return st;
}

// 어중간 봇: 타이밍 0.15초 빗나감 + 자세 대충 (절반 확률 홀드)
export function runSloppy(no) {
  const st = M.Logic.create(no);
  const rng = M.makeRng(no * 31 + 5);
  M.Logic.step(st, DT, { btn: false, tap: true });
  let tapped = false, guard = 0;
  while (st.phase !== 'landed' && guard++ < 12000) {
    let tap = false, btn = false;
    if (st.phase === 'slide' && !tapped && st.untilLip <= 0.15) { tap = true; tapped = true; }
    if (st.phase === 'flight') btn = rng.chance(0.5);
    M.Logic.step(st, DT, { btn, tap });
  }
  return st;
}
