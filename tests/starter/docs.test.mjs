import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkDocs, digest, headings } from '../../scripts/docs-policy.mjs'
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aster-docs-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'docs/en'), { recursive: true })
  const zh = '# 中文指南\n\n## 安全边界\n\n不得上传测试数据。\n'
  const en = '# Guide\n\n## Safety boundary\n\nNever upload test data.\n'
  writeFileSync(join(root, 'docs/GUIDE.md'), zh)
  writeFileSync(join(root, 'docs/en/GUIDE.md'), en)
  writeFileSync(
    join(root, 'docs/catalog.json'),
    JSON.stringify({
      schemaVersion: 1,
      topics: [
        {
          slug: 'guide',
          file: 'GUIDE.md',
          title: { en: 'Guide', zh: '指南' },
          translation: { sourceSha256: digest(zh), englishSha256: digest(en) },
        },
      ],
    }),
  )
  return root
}
test('documentation coverage/fingerprints catch changed or missing translations', (t) => {
  const root = fixture(t)
  assert.deepEqual(checkDocs(root).errors, [])
  writeFileSync(
    join(root, 'docs/GUIDE.md'),
    readFileSync(join(root, 'docs/GUIDE.md'), 'utf8') + '新增要求。\n',
  )
  assert.ok(checkDocs(root).errors.some((x) => x.includes('fingerprint')))
  unlinkSync(join(root, 'docs/en/GUIDE.md'))
  assert.ok(checkDocs(root).errors.some((x) => x.includes('Missing en document')))
})
test('documentation links reject missing headings/files but ignore executable examples inside code fences', (t) => {
  const root = fixture(t)
  writeFileSync(
    join(root, 'docs/README.md'),
    '# Index\n\n[Valid](GUIDE.md#安全边界)\n\n```md\n[example](not-an-actual-file.md)\n```\n',
  )
  assert.deepEqual(checkDocs(root).errors, [])
  writeFileSync(
    join(root, 'docs/README.md'),
    '# Index\n\n[Bad](GUIDE.md#missing)\n[Missing](missing.md)\n',
  )
  assert.equal(checkDocs(root).errors.length, 2)
})
test('duplicate headings have stable unique Unicode-compatible anchors', () => {
  assert.deepEqual(
    headings('# Guide\n\n## Same `name`\n\n## Same name\n\n## 中文 标题\n').map((x) => x.id),
    ['guide', 'same-name', 'same-name-1', '中文-标题'],
  )
})

test('an English-only public topic cannot silently escape the bilingual catalog', (t) => {
  const root = fixture(t)
  writeFileSync(join(root, 'docs/en/EXTRA.md'), '# Extra topic\n')
  assert.ok(checkDocs(root).errors.some((x) => x.includes('Uncatalogued English')))
})

test('the README artwork and archived original README are not template content', async () => {
  const { excludedTemplatePath } = await import('../../scripts/starter-files.mjs')
  assert.equal(excludedTemplatePath('docs/readme'), true)
  assert.equal(excludedTemplatePath('docs/project-guide.md'), true)
  // Ordinary documentation is still copied.
  assert.equal(excludedTemplatePath('docs/FRONTEND.md'), false)
  assert.equal(excludedTemplatePath('docs/en/README.md'), false)
})
