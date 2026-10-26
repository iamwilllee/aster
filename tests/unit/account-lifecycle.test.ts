import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import { accountLifecycle } from '../../src/modules/auth/lifecycle.server'
import { allowAccountAction } from '../../src/server/rate-limit.server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyPassword: vi.fn(),
  signOut: vi.fn(),
  features: {},
}))
vi.mock('@/config/features', () => ({ features: mocks.features }))
vi.mock('@/modules/auth/auth.server', () => ({ createAuth: () => ({ api: mocks }) }))
let runtime: Awaited<ReturnType<typeof testDatabase>>
const origin = 'http://127.0.0.1:3100'
function request(path = '/lifecycle', method = 'GET', data?: unknown) {
  return new Request(origin + '/api/account' + path, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
}
const deleteRequest = (extra = {}) =>
  request('/delete', 'POST', {
    confirmation: 'DELETE',
    currentPassword: 'fixture-only-password',
    ...extra,
  })
beforeAll(async () => {
  runtime = await testDatabase()
  Object.assign(env, { DB: runtime.db })
})
afterAll(async () => runtime?.dispose())
beforeEach(async () => {
  Object.assign(mocks.features, featurePreset('web-app'))
  mocks.getSession
    .mockReset()
    .mockResolvedValue({ user: { id: 'a', emailVerified: true }, session: { id: 'current-a' } })
  mocks.verifyPassword
    .mockReset()
    .mockImplementation(() => Promise.resolve(Response.json({ status: true })))
  mocks.signOut
    .mockReset()
    .mockImplementation(() =>
      Promise.resolve(
        new Response('{}', { headers: { 'set-cookie': 'fixture=; Max-Age=0; HttpOnly; Path=/' } }),
      ),
    )
  await runtime.db.batch([
    ...[
      'checkout',
      'subscription',
      'billing_subscription_archive',
      'billing_checkout_archive',
      'billing_account_state',
      'user',
      'verification',
      'dev_mail',
      'api_rate_limit',
    ].map((table) => runtime.db.prepare(`DELETE FROM ${table}`)),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)',
        )
        .bind(id, id, `${id}@example.test`, Date.now(), Date.now()),
    ),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(
          `current-${id}`,
          `fixture-secret-${id}`,
          id,
          Date.now() + 60_000,
          Date.now(),
          Date.now(),
        ),
    ),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?,'credential',?,'private-hash',?,?)",
        )
        .bind(`credential-${id}`, id, id, Date.now(), Date.now()),
    ),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          "INSERT INTO project (id,user_id,name,description,status,created_at,updated_at) VALUES (?,?,?,'description','idea',1,2)",
        )
        .bind(`project-${id}`, id, `${id} project`),
    ),
  ])
})
it('exports a consistent owner whitelist, including disabled-module data but never authentication or provider credentials', async () => {
  await runtime.db
    .prepare(
      "INSERT INTO subscription (id,user_id,customer_id,status,price_id,sync_id,updated_at) VALUES ('private-sub','a','private-customer','canceled','private-price','private-sync',1)",
    )
    .run()
  Object.assign(mocks.features, { projects: false, billing: false })
  const response = await accountLifecycle(request('/export', 'POST'))
  const data = await response.json<Record<string, unknown>>()
  expect(response.headers.get('content-disposition')).toContain('attachment')
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(data).toMatchObject({
    version: 1,
    profile: { email: 'a@example.test' },
    projects: [{ id: 'project-a' }],
    billing: { subscriptions: [{ status: 'canceled' }] },
  })
  expect(Object.keys(data.profile as object).sort()).toEqual(
    ['name', 'email', 'image', 'createdAt'].sort(),
  )
  expect(JSON.stringify(data)).not.toMatch(
    /b@example|project-b|private-|fixture-secret|password|token|user_id/,
  )
})
it('physically deletes the owner and cascades all credentials, sessions, projects and admin access; unrelated rows survive', async () => {
  await runtime.db.batch([
    runtime.db.prepare("INSERT INTO admin_user (user_id) VALUES ('a'),('b')"),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO verification (id,identifier,value,expires_at,created_at,updated_at) VALUES (?,?,?,?,1,1)',
        )
        .bind(id, `reset-password:${id}`, id, Date.now() + 60_000),
    ),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          "INSERT INTO dev_mail (id,recipient,subject,url,created_at) VALUES (?,?,'fixture','private-token-url',1)",
        )
        .bind(id, `${id}@example.test`),
    ),
  ])
  const response = await accountLifecycle(deleteRequest())
  expect(await response.json()).toEqual({ ok: true })
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  for (const table of ['user', 'session', 'account', 'project', 'verification', 'dev_mail']) {
    const result = await runtime.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .first<{ count: number }>()
    expect(result?.count, table).toBe(1)
  }
  expect(await runtime.db.prepare("SELECT * FROM admin_user WHERE user_id='a'").first()).toBeNull()
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 401 })
})
it('requires exact confirmation, disallows target IDs, verifies password and preserves data on failure', async () => {
  await expect(accountLifecycle(deleteRequest({ confirmation: 'delete' }))).rejects.toMatchObject({
    status: 400,
  })
  await expect(accountLifecycle(deleteRequest({ userId: 'b' }))).rejects.toMatchObject({
    status: 400,
  })
  mocks.verifyPassword.mockImplementationOnce(() =>
    Promise.resolve(new Response('{}', { status: 400 })),
  )
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({
    status: 400,
    message: '当前密码不正确。',
  })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeTruthy()
})
it('stops deletion if the credential changes, session is revoked, or a checkout is inserted during password verification', async () => {
  mocks.verifyPassword.mockImplementationOnce(async () => {
    await runtime.db.prepare("UPDATE account SET password='changed' WHERE user_id='a'").run()
    return Response.json({ status: true })
  })
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 401 })
  mocks.verifyPassword.mockImplementationOnce(async () => {
    await runtime.db.prepare("DELETE FROM session WHERE id='current-a'").run()
    return Response.json({ status: true })
  })
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 401 })
  expect(await runtime.db.prepare("SELECT id FROM project WHERE user_id='a'").first()).toBeTruthy()
})
it('blocks every existing billing association even with billing disabled, without deleting global event history', async () => {
  Object.assign(mocks.features, { billing: false })
  await runtime.db
    .prepare(
      "INSERT INTO subscription (id,user_id,customer_id,status,price_id,sync_id,updated_at) VALUES ('sub','a','cus','canceled','price','sync',1)",
    )
    .run()
  expect(await (await accountLifecycle(request())).json()).toMatchObject({ billingBlocked: true })
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 409 })
  await runtime.db.prepare("DELETE FROM subscription WHERE user_id='a'").run()
  mocks.verifyPassword.mockImplementationOnce(async () => {
    await runtime.db
      .prepare(
        "INSERT INTO checkout (id,user_id,status,created_at) VALUES ('reserved','a','pending',1)",
      )
      .run()
    return Response.json({ status: true })
  })
  await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 409 })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeTruthy()
})
it('Google-only deletion requires a fresh database session, not a refreshed/claimed client timestamp or a password', async () => {
  Object.assign(mocks.features, { emailPassword: false, google: true })
  await runtime.db
    .prepare("UPDATE account SET provider_id='google',password=NULL WHERE user_id='a'")
    .run()
  await runtime.db
    .prepare("UPDATE session SET created_at=? WHERE id='current-a'")
    .bind(Date.now() - 600_000)
    .run()
  expect(await (await accountLifecycle(request())).json()).toMatchObject({
    verification: 'recent-login',
    recentLogin: false,
  })
  await expect(
    accountLifecycle(request('/delete', 'POST', { confirmation: 'DELETE' })),
  ).rejects.toMatchObject({ status: 401 })
  await runtime.db
    .prepare("UPDATE session SET created_at=? WHERE id='current-a'")
    .bind(Date.now())
    .run()
  expect(
    (await accountLifecycle(request('/delete', 'POST', { confirmation: 'DELETE' }))).status,
  ).toBe(200)
  expect(mocks.verifyPassword).not.toHaveBeenCalled()
})
it('auth-off/unauthenticated requests and GET deletion are closed', async () => {
  await expect(accountLifecycle(request('/delete'))).rejects.toMatchObject({ status: 404 })
  mocks.getSession.mockResolvedValueOnce(null)
  await expect(accountLifecycle(request())).rejects.toMatchObject({ status: 401 })
  Object.assign(mocks.features, { auth: false })
  mocks.getSession.mockClear()
  await expect(accountLifecycle(request())).rejects.toMatchObject({ status: 404 })
  expect(mocks.getSession).not.toHaveBeenCalled()
})
it('account action limits are atomic, user-specific, independent and reset next window', async () => {
  const now = 1_800_001_010_000
  expect(
    (
      await Promise.all(Array.from({ length: 8 }, () => allowAccountAction('a', 'export', now)))
    ).filter(Boolean),
  ).toHaveLength(3)
  expect(await allowAccountAction('b', 'export', now)).toBe(true)
  expect(await allowAccountAction('a', 'delete', now)).toBe(true)
  expect(await allowAccountAction('a', 'export', now + 60_000)).toBe(true)
})
it('never silently truncates oversized exports', async () => {
  await runtime.db.batch(
    Array.from({ length: 1001 }, (_, i) =>
      runtime.db
        .prepare(
          "INSERT INTO project (id,user_id,name,status,created_at,updated_at) VALUES (?,'a','fixture','idea',1,1)",
        )
        .bind(`many-${i}`),
    ),
  )
  await expect(accountLifecycle(request('/export', 'POST'))).rejects.toMatchObject({ status: 413 })
})

