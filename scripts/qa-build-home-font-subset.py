#!/usr/bin/env python3
"""Build a *temporary CI-only* homepage glyph subset of official Pretendard v1.3.9.

No source font or derived font is added to Git, uploaded as a QA artifact, or
linked to the user. It is created in an ephemeral GitHub Actions workspace.
This is a performance experiment, not an approved replacement webfont.
"""
import html
import json
import pathlib
import re
import urllib.request
from html.parser import HTMLParser
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path.cwd()
ROOT_HTML = (ROOT / "index.html").read_text(encoding="utf-8")
OUTPUT = ROOT / "qa-temp-font-pilot"
OUTPUT.mkdir(parents=True, exist_ok=True)

URL = (
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/"
    "packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"
)
FONT = OUTPUT / "pretendard-original-CI-ONLY.woff2"
with urllib.request.urlopen(
    urllib.request.Request(URL, headers={"User-Agent": "LUEN-CI-FontPilot/1.0"}), timeout=65
) as response:
    if response.status != 200:
        raise RuntimeError(f"upstream status {response.status}")
    data = response.read(4_500_001)
    if len(data) < 100_000 or len(data) > 4_500_000 or not data.startswith(b"wOF2"):
        raise RuntimeError("Unexpected upstream Pretendard v1.3.9 font asset")
    FONT.write_bytes(data)

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.suppress = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template"):
            self.suppress += 1
        if not self.suppress:
            for k, v in attrs:
                if k in ("alt", "aria-label", "placeholder", "title", "value") and v:
                    self.parts.append(v)
    def handle_endtag(self, tag):
        if tag in ("script", "style", "template"):
            self.suppress = max(0, self.suppress - 1)
    def handle_data(self, data):
        if not self.suppress:
            self.parts.append(data)

parser = VisibleText()
parser.feed(ROOT_HTML)
text = html.unescape(" ".join(parser.parts))
# Preserve dynamic labels rendered after interaction by JS without bulk
# inclusion of developers' source-code comments and unrelated pages.
for js in ["assets/js/site.js", "assets/js/site-core.js", "assets/js/luen-motion-hero.js"]:
    source = (ROOT / js).read_text(encoding="utf-8")
    text += " " + " ".join(re.findall(r"[가-힣]{2,}", source))
# A small stable character safety buffer, not the entire Unicode Hangul range.
text += " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
text += " !#$%&*+-./:;=?@_()[]{}<>|←↑→↓×·—–〜~㈜ⓒ"
codepoints = sorted(set(map(ord, text)))
# Keep all normal visible symbols and Hangul while avoiding accidental
# codepoints from markup/script sources outside Pretendard's scope.
codepoints = [c for c in codepoints if c >= 32 and c not in (0xFEFF,)]
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.notdef_glyph = True
options.notdef_outline = True
font = TTFont(str(FONT))
subset_obj = subset.Subsetter(options=options)
subset_obj.populate(unicodes=codepoints)
subset_obj.subset(font)
DERIVED = OUTPUT / "pretendard-home-CI-ONLY.woff2"
font.save(str(DERIVED))
font.close()
FONT.unlink()  # Source font never appears in CI artifacts.
if not DERIVED.read_bytes().startswith(b"wOF2"):
    raise RuntimeError("Invalid WOFF2 derived file")
# Explicit unicode-range prevents missing glyphs from shadowing the original
# official CDN @font-face rules; fallback coverage remains available.
css = (
    "@font-face { font-family: 'Pretendard Variable'; font-style: normal; "
    "font-weight: 45 920; font-display: swap; "
    "src: url('./pretendard-home-CI-ONLY.woff2') format('woff2-variations'); "
    "unicode-range: " + ",".join(f"U+{cp:X}" for cp in codepoints) + "; }"
)
(OUTPUT / "pretendard-home.css").write_text(css, encoding="utf-8")
meta = {
    "glyphs_requested": len(codepoints),
    "derived_bytes": DERIVED.stat().st_size,
    "original_bytes": len(data),
    "reduction_pct": round(100 * (1 - DERIVED.stat().st_size / len(data)), 1),
    "upstream": "official orioncactus Pretendard Variable v1.3.9",
    "source_license": "SIL Open Font License 1.1",
    "CI_only": True,
}
(OUTPUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("LUEN_TEMP_FONT_META " + json.dumps(meta, ensure_ascii=False))
