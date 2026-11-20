import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { release, repository } from './content.mjs'
import { parse } from 'jsonc-parser'
import { documentationPath } from './docs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, '../dist/website')
const configErrors = []
const config = parse(readFileSync(resolve(here, 'wrangler.jsonc'), 'utf8'), configErrors, {
  allowTrailingComma: true,
})
assert.equal(configErrors.length, 0)
assert.equal(config.name, 'aster-site')
assert.equal(config.workers_dev, false)
assert.deepEqual(config.routes, [{ pattern: 'aster.iamwilllee.com', custom_domain: true }])
assert.equal(config.assets.directory, '../dist/website')
assert.equal(config.assets.not_found_handling, '404-page')
assert.equal(config.main, undefined)
for (const key of [
  'd1_databases',
  'r2_buckets',
  'kv_namespaces',
  'vars',
  'send_email',
  'ai',
  'services',
  'env',
])
  assert.equal(config[key], undefined, `Official static website must not declare ${key}`)
const expected = [
  '404.html',
  '_headers',
  'app.js',
  'assets/aster-icon.svg',
  'assets/aster-symbol.svg',
  'assets/aster-logo.svg',
  'assets/aster-logo-dark.svg',
  'favicon.svg',
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'styles.css',
  'zh/index.html',
]
const catalog = JSON.parse(readFileSync(resolve(here, '../docs/catalog.json'), 'utf8'))
for (const lang of ['en', 'zh'])
  for (const slug of ['', ...catalog.topics.map((t) => t.slug)])
    expected.push(documentationPath(lang, slug).slice(1) + '/index.html')
const fileForPath = (path) => {
  if (path === '/') return 'index.html'
  const raw = decodeURIComponent(path).replace(/^\//, '').replace(/\/$/, '')
  return expected.includes(raw) ? raw : raw + '/index.html'
}
function list(dir, prefix = '') {
  return readdirSync(dir).flatMap((name) => {
    const file = resolve(dir, name)
    return statSync(file).isDirectory() ? list(file, prefix + name + '/') : [prefix + name]
  })
}
assert.deepEqual(
  list(output).sort(),
  expected.sort(),
  'Only explicit public site assets can be uploaded',
)
const external = new Set()
for (const [file, lang, path] of [
  ['index.html', 'en', '/'],
  ['zh/index.html', 'zh-CN', '/zh'],
]) {
  const html = readFileSync(resolve(output, file), 'utf8')
  assert.ok(html.includes(`<html lang="${lang}">`))
  assert.ok(html.includes(`rel="canonical" href="https://aster.iamwilllee.com${path}"`))
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1])
  assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique')
  for (const [, href] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (href.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `Missing target ${href}`)
    else if (href.startsWith('https:')) {
      const u = new URL(href)
      assert.ok(
        ['aster.iamwilllee.com', 'github.com'].includes(u.hostname),
        'No external trackers/assets',
      )
      if (u.hostname === 'github.com') {
        assert.ok(href.startsWith(repository))
        external.add(href)
      }
    } else if (href === '/' || href === '/zh') continue
    else assert.ok(expected.includes(fileForPath(href)), `Missing public resource ${href}`)
  }
  assert.ok(html.includes(`${repository}/releases/tag/${release}`))
  assert.doesNotMatch(html, /href="\/(login|signup|app|pricing)\b/)
}
for (const file of expected.filter((f) => f.includes('/index.html'))) {
  const html = readFileSync(resolve(output, file), 'utf8')
  const path = '/' + file.replace(/\/index\.html$/, '')
  const expectedLang = path === '/zh' || path.startsWith('/zh/') ? 'zh-CN' : 'en'
  assert.ok(html.includes(`<html lang="${expectedLang}">`), `Wrong language: ${file}`)
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `One title: ${file}`)
  const ownIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1])
  assert.equal(new Set(ownIds).size, ownIds.length, `Unique ids: ${file}`)
  for (const [, href] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (!href.startsWith('/') && !href.startsWith('#')) continue
    const [target, fragment] = href.split('#')
    const targetFile = target ? fileForPath(target) : file
    assert.ok(expected.includes(targetFile), `Broken doc resource: ${file} → ${href}`)
    if (fragment) {
      const targetHTML = readFileSync(resolve(output, targetFile), 'utf8')
      const id = decodeURIComponent(fragment)
      assert.ok(targetHTML.includes(`id="${id}"`), `Broken doc fragment: ${file} → ${href}`)
    }
  }
}
assert.ok(readFileSync(resolve(output, '_headers'), 'utf8').includes("frame-ancestors 'none'"))
console.log(
  `Static site checks passed: ${expected.length} explicit files, two locales, valid links and no cloud bindings.`,
)
console.log(`Published-release documentation links: ${external.size}`)
