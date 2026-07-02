// logic.js — 물리·AI·규칙 (DOM 무의존 — node 헤드리스 테스트 가능)
const M = window.MGM;

const GRAV = 560, JUMPV = -235, MOVE = 90;
const PUFF_V = 190, PUFF_LIFE = 0.55, FIRE_CD = 0.27;
const FUR_DECAY = 2.6, BALL_LIFE = 7, ROLL_V = 250, BOUNCE_MAX = 4, ROLL_LIFE = 7;

// 적 종별 파라미터
const ETYPES = {
  mouse:     { spd: 34, furMax: 3, w: 14, h: 12, score: 100 },
  fastmouse: { spd: 58, furMax: 3, w: 14, h: 12, score: 150 },
  jumper:    { spd: 30, furMax: 4, w: 14, h: 12, score: 150, hop: true },
  bird:      { spd: 32, furMax: 3, w: 14, h: 11, score: 150, fly: true },
  vacuum:    { spd: 66, furMax: 7, w: 17, h: 10, score: 250 },
};
// 보스 파라미터 (hp = 털 명중 수, 털뭉치 명중은 3 감소)
const BTYPES = {
  kingmouse: { hp: 22, spd: 40, w: 36, h: 30, hopV: -210, minion: 'mouse' },
  crow:      { hp: 26, spd: 55, w: 38, h: 26, fly: true,  minion: 'bird' },
  bigvacuum: { hp: 30, spd: 85, w: 42, h: 22, hopV: -160, minion: 'mouse' },
  shadowcat: { hp: 34, spd: 55, w: 36, h: 32, hopV: -260, minion: 'jumper' },
  mouselord: { hp: 42, spd: 60, w: 40, h: 34, hopV: -230, minion: 'fastmouse' },
};
M.ETYPES = ETYPES; M.BTYPES = BTYPES;

// 엔티티 좌표계: x = 중심, y = 발바닥(하단)
function overlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y > b.y - b.h && a.y - a.h < b.y;
}

function mkEnemy(type, x, y) {
  const P = ETYPES[type];
  return { kind: 'enemy', type, P, x, y, w: P.w, h: P.h,
    vx: 0, vy: 0, dir: x < M.W / 2 ? 1 : -1, onGround: false,
    fur: 0, furT: 0, state: 'walk', stunT: 0, ballT: 0, bounces: 0, chain: 0,
    hopT: 1 + (x % 1.3), flyT: x * 0.1, baseY: y, angry: false, rollLife: 0 };
}

M.mkEnemy = mkEnemy;   // 테스트·보스 소환용

