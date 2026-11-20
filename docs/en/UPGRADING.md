# Upgrade an existing product

[中文](../UPGRADING.md)

In the product project:

```text
$aster-new Inspect foundation updates, adopt improvements appropriate to this product and complete regression. Preserve business, brand, pages, data, personal rules and secrets. Do not deploy yet.
```

Read product rules/brief/plan/implementation and locate the independent source through the installed Skill's real path. Adoption includes local merges/regression; check-only requests deliver reviewable differences. Git, cloud and deployment follow actual user scope.

## Source and baseline

New products get .aster/baseline.json with source version/fingerprint, upstream/initial-product SHA-256 hashes and per-path adoption history. It contains no source bodies, credentials or absolute source paths and may be committed with the product; never copy it from another product.

Fingerprint only allowed template files. Ignore development data, private config, caches and generated files; same-version unpublished changes remain distinguishable. starter-version.json retains the original source version during partial adoption.

Legacy projects without baselines enter legacy-missing. Review differences/missing files without inventing their history or restoring intentional deletions. Record only reviewed/adopted paths after testing. Hashes cannot reconstruct original content; read real product/upstream code and trusted Git history if needed.

## Scan classifications

| Status                 | Action                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| aligned                | Same content; source adoption still requires relevant regression                     |
| unchanged / customized | Upstream unchanged; preserve product content                                         |
| update / add           | Pristine update/new file eligible for selected backed-up apply                       |
| conflict               | Both sides changed or an earlier merge retained customization; Agent merge           |
| review                 | Protected dependencies, deployment, brand/config, DB/migrations/rules; manual review |
| deleted-locally        | Preserve intentional local deletion                                                  |
| removed-upstream       | Do not automatically delete product files                                            |
| legacy-review          | No trusted baseline; never auto-overwrite                                            |

mail/auth/billing/ui/data/workflow/docs/shared labels aid selection but are not dependencies. Check cross-module imports, dictionaries, types, deploy policy and workflows. Retained customizations can conflict again next time.

## Scan and merge

New-tooling product:

```bash
pnpm project:upgrade scan --source /path/to/aster
```

Old product without scripts/dependencies:

```bash
node /path/to/aster/scripts/project-upgrade.mjs scan --target /path/to/product --out /tmp/aster-upgrade-plan.json
```

scan is read-only: no installs, service control or cloud requests. --out is scan-only, must be a new file in an existing temporary/.local parent. Source/target must be separate; another product is not an upstream template.

Select applicable update/add paths. Example paths, not a universal dependency set:

```bash
node /path/to/aster/scripts/project-upgrade.mjs apply --target /path/to/product --plan /tmp/aster-upgrade-plan.json --path src/modules/mail/providers.server.ts --path docs/MAIL.md
```

The tool recomputes classifications/paths/source fingerprint/product state and rejects stale or forged plan permissions. Validate ancestors against symlinks/escape. An exclusive lock protects backed-up writes in .local/aster-upgrades/<run-id>/, with journal and temporary-file rename. Copying does not install dependencies, execute plan commands or migrate DBs.

After interruption, inspect journal/live files rather than blindly retrying or deleting backups. Remove an orphan lock only after confirming no operation is running. Select all paths for one batch; applying changes state, so rescan before another apply.

For conflict/review/legacy-review, privately back up files and merge manually. Preserve business, personal rules, branding and secrets. Merge shared dependencies as needed. Generate new migrations without overwriting applied SQL or deployed config. Missing baselines after interrupted initialization are not permission to invent a snapshot.

## Regression and adoption records

Reset affected business/provider cases while retaining valid unrelated evidence. Run actual product lint/types/unit/build, E2E for workflows, isolated production tests for runtime/auth and desktop/mobile/locales/themes for UI. Continue authorized real provider acceptance; missing prerequisites stay pending, never mocked into passed.

Save redacted product evidence, then record only actually adopted paths:

```bash
node /path/to/aster/scripts/project-upgrade.mjs record --target /path/to/product --plan /tmp/aster-upgrade-plan.json --path src/modules/mail/providers.server.ts --path docs/MAIL.md --evidence docs/acceptance/mail-upgrade.md
```

record uses the pre-merge plan and permits expected product edits, but rejects source/baseline concurrency changes. It updates this batch's baseline/evidence only, not business/task status or starter-version.json. Rescan after each record. Existing paths do not prove real test success.

Record adopted modules/source/fingerprint/deferred work in PROJECT.md without claiming a full upgrade. Review overall provenance only after all relevant work/regression. Initialization, copy and adoption records are separate from business/provider acceptance.

## Rollback

```bash
node /path/to/aster/scripts/project-upgrade.mjs rollback --target /path/to/product --run <run-id>
```

Restore only files still matching applied hashes. Preserve later edits as conflicts; remove new files only if unchanged. Missing/mismatched backups or symlinks stop restoration. Review actual results; do not assume a whole-batch transaction was reversed.

Use pre-merge private backups for manual changes, not a repository reset that discards unrelated edits. Rollback does not automatically undo adoption records; recheck evidence/baseline. Tools do not manipulate cloud resources/data/secrets/Git history, and source rollback does not restore a DB.
