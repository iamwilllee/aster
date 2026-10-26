# Aster development guide

## Project

TanStack Start + React + TypeScript, Cloudflare Workers/D1, Better Auth + Drizzle. Use pnpm and preserve the lockfile. Keep solutions simple; extend existing modules before adding dependencies. Do not introduce Next.js, a second component framework, state library, or database deployment branch without a concrete need.

## Product handoff

Use the bundled `aster-new` Skill in the current project by default; explicit target paths are optional. It detects missing/empty/metadata-only directories, existing Aster products and other apps. Initialize in place when safe; preserve Git, README, personal rules and editor config. Existing apps are inspected and extended rather than overwritten or forcibly migrated. The CLI can also run from the original Aster source with a target directory. Read `docs/AGENT-GUIDE.md` and the product's `PROJECT.md` before implementation. Use `docs/templates/PROJECT-BRIEF.md` to create a brief when needed; keep business scope and human handoff there. Track choices/provenance, tasks, current acceptance evidence and bootstrap checkpoints in `starter.project.json`. Use `project:doctor`/`project:status` before resuming and `project:resume` for interrupted local initialization. Never mark mock tests as real provider acceptance; reset affected cases when requirements or code change. `project:check --ready` checks records and paths, not business behavior. Preserve this guide's technical boundaries and the recorded starter source version. Keep local QA, personal research and conversation records out of the public repository; every product needs its own acceptance evidence.

## Map

- `skills/aster-new`: Skill entrypoint and deterministic new-product initializer.
- `scripts/project*.mjs`: project plan validation, redacted doctor, status and local-only bootstrap recovery.
- `scripts/project-upgrade.mjs`: read-only upgrade plans, hash-guarded file copies/backups, partial adoption records and conservative rollback; see docs/UPGRADING.md.
- `scripts/install-skill.mjs`: install a non-overwriting user Skill link.
- `tests/starter`: initializer isolation and overwrite protection checks.
- `src/routes`: file routes, public pages, protected `/app` workspace, API catch-all.
- `src/modules`: authentication, mail, Stripe/Creem test integrations, project validation.
- `src/server`: server functions, request validation, authorization, private API.
- `src/db/schema.ts` and `migrations`: authoritative schema and generated SQL.
- `src/components/ui`: shadcn/ui base-nova source; `src/styles.css`: shared tokens.
- `src/config/site.ts`: name, localized description and plan limits.
- `src/config/features.json`: public capability choices shared by runtime, setup and deployment; see docs/MODULES.md.
- `src/i18n`: typed English/Chinese dictionaries, path locale and public error mapping.
- `tests/production`: isolated production Worker acceptance; no developer data or real provider secrets.
- `tests/unit`: policy/request boundaries and Stripe/Creem/D1 reconciliation.
- `tests/e2e`: API isolation and browser workflows.

## Rules

