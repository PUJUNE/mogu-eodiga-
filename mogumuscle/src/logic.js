// logic.js — 태그매치 레슬링 (원작 머슬 태그매치 준거, DOM 무의존)
// 파워 0~99·자연 감소, 점프(소모 2), 밀치기→로프 반동→라리아트/드롭킥 카운터,
// 배후 백드롭, FBA, 생명의 구슬(파워 59 이하 트리거), 폴 3판 2선승, 전류 로프, 가스 투사체
const M = window.MMS;

const MAX_HP = 99;               // 초인 파워 (원작 0~99, 20당 1칸 = 5칸)
const DRAIN = 1;                 // 링 위 초당 파워 자연 감소 (원작)
const JUMP_T = 0.55;             // 점프 체공
const JUMP_COST = 2;             // 점프 파워 소모 (원작)
const JUMP_MIN = 20;             // 파워 1칸(20 미만)이면 점프 불가 (원작)
const PUNCH_RANGE = 30;
const KICK_RANGE = 34;           // 공중 킥 사거리
const GRAB_RANGE = 24;           // 밀치기·백드롭·잡기 필살기
const LARIAT_RANGE = 38;
const ROPE_V = 320;              // 밀쳐진 레슬러 로프행 속도
const ROPE_BACK_V = 250;         // 로프 반동 복귀 속도
const FBA_V = 300;               // 플라잉 바디 어택 비행 속도
const DK_V = 230;                // 드롭킥 돌진 속도 (공중 전진)
const DK_T = 0.45;               // 드롭킥 체공 시간 (공격 시 연장)
const DK_HIT = 28;               // 드롭킥 접촉 판정 거리
const STUN_T = 0.4;
const DOWN_T = 1.5;
const INV_T = 0.8;
const TAG_RANGE = 38;
const TAG_LOCK = 10;             // 재태그 잠금 (원작 10초)
const TAG_IN_POWER = 80;         // 태그 등장 파워 4칸 (원작)
const BALL_TRIG = 59;            // 생명의 구슬 트리거: 링 위 파워 59 이하 (원작)
const BALL_HEAL = 20;            // 획득 시 파워 회복 (원작)
const POWER_T = 10;              // 점멸(필살기 가능) 시간 (원작 약 10초)
const POWER_SPD = 50;            // 점멸 중 이속 증가 (원작 +50)
const MEAT_WAIT = 0.9;           // 매니저 등장 → 투척 대기
const BALL_FLY = 0.55;           // 구슬 비행 시간
const BALL_LIFE = 5;             // 착지 후 유지 시간
const BALL_PICK = 20;
const ZAP_DPS = 6;               // 전류 로프 접촉 초당 대미지
const ZAP_HIT = 10;              // 전류 로프 강타(밀치기·FBA 돌입) 대미지
const GAS_V = 220;               // 가스 투사체 속도
const FALL_BREAK = 2.2;          // 폴 사이 휴지

const C = { MAX_HP, DRAIN, JUMP_T, JUMP_COST, JUMP_MIN, PUNCH_RANGE, KICK_RANGE, GRAB_RANGE,
  LARIAT_RANGE, ROPE_V, ROPE_BACK_V, FBA_V, STUN_T, DOWN_T, INV_T, TAG_RANGE, TAG_LOCK,
  TAG_IN_POWER, BALL_TRIG, BALL_HEAL, POWER_T, POWER_SPD, BALL_LIFE, BALL_PICK,
  ZAP_DPS, ZAP_HIT, MEAT_WAIT, BALL_FLY, FALL_BREAK, DK_V, DK_T, DK_HIT };

