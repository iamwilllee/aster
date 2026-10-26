# 开发手册

第一次把底座用于新产品，请先读 [Agent 使用指南](AGENT-GUIDE.md)，通过 `$aster-new` 或 `pnpm aster:new` 初始化新目录，自动生成 [产品需求与交接模板](templates/PROJECT-BRIEF.md)。本手册说明开发实现与运行约定。

## 本地工作流

使用 Node.js 24 和 pnpm 12.11.2。先执行 README 的三步启动。开发地址固定为 `http://127.0.0.1:3100`，请不要混用 localhost 或其他端口；认证可信来源与本地收件箱均要求匹配 `APP_ORIGIN`。如果修改地址，同时调整 `.dev.vars`、开发脚本、Playwright 配置和测试。

`.dev.vars` 由 setup 生成，不会覆盖已有文件。只把占位示例 `.dev.vars.example` 入库。Workers 类型由 `pnpm cf:typegen` 生成，路由树在 `pnpm build` 或开发时生成。本地 D1/R2 由 Cloudflare 运行时模拟，不需要 Docker。

注册后到 `/dev/inbox` 打开验证链接，再登录。重置密码的链接也在收件箱中。开发邮件链接 24 小时后会在后续写入时清理，邮箱验证令牌本身由 Better Auth 校验有效期。开发收件箱没有登录保护，只面向单机开发；它同时检查本地环境和匹配的回环地址。不要使用公网隧道暴露开发服务。

## 目录与数据

| 目录                               | 用途                                                 |
| ---------------------------------- | ---------------------------------------------------- |
| `src/routes`                       | TanStack 文件路由、公共页面、受保护工作台和 API 路由 |
| `src/modules/auth`                 | 请求内构建的 Better Auth、邮箱密码与服务端用户授权   |
| `src/modules/billing`              | 测试订阅、门户、事件验签、当前状态同步、套餐判断     |
| `src/modules/mail`                 | 本地收件箱和 Cloudflare 发信适配                     |
| `src/modules/projects`             | 项目输入规则，业务处理在 server API 中               |
| `src/server`                       | JSON/Origin/请求体边界、API、server functions        |
| `src/db`、`migrations`             | Drizzle SQLite schema 与迁移                         |
| `src/components`、`src/styles.css` | 可编辑 UI 源码、共享组件和主题                       |

修改 schema 后执行 `pnpm db:generate`，检查新 SQL，再执行 `pnpm db:migrate`（本地）。迁移不会在普通请求内执行。已经应用过的迁移保持不变，使用新迁移变更数据。生产迁移见部署手册。

无支付版默认每个账号最多 3 个项目，配额位于 `src/config/site.ts`，可按产品调整。实验计费模块另有 Pro 测试上限，不因保留这些常量就显示套餐或要求支付配置。并发创建使用同一条 `INSERT SELECT WHERE COUNT(...)` 原子判断，不依赖先读后写或 KV 锁。项目示例最多返回 100 条；管理员列表使用服务端搜索、状态筛选与每页 20 条分页。规模增长后按业务补索引和配额，不将示例视为无限规模后台。

## 国际化与认证

英文使用 `/`、`/login`、`/app`，中文使用 `/zh`、`/zh/login`、`/zh/app`。Router 双向 URL rewrite 将前缀映射到内部搜索状态，输出时移除内部参数。根路由按请求生成 HTML lang、文案和 SEO；不要用模块级变量保存语言。

消息位于 `src/i18n/en.json` 与 `zh.json`，组件使用类型化 `t(key, values)`。运行 `pnpm locale:check` 检查键与占位符一致。语言切换使用完整导航，保留 query/hash；认证/支付回跳保留前缀。API 与 Better Auth 请求发送语言 header，服务端只将已知公共错误映射到字典，不直接显示供应商原始错误。

根配置 `PUBLIC_INDEXABLE=false` 时 robots 禁止索引、sitemap 为空；公开发布时显式开启，只列已选择能力的公开页面与已发布内容，未选支付时不列套餐页。私有页面始终 noindex。

本地 Google 联调需要 `.dev.vars` 中同时设置 `GOOGLE_AUTH_ENABLED=true`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`，回调为 `http://127.0.0.1:3100/api/auth/callback/google`。重启服务后验证。未选择或未配置时不向访客显示 Google 占位按钮；选择 Google 后需先在 staging 配置并真实验收，再发布。

验证邮件重发按规范化邮箱的 SHA-256 键做 D1 原子 60 秒冷却，失败释放只属于本次请求的预留。认证仍有数据库速率限制。私有写 API 按已认证用户每分钟 30 次限流，读接口不消耗此额度；独立于项目数量配额。

## 管理员

注册并验证账户后执行：

```bash
pnpm admin:grant you@example.test
# 刷新工作台，进入用户运营后台；先保留另一位有效管理员再撤销角色
pnpm admin:revoke you@example.test
```

