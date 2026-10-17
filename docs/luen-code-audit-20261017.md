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
