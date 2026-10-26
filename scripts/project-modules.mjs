import { randomUUID, randomBytes, createHash } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  renameSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser'
import { featureKeys, featurePreset, validateFeatures } from '../src/config/feature-policy.mjs'
import { readFeatures, featureFile, caseFeature } from './project-features.mjs'
import { loadPlan, parsePlan } from './project-workflow.mjs'
import { parseLocalVars } from './project-local.mjs'

function safe(root, path) {
  let current = root
  for (const part of path.split('/')) {
    current = join(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error('Symlink path refused')
  }
  return current
}
function revision(root) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [featureFile, 'starter.project.json'].map((path) =>
          existsSync(safe(root, path)) ? readFileSync(safe(root, path)).toString('base64') : null,
        ),
      ),
    )
    .digest('hex')
}
export function moduleChange(root, choices) {
  if (
    !choices ||
    typeof choices !== 'object' ||
    Array.isArray(choices) ||
    Object.keys(choices).some((key) => !featureKeys.includes(key))
  )
    throw new Error('Invalid module choices')
  const plan = loadPlan(root)
  const before = readFeatures(root)
  const merged = Object.fromEntries(
    featureKeys.map((key) => [
      key,
      choices[key] ?? {
        selection: before.features[key] ? 'required' : 'deferred',
        basis: 'context',
        reason: '沿用当前运行配置；未推断为用户明确选择',
      },
    ]),
  )
  const nextPlan = parsePlan({ ...plan, modules: merged })
  if (Object.values(nextPlan.modules).some((choice) => choice.selection === 'undecided'))
    throw new Error('Resolve selected module choices before applying')
  const features = validateFeatures(
    Object.fromEntries(
      featureKeys.map((key) => [key, nextPlan.modules[key].selection === 'required']),
    ),
  )
  const changed = featureKeys.filter((key) => features[key] !== before.features[key])
  // Disabling checkout alone must use BILLING_ENABLED=false, preserving portals and webhooks.
  if (
    before.features.billing &&
    !features.billing &&
    plan.modules.billing?.selection === 'required'
  )
    throw new Error(
      'Existing billing is required; retain the module for portals/webhooks. Disable only new checkout with BILLING_ENABLED=false, or explicitly retire billing after inspecting active subscriptions',
    )
  if (
    before.features.content &&
    !features.content &&
    plan.modules.content?.selection === 'required'
  )
    throw new Error(
      'Existing content requires publication, reference and retention review before retirement',
    )
  if (before.features.files && !features.files && plan.modules.files?.selection === 'required')
    throw new Error('Existing files require reference and storage cleanup review before retirement')
  if (changed.includes('database') && features.database)
    nextPlan.bootstrap.database = { status: 'pending' }
  for (const item of nextPlan.acceptance) {
    const module = caseFeature(item)
    if (changed.includes(module) || changed.includes('auth') || changed.includes('database'))
      Object.assign(item, { status: 'pending', verification: 'unverified', evidence: [] })
  }
  return { revision: revision(root), before: before.features, features, changed, plan: nextPlan }
}
function applyLocalModuleChange(root, change) {
  if (change.revision !== revision(root)) throw new Error('Module plan is stale')
  validateFeatures(change.features)
  const paths = [featureFile, 'starter.project.json', 'wrangler.jsonc', '.dev.vars']
  const previous = new Map(
    paths.map((path) => [
      path,
      existsSync(safe(root, path)) ? readFileSync(safe(root, path)) : null,
    ]),
  )
  const output = new Map([
    [featureFile, JSON.stringify(change.features, null, 2) + '\n'],
    ['starter.project.json', JSON.stringify(change.plan, null, 2) + '\n'],
  ])
  // Only remove template placeholders. Existing real resource bindings and all data stay intact.
  if (previous.get('wrangler.jsonc')) {
    let configText = previous.get('wrangler.jsonc').toString()
    const errors = []
    const config = parseJsonc(configText, errors, { allowTrailingComma: true })
    if (errors.length) throw new Error('Invalid Worker configuration')
    for (const [path, configPart] of [
      [[], config],
      [['env', 'staging'], config.env?.staging],
    ]) {
      if (!configPart) continue
      const objects = configPart.r2_buckets ?? []
      if (change.features.files && !objects.some((item) => item.binding === 'ASSETS_BUCKET'))
        configText = applyEdits(
          configText,
          modify(
            configText,
            [...path, 'r2_buckets'],
            [
              ...objects,
              {
                binding: 'ASSETS_BUCKET',
                bucket_name: path.length
                  ? 'replace-with-staging-assets-bucket'
                  : 'replace-with-production-assets-bucket',
              },
            ],
            {},
          ),
        )
      // Retain existing object bindings on shutdown: old assets may still need account cleanup.
      const bindings = configPart.d1_databases ?? []
      if (!change.features.database) {
        const retained = bindings.filter(
          (binding) => binding.binding !== 'DB' || !binding.database_id?.startsWith('00000000'),
        )
        if (retained.length !== bindings.length)
          configText = applyEdits(
            configText,
            modify(configText, [...path, 'd1_databases'], retained, {}),
          )
      } else if (!bindings.some((binding) => binding.binding === 'DB')) {
        configText = applyEdits(
          configText,
          modify(
            configText,
            [...path, 'd1_databases'],
            [
              ...bindings,
              {
                binding: 'DB',
                database_name: path.length ? 'starter-staging-db' : 'starter-db',
                database_id: '00000000-0000-0000-0000-00000000000' + (path.length ? '1' : '0'),
                migrations_dir: 'migrations',
              },
            ],
            {},
          ),
        )
      }
    }
    output.set('wrangler.jsonc', configText)
  }
  if (previous.get('.dev.vars')) {
    let local = previous.get('.dev.vars').toString()
    const vars = parseLocalVars(local)
    if (vars.ENVIRONMENT !== 'local')
      throw new Error('Only local development config may be prepared')
    const set = (key, value) => {
      const pattern = new RegExp('^(?:export\\s+)?' + key + '\\s*=.*$', 'm')
      local = pattern.test(local)
        ? local.replace(pattern, key + '=' + value)
        : local + (local.endsWith('\n') ? '' : '\n') + key + '=' + value + '\n'
    }
    if (!change.features.mail) set('MAIL_MODE', 'disabled')
    else if (change.features.database && (!vars.MAIL_MODE || vars.MAIL_MODE === 'disabled'))
      set('MAIL_MODE', 'local')
    if (!change.features.google) set('GOOGLE_AUTH_ENABLED', 'false')
    if (!change.before.auth && change.features.auth && !vars.BETTER_AUTH_SECRET)
      set('BETTER_AUTH_SECRET', randomBytes(32).toString('hex'))
    output.set('.dev.vars', local)
  }
  const backup = '.local/module-changes/' + randomUUID()
  mkdirSync(safe(root, backup), { recursive: true, mode: 0o700 })
  for (const [index, [path, bytes]] of [...previous].entries())
    if (bytes) writeFileSync(join(root, backup, String(index)), bytes, { mode: 0o600, flag: 'wx' })
  writeFileSync(
    join(root, backup, 'manifest.json'),
    JSON.stringify({ paths, existed: paths.map((path) => previous.get(path) !== null) }, null, 2),
    { mode: 0o600 },
  )
  const written = []
  try {
    for (const [path, content] of output) {
      const destination = safe(root, path)
      const expected = previous.get(path)
      const actual = existsSync(destination) ? readFileSync(destination) : null
      if (expected === null ? actual !== null : !actual?.equals(expected))
        throw new Error('Concurrent edit detected')
      const temporary = destination + '.tmp-' + randomUUID()
      writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' })
      renameSync(temporary, destination)
      written.push(path)
    }
  } catch (error) {
    for (const path of written.reverse()) {
      const destination = safe(root, path)
      if (readFileSync(destination, 'utf8') !== output.get(path)) continue
      const bytes = previous.get(path)
      if (bytes) writeFileSync(destination, bytes, { mode: 0o600 })
      else unlinkSync(destination)
    }
    throw error
  }
  return {
    backup,
    changed: change.changed,
    features: change.features,
    note: 'Local configuration only. Restart preview, regenerate types with setup and reverify affected workflows. No cloud, data deletion or deployment was performed.',
  }
}

