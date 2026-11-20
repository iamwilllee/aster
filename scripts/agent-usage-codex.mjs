// Local Codex rollout adapter. Only allowlisted metadata leaves this reader.
import { createReadStream } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const counterFields = [
  'input_tokens',
  'cached_input_tokens',
  'cache_write_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
]
const required = ['input_tokens', 'output_tokens', 'total_tokens']
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/
export const safeIdentifier = (value) => typeof value === 'string' && identifier.test(value)
const safeModel = (value) => (safeIdentifier(value) ? value : 'unknown')
function timestamp(value, fallback) {
  const millis = typeof value === 'number' ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value)
  return Number.isFinite(millis)
    ? new Date(millis).toISOString()
    : Number.isFinite(Date.parse(fallback))
      ? new Date(fallback).toISOString()
      : null
}
function counters(value) {
  if (!value || required.some((k) => !Number.isSafeInteger(value[k]) || value[k] < 0)) return null
  if (value.total_tokens !== value.input_tokens + value.output_tokens) return null
  const out = Object.fromEntries(
    counterFields.map((k) => [
      k,
      Number.isSafeInteger(value[k]) && value[k] >= 0 ? value[k] : null,
    ]),
  )
  if (out.cached_input_tokens > out.input_tokens || out.reasoning_output_tokens > out.output_tokens)
    return null
  return out
}

export async function findCodexSource({
  threadId,
  source,
  codexHome = process.env.CODEX_HOME || join(homedir(), '.codex'),
}) {
  if (source) return realpath(resolve(source))
  if (!safeIdentifier(threadId)) return null
  const matches = []
  async function visit(dir, depth = 0) {
    if (depth > 4) return
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (item.isDirectory()) await visit(join(dir, item.name), depth + 1)
      else if (
        item.isFile() &&
        item.name.startsWith('rollout-') &&
        item.name.endsWith(`-${threadId}.jsonl`)
      )
        matches.push(join(dir, item.name))
    }
  }
  try {
    await visit(join(codexHome, 'sessions'))
  } catch {
    return null
  }
  // Never choose another conversation or guess by modification time.
  return matches.length === 1 ? realpath(matches[0]) : null
}

export async function readCodexUsage(path, expectedThread) {
  const file = await stat(path)
  if (!file.isFile()) throw Error('unsupported-source')
  const turns = [],
    issues = []
  let sessionId = null,
    current = null,
    previous = null,
    line = 0
  const stream = createReadStream(path, { encoding: 'utf8', end: Math.max(0, file.size - 1) })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const text of reader) {
      line++
      if (!text.trim()) continue
      let row
      try {
        row = JSON.parse(text)
      } catch {
        previous = null
        issues.push({ line, reason: 'unreadable-record' })
        continue
      }
      const p = row?.payload
      if (!p || typeof p !== 'object') continue
      if (row.type === 'session_meta') sessionId = safeIdentifier(p.id) ? p.id : null
      if (row.type === 'event_msg' && p.type === 'task_started') {
        if (current && !current.terminal)
          issues.push({ line, reason: 'overlapping-or-incomplete-turns' })
        current = {
          startedAt: timestamp(p.started_at, row.timestamp),
          id: safeIdentifier(p.turn_id) ? p.turn_id : null,
          line,
          baseline: previous,
          samples: [],
          models: new Set(),
          efforts: new Set(),
          terminal: null,
        }
        turns.push(current)
      }
      if (row.type === 'turn_context' && current && p.turn_id === current.id) {
        current.models.add(safeModel(p.model))
        if (
          ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(p.effort)
        )
          current.efforts.add(p.effort)
      }
      if (row.type === 'event_msg' && p.type === 'token_count' && p.info) {
        const value = counters(p.info.total_token_usage)
        if (!value) {
          previous = null
          issues.push({ line, reason: 'invalid-usage-counter' })
        } else {
          if (current && !current.terminal) {
            if (!current.samples.length) {
              const last = counters(p.info.last_token_usage)
              current.initialCounter = Boolean(
                last && required.every((key) => last[key] === value[key]),
              )
            }
            current.samples.push(value)
          } else issues.push({ line, reason: 'usage-outside-turn' })
          previous = value
        }
      }
      if (
        row.type === 'event_msg' &&
        ['task_complete', 'turn_aborted'].includes(p.type) &&
        current &&
        p.turn_id === current.id
      ) {
        current.terminal = p.type
        current.completedAt = timestamp(p.completed_at, row.timestamp)
        current.endLine = line
      }
    }
  } finally {
    reader.close()
    stream.destroy()
  }
  if (!sessionId || (expectedThread && sessionId !== expectedThread))
    throw Error('source-identity-mismatch')
  return { sessionId, turns, issues }
}

