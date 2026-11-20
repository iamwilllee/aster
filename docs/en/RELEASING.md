# Release maintenance

[中文](../RELEASING.md)

v0.2.0-beta.1 primarily supports non-payment products; see [Release notes](releases/0.2.0-beta.1.md). This process also applies to future releases. Record local preparation, commits and public release separately; GitHub Release is the authority for publication.

## Candidate validation

1. Align package.json, starter-version.json, source site version, README/security policy and changelog. Keep upstreamRelease=null for a candidate. When explicitly authorized to release, align the prerelease channel/target URL in the release commit, then verify actual server URL, prerelease flag and tag commit after publication. A prepared link is not a published release.
2. Validate default non-payment behavior and showcase/web-app initialization/recovery, closed billing UI/direct APIs, experimental unit regressions and legacy billing compatibility.
3. Run `pnpm check`, `pnpm format:check`, `pnpm test:e2e`, `pnpm test:production`, and production profiles web-app, showcase and google-only. Auth failures must be exercised through actual HTTP paths without leaking SQL parameters/hashes/tokens, preserving structured logs. Billing experiment changes also require profile creem.
4. In fresh generated products, run frozen install, recovery, build and actual workflows. Source acceptance is not generated-product acceptance. Provider evidence must belong to the current product.
5. Review licenses/third-party notices, ignores, public docs and candidate files. Exclude private QA, conversations, logs, secrets, DBs and caches. Keep reviewable notes and local validation evidence.

## Commit and public release

Commit/push/publish only when explicitly requested. Include all adopted source/migrations, then verify that exact commit's remote CI, not an older passing revision. The tag and release must resolve to that same passing commit. Do not rewrite published tags/history.

The initial public preview can use GitHub's prerelease flag. Notes state supported profiles, experimental boundaries, breaking changes and adoption/migrations. Keep incomplete checks incomplete; never prefill successful tags, SHAs or cloud claims.

Users may subscribe to repository releases for notifications. The Skill currently upgrades from an independent local Aster source, not automatic network retrieval. Existing products follow [Upgrading](UPGRADING.md), without blanket overwrite or silent runtime updates.
