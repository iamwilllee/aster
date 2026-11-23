import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { runUsage } from '../../scripts/agent-usage.mjs'
import {
  readCodexUsage,
  measureCodexWindow,
  findCodexSource,
} from '../../scripts/agent-usage-codex.mjs'
import { createProject } from '../../skills/aster-new/scripts/create-project.mjs'

const stamp = '2026-10-29T00:00:00.000Z'
const row = (type, payload) => JSON.stringify({ timestamp: stamp, type, payload }) + '\n'
const event = (type, data = {}) => row('event_msg', { type, ...data })
const start = (id) =>
  event('task_started', { turn_id: id, started_at: stamp }) +
  row('turn_context', { turn_id: id, model: 'fixture-model', effort: 'high' })
const finish = (id) =>
  event('task_complete', {
    turn_id: id,
    completed_at: '2026-10-29T00:01:00.000Z',
    last_agent_message: 'DO-NOT-RETAIN-THIS-CONVERSATION',
  })
const counter = (input, output, cached = 0, reasoning = 0) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
})
const sample = (value) =>
  event('token_count', { info: { total_token_usage: value, last_token_usage: value } })
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aster-usage-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = join(root, 'trace.jsonl')
  writeFileSync(source, row('session_meta', { id: 'thread-fixture' }) + start('turn-a'))
  return { root, source, threadId: 'thread-fixture', now: stamp }
}
const append = (f, text) => appendFileSync(f.source, text)
const begin = (f, extra = {}) => runUsage('begin', { ...f, kind: 'auth', ...extra })

test('cumulative snapshots are differenced once; cached input and reasoning are subsets, not extra tokens', async (t) => {
  const f = fixture(t)
  append(
    f,
    sample(counter(100, 20, 60, 5)) +
      event('token_count', {
        info: {
          total_token_usage: counter(100, 20, 60, 5),
          last_token_usage: counter(999999, 999999),
        },
      }) +
      sample(counter(160, 40, 90, 15)) +
      finish('turn-a'),
  )
  const data = await readCodexUsage(f.source, f.threadId)
  const report = measureCodexWindow(data, 'turn-a', 'turn-a')
  assert.equal(report.coverage, 'complete')
  assert.equal(report.totals.total_tokens, 200)
  assert.equal(report.totals.cached_input_tokens, 90)
  assert.equal(report.totals.reasoning_output_tokens, 15)
  assert.equal(report.totals.total_tokens, report.totals.input_tokens + report.totals.output_tokens)
})

test('closing waits for the final reply usage and freezes at its completed turn, excluding later work', async (t) => {
  const f = fixture(t)
  append(f, sample(counter(100, 20)))
  const job = await begin(f)
  const closing = await runUsage('close', { ...f, id: job.id, outcome: 'passed' })
  assert.equal(closing.status, 'closing')
  assert.ok(closing.reasons.includes('turn-in-progress'))
  append(
    f,
    sample(counter(140, 30)) + finish('turn-a') + start('turn-b') + sample(counter(900, 300)),
  )
  const closed = await runUsage('report', { ...f, id: job.id })
  assert.equal(closed.status, 'closed')
  assert.equal(closed.coverage, 'complete')
  assert.equal(closed.totals.total_tokens, 170)
  append(f, sample(counter(1000, 400)) + finish('turn-b'))
  assert.deepEqual(await runUsage('report', { ...f, id: job.id }), closed)
  assert.equal(closed.cost.amount, null)
})

test('a task starts at its current turn baseline, not at the entire historical conversation', async (t) => {
  const f = fixture(t)
  append(
    f,
    sample(counter(10000, 2000)) +
      finish('turn-a') +
      start('turn-b') +
      sample(counter(10100, 2020)),
  )
  const job = await begin(f, { kind: 'refactor' })
  append(f, sample(counter(10200, 2040)) + finish('turn-b'))
  const closed = await runUsage('close', { ...f, id: job.id, outcome: 'passed' })
  assert.equal(closed.totals.total_tokens, 240)
})

test('missing/incompatible sources never become a fabricated zero or echo source text', async (t) => {
  const f = fixture(t)
  writeFileSync(f.source, 'PRIVATE-SECRET\n')
  const result = await begin(f)
  assert.equal(result.coverage, 'unavailable')
  assert.equal(result.totals, null)
  const closed = await runUsage('close', { ...f, id: result.id, outcome: 'blocked' })
  assert.equal(closed.status, 'closed')
  assert.equal(closed.totals, null)
  for (const file of readdirSync(join(f.root, '.local/agent-usage')).filter((x) =>
    x.endsWith('.json'),
  ))
    assert.ok(
      !readFileSync(join(f.root, '.local/agent-usage', file), 'utf8').includes('PRIVATE-SECRET'),
    )
})

