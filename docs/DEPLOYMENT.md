发布前先读 [能力选择](MODULES.md)。下文的认证、DB、邮件与支付要求仅适用于选中模块；showcase 不要求认证密钥、D1 或注册验收。Google-only 不要求事务邮件；所选方法仍须真实验收。旧产品未采用能力配置时保留原检查行为，不能只改计划绕过运行时能力。

# Cloudflare 部署手册

Aster v0.2.0-beta.1 发布候选优先支持不带支付的展示站与普通 Web 应用，提供本地开发与隔离生产构建测试。未选择 billing 时无需支付配置或支付供应商验收；本文的计费步骤仅适用于明确选择的实验模块。部署前检查操作者的 Cloudflare 账户、D1 与发信权限，并完成下文的远端验收。不要把密钥发送到聊天或写入仓库。

## 0. 默认从免费云资源开始

先读 [成本与递进策略](COSTS.md)。优先评估 Workers Free + D1，用 workers.dev 或已有域名开始；分别列出 Web/数据、邮件、文件、AI 的需要与费用，不能直接把 CF 发信需要的 Paid 套餐当成整个项目上云的前置条件。

先只读确认账户套餐与其他产品共享用量；无法访问时标未知。核对免费档的 CPU、D1 单库大小/扫描行数等限制；当前认证的密码哈希与 SSR 必须在真实云端验证，不能承诺完整业务已符合免费档。后续若确有运行瓶颈，再给优化/替代方案与升级费用依据。

默认新增云服务费用目标为 USD 0/月，写入 `PROJECT.md` 和机器计划的 `cloud-cost-policy` 决策。这个记录不控制账单，也不替代用户对外部操作的授权。已有 Paid 账户可以按用户原意复用，但仍需检查增量按量费用；不擅自升级、降级或开通新计费。

用户只要求方案时，下面的资源创建、远端迁移、域名变更和部署命令都先不执行。先完成配置差异、迁移/恢复步骤、分项费用与待验收清单，供用户审阅。

## 认证选择与发布时序

| 阶段       | Agent 应完成什么                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 需求       | 默认称呼、邮箱、密码；Google 为可选。记录选择依据，未选 Google 就不配置、不展示其入口                            |
| 本地实现   | 复用认证与本地收件箱；检查成功/失败、会话、权限、手机和语言。不能据此声明云端发信或 OAuth 已通过                 |
| staging    | 配置选定的发信服务、发信域名；选择 Google 时再设置 OAuth 客户端、同意页、测试用户、允许来源和精确回调            |
| 供应商验收 | 实收验证/重置邮件并完成注册、验证、登录、退出、重置撤销旧会话；选中 Google 时另验真实登录、取消/错误、回调和会话 |
| production | 核对正式域名/回调/独立密钥。所选能力配置与真实验收就绪后发布，再检查正式环境；未选的能力不阻塞发布               |

当前“称呼”是资料展示名，账户通过邮箱登录；纯用户名登录尚未实现。Google 按开关和凭据同时就绪才展示按钮；缺少配置时访客不看到“Google 未配置”的占位按钮，开发诊断留在 doctor/服务状态。邮件未配置时，公开页面不展示注册/找回入口或不可用的表单，直接访问给出用户可理解的暂未开放提示，已有已验证账户仍可登录。

正式发布前在当前项目 `starter.project.json.acceptance` 添加并完成以下记录，证据保存在本项目内：

- `auth-email-live`：`kind=business`、`scope=provider`、`verification=real`、`status=passed`，记录真实邮件与注册/重置/会话结果。
- `auth-google-live`：只有选中 Google 时需要，同样为真实 provider 验收；OAuth 授权 URL 检查、假凭据和 mock 测试不能替代。

可先将这两项标为 `required=false`、`status=pending`，使本地首版交付与云端验收分开；production 部署检查仍要求所选能力的用例通过。`steps`/`expected` 中写清测试环境、域名、路径与结果，不记录真实邮箱、令牌或密钥。需求、提供商、域名、回调或相关认证实现变化后重置受影响用例，不能沿用旧证据。

发布脚本只能验证记录、路径和配置存在，不能理解截图或自动替你验证第三方账号。Agent 必须真实执行验收再更新记录；页面隐藏未配置按钮不等于所选能力验收完成。

## 1. 先隔离预发布

