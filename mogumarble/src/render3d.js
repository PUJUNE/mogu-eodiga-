// render3d.js — 모구의 마블 3D 렌더 (Three.js 저폴리 · 고양이 왕국 가드 계열)
// 색 톤: 파스텔이 아닌 비비드 애니메이션 톤 (채도 높은 원색 + 밝은 하늘)
var M = window.MBL;
var THREE = window.THREE;

var TILE_S = 15;                   // 칸 간격
var TILE_W = 13.8;                 // 칸 크기
var TILE_H = 2.6;                  // 칸 두께
var SIDE = 12;                     // 한 변 칸 수 (코너 0/12/24/36)
var HALF = (SIDE / 2) * TILE_S;    // 보드 반폭

function mat(color, rough, metal) {
  return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0, flatShading: true });
}

M.R3 = {
  renderer: null, scene: null, camera: null,
  boardG: null, tileMeshes: [], propG: null, tokens: [], diceG: null, dice: [],
  cam: { yaw: 0.0, pitch: 0.86, dist: 300, min: 140, max: 480, target: null },
  anims: [], t: 0,
  markerRing: null,

  // 보드 둘레 좌표 (0=우하 코너, 반시계: 아래변 → 왼변 → 윗변 → 오른변)
  tilePos: function (i) {
    var s = ((i % M.SIZE) + M.SIZE) % M.SIZE;
    if (s <= SIDE)     return { x: HALF - s * TILE_S, z: HALF, side: 0 };
    if (s <= SIDE * 2) return { x: -HALF, z: HALF - (s - SIDE) * TILE_S, side: 1 };
    if (s <= SIDE * 3) return { x: -HALF + (s - SIDE * 2) * TILE_S, z: -HALF, side: 2 };
    return { x: HALF, z: -HALF + (s - SIDE * 3) * TILE_S, side: 3 };
  },

  init: function (container) {
    if (!THREE) return false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.NoToneMapping;             // 채도 유지 — 비비드 애니메이션 톤
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2f9fff);           // 쨍한 애니메이션 하늘
    this.scene.fog = new THREE.FogExp2(0x53b5ff, 0.0007);
    this.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 1, 3000);
    this.cam.target = new THREE.Vector3(0, 0, 0);

    var hemi = new THREE.HemisphereLight(0xdff0ff, 0x2f8e3a, 0.72);
    this.scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff6d8, 0.95);
    sun.position.set(-120, 210, 110);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var d = 220;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    var self = this;
    window.addEventListener('resize', function () {
      self.camera.aspect = innerWidth / innerHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(innerWidth, innerHeight);
    });
    this.bindOrbit();
    this.updateCamera();
    return true;
  },

  updateCamera: function () {
    var c = this.cam;
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    this.camera.position.set(c.target.x + Math.sin(c.yaw) * cp * c.dist,
      c.target.y + sp * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.target);
  },

  bindOrbit: function () {
    var self = this, el = this.renderer.domElement;
    var drag = null, pinch = null;
    el.addEventListener('pointerdown', function (e) {
      if (pinch) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      self.cam.yaw -= (e.clientX - drag.x) * 0.005;
      self.cam.pitch = Math.max(0.35, Math.min(1.35, self.cam.pitch + (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX; drag.y = e.clientY;
      self.updateCamera();
    });
    var end = function (e) { if (drag && e.pointerId === drag.id) drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', function (e) {
      self.cam.dist = Math.max(self.cam.min, Math.min(self.cam.max, self.cam.dist + e.deltaY * 0.12));
      self.updateCamera();
    }, { passive: true });
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { drag = null; pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        var d2 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        self.cam.dist = Math.max(self.cam.min, Math.min(self.cam.max, self.cam.dist - (d2 - pinch) * 0.35));
        pinch = d2; self.updateCamera();
      }
    }, { passive: true });
    el.addEventListener('touchend', function () { pinch = null; }, { passive: true });
  },

  // ── 칸 상판 텍스처 (캔버스 → 한글 라벨) ──
  tileTexture: function (idx) {
    var def = M.TILES[idx];
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var c = cv.getContext('2d');
    c.fillStyle = '#fff8e8';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#3a2a18'; c.lineWidth = 10;
    c.strokeRect(0, 0, 256, 256);
    c.textAlign = 'center';
    if (def.kind === 'city') {
      c.fillStyle = M.CITIES[def.city].css;
      c.fillRect(5, 5, 246, 64);
      c.fillStyle = '#fff';
      c.font = 'bold 34px "Malgun Gothic",sans-serif';
      c.fillText(M.CITIES[def.city].name, 128, 51);
      c.fillStyle = '#33261a';
      var name = def.name;
      c.font = 'bold ' + (name.length > 6 ? 34 : 40) + 'px "Malgun Gothic",sans-serif';
      if (name.length > 5) {                                     // 두 줄 배치
        var mid = name.indexOf(' ') > 0 ? name.indexOf(' ') : Math.ceil(name.length / 2);
        c.fillText(name.slice(0, mid).trim(), 128, 128);
        c.fillText(name.slice(mid).trim(), 128, 172);
      } else c.fillText(name, 128, 150);
      c.fillStyle = '#b0722a';
      c.font = 'bold 36px "Malgun Gothic",sans-serif';
      c.fillText(def.price + '만', 128, 228);
    } else {
      c.fillStyle = def.kind === 'start' ? '#43b649' : def.kind === 'island' ? '#3d9be0'
        : def.kind === 'festival' ? '#e8453c' : def.kind === 'express' ? '#8a56d8' : '#f2a93b';
      c.fillRect(5, 5, 246, 246);
      c.strokeRect(0, 0, 256, 256);
      c.font = '96px sans-serif';
      c.fillText(def.emoji || '★', 128, 130);
      c.fillStyle = '#fff';
      c.font = 'bold 40px "Malgun Gothic",sans-serif';
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 8;
      c.strokeText(def.name, 128, 214);
      c.fillText(def.name, 128, 214);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  },

  buildBoard: function () {
    var g = new THREE.Group();
    this.boardG = g;
    this.scene.add(g);

    // 초원 받침 + 보드 판
    var ground = new THREE.Mesh(new THREE.CylinderGeometry(HALF * 2.6, HALF * 2.9, 8, 24), mat(0x2fa338, 0.95));
    ground.position.y = -6.5;
    ground.receiveShadow = true;
    g.add(ground);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + TILE_S + 8, 5, HALF * 2 + TILE_S + 8), mat(0xf2b62e, 0.9));
    plate.position.y = -2.5;
    plate.receiveShadow = true; plate.castShadow = true;
    g.add(plate);
    var inner = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 - TILE_S - 3, 5.4, HALF * 2 - TILE_S - 3), mat(0x2f9e44, 0.95));
    inner.position.y = -2.4;
    inner.receiveShadow = true;
    g.add(inner);

    // 중앙 로고 + 모구 얼굴
    var logoCv = document.createElement('canvas');
    logoCv.width = 512; logoCv.height = 256;
    var lc = logoCv.getContext('2d');
    lc.textAlign = 'center';
    lc.font = 'bold 92px "Malgun Gothic",sans-serif';
    lc.strokeStyle = '#155724'; lc.lineWidth = 18;
    lc.strokeText('모구의 마블', 256, 120);
    lc.fillStyle = '#ffe14a';
    lc.fillText('모구의 마블', 256, 120);
    lc.font = 'bold 40px "Malgun Gothic",sans-serif';
    lc.strokeStyle = 'rgba(21,87,36,.8)'; lc.lineWidth = 9;
    lc.strokeText('성남 · 수원 · 원주', 256, 190);
    lc.fillStyle = '#eafff0';
    lc.fillText('성남 · 수원 · 원주', 256, 190);
    var logoTex = new THREE.CanvasTexture(logoCv);
    logoTex.encoding = THREE.sRGBEncoding;
    var logo = new THREE.Mesh(new THREE.PlaneGeometry(92, 46),
      new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false }));
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 0.55, 20);
    g.add(logo);
    try {
      var moguTex = new THREE.TextureLoader().load(M.ASSET_BASE + 'game/assets/mogu-icon.png');
      moguTex.encoding = THREE.sRGBEncoding;
      var face = new THREE.Mesh(new THREE.PlaneGeometry(42, 42),
        new THREE.MeshBasicMaterial({ map: moguTex, transparent: true, depthWrite: false }));
      face.rotation.x = -Math.PI / 2;
      face.position.set(0, 0.55, -26);
      g.add(face);
    } catch (e) { }

    // 24칸
    this.tileMeshes = [];
    for (var i = 0; i < M.SIZE; i++) {
      var p = this.tilePos(i);
      var isCorner = i % SIDE === 0;
      var w = isCorner ? TILE_W + 1.6 : TILE_W;
      var box = new THREE.Mesh(new THREE.BoxGeometry(w, TILE_H, w),
        [mat(0xe8dcc0), mat(0xe8dcc0),
         new THREE.MeshStandardMaterial({ map: this.tileTexture(i), roughness: 0.8, flatShading: true }),
         mat(0xc8b890), mat(0xe8dcc0), mat(0xe8dcc0)]);
      box.position.set(p.x, TILE_H / 2, p.z);
      // 모든 라벨이 기본 카메라(핫시트 공유 화면)에서 바로 읽히게 정면 고정
      box.castShadow = true; box.receiveShadow = true;
      box.userData.idx = i;
      g.add(box);
      this.tileMeshes.push(box);
    }

    // 장식: 보드 밖 낮은 언덕나무 (애니메이션 톤 원색)
    var rng = M.makeRng(20260714);
    for (i = 0; i < 22; i++) {
      var ang = rng.next() * Math.PI * 2;
      var rad = HALF * 1.55 + rng.next() * HALF * 0.8;
      var tx = Math.cos(ang) * rad, tz = Math.sin(ang) * rad;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5, 6), mat(0x8a5a2c, 0.9));
      trunk.position.set(tx, 2.5 - 2, tz);
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.4 + rng.next() * 2.4, 0),
        mat(rng.next() < 0.3 ? 0xff5d8f : 0x1faf4b, 0.9));
      crown.position.set(tx, 8 - 2, tz);
      crown.castShadow = true;
      g.add(trunk); g.add(crown);
    }

    // 현재 칸 하이라이트 링
    this.markerRing = new THREE.Mesh(new THREE.TorusGeometry(TILE_W * 0.52, 0.7, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9 }));
    this.markerRing.rotation.x = Math.PI / 2;
    this.markerRing.visible = false;
    g.add(this.markerRing);

    this.propG = new THREE.Group();
    g.add(this.propG);
    this.buildDice();
  },

  // ── 소유 표시 + 건물 + 축제 마커 (상태 갱신 시 재생성) ──
  refreshProps: function (st) {
    var g = this.propG;
    while (g.children.length) {
      var ch = g.children.pop();
      g.remove(ch);
      ch.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) { if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); }); else o.material.dispose(); } });
    }
    for (var i = 0; i < M.SIZE; i++) {
      var T = st.tiles[i];
      var p = this.tilePos(i);
      if (T.owner != null && T.owner >= 0) {
        var col = M.CHARS[st.players[T.owner].char].color;
        var frame = new THREE.Mesh(new THREE.BoxGeometry(TILE_W + 2.2, 1.1, TILE_W + 2.2), mat(col, 0.7));
        frame.position.set(p.x, 0.4, p.z);
        g.add(frame);
        // 방향: 보드 중심 쪽 코너에 건물
        var bx = p.x * 0.86, bz = p.z * 0.86;
        var lv = T.level;
        if (lv >= 1) g.add(this.house(bx - 3, bz, col, 0));
        if (lv >= 2) g.add(this.house(bx + 3, bz, col, 1));
        if (lv >= 3) g.add(this.hotel(bx, bz, col));
        var flag = new THREE.Group();
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 7, 5), mat(0xf0f0f0, 0.6));
        pole.position.y = 3.5;
        var cloth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 0.3), mat(col, 0.6));
        cloth.position.set(1.8, 5.8, 0);
        flag.add(pole); flag.add(cloth);
        flag.position.set(p.x + (p.side % 2 === 0 ? 5.4 : 0), TILE_H, p.z + (p.side % 2 === 1 ? 5.4 : 0));
        g.add(flag);
      }
      if (st.festivalTile === i) {
        var fes = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5.4, 8),
          new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.5, emissive: 0x881133, emissiveIntensity: 0.5, flatShading: true }));
        fes.position.set(p.x * 0.86, TILE_H + 2.7, p.z * 0.86 + (p.side % 2 === 0 ? -6 : 0));
        fes.userData.spin = true;
        g.add(fes);
        var top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), mat(0xffe14a, 0.4));
        top.position.copy(fes.position); top.position.y += 3.2;
        g.add(top);
      }
    }
  },

  // 별장 / 호텔 저폴리
  house: function (x, z, col, k) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.4), mat(0xfff2dc, 0.85));
    body.position.y = 1.3; body.castShadow = true;
    var roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 2.2, 4), mat(col, 0.75));
    roof.position.y = 3.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    g.add(body); g.add(roof);
    g.position.set(x, TILE_H, z + (k ? 2.4 : -2.4));
    return g;
  },
  hotel: function (x, z, col) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 7.4, 4.6), mat(0xfff2dc, 0.85));
    body.position.y = 3.7; body.castShadow = true;
    for (var f = 0; f < 3; f++) {
      var band = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.5, 4.8), mat(col, 0.7));
      band.position.y = 1.8 + f * 2.1;
      g.add(band);
    }
    var roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.6, 4), mat(col, 0.7));
    roof.position.y = 8.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    var star = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xaa7700, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }));
    star.position.y = 10.6;
    star.userData.spin = true;
    g.add(body); g.add(roof); g.add(star);
    g.position.set(x, TILE_H, z);
    return g;
  },

  // ── 캐릭터 토큰 (저폴리 동물 + 플레이어색 받침) ──
  buildTokens: function (st) {
    var self = this;
    this.tokens.forEach(function (tk) { self.boardG.remove(tk.g); });
    this.tokens = [];
    for (var i = 0; i < st.players.length; i++) {
      var P = st.players[i];
      var ch = M.CHARS[P.char];
      var g = this.animalToken(ch.key, ch.color);
      this.boardG.add(g);
      var tk = { g: g, pi: i, pos: P.pos, hopT: -1 };
      this.placeToken(tk, P.pos, i);
      this.tokens.push(tk);
    }
  },
  tokenOffset: function (pi) {
    return [{ x: -3.2, z: -3.2 }, { x: 3.2, z: -3.2 }, { x: -3.2, z: 3.2 }, { x: 3.2, z: 3.2 }][pi];
  },
  placeToken: function (tk, pos, pi) {
    var p = this.tilePos(pos);
    var o = this.tokenOffset(pi);
    tk.g.position.set(p.x + o.x, TILE_H, p.z + o.z);
    tk.pos = pos;
  },

  animalToken: function (kind, color) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.2, 8), mat(color, 0.6));
    base.position.y = 0.6; base.castShadow = true;
    g.add(base);
    var bodyCol = kind === 'mogu' ? 0xb87838 : kind === 'kko' ? 0xf6f2e6 : kind === 'jjik' ? 0xa8a0a0 : 0xc98a4b;
    var dark = kind === 'mogu' ? 0x855020 : kind === 'kko' ? 0xc9c2ac : kind === 'jjik' ? 0x787070 : 0x96612f;
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.2, 3.2), mat(bodyCol, 0.85));
    body.position.y = 3.4; body.castShadow = true;
    g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3), mat(bodyCol, 0.85));
    head.position.set(0, 6.6, 0.3); head.castShadow = true;
    g.add(head);
    var eye;
    [-1, 1].forEach(function (sx) {
      eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), mat(0x2a2430, 0.6));
      eye.position.set(sx * 0.8, 6.9, 1.85);
      g.add(eye);
    });
    if (kind === 'mogu') {                                        // 고양이: 뾰족 귀 + 줄무늬
      [-1, 1].forEach(function (sx) {
        var ear = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 3), mat(dark, 0.85));
        ear.position.set(sx * 1.1, 8.6, 0.3);
        g.add(ear);
      });
      var st1 = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.6, 3.3), mat(dark, 0.85));
      st1.position.y = 4.2; g.add(st1);
      var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 4, 5), mat(dark, 0.85));
      tail.position.set(0, 4.6, -2.4); tail.rotation.x = 0.7;
      g.add(tail);
    } else if (kind === 'kko') {                                  // 닭: 볏 + 부리
      var comb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 2), mat(0xe8453c, 0.7));
      comb.position.set(0, 8.6, 0.3); g.add(comb);
      var beak = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), mat(0xf2a93b, 0.7));
      beak.position.set(0, 6.4, 2.2); beak.rotation.x = Math.PI / 2;
      g.add(beak);
    } else if (kind === 'jjik') {                                 // 쥐: 접시귀 + 분홍 꼬리
      [-1, 1].forEach(function (sx) {
        var ear = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 8), mat(0x909090, 0.85));
        ear.rotation.x = Math.PI / 2; ear.position.set(sx * 1.4, 8.5, 0.2);
        g.add(ear);
        var inn = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.55, 8), mat(0xe8a0b8, 0.8));
        inn.rotation.x = Math.PI / 2; inn.position.set(sx * 1.4, 8.5, 0.25);
        g.add(inn);
      });
      var mtail = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4.6, 5), mat(0xe8a0b8, 0.8));
      mtail.position.set(0, 3.4, -2.5); mtail.rotation.x = 1.15;
      g.add(mtail);
    } else {                                                      // 강아지: 접힌 귀 + 주둥이
      [-1, 1].forEach(function (sx) {
        var ear = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2, 0.6), mat(dark, 0.85));
        ear.position.set(sx * 1.7, 7.6, 0.3); ear.rotation.z = sx * 0.5;
        g.add(ear);
      });
      var muz = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1), mat(0xf5e6cf, 0.85));
      muz.position.set(0, 6.1, 1.9); g.add(muz);
      var nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), mat(0x2a2430, 0.6));
      nose.position.set(0, 6.35, 2.45); g.add(nose);
      var dtail = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 3.4, 5), mat(bodyCol, 0.85));
      dtail.position.set(0, 4.8, -2.2); dtail.rotation.x = 0.55;
      g.add(dtail);
    }
    return g;
  },

  // 토큰 이동: 칸 하나씩 폴짝 (onStep 콜백으로 효과음)
  hopToken: function (pi, from, to, teleport, onStep, onDone) {
    var tk = this.tokens[pi];
    if (!tk) { if (onDone) onDone(); return; }
    var path = [];
    if (teleport) path = [to];
    else { var s = from; while (s !== to) { s = (s + 1) % M.SIZE; path.push(s); } }
    if (!path.length) { if (onDone) onDone(); return; }
    var self = this;
    var per = teleport ? 0.5 : Math.max(0.16, Math.min(0.3, 2.6 / path.length));
    this.anims.push({
      kind: 'hop', tk: tk, pi: pi, path: path, seg: 0, t: 0, per: per,
      from: this.tilePos(tk.pos), teleport: !!teleport, onStep: onStep, onDone: onDone,
    });
  },

  // 주사위
  diceFaceTex: function (n) {
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#fffdf4'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#d8c8a8'; c.lineWidth = 8; c.strokeRect(0, 0, 128, 128);
    c.fillStyle = n === 1 ? '#e8453c' : '#33261a';
    var dots = { 1: [[64, 64]], 2: [[38, 38], [90, 90]], 3: [[34, 34], [64, 64], [94, 94]],
      4: [[38, 38], [90, 38], [38, 90], [90, 90]], 5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
      6: [[38, 32], [90, 32], [38, 64], [90, 64], [38, 96], [90, 96]] };
    dots[n].forEach(function (d) { c.beginPath(); c.arc(d[0], d[1], n === 1 ? 20 : 13, 0, Math.PI * 2); c.fill(); });
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },
  buildDice: function () {
    this.diceG = new THREE.Group();
    this.boardG.add(this.diceG);
    // 면 배치: [+x=3, -x=4, +y=1, -y=6, +z=2, -z=5]
    var faces = [3, 4, 1, 6, 2, 5];
    for (var k = 0; k < 2; k++) {
      var mats = [];
      for (var f = 0; f < 6; f++) mats.push(new THREE.MeshStandardMaterial({ map: this.diceFaceTex(faces[f]), roughness: 0.55, flatShading: true }));
      var die = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), mats);
      die.castShadow = true;
      die.visible = false;
      this.diceG.add(die);
      this.dice.push(die);
    }
  },
  // 값 → 윗면 회전
  dieRotFor: function (v) {
    switch (v) {
      case 1: return new THREE.Euler(0, 0, 0);
      case 6: return new THREE.Euler(Math.PI, 0, 0);
      case 2: return new THREE.Euler(-Math.PI / 2, 0, 0);
      case 5: return new THREE.Euler(Math.PI / 2, 0, 0);
      case 3: return new THREE.Euler(0, 0, Math.PI / 2);
      default: return new THREE.Euler(0, 0, -Math.PI / 2);
    }
  },
  rollDice: function (d1, d2, onDone) {
    var vals = [d1, d2];
    for (var k = 0; k < 2; k++) {
      var die = this.dice[k];
      die.visible = true;
      die.position.set(-9 + k * 18, 34, 26);
      this.anims.push({ kind: 'dice', die: die, t: 0, dur: 1.05, val: vals[k], k: k,
        spin: { x: 6 + Math.random() * 6, y: 5 + Math.random() * 6, z: 4 + Math.random() * 5 },
        onDone: k === 1 ? onDone : null });
    }
  },
  hideDice: function () {
    this.dice.forEach(function (d) { d.visible = false; });
  },

  setMarker: function (pos) {
    if (pos == null || pos < 0) { this.markerRing.visible = false; return; }
    var p = this.tilePos(pos);
    this.markerRing.visible = true;
    this.markerRing.position.set(p.x, TILE_H + 0.6, p.z);
  },

  busy: function () { return this.anims.length > 0; },

  update: function (dt) {
    this.t += dt;
    var self = this;
    // 진행 중 애니메이션
    for (var i = this.anims.length - 1; i >= 0; i--) {
      var a = this.anims[i];
      a.t += dt;
      if (a.kind === 'hop') {
        var done = false;
        var k = Math.min(1, a.t / a.per);
        var fromP = a.seg === 0 ? a.from : this.tilePos(a.path[a.seg - 1]);
        var toP = this.tilePos(a.path[a.seg]);
        var o = this.tokenOffset(a.pi);
        var y = TILE_H + Math.sin(Math.PI * k) * (a.teleport ? 26 : 7);
        a.tk.g.position.set(fromP.x + (toP.x - fromP.x) * k + o.x, y, fromP.z + (toP.z - fromP.z) * k + o.z);
        if (k >= 1) {
          a.tk.pos = a.path[a.seg];
          if (a.onStep) a.onStep(a.seg);
          a.seg++; a.t = 0;
          if (a.seg >= a.path.length) done = true;
        }
        if (done) {
          this.placeToken(a.tk, a.tk.pos, a.pi);
          this.anims.splice(i, 1);
          if (a.onDone) a.onDone();
        }
      } else if (a.kind === 'dice') {
        var kk = Math.min(1, a.t / a.dur);
        var ease = 1 - Math.pow(1 - kk, 3);
        a.die.position.y = 34 - ease * 28 + Math.sin(Math.PI * kk) * 4;
        if (kk < 0.72) {
          a.die.rotation.x += a.spin.x * dt * (1 - kk);
          a.die.rotation.y += a.spin.y * dt * (1 - kk);
          a.die.rotation.z += a.spin.z * dt * (1 - kk);
        } else {
          var target = this.dieRotFor(a.val);
          a.die.rotation.x += (target.x - a.die.rotation.x) * Math.min(1, dt * 14);
          a.die.rotation.y += (target.y - a.die.rotation.y) * Math.min(1, dt * 14);
          a.die.rotation.z += (target.z - a.die.rotation.z) * Math.min(1, dt * 14);
        }
        if (kk >= 1) {
          a.die.rotation.copy(this.dieRotFor(a.val));
          a.die.position.y = 6;
          this.anims.splice(i, 1);
          if (a.onDone) a.onDone();
        }
      }
    }
    // 상시 연출: 마커 펄스 + 회전 장식
    if (this.markerRing && this.markerRing.visible) {
      var s = 1 + Math.sin(this.t * 5) * 0.08;
      this.markerRing.scale.set(s, s, 1);
    }
    if (this.propG) this.propG.traverse(function (o) { if (o.userData.spin) o.rotation.y += dt * 2.2; });
    // 토큰 살랑 (대기 중)
    for (i = 0; i < this.tokens.length; i++) {
      var tk = this.tokens[i];
      var hopping = this.anims.some(function (an) { return an.tk === tk; });
      if (!hopping) tk.g.rotation.y = Math.sin(this.t * 1.6 + i * 1.7) * 0.14;
    }
    this.renderer.render(this.scene, this.camera);
  },
};
