# Data export and account deletion

[中文](../ACCOUNT-LIFECYCLE.md)

This is part of auth, at the end of /app/settings (Chinese /zh/app/settings), without a new paid service/dependency. Every adopting auth product, including non-payment products, needs additive migrations 0003_nervous_mauler.sql and 0004_married_boom_boom.sql. With auth off, pages/private endpoints close together.

## User flow

Export downloads account-data.json containing profile, owned projects and non-sensitive subscription/checkout state. Never put exports in query cache, server files, public storage or logs. The file contains personal information and belongs in the user's custody.

For deletion, optionally export first, open confirmation, enter the current password if present and type uppercase DELETE for every account. Cancel changes nothing. Success revokes all devices, clears auth cookie/query cache and fully navigates to login. Re-registering the same email creates a new ID/empty workspace.

Google-only users sign out/in through original Google login and confirm within five minutes of database session.created_at; refresh/renewal does not reset the window. This verifies recent app login, not a promise Google re-prompts for password/MFA. Unknown login methods disable self-service deletion until appropriate reauthentication exists; never add mail/password to Google-only.

## Billing-account deletion

Accounts without billing history revalidate identity normally. Otherwise review current payment state first; final submission rechecks, so a previous ready response is not an authorization token.

| Result                                                                                                               | Action                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Active/trial/other nonterminal subscription                                                                          | Manage in portal; cancellation-at-period-end still blocks until actual termination |
| Open checkout                                                                                                        | Complete it, or explicitly confirm closing verified product-owned open links       |
| Unresolved draft/open/uncollectible invoices                                                                         | Resolve through billing/support and review again                                   |
| Subscriptions canceled/incomplete_expired, checkouts ended, invoices paid/void                                       | Permit identity/deletion confirmation                                              |
| Provider unavailable, mismatched identity, incomplete/truncated lists, unknown pending reservations, bounds exceeded | Keep blocked; retry or contact support                                             |

Stripe review retrieves locally known checkout/subscriptions and lists associated customer subscriptions/checkouts/invoices to cover missing callbacks. It never closes unknown open links. Local canceled state, hidden billing or BILLING_ENABLED=false cannot bypass active provider duties. Existing portals/webhooks remain.

Combine Creem and Stripe, not just the currently selected new-checkout provider. Creem rereads known checkout/subscriptions and bounded store subscriptions/associated-customer transactions. Active subscriptions/open checkout/unresolved transactions/truncation/mismatched identity block. Without a verified expiry API, no automatic close button is provided; resolve externally or wait for actual expiration.

Closing unfinished checkout requires its own confirmation and only expires verified current-user open Stripe sessions owned by this product. It does not cancel subscriptions/refund/void invoices/modify customers. Payment completing during expiry requires fresh review. Partial expiration followed by error returns unknown, not a rollback claim.

Bounds: up to 100 local subscriptions and checkouts each, five customers, three pages of 100 per list type; 25-second scheduling budget between calls, five-second per-request timeout and no automatic retries. The last call may run to its timeout. Limits/truncation never count as passed; larger products need separate/asynchronous review. Shared customers may conservatively block on other products' unresolved duties; define actual customer isolation.

Before creating checkout, atomically reserve pending only while the user exists and no deletion-review lease is active. Timeouts/ambiguous failures retain opaque pending even without a returned session ID. Elapsed time cannot prove no external transaction exists. Use an authorized dedicated reconciliation procedure, never delete a reservation to unlock deletion.

## Archives, concurrency and retention

billing_account_state holds review leases/deleted state. billing_subscription_archive and billing_checkout_archive retain minimal associations after deletion. Migration 0004 adds provider to active/archive records, defaults legacy rows stripe and uses creem: namespaces. Migrations are additive; no applied SQL edits, real-account backfill or local DB uploads.

Review/deletion use a conditional D1 lease up to 90 seconds/account. New checkout is temporarily rejected; webhooks return retriable failures, and already-started checkout reservations block omission. Leases cannot be overwritten; expired ones may be reacquired, and old requests cannot release newer leases. The final batch checks database clock, current session, credential version/recent Google login and current lease, then archives deletion/billing, cleans private data, deletes the user and releases the lock atomically. SQL failure rolls archive/deletion back. This coordinates current D1/code paths, not a distributed Stripe transaction.

Archives exclude names/email/avatar/password/session/OAuth tokens. They retain opaque owner_ref and customer/subscription/price/checkout IDs plus essential states/revisions/times for ownership/idempotency/reconciliation. This is **pseudonymized, not irreversibly anonymous**; provider customer/invoice records are not automatically deleted. Real products define retention purpose/duration/access/cleanup; Aster is no legal-compliance conclusion.

Normal billing rows cascade with user deletion; archives deliberately have no user FK. Late signed callbacks still reread provider state, validate archived customer/original-owner association and revision-guard/deduplicate archive updates. They never recreate users/credentials/entitlements. Mismatched known archived customers remain rejected. Nonterminal state after deletion emits closed_account_billing_attention; integrate actual alert/manual handling rather than ignoring external obligations.

Same-email signups get different IDs and inherit no old rights/archive. Global billing_event remains. Stripe/Creem stay TEST ONLY under [Payments](PAYMENTS.md); live collection, automatic cancellation/refunds, provider-customer deletion and full retention management require separate work.