1. Import Cloudflare bindings only from server modules. Never send secrets, sessions, password hashes, or verification tokens into client loaders or logs.
2. Build auth per request. Scope every private read/write by authenticated user ID. Admin status comes from `admin_user`, never client input.
3. Apply project quota in the same atomic statement as creation. D1 batch/conditional writes are used for consistency; KV is not an authority or lock.
4. Stripe and Creem are TEST ONLY. Read docs/PAYMENTS.md for provider eligibility, explicit selection, legacy obligations and provider-specific acceptance. Creem uses only the fixed sandbox API; never switch it to production credentials/hosts. Returning from checkout does not grant access. Verify the raw signed webhook, deduplicate, retrieve current provider state, then reconcile with revision checks. Keep webhook/portal working if new checkout is disabled.
5. `.dev.vars` and `.wrangler` stay private. Local mail URLs may only be exposed on the matching loopback origin with `ENVIRONMENT=local`. Never seed real accounts or publish test secrets.
6. Preserve loading, empty, error, dark-theme and mobile states. Use Base UI/shadcn components, Lucide and existing tokens. Mark unconnected functionality honestly.
7. Generate migrations with `pnpm db:generate`; do not silently edit an already applied migration. Update docs/changelog for meaningful behavioral changes.
8. English is the default; Chinese URLs use `/zh`. Keep SSR locale request-scoped, preserve locale across navigation and auth callbacks, and run `pnpm locale:check` after message changes. Never expose arbitrary provider errors.
9. Do not commit, push, publish or rewrite history unless requested. Preserve unrelated working-tree changes.
10. Read `docs/FRONTEND.md` and, for page composition/content, `docs/PAGE-BLUEPRINTS.md` before UI work. Business TSX imports controls from `src/components/ui/`; direct Base UI imports and native button/input/select/textarea elements belong in that layer. Add missing controls there first. Use shared `size` variants (sm 32px, default 36px, lg 44px) and match single-line controls in a row. Do not override control height, vertical padding, font size or radius in pages. Use `buttonVariants` for button-like links. ESLint enforces these boundaries; explain narrow exceptions inline rather than disabling rules for a file.
11. Read `docs/COSTS.md` before cloud planning. Default to free-first and record `cloud-cost-policy` with provenance; separate Workers/D1 from mail, storage and AI choices. Check account-wide quotas and CPU/runtime limits. Do not infer a Workers Paid requirement from the existing CF mail adapter. Budget/plan records do not authorize purchases or cloud mutations; follow the user's actual scope. Do not add unused paid/metered bindings or weaken auth to fit a free tier.
12. Read docs/MODULES.md first and select capabilities from the product flow. Public showcase sites may disable auth/database/mail/billing. When email authentication is selected, default to display name/email/password; Google is opt-in. Hide unconfigured optional providers from visitors. Choose auth methods during requirements, configure and verify them in staging, then publish. Public email releases require current auth-email-live provider evidence; selected Google also requires auth-google-live. Deploy checks records/config locally and required remote secret names before actual deployment; neither proves real provider behavior. Unconfigured preview UI must not advertise usable registration/reset or expose setup diagnostics. Username login is not the display-name field.
13. Read docs/MAIL.md for mail integration. Preserve explicit user choice or a working provider. With no existing choice, prefer CF when the target account already has suitable Workers Paid and Email Sending eligibility; otherwise choose Brevo/Resend from preference and current environment. Record mail-provider provenance. Keep unknown account status unknown, never auto-upgrade, auto-detect plans at runtime or fail over between providers. Local inbox remains the default for development; only the chosen provider needs a remote key/binding.
14. When the user requests provider configuration and real acceptance, execute both within the existing authorized scope instead of ending with a checklist. Inspect available connections and complete executable steps. Ask only for the specific missing login/verification, permission, platform activation or purchase approval; resume from recorded progress afterward. Respect plan-only/local-only/no-deploy instructions and do not treat staging as exempt from a deployment prohibition. Default brief templates do not override later user authorization.
15. Read docs/UPGRADING.md before adopting upstream changes. New products keep .aster/baseline.json; legacy products without it require review and must not acquire an invented original baseline. Scan before editing, apply only selected pristine update/add files, and back up manual merges. Preserve business, brand, secrets, deployed config and applied migrations. Reset affected acceptance, run relevant regression, then record only actual adopted paths. Partial adoption preserves the original source version; rollback must preserve edits made after the upgrade.

16. For mail/Google configuration tasks, read `docs/SERVICE-WORKFLOW.md`; track per-product integrations with project:service plan/record/status. Resume valid checkpoints, inspect current scope and live state, continue independent actionable work, and record precise human blockers. Changed inputs/evidence/credentials require affected revalidation; progress is not authorization or real business acceptance.

17. Runtime capability choices live in src/config/features.json and must agree with the product plan. Use project:modules for reviewed local changes; close disabled routes/APIs and skip their configuration/acceptance gates. Preserve existing resources, data and billing obligations; unimplemented AI/usage stay disabled and explicitly pending.

