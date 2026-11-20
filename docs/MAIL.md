# 邮件服务选择与接入

[English](en/MAIL.md)

Aster 支持 `local`、`cloudflare`、`brevo`、`resend`，未选远端服务时保持 `disabled`。邮箱验证和密码找回共用中英文 HTML / 纯文本模板，不改变 Better Auth、D1 或会话模型。

## 按账户和环境选择

1. 优先用户明确选择及当前项目已接通的服务；不要因更新底座而替换可用供应商。
2. 尚无选择时，只读核对目标 Cloudflare 账户。**已开通 Workers Paid，且 Email Sending 资格、发信域名及共享额度适用时，默认优先 Cloudflare**。购买域名、DNS 的 Pro 套餐或仅保存付款方式，均不能证明已有 Workers Paid。已有套餐也不保证新增用量不收费。
3. 没有 Workers Paid，或 CF 发信不适用时，按用户偏好、已有账号/密钥、域名、日/月发送量、账号激活、品牌要求及目标收件箱的实测结果选择 Brevo 或 Resend；不要把其中一家设为所有项目的默认值。
4. 账户状态无法读取就标未知，不假定 Paid，不自动升级或开户。用户未表达偏好时，先利用已有环境形成推荐并记录理由；确实缺少影响选择的信息再问。

在产品 `PROJECT.md` 记录所选服务、账户套餐/资格是否核实、额度和预估用量；在 `starter.project.json.decisions` 增量增加 `id=mail-provider` 的选择、`basis=user/context/default` 和 `reason`。未确定时保留 open，不能写成已接通；运行时只由该环境的 `MAIL_MODE` 指定供应商，不在请求中探测套餐或自动切换服务。

