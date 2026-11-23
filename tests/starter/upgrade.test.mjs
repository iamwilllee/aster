import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  symlinkSync,
  unlinkSync,
  realpathSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  initializeBaseline,
  scanUpgrade,
  applyUpgrade,
  rollbackUpgrade,
  recordUpgrade,
} from '../../scripts/project-upgrade.mjs'
import { createProject } from '../../skills/aster-new/scripts/create-project.mjs'

function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}
function fixture(t, legacy = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'aster-upgrade-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'source'),
    target = join(root, 'product')
  mkdirSync(source)
  mkdirSync(target)
  const content = {
    'starter-version.json': JSON.stringify({ version: '0.1.2', framework: 'tanstack-start' }),
    'package.json': '{"name":"fixture","scripts":{}}',
    'wrangler.jsonc': '{}',
    'src/modules/mail/mail.server.ts': 'export const adapter = 1\n',
    'src/server/app.server.ts': 'export const business = 1\n',
    'src/retired.ts': 'export const retired = true\n',
    'src/deleted.ts': 'export const removedByProduct = false\n',
    'src/custom.ts': 'export const custom = 1\n',
    'src/config/site.ts': 'export const brand = "Aster"\n',
    'src/config/features.json': '{"auth":true}',
    'migrations/0000.sql': 'CREATE TABLE fixture(id TEXT);\n',
    'docs/guide.md': '# Guide\n',
  }
  for (const [path, bytes] of Object.entries(content)) {
    put(source, path, bytes)
    put(target, path, bytes)
  }
  put(target, 'PROJECT.md', '# Product\n')
  put(target, 'starter.project.json', '{"goal":"preserve user plan"}')
  put(target, '.dev.vars', 'private-credential-fixture')
  if (!legacy) initializeBaseline(source, target)
  return { root, source, target }
}
function update(source) {
  put(source, 'src/modules/mail/mail.server.ts', 'export const adapter = 2\n')
}
const status = (plan, path) => plan.entries.find((item) => item.path === path)?.status

test('new products get hashes without secrets, while initialization and scanning remain isolated', (t) => {
  const { root } = fixture(t)
  const actualSource = resolve('.')
  const target = createProject({
    source: actualSource,
    target: join(root, 'generated'),
    install: false,
  }).target
  const plan = scanUpgrade(actualSource, target)
  assert.equal(plan.baseline, 'recorded')
  assert.equal(status(plan, 'package.json'), 'unchanged')
  assert.ok(
    !plan.entries.some((item) =>
      /\.dev\.vars|\.wrangler|routeTree\.gen|worker-configuration/.test(item.path),
    ),
  )
  const data = readFileSync(join(target, '.aster/baseline.json'), 'utf8')
  assert.ok(!data.includes('BETTER_AUTH_SECRET'))
  assert.equal(existsSync(join(target, '.local')), false)
  assert.equal(existsSync(join(target, '.git')), false)
})

