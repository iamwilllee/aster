import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read only the non-secret local origin; never forward dotenv secrets to fixtures or logs.
const localVars = resolve('.dev.vars')
const configured = existsSync(localVars)
  ? readFileSync(localVars, 'utf8')
      .match(/^APP_ORIGIN=(.+)$/m)?.[1]
      ?.trim()
  : undefined
const selected = process.env.ASTER_TEST_ORIGIN ?? configured ?? 'http://127.0.0.1:3100'
const endpoint = new URL(selected.replace(/^(['"])(.*)\1$/, '$2'))
if (
  endpoint.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
  !endpoint.port ||
  Number(endpoint.port) < 1024 ||
  endpoint.pathname !== '/' ||
  endpoint.search ||
  endpoint.hash ||
  endpoint.username ||
  endpoint.password
)
  throw new Error('Browser fixtures require a loopback HTTP origin with an unprivileged port')
export const origin = endpoint.origin
export const devCommand = `pnpm dev --host ${endpoint.hostname.replace(/^\[|\]$/g, '')} --port ${endpoint.port}`
