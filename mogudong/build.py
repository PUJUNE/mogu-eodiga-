# build.py — mogudong/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogudong.html (더블클릭 실행, 외부 의존 없음)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogudong.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI (모구 스프라이트는 moguski/assets 재사용)
def data_uri(p):
    b = (HERE.parent / p).read_bytes()
    return "data:image/png;base64," + base64.b64encode(b).decode()

# 타이틀 아이콘 · 인게임 모구 모두 모구 스키점프와 같은 스프라이트를 쓴다
assets_js = 'window.MDD = { ASSETS: { mogu: "%s" } };' % data_uri("moguski/assets/mogu-ski.png")
html = re.sub(
    r'<script>window\.MDD = \{ ASSETS: .*?\};</script>',
    lambda m: "<script>" + assets_js + "</script>",
    html,
    flags=re.S,
)

# 2) 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "levels.js", "logic.js", "render.js", "audio.js", "ui.js", "main.js"]
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
