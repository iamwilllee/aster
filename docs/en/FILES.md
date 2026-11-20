# Private image library

[中文](../FILES.md)

The files module supports the signed-in user's avatar/project covers and can extend other private business flows. files=true requires auth/database; new products default it off, while the source preview enables it locally. Entry: `/app/files`. Every content request checks the owner. There are no public bucket URLs, anonymous images or cross-user sharing.

## Local use

Install with `pnpm install --frozen-lockfile`, run `pnpm setup`, then `pnpm dev`. Register and verify through the local inbox:

1. Upload PNG, JPEG or WebP in the image library.
2. Refresh to verify persistence, then select an avatar or project cover.
3. Replace/remove references before deleting an image; referenced assets cannot be deleted.

Wrangler simulates persistent D1/R2 in `.wrangler/state/`, requiring no cloud account or upload. Setup preserves data. Never deploy local test DB/object directories.

Limits: 20 images/user, total 50 MiB, 5 MiB each, including pending/deleting reservations. Quota is reserved in the same D1 statement, preventing concurrent bypass. These are app limits, not Cloudflare spending caps. Validate declared MIME and signatures, reject SVG/other types/invalid names. This version does not provide full decoding, transcoding, compression, thumbnails, scanning, resumable transfers or a general attachment library.

## Data and failure recovery

file_asset stores owner, immutable object key, name/type/bytes and pending/ready/deleting state. Internal keys stay out of clients/JSON export. Keys are server-generated, not filenames or user paths. `/api/files/:id/content` streams owner-authenticated content with private/no-store and nosniff.

Upload atomically reserves pending, writes the object, then marks ready. Ambiguous writes stay pending; tell users not to repeat the upload. Checking upload metadata can confirm completion. Missing/unproven objects remain pending investigation: one not-found response does not prove an in-flight write can never arrive. There is no automatic reservation discard or background sweeper.

Deletion verifies no avatar/project references, marks deleting, removes the object, then metadata. Failures retain metadata/quota for retry. Setting a reference requires owner+ready server-side; a foreign key does not prove ownership. New reference fields must extend counts, write guards, export and deletion cleanup, not merely store a URL.

## Export and account deletion

JSON export includes owned image metadata, not bytes. Save needed originals before deletion. Under the account lease and identity/billing checks, clean private objects before deleting the user, including historical objects when files is disabled. Unconfirmed uploads block deletion.

R2/D1 are not one transaction. Some objects may already be gone after cleanup failure while the account/remaining records survive for retry; never promise full rollback. Restrictive user FKs and final checks prevent leftover asset records. Do not bypass the original deletion API with direct user removal. See [Account lifecycle](ACCOUNT-LIFECYCLE.md).

## Cloud integration and acceptance

Preview then apply a justified files selection via `project:modules --input ...`. Newly selecting files prepares only an ASSETS_BUCKET placeholder. Existing products review complete code and additive `0005_vengeful_captain_stacy.sql` under [Upgrading](UPGRADING.md); do not edit applied SQL. Disabling closes `/app/files` and `/api/files`, without deleting buckets/data/cleanup duties. Required files cannot be casually retired by a profile switch.

Within authorized cloud scope, the Agent checks current R2 activation, costs and account permissions, configures independent private staging/production buckets, applies reviewed migrations and publishes compatible code. Never enable public bucket domains or remote:true local bindings to bypass isolation. Payment-method/activation/usage requirements depend on the target account; do not promise card-free R2. See [Costs](COSTS.md). Local work can proceed first.

Production requires current-product `files-live` (business/provider/real/passed), covering actual target upload, read after refresh, cross-account denial, reference protection, deletion and account cleanup. Code/Miniflare tests are not cloud acceptance. deploy checks names/environment isolation/records, but creates no resources and proves no behavior. Only selected capabilities enter the gate.

## Separate site assets

Public content covers use content_asset and the content/ namespace; see [Content](CONTENT.md). Reusing ASSETS_BUCKET does not reuse public permission. Personal file_asset remains owner-only and cannot be a public cover ID. Site assets survive contributor deletion; personal images require cleanup.
