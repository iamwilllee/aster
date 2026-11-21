// Sync Flatpack into this product.
//   pnpm flatpack:sync [--from ../flatpack]   copy the theme layer and the listed components
//   pnpm flatpack:sync --check                verify the copies still match the record
// Flatpack is the design base: change it in the Flatpack repository, then sync. Products are
// self-contained copies, so nothing at runtime depends on the Flatpack checkout.
//   src/styles/flatpack.css            the theme layer (tokens, themes, data-slot styles)
//   src/components/flatpack/*.tsx      Flatpack components, unmodified
// Aster's src/components/ui/* wrap these and add only Aster behavior (hydration guard, i18n).
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Add a name here to adopt another Flatpack component. Components that import other
// Flatpack components must list those too.
export const components = [
  'button',
  'badge',
  'card',
  'table',
  'skeleton',
  'input',
  'textarea',
  'progress',
  'tabs',
  'checkbox',
  'switch',
  'dialog',
  'select',
  'dropdown-menu',
  'tooltip',
  'toast',
  'alert',
  'empty',
  'sidebar',
  'reveal',
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const record = resolve(root, 'src/styles/flatpack.source.json')
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const pairs = [
  ['src/styles/flatpack.css', 'src/styles/flatpack.css'],
  ...components.map((name) => [
    `src/components/ui/${name}.tsx`,
    `src/components/flatpack/${name}.tsx`,
  ]),
]
const args = process.argv.slice(2)

if (args.includes('--check')) {
  if (!existsSync(record)) throw new Error('src/styles/flatpack.source.json is missing')
  const expected = JSON.parse(readFileSync(record, 'utf8')).files ?? {}
  const drifted = pairs
    .map(([, local]) => local)
    .filter(
      (local) => !existsSync(resolve(root, local)) || sha(resolve(root, local)) !== expected[local],
    )
  if (drifted.length) {
    console.error(`These files differ from their recorded Flatpack source: ${drifted.join(', ')}.`)
    console.error('Run pnpm flatpack:sync, or move the change into Flatpack first.')
    process.exit(1)
  }
  console.log(`${pairs.length} Flatpack files match the recorded source.`)
  process.exit(0)
}

const fromIndex = args.indexOf('--from')
const from = resolve(root, fromIndex >= 0 ? args[fromIndex + 1] : '../flatpack')
const git = (...gitArgs) =>
  execFileSync('git', ['-C', from, ...gitArgs], { encoding: 'utf8' }).trim()
let commit = null
let dirty = null
try {
  commit = git('rev-parse', 'HEAD')
  dirty = git('status', '--porcelain', '--', 'src', 'tokens').length > 0
} catch {
  /* A copy without Git history still syncs, without a commit record. */
}
const files = {}
for (const [source, local] of pairs) {
  const from_ = resolve(from, source)
  if (!existsSync(from_)) throw new Error(`Flatpack file not found: ${from_}`)
  const to = resolve(root, local)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from_, to)
  files[local] = sha(to)
}
writeFileSync(record, JSON.stringify({ commit, uncommittedChanges: dirty, files }, null, 2) + '\n')
console.log(
  `Synced ${pairs.length} files${commit ? ` from ${commit.slice(0, 8)}${dirty ? ' (uncommitted changes)' : ''}` : ''}.`,
)
