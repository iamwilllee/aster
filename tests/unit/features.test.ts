import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { featurePreset } from '../../src/config/feature-policy.mjs'

const selected = vi.hoisted(() => ({
  database: false,
  auth: false,
  emailPassword: false,
  google: false,
  mail: false,
  projects: false,
  billing: false,
  ai: false,
  files: false,
  usage: false,
}))
vi.mock('@/config/features', () => ({ features: selected }))
beforeEach(() => {
  Object.assign(selected, featurePreset('showcase'))
  for (const key of Object.keys(env)) Reflect.deleteProperty(env, key)
  Object.assign(env, {
    ENVIRONMENT: 'local',
    APP_ORIGIN: 'http://127.0.0.1:3100',
    MAIL_MODE: 'local',
  })
})
afterEach(() => vi.restoreAllMocks())

it('public health and closed direct APIs do not need a DB binding or auth secret', async () => {
  const { handleApi } = await import('../../src/server/api.server')
  const origin = env.APP_ORIGIN
  const health = await handleApi(new Request(origin + '/api/health'))
  expect(health.status).toBe(200)
  expect(await health.json()).toMatchObject({ storage: 'none', ok: true })
  for (const path of [
    '/api/projects',
    '/api/content',
    '/api/admin/content',
    '/api/files',
    '/api/files/00000000-0000-0000-0000-000000000000/content',
    '/api/workspace',
    '/api/profile',
    '/api/billing',
    '/api/dev/mail',
    '/api/account/security',
    '/api/account/lifecycle',
    '/api/account/billing-review',
    '/api/account/close-checkouts',
    '/api/account/export',
    '/api/account/delete',
    '/api/account/password',
  ]) {
    expect((await handleApi(new Request(origin + path))).status).toBe(404)
    expect(
      (await handleApi(new Request(origin + path, { method: 'POST', body: '{}' }))).status,
    ).toBe(404)
  }
})
it('disabled auth rejects construction and unused mail does not call a configured provider', async () => {
  const { createAuth } = await import('../../src/modules/auth/auth.server')
  const { isMailConfigured, sendAuthMail } = await import('../../src/modules/mail/mail.server')
  const request = new Request(env.APP_ORIGIN)
  expect(() => createAuth(request)).toThrow()
  Object.assign(env, {
    MAIL_MODE: 'brevo',
    MAIL_FROM: 'Product <accounts@mail.product.test>',
    BREVO_API_KEY: 'fixture-only',
  })
  const fetch = vi.spyOn(globalThis, 'fetch')
  expect(isMailConfigured(request)).toBe(false)
  await expect(
    sendAuthMail(request, 'fixture@example.test', 'verify', env.APP_ORIGIN + '/verify'),
  ).rejects.toThrow('not configured')
  expect(fetch).not.toHaveBeenCalled()
})
it('unused billing does not read subscriptions or treat retained credentials as ready', async () => {
  Object.assign(env, {
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'fixture',
    STRIPE_PRICE_ID: 'price_fixture',
  })
  const { getBilling, billingStatus } = await import('../../src/modules/billing/billing.server')
  expect(billingStatus().ready).toBe(false)
  expect(await getBilling('fixture')).toMatchObject({
    plan: 'free',
    subscription: null,
    provider: { ready: false },
  })
})
