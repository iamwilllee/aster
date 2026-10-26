import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { handleFiles, cleanAccountFiles } from '../../src/modules/files/files.server'
import { acquireBillingLock, releaseBillingLock } from '../../src/modules/billing/deletion.server'
import { accountLifecycle } from '../../src/modules/auth/lifecycle.server'
import { fileLimits } from '../../src/modules/files/policy'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), verifyPassword: vi.fn(), signOut: vi.fn() }))
vi.mock('@/modules/auth/auth.server', () => ({ createAuth: () => ({ api: mocks }) }))
vi.mock('@/config/features', async () => ({
  features: {
    ...(await import('../../src/config/feature-policy.mjs')).featurePreset('web-app'),
    files: true,
  },
}))
let runtime: Awaited<ReturnType<typeof testDatabase>>
let store: Pick<
  NonNullable<Awaited<ReturnType<typeof testDatabase>>['bucket']>,
  'put' | 'get' | 'head' | 'delete'
>
const origin = 'http://127.0.0.1:3100',
  png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
const request = (
  path = '',
  method = 'GET',
  data?: Uint8Array | string,
  headers: Record<string, string> = {},
) =>
  new Request(origin + '/api/files' + path, {
    method,
    headers: { origin, ...headers },
    ...(data === undefined
      ? {}
      : { body: typeof data === 'string' ? data : new Uint8Array(data).buffer }),
  })
const upload = () =>
  handleFiles(
    request('', 'POST', png, { 'content-type': 'image/png', 'x-file-name': 'fixture.png' }),
    'a',
  )
