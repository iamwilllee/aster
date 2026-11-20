import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { templateFiles, templateDirectories, excludedTemplatePath } from './starter-files.mjs'

const baselinePath = '.aster/baseline.json'
const generated = new Set(['worker-configuration.d.ts', 'src/routeTree.gen.ts'])
const roots = new Set([...templateFiles, 'wrangler.jsonc'])
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const jsonHash = (value) => hash(JSON.stringify(value))
const fail = (message) => {
  throw new Error(message)
}

function eligible(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length < 600 &&
    !isAbsolute(path) &&
    !path.includes('\\') &&
    !/[\x00-\x1f]/.test(path) &&
    path
      .split('/')
      .every((part) => part && part !== '.' && part !== '..' && !excludedTemplatePath(part)) &&
    !generated.has(path) &&
    (roots.has(path) || templateDirectories.includes(path.split('/')[0]))
  )
}
// Check every existing ancestor, not just the final file. Never follow product symlinks.
function safePath(root, path) {
  if (isAbsolute(path) || path.split('/').some((part) => !part || part === '..' || part === '.'))
    fail('Invalid relative path')
  let current = root
  for (const part of path.split('/')) {
    current = join(current, part)
    if (
      existsSync(current) ||
      (() => {
        try {
          lstatSync(current)
          return true
        } catch {
          return false
        }
      })()
    ) {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) fail('Symlink in upgrade path; resolve it manually first')
      if (current !== join(root, path) && !stat.isDirectory())
        fail('Upgrade parent is not a directory')
    }
  }
  return current
}
function file(root, path) {
  const absolute = safePath(root, path)
  if (!existsSync(absolute)) return null
  const stat = lstatSync(absolute)
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) fail('Unsupported upgrade file')
  const bytes = readFileSync(absolute)
  return { hash: hash(bytes), bytes, mode: stat.mode & 0o777 }
}
function readJson(path) {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024)
    fail('Invalid upgrade metadata')
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fail('Invalid upgrade JSON; contents were not printed')
  }
}
function writeJson(root, path, data) {
  const absolute = safePath(root, path)
  mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 })
  const temp = absolute + '.tmp-' + randomUUID()
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  renameSync(temp, absolute)
}
function replaceFile(root, path, bytes, mode) {
  const destination = safePath(root, path)
  mkdirSync(dirname(destination), { recursive: true })
  const temporary = destination + '.aster-tmp-' + randomUUID()
  writeFileSync(temporary, bytes, { flag: 'wx', mode })
  renameSync(temporary, destination)
}
function version(root) {
  const value = readJson(safePath(root, 'starter-version.json'))
  if (
    typeof value.version !== 'string' ||
    value.version.length > 80 ||
    !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value.version) ||
    value.framework !== 'tanstack-start'
  )
    fail('Not a supported Aster project')
  return value.version
}
function snapshot(root) {
  const files = {}
  function walk(path) {
    if (!eligible(path)) return
    const absolute = safePath(root, path)
    if (!existsSync(absolute)) return
    const stat = lstatSync(absolute)
    if (stat.isDirectory()) {
      for (const child of readdirSync(absolute).sort()) walk(path + '/' + child)
    } else files[path] = file(root, path).hash
  }
  for (const path of [...roots, ...templateDirectories].sort()) walk(path)
  return { version: version(root), fingerprint: jsonHash(files), files }
}
function contexts(source, target) {
  source = realpathSync(resolve(source))
  target = realpathSync(resolve(target))
  for (const [a, b] of [
    [source, target],
    [target, source],
  ]) {
    const rel = relative(a, b)
    if (!rel || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel)))
      fail('Upgrade source and product must be separate, non-nested directories')
  }
  if (existsSync(join(source, 'PROJECT.md')))
    fail('Use the original Aster source, not another product')
  version(target)
  return { source, target }
}
function baseline(root) {
  const path = safePath(root, baselinePath)
  if (!existsSync(path)) return null
  const value = readJson(path)
  if (
    value.schemaVersion !== 1 ||
    !value.files ||
    typeof value.files !== 'object' ||
    Array.isArray(value.files) ||
    !Array.isArray(value.adoptions)
  )
    fail('Unsupported baseline; do not replace it with a guessed baseline')
  for (const [path, entry] of Object.entries(value.files)) {
    if (
      !eligible(path) ||
      !entry ||
      ![entry.upstreamHash, entry.productHash].every((h) => h === null || /^[a-f0-9]{64}$/.test(h))
    )
      fail('Invalid baseline entry')
  }
  if (value.origin !== null) {
    if (
      !value.origin ||
      !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value.origin.version ?? '') ||
      !/^[a-f0-9]{64}$/.test(value.origin.fingerprint ?? '')
    )
      fail('Invalid baseline origin')
    value.origin = { version: value.origin.version, fingerprint: value.origin.fingerprint }
  }
  return value
}

