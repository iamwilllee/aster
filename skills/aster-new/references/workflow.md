# 从需求到可恢复的项目

`PROJECT.md` 保留用户说明和人类交接；`starter.project.json` 保存可校验的需求摘要、选择、任务和验收状态。运行时配置继续使用 site.ts、wrangler.jsonc 和私有 secrets，不在计划里重复保存。

## 判断模块

| 键      | 底座现状                            | 判断时关注                                           |
| ------- | ----------------------------------- | ---------------------------------------------------- |
| auth    | 邮箱认证已实现                      | 是否有私有数据、多用户；现有保护不随模块选择自动删除 |
| mail    | 本地、CF、Brevo、Resend 适配已实现  | 按偏好/现有环境选型，真实投递需域名、资格与验收      |
| google  | OAuth 接线已实现                    | 依赖 auth，凭据和真实回调仍待验收                    |
| billing | 仅 Stripe TEST                      | 依赖 auth，需明确订阅/按次和权益；不启用正式支付     |
| ai      | 未实现                              | 供应商、调用方式、预算、失败处理和额度规则           |
| files   | 私有图片库；头像/项目封面，按需启用 | 私有/公开、类型/大小、权限、配额和失败恢复           |
| usage   | 消费账本未实现                      | 预留/结算/释放及重试、并发规则                       |

选择只有 `required`、`deferred`、`undecided`；依据为 `user`、`context`、`default`。选择 required 表示产品需要，不表示底座已提供。选择 deferred 不会卸载库或删除示例模块。用理由保留判断依据，用户的新要求优先于旧推断。

项目名、首版可推导的文案/默认主题可由 Agent 判断；收费策略、数据公开范围、真实额度和外部操作不能凭推断当成授权。缺少会阻塞实现的决策才追问，其他未定项留在计划并继续独立工作。

## 计划输入示例

下面是“私人片段库、不接外部服务”的例子，用来说明格式；按用户实际需求填写。初始化器接受部分字段并补默认值，但默认会保留未定模块，不能据此宣称需求已完整。

```json
{
  "schemaVersion": 1,
  "goal": "私人代码片段库，首版不收费",
  "audience": "独立开发者",
  "coreFlow": ["邮箱注册并验证", "创建片段", "搜索和编辑", "刷新后仍保留"],
  "outOfScope": ["团队协作", "AI 生成", "云端发布"],
  "modules": {
    "auth": { "selection": "required", "basis": "user", "reason": "每人拥有私有片段" },
    "mail": {
      "selection": "required",
      "basis": "context",
      "reason": "复用邮箱验证，本地先用收件箱"
    },
    "google": { "selection": "deferred", "basis": "context", "reason": "首版邮箱登录已满足需求" },
    "billing": { "selection": "deferred", "basis": "user", "reason": "首版不收费" },
    "ai": { "selection": "deferred", "basis": "user", "reason": "首版不做 AI" },
    "files": { "selection": "deferred", "basis": "context", "reason": "只保存文本" },
    "usage": { "selection": "deferred", "basis": "context", "reason": "没有计费模型调用" }
  },
  "decisions": [],
  "tasks": [{ "id": "snippets", "title": "实现私有片段 CRUD", "status": "todo", "evidence": [] }],
  "acceptance": [
    {
      "id": "persistence",
      "title": "片段持久化",
      "kind": "business",
      "scope": "local",
      "steps": ["登录用户 A", "创建并修改片段", "刷新并搜索该片段"],
      "expected": "返回修改后的内容，刷新不丢失",
      "required": true,
      "status": "pending",
      "verification": "unverified",
      "evidence": []
    }
  ],
  "handoff": { "next": ["实现片段 schema 与接口"], "blockers": [] }
}
```

私有数据还要补跨账户越权、错误/空态、手机和语言用例。外部调用需要独立的 `scope: provider` 用例，真实完成后才能用 `verification: real`、`status: passed`；mock 测试记录为本地测试。基础检查用 `kind: baseline`，不可充当业务用例。

当本次目标包含外部配置和真实验收时，Agent 在已有授权内执行，不仅生成待办。实际阻塞记在对应任务/用例及 handoff，写清已完成、缺少的权限或人工动作、恢复位置；没有收件箱访问或平台仍在审核时不能通过该 provider 用例。默认本地模板不能覆盖用户后续已给出的执行范围，明确的禁止部署/仅方案限制仍有效。邮件详细规则见 [执行与人工接力](../../../docs/MAIL.md#agent-执行与人工接力)。

关键决策例子：`{"id":"billing-mode","question":"按次还是订阅？","status":"open","value":"","basis":"context","reason":"用户要求收费但未指定方式","blocking":true}`。已解决时填写值和依据，不把默认猜测记成用户明确要求。

## 进度和验收

- 任务：todo → doing → implemented；阻塞可记 blocked。implemented 要有实际源文件的相对路径。
- 用例：pending → passed / failed / blocked。passed 要有当前项目的报告/截图等文件，且验证类型匹配；路径必须存在且位于本项目内。不要引用底座历史 qa、敏感配置或外部路径。
- 每完成一个可审查里程碑，更新机器记录和 PROJECT.md 的人类交接，记录下一步与尚未解决的问题。更改相关代码/需求后，将相应用例重新置 pending，清掉不再有效的完成声明。
- 执行 `pnpm project:check` 检查格式、依赖选择和证据；`--ready` 还要求初始化步骤完成、无必需待决策项、任务已实现、至少有一项必需业务用例且必需用例均通过。退出码 2 表示无效或未达到 ready。
- 脚本不能判断截图是否证明了业务正确；Agent 必须实际操作和审阅证据。状态通过不代表生产已部署或外部账户已具备资格。

## 中断后继续

先识别当前目录。空目录或只有 Git/说明/编辑器配置时原地初始化；已有 Aster 读记录，用 `project:doctor` 查环境，`project:status` 查下一步。其他已有应用保持原框架和内容，Agent 先检查再增量接入；不能用全量模板覆盖。初始化步骤未完成时执行 `project:resume`；不要再次运行 aster:new 覆盖目标。恢复命令只执行固定的本地依赖安装、setup 和首次格式化，不执行 JSON 里任意命令。依赖指纹变化会触发重新安装，本地 setup 每次幂等运行以确认迁移。

依赖尚未安装时 doctor/resume 仍有无包依赖入口。配置或密钥缺失时停止对应恢复，不重置密钥，不触碰远端。恢复完成后再根据任务状态继续业务代码；交接中的已解决阻塞由 Agent 核实后清理。

外部邮件/Google 接通进度采用可选 `integrations`，旧计划默认空数组。目标、阶段、指纹、精确阻塞及 plan/record/status 命令见 [外部服务断点续做](../../../docs/SERVICE-WORKFLOW.md)。初始化清空传入的外部完成记录；恢复不会继承上游供应商验收。必需集成未完成影响 ready；变更会重置对应认证用例，阶段完成仍须独立记录真实业务验收。

运行能力用 src/config/features.json，模块选择与依据仍在 modules；新增 database/projects/emailPassword 为兼容旧计划的可选选择项。任务/用例可用 module 标记归属，未选模块不计必需验收。初始化、组合预览/应用和发布矩阵见 [能力选择](../../../docs/MODULES.md)。

视觉主题使用 decisions 的 visual-theme=sage|catalog（resolved，保留依据）；初始化器写入 src/config/appearance.json。主题和能力分开，见 docs/THEMES.md。files 的当前边界、配额、失败恢复、导出/注销和云端 files-live 验收见 docs/FILES.md。
