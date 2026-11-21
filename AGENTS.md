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
- `src/server`: server functions, request validation, authorization, private API. `src/start.ts`: request middleware (security headers, server-function CSRF); keep `src/server/security-headers.ts` pure and unit-tested.
- `src/db/schema.ts` and `migrations`: authoritative schema and generated SQL.
- `src/components/flatpack`: Flatpack components copied unmodified by `pnpm flatpack:sync`; never hand-edit. `src/components/ui`: Aster wrappers that re-export them and add only Aster behavior (hydration guard, i18n). `src/styles/flatpack.css`: the Flatpack theme layer, copied by `pnpm flatpack:sync`; never hand-edit it. `src/styles.css`: Tailwind color mapping and Aster motion.
- `src/config/site.ts`: name, localized description and plan limits.
- `src/config/features.json`: public capability choices shared by runtime, setup and deployment; see docs/MODULES.md.
- `src/i18n`: typed English/Chinese dictionaries, path locale and public error mapping.
- `tests/production`: isolated production Worker acceptance; no developer data or real provider secrets.
- `tests/unit`: policy/request boundaries and Stripe/Creem/D1 reconciliation.
- `tests/e2e`: API isolation and browser workflows.

## Rules that always apply

1. Import Cloudflare bindings only from server modules. Never send secrets, sessions, password hashes, or verification tokens into client loaders or logs.
2. Build auth per request. Scope every private read/write by authenticated user ID. Admin status comes from `admin_user`, never client input.
3. Apply project quota in the same atomic statement as creation. D1 batch/conditional writes are used for consistency; KV is not an authority or lock.
4. Stripe and Creem are TEST ONLY. Read docs/PAYMENTS.md for provider eligibility, explicit selection, legacy obligations and provider-specific acceptance. Creem uses only the fixed sandbox API; never switch it to production credentials/hosts. Returning from checkout does not grant access. Verify the raw signed webhook, deduplicate, retrieve current provider state, then reconcile with revision checks. Keep webhook/portal working if new checkout is disabled.
5. `.dev.vars` and `.wrangler` stay private. Local mail URLs may only be exposed on the matching loopback origin with `ENVIRONMENT=local`. Never seed real accounts or publish test secrets.
6. Preserve loading, empty, error, dark-theme and mobile states. Use Base UI/shadcn components, Lucide and existing tokens. Mark unconnected functionality honestly.
7. Generate migrations with `pnpm db:generate`; do not silently edit an already applied migration. Update docs/changelog for meaningful behavioral changes.
8. English is the default; Chinese URLs use `/zh`. Keep SSR locale request-scoped, preserve locale across navigation and auth callbacks, and run `pnpm locale:check` after message changes. Never expose arbitrary provider errors: server errors are `new HttpError(status, '<message key>')`, logs carry the error class and `requestId` but never messages (`src/server/observability.ts`, guarded by `tests/unit/error-messages.test.ts`).
9. Do not commit, push, publish or rewrite history unless requested. Preserve unrelated working-tree changes.
10. When the user requests provider configuration and real acceptance, execute both within the existing authorized scope instead of ending with a checklist. Inspect available connections and complete executable steps. Ask only for the specific missing login/verification, permission, platform activation or purchase approval; resume from recorded progress afterward. Respect plan-only/local-only/no-deploy instructions and do not treat staging as exempt from a deployment prohibition. Default brief templates do not override later user authorization.

## Before you change one of these, read the document

Each line names the document to read and what must stay true. The document has the detail; the line is what to remember if you read nothing else.