export function upgradeStatus(target) {
  const previous = baseline(realpathSync(resolve(target)))
  return {
    baseline: previous ? 'recorded' : 'legacy-missing',
    origin: previous?.origin ?? null,
    adoptionCount: previous?.adoptions.length ?? 0,
    note: 'Local baseline only; no upstream scan, release upgrade or business acceptance implied.',
  }
}
function moduleFor(path) {
  if (path.startsWith('src/modules/mail/')) return 'mail'
  if (
    path.startsWith('src/modules/auth/') ||
    /(?:auth-form|verification-resend)\.tsx$/.test(path) ||
    path.startsWith('src/routes/api/auth/')
  )
    return 'auth'
  if (path.startsWith('src/modules/billing/') || path.includes('billing')) return 'billing'
  if (
    path.startsWith('src/components/ui/') ||
    path.startsWith('src/components/patterns/') ||
    path.startsWith('src/components/dev/')
  )
    return 'ui'
  if (path.startsWith('src/db/') || path.startsWith('migrations/')) return 'data'
  if (path.startsWith('docs/') || path.endsWith('.md')) return 'docs'
  if (path.startsWith('scripts/') || path.startsWith('skills/')) return 'workflow'
  return 'shared'
}
function protectedFile(path) {
  return (
    roots.has(path) ||
    path.startsWith('public/') ||
    path.startsWith('migrations/') ||
    path.startsWith('src/db/') ||
    [
      'src/config/site.ts',
      'src/config/brand.json',
      'src/config/features.json',
      'src/styles.css',
    ].includes(path)
  )
}

export function initializeBaseline(source, target) {
  const ctx = contexts(source, target)
  if (existsSync(safePath(ctx.target, baselinePath))) fail('Baseline already exists')
  const current = snapshot(ctx.source)
  const files = Object.fromEntries(
    Object.entries(current.files).map(([path, upstreamHash]) => [
      path,
      { upstreamHash, productHash: file(ctx.target, path)?.hash ?? null },
    ]),
  )
  writeJson(ctx.target, baselinePath, {
    schemaVersion: 1,
    origin: { version: current.version, fingerprint: current.fingerprint },
    files,
    adoptions: [],
  })
}

export function scanUpgrade(source, target) {
  const ctx = contexts(source, target)
  const current = snapshot(ctx.source)
  const previous = baseline(ctx.target)
  const paths = [
    ...new Set([...Object.keys(current.files), ...Object.keys(previous?.files ?? {})]),
  ].sort()
  const entries = paths.map((path) => {
    const upstreamHash = current.files[path] ?? null
    const productHash = file(ctx.target, path)?.hash ?? null
    const old = previous?.files[path]
    let status
    if (upstreamHash === productHash) status = 'aligned'
    else if (!previous) status = 'legacy-review'
    else if (old && upstreamHash === old.upstreamHash)
      status =
        productHash === old.productHash
          ? 'unchanged'
          : productHash
            ? 'customized'
            : 'deleted-locally'
    else if (!upstreamHash) status = 'removed-upstream'
    else if (old && !productHash) status = 'deleted-locally'
    else if (protectedFile(path)) status = 'review'
    else if (!old && !productHash) status = 'add'
    else if (old && productHash === old.productHash && old.productHash === old.upstreamHash)
      status = 'update'
    else status = 'conflict'
    return { path, module: moduleFor(path), status, upstreamHash, productHash }
  })
  const report = {
    schemaVersion: 1,
    ...ctx,
    productVersion: version(ctx.target),
    upstreamVersion: current.version,
    upstreamFingerprint: current.fingerprint,
    baseline: previous ? 'recorded' : 'legacy-missing',
    origin: previous?.origin ?? null,
    baselineHash: previous ? jsonHash(previous) : null,
    entries,
  }
  return {
    ...report,
    id: jsonHash(report),
    counts: entries.reduce((out, entry) => {
      out[entry.status] = (out[entry.status] ?? 0) + 1
      return out
    }, {}),
    note: 'Read-only hashes, not business acceptance. Shared dependencies require review; provider tests stay pending until real verification.',
  }
}

