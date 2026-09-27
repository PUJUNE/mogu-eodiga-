# build.py — mogusongpyeon/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogusongpyeon.html (더블클릭 실행, 외부 의존 없음 — 모구 얼굴 사진만 내장, 나머지는 캔버스 드로잉)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogusongpyeon.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI (모구 얼굴 = June이 준 9월 9일 사진에서 머리만 오려 낸 것)
def data_uri(p):
    b = (HERE.parent / p).read_bytes()
    return "data:image/png;base64," + base64.b64encode(b).decode()

assets_js = 'window.MSP = { ASSETS: { mogu: "%s" } };' % data_uri("mogusongpyeon/assets/mogu-face.png")
html = re.sub(
    r'<script>window\.MSP = \{ ASSETS: .*?\};</script>',
    lambda m: "<script>" + assets_js + "</script>",
    html,
    flags=re.S,
)

# 2) 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "data.js", "logic.js", "render.js", "audio.js", "ui.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    merged.append("/* ── %s ── */\n{\n%s\n}" % (name, code))
merged_js = "\n".join(merged)

html = re.sub(
    r'(<script src="src/[^"]+"></script>\s*)+',
    lambda m: "<script>\n" + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
