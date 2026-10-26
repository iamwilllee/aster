import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  symlinkSync,
  realpathSync,
  lstatSync,
  unlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  createProject,
  parseArgs,
  inspectTarget,
} from '../../skills/aster-new/scripts/create-project.mjs'
import { installSkill } from '../../scripts/install-skill.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
function scratch(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'starter-new-test-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

test('products preserve license/lockfile, reset cloud config and generate independent secrets', (t) => {
  const root = scratch(t)
  const first = createProject({
    source,
    target: join(root, 'first-app'),
    name: '片段 "Shelf" $() `test`',
    brief: '私人片段库，按用户隔离。',
    install: false,
  })
  const second = createProject({ source, target: join(root, 'second-app'), install: false })
  for (const name of [
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'pnpm-lock.yaml',
    'starter-version.json',
  ])
    assert.deepEqual(readFileSync(join(first.target, name)), readFileSync(join(source, name)))
  for (const path of ['.git', 'node_modules', '.wrangler', 'dist', '.env', 'qa', '.local'])
    assert.equal(existsSync(join(first.target, path)), false)
  const a = readFileSync(join(first.target, '.dev.vars'), 'utf8')
  const b = readFileSync(join(second.target, '.dev.vars'), 'utf8')
  assert.notEqual(a, b)
  assert.match(a, /BETTER_AUTH_SECRET=[a-f0-9]{64}\n/)
  assert.doesNotMatch(a, /STRIPE_|GOOGLE_CLIENT|whsec_|sk_test_/)
  const config = JSON.parse(readFileSync(join(first.target, 'wrangler.jsonc'), 'utf8'))
  assert.equal(config.name, 'first-app')
  assert.equal(config.env.staging.name, 'first-app-staging')
  assert.equal(config.vars.BILLING_ENABLED, 'false')
  assert.equal(config.env.staging.vars.PUBLIC_INDEXABLE, 'false')
  assert.match(config.d1_databases[0].database_id, /^00000000/)
  assert.equal(config.send_email, undefined)
  assert.equal(config.r2_buckets, undefined)
  assert.equal(
    JSON.parse(readFileSync(join(first.target, 'package.json'), 'utf8')).name,
    'first-app',
  )
  assert.ok(
    readFileSync(join(first.target, 'src/config/site.ts'), 'utf8').includes(
      JSON.stringify(first.name),
    ),
  )
  assert.match(readFileSync(join(first.target, 'PROJECT.md'), 'utf8'), /私人片段库，按用户隔离。/)
  assert.match(readFileSync(join(first.target, 'README.md'), 'utf8'), /首次需求尚未实现/)
})

test('existing content is inspected in place; source descendants and aliases stay protected', (t) => {
  const root = scratch(t)
  const target = join(root, 'existing')
  mkdirSync(target)
  writeFileSync(join(target, 'keep.txt'), 'original')
  assert.equal(createProject({ source, target, install: false }).mode, 'existing')
  assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'original')
  assert.throws(
    () => createProject({ source, target: join(source, 'new-product'), install: false }),
    /outside/,
  )
  symlinkSync(source, join(root, 'alias'), 'dir')
  assert.throws(
    () => createProject({ source, target: join(root, 'alias/new-product'), install: false }),
    /outside/,
  )
  assert.equal(existsSync(join(source, 'new-product')), false)
})

test('copied products cannot silently become the source template', (t) => {
  const root = scratch(t)
  const product = createProject({ source, target: join(root, 'product'), install: false })
  assert.throws(
    () => createProject({ source: product.target, target: join(root, 'another'), install: false }),
    /existing product/,
  )
  assert.equal(existsSync(join(root, 'another')), false)
})

test('source provider IDs, secrets, private files and npm credentials never enter a product', (t) => {
  const root = scratch(t)
  const fixture = createProject({ source, target: join(root, 'fixture'), install: false }).target
  unlinkSync(join(fixture, 'PROJECT.md'))
  const manifest = JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8'))
  manifest.scripts['test:starter'] = 'node --test tests/starter/*.test.mjs'
  manifest.scripts.check += ' && pnpm test:starter'
  writeFileSync(join(fixture, 'package.json'), JSON.stringify(manifest))
  writeFileSync(join(fixture, '.dev.vars'), 'STRIPE_SECRET_KEY=fixture-secret\n')
  writeFileSync(join(fixture, '.npmrc'), '//registry.invalid/:_authToken=fixture-token\n')
  writeFileSync(join(fixture, 'src/.env.production'), 'PRIVATE=fixture-secret')
  mkdirSync(join(fixture, 'docs/private'))
  writeFileSync(join(fixture, 'docs/private/notes.md'), 'fixture-secret')
  const config = JSON.parse(readFileSync(join(fixture, 'wrangler.jsonc'), 'utf8'))
  config.vars.STRIPE_SECRET_KEY = 'fixture-secret'
  config.d1_databases[0].database_id = 'real-provider-id'
  config.routes = ['existing.example/*']
  config.r2_buckets = [{ binding: 'FILES', bucket_name: 'existing-bucket' }]
  writeFileSync(join(fixture, 'wrangler.jsonc'), JSON.stringify(config))
  const output = createProject({
    source: fixture,
    target: join(root, 'result'),
    install: false,
  }).target
  assert.equal(existsSync(join(output, 'src/.env.production')), false)
  assert.equal(existsSync(join(output, 'docs/private')), false)
  assert.doesNotMatch(readFileSync(join(output, '.dev.vars'), 'utf8'), /fixture-secret/)
  assert.doesNotMatch(readFileSync(join(output, '.npmrc'), 'utf8'), /fixture-token/)
  assert.doesNotMatch(
    readFileSync(join(output, 'wrangler.jsonc'), 'utf8'),
    /fixture-secret|real-provider-id|existing-bucket|existing.example/,
  )
  const generated = JSON.parse(readFileSync(join(output, 'package.json'), 'utf8'))
  assert.equal(generated.scripts['starter:new'], undefined)
  assert.equal(generated.scripts['aster:new'], undefined)
  assert.doesNotMatch(generated.scripts.check, /test:starter/)
})

