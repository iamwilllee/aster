import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  featurePreset,
  featuresFromPlan,
  validateFeatures,
} from '../../src/config/feature-policy.mjs'
import { createProject } from '../../skills/aster-new/scripts/create-project.mjs'
import {
  loadPlan,
  savePlan,
  planProblems,
  initialPlan,
  resumeProject,
} from '../../scripts/project-workflow.mjs'
import { moduleChange, applyModuleChange } from '../../scripts/project-modules.mjs'
import { readFeatures } from '../../scripts/project-features.mjs'
import { assertLocalProject } from '../../scripts/project-local.mjs'
import { deploymentPolicy } from '../../scripts/deployment-policy.mjs'

const source = resolve('.')
const choices = (features) =>
  Object.fromEntries(
    Object.entries(features).map(([key, enabled]) => [
      key,
      {
        selection: enabled ? 'required' : 'deferred',
        basis: 'context',
        reason: 'Fixture product selection',
      },
    ]),
  )
function fixture(t, profile = 'web-app') {
  const temp = mkdtempSync(join(tmpdir(), 'aster-modules-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const plan = join(temp, 'plan.json')
  writeFileSync(plan, JSON.stringify({ modules: choices(featurePreset(profile)) }))
  return createProject({
    source,
    target: join(temp, 'product'),
    name: 'Keep My Brand',
    plan,
    install: false,
  }).target
}

test('module dependencies reject unsafe combinations and unimplemented capabilities', () => {
  const publicSite = featurePreset('showcase')
  assert.ok(Object.values(publicSite).every((value) => !value))
  assert.throws(() => validateFeatures({ ...publicSite, projects: true }), /requires/)
  assert.throws(
    () => validateFeatures({ ...publicSite, database: true, auth: true }),
    /login method/,
  )
  assert.throws(() => validateFeatures({ ...publicSite, ai: true }), /not implemented/)
  assert.throws(
    () => validateFeatures({ ...publicSite, secret: 'private-fixture' }),
    /Invalid feature/,
  )
  const normal = featuresFromPlan(
    initialPlan('Normal site', {
      modules: { ai: { selection: 'deferred', basis: 'user', reason: 'No AI' } },
    }),
  )
  assert.equal(normal.ai, false)
  assert.equal(normal.billing, false)
})

test('fresh showcase omits DB bindings, auth keys and external configuration; local recovery is valid', (t) => {
  const root = fixture(t, 'showcase')
  assert.deepEqual(readFeatures(root).features, featurePreset('showcase'))
  const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'))
  assert.equal(config.d1_databases, undefined)
  assert.equal(config.env.staging.d1_databases, undefined)
  const local = readFileSync(join(root, '.dev.vars'), 'utf8')
  assert.ok(local.includes('MAIL_MODE=disabled'))
  assert.ok(!local.includes('BETTER_AUTH_SECRET'))
  assert.doesNotThrow(() => assertLocalProject(root))
  const log = join(root, '.local-setup-log')
  const shim = join(root, 'pnpm')
  writeFileSync(shim, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ASTER_SETUP_LOG"\n', { mode: 0o700 })
  const result = spawnSync(process.execPath, ['scripts/setup.mjs'], {
    cwd: root,
    env: { ...process.env, PATH: root + ':' + process.env.PATH, ASTER_SETUP_LOG: log },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['exec wrangler types'])
})

test('feature changes preserve brand, data and secrets, invalidate affected evidence, and reject stale plans', (t) => {
  const root = fixture(t)
  const brand = readFileSync(join(root, 'src/config/site.ts'), 'utf8')
  const vars = readFileSync(join(root, '.dev.vars'), 'utf8')
  const secret = vars.match(/BETTER_AUTH_SECRET=(.*)/)[1]
  writeFileSync(join(root, 'business-data.fixture'), 'Must remain')
  const plan = loadPlan(root)
  plan.acceptance.push({
    id: 'auth-email-live',
    title: 'Fixture',
    kind: 'business',
    scope: 'provider',
    required: true,
    status: 'passed',
    verification: 'real',
    evidence: ['src/config/site.ts'],
    steps: ['Fixture'],
    expected: 'Fixture',
  })
  savePlan(root, plan)
  const change = moduleChange(root, choices(featurePreset('showcase')))
  const result = applyModuleChange(root, change)
  assert.ok(existsSync(join(root, result.backup, 'manifest.json')))
  assert.equal(readFileSync(join(root, 'src/config/site.ts'), 'utf8'), brand)
  assert.equal(readFileSync(join(root, 'business-data.fixture'), 'utf8'), 'Must remain')
  assert.ok(readFileSync(join(root, '.dev.vars'), 'utf8').includes(secret))
  assert.equal(loadPlan(root).acceptance.at(-1).status, 'pending')
  assert.equal(
    planProblems(root, loadPlan(root)).pending.some((text) => text.includes('Fixture')),
    false,
  )
  assert.throws(() => applyModuleChange(root, change), /stale/)
  applyModuleChange(root, moduleChange(root, choices(featurePreset('web-app'))))
  assert.ok(readFileSync(join(root, '.dev.vars'), 'utf8').includes(secret))
  assert.ok(readFileSync(join(root, '.dev.vars'), 'utf8').includes('MAIL_MODE=local'))
  assert.doesNotThrow(() => assertLocalProject(root))
})

test('existing real bindings are preserved; new activation prepares only placeholders and an absent local auth key', (t) => {
  const root = fixture(t, 'showcase')
  applyModuleChange(root, moduleChange(root, choices(featurePreset('web-app'))))
  const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'))
  assert.equal(config.d1_databases[0].binding, 'DB')
  const firstSecret = readFileSync(join(root, '.dev.vars'), 'utf8').match(
    /BETTER_AUTH_SECRET=(.*)/,
  )[1]
  assert.ok(firstSecret.length >= 32)
  config.d1_databases[0].database_id = 'existing-real-binding'
  writeFileSync(join(root, 'wrangler.jsonc'), JSON.stringify(config))
  applyModuleChange(root, moduleChange(root, choices(featurePreset('showcase'))))
  assert.equal(
    JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')).d1_databases[0].database_id,
    'existing-real-binding',
  )
  assert.ok(readFileSync(join(root, '.dev.vars'), 'utf8').includes(firstSecret))
})

test('required existing billing cannot be casually removed; checkout disable is a separate runtime switch', (t) => {
  const root = fixture(t, 'billing-test')
  assert.throws(() => moduleChange(root, choices(featurePreset('web-app'))), /portals\/webhooks/)
})

test('showcase release needs no auth/email/Google/Stripe/provider records or DB, while selected methods remain gated', () => {
  const vars = {
    ENVIRONMENT: 'production',
    APP_ORIGIN: 'https://public.product.test',
    MAIL_MODE: 'disabled',
    GOOGLE_AUTH_ENABLED: 'false',
  }
  const base = { vars }
  const features = featurePreset('showcase')
  assert.deepEqual(deploymentPolicy(base, undefined, { modules: choices(features) }, features), {
    problems: [],
    requiredSecrets: [],
  })
  const googleOnly = {
    ...featurePreset('web-app'),
    mail: false,
    emailPassword: false,
    google: true,
    projects: false,
  }
  const config = {
    vars: { ...vars, GOOGLE_AUTH_ENABLED: 'true' },
    d1_databases: [{ binding: 'DB', database_id: 'production-fixture' }],
  }
  const plan = {
    modules: choices(googleOnly),
    acceptance: [
      {
        id: 'auth-google-live',
        kind: 'business',
        scope: 'provider',
        status: 'passed',
        verification: 'real',
        evidence: ['fixture.md'],
      },
    ],
  }
  const result = deploymentPolicy(config, undefined, plan, googleOnly)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.requiredSecrets, [
    'BETTER_AUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ])
  plan.acceptance = []
  assert.ok(
    deploymentPolicy(config, undefined, plan, googleOnly).problems.some((message) =>
      message.includes('auth-google-live'),
    ),
  )
  const missingMail = { vars, d1_databases: [{ binding: 'DB', database_id: 'production-fixture' }] }
  assert.ok(
    deploymentPolicy(missingMail, undefined, {}, featurePreset('web-app')).problems.some(
      (message) => message.includes('transactional mail'),
    ),
  )
})

test('legacy plans remain readable, unrelated deferred cases and inactive provider checkpoints do not block selected business readiness', (t) => {
  const root = fixture(t, 'showcase')
  const plan = loadPlan(root)
  plan.goal = 'Public product'
  plan.coreFlow = ['Read content']
  for (const step of Object.values(plan.bootstrap))
    if (typeof step === 'object') step.status = 'done'
  plan.tasks = [
    { id: 'site', title: 'Content', status: 'implemented', evidence: ['src/config/site.ts'] },
  ]
  plan.acceptance = [
    {
      id: 'public-page',
      title: 'Read content',
      kind: 'business',
      scope: 'local',
      required: true,
      status: 'passed',
      verification: 'local',
      evidence: ['src/config/site.ts'],
      steps: ['Read'],
      expected: 'Content',
    },
    {
      id: 'auth-email-live',
      title: 'Inactive email',
      kind: 'business',
      scope: 'provider',
      required: true,
      status: 'blocked',
      evidence: [],
      verification: 'unverified',
      steps: ['Receive'],
      expected: 'Mail',
    },
  ]
  assert.equal(planProblems(root, plan).ready, true)
  plan.modules.auth.selection = 'required'
  assert.ok(planProblems(root, plan).errors.some((message) => message.includes('auth')))
})

test('module CLI previews without writes, rejects unknown/unsafe inputs and preserves concurrent locks', (t) => {
  const root = fixture(t)
  const run = (args) =>
    spawnSync(process.execPath, [join(source, 'scripts/project-modules.mjs'), ...args], {
      cwd: root,
      encoding: 'utf8',
    })
  const before = readFileSync(join(root, 'starter.project.json'), 'utf8')
  assert.equal(run(['--profile', 'showcase']).status, 0)
  assert.equal(readFileSync(join(root, 'starter.project.json'), 'utf8'), before)
  const input = join(root, 'private-input.json')
  writeFileSync(input, JSON.stringify({ apiKey: 'private-do-not-echo' }))
  const bad = run(['--input', input, '--apply'])
  assert.equal(bad.status, 2)
  assert.ok(!(bad.stdout + bad.stderr).includes('private-do-not-echo'))
  assert.equal(run(['--apply']).status, 2)
  mkdirSync(join(root, '.local'))
  writeFileSync(join(root, '.local/module-changes.lock'), 'other owner')
  assert.equal(run(['--profile', 'showcase', '--apply']).status, 2)
  assert.equal(readFileSync(join(root, '.local/module-changes.lock'), 'utf8'), 'other owner')
  assert.ok(existsSync(join(root, '.local/module-changes.lock')))
})

test('profile CLI creates a real new showcase and rejects conflicting plan/profile inputs before writing', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'aster-profile-cli-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const target = join(temp, 'site')
  const result = spawnSync(
    process.execPath,
    [
      join(source, 'skills/aster-new/scripts/create-project.mjs'),
      target,
      '--profile',
      'showcase',
      '--no-install',
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readFeatures(target).features, featurePreset('showcase'))
  const plan = join(temp, 'plan.json')
  writeFileSync(plan, '{}')
  const conflict = spawnSync(
    process.execPath,
    [
      join(source, 'skills/aster-new/scripts/create-project.mjs'),
      join(temp, 'conflict'),
      '--profile',
      'showcase',
      '--plan',
      plan,
      '--no-install',
    ],
    { encoding: 'utf8' },
  )
  assert.equal(conflict.status, 1)
  assert.equal(existsSync(join(temp, 'conflict')), false)
})

test('public bootstrap records database as skipped and reactivation requires setup again', (t) => {
  const root = fixture(t, 'showcase')
  const completed = resumeProject(root, { run: () => 0 })
  assert.equal(completed.bootstrap.database.status, 'skipped')
  const change = moduleChange(root, choices(featurePreset('web-app')))
  assert.equal(change.plan.bootstrap.database.status, 'pending')
})

test('initializer carries an explicit Creem choice into every environment without inheriting keys or enabling checkout', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'aster-payment-choice-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const plan = join(temp, 'plan.json')
  writeFileSync(
    plan,
    JSON.stringify({
      modules: choices(featurePreset('billing-test')),
      decisions: [
        {
          id: 'payment-provider',
          question: 'Payment provider',
          status: 'resolved',
          value: 'creem',
          basis: 'user',
          reason: 'Selected sandbox provider',
          blocking: false,
        },
      ],
    }),
  )
  const target = join(temp, 'product')
  createProject({ source, target, plan, install: false })
  const config = JSON.parse(readFileSync(join(target, 'wrangler.jsonc'), 'utf8'))
  for (const vars of [config.vars, config.env.staging.vars]) {
    assert.equal(vars.BILLING_PROVIDER, 'creem')
    assert.equal(vars.BILLING_ENABLED, 'false')
    assert.equal(vars.CREEM_API_KEY, undefined)
  }
  assert.match(readFileSync(join(target, '.dev.vars'), 'utf8'), /BILLING_PROVIDER=creem/)
  assert.doesNotMatch(readFileSync(join(target, '.dev.vars'), 'utf8'), /CREEM_API_KEY/)
  const input = JSON.parse(readFileSync(plan, 'utf8'))
  input.decisions[0].value = 'paddle'
  writeFileSync(plan, JSON.stringify(input))
  assert.throws(
    () => createProject({ source, target: join(temp, 'unsupported'), plan, install: false }),
    /not implemented/,
  )
  assert.equal(existsSync(join(temp, 'unsupported')), false)
})

test('private images require auth/database, get isolated placeholders and refuse remote local storage', (t) => {
  assert.throws(() => validateFeatures({ ...featurePreset('showcase'), files: true }), /requires/)
  const temp = mkdtempSync(join(tmpdir(), 'aster-files-module-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const selected = { ...featurePreset('web-app'), files: true }
  const plan = join(temp, 'plan.json')
  writeFileSync(plan, JSON.stringify({ modules: choices(selected) }))
  const root = createProject({ source, target: join(temp, 'images'), plan, install: false }).target
  assert.equal(readFeatures(root).features.files, true)
  const path = join(root, 'wrangler.jsonc'),
    config = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(config.r2_buckets[0].binding, 'ASSETS_BUCKET')
  assert.notEqual(config.r2_buckets[0].bucket_name, config.env.staging.r2_buckets[0].bucket_name)
  assert.doesNotThrow(() => assertLocalProject(root))
  config.r2_buckets[0].remote = true
  writeFileSync(path, JSON.stringify(config))
  assert.throws(() => assertLocalProject(root), /remote R2/)
})

test('content is opt-in, old configs stay disabled, and text content needs no R2 binding', (t) => {
  const old = featurePreset('web-app')
  delete old.content
  assert.equal(validateFeatures(old).content, false)
  assert.equal(featurePreset('showcase').content, false)
  assert.throws(() => validateFeatures({ ...featurePreset('showcase'), content: true }), /requires/)
  const temp = mkdtempSync(join(tmpdir(), 'aster-content-module-'))
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  const plan = join(temp, 'plan.json')
  writeFileSync(
    plan,
    JSON.stringify({ modules: choices({ ...featurePreset('web-app'), content: true }) }),
  )
  const root = createProject({ source, target: join(temp, 'content'), plan, install: false }).target
  assert.equal(readFeatures(root).features.content, true)
  assert.equal(JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')).r2_buckets, undefined)
  assert.equal(loadPlan(root).modules.content.selection, 'required')
  assert.ok(
    deploymentPolicy(
      {
        vars: {
          ENVIRONMENT: 'production',
          APP_ORIGIN: 'https://content.example',
          MAIL_MODE: 'disabled',
          GOOGLE_AUTH_ENABLED: 'false',
          PUBLIC_INDEXABLE: 'false',
        },
      },
      undefined,
      {},
      readFeatures(root).features,
    ).problems.some((p) => p.includes('content-live')),
  )
})
