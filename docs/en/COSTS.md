# Start free-first and upgrade when needed

[中文](../COSTS.md)

Snapshot date: **2026-10-23**, USD. These are dated public-provider figures, not a read of your account, cloud acceptance or purchase authorization. Recheck current official terms/account eligibility before execution.

Aster code/Skill are MIT-licensed without a separate software license fee. Agent subscriptions/API, domains and cloud services are separate; installing the Skill activates none of them. Configure only selected [Modules](MODULES.md). Showcases need no D1/auth/mail; data/account stages apply only where needed.

## Default progression

1. Local: D1, local inbox and mocks; no actual cloud calls. Never expose the inbox publicly.
2. Free cloud data: prefer Workers Free+D1 with workers.dev/existing domain and only necessary resources. Separate staging/production data but aggregate account-wide allowances.
3. Auth/transactional mail: preserve explicit/working providers. Without one, prefer CF only for an already suitable Workers Paid account with sending/domain/quota eligibility; otherwise choose Brevo/Resend from preference, environment, activation and volume. CF sending's paid eligibility does not make Workers/D1 paid prerequisites. Both external adapters exist; verify real receipt, reset, sessions and permissions under [Mail](MAIL.md).
4. Evidence-based upgrade: when measured limits or requested paid capabilities justify it, present free alternatives, fixed/metered costs, estimates and budget, then follow actual authorization.

Initial target: **USD 0/month in new cloud charges**, not a permanent zero-cost promise. Existing paid accounts may incur usage; never downgrade unasked or count one shared fixed fee once per project.

## Capability and cost snapshot

| Capability            | Free starting point / limits in the dated snapshot                                                                            | Implementation and upgrade boundary                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/API               | Workers Free: 100,000 dynamic requests/day, 10 ms CPU/invocation; direct static requests are not dynamic calls                | Implemented; measure SSR/hashing on the target cloud. Paid started at account $5/month plus overages. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/)                                                                                                                                                                                            |
| Database              | D1 Free: 5 million rows read/day, 100,000 rows written/day, 5 GB account storage; 500 MB per DB, up to 10 free DBs            | Rows scanned differ from API requests. Free excess errors; Paid excess is metered. Environments share allowances. [Pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [Limits](https://developers.cloudflare.com/d1/platform/limits/)                                                                                                                   |
| CF transactional mail | Free to verified account destinations; arbitrary recipients require Workers Paid, with 3,000/month/account and metered excess | Adapter/local inbox implemented; actual sending needs acceptance. Free Routing receive/forward does not replace registration mail. [Pricing](https://developers.cloudflare.com/email-service/platform/pricing/)                                                                                                                                                         |
| Brevo                 | Free 300/day, non-rollover, no credit card, branded mail                                                                      | MAIL_MODE=brevo/BREVO_API_KEY implemented; sender domain and transactional activation/live receipt required. Excess may queue and is not timely verification delivery. [Plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) · [Limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) |
| Resend                | Free 3,000/month and 100/day; verified own domain                                                                             | MAIL_MODE=resend/RESEND_API_KEY implemented; API acceptance is not receipt. [Pricing](https://resend.com/pricing) · [Domain](https://resend.com/docs/dashboard/domains/introduction)                                                                                                                                                                                    |
| Files                 | R2 Standard: 10 GB-month, 1 million Class A and 10 million Class B monthly operations, then metered; not a hard spending cap  | Private images simulated locally; new products do not bind R2 by default. Check activation/payment method/permissions/quotas. Infrequent Access has no such allowance. [Pricing](https://developers.cloudflare.com/r2/pricing/)                                                                                                                                         |
| AI                    | Workers AI had 10,000 free Neurons/day; some models require payment methods; other providers charge separately                | Calls/ledger not implemented and default off. Define model/concurrency/budget first; Workers Paid does not cover all AI consumption. [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)                                                                                                                                                          |
| Payments              | Stripe/Creem sandbox uses simulated transactions, not collection                                                              | TEST ONLY. Real fees depend on merchant/product/region; test subscriptions are not payment to CF. [Testing](https://docs.stripe.com/testing)                                                                                                                                                                                                                            |
| Domains/Agent         | workers.dev or existing domain first; purchase/renewal and Agent usage separate                                               | Skill neither buys domains nor includes Agent quota in CF allowances                                                                                                                                                                                                                                                                                                    |

This is a selection list, not a requirement to activate all services. Google OAuth is off/hidden by default; ordinary integration can start with free projects/clients but needs credentials and real callbacks, not a CF plan upgrade. [Google guide](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button). Display name remains profile text, not username login.

## Runtime limits and real acceptance

CPU is an independent Workers Free constraint. Better Auth password hashing, SSR and other work consume CPU. **Complete auth has not been proven to fit Workers Free CPU limits.** Inspect actual target CPU/logs/login; local wall time is not cloud CPU.

Identify/optimize measured hotspots, compare secure implementations or user-approved login methods, then evaluate Paid. Never remove email verification, weaken hashing, expose links or skip ownership checks to claim a free route. Data/public previews can proceed without mail but are not completed registration acceptance.

Even free resources need migration/recovery planning. Migrate only selected real business data, not development accounts/sessions/verification/reset tokens/test subscriptions.

## Agent records

In PROJECT.md record stage, whether target plan/shared allowances were checked (unknown if inaccessible), service choices/free limits/excess/card or paid requirements/official URLs/date, estimated and measured CPU/D1 rows/writes/storage/mail/model use, supported free flows, missing capabilities, real acceptance and upgrade triggers. Do not invent measurements.

Use existing decisions rather than duplicate cloud configuration:

```json
{
  "id": "cloud-cost-policy",
  "question": "Cloud cost policy",
  "status": "resolved",
  "value": "Free-first; target USD 0/month in initial new cloud costs; evaluate paid capabilities separately",
  "basis": "default",
  "reason": "Verify actual capacity/runtime limits first; external operations still follow current user authorization",
  "blocking": false
}
```

Initialization creates the default. Explicit budgets use basis=user with the user's actual intent. status shows it; doctor checks its presence, not bills or free operation. Old plans remain compatible; add missing choices before cloud work.

Budgets/resolved/file contents are not purchase credentials or permission. Connecting CF, moving data or reusing an existing plan does not authorize card binding, subscriptions, top-ups or automatic excess billing. Preserve explicit scope; plan-first requests stop at a reviewable plan.
