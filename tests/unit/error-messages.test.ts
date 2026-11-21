// Guards the error contract: user-facing server errors are identified by message keys
// (src/i18n), never by their Chinese text. A text used as an identifier breaks silently when
// it is reworded and falls back to a generic message in English.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../src/i18n/en.json'
import zh from '../../src/i18n/zh.json'
import { HttpError, publicErrorMessage } from '../../src/server/http.server'

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}
const server = [...sources('src/server'), ...sources('src/modules'), ...sources('src/db')]

describe('error messages', () => {
  it('every HttpError names a message key', () => {
    const bad: string[] = []
    for (const file of server) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/new HttpError\(\s*([^,]+),\s*([^,)]+)/g)) {
        const arg = match[2]!.trim()
        // body() checks isMessageKey on a schema message before building this error.
        if (file.endsWith('server/http.server.ts') && arg === 'key') continue
        const literal = /^'([^']*)'$/.exec(arg)
        if (!literal || !(literal[1]! in en))
          bad.push(`${file}: new HttpError(${match[1]}, ${arg})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('server code holds no Chinese string literals', () => {
    const found: string[] = []
    for (const file of server) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const code = line.trim()
          if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return
          if (/(['"`])[^'"`\n]*[\u4e00-\u9fff][^'"`\n]*\1/.test(line))
            found.push(`${file}:${index + 1}`)
        })
    }
    expect(found).toEqual([])
  })

  it('a key is translated by code, with its parameters', () => {
    const error = new HttpError(409, 'error_project_limit', { count: 3 })
    expect(error.code).toBe('error_project_limit')
    expect(publicErrorMessage(error, 'en')).toBe(en.error_project_limit.replace('{count}', '3'))
    expect(publicErrorMessage(error, 'zh')).toBe(zh.error_project_limit.replace('{count}', '3'))
    expect(error.message).toBe(zh.error_project_limit.replace('{count}', '3'))
  })

  it('text from outside gets the generic message instead of leaking', () => {
    const error = new HttpError(502, 'upstream said: secret detail')
    expect(error.code).toBeUndefined()
    expect(publicErrorMessage(error, 'en')).toBe(en.error_request_failed)
  })
})
