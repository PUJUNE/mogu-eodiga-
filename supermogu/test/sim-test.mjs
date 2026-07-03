// sim-test.mjs — 헤드리스 시뮬레이션: 플랫포머 규칙 검증 (node 단독)
import './shim.mjs';

const M = globalThis.window.SMG;
const L = M.Logic;
const T = M.T;
const TL = M.TILE;
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name); if (!ok) fail++; };
const DT = 1 / 120;
const IDLE = {};
const run = (st, sec, input) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) evs.push(...L.step(st, DT, input || IDLE));
  return evs;
};
// 평탄한 테스트장: 적·블록 없는 긴 평지
const arena = () => {
  const st = L.create(1);
  st.enemies = [];
  const g = st.stage.g;
  for (let x = 0; x < st.stage.len; x++) {
    for (let y = 0; y < M.ROWS; y++) g[x][y] = y >= st.stage.gndY ? T.GND : T.AIR;
  }
  st.stage.flagX = 1e9;
  st.stage.qContents = {};
  return st;
};
const spawnEnemy = (st, tx, type = 'rat') => {
  const e = {
    id: 99, type, x: tx * TL, y: (st.stage.gndY - 1) * TL + 2,
    vx: type === 'bird' ? -34 : -26, vy: 0, w: 12, h: 13,
    alive: true, squashT: 0, shell: false, sliding: false,
    baseY: (st.stage.gndY - 3) * TL, phase: 0, active: true,
  };
  st.enemies.push(e);
  return e;
};

// 1) 달리기 가속·마찰·대시
{
  const st = arena();
  run(st, 1.2, { right: true });
  const v1 = st.p.vx;
  check(`달리기 (vx ${v1.toFixed(0)} = 96)`, Math.abs(v1 - 96) < 2);
  run(st, 1.2, { right: true, dash: true });
  check(`대시 (vx ${st.p.vx.toFixed(0)} = 150)`, Math.abs(st.p.vx - 150) < 2);
  run(st, 1.5, {});
  check('마찰 정지', st.p.vx === 0);
}

// 2) 가변 점프: 길게 누르면 더 높음
{
  const peak = (holdSec) => {
    const st = arena();
    run(st, 0.3);                                    // 착지 정착 (onG 확보)
    const y0 = st.p.y;
    let minY = 1e9;
    L.step(st, DT, { jump: true, jumpHold: true });
    for (let i = 0; i < 300; i++) {
      L.step(st, DT, { jumpHold: i * DT < holdSec });
      minY = Math.min(minY, st.p.y);
      if (st.p.onG && i > 10) break;
    }
    return y0 - minY;
  };
  const short = peak(0.06), long = peak(0.5);
  check(`가변 점프 (짧게 ${short.toFixed(0)}px < 길게 ${long.toFixed(0)}px)`, long > short + 12);
}

// 3) 벽·천장 충돌
{
  const st = arena();
  const wx = Math.floor((st.p.x + 60) / TL);
  for (let y = st.stage.gndY - 4; y < st.stage.gndY; y++) st.stage.g[wx][y] = T.BLOCK;
  run(st, 2, { right: true });
  check(`벽 정지 (x ${st.p.x.toFixed(0)} < ${wx * TL})`, st.p.x + st.p.w <= wx * TL + 0.5);
}

// 4) 밟기 처치 + 튕김
{
  const st = arena();
  const e = spawnEnemy(st, Math.floor(st.p.x / TL) + 2);
  st.p.x = e.x - 2; st.p.y = e.y - 60; st.p.vy = 120;   // 낙하 중
  const evs = run(st, 0.4);
  check('밟기 → 납작 + 튕김', evs.some((v) => v.type === 'stomp') && e.squashT > 0 || !e.alive);
  check('점수 +100', st.score >= 100);
}

// 5) 접촉 피해: 단계 하락 → 사망
{
  const st = arena();
  L._setSize(st, 2);
  const e = spawnEnemy(st, Math.floor(st.p.x / TL) + 1);
  e.vx = 0;
  st.p.x = e.x - 6; st.p.y = e.y - 4;                  // 옆에서 접촉
  const evs = run(st, 0.3);
  check('접촉 → 단계 하락 (2→1) + 무적', evs.some((v) => v.type === 'shrink') && st.p.size === 1 && st.p.inv > 0);
  st.p.inv = 0;
  const evs2 = run(st, 0.5);
  check('무적 해제 후 재접촉 → 1→0', st.p.size === 0 || evs2.some((v) => v.type === 'shrink'));
  st.p.inv = 0;
  run(st, 0.5);
  check('꼬마 피격 → 사망', st.phase === 'over');
}

