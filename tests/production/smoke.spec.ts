import { expect, test } from '@playwright/test'

test.describe('default authenticated starter', () => {
  test.skip(
    !['default', 'web-app'].includes(process.env.STARTER_SMOKE_PROFILE ?? ''),
    'Different capability profile',
  )
  test('built Worker renders English/Chinese SSR and isolates concurrent language requests', async ({
    request,
  }) => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => request.get(i % 2 ? '/zh' : '/')),
    )
    for (const [i, response] of responses.entries()) {
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html).toContain(i % 2 ? 'lang="zh-CN"' : 'lang="en"')
      expect(html).toContain(i % 2 ? '给 Agent 一个' : 'For your agent.')
      expect(html).toContain('noindex,nofollow')
      expect(html).not.toContain('fixture-only-not-a-real-google-secret')
    }
  })
  test('production closes local-only pages and redirects private pages without leaking data', async ({
    request,
  }) => {
    expect((await request.get('/api/health')).status()).toBe(200)
    expect((await request.get('/api/dev/mail')).status()).toBe(404)
    for (const path of [
      '/dev/inbox',
      '/zh/dev/inbox',
      '/dev/ui',
      '/zh/dev/ui',
      '/dev/blueprints',
      '/zh/dev/blueprints',
    ])
      expect((await request.get(path)).status()).toBe(404)
    for (const prefix of ['', '/zh']) {
      const response = await request.get(prefix + '/app')
      expect(new URL(response.url()).pathname).toBe(prefix + '/login')
      expect(await response.text()).not.toContain('fixture-only-not-a-real-google-secret')
    }
    expect((await request.get('/api/projects')).status()).toBe(401)
    expect((await request.get('/api/files')).status()).toBe(
      process.env.STARTER_SMOKE_FILES === 'true' ? 401 : 404,
    )
    const themed = await (await request.get('/?_style=catalog')).text()
    expect(themed).toContain('data-visual-theme="sage"')
    expect((await request.get('/api/account/security')).status()).toBe(401)
    expect((await request.get('/api/auth/list-sessions')).status()).toBe(404)
    const origin = new URL(test.info().project.use.baseURL!).origin
    expect(
      (
        await request.post('/api/auth/sign-up/email', {
          headers: { origin },
          data: {
            email: 'disabled@example.test',
            name: 'Disabled',
            password: 'Fixture-only-password-2026!',
          },
        })
      ).status(),
    ).toBe(503)
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /')
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('<loc>')
    expect(
      (
        await request.post('/api/projects', {
          headers: { origin: 'https://untrusted.example' },
          data: { name: 'CSRF' },
        })
      ).status(),
    ).toBe(403)
  })
  test('published content SSR exposes only its live snapshot and protects editorial APIs', async ({
    request,
    page,
  }) => {
    test.skip(process.env.STARTER_SMOKE_CONTENT !== 'true', 'Content not selected')
    const response = await request.get('/content/fixture-guide')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('Published fixture body')
    expect(html).not.toContain('PRIVATE-DRAFT-SENTINEL')
    expect(response.headers()['cache-control']).toContain('no-store')
    expect((await request.get('/content/never-published')).status()).toBe(404)
    expect((await request.get('/zh/content/fixture-guide')).status()).toBe(404)
    expect((await request.get('/api/admin/content')).status()).toBe(401)
    expect(
      (await request.get('/api/content/assets/00000000-0000-0000-0000-000000000000')).status(),
    ).toBe(404)
    await page.goto('/content/fixture-guide')
    await expect(page).toHaveTitle('Fixture content SEO')
    await expect(
      page.getByRole('heading', { name: 'Published fixture guide', exact: true }),
    ).toBeVisible()
  })
  test('production operator controls revoke sessions and preserve the last administrator', async ({
    request,
    playwright,
  }) => {
    const origin = new URL(test.info().project.use.baseURL!).origin,
      password = 'Production-fixture-2026!'
    const target = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true })
    try {
      expect(
        (
          await target.post('/api/auth/sign-in/email', {
            headers: { origin },
            data: { email: 'target@fixture.test', password },
          })
        ).status(),
      ).toBe(200)
      expect(
        (
          await request.post('/api/auth/sign-in/email', {
            headers: { origin },
            data: { email: 'operator@fixture.test', password },
          })
        ).status(),
      ).toBe(200)
      const row = (await (await request.get('/api/admin/users/fixture-target')).json()) as {
        user: { revision: number }
      }
      expect(
        (
          await request.post('/api/admin/users/fixture-target/access', {
            headers: { origin },
            data: { revision: row.user.revision, disabled: true, reason: 'security' },
          })
        ).status(),
      ).toBe(200)
      expect((await target.get('/api/account/security')).status()).toBe(401)
      expect(
        (
          await target.post('/api/auth/sign-in/email', {
            headers: { origin },
            data: { email: 'target@fixture.test', password },
          })
        ).status(),
      ).toBe(403)
      const reset = await target.post('/api/auth/reset-password', {
        headers: { origin },
        data: {
          token: 'production-reset-fixture-only',
          newPassword: 'Production-new-fixture-2026!',
        },
      })
      expect(reset.status()).toBe(503)
      expect(await reset.json()).toMatchObject({ code: 'AUTH_UNAVAILABLE' })
      expect(
        (
          await request.post('/api/admin/users/fixture-target/access', {
            headers: { origin },
            data: { revision: row.user.revision + 1, disabled: false, reason: 'support' },
          })
        ).status(),
      ).toBe(200)
      expect((await target.get('/api/account/security')).status()).toBe(401)
      expect(
        (
          await target.post('/api/auth/sign-in/email', {
            headers: { origin },
            data: { email: 'target@fixture.test', password },
          })
        ).status(),
      ).toBe(200)
      expect(
        (
          await request.post('/api/account/delete', {
            headers: { origin },
            data: { confirmation: 'DELETE', currentPassword: password },
          })
        ).status(),
      ).toBe(409)
      const audit = await (await request.get('/api/admin/audit')).text()
      expect(audit).toContain('user.disable')
      expect(audit).not.toContain(password)
    } finally {
      await target.dispose()
    }
  })
  test('production hydration preserves locale, links and mobile navigation', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/zh')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    const billing = process.env.STARTER_SMOKE_BILLING === 'true'
    if (billing) await page.getByRole('link', { name: '套餐', exact: true }).click()
    else
      await page
        .locator('header')
        .getByRole('link', { name: /进入工作台/ })
        .click()
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(billing ? '/zh/pricing' : '/zh/login')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.getByRole('button', { name: 'Switch to English' }).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe(billing ? '/pricing' : '/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
  test('unselected billing closes public pages, private pages and direct mutation endpoints', async ({
    request,
    page,
  }) => {
    test.skip(process.env.STARTER_SMOKE_BILLING === 'true', 'Billing selected')
    const origin = new URL(test.info().project.use.baseURL!).origin
    for (const path of [
      '/pricing',
      '/zh/pricing',
      '/app/billing',
      '/api/billing',
      '/api/billing/checkout-status',
    ])
      expect((await request.get(path)).status(), path).toBe(404)
    for (const path of [
      '/api/billing/checkout',
      '/api/billing/portal',
      '/api/billing/webhook',
      '/api/billing/webhook/stripe',
      '/api/billing/webhook/creem',
    ])
      expect((await request.post(path, { headers: { origin }, data: {} })).status(), path).toBe(404)
    await page.goto('/zh')
    await expect(page.getByRole('link', { name: '套餐', exact: true })).toHaveCount(0)
    expect(await (await request.get('/api/health')).json()).toMatchObject({
      billing: 'unconfigured',
    })
  })
  test('configured Google builds a stateful authorization URL with the exact callback; test credentials never leave this test', async ({
    request,
  }) => {
    test.skip(process.env.STARTER_SMOKE_GOOGLE !== 'true', 'Google not selected')
    const origin = new URL(test.info().project.use.baseURL!).origin
    const response = await request.post('/api/auth/sign-in/social', {
      headers: { origin },
      data: { provider: 'google', callbackURL: '/zh/app', disableRedirect: true },
    })
    expect(response.status(), await response.text()).toBe(200)
    const result = (await response.json()) as { url: string }
    const url = new URL(result.url)
    expect(url.hostname).toBe('accounts.google.com')
    expect(url.searchParams.get('redirect_uri')).toBe(origin + '/api/auth/callback/google')
    expect(url.searchParams.get('client_id')).toBe('fixture-only.apps.googleusercontent.com')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(result.url).not.toContain('fixture-only-not-a-real-google-secret')
  })

  test('OAuth error callbacks render a localized error instead of claiming successful sign-in', async ({
    page,
  }) => {
    test.skip(process.env.STARTER_SMOKE_GOOGLE !== 'true', 'Google not selected')
    await page.goto('/zh/login?oauthError=1')
    await expect(page.getByRole('alert').filter({ hasText: 'Google 登录未完成' })).toBeVisible()
    await expect(page.getByRole('button', { name: '使用 Google 继续' })).toBeEnabled()
  })

  test('missing mail does not advertise unavailable signup or expose setup errors to visitors', async ({
    page,
  }) => {
    await page.goto('/login')
    const google = page.getByRole('button', { name: 'Continue with Google', exact: true })
    if (process.env.STARTER_SMOKE_GOOGLE === 'true') await expect(google).toBeEnabled()
    else await expect(google).toHaveCount(0)
    await expect(
      page.getByText(
        'Email registration and password reset are currently unavailable. Please try again later.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get started', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Forgot password?', exact: true })).toHaveCount(0)
    await expect(page.getByText(/not configured/i)).toHaveCount(0)
    await page.goto('/signup')
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveCount(0)
    if (process.env.STARTER_SMOKE_GOOGLE === 'true') {
      // A simulated provider failure checks UI feedback only; it is not live OAuth acceptance.
      await page.route('**/api/auth/sign-in/social', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PROVIDER_UNAVAILABLE', message: 'Fixture failure' }),
        }),
      )
      await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Google sign-in')
    }
    await page.goto('/forgot-password')
    await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toHaveCount(0)
    await page.goto('/')
    // Only a selected, configured method can advertise registration while mail is unavailable.
    await expect(page.locator('a[href="/signup"]')).toHaveCount(
      process.env.STARTER_SMOKE_GOOGLE === 'true' ? 1 : 0,
    )
  })
})

