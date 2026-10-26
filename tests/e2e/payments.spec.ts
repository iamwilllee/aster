import { randomUUID } from 'node:crypto'
import { test, expect, features } from './fixtures'

// Rendering fixtures only. HMAC/provider reads and D1 reconciliation are tested separately.
test.skip(!features.emailPassword || !features.billing, 'Requires selected email auth and billing')
test('renders the selected provider, preserves legacy portal actions and never upgrades on a checkout return', async ({
  page,
}) => {
  const origin = 'http://127.0.0.1:3100'
  const email = `payment-ui-${randomUUID()}@example.test`
  const password = 'Fixture-payments-2026!'
  expect(
    (
      await page.request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Payment UI fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const messages = (await (await page.request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  await page.request.get(messages.find((mail) => mail.recipient === email)!.url)
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200)
  const portals: string[] = []
  await page.route('**/api/billing', (route) =>
    route.fulfill({
      json: {
        provider: { name: 'creem', configured: true, enabled: true, ready: true, mode: 'test' },
        plan: 'free',
        projectLimit: 3,
        subscription: null,
        subscriptions: ['creem', 'stripe'].map((provider) => ({
          provider,
          status: 'canceled',
          currentPeriodEnd: 0,
          cancelAtPeriodEnd: false,
          configured: true,
        })),
      },
    }),
  )
  await page.route('**/api/billing/portal?*', (route) => {
    portals.push(new URL(route.request().url()).searchParams.get('provider')!)
    return route.fulfill({
      status: 503,
      json: { code: 'SERVICE_UNAVAILABLE', message: 'Fixture unavailable' },
    })
  })
  await page.route('**/api/billing/checkout-status?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('id')).toBe('creem:ch_fixture')
    return route.fulfill({ json: { status: 'pending' } })
  })
  await page.goto('/app/billing?checkout_id=ch_fixture')
  await expect(page.getByText('Creem test mode · no real charges', { exact: true })).toBeVisible({
    timeout: 10000,
  })
  await expect(page.getByRole('status')).toContainText('does not grant access')
  await expect(page.getByRole('button', { name: 'Test subscription', exact: true })).toBeEnabled()
  for (const provider of ['Creem', 'Stripe']) {
    const section = page.locator('section').filter({ hasText: `Subscription status · ${provider}` })
    await section.getByRole('button', { name: 'Billing portal', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  }
  expect(portals).toEqual(['creem', 'stripe'])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Test subscription', exact: true })).toBeEnabled({
    timeout: 10000,
  })
  // Remove this test account through the real lifecycle; no provider record was created.
  expect(
    (
      await page.request.post('/api/account/delete', {
        headers: { origin },
        data: { confirmation: 'DELETE', currentPassword: password },
      })
    ).status(),
  ).toBe(200)
})
