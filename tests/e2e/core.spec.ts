import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
import { randomUUID } from 'node:crypto'

const origin = 'http://127.0.0.1:3100'
const password = 'Fixture-only-password-2026!'
test.skip(
  !features.emailPassword || !features.projects,
  'Requires selected email authentication and projects',
)

interface Mail {
  recipient: string
  subject: string
  url: string
}
async function account(request: APIRequestContext) {
  const email = `qa-${randomUUID()}@example.test`
  const signup = await request.post('/api/auth/sign-up/email', {
    headers: { origin },
    data: { name: '测试开发者', email, password },
  })
  expect(signup.status(), await signup.text()).toBe(200)
  const unverified = await request.post('/api/auth/sign-in/email', {
    headers: { origin },
    data: { email, password },
  })
  expect(unverified.status()).toBe(403)
  const messages = await request.get('/api/dev/mail')
  const mail = ((await messages.json()) as Mail[]).find((item) => item.recipient === email)
  expect(mail).toBeTruthy()
  const verification = await request.get(mail!.url)
  expect(verification.ok()).toBe(true)
  const login = await request.post('/api/auth/sign-in/email', {
    headers: { origin },
    data: { email, password },
  })
  expect(login.status(), await login.text()).toBe(200)
  return { email, password }
}

test('registration, verification, projects, quota, isolation, CSRF and session revocation', async ({
  request,
  playwright,
}) => {
  const user = await account(request)
  const create = (name: string) =>
    request.post('/api/projects', {
      headers: { origin },
      data: { name, description: '真实 D1 数据', status: 'idea' },
    })
  const created = await create('一个测试项目')
  expect(created.status(), await created.text()).toBe(201)
  const project = (await created.json()) as { id: string }
  const update = await request.patch(`/api/projects/${project.id}`, {
    headers: { origin },
    data: { name: '更新后的项目', description: '持久化检查', status: 'building' },
  })
  expect(update.status()).toBe(200)
  const found = await request.get('/api/projects?q=更新&status=building')
  expect(await found.json()).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: project.id, name: '更新后的项目' })]),
  )
  const other = await playwright.request.newContext({
    baseURL: origin,
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
  await account(other)
  expect(
    (
      await other.patch(`/api/projects/${project.id}`, {
        headers: { origin },
        data: { name: '越权', status: 'live' },
      })
    ).status(),
  ).toBe(404)
  expect(
    (await other.delete(`/api/projects/${project.id}`, { headers: { origin } })).status(),
  ).toBe(404)
  expect(await (await other.get('/api/projects')).json()).toEqual([])
  expect((await request.get('/api/admin/users')).status()).toBe(403)
  expect(
    (
      await request.post('/api/projects', {
        headers: { origin: 'https://evil.example' },
        data: { name: 'CSRF' },
      })
    ).status(),
  ).toBe(403)
  const concurrent = await Promise.all([
    create('并发 A'),
    create('并发 B'),
    create('并发 C'),
    create('并发 D'),
  ])
  expect(concurrent.map((response) => response.status()).sort()).toEqual([201, 201, 409, 409])
  expect((await request.post('/api/billing/checkout', { headers: { origin } })).status()).toBe(
    features.billing ? 503 : 404,
  )
  expect((await request.get('/api/billing/checkout-status?id=unrelated')).status()).toBe(404)
  const reset = await request.post('/api/auth/request-password-reset', {
    headers: { origin },
    data: { email: user.email, redirectTo: '/reset-password' },
  })
  expect(reset.status()).toBe(200)
  const mail = ((await (await request.get('/api/dev/mail')).json()) as Mail[]).find(
    (item) => item.recipient === user.email && item.subject.includes('Reset'),
  )
  expect(mail).toBeTruthy()
  const tokenURL = new URL((await request.get(mail!.url, { maxRedirects: 0 })).headers().location!)
  const token = tokenURL.searchParams.get('token')
  expect(token).toBeTruthy()
  expect(
    (
      await request.post('/api/auth/reset-password', {
        headers: { origin },
        data: { token, newPassword: `${password}-new` },
      })
    ).status(),
  ).toBe(200)
  expect((await request.get('/api/projects')).status()).toBe(401)
  await other.dispose()
})

