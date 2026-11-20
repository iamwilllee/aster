# 外部配置与真实验收的断点续做

[English](en/SERVICE-WORKFLOW.md)

用户要求接通邮件或 Google 时，Agent 在已有授权内执行配置和真实验收。`starter.project.json.integrations` 保存目标、阶段、证据指纹和具体人工接力；`project:service` 只管理本地进度，不登录供应商、改 DNS、部署或发送邮件。实际操作仍由 Agent 使用可用连接完成，不能在写完记录后提前交付。

## 继续已有任务

```bash
pnpm project:status
pnpm project:service status
# 只看某项
pnpm project:service status --id mail-staging
```

Agent 从当前产品读规则、PROJECT.md 和记录，核对本次用户授权及远端实际状态，然后继续 `actionable` 中能执行的步骤。`next` 是首个未完成阶段，可能需要人工接力；`actionable` 同时给出不依赖该阻塞的步骤。账号、域名、凭据和服务激活可能在项目外变化，哈希不能探测这些变化；恢复时应只读核验，不因旧记录重复开户、换密钥、发信或部署。

邮件阶段依赖：账号 → 域名；账号 → 凭据 → 部署；域名和部署 → 实收 → 认证回归。Google 为账号 → 凭据 → 部署 → 认证回归。域名审核不阻止独立的凭据配置；部署被用户禁止时记录 scope 阻塞，继续允许的工作。

## 建立目标

Agent 根据现有上下文整理临时 JSON；用户不需要填写向导。以下仅为格式示例，不代表账户已连接或获准执行：

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

- provider 为 `cloudflare`、`brevo`、`resend`、`google`；按 [邮件选择规则](MAIL.md) 保留现有偏好和可用服务。该字段不会改变运行时 MAIL_MODE。
- account 是非敏感账户别名；worker 是公开名称，origin 为无路径/查询参数的 HTTPS origin。Google 省略 domain，inputs 也省略 domain/delivery。
- `credentialRevision` 仅为人工维护的非敏感版本标签。创建、轮换或更换凭据后更新它；不读取、哈希、复制或输出远端 secret 值。
- account/domain 可用空 inputs，依靠目标和实际核验报告。其他阶段至少跟踪一项相关实现/配置；Agent 要按产品补齐模板、语言字典、公共认证依赖等，不能把示例路径当作自动依赖分析。
- inputs 允许 src、scripts、migrations 下的文件及 wrangler.jsonc、package.json、pnpm-lock.yaml。指纹按整文件计算，可能保守地要求复查；不要跟踪 .env/.dev.vars、密钥或生成目录。
- required 默认 true，仅表示本次任务需要完成，不构成外部操作授权。不需要的集成可改为 false 保留历史；不是用它绕开产品已选择的登录或发布验收。

同 ID 再次 plan 会保留目标、输入和证据仍有效的阶段；变化的阶段及其依赖重置。更换 provider 全部重置，不覆盖其他集成。旧计划无 integrations 时按空数组读取，不需要重新初始化。旧产品没有脚本时先按 [升级指南](UPGRADING.md) 合并本能力及相关工作流脚本，再运行；不要只改 Skill 就假定产品代码已更新。

## 记录执行结果

每完成一步，将实际脱敏结果保存到当前产品 `.local/service-evidence/`，再用临时 JSON 记录；目录保持私有、不提交仓库。报告包含目标环境、时间、操作、可观察结果和限制，不含收件人个人信息、Cookie、验证码、验证/重置链接或 API key。每个阶段使用独立报告，不要修改一个共享报告导致所有旧指纹失效。

```json
{
  "status": "done",
  "verification": "real",
  "evidence": [".local/service-evidence/account.md"]
}
```

```bash
pnpm project:service record --id mail-staging --step account --input /tmp/service-result.json
```

`done` 要求 real 和本产品已存在的证据；local/mock 不得充当外部配置完成。工具只检查记录、路径和指纹，无法判断报告内容是否属实。账号阶段核实资格/激活/套餐，domain 核实域名与 DNS，credentials 核实选定环境所需配置；secret 名称存在不等于密钥可用，后续投递/登录才覆盖实际可用性。deployment 记录真实授权部署；delivery 必须实收，供应商 API 接受不足以通过；auth 按 [邮件验收](MAIL.md#验收后开放注册) 或真实 Google 回调及会话回归执行。

`status` 也可为 pending、failed、blocked。重做某一步会清除其依赖阶段的完成声明；将步骤记 pending 可用于明确失效/重验。输入、目标上下文或证据文件变化/丢失会在 status 显示 stale；Agent 从首个失效依赖开始核验再 record，保留其他仍有效阶段。文件指纹不会自动探测未列出的代码、DNS、账户、secret 或部署漂移；发现这些变化时主动重置相关阶段。

真实阻塞时记录最小人工动作：

```json
{
  "status": "blocked",
  "verification": "unverified",
  "evidence": [],
  "blocker": {
    "kind": "activation",
    "detail": "平台显示事务邮件待激活，尚不能进行真实收信",
    "userAction": "在已登录的服务控制台完成激活申请",
    "resume": "核实激活结果后继续域名核验和投递，不重新创建账户"
  }
}
```

kind 可为 login、verification、activation、permission、purchase、scope。只在实际需要时请求用户处理对应一步，不发送整份清单；购买、联系支持、部署等按用户授权执行。blocked 必须有 detail/userAction/resume，其他状态不能保留过期 blocker。用户补齐后重新核验该步骤，record 成功会清除 blocker 并继续原任务。

## 与业务验收和发布的关系

阶段完成不自动创建或通过 `auth-email-live` / `auth-google-live`。真实业务回归完成后，Agent 还要单独更新这些 business/provider/real 用例及当前产品证据；部署继续遵守 [发布检查](DEPLOYMENT.md#认证选择与发布时序)。改目标、重做或失效阶段时，工具重置相关认证用例；status/check 发现过期阶段而认证仍 passed 时报告错误，防止沿用旧验收。staging 的实际回归用于发布准备；需要发布后才能完成的生产回归应在对应发布任务中记录，不把尚未部署的 production 设为发布前已完成。

`project:check --ready` 将 required 集成的未完成阶段计入待办，但仍不证明远端状态或发布成功。`project:doctor` 只提示是否有待续进度。命令遇到无效路径、输入或并发写入时不打印原始值；本地计划写入有独占锁和变更检测，锁残留先核实有无正在运行的任务，再恢复，不自动抢锁。保留既有任务、其他集成、密钥和业务文件。