当前公开限制见 [成本清单](COSTS.md)，实际配置前再核对。Brevo Free 每天 300 封、不结转，免费版有品牌标识；Resend Free 每月 3,000 封且每天 100 封。验证重发、找回和同账户其他项目均会消耗对应共享额度。[Brevo 套餐](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) · [Brevo 限制](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) · [Resend 定价](https://resend.com/pricing)。不要把“无需为邮件升级 CF”说成完整认证已在 Workers Free CPU 限制下通过验收。

## 配置所选环境

本地继续使用 `MAIL_MODE=local`，只写匹配回环 origin 的开发收件箱，不需要真实邮件账号。远端在 `wrangler.jsonc` 的根 production 或 `env.staging.vars` 中配置，例如：

```jsonc
{
  "MAIL_MODE": "brevo",
  "MAIL_FROM": "Your Product <accounts@notify.your-domain.com>",
}
```

`MAIL_FROM` 支持 `名称 <邮箱>` 或单独邮箱。替换成已验证的真实发信域名地址，不能沿用示例。生产与 staging 配置独立；密钥仅保存到对应 Worker 的 secret，不写入 vars、Git、截图、日志或聊天。

| MAIL_MODE    | 所需配置                                                                           | 不需要配置的项                                               |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `cloudflare` | Workers Paid 与发信资格、已验证域名、该环境的 `send_email` binding，名称为 `EMAIL` | Brevo / Resend API key                                       |
| `brevo`      | 已激活的事务邮件账号、已验证发信域名、`BREVO_API_KEY`                              | CF `send_email` binding / Workers Paid（邮件适配本身不要求） |
| `resend`     | 已验证发信域名、发送权限的 `RESEND_API_KEY`                                        | CF `send_email` binding / Workers Paid（邮件适配本身不要求） |

按所选服务执行其中一个命令，交互输入值；下例为 staging，production 省略 `--env staging`：

```bash
pnpm exec wrangler secret put BREVO_API_KEY --env staging
# 或选择 Resend 时：
pnpm exec wrangler secret put RESEND_API_KEY --env staging
```

Brevo 用 **API key**，不是 SMTP key；适配通过 HTTPS `POST https://api.brevo.com/v3/smtp/email` 发信。Resend 使用 `POST https://api.resend.com/emails`。无需安装 SDK 或配置 SMTP。只取选中供应商的密钥；单次请求最多等 10 秒，禁止重定向，不读取/输出提供商响应正文。失败时不自动重试或切换供应商，避免请求超时但邮件已被接受时重复投递。[Brevo API](https://developers.brevo.com/reference/send-transac-email) · [Resend API](https://resend.com/docs/api-reference/emails/send-email)。

外部邮件不使用 CF `send_email` binding；检查确实未被其他业务使用后再移除所选环境的无用 EMAIL 绑定，不能盲删。`deploy:check` 检查 sender、绑定和验收记录；实际 `deploy` 还只读核对所选服务的远端 secret 名称，不会代为创建密钥或证明密钥有效。

## 域名与账号激活

已有域名且能修改其 DNS 就可开始，无需为发信再购买企业邮箱。建议选择专用发信子域，例如网站为 `app.your-domain.com`，发信地址为 `accounts@notify.your-domain.com`，验证的是 `notify.your-domain.com`。发信地址配置不自动提供收件箱；需要接收回复时另行配置可收信的邮箱或转发。

在 Brevo 添加发信域名，按后台实际给出的 Brevo code、DKIM、DMARC 等 DNS 记录逐项添加并验证。已有 DMARC 要先检查并合并策略，不能覆盖其他邮件业务或添加重复记录；不要修改网站路由或原有收信 MX。CF 上的 DKIM CNAME 按说明使用 DNS only。DNS 生效可能需要等待。[域名配置](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)。

Brevo 事务邮件激活与域名验证是两件事。若后台提示未激活，按官方指引联系支持请求激活；这不是付费升级，不假定每个新账号都已可用。[激活说明](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP)。Resend 同样需要自己的已验证发信域名。[域名要求](https://resend.com/docs/dashboard/domains/introduction)。

## 已有 Aster 产品增量接入

在产品自己的项目中调用 `$aster-new`，读取它现有的 AGENTS、PROJECT、机器计划和认证代码，**先检查差异，不重新初始化、不覆盖业务或页面**。用户 Skill 若链接到底座源目录，可从该链接的真实路径定位这份文档及实现；旧产品内部复制的 Skill/文档可能过时，需要显式比较当前源。

参考更新范围：`src/modules/mail/mail.server.ts`、新增 `providers.server.ts`、`src/env.d.ts`、`scripts/deployment-policy.mjs`（新文件）、`scripts/deploy.mjs`、`scripts/project-doctor.mjs`；服务页使用的 `mailReady` 还涉及 `src/server/app.server.ts`、`src/routes/app.services.tsx` 及对应翻译。逐项合并当前底座的变化并检查目标项目的部署检查兼容性，不整份替换。自定义命令/认证配置以产品实际架构为准。

保留已有 Google 配置、会话密钥、D1、品牌和路由。密钥变化、换邮件供应商或改发信/站点域名后，重置受影响的 `auth-email-live` 用例，保留其他仍有效的验收，不借用底座的模拟测试证据。检查后更新原项目的来源版本/迁移记录，不虚称执行了整版升级。

## Agent 执行与人工接力

配置和验收是 Agent 的工作，不默认交给用户照文档操作。先从当前任务、PROJECT.md 和既有授权确认目标账户、域名、环境与允许范围；读取计划和已有连接，能从上下文确定的事项不重复询问。Skill 调用本身不授权任意云端操作，用户明确的限制优先。

| 用户目标               | Agent 应推进到哪里                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 只出方案、只接本地代码 | 完成可审阅方案或本地实现/模拟测试；列出未执行的远端事项，不虚称接通                                                     |
| 配置并真实验收邮件     | 在授权环境完成可执行的账户/域名/密钥配置与真实收信流程；仅被具体权限、人工验证或审核阻塞时接力                          |
| 暂不部署               | 不发布新应用版本，包括 staging；已有且获准使用的测试环境仍可配置/验收。若新代码必须部署才能实测，说明需要哪一次部署授权 |
| 接通并上线             | 在授权范围完成 staging 配置/真实验收，通过发布检查后再发布及回归正式环境                                                |

真实接入时，Agent 应继续执行：

1. 检查已有供应商连接、可用 CLI/API/浏览器、目标环境与域名权限，按前文规则选型并记录。缺少连接时先尝试可用的受支持路径；未连接不能写成已核验，也不凭空假定工具已具备账户权限。
2. 在授权范围配置发信服务、发信子域与 DNS，保留其他网站/邮件业务记录，核验实际生效与服务激活状态。已具备权限的配置不要求用户再手动抄录；登录验证、验证码或平台审核确需人处理时再接力。联系供应商支持会发送消息，只有用户明确授权该联系动作时才发送，否则准备申请内容交用户处理。
3. 从已有安全配置复用凭据，或在授权账户创建所选服务所需的最小权限凭据，并安全写入对应 Worker secret。不要要求用户把 API key 发到聊天，也不下载远端 secret；只能取得名称不代表已获得其值或验证有效性。
4. 使用用户指定或明确授权的自有测试邮箱，发送有限的真实验收邮件；若可读取该测试收件箱，直接检查投递并完成链接操作。不要向真实业务用户或随机邮箱发送测试邮件。没有收件箱权限时，只请用户确认收信或在浏览器完成相应验证；验证码、Cookie、邮件链接和令牌不写入聊天、报告或公共截图。
5. 完成下文的注册、验证、找回与会话回归，记录当前环境、实际结果和脱敏证据。DNS、激活、投递、链接与业务状态分别确认，不能将 API 成功响应当成全部通过。检查已接入 Google 与账户隔离，避免新邮件配置影响现有登录。

执行前用 [外部服务断点续做](SERVICE-WORKFLOW.md) 建立或读取当前产品阶段记录；每步保存脱敏证据，按依赖保留有效进度，配置或代码变化时重验。该工具只管理本地进度，实际配置和验收仍由 Agent 执行。

人工接力只列**当前实际遇到**的阻塞：缺少什么、Agent 已检查/完成什么、用户需要做哪一步、完成后从哪里继续。允许在任务记录中保留未完成用例与下一步；不要把整份指南当作交付完成，也不要将尚未尝试的所有步骤一并推给用户。用户补齐后继续原任务，不重做初始化或已通过且仍有效的验收。

## 验收后开放注册

先在 staging 实收邮件，验证英文/中文注册 → 验证链接 → 登录 → 退出；再检查重发限制、找回密码、重置后的旧会话撤销、失败处理及目标收件箱（包括业务需要的国内邮箱）。API 返回成功只证明供应商接受，不代表进入收件箱。

将当前项目的实际证据记录到 `auth-email-live`（business / provider / real / passed），再执行 [发布检查](DEPLOYMENT.md#认证选择与发布时序)。本底座的 mock 测试只验证请求、模板与失败边界；不证明某个账号已激活、免费额度足够或真实邮件已送达。初始化/配置脚本本身不会开户、改 DNS、发真实邮件或部署站点；Agent 在用户已授权的接入任务中使用可用工具推进配置与验收，不在脚本边界处提前结束。