test('counter resets, invalid records and missing optional fields leave measurable lower bounds visibly partial', async (t) => {
  const f = fixture(t)
  append(
    f,
    sample(counter(100, 20)) +
      '{broken\n' +
      sample(counter(10, 2)) +
      sample({ input_tokens: 30, output_tokens: 5, total_tokens: 35 }) +
      finish('turn-a'),
  )
  const result = measureCodexWindow(await readCodexUsage(f.source, f.threadId), 'turn-a', 'turn-a')
  assert.equal(result.coverage, 'partial')
  assert.ok(result.reasons.includes('counter-reset'))
  assert.ok(result.reasons.includes('unreadable-record'))
  assert.equal(result.totals.total_tokens, 143)
  assert.equal(result.totals.cached_input_tokens, null)
})

test('invalid core totals and missing turn usage cannot pass as complete', async (t) => {
  const f = fixture(t)
  append(f, sample({ ...counter(100, 20), total_tokens: 999 }) + finish('turn-a'))
  const result = measureCodexWindow(await readCodexUsage(f.source, f.threadId), 'turn-a', 'turn-a')
  assert.equal(result.coverage, 'unavailable')
  assert.equal(result.totals, null)
  assert.ok(result.reasons.includes('invalid-usage-counter'))
})

test('one project cannot double-assign a turn or overlap open tasks; terminal pending tasks reconcile before the next begin', async (t) => {
  const f = fixture(t)
  append(f, sample(counter(100, 20)))
  const a = await begin(f)
  await assert.rejects(begin(f), /task-already-open/)
  await runUsage('close', { ...f, id: a.id, outcome: 'passed' })
  await assert.rejects(begin(f), /task-already-open/)
  append(f, finish('turn-a'))
  await assert.rejects(begin(f), /turn-already-assigned/)
  append(f, start('turn-b'))
  const b = await begin(f)
  assert.notEqual(a.id, b.id)
})

test('manually marked waiting and rework are separated from token accounting and acceptance', async (t) => {
  const f = fixture(t)
  append(f, sample(counter(10, 2)))
  const job = await begin(f)
  const call = (event, now) => runUsage('mark', { ...f, id: job.id, event, now })
  await call('wait', '2026-10-29T00:00:10.000Z')
  await call('resume', '2026-10-29T00:00:30.000Z')
  const result = await call('rework', '2026-10-29T00:00:40.000Z')
  assert.equal(result.markedWaitMilliseconds, 20000)
  assert.equal(result.reworkCount, 1)
  assert.equal(result.totals.total_tokens, 12)
  assert.match(result.outcomeBasis, /not acceptance proof/)
})

test('private receipts retain only allowlisted metadata, and symlinked storage is rejected', async (t) => {
  const f = fixture(t)
  append(f, row('response_item', { text: 'PROMPT-SECRET-AND-COOKIE' }) + sample(counter(10, 2)))
  const job = await begin(f)
  append(f, finish('turn-a'))
  await runUsage('close', { ...f, id: job.id, outcome: 'passed' })
  const report = readFileSync(join(f.root, '.local/agent-usage', `${job.id}.report.json`), 'utf8')
  assert.ok(!report.includes(f.source))
  for (const file of readdirSync(join(f.root, '.local/agent-usage')).filter((x) =>
    x.endsWith('.json'),
  )) {
    const text = readFileSync(join(f.root, '.local/agent-usage', file), 'utf8')
    assert.ok(!/PROMPT-SECRET|DO-NOT-RETAIN|999999/.test(text))
  }
  const other = join(f.root, 'other')
  mkdirSync(other)
  symlinkSync(join(f.root, '.local'), join(other, '.local'))
  await assert.rejects(runUsage('list', { root: other }), /unsafe-storage/)
})

test('discovery requires a unique explicit thread match and validates source identity', async (t) => {
  const f = fixture(t),
    home = join(f.root, 'codex')
  mkdirSync(join(home, 'sessions/2026/10/29'), { recursive: true })
  const one = join(home, 'sessions/2026/10/29/rollout-one-thread-fixture.jsonl')
  writeFileSync(one, readFileSync(f.source))
  assert.equal(
    await findCodexSource({ threadId: f.threadId, codexHome: home }),
    await import('node:fs/promises').then((fs) => fs.realpath(one)),
  )
  writeFileSync(join(home, 'sessions/rollout-two-thread-fixture.jsonl'), readFileSync(f.source))
  assert.equal(await findCodexSource({ threadId: f.threadId, codexHome: home }), null)
  await assert.rejects(readCodexUsage(f.source, 'another-thread'), /source-identity-mismatch/)
})