## APIs and data ownership

| API                               | Behavior                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------- |
| GET /api/account/lifecycle        | Verification/recent-login/billing-blocker summary, no secrets or billing IDs |
| POST /api/account/export          | Current-owner JSON attachment; no target userId                              |
| POST /api/account/billing-review  | Fresh provider review/state sync; no automatic link expiry                   |
| POST /api/account/close-checkouts | Strict confirmation=CLOSE for verified unfinished links                      |
| POST /api/account/delete          | Strict confirmation and optional currentPassword, no userId/skip flags       |

Export allowlist: profile name/email/image/createdAt; project id/name/description/status/createdAt/updatedAt; subscription provider/status/currentPeriodEnd/cancelAtPeriodEnd; checkout provider/status/createdAt. Never export hashes, auth accounts, OAuth access/refresh/id tokens, sessions/verification records, raw IP/UA, admin lists, Stripe customer/subscription/price IDs or SQL dumps.

Use one D1 batch snapshot and recheck the session. Up to 1,000 records per collection and 2,000,000 JSON bytes; excess explicitly fails, never silently truncates a complete-looking copy. Large exports need bounded private asynchronous/streaming downloads, not public R2 bypasses. Historical owned data/billing guards remain when projects/billing are disabled.

After eligibility checks, archive billing before deleting user in the same transaction; FKs cascade session/account/project/admin_user, and the batch removes exact-user-ID reset-password verification records and that email's local dev_mail. Other users/global billing_event remain. Verification JWT now signs sub=user.id and the hook checks account identity, preventing old links verifying a new same-email account. **Pre-upgrade unverified links without sub must be resent**, never accepted by weakening validation.

Writes retain exact Origin, body limits, authoritative session and atomic limits: export/review/close each three/user/minute; deletion five, all also counted against ordinary 30/minute private writes. Final SQL rechecks session/password version or recent Google login/lease, not previous page state. Native /api/auth/delete-user, delete-user/callback and verify-password HTTP endpoints remain closed. Password checks use Better Auth internally.

## Agent adoption

Read actual product brief/schema/ownership/billing and [Upgrading](UPGRADING.md). Merge lifecycle/verification/private dispatcher/native closures/limits/settings/login notices/dictionaries/tests; billing products also need reservations/review/archive callbacks/migrations. Skill/dialog-only updates are insufficient. Apply additive SQL before code. Older Workers can run with extra tables but cannot reconcile deleted-account archives; rollback after adoption needs compatible archive handling or coordinated pauses/replay, not a DB restore that discards post-deletion obligations.

The base knows sample project ownership only. Map new articles/files/teams/business data into personal/shared/transfer/retain rules and export/delete/FKs/transactions. Do not claim all business data deletion with unmapped team/external files. Never delete other members, public content or DB backups. Products define backup retention/re-deletion after restoration separately.

Reset affected cases. Test owner isolation, secret-free real downloads, nontruncated limit failures, wrong-password/cancel no-ops, repeated deletion, all old sessions invalid, empty same-email signup, old verification/reset links unable to revive accounts, fresh provider review, invoice blockers, expiry races, atomic archives, late/duplicate callbacks, concurrent checkout blocking, Google-only old/recent sessions, auth-off and mobile/themes/locales/errors. Google fixtures/local D1 are not real OAuth reauthentication.

Run pnpm check, format:check, test:e2e and relevant test:production profiles. Each real product still needs selected mail/Google acceptance. Source evidence is not cloud evidence. Implementation reviewed locked Better Auth 1.7.12: [Accounts](https://better-auth.com/docs/concepts/users-accounts), [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [Stripe subscriptions](https://docs.stripe.com/api/subscriptions/list), [Checkout retrieve](https://docs.stripe.com/api/checkout/sessions/retrieve), [Expire](https://docs.stripe.com/api/checkout/sessions/expire). Recheck internal API/JWT/cookies/deletion on dependency upgrades.

## Private images

Export owned metadata without bytes/internal keys; save originals first. Under the existing lease, clean objects before final D1 deletion. Pending uploads block. R2 failure keeps account/unfinished records for retry but some objects may already be removed; R2/D1 are separate transactions. Check historical files even when disabled and extend reference/cleanup maps for new uses. See [Files](FILES.md).

## Shared site content

content_entry/content_asset belong to the site; export includes only siteData ownership explanation, not bodies/assets. Associated accounts require retainSiteContent=true confirmation, checked under the lease; editor writes use that lease protection too. After identity/billing review, nullable created_by/updated_by/uploaded_by retain content/live snapshots/assets. Never clean them as private images. Former contributors still need informed retention; other admins manage the site. Define new shared business rules separately.

## Administrators and minimal audit

The last verified/enabled admin must appoint another active admin before deletion. Check before private-image cleanup and again in final transaction; concurrent role changes may still block after some cleanup, so resume from actual state without claiming full rollback. Suspended users need operational support for access/billing before export/deletion.

Minimal role/access audit survives with nullable actor/subject and no email/free-text snapshots. Personal export explains retention without cross-account audit. Shared retention, billing archives and late callbacks remain in force. See [Admin](ADMIN.md).
