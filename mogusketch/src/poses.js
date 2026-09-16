// poses.js — 뼈대 포즈 키프레임 (발 중심 원점, 오른쪽을 보는 기준, y는 위로 +)
// 관절 14개: 머리·목·가슴·엉덩이 + 앞팔(어깨·팔꿈치·손) + 뒷팔 + 앞다리(무릎·발) + 뒷다리
const M = window.MSK;

const J = ['head', 'neck', 'chest', 'hip', 'sF', 'eF', 'hF', 'sB', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];
M.JOINTS = J;

const BASE = {
  head: [9, 148], neck: [6, 134], chest: [4, 118], hip: [0, 78],
  sF: [12, 128], eF: [30, 112], hF: [36, 128],
  sB: [0, 128], eB: [-8, 110], hB: [8, 118],
  kF: [18, 40], fF: [26, 2], kB: [-16, 40], fB: [-26, 2],
};
const over = (base, o) => Object.assign({}, base, o);

const P = {};
P.idle = BASE;
P.idle2 = over(BASE, { head: [9, 146], neck: [6, 132], chest: [4, 116], hip: [0, 77], sF: [12, 126], eF: [30, 110], hF: [36, 126], sB: [0, 126], eB: [-8, 108], hB: [8, 116] });

P.walk1 = over(BASE, { kF: [22, 40], fF: [36, 2], kB: [-12, 42], fB: [-20, 2] });
P.walk2 = over(BASE, { hip: [0, 80], kF: [10, 44], fF: [6, 12], kB: [-6, 40], fB: [-4, 2] });
P.walk3 = over(BASE, { kF: [-10, 42], fF: [-18, 2], kB: [22, 40], fB: [36, 2] });
P.walk4 = over(BASE, { hip: [0, 80], kF: [-6, 40], fF: [-4, 2], kB: [10, 44], fB: [6, 12] });

P.crouch = {
  head: [16, 103], neck: [12, 90], chest: [8, 76], hip: [0, 40],
  sF: [18, 84], eF: [34, 72], hF: [40, 86], sB: [6, 84], eB: [-2, 68], hB: [12, 76],
  kF: [30, 34], fF: [24, 2], kB: [-22, 30], fB: [-18, 2],
};
P.tuck = {
  head: [9, 138], neck: [6, 124], chest: [4, 108], hip: [0, 70],
  sF: [12, 118], eF: [26, 108], hF: [32, 122], sB: [0, 118], eB: [-10, 106], hB: [4, 112],
  kF: [24, 58], fF: [10, 34], kB: [-6, 52], fB: [-18, 34],
};
P.jumpUp = over(P.tuck, { kF: [10, 42], fF: [12, 4], kB: [-8, 44], fB: [-14, 8] });

P.jabC = over(BASE, { eF: [26, 120], hF: [40, 128] });
P.jab = over(BASE, { chest: [8, 118], neck: [10, 134], head: [13, 148], sF: [14, 128], eF: [44, 128], hF: [74, 130], sB: [0, 126], eB: [-6, 108], hB: [10, 116], kF: [22, 40], fF: [32, 2] });

P.kickC = over(BASE, { hip: [0, 80], kF: [26, 70], fF: [16, 40], kB: [-10, 40], fB: [-16, 2], chest: [-4, 118], neck: [-6, 134], head: [-6, 148] });
P.kick = {
  head: [-18, 145], neck: [-16, 131], chest: [-12, 116], hip: [0, 80],
  sF: [-2, 126], eF: [12, 116], hF: [18, 128], sB: [-14, 124], eB: [-26, 110], hB: [-14, 114],
  kF: [40, 88], fF: [88, 98], kB: [-8, 40], fB: [-14, 2],
};
P.highKick = over(P.kick, { kF: [36, 104], fF: [80, 136], head: [-22, 140], neck: [-20, 126], chest: [-14, 112] });

P.cjab = over(P.crouch, { sF: [18, 84], eF: [46, 82], hF: [74, 82], chest: [12, 76], neck: [16, 90], head: [20, 103] });
P.sweep = {
  head: [-12, 98], neck: [-12, 84], chest: [-10, 70], hip: [0, 34],
  sF: [-2, 78], eF: [-18, 60], hF: [-24, 40], sB: [-14, 76], eB: [-26, 56], hB: [-30, 36],
  kF: [40, 14], fF: [98, 6], kB: [-16, 28], fB: [-6, 2],
};
P.jpunch = over(P.tuck, { sF: [12, 118], eF: [38, 100], hF: [62, 86], chest: [8, 108] });
P.jkick = {
  head: [-8, 136], neck: [-8, 122], chest: [-6, 106], hip: [0, 70],
  sF: [-2, 116], eF: [-18, 106], hF: [-10, 94], sB: [-10, 114], eB: [-26, 100], hB: [-20, 88],
  kF: [34, 58], fF: [78, 40], kB: [-8, 56], fB: [-24, 40],
};

