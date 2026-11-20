# Local, staging and production databases

[中文](../DATABASE.md)

Daily development uses local D1; production uses remote D1. Create a separate staging database only for online integration/acceptance. They share committed migration SQL but keep separate data/history. No extra cloud DB purchase is needed for local tests. Never upload local accounts, sessions or test data to production. Showcases with database disabled skip this flow.

## Agent entrypoint

```text
$aster-new Check database release readiness. Preserve existing data and environment isolation. Review targets, SQL compatibility, costs and recovery, then complete local checks. Do not operate remotely yet.
```

Once the target migration is explicitly authorized, perform configuration checks, backups, migration and validation rather than returning a command checklist. Plan-only/no-deploy also excludes staging mutations. Plans, previous receipts and Skill invocation are not new authorization. Database creation, Worker deployment, migration and overwrite recovery are distinct operations.

## Daily development

1. Edit src/db/schema.ts, run `pnpm db:generate`, review new SQL. Never rewrite applied migrations.
2. `pnpm db:migrate` reads the actual root DB name and explicitly migrates --local into this project's .wrangler/state/, without hardcoded sample names.
3. Test business behavior, owner isolation, persistence after refresh and failure states.

setup uses this local entrypoint. It rejects root remote:true and ignores external CLOUDFLARE_ENV, so selecting staging in a shell cannot migrate online data. A real root database_id remains a local simulation identifier, not a remote connection. Do not substitute --remote for local testing.

Keep existing preview_database_id rules; otherwise Wrangler uses database_id locally. Changing these identifiers may open a different local DB while old files remain; this is not cloud migration. Record identifiers/back up locally before changing IDs. Never solve local identity changes by uploading a test DB.

## Explicit-environment releases

Read [Costs](COSTS.md) and [Deployment](DEPLOYMENT.md). Confirm account, Worker, actual DB name/ID, existing data and permission. Staging/production IDs must differ. Tools do not create DBs, alter plans/secrets or deploy Workers.

```bash
# Local target/SQL/hash plan only; returns release-id, no cloud connection.
pnpm project:database plan --env staging
# Read-only remote history/integrity; exit 2 means pending migrations.
pnpm project:database check --env staging
# Only after migration authorization for this target: backup → apply → verify.
pnpm project:database apply --env staging --id <release-id>
# Local progress, no cloud operation.
pnpm project:database status --env staging
```

For production explicitly pass --env production and create its own release-id; database commands never default to production. Default deployment remains `pnpm deploy`, staging `pnpm run deploy --env staging`.

Existing products with env.production retain that layout: DB tools prefer the named environment and remote/recovery commands include --env production. Local migration still uses the root DB. Merge read-only preflight into the existing deployment entrypoint, rather than overwriting configuration. The foundation's default remains root production / env.staging.

Plans list local SQL and review flags, not remote pending state. check/apply read actual remote history and reject unknown files, ordering differences or SQL changed after a locally recorded execution. First adoption of an old DB can verify filenames only: D1 history has no SQL hashes, so review trusted historical source. Business tables without migration history need a separate baseline plan; never auto-claim them. Only existing top-level numbered Drizzle SQL is supported; custom globs/nested migration layouts need explicit integration.

Read-only checks use SELECT/PRAGMA, not `wrangler d1 migrations list`, which can initialize history. Empty DB checks create no tables. quick_check/foreign_key_check do not prove business/provider behavior. Large scans/exports/migrations may take time, interrupt service or consume quotas: assess scale and maintenance windows.

### What apply does

- Pin environment, configured account, DB ID and SQL hashes; reject stale/tampered plans and symlinks. Use a minimal dedicated Wrangler config, not Vite deployment redirects.
- Re-read remote history and apply only remaining SQL, never local D1 data files.
- Before pending migrations, get a Time Travel bookmark and complete nonempty remote SQL export. Stop if backup fails.
- Re-read history, require no pending files, then check integrity/FKs. Record actual stages without passing login/CRUD/mail/payment acceptance.

Receipts/pinned SQL/backups live in private .local/database-releases/<release-id>/, excluded by Git/initializer, with 0700 directories/0600 files. Backups contain real personal/auth data; keep them on controlled devices/private storage, never in repositories, chat or public QA. Subprocess output/Wrangler debug persistence is suppressed to avoid signed-export-URL/SQL leakage.

Local locks and before/after history checks do not coordinate multiple machines or replace a maintenance window/global lock. Use one operator per DB. Bookmark/export/migration are not one transaction while writes continue. Prefer additive schema → compatible reads/writes → backfill → code switch → later removal. Check compatibility with the still-running Worker; a backup does not make destructive SQL safe.

## Resume

Read status, confirm current remote state and continuing authorization, then apply the same release-id. Every retry reads actual history rather than trusting local completion. Keep prior backups and create a new backup for remaining migrations after partial success. With no pending SQL, only history/integrity are checked; SQL is not replayed.

Changed targets/SQL require a new plan; applied SQL changes require a new migration, not a replan bypass. failedPhase identifies the interruption. Inspect actual database/business state after migration/verification failure. Rolled-back remote history needs human review before continuing.

After proving the old process stopped, `pnpm project:database unlock` clears only an absent local lock-owner process, never active/other-host locks. It does not stop services automatically.

## Recovery and deployment checks

```bash
# Generates actual recovery points, backup hashes and exact commands; does not restore.
pnpm project:database recovery --env staging --id <release-id>
```

Use real backup bookmarks, not invented points. Check current plan retention/availability and writes since the point. Time Travel overwrites those writes: coordinate/pause writes, back up the present, review Worker/schema compatibility and exact restore scope, then execute only with specific overwrite authorization. SQL recovery should first be rehearsed on an independent target; importing into a live DB is not a safe undo. Worker rollback and DB restore are separate.

After recovery, check history/integrity and real business behavior, then choose compatible code/new migrations. Old verified/provider receipts are stale. No automatic down migrations or overwrite-on-failure occurs, protecting newer writes.

Actual deploy checks selected remote history/integrity before build and again before publish. Pending/divergent/inaccessible/corrupt DBs block it. deploy:check remains local and cannot establish remote migration completion. Database validation still requires actual UI/API/session/provider acceptance.

Existing products adopt the two DB scripts, package commands, deployment preflight and docs under [Upgrading](UPGRADING.md), preserving config/schema/applied SQL. Updating a Skill link does not install these scripts.

Reference date: 2026-10-24. [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [PRAGMA](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). Retention/limits require current-account verification.
