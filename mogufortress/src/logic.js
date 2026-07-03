// logic.js — 턴제 포격: 각도·파워·바람·탄도·지형 파괴 (DOM 무의존)
const M = window.MFT;

const GRAV = 240;
const WIND_ACC = 9;              // 바람 1당 수평 가속
const POWER_RATE = 62;           // 파워 게이지 상승 속도 (/s)
const V_MAX = 330;               // 파워 100 발사 속도
const CRATER_R = 26;
const FUEL_MAX = 100;            // 턴당 이동 연료 (px)
const MOVE_SPD = 44;             // 이동 속도 (px/s)
const SLOPE_MAX = 10;            // 오를 수 있는 경사 (컬럼당 px)
const DMG_R = 42;

M.Logic = {
  create(no) {
    const stage = M.makeStage(no);
    const st = {
      stage, no, phase: 'aim', t: 0, endT: 0,   // aim|charge|fly|enemy|effect|win|over
      rng: M.makeRng(no * 613 + 5),
      terrain: [...stage.terrain],
      p: { col: stage.pCol, hp: 100, maxHp: 100, angle: 60, face: 1 },
      e: { col: stage.eCol, hp: stage.enemy.hp, maxHp: stage.enemy.hp, angle: 120, face: -1 },
      turn: 0,                                   // 0 = 플레이어
      wind: 0, power: 0, wasCharging: false,
      fuel: FUEL_MAX, eMoved: false,
      proj: null, effectT: 0, enemyThinkT: 0,
      shots: 0, hitsTaken: 0, stars: 0, lastShot: null,
    };
    this._newWind(st);
    return st;
  },

  _newWind(st) { st.wind = Math.round(st.rng.range(-6, 6) * 10) / 10; },

  tankX(st, who) { return who.col * M.TCOL + M.TCOL / 2; },
  tankY(st, who) { return st.terrain[Math.round(who.col)]; },

  // 이동: 연료 소모 + 경사 차단. 성공 시 이동한 px 반환
  moveTank(st, who, dir, dt, lo, hi) {
    if (st.fuel <= 0) return 0;
    const px = Math.min(MOVE_SPD * dt, st.fuel);
    const from = Math.round(who.col);
    let colF = who.col + (dir * px) / M.TCOL;
    colF = Math.max(lo, Math.min(hi, colF));
    const to = Math.round(colF);
    // 경사 검사 (한 컬럼씩)
    const stepDir = Math.sign(to - from);
    let cur = from;
    while (cur !== to) {
      const nxt = cur + stepDir;
      if (Math.abs(st.terrain[nxt] - st.terrain[cur]) > SLOPE_MAX) {
        colF = cur;                            // 경사에 막힘
        break;
      }
      cur = nxt;
    }
    const moved = Math.abs(colF - who.col) * M.TCOL;
    if (moved > 0.01) {
      who.col = colF;
      st.fuel -= moved;
    }
    return moved;
  },

  // 발사 (who: st.p 또는 st.e)
  _fire(st, who, angle, power, ev) {
    const v = (power / 100) * V_MAX;
    const rad = angle * Math.PI / 180;
    st.proj = {
      x: this.tankX(st, who), y: this.tankY(st, who) - 14,
      vx: Math.cos(rad) * v, vy: -Math.sin(rad) * v,
      from: who === st.p ? 0 : 1, trail: [], age: 0,
    };
    st.phase = 'fly';
    ev.push({ type: 'fire', from: st.proj.from, power });
  },

  // 크레이터 + 데미지 + 낙하
  _explode(st, x, y, from, ev) {
    ev.push({ type: 'boom', x, y });
    const c0 = Math.floor(x / M.TCOL);
    for (let i = -Math.ceil(CRATER_R / M.TCOL); i <= Math.ceil(CRATER_R / M.TCOL); i++) {
      const ci = c0 + i;
      if (ci < 0 || ci >= M.NCOL) continue;
      const dx = Math.abs(i * M.TCOL);
      if (dx > CRATER_R) continue;
      // 크레이터 바닥보다 위에 있는 지형을 깎아 냄 (terrain 값은 지면 y — 클수록 낮음)
      const bottom = Math.round(y + Math.sqrt(CRATER_R * CRATER_R - dx * dx) * 0.55);
      if (st.terrain[ci] < bottom) st.terrain[ci] = Math.min(238, bottom);
    }
    // 데미지 (폭심 거리 비례)
    const dmgMul = from === 1 ? st.stage.enemy.dmgMul : 1;
    for (const [who, tag] of [[st.p, 0], [st.e, 1]]) {
      const tx = this.tankX(st, who), ty = this.tankY(st, who) - 8;
      const d = Math.hypot(tx - x, ty - y);
      if (d < DMG_R) {
        let dmg = Math.round((45 - (d / DMG_R) * 33) * (tag === 0 ? dmgMul : 1));
        who.hp = Math.max(0, who.hp - dmg);
        if (tag === 0) st.hitsTaken++;
        ev.push({ type: 'damage', who: tag, dmg, hp: who.hp });
      }
    }
    // 낙하 (발밑 지형 침하)
    for (const [who, tag] of [[st.p, 0], [st.e, 1]]) {
      const ground = st.terrain[who.col];
      const cur = this.tankY(st, who);
      // tankY == terrain이므로 낙하량은 이전 대비 계산 불가 → 폭발 후 즉시 정착.
      // 큰 침하(크레이터 직하) 시 소량 피해
      if (Math.abs(who.col - c0) * M.TCOL < CRATER_R) {
        who.hp = Math.max(0, who.hp - 4);
        if (tag === 0) st.hitsTaken++;
        ev.push({ type: 'fall', who: tag, hp: who.hp });
      }
    }
    // 승패
    if (st.e.hp <= 0 || st.p.hp <= 0) {
      if (st.e.hp <= 0 && st.p.hp > 0) {
        st.stars = st.hitsTaken === 0 ? 3 : st.p.hp >= 60 ? 2 : 1;
        st.phase = 'win'; st.endT = 0;
        ev.push({ type: 'win', stars: st.stars });
      } else {
        st.phase = 'over'; st.endT = 0;
        ev.push({ type: 'over' });
      }
      return;
    }
    // 턴 교대
    st.turn = 1 - st.turn;
    this._newWind(st);
    ev.push({ type: 'turn', turn: st.turn, wind: st.wind });
    st.fuel = FUEL_MAX; st.eMoved = false;
    if (st.turn === 0) { st.phase = 'aim'; st.power = 0; st.wasCharging = false; }
    else { st.phase = 'enemy'; st.enemyThinkT = 0; }
  },

  // AI 조준: 탄도 반복 시뮬레이션으로 파워 탐색 + 오차 주입
  _aiShot(st) {
    const ex = this.tankX(st, st.e), ey = this.tankY(st, st.e) - 14;
    const txTrue = this.tankX(st, st.p);
    const tx = txTrue + st.rng.range(-st.stage.enemy.err, st.stage.enemy.err);
    const angle = 135;                            // 왼쪽 위 고정각, 파워로 조준
    const rad = angle * Math.PI / 180;
    let best = 60, bd = 1e9;
    for (let pw = 25; pw <= 100; pw += 2.5) {
      const v = (pw / 100) * V_MAX;
      let x = ex, y = ey, vx = Math.cos(rad) * v, vy = -Math.sin(rad) * v;
      for (let i = 0; i < 800; i++) {
        vx += st.wind * WIND_ACC * (1 / 120);
        vy += GRAV * (1 / 120);
        x += vx * (1 / 120); y += vy * (1 / 120);
        const ci = Math.floor(x / M.TCOL);
        if (ci < 0 || ci >= M.NCOL) { x = -9999; break; }
        if (y >= st.terrain[ci]) break;
      }
      const d = Math.abs(x - tx);
      if (d < bd) { bd = d; best = pw; }
    }
    return { angle, power: best };
  },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase === 'win' || st.phase === 'over') { st.endT += dt; return ev; }

    if (st.phase === 'aim' || st.phase === 'charge') {
      // 각도 조절 (↑↓, 10°~170°)
      if (input.up) st.p.angle = Math.min(170, st.p.angle + 55 * dt);
      if (input.down) st.p.angle = Math.max(10, st.p.angle - 55 * dt);
      // 이동 (←→, 조준 중에만 — 충전 중 불가, 연료·경사 제한)
      if (st.phase === 'aim' && !input.charge && (input.left || input.right)) {
        const moved = this.moveTank(st, st.p, input.right ? 1 : -1, dt, 5, Math.floor(M.NCOL * 0.46));
        if (moved > 0) ev.push({ type: 'move' });
      }
      // 파워: 꾹 → 충전, 놓으면 발사
      if (input.charge) {
        st.phase = 'charge';
        st.wasCharging = true;
        st.power = Math.min(100, st.power + POWER_RATE * dt);
        if (st.power >= 100) {                    // 최대치 자동 발사
          st.shots++;
          this._fire(st, st.p, st.p.angle, 100, ev);
        }
      } else if (st.wasCharging) {
        st.shots++;
        this._fire(st, st.p, st.p.angle, st.power, ev);
      }

    } else if (st.phase === 'enemy') {
      st.enemyThinkT += dt;
      // 사격 전 이동 (턴당 1회, 시드 결정적 목표로 슬라이드)
      if (!st.eMoved) {
        if (st.eMoveTarget === undefined || st.eMoveTarget === null) {
          st.eMoveTarget = Math.max(Math.ceil(M.NCOL * 0.54), Math.min(M.NCOL - 5,
            Math.round(st.e.col) + st.rng.int(-13, 13)));
        }
        const dir = Math.sign(st.eMoveTarget - st.e.col);
        if (dir === 0 || Math.abs(st.eMoveTarget - st.e.col) < 0.4 || st.fuel <= 0) {
          st.eMoved = true; st.eMoveTarget = null;
        } else {
          const moved = this.moveTank(st, st.e, dir, dt, Math.ceil(M.NCOL * 0.54), M.NCOL - 5);
          if (moved <= 0.01) { st.eMoved = true; st.eMoveTarget = null; }
        }
      }
      if (st.enemyThinkT > 1.1 && st.eMoved) {
        const shot = this._aiShot(st);
        st.e.angle = shot.angle;
        this._fire(st, st.e, shot.angle, shot.power, ev);
      }

    } else if (st.phase === 'fly') {
      const pr = st.proj;
      pr.age += dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * dt / 2));
      for (let i = 0; i < steps && st.phase === 'fly'; i++) {
        pr.vx += st.wind * WIND_ACC * dt / steps;
        pr.vy += GRAV * dt / steps;
        pr.x += pr.vx * dt / steps;
        pr.y += pr.vy * dt / steps;
        // 탱크 직격 판정 (포구 자폭 방지: 발사 직후 0.45초는 쏜 쪽 제외)
        for (const [who, tag] of [[st.p, 0], [st.e, 1]]) {
          if (tag === pr.from && pr.age < 0.45) continue;
          const tx = this.tankX(st, who), ty = this.tankY(st, who) - 8;
          if (Math.hypot(pr.x - tx, pr.y - ty) < 13) {
            st.lastShot = { x: pr.x, from: pr.from };
            const { x, y } = pr;
            st.proj = null;
            this._explode(st, x, y, pr.from, ev);
            return ev;
          }
        }
        // 지형 충돌
        const ci = Math.floor(pr.x / M.TCOL);
        if (ci < 0 || ci >= M.NCOL || pr.y > M.H + 40) {
          // 장외 → 턴 교대
          st.lastShot = { x: pr.x, from: pr.from, out: true };
          st.proj = null;
          ev.push({ type: 'splash' });
          st.turn = 1 - st.turn;
          this._newWind(st);
          ev.push({ type: 'turn', turn: st.turn, wind: st.wind });
          st.fuel = FUEL_MAX; st.eMoved = false;
          if (st.turn === 0) { st.phase = 'aim'; st.power = 0; st.wasCharging = false; }
          else { st.phase = 'enemy'; st.enemyThinkT = 0; }
          return ev;
        }
        if (pr.y >= st.terrain[ci]) {
          st.lastShot = { x: pr.x, from: pr.from };
          const { x, y } = pr;
          st.proj = null;
          this._explode(st, x, y, pr.from, ev);
          return ev;
        }
      }
      if (st.proj) {
        st.proj.trail.push({ x: st.proj.x, y: st.proj.y });
        if (st.proj.trail.length > 26) st.proj.trail.shift();
      }
    }
    return ev;
  },
};
