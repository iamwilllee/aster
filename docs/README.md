# Aster 文档

[中文站文档](https://aster.iamwilllee.com/zh/docs) · [English docs](en/README.md)

Skill 与执行参考统一用英文维护；对话、产品需求和人工交接仍跟随用户语言。原 docs/ 中文路径保持兼容，英文对应文件位于 docs/en/。两个语言站点使用同一份主题目录，跳转到相应语言文档。

这里是当前源码的开发指南。已发布的 v0.2.0-beta.1 仍是可复现起点，较新的规范可能先于下一次源码发版；采用前核对 [版本范围](releases/0.2.0-beta.1.md)。

- 开始：[Agent 指南](AGENT-GUIDE.md)、[能力选择](MODULES.md)、[开发手册](DEVELOPMENT.md)、[需求模板](templates/PROJECT-BRIEF.md)。
- 设计：[前端](FRONTEND.md)、[页面蓝图](PAGE-BLUEPRINTS.md)、[主题](THEMES.md)、[品牌](BRAND.md)、[图标流程](BRAND-WORKFLOW.md)。
- 账号与内容：[账号安全](ACCOUNT-SECURITY.md)、[生命周期](ACCOUNT-LIFECYCLE.md)、[管理后台](ADMIN.md)、[私有图片](FILES.md)、[内容管理](CONTENT.md)。
- 上云：[架构](CLOUDFLARE.md)、[成本](COSTS.md)、[邮件](MAIL.md)、[外部配置续做](SERVICE-WORKFLOW.md)、[数据库](DATABASE.md)、[部署](DEPLOYMENT.md)、[支付](PAYMENTS.md)。
- 维护：[升级](UPGRADING.md)、[发版](RELEASING.md)。

## 双语维护约定

对应文件保持相同名称、技术标识、命令和安全边界。行为变化时同步更新两种语言，新公开主题加入 docs/catalog.json。docs:check 检查覆盖、来源指纹、链接及锚点，不证明译文质量或供应商真实可用。翻译需人工语义审阅，尤其保留授权范围、不可逆变更、支付 TEST ONLY 及本地/模拟/真实证据的区别。

- 开发效率：[任务用量统计](AGENT-USAGE.md)。
