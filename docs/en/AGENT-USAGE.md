# Development task usage

[中文](../AGENT-USAGE.md) · [English](AGENT-USAGE.md)

Measure the Agent's development work by task: initialization, refactoring, authentication, upgrades, features, fixes, design or documentation. This local developer tool is separate from the product's unimplemented AI usage/quota ledger. It does not enable AI, billing, cloud resources or model API calls.

## Agent workflow

The Agent runs these steps; users can keep describing goals naturally. Honor an opt-out. Inspect the target first and preserve its rules. Use the current product's command when installed, or the equivalent `node <real-aster-source>/scripts/agent-usage.mjs ... --root <existing-target>` without copying the foundation into another app.

1. Run `pnpm project:usage list`. Reconcile a previous `closing` record with `report --id <id>`. Resume a still-open record for the same objective; do not create another task every chat turn. Close unrelated old work with its truthful outcome before beginning new work.
2. Run `begin --kind <kind>` for a new objective. The default source is the exact `CODEX_THREAD_ID` in local Codex sessions, not the most recent file. When unavailable, record unavailable or use an explicitly identified `--source <absolute-rollout.jsonl> [--thread <id>]`; never scan conversation bodies to guess. No source, access, or supported data means no fabricated count. Other Agent environments are not yet supported.
3. Begin before implementation. For a missing/empty target, initialize first so telemetry cannot break folder detection; then begin immediately. The inclusive current-turn boundary still covers initialization and requirements in that turn. An earlier turn without a marker cannot be retroactively presented as measured. A source directory uses its own records, never a customer's records.
4. Optionally mark `wait` before a human blocker and `resume` afterward; mark `rework` only for an actual revision cycle. These are Agent-reported timing/counts, not automatic model-retry detection. Waiting does not exclude tokens from the thread window.
5. Before the final handoff, run `close --outcome passed|failed|blocked|incomplete`. `passed` is an Agent-reported task outcome, not business/provider acceptance. A closing record remains pending until the final reply's usage and terminal event are in the rollout. Re-run `report --id <id>` after that turn, normally at the next request. Starting another task also reconciles pending records; an unfinished prior turn remains blocked against overlapping assignment.
6. Give a short report in the user's language with measured/partial/unavailable status and its local report path. Do not spend additional model calls solely to polish a usage report. Respect permissions; inability to collect telemetry must not block the actual product work.

## Commands and local files

```bash
pnpm project:usage begin --kind init
pnpm project:usage begin --kind refactor
pnpm project:usage begin --kind auth --phase implementation
pnpm project:usage mark --event wait
pnpm project:usage mark --event resume
pnpm project:usage mark --event rework
pnpm project:usage close --outcome passed
pnpm project:usage report --id <task-id>
pnpm project:usage list
```

These are alternative task examples, not a sequence of overlapping `begin` commands. Kinds: `init`, `refactor`, `auth`, `upgrade`, `feature`, `fix`, `design`, `docs`, `other`. Optional phase: `planning`, `implementation`, `configuration`, `acceptance`. A phase labels the entire task; it does not magically split a mixed turn. Separate authentication implementation, provider configuration and live acceptance only when the actual tasks/turn boundaries are separate. One project permits one open/closing task; a completed turn cannot be assigned twice in that project. There is no cross-project global deduplication or automatic aggregation across threads.

`--root` selects an existing target; no initialized plan, dependency installation or running application is required. Without `--id`, close/mark/report select the active task; closed reports require an ID. `--help` is read-only. `list` lists records; `report` refreshes the selected record and writes a receipt. For old products, adopt the two `scripts/agent-usage*.mjs` files and the package command after review, or run the existing source helper explicitly. Updating a Skill does not update installed product files.

Private records and readable JSON/Markdown reports live in `.local/agent-usage/`. They contain task category, IDs, timestamps, source identity/path in the private checkpoint, cumulative-counter boundaries, configured model/effort metadata, product/tooling version and Skill hash. They never retain messages, reasoning text, tool output, credentials or provider payloads. The public-facing report file omits the absolute source path. Nothing is uploaded. Keep this directory out of source control and published assets; the tool creates a self-ignoring local directory and rejects already tracked receipts. Default starter copy/upgrade paths exclude `.local/`. Deleting this directory removes local usage history, not the original Codex logs. A stale `lock` after a process crash needs inspection before removing it; the tool never guesses that another collector is dead.

## Measurement and limitations

- **Totals:** difference cumulative `input_tokens`, `output_tokens`, `total_tokens` within the selected turns. Duplicate snapshots do not add usage again. Cached input and reasoning output are subsets; input + output = total. Cache-write detail is retained separately when available and is never added to total. Missing optional details stay null.
- **Window:** includes the entire start and end turns, even planning before `begin` and the closing reply after `close`. Intervening turns are included. It is a declared one-thread task window, not isolated Skill overhead, marginal instruction tokens or proof that the Skill caused savings. Keep unrelated work in a separate task/thread. Other agents, external model tools, image generation and unobserved retries are excluded; there is no claim of complete account-wide cost.
- **Coverage:** `complete` means no detected gaps within that recorded thread window; `partial` means observed lower-bound totals with reasons such as interrupted turns, malformed records, reset counters or incomplete details. `unavailable` has null totals, never a fake zero. A missing initial baseline is not the whole conversation's cumulative total. For a lost/unrecoverable source, explicitly use `abandon --id <id>` to freeze the observed lower bound as incomplete; never claim a completed measurement. `open`/`closing` reports may change; `closed` reports freeze and later turns cannot inflate them.
- **Models and duration:** models/efforts come from configured turn metadata, not a guarantee of the actually served model after routing. Elapsed time includes tools and waits; unmarked elapsed is not measured CPU/model time. Rework is explicitly Agent-marked. Outcomes do not pass product acceptance cases.
- **Adapter:** this first version reads the locally observed Codex rollout format (`session_meta`, `task_started`, `turn_context`, `token_count`, `task_complete`/`turn_aborted`). Local JSONL is a version-sensitive adapter, not a guaranteed public API. Missing terminal events keep closure pending; incompatible data remains unavailable/partial. The official [App Server events](https://learn.chatgpt.com/docs/app-server#turn-events) expose `thread/tokenUsage/updated`; this tool does not attach to or control the running desktop App Server.
- **Money:** no dollar amount is inferred from subscription usage. An API price estimate would need actual model/provider/tier/cache rules and dated pricing; it would still be an estimate, not an invoice. This version does not price or compare providers.

Compare equivalent scopes, starter/Skill versions, model configuration and acceptance standards across multiple successful and failed runs. A smaller Token count with failed acceptance is not an improvement. Do not publish “a product costs N Tokens” from a single task or treat mock fixtures as a real benchmark. This version produces per-task reports and a local task index; it does not yet produce sample medians, a leaderboard, budget enforcement or remote analytics.
