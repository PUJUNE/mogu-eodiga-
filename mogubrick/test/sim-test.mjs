// sim-test.mjs — 헤드리스 시뮬레이션: 발사·반사·벽돌·모구 구출·바 확장 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.MBK;
const L = M.Logic;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};
// 벽돌 전부 비운 빈 무대 (keeper: 즉시 클리어 방지용 구석 벽돌)
const putBrick = (st, x, y, kind = 'n', hp = 1) => {
  const b = { c: 0, r: 0, kind, hp: kind === 'steel' ? Infinity : hp, x, y, w: M.BW, h: M.BH, alive: true };
  st.bricks.push(b);
  return b;
};
const arena = (no = 1, keeper = true) => {
  const st = L.create(no);
  st.bricks = [];
  if (keeper) putBrick(st, 442, M.TOP + 2, 'n');     // 우상단 구석 — 시험 경로 밖
  return st;
};

// 1) 바 이동: 키보드·직접 좌표·경계
{
  const st = arena();
  const x0 = st.paddle.x;
  run(st, 0.5, { right: true });
  check(`바 우측 이동 (${x0} → ${st.paddle.x.toFixed(0)})`, st.paddle.x > x0 + 80);
  run(st, 5, { right: true });
  check('바 우측 경계', st.paddle.x <= M.W - st.paddle.w / 2 - 2 + 0.01);
  run(st, 0.05, { px: 100 });
  check('직접 좌표 이동 (드래그)', Math.abs(st.paddle.x - 100) < 1);
  run(st, 0.05, { px: -50 });
  check('드래그 좌측 경계', st.paddle.x >= st.paddle.w / 2 + 2 - 0.01);
}

// 1b) 조종간 아날로그: 기울인 만큼 비례 이동
{
  const st = arena();
  const x0 = st.paddle.x;
  run(st, 0.5, { ax: 1 });
  const full = st.paddle.x - x0;
  const st2 = arena();
  run(st2, 0.5, { ax: 0.4 });
  const part = st2.paddle.x - x0;
  check(`조종간 풀 기울임 (${full.toFixed(0)}px)`, full > 120);
  check(`조종간 40% 기울임 → 비례 (${part.toFixed(0)} ≈ ${(full * 0.4).toFixed(0)})`, Math.abs(part - full * 0.4) < 3);
  const st3 = arena();
  run(st3, 0.3, { ax: -1 });
  check('조종간 좌측 이동', st3.paddle.x < x0 - 60);
  run(st3, 3, { ax: -1 });
  check('조종간 좌측 경계', st3.paddle.x >= st3.paddle.w / 2 + 2 - 0.01);
  const st4 = arena();
  run(st4, 0.3, { ax: 5 });                          // 범위 밖 값 클램프
  const over = st4.paddle.x - x0;
  check(`ax 클램프 (${over.toFixed(0)} ≤ ${(full * 0.62).toFixed(0)})`, over <= full * 0.62);
}

// 2) 발사: 스턱 → 발사 → 상승
{
  const st = arena();
  check('시작 시 공이 바 위에', st.ball.stuck && Math.abs(st.ball.x - st.paddle.x) < 1);
  const evs = run(st, 0.05, { launch: true });
  check('발사 이벤트 + 상승', evs.some((e) => e.type === 'launch') && !st.ball.stuck && st.ball.vy < 0);
  const spd = Math.hypot(st.ball.vx, st.ball.vy);
  check(`발사 속도 = 스테이지 속도 (${spd.toFixed(0)})`, Math.abs(spd - st.spd) < 1);
}

// 3) 벽·천장 반사
{
  const st = arena();
  st.ball.stuck = false;
  st.ball.x = 10; st.ball.y = 150; st.ball.vx = -120; st.ball.vy = -60;
  const evs = run(st, 0.2);
  check('좌벽 반사', evs.some((e) => e.type === 'wall') && st.ball.vx > 0);
  st.ball.x = 240; st.ball.y = M.TOP + 8; st.ball.vx = 0; st.ball.vy = -150;
  const evs2 = run(st, 0.2);
  check('천장 반사', evs2.some((e) => e.type === 'wall') && st.ball.vy > 0);
}

