// shim.mjs — node 단독 실행용 window 스텁 + 로직 모듈 로드 + 주행 봇
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.window = { MRC: {} };

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const name of ['rng.js', 'levels.js', 'logic.js']) {
  const code = readFileSync(join(src, name), 'utf-8');
  new Function('window', code)(globalThis.window);
}

const M = globalThis.window.MRC;
export { M };

// ── 가상 마우스: 봇도 실제와 같은 화면 좌표 경로로 조작한다 ──
// brake는 0..1 깊이 — 기준점 아래로 그만큼 내린 좌표를 만든다 (클릭 아님).
export const SCREEN = { w: 1600, h: 900, refX: 800, refY: 450 };
export function mouse(throttle, steer, brake = 0) {
  const { DEAD_Y, RANGE_Y, BRAKE_Y } = M.Logic;
  const b = brake === true ? 1 : +brake || 0;
  let dy = 0;                                        // 기준점 위(+) — 화면 높이 비율
  if (b > 0) dy = -(DEAD_Y + b * (BRAKE_Y - DEAD_Y));
  else if (throttle > 0) dy = DEAD_Y + throttle * (RANGE_Y - DEAD_Y);
  return {
    active: true,
    w: SCREEN.w, h: SCREEN.h, refX: SCREEN.refX, refY: SCREEN.refY,
    x: SCREEN.refX + steer * M.Logic.RANGE_X * SCREEN.w,
    y: SCREEN.refY - dy * SCREEN.h,
  };
}

export const DT = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 주행 정책 — 앞을 내다보고 커브에 맞춰 감속하며, 전방 차량을 피해 슬롯을 고른다.
// sim-test·tune 양쪽이 이 함수 하나를 공유한다 (정책이 갈라지면 굽힌 표가 무의미해진다).
// skill 1.0 = 이론 한계 근처, 낮을수록 여유를 두고 느리게 달린다.
export function botControl(st, skill = 1.0) {
  const stg = st.stage;
  const seg = stg.segAt(st.pos);
  const pct = st.speed / M.MAX_SPEED;

  // 전방 주시 거리는 속도에 비례 — 감속에 필요한 시간만큼 미리 본다
  const ahead = Math.max(48, Math.round(pct * 170));
  let worst = Math.abs(seg.curve);
  for (let i = 6; i < ahead; i += 6) worst = Math.max(worst, Math.abs(stg.segAt(st.pos + i * 200).curve));
  // 원심력과 조향이 균형을 이루는 속도 = STEER / (curve × CENT)
  const safePct = clamp(1.25 / (Math.max(0.4, worst) * 0.32), 0.18, 1) * skill;

  // 앞차 회피 — 전방의 차 전체를 놓고 빠져나갈 슬롯을 고른다.
  // (첫 번째 차만 보고 피하면 그 옆 차선에 있는 다른 차로 그대로 들어간다.
  //  상대 속도 조건도 걸지 않는다 — 충돌 직후 느려진 순간 장애물을 놓치기 때문)
  const near = [];
  for (const c of st.cars) {
    const gap = c.z - st.pos;
    if (gap > -200 && gap < 200 * 18) near.push(c);
  }
  let targetX = 0;
  if (near.length) {
    let best = null;
    for (let cand = -0.9; cand <= 0.901; cand += 0.05) {
      let clear = 9;
      for (const c of near) clear = Math.min(clear, Math.abs(cand - c.offset));
      // 통과 여유를 최우선으로, 그 다음 현재 위치·도로 중앙에 가까운 슬롯
      const score = Math.min(clear, 0.72) * 4 - Math.abs(cand - st.playerX) - Math.abs(cand) * 0.3;
      if (!best || score > best.score) best = { cand, score };
    }
    targetX = best.cand;
  }

  const comp = (pct * seg.curve * 0.32) / 1.25;          // 원심력 상쇄분
  return {
    throttle: pct < safePct ? 1 : 0,
    steer: clamp(comp + (targetX - st.playerX) * 2.2, -1, 1),
    brake: pct > safePct * 1.12,
  };
}

export function runBot(no, skill = 1.0, maxSec = 400) {
  const st = M.Logic.create(no);
  let guard = 0;
  const trace = { hits: 0, rails: 0, offroad: 0, cps: 0 };
  while (st.phase !== 'finish' && st.phase !== 'timeout' && guard++ < maxSec * 60) {
    const c = botControl(st, skill);
    for (const e of M.Logic.step(st, DT, mouse(c.throttle, c.steer, c.brake))) {
      if (e.type === 'hit') trace.hits++;
      else if (e.type === 'rail') trace.rails++;
      else if (e.type === 'offroad') trace.offroad++;
      else if (e.type === 'checkpoint') trace.cps++;
    }
  }
  return { st, trace, timedOut: guard >= maxSec * 60 };
}
