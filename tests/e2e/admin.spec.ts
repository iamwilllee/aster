import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
import { releaseFixtureAdmin } from './local-admin'
const origin = 'http://127.0.0.1:3100',
  password = 'Fixture-operator-2026!'
test.skip(!features.auth || !features.emailPassword, 'Requires selected local email authentication')
async function register(request: APIRequestContext) {
  const email = 'operator-' + randomUUID() + '@example.test'
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Operator fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const mail = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  await request.get(mail.find((m) => m.recipient === email)!.url)
  expect((await login(request, email)).status()).toBe(200)
  return email
}
const login = (request: APIRequestContext, email: string) =>
  request.post('/api/auth/sign-in/email', { headers: { origin }, data: { email, password } })
const close = (request: APIRequestContext) =>
  request.post('/api/account/delete', {
    headers: { origin },
    data: { confirmation: 'DELETE', currentPassword: password, retainSiteContent: true },
  })
test('operator suspension revokes existing sessions, prevents sign-in/reset writes, restores data and records safe operations', async ({
  page,
  browser,
  playwright,
}, testInfo) => {
  const adminEmail = await register(page.request)
  execFileSync('pnpm', ['admin:grant', adminEmail], { encoding: 'utf8', timeout: 30000 })
  const targetContext = await browser.newContext({
      baseURL: origin,
      extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:7777:1234:2345:3456:4567:5678:6789' },
    }),
    targetPage = await targetContext.newPage()
  const shadow = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:7777:1234:2345:3456:4567:5678:7890' },
  })
  const targetEmail = await register(targetContext.request),
    workspace = (await (await targetContext.request.get('/api/workspace')).json()) as {
      user: { id: string }
    },
    targetId = workspace.user.id
  try {
    expect((await login(shadow, targetEmail)).status()).toBe(200)
    if (features.projects)
      expect(
        (
          await targetContext.request.post('/api/projects', {
            headers: { origin },
            data: {
              name: 'Work preserved through suspension',
              description: 'Private details are not displayed in administration',
              status: 'idea',
            },
          })
        ).status(),
      ).toBe(201)
    expect((await targetContext.request.get('/api/admin/users')).status()).toBe(403)
    await targetContext.request.post('/api/auth/request-password-reset', {
      headers: { origin },
      data: { email: targetEmail, redirectTo: '/reset-password' },
    })
    const messages = (await (await targetContext.request.get('/api/dev/mail')).json()) as {
        recipient: string
        url: string
      }[],
      message = messages.find(
        (m) => m.recipient === targetEmail && m.url.includes('reset-password'),
      )!
    const resetUrl = new URL(message.url),
      token = resetUrl.searchParams.get('token') ?? resetUrl.pathname.split('/').pop()!
    await targetPage.goto('/app')
    await page.goto('/app/admin?q=' + encodeURIComponent(targetEmail))
    await page.getByRole('button', { name: 'View account: ' + targetEmail, exact: true }).click()
    const detail = page.getByRole('dialog', { name: 'Account details', exact: true })
    await expect(detail).toContainText(targetEmail)
    await expect(detail).not.toContainText('Private details are not displayed')
    await detail.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: 'Suspend account: ' + targetEmail, exact: true }).click()
    const suspension = page.getByRole('dialog', { name: 'Suspend this account?', exact: true })
    await expect(suspension).toContainText('Subscriptions and charges are not cancelled')
    await suspension.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(suspension).toHaveCount(0)
    await expect(page.getByText('Suspended', { exact: true })).toBeVisible()
    expect((await shadow.get('/api/account/security')).status()).toBe(401)
    expect((await targetContext.request.get('/api/account/export')).status()).toBe(401)
    await targetPage.reload()
    await expect.poll(() => new URL(targetPage.url()).pathname).toBe('/login')
    const blocked = await login(targetContext.request, targetEmail)
    expect(blocked.status()).toBe(403)
    expect(((await blocked.json()) as { code: string }).code).toBe('ACCOUNT_DISABLED')
    const reset = await targetContext.request.post('/api/auth/reset-password', {
      headers: { origin },
      data: { token, newPassword: 'Changed-during-suspension-2026!' },
    })
    expect(reset.status()).toBeGreaterThanOrEqual(400)
    await page.getByRole('button', { name: 'Restore account: ' + targetEmail, exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Restore this account?', exact: true })
      .getByRole('button', { name: 'Confirm action', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Suspend account: ' + targetEmail, exact: true }),
    ).toBeVisible()
    expect((await shadow.get('/api/account/security')).status()).toBe(401)
    expect((await login(targetContext.request, targetEmail)).status()).toBe(200)
    if (features.projects)
      expect(await (await targetContext.request.get('/api/projects')).text()).toContain(
        'Work preserved through suspension',
      )
    const stale = await page.request.post('/api/admin/users/' + targetId + '/access', {
      headers: { origin },
      data: { revision: 0, disabled: true, reason: 'support' },
    })
    expect(stale.status()).toBe(409)
    await page.getByRole('button', { name: 'View account: ' + targetEmail, exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Account details', exact: true })
      .getByRole('button', { name: 'View operations', exact: true })
      .click()
    await expect(page.getByText('Account suspended', { exact: true })).toBeVisible()
    await expect(page.getByText('Account restored', { exact: true })).toBeVisible()
    const audit = await (await page.request.get('/api/admin/audit?target=' + targetId)).text()
    expect(audit).not.toMatch(/Fixture-operator|Changed-during|session_token|password|customer_id/)
    await page.goto('/app/admin?q=' + encodeURIComponent(adminEmail))
    await expect(
      page.getByRole('button', { name: 'Suspend account: ' + adminEmail, exact: true }),
    ).toBeDisabled()
    await page.setViewportSize({ width: 390, height: 844 })
    for (const theme of ['sage', 'catalog']) {
      await page.goto('/app/admin?_style=' + theme + '&q=' + encodeURIComponent(targetEmail))
      const view = page.getByRole('button', { name: 'View account: ' + targetEmail, exact: true })
      await expect(view).toBeEnabled()
      await expect(page.locator('html')).toHaveAttribute('data-visual-theme', theme)
      for (const dark of [false, true]) {
        if ((await page.locator('html').evaluate((el) => el.classList.contains('dark'))) !== dark)
          await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
        await expect
          .poll(() => page.locator('html').evaluate((el) => el.classList.contains('dark')))
          .toBe(dark)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        await page.screenshot({
          animations: 'disabled',
          path: testInfo.outputPath(
            'admin-' + theme + '-' + (dark ? 'dark' : 'light') + '-mobile.png',
          ),
        })
      }
      await view.click()
      const details = page.getByRole('dialog', { name: 'Account details', exact: true })
      await expect(details).toContainText(targetEmail)
      await page.screenshot({
        animations: 'disabled',
        path: testInfo.outputPath('admin-' + theme + '-details-mobile.png'),
      })
      await page.keyboard.press('Escape')
      await expect(details).toHaveCount(0)
      await expect(view).toBeFocused()
    }
  } finally {
    testInfo.setTimeout(testInfo.timeout + 15000)
    const record = (await (await page.request.get('/api/admin/users/' + targetId)).json()) as {
      user: { disabledAt: number | null; revision: number }
    }
    if (record.user.disabledAt !== null)
      await page.request.post('/api/admin/users/' + targetId + '/access', {
        headers: { origin },
        data: { revision: record.user.revision, disabled: false, reason: 'support' },
      })
    await login(targetContext.request, targetEmail)
    expect((await close(targetContext.request)).status()).toBe(200)
    releaseFixtureAdmin(adminEmail)
    expect((await close(page.request)).status()).toBe(200)
    await shadow.dispose()
    await targetContext.close()
  }
})
