# Changelog

## Unreleased

- 2026-11-27: Split CI into parallel jobs: static checks and unit tests, local e2e, and the production Worker once per capability profile in a matrix (a failing profile no longer hides the others). The shared setup is a local composite action, the Chromium download is cached by Playwright version, and a newer push cancels the older run on non-default branches. Documentation now states the supported Node range (22.12 or newer, 24 recommended and verified by CI) consistently with `engines`.

- 2026-11-26: Add a skip-to-content link and one `Main` landmark per page (the content list had none), and Open Graph and Twitter card tags on public pages with article-specific overrides on content details. `brand.json` gains an optional `socialImage` (PNG, JPEG or WebP; the brand check rejects SVG and ICO); without it, shared links show a text-only card.

- 2026-11-25: Identify server errors by message keys instead of Chinese text. `HttpError` takes a key and parameters (162 call sites migrated, zod messages included); responses translate from the key, a guard test rejects literals that are not keys and Chinese strings in server code, and text from outside libraries never reaches the user. This also fixes an unmapped admin-permission message and five webhook messages that fell back to a generic error in English. Every response now carries `X-Request-Id` (Cloudflare's cf-ray or a UUID), 5xx API errors and the storage and mail failures that were turned into 503 or generic errors log a line with the request id and error class only, never messages.

- 2026-11-24: Add security response headers to every page, API, redirect and server-function response through a request middleware (`src/start.ts`): `frame-ancestors 'none'`, `base-uri`, `object-src`, `form-action`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and, over HTTPS, HSTS. Server-function endpoints now reject cross-site requests. A script-src CSP remains separate work. Upgrade better-auth to 1.7.26, wrangler, the Cloudflare Vite plugin and miniflare (removing the high-severity `undici` advisories from dev tooling) and pin two dev-tool transitive dependencies; `pnpm audit` is clean. Drop the stale vite release-age exclusion.

- 2026-11-23: Move the entrance motion (`data-reveal`, `RevealGroup`) into Flatpack. Each theme carries its own pace as `--fp-reveal-*` tokens (Sage 560ms/70ms/14px, Catalog 480ms/50ms/10px, the default theme fades without moving); the keyframe is now `fp-reveal`. Aster keeps only its card hover lift in `src/styles.css`.

- 2026-11-22: Adopt Flatpack's Alert (error notices), Empty (empty states, with a heading title) and Sidebar (workspace navigation, with active links through `render`). Tabs triggers lay out icon and text in a row. Pagination and Breadcrumb are not adopted: Aster's pagination shows a summary with previous/next, which Flatpack's numbered pager does not replace.

- 2026-11-21: Adopt Flatpack component source. `src/components/flatpack/` is copied unmodified by `pnpm flatpack:sync` (with per-file hashes and `--check`); Aster's Button, Badge, Card, Table, Skeleton, Input, Textarea, Progress, Tabs, Checkbox, Switch, Dialog, Select and DropdownMenu now wrap it and add only hydration guards, localized close text and Aster's compound Select. Tooltip and Toast follow in the same pass: Flatpack gained a compound Tooltip and a request-local `ToastProvider`/`useToast()`, so nothing in `src/components/ui` is implemented locally any more except Label, Disclosure and Reveal.

- 2026-11-20: Make Flatpack the visual base. Sage and Catalog are now Flatpack themes (`data-fp-theme`) styled by the synced `src/styles/flatpack.css`; Aster's UI wrappers render Flatpack `data-slot` markup and keep their APIs. Control sizes change from 32/36/44px to 32/40/48px, `buttonVariants` becomes `buttonProps` (spread on links), and `pnpm flatpack:sync` records the Flatpack source. Rounded utilities now follow the surface radius; links no longer get a default underline.

- 2026-10-29: Add private local Codex development-task Token reports, deferred final-reply settlement and bilingual guidance. Keep unavailable/partial coverage explicit and product AI/billing modules unchanged.

- 2026-10-27: Maintain the Skill/execution reference in English and add complete English counterparts for 24 public documentation topics. Add bilingual catalog/link/anchor/translation-drift checks and same-language static website documentation at /docs and /zh/docs, with safe Markdown rendering and equivalent-page locale navigation.

- 2026-10-27: Add and deploy the independent bilingual Aster website, with release-pinned documentation, quick-start/copy interactions, accessible theme/FAQ behavior and assets-only Cloudflare hosting. Keep product template configuration and services separate.

- 2026-10-27 (unreleased): Add context-driven product icon design, optional style references, centralized brand assets and explicit new-product branding checkpoints; preserve existing identities and require rendered acceptance separately from file checks.

## 0.2.0-beta.1 — 2026-10-26（公开预览）

- Scope the profile-save browser assertion to its settings region and reproduce concurrent security loading, keeping CI independent of unrelated live status messages.
- Reserve CI time for slow browser dependency installation and the full Worker-profile matrix; keep every release check enabled.

- Add finite, staggered homepage entrances and one-time viewport reveals with Sage/Catalog timing, mobile/reduced-motion adjustments and readable no-script/unsupported-observer fallbacks. Include replayable UI examples and Agent guidance; retain control geometry and natural text rendering after motion.

- Add public-page copy review to the Skill and product brief: remove development banners and placeholders from actual products while preserving truthful availability and isolated demo labels.
- Support the first non-payment public preview: disable billing in the source default, retain experimental TEST adapters and legacy billing safeguards, and align support/version documentation.
- Route unexpected SDK failures through the sanitized auth HTTP boundary while preserving expected API error statuses/cookies and error observability. Add actual request-path sentinel regression.
- Make production navigation and endpoint checks capability-aware, add the plain web-app profile to CI and retain optional Google/showcase coverage.

- 2026-10-26: Replace the unloaded default Inter declaration with an OS UI font stack; retain Catalog's deliberate Arial direction and existing control sizes. Improve public hero tracking/weight and reading copy sizes, preserve normal Chinese headline tracking, and document actual font loading/rendered acceptance in the Agent workflow.

- 2026-10-26: Add searchable, paginated administrator user operations with safe account details, suspend/restore confirmation and minimal audit history. Commit access revision, session revocation and audit atomically; retain business data and signed billing reconciliation.
- Fence disabled-account auth mutations and new sessions, preserve sanitized auth event severity, and protect self and the last active administrator across suspension, local role revoke and account deletion. Add isolated runtime, concurrency, rollback, browser and lifecycle regression coverage.

- Add optional article/help/announcement management with revision-guarded drafts and published snapshots, SSR public search/detail/SEO, explicit publish/withdraw and isolated site-image assets. Keep private files private; preserve shared editorial data with contributor-deletion confirmation and nullable actor references. New profiles default content off; real target content-live acceptance remains pending.
- Make local administrator role commands use the current project DB and reject remote bindings.

- Add Sage and Catalog visual themes, per-product initialization, local-only preview selection and a fictional product catalog blueprint; preserve shared controls, light/dark and locale behavior.
- Add optional private PNG/JPEG/WebP assets with local R2 simulation, owner-scoped streaming, atomic quotas, avatar/project-cover references, pending recovery and retriable deletion. Export metadata and clean storage before account deletion; real cloud R2 acceptance remains pending.

- Add optional product, directory/reading and data-workbench blueprints at a loopback-only development route. Include reusable content/disclosure patterns, bilingual in-memory journeys, explicit fictional-data boundaries and Agent page-planning guidance; no new service, dependency or business capability is enabled.
- Add explicit Stripe/Creem test-provider selection, fixed Creem sandbox checkout/portal/HMAC reconciliation, provider-scoped history and account-deletion review. Preserve legacy Stripe obligations across switching, require additive migration 0004 and provider-specific release evidence. No live billing or real-provider acceptance is claimed.
- Add payment eligibility guidance for individuals, sole proprietors and companies; separate project-specific identity, provider implementation, onboarding and payout acceptance. Keep unimplemented providers explicitly pending and separate applicant eligibility from approval/payout evidence.

- Extend account deletion to settled Stripe test histories: fresh bounded subscription/checkout/invoice review, explicit checkout expiration, per-account leases, atomic pseudonymous billing archives and late signed webhook reconciliation. Preserve unresolved/pending blockers and require the additive 0003 migration; no new dependency or real-provider acceptance claim.

- Add owner-scoped JSON export and confirmed account deletion with password verification or a recent Google-only app login. Atomically remove owned data and reset tokens, bind verification links to account IDs, revoke all sessions and close native deletion paths. Reserve pending checkout before provider calls and preserve ambiguous reservations for reconciliation. Bounded exports exclude authentication secrets; existing outstanding verification links require resend. Payment-history deletion uses the additive migration described above.

- Add account security settings: credential-aware password changes, fixed device summaries and owner-scoped session revocation. Force old-session revocation while rotating the current HttpOnly cookie, close raw native session/password management HTTP paths, redact metadata and add per-account password limits. Cover multi-session persistence, cross-account denial and UI failure states; no new dependencies or migration.

- Keep tabs disabled until hydration so the first click after a locale reload is not lost. Add a delayed-script regression and retain CI HTML reports, failure screenshots and traces.
- Support existing products with named production databases while preserving their root local database and explicit restore target; validate staging/production isolation against the actual remote environments.
- Make generated-product checks follow selected capabilities: exercise billing unit fixtures independently of product flags, validate closed direct entrypoints and adapt browser flows when billing or email authentication is omitted.

- Add explicit-environment D1 release plans, read-only history/integrity preflight, private export/bookmark backups, migration verification and resumable failure records. Block deploy on pending/divergent migrations; generate recovery plans without automatic destructive restore. Resolve local DB names from configuration, keep local persistence isolated, and document Agent execution and existing-product adoption.

- 2026-10-24: Add explicit product capability composition across initialization, runtime routes/APIs, local setup, acceptance and deployment. Public showcase needs no DB/auth/mail, Google-only needs no email, and unused modules stay out of navigation. Preserve existing data/resources and payment obligations; add reviewed local profile changes with private backups and isolated profile acceptance.

- Add resumable per-product mail/Google configuration checkpoints, dependency-aware progress, source/evidence fingerprints and precise human handoffs. Preserve independent valid steps, invalidate affected auth acceptance, and expose local status/doctor/check without executing provider operations or treating mock records as live acceptance.

- Add hash baselines for new products and dependency-free upgrade scan/apply/record/rollback tools. Preserve legacy/customized/protected files, reject stale plans and symlink escapes, back up local writes, and retain product edits made after an upgrade.
- Extend the Aster Skill with existing-product upgrade routing, cross-module review and regression/evidence handoff. Partial adoption preserves the original source version and does not claim provider acceptance.

- Clarify Agent ownership of authorized provider configuration and real acceptance. Add scoped mail handoff guidance and an execution example; preserve explicit deployment restrictions, request only concrete human prerequisites, and keep provider evidence pending until actually verified.

- Add dependency-free Brevo and Resend transactional email adapters using the existing localized auth templates, bounded HTTPS requests, sanitized failures and no automatic retries or provider fallback. Keep local inbox and CF binding delivery compatible.
- Make mail selection contextual: preserve explicit/working providers, prefer CF for an existing eligible Workers Paid account, otherwise compare Brevo/Resend using preferences and the current environment. Document account activation, sender-domain setup and incremental adoption in existing products.
- Extend deployment preflight, redacted doctor and service status for the selected provider; require its own secret, reject plaintext mail API keys, and retain real-provider acceptance gates. External mail does not require a CF send-email binding.

- Hide unconfigured optional Google sign-in from visitor forms; default new product plans to email/password with Google deferred. Keep unavailable mail flows out of public signup/reset forms and CTAs, while retaining existing-account sign-in.
- Add authentication release checks: public email/selected-Google provider records, sender bindings, selected-method consistency and required remote secret names before building/deploying. Staging supports data-only previews; local preflight makes no provider calls.
- Document auth selection/configuration/acceptance/publication timing and distinguish display names from username login. Real provider records and configuration presence are separate checks.

- Default cloud planning to free-first, separate email costs from Workers/D1, and document dated free-tier limits, runtime acceptance and upgrade criteria.
- Record a default cloud cost preference in new project decisions and PROJECT.md; expose it in project status/doctor without treating it as billing verification or purchase authorization. Preserve explicit user decisions and compatibility with older plans.
- Remove unused R2 and Email bindings from the source Worker configuration; optional services require explicit selection and configuration.

- Add Base UI tabs, action menus, checkboxes, switches, tooltips and request-scoped toast feedback, plus skeletons and semantic tables without new dependencies.
- Expand the local UI reference with interactive list/detail/settings patterns, state previews and distinct workspace/editorial compositions; demos reset on reload and remain unavailable in production.
- Add URL-backed card/table views and pagination, private project details, action menus and save/delete feedback; reuse grouped layouts for account settings.
- Add shared page patterns, document dataset/pagination boundaries, and extend control geometry linting to new primitives. Require product-specific visual direction and composition choices in the Aster Skill and project brief.
- Keep Input/Textarea inert until hydration, matching action controls and preventing first-load form entry from being lost during client initialization.

## 0.1.2 — 2026-10-22

- API 入口在来源/鉴权等早返回前有界消费请求体；保留 Webhook 原始字节与签名边界，补并发拒绝与请求大小回归。
- 为当前 Base UI 控件配置客户端/SSR 预打包，避免首次路由访问期间重建依赖；键盘测试等待实际焦点后再导航。
- 新增仅限匹配回环来源的 `/dev/ui` 组件样板：三档尺寸、禁用/错误/加载、嵌套弹窗及双语主题；生产路径返回 404。

- 补齐 Base UI Select 与统一 Textarea，替换示例项目中的原生下拉框；筛选、FormData 与状态保存沿用原流程。
- 单行控件统一 32/36/44px 尺寸与共享 tokens，字段容器/块级输入消除底边错位，按钮式链接复用组件样式；新增 ESLint UI 边界及覆盖检查，并同步 Agent/Skill 约定。

- 品牌统一为 Aster，新增六瓣星形 Logo、favicon 和品牌使用说明。
- Skill 主入口改为 `$aster-new`，CLI 主入口为 `pnpm aster:new`；保留 `starter:new` 命令及原状态/数据库标识以兼容现有产品。
- 公开仓库只保留使用文档、源码、测试与品牌资产；本地验收记录、开发截图和选型研究移出版本控制，初始化器也不再复制这些材料。

- Skill 默认使用当前项目目录；初始化兼容未创建目录、已建空目录以及仅有 Git/README/AGENTS/编辑器元数据的项目。保留 Git 和 README，追加个人规则及忽略项，提供只读 `--inspect`。
- 已有 Aster 读取原状态继续；其他已有应用和不完整副本只检查不覆盖，由 Agent 增量接入。目标参数可省略，缺失父目录可创建。

- 新增 `starter.project.json` 规范化计划：模块选择和来源、关键决策、任务、业务验收证据与交接；Skill 根据上下文整理，脚本不以关键词自动启用外部服务。
- 新增 `project:doctor`、`project:status`、`project:resume` 和 `project:check`。环境检查不显示凭据、不停止服务；缺依赖时仍可检查与恢复。恢复保留业务/密钥，按指纹安装并幂等应用本地迁移。
- 基础检查接入计划校验；业务 ready 要求实际业务用例和项目内证据，mock 不能通过真实提供商用例。补充失败恢复、配置保密与误报完成的测试。

- 新增 `aster-new` Skill、`pnpm aster:new` 本地初始化命令和 `pnpm skill:install`。自动生成需求交接、产品品牌和独立本地密钥，安装依赖并迁移本地 D1；云资源和提供商配置重置，保留许可与锁文件。
- 初始化拒绝覆盖旧目录、源目录内目标及通过软链接混入的资源。补充隔离/保密边界测试，并将使用入口调整为 Skill 或单命令。

## 0.1.1 — 2026-10-22

本地预览版本。真实供应商验收仍需各产品独立完成。

- 英文默认、`/zh` 中文路由；类型化消息字典、占位符检查、SSR 语言和可分享链接。
- 双语认证反馈、验证/重置邮件、Google OAuth 条件接入；验证邮件重发及 D1 原子冷却。
- 私有写操作按用户限流，默认每分钟 30 次；保持项目配额原子判断。
- canonical/hreflang、robots 与 sitemap；默认禁止索引，预发布强制保持禁索引。
- 独立 staging 配置、部署配置检查、隔离生产构建测试；不读取开发密钥或数据库。
- 修复页面水合前按钮可点击却不处理的问题，补充英文/中文与手机渲染验收。
- 补充 Agent 使用指南、新项目/继续开发任务模板与产品需求交接模板，README 提供直接入口。

## 0.1.0 — 2026-10-21

本地首版，未部署或发布。

- TanStack Start / Workers / D1 应用骨架，pnpm 固定依赖、Drizzle 迁移和本地初始化。
- 邮箱注册/验证、登录/退出、密码重置及会话撤销；本地测试收件箱。
- 私有项目 CRUD、筛选、持久化和服务端并发数量上限；个人资料保存。
- 管理员只读用户列表及显式本地授予/撤销脚本。
- Stripe 测试订阅与门户接口、签名事件处理、幂等及并发状态同步测试；未验收真实测试账户的托管结账。
- 响应式首页/工作台、中英主流程、深浅主题、未接入能力提示。
- MIT、第三方许可、开发/部署文档、CI 和自动化测试。

文件上传、AI、消费额度账本与自动升级工具不在此版本中。
