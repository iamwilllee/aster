// Development telemetry only: no network, application bindings, prompts or tool output.
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  realpathSync,
  readdirSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  findCodexSource,
  readCodexUsage,
  measureCodexWindow,
  safeIdentifier,
} from './agent-usage-codex.mjs'

export const taskKinds = [
  'init',
  'refactor',
  'auth',
  'upgrade',
  'feature',
  'fix',
  'design',
  'docs',
  'other',
]
export const taskPhases = ['planning', 'implementation', 'configuration', 'acceptance']
const outcomes = ['passed', 'failed', 'blocked', 'incomplete']
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const safeVersion = (path) => {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8')).version
    return safeIdentifier(v) ? v : null
  } catch {
    return null
  }
}
function storage(root) {
  root = realpathSync(resolve(root))
  const tracked = spawnSync('git', ['ls-files', '-z', '--', '.local/agent-usage'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (tracked.status === 0 && tracked.stdout.length) throw Error('usage-files-already-tracked')
  let dir = root
  for (const part of ['.local', 'agent-usage']) {
    dir = join(dir, part)
    if (!existsSync(dir)) mkdirSync(dir, { mode: 0o700 })
    const s = lstatSync(dir)
    if (s.isSymbolicLink() || !s.isDirectory()) throw Error('unsafe-storage')
  }
  const ignore = join(dir, '.gitignore')
  plainFile(ignore)
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', { mode: 0o600, flag: 'wx' })
  else if (readFileSync(ignore, 'utf8').trim() !== '*') throw Error('unsafe-storage-ignore')
  return dir
}
function plainFile(path) {
  if (existsSync(path)) {
    const s = lstatSync(path)
    if (s.isSymbolicLink() || !s.isFile()) throw Error('unsafe-storage')
  }
}
function writeAtomic(path, text) {
  plainFile(path)
  const temp = `${path}.tmp-${randomUUID()}`
  try {
    writeFileSync(temp, text, { flag: 'wx', mode: 0o600 })
    renameSync(temp, path)
  } finally {
    if (existsSync(temp)) unlinkSync(temp)
  }
}
function writeJson(path, value) {
  writeAtomic(path, JSON.stringify(value, null, 2) + '\n')
}
function writeReport(dir, job) {
  const r = job.report
  writeJson(join(dir, `${job.id}.report.json`), r)
  const amount = (key) => r.totals?.[key] ?? 'unavailable'
  writeAtomic(
    join(dir, `${job.id}.report.md`),
    [
      '# Aster development task usage',
      '',
      `- Task: ${r.kind}${r.phase ? ` / ${r.phase}` : ''} (${r.id})`,
      `- State: ${r.status}; coverage: ${r.coverage}`,
      `- Outcome: ${r.outcome ?? 'pending'} (Agent reported, not acceptance proof)`,
      `- Total tokens: ${amount('total_tokens')}`,
      `- Input tokens: ${amount('input_tokens')}; cached subset: ${amount('cached_input_tokens')}`,
      `- Output tokens: ${amount('output_tokens')}; reasoning subset: ${amount('reasoning_output_tokens')}`,
      `- Configured models: ${r.configuredModels.join(', ') || 'unavailable'}`,
      `- Elapsed milliseconds: ${r.durationMilliseconds}; marked waiting: ${r.markedWaitMilliseconds}`,
      `- Agent-marked rework: ${r.reworkCount}`,
      `- Data limitations: ${r.reasons.join(', ') || 'none detected within this recorded thread window'}`,
      '',
      'Input + output = total. Cached input and reasoning output are subsets; do not add them again.',
      'A closing record awaits its final turn. Partial totals are observed lower bounds. No billing amount is inferred.',
      'Scope is one thread and inclusive start/end turns. Other agents, external model tools and isolated Skill overhead are excluded.',
      'Unmarked elapsed time is not measured CPU/model execution time. Compare equivalent tasks, versions and acceptance outcomes.',
      '',
    ].join('\n'),
  )
}
function load(path) {
  plainFile(path)
  const v = JSON.parse(readFileSync(path, 'utf8'))
  if (
    v.schemaVersion !== 1 ||
    !safeIdentifier(v.id) ||
    !taskKinds.includes(v.kind) ||
    !['open', 'closing', 'closed'].includes(v.status)
  )
    throw Error('invalid-local-record')
  return v
}
async function sourceData(job) {
  try {
    if (!job.sourcePath) return { error: 'source-unavailable' }
    return { data: await readCodexUsage(job.sourcePath, job.threadId) }
  } catch {
    return { error: 'source-unavailable-or-incompatible' }
  }
}
function emptyMeasurement(reason) {
  return {
    totals: null,
    coverage: 'unavailable',
    reasons: [reason],
    models: [],
    efforts: [],
    terminal: false,
  }
}
function elapsed(start, end) {
  return Math.max(0, Date.parse(end) - Date.parse(start))
}
function publicReport(job, measurement, now) {
  const end = measurement.completedAt ?? job.closeRequestedAt ?? now
  const duration = elapsed(job.startedAt, end)
  const wait = job.waitMilliseconds + (job.waitStartedAt ? elapsed(job.waitStartedAt, end) : 0)
  return {
    schemaVersion: 1,
    id: job.id,
    kind: job.kind,
    phase: job.phase,
    status: job.status,
    outcome: job.outcome ?? null,
    outcomeBasis: 'agent-reported; not acceptance proof',
    startedAt: job.startedAt,
    closeRequestedAt: job.closeRequestedAt ?? null,
    updatedAt: now,
    source: 'codex-local-rollout-v1',
    scope:
      'one thread, inclusive start/end turns; not isolated Skill overhead or other agents/tools',
    ...measurement,
    configuredModels: measurement.models,
    reasoningEfforts: measurement.efforts,
    durationMilliseconds: duration,
    markedWaitMilliseconds: Math.min(duration, wait),
    unmarkedElapsedMilliseconds: Math.max(0, duration - wait),
    reworkCount: job.reworkCount,
    reworkBasis: 'agent-marked; not automatic retry detection',
    versions: job.versions,
    skillSha256: job.skillSha256,
    toolingSha256: job.toolingSha256 ?? null,
    cost: {
      amount: null,
      currency: null,
      reason: 'No billing data; subscription usage is not an API invoice.',
    },
  }
}
async function refresh(job, now) {
  if (job.status === 'closed') return job
  const result = await sourceData(job)
  let measurement = emptyMeasurement(result.error || 'missing-task-boundary')
  if (result.data && job.startTurnId) {
    const start = result.data.turns.find((x) => x.id === job.startTurnId)
    if (start && hash(JSON.stringify(start.baseline)) === job.baselineHash) {
      if (start.startedAt) job.startedAt = start.startedAt
      measurement = measureCodexWindow(result.data, job.startTurnId, job.endTurnId)
    } else measurement = emptyMeasurement('source-rewritten-or-boundary-missing')
    if (
      job.status === 'closing' &&
      job.endTurnId &&
      result.data.turns.find((turn) => turn.id === job.endTurnId)?.terminal
    )
      job.status = 'closed'
  }
  if (job.status === 'closing' && !job.endTurnId)
    measurement.reasons.push('closing-boundary-unavailable')
  job.report = publicReport(job, measurement, now)
  return job
}

export async function runUsage(command, options = {}) {
  const root = options.root ?? process.cwd(),
    now = options.now ?? new Date().toISOString()
  const dir = storage(root),
    lock = join(dir, 'lock')
  let fd
  try {
    fd = openSync(lock, 'wx', 0o600)
  } catch {
    throw Error('usage-busy')
  }
  try {
    const jobs = readdirSync(dir)
      .filter((x) => /^[a-zA-Z0-9._-]+\.json$/.test(x) && !x.endsWith('.report.json'))
      .map((x) => load(join(dir, x)))
    if (command === 'list')
      return jobs.map((j) => ({
        id: j.id,
        kind: j.kind,
        phase: j.phase,
        status: j.status,
        coverage: j.report?.coverage ?? 'unavailable',
        totalTokens: j.report?.totals?.total_tokens ?? null,
        outcome: j.outcome ?? null,
      }))
    if (command === 'begin') {
      if (
        !taskKinds.includes(options.kind) ||
        (options.phase && !taskPhases.includes(options.phase))
      )
        throw Error('invalid-task-kind-or-phase')
      for (const job of jobs.filter((x) => x.status === 'closing')) {
        await refresh(job, now)
        writeJson(join(dir, `${job.id}.json`), job)
        writeReport(dir, job)
      }
      if (jobs.some((x) => x.status !== 'closed')) throw Error('task-already-open')
      let sourcePath = null,
        data = null
      const threadId = options.threadId ?? process.env.CODEX_THREAD_ID
      if (threadId !== undefined && !safeIdentifier(threadId)) throw Error('invalid-thread-id')
      try {
        sourcePath = await findCodexSource({
          threadId,
          source: options.source,
          codexHome: options.codexHome,
        })
        if (sourcePath) data = await readCodexUsage(sourcePath, threadId)
      } catch {
        sourcePath = null
      }
      const turn = data?.turns.at(-1)
      if (turn?.id && jobs.some((j) => j.threadId === data.sessionId && j.endTurnId === turn.id))
        throw Error('turn-already-assigned')
      const active = turn?.id && !turn.terminal ? turn : null
      const id = randomUUID()
      const job = {
        schemaVersion: 1,
        id,
        kind: options.kind,
        phase: options.phase ?? null,
        status: 'open',
        createdAt: now,
        startedAt: active?.startedAt ?? now,
        threadId: data?.sessionId ?? threadId ?? null,
        sourcePath,
        startTurnId: active?.id ?? null,
        endTurnId: null,
        baselineHash: hash(JSON.stringify(active?.baseline ?? null)),
        waitMilliseconds: 0,
        waitStartedAt: null,
        reworkCount: 0,
        versions: {
          product: safeVersion(join(resolve(root), 'package.json')),
          starter: safeVersion(join(resolve(root), 'starter-version.json')),
          tooling: safeVersion(join(sourceRoot, 'package.json')),
        },
        skillSha256: hash(readFileSync(join(sourceRoot, 'skills/aster-new/SKILL.md'))),
        toolingSha256: hash(
          ['agent-usage.mjs', 'agent-usage-codex.mjs']
            .map((file) => readFileSync(join(sourceRoot, 'scripts', file), 'utf8'))
            .join('\n'),
        ),
      }
      await refresh(job, now)
      writeJson(join(dir, `${id}.json`), job)
      writeReport(dir, job)
      return job.report
    }
    if (!['close', 'report', 'mark', 'abandon'].includes(command)) throw Error('invalid-command')
    const job = options.id
      ? jobs.find((x) => x.id === options.id)
      : jobs.filter((x) => x.status !== 'closed').at(-1)
    if (!job) throw Error('task-not-found')
    if (command === 'abandon') {
      if (!options.id || job.status === 'closed') throw Error('invalid-abandon')
      const result = await sourceData(job)
      job.endTurnId ??= result.data?.turns.at(-1)?.id ?? null
      job.outcome = 'incomplete'
      job.closeRequestedAt = now
      const last = job.report ?? emptyMeasurement('source-unavailable')
      job.status = 'closed'
      const measurement = {
        totals: last.totals,
        coverage: last.totals ? 'partial' : 'unavailable',
        reasons: [...new Set([...last.reasons, 'manually-abandoned-window'])],
        models: last.models,
        efforts: last.efforts,
        terminal: false,
      }
      job.report = publicReport(job, measurement, now)
    }
    if (command === 'mark') {
      if (job.status !== 'open') throw Error('task-not-open')
      if (options.event === 'wait' && !job.waitStartedAt) job.waitStartedAt = now
      else if (options.event === 'resume' && job.waitStartedAt) {
        job.waitMilliseconds += elapsed(job.waitStartedAt, now)
        job.waitStartedAt = null
      } else if (options.event === 'rework') job.reworkCount++
      else throw Error('invalid-mark')
    }
    if (command === 'close') {
      if (!outcomes.includes(options.outcome)) throw Error('invalid-outcome')
      if (job.status === 'open') {
        const result = await sourceData(job)
        job.endTurnId = result.data?.turns.at(-1)?.id ?? null
        job.outcome = options.outcome
        job.closeRequestedAt = now
        if (job.waitStartedAt) {
          job.waitMilliseconds += elapsed(job.waitStartedAt, now)
          job.waitStartedAt = null
        }
        job.status = 'closing'
        // No source cannot become measurable retrospectively. Preserve unavailable, never zero.
        if (!job.startTurnId || !job.endTurnId) job.status = 'closed'
      }
    }
    await refresh(job, now)
    // Closed records are frozen; later turns must never inflate their totals.
    if (!job.report || job.report.status !== job.status)
      job.report = publicReport(job, emptyMeasurement('source-unavailable'), now)
    writeJson(join(dir, `${job.id}.json`), job)
    writeReport(dir, job)
    return job.report
  } finally {
    closeSync(fd)
    unlinkSync(lock)
  }
}

const usage =
  'Usage: pnpm project:usage begin --kind init|refactor|auth|upgrade|feature|fix|design|docs|other [--phase planning|implementation|configuration|acceptance] [--source path] [--thread id] | close --outcome passed|failed|blocked|incomplete [--id id] | report --id id | abandon --id id | list | mark --event wait|resume|rework [--id id]. All commands accept --root path.'
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2)
  try {
    if (command === '--help' || command === 'help') console.log(usage)
    else {
      const allowed = {
        begin: ['root', 'kind', 'phase', 'source', 'thread'],
        close: ['root', 'id', 'outcome'],
        report: ['root', 'id'],
        abandon: ['root', 'id'],
        list: ['root'],
        mark: ['root', 'id', 'event'],
      }
      if (!allowed[command]) throw Error('invalid-command')
      const options = {}
      for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.slice(2)
        if (
          !args[i]?.startsWith('--') ||
          !allowed[command].includes(key) ||
          !args[i + 1] ||
          args[i + 1].startsWith('--') ||
          key in options
        )
          throw Error('invalid-option')
        options[key] = args[i + 1]
      }
      if (options.thread) {
        options.threadId = options.thread
        delete options.thread
      }
      const report = await runUsage(command, options)
      // Keep normal Agent tool output small; full metrics stay in the private receipt.
      console.log(
        JSON.stringify(
          Array.isArray(report)
            ? report
            : {
                id: report.id,
                kind: report.kind,
                phase: report.phase,
                status: report.status,
                coverage: report.coverage,
                totals: report.totals,
                reasons: report.reasons,
                report: `.local/agent-usage/${report.id}.report.md`,
              },
          null,
          2,
        ),
      )
    }
  } catch {
    // Paths, malformed JSON and caller text may contain secrets; never echo them.
    console.error(
      'Usage record unavailable or command rejected. Check task status, source access/format, options and local lock/storage. No raw data was printed. Use --help for commands.',
    )
    process.exitCode = 2
  }
}
