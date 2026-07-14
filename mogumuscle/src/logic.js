// logic.js — 태그매치 레슬링: 이동·로프 반동·타격·잡기·파워볼·태그·판정 (DOM 무의존)
const M = window.MMS;

const WALK_P = 120;              // 플레이어 이동 속도
const RUN = 260;                 // 로프 반동 대시 속도
const RUN_T = 1.5;               // 대시 최대 지속
const PUNCH_RANGE = 30, PUNCH_DMG = 8;
const THROW_RANGE = 24, THROW_DMG = 18;
const LARIAT_RANGE = 36, LARIAT_DMG = 24;
const SPECIAL_DMG = 44;          // 파워볼 필살기 (머슬 드라이버)
const STUN_T = 0.4;              // 펀치 피격 경직
const DOWN_T = 1.5;              // 다운 지속
const INV_T = 0.8;               // 기상 후 무적
const TAG_RANGE = 38;            // 자기 코너 태그 판정
const REST_HEAL = 4;             // 휴식(비활성) 초당 회복
const BALL_LIFE = 7;             // 파워볼 유지 시간
const BALL_PICK = 20;            // 파워볼 획득 반경

const C = { PUNCH_RANGE, PUNCH_DMG, THROW_RANGE, THROW_DMG, LARIAT_RANGE, LARIAT_DMG, SPECIAL_DMG, DOWN_T, INV_T, TAG_RANGE, REST_HEAL, BALL_LIFE, RUN };