test('classifies two-sided changes, pristine updates, protected config, deletions and additions', (t) => {
  const { source, target } = fixture(t)
  update(source)
  put(source, 'src/new.ts', 'export const added = true\n')
  put(source, 'src/server/app.server.ts', 'upstream business change')
  put(target, 'src/server/app.server.ts', 'product business customization')
  put(target, 'src/custom.ts', 'customized only in product')
  put(source, 'src/config/site.ts', 'new upstream brand')
  put(source, 'src/config/features.json', '{"auth":false}')
  put(source, 'src/config/brand.json', '{"icon":"/brand/upstream.svg"}')
  put(source, 'wrangler.jsonc', '{"vars":{"MAIL_MODE":"brevo"}}')
  put(source, 'migrations/0000.sql', 'changed upstream applied migration')
  rmSync(join(source, 'src/retired.ts'))
  rmSync(join(target, 'src/deleted.ts'))
  put(source, 'src/deleted.ts', 'upstream changes a product-deleted file')
  const plan = scanUpgrade(source, target)
  for (const [path, expected] of Object.entries({
    'src/modules/mail/mail.server.ts': 'update',
    'src/new.ts': 'add',
    'src/server/app.server.ts': 'conflict',
    'src/custom.ts': 'customized',
    'src/config/site.ts': 'review',
    'src/config/features.json': 'review',
    'src/config/brand.json': 'review',
    'wrangler.jsonc': 'review',
    'migrations/0000.sql': 'review',
    'src/retired.ts': 'removed-upstream',
    'src/deleted.ts': 'deleted-locally',
  }))
    assert.equal(status(plan, path), expected, path)
  const result = applyUpgrade(source, target, plan, [
    'src/modules/mail/mail.server.ts',
    'src/new.ts',
  ])
  assert.equal(result.accepted, false)
  assert.equal(
    readFileSync(join(target, 'src/server/app.server.ts'), 'utf8'),
    'product business customization',
  )
  assert.equal(readFileSync(join(target, '.dev.vars'), 'utf8'), 'private-credential-fixture')
  assert.equal(
    readFileSync(join(target, 'starter.project.json'), 'utf8'),
    '{"goal":"preserve user plan"}',
  )
  assert.equal(readFileSync(join(target, 'wrangler.jsonc'), 'utf8'), '{}')
  assert.ok(readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8').includes('= 2'))
  assert.equal(existsSync(join(target, 'src/deleted.ts')), false)
  assert.equal(existsSync(join(target, 'src/retired.ts')), true)
  const restored = rollbackUpgrade(target, result.run)
  assert.deepEqual(restored.conflicts, [])
  assert.equal(existsSync(join(target, 'src/new.ts')), false)
  assert.ok(readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8').includes('= 1'))
})

test('legacy products never acquire an invented baseline or automatically resurrect missing files', (t) => {
  const { source, target } = fixture(t, true)
  update(source)
  put(source, 'src/new.ts', 'new upstream file')
  const plan = scanUpgrade(source, target)
  assert.equal(plan.baseline, 'legacy-missing')
  assert.equal(status(plan, 'src/new.ts'), 'legacy-review')
  assert.equal(status(plan, 'src/modules/mail/mail.server.ts'), 'legacy-review')
  assert.throws(() => applyUpgrade(source, target, plan, ['src/new.ts']), /legacy/)
  assert.equal(existsSync(join(target, '.aster')), false)
  assert.equal(existsSync(join(target, 'src/new.ts')), false)
})

test('same-version upstream edits are detected and stale source/product plans cannot write files', (t) => {
  const { source, target } = fixture(t)
  const initial = scanUpgrade(source, target)
  update(source)
  const plan = scanUpgrade(source, target)
  assert.equal(plan.upstreamVersion, initial.upstreamVersion)
  assert.notEqual(plan.upstreamFingerprint, initial.upstreamFingerprint)
  assert.throws(
    () => applyUpgrade(source, target, initial, ['src/modules/mail/mail.server.ts']),
    /stale/,
  )
  put(target, 'docs/guide.md', 'user edited after scan')
  assert.throws(
    () => applyUpgrade(source, target, plan, ['src/modules/mail/mail.server.ts']),
    /stale/,
  )
  assert.ok(readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8').includes('= 1'))
})

test('plan entries cannot inject paths, override protected files or bypass recomputed classifications', (t) => {
  const { source, target } = fixture(t)
  update(source)
  put(source, 'wrangler.jsonc', '{"name":"upstream"}')
  const plan = scanUpgrade(source, target)
  plan.entries = [
    { path: '../outside', status: 'update' },
    { path: 'wrangler.jsonc', status: 'update' },
  ]
  assert.throws(() => applyUpgrade(source, target, plan, ['../outside']), /path/)
  assert.throws(() => applyUpgrade(source, target, plan, ['wrangler.jsonc']), /protected/)
  assert.equal(readFileSync(join(target, 'wrangler.jsonc'), 'utf8'), '{}')
})

test('symlink parents, broken symlinks, baseline traversal and source/product nesting are rejected', (t) => {
  const { root, source, target } = fixture(t)
  rmSync(join(target, 'src/modules/mail'), { recursive: true })
  symlinkSync(join(source, 'src/modules/mail'), join(target, 'src/modules/mail'))
  assert.throws(() => scanUpgrade(source, target), /Symlink/)
  unlinkSync(join(target, 'src/modules/mail'))
  symlinkSync(join(root, 'missing'), join(target, 'src/modules/mail'))
  assert.throws(() => scanUpgrade(source, target), /Symlink/)
  assert.throws(() => scanUpgrade(source, source), /separate/)
  unlinkSync(join(target, 'src/modules/mail'))
  put(
    target,
    '.aster/baseline.json',
    JSON.stringify({
      schemaVersion: 1,
      adoptions: [],
      files: { '../escape': { upstreamHash: null, productHash: null } },
    }),
  )
  assert.throws(() => scanUpgrade(source, target), /Invalid baseline/)
})

test('rollback preserves later user edits and detects corrupted backups', (t) => {
  const { source, target } = fixture(t)
  update(source)
  const result = applyUpgrade(source, target, scanUpgrade(source, target), [
    'src/modules/mail/mail.server.ts',
  ])
  put(target, 'src/modules/mail/mail.server.ts', 'later user edit')
  assert.deepEqual(rollbackUpgrade(target, result.run).conflicts, [
    'src/modules/mail/mail.server.ts',
  ])
  assert.equal(
    readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8'),
    'later user edit',
  )
  put(
    target,
    'src/modules/mail/mail.server.ts',
    readFileSync(join(source, 'src/modules/mail/mail.server.ts')),
  )
  put(
    target,
    '.local/aster-upgrades/' + result.run + '/backup/src/modules/mail/mail.server.ts',
    'corrupt backup',
  )
  assert.throws(() => rollbackUpgrade(target, result.run), /Backup hash/)
})

test('partial adoption requires evidence and preserves source version, other baselines and product records', (t) => {
  const { source, target } = fixture(t)
  update(source)
  put(source, 'src/custom.ts', 'upstream custom module v2')
  const plan = scanUpgrade(source, target)
  const before = JSON.parse(readFileSync(join(target, '.aster/baseline.json')))
  applyUpgrade(source, target, plan, ['src/modules/mail/mail.server.ts'])
  assert.throws(
    () => recordUpgrade(source, target, plan, ['src/modules/mail/mail.server.ts'], 'missing.md'),
    /missing/,
  )
  assert.throws(
    () => recordUpgrade(source, target, plan, ['src/modules/mail/mail.server.ts'], '.dev.vars'),
    /sensitive/,
  )
  put(target, 'upgrade-evidence.md', 'Fixture local regression only; not live provider acceptance.')
  const recorded = recordUpgrade(
    source,
    target,
    plan,
    ['src/modules/mail/mail.server.ts'],
    'upgrade-evidence.md',
  )
  assert.equal(recorded.complete, false)
  const after = JSON.parse(readFileSync(join(target, '.aster/baseline.json')))
  assert.deepEqual(before.files['src/custom.ts'], after.files['src/custom.ts'])
  assert.notEqual(
    before.files['src/modules/mail/mail.server.ts'].upstreamHash,
    after.files['src/modules/mail/mail.server.ts'].upstreamHash,
  )
  assert.equal(status(scanUpgrade(source, target), 'src/custom.ts'), 'update')
  assert.equal(JSON.parse(readFileSync(join(target, 'starter-version.json'))).version, '0.1.2')
  assert.throws(
    () => recordUpgrade(source, target, plan, ['src/custom.ts'], 'upgrade-evidence.md'),
    /stale/,
  )
})

test('an interrupted/concurrent run lock cannot be removed by a second writer', (t) => {
  const { source, target } = fixture(t)
  update(source)
  put(target, '.local/aster-upgrades/lock', 'existing owner')
  assert.throws(() =>
    applyUpgrade(source, target, scanUpgrade(source, target), ['src/modules/mail/mail.server.ts']),
  )
  assert.equal(readFileSync(join(target, '.local/aster-upgrades/lock'), 'utf8'), 'existing owner')
})

test('custom code retained during adoption cannot become an automatic overwrite on the next upgrade', (t) => {
  const { source, target } = fixture(t)
  update(source)
  const plan = scanUpgrade(source, target)
  put(target, 'src/modules/mail/mail.server.ts', 'upstream v2 plus retained product behavior')
  put(target, 'upgrade-evidence.md', 'Fixture manual merge and regression evidence')
  recordUpgrade(source, target, plan, ['src/modules/mail/mail.server.ts'], 'upgrade-evidence.md')
  assert.equal(status(scanUpgrade(source, target), 'src/modules/mail/mail.server.ts'), 'unchanged')
  put(source, 'src/modules/mail/mail.server.ts', 'upstream v3')
  const next = scanUpgrade(source, target)
  assert.equal(status(next, 'src/modules/mail/mail.server.ts'), 'conflict')
  assert.throws(
    () => applyUpgrade(source, target, next, ['src/modules/mail/mail.server.ts']),
    /conflict/,
  )
  assert.equal(
    readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8'),
    'upstream v2 plus retained product behavior',
  )
})

test('legacy CLI scans from the original source without installing or changing the product', (t) => {
  const { root, source, target } = fixture(t, true)
  update(source)
  const script = resolve('scripts/project-upgrade.mjs')
  const output = join(root, 'scan.json')
  const args = [script, 'scan', '--source', source, '--out', output]
  const result = spawnSync(process.execPath, args, { cwd: target, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(readFileSync(output)).baseline, 'legacy-missing')
  assert.ok(!result.stdout.includes('private-credential-fixture'))
  assert.equal(existsSync(join(target, '.local')), false)
  assert.equal(existsSync(join(target, 'node_modules')), false)
  assert.notEqual(spawnSync(process.execPath, args, { cwd: target }).status, 0)
  const overwrite = spawnSync(
    process.execPath,
    [script, 'scan', '--source', source, '--out', join(target, 'package.json')],
    { cwd: target },
  )
  assert.notEqual(overwrite.status, 0)
})

test('CLI apply/record/rollback work end-to-end and reject unsupported output options before mutation', (t) => {
  const { root, source, target } = fixture(t)
  update(source)
  const script = resolve('scripts/project-upgrade.mjs')
  const planFile = join(root, 'plan.json')
  const run = (args) =>
    spawnSync(process.execPath, [script, ...args], { cwd: target, encoding: 'utf8' })
  const scan = run(['scan', '--source', source, '--out', planFile])
  assert.equal(scan.status, 0, scan.stderr)
  const common = [
    '--source',
    source,
    '--plan',
    planFile,
    '--path',
    'src/modules/mail/mail.server.ts',
  ]
  const invalid = run(['apply', ...common, '--out', join(target, 'package.json')])
  assert.notEqual(invalid.status, 0)
  assert.equal(existsSync(join(target, '.local')), false)
  const applied = run(['apply', ...common])
  assert.equal(applied.status, 0, applied.stderr)
  const id = JSON.parse(applied.stdout).run
  put(target, 'upgrade-evidence.md', 'Fixture local checks; provider acceptance remains pending')
  const recorded = run(['record', ...common, '--evidence', 'upgrade-evidence.md'])
  assert.equal(recorded.status, 0, recorded.stderr)
  assert.equal(JSON.parse(recorded.stdout).complete, false)
  const rollback = run(['rollback', '--run', id])
  assert.equal(rollback.status, 0, rollback.stderr)
  assert.ok(readFileSync(join(target, 'src/modules/mail/mail.server.ts'), 'utf8').includes('= 1'))
  const alias = join(root, 'alias')
  symlinkSync(target, alias)
  const indirectOutput = run([
    'scan',
    '--source',
    source,
    '--out',
    join(alias, 'forbidden-report.json'),
  ])
  assert.notEqual(indirectOutput.status, 0)
  assert.equal(existsSync(join(target, 'forbidden-report.json')), false)
})
