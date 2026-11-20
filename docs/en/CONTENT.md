# Editorial content and public site assets

[中文](../CONTENT.md)

The optional `content` module provides article/help/announcement drafts, admin previews, publishing and withdrawal. Admin: `/app/content`; public index `/content`, detail `/content/:slug`, Chinese under `/zh`. Entries publish in their own language; translation is not automatic. Public reading is anonymous; every edit/asset API checks current admin permission server-side.

## Selection and setup

content depends on auth/database and defaults off in new products. Text needs no R2. Covers require files and the existing ASSETS_BUCKET, still private with no r2.dev/public bucket domain. Personal images and site assets have separate tables, namespaces and APIs; never list/convert them interchangeably.

```text
$aster-new Add articles and help content to this project. Preserve its pages and authentication. Use Catalog, validate locally, and enable site assets only if covers are needed. Do not deploy yet.
```

Inspect current code/rules and use `project:modules` preview/apply with recorded reasons. Select files only for images. Do not reinitialize existing products. A public showcase that needs editing must also select database and a real login method; visitors still read anonymously. New plans can select content=required directly. Source previews enable the module; starting profiles default it off.

After setup, register/verify a local test account, then explicitly grant an admin role:

```bash
pnpm admin:grant editor@example.test
# Keep another verified, enabled administrator before revoking this role.
pnpm admin:revoke editor@example.test
```

Commands read the current root DB, reject remote:true, change only local roles and create neither accounts nor cloud permissions. The user must already exist, be verified and enabled. Refresh the workspace. Never revoke the last active admin; see [Admin](ADMIN.md). Real-product grants follow its operations process, without public admin applications or first-user promotion.

## Editing and publication

1. Create a draft with title, lowercase English slug, type, content language, category, excerpt and body.
2. Body is plain text, paragraphs separated by blank lines, up to 12,000 characters. HTML displays as text; rich text, executable Markdown, scripts and embeds are not supported.
3. Upload PNG/JPEG/WebP through site assets and select a cover. Saving does not publish or alter a live snapshot.
4. Admins preview drafts. Publishing uses the **saved** draft, excluding unsaved changes, and makes title/body/selected cover public.
5. Further edits change only the draft until republished. Changing a slug makes the old URL 404, without automatic redirects.
6. Withdrawal keeps the draft but closes public detail. Covers without other live references cease public serving. For permanent deletion, withdraw, delete the draft, then clean assets according to remaining references.

Every mutation/publish/withdraw/delete uses the current revision; stale concurrent edits conflict and require refresh/review. Limit: 500 entries/site, admin/public pages of 12. Public search matches title/excerpt, type and category using published snapshots only. The same language+slug cannot be published twice. Live snapshot and cover reference update in one D1 statement.

SEO title/description fall back to title/excerpt. Details are SSR with product origin and current locale. Only PUBLIC_INDEXABLE adds public index/published URLs to sitemap; no drafts, and staging stays noindex. Create separate language entries rather than reusing another language's body.

## Public asset boundary

Site assets belong to the site and all admins can manage them, but upload alone does not expose them. Only ready assets referenced by a currently published entry are anonymously served at `/api/content/assets/:id`. Admin preview has a separate authenticated endpoint. Private avatars/project covers/file_asset IDs cannot be public covers.

Sharing an R2 binding does not share permissions. The server generates keys; reject user-supplied URLs/keys and do not expose internal paths. Reads stream with no-store/nosniff, and every public request checks current live references. Withdrawal controls future requests, not copies, screenshots or in-flight transfers. Do not upload confidential assets or override these cache headers in an external CDN.

Limits: 100 assets/site, total 250 MiB, 5 MiB each. Pending/deleting records reserve quota atomically. Declared MIME must match signatures. Full decoding/transcoding, malware scanning and metadata sanitization are not promised; editors review actual files before publication. App quotas are not cloud spending caps.

Ambiguous uploads stay pending. Size/type/identity checks may recover a confirmed object to ready; missing/unknown objects are not silently forgotten and require operator investigation. Another admin can inspect known objects if the uploader loses permission. Remove every draft/live reference before deletion; failed cleanup stays deleting and retriable. Removing one cover does not automatically delete reusable assets.

## Account deletion and retention

content_entry/content_asset are shared site records; contributor/editor/uploader links are nullable attribution. Personal JSON export excludes site bodies/assets; siteData explains ownership/retention. If associations exist, account deletion requires explicit confirmation to retain site data. After original-method identity and billing checks, delete the account and null attribution without deleting public content/assets. Private images retain their separate cleanup process.

Disabling content closes public/admin routes but does not delete records/assets or retention duties. Retiring a required module needs review of public links, references, other admins and users. Profile switching does not clean them up. Disabling files does not delete historical site assets. Map new editorial/media behavior into references, export and lifecycle rules.

## Migration, upgrade and acceptance

Review/backup/apply additive `0006_lying_black_cat.sql` in the explicit target environment under [Database](DATABASE.md) before compatible code. Do not edit old migrations or upload local test DBs. Existing products merge complete policy/auth/API/UI/dictionaries/scripts/migration paths under [Upgrading](UPGRADING.md), not just pages.

Test admin/ordinary/anonymous access, draft privacy, preview, publication/replacement, persistence after refresh, withdrawal, public-cover recovery/deletion, stale revisions, slug/locale, SEO, literal HTML display, mobile/themes and shared retention after contributor deletion. Production requires this product's `content-live` business/provider/real/passed target evidence, plus selected files' live acceptance for images. Deployment record checks do not test behavior.

Local D1/R2 tests prove neither cloud resources/plans nor real login/mail. Continue configuration/acceptance within actual authorization, without extra purchases or treating a checklist as completion.

References: [D1 prepared statements and batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