test('source rewrites do not silently change a recorded baseline', async (t) => {
  const f = fixture(t)
  append(
    f,
    sample(counter(100, 20)) + finish('turn-a') + start('turn-b') + sample(counter(120, 25)),
  )
  const job = await begin(f)
  writeFileSync(
    f.source,
    readFileSync(f.source, 'utf8')
      .replace('"input_tokens":100', '"input_tokens":101')
      .replace('"total_tokens":120', '"total_tokens":121'),
  )
  const result = await runUsage('report', { ...f, id: job.id })
  assert.equal(result.coverage, 'unavailable')
  assert.ok(result.reasons.includes('source-rewritten-or-boundary-missing'))
})

test('generated products get dependency-free tooling but never inherit local receipts', async (t) => {
  const f = fixture(t)
  const target = join(f.root, 'generated')
  createProject({ source: resolve('.'), target, install: false })
  const output = spawnSync(process.execPath, ['scripts/agent-usage.mjs', '--help'], {
    cwd: target,
    encoding: 'utf8',
  })
  assert.equal(output.status, 0)
  assert.match(output.stdout, /project:usage/)
  assert.ok(!readdirSync(target).includes('.local'))
})

test('a truncated history without a reliable initial baseline remains unavailable, not a full-session total', async (t) => {
  const f = fixture(t)
  append(
    f,
    event('token_count', {
      info: { total_token_usage: counter(10000, 2000), last_token_usage: counter(10, 2) },
    }) + finish('turn-a'),
  )
  const result = measureCodexWindow(await readCodexUsage(f.source, f.threadId), 'turn-a', 'turn-a')
  assert.equal(result.totals, null)
  assert.equal(result.coverage, 'unavailable')
  assert.ok(result.reasons.includes('missing-baseline'))
})

test('receipts self-ignore in arbitrary Git apps and refuse existing tracked telemetry', async (t) => {
  const f = fixture(t)
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: f.root }).status, 0)
  append(f, sample(counter(10, 2)))
  const job = await begin(f)
  const ignored = spawnSync('git', ['check-ignore', '.local/agent-usage/' + job.id + '.json'], {
    cwd: f.root,
    encoding: 'utf8',
  })
  assert.equal(ignored.status, 0)
  assert.equal(
    spawnSync('git', ['add', '-f', '.local/agent-usage/' + job.id + '.json'], { cwd: f.root })
      .status,
    0,
  )
  await assert.rejects(runUsage('report', { ...f, id: job.id }), /usage-files-already-tracked/)
})

test('real Codex epoch-second timestamps produce the correct task interval', async (t) => {
  const f = fixture(t)
  writeFileSync(
    f.source,
    row('session_meta', { id: f.threadId }) +
      event('task_started', { turn_id: 'epoch-turn', started_at: 1793232000 }) +
      row('turn_context', { turn_id: 'epoch-turn', model: 'fixture-model' }) +
      sample(counter(100, 20)),
  )
  const job = await begin(f)
  assert.equal(job.startedAt, '2026-10-29T00:00:00.000Z')
  append(f, event('task_complete', { turn_id: 'epoch-turn', completed_at: 1793232060 }))
  const result = await runUsage('close', { ...f, id: job.id, outcome: 'passed' })
  assert.equal(result.durationMilliseconds, 60000)
})

test('lost pending sources can be explicitly abandoned without a fake completed total', async (t) => {
  const f = fixture(t)
  append(f, sample(counter(100, 20)))
  const job = await begin(f)
  await runUsage('close', { ...f, id: job.id, outcome: 'passed' })
  rmSync(f.source)
  const result = await runUsage('abandon', { ...f, id: job.id })
  assert.equal(result.status, 'closed')
  assert.equal(result.outcome, 'incomplete')
  assert.equal(result.coverage, 'partial')
  assert.equal(result.totals.total_tokens, 120)
  assert.ok(result.reasons.includes('manually-abandoned-window'))
})

test('inconsistent subset deltas are unknown rather than impossible cache/reasoning savings', async (t) => {
  const f = fixture(t)
  append(f, sample(counter(100, 20, 10, 5)) + sample(counter(110, 25, 100, 20)) + finish('turn-a'))
  const result = measureCodexWindow(await readCodexUsage(f.source, f.threadId), 'turn-a', 'turn-a')
  assert.equal(result.totals.total_tokens, 135)
  assert.equal(result.totals.cached_input_tokens, null)
  assert.equal(result.totals.reasoning_output_tokens, null)
  assert.ok(result.reasons.includes('inconsistent-detail-counters'))
})