test('browser workflow: sign in, create, edit, reload, filter, settings, delete, mobile', async ({
  page,
  request,
}) => {
  const user = await account(request)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh/login')
  await page.getByLabel('邮箱地址', { exact: true }).fill(user.email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录工作空间' }).click()
  await expect(page.getByRole('heading', { name: '你好，测试开发者。' })).toBeVisible()
  await page.getByRole('link', { name: '我的项目', exact: true }).click()
  const search = page.getByLabel('搜索项目', { exact: true })
  const filter = page.getByRole('combobox', { name: '筛选项目状态', exact: true })
  for (const control of [search, filter, page.getByRole('button', { name: '新建项目' })])
    expect(await control.evaluate((node) => node.getBoundingClientRect().height)).toBe(36)
  await expect(page.locator('select:visible')).toHaveCount(0)
  await page.getByRole('button', { name: '新建项目' }).click()
  await page.getByLabel('项目名称', { exact: true }).fill('浏览器保存测试')
  await page.getByLabel('一句话描述').fill('刷新后也应保留')
  await page.getByRole('button', { name: '保存项目' }).click()
  await expect(page.getByRole('heading', { name: '浏览器保存测试' })).toBeVisible()
  await page.getByRole('button', { name: '编辑 浏览器保存测试' }).click()
  await page.getByLabel('项目名称', { exact: true }).fill('已编辑的想法')
  const editorStatus = page.getByRole('combobox', { name: '当前状态', exact: true })
  await editorStatus.click()
  await page.getByRole('option', { name: '开发中', exact: true }).click()
  await page.getByRole('button', { name: '保存项目' }).click()
  await expect(page.getByRole('heading', { name: '已编辑的想法' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '已编辑的想法' })).toBeVisible()
  await page.getByRole('button', { name: '编辑 已编辑的想法' }).click()
  await expect(editorStatus).toHaveText('开发中')
  expect(await editorStatus.evaluate((node) => node.getBoundingClientRect().height)).toBe(36)
  expect(
    await page
      .getByLabel('项目名称', { exact: true })
      .evaluate((node) => node.getBoundingClientRect().height),
  ).toBe(36)
  await page.getByRole('button', { name: '取消', exact: true }).click()
  // A custom popup must preserve keyboard dismissal and URL/refresh behavior.
  await filter.focus()
  await filter.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(filter).toBeFocused()
  await filter.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(page.getByRole('option', { name: '全部状态', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('option', { name: '已上线', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/status=live/)
  await page.reload()
  await expect(filter).toHaveText('已上线')
  await expect(page.getByRole('heading', { name: '没有找到匹配的项目' })).toBeVisible()
  await filter.click()
  await page.getByRole('option', { name: '全部状态', exact: true }).click()
  await expect(page.getByRole('heading', { name: '已编辑的想法' })).toBeVisible()
  await page.getByLabel('搜索项目', { exact: true }).fill('不存在')
  await expect(page.getByRole('heading', { name: '没有找到匹配的项目' })).toBeVisible()
  await page.getByLabel('搜索项目', { exact: true }).fill('')
  await page.getByRole('tab', { name: '表格', exact: true }).click()
  await expect(page).toHaveURL(/view=table/)
  const table = page.getByRole('table', { name: '我的项目' })
  await expect(table.getByRole('button', { name: '已编辑的想法', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: '表格', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await table.getByRole('button', { name: '已编辑的想法', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '已编辑的想法', exact: true })
  await expect(detail.getByText('刷新后也应保留', { exact: true })).toBeVisible()
  await expect(detail.getByText('开发中', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(table.getByRole('button', { name: '已编辑的想法', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  const actions = page.getByRole('button', { name: '已编辑的想法 的操作', exact: true })
  await actions.focus()
  await actions.press('ArrowDown')
  await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '编辑项目' })).toBeVisible()
  await expect(page.getByLabel('项目名称', { exact: true })).toHaveValue('已编辑的想法')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('tab', { name: '卡片', exact: true }).click()
  // Saving the profile must remain observable while independent security queries load.
  let releaseSecurity = () => {}
  const securityReady = new Promise<void>((resolve) => {
    releaseSecurity = resolve
  })
  await page.route('**/api/account/security', async (route) => {
    await securityReady
    await route.continue()
  })
  const securityLoading = page.getByRole('status', {
    name: '正在加载账号安全信息…',
    exact: true,
  })
  try {
    await page.getByRole('link', { name: '账户设置', exact: true }).click()
    await expect(securityLoading).toHaveCount(2)
    await page.getByLabel('你的称呼').fill('已经保存的称呼')
    await page.getByRole('button', { name: '保存修改' }).click()
    await expect(
      page.getByRole('region', { name: '个人资料', exact: true }).getByRole('status'),
    ).toHaveText('个人资料已保存')
    await expect(securityLoading).toHaveCount(2)
  } finally {
    releaseSecurity()
  }
  await expect(securityLoading).toHaveCount(0)
  await page.unroute('**/api/account/security')
  await page.reload()
  await expect(page.getByLabel('你的称呼')).toHaveValue('已经保存的称呼')
  await page.getByRole('link', { name: '我的项目', exact: true }).click()
  await page.getByRole('button', { name: '删除 已编辑的想法' }).click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByRole('heading', { name: '你的第一个项目，等你开始' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开导航', exact: true }).click()
  if (features.billing) {
    await page.getByRole('link', { name: '套餐与账单', exact: true }).click()
    await expect(page.getByRole('heading', { name: '套餐与账单' })).toBeVisible()
    await expect(page.getByRole('button', { name: '支付未配置', exact: true })).toBeDisabled()
  } else {
    await expect(page.getByRole('link', { name: '套餐与账单', exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: '账户设置', exact: true }).click()
    await expect(page.getByRole('heading', { name: '账户设置' })).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: '切换明暗主题' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(
    page.getByRole('heading', { name: features.billing ? 'Plan & billing' : 'Account settings' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.request.get('/api/projects')).status()).toBe(401)
  expect(errors).toEqual([])
})
