import { hashPassword } from 'better-auth/crypto'
import { featurePreset } from '../src/config/feature-policy.mjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import https from 'node:https'
import net from 'node:net'
import { parse } from 'jsonc-parser'
import { setImmediate as flushWorkerLogs } from 'node:timers/promises'

// Everything writable for this run is below a fresh, ignored directory. No developer DB or secrets are read.
const work = resolve('.wrangler/acceptance', randomUUID())
mkdirSync(work, { recursive: true })
const config = join(work, 'wrangler.json')
const output = join(work, 'dist')
const state = join(work, 'state')
const base = parse(readFileSync('wrangler.jsonc', 'utf8'), [], { allowTrailingComma: true })
const origin = 'https://127.0.0.1:3110'
const args = process.argv.slice(2)
if (
  args.length &&
  (args.length !== 2 ||
    args[0] !== '--profile' ||
    !['web-app', 'showcase', 'google-only', 'creem'].includes(args[1]))
)
  throw new Error('Use test:production [--profile web-app|showcase|google-only|creem]')
const configuredFeatures = JSON.parse(readFileSync('src/config/features.json', 'utf8'))
// A freshly generated showcase must pass the normal command without inventing auth dependencies.
const profile =
  args[1] ??
  (Object.values(configuredFeatures).every((value) => value === false) ? 'showcase' : 'default')
const features =
  profile === 'showcase'
    ? featurePreset('showcase')
    : profile === 'google-only'
      ? {
          ...featurePreset('web-app'),
          emailPassword: false,
          mail: false,
          google: true,
          projects: false,
        }
      : profile === 'web-app'
        ? featurePreset('web-app')
        : profile === 'creem'
          ? featurePreset('billing-test')
          : { ...configuredFeatures, google: configuredFeatures.auth }
