# 按产品需求选择能力

Aster 用于普通 Web 与 AI 产品。先确定用户流程，再选择能力；无需每个站点都接登录、支付或 AI。Agent 使用现有 Skill 从上下文整理选择，非关键项记录依据，后续可以增量调整。

## 同一份运行配置

`src/config/features.json` 是公开的构建期能力开关；浏览器页面、服务端接口、初始化、doctor/check 和部署检查读取它。它不包含密钥、账号资格或真实验收结论。修改后重启开发服务或重新构建发布才能生效。

`starter.project.json.modules` 保留选择及 user/context/default 依据，check 会核对它和运行配置。配置存在不等于已接通；provider 的实际就绪仍由所选环境的凭据、域名和真实验收决定。旧产品没有配置文件时，检查工具保留旧行为，不自动关闭现有业务；先按升级指南合并能力及其依赖，再显式选择。

| 开关          | 能力与依赖                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| database      | D1 数据；公开展示站可关闭                                                                             |
| auth          | 认证基础，依赖 database；至少选一种登录方法                                                           |
| emailPassword | 邮箱密码注册、验证与找回，依赖 auth、mail；称呼不是用户名登录                                         |
| google        | Google 登录，依赖 auth；不依赖邮件模块                                                                |
| mail          | 已有 CF/Brevo/Resend 适配；本地测试收件箱另需 database                                                |
| projects      | 私有项目示例，依赖 auth、database                                                                     |
| billing       | Stripe / Creem TEST ONLY，依赖 auth、database；与新结账运行开关分开                                   |
| files         | 私有 PNG/JPEG/WebP 图片、头像/项目封面，依赖 auth、database；按需绑定私有 R2，见 [图片指南](FILES.md) |
| content       | 文章/帮助/公告、草稿与发布，依赖 auth/database；封面另需 files，见 [内容管理](CONTENT.md)             |
| ai / usage    | 尚未实现，保持 false；需求可记 required，完成实现/边界/真实验收后再扩展策略并启用                     |

这是一组产品能力开关，代码和依赖保留在仓库以便后续增量接入，不承诺删除所有关闭模块的构建产物。关闭模块会关闭页面入口和直接接口，避免仅隐藏按钮仍能调用。公开站不会查询认证或 D1；已有数据库、迁移和数据不因关闭能力而删除。

支付选型先按 [主体与供应商指南](PAYMENTS.md) 核对个人/个体/公司、地区及结算资格。覆盖不同主体是底座目标，当前 billing 支持 Stripe / Creem TEST；通过 BILLING_PROVIDER 显式选择，其他供应商须实际开发适配，不能把某个开发者的身份或某家渠道固定为所有项目的选择。

## 三种起步组合

| profile      | 默认选择                               | 适用场景                                          |
| ------------ | -------------------------------------- | ------------------------------------------------- |
| showcase     | 所有可选模块关闭                       | 官网、作品集、展示站；页面、双语、主题和 SEO 保留 |
| web-app      | D1、认证、邮箱密码、邮件、私有项目示例 | 普通会员/数据应用；Google、支付、AI 等关闭        |
| billing-test | web-app 加所选渠道的测试计费模块       | 需要测试订阅与权益的产品；仍不启用真实收款        |

```bash
# 从 Aster 源创建新产品；也可由 Skill 直接整理 --plan
pnpm aster:new ../my-site --name "My Site" --profile showcase
```

不同时传 --profile 与 --plan，避免覆盖 Agent 已整理的选择。初始化在安全的新目录原地进行；已有产品使用增量配置。纯展示站不生成认证密钥或 D1 绑定，setup 不执行数据库迁移，恢复记录将该初始化阶段标为 skipped。web-app 不默认启用 Google、支付、AI 或 R2。

## 已有产品增量调整

先读取规则、PROJECT.md、当前实现与状态；保留业务、品牌、数据和已接通服务。

```bash
pnpm project:modules                         # 查看实际配置
pnpm project:modules --profile showcase      # 只读预览本地变更
pnpm project:modules --profile showcase --apply
```

--apply 只写当前项目本地配置和计划；不创建资源、不安装依赖、不执行迁移、不发信或调用模型、不部署。变更前在私有 `.local/module-changes/` 保存文件备份；失败时按当前内容恢复已写文件，保留可识别的后续修改。锁或异常中断需先检查备份与状态，不自动抢锁。配置和计划在预览后发生变化，需要重新预览。备份可能包含原有本地凭据，保持该目录私有且不提交；旧配置恢复要同步恢复计划，再重跑检查，不把文件回退当作数据库/云资源回退。

只移除未选数据库的模板占位绑定；现有真实资源绑定保留并在交接中核对是否仍需使用。重新启用数据库时只准备占位绑定，后续由 Agent 在授权范围配置真实目标。首次从无认证切到认证时可生成缺失的独立本地密钥；已有密钥保留，不能借切换组合重置它。选邮件时本地可准备 local 模式，已选的现有邮件服务不切换供应商；远端凭据按原邮件接入流程配置。

启用 Google 或支付模块后仍需完成配置；开关不自动创建 OAuth 客户端、启用结账或开通付费。已将支付记为 required 的项目不能用组合切换轻易移除支付；只关闭新结账用 `BILLING_ENABLED=false`，保留门户与 Webhook。真正退役要先检查现有订阅、权益和用户影响，再单独形成变更。

Agent 也可传入带选择依据的部分 JSON，未提到的能力沿用当前运行配置。例如仅增加 Google：

