# Product requirements and development handoff

[中文](../../templates/PROJECT-BRIEF.md)

Initialization creates PROJECT.md at the product root. For manual use, copy/rename this template and fill it in without replacing an existing handoff. Record business goals/progress; AGENTS.md retains technical/security rules. No secrets/cookies/verification links/real customer data here.

## Product

- Name: to be supplied.
- Audience: to be supplied.
- One sentence: solve [problem] for [users] in [context].
- Market/languages: overseas Web, English/Chinese by default; adjust to actual requirements.
- Foundation: Aster; original version in starter-version.json.
- Stage: requirements / local / staging / live, according to actual state.

## First-version scope

- Core flow: entry → action → result.
- Required: one complete useful flow first.
- Excluded: specify.
- Sample projects: retain / extend / replace; list preserved data.

## Users, data and permissions

- Need login? Choose from actual flow; showcases can omit it.
- Selected auth: display name/email/password by default when needed; Google opt-in. Display name is not username login.
- Editorial content: none/articles/help/announcements; covers/admin source/language/publication flow under [Content](../CONTENT.md).
- Core fields, required values and relationships.
- Read/write: owner-only by default; explicitly define public sharing/admin exceptions.
- Quotas: retain sample or define real values, including concurrency.
- Deletion/retention: define or leave a real pending decision.

## Interface and content

- Main pages/actions and entry → browse/input → detail/result → next step.
- Theme: Sage/Catalog/preserve existing, with visual-theme provenance.
- Private images: none/avatar/covers/other; ownership/quota/references/cleanup under [Files](../FILES.md).
- References/inferred direction, hierarchy/density and layout rationale.
- Actual/user/verified/labeled-fiction/missing content; no invented reviews/customers/metrics.
- [Blueprints](../PAGE-BLUEPRINTS.md): marketing/reading/catalog/workspace/combinations, without selecting external services.
- Shared brand colors/fonts/icon direction in styles.css, preserving control geometry.
- Fonts: actual system/loaded licensed brand files/source/weights, heading sizes/CJK tracking and rendered verification under [Frontend](../FRONTEND.md).
- Motion: finite hero/first-scroll/subtle-hover or explicitly off; dense tools immediate. Record real temporal/reduced-motion/keyboard/no-script acceptance.
- Public copy: remove unchosen development banners/placeholders/sample plans, retain intentional Beta/excerpts/private previews and honest availability.
- [Brand workflow](../BRAND-WORKFLOW.md): preserve identity or autonomously infer direction; rationale/provenance/license/brand.json paths, navigation/16–32px favicon/mobile/themes; home-screen/PWA only as needed.
- Mobile/light-dark/locales: English default and /zh unless product requirements differ.

## External services

- cloud-cost-policy: free-first default, current local/free-data/auth-validation/evidence-based-upgrade stage.
- Target account: Free/existing Paid/unknown; read-only shared-quota/usage checks.
- Mail: explicit/working service first; otherwise verified suitable existing CF Paid/sending eligibility or preference/environment-selected Brevo/Resend. Record mail-provider and actual [Mail](../MAIL.md) acceptance.
- Payment only if needed: actual region/entity/approved accounts/product/owned settlement under [Payments](../PAYMENTS.md). Record stripe|creem test provider/provenance, separating implementation/sandbox/approval/payout, without identity documents/account details.
- Costs: service/free/excess/card/plan/official URL/date, estimates/measured CPU/requests/rows/storage/mail/model usage, upgrade triggers.

See [Costs](../COSTS.md). Data hosting and outbound mail are separate choices; preserve verification/ownership strength rather than weakening security to fit a free tier.

| Capability   | Needed?            | Current status                                           |
| ------------ | ------------------ | -------------------------------------------------------- |
| Mail         | Local / remote TBD | Inbox or selected unconfigured provider                  |
| Google       | TBD                | Unconfigured / configured, real callback pending         |
| Test billing | TBD                | Off by default, no live payments                         |
| AI           | TBD                | Not implemented; define provider/budget/failure/ledger   |
| Files        | TBD                | Opt-in private images, no default new-product R2 binding |

Actual external authorization: first local development defaults to no deployment/real mail/model quota/Git commit or push. Later explicit user setup/test/launch instructions override that default within their scope. Record account/environment/domain/owned test-inbox bounds, never values. The Agent executes authorized steps; human handoff identifies real blockers/minimal actions only.

## Acceptance

Use concrete operations/observations, not only appearance or works:

1. Selected registration/verification/login lets a user complete the core action.
2. Saved edits survive refresh/reopen.
3. User B cannot read/write A's private data where relevant.
4. Invalid/empty/failed/over-quota states behave explicitly.
5. Locales/mobile/desktop/themes preserve the core flow.
6. Long text, keyboard/popovers, focus and narrow layouts remain usable.

Public selected email requires auth-email-live, selected Google auth-google-live, provider/real/current-product evidence under [Deployment](../DEPLOYMENT.md). Local inbox/mock OAuth do not pass them; unselected Google does not block email-only and showcases need neither.

## Agent handoff

- Last update: actual date.
- Adoption: original source version, actual selected paths/fingerprint/regression/deferred items under [Upgrading](../UPGRADING.md), not a whole-version claim for partial adoption.
- Implemented scope/source paths.
- Actually verified commands/actions/evidence paths.
- Unverified/blockers: distinguish missing configuration, environment restrictions and defects.
- Real pending business decisions and immediately actionable next work.

Do not inherit starter historical tests. Update handoff for the next Agent. starter.project.json records choices/tasks/acceptance without credentials. Use project:status, doctor and resume for actual progress/recovery.

## Capability composition

Select showcase/web-app/billing-test/custom from user flow. Record reasons and synchronize reviewed runtime choices through project:modules; unimplemented needs remain pending. Check selected/closed routes and direct APIs plus actual business acceptance, not only hidden buttons.
