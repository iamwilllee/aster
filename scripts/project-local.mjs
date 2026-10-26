import { createRequire } from 'node:module'
import { readFeatures } from './project-features.mjs'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function parseLocalVars(content) {
  const vars = {}
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
    if (!match || Object.hasOwn(vars, match[1]))
      throw new Error('本地配置格式无效或存在重复键；未显示配置内容')
    let value = match[2].trim()
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value)
      } catch {
        throw new Error('本地配置引号无效；未显示配置内容')
      }
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error('本地配置引号无效；未显示配置内容')
      value = value.slice(1, -1)
    } else value = value.replace(/\s+#.*$/, '').trim()
    if (typeof value !== 'string') throw new Error('本地配置必须为字符串；未显示配置内容')
    vars[match[1]] = value
  }
  return vars
}
export function localBootstrapEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env))
    if (
      /^(?:CLOUDFLARE_|CF_|GOOGLE_|STRIPE_|CREEM_|BREVO_|RESEND_)/.test(key) ||
      [
        'BETTER_AUTH_SECRET',
        'ENVIRONMENT',
        'APP_ORIGIN',
        'MAIL_MODE',
        'BILLING_ENABLED',
        'BILLING_PROVIDER',
        'BILLING_LEGACY_PROVIDERS',
      ].includes(key)
    )
      delete env[key]
  return { ...env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' }
}
export function dependenciesPresent(root) {
  return ['vite', 'wrangler', 'prettier', 'zod'].every((name) =>
    existsSync(join(root, 'node_modules', name, 'package.json')),
  )
}
export function dependencyFingerprint(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return createHash('sha256')
    .update(readFileSync(join(root, 'pnpm-lock.yaml')))
    .update(
      JSON.stringify([manifest.dependencies, manifest.devDependencies, manifest.packageManager]),
    )
    .digest('hex')
}
export function assertLocalProject(root) {
  if (!existsSync(join(root, 'PROJECT.md')) || !existsSync(join(root, 'starter.project.json')))
    throw new Error('缺少产品标记；不能把底座源目录当成产品恢复')
  const state = JSON.parse(readFileSync(join(root, 'starter.project.json'), 'utf8'))
  if (state.schemaVersion !== 1) throw new Error('不支持的流程版本')
  if (!existsSync(join(root, '.dev.vars')))
    throw new Error('缺少 .dev.vars；先恢复本产品本地配置，不自动重置密钥')
  const { features } = readFeatures(root)
  // Doctor can read vars before dependencies exist; only bootstrap needs the JSONC parser.
  const { parse: parseJsonc } = createRequire(import.meta.url)('jsonc-parser')
  const errors = []
  const config = parseJsonc(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'), errors, {
    allowTrailingComma: true,
  })
  if (errors.length || !config || typeof config !== 'object')
    throw new Error('Invalid local Worker configuration')
  if (config.r2_buckets?.some((item) => item.remote === true))
    throw new Error('Local bootstrap refuses remote R2 bindings')
  const vars = parseLocalVars(readFileSync(join(root, '.dev.vars'), 'utf8'))
  let origin
  try {
    origin = new URL(vars.APP_ORIGIN)
  } catch {
    /* checked below */
  }
  if (
    vars.ENVIRONMENT !== 'local' ||
    vars.MAIL_MODE !== (features.mail && features.database ? 'local' : 'disabled') ||
    !origin ||
    !['http:', 'https:'].includes(origin.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
    origin.origin !== vars.APP_ORIGIN
  )
    throw new Error('恢复命令仅用于匹配的本机 local 配置；不会操作远端环境')
  if (
    features.auth &&
    (!vars.BETTER_AUTH_SECRET ||
      vars.BETTER_AUTH_SECRET.length < 32 ||
      vars.BETTER_AUTH_SECRET.startsWith('replace-'))
  )
    throw new Error('本地认证密钥缺失或无效；先恢复本产品配置，不自动重置')
}
