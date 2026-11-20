import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { content, install, release, repository } from './content.mjs'
import { buildDocumentation, documentationPath } from './docs.mjs'
import { checkDocs } from '../scripts/docs-policy.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const output = resolve(root, 'dist/website')
const origin = 'https://aster.iamwilllee.com'
const docsCheck = checkDocs(root)
if (docsCheck.errors.length) throw new Error(docsCheck.errors.join('\n'))
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const arrow =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>'
const theme =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
function html(c, path) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'docs/catalog.json'), 'utf8'))
  const lang = c.lang === 'en' ? 'en' : 'zh'
  const docs = (file) =>
    documentationPath(lang, catalog.topics.find((topic) => topic.file === file).slug)
  return `<!doctype html>
<html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escape(c.title)}</title><meta name="description" content="${escape(c.description)}"><meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${path}"><link rel="canonical" href="${origin}${path}"><link rel="alternate" hreflang="en" href="${origin}/"><link rel="alternate" hreflang="zh-CN" href="${origin}/zh"><link rel="alternate" hreflang="x-default" href="${origin}/"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><script src="/app.js" defer></script></head>
<body><a class="skip" href="#main">${c.lang === 'en' ? 'Skip to content' : '跳转到内容'}</a>
<header class="shell header"><a class="brand" href="${path}"><img src="/assets/aster-icon.svg" width="32" height="32" alt=""><span>Aster<span class="dot">.</span></span></a><nav aria-label="${c.lang === 'en' ? 'Main navigation' : '主导航'}">${['foundation', 'capabilities', 'start', 'docs'].map((id, i) => `<a href="${id === 'docs' ? documentationPath(lang) : '#' + id}">${c.nav[i]}</a>`).join('')}</nav><div class="header-actions"><a class="language" href="${c.other}" lang="${c.lang === 'en' ? 'zh-CN' : 'en'}">${c.otherLabel}</a><button class="theme icon-button" aria-label="${c.theme}" aria-pressed="false">${theme}</button><a class="github-link" href="${repository}">GitHub ${arrow}</a></div></header>
<main id="main"><section class="shell hero"><div class="hero-copy"><p class="eyebrow enter">${c.eyebrow}</p><h1 class="enter" style="--step:1">${c.heading}</h1><p class="lead enter" style="--step:2">${c.intro}</p><div class="actions enter" style="--step:3"><a class="button primary" href="#start">${c.cta}${arrow}</a><a class="button outline" href="${repository}">${c.source}${arrow}</a></div><ul class="chips enter" style="--step:4">${c.chips.map((x) => `<li><span aria-hidden="true">✓</span>${x}</li>`).join('')}</ul></div>
<div class="flow enter" style="--step:3"><div class="flow-bar"><span class="window-dots" aria-hidden="true">● ● ●</span><span>your-next-product / aster</span>${arrow}</div><div class="flow-body"><p class="eyebrow">${c.flowLabel}</p>${c.flow.map(([n, title, text]) => `<div class="flow-step"><span class="step-no">${n}</span><div><h2>${title}</h2><p>${text}</p></div><span class="step-check" aria-hidden="true">↗</span></div>`).join('')}</div><div class="flow-end"><span class="status-dot" aria-hidden="true"></span>${c.flowFooter}</div></div>
</section><div class="shell release-line"><span>${release}</span><span>TanStack Start + Cloudflare</span><span>MIT</span><a href="${repository}/releases/tag/${release}">${c.releaseLabel} ↗</a></div>
<section class="shell section" id="foundation"><div class="section-head"><p class="eyebrow">01 / FOUNDATION</p><h2>${c.foundationTitle}</h2><p>${c.foundationIntro}</p></div><div class="foundation-grid">${c.foundation.map(([label, title, text]) => `<article><p class="eyebrow">${label}</p><h3>${title}</h3><p>${text}</p></article>`).join('')}</div></section>
<section class="tinted" id="capabilities"><div class="shell section"><div class="section-head"><p class="eyebrow">02 / CAPABILITIES</p><h2>${c.capabilitiesTitle}</h2><p>${c.capabilitiesIntro}</p></div><div class="capability-grid">${c.capabilities.map(([n, title, text]) => `<article><span class="number">${n}</span><div><h3>${title}</h3><p>${text}</p></div></article>`).join('')}</div><div class="profiles"><h3>${c.profilesTitle}</h3><div class="profile-grid">${c.profiles.map(([label, title, text]) => `<article><span class="tag">${label}</span><h4>${title}</h4><p>${text}</p></article>`).join('')}</div><p class="scope">${c.scope}</p></div></div></section>
<section class="shell section" id="start"><div class="section-head"><p class="eyebrow">03 / START BUILDING</p><h2>${c.startTitle}</h2><p>${c.startIntro}</p><p class="prerequisite">${c.prerequisite}</p></div><div class="start-grid"><div class="code-panel"><div class="code-top"><span>${c.setupLabel}</span><button class="copy" data-copy="install" data-success="${c.copied}" data-failure="${c.copyFail}">${c.copy}</button></div><pre><code id="install">${escape(install)}</code></pre></div><div class="prompt-panel"><div class="code-top"><span>${c.promptLabel}</span><button class="copy" data-copy="prompt" data-success="${c.copied}" data-failure="${c.copyFail}">${c.copy}</button></div><p class="prompt" id="prompt">${escape(c.prompt)}</p><p class="handoff">${c.handoff}</p></div></div><p id="copy-status" class="copy-status" role="status" aria-live="polite"></p></section>
<section class="shell section" id="docs"><div class="section-head"><p class="eyebrow">04 / DOCUMENTATION</p><h2>${c.docsTitle}</h2><p>${c.docsIntro}</p></div><div class="docs-grid">${c.docs.map(([title, text, file]) => `<a class="doc-link" href="${docs(file)}"><div><h3>${title}</h3><p>${text}</p></div>${arrow}</a>`).join('')}</div><a class="doc-index-link" href="${documentationPath(lang)}">${lang === 'en' ? 'Browse all documentation' : '浏览全部文档'} →</a></section>
<section class="shell section faq"><h2>${c.faqTitle}</h2><div>${c.faq.map(([q, a]) => `<details><summary>${q}<span aria-hidden="true">+</span></summary><p>${a}</p></details>`).join('')}</div></section>
<section class="shell final"><img src="/assets/aster-symbol.svg" alt="" width="48" height="48" loading="lazy"><h2>${c.finalTitle}</h2><a class="button primary" href="${repository}">${c.source}${arrow}</a></section></main>
<footer class="shell footer"><div><a class="brand" href="${path}">Aster<span class="dot">.</span></a><p>${c.footer}</p></div><div><a href="${repository}/blob/${release}/LICENSE">MIT License</a><a href="${repository}/releases/tag/${release}">${release} ↗</a></div></footer></body></html>`
}
rmSync(output, { recursive: true, force: true })
mkdirSync(resolve(output, 'assets'), { recursive: true })
mkdirSync(resolve(output, 'zh'), { recursive: true })
for (const [locale, path] of [
  ['en', '/'],
  ['zh', '/zh'],
])
  writeFileSync(
    resolve(output, locale === 'en' ? 'index.html' : 'zh/index.html'),
    html(content[locale], path),
  )
for (const file of ['styles.css', 'app.js', '_headers'])
  cpSync(resolve(here, file), resolve(output, file))
for (const file of ['aster-icon.svg', 'aster-symbol.svg', 'aster-logo.svg', 'aster-logo-dark.svg'])
  cpSync(resolve(root, 'public/brand', file), resolve(output, 'assets', file))
cpSync(resolve(root, 'public/favicon.svg'), resolve(output, 'favicon.svg'))
writeFileSync(
  resolve(output, '404.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · Aster</title><link rel="stylesheet" href="/styles.css"></head><body><main class="shell final"><p class="eyebrow">404</p><h1>This page is not here.</h1><a class="button primary" href="/">Back to Aster</a></main></body></html>`,
)
writeFileSync(
  resolve(output, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
)
const catalog = JSON.parse(readFileSync(resolve(root, 'docs/catalog.json'), 'utf8'))
const documentation = buildDocumentation({ root, output, catalog })
writeFileSync(
  resolve(output, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/zh</loc></url>${documentation.map((item) => `<url><loc>${origin}${item.path}</loc></url>`).join('')}</urlset>`,
)
console.log(
  `Built Aster static website (${readFileSync(resolve(output, 'index.html')).length} bytes English HTML) → dist/website`,
)
