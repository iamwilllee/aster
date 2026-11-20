# Aster public website

Standalone, bilingual static marketing and documentation entrypoint for `https://aster.iamwilllee.com`. The Aster starter configuration and product initializer stay independent; `website/` is outside the initializer's copied roots. No runtime Worker script, D1, R2, auth, mail, billing, secrets or third-party scripts.

From the repository root:

```sh
pnpm --dir website install --frozen-lockfile
pnpm docs:check
pnpm --dir website build
pnpm --dir website check
pnpm exec wrangler deploy --config website/wrangler.jsonc --dry-run
```

The build copies only explicit public site assets into ignored `dist/website/`. It never publishes repository files, local QA, secrets or databases. Product content lives in `content.mjs`; source installation is pinned to the published release. The documentation catalog reads current-source guides in both languages and labels their release boundary explicitly. `src/config/features.json` does not control this independent static site.

Actual deployment, only when authorized:

```sh
pnpm exec wrangler deploy --config website/wrangler.jsonc
```

The custom domain is created through Wrangler, including managed DNS/TLS. Check target ownership and existing Workers/domain bindings first. Preserve unrelated zones, records and services. Static-assets requests have no added serving/storage charges under the current [Cloudflare policy](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/); no account-plan change is needed. This does not describe the costs of applications built from the starter.

After release, check the exact hostname over HTTPS, both locales and refreshes, theme persistence, keyboard/FAQ/copy behavior, reduced-motion and no-script readability, links and missing-page status. A successful upload alone does not prove that DNS/TLS or the website works. Keep receipts, account IDs, artifact hashes and screenshots in private `.local/acceptance/`, not in this directory. Subsequent deployments replace this independent site only. Use Cloudflare version history for recovery; never restore another application's data or routes.

English docs use `/docs`, Chinese `/zh/docs`. Each topic has a direct, refreshable locale URL and equivalent-page language switch. `docs/catalog.json` controls coverage, titles and translation fingerprints; legacy Chinese source paths remain supported. Markdown is built statically with locked Marked, escaped raw HTML, restricted link protocols/local images and tested internal anchors. Only allowlisted document topics are published, never private product evidence.
