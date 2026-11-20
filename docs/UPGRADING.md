# 已有产品的底座升级

[English](en/UPGRADING.md)

在产品项目中直接调用：

```text
$aster-new 检查当前底座更新，接入适合本项目的改进并完成回归。
保留业务、品牌、页面、数据、个人规则和现有密钥，暂不部署。
```

Agent 读取规则、PROJECT.md、机器计划和实际代码，从用户 Skill 的真实目录定位独立 Aster 源。升级请求包含本地合并与回归；只要求检查/方案时交付扫描报告。Git 提交、外部配置和部署遵循本次实际授权。

## 来源与基线

新产品自动生成 `.aster/baseline.json`：来源版本、源码指纹、上游/初始产品文件的 SHA-256，以及后续逐文件采用记录。没有源码正文、凭据或绝对来源路径，可随产品版本控制，不能从别的产品复制。

源码指纹按允许复制的内容计算，同版本号的未发布修改也可识别。开发数据、私有配置、缓存和生成文件不参与扫描。`starter-version.json` 保留原来源版本，局部模块采用不自动将整个产品标成最新版本。

无基线旧项目进入 `legacy-missing`：不一致或缺失文件都需审查，不猜测原始状态或产品曾删除的文件。合并、实测后才按实际处理路径记录采用，未处理部分继续未知。哈希不保存历史原文；冲突由 Agent 阅读当前产品和上游，必要时查可信历史提交，不假装能从哈希还原旧代码。

## 扫描结果

| 状态                   | 处理                                                       |
| ---------------------- | ---------------------------------------------------------- |
| aligned                | 产品与上游一致，无需复制；来源更新仍需相关回归后记录       |
| unchanged / customized | 上游未变，保留产品当前实现                                 |
| update / add           | 未定制文件更新或基线后的新增文件，可选择带备份复制         |
| conflict               | 两侧变化或历史合并保留了定制，由 Agent 合并                |
| review                 | 依赖、部署、品牌、规则、数据库和迁移等受保护文件，必须审查 |
| deleted-locally        | 保留产品删除，不自动恢复                                   |
| removed-upstream       | 不自动删除产品文件                                         |
| legacy-review          | 缺少可信原始基线，禁止自动覆盖                             |

mail、auth、billing、ui、data、workflow、docs、shared 分类方便选择，但不是依赖图。Agent 仍需检查跨模块 import、词典、类型、部署策略与测试。过去保留的业务定制，下次上游变化时仍进入冲突审查。

## 命令与合并

新产品在自身目录执行：

```bash
pnpm project:upgrade scan --source /path/to/aster
```

旧项目没有新脚本或依赖时，直接从底座源运行：

```bash
node /path/to/aster/scripts/project-upgrade.mjs scan --target /path/to/product --out /tmp/aster-upgrade-plan.json
```

默认 scan 只读，不安装依赖、不启动/停止服务、不连接云端。`--out` 仅用于 scan，显式保存到临时目录或产品 `.local/`；父目录需存在，文件必须尚不存在。源和产品必须是分离目录，不能以另一产品作上游。

Agent 按本次报告选中适用的 update/add 路径；下面仅为路径示意：

```bash
node /path/to/aster/scripts/project-upgrade.mjs apply --target /path/to/product --plan /tmp/aster-upgrade-plan.json --path src/modules/mail/providers.server.ts --path docs/MAIL.md
```

工具重新计算分类、路径、源指纹和产品状态，拒绝过期计划，不信任计划自行声明的覆盖权限。检查软链接父路径和越界；写入前在 `.local/aster-upgrades/<run-id>/` 保存 backup 与 journal，以独占锁拒绝并发写入。文件通过临时文件后重命名替换。复制不执行计划命令、安装依赖或迁移数据库。

中断后检查 journal 和实际文件，不盲目重试或删除备份。异常遗留锁仅在确认没有进行中的操作后移除。一次 apply 选择所有本批路径；复制后产品状态已变，再次 apply 前重新 scan。

conflict、review 和 legacy-review 由 Agent 先在私有目录备份待改文件，再用正常编辑工具合并。保留业务、个人规则、品牌和密钥；共享依赖按需合并，数据库改动生成新迁移，不能覆盖已应用 SQL 或照抄上游部署配置。初始化中断缺基线时也不伪造原始快照。

## 回归与采用记录

重置受影响的业务/供应商验收，无关且仍有效的记录保留。运行实际项目的 lint、typecheck、单元测试与构建；流程变化跑 E2E，认证/环境变化跑隔离生产测试，UI 变化检查真实桌面/手机、语言和主题。真实 provider 验收按已有授权推进；缺少条件保持 pending，不以 mock 代替。

保存本产品脱敏证据后，仅记录实际处理的路径：

```bash
node /path/to/aster/scripts/project-upgrade.mjs record --target /path/to/product --plan /tmp/aster-upgrade-plan.json --path src/modules/mail/providers.server.ts --path docs/MAIL.md --evidence docs/acceptance/mail-upgrade.md
```

record 使用合并前计划，允许产品在合并中变化，但来源指纹和基线不能被并发改变。它只写本批路径的基线/证据引用，不修改业务、任务完成状态或 `starter-version.json`；每批 record 后先重新扫描。路径存在不证明测试真实通过，由 Agent 实际验收。

局部升级在 PROJECT.md 记录采用的模块、来源版本/指纹及暂缓项，不能宣称整版升级。全部相关改进处理、回归后，再由 Agent 审查整体来源记录。初始化、复制和记录分别是不同阶段，均不自动证明业务/供应商完成。

## 回退

自动复制的路径按返回的 run-id 回退：

```bash
node /path/to/aster/scripts/project-upgrade.mjs rollback --target /path/to/product --run <run-id>
```

只恢复仍匹配本次应用哈希的文件；后来被用户编辑的路径列为 conflicts 并保留。新增文件也仅在仍匹配时移除。备份缺失/哈希不符或软链接会停止恢复；检查已恢复的实际结果，不假定全量事务已回滚。

手工合并使用 Agent 事先保存的备份按差异恢复，不用全项目 reset 覆盖其他工作。回退不自动撤销采用记录，Agent 应重新核对基线与验收。工具不操作云资源、已有数据、密钥或 Git 历史；源码回退不等于数据库恢复。
