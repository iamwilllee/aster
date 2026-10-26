import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import {
  checkout,
  getBilling,
  portal,
  webhook,
  billingStatus,
} from '../../src/modules/billing/billing.server'
import {
  reviewBilling,
  acquireBillingLock,
  releaseBillingLock,
} from '../../src/modules/billing/deletion.server'
import { accountLifecycle } from '../../src/modules/auth/lifecycle.server'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), verifyPassword: vi.fn(), signOut: vi.fn() }))
vi.mock('@/modules/auth/auth.server', () => ({ createAuth: () => ({ api: mocks }) }))
vi.mock('@/config/features', async () => ({
  features: (await import('../../src/config/feature-policy.mjs')).featurePreset('billing-test'),
}))
let runtime: Awaited<ReturnType<typeof testDatabase>>
let requestId = 'fixture-request',
  subStatus = 'active',
  checkoutState = 'pending',
  product = 'prod_fixture',
  badUrl = false,
  badOwner = false,
  mode = 'test',
  txStatus = 'paid'
let reads = 0
const origin = 'http://127.0.0.1:3100',
  secret = 'fixture-creem-webhook-secret'
const payloadSub = () => ({
  id: 'sub_fixture',
  mode,
  product,
  customer: 'cust_fixture',
  status: subStatus,
  current_period_end_date: new Date(Date.now() + 3600000).toISOString(),
  metadata: { userId: badOwner ? 'b' : 'a' },
  last_transaction: { status: txStatus },
})
const payloadCheckout = () => ({
  id: 'ch_fixture',
  mode,
  product,
  status: checkoutState,
  request_id: requestId,
  customer: 'cust_fixture',
  subscription: 'sub_fixture',
  order: { status: 'paid' },
  metadata: { userId: 'a' },
  checkout_url: badUrl
    ? 'https://attacker.example/steal'
    : 'https://www.creem.io/test/payment/fixture',
})
const list = (items: unknown[]) => ({
  items,
  pagination: { total_pages: 1, current_page: 1, next_page: null },
})
beforeAll(async () => {
  runtime = await testDatabase()
  Object.assign(env, { DB: runtime.db })
})
afterAll(async () => runtime?.dispose())
afterEach(() => vi.unstubAllGlobals())
beforeEach(async () => {
  requestId = 'fixture-request'
  subStatus = 'active'
  checkoutState = 'pending'
  product = 'prod_fixture'
  badUrl = false
  badOwner = false
  mode = 'test'
  txStatus = 'paid'
  reads = 0
  Object.assign(env, {
    DB: runtime.db,
    APP_ORIGIN: origin,
    BILLING_PROVIDER: 'creem',
    BILLING_ENABLED: 'true',
    CREEM_API_KEY: 'fixture-test-api-key',
    CREEM_WEBHOOK_SECRET: secret,
    CREEM_PRODUCT_ID: 'prod_fixture',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_PRICE_ID: 'price_fixture',
  })
  mocks.getSession
    .mockReset()
    .mockResolvedValue({ user: { id: 'a', emailVerified: true }, session: { id: 'session_a' } })
  mocks.verifyPassword.mockReset().mockImplementation(() => Promise.resolve(new Response('{}')))
  mocks.signOut.mockReset().mockImplementation(() => Promise.resolve(new Response('{}')))
  await runtime.db.batch([
    ...[
      'subscription',
      'checkout',
      'user',
      'billing_subscription_archive',
      'billing_checkout_archive',
      'billing_account_state',
      'billing_event',
      'api_rate_limit',
    ].map((table) => runtime.db.prepare(`DELETE FROM ${table}`)),
    ...['a', 'b'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,1,1)',
        )
        .bind(id, id, `${id}@example.test`),
    ),
    runtime.db
      .prepare(
        "INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES ('session_a','private-session','a',?,?,?)",
      )
      .bind(Date.now() + 600000, Date.now(), Date.now()),
    runtime.db.prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('account_a','a','credential','a','private-password-hash',1,1)",
    ),
  ])
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input)
    reads++
    if (url.origin !== 'https://test-api.creem.io')
      return Promise.reject(new Error('Unexpected external network'))
    expect(new Headers(init?.headers).get('x-api-key')).toBe('fixture-test-api-key')
    expect(init?.redirect).toBe('error')
    if (url.pathname === '/v1/checkouts' && init?.method === 'POST') {
      if (typeof init.body !== 'string') throw new Error('Expected JSON request body')
      const data = JSON.parse(init.body) as {
        request_id: string
        metadata: { userId: string }
        product_id: string
      }
      requestId = data.request_id
      expect(data.metadata).toEqual({ userId: 'a' })
      expect(data.product_id).toBe('prod_fixture')
      return Promise.resolve(Response.json(payloadCheckout()))
    }
    if (url.pathname === '/v1/checkouts') return Promise.resolve(Response.json(payloadCheckout()))
    if (url.pathname === '/v1/subscriptions') return Promise.resolve(Response.json(payloadSub()))
    if (url.pathname === '/v1/customers/billing') {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON request body')
      expect(JSON.parse(init.body)).toEqual({ customer_id: 'cust_fixture' })
      return Promise.resolve(
        Response.json({
          customer_portal_link: badUrl
            ? 'https://attacker.example/portal'
            : 'https://www.creem.io/test/customer/fixture',
        }),
      )
    }
    if (url.pathname === '/v1/subscriptions/search')
      return Promise.resolve(Response.json(list([payloadSub()])))
    if (url.pathname === '/v1/transactions/search')
      return Promise.resolve(
        Response.json(list([{ mode: 'test', customer: 'cust_fixture', status: txStatus }])),
      )
    return Promise.reject(new Error('Unexpected provider path'))
  })
})
async function event(type = 'checkout.completed', eventId = 'evt_fixture', eventMode = 'test') {
  const body = JSON.stringify({
    id: eventId,
    eventType: type,
    object: { id: type === 'checkout.completed' ? 'ch_fixture' : 'sub_fixture', mode: eventMode },
  })
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('')
  return new Request(origin + '/api/billing/webhook/creem', {
    method: 'POST',
    headers: { 'creem-signature': signature },
    body,
  })
}
async function pay() {
  await checkout('a', 'a@example.test')
  checkoutState = 'completed'
  await webhook(await event())
}
it('creates a sandbox checkout but never grants access from a return or unsigned input', async () => {
  expect(await checkout('a', 'a@example.test')).toEqual({
    url: 'https://www.creem.io/test/payment/fixture',
  })
  expect((await getBilling('a')).plan).toBe('free')
  expect(
    await runtime.db.prepare("SELECT id FROM checkout WHERE provider='creem'").first(),
  ).toEqual({ id: 'creem:ch_fixture' })
  const before = reads
  await expect(
    webhook(
      new Request(origin + '/api/billing/webhook/creem', {
        method: 'POST',
        headers: { 'creem-signature': 'bad' },
        body: '{}',
      }),
    ),
  ).rejects.toMatchObject({ status: 400 })
  expect(reads).toBe(before)
})
it('verifies raw HMAC, freshly retrieves state, isolates owners and deduplicates events in a provider namespace', async () => {
  await pay()
  expect((await getBilling('a')).plan).toBe('pro')
  expect((await getBilling('b')).plan).toBe('free')
  const row = await runtime.db.prepare('SELECT revision,provider FROM subscription').first()
  const before = reads
  await webhook(await event())
  expect(reads).toBe(before)
  expect(await runtime.db.prepare('SELECT revision,provider FROM subscription').first()).toEqual(
    row,
  )
  expect(await runtime.db.prepare('SELECT id FROM billing_event').first()).toEqual({
    id: 'creem:evt_fixture',
  })
  expect(JSON.stringify(await getBilling('a'))).not.toMatch(
    /fixture-test-api-key|whsec_|private-session|cust_fixture/,
  )
})
it('unknown or mismatched checkout ownership cannot create a subscription', async () => {
  checkoutState = 'completed'
  await expect(webhook(await event())).rejects.toMatchObject({ status: 422 })
  await checkout('a', 'a@example.test')
  badOwner = true
  await expect(webhook(await event())).rejects.toMatchObject({ status: 422 })
  expect(await runtime.db.prepare('SELECT id FROM subscription').first()).toBeNull()
})
it('out-of-order subscription events wait for an owned checkout; canceled and refunded state cannot grant access', async () => {
  await expect(webhook(await event('subscription.active'))).rejects.toMatchObject({ status: 503 })
  await pay()
  subStatus = 'scheduled_cancel'
  await webhook(await event('subscription.scheduled_cancel', 'evt_scheduled'))
  expect((await getBilling('a')).plan).toBe('pro')
  subStatus = 'canceled'
  await webhook(await event('subscription.canceled', 'evt_canceled'))
  expect((await getBilling('a')).plan).toBe('free')
  subStatus = 'active'
  txStatus = 'refunded'
  await webhook(await event('subscription.paid', 'evt_refund'))
  expect((await getBilling('a')).plan).toBe('free')
})
it('test-only mode and URL validation reject live payloads and off-platform redirects', async () => {
  await expect(
    webhook(await event('checkout.completed', 'evt_live', 'prod')),
  ).rejects.toMatchObject({ status: 400 })
  badUrl = true
  await expect(checkout('a', 'a@example.test')).rejects.toMatchObject({ status: 503 })
  mode = 'prod'
  badUrl = false
  await expect(checkout('a', 'a@example.test')).rejects.toMatchObject({ status: 503 })
  expect((await getBilling('a')).plan).toBe('free')
})
it('provider selection does not silently fall back; portal access uses only the owner customer', async () => {
  await pay()
  Object.assign(env, { BILLING_ENABLED: 'false' })
  expect(await portal('a', 'en', 'creem')).toEqual({
    url: 'https://www.creem.io/test/customer/fixture',
  })
  await expect(portal('b', 'en', 'creem')).rejects.toMatchObject({ status: 404 })
  badUrl = true
  await expect(portal('a', 'en', 'creem')).rejects.toMatchObject({ status: 503 })
  Object.assign(env, { BILLING_PROVIDER: 'unknown', BILLING_ENABLED: 'true' })
  expect(billingStatus().ready).toBe(false)
  await expect(checkout('a', 'a@example.test')).rejects.toMatchObject({ status: 503 })
})
it('changing new checkout preserves legacy entitlements and accepts legacy provider callbacks', async () => {
  await pay()
  Object.assign(env, { BILLING_PROVIDER: 'stripe' })
  expect((await getBilling('a')).plan).toBe('pro')
  expect((await getBilling('a')).subscriptions[0]?.provider).toBe('creem')
  subStatus = 'canceled'
  await webhook(await event('subscription.canceled', 'evt_after_switch'))
  expect((await getBilling('a')).plan).toBe('free')
  Object.assign(env, { BILLING_PROVIDER: 'creem' })
  await runtime.db
    .prepare(
      "INSERT INTO subscription (id,user_id,customer_id,status,price_id,current_period_end,sync_id,updated_at) VALUES ('sub_fixture','a','cus_old','past_due','price_fixture',0,'old',1)",
    )
    .run()
  await expect(checkout('a', 'a@example.test')).rejects.toMatchObject({ status: 409 })
  expect(
    await runtime.db.prepare("SELECT provider FROM subscription WHERE id='sub_fixture'").first(),
  ).toEqual({ provider: 'stripe' })
})
it('leases exclude new checkout and webhook writes; an obsolete event snapshot cannot overwrite a newer reconciliation', async () => {
  await pay()
  const lock = await acquireBillingLock('a')
  await expect(checkout('a', 'a@example.test')).rejects.toMatchObject({ status: 409 })
  await expect(webhook(await event('subscription.paid', 'evt_locked'))).rejects.toMatchObject({
    status: 503,
  })
  await releaseBillingLock(lock)
  const original = globalThis.fetch
  let release: (() => void) | undefined, started: (() => void) | undefined
  const paused = new Promise<void>((resolve) => {
      release = resolve
    }),
    begin = new Promise<void>((resolve) => {
      started = resolve
    })
  let held = false
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input
    if (url.includes('/v1/subscriptions?') && !held) {
      held = true
      const stale = payloadSub()
      started!()
      await paused
      return Response.json(stale)
    }
    return original(input, init)
  })
  const old = webhook(await event('subscription.active', 'evt_old'))
  await begin
  subStatus = 'canceled'
  await webhook(await event('subscription.canceled', 'evt_new'))
  release!()
  await old
  expect((await getBilling('a')).plan).toBe('free')
})
it('terminal histories can archive atomically; late signed callbacks update only the Creem archive', async () => {
  await pay()
  subStatus = 'canceled'
  const lock = await acquireBillingLock('a')
  try {
    expect(await reviewBilling(lock)).toMatchObject({ state: 'ready' })
  } finally {
    await releaseBillingLock(lock)
  }
  const deleted = await accountLifecycle(
    new Request(origin + '/api/account/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ confirmation: 'DELETE', currentPassword: 'fixture-password' }),
    }),
  )
  expect(deleted.status).toBe(200)
  expect(
    await runtime.db
      .prepare(
        "SELECT provider,owner_ref FROM billing_subscription_archive WHERE id='creem:sub_fixture'",
      )
      .first(),
  ).toEqual({ provider: 'creem', owner_ref: 'a' })
  await webhook(await event('subscription.canceled', 'evt_late'))
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='a'").first()).toBeNull()
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='b'").first()).toBeTruthy()
})
it('unfinished links, unresolved payments and failed provider reads never report ready or claim unsupported expiry', async () => {
  await pay()
  subStatus = 'canceled'
  checkoutState = 'pending'
  let lock = await acquireBillingLock('a')
  try {
    expect(await reviewBilling(lock, true)).toMatchObject({
      state: 'checkout',
      canCloseCheckouts: false,
    })
  } finally {
    await releaseBillingLock(lock)
  }
  checkoutState = 'completed'
  txStatus = 'chargedBack'
  lock = await acquireBillingLock('a')
  try {
    expect(await reviewBilling(lock)).toMatchObject({ state: 'invoice' })
  } finally {
    await releaseBillingLock(lock)
  }
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 503 })))
  lock = await acquireBillingLock('a')
  try {
    expect(await reviewBilling(lock)).toMatchObject({ state: 'unknown' })
  } finally {
    await releaseBillingLock(lock)
  }
})
it('a successful webhook recovers a request whose checkout response was lost, without orphaning the reservation', async () => {
  await runtime.db
    .prepare(
      "INSERT INTO checkout (id,provider,user_id,status,created_at) VALUES ('creem:pending:fixture-request','creem','a','pending',1)",
    )
    .run()
  checkoutState = 'completed'
  await webhook(await event())
  expect(
    await runtime.db.prepare("SELECT id,status FROM checkout WHERE user_id='a'").all(),
  ).toMatchObject({ results: [{ id: 'creem:ch_fixture', status: 'complete' }] })
  expect((await getBilling('a')).plan).toBe('pro')
})

it('billing review cannot restore access when the current transaction is refunded', async () => {
  await pay()
  txStatus = 'refunded'
  const lock = await acquireBillingLock('a')
  try {
    expect(await reviewBilling(lock)).toMatchObject({ state: 'subscription' })
  } finally {
    await releaseBillingLock(lock)
  }
  expect((await getBilling('a')).plan).toBe('free')
  expect(
    await runtime.db.prepare("SELECT status FROM subscription WHERE provider='creem'").first(),
  ).toEqual({ status: 'refunded' })
})