M.Logic = {
  C,
  create(no) {
    const stage = M.makeStage(no);
    const pC = { x: -M.RING_X + 14, z: M.RING_Z - 10 };    // 아군 코너 (좌하)
    const eC = { x: M.RING_X - 14, z: -M.RING_Z + 10 };    // 적 코너 (우상)
    const mk = (name, kind, x, z, hp, atk, spd) => ({
      name, kind, x, z, face: 1,
      hp, maxHp: hp, atk, spd,
      state: 'idle',                                       // idle|walk|run|atk|down|ko
      atkT: 0, cd: 0, stunT: 0, downT: 0, invT: 0,
      runVx: 0, runVz: 0, runT: 0, aiT: 0,
      powered: false,
    });
    const T = stage.team;
    return {
      stage, no, phase: 'fight', t: 0, endT: 0,            // fight | clear | over
      time: stage.time,
      pC, eC,
      players: [
        mk('모구', 'mogu', pC.x + 34, pC.z - 14, 130, 1.0, WALK_P),
        mk('꼬꼬', 'kko', pC.x, pC.z, 110, 1.15, WALK_P - 8),
      ],
      enemies: [
        mk(T.a.name, 'mouseA', eC.x - 34, eC.z + 14, stage.hp, stage.atk, stage.spd),
        mk(T.b.name, 'mouseB', eC.x, eC.z, stage.hp, stage.atk, stage.spd),
      ],
      pi: 0, ei: 0,                                        // 활성 레슬러 인덱스
      tagCd: 0, etagCd: 0,
      ball: null, ballT: stage.ballInt, ballTarget: false,
      score: 0, pDowns: 0, stars: 0,
      rng: M.makeRng(stage.seed),
    };
  },

  active(st, team) { return team === 'p' ? st.players[st.pi] : st.enemies[st.ei]; },
  alive(w) { return w.state !== 'ko'; },
  hittable(w) { return w.state !== 'down' && w.state !== 'ko' && w.invT <= 0; },
  canAct(w) { return w.state !== 'down' && w.state !== 'ko' && w.stunT <= 0 && w.atkT <= 0; },
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); },
  teamHpPct(ws) { return (ws[0].hp + ws[1].hp) / (ws[0].maxHp + ws[1].maxHp); },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase !== 'fight') { st.endT += dt; return ev; }

    // 경기 시간 → 초과 시 남은 체력 비율 판정
    st.time -= dt;
    if (st.time <= 0) {
      st.time = 0;
      if (this.teamHpPct(st.players) > this.teamHpPct(st.enemies)) this._win(st, ev, true);
      else { st.phase = 'over'; st.endT = 0; ev.push({ type: 'over', judge: true }); }
      return ev;
    }

    // 타이머·상태 전이 + 휴식 회복
    for (const w of [...st.players, ...st.enemies]) {
      w.cd = Math.max(0, w.cd - dt);
      w.stunT = Math.max(0, w.stunT - dt);
      w.invT = Math.max(0, w.invT - dt);
      if (w.atkT > 0) { w.atkT -= dt; if (w.atkT <= 0 && w.state === 'atk') w.state = 'idle'; }
      if (w.state === 'down') {
        w.downT -= dt;
        if (w.downT <= 0) { w.state = 'idle'; w.invT = INV_T; }
      }
    }
    for (const [ws, ai] of [[st.players, st.pi], [st.enemies, st.ei]]) {
      const rest = ws[1 - ai];
      if (this.alive(rest) && rest.state !== 'down') rest.hp = Math.min(rest.maxHp, rest.hp + REST_HEAL * dt);
    }
    st.tagCd = Math.max(0, st.tagCd - dt);
    st.etagCd = Math.max(0, st.etagCd - dt);

    const P = st.players[st.pi], E = st.enemies[st.ei];

    // ── 파워볼 (생명의 구슬 오마주) ──
    if (!st.ball) {
      st.ballT -= dt;
      if (st.ballT <= 0) {
        st.ball = { x: st.rng.range(-M.RING_X * 0.7, M.RING_X * 0.7), z: st.rng.range(-M.RING_Z * 0.7, M.RING_Z * 0.7), t: BALL_LIFE };
        st.ballT = st.stage.ballInt + st.rng.range(0, 3);
        st.ballTarget = st.rng.chance(st.stage.aggr * 0.7);   // 적이 파워볼을 노릴지
        ev.push({ type: 'ball' });
      }
    } else {
      st.ball.t -= dt;
      if (st.ball.t <= 0) st.ball = null;
      else {
        for (const [w, team] of [[P, 'p'], [E, 'e']]) {
          if (this.canAct(w) && this.dist(w, st.ball) < BALL_PICK) {
            w.powered = true; st.ball = null;
            ev.push({ type: 'powered', team });
            break;
          }
        }
      }
    }

    // ── 플레이어 조작 ──
    if (this.canAct(P)) {
      P.face = E.x >= P.x ? 1 : -1;
      if (P.state === 'run') {
        P.x += P.runVx * dt; P.z += P.runVz * dt;
        P.runT -= dt;
        if (P.runT <= 0 || Math.abs(P.x) >= M.RING_X || Math.abs(P.z) >= M.RING_Z) P.state = 'idle';
      } else {
        const dx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
        const dz = (input.up ? -1 : 0) + (input.down ? 1 : 0);
        // 로프 반동: 로프에 붙은 채 계속 밀면 반대편으로 대시
        if (dx === -1 && P.x <= -M.RING_X) this._bounce(P, RUN, 0, ev);
        else if (dx === 1 && P.x >= M.RING_X) this._bounce(P, -RUN, 0, ev);
        else if (dz === -1 && P.z <= -M.RING_Z) this._bounce(P, 0, RUN, ev);
        else if (dz === 1 && P.z >= M.RING_Z) this._bounce(P, 0, -RUN, ev);
        else {
          const n = dx && dz ? Math.SQRT1_2 : 1;
          P.x += dx * P.spd * n * dt;
          P.z += dz * P.spd * n * dt;
          P.state = dx || dz ? 'walk' : 'idle';
        }
      }
      // 공격: 대시 중 = 라리아트 / 근접 = 잡아 던지기 / 그 외 = 펀치
      if (input.atk && P.cd <= 0) this._attack(st, P, E, 'p', ev);
      // 태그: 자기 코너 근처에서
      if (input.tag && st.tagCd <= 0 && this.alive(st.players[1 - st.pi]) &&
          this.dist(P, st.pC) < TAG_RANGE) {
        this._tag(st, 'p', ev);
      }
    }
    P.x = Math.max(-M.RING_X, Math.min(M.RING_X, P.x));
    P.z = Math.max(-M.RING_Z, Math.min(M.RING_Z, P.z));

    // ── 적 AI ──
    if (this.canAct(E) && st.phase === 'fight') {
      E.face = P.x >= E.x ? 1 : -1;
      E.aiT += dt;
      const aggr = st.stage.aggr;
      const d = this.dist(E, P);
      if (E.state === 'run') {
        E.x += E.runVx * dt; E.z += E.runVz * dt;
        E.runT -= dt;
        // 대시 중 스치면 자동 라리아트
        if (d < LARIAT_RANGE && this.hittable(P)) {
          this._hit(st, E, P, LARIAT_DMG, true, 'lariat', ev);
          E.state = 'idle'; E.cd = 0.6;
        } else if (E.runT <= 0 || Math.abs(E.x) >= M.RING_X || Math.abs(E.z) >= M.RING_Z) {
          E.state = 'idle';
        }
      } else {
        const partner = st.enemies[1 - st.ei];
        let tx = P.x, tz = P.z;
        let wantTag = false;
        if (E.hp < E.maxHp * 0.3 && this.alive(partner) && partner.hp > E.hp && st.etagCd <= 0) {
          tx = st.eC.x; tz = st.eC.z; wantTag = true;      // 코너로 후퇴해 태그
        } else if (st.ball && st.ballTarget) {
          tx = st.ball.x; tz = st.ball.z;                  // 파워볼 노리기
        }
        const ddx = tx - E.x, ddz = tz - E.z, dd = Math.hypot(ddx, ddz) || 1;
        E.x += (ddx / dd) * E.spd * dt;
        E.z += (ddz / dd) * E.spd * dt;
        E.state = dd > 4 ? 'walk' : 'idle';
        if (wantTag && this.dist(E, st.eC) < TAG_RANGE) this._tag(st, 'e', ev);
        // 공격 판단 (공격성에 따른 빈도)
        const aiCd = 1.25 - aggr * 0.85;
        if (!wantTag && E.aiT >= aiCd && E.cd <= 0) {
          E.aiT = 0;
          if (d < THROW_RANGE + 4) this._attack(st, E, P, 'e', ev);
          else if (d < PUNCH_RANGE + 8) this._attack(st, E, P, 'e', ev);
          else if (d > 110 && st.rng.chance(aggr * 0.5)) {
            // 원거리 대시 라리아트
            const dvx = (P.x - E.x) / d, dvz = (P.z - E.z) / d;
            E.state = 'run'; E.runVx = dvx * RUN; E.runVz = dvz * RUN; E.runT = RUN_T;
            ev.push({ type: 'edash' });
          }
        }
      }
    }
    E.x = Math.max(-M.RING_X, Math.min(M.RING_X, E.x));
    E.z = Math.max(-M.RING_Z, Math.min(M.RING_Z, E.z));

    return ev;
  },

  _bounce(w, vx, vz, ev) {
    w.state = 'run'; w.runVx = vx; w.runVz = vz; w.runT = RUN_T;
    ev.push({ type: 'bounce' });
  },

  _tag(st, team, ev) {
    if (team === 'p') {
      st.pi = 1 - st.pi;
      const inW = st.players[st.pi];
      inW.x = st.pC.x; inW.z = st.pC.z; inW.state = 'idle'; inW.invT = 0.5;
      st.tagCd = 1.2;
      ev.push({ type: 'tag', name: inW.name });
    } else {
      st.ei = 1 - st.ei;
      const inW = st.enemies[st.ei];
      inW.x = st.eC.x; inW.z = st.eC.z; inW.state = 'idle'; inW.invT = 0.5;
      st.etagCd = 6;
      ev.push({ type: 'etag', name: inW.name });
    }
  },

  _attack(st, att, def, team, ev) {
    const d = this.dist(att, def);
    if (att.state === 'run') {                             // 대시 라리아트
      att.state = 'idle'; att.cd = 0.55;
      if (this.hittable(def) && d < LARIAT_RANGE) this._hit(st, att, def, LARIAT_DMG, true, 'lariat', ev);
      else ev.push({ type: 'swing' });
    } else if (this.hittable(def) && d < THROW_RANGE) {    // 잡아 던지기 (바디슬램)
      att.state = 'atk'; att.atkT = 0.35; att.cd = 0.7;
      this._hit(st, att, def, THROW_DMG, true, 'throw', ev);
      def.x = Math.max(-M.RING_X, Math.min(M.RING_X, def.x + att.face * 30));
    } else {                                               // 펀치
      att.state = 'atk'; att.atkT = 0.28; att.cd = 0.42;
      if (this.hittable(def) && d < PUNCH_RANGE) this._hit(st, att, def, PUNCH_DMG, false, 'punch', ev);
      else ev.push({ type: 'swing' });
    }
  },

  _hit(st, att, def, base, kd, kind, ev) {
    let amount = Math.round(base * att.atk);
    let special = false;
    if (att.powered) {                                     // 파워볼 필살기: 머슬 드라이버
      amount = Math.round(SPECIAL_DMG * att.atk);
      kd = true; special = true;
      att.powered = false;
    }
    def.hp = Math.max(0, def.hp - amount);
    const isPlayerAtt = st.players.includes(att);
    if (isPlayerAtt) st.score += amount * 10;
    ev.push({ type: special ? 'special' : kind, x: def.x, z: def.z, amount });
    if (kd || def.hp <= 0) {
      def.state = 'down'; def.downT = DOWN_T; def.stunT = 0; def.atkT = 0;
      if (st.players.includes(def)) st.pDowns++;
      ev.push({ type: 'kd' });
    } else {
      def.stunT = Math.max(def.stunT, STUN_T);
    }
    if (def.hp <= 0) this._ko(st, def, ev);
  },

  _ko(st, w, ev) {
    w.state = 'ko';
    ev.push({ type: 'ko', name: w.name });
    if (st.enemies.includes(w)) {
      const other = st.enemies[1 - st.enemies.indexOf(w)];
      if (this.alive(other)) {
        st.ei = st.enemies.indexOf(other);
        other.x = st.eC.x; other.z = st.eC.z; other.invT = 0.8;
        ev.push({ type: 'enter', name: other.name });
      } else {
        this._win(st, ev, false);
      }
    } else {
      const other = st.players[1 - st.players.indexOf(w)];
      if (this.alive(other)) {
        st.pi = st.players.indexOf(other);
        other.x = st.pC.x; other.z = st.pC.z; other.invT = 0.8;
        ev.push({ type: 'penter', name: other.name });
      } else {
        st.phase = 'over'; st.endT = 0;
        ev.push({ type: 'over' });
      }
    }
  },

  _win(st, ev, judge) {
    const pct = this.teamHpPct(st.players);
    st.stars = judge ? 1
      : st.pDowns === 0 && pct >= 0.7 ? 3
      : st.pDowns === 0 ? 2 : 1;
    st.score += Math.round(st.time) * 10 + Math.round(pct * 1000);
    st.phase = 'clear'; st.endT = 0;
    ev.push({ type: 'clear', stars: st.stars, judge: !!judge });
  },
};
