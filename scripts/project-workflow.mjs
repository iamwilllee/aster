import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { z } from 'zod'
import { integrationSchema, serviceStatus, serviceProblems } from './service-workflow.mjs'
import { featurePlanProblems, activeItem } from './project-features.mjs'
import { featureKeys, featureDependencies } from '../src/config/feature-policy.mjs'
import { upgradeStatus } from './project-upgrade.mjs'
import { databaseStatus } from './database-release.mjs'
import {
  assertLocalProject,
  dependenciesPresent,
  dependencyFingerprint,
  localBootstrapEnv,
} from './project-local.mjs'

export const planFile = 'starter.project.json'
export const cloudCostDecisionId = 'cloud-cost-policy'
export const moduleCatalog = {
  database: { capability: 'D1 数据库；公开展示站可不接入', needs: featureDependencies.database },
  projects: { capability: '私有项目示例；可按业务选用', needs: featureDependencies.projects },
  emailPassword: {
    capability: '邮箱密码认证；需邮件验证',
    needs: featureDependencies.emailPassword,
  },
  auth: { capability: '认证基础；选择邮箱密码或 Google', needs: featureDependencies.auth },
  mail: {
    capability: '本地及 CF/Brevo/Resend 适配已实现；真实投递按产品验收',
    needs: featureDependencies.mail,
  },
  google: {
    capability: 'OAuth 已接线；需产品自己的凭据与回调验收',
    needs: featureDependencies.google,
  },
  billing: {
    capability: 'Stripe / Creem TEST；托管结账待真实测试账户验收',
    needs: featureDependencies.billing,
  },
  ai: { capability: '模型调用与业务尚未实现', needs: featureDependencies.ai },
  files: {
    capability: '私有图片上传、资源库与引用已实现；R2 云端需按产品验收',
    needs: featureDependencies.files,
  },
  content: {
    capability: '文章、帮助、公告与独立公开素材；真实环境按产品验收',
    needs: featureDependencies.content,
  },
  usage: { capability: '消费额度账本尚未实现', needs: featureDependencies.usage },
}
const text = z.string().trim().min(1).max(20_000)
const evidence = z
  .array(text)
  .max(30)
  .default(() => [])
const selection = z
  .object({
    selection: z.enum(['required', 'deferred', 'undecided']),
    basis: z.enum(['user', 'context', 'default']),
    reason: text,
  })
  .strict()
const defaultModules = Object.fromEntries(
  Object.keys(moduleCatalog)
    .filter((key) => !['database', 'projects', 'emailPassword', 'content'].includes(key))
    .map((key) => [
      key,
      {
        selection: key === 'google' ? 'deferred' : 'undecided',
        basis: 'default',
        reason:
          key === 'google'
            ? 'Google 登录为可选；默认沿用邮箱和密码，按用户需求再选择'
            : '等待 Agent 根据需求判断；未启用外部服务',
      },
    ]),
)
const step = z
  .object({
    status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
    updatedAt: z.string().optional(),
  })
  .strict()
