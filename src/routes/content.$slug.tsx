import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { getContentDetail } from '@/modules/content/functions'
import { ContentReading } from '@/components/content-reading'
import { useI18n } from '@/components/providers'
import { brand } from '@/config/brand'
import { site } from '@/config/site'
import { localizePath } from '@/i18n/core'
import { contentAssetUrl } from '@/modules/content/policy'
import { socialMeta } from '@/lib/social-meta'
export const Route = createFileRoute('/content/$slug')({
  loaderDeps: ({ search }) => ({ locale: search._locale ?? 'en' }),
  loader: async ({ params, deps }) => {
    const entry = await getContentDetail({ data: { locale: deps.locale, slug: params.slug } })
    if (!entry) throw notFound()
    return entry
  },
  head: ({ loaderData: entry, match, matches }) => {
    if (!entry) return { meta: [] }
    const title = entry.seoTitle || entry.title
    const description = entry.seoDescription || entry.summary
    // The root route is always the first match; its loader carries the product origin.
    const origin = (matches[0]?.loaderData as { origin?: string } | undefined)?.origin
    const locale = match.search._locale ?? 'en'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        // These win over the site-wide tags the root route sets for the same properties.
        ...(origin
          ? socialMeta({
              origin,
              path: localizePath(match.pathname, locale),
              locale,
              siteName: site.name,
              title,
              description,
              image: entry.coverAssetId ? contentAssetUrl(entry.coverAssetId) : brand.socialImage,
              type: 'article',
              publishedTime: new Date(entry.publishedAt).toISOString(),
            })
          : []),
      ],
    }
  },
  component: Detail,
})
function Detail() {
  const entry = Route.useLoaderData(),
    { t } = useI18n()
  return (
    <article className="py-8">
      <div className="mx-auto mb-10 max-w-3xl">
        <Link to="/content" className="text-sm text-muted-foreground hover:underline">
          ← {t('content_back')}
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">
          <time dateTime={new Date(entry.publishedAt).toISOString()}>
            {new Date(entry.publishedAt).toISOString().slice(0, 10)}
          </time>
        </p>
      </div>
      <ContentReading entry={entry} />
    </article>
  )
}
