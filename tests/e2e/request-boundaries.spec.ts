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
