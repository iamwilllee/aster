import {
  paymentProvider,
  paymentProviders,
  paymentSecrets,
} from '../src/modules/billing/config.mjs'
import { legacyFeatures } from './project-features.mjs'
import { validateFeatures } from '../src/config/feature-policy.mjs'
import { z } from 'zod'

// Local configuration checks only. No provider calls or secret values are needed.
export function deploymentPolicy(base, target, plan, selected) {
  const features = selected ? validateFeatures(selected) : legacyFeatures
  const config = target ? base.env?.[target] : base
  if (!config) return { problems: ['Selected environment is missing'], requiredSecrets: [] }
  const problems = []
  const vars = config.vars ?? {}
  const requiredSecrets = features.auth ? ['BETTER_AUTH_SECRET'] : []
  let origin
  try {
    origin = new URL(vars.APP_ORIGIN)
  } catch {
    /* Report only the field, never its value. */
  }
  if (
    !origin ||
    origin.protocol !== 'https:' ||
    origin.hostname.endsWith('.invalid') ||
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
    origin.origin !== vars.APP_ORIGIN
  )
    problems.push('APP_ORIGIN must be an exact public HTTPS origin, without a trailing slash')
  if (vars.ENVIRONMENT !== (target ?? 'production'))
    problems.push('ENVIRONMENT must match the selected deployment target')
  if (target === 'staging' && vars.PUBLIC_INDEXABLE !== 'false')
    problems.push('Staging must remain unindexed')
  if (
    vars.MAIL_MODE === 'local' ||
    (features.mail && !['disabled', 'cloudflare', 'brevo', 'resend'].includes(vars.MAIL_MODE))
  )
    problems.push(
      'Select a supported remote mail provider; local mail must never be enabled remotely',
    )
  if (!target && features.emailPassword && vars.MAIL_MODE === 'disabled')
    problems.push(
      'Public email registration requires working transactional mail. Configure the chosen provider first; use staging for a data-only preview. This does not require choosing a paid provider.',
    )
  if (features.mail && vars.MAIL_MODE === 'cloudflare') {
    if (!config.send_email?.some((binding) => binding.name === 'EMAIL'))
      problems.push(
        'Selected Cloudflare mail needs the EMAIL send_email binding in this environment',
      )
  }
  if (features.mail && ['brevo', 'resend'].includes(vars.MAIL_MODE)) {
    requiredSecrets.push(vars.MAIL_MODE === 'brevo' ? 'BREVO_API_KEY' : 'RESEND_API_KEY')
  }
  if (features.mail && ['cloudflare', 'brevo', 'resend'].includes(vars.MAIL_MODE)) {
    const match =
      typeof vars.MAIL_FROM === 'string' && !/[\r\n]/.test(vars.MAIL_FROM)
        ? vars.MAIL_FROM.trim().match(/^(?:([^<>]+?)\s*<([^<>]+)>|([^<>]+))$/)
        : undefined
    const address = (match?.[2] ?? match?.[3] ?? '').trim()
    if (
      !z.email().safeParse(address).success ||
      /@(.*\.)?example\.(?:invalid|com|test)$|\.invalid$/i.test(address)
    )
      problems.push(
        'Set MAIL_FROM to a verified sending-domain address, not an example placeholder',
      )
  }
  if (features.auth && !['false', 'true'].includes(String(vars.GOOGLE_AUTH_ENABLED)))
    problems.push(
      'Choose GOOGLE_AUTH_ENABLED explicitly: false by default, true only when Google login is selected',
    )
  const google = features.auth && features.google && String(vars.GOOGLE_AUTH_ENABLED) === 'true'
  if (selected && features.google && !google && !target)
    problems.push('Selected Google login must be configured and enabled before publishing')
  if (google) requiredSecrets.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  if (!target && plan?.modules?.google?.selection === 'required' && !google)
    problems.push(
      'The product requires Google login, but it is disabled. Finish configuration and acceptance before publishing.',
    )
  if (!target && plan?.modules?.google?.selection === 'deferred' && google)
    problems.push(
      'Google login is enabled but deferred in the product plan. Reconcile the selected login methods before publishing.',
    )
  const verified = (id) =>
    plan?.acceptance?.some(
      (item) =>
        item.id === id &&
        item.kind === 'business' &&
        item.scope === 'provider' &&
        item.status === 'passed' &&
        item.verification === 'real' &&
        item.evidence?.length,
    )
  if (!target && features.emailPassword && !verified('auth-email-live'))
    problems.push(
      'Public email registration needs auth-email-live provider acceptance with real delivery and recovery evidence. Configure and verify it in staging first.',
    )
  if (!target && google && !verified('auth-google-live'))
    problems.push(
      'Selected Google login needs auth-google-live provider acceptance with real sign-in/callback evidence. OAuth URL or mock tests are not real acceptance.',
    )
  const db = config.d1_databases?.find((binding) => binding.binding === 'DB')
  if (features.database && (!db?.database_id || db.database_id.startsWith('00000000')))
    problems.push('Replace the placeholder D1 database_id')
  const otherDb = (target ? base : base.env?.staging)?.d1_databases?.find(
    (binding) => binding.binding === 'DB',
  )
  if (features.database && db?.database_id && db.database_id === otherDb?.database_id)
    problems.push('Staging and production must use different D1 databases')
  if (features.content && !target && !verified('content-live'))
    problems.push(
      'Selected content needs content-live real target environment acceptance before publishing',
    )
  if (features.files) {
    const bucket = config.r2_buckets?.find((item) => item.binding === 'ASSETS_BUCKET')
    const other = (target ? base : base.env?.staging)?.r2_buckets?.find(
      (item) => item.binding === 'ASSETS_BUCKET',
    )
    if (!bucket?.bucket_name || bucket.bucket_name.startsWith('replace-'))
      problems.push('Select a real private ASSETS_BUCKET for this environment')
    if (bucket?.bucket_name && bucket.bucket_name === other?.bucket_name)
      problems.push('Staging and production must use different R2 buckets')
    if (!target && !verified('files-live'))
      problems.push('Selected files needs files-live real provider acceptance before publishing')
  }
  if (selected && features.billing) {
    const selectedProvider = paymentProvider(vars)
    const providers = paymentProviders(vars)
    if (!providers)
      problems.push('Select BILLING_PROVIDER=stripe|creem and valid BILLING_LEGACY_PROVIDERS')
    else for (const provider of providers) requiredSecrets.push(...paymentSecrets(provider))
    const acceptance =
      selectedProvider === 'creem' ? 'billing-creem-test-live' : 'billing-test-live'
    if (!target && !verified(acceptance))
      problems.push(
        `Selected ${selectedProvider ?? 'unknown'} test billing needs ${acceptance} real sandbox acceptance before publishing`,
      )
  }
  if (selected)
    for (const key of ['ai', 'usage'])
      if (plan?.modules?.[key]?.selection === 'required')
        problems.push(`Selected module ${key} is not implemented; complete it before publishing`)
  if (selected)
    for (const [key, choice] of Object.entries(plan?.modules ?? {}))
      if (
        key in features &&
        choice.selection !== 'undecided' &&
        !['ai', 'usage'].includes(key) &&
        features[key] !== (choice.selection === 'required')
      )
        problems.push(`Selected module and runtime configuration disagree: ${key}`)
  if (Object.keys(vars).some((name) => /SECRET|TOKEN|PASSWORD|API_KEY/.test(name)))
    problems.push('Store secrets with wrangler secret put, never in vars')
  return { problems, requiredSecrets }
}

export function missingDeploymentSecrets(required, names) {
  return required.filter((name) => !names.includes(name))
}
