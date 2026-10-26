import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
import type { AccountExport } from '../../src/modules/auth/lifecycle'

const origin = 'http://127.0.0.1:3100'
const password = 'Fixture-lifecycle-2026!'
test.skip(!features.emailPassword, 'Requires selected local email authentication')
async function signup(
  request: APIRequestContext,
  email = `lifecycle-${randomUUID()}@example.test`,
) {
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Lifecycle fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const messages = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  return { email, verificationUrl: messages.find((mail) => mail.recipient === email)!.url }
}
async function login(request: APIRequestContext, email: string) {
  return request.post('/api/auth/sign-in/email', { headers: { origin }, data: { email, password } })
}
async function register(request: APIRequestContext) {
  const account = await signup(request)
  await request.get(account.verificationUrl)
  expect((await login(request, account.email)).status()).toBe(200)
  return account
}
test('export and deletion isolate users, revoke every session and prevent old verification/reset links from reviving a new account', async ({
  request,
  playwright,
}) => {
  expect((await request.post('/api/account/export', { headers: { origin } })).status()).toBe(401)
  const owner = await register(request)
  const other = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:1234:5678:abcd:1234:5678:abcd:1234' },
  })
  const second = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:1234:5678:abcd:1234:5678:abcd:4321' },
  })
  try {
    const foreign = await register(other)
    expect((await login(second, owner.email)).status()).toBe(200)
    if (features.projects) {
      expect(
        (
          await request.post('/api/projects', {
            headers: { origin },
            data: { name: 'Owner export project', description: 'Owned', status: 'idea' },
          })
        ).status(),
      ).toBe(201)
      expect(
        (
          await other.post('/api/projects', {
            headers: { origin },
            data: { name: 'Foreign private project', description: 'Never export', status: 'idea' },
          })
        ).status(),
      ).toBe(201)
    }
    expect(
      (
        await request.post('/api/account/delete', {
          headers: { origin: 'https://untrusted.example' },
          data: { confirmation: 'DELETE', currentPassword: password },
        })
      ).status(),
    ).toBe(403)
    expect((await request.get('/api/account/delete')).status()).toBe(404)
    const exported = await request.post('/api/account/export', { headers: { origin } })
    expect(exported.status()).toBe(200)
    expect(exported.headers()['content-disposition']).toContain('attachment')
    const text = await exported.text()
    expect(JSON.parse(text)).toMatchObject({ version: 1, profile: { email: owner.email } })
    expect(text).not.toContain(foreign.email)
    expect(text).not.toMatch(/Foreign private|token|password|customer_id|user_id/)
    expect(
      (
        await request.post('/api/account/delete', {
          headers: { origin },
          data: { confirmation: 'DELETE', currentPassword: 'wrong-fixture-password' },
        })
      ).status(),
    ).toBe(400)
    expect((await second.get('/api/account/security')).status()).toBe(200)
    await request.post('/api/auth/request-password-reset', {
      headers: { origin },
      data: { email: owner.email, redirectTo: '/reset-password' },
    })
    const mail = (await (await request.get('/api/dev/mail')).json()) as {
      recipient: string
      subject: string
      url: string
    }[]
    const reset = mail.find(
      (message) => message.recipient === owner.email && message.url.includes('reset-password'),
    )!
    const resetToken =
      new URL(reset.url).searchParams.get('token') ?? new URL(reset.url).pathname.split('/').pop()
    const deleted = await request.post('/api/account/delete', {
      headers: { origin },
      data: { confirmation: 'DELETE', currentPassword: password },
    })
    expect(deleted.status(), await deleted.text()).toBe(200)
    expect(await deleted.json()).toEqual({ ok: true })
    expect(deleted.headers()['set-cookie']).toContain('Max-Age=0')
    expect((await second.get('/api/account/security')).status()).toBe(401)
    expect((await request.post('/api/account/export', { headers: { origin } })).status()).toBe(401)
    expect(
      (
        await request.post('/api/account/delete', {
          headers: { origin },
          data: { confirmation: 'DELETE', currentPassword: password },
        })
      ).status(),
    ).toBe(401)
    expect((await other.get('/api/account/security')).status()).toBe(200)
    const replacement = await signup(request, owner.email)
    await request.get(owner.verificationUrl)
    expect((await login(request, owner.email)).status()).toBe(403)
    expect(
      (
        await request.post('/api/auth/reset-password', {
          headers: { origin },
          data: { newPassword: password + '-changed', token: resetToken },
        })
      ).ok(),
    ).toBe(false)
    await request.get(replacement.verificationUrl)
    expect((await login(request, owner.email)).status()).toBe(200)
    const data = (await (
      await request.post('/api/account/export', { headers: { origin } })
    ).json()) as AccountExport
    expect(data.projects).toEqual([])
    for (const path of ['delete-user', 'delete-user/callback', 'verify-password'])
      expect(
        (
          await request.post('/api/auth/' + path, { headers: { origin }, data: { password } })
        ).status(),
      ).toBe(404)
  } finally {
    await other.dispose()
    await second.dispose()
  }
})