```json
{
  "google": {
    "selection": "required",
    "basis": "user",
    "reason": "用户本次明确要求增加 Google 登录"
  }
}
```

```bash
pnpm project:modules --input /tmp/module-choices.json
pnpm project:modules --input /tmp/module-choices.json --apply
```

同意本地能力变更不扩大云端、购买或 Git 授权。应用后运行 setup 生成类型及所需的本地迁移，重启预览，继续开发和实际验收；已有产品先确认配置完整，不覆盖其密钥。

## 页面与接口

auth 同时包含 [账号安全设置](ACCOUNT-SECURITY.md)：按当前账号实际凭据展示改密，支持设备摘要和撤销其他会话。Google-only 不要求邮件或密码表单；auth 关闭时私有安全接口一起关闭。
auth 也包含 [数据导出与注销](ACCOUNT-LIFECYCLE.md)：只导出当前用户的白名单数据，注销前重新验证身份；有历史支付关联时需重新核对供应商，未解决账务仍阻止注销；核对通过后原子归档最小账务记录。关闭模块不移除历史账务检查或所需迁移。Google-only 使用近期应用登录，auth 关闭时生命周期接口一起关闭。

- auth 关闭：登录、注册、找回、工作台等页面及认证/私有 API 关闭，公开导航和行动入口不指向它们。
- Google-only：邮箱表单和找回入口关闭，直接调用邮箱接口也拒绝；公开注册不要求邮件服务，但需要选中 Google 的真实回调验收。
- billing 关闭：套餐页、账单入口与接口关闭，sitemap 不包含套餐页；普通数据应用不展示测试订阅。
- projects 关闭：示例项目菜单、操作、概览内容和 API 关闭，认证仍可供其他实际业务使用。
- database 关闭：健康检查返回 storage=none，公开页可在无 DB binding、无认证密钥的环境运行。
- 未选的 Google、邮件、R2、AI 等不在服务页展示未配置占位。

已有页面设计继续保留。调整模块后，Agent 核对业务文案和主要操作是否仍然符合产品目标；这些开关不会自动把示例首页变成客户的业务页面。

## 验收和发布

任务和用例可加 `module` 标记。`project:check --ready` 仅将已选模块的相关用例计入必需范围；普通业务用例仍必需，不能因为关闭认证就跳过整个业务验收。固定认证用例自动对应 emailPassword/google；变更时工具重置受影响的完成声明。旧的自由文本 handoff.blockers 不靠关键词自动清理，由 Agent 核实哪些已解决或不适用。

发布前检查按已选能力执行：

| 组合         | 必需配置/验收                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| showcase     | 有效环境与公开 origin；不要求认证密钥、D1、邮件或 Google 记录                                                      |
| web-app      | DB、认证密钥、所选邮件配置；生产要求 auth-email-live                                                               |
| Google-only  | DB、认证密钥、Google 凭据与开启状态；生产要求 auth-google-live                                                     |
| billing-test | 上述认证要求加当前及存量渠道的测试配置；生产按渠道要求 billing-test-live 或 billing-creem-test-live 的真实沙箱证据 |

staging 允许为所选能力准备尚未完成真实验收的版本，仍遵守用户禁止部署等限制。AI/usage 尚未实现时，记录必需需求会阻止宣称 ready 和正式发布，不能靠隐藏页面伪装已完成。未选模块的配置/用例不阻塞发布；敏感信息放进公开 JSON、远端 local 收件箱等通用错误仍拒绝。

验证命令：`pnpm check`、`pnpm format:check`、`pnpm test:e2e`；隔离生产组合分别执行 `pnpm test:production`、`pnpm test:production --profile web-app`、`pnpm test:production --profile showcase`、`pnpm test:production --profile google-only`、`pnpm test:production --profile creem`。全关闭能力的展示站运行普通 `test:production` 时使用 showcase 检查；不凭空增加认证依赖。这些使用本地 Worker 与假 OAuth 凭据，不证明 CF 云端 CPU、真实 Google、邮件或收款资格。

必须在生成后的产品目录实际运行检查，不能用底座源码通过的结果替代。浏览器测试读取本产品能力配置：未选的功能验证页面/API 关闭，认证或支付场景只在对应能力选中时执行；支付单元夹具单独启用测试模块，保持其签名与对账覆盖，不迫使普通 web-app 开启支付。关闭不相关用例不能跳过产品的核心业务流程。

## 视觉与图片的独立选择

视觉主题在 `src/config/appearance.json`，见 [主题指南](THEMES.md)，不自动选择任何外部模块。files 选中时需要独立 ASSETS_BUCKET；生产要求 files-live 的真实目标环境证据。源预览已启用图片以便体验，所有新产品 profile 仍默认 files=false。已有资源不能仅通过关开关免除清理责任。

content 在所有新起步组合中默认关闭。文字内容无需 R2，封面按需选 files；生产要求 content-live 的真实目标环境证据。后台管理员不能通过访客输入授予，普通访客不需登录即可读取公开版本。站点共享内容/素材在编辑者注销后保留并清除账号关联，不能按个人文件误删。

## 用户运营后台

已有 auth/database 支持按角色访问 `/app/admin`，无需新增模块开关或外部服务。展示站关闭 auth 时直达页面及 API 也关闭。仅有效管理员可查询用户、停用/恢复及读最小操作记录；不自动授予角色、不代替产品独立验收。接入、迁移与保护规则见 [ADMIN.md](ADMIN.md)。
