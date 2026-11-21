import config from './brand.json' with { type: 'json' }

type BrandAssets = {
  icon: string
  iconDark: string | null
  favicon: { href: string; type: string }
  appleTouchIcon: string | null
  /** A 1200×630 PNG, JPEG or WebP for link previews; null leaves previews text-only. */
  socialImage: string | null
}

export const brand: BrandAssets = config
