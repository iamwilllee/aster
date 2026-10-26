import { activeAdminCountSQL } from '../src/modules/admin/access-policy.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'jsonc-parser'
import { localBootstrapEnv } from './project-local.mjs'

const [action, email] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !email || !email.includes('@')) {
  console.error('Usage: pnpm admin:grant email@example.test (or admin:revoke). Local D1 only.')
  process.exit(1)
}
// Hex encoding keeps arbitrary email input out of SQL syntax. No shell interpolation.
const errors = []
const configPath = resolve('wrangler.jsonc')
const config = parse(readFileSync(configPath, 'utf8'), errors, { allowTrailingComma: true })
const binding = config?.d1_databases?.find((item) => item.binding === 'DB')
if (
  errors.length ||
  !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(binding?.database_name ?? '') ||
  binding.remote === true
)
  throw new Error('Local admin operation needs a valid local DB binding')
const value = `CAST(X'${Buffer.from(email.toLowerCase()).toString('hex')}' AS TEXT)`
const command =
  action === 'grant'
    ? `INSERT INTO admin_user (user_id) SELECT id FROM user WHERE email = ${value} AND email_verified=1 AND NOT EXISTS(SELECT 1 FROM account_access WHERE user_id=user.id AND disabled_at IS NOT NULL) ON CONFLICT(user_id) DO NOTHING;`
    : `DELETE FROM admin_user WHERE user_id IN (SELECT id FROM user WHERE email = ${value}) AND (NOT EXISTS(SELECT 1 FROM user u LEFT JOIN account_access a ON a.user_id=u.id WHERE u.id=admin_user.user_id AND u.email_verified=1 AND a.disabled_at IS NULL) OR ${activeAdminCountSQL}>1);`
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'execute',
    binding.database_name,
    '--local',
    '--config',
    configPath,
    '--command',
    command +
      ` SELECT EXISTS(SELECT 1 FROM admin_user WHERE user_id=(SELECT id FROM user WHERE email=${value})) AS role, EXISTS(SELECT 1 FROM user WHERE email=${value} AND email_verified=1 AND NOT EXISTS(SELECT 1 FROM account_access WHERE user_id=user.id AND disabled_at IS NOT NULL)) AS eligible;`,
    '--json',
  ],
  { encoding: 'utf8', env: localBootstrapEnv() },
)
if (result.status !== 0) process.exit(result.status || 1)
let rows
try {
  rows = JSON.parse(result.stdout).flatMap((item) => item.results ?? [])
} catch {
  throw new Error('Could not verify the local role operation; check local DB state before retrying')
}
const state = rows.find((row) => 'role' in row)
if (
  !state ||
  (action === 'grant' && (!state.eligible || !state.role)) ||
  (action === 'revoke' && state.role)
)
  throw new Error(
    'Role change blocked: use an existing verified active account and retain another active administrator before revoking the last role',
  )
console.log(
  'Local role state verified. No cloud role was changed. Refresh the workspace to see the current role.',
)
