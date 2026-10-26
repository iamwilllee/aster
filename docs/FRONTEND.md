# 前端约定

Aster 使用 React、TanStack Router / Query、Tailwind CSS、shadcn/ui base-nova（Base UI）与 Lucide。复用现有组件和主题，不为同一种能力同时引入多套方案。

## 组件与品牌

- `src/components/ui/` 保存可维护的基础组件源码；通用页面组件位于 `src/components/common.tsx`。
- `src/styles.css` 管理颜色、圆角、字体和深浅主题；品牌名称与描述位于 `src/config/site.ts`。
- Logo、favicon 与使用说明见 [品牌文档](BRAND.md)。业务图标统一使用 Lucide，品牌图形独立管理。
- 常规布局使用 CSS Grid / Flex；基础入场动效复用 RevealGroup 与 CSS，可拖动面板、拖拽和复杂状态/动画库按实际业务需要添加。

## 组件样板

启动本地开发服务后访问 `/dev/ui` 或 `/zh/dev/ui`。三个分类分别展示基础组件、可交互页面组合与视觉排版方向：

- 基础组件：三档尺寸、表单/禁用/错误、弹窗内 Select，以及 Checkbox、Switch、DropdownMenu、Tooltip 和 Toast。
- 页面组合：搜索、表格分页、详情弹窗、分组设置，以及可切换的加载/空态/错误重试。7 条虚构记录用于本地交互演示。
- 视觉方向：工具型紧凑布局、阅读型排版与可重播入场动效；与 Sage / Catalog 产品视觉主题分开。

示例只维护当前页面的临时状态，刷新即重置，不创建项目或调用提供商。该页在预发布/生产及非匹配回环来源返回 404。

新增或调整公共组件后先更新样板，再检查桌面/手机、深浅主题、键盘焦点和实际渲染尺寸。新增 Base UI 子路径时同时维护 `vite.config.ts` 中客户端/SSR 的预打包列表，验证首次路由加载与水合。

Button、Input、Select、Textarea、Checkbox、Switch 和 TabsTrigger 在水合完成前保持禁用，避免首个操作或输入丢失。语言切换会重新加载页面，必须保留这层保护；测试用延迟脚本加载验证 SSR 与就绪后的行为，不靠固定等待掩盖问题。CI 失败附件包含 HTML 报告、截图与 trace，均使用隔离测试数据。

## 从产品需求确定界面

底座源目录用根目录 PROJECT.md 区分生成产品，维护底座本身的界面时将设计记录放在私有 `.local/PROJECT.md`，保留该识别保护。产品开发先在 `PROJECT.md` 的“界面与内容”写明用户与主要操作、视觉参考或推导依据、信息密度、页面组合及品牌方向。用户已有品牌/界面时优先延续；没有参考时从场景推导，不例行追加一轮设计问卷。

高频操作工具优先清晰导航、可扫描列表和明确操作；内容型产品优先阅读顺序、字体层级和留白。根据内容选择结构，不让每页都变成标题加卡片。当前绿色、侧栏和示例业务不是强制品牌。品牌色和字体通过 `src/styles.css` 管理，深浅主题成对调整，页面不写零散品牌色。视觉示例不宣称不存在的功能、客户或指标。

## 产品视觉主题

`src/config/appearance.json` 选择 Sage（当前绿色工具风格）或 Catalog（中性商品目录风格）。共用同一组件层与尺寸规范，均有深浅色；本地蓝图可预览，生产不接受 URL 改主题。完整配置与 Agent 用法见 [主题指南](THEMES.md)。

## 字体与阅读清晰度

字体在 `src/styles.css` 的 `--type-family` 集中设置。Sage 默认先用 `system-ui`，让 macOS、Windows、Android 等使用各自可用的 UI 字体；Catalog 有意优先 Arial，再回退到系统可用字体。中文由相应系统字体承接。默认没有远程字体请求，也不承诺不同操作系统像素完全一致。

品牌明确选择 Inter 等字体时，需要实际提供有许可的字体文件或明确的加载源，以 `@font-face` 声明正确的字重、样式和 `font-display`，并验证请求成功、真实使用和回退表现。只写 `font-family: Inter` 不代表已加载；也不能凭 `getComputedStyle().fontFamily` 或单独一次 `document.fonts.check()` 判断字体真实命中。可用浏览器的 Rendered Fonts 或 `CSS.getPlatformFontsForNode` 检查，确认英文没有意外落到中文字体；纯中文正常使用中文系统字体。

