// render.js — three.js 복셀 3D 렌더 (모구 어디가 방식) + 뒤통수 추적 카메라
// 좌표: z = 전진(활강→비행 방향), y = 높이, x = 좌우. 립(도약대 끝) = 원점.
import * as THREE from 'three';
const M = window.MSJ;

const BOXG = new THREE.BoxGeometry(1, 1, 1);

M.Render = {
  renderer: null, scene: null, camera: null,
  moguGroup: null, moguSprite: null, sackMesh: null,
  stageGroup: null, surfaceY: null, targetZ: 0,

  init(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.insertBefore(this.renderer.domElement, container.firstChild);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 조명
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x668855, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff2c8, 1.0);
    this.sun.position.set(30, 60, -20);
    this.scene.add(this.hemi, this.sun);

    // ── 모구 (사진 빌보드 — 캔버스 경유 필수) + 포대 ──
    const g = new THREE.Group();
    this.sackMesh = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0xa8783c }));
    this.sackMesh.scale.set(1.6, 0.6, 2.0);
    this.sackMesh.position.y = 0.36;                 // 포대 윗면 y=0.66
    g.add(this.sackMesh);
    // 스프라이트는 바닥 앵커: 엉덩이(이미지 위에서 56% 지점)가 포대 윗면에 앉고
    // 꼬리는 포대 뒤(카메라 쪽) 면으로 늘어져 튀어나옴
    this.SPR_H = 1.7; this.SPR_BOT = -0.05; this.sprA = 0.41;
    this.moguMat = new THREE.SpriteMaterial({ color: 0xffffff });
    this.moguSprite = new THREE.Sprite(this.moguMat);
    this.moguSprite.position.set(0, this.SPR_BOT + this.SPR_H / 2, -1.02);
    this.moguSprite.scale.set(this.SPR_H * this.sprA, this.SPR_H, 1);
    g.add(this.moguSprite);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.0, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02;
    this.shadow = sh;
    g.add(sh);
    this.moguGroup = g;
    this.scene.add(g);

    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.moguMat.map = tex;
      this.moguMat.needsUpdate = true;
      this.sprA = cv.width / cv.height;
      this.moguSprite.scale.set(this.SPR_H * this.sprA, this.SPR_H, 1);
    };
    img.src = M.ASSETS.mogu;
  },

  setStage(stage, best) {
    if (this.stageGroup) {
      this.scene.remove(this.stageGroup);
      this.stageGroup.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    }
    const th = stage.theme;
    const grp = new THREE.Group();
    this.stageGroup = grp;

    // 분위기
    this.scene.background = new THREE.Color(th.sky0);
    this.scene.fog = new THREE.Fog(new THREE.Color(th.sky1), 50, 320);
    this.hemi.intensity = th.night ? 0.45 : 0.9;
    this.sun.intensity = th.night ? 0.4 : 1.0;

    // 지면 높이 함수: z<0 인런(x→y 역참조), z≥0 착지 언덕. 출발대 뒤는 평평한 플랫폼
    const pts = stage.inrunPts;                 // x 단조 감소 (0 → -음수)
    const topX = pts[pts.length - 1].x, topY = pts[pts.length - 1].y;
    const inY = (z) => {
      if (z >= 0) return 0;
      if (z <= topX) return topY;               // 출발 플랫폼
      let lo = 0, hi = pts.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (pts[mid].x > z) lo = mid; else hi = mid; }
      const A = pts[lo], B = pts[hi];
      const f = (z - A.x) / (B.x - A.x || -1);
      return A.y + (B.y - A.y) * f;
    };
    this.surfaceY = (z) => (z < 0 ? inY(z) : stage.hillY(z));

    // 목표·최고 기록의 z 좌표 (거리 = sqrt(z²+y²) 역산)
    const solve = (d) => {
      let lo = 0, hi = stage.K * 2.2;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sqrt(mid * mid + stage.hillY(mid) ** 2) < d) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    this.targetZ = solve(stage.target);
    const bestZ = best > 0 ? solve(best) : null;

    // ── 지면 ──
    // 트랙(활강로): 0.25m 소형 슬래브가 프로파일을 연속으로 따라감 → 매끄러운 비탈
    // 둔치·지반: 1m 복셀 (마인크래프트 질감 유지)
    const zMin = Math.floor(topX) - 12;         // 출발 플랫폼 여유 (카메라 자리)
    const zMax = Math.ceil(stage.K * 1.32 + 56);
    const HALF_W = 8;
    const TRACK_HW = 3.5, S = 0.25;             // 트랙 반폭·소형 박스 크기
    const cTrack = new THREE.Color(th.track), cGround = new THREE.Color(th.ground);
    const cDirt = new THREE.Color(th.ground).multiplyScalar(0.55);
    const cAccent = new THREE.Color(th.accent), cLip = new THREE.Color(0xd83a3a);
    const cMark = new THREE.Color(th.night ? 0x9080c0 : 0xffffff);
    const hash = (a, b) => {
      let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    // 10m 간격 눈금·목표 라인의 z 좌표
    const markZ = [];
    for (let d = 10; d < stage.K * 1.7; d += 10) markZ.push(solve(d));
    const tgtZ = this.targetZ;

    // 1) 트랙 소형 슬래브
    const strip = [];
    const cols = Math.round((TRACK_HW * 2) / S);
    for (let z = zMin; z < zMax; z += S) {
      const zc = z + S / 2;
      const sy = this.surfaceY(zc);
      for (let ci = 0; ci < cols; ci++) {
        const xc = -TRACK_HW + S / 2 + ci * S;
        let col;
        if (zc >= -1 && zc <= 0) col = Math.floor(Math.abs(xc) * 2) % 2 ? cLip : cMark;      // 도약대 끝 줄무늬
        else if (zc > 0 && Math.abs(zc - tgtZ) < 0.3) col = cAccent;                          // 목표 라인
        else if (zc > 0 && markZ.some((m) => Math.abs(zc - m) < 0.15)) col = cMark;           // 10m 눈금
        else col = cTrack.clone().multiplyScalar(0.94 + hash(Math.floor(zc), Math.floor(xc * 2)) * 0.12);
        strip.push({ x: xc, y: sy - 0.25, z: zc, col });
      }
    }
    const imS = new THREE.InstancedMesh(BOXG, new THREE.MeshLambertMaterial(), strip.length);
    {
      const mtx = new THREE.Matrix4();
      strip.forEach((c, i) => {
        mtx.makeScale(S, 0.5, S);
        mtx.setPosition(c.x, c.y, c.z);
        imS.setMatrixAt(i, mtx);
        imS.setColorAt(i, c.col);
      });
      imS.instanceMatrix.needsUpdate = true;
      if (imS.instanceColor) imS.instanceColor.needsUpdate = true;
      grp.add(imS);
    }

    // 2) 둔치(1m 복셀) + 트랙 밑 지반
    const cells = [];
    for (let z = zMin; z <= zMax; z++) {
      const ys = Math.floor(this.surfaceY(z + 0.5));
      for (let wx = -HALF_W; wx <= HALF_W; wx++) {
        const isSide = Math.abs(wx) > TRACK_HW;
        const dep = isSide ? 4 : 3;
        for (let d = isSide ? 0 : 1; d < dep; d++) {
          let col;
          if (d > 0) col = cDirt.clone().multiplyScalar(0.85 + hash(z * 3 + d, wx) * 0.3);
          else col = cGround.clone().multiplyScalar(0.9 + hash(z, wx) * 0.2);
          cells.push({ x: wx, y: ys - d, z, col });
        }
      }
    }
    const im = new THREE.InstancedMesh(BOXG, new THREE.MeshLambertMaterial(), cells.length);
    {
      const mtx = new THREE.Matrix4();
      cells.forEach((c, i) => {
        mtx.identity();
        mtx.setPosition(c.x, c.y - 0.5, c.z + 0.5);
        im.setMatrixAt(i, mtx);
        im.setColorAt(i, c.col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      grp.add(im);
    }

    // ── 계곡 바닥 + 인런 뒤 능선 (수평선이 하늘로 비지 않게) ──
    const outY = stage.hillY(stage.K * 1.32 + 40);
    const valley = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: cGround.clone().multiplyScalar(0.8) }));
    valley.scale.set(600, 2, 500);
    valley.position.set(0, outY - 1.2, zMax + 180);
    const valley2 = valley.clone();
    valley2.position.set(0, outY - 1.2, (zMin + zMax) / 2);
    valley2.scale.set(600, 2, zMax - zMin + 100);
    grp.add(valley, valley2);

    // ── 깃발 (목표 / 최고 기록) ──
    const flag = (z, color, h) => {
      const fg = new THREE.Group();
      const pole = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      pole.scale.set(0.18, h, 0.18); pole.position.y = h / 2;
      const cloth = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color }));
      cloth.scale.set(0.12, 0.8, 1.4); cloth.position.set(0, h - 0.5, 0.8);
      fg.add(pole, cloth);
      fg.position.set(HALF_W + 1.2, this.surfaceY(z), z);
      const fg2 = fg.clone();
      fg2.position.x = -HALF_W - 1.2;
      grp.add(fg, fg2);
    };
    flag(this.targetZ, new THREE.Color(th.accent), 3.4);
    if (bestZ) flag(bestZ, new THREE.Color(0xffffff), 2.2);

    // ── 둔치 장식 (테마별) ──
    const deco = (z, side) => {
      const x = side * (HALF_W + 3 + ((z * 7) % 5));
      const y = this.surfaceY(z);
      const g2 = new THREE.Group();
      if (stage.world === 3) {          // 선인장
        const c1 = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0x4e9c3c }));
        c1.scale.set(0.8, 2.4, 0.8); c1.position.y = 1.2; g2.add(c1);
      } else if (stage.world === 5) {   // 횃불
        const p = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
        p.scale.set(0.3, 1.6, 0.3); p.position.y = 0.8;
        const f = new THREE.Mesh(BOXG, new THREE.MeshBasicMaterial({ color: 0xffc84a }));
        f.scale.set(0.5, 0.5, 0.5); f.position.y = 1.8;
        g2.add(p, f);
      } else {                          // 나무 (설산은 전나무 톤)
        const trunk = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: 0x7a4f2b }));
        trunk.scale.set(0.7, 2, 0.7); trunk.position.y = 1;
        const leafC = stage.world === 4 ? 0x2f5d3a : stage.world === 2 ? 0xd88a2c : 0x3e9b3e;
        const leaf = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color: leafC }));
        leaf.scale.set(2.2, 2.2, 2.2); leaf.position.y = 3.1;
        g2.add(trunk, leaf);
      }
      g2.position.set(x, y, z);
      grp.add(g2);
    };
    for (let z = zMin + 2; z < zMax - 2; z += 7) {
      if ((z * 13) % 4 !== 0) deco(z, 1);      // 걸음(7)과 서로소 모듈러 — 양쪽이 다 비지 않게
      if ((z * 17) % 5 !== 0) deco(z, -1);
    }

    this.scene.add(grp);
    // 카메라 초기화 (인런 꼭대기 뒤)
    const top = stage.inrunAt(stage.L);
    this.camera.position.set(0, top.y + 3, top.x - 8);
  },

  draw(st, t, dt) {
    const stg = st.stage;
    let mz, my, pitch = 0;
    if (st.phase === 'ready' || st.phase === 'slide') {
      const p = stg.inrunAt(Math.max(0, st.s));
      mz = p.x; my = p.y; pitch = p.th;
    } else {
      mz = st.x; my = st.y;
      pitch = st.phase === 'flight' ? Math.max(-0.3, Math.min(0.5, -Math.atan2(st.vy, st.vx) * 0.55)) : 0;
    }
    const g = this.moguGroup;
    const bob = st.phase === 'slide' ? Math.sin(t * 18) * 0.04 * Math.min(1, st.v / 8) : 0;
    g.position.set(0, my + bob, mz);
    g.rotation.x = st.phase === 'landed' && st.crash ? (st.landT * 9) % (Math.PI * 2) : pitch;
    // 웅크리기(차지) — 엉덩이(바닥 앵커)는 포대에 붙인 채 몸만 낮아짐
    const crouch = st.phase === 'slide' && st.holding ? st.charge : 0;
    const sh = this.SPR_H * (1 - crouch * 0.22);
    this.moguSprite.scale.y = sh;
    this.moguSprite.position.y = this.SPR_BOT + sh / 2;
    this.shadow.visible = st.phase !== 'flight' || (st.y - stg.hillY(st.x)) < 4;

    // ── 뒤통수 추적 카메라 ──
    const spd = st.phase === 'flight' ? Math.hypot(st.vx, st.vy) : st.v;
    const back = 7.0 + spd * 0.10, up = 3.1 + spd * 0.03;
    const damp = dt ? 1 - Math.exp(-dt * 4.5) : 0.08;
    const tx = 0, tz = mz - back;
    // 카메라가 산비탈에 파묻히지 않게 지형 위로 클램프 (뒤쪽은 항상 오르막)
    let tyy = my + up;
    if (this.surfaceY) tyy = Math.max(tyy, this.surfaceY(tz) + 2.4, this.surfaceY(tz + back * 0.5) + 2.0);
    this.camera.position.x += (tx - this.camera.position.x) * damp;
    this.camera.position.y += (tyy - this.camera.position.y) * damp;
    this.camera.position.z += (tz - this.camera.position.z) * damp;
    this.camera.lookAt(0, my + 0.6, mz + 14);
    const fovT = 62 + Math.min(16, spd * 0.35);
    this.camera.fov += (fovT - this.camera.fov) * damp;
    this.camera.updateProjectionMatrix();

    // 모구 머리 위 지점의 화면 좌표 (타이밍 바·차지 게이지 앵커)
    const hv = new THREE.Vector3(0, my + 2.3, mz).project(this.camera);
    this.headScreen = {
      x: (hv.x * 0.5 + 0.5) * window.innerWidth,
      y: (0.5 - hv.y * 0.5) * window.innerHeight,
    };

    this.renderer.render(this.scene, this.camera);
  },
};
