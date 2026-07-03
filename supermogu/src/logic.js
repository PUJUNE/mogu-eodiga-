// logic.js — 플랫포머 물리·판정 (DOM 무의존): 타일 충돌·밟기·파워업·보스
const M = window.SMG;

const GRAV = 900, GRAV_HOLD = 520;   // 점프 홀드 중 중력 감소 (가변 점프)
const JUMP_V = -252;
const RUN_ACC = 420, RUN_MAX = 96, DASH_MAX = 150, FRICTION = 480;
const STOMP_V = -180;
const TL = 16;

M.Logic = {
  create(no) {
    const stage = M.makeStage(no);
    const st = {
      stage, no, phase: 'play', t: 0, endT: 0,   // play | clear | over
      p: {
        x: 3 * TL, y: (stage.gndY - 1) * TL - 2, vx: 0, vy: 0,
        w: 11, h: 14, face: 1, onG: false,
        size: 0,                                  // 0 꼬마 / 1 슈퍼 / 2 캣닢
        inv: 0, star: 0, dead: false, jumpHeld: false,
        shotCd: 0, hits: 0,
      },
      enemies: stage.enemies.map((e, i) => ({
        id: i, type: e.type,
        x: e.tx * TL + 2, y: e.ty * TL + (e.type === 'bird' ? -40 : 2),
        vx: e.type === 'bird' ? -34 : -26, vy: 0,
        w: 12, h: e.type === 'bird' ? 11 : 13,
        alive: true, squashT: 0, shell: false, sliding: false,
        baseY: e.ty * TL - 40, phase: i * 1.7,
        active: false,
      })),
      items: [], shots: [], pops: [],             // 파워업·털뭉치·코인팝
      coins: 0, score: 0, time: stage.time,
      boss: stage.castle ? {
        x: stage.bossX, y: (stage.gndY - 3) * TL, vx: 0, vy: 0,
        w: 26, h: 30, hp: 3, alive: true, active: false, iv: 0, jumpCd: 1,
      } : null,
      usedQ: new Set(),
    };
    return st;
  },

  tile(st, tx, ty) {
    if (tx < 0 || tx >= st.stage.len) return M.T.BLOCK;
    if (ty < 0) return M.T.AIR;
    if (ty >= M.ROWS) return M.T.AIR;
    return st.stage.g[tx][ty];
  },
  solid(v) { return v === M.T.GND || v === M.T.BRICK || v === M.T.Q || v === M.T.USED || v === M.T.PIPE || v === M.T.PIPE_T || v === M.T.BLOCK || v === M.T.CASTLE; },

  // AABB 타일 이동 (축 분리). 반환: {hitX, hitY, headTile}
  moveBody(st, b, dt) {
    const res = { hitX: false, hitY: false, head: null };
    // X축
    let nx = b.x + b.vx * dt;
    const dirX = Math.sign(b.vx);
    if (dirX !== 0) {
      const edge = dirX > 0 ? nx + b.w : nx;
      const tx = Math.floor(edge / TL);
      for (let ty = Math.floor(b.y / TL); ty <= Math.floor((b.y + b.h - 1) / TL); ty++) {
        if (this.solid(this.tile(st, tx, ty))) {
          nx = dirX > 0 ? tx * TL - b.w - 0.01 : (tx + 1) * TL + 0.01;
          res.hitX = true;
          break;
        }
      }
    }
    b.x = nx;
    // Y축
    let ny = b.y + b.vy * dt;
    const dirY = Math.sign(b.vy);
    b.onG = false;
    if (dirY !== 0) {
      const edge = dirY > 0 ? ny + b.h : ny;
      const ty = Math.floor(edge / TL);
      for (let tx = Math.floor(b.x / TL); tx <= Math.floor((b.x + b.w - 1) / TL); tx++) {
        const v = this.tile(st, tx, ty);
        if (this.solid(v)) {
          if (dirY > 0) { ny = ty * TL - b.h - 0.01; b.onG = true; }
          else { ny = (ty + 1) * TL + 0.01; res.head = { tx, ty, v }; }
          b.vy = 0;
          res.hitY = true;
          break;
        }
      }
    }
    b.y = ny;
    return res;
  },

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },

  _setSize(st, size) {
    const p = st.p;
    const oldH = p.h;
    p.size = size;
    p.h = size > 0 ? 24 : 14;
    p.y -= p.h - oldH;
  },

  _hurt(st, ev) {
    const p = st.p;
    if (p.inv > 0 || p.star > 0) return;
    p.hits++;
    if (p.size > 0) {
      this._setSize(st, p.size - 1);
      p.inv = 2;
      ev.push({ type: 'shrink' });
    } else {
      this._die(st, ev);
    }
  },

  _die(st, ev) {
    if (st.p.dead) return;
    st.p.dead = true;
    st.p.vy = -260;
    st.phase = 'over'; st.endT = 0;
    ev.push({ type: 'die' });
  },

  _clear(st, ev, flagBonus) {
    st.score += Math.round(st.time) * 10 + flagBonus;
    const coinOk = st.coins >= Math.ceil(st.stage.coinTotal * 0.6);
    st.stars = coinOk && st.p.hits === 0 ? 3 : coinOk ? 2 : 1;
    st.phase = 'clear'; st.endT = 0;
    ev.push({ type: 'clear', stars: st.stars, bonus: flagBonus });
  },

  _bumpBlock(st, tx, ty, v, ev) {
    const T = M.T;
    const p = st.p;
    if (v === T.Q) {
      const key = tx + ',' + ty;
      if (st.usedQ.has(key)) return;
      st.usedQ.add(key);
      st.stage.g[tx][ty] = T.USED;
      const kind = st.stage.qContents[key] || 'coin';
      if (kind === 'coin') {
        st.coins++; st.score += 200;
        st.pops.push({ x: tx * TL + 8, y: ty * TL, t: 0 });
        ev.push({ type: 'coin', n: st.coins });
      } else if (kind === 'power') {
        const it = p.size === 0 ? 'chur' : 'catnip';
        st.items.push({ kind: it, x: tx * TL + 2, y: (ty - 1) * TL + 2, vx: 28, vy: 0, w: 12, h: 12 });
        ev.push({ type: 'sprout', kind: it });
      } else {
        st.items.push({ kind: 'star', x: tx * TL + 2, y: (ty - 1) * TL + 2, vx: 40, vy: 0, w: 12, h: 12 });
        ev.push({ type: 'sprout', kind: 'star' });
      }
    } else if (v === T.BRICK) {
      if (p.size > 0) {
        st.stage.g[tx][ty] = T.AIR;
        st.score += 50;
        ev.push({ type: 'break', tx, ty });
      } else {
        ev.push({ type: 'bump' });
      }
    }
  },

  step(st, dt, input) {
    const ev = [];
    st.t += dt;
    if (st.phase !== 'play') {
      st.endT += dt;
      if (st.phase === 'over' && st.p.dead) { st.p.vy += GRAV * dt; st.p.y += st.p.vy * dt; }
      return ev;
    }

    const p = st.p;
    // 시간
    st.time -= dt;
    if (st.time <= 0) { st.time = 0; this._die(st, ev); return ev; }
    if (p.inv > 0) p.inv -= dt;
    if (p.star > 0) p.star -= dt;
    if (p.shotCd > 0) p.shotCd -= dt;

    // ── 이동 ──
    const maxV = input.dash ? DASH_MAX : RUN_MAX;
    if (input.left) { p.vx -= RUN_ACC * dt; p.face = -1; }
    else if (input.right) { p.vx += RUN_ACC * dt; p.face = 1; }
    else {
      const f = FRICTION * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    p.vx = Math.max(-maxV, Math.min(maxV, p.vx));

    // ── 점프 (가변 높이) ──
    if (input.jump && p.onG) {
      p.vy = JUMP_V - Math.abs(p.vx) * 0.25;
      p.jumpHeld = true;
      ev.push({ type: 'jump' });
    }
    if (!input.jumpHold) p.jumpHeld = false;
    p.vy += (p.jumpHeld && p.vy < 0 ? GRAV_HOLD : GRAV) * dt;
    p.vy = Math.min(p.vy, 300);

    const wasFalling = p.vy > 40;
    const mv = this.moveBody(st, p, dt);
    if (mv.head) this._bumpBlock(st, mv.head.tx, mv.head.ty, mv.head.v, ev);

    // 용암·낙사
    const footTile = this.tile(st, Math.floor((p.x + p.w / 2) / TL), Math.floor((p.y + p.h) / TL));
    if (footTile === M.T.LAVA || p.y > M.ROWS * TL + 24) { this._die(st, ev); return ev; }

    // ── 털뭉치 발사 (캣닢) ──
    if (input.fire && p.size === 2 && p.shotCd <= 0 && st.shots.length < 2) {
      p.shotCd = 0.35;
      st.shots.push({ x: p.x + (p.face > 0 ? p.w : -6), y: p.y + 6, vx: p.face * 210, vy: 0, w: 7, h: 7 });
      ev.push({ type: 'shoot' });
    }
    for (const sh of st.shots) {
      sh.vy += 620 * dt;
      const r = this.moveBody(st, sh, dt);
      if (sh.onG) sh.vy = -92;   // 낮은 바운스 — 쥐(13px)를 스치듯 맞힘
      if (r.hitX) sh.dead = true;
    }
    st.shots = st.shots.filter((sh) => !sh.dead && Math.abs(sh.x - p.x) < 300);

    // ── 아이템 ──
    for (const it of st.items) {
      it.vy += 520 * dt;
      const r = this.moveBody(st, it, dt);
      if (r.hitX) it.vx = -it.vx;
      if (this.overlap(p, it)) {
        it.dead = true;
        if (it.kind === 'chur') { if (p.size === 0) this._setSize(st, 1); st.score += 1000; ev.push({ type: 'grow' }); }
        else if (it.kind === 'catnip') { this._setSize(st, Math.min(2, p.size + 1) || 1); if (p.size < 1) this._setSize(st, 1); st.score += 1000; ev.push({ type: 'grow' }); }
        else { p.star = 8; st.score += 1000; ev.push({ type: 'starman' }); }
      }
    }
    st.items = st.items.filter((it) => !it.dead && it.y < M.ROWS * TL + 40);

    // ── 악당 ──
    const camL = p.x - 260;
    for (const e of st.enemies) {
      if (!e.alive) continue;
      if (!e.active) {
        if (e.x < p.x + 280) e.active = true;
        else continue;
      }
      if (e.squashT > 0) { e.squashT -= dt; if (e.squashT <= 0) e.alive = false; continue; }

      if (e.type === 'bird') {
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(st.t * 2.2 + e.phase) * 26;
      } else {
        if (e.shell && !e.sliding) { /* 웅크림 정지 */ }
        else {
          e.vy += GRAV * dt;
          const r = this.moveBody(st, e, dt);
          if (r.hitX) e.vx = -e.vx;
        }
      }
      if (e.x < camL - 60) { e.alive = false; continue; }

      // 셸 슬라이드가 다른 적 처치
      if (e.sliding) {
        for (const o of st.enemies) {
          if (o !== e && o.alive && o.squashT <= 0 && this.overlap(e, o)) {
            o.alive = false;
            st.score += 200;
            ev.push({ type: 'shellhit' });
          }
        }
      }

      // 털뭉치 명중
      for (const sh of st.shots) {
        if (!sh.dead && this.overlap(sh, e)) {
          sh.dead = true; e.alive = false;
          st.score += 200;
          ev.push({ type: 'kill', how: 'shot' });
        }
      }
      if (!e.alive) continue;

      // 플레이어 접촉
      if (this.overlap(p, e)) {
        if (p.star > 0) {
          e.alive = false; st.score += 200; ev.push({ type: 'kill', how: 'star' });
        } else if (wasFalling && p.y + p.h < e.y + e.h * 0.65) {
          // 밟기
          p.vy = STOMP_V; p.y = e.y - p.h - 1;
          if (e.type === 'hedge') {
            if (!e.shell) { e.shell = true; e.sliding = false; e.vx = 0; ev.push({ type: 'stomp', shell: true }); }
            else { e.sliding = false; e.vx = 0; ev.push({ type: 'stomp', shell: true }); }
            st.score += 100;
          } else {
            e.squashT = 0.5;
            st.score += 100;
            ev.push({ type: 'stomp' });
          }
        } else if (e.shell && !e.sliding) {
          // 웅크린 셸 차기
          e.sliding = true;
          e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? 190 : -190;
          st.score += 100;
          ev.push({ type: 'kick' });
        } else {
          this._hurt(st, ev);
        }
      }
    }

    // ── 보스 ──
    const bo = st.boss;
    if (bo && bo.alive) {
      if (!bo.active && p.x > bo.x - 240) { bo.active = true; ev.push({ type: 'bossintro' }); }
      if (bo.active) {
        if (bo.iv > 0) bo.iv -= dt;
        bo.jumpCd -= dt;
        bo.vy += GRAV * dt;
        const onG = bo.y >= (st.stage.gndY - 2) * TL + 2 - bo.h;
        if (onG && bo.jumpCd <= 0) {
          bo.vy = -230;
          bo.vx = p.x < bo.x ? -46 : 46;
          bo.jumpCd = 1.4;
        }
        bo.x += bo.vx * dt;
        bo.y += bo.vy * dt;
        const gy = (st.stage.gndY) * TL - bo.h;
        if (bo.y > gy) { bo.y = gy; bo.vy = 0; bo.vx *= 0.6; }
        if (this.overlap(p, bo)) {
          if (wasFalling && p.y + p.h < bo.y + bo.h * 0.5 && bo.iv <= 0) {
            bo.hp--; bo.iv = 1.2;
            p.vy = STOMP_V - 40;
            st.score += 500;
            ev.push({ type: 'bosshit', hp: bo.hp });
            if (bo.hp <= 0) {
              bo.alive = false;
              st.score += 3000;
              this._clear(st, ev, 3000);
              return ev;
            }
          } else if (bo.iv <= 0.9) {
            this._hurt(st, ev);
          }
        }
      }
    }

    // ── 깃발 골인 ──
    if (st.stage.flagX > 0 && p.x + p.w >= st.stage.flagX) {
      const hRatio = 1 - Math.min(1, Math.max(0, (p.y - 5 * TL) / (9 * TL)));
      this._clear(st, ev, Math.round(hRatio * 20) * 100);
      return ev;
    }

    // 코인팝 애니
    for (const c of st.pops) c.t += dt;
    st.pops = st.pops.filter((c) => c.t < 0.5);

    return ev;
  },
};
