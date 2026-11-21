// Open Graph and Twitter card tags for public pages, so a shared link shows a preview.
// Pure and free of Worker or router imports, so it is unit-tested directly.

type Locale = 'en' | 'zh'

export type SocialMetaInput = {
  /** Absolute origin of the product, without a path. */
  origin: string
  /** The localized path of this page, for og:url. */
  path: string
  locale: Locale
  siteName: string
  title: string
  description: string
  /** A public path to a PNG, JPEG or WebP, or null for a text-only preview. */
  image: string | null
  type?: 'website' | 'article'
  /** ISO time, for articles. */
  publishedTime?: string
}

export function socialMeta(input: SocialMetaInput) {
  const image = input.image ? input.origin + input.image : null
  const other = input.locale === 'zh' ? 'en_US' : 'zh_CN'
  return [
    { property: 'og:type', content: input.type ?? 'website' },
    { property: 'og:site_name', content: input.siteName },
    { property: 'og:title', content: input.title },
    { property: 'og:description', content: input.description },
    { property: 'og:url', content: input.origin + input.path },
    { property: 'og:locale', content: input.locale === 'zh' ? 'zh_CN' : 'en_US' },
    { property: 'og:locale:alternate', content: other },
    ...(input.type === 'article' && input.publishedTime
      ? [{ property: 'article:published_time', content: input.publishedTime }]
      : []),
    // A card with a large picture only when there is one; otherwise a compact text card.
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: input.description },
    ...(image
      ? [
          { property: 'og:image', content: image },
          { property: 'og:image:alt', content: input.siteName },
          { name: 'twitter:image', content: image },
        ]
      : []),
  ]
}
