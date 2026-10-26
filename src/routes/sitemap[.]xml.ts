import { features } from '@/config/features'
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { localizePath } from '@/i18n/core'
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const origin = new URL(env.APP_ORIGIN).origin
        const entries =
          String(env.PUBLIC_INDEXABLE) === 'true'
            ? ['/', ...(features.billing ? ['/pricing'] : [])]
                .flatMap((path) =>
                  (['en', 'zh'] as const).map(
                    (locale) => `<url><loc>${origin}${localizePath(path, locale)}</loc></url>`,
                  ),
                )
                .join('')
            : ''
        let contentEntries = ''
        if (features.content && String(env.PUBLIC_INDEXABLE) === 'true') {
          const { database } = await import('@/server/database.server')
          const rows = await database()
            .prepare(
              'SELECT live_slug,live_locale FROM content_entry WHERE live IS NOT NULL ORDER BY live_locale,live_slug LIMIT 501',
            )
            .all<{ live_slug: string; live_locale: 'en' | 'zh' }>()
          contentEntries =
            (['en', 'zh'] as const)
              .map((locale) => `<url><loc>${origin}${localizePath('/content', locale)}</loc></url>`)
              .join('') +
            rows.results
              .map(
                (row) =>
                  `<url><loc>${origin}${localizePath('/content/' + row.live_slug, row.live_locale)}</loc></url>`,
              )
              .join('')
        }
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}${contentEntries}</urlset>`,
          {
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        )
      },
    },
  },
})
