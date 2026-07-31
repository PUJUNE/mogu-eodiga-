// shim.mjs — node 단독 실행용 window 스텁 + 로직 모듈 로드 + 가상 마우스
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.window = { MPK: {} };

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const name of ['rng.js', 'levels.js', 'logic.js']) {
  const code = readFileSync(join(src, name), 'utf-8');
  new Function('window', code)(globalThis.window);
}

const M = globalThis.window.MPK;
export { M };

// ── 가상 마우스: 테스트도 실제와 같은 화면 좌표 경로로 조작한다 ──
export const SCREEN = { w: 1600, h: 900, refX: 800, refY: 450 };
export function mouse(throttle, steer, brake = 0, extra = {}) {
  const { DEAD_Y, RANGE_Y, BRAKE_Y, RANGE_X } = M.Logic;
  const b = brake === true ? 1 : +brake || 0;
  let dy = 0;                                        // 기준점 위(+) — 화면 높이 비율
  if (b > 0) dy = -(DEAD_Y + b * (BRAKE_Y - DEAD_Y));
  else if (throttle > 0) dy = DEAD_Y + throttle * (RANGE_Y - DEAD_Y);
  return Object.assign({
    active: true, shift: 0, gearTo: 0, look: 0,
    w: SCREEN.w, h: SCREEN.h, refX: SCREEN.refX, refY: SCREEN.refY,
    x: SCREEN.refX + steer * RANGE_X * SCREEN.w,
    y: SCREEN.refY - dy * SCREEN.h,
  }, extra);
}

export const DT = 1 / 60;

// 차를 원하는 포즈로 옮겨 놓는다 (판정 단위 테스트용)
export function place(st, x, z, h, v = 0, gear = 'N') {
  st.car.x = x; st.car.z = z; st.car.h = h; st.car.v = v; st.car.gear = gear;
}
