import { paymentProvider, paymentSecrets } from '../src/modules/billing/config.mjs'
import { readFeatures } from './project-features.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import { parseLocalVars, dependenciesPresent } from './project-local.mjs'
const planFile = 'starter.project.json'

export function probePort(port) {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', (error) => done(error.code === 'EADDRINUSE' ? 'occupied' : 'unknown'))
    server.listen(port, '127.0.0.1', () => server.close(() => done('available')))
  })
}
// Reports only presence/config shape, never secret values or credential fragments.
export async function doctor(root, { portProbe = probePort, pnpmVersion } = {}) {
  const checks = []
  let features
  try {
    features = readFeatures(root).features
  } catch {
    return {
      ok: false,
      checks: [
        {
          id: 'modules',
          status: 'error',
          message: '模块配置无效；检查依赖和已实现能力，不显示原始内容',
        },
      ],
    }
  }
  const add = (id, status, message) => checks.push({ id, status, message })
  const [major, minor] = process.versions.node.split('.').map(Number)
  add(
    'node',
    major > 22 || (major === 22 && minor >= 12) ? 'ok' : 'error',
    'Node 需 >=22.12；建议 Node 24',
  )
  if (pnpmVersion === undefined) {
    const result = spawnSync('pnpm', ['--version'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15_000,
    })
    pnpmVersion = result.status === 0 ? result.stdout.trim() : ''
  }
  add('pnpm', pnpmVersion === '12.11.2' ? 'ok' : 'error', '需要锁定的 pnpm 12.11.2')
  add(
    'dependencies',
    ['vite', 'wrangler', 'prettier', 'zod'].every((name) =>
      existsSync(join(root, 'node_modules', name, 'package.json')),
    )
      ? 'ok'
      : 'error',
    '依赖缺失时先执行 pnpm install --frozen-lockfile',
  )
  let config,
    vars = {},
    plan
  try {
    const { parse } = await import('jsonc-parser')
    const errors = []
    config = parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'), errors, {
      allowTrailingComma: true,
    })
    if (errors.length || !config || typeof config !== 'object') throw new Error('invalid')
    add('worker-config', 'ok', '本地读取 Worker 配置；未连接云端')
  } catch (error) {
    add(
      'worker-config',
      error.code === 'ERR_MODULE_NOT_FOUND' ? 'unknown' : 'error',
      'Worker 配置待检查；依赖缺失时先安装，配置存在也不证明云端可用',
    )
  }
  try {
    vars = parseLocalVars(readFileSync(join(root, '.dev.vars'), 'utf8'))
    add('local-vars', 'ok', '本地配置已读取，值不显示')
  } catch {
    add('local-vars', 'error', '本地配置缺失或无效；新项目运行 setup，已有项目先恢复自己的配置')
  }
  let origin
  try {
    origin = new URL(vars.APP_ORIGIN)
  } catch {
    /* report shape only */
  }
  add(
    'local-origin',
    vars.ENVIRONMENT === 'local' &&
      ['http:', 'https:'].includes(origin?.protocol) &&
      origin?.origin === vars.APP_ORIGIN &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(origin?.hostname) &&
      (origin?.port || '80') === '3100'
      ? 'ok'
      : 'error',
    '当前开发/测试要求 local 环境与匹配的回环 origin，端口 3100',
  )
  add(
    'auth-secret',
    !features.auth
      ? 'unknown'
      : typeof vars.BETTER_AUTH_SECRET === 'string' &&
          vars.BETTER_AUTH_SECRET.length >= 32 &&
          !vars.BETTER_AUTH_SECRET.startsWith('replace-')
        ? 'ok'
        : 'error',
    features.auth ? '本地认证密钥需至少 32 字符；不会打印或自动替换' : '认证未选；无需认证密钥',
  )
  add(
    'd1-binding',
    !features.database
      ? 'unknown'
      : !config
        ? 'unknown'
        : config?.d1_databases?.some((db) => db.binding === 'DB')
          ? 'ok'
          : 'error',
    features.database
      ? '需要 DB binding；本地检查不证明云端数据库可用'
      : '数据库未选；无需 DB binding',
  )
  add(
    'local-schema',
    existsSync(join(root, 'worker-configuration.d.ts')) && existsSync(join(root, '.wrangler/state'))
      ? 'unknown'
      : 'warn',
    '目录/类型文件不证明迁移已应用；project:resume 会幂等执行本地 setup',
  )
  if (existsSync(join(root, planFile))) {
    try {
      if (!dependenciesPresent(root)) throw new Error('dependencies missing')
      const { loadPlan } = await import('./project-workflow.mjs')
      plan = loadPlan(root)
      add('project-plan', 'ok', '已读取产品计划；模块选择不自动启用提供商')
    } catch {
      add('project-plan', 'error', '产品计划无效，先运行 project:check')
    }
  } else add('project-plan', 'warn', '尚无产品计划；底座源目录不需要填写虚构产品')
  if (plan) {
    try {
      const { upgradeStatus } = await import('./project-upgrade.mjs')
      const upgrade = upgradeStatus(root)
      add(
        'starter-baseline',
        upgrade.baseline === 'recorded' ? 'ok' : 'warn',
        upgrade.baseline === 'recorded'
          ? '已记录本地哈希基线；未扫描上游或验证升级'
          : '旧产品缺少哈希基线；升级需保守审查，不自动覆盖或伪造基线',
      )
    } catch {
      add('starter-baseline', 'error', '升级基线无效，先检查元数据，不自动覆盖')
    }
    const { serviceStatus } = await import('./service-workflow.mjs')
    const services = serviceStatus(root, plan.integrations)
    add(
      'external-progress',
      services.some((item) => !item.complete) ? 'warn' : 'ok',
      services.length
        ? '外部服务进度已读取；用 project:service status 查看断点，仍需核实当前授权与远端状态'
        : '暂无外部服务进度；接通任务按需建立，不从配置存在推断完成',
    )
    const costPolicy = plan.decisions.find((decision) => decision.id === 'cloud-cost-policy')
    add(
      'cloud-cost-policy',
      costPolicy?.status === 'resolved' ? 'ok' : 'warn',
      costPolicy?.status === 'resolved'
        ? '已记录成本偏好；未查询账户套餐、共享额度或账单，也不构成付费授权'
        : '尚未记录云成本策略；上云前按免费优先评估，不默认升级账户',
    )
  }
  const required = (key) => plan?.modules[key]?.selection === 'required'
  const effective = { ...config?.vars, ...vars }
  const present = (key) =>
    typeof vars[key] === 'string' &&
    vars[key].trim().length > 0 &&
    !/^(?:replace-|\.\.\.)/.test(vars[key])
  add(
    'mail',
    !features.mail ? 'unknown' : effective.MAIL_MODE === 'local' ? 'ok' : 'warn',
    !features.mail
      ? '邮件模块未选；不要求邮件配置或验收'
      : effective.MAIL_MODE === 'local'
        ? '本地收件箱模式；真实发信尚未验收'
        : effective.MAIL_MODE === 'cloudflare'
          ? 'Cloudflare 发信需目标账户 Workers Paid、发信资格、EMAIL binding、域名及真实投递验收；本检查未查询账户'
          : ['brevo', 'resend'].includes(effective.MAIL_MODE)
            ? present(effective.MAIL_MODE === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY')
              ? '所选外部邮件的本地凭据存在；远端凭据、域名、账户激活和投递均未验证'
              : '所选外部邮件缺少本地 API key；如仅在远端保存则由 deploy 核对名称，不要下载或打印远端密钥'
            : '未选择远端邮件；按用户偏好、已有服务及目标账户套餐选择 cloudflare、brevo 或 resend',
  )
  const googleConfigured =
    effective.GOOGLE_AUTH_ENABLED === 'true' &&
    present('GOOGLE_CLIENT_ID') &&
    present('GOOGLE_CLIENT_SECRET')
  add(
    'google',
    !features.google
      ? 'unknown'
      : googleConfigured
        ? 'warn'
        : required('google')
          ? 'warn'
          : 'unknown',
    !features.google
      ? 'Google 未选；不要求 OAuth 配置或验收'
      : googleConfigured
        ? '本地 Google 配置形状齐备；真实登录/回调未验证'
        : 'Google 待配置：GOOGLE_AUTH_ENABLED、GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET',
  )
  const provider = paymentProvider(vars)
  const paymentConfigured = provider && paymentSecrets(provider).every(present)
  add(
    'billing',
    !provider || vars.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? 'error'
      : features.billing && paymentConfigured
        ? 'warn'
        : 'unknown',
    !provider
      ? 'BILLING_PROVIDER 仅支持 stripe 或 creem'
      : vars.STRIPE_SECRET_KEY?.startsWith('sk_live_')
        ? '禁止使用 Stripe live 密钥'
        : !features.billing
          ? '支付模块未选；不要求新支付配置或验收'
          : paymentConfigured
            ? `本地 ${provider} 配置存在；仅测试，真实结账/回调/审核/结算分别待验收`
            : `${provider} 测试待配置：${paymentSecrets(provider).join('、')}；新结账另需 BILLING_ENABLED`,
  )
  if (features.content)
    add('content', 'warn', '内容模块已选；核对管理员权限、已发布页面及 content-live 真实环境验收')
  if (features.files)
    add('files', 'warn', '已选私有图片模块；检查 ASSETS_BUCKET，云端上传/隔离/删除仍需独立验收')
  for (const key of ['ai', 'usage'])
    if (required(key))
      add(`module-${key}`, 'warn', `${key} 的业务尚未实现；需补实现、权限和用量/失败验收`)
  for (const port of [3100, 3110]) {
    const state = await portProbe(port)
    add(
      `port-${port}`,
      state === 'available' ? 'ok' : 'warn',
      state === 'available'
        ? `回环端口 ${port} 可用`
        : `端口 ${port} 已占用或无法确认；先识别现有服务，不会停止进程`,
    )
  }
  add(
    'remote',
    'unknown',
    '未读取远端 secrets、资格或资源；云端邮件/Google/支付渠道需独立配置与真实验收',
  )
  if (features.database) {
    try {
      const { databaseStatus } = await import('./database-release.mjs')
      const reports = ['staging', 'production'].map((environment) =>
        databaseStatus(root, environment),
      )
      const needsReview = reports.some(
        (report) =>
          report.locked || report.releases.some((item) => item.phase !== 'verified' || item.stale),
      )
      add(
        'database-releases',
        needsReview ? 'warn' : 'unknown',
        needsReview
          ? '本地有锁、未完成或过期的数据库发布记录；用 project:database status 核对，再检查远端。不会自动解锁或写库'
          : '未发现待恢复的本地数据库发布；不代表远端迁移或业务已通过',
      )
    } catch {
      add(
        'database-releases',
        'warn',
        '数据库发布记录暂不可读；安装依赖后检查 project:database status，不显示私有内容',
      )
    }
  }
  return { ok: checks.every((item) => item.status !== 'error'), checks }
}
