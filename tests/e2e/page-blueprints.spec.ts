import { test, expect } from './fixtures'

test('product blueprint explains its boundary, previews a brief, supports keyboard FAQ and resets on reload', async ({
  page,
}) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/'))
      writes.push(request.url())
  })
  await page.goto('/dev/ui')
  await page.getByRole('link', { name: 'Page blueprints', exact: true }).click()
  await expect(page.getByRole('note')).toContainText('fictional')
  await page.getByRole('button', { name: 'Try the local demo', exact: true }).first().click()
  await expect(page.getByLabel('Working title', { exact: true })).toBeFocused()
  await page.getByLabel('Working title', { exact: true }).fill('   ')
  await page.getByLabel('Who is it for?', { exact: true }).fill('Readers')
  await page.getByLabel('What should they achieve?', { exact: true }).fill('Find a saved note')
  await page.getByRole('button', { name: 'Preview my brief', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('meaningful text')
  await page.getByLabel('Working title', { exact: true }).fill('My reading shelf')
  await page.getByRole('button', { name: 'Preview my brief', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('My reading shelf')
  await expect(page.getByRole('status')).toContainText('not saved')
  const question = page.locator('summary').filter({ hasText: 'Does this preview save my answers?' })
  await question.focus()
  await question.press('Enter')
  await expect(question.locator('..')).toHaveAttribute('open', '')
  await question.press('Enter')
  await expect(question.locator('..')).not.toHaveAttribute('open', '')
  await page.reload()
  await expect(page.getByLabel('Working title', { exact: true })).toHaveValue('')
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(writes).toEqual([])
})

test('directory blueprint connects search, category, reading, related content and temporary contribution', async ({
  page,
}) => {
  await page.goto('/dev/blueprints?kind=directory')
  await expect(page.getByRole('status')).toHaveText('4 sample resources')
  await page.getByRole('combobox', { name: 'Category', exact: true }).click()
  await page.getByRole('option', { name: 'Research', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('1 sample resources')
  await page.getByRole('button', { name: 'Read Margin Index', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Margin Index', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'On this page', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'How to evaluate it', exact: true }).click()
  await expect(page).toHaveURL(/#directory-use$/)
  await page.getByRole('button', { name: 'Pebble Notes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pebble Notes', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to directory', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Search sample resources', exact: true })
    .fill('no-matching-entry')
  await expect(
    page.getByRole('heading', { name: 'No matching resources', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.getByRole('button', { name: 'Add a sample resource', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a sample resource', exact: true })
  await dialog.getByLabel('Resource name', { exact: true }).fill('Resource'.repeat(9))
  await dialog
    .getByLabel('Short description', { exact: true })
    .fill('A fictional submission used only in this preview.')
  await dialog.getByRole('button', { name: 'Add to preview', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('5 sample resources')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Read ' + 'Resource'.repeat(9), exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Resource'.repeat(9), exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('4 sample resources')
  await expect(
    page.getByRole('button', { name: 'Read ' + 'Resource'.repeat(9), exact: true }),
  ).toHaveCount(0)
})

test('workbench blueprint edits sample records, guides creation and recovers from preview states', async ({
  page,
}) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/'))
      writes.push(request.url())
  })
  await page.goto('/dev/blueprints?kind=workbench')
  const detail = page.getByRole('region', { name: 'Review the product page content', exact: true })
  await detail.getByLabel('Notes', { exact: true }).fill('Revised preview notes')
  await detail.getByRole('button', { name: 'Apply notes to preview', exact: true }).click()
  await detail.getByRole('combobox', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Done', exact: true }).click()
  await expect(
    page.getByRole('progressbar', { name: 'Completed sample records', exact: true }),
  ).toHaveAttribute('aria-valuenow', '2')
  await page
    .getByRole('button', { name: 'Open task: Agree on the first user flow', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Open task: Review the product page content', exact: true })
    .click()
  await expect(detail.getByLabel('Notes', { exact: true })).toHaveValue('Revised preview notes')
  await page.getByRole('button', { name: 'New sample task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New sample task', exact: true })
  await dialog
    .getByLabel('Task name', { exact: true })
    .fill('Check a very long sample title with no external account required')
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(dialog).toContainText('Step 2 of 2')
  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(dialog.getByLabel('Task name', { exact: true })).toHaveValue(
    'Check a very long sample title with no external account required',
  )
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  await dialog
    .getByLabel('Notes', { exact: true })
    .fill('These are temporary notes, not a saved project.')
  await dialog.getByRole('button', { name: 'Create in preview', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Sample task created')
  await page.getByRole('combobox', { name: 'Preview state', exact: true }).click()
  await page.getByRole('option', { name: 'Error preview', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Simulated loading failure')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('combobox', { name: 'Preview state', exact: true }).click()
  await page.getByRole('option', { name: 'Empty preview', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No tasks in this view', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole('progressbar', { name: 'Completed sample records', exact: true }),
  ).toHaveAttribute('aria-valuenow', '1')
  await expect(
    page.getByRole('button', {
      name: 'Open task: Check a very long sample title with no external account required',
      exact: true,
    }),
  ).toHaveCount(0)
  expect(writes).toEqual([])
})

test('all blueprint compositions preserve locale, mobile geometry and both themes without hydration errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const kind of ['product', 'directory', 'workbench']) {
    await page.goto('/zh/dev/blueprints?kind=' + kind)
    await expect(page.getByRole('heading', { name: '页面蓝图', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
    await expect(page).toHaveURL(new RegExp('/dev/blueprints\\?kind=' + kind + '$'))
    await expect(page.getByRole('heading', { name: 'Page blueprints', exact: true })).toBeVisible()
    await expect(
      page.getByRole('tab', {
        name:
          kind === 'product'
            ? 'Product website'
            : kind === 'directory'
              ? 'Directory & reading'
              : 'Data workbench',
        exact: true,
      }),
    ).toHaveAttribute('aria-selected', 'true')
  }
  expect(errors).toEqual([])
})

test('Catalog and Sage preview themes persist through navigation, preserve controls and demo commerce stays local', async ({
  page,
}) => {
  const writes: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.url())
  })
  await page.goto('/dev/blueprints?kind=shop&_style=catalog')
  await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'catalog')
  await expect(
    page.getByRole('heading', { name: 'Small things. More room for everyday life.', exact: true }),
  ).toBeVisible()
  const theme = page.getByRole('combobox', { name: 'Visual theme · local preview', exact: true })
  await expect(theme).toBeEnabled()
  const sizes = await Promise.all(
    [theme, page.getByRole('textbox', { name: 'Search sample products', exact: true })].map((el) =>
      el.evaluate((node) => Math.round(node.getBoundingClientRect().height)),
    ),
  )
  expect(sizes).toEqual([36, 36])
  await page
    .getByRole('textbox', { name: 'Search sample products', exact: true })
    .fill('no matching object')
  await expect(page.getByRole('status')).toContainText('No sample products match')
  await page.getByRole('textbox', { name: 'Search sample products', exact: true }).fill('lamp')
  await page.getByRole('button', { name: 'View product: Reading lamp', exact: true }).click()
  await page.getByRole('button', { name: 'Preview purchase information', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('No cart, order, reservation or payment')
  await page.getByRole('button', { name: 'Back to collection', exact: true }).click()
  await page.getByRole('tab', { name: 'Product website', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'catalog')
  await page.getByRole('button', { name: '切换中文', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'catalog')
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('combobox', { name: '视觉主题 · 本地预览', exact: true }).click()
  await page.getByRole('option', { name: 'Sage · 工具与 SaaS', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-visual-theme', 'sage')
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(writes).toEqual([])
})
