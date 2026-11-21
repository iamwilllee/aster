# Development guide

[中文](../DEVELOPMENT.md)

For a new product first read [Agent guide](AGENT-GUIDE.md), initialize through $aster-new or pnpm aster:new and use the generated [Project brief](templates/PROJECT-BRIEF.md). This guide covers implementation/runtime conventions.

## Local workflow

Use Node.js 22.12 or newer (24 recommended; CI verifies 24) and pnpm 12.11.2. Default origin is http://127.0.0.1:3100. Do not mix localhost/ports: auth and local inbox must match APP_ORIGIN. An intentional change must update .dev.vars, dev scripts, Playwright and tests consistently. Existing products/worktrees retain their own configured loopback origin.

setup generates .dev.vars without overwriting it; commit only placeholder .dev.vars.example. Generate Worker types using pnpm cf:typegen; build/dev generates the route tree. Local D1/R2 use Cloudflare simulation, no Docker.

Register, open verification in /dev/inbox and sign in. Reset links also appear there. Development mail links older than 24 hours are cleaned during later writes; Better Auth separately validates token lifetime. The inbox is unauthenticated but restricted to local environment and matching loopback origin. Never expose development through a public tunnel.

## Code and data

| Path                           | Purpose                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| src/routes                     | File routes, public pages, protected workspace and API                                            |
| src/modules/auth               | Request-scoped Better Auth/passwords/authorization                                                |
| src/modules/billing            | Test checkout/portal/signatures/current-state reconciliation                                      |
| src/modules/mail               | Local inbox and selected CF/Brevo/Resend delivery                                                 |
| src/modules/projects           | Input policy; business handling lives in server APIs                                              |
| src/server                     | JSON/Origin/body boundaries, API and server functions                                             |
| src/db, migrations             | Drizzle SQLite schema/SQL                                                                         |
| src/components, src/styles.css | Editable UI, shared components/tokens (src/styles/flatpack.css is copied by `pnpm flatpack:sync`) |

After schema changes generate/review SQL, then pnpm db:migrate locally. Never migrate in normal requests or rewrite applied SQL; remote steps are in [Database](DATABASE.md).

Non-payment accounts default to three projects, configured in src/config/site.ts. Experimental Pro constants do not require displaying plans or configuring payments. Creation quota uses one INSERT SELECT WHERE COUNT(...) statement, not read-then-write or KV locks. Example project queries return at most 100 rows; admin lists search/filter/page by 20. Add real indexes/quotas/pagination for larger products instead of assuming unlimited sample scale.

## Internationalization and auth

English uses /, /login, /app; Chinese uses /zh, /zh/login, /zh/app. Bidirectional Router rewrites map prefixes to internal search state and remove internal output parameters. Root HTML lang/copy/SEO are request-scoped, never module-global locale state.

Typed t(key, values) reads src/i18n/en.json and zh.json. pnpm locale:check validates keys/placeholders. Full navigation preserves query/hash, auth/payment returns retain locale, and API/auth requests send a language header. Only known public errors map to dictionaries; never display raw provider messages.

Server errors are identified by message keys: `throw new HttpError(409, 'error_project_limit', { count: 3 })`. The key is the stable identifier and the response is translated from it, so rewording a message cannot silently drop English users to a generic error. `message` keeps the Chinese text for logs and tests. zod schema messages are keys too. A string literal is for text from an outside library only and is never shown verbatim (unknown text shows the generic error). `tests/unit/error-messages.test.ts` rejects `HttpError` literals that are not keys and any Chinese string in the server directories.

Logs carry categories and identifiers, never messages: a library error text can hold an address, a link, a credential or a query argument. `logFailure(event, error, fields)` in `src/server/observability.ts` writes the event name, the error class, our own keys and numbers. `getRequestId` uses Cloudflare's `cf-ray` (a random UUID when its shape is unsafe) and every response carries `X-Request-Id`, the same value as `requestId` in the logs, so a user's report finds its log line. 5xx responses and storage or mail failures turned into 503 leave a line.

PUBLIC_INDEXABLE=false blocks robots and empties sitemap. Enable explicitly for public release; include only selected public pages/live content, never billing pages when disabled. Private pages stay noindex.

Local Google testing requires GOOGLE_AUTH_ENABLED=true, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET with exact callback http://127.0.0.1:3100/api/auth/callback/google, then restart. Unselected/unconfigured Google shows no visitor placeholder button. Selected Google needs staging configuration and real acceptance before production.