test('settings download real JSON, require confirmation, preserve the account on cancel and delete through the mobile UI', async ({
  page,
  request,
}) => {
  const owner = await register(request)
  await page.context().addCookies((await request.storageState()).cookies)
  await page.goto('/zh/app/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 JSON', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('account-data.json')
  const content = JSON.parse(await readFile(await file.path(), 'utf8')) as AccountExport
  expect(content.profile.email).toBe(owner.email)
  await expect(page.getByRole('status').filter({ hasText: '已发起下载' })).toBeVisible()
  await page.getByRole('button', { name: '注销账号', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '确认永久注销账号？' })
  await expect(dialog.getByRole('button', { name: '永久注销账号', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect((await request.get('/api/account/security')).status()).toBe(200)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await page.getByRole('button', { name: '注销账号', exact: true }).click()
  await dialog.getByLabel('当前密码', { exact: true }).fill('wrong-fixture-password')
  await dialog.getByLabel('输入 DELETE 确认注销').fill('DELETE')
  await dialog.getByRole('button', { name: '永久注销账号', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('当前密码不正确。')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await dialog.getByLabel('当前密码', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: '永久注销账号', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/login\?deleted=(?:1|true)(?:&|$)/)
  await expect(page.getByRole('status')).toContainText('账号已注销，全部会话已失效。')
  await page.goto('/zh/app/settings')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/zh/login')
})

test('lifecycle loading errors recover; payment history and stale Google-only views cannot advertise available deletion', async ({
  page,
  request,
}) => {
  await register(request)
  await page.context().addCookies((await request.storageState()).cookies)
  let mode: 'error' | 'billing' | 'google' = 'error'
  // UI fixtures only: provider behavior is not claimed by this rendering test.
  await page.route('**/api/account/lifecycle', (route) =>
    route.fulfill({
      status: mode === 'error' ? 503 : 200,
      json:
        mode === 'error'
          ? { error: 'Fixture lifecycle unavailable.' }
          : {
              verification: mode === 'google' ? 'recent-login' : 'password',
              recentLogin: false,
              billingBlocked: mode === 'billing',
            },
    }),
  )
  await page.goto('/app/settings')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Fixture lifecycle unavailable.' }),
  ).toBeVisible()
  mode = 'billing'
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText(/Payment history needs a fresh check/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toHaveCount(0)
  mode = 'google'
  await page.reload()
  await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Sign out and sign in again', exact: true }),
  ).toBeVisible()
})

test('payment review explains blockers, confirms checkout closure and exposes deletion only after a complete ready response', async ({
  page,
  request,
}) => {
  await register(request)
  await page.context().addCookies((await request.storageState()).cookies)
  // Provider state is a rendering fixture. Signed SDK/D1 integration is covered in billing-deletion.test.ts.
  await page.route('**/api/account/lifecycle', (route) =>
    route.fulfill({
      json: {
        verification: 'password',
        recentLogin: true,
        billingBlocked: true,
        billing: { state: 'unchecked', canCloseCheckouts: false },
      },
    }),
  )
  let state = 'checkout'
  let closes = 0
  await page.route('**/api/account/billing-review', (route) =>
    route.fulfill({ json: { state, canCloseCheckouts: state === 'checkout' } }),
  )
  await page.route('**/api/account/close-checkouts', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ confirmation: 'CLOSE' })
    closes++
    state = 'ready'
    await route.fulfill({ json: { state, canCloseCheckouts: false } })
  })
  await page.goto('/zh/app/settings')
  await expect(page.getByRole('button', { name: '注销账号', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '核对支付状态', exact: true }).click()
  await expect(
    page.getByText('仍有未完成的结账链接，请关闭链接或完成支付后重新核对。'),
  ).toBeVisible()
  await page.getByRole('button', { name: '关闭未完成结账', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '确认关闭未完成结账？' })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect(closes).toBe(0)
  await page.getByRole('button', { name: '关闭未完成结账', exact: true }).click()
  await dialog.getByRole('button', { name: '确认关闭链接', exact: true }).click()
  expect(closes).toBe(1)
  await expect(page.getByRole('button', { name: '注销账号', exact: true })).toBeVisible()
  await expect(page.getByText('支付核对已通过，可以继续注销；确认时还会重新核对。')).toBeVisible()
  await page.getByRole('button', { name: '注销账号', exact: true }).click()
  const deletion = page.getByRole('dialog', { name: '确认永久注销账号？' })
  await expect(deletion.getByText(/注销后会保留对账必需/)).toBeVisible()
  await page.keyboard.press('Escape')
  state = 'invoice'
  await page.getByRole('button', { name: '核对支付状态', exact: true }).click()
  await expect(page.getByText(/仍有未支付或待处理账单/)).toBeVisible()
  await expect(page.getByRole('button', { name: '注销账号', exact: true })).toHaveCount(0)
  state = 'unknown'
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '核对支付状态', exact: true }).click()
  await expect(page.getByText(/支付状态尚未完整核实/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
  await page.getByRole('button', { name: 'Check payment status', exact: true }).click()
  await expect(page.getByText(/Payment state could not be fully verified/)).toBeVisible()
})