export function applyModuleChange(root, change) {
  mkdirSync(safe(root, '.local'), { recursive: true })
  const path = safe(root, '.local/module-changes.lock')
  const lock = openSync(path, 'wx', 0o600)
  try {
    return applyLocalModuleChange(root, change)
  } finally {
    closeSync(lock)
    unlinkSync(path)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = process.argv.slice(2)
    let profile,
      input,
      apply = false
    for (let at = 0; at < args.length; at++) {
      const key = args[at]
      if (key === '--apply' && !apply) apply = true
      else if (
        ['--profile', '--input'].includes(key) &&
        args[at + 1] &&
        !args[at + 1].startsWith('--')
      ) {
        if (key === '--profile' && !profile) profile = args[++at]
        else if (key === '--input' && !input) input = args[++at]
        else throw new Error('Duplicate option')
      } else
        throw new Error(
          'Usage: project:modules [--profile showcase|web-app|billing-test | --input JSON] [--apply]',
        )
    }
    if ((profile && input) || (apply && !profile && !input)) throw new Error('Choose one input')
    const root = process.cwd()
    if (!profile && !input) console.log(JSON.stringify(readFeatures(root), null, 2))
    else {
      const choices = profile
        ? Object.fromEntries(
            Object.entries(featurePreset(profile)).map(([key, enabled]) => [
              key,
              {
                selection: enabled ? 'required' : 'deferred',
                basis: 'context',
                reason: `当前任务采用 ${profile} 组合`,
              },
            ]),
          )
        : JSON.parse(readFileSync(resolve(input), 'utf8'))
      const change = moduleChange(root, choices)
      console.log(
        JSON.stringify(
          apply
            ? applyModuleChange(root, change)
            : {
                features: change.features,
                changed: change.changed,
                note: 'Read-only plan; use --apply for local configuration',
              },
          null,
          2,
        ),
      )
    }
  } catch (error) {
    const safeReason =
      /^(?:Existing billing|Module [a-zA-Z]+ requires|Module [a-zA-Z]+ is not implemented|Authentication needs|Module plan is stale|Symlink path refused|Concurrent edit detected)/.test(
        error.message,
      )
        ? error.message
        : ''
    if (safeReason) console.error(safeReason)
    console.error(
      'Module configuration was not completed. Check documented choices, dependencies, supported modules, existing billing obligations and local paths. Input/config values were not printed.',
    )
    process.exitCode = 2
  }
}
