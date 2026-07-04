# build.py — mogusamguk/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogusamguk.html (더블클릭 실행, 외부 의존 없음)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogusamguk.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI (모구 스프라이트는 game/assets 재사용)
def data_uri(p):
    b = (HERE.parent / p).read_bytes()
    return "data:image/png;base64," + base64.b64encode(b).decode()

# CC0 에셋 (OGA "American/Asian/European City Tilesets" — 퍼블릭 도메인) + 모구 아이콘
ASSETS = {
    "mogu": "game/assets/mogu-icon.png",
    "bldDark": "mogusamguk/assets/bld_dark.png",
    "shopRed": "mogusamguk/assets/shop_red.png",
    "colRed": "mogusamguk/assets/col_red.png",
    "signCat1": "mogusamguk/assets/sign_cat1.png",
    "signCat2": "mogusamguk/assets/sign_cat2.png",
    "statue": "mogusamguk/assets/statue.png",
    "lantern2": "mogusamguk/assets/lantern2.png",
}
pairs = ", ".join('%s: "%s"' % (k, data_uri(v)) for k, v in ASSETS.items())
assets_js = "window.MSG = { ASSETS: { %s } };" % pairs
html = re.sub(
    r'<script>window\.MSG = \{ ASSETS: .*?\};</script>',
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
