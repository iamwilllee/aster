import { featurePreset } from '../../src/config/feature-policy.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
  realpathSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse as parseJsonc } from 'jsonc-parser'
import { createProject } from '../../skills/aster-new/scripts/create-project.mjs'
import {
  initialPlan,
  parsePlan,
  savePlan,
  loadPlan,
  planProblems,
  resumeProject,
  projectStatus,
  cloudCostDecisionId,
} from '../../scripts/project-workflow.mjs'
import { doctor } from '../../scripts/project-doctor.mjs'
import { parseLocalVars } from '../../scripts/project-local.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
function product(t) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'starter-workflow-test-')))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  return createProject({
    source,
    target: join(temp, 'product'),
    brief: '做一个付费 AI 工具',
    install: false,
  }).target
}
function fakeDependencies(root) {
  for (const name of ['vite', 'wrangler', 'prettier', 'zod']) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true })
    writeFileSync(join(root, 'node_modules', name, 'package.json'), '{}')
  }
}
function completePlan(root) {
  writeFileSync(join(root, 'src/config/features.json'), JSON.stringify(featurePreset('showcase')))
  const plan = initialPlan('私人笔记')
  plan.coreFlow = ['创建笔记', '刷新后读取']
  for (const choice of Object.values(plan.modules))
    Object.assign(choice, {
      selection: 'deferred',
      basis: 'user',
      reason: '本用例仅验证静态本地业务',
    })
  for (const step of Object.values(plan.bootstrap)) step.status = 'done'
  plan.tasks = [
    { id: 'notes', title: '笔记业务', status: 'implemented', evidence: ['src/config/site.ts'] },
  ]
  writeFileSync(join(root, 'business-evidence.md'), '本次业务实测结果；测试 fixture')
  plan.acceptance = [
    {
      id: 'persist',
      title: '刷新持久化',
      kind: 'business',
      scope: 'local',
      required: true,
      status: 'passed',
      verification: 'local',
      steps: ['创建记录', '刷新页面'],
      expected: '保留记录',
      evidence: ['business-evidence.md'],
    },
  ]
  return parsePlan(plan)
}

test('natural-language brief stays user intent; choices have provenance and are not keyword toggles', () => {
  const a = initialPlan('付费 AI 文件工具'),
    b = initialPlan('第二个项目')
  assert.equal(a.modules.billing.selection, 'undecided')
  assert.equal(a.modules.ai.selection, 'undecided')
  assert.equal(a.modules.google.selection, 'deferred')
  assert.equal(a.modules.google.basis, 'default')
  assert.equal(
    initialPlan('Google 登录', {
      modules: { google: { selection: 'required', basis: 'user', reason: '明确选择 Google' } },
    }).modules.google.selection,
    'required',
  )
  a.modules.ai.selection = 'required'
  assert.equal(b.modules.ai.selection, 'undecided')
  a.handoff.next.push('only project A')
  assert.deepEqual(initialPlan('C').handoff.next, [])
  assert.throws(
    () =>
      parsePlan({ modules: { ai: { selection: 'required', basis: 'guess', reason: 'unknown' } } }),
    /Invalid project plan/,
  )
  assert.throws(
    () =>
      parsePlan({
        decisions: [
          {
            id: 'payment',
            question: '收费方式',
            status: 'resolved',
            value: '',
            basis: 'default',
            reason: '未问用户',
          },
        ],
      }),
    /value/,
  )
})

test('initialization never inherits completed tasks or passed acceptance from a plan', () => {
  const plan = initialPlan('新需求', {
    tasks: [{ id: 'work', title: '实现', status: 'implemented', evidence: ['old.md'] }],
    acceptance: [
      {
        id: 'flow',
        title: '旧记录',
        kind: 'business',
        scope: 'provider',
        steps: ['结账'],
        expected: '成功',
        status: 'passed',
        verification: 'real',
        evidence: ['old.md'],
      },
    ],
  })
  assert.equal(plan.tasks[0].status, 'todo')
  assert.equal(plan.acceptance[0].status, 'pending')
  assert.deepEqual(plan.acceptance[0].evidence, [])
})