`wrangler.jsonc` 根配置用于 production，`env.staging` 用于预发布；两者使用不同 Worker、域名与密钥，选中数据库时使用不同 D1。命名环境的 vars/bindings 需要独立声明。staging 默认不声明 R2 和发信 binding，需要时再添加。日常本地 D1 不需要额外云库，在线验收需要时再创建独立 staging；展示站无需 D1。

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create starter-staging-db --env staging
```

将返回的数据库 ID 填到 `env.staging.d1_databases`，不要替换正式环境 ID。设置 staging 的 Worker 名和精确 `APP_ORIGIN`，可以使用自己的 workers.dev HTTPS 域名；不带路径或末尾斜杠。

保留 `ENVIRONMENT=staging`、`PUBLIC_INDEXABLE=false`、`BILLING_ENABLED=false`。未接邮件时保持 `MAIL_MODE=disabled`，注册/验证重发/重置接口会返回服务未配置，页面也会显示提示。`MAIL_MODE=local` 只允许开发，不能部署。

底座默认不声明 R2 或 `send_email` 绑定。使用 CF 发信时按官方说明添加 EMAIL binding；文件业务另行开发后再配置 R2，先核验对应计费与资源。已有产品若保留了未使用的绑定，先检查用途再移除。改动 binding 后运行 `pnpm cf:typegen`。邮件模块检查可选 EMAIL binding，不凭模式标记宣称已发信。

兼容日期固定 `2026-10-19`，升级 Wrangler/Vite 插件和运行时后统一调整并回归。本版不自动绑定 DNS 或自定义域名。

## 2. 密钥与迁移

通过 Wrangler 交互输入密钥；值不出现在命令历史、JSON 或 Git。预发布使用独立、至少 32 字符的随机认证密钥。

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm project:database plan --env staging
pnpm project:database check --env staging
pnpm project:database apply --env staging --id <release-id>
```

按 [数据库发布流程](DATABASE.md) 审查 SQL 和旧 Worker 兼容性；apply 自动获取恢复 bookmark、私有导出备份，迁移后复查历史、完整性和外键，中断可续做。check 有待迁移时退出码 2；不是执行失败或已完成迁移。恢复方案只读生成，覆盖恢复按具体授权执行。禁止上传开发库、测试用户或 `.wrangler`。这里的命令是说明，不表示已经执行远端操作。

启用 Google：在 Google 控制台注册 Web OAuth 客户端，回调精确为 `https://你的预发布域名/api/auth/callback/google`，分别保存密钥，再设置 staging 的 `GOOGLE_AUTH_ENABLED=true`。

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env staging
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env staging
```

只有开关与两个密钥齐备才显示可用按钮；`GOOGLE_AUTH_ENABLED=false` 是默认值。普通 Google OAuth 接入可从免费项目与客户端开始，不要求为此开通 Workers Paid；若另用付费的身份托管或其他 Google API，费用单独评估。[Google 官方入门](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button) · [客户端配置](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)。已测试构造授权请求与本地错误反馈，真实 Google 登录、同意页和回调尚待验收。不同环境分别注册允许来源/回调；测试模式下还需配置允许的测试用户。

先独立选择事务邮件供应商。优先用户明确选择与已接通服务；无既有选择时，已核实目标账户有 Workers Paid、CF 发信资格及适用额度则默认优先 CF，否则根据个人偏好和现有环境比较 Brevo / Resend 免费档，不自动升级 CF。Aster 已提供三者适配。[邮件指南](MAIL.md) 包含域名、账号激活、所选 API key、已有项目增量接入；[成本清单](COSTS.md) 列出当前限制。账户未知不能假定 Paid。邮件未接通时可以验证独立的公开页面和数据，但邮箱注册/验证/密码重置仍未完成，不能降低认证要求绕过。

选择 CF 发信后，确认 [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) 账户资格、发信域名和对应 EMAIL binding；免费 Email Routing 转发不能视为任意外发邮件能力。配置 `MAIL_MODE=cloudflare` 与已验证的 `MAIL_FROM`，完成中英文验证/重置邮件真实收信、链接和失败检查。模板同时提供纯文本和 HTML。供应商接受发送不等于收件成功。

支付渠道配置详见 [PAYMENTS.md](PAYMENTS.md)，Creem 使用 CREEM_API_KEY / CREEM_WEBHOOK_SECRET / CREEM_PRODUCT_ID，固定 sandbox API。BILLING_PROVIDER 每环境明确选择 stripe 或 creem；有存量义务时保留旧密钥并设置 BILLING_LEGACY_PROVIDERS。两种渠道均 TEST ONLY。Stripe 依次保存 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_ID`（都使用同样的 `--env staging`）。启用测试 Portal，Webhook 指向 `/api/billing/webhook/stripe`（原 `/api/billing/webhook` 继续可用），Creem 指向 `/api/billing/webhook/creem`，再打开 `BILLING_ENABLED=true`。禁用新结账不会停止已配置的门户与事件同步。live key 不受支持。

