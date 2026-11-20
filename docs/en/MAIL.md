# Mail provider selection and integration

[中文](../MAIL.md)

Aster supports local, cloudflare, brevo and resend, with disabled when no remote service is selected. Verification/recovery share localized HTML/plain-text templates without changing Better Auth/D1/sessions.

## Select by account and environment

1. Preserve explicit choices and working providers; upgrading the starter is not a reason to replace them.
2. Without a choice, inspect the target account read-only. Prefer CF only if **Workers Paid already exists** and Email Sending/domain/shared allowance eligibility fits. Domain ownership, DNS Pro or a saved payment method is not proof of Workers Paid; an existing plan does not ensure zero incremental usage.
3. Otherwise choose Brevo/Resend by preference, existing account/key/domain, daily/monthly volume, activation, branding and actual target-inbox delivery. Neither is universal default.
4. Unknown account status stays unknown. Do not auto-upgrade/signup. Recommend from context and record reasons; ask only for missing decision-critical information.

Record provider/account eligibility/allowances/estimates in PROJECT.md and mail-provider in decisions with user/context/default provenance. Unresolved stays open, not connected. Each environment's MAIL_MODE explicitly selects one provider, without runtime plan detection or failure-based cross-provider switching.

See dated [Costs](COSTS.md) and recheck before setup. Snapshot: Brevo 300/day, non-rollover/branding; Resend 3,000/month and 100/day. Resend/reset/other account projects share limits. [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [Resend pricing](https://resend.com/pricing). Mail not requiring CF Paid does not prove full auth fits Workers Free CPU.

## Configure the selected environment

Development stays MAIL_MODE=local and writes only the matching-loopback inbox, requiring no real mail account. Remote root production / env.staging.vars example:

```jsonc
{
  "MAIL_MODE": "brevo",
  "MAIL_FROM": "Your Product <accounts@notify.your-domain.com>",
}
```

MAIL_FROM accepts name <email> or an email. Use a real verified sender, not placeholders. Keep staging/production separate; provider keys belong only in the target Worker secrets, never vars/Git/screenshots/logs/chat.

| Mode       | Required                                                                                               | Not required by this mail adapter    |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| cloudflare | Suitable Workers Paid/sending eligibility, verified domain, environment send_email binding named EMAIL | Brevo/Resend keys                    |
| brevo      | Activated transactional account, verified sender domain, BREVO_API_KEY                                 | CF send_email binding / Workers Paid |
| resend     | Verified sender domain, sending-permission RESEND_API_KEY                                              | CF send_email binding / Workers Paid |

Interactively enter the chosen secret; omit --env staging for default production:

```bash
pnpm exec wrangler secret put BREVO_API_KEY --env staging
# Or, only if Resend is selected:
pnpm exec wrangler secret put RESEND_API_KEY --env staging
```

Brevo uses an **API key, not SMTP key**, via POST https://api.brevo.com/v3/smtp/email. Resend uses POST https://api.resend.com/emails. No SDK/SMTP setup is required. Only the selected key is used; 10-second bounded HTTPS, no redirects, no provider-body logging/reading, no automatic retry/failover to avoid duplicate mail after ambiguous timeouts. [Brevo API](https://developers.brevo.com/reference/send-transac-email), [Resend API](https://resend.com/docs/api-reference/emails/send-email).

External providers do not need CF send_email. Remove unused EMAIL bindings only after confirming no other business uses them. deploy:check inspects sender/bindings/evidence; actual deploy also checks remote secret names, not values/usability, and never creates secrets for you.

## Domain and activation

An existing domain plus DNS access is sufficient to start; a paid business mailbox is not required. Prefer a dedicated sender subdomain, e.g. website app.your-domain.com and accounts@notify.your-domain.com, verifying notify.your-domain.com. Sender configuration does not create an inbox; configure receiving/forwarding separately for replies.

Add Brevo's actual code/DKIM/DMARC records and verify. Review/merge existing DMARC instead of overwriting other mail policies or duplicating records. Do not alter site routing/receiving MX. DKIM CNAME on CF uses DNS-only as directed; propagation can take time. [Domain guide](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).

Transactional activation and domain verification are separate. If Brevo shows inactive, follow support activation instructions; that is not a paid upgrade and new accounts are not assumed active. [Activation](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP). Resend also requires an owned verified domain: [Guide](https://resend.com/docs/dashboard/domains/introduction).

## Existing Aster products

Invoke the Skill in the actual product, read AGENTS/PROJECT/plan/auth and inspect differences without reinitializing/overwriting pages/business. Resolve the installed Skill's real source; an old copied Skill/docs may be stale.

Review mail.server.ts/providers.server.ts, env.d.ts, deployment-policy/deploy/project-doctor and mailReady dependencies in app.server.ts/app.services.tsx/dictionaries. Merge complete dependencies into the actual architecture, not whole-file replacements.

Preserve Google/session secret/D1/brand/routes. Changed key/provider/sender/site domain resets affected auth-email-live evidence, not unrelated valid cases. Mock starter evidence is not product acceptance. Record actual adopted provenance without claiming a full upgrade.

## Agent execution and human handoff

Configuration/acceptance is Agent work under existing user scope, not a default manual checklist. Read task/brief/records/connections and infer known target/account/domain/environment without repetitive questions. Skill invocation is not blanket cloud permission.

| User scope                       | Agent outcome                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan/local code only             | Reviewable plan/local implementation/mock checks; remote work remains explicitly unperformed                                                                          |
| Configure and really accept mail | Execute authorized account/domain/key/receipt steps; hand off only concrete login/verification/review/permission blockers                                             |
| No deployment yet                | No new application version, including staging; existing authorized test environments may still be used. Identify exact deployment permission if new code is essential |
| Connect and launch               | Complete staging setup/live acceptance, deployment gates, publication and production regression within authorization                                                  |

For real integration:

1. Inspect actual connectors/CLI/API/browser, environment/domain permissions, choose/record the provider. Try available supported access before claiming missing tools; never invent connected account permissions.
2. Configure authorized sender service/subdomain/DNS while preserving other site/mail records; verify effective DNS and activation. Do not require manual copying when tools already have access. Human login/codes/platform review are actual handoff points. Contacting support sends a message: do so only with explicit contact authorization; otherwise prepare the request for the user.
3. Reuse secure credentials or create minimally scoped credentials in an authorized account and store in the exact Worker secret. Never ask for API keys in chat or download remote secret values. Names alone do not supply or validate values.
4. Send bounded test mail only to user-designated/explicitly authorized owned inboxes. If inbox access exists, verify receipt and complete link actions directly. Do not test against business users/random addresses. Without inbox access, ask only for receipt confirmation/browser verification. Never put codes/cookies/mail links/tokens into chat/reports/public screenshots.
5. Complete registration/verification/recovery/session regressions with redacted current-target evidence. DNS, activation, API acceptance, actual receipt, links and business state are separate. Regress existing Google/owner isolation.

Use [Service workflow](SERVICE-WORKFLOW.md) before execution and after stages, retaining valid progress/resetting affected changes. It records work; it does not perform provider operations. Human handoff states only current actual blockers, what was checked/completed, minimal user action and resume point. Do not offload unattempted steps or call the checklist complete. Resume the original task after prerequisites, without reinitializing or repeating still-valid work.

## Acceptance before opening registration

On staging, receive real mail and test English/Chinese signup → verification → login → logout, resend/cooldown, recovery, old-session revocation, failures and required target inbox providers including domestic ones where relevant. API success proves acceptance by the provider, not inbox delivery.

Record current-product auth-email-live as business/provider/real/passed, then [Release gates](DEPLOYMENT.md#authentication-selection-and-release-timing). Mocks prove request/template/failure boundaries only, not activation/quota/delivery. Initializers do not signup/change DNS/send/deploy; the Agent continues these within an authorized integration task instead of stopping at script boundaries.
