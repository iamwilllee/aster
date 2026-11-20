import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderMarkdown } from './docs.mjs'
const root = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(readFileSync(resolve(root, 'docs/catalog.json'), 'utf8'))
const context = { root, file: 'docs/en/FRONTEND.md', lang: 'en', catalog }
test('documentation renderer preserves locale links, tables and unique heading anchors', () => {
  const rendered = renderMarkdown(
    '# Guide\n\n[中文](../FRONTEND.md)\n[Modules](MODULES.md)\n\n## Same name\n\n## Same name\n\n| A | B |\n| - | - |\n| x | y |\n',
    context,
  )
  assert.ok(rendered.html.includes('href="/zh/docs/frontend"'))
  assert.ok(rendered.html.includes('href="/docs/modules"'))
  assert.ok(rendered.html.includes('class="table-scroll"'))
  assert.ok(rendered.html.includes('<table>'))
  assert.deepEqual(
    rendered.headings.map((x) => x.id),
    ['guide', 'same-name', 'same-name-1'],
  )
})
test('documentation cannot execute raw HTML, unsafe links or external/private images', () => {
  const safe = renderMarkdown(
    '# Guide\n\n<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```\n',
    context,
  ).html
  assert.ok(!safe.includes('<script>'))
  assert.ok(safe.includes('&lt;script&gt;'))
  for (const markdown of [
    '[bad](javascript:alert(1))',
    '[bad](data:text/html,hi)',
    '![remote](https://example.com/a.png)',
    '![private](../../.dev.vars)',
  ])
    assert.throws(() => renderMarkdown(markdown, context))
})