it('rolls back reset-token cleanup when deletion fails, and preserves unrelated global billing events', async () => {
  await runtime.db.batch([
    runtime.db.prepare(
      "INSERT INTO verification (id,identifier,value,expires_at,created_at,updated_at) VALUES ('rollback','reset-password:rollback','a',9999999999999,1,1)",
    ),
    runtime.db.prepare(
      "INSERT OR IGNORE INTO billing_event (id,type,processed_at) VALUES ('global-history','fixture',1)",
    ),
    runtime.db.prepare(
      "CREATE TRIGGER deny_fixture_deletion BEFORE DELETE ON user WHEN OLD.id='a' BEGIN SELECT RAISE(ABORT, 'fixture storage failure'); END",
    ),
  ])
  try {
    await expect(accountLifecycle(deleteRequest())).rejects.toThrow()
    expect(
      await runtime.db.prepare("SELECT id FROM verification WHERE id='rollback'").first(),
    ).toBeTruthy()
    expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeTruthy()
  } finally {
    await runtime.db.prepare('DROP TRIGGER deny_fixture_deletion').run()
  }
  mocks.signOut.mockRejectedValueOnce(new Error('fixture cookie failure'))
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect((await accountLifecycle(deleteRequest())).status).toBe(200)
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'account_cookie_clear_failed' }))
    expect(
      await runtime.db.prepare("SELECT id FROM billing_event WHERE id='global-history'").first(),
    ).toBeTruthy()
  } finally {
    log.mockRestore()
  }
})

