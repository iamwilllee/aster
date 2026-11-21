# Deploy to Cloudflare

[中文](../DEPLOYMENT.md)

First read [Modules](MODULES.md). Apply auth/DB/mail/payment requirements only to selected capabilities. Showcase needs no D1/auth secrets/provider registration evidence; Google-only needs no transactional mail. Legacy products retain existing policy until actual runtime capability adoption, not plan-only bypasses.

v0.2.0-beta.1 supports non-payment showcases/ordinary apps first. Nonselected billing needs no payment configuration/evidence. Check operator cloud permissions and complete the actual target acceptance; never send secrets to chat or commit them.

## 0. Start free-first

Read [Costs](COSTS.md). Evaluate Workers Free/D1 with workers.dev/existing domain; separate Web/data/mail/files/AI costs. CF mail's paid eligibility is not a universal cloud prerequisite. Read plan/shared quotas without changes; inaccessible stays unknown. Measure target CPU/hashing/SSR and D1 size/scanned rows before assuming full free-tier compatibility.

Record an initial zero-new-cost preference/provenance, not purchase permission. Reuse an existing paid plan only as requested, checking incremental usage. Never automatically upgrade/downgrade/top-up. Plan-only requests do not authorize resource creation/migration/DNS/deployment.

## Authentication selection and release timing

| Phase               | Agent work                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Requirements        | Select login methods; default display name/email/password, Google opt-in                                                 |
| Local               | Implement with local inbox; test states/sessions/ownership/mobile/locales, not real providers                            |
| Staging             | Configure mail and selected OAuth clients/consent/test users/exact callbacks                                             |
| Provider acceptance | Real receipt/signup/verification/logout/reset/old-session revocation; selected Google real callback/cancel/error/session |
| Production          | Exact domain/callback/independent secrets, current gates, publish and target regression                                  |

Display name is not username login. Unconfigured/unselected Google is hidden from visitors. Unconfigured public mail flows close signup/resend/recovery/CTAs while retaining verified-account login; setup diagnostics stay in doctor, not public forms.

Before public release, record selected-method auth-email-live/auth-google-live as business/provider/real/passed with current-product evidence, exact target/date/paths/results and no real recipients/tokens. Changed providers/domains/callback/auth code reset affected evidence. They may remain optional/pending during local work, but production checks enforce selected methods. Unselected Google never blocks email-only; showcases need neither.

Scripts check records/config/secret names, not screenshot truth/provider behavior. The Agent must actually execute acceptance.

## 1. Isolate staging

Default root config is production; env.staging uses a separate Worker/domain/secrets and, if selected, D1. Bindings/vars are independent per environment. Local D1 needs no extra cloud DB; staging is needed only for online acceptance. Showcases need none.

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create starter-staging-db --env staging
```

Put the actual ID in staging only. Set exact HTTPS APP_ORIGIN without path/trailing slash and correct Worker name; workers.dev is acceptable. Preserve ENVIRONMENT=staging, PUBLIC_INDEXABLE=false and BILLING_ENABLED=false. MAIL_MODE=disabled closes registration mail flows until ready; local mode is never deployable.

Add only selected R2/mail bindings; retain existing business uses when reviewing old bindings. CF mail uses EMAIL. Regenerate types after binding changes. Source previews may include optional sample bindings; new profiles only prepare selected resources. Compatibility date is pinned to 2026-10-19 for the foundation; dependency/runtime upgrades need review/regression. The product deploy script does not automatically bind a custom domain/DNS.

## 2. Secrets and migrations

Use interactive Wrangler secrets, no values in shell history/vars/Git. Create independent random auth secrets of at least 32 characters.

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm project:database plan --env staging
pnpm project:database check --env staging
pnpm project:database apply --env staging --id <release-id>
```

Only after target migration authorization, review SQL/old-Worker compatibility under [Database](DATABASE.md). Apply gets a real recovery bookmark/private backup, then migrates/rechecks history/integrity/FKs. check exit2 means pending, not applied. Recovery planning is read-only; overwrite needs specific scope. No local DB/users/.wrangler uploads. Examples are not evidence of executed operations.

