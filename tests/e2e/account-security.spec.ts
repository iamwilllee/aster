import { randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
import type { AccountSecurity } from '../../src/modules/auth/security'

const origin = 'http://127.0.0.1:3100'
const password = 'Fixture-account-security-2026!'
test.skip(!features.emailPassword, 'Requires selected local email authentication')

async function register(request: APIRequestContext) {
  const email = `security-${randomUUID()}@example.test`
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Security fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const messages = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  const mail = messages.find((message) => message.recipient === email)
  expect(mail).toBeTruthy()
  await request.get(mail!.url)
  expect(
    (
      await request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200)
  return email
}

test('account security scopes sessions, revokes access and rotates the current cookie on password change', async ({
  request,
  playwright,
}) => {
  expect((await request.get('/api/account/security')).status()).toBe(401)
  const email = await register(request)
  const clients: APIRequestContext[] = []
  const client = async (state?: Awaited<ReturnType<APIRequestContext['storageState']>>) => {
    const context = await playwright.request.newContext({
      baseURL: origin,
      storageState: state,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'cf-connecting-ip':
          'fd00:' +
          randomUUID()
            .replaceAll('-', '')
            .match(/.{1,4}/g)!
            .slice(0, 7)
            .join(':'),
      },
    })
    clients.push(context)
    return context
  }
  const login = async (context: APIRequestContext, secret = password) =>
    context.post('/api/auth/sign-in/email', {
      headers: { origin },
      data: { email, password: secret },
    })
  const state = async () =>
    (await (await request.get('/api/account/security')).json()) as AccountSecurity
  try {
    const other = await client()
    expect((await login(other)).status()).toBe(200)
    const stranger = await client()
    await register(stranger)
    const foreign = (await (await stranger.get('/api/account/security')).json()) as AccountSecurity
    let security = await state()
    expect(security.canChangePassword).toBe(true)
    expect(security.sessions).toHaveLength(2)
    for (const session of security.sessions) {
      expect(Object.keys(session).sort()).toEqual(
        ['id', 'current', 'browser', 'platform', 'createdAt', 'updatedAt', 'expiresAt'].sort(),
      )
    }
    const currentId = security.sessions.find((session) => session.current)!.id
    const otherId = security.sessions.find((session) => !session.current)!.id
    expect(
      (
        await request.delete(`/api/account/sessions/${foreign.sessions[0]!.id}`, {
          headers: { origin },
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await request.delete(`/api/account/sessions/${currentId}`, { headers: { origin } })
      ).status(),
    ).toBe(409)
    expect(
      (
        await request.post('/api/account/sessions/revoke-others', {
          headers: { origin: 'https://foreign.example' },
        })
      ).status(),
    ).toBe(403)
    expect(
      (await request.delete(`/api/account/sessions/${otherId}`, { headers: { origin } })).status(),
    ).toBe(200)
    expect((await other.get('/api/account/security')).status()).toBe(401)
    expect((await stranger.get('/api/account/security')).status()).toBe(200)

    expect((await login(other)).status()).toBe(200)
    const third = await client()
    expect((await login(third)).status()).toBe(200)
    expect(
      (await request.post('/api/account/sessions/revoke-others', { headers: { origin } })).status(),
    ).toBe(200)
    expect((await other.get('/api/account/security')).status()).toBe(401)
    expect((await third.get('/api/account/security')).status()).toBe(401)
    expect((await state()).sessions[0]!.id).toBe(currentId)

    expect((await login(other)).status()).toBe(200)
    const previousCookie = await client(await request.storageState())
    const nextPassword = password + '-new'
    expect(
      (
        await request.post('/api/account/password', {
          headers: { origin },
          data: { currentPassword: 'wrong-fixture-password', newPassword: nextPassword },
        })
      ).status(),
    ).toBe(400)
    expect((await other.get('/api/account/security')).status()).toBe(200)
    expect(
      (
        await request.post('/api/account/password', {
          headers: { origin },
          data: {
            currentPassword: password,
            newPassword: nextPassword,
            revokeOtherSessions: false,
          },
        })
      ).status(),
    ).toBe(400)
    const changed = await request.post('/api/account/password', {
      headers: { origin },
      data: { currentPassword: password, newPassword: nextPassword },
    })
    expect(changed.status(), await changed.text()).toBe(200)
    expect(await changed.json()).toEqual({ ok: true })
    expect(changed.headers()['set-cookie']).toContain('HttpOnly')
    security = await state()
    expect(security.sessions).toHaveLength(1)
    expect(security.sessions[0]!.current).toBe(true)
    expect(security.sessions[0]!.id).not.toBe(currentId)
    expect((await other.get('/api/account/security')).status()).toBe(401)
    expect((await previousCookie.get('/api/account/security')).status()).toBe(401)
    expect((await stranger.get('/api/account/security')).status()).toBe(200)
    expect((await login(other)).status()).toBe(401)
    expect((await login(other, nextPassword)).status()).toBe(200)
    expect((await request.get('/api/auth/list-sessions')).status()).toBe(404)
    for (const path of [
      'change-password',
      'set-password',
      'revoke-session',
      'revoke-sessions',
      'revoke-other-sessions',
    ]) {
      expect(
        (
          await request.post(`/api/auth/${path}`, {
            headers: { origin },
            data: {
              currentPassword: nextPassword,
              newPassword: password,
              token: 'fixture-not-a-session',
            },
          })
        ).status(),
      ).toBe(404)
    }
  } finally {
    await Promise.all(clients.map((context) => context.dispose()))
  }
})

test('security settings support validation, confirmation, password changes and mobile layout', async ({
  page,
  request,
  playwright,
}) => {
  const email = await register(request)
  await page.context().addCookies((await request.storageState()).cookies)
  await page.goto('/zh/app/settings')
  const other = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:8888:1111:2222:3333:4444:5555:6666' },
  })
  try {
    expect(
      (
        await other.post('/api/auth/sign-in/email', {
          headers: { origin },
          data: { email, password },
        })
      ).status(),
    ).toBe(200)
    await page.getByRole('button', { name: '刷新设备', exact: true }).click()
    await expect(page.getByText('当前设备', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '退出其他设备', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '退出其他设备？' })
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    expect((await other.get('/api/account/security')).status()).toBe(200)
    await page.getByRole('button', { name: '退出其他设备', exact: true }).click()
    await dialog.getByRole('button', { name: '确认退出', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('选定会话已结束')
    expect((await other.get('/api/account/security')).status()).toBe(401)
    await page.getByLabel('当前密码', { exact: true }).fill(password)
    await page.getByLabel('新密码', { exact: true }).fill(password + '-new')
    await page.getByLabel('确认新密码', { exact: true }).fill(password + '-different')
    await page.getByRole('button', { name: '修改密码', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('两次输入的新密码不一致。')
    await page.getByLabel('确认新密码', { exact: true }).fill(password + '-new')
    await page.getByRole('button', { name: '修改密码', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '密码已修改' })).toBeVisible()
    await expect(page.getByLabel('当前密码', { exact: true })).toHaveValue('')
    await page.reload()
    await expect(page.getByText('当前设备', { exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Account settings', exact: true })).toBeVisible()
    await expect(page.getByLabel('Current password', { exact: true })).toBeVisible()
    await expect(page.getByText('This device', { exact: true })).toBeVisible()
  } finally {
    await other.dispose()
  }
})

test('security error and empty states recover without showing password controls for a non-password fixture', async ({
  page,
  request,
}) => {
  await register(request)
  await page.context().addCookies((await request.storageState()).cookies)
  let recover = false
  // View-state fixture only; server-side no-password/Google-only authorization is tested against D1.
  await page.route('**/api/account/security', async (route) => {
    await route.fulfill({
      status: recover ? 200 : 503,
      json: recover
        ? { canChangePassword: false, sessions: [], hasMore: false }
        : { error: 'Fixture security unavailable.' },
    })
  })
  await page.goto('/app/settings')
  await expect(page.getByRole('alert').first()).toHaveText('Fixture security unavailable.')
  recover = true
  await page.getByRole('button', { name: 'Refresh devices', exact: true }).click()
  await expect(
    page.getByText('No active sessions to show. Refresh or sign in again.'),
  ).toBeVisible()
  await expect(
    page.getByText(
      'This account has no available password login. Continue using your existing sign-in method.',
    ),
  ).toBeVisible()
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Sign out other devices', exact: true }),
  ).toBeDisabled()
})
