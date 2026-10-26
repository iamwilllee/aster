import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import { accountSecurity } from '../../src/modules/auth/security.server'
import { sessionDevice } from '../../src/modules/auth/security'
import { allowPasswordChange } from '../../src/server/rate-limit.server'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), changePassword: vi.fn(), features: {} }))
vi.mock('@/config/features', () => ({ features: mocks.features }))
vi.mock('@/modules/auth/auth.server', () => ({ createAuth: () => ({ api: mocks }) }))
let runtime: Awaited<ReturnType<typeof testDatabase>>
const origin = 'http://127.0.0.1:3100'
const request = (path = '/security', method = 'GET', data?: unknown) =>
  new Request(origin + '/api/account' + path, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
beforeAll(async () => {
  runtime = await testDatabase()
  Object.assign(env, { DB: runtime.db })
})
afterAll(async () => runtime?.dispose())
beforeEach(async () => {
  Object.assign(mocks.features, featurePreset('web-app'))
  mocks.getSession.mockReset().mockResolvedValue({
    user: { id: 'a', emailVerified: true },
    session: { id: 'current-a', token: 'fixture-never-public' },
  })
  mocks.changePassword.mockReset()
  await runtime.db.batch([
    runtime.db.prepare('DELETE FROM session'),
    runtime.db.prepare('DELETE FROM account'),
    runtime.db.prepare('DELETE FROM user'),
    runtime.db.prepare('DELETE FROM api_rate_limit'),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)',
        )
        .bind(id, id, `${id}@example.test`, Date.now(), Date.now()),
    ),
  ])
  for (const [id, owner, expiry, agent] of [
    [
      'current-a',
      'a',
      Date.now() + 60_000,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1',
    ],
    ['other-a', 'a', Date.now() + 60_000, 'Mozilla/5.0 (Windows NT 10.0) Chrome/131 Safari/537.36'],
    ['expired-a', 'a', Date.now() - 10_000, 'private-raw-UA'],
    ['foreign-b', 'b', Date.now() + 60_000, 'private-raw-UA'],
  ] as const) {
    await runtime.db
      .prepare(
        'INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at,user_agent,ip_address) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        `fixture-secret-${id}`,
        owner,
        expiry,
        Date.now(),
        Date.now(),
        agent,
        'fixture-private-ip',
      )
      .run()
  }
  await runtime.db
    .prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('credential-a','a','credential','a','fixture-password-hash',?,?)",
    )
    .bind(Date.now(), Date.now())
    .run()
})

