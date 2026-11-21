import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

export const digest = (text) => createHash('sha256').update(text).digest('hex')
export function headingSlug(text) {
  return text
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}
export function headings(markdown) {
  const used = new Map()
  return stripFences(markdown)
    .split('\n')
    .flatMap((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (!match) return []
      const base = headingSlug(match[2])
      const index = used.get(base) ?? 0
      used.set(base, index + 1)
      return [{ depth: match[1].length, text: match[2], id: base + (index ? `-${index}` : '') }]
    })
}
function stripFences(markdown) {
  return markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
}
export function markdownLinks(markdown) {
  return [...stripFences(markdown).matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(
    (match) => match[1],
  )
}
export function checkDocs(root) {
  const errors = []
  const catalog = JSON.parse(readFileSync(resolve(root, 'docs/catalog.json'), 'utf8'))
  const topics = catalog.topics
  if (catalog.schemaVersion !== 1 || !Array.isArray(topics))
    throw Error('Invalid documentation catalog')
  const slugs = new Set(),
    files = new Set()
  const records = []
  for (const topic of topics) {
    if (typeof topic.slug !== 'string' || !/^[a-z0-9-]+$/.test(topic.slug) || slugs.has(topic.slug))
      errors.push(`Invalid/duplicate topic slug: ${topic.slug}`)
    if (
      !/^(?:[a-z-]+\/)?[A-Za-z0-9.-]+\.md$/.test(topic.file) ||
      topic.file.includes('..') ||
      files.has(topic.file)
    ) {
      errors.push(`Invalid/duplicate documentation file: ${topic.file}`)
      continue
    }
    slugs.add(topic.slug)
    files.add(topic.file)
    if (!topic.title?.en || !topic.title?.zh) errors.push(`Missing translated title: ${topic.slug}`)
    for (const lang of ['en', 'zh']) {
      const path = 'docs/' + (lang === 'en' ? 'en/' : '') + topic.file
      if (!existsSync(resolve(root, path))) {
        errors.push(`Missing ${lang} document: ${path}`)
        continue
      }
      const text = readFileSync(resolve(root, path), 'utf8')
      records.push({ path, text })
      if (!headings(text).some((x) => x.depth === 1)) errors.push(`Missing document title: ${path}`)
      const expected =
        lang === 'en' ? topic.translation?.englishSha256 : topic.translation?.sourceSha256
      if (expected !== digest(text))
        errors.push(`Translation needs review / fingerprint update: ${path}`)
    }
  }
  // Not part of the stable bilingual catalog: the branch-only roadmap is internal, and
  // project-guide.md is the archived Chinese-only original README that the README links.
  const publicFiles = readdirSync(resolve(root, 'docs')).filter(
    (x) => x.endsWith('.md') && !['README.md', 'ROADMAP-0.3.md', 'project-guide.md'].includes(x),
  )
  for (const file of publicFiles)
    if (!files.has(file)) errors.push(`Uncatalogued public document: ${file}`)
  for (const file of readdirSync(resolve(root, 'docs/en')).filter(
    (x) => x.endsWith('.md') && !['README.md', 'ROADMAP-0.3.md'].includes(x),
  ))
    if (!files.has(file)) errors.push(`Uncatalogued English document: ${file}`)
  for (const path of [
    'docs/README.md',
    'docs/en/README.md',
    'skills/aster-new/SKILL.md',
    'skills/aster-new/references/workflow.md',
  ]) {
    if (existsSync(resolve(root, path)))
      records.push({ path, text: readFileSync(resolve(root, path), 'utf8') })
  }
  for (const record of records)
    for (const href of markdownLinks(record.text)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue
      const [file, fragment] = href.split('#')
      let decoded
      try {
        decoded = decodeURIComponent(file)
      } catch {
        errors.push(`Invalid link encoding in ${record.path}`)
        continue
      }
      const target = resolve(
        root,
        dirname(record.path),
        decoded || relative(dirname(record.path), record.path),
      )
      const within = relative(root, target)
      if (within === '..' || within.startsWith(`..${sep}`) || !existsSync(target)) {
        errors.push(`Broken link: ${record.path} → ${href}`)
        continue
      }
      if (fragment && target.endsWith('.md')) {
        let anchor
        try {
          anchor = decodeURIComponent(fragment)
        } catch {
          errors.push(`Invalid anchor encoding: ${record.path}`)
          continue
        }
        if (!headings(readFileSync(target, 'utf8')).some((x) => x.id === anchor))
          errors.push(`Broken anchor: ${record.path} → ${href}`)
      }
    }
  return { errors, topics: topics.length, documents: records.length }
}
