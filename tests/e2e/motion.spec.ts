import { test, expect } from './fixtures'

function observedMotion(element: HTMLElement | SVGElement) {
  const records = Reflect.get(window, '__asterMotionEvents') as
    { target: Element; delay: number }[] | undefined
  const own = records?.filter((record) => record.target === element) ?? []
  return { count: own.length, delay: own.at(-1)?.delay ?? -1 }
}

test('entrances animate in order, settle without text transforms and reveal scrolling content once', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    // Keep instrumentation outside React's DOM: attributes written before hydration
    // would themselves introduce a hydration mismatch.
    const records: { target: Element; delay: number }[] = []
    Object.defineProperty(window, '__asterMotionEvents', { value: records })
    document.addEventListener('animationstart', (event) => {
      if (event.animationName !== 'aster-reveal' || !(event.target instanceof HTMLElement)) return
      records.push({
        target: event.target,
        delay: Number.parseFloat(getComputedStyle(event.target).animationDelay),
      })
    })
  })
  await page.goto('/')
  const heading = page.locator('h1')
  const copy = page
    .locator('main [data-reveal="enter"]')
    .filter({ hasText: 'A considered starting point' })
  await expect.poll(async () => (await heading.evaluate(observedMotion)).count).toBe(1)
  await expect.poll(async () => (await copy.evaluate(observedMotion)).count).toBe(1)
  const headingDelay = (await heading.evaluate(observedMotion)).delay
  const copyDelay = (await copy.evaluate(observedMotion)).delay
  expect(copyDelay).toBeGreaterThan(headingDelay)
  const actions = page.locator('main [data-reveal-step="3"]')
  const display = page.locator('main [data-reveal="enter"]').last()
  await expect.poll(async () => (await actions.evaluate(observedMotion)).count).toBe(1)
  await expect.poll(async () => (await display.evaluate(observedMotion)).count).toBe(1)
  const actionDelay = (await actions.evaluate(observedMotion)).delay
  const displayDelay = (await display.evaluate(observedMotion)).delay
  expect(actionDelay).toBeGreaterThan(copyDelay)
  expect(displayDelay).toBeGreaterThan(actionDelay)
  await expect(heading).toHaveCSS('opacity', '1')
  await expect(heading).toHaveCSS('transform', 'none')
  const row = page.locator('main [data-reveal="scroll"]').first()
  await expect(row).toHaveAttribute('data-reveal-state', 'pending')
  await expect(row).toHaveCSS('opacity', '0')
  await row.scrollIntoViewIfNeeded()
  await expect(row).toHaveAttribute('data-reveal-state', 'shown')
  await expect.poll(async () => (await row.evaluate(observedMotion)).count).toBe(1)
  await expect(row).toHaveCSS('transform', 'none')
  await page.evaluate(() => window.scrollTo(0, 0))
  await row.scrollIntoViewIfNeeded()
  await expect.poll(async () => (await row.evaluate(observedMotion)).count).toBe(1)
  expect(await row.evaluate((element) => element.getAnimations().length)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('reduced motion and live preference changes immediately expose every section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/zh/?_style=catalog')
  const row = page.locator('main [data-reveal="scroll"]').first()
  await expect(row).toHaveAttribute('data-reveal-state', 'pending')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(row).not.toHaveAttribute('data-reveal-state', 'pending')
  for (const target of [page.locator('h1'), row]) {
    await expect(target).toHaveCSS('opacity', '1')
    await expect(target).toHaveCSS('transform', 'none')
    await expect(target).toHaveCSS('animation-name', 'none')
  }
  await page.reload()
  await expect(page.locator('[data-reveal-state="pending"]')).toHaveCount(0)
  await expect(page.locator('h1')).toHaveCSS('animation-name', 'none')
})

test('no-script, missing observer and observer initialization failure preserve readable content', async ({
  browser,
  baseURL,
  page,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  try {
    const plain = await context.newPage()
    await plain.goto('/zh/')
    await expect(plain.locator('h1')).toHaveCSS('opacity', '1')
    await expect(plain.locator('h1')).toHaveCSS('transform', 'none')
    const rows = plain.locator('[data-reveal="scroll"]')
    await expect(rows).toHaveCount(3)
    await expect(rows.first()).toHaveCSS('opacity', '1')
    await expect(plain.locator('[data-reveal-state="pending"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
  for (const mode of ['missing', 'throws']) {
    await page.addInitScript((mode) => {
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        value:
          mode === 'missing'
            ? undefined
            : class {
                constructor() {
                  throw new Error('fixture: unavailable observer')
                }
              },
      })
    }, mode)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Toggle theme', exact: true })).toBeEnabled()
    await expect(page.locator('[data-reveal-state="pending"]')).toHaveCount(0)
    await expect(page.locator('[data-reveal="scroll"]').first()).toHaveCSS('opacity', '1')
  }
})

test('theme and locale entrances preserve mobile/desktop geometry in light and dark', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const theme of ['sage', 'catalog']) {
    for (const locale of ['en', 'zh']) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.setViewportSize(
          locale === 'zh' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        )
        await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
        await page.goto(`${locale === 'zh' ? '/zh/' : '/'}?_style=${theme}`)
        await expect(page.locator('html')).toHaveAttribute('data-visual-theme', theme)
        if (colorScheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
        else await expect(page.locator('html')).not.toHaveClass(/dark/)
        await expect(page.locator('h1')).toHaveCSS('opacity', '1')
        await expect(page.locator('h1')).toHaveCSS('transform', 'none')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        )
        const cta = page.locator('main a').first()
        if (await cta.count())
          expect(await cta.evaluate((element) => element.getBoundingClientRect().height)).toBe(44)
      }
    }
  }
  expect(errors).toEqual([])
})

test('motion preview replays explicitly and keyboard focus reveals a pending action immediately', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/zh/dev/ui')
  await page.getByRole('tab', { name: '视觉方向', exact: true }).click()
  const preview = page.getByRole('region', { name: '动效与阅读节奏', exact: true })
  const action = preview.getByRole('link', { name: '返回首页', exact: true })
  const target = action.locator('..')
  await expect(target).toHaveAttribute('data-reveal-state', 'pending')
  await action.focus()
  await expect(action).toBeFocused()
  await expect(target).toHaveCSS('opacity', '1')
  await expect(target).toHaveCSS('animation-name', 'none')
  await expect(target).toHaveAttribute('data-reveal-state', 'shown')
  const card = preview.locator('[data-reveal="enter"]').first()
  const previous = await card.elementHandle()
  await preview.getByRole('button', { name: '重播入场', exact: true }).click()
  expect(await previous.evaluate((element) => element.isConnected)).toBe(false)
  await expect(card).toHaveCSS('opacity', '1')
  await expect(card).toHaveCSS('transform', 'none')
})
