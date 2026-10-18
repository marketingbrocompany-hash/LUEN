# LUEN Code Audit — 2026-10-17

## Current branch and deployment policy
- Baseline PR #140: case-detail POP and moving thumbnail lanes
- Stacked PR #141: homepage editorial motion
- Stacked PR #142: homepage design finish
- This PR: runtime fallback, critical background fix, stale heading-rule removal, static QA.
- Do **not** merge downstream PRs into main before upstream PRs are validated.
- Vercel team-scoped integration returned HTTP 403; Preview deployment success does not equal real-screen QA.

## Verified defects fixed
1. Homepage critical CSS enforced warm ivory even over the intended brand-wall beige and could flash a dark footer.
2. `.sr` elements relied on successful JavaScript to become visible; no-JS and reduced-motion paths now show content.
3. Heading-specific `.case-selected-work-head-v10` CSS survived after removing the corresponding heading HTML.

## Audited legacy files — do not delete without explicit impact review
These 8 stylesheets were not linked from the audited 23 HTML pages (approximately 148KB **repository size**, not network payload):
- `assets/css/creator-metrics-align.css`
- `assets/css/hero-positioning.css`
- `assets/css/site-overrides-base.css`
- `assets/css/site-overrides-current.css`
- `assets/css/site-overrides-foundation.css`
- `assets/css/site-overrides-polish.css`
- `assets/css/site-overrides-pre-rounding.css`
- `assets/css/site-overrides.css`

`assets/js/offline-activation.js` has no direct HTML script tag; however the active case loader imports `assets/js/offline-activation-core.js`. Preserve both until dependency ownership is confirmed.

## Historical asset manifest
`asset-manifest.json` has 28 entries; 26 legacy paths no longer exist in the repository and the remaining two byte counts differ. This is an old optimization inventory, **not the live asset lookup source**. The runtime HTML asset paths were checked separately. Keep the file for traceability until a fresh inventory format is agreed.

## Stylesheet debt
- `site.css`: approximately 90KB, 823 `!important` declarations.
- `luen-v3.css`: approximately 209KB, over 3,000 `!important` declarations.
- Avoid wholesale deletion/reformatting before desktop/mobile visual comparison. Consolidate one section at a time in separately reviewed PRs.

## Automated checks
- `node scripts/check-site.mjs` validates internal file links and page-local anchors, duplicate IDs, inline scripts, JavaScript syntax, JSON-LD, CSS brace counts, and key homepage content regressions.
- Known historical manifest drift is a **warning**, not a blocking error.
- GitHub Actions runs the script on pull requests and pushes to main (where Actions are enabled).

## Remaining QA
- Browser rendering and real device behavior (PC, mobile Safari, Android Chrome).
- Thumbnail strip actual loop continuity, responsive image cropping, case POP media, form success/failure, CLS/LCP and reduced-motion.
- The static checker cannot verify those behaviors or detect CSS visual overlap.

## 2026-10-17 incremental Services cleanup

After comparing the current 23 HTML pages and runtime scripts, the following selectors were confirmed to have no runtime markup consumers and were removed from `assets/css/luen-v3.css`:
- `.luen-service-goal-strip` and related descendant/hover rules
- `.luen-service-choice-desc`
- `.luen-service-choice-options>span` (current options use detail rows and the separate `.luen-service-choice-episodes`)

The remaining `.luen-service-choice`, `.luen-service-choice-options-detail`, and TikTok episode styles were retained. The eight unreferenced historical CSS files remain in version control for now. This cleanup does not change business claims, copy, page structure, or animation handlers.


## 2026-10-17 homepage UI/UX static re-audit (mobile navigation and motion)

Scope: latest stacked feature branch after PR #151. Checked homepage DOM, site.js, site-core.js, luen-motion.js, main CSS layers, mobile navigation selectors, hero/profile images, loop initialization, CTA and inquiry form hooks. Code review is **not** a screenshot or real-device render.

### Confirmed and fixed in the next stacked PR
1. **Mobile hamburger contrast:** `#nav .hamburger span` inherited the old dark-theme `var(--cream)` against an ivory header; its border also used a low-contrast old-theme line token. Changed strokes to `#2A2521` and border to warm neutral `rgba(74,66,60,.38)`. The LUEN orange dot, logo and layout remain unchanged.
2. **Mobile menu with short viewport:** Fullscreen overlay links were vertically centered without scroll; on compact-height browsers or landscape, lower actions risked becoming unreachable. The menu can now scroll vertically and uses tighter layout when height is at most 600px. The dark overlay palette and existing links are retained.
3. **Menu open while crossing into desktop breakpoint:** The menu locked `body` scroll until manually closed. If screen width passed the 820px mobile breakpoint, the overlay could remain open. A `matchMedia('(min-width:821px)')` change listener now closes it, unlocks scrolling and restores keyboard focus to the site logo.
4. **Live reduced-motion preference:** Core loop controllers checked the preference during initial setup and each animation tick but did not subscribe to later system preference changes. The handler now cancels active loops and clears movement when Reduce Motion turns on, then safely rebuilds moving strips when turned off. Existing iOS-specific loop implementation and thumbnail content are unchanged.
5. Shared CSS/JS cache versions updated consistently for the **20 HTML pages** using the main design system. Static QA includes new checks for the fixes, which must pass before integration.

### Findings not changed without browser/device confirmation
- The homepage contains 21 `img` elements, all with `alt` attributes; five creator-profile images do not supply intrinsic `width`/`height` attributes. They sit in styled profile cards, so actual layout shift must be measured before inserting potentially incorrect intrinsic dimensions.
- Mobile overlay still uses a dark visual theme while other LUEN sections use warm ivory; this is a **design-consistency review item**, not a proven functional error. No palette redesign was introduced during the stability pass.
- Complex legacy CSS selectors and many `!important` declarations can still cause layout regressions at specific widths. Avoid claiming mobile layout is fixed until screenshots and interactions are tested.
- Mobile controls, heading wrapping, paragraph overflow, image cropping, card heights, three independent moving strips, FAQ, contact submission success/error and CLS/LCP still need live-browser verification.

### Browser QA acceptance gate (pending Vercel Preview access)
- Desktop widths 1440px and 1280px; tablet around 768px; mobile widths 390px and 360px; landscape or short browser viewport at height 568–600px.
- Confirm readable logo and hamburger against beige, working open/close/Escape/focus/resize transition, all seven menu links accessible.
- Verify all six orange section titles are present and subordinate copy stays smaller, with no clipping or blank headings.
- Ensure long-form and Reels tracks remain continuous, reduced-motion preference stops them, and no card/image changes distort case studies.
- Test all main CTAs and the inquiry form in a safe non-production way. **Do not submit a real customer inquiry as a QA test**.
- Vercel previously rejected Preview deployments with the free-plan daily deployment count limit. A GitHub Actions green result does not imply the newest branch was visually deployed.
