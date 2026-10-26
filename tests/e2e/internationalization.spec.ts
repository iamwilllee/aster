import { origin } from './origin'
import { test, expect, features } from './fixtures'
import { randomUUID } from 'node:crypto'
const password = 'Fixture-only-password-2026!'

test('English default, localized links, reload, history and canonical metadata', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const english = await request.get('/')
  const chinese = await request.get('/zh')
  expect(await english.text()).toContain('lang="en"')
  expect(await chinese.text()).toContain('lang="zh-CN"')
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: '切换中文' }).click()
  await expect(page).toHaveURL(origin + '/zh')
  const chinesePath = features.billing ? '/zh/pricing' : '/zh'
  const englishPath = features.billing ? '/pricing' : '/'
  if (features.billing) await page.getByRole('link', { name: '套餐', exact: true }).click()
  else {
    await expect(page.getByRole('link', { name: '套餐', exact: true })).toHaveCount(0)
    expect((await request.get('/pricing')).status()).toBe(404)
  }
  await expect(page).toHaveURL(origin + chinesePath)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + chinesePath)
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', origin + englishPath)
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page).toHaveURL(origin + englishPath)
  await page.goBack()
  await expect(page).toHaveURL(origin + chinesePath)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  expect(errors).toEqual([])
})
test('resends verification, shows cooldown, and hides optional Google without credentials', async ({
  page,
  request,
}) => {
  test.skip(!features.emailPassword, 'Email authentication is not selected')
  const email = `resend-${randomUUID()}@example.test`
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Resend fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0)
  await expect(page.getByText('Google sign-in is not configured')).toHaveCount(0)
  await page.getByLabel('Resend verification email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Resend verification email', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('a new link will be sent')
  await expect(page.getByRole('button', { name: /Try again in \d+s/ })).toBeDisabled()
  const second = await request.post('/api/auth/send-verification-email', {
    headers: { origin },
    data: { email },
  })
  expect(second.status()).toBe(429)
  expect(second.headers()['retry-after']).toBe('60')
  const messages = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    subject: string
    url: string
  }[]
  const mail = messages.find((item) => item.recipient === email)
  expect(mail?.subject).toContain('Verify')
  await page.goto(mail!.url)
  await expect(page).toHaveURL(/\/login\?verified/)
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Resend fixture.' })).toBeVisible()
})
test('concurrent resends allow one request per recipient and normalize address casing', async ({
  request,
}) => {
  test.skip(!features.emailPassword, 'Email authentication is not selected')
  const email = `race-${randomUUID()}@example.test`
  const post = (address: string) =>
    request.post('/api/auth/send-verification-email', {
      headers: { origin },
      data: { email: address },
    })
  const results = await Promise.all([post(email), post(email.toUpperCase())])
  expect(results.map((result) => result.status()).sort()).toEqual([200, 429])
  expect(
    (
      await request.post('/api/auth/send-verification-email', {
        headers: { origin: 'https://untrusted.example' },
        data: { email },
      })
    ).status(),
  ).toBe(403)
})

test('Chinese signup, verification callback, localized mail and session refresh remain Chinese', async ({
  page,
  request,
}) => {
  test.skip(!features.emailPassword, 'Email authentication is not selected')
  const email = `zh-${randomUUID()}@example.test`
  await page.goto('/zh/signup')
  await page.getByLabel('你的称呼', { exact: true }).fill('中文账户')
  await page.getByLabel('邮箱地址', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '创建账户', exact: true }).click()
  await expect(page.getByRole('heading', { name: '请检查你的邮箱' })).toBeVisible()
  await expect(page.getByLabel('重新发送验证邮件', { exact: true })).toHaveValue(email)
  const messages = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    subject: string
    url: string
  }[]
  const mail = messages.find((item) => item.recipient === email)
  expect(mail?.subject).toContain('验证')
  await page.goto(mail!.url)
  await expect(page).toHaveURL(/\/zh\/login\?verified/)
  await expect(page.getByText('邮箱已验证，现在可以登录。', { exact: true })).toBeVisible()
  await page.getByLabel('邮箱地址', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录工作空间', exact: true }).click()
  await expect(page.getByRole('heading', { name: '你好，中文账户。' })).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('heading', { name: '你好，中文账户。' })).toBeVisible()
})
