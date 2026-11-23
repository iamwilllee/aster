import config from './brand.json' with { type: 'json' }

type BrandAssets = {
  icon: string
  iconDark: string | null
  favicon: { href: string; type: string }
  appleTouchIcon: string | null
}

export const brand: BrandAssets = config
