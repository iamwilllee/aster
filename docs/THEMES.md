# Sage 与 Catalog 视觉主题

Aster 共用 shadcn/ui base-nova（Base UI）组件，提供两套产品视觉主题。base-nova 是组件风格；Sage / Catalog 是本项目的主题名。两者都支持英文/中文、浅色/深色和手机布局，不增加组件框架或云服务。

| 主题           | 视觉方向                                                         | 常见用途                           |
| -------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `sage`（默认） | 系统 UI 字体、绿色强调、柔和灰底、适度圆角、清晰的操作与数据层级 | 工具、SaaS、会员工作台             |
| `catalog`      | 中性黑白、Arial 排版、大留白、图像优先、轻边框与胶囊操作         | 商品目录、售卖展示、作品集、内容站 |

Catalog 采用留白、黑白排版与图像目录，并非 IKEA 官方主题，不包含其标志、商品图或代码。用途是选择建议，不限制产品类型。主题不会自动实现商品后台、购物车、订单、物流或支付；真实售卖需按业务另行实现并验收。当前商品蓝图中的插画、商品和价格均为虚构样例。

两套默认主题都不依赖外部字体服务。Sage 使用系统 UI 字体栈；Catalog 保留 Arial 优先的设计选择，缺少时按字体栈回退。品牌字体需实际加载，不能只声明名称。字号、字重、中文/英文标题字距及真实字体检查见 [字体与阅读清晰度](FRONTEND.md#字体与阅读清晰度)。

## 让 Agent 选择

可以直接说：

```text
$aster-new 做一个小商品展示站，使用 Catalog 主题。
先展示商品与详情，暂不接订单、支付或登录。
```

Agent 先读已有项目与品牌，记录 PROJECT.md 的视觉方向、主要动作和页面组合；在 starter.project.json 的 decisions 中记录 `visual-theme`，value 为 `sage` 或 `catalog`，并保留 user/context/default 依据。初始化器消费该已解决决策，写入 `src/config/appearance.json`；没有选择时使用 Sage，不继承源项目的主题状态。

```json
{
  "decisions": [
    {
      "id": "visual-theme",
      "question": "产品视觉主题",
      "status": "resolved",
      "value": "catalog",
      "basis": "user",
      "reason": "用户希望使用中性商品目录风格",
      "blocking": false
    }
  ]
}
```

将这项合并进需求 plan 后通过 `pnpm aster:new ../my-site --plan /tmp/product-plan.json` 初始化。不要覆盖已有项目的其他决策。已有产品由 Agent 修改 appearance.json 并同步产品记录，重跑相关验收；主题修改无需数据库迁移，不覆盖业务样式或品牌资产。

## 本地比较与正式选择

`/dev/blueprints` 顶部可预览两套主题和四类页面。也可打开：

- `/dev/blueprints?kind=workbench&_style=sage`
- `/dev/blueprints?kind=shop&_style=catalog`

预览只使用 URL 参数，不修改项目文件；导航保留当前预览。`_style` 仅在匹配的本地开发来源生效，预发布/生产忽略它并使用 appearance.json；本地蓝图页在远端返回 404。正式主题在服务端渲染时写入 html 的 `data-visual-theme`，避免先显示另一套视觉再切换。用户的浅/深色偏好仍由已有切换器与 localStorage 保存，和产品主题分开。

颜色、字体和圆角集中在 `src/styles.css`，共享控件通过 `--control-radius` 适配。单行控件仍保持 32/36/44px，不在页面覆写尺寸。多行输入保持适合文本编辑的圆角。布局来自页面组合，不能只改颜色就声称完成产品设计。更改后检查桌面/手机、浅深色、中英、键盘与真实交互；规则见 [前端约定](FRONTEND.md) 和 [页面蓝图](PAGE-BLUEPRINTS.md)。
