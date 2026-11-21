# Aster README · 内容与素材依据

核对日期：2026-10-27（Asia/Shanghai）。GitHub 默认分支固定提交：`d5f0ee8d16ae39e736f4d7f1e0c0fb37ac03ca3a`。本地对应 checkout 的 HEAD 与远端一致，读取指定提交内容，不混入本地未提交修改。

## 事实与边界

| 内容                  | 读取来源                                                   | 本稿取舍                                                            |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| 产品定位与版本        | README.md、package.json、docs/releases/0.2.0-beta.1.md     | 开源 Web 产品底座，当前公开版本为无支付 beta。                      |
| 按需模块和默认值      | src/config/features.json、docs/MODULES.md                  | 源码预览与生成 profile 区分；支付关闭，AI/usage 未接入。            |
| 本地命令与 Agent 使用 | package.json、skills/aster-new/、scripts/install-skill.mjs | 本地命令、初始化与 Skill 安装存在；不重新执行初始化或接管其他项目。 |
| 主题与图片            | docs/THEMES.md、docs/FILES.md                              | Sage/Catalog 与可选图片功能以源码说明为准。                         |

源文档：[原 README](https://github.com/iamwilllee/aster/blob/d5f0ee8d16ae39e736f4d7f1e0c0fb37ac03ca3a/README.md)、[工程清单](https://github.com/iamwilllee/aster/blob/d5f0ee8d16ae39e736f4d7f1e0c0fb37ac03ca3a/package.json)、[版本说明](https://github.com/iamwilllee/aster/blob/d5f0ee8d16ae39e736f4d7f1e0c0fb37ac03ca3a/docs/releases/0.2.0-beta.1.md)。

## 视觉与素材

- 主题：Sage 模块构筑；采用 16:9 满幅概念封面，标题、功能和安装说明保留为原生 Markdown。
- `docs/readme/assets/cover.png`：内置 image_gen 新生成的 AI 概念封面；不是软件 UI 或功能证据。完整提示词保存在根目录 `.readme-design.json`。
- product-path.svg：按源码和模块配置手工绘制的能力结构图。

## 保留内容

原 README 完整保存在 `docs/project-guide.md`，文档导航与维护说明保留。仅调整存档里的相对链接，使其指向固定提交的原位置；已有文档说明复制到本地预览目录。

## 本次验证范围

仅进行文档事实核对、相对链接/图片校验和本地 GFM 渲染检查。未重新运行应用构建、业务测试、云端部署或供应商验收；不将仓库历史记录写成这次重新完成的验收。制稿阶段仅保存在工作台，未替换原仓库 README。

## 采用与发布

2026-10-28：用户已在工作台采用本稿，并明确授权提交、push。本次发布范围仅为 README、原说明存档与展示素材；原应用代码和已有开发文档保持不变。
