import { origin } from './origin'
import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
export { default as features } from '../../src/config/features.json' with { type: 'json' }

// Independent client IPs keep legitimate fixture users from sharing an auth rate-limit bucket.
// Cloudflare overwrites this header in production; this fixture is for loopback development only.
export const test = base.extend({
  extraHTTPHeaders: async ({ baseURL }, use) => {
    if (baseURL !== origin) throw new Error('Development fixtures require the loopback server')
    const id = randomUUID().replaceAll('-', '')
    await use({
      'cf-connecting-ip':
        'fd00:' +
        Array.from({ length: 7 }, (_, index) => id.slice(index * 4, index * 4 + 4)).join(':'),
    })
  },
})
export { expect }