test.describe('public showcase without external resources', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'showcase', 'Showcase profile only')
  test('SSR, hydration, theme and locale work without a DB or auth secret', async ({
    page,
    request,
  }) => {
    expect(await (await request.get('/api/health')).json()).toMatchObject({
      ok: true,
      storage: 'none',
    })
    await page.goto('/?_style=sage')
    await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'catalog')
    await expect(page.getByRole('heading', { name: /For your agent/ })).toBeVisible()
    await expect(
      page.locator('a[href="/login"],a[href="/signup"],a[href="/app"],a[href="/pricing"]'),
    ).toHaveCount(0)
    await expect(page.getByText('Better Auth', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Cloudflare D1', { exact: true })).toHaveCount(0)
    await page.goto('/')
    await page.getByRole('button', { name: '切换中文' }).click()
    await expect(page).toHaveURL(/\/zh$/)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
  test('disabled pages and direct APIs stay unavailable', async ({ request }) => {
    for (const prefix of ['', '/zh'])
      for (const path of [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/app',
        '/app/billing',
        '/app/files',
        '/content',
        '/app/content',
        '/pricing',
        '/dev/inbox',
        '/dev/blueprints',
      ])
        expect((await request.get(prefix + path)).status(), prefix + path).toBe(404)
    for (const path of [
      '/api/projects',
      '/api/workspace',
      '/api/profile',
      '/api/billing',
      '/api/dev/mail',
      '/api/auth/get-session',
      '/api/account/security',
      '/api/account/lifecycle',
      '/api/content',
      '/api/admin/content',
      '/api/admin/users',
      '/api/admin/audit',
      '/api/content/assets/00000000-0000-0000-0000-000000000000',
      '/api/files',
      '/api/files/00000000-0000-0000-0000-000000000000/content',
      '/api/account/billing-review',
      '/api/account/close-checkouts',
      '/api/account/export',
      '/api/account/delete',
    ])
      expect((await request.get(path)).status(), path).toBe(404)
    for (const path of [
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/email',
      '/api/auth/reset-password',
      '/api/billing/webhook',
      '/api/account/password',
      '/api/account/sessions/revoke-others',
    ])
      expect((await request.post(path, { data: { fixture: true } })).status(), path).toBe(404)
  })
})

test.describe('Google-only authentication', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'google-only', 'Google-only profile')
  test('shows only the selected method and rejects direct email endpoints', async ({
    page,
    request,
  }) => {
    await page.goto('/login')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveCount(0)
    await expect(page.getByText(/Email registration and password reset/)).toHaveCount(0)
    for (const path of ['/forgot-password', '/reset-password', '/pricing'])
      expect((await request.get(path)).status()).toBe(404)
    const origin = new URL(test.info().project.use.baseURL!).origin
    expect((await request.get('/api/auth/list-sessions')).status()).toBe(404)
    expect(
      (
        await request.post('/api/auth/change-password', {
          headers: { origin },
          data: {
            currentPassword: 'fixture-current-password',
            newPassword: 'fixture-next-password',
          },
        })
      ).status(),
    ).toBe(404)
    for (const path of [
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/email',
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
    ])
      expect(
        (await request.post(path, { headers: { origin }, data: { fixture: true } })).status(),
      ).toBe(404)
    // Fixture credentials only prove request construction, never live Google authorization.
    expect(
      (
        await request.post('/api/auth/sign-in/social', {
          headers: { origin },
          data: { provider: 'google', callbackURL: '/app', disableRedirect: true },
        })
      ).status(),
    ).toBe(200)
    expect((await request.get('/api/billing')).status()).toBe(404)
  })
})

