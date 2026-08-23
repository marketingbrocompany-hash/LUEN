from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "assets/css/site.css"
INDEX_PATH = ROOT / "index.html"

DEAD_SELECTOR_MARKERS = (
    ".luen-hero-network",
    ".lhn-",
    "#networkCard",
    "body::before",
    ".top-strip .container::before",
    ".hero::before",
    ".hero-grid",
    ".luen-content-system-v9",
    ".lcs-",
    ".yt-thesis",
    ".content-thesis",
    ".guide-signal",
    ".chart-gridline",
    ".chart-runner",
    ".chart-area",
    ".campaign-rail",
    ".campaign-output",
    ".final-grid",
    ".final-orbit",
    ".final-lines",
    ".market-map-grid",
    ".market-map-caption",
    ".market-hub::before",
    ".market-hub::after",
)

DEAD_KEYFRAME_PREFIXES = ("lhn", "lcs", "final")
DEAD_KEYFRAME_NAMES = {
    "luenOrbit",
    "luenHubFloat",
    "networkSweepImpact",
    "heroSignalFlow",
    "centerImpactGlow",
    "signalBlink",
}

CONTAINER_AT_RULES = ("@media", "@supports", "@layer", "@container", "@document")


def consume_leading(text: str, pos: int):
    start = pos
    n = len(text)
    while pos < n:
        if text[pos].isspace():
            pos += 1
            continue
        if text.startswith("/*", pos):
            end = text.find("*/", pos + 2)
            if end == -1:
                return text[start:], n
            pos = end + 2
            continue
        break
    return text[start:pos], pos


def find_header_end(text: str, pos: int):
    paren = bracket = 0
    quote = None
    escape = False
    i = pos
    n = len(text)
    while i < n:
        if quote:
            ch = text[i]
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end == -1:
                return n, None
            i = end + 2
            continue
        ch = text[i]
        if ch in "\"'":
            quote = ch
        elif ch == "(":
            paren += 1
        elif ch == ")":
            paren = max(0, paren - 1)
        elif ch == "[":
            bracket += 1
        elif ch == "]":
            bracket = max(0, bracket - 1)
        elif paren == 0 and bracket == 0 and ch in "{;":
            return i, ch
        i += 1
    return n, None


def find_matching_brace(text: str, open_pos: int):
    depth = 1
    quote = None
    escape = False
    i = open_pos + 1
    n = len(text)
    while i < n:
        if quote:
            ch = text[i]
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end == -1:
                raise ValueError("Unterminated CSS comment")
            i = end + 2
            continue
        ch = text[i]
        if ch in "\"'":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("Unbalanced CSS braces")


def split_selectors(prelude: str):
    parts = []
    start = 0
    paren = bracket = 0
    quote = None
    escape = False
    i = 0
    while i < len(prelude):
        if quote:
            ch = prelude[i]
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if prelude.startswith("/*", i):
            end = prelude.find("*/", i + 2)
            i = len(prelude) if end == -1 else end + 2
            continue
        ch = prelude[i]
        if ch in "\"'":
            quote = ch
        elif ch == "(":
            paren += 1
        elif ch == ")":
            paren = max(0, paren - 1)
        elif ch == "[":
            bracket += 1
        elif ch == "]":
            bracket = max(0, bracket - 1)
        elif ch == "," and paren == 0 and bracket == 0:
            parts.append(prelude[start:i].strip())
            start = i + 1
        i += 1
    parts.append(prelude[start:].strip())
    return [part for part in parts if part]


def is_dead_selector(selector: str):
    return any(marker in selector for marker in DEAD_SELECTOR_MARKERS)


def keyframe_name(prelude: str):
    match = re.match(r"@(?:-webkit-)?keyframes\s+([^\s{]+)", prelude.strip(), re.I)
    return match.group(1) if match else None


def is_dead_keyframe(name: str | None):
    if not name:
        return False
    return name in DEAD_KEYFRAME_NAMES or name.startswith(DEAD_KEYFRAME_PREFIXES)


stats = {"rules": 0, "selectors": 0, "keyframes": 0, "empty_at_rules": 0}


def process_rule_list(text: str):
    out = []
    pos = 0
    n = len(text)
    while pos < n:
        leading, pos = consume_leading(text, pos)
        if pos >= n:
            out.append(leading)
            break

        header_end, terminator = find_header_end(text, pos)
        if terminator is None:
            out.append(leading + text[pos:])
            break

        prelude_raw = text[pos:header_end]
        prelude = prelude_raw.strip()

        if terminator == ";":
            out.append(leading + text[pos:header_end + 1])
            pos = header_end + 1
            continue

        close = find_matching_brace(text, header_end)
        block = text[header_end + 1:close]
        lower = prelude.lower()

        if lower.startswith("@keyframes") or lower.startswith("@-webkit-keyframes"):
            name = keyframe_name(prelude)
            if is_dead_keyframe(name):
                stats["keyframes"] += 1
                out.append(leading)
            else:
                out.append(leading + text[pos:close + 1])
            pos = close + 1
            continue

        if prelude.startswith("@"):
            if lower.startswith(CONTAINER_AT_RULES):
                processed = process_rule_list(block)
                meaningful = re.sub(r"/\*.*?\*/", "", processed, flags=re.S).strip()
                if meaningful:
                    out.append(leading + prelude_raw + "{" + processed + "}")
                else:
                    stats["empty_at_rules"] += 1
                    out.append(leading)
            else:
                out.append(leading + text[pos:close + 1])
            pos = close + 1
            continue

        selectors = split_selectors(prelude_raw)
        kept = [selector for selector in selectors if not is_dead_selector(selector)]
        removed = len(selectors) - len(kept)
        stats["selectors"] += removed
        if not kept:
            stats["rules"] += 1
            out.append(leading)
        else:
            selector_text = ",".join(kept)
            out.append(leading + selector_text + "{" + block + "}")
        pos = close + 1

    return "".join(out)


def assert_balanced(text: str):
    depth = 0
    quote = None
    escape = False
    i = 0
    while i < len(text):
        if quote:
            ch = text[i]
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end == -1:
                raise AssertionError("Unterminated CSS comment after pruning")
            i = end + 2
            continue
        ch = text[i]
        if ch in "\"'":
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                raise AssertionError("CSS closes more braces than it opens")
        i += 1
    if depth != 0 or quote:
        raise AssertionError("CSS is unbalanced after pruning")


before = CSS_PATH.read_text(encoding="utf-8")
after = process_rule_list(before)
assert_balanced(after)

for marker in (".luen-hero-network", ".lhn-", "#networkCard"):
    if marker in after:
        raise AssertionError(f"Dead hero selector remains: {marker}")

for selector in (".hero-layout", ".market-network-v2", ".portfolio-card", ".case-card", ".faq-q", ".contact-form", ".brand-wall"):
    if selector not in after:
        raise AssertionError(f"Required active selector disappeared: {selector}")

if len(after) >= len(before):
    raise AssertionError("Pruning did not reduce site.css")

CSS_PATH.write_text(after, encoding="utf-8")

index = INDEX_PATH.read_text(encoding="utf-8")
old_version = 'assets/css/site.css?v=20260823-5'
new_version = 'assets/css/site.css?v=20260823-6'
if old_version not in index:
    raise AssertionError("Expected site.css cache version not found")
index = index.replace(old_version, new_version, 1)
INDEX_PATH.write_text(index, encoding="utf-8")

saved = len(before) - len(after)
print(f"site.css: {len(before)} -> {len(after)} bytes; saved {saved} bytes ({saved/len(before)*100:.1f}%)")
print("removed", stats)
