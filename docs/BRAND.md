# Aster 品牌

[English](en/BRAND.md)

**给 Agent 一个可靠的起点。**

Aster 是面向 AI Agent 的开源产品底座，基于 TanStack Start 与 Cloudflare。英文介绍：An open-source product foundation for AI agents, built on TanStack Start and Cloudflare.

![Aster](../public/brand/aster-logo.svg)

## Logo

六瓣星形围绕留白中心展开，结合花朵与星芒的形态，表达从一个起点生长出产品。默认使用森林绿底与浅色图形；小尺寸图标保留完整六瓣，不附带文字。

- [浅色组合标志](../public/brand/aster-logo.svg)
- [深色组合标志](../public/brand/aster-logo-dark.svg)
- [应用图标](../public/brand/aster-icon.svg) · [透明底单色图形](../public/brand/aster-symbol.svg)
- [favicon](../public/favicon.svg)

矢量素材可直接编辑，随仓库以 MIT 许可提供。品牌主色为 `#236b4b`，浅色为 `#eff6e9`。保持宽高比例，图形周围至少留出自身宽度四分之一的空间。界面中的品牌标志引用应用图标，文字使用项目字体。

## 命名与兼容

产品名使用 **Aster**，GitHub 仓库使用 `iamwilllee/aster`。Skill 使用 `$aster-new`，初始化命令使用 `pnpm aster:new`。

`starter:new` 是兼容命令。`starter-version.json`、`starter.project.json`、`starter-db`、内部协议头和主题存储键保留原标识，避免影响已有产品的数据与恢复流程；它们不是对外品牌名。已有 README 时，新的初始化说明写入 `ASTER.md`。

新产品通过 `src/config/site.ts` 修改名称与描述，通过 `src/config/brand.json` 配置导航图标、可选深色图标、favicon 与按需主屏图标。资源放在 `public/`，默认 Aster 素材只是占位；按 [产品图标流程](BRAND-WORKFLOW.md) 根据上下文完成设计、接入和实际验收。保留底座版本与开源许可。