18. Read docs/DATABASE.md before database releases. db:migrate is local-only; remote plan/check/apply/status require an explicit environment. Review SQL and compatibility with the still-running Worker, then use private backup/bookmark and current remote history before authorized migration. Never upload local test databases or edit applied migrations. Resume from actual remote state; changed targets/SQL need a new plan. deploy blocks pending/divergent migrations or integrity failures but does not migrate. Recovery generates a plan only; review write loss and the specific restore authorization before executing an overwrite. Local receipts are not business/provider acceptance or a remote global lock.

19. Read docs/ACCOUNT-LIFECYCLE.md before extending data export or account deletion. Export only owner-scoped business/profile fields, never authentication secrets. Map new business/shared data before claiming full deletion. Require password verification or a recent original-method login; preserve account-bound verification links. Billing history requires a fresh provider review, even when billing is disabled. Block active/unresolved subscriptions, invoices and unknown/open checkouts; expiring links requires explicit confirmation. Archive minimal reconciliation records atomically before deleting a user and preserve late signed webhook handling. Apply the additive migration before compatible code. Preserve checkout reservations through ambiguous provider failures; do not erase billing records to unlock deletion or reopen native deletion endpoints.

## Checks

For UI work, record the product's visual direction, content density, primary actions and page compositions in PROJECT.md before implementation. Reuse the index in docs/FRONTEND.md and src/components/patterns; the green theme and sidebar are examples, not a required product identity. Preserve component geometry, semantics and keyboard behavior when changing brand/layout. Demo content must be labeled and must not imply provider connectivity or saved data.

Initial: `pnpm install --frozen-lockfile`, `pnpm setup`. Then `pnpm check`, `pnpm format:check`. Use `pnpm exec playwright install chromium` and `pnpm test:e2e` when a user workflow changes. Use `pnpm test:production` for runtime/auth/environment changes. Check rendered desktop/mobile pages for visual changes. Document actual validation separately from cloud/provider acceptance.

The generated `worker-configuration.d.ts` and `src/routeTree.gen.ts` must not be hand-edited. Regenerate using setup/build when bindings or routes change.

20. Read docs/FILES.md before changing private images or references. Reserve quota atomically; owner-scope every read/write. Keep ambiguous uploads pending and cleanup failures retriable. Account deletion must confirm storage cleanup even when files is disabled; JSON export excludes image bytes. Apply the additive migration before compatible code. Theme choices use src/config/appearance.json; read docs/THEMES.md and preserve control geometry and existing brands.

21. Read docs/CONTENT.md for editorial content and site assets. Keep drafts and live snapshots separate; revision-guard every mutation and check current admin permission on the server. Publish only dedicated content_asset covers, never private file_asset IDs. Public reads require a live reference and no-store responses; withdrawn content must not remain in sitemap. Site content/assets survive contributor deletion after explicit retention confirmation, with actor FKs nulled. Default content off in new products; text-only content needs no R2. Apply migration before compatible code and keep content-live target acceptance separate from local tests.

22. Read docs/ADMIN.md for user operations. Only verified enabled admin_user members may administer accounts. Keep versioned status, session revocation and minimal audit atomic; preserve auth mutation triggers and last-active-admin guards across web, role CLI and account deletion. Never suspend self, revive revoked sessions, erase business/billing data or block signed reconciliation callbacks. Preserve auth log severity with sanitized categories; privileged SQL maintenance is not attributed to an invented human actor.

23. Follow docs/FRONTEND.md typography guidance. Use available system fonts by default; a named brand font needs an actual licensed load and rendered-font verification. Preserve deliberate theme/brand choices, readable public copy, normal CJK tracking and shared control geometry. Do not globally bold or scale text to mask rendering issues; verify desktop/mobile, both locales and light/dark states.
