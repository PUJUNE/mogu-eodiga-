# build.py — mogudragon/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogudragon.html (더블클릭 실행, 외부 의존 없음)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogudragon.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI (모구 스프라이트는 game/assets 재사용)
def data_uri(p):
    b = (HERE.parent / p).read_bytes()
    return "data:image/png;base64," + base64.b64encode(b).decode()

# CC0 에셋 (ansimuz "Streets of Fight" — 팩 동봉 라이선스 PDF에 CC0 명시) + 모구 아이콘
SOF = "mogudragon/assets/sof/"
ASSETS = {
    "mogu": "game/assets/mogu-icon.png",
    "g_idle": SOF + "g_idle.png", "g_walk": SOF + "g_walk.png", "g_jab": SOF + "g_jab.png",
    "g_punch": SOF + "g_punch.png", "g_kick": SOF + "g_kick.png", "g_jump": SOF + "g_jump.png",
    "g_jumpkick": SOF + "g_jump_kick.png", "g_divekick": SOF + "g_dive_kick.png", "g_hurt": SOF + "g_hurt.png",
    "p_idle": SOF + "p_idle.png", "p_walk": SOF + "p_walk.png", "p_punch": SOF + "p_punch.png", "p_hurt": SOF + "p_hurt.png",
    "st_back": SOF + "st_back.png", "st_fore": SOF + "st_fore.png",
    "pr_barrel": SOF + "pr_barrel.png", "pr_car": SOF + "pr_car.png", "pr_hydrant": SOF + "pr_hydrant.png",
    "pr_sushi1": SOF + "pr_sushi1.png", "pr_sushi2": SOF + "pr_sushi2.png", "pr_banner1": SOF + "pr_banner1.png",
}
pairs = ", ".join('%s: "%s"' % (k, data_uri(v)) for k, v in ASSETS.items())
assets_js = "window.MDG = { ASSETS: { %s } };" % pairs
html = re.sub(
    r'<script>window\.MDG = \{ ASSETS: .*?\};</script>',
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
