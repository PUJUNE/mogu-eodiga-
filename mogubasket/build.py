# build.py — mogubasket/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogubasket.html (THREE.js·모구 얼굴 사진 내장 — 더블클릭 실행, 외부 의존 없음)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogubasket.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) THREE.js 내장 (모구의 마블과 같은 r128)
three = (HERE / "vendor" / "three.min.js").read_text(encoding="utf-8")
html = html.replace('<script src="vendor/three.min.js"></script>', "<script>\n" + three + "\n</script>")

# 2) 모구 얼굴 사진 → base64 (모구 송편공장과 같은 사진)
face = "data:image/png;base64," + base64.b64encode((HERE / "assets" / "mogu-face.png").read_bytes()).decode()
html = html.replace('window.MBK = { ASSETS: { mogu: "assets/mogu-face.png" } };', 'window.MBK = { ASSETS: { mogu: "%s" } };' % face)

# 3) 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "data.js", "logic.js", "ai.js", "render3d.js", "audio.js", "ui.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    merged.append("/* ── %s ── */\n{\n%s\n}" % (name, code))
merged_js = "\n".join(merged)
html = re.sub(r'(<script src="src/[^"]+"></script>\s*)+', lambda m: "<script>\n" + merged_js + "\n</script>\n", html)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