test('rejects symlinked source assets before creating the target', (t) => {
  const root = scratch(t)
  const fixture = createProject({ source, target: join(root, 'fixture'), install: false }).target
  unlinkSync(join(fixture, 'PROJECT.md'))
  writeFileSync(join(root, 'private.txt'), 'do not copy')
  symlinkSync(join(root, 'private.txt'), join(fixture, 'src/linked.txt'))
  assert.throws(
    () => createProject({ source: fixture, target: join(root, 'output'), install: false }),
    /symlink/,
  )
  assert.equal(existsSync(join(root, 'output')), false)
})

test('parsing preserves requirement text and rejects ambiguous flags', () => {
  assert.deepEqual(
    parseArgs(['../new', '--name', 'My App', '--brief', '$() `literal`', '--no-install']),
    { target: '../new', name: 'My App', brief: '$() `literal`', install: false },
  )
  assert.deepEqual(parseArgs([]), { target: '.', install: true })
  for (const args of [
    ['../new', '--name'],
    ['../new', '--unsafe'],
    ['a', 'b'],
  ])
    assert.throws(() => parseArgs(args))
})

test('initializes an already-created empty directory and missing parent directories', (t) => {
  const root = scratch(t)
  const empty = join(root, 'empty')
  mkdirSync(empty)
  assert.equal(createProject({ source, target: empty, install: false }).previousMode, 'empty')
  assert.ok(existsSync(join(empty, 'PROJECT.md')))
  const nested = createProject({
    source,
    target: join(root, 'not-created/yet/site'),
    install: false,
  })
  assert.equal(nested.previousMode, 'missing')
  assert.ok(existsSync(join(nested.target, 'src/config/site.ts')))
})

test('preserves Git/worktree metadata, README and personal rules during in-place initialization', (t) => {
  const root = scratch(t)
  const target = join(root, 'site')
  mkdirSync(target)
  const originals = {
    '.git': 'gitdir: /fixture/existing-worktree\n',
    'README.md': '# My site\n\nMy existing introduction.\n',
    'AGENTS.md': '# Team rules\n\nUse the team conventions.\n',
    '.gitignore': 'personal-output/\n',
  }
  for (const [name, content] of Object.entries(originals))
    writeFileSync(join(target, name), content)
  mkdirSync(join(target, '.vscode'))
  writeFileSync(join(target, '.vscode/settings.json'), '{"fixture":true}')
  const result = createProject({ source, target, install: false })
  assert.equal(result.previousMode, 'metadata')
  for (const name of ['.git', 'README.md'])
    assert.equal(readFileSync(join(target, name), 'utf8'), originals[name])
  assert.ok(readFileSync(join(target, 'AGENTS.md'), 'utf8').startsWith(originals['AGENTS.md']))
  assert.ok(readFileSync(join(target, '.gitignore'), 'utf8').startsWith(originals['.gitignore']))
  assert.match(readFileSync(join(target, '.gitignore'), 'utf8'), /\.dev.vars/)
  assert.equal(readFileSync(join(target, '.vscode/settings.json'), 'utf8'), '{"fixture":true}')
  assert.ok(existsSync(join(target, 'ASTER.md')))
  const before = readFileSync(join(target, '.dev.vars'))
  assert.equal(
    createProject({ source, target, name: 'Do not reset', install: false }).mode,
    'starter',
  )
  assert.deepEqual(readFileSync(join(target, '.dev.vars')), before)
  assert.equal(
    (readFileSync(join(target, 'AGENTS.md'), 'utf8').match(/starter:guide:start/g) ?? []).length,
    1,
  )
})

