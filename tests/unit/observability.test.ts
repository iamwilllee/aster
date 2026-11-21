import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRequestId, logFailure } from '@/server/observability'

afterEach(() => vi.restoreAllMocks())

describe('request id', () => {
  it('uses the edge id when it has a safe shape and is stable for one request', () => {
    const request = new Request('https://app.example/', {
      headers: { 'cf-ray': '8a1b2c3d4e5f6a7b-SJC' },
    })
    expect(getRequestId(request)).toBe('8a1b2c3d4e5f6a7b-SJC')
    expect(getRequestId(request)).toBe('8a1b2c3d4e5f6a7b-SJC')
  })

  it('ignores a forged header that could inject text into a log line', () => {
    const request = new Request('https://app.example/', {
      headers: { 'cf-ray': 'abc"},{"event":"x' },
    })
    const id = getRequestId(request)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(getRequestId(request)).toBe(id)
  })

  it('differs between requests without an edge id', () => {
    expect(getRequestId(new Request('https://app.example/'))).not.toBe(
      getRequestId(new Request('https://app.example/')),
    )
  })
})

describe('failure log', () => {
  it('records the error class and our fields, never the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logFailure(
      'storage_failed',
      new TypeError('failed for user@example.com at https://x/?token=secret'),
      {
        operation: 'file_delete',
        requestId: 'r1',
      },
    )
    const line = String(spy.mock.calls[0]![0])
    expect(JSON.parse(line)).toEqual({
      event: 'storage_failed',
      severity: 'error',
      operation: 'file_delete',
      requestId: 'r1',
      errorName: 'TypeError',
    })
    expect(line).not.toMatch(/example\.com|secret|token/)
  })

  it('keeps a machine-readable error code and drops anything else', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logFailure('x', Object.assign(new Error('m'), { code: 'd1_error' }))
    logFailure('y', Object.assign(new Error('m'), { code: 'SELECT * FROM user' }))
    const logged = (index: number) =>
      JSON.parse(String(spy.mock.calls[index]![0])) as { code?: string }
    expect(logged(0).code).toBe('d1_error')
    expect(logged(1).code).toBeUndefined()
  })
})
