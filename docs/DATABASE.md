# 本地、预发布与正式数据库

[English](en/DATABASE.md)

日常开发使用电脑上的本地 D1，正式站使用远端 D1；只有需要在线联调/验收时才另建 staging 库。它们共享版本控制中的迁移 SQL，各自保存数据和迁移执行记录。无需为了本地测试额外购买数据库，也不把本地账户、会话或测试数据上传正式站。关闭 database 的展示站跳过以下流程。

## 给 Agent 的入口

```text
$aster-new 检查当前项目的数据库发布准备，保留已有数据与环境隔离。
先核对目标、SQL 兼容性、费用和恢复方案，完成本地检查；暂不操作远端。
```

明确授权远端迁移后，Agent 按本页执行配置检查、备份、迁移和验证；不要在列出命令后把可执行工作交回用户。只要求方案/禁止部署时，不执行远端迁移，也不将 staging 当成例外。计划文件、过去的发布记录或一次 Skill 调用都不是新的远端授权。创建云库、部署 Worker、迁移和覆盖恢复是不同操作，按当前用户范围执行。

## 日常开发

1. 修改 `src/db/schema.ts`，执行 `pnpm db:generate`，审阅新 SQL。已应用的迁移不改写。
2. 执行 `pnpm db:migrate`：读取根 DB 的实际名称，用显式 `--local` 应用迁移，状态仍在本项目 `.wrangler/state/`；不再写死示例数据库名。
3. 验证本地业务、跨账户隔离、刷新后持久化及失败状态。

`setup` 继续调用这个本地入口。它拒绝根 DB 的 `remote:true`，忽略外部 `CLOUDFLARE_ENV`，不会因当前终端选了 staging 而迁移线上库。根配置中的正式 ID 只是本地模拟的标识，不会因为 ID 存在就连接远端。不要给开发 DB 开 `remote:true`，也不要用 `--remote` 代替本地测试。

已有 `preview_database_id` 时保留 Wrangler 的本地标识规则；没有时本地模拟使用 database_id。变更这些标识可能让 Wrangler 打开另一个本地库，旧数据仍在原文件，不等于迁移上云。配置正式 ID 前先记录现有标识并按需要私下备份本地数据；不要为解决本地标识变化而上传测试库到 production。

## 指定环境发布迁移

先读取 [费用策略](COSTS.md) 与 [部署手册](DEPLOYMENT.md)。确认目标账户、Worker、实际 DB 名/ID、既有数据和权限；staging 与 production 的 ID 必须不同。本工具不创建数据库、不更改套餐、不设置密钥、不部署 Worker。

```bash
# 仅在本地固定目标、SQL 文件及其哈希，返回 release-id；不连接 Cloudflare
pnpm project:database plan --env staging

# 只读查询远端迁移历史及完整性；有待迁移时退出码 2
pnpm project:database check --env staging

# 已授权该环境的迁移后：备份 → 迁移 → 复查
pnpm project:database apply --env staging --id <release-id>

# 本地进度，不接触远端
pnpm project:database status --env staging
```

production 使用相同命令，但必须显式写 `--env production`，重新生成正式环境自己的 release-id。数据库命令不会默认选择 production。正式部署命令仍为 `pnpm deploy`，staging 为 `pnpm run deploy --env staging`。

已有产品若使用 `env.production`，数据库工具优先选择该命名环境，所有远端命令与恢复方案显式带 `--env production`；本地迁移仍使用根 DB，不将根本地库当作正式库。沿用产品自己的部署入口，不覆盖其环境布局；增量接入时把数据库只读 preflight 合并到原发布脚本。底座默认部署脚本仍采用根 production / env.staging 的布局。

本地计划列出全部迁移及需注意的 SQL 标记；它不能知道远端还有哪些没执行。`check` 和 `apply` 对比实际远端历史，拒绝未知文件、顺序分歧或本地已记录执行后的 SQL 内容变化。首次接入旧库只能核对历史文件名，D1 自带迁移表没有 SQL 内容哈希，不能据此证明历史 SQL 完全一致；由 Agent 审查可信版本。已有业务表却没有迁移历史的库需要单独的基线方案，工具不自动认领。当前仅支持现有 Drizzle 的顶层编号 SQL 布局，自定义 glob/嵌套迁移需另行接入，不能静默漏文件。

`check` 直接执行只读 SELECT/PRAGMA，不调用会初始化迁移表的 `wrangler d1 migrations list`。新建空库也可检查，不会因检查而建表。`quick_check` / `foreign_key_check` 不证明业务或供应商正确；大库检查、导出和迁移可能耗时、暂停服务或触及账户用量，先评估实际规模与窗口。