| 场景               | 默认建议                     | 边界                                                     |
| ------------------ | ---------------------------- | -------------------------------------------------------- |
| 官网首屏、阅读说明 | 正文 16–18px，行高约 1.6–1.8 | 不把承载主要信息的段落缩为 12–14px                       |
| 紧凑工作台         | 正文 14–16px                 | 保留控件 32/36/44px 及既有字号契约                       |
| 元信息、辅助标签   | 12–14px，确保当前主题下可读  | 更小的装饰性编号不能承载关键操作或说明                   |
| 无衬线标题         | 按层级使用 600/700           | 英文大标题适度收紧；示例首屏为 -0.03em，中文保持正常字距 |

这些是新页面的起点，已有品牌和明确的编辑式衬线设计优先保留，不全站强制加粗。正文保留正常字重，重点靠层级区分。不要用全局缩放、文字阴影、描边、模糊或强制 GPU 图层伪装字体清晰度。现有 `antialiased` 仅是渲染偏好，不是修复任意锯齿的开关。

验收时等字体和样式就绪，在浏览器 100% 缩放下检查英文/中文、桌面/手机、两套主题及浅深色，关注真实字体、长标题换行、表单和表格几何、正文可读性。截图要等有限动画/颜色过渡结束并保留原始像素；压缩或缩放后的图片不能单独证明页面存在锯齿。已有产品采用此改动需按 UPGRADING.md 增量合并，不覆盖业务字体或仅更新 Skill 就宣称已修复线上。

## 页面动效

官网默认采用轻量、有限的动效：首屏标题 → 说明 → 主要操作 → 展示依次入场，下方内容首次进入视口时出现。后台表单、密集列表与高频操作不默认加入入场等待。Sage 使用 560ms / 70ms 分组间隔，Catalog 更克制（480ms / 50ms）；手机降低位移和时长。品牌可在 styles.css 调整统一变量，不在各页散写时间。

复用 `src/components/ui/reveal.tsx` 的 RevealGroup，保留现有 Grid/Flex 与标题、列表、链接语义。它渲染 div；不能替代 ol/li 或给控件加额外几何样式。

```tsx
<RevealGroup className="grid gap-6">
  <h1 data-reveal="enter">Product title</h1>
  <p data-reveal="enter" data-reveal-step="1">
    What it does.
  </p>
  <article data-reveal="scroll">More information.</article>
</RevealGroup>
```

`enter` 由 CSS 执行，支持 0–4 档 data-reveal-step；`scroll` 由 Observer 渐进增强，只预先隐藏挂载时仍在视口下方的内容，一次出现后不重复。已有可见内容不闪回隐藏；新动态节点默认直接显示，需要独立入场时挂载新的组。不逐个字拆标题，不动画化行高/宽高，不模糊或缩放正文；动画结束后不保留 transform / will-change。`motion-hover` 提供桌面轻微阴影反馈，不暗示未连接的操作。

系统减少动态效果时直接显示内容；用户切换偏好立即解除待出现状态。无脚本或 Observer 不可用/初始化失败时，内容仍可读。键盘焦点进入待出现区块时立即显示，不等动画完成。不要把操作是否可用、权限、加载或错误状态绑到动画结束事件。无需为基础动效引入新依赖；复杂业务编排再按需选型。

本地 `/dev/ui` 的视觉方向包含可重播样例，产品与商品蓝图也展示入场/滚动效果。验收实际动画开始、渐次顺序、结束后的清晰文字、滚动仅一次、键盘、减少动态效果与无脚本降级；覆盖两套主题、语言、浅深色和手机。静态截图需等待有限动画结束；静态截图或关闭动画的测试不能单独证明动效已验收。

## 完整页面蓝图

完整用户流程与内容规划见 [页面蓝图](PAGE-BLUEPRINTS.md)。本地 `/dev/blueprints` 提供产品官网、目录阅读、商品目录和数据工作台四类可交互组合；从 `/dev/ui` 也可进入。所有品牌与条目均为虚构，内存编辑刷新即重置；入口在预发布/生产关闭。可单独复用 `patterns/content-patterns.tsx` 的功能说明、步骤与 FAQ，以及 `ui/disclosure.tsx` 的键盘/SSR 原生展开行为。采用到产品时接真实内容、路由与数据，不继承演示状态或验收声明。