function checkedPlan(source, target, input, unchangedTarget) {
  if (input?.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(input.id ?? ''))
    fail('Invalid upgrade plan')
  const now = scanUpgrade(source, target)
  if (
    input.source !== now.source ||
    input.target !== now.target ||
    input.upstreamFingerprint !== now.upstreamFingerprint ||
    input.baselineHash !== now.baselineHash ||
    (unchangedTarget && input.id !== now.id)
  )
    fail('Upgrade plan is stale or belongs to another source/product; scan again')
  // Never trust entries or mutation paths supplied by the plan file.
  return now
}
function selected(entries, paths) {
  if (!paths.length || new Set(paths).size !== paths.length)
    fail('Select explicit, unique --path entries')
  return paths.map((path) => {
    const entry = entries.find((entry) => entry.path === path)
    if (!eligible(path) || !entry) return fail('Selected path is not part of this upgrade')
    return entry
  })
}

function locked(target, action) {
  const directory = safePath(target, '.local/aster-upgrades')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const lock = safePath(target, '.local/aster-upgrades/lock')
  writeFileSync(
    lock,
    'Local upgrade in progress. Inspect the journal before removing a stale lock.\n',
    { flag: 'wx', mode: 0o600 },
  )
  try {
    return action()
  } finally {
    rmSync(lock)
  }
}

export function applyUpgrade(source, target, plan, paths) {
  const ctx = contexts(source, target)
  return locked(ctx.target, () => applyUnlocked(ctx.source, ctx.target, plan, paths))
}
function applyUnlocked(source, target, plan, paths) {
  const current = checkedPlan(source, target, plan, true)
  const entries = selected(current.entries, paths)
  if (entries.some((entry) => !['update', 'add'].includes(entry.status)))
    fail(
      'Automatic copy is only for pristine updates/new files; review conflicts, legacy and protected files with the Agent',
    )
  const run = '.local/aster-upgrades/' + current.id
  if (existsSync(safePath(current.target, run)))
    fail('Upgrade run already exists; inspect it before retrying')
  mkdirSync(safePath(current.target, run), { mode: 0o700 })
  const journal = { schemaVersion: 1, id: current.id, files: [] }
  // Save all backups and the journal before touching application files.
  for (const entry of entries) {
    const old = file(current.target, entry.path)
    if (old) {
      const backup = safePath(current.target, run + '/backup/' + entry.path)
      mkdirSync(dirname(backup), { recursive: true, mode: 0o700 })
      writeFileSync(backup, old.bytes, { flag: 'wx', mode: 0o600 })
    }
    journal.files.push({
      path: entry.path,
      before: entry.productHash,
      after: entry.upstreamHash,
      mode: old?.mode ?? 0o644,
      state: 'prepared',
    })
  }
  writeJson(current.target, run + '/journal.json', journal)
  for (const entry of journal.files) {
    const upstream = file(current.source, entry.path)
    if (
      upstream?.hash !== entry.after ||
      (file(current.target, entry.path)?.hash ?? null) !== entry.before
    )
      fail('Files changed during upgrade; inspect the journal and rollback before retrying')
    replaceFile(current.target, entry.path, upstream.bytes, upstream.mode)
    entry.state = 'applied'
    writeJson(current.target, run + '/journal.json', journal)
  }
  return {
    run: current.id,
    applied: journal.files.map((entry) => entry.path),
    accepted: false,
    next: 'Agent merges review/shared dependencies, resets affected acceptance and runs regression before record.',
  }
}

export function rollbackUpgrade(target, id) {
  target = realpathSync(resolve(target))
  version(target)
  return locked(target, () => rollbackUnlocked(target, id))
}
function rollbackUnlocked(target, id) {
  if (!/^[a-f0-9]{64}$/.test(id ?? '')) fail('Invalid rollback run')
  const run = '.local/aster-upgrades/' + id
  const journal = readJson(safePath(target, run + '/journal.json'))
  if (journal.schemaVersion !== 1 || journal.id !== id || !Array.isArray(journal.files))
    fail('Invalid upgrade journal')
  const restored = [],
    conflicts = []
  for (const entry of journal.files) {
    if (
      !eligible(entry.path) ||
      !/^[a-f0-9]{64}$/.test(entry.after) ||
      !(entry.before === null || /^[a-f0-9]{64}$/.test(entry.before)) ||
      !Number.isInteger(entry.mode) ||
      entry.mode < 0 ||
      entry.mode > 0o777
    )
      fail('Invalid journal path/hash')
    const actual = file(target, entry.path)?.hash ?? null
    if (actual === entry.before) continue
    if (actual !== entry.after) {
      conflicts.push(entry.path)
      continue
    }
    const destination = safePath(target, entry.path)
    if (entry.before === null) rmSync(destination)
    else {
      const old = file(target, run + '/backup/' + entry.path)
      if (old?.hash !== entry.before) fail('Backup hash mismatch; rollback stopped')
      replaceFile(target, entry.path, old.bytes, entry.mode)
    }
    restored.push(entry.path)
  }
  return {
    run: id,
    restored,
    conflicts,
    note: 'Only files still matching applied hashes are restored. Later product edits are preserved; baseline records are never rolled back.',
  }
}

