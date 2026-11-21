import { describe, expect, it } from 'vitest'
import { socialMeta } from '@/lib/social-meta'

const base = {
  origin: 'https://app.example',
  path: '/zh/pricing',
  locale: 'zh' as const,
  siteName: 'Aster',
  title: 'Aster · 定价',
  description: '一个可靠的起点',
  image: null,
}
const get = (meta: ReturnType<typeof socialMeta>, key: string) =>
  meta.find((entry) => ('property' in entry ? entry.property : entry.name) === key)?.content

describe('social meta', () => {
  it('describes the page with an absolute url and locale', () => {
    const meta = socialMeta(base)
    expect(get(meta, 'og:url')).toBe('https://app.example/zh/pricing')
    expect(get(meta, 'og:locale')).toBe('zh_CN')
    expect(get(meta, 'og:locale:alternate')).toBe('en_US')
    expect(get(meta, 'og:title')).toBe('Aster · 定价')
    expect(get(meta, 'twitter:title')).toBe('Aster · 定价')
    expect(get(meta, 'og:type')).toBe('website')
  })

  it('shows a compact text card when there is no image', () => {
    const meta = socialMeta(base)
    expect(get(meta, 'twitter:card')).toBe('summary')
    expect(get(meta, 'og:image')).toBeUndefined()
    expect(get(meta, 'twitter:image')).toBeUndefined()
  })

  it('uses a large card with an absolute image url when there is one', () => {
    const meta = socialMeta({ ...base, image: '/brand/share.png' })
    expect(get(meta, 'twitter:card')).toBe('summary_large_image')
    expect(get(meta, 'og:image')).toBe('https://app.example/brand/share.png')
    expect(get(meta, 'twitter:image')).toBe('https://app.example/brand/share.png')
  })

  it('marks an article with its publication time', () => {
    const meta = socialMeta({ ...base, type: 'article', publishedTime: '2026-11-01T00:00:00.000Z' })
    expect(get(meta, 'og:type')).toBe('article')
    expect(get(meta, 'article:published_time')).toBe('2026-11-01T00:00:00.000Z')
  })

  it('has no duplicate keys, which the router would drop', () => {
    const keys = socialMeta({ ...base, image: '/a.png', type: 'article', publishedTime: 'x' }).map(
      (entry) => ('property' in entry ? entry.property : entry.name),
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})
