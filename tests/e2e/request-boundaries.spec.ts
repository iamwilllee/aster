import { test, expect, features } from './fixtures'

const origin = 'http://127.0.0.1:3100'

test('concurrent early mutation errors preserve JSON status and keep the next request healthy', async ({
  request,
}) => {
  for (let burst = 0; burst < 6; burst++) {
    const responses = await Promise.all([
      request.post('/api/projects', {
        headers: { origin: 'https://foreign.example' },
        data: { name: 'Rejected' },
      }),
      request.post('/api/projects', { headers: { origin }, data: { name: 'Unauthorized' } }),
      request.patch('/api/profile', { headers: { origin }, data: { name: 'Unauthorized' } }),
      request.delete('/api/projects/fixture', {
        headers: { origin },
        data: { unused: 'must still be consumed' },
      }),
      request.post('/api/billing/webhook', { data: { fixture: true } }),
    ])
    const projects = features.auth && features.projects
    expect(responses.map((response) => response.status())).toEqual([
      projects ? 403 : 404,
      projects ? 401 : 404,
      features.auth ? 401 : 404,
      projects ? 401 : 404,
      features.auth && features.billing ? 400 : 404,
    ])
    for (const response of responses) {
      expect(response.headers()['content-type']).toContain('application/json')
      expect(await response.json()).toHaveProperty('error')
    }
  }
  expect((await request.get('/api/health')).status()).toBe(200)
})

test('oversized mutation bodies are rejected before auth or writes without breaking the next request', async ({
  request,
}) => {
  const response = await request.post('/api/projects', {
    headers: { origin },
    data: { name: 'x'.repeat(20_000) },
  })
  expect(response.status()).toBe(413)
  expect(response.headers()['content-type']).toContain('application/json')
  expect((await request.get('/api/health')).status()).toBe(200)
})

test('every response carries the security headers, including redirects and API errors', async ({
  request,
}) => {
  for (const path of ['/', '/api/projects', '/robots.txt']) {
    const response = await request.get(path, { maxRedirects: 0 })
    const headers = response.headers()
    expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'")
    expect(headers['x-frame-options'], path).toBe('DENY')
    expect(headers['x-content-type-options'], path).toBe('nosniff')
    expect(headers['referrer-policy'], path).toBe('no-referrer')
    expect(headers['permissions-policy'], path).toContain('camera=()')
    // The local origin is plain http, where HSTS must not be sent.
    expect(headers['strict-transport-security'], path).toBeUndefined()
  }
})

test('server functions refuse cross-site requests', async ({ request }) => {
  const crossSite = await request.get('/_serverFn/probe', {
    headers: { 'sec-fetch-site': 'cross-site' },
  })
  expect(crossSite.status()).toBe(403)
  const sameOrigin = await request.get('/_serverFn/probe', {
    headers: { 'sec-fetch-site': 'same-origin' },
  })
  // Past the CSRF check, the unknown function id is rejected by the handler.
  expect(sameOrigin.status()).not.toBe(403)
})
