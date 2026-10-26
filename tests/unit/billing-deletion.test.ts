import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest'
import Stripe from 'stripe'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import {
  acquireBillingLock,
  releaseBillingLock,
  reviewBilling,
} from '../../src/modules/billing/deletion.server'
import { accountLifecycle } from '../../src/modules/auth/lifecycle.server'
import { checkout, webhook } from '../../src/modules/billing/billing.server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyPassword: vi.fn(),
  signOut: vi.fn(),
  features: {},
}))
vi.mock('@/config/features', () => ({ features: mocks.features }))
vi.mock('@/modules/auth/auth.server', () => ({ createAuth: () => ({ api: mocks }) }))
let runtime: Awaited<ReturnType<typeof testDatabase>>
let subscriptionState = 'canceled'
let checkoutState = 'complete'
let invoiceState = 'paid'
let extraActive = false
let outage = false
let incompleteLists = false
let badOwner = false
let expireRace = false
let expireCalls = 0
const origin = 'http://127.0.0.1:3100'
const secret = 'whsec_paid_lifecycle_fixture'
function sub(id = 'sub_owner') {
  return {
    id,
    object: 'subscription',
    livemode: false,
    customer: 'cus_owner',
    status: id === 'sub_extra' ? 'active' : subscriptionState,
    metadata: { userId: badOwner ? 'foreign' : 'owner' },
    cancel_at_period_end: subscriptionState === 'active',
    items: {
      data: [
        {
          price: { id: 'price_fixture' },
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
    },
  }
}
function session() {
  return {
    id: 'cs_owner',
    object: 'checkout.session',
    livemode: false,
    mode: 'subscription',
    status: checkoutState,
    payment_status: checkoutState === 'complete' ? 'paid' : 'unpaid',
    customer: 'cus_owner',
    subscription: checkoutState === 'complete' ? 'sub_owner' : null,
    client_reference_id: badOwner ? 'foreign' : 'owner',
    metadata: { userId: 'owner' },
  }
}
const req = (
  path = '/delete',
  data: unknown = { confirmation: 'DELETE', currentPassword: 'fixture-only-password' },
) =>
  new Request(origin + '/api/account' + path, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
beforeAll(async () => {
  runtime = await testDatabase()
  Object.assign(env, { DB: runtime.db })
})
afterAll(async () => runtime?.dispose())
afterEach(() => vi.unstubAllGlobals())
beforeEach(async () => {
  Object.assign(mocks.features, featurePreset('billing-test'))
  Object.assign(env, {
    DB: runtime.db,
    APP_ORIGIN: origin,
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_PRICE_ID: 'price_fixture',
    BILLING_ENABLED: 'false',
  })
  mocks.getSession.mockReset().mockResolvedValue({
    user: { id: 'owner', emailVerified: true },
    session: { id: 'session_owner' },
  })
  mocks.verifyPassword.mockReset().mockResolvedValue(new Response('{}'))
  mocks.signOut.mockReset().mockImplementation(() => Promise.resolve(new Response('{}')))
  subscriptionState = 'canceled'
  checkoutState = 'complete'
  invoiceState = 'paid'
  extraActive = false
  outage = false
  incompleteLists = false
  badOwner = false
  expireRace = false
  expireCalls = 0
  await runtime.db.batch([
    ...[
      'subscription',
      'checkout',
      'user',
      'billing_event',
      'billing_account_state',
      'billing_subscription_archive',
      'billing_checkout_archive',
      'api_rate_limit',
    ].map((t) => runtime.db.prepare(`DELETE FROM ${t}`)),
    ...['owner', 'foreign'].map((id) =>
      runtime.db
        .prepare(
          'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,1,1)',
        )
        .bind(id, id, id + '@example.test'),
    ),
    runtime.db
      .prepare(
        "INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES ('session_owner','private-session','owner',?,?,?)",
      )
      .bind(Date.now() + 600000, Date.now(), Date.now()),
    runtime.db.prepare(
      "INSERT INTO account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('credential_owner','owner','credential','owner','private-password-hash',1,1)",
    ),
    runtime.db.prepare(
      "INSERT INTO project (id,user_id,name,status,created_at,updated_at) VALUES ('owner-project','owner','Personal content','idea',1,1)",
    ),
    runtime.db.prepare(
      "INSERT INTO subscription (id,user_id,customer_id,status,price_id,current_period_end,cancel_at_period_end,revision,sync_id,updated_at) VALUES ('sub_owner','owner','cus_owner','canceled','price_fixture',0,0,1,'old-sync',1)",
    ),
    runtime.db.prepare(
      "INSERT INTO checkout (id,user_id,status,created_at) VALUES ('cs_owner','owner','complete',1)",
    ),
  ])
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== 'https://api.stripe.com')
      return Promise.reject(new Error('Unexpected network'))
    if (outage) return Promise.resolve(new Response('{}', { status: 503 }))
    const list = (data: unknown[]) =>
      Response.json({ object: 'list', data, has_more: incompleteLists })
    if (url.pathname === '/v1/subscriptions/sub_owner') return Promise.resolve(Response.json(sub()))
    if (url.pathname === '/v1/subscriptions')
      return Promise.resolve(list(extraActive ? [sub(), sub('sub_extra')] : [sub()]))
    if (url.pathname === '/v1/checkout/sessions/cs_owner/expire' && init?.method === 'POST') {
      expireCalls++
      if (expireRace) {
        checkoutState = 'complete'
        subscriptionState = 'active'
        return Promise.resolve(new Response('{}', { status: 400 }))
      }
      checkoutState = 'expired'
      return Promise.resolve(Response.json(session()))
    }
    if (url.pathname === '/v1/checkout/sessions/cs_owner')
      return Promise.resolve(Response.json(session()))
    if (url.pathname === '/v1/checkout/sessions') return Promise.resolve(list([session()]))
    if (url.pathname === '/v1/invoices')
      return Promise.resolve(list([{ id: 'in_owner', status: invoiceState, livemode: false }]))
    return Promise.reject(new Error('Unexpected provider path'))
  })
})
async function review(close = false) {
  const lock = await acquireBillingLock('owner')
  try {
    return await reviewBilling(lock, close)
  } finally {
    await releaseBillingLock(lock)
  }
}
it('checks Stripe freshly: local cancellation, renewal disabled and hidden active subscriptions cannot authorize deletion', async () => {
  subscriptionState = 'active'
  expect(await review()).toMatchObject({ state: 'subscription' })
  await expect(accountLifecycle(req())).rejects.toMatchObject({ status: 409 })
  subscriptionState = 'canceled'
  extraActive = true
  expect(await review()).toMatchObject({ state: 'subscription' })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='owner'").first()).toBeTruthy()
})
it('expired checkouts and terminal subscriptions with settled invoices permit atomic archive and account deletion', async () => {
  checkoutState = 'expired'
  const response = await accountLifecycle(req())
  expect(response.status).toBe(200)
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='owner'").first()).toBeNull()
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='foreign'").first()).toBeTruthy()
  expect(
    await runtime.db.prepare("SELECT id FROM project WHERE user_id='owner'").first(),
  ).toBeNull()
  const archive = await runtime.db.prepare('SELECT * FROM billing_subscription_archive').first()
  expect(archive).toMatchObject({
    owner_ref: 'owner',
    customer_id: 'cus_owner',
    status: 'canceled',
  })
  expect(JSON.stringify(archive)).not.toMatch(
    /example.test|password|private-session|Personal content/,
  )
  expect(await runtime.db.prepare('SELECT id FROM subscription').first()).toBeNull()
  expect(await runtime.db.prepare('SELECT id FROM billing_checkout_archive').first()).toMatchObject(
    { id: 'cs_owner' },
  )
  expect(
    await runtime.db
      .prepare("SELECT closed_at,lock_id FROM billing_account_state WHERE user_id='owner'")
      .first(),
  ).toMatchObject({ closed_at: expect.any(Number) as unknown, lock_id: null })
  await expect(accountLifecycle(req())).rejects.toMatchObject({ status: 401 })
})
it('rechecks on final confirmation rather than trusting a previous ready response', async () => {
  expect(await review()).toMatchObject({ state: 'ready' })
  subscriptionState = 'active'
  await expect(accountLifecycle(req())).rejects.toMatchObject({ status: 409 })
  expect(await runtime.db.prepare('SELECT id FROM billing_subscription_archive').first()).toBeNull()
})
it('unpaid/draft/uncollectible invoices, unknown ownership, provider outages and incomplete lists fail closed', async () => {
  for (const state of ['open', 'draft', 'uncollectible']) {
    invoiceState = state
    expect(await review()).toMatchObject({ state: 'invoice' })
  }
  invoiceState = 'paid'
  badOwner = true
  expect(await review()).toMatchObject({ state: 'unknown' })
  badOwner = false
  outage = true
  expect(await review()).toMatchObject({ state: 'unknown' })
  outage = false
  incompleteLists = true
  expect(await review()).toMatchObject({ state: 'unknown' })
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='owner'").first()).toBeTruthy()
})
it('closing open checkout links requires explicit confirmation and does not cancel an active subscription', async () => {
  checkoutState = 'open'
  expect(await review()).toMatchObject({ state: 'checkout', canCloseCheckouts: true })
  expect(expireCalls).toBe(0)
  await expect(
    accountLifecycle(req('/close-checkouts', { confirmation: 'DELETE' })),
  ).rejects.toMatchObject({ status: 400 })
  subscriptionState = 'active'
  const result = await accountLifecycle(req('/close-checkouts', { confirmation: 'CLOSE' }))
  expect(await result.json()).toMatchObject({ state: 'subscription' })
  expect(expireCalls).toBe(1)
  expect(subscriptionState).toBe('active')
  expect(checkoutState).toBe('expired')
})
it('a completion racing checkout expiration stays blocked, then refreshes to the actual subscription', async () => {
  checkoutState = 'open'
  expireRace = true
  expect(await review(true)).toMatchObject({ state: 'unknown' })
  expect(await review()).toMatchObject({ state: 'subscription' })
})
it('unknown pending reservations and missing provider configuration do not become safe by aging or disabling billing', async () => {
  Object.assign(mocks.features, { billing: false })
  await runtime.db
    .prepare(
      "INSERT INTO checkout (id,user_id,status,created_at) VALUES ('pending:opaque','owner','pending',0)",
    )
    .run()
  expect(await review()).toMatchObject({ state: 'unknown' })
  await expect(accountLifecycle(req())).rejects.toMatchObject({ status: 409 })
  await runtime.db.prepare("DELETE FROM checkout WHERE id='pending:opaque'").run()
  Object.assign(env, { STRIPE_SECRET_KEY: undefined })
  expect(await review()).toMatchObject({ state: 'unknown' })
})
it('the account lease excludes checkout and webhook writes; stale/overlapping leases cannot authorize deletion', async () => {
  const lock = await acquireBillingLock('owner')
  await expect(acquireBillingLock('owner')).rejects.toMatchObject({ status: 409 })
  Object.assign(env, { BILLING_ENABLED: 'true' })
  await expect(checkout('owner', 'owner@example.test')).rejects.toMatchObject({ status: 409 })
  await expect(webhook(await eventRequest('evt_locked'))).rejects.toMatchObject({ status: 503 })
  await runtime.db
    .prepare('UPDATE billing_account_state SET lock_until=0 WHERE user_id=?')
    .bind('owner')
    .run()
  expect(await reviewBilling(lock)).toMatchObject({ state: 'unknown' })
  const replacement = await acquireBillingLock('owner')
  await releaseBillingLock(lock)
  expect(
    await runtime.db.prepare('SELECT lock_id FROM billing_account_state').first(),
  ).toMatchObject({ lock_id: replacement.id })
  await releaseBillingLock(replacement)
})
async function eventRequest(id: string) {
  const payload = JSON.stringify({
    id,
    object: 'event',
    type: 'customer.subscription.updated',
    livemode: false,
    data: { object: { id: 'sub_owner' } },
  })
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  })
  return new Request(origin + '/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload,
  })
}
it('late and duplicate signed webhooks update retained billing records without restoring the user or granting a replacement account access', async () => {
  await accountLifecycle(req())
  expect(await webhook(await eventRequest('evt_late'))).toEqual({ received: true })
  const first = await runtime.db
    .prepare('SELECT revision FROM billing_subscription_archive')
    .first()
  expect(await webhook(await eventRequest('evt_late'))).toEqual({ received: true })
  expect(
    await runtime.db.prepare('SELECT revision FROM billing_subscription_archive').first(),
  ).toEqual(first)
  subscriptionState = 'active'
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    await webhook(await eventRequest('evt_after_close'))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('closed_account_billing_attention'))
  } finally {
    log.mockRestore()
  }
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='owner'").first()).toBeNull()
  await runtime.db
    .prepare(
      "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('replacement','New','owner@example.test',1,1,1)",
    )
    .run()
  expect(
    await runtime.db.prepare("SELECT id FROM subscription WHERE user_id='replacement'").first(),
  ).toBeNull()
  badOwner = true
  await expect(webhook(await eventRequest('evt_mismatch'))).rejects.toMatchObject({ status: 422 })
})
it('a failed account deletion rolls back archival, leaves credentials intact and releases its lease for retry', async () => {
  await runtime.db
    .prepare(
      "CREATE TRIGGER deny_paid_delete BEFORE DELETE ON user WHEN OLD.id='owner' BEGIN SELECT RAISE(ABORT,'fixture fail'); END",
    )
    .run()
  try {
    await expect(accountLifecycle(req())).rejects.toThrow()
    expect(
      await runtime.db.prepare('SELECT id FROM billing_subscription_archive').first(),
    ).toBeNull()
    expect(
      await runtime.db.prepare('SELECT lock_id FROM billing_account_state').first(),
    ).toMatchObject({ lock_id: null })
  } finally {
    await runtime.db.prepare('DROP TRIGGER deny_paid_delete').run()
  }
  expect((await accountLifecycle(req())).status).toBe(200)
})

it('database time rejects an expired authorization even if a delayed request retains an older JavaScript timestamp', async () => {
  await runtime.db.batch([
    runtime.db.prepare('DELETE FROM subscription'),
    runtime.db.prepare('DELETE FROM checkout'),
  ])
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now - 120000)
  try {
    await expect(accountLifecycle(req())).rejects.toMatchObject({ status: 401 })
  } finally {
    clock.mockRestore()
  }
  expect(await runtime.db.prepare("SELECT id FROM user WHERE id='owner'").first()).toBeTruthy()
  expect(
    await runtime.db.prepare('SELECT closed_at FROM billing_account_state').first(),
  ).toMatchObject({ closed_at: null })
})