P.grabReach = over(BASE, { chest: [10, 116], neck: [14, 132], head: [18, 146], sF: [16, 126], eF: [38, 124], hF: [58, 120], sB: [6, 124], eB: [30, 118], hB: [52, 114], kF: [28, 40], fF: [42, 2] });
P.throw = over(BASE, { chest: [-6, 118], neck: [-8, 134], head: [-8, 148], sF: [4, 130], eF: [20, 152], hF: [18, 176], sB: [-8, 128], eB: [4, 150], hB: [2, 172], kF: [20, 40], fF: [30, 2], kB: [-20, 40], fB: [-30, 2] });

P.blockS = over(BASE, { chest: [-2, 116], neck: [-1, 132], head: [2, 146], sF: [10, 128], eF: [28, 120], hF: [18, 142], sB: [0, 128], eB: [20, 116], hB: [14, 136], kF: [16, 40], fF: [28, 2], kB: [-20, 40], fB: [-32, 2] });
P.blockC = over(P.crouch, { eF: [34, 82], hF: [28, 98], eB: [28, 78], hB: [22, 94] });

P.hit = {
  head: [-26, 138], neck: [-20, 126], chest: [-14, 112], hip: [-4, 76],
  sF: [-10, 122], eF: [-20, 108], hF: [-8, 100], sB: [-22, 120], eB: [-34, 108], hB: [-40, 120],
  kF: [14, 40], fF: [22, 2], kB: [-18, 40], fB: [-24, 2],
};
P.hitLow = over(P.crouch, { head: [-4, 100], neck: [-2, 88], chest: [-2, 74], hF: [-12, 96], hB: [-18, 90] });
P.fall = {
  head: [-58, 94], neck: [-44, 88], chest: [-30, 80], hip: [0, 60],
  sF: [-36, 86], eF: [-38, 108], hF: [-28, 126], sB: [-40, 82], eB: [-54, 100], hB: [-52, 122],
  kF: [26, 76], fF: [46, 94], kB: [20, 64], fB: [44, 70],
};
P.down = {
  head: [-70, 18], neck: [-54, 16], chest: [-38, 14], hip: [0, 12],
  sF: [-46, 18], eF: [-52, 34], hF: [-40, 44], sB: [-44, 12], eB: [-30, 4], hB: [-18, 2],
  kF: [26, 22], fF: [52, 6], kB: [24, 10], fB: [50, 2],
};

P.pushStart = over(BASE, { chest: [-4, 114], neck: [-4, 130], head: [-2, 144], sF: [6, 124], eF: [4, 100], hF: [-6, 96], sB: [-4, 124], eB: [-4, 98], hB: [-10, 92], kF: [22, 40], fF: [32, 2] });
P.push = over(BASE, { chest: [10, 116], neck: [14, 132], head: [18, 146], sF: [14, 126], eF: [44, 122], hF: [70, 120], sB: [6, 124], eB: [40, 118], hB: [66, 116], kF: [30, 40], fF: [44, 2], kB: [-24, 36], fB: [-40, 2] });
P.palm = over(P.push, { hF: [86, 112], eF: [56, 116], hB: [-10, 104], eB: [-4, 112] });

P.claw = {
  head: [16, 160], neck: [12, 146], chest: [8, 130], hip: [0, 90],
  sF: [16, 140], eF: [30, 166], hF: [36, 196], sB: [2, 138], eB: [-10, 124], hB: [-2, 116],
  kF: [20, 56], fF: [14, 20], kB: [-10, 60], fB: [-18, 30],
};
P.dash = {
  head: [40, 132], neck: [30, 122], chest: [20, 110], hip: [0, 74],
  sF: [26, 118], eF: [46, 108], hF: [66, 112], sB: [14, 116], eB: [0, 100], hB: [-8, 110],
  kF: [24, 36], fF: [10, 2], kB: [-24, 44], fB: [-50, 20],
};
P.windmill1 = {
  head: [-54, 22], neck: [-40, 26], chest: [-26, 30], hip: [0, 40],
  sF: [-28, 30], eF: [-30, 16], hF: [-30, 2], sB: [-20, 30], eB: [-22, 16], hB: [-20, 2],
  kF: [26, 70], fF: [50, 100], kB: [30, 40], fB: [64, 50],
};
P.windmill2 = over(P.windmill1, { kF: [-6, 72], fF: [-20, 106], kB: [34, 62], fB: [66, 80] });
P.dive = {
  head: [48, 62], neck: [36, 68], chest: [24, 76], hip: [0, 90],
  sF: [26, 78], eF: [20, 100], hF: [6, 122], sB: [18, 80], eB: [10, 104], hB: [-6, 128],
  kF: [-24, 96], fF: [-46, 104], kB: [-20, 86], fB: [-44, 86],
};
P.draw = over(BASE, { chest: [10, 112], neck: [14, 126], head: [20, 138], sF: [14, 122], eF: [38, 80], hF: [56, 30], kF: [24, 38], fF: [34, 2] });
P.eraser = over(P.push, { hF: [92, 104], eF: [62, 110], hB: [74, 128], eB: [46, 124] });
P.win = over(BASE, { sF: [10, 130], eF: [14, 160], hF: [12, 192], sB: [0, 128], eB: [-14, 106], hB: [-4, 86], kF: [12, 40], fF: [16, 2], kB: [-12, 40], fB: [-18, 2] });
P.win2 = over(P.win, { hF: [14, 196], eF: [16, 164], head: [9, 150], neck: [6, 136] });