M.Logic = {
  create(stageNo, carry) {
    const stage = M.makeStage(stageNo);
    const st = {
      stage, no: stageNo, phase: 'play', t: 0, clearT: 0, angry: false,
      score: (carry && carry.score) || 0, lives: (carry && carry.lives) || 3,
      player: { kind: 'player', x: M.W / 2, y: M.FLOOR, w: 14, h: 18,
        vx: 0, vy: 0, dir: 1, onGround: false, fireCd: 0, invul: 1.2 },
      puffs: [], items: [], events: [],
      enemies: stage.enemies.map((e) => mkEnemy(e.type, e.x, e.y)),
      boss: null, bossBall: null, spawnT: 0,
    };
    if (stage.boss) {
      const P = BTYPES[stage.boss];
      st.boss = { kind: 'boss', type: stage.boss, P, hp: P.hp, hpMax: P.hp,
        x: M.W * 0.78, y: P.fly ? 90 : M.FLOOR, w: P.w, h: P.h,
        vx: 0, vy: 0, dir: -1, onGround: false, hopT: 2, spawnT: 3, hitT: 0, flyT: 0, baseY: 90 };
    }
    return st;
  },

  step(st, dt, input) {
    const ev = [];
    st.events = ev;
    if (st.phase !== 'play') { st.clearT += dt; return ev; }
    st.t += dt;

    // 분노 타이머
    if (!st.angry && st.t > st.stage.angryAt) {
      st.angry = true;
      for (const e of st.enemies) e.angry = true;
      ev.push({ type: 'angry' });
    }

    const pl = st.player;
    // ── 플레이어 ──
    if (pl.invul > 0) pl.invul -= dt;
    if (pl.fireCd > 0) pl.fireCd -= dt;
    pl.vx = (input.left ? -MOVE : 0) + (input.right ? MOVE : 0);
    if (pl.vx !== 0) pl.dir = pl.vx > 0 ? 1 : -1;
    if (input.jump && pl.onGround) { pl.vy = JUMPV; pl.onGround = false; ev.push({ type: 'jump' }); }
    if (input.fire && pl.fireCd <= 0) {
      pl.fireCd = FIRE_CD;
      st.puffs.push({ x: pl.x + pl.dir * 10, y: pl.y - 6, w: 8, h: 12,
        vx: pl.dir * PUFF_V + pl.vx * 0.3, vy: -14, life: PUFF_LIFE });
      ev.push({ type: 'shoot' });
    }
    this._move(st, pl, dt);

    // ── 털 탄환 ──
    for (const pf of st.puffs) {
      pf.life -= dt;
      pf.vy += GRAV * 0.1 * dt;
      pf.x += pf.vx * dt; pf.y += pf.vy * dt;
      if (pf.x < M.WALL + 3 || pf.x > M.W - M.WALL - 3) pf.life = 0;
      if (pf.life <= 0) continue;
      // 적 명중
      for (const e of st.enemies) {
        if (e.state === 'roll' || e.state === 'ball') continue;
        if (overlap(pf, e)) {
          pf.life = 0;
          e.fur++; e.furT = 0; e.state = 'stun'; e.stunT = 0.55; e.vx = 0;
          if (e.P.fly) e.grounded = true;                    // 새는 털 맞으면 추락
          if (e.fur >= e.P.furMax) { e.state = 'ball'; e.ballT = 0; e.w = 22; e.h = 22; ev.push({ type: 'ball' }); }
          else ev.push({ type: 'fur' });
          break;
        }
      }
      // 보스 명중
      const b = st.boss;
      if (pf.life > 0 && b && overlap(pf, b)) {
        pf.life = 0;
        this._hitBoss(st, 1, ev);
      }
    }
    st.puffs = st.puffs.filter((p) => p.life > 0);

    // ── 적 ──
    for (const e of st.enemies) {
      const spd = e.P.spd * (e.angry ? 1.55 : 1);
      if (e.state === 'walk') {
        if (e.P.fly && !e.grounded) {
          // 비행: 좌우 왕복 + 사인 상하
          e.flyT += dt;
          if (e.vx === 0) e.vx = e.dir * spd;
          e.x += e.vx * dt;
          if (e.x < M.WALL + e.w / 2) { e.x = M.WALL + e.w / 2; e.vx = Math.abs(e.vx); e.dir = 1; }
          if (e.x > M.W - M.WALL - e.w / 2) { e.x = M.W - M.WALL - e.w / 2; e.vx = -Math.abs(e.vx); e.dir = -1; }
          e.y = Math.max(40, Math.min(M.FLOOR - 6, e.baseY - 25 + Math.sin(e.flyT * 2.1) * 22));
        } else {
          // 보행: 벽·모서리에서 방향 전환, 점프형은 주기 도약
          if (e.P.hop) {
            e.hopT -= dt;
            if (e.hopT <= 0 && e.onGround) { e.vy = -195; e.onGround = false; e.hopT = 1.3 + (e.x % 1.1); }
          }
          e.vx = e.dir * spd;
          const preX = e.x;
          this._move(st, e, dt);
          if (e.x === preX && e.onGround) e.dir *= -1;       // 벽에 막힘
          else if (e.onGround && !e.P.hop && this._edgeAhead(st, e)) e.dir *= -1;
        }
      } else if (e.state === 'stun') {
        e.stunT -= dt;
        this._move(st, e, dt, true);
        if (e.stunT <= 0) e.state = e.fur > 0 ? 'stun2' : 'walk';
      } else if (e.state === 'stun2') {
        // 부분 감김: 정지·버둥, 시간 지나면 풀림
        e.furT += dt;
        this._move(st, e, dt, true);
        if (e.furT > FUR_DECAY) {
          e.fur--; e.furT = 0;
          if (e.fur <= 0) { e.state = 'walk'; ev.push({ type: 'unfur' }); }
        }
      } else if (e.state === 'ball') {
        e.ballT += dt;
        this._move(st, e, dt, true);
        // 플레이어가 밀면 굴러감
        if (overlap(st.player, e)) {
          e.state = 'roll'; e.rollLife = 0; e.bounces = 0; e.chain = 0;
          e.rollDir = st.player.x < e.x ? 1 : -1;
          ev.push({ type: 'kick' });
        } else if (e.ballT > BALL_LIFE) {
          e.state = 'walk'; e.fur = 0; e.w = e.P.w; e.h = e.P.h; e.angry = true;
          ev.push({ type: 'unball' });
        }
      } else if (e.state === 'roll') {
        e.rollLife += dt;
        e.vx = e.rollDir * ROLL_V;
        e.vy += GRAV * dt;
        e.x += e.vx * dt;
        this._vcollide(st, e, dt);
        if (e.x < M.WALL + e.w / 2) { e.x = M.WALL + e.w / 2; e.rollDir = 1; e.bounces++; ev.push({ type: 'bounce' }); }
        if (e.x > M.W - M.WALL - e.w / 2) { e.x = M.W - M.WALL - e.w / 2; e.rollDir = -1; e.bounces++; ev.push({ type: 'bounce' }); }
        // 연쇄 킬
        for (const o of st.enemies) {
          if (o === e || o.state === 'roll' || o.state === 'dead') continue;
          if (overlap(e, o)) {
            o.state = 'dead';
            e.chain++;
            const pts = 500 * e.chain;
            st.score += pts;
            this._drop(st, o.x, o.y, e.chain);
            ev.push({ type: 'kill', x: o.x, y: o.y, pts });
          }
        }
        if (st.boss && overlap(e, st.boss)) {
          e.state = 'dead';
          this._hitBoss(st, 3, ev);
        }
        if (e.bounces > BOUNCE_MAX || e.rollLife > ROLL_LIFE) { e.state = 'dead'; ev.push({ type: 'ballpop', x: e.x, y: e.y }); }
      }
      // 플레이어 피격 (맨몸 보행 적만 위험)
      if (e.state === 'walk' && e.fur === 0 && pl.invul <= 0 && overlap(pl, e)) this._hurt(st, ev);
    }
    st.enemies = st.enemies.filter((e) => e.state !== 'dead');

    // ── 보스 ──
    const b = st.boss;
    if (b) {
      if (b.hitT > 0) b.hitT -= dt;
      if (b.P.fly) {
        b.flyT += dt;
        b.x += Math.sign(pl.x - b.x) * b.P.spd * dt * 0.7;
        b.x = Math.max(M.WALL + b.w / 2, Math.min(M.W - M.WALL - b.w / 2, b.x));
        b.y = 90 + Math.sin(b.flyT * 1.6) * 34;
        b.dir = pl.x < b.x ? -1 : 1;
      } else {
        b.hopT -= dt;
        b.dir = pl.x < b.x ? -1 : 1;
        b.vx = b.dir * b.P.spd * (b.onGround ? 1 : 1.15);
        if (b.hopT <= 0 && b.onGround) { b.vy = b.P.hopV; b.onGround = false; b.hopT = 1.6 + Math.abs(Math.sin(st.t)) * 1.2; }
        this._move(st, b, dt);
      }
      // 부하 소환 (최대 3)
      b.spawnT -= dt;
      if (b.spawnT <= 0 && st.enemies.length < 3) {
        b.spawnT = 5.5;
        st.enemies.push(mkEnemy(b.P.minion, b.x, Math.min(b.y, M.FLOOR)));
        ev.push({ type: 'spawn' });
      }
      if (pl.invul <= 0 && overlap(pl, b)) this._hurt(st, ev);
    }
    // 보스 사망 연출: 거대 털뭉치가 굴러 나감
    if (st.bossBall) {
      st.bossBall.t += dt;
      st.bossBall.x += st.bossBall.vx * dt;
      if (st.bossBall.t > 1.4) { st.bossBall = null; }
    }

    // ── 아이템 ──
    for (const it of st.items) {
      it.ttl -= dt;
      it.vy += GRAV * dt;
      it.y += it.vy * dt;
      if (it.y >= M.FLOOR) { it.y = M.FLOOR; it.vy = 0; }
      else {
        for (const p of st.stage.platforms) {
          if (it.vy > 0 && it.y >= p.y && it.y - it.vy * dt <= p.y && it.x > p.x - 3 && it.x < p.x + p.w + 3) { it.y = p.y; it.vy = 0; }
        }
      }
      if (overlap(pl, it)) {
        it.ttl = 0;
        if (it.kind === 'fish') { st.lives = Math.min(5, st.lives + 1); ev.push({ type: 'fish' }); }
        else { st.score += 500; ev.push({ type: 'item', pts: 500 }); }
      }
    }
    st.items = st.items.filter((i) => i.ttl > 0);

    // ── 클리어 판정 ──
    if (!st.boss && !st.bossBall && st.enemies.length === 0 && st.phase === 'play') {
      st.phase = 'clear'; st.clearT = 0;
      ev.push({ type: 'clear' });
    }
    return ev;
  },

  // 중력 + 벽 클램프 + 한 방향 플랫폼/바닥 착지 (still=true면 수평 이동 없음)
  _move(st, en, dt, still) {
    if (!still) en.x += en.vx * dt;
    en.x = Math.max(M.WALL + en.w / 2, Math.min(M.W - M.WALL - en.w / 2, en.x));
    this._vcollide(st, en, dt);
  },
  _vcollide(st, en, dt) {
    const prevY = en.y;
    en.vy += GRAV * dt;
    en.y += en.vy * dt;
    en.onGround = false;
    if (en.vy > 0) {
      for (const p of st.stage.platforms) {
        if (prevY <= p.y && en.y >= p.y && en.x > p.x - 4 && en.x < p.x + p.w + 4) {
          en.y = p.y; en.vy = 0; en.onGround = true;
          return;
        }
      }
      if (en.y >= M.FLOOR) { en.y = M.FLOOR; en.vy = 0; en.onGround = true; }
    }
  },
  // 진행 방향 모서리 검사 (보행 적 방향 전환용)
  _edgeAhead(st, e) {
    if (e.y >= M.FLOOR) return false;
    const ax = e.x + e.dir * (e.w / 2 + 3);
    return !st.stage.platforms.some((p) => Math.abs(e.y - p.y) < 2 && ax > p.x - 2 && ax < p.x + p.w + 2);
  },
  _drop(st, x, y, chain) {
    const kind = (chain >= 3 || M.mulberry32((x * 31 + y * 17) | 0)() < 0.08) && chain >= 2 ? 'fish' : 'chur';
    st.items.push({ x, y: Math.min(y, M.FLOOR) - 4, w: 10, h: 10, vy: -130, kind, ttl: 9 });
  },
  _hitBoss(st, dmg, ev) {
    const b = st.boss;
    b.hp -= dmg; b.hitT = 0.18;
    ev.push({ type: 'bosshit', hp: b.hp });
    if (b.hp <= 0) {
      st.score += 5000;
      st.bossBall = { x: b.x, y: b.y, vx: (b.dir || 1) * -220, t: 0, r: b.w * 0.7 };
      st.boss = null;
      for (const e of st.enemies) e.state = 'dead';   // 부하 일소
      st.enemies = [];
      ev.push({ type: 'bossdead' });
    }
  },
  _hurt(st, ev) {
    st.lives--;
    ev.push({ type: 'hurt', lives: st.lives });
    if (st.lives <= 0) { st.phase = 'over'; st.clearT = 0; ev.push({ type: 'gameover' }); return; }
    const pl = st.player;
    pl.x = M.W / 2; pl.y = M.FLOOR; pl.vx = 0; pl.vy = 0; pl.invul = 2.5;
  },
};