Email resend uses an atomic D1 60-second cooldown on normalized-email SHA-256; failure releases only its own reservation. Auth keeps database limits. Private writes allow 30/user/minute, separate from project quotas; reads do not consume that write limit.

## Administrators

After verified signup:

```bash
pnpm admin:grant you@example.test
# Refresh the workspace; keep another active admin before revoking this role.
pnpm admin:revoke you@example.test
```

CLI reads this project's local DB, requires verified/enabled accounts, refuses the last-active-admin removal and does not alter cloud roles. admin_user is authoritative; the first signup is not an admin. See [Admin](ADMIN.md); remote grants require explicit operations on the correct D1.

## Request bodies and runtime

Consume bounded bodies before Origin/auth early returns: ordinary API 16 KiB, Stripe webhook 256 KiB. Rebuild Requests from original bytes and verify webhook signatures before parsing/mutating payloads. Oversized inputs cancel; no unbounded buffering/body logs. Auth also bounds reads. Unexpected SDK exceptions bypass raw lower-layer printing and are handled by the auth HTTP boundary using fixed severity/category/request ID and generic public errors; APIError retains expected status/headers. Never print raw DB errors, SQL parameters or credentials, or disable logging to hide failures. Test both rejected and subsequent requests because unread early-return streams can reset development proxy connections.

vite.config.ts prebundles current Base UI paths in client/SSR to avoid cold-route dependency rebuilds. Do not hide failures with CSR replacement, lower concurrency, swallowed exceptions or extra retries. Validate runtime changes in independent products/production builds, including cold start rather than just HMR/old fixture data.

## Experimental billing, off by default

Non-payment products need no payment configuration. Select billing/billing-test explicitly under [Payments](PAYMENTS.md); source preview/web-app keep billing=false. Preserve historical billing/portals/signed callbacks. Stopping new checkout differs from complete retirement.

### Stripe TEST

Add only your test values to private .dev.vars and restart:

```dotenv
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

Create a recurring test Price and enable Customer Portal. Stripe CLI may forward to http://127.0.0.1:3100/api/billing/webhook using its returned signing secret. Subscribe only to checkout.session.completed and customer.subscription.created/updated/deleted.

BILLING_ENABLED=false stops new checkout; configured test portals/webhooks remain. Attempts for the same user/price reuse a five-minute Stripe idempotency key, so returning after cancellation may reuse the unexpired link. URL success/checkout parameters never grant access.

Webhook verifies raw bytes through the SDK and rejects live events, retrieves current subscriptions, uses revision-guarded local writes/event deduplication and rereads conflicts. Stripe retries failures. Valid matching price plus active/trialing plus an unexpired period determine Pro. Refunds do not themselves cancel subscriptions; refunds/tax/disputes need separate implementation before real payments. SDK-signature/mocked-provider/real-local-D1 tests are not hosted sandbox/3DS/mail/provider acceptance.

## Checks

```bash
pnpm format
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:production
```

check validates any product plan, locales/brand assets, builds generated routes, then ESLint/TypeScript/Vitest. Source also runs initializer/workflow tests; generated products omit test:starter. Playwright needs no real secrets, creates example.test accounts and writes fixture data to development D1. Independent fixture IPs avoid shared auth rate buckets without lowering real limits. D1 integration uses fresh Miniflare, not developer data.

Production smoke creates isolated .wrangler/acceptance/<UUID> config/D1/random secrets/fake Google credentials, builds and serves HTTPS 3110, then stops only its own process. An occupied port causes exit, not termination of another service. It ignores developer .dev.vars/data, strips inherited provider secrets and disables real mail/payments. Authorization URL checks are not real Google login. Do not commit artifacts.

CI covers default/web-app/showcase/Google-only with local simulation. Releases require actual candidate-commit remote results, not older checks. UI still needs rendered desktop/mobile and interactions.

## Reuse and upgrades

This is single-application source, not a multitenant business platform, managed host or automatic migration framework. Give every product independent data/secrets/domain; no copied development DBs. starter-version.json and .aster/baseline.json record provenance. Use [Upgrading](UPGRADING.md) for scan/backed-up merge/record/rollback. Automatic online discovery/retrieval is not implemented; do not overwrite an existing product.
