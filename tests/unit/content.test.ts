import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import { handleApi } from '../../src/server/api.server'
import { publicEntry } from '../../src/modules/content/content.server'
import { accountLifecycle } from '../../src/modules/auth/lifecycle.server'
import {
  contentLimits,
  type ContentRecord,
  type ContentInput,
} from '../../src/modules/content/policy'
const mocks = vi.hoisted(() => ({
  userId: 'a',
  requireUser: vi.fn(),
  getSession: vi.fn(),
  verifyPassword: vi.fn(),
  signOut: vi.fn(),
  features: {},
}))
vi.mock('@/config/features', () => ({ features: mocks.features }))
vi.mock('@/modules/auth/auth.server', async (original) => {
  const actual = await original<typeof import('../../src/modules/auth/auth.server')>()
  return { ...actual, requireUser: mocks.requireUser, createAuth: () => ({ api: mocks }) }
})
let runtime: Awaited<ReturnType<typeof testDatabase>>
let store: Pick<
  NonNullable<Awaited<ReturnType<typeof testDatabase>>['bucket']>,
  'put' | 'get' | 'head' | 'delete'
>
const origin = 'http://127.0.0.1:3100',
  png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const draft = (extra: Partial<ContentInput> = {}): ContentInput => ({
  title: 'First article',
  slug: 'first-article',
  locale: 'en',
  kind: 'article',
  category: 'Guides',
  summary: 'A summary',
  body: 'First body',
  seoTitle: 'Search title',
  seoDescription: 'Search summary',
  coverAssetId: null,
  ...extra,
})
function req(path = '', method = 'GET', data?: unknown) {
  return new Request(origin + '/api/admin/content' + path, {
    method,
    headers: {
      origin,
      'content-type': data instanceof Uint8Array ? 'image/png' : 'application/json',
      'x-file-name': 'asset.png',
    },
    ...(data === undefined
      ? {}
      : { body: data instanceof Uint8Array ? new Uint8Array(data).buffer : JSON.stringify(data) }),
  })
}
const api = (path = '', method = 'GET', data?: unknown) => handleApi(req(path, method, data))
async function entries() {
  return (await (await api()).json<{ records: ContentRecord[] }>()).records
}
async function create(extra: Partial<ContentInput> = {}) {
  const r = await api('', 'POST', draft(extra))
  expect(r.status, await r.clone().text()).toBe(201)
  return (await r.json<{ id: string }>()).id
}
async function asset() {
  const r = await api('/assets', 'POST', png)
  expect(r.status, await r.clone().text()).toBe(201)
  return (await r.json<{ id: string }>()).id
}
async function publish(id: string) {
  const row = (await entries()).find((r) => r.id === id)!
  const r = await api('/' + id + '/publish', 'POST', { revision: row.revision })
  expect(r.status, await r.clone().text()).toBe(200)
}
beforeAll(async () => {
  runtime = await testDatabase({ files: true })
})
afterAll(async () => runtime.dispose())
afterEach(() => vi.restoreAllMocks())
beforeEach(async () => {
  Object.assign(mocks.features, { ...featurePreset('web-app'), files: true, content: true })
  mocks.userId = 'a'
  mocks.requireUser
    .mockReset()
    .mockImplementation(() => ({ id: mocks.userId, emailVerified: true }))
  mocks.getSession.mockResolvedValue({
    user: { id: 'a', emailVerified: true },
    session: { id: 's' },
  })
  mocks.verifyPassword.mockResolvedValue(new Response('{}'))
  mocks.signOut.mockResolvedValue(new Response('{}'))
  store = {
    put: runtime.bucket!.put.bind(runtime.bucket!),
    get: runtime.bucket!.get.bind(runtime.bucket!),
    head: runtime.bucket!.head.bind(runtime.bucket!),
    delete: runtime.bucket!.delete.bind(runtime.bucket!),
  }
  Object.assign(env, {
    DB: runtime.db,
    ASSETS_BUCKET: store,
    ENVIRONMENT: 'local',
    APP_ORIGIN: origin,
    MAIL_MODE: 'local',
    BILLING_ENABLED: 'false',
  })
  await runtime.db.batch(
    [
      'content_entry',
      'content_asset',
      'file_asset',
      'project',
      'billing_account_state',
      'api_rate_limit',
      'account',
      'session',
      'admin_user',
      'user',
    ].map((table) => runtime.db.prepare('DELETE FROM ' + table)),
  )
  const objects = await runtime.bucket!.list()
  if (objects.objects.length) await runtime.bucket!.delete(objects.objects.map((o) => o.key))
  for (const id of ['a', 'b', 'c'])
    await runtime.db
      .prepare(
        'INSERT INTO user(id,name,email,email_verified,created_at,updated_at)VALUES(?,?,?,1,1,1)',
      )
      .bind(id, id, id + '@example.test')
      .run()
  for (const id of ['a', 'c'])
    await runtime.db.prepare('INSERT INTO admin_user(user_id)VALUES(?)').bind(id).run()
  await runtime.db
    .prepare(
      "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at)VALUES('s','private-fixture','a',?, ?, ?)",
    )
    .bind(Date.now() + 60000, Date.now(), Date.now())
    .run()
  await runtime.db
    .prepare(
      "INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at)VALUES('cred','a','credential','a','private-password',1,1)",
    )
    .run()
})
it('requires admin membership, rejects cross-origin mutations and closes disabled routes', async () => {
  mocks.userId = 'b'
  expect((await api()).status).toBe(403)
  expect((await api('', 'POST', draft())).status).toBe(403)
  mocks.userId = 'a'
  const bad = req('', 'POST', draft())
  bad.headers.set('origin', 'https://untrusted.test')
  expect((await handleApi(bad)).status).toBe(403)
  Object.assign(mocks.features, { content: false })
  expect((await api()).status).toBe(404)
  expect((await handleApi(new Request(origin + '/api/content'))).status).toBe(404)
})
it('keeps draft and live snapshots separate, guards revisions, and withdraws old paths', async () => {
  const id = await create()
  expect(await publicEntry('en', 'first-article')).toBeNull()
  await publish(id)
  expect(await publicEntry('en', 'first-article')).toMatchObject({ body: 'First body' })
  let row = (await entries())[0]!
  expect(
    (
      await api('/' + id, 'PATCH', {
        revision: row.revision,
        draft: draft({ slug: 'second-article', body: 'Second body' }),
      })
    ).status,
  ).toBe(200)
  expect(await publicEntry('en', 'first-article')).toMatchObject({ body: 'First body' })
  expect(await publicEntry('en', 'second-article')).toBeNull()
  expect((await api('/' + id, 'PATCH', { revision: row.revision, draft: draft() })).status).toBe(
    409,
  )
  await publish(id)
  expect(await publicEntry('en', 'first-article')).toBeNull()
  expect(await publicEntry('en', 'second-article')).toMatchObject({ body: 'Second body' })
  row = (await entries())[0]!
  expect((await api('/' + id + '/withdraw', 'POST', { revision: row.revision })).status).toBe(200)
  expect(await publicEntry('en', 'second-article')).toBeNull()
})
it('public images require current publication references and private-library IDs cannot be published', async () => {
  const id = await asset(),
    entry = await create({ coverAssetId: id })
  const url = origin + '/api/content/assets/' + id
  expect((await handleApi(new Request(url))).status).toBe(404)
  expect((await api('/assets/' + id + '/content')).status).toBe(200)
  await publish(entry)
  const response = await handleApi(new Request(url))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  expect((await api('/assets/' + id, 'DELETE')).status).toBe(409)
  await runtime.db
    .prepare(
      "INSERT INTO file_asset(id,user_id,object_key,name,content_type,size,state,created_at) VALUES(?,'a','private/key','private.png','image/png',8,'ready',1)",
    )
    .bind(crypto.randomUUID())
    .run()
  const own = await runtime.db.prepare('SELECT id FROM file_asset').first<{ id: string }>()
  expect((await api('', 'POST', draft({ coverAssetId: own!.id }))).status).toBe(409)
  const row = (await entries())[0]!
  expect((await api('/' + entry + '/withdraw', 'POST', { revision: row.revision })).status).toBe(
    200,
  )
  expect((await handleApi(new Request(url))).status).toBe(404)
})
it('resolves concurrent published path conflicts atomically and scopes paths by locale', async () => {
  const one = await create(),
    two = await create()
  await publish(one)
  const row = (await entries()).find((r) => r.id === two)!
  expect((await api('/' + two + '/publish', 'POST', { revision: row.revision })).status).toBe(409)
  const third = await create({ locale: 'zh' })
  await publish(third)
  expect(await publicEntry('zh', 'first-article')).not.toBeNull()
  expect((await entries()).find((r) => r.id === two)!.live).toBeNull()
})
it('retains ambiguous uploads and failed deletion records, rejecting missing or referenced cleanup', async () => {
  const original = store.put
  vi.spyOn(store, 'put').mockImplementation(async (...args) => {
    await original(...args)
    throw new Error('Ambiguous storage')
  })
  expect((await api('/assets', 'POST', png)).status).toBe(503)
  let rows = await (await api('/assets')).json<{ assets: { id: string; state: string }[] }>()
  const id = rows.assets[0]!.id
  expect(rows.assets[0]!.state).toBe('pending')
  expect((await api('/assets/' + id + '/reconcile', 'POST')).status).toBe(200)
  vi.spyOn(store, 'delete').mockRejectedValue(new Error('Storage unavailable'))
  expect((await api('/assets/' + id, 'DELETE')).status).toBe(503)
  rows = await (await api('/assets')).json()
  expect(rows.assets[0]!.state).toBe('deleting')
  vi.restoreAllMocks()
  expect((await api('/assets/' + id, 'DELETE')).status).toBe(200)
})
it('prevents lost publications and asset deletion when drafts or live snapshots still reference them', async () => {
  const a = await asset(),
    b = await asset(),
    id = await create({ coverAssetId: a })
  await publish(id)
  const row = (await entries())[0]!
  expect(
    (await api('/' + id, 'PATCH', { revision: row.revision, draft: draft({ coverAssetId: b }) }))
      .status,
  ).toBe(200)
  expect((await api('/assets/' + a, 'DELETE')).status).toBe(409)
  expect((await api('/assets/' + b, 'DELETE')).status).toBe(409)
  await publish(id)
  expect((await api('/assets/' + a, 'DELETE')).status).toBe(200)
  expect((await handleApi(new Request(origin + '/api/content/assets/' + a))).status).toBe(404)
})
it('bounds list pages and site quotas without exposing drafts or contributor IDs publicly', async () => {
  for (let i = 0; i < 14; i++) {
    const id = await create({ slug: 'entry-' + i, title: 'Article ' + i })
    await publish(id)
  }
  const result = await (await handleApi(new Request(origin + '/api/content?locale=en'))).text()
  const value = JSON.parse(result) as { items: unknown[]; total: number }
  expect(value.items).toHaveLength(12)
  expect(value.total).toBe(14)
  expect(result).not.toMatch(/created_by|updated_by|object_key|First body|private-password/)
  expect((await entries()).length).toBe(12)
  await runtime.db
    .prepare(
      "INSERT INTO content_asset(id,object_key,name,content_type,size,state,created_at)VALUES(?,?,?,?,?,'pending',1)",
    )
    .bind(
      crypto.randomUUID(),
      'missing/object',
      'missing.png',
      'image/png',
      contentLimits.totalBytes,
    )
    .run()
  expect((await api('/assets', 'POST', png)).status).toBe(409)
})
it('retains site-owned content on confirmed contributor deletion and nulls actor references', async () => {
  const cover = await asset(),
    id = await create({ coverAssetId: cover })
  await publish(id)
  const deletion = (retainSiteContent?: boolean) =>
    new Request(origin + '/api/account/delete', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmation: 'DELETE',
        currentPassword: 'fixture',
        retainSiteContent,
      }),
    })
  await expect(accountLifecycle(deletion())).rejects.toMatchObject({ status: 409 })
  expect((await accountLifecycle(deletion(true))).status).toBe(200)
  expect(await publicEntry('en', 'first-article')).not.toBeNull()
  expect(
    await runtime.db
      .prepare('SELECT created_by,updated_by FROM content_entry WHERE id=?')
      .bind(id)
      .first(),
  ).toEqual({ created_by: null, updated_by: null })
  expect(
    await runtime.db
      .prepare('SELECT uploaded_by FROM content_asset WHERE id=?')
      .bind(cover)
      .first(),
  ).toEqual({ uploaded_by: null })
  expect((await runtime.bucket!.list()).objects).toHaveLength(1)
  mocks.userId = 'c'
  expect((await api()).status).toBe(200)
})

