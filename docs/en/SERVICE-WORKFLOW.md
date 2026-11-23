# Resume external configuration and real acceptance

[中文](../SERVICE-WORKFLOW.md)

When users request mail/Google integration, the Agent performs authorized setup and real acceptance. starter.project.json.integrations records targets/stages/input-evidence fingerprints/human blockers. project:service manages **local progress only**, not login/DNS/deploy/mail. Use actual connected tools; writing records is not completion.

## Resume an existing task

```bash
pnpm project:status
pnpm project:service status
pnpm project:service status --id mail-staging
```

Read current product rules/brief/records, confirm current authorization/live state and continue actionable steps. next is the first incomplete stage and may need a human; actionable also lists independent steps. Account/domain/credential/activation changes outside tracked files are not detected by hashes. Recheck read-only before repeating signup, key rotation, sending or deployment.

Mail dependencies: account → domain; account → credentials → deployment; domain+deployment → delivery → auth. Google: account → credentials → deployment → auth. Domain review does not block independent credential work. A no-deploy instruction produces a scope blocker while other allowed work continues.

## Establish a target

Infer temporary JSON from context; do not make users fill a wizard. This is a format example, not evidence of access/authorization:

```json
{
  "id": "mail-staging",
  "provider": "brevo",
  "environment": "staging",
  "account": "existing-mail-account",
  "worker": "product-staging",
  "origin": "https://staging.product.example",
  "domain": "mail.product.example",
  "credentialRevision": "initial-key",
  "required": true,
  "inputs": {
    "account": [],
    "domain": [],
    "credentials": ["wrangler.jsonc"],
    "deployment": ["wrangler.jsonc", "src/modules/mail/mail.server.ts"],
    "delivery": ["src/modules/mail/mail.server.ts", "src/modules/mail/providers.server.ts"],
    "auth": ["src/modules/auth/auth.server.ts", "src/components/auth-form.tsx"]
  }
}
```

```bash
pnpm project:service plan --input /tmp/mail-service-plan.json
```

- provider: cloudflare/brevo/resend/google; preserve preference/working services under [Mail](MAIL.md). This does not change runtime MAIL_MODE.
- account is a non-sensitive alias; worker is public, origin is exact HTTPS without path/query. Google omits domain and domain/delivery inputs.
- credentialRevision is a manually maintained non-secret label, updated on credential creation/rotation/replacement. Never read/hash/copy/log remote secret values to produce fingerprints.
- account/domain may have empty inputs and rely on target/real reports. Other stages track relevant implementation/config. Add templates/dictionaries/shared auth dependencies as appropriate; examples are not automatic dependency analysis.
- Inputs permit src/scripts/migrations files plus wrangler.jsonc/package.json/pnpm-lock.yaml. Whole-file hashes may conservatively require review. Do not track .env/.dev.vars/secrets/generated files.
- required defaults true as a task requirement, not external-operation permission. Setting false retains history but cannot bypass chosen auth/release gates.

Replanning the same ID preserves valid stages and resets changed stages/dependents. Changing provider resets all its stages, not other integrations. Legacy plans default integrations=[] without reinitialization. Old products first adopt tools/workflow dependencies under [Upgrading](UPGRADING.md); a Skill change alone is not code installation.

## Record execution

Save actual redacted per-stage evidence in current-product private .local/service-evidence/, not public source. Include target/time/actions/observations/limits, never personal recipients, cookies, codes, verification/reset links or API keys. Separate reports avoid invalidating all stages when one shared file changes.

```json
{ "status": "done", "verification": "real", "evidence": [".local/service-evidence/account.md"] }
```

```bash
pnpm project:service record --id mail-staging --step account --input /tmp/service-result.json
```

done requires real and existing current-product evidence, not local/mock substitutes. The tool validates paths/hashes, not truth. account checks eligibility/activation/plan; domain checks actual DNS; credentials checks the selected target config, not just names. Real delivery/login later proves usability. deployment records an authorized real publish; delivery requires actual receipt, not API acceptance. auth uses [Mail acceptance](MAIL.md#acceptance-before-opening-registration) or real Google callbacks/sessions.

Other statuses: pending/failed/blocked. Reworking a stage clears dependent completion; pending explicitly invalidates/requires revalidation. Changed/missing inputs/targets/evidence show stale; recheck from the first invalid dependency and preserve unrelated valid stages. Untracked code/DNS/account/secret/deployment drift requires active resets; hashes cannot detect it.

For a real blocker:

```json
{
  "status": "blocked",
  "verification": "unverified",
  "evidence": [],
  "blocker": {
    "kind": "activation",
    "detail": "Transactional email is pending platform activation; receipt cannot be tested",
    "userAction": "Complete the activation request in the signed-in provider console",
    "resume": "Verify activation, then continue domain/delivery without creating another account"
  }
}
```

Kinds: login/verification/activation/permission/purchase/scope. Ask for only the actual minimal action, not an entire checklist. Purchases/support contact/deployment follow explicit authorization. blocked requires detail/userAction/resume; other statuses cannot retain stale blockers. Once supplied, reverify, record success to clear blockers and resume.

## Business acceptance and release

Stage completion does not create/pass auth-email-live or auth-google-live. After real business regressions, update these separate business/provider/real cases and product evidence. Follow [Auth timing](DEPLOYMENT.md#authentication-selection-and-release-timing). Target/stage changes/staleness reset related auth cases; status/check rejects stale stages with passed auth evidence. Staging prepares release. Production-only post-deployment regressions belong to the actual deployment task; do not claim undeployed production was accepted beforehand.

project:check --ready counts incomplete required integrations but proves neither cloud state nor publication. doctor only reports resumable progress. Invalid paths/inputs/concurrent writes are redacted. Exclusive local locks/change detection protect plan writes; inspect active operations before recovery, never steal locks. Preserve tasks, other integrations, secrets and business files.