脚本读取当前项目的本地 DB，仅操作 `--local`，要求已验证且未停用的账号，不能撤销最后一位有效管理员，不会改云端账户。后台支持搜索、停用/恢复与最小操作记录，见 [ADMIN.md](ADMIN.md)。管理员由独立 `admin_user` 表判断，默认首位注册者不自动成为管理员。云端需要操作者显式对目标 D1 写入角色，见部署手册。

## 请求体与开发运行时

API 入口在来源、鉴权等早返回前读取请求体，普通 API 上限 16KiB，Stripe Webhook 上限 256KiB。重建 Request 使用原始字节，Webhook 仍在验签后处理；不要先解析/改写签名载荷。超限拒绝并取消输入，不做无界缓存或记录请求体。认证入口也有有界读取。未知 SDK 异常越过下层原始错误打印，由认证 HTTP 边界记录固定分类/级别/请求 ID 并返回通用错误；APIError 保留原本状态与响应头。不得打印原始数据库错误、SQL 参数或凭据，也不通过关闭 logger 隐藏故障。开发代理可能在未消费输入流就返回时重置连接，HTTP 回归必须同时覆盖拒绝响应与后续请求。

`vite.config.ts` 对当前 Base UI 子路径在 client/SSR 环境预打包，减少首次访问懒加载路由时的依赖重建。不要用客户端渲染替代 SSR、降低并发、吞异常或增加重试来掩盖失败。修改运行时后，在独立项目和生产构建中验收；热更新或旧测试数据不能替代冷启动检查。

## 实验计费（默认关闭）

首版无支付产品无需本节配置。仅在明确选择 billing/billing-test 后，按 [PAYMENTS.md](PAYMENTS.md) 选择供应商并分别验收。源预览与 web-app 默认 billing=false；不要为了通过测试打开支付。保留已有产品的历史账务、门户与签名回调，关闭新结账与完整退役不是同一操作。

### Stripe TEST

在 `.dev.vars` 添加自己的测试配置，重启开发服务：

```dotenv
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

使用 Stripe 测试账户创建循环计费 Price，启用 Customer Portal。若安装 Stripe CLI，可把测试事件转发到 `http://127.0.0.1:3100/api/billing/webhook`；使用该监听器返回的签名密钥。只订阅 `checkout.session.completed`、`customer.subscription.created`、`customer.subscription.updated`、`customer.subscription.deleted`。

`BILLING_ENABLED=false` 会停止新结账；只要测试配置仍完整，事件同步和门户继续运行。5 分钟同一用户/价格的结账尝试复用 Stripe 幂等键；取消后短时间重新进入可能回到同一未过期结账。不要拿 URL 的 success 或 checkout 参数开通权益。

Webhook 读取原始体，SDK 验签，拒绝 live 事件。处理时重新读取当前 Stripe 订阅，并用本地修订号条件写入；事件 ID 去重，冲突重读，失败由 Stripe 重试。有效的匹配价格、active/trialing 状态和未过期周期共同决定 Pro 权益。退款本身不会自动取消订阅；此版本未实现退款、税务和争议业务，正式收款前必须定义这些规则。

自动化测试使用真实 Stripe SDK 签名校验 + 模拟供应商响应 + 实际本地 D1。它不等于真实 Stripe 托管页面、3DS、真实邮件或支付渠道验收。

## 运行检查

```bash
pnpm format
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:production
```

`check` 先校验存在的产品计划，再检查语言字典，再构建生成路由，再执行 ESLint、TypeScript 和 Vitest。底座源目录还运行 `test:starter` 初始化/安装器/流程状态测试；生成产品的检查不包含底座初始化器测试。Playwright 无需提供密钥；会创建 `@example.test` fixture 账户。D1 集成测试使用临时 Miniflare 实例，不读写开发库。开发 E2E 使用独立 fixture 用户，会向开发 D1 写入测试数据；本地 fixture 为每个测试使用独立客户端 IP，避免共享认证速率桶，不降低真实限流。

`test:production` 使用全新的 `.wrangler/acceptance/<UUID>` 配置、D1、随机认证密钥和假 Google 凭据；构建生产 Worker，在 HTTPS 3110 上验收后停止自己的进程。端口已占用则退出，不中断已有服务。不读取开发 `.dev.vars` 或数据库，清除继承的供应商密钥，禁用发信和支付。授权 URL 检查不等于真实 Google 登录。测试产物不入库。

CI 使用本地模拟服务与假凭据，包含默认、web-app、showcase、Google-only 组合；每次发布需核对实际候选提交的远端结果，旧提交通过不能证明当前工作区通过。更改 UI 时还应查看桌面/手机渲染及交互，不能只以编译成功代替验收。

## 后续复用与升级

当前是单应用源码模板，不是多租户业务平台、托管服务或自动迁移框架。复制时每个产品独立数据库/密钥/域名；不要复用开发数据。通过 `starter-version.json` 和 `.aster/baseline.json` 记录起点，使用已实现的扫描、备份合并、采用记录和回退流程，见 [UPGRADING.md](UPGRADING.md)。联网发现/自动获取新发布版本尚未实现；不能直接覆盖已有产品。
