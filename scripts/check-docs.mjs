import { checkDocs } from './docs-policy.mjs'
try {
  const result = checkDocs(process.cwd())
  if (result.errors.length) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  } else
    console.log(
      `Documentation checks passed: ${result.topics} bilingual topics; local links, anchors and translation fingerprints checked. Semantic/provider acceptance is separate.`,
    )
} catch {
  console.error(
    'Cannot validate documentation catalog; inspect docs/catalog.json and both language trees.',
  )
  process.exitCode = 1
}
