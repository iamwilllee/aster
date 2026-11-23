# Give Aster to your Agent

[中文](../AGENT-GUIDE.md)

This checkout is **next/0.3 / v0.3.0-dev.0**, based on the non-payment 0.2.0-beta.1 candidate and not released. Read [0.3 roadmap](ROADMAP-0.3.md). Start with $aster-new or pnpm aster:new. Manual copying/long prompts remain fallback options. Describe the product in the already opened project; current directory is the default, with explicit new paths supported.

Choose [Modules](MODULES.md) first: showcase for public pages, web-app for private data/accounts, AI only as separately implemented requirements. [Payments](PAYMENTS.md) evaluates actual operator region/entity/settlement; Stripe/Creem remain test-only with explicit provider and preserved legacy duties. Other adapters are pending, not approved merchants.

For UI, plan [Pages](PAGE-BLUEPRINTS.md), [Typography](FRONTEND.md#typography-and-reading-clarity), [Motion](FRONTEND.md#page-motion) and [Brand](BRAND-WORKFLOW.md), preserving context/identity. Reuse blueprints and RevealGroup appropriately; fictional/in-memory examples and static screenshots are not real product or temporal acceptance.

## Recommended: start with one request

In the independent source, install locked dependencies once, then the Skill:

```bash
pnpm install --frozen-lockfile
pnpm skill:install
```

The installer links skills/aster-new to ~/.agents/skills/aster-new without overwriting an existing other source. Keep the source directory; moving it requires checking/reinstalling its link. See [Official Skill discovery](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

In a new Agent session within the product directory:

```text
$aster-new Build a private code snippet library here. After login, users can create, search, edit and delete their own snippets. Support English/Chinese and mobile. Complete a locally accepted first version; do not deploy yet.
```

Inspect missing/empty/metadata folders and initialize safely in place. Existing Aster resumes records; other apps are inspected/extended in their architecture without blanket overwrites. Explicit paths resolve from current cwd. Continue requirements/development/acceptance without another chat switch. If discovery is not refreshed, open a new session or have the Agent read skills/aster-new/SKILL.md. Other Agents follow their own Skill discovery, or use the CLI. Clone [Aster](https://github.com/iamwilllee/aster) before repository commands; there is no published npm initializer or invented built-in /aster-new command.

The Skill/execution reference are maintained in English; conversation, requirements and human handoff follow your language. Technical guides are available in English and Chinese without changing runtime identifiers.

## Recommended: one terminal initialization command

From the source:

```bash
pnpm aster:new ../snippet-shelf --name "Snippet Shelf" --brief "Private code snippet library"
```

| Argument        | Meaning                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| Optional target | Current cwd by default; missing/empty/metadata allowed, source protected |
| --name          | Display name; directory-derived package/Worker name                      |
| --brief         | First requirement in PROJECT.md; otherwise template remains pending      |
| --plan          | Agent-authored choices/tasks/acceptance/provenance JSON                  |
| --profile       | showcase/web-app/billing-test; do not combine with --plan                |
| --no-install    | Files only, no install/local migration                                   |
| --inspect       | Read-only directory classification                                       |
| --help          | Command usage                                                            |

Initialize clean files/names/README/PROJECT.md, independent local secrets, frozen install/setup/format and provenance/license. Never inherit source cloud IDs/routes/provider keys/.npmrc credentials/development DB/private artifacts. New profiles bind only selected resources; remote services remain unconfigured. Actual business implementation is Agent work, not initializer output.

Preserve Git/README/personal rules/ignores/editor settings; write ASTER.md when README exists and append rules rather than replace. Existing applications receive inspection/incremental work. After initialization run pnpm dev in the target. Initialization does not start services, switch chat cwd, create Git history or deploy. Generated products remove source initializer commands; create later products from the independent source, never a customer product.

Failed install/migration and --no-install retain progress. Fix the actual environment and run project:resume without recopying/resetting secrets. Local DBs named starter-db remain independent through each .wrangler. Remote DBs need actual independent configuration. Follow [Database](DATABASE.md): local db:migrate; explicit staging/production remote plan/check/apply/status with actual authorization, backups/history/recovery. Deploy blocks pending/bad migrations; local deploy:check does not read cloud state.

## Requirements, checks and business acceptance

The Agent records goal/audience/flow in PROJECT.md and normalized choices/tasks/evidence in starter.project.json, preserving user/context/default reasons. Scripts do not keyword-enable business features. Blocking decisions stop dependent work only; other work continues.

```bash
pnpm project:doctor
pnpm project:status
pnpm project:resume
pnpm project:check
pnpm project:check --ready
```

doctor is redacted/read-only/dependency-free and does not stop occupied-port services or claim provider readiness. resume installs frozen dependencies only as needed and idempotently runs local setup, preserving business/secrets/records. Missing config/secrets must be restored, not regenerated over existing identity.

Machine JSON has stable script formatting, excluded from Prettier. See [Plan format](../../skills/aster-new/references/workflow.md). Legacy manually copied projects may retain their existing workflow; recovery cannot invent/overwrite records. New initialization is the supported full workflow.

implemented tasks need actual source paths; passed cases need current-product reports/screenshots and truthful local/mock/real scope. Path consistency does not judge screenshot/business correctness. Mocks cannot pass real provider cases, historical starter QA is not product evidence, and bootstrap/baseline success is not business completion or deployment.

Add concrete business success/invalid/error/empty/persistence/ownership/mobile/locale cases alongside baseline checks. Reset affected claims when requirements/code change and clear blockers only after verification. New-product brand-identity stays pending until actual design or reviewed existing identity and rendered acceptance.

## Without a Skill

Use the generated project's existing brief/plan, optionally [Brief template](templates/PROJECT-BRIEF.md), without replacing handoff. Mark unknown choices pending, then continue independent work.

```text
Develop this product in the current Aster project. Read AGENTS.md, README.md, docs/en/AGENT-GUIDE.md, docs/en/DEVELOPMENT.md and PROJECT.md, then inspect current implementation.
Use PROJECT.md as the requirements source and reuse TanStack Start, Workers/D1, Better Auth, Drizzle and shared shadcn/Base UI. Explain first-version scope, reuse, gaps and acceptance, then implement a working local version. Record reasonable noncritical defaults; ask only for blocking account/business choices.
Install frozen dependencies and run setup when needed. Preserve lockfile and .dev.vars, never expose secrets/cookies/verification links. Keep owner isolation, default English and /zh. Files are opt-in; AI/usage ledger require separate implementation.
Run relevant checks and inspect actual pages. Deliver the local URL, changes, evidence and remaining configuration. Without additional authorization do not commit/push/deploy/activate paid services/send real mail/consume model quota/enable live payments.
```

Example **requirements**, not existing snippet business:

```text
Snippet Shelf for independent developers: register/login → create snippets (title/language/body) → search → edit/delete. Owner-only and persistent after refresh, bilingual/mobile. Replace sample projects with snippets. No AI/files/teams/payments in the first locally accepted version.
```

## First startup and development sequence

Inspect cwd/dirty files/Node/pnpm/config/ports and preserve unrelated work/services. Default origin 127.0.0.1:3100 must match auth/inbox; existing products/worktrees use their own configured origin. If a port is occupied, identify ownership before action; do not stop another project. Changes to origin/scripts/tests must stay consistent under [Development](DEVELOPMENT.md).

```bash
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

Use Node24/pnpm12.11.2. Existing secrets/data survive setup. Default English/Chinese URLs are http://127.0.0.1:3100 and /zh. Local signup verification/reset uses /dev/inbox or /zh/dev/inbox, not a real provider. Links are sensitive, local-only and never tunneled. There is no seeded admin/shared account/password.

1. Verify reused capabilities vs business work/provider prerequisites.
2. Record users/flow/ownership/scope/acceptance in PROJECT.md; avoid rebuilding the architecture or a generic plugin platform.
3. Replace brand/copy/sample workspace according to [Brand workflow](BRAND-WORKFLOW.md) and page direction. Keep user identity and shared component contracts. Do not globally replace internal starter strings.
4. Implement business with owner-scoped server reads/writes and generated additive migrations.
5. Validate real flows, update README/changelog/brief/records and deliver actual results.

Do not edit generated routeTree/Worker types/applied SQL. Keep source version/provenance distinct from product version. Example Free3/Pro50 quotas/statuses/list limits need actual domain redesign, not a text rename or weakened auth/quota.

| Need                    | Entry                                          |
| ----------------------- | ---------------------------------------------- |
| Name/description/limits | src/config/site.ts                             |
| Pages/workspace         | src/routes                                     |
| Theme/icons/controls    | styles.css, config/brand.json, components/ui   |
| Messages                | i18n/en.json and zh.json, locale:check         |
| Business/API            | modules and server/api.server.ts               |
| Schema/migrations       | db/schema.ts, db:generate/local db:migrate     |
| Auth/mail               | modules/auth and modules/mail                  |
| TEST billing            | modules/billing                                |
| Cloud/secrets           | wrangler.jsonc and private environment secrets |

## Continue and prepare a release

For updates invoke $aster-new to inspect current source/version/fingerprint/differences, merge applicable modules, regress and record actual adopted paths. Missing legacy baselines require conservative review, not reinitialization. See [Upgrading](UPGRADING.md).

```text
Continue this product. Read its rules, PROJECT.md, starter.project.json and affected code; run doctor/status, or resume interrupted bootstrap without discarding changes.
Requirement: [user task]
Users/data: [read/write/private boundaries]
Acceptance: [steps, success/failure/empty, persistence]
Out of scope: [exclusions]
Implement with existing modules, check/browser-test and update evidence/handoff. For external setup, inspect current connections/permission/scope and execute authorized steps. Ask only for a concrete missing login/activation/permission; resume afterward.
```

For **plan-only** staging preparation:

```text
Read Deployment and Costs. Prepare a free-first staging plan targeting USD0 in initial new cloud costs. Separate Workers/D1, transactional mail, files and AI requirements/limits/status/costs; CF email paid eligibility is not a whole-product prerequisite.
Review independent Worker/D1/domain/mail/selected Google/test billing/migrations. Complete local production-build checks, config differences, migration/recovery plan and missing configuration. Do not create resources, migrate remotely or deploy. Keep secrets private and provide reviewable costs/commands/acceptance.
```

Explicitly authorize environment/action scope afterward. cloud-cost-policy is a planning preference, not a bill read/card/paid activation. Auth is chosen during requirements, configured/accepted on staging and gated before production; unselected methods stay hidden. Selected email/Google require auth-email-live/auth-google-live real product evidence. deploy:check is local; actual deploy checks names/migrations, not provider behavior.

Mail preserves explicit/working services. With none, verified suitable existing Workers Paid/sending eligibility favors CF; otherwise preference/environment guide Brevo/Resend under [Mail](MAIL.md). Runtime MAIL_MODE is explicit; updating the Skill does not update old adapters/config.

For an **authorized real integration**, for example:

```text
$aster-new Integrate email signup/recovery and complete real receipt acceptance. Preserve existing Google, pages, data and secrets. You may configure the specified staging environment, existing mail account and sender subdomain and deploy an acceptance build there. Use my explicitly authorized owned test inbox. Stay free-first, do not activate paid plans or publish production. Execute available setup/testing; identify only concrete login/verification/review/permission blockers.
```

Use actual target/account/inbox context; ask if required data is missing. This does not authorize business-user test mail or support messaging. No-deploy remains no-deploy, including staging. Read [Human handoff](MAIL.md#agent-execution-and-human-handoff) and resume project:service stages with actual remote checks/independent business evidence, not just hashes.

## Delivery standard

Application changes run pnpm check and format:check. check permits incomplete business plans; project:check --ready separately requires required cases.

| Change                         | Additional verification                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Workflow/login/business API/UI | Browser install once, then test:e2e                                                             |
| Runtime/auth/environment       | test:production/relevant profiles                                                               |
| UI                             | Actual desktop/mobile/themes/loading/empty/errors/interactions                                  |
| Docs only                      | Format, links, commands/paths against implementation; no need to rerun unrelated full app tests |

Keep local fixtures, serialize builds/production tests sharing3110, and stop only owned test processes. Never confuse development E2E writes with developer data-free production smoke.

Deliver working URL/short action path or startup command, scope/changed paths, actual checks/browser evidence/limitations, private provider-configuration handoff, migrations and resumable PROJECT.md. Unexecuted checks remain unexecuted.

## Reusable scope and optional capabilities

[Security](ACCOUNT-SECURITY.md) includes current-credential password changes, safe device summaries/other-session revocation and cookie rotation, not raw SDK token JSON/native browser session APIs. [Lifecycle](ACCOUNT-LIFECYCLE.md) needs complete auth hooks/migrations/reservations/archive callbacks, current provider review and new-business ownership maps; old unverified links need resend.

Auth/local mail/private CRUD/workspace/locales/themes/quotas/admin/minimal audit/test reconciliation exist. Live Google/mail/merchant eligibility still need product setup/acceptance. AI calls/usage ledger/live billing/full retention/teams/automatic online updates are not implemented; add concrete requirements/authorization/failure/acceptance rather than claiming copying activates them. No one-command conflict-free upgrade is promised.

[Themes](THEMES.md) select Sage/Catalog without selecting auth/payments. [Files](FILES.md) tests upload/refresh/reference/replace/delete/ownership locally, then separate private environments/files-live. [Content](CONTENT.md) uses optional drafts/preview/publish/anonymous reads/withdrawal, text without R2 and dedicated public covers, retaining shared data across contributor deletion. [Admin](ADMIN.md) uses verified/enabled roles, explicit grants, revisioned suspension/revocation, last-admin guards, triggers/sanitized logs and real regression. Each adoption merges dependencies, not just pages/Skill.

## Development task usage

[Task usage](AGENT-USAGE.md) provides local Codex measurements for initialization, refactoring, authentication and other tasks, distinguishing partial coverage, pending closure and unavailable data. The Skill handles boundaries/reports while users describe goals naturally. No uploads or product AI quota/billing are enabled. Old products need reviewed tooling adoption or the explicit source helper.