it('lists only active owner sessions with a metadata whitelist and puts the current one first', async () => {
  const response = await accountSecurity(request())
  const data = await response.json<{
    canChangePassword: boolean
    sessions: Record<string, unknown>[]
    hasMore: boolean
  }>()
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(data.canChangePassword).toBe(true)
  expect(data.sessions.map((session) => session.id)).toEqual(['current-a', 'other-a'])
  expect(data.sessions[0]).toMatchObject({ current: true, browser: 'safari', platform: 'macos' })
  expect(Object.keys(data.sessions[0]!).sort()).toEqual(
    ['id', 'current', 'browser', 'platform', 'createdAt', 'updatedAt', 'expiresAt'].sort(),
  )
  expect(JSON.stringify(data)).not.toMatch(
    /fixture-secret|fixture-private|password-hash|user_agent|ip_address/,
  )
  expect(data.hasMore).toBe(false)
  expect(mocks.getSession).toHaveBeenCalledWith(
    expect.objectContaining({ query: { disableCookieCache: true } }),
  )
})
it('no-password and Google-only accounts cannot use password changes; auth-off needs no session read', async () => {
  await runtime.db.prepare('DELETE FROM account').run()
  await runtime.db
    .prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,created_at,updated_at) VALUES ('google-a','a','google','a',?,?)",
    )
    .bind(Date.now(), Date.now())
    .run()
  expect(await (await accountSecurity(request())).json()).toMatchObject({
    canChangePassword: false,
  })
  await expect(
    accountSecurity(
      request('/password', 'POST', {
        currentPassword: 'fixture-old',
        newPassword: 'fixture-new-password',
      }),
    ),
  ).rejects.toMatchObject({ status: 404 })
  Object.assign(mocks.features, { emailPassword: false, google: true })
  expect(await (await accountSecurity(request())).json()).toMatchObject({
    canChangePassword: false,
  })
  expect(mocks.changePassword).not.toHaveBeenCalled()
  Object.assign(mocks.features, { auth: false })
  mocks.getSession.mockClear()
  await expect(accountSecurity(request())).rejects.toMatchObject({ status: 404 })
  expect(mocks.getSession).not.toHaveBeenCalled()
})
it('revocation cannot touch another account or the current session, and stale authorization cannot delete', async () => {
  await expect(accountSecurity(request('/sessions/foreign-b', 'DELETE'))).rejects.toMatchObject({
    status: 404,
  })
  await expect(accountSecurity(request('/sessions/current-a', 'DELETE'))).rejects.toMatchObject({
    status: 409,
  })
  await runtime.db.prepare("DELETE FROM session WHERE id = 'current-a'").run()
  await expect(accountSecurity(request('/sessions/other-a', 'DELETE'))).rejects.toMatchObject({
    status: 404,
  })
  expect(await runtime.db.prepare("SELECT id FROM session WHERE id='other-a'").first()).toBeTruthy()
  expect(
    await runtime.db.prepare("SELECT id FROM session WHERE id='foreign-b'").first(),
  ).toBeTruthy()
})
it('bulk revocation retains the current owner session and every other account', async () => {
  const response = await accountSecurity(request('/sessions/revoke-others', 'POST'))
  expect(response.status).toBe(200)
  const rows = await runtime.db.prepare('SELECT id FROM session ORDER BY id').all<{ id: string }>()
  expect(rows.results.map((row) => row.id)).toEqual(['current-a', 'foreign-b'])
})
it('password input cannot override forced revocation and only HttpOnly cookies cross the response boundary', async () => {
  const body = { currentPassword: 'fixture-old-password', newPassword: 'fixture-new-password' }
  await expect(
    accountSecurity(request('/password', 'POST', { ...body, revokeOtherSessions: false })),
  ).rejects.toMatchObject({ status: 400 })
  mocks.changePassword.mockResolvedValue(
    new Response(
      JSON.stringify({ token: 'fixture-secret-never-public', user: { email: 'private' } }),
      { headers: { 'set-cookie': 'fixture-session=rotated; HttpOnly; SameSite=Lax; Path=/' } },
    ),
  )
  const response = await accountSecurity(request('/password', 'POST', body))
  expect(await response.json()).toEqual({ ok: true })
  expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  expect(mocks.changePassword).toHaveBeenCalledWith(
    expect.objectContaining({ body: { ...body, revokeOtherSessions: true }, asResponse: true }),
  )
})
it('password failures do not return success or expose provider error text', async () => {
  mocks.changePassword.mockResolvedValue(
    new Response(
      JSON.stringify({ code: 'INVALID_PASSWORD', message: 'private-provider-diagnostic' }),
      { status: 400 },
    ),
  )
  await expect(
    accountSecurity(
      request('/password', 'POST', {
        currentPassword: 'fixture-old-password',
        newPassword: 'fixture-new-password',
      }),
    ),
  ).rejects.toMatchObject({ status: 400, message: '当前密码不正确。' })
  mocks.changePassword.mockResolvedValue(
    new Response(JSON.stringify({ code: 'UNKNOWN', message: 'private-provider-diagnostic' }), {
      status: 500,
    }),
  )
  await expect(
    accountSecurity(
      request('/password', 'POST', {
        currentPassword: 'fixture-old-password',
        newPassword: 'fixture-new-password',
      }),
    ),
  ).rejects.toMatchObject({ status: 503, message: '修改密码未完成，请重试或重新登录。' })
})
it('password limits are atomic, separate from other users and recover next window', async () => {
  const now = 1_800_001_010_000
  const results = await Promise.all(Array.from({ length: 8 }, () => allowPasswordChange('a', now)))
  expect(results.filter(Boolean)).toHaveLength(5)
  expect(await allowPasswordChange('b', now)).toBe(true)
  expect(await allowPasswordChange('a', now + 60_000)).toBe(true)
})
it('truncates long lists explicitly and reduces arbitrary user agents to fixed labels', async () => {
  await runtime.db.batch(
    Array.from({ length: 52 }, (_, i) =>
      runtime.db
        .prepare(
          'INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(`many-${i}`, `fixture-many-${i}`, 'a', Date.now() + 60_000, Date.now(), Date.now()),
    ),
  )
  const data = await (
    await accountSecurity(request())
  ).json<{
    sessions: { current: boolean }[]
    hasMore: boolean
  }>()
  expect(data.hasMore).toBe(true)
  expect(data.sessions).toHaveLength(50)
  expect(data.sessions[0]!.current).toBe(true)
  expect(sessionDevice('<script>untrusted-agent</script>')).toEqual({
    browser: 'unknown',
    platform: 'unknown',
  })
  expect(sessionDevice('Android Chrome/123 EdgA/123')).toEqual({
    browser: 'edge',
    platform: 'android',
  })
})