Selected Google: register a Web client with exact https://your-staging-domain/api/auth/callback/google, authorized origins and test users when in testing mode. Set GOOGLE_AUTH_ENABLED=true and independent environment secrets:

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env staging
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env staging
```

Both keys plus switch are required; default switch false. Ordinary OAuth can start with free Google project/client, not Workers Paid; other paid identity/API services need separate assessment. Local URL/error checks are not real consent/callback acceptance. [Google guide](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button), [Client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

Select mail independently under [Mail](MAIL.md): preserve explicit/working service; prefer CF only with verified existing suitable Workers Paid/sending eligibility/allowance, otherwise choose Brevo/Resend from preference/environment, never auto-upgrade. Unknown stays unknown. Data/public previews can proceed without mail, but not claim complete registration or weaken auth.

For CF, verify account/domain/EMAIL binding and real arbitrary-recipient sending; free Routing is not a substitute. Configure cloudflare mode and verified MAIL_FROM and test localized HTML/text/links/errors and actual receipt, not API acceptance.

Payments follow [Payments](PAYMENTS.md): explicit BILLING_PROVIDER=stripe|creem, test keys/products and legacy obligations via BILLING_LEGACY_PROVIDERS. Creem fixes the sandbox host and needs CREEM_API_KEY/CREEM_WEBHOOK_SECRET/CREEM_PRODUCT_ID. Stripe uses STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/STRIPE_PRICE_ID, test portal and /api/billing/webhook/stripe (legacy path retained); Creem callback ends /creem. Enable new checkout only in an authorized test target. Disabling it preserves configured portals/signed events. Live keys are unsupported.

## 3. Check and deploy

```bash
pnpm check
pnpm test:e2e
pnpm test:production
pnpm run deploy:check --env staging
pnpm run deploy --env staging
```

Use pnpm run deploy to avoid confusion with pnpm's built-in command. deploy:check is local: reject placeholder/shared DB, invalid environment/origin, remote local-mail, plaintext secrets, indexable staging, inconsistent selected Google and incomplete selected production auth/mail evidence. CF requires matching EMAIL/real sender.

Actual deploy additionally reads exact-target remote secret **names**: auth secret, selected Google keys and only selected Brevo/Resend key. Missing/unverifiable names stop before build/deployment without raw provider/secret output. It neither creates resources/secrets nor migrates. Names do not prove credential values/callbacks/delivery.

Selected D1 gets read-only history/integrity/FK preflight before build and publish. Pending/divergent/unavailable DB blocks deployment until authorized migration; database-disabled skips connection. Checks do not replace business acceptance.

Remove generated dist/server/.dev.vars before publishing; source secrets/.wrangler stay private. Publish only intended dist/client assets, never server output as public storage. No public caching of auth/private API/server functions/workspace.

Prepare independent production D1/secrets/root config, then omit --env staging. Enable PUBLIC_INDEXABLE=true only when content is ready; selected public pages/live content enter localized sitemap, private pages remain noindex.

Cloud admin grants must explicitly target the right D1 after verified signup:

```sql
INSERT INTO admin_user (user_id) VALUES ('target-user-id') ON CONFLICT(user_id) DO NOTHING;
-- Revoke: DELETE FROM admin_user WHERE user_id = 'target-user-id';
```

Keep operations records and last-active-admin guards; no first-user auto-role or editable-profile roles.

## 4. Cloud acceptance

On real HTTPS, test direct locale navigation/refresh, selected signup/receipt/resend/cooldown/verification/login/logout/reset/session invalidation, selected Google/error callback, CRUD persistence, owner isolation/admin403 and closed local inbox/mail APIs in both languages. Optional test billing needs hosted checkout/cancel/portal/failure/retry/signed reconciliation; success return grants nothing.

Measure logs/CPU/D1 rows/usage and backup/recovery; plan selection uses actual load. Source tests do not establish each product's live providers. Live payments/refunds/disputes/taxes/provider-linked deletion/privacy/retention need concrete product work. [Lifecycle](ACCOUNT-LIFECYCLE.md) must map new business ownership/cleanup.

## Response headers

The request middleware in `src/start.ts` adds security headers to every response: pages, API, redirects and server functions. They are `frame-ancestors 'none'` (with `X-Frame-Options: DENY`), `base-uri`, `object-src 'none'`, `form-action 'self'`, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy` and `Cross-Origin-Opener-Policy: same-origin`. HTTPS requests also get `Strict-Transport-Security: max-age=31536000`; local http does not. It has no `includeSubDomains` or preload, which are the domain owner's decision. A header a handler sets itself, such as the strict CSP on file downloads, wins.

This is not a full Content-Security-Policy: it does not restrict script or style sources. A script-src policy needs a nonce or hash for the theme-initialization script and the router's hydration script, and is separate follow-up work. The middleware also rejects cross-site requests to server-function endpoints. During cloud acceptance check these headers on the real domain with browser tools or `curl -I`; the pre-deploy checks only prove the code sets them.

## Optional private images

Selected files require independent private staging/production ASSETS_BUCKET and reviewed additive migration0005 before compatible code. deploy creates no bucket, rejects shared/placeholders and requires current files-live target evidence. Local simulation is not cloud/cost acceptance; disabling UI does not erase resources or deletion-cleanup duties. See [Files](FILES.md).

appearance.json selects product theme, production ignores _style, no extra service. See [Themes](THEMES.md). The separate Aster public marketing/docs host is an assets-only website; these application/provider requirements apply to generated products, not that static site.
