import { test, expect } from './fixtures'

test('keyboard users can skip past the header, and each page has one main landmark', async ({
  page,
}) => {
  for (const path of ['/', '/pricing', '/login', '/zh', '/zh/login', '/missing-page']) {
    await page.goto(path)
    // Pages the selected capabilities close show the not-found page; it still has a landmark.
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.locator('main')).toHaveAttribute('id', 'main-content')
  }
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to main content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main-content$/)
  await expect(page.locator('main')).toBeFocused()
})

test('the skip link is hidden until it has focus and speaks the page language', async ({
  page,
}) => {
  await page.goto('/zh')
  const skip = page.getByRole('link', { name: '跳到主要内容' })
  await expect(skip).toBeAttached()
  const hidden = await skip.evaluate((element) => element.getBoundingClientRect().width)
  expect(hidden).toBeLessThanOrEqual(1)
  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
  expect(await skip.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(
    40,
  )
})

test('public pages carry link-preview tags and private pages do not', async ({ page }) => {
  await page.goto('/')
  const content = (selector: string) => page.locator(selector).getAttribute('content')
  expect(await content('meta[property="og:title"]')).toContain('Aster')
  expect(await content('meta[property="og:type"]')).toBe('website')
  expect(await content('meta[property="og:url"]')).toMatch(/^https?:\/\/[^/]+\/?$/)
  expect(await content('meta[name="twitter:card"]')).toMatch(/^summary/)
  await page.goto('/zh')
  expect(await content('meta[property="og:locale"]')).toBe('zh_CN')
  await page.goto('/login')
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(0)
})
