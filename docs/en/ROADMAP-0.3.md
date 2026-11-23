# 0.3 development line

This checkout is next/0.3 / 0.3.0-dev.0, based on the committed non-payment 0.2.0-beta.1 candidate and not released. Stable Skill installation remains on the stable source; never repoint it silently to this directory.

## Existing payment implementation

Stripe/Creem TEST subscriptions include checkout, portal, raw signature verification, deduplication, provider-state reconciliation and revision-guarded entitlement sync. Preserve old billing/portals/webhooks and account-deletion review/minimal archives/late callbacks when changing channels. These are development foundations, not real merchant sandbox/KYC/payout/live-payment or complete order/refund evidence. Keep billing=false and TEST boundaries without live keys, host changes or service activation.

## Next scope

Determine concrete product/provider eligibility and 0.3 scope first. Within explicit authorization validate real sandbox checkout/callback/cancellation/failure/portal/ownership, then separately design live mode with provider isolation/signatures/idempotency/revocation/compatibility. Do not merely swap keys or trust success redirects. Add one-off purchases/orders/refunds only for actual scope. Non-payment upgrades must never require payment setup; sync public 0.2 fixes as small reviewed changes with separate regression.

## Parallel development

Separate worktrees/node_modules/.dev.vars/.wrangler data. 0.3 may use localhost:3102 while stable uses 127.0.0.1:3100 to isolate cookies. Tests must target this checkout's actual loopback APP_ORIGIN, not another server. Production acceptance shares3110: serialize and do not terminate occupied services.

After actual acceptance, review merging into main, verify that commit's CI and release explicitly. Add release/0.2 only if ongoing stable maintenance needs it. Directory separation does not eliminate merge conflicts; review files/migrations/brand/billing independently.