export function measureCodexWindow(data, startTurn, endTurn = null) {
  const start = data.turns.findIndex((turn) => turn.id === startTurn)
  const end = endTurn
    ? data.turns.findIndex((turn, i) => i >= start && turn.id === endTurn)
    : data.turns.length - 1
  if (start < 0 || end < start)
    return {
      totals: null,
      coverage: 'unavailable',
      reasons: ['missing-task-boundary'],
      models: [],
      efforts: [],
      terminal: false,
    }
  const turns = data.turns.slice(start, end + 1)
  const reasons = new Set(
    data.issues
      .filter((x) => x.line >= turns[0].line && x.line <= (turns.at(-1).endLine ?? Infinity))
      .map((x) => x.reason),
  )
  let previous = turns[0].baseline
  // Zero is known only at the first observed turn of a new session.
  if (
    !previous &&
    start === 0 &&
    turns[0].initialCounter &&
    !data.issues.some((x) => x.line < turns[0].line)
  )
    previous = Object.fromEntries(counterFields.map((k) => [k, 0]))
  if (!previous) reasons.add('missing-baseline')
  const sums = Object.fromEntries(counterFields.map((k) => [k, 0]))
  let intervals = 0
  for (const turn of turns) {
    if (!turn.terminal) reasons.add('turn-in-progress')
    if (turn.terminal === 'turn_aborted') reasons.add('interrupted-turn')
    if (!turn.samples.length) reasons.add('missing-turn-usage')
    if (!turn.models.size || turn.models.has('unknown')) reasons.add('model-metadata-unavailable')
    for (const value of turn.samples) {
      if (previous) {
        if (required.some((k) => value[k] < previous[k])) reasons.add('counter-reset')
        else {
          intervals++
          for (const key of counterFields) {
            if (value[key] === null || previous[key] === null || value[key] < previous[key]) {
              sums[key] = null
              if (!required.includes(key)) reasons.add('incomplete-detail-counters')
            } else if (sums[key] !== null) {
              const difference = value[key] - previous[key]
              const parent =
                key === 'cached_input_tokens'
                  ? 'input_tokens'
                  : key === 'reasoning_output_tokens'
                    ? 'output_tokens'
                    : null
              if (parent && difference > value[parent] - previous[parent]) {
                sums[key] = null
                reasons.add('inconsistent-detail-counters')
                continue
              }
              sums[key] += difference
              if (!Number.isSafeInteger(sums[key])) throw Error('counter-overflow')
            }
          }
        }
      }
      previous = value
    }
  }
  if (!intervals) reasons.add('no-measurable-usage')
  return {
    totals: intervals ? sums : null,
    coverage: !intervals ? 'unavailable' : reasons.size ? 'partial' : 'complete',
    reasons: [...reasons],
    models: [...new Set(turns.flatMap((x) => [...x.models]))],
    efforts: [...new Set(turns.flatMap((x) => [...x.efforts]))],
    terminal: Boolean(turns.at(-1).terminal),
    completedAt: turns.at(-1).completedAt ?? null,
  }
}
