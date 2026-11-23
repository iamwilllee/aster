# From requirements to a resumable product

PROJECT.md holds human requirements/handoff. starter.project.json holds validated goal, choices, tasks and acceptance. Runtime values stay in site.ts, wrangler.jsonc and private secrets, not duplicated into plans. Write human descriptions in the user's language.

## Choose modules

| Key     | Current foundation                   | Questions                                                          |
| ------- | ------------------------------------ | ------------------------------------------------------------------ |
| auth    | Email authentication                 | Private/multi-user data; preserve existing protection              |
| mail    | Local/CF/Brevo/Resend adapters       | Preference/environment; domain, eligibility and real delivery      |
| google  | OAuth wiring                         | Requires auth; credentials and actual callback acceptance          |
| billing | Stripe/Creem TEST only               | Requires auth; actual model/provider eligibility; no live payments |
| ai      | Not implemented                      | Provider, budget, failure and quota behavior                       |
| files   | Opt-in private images/avatars/covers | Public/private, types, limits, permissions and recovery            |
| usage   | Ledger not implemented               | Reserve/settle/release, retries and concurrency                    |

Selections are required/deferred/undecided with user/context/default basis and reasons. required means needed, not implemented; deferred does not uninstall dependencies or erase existing modules. New user instructions override old inferences. Infer names, copy and visual defaults from context, but never infer public data scope, real quotas, pricing or external-operation permission. Ask only for decisions blocking dependent work.

## Example plan input

This private-snippet example shows structure, not a default product. The initializer fills missing fields but may leave modules undecided; that is not complete requirements discovery.

```json
{
  "schemaVersion": 1,
  "goal": "Private code snippets; no charges in the first version",
  "audience": "Independent developers",
  "coreFlow": [
    "Register and verify email",
    "Create snippets",
    "Search and edit",
    "Retain changes after refresh"
  ],
  "outOfScope": ["Teams", "AI generation", "Cloud deployment"],
  "modules": {
    "auth": {
      "selection": "required",
      "basis": "user",
      "reason": "Each user owns private snippets"
    },
    "mail": {
      "selection": "required",
      "basis": "context",
      "reason": "Verify email through the local inbox first"
    },
    "google": {
      "selection": "deferred",
      "basis": "context",
      "reason": "Email login meets the initial need"
    },
    "billing": { "selection": "deferred", "basis": "user", "reason": "No initial charges" },
    "ai": { "selection": "deferred", "basis": "user", "reason": "No AI in the first version" },
    "files": { "selection": "deferred", "basis": "context", "reason": "Text only" },
    "usage": { "selection": "deferred", "basis": "context", "reason": "No metered model calls" }
  },
  "decisions": [],
  "tasks": [
    {
      "id": "snippets",
      "title": "Implement private snippet CRUD",
      "status": "todo",
      "evidence": []
    }
  ],
  "acceptance": [
    {
      "id": "persistence",
      "title": "Snippet persistence",
      "kind": "business",
      "scope": "local",
      "steps": ["Sign in as A", "Create and edit a snippet", "Refresh and search"],
      "expected": "Updated content survives refresh",
      "required": true,
      "status": "pending",
      "verification": "unverified",
      "evidence": []
    }
  ],
  "handoff": { "next": ["Implement snippet schema/API"], "blockers": [] }
}
```

Add cross-account, empty/error, mobile and language cases. Provider cases use scope=provider, verification=real and passed only after actual acceptance; mocks stay local/mock. Baseline checks use kind=baseline and cannot replace business cases.

For authorized external configuration and acceptance, execute available steps. Record only actual blockers with completed work, missing permission/human prerequisite and resume point. No inbox access or pending platform activation means provider acceptance remains blocked/pending. Later authorization overrides default local-only brief language; explicit plan-only/no-deploy restrictions remain binding. See [Agent execution and human handoff](../../../docs/en/MAIL.md#agent-execution-and-human-handoff).

A pending decision example: `{"id":"billing-mode","question":"One-time or subscription?","status":"open","value":"","basis":"context","reason":"Charges requested but model unknown","blocking":true}`. Resolved values retain truthful provenance; defaults are not explicit user choices.

## Progress and acceptance

- Tasks: todo → doing → implemented, or blocked. implemented requires actual source-relative evidence.
- Cases: pending → passed/failed/blocked. Passed evidence must exist within the current product and match verification type. Do not reference historical starter QA, secrets or external paths.
- Update machine records/PROJECT.md after milestones, with next steps and unresolved issues. Code/requirement changes reset affected cases and obsolete claims.
- project:check validates structure, dependencies and evidence. --ready additionally requires completed bootstrap, no blocking decisions, implemented tasks, at least one required business case and all required cases passed. Exit 2 means invalid/not ready.
- Scripts cannot judge screenshot/business correctness; the Agent must operate/review. Records do not prove deployment or provider eligibility.

## Resume after interruption

Inspect first. Initialize empty/metadata directories in place. For Aster products, read records, run project:doctor/status, and project:resume if bootstrap is incomplete. Do not rerun full aster:new. Other apps keep architecture/content and use incremental adoption.

Recovery runs only fixed install/setup/initial-format operations, never arbitrary JSON commands. Changed dependency fingerprints trigger installation; local setup stays idempotent. doctor/resume have dependency-free entrypoints. Missing config/secrets blocks the relevant step without key resets or cloud operations. After recovery, continue business tasks and remove only verified-resolved blockers.

Mail/Google progress uses optional integrations, defaulting empty for old plans. See [Service workflow](../../../docs/en/SERVICE-WORKFLOW.md) for targets, fingerprints, stages and plan/record/status. Initialization clears inherited external completion. Required incomplete integrations affect readiness; changed inputs reset affected auth acceptance. Stage completion still needs separate actual business evidence.

Runtime choices live in src/config/features.json; provenance stays in modules. database/projects/emailPassword are backward-compatible optional choices. A module tag scopes tasks/cases; unselected capabilities do not require their gates. See [Modules](../../../docs/en/MODULES.md).

Record visual-theme=sage|catalog as resolved with provenance; initializer writes appearance.json. Themes do not enable services. See [Themes](../../../docs/en/THEMES.md), [Files](../../../docs/en/FILES.md) and [Brand workflow](../../../docs/en/BRAND-WORKFLOW.md). New products retain pending brand-identity task/acceptance until their own assets are designed or reviewed and rendered.

## Development task usage

Follow [Task usage](../../../docs/en/AGENT-USAGE.md) for local Codex task boundaries, pending final-turn settlement and metadata-only receipts. Keep product AI quota/billing selections independent. Resume an existing objective across turns; do not assign a completed turn twice, invent missing usage or treat the Agent-reported outcome as acceptance evidence.
