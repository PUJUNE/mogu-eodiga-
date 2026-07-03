// logic.js — 공·바·벽돌 물리 + 모구 구출·바 확장 (DOM 무의존)
const M = window.MBK;

const PW0 = 56, PH = 8, PY = 250;      // 바 기본 폭·두께·상면 y
const PSPD = 300;
const BR = 4;                          // 공 반지름
const WIDEN = 16, WIDEN_MAX = 4;       // 모구 1마리당 확장 폭 / 최대 마리
const DROP_V = 46;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

M.Logic = {
  PW0, PY, BR, WIDEN, WIDEN_MAX,

  create(no) {
    const stage = M.makeStage(no);
    const st = {
      stage, no: stage.no, phase: 'play', t: 0, clearT: 0,
      rng: M.makeRng(stage.no * 911 + 3),
      paddle: { x: M.W / 2, w: PW0 },
      ball: { x: M.W / 2, y: PY - BR - 1, vx: 0, vy: 0, stuck: true },
      bricks: stage.bricks.map((b) => ({
        c: b.c, r: b.r, kind: b.kind, hp: b.hp,
        x: M.X0 + b.c * M.BW, y: M.Y0 + b.r * M.BH, w: M.BW, h: M.BH,
        alive: true,
      })),
      drops: [],
      lives: 3, livesLost: 0, score: 0, rescued: 0, moguLost: 0, stars: 0,
      spd: stage.spd,
    };
    return st;
  },

  breakableLeft(st) {
    return st.bricks.filter((b) => b.alive && b.kind !== 'steel').length;
  },

  _hitBrick(st, b, ev) {
    if (b.kind === 'steel') { ev.push({ type: 'clank', x: b.x + b.w / 2, y: b.y + b.h / 2 }); return; }
    b.hp--;
    if (b.hp <= 0) {
      b.alive = false;
      st.score += b.kind === 'mogu' ? 100 : (b.kind === 'hard' ? 80 : 50);
      ev.push({ type: 'brick', x: b.x + b.w / 2, y: b.y + b.h / 2, kind: b.kind });
      if (b.kind === 'mogu') {
        st.drops.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, wob: st.rng.range(0, 6.28) });
        ev.push({ type: 'mogudrop', x: b.x + b.w / 2, y: b.y + b.h / 2 });
      }
    } else {
      ev.push({ type: 'crack', x: b.x + b.w / 2, y: b.y + b.h / 2 });
    }
  },

  step(st, dt, input) {
    const ev = [];
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;
    const p = st.paddle, ball = st.ball;

    // ── 바 이동 (키보드 or 직접 좌표) ──
    if (typeof input.px === 'number') p.x = input.px;
    else {
      if (input.left) p.x -= PSPD * dt;
      if (input.right) p.x += PSPD * dt;
    }
    p.x = clamp(p.x, p.w / 2 + 2, M.W - p.w / 2 - 2);

    // ── 공 ──
    if (ball.stuck) {
      ball.x = p.x; ball.y = PY - BR - 1;
      if (input.launch) {
        ball.stuck = false;
        const dir = input.left ? -1 : (input.right ? 1 : (st.rng.chance(0.5) ? 1 : -1));
        ball.vx = st.spd * 0.35 * dir;
        ball.vy = -Math.sqrt(st.spd * st.spd - ball.vx * ball.vx);
        ev.push({ type: 'launch' });
      }
    } else {
      // 서브스텝 이동 (터널링 방지)
      const cur = Math.hypot(ball.vx, ball.vy);
      const n = Math.max(1, Math.ceil(cur * dt / 3));
      const sdt = dt / n;
      for (let i = 0; i < n; i++) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;
        // 벽
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); ev.push({ type: 'wall' }); }
        if (ball.x > M.W - BR) { ball.x = M.W - BR; ball.vx = -Math.abs(ball.vx); ev.push({ type: 'wall' }); }
        if (ball.y < M.TOP + BR) { ball.y = M.TOP + BR; ball.vy = Math.abs(ball.vy); ev.push({ type: 'wall' }); }
        // 바 반사 (닿는 위치로 각도 결정)
        if (ball.vy > 0 && ball.y + BR >= PY && ball.y + BR <= PY + PH + 10 &&
            Math.abs(ball.x - p.x) <= p.w / 2 + BR) {
          const off = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
          const spd2 = Math.min(st.spd * 1.5, cur * 1.02);
          const ang = off * 1.05;                       // 최대 약 60°
          ball.vx = Math.sin(ang) * spd2;
          ball.vy = -Math.abs(Math.cos(ang) * spd2);
          ball.y = PY - BR;
          ev.push({ type: 'paddle' });
        }
        // 벽돌
        for (const b of st.bricks) {
          if (!b.alive) continue;
          const nx = clamp(ball.x, b.x, b.x + b.w);
          const ny = clamp(ball.y, b.y, b.y + b.h);
          const dx = ball.x - nx, dy = ball.y - ny;
          if (dx * dx + dy * dy > BR * BR) continue;
          // 반사축: 침투가 얕은 쪽
          const penX = BR - Math.abs(dx), penY = BR - Math.abs(dy);
          if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx = dx >= 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
            ball.x += (dx >= 0 ? penX : -penX);
          } else {
            ball.vy = dy >= 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
            ball.y += (dy >= 0 ? penY : -penY);
          }
          this._hitBrick(st, b, ev);
          break;
        }
      }
      // 낙하 (바닥)
      if (ball.y > M.H + 14) {
        st.lives--; st.livesLost++;
        ev.push({ type: 'balllost', lives: st.lives });
        if (st.lives <= 0) {
          st.phase = 'over'; st.clearT = 0;
          ev.push({ type: 'over' });
          return ev;
        }
        ball.stuck = true; ball.vx = 0; ball.vy = 0;
      }
    }

    // ── 낙하 모구: 받으면 구출 → 바 확장 ──
    for (const d of st.drops) {
      d.y += DROP_V * dt;
      d.x += Math.sin(st.t * 3 + d.wob) * 18 * dt;
      d.x = clamp(d.x, 8, M.W - 8);
      if (d.y + 8 >= PY && d.y < PY + PH + 12 && Math.abs(d.x - p.x) <= p.w / 2 + 10) {
        d.caught = true;
        st.rescued++;
        st.score += 300;
        if (st.rescued <= WIDEN_MAX) {
          p.w = PW0 + WIDEN * st.rescued;
          p.x = clamp(p.x, p.w / 2 + 2, M.W - p.w / 2 - 2);
        }
        ev.push({ type: 'rescue', n: st.rescued, x: d.x });
      } else if (d.y > M.H + 12) {
        d.caught = true;                                // 소멸 처리
        st.moguLost++;
        ev.push({ type: 'mogulost' });
      }
    }
    st.drops = st.drops.filter((d) => !d.caught);

    // ── 클리어 ──
    if (this.breakableLeft(st) === 0 && st.drops.length === 0 && st.phase === 'play') {
      st.stars = 1 + (st.livesLost === 0 ? 1 : 0) + (st.moguLost === 0 ? 1 : 0);
      st.score += 1000 + st.lives * 300;
      st.phase = 'clear'; st.clearT = 0;
      ev.push({ type: 'clear', stars: st.stars, no: st.no, rescued: st.rescued });
    }
    return ev;
  },
};