it('rejects simultaneous draft updates using the same revision', async () => {
  const id = await create()
  const responses = await Promise.all(
    ['Version A', 'Version B'].map((title) =>
      api('/' + id, 'PATCH', { revision: 1, draft: draft({ title }) }),
    ),
  )
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
  const row = (await entries())[0]!
  expect(row.revision).toBe(2)
  expect(['Version A', 'Version B']).toContain(row.draft.title)
  await publish(id)
  expect((await publicEntry('en', 'first-article'))!.title).toBe(row.draft.title)
})
it('fences a revoked uploader and lets another administrator reconcile the known object', async () => {
  const original = store.put
  vi.spyOn(store, 'put').mockImplementation(async (...args) => {
    const result = await original(...args)
    await runtime.db.prepare("DELETE FROM admin_user WHERE user_id='a'").run()
    return result
  })
  expect((await api('/assets', 'POST', png)).status).toBe(503)
  expect((await api('/assets')).status).toBe(403)
  mocks.userId = 'c'
  const value = await (await api('/assets')).json<{ assets: { id: string; state: string }[] }>()
  expect(value.assets[0]!.state).toBe('pending')
  expect((await api('/assets/' + value.assets[0]!.id + '/reconcile', 'POST')).status).toBe(200)
  expect(
    (await handleApi(new Request(origin + '/api/content/assets/' + value.assets[0]!.id))).status,
  ).toBe(404)
})