// 6) ?블록: 코인·파워업 (츄르 → 성장, 캣닢 → 발사)
{
  const st = arena();
  const tx = Math.floor((st.p.x + 8) / TL);
  const ty = st.stage.gndY - 4;
  st.stage.g[tx][ty] = T.Q;
  st.stage.qContents[tx + ',' + ty] = 'power';
  run(st, 0.2); st.p.vy = -330; st.p.jumpHeld = false; // 아래서 침
  const evs = run(st, 0.4);
  check('?블록 → 파워업 등장', evs.some((v) => v.type === 'sprout' && v.kind === 'chur') && st.items.length === 1);
  run(st, 1.2);                                        // 아이템 착지 대기
  const evs2 = run(st, 3, { right: true });            // 걸어가서 획득
  check('츄르 획득 → 슈퍼 모구 (h 24)', evs2.some((v) => v.type === 'grow') && st.p.size === 1 && st.p.h === 24);
}
{
  const st = arena();
  L._setSize(st, 2);
  const e = spawnEnemy(st, Math.floor(st.p.x / TL) + 6);
  e.vx = 0;
  const evs = run(st, 1.2, { fire: true });
  check('캣닢 털뭉치 발사 → 원거리 처치', evs.some((v) => v.type === 'shoot') && evs.some((v) => v.type === 'kill' && v.how === 'shot') && !e.alive);
}

// 7) 벽돌: 슈퍼만 파괴
{
  const brick = (size) => {
    const st = arena();
    L._setSize(st, size);
    const tx = Math.floor((st.p.x + 8) / TL);
    const ty = st.stage.gndY - (size > 0 ? 5 : 4);
    st.stage.g[tx][ty] = T.BRICK;
    run(st, 0.2);
    st.p.vy = -330;
    const evs = run(st, 0.4);
    return { broke: evs.some((v) => v.type === 'break'), tile: st.stage.g[tx][ty] };
  };
  const a = brick(1), b = brick(0);
  check('벽돌: 슈퍼 → 파괴', a.broke && a.tile === T.AIR);
  check('벽돌: 꼬마 → 유지', !b.broke && b.tile === T.BRICK);
}

// 8) 고슴도치: 밟으면 웅크림 → 차면 슬라이드 → 다른 적 처치
{
  const st = arena();
  const h = spawnEnemy(st, Math.floor(st.p.x / TL) + 2, 'hedge');
  const victim = spawnEnemy(st, Math.floor(st.p.x / TL) + 9, 'rat');
  victim.vx = 0;
  st.p.x = h.x - 2; st.p.y = h.y - 60; st.p.vy = 120;
  run(st, 0.4);
  check('밟기 → 웅크림 (셸)', h.shell && !h.sliding && h.alive);
  st.p.x = h.x - st.p.w - 6; st.p.y = h.y - 2;         // 옆에서 걸어가 차기
  st.p.inv = 0;
  const evs = run(st, 1.6, { right: true });
  check('차기 → 슬라이드 → 다른 적 처치', evs.some((v) => v.type === 'kick') && h.sliding && !victim.alive);
}

// 9) 무적별: 접촉 즉시 처치
{
  const st = arena();
  st.p.star = 8;
  const e = spawnEnemy(st, Math.floor(st.p.x / TL) + 1);
  e.vx = 0;
  st.p.x = e.x - 6;
  const evs = run(st, 0.3);
  check('무적별 접촉 → 처치', evs.some((v) => v.type === 'kill' && v.how === 'star') && !e.alive && st.phase === 'play');
}

// 10) 낙사·시간 초과
{
  const st = arena();
  st.p.y = M.ROWS * TL + 30;
  run(st, 0.1);
  check('낙사 → 사망', st.phase === 'over');
  const st2 = arena();
  st2.time = 0.3;
  const evs = run(st2, 0.5);
  check('시간 초과 → 사망', st2.phase === 'over' && evs.some((v) => v.type === 'die'));
}

// 11) 깃발 클리어 + 보너스
{
  const st = arena();
  st.stage.flagX = st.p.x + 40;
  st.time = 100;
  const evs = run(st, 2, { right: true });
  const cl = evs.find((v) => v.type === 'clear');
  check(`깃발 클리어 (보너스 ${cl ? cl.bonus : -1})`, st.phase === 'clear' && cl && st.score >= 990);
}

// 12) 보스: 3밟기 → 클리어
{
  const st = L.create(4);                              // W1-4 성
  st.enemies = [];
  const bo = st.boss;
  bo.active = true;
  let hits = 0;
  const evs = [];
  for (let i = 0; i < 3; i++) {
    st.p.x = bo.x + 4; st.p.y = bo.y - st.p.h - 4; st.p.vy = 150;
    bo.iv = 0; st.p.inv = 1;
    evs.push(...run(st, 0.35));
    hits++;
  }
  check(`보스 3밟기 → 격파·클리어 (${hits}회)`, evs.filter((v) => v.type === 'bosshit').length >= 2 && st.phase === 'clear');
}

// 13) 결정성
{
  const a = L.create(9), b = L.create(9);
  run(a, 6, { right: true }); run(b, 6, { right: true });
  check('시뮬 결정성', a.p.x === b.p.x && a.score === b.score && a.enemies.filter((e) => e.alive).length === b.enemies.filter((e) => e.alive).length);
}

console.log(fail === 0 ? '\n✅ 시뮬레이션 전체 통과' : `\n❌ 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
