# Choose capabilities for the product

[中文](../MODULES.md)

Aster supports ordinary Web and AI products without requiring every site to use accounts, payments or AI. First define user flow, then let the Agent infer/reason about noncritical choices and adjust incrementally.

## One runtime configuration

src/config/features.json is a public build-time capability configuration shared by pages, server APIs, initialization, doctor/check and deployment. It contains no secrets, eligibility or live-acceptance conclusions. Restart/rebuild after changes.

starter.project.json.modules holds user/context/default provenance, checked against runtime configuration. Actual provider readiness still depends on target credentials/domains/tests. Legacy products without features retain old behavior; adopt policy/dependencies first, then choose explicitly rather than silently closing real business.

| Capability    | Dependencies/meaning                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| database      | D1; optional for showcases                                                                                     |
| auth          | Requires database and at least one login method                                                                |
| emailPassword | Registration/verification/recovery; requires auth/mail; display name is not username login                     |
| google        | Requires auth, not mail                                                                                        |
| mail          | CF/Brevo/Resend adapters; local inbox also needs database                                                      |
| projects      | Private sample projects; requires auth/database                                                                |
| billing       | Stripe/Creem TEST ONLY; requires auth/database; separate from new-checkout switch                              |
| files         | Private PNG/JPEG/WebP/avatars/covers; requires auth/database and selected private R2; [Files](FILES.md)        |
| content       | Article/help/announcement drafts/publishing; requires auth/database, files for covers; [Content](CONTENT.md)   |
| ai / usage    | Not implemented; stay false. Required product needs remain pending until implementation/policy/live acceptance |

Disabled code/dependencies may remain available for later adoption; this is not a promise to remove all bundled artifacts. Close direct routes/APIs as well as buttons. Public showcases do not query auth/D1. Disabling never deletes existing databases/migrations/data.

Evaluate region/individual/sole-proprietor/company/settlement under [Payments](PAYMENTS.md). Stripe/Creem TEST use explicit BILLING_PROVIDER. Other providers need actual adapters; do not make the maintainer's identity/provider universal.

## Starting profiles

| Profile      | Default capabilities                   | Use                                                           |
| ------------ | -------------------------------------- | ------------------------------------------------------------- |
| showcase     | All optional modules off               | Public pages, portfolio, marketing; retains locales/theme/SEO |
| web-app      | D1/auth/password/mail/private projects | Member/data app; Google/billing/AI off                        |
| billing-test | web-app plus selected test billing     | Test subscription/entitlement flow, never live collection     |

```bash
pnpm aster:new ../my-site --name "My Site" --profile showcase
```

Do not combine --profile and --plan. New targets initialize safely in place; existing products use incremental configuration. Showcase generates no auth secret/DB binding, setup skips migration and bootstrap records skipped. web-app does not default Google/payments/AI/R2 on.

## Adjust existing products

Read rules/PROJECT.md/current code/status, preserving business/brand/data/working services.

```bash
pnpm project:modules
pnpm project:modules --profile showcase
pnpm project:modules --profile showcase --apply
```

Apply writes only local configuration/plan: no resource creation, install, migration, mail, model calls or deployment. Private backups live in .local/module-changes/. Failed writes restore matching state while preserving recognizable later edits. Review interrupted locks/backups, do not steal locks. Changed config/plan requires another preview. Backups may contain existing local credentials: keep private. Restore config and plan together, then recheck; file rollback is not DB/cloud rollback.

Remove only unused template placeholder DB bindings; preserve actual resources and review their purpose. Reenable database with placeholders, then configure authorized targets. First auth enable may generate a missing independent local secret; never reset an existing one. Local mail may use local mode but preserve an already selected provider.

Google/billing switches do not create OAuth clients or authorize checkout/payment activation. Required billing cannot be casually removed by changing profiles. Stop new checkout using BILLING_ENABLED=false, retaining portals/webhooks. Retirement requires separate review of subscriptions/entitlements/users.

Partial JSON preserves unspecified runtime choices:

```json
{
  "google": {
    "selection": "required",
    "basis": "user",
    "reason": "The user explicitly requested Google sign-in"
  }
}
```

```bash
pnpm project:modules --input /tmp/module-choices.json
pnpm project:modules --input /tmp/module-choices.json --apply
```

Local approval is not cloud/purchase/Git permission. Run setup for generated types/local migrations, restart and continue actual development/acceptance without overwriting secrets.

## Routes and APIs

Auth includes [Account security](ACCOUNT-SECURITY.md) and [Lifecycle](ACCOUNT-LIFECYCLE.md). Password UI follows actual credentials; Google-only needs no new mail/password. Export allowlists owner data; deletion revalidates identity and all historical billing before atomic minimal archive. Disabling capabilities does not remove historical billing checks/migrations.

- auth off: close login/signup/recovery/workspace/private APIs and their CTAs.
- Google-only: close password/recovery UI and direct APIs; real selected Google callback acceptance is still required.
- billing off: close pricing/billing UI/APIs, omit pricing from sitemap and ordinary app copy.
- projects off: close sample menus/operations/overview/API while auth remains available to real business.
- database off: health reports storage=none; public pages require no DB/auth secret.
- Unselected Google/mail/R2/AI produce no visitor-facing unconfigured placeholders.

Preserve existing pages and recheck actions/copy. Switches do not automatically turn a sample homepage into product-specific design.

## Acceptance and release

module tags scope cases/tasks to selected capabilities. Ready still requires real business cases; disabling auth cannot bypass core product acceptance. Fixed email/Google cases map to their methods and changes reset affected evidence. Free-text handoff blockers are cleared only after Agent review.

| Profile      | Required setup/acceptance                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------- |
| showcase     | Valid environment/public origin; no auth/D1/mail/Google gates                                      |
| web-app      | DB/auth secret/selected mail; production auth-email-live                                           |
| Google-only  | DB/auth secret/enabled Google credentials; auth-google-live                                        |
| billing-test | Selected/legacy test provider config and real sandbox billing-test-live or billing-creem-test-live |

Staging can prepare incomplete selected providers only within deployment authorization. Unimplemented required AI/usage blocks ready/production claims. Unselected provider gates do not block; plaintext secrets or remote local-inbox exposure still fail universally.

Run pnpm check, format:check, test:e2e, plus test:production and profiles web-app, showcase, google-only, creem as applicable. A fully disabled product's ordinary production smoke uses showcase checks without inventing auth dependencies. Local Workers/fake OAuth do not prove cloud CPU/live provider/payment eligibility.

Run checks in the **generated product**, not just source. Browser tests read its actual config: verify closed unselected routes/APIs and selected flows. Payment unit fixtures independently enable test billing to preserve signatures/reconciliation without forcing web-app billing. Capability skips never excuse skipping the product's core business flow.

## Visuals, images and content

appearance.json independently selects themes under [Themes](THEMES.md). Selected files need independent ASSETS_BUCKET and files-live evidence. Source preview enables images; all new profiles default files=false. Historic cleanup duties persist when disabled.

All new profiles default content=false. Text needs no R2, covers select files, production requires content-live. Only server-granted admins edit; visitors read anonymously. Shared entries/assets survive contributor deletion with nullable attribution, not personal-file cleanup.

## Administration

Existing auth/database supports role-protected /app/admin without another feature/provider. Auth-disabled showcases close page/API. Only active verified admins search users, suspend/restore and read minimal audit; no auto-grants or inherited acceptance. See [Admin](ADMIN.md).
