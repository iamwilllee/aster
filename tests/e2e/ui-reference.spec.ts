import { test, expect } from './fixtures'

test('tabs wait for hydration before accepting the first interaction', async ({ page }) => {
  let releaseScripts = () => {}
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve
  })
  let blockedScripts = 0
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      blockedScripts += 1
      await scriptsReady
    }
    await route.continue()
  })
  try {
    await page.goto('/dev/ui', { waitUntil: 'commit' })
    await expect(
      page.getByRole('heading', { name: 'Component reference', exact: true }),
    ).toBeVisible()
    await expect.poll(() => blockedScripts).toBeGreaterThan(0)
    const design = page.getByRole('tab', { name: 'Design direction', exact: true })
    await expect(design).toBeDisabled()
    releaseScripts()
    await expect(design).toBeEnabled()
    await design.click()
    await expect(design).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Make space for a good idea.' })).toBeVisible()
  } finally {
    releaseScripts()
  }
})

test('local component reference preserves size, disabled, dialog, theme and mobile contracts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh/dev/ui')
  await expect(page.getByRole('heading', { name: '组件样板', exact: true })).toBeVisible()
  for (const [size, height] of [
    ['sm', 32],
    ['default', 40],
    ['lg', 48],
  ] as const) {
    const controls = page
      .locator(`[data-ui-row="${size}"]`)
      .locator('[data-slot="input"], [data-slot="select-trigger"], [data-slot="button"]')
    await expect(controls).toHaveCount(3)
    expect(
      await controls.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      ),
    ).toEqual([height, height, height])
    const bottoms = await controls.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().bottom),
    )
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1)
  }
  await expect(page.getByLabel('禁用输入框', { exact: true })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: '禁用下拉框', exact: true })).toBeDisabled()
  await expect(page.getByLabel('输入错误状态')).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: '切换禁用状态', exact: true }).click()
  await expect(page.getByRole('button', { name: '主要操作', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '打开弹窗', exact: true }).nth(1).click()
  const dialog = page.getByRole('dialog', { name: '表单交互示例' })
  await dialog.getByLabel('项目名称', { exact: true }).fill('Local demo')
  await dialog.getByRole('combobox', { name: '当前状态', exact: true }).click()
  await page.getByRole('option', { name: '开发中', exact: true }).click()
  await dialog.getByRole('button', { name: '提交演示', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('演示已提交，没有创建项目或写入服务端。')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('打开上方弹窗，体验完整表单。')
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/ui$/)
  await expect(
    page.getByRole('heading', { name: 'Component reference', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('new primitives support keyboard actions, disabled choices and dismissible feedback', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh/dev/ui')
  const checkbox = page.getByRole('checkbox', { name: '在预览中包含此项', exact: true })
  await expect(checkbox).toBeEnabled()
  await checkbox.focus()
  await checkbox.press('Space')
  await expect(checkbox).toBeChecked()
  const toggle = page.getByRole('switch', { name: '展示预览详情', exact: true })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: '不可用的选项' })).toBeDisabled()
  await expect(page.getByRole('switch', { name: '不可用的设置' })).toBeDisabled()
  const tooltip = page.getByRole('button', { name: '关于预览控件' })
  await toggle.focus()
  await toggle.press('Tab')
  await page.keyboard.press('Tab')
  await expect(tooltip).toBeFocused()
  await expect(page.getByRole('tooltip')).toHaveText('提示补充说明，按钮本身仍保留可访问名称。')
  await expect(tooltip).toHaveAccessibleDescription('提示补充说明，按钮本身仍保留可访问名称。')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).not.toBeVisible()
  const trigger = page.getByRole('button', { name: '打开操作菜单' })
  await trigger.focus()
  await trigger.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: '暂不可用的操作' })).toBeDisabled()
  const item = page.getByRole('menuitem', { name: '显示通知', exact: true })
  await expect(item).toBeFocused()
  await item.press('Enter')
  await expect(page.getByText('预览操作已完成', { exact: true })).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.getByRole('button', { name: '关闭通知', exact: true }).click()
  await expect(page.getByText('预览操作已完成', { exact: true })).not.toBeVisible()
  await page.reload()
  await expect(checkbox).not.toBeChecked()
  await expect(toggle).toBeChecked()
  expect(errors).toEqual([])
})

test('page patterns cover pagination, details, search, failure recovery and mobile layouts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh/dev/ui')
  await expect(page.getByRole('button', { name: '切换明暗主题' })).toBeEnabled()
  await page.getByRole('tab', { name: '基础组件', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '页面组合', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: '页面组合', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('第 1 / 3 页 · 共 7 条', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '上一页' })).toBeDisabled()
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('示例记录 04', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看 示例记录 04 的详情', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '示例记录 04', exact: true })
  await expect(detail.getByText(/详情面板容纳完整内容/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '查看 示例记录 04 的详情' })).toBeFocused()
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('第 3 / 3 页 · 共 7 条', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled()
  await page.getByRole('textbox', { name: '搜索示例记录', exact: true }).fill('no-match')
  await expect(page.getByRole('heading', { name: '没有找到匹配的项目' })).toBeVisible()
  await page.getByRole('button', { name: '清空搜索' }).click()
  await expect(page.getByText('第 1 / 3 页 · 共 7 条', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '加载', exact: true }).click()
  await expect(page.getByRole('status', { name: '正在加载…', exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible()
  await page.getByRole('tab', { name: '错误', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('模拟请求失败')
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('tab', { name: '就绪', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '切换明暗主题' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('tab', { name: '视觉方向', exact: true }).click()
  await expect(page.getByRole('heading', { name: '给好想法，留一点空间。' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page).toHaveURL(/\/dev\/ui$/)
  await expect(
    page.getByRole('heading', { name: 'Component reference', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Design direction', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Design direction', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('heading', { name: 'Make space for a good idea.' })).toBeVisible()
  expect(errors).toEqual([])
})
