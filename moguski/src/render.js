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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
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
      let lo = 0, hi = stage.K1 + stage.EASE + 30;
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
    const zMax = Math.ceil(stage.K1 + stage.EASE + 18);
    const HALF_W = 14;                          // 둔치 폭 (장식이 앉을 어깨 포함)
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
    const maxD = Math.hypot(zMax, stage.hillY(zMax));
    for (let d = 10; d < maxD; d += 10) markZ.push(solve(d));
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
    const outY = stage.hillY(stage.K1 + stage.EASE + 20);
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
      fg.position.set(TRACK_HW + 5.7, this.surfaceY(z), z);
      const fg2 = fg.clone();
      fg2.position.x = -TRACK_HW - 5.7;
      grp.add(fg, fg2);
    };
    flag(this.targetZ, new THREE.Color(th.accent), 3.4);
    if (bestZ) flag(bestZ, new THREE.Color(0xffffff), 2.2);

    // ── 둔치·하늘 장식 (테마별 — 인스턴스드 복셀, 활강로·비행로 좌우를 채움) ──
    const solids = [], glows = [];
    const put = (arr, x, y, z, sx, sy, sz, col, rot = 0) =>
      arr.push({ x, y, z, sx, sy, sz, col: col instanceof THREE.Color ? col : new THREE.Color(col), rot });
    const W = stage.world;

    // 소품 (r: 0~1 변주값)
    const mkTree = (x, y, z, r, leafC) => {
      const h = 1.6 + r * 1.4;
      put(solids, x, y + h / 2, z, 0.55, h, 0.55, 0x7a4f2b, r * 6);
      put(solids, x, y + h + 0.85, z, 1.7 + r, 1.8 + r, 1.7 + r, leafC, r * 6);
    };
    const mkFir = (x, y, z, r) => {
      const h = 1.1 + r * 0.7;
      put(solids, x, y + h / 2, z, 0.5, h, 0.5, 0x5a3f24, r * 6);
      put(solids, x, y + h + 0.9, z, 2.1 + r * 0.6, 1.7, 2.1 + r * 0.6, 0x2f5d3a, r * 6);
      put(solids, x, y + h + 2.2, z, 1.3 + r * 0.4, 1.1, 1.3 + r * 0.4, 0x38684a, r * 6);
      put(solids, x, y + h + 3.0, z, 0.8, 0.5, 0.8, 0xf2f8ff, r * 6);   // 눈 모자
    };
    const mkCactus = (x, y, z, r) => {
      const h = 1.8 + r * 1.8;
      put(solids, x, y + h / 2, z, 0.75, h, 0.75, 0x4e9c3c, r * 6);
      if (r > 0.45) {
        put(solids, x + 0.7, y + h * 0.55, z, 0.7, 0.45, 0.45, 0x459036);
        put(solids, x + 0.95, y + h * 0.72, z, 0.4, 0.8, 0.45, 0x459036);
      }
    };
    const mkRock = (x, y, z, r, col) => {
      put(solids, x, y + 0.35 + r * 0.25, z, 1.0 + r, 0.7 + r * 0.6, 0.9 + r * 0.8, col, r * 6);
      if (r > 0.55) put(solids, x + 0.6, y + 0.25, z + 0.4, 0.6, 0.5, 0.55, col);
    };
    const mkBush = (x, y, z, r, col) =>
      put(solids, x, y + 0.4 + r * 0.2, z, 1.1 + r * 0.7, 0.8 + r * 0.4, 1.1 + r * 0.7, col, r * 6);
    const mkFlower = (x, y, z, r) => {
      put(solids, x, y + 0.25, z, 0.12, 0.5, 0.12, 0x3e8b3e);
      put(solids, x, y + 0.58, z, 0.34, 0.26, 0.34, [0xff6fa0, 0xffd83d, 0xffffff, 0xff8a5c][Math.floor(r * 4) % 4]);
    };
    const mkMushroom = (x, y, z, r, capC, glow) => {
      put(solids, x, y + 0.3, z, 0.28, 0.6, 0.28, 0xe8dcc8);
      put(glow ? glows : solids, x, y + 0.72, z, 0.8 + r * 0.3, 0.35, 0.8 + r * 0.3, capC);
    };
    const mkSnowman = (x, y, z, r) => {
      put(solids, x, y + 0.5, z, 1.0, 1.0, 1.0, 0xf4f8ff, r * 6);
      put(solids, x, y + 1.3, z, 0.7, 0.7, 0.7, 0xf4f8ff, r * 6);
      put(solids, x, y + 1.32, z + 0.36, 0.14, 0.14, 0.3, 0xff8a3c, r * 6);  // 당근 코
    };
    const mkTorch = (x, y, z, r) => {
      put(solids, x, y + 0.8, z, 0.28, 1.6, 0.28, 0x6a4a2a);
      put(glows, x, y + 1.8, z, 0.5, 0.5, 0.5, 0xffc84a);
    };
    const mkCrystal = (x, y, z, r) => {
      const h = 1.2 + r * 1.6;
      put(glows, x, y + h / 2, z, 0.5, h, 0.5, r > 0.5 ? 0xc07aff : 0x7ab8ff, 0.5 + r * 5);
      if (r > 0.4) put(glows, x + 0.5, y + h * 0.3, z + 0.3, 0.3, h * 0.5, 0.3, 0x9a8aff, r * 5);
    };

    const deco = (x, y, z, r, k) => {
      if (W === 1) {
        if (k < 0.48) mkTree(x, y, z, r, r > 0.6 ? 0x54b04a : 0x3e9b3e);
        else if (k < 0.68) mkBush(x, y, z, r, 0x4a9c44);
        else if (k < 0.82) mkRock(x, y, z, r, 0x9a9a92);
        else mkFlower(x, y, z, r);
      } else if (W === 2) {
        if (k < 0.55) mkTree(x, y, z, r, [0xd88a2c, 0xc8552a, 0xe6b83c][Math.floor(r * 3) % 3]);
        else if (k < 0.72) mkMushroom(x, y, z, r, 0xd83a3a, false);
        else if (k < 0.87) mkBush(x, y, z, r, 0xb06a2c);
        else mkRock(x, y, z, r, 0x8a7a66);
      } else if (W === 3) {
        if (k < 0.5) mkCactus(x, y, z, r);
        else if (k < 0.76) mkRock(x, y, z, r, 0xc0a070);
        else mkBush(x, y, z, r, 0xa08048);
      } else if (W === 4) {
        if (k < 0.5) mkFir(x, y, z, r);
        else if (k < 0.68) mkSnowman(x, y, z, r);
        else if (k < 0.88) mkRock(x, y, z, r, 0xbcd8ee);
        else mkTree(x, y, z, r, 0x2f5d3a);
      } else {
        if (k < 0.38) mkCrystal(x, y, z, r);
        else if (k < 0.62) mkTorch(x, y, z, r);
        else if (k < 0.84) mkTree(x, y, z, r, 0x6a4a9a);
        else mkMushroom(x, y, z, r, 0xff8ad8, true);
      }
    };
    // 굵은 소품 두 줄 + 잔풀 스캐터
    const bandLo = TRACK_HW + 1.6, bandHi = HALF_W - 0.8;
    for (let z = zMin + 2; z < zMax - 2; z += 2.5) {
      const zi = Math.round(z * 4);
      for (const side of [1, -1]) {
        const r1 = hash(zi, side * 7);
        if (r1 < 0.24) continue;
        const x = side * (bandLo + r1 * (bandHi - bandLo));
        deco(x, this.surfaceY(z), z, hash(zi + 1, side * 11), hash(zi + 2, side * 13));
      }
      for (const side of [1, -1]) {                   // 잔장식 (꽃·낙엽·조약돌·눈덩이)
        const r2 = hash(zi + 5, side * 17);
        if (r2 < 0.3) continue;
        const sx = side * (TRACK_HW + 0.7 + r2 * (HALF_W - TRACK_HW - 1.4));
        const sy = this.surfaceY(z + 1.2), sz = z + 1.2;
        if (W === 1) mkFlower(sx, sy, sz, r2);
        else if (W === 2) put(solids, sx, sy + 0.06, sz, 0.5, 0.1, 0.5, r2 > 0.6 ? 0xc8552a : 0xe6b83c, r2 * 6);
        else if (W === 3) put(solids, sx, sy + 0.15, sz, 0.4, 0.3, 0.4, 0xb89468, r2 * 6);
        else if (W === 4) put(solids, sx, sy + 0.18, sz, 0.5, 0.36, 0.5, 0xffffff, r2 * 6);
        else if (r2 > 0.62) put(glows, sx, sy + 0.14, sz, 0.26, 0.26, 0.26, 0xb08aff);
      }
    }

    // 구름 — 비행 고도 좌우에 떠서 활공 풍경을 채움 (밤 월드는 보랏빛)
    const cCloud = new THREE.Color(th.night ? 0x584a86 : 0xffffff);
    for (let z = zMin; z < zMax + 50; z += 9) {
      const zi = Math.round(z);
      const r = hash(zi, 991);
      if (r < 0.42) continue;
      const x = (hash(zi, 992) > 0.5 ? 1 : -1) * (9 + hash(zi, 993) * 30);
      const y = this.surfaceY(Math.min(z, zMax)) + 9 + hash(zi, 994) * 20;
      const s = 2.6 + r * 4;
      put(solids, x, y, z, s, 0.9 + r * 0.5, s * 0.55, cCloud);
      put(solids, x + s * 0.45, y + 0.55, z + 0.8, s * 0.6, 0.7, s * 0.4, cCloud);
    }

    // 밤하늘 — 별·달 (월드 5)
    if (th.night) {
      for (let i = 0; i < 150; i++) {
        const r = hash(i, 551), r2 = hash(i, 552), r3 = hash(i, 553);
        const z = zMin - 30 + (zMax - zMin + 150) * r;
        const y = this.surfaceY(Math.max(zMin, Math.min(z, zMax))) + 16 + r3 * 55;
        const s = 0.22 + r3 * 0.4;
        put(glows, (r2 - 0.5) * 170, y, z, s, s, s, r2 > 0.82 ? 0xffe9a8 : 0xffffff);
      }
      put(glows, -48, 62, zMax * 0.6, 7, 7, 2.2, 0xfff2c0);   // 달
    }

    // 좌우 원경 능선 (계곡 벽 실루엣)
    const cFar = new THREE.Color(th.far);
    for (let i = 0; i < 10; i++) {
      const r = hash(i, 771), side = i % 2 ? 1 : -1;
      const zc = zMin + (zMax - zMin) * (i + 0.5) / 10;
      const hgt = 13 + r * 22;
      put(solids, side * (34 + r * 26), this.surfaceY(zc) - 6 + hgt / 2, zc,
        18 + r * 20, hgt, 26 + r * 26, cFar.clone().multiplyScalar(0.85 + r * 0.3), r);
    }

    const addInst = (list, mat) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(BOXG, mat, list.length);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const vp = new THREE.Vector3(), vs = new THREE.Vector3();
      list.forEach((c, i) => {
        e.set(0, c.rot || 0, 0); q.setFromEuler(e);
        vp.set(c.x, c.y, c.z); vs.set(c.sx, c.sy, c.sz);
        mtx.compose(vp, q, vs);
        m.setMatrixAt(i, mtx);
        m.setColorAt(i, c.col);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      grp.add(m);
    };
    addInst(solids, new THREE.MeshLambertMaterial());
    addInst(glows, new THREE.MeshBasicMaterial());

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
