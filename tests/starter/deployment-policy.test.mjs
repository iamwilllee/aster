import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { deploymentPolicy, missingDeploymentSecrets } from '../../scripts/deployment-policy.mjs'

function config() {
  const environment = (staging) => ({
    vars: {
      ENVIRONMENT: staging ? 'staging' : 'production',
      APP_ORIGIN: staging ? 'https://preview.product.example' : 'https://product.example',
      MAIL_MODE: 'cloudflare',
      MAIL_FROM: 'Product <accounts@mail.product.example>',
      GOOGLE_AUTH_ENABLED: 'false',
      PUBLIC_INDEXABLE: 'false',
    },
    d1_databases: [
      { binding: 'DB', database_id: staging ? 'staging-fixture-id' : 'production-fixture-id' },
    ],
    send_email: [{ name: 'EMAIL' }],
  })
  return { ...environment(false), env: { staging: environment(true) } }
}
function livePlan() {
  return {
    acceptance: ['auth-email-live', 'auth-google-live'].map((id) => ({
      id,
      title: id,
      kind: 'business',
      scope: 'provider',
      status: 'passed',
      verification: 'real',
      evidence: ['provider-evidence.md'],
      steps: ['Fixture only; no real provider is called by this test'],
      expected: 'Policy fixture',
    })),
  }
}
test('email-only releases do not require Google, while optional or selected Google follows the plan', () => {
  const base = config()
  assert.deepEqual(deploymentPolicy(base, undefined, livePlan()).problems, [])
  assert.deepEqual(deploymentPolicy(base).requiredSecrets, ['BETTER_AUTH_SECRET'])
  base.vars.GOOGLE_AUTH_ENABLED = 'true'
  assert.ok(
    deploymentPolicy(base, undefined, { modules: { google: { selection: 'deferred' } } }).problems
      .length,
  )
  const selected = deploymentPolicy(base, undefined, {
    ...livePlan(),
    modules: { google: { selection: 'required' } },
  })
  assert.deepEqual(selected.problems, [])
  assert.deepEqual(missingDeploymentSecrets(selected.requiredSecrets, ['BETTER_AUTH_SECRET']), [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ])
  assert.deepEqual(missingDeploymentSecrets(selected.requiredSecrets, selected.requiredSecrets), [])
  base.vars.GOOGLE_AUTH_ENABLED = 'false'
  assert.ok(
    deploymentPolicy(base, undefined, { modules: { google: { selection: 'required' } } }).problems
      .length,
  )
})
test('public release requires real selected-provider records; staging and mock tests cannot stand in for them', () => {
  const base = config()
  base.vars.GOOGLE_AUTH_ENABLED = 'true'
  const plan = livePlan()
  plan.acceptance[1].verification = 'mock'
  assert.ok(
    deploymentPolicy(base, undefined, plan).problems.some((problem) =>
      problem.includes('auth-google-live'),
    ),
  )
  plan.acceptance[0].status = 'pending'
  assert.ok(
    deploymentPolicy(base, undefined, plan).problems.some((problem) =>
      problem.includes('auth-email-live'),
    ),
  )
  assert.deepEqual(deploymentPolicy(base, 'staging', { acceptance: [] }).problems, [])
})
test('data-only staging is allowed but an unconfigured public signup release is rejected', () => {
  const base = config()
  base.vars.MAIL_MODE = 'disabled'
  base.env.staging.vars.MAIL_MODE = 'disabled'
  delete base.send_email
  delete base.env.staging.send_email
  assert.deepEqual(deploymentPolicy(base, 'staging').problems, [])
  assert.ok(
    deploymentPolicy(base).problems.some((problem) => problem.includes('transactional mail')),
  )
  base.vars.MAIL_MODE = 'cloudflare'
  assert.ok(deploymentPolicy(base).problems.some((problem) => problem.includes('EMAIL')))
  base.send_email = [{ name: 'EMAIL' }]
  base.vars.MAIL_FROM = 'Aster <no-reply@example.invalid>'
  assert.ok(deploymentPolicy(base).problems.some((problem) => problem.includes('MAIL_FROM')))
})
test('external mail requires only the chosen secret and sender, without requiring a CF binding', () => {
  for (const mode of ['brevo', 'resend']) {
    const base = config()
    base.vars.MAIL_MODE = mode
    delete base.send_email
    const selected = deploymentPolicy(base, undefined, livePlan())
    const key = mode === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY'
    assert.deepEqual(selected.problems, [])
    assert.deepEqual(selected.requiredSecrets, ['BETTER_AUTH_SECRET', key])
    assert.deepEqual(missingDeploymentSecrets(selected.requiredSecrets, ['BETTER_AUTH_SECRET']), [
      key,
    ])
    base.vars[key] = 'fixture-not-a-real-key'
    assert.ok(deploymentPolicy(base).problems.some((problem) => problem.includes('never in vars')))
    delete base.vars[key]
    base.send_email = [{ name: 'EMAIL' }]
    // Existing bindings may serve other business flows; do not delete/reject them blindly.
    assert.deepEqual(deploymentPolicy(base, undefined, livePlan()).problems, [])
    delete base.send_email
    base.vars.MAIL_FROM = 'Aster <no-reply@example.invalid>'
    assert.ok(deploymentPolicy(base).problems.some((problem) => problem.includes('MAIL_FROM')))
  }
})
test('local preflight has no remote calls, and missing remote auth secrets stops before build/deploy', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'aster-deploy-policy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const log = join(root, 'commands.log')
  writeFileSync(join(root, 'wrangler.jsonc'), JSON.stringify(config()))
  writeFileSync(join(root, 'starter.project.json'), JSON.stringify(livePlan()))
  writeFileSync(
    join(root, 'provider-evidence.md'),
    'Policy test fixture; not actual provider acceptance.',
  )
  writeFileSync(
    join(root, 'pnpm'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ASTER_DEPLOY_PROBE"\nprintf "[]\\n"\n',
    { mode: 0o700 },
  )
  const env = { ...process.env, PATH: root + ':' + process.env.PATH, ASTER_DEPLOY_PROBE: log }
  const script = resolve('scripts/deploy.mjs')
  const local = spawnSync(process.execPath, [script, '--check'], {
    cwd: root,
    env,
    encoding: 'utf8',
  })
  assert.equal(local.status, 0, local.stderr)
  const blocked = spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' })
  assert.notEqual(blocked.status, 0)
  assert.match(blocked.stderr, /BETTER_AUTH_SECRET/)
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), [
    'exec wrangler secret list --format json',
  ])
})