## 组合与组件索引

| 需求               | 复用入口                                                   | 使用边界                                                         |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| 页面入场与滚动出现 | `RevealGroup`，`ui/reveal.tsx`                             | 官网按阅读顺序分组；尊重减少动态效果、键盘和无脚本降级           |
| 搜索与筛选工具栏   | `ListToolbar`，`src/components/patterns/page-patterns.tsx` | search/filters/actions 插槽，URL 状态仍归业务页管理              |
| 列表加载与无结果   | `ListSkeleton`、`EmptyState`，同上                         | 区分首次空数据与筛选无结果；错误用 ErrorNotice + 重试            |
| 分组设置           | `SettingsSection`，同上                                    | 标题说明与内容分栏，手机纵向；每个 id 唯一                       |
| 详情属性           | `DetailList` + Dialog，同上                                | 长文本可换行；弹窗可滚动，保持标题与描述                         |
| 分页               | `Pagination`，同上                                         | 受控、从 1 开始；调用者限制 page/pageCount，筛选变化重置页码     |
| 语义表格           | `ui/table.tsx`                                             | 保留 caption/th 语义，窄屏在表格内横向滚动，不撑开整页           |
| 同页内容分组       | `ui/tabs.tsx`                                              | Tabs / TabsList / TabsTrigger / TabsContent；导航路由用 Link     |
| 操作菜单           | `ui/dropdown-menu.tsx`                                     | Trigger 用 `render={<Button ... />}`，危险项单独分组并确认       |
| 勾选和开关         | `ui/checkbox.tsx`、`ui/switch.tsx`                         | Label 关联或包裹控件；name 提交表单，checked 管理受控状态        |
| 补充说明           | `ui/tooltip.tsx`                                           | Trigger 用 Button，始终保留 aria-label；关键信息不能只藏在提示里 |
| 操作反馈           | `ui/use-toast.ts` 的 `useToast()`                          | 全局 Provider 已安装；成功后提示，表单错误仍留在字段附近         |

项目列表示范卡片/表格切换、菜单、详情与 URL 状态；账户设置示范 SettingsSection。两者均使用实际账户数据，开发样板的虚构内容不混入业务记录。

示例项目 API 最多返回 100 条，当前套餐最多允许 50 条，所以页面对完整返回结果每页 6 条分页。扩大业务规模时一起增加服务端分页、过滤与 total；不能用当前页的长度冒充全库数量。

```tsx
const toast = useToast()
// 在服务端确认保存成功后调用，不把请求发出当成成功。
toast.add({ title: t('project_saved'), type: 'success' })

<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="outline" />}>Actions</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={openDetails}>View details</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Toast 和 Tooltip Provider 随 React 树创建，SSR 不使用全局可变 manager。Toast 默认 5 秒、最多展示 3 条，支持关闭；不能用短暂通知替代需要用户处理的持久错误。Tabs、Checkbox、Switch 的几何尺寸也由组件层管理，业务层只调整布局。

Tabs 默认手动激活：方向键移动焦点，Enter/Space 切换面板；需要自动切换时显式设置 TabsList 的 `activateOnFocus`。Tooltip 在键盘焦点或悬停时显示，程序调用 focus 不等同于键盘导航。表单输入和操作按钮在水合前禁用，避免首屏尚未接管时输入丢失或发生原生提交。

FAQ 复用 `patterns/content-patterns.tsx` 的 FaqList；底层 `ui/disclosure.tsx` 使用原生 details/summary，支持 SSR、Enter/Space 与展开语义，不新增折叠面板依赖。

## 控件与尺寸契约

业务页面从 `@/components/ui/` 导入 Button、Input、Select 与 Textarea。Select 使用 Base UI 的可访问弹层，统一触发器、选项、焦点与主题；不能用页面里的原生 `<select>` 代替。组件底层最终渲染原生 DOM 是正常行为，限制针对业务层绕过封装。

| 档位      | 单行高度 | 用途               |
| --------- | -------- | ------------------ |
| `sm`      | 32px     | 紧凑工具栏         |
| `default` | 36px     | 默认表单与筛选     |
| `lg`      | 44px     | 突出操作与触摸场景 |

Button、Input、SelectTrigger 使用相同的 `size` 属性；图标按钮对应 `icon-sm`、`icon`、`icon-lg`。尺寸源是 `src/styles.css` 的 `--control-sm/md/lg` 与 `src/components/ui/control.ts`，同一行的单行控件选同一档。字段容器使用 `grid gap-2`，避免 Base UI 的隐藏表单输入被 `space-y-*` 计入尾部间距；Input/Textarea 使用块级显示，避免行内基线空隙。控件文字在桌面为 14px、手机为 16px；Textarea 为多行输入，默认三行、最小 96px，不套用单行高度。

```tsx
<Input size="default" aria-label="Search" className="w-full" />
<Button size="default">Search</Button>
```

Select 在 Root 的 `items` 中提供标签映射，使受控值、初次渲染与翻译一致；`name` 放在 Root 以参与 FormData，标签关联 Trigger。普通固定选项使用 Select，长列表搜索能力需另加合适的组件。

```tsx
<Label htmlFor="status">Status</Label>
<Select name="status" defaultValue="idea" items={{ idea: 'Idea', live: 'Live' }}>
  <SelectTrigger id="status">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="idea">Idea</SelectItem>
    <SelectItem value="live">Live</SelectItem>
  </SelectContent>
