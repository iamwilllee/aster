import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { parse } from 'jsonc-parser'
// Fixture-only maintenance restores the pre-test zero-admin state. Runtime APIs/CLI forbid removing the last admin.
export function releaseFixtureAdmin(email: string) {
  if (!/^(content|operator)-[a-f0-9-]+@example\.test$/.test(email))
    throw new Error('Not an isolated fixture account')
  const configPath = resolve('wrangler.jsonc')
  const raw: unknown = parse(readFileSync(configPath, 'utf8'))
  const config = z
    .object({
      d1_databases: z.array(
        z.object({
          binding: z.string(),
          database_name: z.string(),
          remote: z.boolean().optional(),
        }),
      ),
    })
    .parse(raw)
  const binding = config.d1_databases.find((d) => d.binding === 'DB')
  if (!binding || binding.remote) throw new Error('Fixture cleanup requires a local DB')
  const hex = Buffer.from(email.toLowerCase()).toString('hex')
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      binding.database_name,
      '--config',
      configPath,
      '--local',
      '--command',
      `DELETE FROM admin_user WHERE user_id=(SELECT id FROM user WHERE email=CAST(X'${hex}' AS TEXT));`,
    ],
    {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, CLOUDFLARE_ENV: '', WRANGLER_SEND_METRICS: 'false' },
    },
  )
}