const initialBootstrap = () => ({
  dependencies: { status: 'pending' },
  database: { status: 'pending' },
  format: { status: 'pending' },
})
export const planSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    goal: z.string().max(20_000).default(''),
    audience: z.string().max(2000).default('待定'),
    coreFlow: z
      .array(text)
      .max(30)
      .default(() => []),
    outOfScope: z
      .array(text)
      .max(30)
      .default(() => []),
    modules: z
      .object(
        Object.fromEntries(
          Object.keys(moduleCatalog).map((key) => [
            key,
            ['database', 'projects', 'emailPassword', 'content'].includes(key)
              ? selection.optional()
              : selection.default(() => ({ ...defaultModules[key] })),
          ]),
        ),
      )
      .strict()
      .default(() => structuredClone(defaultModules)),
    decisions: z
      .array(
        z
          .object({
            id: text,
            question: text,
            status: z.enum(['open', 'resolved']),
            value: z.string().default(''),
            basis: z.enum(['user', 'context', 'default']),
            reason: text,
            blocking: z.boolean().default(false),
          })
          .strict(),
      )
      .max(50)
      .default(() => []),
    tasks: z
      .array(
        z
          .object({
            id: text,
            title: text,
            module: z.enum(featureKeys).optional(),
            status: z.enum(['todo', 'doing', 'implemented', 'blocked']),
            evidence,
          })
          .strict(),
      )
      .max(100)
      .default(() => []),
    acceptance: z
      .array(
        z
          .object({
            id: text,
            title: text,
            kind: z.enum(['business', 'baseline']),
            module: z.enum(featureKeys).optional(),
            steps: z.array(text).min(1).max(30),
            expected: text,
            scope: z.enum(['local', 'provider']),
            required: z.boolean().default(true),
            status: z.enum(['pending', 'passed', 'failed', 'blocked']).default('pending'),
            evidence,
            verification: z.enum(['unverified', 'local', 'mock', 'real']).default('unverified'),
          })
          .strict(),
      )
      .max(100)
      .default(() => []),
    integrations: z
      .array(integrationSchema)
      .max(20)
      .default(() => []),
    handoff: z
      .object({ next: z.array(text).default(() => []), blockers: z.array(text).default(() => []) })
      .strict()
      .default(() => ({ next: [], blockers: [] })),
    bootstrap: z
      .object({
        dependencies: step,
        database: step,
        format: step,
        dependencyFingerprint: z.string().optional(),
      })
      .strict()
      .default(initialBootstrap),
  })
  .strict()
  .superRefine((plan, ctx) => {
    for (const group of ['decisions', 'tasks', 'acceptance', 'integrations']) {
      const ids = plan[group].map((item) => item.id)
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', path: [group], message: 'IDs must be unique' })
    }
    plan.decisions.forEach((item, index) => {
      if (item.status === 'resolved' && !item.value.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['decisions', index],
          message: 'Resolved decisions need a value',
        })
    })
    plan.tasks.forEach((item, index) => {
      if (item.status === 'implemented' && !item.evidence.length)
        ctx.addIssue({
          code: 'custom',
          path: ['tasks', index],
          message: 'Implemented tasks need source evidence',
        })
    })
    plan.acceptance.forEach((item, index) => {
      if (
        item.status === 'passed' &&
        (!item.evidence.length ||
          item.verification === 'unverified' ||
          (item.scope === 'provider' && item.verification !== 'real'))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['acceptance', index],
          message:
            'Passed cases need evidence and matching verification; mock cannot prove a real provider flow',
        })
    })
  })