M.Logic = {
  C,
  create(no) {
    const stage = M.makeStage(no);
    const pC = { x: -M.RING_X + 14, z: M.RING_Z - 10 };    // 아군 코너 (좌하)
    const eC = { x: M.RING_X - 14, z: -M.RING_Z + 10 };    // 적 코너 (우상)
    const mk = (h, kind, x, z, dmgMul) => ({
      name: h.name, kind, x, z, face: 1,
      hp: MAX_HP, maxHp: MAX_HP,
      spd: h.spd,
      mv: Object.fromEntries(Object.entries(h.mv).map(([k, v]) => [k, Math.max(1, Math.round(v * dmgMul))])),
      sp: { name: h.sp.name, kind: h.sp.kind, dmg: Math.round(h.sp.dmg * dmgMul) },
      state: 'idle',               // idle|walk|atk|air|fba|rope|run|down|ko
      anim: null, animT: 0,        // 기술 모션 (dropkick|lariat|backdrop — 렌더 전용)
      atkT: 0, cd: 0, stunT: 0, downT: 0, invT: 0,
      airT: 0, airDur: JUMP_T,
      ropePhase: null, ropeVx: 0, ropeT: 0,
      fbaVx: 0, fbaT: 0, dkVx: 0,
      runVx: 0, runVz: 0, runT: 0,
      poweredT: 0, gasCd: 0, aiT: 0,
    });
    const T = stage.team;
    return {
      stage, no, phase: 'fight', t: 0, endT: 0,            // fight | break | clear | over
      time: stage.time,
      fallNo: 1, falls: { p: 0, e: 0 },
      pC, eC,
      players: [
        mk(M.HEROES.mogu, 'mogu', pC.x + 34, pC.z - 14, 1),
        mk(M.HEROES.kko, 'kko', pC.x, pC.z, 1),
      ],
      enemies: [
        mk({ name: T.a.name, spd: stage.spd, mv: T.mv, sp: T.sp }, 'mouseA', eC.x - 34, eC.z + 14, stage.dmgMul),
        mk({ name: T.b.name, spd: stage.spd, mv: T.mv, sp: T.sp }, 'mouseB', eC.x, eC.z, stage.dmgMul),
      ],
      pi: 0, ei: 0,
      tagCd: 0, etagCd: 0,
      meat: null, ball: null, ballCd: 0, ballTarget: false,
      shots: [],
      score: 0, pDowns: 0, stars: 0,
      rng: M.makeRng(stage.seed),
    };
  },

  active(st, team) { return team === 'p' ? st.players[st.pi] : st.enemies[st.ei]; },
  alive(w) { return w.state !== 'ko'; },
  hittable(w) { return w.state !== 'down' && w.state !== 'ko' && w.invT <= 0; },
  canAct(w) { return ['idle', 'walk', 'air'].includes(w.state) && w.stunT <= 0 && w.atkT <= 0; },
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
  teamHpPct(ws) { return (ws[0].hp + ws[1].hp) / (ws[0].maxHp + ws[1].maxHp); },
  // 배후 판정: 수비자가 보는 방향의 반대편 (경직·모션 중 face가 굳었을 때 노린다)
  _behind(att, def) {
    return Math.abs(att.z - def.z) < 12 &&
      ((def.face === 1 && att.x < def.x - 3) || (def.face === -1 && att.x > def.x + 3));
  },
  _zapRope(st, w) {                // 전류 로프 활성 여부 (점멸 중엔 무효 — 원작)
    return st.stage.electric && w.poweredT <= 0;
  },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase === 'break') {
      st.endT += dt;
      if (st.endT >= FALL_BREAK) this._startFall(st, ev);
      return ev;
    }
    if (st.phase !== 'fight') { st.endT += dt; return ev; }

    // 폴 제한시간 → 초과 시 파워 합 우세 팀이 폴 획득 (원작 1P 즉시 패배의 완화 각색)
    st.time -= dt;
    if (st.time <= 0) {
      st.time = 0;
      this._fall(st, this.teamHpPct(st.players) >= this.teamHpPct(st.enemies) ? 'p' : 'e', ev, true);
      return ev;
    }

    const P = st.players[st.pi], E = st.enemies[st.ei];

    // ── 타이머·자연 감소 ──
    for (const w of [...st.players, ...st.enemies]) {
      w.cd = Math.max(0, w.cd - dt);
      w.stunT = Math.max(0, w.stunT - dt);
      w.invT = Math.max(0, w.invT - dt);
      w.poweredT = Math.max(0, w.poweredT - dt);
      w.gasCd = Math.max(0, w.gasCd - dt);
      if (w.atkT > 0) { w.atkT -= dt; if (w.atkT <= 0 && w.state === 'atk') w.state = 'idle'; }
      if (w.animT > 0) { w.animT -= dt; if (w.animT <= 0) w.anim = null; }
      if (w.state === 'air') { w.airT -= dt; if (w.airT <= 0) { w.state = 'idle'; w.dkVx = 0; } }
      if (w.state === 'down') {
        w.downT -= dt;
        if (w.downT <= 0) { w.state = 'idle'; w.invT = INV_T; }
      }
    }
    // 링 위(활성) 레슬러만 파워 자연 감소 (원작: 대기자는 감소도 회복도 없음)
    for (const w of [P, E]) {
      if (w.state !== 'ko') {
        w.hp -= DRAIN * dt;
        if (w.hp <= 0) { w.hp = 0; this._ko(st, w, ev); if (st.phase !== 'fight') return ev; }
      }
    }
    st.tagCd = Math.max(0, st.tagCd - dt);
    st.etagCd = Math.max(0, st.etagCd - dt);

    // ── 생명의 구슬 (원작: 파워 59 이하 → 매니저 등장 → 낮은 쪽으로 투척) ──
    st.ballCd = Math.max(0, st.ballCd - dt);
    if (!st.ball && !st.meat && st.ballCd <= 0 &&
        Math.min(P.hp, E.hp) <= BALL_TRIG && this.alive(P) && this.alive(E)) {
      st.meat = { z: st.rng.chance(0.5) ? -(M.RING_Z + 16) : M.RING_Z + 16, t: 0 };
      ev.push({ type: 'meat' });
    }
    if (st.meat) {
      st.meat.t += dt;
      if (st.meat.t >= MEAT_WAIT) {
        const target = P.hp <= E.hp ? P : E;                 // 파워 낮은 쪽을 향해 (원작)
        st.ball = {
          flying: true, ft: 0,
          x0: 0, z0: st.meat.z,
          tx: Math.max(-M.RING_X + 10, Math.min(M.RING_X - 10, target.x + st.rng.range(-16, 16))),
          tz: Math.max(-M.RING_Z + 8, Math.min(M.RING_Z - 8, target.z + st.rng.range(-10, 10))),
          x: 0, z: st.meat.z, t: BALL_LIFE,
        };
        st.ballTarget = st.rng.chance(0.5 + st.stage.aggr * 0.4);  // 적이 구슬을 노릴지
        st.meat = null;
        ev.push({ type: 'ball' });
      }
    }
    if (st.ball) {
      const b = st.ball;
      if (b.flying) {
        b.ft += dt;
        const k = Math.min(1, b.ft / BALL_FLY);
        b.x = b.x0 + (b.tx - b.x0) * k;
        b.z = b.z0 + (b.tz - b.z0) * k;
        if (k >= 1) b.flying = false;
      } else {
        b.t -= dt;
        if (b.t <= 0) { st.ball = null; st.ballCd = st.stage.ballInt; }
        else {
          for (const [w, team] of [[P, 'p'], [E, 'e']]) {
            if (this.canAct(w) && this.dist(w, b) < BALL_PICK) {
              w.hp = Math.min(w.maxHp, w.hp + BALL_HEAL);    // +20 회복 (원작)
              w.poweredT = POWER_T;                          // 10초 점멸 (원작)
              st.ball = null; st.ballCd = st.stage.ballInt;
              ev.push({ type: 'powered', team });
              break;
            }
          }
        }
      }
    }

    // ── 가스 투사체 ──
    for (const s of st.shots) {
      s.x += s.vx * dt;
      const def = s.team === 'e' ? P : E;
      if (this.hittable(def) && def.state !== 'rope' && Math.abs(s.x - def.x) < 14 && Math.abs(s.z - def.z) < 12) {
        s.dead = true;
        this._damage(st, null, def, s.dmg, false, 'gashit', ev, 0.8);
        if (st.phase !== 'fight') break;
      }
      if (Math.abs(s.x) > M.RING_X + 50) s.dead = true;
    }
    st.shots = st.shots.filter((s) => !s.dead);
    if (st.phase !== 'fight') return ev;

    // ── 밀쳐진 레슬러: 로프행 → 반동 복귀 (좌우 로프만 — 원작) ──
    for (const w of [...st.players, ...st.enemies]) {
      if (w.state !== 'rope') continue;
      w.ropeT += dt;
      w.x += w.ropeVx * dt;
      if (w.ropePhase === 'out' && Math.abs(w.x) >= M.RING_X) {
        w.x = Math.max(-M.RING_X, Math.min(M.RING_X, w.x));
        if (this._zapRope(st, w)) {                          // 전류 로프 강타: 반동 없이 다운
          this._damage(st, null, w, ZAP_HIT, true, 'zap', ev);
          if (st.phase !== 'fight') return ev;
        } else {
          w.ropePhase = 'back';
          w.ropeVx = -Math.sign(w.ropeVx) * ROPE_BACK_V;
          ev.push({ type: 'ropehit' });
        }
      } else if (w.ropePhase === 'back' &&
          ((w.ropeVx > 0 && w.x >= M.RING_X) || (w.ropeVx < 0 && w.x <= -M.RING_X) || w.ropeT > 2.5)) {
        w.x = Math.max(-M.RING_X, Math.min(M.RING_X, w.x));   // 반대편 로프까지 달려간 뒤 종료
        w.state = 'idle'; w.ropePhase = null;
      }
    }

    // ── FBA 비행 ──
    for (const [w, team] of [[P, 'p'], [E, 'e']]) {
      if (w.state !== 'fba') continue;
      w.x += w.fbaVx * dt;
      w.fbaT -= dt;
      const def = team === 'p' ? E : P;
      if (this.hittable(def) && def.state !== 'rope' && this.dist(w, def) < 30) {
        w.state = 'idle'; w.cd = 0.6;
        this._damage(st, w, def, w.mv.fba, true, 'fba', ev);
        if (st.phase !== 'fight') return ev;
      } else if (w.fbaT <= 0 || Math.abs(w.x) >= M.RING_X) {
        w.x = Math.max(-M.RING_X, Math.min(M.RING_X, w.x));
        w.state = 'idle'; w.cd = 0.4;
      }
    }

    // ── 드롭킥 돌진 (공중 전진 — 접촉 시 명중 + 다운) ──
    for (const [w, team] of [[P, 'p'], [E, 'e']]) {
      if (w.state !== 'air' || w.anim !== 'dropkick' || !w.dkVx) continue;
      w.x += w.dkVx * dt;
      if (Math.abs(w.x) >= M.RING_X - 6) {                   // 로프 앞에서 돌진 종료
        w.x = Math.sign(w.x) * (M.RING_X - 6);
        w.dkVx = 0;
        continue;
      }
      const def = team === 'p' ? E : P;
      if (this.dist(w, def) >= DK_HIT) continue;
      if (def.state === 'rope') {                            // 반동 복귀 중 → 드롭킥 카운터 (강)
        this._dkLand(w);
        this._damage(st, w, def, w.mv.dropkick, true, 'dropkick', ev);
      } else if (this.hittable(def)) {                       // 일반 명중도 다운
        this._dkLand(w);
        if (w.poweredT > 0 && w.sp.kind === 'jump') this._special(st, w, def, ev);
        else this._damage(st, w, def, w.mv.kick, true, 'kick', ev);
      } else continue;
      if (st.phase !== 'fight') return ev;
    }

    // ── 플레이어 조작 ──
    if (this.canAct(P)) {
      const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const dz = (input.up ? -1 : 0) + (input.down ? 1 : 0);
      if (dx) P.face = dx;                                   // 이동 방향으로 몸이 향함 (원작 — 배후 잡기 성립 조건)
      const n = dx && dz ? Math.SQRT1_2 : 1;
      const spd = P.spd + (P.poweredT > 0 ? POWER_SPD : 0);
      P.x += dx * spd * n * dt;
      P.z += dz * spd * n * dt;
      if (P.state !== 'air') P.state = dx || dz ? 'walk' : 'idle';

      // 점프 (원작 B: 파워 2 소모, 1칸 미만이면 불가)
      if (input.jump && P.state !== 'air' && P.hp >= JUMP_MIN) {
        P.state = 'air'; P.airT = P.airDur = JUMP_T;
        P.hp -= JUMP_COST;
        ev.push({ type: 'jump' });
      }
      // 공중에 좌우 로프 도달 → 플라잉 바디 어택 자동 발동 (원작)
      if (P.state === 'air' && Math.abs(P.x) >= M.RING_X - 2) {
        if (this._zapRope(st, P)) {
          P.state = 'idle'; P.stunT = 0.6;
          this._damage(st, null, P, ZAP_HIT, false, 'zap', ev);
          if (st.phase !== 'fight') return ev;
          P.x -= Math.sign(P.x) * 20;
        } else {
          P.state = 'fba';
          P.fbaVx = -Math.sign(P.x) * FBA_V;
          P.fbaT = (M.RING_X * 2 - 24) / FBA_V;
          ev.push({ type: 'fbago' });
        }
      }
      // 공격 (태그는 C 전용 — 코너에서도 공격 버튼은 항상 공격, 오태그 방지)
      if (input.atk && P.cd <= 0 && P.state !== 'fba') {
        this._attack(st, P, E, 'p', ev);
        if (st.phase !== 'fight') return ev;
      }
      // 태그: 전용 입력(C·🔄)으로만, 지상에서 코너 근처일 때
      if (input.tag && st.tagCd <= 0 && this.alive(st.players[1 - st.pi]) &&
          P.state !== 'air' && this.dist(P, st.pC) < TAG_RANGE) {
        this._tag(st, 'p', ev);
      }
    }
    if (P.state !== 'rope' && P.state !== 'fba') {
      P.x = Math.max(-M.RING_X, Math.min(M.RING_X, P.x));
      P.z = Math.max(-M.RING_Z, Math.min(M.RING_Z, P.z));
      // 전류 로프 접촉 (점프 무관하게 접촉 중 지속 대미지 — 이탈은 이동/점프로)
      if (this._zapRope(st, P) && Math.abs(P.x) >= M.RING_X && P.state !== 'down' && P.state !== 'ko') {
        P.hp -= ZAP_DPS * dt;
        if (!st._zapEvP || st.t - st._zapEvP > 0.5) { st._zapEvP = st.t; ev.push({ type: 'zaptouch' }); }
        if (P.hp <= 0) { P.hp = 0; this._ko(st, P, ev); return ev; }
        if (input.jump) P.x -= Math.sign(P.x) * 24;          // 점프로 탈출 (원작 B)
      }
    }

    // ── 적 AI ──
    this._enemyAI(st, E, P, dt, ev);
    if (st.phase !== 'fight') return ev;
    if (E.state !== 'rope' && E.state !== 'fba') {
      E.x = Math.max(-M.RING_X, Math.min(M.RING_X, E.x));
      E.z = Math.max(-M.RING_Z, Math.min(M.RING_Z, E.z));
      if (this._zapRope(st, E) && Math.abs(E.x) >= M.RING_X && E.state !== 'down' && E.state !== 'ko') {
        E.hp -= ZAP_DPS * dt;
        if (E.hp <= 0) { E.hp = 0; this._ko(st, E, ev); return ev; }
        E.x -= Math.sign(E.x) * 24;                          // AI는 즉시 이탈
      }
    }

    return ev;
  },

  _enemyAI(st, E, P, dt, ev) {
    if (!this.canAct(E) && E.state !== 'run') return;
    const aggr = st.stage.aggr;
    const d = this.dist(E, P);

    // 돌진 필살기 비행 (dash-kind, 점멸 중)
    if (E.state === 'run') {
      E.x += E.runVx * dt; E.z += E.runVz * dt;
      E.runT -= dt;
      if (this.hittable(P) && P.state !== 'rope' && d < 32) {
        E.state = 'idle'; E.cd = 0.7;
        this._special(st, E, P, ev);
      } else if (E.runT <= 0 || Math.abs(E.x) >= M.RING_X || Math.abs(E.z) >= M.RING_Z) {
        E.state = 'idle'; E.cd = 0.5;
      }
      return;
    }

    E.aiT += dt;
    const spd = E.spd + (E.poweredT > 0 ? POWER_SPD : 0);
    const partner = st.enemies[1 - st.ei];

    // 공중이면: 사거리 안 공격
    if (E.state === 'air') {
      if (E.cd <= 0 && d < KICK_RANGE) this._attack(st, E, P, 'e', ev);
      return;
    }

    // 이동 목표 결정
    let tx = P.x, tz = P.z, wantTag = false;
    if (E.hp < 30 && this.alive(partner) && partner.hp > E.hp + 20 && st.etagCd <= 0) {
      tx = st.eC.x; tz = st.eC.z; wantTag = true;            // 저파워 → 코너 태그 (원작 AI 습성)
    } else if (st.ball && !st.ball.flying && st.ballTarget) {
      tx = st.ball.x; tz = st.ball.z;                        // 구슬 쟁탈
    } else if (E.poweredT > 0 && E.sp.kind === 'gas') {
      tx = E.x + (E.x > P.x ? 40 : -40); tz = P.z;           // 가스: 거리 유지 + z 정렬
    } else if (P.stunT > 0 && st.rng.chance(0.04)) {
      tx = P.x + P.face * 16; tz = P.z;                      // 경직 중 배후 침투 → 백드롭
    }
    const ddx = tx - E.x, ddz = tz - E.z, dd = Math.hypot(ddx, ddz) || 1;
    if (dd > 3) {
      E.x += (ddx / dd) * spd * dt;
      E.z += (ddz / dd) * spd * dt;
      E.state = 'walk';
      if (Math.abs(ddx) > 2) E.face = ddx >= 0 ? 1 : -1;     // 이동 방향으로 몸이 향함
    } else E.state = 'idle';

    if (wantTag && this.dist(E, st.eC) < TAG_RANGE) { this._tag(st, 'e', ev); return; }

    // 공격 판단
    const aiCd = 1.1 - aggr * 0.75;
    if (E.aiT < aiCd || E.cd > 0) return;

    // 로프 반동 복귀 중인 플레이어 → 카운터 라리아트 (성공률 = stage.counter)
    if (P.state === 'rope' && P.ropePhase === 'back' && d < LARIAT_RANGE) {
      E.aiT = 0;
      if (st.rng.chance(st.stage.counter)) this._attack(st, E, P, 'e', ev);
      return;
    }

    if (E.poweredT > 0) {                                    // 점멸 중: 필살기 지향
      const k = E.sp.kind;
      if (k === 'gas') {
        if (Math.abs(E.z - P.z) < 12 && E.gasCd <= 0) {
          E.aiT = 0;
          this._fireGas(st, E, P, ev);
        }
        return;
      }
      if (k === 'dash' && d > 70) {
        E.aiT = 0;
        const dvx = (P.x - E.x) / d, dvz = (P.z - E.z) / d;
        E.state = 'run'; E.runVx = dvx * FBA_V; E.runVz = dvz * FBA_V; E.runT = 1.4;
        ev.push({ type: 'edash' });
        return;
      }
      if (k === 'jump' && d < KICK_RANGE + 14 && E.hp >= JUMP_MIN) {
        E.aiT = 0;
        E.state = 'air'; E.airT = E.airDur = JUMP_T; E.hp -= JUMP_COST;
        return;
      }
      if (d < (k === 'rear' ? GRAB_RANGE : PUNCH_RANGE)) { E.aiT = 0; this._attack(st, E, P, 'e', ev); }
      return;
    }

    if (wantTag) return;
    if (d < GRAB_RANGE) {                                    // 근접: 잡기(밀치기·백드롭)와 펀치를 섞음
      E.aiT = 0;
      if (st.rng.chance(0.5)) this._attack(st, E, P, 'e', ev);
      else this._punchAtk(st, E, P, ev);
    } else if (d < PUNCH_RANGE + 6) {
      E.aiT = 0;
      this._attack(st, E, P, 'e', ev);
    } else if (d > 42 && d < 72 && E.hp >= JUMP_MIN && st.rng.chance(aggr * 0.25)) {
      E.aiT = 0;                                             // 점프킥 접근
      E.state = 'air'; E.airT = E.airDur = JUMP_T; E.hp -= JUMP_COST;
    }
  },

  _tag(st, team, ev) {
    if (team === 'p') {
      st.pi = 1 - st.pi;
      const inW = st.players[st.pi];
      inW.x = st.pC.x; inW.z = st.pC.z; inW.state = 'idle'; inW.invT = 0.5;
      inW.hp = Math.max(inW.hp, TAG_IN_POWER);               // 파워 4칸으로 등장 (원작)
      st.tagCd = TAG_LOCK;
      ev.push({ type: 'tag', name: inW.name });
    } else {
      st.ei = 1 - st.ei;
      const inW = st.enemies[st.ei];
      inW.x = st.eC.x; inW.z = st.eC.z; inW.state = 'idle'; inW.invT = 0.5;
      inW.hp = Math.max(inW.hp, TAG_IN_POWER);
      st.etagCd = TAG_LOCK;
      ev.push({ type: 'etag', name: inW.name });
    }
  },

  _dkLand(w) {                     // 드롭킥 명중 → 돌진 종료, 착지 슬라이드 연출
    w.dkVx = 0;
    w.airT = Math.min(w.airT, 0.18);
    w.animT = 0.5;
  },

  _fireGas(st, att, def, ev) {
    att.state = 'atk'; att.atkT = 0.3; att.cd = 0.5; att.gasCd = 1.1;
    st.shots.push({
      team: st.enemies.includes(att) ? 'e' : 'p',
      x: att.x, z: att.z,
      vx: (def.x >= att.x ? 1 : -1) * GAS_V,
      dmg: att.sp.dmg,
    });
    ev.push({ type: 'gas', name: att.sp.name });
  },

  _special(st, att, def, ev) {
    ev.push({ type: 'specialGo', name: att.sp.name });
    this._damage(st, att, def, att.sp.dmg, true, 'special', ev);
  },

  // 공격 분기 (지상: 라리아트/잡기/펀치, 공중: 킥/드롭킥)
  _attack(st, att, def, team, ev) {
    const d = this.dist(att, def);
    const powered = att.poweredT > 0;

    if (att.state === 'air') {                               // 공중 공격 = 플라잉 드롭킥 돌진
      att.cd = 0.55;
      att.face = def.x >= att.x ? 1 : -1;                    // 양 다리가 상대 쪽을 향하도록 회전
      att.anim = 'dropkick';
      att.airT = Math.max(att.airT, DK_T);                   // 체공 연장
      att.animT = att.airT + 0.15;
      att.dkVx = att.face * DK_V;                            // 상대 쪽으로 전진 — 명중은 비행 중 접촉 판정
      ev.push({ type: 'dkgo' });
      return;
    }

    if (powered && att.sp.kind === 'gas' && d > GRAB_RANGE) {  // 가스 (원거리 — 원작 유일 투사체)
      if (att.gasCd <= 0) this._fireGas(st, att, def, ev);
      return;
    }

    if (def.state === 'rope' && d < LARIAT_RANGE) {          // 반동 복귀 중 → 라리아트
      att.state = 'atk'; att.atkT = 0.3; att.cd = 0.6;
      att.anim = 'lariat'; att.animT = 0.35;
      this._damage(st, att, def, att.mv.lariat, true, 'lariat', ev);
      return;
    }

    if (this.hittable(def) && def.state !== 'rope' && d < GRAB_RANGE) {  // 밀착: 잡기
      att.state = 'atk'; att.atkT = 0.35; att.cd = 0.85;
      if (powered && att.sp.kind === 'rear') {               // 잡기 필살기
        this._special(st, att, def, ev);
      } else if (this._behind(att, def)) {                   // 배후 → 백드롭
        att.anim = 'backdrop'; att.animT = 0.35;
        this._damage(st, att, def, att.mv.backdrop, true, 'backdrop', ev);
      } else {                                               // 정면 → 밀치기 (좌우 로프로)
        att.atkT = 0.22; att.cd = 0.3;                       // 가벼운 동작 — 복귀 라리아트 콤보 가능해야 함
        def.state = 'rope'; def.ropePhase = 'out'; def.ropeT = 0;
        def.ropeVx = (def.x >= 0 ? 1 : -1) * ROPE_V;
        def.stunT = 0; def.atkT = 0;
        ev.push({ type: 'shove' });
      }
      return;
    }

    this._punchAtk(st, att, def, ev);                        // 펀치
  },

  _punchAtk(st, att, def, ev) {
    const d = this.dist(att, def);
    att.state = 'atk'; att.atkT = 0.28; att.cd = 0.5;
    if (this.hittable(def) && def.state !== 'rope' && d < PUNCH_RANGE) {
      if (att.poweredT > 0 && att.sp.kind === 'punch') this._special(st, att, def, ev);
      else this._damage(st, att, def, att.mv.punch, false, 'punch', ev);
    } else ev.push({ type: 'swing' });
  },

  // kd = 다운 여부. stun = 다운 없을 때 경직 시간
  _damage(st, att, def, amount, kd, kind, ev, stun = STUN_T) {
    def.hp = Math.max(0, def.hp - amount);
    if (att && st.players.includes(att)) st.score += amount * 10;
    ev.push({ type: kind, x: def.x, z: def.z, amount });
    if (def.state === 'rope') def.ropePhase = null;
    if (kd || def.hp <= 0) {
      def.state = 'down'; def.downT = DOWN_T; def.stunT = 0; def.atkT = 0; def.airT = 0;
      def.anim = null; def.animT = 0; def.dkVx = 0;
      if (st.players.includes(def)) st.pDowns++;
      ev.push({ type: 'kd' });
    } else {
      def.state = def.state === 'rope' ? 'idle' : def.state;
      def.stunT = Math.max(def.stunT, stun);
    }
    if (def.hp <= 0) this._ko(st, def, ev);
  },

  // KO = 폴 종료 (원작: 한 명의 파워 소진 = 1폴)
  _ko(st, w, ev) {
    w.state = 'ko';
    ev.push({ type: 'ko', name: w.name });
    this._fall(st, st.enemies.includes(w) ? 'p' : 'e', ev, false);
  },

  _fall(st, team, ev, judge) {
    st.falls[team]++;
    if (team === 'p') st.score += 500;
    ev.push({ type: 'fall', team, judge: !!judge, falls: { ...st.falls } });
    if (st.falls[team] >= 2) {
      if (team === 'p') this._win(st, ev);
      else { st.phase = 'over'; st.endT = 0; ev.push({ type: 'over' }); }
    } else {
      st.phase = 'break'; st.endT = 0;
    }
  },

  _startFall(st, ev) {
    st.fallNo++;
    st.time = st.stage.time;
    st.phase = 'fight';
    const spots = [
      [st.players[0], st.pC.x + 34, st.pC.z - 14],
      [st.players[1], st.pC.x, st.pC.z],
      [st.enemies[0], st.eC.x - 34, st.eC.z + 14],
      [st.enemies[1], st.eC.x, st.eC.z],
    ];
    for (const [w, x, z] of spots) {
      if (w.state === 'ko') w.hp = 40;                       // KO자는 파워 2칸으로 부활
      else w.hp = Math.max(w.hp, 20);
      w.x = x; w.z = z;
      w.state = 'idle';
      w.stunT = 0; w.downT = 0; w.atkT = 0; w.airT = 0; w.ropePhase = null;
      w.anim = null; w.animT = 0; w.dkVx = 0;
      w.poweredT = 0; w.cd = 0; w.invT = 1;
    }
    st.meat = null; st.ball = null; st.ballCd = 2; st.shots = [];
    ev.push({ type: 'fallstart', no: st.fallNo });
  },

  _win(st, ev) {
    // ★1 승리 / ★2 폴 무손실(2-0) / ★3 2-0 + 아군 무다운
    st.stars = st.falls.e === 0 ? (st.pDowns === 0 ? 3 : 2) : 1;
    st.score += Math.round(st.time) * 10 + Math.round(this.teamHpPct(st.players) * 1000);
    st.phase = 'clear'; st.endT = 0;
    ev.push({ type: 'clear', stars: st.stars });
  },
};
