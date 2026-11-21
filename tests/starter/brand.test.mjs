import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkBrand } from '../../scripts/check-brand.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aster-brand-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'src/config'), { recursive: true })
  mkdirSync(join(root, 'public'))
  writeFileSync(join(root, 'public/icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  const config = {
    icon: '/icon.svg',
    iconDark: null,
    favicon: { href: '/icon.svg', type: 'image/svg+xml' },
    appleTouchIcon: null,
  }
  return {
    root,
    config,
    check() {
      writeFileSync(join(root, 'src/config/brand.json'), JSON.stringify(config))
      return checkBrand(root)
    },
  }
}

test('brand references accept existing local assets and optional null variants', (t) => {
  const f = fixture(t)
  assert.deepEqual(f.check(), { errors: [], files: ['/icon.svg'] })
  writeFileSync(join(f.root, 'public/dark.svg'), '<svg/>')
  f.config.iconDark = '/dark.svg'
  assert.equal(f.check().errors.length, 0)
})

test('missing assets, misleading MIME and nonexistent optional assets fail', (t) => {
  const f = fixture(t)
  f.config.iconDark = '/missing.svg'
  f.config.favicon.type = 'image/png'
  f.config.appleTouchIcon = '/missing.png'
  assert.equal(f.check().errors.length, 3)
})

test('brand checks reject remote paths, traversal and symlinks outside public', (t) => {
  const f = fixture(t)
  for (const value of [
    'https://example.com/icon.svg',
    '//example.com/icon.svg',
    '/../icon.svg',
    '/%2e%2e/icon.svg',
  ]) {
    f.config.icon = value
    assert.ok(f.check().errors.some((item) => item.startsWith('icon:')))
  }
  writeFileSync(join(f.root, 'outside.svg'), '<svg/>')
  symlinkSync(join(f.root, 'outside.svg'), join(f.root, 'public/linked.svg'))
  f.config.icon = '/linked.svg'
  assert.ok(f.check().errors.some((item) => item.startsWith('icon:')))
})

test('the link-preview image is optional and must be a bitmap crawlers can render', (t) => {
  const f = fixture(t)
  // Products made before the field existed have no socialImage at all.
  assert.equal(f.check().errors.length, 0)
  f.config.socialImage = null
  assert.equal(f.check().errors.length, 0)
  writeFileSync(join(f.root, 'public/share.png'), 'png')
  f.config.socialImage = '/share.png'
  assert.deepEqual(f.check().files.sort(), ['/icon.svg', '/share.png'])
  // Other sites' crawlers do not render SVG or ICO previews.
  f.config.socialImage = '/icon.svg'
  assert.ok(f.check().errors.some((item) => item.startsWith('socialImage:')))
  f.config.socialImage = '/missing.png'
  assert.ok(f.check().errors.some((item) => item.startsWith('socialImage:')))
})