test('Creem selection requires its own sandbox evidence and secrets, retaining explicitly named legacy channels', () => {
  const base = config()
  base.vars.BILLING_PROVIDER = 'creem'
  base.vars.BILLING_LEGACY_PROVIDERS = 'stripe'
  const flags = {
    database: true,
    auth: true,
    emailPassword: true,
    mail: true,
    billing: true,
    google: false,
    projects: true,
    ai: false,
    files: false,
    usage: false,
  }
  const selected = livePlan()
  selected.acceptance.push({
    id: 'billing-test-live',
    kind: 'business',
    scope: 'provider',
    status: 'passed',
    verification: 'real',
    evidence: ['provider-evidence.md'],
  })
  let result = deploymentPolicy(base, undefined, selected, flags)
  assert.ok(result.problems.some((problem) => problem.includes('billing-creem-test-live')))
  assert.ok(result.requiredSecrets.includes('CREEM_API_KEY'))
  assert.ok(result.requiredSecrets.includes('STRIPE_WEBHOOK_SECRET'))
  selected.acceptance.push({
    id: 'billing-creem-test-live',
    kind: 'business',
    scope: 'provider',
    status: 'passed',
    verification: 'real',
    evidence: ['provider-evidence.md'],
  })
  result = deploymentPolicy(base, undefined, selected, flags)
  assert.equal(
    result.problems.some((problem) => problem.includes('billing-creem-test-live')),
    false,
  )
  base.vars.BILLING_LEGACY_PROVIDERS = 'unknown'
  assert.ok(
    deploymentPolicy(base, undefined, selected, flags).problems.some((problem) =>
      problem.includes('BILLING_PROVIDER'),
    ),
  )
})

test('selected private images require distinct real bucket configuration and current provider evidence', () => {
  const base = config(),
    features = {
      database: true,
      auth: true,
      emailPassword: true,
      mail: true,
      google: false,
      projects: true,
      billing: false,
      files: true,
      ai: false,
      usage: false,
    }
  const plan = livePlan()
  assert.ok(
    deploymentPolicy(base, 'staging', plan, features).problems.some((p) =>
      p.includes('ASSETS_BUCKET'),
    ),
  )
  base.r2_buckets = [{ binding: 'ASSETS_BUCKET', bucket_name: 'production-fixture-assets' }]
  base.env.staging.r2_buckets = [
    { binding: 'ASSETS_BUCKET', bucket_name: 'staging-fixture-assets' },
  ]
  assert.ok(
    deploymentPolicy(base, undefined, plan, features).problems.some((p) =>
      p.includes('files-live'),
    ),
  )
  plan.acceptance.push({ ...plan.acceptance[0], id: 'files-live' })
  assert.deepEqual(deploymentPolicy(base, undefined, plan, features).problems, [])
  plan.acceptance.at(-1).verification = 'mock'
  assert.ok(
    deploymentPolicy(base, undefined, plan, features).problems.some((p) =>
      p.includes('files-live'),
    ),
  )
  base.env.staging.r2_buckets[0].bucket_name = base.r2_buckets[0].bucket_name
  assert.ok(
    deploymentPolicy(base, 'staging', plan, features).problems.some((p) =>
      p.includes('different R2'),
    ),
  )
})