// 4) 바 반사: 중앙=수직, 끝=경사
{
  const st = arena();
  st.paddle.x = 240;
  st.ball.stuck = false;
  st.ball.x = 240; st.ball.y = L.PY - 30; st.ball.vx = 0; st.ball.vy = 160;
  const evs = run(st, 0.5);
  check('바 중앙 반사 → 수직 상승', evs.some((e) => e.type === 'paddle') && st.ball.vy < 0 && Math.abs(st.ball.vx) < 30);
  // 오른쪽 끝
  st.ball.x = 240 + st.paddle.w / 2 - 2; st.ball.y = L.PY - 30; st.ball.vx = 0; st.ball.vy = 160;
  run(st, 0.3);
  check(`바 끝 반사 → 경사 (vx ${st.ball.vx.toFixed(0)})`, st.ball.vy < 0 && st.ball.vx > 60);
}

// 5) 벽돌 파괴: 일반 1타 / 강화 2타 / 강철 불괴
{
  const st = arena();
  st.ball.stuck = false;
  const bn = putBrick(st, 222, 100, 'n', 1);
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs = run(st, 0.3);
  check('일반 벽돌 1타 파괴', evs.some((e) => e.type === 'brick') && !bn.alive && st.score >= 50);
  const bh = putBrick(st, 222, 100, 'hard', 2);
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs2 = run(st, 0.3);
  check('강화 벽돌 1타 → 금 감', evs2.some((e) => e.type === 'crack') && bh.alive && bh.hp === 1);
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  run(st, 0.3);
  check('강화 벽돌 2타 파괴', !bh.alive);
  const bs = putBrick(st, 222, 100, 'steel');
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs3 = run(st, 0.3);
  check('강철 벽돌 불괴 + 반사', evs3.some((e) => e.type === 'clank') && bs.alive && st.ball.vy > 0);
}

// 6) 모구 벽돌 → 낙하 → 받아서 구출 → 바 확장
{
  const st = arena(1, false);
  st.ball.stuck = false;
  putBrick(st, 222, 100, 'mogu', 1);
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs = run(st, 0.3);
  check('모구 벽돌 파괴 → 낙하 시작', evs.some((e) => e.type === 'mogudrop') && st.drops.length === 1);
  const w0 = st.paddle.w;
  st.paddle.x = st.drops[0].x;                       // 바를 밑에 대기
  st.ball.vy = -100; st.ball.y = 100;                // 공은 위로 치움
  const evs2 = run(st, 6, { px: st.drops[0].x });
  check('낙하 모구 받기 → 구출', evs2.some((e) => e.type === 'rescue') && st.rescued === 1);
  check(`바 확장 (${w0} → ${st.paddle.w})`, st.paddle.w === w0 + L.WIDEN);
  check('구출 점수 +300', st.score >= 100 + 300);
}

// 7) 모구 놓침
{
  const st = arena();
  st.drops.push({ x: 60, y: 200, wob: 0 });
  st.paddle.x = 400;                                 // 멀리 치움
  st.ball.stuck = true;
  const evs = run(st, 4, { px: 400 });
  check('모구 놓침 이벤트', evs.some((e) => e.type === 'mogulost') && st.moguLost === 1 && st.rescued === 0);
  check('바 폭 그대로', st.paddle.w === L.PW0);
}

// 8) 바 확장 상한 (4마리)
{
  const st = arena();
  st.ball.stuck = true;
  for (let i = 0; i < 6; i++) {
    st.drops.push({ x: st.paddle.x, y: L.PY - 10, wob: 0 });
    run(st, 0.1);
  }
  check(`구출 6 → 폭 상한 (${st.paddle.w} = ${L.PW0 + L.WIDEN * L.WIDEN_MAX})`,
    st.rescued === 6 && st.paddle.w === L.PW0 + L.WIDEN * L.WIDEN_MAX);
}

