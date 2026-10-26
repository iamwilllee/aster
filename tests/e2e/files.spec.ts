import { randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { test, expect, features } from './fixtures'
const origin = 'http://127.0.0.1:3100',
  password = 'Fixture-images-2026!'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=',
  'base64',
)
test.skip(
  !features.files || !features.emailPassword,
  'Requires selected local images and email auth',
)
async function register(request: APIRequestContext) {
  const email = `images-${randomUUID()}@example.test`
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: { name: 'Images fixture', email, password },
      })
    ).status(),
  ).toBe(200)
  const mail = (await (await request.get('/api/dev/mail')).json()) as {
    recipient: string
    url: string
  }[]
  await request.get(mail.find((item) => item.recipient === email)!.url)
  expect(
    (
      await request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email, password },
      })
    ).status(),
  ).toBe(200)
}
async function close(request: APIRequestContext) {
  const response = await request.post('/api/account/delete', {
    headers: { origin },
    data: { confirmation: 'DELETE', currentPassword: password },
  })
  expect(response.status(), await response.text()).toBe(200)
}
test('real local images survive refresh, isolate owners, replace references and are removed with the account', async ({
  page,
  playwright,
}) => {
  const request = page.request
  await register(request)
  const foreign = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { 'cf-connecting-ip': 'fd00:3456:2345:4567:5678:6789:7890:1234' },
  })
  try {
    await register(foreign)
    const invalid = await request.post('/api/files', {
      headers: { origin, 'content-type': 'image/png', 'x-file-name': 'bad.png' },
      data: Buffer.from('<svg/>'),
    })
    expect(invalid.status()).toBe(400)
    await page.goto('/app/files')
    await expect(page.getByLabel('Upload an image', { exact: true })).toBeEnabled()
    await page
      .getByLabel('Upload an image', { exact: true })
      .setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText('one.png', { exact: true })).toBeVisible()
    await page.reload()
    const img = page.getByRole('img', { name: 'one.png', exact: true })
    await expect
      .poll(() =>
        img.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
    const content = await img.getAttribute('src'),
      id = content!.split('/')[3]!
    const list = (await (await request.get('/api/files')).json()) as { files: { id: string }[] }
    expect(list.files.map((item) => item.id)).toContain(id)
    expect(JSON.stringify(list)).not.toMatch(/object_key|user_id/)
    expect((await foreign.get(content!)).status()).toBe(404)
    expect((await foreign.delete('/api/files/' + id, { headers: { origin } })).status()).toBe(404)
    expect(
      (
        await foreign.post('/api/files/avatar', { headers: { origin }, data: { assetId: id } })
      ).status(),
    ).toBe(409)
    expect(
      (
        await foreign.post('/api/projects', {
          headers: { origin },
          data: {
            name: 'Foreign cover attempt',
            description: '',
            status: 'idea',
            coverAssetId: id,
          },
        })
      ).status(),
    ).toBe(400)
    const response = await request.get(content!)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(await response.body()).toEqual(png)
    await page.goto('/app/settings')
    await page.getByRole('button', { name: 'Choose from image library', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Choose image', exact: true })
      .click()
    await expect(page.getByRole('status').filter({ hasText: 'Avatar updated.' })).toBeVisible()
    await page.reload()
    await expect(page.locator('img[src="' + content + '"]')).not.toHaveCount(0)
    await page.goto('/app/projects')
    await page.getByRole('button', { name: 'New project', exact: true }).click()
    const editor = page.getByRole('dialog').first()
    await editor.getByLabel('Project name', { exact: true }).fill('With private cover')
    await editor.getByRole('button', { name: 'Choose from image library', exact: true }).click()
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Choose image', exact: true })
      .click()
    await editor.getByRole('button', { name: 'Save project', exact: true }).click()
    await expect(page.getByText('With private cover', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('img[src="' + content + '"]')).not.toHaveCount(0)
    expect((await request.delete('/api/files/' + id, { headers: { origin } })).status()).toBe(409)
    const next = await request.post('/api/files', {
      headers: { origin, 'content-type': 'image/png', 'x-file-name': 'two.png' },
      data: png,
    })
    expect(next.status()).toBe(201)
    const nextId = ((await next.json()) as { id: string }).id
    const projects = (await (await request.get('/api/projects')).json()) as {
      id: string
      name: string
      description: string
      status: string
    }[]
    const project = projects.find((p) => p.name === 'With private cover')!
    expect(
      (
        await request.patch('/api/projects/' + project.id, {
          headers: { origin },
          data: {
            name: project.name,
            description: project.description,
            status: project.status,
            coverAssetId: nextId,
          },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await request.post('/api/files/avatar', { headers: { origin }, data: { assetId: null } })
      ).status(),
    ).toBe(200)
    expect((await request.delete('/api/files/' + id, { headers: { origin } })).status()).toBe(200)
    expect((await request.get(content!)).status()).toBe(404)
    await page.goto('/app/files')
    await expect(
      page.getByRole('button', { name: 'Delete image: two.png', exact: true }),
    ).toBeDisabled()
    await close(request)
    expect((await request.get('/api/files')).status()).toBe(401)
    expect((await foreign.get('/api/files/' + nextId + '/content')).status()).toBe(404)
    await close(foreign)
  } finally {
    await foreign.dispose()
  }
})