- **UI, pages and controls** (`docs/FRONTEND.md`; `docs/PAGE-BLUEPRINTS.md` for page composition): business TSX imports controls from `src/components/ui/` (which wraps the synced `src/components/flatpack`), uses the shared `size` variants (sm 32px, default 40px, lg 48px) and never overrides control height, padding, font size or radius; `buttonProps` for button-like links. Colors, themes and geometry come from Flatpack: change them there, then run `pnpm flatpack:sync`. ESLint enforces this.
- **Type and motion** (`docs/FRONTEND.md`): system fonts by default, a named font needs a real licensed load and a rendered check; never bold or scale text globally to hide a rendering issue. Motion is finite (`RevealGroup`), dense tools stay immediate, and reduced motion, keyboard and no-script stay readable.
- **Themes and branding** (`docs/THEMES.md`, `docs/BRAND-WORKFLOW.md`): the theme lives in `src/config/appearance.json` and assets go through `src/config/brand.json`; preserve an existing identity and control geometry; a file check is not the rendered review.
- **Cloud cost** (`docs/COSTS.md`): free-first; record `cloud-cost-policy` with provenance; budget or plan records do not authorize purchases or cloud mutations; do not infer Workers Paid from the CF mail adapter or weaken auth to fit a free tier.
- **Capabilities** (`docs/MODULES.md`): `src/config/features.json` agrees with the product plan and changes through `project:modules`; close disabled routes and APIs; preserve existing resources, data and billing obligations; unimplemented AI and usage stay disabled. Email authentication defaults to display name, email and password, Google is opt-in and hidden when unconfigured; a public email release needs current `auth-email-live` (and `auth-google-live`) evidence, and deploy checks do not prove provider behavior.
- **Mail** (`docs/MAIL.md`): keep the user's explicit choice or a working provider and record its provenance; unknown account status stays unknown; never auto-upgrade, detect plans at runtime or fail over between providers.
- **Provider setup and acceptance** (`docs/SERVICE-WORKFLOW.md`): track with `project:service`; resume valid checkpoints and record precise human blockers; changed inputs or credentials need revalidation; progress is not authorization or acceptance.
- **Upgrading** (`docs/UPGRADING.md`): scan before editing; apply only selected pristine files and back up manual merges; never invent a legacy baseline; preserve business, brand, secrets, deployed config and applied migrations; record only the paths actually adopted.
- **Database releases** (`docs/DATABASE.md`): `db:migrate` is local-only; remote plan, check, apply and status need an explicit environment, reviewed SQL that is compatible with the running Worker, a private backup or bookmark and current remote history. Never upload local databases or edit applied migrations. `deploy` blocks on pending or divergent migrations but does not migrate; recovery generates a plan only, and an overwrite needs specific restore authorization; local receipts are not acceptance or a global lock.
- **Account export and deletion** (`docs/ACCOUNT-LIFECYCLE.md`): export owner-scoped fields only, never authentication secrets; map new business and shared data before claiming full deletion. Deletion needs the password or a recent original-method login and a fresh billing review (even when billing is disabled), and blocks on live subscriptions, unresolved invoices and open checkouts. Archive reconciliation records atomically and keep late signed webhooks working; never erase billing records to unlock deletion or reopen the native deletion endpoints; apply the additive migration before compatible code.
- **Private files** (`docs/FILES.md`): reserve quota atomically and owner-scope every read and write; ambiguous uploads stay pending and cleanup failures retriable; account deletion confirms storage cleanup even when files is disabled; apply the additive migration first.
- **Editorial content** (`docs/CONTENT.md`): drafts and live snapshots stay separate; every mutation is revision-guarded with a server-side admin check; publish only dedicated `content_asset` covers, never `file_asset` IDs; withdrawn content leaves the sitemap; contributor deletion needs explicit retention confirmation; apply the migration before compatible code.
- **Admin operations** (`docs/ADMIN.md`): only verified, enabled `admin_user` members administer accounts; status, session revocation and the minimal audit are atomic; keep the last-active-admin guards across web, role CLI and account deletion; never suspend yourself, revive revoked sessions, erase business or billing data, or block signed reconciliation callbacks.
- **Development task measurement** (`docs/AGENT-USAGE.md`): local telemetry stays separate from product AI and usage modules; identified-thread metadata only, in the ignored `.local/agent-usage/`; never infer bills or acceptance from task outcomes; honor opt-outs.
- **Documentation** (`docs/README.md`): the Skill and its execution reference stay in English while you reply in the user's language; update `docs/` and `docs/en/` together, plus the `docs/catalog.json` fingerprints. `pnpm docs:check` does not prove translation correctness.

## Checks

For UI work, record the product's visual direction, content density, primary actions and page compositions in PROJECT.md before implementation. Reuse the index in docs/FRONTEND.md and src/components/patterns; the green theme and sidebar are examples, not a required product identity. Preserve component geometry, semantics and keyboard behavior when changing brand/layout. Demo content must be labeled and must not imply provider connectivity or saved data.

Initial: `pnpm install --frozen-lockfile`, `pnpm setup`. Then `pnpm check`, `pnpm format:check`. Use `pnpm exec playwright install chromium` and `pnpm test:e2e` when a user workflow changes. Use `pnpm test:production` for runtime/auth/environment changes. Check rendered desktop/mobile pages for visual changes. Document actual validation separately from cloud/provider acceptance.

The generated `worker-configuration.d.ts` and `src/routeTree.gen.ts` must not be hand-edited. Regenerate using setup/build when bindings or routes change.
