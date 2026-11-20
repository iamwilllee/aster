import { Marked } from 'marked'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { headingSlug } from '../scripts/docs-policy.mjs'
import { repository, release } from './content.mjs'

const origin = 'https://aster.iamwilllee.com'
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
export const documentationPath = (lang, slug = '') =>
  (lang === 'zh' ? '/zh/docs' : '/docs') + (slug ? '/' + slug : '')
export const groups = {
  start: { en: 'Get started', zh: '开始使用' },
  design: { en: 'Design', zh: '界面与品牌' },
  product: { en: 'Product capabilities', zh: '产品能力' },
  cloud: { en: 'Cloud and services', zh: '上云与服务' },
  maintenance: { en: 'Maintenance', zh: '升级与维护' },
}
export function renderMarkdown(markdown, { root, file, lang, catalog }) {
  const headings = []
  const used = new Map()
  function link(href) {
    const raw = href.replace(/&amp;/g, '&')
    if (/^(https?:|mailto:)/i.test(raw)) return raw
    if (raw.startsWith('#')) return raw
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//'))
      throw Error(`Unsupported link protocol in ${file}`)
    const [path, hash] = raw.split('#')
    const absolute = resolve(root, dirname(file), decodeURIComponent(path))
    const repoPath = relative(root, absolute).replaceAll('\\', '/')
    if (repoPath.startsWith('../')) throw Error(`Documentation link outside source: ${file}`)
    const topic = catalog.topics.find(
      (t) => repoPath === 'docs/' + t.file || repoPath === 'docs/en/' + t.file,
    )
    if (topic)
      return (
        documentationPath(repoPath.startsWith('docs/en/') ? 'en' : 'zh', topic.slug) +
        (hash ? '#' + hash : '')
      )
    if (['docs/README.md', 'docs/en/README.md'].includes(repoPath))
      return documentationPath(repoPath === 'docs/en/README.md' ? 'en' : 'zh')
    if (repoPath.startsWith('public/brand/'))
      return '/assets/' + repoPath.slice('public/brand/'.length)
    if (repoPath === 'public/favicon.svg') return '/favicon.svg'
    return `${repository}/blob/${release}/${repoPath}` + (hash ? '#' + hash : '')
  }
  const marked = new Marked({
    gfm: true,
    renderer: {
      html({ text }) {
        return esc(text)
      },
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const base = headingSlug(text)
        const occurrence = used.get(base) ?? 0
        used.set(base, occurrence + 1)
        const id = base + (occurrence ? `-${occurrence}` : '')
        headings.push({ depth, id, text: text.replace(/<[^>]*>/g, '') })
        return `<h${depth} id="${esc(id)}">${text}</h${depth}>\n`
      },
      link({ href, title, tokens }) {
        const target = link(href)
        return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`
      },
      image({ href, text, title }) {
        const target = link(href)
        if (!target.startsWith('/assets/') && target !== '/favicon.svg')
          throw Error(`Only approved local brand images are published: ${file}`)
        return `<img src="${esc(target)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ''} loading="lazy">`
      },
      table(token) {
        return `<div class="table-scroll" tabindex="0" role="region" aria-label="${lang === 'en' ? 'Documentation table' : '文档表格'}">${Object.getPrototypeOf(this).table.call(this, token)}</div>`
      },
    },
  })
  return { html: marked.parse(markdown), headings }
}
function frame({ lang, title, path, other, body, catalog, slug = '' }) {
  const zh = lang === 'zh'
  const home = zh ? '/zh' : '/'
  const nav = Object.entries(groups)
    .map(
      ([key, label]) =>
        `<div class="docs-group"><p>${label[lang]}</p>${catalog.topics
          .filter((t) => t.group === key)
          .map(
            (t) =>
              `<a href="${documentationPath(lang, t.slug)}"${slug === t.slug ? ' aria-current="page"' : ''}>${esc(t.title[lang])}</a>`,
          )
          .join('')}</div>`,
    )
    .join('')
  return `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)} · Aster ${zh ? '文档' : 'Docs'}</title><meta name="description" content="${esc(title)} — ${zh ? 'Aster 产品开发与 Agent 使用指南' : 'Aster product development and Agent guide'}"><link rel="canonical" href="${origin}${path}"><link rel="alternate" hreflang="en" href="${origin}${documentationPath('en', slug)}"><link rel="alternate" hreflang="zh-CN" href="${origin}${documentationPath('zh', slug)}"><link rel="alternate" hreflang="x-default" href="${origin}${documentationPath('en', slug)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script></head><body><a class="skip" href="#main">${zh ? '跳转到内容' : 'Skip to content'}</a><header class="shell header docs-header"><a class="brand" href="${home}"><img src="/assets/aster-icon.svg" alt="" width="32" height="32"><span>Aster<span class="dot">.</span></span></a><nav aria-label="${zh ? '主导航' : 'Main navigation'}"><a href="${home}">${zh ? '产品官网' : 'Product'}</a><a href="${documentationPath(lang)}">${zh ? '文档' : 'Documentation'}</a><a href="${repository}/releases/tag/${release}">${release}</a></nav><div class="header-actions"><a class="language" href="${other}" lang="${zh ? 'en' : 'zh-CN'}">${zh ? 'EN' : '中文'}</a><button class="theme icon-button" aria-label="${zh ? '切换明暗主题' : 'Switch color theme'}" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button></div></header><div class="shell docs-layout"><aside class="docs-sidebar"><nav aria-label="${zh ? '文档目录' : 'Documentation topics'}">${nav}</nav></aside><main id="main" class="docs-main"><details class="docs-mobile-nav"><summary>${zh ? '浏览文档目录' : 'Browse documentation'}</summary><nav aria-label="${zh ? '手机文档目录' : 'Mobile documentation topics'}">${nav}</nav></details><div class="docs-meta"><a href="${documentationPath(lang)}">${zh ? '文档' : 'Docs'}</a><span>/</span><span>${zh ? '当前源码指南' : 'Current source guides'}</span></div><p class="docs-version-note">${zh ? '文档持续更新，较新的规范可能先于下一次发版。使用固定版本时，请先核对' : 'Guides evolve with the source; newer guidance may precede a release. For a pinned version, check the'} <a href="${documentationPath(lang, 'release-0-2')}">${zh ? '版本支持范围' : 'release scope'}</a>${zh ? '。' : '.'}</p>${body}<footer class="docs-footer"><a href="${home}">← ${zh ? '返回官网' : 'Back to Aster'}</a><a href="${other}">${zh ? 'Read in English' : '阅读中文'} ↗</a></footer></main></div></body></html>`
}
export function buildDocumentation({ root, output, catalog }) {
  const published = []
  const save = (path, html) => {
    const file = path.replace(/^\//, '') + '/index.html'
    mkdirSync(dirname(resolve(output, file)), { recursive: true })
    writeFileSync(resolve(output, file), html)
    published.push({ path, file })
  }
  for (const lang of ['en', 'zh']) {
    const title = lang === 'en' ? 'Documentation' : '使用文档'
    const body = `<article class="doc-article"><h1>${title}</h1><p>${lang === 'en' ? 'Build, configure and maintain your product with Aster. Start with the Agent guide or select a topic.' : '使用 Aster 开发、配置与维护你的产品。从 Agent 指南开始，或选择需要的主题。'}</p>${Object.entries(
      groups,
    )
      .map(
        ([key, label]) =>
          `<section class="docs-index-section"><h2>${label[lang]}</h2><div>${catalog.topics
            .filter((t) => t.group === key)
            .map(
              (t) =>
                `<a href="${documentationPath(lang, t.slug)}">${esc(t.title[lang])}<span aria-hidden="true">↗</span></a>`,
            )
            .join('')}</div></section>`,
      )
      .join('')}</article>`
    save(
      documentationPath(lang),
      frame({
        lang,
        title,
        path: documentationPath(lang),
        other: documentationPath(lang === 'en' ? 'zh' : 'en'),
        body,
        catalog,
      }),
    )
    for (const topic of catalog.topics) {
      const file = 'docs/' + (lang === 'en' ? 'en/' : '') + topic.file
      // Markdown keeps a locale link for repository readers; the website already
      // provides equivalent-page language navigation in its header and footer.
      const markdown = readFileSync(resolve(root, file), 'utf8').replace(
        /^\[(?:English|中文)\]\([^\n]+\)\n/gm,
        '',
      )
      const rendered = renderMarkdown(markdown, { root, file, lang, catalog })
      const toc = rendered.headings
        .filter((h) => h.depth === 2)
        .map((h) => `<a href="#${esc(h.id)}">${esc(h.text)}</a>`)
        .join('')
      const body = `<article class="doc-article">${rendered.html.replace('</h1>', '</h1>' + (toc ? `<details class="docs-toc"><summary>${lang === 'en' ? 'On this page' : '本页目录'}</summary><nav aria-label="${lang === 'en' ? 'On this page' : '本页目录'}">${toc}</nav></details>` : ''))}</article>`
      save(
        documentationPath(lang, topic.slug),
        frame({
          lang,
          title: topic.title[lang],
          path: documentationPath(lang, topic.slug),
          other: documentationPath(lang === 'en' ? 'zh' : 'en', topic.slug),
          body,
          catalog,
          slug: topic.slug,
        }),
      )
    }
  }
  return published
}
