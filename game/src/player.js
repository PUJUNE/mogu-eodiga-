// player.js — 바구니 + 모구 빌보드 + 입력 + 물리/충돌
import * as THREE from 'three';
const G = window.MOGU;

G.Player = class {
  constructor(scene, stage, moguTexture) {
    this.stage = stage;
    this.P = stage.params;
    this.scene = scene;

    this.z = 4;
    this.x = stage.cx(4);
    this.vx = 0;
    this.hearts = 3;
    this.invul = 0;
    this.stuck = 0;
    this.hitCount = 0;
    this.itemCount = 0;
    this.fishCount = 0;
    this.speedMode = 0;        // -1 감속 / 0 보통 / 1 가속
    this.obIdx = 0;
    this.itIdx = 0;
    this.gateIdx = 0;
    this.time = 0;
    this.flash = 0;

    // ── 바구니 (복셀 위빙 느낌) ──
    const g2 = new THREE.Group();
    const woven1 = new THREE.MeshLambertMaterial({ color: 0xb0824a });
    const woven2 = new THREE.MeshLambertMaterial({ color: 0x8f6534 });
    const BOXG = new THREE.BoxGeometry(1, 1, 1);
    const bottom = new THREE.Mesh(BOXG, woven2);
    bottom.scale.set(1.7, 0.25, 2.0); bottom.position.y = 0.12;
    g2.add(bottom);
    // 테두리 4면 (가로줄 2단, 교차 색)
    for (let lv = 0; lv < 2; lv++) {
      const mat = lv === 0 ? woven1 : woven2;
      const y = 0.35 + lv * 0.26;
      const front = new THREE.Mesh(BOXG, mat);
      front.scale.set(1.7, 0.28, 0.22); front.position.set(0, y, 1.0);
      const back = front.clone(); back.position.z = -1.0;
      const left = new THREE.Mesh(BOXG, mat);
      left.scale.set(0.22, 0.28, 2.2); left.position.set(-0.85, y, 0);
      const right = left.clone(); right.position.x = 0.85;
      g2.add(front, back, left, right);
    }
    // 노 (오른쪽에 걸쳐진)
    const paddle = new THREE.Group();
    const shaft = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0xc8a060 }));
    shaft.scale.set(0.12, 2.4, 0.12); shaft.position.y = -0.5;
    const blade = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0xb88a48 }));
    blade.scale.set(0.08, 0.7, 0.42); blade.position.y = -1.75;
    paddle.add(shaft, blade);
    paddle.position.set(0.95, 0.85, 0.3);
    paddle.rotation.z = -0.9;
    this.paddle = paddle;
    g2.add(paddle);

    // ── 모구 빌보드 ──
    const aspect = moguTexture.image ? moguTexture.image.width / moguTexture.image.height : 1.19;
    const h = 1.55, w = h * aspect;
    this.moguMat = new THREE.SpriteMaterial({ map: moguTexture, color: 0xffffff });
    const sprite = new THREE.Sprite(this.moguMat);
    sprite.scale.set(w, h, 1);
    sprite.position.set(0, 1.0, -0.15);
    this.mogu = sprite;
    g2.add(sprite);

    // ── 닭 (이스터에그 합류 후 표시) ──
    this.chickenMesh = null;

    // 그림자
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.15, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015;
    g2.add(sh);

    this.group = g2;
    scene.add(g2);
  }

  attachChicken(makeChicken) {
    if (this.chickenMesh) return;
    const ch = makeChicken();
    ch.scale.set(0.55, 0.55, 0.55);
    ch.position.set(0.55, 0.3, 0.45);
    this.chickenMesh = ch;
    this.group.add(ch);
  }

  // 현재 구간 특수 존
  zoneAt(z) {
    for (const zn of this.stage.zones) if (z >= zn.z0 && z <= zn.z1) return zn.type;
    return null;
  }

  currentSpeed() {
    const zone = this.zoneAt(this.z);
    let mult = this.speedMode === 1 ? 1.5 : this.speedMode === -1 ? 0.6 : 1.0;
    if (zone === 'rapid') mult = Math.max(1.5, mult === 1.5 ? 1.7 : 1.25);
    if (this.stuck > 0) mult = 0.06;
    return this.P.speed * mult;
  }

  update(t, dt, keys) {
    this.time = t;
    const ev = [];
    const st = this.stage, P = this.P;

    if (this.invul > 0) this.invul -= dt;
    if (this.stuck > 0) this.stuck -= dt;

    // ── 전진 ──
    this.speedMode = keys.up ? 1 : keys.down ? -1 : 0;
    const spd = this.currentSpeed();
    const oldCx = st.cx(this.z);
    this.z += spd * dt;
    // 강 굴곡이 바구니를 미는 힘 (커브 보정 55% — 나머지는 직접 조향)
    this.x += (st.cx(this.z) - oldCx) * 0.55;

    // ── 좌우 ──
    // 카메라가 +Z를 바라보므로 화면 오른쪽 = 월드 -X
    const dir = (keys.left ? 1 : 0) + (keys.right ? -1 : 0);
    const target = dir * P.latReach;
    const resp = P.ice ? 2.3 : 11;          // 빙판: 미끄러짐
    this.vx += (target - this.vx) * Math.min(1, dt * resp);
    this.x += this.vx * dt;

    // 강둑 클램프
    const hw = st.halfW(this.z), cx = st.cx(this.z);
    const maxOff = hw - 0.85;
    const off = this.x - cx;
    if (off > maxOff) { this.x = cx + maxOff; this.vx = Math.min(0, this.vx); }
    if (off < -maxOff) { this.x = cx - maxOff; this.vx = Math.max(0, this.vx); }

    // ── 장애물 충돌 ──
    while (this.obIdx < st.obstacles.length && st.obstacles[this.obIdx].z < this.z - 4) this.obIdx++;
    for (let i = this.obIdx; i < st.obstacles.length; i++) {
      const o = st.obstacles[i];
      if (o.z > this.z + 4) break;
      const dz = Math.abs(o.z - this.z);
      let ox = st.cx(o.z) + o.off, hl = 0, hz = 0, kind = 'hurt';
      switch (o.type) {
        case 'rock':    hl = o.r * 0.95; hz = o.r * 0.85; break;
        case 'icefloe': hl = o.r * 1.15; hz = o.r * 0.95; break;
        case 'pillar':  hl = 0.8; hz = 0.8; break;
        case 'logwall': hl = o.half; hz = 0.55; break;
        case 'icewall': hl = o.half; hz = 0.6; break;
        case 'cactuswall': hl = o.half; hz = 0.5; break;
        case 'movelog':
          ox = st.cx(o.z) + o.off + o.amp * Math.sin((Math.PI * 2 * t) / o.period + o.phase);
          hl = o.len / 2; hz = 0.55; break;
        case 'lily':    hl = o.r * 0.8; hz = o.r * 0.8; kind = 'slow'; break;
        case 'sandbar': hl = o.r; hz = o.r * 0.8; kind = 'stuck'; break;
        default: continue;
      }
      if (dz < hz + 0.9 && Math.abs(this.x - ox) < hl + 0.55) {
        if (kind === 'hurt') {
          if (this.invul <= 0) {
            this.hearts--; this.hitCount++; this.invul = 1.5;
            this.vx = (this.x < ox ? -1 : 1) * 5;
            ev.push({ type: 'hit', hearts: this.hearts });
          }
        } else if (kind === 'slow') {
          if (!o._done) { o._done = true; this.stuck = Math.max(this.stuck, 0.45); ev.push({ type: 'slow' }); }
        } else if (kind === 'stuck') {
          if (!o._done) { o._done = true; this.stuck = 1.0; ev.push({ type: 'stuck' }); }
        }
      }
    }

    // ── 폭포 게이트 ──
    while (this.gateIdx < st.gates.length && st.gates[this.gateIdx].z < this.z - 3) this.gateIdx++;
    const gate = st.gates[this.gateIdx];
    if (gate && !gate._done && this.z >= gate.z - 0.4) {
      gate._done = true;
      const gx = st.cx(gate.z) + gate.gapOff;
      if (Math.abs(this.x - gx) > gate.gapHalf + 0.3) {
        if (this.invul <= 0) {
          this.hearts--; this.hitCount++; this.invul = 1.5;
          ev.push({ type: 'hit', hearts: this.hearts, gate: true });
        }
      } else {
        ev.push({ type: 'gateboost' });
      }
    }

    // ── 아이템 ──
    while (this.itIdx < st.items.length && st.items[this.itIdx].z < this.z - 3) this.itIdx++;
    for (let i = this.itIdx; i < st.items.length; i++) {
      const it = st.items[i];
      if (it.z > this.z + 3) break;
      if (it._got) continue;
      if (Math.abs(it.z - this.z) < 1.1 && Math.abs(st.cx(it.z) + it.off - this.x) < 1.15) {
        it._got = true;
        this.itemCount++;
        if (it.kind === 'fish') this.fishCount++;
        ev.push({ type: 'pickup', kind: it.kind, id: it.id });
      }
    }

    // ── 닭 합류 ──
    const chk = st.chicken;
    if (chk && !chk.joined && Math.abs(chk.z - this.z) < 1.6 && Math.abs(st.cx(chk.z) + chk.off - this.x) < 2.2) {
      chk.joined = true;
      ev.push({ type: 'chicken' });
    }

    // ── 비주얼 ──
    const bobY = 0.18 + Math.sin(t * 2.3) * 0.05 + Math.sin(t * 4.1) * 0.02;
    this.group.position.set(this.x, bobY, this.z);
    this.group.rotation.z = -this.vx * 0.035 + Math.sin(t * 2.0) * 0.03;
    this.group.rotation.x = Math.sin(t * 1.7) * 0.025 + (this.speedMode === 1 ? -0.05 : 0);
    this.paddle.rotation.x = Math.sin(t * 3.2) * 0.3;
    this.paddle.rotation.z = -0.9 - this.vx * 0.06;
    if (this.chickenMesh) this.chickenMesh.position.y = 0.3 + Math.abs(Math.sin(t * 5)) * 0.07;

    // 피격 점멸
    if (this.invul > 0) {
      this.moguMat.color.setHex(Math.floor(t * 12) % 2 ? 0xff7070 : 0xffffff);
      this.group.visible = Math.floor(t * 14) % 3 !== 2;
    } else {
      this.moguMat.color.setHex(0xffffff);
      this.group.visible = true;
    }

    // ── 결승 ──
    if (this.z >= st.finishZ) ev.push({ type: 'finish' });
    return ev;
  }

  reviveAtCurrent() {
    this.hearts = 3;
    this.invul = 3.0;
    this.stuck = 0;
    this.vx = 0;
    // 죽은 지점 바로 뒤 통로 중앙 부근으로 살짝 보정
    const cx = this.stage.cx(this.z), hw = this.stage.halfW(this.z);
    const off = this.x - cx;
    this.x = cx + Math.max(-(hw - 1.2), Math.min(hw - 1.2, off));
  }

  dispose() { this.scene.remove(this.group); }
};
