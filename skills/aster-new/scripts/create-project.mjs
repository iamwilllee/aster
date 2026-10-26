import { featuresFromPlan, featurePreset } from '../../../src/config/feature-policy.mjs'
import { parseAppearance } from '../../../src/config/appearance-policy.mjs'
import { randomBytes } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'jsonc-parser'
import { initialPlan, savePlan, resumeProject } from '../../../scripts/project-workflow.mjs'

import {
  templateFiles as files,
  templateDirectories as directories,
  excludedTemplatePath as excluded,
} from '../../../scripts/starter-files.mjs'
import { initializeBaseline } from '../../../scripts/project-upgrade.mjs'

function inspectTree(path) {
  if (excluded(path)) return
  const stat = lstatSync(path)
  if (stat.isSymbolicLink())
    throw new Error(`Source contains a symlink; review it before copying: ${path}`)
  if (stat.isDirectory()) for (const name of readdirSync(path)) inspectTree(join(path, name))
  else if (!stat.isFile()) throw new Error(`Unsupported source entry: ${path}`)
}
function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}
function markdown(value) {
  return value.replace(/[\\`*_[\]<>#]/g, '\\$&')
}
const projectMetadata = new Set([
  '.git',
  '.gitignore',
  '.gitkeep',
  '.DS_Store',
  'README.md',
  'AGENTS.md',
  '.agents',
  '.codex',
  '.vscode',
  '.idea',
])
function canonicalTarget(path) {
  const tail = []
  let parent = resolve(path)
  while (!existsSync(parent)) {
    const next = dirname(parent)
    if (next === parent) throw new Error('Cannot resolve target directory')
    tail.unshift(basename(parent))
    parent = next
  }
  return join(realpathSync(parent), ...tail)
}
export function inspectTarget(source, target = process.cwd()) {
  source = realpathSync(source)
  target = canonicalTarget(target)
  const inside = relative(source, target)
  if (!inside || (!inside.startsWith('..' + sep) && inside !== '..' && !isAbsolute(inside)))
    return {
      target,
      mode: 'source',
      entries: [],
      action: '这是底座源目录或其子目录；保留底座，指定站点工作目录。',
    }
  if (!existsSync(target))
    return { target, mode: 'missing', entries: [], action: '创建目录并初始化' }
  if (!lstatSync(target).isDirectory())
    return { target, mode: 'file', entries: [], action: '目标是文件，请指定目录' }
  const entries = readdirSync(target)
  if (!entries.length) return { target, mode: 'empty', entries, action: '在当前空目录初始化' }
  if (
    existsSync(join(target, 'starter-version.json')) &&
    existsSync(join(target, 'PROJECT.md')) &&
    existsSync(join(target, 'starter.project.json'))
  )
    return {
      target,
      mode: 'starter',
      entries,
      action: '复用已有 Aster 产品；读取交接和状态，按需 project:resume 后继续业务。',
    }
  if (existsSync(join(target, 'starter-version.json')))
    return {
      target,
      mode: 'starter-incomplete',
      entries,
      action: '已有底座文件但交接或状态不完整；检查缺项并增量补齐，不重新覆盖。',
    }
  if (
    entries.every((name) => {
      const stat = lstatSync(join(target, name))
      if (!projectMetadata.has(name) || stat.isSymbolicLink()) return false
      if (['.agents', '.codex', '.vscode', '.idea'].includes(name)) return stat.isDirectory()
      return name === '.git' ? stat.isDirectory() || stat.isFile() : stat.isFile()
    })
  )
    return {
      target,
      mode: 'metadata',
      entries,
      action: '保留 Git、说明和编辑器配置，在原目录初始化',
    }
  return {
    target,
    mode: 'existing',
    entries,
    action: '保留现有项目；Agent 先读架构和规则，再按需求增量接入，不直接覆盖或强制迁移。',
  }
}
function mergeGuide(target, content) {
  const original = readFileSync(target, 'utf8')
  appendFileSync(
    target,
    (original ? (original.endsWith('\n') ? '\n' : '\n\n') : '') +
      '<!-- starter:guide:start -->\n\n' +
      content +
      '\n<!-- starter:guide:end -->\n',
  )
}
export function parseArgs(args) {
  const result = { install: true }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--no-install') result.install = false
    else if (arg === '--inspect') result.inspect = true
    else if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--name' || arg === '--brief' || arg === '--plan' || arg === '--profile') {
      const key = arg.slice(2)
      if (result[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error(`Expected one value for ${arg}`)
      result[key] = args[++i]
    } else if (arg.startsWith('-') || result.target) throw new Error(`Unexpected argument: ${arg}`)
    else result.target = arg
  }
  if (!result.target) result.target = '.'
  return result
}
export function createProject({
  source,
  target = process.cwd(),
  name,
  brief = '',
  profile,
  plan,
  install = true,
  inspect = false,
}) {
  source = realpathSync(source)
  if (existsSync(join(source, 'PROJECT.md')))
    throw new Error(
      'Run this initializer from the Aster source, not an existing product with PROJECT.md',
    )
  const context = inspectTarget(source, target)
  target = context.target
  if (inspect) return context
  if (context.mode === 'source')
    throw new Error('Target must be outside the Aster source directory')
  if (context.mode === 'file') throw new Error(context.action)
  if (['starter', 'starter-incomplete', 'existing'].includes(context.mode)) return context
  name = (name ?? basename(target)).trim()
  if (!name || name.length > 80 || /[\r\n\x00-\x1f]/.test(name))
    throw new Error('Product name must be 1–80 characters without control characters')
  if (typeof brief !== 'string' || brief.length > 20_000 || brief.includes('\0'))
    throw new Error('Brief must be at most 20,000 characters without NUL')
  if (profile && plan)
    throw new Error('Use either --profile or --plan; Agent plans already contain module choices')
  const profilePlan = profile
    ? {
        modules: Object.fromEntries(
          Object.entries(featurePreset(profile)).map(([key, enabled]) => [
            key,
            {
              selection: enabled ? 'required' : 'deferred',
              basis: 'context',
              reason: `当前任务采用 ${profile} 组合`,
            },
          ]),
        ),
      }
    : {}
  const productPlan = initialPlan(
    brief,
    plan ? JSON.parse(readFileSync(resolve(plan), 'utf8')) : profilePlan,
  )
  const selectedFeatures = featuresFromPlan(productPlan)
  const visual = productPlan.decisions.find((item) => item.id === 'visual-theme')
  const appearance = parseAppearance({
    theme: visual?.status === 'resolved' ? visual.value : 'sage',
  })
  const payment = productPlan.decisions.find((item) => item.id === 'payment-provider')
  const billingProvider = payment?.status === 'resolved' ? payment.value : 'stripe'
  if (selectedFeatures.billing && !['stripe', 'creem'].includes(billingProvider))
    throw new Error(
      'Selected payment-provider is not implemented; use stripe or creem in test mode',
    )
  for (const key of ['database', 'projects', 'emailPassword', 'content'])
    if (!productPlan.modules[key])
      productPlan.modules[key] = {
        selection: selectedFeatures[key] ? 'required' : 'deferred',
        basis: 'context',
        reason: '根据当前产品已选择的认证与数据流程推导；可增量调整',
      }
  const slug =
    basename(target)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || `product-${randomBytes(3).toString('hex')}`
  for (const file of [
    ...files,
    'wrangler.jsonc',
    'src/config/site.ts',
    'docs/templates/PROJECT-BRIEF.md',
  ]) {
    if (!existsSync(join(source, file))) throw new Error(`Aster source is incomplete: ${file}`)
    inspectTree(join(source, file))
  }
  for (const directory of directories)
    if (existsSync(join(source, directory))) inspectTree(join(source, directory))
  const configErrors = []
  const base = parse(readFileSync(join(source, 'wrangler.jsonc'), 'utf8'), configErrors, {
    allowTrailingComma: true,
  })
  if (configErrors.length) throw new Error('Source wrangler.jsonc is invalid')
  const originalSite = readFileSync(join(source, 'src/config/site.ts'), 'utf8')
  const namePattern = /\bname:\s*(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/
  if (!namePattern.test(originalSite))
    throw new Error('Cannot locate site name; review src/config/site.ts')
  if (context.mode === 'missing') mkdirSync(target, { recursive: true })
  for (const file of files) {
    const destination = join(target, file)
    if (existsSync(destination) && file === 'AGENTS.md') {
      mergeGuide(destination, readFileSync(join(source, file), 'utf8'))
    } else if (existsSync(destination) && file === '.gitignore') {
      const original = readFileSync(destination, 'utf8')
      const lines = readFileSync(join(source, file), 'utf8')
        .split('\n')
        .filter((line) => line && !original.split(/\r?\n/).includes(line))
      if (lines.length)
        appendFileSync(
          destination,
          (original ? (original.endsWith('\n') ? '\n' : '\n\n') : '') +
            '# Aster local data\n' +
            lines.join('\n') +
            '\n',
        )
    } else cpSync(join(source, file), destination, { errorOnExist: true, force: false })
  }
  for (const directory of directories)
    if (existsSync(join(source, directory)))
      cpSync(join(source, directory), join(target, directory), {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: (path) => !excluded(path),
      })
  const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
  manifest.name = slug
  manifest.version = '0.1.0'
  for (const command of ['aster:new', 'starter:new', 'skill:install', 'test:starter'])
    delete manifest.scripts[command]
  manifest.scripts.check = manifest.scripts.check.replace(' && pnpm test:starter', '')
  writeJson(join(target, 'package.json'), manifest)
  writeFileSync(
    join(target, 'src/config/site.ts'),
    originalSite
      .replace(namePattern, () => `name: ${JSON.stringify(name)}`)
      .replace(/\bversion:\s*['"][^'"]+['"]/, "version: '0.1.0'"),
  )
  // Never inherit real cloud IDs, routes, bindings, provider settings or JSON vars.
  const vars = (environment) => ({
    ENVIRONMENT: environment,
    APP_ORIGIN:
      environment === 'production'
        ? 'http://127.0.0.1:3100'
        : `https://${slug}-staging.example.invalid`,
    MAIL_MODE: 'disabled',
    BILLING_ENABLED: 'false',
    BILLING_PROVIDER: selectedFeatures.billing ? billingProvider : 'stripe',
    GOOGLE_AUTH_ENABLED: 'false',
    PUBLIC_INDEXABLE: 'false',
    MAIL_FROM: 'Product <no-reply@example.invalid>',
  })
  const database = (staging) => [
    {
      binding: 'DB',
      database_name: staging ? 'starter-staging-db' : 'starter-db',
      database_id: `00000000-0000-0000-0000-00000000000${staging ? '1' : '0'}`,
      migrations_dir: 'migrations',
    },
  ]
  writeJson(join(target, 'wrangler.jsonc'), {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: slug,
    main: base.main,
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    observability: { enabled: true, head_sampling_rate: 0.1 },
    vars: vars('production'),
    ...(selectedFeatures.database ? { d1_databases: database(false) } : {}),
    ...(selectedFeatures.files
      ? {
          r2_buckets: [
            { binding: 'ASSETS_BUCKET', bucket_name: 'replace-with-production-assets-bucket' },
          ],
        }
      : {}),
    env: {
      staging: {
        name: `${slug}-staging`,
        vars: vars('staging'),
        ...(selectedFeatures.database ? { d1_databases: database(true) } : {}),
        ...(selectedFeatures.files
          ? {
              r2_buckets: [
                { binding: 'ASSETS_BUCKET', bucket_name: 'replace-with-staging-assets-bucket' },
              ],
            }
          : {}),
      },
    },
  })
  writeJson(join(target, 'src/config/features.json'), selectedFeatures)
  writeJson(join(target, 'src/config/appearance.json'), appearance)
  const local = `ENVIRONMENT=local\nAPP_ORIGIN=http://127.0.0.1:3100\nMAIL_MODE=${selectedFeatures.mail && selectedFeatures.database ? 'local' : 'disabled'}\nBILLING_ENABLED=false\nBILLING_PROVIDER=${selectedFeatures.billing ? billingProvider : 'stripe'}\nGOOGLE_AUTH_ENABLED=false\nPUBLIC_INDEXABLE=false\n`
  writeFileSync(
    join(target, '.dev.vars'),
    local +
      (selectedFeatures.auth ? `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\n` : ''),
    { mode: 0o600, flag: 'wx' },
  )
  writeFileSync(
    join(target, '.dev.vars.example'),
    local +
      (selectedFeatures.auth
        ? 'BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters\n'
        : ''),
  )
  writeFileSync(join(target, '.npmrc'), 'save-exact=true\n')
  const oneLine = (value) => markdown(value.replace(/[\r\n]+/g, ' '))
  const costPolicy = productPlan.decisions.find((decision) => decision.id === 'cloud-cost-policy')
  const project = readFileSync(join(source, 'docs/templates/PROJECT-BRIEF.md'), 'utf8')
    .replace('- 名称：待填写', () => `- 名称：${markdown(name)}`)
    .replace('- 目标用户：待填写', () => `- 目标用户：${oneLine(productPlan.audience)}`)
    .replace(
      '- 云服务成本策略：待填写（默认免费优先）。',
      () =>
        `- 云服务成本策略：${costPolicy.status === 'resolved' ? oneLine(costPolicy.value) : '待确认；先按免费优先准备方案'}。`,
    )
    .replace(
      '- 一句话说明：为【哪类用户】在【什么场景】解决【什么问题】。',
      () => `- 一句话说明：${oneLine(productPlan.goal) || '待填写'}`,
    )
    .replace(
      '- 用户的核心操作：进入产品 → …… → 得到什么结果。',
      () => `- 用户的核心操作：${productPlan.coreFlow.map(oneLine).join(' → ') || '待整理'}`,
    )
    .replace(
      '- 本次不做：待填写。',
      () => `- 本次不做：${productPlan.outOfScope.map(oneLine).join('、') || '待整理'}。`,
    )
    .replace(
      '- 当前阶段：需求 / 本地开发 / 预发布 / 已上线（选择实际状态）。',
      '- 当前阶段：本地初始化；业务尚未实现。',
    )
  writeFileSync(
    join(target, 'PROJECT.md'),
    project +
      (brief ? `\n## 首次需求\n\n${brief}\n` : '') +
      '\n## 流程状态\n\n模块选择、任务状态和验收证据记录在 `starter.project.json`，不存放密钥。使用 `pnpm project:status` 查看下一步，`pnpm project:doctor` 检查本地环境。\n',
  )
  savePlan(target, productPlan)
  writeFileSync(
    join(target, existsSync(join(target, 'README.md')) ? 'ASTER.md' : 'README.md'),
    `# ${markdown(name)}\n\n基于 Aster 创建的本地产品，需求与交接见 [PROJECT.md](PROJECT.md)。\n\n` +
      '```bash\npnpm project:resume\npnpm dev\n```\n\n' +
      '英文：http://127.0.0.1:3100 · 中文：http://127.0.0.1:3100/zh\n\n' +
      '保留了底座示例业务；首次需求尚未实现。云资源、Google、真实邮件与支付渠道均未配置或验收。\n\n' +
      '[开发手册](docs/DEVELOPMENT.md) · [Agent 指南](docs/AGENT-GUIDE.md) · [部署手册](docs/DEPLOYMENT.md)\n\n' +
      '底座来源版本见 starter-version.json；本产品需独立完成业务验收。\n',
  )
  initializeBaseline(source, target)
  if (install) resumeProject(target)
  return { target, name, slug, installed: install, mode: 'initialized', previousMode: context.mode }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help)
      console.log(
        'Usage: pnpm aster:new [directory] [--name "Product"] [--brief "Requirements"] [--plan plan.json | --profile showcase|web-app|billing-test] [--no-install] [--inspect]. Directory defaults to the current working directory.',
      )
    else {
      const result = createProject({
        source: resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
        ...options,
      })
      if (result.mode !== 'initialized') {
        console.log(JSON.stringify(result, null, 2))
        console.log(
          'Inspection only: existing files, secrets, Git history and project progress were not changed. Continue with the Agent in this directory.',
        )
        process.exitCode = result.mode === 'file' || result.mode === 'source' ? 2 : 0
      } else {
        console.log(
          `Initialized ${result.name} at ${result.target}. ${result.installed ? 'Dependencies and local D1 initialized.' : 'Copy only; run pnpm project:resume there when ready.'}`,
        )
        console.log(
          'Next: open this directory in your Agent, read PROJECT.md, implement the requested product, then validate. Run pnpm dev for local preview. No cloud resources or Git history were created.',
        )
      }
    }
  } catch (error) {
    console.error(
      error instanceof SyntaxError
        ? 'Plan JSON is invalid; original contents not shown.'
        : error.message,
    )
    process.exitCode = 1
  }
}