test('existing app and partially initialized Starter are read-only routes', (t) => {
  const root = scratch(t)
  const target = join(root, 'app')
  mkdirSync(target)
  writeFileSync(join(target, 'package.json'), '{"name":"existing","scripts":{"dev":"custom"}}')
  writeFileSync(join(target, '.dev.vars'), 'PRIVATE_FIXTURE=do-not-touch\n')
  assert.equal(createProject({ source, target }).mode, 'existing')
  assert.equal(readFileSync(join(target, '.dev.vars'), 'utf8'), 'PRIVATE_FIXTURE=do-not-touch\n')
  assert.equal(existsSync(join(target, 'starter.project.json')), false)
  writeFileSync(join(target, 'starter-version.json'), '{}')
  assert.equal(createProject({ source, target }).mode, 'starter-incomplete')
  assert.equal(
    readFileSync(join(target, 'package.json'), 'utf8'),
    '{"name":"existing","scripts":{"dev":"custom"}}',
  )
})

test('inspect is non-mutating and directory-shaped metadata does not trigger a partial copy', (t) => {
  const root = scratch(t)
  const missing = join(root, 'missing')
  assert.equal(createProject({ source, target: missing, inspect: true }).mode, 'missing')
  assert.equal(existsSync(missing), false)
  const target = join(root, 'unusual')
  mkdirSync(join(target, 'AGENTS.md'), { recursive: true })
  assert.equal(inspectTarget(source, target).mode, 'existing')
  assert.equal(createProject({ source, target, install: false }).mode, 'existing')
  assert.equal(existsSync(join(target, 'package.json')), false)
  assert.equal(inspectTarget(source, source).mode, 'source')
})

test('CLI uses current directory by default and repeat calls reuse it without resetting progress', (t) => {
  const root = scratch(t)
  const script = join(source, 'skills/aster-new/scripts/create-project.mjs')
  const first = spawnSync(process.execPath, [script, '--no-install', '--name', 'Current Site'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(first.status, 0, first.stderr)
  assert.ok(existsSync(join(root, 'PROJECT.md')))
  const secret = readFileSync(join(root, '.dev.vars'))
  const second = spawnSync(process.execPath, [script, '--name', 'No reset'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /"mode": "starter"/)
  assert.deepEqual(readFileSync(join(root, '.dev.vars')), secret)
})

test('Skill installation is idempotent and preserves unrelated installed Skills', (t) => {
  const root = scratch(t)
  const skillSource = join(source, 'skills/aster-new')
  const target = installSkill(skillSource, join(root, 'skills'))
  assert.equal(realpathSync(target), skillSource)
  assert.equal(installSkill(skillSource, join(root, 'skills')), target)
  mkdirSync(join(root, 'other/aster-new'), { recursive: true })
  writeFileSync(join(root, 'other/aster-new/SKILL.md'), 'keep')
  assert.throws(() => installSkill(skillSource, join(root, 'other')), /already exists/)
  assert.equal(readFileSync(join(root, 'other/aster-new/SKILL.md'), 'utf8'), 'keep')
})

test('Skill rebrand migrates only this checkout legacy link and preserves unrelated Skills', (t) => {
  const root = scratch(t)
  const skills = join(root, 'skills')
  const skillSource = join(source, 'skills/aster-new')
  mkdirSync(skills)
  symlinkSync(join(source, 'skills/starter-new'), join(skills, 'starter-new'))
  assert.equal(realpathSync(installSkill(skillSource, skills)), skillSource)
  assert.throws(() => lstatSync(join(skills, 'starter-new')), { code: 'ENOENT' })
  // Even a similarly named Skill remains the user's property when it points elsewhere.
  mkdirSync(join(root, 'other'), { recursive: true })
  symlinkSync(join(root, 'other'), join(skills, 'starter-new'))
  installSkill(skillSource, skills)
  assert.equal(realpathSync(join(skills, 'starter-new')), join(root, 'other'))
})

test('appearance is selected per product and unknown themes fail before creating files', (t) => {
  const root = scratch(t)
  const plan = join(root, 'theme.json')
  const decisions = [
    {
      id: 'visual-theme',
      question: 'Visual direction',
      status: 'resolved',
      value: 'catalog',
      basis: 'user',
      reason: 'Product catalog',
      blocking: false,
    },
  ]
  writeFileSync(plan, JSON.stringify({ decisions }))
  const selected = createProject({
    source,
    target: join(root, 'catalog'),
    plan,
    install: false,
  }).target
  assert.deepEqual(JSON.parse(readFileSync(join(selected, 'src/config/appearance.json'), 'utf8')), {
    theme: 'catalog',
  })
  const regular = createProject({ source, target: join(root, 'default'), install: false }).target
  assert.deepEqual(JSON.parse(readFileSync(join(regular, 'src/config/appearance.json'), 'utf8')), {
    theme: 'sage',
  })
  decisions[0].value = 'unknown'
  writeFileSync(plan, JSON.stringify({ decisions }))
  assert.throws(
    () => createProject({ source, target: join(root, 'invalid-theme'), plan, install: false }),
    /Invalid appearance/,
  )
  assert.equal(existsSync(join(root, 'invalid-theme')), false)
})