## 3. 检查与部署

```bash
pnpm check
pnpm test:e2e
pnpm test:production
pnpm run deploy:check --env staging
pnpm run deploy --env staging
```

请使用 `pnpm run deploy`，避免与 pnpm 自带的 deploy 命令混淆。`deploy:check` 只做本地检查，不连接账户。它拒绝占位 D1、不匹配的环境名、共用 D1、本地邮件、无效 origin、明文秘密和允许索引的 staging；production 还拒绝未配邮件、未完成的认证 provider 用例，以及 Google 的模块选择/开关不一致。CF 发信需要匹配的 EMAIL binding 和非占位发信地址。

实际 `deploy` 先执行同样检查，再通过 Wrangler 只读读取目标 Worker 的 secret **名称**，要求存在 BETTER_AUTH_SECRET，以及启用 Google 时的 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET；邮件选择 Brevo 时另需 BREVO_API_KEY，Resend 时另需 RESEND_API_KEY，只检查所选服务。外部邮件不要求 CF binding；已有绑定先检查其他业务用途，再移除确认无用的项。邮件 API key 不得写在 vars。缺项或无法核验则在构建/部署前退出，不输出原始提供商响应或 secret 值。不自动创建资源、补密钥或迁移。名称存在仍不能证明值正确、域名/回调正确或邮件可投递，必须结合上述真实验收。

选中 D1 时，实际 deploy 还在构建前和发布前只读核对远端迁移历史、完整性与外键。有待迁移、历史分歧或数据库不可用会阻止发布；先在授权内完成 `project:database` 流程，部署脚本不隐式写库。未选 database 时不连接 D1。此检查不替代产品业务和真实供应商验收。

脚本构建后删除 `dist/server/.dev.vars` 再部署。源 `.dev.vars` 和 `.wrangler` 始终私有。只公开 `dist/client` 静态资源；不要把 `dist/server` 配成公开目录。认证、私有 API、server functions 和 `/app` 不能配置公共缓存。

正式环境独立创建 D1 与密钥，更新根配置，省略命令中的 `--env staging` 即选择 production。确认内容准备好后再显式开启 `PUBLIC_INDEXABLE=true`；仅首页和套餐页的中英文地址进入 sitemap，私有页面保持 noindex。

云端管理员需在正确的远端 D1 显式授予，用户必须先正常注册/验证：

```sql
INSERT INTO admin_user (user_id) VALUES ('目标用户ID') ON CONFLICT(user_id) DO NOTHING;
-- 撤销：DELETE FROM admin_user WHERE user_id = '目标用户ID';
```

首个用户不会自动成为管理员。保留操作记录，不在浏览器可编辑资料中存角色。

## 4. 云端验收

在真实 HTTPS 域名完成：英文/中文直接访问和刷新；邮箱注册、收信、重发冷却、验证、登录与重置撤销旧会话；Google 登录/失败回调；项目创建刷新持久化；跨账户隔离；普通用户管理员 403；两种语言的开发收件箱与开发邮件 API 均不可用。

所选支付渠道的测试账户需要真实托管测试结账、取消/门户改套餐、失败/重试和 Webhook 数据核对。返回 success 页面不能直接授予权益。另检查日志、CPU 时间、D1 扫描行数、备份/恢复与资源用量；套餐选择依据实际负载测量。

目前仍未完成这些远端验收。真实收费、退款、争议、税务、真实供应商账务注销验收、数据保留与隐私策略由后续具体产品补齐。账号注销和个人数据导出见 [账号生命周期](ACCOUNT-LIFECYCLE.md)，新业务需补全其数据归属及清理范围。

## 可选私有图片

files 选中时按 [图片指南](FILES.md) 在授权内配置 ASSETS_BUCKET；预发布与生产使用不同私有 bucket。先审查并应用 additive migration 0005，再发布兼容代码。deploy 不创建 bucket，拒绝占位/共用目标，正式发布还要求当前产品 files-live 的真实目标环境证据。本地 R2 模拟不证明云端可用或账单安全。关闭入口不删除历史资源，也不绕过账号注销的对象清理。

产品主题通过 appearance.json 构建，生产忽略本地预览参数 _style；主题选择不新增外部服务，见 [主题指南](THEMES.md)。
