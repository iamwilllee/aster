# Merchant identity and payment selection

[中文](../PAYMENTS.md)

Aster targets individuals, sole proprietors and companies; this goal does not imply every provider accepts every region/identity. Implemented: **Stripe/Creem test subscriptions only**. Paddle/Lemon Squeezy/Polar/domestic adapters are not implemented. No live collection or maintainer-specific real merchant sandbox/KYC/settlement acceptance is claimed.

## Establish eligibility first

In the actual product brief/decisions, record real business/residence region, legal entity, approved accounts, buyer regions, category, pricing model and available settlement methods. Nationality, residence and company registration differ; buyer payment methods do not determine seller payouts.

Use known context and ask only for missing choice-critical information. Never encode the maintainer's identity as a universal default. Keep billing off without collection needs. Preserve explicit/working providers and leave unknown eligibility unknown.

| Situation                              | Selection direction, subject to verification                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mainland China individual              | Verify Creem's documented individual/Alipay path, then actual KYC/product review/owned settlement account                          |
| Mainland sole proprietor/company       | Compare domestic/cross-border entity/category/settlement requirements; a mainland company is not a Stripe-supported-region company |
| Hong Kong/overseas individual operator | Check real business/residence eligibility for individuals under Stripe/MoR local rules                                             |
| Hong Kong/overseas company             | Compare eligible Stripe/MoR using actual account, fees and tax services                                                            |

Company formation/accounts/purchases/configuration require actual authorization. A selection record is not activation permission. Do not force overseas incorporation or use false addresses/entities to bypass review.

## Dated official evidence and uncertainty

Snapshot checked **2026-10-25**, not approval; recheck before onboarding:

- Creem listed China and documented Alipay for Chinese individuals/bank accounts for businesses, with identity-matching recipients. Application support is not product approval/payout receipt. [Countries](https://docs.creem.io/merchant-of-record/supported-countries), [China payouts](https://docs.creem.io/merchant-of-record/finance/payouts#china).
- Standard Stripe merchant countries did not include mainland China; Hong Kong was separate. Some supported regions allow individuals/sole proprietors. Sandbox access is not live eligibility. [Global](https://stripe.com/global), [Activation](https://docs.stripe.com/get-started/account/set-up).
- Paddle allows individual/sole-proprietor applicants to skip company verification but still checks website/identity. China was not on its unsupported supplier list; these sources did **not** sufficiently confirm the specific mainland-individual onboarding/settlement path. Keep eligibility pending, not default-recommended. [Verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification), [Regions](https://www.paddle.com/help/legal/sanctions/which-countries-are-supported-by-paddle).
- Lemon Squeezy requires identity/store activation. Payouts may use banks/verified PayPal; mainland China was absent from its bank-payout list, and PayPal needs owned-account/withdrawal verification. [Identity](https://docs.lemonsqueezy.com/help/getting-started/verify-your-identity), [Payouts](https://docs.lemonsqueezy.com/help/getting-started/getting-paid), [Countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries).
- Polar uses Stripe Connect Express; its published settlement list did not include mainland China. Global buyer acceptance is not individual seller settlement support. [Countries](https://polar.sh/docs/merchant-of-record/supported-countries).
- Domestic channels need entity/category verification and adapters. A personal collection QR code is not automated merchant callbacks or payout acceptance.

## Configuration and Agent sequence

1. Inspect actual product/accounts/needs/eligibility/test scope. Record resolved payment-provider=stripe|creem with provenance and remaining eligibility questions. Never store identity documents, keys or bank data in plans.
2. Select billing-test (auth/database) or incrementally enable billing. It supports two **test** providers, not live collection. Initializer applies a resolved choice to local/staging/production BILLING_PROVIDER; default Stripe is compatibility, not approval. Later plan changes require Agent review/sync of runtime config.
3. Explicitly configure BILLING_PROVIDER per environment, current test keys/products and private local .dev.vars or remote secrets. BILLING_ENABLED=false defaults new checkout off; enable only after configuration in an authorized test target.
4. Implement/configure/accept within scope instead of ending with a checklist. Record precise login/KYC/key/activation blockers and continue independent work. No deployment authorization means no deployment for testing.
5. Production gates require current-product billing-test-live (Stripe) or billing-creem-test-live (Creem), business/provider/real/passed with actual paths. Mock HMAC/HTTP is not real and one provider's evidence cannot pass another.

| Provider | Required test secrets/config                                                               | Callback                    | Boundary                                                                      |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| Stripe   | STRIPE_SECRET_KEY (sk_test_), STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID                       | /api/billing/webhook/stripe | Legacy /api/billing/webhook remains; live keys rejected                       |
| Creem    | CREEM_API_KEY (test dashboard), CREEM_WEBHOOK_SECRET, CREEM_PRODUCT_ID (test subscription) | /api/billing/webhook/creem  | Fixed https://test-api.creem.io; test/sandbox only, no production-host option |

Creem uses hosted checkout/portal and dashboard prices. Clients cannot choose product/amount/customer/userId. Return checkout_id only polls owner-scoped local state, never grants access. Verify raw HMAC, retrieve current checkout/subscription, validate reserved ownership/customer/product/mode, then revision-guard D1 and deduplicate. Nonselected products grant no current plan. Fail closed on provider/unverifiable state, without switching providers.

## Upgrade, switching and deletion

- Review/apply additive 0004_married_boom_boom.sql: provider on subscriptions/checkouts/archives, legacy defaults stripe, no rewritten migrations. New products apply all SQL; existing targets follow authorized [Database](DATABASE.md), never local DB uploads.
- BILLING_PROVIDER chooses **new** checkout only. Old subscriptions still contribute entitlements and old portals/signed callbacks remain. Keep old product IDs/secrets/callbacks and declare obligations with BILLING_LEGACY_PROVIDERS=stripe (or creem/comma-separated). Empty defaults do not prove no historical obligations. Unresolved billing in another provider blocks new checkout.
- provider and creem: IDs/event namespaces isolate records. Closing checkout cannot close historical reconciliation; disabling all billing is not a legacy-subscription solution.
- [Deletion review](ACCOUNT-LIFECYCLE.md) combines both providers. Stripe can explicitly expire verified product-owned open links; Creem has no verified expiry API here, so no equivalent automated button. Resolve externally or wait for actual expiration, then recheck.
- Creem rereads known checkout/subscriptions and bounded store subscriptions/associated-customer transactions. Only verifiable complete results may pass. Truncation/unknown pending/timeouts/debt/active subscriptions block. Scans are not cross-platform locks; dashboard mutations need operations handling.

## Acceptance and future scope

Local tests cover mocks, real HMAC, D1 ownership/idempotency/races, legacy cross-provider rows, archives and UI, not provider acceptance. Each product tests actual dashboard product creation, hosted sandbox checkout, signed callback, trial/cancel/failure/retry, portal, owner isolation and deletion blockers. Record channel/product and keep live collection disabled.

Distinguish implementation, mocks, real sandbox, identity/product approval, settlement eligibility, live activation and actual payout. Both adapters remain TEST ONLY. Live collection, refunds/disputes automation, one-off purchases, full order ledger and tax/compliance release are not enabled. Production keys alone cannot launch them. Unperformed payout stays pending; never fabricate purchases or self-transactions. MoR indirect-tax handling does not settle all personal income obligations.

Implementation sources: [Creem index](https://docs.creem.io/llms.txt), [Checkout](https://docs.creem.io/api-reference/endpoint/create-checkout), [Webhooks](https://docs.creem.io/code/webhooks), [Portal](https://docs.creem.io/features/customer-portal).
