# Administration and account access

[中文](../ADMIN.md)

Use `/app/admin` (Chinese `/zh/app/admin`). This requires existing auth/database, no new paid service or R2, and never grants the first signup an admin role. The server-authoritative role is `admin_user`; admins must be verified and enabled.

## Local setup and Agent use

Run `pnpm setup`, register, verify and sign in within this product, then explicitly grant a local role:

```bash
pnpm admin:grant operator@example.test
# Grant another valid administrator before revoking the original role.
pnpm admin:revoke operator@example.test
```

Commands use the current root's DB name, operate only on local D1 and reject remote:true. The target must exist, be verified and enabled. Revocation cannot remove the last active admin. Refresh the workspace to see the entry. Cloud roles follow the product's explicit operational procedure; these commands do not grant remote roles. Public role applications, web role editing and impersonation are not provided.

```text
$aster-new Add account administration to this product. Preserve its brand, pages, data, authentication and billing obligations. Reuse existing admin roles for user search, suspension/restoration and operation records. Validate locally; do not deploy yet.
```

Inspect existing code/migrations and merge incrementally under [Upgrading](UPGRADING.md). Perform authorized configuration and acceptance rather than ending with a checklist. Updating a Skill alone does not install this backend. Reset affected acceptance.

## Implemented operations

- Search display name/email, filter access state and paginate by 20. Details expose only safe profile/login-method summaries, project/image/active-session counts and whether billing associations exist. Never show private content, passwords, tokens or raw billing payloads.
- Suspension requires confirmation and a fixed category: security, abuse, support or maintenance. Commit state, revision, session revocation and minimal audit in one D1 batch, rolling back on failure. Stale revisions and duplicate actions conflict; refresh before retrying.
- Suspension revokes existing sessions, rejects new email/Google sessions and closes private APIs. Triggers also guard session, account-credential and user mutations, including concurrent login/old reset-link paths. Already issued responses/browser copies cannot be recalled.
- Restoration preserves data/credentials and requires fresh sign-in; revoked sessions stay revoked. Do not recreate accounts, delete business data, cancel subscriptions/payments or withdraw shared content/covers.
- Never change your own access state or suspend the last active admin. Last-admin deletion is blocked before private image cleanup and rechecked in the final deletion transaction. The role CLI uses the same count: verified, enabled, role-bearing members.

Suspended users cannot use the workspace, export, delete accounts or open billing portals. Operators must still handle existing billing/support duties. Signed payment callbacks continue reconciliation. Do not erase billing records to bypass restrictions; review risk and restore access before allowing self-service.

## Audit and privacy

Record suspension/restoration and role grant/revoke using event ID, nullable actor/subject IDs, fixed action/reason, source and time. No email snapshots, free-text reasons, passwords, sessions, verification links, SQL parameters or provider payloads. UI resolves current names/emails; deletion nulls associations while minimal events remain. Personal export explains retention without exposing other people's records.

Web actions identify the real admin. CLI/privileged SQL role changes are attributed by triggers to database/maintenance, not an invented human. DB owners retain maintenance powers; this is not tamper-proof compliance logging. No automatic retention purge is implemented; define further retention/compliance rules separately.

Auth SDK logging preserves severity with fixed categories/request IDs and drops raw SDK messages/arguments. Use product monitoring for diagnosis without returning credentials to logs.

## Database upgrade and acceptance

Additive migration `0007_puzzling_the_hood.sql` adds account_access, admin_audit and auth/role triggers. Review/apply it before compatible code. Use local `pnpm db:migrate`, or explicit-environment backup/check/apply under [Database](DATABASE.md). Never edit applied SQL; later table rebuilds must retain custom triggers. Drizzle snapshots do not prove trigger completeness.

Test anonymous/ordinary denial, search/filter/pagination, non-sensitive details, invalidation of every old session, blocked new email/Google sessions and old reset links, fresh login on restoration, retained data, self/last-admin protection, concurrency conflicts, rollback when audit fails, account-deletion guards and signed payment callbacks. Recheck each product's real admin/business flows. Local/isolated Worker tests do not prove remote deployment or live OAuth/mail/payment acceptance.