export function parsePlan(input) {
  const result = planSchema.safeParse(input)
  if (!result.success)
    throw new Error(
      'Invalid project plan: ' +
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    )
  return result.data
}
export function initialPlan(brief = '', input = {}) {
  const plan = parsePlan({
    goal: brief,
    acceptance: [
      {
        id: 'baseline-check',
        title: '基础构建与代码检查',
        kind: 'baseline',
        steps: ['运行 pnpm check', '运行 pnpm format:check'],
        expected: '命令成功；另做本产品业务验收',
        scope: 'local',
      },
    ],
    ...input,
  })
  // A default preference is a planning constraint, never permission to buy services.
  if (!plan.decisions.some((decision) => decision.id === cloudCostDecisionId))
    plan.decisions.unshift({
      id: cloudCostDecisionId,
      question: '云服务成本策略',
      status: 'resolved',
      value: '免费优先；初期新增云服务费用目标 USD 0/月；付费能力按实际需求单独评估',
      basis: 'default',
      reason: '先验证免费档容量与运行限制；外部操作和付费授权仍以用户当前指令为准',
      blocking: false,
    })
  plan.integrations = [] // Provider progress belongs to the product, never an initializer input.
  plan.bootstrap = initialBootstrap()
  plan.tasks = plan.tasks.map((task) => ({ ...task, status: 'todo', evidence: [] }))
  plan.acceptance = plan.acceptance.map((item) => ({
    ...item,
    status: 'pending',
    verification: 'unverified',
    evidence: [],
  }))
  return parsePlan(plan)
}
export function loadPlan(root) {
  return parsePlan(JSON.parse(readFileSync(join(root, planFile), 'utf8')))
}
export function savePlan(root, input) {
  const plan = parsePlan(input)
  const target = join(root, planFile)
  const temporary = target + `.tmp-${process.pid}`
  writeFileSync(temporary, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 })
  renameSync(temporary, target)
  return plan
}
export function planProblems(root, plan) {
  const errors = [],
    pending = []
  const capability = featurePlanProblems(root, plan)
  errors.push(...capability.errors)
  const active = (item) => !capability.explicit || activeItem(item, capability.features)
  if (!plan.goal.trim()) pending.push('补充产品目标')
  if (!plan.coreFlow.length) pending.push('明确首版核心流程')
  for (const [key, step] of Object.entries(plan.bootstrap))
    if (
      typeof step === 'object' &&
      step.status !== 'done' &&
      !(key === 'database' && step.status === 'skipped' && !capability.features.database)
    )
      pending.push(`本地初始化未完成：${key}`)
  for (const [key, choice] of Object.entries(plan.modules)) {
    if (['ai', 'usage'].includes(key) && choice.selection === 'required')
      pending.push(`模块待实现与验收：${key}`)
    if (choice.selection === 'undecided') pending.push(`决定 ${key} 是否需要`)
    if (choice.selection === 'required')
      for (const dependency of moduleCatalog[key].needs)
        if (
          (!['database', 'projects', 'emailPassword'].includes(dependency) ||
            capability.explicit ||
            plan.modules[dependency]) &&
          plan.modules[dependency]?.selection !== 'required'
        )
          pending.push(`${key} 的现有实现依赖 ${dependency}，需要明确选择`)
  }
  for (const item of plan.decisions)
    if (item.status === 'open' && item.blocking) pending.push(`待决定：${item.question}`)
  if (!plan.tasks.length) pending.push('拆解业务任务')
  for (const task of plan.tasks)
    if (active(task) && task.status !== 'implemented') pending.push(`任务未完成：${task.title}`)
  if (!plan.acceptance.some((item) => active(item) && item.kind === 'business' && item.required))
    pending.push('补充必需的业务验收用例，基础测试不代表产品完成')
  for (const item of plan.acceptance)
    if (active(item) && item.required && item.status !== 'passed')
      pending.push(`验收未通过：${item.title}`)
  for (const item of [...plan.tasks, ...plan.acceptance].filter(active))
    for (const reference of item.evidence) {
      const path = resolve(root, reference)
      const rel = existsSync(path)
        ? relative(realpathSync(root), realpathSync(path))
        : relative(root, path)
      if (
        isAbsolute(reference) ||
        rel === '..' ||
        rel.startsWith('../') ||
        isAbsolute(rel) ||
        !existsSync(path) ||
        !statSync(path).isFile()
      )
        errors.push(`证据必须是项目内已存在的相对路径：${item.id}`)
      if (
        /^qa\/(?:acceptance(?:-v[\w.]+)?|starter-new-acceptance|workflow-acceptance)\.md$/.test(
          rel.replaceAll('\\', '/'),
        )
      )
        errors.push(`底座历史验收不能充当本产品证据：${item.id}`)
      if (/(?:^|\/)(?:\.dev\.vars[^/]*|\.env[^/]*)$/.test(rel.replaceAll('\\', '/')))
        errors.push(`敏感配置不能作为验收证据：${item.id}`)
    }
  const selectedIntegrations = plan.integrations.filter(
    (service) =>
      !capability.explicit ||
      (service.provider === 'google' ? capability.features.google : capability.features.mail),
  )
  const services = serviceProblems(root, selectedIntegrations)
  errors.push(...services.errors)
  pending.push(...services.pending)
  for (const service of serviceStatus(root, selectedIntegrations))
    if (
      service.required &&
      !service.complete &&
      plan.acceptance.some((item) => item.id === service.acceptanceId && item.status === 'passed')
    )
      errors.push(`外部服务验收记录过期，需重置对应业务用例：${service.id}`)
  for (const message of plan.handoff.blockers) pending.push(`阻塞：${message}`)
  return { errors, pending, ready: errors.length === 0 && pending.length === 0 }
}

