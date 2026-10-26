import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateFeatures, unsupportedFeatures } from '../src/config/feature-policy.mjs'

export const featureFile = 'src/config/features.json'
// Only scripts inspecting older products use this fallback; copied runtimes always have an explicit file.
export const legacyFeatures = {
  database: true,
  auth: true,
  emailPassword: true,
  google: true,
  mail: true,
  projects: true,
  billing: true,
  ai: false,
  files: false,
  usage: false,
  content: false,
}
export function readFeatures(root) {
  const path = join(root, featureFile)
  if (!existsSync(path)) return { explicit: false, features: { ...legacyFeatures } }
  return { explicit: true, features: validateFeatures(JSON.parse(readFileSync(path, 'utf8'))) }
}
export function featurePlanProblems(root, plan) {
  const { explicit, features } = readFeatures(root)
  const errors = []
  if (explicit)
    for (const [key, choice] of Object.entries(plan.modules)) {
      if (!(key in features) || choice.selection === 'undecided') continue
      if (unsupportedFeatures.includes(key) && choice.selection === 'required') continue
      if (features[key] !== (choice.selection === 'required'))
        errors.push(`模块选择与运行配置不一致：${key}`)
    }
  return { explicit, features, errors }
}
export function caseFeature(item) {
  return (
    item.module ??
    {
      'files-live': 'files',
      'content-live': 'content',
      'auth-email-live': 'emailPassword',
      'auth-google-live': 'google',
      'billing-test-live': 'billing',
      'billing-creem-test-live': 'billing',
    }[item.id]
  )
}
export function activeItem(item, features) {
  const module = caseFeature(item)
  return !module || features[module]
}
