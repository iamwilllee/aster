import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import {
  assertAccountEnabled,
  assertAdministratorDeletion,
} from '../../src/modules/admin/access.server'
import { handleApi } from '../../src/server/api.server'
import { handleAdmin } from '../../src/modules/admin/admin.server'
import { createAuth } from '../../src/modules/auth/auth.server'
const mocks = vi.hoisted(() => ({ actor: 'a', features: {} }))
vi.mock('@/config/features', () => ({ features: mocks.features }))
vi.mock('@/modules/auth/auth.server', async (original) => {
  const actual = await original<typeof import('../../src/modules/auth/auth.server')>()
  return {
    ...actual,
    requireUser: async () => {
      await assertAccountEnabled(mocks.actor)
      return { id: mocks.actor, emailVerified: true }
    },
  }
})
let runtime: Awaited<ReturnType<typeof testDatabase>>
const origin = 'http://127.0.0.1:3100'
const request = (path = '/users', method = 'GET', data?: unknown) =>
  new Request(origin + '/api/admin' + path, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
const api = (path = '/users', method = 'GET', data?: unknown) =>
  handleApi(request(path, method, data))
const access = (id: string, disabled = true, revision = 0) =>
  api('/users/' + id + '/access', 'POST', { revision, disabled, reason: 'support' })
beforeAll(async () => {
  runtime = await testDatabase()
})
afterAll(async () => runtime.dispose())
afterEach(() => vi.restoreAllMocks())
beforeEach(async () => {
  mocks.actor = 'a'
  Object.assign(mocks.features, featurePreset('web-app'))
  Object.assign(env, {
    DB: runtime.db,
    APP_ORIGIN: origin,
    ENVIRONMENT: 'local',
    MAIL_MODE: 'local',
    BETTER_AUTH_SECRET: 'isolated-auth-fixture-secret-at-least-32-chars',
  })
  await runtime.db.batch(
    [
      'project',
      'content_entry',
      'content_asset',
      'file_asset',
      'billing_account_state',
      'api_rate_limit',
      'subscription',
      'checkout',
      'account_access',
      'admin_user',
      'session',
      'account',
      'user',
      'admin_audit',
    ].map((t) => runtime.db.prepare('DELETE FROM ' + t)),
  )
  for (const id of ['a', 'b', 'c'])
    await runtime.db
      .prepare(
        'INSERT INTO user(id,name,email,email_verified,created_at,updated_at)VALUES(?,?,?,1,1,1)',
      )
      .bind(id, 'User ' + id, id + '@example.test')
      .run()
  for (const id of ['a', 'c'])
    await runtime.db.prepare('INSERT INTO admin_user(user_id)VALUES(?)').bind(id).run()
  for (const id of ['b1', 'b2'])
    await runtime.db
      .prepare(
        "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at)VALUES(?,?,'b',?,1,1)",
      )
      .bind(id, 'never-expose-' + id, Date.now() + 60000)
      .run()
  await runtime.db
    .prepare(
      "INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at)VALUES('credential','b','credential','b','never-expose-password',1,1)",
    )
    .run()
})
it('denies members, closes auth-off administration and rejects foreign origins and arbitrary reasons', async () => {
  mocks.actor = 'b'
  expect((await api()).status).toBe(403)
  expect((await api('/audit')).status).toBe(403)
  expect((await access('c')).status).toBe(403)
  mocks.actor = 'a'
  const foreign = request('/users/b/access', 'POST', {
    revision: 0,
    disabled: true,
    reason: 'support',
  })
  foreign.headers.set('origin', 'https://untrusted.example')
  expect((await handleApi(foreign)).status).toBe(403)
  expect(
    (await api('/users/b/access', 'POST', { revision: 0, disabled: true, reason: 'secret text' }))
      .status,
  ).toBe(400)
  Object.assign(mocks.features, { auth: false })
  expect((await api()).status).toBe(404)
})
it('paginates safe metadata and counts without leaking credentials or private business content', async () => {
  for (let i = 0; i < 23; i++)
    await runtime.db
      .prepare(
        'INSERT INTO user(id,name,email,email_verified,created_at,updated_at)VALUES(?,?,?,1,1,1)',
      )
      .bind('extra-' + i, 'Extra ' + i, 'extra-' + i + '@example.test')
      .run()
  const list = await (await api()).json<{ users: unknown[]; total: number }>()
  expect(list.users).toHaveLength(20)
  expect(list.total).toBe(26)
  expect((await (await api('/users?page=2')).json<{ users: unknown[] }>()).users).toHaveLength(6)
  const detail = await (await api('/users/b')).text()
  expect(detail).not.toMatch(/never-expose|password_hash|customer_id|token|ip_address/)
  expect(JSON.parse(detail)).toMatchObject({
    user: { id: 'b', admin: false },
    counts: { sessions: 2 },
    loginMethods: ['password'],
  })
})
it('revokes all sessions, fences credential/session writes and restores access without reviving tokens or deleting data', async () => {
  await runtime.db
    .prepare(
      "INSERT INTO project(id,user_id,name,description,status,created_at,updated_at)VALUES('p','b','Private work','Private body','idea',1,1)",
    )
    .run()
  await runtime.db
    .prepare(
      "INSERT INTO checkout(id,user_id,status,created_at)VALUES('existing-checkout','b','unknown',1)",
    )
    .run()
  expect((await access('b')).status).toBe(200)
  expect(await runtime.db.prepare("SELECT id FROM session WHERE user_id='b'").first()).toBeNull()
  await expect(
    runtime.db
      .prepare(
        "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at)VALUES('new','new','b',9999999999999,1,1)",
      )
      .run(),
  ).rejects.toThrow('account disabled')
  await expect(
    runtime.db.prepare("UPDATE account SET password='replacement' WHERE user_id='b'").run(),
  ).rejects.toThrow('account disabled')
  await expect(
    runtime.db.prepare("UPDATE user SET name='replacement' WHERE id='b'").run(),
  ).rejects.toThrow('account disabled')
  const hook = createAuth(new Request(origin)).options.databaseHooks?.session?.create?.before
  await expect(
    hook?.({
      id: 'google-session',
      userId: 'b',
      token: 'not-a-real-token',
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    }),
  ).rejects.toThrow()
  mocks.actor = 'b'
  expect((await api()).status).toBe(401)
  mocks.actor = 'a'
  expect((await access('b', false, 1)).status).toBe(200)
  expect(await runtime.db.prepare("SELECT id FROM session WHERE user_id='b'").first()).toBeNull()
  expect(await runtime.db.prepare("SELECT name FROM project WHERE id='p'").first()).toEqual({
    name: 'Private work',
  })
  expect(
    await runtime.db.prepare("SELECT status FROM checkout WHERE id='existing-checkout'").first(),
  ).toEqual({ status: 'unknown' })
  await runtime.db
    .prepare(
      "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at)VALUES('fresh','fresh','b',9999999999999,1,1)",
    )
    .run()
})
it('rejects self-disable, stale/no-op changes and simultaneous operations using the same revision', async () => {
  expect((await access('a')).status).toBe(409)
  const r = await Promise.all([access('b'), access('b')])
  expect(r.map((x) => x.status).sort()).toEqual([200, 409])
  expect((await access('b', false, 0)).status).toBe(409)
  expect((await access('b', true, 1)).status).toBe(409)
  expect(
    (
      await runtime.db
        .prepare("SELECT COUNT(*) AS total FROM admin_audit WHERE action='user.disable'")
        .first()
    )?.total,
  ).toBe(1)
})
it('keeps an active administrator when two operators try to suspend each other concurrently', async () => {
  const data = { revision: 0, disabled: true, reason: 'security' }
  const r = await Promise.allSettled([
    handleAdmin(request('/users/c/access', 'POST', data), 'a'),
    handleAdmin(request('/users/a/access', 'POST', data), 'c'),
  ])
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
  const disabled = await runtime.db
    .prepare('SELECT COUNT(*) AS total FROM account_access WHERE disabled_at IS NOT NULL')
    .first<{ total: number }>()
  expect(disabled?.total).toBe(1)
  const survivor = await runtime.db
    .prepare(
      'SELECT admin_user.user_id AS id FROM admin_user LEFT JOIN account_access ON account_access.user_id=admin_user.user_id WHERE account_access.disabled_at IS NULL',
    )
    .first<{ id: string }>()
  await expect(assertAdministratorDeletion(survivor!.id)).rejects.toMatchObject({ status: 409 })
})
it('rolls back state and session removal when recording the operation fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await runtime.db
    .prepare(
      "CREATE TRIGGER fail_web_audit BEFORE INSERT ON admin_audit WHEN NEW.source='web' BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END",
    )
    .run()
  try {
    expect((await access('b')).status).toBe(500)
    expect(
      await runtime.db.prepare("SELECT * FROM account_access WHERE user_id='b'").first(),
    ).toBeNull()
    expect(
      (await runtime.db.prepare("SELECT COUNT(*) AS total FROM session WHERE user_id='b'").first())
        ?.total,
    ).toBe(2)
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/never-expose|fixture audit failure/)
  } finally {
    await runtime.db.prepare('DROP TRIGGER fail_web_audit').run()
  }
})
it('retains minimal records with nulled identities on user deletion and records SQL role changes without an invented actor', async () => {
  await access('b')
  await access('b', false, 1)
  await runtime.db.prepare("DELETE FROM user WHERE id='b'").run()
  await runtime.db.prepare("DELETE FROM user WHERE id='a'").run()
  mocks.actor = 'c'
  const text = await (await api('/audit')).text()
  expect(text).not.toMatch(/b@example|a@example|never-expose/)
  const events = JSON.parse(text) as {
    events: { action: string; actor: unknown; target: unknown; source: string }[]
  }
  expect(events.events.find((e) => e.action === 'user.disable')).toMatchObject({
    actor: null,
    target: null,
    source: 'web',
  })
  expect(events.events.find((e) => e.action === 'admin.grant')).toMatchObject({
    actor: null,
    source: 'database',
  })
})

it('retains SDK error severity and categories while omitting original messages and credential parameters', async () => {
  const { authLog } = await import('../../src/modules/auth/logging.server')
  const error = vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  authLog('error', 'database query params=private-password;token=private-token', 'fixture-request')
  authLog('warn', 'Invalid password: private-password', 'fixture-request')
  expect(JSON.parse(String(error.mock.calls[0]![0]))).toMatchObject({
    event: 'auth_sdk',
    severity: 'error',
    category: 'storage',
    requestId: 'fixture-request',
  })
  expect(JSON.parse(String(warn.mock.calls[0]![0]))).toMatchObject({
    severity: 'warn',
    category: 'credentials',
  })
  expect(JSON.stringify([...error.mock.calls, ...warn.mock.calls])).not.toMatch(
    /private-password|private-token|params=/,
  )
})