const appearanceConfig = join(work, 'appearance.json')
writeFileSync(
  appearanceConfig,
  JSON.stringify({ theme: profile === 'showcase' ? 'catalog' : 'sage' }),
)
const featureConfig = join(work, 'features.json')
writeFileSync(featureConfig, JSON.stringify(features))
writeFileSync(
  config,
  JSON.stringify({
    name: 'starter-production-smoke',
    main: base.main,
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    vars: {
      ENVIRONMENT: 'production',
      APP_ORIGIN: origin,
      MAIL_MODE: 'disabled',
      MAIL_FROM: 'Aster <no-reply@example.invalid>',
      BILLING_ENABLED: 'false',
      BILLING_PROVIDER: profile === 'creem' ? 'creem' : 'stripe',
      GOOGLE_AUTH_ENABLED: features.google ? 'true' : 'false',
      PUBLIC_INDEXABLE: 'false',
    },
    d1_databases: features.database
      ? [
          {
            binding: 'DB',
            database_name: 'starter-smoke-db',
            database_id: randomUUID(),
            migrations_dir: resolve('migrations'),
          },
        ]
      : [],
    r2_buckets: features.files
      ? [{ binding: 'ASSETS_BUCKET', bucket_name: 'isolated-smoke-assets' }]
      : [],
  }),
)
writeFileSync(
  join(work, '.dev.vars'),
  features.auth
    ? `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nGOOGLE_CLIENT_ID=fixture-only.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=fixture-only-not-a-real-google-secret\n${profile === 'creem' ? 'CREEM_API_KEY=fixture-test-only\nCREEM_WEBHOOK_SECRET=fixture-webhook-only\nCREEM_PRODUCT_ID=prod_fixture\n' : ''}`
    : '',
  { mode: 0o600 },
)
const redirect = resolve('.wrangler/deploy/config.json')
const previous = existsSync(redirect) ? readFileSync(redirect) : null
const taskEnv = {
  ...process.env,
  STARTER_SMOKE_PROFILE: profile,
  STARTER_SMOKE_CONTENT: String(features.content),
  STARTER_SMOKE_FILES: String(features.files),
  STARTER_SMOKE_BILLING: String(features.billing),
  STARTER_SMOKE_GOOGLE: String(features.google),
  STARTER_SMOKE_APPEARANCE: appearanceConfig,
  STARTER_SMOKE_FEATURES: featureConfig,
  STARTER_SMOKE_CONFIG: config,
  STARTER_SMOKE_OUT: output,
  STARTER_SMOKE_URL: origin,
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
}
for (const key of Object.keys(taskEnv)) {
  if (
    /^(GOOGLE_|STRIPE_|CREEM_|BREVO_|RESEND_)/.test(key) ||
    [
      'BETTER_AUTH_SECRET',
      'CLOUDFLARE_ENV',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_API_KEY',
      'CF_API_TOKEN',
      'CF_API_KEY',
    ].includes(key)
  )
    delete taskEnv[key]
}
function assertPortAvailable() {
  return new Promise((done, reject) => {
    const probe = net.createServer()
    probe.once('error', () =>
      reject(
        new Error('Port 3110 is occupied; stop that service or choose another acceptance port.'),
      ),
    )
    probe.listen(3110, '127.0.0.1', () => probe.close(done))
  })
}
function run(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env: taskEnv })
  if (result.status !== 0) throw new Error(`Command failed: pnpm ${args.join(' ')}`)
}
function runBrowserTests() {
  return new Promise((done, reject) => {
    const child = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', '--config', 'playwright.production.config.ts'],
      { stdio: 'inherit', env: taskEnv },
    )
    child.once('error', reject)
    child.once('close', (code) =>
      code === 0 ? done() : reject(new Error('Isolated production browser checks failed')),
    )
  })
}
function ready() {
  return new Promise((done) => {
    const request = https.get(origin + '/api/health', { rejectUnauthorized: false }, (response) => {
      response.resume()
      done(response.statusCode === 200)
    })
    request.setTimeout(1000, () => request.destroy())
    request.on('error', () => done(false))
  })
}
let server
let code = 1
try {
  await assertPortAvailable()
  run(['exec', 'vite', 'build'])
  if (features.database)
    run([
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'starter-smoke-db',
      '--config',
      config,
      '--local',
      '--persist-to',
      state,
    ])
  if (features.content) {
    const publicDraft = {
      title: 'Published fixture guide',
      slug: 'fixture-guide',
      locale: 'en',
      kind: 'help',
      category: 'Fixture',
      summary: 'Local production fixture only',
      body: 'Published fixture body',
      seoTitle: 'Fixture content SEO',
      seoDescription: 'Fixture public description',
      coverAssetId: null,
    }
    const pendingDraft = {
      ...publicDraft,
      slug: 'never-published',
      title: 'Private fixture draft',
      body: 'PRIVATE-DRAFT-SENTINEL',
    }
    const hex = (value) =>
      "CAST(X'" + Buffer.from(JSON.stringify(value)).toString('hex') + "' AS TEXT)"
    const sql = join(work, 'content-fixture.sql')
    writeFileSync(
      sql,
      `INSERT INTO content_entry(id,draft,live,live_slug,live_locale,published_at,revision,created_at,updated_at) VALUES ('fixture-live',${hex(pendingDraft)},${hex(publicDraft)},'fixture-guide','en',1,1,1,1); INSERT INTO content_entry(id,draft,revision,created_at,updated_at) VALUES ('fixture-draft',${hex(pendingDraft)},1,1,1);`,
    )
    run([
      'exec',
      'wrangler',
      'd1',
      'execute',
      'starter-smoke-db',
      '--config',
      config,
      '--local',
      '--persist-to',
      state,
      '--file',
      sql,
    ])
  }
  if (['default', 'web-app'].includes(profile) && features.emailPassword) {
    const password = await hashPassword('Production-fixture-2026!')
    const hex = (value) => "CAST(X'" + Buffer.from(value).toString('hex') + "' AS TEXT)"
    const sql = join(work, 'operator-fixture.sql')
    writeFileSync(
      sql,
      ['operator', 'target']
        .map(
          (id) =>
            `INSERT INTO user(id,name,email,email_verified,created_at,updated_at)VALUES('fixture-${id}','Fixture ${id}','${id}@fixture.test',1,1,1); INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at)VALUES('credential-${id}','fixture-${id}','credential','fixture-${id}',${hex(password)},1,1);`,
        )
        .join('\n') +
        ` INSERT INTO admin_user(user_id)VALUES('fixture-operator'); INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at)VALUES('reset-fixture','reset-password:production-reset-fixture-only','fixture-target',${Date.now() + 600000},1,1);`,
    )
    run([
      'exec',
      'wrangler',
      'd1',
      'execute',
      'starter-smoke-db',
      '--config',
      config,
      '--local',
      '--persist-to',
      state,
      '--file',
      sql,
    ])
  }
  server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--config',
      join(output, 'server/wrangler.json'),
      '--local',
      '--port',
      '3110',
      '--local-protocol',
      'https',
      // Keep the proxy's internal request/Origin scheme aligned with APP_ORIGIN.
      '--upstream-protocol',
      'https',
      '--persist-to',
      state,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env: taskEnv, detached: true },
  )
  let logWindow = '',
    unsafeLog = false,
    sanitizedStorageError = false
  const inspectLog = (chunk) => {
    logWindow = (logWindow + String(chunk)).slice(-65536)
    unsafeLog ||=
      /# SERVER_ERROR:|Failed query:|params:|Production-new-fixture-2026!|\b[a-f0-9]{32}:[a-f0-9]{64,}\b/.test(
        logWindow,
      )
    sanitizedStorageError ||= /"event":"auth_sdk","severity":"error","category":"storage"/.test(
      logWindow,
    )
  }
  server.stdout.on('data', inspectLog)
  server.stderr.on('data', inspectLog)
  const deadline = Date.now() + 30_000
  while (!(await ready())) {
    if (Date.now() > deadline || server.exitCode !== null)
      throw new Error('Isolated production Worker did not become healthy')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await runBrowserTests()
  await flushWorkerLogs()
  if (unsafeLog)
    throw new Error('Worker logs contained raw authentication error details; values withheld')
  if (['default', 'web-app'].includes(profile) && features.emailPassword && !sanitizedStorageError)
    throw new Error(
      'Expected a structured storage error from the controlled auth exception fixture',
    )
  console.log('Isolated Worker log checks passed; raw error details were not printed.')
  code = 0
} catch (error) {
  console.error(error.message)
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {}
  }
  if (previous) writeFileSync(redirect, previous)
  else if (existsSync(redirect)) unlinkSync(redirect)
  console.log('Production smoke finished. No cloud resources or developer data were changed.')
}
process.exitCode = code
