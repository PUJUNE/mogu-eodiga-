// logic.js — 전방 러너: 속도·조향·점프·충돌·시간 (DOM 무의존)
const M = window.MNG;

const SPD_MIN = 60;
const ACCEL = 130, BRAKE = 210;
const STEER_ACC = 950;           // 조향 가속 (빙판 관성)
const VX_MAX = 215;              // 최대 횡속도
const ICE_DRAG = 1.1;            // 무입력 시 감쇠 (빙판이라 낮음)
const JUMP_T = 0.58;             // 점프 체공 시간
const FLAP_ADD = 0.16;           // 공중 연타 1회당 체공 연장
const FLAP_MAX = 3;              // 연타 연장 최대 횟수
const STUN_T = 1.2;              // 충돌 경직
const TUMBLE_V = 110;            // 충돌 비틀거림 횡이동 속도 (탁탁탁)
const HIT_BAND = 13;             // 판정 깊이 (m)

M.Logic = {
  FLAP_MAX,
  create(no) {
    const stage = M.makeStage(no);
    return {
      stage, no, phase: 'run', t: 0, endT: 0,   // run | clear | over
      dist: 0, spd: SPD_MIN + 40, x: 0, vx: 0, skidT: 0,
      jumpT: 0, airDur: JUMP_T, flapN: 0, flapT: 0,   // 점프·연타 호버 상태
      stunT: 0, tumbleDir: 1,                    // 경직·비틀거림 방향
      time: stage.time,
      flags: 0, fish: 0, crashes: 0, score: 0, stars: 0,
      resolved: new Set(),                       // 처리 완료 오브젝트 인덱스
    };
  },

  jy(st) {                                       // 점프 높이 (0~1) — 연타 시 airDur이 늘어나 호버
    if (st.jumpT <= 0) return 0;
    const p = 1 - st.jumpT / (st.airDur || JUMP_T);
    return 4 * p * (1 - p);
  },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase !== 'run') { st.endT += dt; return ev; }

    // 시간
    st.time -= dt;
    if (st.time <= 0) {
      st.time = 0;
      st.phase = 'over'; st.endT = 0;
      ev.push({ type: 'over' });
      return ev;
    }

    const stunned = st.stunT > 0;
    if (stunned) {
      st.stunT -= dt;
      // 비틀거림: 경직 동안 옆으로 탁탁탁 밀려남 (점점 잦아듦)
      st.x += st.tumbleDir * TUMBLE_V * (st.stunT / STUN_T) * dt;
      st.x = Math.max(-M.TRACK_W, Math.min(M.TRACK_W, st.x));
    }

    // 속도 (경직 중엔 최저속 고정)
    if (stunned) {
      st.spd = SPD_MIN;
    } else {
      if (input.up) st.spd += ACCEL * dt;
      if (input.down) st.spd -= BRAKE * dt;
      st.spd = Math.max(SPD_MIN, Math.min(st.stage.maxSpd, st.spd));
    }

    // 점프 + 공중 연타 호버 (몸을 파닥여 체공 연장)
    if (input.jump && !stunned) {
      if (st.jumpT <= 0) {
        st.jumpT = JUMP_T; st.airDur = JUMP_T; st.flapN = 0;
        ev.push({ type: 'jump' });
      } else if (st.flapN < FLAP_MAX) {
        st.jumpT += FLAP_ADD; st.airDur += FLAP_ADD;
        st.flapN++; st.flapT = 0.22;
        ev.push({ type: 'flap', n: st.flapN });
      }
    }
    if (st.jumpT > 0) st.jumpT -= dt;
    if (st.flapT > 0) st.flapT -= dt;

    // 조향: 빙판 관성 — 가속으로 횡속도를 만들고, 반대 입력 시 미끄러지며 전환
    const curve = M.curveAt(st.stage, st.dist);
    const dir = stunned ? 0 : (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (st.skidT > 0) st.skidT -= dt;
    if (dir !== 0) {
      if (st.vx * dir < -40 && st.skidT <= 0) {   // 달리던 반대로 꺾음 → 스키드
        st.skidT = 0.3;
        ev.push({ type: 'skid' });
      }
      if (st.vx * dir < 0) st.skidT = Math.max(st.skidT, 0.12);
      st.vx += dir * STEER_ACC * dt;
    } else {
      st.vx -= st.vx * Math.min(1, ICE_DRAG * dt);   // 빙판: 천천히 감쇠
    }
    st.vx = Math.max(-VX_MAX, Math.min(VX_MAX, st.vx));
    st.x += st.vx * dt + curve * st.spd * 0.55 * dt;
    if (st.x <= -M.TRACK_W || st.x >= M.TRACK_W) st.vx = 0;   // 가장자리 눈더미
    st.x = Math.max(-M.TRACK_W, Math.min(M.TRACK_W, st.x));

    // 전진
    const prev = st.dist;
    st.dist += st.spd * dt;

    // 오브젝트 판정 (이번 프레임에 지나친 것들)
    const objs = st.stage.objs;
    for (let i = 0; i < objs.length; i++) {
      if (st.resolved.has(i)) continue;
      const o = objs[i];
      if (o.d > st.dist) break;                 // d 오름차순 정렬 전제
      if (o.d <= prev - HIT_BAND) { st.resolved.add(i); continue; }
      // 통과 판정
      const lateral = Math.abs(o.x - st.x) < o.w + 15;
      const airborne = this.jy(st) > 0.32;
      st.resolved.add(i);
      if (o.type === 'flag') {
        if (lateral) { st.flags++; st.score += 100; ev.push({ type: 'flag', n: st.flags }); }
      } else if (o.type === 'fish') {
        if (lateral && !airborne) { st.fish++; st.score += 300; ev.push({ type: 'fish' }); }
      } else if (o.type === 'crev') {
        if (!airborne) { this._crash(st, ev); }
        else if (o.pop && Math.abs(o.px - st.x) < 34 + 15) {
          // 크레바스에서 튀어나온 바다사자 — 점프해도 정면이면 부딪힘 (측면 회피 필요)
          this._crash(st, ev, true);
        }
      } else {                                   // hole | seal
        if (lateral && !airborne) { this._crash(st, ev); }
      }
    }

    // 도착
    if (st.dist >= st.stage.length) {
      const bonus = Math.round(st.time) * 10;
      st.score += bonus;
      const allFlags = st.flags >= st.stage.flagsTotal;
      st.stars = allFlags && st.crashes === 0 ? 3
        : st.flags >= Math.ceil(st.stage.flagsTotal * 0.7) ? 2 : 1;
      st.phase = 'clear'; st.endT = 0;
      ev.push({ type: 'clear', stars: st.stars, bonus });
    }
    return ev;
  },

  _crash(st, ev, seal) {
    st.crashes++;
    st.stunT = STUN_T;
    st.jumpT = 0; st.airDur = JUMP_T; st.flapN = 0; st.flapT = 0;
    // 비틀거림 방향: 미끄러지던 쪽, 정지 상태면 트랙 안쪽으로
    st.tumbleDir = Math.abs(st.vx) > 20 ? Math.sign(st.vx) : (st.x > 0 ? -1 : 1);
    st.vx = 0;
    ev.push({ type: 'crash', seal: !!seal });
  },
};