test('cloud cost defaults stay a preference, preserve user budgets and do not break older plans', async (t) => {
  const root = product(t)
  const plan = loadPlan(root)
  const cost = plan.decisions.find((decision) => decision.id === cloudCostDecisionId)
  assert.equal(cost.basis, 'default')
  assert.equal(cost.blocking, false)
  assert.equal(projectStatus(root).cloudCostPolicy.value, cost.value)
  const config = parseJsonc(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'))
  assert.equal(config.r2_buckets, undefined)
  assert.equal(config.send_email, undefined)
  assert.equal(config.vars.MAIL_MODE, 'disabled')
  assert.equal(config.vars.BILLING_ENABLED, 'false')

  const preference = {
    id: cloudCostDecisionId,
    question: '云成本预算',
    status: 'resolved',
    value: '复用已有套餐；新增月预算 USD 12；只准备方案',
    basis: 'user',
    reason: '用户明确给出的预算，不代表购买授权',
    blocking: false,
  }
  const input = join(dirname(root), 'budget-plan.json')
  writeFileSync(input, JSON.stringify({ decisions: [preference] }))
  const target = createProject({
    source,
    target: join(dirname(root), 'budgeted'),
    plan: input,
    install: false,
  }).target
  assert.deepEqual(loadPlan(target).decisions, [preference])
  assert.ok(readFileSync(join(target, 'PROJECT.md'), 'utf8').includes(preference.value))
  const budgetedConfig = parseJsonc(readFileSync(join(target, 'wrangler.jsonc'), 'utf8'))
  assert.equal(budgetedConfig.send_email, undefined)
  assert.equal(budgetedConfig.vars.BILLING_ENABLED, 'false')

  const legacy = completePlan(root)
  legacy.decisions = []
  savePlan(root, legacy)
  assert.equal(projectStatus(root).cloudCostPolicy, null)
  assert.equal(projectStatus(root).businessVerified, true)
  fakeDependencies(root)
  const report = await doctor(root)
  assert.equal(report.checks.find((check) => check.id === 'cloud-cost-policy').status, 'warn')
  assert.equal(report.ok, true)
  assert.deepEqual(loadPlan(root).decisions, [])
})

test('plan input fills human handoff while retaining provenance and pending business state', (t) => {
  const root = product(t)
  const input = join(dirname(root), 'plan.json')
  writeFileSync(
    input,
    JSON.stringify({
      goal: '私有知识库',
      audience: '研究者',
      coreFlow: ['创建条目', '检索'],
      outOfScope: ['团队协作'],
      modules: { ai: { selection: 'deferred', basis: 'user', reason: '首版不调用模型' } },
    }),
  )
  const output = createProject({
    source,
    target: join(dirname(root), 'planned'),
    name: 'Knowledge',
    plan: input,
    install: false,
  }).target
  const human = readFileSync(join(output, 'PROJECT.md'), 'utf8')
  assert.match(human, /研究者/)
  assert.match(human, /创建条目 → 检索/)
  assert.match(human, /团队协作/)
  assert.equal(loadPlan(output).modules.ai.basis, 'user')
  assert.equal(projectStatus(output).businessVerified, false)
})

test('business readiness requires business evidence, not just bootstrap or baseline tests', (t) => {
  const root = product(t)
  const initial = loadPlan(root)
  assert.equal(planProblems(root, initial).ready, false)
  const plan = completePlan(root)
  assert.equal(planProblems(root, plan).ready, true)
  plan.acceptance[0].kind = 'baseline'
  assert.equal(planProblems(root, plan).ready, false)
  plan.acceptance[0].kind = 'business'
  plan.acceptance[0].evidence = ['missing.md']
  assert.ok(planProblems(root, plan).errors.length)
  plan.acceptance[0].evidence = ['qa/acceptance.md']
  mkdirSync(join(root, 'qa'), { recursive: true })
  writeFileSync(join(root, 'qa/acceptance.md'), '# Historical starter evidence\n')
  assert.ok(planProblems(root, plan).errors.some((item) => item.includes('历史')))
  writeFileSync(join(dirname(root), 'outside.md'), 'not project evidence')
  symlinkSync(join(dirname(root), 'outside.md'), join(root, 'linked.md'))
  plan.acceptance[0].evidence = ['linked.md']
  assert.ok(planProblems(root, plan).errors.length)
})

test('mocked provider state cannot pass a real-provider acceptance case', (t) => {
  const root = product(t)
  const plan = completePlan(root)
  plan.acceptance[0].scope = 'provider'
  plan.acceptance[0].verification = 'mock'
  assert.throws(() => parsePlan(plan), /mock cannot prove/)
  plan.acceptance[0].verification = 'real'
  assert.doesNotThrow(() => parsePlan(plan))
})

test('failed bootstrap resumes without copying over code, secrets or business progress', (t) => {
  const root = product(t)
  const secret = readFileSync(join(root, '.dev.vars'))
  const plan = loadPlan(root)
  plan.handoff.next = ['继续私人笔记页面']
  savePlan(root, plan)
  writeFileSync(join(root, 'src/business.ts'), 'export const preserved = true\n')
  const first = []
  assert.throws(
    () =>
      resumeProject(root, {
        run: (args) => {
          first.push(args[0])
          if (args[0] === 'install') {
            fakeDependencies(root)
            return 0
          }
          return 1
        },
      }),
    /database/,
  )
  assert.deepEqual(first, ['install', 'setup'])
  assert.equal(loadPlan(root).bootstrap.database.status, 'failed')
  const second = []
  resumeProject(root, {
    run: (args) => {
      second.push(args[0])
      return 0
    },
  })
  assert.deepEqual(second, ['setup', 'exec'])
  assert.equal(loadPlan(root).bootstrap.format.status, 'done')
  assert.deepEqual(readFileSync(join(root, '.dev.vars')), secret)
  assert.match(readFileSync(join(root, 'src/business.ts'), 'utf8'), /preserved/)
  assert.deepEqual(projectStatus(root).next, ['继续私人笔记页面'])
  assert.equal(projectStatus(root).businessVerified, false)
  const third = []
  resumeProject(root, {
    run: (args) => {
      third.push(args[0])
      return 0
    },
  })
  assert.deepEqual(third, ['setup'])
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  manifest.dependencies.newFixture = '1.0.0'
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest))
  const changed = []
  resumeProject(root, {
    run: (args) => {
      changed.push(args[0])
      return 0
    },
  })
  assert.deepEqual(changed, ['install', 'setup'])
})

