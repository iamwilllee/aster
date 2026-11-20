export const release = 'v0.2.0-beta.1'
export const repository = 'https://github.com/iamwilllee/aster'
export const install = `git clone --branch ${release} --depth 1 ${repository}.git aster
cd aster
pnpm install --frozen-lockfile
pnpm setup
pnpm skill:install`

export const content = {
  en: {
    lang: 'en',
    other: '/zh',
    otherLabel: '中文',
    title: 'Aster — A reliable starting point for your agent',
    description:
      'An open-source product foundation for AI agents. TanStack Start, React, TypeScript and Cloudflare. Start with the capabilities your product needs.',
    nav: ['Foundation', 'Capabilities', 'Get started', 'Documentation'],
    theme: 'Switch color theme',
    eyebrow: 'OPEN SOURCE · BUILT FOR AGENTS',
    heading: 'A reliable start.<br><span>Your product, next.</span>',
    intro:
      'Turn an idea into your own product. Give your agent a working foundation, clear conventions and a path from local development to Cloudflare.',
    cta: 'Start building',
    source: 'Explore the source',
    chips: ['MIT licensed', 'Your code, your account', 'Choose what you need'],
    flowLabel: 'FROM CONTEXT TO PRODUCT',
    flowFooter: 'A practical workflow, in your project.',
    flow: [
      ['01', 'Understand the context', 'Your idea, your users, your existing code.'],
      ['02', 'Build on the foundation', 'Choose capabilities. Keep your own identity.'],
      ['03', 'Verify the real result', 'Run locally, test the flow, record what works.'],
    ],
    foundationTitle: 'A head start.<br>Room to make it yours.',
    foundationIntro:
      'The familiar pieces fit together, so your agent can spend more time on the product.',
    foundation: [
      [
        '01 / APPLICATION',
        'TanStack Start',
        'React and TypeScript, with routing, server functions and a shared component system.',
      ],
      [
        '02 / PLATFORM',
        'Cloudflare',
        'Workers for deployment. D1 and private R2 assets when your product needs them.',
      ],
      [
        '03 / WORKFLOW',
        'An agent with context',
        'A reusable Skill, project decisions, resumable setup and product-specific acceptance.',
      ],
    ],
    capabilitiesTitle: 'Start with the essentials.<br>Add with intention.',
    capabilitiesIntro:
      'Use Aster for a public website or a web application. Capabilities follow the user flow.',
    capabilities: [
      [
        '01',
        'Accounts & private data',
        'Email/password authentication, account settings and owner-scoped data. Configure real email before opening registration.',
      ],
      [
        '02',
        'A consistent interface',
        'shadcn/ui components, shared control sizes, English/Chinese, light/dark and Sage/Catalog visual themes.',
      ],
      [
        '03',
        'Content & images, as needed',
        'Optional editorial publishing and private image workflows. New products start with these capabilities off.',
      ],
      [
        '04',
        'A repeatable handoff',
        'Record scope, decisions and current acceptance. Upgrade selected modules while preserving product customizations.',
      ],
    ],
    profilesTitle: 'Two starting points.',
    profiles: [
      [
        'SHOWCASE',
        'A public-facing website',
        'Pages, language, theme and search metadata. Start without accounts, a database, email or payments.',
      ],
      [
        'WEB APP',
        'A product with private data',
        'D1, email/password accounts and a private workspace. Configure and verify providers for your own deployment.',
      ],
    ],
    scope:
      'Current release: a non-payment public preview. Stripe/Creem adapters remain experimental TEST code. AI and usage billing are not built in.',
    startTitle: 'Your next project<br>starts with context.',
    startIntro:
      'Prepare the source once. Then open your product directory and tell the agent what you want to build.',
    prerequisite: 'Node.js 24 · pnpm 12.11.2 · an agent that supports Skills',
    setupLabel: '01 / PREPARE THE SOURCE',
    promptLabel: '02 / IN YOUR PRODUCT PROJECT',
    prompt:
      '$aster-new Build a public website for my product. Use the context in this project, preserve existing files, and complete a local preview and acceptance. Do not deploy yet.',
    handoff:
      'Empty folder or existing application: the Skill inspects first, initializes where appropriate and continues incrementally. Existing projects keep their architecture and data.',
    copy: 'Copy',
    copied: 'Copied',
    copyFail: 'Select and copy the text below.',
    docsTitle: 'Keep a good reference close.',
    docsIntro:
      'Read the guides in your language. Check release scope when adopting changes; each product needs its own configuration and acceptance.',
    docs: [
      ['Agent guide', 'Initialize, develop, resume and hand off a project.', 'AGENT-GUIDE.md'],
      ['Capabilities', 'Choose a showcase or web application profile.', 'MODULES.md'],
      ['Frontend & themes', 'Components, typography, motion and visual direction.', 'FRONTEND.md'],
      ['Costs & cloud', 'Start free-first and evaluate services separately.', 'COSTS.md'],
      [
        'Upgrade an existing product',
        'Review differences and preserve customizations.',
        'UPGRADING.md',
      ],
      ['Deployment', 'Configure the target environment and verify it.', 'DEPLOYMENT.md'],
    ],
    faqTitle: 'Before you start.',
    faq: [
      [
        'Do I need to add AI to my product?',
        'No. Aster helps an agent develop your product; your product can be a regular website or web application. AI features are optional work for the specific product.',
      ],
      [
        'Do I need paid cloud services?',
        'Local development does not require a Cloudflare, email or payment account. Start with the services you need and verify current free-tier limits before deployment.',
      ],
      [
        'Does updating the Skill update my website?',
        'No. Existing products adopt selected changes explicitly, preserving their brand, business code, secrets and data. The upgrade guide explains the review and acceptance process.',
      ],
    ],
    finalTitle: 'Start with a foundation.<br>Build something of your own.',
    releaseLabel: 'Release notes',
    footer: 'An open-source foundation for AI agents. Built on TanStack Start and Cloudflare.',
    missingTitle: 'This page is not here.',
    missingCta: 'Back to Aster',
  },
  zh: {
    lang: 'zh-CN',
    other: '/',
    otherLabel: 'EN',
    title: 'Aster — 给 Agent 一个可靠的起点',
    description:
      '面向 AI Agent 的开源产品底座，基于 TanStack Start、React、TypeScript 与 Cloudflare。按需选择能力，从本地开发走向自己的产品。',
    nav: ['产品底座', '能力选择', '开始使用', '使用文档'],
    theme: '切换明暗主题',
    eyebrow: 'OPEN SOURCE · BUILT FOR AGENTS',
    heading: '给 Agent 一个<br><span>可靠的起点。</span>',
    intro:
      '把想法做成自己的产品。给 Agent 一套可以运行的底座、清晰的开发约定，以及从本地开发走向 Cloudflare 的流程。',
    cta: '开始构建',
    source: '查看源码',
    chips: ['MIT 开源', '自己的代码与账户', '按产品需要组合能力'],
    flowLabel: '从上下文，到自己的产品',
    flowFooter: '在当前项目里，把想法一步步落地。',
    flow: [
      ['01', '理解产品上下文', '从想法、用户和已有代码开始。'],
      ['02', '在底座上开发', '按需选择能力，保留自己的品牌。'],
      ['03', '验证实际结果', '本地运行、走通流程、记录真实验收。'],
    ],
    foundationTitle: '基础已经就绪，<br>产品由你定义。',
    foundationIntro: '把常用的技术与约定衔接好，让 Agent 把精力放在产品本身。',
    foundation: [
      [
        '01 / APPLICATION',
        'TanStack Start',
        'React 与 TypeScript，配合路由、服务端函数和统一组件系统。',
      ],
      ['02 / PLATFORM', 'Cloudflare', '使用 Workers 部署；需要数据和私有图片时，再选择 D1 与 R2。'],
      [
        '03 / WORKFLOW',
        '理解上下文的 Agent',
        '可复用的 Skill、项目决策、可恢复的初始化，以及每个产品自己的验收。',
      ],
    ],
    capabilitiesTitle: '从必要能力开始，<br>随着产品逐步生长。',
    capabilitiesIntro: '展示站或普通 Web 应用都可以。先看用户要完成什么，再决定接入哪些能力。',
    capabilities: [
      [
        '01',
        '账号与私有数据',
        '邮箱密码认证、账户设置与按用户隔离的数据。对外开放注册前，需要配置并实测邮件服务。',
      ],
      [
        '02',
        '一致的界面体验',
        'shadcn/ui 组件、统一控件尺寸、中英双语、明暗模式，以及 Sage / Catalog 两套视觉主题。',
      ],
      [
        '03',
        '按需接入内容与图片',
        '可选的内容发布和私有图片流程。新产品默认关闭，按实际业务需要启用。',
      ],
      [
        '04',
        '可持续的项目交接',
        '记录范围、决策与当前验收结果。升级时选择需要的模块，保留产品自己的定制。',
      ],
    ],
    profilesTitle: '两种起步方式。',
    profiles: [
      [
        'SHOWCASE',
        '面向访客的展示站',
        '页面、语言、主题与搜索元数据。不需要账号、数据库、邮件或支付即可起步。',
      ],
      [
        'WEB APP',
        '带私有数据的应用',
        'D1、邮箱密码账号与私有工作台。真实部署的服务配置和验收，在每个产品中独立完成。',
      ],
    ],
    scope:
      '当前版本为无支付公开预览版。Stripe / Creem 仅保留实验 TEST 代码；AI 与用量计费尚未内置。',
    startTitle: '下一个产品，<br>从上下文开始。',
    startIntro: '先准备一次底座源码。然后打开你的产品目录，直接告诉 Agent 你想做什么。',
    prerequisite: 'Node.js 24 · pnpm 12.11.2 · 支持 Skill 的 Agent',
    setupLabel: '01 / 准备底座源码',
    promptLabel: '02 / 在产品项目中使用',
    prompt:
      '$aster-new 为我的产品做一个展示站。结合当前项目的上下文，保留已有文件，完成本地预览和验收，暂不部署。',
    handoff: '空目录或已有应用都先识别，再安全初始化或增量开发。已有项目保留自己的架构与数据。',
    copy: '复制',
    copied: '已复制',
    copyFail: '请选中下方文字复制。',
    docsTitle: '需要时，有据可循。',
    docsIntro: '按当前语言阅读完整指南。采用改进时核对版本范围，每个产品独立完成配置与验收。',
    docs: [
      ['Agent 使用指南', '从初始化、开发到恢复和交接。', 'AGENT-GUIDE.md'],
      ['能力选择', '按需求选择展示站或 Web 应用组合。', 'MODULES.md'],
      ['前端与主题', '组件、字体、动效与产品视觉方向。', 'FRONTEND.md'],
      ['成本与上云', '免费优先，分别评估各项服务。', 'COSTS.md'],
      ['已有产品升级', '审查差异，保留业务和品牌定制。', 'UPGRADING.md'],
      ['部署指南', '配置目标环境，并验证真实运行。', 'DEPLOYMENT.md'],
    ],
    faqTitle: '开始前，你可能想了解。',
    faq: [
      [
        '产品必须带 AI 功能吗？',
        '不需要。Aster 帮助 Agent 开发产品，你的产品可以只是普通网站或 Web 应用。产品自身是否接入 AI，由具体需求决定。',
      ],
      [
        '起步就需要付费云服务吗？',
        '本地开发不需要 Cloudflare、邮件或支付账户。先选择真正需要的服务，再在部署前核对当前免费额度与运行限制。',
      ],
      [
        '更新 Skill，会自动更新我的站点吗？',
        '不会。已有产品需要明确采用相应改进，保留自己的品牌、业务代码、密钥与数据。升级指南说明了差异审查与验收流程。',
      ],
    ],
    finalTitle: '让底座成为起点，<br>把产品做成自己的。',
    releaseLabel: '版本说明',
    footer: '面向 AI Agent 的开源产品底座。基于 TanStack Start 与 Cloudflare。',
    missingTitle: '这个页面暂时找不到。',
    missingCta: '返回 Aster',
  },
}
