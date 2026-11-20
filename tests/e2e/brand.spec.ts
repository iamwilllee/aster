import { test, expect } from './fixtures'
import { brand } from '../../src/config/brand'

// Read the product config so generated products validate their own identity.
for (const { path, dark, width } of [
  { path: '/', dark: false, width: 1280 },
  { path: '/zh', dark: true, width: 390 },
]) {
  test(`brand assets load with navigation geometry: ${path}, dark=${dark}, width=${width}`, async ({
    page,
    request,
  }) => {
    for (const asset of [
      brand.icon,
      brand.iconDark,
      brand.favicon.href,
      brand.appleTouchIcon,
    ].filter((value): value is string => Boolean(value))) {
      const response = await request.get(asset)
      expect(response.ok(), asset).toBeTruthy()
      expect(response.headers()['content-type'], asset).toMatch(/image\//)
    }
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(
      (isDark) => localStorage.setItem('starter-theme', isDark ? 'dark' : 'light'),
      dark,
    )
    await page.goto(path)
    if (dark) await expect(page.locator('html')).toHaveClass(/dark/)
    else await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', brand.favicon.href)
    if (brand.appleTouchIcon)
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
        'href',
        brand.appleTouchIcon,
      )
    else await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(0)
    const icon = page
      .locator(`img[src="${dark && brand.iconDark ? brand.iconDark : brand.icon}"]:visible`)
      .first()
    await expect(icon).toBeVisible()
    await expect
      .poll(() =>
        icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
    const box = await icon.boundingBox()
    expect(box?.width).toBe(32)
    expect(box?.height).toBe(32)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })
}
