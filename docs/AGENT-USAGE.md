# 开发任务用量统计

[中文](AGENT-USAGE.md) · [English](en/AGENT-USAGE.md)

按初始化、重构、登录接入、升级、功能、修复、设计和文档任务，记录 Agent 开发时的真实用量。这是本地开发工具，与产品内尚未实现的 AI 配额/用量账本独立；不启用 AI、支付、云资源，也不调用模型 API。

## Agent 执行流程

由 Agent 执行这些步骤，用户继续自然描述需求即可；用户不希望统计时跳过。先检查目标目录并保留项目规则。已安装时使用产品内命令，否则使用 `node <真实-aster-源码>/scripts/agent-usage.mjs ... --root <已存在的目标目录>`；不为了统计把其他应用覆盖成 Aster。

1. 执行 `pnpm project:usage list`。遇到上次 `closing` 记录，先 `report --id <id>` 结算。同一目标仍在进行时沿用已开启记录，不要每次对话新建任务；开始不同工作前，按实际结果关闭旧任务。
2. 新目标执行 `begin --kind <类型>`。默认按 `CODEX_THREAD_ID` 精确寻找本地 Codex 会话文件，不能按“最近修改”猜测。无法获取时记录不可用，或使用明确识别的 `--source <绝对-rollout.jsonl-路径> [--thread <id>]`；不得扫描对话正文猜测。缺少来源、权限或受支持数据时不编造数字；首版尚不支持其他 Agent 环境。
3. 在实现前开始记录。目标尚不存在或为空时，先初始化，再立即开始统计，避免统计目录干扰初始化识别；统计窗口包含当前整轮，因此仍包含本轮的初始化和需求分析。没有标记的更早轮次不能补称已实测。底座源码记录自己的任务，不混用客户项目记录。
4. 等待人工处理前可标记 `wait`，恢复后标记 `resume`；确有返工时标记 `rework`。它们是 Agent 标记的时间/次数，不是自动识别模型重试。等待期间仍包含该会话窗口产生的 Token。
5. 最后交接前执行 `close --outcome passed|failed|blocked|incomplete`。`passed` 只是 Agent 报告的任务结果，不代表业务或供应商验收通过。最后回复的用量和该轮结束事件尚未落盘时，记录保持待结算；该轮结束后再次 `report --id <id>`，通常在下一次请求开始时完成。新任务开始时也会尝试结算旧记录；上一轮未结束时拒绝重叠分配。
6. 使用用户的语言给出简短结果，注明实测/部分覆盖/不可用和本地报告位置；不要专门额外调用模型润色统计。遵守读取权限，统计不可用不能阻塞产品开发。

## 命令与本地文件

```bash
pnpm project:usage begin --kind init
pnpm project:usage begin --kind refactor
pnpm project:usage begin --kind auth --phase implementation
pnpm project:usage mark --event wait
pnpm project:usage mark --event resume
pnpm project:usage mark --event rework
pnpm project:usage close --outcome passed
pnpm project:usage report --id <task-id>
pnpm project:usage list
```

以上是不同任务的示例，不是连续开启多个重叠任务。类型为 `init`、`refactor`、`auth`、`upgrade`、`feature`、`fix`、`design`、`docs`、`other`；可选阶段为 `planning`、`implementation`、`configuration`、`acceptance`。阶段标记整个任务，不会自动拆分一轮混合工作；只有实际任务和对话边界分开时，才分别统计登录实现、供应商配置、真实验收。同一项目只允许一个进行中/待结算任务；已完成轮次不能在该项目重复分配。没有跨项目的全局去重，也不会自动合并不同会话。

`--root` 指向已存在的目标，不要求已初始化计划、安装依赖或启动应用。不传 `--id` 时，close/mark/report 选择当前任务；读取已关闭报告需传 ID。`--help` 只读；`list` 列出记录，`report` 更新指定记录并写入报告。旧产品需要审阅后采用两个 `scripts/agent-usage*.mjs` 文件和包命令，或明确运行已有源码中的脚本；更新 Skill 不等于更新产品文件。

私有记录及 JSON/Markdown 可读报告位于 `.local/agent-usage/`。仅保留任务分类、ID、时间、私有检查点中的来源身份/路径、累计计数边界、配置模型/推理强度、产品/工具版本和 Skill 指纹；不保存消息、推理正文、工具输出、凭据或供应商载荷。用于展示的报告文件省略来源绝对路径。不自动上传。该目录必须排除于源码和发布资源之外；工具会创建自行忽略的本地目录，并拒绝使用已被 Git 跟踪的记录。底座复制/升级默认排除 `.local/`。删除此目录只删除本地用量历史，不会删除原始 Codex 日志。进程崩溃遗留的 `lock` 需要检查后再移除，工具不会擅自认定另一个采集进程已退出。

## 统计口径与限制

- **数字计算**：对选中轮次的累计 `input_tokens`、`output_tokens`、`total_tokens` 作差；重复快照不重复相加。缓存输入和推理输出是子集，输入 + 输出 = 总量；缓存写入明细有数据时单独保留，不叠加到总量。缺失的可选明细保持 null。
- **范围**：包含开始和结束的整轮，包括 `begin` 前的分析以及 `close` 后的最终回复；中间轮次全部包含。这是声明的单会话任务窗口，不是 Skill 自身开销、指令的边际 Token，也不能证明节省由 Skill 导致。无关工作应独立任务/会话。其他 Agent、外部模型工具、图片生成和未观察到的重试不在范围内，不能声称覆盖整个账号费用。
- **覆盖程度**：`complete` 表示记录的会话窗口内未发现缺口；`partial` 是带有原因的已观测下限，例如中断、损坏记录、计数重置或明细缺失；`unavailable` 的总量为 null，不伪装成零。缺少起始基线不能拿整段对话累计数代替。来源丢失或无法恢复的旧记录，可明确执行 `abandon --id <id>`，以不完整结果冻结已观测下限；不得补称完整统计。`open`/`closing` 报告仍可能变化；`closed` 后冻结，后续工作不会抬高数字。
- **模型与时间**：记录配置的模型/推理强度，不保证路由后实际服务的模型相同。耗时包含工具和等待；未标记为等待的时间也不是实测 CPU/模型执行时间。返工由 Agent 明确标记。任务结果不会自动把产品验收设为通过。
- **适配方式**：首版读取本地观察到的 Codex rollout 格式：`session_meta`、`task_started`、`turn_context`、`token_count`、`task_complete`/`turn_aborted`。JSONL 适配受版本影响，不是保证不变的公开 API；结束事件缺失会继续待结算，格式不兼容时记录不可用/部分覆盖。[官方 App Server 事件](https://learn.chatgpt.com/docs/app-server#turn-events) 提供 `thread/tokenUsage/updated`；本工具不会连接或控制当前桌面 App Server。
- **费用**：不把订阅用量换算成美元。API 价格估算需要实际模型、供应商、服务档位、缓存规则和有日期的价格，也仍然不是账单；首版不提供价格计算或供应商对比。

比较时应固定相近需求、底座/Skill 版本、模型配置和验收标准，并积累成功与失败样本。验收失败的低 Token 不能算改进。不能凭一次任务发布“一个产品仅需 N Token”，也不能把模拟夹具当真实基准。首版提供单任务报告和本地任务列表，尚无样本中位数、排行榜、预算强制或远程分析。