test.describe('Creem sandbox wiring in an isolated production Worker', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'creem', 'Creem profile only')
  test('keeps checkout closed, rejects unsigned or forged events and never exposes fixture keys', async ({
    request,
  }) => {
    const health = await request.get('/api/health')
    expect(health.status()).toBe(200)
    expect(await health.json()).toMatchObject({ billing: 'unconfigured' })
    for (const path of ['/api/billing', '/api/account/lifecycle'])
      expect((await request.get(path)).status()).toBe(401)
    const origin = new URL(test.info().project.use.baseURL!).origin
    // Wrangler rewrites a same-host HTTPS Origin to its internal HTTP proxy origin.
    // The alternate loopback hostname preserves the exact header; production auth stays strict.
    const checkout = await request.post('https://localhost:3110/api/billing/checkout', {
      headers: { origin },
    })
    expect(checkout.status(), await checkout.text()).toBe(401)
    for (const path of ['/api/billing/webhook', '/api/billing/webhook/creem']) {
      expect((await request.post(path, { data: {} })).status()).toBe(400)
      expect(
        (
          await request.post(path, {
            headers: { 'creem-signature': '0'.repeat(64) },
            data: {
              id: 'evt_fixture',
              eventType: 'checkout.completed',
              object: { id: 'ch_fixture', mode: 'test' },
            },
          })
        ).status(),
      ).toBe(400)
    }
    expect(
      (
        await request.post('/api/billing/webhook/stripe', {
          headers: { 'creem-signature': '0'.repeat(64) },
          data: {},
        })
      ).status(),
    ).toBe(400)
    const html = await (await request.get('/login')).text()
    expect(html).not.toMatch(/fixture-test-only|fixture-webhook-only|prod_fixture/)
    expect((await request.get('/api/dev/mail')).status()).toBe(404)
  })
})
