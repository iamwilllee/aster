export const featureKeys = [
  'database',
  'auth',
  'emailPassword',
  'google',
  'mail',
  'projects',
  'billing',
  'ai',
  'files',
  'usage',
  'content',
]
export const featureDependencies = {
  database: [],
  auth: ['database'],
  emailPassword: ['auth', 'mail'],
  google: ['auth'],
  mail: [],
  projects: ['auth', 'database'],
  billing: ['auth', 'database'],
  ai: [],
  files: ['auth', 'database'],
  usage: [],
  content: ['auth', 'database'],
}
export const unsupportedFeatures = ['ai', 'usage']
export function validateFeatures(value) {
  // Older explicit configs predate the optional editorial module.
  if (value && typeof value === 'object' && !Array.isArray(value) && !('content' in value))
    value = { ...value, content: false }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== featureKeys.length ||
    featureKeys.some((key) => typeof value[key] !== 'boolean')
  )
    throw new Error('Invalid feature configuration: use the documented boolean module keys')
  for (const key of featureKeys) {
    if (!value[key]) continue
    if (unsupportedFeatures.includes(key))
      throw new Error(`Module ${key} is not implemented; implement and verify it before enabling`)
    for (const dependency of featureDependencies[key])
      if (!value[dependency]) throw new Error(`Module ${key} requires ${dependency}`)
  }
  if (value.auth && !value.emailPassword && !value.google)
    throw new Error('Authentication needs at least one selected login method')
  return { ...value }
}
export function featurePreset(name) {
  const value = Object.fromEntries(featureKeys.map((key) => [key, false]))
  if (name === 'web-app' || name === 'billing-test')
    for (const key of ['database', 'auth', 'emailPassword', 'mail', 'projects']) value[key] = true
  else if (name !== 'showcase')
    throw new Error('Unknown profile: showcase, web-app or billing-test')
  if (name === 'billing-test') value.billing = true
  return validateFeatures(value)
}
// Existing plans without the new optional choices retain their previous behavior until explicitly adopted.
export function featuresFromPlan(plan) {
  const value = featurePreset('web-app')
  for (const key of featureKeys) {
    const selected = plan.modules?.[key]?.selection
    if (!unsupportedFeatures.includes(key) && (selected === 'required' || selected === 'deferred'))
      value[key] = selected === 'required'
  }
  if (!plan.modules?.emailPassword) value.emailPassword = value.auth && value.mail
  if (!plan.modules?.projects) value.projects = value.auth
  if (!plan.modules?.database) value.database = value.auth || value.projects
  if (!value.auth && !plan.modules?.emailPassword) value.emailPassword = false
  return validateFeatures(value)
}
