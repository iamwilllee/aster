import { releaseFixtureAdmin } from './local-admin'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
import type { ContentRecord } from '../../src/modules/content/policy'
const origin = 'http://127.0.0.1:3100',
  password = 'Fixture-content-2026!'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=',
  'base64',
)
test.skip(
  !features.content || !features.emailPassword || !features.files,
  'Requires local content/image/auth modules',
)
async function register(request: APIRequestContext) {
  const email = 'content-' + randomUUID() + '@example.test'
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Content fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const mail = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  await request.get(mail.find((m) => m.recipient === email)!.url)
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
async function close(request: APIRequestContext) {
  const r = await request.post('/api/account/delete', {
    headers: { origin },
    data: { confirmation: 'DELETE', currentPassword: password, retainSiteContent: true },
  })
  expect(r.status(), await r.text()).toBe(200)
}
test('admin draft, preview, publish, replace and withdraw control public SSR and dedicated cover access', async ({
  page,
  request,
  browser,
}, testInfo) => {
  const email = await register(page.request)
  expect((await page.request.get('/api/admin/content')).status()).toBe(403)
  execFileSync('pnpm', ['admin:grant', email], { encoding: 'utf8', timeout: 30000 })
  const visitorContext = await browser.newContext({
      baseURL: origin,
      viewport: { width: 390, height: 844 },
    }),
    visitor = await visitorContext.newPage()
  const slug = 'guide-' + randomUUID(),
    title = 'A useful guide ' + slug.slice(-8),
    seo = 'Search ' + slug
  const entryRow = () => page.locator('article').filter({ hasText: slug })
  let entryId: string | undefined
  try {
    await page.goto('/app/content')
    await page.getByRole('tab', { name: 'Site assets', exact: true }).click()
    await expect(page.getByLabel('Upload a site image', { exact: true })).toBeEnabled()
    await page
      .getByLabel('Upload a site image', { exact: true })
      .setInputFiles({ name: slug + '.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText(slug + '.png', { exact: true })).toBeVisible()
    const assets = (await (await page.request.get('/api/admin/content/assets')).json()) as {
      assets: { id: string; name: string }[]
    }
    const asset = assets.assets.find((a) => a.name === slug + '.png')!
    expect((await request.get('/api/content/assets/' + asset.id)).status()).toBe(404)
    await page.getByRole('tab', { name: 'Journal & help', exact: true }).click()
    await page.getByRole('button', { name: 'New content', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill(title)
    await page.getByLabel('URL slug', { exact: true }).fill(slug)
    await page.getByLabel('Category', { exact: true }).fill('Tutorials')
    await page.getByRole('combobox', { name: 'Content type', exact: true }).click()
    await page.getByRole('option', { name: 'Help', exact: true }).click()
    await page.getByLabel('Summary', { exact: true }).fill('A real local publication fixture.')
    await page
      .getByLabel('Body', { exact: true })
      .fill('First paragraph.\n\n<script>window.__contentProbe=1</script>')
    await page.getByRole('combobox', { name: 'Cover image', exact: true }).click()
    await page.getByRole('option', { name: slug + '.png', exact: true }).click()
    await page.getByLabel('SEO title (optional)', { exact: true }).fill(seo)
    await page
      .getByLabel('SEO description (optional)', { exact: true })
      .fill('A precise public description.')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const records = (await (await page.request.get('/api/admin/content')).json()) as {
      records: ContentRecord[]
    }
    entryId = records.records.find((r) => r.draft.slug === slug)!.id
    expect((await request.get('/content/' + slug)).status()).toBe(404)
    await page.goto('/app/settings')
    await page.getByRole('button', { name: 'Delete account', exact: true }).click()
    const deletion = page.getByRole('dialog', {
      name: 'Permanently delete this account?',
      exact: true,
    })
    await expect(
      deletion.getByRole('checkbox', {
        name: 'I understand that shared site content and assets remain after my account is deleted.',
        exact: true,
      }),
    ).toBeVisible()
    await deletion.getByLabel('Current password', { exact: true }).fill(password)
    await deletion.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE')
    await expect(
      deletion.getByRole('button', { name: 'Permanently delete account', exact: true }),
    ).toBeDisabled()
    await deletion.getByRole('checkbox').check()
    await expect(
      deletion.getByRole('button', { name: 'Permanently delete account', exact: true }),
    ).toBeEnabled()
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.goto('/app/content')

    await entryRow().getByRole('button', { name: 'Preview draft', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Preview draft', exact: true })).toContainText(
      'First paragraph.',
    )
    await expect(
      page
        .getByRole('dialog', { name: 'Preview draft', exact: true })
        .getByRole('img', { name: title, exact: true }),
    ).toBeVisible()
    await page
      .getByRole('dialog', { name: 'Preview draft', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await entryRow().getByRole('button', { name: 'Publish saved draft', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(entryRow().getByText('Published', { exact: true })).toBeVisible()
    const listing = (await (
      await request.get('/api/content?locale=en&kind=help&category=Tutorials&q=' + slug.slice(-8))
    ).json()) as { items: { title: string }[] }
    expect(listing.items.map((i) => i.title)).toContain(title)
    await visitor.goto('/content/' + slug)
    await expect(visitor).toHaveTitle(seo)
    await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'A precise public description.',
    )
    await expect(visitor.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(
      visitor.getByText('<script>window.__contentProbe=1</script>', { exact: true }),
    ).toBeVisible()
    expect(
      await visitor.evaluate(() => {
        const value: unknown = Reflect.get(window, '__contentProbe')
        return value
      }),
    ).toBeUndefined()
    await expect
      .poll(() =>
        visitor
          .getByRole('img', { name: title, exact: true })
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true)
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    )
    await entryRow().getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill(title + ' revised')
    await page.getByLabel('URL slug', { exact: true }).fill(slug + '-revised')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('heading', { name: title + ' revised', exact: true })).toBeVisible()
    await visitor.reload()
    await expect(visitor.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await entryRow().getByRole('button', { name: 'Publish saved draft', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'Publish this saved version?', exact: true }),
    ).toHaveCount(0)
    expect((await request.get('/content/' + slug)).status()).toBe(404)
    expect((await request.get('/content/' + slug + '-revised')).status()).toBe(200)
    await entryRow().getByRole('button', { name: 'Withdraw', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm action', exact: true }).click()
    await expect(entryRow().getByText('Draft', { exact: true })).toBeVisible()
    expect((await request.get('/content/' + slug + '-revised')).status()).toBe(404)
    expect((await request.get('/api/content/assets/' + asset.id)).status()).toBe(404)
    await page.reload()
    await expect(page.getByRole('heading', { name: title + ' revised', exact: true })).toBeVisible()
  } finally {
    // Reserve bounded cleanup time after a UI failure so shared-site fixtures are not left published.
    testInfo.setTimeout(testInfo.timeout + 15000)
    if (entryId) {
      const records = (await (await page.request.get('/api/admin/content')).json()) as {
        records: ContentRecord[]
      }
      let row = records.records.find((r) => r.id === entryId)
      if (row?.live) {
        await page.request.post('/api/admin/content/' + entryId + '/withdraw', {
          headers: { origin },
          data: { revision: row.revision },
        })
        row = (
          (await (await page.request.get('/api/admin/content')).json()) as {
            records: ContentRecord[]
          }
        ).records.find((r) => r.id === entryId)
      }
      if (row)
        expect(
          (
            await page.request.delete('/api/admin/content/' + entryId, {
              headers: { origin },
              data: { revision: row.revision },
            })
          ).status(),
        ).toBe(200)
    }
    const assets = (await (await page.request.get('/api/admin/content/assets')).json()) as {
      assets: { id: string; name: string }[]
    }
    for (const a of assets.assets.filter((a) => a.name === slug + '.png'))
      expect(
        (
          await page.request.delete('/api/admin/content/assets/' + a.id, { headers: { origin } })
        ).status(),
      ).toBe(200)
    releaseFixtureAdmin(email)
    await close(page.request)
    await visitorContext.close()
  }
})
