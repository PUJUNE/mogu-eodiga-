// logic.js — 공·플레이어 물리 + 라이벌 AI (DOM 무의존 — node 테스트 가능)
const M = window.MGV;

const PG = 1150, PJUMP = -420, PSPD = 190;      // 플레이어 중력·점프·이동
const BG = 480, BOUNCE = 0.82, BMAX = 540;      // 공 중력·반발·최고 속도
const HIT_R = 44, HIT_CD = 0.28;
const PW = 17, PH = 42;                          // 플레이어 반폭·키

function mkPlayer(x) {
  return { x, y: M.GROUND, vy: 0, dir: x < M.NET_X ? 1 : -1, onGround: true, hitCd: 0 };
}

M.Logic = {
  create(no) {
    const stage = M.makeStage(no);
    const st = {
      stage, no, phase: 'serve', t: 0, serveT: 0.9, endT: 0,
      p: mkPlayer(90), a: mkPlayer(390),
      ball: { x: 90, y: 90, vx: 0, vy: 0 },
      score: [0, 0], server: 0,                  // 0 = 플레이어, 1 = AI
      rng: M.makeRng(no * 557 + 31),
      aiTargetX: 390, aiReactT: 0, aiErr: 0, aiJumpCd: 0,
      stars: 0, rally: 0,
    };
    this._resetServe(st);
    return st;
  },

  _resetServe(st) {
    st.p = mkPlayer(90);
    st.a = mkPlayer(390);
    const sx = st.server === 0 ? 90 : 390;
    st.ball = { x: sx, y: 80, vx: 0, vy: 0 };
    st.phase = 'serve'; st.serveT = 0.9; st.rally = 0;
    st.aiErr = st.rng.range(-st.stage.ai.err, st.stage.ai.err);
  },

  // 탄도 예측: 공이 y=GROUND-BALL_R에 닿을 때의 x (벽 반사 반영)
  predictX(st) {
    let { x, y, vx, vy } = st.ball;
    for (let i = 0; i < 600; i++) {
      vy += BG * st.stage.ballSpeed * (1 / 60);
      x += vx * (1 / 60); y += vy * (1 / 60);
      if (x < M.BALL_R) { x = M.BALL_R; vx = Math.abs(vx); }
      if (x > M.W - M.BALL_R) { x = M.W - M.BALL_R; vx = -Math.abs(vx); }
      if (y >= M.GROUND - M.BALL_R) return x;
    }
    return x;
  },

  _movePlayer(pl, dt, input, minX, maxX) {
    let vx = 0;
    if (input.left) { vx = -PSPD; pl.dir = -1; }
    if (input.right) { vx = PSPD; pl.dir = 1; }
    pl.x = Math.max(minX, Math.min(maxX, pl.x + vx * dt));
    if (input.jump && pl.onGround) { pl.vy = PJUMP; pl.onGround = false; }
    pl.vy += PG * dt;
    pl.y += pl.vy * dt;
    if (pl.y >= M.GROUND) { pl.y = M.GROUND; pl.vy = 0; pl.onGround = true; }
    if (pl.hitCd > 0) pl.hitCd -= dt;
  },

  // 히트 판정: 공이 범위 안이면 타구. side +1 = 왼쪽(플레이어), -1 = 오른쪽(AI)
  _tryHit(st, pl, side, input, ev, who) {
    const b = st.ball;
    const cx = pl.x, cy = pl.y - PH * 0.55;
    const dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy > HIT_R * HIT_R) return false;
    if (pl.hitCd > 0) return false;
    pl.hitCd = HIT_CD;
    const sp = st.stage.ballSpeed;
    if (!pl.onGround) {
      if (input.up) { b.vx = side * 200 * sp; b.vy = -430 * sp; ev.push({ type: 'lob', who }); }
      else {
        b.vx = side * (400 + Math.abs(dx) * 2) * sp;
        b.vy = (b.y < M.NET_TOP + 20 ? 300 : -160) * sp;
        ev.push({ type: 'smash', who });
      }
    } else {
      b.vx = side * 180 * sp;
      b.vy = -440 * sp;
      ev.push({ type: 'bump', who });
    }
    st.rally++;
    return true;
  },

  _ai(st, dt) {
    const ai = st.stage.ai, b = st.ball;
    const input = { left: false, right: false, jump: false, hit: false, up: false };
    st.aiReactT -= dt;
    if (st.aiReactT <= 0) {
      st.aiReactT = ai.react;
      const incoming = b.vx > 0 || b.x > M.NET_X;
      st.aiTargetX = incoming ? Math.max(M.NET_X + 30, Math.min(M.W - 20, this.predictX(st) + st.aiErr)) : 385;
    }
    if (Math.abs(st.a.x - st.aiTargetX) > 6) {
      if (st.aiTargetX < st.a.x) input.left = true; else input.right = true;
    }
    // 속도 반영: 기본 PSPD 대신 AI 속도로 이동 (별도 처리)
    const spd = ai.speed;
    let vx = 0;
    if (input.left) { vx = -spd; st.a.dir = -1; }
    if (input.right) { vx = spd; st.a.dir = 1; }
    st.a.x = Math.max(M.NET_X + 24, Math.min(M.W - 16, st.a.x + vx * dt));
    // 점프·히트 판단 (점프 시도는 0.55초에 한 번 — smashP가 실제 확률이 되게)
    if (st.aiJumpCd > 0) st.aiJumpCd -= dt;
    const dx = b.x - st.a.x, dy = b.y - (st.a.y - PH * 0.55);
    const near = dx * dx + dy * dy < (HIT_R + 14) * (HIT_R + 14);
    if (near && b.x > M.NET_X && st.a.onGround && b.y < M.GROUND - 60 && st.aiJumpCd <= 0) {
      st.aiJumpCd = 0.55;
      if (st.rng.chance(ai.smashP)) { st.a.vy = PJUMP; st.a.onGround = false; }
    }
    st.a.vy += PG * dt;
    st.a.y += st.a.vy * dt;
    if (st.a.y >= M.GROUND) { st.a.y = M.GROUND; st.a.vy = 0; st.a.onGround = true; }
    if (st.a.hitCd > 0) st.a.hitCd -= dt;
    return near;
  },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase === 'win' || st.phase === 'over') { st.endT += dt; return ev; }

    if (st.phase === 'serve') {
      st.serveT -= dt;
      if (st.serveT <= 0) { st.phase = 'rally'; ev.push({ type: 'serve' }); }
      return ev;
    }

    // ── 플레이어 ──
    this._movePlayer(st.p, dt, input, 16, M.NET_X - 24);
    if (input.hit) this._tryHit(st, st.p, 1, input, ev, 'p');
    // 몸통 리시브 (히트 없이 접촉)
    this._bodyBounce(st, st.p, 1);

    // ── AI ──
    const near = this._ai(st, dt);
    if (near && st.ball.x > M.NET_X - 20) {
      // 내리꽂는 스매시가 네트를 넘는지 탄도로 판정 — 못 넘으면 로브로 전환
      const sp = st.stage.ballSpeed;
      const tNet = Math.max(0.02, (st.a.x - M.NET_X) / (400 * sp));
      const yAtNet = st.ball.y + 300 * sp * tNet + 0.5 * 480 * sp * tNet * tNet;
      const canSmash = !st.a.onGround && yAtNet < M.NET_TOP - 8;
      const aiInput = { up: !canSmash };
      this._tryHit(st, st.a, -1, aiInput, ev, 'a');
    }
    this._bodyBounce(st, st.a, -1);

    // ── 공 물리 ──
    const b = st.ball, sp = st.stage.ballSpeed;
    b.vy += BG * sp * dt;
    const spd2 = Math.hypot(b.vx, b.vy);
    if (spd2 > BMAX * sp) { b.vx *= (BMAX * sp) / spd2; b.vy *= (BMAX * sp) / spd2; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 벽·천장
    if (b.x < M.BALL_R) { b.x = M.BALL_R; b.vx = Math.abs(b.vx) * BOUNCE; ev.push({ type: 'wall' }); }
    if (b.x > M.W - M.BALL_R) { b.x = M.W - M.BALL_R; b.vx = -Math.abs(b.vx) * BOUNCE; ev.push({ type: 'wall' }); }
    if (b.y < M.BALL_R + 4) { b.y = M.BALL_R + 4; b.vy = Math.abs(b.vy) * BOUNCE; }
    // 네트
    if (Math.abs(b.x - M.NET_X) < M.NET_HW + M.BALL_R && b.y > M.NET_TOP) {
      if (b.y - M.BALL_R < M.NET_TOP + 8 && b.vy > 0) {        // 네트 상단
        b.y = M.NET_TOP - M.BALL_R;
        b.vy = -Math.abs(b.vy) * 0.6;
      } else {
        b.vx = (b.x < M.NET_X ? -1 : 1) * Math.abs(b.vx) * BOUNCE;
        b.x = M.NET_X + (b.x < M.NET_X ? -1 : 1) * (M.NET_HW + M.BALL_R);
      }
      ev.push({ type: 'net' });
    }
    // 바닥 → 득점
    if (b.y >= M.GROUND - M.BALL_R) {
      const scorer = b.x < M.NET_X ? 1 : 0;      // 왼쪽 바닥 = AI 득점
      st.score[scorer]++;
      st.server = scorer;
      ev.push({ type: 'score', scorer, score: [...st.score] });
      if (st.score[scorer] >= M.WIN_SCORE) {
        if (scorer === 0) {
          st.stars = st.score[1] === 0 ? 3 : st.score[1] <= 2 ? 2 : 1;
          st.phase = 'win'; st.endT = 0;
          ev.push({ type: 'win', stars: st.stars, score: [...st.score] });
        } else {
          st.phase = 'over'; st.endT = 0;
          ev.push({ type: 'over', score: [...st.score] });
        }
      } else {
        this._resetServe(st);
      }
      return ev;
    }
    return ev;
  },

  _bodyBounce(st, pl, side) {
    const b = st.ball;
    const dx = b.x - pl.x, dy = b.y - (pl.y - PH * 0.5);
    const rr = (M.BALL_R + PW) * (M.BALL_R + PW);
    if (dx * dx + dy * dy < rr && pl.hitCd <= 0.02 && b.vy > -50) {
      b.vy = -300 * st.stage.ballSpeed;
      b.vx += (dx * 5 + side * 40) * 0.6;
    }
  },
};
