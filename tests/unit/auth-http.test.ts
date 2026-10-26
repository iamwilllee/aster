import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import { translate } from '../../src/i18n/core'
import { handleAuthRequest } from '../../src/modules/auth/http.server'
const state = vi.hoisted(() => ({ features: {} }))
vi.mock('@/config/features', () => ({ features: state.features }))
let runtime: Awaited<ReturnType<typeof testDatabase>>
const origin = 'http://127.0.0.1:3100',
  password = 'Fixture-auth-http-2026!',
  email = 'http-fixture@example.test'
const call = (path: string, data?: unknown, headers: Record<string, string> = {}) =>
  handleAuthRequest(
    new Request(path.startsWith('http') ? path : origin + '/api/auth' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { origin, 'content-type': 'application/json', ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  )
beforeAll(async () => {
  runtime = await testDatabase()
})
afterAll(async () => runtime.dispose())
afterEach(() => vi.restoreAllMocks())
beforeEach(async () => {
  Object.assign(state.features, featurePreset('web-app'))
  Object.assign(env, {
    DB: runtime.db,
    ENVIRONMENT: 'local',
    APP_ORIGIN: origin,
    MAIL_MODE: 'local',
    BETTER_AUTH_SECRET: 'synthetic-http-auth-secret-at-least-32-characters',
  })
  await runtime.db.batch(
    ['user', 'verification', 'dev_mail', 'rate_limit', 'verification_resend', 'admin_audit'].map(
      (t) => runtime.db.prepare('DELETE FROM ' + t),
    ),
  )
})
async function verifiedUser() {
  expect((await call('/sign-up/email', { name: 'HTTP fixture', email, password })).status).toBe(200)
  const mail = await runtime.db
    .prepare('SELECT url FROM dev_mail WHERE recipient=? ORDER BY created_at DESC LIMIT 1')
    .bind(email)
    .first<{ url: string }>()
  expect(mail).not.toBeNull()
  expect((await call(mail!.url)).status).toBe(302)
  return (await runtime.db
    .prepare('SELECT id FROM user WHERE email=?')
    .bind(email)
    .first<{ id: string }>())!.id
}
it('real SDK unexpected errors return a localized generic response and keep error severity without SQL parameters', async () => {
  const id = await verifiedUser()
  expect(
    (await call('/request-password-reset', { email, redirectTo: '/reset-password' })).status,
  ).toBe(200)
  const mail = await runtime.db
    .prepare(
      "SELECT url FROM dev_mail WHERE recipient=? AND url LIKE '%reset-password%' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(email)
    .first<{ url: string }>()
  const url = new URL(mail!.url),
    token = url.searchParams.get('token') ?? url.pathname.split('/').pop()!
  const originalHash = (await runtime.db
    .prepare('SELECT password FROM account WHERE user_id=?')
    .bind(id)
    .first<{ password: string }>())!.password
  await runtime.db
    .prepare('INSERT INTO account_access(user_id,disabled_at,revision,updated_at)VALUES(?,1,1,1)')
    .bind(id)
    .run()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const response = await call(
    '/reset-password',
    { token, newPassword: 'Never-log-new-password-2026!' },
    { 'x-starter-locale': 'zh' },
  )
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toMatchObject({
    code: 'AUTH_UNAVAILABLE',
    message: translate('zh', 'error_auth_unavailable'),
  })
  const lines = [...error.mock.calls, ...warn.mock.calls, ...info.mock.calls]
  const output = JSON.stringify(lines)
  for (const sentinel of [
    token,
    originalHash,
    password,
    'Never-log-new-password-2026!',
    'Failed query',
    'params:',
    '# SERVER_ERROR',
  ])
    expect(output).not.toContain(sentinel)
  expect(error).toHaveBeenCalled()
  expect(lines.every((args) => args.length === 1 && typeof args[0] === 'string')).toBe(true)
  const events = error.mock.calls.map(
    (args) =>
      JSON.parse(String(args[0])) as {
        event: string
        severity: string
        category: string
        requestId: string
      },
  )
  expect(events[0]!.requestId).toMatch(/^[a-f0-9-]{36}$/)
  expect(events).toContainEqual({
    event: 'auth_sdk',
    severity: 'error',
    category: 'storage',
    requestId: events[0]!.requestId,
  })
  expect(
    (await runtime.db
      .prepare('SELECT password FROM account WHERE user_id=?')
      .bind(id)
      .first<{ password: string }>())!.password,
  ).toBe(originalHash)
})
it('preserves expected API error status and successful session headers instead of treating all auth responses as unavailable', async () => {
  await verifiedUser()
  const foreign = await call(
    '/sign-in/email',
    { email, password },
    { origin: 'https://untrusted.example' },
  )
  expect(foreign.status).toBe(403)
  expect(await foreign.json()).toMatchObject({ code: 'INVALID_ORIGIN' })
  const wrong = await call('/sign-in/email', { email, password: 'Wrong-fixture-password-2026!' })
  expect(wrong.status).toBe(401)
  const good = await call('/sign-in/email', { email, password })
  expect(good.status).toBe(200)
  expect(good.headers.has('set-cookie')).toBe(true)
  expect(good.headers.get('cache-control')).toBe('no-store')
})
it('logs and sanitizes failures before the SDK router is constructed without changing other requests', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  Object.assign(env, { BETTER_AUTH_SECRET: 'invalid' })
  const response = await call('/get-session')
  expect(response.status).toBe(503)
  expect(JSON.stringify(error.mock.calls)).not.toContain('BETTER_AUTH_SECRET')
  expect(JSON.parse(String(error.mock.calls[0]![0]))).toMatchObject({
    severity: 'error',
    category: 'runtime',
  })
})