async function image() {
  const response = await upload()
  expect(response.status).toBe(201)
  return (await response.json<{ id: string }>()).id
}
beforeAll(async () => {
  runtime = await testDatabase({ files: true })
  store = {
    put: runtime.bucket!.put.bind(runtime.bucket!),
    get: runtime.bucket!.get.bind(runtime.bucket!),
    head: runtime.bucket!.head.bind(runtime.bucket!),
    delete: runtime.bucket!.delete.bind(runtime.bucket!),
  }
  Object.assign(env, { DB: runtime.db, ASSETS_BUCKET: store })
})
afterAll(async () => runtime?.dispose())
afterEach(() => vi.restoreAllMocks())
beforeEach(async () => {
  store = {
    put: runtime.bucket!.put.bind(runtime.bucket!),
    get: runtime.bucket!.get.bind(runtime.bucket!),
    head: runtime.bucket!.head.bind(runtime.bucket!),
    delete: runtime.bucket!.delete.bind(runtime.bucket!),
  }
  Object.assign(env, { DB: runtime.db, ASSETS_BUCKET: store })
  mocks.getSession
    .mockReset()
    .mockResolvedValue({ user: { id: 'a', emailVerified: true }, session: { id: 'session-a' } })
  mocks.verifyPassword.mockReset().mockResolvedValue(new Response('{}'))
  mocks.signOut.mockReset().mockResolvedValue(new Response('{}'))
  const objects = await runtime.bucket!.list()
  if (objects.objects.length) await runtime.bucket!.delete(objects.objects.map((item) => item.key))
  await runtime.db.batch([
    ...['file_asset', 'project', 'billing_account_state', 'api_rate_limit', 'user'].map((table) =>
      runtime.db.prepare('DELETE FROM ' + table),
    ),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,1,1)',
        )
        .bind(id, id, id + '@example.test'),
    ),
    runtime.db
      .prepare(
        "INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES ('session-a','private-session','a',?,?,?)",
      )
      .bind(Date.now() + 600000, Date.now(), Date.now()),
    runtime.db.prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('cred-a','a','credential','a','private-password',1,1)",
    ),
  ])
})
it('persists real local R2 bytes, returns only an owner-scoped DTO and serves private streams', async () => {
  const id = await image(),
    res = await handleFiles(request(), 'a'),
    data = await res.json<{ files: { id: string; state: string }[] }>()
  expect(data.files).toHaveLength(1)
  expect(data.files[0]).toMatchObject({ id, state: 'ready' })
  expect(JSON.stringify(data)).not.toMatch(/object_key|user_id|private-session|private\//)
  expect(await (await handleFiles(request(), 'b')).json()).toMatchObject({ files: [] })
  await expect(handleFiles(request('/' + id + '/content'), 'b')).rejects.toMatchObject({
    status: 404,
  })
  const content = await handleFiles(request('/' + id + '/content'), 'a')
  expect(content.headers.get('cache-control')).toBe('private, no-store')
  expect(content.headers.get('x-content-type-options')).toBe('nosniff')
  expect(new Uint8Array(await content.arrayBuffer())).toEqual(png)
})
it('validates size, type signatures and names before creating a storage obligation', async () => {
  for (const [bytes, type, name] of [
    [png, 'image/svg+xml', 'bad.svg'],
    [new TextEncoder().encode('<svg/>'), 'image/png', 'bad.png'],
    [png, 'image/png', '..%2Fsecret.png'],
  ] as const)
    await expect(
      handleFiles(request('', 'POST', bytes, { 'content-type': type, 'x-file-name': name }), 'a'),
    ).rejects.toMatchObject({ status: 400 })
  await expect(
    handleFiles(
      request('', 'POST', new Uint8Array(fileLimits.maxFileBytes + 1), {
        'content-type': 'image/png',
        'x-file-name': 'large.png',
      }),
      'a',
    ),
  ).rejects.toMatchObject({ status: 413 })
  expect(await runtime.db.prepare('SELECT COUNT(*) AS count FROM file_asset').first()).toEqual({
    count: 0,
  })
})
it('reserves count and bytes in an atomic statement under concurrent uploads', async () => {
  const outcomes = await Promise.allSettled(
    Array.from({ length: fileLimits.maxFiles + 3 }, () => upload()),
  )
  expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(fileLimits.maxFiles)
  expect(
    await runtime.db.prepare("SELECT COUNT(*) AS count FROM file_asset WHERE user_id='a'").first(),
  ).toEqual({ count: fileLimits.maxFiles })
  await runtime.db
    .prepare('UPDATE file_asset SET size=? WHERE id=(SELECT id FROM file_asset LIMIT 1)')
    .bind(fileLimits.maxTotalBytes)
    .run()
  await runtime.db
    .prepare('DELETE FROM file_asset WHERE id NOT IN (SELECT id FROM file_asset LIMIT 1)')
    .run()
  await expect(upload()).rejects.toMatchObject({ status: 409 })
})
it('keeps ambiguous uploads pending and recovers only a positive matching storage head', async () => {
  const original = runtime.bucket!.put.bind(runtime.bucket!)
  vi.spyOn(store, 'put').mockImplementation(async (...args) => {
    await original(...args)
    throw new Error('Ambiguous write')
  })
  await expect(upload()).rejects.toMatchObject({ status: 503 })
  const row = await runtime.db
    .prepare('SELECT id,state FROM file_asset')
    .first<{ id: string; state: string }>()
  expect(row!.state).toBe('pending')
  await expect(handleFiles(request('/' + row!.id + '/content'), 'a')).rejects.toMatchObject({
    status: 404,
  })
  expect((await handleFiles(request('/' + row!.id + '/reconcile', 'POST'), 'a')).status).toBe(200)
  expect(await runtime.db.prepare('SELECT state FROM file_asset').first()).toEqual({
    state: 'ready',
  })
})
it('missing pending objects and unavailable storage block account deletion without dropping reservations', async () => {
  vi.spyOn(store, 'put').mockRejectedValue(new Error('Unknown write'))
  await expect(upload()).rejects.toMatchObject({ status: 503 })
  const id = (await runtime.db.prepare('SELECT id FROM file_asset').first<{ id: string }>())!.id
  await expect(handleFiles(request('/' + id + '/reconcile', 'POST'), 'a')).rejects.toMatchObject({
    status: 409,
  })
  const lock = await acquireBillingLock('a')
  try {
    await expect(cleanAccountFiles(lock)).rejects.toMatchObject({ status: 409 })
  } finally {
    await releaseBillingLock(lock)
  }
  expect(await runtime.db.prepare('SELECT state FROM file_asset').first()).toEqual({
    state: 'pending',
  })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeTruthy()
})
it('prevents foreign references and deletion of an image currently used as an avatar', async () => {
  const id = await image()
  await expect(
    handleFiles(
      request('/avatar', 'POST', JSON.stringify({ assetId: id }), {
        'content-type': 'application/json',
      }),
      'b',
    ),
  ).rejects.toMatchObject({ status: 409 })
  expect(
    (
      await handleFiles(
        request('/avatar', 'POST', JSON.stringify({ assetId: id }), {
          'content-type': 'application/json',
        }),
        'a',
      )
    ).status,
  ).toBe(200)
  await expect(handleFiles(request('/' + id, 'DELETE'), 'a')).rejects.toMatchObject({ status: 409 })
  await handleFiles(
    request('/avatar', 'POST', JSON.stringify({ assetId: null }), {
      'content-type': 'application/json',
    }),
    'a',
  )
  expect((await handleFiles(request('/' + id, 'DELETE'), 'a')).status).toBe(200)
  expect((await runtime.bucket!.list()).objects).toHaveLength(0)
})
it('retains a retriable deleting row after cleanup fails and closes new uploads while a lease is held', async () => {
  const id = await image(),
    lock = await acquireBillingLock('a')
  await expect(upload()).rejects.toMatchObject({ status: 409 })
  await expect(handleFiles(request('/' + id, 'DELETE'), 'a')).rejects.toMatchObject({ status: 409 })
  await releaseBillingLock(lock)
  const failed = vi.spyOn(store, 'delete').mockRejectedValue(new Error('Unavailable'))
  await expect(handleFiles(request('/' + id, 'DELETE'), 'a')).rejects.toMatchObject({ status: 503 })
  expect(await runtime.db.prepare('SELECT state FROM file_asset').first()).toEqual({
    state: 'deleting',
  })
  failed.mockRestore()
  await handleFiles(request('/' + id, 'DELETE'), 'a')
  expect(await runtime.db.prepare('SELECT id FROM file_asset').first()).toBeNull()
})
it('exports metadata, cleans known objects and detaches cover references before deleting the user', async () => {
  const id = await image()
  await runtime.db
    .prepare(
      "INSERT INTO project (id,user_id,name,description,status,created_at,updated_at,cover_asset_id) VALUES ('p','a','Owned','','idea',1,1,?)",
    )
    .bind(id)
    .run()
  const exported = await accountLifecycle(
      new Request(origin + '/api/account/export', { method: 'POST', headers: { origin } }),
    ),
    text = await exported.text()
  expect(JSON.parse(text)).toMatchObject({
    files: [{ id, name: 'fixture.png' }],
    projects: [{ coverAssetId: id }],
  })
  expect(text).not.toMatch(/object_key|private-session|private-password/)
  const response = await accountLifecycle(
    new Request(origin + '/api/account/delete', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE', currentPassword: 'fixture' }),
    }),
  )
  expect(response.status).toBe(200)
  expect((await runtime.bucket!.list()).objects).toHaveLength(0)
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeNull()
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='b'").first()).toBeTruthy()
})
it('retains the account if storage deletion fails and can resume the authorized deletion', async () => {
  await image()
  const fail = vi.spyOn(store, 'delete').mockRejectedValue(new Error('Unavailable'))
  const requestDelete = () =>
    new Request(origin + '/api/account/delete', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE', currentPassword: 'fixture' }),
    })
  await expect(accountLifecycle(requestDelete())).rejects.toMatchObject({ status: 503 })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeTruthy()
  expect(await runtime.db.prepare('SELECT state FROM file_asset').first()).toEqual({
    state: 'deleting',
  })
  fail.mockRestore()
  expect((await accountLifecycle(requestDelete())).status).toBe(200)
})
