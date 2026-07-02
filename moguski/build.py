# build.py — moguski/ 모듈들을 단일 배포 html로 병합
# 산출물: ../moguski.html (더블클릭 실행, three.js만 CDN)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "moguski.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI
def data_uri(p):
    b = (HERE.parent / p).read_bytes()
    return "data:image/png;base64," + base64.b64encode(b).decode()

assets_js = 'window.MSJ = { ASSETS: { mogu: "%s" } };' % data_uri("moguski/assets/mogu-ski.png")
html = re.sub(
    r'<script>window\.MSJ = \{ ASSETS: .*?\};</script>',
    lambda m: "<script>" + assets_js + "</script>",
    html,
    flags=re.S,
)

# 2) 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "levels.js", "logic.js", "render.js", "audio.js", "ui.js", "main.js"]
merged = ["import * as THREE from 'three';"]
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    code = re.sub(r"^import .*?;\s*$", "", code, flags=re.M)  # 개별 import 제거
    merged.append("/* ── %s ── */\n{\n%s\n}" % (name, code))
merged_js = "\n".join(merged)

html = re.sub(
    r'(<script type="module" src="src/[^"]+"></script>\s*)+',
    lambda m: '<script type="module">\n' + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
