# 发布维护流程

当前候选为 v0.2.0-beta.1，以无支付产品为首要支持范围。发布说明草案位于 releases/0.2.0-beta.1.md。准备候选不等于已经发布。

## 候选验证

1. 对齐 package.json、starter-version.json、源站点版本、README/安全说明和变更记录；候选保留 upstreamRelease=null，实际发布后再按事实更新。
2. 验证默认无支付体验、showcase 与 web-app 初始化/恢复，确认账单入口及直接 API 关闭；保留实验支付的单元回归和旧产品账务兼容性。
3. 运行 `pnpm check`、`pnpm format:check`、`pnpm test:e2e`、`pnpm test:production`；另运行 `pnpm test:production --profile web-app`、`pnpm test:production --profile showcase`、`pnpm test:production --profile google-only`。认证异常需验证实际 HTTP 路径不泄漏 SQL 参数/哈希/令牌，保留结构化错误日志。计费实验改动再运行 `pnpm test:production --profile creem`。
4. 在新生成产品中运行锁定安装、恢复、构建和实际流程；不能以源目录通过代替。提供商记录只认可当前产品的真实验收。
5. 检查许可与第三方声明、忽略规则、公开文档和候选文件，排除私有 QA、对话、日志、密钥、数据库及缓存。保存可审阅的发布说明与本地验证结果。

## 提交与公开发布

在用户明确要求提交/push/发布后才执行相应操作。提交必须包含所有采用的新源码与迁移；核对该提交的远端 CI，不以旧提交通过替代。tag 与 Release 对应同一通过的提交，不修改已发布 tag 或历史版本内容。

首次公开预览可使用 GitHub Release 的 prerelease 标记。发布说明清楚列出支持的起步组合、实验功能、破坏性变更和采用/迁移方式。尚未完成的检查保持未完成，不预填 tag、提交 SHA 或云端成功状态。

用户可订阅仓库 Release 获得通知；当前 Skill 从独立本地 Aster 源进行升级，不自动联网获取新版。已有产品遵循 UPGRADING.md，不整份覆盖或在运行时静默更新。