test('resume rejects remote or missing local secrets without invoking any command', (t) => {
  const root = product(t)
  writeFileSync(
    join(root, '.dev.vars'),
    'ENVIRONMENT=production\nMAIL_MODE=cloudflare\nAPP_ORIGIN=https://example.com\n',
  )
  let calls = 0
  assert.throws(
    () =>
      resumeProject(root, {
        run: () => {
          calls++
          return 0
        },
      }),
    /local/,
  )
  assert.equal(calls, 0)
  unlinkSync(join(root, '.dev.vars'))
  assert.throws(
    () =>
      resumeProject(root, {
        run: () => {
          calls++
          return 0
        },
      }),
    /缺少 .dev.vars/,
  )
  assert.equal(calls, 0)
  assert.throws(
    () => parseLocalVars('BETTER_AUTH_SECRET=fixture\nBETTER_AUTH_SECRET=other'),
    /重复键/,
  )
})

test('doctor redacts credentials and port occupancy is a warning, not permission to stop a service', async (t) => {
  const root = product(t)
  let vars = readFileSync(join(root, '.dev.vars'), 'utf8').replace(
    'GOOGLE_AUTH_ENABLED=false',
    'GOOGLE_AUTH_ENABLED=true',
  )
  vars +=
    'GOOGLE_CLIENT_ID=private-client-fixture\nGOOGLE_CLIENT_SECRET=private-secret-fixture\nSTRIPE_SECRET_KEY=sk_live_private-fixture\nBREVO_API_KEY=private-brevo-fixture\nRESEND_API_KEY=private-resend-fixture\nCREEM_API_KEY=private-creem-fixture\nCREEM_WEBHOOK_SECRET=private-creem-webhook-fixture\n'
  writeFileSync(join(root, '.dev.vars'), vars)
  const report = await doctor(root, { pnpmVersion: '12.11.2', portProbe: async () => 'occupied' })
  const output = JSON.stringify(report)
  for (const secret of [
    'private-client-fixture',
    'private-secret-fixture',
    'sk_live_private-fixture',
    'private-brevo-fixture',
    'private-resend-fixture',
    'private-creem-fixture',
    'private-creem-webhook-fixture',
  ])
    assert.ok(!output.includes(secret))
  assert.equal(report.checks.find((item) => item.id === 'billing').status, 'error')
  assert.equal(report.checks.find((item) => item.id === 'port-3100').status, 'warn')
  assert.equal(existsSync(join(root, '.wrangler')), false)
})

test('doctor entrypoint runs before dependency installation and never installs anything', (t) => {
  const root = product(t)
  const result = spawnSync(process.execPath, ['scripts/project.mjs', 'doctor', '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  })
  assert.equal(result.status, 2)
  const report = JSON.parse(result.stdout)
  assert.equal(report.checks.find((item) => item.id === 'dependencies').status, 'error')
  assert.equal(existsSync(join(root, 'node_modules')), false)
  assert.equal(existsSync(join(root, '.wrangler')), false)
})