M.POSES = P;

// 두 포즈 선형 보간
M.lerpPose = function (a, b, k) {
  const out = {};
  const u = k < 0 ? 0 : k > 1 ? 1 : k;
  for (const j of J) out[j] = [a[j][0] + (b[j][0] - a[j][0]) * u, a[j][1] + (b[j][1] - a[j][1]) * u];
  return out;
};

// 상태 → 포즈 선택 (렌더 전용, 로직에 영향 없음)
M.poseOf = function (f, t) {
  const L = M.lerpPose;
  const mv = f.mv;
  const s = f.state;
  if (s === 'ko' || s === 'down') return P.down;
  if (s === 'airhit') return f.vy > 0 ? L(P.hit, P.fall, f.stT * 4) : P.fall;
  if (s === 'hitstun') return f.inp && f.inp.down ? P.hitLow : P.hit;
  if (s === 'blockstun') return f.inp && f.inp.down ? P.blockC : P.blockS;
  if (s === 'win') return L(P.win, P.win2, 0.5 + 0.5 * Math.sin(t * 6));
  if (mv) {
    const d = mv.d, mt = mv.t;
    const three = (pre, ext, startup, active, rec) => {
      if (mt < startup) return L(pre === 'crouch' ? P.crouch : pre === 'tuck' ? P.tuck : P.idle, ext[0], mt / Math.max(0.01, startup));
      if (mt < startup + active) return ext[1];
      return L(ext[1], pre === 'crouch' ? P.crouch : pre === 'tuck' ? P.tuck : P.idle, (mt - startup - active) / Math.max(0.01, rec));
    };
    switch (mv.kind) {
      case 'normal': {
        const map = { lp: ['idle', P.jabC, P.jab], hp: ['idle', P.kickC, P.kick], clp: ['crouch', P.crouch, P.cjab], chp: ['crouch', P.crouch, P.sweep], jlp: ['tuck', P.tuck, P.jpunch], jhp: ['tuck', P.tuck, P.jkick] };
        const m = map[mv.key];
        if (d.band === 'air') return mt < d.startup ? L(P.tuck, m[2], mt / d.startup) : m[2];
        return three(m[0], [m[1], m[2]], d.startup, d.active, d.recovery);
      }
      case 'grab': return mv.hits ? P.throw : three('idle', [P.grabReach, P.grabReach], d.startup, d.active, d.recovery);
      case 'cmdgrab': return mv.hits ? P.throw : L(P.idle, P.grabReach, mt / Math.max(0.01, d.startup));
      case 'projectile': return mt < d.startup ? L(P.idle, P.pushStart, mt / d.startup) : P.push;
      case 'rising': return mt < d.startup ? P.crouch : P.claw;
      case 'rush':
        if (mv.connected === 'hit') return Math.floor(mt / 0.07) % 2 ? P.jab : P.kick;
        return mt < d.startup ? P.pushStart : P.dash;
      case 'dash': return mt < d.startup ? P.crouch : (mt < d.startup + d.active * 0.5 ? P.dash : P.claw);
      case 'spin': return mt < d.startup ? P.crouch : (Math.floor(mt / 0.09) % 2 ? P.windmill2 : P.windmill1);
      case 'dive': return mv.phase <= 1 ? P.tuck : mv.phase === 2 ? P.dive : P.crouch;
      case 'chain': return mt < d.startup ? P.kickC : (Math.floor((mt - d.startup) / d.gap) % 2 ? P.highKick : P.kick);
      case 'push': return mt < d.startup ? P.pushStart : P.palm;
      case 'teleport': return P.crouch;
      case 'trap': case 'wall': return mt < d.startup ? L(P.idle, P.draw, mt / d.startup) : P.draw;
      case 'eraser': return mt < d.startup ? P.pushStart : P.eraser;
    }
  }
  if (s === 'jump') return f.vy > 200 ? P.jumpUp : P.tuck;
  if (s === 'crouch') return P.crouch;
  if (s === 'walk') {
    const ph = ((f.stT * (f.def.speed / 95)) % 1 + 1) % 1;
    const frames = [P.walk1, P.walk2, P.walk3, P.walk4];
    const i = Math.floor(ph * 4), k = ph * 4 - i;
    const a = frames[i], b = frames[(i + 1) % 4];
    const pose = L(a, b, k);
    return (f.vx * f.face) < 0 ? L(pose, P.blockS, 0.25) : pose;
  }
  if (f.invuln > 0 && f.stT < 0.25) return L(P.crouch, P.idle, f.stT / 0.25);
  return L(P.idle, P.idle2, 0.5 + 0.5 * Math.sin(t * 3 + f.side));
};