export function resumeProject(root, { run, dependenciesInstalled = false } = {}) {
  root = resolve(root)
  let plan = loadPlan(root)
  assertLocalProject(root)
  const fingerprint = dependencyFingerprint(root)
  const commands = [
    ['dependencies', ['install', '--frozen-lockfile']],
    ['database', ['setup']],
    [
      'format',
      [
        'exec',
        'prettier',
        '--write',
        'package.json',
        'src/config/site.ts',
        'wrangler.jsonc',
        existsSync(join(root, 'STARTER.md')) ? 'STARTER.md' : 'README.md',
        'PROJECT.md',
      ],
    ],
  ]
  const execute =
    run ??
    ((args) => {
      const result = spawnSync('pnpm', args, {
        cwd: root,
        stdio: 'inherit',
        env: localBootstrapEnv(),
      })
      return result.error ? 1 : (result.status ?? 1)
    })
  for (const [key, args] of commands) {
    if (key === 'dependencies' && dependenciesInstalled && dependenciesPresent(root)) {
      plan.bootstrap.dependencies = { status: 'done', updatedAt: new Date().toISOString() }
      plan.bootstrap.dependencyFingerprint = fingerprint
      plan = savePlan(root, plan)
      continue
    }
    if (
      key === 'dependencies' &&
      plan.bootstrap.dependencies.status === 'done' &&
      plan.bootstrap.dependencyFingerprint === fingerprint &&
      dependenciesPresent(root)
    )
      continue
    // Always re-apply local migrations idempotently; directory presence cannot prove schema readiness.
    if (key === 'format' && plan.bootstrap.format.status === 'done') continue
    plan.bootstrap[key] = { status: 'running', updatedAt: new Date().toISOString() }
    savePlan(root, plan)
    let status
    try {
      status =
        execute(args) === 0
          ? key === 'database' && !featurePlanProblems(root, plan).features.database
            ? 'skipped'
            : 'done'
          : 'failed'
    } catch {
      status = 'failed'
    }
    plan.bootstrap[key] = { status, updatedAt: new Date().toISOString() }
    if (key === 'dependencies' && status === 'done')
      plan.bootstrap.dependencyFingerprint = fingerprint
    plan = savePlan(root, plan)
    if (status === 'failed')
      throw new Error(
        `本地步骤 ${key} 失败；文件与进度已保留。修复环境后运行 pnpm project:resume，不要重新复制。`,
      )
  }
  return plan
}

export function projectStatus(root) {
  const plan = loadPlan(root)
  const problems = planProblems(root, plan)
  const costPolicy = plan.decisions.find((decision) => decision.id === cloudCostDecisionId)
  return {
    goal: plan.goal,
    upgrade: upgradeStatus(root),
    databaseReleases: {
      staging: databaseStatus(root, 'staging'),
      production: databaseStatus(root, 'production'),
    },
    cloudCostPolicy: costPolicy
      ? { status: costPolicy.status, value: costPolicy.value, basis: costPolicy.basis }
      : null,
    capabilities: featurePlanProblems(root, plan),
    integrations: serviceStatus(root, plan.integrations),
    bootstrap: plan.bootstrap,
    tasks: plan.tasks.map(({ id, title, status }) => ({ id, title, status })),
    acceptance: plan.acceptance.map(({ id, title, status, scope, verification }) => ({
      id,
      title,
      status,
      scope,
      verification,
    })),
    next: plan.handoff.next.length ? plan.handoff.next : problems.pending.slice(0, 5),
    errors: problems.errors,
    pending: problems.pending,
    businessVerified: problems.ready,
    note: '初始化、业务实现和业务验收分开记录；此状态不代表部署、费用核验或外部操作授权。',
  }
}
