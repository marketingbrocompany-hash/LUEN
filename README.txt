LUEN WEBSITE — CURRENT REPOSITORY NOTES (2026-10-29)

Repository: marketingbrocompany-hash/LUEN
Official website: https://luenkorea.com/ — public DNS currently routes to GitHub Pages (Cafe24-managed A/CNAME). Verify the GitHub Pages publish source under Settings > Pages before changing hosting. Vercel luen-homepage independently deploys main, but its READY status is NOT proof that the official domain is served by Vercel.
Development site: luen-preview branch → Cloudflare Pages luen-preview.pages.dev (isolated preview).
Hosting/DNS runbook and rollback steps: docs/LUEN_PRODUCTION_ORIGIN_DNS_20261029.md.
Do not change DNS or customer portal settings as a side effect of a code deployment.
Static integrity check: node scripts/check-site.mjs
Detailed code audit: docs/luen-code-audit-20261017.md
Do not delete historical stylesheets or replace asset-manifest.json without verifying dependencies.

--- HISTORICAL V10.8 ANALYTICS NOTES (retained for reference) ---

LUEN V10.8 — GA4 Analytics Patch

Measurement ID: G-QXBK6XEK7G

Files:
- index.html
- assets/js/site.js

Tracked events:
- page_view (GA4 default)
- cta_click (internal CTA links)
- contact_form_start (first interaction with inquiry form)
- contact_form_submit_attempt (valid submit event reaches the form handler)
- contact_form_validation_error (field name only; no field value)
- contact_form_error (response/network stage only; no form values)
- generate_lead (only after Formspree returns a successful response)

Privacy:
No name, email, phone, company, budget, project message, or other form field values are sent to Google Analytics.

Legacy note: the former GitHub Pages deployment instruction is obsolete.
