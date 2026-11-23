# Account security settings

[中文](../ACCOUNT-SECURITY.md)

Products with auth enabled use `/app/settings` (Chinese: `/zh/app/settings`). This extends Better Auth, existing session/account tables, D1 and shared UI; no new provider, binding or migration is required. With auth disabled, the page and private APIs are closed together.

## User flow

- If emailPassword is selected and the account has a credential password, show current/new/confirm fields. The new password must be 12–128 characters and different from the current password. The server revokes old sessions and rotates this browser's cookie so the current device can continue. Changing a known password does not require mail; forgotten-password recovery still needs the selected mail provider.
- Google-only accounts, or products without password authentication, show their original login method. Do not offer password/change/reset fields or silently add a password credential.
- Show active sessions, the current session and login/session update times. Confirm before revoking another session or all other sessions. The current device uses the existing sign-out action.

Device labels infer fixed browser/platform categories from UA, not an exact physical device or location. Updated times reflect periodic Better Auth session refresh, not per-request activity or online status. Show up to 50 recent valid sessions, current first, and disclose truncation; bulk revocation still covers every other session.

## APIs and boundaries

| Endpoint                                   | Behavior                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET /api/account/security`                | Return canChangePassword, hasMore and an allowlisted session summary                        |
| `POST /api/account/password`               | Accept only currentPassword/newPassword; clients cannot select a user or disable revocation |
| `DELETE /api/account/sessions/:id`         | Delete another session owned by the current user; unknown/foreign IDs share a 404           |
| `POST /api/account/sessions/revoke-others` | Preserve the current session and remove the account's other sessions                        |

Use authoritative, verified-email session checks, exact Origin, bounded request bodies and atomic user rate limits. Password changes allow five attempts/user/minute; normal private writes retain the 30/minute limit. Revocation SQL also checks that the current session remains valid. Never accept client-supplied ownership.

Return only id/current/browser/platform/createdAt/updatedAt/expiresAt. Do not return session tokens, user IDs, raw UA/IP, password hashes or OAuth credentials. A session ID is not an authentication token; revocation still checks ownership. Responses are no-store. Password changes forward only Better Auth's HttpOnly Set-Cookie and discard its raw token/user JSON. Passwords must not enter query-cache variables, local storage or logs.

Native browser endpoints `/api/auth/list-sessions`, `revoke-session`, `revoke-sessions`, `revoke-other-sessions`, `change-password` and `set-password` are closed to prevent token disclosure and revocation bypasses. Do not attach raw Better Auth session responses to client UI. Server changes reuse its internal API rather than reimplementing hashing/signatures.

Failures do not show success. A network/storage error can occur between revocation, password update and delivery of the new cookie. If uncertain, sign in again or use configured mail recovery; do not promise the old session survives. The D1 adapter provides neither a cross-request global transaction nor a concurrent-login lock.

## Agent integration and acceptance

For existing products, scan using [Upgrading](UPGRADING.md), then merge the security module, private dispatcher, native endpoint closures, limits, settings, dictionaries and tests as needed. Preserve business, brand and existing auth configuration. This belongs to auth, not another mandatory external service.

Test wrong old passwords, mismatched confirmation, rejection of the old password after change, old/other cookies becoming invalid while the new current cookie works, individual/bulk revocation, current-session protection, cross-account denial, CSRF/body limits/rate limits, no-password and auth-disabled cases, mobile/locales/themes, loading and error recovery. UI fixtures/mock OAuth are not real Google acceptance. Reset affected auth evidence and revalidate in the authorized target environment.

Run `pnpm check`, `pnpm format:check`, `pnpm test:e2e`; runtime/auth changes also require `pnpm test:production` and relevant profiles. Source tests do not prove free-cloud CPU suitability or live mail/Google readiness. See [Account lifecycle](ACCOUNT-LIFECYCLE.md) for export/deletion. Linking a new login method and changing email are not implemented.

References: [Better Auth passwords](https://better-auth.com/docs/authentication/email-password), [sessions](https://better-auth.com/docs/concepts/session-management). Implementation was checked against locked Better Auth 1.7.12; recheck cookie rotation/native endpoints on upgrades.
