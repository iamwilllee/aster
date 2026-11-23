先按 [能力选择](MODULES.md) 确认需要的绑定。纯展示站无需 D1 或认证密钥，所选模块才进入对应的配置与验收步骤。

[English](en/CLOUDFLARE.md)

# Cloudflare 架构

Aster 使用 TanStack Start / React / Vite，由 Cloudflare Workers 承载 SSR、服务端函数和 HTTP API。Drizzle 管理 D1 schema 与迁移。

| 能力                | 当前实现                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| Web、API 与静态资源 | Workers + Cloudflare Vite plugin                                       |
| 数据                | D1：用户、会话、私有项目、限流与测试订阅状态                           |
| 邮件                | 本地收件箱；Cloudflare / Brevo / Resend 适配，需独立配置与真实投递验收 |
| 文件                | 可选私有图片与网站封面；新产品按需启用 files                           |
| AI、队列与定时任务  | 尚未接入，按具体产品需求增加                                           |

## 隔离与一致性

每个产品独立配置 Worker、D1、域名和密钥；本地使用自身目录的 `.wrangler`，不复制源模板的开发数据。预发布与生产使用独立环境配置。数据库配置名 `starter-db` 为兼容标识，不代表多个产品共用数据库。

Cloudflare bindings 仅从服务端模块导入。认证按请求构建，私有 SQL 限定当前用户。项目上限通过原子条件写入保证；测试支付事件验签、去重并以提供商当前状态同步，不能依赖成功跳转或进程内变量授予权益。

KV 不能作为余额、权限或锁的唯一权威来源。图片业务保持所属用户、访问控制与失败恢复边界，详见 [图片指南](FILES.md)。

## 成本与部署

默认免费优先：本地 → Workers Free + D1 数据验证 → 独立选择邮件并验收登录 → 有实际需求后升级。底座和新产品默认都不绑定未使用的 R2 或发信资源。CF 任意收件人发信需要 Paid，不应据此让纯 Web/数据部署默认付费。完整分项费用、免费档 CPU 等限制、升级条件与机器记录见 [免费起步与按需升级](COSTS.md)。

实际用量、套餐和资格以账户及官方文档为准；多个项目需汇总账户成本。动态请求、CPU、D1 扫描行数、存储、邮件与模型调用分别评估，不能只凭免费请求数判断正式业务容量。

邮件优先用户指定或已接通服务；无既有选择且已有适用的 Workers Paid 时默认优先 CF，否则按偏好和现有环境选择 Brevo / Resend。配置、迁移与验收见 [邮件指南](MAIL.md)。

- [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定价](https://developers.cloudflare.com/r2/pricing/)
- [Email Service](https://developers.cloudflare.com/email-service/)

本地模拟不代表云端能力或真实供应商已通过。部署、资源配置与远端验收步骤见 [部署手册](DEPLOYMENT.md)。