export function recordUpgrade(source, target, plan, paths, evidence) {
  const ctx = contexts(source, target)
  return locked(ctx.target, () => recordUnlocked(ctx.source, ctx.target, plan, paths, evidence))
}
function recordUnlocked(source, target, plan, paths, evidence) {
  const current = checkedPlan(source, target, plan, false)
  const entries = selected(current.entries, paths)
  if (
    typeof evidence !== 'string' ||
    !evidence ||
    isAbsolute(evidence) ||
    evidence.includes('\\') ||
    evidence
      .split('/')
      .some(
        (part) =>
          ['.aws', '.agents', '.codex', '.ssh'].includes(part) ||
          (excludedTemplatePath(part) && part !== '.local'),
      )
  )
    fail('Use a non-sensitive, product-relative acceptance evidence file')
  if (!file(current.target, evidence)) fail('Acceptance evidence is missing')
  const previous = baseline(current.target) ?? {
    schemaVersion: 1,
    origin: null,
    files: {},
    adoptions: [],
  }
  for (const { path, upstreamHash, productHash } of entries)
    previous.files[path] = { upstreamHash, productHash }
  previous.adoptions.push({
    source: { version: current.upstreamVersion, fingerprint: current.upstreamFingerprint },
    paths,
    evidence,
    at: new Date().toISOString(),
  })
  writeJson(current.target, baselinePath, previous)
  return {
    recorded: paths,
    sourceVersion: current.upstreamVersion,
    complete: false,
    note: 'Adoption evidence is a record, not proof. Product starter-version.json is preserved; partial upgrades never claim a full release upgrade.',
  }
}

function options(args) {
  const parsed = { command: args.shift() ?? 'scan', paths: [] }
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1]
    if (
      !['--source', '--target', '--out', '--plan', '--path', '--evidence', '--run'].includes(key) ||
      !value
    )
      fail('Invalid upgrade option')
    if (key === '--path') parsed.paths.push(value)
    else {
      const name = key.slice(2)
      if (parsed[name]) fail('Duplicate upgrade option')
      parsed[name] = value
    }
  }
  return parsed
}
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const args = options(process.argv.slice(2))
    const commandOptions = {
      scan: ['source', 'target', 'out'],
      apply: ['source', 'target', 'plan', 'paths'],
      record: ['source', 'target', 'plan', 'paths', 'evidence'],
      rollback: ['target', 'run'],
    }
    if (
      !commandOptions[args.command] ||
      Object.keys(args).some(
        (key) =>
          key !== 'command' &&
          (key !== 'paths' || args.paths.length) &&
          !commandOptions[args.command].includes(key),
      )
    )
      fail('Option is not supported for this upgrade command')
    const source = args.source ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const target = args.target ?? process.cwd()
    let result
    if (args.command === 'scan') result = scanUpgrade(source, target)
    else if (args.command === 'apply')
      result = applyUpgrade(source, target, readJson(resolve(args.plan ?? '')), args.paths)
    else if (args.command === 'record')
      result = recordUpgrade(
        source,
        target,
        readJson(resolve(args.plan ?? '')),
        args.paths,
        args.evidence,
      )
    else if (args.command === 'rollback') result = rollbackUpgrade(target, args.run)
    else fail('Usage: project:upgrade scan|apply|record|rollback [--source path] [--target path]')
    if (args.out) {
      // Report output is opt-in, exclusive, and must not overwrite project/source files.
      const requested = resolve(args.out)
      for (const root of [realpathSync(source), realpathSync(target)]) {
        const rel = relative(root, requested).split(sep).join('/')
        if (rel && !rel.startsWith('../') && rel !== '..' && !isAbsolute(rel)) safePath(root, rel)
      }
      const output = join(realpathSync(dirname(requested)), basename(requested))
      for (const root of [realpathSync(source), realpathSync(target)]) {
        const rel = relative(root, output).split(sep).join('/')
        if (
          !rel.startsWith('../') &&
          rel !== '..' &&
          !isAbsolute(rel) &&
          !rel.startsWith('.local/')
        )
          fail('Write upgrade reports only to .local or outside the source/product')
        if (!isAbsolute(rel) && !rel.startsWith('../')) safePath(root, rel)
      }
      writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    }
    console.log(
      JSON.stringify(
        args.out
          ? { id: result.id, counts: result.counts, output: resolve(args.out), note: result.note }
          : result,
        null,
        2,
      ),
    )
  } catch (error) {
    console.error(
      error?.code
        ? 'Upgrade filesystem operation failed; no file contents were printed. Inspect paths and any existing journal.'
        : error.message,
    )
    process.exitCode = 2
  }
}