</Select>
```

页面的 className 负责宽度、定位、外部间距等布局；控件高度、纵向内边距、字号、圆角由组件决定。改全站密度时调整 tokens，新增视觉用途时在 UI 层增加 variant。按钮式 Link 复用 `buttonVariants({ variant: 'outline', size: 'default' })`，保留真正的链接语义；普通文本链接与导航按各自语义设计。Input 的原生字符宽度参数改用 `htmlSize`。

`pnpm lint`（已包含在 `pnpm check`）拒绝业务 TSX 的原生 button/input/select/textarea、直接 Base UI 导入，以及共享控件的高度、字号、圆角和纵向内边距覆盖。规则支持导入别名、响应式 class、cn/clsx 与有限条件表达式；无法判断的动态控件 className/style 要移到 UI 层维护。全屏关闭遮罩等特殊交互可用带原因的单行例外，不能整文件豁免。静态规则不能代替浏览器布局、键盘和焦点验收，也不能保证任意全局 CSS 不改变组件。

## 状态归属

| 状态                         | 归属                          |
| ---------------------------- | ----------------------------- |
| 搜索、筛选、分页与可分享状态 | 校验后的 URL 参数             |
| 服务端记录与异步缓存         | Route loader / TanStack Query |
| 表单、弹窗、局部交互         | React 组件状态                |
| 会话与权限、订阅权益         | 服务端认证与数据库            |

避免同时维护多个权威数据副本。SSR 的缓存与语言按请求隔离；退出账户后清理私有客户端状态。保存结果以服务端返回为准。

## 公开页面文案

交付产品前逐页清理开发残留：未经产品明确选择的“早期预览 / EARLY PREVIEW”横条、测试账号/数据、占位说明、示例套餐与框架宣传不进入正式业务页面。页面标题、按钮、状态和页脚使用当前产品的真实表达，不把云端发布状态写成“本地发布”。保留产品有意采用且有依据的 Beta 标识、内容试读与私有编辑预览，不能机械删除所有 preview 字样。

功能尚不可用时隐藏对应入口，或在相关操作旁说明“暂未开放付款 / 暂不支持预约”等用户可理解的状态；不以删除提示来冒充功能已接通。开发样板与测试支付仍留在其原有隔离范围，保留演示/测试标识，不能把虚构内容改名后搬到产品。检查当前项目的最终渲染内容；更新 Skill 不等于已清理使用底座的站点。

## 页面验收

每个业务页面处理加载、空数据、错误重试、禁用和成功状态；检查键盘操作、焦点、可访问名称、手机布局与深浅主题。保存后刷新验证恢复结果，不能只凭构建或截图判断业务通过。

英文默认，中文 URL 使用 `/zh`；新增界面文案维护 `src/i18n/en.json` 与 `zh.json` 并执行 `pnpm locale:check`。供应商错误通过已有公共错误映射展示，不直接输出内部错误。

修改后运行 `pnpm check` 与 `pnpm format:check`；涉及界面或用户流程时，补 `pnpm test:e2e` 与实际渲染检查。

## 真实内容流程

content 模块在 /app/content 使用分组草稿编辑、独立预览、版本提示与发布/撤下确认；/content 用图文目录与阅读详情。复用 Sage/Catalog 和统一控件，不引入富文本编辑器。草稿/公开与个人图片/站点素材的边界见 [内容指南](CONTENT.md)。