### apply 自动做什么

- 固定当前环境、账户标识（已配置时）、DB ID 与迁移哈希；拒绝过期计划、快照篡改和软链接路径。使用专用最小 Wrangler 配置，不沿用 Vite 构建生成的部署重定向。
- 重新读取远端已执行历史，只迁移仍待执行的文件；不使用本地 D1 数据文件。
- 有迁移时先获取 Time Travel bookmark，再导出完整远端 SQL。备份非空且保存成功后才迁移；失败即停止，不跳过保护继续。
- 应用后重新读取历史，要求零待执行，再检查数据库完整性与外键。记录真实执行阶段，但不会替产品通过登录、CRUD、邮件或支付用例。

记录、固定 SQL 与备份在 `.local/database-releases/<release-id>/`，已被 Git 和初始化器排除。目录权限 0700、文件 0600。备份包含真实账户、散列和令牌等私有数据，只在受控电脑/私有备份存储保管，不上传仓库、聊天或公开验收附件。子进程输出和 Wrangler 调试落盘关闭，避免导出签名 URL 或 SQL 行泄露。

工具不会自动协调多个电脑/流水线的发布。迁移前后两次历史核对与本地进程锁不能替代维护窗口或远端全局锁；同一库由一个操作者发布。线上仍有写入时，导出、bookmark 和迁移不是一个跨命令事务。破坏性变更优先采用先加字段/表 → 兼容读写 → 数据回填 → 切换代码 → 后续版本删旧结构。Agent 必须评估旧 Worker 在迁移后继续运行是否兼容；备份不使破坏性 SQL 自动安全。

## 中断后继续

先 `status`，再核实远端当前状态和原授权仍适用；用相同 release-id 执行 apply。每次都会检查真实历史，不按本地“完成”字样盲目跳步。如果上一轮部分迁移已成功，会先保留原备份、再为剩余迁移创建新备份。没有待迁移时只复核历史与完整性，不重放 SQL。

配置/SQL 已变化就重新 plan；历史已执行 SQL 的变化应生成新迁移，不能靠重新 plan 绕过。`failedPhase` 标明中断环节；若失败在迁移或验证阶段，先评估已发生的变化与业务状态。已经退回旧历史的远端也需要人工核对，不能自动认定可继续。

进程被强制结束可能遗留锁。确认原进程停止后运行 `pnpm project:database unlock`；它只清理本机已不存在的锁拥有进程，不解开仍活动或其他主机的锁。不自动终止服务。

## 恢复方案与上线检查

```bash
# 只生成恢复点、备份校验和和精确命令参数；不执行覆盖恢复
pnpm project:database recovery --env staging --id <release-id>
```

恢复点来自每次实际备份，不编造可用 bookmark。执行前核对当前账户套餐的保留窗口和远端可用性，并保护恢复点之后的新数据。Time Travel 覆盖库内这段时间的写入，应先暂停/协调写入、备份现状、核对 Worker/schema 兼容性与待恢复范围，在获准的具体恢复范围内执行命令。若需从 SQL 备份恢复，先在独立目标演练，再制定切换方案；不能向已有正式库直接导入备份当作安全 undo。Worker 回滚与数据库恢复分别处理。

恢复后重新 check、核对迁移记录、执行产品业务回归，再决定发布兼容代码或生成新迁移。不要把旧的 verified 或供应商验收当成恢复后的证据。工具不自动执行 down migration、不在迁移失败后覆盖回退，以免丢弃已产生的新数据。

实际 `deploy` 在构建前、构建后发布前只读检查所选 DB 的历史与完整性；待迁移、历史分歧、不可访问或完整性失败都会阻止发布。`deploy:check` 仍为纯本地配置检查，不连接云端，也不证明远端迁移已完成。迁移与发布分开便于审阅权限、失败恢复与维护窗口；完成数据库检查后还需实际页面/API、会话与所选供应商验收。

已有产品先按 [升级指南](UPGRADING.md) 合并这两个脚本、package 命令、部署检查及文档；保留自己的 wrangler 配置、schema 和全部已应用迁移。新 Skill 的链接更新不代表旧产品已安装这些能力。

核验依据（2026-10-24）：[D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)、[Wrangler D1 命令](https://developers.cloudflare.com/d1/wrangler-commands/)、[支持的 PRAGMA](https://developers.cloudflare.com/d1/sql-api/sql-statements/)、[Time Travel 与覆盖恢复](https://developers.cloudflare.com/d1/reference/time-travel/)。实际保留窗口与账户限制以当前套餐为准。
