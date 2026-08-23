from pathlib import Path
import html as html_lib
import re

index_path = Path('index.html')
core_path = Path('assets/js/site-core.js')
overrides_path = Path('assets/css/site-overrides.css')

html = index_path.read_text(encoding='utf-8')
core = core_path.read_text(encoding='utf-8')
overrides = overrides_path.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, f'{label}: expected 1 occurrence, found {count}'
    return text.replace(old, new, 1)


def remove_once(text, old, label):
    return replace_once(text, old, '', label)


def remove_regex_once(text, pattern, label, flags=0):
    updated, count = re.subn(pattern, '', text, count=1, flags=flags)
    assert count == 1, f'{label}: expected 1 match, found {count}'
    return updated


def remove_balanced_div(text, start_marker, label):
    start = text.find(start_marker)
    assert start >= 0, f'{label}: start marker not found'
    tag_re = re.compile(r'<(/?)div\b[^>]*>', re.I)
    depth = 0
    end = None
    for match in tag_re.finditer(text, start):
        if match.group(1):
            depth -= 1
            if depth == 0:
                end = match.end()
                break
        else:
            depth += 1
    assert end is not None, f'{label}: matching closing div not found'
    if end < len(text) and text[end] == '\n':
        end += 1
    return text[:start] + text[end:]


# 1) Move the last homepage-specific inline CSS block into the production override stylesheet.
style_pattern = r'\n?<style id="case-campaign-label-override">\n?(.*?)\n?</style>\n?'
style_match = re.search(style_pattern, html, flags=re.S)
assert style_match, 'inline campaign/client style block not found'
inline_css = style_match.group(1).strip()
html = html[:style_match.start()] + '\n' + html[style_match.end():]
assert inline_css not in overrides, 'inline style already present in site-overrides.css'
overrides = overrides.rstrip() + '\n\n/* HOMEPAGE CAMPAIGN / SELECTED CLIENTS · moved from inline head style */\n' + inline_css + '\n'

# 2) Make Case Study inquiry context and card CTAs static HTML.
source_input = '<input name="source" type="hidden" value="LUEN Website"/>\n'
source_with_case = source_input + '<input name="source_case" type="hidden" value=""/>\n'
html = replace_once(html, source_input, source_with_case, 'static source_case input')

case_classes = ['case-01', 'case-02', 'case-03', 'case-04']
for case_class in case_classes:
    pattern = re.compile(
        rf'(<article class="case-card {case_class}">.*?<div class="case-body">.*?<h3>(.*?)</h3>.*?<p class="case-desc">.*?</p>)(</div></article>)',
        re.S,
    )
    match = pattern.search(html)
    assert match, f'{case_class}: case card body not found'
    case_name = re.sub(r'<[^>]+>', '', match.group(2)).strip()
    escaped_name = html_lib.escape(case_name, quote=True)
    cta = (
        f'<a class="case-inquiry-btn case-card-cta" href="#contact" '
        f'data-source-case="{escaped_name}" '
        f'data-analytics-label="{escaped_name} 사례 기반 캠페인 상담">'
        '이 사례와 비슷한 캠페인 상담하기 <i aria-hidden="true">→</i></a>'
    )
    replacement = match.group(1) + cta + match.group(3)
    html = html[:match.start()] + replacement + html[match.end():]

general_cta_old = '<a class="case-inquiry-btn" href="#contact">캠페인 가능성 상담하기<i>→</i></a>'
general_cta_new = '<a class="case-inquiry-btn" href="#contact" data-source-case="case_studies_general" data-analytics-label="Case Study 섹션 캠페인 상담">캠페인 가능성 상담하기<i>→</i></a>'
html = replace_once(html, general_cta_old, general_cta_new, 'general case CTA attributes')

# Replace the runtime Case Study DOM construction with state-only behavior.
case_runtime_start = '  // Step 9 — connect each Case Study directly to the inquiry form with context.\n'
listener_start = '  document.querySelectorAll(\'a[href="#contact"][data-source-case]\').forEach(link=>{\n'
start = core.find(case_runtime_start)
listener = core.find(listener_start)
assert start >= 0 and listener > start, 'dynamic Case Study construction block not found'
static_runtime = (
    '  // Case Study inquiry context is static in index.html; JS only updates selection state.\n'
    "  const inquiryFormForCase=document.getElementById('contactForm');\n"
    "  const sourceCaseInput=inquiryFormForCase?.querySelector('input[name=\"source_case\"]');\n\n"
)
core = core[:start] + static_runtime + core[listener:]

# 3) Remove DOM that the final design permanently hides.
html = remove_once(html, '<div aria-hidden="true" class="hero-grid"></div>\n', 'hero grid DOM')
html = remove_once(html, '<div aria-hidden="true" class="market-map-grid"></div>\n', 'platform grid DOM')
html = remove_regex_once(html, r'<div class="market-map-caption"><span>.*?</span><b>.*?</b></div>\n?', 'platform caption DOM', re.S)
html = remove_balanced_div(html, '<div aria-label="LUEN 콘텐츠 설계 시스템" class="luen-content-system-v9">', 'hidden content diagram')
html = remove_regex_once(html, r'<div class="yt-thesis sr d2 content-thesis">.*?</div>\n?', 'hidden content thesis', re.S)
html = remove_once(html, '<div class="guide-signal"><span></span><span></span><span></span></div>\n', 'guide signal DOM')
html = remove_regex_once(html, r'<path class="chart-gridline"[^>]*></path>\n?', 'chart gridline DOM')
html = remove_regex_once(html, r'<circle class="chart-runner growth-runner-v93" r="4\.2">.*?</circle>\n?', 'chart runner DOM', re.S)
html = remove_once(html, '<div class="campaign-rail"><span></span></div>\n', 'campaign rail DOM')
html = remove_regex_once(html, r'<div class="campaign-output sr d2">.*?</div>\n?', 'campaign output DOM', re.S)
html = remove_once(html, '<div aria-hidden="true" class="final-grid"></div>\n', 'final grid DOM')
html = remove_once(html, '<div aria-hidden="true" class="final-orbit o1"></div><div aria-hidden="true" class="final-orbit o2"></div>\n', 'final orbit DOM')
html = remove_once(html, '<div aria-hidden="true" class="final-lines"><i></i><i></i><i></i><i></i></div>\n', 'final lines DOM')

# 4) Remove dead mobile-case-more runtime (the button no longer exists in static HTML).
mobile_case_pattern = r'\n;\n\n\(\(\)=>\{\n  const section=document\.querySelector\(\'\.case-studies\'\);\n  const button=document\.querySelector\(\'\.mobile-case-more\'\);.*?\n\}\)\(\);\s*$'
core, mobile_count = re.subn(mobile_case_pattern, '\n', core, count=1, flags=re.S)
assert mobile_count == 1, f'mobile-case-more runtime: expected 1 block, found {mobile_count}'

# Cache-bust only the files changed in this pass.
html = replace_once(html, 'assets/css/site-overrides.css?v=20260823-5', 'assets/css/site-overrides.css?v=20260823-6', 'site-overrides cache version')
html = replace_once(html, 'assets/js/site-core.js?v=20260823-4', 'assets/js/site-core.js?v=20260823-5', 'site-core cache version')

index_path.write_text(html, encoding='utf-8')
core_path.write_text(core, encoding='utf-8')
overrides_path.write_text(overrides, encoding='utf-8')

print('Final static cleanup transform complete.')