// 9) 공 낙하 → 목숨 감소 → 리스폰 / 소진 → 게임 오버
{
  const st = arena();
  putBrick(st, 222, 100, 'n');                       // 클리어 방지용
  st.ball.stuck = false;
  st.ball.x = 240; st.ball.y = M.H + 10; st.ball.vx = 0; st.ball.vy = 200;
  const evs = run(st, 0.3);
  check('공 낙하 → 목숨 감소 + 재장전', evs.some((e) => e.type === 'balllost') && st.lives === 2 && st.ball.stuck);
  st.lives = 1;
  st.ball.stuck = false;
  st.ball.x = 240; st.ball.y = M.H + 10; st.ball.vy = 200;
  const evs2 = run(st, 0.3);
  check('마지막 공 → 게임 오버', evs2.some((e) => e.type === 'over') && st.phase === 'over');
}

// 10) 클리어 + 별점: 노미스·전원 구출 = ★3
{
  const st = arena(1, false);
  st.ball.stuck = false;
  const b = putBrick(st, 222, 100, 'n');
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs = run(st, 0.5);
  const cl = evs.find((e) => e.type === 'clear');
  check(`마지막 벽돌 → 클리어 ★${cl ? cl.stars : 0}`, cl && cl.stars === 3 && st.phase === 'clear');
  check('클리어 보너스', st.score >= 50 + 1000 + st.lives * 300);
}

// 11) 별점 감점: 공 놓침 + 모구 놓침 → ★1
{
  const st = arena(1, false);
  st.livesLost = 1; st.moguLost = 1;
  st.ball.stuck = false;
  putBrick(st, 222, 100, 'n');
  st.ball.x = 240; st.ball.y = 130; st.ball.vx = 0; st.ball.vy = -160;
  const evs = run(st, 0.5);
  const cl = evs.find((e) => e.type === 'clear');
  check(`감점 클리어 ★${cl ? cl.stars : 0}`, cl && cl.stars === 1);
}

// 12) 낙하 모구가 남아 있으면 클리어 대기
{
  const st = arena(1, false);
  st.ball.stuck = true;
  st.drops.push({ x: 240, y: 60, wob: 0 });
  st.paddle.x = 240;
  run(st, 0.1, { px: 240 });
  check('낙하 중 클리어 보류', st.phase === 'play');
  const evs = run(st, 8, { px: 240 });
  check('모구 받은 뒤 클리어', evs.some((e) => e.type === 'rescue') && st.phase === 'clear' && st.stars === 3);
}

// 13) 실스테이지 자동 플레이: 바가 공을 따라다니면 진행 가능
{
  const st = L.create(1);
  let launched = false, bricks0 = st.bricks.length;
  for (let i = 0; i < 120 * 120 && st.phase === 'play'; i++) {
    // 공 밑에서 12px 비껴 받아 반사각을 만들며 진행 (수직 왕복 고착 방지)
    L.step(st, DT, { px: st.drops.length ? st.drops[0].x : st.ball.x - 12, launch: !launched });
    launched = true;
  }
  const destroyed = bricks0 - st.bricks.filter((b) => b.alive).length;
  check(`S1 봇 2분 — 벽돌 ${destroyed}개 파괴 (목숨 ${st.lives})`, destroyed >= 10);
}

// 14) 결정성
{
  const a = L.create(3), b = L.create(3);
  let l1 = false;
  for (let i = 0; i < 600; i++) {
    L.step(a, DT, { px: a.ball.x, launch: !l1 });
    L.step(b, DT, { px: b.ball.x, launch: !l1 });
    l1 = true;
  }
  check('시뮬 결정성', a.ball.x === b.ball.x && a.ball.y === b.ball.y && a.score === b.score);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
