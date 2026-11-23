# Cloudflare architecture

[中文](../CLOUDFLARE.md)

First choose bindings under [Capabilities](MODULES.md). A showcase needs neither D1 nor auth secrets; only selected capabilities enter configuration and acceptance.

Aster uses TanStack Start / React / Vite. Cloudflare Workers serves SSR, server functions and HTTP APIs. Drizzle manages D1 schema/migrations.

| Capability            | Implementation                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Web/API/static assets | Workers + Cloudflare Vite plugin                                                                  |
| Data                  | D1: users, sessions, private projects, rate limits and test subscription state                    |
| Mail                  | Local inbox plus Cloudflare/Brevo/Resend adapters; configure and test live delivery independently |
| Files                 | Optional private image workflows and site covers; new products enable files only when needed      |
| AI/queues/schedules   | Not integrated; add for a concrete product need                                                   |

## Isolation and consistency

Each product has its own Worker, D1, domain and secrets. Local data lives in its own `.wrangler`; do not copy template development data. Staging and production use independent configuration. The compatible `starter-db` name does not imply a shared database.

Import bindings only in server modules. Build auth per request and scope private SQL to the current user. Atomic conditional writes enforce project quotas. Test payment events require signature verification, deduplication and reconciliation against current provider state. Success redirects or in-process variables cannot grant entitlements.

KV is not the sole authority for balances, permissions or locks. File workflows require ownership, access control and recoverable failures; see [Files](FILES.md).

## Costs and deployment

Default to free-first: local → Workers Free + D1 validation → independent mail/auth selection and acceptance → upgrades justified by actual needs. New products do not bind unused R2/mail resources. Cloudflare arbitrary-recipient email eligibility must not be treated as a paid prerequisite for a data-only site. See [Costs](COSTS.md) for dated limits, CPU constraints and decision records.

Actual usage, plan and eligibility come from the account/current official sources. Aggregate costs across products. Evaluate dynamic requests, CPU, scanned D1 rows, storage, mail and model calls separately; request allowances alone do not establish business capacity.

Keep explicit/working mail providers. Otherwise prefer Cloudflare only when the target account already has suitable Workers Paid and sending eligibility; choose Brevo/Resend from preference/environment otherwise. See [Mail](MAIL.md).

References: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Email Service](https://developers.cloudflare.com/email-service/).

Local simulation is not cloud/provider acceptance. Follow [Deployment](DEPLOYMENT.md) for actual resources and remote acceptance.
