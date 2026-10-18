# LUEN Cloudflare Pages development deployment

This is **an isolated preview website** at https://luen-preview.pages.dev.
Do not attach the official `luenkorea.com` domain or merge unreviewed PRs to `main`.

## Current source of truth
- GitHub repository: `marketingbrocompany-hash/LUEN`
- Verified code baseline: `fix/mobile-nav-motion-audit-20261017` (PR #152)
- Stable deployment branch: `luen-preview` (created from that baseline)
- Pages project: `luen-preview`
- Pages production branch as configured in Cloudflare: `main` (this is **not** the GitHub `main` branch)
- Deployment method: **Direct Upload via GitHub Actions/Wrangler**, not Cloudflare Git integration.
- GitHub CI workflow: `.github/workflows/cloudflare-preview.yml`

## One-time GitHub setup (never paste credentials in chat)

1. In Cloudflare account dashboard, create a **Custom API Token** with
   **Account → Cloudflare Pages → Edit** permission, restricted to the intended
   Cloudflare account. Do not use a Global API Key.
2. Obtain the Cloudflare **Account ID** from the intended account overview.
3. In GitHub repository **Settings → Secrets and variables → Actions → Secrets**,
   add:
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
   - `CLOUDFLARE_API_TOKEN`: newly created restricted API Token
4. In the adjacent **Variables** tab, add repository variable:
   - Name: `LUEN_PAGES_DEPLOY_ENABLED`
   - Value: `true`
5. Push a verified change to `luen-preview`. The workflow runs site integrity
   checks and uploads the public site to the existing `luen-preview` Pages
   project. Verify the GitHub Actions result and open
   https://luen-preview.pages.dev.
6. Do not commit API keys, tokens or account IDs into the repository.

Note: until the variable in step 4 is explicitly enabled, the workflow's
deployment job is skipped; this prevents accidental runs before credential
setup.

## Safe day-to-day process

1. Work on a separate feature branch and run static QA.
2. Review the changed pages, scripts and design. Do not replace the `main`
   branch or the official website.
3. Merge or fast-forward **approved** work into `luen-preview` (the fixed
   development deployment branch).
4. `push` to `luen-preview` causes only the Cloudflare **development** URL to
   refresh. GitHub Actions stores no Vercel configuration.
5. When the user explicitly requests to update the **official** homepage,
   first conduct real-screen QA, review changes and plan a separate production
   switch or deployment. The preview workflow does not deploy official pages.

## Deployment payload and caveats

LUEN is a static HTML/CSS/JavaScript site. The workflow runs
`node scripts/check-site.mjs` and stages all public routes and
`assets/` into `_site/`. It intentionally excludes developer files, old
asset inventory and `CNAME` to avoid coupling the preview with the official
domain.

Cloudflare Direct Upload projects cannot later be converted in place to native
Git-integrated Pages projects. GitHub Actions + Wrangler can continue to deploy
them. The `--branch=main` argument selects the existing Pages production
environment for **luen-preview**, not the GitHub `main` branch.

If the workflow reports authentication/permission failure, first verify
Cloudflare Account ID, API token scope and Pages project name. Do not
repeatedly reconnect the GitHub App, regenerate unrelated credentials, or
change DNS to work around an Actions failure.