it('blocks last-administrator deletion before private object cleanup', async () => {
  await runtime.db.prepare("INSERT INTO admin_user(user_id)VALUES('a')").run()
  const id = crypto.randomUUID()
  await runtime.db
    .prepare(
      "INSERT INTO file_asset(id,user_id,object_key,name,content_type,size,state,created_at)VALUES(?,'a','private/untouched','untouched.png','image/png',8,'ready',1)",
    )
    .bind(id)
    .run()
  try {
    await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({
      status: 409,
      message: '请先指定另一位有效管理员，再注销当前管理员账号。',
    })
    expect(
      await runtime.db.prepare('SELECT state FROM file_asset WHERE id=?').bind(id).first(),
    ).toEqual({ state: 'ready' })
  } finally {
    await runtime.db.prepare('DELETE FROM file_asset WHERE id=?').bind(id).run()
  }
})

it('rechecks the last active administrator inside the final deletion transaction', async () => {
  await runtime.db.prepare("INSERT INTO admin_user(user_id)VALUES('a'),('b')").run()
  const id = crypto.randomUUID()
  await runtime.db
    .prepare(
      "INSERT INTO file_asset(id,user_id,object_key,name,content_type,size,state,created_at)VALUES(?,'a','private/race','race.png','image/png',8,'ready',1)",
    )
    .bind(id)
    .run()
  Object.assign(env, {
    ASSETS_BUCKET: {
      put: () => Promise.resolve(undefined),
      get: () => Promise.resolve(null),
      head: () => Promise.resolve(null),
      delete: async () => {
        await runtime.db.prepare("DELETE FROM admin_user WHERE user_id='b'").run()
      },
    },
  })
  try {
    await expect(accountLifecycle(deleteRequest())).rejects.toMatchObject({ status: 401 })
    expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).not.toBeNull()
    expect(
      await runtime.db.prepare("SELECT user_id FROM admin_user WHERE user_id='a'").first(),
    ).not.toBeNull()
  } finally {
    Reflect.deleteProperty(env, 'ASSETS_BUCKET')
    await runtime.db.prepare('DELETE FROM file_asset WHERE id=?').bind(id).run()
  }
})
